const fs=require('node:fs');
const path=require('node:path');
module.exports=async function sync(record,action){
 const file=path.join(require('./settings').data,'google-config.json');
 if(!fs.existsSync(file))throw Error('ยังไม่ได้ตั้งค่า Google กรุณาดู GOOGLE-SETUP.md');
 const config=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.url)||!config.secret)throw Error('การตั้งค่า Google ไม่ถูกต้อง');
 const pdfBase64=undefined; // Portable edition: Google Docs generates the PDF.
 const response=await fetch(config.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:config.secret,record,action,pdfBase64,pdfTemplate:pdfBase64?(record.type==='รายวัน'?'canva-daily-v1':'canva-monthly-v1'):undefined,imageUrl:action==='cardOcr'?record.imageUrl:undefined}),signal:AbortSignal.timeout(120000)});
 const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'บันทึก Google ไม่สำเร็จ');return result;
};
