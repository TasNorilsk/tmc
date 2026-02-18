<?php
ini_set('display_errors', 0);
error_reporting(0);

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/config.php';

$conn->set_charset('utf8mb4');

function respond($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function post($key, $default = null) {
    return isset($_POST[$key]) ? $_POST[$key] : $default;
}

function ensure_dir($dir): void
{
    if (!is_dir($dir)) @mkdir($dir, 0777, true);
}

function safe_int($v, $default = 0) {
    if ($v === null || $v === '') return $default;
    if (!is_numeric($v)) return $default;
    return (int)$v;
}

function safe_str($v, $maxLen = 255): string
{
    $v = is_string($v) ? trim($v) : '';
    if ($v === '') return '';
    if (mb_strlen($v, 'UTF-8') > $maxLen) $v = mb_substr($v, 0, $maxLen, 'UTF-8');
    return $v;
}

function process_logo_upload($fileTmp, $destPath): bool
{
    $info = @getimagesize($fileTmp);
    if (!$info) return false;

    $mime = $info['mime'] ?? '';
    switch ($mime) {
        case 'image/jpeg': $src = @imagecreatefromjpeg($fileTmp); break;
        case 'image/png':  $src = @imagecreatefrompng($fileTmp); break;
        case 'image/gif':  $src = @imagecreatefromgif($fileTmp); break;
        case 'image/webp': $src = function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($fileTmp) : false; break;
        default: $src = false;
    }
    if (!$src) return false;

    $srcW = imagesx($src);
    $srcH = imagesy($src);
    if ($srcW <= 0 || $srcH <= 0) { imagedestroy($src); return false; }

    $dstSize = 100;
    $dst = imagecreatetruecolor($dstSize, $dstSize);
    imagesavealpha($dst, true);
    $transparent = imagecolorallocatealpha($dst, 0, 0, 0, 127);
    imagefill($dst, 0, 0, $transparent);

    $scale = min($dstSize / $srcW, $dstSize / $srcH);
    $newW = (int)floor($srcW * $scale);
    $newH = (int)floor($srcH * $scale);
    $dstX = (int)floor(($dstSize - $newW) / 2);
    $dstY = (int)floor(($dstSize - $newH) / 2);

    imagecopyresampled($dst, $src, $dstX, $dstY, 0, 0, $newW, $newH, $srcW, $srcH);

    $ok = @imagepng($dst, $destPath);
    imagedestroy($src);
    imagedestroy($dst);
    return $ok;
}

$DEFAULT_LOGO = 'logos/noname.png';

$action = post('action', '');

if ($action === 'list') {
    $sql = "SELECT i.*,
                   c.name AS category_name,
                   m.name AS manufacturer_name,
                   COALESCE(NULLIF(m.logo_path,''), '$DEFAULT_LOGO') AS logo_path
            FROM items i
            LEFT JOIN categories c ON i.category_id = c.id
            LEFT JOIN manufacturers m ON i.manufacturer_id = m.id
            ORDER BY c.name ASC, i.name ASC, i.tth1 ASC, i.tth2 ASC, i.id DESC";
    $result = $conn->query($sql);
    $items = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) $items[] = $row;
    }
    respond($items);
}

if ($action === 'categories_list') {
    $categories = [];
    $res = $conn->query("SELECT id, name FROM categories ORDER BY name");
    if ($res) while ($row = $res->fetch_assoc()) $categories[] = $row;
    respond($categories);
}

if ($action === 'manufacturers_list') {
    $manufacturers = [];
    $res = $conn->query("SELECT id, name, COALESCE(NULLIF(logo_path,''), '$DEFAULT_LOGO') AS logo_path FROM manufacturers ORDER BY name");
    if ($res) while ($row = $res->fetch_assoc()) $manufacturers[] = $row;
    respond($manufacturers);
}

