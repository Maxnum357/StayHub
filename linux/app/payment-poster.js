(function(){
  window.showPaymentPoster=function(record,request,options){
    options=options||{};
    var assets=window.sanshineBrandAssets||{};
    var overlay=document.createElement('div');overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','สแกนชำระค่าห้อง');overlay.style.cssText='position:fixed;z-index:10000;top:0;left:0;right:0;bottom:0;overflow:auto;padding:14px;background:#211707';if(assets.frame)overlay.style.backgroundImage='url("'+assets.frame+'")';overlay.style.backgroundSize='cover';overlay.style.backgroundPosition='center';
    var panel=document.createElement('div');panel.style.cssText='max-width:900px;margin:0 auto;border:4px double #d2a24b;border-radius:24px;background:#fffcf4;color:#241807;box-shadow:0 8px 30px #0005;overflow:hidden;text-align:center';overlay.appendChild(panel);
    var brand=document.createElement('div');brand.style.cssText='background:linear-gradient(110deg,#080807,#302113);padding:14px;color:#ffedbb;border-bottom:3px solid #d1a354';panel.appendChild(brand);if(assets.frame){brand.style.backgroundImage='url("'+assets.frame+'")';brand.style.backgroundSize='300% auto';brand.style.backgroundPosition='right top';}
    var logo=document.createElement('img');logo.className='brand-original-logo';logo.src=assets.logo||'';logo.alt='Sanshine Place โลโก้ต้นฉบับ';logo.style.cssText='width:76px;height:76px;object-fit:contain;vertical-align:middle;margin-right:16px;border-radius:50%;background:white;padding:6px;box-sizing:content-box;filter:none;-webkit-filter:none;box-shadow:none';var logoStack=document.createElement('span');logoStack.className='brand-logo-stack qr-logo-stack';brand.appendChild(logoStack);logoStack.appendChild(logo);
    var title=document.createElement('span');title.className='qr-brand-wordmark';title.appendChild(document.createTextNode('SāNSHIN'));var brandE=document.createElement('b');brandE.className='brand-e';brandE.setAttribute('aria-label','E');brandE.innerHTML='<i></i><i></i><i></i>';title.appendChild(brandE);var place=document.createElement('span');place.textContent='Place';place.style.cssText='display:block;font-size:65%;text-align:center;letter-spacing:1px;margin-top:7px';title.appendChild(place);title.style.cssText='display:inline-block;text-align:center;white-space:nowrap;font:bold 24px Georgia,serif;vertical-align:middle;color:#fff;text-shadow:none';brand.appendChild(title);
    function line(tag,value,style){var el=document.createElement(tag);el.textContent=value;el.style.cssText=style;panel.appendChild(el);return el;}
    line('h2','สแกนชำระค่าห้อง','font:bold 24px Tahoma,sans-serif;color:#604210;margin:18px 0 8px;border:0;padding:0');
    var amount=line('div','กำลังสร้าง QR…','font:bold 48px Tahoma,sans-serif;line-height:1.25;margin:8px 12px;color:#1c1407');
    var merchant=line('div','ซานชาย เพลส','font:bold 23px Tahoma,sans-serif;margin:6px 12px 16px');
    var qrBox=line('div','','background:white;border:3px double #c59944;border-radius:16px;padding:12px;max-width:344px;margin:0 auto;box-sizing:border-box');
    var qr=document.createElement('img');qr.alt='QR ชำระเงิน';qr.style.cssText='display:none;width:100%;height:auto;max-width:310px;max-height:none;border:0';qrBox.appendChild(qr);
    var close=line('button','ปิด','display:block;min-width:180px;margin:16px auto 8px;background:linear-gradient(#ffedb8,#d1a34a);border:1px solid #aa7a2b;border-radius:999px;padding:10px 24px;color:#241807;font:bold 20px Tahoma,sans-serif');close.type='button';if(options.hideClose)close.style.display='none';
    var countdown=line('div','รอ QR พร้อม','font:14px Tahoma,sans-serif;color:#75623f;margin:4px 0 12px');
    line('p','ตรวจชื่อผู้รับและยอดเงินในแอปธนาคารก่อนชำระ กรุณาให้เจ้าหน้าที่ตรวจเงินเข้าหรือสลิป','font:15px Tahoma,sans-serif;line-height:1.5;background:#f4e6c9;border-top:1px solid #d6b77a;padding:14px;margin:0');
    var timer=null,closed=false;function dismiss(reason){if(closed)return;closed=true;if(timer!==null)clearInterval(timer);if(overlay.parentNode)overlay.parentNode.removeChild(overlay);if(reason==='timeout'&&typeof options.onExpire==='function')options.onExpire();}close.onclick=function(){dismiss('manual');};document.body.appendChild(overlay);
    request(record,function(error,result){if(closed)return;if(error){amount.textContent='สร้าง QR ไม่สำเร็จ';qrBox.textContent=error.message;countdown.textContent='กดปิดแล้วลองใหม่';return;}
      amount.textContent=Number(result.amount).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})+' บาท';merchant.textContent=result.merchant||'ซานชาย เพลส';
      qr.onload=function(){if(closed)return;qr.style.display='block';var deadline=Date.now()+(options.durationMs||60000);function tick(){var seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));countdown.textContent=(options.onExpire?'เปลี่ยนหน้าภายใน ':'ปิดอัตโนมัติใน ')+Math.floor(seconds/60)+':'+(seconds%60<10?'0':'')+(seconds%60);if(seconds===0)dismiss('timeout');}tick();timer=setInterval(tick,250);};
      qr.onerror=function(){countdown.textContent='โหลด QR ไม่สำเร็จ';};qr.src=result.image;
    });return {close:dismiss};
  };
})();
