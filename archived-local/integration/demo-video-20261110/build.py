import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
DEST = ROOT.parents[1] / 'deliverables' / 'demo-video-20261110'
DEST.mkdir(parents=True, exist_ok=True)
FF = 'D:/电脑管家迁移文件/JianyingPro/apps/8.2.8.13111/ffmpeg.exe'
marks = {item['name']: item['time'] for item in json.loads((ROOT/'marks.json').read_text())}
segments = [
 ('intro','input',4,'ScamSafe supports frontline employees handling suspected scam reports.','Select the bank employee role.'),
 ('input','analysis-start',8,'Load a fictional report of a bank-impersonation SMS,','disclosed credentials and an unfamiliar AUD 2,000 debit.'),
 ('analysis-start',None,4,'Submit the report for real AI analysis.','AI processing time shortened.'),
 ('analysis-result','type',5,'The AI organises the report and asks three targeted questions.','The employee can review the questions and their purpose.'),
 ('type','unknown',5,'The candidate type is suspected phishing.','The explanation connects the suggestion to the reported events.'),
 ('unknown','question',5,'Reported facts appear in structured fields.','The debit status remains Unknown.'),
 ('question','question-unknown',5,'Clarify whether the unfamiliar debit is pending or completed.','Select “Don’t know” when the answer is unavailable.'),
 ('question-unknown','guidance',5,'Unknown information remains visible.','End the remaining questions while retaining the gaps.'),
 ('guidance','generate-start',9,'Review the bank response guidance and its fictional guideline reference.','The account and payment concern requires human review.'),
 ('generate-start',None,3,'Generate materials from the current case.','AI processing time shortened.'),
 ('summary','person',7,'Review the case summary, including reported facts','and unresolved information.'),
 ('person','handover',6,'The explanation for the affected person summarises the report','and sets out suggested next steps.'),
 ('handover','edit',7,'The telecom handover focuses on the suspicious SMS.','The employee reviews the draft before using it.'),
 ('edit','confirm',5,'Edit the summary to flag transaction status for follow-up.','The materials remain drafts until the employee confirms them.'),
 ('confirm','download',4,'Confirm the reviewed materials.','Confirmation enables copying and downloading.'),
 ('download','end',5,'Download the selected summary as Markdown.','The employee decides the next action through existing organisational processes.'),
]
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf',27)
small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15)
subtitle_lines = []
timeline = 0
def stamp(seconds):
    millis=round(seconds*1000)
    return f'{millis//3600000:02}:{millis//60000%60:02}:{millis//1000%60:02},{millis%1000:03}'
for index,(start,end,duration,line1,line2) in enumerate(segments):
    begin=max(0,marks[start]-.22)
    finish=marks[end]-.22 if end else begin+2
    source_duration=finish-begin
    banner=Image.new('RGB',(1600,100),'#102c28')
    draw=ImageDraw.Draw(banner)
    draw.rectangle((0,0,1600,2),fill='#6cad95')
    for y,line in [(17,line1),(53,line2)]:
        draw.text((800,y),line,font=font,anchor='mt',fill='white')
    png=ROOT/f'caption-{index:02}.png'
    banner.save(png)
    output=ROOT/f'clip-{index:02}.mp4'
    filters=f'[0:v]setpts={duration/source_duration:.8f}*(PTS-STARTPTS),fps=25,pad=1600:900:0:0:color=0x102c28[v];[v][1:v]overlay=0:800,scale=1920:1080:flags=lanczos,setsar=1[out]'
    cmd=[FF,'-y','-hide_banner','-loglevel','error','-ss',str(begin),'-t',str(source_duration),'-i',str(ROOT/'raw.webm'),'-loop','1','-i',str(png),'-filter_complex',filters,'-map','[out]','-t',str(duration),'-an','-c:v','h264_nvenc','-preset','p4','-cq','19','-b:v','0','-pix_fmt','yuv420p',str(output)]
    subprocess.run(cmd,check=True)
    subtitle_lines.append(f'{index+1}\n{stamp(timeline)} --> {stamp(timeline+duration)}\n{line1}\n{line2}\n')
    timeline+=duration
    print(f'Encoded {index+1}/{len(segments)}',flush=True)
(DEST/'ScamSafe_English_Subtitles.srt').write_text('\n'.join(subtitle_lines),encoding='utf-8')
listing=ROOT/'concat.txt'
listing.write_text('\n'.join(f"file '{(ROOT/f'clip-{i:02}.mp4').as_posix()}'" for i in range(len(segments))),encoding='utf-8')
final=DEST/'ScamSafe_Prototype_Demo_English.mp4'
subprocess.run([FF,'-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(final)],check=True)
print(json.dumps({'file':str(final),'duration':timeline,'bytes':final.stat().st_size}))
