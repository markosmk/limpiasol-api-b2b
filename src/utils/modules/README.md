# Module System - Arquitectura de Módulos

Sistema de módulos configurables con **lazy loading**, **cache en memoria** y **arquitectura basada en clases**.

---

## Estructura de Carpetas

```
src/lib/modules/
├── base.module.ts              # Clase base abstracta (BaseModule<T>)
├── module-manager.ts           # Helper genérico para acceso a DB
├── index.ts                    # Barrel export
├── README.md                   # Este archivo
│
├── taxes/                      # Módulo de Impuestos
│   ├── taxes.module.ts         # Lógica de negocio
│   ├── taxes.module.types.ts   # Tipos TypeScript
│   └── taxes.module.test.ts    # Tests unitarios
│
├── shipping/                   # Módulo de Envíos
│   ├── shipping.module.ts
│   ├── shipping.module.types.ts
│   └── shipping.module.test.ts
│
├── discounts/                  # Módulo de Descuentos
│   ├── discounts.module.ts
│   ├── discounts.module.types.ts
│   └── discounts.module.test.ts
│
└── email/                      # Módulo de Email
    ├── email.module.ts
    ├── email.module.types.ts
    └── email.module.test.ts
```

---

## Características Principales

### Lazy Loading
- La configuración se carga **solo la primera vez** que se usa el módulo
- Cero overhead si el módulo no se utiliza en una request

### Cache en Memoria
- Una sola query a DB por módulo por proceso
- Propiedad `this.config` accesible en toda la clase

### Singleton Pattern
- Una instancia por módulo en toda la aplicación
- Exportada como constante: `export const taxesModule = new TaxesModule()`

### Type-Safe
- Genéricos de TypeScript para tipado automático
- Sin `any`, sin casts manuales

### DRY (Don't Repeat Yourself)
- Clase base `BaseModule<T>` elimina boilerplate repetitivo
- Cada módulo solo escribe su lógica de negocio

---

## Arquitectura

### 1. Clase Base: `BaseModule<TConfig>`

```typescript
// src/lib/modules/base.module.ts

export abstract class BaseModule<TConfig> {
  protected config: TConfig | null = null
  protected enabled: boolean = false
  protected initialized: boolean = false

  constructor(protected moduleName: string) {}

  protected async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    
    const moduleConfig = await moduleManager.getConfig<TConfig>(this.moduleName)
    this.enabled = moduleConfig?.enabled ?? false
    this.config = moduleConfig?.config ?? null
    this.initialized = true
  }

  async refreshConfig(): Promise<void> {
    this.initialized = false
    await this.ensureInitialized()
  }

  public isEnabled(): boolean {
    return this.enabled
  }
}
```

**Responsabilidades:**
- Lazy loading de configuración
- Cache en memoria
- Refresh manual si es necesario

---

### 2. Module Manager

```typescript
// src/lib/modules/module-manager.ts

export const moduleManager = {
  async getConfig<T>(moduleName: string): Promise<ModuleConfig<T> | null> {
    const key = `modules:${moduleName}`
    const [setting] = await db
      .select()
      .from(settings)
      .where(and(eq(settings.key, key), eq(settings.category, "modules")))
    
    if (!setting) return null
    return setting.value as ModuleConfig<T>
  },
}
```

**Responsabilidades:**
- Única fuente de verdad para acceso a DB
- Sin lógica de negocio específica

---

### 3. Estructura de Configuración en DB

```typescript
// Tabla: settings
{
  key: "modules:taxes",              // Convención: modules:{nombre}
  category: "modules",               // Siempre "modules"
  value: {
    enabled: true,                   // Feature flag
    config: {                        // Configuración específica del módulo
      defaultRate: 0.21,
      provincialRates: [...],
      // ... más campos según el tipo
    },
    updatedAt: "2024-02-20T15:30:00Z"
  }
}
```

---

## Cómo Crear un Nuevo Módulo (Paso a Paso)

### Paso 1: Crear carpeta del módulo

