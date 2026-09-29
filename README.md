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
2. **Vercel**: *Add New Project* → importar este repositorio → **Root Directory: `codigo-energia`**. Cargar las variables de
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

## Contadores en vivo

Los contadores (barriles, gas, litio) muestran *valor inicial + ritmo diario × días transcurridos* desde la fecha configurada.
Vienen con el ritmo que se ve hoy en el sitio; conviene actualizarlo en **Indicadores** cuando la Secretaría de Energía publica
los datos de producción (datos.energia.gob.ar).

## Notas

- Las notas scrapeadas muestran título, bajada e imagen y enlazan al medio original. Con "Reescribir con IA" se genera un copete
  y un cuerpo propios que citan la fuente.
- Las cotizaciones vienen de Yahoo Finance y DolarAPI (servicios gratuitos y no oficiales). Se puede sumar cualquier API JSON
  desde el back office.
- Las coordenadas del mapa son aproximadas y editables.
