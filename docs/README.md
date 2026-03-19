# API Documentation - OpenAPI 3.1

Documentación de la API B2B en formato OpenAPI.

---

## Estructura

```
docs/
├── openapi.yaml              # Generado (NO editar)
├── openapi.base.yaml         # Base: info, seguridad, schemas compartidos
├── domains/
│   ├── orders.yaml           # Endpoints de pedidos
│   ├── products.yaml         # Endpoints de productos
│   ├── auth.yaml             # Endpoints de autenticación
│   └── admin.yaml            # Endpoints de administración
│   └── ....yaml              # Endpoints de otros...
└── README.md                 # Este archivo
```

---

## Comandos

```bash
# Generar openapi.yaml desde los archivos de dominios
pnpm docs:bundle

# Modo watch (regenera al cambiar archivos)
pnpm docs:watch

# Validar sintaxis OpenAPI
pnpm docs:validate

# Servir docs estáticas para preview
pnpm docs:preview  # http://localhost:8081
```

---

## Agregar un nuevo endpoint

### 1. Elegir el archivo de dominio correcto
o crear uno nuevo si es un nuevo dominio

| Dominio | Archivo | Ejemplo |
|---------|---------|---------|
| Pedidos | `domains/orders.yaml` | `/orders`, `/orders/:id` |
| Productos | `domains/products.yaml` | `/products`, `/products/:id` |
| Admin | `domains/admin.yaml` | `/admin/orders/*` |
| Auth | `domains/auth.yaml` | `/auth/login`, `/auth/register` |

### 2. Agregar el path en el archivo correspondiente

```yaml
paths:
  /tu-endpoint:
    post:  # o get/put/patch/delete
      summary: Descripción corta
      description: |
        Descripción detallada (Markdown soportado).
        
        ## Notas opcionales
        - Reglas de negocio
        - Flujo esperado
      tags: [NombreDelDominio]  # Para agrupar en Insomnia
      security: [{ bearerAuth: [] }]  # Si requiere auth
      parameters:  # Solo query/path (no body)
        - name: id
          in: path
          required: true
          schema: { type: string }
      requestBody:  # Solo POST/PUT/PATCH
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [campoRequerido]
              properties:
                campoRequerido: { type: string }
      responses:
        "200":
          description: Éxito
          content:
            application/json:
              schema:
                type: object
                properties:
                  success: { type: boolean }
        "400":
          description: Error de validación
          content:
            application/json:
              schema: { $ref: "../openapi.base.yaml#/components/schemas/Error" }
        "401":
          $ref: "../openapi.base.yaml#/components/responses/401Unauthorized"
```

### 3. Agregar schemas reutilizables (si corresponde)

```yaml
# Al final del archivo del dominio
components:
  schemas:
    TuNuevoSchema:
      type: object
      required: [campo1]
      properties:
        campo1: { type: string }
        campo2: { type: integer }
```

### 4. Regenerar el bundle

```bash
pnpm docs:bundle
```

### 5. Importar en Insomnia

```
Insomnia → Import → From File → docs/openapi.yaml
```

---

## Referencias a schemas compartidos

Usar `$ref` para schemas del `openapi.base.yaml`:

```yaml
# Error genérico
schema: { $ref: "../openapi.base.yaml#/components/schemas/Error" }

# Respuesta 401
$ref: "../openapi.base.yaml#/components/responses/401Unauthorized"

# Dirección
$ref: "../openapi.base.yaml#/components/schemas/Address"
```

---

## Checklist antes de committear

- [ ] El endpoint está en el archivo de dominio correcto
- [ ] Usa `$ref` para schemas compartidos (no duplicar)
- [ ] Incluye al menos 2 responses (éxito + error)
- [ ] Ejecuté `pnpm docs:bundle` y no hay errores
- [ ] El `openapi.yaml` generado se commitea junto con los cambios

---

## Troubleshooting

| Error | Solución |
|-------|----------|
| `Cannot find module 'yaml'` | `pnpm add -D yaml` |
| Referencias `$ref` no resuelven | Usar ruta relativa desde el archivo del dominio: `../openapi.base.yaml` |
| Insomnia no importa | Asegurar que `openapi.yaml` está actualizado (correr `pnpm docs:bundle`) |
| Validación falla | `pnpm docs:validate` para ver errores específicos |

---

## Tips for Agents (AI Assistants)

Al actualizar o crear documentacion:
1. **Verificar Rutas Reales**: Antes de documentar, lee siempre el archivo de `*.routes.ts` correspondiente para asegurar que los `paths` y `params` coinciden (ej: usar `{slug}` si la ruta es `/:slug`).
2. **Reutilizar Schemas**: Revisa `openapi.base.yaml` y otros archivos de dominio para reutilizar componentes mediante `$ref`. Evita duplicar definiciones de `Product` u `Order`.
3. **Casos de Error**: Incluye siempre al menos un error 400 (validación) o 404 (no encontrado) usando los schemas base.
4. **Respuesta Estándar**: La API suele responder con `{ success: boolean, data: ... }` o `{ success: false, error: string }`. Refleja esto en los ejemplos.

---

**Última actualización:** Marzo 2026