```bash
mkdir src/lib/modules/nombredelmodulo
```

### Paso 2: Definir tipos (`nombredelmodulo.types.ts`)

```typescript
// src/lib/modules/nombredelmodulo/nombredelmodulo.types.ts

/**
 * Configuración del módulo [Nombre]
 */
export type NombreModuleConfig = {
  /**
   * Campo requerido de ejemplo
   */
  someSetting: string
  
  /**
   * Campo opcional
   */
  anotherSetting?: number
  
  /**
   * Lista de algo
   */
  itemsList?: Array<{
    id: string
    value: number
  }>
}

/**
 * Resultado de alguna operación del módulo
 */
export type NombreResult = {
  success: boolean
  data?: any
  error?: string
}

/**
 * Parámetros para alguna función
 */
export type NombreParams = {
  param1: string
  param2?: number
}
```

### Paso 3: Implementar módulo (`nombredelmodulo.module.ts`)

```typescript
// src/lib/modules/nombredelmodulo/nombredelmodulo.module.ts
import { BaseModule } from "../base.module"
import type { 
  NombreModuleConfig, 
  NombreResult, 
  NombreParams 
} from "./nombredelmodulo.types"

/**
 * Módulo de [Nombre]
 * 
 * Descripción de qué hace el módulo.
 * 
 * @example
 * const module = new NombreModule()
 * await module.doSomething({ param1: "value" })
 */
export class NombreModule extends BaseModule<NombreModuleConfig> {
  constructor() {
    super("nombredelmodulo") // ← Nombre para lookup en DB
  }

  /**
   * Método principal del módulo
   */
  async doSomething(params: NombreParams): Promise<NombreResult> {
    // 1. Asegurar que la config está cargada (lazy loading)
    await this.ensureInitialized()

    // 2. Verificar si está habilitado
    if (!this.enabled || !this.config) {
      return { success: false, error: "Module not enabled" }
    }

    // 3. Usar this.config (tipado automáticamente como NombreModuleConfig)
    const { someSetting, anotherSetting } = this.config

    // 4. Tu lógica de negocio aquí
    // ...

    return { success: true, data: { /* resultado */ } }
  }

  /**
   * Otro método del módulo
   */
  async doAnotherThing(param: string): Promise<string> {
    await this.ensureInitialized()
    
    if (!this.enabled) {
      throw new Error("Module not enabled")
    }

    // Lógica...
    return "result"
  }

  /**
   * Método helper privado
   */
  private _helperMethod(value: number): number {
    return value * 2
  }
}

/**
 * Singleton: Una instancia para toda la app
 */
export const nombreModule = new NombreModule()
```

### Paso 4: Agregar tests (`nombredelmodulo.module.test.ts`)

```typescript
// src/lib/modules/nombredelmodulo/nombredelmodulo.module.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import { moduleManager } from "../module-manager"
import { NombreModule } from "./nombredelmodulo.module"
import type { ModuleConfig, NombreModuleConfig } from "./nombredelmodulo.types"

// Mockear moduleManager
vi.mock("../module-manager", () => ({
  moduleManager: { getConfig: vi.fn() },
}))

describe("NombreModule", () => {
  let module: NombreModule

  beforeEach(() => {
    vi.clearAllMocks()
    module = new NombreModule()
  })

  describe("doSomething", () => {
    it("returns error when module is disabled", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: false,
        config: { someSetting: "value" },
      })

      const result = await module.doSomething({ param1: "test" })

      expect(result.success).toBe(false)
      expect(result.error).toContain("not enabled")
    })

    it("executes successfully when enabled", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: { someSetting: "value", anotherSetting: 100 },
      })

      const result = await module.doSomething({ param1: "test" })

      expect(result.success).toBe(true)
      expect(moduleManager.getConfig).toHaveBeenCalledTimes(1) // Lazy loading
    })

    it("caches config after first call", async () => {
      vi.mocked(moduleManager.getConfig).mockResolvedValue({
        enabled: true,
        config: { someSetting: "value" },
      })

      await module.doSomething({ param1: "test" })
      await module.doSomething({ param1: "test2" })

      expect(moduleManager.getConfig).toHaveBeenCalledTimes(1) // ¡Sin query extra!
    })
  })
})
```

