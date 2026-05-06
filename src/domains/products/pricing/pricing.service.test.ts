import { describe, expect, it, vi } from "vitest"
import { ProductsPricingService } from "./pricing.service"
import type { PriceTier } from "@/db/pg"
import type { ProductsRepository } from "../products.repository"
import type { ProductsPricingRepository } from "./pricing.repository"

const makeTier = (overrides: Partial<PriceTier> = {}): PriceTier => ({
  id: "price-1",
  productId: "prod-1",
  variantId: null,
  tierType: "retail",
  price: "100.00",
  compareAtPrice: null,
  minQuantity: 1,
  volumeDiscounts: null,
  createdAt: new Date(),
  updatedAt: null,
  ...overrides
})

describe("productsPricingService.calculatePrice", () => {
  it("deberia retornar precio con descuento por volumen aplicado", async () => {
    // 1. Arrange: mock manual del PricingRepo
    const mockPricingRepo = {
      findTiersForProductsBulk: vi.fn().mockResolvedValue([
        makeTier({
          id: "price-1",
          productId: "prod-1",
          variantId: null,
          tierType: "reseller",
          price: "100.00",
          compareAtPrice: "120.00",
          volumeDiscounts: [
            { quantity: 10, discountPercent: 10 },
            { quantity: 50, discountPercent: 20 }
          ]
        })
      ])
    } as unknown as ProductsPricingRepository

    // mock vacío para el ProductsRepo (no se usa en calculatePrice)
    const mockProductsRepo = {} as unknown as ProductsRepository

    // instanciamos el servicio inyectando los mocks
    const service = new ProductsPricingService(mockPricingRepo, mockProductsRepo)

    // 2. Act
    const result = await service.calculatePrice({
      productId: "prod-1",
      variantId: "default_variant",
      userTier: "reseller",
      quantity: 50
    })

    // 3. Assert
    expect(result.unitPrice).toBe(80) // 100 - 20%
    expect(result.volumeDiscount).toEqual({ quantity: 50, discountPercent: 20 })
    expect(mockPricingRepo.findTiersForProductsBulk).toHaveBeenCalledWith(["prod-1"], "reseller")
  })

  it("deberia lanzar error cuando no se encuentra el precio", async () => {
    // mocks para el escenario de error
    const mockPricingRepo = {
      findTiersForProductsBulk: vi.fn().mockResolvedValue([])
    } as unknown as ProductsPricingRepository

    const mockProductsRepo = {} as unknown as ProductsRepository

    const service = new ProductsPricingService(mockPricingRepo, mockProductsRepo)

    await expect(
      service.calculatePrice({
        productId: "prod-999",
        variantId: "default_variant",
        userTier: "retail",
        quantity: 1
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404
    })
  })

  it("deberia hacer fallback a retail cuando no se encuentra el tier del usuario", async () => {
    // Arrange: no hay precio para "reseller", pero sí para "retail"
    const mockPricingRepo = {
      findTiersForProductsBulk: vi.fn().mockResolvedValue([
        makeTier({
          id: "price-retail",
          tierType: "retail",
          price: "120.00"
        })
      ])
    } as unknown as ProductsPricingRepository

    const mockProductsRepo = {} as unknown as ProductsRepository
    const service = new ProductsPricingService(mockPricingRepo, mockProductsRepo)

    // Act
    const result = await service.calculatePrice({
      productId: "prod-1",
      variantId: "default_variant",
      userTier: "reseller", // Busca reseller, pero fallback a retail
      quantity: 1
    })

    // Assert
    expect(result.unitPrice).toBe(120)
    expect(result.appliedTier).toBe("retail") // Se aplicó retail como fallback
    expect(mockPricingRepo.findTiersForProductsBulk).toHaveBeenCalledWith(["prod-1"], "reseller")
  })

  it("deberia manejar precios específicos de variantes", async () => {
    const mockPricingRepo = {
      findTiersForProductsBulk: vi.fn().mockResolvedValue([
        makeTier({
          id: "price-var",
          variantId: "var-123",
          tierType: "reseller",
          price: "85.00",
          compareAtPrice: "100.00",
          minQuantity: 5
        })
      ])
    } as unknown as ProductsPricingRepository

    const mockProductsRepo = {} as unknown as ProductsRepository
    const service = new ProductsPricingService(mockPricingRepo, mockProductsRepo)

    // Act
    const result = await service.calculatePrice({
      productId: "prod-1",
      variantId: "var-123", // Variante específica
      userTier: "reseller",
      quantity: 10
    })

    // Assert
    expect(result.unitPrice).toBe(85)
    expect(result.originalPrice).toBe(100) // compareAtPrice
  })

  it("resuelve tier de variante específica para el tier del usuario", async () => {
    const mockPricingRepo = {
      findTiersForProductsBulk: vi
        .fn()
        .mockResolvedValue([
          makeTier({ variantId: "var-1", tierType: "reseller", price: "80.00" }),
          makeTier({ variantId: null, tierType: "reseller", price: "90.00" })
        ])
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockPricingRepo, {} as ProductsRepository)
    const result = await service.calculatePrice({
      productId: "prod-1",
      variantId: "var-1",
      userTier: "reseller",
      quantity: 1
    })

    expect(result.unitPrice).toBe(80)
    expect(result.appliedTier).toBe("reseller")
  })

  it("hace fallback a retail cuando no existe tier de usuario para la variante", async () => {
    const mockPricingRepo = {
      findTiersForProductsBulk: vi
        .fn()
        .mockResolvedValue([makeTier({ variantId: "var-1", tierType: "retail", price: "100.00" })])
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockPricingRepo, {} as ProductsRepository)
    const result = await service.calculatePrice({
      productId: "prod-1",
      variantId: "var-1",
      userTier: "reseller",
      quantity: 1
    })

    expect(result.unitPrice).toBe(100)
    expect(result.appliedTier).toBe("retail")
  })

  it("hace fallback al base del producto cuando no hay precio de variante", async () => {
    const mockPricingRepo = {
      findTiersForProductsBulk: vi
        .fn()
        .mockResolvedValue([makeTier({ variantId: null, tierType: "reseller", price: "90.00" })])
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockPricingRepo, {} as ProductsRepository)
    const result = await service.calculatePrice({
      productId: "prod-1",
      variantId: "var-inexistente",
      userTier: "reseller",
      quantity: 1
    })

    expect(result.unitPrice).toBe(90)
    expect(result.appliedTier).toBe("reseller")
  })

  it("hace fallback a retail base cuando no existe ningún otro tier", async () => {
    const mockPricingRepo = {
      findTiersForProductsBulk: vi
        .fn()
        .mockResolvedValue([makeTier({ variantId: null, tierType: "retail", price: "100.00" })])
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockPricingRepo, {} as ProductsRepository)
    const result = await service.calculatePrice({
      productId: "prod-1",
      variantId: "var-1",
      userTier: "reseller",
      quantity: 1
    })

    expect(result.unitPrice).toBe(100)
    expect(result.appliedTier).toBe("retail")
  })
})

// ─────────────────────────────────────────
// Tests para validateQuantity
// ─────────────────────────────────────────
describe("productsPricingService.validateQuantity", () => {
  it("validates quantity against product purchaseRules", async () => {
    const mockProductsRepo = {
      getResolvedPurchaseRules: vi.fn().mockResolvedValue({
        minQuantity: 5,
        stepQuantity: 5,
        allowBackorder: false
      })
    } as unknown as ProductsRepository

    const mockPricingRepo = {} as unknown as ProductsPricingRepository

    // const mockProductsRepo = {
    //   getResolvedPurchaseRules: vi.fn().mockResolvedValue({
    //     minQuantity: 5,
    //     stepQuantity: 5,
    //     allowBackorder: false
    //   })
    // } as unknown as ProductsRepository

    const service = new ProductsPricingService(mockPricingRepo, mockProductsRepo)

    // Act: cantidad inválida (menor al mínimo)
    const result = await service.validateQuantity(3, "product-123", "variantId-123")

    // Assert
    expect(result.valid).toBe(false)
    expect(result.error).toContain("Mínimo")
  })

  it("returns valid when quantity meets rules", async () => {
    const mockProductsRepo = {
      getResolvedPurchaseRules: vi.fn().mockResolvedValue({
        minQuantity: 5,
        stepQuantity: 5,
        allowBackorder: false
      })
    } as unknown as ProductsRepository

    const service = new ProductsPricingService({} as ProductsPricingRepository, mockProductsRepo)

    const result = await service.validateQuantity(10, "product-123", "variantId-123")

    expect(result.valid).toBe(true)
  })
})

// ─────────────────────────────────────────
// Tests para getPriceOptions
// ─────────────────────────────────────────
describe("productsPricingService.getPriceOptions", () => {
  it("maps price tiers to frontend-friendly format", async () => {
    const mockTiers: PriceTier[] = [
      makeTier({
        id: "p1",
        tierType: "retail",
        price: "100.00",
        compareAtPrice: "120.00"
      }),
      makeTier({
        id: "p2",
        tierType: "reseller",
        price: "75.00",
        volumeDiscounts: [{ quantity: 50, discountPercent: 15 }]
      })
    ]

    const mockPricingRepo = {
      getAllPriceOptions: vi.fn().mockResolvedValue(mockTiers)
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockPricingRepo, {} as unknown as ProductsRepository)
    const result = await service.getPriceOptions("prod-1", null)

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      tierType: "retail",
      basePrice: 100,
      compareAtPrice: 120
    })
    expect(result[1]).toMatchObject({
      tierType: "reseller",
      basePrice: 75,
      volumeDiscounts: [{ quantity: 50, discountPercent: 15 }]
    })
  })
})

