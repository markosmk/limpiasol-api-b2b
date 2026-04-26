import { eq } from "drizzle-orm"

import { db } from "@/db"
import { productVariants } from "@/db/pg/products"

export class ProductsVariantService {
  /**
   * Obtiene la variante con sus opciones (para mostrar "Rojo / M")
   */
  async findVariantById(variantId: string, { includeProduct = false } = {}) {
    const variant = await db.query.productVariants.findFirst({
      columns: {
        id: true,
        name: true,
        sku: true,
        options: true,
        productId: true
      },
      with: {
        product: includeProduct
          ? {
              columns: {
                id: true,
                name: true,
                purchaseRules: true,
                status: true
              }
            }
          : undefined
      },
      where: eq(productVariants.id, variantId)
    })

    return variant || null
  }
}
