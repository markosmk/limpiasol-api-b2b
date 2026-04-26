import { createId } from "@paralleldrive/cuid2"
import { desc } from "drizzle-orm"
import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  varchar
} from "drizzle-orm/mysql-core"
import { type PurchaseRule, productStatusValues, type VolumeDiscount } from "./products.types"

export const products = mysqlTable(
  "products",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).unique().notNull(),
    description: text("description"),
    shortDescription: varchar("short_description", { length: 500 }),
    status: mysqlEnum("status", productStatusValues).notNull().default("published"),
    isFeatured: boolean("is_featured").default(false),
    badge: varchar("badge", { length: 50 }), // "Nuevo", "Oferta", "Exclusivo"
    brandId: varchar("brand_id", { length: 36 }),

    // B2B purchase rules (with JSON, scalable to table)
    purchaseRules: json("purchase_rules").$type<PurchaseRule>(),

    // metadata
    code: varchar("code", { length: 20 }),
    isPricePublic: boolean("is_price_public").default(false), // si el precio retail debe mostrarse al publico

    // deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").onUpdateNow()
  },
  (table) => [
    index("product_status_idx").on(table.status),
    index("product_brand_idx").on(table.brandId),
    index("product_code_idx").on(table.code),
    index("products_created_at_idx").on(desc(table.createdAt)),
    index("products_name_idx").on(table.name)
    //  index("product_deleted_idx").on(table.deletedAt), // para filtrar rápido
    // Ej: buscar rapido (publico) .where(and(eq(products.status, "published"), isNull(products.deletedAt)))
  ]
)

export type Product = typeof products.$inferSelect
export type ProductInsert = typeof products.$inferInsert

export const priceTiers = mysqlTable(
  "price_tiers",
  {
    id: varchar("id", { length: 24 })
      .primaryKey()
      .$defaultFn(() => createId()),
    productId: varchar("product_id", { length: 24 }).notNull(),
    variantId: varchar("variant_id", { length: 24 }), // NULL = precio aplica a todas las variantes

    // Tipo de precio: lista, mayorista, revendedor, VIP, etc.
    tierType: varchar("tier_type", { length: 50 }).notNull(), // 'retail', 'wholesale', 'reseller'

    // Precio y condiciones
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),

    minQuantity: int("min_quantity").default(1), // Descuento aplica desde X unidades
    // Descuentos por volumen (Json escalable)
    volumeDiscounts: json("volume_discounts").$type<VolumeDiscount[]>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").onUpdateNow()
  },
  (table) => [
    // evita duplicados: producto + variante + tipo de precio
    index("price_unique_idx").on(table.productId, table.variantId, table.tierType),
    // Para PostgreSQL en el futuro:
    // index("price_unique_idx").on(table.productId, table.tierType).where(eq(table.variantId, null))
    // + otro índice para variantId != null
    index("price_product_idx").on(table.productId),
    index("price_tier_idx").on(table.tierType)
  ]
)

export type PriceTier = typeof priceTiers.$inferSelect
export type PriceTierInsert = typeof priceTiers.$inferInsert

export const productVariants = mysqlTable("product_variants", {
  id: varchar("id", { length: 24 })
    .primaryKey()
    .$defaultFn(() => createId()),
  productId: varchar("product_id", { length: 24 }).notNull(),
  sku: varchar("sku", { length: 100 }).notNull().unique(),
  barcode: varchar("barcode", { length: 100 }),
  name: varchar("name", { length: 100 }).notNull(), // "Rojo / XL"
  // Ej: { "Talla": "M", "Color": "Rojo" }
  options: json("options").$type<Record<string, string>>().notNull(),
  /**
   * si es necesario filtrar por "Talla = M" en la DB, se debe migrar a tablas normalizadas (product_options, product_option_values). JSON es flexible
   *ej:
   * {
   *  "Talla": "M",
   *  "Color": "Rojo",
   *  "Material": "Algodón"
   * }
   *
   */
  // Reglas de compra específicas de la variante (opcional)
  purchaseRules: json("purchase_rules").$type<PurchaseRule>(),
  // imagen por defecto para la variante, si no se especifica una, se usa la del producto
  image: varchar("image", { length: 500 }),
  stock: int("stock").default(0),
  stockManagement: boolean("stock_management").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").onUpdateNow()
})

export type ProductVariant = typeof productVariants.$inferSelect
export type ProductVariantInsert = typeof productVariants.$inferInsert

export const productImages = mysqlTable("product_images", {
  id: varchar("id", { length: 24 })
    .primaryKey()
    .$defaultFn(() => createId()),
  productId: varchar("product_id", { length: 24 }).notNull(),
  variantId: varchar("variant_id", { length: 24 }),
  url: varchar("url", { length: 500 }).notNull(),
  alt: varchar("alt", { length: 255 }),
  sortOrder: int("sort_order").default(0),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export type ProductImage = typeof productImages.$inferSelect
export type ProductImageInsert = typeof productImages.$inferInsert

export const categories = mysqlTable("categories", {
  id: varchar("id", { length: 24 })
    .primaryKey()
    .$defaultFn(() => createId()),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  parentId: varchar("parent_id", { length: 24 }),
  description: text("description"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

export type Category = typeof categories.$inferSelect
export type CategoryInsert = typeof categories.$inferInsert

export const productCategories = mysqlTable(
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

export const tags = mysqlTable(
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

export const productTags = mysqlTable(
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

export const collections = mysqlTable(
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

export const productCollections = mysqlTable(
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
