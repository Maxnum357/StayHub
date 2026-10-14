const fs=require('fs'),path=require('path'),crypto=require('crypto');
const data=process.env.STAYHUB_DATA_DIR||path.join(process.env.LOCALAPPDATA||process.env.HOME,'StayHub','data');fs.mkdirSync(data,{recursive:true});
const file=path.join(data,'settings.json');
function get(){return Object.assign({complete:false,propertyName:'StayHub',address:'',manager:'',rooms:['101','102','103'],rate:500},fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{});}
function save(c){fs.writeFileSync(file+'.tmp',JSON.stringify(c,null,2));fs.renameSync(file+'.tmp',file);}
function payment(){const f=path.join(data,'payment-config.json');return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):{};}
function hashPin(pin,salt){return crypto.scryptSync(pin,salt,32).toString('hex');}
function verifyPin(pin){const c=get();return !!c.pinHash&&hashPin(pin,c.pinSalt)===c.pinHash;}
const adminFile=path.join(data,'setup-key');if(!fs.existsSync(adminFile))fs.writeFileSync(adminFile,crypto.randomBytes(32).toString('hex'));
module.exports={data,get,save,payment,hashPin,verifyPin,admin:fs.readFileSync(adminFile,'utf8').trim()};
