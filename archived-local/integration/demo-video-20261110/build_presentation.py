import asyncio
import json
import math
import re
import subprocess
import sys
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'tts-deps'))
import edge_tts
WORK=ROOT/'voice-presentation'
WORK.mkdir(exist_ok=True)
DEST=ROOT.parents[1]/'deliverables'/'demo-video-20261112-presentation'
DEST.mkdir(parents=True,exist_ok=True)
FF='D:/电脑管家迁移文件/JianyingPro/apps/8.2.8.13111/ffmpeg.exe'
GROUPS=[
    ([0,1], "Let's see how a bank employee handles this fictional report of a suspicious text and an unfamiliar debit."),
    ([2,3,4], 'Once we submit it, the AI organises the facts, suggests phishing, and asks three focused questions.'),
    ([5,6,7], 'Notice the transaction status is unknown. We can select “Don’t know” and continue, keeping that gap visible.'),
    ([8], "Next, let's review the guidance and its fictional source. The account concern still needs human judgement."),
    ([9,10], 'Now we can generate a case summary, bringing together the report and the remaining gaps.'),
    ([11], 'We also get a plain-language explanation to help the affected person understand the suggested next steps.'),
    ([12,13], 'The telecom handover focuses on the suspicious message. We can review and edit the drafts before confirming.'),
    ([14,15], 'Finally, we confirm and download the materials. The employee decides what happens next through existing organisational processes.'),
]
ORIGINAL=[4,8,4,5,5,5,5,5,9,3,7,6,7,5,4,5]
WEIGHTS=[3,6,2,3,3,3,3,2,7,2,5,7,5,4,3,5]
def run(args):
    return subprocess.run([FF,'-hide_banner','-y',*args],capture_output=True,check=True)
def duration(file):
    result=subprocess.run([FF,'-hide_banner','-i',str(file)],capture_output=True)
    match=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',result.stderr.decode(errors='replace'))
    h,m,s=map(float,match.groups())
    return h*3600+m*60+s
async def speak():
    for i,(_,text) in enumerate(GROUPS):
        file=WORK/f'{i:02}.mp3'
        if not file.exists() or not file.stat().st_size:
            for attempt in range(3):
                try:
                    await asyncio.wait_for(edge_tts.Communicate(text,'en-US-AriaNeural',rate='-3%').save(str(file)),60)
                    break
                except Exception:
                    if attempt==2:
                        raise
                    await asyncio.sleep(2)
        print(f'Conversational voice {i+1}/8 ready',flush=True)
def stamp(s):
    ms=round(s*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
asyncio.run(speak())
lengths=[duration(WORK/f'{i:02}.mp3') for i in range(8)]
group_frames=[math.ceil((s+.25)*25) for s in lengths]
target=max(1750,sum(group_frames))
if target>1850:
    raise RuntimeError(f'Narration requires {target/25:.2f}s. Revise before rendering.')
while sum(group_frames)<target:
    index=max(range(8),key=lambda i:sum(WEIGHTS[x] for x in GROUPS[i][0])-group_frames[i]/25)
    group_frames[index]+=1
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',32)
small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',13)
subtitles=[]
manifest=[]
start=0
for group_index,((sources,text),frame_count) in enumerate(zip(GROUPS,group_frames)):
    seconds=frame_count/25
    lines=textwrap.wrap(text,width=100)
    if len(lines)>2:
        raise RuntimeError('Caption needs more than two lines')
    subframes=[round(frame_count*WEIGHTS[s]/sum(WEIGHTS[x] for x in sources)) for s in sources]
    subframes[-1]+=frame_count-sum(subframes)
    for source,count in zip(sources,subframes):
        span=count/25
        banner=Image.new('RGB',(1920,120),'#102c28')
        draw=ImageDraw.Draw(banner)
        draw.rectangle((0,0,1920,2),fill='#6cad95')
        for y,line in zip((16,57),lines):
            if draw.textlength(line,font=font)>1840:
                raise RuntimeError('Caption exceeds frame')
            draw.text((960,y),line,font=font,anchor='mt',fill='white')
        if source in (2,9):
            draw.text((1900,103),'AI processing time shortened',font=small,anchor='rt',fill='#c5dbd3')
        png=WORK/f'caption-{source:02}.png'
        banner.save(png)
        filters=f'[0:v]crop=1920:960:0:0,setpts={span/ORIGINAL[source]:.9f}*(PTS-STARTPTS),fps=25,pad=1920:1080:0:0:color=0x102c28[screen];[screen][1:v]overlay=0:960[v]'
        run(['-loglevel','error','-i',str(ROOT/f'clip-{source:02}.mp4'),'-loop','1','-i',str(png),'-filter_complex',filters,'-map','[v]','-frames:v',str(count),'-an','-c:v','h264_nvenc','-preset','p4','-cq','19','-b:v','0','-pix_fmt','yuv420p',str(WORK/f'screen-{source:02}.mp4')])
    listing=WORK/f'group-{group_index:02}.txt'
    listing.write_text('\n'.join(f"file '{(WORK/f'screen-{s:02}.mp4').as_posix()}'" for s in sources),encoding='utf-8')
    run(['-loglevel','error','-f','concat','-safe','0','-i',str(listing),'-i',str(WORK/f'{group_index:02}.mp3'),'-map','0:v:0','-map','1:a:0','-af',f'adelay=120:all=1,apad,atrim=duration={seconds}','-t',str(seconds),'-c:v','copy','-c:a','aac','-ar','48000','-b:a','192k',str(WORK/f'group-{group_index:02}.mp4')])
    subtitles.append(f'{group_index+1}\n{stamp(start)} --> {stamp(start+seconds)}\n'+'\n'.join(lines)+'\n')
    manifest.append({'start':start,'seconds':seconds,'spoken':text,'audioSeconds':lengths[group_index]})
    start+=seconds
    print(f'Rendered group {group_index+1}/8',flush=True)
listing=WORK/'concat.txt'
listing.write_text('\n'.join(f"file '{(WORK/f'group-{i:02}.mp4').as_posix()}'" for i in range(8)),encoding='utf-8')
final=DEST/'ScamSafe_Presentation_English_Conversational_Subtitles.mp4'
run(['-loglevel','error','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(final)])
run(['-loglevel','error','-i',str(final),'-map','0:v:0','-map','0:a:0','-vf','crop=1920:960:0:0,pad=1920:1080:0:60:color=0xf4f6f2','-c:v','h264_nvenc','-preset','p4','-cq','19','-b:v','0','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(DEST/'ScamSafe_Presentation_English_Conversational_No_Subtitles.mp4')])
(DEST/'ScamSafe_Presentation_English_Subtitles.srt').write_text('\n'.join(subtitles),encoding='utf-8')
(DEST/'ScamSafe_Presentation_English_Narration.txt').write_text('\n\n'.join(text for _,text in GROUPS),encoding='utf-8')
(WORK/'manifest.json').write_text(json.dumps({'source':'Live-model recording from 10 November 2026','voice':'en-US-AriaNeural','rate':'-3%','audioTimeStretch':False,'seconds':start,'groups':manifest},indent=2),encoding='utf-8')
print('COMPLETE',start,flush=True)
