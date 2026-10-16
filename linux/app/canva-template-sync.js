const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{promisify}=require('node:util'),{execFile}=require('node:child_process');
const run=promisify(execFile);const pending={};
module.exports=function ensureLatest(fetchTemplate,python,kind='monthly'){if(!['daily','monthly'].includes(kind))throw Error('ประเภทแม่แบบไม่ถูกต้อง');if(pending[kind])return pending[kind];pending[kind]=refresh(fetchTemplate,python,kind).finally(()=>{delete pending[kind];});return pending[kind];};
async function refresh(fetchTemplate,python,kind){
 const sourcePath=path.join(require('./settings').data,kind==='daily'?'daily-canva-template-source.json':'canva-template-source.json'),target=path.join(process.env.STAYHUB_TEMPLATE_DIR||path.join(__dirname,'assets'),kind+'-canva.pdf');
 const state=fs.existsSync(sourcePath)?JSON.parse(fs.readFileSync(sourcePath,'utf8')):{};const selected=require('./settings').get()[kind+'TemplateId'];if(selected&&selected!==state.driveFileId){state.driveFileId=selected;state.driveVersion='';}
 if(!state.driveFileId)throw Error('กรุณาตั้งค่าแม่แบบใน Drive ก่อนสร้าง PDF');
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const cached=fs.existsSync(target)&&hash(fs.readFileSync(target))===state.sha256;
 let response;try{response=await fetchTemplate({version:cached?state.driveVersion||'':''},kind+'Template');}catch(e){throw Error('ตรวจแม่แบบล่าสุดใน Drive ไม่สำเร็จ: '+e.message);}
 if(response.fileId!==state.driveFileId||!response.version)throw Error('ปลายทางแม่แบบจาก Drive ไม่ตรงกับที่ตั้งค่า');
 if(response.unchanged){if(!cached||response.version!==state.driveVersion)throw Error('สำเนาแม่แบบไม่ตรงกับ Drive กรุณาลองใหม่');return {updated:false,version:response.version};}
 if(typeof response.data!=='string'||response.data.length>14000000)throw Error('ขนาดแม่แบบ PDF ไม่ถูกต้อง (สูงสุด 10 MB)');
 const bytes=Buffer.from(response.data,'base64');if(bytes.length<100||bytes.length>10000000||bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Drive ส่งไฟล์ที่ไม่ใช่ PDF');
 const temporary=target+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temporary,bytes);
 try{
  try{await run(python,[path.join(__dirname,'validate-canva-template.py'),temporary,path.join(__dirname,'assets/'+kind+'-layout.json'),kind],{timeout:20000});}catch(e){throw Error(String(e.stderr||'แม่แบบใหม่ไม่ผ่านการตรวจสอบ').trim());}
  fs.copyFileSync(target,target.replace('.pdf','.previous.pdf'));fs.renameSync(temporary,target);
  Object.assign(state,{driveVersion:response.version,sha256:hash(bytes),lastCheckedAt:new Date().toISOString(),lastImportedAt:new Date().toISOString(),status:'drive_latest_verified'});
  fs.writeFileSync(sourcePath+'.tmp',JSON.stringify(state,null,2));fs.renameSync(sourcePath+'.tmp',sourcePath);
  return {updated:true,version:response.version};
 }finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
