export default async function handler(req, res) {
    const { channel } = req.query;

    const channels = {
        'true4u': 'http://alb4k.tv:80/live/MAGWWMC2NN/MAGYAEYZAD/980406.m3u8', 
    };

    const sourceUrl = channels[channel];
    if (!sourceUrl) {
        return res.status(404).send('Channel not found');
    }

    try {
        // 1. ดึงแค่ไฟล์ M3U8 ต้นฉบับมา (แค่ไฟล์ Text เบามาก)
        const response = await fetch(sourceUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const finalUrl = response.url;
        const m3u8Text = await response.text();

        // 2. แยก Base URL และ Origin
        const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
        const urlObj = new URL(finalUrl);
        const originUrl = urlObj.origin; 

        // 3. ⭐️ ห้วใจสำคัญ: แปลงร่างลิงก์ .ts ทุกบรรทัด ให้เป็นลิงก์สมบูรณ์ (Absolute URL)
        const rewrittenM3u8 = m3u8Text.split('\n').map(line => {
            const trimmedLine = line.trim();
            
            if (trimmedLine === '' || trimmedLine.startsWith('#')) {
                return line;
            }
            // ถ้าลิงก์มันสมบูรณ์อยู่แล้ว ให้ข้าม
            if (trimmedLine.startsWith('http')) {
                return trimmedLine;
            }
            // ถ้าเป็นลิงก์สัมพัทธ์แบบเริ่มด้วย /
            if (trimmedLine.startsWith('/')) {
                return originUrl + trimmedLine;
            }
            // ถ้าเป็นชื่อไฟล์เฉยๆ (เช่น 980406.ts) ให้เอา baseUrl มาแปะหน้า
            return baseUrl + trimmedLine;
        }).join('\n');

        // 4. ส่งไฟล์ M3U8 ที่เขียนเสร็จแล้ว กลับไปให้เครื่องเล่น (Player)
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
        res.setHeader('Accept-Ranges', 'none'); 

        // ส่ง Status 200 และเนื้อหา
        return res.status(200).send(rewrittenM3u8);

    } catch (error) {
        return res.status(500).send('Error fetching stream: ' + error.message);
    }
}
