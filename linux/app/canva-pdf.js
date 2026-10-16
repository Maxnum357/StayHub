const fs=require('node:fs');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
module.exports=async function(record,getImage){
 const r={...record};
 for(const [key,target] of [['photoUrl','tenantPhotoData'],['cardImageUrl','cardImageData']]){
  if(r[key])r[target]=(await getImage({imageUrl:r[key]},'imageData')).data;
 }
 const python=process.env.RENTAL_PYTHON||'python3';
 const input=path.join(require('./settings').data,'canva-'+record.recordId+'.json');
 const output=path.join(require('./settings').data,'pdf',String(record.recordId).replace(/[^A-Za-z0-9_-]/g,''),require('./stay').pdfFileName(record.pdfGeneratedAt,record.name));
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(input,JSON.stringify(r));
 try{await run(python,[path.join(__dirname,record.type==='รายวัน'?'generate-daily-canva-pdf.py':'generate-canva-pdf.py'),input,output],{timeout:60000});return fs.readFileSync(output).toString('base64');}
 finally{fs.unlinkSync(input);}
};
