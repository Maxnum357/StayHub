import json,pathlib,sys
import pymupdf as pdf

def layout(document):
    return [[[round(float(v),1) for v in span['bbox']] for block in page.get_text('dict')['blocks'] for line in block.get('lines',[]) for span in line['spans'] if span['text'].strip()=='-'] for page in document]
def validate(filename,baseline,kind="monthly"):
    d=pdf.open(filename)
    pages=1 if kind=='daily' else 3
    if d.needs_pass or len(d)!=pages:raise ValueError(f'แม่แบบต้องเป็น PDF {pages} หน้าและไม่มีรหัสผ่าน')
    if any(abs(page.rect.width-595.5)>3 or abs(page.rect.height-842.25)>3 for page in d):raise ValueError('ขนาดหน้าแม่แบบต้องเป็น A4 แนวตั้ง')
    actual=layout(d);expected=json.loads(pathlib.Path(baseline).read_text(encoding='utf-8'))
    if len(actual)!=len(expected):raise ValueError('จำนวนหน้าเปลี่ยน กรุณาตรวจตำแหน่งกรอกข้อมูลใหม่')
    for got,want in zip(actual,expected):
        got=sorted(got,key=lambda x:(round(x[1]/4),x[0]));want=sorted(want,key=lambda x:(round(x[1]/4),x[0]))
        if len(got)!=len(want) or any(abs(a-b)>2 for x,y in zip(got,want) for a,b in zip(x,y)):
            raise ValueError('ช่องกรอกข้อมูลใน Canva มีการย้ายหรือเปลี่ยน กรุณาปรับตำแหน่งกรอกก่อนใช้แม่แบบใหม่')
    text=''.join(page.get_text() for page in d)
    if kind=='daily':
        if 'จำนวนห้องพัก' not in text or 'จำนวนวัน' not in text:raise ValueError('แม่แบบรายวันต้องมีช่องจำนวนห้องพักและจำนวนวันที่เข้าพัก')
    elif 'สัญญาเช่า' not in text:raise ValueError('ไฟล์ไม่ใช่แม่แบบสัญญาเช่า')
    d.close()
if __name__=='__main__':
    try:validate(sys.argv[1],sys.argv[2],sys.argv[3] if len(sys.argv)>3 else "monthly");print('Template verified')
    except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
