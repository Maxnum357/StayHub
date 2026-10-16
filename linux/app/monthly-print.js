(function(root){root.renderMonthlyForm=function(doc,r){
 doc.textContent='';doc.className='monthly-contract';
 function add(tag,value,parent,cls){var el=document.createElement(tag);el.textContent=value||'';if(cls)el.className=cls;parent.appendChild(el);return el;}
 var signature;
 for(var i=0;i<3;i++){
  var page=add('section','',doc,'contract-page');add('h1','สัญญาเช่า • ซานชาย เพลส',page);add('p','เลขที่ห้องเช่า '+r.room+' • หน้า '+(i+1)+' / 3',page,'contract-meta');
  if(i===0){add('p','สัญญานี้เรียกว่าสัญญาเช่าที่พักอาศัย โดย นายมนเดช จันทรักษ์ ผู้จัดการอาคาร หอพักซานชาย เพลส เลขที่ 521 หมู่ 3 ต.พนมไพร อ.พนมไพร จ.ร้อยเอ็ด 45140',page);
   var fields=[['name','ชื่อ–สกุลผู้เช่า'],['nickname','ชื่อเล่น'],['id','บัตรประชาชนเลขที่'],['address','ที่อยู่'],['phone','เบอร์ติดต่อ'],['email','E-mail'],['line','LINE'],['issue','วันออกบัตร'],['expiry','วันหมดอายุ'],['plate','ทะเบียนรถ'],['workAddress','ที่อยู่ที่ทำงาน'],['workPhone','เบอร์ที่ทำงาน']];
   var grid=add('div','',page,'contract-fields');for(var k=0;k<fields.length;k++){var row=fields[k],value=r[row[0]];if(row[0]==='issue'||row[0]==='expiry')value=root.stay.buddhist(value);add('p',row[1]+': '+(value||'—'),grid);}
   add('p','ข้อ 1. ผู้ให้เช่าตกลงให้เช่า และผู้เช่าตกลงรับเช่าห้องเลขที่ '+r.room+' กำหนดช่วงการเช่า '+r.leaseTerm+' นับตั้งแต่ '+root.stay.buddhist(r.checkin)+' เมื่อครบกำหนดเวลาดังกล่าวแล้วให้ถือว่าสัญญาฉบับนี้เป็นอันยกเลิกเพิกถอนทันที',page);
  }
  var clauses=root.monthlyContract.pages[i].replace(/ห้องเช่าเลขที่\.{2,}/g,'ห้องเช่าเลขที่ '+r.room+' ');add('div',clauses,page,'contract-clauses');
  if(i===2){add('p','ผู้ติดต่อฉุกเฉิน: '+(r.emergency||'—')+' อายุ '+(r.emergencyAge||'—')+' ปี • เกี่ยวข้องเป็น '+(r.emergencyRelation||'—')+' • โทร '+(r.emergencyPhone||'—'),page);
   add('p','ลงชื่อ ................................ ผู้ให้เช่า (นายมนเดช จันทรักษ์)',page);
   signature=document.createElement('img');signature.className='signature';signature.alt='ลายเซ็นผู้เช่า';page.appendChild(signature);add('p','ลงชื่อ ผู้เช่า ('+r.name+')',page);
   add('p','ลงชื่อ ................................ พยาน (................................)',page);add('p','ลงชื่อ ................................ พยาน (................................)',page);
  }
 }
 return signature;
};})(window);
