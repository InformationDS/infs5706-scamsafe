import asyncio
import json
import math
import re
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'tts-deps'))
import edge_tts

WORK = ROOT / 'voice-70s'
WORK.mkdir(exist_ok=True)
DEST = ROOT.parents[1] / 'deliverables' / 'demo-video-20261112-70s'
DEST.mkdir(parents=True, exist_ok=True)
FF = 'D:/电脑管家迁移文件/JianyingPro/apps/8.2.8.13111/ffmpeg.exe'
SCENES = [
    ('Select the bank role.', ''),
    ('Load a fictional phishing report', 'with an unfamiliar debit.'),
    ('Analyse the report.', ''),
    ('The AI identifies three clarification questions.', ''),
    ('Phishing is suspected.', ''),
    ('Transaction status remains unknown.', ''),
    ('Choose “Don’t know” for missing details.', ''),
    ('End questions while retaining gaps.', ''),
    ('Review the fictional guidance.', 'Human judgement is required.'),
    ('Generate case materials.', ''),
    ('Check the summary and unresolved information.', ''),
    ('Review the explanation for the person.', ''),
    ('The telecom handover focuses on the suspicious message.', ''),
    ('Edit the draft for follow-up.', ''),
    ('Confirm the reviewed materials.', ''),
    ('Download the summary.', 'The employee decides the next action.'),
]
ORIGINAL = [4,8,4,5,5,5,5,5,9,3,7,6,7,5,4,5]
PREFERRED = [4,6,2.5,4,4,4,4,3.5,6,2.5,5,5,6,5,3.5,5]

def run(args):
    return subprocess.run([FF,'-hide_banner','-y',*args],capture_output=True,check=True)

def audio_duration(file):
    result = subprocess.run([FF,'-hide_banner','-i',str(file)],capture_output=True)
    match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',result.stderr.decode(errors='replace'))
    if not match:
        raise RuntimeError('Audio metadata missing')
    h,m,s = map(float,match.groups())
    return h*3600+m*60+s

async def speak():
    for i,lines in enumerate(SCENES):
        file = WORK/f'{i:02}.mp3'
        if not file.exists() or file.stat().st_size == 0:
            for attempt in range(3):
                try:
                    await asyncio.wait_for(edge_tts.Communicate(' '.join(lines).strip(),'en-US-AriaNeural',rate='-18%').save(str(file)),60)
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(2)
        print(f'Voice {i+1}/16 ready',flush=True)

def stamp(seconds):
    ms = round(seconds*1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'

asyncio.run(speak())
lengths = [audio_duration(WORK/f'{i:02}.mp3') for i in range(16)]
frames = [max(50,math.ceil((length+.30)*25)) for length in lengths]
if sum(frames)>1750:
    raise RuntimeError(f'Slow speech needs {sum(frames)/25:.2f}s. Shorten script before rendering.')
while sum(frames)<1750:
    index = max(range(16),key=lambda i:PREFERRED[i]-frames[i]/25)
    frames[index]+=1
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',32)
subtitles=[]
manifest=[]
start=0
for i,((first,second),count) in enumerate(zip(SCENES,frames)):
    seconds=count/25
    processing='AI processing time shortened.' if i in (2,9) else ''
    banner=Image.new('RGB',(1920,120),'#102c28')
    draw=ImageDraw.Draw(banner)
    draw.rectangle((0,0,1920,2),fill='#6cad95')
    lines=(first,second or processing)
    for y,line in zip((20,63),lines):
        if draw.textlength(line,font=font)>1840:
            raise RuntimeError('Caption exceeds frame width')
        draw.text((960,y),line,font=font,anchor='mt',fill='white')
    png=WORK/f'caption-{i:02}.png'
    banner.save(png)
    filters=f'[0:v]crop=1920:960:0:0,setpts={seconds/ORIGINAL[i]:.9f}*(PTS-STARTPTS),fps=25,pad=1920:1080:0:0:color=0x102c28[screen];[screen][2:v]overlay=0:960[v];[1:a]adelay=120:all=1,apad,atrim=duration={seconds},asetpts=PTS-STARTPTS[a]'
    run(['-loglevel','error','-i',str(ROOT/f'clip-{i:02}.mp4'),'-i',str(WORK/f'{i:02}.mp3'),'-loop','1','-i',str(png),'-filter_complex',filters,'-map','[v]','-map','[a]','-t',str(seconds),'-c:v','h264_nvenc','-preset','p4','-cq','19','-b:v','0','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000',str(WORK/f'clip-{i:02}.mp4')])
    subtitles.append(f'{i+1}\n{stamp(start)} --> {stamp(start+seconds)}\n'+ '\n'.join(line for line in lines if line)+'\n')
    manifest.append({'scene':i+1,'start':start,'seconds':seconds,'spoken':' '.join((first,second)).strip(),'audioSeconds':lengths[i]})
    start+=seconds
    print(f'Rendered {i+1}/16',flush=True)
listing=WORK/'concat.txt'
listing.write_text('\n'.join(f"file '{(WORK/f'clip-{i:02}.mp4').as_posix()}'" for i in range(16)),encoding='utf-8')
final=DEST/'ScamSafe_70s_English_Slow_Voice_Subtitles.mp4'
run(['-loglevel','error','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(final)])
no_subs=DEST/'ScamSafe_70s_English_Slow_Voice_No_Subtitles.mp4'
run(['-loglevel','error','-i',str(final),'-map','0:v:0','-map','0:a:0','-vf','crop=1920:960:0:0,pad=1920:1080:0:60:color=0xf4f6f2','-c:v','h264_nvenc','-preset','p4','-cq','19','-b:v','0','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(no_subs)])
(DEST/'ScamSafe_70s_English_Subtitles.srt').write_text('\n'.join(subtitles),encoding='utf-8')
(WORK/'manifest.json').write_text(json.dumps({'source':'Recorded live-model browser operation, 10 November 2026','voice':'en-US-AriaNeural','rate':'-18%','audioTimeStretch':False,'duration':start,'scenes':manifest},indent=2),encoding='utf-8')
print('COMPLETE',round(start,2),flush=True)
