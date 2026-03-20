import { relations } from "drizzle-orm"
import {
  categories,
  collections,
  priceTiers,
  productCategories,
  productCollections,
  productImages,
  products,
  productTags,
  productVariants,
  tags
} from "./products"

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
  prices: many(priceTiers),
  categories: many(productCategories),
  images: many(productImages),
  tags: many(productTags),
  productToCollections: many(productCollections)
}))

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, {
    fields: [productVariants.productId],
    references: [products.id]
  })
}))

export const priceTiersRelations = relations(priceTiers, ({ one }) => ({
  product: one(products, {
    fields: [priceTiers.productId],
    references: [products.id]
  }),
  // navigate from price to variant
  variant: one(productVariants, {
    fields: [priceTiers.variantId],
    references: [productVariants.id]
  })
}))

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, {
    fields: [productCategories.productId],
    references: [products.id]
  }),
  category: one(categories, {
    fields: [productCategories.categoryId],
    references: [categories.id]
  })
}))

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id]
  }),
  variant: one(productVariants, {
    fields: [productImages.variantId],
    references: [productVariants.id]
  })
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  products: many(productTags)
}))

export const productTagsRelations = relations(productTags, ({ one }) => ({
  product: one(products, { fields: [productTags.productId], references: [products.id] }),
  tag: one(tags, { fields: [productTags.tagId], references: [tags.id] })
}))

export const collectionsRelations = relations(collections, ({ many }) => ({
  productCollections: many(productCollections)
}))

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  products: many(productCategories),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_parent"
  }),
  children: many(categories, {
    relationName: "category_parent"
  })
}))

export const productCollectionsRelations = relations(productCollections, ({ one }) => ({
  product: one(products, {
    fields: [productCollections.productId],
    references: [products.id]
  }),
  collection: one(collections, {
    fields: [productCollections.collectionId],
    references: [collections.id]
  })
}))
