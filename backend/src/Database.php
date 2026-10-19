<?php
namespace Advantage;

use PDO;
use PDOException;

class Database {
    private static array $instances = [];

    /**
     * Obtiene la conexión PDO SQLite dedicada para el buzón del usuario actual.
     * Cada cuenta de correo tiene su propio archivo .sqlite aislado.
     *
     * @param string|null $email Opcional si ya está en sesión
     * @return PDO|null
     */
    public static function getConnection(?string $email = null): ?PDO {
        // Determinar el email de la cuenta activa
        if (!$email) {
            $email = $_SESSION['mail_account']['email'] ?? ($_SESSION['account']['email'] ?? null);
        }

        if (!$email) {
            return null;
        }

        // Normalizar nombre de archivo seguro para el correo (ej: gerencia_gytc_com_co.sqlite)
        $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', strtolower($email));

        if (isset(self::$instances[$safeName])) {
            return self::$instances[$safeName];
        }

        // Carpeta privada para almacenar las bases de datos SQLite
        $dataDir = Security::dataDir();

        $dbFile = $dataDir . '/' . $safeName . '.sqlite';

        try {
            $pdo = new PDO("sqlite:" . $dbFile, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 5,
            ]);

            // Optimizaciones SQLite recomendadas para máxima velocidad y concurrencia
            $pdo->exec("PRAGMA journal_mode = WAL;");
            $pdo->exec("PRAGMA synchronous = NORMAL;");
            $pdo->exec("PRAGMA foreign_keys = ON;");

            // Tabla de correos indexada por buzón
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS emails_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    folder TEXT NOT NULL,
                    uid INTEGER NOT NULL,
                    msg_no INTEGER NOT NULL,
                    message_id TEXT NULL,
                    in_reply_to TEXT NULL,
                    email_references TEXT NULL,
                    from_name TEXT NULL,
                    from_email TEXT NULL,
                    subject TEXT NULL,
                    clean_subject TEXT NULL,
                    snippet TEXT NULL,
                    body_html TEXT NULL,
                    body_plain TEXT NULL,
                    attachments_json TEXT NULL,
                    date DATETIME NULL,
                    is_unseen INTEGER DEFAULT 0,
                    is_flagged INTEGER DEFAULT 0,
                    has_attachments INTEGER DEFAULT 0,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (folder, uid)
                );
                CREATE INDEX IF NOT EXISTS idx_folder_date ON emails_cache (folder, date DESC);
                CREATE INDEX IF NOT EXISTS idx_clean_subj ON emails_cache (folder, clean_subject);
                CREATE INDEX IF NOT EXISTS idx_clean_subj_rev ON emails_cache (clean_subject, folder);
                CREATE INDEX IF NOT EXISTS idx_status ON emails_cache (folder, is_unseen, is_flagged);
            ");

            // Tabla de contactos corporativos del buzón
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS contacts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    phone TEXT NULL,
                    company TEXT NULL,
                    notes TEXT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            ");

            // Tabla de etiquetas personalizadas y asignación a correos/conversaciones
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS labels (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    color TEXT NOT NULL DEFAULT '#3b82f6',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS email_labels (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    clean_subject TEXT NOT NULL,
                    label_id INTEGER NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(clean_subject, label_id),
                    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_email_labels_subj ON email_labels(clean_subject);
                CREATE INDEX IF NOT EXISTS idx_email_labels_label ON email_labels(label_id);
            ");

            // Sembrar etiquetas por defecto si está vacía
            $chkLabels = $pdo->query("SELECT COUNT(*) FROM labels")->fetchColumn();
            if ((int)$chkLabels === 0) {
                $seedStmt = $pdo->prepare("INSERT INTO labels (name, color) VALUES (?, ?)");
                $seedStmt->execute(['Urgente', '#ef4444']);       // Rojo
                $seedStmt->execute(['Cotización', '#f59e0b']);    // Ámbar
                $seedStmt->execute(['Cliente VIP', '#8b5cf6']);   // Púrpura
                $seedStmt->execute(['Seguimiento', '#3b82f6']);   // Azul
                $seedStmt->execute(['Pagado', '#10b981']);        // Esmeralda
            }

            // Tablas de Auditoría y Retención Inmutable de Correos y Adjuntos Borrados
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS deleted_emails_archive (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_folder TEXT NOT NULL,
                    uid INTEGER NOT NULL,
                    msg_no INTEGER NULL,
                    message_id TEXT NULL,
                    in_reply_to TEXT NULL,
                    email_references TEXT NULL,
                    from_name TEXT NULL,
                    from_email TEXT NULL,
                    to_recipients TEXT NULL,
                    cc_recipients TEXT NULL,
                    subject TEXT NULL,
                    clean_subject TEXT NULL,
                    snippet TEXT NULL,
                    body_html TEXT NULL,
                    body_plain TEXT NULL,
                    attachments_meta TEXT NULL,
                    date DATETIME NULL,
                    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    deletion_type TEXT DEFAULT 'trash',
                    ip_address TEXT NULL,
                    user_agent TEXT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_archive_date ON deleted_emails_archive (deleted_at DESC);
                CREATE INDEX IF NOT EXISTS idx_archive_from ON deleted_emails_archive (from_email);

                CREATE TABLE IF NOT EXISTS deleted_attachments_archive (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    archive_id INTEGER NOT NULL,
                    filename TEXT NOT NULL,
                    filesize INTEGER DEFAULT 0,
                    mime_type TEXT NULL,
                    file_data BLOB NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (archive_id) REFERENCES deleted_emails_archive(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_archive_att ON deleted_attachments_archive (archive_id);
            ");

            self::$instances[$safeName] = $pdo;
            return $pdo;
        } catch (PDOException $e) {
            error_log("Fallo al inicializar base de datos SQLite para {$safeName}: " . $e->getMessage());
            return null;
        }
    }
}
