/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { OrdersService } from "./orders.service"
import type { ProductsPricingService } from "@/domains/products/pricing/pricing.service"
import type { ProductsRepository } from "@/domains/products/products.repository"
import type { CartsService } from "../carts/carts.service"
import type { NotificationService } from "../notifications/notifications.service"
import type { OrdersRepository } from "./orders.repository"

// Mockear utils puras (fácil de testear, pero mockeamos para aislar)
vi.mock("./lib/orders.utils", () => ({
  generateOrderCode: vi.fn(() => "TEST1234"),
  isValidStatusTransition: vi.fn(() => true),
  getStatusTransitionError: vi.fn(() => ""),
  calculateOrderTotals: vi.fn((input: any) => ({
    subtotal: input.lineSubtotals.reduce((a: string, b: string) => a + parseFloat(b), 0).toFixed(2),
    discounts: "0.00",
    shippingCost: "0.00",
    taxes: "0.00",
    total: input.lineSubtotals.reduce((a: string, b: string) => a + parseFloat(b), 0).toFixed(2)
  })),
  buildOrderItemSnapshot: vi.fn((input) => ({
    productId: input.product.id,
    variantId: input.variant?.id,
    productName: input.product.name,
    productSku: input.variant?.sku || input.product.sku,
    unitPrice: input.pricing.unitPrice.toFixed(2),
    quantity: input.quantity,
    lineSubtotal: input.pricing.finalSubtotal.toFixed(2),
    purchaseRules: input.product.purchaseRules,
    volumeDiscountApplied: "0.00",
    tierType: input.pricing.appliedTier,
    metadata: null
  })),
  isValidPickupSchedule: vi.fn(() => true)
}))

