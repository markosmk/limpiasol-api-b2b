import { type CollectionsRepository, collectionsRepository } from "./collections.repository"
import type {
  BulkAssignProductsCollectionInput,
  CreateCollectionInput,
  UpdateCollectionInput
} from "./collections.schema"

export class CollectionsService {
  constructor(private readonly repository: CollectionsRepository) {}

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

  async create(data: CreateCollectionInput) {
    return await this.repository.create(data)
  }

  async update(id: string, data: UpdateCollectionInput) {
    return await this.repository.update(id, data)
  }

  async delete(id: string) {
    return await this.repository.delete(id)
  }

  async bulkAssign(data: BulkAssignProductsCollectionInput) {
    const { productIds, collectionIds } = data
    return await this.repository.assignProducts(productIds, collectionIds)
  }
}

export const collectionsService = new CollectionsService(collectionsRepository)