if ($action === 'pre_add') {
    $name = safe_str(post('name', ''), 150);
    $tth1 = safe_str(post('tth1', ''), 100);

    $duplicates = [];
    $stmt = $conn->prepare("SELECT id, name, tth1, tth2, qty FROM items WHERE name = ? AND tth1 = ? ORDER BY id DESC");
    if ($stmt) {
        $stmt->bind_param("ss", $name, $tth1);
        if ($stmt->execute()) {
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) $duplicates[] = $row;
        }
        $stmt->close();
    }

    $categories = [];
    $res = $conn->query("SELECT id, name FROM categories ORDER BY name");
    if ($res) while ($row = $res->fetch_assoc()) $categories[] = $row;

    $manufacturers = [];
    $res = $conn->query("SELECT id, name, COALESCE(NULLIF(logo_path,''), '$DEFAULT_LOGO') AS logo_path FROM manufacturers ORDER BY name");
    if ($res) while ($row = $res->fetch_assoc()) $manufacturers[] = $row;

    respond(['duplicates' => $duplicates, 'categories' => $categories, 'manufacturers' => $manufacturers]);
}

if ($action === 'find_duplicate') {
    $name = safe_str(post('name', ''), 150);
    $tth1 = safe_str(post('tth1', ''), 100);
    $tth2 = safe_str(post('tth2', ''), 100);
    $category_id = safe_int(post('category_id', 0), 0);
    $manufacturer_id = safe_int(post('manufacturer_id', 0), 0);

    if ($name === '' || $tth1 === '' || $category_id <= 0 || $manufacturer_id <= 0) {
        respond(['error' => 'invalid'], 400);
    }

    $duplicates = [];
    $stmt = $conn->prepare("SELECT id, name, tth1, tth2, qty FROM items WHERE name = ? AND tth1 = ? AND tth2 = ? AND category_id = ? AND manufacturer_id = ? ORDER BY id DESC");
    if ($stmt) {
        $stmt->bind_param("sssii", $name, $tth1, $tth2, $category_id, $manufacturer_id);
        if ($stmt->execute()) {
            $res = $stmt->get_result();
            while ($row = $res->fetch_assoc()) $duplicates[] = $row;
        }
        $stmt->close();
    }

    respond(['duplicates' => $duplicates]);
}

if ($action === 'add') {
    $name = safe_str(post('name', ''), 150);
    $tth1 = safe_str(post('tth1', ''), 100);
    $tth2 = safe_str(post('tth2', ''), 100);
    $qty = safe_int(post('qty', 1), 1);
    $category_id = safe_int(post('category_id', 0), 0);
    $manufacturer_id = safe_int(post('manufacturer_id', 0), 0);

    if ($name === '' || $tth1 === '' || $category_id <= 0 || $manufacturer_id <= 0) {
        respond(['error' => 'invalid'], 400);
    }

    $stmt = $conn->prepare("INSERT INTO items (name, tth1, tth2, qty, category_id, manufacturer_id) VALUES (?, ?, ?, ?, ?, ?)");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("sssiii", $name, $tth1, $tth2, $qty, $category_id, $manufacturer_id);
    $ok = $stmt->execute();
    $stmt->close();
    if (!$ok) respond(['error' => 'db'], 500);
    respond(['success' => true]);
}

if ($action === 'add_category') {
    $name = safe_str(post('name', ''), 100);
    if ($name === '') respond(['error' => 'invalid'], 400);

    $stmt = $conn->prepare("INSERT INTO categories (name) VALUES (?)");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("s", $name);
    if ($stmt->execute()) {
        $id = $conn->insert_id;
        $stmt->close();
        respond(['id' => $id]);
    }
    $stmt->close();

    $stmt = $conn->prepare("SELECT id FROM categories WHERE name = ? LIMIT 1");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("s", $name);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if ($row) respond(['id' => (int)$row['id'], 'exists' => true]);

    respond(['error' => 'db'], 500);
}

