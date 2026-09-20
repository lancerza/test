export default async function handler(req, res) {
    // ==========================================
    // CORS
    // ==========================================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD, OPTIONS');
        return res.status(405).send('Method Not Allowed');
    }

    const { channel } = req.query;

    // ==========================================
    // TRUE4U
    // ==========================================
    if (channel === 'true4u') {

        // ลิงก์ต้นฉบับ
        const sourceUrl =
            'http://alb4k.tv:80/live/MAGWWMC2NN/MAGYAEYZAD/980406.m3u8';

        // ให้ Browser ไปต้นทางโดยตรง
        // ถ้า alb4k redirect ไป ByteArk
        // Browser จะตามไปยัง ByteArk URL ล่าสุดเอง
        res.statusCode = 302;
        res.setHeader('Location', sourceUrl);

        return res.end();
    }

    return res.status(404).send('Channel not found');
}
