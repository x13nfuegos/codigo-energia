# Código Energía

Medio digital automatizado sobre energía, oil & gas y minería (codigoenergia.ar).

- **Sitio público**: portada diagramable, cinta de cotizaciones (Brent, WTI, gas, oro, plata, cobre, litio, dólar, Merval, YPF…),
  widget "Redacción · en vivo", contadores en vivo (barriles de Vaca Muerta, gas inyectado, litio), secciones, nota, más leídas,
  buscador, mapa energético interactivo, resumen diario con audio y video, RSS y sitemap.
- **Scraping configurable**: fuentes RSS, búsquedas de Google News y páginas HTML con selectores CSS; filtros por palabras,
  sección fija o automática, publicación directa o como borrador, deduplicación por URL y por título.
- **Back office** (`/admin`): tablero, notas (publicar, ocultar, destacar, editar, nota propia, reescribir con IA), fuentes (probar y
  correr), diagramación de portada (orden, tipo de bloque, sección, cantidad), indicadores, puntos del mapa, resumen diario y ajustes
  (nombre, colores, secciones, frecuencias, línea editorial de la IA).
- **Resumen diario con IA**: Claude escribe el resumen de ayer con las notas publicadas (título, puntos clave, texto y guion);
  ElevenLabs genera la locución y HeyGen el video con avatar. También se puede pegar un video hecho a mano (mp4 o YouTube).

Stack: Next.js 15 (App Router) + Tailwind 4 + Supabase (Postgres y Storage) + Leaflet. Pensado para Vercel.

## Correr en local

```bash
git clone https://github.com/x13nfuegos/codigo-energia.git
cd codigo-energia
npm install
cp .env.example .env.local   # completar al menos ADMIN_PASSWORD, ADMIN_SECRET y CRON_SECRET
npm run dev                   # http://localhost:3100  ·  back office en /admin
```

Sin variables de Supabase los datos se guardan en `.data/db.json` (solo para desarrollo). La primera visita
dispara el scrapeo y la actualización de indicadores en segundo plano.

## Puesta en producción

1. **Supabase**: crear un proyecto, abrir *SQL Editor* y ejecutar `supabase/schema.sql` (crea las tablas y el bucket público `media`).
   Copiar `Project URL` y la `service_role key` (Settings → API).
2. **Vercel**: *Add New Project* → importar este repositorio (sin cambiar Root Directory). Cargar las variables de
   `.env.example` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_SECRET`, `CRON_SECRET`,
   `NEXT_PUBLIC_SITE_URL=https://codigoenergia.ar` y, para el resumen, `ANTHROPIC_API_KEY`, `ELEVENLABS_*`, `HEYGEN_*`). Deploy.
   La primera carga llena la base con la configuración inicial (fuentes, indicadores, portada y mapa).
3. **Dominio**: en Vercel → Settings → Domains agregar `codigoenergia.ar` y `www.codigoenergia.ar`. En el proveedor del dominio
   (NIC Argentina delega a los DNS que uses, por ejemplo Cloudflare o el de tu hosting) crear:
   - `A  @  76.76.21.21`
   - `CNAME  www  cname.vercel-dns.com`

   (o usar los nameservers de Vercel). Vercel emite el certificado HTTPS solo.

### Tareas programadas

`vercel.json` define dos cron diarios (compatibles con el plan Hobby): `/api/cron/all` a las 7:00 (Argentina), que actualiza
indicadores, scrapea y genera el resumen, y `/api/cron/scrape` a las 19:00. Además, cada visita revisa si pasó el intervalo
configurado en Ajustes y actualiza en segundo plano. Para scrapear más seguido:

- plan Pro de Vercel: cambiar los `schedule` (ej. `*/30 * * * *`), o
- un programador externo (cron-job.org, GitHub Actions) llamando a `https://codigoenergia.ar/api/cron/scrape?key=CRON_SECRET`.

Tareas: `scrape`, `indicators`, `daily` (`?force=1` para regenerar), `videos` (revisa renders de HeyGen) y `all`.

## El mapa de la energía

- **Noticias geolocalizadas**: cada nota se ubica sola según los lugares que menciona (yacimientos, ciudades, proyectos
  mineros, provincias, países vecinos y los puntos cargados en el mapa). Se puede corregir a mano desde la edición de la nota.
  En el mapa se filtran por período (24 h, 7 y 30 días) y cada nota tiene un link "Ver en el mapa".
- **Capas oficiales**: el mapa suma capas WMS del SIG de la Secretaría de Energía (`https://sig.energia.gob.ar/wmsenergia`).
  En Back office → Mapa → "Explorar capas oficiales" se listan todas las capas del servicio y se agregan con un clic.
- **Infraestructura**: puntos propios (yacimientos, refinerías, centrales, minas, litio, puertos) editables.

## Datos oficiales y fuentes

Cada dato muestra su fuente en el sitio (y en `/indicadores` hay una tabla con todas):

| Dato | Fuente |
|---|---|
| Petróleo, gas y pozos en producción de Vaca Muerta | Secretaría de Energía — Capítulo IV, producción no convencional (`datos.energia.gob.ar`), revisado dos veces por día |
| Dólar mayorista | BCRA, Comunicación A 3500 (respaldo: DolarAPI) |
| Dólar oficial, blue, MEP, CCL | DolarAPI (Banco Nación / mercado) |
| WTI, Brent, Henry Hub, oro, plata, cobre, acciones | Yahoo Finance (NYMEX, ICE, COMEX, NYSE, BYMA), con Stooq de respaldo |

Los contadores de producción suman el dato **oficial** del año hasta el último mes publicado y, desde ahí, estiman en vivo al
ritmo diario de ese mes (lo aclaran debajo). Si hace falta, **Indicadores → Restaurar contadores oficiales** los vuelve a cargar.

## Imágenes

Las notas de Google News se decodifican para llegar al medio original y tomar su foto y bajada. Si un medio bloquea la carga
directa de imágenes, se sirven a través de `/api/img` (proxy con caché en la CDN).

## App instalable (PWA)

El sitio se puede instalar en el celular ("Agregar a pantalla de inicio"): tiene manifiesto, íconos con los colores de la
variante activa y service worker que guarda las últimas notas para leer sin conexión.

## Mapa

Base CARTO/OpenStreetMap sin configurar nada. Para un mapa base más prolijo, cargá `NEXT_PUBLIC_MAPBOX_TOKEN` con un token
público de Mapbox y volvé a desplegar.

## Notas

- Las notas scrapeadas muestran título, bajada e imagen y enlazan al medio original. Con "Reescribir con IA" se genera un copete
  y un cuerpo propios que citan la fuente.
- Las cotizaciones vienen de Yahoo Finance y DolarAPI (servicios gratuitos y no oficiales). Se puede sumar cualquier API JSON
  desde el back office.
- Las coordenadas del mapa son aproximadas y editables.
