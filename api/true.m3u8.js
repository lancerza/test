export default async function handler(req, res) {
    const { channel } = req.query;

    if (channel !== 'true4u') {
        return res.status(404).send('Channel not found');
    }

    const sourceUrl = 'http://alb4k.tv:80/live/MAGWWMC2NN/MAGYAEYZAD/980406.m3u8';

    try {
        const response = await fetch(sourceUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!response.ok) throw new Error('Fetch failed');

        const m3u8Text = await response.text();
        
        // แยก Base URL
        const baseUrl = sourceUrl.substring(0, sourceUrl.lastIndexOf('/') + 1);

        // เขียนลิงก์ .ts ใหม่ให้เป็นลิงก์ตรง (Absolute URL)
        const rewrittenM3u8 = m3u8Text.split('\n').map(line => {
            const trimmedLine = line.trim();
            if (trimmedLine === '' || trimmedLine.startsWith('#') || trimmedLine.startsWith('http')) {
                return line;
            }
            // ใส่ Domain ต้นทางเข้าไปตรงๆ เพื่อให้เครื่องเล่นวิ่งไปโหลดเอง (เร็วที่สุด)
            return baseUrl + trimmedLine;
        }).join('\n');

        // ⭐️ แก้ปัญหา 416 Error: ปิดแคชทั้งหมด บังคับ Vercel ส่งออกแบบสดๆ
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); 

        return res.status(200).send(rewrittenM3u8);

    } catch (error) {
        return res.status(500).send('Error: ' + error.message);
    }
}
