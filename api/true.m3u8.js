export default async function handler(req, res) {
    const { channel } = req.query;

    // ==========================================
    // ช่อง True4U (ดึงลิงก์แท้จากเว็บ Official)
    // ==========================================
    if (channel === 'true4u') {
        try {
            // 1. จำลองเป็นคนเข้าไปเปิดหน้าเว็บทีวีสด
            const response = await fetch('https://true4u.com/live/', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            const html = await response.text();

            // 2. ใช้ Regex ควานหาลิงก์ ByteArk (m3u8) ที่มี Token ต่อท้าย
            // ค้นหาลิงก์รูปแบบ: https://true4u-p4ljv2.cdn.byteark.com/.../index.m3u8?x_ark_...
            const regex = /(https:\/\/[a-zA-Z0-9-]+\.cdn\.byteark\.com\/[^"']+\.m3u8[^"']*)/i;
            const match = html.match(regex);

            if (match && match[1]) {
                // คลีนลิงก์ให้สะอาด (ป้องกันเครื่องหมาย \ ติดมากับ JSON)
                let finalUrl = match[1].replace(/\\\//g, '/');
                
                // 3. หัวใจสำคัญ: สั่ง Redirect (302) ไปที่ลิงก์จริง!
                // เหมือนกับที่เว็บ iptv36 ทำ เบราว์เซอร์จะวิ่งไปเปิดลิงก์ยาวๆ นั้นทันที
                return res.redirect(302, finalUrl);
            } else {
                return res.status(404).send('ไม่พบลิงก์สตรีมบนเว็บ True4U ตอนนี้');
            }
        } catch (error) {
            return res.status(500).send('Error fetching True4U: ' + error.message);
        }
    } 
    
    // ==========================================
    // ช่องอื่นๆ (สมมติถ้าอยากทำลิงก์จากเว็บนอกแบบ Redirect)
    // ==========================================
    else if (channel === 'true4u_alb') {
        // ถ้าคุณมีลิงก์ตรงอยู่แล้ว ก็สามารถสั่ง Redirect โยนไปได้เลยเช่นกัน
        return res.redirect(302, 'http://alb4k.tv:80/live/MAGWWMC2NN/MAGYAEYZAD/980406.ts');
    } 
    
    // ==========================================
    // ถ้าพิมพ์ชื่อช่องผิด
    // ==========================================
    else {
        return res.status(404).send('Channel not found');
    }
}