describe("ordersService.createOrder", () => {
  let ordersRepo: OrdersRepository
  let cartsService: CartsService
  let pricingService: ProductsPricingService
  let productsRepo: ProductsRepository
  let notificationService: NotificationService
  let ordersService: OrdersService

  beforeEach(() => {
    vi.clearAllMocks()

    ordersRepo = {
      orderCodeExists: vi.fn(),
      createOrder: vi.fn(),
      createOrderWithCartConversion: vi.fn()
    } as unknown as OrdersRepository

    cartsService = {
      getActiveCartHydrated: vi.fn()
    } as unknown as CartsService

    pricingService = {
      calculatePrice: vi.fn(),
      validateQuantity: vi.fn()
    } as unknown as ProductsPricingService

    productsRepo = {
      findVariantsWithProductParent: vi.fn()
    } as unknown as ProductsRepository

    notificationService = {
      notifyNewOrder: vi.fn()
    } as unknown as NotificationService

    ordersService = new OrdersService(ordersRepo, cartsService, productsRepo, notificationService)
  })

  it("crea orden exitosamente con snapshot correcto usando precios del carrito", async () => {
    // Arrange: mocks
    // 1. Arrange: El carrito viene con precios calculados
    vi.mocked(cartsService.getActiveCartHydrated).mockResolvedValue({
      id: "cart_123",
      userId: "user_123",
      items: [
        {
          productId: "prod_1",
          variantId: "var_1",
          quantity: 2,
          pricing: {
            unitPrice: 100,
            originalPrice: 120,
            appliedTier: "wholesale",
            finalSubtotal: 200,
            currency: "ARS",
            hasDiscount: false,
            discountPercent: 0
          }
        }
      ],
      subtotal: 200
    } as any)

    vi.mocked(ordersRepo.orderCodeExists).mockResolvedValue(false)
    vi.mocked(productsRepo.findVariantsWithProductParent).mockResolvedValue({
      var_1: {
        id: "var_1",
        productId: "prod_1",
        name: "Variante 1",
        sku: "LIM-X-001",
        product: {
          id: "prod_1",
          name: "Limpiador X",
          slug: "limpiador-x",
          sku: "LIM-X",
          status: "published",
          purchaseRules: { minQuantity: 1, stepQuantity: 1, allowBackorder: false } as any
        }
      } as any
    } as any)
    vi.mocked(pricingService.calculatePrice).mockResolvedValue({
      unitPrice: 100,
      originalPrice: 120,
      appliedTier: "wholesale",
      finalSubtotal: 200,
      hasDiscount: false,
      discountPercent: 0,
      currency: "ARS"
    })
    vi.mocked(ordersRepo.createOrder).mockResolvedValue({
      orderId: "ord_abc",
      orderCode: "TEST1234",
      userEmail: "test@test.com"
    } as any)

    // Act
    const result = await ordersService.createOrder("user_123", "wholesale", {
      deliveryType: "pickup",
      pickupLocationData: {
        locationId: "loc_1",
        locationName: "Centro",
        address: "Av. 123",
        scheduledDate: "2024-02-20",
        scheduledTime: "14:30"
      }
      // items: [{ productId: "prod_1", quantity: 2 }]
    })

    // Assert
    expect(result.orderCode).toBe("TEST1234")
    expect(ordersRepo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderCode: "TEST1234",
        userId: "user_123",
        cartIdToConvert: "cart_123",
        items: expect.arrayContaining([
          expect.objectContaining({
            productName: "Limpiador X",
            productSku: "LIM-X-001",
            unitPrice: "100.00", // El precio viene directamente del carrito
            quantity: 2,
            lineSubtotal: "200.00"
          })
        ])
      })
    )
  })

  it("rechaza orden con producto inactivo", async () => {
    // 1. Mockeamos el carrito para que NO salte el error "ORDER_EMPTY"
    vi.mocked(cartsService.getActiveCartHydrated).mockResolvedValue({
      id: "cart_123",
      userId: "user_123",
      items: [{ productId: "prod_inactivo", quantity: 1, pricing: {} as any }],
      subtotal: 100
    } as any)

    vi.mocked(productsRepo.findVariantsWithProductParent).mockResolvedValue({}) // Producto no encontrado
    // Act & Assert
    await expect(
      ordersService.createOrder("user_123", "retail", {
        deliveryType: "shipping"
        // items: [{ productId: "prod_inactivo", quantity: 1 }]
      })
    ).rejects.toMatchObject({
      code: "PRODUCT_NOT_FOUND"
    })
  })

  it("rechaza la orden si la cantidad del carrito ya no cumple las reglas de compra actualizadas", async () => {
    // 1. Arrange: Simulamos que el usuario tiene 5 unidades en su carrito (las agregó hace semanas)
    vi.mocked(cartsService.getActiveCartHydrated).mockResolvedValue({
      id: "cart_old",
      userId: "user_123",
      items: [
        {
          productId: "prod_mutante",
          variantId: "var_mutante",
          quantity: 5, // <--- Cantidad vieja guardada en BD
          pricing: {
            unitPrice: 100,
            originalPrice: 100,
            appliedTier: "wholesale",
            finalSubtotal: 500,
            currency: "ARS",
            hasDiscount: false,
            discountPercent: 0
          }
        }
      ],
      subtotal: 500
    } as any)

    vi.mocked(ordersRepo.orderCodeExists).mockResolvedValue(false)

    // Simulamos que HOY el admin cambió la regla y el máximo ahora es 4
    vi.mocked(productsRepo.findVariantsWithProductParent).mockResolvedValue({
      var_mutante: {
        id: "var_mutante",
        productId: "prod_mutante",
        name: "Variante Mutante",
        sku: "MUT-001",
        product: {
          id: "prod_mutante",
          name: "Producto Mutante",
          slug: "producto-mutante",
          sku: "MUT-001",
          status: "published",
          purchaseRules: {
            minQuantity: 1,
            maxQuantity: 4,
            stepQuantity: 1,
            allowBackorder: false
          } as any
        }
      } as any
    } as any)

    // 2 & 3. Act & Assert: Debe explotar ANTES de llamar al repositorio de órdenes
    await expect(
      ordersService.createOrder("user_123", "wholesale", {
        deliveryType: "pickup",
        pickupLocationData: {
          locationId: "loc_1",
          locationName: "Depósito",
          address: "Calle 1",
          scheduledDate: "2026-03-30",
          scheduledTime: "10:00"
        }
      })
    ).rejects.toMatchObject({
      code: "ORDER_INVALID_QUANTITY",
      statusCode: 400
      // message: expect.stringContaining("Cantidad inválida") // Opcional si quieres ser muy estricto
    })

    // Verificamos que la transacción nunca se inició
    expect(ordersRepo.createOrder).not.toHaveBeenCalled()
  })
})
