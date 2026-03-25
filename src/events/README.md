## Eventos no bloqueantes

Solo se debe crear un evento si hay más de un dominio interesado en saber que eso pasó, o si la acción secundaria (como enviar un mail) no debe bloquear la principal.

Para el dominio de `Auth`, `USER_REGISTERED` y `PASSWORD_RESET_REQUESTED` son literalmente los dos casos de uso de manual para usar eventos.