# stayhub — Linux Server

นำระบบปัจจุบันไปทำงานบน Linux Server ใน LAN คอมหน้าเคาน์เตอร์, iPad และ L01 ใช้หน้าเว็บจากเซิร์ฟเวอร์เดียวกัน รุ่นนี้รองรับหนึ่งรายการที่กำลังดำเนินการร่วมกัน ยังไม่ใช่ระบบหลายเคาน์เตอร์ที่แยกรายการพร้อมกัน

## ติดตั้ง

รองรับ Ubuntu 22.04 ขึ้นไป / Debian 12 ขึ้นไปแบบ 64 บิต x86_64 หรือ ARM64 ที่ใช้ systemd ต้องมีอินเทอร์เน็ตในการติดตั้งและสิทธิ์ sudo

Repository นี้เป็น **private** ต้องล็อกอิน GitHub ด้วยบัญชีที่ได้รับสิทธิ์ก่อน ไม่ต้องเปลี่ยนเป็น public และไม่ต้องใส่ token ลงในลิงก์

```sh
gh auth login
gh repo clone Maxnum357/StayHub stayhub
cd stayhub
sudo sh linux/install.sh
sudo stayhubctl links
```

หรือใช้ Git ที่ล็อกอินแล้ว: `git clone https://github.com/Maxnum357/StayHub.git stayhub`

หากติดตั้งจาก GitHub Release:

```sh
gh release download linux-v0.3.0 --repo Maxnum357/StayHub --pattern 'stayhub-linux-v0.3.0.tar.gz*'
sha256sum -c stayhub-linux-v0.3.0.tar.gz.sha256
mkdir -p stayhub-linux
tar -xzf stayhub-linux-v0.3.0.tar.gz -C stayhub-linux
sudo sh stayhub-linux/install.sh
```

## ตั้งค่าเริ่มต้น

1. จอง IP เซิร์ฟเวอร์และคอมพนักงานในเราเตอร์ เช่น 192.168.1.200 และ 192.168.1.188
2. จากคอมพนักงานเปิด tunnel: `ssh -L 8787:127.0.0.1:8787 USER@SERVER_IP` ถ้า port 8787 บนคอมใช้อยู่ ให้เปลี่ยนตัวแรกเป็น 18787 และเปิด localhost:18787 แทน
3. บนเซิร์ฟเวอร์เรียก `sudo stayhubctl links` แล้วเปิดลิงก์ Setup ผ่าน tunnel ตั้งชื่อที่พัก ห้อง ราคา PIN ประวัติ และ IP คอมพนักงาน
4. ตั้ง Google Sheets / Drive / Apps Script และ QR ของที่พักในหน้า Setup ต้องใช้บัญชีที่เข้าถึงชีตและโฟลเดอร์ที่กำหนด สคริปต์ที่ดาวน์โหลดมีค่าของการติดตั้งใหม่นี้ ไม่ใช้ค่าลับของเครื่องเดิม
5. หากใช้การอัปเดตแม่แบบ ระบุ Drive File ID ของ PDF รายวันและรายเดือน ส่งออก PDF จาก Canva แล้วแทนที่เวอร์ชันของไฟล์เดิมก่อนกดอัปเดต
6. iPad และ L01 ต้องใช้ URL ของเซิร์ฟเวอร์ใหม่จาก `stayhubctl links` ไม่ใช่ IP คอมเครื่องเดิม สำหรับ APK ที่ตรึง URL ไว้ต้องเปลี่ยนการตั้งค่า/สร้าง APK ใหม่

หน้า Setup อนุญาตเฉพาะ loopback พร้อม Setup key ใช้ SSH tunnel ตั้งค่าจากเครื่องอื่น ระบบไม่เปิด firewall และไม่ทำ port forwarding ให้อัตโนมัติ หากเปิด UFW อยู่ ให้เปิด TCP 8787 เฉพาะวง LAN ที่ใช้งานจริง ห้ามเปิดบริการ HTTP นี้สู่อินเทอร์เน็ตโดยตรง

## เครื่องอ่านบัตร Windows

Linux ไม่ใช้ PowerShell/ไดรเวอร์อ่านบัตร Windows โดยตรง ให้เสียบเครื่องอ่านที่คอมหน้าเคาน์เตอร์ ติดตั้ง Node.js 22+ จากผู้ผลิต แล้วคัดลอกโฟลเดอร์ `linux/windows-card-bridge` ไปคอมนั้น

คัดลอก `bridge-config.example.json` เป็น `bridge-config.json` ใส่ server URL และ accessKey จากลิงก์ LAN ให้ตรงกับเซิร์ฟเวอร์ เก็บไฟล์นี้เป็นความลับ และเพิ่ม IP คอมนี้ในหน้า Setup แล้วรัน:

```powershell
node bridge.cjs bridge-config.json
```

เปิดตัวเชื่อมไว้ระหว่างใช้งาน กดอ่านบัตรในหน้าเว็บ ระบบร้องขอให้คอมอ่านบัตรแล้วส่งผลกลับเข้าเซิร์ฟเวอร์ หาก Windows ปฏิเสธการรัน read-card.ps1 ให้ผู้ดูแลตรวจสิทธิ์/เซ็นสคริปต์ตามนโยบาย ไม่ปิดระบบความปลอดภัย การเด้งหน้าต่างแบบ always-on-top ของโปรแกรม Windows และตัวรับ AirPlay/StayHub Monitor ยังเป็นโปรแกรมฝั่ง Windows ไม่ได้ย้ายมารวมใน Linux service

## การพิมพ์และการทำงานเมื่อไม่มีเน็ต

สร้าง PDF ด้วย Python และแม่แบบที่เก็บบนเซิร์ฟเวอร์ จากนั้นพิมพ์จากคอมที่เสียบ Brother DCP-T220 ผ่าน USB การส่ง Google และดึงรูปที่มีเฉพาะ URL ใน Drive ยังต้องใช้อินเทอร์เน็ต รุ่นนี้ยังไม่ใช่ออฟไลน์ครบทุกขั้นตอน ไม่มีการนำข้อมูลลูกค้าเดิม ยอดเงิน/QR รับเงิน รหัสผ่าน หรือรูปบัตรมาใส่ในชุดติดตั้ง

## ดูแลระบบ

```sh
sudo stayhubctl status
sudo stayhubctl logs
sudo stayhubctl restart
sudo stayhubctl backup
```

ไฟล์โปรแกรมอยู่ `/opt/stayhub/current/app` ข้อมูลถาวรอยู่ `/var/lib/stayhub` ค่าพอร์ต/ที่อยู่รับฟังอยู่ `/etc/stayhub/stayhub.env` การสำรองหยุด service ชั่วครู่เพื่อเก็บข้อมูลให้สอดคล้องกัน ไฟล์สำรองรวมข้อมูลลูกค้าและค่าลับ ต้องเก็บอย่างปลอดภัยและคัดลอกไปอีกอุปกรณ์

อัปเดตด้วย `git pull --ff-only` แล้วรันตัวติดตั้งอีกครั้ง ข้อมูลเดิมและแม่แบบที่ใช้งานอยู่ไม่ถูกเขียนทับ เก็บ release เดิมไว้ rollback ได้ เริ่มจากทดสอบด้วยข้อมูลจำลองก่อนย้ายงานจริง
