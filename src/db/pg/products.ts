import { createId } from "@paralleldrive/cuid2"
import { desc } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core"
import { type PurchaseRule, productStatusValues, type VolumeDiscount } from "./products.types"

export const productStatusEnum = pgEnum("product_status", productStatusValues)

export const products = pgTable(
  "products",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).unique().notNull(),
    description: text("description"),
    shortDescription: varchar("short_description", { length: 500 }),
    status: productStatusEnum("status").notNull().default("published"),
    isFeatured: boolean("is_featured").default(false),
    badge: varchar("badge", { length: 50 }),
    brandId: varchar("brand_id", { length: 36 }),

    purchaseRules: jsonb("purchase_rules").$type<PurchaseRule>(),

    code: varchar("code", { length: 20 }),
    isPricePublic: boolean("is_price_public").default(false),

    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).$onUpdate(() => new Date())
  },
  (table) => [
    index("product_status_idx").on(table.status),
    index("product_brand_idx").on(table.brandId),
    index("product_code_idx").on(table.code),
    index("products_created_at_idx").on(desc(table.createdAt)),
    index("products_name_idx").on(table.name)
  ]
)

export type Product = typeof products.$inferSelect
export type ProductInsert = typeof products.$inferInsert

export const priceTiers = pgTable(
  "price_tiers",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),
    productId: varchar("product_id", { length: 24 }).notNull(),
    variantId: varchar("variant_id", { length: 24 }),

    tierType: varchar("tier_type", { length: 50 }).notNull(),

    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: numeric("compare_at_price", { precision: 10, scale: 2 }),

    minQuantity: integer("min_quantity").default(1),
    volumeDiscounts: jsonb("volume_discounts").$type<VolumeDiscount[]>(),

    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).$onUpdate(() => new Date())
  },
  (table) => [
    index("price_unique_idx").on(table.productId, table.variantId, table.tierType),
    index("price_product_idx").on(table.productId),
    index("price_tier_idx").on(table.tierType)
  ]
)

export type PriceTier = typeof priceTiers.$inferSelect
export type PriceTierInsert = typeof priceTiers.$inferInsert

export const productVariants = pgTable("product_variants", {
  id: varchar("id", { length: 24 })
    .primaryKey()
    .$defaultFn(() => createId()),
  productId: varchar("product_id", { length: 24 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull().unique(),
  barcode: varchar("barcode", { length: 100 }),
  name: varchar("name", { length: 100 }).notNull(),
  options: jsonb("options").$type<Record<string, string>>().notNull(),
  purchaseRules: jsonb("purchase_rules").$type<PurchaseRule>(),
  image: varchar("image", { length: 500 }),
  stock: integer("stock").default(0),
  stockManagement: boolean("stock_management").default(false),

  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).$onUpdate(() => new Date())
})

export type ProductVariant = typeof productVariants.$inferSelect
export type ProductVariantInsert = typeof productVariants.$inferInsert

export const productImages = pgTable("product_images", {
  id: varchar("id", { length: 24 })
    .primaryKey()
    .$defaultFn(() => createId()),
  productId: varchar("product_id", { length: 24 }).notNull(),
  variantId: varchar("variant_id", { length: 24 }),
  url: varchar("url", { length: 500 }).notNull(),
  alt: varchar("alt", { length: 255 }),
  sortOrder: integer("sort_order").default(0),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull()
})

export type ProductImage = typeof productImages.$inferSelect
export type ProductImageInsert = typeof productImages.$inferInsert

export const categories = pgTable("categories", {
  id: varchar("id", { length: 24 })
    .primaryKey()
    .$defaultFn(() => createId()),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  parentId: varchar("parent_id", { length: 24 }),
  description: text("description"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull()
})

export type Category = typeof categories.$inferSelect
export type CategoryInsert = typeof categories.$inferInsert

export const productCategories = pgTable(
  "product_categories",
  {
    productId: varchar("product_id", { length: 24 })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: varchar("category_id", { length: 24 })
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").default(false)
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.categoryId] }),
    index("pc_cat_idx").on(table.categoryId)
  ]
)

export const tags = pgTable(
  "tags",
  {
    id: varchar("id", { length: 24 }).primaryKey().$defaultFn(createId),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull()
  },
  (table) => [index("tags_slug_idx").on(table.slug)]
)

export type Tag = typeof tags.$inferSelect
export type TagInsert = typeof tags.$inferInsert

export const productTags = pgTable(
  "product_tags",
  {
    productId: varchar("product_id", { length: 24 })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    tagId: varchar("tag_id", { length: 24 })
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" })
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.tagId] }),
    index("pt_tag_idx").on(table.tagId),
    index("pt_prod_idx").on(table.productId)
  ]
)

export const collections = pgTable(
  "collections",
  {
    id: varchar("id", { length: 24 }).primaryKey().$defaultFn(createId),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false)
  },
  (table) => [index("collections_slug_idx").on(table.slug)]
)

export type Collection = typeof collections.$inferSelect
export type CollectionInsert = typeof collections.$inferInsert

export const productCollections = pgTable(
  "product_collections",
  {
    productId: varchar("product_id", { length: 24 })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    collectionId: varchar("collection_id", { length: 24 })
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" })
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.collectionId] }),
    index("pc_collection_idx").on(table.collectionId),
    index("pc_prod_idx").on(table.productId)
  ]
)
