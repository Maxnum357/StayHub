(function () {
  'use strict';
  function get(id) { return document.getElementById(id); }
  var fields=get('fields'),form=get('form'),summary=get('summary'),consent=get('consent'),status=get('status'),history=get('history');
  var match=location.search.match(/[?&]key=([^&]*)/),token=match?decodeURIComponent(match[1]):'';
  function isPaymentIPad(){return /iPad/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&Number(navigator.maxTouchPoints)>1);}
  function isPaymentDevice(){return isPaymentIPad()||/Android|iPhone|iPod|Mobile|SanshineAndroid/i.test(navigator.userAgent);}
  var isLenovoDisplay=/LenovoKitKat/i.test(navigator.userAgent);
  if(isLenovoDisplay)document.body.className+=' lenovo-customer-screen lenovo-display-only';
  if(/LenovoJellyBean/i.test(navigator.userAgent)&&window.sanshineBrandAssets){
    document.body.className+=' lenovo-legacy-background';var legacyFrame=document.createElement('img');legacyFrame.id='legacy-brand-background';legacyFrame.alt='';legacyFrame.setAttribute('aria-hidden','true');legacyFrame.src=window.sanshineBrandAssets.frame;document.body.insertBefore(legacyFrame,document.body.firstChild);
    var legacyHeader=document.querySelector('header');if(legacyHeader){var legacyHeaderImage=document.createElement('img');legacyHeaderImage.className='legacy-header-art';legacyHeaderImage.alt='';legacyHeaderImage.setAttribute('aria-hidden','true');legacyHeaderImage.src=window.sanshineBrandAssets.frame;legacyHeader.insertBefore(legacyHeaderImage,legacyHeader.firstChild);}
  }
  var cardCustomerMode=isPaymentDevice(),cardReviewStage=false,lastChangedSnapshot='',paymentChosen=false,checkoutConfirmed=false;
  window.sanshineCustomerMode=function(){return cardCustomerMode&&controls.type.value==='รายวัน';};
  if(!isPaymentDevice()){
    var desktopWindowId='';try{desktopWindowId=sessionStorage.getItem('sanshineWindowId')||String(Date.now())+'-'+Math.random().toString(36).slice(2);sessionStorage.setItem('sanshineWindowId',desktopWindowId);}catch(e){desktopWindowId=String(Date.now())+'-'+Math.random();}
    var desktopPresence=function(action){var body=JSON.stringify({key:token,windowId:desktopWindowId,action:action});if(action==='close'&&navigator.sendBeacon&&navigator.sendBeacon('/api/desktop-presence',body))return;var x=new XMLHttpRequest();x.open('POST','/api/desktop-presence',true);x.setRequestHeader('Content-Type','application/json');x.send(body);};
    desktopPresence('open');window.addEventListener('pageshow',function(){desktopPresence('open');});window.addEventListener('pagehide',function(e){if(!e.persisted)desktopPresence('close');});
  }
  function layerBrandLogos(){
    each(document.querySelectorAll('img.brand-original-logo'),function(img){
      if(img.parentNode.className&&String(img.parentNode.className).indexOf('brand-logo-stack')>=0)return;
      var holder=document.createElement('span');holder.className='brand-logo-stack';img.parentNode.insertBefore(holder,img);holder.appendChild(img);
    });
  }
  layerBrandLogos();
  var schema=window.registrationSchema;
  var pads={},selected=null,busy=false,controls={},labels={},datePickers={},draftTimer,cardPhoto='';
  var photoPreview=document.createElement('img');photoPreview.alt='รูปจากบัตรประชาชน';photoPreview.style.cssText='display:none;width:110px;height:140px;object-fit:contain;margin:12px 0;border:1px solid #ccc';fields.parentNode.insertBefore(photoPreview,fields);
  function each(list,fn) { for(var i=0;i<list.length;i++)fn(list[i],i); }
  function text(tag,value,parent) {var el=document.createElement(tag);el.textContent=value;parent.appendChild(el);return el;}
  each(schema,function(row){
    var label=text('label',row[1],fields),type=row[2]||'text';
    var el=document.createElement(type==='select'?'select':'input');el.name=row[0];el.required=!!row[3];
    if(type==='select'){el.add(new Option('รายวัน','รายวัน'));el.add(new Option('รายเดือน','รายเดือน'));}else el.type=type==='date'?'text':type;
    if(type==='date'){el.placeholder='แตะเพื่อเลือกวันที่';el.maxLength=30;}
    if(type==='number'){el.min=(row[0]==='months'||row[0]==='roomCount')?1:0;el.step=(row[0]==='months'||row[0]==='roomCount')?1:'0.01';}
    if(row[0]==='id'){el.maxLength=13;el.pattern='[0-9]{13}';el.setAttribute('inputmode','numeric');}
    label.appendChild(el);
    controls[row[0]]=el;labels[row[0]]=label;
    if(row[2]==='date'){var hint=text('span','',label);hint.id='date-'+row[0];hint.className='date-hint';}
    if(type==='date'){
      el.setAttribute('aria-label',row[1]+' วัน เดือน ปี พ.ศ.');
      datePickers[row[0]]=window.addBuddhistPicker(label,el,function(){changed();if(row[0]==='checkout')checkoutConfirmed=true;if((row[0]==='checkout'||row[0]==='checkin')&&checkoutConfirmed)publishCheckout();});
      el.addEventListener('blur',function(){
        var raw=el.value.replace(/[๐-๙]/g,function(c){return String(c.charCodeAt(0)-3664);}).replace(/^\s+|\s+$/g,'');
        if(/^\d{8}$/.test(raw))raw=raw.slice(0,2)+'/'+raw.slice(2,4)+'/'+raw.slice(4);
        var iso=window.stay.fromBuddhist(raw);el.value=iso?window.stay.buddhist(iso):raw;changed();
      });
    }
  });
  summary.parentNode.insertBefore(labels.depositPaid,summary.nextSibling);controls.depositPaid.value='0';controls.depositPaid.addEventListener('input',changed);controls.depositPaid.addEventListener('change',changed);
  var roomSelect=document.createElement('select');roomSelect.name='room';
  each(window.stayhubProperty.rooms,function(v){roomSelect.add(new Option(v,v));});
  labels.room.replaceChild(roomSelect,controls.room);controls.room=roomSelect;
  var extraRooms=text('div','',labels.room),roomInputs=[roomSelect];
  function syncRooms(){if(controls.type.value==='รายเดือน'){while(roomInputs.length>1)extraRooms.removeChild(roomInputs.pop());return;}var count=controls.type.value==='รายวัน'?Math.max(1,Math.min(5,Number(controls.roomCount.value)||1)):1;
    while(roomInputs.length>count){extraRooms.removeChild(roomInputs.pop());}
    var available=window.stayhubProperty.rooms;
    while(roomInputs.length<count){var select=document.createElement('select');select.setAttribute('aria-label','ห้องที่ '+(roomInputs.length+1));select.required=true;
      each(available,function(v){select.add(new Option(v,v));});var used=[];each(roomInputs,function(el){used.push(el.value);});each(available,function(v){if(used.indexOf(v)<0&&!select.getAttribute('data-assigned')){select.value=v;select.setAttribute('data-assigned','yes');}});extraRooms.appendChild(select);roomInputs.push(select);}
    var chosen=[];
    each(roomInputs,function(el){if(chosen.indexOf(el.value)>=0){each(available,function(v){if(chosen.indexOf(el.value)>=0&&chosen.indexOf(v)<0)el.value=v;});}chosen.push(el.value);});
    each(roomInputs,function(el){var current=el.value;while(el.options.length)el.remove(0);each(available,function(v){if(v===current||chosen.indexOf(v)<0)el.add(new Option(v,v));});el.value=current;el.setCustomValidity('');});
  }
  function applyRoomList(list){
    if(!list)return;
    each(roomInputs,function(el,i){el.textContent='';each(window.stayhubProperty.rooms,function(v){el.add(new Option(v,v));});el.value=list[i]||window.stayhubProperty.rooms[0];});
    syncRooms();
  }
  var choiceGroups=[];
  function choices(name,title,options){var wrap=text('div',title,fields);choiceGroups.push(wrap);wrap.setAttribute('data-choice-name',name);each(options,function(option,i){var label=text('label','',wrap),input=document.createElement('input');input.type='radio';input.name=name;input.value=option;input.checked=false;input.required=true;input.addEventListener('change',function(){if(name==='payment')paymentChosen=true;if(name==='channel'&&input.value==='Online'){paymentChosen=false;each(form.elements,function(item){if(item.name==='payment')item.checked=false;});}});input.style.width='auto';label.appendChild(input);text('span',' '+option,label);});}

  choices('payment','การชำระเงิน',['เงินสด','เงินโอน']);choices('channel','ช่องทางเข้าพัก',['Walk-in','Online']);
  controls.checkin.value=window.stay.buddhist(window.stay.today());controls.roomCount.value='1';controls.roomCount.max='5';controls.months.value='1';

  var priceNote=text('p','แก้ราคาต่อห้องต่อคืนได้ • เข้าพัก 13:00 น. • ออกก่อน 12:00 น.',fields);priceNote.className='note';
  fields.appendChild(labels.phone);
  // Keep only one lease-duration field; place it next to the check-in date.
  fields.insertBefore(labels.leaseTerm,labels.checkout);
  labels.leaseTerm.firstChild.nodeValue='ระยะเวลาเช่า';
  controls.leaseTerm.placeholder='เช่น 6 เดือน หรือ 1 ปี';
  var monthlyRoom=document.createElement('input');monthlyRoom.type='text';monthlyRoom.placeholder='เลขที่ห้องเช่า เช่น C07';labels.room.appendChild(monthlyRoom);
  var photoFields=['photoUrl','cardImageUrl'];
  var ocrButton=text('button','เทียบข้อมูลกับรูปบัตร',labels.cardImageUrl);ocrButton.type='button';
  var comparison=text('div','',labels.cardImageUrl);comparison.className='note';
  var ocrResult=document.createElement('textarea');ocrResult.readOnly=true;ocrResult.style.display='none';labels.cardImageUrl.appendChild(ocrResult);
  ocrButton.onclick=function(){if(!controls.cardImageUrl.value){status.textContent='กรุณาดึงข้อมูลจากชีตหรือกรอกลิงก์รูปบัตรก่อน';return;}ocrButton.disabled=true;status.textContent='กำลังอ่านข้อความจากรูปบัตร…';api('OCR',{imageUrl:controls.cardImageUrl.value},function(err,result){ocrButton.disabled=false;if(err){status.textContent=err.message;return;}ocrResult.value=result.text||'';ocrResult.style.display='none';comparison.textContent='';var found=window.parseCardOcr(result.text||''),count=0,corrections=[],labelsByKey={name:'ชื่อ–สกุล',address:'ที่อยู่',birth:'เกิดวันที่',issue:'วันออกบัตร',expiry:'วันหมดอายุ',id:'เลขบัตร'};
for(var key in found){if(!controls[key])continue;text('p',labelsByKey[key]+': '+(['birth','issue','expiry'].indexOf(key)>=0?window.stay.buddhist(found[key]):found[key]),comparison);var value=['birth','issue','expiry'].indexOf(key)>=0?window.stay.buddhist(found[key]):found[key];if(!controls[key].value){controls[key].value=value;count++;}else if(controls[key].value!==value)corrections.push({key:key,value:value});}
if(corrections.length){var note='ข้อมูลจากรูปบัตรต่างจากที่กรอกไว้:\n';each(corrections,function(item){note+=labelsByKey[item.key]+': '+controls[item.key].value+' → '+item.value+'\n';});if(window.confirm(note+'ใช้ข้อมูลที่อ่านได้แทนค่าเดิมหรือไม่? กรุณาตรวจเทียบรูปก่อนยืนยัน'))each(corrections,function(item){controls[item.key].value=item.value;count++;});}
changed();status.textContent=count?'เติม/แก้ไขแล้ว '+count+' ช่อง กรุณาตรวจเทียบรูปบัตรก่อนเซ็น':'ยังไม่พบวันที่ที่อ่านได้ชัดเจน โปรดตรวจข้อความ OCR ด้านล่างและเลือกวันที่เอง';});};
  each(photoFields,function(key){var wrap=labels[key],img=document.createElement('img'),link=document.createElement('a');img.alt=key==='photoUrl'?'รูปผู้เช่า':'รูปบัตรประชาชน';img.style.cssText='display:none;max-width:100%;max-height:180px;object-fit:contain;margin-top:10px';link.textContent='เปิดรูปต้นฉบับ';link.target='_blank';link.rel='noopener noreferrer';link.style.display='none';wrap.appendChild(img);wrap.appendChild(link);controls[key].type='hidden';wrap.firstChild.nodeValue=key==='photoUrl'?'รูปผู้เช่า':'รูปบัตรประชาชน';controls[key].addEventListener('change',function(){showPhoto(key,img,link);});wrap.preview=img;wrap.photoLink=link;});
  function showPhoto(key,img,link){var url=controls[key].value.trim(),valid=/^https:\/\//.test(url);img.style.display=valid?'block':'none';link.style.display='none';if(!valid){img.removeAttribute('src');link.removeAttribute('href');return;}link.href=url;var match=url.match(/\/d\/([A-Za-z0-9_-]+)/)||url.match(/[?&]id=([A-Za-z0-9_-]+)/);img.src=match?'https://drive.google.com/thumbnail?id='+encodeURIComponent(match[1])+'&sz=w500':url;img.onerror=function(){img.style.display='none';};}
  var monthlyBox=document.createElement('div');monthlyBox.className='card';fields.parentNode.insertBefore(monthlyBox,fields);
  var pull=text('button','ข้อมูล',monthlyBox);pull.type='button';
  var rowSelect=document.createElement('select');rowSelect.setAttribute('aria-label','เลือกลำดับแถวในชีต');monthlyBox.appendChild(rowSelect);
  var applyRow=text('button','นำเข้า',monthlyBox);applyRow.type='button';applyRow.disabled=true;var monthlyRows=[];
  pull.onclick=function(){pull.disabled=true;status.textContent='กำลังดึงข้อมูลรายเดือน…';api('MONTHLY',null,function(err,result){pull.disabled=false;rowSelect.textContent='';if(err){status.textContent=err.message;return;}monthlyRows=result.rows;each(monthlyRows,function(row){rowSelect.add(new Option('แถว '+row.row+' • '+(row.cells[2]||'(แถวว่าง)')+' • ห้อง '+(row.cells[15]||'—'),String(row.row)));});applyRow.disabled=!monthlyRows.length;status.textContent='ดึงข้อมูลแล้ว '+monthlyRows.length+' แถว';});};
  applyRow.onclick=function(){var row;each(monthlyRows,function(r){if(String(r.row)===rowSelect.value)row=r;});if(!row)return;resetForm();controls.type.value='รายเดือน';layout();var c=row.cells,map={sheetTimestamp:0,respondentEmail:1,name:2,nickname:3,phone:4,email:5,line:6,id:7,issue:8,expiry:9,address:10,plate:11,workAddress:12,workPhone:13,photoUrl:14,cardImageUrl:21,checkin:16,leaseTerm:17,emergency:18,emergencyRelation:19,emergencyPhone:20,emergencyAge:22};for(var key in map){if(!controls[key])continue;var value=c[map[key]]||'';if(key==='id')value=value.replace(/\D/g,'');if(key==='issue'||key==='expiry'||key==='checkin'){var iso=window.stay.fromSheet(value);value=iso?window.stay.buddhist(iso):value;}controls[key].value=value;}
   monthlyRoom.value=c[15]||'';each(photoFields,function(key){showPhoto(key,labels[key].preview,labels[key].photoLink);});var room=c[15]||'';if(room){controls.room.add(new Option(room,room));controls.room.value=room;}changed();status.textContent='เติมข้อมูลจากแถว '+row.row+' แล้ว กรุณาตรวจข้อมูลและระยะเวลาเช่า';if(controls.cardImageUrl.value)ocrButton.onclick();};
  var monthlyFields=document.createElement('div');monthlyFields.className='grid monthly-fields';monthlyBox.appendChild(monthlyFields);
  var emergencySection=text('section','',monthlyBox);emergencySection.className='emergency-section';
  text('h2','ผู้ติดต่อฉุกเฉิน',emergencySection);
  var emergencyFields=text('div','',emergencySection);emergencyFields.className='grid';
  var emergencyKeys=['emergency','emergencyRelation','emergencyPhone','emergencyAge'];
  labels.emergency.firstChild.nodeValue='ผู้ที่ติดต่อได้ในกรณีฉุกเฉิน';
  labels.emergencyRelation.firstChild.nodeValue='เกี่ยวข้องเป็น';
  labels.emergencyPhone.firstChild.nodeValue='เบอร์โทรผู้ติดต่อฉุกเฉิน';
  labels.emergencyAge.firstChild.nodeValue='อายุผู้ติดต่อฉุกเฉิน (ปี)';
  controls.emergencyAge.step='1';controls.emergencyAge.min='0';controls.emergencyAge.max='120';
  var monthlyOrder=['sheetTimestamp','respondentEmail','name','nickname','phone','email','line','id','issue','expiry','address','plate','workAddress','workPhone','photoUrl','room','checkin','leaseTerm','emergency','emergencyRelation','emergencyPhone','cardImageUrl','emergencyAge'];
  var originalOrder=[];each(fields.children,function(child){originalOrder.push(child);});
  labels.name.firstChild.nodeValue='ชื่อ–สกุล';controls.sheetTimestamp.readOnly=true;labels.room.firstChild.nodeValue='เลขที่ห้องเช่า';
  var arrangedDaily=null;
  function arrangeMonthly(daily){
    if(arrangedDaily===daily)return;arrangedDaily=daily;
    if(daily){each(originalOrder,function(child){fields.appendChild(child);});}
    else {each(monthlyOrder,function(key){if(emergencyKeys.indexOf(key)<0)monthlyFields.appendChild(labels[key]);});each(emergencyKeys,function(key){emergencyFields.appendChild(labels[key]);});}
    monthlyRoom.setAttribute('aria-label','เลขที่ห้องเช่า');
    get('read-card').style.display=daily?'':'none';photoPreview.style.display=daily&&cardPhoto?'block':'none';
    ocrButton.style.display=daily?'none':'';ocrResult.style.display='none';
  }
  function layout(){var daily=controls.type.value==='รายวัน',channel=form.querySelector('[name=channel]:checked'),online=!!channel&&channel.value==='Online';
    monthlyBox.style.display=daily?'none':'';arrangeMonthly(daily);labels.room.firstChild.nodeValue=daily?'เลขห้อง':'เลขที่ห้องเช่า';monthlyRoom.setAttribute('aria-label','เลขที่ห้องเช่า');
    monthlyRoom.style.display=daily?'none':'';monthlyRoom.required=!daily;controls.room.style.display=daily?'':'none';
    each(choiceGroups,function(group){var show=daily&&!(online&&group.getAttribute('data-choice-name')==='payment');group.style.display=show?'':'none';each(group.getElementsByTagName('input'),function(el){el.disabled=!show;el.required=show;});});
    syncRooms();
    each(schema,function(row){var show=['monthlyNotice','truthDeclaration','monthlyOnly'].indexOf(row[0])<0&&(row[0]==='type'||(daily?window.stay.daily.indexOf(row[0])>=0:monthlyOrder.indexOf(row[0])>=0));labels[row[0]].style.display=show?'':'none';controls[row[0]].disabled=!show;controls[row[0]].required=show&&(daily?row[0]!=='plate'&&row[0]!=='rate'&&row[0]!=='type'&&row[0]!=='depositPaid':!!row[3]);});
    each(['checkout','rate','months','staff'],function(key){labels[key].hidden=!daily;});
    each(choiceGroups,function(group){group.hidden=!daily;});
    if(!daily)controls.room.required=false;
    controls.rate.readOnly=daily&&isPaymentIPad();controls.rate.min='0';controls.rate.step='0.01';if(daily&&!controls.rate.value)controls.rate.value=String(window.stayhubProperty.rate);priceNote.style.display=daily?'':'none';
    customerLayout();
  }
  var customerReview=document.createElement('div');customerReview.className='card';customerReview.style.display='none';form.insertBefore(customerReview,get('tenantSignature').parentNode.parentNode.parentNode);
  var customerModeButton=text('button','ใช้รูปบัตรแทน',fields.parentNode);customerModeButton.type='button';customerModeButton.className='secondary';fields.parentNode.insertBefore(customerModeButton,fields);
  var customerIdentity=text('div','',fields.parentNode);customerIdentity.id='customer-identity';customerIdentity.className='card';fields.parentNode.insertBefore(customerIdentity,fields);customerIdentity.style.display='none';
  function showCustomerIdentity(){
    customerIdentity.textContent='';var row=text('div','',customerIdentity);row.className='customer-booking-row';
    var details=text('div','',row);details.className='customer-booking-details';
    text('h2',controls.name.value||'รออ่านบัตรจากคอมพิวเตอร์',details).className='customer-booking-name';
    if(controls.name.value){var r=values(),amount=total(r);
      text('p','ข้อมูลการจอง',details).className='customer-booking-title';
      text('p','วันที่จอง / เข้าพัก: '+(window.stay.buddhist(r.checkin)||'—'),details);
      text('p','วันออก: '+(window.stay.buddhist(r.checkout)||'—'),details);
      text('p','จำนวน '+(r.roomCount||'—')+' ห้อง',details);text('p','ห้องที่เลือก: '+(r.rooms&&r.rooms.length?r.rooms.join(', '):r.room||'—'),details).className='customer-room-list';
      text('p','ราคาห้อง '+(r.rate||'—')+' บาท / ห้อง / คืน',details);if(window.stay.deposit(r)>0)text('p','ยอดรวม '+window.stay.total(r).toFixed(0)+' บาท • จ่ายมัดจำแล้ว '+window.stay.deposit(r).toFixed(0)+' บาท',details);
      text('div',(isLenovoDisplay||isPaymentIPad())&&r.channel==='Online'?'สถานะการชำระเงิน':'เหลือชำระ',details).className='customer-booking-title';
      var paymentRow=text('div','',details);paymentRow.className='customer-payment-row';
      if((isLenovoDisplay||isPaymentIPad())&&r.channel==='Online'){text('div','ชำระออนไลน์แล้ว',paymentRow).className='customer-online-status';}else{var price=text('div','',paymentRow);price.className='customer-booking-price';
      if(isFinite(amount)&&amount>=0){text('span',amount.toFixed(0),price).className='customer-price-number';text('span',' บาท',price).className='customer-price-unit';}else price.textContent='รอข้อมูลราคา';
      if(isLenovoDisplay&&r.payment==='เงินสด'&&r.paymentChosen===true)text('div','จ่ายเงินสด',paymentRow).className='customer-cash-status';}
    }
    if(cardPhoto){var photo=text('div','',row);photo.className='customer-booking-photo';var img=document.createElement('img');img.src=cardPhoto;img.alt='รูปผู้เข้าพักจากบัตรประชาชน';photo.appendChild(img);}
  }
  customerModeButton.onclick=function(){cardCustomerMode=!cardCustomerMode;cardReviewStage=false;invalidate();layout();review();};
  function customerLayout(){
    var active=cardCustomerMode&&controls.type.value==='รายวัน',submit=form.querySelector('button[type="submit"]');
    if(active){
      each(schema,function(row){labels[row[0]].style.display=['plate','phone'].indexOf(row[0])>=0&&!cardReviewStage?'':'none';});
      each(choiceGroups,function(group){group.style.display='none';});priceNote.style.display='none';photoPreview.style.display='none';
    }
    get('read-card').style.display=!isPaymentDevice()&&controls.type.value==='รายวัน'&&!cardReviewStage?'':'none';
    customerIdentity.style.display=active&&!cardReviewStage?'':'none';showCustomerIdentity();
    customerModeButton.style.display=isPaymentDevice()&&controls.type.value==='รายวัน'&&!cardReviewStage?'':'none';customerModeButton.textContent=active?'ใช้รูปบัตรแทน':'กลับโหมดอ่านบัตรประชาชน';
    summary.parentNode.style.display=active?'none':'';
    var upload=get('daily-card-upload');if(upload)upload.style.display=active||controls.type.value!=='รายวัน'?'none':'';
    consent.parentNode.style.display=active?'none':'';consent.required=!active;
    get('tenantSignature').parentNode.parentNode.style.display=active&&cardReviewStage?'none':'';
    customerReview.style.display=active&&cardReviewStage?'':'none';
    submit.textContent=active?(cardReviewStage?'ข้อมูลถูกต้อง':'ยืนยันลายเซ็น'):'ยืนยันและบันทึก';
    form.noValidate=active;
  }
  function showCustomerReview(){
    customerReview.textContent='';text('h2','ตรวจสอบข้อมูลก่อนชำระเงิน',customerReview);
    var r=values();if(window.stay.depositError(r)){status.textContent=window.stay.depositError(r);return;}each(schema,function(row){if(['birth','issue','expiry'].indexOf(row[0])>=0)return;if(row[0]==='type'||window.stay.daily.indexOf(row[0])>=0){var value=r[row[0]],title=row[0]==='checkout'?'วันที่ออก':row[0]==='rate'?'ราคาต่อคืน':row[1];if(value)text('p',title+': '+(row[2]==='date'?window.stay.buddhist(value):row[0]==='rate'?Number(value).toFixed(0)+' บาท':value),customerReview);}});
    text('p','ยอดรวม '+window.stay.total(r).toFixed(0)+' บาท • จ่ายมัดจำแล้ว '+window.stay.deposit(r).toFixed(0)+' บาท',customerReview);if(r.channel==='Online')text('p','ชำระออนไลน์แล้ว',customerReview).className='customer-online-status';else text('p','เหลือชำระ '+total(r).toFixed(0)+' บาท',customerReview);
    var image=document.createElement('img');image.alt='ลายเซ็นผู้เช่า';image.src=pads.tenantSignature.canvas.toDataURL();image.style.cssText='max-width:100%;max-height:160px;background:white';customerReview.appendChild(image);
    var back=text('button','กลับไปแก้ไข',customerReview);back.type='button';back.className='secondary';back.onclick=function(){cardReviewStage=false;layout();review();};
    cardReviewStage=true;customerLayout();customerReview.scrollIntoView();
  }
  each(['tenantSignature'],function(id){pads[id]=window.createSignaturePad(get(id));pads[id].canvas.signaturePad=pads[id];});window.lenovoSignaturePad=pads.tenantSignature;
  each(document.querySelectorAll('[data-clear]'),function(b){b.onclick=function(){pads[b.getAttribute('data-clear')].clear();invalidate();};});
  function invalidate(){consent.checked=false;selected=null;get('print').disabled=true;}
  var saleDiscount=0;var saleButton=text('button','ลดราคา 10% (ราคาเซล)',summary.parentNode);summary.parentNode.insertBefore(saleButton,summary.nextSibling);saleButton.type='button';saleButton.className='secondary';saleButton.setAttribute('aria-pressed','false');saleButton.onclick=function(){saleDiscount=saleDiscount===10?0:10;saleButton.textContent=saleDiscount?'ยกเลิกส่วนลด 10%':'ลดราคา 10% (ราคาเซล)';saleButton.setAttribute('aria-pressed',saleDiscount?'true':'false');changed();};
  function resetForm(){if(window.dailyCardUpload)window.dailyCardUpload.clear();saleDiscount=0;saleButton.textContent='ลดราคา 10% (ราคาเซล)';saleButton.setAttribute('aria-pressed','false');
    cardCustomerMode=isPaymentDevice();cardReviewStage=false;lastChangedSnapshot='';paymentChosen=false;checkoutConfirmed=false;
    monthlyRoom.value='';each(photoFields,function(key){controls[key].value='';comparison.textContent='';showPhoto(key,labels[key].preview,labels[key].photoLink);});
    cardPhoto='';photoPreview.removeAttribute('src');photoPreview.style.display='none';
    clearTimeout(draftTimer);
    each(schema,function(row){var el=controls[row[0]];if(row[0]!=='type')el.value='';el.setCustomValidity('');});
    each(form.elements,function(el){if(el.type==='radio')el.checked=false;});
    while(roomInputs.length>1)extraRooms.removeChild(roomInputs.pop());
    roomSelect.textContent='';each(window.stayhubProperty.rooms,function(v){roomSelect.add(new Option(v,v));});
    controls.roomCount.value='1';controls.months.value='1';controls.checkin.value=window.stay.buddhist(window.stay.today());
    for(var dateKey in datePickers)datePickers[dateKey].sync();
    pads.tenantSignature.clear();invalidate();layout();review();
  }
  function values(){var r={};each(form.elements,function(el){if(el.name&&!el.disabled&&(el.type!=='radio'||el.checked))r[el.name]=el.value;});if(r.type==='รายวัน'&&r.channel==='Online'){r.payment='ชำระผ่านระบบออนไลน์';r.paymentChosen=true;}else r.paymentChosen=paymentChosen&&!!r.payment;r.discountPercent=r.type==='รายวัน'?saleDiscount:0;r.rooms=[];each(roomInputs,function(el){r.rooms.push(el.value);});r.room=r.type==='รายเดือน'?monthlyRoom.value:r.rooms.join(', ');each(schema,function(row){if(row[2]==='date'&&Object.prototype.hasOwnProperty.call(r,row[0]))r[row[0]]=window.stay.fromBuddhist(r[row[0]]);});if(window.dailyCardUpload){var extra=window.dailyCardUpload.record();for(var extraKey in extra)r[extraKey]=extra[extraKey];}return r;}
  function total(r){return window.stay.due(r);}
  function publishCheckout(){
    if(isPaymentDevice()||controls.type.value!=='รายวัน')return;
    var r=values();if(!/^\d{13}$/.test(r.id||'')||!(window.stay.nights(r)>0)){status.textContent='กรุณาอ่านบัตรและเลือกวันที่ออกหลังวันที่เข้าพัก';return;}
    delete r.cardImageData;r.displayReady=true;r.displayEvent=true;
    api('DRAFT',r,function(err){status.className=err?'error':'';status.textContent=err?'ส่งข้อมูลไป Lenovo ไม่สำเร็จ: '+err.message:'ยืนยันวันที่ออกแล้ว ส่งข้อมูลไป Lenovo เรียบร้อย';});
  }
  function review(){var r=values(),amount=window.stay.total(r),n=window.stay.nights(r);summary.textContent=r.type+' • '+(r.name||'ยังไม่มีชื่อ')+' • ห้อง '+(r.room||'—')+' • '+(window.stay.buddhist(r.checkin)||'—')+' ถึง '+(window.stay.buddhist(r.checkout)||'—')+' • '+(r.type==='รายวัน'?r.rate+' บาท × '+(n>0?n:'—')+' คืน × '+r.roomCount+' ห้อง = ':'ยอดรวม ')+(isFinite(amount)&&amount>0?(r.type==='รายวัน'&&saleDiscount===10?amount/0.9:amount).toFixed(0):'—')+' บาท';
    saleButton.style.display=r.type==='รายวัน'&&!isPaymentIPad()?'':'none';if(r.type==='รายวัน'&&saleDiscount===10)summary.textContent+=' • ราคาเซล ลด 10% • ยอดชำระ '+(isFinite(amount)?amount.toFixed(0):'—')+' บาท';
    controls.depositPaid.setCustomValidity(r.type==='รายวัน'?window.stay.depositError(r):'');if(r.type==='รายวัน'){controls.depositPaid.max=isFinite(amount)?String(amount):'';summary.textContent+=' • ยอดรวม '+(isFinite(amount)?amount.toFixed(2):'—')+' บาท • จ่ายมัดจำแล้ว '+window.stay.deposit(r).toFixed(2)+' บาท • เหลือชำระ '+(isFinite(total(r))?total(r).toFixed(2):'—')+' บาท';}
    if(r.type==='รายเดือน')summary.textContent='รายเดือน • '+(r.name||'ยังไม่มีชื่อ')+' • ห้อง '+(r.room||'—')+' • เข้าอยู่ '+(window.stay.buddhist(r.checkin)||'—')+' • ระยะเวลาเช่า '+(r.leaseTerm||'—');
    each(schema,function(row){if(row[2]==='date'){
      var el=controls[row[0]],hint=get('date-'+row[0]),valid=!el.value||!!window.stay.fromBuddhist(el.value);
      var warning=window.stay.dateWarning(row[0],el.value,r);
      el.setCustomValidity(valid?'':'กรุณาเลือกวันที่ที่ถูกต้อง');
      el.className=warning?'expired':'';hint.className=warning?'date-hint expired':'date-hint';
      hint.textContent=warning||'แตะช่องเพื่อเลือกวัน เดือน และปี พ.ศ.';
    }});
  }
  function changed(){layout();var snapshot=JSON.stringify(values());if(snapshot!==lastChangedSnapshot){pads.tenantSignature.clear();cardReviewStage=false;lastChangedSnapshot=snapshot;}invalidate();review();customerLayout();clearTimeout(draftTimer);draftTimer=setTimeout(function(){var r=values();delete r.cardImageData;if(/^\d{13}$/.test(r.id||''))api('DRAFT',r,function(err){if(err)status.textContent='แชร์ข้อมูลร่างไม่สำเร็จ: '+err.message;});},400);}
  emergencyFields.addEventListener('input',changed);emergencyFields.addEventListener('change',changed);monthlyFields.addEventListener('input',changed);monthlyFields.addEventListener('change',changed);fields.addEventListener('input',changed);fields.addEventListener('change',changed);layout();review();

    function showPayment(r){
    if(r.payment!=='เงินโอน'||r.channel==='Online')return;
    status.textContent='กำลังส่ง QR ไป Lenovo…';api('QRDISPLAY',{recordId:r.recordId},function(err){status.className=err?'error':'';status.textContent=err?'ส่ง QR ไม่สำเร็จ: '+err.message:'ส่ง QR ไปแสดงที่ Lenovo แล้ว (30 วินาที)';});
  }
function api(method,body,callback){
    if(method==='PAYMENT'){var q=new XMLHttpRequest();q.open('POST','/api/payment-qr',true);q.setRequestHeader('x-access-token',token);q.setRequestHeader('Content-Type','application/json');q.timeout=20000;q.onload=function(){try{var result=JSON.parse(q.responseText);callback(q.status===200?null:new Error(result.error),result);}catch(e){callback(e);}};q.onerror=q.ontimeout=function(){callback(new Error('สร้าง QR ไม่สำเร็จ กรุณาลองใหม่'));};q.send(JSON.stringify(body));return;}
    if(method==='MONTHLY'){var x=new XMLHttpRequest();x.open('GET','/api/monthly-rows',true);x.setRequestHeader('x-access-token',token);x.timeout=60000;x.onload=function(){try{var d=JSON.parse(x.responseText);callback(x.status===200?null:new Error(d.error),d);}catch(e){callback(e);}};x.onerror=x.ontimeout=function(){callback(new Error('ดึงข้อมูลชีตไม่สำเร็จ'));};x.send();return;}
    var xhr=new XMLHttpRequest();xhr.open(method==='QRDISPLAY'||method==='OCR'||method==='GOOGLE'?'POST':method==='RESET'?'DELETE':method==='CARD'||method==='DRAFT'?'POST':method,method==='QRDISPLAY'?'/api/display-qr':method==='OCR'?'/api/card-ocr':method==='GOOGLE'?'/api/google-sync':method==='RESET'||method==='DRAFT'?'/api/draft':method==='CARD'?'/api/card':'/api/records',true);xhr.timeout=method==='GOOGLE'?180000:method==='OCR'?65000:25000;
    xhr.setRequestHeader('x-access-token',token);xhr.setRequestHeader('Content-Type','application/json');if(window.historyAccess&&window.historyAccess.token())xhr.setRequestHeader('x-history-session',window.historyAccess.token());
    xhr.onload=function(){try{var r=JSON.parse(xhr.responseText);if(xhr.status<200||xhr.status>=300)return callback(new Error(r.error||'โหลดข้อมูลไม่สำเร็จ'));callback(null,r);}catch(e){callback(e);}};
    xhr.onerror=xhr.ontimeout=function(){callback(new Error('ติดต่อคอมพิวเตอร์ไม่ได้ ตรวจ Wi-Fi และโปรแกรมบนคอมพิวเตอร์'));};
    xhr.send(body?JSON.stringify(body):null);
  }
  form.onsubmit=function(e){
    e.preventDefault();if(busy)return;if(controls.type.value==='รายวัน'&&window.stay.depositError(values())){status.textContent=window.stay.depositError(values());status.className='error';return;}
    var selectedChannel=form.querySelector('[name=channel]:checked');
    if(controls.type.value==='รายวัน'&&selectedChannel&&selectedChannel.value==='Online')each(form.elements,function(el){if(el.name==='payment'){el.disabled=true;el.required=false;el.setCustomValidity('');}});
    if(cardCustomerMode&&controls.type.value==='รายวัน'){
      if(!controls.phone.checkValidity()){status.textContent='กรุณากรอกเบอร์โทร';status.className='error';return;}
      if(!pads.tenantSignature.drawn){status.textContent='กรุณาเซ็นผู้เช่าก่อนยืนยัน';status.className='error';return;}
      if(!cardReviewStage){showCustomerReview();return;}
      var checkedRecord=values(),missing=[];
      each(['id','name','address','birth','issue','expiry','phone','checkin','checkout','room'],function(key){if(!String(checkedRecord[key]||'').replace(/^\s+|\s+$/g,'')){var title=key;each(schema,function(row){if(row[0]===key)title=row[1];});missing.push(title);}});
      if(['Walk-in','Online'].indexOf(checkedRecord.channel)<0)missing.push('ช่องทางเข้าพัก');
      if(checkedRecord.channel!=='Online'&&['เงินสด','เงินโอน'].indexOf(checkedRecord.payment)<0)missing.push('การชำระเงิน');
      if(checkedRecord.checkin&&checkedRecord.checkout&&!(window.stay.nights(checkedRecord)>0))missing.push('วันที่ออกต้องหลังวันที่เข้าพัก');
      if(!isFinite(Number(checkedRecord.rate))||Number(checkedRecord.rate)<0)missing.push('ราคาห้อง');
      if(missing.length){status.textContent='กรุณาตรวจข้อมูล: '+missing.join(', ')+' บนคอม แล้วส่งข้อมูลมาใหม่';status.className='error';return;}
      consent.checked=true;
    }
    if(!consent.checked||!pads.tenantSignature.drawn){status.textContent='กรุณาเซ็นผู้เช่าและยืนยันข้อมูล';status.className='error';return;}
    var r=values();r.photo=r.cardImageData?'':cardPhoto;r.tenantSignature=pads.tenantSignature.canvas.toDataURL();busy=true;clearTimeout(draftTimer);
    var customerPayment=cardCustomerMode&&cardReviewStage;
    api('POST',r,function(err,saved){busy=false;if(err){status.textContent=err.message;status.className='error';return;}resetForm();status.textContent='บันทึกสำเร็จ ล้างข้อมูลแล้ว พิมพ์ได้จากรายการที่ยืนยันแล้ว';status.className='';load();if(isPaymentIPad()||isLenovoDisplay){beginCompletedDisplay(saved);}else if(isPaymentDevice()&&saved.type==='รายวัน'&&(customerPayment||saved.payment==='เงินโอน'))showPayment(saved);});
  };
  function printRecord(r){
    var printTitle=document.title;document.title=window.stay.pdfFileName(null,r.name).replace(/\.pdf$/,'');var restorePrintTitle=function(){document.title=printTitle;window.removeEventListener('afterprint',restorePrintTitle);};window.addEventListener('afterprint',restorePrintTitle);
    if(r.type==='รายเดือน'){
      var monthlyImage=window.renderMonthlyForm(get('document'),r),monthlyPrinted=false;
      var readyMonthly=function(){if(monthlyPrinted)return;monthlyPrinted=true;window.print();};
      monthlyImage.onload=readyMonthly;monthlyImage.onerror=function(){status.textContent='โหลดลายเซ็นไม่สำเร็จ';};monthlyImage.src=r.tenantSignature;if(monthlyImage.complete&&monthlyImage.naturalWidth)readyMonthly();return;
    }
    if(r.type==='รายวัน'){
      var dailyImage=window.renderDailyForm(get('document'),r),printed=false;
      var readyDaily=function(){if(printed)return;var images=get('document').getElementsByTagName('img');for(var i=0;i<images.length;i++)if(!images[i].complete){images[i].onload=readyDaily;images[i].onerror=readyDaily;return;}printed=true;window.print();};
      dailyImage.onload=readyDaily;dailyImage.onerror=function(){status.textContent='โหลดลายเซ็นไม่สำเร็จ กรุณาลองพิมพ์ใหม่';};dailyImage.src=r.tenantSignature;if(dailyImage.complete&&dailyImage.naturalWidth)readyDaily();return;
    }
    var doc=get('document');doc.textContent='';text('h1','ซานชาย เพลส — ใบลงทะเบียน'+r.type,doc);
    doc.className='';
    text('p','ต้นแบบใบลงทะเบียน • ยังไม่ได้ใช้รูปแบบสัญญาต้นฉบับ • ไม่ใช่ใบกำกับภาษี',doc);
    each(schema,function(row){if(r[row[0]]&&(r.type!=='รายวัน'||row[0]==='type'||window.stay.daily.indexOf(row[0])>=0))text('p',row[1]+': '+(row[2]==='date'?window.stay.buddhist(r[row[0]]):r[row[0]]),doc);});if(r.type!=='รายเดือน')text('p','ค่าห้อง: '+total(r).toFixed(2)+' บาท',doc);
    if(r.type==='รายวัน')text('p',r.rate+' บาท × '+window.stay.nights(r)+' คืน × '+(r.roomCount||1)+' ห้อง • เข้าพัก 13:00 น. • ออกก่อน 12:00 น.',doc);
    var div=text('div','ลายเซ็นผู้เช่า',doc),img=new Image();img.className='signature';
    div.appendChild(img);
    text('p','('+(r.name||'........................................................')+')',doc);
    text('p','ลงชื่อ ........................................................ ผู้รับเงิน',doc).style.marginTop='32px';
    text('p','('+(r.staff||'........................................................')+')',doc);
    text('small','เลขรายการ '+r.recordId+' • ยืนยัน '+new Date(r.confirmedAt).toLocaleString(),doc);
    var done=false;
    function ready(){if(done)return;done=true;window.print();}
    img.onload=ready;img.onerror=ready;img.src=r.tenantSignature;if(img.complete)ready();
  }  get('print').onclick=function(){if(selected)printRecord(selected);};
  function confirmedTime(value){
    var date=new Date(value);if(isNaN(date.getTime()))return 'ไม่ทราบเวลา';
    var thai=new Date(date.getTime()+7*60*60*1000);
    function pad(n){return n<10?'0'+n:String(n);}
    var iso=thai.toISOString().slice(0,10);
    return window.stay.buddhist(iso)+' เวลา '+pad(thai.getUTCHours())+':'+pad(thai.getUTCMinutes())+':'+pad(thai.getUTCSeconds())+' น.';
  }
  var historyType='รายวัน',historyFilters=document.createElement('div'),historyFilterButtons={};
  historyFilters.className='history-type-filters';historyFilters.setAttribute('role','group');historyFilters.setAttribute('aria-label','เลือกประเภทรายการที่ยืนยันแล้ว');history.parentNode.insertBefore(historyFilters,history);
  var templateTools=document.createElement('div');templateTools.className='monthly-template-tools';templateTools.style.display='none';history.parentNode.insertBefore(templateTools,history);
  var refreshTemplate=text('button','อัปเดตฟอร์มใหม่',templateTools);refreshTemplate.type='button';refreshTemplate.className='secondary';refreshTemplate.id='refresh-template';
  var templateNote=text('p','หลังแก้ Canva ให้ส่งออก PDF แล้วอัปโหลดเป็นเวอร์ชันใหม่ของแม่แบบใน Drive จากนั้นกดปุ่มนี้',templateTools);templateNote.className='note';
  var templateLink=text('a','เปิดแม่แบบใน Drive',templateTools);templateLink.href='#';templateLink.target='_blank';templateLink.rel='noopener noreferrer';
  var templateStatus=text('p','',templateTools);templateStatus.className='note';templateStatus.setAttribute('role','status');templateStatus.setAttribute('aria-live','polite');
  refreshTemplate.onclick=function(){refreshTemplate.disabled=true;refreshTemplate.textContent='กำลังตรวจฟอร์ม…';templateStatus.textContent='กำลังตรวจเวอร์ชันแม่แบบใน Drive';var x=new XMLHttpRequest();var requestKind=historyType==='รายวัน'?'daily':'monthly';x.open('POST','/api/'+requestKind+'-template/refresh',true);x.setRequestHeader('x-access-token',token);x.timeout=90000;x.onload=function(){refreshTemplate.disabled=false;refreshTemplate.textContent='อัปเดตฟอร์มใหม่';try{var result=JSON.parse(x.responseText);if(x.status!==200)throw new Error(result.error||'อัปเดตไม่สำเร็จ');templateStatus.className='note';templateStatus.textContent=result.updated?'อัปเดตฟอร์มใหม่แล้ว ใช้กับการสร้าง PDF ครั้งถัดไป':'แม่แบบใน Drive ไม่เปลี่ยน ใช้ฉบับปัจจุบันได้ (ปุ่มนี้ไม่ได้ดึงจาก Canva โดยตรง)';}catch(e){templateStatus.className='error';templateStatus.textContent=e.message;}};x.onerror=x.ontimeout=function(){refreshTemplate.disabled=false;refreshTemplate.textContent='อัปเดตฟอร์มใหม่';templateStatus.className='error';templateStatus.textContent='ตรวจฟอร์มไม่สำเร็จ ตรวจ Wi-Fi แล้วลองใหม่';};x.send('{}');};
  each(['รายวัน','รายเดือน'],function(kind){var button=text('button',kind,historyFilters);button.type='button';button.className='history-type-filter';button.setAttribute('aria-pressed',kind===historyType?'true':'false');button.onclick=function(){historyType=kind;templateStatus.textContent='';each(['รายวัน','รายเดือน'],function(value){historyFilterButtons[value].setAttribute('aria-pressed',value===kind?'true':'false');});load();};historyFilterButtons[kind]=button;});
  function historyLocked(){templateTools.style.display='none';history.textContent='รายการถูกล็อก กดเปิดรายการแล้วกรอกรหัส';}
  if(window.historyAccess)window.historyAccess.setOnLock(historyLocked);
  function historyAction(parent,label,description,action,danger){
    var button=text('button',label,parent);button.type='button';button.className='history-action'+(danger?' history-action-delete':'');button.setAttribute('aria-label',description);button.title=description;button.onclick=action;return button;
  }
  function trackedHistoryAction(parent,label,description,record,kind,action){
    var key='sanshine-history-action:'+record.recordId+':'+kind,pressed=false;
    try{pressed=localStorage.getItem(key)==='1';}catch(e){}
    if(kind==='google'&&record.google)pressed=true;
    var button=historyAction(parent,label,description,function(){pressed=true;button.setAttribute('data-used','true');button.title=description+' • กดแล้ว';try{localStorage.setItem(key,'1');}catch(e){}action();});
    button.className+=' history-action-tracked';button.setAttribute('data-used',pressed?'true':'false');button.title=description+(pressed?' • กดแล้ว':' • ยังไม่กด');return button;
  }
  function load(){
    if(window.historyAccess&&window.historyAccess.restricted&&!window.historyAccess.token()){historyLocked();return;}
    api('GET',null,function(err,rows){
      history.textContent='';if(err){history.textContent=err.message;return;}
      templateTools.style.display='';templateLink.href='https://drive.google.com/file/d/'+(historyType==='รายวัน'?window.stayhubProperty.dailyTemplateId:window.stayhubProperty.monthlyTemplateId)+'/view';refreshTemplate.setAttribute('aria-label','อัปเดตฟอร์มใหม่ '+historyType);var filteredRows=[];each(rows,function(record){if(record.type===historyType)filteredRows.push(record);});rows=filteredRows;
      if(!rows.length){text('p','ยังไม่มีรายการ'+historyType+'ที่ยืนยัน',history).className='note';return;}
      each(rows.slice().reverse(),function(r){
        var entry=text('div','',history);entry.className='history-row';
        var line=text('div','',entry);line.className='history-line';
        var info=text('div','',line);info.className='history-info';
        text('strong',r.name||'—',info).className='history-name';text('span',r.type,info).className='history-type';
        var rooms=r.rooms&&r.rooms.length?r.rooms.join(', '):r.room||'—';
        text('div','ห้อง '+rooms+' · ยืนยัน '+confirmedTime(r.confirmedAt),info).className='history-meta';
        var actions=text('div','',line);actions.className='history-actions';var sendStatus=text('p','',entry);sendStatus.className='note';sendStatus.setAttribute('role','status');
        trackedHistoryAction(actions,'พิมพ์','พิมพ์ฉบับที่ยืนยัน',r,'print',function(){printRecord(r);});
        var google=trackedHistoryAction(actions,'ส่ง Google',r.google?'ส่ง Google อีกครั้ง':'ส่งเข้า Google Sheets / Drive',r,'google',function(){
          google.disabled=true;google.textContent='กำลังส่ง…';sendStatus.className='note';sendStatus.textContent='กำลังสร้าง PDF และส่งเข้า Google Drive…';status.textContent='กำลังส่งข้อมูลเข้า Google…';
          api('GOOGLE',{recordId:r.recordId},function(err){google.disabled=false;google.textContent='ส่ง Google';status.className=err?'error':'';status.textContent=err?err.message:'สร้าง PDF และบันทึก Google สำเร็จ';sendStatus.className=err?'error':'note';sendStatus.textContent=err?err.message:'บันทึก PDF สำเร็จ';if(!err)load();});
        });
        if(r.type==='รายวัน'&&r.payment==='เงินโอน'&&r.channel!=='Online'&&total(r)>0)trackedHistoryAction(actions,'QR','QR ชำระเงิน',r,'qr',function(){showPayment(r);});
        var del=historyAction(actions,'ลบ','ลบรายการ',function(){
          if(!window.confirm('ลบรายการของ '+r.name+' ห้อง '+r.room+' ใช่หรือไม่?'))return;
          del.disabled=true;api('DELETE',{recordId:r.recordId},function(err){if(err){status.textContent=err.message;del.disabled=false;return;}if(selected&&selected.recordId===r.recordId)invalidate();load();});
        },true);
        if(r.cardImageData){
          var details=text('details','',entry);details.className='history-card-details';text('summary','ดูรูปบัตร',details);
          var image=document.createElement('img');image.alt='รูปบัตรที่ใช้ลงทะเบียน';image.src=r.cardImageData;image.style.cssText='display:block;max-width:100%;max-height:350px;object-fit:contain;margin:8px 0';details.appendChild(image);
          text('p','พนักงานผู้ตรวจ: '+(r.identityReviewer||'—'),details).className='note';
        }
      });
    });
  }
  get('read-card').onclick=function(){
    var button=get('read-card');button.disabled=true;status.textContent='กำลังอ่านบัตร…';
    api('CARD',null,function(err,r){button.disabled=false;if(err){status.textContent=err.message;status.className='error';return;}
      paymentChosen=false;checkoutConfirmed=false;each(form.elements,function(el){if(el.type==='radio')el.checked=false;});delete r.payment;delete r.channel;cardPhoto=r.photo||'';photoPreview.style.display=cardPhoto?'block':'none';if(cardPhoto)photoPreview.src=cardPhoto;else photoPreview.removeAttribute('src');
      each(form.elements,function(el){if(el.name&&Object.prototype.hasOwnProperty.call(r,el.name)){var isDate=false;each(schema,function(row){if(row[0]===el.name&&row[2]==='date')isDate=true;});if(el.type==='radio')el.checked=el.value===r[el.name];else el.value=isDate?window.stay.buddhist(r[el.name]):r[el.name];}});
      cardCustomerMode=isPaymentDevice()&&controls.type.value==='รายวัน';cardReviewStage=false;

      layout();applyRoomList(r.rooms);changed();status.className='';status.textContent=cardCustomerMode?'กรอกทะเบียนรถ เบอร์โทร และเซ็น แล้วกดยืนยันลายเซ็น':'อ่านบัตรและดึงข้อมูลร่างสำเร็จ กรุณาตรวจข้อมูลก่อนเซ็นและบันทึก';

    });
  };
  get('reset-form').onclick=function(){if(busy||get('read-card').disabled)return;resetForm();api('RESET',null,function(err){status.className=err?'error':'';status.textContent=err?'ล้างหน้าจอแล้ว แต่ล้างข้อมูลร่างไม่สำเร็จ: '+err.message:'รีเซ็ตแล้ว พร้อมเริ่มรายการใหม่';});};
  var receivedCardRevision=-1,liveCardBusy=false,completionId='',completionTimer=null,displayPayment=null,completionOverlay=null,displayQrKey='',completionFlowId='';
  function updateDisplayPayment(r){
    if(isLenovoDisplay&&displayPayment){displayPayment.close();displayPayment=null;}
  }
  function beginCompletedDisplay(r){
    var flowKey=r.recordId+'|'+(r.qrReplayId||'');if(completionFlowId===flowKey)return;completionFlowId=flowKey;
    if(displayPayment){displayPayment.close();displayPayment=null;}
    if(isLenovoDisplay&&r.type==='รายวัน'&&r.payment==='เงินโอน'&&r.channel!=='Online'&&total(r)>0){
      displayPayment=window.showPaymentPoster(r,function(record,done){api('PAYMENT',{recordId:record.recordId},done);},{durationMs:30000,hideClose:true,onExpire:function(){displayPayment=null;showDisplayThanks(r);}});
    }else showDisplayThanks(r);
  }
  function showDisplayThanks(r){
    var thanksKey=r.recordId+'|'+(r.qrReplayId||'');if(completionId===thanksKey)return;completionId=thanksKey;
    if(displayPayment){displayPayment.close();displayPayment=null;}
    if(completionTimer)clearTimeout(completionTimer);
    var thanksTarget=customerIdentity;
    if(isPaymentIPad()){if(completionOverlay&&completionOverlay.parentNode)completionOverlay.parentNode.removeChild(completionOverlay);completionOverlay=document.createElement('div');completionOverlay.className='ipad-completion-screen';var assets=window.sanshineBrandAssets||{};if(assets.frame)completionOverlay.style.backgroundImage='url("'+assets.frame+'")';var originalHeader=document.querySelector('header.brand-reference-header');if(originalHeader){var completionHeader=originalHeader.cloneNode(true);completionHeader.className+=' completion-brand-header';completionOverlay.appendChild(completionHeader);}thanksTarget=text('div','',completionOverlay);thanksTarget.className='ipad-completion-message';document.body.appendChild(completionOverlay);}
    thanksTarget.textContent='';text('h2','ขอบคุณที่ไว้วางใจ ซานชาย เพลส',thanksTarget).className='customer-thanks-title';
    text('p','ขอให้มีความสุขตลอดการเข้าพัก',thanksTarget).className='customer-thanks-message';
    completionTimer=setTimeout(function(){completionTimer=null;if(isPaymentIPad()){if(completionOverlay&&completionOverlay.parentNode)completionOverlay.parentNode.removeChild(completionOverlay);completionOverlay=null;resetForm();status.textContent='พร้อมเริ่มรายการใหม่';window.scrollTo(0,0);return;}thanksTarget.textContent='';text('h2','รอรายการถัดไปจากคอมพิวเตอร์',thanksTarget).className='customer-thanks-title';if(isLenovoDisplay&&window.SanshineDisplay&&typeof window.SanshineDisplay.closeCompletedDisplay==='function'){try{window.SanshineDisplay.closeCompletedDisplay();}catch(e){}}},10000);
  }
  function pollLiveCard(){
    if(!isPaymentDevice()||liveCardBusy||busy||!cardCustomerMode||controls.type.value!=='รายวัน')return;
    liveCardBusy=true;var x=new XMLHttpRequest();x.open('GET','/api/live-card'+(isPaymentIPad()?'?client=ipad':''),true);x.setRequestHeader('x-access-token',token);x.timeout=5000;
    x.onload=function(){liveCardBusy=false;if(x.status!==200){if(x.status===404){status.textContent='คอมยังเปิดเซิร์ฟเวอร์รุ่นเดิม กรุณาปิดและเปิดโปรแกรม Sanshine บนคอมใหม่';status.className='error';if(isLenovoDisplay){if(displayPayment){displayPayment.close();displayPayment=null;}displayQrKey='';customerIdentity.textContent='กรุณาปิดและเปิด Sanshine บนคอมใหม่';}}return;}try{var response=JSON.parse(x.responseText);if(response.revision===receivedCardRevision)return;receivedCardRevision=response.revision;var r=response.record;if(!r){if(isPaymentIPad()){if(completionTimer){clearTimeout(completionTimer);completionTimer=null;}if(completionOverlay&&completionOverlay.parentNode)completionOverlay.parentNode.removeChild(completionOverlay);completionOverlay=null;resetForm();status.textContent='พร้อมรับรายการใหม่จากคอมพิวเตอร์';}if(isLenovoDisplay){if(displayPayment){displayPayment.close();displayPayment=null;}displayQrKey='';if(completionTimer){clearTimeout(completionTimer);completionTimer=null;}controls.name.value='';cardPhoto='';showCustomerIdentity();if(response.resetId&&window.SanshineDisplay&&typeof window.SanshineDisplay.closeCompletedDisplay==='function'){try{window.SanshineDisplay.closeCompletedDisplay();}catch(e){}}}return;}
      if(r.displayPending===true){if(isLenovoDisplay){if(displayPayment){displayPayment.close();displayPayment=null;}if(completionTimer){clearTimeout(completionTimer);completionTimer=null;}controls.name.value='';cardPhoto='';customerIdentity.textContent='';}return;}
      if(r.qrReplayId&&!isLenovoDisplay)return;
      if((isLenovoDisplay||isPaymentIPad())&&r.confirmedAt&&r.recordId){beginCompletedDisplay(r);return;}
      if(completionTimer){clearTimeout(completionTimer);completionTimer=null;}if(completionOverlay&&completionOverlay.parentNode){completionOverlay.parentNode.removeChild(completionOverlay);completionOverlay=null;}
      var same=controls.id.value===r.id,phone=controls.phone.value,plate=controls.plate.value;paymentChosen=r.paymentChosen===true;each(form.elements,function(el){if(el.type==='radio')el.checked=false;});
      each(form.elements,function(el){if(el.name&&Object.prototype.hasOwnProperty.call(r,el.name)){var date=false;each(schema,function(row){if(row[0]===el.name&&row[2]==='date')date=true;});if(el.type==='radio')el.checked=el.value===r[el.name];else el.value=date?window.stay.buddhist(r[el.name]):r[el.name];}});
      if(same&&!isLenovoDisplay){controls.phone.value=phone;controls.plate.value=plate;}cardPhoto=r.photo||'';cardReviewStage=false;layout();applyRoomList(r.rooms);
      pads.tenantSignature.clear();invalidate();review();lastChangedSnapshot=JSON.stringify(values());customerLayout();status.textContent='รับข้อมูลบัตรจากคอมแล้ว กรุณากรอกทะเบียนรถ เบอร์โทร และเซ็น';status.className='';
      updateDisplayPayment(r);
    }catch(e){status.textContent='รับข้อมูลจากคอมไม่สำเร็จ กรุณาลองโหลดใหม่';}};
    x.onerror=x.ontimeout=function(){liveCardBusy=false;};x.send();
  }
  if(isPaymentDevice()){pollLiveCard();setInterval(pollLiveCard,1500);}
  var lockHistory=null;
  function openHistory(){history.style.display='';if(lockHistory)lockHistory.style.display='';load();}
  get('refresh').onclick=function(){if(window.historyAccess&&window.historyAccess.restricted&&!window.historyAccess.token())window.historyAccess.unlock(openHistory);else openHistory();};if(window.historyAccess&&window.historyAccess.restricted){get('refresh').textContent='เปิดรายการที่ยืนยันแล้ว';lockHistory=text('button','ล็อกรายการ',get('refresh').parentNode);lockHistory.type='button';lockHistory.className='secondary';lockHistory.onclick=function(){window.historyAccess.lock();};}
  if(isPaymentDevice()){
    get('reset-form').style.display='none';get('print').style.display='none';
    get('refresh').textContent='เปิดรายการ';history.style.display='none';
    var historyHeading=get('refresh').parentNode.querySelector('h2');if(historyHeading)historyHeading.style.display='none';
    if(lockHistory)lockHistory.style.display='none';
    if(window.historyAccess)window.historyAccess.setOnLock(function(){historyLocked();history.style.display='none';if(lockHistory)lockHistory.style.display='none';});
  }
  status.textContent='พร้อมรับลายเซ็น • รุ่นรองรับ iPad 4';load();
})();
