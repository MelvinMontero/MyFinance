# Cómo crear el APK standalone de MyFinance

Para usar la app sin necesidad del dev server (Metro) corriendo en tu PC, hay que generar un **APK** instalable directo en el teléfono. Usamos **EAS Build**, el servicio gratuito de Expo que compila la app en su cloud.

## Una sola vez: crear cuenta Expo

1. Andá a https://expo.dev/signup
2. Creá una cuenta gratis (con email + contraseña, o GitHub).
3. Verificá el email si te lo pide.

## Cada vez que querés un APK nuevo

### 1. Antes de empezar — respaldá tus datos

Si ya estuviste usando la app con datos reales (ingresos, gastos), exportá un respaldo:

- Abrí MyFinance en Expo Go.
- Ajustes → **Exportar respaldo** → guardalo en Google Drive, email o donde tengas acceso.

El APK standalone tiene su **propia base de datos vacía** (no se sincroniza con la que usaste en Expo Go). Si querés conservar tus datos, los tendrás que importar después de instalar.

### 2. Iniciar sesión en EAS

Abrí la terminal en la carpeta del proyecto y corré:

```powershell
npx eas login
```

Te va a pedir email y contraseña de tu cuenta Expo. Solo tenés que hacer esto una vez por máquina.

### 3. Lanzar el build

```powershell
npx eas build --platform android --profile preview
```

La primera vez te va a preguntar:
- **"Would you like to automatically create an EAS project?"** → **Yes**
- **"Generate a new Android Keystore?"** → **Yes** (EAS lo guarda en la cloud, no te preocupes por él).

Después arranca el build en el cloud. Te imprime un link como `https://expo.dev/accounts/<vos>/projects/myfinance/builds/<id>`.

### 4. Esperar el build

Tarda **10–20 minutos** dependiendo de la cola. Podés cerrar la terminal y revisar el link después — el build sigue en cloud.

Cuando termina, el link muestra un botón **"Install"** con un QR code y un link directo al APK.

### 5. Instalar el APK en el teléfono

**Opción A — escanear QR (más fácil):**
- Con la cámara del teléfono escaneá el QR del link.
- Se descarga el APK.
- Toques: "Open" → instalar.

**Opción B — descargar el APK al PC y transferirlo:**
- En el PC: click derecho en el botón "Install" → "Copy link" → descargá el .apk.
- Transferilo al teléfono (USB, Drive, email).
- En el teléfono: tocá el .apk → instalar.

**Si Android se queja:** "Install from unknown sources" — andá a Ajustes del sistema → Apps → tu navegador/explorador de archivos → permití "Install unknown apps". Volvé a tocar el APK.

### 6. Primera apertura

Al abrir el APK por primera vez vas a ver el **onboarding** otra vez (DB vacía). Después:

1. Andá a **Ajustes** → **Importar respaldo** → seleccioná el JSON que exportaste en el paso 1.
2. La app sobrescribe la DB con tus datos. Listo.

## Builds para distribuir (Play Store)

Si más adelante querés subirlo al Play Store:

```powershell
npx eas build --platform android --profile production
```

Esto genera un `.aab` (Android App Bundle, no APK) que se sube al Play Console. Esa es harina de otro costal — Expo tiene una guía: https://docs.expo.dev/submit/android/

## Re-builds tras hacer cambios

Después de cambiar código:

1. Bumpear `version` en `app.json` (ej. `0.8.2`).
2. Bumpear `android.versionCode` en `app.json` (ej. `2`). Tiene que SUBIR para que Android permita reinstalar encima.
3. `npx eas build --platform android --profile preview`.

## Trouble-shooting

- **"You don't have any available builds"**: el plan gratis de EAS tiene cola común. Esperá. O paguen plan ($29/mes) para cola prioritaria — no es necesario para uso personal.
- **"Could not find an entrypoint"**: revisá que `package.json` siga teniendo `"main": "expo-router/entry"`.
- **Build falla con error de Metro / Babel**: corré `npx tsc --noEmit` y `npm test` localmente antes para confirmar que el código está limpio.
