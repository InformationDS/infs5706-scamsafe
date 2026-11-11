import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'tts-deps'))
import edge_tts

DEST = ROOT.parents[1] / 'deliverables' / 'demo-video-20261110'
VOICE = ROOT / 'voice'
VOICE.mkdir(exist_ok=True)
FF = 'D:/电脑管家迁移文件/JianyingPro/apps/8.2.8.13111/ffmpeg.exe'
SCENES = [
    (4, 'Select the bank employee role in ScamSafe.', ''),
    (8, 'Load this fictional report of an impersonation text, disclosed credentials,', 'and an unfamiliar two-thousand-dollar debit.'),
    (4, 'Submit the report for AI analysis.', 'AI processing time shortened.'),
    (5, 'The AI structures the report', 'and asks three targeted questions.'),
    (5, 'Suspected phishing is linked to the reported text,', 'credentials, and debit.'),
    (5.5, 'Facts appear in structured fields.', 'Transaction status remains unknown.'),
    (5, 'Select “Don’t know” when the transaction status is unavailable.', ''),
    (5, 'End the remaining questions.', 'Unresolved gaps remain in the case.'),
    (8.5, 'Review the bank’s suggested response and its fictional guideline reference.', 'Account and payment concerns require human review.'),
    (3, 'Generate materials from the current case.', 'AI processing time shortened.'),
    (6, 'Review the case summary,', 'including reported facts and unresolved information.'),
    (6, 'The explanation for the affected person', 'summarises the report and suggests next steps.'),
    (7, 'The telecom handover focuses on the suspicious text message.', 'Review the draft before using it.'),
    (6, 'Edit the summary to flag transaction status for follow-up.', 'The materials remain drafts.'),
    (4.5, 'Confirm the reviewed materials', 'to enable copying and downloading.'),
    (6.5, 'Download the summary.', 'The employee decides the next action through existing organisational processes.'),
]

def run(args):
    return subprocess.run([FF, '-hide_banner', '-y', *args], check=True, capture_output=True)

def duration(file):
    result = subprocess.run([FF, '-hide_banner', '-i', str(file)], capture_output=True)
    match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', result.stderr.decode(errors='replace'))
    if not match:
        raise RuntimeError('Could not determine audio duration')
    hours, minutes, seconds = map(float, match.groups())
    return hours * 3600 + minutes * 60 + seconds

async def generate():
    for i, (_, first, second) in enumerate(SCENES):
        text = first if i in (2, 9) else ' '.join([first, second]).strip()
        audio = VOICE / f'{i:02}.mp3'
        if not audio.exists() or audio.stat().st_size == 0:
            for attempt in range(3):
                try:
                    await asyncio.wait_for(edge_tts.Communicate(text, 'en-US-AriaNeural', rate='+0%').save(str(audio)), 60)
                    break
                except Exception:
                    if attempt == 2:
                        raise
                    await asyncio.sleep(2)
        print(f'Voice {i+1}/16 generated', flush=True)

def stamp(t):
    ms = round(t * 1000)
    return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'

asyncio.run(generate())
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 32)
manifest = []
srt = []
start = 0
for i, (seconds, first, second) in enumerate(SCENES):
    audio = VOICE / f'{i:02}.mp3'
    length = duration(audio)
    tempo = max(1, length / (seconds - .3))
    if tempo > 1.25:
        raise RuntimeError(f'Scene {i} requires excessive speed: {tempo}')
    banner = Image.new('RGB', (1920, 120), '#102c28')
    draw = ImageDraw.Draw(banner)
    draw.rectangle((0, 0, 1920, 2), fill='#6cad95')
    for y, line in [(20, first), (63, second)]:
        if draw.textlength(line, font=font) > 1840:
            raise RuntimeError(f'Caption too wide in scene {i}')
        draw.text((960, y), line, font=font, fill='white', anchor='mt')
    image = VOICE / f'caption-{i:02}.png'
    banner.save(image)
    original_seconds = [4,8,4,5,5,5,5,5,9,3,7,6,7,5,4,5][i]
    filters = f'[0:v]setpts={seconds/original_seconds:.8f}*(PTS-STARTPTS),fps=25[screen];[screen][2:v]overlay=0:960[v];[1:a]atempo={tempo:.6f},adelay=120:all=1,apad,atrim=duration={seconds},asetpts=PTS-STARTPTS[a]'
    output = VOICE / f'clip-{i:02}.mp4'
    run(['-loglevel','error','-i',str(ROOT/f'clip-{i:02}.mp4'),'-i',str(audio),'-loop','1','-i',str(image),'-filter_complex',filters,'-map','[v]','-map','[a]','-t',str(seconds),'-c:v','h264_nvenc','-preset','p4','-cq','19','-b:v','0','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-ar','48000',str(output)])
    manifest.append({'scene':i+1,'start':start,'seconds':seconds,'audioSeconds':length,'tempo':tempo,'voice':'en-US-AriaNeural'})
    srt.append(f'{i+1}\n{stamp(start)} --> {stamp(start+seconds)}\n{first}\n{second}\n')
    start += seconds
    print(f'Composited {i+1}/16, speed {tempo:.2f}',flush=True)
listing = VOICE / 'concat.txt'
listing.write_text('\n'.join(f"file '{(VOICE/f'clip-{i:02}.mp4').as_posix()}'" for i in range(16)),encoding='utf-8')
final = DEST/'ScamSafe_Prototype_Demo_English_AI_Voice.mp4'
run(['-loglevel','error','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart',str(final)])
(DEST/'ScamSafe_English_AI_Voice_Subtitles.srt').write_text('\n'.join(srt),encoding='utf-8')
(VOICE/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('COMPLETE',final,final.stat().st_size,flush=True)
