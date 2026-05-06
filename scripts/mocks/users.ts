import type { UserInsert } from "@/db/pg/users"

export const mockUsers: Omit<UserInsert, "passwordHash">[] = [
  {
    id: "usr_admin",
    name: "Admin",
    email: "admin@limpiasol.com",
    role: "admin",
    status: "active"
  },
  {
    id: "usr_reseller",
    name: "Reseller VIP",
    email: "reseller@business.com",
    role: "reseller",
    status: "active"
  },
  {
    id: "usr_retail",
    name: "Juan Perez",
    email: "juan.perez@example.com",
    role: "user",
    status: "active"
  }
]