// ─────────────────────────────────────────
// Tests para _resolveTier
// ─────────────────────────────────────────
describe("productsPricingService._resolveTier (vía calculatePrice)", () => {
  it("resuelve tier de variante específica para el tier del usuario", async () => {
    const tiers = [
      makeTier({ variantId: "var-1", tierType: "reseller", price: "80.00" }),
      makeTier({ variantId: null, tierType: "reseller", price: "90.00" })
    ]

    const mockRepo = {
      findTiersForProductsBulk: vi.fn().mockResolvedValue(tiers)
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockRepo, {} as ProductsRepository)
    const result = await service.calculatePrice({
      productId: "prod-1",
      variantId: "var-1",
      userTier: "reseller",
      quantity: 1
    })

    expect(result.unitPrice).toBe(80)
    expect(result.appliedTier).toBe("reseller")
  })

  it("hace fallback a retail cuando no existe tier de usuario para la variante", async () => {
    const tiers = [makeTier({ variantId: "var-1", tierType: "retail", price: "100.00" })]

    const mockRepo = {
      findTiersForProductsBulk: vi.fn().mockResolvedValue(tiers)
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockRepo, {} as ProductsRepository)
    const result = await service.calculatePrice({
      productId: "prod-1",
      variantId: "var-1",
      userTier: "reseller", // No existe reseller para var-1
      quantity: 1
    })

    expect(result.unitPrice).toBe(100)
    expect(result.appliedTier).toBe("retail")
  })

  it("hace fallback al base del producto cuando no hay precio de variante", async () => {
    const tiers = [makeTier({ variantId: null, tierType: "reseller", price: "90.00" })]

    const mockRepo = {
      findTiersForProductsBulk: vi.fn().mockResolvedValue(tiers)
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockRepo, {} as ProductsRepository)
    const result = await service.calculatePrice({
      productId: "prod-1",
      variantId: "var-inexistente",
      userTier: "reseller",
      quantity: 1
    })

    expect(result.unitPrice).toBe(90)
    expect(result.appliedTier).toBe("reseller")
  })

  it("hace fallback a retail base cuando no existe ningún otro tier", async () => {
    const tiers = [makeTier({ variantId: null, tierType: "retail", price: "100.00" })]

    const mockRepo = {
      findTiersForProductsBulk: vi.fn().mockResolvedValue(tiers)
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockRepo, {} as ProductsRepository)
    const result = await service.calculatePrice({
      productId: "prod-1",
      variantId: "var-1",
      userTier: "reseller",
      quantity: 1
    })

    expect(result.unitPrice).toBe(100)
    expect(result.appliedTier).toBe("retail")
  })
})

