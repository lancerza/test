export default async function handler(req, res) {
    const { channel, ts } = req.query;

    // ==========================================
    // โหมด 1: ตัว Redirect ไฟล์วิดีโอย่อย (.ts)
    // เมื่อเบราว์เซอร์วิ่งมาขอ .ts เราจะโยนกลับไปหาเซิร์ฟเวอร์จริง
    // ==========================================
    if (ts) {
        const tsUrl = decodeURIComponent(ts);
        // สั่ง Redirect (302) ไปหาเซิร์ฟเวอร์จริง เบราว์เซอร์จะวิ่งไปโหลดเองโดยตรง โหลดเร็วปรู๊ดปร๊าด!
        return res.redirect(302, tsUrl);
    }

    // ==========================================
    // โหมด 2: ตัวสร้างเพลย์ลิสต์หลัก (Rewriter)
    // ==========================================
    const channels = {
        'true4u': 'http://alb4k.tv:80/live/MAGWWMC2NN/MAGYAEYZAD/980406.m3u8', 
    };

    const sourceUrl = channels[channel];
    if (!sourceUrl) {
        return res.status(404).send('Channel not found');
    }

    try {
        // 1. ดึงไฟล์ข้อความ .m3u8 ต้นฉบับมา
        const response = await fetch(sourceUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const finalUrl = response.url;
        const m3u8Text = await response.text();

        // 2. แยก Base URL ออกมา
        const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
        const urlObj = new URL(finalUrl);
        const originUrl = urlObj.origin; 

        // 3. เตรียม URL ของ Vercel เพื่อใช้เป็นตัวเด้ง (Bouncer)
        const host = req.headers.host;
        const bouncerUrl = `https://${host}/api/true.m3u8?ts=`;

        // 4. เขียนทับลิงก์ไฟล์ .ts ให้วิ่งเข้าหา Bouncer ของเรา
        const rewrittenM3u8 = m3u8Text.split('\n').map(line => {
            const trimmedLine = line.trim();
            
            if (trimmedLine === '' || trimmedLine.startsWith('#')) {
                return line;
            }
            
            // ทำให้เป็นลิงก์สมบูรณ์ก่อน
            let absoluteTsUrl = '';
            if (trimmedLine.startsWith('http')) {
                absoluteTsUrl = trimmedLine;
            } else if (trimmedLine.startsWith('/')) {
                absoluteTsUrl = originUrl + trimmedLine;
            } else {
                absoluteTsUrl = baseUrl + trimmedLine;
            }
            
            // บังคับให้วิ่งไปหา Vercel ก่อน (HTTPS) แล้วค่อยเด้งกลับไปหา HTTP จริง
            return bouncerUrl + encodeURIComponent(absoluteTsUrl);
            
        }).join('\n');

        // 5. ส่งกลับให้ Player ไปอ่าน
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
        res.setHeader('Accept-Ranges', 'none'); 

        return res.status(200).send(rewrittenM3u8);

    } catch (error) {
        return res.status(500).send('Error fetching stream: ' + error.message);
    }
}
