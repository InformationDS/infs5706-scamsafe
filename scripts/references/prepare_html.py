from pathlib import Path
import re,html,argparse
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description='Prepare HTML from an explicitly supplied input directory.')
parser.add_argument('--input-dir',required=True)
input_dir=Path(parser.parse_args().input_dir).resolve()
if not input_dir.is_dir():
 raise SystemExit('Input directory not found.')
output_dir=root/'local'/'reference-work'
output_dir.mkdir(parents=True,exist_ok=True)
for p in input_dir.glob('*.html'):
 s=p.read_text(encoding='utf-8')
 def repl(m):
  heading=re.search(r'data-click_name="([^"]+)"',m[0])
  return '<h4>'+html.escape(html.unescape(heading[1]))+'</h4>' if heading else m[0]
 s=re.sub(r'<button\b[^>]*class="accordion-item[^>]*>.*?</button>',repl,s,flags=re.S)
 (output_dir/p.name).write_text(s,encoding='utf-8')
