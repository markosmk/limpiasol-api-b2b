import * as v from "valibot"

export const createCollectionSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  slug: v.pipe(v.string(), v.minLength(1)),
  description: v.optional(v.nullable(v.string())),
  imageUrl: v.optional(v.nullable(v.string())),
  isActive: v.optional(v.boolean(), true),
  isFeatured: v.optional(v.boolean(), false)
})

export type CreateCollectionInput = v.InferOutput<typeof createCollectionSchema>

export const updateCollectionSchema = v.partial(createCollectionSchema)

export type UpdateCollectionInput = v.InferOutput<typeof updateCollectionSchema>

export const bulkAssignProductsCollectionSchema = v.object({
  productIds: v.array(v.string()),
  collectionIds: v.array(v.string()) // can be one or more collections
})

export type BulkAssignProductsCollectionInput = v.InferOutput<
  typeof bulkAssignProductsCollectionSchema
>
