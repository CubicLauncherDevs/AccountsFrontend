# CubicLauncher Accounts

Panel de cuentas para **accounts.cubiclauncher.org**, construido con el scaffold de
Vue + Pinia + Vue Router, Vite y Bun. La API sigue en Cloudflare Workers:
`https://auth.cubiclauncher.org`. Supabase Auth gestiona las cuentas; CubAuth gestiona
los perfiles, sesiones Yggdrasil y skins.

## Funcionalidades

- Registro e inicio de sesión por correo o nombre de Minecraft.
- Sesión por pestaña en `sessionStorage`; se valida al recargar y se revoca al salir.
- Detalles de cuenta con nombre, UUID permanente, correo y fecha de creación.
- Cambio de nombre, correo y contraseña con confirmación de la contraseña actual.
- Historial de nombres vinculado al UUID.
- Reenvío de la verificación desde el login o el registro, antes de iniciar sesión.
- Login con estados diferenciados para cuenta suspendida y correo sin confirmar;
  ofrece contacto con el equipo o reenvío de verificación según corresponda.
- Editor de skins con **skin3d 0.2.0**, carga diferida y WebGL real.
- Previsualización local del archivo, clásico/slim, zoom, giro, animaciones,
  pausa, segunda capa y restablecimiento de cámara.
- PNG 64×64 y 64×32, hasta 128 KiB; validación definitiva en el Worker.
- Subir, cambiar modelo, descartar y quitar skins. Las skins 64×32 usan clásico.
- Vista 2D alternativa cuando WebGL no está disponible.
- Temas claro, oscuro y sistema con la identidad visual de cubiclauncher.com.
- Transiciones direccionales entre entrar y crear cuenta; resize animado de las
  cards y modal de confirmación con foco nativo, Escape y restauración de foco.
- Contraseña y confirmación agrupadas, con un único control de visibilidad.
- Los fallos de conexión aparecen como texto temporal en la esquina superior derecha.

Los recursos visuales (logo, fuente BIZ UDP Gothic y fondo de Minecraft) provienen
de la web de CubicLauncher. Los tiempos de animación siguen el launcher: fondo
150 ms, modal 250 ms, tamaño 300 ms, curva `cubic-bezier(0.25, 0.8, 0.25, 1)`.
Se respeta `prefers-reduced-motion` y se pausa el render al ocultar el visor/pestaña.

## Desarrollo

Requisitos: Bun y Node compatibles con `package.json` (Node 24 recomendado).

```bash
bun install --frozen-lockfile
bun dev
```

Abrí `http://localhost:5173`. El cliente usa `/api` y Vite lo reenvía al Worker,
evitando CORS durante el desarrollo. El proxy elimina el encabezado `Origin`
local de esa petición servidor-a-servidor y conserva el Bearer token para las
operaciones protegidas. Solo existe en el servidor de desarrollo de Vite.

Por defecto apunta a `https://auth.cubiclauncher.org`. Para cambiarlo, creá `.env.local`:

```dotenv
VITE_AUTH_API_URL=http://localhost:8787
```

Ese ejemplo conecta con un Worker local. `.env.example` incluye la URL de producción.
Reiniciá `bun dev` después de cambiar variables de entorno.

El proveedor para el launcher sigue siendo `https://auth.cubiclauncher.org`, no `/api`.
Las cuentas creadas al usar la API de producción son cuentas reales de ese proyecto.

## Despliegue en Vercel

Importá **CubicLauncherDevs/AccountsFrontend** y configurá:

| Campo | Valor |
| --- | --- |
| Framework | Vite |
| Root Directory | Raíz del repositorio |
| Install Command | `bun install --frozen-lockfile` |
| Build Command | `bun run build` |
| Output Directory | `dist` |
| Node.js | 24.x |
| Dominio | `accounts.cubiclauncher.org` |

Variable de entorno pública:

```dotenv
VITE_AUTH_API_URL=https://auth.cubiclauncher.org
```

Esta variable se incorpora en el build: cambiarla requiere un nuevo despliegue.
No se necesitan claves de Supabase ni claves de firma en Vercel. Las variables
`VITE_*` son visibles para el navegador.

`vercel.json` configura el fallback de Vue Router y los encabezados de seguridad.
Si cambiás el dominio de la API o del bucket, actualizá también `connect-src` e
`img-src` en su Content Security Policy.

Añadí el dominio en Vercel y configurá el DNS que Vercel indique. El dominio
`auth.cubiclauncher.org` sigue apuntando al Worker.

### Cambios necesarios en CubAuth

El proyecto `/tmp/cubauth` incorpora el soporte de este frontend. Para una instalación
existente, ejecutá **solo la migración nueva** en el SQL Editor de Supabase:

