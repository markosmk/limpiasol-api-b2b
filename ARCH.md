# Arquitectura del Proyecto (DDD + Fastify)

Este documento define los estándares arquitectónicos y de testing para el backend. Utilizamos un enfoque basado en **Domain-Driven Design (DDD)**, estructurado en capas claras para mantener el código escalable y testeable.

## Estructura de un Dominio

Cada dominio (ej. `products`, `orders`, `collections`) vive en su propia carpeta bajo `src/domains/` y se divide estrictamente en estas responsabilidades:

## Responsabilidades de Capas

1. **`[dominio].routes.ts` (El Orquestador):** Define los endpoints usando Fastify. Se encarga de validar el *request* con Valibot, llamar a los servicios correspondientes y retornar la respuesta. **No contiene lógica de negocio.**
2. **`[dominio].service.ts` (La Lógica de Negocio):** El cerebro de la operación. Aquí viven los cálculos (ej. *pricing*), validaciones de negocio y transformaciones. **Deben ser agnósticos a Fastify.**
3. **`[dominio].repository.ts` (La Capa de Datos):** La única capa autorizada para hablar con la base de datos usando Drizzle ORM. Solo ejecuta sentencias SQL (Select, Insert, Update, Delete). **Tienen prohibido comunicarse con el mundo exterior (APIs HTTP externas).**
4. **`[dominio].schema.ts` (Contratos):** Esquemas de validación de entradas y salidas definidos estrictamente con **Valibot**.

---

## Estrategia de Manejo de Errores

El manejo de errores es centralizado y agnóstico a la capa de transporte (Fastify) siempre que sea posible.

- **Services**: Usan `AppError` (`src/utils/app-error.ts`) con un diccionario de códigos (`ErrorCode`). Si el error no está en el diccionario, se usa el código `"custom"` pasando un mensaje manual.
- **Routes**: Pueden usar `AppError` o helpers de `@fastify/sensible` (`reply.notFound()`, etc.) para errores rápidos de flujo.
- **Captura Global de Errores** (`src/plugins/error-handler.ts`):
  - **Valibot**: Transforma errores de validación en una respuesta estructurada con `code: "VALIDATION_ERROR"`.
  - **AppError**: Devuelve el código de error para que el Frontend pueda reaccionar programáticamente (ej: i18n).
  - **Seguridad y Logs**: Solo se loguean (vía `request.log` para incluir el ReqID) los errores 500 (descontrolados). Los errores 4xx se consideran "ruido de negocio" y no ensucian los logs principales.
  - **Fallback**: Cualquier error inesperado devuelve un `internal_server_error` genérico, protegiendo la estructura interna.

---

## Regla de Diseño: Clases e Inyección de Dependencias (DI)

Utilizamos **Clases** para los Servicios y Repositorios en lugar de objetos literales funcionales.

**¿Por qué?**

* **Facilita el Testing (Inyección de Dependencias):** Permite pasar repositorios falsos (mocks) a través del constructor del servicio durante los tests unitarios, eliminando la necesidad de usar el frágil `vi.mock()` global de Vitest.
* **Manejo de Instancias:** Evitamos la pérdida de contexto del `this` instanciando un **Singleton** al final del archivo del servicio, el cual es consumido directamente por las rutas.

**Ejemplo de implementación estándar:**

```typescript
// 1. El Servicio recibe los repositorios en el constructor
export class DomainService {
  constructor(
    private readonly primaryRepo: DomainRepository,
    private readonly secondaryRepo: OtherRepository
  ) {}
  
  async doBusinessLogic() {
    return await this.primaryRepo.findSomething();
  }
}

// 2. Exportamos un Singleton con las dependencias reales inyectadas para usar en .routes.ts
export const domainService = new DomainService(domainRepository, otherRepository);

```

## Estrategia de Testing

No testeamos todo por igual. Maximizamos el ROI (Retorno de Inversión) del tiempo de desarrollo siguiendo este esquema:

1. **Unit Tests (`*.service.test.ts`):** * **Cuándo:** SOLO para servicios con **lógica de negocio pesada** o cálculos complejos (ej. `pricing.service.ts`, validaciones de reglas de compra).
* **Cómo:** Se instancia la clase del servicio inyectando mocks manuales de los repositorios requeridos. Se prueba de forma aislada sin base de datos.
* **Excepción:** Si un servicio es un simple "pasamanos" (solo llama a un método del repositorio y retorna), **NO** se hace test unitario.


2. **API / Integration Tests (`*.routes.test.ts`):** * **Cuándo:** Para todos los endpoints principales. Representan el "Camino Feliz" (Happy Path) y manejo de errores (400, 404).
* **Cómo:** Se utiliza `app.inject()` de Fastify contra una **base de datos de pruebas real**.
* **Por qué:** Al testear la ruta, implícitamente verificamos que el Controlador, el Servicio y el Repositorio funcionan juntos correctamente.


3. **Tests de Repositorio (`*.repository.test.ts`):** * ❌ **NO RECOMENDADOS.** No testeamos que Drizzle ORM sepa armar consultas SQL. Esta validación ya queda cubierta por los *API Tests* de las rutas que tocan la base de datos real.

## Guía para Agentes IA y Nuevos Desarrolladores

Si vas a crear o modificar un dominio:

1. **Define el contrato primero:** Crea los esquemas en Valibot (`.schema.ts`).
2. **Arma el acceso a datos:** Crea el repositorio (`.repository.ts`) con consultas puras de Drizzle.
3. **Crea el servicio:** Define la clase del servicio inyectando los repositorios necesarios en el constructor. Exporta el singleton al final.
4. **Orquesta en las rutas:** Conecta las validaciones de Valibot con el servicio en (`.routes.ts`).
5. **Testea de forma inteligente:** Crea un API Test para probar que la ruta funciona (200 OK y 400 Bad Request). Solo agrega Unit Tests al servicio si agregaste lógica condicional o matemática compleja.