### Paso 5: Exportar en barrel file

```typescript
// src/lib/modules/index.ts

// Base
export { BaseModule } from "./base.module"
export { moduleManager } from "./module-manager"

// Modules (existing)
export { taxesModule } from "./taxes/taxes.module"
export { shippingModule } from "./shipping/shipping.module"
export { discountsModule } from "./discounts/discounts.module"
export { emailModule } from "./email/email.module"

// Module (new)
export { nombreModule } from "./nombredelmodulo/nombredelmodulo.module"

// Types
export type { ModuleConfig } from "@/db/schema/settings"
export type { NombreModuleConfig, NombreResult } from "./nombredelmodulo/nombredelmodulo.types"
```

### Paso 6: Configurar en Admin Panel

```bash
# PATCH /admin/modules/nombredelmodulo
{
  "enabled": true,
  "config": {
    "someSetting": "value",
    "anotherSetting": 100
  }
}
```

---

## Ejemplos de Uso

### Ejemplo 1: Calcular Impuestos en un Pedido

```typescript
// domains/orders/orders.service.ts
import { taxesModule } from "@/lib/modules"

export const ordersService = {
  async createOrder(input: CreateOrderInput) {
    const subtotal = 10000
    
    // Calcular impuestos (lazy loading automático)
    const taxesResult = await taxesModule.calculateTaxes({
      province: "CABA",
      subtotal,
      discounts: 0,
      categoryIds: ["cat_electronics"],
    })
    
    const total = subtotal + taxesResult.amount
    
    // taxesResult.amount → 2100 (21% IVA)
    // taxesResult.breakdown → [{ concept: "IVA", rate: 0.21, amount: 2100 }]
    
    return { total, taxes: taxesResult }
  },
}
```

### Ejemplo 2: Aplicar Cupón de Descuento

```typescript
import { discountsModule } from "@/lib/modules"

// Validar cupón antes de aplicar
const validation = await discountsModule.validateCouponCode("HOLAMUNDO")
if (!validation.valid) {
  throw new Error(validation.message) // "Cupón expirado"
}

// Calcular descuento
const discount = await discountsModule.calculateDiscount({
  subtotal: 10000,
  couponCode: "HOLAMUNDO",
  categoryIds: ["cat_electronics"],
})

// discount.amount → 2000 (20% OFF)
// discount.couponCode → "HOLAMUNDO"
// discount.breakdown → [{ type: "percentage", value: 0.2, amount: 2000 }]
```

### Ejemplo 3: Calcular Costo de Envío

```typescript
import { shippingModule } from "@/lib/modules"

const shipping = await shippingModule.calculateShippingCost({
  postalCode: "1425",
  province: "CABA",
  orderTotal: 10000,
})

if (!shipping.available) {
  throw new Error(shipping.message) // "No enviamos a CABA"
}

// shipping.cost → 1500
// shipping.message → "¡Envío gratis!" (si supera threshold)
```

### Ejemplo 4: Trackear Evento de Analytics

```typescript
import { analyticsModule } from "@/lib/modules"

// Después de crear un pedido exitoso
await analyticsModule.trackEvent({
  eventName: "purchase",
  category: "ecommerce",
  label: "order_completed",
  value: 15000,
  properties: {
    orderId: "ord_123",
    items: 3,
    couponUsed: "HOLAMUNDO",
  },
})

// Trackear page view
await analyticsModule.trackPageView("/checkout/success", {
  title: "Pedido Confirmado",
  userId: "user_456",
})
```

### Ejemplo 5: Enviar Email Transaccional

```typescript
import { emailModule } from "@/lib/modules"

await emailModule.sendTransactionalEmail({
  to: "cliente@email.com",
  templateKey: "order_created",
  templateParams: {
    orderCode: "A7K9M2X1",
    total: "15000.00",
    deliveryType: "shipping",
  },
})
```

