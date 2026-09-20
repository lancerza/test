export default async function handler(req, res) {
    const { channel } = req.query;

    // ==========================================
    // ช่อง True4U
    // ==========================================
    if (channel === 'true4u') {
        try {
            // 1. ลองดึงจากเว็บ True4U ด้วยตัวเองก่อน (เผื่อเว็บ iptv36 ล่ม เราก็จะยังรอด)
            const response = await fetch('https://true4u.com/live/', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });
            const html = await response.text();

            // ค้นหาลิงก์แบบยืดหยุ่น ทะลวงรหัส JSON Escape (รองรับเครื่องหมาย \ ที่ซ่อนอยู่)
            const regex = /(https[^\s"']+(?:byteark\.com|true4u)[^\s"']+\.m3u8[^\s"']*)/i;
            const match = html.match(regex);

            if (match && match[1]) {
                // ล้างเครื่องหมาย \ (backslash) ออกให้หมดเพื่อให้ได้ลิงก์ที่ใช้งานได้จริง
                let finalUrl = match[1].replace(/\\/g, '');
                return res.redirect(302, finalUrl);
            } 
            
            // 2. แผนสำรอง (Fallback) หาก True4U ซ่อนลิงก์ลึกเกินไป
            // ให้วิ่งไปดึง Redirect Location ของ iptv36 มาใช้งานแทนแบบเนียนๆ
            const fallbackRes = await fetch('https://iptv36.vercel.app/api/true.m3u8?channel=true4u', {
                redirect: 'manual' // สำคัญมาก: สั่งไม่ให้วิ่งตามลิงก์ แต่ให้ดักจับว่ามันจะโยนไปไหน
            });

            // ดึงลิงก์ ByteArk + Token ล่าสุด จาก Header ที่ชื่อว่า 'location'
            const fallbackUrl = fallbackRes.headers.get('location');

            if (fallbackUrl) {
                // โยนผู้ชมไปยังลิงก์จริงที่ได้มา
                return res.redirect(302, fallbackUrl);
            }

            // ถ้าพังทั้ง 2 ทาง ค่อยยอมแพ้
            return res.status(404).send('ไม่พบลิงก์สตรีมบนเว็บ True4U และเซิร์ฟเวอร์สำรองไม่ตอบสนอง');

        } catch (error) {
            return res.status(500).send('Error fetching True4U: ' + error.message);
        }
    } 
    
    // ==========================================
    // ช่องอื่นๆ (สมมติถ้าอยากทำลิงก์ช่องอื่นเพิ่ม)
    // ==========================================
    else if (channel === 'ch3') {
        return res.redirect(302, 'https://ch3-33-web.cdn.byteark.com/live/playlist_720p/index.m3u8');
    }

    // กรณีพิมพ์ชื่อช่องผิด
    else {
        return res.status(404).send('Channel not found');
    }
}
