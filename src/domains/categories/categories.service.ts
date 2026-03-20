import { type CategoriesRepository, categoriesRepository } from "./categories.repository"
import type {
  BulkAssignProductsInput,
  CreateCategoryInput,
  UpdateCategoryInput
} from "./categories.schema"

export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}

  async getAll() {
    return await this.repository.findAll()
  }

  async getPublic() {
    return await this.repository.findPublic()
  }

  async getById(id: string) {
    return await this.repository.findById(id)
  }

  async getBySlug(slug: string) {
    return await this.repository.findBySlug(slug)
  }

  async create(data: CreateCategoryInput) {
    return await this.repository.create(data)
  }

  async update(id: string, data: UpdateCategoryInput) {
    return await this.repository.update(id, data)
  }

  async delete(id: string) {
    return await this.repository.delete(id)
  }

  async bulkAssign(data: BulkAssignProductsInput) {
    const { productIds, categoryIds, isPrimary } = data
    return await this.repository.assignProducts(productIds, categoryIds, isPrimary)
  }
}

export const categoriesService = new CategoriesService(categoriesRepository)
