"""Original geometric icons and neutral example pet. Requires Pillow for contributors only."""
from pathlib import Path
from PIL import Image, ImageDraw
import math
root=Path(__file__).resolve().parents[1]
out=root/'watch/src/Common/icons';out.mkdir(parents=True,exist_ok=True)
S=4
ink='#fff4dd'
def icon(name,draw):
    image=Image.new('RGBA',(64*S,64*S));d=ImageDraw.Draw(image)
    def line(points,width=4,fill=ink):d.line([(int(x*S),int(y*S)) for x,y in points],fill=fill,width=int(width*S),joint='curve')
    def ellipse(box,width=4,fill=None):d.ellipse(tuple(int(x*S) for x in box),outline=ink if width else None,width=int(width*S),fill=fill)
    def arc(box,a,b,width=4):d.arc(tuple(int(x*S) for x in box),a,b,fill=ink,width=int(width*S))
    draw(d,line,ellipse,arc)
    image.resize((64,64),Image.Resampling.LANCZOS).save(out/(name+'.png'))
def food(d,l,e,a):
    l([(9,27),(55,27)]);a((10,8,54,53),0,180);l([(17,49),(47,49)]);l([(23,18),(26,13),(23,8)],3);l([(38,18),(41,13),(38,8)],3)
def mood(d,l,e,a):
    e((8,8,56,56));e((22,24,24,26),0,ink);e((40,24,42,26),0,ink);a((21,26,43,43),15,165,3)
def heart(d,l,e,a):
    points=[]
    for i in range(121):
        t=2*math.pi*i/120;x=16*math.sin(t)**3;y=13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)
        points.append((32+x*1.5,31-y*1.5))
    l(points,4)
def pet(d,l,e,a):
    l([(16,37),(16,19),(20,16),(24,19),(24,33),(24,11),(28,8),(32,11),(32,31),(32,14),(36,11),(40,14),(40,33),(40,22),(44,19),(48,22),(48,43),(42,54),(25,54),(13,41),(12,36),(16,34),(25,42)],3)
def feed(d,l,e,a):
    l([(8,31),(49,31)]);a((9,14,49,55),0,180);l([(16,52),(42,52)]);l([(51,8),(51,24)],3);l([(43,16),(59,16)],3)
def play(d,l,e,a):
    e((10,10,54,54));l([(17,15),(27,24),(24,38),(13,43)],3);l([(47,18),(38,28),(41,42),(50,48)],3);l([(24,38),(41,42)],3);l([(27,24),(38,28)],3)
def chat(d,l,e,a):
    d.rounded_rectangle((9*S,12*S,55*S,46*S),radius=10*S,outline=ink,width=4*S);l([(19,45),(16,55),(31,46)],3)
    for x in (23,32,41):e((x-1,27,x+1,29),0,ink)
def settings(d,l,e,a):
    for y,x in ((16,24),(32,42),(48,20)):
        l([(10,y),(54,y)],3);d.rounded_rectangle(((x-5)*S,(y-5)*S,(x+5)*S,(y+5)*S),radius=3*S,fill='#273b43',outline=ink,width=3*S)
for name,fn in [('food',food),('mood',mood),('heart',heart),('pet',pet),('feed',feed),('play',play),('chat',chat),('settings',settings)]:icon(name,fn)
example=root/'examples/neutral-pet';example.mkdir(parents=True,exist_ok=True)
for state in ('idle','waving','jumping','waiting','review'):
    folder=example/state;folder.mkdir(exist_ok=True)
    for frame in range(4):
        image=Image.new('RGBA',(192*S,208*S));d=ImageDraw.Draw(image);dy= -int(12*math.sin(frame*math.pi/3)) if state=='jumping' else int(3*math.sin(frame*math.pi/2))
        def box(values):return tuple(int((v+(dy if i%2 else 0))*S) for i,v in enumerate(values))
        d.ellipse(box((35,167,157,184)),fill=(0,0,0,30))
        d.rounded_rectangle(box((35,31,157,180)),radius=54*S,fill='#a4c9bb',outline='#304a45',width=3*S)
        d.ellipse(box((58,165,87,187)),fill='#82ad9e',outline='#304a45',width=2*S);d.ellipse(box((106,165,135,187)),fill='#82ad9e',outline='#304a45',width=2*S)
        if state=='waving':d.ellipse(box((139,56,175,99)),fill='#a4c9bb',outline='#304a45',width=3*S)
        if frame==1 and state in ('idle','waiting'):
            for x in (72,119):d.line([(x*S,(93+dy)*S),((x+9)*S,(93+dy)*S)],fill='#304a45',width=3*S)
        else:
            for x in (72,119):d.ellipse(box((x,86,x+9,100)),fill='#304a45')
        d.arc(box((85,99,109,116)),0,180,fill='#304a45',width=3*S)
        d.ellipse(box((54,105,73,115)),fill='#e7b9a9');d.ellipse(box((121,105,140,115)),fill='#e7b9a9')
        image.resize((192,208),Image.Resampling.LANCZOS).save(folder/(str(frame).zfill(2)+'.png'))
print('Created 8 original icons and a neutral geometric example pet.')
