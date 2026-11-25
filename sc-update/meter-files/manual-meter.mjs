import {METER_DEVICES} from './meter-devices.mjs';
export function validateManualMeter(b){
 if(!Object.hasOwn(METER_DEVICES,b.room||'')||!/^20\d\d-(0[1-9]|1[0-2])$/.test(b.period||''))throw Error('เลือกห้องและเดือนให้ถูกต้อง');
 for(const k of ['previous','current'])if(typeof b[k]!=='number'||!Number.isFinite(b[k])||b[k]<0||b[k]>1e9)throw Error('กรอกเลขมิเตอร์สะสมเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
 if(b.current<b.previous)throw Error('เลขปัจจุบันต้องไม่น้อยกว่าเลขครั้งก่อน หากเปลี่ยนมิเตอร์ให้ตรวจฐานก่อน');
 const reason=String(b.reason||'').trim();if(reason.length<3||reason.length>500)throw Error('ระบุเหตุผลการกรอกมือ 3–500 ตัวอักษร');
 return {room:b.room,period:b.period,previous:b.previous,current:b.current,units:Math.round((b.current-b.previous)*1000)/1000,reason};
}
export async function saveManualMeterUsage(env,body,actor){
 const b=validateManualMeter(body),now=new Date().toISOString(),key='manual-meter-usage:'+b.period+':'+b.room;
 const bill=await env.DB.prepare('SELECT id FROM bills WHERE room=? AND period=? AND approved=1 LIMIT 1').bind(b.room,b.period).first();if(bill)throw Error('งวดนี้มีบิลอนุมัติแล้ว กรุณาตรวจบิลก่อนแก้เลขมิเตอร์');
 const old=await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();const version=old?.value||'';if(String(body.version||'')!==version)throw Error('ข้อมูลกรอกมือมีการเปลี่ยนแปลง กรุณาอัปเดตแล้วตรวจใหม่');
 const value=JSON.stringify({...b,source:'manual',actor,at:now});
 await env.DB.batch([
 env.DB.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('manual-meter-audit:'+crypto.randomUUID(),JSON.stringify({previous:old?JSON.parse(old.value):null,next:JSON.parse(value)})),
 env.DB.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,value),
 env.DB.prepare("INSERT INTO meter_monthly_usage(period,room,device_id,previous,current,units,status,updated_at) VALUES(?,?,?,?,?,?,'ok',?) ON CONFLICT(period,room) DO UPDATE SET device_id=excluded.device_id,previous=excluded.previous,current=excluded.current,units=excluded.units,status=excluded.status,updated_at=excluded.updated_at").bind(b.period,b.room,METER_DEVICES[b.room],b.previous,b.current,b.units,now)
 ]);return {text:'บันทึกเลขกรอกมือห้อง '+b.room+' · '+b.period+' ใช้ '+b.units+' หน่วยแล้ว',reading:JSON.parse(value)};
}
function shiftPeriod(p,d){const [y,m]=p.split('-').map(Number),t=new Date(Date.UTC(y,m-1+d,15));return t.toISOString().slice(0,7);}
// Previous cumulative reading per room, in the same order the meter sheet's "เลขรอบก่อน" column uses.
export async function meterBaselines(env,now=Date.now()){
 const cur=new Date(now+7*3600000).toISOString().slice(0,7),periods=[-2,-1,0,1].map(d=>shiftPeriod(cur,d)),all=[...new Set([...periods,...periods.map(p=>shiftPeriod(p,-1))])],marks=all.map(()=>'?').join(',');
 const usage=(await env.DB.prepare('SELECT period,room,device_id,previous,current FROM meter_monthly_usage WHERE period IN ('+marks+')').bind(...all).all()).results;
 const snaps=(await env.DB.prepare('SELECT period,room,device_id,value FROM billing_meter_snapshots WHERE period IN ('+marks+')').bind(...all).all()).results;
 const manualRows=[];for(const p of all){const rows=(await env.DB.prepare("SELECT value FROM settings WHERE key LIKE ?").bind('manual-meter-usage:'+p+':%').all()).results;for(const r of rows){try{manualRows.push(JSON.parse(r.value));}catch{}}}
 const out=[];
 for(const p of periods){const pp=shiftPeriod(p,-1);for(const [room,device] of Object.entries(METER_DEVICES)){
  const u=usage.find(x=>x.period===p&&x.room===room),s=snaps.find(x=>x.period===pp&&x.room===room&&x.device_id===device),m=manualRows.find(x=>x.period===pp&&x.room===room),up=usage.find(x=>x.period===pp&&x.room===room);
  const pick=Number.isFinite(u?.previous)?{value:u.previous,source:'ชีตมิเตอร์ · เลขรอบก่อน งวด '+p}:s&&Number.isFinite(s.value)?{value:s.value,source:'ชีตมิเตอร์ · เลขตัดรอบ '+pp}:m&&Number.isFinite(m.current)?{value:m.current,source:'เลขกรอกมือ งวด '+pp}:Number.isFinite(up?.current)?{value:up.current,source:'เลขตัดรอบ '+pp}:null;
  if(pick)out.push({period:p,room,...pick});
 }}
 return out;
}
