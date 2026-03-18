# Tests

### Comandos utiles

```bash
# Ejecutar todos los tests una vez
pnpm test

# Modo watch (se re-ejecutan al cambiar archivos)
pnpm run test:watch

# Ver reporte de cobertura
pnpm run test:coverage

# Ejecutar solo tests de pricing
npx vitest pricing

# Ejecutar solo tests E2E (con config separada si la tenés)
pnpm run test:e2e

# Ejecutar un test específico por nombre
npx vitest -t "applies volume discount"

# Ejecutar solo este archivo
npx vitest run products.pricing.service.test.ts
pnpm test products.pricing.service.test.ts

# Con watch mode para desarrollo
npx vitest products.pricing.service --watch

# Ver detalle de errores
npx vitest run products.pricing.service.test.ts --reporter=verbose

# Ejecutar solo tests de pricing
npx vitest run pricing
```

# Buenas Practicas

- **Aislamiento**: Cada test debe poder ejecutarse solo, sin depender de otros.
- **Limpieza**: Usar `beforeEach`/`afterEach` para limpiar mocks o DB.
- **Nombres descriptivos**: `it("returns 400 when quantity is below minimum")`.
- **Arrange-Act-Assert**: Estructurar cada test en 3 bloques claros.
- **Mocks en los bordes**: Mockear la DB en tests de servicios, no en tests `E2E`.
- **Variables de entorno**: Usar `TEST_DATABASE_URL` para no tocar la DB de desarrollo.
- **Cobertura**: Apuntar a `>80%` en lógica crítica (`pricing`, `auth`, `reglas de negocio`).

## Resumen

Tipo de Test | Herramienta | Cuándo usarlo | Velocidad
---|---|---|---
Unitario | `Vitest` (nativo) | Funciones puras, utils, validaciones | ⚡ Muy rápido
Integración | `Vitest` + mocks o DB real | Servicios que usan repositorios | 🚀 Rápido
E2E | `Vitest` + `fastify.inject()` | Rutas completas, flujos de usuario | 🐢 Más lento, pero realista


### Recomendaciones

Crear una DB vacía llamada database_test con el mismo schema:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS database_test;"
npx drizzle-kit push --config=drizzle.config.ts --env-file=.env.test

```