```text
/tmp/cubauth/supabase/migrations/202609200002_account_settings.sql
```

En una instalación desde cero, ejecutá primero `202609200001_cubauth.sql` y después
`202609200002_account_settings.sql`. Desplegá luego el Worker con:

```bash
cd /tmp/cubauth
npm run deploy
```

Su `wrangler.jsonc` contiene:

```json
{
  "PUBLIC_URL": "https://auth.cubiclauncher.org",
  "ACCOUNT_URL": "https://accounts.cubiclauncher.org",
  "WEB_ORIGINS": "https://accounts.cubiclauncher.org"
}
```

- `ACCOUNT_URL` actualiza los enlaces de registro, confirmación y cuenta.
- El antiguo `GET /account` del Worker redirige al panel Vue.
- `WEB_ORIGINS` es una lista separada por comas de orígenes exactos, sin barra final.
  El Worker admite preflights para JSON y Bearer, y devuelve CORS también en errores.
- En producción el navegador llama directamente al Worker. Esto conserva la IP
  real del visitante para los límites; no hay un proxy compartido en Vercel.
- Para probar una URL de preview de Vercel, agregala explícitamente a `WEB_ORIGINS`.
  No habilites todos los dominios `*.vercel.app`.

En Supabase, **Authentication → URL Configuration**:

```text
Site URL: https://accounts.cubiclauncher.org/login
Redirect URL: https://accounts.cubiclauncher.org/login
Redirect URL: https://accounts.cubiclauncher.org/account
```

Si `Confirm email` está desactivado, el registro permite entrar de inmediato. Si
está activado, el panel indica que hay que revisar el correo. Los tokens del
fragmento de confirmación se descartan: la sesión del panel se obtiene al iniciar
sesión con CubAuth.

### Cambios de cuenta y verificación

- Correo y contraseña se cambian usando Supabase Auth con una sesión temporal del
  usuario, validada por su contraseña actual. El navegador no recibe esa sesión de Supabase.
- El cambio de correo respeta **Secure email change**. Si Supabase pide confirmar
  ambas direcciones, el panel conserva el correo actual y muestra el nuevo como pendiente.
- El cambio de contraseña revoca los tokens Yggdrasil anteriores y entrega uno nuevo
  únicamente a la pestaña que realizó el cambio.
- Cambiar el nombre conserva UUID y skin, registra el nombre anterior y exige que
  los launchers renueven sus tokens para obtener el nuevo nombre. Los nombres antiguos
  no se convierten en alias de login. El historial empieza con los cambios realizados
  después de instalar esta migración; el panel muestra los últimos 20.
- El estado de correo confirmado viene de `email_confirmed_at` en Supabase. Para
  exigir una verificación real por enlace, activá **Confirm email** y configurá SMTP.
  Desactivar esa opción hace que Supabase confirme automáticamente las cuentas nuevas.
- El reenvío usa Supabase `/resend` con respuesta genérica y límites por IP/dirección.
  No marca direcciones como verificadas sin pasar por Supabase.

Mantené la excepción de **Browser Integrity Check** para `auth.cubiclauncher.org`
que permite a Minecraft/Java consultar perfiles.

## Pruebas y calidad

```bash
bun run build
bun run test:unit --run
bunx oxlint .
bunx eslint .
```

Para las pruebas de navegador:

```bash
bunx playwright install chromium
bun run test:e2e
```

También se puede usar Chromium instalado en el sistema:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium bun run test:e2e
```

Playwright prueba el build de producción en escritorio y móvil. La API está
simulada y los PNG de prueba se generan localmente: no crea cuentas ni modifica
skins en Supabase. Incluye un visor WebGL real y el caso sin WebGL, rutas
protegidas, registro, sesión restaurada, controles, guardado, borrado y foco del modal.
Las capturas y trazas quedan en `test-results/` y no se versionan.

## Estructura

```text
src/
  components/   Logo, controles, modal y visor 3D
  lib/          Cliente de API, validación PNG y animaciones
  stores/       Sesión, tema y avisos de conexión
  views/        Login/registro, resumen y editor de skins
  router/       Rutas y protección de las páginas de cuenta
  assets/       Paletas y estilos compartidos
public/         Fuente, fondo, favicon e inicialización del tema
e2e/            Pruebas de escritorio y móvil
```

El estado de autenticación no se comparte entre dominios ni se guarda en
`localStorage`. El tema sí se recuerda localmente. El visor soporta capas, pero
la API actual permite guardar skins; no se muestran controles de capas que aún
no tengan soporte de almacenamiento.
