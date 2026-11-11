from pathlib import Path
from html.parser import HTMLParser
from PIL import Image, ImageOps, ImageDraw
import subprocess, re, json, unicodedata, hashlib
root = Path('evidence/task-results/E01/integration-20261105/run-05/browser')
rendered = root / 'rendered'
rendered.mkdir(exist_ok=True)
results = []
for pdf in sorted(root.glob('*.pdf')):
    folder=rendered/pdf.stem
    folder.mkdir(exist_ok=True)
    info=subprocess.run(['pdfinfo',str(pdf)],capture_output=True,text=True,check=True).stdout
    pages=int(re.search(r'Pages:\s+(\d+)',info).group(1))
    subprocess.run(['pdftotext','-layout',str(pdf),str(folder/'extracted.txt')],check=True)
    subprocess.run(['pdftotext','-raw',str(pdf),str(folder/'raw.txt')],check=True)
    subprocess.run(['pdftoppm','-scale-to','1400','-png',str(pdf),str(folder/'page')],check=True,capture_output=True)
    images=sorted(folder.glob('page-*.png'))
    sheet=Image.new('RGB',(2000,1460*((len(images)+1)//2)), 'white')
    draw=ImageDraw.Draw(sheet)
    hashes=[]
    for i, image_path in enumerate(images):
        with Image.open(image_path) as image:
            hashes.append(hashlib.sha256(image.tobytes()).hexdigest())
            thumb=ImageOps.contain(image,(980,1400))
            x=1000*(i%2); y=1460*(i//2)
            draw.text((x+10,y+8),f'{pdf.stem} page {i+1}',fill='black')
            sheet.paste(thumb,(x+10,y+30))
    sheet.save(folder/'contact.png')
    results.append({'file':pdf.name,'pages':pages,'renderedPages':len(images),'pixelHashes':hashes})
class TextBlocks(HTMLParser):
    def __init__(self): super().__init__(); self.body=False; self.blocks=[]
    def handle_starttag(self,tag,attrs):
        if tag=='body': self.body=True
    def handle_endtag(self,tag):
        if tag=='body': self.body=False
    def handle_data(self,data):
        if self.body and data.strip(): self.blocks.append(data)
def normal(text): return re.sub(r'\s+','',unicodedata.normalize('NFKC',text)).replace('\u00ad','')
parser=TextBlocks(); parser.feed((root/'chinese-long-table.html').read_text(encoding='utf-8'))
pdf_text=(rendered/'chinese-long-table'/'raw.txt').read_text(encoding='utf-8')
missing=[text for text in parser.blocks if normal(text) not in normal(pdf_text)]
assert not missing, f'Missing PDF text blocks: {missing[:3]}'
assert '中文正文完整性终点 E01-END' in pdf_text or normal('中文正文完整性终点 E01-END') in normal(pdf_text)
assert results[0]['pixelHashes']==next(r['pixelHashes'] for r in results if r['file']=='same-version-retry.pdf')
report={'pdfs':results,'expectedTextBlocks':len(parser.blocks),'missingTextBlocks':missing,'sameVersionRetryPixelsIdentical':True}
(root/'pdf-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'pages':{r['file']:r['pages'] for r in results},'textBlocks':len(parser.blocks),'missing':len(missing),'sameVersionRetryPixelsIdentical':True},ensure_ascii=False))
