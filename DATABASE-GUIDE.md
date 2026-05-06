# Guía de Base de Datos — PostgreSQL con Drizzle ORM

> Guía completa para gestionar la base de datos de producción.
> Cubre desde el deploy inicial hasta cambios de esquema en caliente.

---

## Tabla de Contenidos

- [1. Arquitectura Actual](#1-arquitectura-actual)
- [2. Deploy Inicial (Base Vacía)](#2-deploy-inicial-base-vacía)
- [3. Flujo de Cambios de Esquema](#3-flujo-de-cambios-de-esquema)
- [4. Tipos de Cambios y Cómo Manejarlos](#4-tipos-de-cambios-y-cómo-manejarlos)
- [5. Comandos de Referencia Rápida](#5-comandos-de-referencia-rápida)
- [6. Reglas de Oro en Producción](#6-reglas-de-oro-en-producción)
- [7. Backups y Recuperación](#7-backups-y-recuperación)
- [8. Monitoreo y Performance](#8-monitoreo-y-performance)
- [9. Troubleshooting Común](#9-troubleshooting-común)

---

## 1. Arquitectura Actual

```
src/db/
├── index.ts              # Conexión Pool (node-postgres) + Drizzle
└── pg/                   # Esquemas Drizzle para PostgreSQL
    ├── index.ts           # Re-exporta todas las tablas
    ├── users.ts           # users, sessions, verificationTokens
    ├── products.ts        # products, variants, images, tags, tiers
    ├── categories.ts      # categories, productCategories
    ├── collections.ts     # collections, productCollections
    ├── carts.ts           # carts, cartItems
    ├── orders.ts          # orders, orderItems, orderTimeline
    ├── settings.ts        # settings (key-value)
    └── addresses.ts       # userAddresses

drizzle/
└── migrations/            # Archivos SQL generados por drizzle-kit
    ├── 0000_puzzling_thanos.sql   # Migración inicial
    └── meta/                      # Metadatos internos de Drizzle

drizzle.config.ts          # Configuración de drizzle-kit
scripts/migrate.mjs        # Script de migración programática
```

### Configuración Clave

| Archivo | Propósito |
|---------|-----------|
| `drizzle.config.ts` | Define el esquema fuente (`./src/db/pg/*`), directorio de salida (`./drizzle/migrations`), dialecto `postgresql` y credenciales |
| `src/db/index.ts` | Inicializa el Pool de PostgreSQL y exporta la instancia `db` de Drizzle |
| `scripts/migrate.mjs` | Ejecuta migraciones programáticamente contra la DB |

---

## 2. Deploy Inicial (Base Vacía)

Tenés una base de datos PostgreSQL vacía en Dokploy. Estos son los pasos:

### Opción A: Usando Migraciones (✅ Recomendado para Producción)

Las migraciones son archivos `.sql` versionados que Drizzle genera comparando tu esquema actual con el estado previo. Son **idempotentes** y **rastreables**.

```bash
# 1. Asegurate de que las migraciones estén generadas y al día
pnpm db:generate

# 2. Revisá el SQL generado (siempre revisarlo antes de aplicar)
cat drizzle/migrations/0000_puzzling_thanos.sql

# 3. Configurá la variable de entorno apuntando a PRODUCCIÓN
export DATABASE_URL="postgresql://usuario:password@host:5432/limpiasol_prod"

# 4. Ejecutá las migraciones
pnpm db:migrate
```

> [!IMPORTANT]
> El script `db:migrate` aplica **solo las migraciones pendientes**. Drizzle mantiene una tabla interna (`__drizzle_migrations`) que trackea cuáles ya se aplicaron. Nunca va a ejecutar la misma migración dos veces.

### Opción B: Usando Push (⚠️ Solo para Desarrollo)

`drizzle-kit push` compara tu esquema en código contra la DB real y aplica los cambios directamente **sin generar archivos de migración**.

```bash
# Solo para desarrollo local o staging
DATABASE_URL="postgresql://..." pnpm db:push
```

> [!WARNING]
> **NUNCA uses `db:push` en producción**. No deja registro de qué se cambió, no es reversible, y puede causar pérdida de datos si hay cambios destructivos. Úsalo solo para iterar rápido en desarrollo.

### Verificación Post-Deploy

Conectate con **SQLPro for Postgres** o **pgAdmin** y verificá:

1. Que existan todas las tablas esperadas
2. Que la tabla `__drizzle_migrations` tenga un registro
3. Que los ENUMs estén creados (`\dT+` en psql)
4. Que los índices estén presentes (`\di` en psql)

```sql
-- Ver todas las tablas
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Ver la tabla de migraciones de Drizzle
SELECT * FROM __drizzle_migrations;

-- Ver todos los índices
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
```

---

## 3. Flujo de Cambios de Esquema

Este es el flujo que **siempre** deberías seguir una vez que estés en producción:

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE MIGRACIÓN                            │
│                                                                  │
│  1. Modificar esquema     →  src/db/pg/*.ts                     │
│  2. Generar migración     →  pnpm db:generate                   │
│  3. Revisar el SQL        →  drizzle/migrations/XXXX_*.sql      │
│  4. Testear en local      →  pnpm db:migrate (contra local)     │
│  5. Commit + Push         →  git add drizzle/ && git push       │
│  6. Deploy en producción  →  pnpm db:migrate (contra prod)      │
└─────────────────────────────────────────────────────────────────┘
```

### Paso a Paso Detallado

#### Paso 1: Modificar el esquema en código

Hacé los cambios que necesites en los archivos de `src/db/pg/`. Por ejemplo, agregar una columna:

```typescript
// src/db/pg/products.ts
export const products = pgTable("products", {
  // ... columnas existentes ...
  weight: numeric("weight", { precision: 8, scale: 2 }), // ← NUEVA COLUMNA
})
```

#### Paso 2: Generar la migración

```bash
pnpm db:generate
```

Drizzle Kit va a:
1. Leer tu esquema actual en `src/db/pg/*`
2. Compararlo con el snapshot anterior (en `drizzle/migrations/meta/`)
3. Generar un nuevo archivo `.sql` con los cambios incrementales

Vas a ver algo así en la terminal:

```
[✓] Your SQL migration file ➜ drizzle/migrations/0001_strong_hulk.sql
```

#### Paso 3: Revisar el SQL generado

**SIEMPRE** abrí y leé el archivo SQL antes de aplicarlo:

```bash
cat drizzle/migrations/0001_strong_hulk.sql
```

Verificá que:
- No haya `DROP TABLE` o `DROP COLUMN` inesperados
- Los `ALTER TABLE` hagan lo que esperás
- Los valores DEFAULT sean correctos para columnas nuevas
- No haya operaciones que bloqueen la tabla por mucho tiempo

#### Paso 4: Testear en local

```bash
# Contra tu base local de desarrollo
pnpm db:migrate
```

Probá que la aplicación siga funcionando correctamente.

#### Paso 5: Commitear las migraciones

```bash
git add drizzle/
git commit -m "db: add weight column to products"
git push
```

> [!IMPORTANT]
> Los archivos de migración son parte del código fuente. **Nunca los borres ni los modifiques** una vez commiteados. Son inmutables.

#### Paso 6: Aplicar en producción

En tu pipeline de CI/CD o manualmente:

```bash
DATABASE_URL="postgresql://prod-url" pnpm db:migrate
```

---

## 4. Tipos de Cambios y Cómo Manejarlos

### ✅ Cambios Seguros (sin riesgo de pérdida de datos)

| Cambio | Ejemplo en Drizzle | SQL Generado |
|--------|-------------------|--------------|
| Agregar columna nullable | `weight: numeric("weight")` | `ALTER TABLE ADD COLUMN weight numeric` |
| Agregar columna con default | `isNew: boolean("is_new").default(false)` | `ALTER TABLE ADD COLUMN is_new boolean DEFAULT false` |
| Crear tabla nueva | `export const brands = pgTable(...)` | `CREATE TABLE brands (...)` |
| Agregar índice | `index("idx_name").on(table.name)` | `CREATE INDEX idx_name ON ...` |
| Agregar ENUM value | Agregar valor al `pgEnum` | `ALTER TYPE ... ADD VALUE ...` |

Estos cambios se pueden aplicar sin downtime.

### ⚠️ Cambios que Requieren Cuidado

#### Cambiar columna de nullable a NOT NULL

```typescript
// ANTES
phone: varchar("phone", { length: 50 }),

// DESPUÉS
phone: varchar("phone", { length: 50 }).notNull(),
```

**Problema:** Si hay filas con `NULL` en esa columna, la migración falla.

**Solución en 3 pasos:**

```sql
-- Paso 1: Rellenar los valores NULL existentes
UPDATE users SET phone = '' WHERE phone IS NULL;

-- Paso 2: Ahora sí, aplicar el constraint
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
```

En la práctica, hacé esto:
1. Primero ejecutá el `UPDATE` manualmente en producción
2. Luego generá y aplicá la migración de Drizzle

O mejor aún, hacelo en **dos migraciones separadas**:
- Migración 1: Agregar un default y ejecutar el backfill
- Migración 2: Aplicar el `NOT NULL`

#### Renombrar columna

Drizzle **no detecta renombrados**. Si cambiás el nombre de una columna en el esquema, Drizzle va a generar un `DROP COLUMN` + `ADD COLUMN`, lo cual **destruye los datos**.

**Solución:**

1. No cambies el nombre en Drizzle todavía
2. Ejecutá manualmente: `ALTER TABLE products RENAME COLUMN old_name TO new_name;`
3. Luego actualizá el esquema Drizzle para que coincida con el nuevo nombre
4. Generá la migración (debería estar vacía o mínima)

#### Cambiar tipo de dato

```typescript
// ANTES: varchar
code: varchar("code", { length: 20 }),

// DESPUÉS: integer
code: integer("code"),
```

**Problema:** El `ALTER COLUMN ... TYPE` puede fallar si los datos existentes no son convertibles.

**Solución:**
1. Agregar la nueva columna con el nuevo tipo
2. Migrar los datos con un script
3. Eliminar la columna vieja
4. Renombrar la nueva columna

### 🚨 Cambios Peligrosos (requieren planificación)

| Cambio | Riesgo | Mitigación |
|--------|--------|------------|
| `DROP TABLE` | Pérdida total de datos | Backup previo, confirmar que no hay referencias |
| `DROP COLUMN` | Pérdida de datos de esa columna | Backup, verificar que no se usa en queries |
| Cambiar `onDelete` de FK | Puede causar cascadas inesperadas | Testear exhaustivamente en staging |
| Modificar ENUMs (quitar valores) | Filas con ese valor quedan inválidas | Migrar datos antes de quitar el valor |

---

## 5. Comandos de Referencia Rápida

```bash
# ── Desarrollo ──────────────────────────────────────
pnpm db:generate        # Genera archivo SQL de migración
pnpm db:push            # Aplica esquema directo (sin migración)
pnpm db:studio          # Abre Drizzle Studio (GUI web)
pnpm db:seed            # Ejecuta el script de seed
pnpm db:fresh           # Reset + Push + Seed (desarrollo)

# ── Producción ──────────────────────────────────────
pnpm db:migrate         # Aplica migraciones pendientes
pnpm db:generate        # Solo genera, NO aplica

# ── Inspección ──────────────────────────────────────
pnpm db:studio          # GUI para inspeccionar datos
```

### Variables de Entorno

```bash
# Desarrollo (local Docker)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/limpiasol_dev"

# Producción (Dokploy)
DATABASE_URL="postgresql://usuario:password@host:5432/limpiasol_prod"
```

---

## 6. Reglas de Oro en Producción

### 1. Nunca uses `db:push` en producción

`push` es para desarrollo rápido. En producción, **siempre migraciones**.

### 2. Nunca edites un archivo de migración ya aplicado

Los archivos en `drizzle/migrations/` son inmutables. Si cometiste un error, creá una nueva migración que lo corrija.

### 3. Siempre hacé backup antes de migrar

```bash
# Backup completo
pg_dump -U usuario -h host -d limpiasol_prod -F c -f backup_$(date +%Y%m%d_%H%M).dump

# Solo estructura (sin datos)
pg_dump -U usuario -h host -d limpiasol_prod --schema-only -f schema_backup.sql
```

### 4. Revisá el SQL generado antes de aplicar

No confíes ciegamente en lo que genera Drizzle. Leé el `.sql` y confirmá que es lo que querés.

### 5. Cambios destructivos en pasos separados

Si necesitás hacer algo peligroso (eliminar columna, cambiar tipo), hacelo en múltiples deploys:

```
Deploy 1: Tu código deja de USAR la columna vieja
Deploy 2: La migración ELIMINA la columna vieja
```

### 6. Migrá la base ANTES de deployar el código nuevo

El orden correcto de un deploy es:

```
1. Hacer backup de la DB
2. Ejecutar pnpm db:migrate
3. Deployar el código nuevo
```

Si el código nuevo espera una columna que no existe, va a fallar. Migrá primero.

### 7. Tené un plan de rollback

Antes de cada migración, prepará el SQL inverso por si necesitás revertir:

```sql
-- Si la migración agrega una columna:
-- Rollback: ALTER TABLE products DROP COLUMN weight;
```

### 8. Nunca borres la carpeta `drizzle/migrations/meta/`

Contiene los snapshots que Drizzle usa para calcular los diffs. Sin ellos, la próxima generación de migración puede generar SQL incorrecto.

---

## 7. Backups y Recuperación

### Backup Automático (recomendado)

Configurá un cron job en tu servidor o en Dokploy:

```bash
# Cada día a las 3:00 AM
0 3 * * * pg_dump -U postgres -h localhost -d limpiasol_prod -F c -f /backups/db_$(date +\%Y\%m\%d).dump
```

### Backup Manual Antes de Migrar

```bash
# Backup comprimido completo
pg_dump -U usuario -h host -d limpiasol_prod \
  -F c --compress=9 \
  -f "backup_pre_migration_$(date +%Y%m%d_%H%M%S).dump"
```

### Restaurar un Backup

```bash
# Restaurar completo (destruye lo que hay)
pg_restore -U usuario -h host -d limpiasol_prod --clean --if-exists backup.dump

# Restaurar solo una tabla
pg_restore -U usuario -h host -d limpiasol_prod --table=products backup.dump
```

### Desde pgAdmin o SQLPro

Ambas herramientas tienen opciones de backup/restore en la interfaz gráfica. Usá formato `Custom` para mayor flexibilidad.

---

## 8. Monitoreo y Performance

### Queries Lentas

Habilitá el log de queries lentas en PostgreSQL:

```sql
-- Ver queries activas
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds';

-- Ver tamaño de tablas
SELECT
  relname AS table,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  pg_size_pretty(pg_relation_size(relid)) AS data_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

### Índices No Usados

```sql
-- Encontrar índices que nunca se usan (candidatos a eliminar)
SELECT
  schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Pool de Conexiones

Tu aplicación está configurada con `max: 10` conexiones en el Pool. Monitoreá:

```sql
-- Ver conexiones activas
SELECT count(*) FROM pg_stat_activity WHERE datname = 'limpiasol_prod';

-- Ver límite máximo
SHOW max_connections;
```

Si escalás, considerá usar **PgBouncer** como connection pooler externo.

### Prepared Statements

Ya tenés prepared statements en los repositorios de alta frecuencia:
- `auth.repository.ts` → `auth_find_session`
- `categories.repository.ts` → `categories_find_by_id`, `categories_find_by_slug`
- `collections.repository.ts` → `collections_find_by_slug`
- `users.repository.ts` → `users_find_by_id`

Estos se compilan una sola vez en PostgreSQL y se reutilizan en cada ejecución, ahorrando el overhead de parsing y planificación.

---

## 9. Troubleshooting Común

### Error: "relation already exists"

La migración intenta crear una tabla que ya existe. Esto pasa si aplicaste cambios con `db:push` y luego intentás migrar.

**Solución:** Marcá la migración como aplicada manualmente:

```sql
INSERT INTO __drizzle_migrations (hash, created_at)
VALUES ('hash_del_archivo', now());
```

### Error: "column contains null values" al hacer NOT NULL

**Solución:** Rellenará los valores NULL antes de migrar:

```sql
UPDATE tabla SET columna = 'valor_default' WHERE columna IS NULL;
```

### Error: "cannot drop type because other objects depend on it"

Al modificar un ENUM, PostgreSQL no permite borrar tipos en uso.

**Solución:** Usá `ALTER TYPE`:

```sql
-- Agregar un valor a un ENUM existente
ALTER TYPE user_role ADD VALUE 'wholesale';

-- No se pueden BORRAR valores de un ENUM fácilmente en PG.
-- Hay que crear un tipo nuevo, migrar y borrar el viejo.
```

### La migración tarda mucho

Si una tabla tiene millones de filas, un `ALTER TABLE ADD COLUMN ... DEFAULT ...` puede ser lento.

**En PostgreSQL 11+**, agregar columnas con default es instantáneo (no reescribe la tabla).
Tu versión de PG 18 no tiene este problema.

### Drizzle genera una migración vacía

Significa que tu esquema en código ya coincide con el último snapshot. No hay cambios que aplicar.

### Drizzle genera un DROP + CREATE en vez de un ALTER

Esto pasa cuando renombrás una columna o tabla. Drizzle no detecta renombrados.

**Solución:** Hacé el rename manualmente con SQL y luego sincronizá el esquema Drizzle.

---

## Checklist Pre-Deploy

- [ ] `pnpm typecheck` pasa sin errores
- [ ] `pnpm db:generate` no genera cambios inesperados
- [ ] Revisé el archivo `.sql` generado
- [ ] Tengo un backup reciente de la base de producción
- [ ] Probé la migración en un entorno local/staging
- [ ] El código nuevo es compatible con el esquema actual (antes de migrar)
- [ ] Tengo el SQL de rollback preparado por si algo sale mal
- [ ] Notifiqué al equipo sobre el cambio de esquema

---

## Resumen Visual

```
                    ┌──────────────┐
                    │ src/db/pg/*  │  ← Tu fuente de verdad
                    └──────┬───────┘
                           │
                    pnpm db:generate
                           │
                    ┌──────▼───────┐
                    │ drizzle/     │
                    │ migrations/  │  ← SQL versionado (inmutable)
                    │ 0001_xxx.sql │
                    └──────┬───────┘
                           │
                    pnpm db:migrate
                           │
              ┌────────────▼────────────┐
              │   PostgreSQL (Prod)      │
              │   __drizzle_migrations   │  ← Tracking de migraciones
              │   products, orders, ...  │
              └─────────────────────────┘
```
