import { describe, expect, it, vi } from "vitest"
import { type ProductsRepository, productsRepository } from "../products.repository"
import { type ProductsPricingRepository, productsPricingRepository } from "./pricing.repository"
import { ProductsPricingService, productsPricingService } from "./pricing.service"
import type { PriceTier } from "@/db/pg"

describe("productsPricingService.calculatePrice", () => {
  it("returns price with volume discount applied", async () => {
    // 1. Arrange: mock manual del PricingRepo
    const mockPricingRepo = {
      findPriceTier: vi.fn().mockResolvedValue({
        id: "price-1",
        productId: "prod-1",
        variantId: null,
        tierType: "reseller",
        price: "100.00",
        compareAtPrice: "120.00",
        minQuantity: 1,
        volumeDiscounts: [
          { quantity: 10, discountPercent: 10 },
          { quantity: 50, discountPercent: 20 }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      })
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
    expect(mockPricingRepo.findPriceTier).toHaveBeenCalledWith(
      "prod-1",
      "default_variant",
      "reseller"
    )
  })

  it("throws error when no price found", async () => {
    // mocks para el escenario de error
    const mockPricingRepo = {
      findPriceTier: vi.fn().mockResolvedValue(null),
      findFallbackRetailPrice: vi.fn().mockResolvedValue(null)
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

  it("fallback to retail when user tier not found", async () => {
    // Arrange: no hay precio para "reseller", pero sí para "retail"
    const mockPricingRepo = {
      findPriceTier: vi.fn().mockResolvedValue(null),
      findFallbackRetailPrice: vi.fn().mockResolvedValue({
        id: "price-retail",
        productId: "prod-1",
        variantId: null,
        tierType: "retail",
        price: "120.00",
        compareAtPrice: null,
        minQuantity: 1,
        volumeDiscounts: null,
        createdAt: new Date(),
        updatedAt: null
      })
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
    expect(mockPricingRepo.findFallbackRetailPrice).toHaveBeenCalledWith("prod-1", "default_variant")
  })

  it("handles variant-specific pricing", async () => {
    // Arrange: precio específico para variante
    const variantTier: PriceTier = {
      id: "price-var",
      productId: "prod-1",
      variantId: "var-123",
      tierType: "reseller",
      price: "85.00",
      compareAtPrice: "100.00",
      minQuantity: 5,
      volumeDiscounts: null,
      createdAt: new Date(),
      updatedAt: null
    }

    const mockPricingRepo = {
      findPriceTier: vi.fn().mockResolvedValue(variantTier)
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
})

// ─────────────────────────────────────────
// Tests para validateQuantity
// ─────────────────────────────────────────
describe("productsPricingService.validateQuantity", () => {
  it("validates quantity against product purchaseRules", async () => {
    const mockPricingRepo = {} as unknown as ProductsPricingRepository

    const mockProductsRepo = {
      getResolvedPurchaseRules: vi.fn().mockResolvedValue({
        minQuantity: 5, stepQuantity: 5, allowBackorder: false
      })
    } as unknown as ProductsRepository

    const service = new ProductsPricingService(mockPricingRepo, mockProductsRepo)

    // Act: cantidad inválida (menor al mínimo)
    const result = await service.validateQuantity(3, "product-123", "variantId-123")

    // Assert
    expect(result.valid).toBe(false)
    expect(result.error).toContain("Mínimo")
  })
})

// ─────────────────────────────────────────
// Tests para getPriceOptions
// ─────────────────────────────────────────
describe("productsPricingService.getPriceOptions", () => {
  it("maps price tiers to frontend-friendly format", async () => {
    const mockTiers: PriceTier[] = [
      {
        id: "p1",
        productId: "prod-1",
        variantId: null,
        tierType: "retail",
        price: "100.00",
        compareAtPrice: "120.00",
        minQuantity: 1,
        volumeDiscounts: null,
        createdAt: new Date(),
        updatedAt: null
      },
      {
        id: "p2",
        productId: "prod-1",
        variantId: null,
        tierType: "reseller",
        price: "75.00",
        compareAtPrice: null,
        minQuantity: 10,
        volumeDiscounts: [{ quantity: 50, discountPercent: 15 }],
        createdAt: new Date(),
        updatedAt: null
      }
    ]

    const mockPricingRepo = {
      getAllPriceOptions: vi.fn().mockResolvedValue(mockTiers)
    } as unknown as ProductsPricingRepository

    const mockProductsRepo = {} as unknown as ProductsRepository
    const service = new ProductsPricingService(mockPricingRepo, mockProductsRepo)

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
