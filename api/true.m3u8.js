// /pages/api/true.m3u8.js
// หรือ API route เดิมของคุณ

const TRUE4U_URL =
    'http://alb4k.tv:80/live/MAGWWMC2NN/MAGYAEYZAD/980406.m3u8';

const DEFAULT_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/152.0.0.0 Safari/537.36';

// ============================================================
// Helper: เอาค่า query ที่เป็น string เท่านั้น
// ============================================================
function getQueryValue(value) {
    if (Array.isArray(value)) {
        return value[0] || '';
    }

    return typeof value === 'string' ? value : '';
}

// ============================================================
// Helper: หา URL ของ API ตัวเอง
// รองรับทั้ง localhost และ Vercel
// ============================================================
function getProxyBaseUrl(req) {
    const host = req.headers.host;

    const forwardedProto = req.headers['x-forwarded-proto'];

    let protocol = 'https';

    if (
        host?.startsWith('localhost') ||
        host?.startsWith('127.0.0.1')
    ) {
        protocol = 'http';
    } else if (typeof forwardedProto === 'string') {
        protocol = forwardedProto.split(',')[0].trim();
    }

    return `${protocol}://${host}/api/true.m3u8`;
}

// ============================================================
// Helper: ทำ URL relative -> absolute
// ============================================================
function resolveUrl(uri, baseUrl) {
    try {
        return new URL(uri, baseUrl).toString();
    } catch {
        return null;
    }
}

// ============================================================
// Helper: ส่งทุก resource กลับมาผ่าน Vercel
// ============================================================
function makeProxyUrl(req, upstreamUrl) {
    const proxyBase = getProxyBaseUrl(req);

    return `${proxyBase}?url=${encodeURIComponent(upstreamUrl)}`;
}

// ============================================================
// Rewrite URI="..." เช่น
//
// #EXT-X-KEY:METHOD=AES-128,URI="key.key"
// #EXT-X-MAP:URI="init.mp4"
// #EXT-X-MEDIA:URI="audio.m3u8"
// #EXT-X-I-FRAME-STREAM-INF:URI="iframe.m3u8"
// ============================================================
function rewriteTagUri(line, playlistUrl, req) {
    return line.replace(
        /URI=(?:"([^"]+)"|([^,\s]+))/gi,
        (match, quotedUri, rawUri) => {
            const uri = quotedUri || rawUri;

            if (!uri) {
                return match;
            }

            const absoluteUrl = resolveUrl(uri, playlistUrl);

            if (!absoluteUrl) {
                return match;
            }

            const proxiedUrl = makeProxyUrl(req, absoluteUrl);

            return `URI="${proxiedUrl}"`;
        }
    );
}

// ============================================================
// Rewrite M3U8 ทั้งไฟล์
// ============================================================
function rewriteM3U8(content, playlistUrl, req) {
    const lines = content.split(/\r?\n/);

    return lines
        .map((line) => {
            const trimmed = line.trim();

            // บรรทัดว่าง
            if (!trimmed) {
                return line;
            }

            // Tag ของ M3U8
            if (trimmed.startsWith('#')) {
                // Tag ที่มี URI=
                if (/URI=/i.test(trimmed)) {
                    return rewriteTagUri(
                        line,
                        playlistUrl,
                        req
                    );
                }

                return line;
            }

            // บรรทัด URL ปกติ
            // รองรับทั้ง:
            // segment.ts
            // stream.m3u8
            // video.m4s
            // init.mp4
            // absolute URL
            // /path/file.ts

            const absoluteUrl = resolveUrl(
                trimmed,
                playlistUrl
            );

            if (!absoluteUrl) {
                return line;
            }

            return makeProxyUrl(
                req,
                absoluteUrl
            );
        })
        .join('\n');
}

