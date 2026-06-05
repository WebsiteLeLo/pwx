<?php
/**
 * PWX PHP Proxy
 * Drop this folder on any PHP host (InfinityFree, 000webhost, Hostinger, etc.)
 * Then set VITE_API_URL=https://your-php-host.com in your frontend build.
 *
 * Routes handled:
 *   GET /api/proxy?url=...        — DASH MPD proxy (rewrites segment URLs)
 *   GET /api/dash-seg/{sig}/{...} — DASH segment proxy
 *   GET /api/pdf?url=...          — PDF proxy
 *   GET /api/drive/files?folderId=... — Google Drive listing
 *   GET /api/health               — health check
 */

// ── CORS (allow all origins) ─────────────────────────────────────────────────
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, HEAD, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Config ───────────────────────────────────────────────────────────────────
$DRIVE_API_KEY = getenv('DRIVE_API_KEY') ?: '';

$CDN_HOSTS = ['sec-prod-mediacdn.pw.live', 'prod-mediacdn.pw.live', 'mediacdn.pw.live'];
$PDF_HOSTS = ['static.pw.live', 'pw.live', 'cdn.pw.live', 'd2bps9p1kiy4ka.cloudfront.net'];

// ── Helpers ──────────────────────────────────────────────────────────────────
function is_allowed_host(string $hostname, array $allowed): bool {
    foreach ($allowed as $h) {
        if ($hostname === $h || str_ends_with($hostname, '.' . $h)) return true;
    }
    return false;
}

function base64url_decode(string $data): string {
    return base64_decode(str_replace(['-', '_'], ['+', '/'], $data));
}

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function fetch_upstream(string $url, array $extra_headers = []): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => array_merge([
            'User-Agent: Mozilla/5.0 (compatible; PWX/1.0)',
            'Referer: https://www.pw.live/',
            'Origin: https://www.pw.live',
        ], $extra_headers),
    ]);
    $body         = curl_exec($ch);
    $status       = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'application/octet-stream';
    $err          = curl_error($ch);
    curl_close($ch);

    if ($body === false) throw new RuntimeException("cURL error: $err");
    return [$status, $content_type, $body];
}

function inject_base_url(string $mpd, string $base_url): string {
    if (str_contains($mpd, '<BaseURL>')) {
        return preg_replace('/<BaseURL>.*?<\/BaseURL>/s', "<BaseURL>$base_url</BaseURL>", $mpd);
    }
    return preg_replace('/(<Period[^>]*>)/', "$1\n    <BaseURL>$base_url</BaseURL>", $mpd, 1);
}

function json_error(int $code, string $msg): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['error' => $msg]);
    exit;
}

// ── Router ───────────────────────────────────────────────────────────────────
$uri   = $_SERVER['REQUEST_URI'] ?? '/';
$path  = parse_url($uri, PHP_URL_PATH);
$path  = preg_replace('#^/api#', '', $path);   // strip /api prefix

// Health check
if ($path === '/health' || $path === '') {
    header('Content-Type: application/json');
    echo json_encode(['status' => 'ok']);
    exit;
}

// ── /proxy?url=... ────────────────────────────────────────────────────────────
if ($path === '/proxy') {
    $raw_url = $_GET['url'] ?? '';
    if (!$raw_url) json_error(400, 'Missing url');

    $parsed = parse_url($raw_url);
    if (!$parsed || empty($parsed['host'])) json_error(400, 'Invalid URL');

    global $CDN_HOSTS;
    if (!is_allowed_host($parsed['host'], $CDN_HOSTS)) json_error(403, 'Host not allowed');

    try {
        [$status, $content_type, $body] = fetch_upstream($raw_url);

        $is_mpd = str_contains($content_type, 'dash')
               || str_contains($content_type, 'xml')
               || str_ends_with($parsed['path'] ?? '', '.mpd');

        http_response_code($status);

        if ($is_mpd && $status < 300) {
            // Rewrite BaseURL so segments route through this proxy
            $path_parts = array_values(array_filter(explode('/', $parsed['path'] ?? '')));
            $uuid       = $path_parts[0] ?? '';
            $sig_qs     = $parsed['query'] ?? '';
            $sig_b64    = base64url_encode($sig_qs);

            $scheme   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host     = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? '';
            $base_url = "$scheme://$host/api/dash-seg/$sig_b64/$uuid/";

            $rewritten = inject_base_url($body, $base_url);
            header('Content-Type: application/dash+xml');
            header('Cache-Control: no-cache');
            echo $rewritten;
        } else {
            header("Content-Type: $content_type");
            echo $body;
        }
    } catch (Exception $e) {
        json_error(502, 'Upstream fetch failed');
    }
    exit;
}

