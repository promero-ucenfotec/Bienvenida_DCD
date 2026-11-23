# Pulso

Presentaciones en vivo para grupos grandes: diapositivas con actividades intercaladas que cada persona responde desde su dispositivo.

- **Quien presenta** entra con correo y contraseña, sube la presentación en PDF, intercala actividades y controla lo que ve el grupo. Varios administradores pueden editar y presentar la misma sesión a la vez.
- **Quien participa** entra con un código de seis dígitos y su nombre completo, sin crear cuenta.

## Actividades

| Tipo | Qué hace el grupo |
|---|---|
| Opción múltiple | Elige la respuesta correcta; suma puntos por acierto y rapidez |
| Encuesta | Vota sin respuesta correcta; las barras crecen en vivo |
| Respuesta abierta | Escribe palabras o ideas que forman una nube o un muro |
| Asocie | Arrastra cada elemento hasta dejarlo frente a su pareja |
| Completar la oración | Llena los espacios con un banco de palabras |
| Formar la oración | Ordena las palabras revueltas |
| Parejas | Juega memoria con tarjetas |
| Rana saltarina | Responde una serie de preguntas; la rana salta con cada acierto y tiene tres vidas |
| Sopa de letras | Encuentra las palabras escondidas en la cuadrícula |
| Palabra secreta | Ordena las letras revueltas a partir de una pista |

## Puntos, clasificación y registro

Cada actividad vale hasta 1000 puntos: la mitad depende del acierto y la otra mitad de la rapidez dentro del tiempo asignado. Al mostrar los resultados, cada participante ve su lugar en la tabla.

Quien participa puede repasar lo ya visto con las flechas inferiores y regresar con **Volver al en vivo**; una actividad nueva lo trae de vuelta sola.

El botón **Excel** de la sala, o **Descargar resultados** en la biblioteca, genera un archivo con una fila por participante: lugar, nombre, correo institucional, puntos, nota de 0 a 100, actividades respondidas y porcentaje de avance en la presentación. Una segunda hoja detalla los puntos por actividad.

El dominio de correo aceptado se cambia en `js/config.js` (`EMAIL_DOMAIN`).

## Probarla sin configurar nada

Mientras `js/config.js` esté vacío, Pulso corre en **modo demostración**: todo se guarda en el navegador y las salas funcionan entre pestañas del mismo equipo. La contraseña de administrador es `demo`.

```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
```

## Conectar al grupo con Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. Abrir **SQL Editor**, pegar el contenido de [`supabase/schema.sql`](supabase/schema.sql) y ejecutarlo. Crea las tablas, los permisos y el almacenamiento de diapositivas.
3. En **Authentication → Users**, crear un usuario con correo y contraseña por cada administrador. Luego, en la configuración de inicio de sesión, desactivar el registro de usuarios nuevos para que nadie más pueda crearse una cuenta.
4. En **Project Settings → API**, copiar la URL del proyecto y la clave `anon` en `js/config.js`.
5. En GitHub, activar **Settings → Pages** con la rama `main` y la carpeta raíz.

### Capacidad

El plan gratuito de Supabase admite 200 conexiones en vivo simultáneas. Pulso usa esa vía para sincronizar al instante y, si alguien queda fuera del cupo, su dispositivo consulta el estado de la sala cada dos o tres segundos, así que nadie se queda sin seguir la presentación. Para un evento de 200 personas o más conviene el plan Pro durante ese mes (500 conexiones), que además amplía la transferencia de imágenes.

## Subir la presentación

En PowerPoint: **Archivo → Guardar como → PDF**. Cada página se convierte en una diapositiva idéntica al original. También se aceptan imágenes sueltas.

## Estructura

```
index.html          página única
css/app.css         sistema visual
js/config.js        datos de conexión
js/store.js         datos: modo demostración y Supabase
js/activities.js    tipos de actividad
js/editor.js        editor de presentaciones
js/host.js          vista de quien presenta
js/play.js          vista de quien participa
js/report.js        exportación de resultados a Excel
supabase/schema.sql base de datos
vendor/             bibliotecas y tipografías incluidas
```
