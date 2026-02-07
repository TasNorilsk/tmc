<?php
// config.php — проектный конфиг (не шаблон).
// Единственный источник настроек — .env. Никаких дефолтов.

$envPath = __DIR__ . '/.env';
if (!is_file($envPath)) {
    die('Config error: .env not found');
}

$ENV = [];
$lines = file($envPath, FILE_IGNORE_NEW_LINES);
foreach ($lines as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === '#') continue;

    $pos = strpos($line, '=');
    if ($pos === false) continue;

    $key = trim(substr($line, 0, $pos));
    $val = trim(substr($line, $pos + 1));

    // allow quoted values
    $len = strlen($val);
    if ($len >= 2) {
        $q1 = $val[0];
        $q2 = $val[$len - 1];
        if (($q1 === '"' && $q2 === '"') || ($q1 === "'" && $q2 === "'")) {
            $val = substr($val, 1, -1);
        }
    }

    $ENV[$key] = $val;
}

function env_required(string $key): string {
    global $ENV;
    if (!array_key_exists($key, $ENV)) {
        die('Config error: missing ENV key "' . $key . '"');
    }
    return $ENV[$key];
}

// ---- REQUIRED SETTINGS ----
$dbHost    = env_required('DB_HOST');
$dbName    = env_required('DB_NAME');
$dbUser    = env_required('DB_USER');
$dbPass    = env_required('DB_PASS');     // may be empty string, but must exist
$dbCharset = env_required('DB_CHARSET');

// project constants
$DEFAULT_LOGO = env_required('DEFAULT_LOGO');

// ---- CONNECT ----
$conn = new mysqli($dbHost, $dbUser, $dbPass, $dbName);
if ($conn->connect_error) {
    die('DB connection error');
}

if (!$conn->set_charset($dbCharset)) {
    die('DB charset error');
}
