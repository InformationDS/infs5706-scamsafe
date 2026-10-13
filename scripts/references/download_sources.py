import urllib.request, json
import argparse
from pathlib import Path
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description='Historical source downloader; downloads only to local scratch space after explicit opt-in.')
parser.add_argument('--download',action='store_true',help='Download historical UNSW references into local scratch space')
if not parser.parse_args().download:
 print('Reference downloads are disabled by default. Use --download only if these historical sources are explicitly needed.')
 raise SystemExit(0)
original_dir=root/'local'/'reference-work'/'downloads'
original_dir.mkdir(parents=True,exist_ok=True)
items=[
('UNSW_AI_Guidance.html','https://www.unsw.edu.au/student/managing-your-studies/academic-skills-support/toolkit/ai'),
('UNSW_Special_Consideration.html','https://www.unsw.edu.au/student/managing-your-studies/academic-life/special-consideration'),
('UNSW_AI_Framework.png','https://www.unsw.edu.au/content/dam/images/cs-comms/stakeholders/2025-01-ai-content/2025-01-ai-content-0001.png')]
def get(item):
 name,url=item
 if (original_dir/name).exists():
  return dict(file=name,url=url,status='existing_not_overwritten',local_path=(original_dir/name).relative_to(root).as_posix())
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'})
  with urllib.request.urlopen(req,timeout=40) as r:
   data=r.read(); final=r.url; ct=r.headers.get('Content-Type')
  (original_dir/name).write_bytes(data)
  return dict(file=name,url=url,final_url=final,content_type=ct,bytes=len(data),status='downloaded',local_path=(original_dir/name).relative_to(root).as_posix())
 except Exception as e:return dict(file=name,url=url,status='failed',error=str(e))
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(max_workers=5) as pool: result=list(pool.map(get,items))
check_dir=root/'evidence'/'reference-conversion'
check_dir.mkdir(parents=True,exist_ok=True)
(check_dir/'latest_download_run.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
