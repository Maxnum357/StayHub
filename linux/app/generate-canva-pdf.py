import os
import json,pathlib,re,html,sys,base64
import pymupdf as pdf
ROOT=pathlib.Path(__file__).resolve().parent
from canva_typography import FONT_ARCHIVE,FONT_CSS,content as font_content
months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม']
def date(s):
    m=re.fullmatch(r'(\d{1,2})/(\d{1,2})/(\d{1,4})',s.strip())
    if not m:return s or '—'
    day,month,year=map(int,m.groups())
    if year<100:year+=2500
    elif 1800<=year<2400:year+=543
    if not 1<=month<=12:return s
    return f'{day} {months[month-1]} {year}'
slots=[(2,(40,222,338,241)),(3,(352,222,552,241)),(4,(40,270,181,289)),(5,(193,270,422,289)),(6,(435,270,552,289)),(7,(40,318,290,338)),(8,(303,318,421,338)),(9,(435,318,552,338)),(10,(40,366,421,385)),(11,(435,366,552,385)),(12,(40,413,421,433)),(13,(435,412,552,432)),(15,(303,464,421,483)),(16,(40,507,160,527)),(17,(173,507,290,527))]
def put(page,box,text):
    text=str(text or '—')
    content=font_content(text)
    css='* {font-family:CanvaLatin,sans-serif;font-size:10px;line-height:1.15;margin:0;padding:0;color:#000;}'
    rect=pdf.Rect(box)
    framed=[b for _,b in slots]+[(174,560,373,578),(400,560,423,578),(40,597,166,615),(177,597,306,615)]
    if box in framed:
        scratch=pdf.open();measure=scratch.new_page(width=595.5,height=842.25)
        spare,scale=measure.insert_htmlbox(rect,content,css=FONT_CSS+css,archive=FONT_ARCHIVE,scale_low=.6)
        scratch.close()
        if spare>2:rect.y0+=spare-2
    result=page.insert_htmlbox(rect,content,css=FONT_CSS+css,archive=FONT_ARCHIVE,scale_low=.6)
    if result[0]<0:raise RuntimeError('Text does not fit')
source=pdf.open(pathlib.Path(os.environ.get('STAYHUB_TEMPLATE_DIR',str(ROOT/'assets')))/'monthly-canva.pdf')
for p in source:
    for block in p.get_text('dict')['blocks']:
        for line in block.get('lines',[]):
            for span in line['spans']:
                if span['text'].strip()=='-':p.add_redact_annot(pdf.Rect(span['bbox']),fill=(1,1,1))
source[0].add_redact_annot(pdf.Rect(63,665,319,824),fill=(1,1,1))
source[0].add_redact_annot(pdf.Rect(440,642,572,826),fill=(1,1,1))
source[2].add_redact_annot(pdf.Rect(255,443,430,483),fill=(1,1,1))
for p in source:p.apply_redactions(images=2,graphics=0)

r=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
keys={2:'name',3:'nickname',4:'phone',5:'email',6:'line',7:'id',8:'issue',9:'expiry',10:'address',11:'plate',12:'workAddress',13:'workPhone',15:'room',16:'checkin',17:'leaseTerm',18:'emergency',19:'emergencyRelation',20:'emergencyPhone',22:'emergencyAge'}
def display(key):
    value=str(r.get(key) or '')
    if key in ('issue','expiry','checkin'):
        m=re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})',value)
        if m:return f'{int(m[3])} {months[int(m[2])-1]} {int(m[1])+543}'
        return date(value)
    return value
out=pdf.open();out.insert_pdf(source)
for column,box in slots:put(out[0],box,display(keys[column]))
put(out[1],(337,698,418,713),r.get('room'))
for column,box in [(18,(174,560,373,578)),(22,(400,560,423,578)),(19,(40,597,166,615)),(20,(177,597,306,615))]:put(out[2],box,display(keys[column]))
put(out[2],(255,444,430,461),'ลงชื่อ ................................ ผู้เช่า')
put(out[2],(271,463,430,482),'('+str(r.get('name') or '')+')')
for key,box in [('cardImageData',(67,665,315,823)),('tenantPhotoData',(443,644,569,824))]:
    if r.get(key):
        image=pdf.open(stream=base64.b64decode(r[key]));image_pdf=pdf.open('pdf',image.convert_to_pdf());out[0].show_pdf_page(pdf.Rect(box),image_pdf,0,keep_proportion=True)
if r.get('tenantSignature'):
    out[2].insert_image(pdf.Rect(286,434,390,456),stream=base64.b64decode(r['tenantSignature'].split(',')[1]),keep_proportion=True)
put(out[2],(40,805,552,821),'เลขรายการ '+str(r.get('recordId') or ''))
out.save(sys.argv[2],garbage=4,deflate=True)
print('Canva PDF: 3 pages')
