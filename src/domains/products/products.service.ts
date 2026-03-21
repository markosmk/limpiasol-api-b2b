import { createId } from "@paralleldrive/cuid2"
import { type ProductsRepository, productsRepository } from "./products.repository"
import type { CreateProductInput, UpdateProductInput } from "./products.schema"

export class ProductsService {
  constructor(private readonly productsRepo: ProductsRepository) {}
  async getProducts() {
    return await this.productsRepo.findAll()
  }
  async getProductBySlug(slug: string) {
    return await this.productsRepo.findBySlug(slug)
  }
  // for admins
  async getAllProducts() {
    return await this.productsRepo.findAll({ includeInactive: true })
  }
  async getProductById(productId: string) {
    return await this.productsRepo.findProductWithDetails(productId, {
      includeInactive: true
    })
  }
  async createProduct(input: CreateProductInput) {
    const { variants, prices, categories, tags, collections, images, ...productData } = input

    // Generate product ID beforehand to link everything correctly
    const productId = createId()

    // Map variants with IDs
    const preparedVariants = (variants || []).map((v) => ({
      ...v,
      id: createId()
    }))

    // We pass everything to the repository to handle the transaction
    await this.productsRepo.createWithFullDetails(
      { ...productData, id: productId },
      {
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
      }
    )

    return await this.productsRepo.findProductWithDetails(productId, {
      includeInactive: true,
      allImages: true
    })
  }
  async updateProduct(id: string, input: UpdateProductInput) {
    const { variants, prices, categories, tags, collections, images, ...productData } = input

    // Prepare prices if they exist
    const mappedPrices = prices
      ? prices.map((p) => ({
          ...p,
          price: String(p.price),
          compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : null
        }))
      : undefined

    await this.productsRepo.updateWithFullDetails(id, {
      ...productData,
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
