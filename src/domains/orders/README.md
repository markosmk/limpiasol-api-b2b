# Dominio: Orders (B2B Flow)

Gestiona el ciclo de vida completo de un pedido B2B. A diferencia de un e-commerce tradicional (B2C), las órdenes aquí funcionan como presupuestos que requieren validación e interacción del administrador.

## Flujo de Estados B2B
1. **`pending`**: El cliente crea la orden. (Intención de compra).
2. **`adjusting`**: El admin revisa la orden. Puede agregar/quitar items, cambiar cantidades o aplicar recargos/descuentos manuales (Falta de stock, negociación).
3. **`pending_payment`**: La cotización final está cerrada. Se le notifica al cliente que ya puede transferir/pagar.
4. **`paid`**: El pago fue verificado por el admin.
5. **`shipped` / `ready_pickup`**: La mercadería fue enviada o está lista en sucursal.
6. **`cancelled`**: Cancelada por el cliente (solo si está `pending`) o por el admin.

## Arquitectura
- **Routes**: Solo orquestan y validan con Valibot.
- **Service**: Reglas de negocio, chequeo de stock, guardias de transición de estados y emisión de notificaciones.
- **Repository**: Manejo exclusivo de Drizzle ORM. Los recálculos complejos (`total`, `subtotal`) se hacen en transacciones ACID para evitar desincronizaciones.

