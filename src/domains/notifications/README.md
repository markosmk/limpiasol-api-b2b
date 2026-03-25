# Dominio: Notifications

Actúa como el orquestador principal (el "pegamento") entre los eventos de negocio del e-commerce y la infraestructura de envío de correos.

## Concepto Clave
Los módulos de infraestructura (ej. `EmailModule`) **no saben nada** de nuestro negocio. No saben qué es un "Usuario" ni una "Orden". 
Este dominio se encarga de:
1. Recibir los objetos de dominio (`OrderNotification`).
2. Leer las preferencias de la base de datos (Ej: ¿El admin quiere recibir correos de nuevas órdenes?).
3. Traducir esos datos a variables planas (`templateParams`) y pasárselas al módulo correspondiente.

> **Nota:** Todos los envíos se deben envolver en bloques `try/catch` para que la caída de un proveedor externo no bloquee el flujo principal de la aplicación.