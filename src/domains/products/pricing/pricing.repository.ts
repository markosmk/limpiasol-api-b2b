import { and, eq, inArray, isNull } from "drizzle-orm"
import type { UserTier } from "./pricing.types"

import { db } from "@/db"
import { priceTiers } from "@/db/pg/products"

export class ProductsPricingRepository {
  constructor(private readonly database: typeof db = db) {}

  /**
   * Busca el tier de precio para un producto/variante + tipo de usuario
   * Prioriza: variante específica > producto base (variantId = NULL)
   */
  async findPriceTier(productId: string, variantId: string | null, userTier: UserTier) {
    // Primero intentamos con variante específica
    if (variantId) {
      const tier = await this.database.query.priceTiers.findFirst({
        where: and(
          eq(priceTiers.productId, productId),
          eq(priceTiers.variantId, variantId),
          eq(priceTiers.tierType, userTier)
        )
      })

      if (tier) return tier
    }

    // Fallback: precio base del producto (variantId = NULL)
    const fallbackTier = await this.database.query.priceTiers.findFirst({
      where: and(
        eq(priceTiers.productId, productId),
        isNull(priceTiers.variantId),
        eq(priceTiers.tierType, userTier)
      )
    })

    return fallbackTier || null
  }

  /**
   * Fallback a precio retail si no encuentra el tier del usuario
   */
  async findFallbackRetailPrice(productId: string, variantId?: string | null) {
    const fallback = await this.database.query.priceTiers.findFirst({
      where: and(
        eq(priceTiers.productId, productId),
        eq(priceTiers.tierType, "retail"),
        variantId ? eq(priceTiers.variantId, variantId) : isNull(priceTiers.variantId)
      )
    })

    return fallback || null
  }

  /**
   * Obtiene todos los tiers de precio para un producto/variante
   */
  async findPriceTiersForProduct(productId: string, variantId?: string | null) {
    return await this.database.query.priceTiers.findMany({
      where: and(
        eq(priceTiers.productId, productId),
        variantId ? eq(priceTiers.variantId, variantId) : isNull(priceTiers.variantId)
      )
    })
  }

  /**
   * Obtiene todas las opciones de precio disponibles para un producto
   * (útil para admin o para mostrar "desde $X" en catálogo)
   */
  async getAllPriceOptions(productId: string, variantId?: string | null, userTier?: string) {
    return await this.database.query.priceTiers.findMany({
      where: and(
        eq(priceTiers.productId, productId),
        variantId ? eq(priceTiers.variantId, variantId) : isNull(priceTiers.variantId),
        userTier ? eq(priceTiers.tierType, userTier) : undefined
      )
    })
  }

  /**
   * Busca múltiples tiers de precio de forma optimizada
   */
  async findPriceTiersBulk(variantIds: string[], userTier: UserTier) {
    if (variantIds.length === 0) return []
    return await this.database.query.priceTiers.findMany({
      where: and(
        inArray(priceTiers.variantId, variantIds),
        inArray(priceTiers.tierType, [userTier, "retail"])
      )
    })
  }

  /**
   * Trae todos los tiers de precio aplicables para un array de productos
   */
  async findTiersForProductsBulk(productIds: string[], userTier: string) {
    if (productIds.length === 0) return []

    return await this.database.query.priceTiers.findMany({
      where: and(
        inArray(priceTiers.productId, productIds),
        inArray(priceTiers.tierType, [userTier, "retail"])
      )
    })
  }
}

export const productsPricingRepository = new ProductsPricingRepository()
