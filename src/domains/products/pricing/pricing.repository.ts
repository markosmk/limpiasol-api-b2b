import { and, eq, isNull } from "drizzle-orm"
import type { PricingContext } from "./pricing.types"

import { db } from "@/db"
import { priceTiers } from "@/db/schema/products"

export class ProductsPricingRepository {
  /**
   * Busca el tier de precio para un producto/variante + tipo de usuario
   * Prioriza: variante específica > producto base (variantId = NULL)
   */
  async findPriceTier({ productId, variantId, userTier }: PricingContext) {
    // Primero intentamos con variante específica
    if (variantId) {
      const [tier] = await db
        .select()
        .from(priceTiers)
        .where(
          and(
            eq(priceTiers.productId, productId),
            eq(priceTiers.variantId, variantId),
            eq(priceTiers.tierType, userTier)
          )
        )

      if (tier) return tier
    }

    // Fallback: precio base del producto (variantId = NULL)
    const [tier] = await db
      .select()
      .from(priceTiers)
      .where(
        and(
          eq(priceTiers.productId, productId),
          isNull(priceTiers.variantId),
          eq(priceTiers.tierType, userTier)
        )
      )

    return tier || null
  }

  /**
   * Fallback a precio retail si no encuentra el tier del usuario
   */
  async findFallbackRetailPrice(productId: string, variantId?: string | null) {
    const [tier] = await db
      .select()
      .from(priceTiers)
      .where(
        and(
          eq(priceTiers.productId, productId),
          eq(priceTiers.tierType, "retail"),
          variantId ? eq(priceTiers.variantId, variantId) : isNull(priceTiers.variantId)
        )
      )

    return tier || null
  }

  /**
   * Obtiene todos los tiers de precio para un producto/variante
   */
  async findPriceTiersForProduct(productId: string, variantId?: string | null) {
    return await db
      .select()
      .from(priceTiers)
      .where(
        and(
          eq(priceTiers.productId, productId),
          variantId ? eq(priceTiers.variantId, variantId) : isNull(priceTiers.variantId)
        )
      )
  }

  /**
   * Obtiene todas las opciones de precio disponibles para un producto
   * (útil para admin o para mostrar "desde $X" en catálogo)
   */
  async getAllPriceOptions(productId: string, variantId?: string | null) {
    return await db
      .select()
      .from(priceTiers)
      .where(
        and(
          eq(priceTiers.productId, productId),
          variantId ? eq(priceTiers.variantId, variantId) : isNull(priceTiers.variantId)
        )
      )
  }
}

export const productsPricingRepository = new ProductsPricingRepository()