if ($action === 'category_update') {
    $id = safe_int(post('id', 0), 0);
    $name = safe_str(post('name', ''), 100);
    if ($id <= 0 || $name === '') respond(['error' => 'invalid'], 400);

    $stmt = $conn->prepare("UPDATE categories SET name = ? WHERE id = ?");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("si", $name, $id);
    $ok = $stmt->execute();
    $stmt->close();
    if (!$ok) respond(['error' => 'db'], 500);

    respond(['success' => true]);
}

if ($action === 'category_delete') {
    $id = safe_int(post('id', 0), 0);
    if ($id <= 0) respond(['error' => 'invalid'], 400);

    // check in use
    $stmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM items WHERE category_id = ?");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (($row['cnt'] ?? 0) > 0) respond(['error' => 'in_use'], 400);

    $stmt = $conn->prepare("DELETE FROM categories WHERE id = ?");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("i", $id);
    $ok = $stmt->execute();
    $stmt->close();
    if (!$ok) respond(['error' => 'db'], 500);

    respond(['success' => true]);
}

if ($action === 'manufacturer_upsert') {
    $id = safe_int(post('id', 0), 0);
    $name = safe_str(post('name', ''), 100);
    if ($name === '') respond(['error' => 'invalid'], 400);

    if ($id > 0) {
        $stmt = $conn->prepare("UPDATE manufacturers SET name = ? WHERE id = ?");
        if (!$stmt) respond(['error' => 'db'], 500);
        $stmt->bind_param("si", $name, $id);
        $ok = $stmt->execute();
        $stmt->close();
        if (!$ok) respond(['error' => 'db'], 500);
        respond(['id' => $id, 'updated' => true]);
    }

    $logo_path = $DEFAULT_LOGO;
    $stmt = $conn->prepare("INSERT INTO manufacturers (name, logo_path) VALUES (?, ?)");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("ss", $name, $logo_path);
    $ok = $stmt->execute();
    $newId = $conn->insert_id;
    $stmt->close();
    if (!$ok || $newId <= 0) respond(['error' => 'db'], 500);

    if (isset($_FILES['logo']) && $_FILES['logo']['error'] === 0) {
        ensure_dir(__DIR__ . '/logos');
        $relPath = 'logos/m_' . $newId . '_' . time() . '.png';
        $absPath = __DIR__ . '/' . $relPath;
        $okLogo = process_logo_upload($_FILES['logo']['tmp_name'], $absPath);
        if ($okLogo) {
            $stmt = $conn->prepare("UPDATE manufacturers SET logo_path = ? WHERE id = ?");
            if ($stmt) {
                $stmt->bind_param("si", $relPath, $newId);
                $stmt->execute();
                $stmt->close();
            }
        }
    }

    respond(['id' => $newId]);
}

if ($action === 'manufacturer_update') {
    $id = safe_int(post('id', 0), 0);
    $name = safe_str(post('name', ''), 100);
    if ($id <= 0 || $name === '') respond(['error' => 'invalid'], 400);

    $stmt = $conn->prepare("UPDATE manufacturers SET name = ? WHERE id = ?");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("si", $name, $id);
    $ok = $stmt->execute();
    $stmt->close();
    if (!$ok) respond(['error' => 'db'], 500);

    respond(['success' => true]);
}

if ($action === 'manufacturer_delete') {
    $id = safe_int(post('id', 0), 0);
    if ($id <= 0) respond(['error' => 'invalid'], 400);

    // check in use
    $stmt = $conn->prepare("SELECT COUNT(*) AS cnt FROM items WHERE manufacturer_id = ?");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (($row['cnt'] ?? 0) > 0) respond(['error' => 'in_use'], 400);

    // delete logo file if not default
    $oldPath = null;
    $stmt = $conn->prepare("SELECT logo_path FROM manufacturers WHERE id = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $r = $res ? $res->fetch_assoc() : null;
        $oldPath = $r['logo_path'] ?? null;
        $stmt->close();
    }

    $stmt = $conn->prepare("DELETE FROM manufacturers WHERE id = ?");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("i", $id);
    $ok = $stmt->execute();
    $stmt->close();
    if (!$ok) respond(['error' => 'db'], 500);

    if ($oldPath && $oldPath !== $DEFAULT_LOGO && strpos($oldPath, 'logos/') === 0) {
        $absOld = __DIR__ . '/' . $oldPath;
        if (is_file($absOld)) @unlink($absOld);
    }

    respond(['success' => true]);
}

