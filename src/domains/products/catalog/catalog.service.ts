import type { UserTier } from "@/domains/products/pricing/pricing.types"

import {
  type ProductsPricingRepository,
  productsPricingRepository
} from "@/domains/products/pricing/pricing.repository"
import { type ProductsRepository, productsRepository } from "@/domains/products/products.repository"

export class ProductsCatalogService {
  constructor(
    private readonly productsRepo: ProductsRepository,
    private readonly pricingRepo: ProductsPricingRepository
  ) {}

  async getCatalogList(userTier: UserTier, isAuthenticated: boolean, page = 1, limit = 20) {
    // 1. Traemos los productos base (ej: 20 productos)
    const catalogProducts = await this.productsRepo.getCatalogProducts(page, limit)
    if (catalogProducts.length === 0) return []

    // 2. Extraemos los IDs y buscamos sus precios en 1 sola query
    const productIds = catalogProducts.map((p) => p.id)
    const allTiers = await this.pricingRepo.findTiersForProductsBulk(productIds, userTier)

    // 3. Mapeamos y calculamos el "Desde" para cada producto
    return catalogProducts.map((product) => {
      const baseProduct = {
        id: product.id,
        slug: product.slug,
        name: product.name,
        badge: product.badge,
        shortDescription: product.shortDescription,
        // TODO: If not has image, use the product
        image: product.variants[0]?.image || product.images[0]?.url || null
      }

      // Si NO está autenticado y el precio NO es público, anulamos el pricing.
      if (!isAuthenticated && !product.isPricePublic) {
        return {
          ...baseProduct,
          pricing: null // El frontend leerá esto y mostrará "Iniciá sesión para ver el precio"
        }
      }

      // Filtramos solo los precios de este producto
      const productTiers = allTiers.filter((t) => t.productId === product.id)

      // Priorizamos el tier del usuario. Si no hay, caemos en retail.
      let activeTiers = productTiers.filter((t) => t.tierType === userTier)
      if (activeTiers.length === 0) {
        activeTiers = productTiers.filter((t) => t.tierType === "retail")
      }

      // Obtenemos todos los precios numéricos aplicables
      const numericPrices = activeTiers.map((t) => Number(t.price))

      // Determinamos el precio mínimo (si no tiene precio, devolvemos 0)
      const minPrice = numericPrices.length > 0 ? Math.min(...numericPrices) : 0

      // ¿Cuándo mostramos "Desde"?
      // Opción A: Tiene múltiples variantes
      const hasMultipleVariants = product.variants.length > 1
      // Opción B: Tiene distintos precios cargados en la tabla
      const hasMultiplePrices = new Set(numericPrices).size > 1

      const isFrom = hasMultipleVariants || hasMultiplePrices

      return {
        ...baseProduct,
        pricing: {
          amount: minPrice,
          isFrom, // Frontend usa esto para poner el "Desde "
          currency: "ARS",
          tierApplied: activeTiers[0]?.tierType || "none"
        }
      }
    })
  }
}

export const productsCatalogService = new ProductsCatalogService(
  productsRepository,
  productsPricingRepository
)
