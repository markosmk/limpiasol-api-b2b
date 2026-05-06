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
- **Cobertura**: Apuntar a `>80%` en lógica crítica (`pricing`, `auth`, `reglas de negocio`).

## Resumen

Tipo de Test | Herramienta | Cuándo usarlo | Velocidad
---|---|---|---
Unitario | `Vitest` (nativo) | Funciones puras, utils, validaciones | ⚡ Muy rápido
Integración | `Vitest` + mocks o DB real | Servicios que usan repositorios | 🚀 Rápido
E2E | `Vitest` + `fastify.inject()` | Rutas completas, flujos de usuario | 🐢 Más lento, pero realista


### Recomendaciones

Crear una DB separada para tests en PostgreSQL. Puedes levantarla con Docker Compose:

```bash
# Levantar el contenedor de test (configurado en docker-compose.yml en el puerto 5434)
docker compose up -d lsol-postgres-test

# Sincronizar la base de datos de test
pnpm run test:push-db
```

Asegúrate de tener la variable en tu archivo `.env.test`:
`DATABASE_URL="postgres://postgres:root@localhost:5434/ecommerce_limpiasol_test"`