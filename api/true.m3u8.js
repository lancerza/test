export default async function handler(req, res) {
    // 1. รับค่า channel จาก URL (?channel=true4u)
    const { channel } = req.query;

    // 2. กำหนดลิงก์ต้นฉบับ
    const channels = {
        'true4u': 'http://alb4k.tv:80/live/MAGWWMC2NN/MAGYAEYZAD/980406.m3u8', 
    };

    const sourceUrl = channels[channel];
    if (!sourceUrl) {
        return res.status(404).send('Channel not found');
    }

    try {
        // 3. ดึงข้อมูลไฟล์ M3U8 ต้นฉบับ
        const response = await fetch(sourceUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
        });
        
        const finalUrl = response.url;
        const m3u8Text = await response.text();

        // 4. แยก Base URL
        const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
        const urlObj = new URL(finalUrl);
        const originUrl = urlObj.origin; 

        // 5. เขียน URL ใหม่ (Rewrite)
        const rewrittenM3u8 = m3u8Text.split('\n').map(line => {
            const trimmedLine = line.trim();
            if (trimmedLine === '' || trimmedLine.startsWith('#') || trimmedLine.startsWith('http')) {
                return line;
            }
            if (trimmedLine.startsWith('/')) {
                return originUrl + trimmedLine;
            }
            return baseUrl + trimmedLine;
        }).join('\n');

        // 6. ตั้งค่า Headers ให้เครื่องเล่นวิดีโอ (Player) เข้าใจ
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
        
        // 🟢 เพิ่ม Header นี้เพื่อบอก Player ว่าเราไม่รองรับการส่งแบบทีละส่วน (Range)
        res.setHeader('Accept-Ranges', 'none'); 

        // 🟢 ถ้า Request มี Range มา ให้เพิกเฉยแล้วตอบ 200 แทน 206
        res.status(200).send(rewrittenM3u8);

    } catch (error) {
        res.status(500).send('Error fetching stream: ' + error.message);
    }
}
