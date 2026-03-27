import type { PriceTierInsert, ProductInsert, UserInsert } from "@/db/schema"
export const mockUsers: Omit<UserInsert, "passwordHash">[] = [
  {
    email: "admin@business.com",
    role: "admin",
    status: "active",
    emailVerified: true,
    name: "Admin User"
  },
  {
    email: "reseller@business.com",
    role: "reseller",
    status: "active",
    emailVerified: true,
    name: "Reseller User"
  },
  {
    email: "staff@business.com",
    role: "user",
    status: "active",
    emailVerified: true,
    name: "Staff User"
  }
]

export const mockProducts: Omit<ProductInsert, "id" | "slug">[] = [
  {
    code: "PROD-001",
    name: "Lavandina Concentrada 5L",
    description: "Lavandina de uso industrial para limpieza profunda."
    // basePrice: "5000.00",
    // stock: 100
  },
  {
    code: "PROD-002",
    name: "Detergente Neutro 5L",
    description: "Detergente de alto rendimiento B2B."
    // basePrice: "4500.00",
    // stock: 50
  }
]

// Mocks de variantes o precios por volumen (Tier Pricing B2B)
export const mockTiers: Omit<PriceTierInsert, "id" | "productId">[] = [
  { minQuantity: 10, price: "4500.00", tierType: "reseller" }, // Si lleva 10, le sale más barato
  { minQuantity: 50, price: "4000.00", tierType: "reseller" }
]
