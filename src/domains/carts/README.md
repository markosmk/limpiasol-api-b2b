# Dominio: Carts (Carritos de Compra B2B)

Este dominio gestiona la intención de compra de los usuarios. A diferencia de un e-commerce B2C tradicional donde el carrito puede vivir en `localStorage`, en este sistema B2B el carrito es una entidad persistente en la Base de Datos.

## ¿Por qué persistimos el carrito en la BD?
1. **Sesiones Multi-dispositivo:** El cliente B2B suele armar el pedido en el depósito usando su celular, y luego lo revisa y confirma desde la computadora de la oficina.
2. **Ciclos de compra largos:** Los pedidos mayoristas pueden tardar días en armarse.
3. **Precios Dinámicos:** Los precios y descuentos por volumen cambian. Al tener el carrito en el backend, se hidrata con los precios reales al momento de la consulta.
4. **Inteligencia de Negocio:** Permite auditar qué intentó comprar el usuario y recuperar ventas caídas.

---
## Flujo de Operación HTTP

1. **Lectura e Hidratación (`GET /carts`):**
   - Retorna el carrito activo del usuario.
   - Hidrata cada ítem con su precio real usando el `tier` del usuario (ej. `reseller`).
   - Calcula y retorna el subtotal de la compra.

2. **Agregar Ítems (`POST /carts/items`):**
   - Recibe `productId`, `quantity` y opcionalmente `variantId`.
   - Valida reglas de negocio (`minQuantity`, etc.).
   - Realiza un *Upsert* (inserta o suma la cantidad si ya existe).

3. **Modificar/Eliminar Ítems (`PATCH /carts/items/:productId`):**
   - Actualiza la cantidad exacta de un ítem. 
   - El `variantId` viaja en el body para identificar la variante exacta si aplica.
   - Si la cantidad enviada es `0`, el ítem se elimina de la base de datos.

4. **Vaciar Carrito (`DELETE /carts`):**
   - Elimina todos los ítems asociados al carrito activo del usuario.

---

## Ciclo de Vida y Estados (`status`)

El carrito B2B funciona como una herramienta de inteligencia de negocio. Su estado define en qué parte del embudo se encuentra:

* **`active` (Activo):** Es el carrito que el usuario está modificando actualmente. Solo puede haber UN carrito activo por usuario.
* **`converted` (Convertido):** Cuando el `OrdersService` crea la orden con éxito, el carrito **no se borra**, se marca como `converted`. 
  *Razón de negocio:* Auditoría. Si un cliente reclama diferencias entre lo que "puso en el carrito" y lo que se facturó en la orden, el administrador puede revisar la foto exacta del carrito previo a la conversión.
* **`abandoned` (Abandonado):** Carritos que quedaron en estado `active` por un tiempo prolongado.
  *Razón de negocio:* Recuperación de ventas. Un vendedor puede ver estos carritos y contactar al cliente para ofrecer asistencia o un descuento para cerrar el pedido.

---

## Consideraciones para el Frontend
* **Disclaimer de Precios:** Dado que los precios son dinámicos y se calculan en el servidor, el frontend debe mostrar un texto genérico del tipo: *"Los precios se actualizarán al valor vigente al momento de confirmar el pedido"*.
* **Estado Espejo:** El frontend (ej. Zustand) debe actuar únicamente como un caché visual de la respuesta del `GET /carts`.

---

## TODOs y Futuros Features (Roadmap)

- [ ] **Feature: Aviso de cambio de precio:**
  *Idea de implementación:* Guardar en `cart_items` un campo `lastSeenPrice`. Si en el `GET /carts` el precio actual calculado es diferente al `lastSeenPrice`, el backend devuelve un *flag* (`priceChanged: true`). El frontend usa esto para mostrar una alerta visual ("Algunos precios se han actualizado").
- [ ] **Feature: Recuperación de Carritos Abandonados:**
  *Idea de implementación:* Crear un Cronjob que corra diariamente. Si un carrito lleva > 7 días en `active` y su subtotal supera X monto, pasarlo a `abandoned` y disparar un evento al `NotificationService` para enviar un email automático al cliente ("Olvidaste tu pedido...") o un aviso al panel del Admin.