---

## 🔧 Configuración de Módulos

### Estructura de Configuración por Módulo

#### Taxes Module
```json
{
  "enabled": true,
  "config": {
    "defaultRate": 0.21,
    "provincialRates": [
      {
        "province": "CABA",
        "rate": 0.03,
        "concept": "Ingresos Brutos",
        "description": "Según convenio multilateral"
      }
    ],
    "exemptCategories": ["cat_libros", "cat_alimentos"],
    "minTaxableAmount": 1000,
    "taxesIncludedInPrice": false
  }
}
```

#### Shipping Module
```json
{
  "enabled": true,
  "config": {
    "defaultCost": 1500,
    "freeShippingThreshold": 50000,
    "postalCodeRules": [
      {
        "pattern": "1425",
        "cost": 800,
        "label": "CABA Centro"
      }
    ],
    "disabledProvinces": ["Tierra del Fuego"]
  }
}
```

#### Discounts Module
```json
{
  "enabled": true,
  "config": {
    "defaultDiscount": 0.05,
    "defaultType": "percentage",
    "minPurchaseAmount": 5000,
    "maxDiscountAmount": 0.30,
    "absoluteMaxDiscount": 10000,
    "allowStacking": false,
    "validCouponCodes": [
      {
        "code": "HOLAMUNDO",
        "type": "percentage",
        "value": 0.20,
        "validFrom": "2024-01-01",
        "validUntil": "2024-12-31",
        "minPurchase": 10000,
        "maxUses": 100,
        "currentUses": 42,
        "description": "20% OFF en toda la tienda"
      }
    ]
  }
}
```

#### Email Module
```json
{
  "enabled": true,
  "config": {
    "provider": "brevo",
    "credentials": {
      "fromName": "Mi Tienda",
      "fromEmail": "noreply@mitienda.com"
    },
    "templates": {
      "orderCreated": "template_123",
      "orderPaid": "template_456"
    }
  }
}
```

---

## Testing

### Ejecutar Tests

```bash
# Todos los tests de módulos
npx vitest modules

# Módulo específico
npx vitest taxes.module
npx vitest shipping.module

# Modo watch (desarrollo)
npx vitest modules --watch

# Con cobertura
npx vitest modules --coverage
```

### Mockear Módulos en Tests

```typescript
// domains/orders/orders.service.test.ts
import { taxesModule } from "@/lib/modules"

vi.mock("@/lib/modules/taxes.module", () => ({
  taxesModule: {
    calculateTaxes: vi.fn().mockResolvedValue({
      amount: 2100,
      breakdown: [],
      taxesIncluded: false,
    }),
  },
}))

describe("ordersService.createOrder", () => {
  it("calculates taxes correctly", async () => {
    const result = await ordersService.createOrder({...})
    
    expect(taxesModule.calculateTaxes).toHaveBeenCalledWith(
      expect.objectContaining({
        province: "CABA",
        subtotal: 10000,
      })
    )
  })
})
```

---

## Mejores Prácticas

### DO

1. **Usar `ensureInitialized()` al inicio de cada método público**
   ```typescript
   async doSomething() {
     await this.ensureInitialized() // ← Siempre primero
     // ... lógica
   }
   ```

2. **Acceder a `this.config` directamente (no repetir queries)**
   ```typescript
   // ✅ BIEN
   const { someSetting } = this.config!
   
   // ❌ MAL
   const config = await moduleManager.getConfig(...) // Query innecesaria
   ```

3. **Usar `refreshConfig()` cuando el admin actualice la config**
   ```typescript
   // domains/admin/admin.service.ts
   async updateModuleConfig(moduleName: string, config: any) {
     await moduleManager.updateConfig(moduleName, config)
     
     // Recargar cache en el módulo
     if (moduleName === "taxes") {
       await taxesModule.refreshConfig()
     }
   }
   ```

