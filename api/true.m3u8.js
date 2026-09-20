const SOURCE_URL =
    'http://alb4k.tv:80/live/MAGWWMC2NN/MAGYAEYZAD/980406.m3u8';

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/152.0.0.0 Safari/537.36';


// ============================================================
// QUERY
// ============================================================

function getQuery(value) {
    if (Array.isArray(value)) {
        return value[0] || '';
    }

    return typeof value === 'string'
        ? value
        : '';
}


// ============================================================
// URL ของ Vercel ตัวเอง
// ============================================================

function getProxyBase(req) {
    const host = req.headers.host;

    // Production Vercel ใช้ HTTPS
    // localhost ใช้ HTTP
    const protocol =
        host?.includes('localhost') ||
        host?.startsWith('127.0.0.1')
            ? 'http'
            : 'https';

    return `${protocol}://${host}/api/true.m3u8`;
}


// ============================================================
// relative -> absolute
// ============================================================

function resolveUrl(uri, baseUrl) {
    try {
        return new URL(
            uri,
            baseUrl
        ).toString();
    } catch {
        return null;
    }
}


// ============================================================
// สร้าง URL proxy
//
// http://46.249.../abc.ts
//
// กลายเป็น:
//
// https://xxx.vercel.app/api/true.m3u8?url=...
// ============================================================

function makeProxyUrl(req, upstreamUrl) {
    return (
        getProxyBase(req) +
        '?url=' +
        encodeURIComponent(upstreamUrl)
    );
}


// ============================================================
// Rewrite URI="..."
//
// รองรับ:
//
// #EXT-X-KEY
// #EXT-X-MAP
// #EXT-X-MEDIA
// #EXT-X-I-FRAME-STREAM-INF
// ============================================================

function rewriteTagUri(
    line,
    playlistUrl,
    req
) {
    return line.replace(
        /URI=(?:"([^"]+)"|([^,\s]+))/gi,

        (
            match,
            quotedUri,
            rawUri
        ) => {

            const uri =
                quotedUri ||
                rawUri;

            if (!uri) {
                return match;
            }

            const absolute =
                resolveUrl(
                    uri,
                    playlistUrl
                );

            if (!absolute) {
                return match;
            }

            return (
                'URI="' +
                makeProxyUrl(
                    req,
                    absolute
                ) +
                '"'
            );
        }
    );
}


// ============================================================
// Rewrite playlist
// ============================================================

function rewritePlaylist(
    text,
    playlistUrl,
    req
) {
    return text
        .split(/\r?\n/)

        .map((line) => {

            const trimmed =
                line.trim();


            // ------------------------------
            // บรรทัดว่าง
            // ------------------------------

            if (!trimmed) {
                return line;
            }


            // ------------------------------
            // TAG
            // ------------------------------

            if (
                trimmed.startsWith('#')
            ) {

                if (
                    /URI=/i.test(trimmed)
                ) {
                    return rewriteTagUri(
                        line,
                        playlistUrl,
                        req
                    );
                }

                return line;
            }


            // ------------------------------
            // URL
            //
            // segment.ts
            // playlist.m3u8
            // .aac
            // .m4s
            // .mp4
            // absolute HTTP
            // absolute HTTPS
            // ------------------------------

            const absolute =
                resolveUrl(
                    trimmed,
                    playlistUrl
                );

            if (!absolute) {
                return line;
            }


            // สำคัญ:
            // ห้ามคืน absolute ต้นทางให้ browser
            //
            // ต้อง proxy ผ่าน HTTPS Vercel
            return makeProxyUrl(
                req,
                absolute
            );
        })

        .join('\n');
}


// ============================================================
// ตรวจว่า response เป็น M3U8 หรือไม่
// ============================================================

function isPlaylist(
    response,
    url
) {

    const contentType =
        response.headers
            .get('content-type') ||
        '';

    if (
        contentType.includes(
            'mpegurl'
        )
    ) {
        return true;
    }

    try {

        const pathname =
            new URL(url)
                .pathname
                .toLowerCase();

        return (
            pathname.endsWith('.m3u8') ||
            pathname.endsWith('.m3u')
        );

    } catch {

        return false;
    }
}


// ============================================================
// FETCH
// ============================================================

async function fetchUpstream(
    url,
    req
) {

    const headers = {

        'User-Agent':
            USER_AGENT,

        'Accept':
            '*/*',

        'Accept-Encoding':
            'identity'
    };


    // สำคัญสำหรับ video range
    if (req.headers.range) {

        headers.Range =
            req.headers.range;
    }


    return fetch(url, {

        method:
            req.method === 'HEAD'
                ? 'HEAD'
                : 'GET',

        headers,

        redirect:
            'follow',

        cache:
            'no-store',

        signal:
            AbortSignal.timeout(
                15000
            )
    });
}


// ============================================================
// PROXY PLAYLIST / SEGMENT
// ============================================================

