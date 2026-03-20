import * as v from "valibot"

export const createCategorySchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  slug: v.pipe(v.string(), v.minLength(1)),
  parentId: v.optional(v.nullable(v.string())),
  description: v.optional(v.nullable(v.string())),
  imageUrl: v.optional(v.nullable(v.string()))
})

export type CreateCategoryInput = v.InferOutput<typeof createCategorySchema>

export const updateCategorySchema = v.partial(createCategorySchema)

export type UpdateCategoryInput = v.InferOutput<typeof updateCategorySchema>

export const bulkAssignProductsSchema = v.object({
  productIds: v.array(v.string()),
  categoryIds: v.array(v.string()), // can be one or more categories
  isPrimary: v.optional(v.boolean(), false)
})

export type BulkAssignProductsInput = v.InferOutput<typeof bulkAssignProductsSchema>