if ($action === 'manufacturer_set_logo') {
    $id = safe_int(post('id', 0), 0);
    if ($id <= 0) respond(['error' => 'invalid'], 400);
    if (!isset($_FILES['logo']) || $_FILES['logo']['error'] !== 0) respond(['error' => 'no_file'], 400);

    $oldPath = null;
    $stmt = $conn->prepare("SELECT logo_path FROM manufacturers WHERE id = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $oldPath = $row['logo_path'] ?? null;
        $stmt->close();
    }

    ensure_dir(__DIR__ . '/logos');
    $relPath = 'logos/m_' . $id . '_' . time() . '.png';
    $absPath = __DIR__ . '/' . $relPath;

    if (!process_logo_upload($_FILES['logo']['tmp_name'], $absPath)) {
        respond(['error' => 'bad_image'], 400);
    }

    $stmt = $conn->prepare("UPDATE manufacturers SET logo_path = ? WHERE id = ?");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("si", $relPath, $id);
    $ok = $stmt->execute();
    $stmt->close();
    if (!$ok) respond(['error' => 'db'], 500);

    if ($oldPath && $oldPath !== $DEFAULT_LOGO && strpos($oldPath, 'logos/') === 0) {
        $absOld = __DIR__ . '/' . $oldPath;
        if (is_file($absOld)) @unlink($absOld);
    }

    respond(['success' => true, 'logo_path' => $relPath]);
}

if ($action === 'manufacturer_remove_logo') {
    $id = safe_int(post('id', 0), 0);
    if ($id <= 0) respond(['error' => 'invalid'], 400);

    $oldPath = null;
    $stmt = $conn->prepare("SELECT logo_path FROM manufacturers WHERE id = ? LIMIT 1");
    if ($stmt) {
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $oldPath = $row['logo_path'] ?? null;
        $stmt->close();
    }

    $stmt = $conn->prepare("UPDATE manufacturers SET logo_path = ? WHERE id = ?");
    if (!$stmt) respond(['error' => 'db'], 500);
    $default = $DEFAULT_LOGO;
    $stmt->bind_param("si", $default, $id);
    $ok = $stmt->execute();
    $stmt->close();
    if (!$ok) respond(['error' => 'db'], 500);

    if ($oldPath && $oldPath !== $DEFAULT_LOGO && strpos($oldPath, 'logos/') === 0) {
        $absOld = __DIR__ . '/' . $oldPath;
        if (is_file($absOld)) @unlink($absOld);
    }

    respond(['success' => true]);
}

if ($action === 'edit') {
    $id = safe_int(post('id', 0), 0);
    if ($id <= 0) respond(['error' => 'invalid'], 400);

    $stmt = $conn->prepare("SELECT name, tth1, tth2, qty, category_id, manufacturer_id FROM items WHERE id = ? LIMIT 1");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row) respond(['error' => 'not_found'], 404);

    $name = array_key_exists('name', $_POST) ? safe_str(post('name', ''), 150) : $row['name'];
    $tth1 = array_key_exists('tth1', $_POST) ? safe_str(post('tth1', ''), 100) : $row['tth1'];
    $tth2 = array_key_exists('tth2', $_POST) ? safe_str(post('tth2', ''), 100) : $row['tth2'];
    $qty  = array_key_exists('qty', $_POST)  ? max(0, safe_int(post('qty', 0), 0)) : (int)$row['qty'];

    $category_id = array_key_exists('category_id', $_POST) ? safe_int(post('category_id', 0), 0) : (int)$row['category_id'];
    $manufacturer_id = array_key_exists('manufacturer_id', $_POST) ? safe_int(post('manufacturer_id', 0), 0) : (int)$row['manufacturer_id'];

    if ($name === '' || $tth1 === '') respond(['error' => 'invalid'], 400);
    if ($category_id <= 0 || $manufacturer_id <= 0) respond(['error' => 'invalid'], 400);

    $stmt = $conn->prepare("UPDATE items SET name = ?, tth1 = ?, tth2 = ?, qty = ?, category_id = ?, manufacturer_id = ? WHERE id = ?");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("sssiiii", $name, $tth1, $tth2, $qty, $category_id, $manufacturer_id, $id);
    $ok = $stmt->execute();
    $stmt->close();
    if (!$ok) respond(['error' => 'db'], 500);

    respond(['success' => true]);
}

