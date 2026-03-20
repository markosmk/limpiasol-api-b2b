# Workflow

### Comandos clave para el flujo de trabajo:
Comandos para manejar la base de datos en modo desarrollo (NO EN PRODUCCION)

- `pnpm run db:reset`: Ejecuta el script para vaciar la base de datos.
- `pnpm run db:push`: Sincroniza el esquema (`schema.ts`) directamente con la base de datos sin crear archivos de migración. Es ideal para prototipado rápido.
- `pnpm run db:fresh`: Un combo que hace todo de una vez: `Reset + Push + Seed`.

### Cómo usarlo:
Para limpiar todo y volver a crear el esquema desde cero según los archivos de código:

```bash
pnpm run db:fresh
```

Esto ahorrará el tener que responder preguntas a `drizzle-kit generate` sobre si se renombraron columnas o si son tablas nuevas, ya que simplemente "empuja" el estado actual a una base de datos limpia.

### TIP

Mientras se está en la fase de `"modificar bastante el schema"`, usar `pnpm run db:push` en lugar de `db:generate + db:migrate`. Solo se vuelve a las migraciones cuando se tenga una base estable para producción.

### Comandos para manejar las migraciones (modo producción):

- `pnpm run db:generate`: Genera los archivos de migración a partir de los cambios en el esquema.
- `pnpm run db:migrate`: Ejecuta las migraciones pendientes.