async function proxyResource(
    upstreamUrl,
    req,
    res
) {

    let parsed;


    // -----------------------------
    // Validate URL
    // -----------------------------

    try {

        parsed =
            new URL(
                upstreamUrl
            );

    } catch {

        return res
            .status(400)
            .send(
                'Invalid URL'
            );
    }


    if (
        parsed.protocol !== 'http:' &&
        parsed.protocol !== 'https:'
    ) {

        return res
            .status(400)
            .send(
                'Unsupported protocol'
            );
    }


    // -----------------------------
    // Fetch
    // -----------------------------

    let upstream;

    try {

        upstream =
            await fetchUpstream(
                upstreamUrl,
                req
            );

    } catch (error) {

        console.error(
            '[TRUE4U FETCH ERROR]',
            error
        );

        return res
            .status(502)
            .send(
                'Upstream fetch failed'
            );
    }


    const finalUrl =
        upstream.url ||
        upstreamUrl;


    console.log(
        '[TRUE4U]',
        upstream.status,
        finalUrl
    );


    // -----------------------------
    // ERROR
    // -----------------------------

    if (
        !upstream.ok &&
        upstream.status !== 206
    ) {

        const body =
            await upstream
                .text()
                .catch(
                    () => ''
                );

        console.error(
            '[UPSTREAM ERROR]',
            upstream.status,
            body.substring(
                0,
                300
            )
        );

        return res
            .status(
                upstream.status
            )
            .send(
                `Upstream HTTP ${upstream.status}`
            );
    }


    // ========================================================
    // HEAD
    // ========================================================

    if (
        req.method === 'HEAD'
    ) {

        const contentType =
            upstream.headers.get(
                'content-type'
            );

        const contentLength =
            upstream.headers.get(
                'content-length'
            );

        const contentRange =
            upstream.headers.get(
                'content-range'
            );

        if (contentType) {
            res.setHeader(
                'Content-Type',
                contentType
            );
        }

        if (contentLength) {
            res.setHeader(
                'Content-Length',
                contentLength
            );
        }

        if (contentRange) {
            res.setHeader(
                'Content-Range',
                contentRange
            );
        }

        return res
            .status(
                upstream.status
            )
            .end();
    }


    // ========================================================
    // PLAYLIST
    // ========================================================

    if (
        isPlaylist(
            upstream,
            finalUrl
        )
    ) {

        const text =
            await upstream.text();


        // ตรวจอีกชั้น
        if (
            text
                .trimStart()
                .startsWith(
                    '#EXTM3U'
                )
        ) {

            const rewritten =
                rewritePlaylist(
                    text,
                    finalUrl,
                    req
                );


            res.setHeader(

                'Content-Type',

                'application/vnd.apple.mpegurl; charset=utf-8'
            );


            res.setHeader(

                'Cache-Control',

                'no-store, no-cache, must-revalidate'
            );


            res.setHeader(

                'X-Final-URL',

                finalUrl
            );


            return res
                .status(200)
                .send(
                    rewritten
                );
        }
    }


    // ========================================================
    // BINARY
    //
    // .ts
    // .m4s
    // .mp4
    // .aac
    // key
    // ========================================================

    const arrayBuffer =
        await upstream
            .arrayBuffer();

    const buffer =
        Buffer.from(
            arrayBuffer
        );


    // -----------------------------
    // Headers
    // -----------------------------

    const contentType =
        upstream.headers.get(
            'content-type'
        );

    const contentRange =
        upstream.headers.get(
            'content-range'
        );

    const acceptRanges =
        upstream.headers.get(
            'accept-ranges'
        );


    if (contentType) {

        res.setHeader(
            'Content-Type',
            contentType
        );

    } else {

        res.setHeader(
            'Content-Type',
            'application/octet-stream'
        );
    }


    if (contentRange) {

        res.setHeader(
            'Content-Range',
            contentRange
        );
    }


    if (acceptRanges) {

        res.setHeader(
            'Accept-Ranges',
            acceptRanges
        );

    } else {

        res.setHeader(
            'Accept-Ranges',
            'bytes'
        );
    }


    res.setHeader(
        'Content-Length',
        buffer.length
    );


    res.setHeader(
        'Cache-Control',
        'public, s-maxage=10'
    );


    // รักษา 206
    res.statusCode =
        upstream.status;


    return res.send(
        buffer
    );
}


// ============================================================
// HANDLER
// ============================================================

export default async function handler(
    req,
    res
) {

    // ========================================================
    // CORS
    // ========================================================

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
        'Range, Accept, Content-Type, Origin'
    );

    res.setHeader(
        'Access-Control-Expose-Headers',
        [
            'Content-Length',
            'Content-Range',
            'Accept-Ranges',
            'Content-Type',
            'X-Final-URL'
        ].join(', ')
    );


    // ========================================================
    // OPTIONS
    // ========================================================

    if (
        req.method === 'OPTIONS'
    ) {

        return res
            .status(204)
            .end();
    }


    // ========================================================
    // METHOD
    // ========================================================

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
            .send(
                'Method Not Allowed'
            );
    }


    const channel =
        getQuery(
            req.query.channel
        );

    const url =
        getQuery(
            req.query.url
        );


    try {

        // ====================================================
        // RESOURCE
        //
        // segment / playlist ย่อย / key
        // ====================================================

        if (url) {

            return await proxyResource(
                url,
                req,
                res
            );
        }


        // ====================================================
        // TRUE4U
        // ====================================================

        if (
            channel === 'true4u'
        ) {

            return await proxyResource(
                SOURCE_URL,
                req,
                res
            );
        }


        return res
            .status(404)
            .send(
                'Channel not found'
            );


    } catch (error) {

        console.error(
            '[TRUE4U ERROR]',
            error
        );


        return res
            .status(500)
            .send(
                'Internal Proxy Error'
            );
    }
}
