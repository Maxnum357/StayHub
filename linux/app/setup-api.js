const fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os'),settings=require('./settings');
const json=(res,status,o)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(o));};
function id(s,kind,optional){s=String(s||'').trim();if(!s&&optional)return '';let m=s.match(kind==='sheet'?/\/spreadsheets\/d\/([\w-]+)/:/\/folders\/([\w-]+)/);let v=m?m[1]:s;if(!/^[\w-]{15,150}$/.test(v))throw Error('ลิงก์หรือ ID ของ '+kind+' ไม่ถูกต้อง');return v;}
function validate(c,finish){
 if(!c.propertyName||String(c.propertyName).length>100)throw Error('กรอกชื่อที่พักไม่เกิน 100 ตัวอักษร');
 c.staffIps=Array.isArray(c.staffIps)?c.staffIps:String(c.staffIps||'').split(',').map(s=>s.trim()).filter(Boolean);if(c.staffIps.some(ip=>!require('net').isIP(ip)))throw Error('IP คอมพนักงานไม่ถูกต้อง');
 c.rooms=Array.isArray(c.rooms)?c.rooms:String(c.rooms||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(!c.rooms.length||c.rooms.length>50||new Set(c.rooms).size!==c.rooms.length||c.rooms.some(s=>!s||s.length>20))throw Error('ระบุห้อง 1–50 ห้อง ไม่ซ้ำกัน');
 if(!Number.isFinite(Number(c.rate))||Number(c.rate)<0)throw Error('ราคาไม่ถูกต้อง');c.rate=Number(c.rate);
 if(c.googleEnabled){c.sheetId=id(c.sheetId,'sheet');c.pdfFolderId=id(c.pdfFolderId,'folder');c.dailyPdfFolderId=id(c.dailyPdfFolderId,'folder',true);c.monthlyPdfFolderId=id(c.monthlyPdfFolderId,'folder',true);c.photoFolderId=id(c.photoFolderId,'folder');c.monthlySheetId=id(c.monthlySheetId,'sheet',true);if(!/^[a-f0-9]{64}$/.test(c.secret||''))throw Error('รหัสเชื่อมต่อ Google ไม่ถูกต้อง');if(finish&&!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(c.googleUrl||''))throw Error('กรอก Web app URL ที่ลงท้าย /exec');}
 if(c.qrPayload){if(c.qrPayload.length>1000||!/^[0-9]{4}/.test(c.qrPayload)||require('./payment-qr').crc(c.qrPayload.slice(0,-4))!==c.qrPayload.slice(-4))throw Error('QR รับเงินไม่ถูกต้อง (CRC)');}
 return c;
}
module.exports=async function(req,res,url,access){
 if(url.pathname==='/qr-reader.js'){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8'});res.end(fs.readFileSync(path.join(__dirname,'vendor/jsQR.js')));return true;}
 if(url.pathname==='/property.js'){
   const c=settings.get();res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'});res.end('window.stayhubProperty='+JSON.stringify({propertyName:c.propertyName,address:c.address,manager:c.manager,rooms:c.rooms,rate:c.rate,dailyTemplateId:c.dailyTemplateId||'',monthlyTemplateId:c.monthlyTemplateId||''}).replace(/</g,'\\u003c')+';');return true;
 }
 if(url.pathname==='/assets/frame.svg'){res.writeHead(200,{'Content-Type':'image/svg+xml'});res.end(fs.readFileSync(path.join(__dirname,'assets/frame.svg')));return true;}
 if(!url.pathname.startsWith('/setup')&&!url.pathname.startsWith('/api/setup/'))return false;
 const ip=String(req.socket.remoteAddress||'').replace(/^::ffff:/,'');
 if(!['127.0.0.1','::1'].includes(ip)||(url.searchParams.get('admin')||req.headers['x-setup-key'])!==settings.admin){json(res,403,{error:'เปิดหน้าตั้งค่าผ่าน SSH tunnel พร้อม Setup key เท่านั้น'});return true;}
 if(url.pathname==='/setup'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"});res.end(fs.readFileSync(path.join(__dirname,'setup.html')));return true;}
 try{
  let c={};if(req.method==='POST'){let body='';for await(const b of req){body+=b;if(body.length>30000)throw Error('ข้อมูลใหญ่เกินกำหนด');}c=JSON.parse(body);}
  if(url.pathname==='/api/setup/ping'&&req.method==='GET'){json(res,200,{ok:true,product:'StayHub'});
  }else if(url.pathname==='/api/setup/config'&&req.method==='GET'){
   const current=settings.get(),p=settings.payment(),g=path.join(settings.data,'google-config.json');const google=fs.existsSync(g)?JSON.parse(fs.readFileSync(g,'utf8')):{};
   const out={...current,googleUrl:google.url||'',secret:google.secret||crypto.randomBytes(32).toString('hex'),qrPayload:p.merchantQrPayload||'',merchant:p.merchant||'',bank:p.bank||'',dataDirectory:settings.data};delete out.pinHash;delete out.pinSalt;
   out.links=Object.values(os.networkInterfaces()).flat().filter(e=>e.family==='IPv4'&&!e.internal).map(e=>'http://'+e.address+':'+(process.env.STAYHUB_PORT||8787)+'/?key='+access);
   json(res,200,out);
  }else if(url.pathname==='/api/setup/script'&&req.method==='POST'){
   c=validate(c,false);let source=fs.readFileSync(path.join(__dirname,'Google-Template.gs'),'utf8');
   // Replace placeholders within JS string literals safely.
   const safe=s=>String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' ');
   source=source.replaceAll('STAYHUB_PROPERTY',safe(c.propertyName)).replaceAll('STAYHUB_ADDRESS',safe(c.address)).replaceAll('STAYHUB_MANAGER',safe(c.manager));
   source+='\nfunction setupStayHub(){PropertiesService.getScriptProperties().setProperties('+JSON.stringify({SHEET_ID:c.sheetId,FOLDER_ID:c.pdfFolderId,DAILY_PDF_FOLDER_ID:c.dailyPdfFolderId||c.pdfFolderId,MONTHLY_PDF_FOLDER_ID:c.monthlyPdfFolderId||c.pdfFolderId,CARD_IMAGE_FOLDER_ID:c.photoFolderId,MONTHLY_SOURCE_ID:c.monthlySheetId||'',DAILY_TEMPLATE_ID:String(c.dailyTemplateId||'').trim(),MONTHLY_TEMPLATE_ID:String(c.monthlyTemplateId||'').trim(),SECRET:c.secret})+',false);}\n';
   json(res,200,{source});
  }else if(url.pathname==='/api/setup/test'&&req.method==='POST'){
   c=validate(c,true);if(!c.googleEnabled)throw Error('เปิดการเชื่อมต่อ Google ก่อนทดสอบ');
   const r=await fetch(c.googleUrl,{method:'POST',body:JSON.stringify({secret:c.secret,action:'health'}),signal:AbortSignal.timeout(25000)});const result=await r.json();if(!r.ok||!result.ok)throw Error(result.error||'Google ไม่พร้อม');json(res,200,{ok:true,message:'เข้าถึง Sheets และโฟลเดอร์ทั้งสองได้แล้ว'});
  }else if(url.pathname==='/api/setup/save'&&req.method==='POST'){
   c=validate(c,true);const old=settings.get();if(!/^\d{6}$/.test(c.pin||'')&&!old.pinHash)throw Error('ตั้งรหัสประวัติ 6 หลัก');if(c.pin&&!/^\d{6}$/.test(c.pin))throw Error('รหัสประวัติต้อง 6 หลัก');
   const salt=c.pin?crypto.randomBytes(16).toString('hex'):old.pinSalt;
   settings.save({complete:true,propertyName:c.propertyName,address:String(c.address||''),manager:String(c.manager||''),rooms:c.rooms,rate:c.rate,googleEnabled:!!c.googleEnabled,sheetId:c.sheetId||'',pdfFolderId:c.pdfFolderId||'',dailyPdfFolderId:c.dailyPdfFolderId||'',monthlyPdfFolderId:c.monthlyPdfFolderId||'',photoFolderId:c.photoFolderId||'',monthlySheetId:c.monthlySheetId||'',dailyTemplateId:String(c.dailyTemplateId||'').trim(),monthlyTemplateId:String(c.monthlyTemplateId||'').trim(),staffIps:c.staffIps,pinSalt:salt,pinHash:c.pin?settings.hashPin(c.pin,salt):old.pinHash});
   const g=path.join(settings.data,'google-config.json');if(c.googleEnabled)fs.writeFileSync(g,JSON.stringify({url:c.googleUrl,secret:c.secret,dailyPdfFolderId:c.dailyPdfFolderId||c.pdfFolderId,monthlyPdfFolderId:c.monthlyPdfFolderId||c.pdfFolderId}));else if(fs.existsSync(g))fs.unlinkSync(g);
   fs.writeFileSync(path.join(settings.data,'payment-config.json'),JSON.stringify({merchantQrPayload:c.qrPayload||'',merchant:c.merchant||c.propertyName,bank:c.bank||''}));
   json(res,200,{ok:true,url:'/?key='+access});
  }else json(res,404,{error:'ไม่พบคำสั่ง'});
 }catch(e){json(res,400,{error:e.message});}return true;
};
