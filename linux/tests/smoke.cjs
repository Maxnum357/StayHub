const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const app=path.resolve(__dirname,'../app'),data=fs.mkdtempSync(path.join(os.tmpdir(),'stayhub-test-'));
const port=19873,base='http://127.0.0.1:'+port;
process.env.STAYHUB_DATA_DIR=data;
const child=spawn(process.execPath,[path.join(app,'server.js')],{env:{...process.env,STAYHUB_HOST:'127.0.0.1',STAYHUB_PORT:String(port),STAYHUB_DISABLE_WATCHER:'1',STAYHUB_USE_CARD_BRIDGE:'1'},stdio:['ignore','pipe','pipe']});
let errors='';child.stderr.on('data',b=>errors+=b);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function request(route,body,extra={}){return fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});}
(async()=>{try{
  for(let i=0;i<60;i++){try{if((await fetch(base+'/healthz')).ok)break;}catch{}await pause(100);}
  assert.equal((await fetch(base+'/healthz')).status,200,errors);
  assert.equal((await fetch(base+'/api/records')).status,401);
  assert.equal((await fetch(base+'/api/setup/config')).status,403);
  const admin=fs.readFileSync(path.join(data,'setup-key'),'utf8').trim(),token=fs.readFileSync(path.join(data,'access-token'),'utf8').trim(),headers={'x-access-token':token};
  let r=await request('/api/setup/save',{propertyName:'StayHub Test',address:'Test',manager:'Test',rooms:['101','102'],rate:500,pin:'654321',googleEnabled:false,staffIps:[]},{'x-setup-key':admin});
  assert.equal(r.status,200,await r.text());
  assert.ok((await (await fetch(base+'/property.js')).text()).includes('StayHub Test'));
  assert.equal((await request('/api/history-unlock',{pin:'000000'},headers)).status,403);
  assert.equal((await request('/api/history-unlock',{pin:'654321'},headers)).status,200);
  const prefix='100000000000',sum=prefix.split('').reduce((s,c,i)=>s+Number(c)*(13-i),0),id=prefix+((11-sum%11)%10);
  const cardRead=request('/api/card',{},headers);await pause(200);
  const next=await (await request('/api/card-bridge/next',null,headers)).json();assert.ok(next.request.requestId);
  r=await request('/api/card-bridge/result',{requestId:next.request.requestId,result:{id,name:'Test Customer',address:'Test'}},headers);assert.equal((await r.json()).ok,true);
  assert.equal((await (await cardRead).json()).id,id);
  const signature='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=';
  const record={type:'à¸£à¸²à¸¢à¸§à¸±à¸™',id,name:'Test Customer',address:'Test address',birth:'1990-01-01',issue:'2020-01-01',expiry:'2030-01-01',phone:'0000000000',room:'101, 102',rooms:['101','102'],roomCount:2,checkin:'2026-10-16',checkout:'2026-10-18',rate:500,depositPaid:500,payment:'à¹€à¸‡à¸´à¸™à¸ªà¸”',channel:'Walk-in',tenantSignature:signature};
  r=await request('/api/records',record,headers);assert.equal(r.status,201);const saved=await r.json();assert.equal(saved.balanceDue,1500);
  r=await request('/api/records',null,headers);assert.equal((await r.json()).length,1);
  assert.ok(fs.existsSync(path.join(data,'records.json')));
  if(process.env.STAYHUB_TEST_PYTHON){process.env.RENTAL_PYTHON=process.env.STAYHUB_TEST_PYTHON;const generate=require(path.join(app,'canva-pdf'));const pdf=Buffer.from(await generate(saved,()=>{throw Error('Unexpected network fetch');}),'base64');assert.equal(pdf.subarray(0,5).toString(),'%PDF-');const monthly=Buffer.from(await generate({...saved,type:'รายเดือน',recordId:saved.recordId+'-monthly',leaseTerm:'6 เดือน'},()=>{throw Error('Unexpected network fetch');}),'base64');assert.equal(monthly.subarray(0,5).toString(),'%PDF-');}
  console.log('PASS: clean setup, authentication, PIN, card bridge, registration, deposit and local PDF.');
}finally{child.kill();await new Promise(r=>child.once('exit',r));fs.rmSync(data,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
