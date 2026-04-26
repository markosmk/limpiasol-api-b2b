import { createId } from "@paralleldrive/cuid2"
import { type ProductsRepository, productsRepository } from "./products.repository"
import type { CreateProductInput, UpdateProductInput } from "./products.schema"

import { generateSlug } from "@/utils/helpers"

export class ProductsService {
  constructor(private readonly productsRepo: ProductsRepository) {}

  async getProductBySlug(slug: string) {
    return await this.productsRepo.findBySlug(slug)
  }

  async isProductWithPricePublic(productId: string) {
    return await this.productsRepo.findProductChecking(productId, ["isPricePublic"])
  }

  /**
   * ADMIN
   */

  /** to list all products for table (short information) */
  async getAllProducts() {
    return await this.productsRepo.findAll()
  }

  /** to get a product with all its information to edit */
  async getProductById(productId: string) {
    return await this.productsRepo.findProductWithDetails(productId, {
      includeInactive: true
    })
  }

  async createProduct(input: CreateProductInput) {
    const { variants, prices, categories, tags, collections, images, ...productData } = input

    // Map variants with IDs
    let preparedVariants = (variants || []).map((v) => ({
      ...v
    }))

    // Si no enviaron variantes, creamos la variante por defecto
    if (preparedVariants.length === 0) {
      preparedVariants = [
        {
          name: "Única",
          sku: `SKU-${createId().slice(0, 8).toUpperCase()}`,
          options: { Variante: "Única" },
          barcode: null,
          stock: 0,
          stockManagement: false
        }
      ]
    }

    let slug: string
    if (productData.slug && productData.slug.trim() !== "") {
      // 1. Slug manual: Lo dejamos limpio y SIN sufijo feo para SEO.
      // Si choca en la DB, es culpa del admin por elegir uno repetido.
      slug = generateSlug(productData.slug)
    } else {
      // 2. Autogenerado: Usamos el nombre y acá SÍ le mandamos el sufijo para evitar colisiones.
      const baseSlug = generateSlug(productData.name)
      const uniqueSuffix = createId().slice(0, 5)
      slug = `${baseSlug}-${uniqueSuffix}`
    }

    // We pass everything to the repository to handle the transaction
    const productId = await this.productsRepo.createWithFullDetails({
      product: { ...productData, slug },
      variants: preparedVariants,
      prices: (prices || []).map((p) => ({
        ...p,
        price: String(p.price),
        compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : null
      })),
      categories: categories || [],
      tags: tags || [],
      collections: collections || [],
      images: images || []
    })

    return await this.productsRepo.findProductWithDetails(productId, {
      includeInactive: true,
      allImages: true
    })
  }

  async updateProduct(id: string, input: UpdateProductInput) {
    const { variants, prices, categories, tags, collections, images, ...productData } = input

    // Validar el Modo Shopify: No podemos dejar al producto sin variantes.
    // Ojo: Si 'variants' es undefined, significa "no tocar las variantes actuales".
    // Si 'variants' es [], significa "borrar todas las variantes".
    if (variants && variants.length === 0) {
      // Opción A: Tirar un error y obligar al usuario a dejar al menos una.
      // throw new AppError({ code: "PRODUCT_NEEDS_VARIANT", message: "El producto debe tener al menos una variante." })

      // Opción B (Más segura si no tienes frontend validando esto aún):
      // Forzar la creación de la variante "Única" para que no quede huérfano.
      variants.push({
        name: "Única",
        sku: `SKU-${id.slice(0, 8).toUpperCase()}`,
        options: { Variante: "Única" },
        stock: 0,
        stockManagement: false
      })
    }

    // Prepare prices if they exist
    const mappedPrices = prices
      ? prices.map((p) => ({
          ...p,
          price: String(p.price),
          compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : null
        }))
      : undefined

    if (productData.slug !== undefined) {
      if (productData.slug.trim() === "") {
        delete productData.slug
      } else {
        // Si el admin está editando el slug explícitamente, quiere ESA url exacta.
        // Lo limpiamos pero NO le agregamos sufijo.
        productData.slug = generateSlug(productData.slug)
      }
    }

    await this.productsRepo.updateWithFullDetails(id, {
      product: productData,
      variants,
      prices: mappedPrices,
      categories,
      tags,
      collections,
      images
    })

    return await this.productsRepo.findProductWithDetails(id, {
      includeInactive: true,
      allImages: true
    })
  }

  async deleteProduct(id: string) {
    await this.productsRepo.delete(id)
    return { success: true }
  }
}

export const productsService = new ProductsService(productsRepository)