// ── /dash-seg/{sig}/{uuid}/{...path} ─────────────────────────────────────────
if (preg_match('#^/dash-seg/([^/]+)/(.+)$#', $path, $m)) {
    $sig_b64  = $m[1];
    $seg_path = $m[2];   // uuid/rest/of/path.mp4

    $sig_qs = base64url_decode($sig_b64);
    if (!$sig_qs) json_error(400, 'Invalid sig');

    $cdn_url = "https://sec-prod-mediacdn.pw.live/$seg_path?$sig_qs";
    $parsed  = parse_url($cdn_url);

    global $CDN_HOSTS;
    if (!is_allowed_host($parsed['host'] ?? '', $CDN_HOSTS)) json_error(403, 'Host not allowed');

    try {
        [$status, $content_type, $body] = fetch_upstream($cdn_url);
        http_response_code($status);
        header("Content-Type: $content_type");
        header('Cache-Control: public, max-age=3600, immutable');
        echo $body;
    } catch (Exception $e) {
        json_error(502, 'Segment fetch failed');
    }
    exit;
}

// ── /pdf?url=... ─────────────────────────────────────────────────────────────
if ($path === '/pdf') {
    $raw_url = $_GET['url'] ?? '';
    if (!$raw_url) json_error(400, 'Missing url');
    if (!str_starts_with($raw_url, 'http')) $raw_url = "https://$raw_url";

    $parsed = parse_url($raw_url);
    if (!$parsed || empty($parsed['host'])) json_error(400, 'Invalid URL');

    global $PDF_HOSTS;
    if (!is_allowed_host($parsed['host'], $PDF_HOSTS)) json_error(403, 'Host not allowed');

    try {
        [$status, , $body] = fetch_upstream($raw_url);
        http_response_code($status);
        header('Content-Type: application/pdf');
        header('Cache-Control: public, max-age=3600');
        header('Content-Disposition: inline');
        echo $body;
    } catch (Exception $e) {
        json_error(502, 'Upstream fetch failed');
    }
    exit;
}

// ── /drive/files?folderId=... ────────────────────────────────────────────────
if ($path === '/drive/files') {
    global $DRIVE_API_KEY;
    if (!$DRIVE_API_KEY) json_error(503, 'Drive API not configured');

    $folder_id = $_GET['folderId'] ?? '';
    if (!$folder_id) json_error(400, 'Missing folderId');

    $q      = urlencode("'$folder_id' in parents and trashed = false");
    $fields = urlencode('files(id,name,mimeType,modifiedTime,size)');
    $url    = "https://www.googleapis.com/drive/v3/files?q=$q&fields=$fields&key=$DRIVE_API_KEY&orderBy=folder,name&pageSize=200";

    try {
        [$status, , $body] = fetch_upstream($url, [
            'Referer: https://www.pw.live/',
            'Origin: https://www.pw.live',
        ]);
        http_response_code($status);
        header('Content-Type: application/json');
        header('Cache-Control: public, max-age=300');
        echo $body;
    } catch (Exception $e) {
        json_error(502, 'Drive API fetch failed');
    }
    exit;
}

json_error(404, 'Not found');
