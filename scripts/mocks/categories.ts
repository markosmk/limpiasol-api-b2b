import type { CategoryInsert } from "@/db/pg/products"

export const mockCategories: CategoryInsert[] = [
  {
    id: "cat_limpieza_hogar",
    name: "Limpieza del Hogar",
    slug: "limpieza-hogar",
    description: "Productos esenciales para el cuidado del hogar"
  },
  {
    id: "cat_industrial",
    name: "Limpieza Industrial",
    slug: "limpieza-industrial",
    description: "Productos concentrados para empresas e industrias"
  },
  {
    id: "cat_accesorios",
    name: "Accesorios",
    slug: "accesorios",
    description: "Escobas, trapos, esponjas y más"
  }
]
