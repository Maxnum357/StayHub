"""Fixed, bundled font policy for every value inserted into Canva PDFs."""
import html
import pathlib
import re
import pymupdf as pdf
FONT_ROOT=pathlib.Path(__file__).resolve().parent/'assets/fonts'
REQUIRED=('Montserrat-Regular.ttf','Montserrat-Bold.ttf','NotoSansThai-Regular.ttf','NotoSansThai-Bold.ttf')
for filename in REQUIRED:
    if not (FONT_ROOT/filename).is_file():
        raise RuntimeError('Missing required Canva font: '+filename)
FONT_ARCHIVE=pdf.Archive(str(FONT_ROOT))
FONT_CSS=''.join("@font-face{font-family:%s;src:url('%s');font-weight:%s;}"%(family,filename,weight) for family,filename,weight in [('CanvaLatin','Montserrat-Regular.ttf',400),('CanvaLatin','Montserrat-Bold.ttf',700),('CanvaThai','NotoSansThai-Regular.ttf',400),('CanvaThai','NotoSansThai-Bold.ttf',700)])
def content(value):
    value='—' if value is None or value=='' else str(value)
    runs=re.findall(r'[\u0e00-\u0e7f]+|[^\u0e00-\u0e7f]+',value)
    return '<div>'+''.join('<span style="font-family:'+('CanvaThai' if '\u0e00'<=run[0]<='\u0e7f' else 'CanvaLatin')+'">'+html.escape(run)+'</span>' for run in runs)+'</div>'
