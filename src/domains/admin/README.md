
###  Flujo completo de ejemplo: Admin configura shipping

```bash
1. Admin va a /admin/modules/shipping en el panel
2. Activa el módulo y configura:
   {
     "enabled": true,
     "config": {
       "defaultCost": 1500,
       "freeShippingThreshold": 50000,
       "postalCodeRules": [
         { "pattern": "1425", "cost": 800, "label": "Zona CABA Centro" },
         { "pattern": "^14.*", "cost": 1200, "label": "CABA" }
       ],
       "disabledProvinces": ["Tierra del Fuego"]
     }
   }
3. Backend guarda en settings: key="modules:shipping", category="modules"
4. Cuando un cliente crea un pedido con deliveryType="shipping":
   - orders.service llama a moduleManager.calculateShippingCost()
   - Se evalúan reglas: CP 1425 → $800, total >= $50.000 → $0
   - El costo se incluye en el total del pedido
5. Si el admin luego desactiva el módulo:
   - calculateShippingCost() retorna available: false
   - El frontend muestra "Envío no disponible" y fuerza pickup
```

### Ventajas de este enfoque:

| Ventaja | Descripción |
| --- | --- |
| 🟢 Simple | Sin tablas extra, usa tu settings existente |
| 🟢 Flexible | JSON permite cualquier estructura de config por módulo |
| 🟢 Seguro | Credenciales sensibles van a ENV, no a DB en claro |
| 🟢 Testeable | moduleManager es un objeto con funciones puras/async fáciles de mockear |
| 🟢 Escalable |
Agregar un nuevo módulo es: 1) definir su tipo, 2) agregar lógica en moduleManager, 3) crear ruta de admin


###  Ejemplo de uso: Configurar shipping desde frontend

```bash
# 1. Listar módulos
GET /admin/modules
Response:
{
  "success": true,
  "data": [
    {
      "name": "shipping",
      "label": "Cálculo de envíos",
      "enabled": false,
      "config": {}
    },
    {
      "name": "email",
      "label": "Notificaciones por email", 
      "enabled": true,
      "config": {
        "provider": "brevo",
        "credentials": { "fromEmail": "noreply@miempresa.com", "fromName": "Mi Empresa" }
      }
    }
  ]
}

# 2. Activar y configurar shipping
PATCH /admin/modules/shipping
{
  "enabled": true,
  "config": {
    "defaultCost": 1500,
    "freeShippingThreshold": 50000,
    "postalCodeRules": [
      { "pattern": "1425", "cost": 800, "label": "CABA Centro" }
    ],
    "disabledProvinces": ["Tierra del Fuego"]
  }
}

# 3. Verificar configuración
GET /admin/modules/shipping
Response:
{
  "success": true,
  "data": {
    "name": "shipping",
    "enabled": true,
    "config": { ... },
    "updatedAt": "2024-02-20T15:30:00Z"
  }
}
```