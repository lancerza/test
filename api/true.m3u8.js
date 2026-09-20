export default async function handler(req, res) {
    // 1. รับค่า channel จาก URL (?channel=true4u)
    const { channel } = req.query;

    // 2. กำหนดลิงก์ต้นฉบับ (เปลี่ยนเป็นลิงก์ใหม่ของคุณ)
    const channels = {
        'true4u': 'http://alb4k.tv:80/live/MAGWWMC2NN/MAGYAEYZAD/980406.m3u8', 
        // ถ้ามีช่องอื่น สามารถเพิ่ม 'ชื่อช่อง': 'ลิงก์.m3u8', ต่อลงมาได้เลย
    };

    // ตรวจสอบว่ามีช่องที่เรียกมาหรือไม่
    const sourceUrl = channels[channel];
    if (!sourceUrl) {
        return res.status(404).send('Channel not found');
    }

    try {
        // 3. ดึงข้อมูลไฟล์ M3U8 ต้นฉบับ
        const response = await fetch(sourceUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                // ลบ Referer เดิมทิ้งไป เพื่อป้องกันเซิร์ฟเวอร์ใหม่บล็อก
            }
        });
        
        // ดึง URL สุดท้ายออกมา (สำคัญมากในกรณีที่ลิงก์ต้นทางมีการ Redirect ไปเซิร์ฟเวอร์อื่น)
        const finalUrl = response.url;
        const m3u8Text = await response.text();

        // 4. แยก Base URL จาก URL ล่าสุด เพื่อเอาไปแปะหน้าไฟล์ .ts หรือ .m3u8 ย่อย
        const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
        const urlObj = new URL(finalUrl);
        const originUrl = urlObj.origin; // เช่น http://alb4k.tv:80

        // 5. เขียน URL ใหม่ (Rewrite)
        const rewrittenM3u8 = m3u8Text.split('\n').map(line => {
            const trimmedLine = line.trim();
            
            // ถ้าเป็นบรรทัดว่าง, บรรทัดที่เป็น Tag (เริ่มด้วย #), หรือเป็นลิงก์เต็มอยู่แล้ว (http) ให้ปล่อยผ่าน
            if (trimmedLine === '' || trimmedLine.startsWith('#') || trimmedLine.startsWith('http')) {
                return line;
            }
            
            // กรณี Path เริ่มด้วย / (เช่น /live/stream.ts) ให้ต่อด้วย Domain หน้าสุด
            if (trimmedLine.startsWith('/')) {
                return originUrl + trimmedLine;
            }
            
            // กรณี Path เป็นชื่อไฟล์เฉยๆ (เช่น 980406_123.ts) ให้ต่อด้วย Base URL
            return baseUrl + trimmedLine;
        }).join('\n');

        // 6. ตั้งค่า Headers ให้เครื่องเล่นวิดีโอ (Player) เข้าใจและอนุญาตให้ดูข้ามโดเมนได้ (CORS)
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');

        // 7. ส่งไฟล์ M3U8 ที่ดัดแปลงแล้วกลับไป
        res.status(200).send(rewrittenM3u8);

    } catch (error) {
        res.status(500).send('Error fetching stream: ' + error.message);
    }
}
