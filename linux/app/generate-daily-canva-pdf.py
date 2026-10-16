import os
import json,pathlib,re,html,sys,base64,datetime
import pymupdf as pdf
ROOT=pathlib.Path(__file__).resolve().parent
from canva_typography import FONT_ARCHIVE,FONT_CSS,content as font_content
months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
r=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
d=pdf.open(pathlib.Path(os.environ.get('STAYHUB_TEMPLATE_DIR',str(ROOT/'assets')))/'daily-canva.pdf');p=d[0]
for b in p.get_text('dict')['blocks']:
 for line in b.get('lines',[]):
  for span in line['spans']:
   if span['text'].strip()=='-':p.add_redact_annot(pdf.Rect(span['bbox']),fill=(1,.885,.67) if span['bbox'][1]<140 else (1,1,1))
for box in [(8,8,145,144),(36,495,343,688),(374,533,513,557)]:p.add_redact_annot(pdf.Rect(box),fill=(1,1,1))
p.apply_redactions(images=2,graphics=0)
def put(box,text,size=10):
 content=font_content(text)
 css=f'* {{font-family:CanvaLatin,sans-serif;font-size:{size}px;line-height:1.15;margin:0;padding:0;color:#000;}}'
 rect=pdf.Rect(box)
 # Measure first so wrapped Thai text keeps its font size and descenders clear the border.
 if box in slots.values():
  scratch=pdf.open();measure=scratch.new_page(width=595.5,height=842.25)
  spare,scale=measure.insert_htmlbox(rect,content,css=FONT_CSS+css,archive=FONT_ARCHIVE,scale_low=.65)
  scratch.close()
  if spare>2:rect.y0+=spare-2
 result=p.insert_htmlbox(rect,content,css=FONT_CSS+css,archive=FONT_ARCHIVE,scale_low=.65)
 if result[0]<0:raise ValueError('ข้อความยาวเกินพื้นที่แบบฟอร์ม')
def date(value):
 m=re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})',str(value or ''))
 return f'{int(m[3])} {months[int(m[2])-1]} {int(m[1])+543}' if m else value or '—'
slots={'name':(40,223,338,241),'nickname':(350,223,551,241),'phone':(40,271,181,289),'email':(193,271,421,289),'line':(433,271,551,289),'id':(40,318,290,337),'roomCount':(302,318,421,337),'stayDays':(433,318,551,337),'address':(40,366,290,385),'plate':(302,366,551,385),'checkin':(40,412,290,431),'checkout':(302,412,551,431)}
nights=(datetime.date.fromisoformat(r['checkout'])-datetime.date.fromisoformat(r['checkin'])).days
count=int(r.get('roomCount') or 1)
if nights<1 or count<1:raise ValueError('วันเข้าพักหรือจำนวนห้องไม่ถูกต้อง')
r['roomCount']=str(count);r['stayDays']=str(nights)
for key,box in slots.items():put(box,date(r.get(key)) if key in ('issue','expiry','checkin','checkout') else r.get(key))
# Cover the room placeholder while keeping the coloured Canva banner.
put((166,99,335,128),', '.join(r['rooms']) if isinstance(r.get('rooms'),list) and r['rooms'] else r.get('room'),15)
if r.get('tenantPhotoData'):r['photo']=r['tenantPhotoData']
for key,box in [('photo',(17,17,136,135)),('cardImageData',(38,498,340,686))]:
 if r.get(key):
  value=r[key];raw=base64.b64decode(value.split(',')[-1]);p.insert_image(pdf.Rect(box),stream=raw,keep_proportion=True)
if r.get('tenantSignature'):p.insert_image(pdf.Rect(380,494,503,525),stream=base64.b64decode(r['tenantSignature'].split(',')[1]),keep_proportion=True)
put((368,534,555,555),'('+str(r.get('name') or '')+')')
# Selected payment / source circles in the original template.
for center,selected in [((129,466),r.get('payment')=='เงินสด'),((223,466),r.get('payment')=='เงินโอน'),((390,466),str(r.get('channel','')).lower()=='walk-in'),((484,466),str(r.get('channel','')).lower()=='online')]:
 if selected:p.draw_circle(pdf.Point(*center),6,color=(0,0,0),fill=(0,0,0))
nights=(datetime.date.fromisoformat(r['checkout'])-datetime.date.fromisoformat(r['checkin'])).days
count=int(r.get('roomCount') or 1);rate=float(r.get('rate') if r.get('rate') is not None else 500)
if nights<1 or count<1 or rate<0:raise ValueError('วันเข้าพัก จำนวนห้อง หรือราคาไม่ถูกต้อง')
subtotal=rate*nights*count
discount=round(subtotal*.1,2) if int(r.get('discountPercent') or 0)==10 else 0
put((38,699,555,722),f'ค่าห้อง {rate:,.2f} บาท × {nights} คืน × {count} ห้อง = {subtotal:,.2f} บาท',12)
deposit=float(r.get('depositPaid') or 0)
put((38,724,555,744),f'ยอดรวม {subtotal-discount:,.2f} • มัดจำแล้ว {deposit:,.2f} • เหลือชำระ {subtotal-discount-deposit:,.2f} บาท',11)
put((38,752,555,774),'เกิดวันที่ '+date(r.get('birth'))+' • เข้าพัก 13:00 น. / ออกก่อน 12:00 น.')
put((38,797,555,822),'เลขรายการ '+str(r.get('recordId') or ''),8)
d.save(sys.argv[2],garbage=4,deflate=True)
print('Canva daily PDF: 1 page')
