const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const stay = require('./stay');
const googleSync=require('./google-sync');
const {execFile,spawn} = require('node:child_process');
const historySessions=new Map(),historyAttempts=new Map();
function historyAddress(req){return String(req.socket.remoteAddress||'').replace(/^::ffff:/,'');}
function historyLocal(req){const ip=historyAddress(req);return ip==='127.0.0.1'||ip==='::1'||(require('./settings').get().staffIps||[]).includes(ip)||Object.values(os.networkInterfaces()).some(list=>(list||[]).some(e=>e.address===ip));}
function historyAllowed(req){if(historyLocal(req))return true;const session=historySessions.get(req.headers['x-history-session']);return !!session&&session.address===historyAddress(req)&&session.expires>Date.now();}
const desktopCloseTimers=new Map();
let cardWatcher;
let readingCard = false;
let sharedDraft = null;
let liveCard=null,liveCardRevision=0,liveCardEventId=null,pendingCard=null,displayResetId=null;
function resetActiveRegistration(){sharedDraft=null;liveCard=null;pendingCard=null;liveCardEventId=null;displayResetId=crypto.randomUUID();liveCardRevision++;}
const root = __dirname;
const data = require('./settings').data;
fs.mkdirSync(data, {recursive:true});
const tokenFile = path.join(data,'access-token');
const token = fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile,'utf8') : crypto.randomBytes(18).toString('hex');
fs.writeFileSync(tokenFile,token);
const recordsFile = path.join(data,'records.json');
let records = fs.existsSync(recordsFile) ? JSON.parse(fs.readFileSync(recordsFile,'utf8')) : [];
const save = () => { fs.writeFileSync(recordsFile+'.tmp',JSON.stringify(records,null,2)); fs.renameSync(recordsFile+'.tmp',recordsFile); };
const cardQueueFile=path.join(data,'card-sync-queue.json');
let cardQueue=fs.existsSync(cardQueueFile)?JSON.parse(fs.readFileSync(cardQueueFile,'utf8')):[],syncingCards=false;
function saveCardQueue(){fs.writeFileSync(cardQueueFile+'.tmp',JSON.stringify(cardQueue));fs.renameSync(cardQueueFile+'.tmp',cardQueueFile);}
async function syncCards(){
 if(syncingCards)return;syncingCards=true;
 try{while(cardQueue.length){await googleSync(cardQueue[0],'cardLog');cardQueue.shift();saveCardQueue();}}
 catch{console.log('บันทึกประวัติอ่านบัตร Google ยังไม่สำเร็จ เก็บคิวไว้ลองใหม่');}
 finally{syncingCards=false;}
}
setInterval(syncCards,30000).unref();
function reply(res,status,obj) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));}
http.createServer(async(req,res)=>{
 const url = new URL(req.url,'http://localhost');
 res.setHeader('Referrer-Policy','no-referrer');
 if(url.pathname==='/signature.js'&&/LenovoKitKat/i.test(req.headers['user-agent']||'')){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(fs.readFileSync(path.join(root,'signature-legacy.js')));}

 if(['/typography.css','/history-access.js','/signature-diagnostics.js','/payment-poster.js','/daily-card-upload.js','/signature.js','/app-legacy.js','/schema.js','/stay.js','/date-controls.js','/print-form.js','/print-form.css','/ocr-fields.js','/monthly-template.js','/monthly-print.js','/monthly-print.css'].includes(url.pathname)) {res.writeHead(200,{'Content-Type':url.pathname.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8','Cache-Control':'no-store'}); return res.end(fs.readFileSync(path.join(root,url.pathname.slice(1))));}
 if(url.pathname==='/assets/payment-poster.jpg'){res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=86400'});return res.end(fs.readFileSync(path.join(root,'assets','payment-poster.jpg')));}
 if(/^\/assets\/fonts\/(?:Montserrat|NotoSansThai)-(?:Regular|Bold)\.ttf$/.test(url.pathname)){res.writeHead(200,{'Content-Type':'font/ttf','Cache-Control':'public, max-age=86400'});return res.end(fs.readFileSync(path.join(root,url.pathname.slice(1))));}
 if(url.pathname==='/assets/apple-touch-icon.png'||url.pathname==='/apple-touch-icon.png'||url.pathname==='/apple-touch-icon-precomposed.png'){res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=3600'});return res.end(fs.readFileSync(path.join(root,'assets','apple-touch-icon.png')));}
 if(url.pathname==='/healthz'){return reply(res,200,{ok:true,product:'stayhub',version:'0.3.0'});}
 if(await require('./setup-api')(req,res,url,token))return;
 if(url.pathname === '/') {res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}); return res.end(fs.readFileSync(path.join(root,require('./settings').get().complete?'index.html':'setup.html')));}
 if(url.pathname==='/api/desktop-presence'&&req.method==='POST'){
  try{let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)return reply(res,413,{});}const message=JSON.parse(body);
   if(!historyLocal(req)||message.key!==token||!message.windowId)return reply(res,403,{});
   const previous=desktopCloseTimers.get(message.windowId);if(previous)clearTimeout(previous);desktopCloseTimers.delete(message.windowId);
   if(message.action==='close'){const timer=setTimeout(()=>{desktopCloseTimers.delete(message.windowId);resetActiveRegistration();},1200);desktopCloseTimers.set(message.windowId,timer);}
   return reply(res,200,{ok:true});
  }catch{return reply(res,400,{});}
 }
 if(req.headers['x-access-token'] !== token) return reply(res,401,{error:'ลิงก์เข้าใช้งานไม่ถูกต้อง'});
 try {
 if(url.pathname==='/api/history-unlock'&&req.method==='POST'){
  const address=historyAddress(req),attempt=historyAttempts.get(address)||{count:0,until:0};
  if(attempt.until>Date.now())return reply(res,429,{error:'กรอกรหัสผิดหลายครั้ง กรุณารอ 1 นาที'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>1024)return reply(res,413,{});}
  const pin=String(JSON.parse(body).pin||'');
  if(!require('./settings').verifyPin(pin)){attempt.count++;if(attempt.count>=5){attempt.until=Date.now()+60000;attempt.count=0;}historyAttempts.set(address,attempt);return reply(res,403,{error:'รหัสไม่ถูกต้อง'});}
  historyAttempts.delete(address);const session=crypto.randomBytes(24).toString('hex');
  for(const [key,value] of historySessions)if(value.expires<=Date.now())historySessions.delete(key);
  historySessions.set(session,{address,expires:Date.now()+300000});return reply(res,200,{session,expiresIn:300});
 }
 if(url.pathname==='/api/signature-diagnostics'&&req.method==='POST'){let body='';for await(const c of req){body+=c;if(body.length>4096)return reply(res,413,{});}const info=JSON.parse(body);fs.writeFileSync(path.join(data,'signature-diagnostics.json'),JSON.stringify({padReady:info.padReady===true,createPad:String(info.createPad).slice(0,30),fieldCount:Number(info.fieldCount),errors:Array.isArray(info.errors)?info.errors.slice(0,5):[],at:new Date().toISOString()}));return reply(res,200,{ok:true});}
 if(url.pathname==='/api/card-upload-ocr'&&req.method==='POST'){
 let body='';for await(const chunk of req){body+=chunk;if(body.length>4500000)return reply(res,413,{error:'รูปใหญ่เกินกำหนด'});}
 var upload;try{upload=JSON.parse(body);}catch{return reply(res,400,{error:'ข้อมูลรูปไม่ถูกต้อง'});}
 if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(upload.imageData||''))return reply(res,400,{error:'กรุณาใช้ภาพบัตร JPG ที่ถูกต้อง'});
 try{return reply(res,200,await googleSync(upload,'cardUploadOcr'));}catch(e){return reply(res,400,{error:e.message});}
 }
 if(url.pathname==='/api/card-ocr'&&req.method==='POST'){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return reply(res,413,{error:'ข้อมูลใหญ่เกินกำหนด'});}
  try{return reply(res,200,await googleSync(JSON.parse(body),'cardOcr'));}catch(e){return reply(res,400,{error:e.message});}
 }
 if(url.pathname==='/api/monthly-rows'&&req.method==='GET'){
  try{return reply(res,200,await googleSync(null,'monthlyRows'));}catch(e){return reply(res,400,{error:e.message});}
 }
 if(url.pathname==='/api/payment-qr'&&req.method==='POST'){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return reply(res,413,{error:'ข้อมูลใหญ่เกินกำหนด'});}
  const paymentRequest=JSON.parse(body);
  const record=paymentRequest.live===true?liveCard:records.find(r=>r.recordId===paymentRequest.recordId);
  if(paymentRequest.live===true&&(!record||record.confirmedAt||record.payment!=='เงินโอน'||record.paymentChosen!==true))return reply(res,409,{error:'กรุณาเลือกเงินโอนและยืนยันวันที่ออกบนคอมก่อน'});
  if(!record)return reply(res,404,{error:'ไม่พบรายการที่ยืนยัน'});
  if(record.channel==='Online'||record.payment!=='เงินโอน')return reply(res,409,{error:'รายการนี้ไม่ต้องชำระผ่าน QR'});
  try{return reply(res,200,await require('./payment-qr').create(record));}catch(e){return reply(res,400,{error:e.message});}
 }
 if(['/api/monthly-template/refresh','/api/daily-template/refresh'].includes(url.pathname)&&req.method==='POST'){
  if(!historyLocal(req))return reply(res,403,{error:'อัปเดตแม่แบบได้เฉพาะคอมเครื่องหลัก'});
  try{const python=process.env.RENTAL_PYTHON||'python3';const result=await require('./canva-template-sync')(googleSync,python,url.pathname.includes('/daily-')?'daily':'monthly');return reply(res,200,{ok:true,...result,checkedAt:new Date().toISOString()});}catch(e){return reply(res,400,{error:e.message});}
 }
 if(url.pathname==='/api/google-sync'&&req.method==='POST'){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return reply(res,413,{error:'ข้อมูลใหญ่เกินกำหนด'});}
  const {recordId}=JSON.parse(body),record=records.find(r=>r.recordId===recordId);if(!record)return reply(res,404,{error:'ไม่พบรายการ'});
  try{const result=await googleSync(record);record.google={pdfUrl:result.pdfUrl,sheetUrl:result.sheetUrl,syncedAt:new Date().toISOString()};save();return reply(res,200,result);}catch(e){return reply(res,400,{error:e.message});}
 }
 if(url.pathname==='/api/live-card'&&req.method==='GET'){const screenRecord=url.searchParams.get('client')==='ipad'&&liveCard&&liveCard.displayPending===true?pendingCard:liveCard;return reply(res,200,{revision:liveCardRevision,eventId:liveCardEventId,resetId:displayResetId,record:url.searchParams.get('eventOnly')==='1'?(liveCard?{}:null):screenRecord});}
 if(url.pathname==='/api/display-qr'&&req.method==='POST'){
  if(!historyAllowed(req))return reply(res,403,{error:'กรอกรหัสเปิดรายการก่อนส่ง QR'});
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return reply(res,413,{});}
  const record=records.find(r=>r.recordId===JSON.parse(body).recordId);
  if(!record||record.type!=='รายวัน'||record.payment!=='เงินโอน'||record.channel==='Online')return reply(res,400,{error:'เลือกเฉพาะรายการรายวันที่ชำระเงินโอน'});
  const replayId=crypto.randomUUID();liveCard={...record,tenantSignature:undefined,staffSignature:undefined,qrReplayId:replayId};liveCardRevision++;liveCardEventId=replayId;
  return reply(res,200,{sent:true});
 }
 if(url.pathname==='/api/draft'&&req.method==='DELETE'){resetActiveRegistration();return reply(res,200,{cleared:true});}
 if(url.pathname==='/api/draft'&&req.method==='POST'){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>65536)return reply(res,413,{error:'ข้อมูลใหญ่เกินกำหนด'});}
  const draft=JSON.parse(body);if(!/^\d{13}$/.test(draft.id||''))return reply(res,400,{error:'เลขบัตรยังไม่ครบ'});
  const displayReady=draft.displayReady===true,displayEvent=draft.displayEvent===true;
  delete draft.displayReady;delete draft.displayEvent;delete draft.tenantSignature;delete draft.staffSignature;sharedDraft=draft;
  if(historyLocal(req)&&pendingCard&&pendingCard.id===draft.id&&displayReady&&draft.type==='รายวัน'&&stay.nights(draft)>0){liveCard={...draft,photo:pendingCard.photo};liveCardRevision++;if(displayEvent||!liveCardEventId)liveCardEventId=crypto.randomUUID();}
  else if(historyLocal(req)&&liveCard&&liveCard.id===draft.id){liveCard={...draft,photo:liveCard.photo};liveCardRevision++;}
  return reply(res,200,{saved:true});
 }
 if(url.pathname==='/api/card-bridge/next'&&req.method==='GET'){if(!historyLocal(req))return reply(res,403,{error:'ตั้ง IP คอมพนักงานก่อน'});return reply(res,200,{ok:true,request:require('./card-bridge').next()});}
 if(url.pathname==='/api/card-bridge/result'&&req.method==='POST'){if(!historyLocal(req))return reply(res,403,{});let body='';for await(const c of req){body+=c;if(body.length>262144)return reply(res,413,{});}const payload=JSON.parse(body);return reply(res,200,{ok:require('./card-bridge').finish(payload.requestId,payload.result)});}
 if(req.method === 'POST' && url.pathname === '/api/card') {
  if(readingCard) return reply(res,409,{error:'กำลังอ่านบัตร กรุณารอสักครู่'});
  readingCard=true;
  const executeCard=process.platform==='win32'&&process.env.STAYHUB_USE_CARD_BRIDGE!=='1'?(callback)=>execFile('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'read-card.ps1')],{windowsHide:true,timeout:20000,maxBuffer:65536,encoding:'utf8'},callback):(callback)=>require('./card-bridge').read().then(result=>callback(null,JSON.stringify(result))).catch(error=>callback(null,JSON.stringify({error:error.message})));
  executeCard((err,stdout)=>{
   readingCard=false;
   try {const result=JSON.parse(stdout.trim());
    if(!result.error){cardQueue.push({...result,origin:'read-button',eventId:crypto.randomUUID(),readAt:new Date().toISOString()});saveCardQueue();syncCards();}
    const card=!result.error&&sharedDraft&&sharedDraft.id===result.id?{...sharedDraft,photo:result.photo,shared:true}:result;
    if(!result.error){pendingCard=card;displayResetId=null;liveCard={displayPending:true};liveCardRevision++;liveCardEventId=crypto.randomUUID();}
    reply(res,result.error?400:200,card);}
   catch {reply(res,500,{error:'เชื่อมเครื่องอ่านไม่สำเร็จ กรุณาลองใหม่'});}
  });
  return;
 }
 if(req.method === 'GET' && url.pathname === '/api/records'){if(!historyAllowed(req))return reply(res,403,{error:'กรอกรหัสก่อนเปิดรายการที่ยืนยันแล้ว'});return reply(res,200,records);}
 if(req.method==='DELETE'&&url.pathname==='/api/records'){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)return reply(res,413,{error:'ข้อมูลใหญ่เกินกำหนด'});}
  const {recordId}=JSON.parse(body);const found=records.find(r=>r.recordId===recordId);if(!found)return reply(res,404,{error:'ไม่พบรายการ'});
  const trash=path.join(data,'deleted-records.json');const deleted=fs.existsSync(trash)?JSON.parse(fs.readFileSync(trash,'utf8')):[];deleted.push({...found,deletedAt:new Date().toISOString()});fs.writeFileSync(trash,JSON.stringify(deleted,null,2));
  records=records.filter(r=>r.recordId!==recordId);save();return reply(res,200,{deleted:true});
 }
 if(req.method === 'POST' && url.pathname === '/api/records') {
 let body=''; for await(const chunk of req){body+=chunk;if(body.length>6500000) return reply(res,413,{error:'ข้อมูลใหญ่เกินกำหนด'});}
 const r=JSON.parse(body);
 if(!['รายวัน','รายเดือน'].includes(r.type))return reply(res,400,{error:'ประเภทการเช่าไม่ถูกต้อง'});
 if(r.cardImageData){if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.cardImageData)||r.cardImageData.length>4500000)return reply(res,400,{error:'รูปบัตรไม่ถูกต้อง'});if(r.type!=='รายวัน'||r.identitySource!=='uploaded-card-image'||r.identityReviewed!==true||typeof r.identityReviewer!=='string'||!r.identityReviewer.trim()||r.identityReviewer.length>100)return reply(res,400,{error:'กรุณาให้พนักงานตรวจรูปบัตรและยืนยันข้อมูล'});r.identityReviewedAt=new Date().toISOString();}

 if(r.photo&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.photo))return reply(res,400,{error:'รูปบัตรไม่ถูกต้อง'});
 if(!r.name || !r.room || !r.checkin || !r.tenantSignature || (r.type==='รายเดือน'?!r.leaseTerm:!r.checkout)) return reply(res,400,{error:'ข้อมูลและลายเซ็นยังไม่ครบ'});
 if(!/^\d{13}$/.test(r.id)) return reply(res,400,{error:'เลขบัตรต้องมี 13 หลัก'});
 const sum = r.id.slice(0,12).split('').reduce((s,c,i)=>s+Number(c)*(13-i),0);
 if((11-sum%11)%10 !== Number(r.id[12])) return reply(res,400,{error:'เลขบัตรไม่ผ่านการตรวจสอบหลักตรวจสอบ'});
 if(r.type!=='รายเดือน'&&(r.checkout<=r.checkin || !Number.isFinite(Number(r.rate)) || Number(r.rate)<0)) return reply(res,400,{error:'ตรวจวันที่และราคา'});
 if(r.type==='รายวัน') {
  if(!Array.isArray(r.rooms)||r.rooms.length!==Number(r.roomCount)||new Set(r.rooms).size!==r.rooms.length||r.rooms.some(room=>!require('./settings').get().rooms.includes(room))||!Number.isInteger(Number(r.roomCount))||Number(r.roomCount)<1||Number(r.roomCount)>require('./settings').get().rooms.length||!Number.isInteger(stay.nights(r))||stay.nights(r)<1) return reply(res,400,{error:'เลือกห้องไม่ซ้ำตามจำนวนห้อง (1–5) และวันที่ออกต้องหลังวันที่เข้า'});
  r.room=r.rooms.join(', ');
  if(!r.address||!r.birth||!r.issue||!r.expiry||!r.phone)return reply(res,400,{error:'กรุณากรอกข้อมูลรายวันให้ครบ ยกเว้นทะเบียนรถ'});
  if(r.channel==='Online')r.payment='ชำระผ่านระบบออนไลน์';
  if(!['Walk-in','Online'].includes(r.channel)||(r.channel==='Walk-in'&&!['เงินสด','เงินโอน'].includes(r.payment)))return reply(res,400,{error:'เลือกการชำระเงินและช่องทางเข้าพัก'});
  if(![0,10].includes(Number(r.discountPercent||0)))return reply(res,400,{error:'ส่วนลดต้องเป็น 0 หรือ 10%'});
  if(stay.depositError(r))return reply(res,400,{error:stay.depositError(r)});
  r.depositPaid=stay.deposit(r);r.balanceDue=stay.due(r);
  r.discountPercent=Number(r.discountPercent||0);r.rate=Number(r.rate);r.roomCount=Number(r.roomCount);r.nights=stay.nights(r);r.subtotal=r.rate*r.nights*r.roomCount;r.total=stay.total(r);r.discountAmount=Math.round((r.subtotal-r.total)*100)/100;r.checkinTime='13:00';r.checkoutTime='12:00';
 }
 for(const k of ['tenantSignature']) if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(r[k])) return reply(res,400,{error:'รูปแบบลายเซ็นไม่ถูกต้อง'});
 r.recordId=crypto.randomUUID();r.confirmedAt=new Date().toISOString();records.push(r);save();
 if(liveCard&&liveCard.id===r.id){liveCard={...r,tenantSignature:undefined,staffSignature:undefined};liveCardRevision++;}
 if(sharedDraft&&sharedDraft.id===r.id)sharedDraft=null;return reply(res,201,r);
 }
 reply(res,404,{error:'ไม่พบรายการ'});
 }catch(e){reply(res,400,{error:'ไม่สามารถบันทึกข้อมูลได้'});}
}).listen(Number(process.env.STAYHUB_PORT||8787),process.env.STAYHUB_HOST||'0.0.0.0',()=>{
 if(process.platform==='win32'&&process.env.STAYHUB_DISABLE_WATCHER!=='1'){
  cardWatcher=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(root,'watch-card.ps1'),'-ServerPid',String(process.pid)],{windowsHide:true,stdio:'ignore'});
  cardWatcher.on('error',()=>console.log('Automatic card window could not start'));
 }
 console.log('StayHub started; use stayhubctl links to view private access links.');
});
process.on('exit',()=>{if(cardWatcher)cardWatcher.kill();});