// ============================================================
// ตรวจว่าเป็น playlist หรือไม่
// ============================================================
function isM3U8Response(response, url) {
    const contentType =
        response.headers.get('content-type') || '';

    try {
        const pathname =
            new URL(url).pathname.toLowerCase();

        if (
            pathname.endsWith('.m3u8') ||
            pathname.endsWith('.m3u')
        ) {
            return true;
        }
    } catch {
        // ignore
    }

    return (
        contentType.includes(
            'application/vnd.apple.mpegurl'
        ) ||
        contentType.includes(
            'application/x-mpegurl'
        ) ||
        contentType.includes(
            'audio/mpegurl'
        ) ||
        contentType.includes(
            'audio/x-mpegurl'
        )
    );
}

// ============================================================
// CORS
// ============================================================
function setCorsHeaders(res) {
    res.setHeader(
        'Access-Control-Allow-Origin',
        '*'
    );

    res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, HEAD, OPTIONS'
    );

    res.setHeader(
        'Access-Control-Allow-Headers',
        'Range, Content-Type, Accept, Origin'
    );

    res.setHeader(
        'Access-Control-Expose-Headers',
        [
            'Content-Length',
            'Content-Range',
            'Accept-Ranges',
            'Content-Type'
        ].join(', ')
    );
}

// ============================================================
// Copy header สำคัญจาก upstream
// ============================================================
function copyUpstreamHeaders(response, res) {
    const headersToCopy = [
        'content-type',
        'content-range',
        'accept-ranges',
        'last-modified',
        'etag'
    ];

    for (const header of headersToCopy) {
        const value =
            response.headers.get(header);

        if (value) {
            res.setHeader(header, value);
        }
    }
}

// ============================================================
// Fetch upstream
// ============================================================
async function fetchUpstream(url, req) {
    const headers = {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: '*/*',
        'Accept-Encoding': 'identity'
    };

    // สำคัญมากสำหรับ .m4s / mp4 / byterange HLS
    if (req.headers.range) {
        headers.Range = req.headers.range;
    }

    return fetch(url, {
        method:
            req.method === 'HEAD'
                ? 'HEAD'
                : 'GET',

        headers,

        redirect: 'follow',

        signal: AbortSignal.timeout(15000)
    });
}

