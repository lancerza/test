const SOURCE_URL =
    'http://alb4k.tv:80/live/MAGWWMC2NN/MAGYAEYZAD/980406.m3u8';

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/152.0.0.0 Safari/537.36';

function absoluteUrl(uri, baseUrl) {
    try {
        return new URL(uri, baseUrl).toString();
    } catch {
        return uri;
    }
}

// แก้ URI="..." เช่น EXT-X-KEY / EXT-X-MAP
function rewriteTagUri(line, baseUrl) {
    return line.replace(
        /URI=(?:"([^"]+)"|([^,\s]+))/gi,
        (match, quoted, raw) => {
            const uri = quoted || raw;

            if (!uri) {
                return match;
            }

            return `URI="${absoluteUrl(uri, baseUrl)}"`;
        }
    );
}

// ทำ URL segment ให้เป็น URL เต็มของ CDN
function rewritePlaylist(text, finalPlaylistUrl) {
    return text
        .split(/\r?\n/)
        .map((line) => {
            const trimmed = line.trim();

            if (!trimmed) {
                return line;
            }

            // เช่น:
            // #EXT-X-KEY:URI="..."
            // #EXT-X-MAP:URI="..."
            if (trimmed.startsWith('#')) {
                if (/URI=/i.test(trimmed)) {
                    return rewriteTagUri(
                        line,
                        finalPlaylistUrl
                    );
                }

                return line;
            }

            // segment หรือ playlist ย่อย
            return absoluteUrl(
                trimmed,
                finalPlaylistUrl
            );
        })
        .join('\n');
}

async function fetchSource(req) {
    const headers = {
        'User-Agent': USER_AGENT,
        Accept:
            'application/vnd.apple.mpegurl,' +
            'application/x-mpegURL,' +
            'application/octet-stream,' +
            '*/*',

        'Accept-Language':
            'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',

        'Accept-Encoding': 'identity'
    };

    if (req.headers.range) {
        headers.Range = req.headers.range;
    }

    return fetch(SOURCE_URL, {
        method: 'GET',
        headers,
        redirect: 'follow',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000)
    });
}

export default async function handler(req, res) {
    // ==========================================
    // CORS
    // ==========================================
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
        'Content-Type, Content-Length, Content-Range, X-Final-URL, X-HLS-Mode'
    );

    res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate'
    );

    // ==========================================
    // OPTIONS
    // ==========================================
    if (req.method === 'OPTIONS') {
        return res
            .status(204)
            .end();
    }

    // ==========================================
    // METHOD
    // ==========================================
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

    // ==========================================
    // CHANNEL
    // ==========================================
    const channel = Array.isArray(
        req.query.channel
    )
        ? req.query.channel[0]
        : req.query.channel;

    if (channel !== 'true4u') {
        return res
            .status(404)
            .send('Channel not found');
    }

    try {
        // ======================================
        // ลองให้ Vercel ดึงต้นฉบับ
        // ======================================
        const upstream =
            await fetchSource(req);

        const finalUrl =
            upstream.url || SOURCE_URL;

        console.log(
            '[TRUE4U] STATUS:',
            upstream.status
        );

        console.log(
            '[TRUE4U] FINAL URL:',
            finalUrl
        );

        // ======================================
        // ถ้าโดน 401 / 403
        //
        // ให้ browser ไป alb4k โดยตรง
        // วิธีนี้คือแบบที่ภาพก่อนหน้าของคุณเล่นได้
        // ======================================
        if (
            upstream.status === 401 ||
            upstream.status === 403
        ) {
            console.log(
                '[TRUE4U] Server blocked. ' +
                'Fallback to browser redirect.'
            );

            res.setHeader(
                'X-HLS-Mode',
                'browser-redirect-fallback'
            );

            return res.redirect(
                302,
                SOURCE_URL
            );
        }

        // ======================================
        // Error อื่น
        // ======================================
        if (!upstream.ok) {
            const body =
                await upstream
                    .text()
                    .catch(() => '');

            console.error(
                '[TRUE4U] UPSTREAM ERROR:',
                upstream.status,
                body.substring(0, 300)
            );

            return res
                .status(upstream.status)
                .send(
                    `Upstream HTTP ${upstream.status}`
                );
        }

        // ======================================
        // HEAD
        // ======================================
        if (req.method === 'HEAD') {
            res.setHeader(
                'X-Final-URL',
                finalUrl
            );

            res.setHeader(
                'X-HLS-Mode',
                'server-proxy'
            );

            return res
                .status(200)
                .end();
        }

        // ======================================
        // อ่าน playlist
        // ======================================
        const text =
            await upstream.text();

        // ======================================
        // ตรวจว่าเป็น M3U8 จริง
        // ======================================
        if (
            !text
                .trimStart()
                .startsWith('#EXTM3U')
        ) {
            console.error(
                '[TRUE4U] Not M3U8:',
                text.substring(0, 300)
            );

            return res
                .status(502)
                .send(
                    'Upstream did not return an M3U8 playlist'
                );
        }

        // ======================================
        // ทำ segment URL ให้เป็น absolute URL
        //
        // เช่นเดิม:
        //
        // 2032680_1793354.ts?x_ark_...
        //
        // กลายเป็น:
        //
        // https://true4u-....byteark.com/
        // live/pl_720p/
        // 2032680_1793354.ts?x_ark_...
        //
        // เพื่อให้เปิดผ่าน Vercel แล้วยังเล่นได้
        // ======================================
        const playlist =
            rewritePlaylist(
                text,
                finalUrl
            );

        res.setHeader(
            'Content-Type',
            'application/vnd.apple.mpegurl; charset=utf-8'
        );

        res.setHeader(
            'X-Final-URL',
            finalUrl
        );

        res.setHeader(
            'X-HLS-Mode',
            'server-proxy'
        );

        return res
            .status(200)
            .send(playlist);

    } catch (error) {
        console.error(
            '[TRUE4U] ERROR:',
            error
        );

        // ======================================
        // ถ้า Vercel fetch ไม่สำเร็จเลย
        // fallback ไปต้นทาง
        // ======================================
        res.setHeader(
            'X-HLS-Mode',
            'browser-redirect-fallback'
        );

        return res.redirect(
            302,
            SOURCE_URL
        );
    }
}
