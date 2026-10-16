const path=require('node:path');
const {promisify}=require('node:util');
const exec=promisify(require('node:child_process').execFile);
// Decoded from the owner's GSB merchant QR; preserve biller and reference fields.
function getSource(){const c=require('./settings').payment();if(!c.merchantQrPayload)throw Error('กรุณาตั้งค่า QR รับเงินก่อน');return c.merchantQrPayload;}
function crc(s){let c=0xffff;for(const byte of Buffer.from(s,'utf8')){c^=byte<<8;for(let i=0;i<8;i++)c=(c&0x8000)?((c<<1)^0x1021)&0xffff:(c<<1)&0xffff;}return c.toString(16).toUpperCase().padStart(4,'0');}
function payload(amount){const source=getSource();
 if(!Number.isFinite(amount)||amount<=0||amount>9999999999.99)throw Error('ยอดชำระไม่ถูกต้อง');
 if(crc(source.slice(0,-4))!==source.slice(-4))throw Error('QR ต้นฉบับไม่ถูกต้อง');
 let parts=[],i=0;while(i<source.length){const tag=source.slice(i,i+2),len=Number(source.slice(i+2,i+4)),v=source.slice(i+4,i+4+len);i+=4+len;if(tag==='63'||tag==='54')continue;parts.push([tag,tag==='01'?'12':v]);}
 parts.push(['54',amount.toFixed(2)]);parts.sort((a,b)=>Number(a[0])-Number(b[0]));
 const body=parts.map(([tag,v])=>tag+String(v.length).padStart(2,'0')+v).join('')+'6304';return body+crc(body);
}
const qrGenerator=require('./vendor/qrcode-generator');
const imageCache=new Map();
async function create(record){
 if(record.type!=='รายวัน')throw Error('รายเดือนยังไม่มียอดชำระในแบบฟอร์ม');
 const amount=require('./stay').due(record),data=payload(amount);
 let image=imageCache.get(data);
 if(!image){const code=qrGenerator(0,'M');code.addData(data);code.make();image=code.createDataURL(6,24);if(imageCache.size>=100)imageCache.delete(imageCache.keys().next().value);imageCache.set(data,image);}
 return {amount,merchant:require('./settings').payment().merchant,bank:require('./settings').payment().bank,image};
}
module.exports={create,payload,crc};
