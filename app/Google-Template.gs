// Install in Google Apps Script. Set SECRET, SHEET_ID and FOLDER_ID in Script Properties.
function doPost(e){
 var lock=LockService.getScriptLock();
 function output(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
 try{
  var request=JSON.parse(e.postData.contents),props=PropertiesService.getScriptProperties();
  if(!props.getProperty('SECRET')||request.secret!==props.getProperty('SECRET'))return output({ok:false,error:'Unauthorized'});
  if(request.action==='health'){SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getName();DriveApp.getFolderById(props.getProperty('FOLDER_ID')).getName();DriveApp.getFolderById(props.getProperty('CARD_IMAGE_FOLDER_ID')).getName();return output({ok:true,ready:true});}
  if(request.action==='cardLog'){
   var card=request.record;if(!card||!card.eventId||!/^\d{13}$/.test(card.id||''))throw Error('ข้อมูลบัตรไม่ครบ');
   lock.waitLock(30000);
   var cardBook=SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
   var cardSheet=cardBook.getSheets().filter(function(s){return s.getSheetId()===0;})[0];
   if(!cardSheet)throw Error('ไม่พบแท็บ gid=0 กรุณาตรวจชีตปลายทาง');
   if(!cardSheet.getLastRow()){cardSheet.appendRow(['เลขเหตุการณ์','วันเวลาที่อ่าน','เลขบัตร','ชื่อ–สกุล','ที่อยู่','วันเกิด','วันออกบัตร','วันหมดอายุ','รูปจากบัตร']);cardSheet.setFrozenRows(1);}
   // Customer identity is the 13-digit card number, not the insertion event.
   // Keep the card reader/form flow independent; skip only the Google customer insert.
   if(cardSheet.getLastRow()>1){
    var knownCards=cardSheet.getRange(2,3,cardSheet.getLastRow()-1,1).getDisplayValues();
    for(var cardIndex=0;cardIndex<knownCards.length;cardIndex++){
     if(String(knownCards[cardIndex][0]).replace(/\D/g,'')===card.id)return output({ok:true,duplicate:true});
    }
   }
   var photoUrl='';
   if(card.photo){var cardFolder=DriveApp.getFolderById(props.getProperty('CARD_IMAGE_FOLDER_ID')),photoName='card-photo_'+card.eventId+'.jpg',photos=cardFolder.getFilesByName(photoName);
    var photoFile=photos.hasNext()?photos.next():cardFolder.createFile(Utilities.newBlob(Utilities.base64Decode(card.photo.split(',')[1]),card.photo.indexOf('image/png')>=0?'image/png':'image/jpeg',photoName));photoUrl=photoFile.getUrl();}
   var cardDate=function(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return '';return s.slice(8,10)+'/'+s.slice(5,7)+'/'+(Number(s.slice(0,4))+543);};
   var cardValues=[card.eventId,Utilities.formatDate(new Date(card.readAt),'Asia/Bangkok','dd/MM/yyyy HH:mm:ss'),card.id,card.name,card.address,cardDate(card.birth),cardDate(card.issue),cardDate(card.expiry),photoUrl];
   cardSheet.getRange(cardSheet.getLastRow()+1,1,1,cardValues.length).setNumberFormat('@').setValues([cardValues.map(function(v){var s=String(v||'');return /^[=+@-]/.test(s)?"'"+s:s;})]);
   return output({ok:true});
  }
  if(request.action==='imageData'){
   var imageMatch=String(request.record.imageUrl||'').match(/\/d\/([A-Za-z0-9_-]+)/)||String(request.record.imageUrl||'').match(/[?&]id=([A-Za-z0-9_-]+)/);
   if(!imageMatch)throw Error('ลิงก์รูปภาพไม่ถูกต้อง');
   var imageFile=DriveApp.getFileById(imageMatch[1]);
   if(imageFile.getMimeType().indexOf('image/')!==0)throw Error('ไฟล์ไม่ใช่รูปภาพ');
   return output({ok:true,data:Utilities.base64Encode(imageFile.getBlob().getBytes())});
  }
  if(request.action==='cardUploadOcr'){
   var uploaded=String(request.record&&request.record.imageData||'');
   if(uploaded.length>4500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(uploaded))throw Error('รูปบัตรไม่ถูกต้อง');
   var bytes=Utilities.base64Decode(uploaded.split(',')[1]),boundary='sanshine_ocr_'+Utilities.getUuid(),meta=JSON.stringify({name:'TEMP_CARD_OCR',mimeType:'application/vnd.google-apps.document'});
   var multipart=Utilities.newBlob('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+boundary+'\r\nContent-Type: image/jpeg\r\n\r\n').getBytes().concat(bytes).concat(Utilities.newBlob('\r\n--'+boundary+'--').getBytes());
   var response=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=th',{method:'post',contentType:'multipart/related; boundary='+boundary,payload:multipart,headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
   var created=JSON.parse(response.getContentText());if(!created.id)throw Error('OCR ไม่สำเร็จ กรุณาลองใหม่หรือกรอกข้อมูลเอง');
   try{return output({ok:true,text:DocumentApp.openById(created.id).getBody().getText()});}finally{DriveApp.getFileById(created.id).setTrashed(true);}
  }
  if(request.action==='cardOcr'){
   var url=String(request.imageUrl||''),match=url.match(/\/d\/([A-Za-z0-9_-]+)/)||url.match(/[?&]id=([A-Za-z0-9_-]+)/);if(!match)throw Error('กรุณาใช้ลิงก์รูปบัตรใน Google Drive');
   var file=DriveApp.getFileById(match[1]);if(file.getMimeType().indexOf('image/')!==0)throw Error('ลิงก์นี้ไม่ใช่ไฟล์รูปภาพ');
   var boundary='ocr_boundary',meta=JSON.stringify({name:'TEMP_OCR',mimeType:'application/vnd.google-apps.document'});
   var payload=Utilities.newBlob('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+boundary+'\r\nContent-Type: '+file.getMimeType()+'\r\n\r\n').getBytes().concat(file.getBlob().getBytes()).concat(Utilities.newBlob('\r\n--'+boundary+'--').getBytes());
   var response=UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=th',{method:'post',contentType:'multipart/related; boundary='+boundary,payload:payload,headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
   var created=JSON.parse(response.getContentText());if(!created.id)throw Error('OCR ไม่สำเร็จ กรุณาตรวจสิทธิ์ Google');
   try{return output({ok:true,text:DocumentApp.openById(created.id).getBody().getText()});}finally{DriveApp.getFileById(created.id).setTrashed(true);}
  }
  if(request.action==='monthlyRows'){
   var source=SpreadsheetApp.openById(props.getProperty('MONTHLY_SOURCE_ID')).getSheetByName('การตอบแบบฟอร์ม 1');
   var last=source.getLastRow();var values=last>1?source.getRange(2,1,last-1,26).getDisplayValues():[];
   return output({ok:true,rows:values.map(function(c,i){return {row:i+2,cells:c};})});
  }
  var r=request.record;if(!r||!r.recordId||!r.name||!r.tenantSignature)throw Error('Incomplete record');
  lock.waitLock(30000);
  var book=SpreadsheetApp.openById(props.getProperty('SHEET_ID')),sheet=book.getSheetByName('รายการเข้าพัก')||book.insertSheet('รายการเข้าพัก');
  var headers=['เลขรายการ','เวลายืนยัน','ประเภท','เลขบัตร','ชื่อ–สกุล','ที่อยู่','วันเกิด','วันออกบัตร','วันหมดอายุ','วันที่เข้า','วันที่ออก','เลขห้อง','จำนวนห้อง','ราคา','จำนวนคืน','ยอดรวม','เบอร์โทร','ทะเบียนรถ','ชำระเงิน','ช่องทาง','PDF'];
  if(!sheet.getLastRow()){sheet.appendRow(headers);sheet.setFrozenRows(1);sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#164c40').setFontColor('#ffffff');}
  if(sheet.getLastRow()>1){var existing=sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(r.recordId).matchEntireCell(true).findNext();if(existing&&!request.pdfBase64){var link=sheet.getRange(existing.getRow(),21).getValue();return output({ok:true,pdfUrl:link,sheetUrl:book.getUrl()});}}
  var folder=DriveApp.getFolderById(props.getProperty('FOLDER_ID')),filename=(request.pdfBase64?'Canva_'+r.type+'_':'ลงทะเบียน_')+r.recordId+'.pdf';
  var matches=folder.getFilesByName(filename),pdf;
  if(request.pdfBase64){
   if(request.pdfTemplate!==(r.type==='รายวัน'?'canva-daily-v1':'canva-monthly-v1'))throw Error('กรุณาอัปเดตโปรแกรมเพื่อใช้ฟอร์ม Canva');
   pdf=matches.hasNext()?matches.next():folder.createFile(Utilities.newBlob(Utilities.base64Decode(request.pdfBase64),MimeType.PDF,filename));
  }else if(matches.hasNext())pdf=matches.next();else{
   var doc=DocumentApp.create('TEMP_'+r.recordId),body=doc.getBody();
   try{
    if(r.type==='รายเดือน'){fillMonthlyContract(body,r);}else{
    body.setPageWidth(595.28).setPageHeight(841.89).setMarginTop(30).setMarginBottom(30).setMarginLeft(36).setMarginRight(36);
    body.setAttributes({FONT_FAMILY:'Arial',FONT_SIZE:11});
    function paragraph(value,parent){return (parent||body).appendParagraph(String(value||'')).setSpacingBefore(0).setSpacingAfter(4);}
    function thaiDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '—';var months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];return Number(value.slice(8,10))+' '+months[Number(value.slice(5,7))-1]+' '+(Number(value.slice(0,4))+543);}
    function image(data,parent,width,height){var parts=data.split(',');return parent.appendImage(Utilities.newBlob(Utilities.base64Decode(parts[1]),parts[0].indexOf('jpeg')>=0?'image/jpeg':'image/png')).setWidth(width).setHeight(height);}
    paragraph('STAYHUB_PROPERTY').setAlignment(DocumentApp.HorizontalAlignment.CENTER).editAsText().setFontSize(22).setBold(true);
    paragraph('ใบลงทะเบียนเช่าที่พัก '+r.type).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    paragraph('STAYHUB_ADDRESS').setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    paragraph('สัญญานี้เรียกว่าสัญญาเช่าที่พักอาศัย โดย STAYHUB_MANAGER ผู้จัดการอาคาร หอพักSTAYHUB_PROPERTY').editAsText().setFontSize(10);
    var top=body.appendTable([['','']]);top.setBorderWidth(0);top.setColumnWidth(0,420);top.setColumnWidth(1,100);
    paragraph('ชื่อ–สกุล: '+r.name,top.getCell(0,0));paragraph('เลขบัตรประชาชน: '+r.id,top.getCell(0,0));paragraph('ที่อยู่: '+r.address,top.getCell(0,0));
    if(r.photo)image(r.photo,top.getCell(0,1),75,95);
    var rows=[['วันเกิด: '+thaiDate(r.birth),'เบอร์โทร: '+(r.phone||'—')],['วันออกบัตร: '+thaiDate(r.issue),'วันหมดอายุ: '+thaiDate(r.expiry)],['ทะเบียนรถ: '+(r.plate||'—'),''],['วันที่เข้าพัก: '+thaiDate(r.checkin),'วันที่ออก: '+thaiDate(r.checkout)],['เลขห้อง: '+r.room,'จำนวนห้อง: '+(r.roomCount||1)]];
    var table=body.appendTable(rows);table.setBorderWidth(0.5);
    for(var ri=0;ri<table.getNumRows();ri++)for(var ci=0;ci<2;ci++){var cell=table.getCell(ri,ci);cell.setPaddingTop(5).setPaddingBottom(5);cell.getChild(0).asParagraph().setSpacingBefore(0).setSpacingAfter(0);}
    paragraph('เข้าพัก 13:00 น. • ออกก่อน 12:00 น.');
    paragraph(r.rate+' บาท × '+(r.nights||1)+' คืน × '+(r.roomCount||1)+' ห้อง = '+(r.total||Number(r.rate)*Number(r.months||1))+' บาท').editAsText().setBold(true);
    var signs=body.appendTable([['','']]);signs.setBorderWidth(0);signs.setColumnWidth(0,260);signs.setColumnWidth(1,260);
    image(r.tenantSignature,signs.getCell(0,0),180,65);paragraph('ลงชื่อ ผู้เช่า',signs.getCell(0,0));paragraph('('+r.name+')',signs.getCell(0,0));
    paragraph(' ',signs.getCell(0,1)).setSpacingAfter(45);paragraph('ลงชื่อ ................................ ผู้รับเงิน',signs.getCell(0,1));paragraph('('+(r.staff||'................................')+')',signs.getCell(0,1));
    paragraph('เลขรายการ '+r.recordId+' • ยืนยัน '+Utilities.formatDate(new Date(r.confirmedAt),'Asia/Bangkok','dd/MM/yyyy HH:mm:ss')).editAsText().setFontSize(8);
    }
    doc.saveAndClose();pdf=folder.createFile(DriveApp.getFileById(doc.getId()).getAs(MimeType.PDF).setName(filename));
   }finally{DriveApp.getFileById(doc.getId()).setTrashed(true);}
  }
  var uploadedCardUrl='';
  if(r.cardImageData){
   if(r.identityReviewed!==true||!r.identityReviewer||r.cardImageData.length>4500000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.cardImageData))throw Error('ข้อมูลตรวจรูปบัตรไม่ครบ');
   var cardFolder=DriveApp.getFolderById(props.getProperty('CARD_IMAGE_FOLDER_ID')),cardName='uploaded-card_'+r.recordId+'.jpg',cardFiles=cardFolder.getFilesByName(cardName);
   var cardFile=cardFiles.hasNext()?cardFiles.next():cardFolder.createFile(Utilities.newBlob(Utilities.base64Decode(r.cardImageData.split(',')[1]),'image/jpeg',cardName));uploadedCardUrl=cardFile.getUrl();
  }
  var values=[r.recordId,r.confirmedAt,r.type,r.id,r.name,r.address,r.birth,r.issue,r.expiry,r.checkin,r.checkout,r.room,r.roomCount||1,r.rate,r.nights||'',r.total||'',r.phone,r.plate,r.payment,r.channel,pdf.getUrl()];
  var range=sheet.getRange(existing?existing.getRow():sheet.getLastRow()+1,1,1,values.length);range.setNumberFormat('@');range.setValues([values.map(function(v){var s=String(v==null?'':v);return /^[=+@-]/.test(s)?"'"+s:s;})]);
  if(r.cardImageData){sheet.getRange(1,22,1,4).setValues([['แหล่งข้อมูลตัวตน','ผู้ตรวจสอบ','เวลาตรวจสอบ','รูปบัตรที่อัปโหลด']]);sheet.getRange(range.getRow(),22,1,4).setNumberFormat('@').setValues([[r.identitySource,/^[=+@-]/.test(r.identityReviewer)?"'"+r.identityReviewer:r.identityReviewer,r.identityReviewedAt||'',uploadedCardUrl]]);}
  return output({ok:true,pdfUrl:pdf.getUrl(),sheetUrl:book.getUrl()});
 }catch(err){return output({ok:false,error:String(err.message||err)});}finally{if(lock.hasLock())lock.releaseLock();}
}

function fillMonthlyContract(body,r){
 body.appendParagraph('STAYHUB_PROPERTY — ข้อมูลผู้เช่ารายเดือน');
 body.appendParagraph('STAYHUB_ADDRESS');
 ['name','id','address','phone','room','checkin','leaseTerm'].forEach(function(k){body.appendParagraph(k+': '+String(r[k]||''));});
 body.appendParagraph('เอกสารข้อมูลผู้เช่า กรุณาแนบสัญญาเช่าที่พักซึ่งที่พักตรวจสอบแล้ว');
 body.appendImage(Utilities.newBlob(Utilities.base64Decode(r.tenantSignature.split(',')[1]),'image/png')).setWidth(180).setHeight(65);
}
