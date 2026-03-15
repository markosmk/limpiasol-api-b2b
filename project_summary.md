# Business API - Resumen del Proyecto

## 📌 De qué se trata
API backend para una plataforma e-commerce B2B ("Business").
- **Core actual**: Gestión de usuarios, autenticación, roles y utilidades de email.
- **Diferido para el futuro**: Dominio y manejo de Órdenes (`orders`).
- **Framework Web**: Fastify.
- **Base de Datos**: MySQL manejado con Drizzle ORM.
- **Manejo de estados temporales/Caché**: Redis.

## 🗂 Estructura del Proyecto (`src/`)

- **`config/`**: Configuraciones generales (ej: cliente de Redis).
- **`db/`**: Instancia de conexión a base de datos (`client.ts`) y la declaración de esquemas (`schema/`).
  - `schema/users.ts`: Tabla de usuarios con roles y credenciales (usando `argon2` para hashes).
  - `schema/auth.ts`: Tablas para mnaejos de Sesiones (estilo LuciaAuth, token=id de session) y Tokens de Verificación (multiproposito).
- **`domains/`**: Módulos organizados por dominio (DDD) que contienen Rutas, Servicios, Repositorios y esquemas locales de validación.
  - `auth/`: Autenticación, creación de sesiones y cookies.
  - `admin/`: Utilidades específicas de administradores.
  - `orders/`: (Postergado).
- **`middlewares/`**: Funciones Fastify (preHandlers) como `checkBeforeAuth` (verifica cookies y sesiones cacheables en Redis) o validaciones de Roles.
- **`plugins/`**: Plugins auto-cargables de Fastify vía Autoload.
- **`utils/`**: Código reutilizable:
  - `auth/`: Generación de hashes, cookies y configuraciones vinculadas.
  - `email/`: Servicio de envíos de email con patrón adaptador (actualmente incluye `BrevoEmailAdapter` mediante HTTP fetch puro).

## 🔑 Autenticación & Seguridad
- Se utiliza autenticación a través del esquema Email/Contraseña.
- Sin pasarelas de pago, ni plataformas complejas de identidad (se eliminó `better-auth` a favor de un código limpio estilo `lucia auth v3` simplificado).
- Sesiones guardadas en MySQL y cacheadas en Redis para alta fidelidad y velocidad.

> **Importante para el Agente que lea esto**: No busques la tabla `account`, las contraseñas se guardan en `.passwordHash` de la misma tabla de `users`. La tabla `session` es la fuente única de verdad para el acceso. Revisa `.env.example` para levantar los servicios locales (Redis, MySQL, y claves de Brevo).

## 📦 Arquitectura

- **Routes** (`domains/**.routes.ts`): Su única responsabilidad es recibir el JSON HTTP, validarlo y devolver un código 200 o 400. No deben saber nada de Brevo ni de lógicas de negocio.

- **Repository / Queries** (`domains/**.repository.ts`,): Su única responsabilidad es hablar con MySQL. Tienen prohibido comunicarse con el mundo exterior (APIs HTTP como Brevo).

- **Hooks de Fastify (onRequest, preHandler)** (`middlewares/**.ts`, `hooks/**.ts`): Son para el ciclo de vida de la petición HTTP (autenticación, rate limiting, formateo), no para reglas de negocio.

- **Estrategia de Errores**: 
  - **Services**: Deben ser agnósticos a Fastify. Usan `AppError` (`utils/app-error.ts`) con un diccionario de códigos (`ErrorCode`). Si el error no está en el diccionario, se usa el código `"custom"` pasando un mensaje manual.
  - **Routes**: Pueden usar `AppError` o helpers de `@fastify/sensible` (`reply.notFound()`, etc.) para errores rápidos de flujo.
  - **Captura Global** (`plugins/error-handler.ts`):
    - **Valibot**: Transforma errores de validación en una respuesta estructurada con `code: "validation_error"`.
    - **AppError**: Devuelve el código de error para que el Frontend pueda reaccionar programáticamente (ej: i18n).
    - **Seguridad y Logs**: Solo se loguean (vía `request.log` para incluir el ReqID) los errores 500 (descontrolados). Los errores 4xx se consideran "ruido de negocio" y no ensucian los logs principales.
    - **Fallback**: Cualquier error inesperado devuelve un `internal_server_error` genérico, protegiendo la estructura interna.