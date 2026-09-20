export default async function handler(req, res) {
    const { channel, ts } = req.query;

    // ==========================================
    // โหมด 1: ตัวดูดไฟล์วิดีโอย่อย (.ts) 
    // (เปลี่ยนไฟล์ HTTP ให้กลายเป็น HTTPS ผ่าน Vercel)
    // ==========================================
    if (ts) {
        try {
            const tsUrl = decodeURIComponent(ts);
            const response = await fetch(tsUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (!response.ok) throw new Error('TS fetch failed');
            
            const arrayBuffer = await response.arrayBuffer();
            
            // ส่งไฟล์วิดีโอกลับไปให้เบราว์เซอร์
            res.setHeader('Content-Type', 'video/mp2t');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.status(200).send(Buffer.from(arrayBuffer));
        } catch (error) {
            return res.status(500).send('TS Proxy Error');
        }
    }

    // ==========================================
    // โหมด 2: ตัวดึงเพลย์ลิสต์หลัก (.m3u8)
    // ==========================================
    if (channel === 'true4u') {
        // ลิงก์ต้นทาง (เปลี่ยน .ts เป็น .m3u8 เพื่อให้เบราว์เซอร์เล่นได้)
        const targetUrl = 'http://alb4k.tv:80/live/MAGWWMC2NN/MAGYAEYZAD/980406.m3u8'; 

        try {
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const finalUrl = response.url;
            const m3u8Text = await response.text();
            
            // แยก Base URL ของลิงก์ต้นทาง
            const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
            const urlObj = new URL(finalUrl);
            const originUrl = urlObj.origin;

            // ดึง Domain ของ Vercel เราเอง เพื่อเอาไปทำ Proxy
            const host = req.headers.host;
            const proxyUrl = `https://${host}/api/true.m3u8?ts=`;

            // เขียนไฟล์ M3U8 ใหม่ทั้งหมด
            const rewrittenM3u8 = m3u8Text.split('\n').map(line => {
                const trimmedLine = line.trim();
                if (trimmedLine === '' || trimmedLine.startsWith('#')) {
                    return line;
                }
                
                // ถอดรหัสหาลิงก์ไฟล์ .ts ที่แท้จริง
                let absoluteTsUrl = '';
                if (trimmedLine.startsWith('http')) {
                    absoluteTsUrl = trimmedLine;
                } else if (trimmedLine.startsWith('/')) {
                    absoluteTsUrl = originUrl + trimmedLine;
                } else {
                    absoluteTsUrl = baseUrl + trimmedLine;
                }
                
                // บังคับให้เบราว์เซอร์วิ่งไปโหลดไฟล์ .ts ผ่าน Vercel ของเรา! (แก้ปัญหาจอดำ HTTP)
                return proxyUrl + encodeURIComponent(absoluteTsUrl);
                
            }).join('\n');

            // ส่งไฟล์ M3U8 คืนเบราว์เซอร์
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
            return res.status(200).send(rewrittenM3u8);

        } catch (error) {
            return res.status(500).send('M3U8 Proxy Error: ' + error.message);
        }
    }

    return res.status(404).send('Channel not found');
}
