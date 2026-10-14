(function(root){
 root.renderMonthlyForm=function(doc,r){
  doc.textContent='';doc.className='rental-sheet';
  function add(tag,value,parent,cls){var el=document.createElement(tag);el.textContent=value||'';if(cls)el.className=cls;(parent||doc).appendChild(el);return el;}
  add('h1',root.stayhubProperty.propertyName,doc,'print-title');add('p','ใบข้อมูลผู้เช่ารายเดือน',doc,'print-subtitle');add('p',root.stayhubProperty.address,doc,'print-subtitle');
  var groups=[['ข้อมูลผู้เช่า',[['name','ชื่อ–สกุล'],['nickname','ชื่อเล่น'],['id','เลขบัตรประชาชน'],['address','ที่อยู่'],['issue','วันออกบัตร'],['expiry','วันหมดอายุ'],['phone','เบอร์โทรศัพท์'],['email','E-mail'],['line','LINE'],['plate','ทะเบียนรถ']]],['ข้อมูลการเช่าและที่ทำงาน',[['room','เลขที่ห้องเช่า'],['checkin','วันที่เข้าอยู่'],['leaseTerm','ระยะเวลาเช่า'],['workAddress','ที่อยู่ที่ทำงาน'],['workPhone','เบอร์ที่ทำงาน']]],['ผู้ติดต่อฉุกเฉิน',[['emergency','ชื่อ'],['emergencyRelation','เกี่ยวข้องเป็น'],['emergencyAge','อายุ'],['emergencyPhone','เบอร์โทร']]]];
  for(var g=0;g<groups.length;g++){add('h2',groups[g][0],doc,'print-section');var fields=add('div','',doc,'print-fields');for(var i=0;i<groups[g][1].length;i++){var row=groups[g][1][i],value=r[row[0]];if(['issue','expiry','checkin'].indexOf(row[0])>=0)value=root.stay.buddhist(value);var field=add('div','',fields,row[0].indexOf('Address')>=0||row[0]==='address'?'print-field wide':'print-field');add('span',row[1],field,'print-label');add('span',String(value||'—'),field,'print-value');}}
  add('p','ลายเซ็นยืนยันข้อมูลผู้เช่า',doc);var image=document.createElement('img');image.className='signature';image.alt='ลายเซ็นผู้เช่า';doc.appendChild(image);add('p','('+r.name+')');add('p','เลขรายการ '+r.recordId,doc,'print-footer');return image;
 };
 root.renderDailyForm=function(doc,r){
  doc.textContent='';doc.className='rental-sheet';
  function add(tag,value,parent,className){var e=document.createElement(tag);e.textContent=value;if(className)e.className=className;(parent||doc).appendChild(e);return e;}
  add('h1',root.stayhubProperty.propertyName,doc,'print-title');
  add('p','ใบลงทะเบียนเช่าที่พักรายวัน',doc,'print-subtitle');
  add('p',root.stayhubProperty.address,doc,'print-subtitle');
  add('p','ผู้จัดการที่พัก: '+root.stayhubProperty.manager,doc,'print-intro');
  function section(title){add('h2',title,doc,'print-section');return add('div','',doc,'print-fields');}
  function field(parent,label,value,wide){var line=add('div','',parent,wide?'print-field wide':'print-field');add('span',label+' ',line,'print-label');add('span',value||'—',line,'print-value');}
  var guest=section('ข้อมูลผู้เช่า');
  if(r.photo){guest.className+=' has-photo';var portrait=document.createElement('img');portrait.className='card-portrait';portrait.alt='รูปผู้เช่าจากบัตรประชาชน';portrait.src=r.photo;guest.appendChild(portrait);}
  field(guest,'ชื่อ–สกุล (Name)',r.name,true);field(guest,'เลขประจำตัวประชาชน',r.id,true);field(guest,'ที่อยู่ (Address)',r.address,true);
  field(guest,'วันเกิด',root.stay.buddhist(r.birth));field(guest,'เบอร์ติดต่อ (Mobile)',r.phone);
  field(guest,'วันออกบัตร',root.stay.buddhist(r.issue));field(guest,'วันหมดอายุ',root.stay.buddhist(r.expiry));field(guest,'ทะเบียนรถ',r.plate||'ไม่ได้ระบุ',true);
  var stay=section('ข้อมูลการเข้าพัก');
  field(stay,'วันที่เข้าพัก',root.stay.buddhist(r.checkin));field(stay,'วันที่ออก',root.stay.buddhist(r.checkout));field(stay,'เลขห้อง',r.room);field(stay,'จำนวนห้อง',String(r.roomCount||1));

  field(stay,'การชำระเงิน',r.payment);field(stay,'ช่องทางเข้าพัก',r.channel);
  add('p','เข้าพักตั้งแต่ 13:00 น. • ออกก่อน 12:00 น.',doc,'print-time');
  var charge=add('div','',doc,'print-charge');add('span',r.rate+' บาท × '+root.stay.nights(r)+' คืน × '+(r.roomCount||1)+' ห้อง'+(Number(r.discountPercent)===10?' • ราคาเซล ลด 10%':''),charge);add('strong','ยอดชำระ '+root.stay.total(r).toFixed(2)+' บาท',charge);
  var signs=add('div','',doc,'print-signatures'),tenant=add('div','',signs),staff=add('div','',signs);
  var img=document.createElement('img');img.className='signature';img.alt='ลายเซ็นผู้เช่า';tenant.appendChild(img);add('p','ลงชื่อ ผู้เช่า',tenant);add('p','('+(r.name||'—')+')',tenant);
  add('div','',staff,'manual-signature');add('p','ลงชื่อ ................................ ผู้รับเงิน',staff);add('p','('+(r.staff||'................................')+')',staff);
  var date=new Date(r.confirmedAt),thai=new Date(date.getTime()+7*3600000);var time=isNaN(date.getTime())?'':root.stay.buddhist(thai.toISOString().slice(0,10))+' '+thai.toISOString().slice(11,19)+' น.';
  add('p','เลขรายการ '+r.recordId+' • ยืนยัน '+time,doc,'print-footer');
  return img;
 };
})(window);
