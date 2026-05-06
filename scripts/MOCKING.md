# Guía de Mocking y Seed de Datos

Este documento explica los datos cargados mediante el script de seed (`pnpm run db:seed`) y cómo verificar que el sistema esté funcionando correctamente con ellos.

## Usuarios de Prueba

Todos los usuarios tienen la contraseña: `password123`

| Nombre | Email | Rol | Propósito |
|--------|-------|-----|-----------|
| **Admin** | `admin@limpiasol.com` | `admin` | Acceso total al panel de administración. |
| **Reseller VIP** | `reseller@business.com` | `reseller` | Pruebas de precios mayoristas y descuentos por volumen. |
| **Juan Perez** | `juan.perez@example.com` | `user` | Pruebas de consumidor final (precios públicos). |

## Productos y Precios

Se han cargado 4 productos principales con diferentes configuraciones de precios:

### 1. Lavandina Concentrada (`LAV-001`)
*   **Variantes:** Envase 1L (`var_lav_1L`) y Bidón 5L (`var_lav_5L`).
*   **Precios Retail:** 1L ($1200), 5L ($5000).
*   **Precios Reseller:** 1L ($850), 5L ($3500).
*   **Descuento por Volumen (Reseller 1L):**
    *   10+ unidades: 5% extra.
    *   50+ unidades: 10% extra.

### 2. Detergente Magistral (`DET-002`)
*   **Variantes:** Solo una variante estándar.
*   **Precios:** Retail ($2500) vs Reseller ($1800).

### 3. Escoba (`ESC-003`)
*   **Precios:** Retail ($3200) vs Reseller ($2000).

### 4. Desengrasante Industrial (`DES-004`)
*   **Configuración Especial:** `isPricePublic: false`.
*   **Visibilidad:** El precio solo debe ser visible si el usuario está logueado (ej: Reseller). El Retail no debería ver el precio o ver un aviso de "Consultar".

## Módulos Configurados

### Descuentos (`discounts`)
*   **Cupón `BIENVENIDA10`:** 10% de descuento (Mínimo $10,000).
*   **Cupón `MAYORISTA5000`:** $5000 de descuento fijo (Mínimo $50,000).

### Impuestos (`taxes`)
*   **IVA:** 21% configurado por defecto.
*   **IIBB CABA:** 3% adicional para la provincia "CABA".

### Envíos (`shipping`)
*   **Umbral Envío Gratis:** $50,000.
*   **Tarifa Plana CABA:** $2500.
*   **Punto de Retiro:** "Depósito Central" disponible.

## Escenarios de Prueba Sugeridos

1.  **Login como Reseller:** Verifica que al listar productos, los precios mostrados sean los de la columna "Reseller" y no los públicos.
2.  **Carrito Reseller:** Agrega 60 unidades de Lavandina 1L. Verifica que el subtotal aplique el 10% de descuento por volumen sobre el precio de $850.
3.  **Cupón de Descuento:** Aplica `BIENVENIDA10` en una compra de más de $10,000 y verifica que el total se reduzca un 10%.
4.  **Cálculo de Impuestos:** En el checkout, selecciona la provincia "CABA". Verifica que se sume el 3% de Ingresos Brutos al total.
5.  **Envío Gratis:** Supera los $50,000 en el carrito y verifica que el costo de envío pase a ser $0.
