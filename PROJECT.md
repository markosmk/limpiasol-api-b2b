# Business API — Documentación del Proyecto

Documentación técnica de la API de `B2B/B2C`. Este documento sirve como punto de partida para entender la arquitectura, las decisiones de diseño y el estado actual del proyecto.

---

## Visión General

Esta API es el núcleo de una plataforma e-commerce orientada a modelos **B2B (Business to Business)** y **B2C (Business to Consumer)**. Permite la gestión de un catálogo de productos con precios dinámicos según el rol del usuario, manejo de carritos persistentes y procesamiento de órdenes de compra con snapshots históricos.

---

## Stack Tecnológico

El proyecto utiliza un stack moderno, priorizando el rendimiento y la seguridad de tipos (Type Safety):

- **Framework Web**: [Fastify](https://www.fastify.io/) (Elegido por su baja latencia y sistema de plugins).
- **Lenguaje**: TypeScript.
- **Base de Datos**: PostgreSQL.
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/) (Consultas SQL seguras y eficientes).
- **Manejo de Estados/Caché**: Redis (Sesiones y estados temporales).
- **Validación de Datos**: [Valibot](https://valibot.dev/) (Alternativa ligera y modular a Zod).
- **Autenticación**: Sistema propio basado en sesiones y cookies (estilo `LuciaAuth v3`), ingreso por correo/contraseña (expandible a usar DNI o codigo de usuario), sesiones almacenadas en BD y cachadas en Redis para mayor velocidad.
- **Documentación API**: [OpenAPI 3.0](https://swagger.io/specification/).
- **Testing**: Vitest + Fastify Inject.

---

## Arquitectura y Estructura

El proyecto sigue una organización basada en **Dominios (Domain-Driven Design)** para mantener la escalabilidad y el desacoplamiento. Cada dominio encapsula sus rutas, servicios, repositorios y esquemas de validación.

### Arquitectura y Organización del Código

Para detalles sobre la organización por dominios (DDD), las responsabilidades de cada capa y la estrategia de manejo de errores, consulta [ARCH.md](./ARCH.md).

### Estructura de Carpetas (`src/`)

- `config/`: Inicialización de clientes (Redis, Database) y variables de entorno.
- `db/`: Definición de esquemas de tablas (`schema/`) y migraciones.
- `domains/`: El corazón de la aplicación. Cada carpeta (ej. `products/`) contiene:
  - `*.routes.ts`: Definición de endpoints y validación de entrada (Valibot).
  - `*.service.ts`: Lógica de negocio pura y orquestación.
  - `*.repository.ts`: Acceso a datos (Consultas SQL vía Drizzle).
  - `*.types.ts`: Definiciones de interfaces locales.
- `middlewares/`: Hooks de Fastify (`preHandler`) para autenticación y control de roles.
- `plugins/`: Plugins de Fastify (Error handler global, CORS, Autoload).
- `utils/`: Funciones de utilidad (hashing, adaptadores de email, manejo de errores).

### Flujo de Datos
`HTTP Request` -> `Route (Validation)` -> `Service (Business Logic)` -> `Repository (SQL Query)` -> `Database`

### Autenticación & Seguridad
- Sesiones guardadas en Base de Datos y cacheadas en Redis para alta fidelidad y velocidad.

> **Importante**: las contraseñas se guardan en `.passwordHash` de la misma tabla de `users`. La tabla `session` es la fuente única de verdad para el acceso.

---

## Conceptos Clave de Negocio

### 1. Sistema de Precios Dinámicos (Pricing Tiers)

Los usuarios tienen roles (`retail`, `reseller`, `distributor`). El sistema calcula automáticamente el precio unitario aplicando una cascada de fallback:
1. **Variante + Rol del Usuario**
2. **Variante + Retail** (público general)
3. **Producto Base + Rol del Usuario**
4. **Producto Base + Retail**

> Al listar el catálogo o ver el carrito, los precios devueltos por la API cambian dinámicamente según el nivel asociado a la sesión. El backend calcula de manera segura el total sin confiar en los precios que mande el cliente.

### 2. Reglas de Compra (Purchase Rules)
Permite configurar mínimos de compra, múltiplos de cantidad (step) y límites máximos por producto o variante. Al igual que los precios, estas reglas se heredan del Producto si la Variante no las especifica.

### 3. Snapshots de Órdenes
Para garantizar la integridad histórica, cada orden de compra guarda un "Snapshot" de los datos del producto (nombre, SKU, precio pagado, imagen) al momento del cierre. Cambios posteriores en el catálogo no afectan las órdenes ya realizadas.

---

## Documentación de la API (Swagger/OpenAPI)

La documentación detallada de cada endpoint se encuentra en formato OpenAPI (YAML fragmentado por dominios).

Para visualizarla de forma interactiva y con recarga en caliente, ejecuta:
```bash
pnpm run docs:watch
```
Luego abre `docs/index.html` en tu navegador.

### Endpoints Fundamentales
- **Auth**: `/auth/login`, `/auth/register`.
- **Catálogo**: `/products`, `/products/:slug`.
- **Pricing**: `GET /products/:productId/price` (Cálculo dinámico basado en cantidad y usuario).
- **Carrito**: `/carts` (Operaciones CRUD sobre el carrito del usuario autenticado).

---

## Deuda Técnica y Mejoras Futuras

Tareas pendientes y áreas de mejora identificadas:

- [ ] **Optimización de Caché**: Implementar headers de `Cache-Control` y revalidación por Redis en la ruta de precios.
- [ ] **Timeline de Órdenes**: Completar la lógica de transición de estados y auditoría en el dominio `orders`.
- [ ] **Webhooks**: Integrar webhooks del proveedor de email para tracking de notificaciones.
- [ ] **Monitoreo**: Implementar logs estructurados para los *Prepared Statements* de Drizzle para medir impacto en latencia.
- [ ] **Integración de Imágenes**: Migrar el almacenamiento de imágenes a un bucket S3/Cloudflare R2 (actualmente rutas locales/externas directas).

---

> **Nota**: Para una guía detallada de la base de datos, consulta [DATABASE-GUIDE.md](./DATABASE-GUIDE.md). 

> **Nota**: Para el sistema de precios detallado, consulta [PRICING.md](./PRICING.md).
