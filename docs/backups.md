# Backups de producción

Todas las noches a las 03:00 (Argentina), GitHub Actions copia la base de
producción, la **cifra** y la sube a tu Google Drive, a la carpeta
**Backups Mantenimiento**:

- `diarios/`: un archivo por día, se guardan los últimos 30.
- `mensuales/`: el del día 1 de cada mes, no se borran nunca.

Producción **solo se lee**. El archivo sale de GitHub ya cifrado: sin la frase
de `CLAVE_BACKUP` no se puede abrir, ni desde Drive ni desde ningún lado.
El workflow es `.github/workflows/backup-produccion.yml`.

## Configurarlo (una sola vez)

Nada de esto se pega en un chat ni en un mail. Se hace en tu PC.

### 1. Conectar rclone con tu Google Drive

En PowerShell:

```powershell
winget install Rclone.Rclone
```

Cerrá y abrí PowerShell, y después:

```powershell
rclone config
```

Respondé así (lo demás, Enter):

| Pregunta | Respuesta |
|---|---|
| `n) New remote` | `n` |
| `name` | `drive` (tal cual, en minúscula) |
| `Storage` | el número de **Google Drive** |
| `client_id` / `client_secret` | Enter (vacío) |
| `scope` | el número de **drive.file** («Access to files created by rclone only»): rclone solo ve lo que él mismo sube, nada más de tu Drive |
| `Edit advanced config?` | `n` |
| `Use web browser to automatically authenticate?` | `y` → se abre el navegador, entrás con tu cuenta de Google y aceptás |
| `Configure this as a Shared Drive?` | `n` |
| `Keep this "drive" remote?` | `y`, y después `q` para salir |

Probalo: `rclone mkdir "drive:Backups Mantenimiento"`. La carpeta tiene que
aparecer en tu Drive.

### 2. Cargar los tres secretos en GitHub

Desde la carpeta `mantenimiento2-backend`, en PowerShell (necesitás `gh`,
que ya está instalado y logueado):

```powershell
# a) La configuración de rclone (el token de tu Drive):
Get-Content (rclone config file | Select-Object -Last 1) -Raw | gh secret set RCLONE_CONFIG

# b) La conexión directa a producción, leída de .env.produccion sin mostrarla:
node -e "process.stdout.write(require('dotenv').parse(require('fs').readFileSync('.env.produccion')).DIRECT_URL)" | gh secret set DIRECT_URL_PRODUCCION

# c) La frase para cifrar. gh te la pide y no se ve al escribirla:
gh secret set CLAVE_BACKUP
```

Para `CLAVE_BACKUP` elegí una frase larga (16 caracteres o más, por ejemplo
cuatro o cinco palabras sueltas). **Anotala en papel y guardala aparte**: si se
pierde, los backups no se pueden abrir, y no hay forma de recuperarla.

### 3. Probarlo

En GitHub → repo `mantenimiento2-backend` → **Actions** → **Backup de
producción** → **Run workflow**. En un par de minutos tiene que quedar en
verde y aparecer el archivo en `Backups Mantenimiento/diarios/`.

Si una noche falla, GitHub te manda un correo.

## Restaurar un backup

En la base **local** (el script se niega a tocar cualquier otra):

1. Bajá el `.dump.gpg` de Drive.
2. En `mantenimiento2-backend`:
   ```bash
   node scripts/restaurar-backup.mjs ruta/al/mantenimiento-AAAA-MM-DD.dump.gpg
   ```
   gpg te pide la frase de `CLAVE_BACKUP`.
3. Para confirmar que está entero, compará con producción:
   ```bash
   node -r dotenv/config scripts/contar-filas.mjs dotenv_config_path=.env
   node -r dotenv/config scripts/contar-filas.mjs dotenv_config_path=.env.produccion
   ```

Ensayo hecho el 2026-10-05: copia de producción, cifrado igual que en el
workflow, restaurada en local con este script → las 37 tablas idénticas a
producción.

Recuperar datos **en producción** a partir de un backup no se hace con este
script: es una operación a decidir caso por caso, primero ensayada en local.

## Lo que el backup no lleva

- `CLAVE_SECRETOS` (la clave del baúl de contraseñas) vive solo en Render. El
  backup tiene las contraseñas cifradas; sin esa clave no se pueden leer.
- Las fotos y los manuales en PDF están en Supabase Storage, no en la base.