if ($action === 'delete') {
    $id = safe_int(post('id', 0), 0);
    if ($id <= 0) respond(['error' => 'invalid'], 400);

    $stmt = $conn->prepare("DELETE FROM items WHERE id = ?");
    if (!$stmt) respond(['error' => 'db'], 500);
    $stmt->bind_param("i", $id);
    $ok = $stmt->execute();
    $stmt->close();
    if (!$ok) respond(['error' => 'db'], 500);

    respond(['success' => true]);
}

if ($action === 'movements_list') {
    $sql = "SELECT mv.*,
                   i.name AS item_name,
                   i.tth1 AS item_tth1,
                   mf.name AS manufacturer_name,
                   COALESCE(NULLIF(mf.logo_path,''), '$DEFAULT_LOGO') AS logo_path
            FROM movements mv
            LEFT JOIN items i ON mv.item_id = i.id
            LEFT JOIN manufacturers mf ON i.manufacturer_id = mf.id
            ORDER BY mv.created_at DESC";
    $result = $conn->query($sql);
    $moves = [];
    if ($result) while ($row = $result->fetch_assoc()) $moves[] = $row;
    respond($moves);
}

if ($action === 'add_movement') {
    $item_id = safe_int(post('item_id', 0), 0);
    $qty_in = safe_int(post('qty', 0), 0);
    $action_type = safe_str(post('action_type', ''), 20);
    $destination = safe_str(post('destination', ''), 150);
    $comment = safe_str(post('comment', ''), 2000);

    $allowed = ['install', 'transfer', 'dispose', 'return', 'other'];
    if ($item_id <= 0 || $qty_in <= 0 || !in_array($action_type, $allowed, true) || $destination === '') {
        respond(['error' => 'invalid'], 400);
    }

    $delta = ($action_type === 'return') ? abs($qty_in) : -abs($qty_in);

    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare("INSERT INTO movements (item_id, qty, action_type, destination, comment) VALUES (?, ?, ?, ?, ?)");
        if (!$stmt) throw new Exception('db');
        $stmt->bind_param("iisss", $item_id, $delta, $action_type, $destination, $comment);
        if (!$stmt->execute()) { $stmt->close(); throw new Exception('db'); }
        $stmt->close();

        if ($delta < 0) {
            $stmt = $conn->prepare("UPDATE items SET qty = qty + ? WHERE id = ? AND qty + ? >= 0");
            if (!$stmt) throw new Exception('db');
            $stmt->bind_param("iii", $delta, $item_id, $delta);
        } else {
            $stmt = $conn->prepare("UPDATE items SET qty = qty + ? WHERE id = ?");
            if (!$stmt) throw new Exception('db');
            $stmt->bind_param("ii", $delta, $item_id);
        }

        if (!$stmt->execute()) { $stmt->close(); throw new Exception('db'); }
        $affected = $stmt->affected_rows;
        $stmt->close();
        if ($affected <= 0) throw new Exception('no_qty');

        $conn->commit();
        respond(['success' => true]);
    } catch (Exception $e) {
        $conn->rollback();
        $msg = ($e->getMessage() === 'no_qty') ? 'not_enough_qty' : 'db';
        respond(['error' => $msg], 400);
    }
}

respond(['error' => 'unknown action'], 400);
