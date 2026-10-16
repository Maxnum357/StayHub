# stayhub

ระบบลงทะเบียนผู้เข้าพักสำหรับคอม, iPad และจอ L01

## Linux Server v0.3.0

ตัวติดตั้ง systemd สำหรับ Ubuntu/Debian 64 บิต พร้อมหน้า Setup, Google Drive/Sheets, PDF Canva รุ่นปัจจุบัน และ Windows USB card bridge

```sh
gh auth login
gh repo clone Maxnum357/StayHub stayhub
cd stayhub
sudo sh linux/install.sh
sudo stayhubctl links
```

Repository เป็น private ต้องมีสิทธิ์ก่อนติดตั้ง ดู [คู่มือ Linux ฉบับเต็ม](linux/README.md) และ [Release notes](linux/RELEASE-NOTES.md)

ไฟล์ใน `linux/` เป็นรุ่นเซิร์ฟเวอร์ปัจจุบัน ส่วน `app/` และตัวติดตั้ง Windows ด้านล่างเป็นรุ่นเก่า ข้อมูลลูกค้าและค่าลับไม่ได้รวมอยู่ในชุดติดตั้ง

---

# StayHub

โปรแกรมลงทะเบียนผู้เข้าพัก พร้อมตัวติดตั้ง Windows 10/11 x64 และหน้าตั้งค่าครั้งแรก

## ติดตั้ง

ดาวน์โหลด `StayHub-Setup-1.0.0.exe` จาก Releases แล้วเปิดติดตั้ง เปิด StayHub จาก Desktop เพื่อตั้งค่าชื่อที่พัก ห้อง ราคา รหัสประวัติ Google Sheets / Drive และ QR รับเงิน

ดูรายละเอียดใน [คู่มือติดตั้ง](README-th.txt) และ [ผลการทดสอบ](TEST-RESULTS.txt)

## การเชื่อมต่อ Google

หน้า Setup สร้าง Apps Script สำหรับบัญชีของแต่ละที่พัก ผู้ติดตั้งต้องลงสคริปต์ ให้สิทธิ์ และนำ Web app URL กลับมาวางเอง มีปุ่มทดสอบการเข้าถึง Sheets และ Drive

รุ่นนี้สร้าง PDF มาตรฐานผ่าน Google Docs ไม่รวมแม่แบบ Canva หรือสัญญาของที่พักเดิม สัญญารายเดือนต้องแนบฉบับที่ที่พักตรวจสอบแล้ว

## ข้อมูล

ข้อมูลอยู่ที่ `%LOCALAPPDATA%\StayHub\data` แยกจากโฟลเดอร์ติดตั้ง ไม่รวมข้อมูลลูกค้า รหัส Google หรือ QR รับเงินของระบบเดิมใน repository นี้

## สร้างตัวติดตั้ง

ดู [BUILD.txt](BUILD.txt) ต้องใช้ Node.js x64, .NET Framework C# compiler และ NSIS 3.x ไฟล์ไบนารีแจกผ่าน GitHub Releases แยกจากซอร์ส

## สถานะ

รุ่นทดลองติดตั้ง 1.0.0 ผ่านการทดสอบติดตั้งและถอนบนเครื่องพัฒนา ยังไม่ได้ลงลายเซ็นผู้เผยแพร่ และยังต้องทดสอบบน Windows ใหม่ รวมถึงเครื่องอ่านบัตร บัญชี Google และแท็บเล็ตของผู้ติดตั้งจริงก่อนจำหน่าย

ดูข้อกำหนดและใบอนุญาตของส่วนประกอบใน [LICENSE.txt](LICENSE.txt)
