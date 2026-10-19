# Advantage Webmail (Estilo Gmail)

Cliente de correo web corporativo moderno, responsivo y amigable inspirado en **Gmail**, optimizado para conectarse a buzones de correo con **IMAP** y **SMTP** (configuración predeterminada para **DreamHost**).

Diseñado para funcionar localmente en **MAMP** y para desplegarse de manera transparente en **Hosting Compartido de DreamHost** (sin requerir servidores en segundo plano ni Docker).

---

## 🚀 Características
- **Interfaz estilo Gmail:** Barra de búsqueda, panel lateral colapsable, badges con conteo de no leídos, ventana flotante para "Redactar" con adjuntos.
- **Configuración DreamHost por defecto:**
  - **IMAP:** `imap.dreamhost.com` (Puerto 993 con SSL)
  - **POP3 (soportado):** `pop.dreamhost.com` (Puerto 995 con SSL)
  - **SMTP:** `smtp.dreamhost.com` (Puerto 587 con STARTTLS)
- **Operaciones completas:**
  - Lectura de buzones (`INBOX`, Enviados, Borradores, Papelera, Spam).
  - Paginación ágil y vista previa de mensajes.
  - Visor detallado con soporte para correos HTML, texto plano y descarga de adjuntos.
  - Marcado de leídos/no leídos, destacar correos con estrella y mover a papelera.
  - Redacción y envío con destinatarios múltiples (`Para`, `Cc`), asunto, cuerpo enriquecido y adjuntos.
- **Seguridad:** Credenciales cifradas en sesión PHP; no almacena contraseñas en texto plano.

---

## 📂 Estructura del Proyecto

```
22.advantagewebmail/
├── backend/
│   ├── api/                 # Endpoints REST en PHP
│   │   ├── bootstrap.php    # Middleware de cabeceras, CORS y sesión
│   │   ├── login.php        # Autenticación IMAP y control de sesión
│   │   ├── folders.php      # Lista de carpetas y conteo de no leídos
│   │   ├── messages.php     # Bandeja de entrada, paginación y búsqueda
│   │   ├── message.php      # Detalle, marcar leído/estrella/papelera
│   │   ├── send.php         # Despacho SMTP con PHPMailer
│   │   └── attachment.php   # Descarga de archivos adjuntos
│   ├── src/                 # Clases principales
│   │   ├── ImapClient.php   # Conexión IMAP nativa PHP
│   │   ├── SmtpClient.php   # Conexión SMTP PHPMailer
│   │   └── Session.php      # Manejo de sesiones
│   └── composer.json
├── frontend/                # Aplicación React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/      # Login, Header, Sidebar, MessageList, MessageDetail, ComposeModal
│   │   ├── services/api.js  # Cliente de API
│   │   └── App.jsx
│   └── vite.config.js
├── public/                  # Frontend compilado para producción
└── index.php                # Redirige a public/
```

---

## 🛠️ Ejecución Local con MAMP

El proyecto ya está enlazado a `htdocs` de MAMP en:
```
/Applications/MAMP/htdocs/22.advantagewebmail
```

1. Inicia **MAMP** (o MAMP PRO).
2. Asegúrate de que PHP 8.x esté seleccionado (la extensión `imap` viene habilitada por defecto en MAMP).
3. Abre en tu navegador:
   👉 **`http://localhost:8888/22.advantagewebmail/public/`** (o `http://localhost:8888/public/` si abriste el servidor local).

---

## 🌐 Despliegue en DreamHost (Hosting Compartido)

1. En el panel de DreamHost, crea un subdominio (ej: `webmail.tuempresa.com`).
2. Sube por **FTP / SFTP** o clona con Git el contenido de este repositorio en el directorio raíz web del subdominio en DreamHost.
3. Asegúrate de que la versión de PHP en el panel de DreamHost sea **PHP 8.1, 8.2 o superior**.
4. ¡Listo! Al ingresar a tu dominio verás el login para acceder con cualquier cuenta `@tuempresa.com`.
