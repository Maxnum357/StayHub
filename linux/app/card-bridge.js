const crypto=require('node:crypto');
let pending=null;
function read(){if(pending)return Promise.reject(Error('เครื่องอ่านกำลังทำงาน'));return new Promise((resolve,reject)=>{const item={id:crypto.randomUUID(),resolve,reject,claimed:false};item.timer=setTimeout(()=>{if(pending===item)pending=null;reject(Error('ไม่พบ Windows card bridge หรือเครื่องอ่านไม่ตอบกลับ'));},22000);pending=item;});}
function next(){if(!pending||pending.claimed)return null;pending.claimed=true;return {requestId:pending.id};}
function finish(id,result){if(!pending||pending.id!==id)return false;const item=pending;pending=null;clearTimeout(item.timer);item.resolve(result);return true;}
module.exports={read,next,finish};
