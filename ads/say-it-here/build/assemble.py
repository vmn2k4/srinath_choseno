import json, subprocess, re
H=0.4; TAIL=3.0
j=json.load(open('voice/single_voice.json')); ws=j.get('words') or j['final']['words']
script="You've got something to say about your city. Your vote. Your future. But you've seen what happens. Strangers. Trolls. Your boss. Your aunt. So you say nothing. And nothing changes. Meet Choseno. Say what you actually think. No followers. No pile on. Post it, and walk away. Your voice. Your city. Zero drama. Choseno."
toks=script.split()
assert len(toks)==len(ws),(len(toks),len(ws))
words=[(t.strip('.,'),w['start']+H,w['end']+H) for t,w in zip(toks,ws)]
narr_end=ws[-1]['end']+H; TOTAL=narr_end+TAIL
# segments: (clip, src_start, t0, t1)
cuts=[0,4.05,11.66,14.36,17.71,TOTAL]
segs=[('01_man_deleting',0.0),('02_cafe_hiding',0.0),('03_man_app',2.0),('04_people_posting',1.0),('05_friends_park',0.0)]
# ASS
def ts(t):
    h=int(t//3600);m=int(t%3600//60);s=t%60
    return f"{h}:{m:02d}:{s:05.2f}"
ass=["[Script Info]","ScriptType: v4.00+","PlayResX: 1920","PlayResY: 1080","WrapStyle: 2","",
"[V4+ Styles]","Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
"Style: Cap,Inter V,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,60,60,110,1",
"Style: Head,Inter V,170,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,4,0,1,0,0,5,0,0,0,1",
"Style: Sub,Inter V,58,&H00F5D0C4,&H00F5D0C4,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,0,0,5,0,0,0,1",
"Style: Cta,Inter V,50,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,0,0,100,100,3,0,1,0,0,5,0,0,0,1",
"","[Events]","Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text"]
HL="&H00F6823B"  # BGR of violet-ish #8B5CF6 -> use F6 5C 8B
HL="&H00F65C8B"
i=0
chunks=[]
while i<len(words):
    # break chunks at sentence ends
    c=[words[i]]
    while len(c)<3 and i+len(c)<len(words) and not re.search(r'[.]$',toks[i+len(c)-1]):
        c.append(words[i+len(c)])
    chunks.append(c); i+=len(c)
for ci,c in enumerate(chunks):
    start=c[0][1]; end=(chunks[ci+1][0][1] if ci+1<len(chunks) else c[-1][2]+0.4)
    end=min(end,c[-1][2]+0.5)
    for k,(w,s,e) in enumerate(c):
        a=s; b=c[k+1][1] if k+1<len(c) else end
        txt=" ".join((f"{{\\c{HL}&}}{x.upper()}{{\\c&HFFFFFF&}}" if m==k else x.upper()) for m,(x,_,_) in enumerate(c))
        ass.append(f"Dialogue: 1,{ts(a)},{ts(b)},Cap,,0,0,0,,{txt}")
E0=narr_end+0.15
ass.append(f"Dialogue: 2,{ts(E0)},{ts(TOTAL)},Head,,0,0,0,,{{\\fad(500,0)\\pos(960,470)}}Choseno")
ass.append(f"Dialogue: 2,{ts(E0+0.5)},{ts(TOTAL)},Sub,,0,0,0,,{{\\fad(500,0)\\pos(960,610)}}Say it here. Zero drama.")
ass.append(f"Dialogue: 2,{ts(E0+1.0)},{ts(TOTAL)},Cta,,0,0,0,,{{\\fad(500,0)\\pos(960,720)}}Choseno.com  ·  Join free")
open('captions.ass','w').write("\n".join(ass))
# ffmpeg
inputs=[];vf=[];af=[]
for n,(c,ss) in enumerate(segs):
    d=cuts[n+1]-cuts[n]
    inputs+=['-ss',str(ss),'-t',f"{d+0.05:.3f}",'-i',f'../clips/{c}.mp4']
    vf.append(f"[{n}:v]scale=2060:1159:flags=lanczos,crop=1920:1080,setsar=1,fps=30,trim=duration={d:.3f},setpts=PTS-STARTPTS[v{n}]")
    af.append(f"[{n}:a]aresample=48000,atrim=duration={d:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.12,afade=t=out:st={max(d-0.12,0):.3f}:d=0.12,volume=0.30[a{n}]")
k=len(segs)
inputs+=['-i','voice/narration_single.wav','-i','bed.wav']
fc=";".join(vf+af)
fc+=";"+"".join(f"[v{n}]" for n in range(k))+f"concat=n={k}:v=1:a=0[vc]"
fc+=";"+"".join(f"[a{n}]" for n in range(k))+f"concat=n={k}:v=0:a=1[amb]"
# end-card darken
fc+=f";[vc]fade=t=out:st={TOTAL-1.0:.2f}:d=1.0:color=0x0b1020,drawbox=x=0:y=0:w=iw:h=ih:color=0x0b1020@0.62:t=fill:enable='gte(t,{E0:.2f})'[vd]"
fc+=f";[vd]ass=captions.ass[vout]"
fc+=f";[{k}:a]aresample=48000,adelay={int(H*1000)}|{int(H*1000)},apad,atrim=duration={TOTAL:.3f},volume=1.0,asplit=2[vo][vosc]"
fc+=f";[{k+1}:a]atrim=duration={TOTAL:.3f},volume=0.30,afade=t=in:d=0.8,afade=t=out:st={TOTAL-2.5:.2f}:d=2.5[mus]"
fc+=f";[mus][vosc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[musd]"
fc+=f";[vo][musd][amb]amix=inputs=3:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11[aout]"
cmd=['ffmpeg','-y','-hide_banner']+inputs+['-filter_complex',fc,'-map','[vout]','-map','[aout]','-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t',f"{TOTAL:.3f}",'-movflags','+faststart','../choseno_say_it_here_ad.mp4']
print("TOTAL",TOTAL)
subprocess.run(cmd,check=True)
