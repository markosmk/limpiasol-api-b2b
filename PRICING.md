# Sistema de Precios (Pricing System)

Este documento explica cómo funciona el sistema de precios en la API, la relación entre productos, variantes y niveles de precio (`priceTiers`), y cómo se resuelve qué precio cobrarle a un usuario en el flujo de compras.

## 1. Arquitectura de Datos: Productos y Variantes

En nuestra base de datos, la estructura está diseñada para soportar un modelo similar a Shopify:

- **Producto (`products`)**: Es la entidad contenedora abstracta. Tiene información general como el nombre (ej. "Limpiador X"), la marca, descripción, etc.
- **Variante (`product_variants`)**: Es la manifestación física y comprable del producto (ej. "Aroma Pino 5L"). **Todo producto debe tener al menos una variante.** Si un administrador crea un producto sin especificar variantes, el sistema automáticamente genera una "variante por defecto".
- **Precios (`price_tiers`)**: Define cuánto cuesta algo dependiendo de quién compra. 
  - `productId`: Obligatorio.
  - `variantId`: Opcional (puede ser `null`).
  - `tierType`: El rol del usuario (`retail`, `reseller`, `distributor`, etc.).

> [!IMPORTANT]
> **Estado del Producto**: Los precios solo son consultables si el producto tiene `status = 'published'`. Si un producto está en `draft`, cualquier intento de consultar su precio resultará en un error `404 (Not Found)`.

### ¿Por qué `variantId` puede ser nulo en un precio?

Esto permite la **Herencia de Precios**. 

Si tienes un producto con 5 aromas diferentes (5 variantes) y todos valen lo mismo, sería ineficiente obligar al administrador a crear 5 precios repetidos en la base de datos. 
En su lugar, el administrador puede crear **un solo precio base atado al producto** (`productId = X`, `variantId = null`). 

Si luego decides que el "Aroma Lavanda" es más caro, simplemente creas un precio específico para esa variante (`productId = X`, `variantId = Aroma_Lavanda_ID`).

---

## 2. El Flujo de Resolución de Precios (`calculatePricesBulk`)

Cuando un usuario entra a su carrito de compras y vemos que tiene varias variantes agregadas, llamamos a `pricing.service.ts -> calculatePricesBulk`. Este método es el "cerebro" que decide qué precio cobrar.

### El Algoritmo de Cascada (Fallback Strategy)

Para cada variante en el carrito, el sistema hace una sola consulta gigante a la base de datos para traer todos los precios aplicables a los productos en cuestión. Luego, en memoria, ejecuta esta cascada de búsqueda para determinar el precio final de cada variante:

1. **Variante + Rol del Usuario:** Intenta encontrar un precio creado específicamente para esta variante y para el rol exacto del usuario (ej. variante "Lavanda", rol "reseller").
2. **Variante + Retail:** Si el usuario es `reseller` pero la variante no tiene precio de `reseller`, el sistema "cae" al precio `retail` (público general) específico de esa variante.
3. **Producto Base + Rol del Usuario:** Si la variante no tiene ningún precio específico cargado, el sistema busca un precio base del producto (`variantId = null`) para el rol del usuario (`reseller`).
4. **Producto Base + Retail:** Si el producto tampoco tiene precio base para el rol, usa el precio base público general (`retail`).

**¿Qué pasa si cambias/agregas variantes?**
- Si habías creado un precio base (`variantId = null`) y mañana agregas 3 variantes nuevas, **no necesitas tocar los precios**. Las nuevas variantes heredarán automáticamente el precio base siguiendo el paso 3 o 4.

---

## 3. Reglas de Compra (Purchase Rules) y Descuentos por Volumen

El precio base no es lo único que se calcula. Cada producto/variante puede tener `purchaseRules` (cantidades mínimas, steps) y `volumeDiscounts` (precios escalonados si llevas más de X cantidad).

Al igual que los precios, **las reglas de compra se heredan**:
1. Se busca si la Variante tiene reglas específicas.
2. Si no tiene, se usan las reglas del Producto.
3. Si el producto tampoco tiene, se usan las reglas por defecto globales del sistema (ej. mínimo 1 unidad).

> [!IMPORTANT]
> Al igual que con los precios, si el producto no está publicado (`status: 'published'`), las reglas no se resolverán y el sistema retornará `null`, bloqueando cualquier acción de compra o cotización.

### Validación en el Carrito
Antes de insertar o modificar un ítem en el carrito, el `carts.service.ts` llama a `pricingService.validateQuantity`. Este método junta la lógica de las reglas y evalúa si la cantidad solicitada (ej. `quantity: 5`) cumple con el mínimo exigido.

---

## 4. El Flujo Completo del Administrador

Para entender cómo se opera este sistema en la vida real, imagina a un Admin creando un catálogo:

1. **Creación del Producto Simple:**
   - El admin completa el formulario del "Limpiador X".
   - No especifica variantes.
   - Pone un precio público de $1000.
   - **Backend:** Crea el producto, genera la `Variante Default` y guarda un `price_tier` con `productId = X, variantId = null, tierType = retail, price = 1000`.

2. **Migrando a Múltiples Variantes:**
   - Días después, el admin edita el producto y agrega "Aroma Pino" y "Aroma Lavanda".
   - **Backend:** Elimina o renombra la `Variante Default` para dar paso a las dos nuevas.
   - **Precios:** No hace falta que el admin vuelva a cargar precios. Al heredar el precio base, ambas variantes cuestan $1000 automáticamente.

3. **Precios Específicos:**
   - El admin se da cuenta que la Lavanda es cara de producir. Edita la variante "Lavanda" y le pone un precio de $1200.
   - **Backend:** Agrega un `price_tier` con `variantId = Lavanda_ID, tierType = retail, price = 1200`.
   - El Pino sigue heredando los $1000 del base, pero la Lavanda intercepta la cascada en el "Paso 1" y cobra $1200.

4. **Agregando Rol Mayorista:**
   - El admin quiere darle beneficio a los revendedores. Abre la sección de precios y asigna un "Precio Reseller Base" de $800 al producto.
   - **Backend:** Agrega un `price_tier` con `productId = X, variantId = null, tierType = reseller, price = 800`.
   - El Pino para un reseller costará $800. ¿Pero y la Lavanda? Como la Lavanda tiene precio `retail` específico ($1200) pero NO tiene precio `reseller` específico, la cascada caerá al precio base `reseller` ($800) o al `retail` de la variante ($1200). En nuestra cascada, el orden actual (VarianteRetail -> ProductoReseller o VarianteRetail primero?) decide. *Nota de código: nuestra cascada prioriza VarianteRetail por sobre ProductoReseller para mantener la lógica estricta de la variante.*

---

## 5. Resumen del Refactor en `calculatePricesBulk`

Antes, la consulta a base de datos pedía precios filtrando **únicamente** por `variantId`. Si el precio era de tipo Base (`variantId = null`), la consulta SQL lo omitía por completo, provocando errores `price_not_found` al llegar al carrito si no se había duplicado el precio para cada variante.

**Ahora**, `carts.service.ts` se da cuenta a qué producto pertenece cada variante, y hace la consulta por `productId`. Esto nos trae a la memoria tanto los precios específicos de las variantes como los precios base `null`. Luego, con todos esos precios en memoria, se ejecuta el Algoritmo de Cascada en Javascript, logrando un cálculo ultrarrápido y sin problemas de herencia.
