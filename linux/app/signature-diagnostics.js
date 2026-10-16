(function(){
 var problems=[];
 window.addEventListener('error',function(e){if(e.message)problems.push(String(e.message).slice(0,160));},false);
 if(!/LenovoKitKat/i.test(navigator.userAgent))return;
 function report(){var key=(location.search.match(/[?&]key=([^&]*)/)||[])[1]||'',x=new XMLHttpRequest();x.open('POST','/api/signature-diagnostics',true);x.setRequestHeader('Content-Type','application/json');x.setRequestHeader('x-access-token',decodeURIComponent(key));x.send(JSON.stringify({padReady:!!window.lenovoSignaturePad,createPad:typeof window.createSignaturePad,fieldCount:document.getElementById('fields').getElementsByTagName('input').length,errors:problems}));}
 window.addEventListener('load',function(){setTimeout(report,1500);},false);
})();
