(function(root){
 function parse(text){
  text=String(text||'').replace(/[๐-๙]/g,function(c){return String(c.charCodeAt(0)-3664);});
  var result={},short=['มค','กพ','มีค','เมย','พค','มิย','กค','สค','กย','ตค','พย','ธค'],full=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'],english=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  function date(value){var m=value.match(/(\d{1,2})\s*(?:[\/.\-]\s*(\d{1,2})\s*[\/.\-]|([A-Za-zก-๙.]+)[,\s]+)\s*(\d{4})/);if(!m)return '';var month=Number(m[2]);if(!month){var name=m[3].replace(/\./g,'').toLowerCase();month=short.indexOf(name)+1;if(!month)month=full.indexOf(name)+1;if(!month)month=english.indexOf(name.slice(0,3))+1;}var year=Number(m[4]);if(year<2400)year+=543;return root.stay.fromBuddhist(m[1]+'/'+month+'/'+year);}
  var pattern=/\d{1,2}\s*(?:[\/.\-]\s*\d{1,2}\s*[\/.\-]|[A-Za-zก-๙.]+[,\s]+)\s*\d{4}/g;
  function labeled(anchor){var match=anchor.exec(text);if(!match)return '';var at=match.index,after=text.slice(at+match[0].length,at+match[0].length+65),before=text.slice(Math.max(0,at-65),at),dates=after.match(pattern);if(dates&&/^\s*[:：]?\s*$/.test(after.slice(0,after.indexOf(dates[0]))))return date(dates[0]);dates=before.match(pattern);return dates?date(dates[dates.length-1]):'';}
  var birthday=labeled(/เกิด\s*(?:วันที่|วันที|วันทื่)|วันเกิด|date\s*of\s*birth/i);if(birthday)result.birth=birthday;
  var issue=labeled(/วัน\s*(?:ออก|ตอก)\s*บัตร|date\s*of\s*issue/i);if(issue)result.issue=issue;
  var expiry=labeled(/วัน\s*(?:บัตร\s*)?หมดอายุ|date\s*of\s*expiry/i);if(expiry)result.expiry=expiry;
  if(result.issue&&result.expiry&&result.expiry<=result.issue){delete result.issue;delete result.expiry;}
  var name=text.match(/(?:ชื่อตัวและชื่อสกุล|ชื่อและชื่อสกุล|ชื่อ[–-]สกุล)\s*[:：]?\s*([^\n]+)/);if(name){var value=name[1].split(/\bName\b|\bMr\.|\bMiss\b|เกิดวันที่/i)[0].trim();if(value&&value.length<120)result.name=value;}
  var address=text.match(/ที่อยู่\s*[:：]?\s*([^\n]+)(?:\n(จ\.[^\n]+))?/);if(address)result.address=(address[1]+' '+(address[2]||'')).trim();
  var ids=text.match(/(?:\d[ \t]*){13}/g)||[];for(var n=0;n<ids.length;n++){var digits=ids[n].replace(/\D/g,'');if(digits.length!==13)continue;var sum=0;for(var i=0;i<12;i++)sum+=Number(digits[i])*(13-i);if((11-sum%11)%10===Number(digits[12])){result.id=digits;break;}}
  return result;
 }
 root.parseCardOcr=parse;
})(window);
