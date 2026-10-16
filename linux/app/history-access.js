(function(){
  var mobile=/Android|iPad|iPhone|iPod|Mobile|Tablet|SanshineAndroid/i.test(navigator.userAgent)||(/Macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
  var session='',deadline=0,onLock=null;
  window.historyAccess={restricted:mobile,token:function(){if(Date.now()>=deadline)session='';return session;},setOnLock:function(fn){onLock=fn;},lock:function(){session='';deadline=0;if(onLock)onLock();},unlock:function(done){
    var overlay=document.createElement('div');overlay.style.cssText='position:fixed;z-index:20000;top:0;bottom:0;left:0;right:0;background:rgba(0,0,0,.7);padding:40px 16px;overflow:auto';
    var card=document.createElement('div');card.style.cssText='max-width:380px;margin:0 auto;background:linear-gradient(135deg,#fffef8,#f4e8cb);color:#38270d;padding:24px;border:3px double #c49a45;border-radius:24px';overlay.appendChild(card);
    var heading=document.createElement('h2');heading.textContent='เปิดรายการที่ยืนยันแล้ว';card.appendChild(heading);
    var input=document.createElement('input');input.type='password';input.maxLength=6;input.setAttribute('inputmode','numeric');input.setAttribute('pattern','[0-9]*');input.setAttribute('aria-label','รหัสเปิดรายการ');input.autocomplete='off';card.appendChild(input);
    var note=document.createElement('p');note.setAttribute('role','status');card.appendChild(note);
    var submit=document.createElement('button');submit.type='button';submit.textContent='เปิดรายการ';card.appendChild(submit);
    var cancel=document.createElement('button');cancel.type='button';cancel.textContent='ยกเลิก';cancel.className='secondary';card.appendChild(cancel);
    function close(){if(overlay.parentNode)overlay.parentNode.removeChild(overlay);}cancel.onclick=close;
    submit.onclick=function(){if(!/^\d{6}$/.test(input.value)){note.textContent='กรอกรหัส 6 หลัก';return;}submit.disabled=true;var x=new XMLHttpRequest(),key=(location.search.match(/[?&]key=([^&]*)/)||[])[1]||'';x.open('POST','/api/history-unlock');x.setRequestHeader('Content-Type','application/json');x.setRequestHeader('x-access-token',decodeURIComponent(key));x.timeout=15000;x.onload=function(){submit.disabled=false;try{var r=JSON.parse(x.responseText);if(x.status!==200){note.textContent=r.error||'เปิดรายการไม่สำเร็จ';input.value='';return;}session=r.session;deadline=Date.now()+r.expiresIn*1000;setTimeout(function(){if(Date.now()>=deadline)window.historyAccess.lock();},r.expiresIn*1000);close();done();}catch(e){note.textContent='เปิดรายการไม่สำเร็จ';}};x.onerror=x.ontimeout=function(){submit.disabled=false;note.textContent='ติดต่อคอมพิวเตอร์ไม่ได้';};x.send(JSON.stringify({pin:input.value}));
    };input.onkeydown=function(e){if(e.keyCode===13)submit.onclick();};document.body.appendChild(overlay);input.focus();
  }};
})();
