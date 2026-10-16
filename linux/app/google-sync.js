const fs=require('node:fs');
const path=require('node:path');
module.exports=async function sync(record,action){
 const file=path.join(require('./settings').data,'google-config.json');
 if(!fs.existsSync(file))throw Error('ยังไม่ได้ตั้งค่า Google กรุณาดู GOOGLE-SETUP.md');
 const config=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.url)||!config.secret)throw Error('การตั้งค่า Google ไม่ถูกต้อง');
 if(!action&&record){const stamp=new Date().toISOString();record={...record,pdfGeneratedAt:stamp,pdfFileName:require('./stay').pdfFileName(stamp,record.name)};}
 const pdfBase64=!action&&record?await require('./canva-pdf')(record,module.exports):undefined;
 const body=JSON.stringify({secret:config.secret,record,action,pdfBase64,pdfTemplate:pdfBase64?(record.type==='รายวัน'?'canva-daily-v1':'canva-monthly-v1'):undefined,imageUrl:action==='cardOcr'?record.imageUrl:undefined});
 for(let attempt=0;attempt<2;attempt++){
  const response=await fetch(config.url,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(65000)});
  const raw=await response.text();let result;
  try{result=JSON.parse(raw.replace(/^\uFEFF/,''));}catch{
   const login=new URL(response.url||config.url).hostname==='accounts.google.com'||/accounts\.google\.com\/ServiceLogin|Sign in to continue/i.test(raw);
   if(login||[401,403].includes(response.status))throw Error('Google ขอให้ตรวจสิทธิ์เว็บแอป กรุณาตรวจการเผยแพร่และสิทธิ์บัญชี Google');
   if(attempt===0){await new Promise(resolve=>setTimeout(resolve,1200));continue;}
   throw Error('Google ส่งหน้าเว็บแทนข้อมูลตอบกลับ (HTTP '+response.status+') กรุณาลองกด Google / พิมพ์ส่งอีกครั้ง ข้อมูลรายการยังอยู่');
  }
  if(!response.ok||!result||result.ok!==true)throw Error(result&&result.error||'บันทึก Google ไม่สำเร็จ');
  return result;
 }
};
