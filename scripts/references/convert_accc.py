from pathlib import Path
import re,json,sys
import argparse
import pdfplumber,pypdfium2
from pypdf import PdfReader
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[2]
report_dir=root/'references'/'accc'
parser=argparse.ArgumentParser(description='Convert an explicitly supplied ACCC PDF; the original is no longer stored in this project.')
parser.add_argument('--source',required=True,help='Path to a separately supplied original PDF')
src=Path(parser.parse_args().source).resolve()
if not src.is_file():
 raise SystemExit('Source PDF not found. Provide an existing original PDF via --source.')
assets=report_dir/'assets'/'pages'
assets.mkdir(parents=True,exist_ok=True)
out=['# Targeting scams: Report of the National Anti-Scam Centre on scams data and activity 2025','',
 'Published: March 2026. Converted: 2026-10-12.',
 '[ACCC source publication](https://www.accc.gov.au/about-us/publications/serial-publications/targeting-scams-reports-on-scams-activity/targeting-scams-report-of-the-national-anti-scam-centre-on-scams-data-and-activity-2025)',
 '', '> 转换说明：保留原文语言与 49 个 PDF 页码标记。正文转换为 Markdown；表格使用等宽文本保留列位置，避免合并单元格导致字段错配。图表、信息图、图片内文字和复杂版式请展开各页原图核对。PDF 页码包含封面，与报告印刷页码不同。','']
renderer=pypdfium2.PdfDocument(str(src))
linkreader=PdfReader(str(src))
stats=[]
with pdfplumber.open(src) as doc:
 for i,p in enumerate(doc.pages):
  number=i+1
  if not (assets/f'page-{number:02}.png').exists():
   img=renderer[i].render(scale=1.6).to_pil()
   img.save(assets/f'page-{number:02}.png')
  out.extend([f'<!-- page {number} -->',f'## PDF page {number}',''])
  tables=[]
  for t in p.find_tables():
   rows=t.extract()
   if rows and len(rows)>1 and max(len(row) for row in rows)>1 and sum(bool(c) for row in rows for c in row)>3: tables.append((t,rows))
  def in_table(line):
   cx=(line['x0']+line['x1'])/2;cy=(line['top']+line['bottom'])/2
   return any(t.bbox[1]<=cy<=t.bbox[3] for t,_ in tables)
  lines=p.extract_text_lines(layout=False,strip=True,return_chars=True)
  events=[(l['top'],'line',l) for l in lines if not in_table(l)] + [(t.bbox[1],'table',t) for t,rows in tables]
  events.sort(key=lambda x:x[0])
  prev_bottom=0
  for top,kind,value in events:
   if kind=='table':
    t=value
    tabletext=p.crop((0,max(0,t.bbox[1]-1),p.width,min(p.height,t.bbox[3]+1))).extract_text(layout=True)
    tabletext='\n'.join(l.rstrip() for l in tabletext.splitlines()).strip('\n')
    out.extend(['','```text',tabletext,'```','']);prev_bottom=0
   else:
    line=value;text=line['text']
    if re.match(r'^\w+\s+Targeting scams\s*[|｜]',text):continue
    chars=line.get('chars',[])
    size=max([c.get('size',0) for c in chars] or [0])
    if top-prev_bottom>5:out.append('')
    if size>=13:out.extend(['','### '+text,''])
    else:out.append(text)
    prev_bottom=line['bottom']
  urls=[]
  for ref in linkreader.pages[i].get('/Annots',[]):
   obj=ref.get_object();a=obj.get('/A')
   if a:
    a=a.get_object();u=a.get('/URI')
    if u and str(u) not in urls:urls.append(str(u))
  if urls:
   out.extend(['','### Links on this page',''])
   out.extend(f'- [{u}]({u})' for u in urls)
  out.extend(['','<details>',f'<summary>PDF page {number}: original layout / charts</summary>','',f'![Original PDF page {number}](assets/pages/page-{number:02}.png)','','</details>',''])
  stats.append({'page':number,'characters':len(p.extract_text() or ''),'tables':len(tables),'links':len(urls)})
text='\n'.join(out)
text=re.sub(r'\n{3,}','\n\n',text)
(report_dir/'Targeting_Scams_2025.md').write_text(text,encoding='utf-8')
check_dir=root/'evidence'/'reference-conversion'
check_dir.mkdir(parents=True,exist_ok=True)
(check_dir/'accc_conversion_check.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
assert len(re.findall(r'<!-- page \d+ -->',text))==49
assert all(s['characters']>0 for s in stats[:-1])
assert 'financial crimes. This is the third Targeting Scams Report' in text
assert len(list(assets.glob('page-*.png')))==49
print(json.dumps({'pages':len(stats),'tables':sum(s['tables'] for s in stats),'characters':len(text),'images':49,'empty_text_pages':[s['page'] for s in stats if not s['characters']]},indent=2))
