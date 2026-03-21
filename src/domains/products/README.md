### Logica de Precios
1. ¿El usuario está autenticado?
   ├─ Sí → Obtener tier desde su rol (user→retail, reseller→reseller, admin→retail)
   └─ No → Usar tier "retail"

2. Buscar precio en price_tiers:
   ├─ ¿Existe tier específico para variantId + userTier? → Usarlo
   ├─ ¿Existe tier para producto base (variantId=NULL) + userTier? → Usarlo
   ├─ ¿Existe tier "retail" como fallback? → Usarlo
   └─ No hay precio → Error 404

3. Aplicar descuentos por volumen (si quantity >= threshold)

4. Retornar precio formateado

### Flow de Precios (flow técnico)
POST /products/:id/price
│
├─► [Middleware: optionalAuth]
│   └─► Si hay sesión → adjunta user.role al request
│
├─► [Handler]
│   │
│   ├─► 1. Validar input básico (quantity > 0)
│   │
│   ├─► 2. Determinar userTier:
│   │   ├─► Si hay usuario → getTierFromRole(user.role)
│   │   └─► Si es anónimo → "retail"
│   │
│   ├─► 3. validateQuantity(productId, quantity)
│   │   ├─► Busca product.purchaseRules desde DB
│   │   ├─► Aplica validatePurchaseRules() (función pura)
│   │   └─► Retorna { valid: true/false, error?, suggestion? }
│   │
│   ├─► 4. Si no es válido → 400 con mensaje amigable
│   │
│   ├─► 5. calculatePrice({ productId, variantId, userTier, quantity })
│   │   ├─► Busca priceTier específico (userTier + variantId)
│   │   ├─► Si no encuentra → fallback a "retail"
│   │   ├─► Si no hay retail → 404 error
│   │   └─► Aplica applyVolumeDiscount() (función pura)
│   │
│   └─► 6. Retorna { success: true, data: { pricing: {...} } }
│
└─► Frontend recibe precio calculado y lo muestra


### Ejemplo de Precios en el Frontend
```ts
// 🛍️ Detalle de producto: mostrar precio base
const { data } = await api.get(`/products/${productId}`)
const price = data.pricing.base
// Mostrar: `${price.currency} ${price.unitPrice} c/u`

// 🛒 Carrito: calcular precio con cantidad real
const { data } = await api.post(`/products/${productId}/price`, {
  variantId: selectedVariant?.id,
  quantity: cartQuantity
})
// Mostrar subtotal: `${price.currency} ${data.pricing.finalSubtotal}`
// Mostrar ahorro si hay descuento: `¡Ahorraste ${data.pricing.volumeDiscount?.percent}%!`

// ⚠️ Validar antes de agregar al carrito
if (!response.success) {
  showToast(response.error, { suggestion: response.suggestion })
  // No agregar al carrito
}
```

### Estados del Producto
status | Visible en catálogo | Visible en admin | Notas
active | ✅ Sí | ✅ Sí | Estado normal
draft | ❌ No | ✅ Sí | En edición
archived | ❌ No | ✅ Sí | Descatalogado (histórico)

### Soporte / Errores comunes
Error | Causa probable | Solución
price_not_found | Producto sin precio configurado | Contactar admin para configurar price_tiers
quantity_validation_failed | Cantidad no cumple reglas B2B | Ajustar cantidad según suggestion
Producto no disponible | Producto no existe o no está activo | Verificar ID o estado del producto
 
 ### Temas resueltos

 #### role vs tier: ¿Son lo mismo?

 No, no son lo mismo:

 - **role (Authorization)**: Es el rol del usuario en el sistema (user, reseller, admin), es lo que puede hacer el usuario en la plataforma, valores: user, reseller, admin
 - **tier (Pricing Strategy)**: Es el nivel de precios que se le aplica al usuario (retail, wholesale, reseller, vip), es el precio que ve el usuario, valores: "retail", "wholesale", "reseller", "vip"

De momento se mapean, pero luego se puede separar si crece.
```ts
// domains/products/lib/pricing.utils.ts

// 👈 Tipo del DOMINIO de pricing (no depende de auth)
export type PricingTier = "retail" | "wholesale" | "reseller" | "vip"

// 👈 Mapeo simple: role → pricing tier (se configura acá, fácil de cambiar después)
export const ROLE_TO_PRICING_TIER: Record<string, PricingTier> = {
  user: "retail",
  reseller: "reseller",
  admin: "reseller" // o "vip" si querés que admin vea todos los precios
}

// 👈 Helper para convertir (usa el service, no la UI)
export function getTierFromRole(role: string): PricingTier {
  return ROLE_TO_PRICING_TIER[role] || "retail"
}
```

#### Porque separar los conceptos es mejor?

Escenario | si role === tier | Si estan separados
----------|-----------------|------------------
Darle precio mayorista a un "user" temporalmente | ❌ (tenes que cambiar su role, peligroso) | ✅ (le asignas `pricingTier: "wholesale"`)
Un "reseller" que aun no aprobaste, que vea precios retail | ❌ (dificil, tenes que cambiar su role, peligroso) | ✅ (le asignas `pricingTier: "retail"`, `role: "reseller"`)
Crear un nuevo tier de precios sin tocar roles | ❌ (tendrias que crear un nuevo role, modificar enum de auth, etc) | ✅ (solo agregas al enum de pricing y le asignas `pricingTier: "new_tier"`)

Es decir, el `role` es para la autorización y el `tier` es para la estrategia de precios, el modo es simple, la logica de `pricing` solo debe conocer `PricingTier`, no `UserRole`. Asi, si despues agregas un campo `pricingTier` en `users`, solo cambias el mapeo y listo.