4. **Tipar correctamente los parámetros y retornos**
   ```typescript
   // ✅ BIEN
   async calculate(params: CalculateParams): Promise<CalculateResult>
   
   // ❌ MAL
   async calculate(params: any): Promise<any>
   ```

5. **Manejar gracefulmente cuando el módulo está deshabilitado**
   ```typescript
   if (!this.enabled) {
     return { amount: 0, hasDiscount: false } // Fallback seguro
   }
   ```

### ❌ DON'T

1. **No llamar a `moduleManager.getConfig()` directamente en business logic**
   ```typescript
   // ❌ MAL
   const config = await moduleManager.getConfig("taxes")
   
   // ✅ BIEN
   await this.ensureInitialized()
   const config = this.config
   ```

2. **No exponer `config` como público**
   ```typescript
   // ❌ MAL
   public config: TaxesModuleConfig
   
   // ✅ BIEN
   protected config: TaxesModuleConfig | null
   ```

3. **No inicializar en `index.ts` o al arrancar la app**
   ```typescript
   // ❌ MAL (en index.ts)
   await taxesModule.ensureInitialized() // Carga anticipada innecesaria
   
   // ✅ BIEN
   // Lazy loading automático en primera llamada
   ```

---

## Flujo de Ejecución

```
1. orders.service.createOrder()
   ↓
2. await taxesModule.calculateTaxes({...})
   ↓
3. TaxesModule.calculateTaxes()
   ↓
4. this.ensureInitialized()
   ↓
5. [PRIMERA VEZ] moduleManager.getConfig("taxes")
   ├─ Query: SELECT * FROM settings WHERE key='modules:taxes'
   ├─ Cache: this.config = { defaultRate: 0.21, ... }
   └─ Flag: this.initialized = true
   ↓
6. Calcular impuestos con this.config
   ↓
7. Retornar resultado
   ↓
8. [SEGUNDA LLAMADA] taxesModule.getTaxRateForProvince()
   ↓
9. this.ensureInitialized()
   ├─ this.initialized === true → SKIP query ✅
   └─ Usar this.config cacheada
   ↓
10. Retornar tasa sin query a DB
```

**Performance:**
- **1 query DB** por módulo por proceso (no por request)
- **0 queries** en llamadas subsiguientes (cache en memoria)

---

## Módulos Disponibles

| Módulo | Descripción | Métodos Principales |
|--------|-------------|-------------------|
| **Taxes** | Cálculo de impuestos por provincia | `calculateTaxes()`, `getTaxRateForProvince()` |
| **Shipping** | Cálculo de costos de envío | `calculateShippingCost()`, `isAvailableForProvince()` |
| **Discounts** | Descuentos y cupones promocionales | `calculateDiscount()`, `validateCouponCode()`, `getActiveCoupons()` |
| **Email** | Envío de emails transaccionales | `sendEmail()`, `sendTransactionalEmail()` |
| **Analytics** | Tracking de eventos y page views | `trackEvent()`, `trackPageView()`, `getTrackingScript()` |

---

## Roadmap (Módulos Futuros)

- [ ] **Notifications**: Push notifications, WhatsApp, SMS
- [ ] **Payments**: Integración con MercadoPago, Stripe, etc.
- [ ] **Inventory**: Gestión de stock, alertas de reposición
- [ ] **Reports**: Generación de reportes PDF/Excel
- [ ] **Integrations**: Webhooks, APIs externas (AFIP, etc.)

---

## Contribuciones

Para agregar un nuevo módulo:

1. Crear carpeta en `src/lib/modules/nombrmodulo/`
2. Seguir estructura: `.module.ts`, `.types.ts`, `.test.ts`
3. Extender `BaseModule<TConfig>`
4. Agregar tests con cobertura mínima del 80%
5. Actualizar `index.ts` con exports
6. Documentar en este README

---

## Licencia

MIT License - ver archivo LICENSE

---

**Última actualización:** Marzo 2026  
**Mantenido por:** Equipo de Desarrollo