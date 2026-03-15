# Api Fastify

Un API para la plataforma e-commerce B2B con fastify, drizzle y mysql.

Antes de levantar el servidor, se debe crear un archivo .env con las siguientes variables:

```ts
DATABASE_URL =
  "mysql://root:mysql@127.0.0.1:3306/mysql-image-database1k";
REDIS_URL = "redis://localhost:6379";
```

levantar los contenedores de docker con:

```bash
docker compose up -d
```

y finalmente iniciar el servidor con:

```bash
pnpm dev
```

# Características

## DDD (Domain-Driven Design)
La arquitectura se agrupa por `entidad`, no por `quien lo usa`. Esto facilita la escalabilidad y el mantenimiento.

### `users/` (Gestión de Usuarios - Admin Only)
| Método | Endpoint | Responsabilidad |
| :--- | :--- | :--- |
| `GET` | `/users` | Listar revendedores (paginación, filtros: pendientes, activos). |
| `GET` | `/users/:id` | Ver detalle completo del usuario e información fiscal. |
| `PATCH` | `/users/:id/status` | Cambiar estado (aprobar, suspender, rechazar). |
| `PATCH` | `/users/:id/role` | Cambiar rol o nivel administrativo. |
| `DELETE` | `/users/:id` | Eliminar o desactivar usuario (soft-delete). |

### `admin/` (Operaciones Globales)
Usado para acciones que cruzan múltiples dominios o configuraciones del sistema.

| Método | Endpoint | Responsabilidad |
| :--- | :--- | :--- |
| `GET` | `/admin/stats` | Métricas del dashboard (pedidos, ventas, usuarios). |
| `GET` | `/admin/reports/sales` | Exportar reportes en Excel/CSV. |
| `PATCH` | `/admin/settings` | Configuraciones globales (ej. monto mínimo de compra). |
| `GET` | `/admin/settings` | Obtener configuraciones actuales. |


## Rate Limiting (Capa de Red)
`src/plugins/ratelimit.ts`
 Tiene límites específicos por ruta para prevenir ataques de fuerza bruta o de denegación de servicio (DoS):

 - **Login**: Máximo 5 intentos por minuto por IP.
 - **Registro**: Máximo 3 registros exitosos/intentos por hora por IP.
 - **Recuperación de contraseña**: Máximo 3 solicitudes por hora por IP.
 - **Errores Personalizados**: Si alguien excede el límite, recibirá un error 429 Too Many Requests con un mensaje claro como: `Has excedido el límite de peticiones. Intenta de nuevo en [tiempo]`.

## Estrategia de Caché de Sesiones
La API utiliza un sistema de caché de dos niveles (L1 y L2) para optimizar el rendimiento y reducir la carga en la base de datos principal:

- **L1 (Local Memory)**: Implementado con `lru-cache`. Almacena hasta 1000 sesiones en la memoria RAM del servidor con un tiempo de vida (TTL) de 10 segundos. Esto permite respuestas instantáneas (0ms) para peticiones consecutivas de un mismo usuario.
- **L2 (Redis)**: Actúa como caché distribuida. Si la sesión no está en L1, se busca en Redis (1-10ms) antes de ir a MySQL. Esto permite compartir el estado de la sesión entre múltiples instancias del servidor.

Esta combinación asegura que:
1. Las peticiones frecuentes no sobrecarguen Redis ni MySQL.
2. El uso de memoria del servidor esté acotado y se limpie automáticamente.
3. El sistema sea escalable horizontalmente.