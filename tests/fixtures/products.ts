export const mockProduct = {
  id: 1,
  name: "Producto Ejemplo",
  price: 199.99,
  category: "Electrónica",
  inStock: true
}

export const mockProductList = [
  { id: 1, name: "Producto A", price: 50, category: "Electrónica", inStock: true },
  { id: 2, name: "Producto B", price: 75, category: "Hogar", inStock: false },
  { id: 3, name: "Producto C", price: 100, category: "Ropa", inStock: true }
]

export const mockErrorResponse = {
  error: "Producto no encontrado",
  statusCode: 404
}
