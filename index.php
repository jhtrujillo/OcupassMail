<?php
// Redirigir a public/index.html si se entra a la raíz
if (file_exists(__DIR__ . '/public/index.html')) {
    header('Location: public/');
    exit;
} else {
    echo "<h1>Advantage Webmail</h1><p>Por favor compila el frontend para ver la interfaz.</p>";
}