// ─────────────────────────────────────────
// Tests para calculatePricesBulk
// ─────────────────────────────────────────
describe("productsPricingService.calculatePricesBulk", () => {
  it("calcula precios para múltiples items en una sola query", async () => {
    const tiers = [
      makeTier({ variantId: "var-1", tierType: "retail", price: "100.00" }),
      makeTier({ variantId: "var-2", tierType: "retail", price: "150.00" })
    ]

    const mockRepo = {
      findTiersForProductsBulk: vi.fn().mockResolvedValue(tiers)
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockRepo, {} as ProductsRepository)
    const results = await service.calculatePricesBulk(
      [
        { productId: "prod-1", variantId: "var-1", quantity: 1 },
        { productId: "prod-1", variantId: "var-2", quantity: 1 }
      ],
      "retail"
    )

    expect(mockRepo.findTiersForProductsBulk).toHaveBeenCalledTimes(1)
    expect(mockRepo.findTiersForProductsBulk).toHaveBeenCalledWith(["prod-1"], "retail")
    expect(results["var-1"].unitPrice).toBe(100)
    expect(results["var-2"].unitPrice).toBe(150)
  })

  it("agrupa productIds únicos para evitar queries duplicadas", async () => {
    const mockPricingRepo = {
      findTiersForProductsBulk: vi.fn().mockResolvedValue([
        makeTier({
          productId: "prod-1",
          variantId: "var-1",
          tierType: "retail",
          price: "100.00"
        }),
        makeTier({
          productId: "prod-1",
          variantId: "var-2",
          tierType: "retail",
          price: "110.00"
        }),
        makeTier({ productId: "prod-2", variantId: null, tierType: "retail", price: "200.00" })
      ])
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockPricingRepo, {} as ProductsRepository)
    const results = await service.calculatePricesBulk(
      [
        { productId: "prod-1", variantId: "var-1", quantity: 1 },
        { productId: "prod-1", variantId: "var-2", quantity: 1 },
        { productId: "prod-2", variantId: null, quantity: 1 }
      ],
      "retail"
    )

    expect(mockPricingRepo.findTiersForProductsBulk).toHaveBeenCalledWith(
      ["prod-1", "prod-2"],
      "retail"
    )
    expect(results["var-1"].unitPrice).toBe(100)
    expect(results["var-2"].unitPrice).toBe(110)
    expect(results["prod-2"].unitPrice).toBe(200)
  })

  it("retorna objeto vacío cuando no hay items", async () => {
    const mockPricingRepo = {
      findTiersForProductsBulk: vi.fn()
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockPricingRepo, {} as ProductsRepository)
    const results = await service.calculatePricesBulk([], "retail")

    expect(results).toEqual({})
    expect(mockPricingRepo.findTiersForProductsBulk).not.toHaveBeenCalled()
  })

  it("lanza error cuando un item no tiene precio disponible", async () => {
    const mockPricingRepo = {
      findTiersForProductsBulk: vi.fn().mockResolvedValue([])
    } as unknown as ProductsPricingRepository

    const service = new ProductsPricingService(mockPricingRepo, {} as ProductsRepository)

    await expect(
      service.calculatePricesBulk(
        [{ productId: "prod-1", variantId: "var-1", quantity: 1 }],
        "retail"
      )
    ).rejects.toMatchObject({
      code: "price_not_found",
      statusCode: 404
    })
  })
})
