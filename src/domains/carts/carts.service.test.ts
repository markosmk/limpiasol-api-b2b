/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation > */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CartsService } from "./carts.service"
import type { ProductsPricingService } from "../products/pricing/pricing.service"
import type { CartsRepository } from "./carts.repository"

import { AppError } from "@/utils/app-error"

describe("CartsService", () => {
  let cartsRepo: CartsRepository
  let pricingService: ProductsPricingService
  let cartsService: CartsService

  beforeEach(() => {
    cartsRepo = {
      findActiveCartByUserId: vi.fn(),
      createCart: vi.fn(),
      upsertCartItem: vi.fn(),
      deleteCartItem: vi.fn(),
      clearCart: vi.fn()
    } as unknown as CartsRepository

    pricingService = {
      validateQuantity: vi.fn(),
      calculatePrice: vi.fn()
    } as unknown as ProductsPricingService

    cartsService = new CartsService(cartsRepo, pricingService)
  })

  describe("addItem", () => {
    it("debe agregar el item si la validación de cantidad es exitosa", async () => {
      // Arrange
      vi.mocked(pricingService.validateQuantity).mockResolvedValue({ valid: true })
      vi.mocked(cartsRepo.findActiveCartByUserId).mockResolvedValue({
        id: "cart-1",
        items: []
      } as any)

      // Act
      await cartsService.addItem(
        "user-1",
        {
          productId: "prod-1",
          quantity: 5
        },
        "reseller"
      )

      // Assert
      expect(pricingService.validateQuantity).toHaveBeenCalledWith("prod-1", 5, undefined)
      expect(cartsRepo.upsertCartItem).toHaveBeenCalledWith("cart-1", "prod-1", undefined, 5)
    })

    it("debe lanzar AppError si la validación de cantidad falla", async () => {
      // Arrange
      vi.mocked(pricingService.validateQuantity).mockResolvedValue({
        valid: false,
        code: "MIN_QUANTITY",
        error: "El mínimo es 10"
      })

      // Act & Assert
      await expect(
        cartsService.addItem("user-1", { productId: "prod-1", quantity: 5 }, "reseller") // TODO: force reseller
      ).rejects.toThrow(AppError)

      expect(cartsRepo.upsertCartItem).not.toHaveBeenCalled()
    })
  })

  describe("getActiveCartHydrated", () => {
    it("debe retornar el carrito vacío con subtotal 0 si no tiene items", async () => {
      vi.mocked(cartsRepo.findActiveCartByUserId).mockResolvedValue({
        id: "cart-1",
        items: []
      } as any)

      const result = await cartsService.getActiveCartHydrated("user-1", "reseller")

      expect(result.subtotal).toBe(0)
      expect(result.items).toHaveLength(0)
    })

    it("debe hidratar los items y calcular el subtotal correctamente", async () => {
      // Arrange
      vi.mocked(cartsRepo.findActiveCartByUserId).mockResolvedValue({
        id: "cart-1",
        items: [
          { productId: "p1", quantity: 2, variantId: null },
          { productId: "p2", quantity: 1, variantId: "v1" }
        ]
      } as any)

      // Mockeamos que el calculo de precio devuelve resultados distintos para cada producto
      vi.mocked(pricingService.calculatePrice).mockImplementation(async (ctx) => {
        if (ctx.productId === "p1") return { finalSubtotal: 10.5 } as any // 2 x 5.25
        if (ctx.productId === "p2") return { finalSubtotal: 20.0 } as any // 1 x 20.00
        return { finalSubtotal: 0 } as any
      })

      // Act
      const result = await cartsService.getActiveCartHydrated("user-1", "reseller")

      // Assert
      expect(result.subtotal).toBe(30.5) // 10.50 + 20.00
      expect(result.items).toHaveLength(2)
      expect(result.items[0].pricing.finalSubtotal).toBe(10.5)
      expect(pricingService.calculatePrice).toHaveBeenCalledTimes(2)
      expect(pricingService.calculatePrice).toHaveBeenCalledWith(
        expect.objectContaining({
          userTier: "reseller"
        })
      )
    })
  })
})
