export default async function handler(req, res) {
    // 1. รับค่า channel จาก URL (?channel=true4u)
    const { channel } = req.query;

    // 2. กำหนดลิงก์ต้นฉบับ (คุณสามารถนำลิงก์ยาวๆ แบบในรูปมาใส่ตรงนี้ได้เลย)
    const channels = {
        'true4u': 'http://v3tv.live:80/play/live.php?mac=00:1A:79:59:83:B5&stream=1776067&extension=m3u8', // เอาลิงก์จริงมาใส่ที่นี่
        'thairath': 'https://...',
        // เพิ่มช่องอื่นๆ ได้ตามต้องการ
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
                'Referer': 'https://true4u.com/'
            }
        });
        
        const m3u8Text = await response.text();

        // 4. แยก Base URL ออกมา (ตัดส่วนชื่อไฟล์ index.m3u8 ออก)
        // เพื่อเอาไปแปะหน้าไฟล์ .ts
        const baseUrl = sourceUrl.substring(0, sourceUrl.lastIndexOf('/') + 1);

        // 5. เขียน URL ใหม่ (Rewrite)
        const rewrittenM3u8 = m3u8Text.split('\n').map(line => {
            const trimmedLine = line.trim();
            // ถ้าเป็นบรรทัดว่าง, บรรทัดที่เป็น Tag (เริ่มด้วย #), หรือเป็นลิงก์เต็มอยู่แล้ว (http) ให้ปล่อยผ่าน
            if (trimmedLine === '' || trimmedLine.startsWith('#') || trimmedLine.startsWith('http')) {
                return line;
            }
            // ถ้าเป็นชื่อไฟล์ .ts ให้นำ Base URL มาต่อข้างหน้า
            return baseUrl + trimmedLine;
        }).join('\n');

        // 6. ตั้งค่า Headers ให้เครื่องเล่นวิดีโอ (Player) เข้าใจและอนุญาตให้ดูข้ามโดเมนได้ (CORS)
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');

        // 7. ส่งไฟล์ M3U8 ที่ดัดแปลงแล้วกลับไป
        res.status(200).send(rewrittenM3u8);

    } catch (error) {
        res.status(500).send('Error fetching stream');
    }
}