// ============================================================
// Proxy resource
// ============================================================
async function proxyResource(
    upstreamUrl,
    req,
    res
) {
    let parsedUrl;

    try {
        parsedUrl = new URL(upstreamUrl);
    } catch {
        return res
            .status(400)
            .send('Invalid upstream URL');
    }

    // ป้องกัน protocol แปลก ๆ
    if (
        parsedUrl.protocol !== 'http:' &&
        parsedUrl.protocol !== 'https:'
    ) {
        return res
            .status(400)
            .send('Unsupported protocol');
    }

    let response;

    try {
        response = await fetchUpstream(
            upstreamUrl,
            req
        );
    } catch (error) {
        console.error(
            '[HLS] Upstream fetch error:',
            error
        );

        return res
            .status(502)
            .send(
                `Upstream fetch failed: ${
                    error?.message ||
                    'Unknown error'
                }`
            );
    }

    if (!response.ok && response.status !== 206) {
        const errorText =
            await response
                .text()
                .catch(() => '');

        console.error(
            '[HLS] Upstream error:',
            response.status,
            upstreamUrl,
            errorText.substring(0, 300)
        );

        return res
            .status(response.status)
            .send(
                `Upstream HTTP ${response.status}`
            );
    }

    // URL จริงหลัง redirect
    const finalUrl =
        response.url || upstreamUrl;

    // ========================================================
    // Playlist
    // ========================================================
    if (
        req.method !== 'HEAD' &&
        isM3U8Response(response, finalUrl)
    ) {
        let playlistText;

        try {
            playlistText =
                await response.text();
        } catch (error) {
            console.error(
                '[HLS] Playlist read error:',
                error
            );

            return res
                .status(502)
                .send(
                    'Unable to read upstream playlist'
                );
        }

        // บาง server ไม่ส่ง content-type ถูก
        // ตรวจอีกครั้งจากข้อมูลจริง
        const looksLikePlaylist =
            playlistText
                .trimStart()
                .startsWith('#EXTM3U');

        if (looksLikePlaylist) {
            const rewritten =
                rewriteM3U8(
                    playlistText,
                    finalUrl,
                    req
                );

            res.statusCode =
                response.status;

            res.setHeader(
                'Content-Type',
                'application/vnd.apple.mpegurl; charset=utf-8'
            );

            res.setHeader(
                'Cache-Control',
                'public, s-maxage=1, stale-while-revalidate=2'
            );

            return res.send(rewritten);
        }

        // ไม่ใช่ playlist จริง
        return res
            .status(502)
            .send(
                'Invalid upstream M3U8 response'
            );
    }

    // ========================================================
    // HEAD
    // ========================================================
    if (req.method === 'HEAD') {
        res.statusCode =
            response.status;

        copyUpstreamHeaders(
            response,
            res
        );

        return res.end();
    }

    // ========================================================
    // Segment / key / mp4 / m4s / aac / ts / binary
    // ========================================================
    let buffer;

    try {
        const arrayBuffer =
            await response.arrayBuffer();

        buffer =
            Buffer.from(arrayBuffer);
    } catch (error) {
        console.error(
            '[HLS] Binary read error:',
            error
        );

        return res
            .status(502)
            .send(
                'Unable to read upstream media'
            );
    }

    res.statusCode =
        response.status;

    copyUpstreamHeaders(
        response,
        res
    );

    // ถ้า upstream ไม่ระบุ Content-Type
    if (
        !response.headers.get(
            'content-type'
        )
    ) {
        res.setHeader(
            'Content-Type',
            'application/octet-stream'
        );
    }

    res.setHeader(
        'Content-Length',
        buffer.length
    );

    res.setHeader(
        'Cache-Control',
        'public, s-maxage=3600, stale-while-revalidate=86400'
    );

    return res.send(buffer);
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(
    req,
    res
) {
    setCorsHeaders(res);

    // ========================================================
    // OPTIONS
    // ========================================================
    if (req.method === 'OPTIONS') {
        return res
            .status(204)
            .end();
    }

    if (
        req.method !== 'GET' &&
        req.method !== 'HEAD'
    ) {
        res.setHeader(
            'Allow',
            'GET, HEAD, OPTIONS'
        );

        return res
            .status(405)
            .send('Method Not Allowed');
    }

    const channel =
        getQueryValue(
            req.query.channel
        );

    // url = parameter ใหม่
    const urlParam =
        getQueryValue(
            req.query.url
        );

    // ts = รองรับ code เก่า
    const legacyTs =
        getQueryValue(
            req.query.ts
        );

    try {
        // ====================================================
        // MODE 1
        // ช่อง True4U
        // ====================================================
        if (channel === 'true4u') {
            return await proxyResource(
                TRUE4U_URL,
                req,
                res
            );
        }

        // ====================================================
        // MODE 2
        // Resource ที่ถูก rewrite จาก playlist
        // ====================================================
        if (urlParam) {
            return await proxyResource(
                urlParam,
                req,
                res
            );
        }

        // ====================================================
        // MODE 3
        // รองรับ ?ts= ของระบบเก่า
        // ไม่ decodeURIComponent ซ้ำ
        // เพราะ Next/Vercel decode query มาให้แล้ว
        // ====================================================
        if (legacyTs) {
            return await proxyResource(
                legacyTs,
                req,
                res
            );
        }

        return res
            .status(404)
            .send('Channel not found');
    } catch (error) {
        console.error(
            '[HLS] Unexpected error:',
            error
        );

        if (res.headersSent) {
            return res.end();
        }

        return res
            .status(500)
            .send(
                `HLS Proxy Error: ${
                    error?.message ||
                    'Unknown error'
                }`
            );
    }
}
