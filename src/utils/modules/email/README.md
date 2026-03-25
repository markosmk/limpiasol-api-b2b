# Módulo: Email

Módulo de infraestructura dinámico para el envío de correos. Soporta configuración en caliente (Just-In-Time) leída desde la base de datos.

## Lógica de Cascada (Fallback)
Cuando se solicita el envío de un correo transaccional, el módulo resuelve el contenido en este orden:
1. **Template ID (Brevo/Externo):** Si hay un ID de plantilla configurado, delega la renderización al proveedor externo.
2. **HTML Custom:** Si hay un string HTML configurado en la BD, lo renderiza usando el compilador interno (`{{ variable }}`).
3. **Fallback Interno:** Si no hay nada configurado, usa las plantillas quemadas en código por defecto.

## Cómo agregar un nuevo Adapter (Ej. Resend)
1. Crea un archivo en `/adapters/resend.adapter.ts`.
2. Implementa la interfaz `EmailProvider`.
3. Modifica `email.module.service.ts` para agregarlo al condicional de ruteo.
4. Asegúrate de nunca guardar la `apiKey` en el constructor del adapter para respetar la inyección dinámica JIT.