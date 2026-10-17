import random, math, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops
W,H=1400,1000
def hexc(h,a=255):
    h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))+(a,)
def grad(top,bot):
    im=Image.new('RGB',(W,H)); d=ImageDraw.Draw(im)
    t=hexc(top); b=hexc(bot)
    for y in range(H):
        k=y/H; d.line([(0,y),(W,y)],fill=tuple(int(t[i]*(1-k)+b[i]*k) for i in range(3)))
    return im.convert('RGBA')
def layer(): return Image.new('RGBA',(W,H),(0,0,0,0))
def bokeh(im,cols,n,rmin,rmax,blur,alpha=(60,160),region=(0,0,W,H)):
    L=layer(); d=ImageDraw.Draw(L)
    for _ in range(n):
        r=random.randint(rmin,rmax); x=random.randint(region[0],region[2]); y=random.randint(region[1],region[3])
        c=hexc(random.choice(cols),random.randint(*alpha))
        d.ellipse([x-r,y-r,x+r,y+r],fill=c)
        if r>18: d.ellipse([x-r,y-r,x+r,y+r],outline=hexc('#ffffff',40),width=2)
    return Image.alpha_composite(im,L.filter(ImageFilter.GaussianBlur(blur)))
def drapes(im,col,n=7,alpha=70,blur=18):
    L=layer(); d=ImageDraw.Draw(L)
    for i in range(n):
        x0=i*W/n+random.randint(-40,40); w=W/n*random.uniform(.5,.9)
        pts=[]
        for y in range(0,H+20,20):
            pts.append((x0+math.sin(y/90+i)*30,y))
        pts2=[(x+w,y) for x,y in reversed(pts)]
        d.polygon(pts+pts2,fill=hexc(col,alpha))
    return Image.alpha_composite(im,L.filter(ImageFilter.GaussianBlur(blur)))
def garland(im,cols,y0,sag,count=70,r=13,blur=1.2,strands=1):
    L=layer(); d=ImageDraw.Draw(L)
    for s in range(strands):
        for i in range(count):
            t=i/(count-1); x=t*W; y=y0+s*28+sag*4*t*(1-t)+random.uniform(-2,2)
            c=random.choice(cols); rr=r+random.uniform(-3,3)
            for k in range(5):
                a=k*72+random.uniform(0,40); dx=math.cos(math.radians(a))*rr*.45; dy=math.sin(math.radians(a))*rr*.45
                d.ellipse([x+dx-rr*.6,y+dy-rr*.6,x+dx+rr*.6,y+dy+rr*.6],fill=hexc(c,235))
            d.ellipse([x-rr*.35,y-rr*.35,x+rr*.35,y+rr*.35],fill=hexc('#7a3b06',200))
    sh=L.filter(ImageFilter.GaussianBlur(6)); 
    return Image.alpha_composite(Image.alpha_composite(im,ImageChops.multiply(sh,Image.new('RGBA',(W,H),(0,0,0,90)))),L.filter(ImageFilter.GaussianBlur(blur)))
def hangers(im,cols,n=9,top=0,length=(300,520),r=11,blur=1.4):
    L=layer(); d=ImageDraw.Draw(L)
    for j in range(n):
        x=W*(j+.5)/n+random.uniform(-30,30); ln=random.randint(*length)
        for y in range(top,top+ln,int(r*1.5)):
            c=random.choice(cols); rr=r+random.uniform(-2,2)
            d.ellipse([x-rr,y-rr,x+rr,y+rr],fill=hexc(c,230))
            d.ellipse([x-rr*.4,y-rr*.4,x+rr*.4,y+rr*.4],fill=hexc('#8a4a08',160))
    return Image.alpha_composite(im,L.filter(ImageFilter.GaussianBlur(blur)))
def petals(im,cols,n,size=(18,46),blur=0.8,region=(0,0,W,H)):
    L=layer()
    for _ in range(n):
        s=random.randint(*size); P=Image.new('RGBA',(s*2,s*2),(0,0,0,0)); d=ImageDraw.Draw(P)
        c=random.choice(cols); d.ellipse([s*.4,s*.1,s*1.6,s*1.9],fill=hexc(c,random.randint(170,240)))
        d.ellipse([s*.75,s*.5,s*1.25,s*1.2],fill=tuple(min(255,v+28) for v in hexc(c)[:3])+(hexc(c,200)[3],))
        P=P.rotate(random.randint(0,360),expand=True)
        L.alpha_composite(P,(random.randint(region[0],region[2]),random.randint(region[1],region[3])))
    return Image.alpha_composite(im,L.filter(ImageFilter.GaussianBlur(blur)))
def glow(im,x,y,r,col,a=150):
    L=layer(); d=ImageDraw.Draw(L); d.ellipse([x-r,y-r,x+r,y+r],fill=hexc(col,a))
    return Image.alpha_composite(im,L.filter(ImageFilter.GaussianBlur(r*.6)))
def candles(im,n,y=780):
    for i in range(n):
        x=int(W*(i+.5)/n+random.uniform(-25,25)); yy=y+random.randint(-60,60); h=random.randint(90,180)
        L=layer(); d=ImageDraw.Draw(L)
        d.rounded_rectangle([x-22,yy,x+22,yy+h],8,fill=hexc('#fbf3e4',235))
        im=Image.alpha_composite(im,L.filter(ImageFilter.GaussianBlur(2)))
        im=glow(im,x,yy-18,70,'#ffcf73',120); im=glow(im,x,yy-16,14,'#fff4d6',255)
    return im
def motif(im,col,step=70,r=5,alpha=110):
    L=layer(); d=ImageDraw.Draw(L)
    for y in range(0,H,step):
        for x in range((y//step%2)*step//2,W,step):
            d.ellipse([x-r,y-r,x+r,y+r],fill=hexc(col,alpha))
            d.ellipse([x-r*3,y-1,x+r*3,y+1],fill=hexc(col,alpha//2)); d.ellipse([x-1,y-r*3,x+1,y+r*3],fill=hexc(col,alpha//2))
    return Image.alpha_composite(im,L.filter(ImageFilter.GaussianBlur(.6)))
def finish(im,name,vig=150,grain=10):
    L=layer(); d=ImageDraw.Draw(L)
    for i in range(40):
        a=int(vig*(i/40)**2.2); d.rectangle([i*9,i*7,W-i*9,H-i*7],outline=(30,12,8,0))
    V=Image.new('L',(W,H),0); dv=ImageDraw.Draw(V); dv.ellipse([-W*.25,-H*.3,W*1.25,H*1.3],fill=255); V=V.filter(ImageFilter.GaussianBlur(160))
    dark=Image.new('RGBA',(W,H),(32,14,10,vig)); dark.putalpha(ImageChops.invert(V).point(lambda p:p*vig//255))
    im=Image.alpha_composite(im,dark)
    N=Image.effect_noise((W,H),grain).convert('RGBA'); N.putalpha(18)
    im=Image.alpha_composite(im,N).convert('RGB')
    im.save(sys.argv[1]+'/'+name+'.jpg',quality=80,optimize=True,progressive=True)
random.seed(14022027)
MARI=['#f5a300','#f08c00','#ffb627','#e86a0a','#ffd166']
# 1 hero: golden hour, garlands top, blush bokeh
im=grad('#f6d9b8','#b2563f'); im=glow(im,980,420,420,'#ffe1a8',200); im=bokeh(im,['#ffe2b0','#ffd28a','#f7b6a4','#fff1dc'],70,10,70,9)
im=drapes(im,'#fff3e6',6,22); im=garland(im,MARI,60,90,strands=2); im=hangers(im,MARI+['#ffffff'],7,140,(160,320),9)
im=petals(im,['#c2384b','#e8738a','#f7c6cc'],26,region=(0,650,W,H)); finish(im,'hero-golden-hour',170)
# 2 engagement: blush rose bokeh
im=grad('#f7e4e6','#c97e86'); im=glow(im,450,380,360,'#fff4f2',200); im=bokeh(im,['#ffffff','#f7c6cc','#e8a0aa','#f3d7b5'],90,8,80,10)
im=petals(im,['#8a1c2b','#c2384b','#f2a7af','#ffffff'],60,(14,40),.6); finish(im,'engagement-blush',120)
# 3 mehndi: pastel green + gold
im=grad('#e8efd4','#7f9152'); im=glow(im,700,350,420,'#fff6d8',180); im=bokeh(im,['#fff2c2','#d9e7b0','#ffffff','#e8c46a'],90,8,70,9)
im=hangers(im,['#ffd166','#f5a300','#b7d37a','#ffffff'],10,0,(200,420),8); im=petals(im,['#f5a300','#ffd166'],30,(10,26),region=(0,700,W,H)); finish(im,'mehndi-garden',130)
# 4 carnival/dj: burgundy night + fairy lights
im=grad('#3d0d16','#120406'); im=bokeh(im,['#ffcf73','#ff9e5e','#f2a7af','#fff4d6'],160,4,40,6,(90,220)); im=glow(im,700,980,520,'#8a1c2b',160); finish(im,'night-lights',90)
# 5 mayra: champagne drapes
im=grad('#fbf3e4','#d8b98a'); im=drapes(im,'#ffffff',8,90,14); im=drapes(im,'#e8c99a',5,60,22); im=bokeh(im,['#ffffff','#ffe8b8'],50,10,50,10); im=garland(im,MARI,40,60); finish(im,'champagne-drapes',110)
# 6 reception: candlelight
im=grad('#2a1611','#5e3524'); im=bokeh(im,['#ffcf73','#ffe8b8','#f7b6a4'],80,10,90,14,(40,130)); im=candles(im,7); im=petals(im,['#c2384b','#f2a7af'],30,region=(0,820,W,H)); finish(im,'reception-candlelight',120)
# 7 varmala & phere: marigold + fire glow
im=grad('#c4471c','#5a1209'); im=glow(im,700,760,360,'#ffb43c',230); im=glow(im,700,800,120,'#fff0b0',255)
im=bokeh(im,['#ffd166','#ff9e3d','#fff0c2'],70,6,50,8); im=garland(im,MARI+['#c2384b'],120,140,strands=3,r=15); finish(im,'marigold-phere',140)
# 8 rose petals on ivory
im=grad('#fbf7f0','#f3ece1'); im=petals(im,['#8a1c2b','#a52a3c','#c2384b','#e8738a','#f7c6cc'],170,(20,56),1.0); im=bokeh(im,['#ffffff'],30,20,60,14); finish(im,'rose-petals',60)
# 9 lehenga: burgundy fabric with gold motif
im=grad('#8a1c2b','#4a0c16'); im=drapes(im,'#b8323f',6,80,30); im=motif(im,'#e8a317'); im=drapes(im,'#2a0509',5,60,40); finish(im,'lehenga-burgundy',120)
# 10 sherwani: ivory/gold
im=grad('#f3e6cf','#c9a46a'); im=drapes(im,'#fff8ec',6,80,26); im=motif(im,'#9a6a1a',80,4,90); finish(im,'sherwani-ivory',100)
# 11 feast: warm table
im=grad('#f1d2a8','#8c4a22')
for (x,y,r,c) in [(330,560,230,'#fbf7f0'),(820,470,200,'#fbf7f0'),(1150,700,170,'#fbf7f0'),(560,860,150,'#fbf7f0')]:
    im=glow(im,x,y+20,r,'#3a1a0c',90); L=layer(); d=ImageDraw.Draw(L); d.ellipse([x-r,y-r,x+r,y+r],fill=hexc(c)); d.ellipse([x-r*.7,y-r*.7,x+r*.7,y+r*.7],fill=hexc(random.choice(['#e8a317','#c2541b','#d9a441','#8a3b12']))); im=Image.alpha_composite(im,L.filter(ImageFilter.GaussianBlur(3)))
im=bokeh(im,['#fff1dc','#ffd28a'],30,10,40,12); im=petals(im,['#f5a300','#e86a0a'],25,(10,22)); finish(im,'feast-table',130)
# 12 stage decor: white florals + gold arch
im=grad('#fdf6ec','#e9d3b0'); L=layer(); d=ImageDraw.Draw(L)
d.arc([300,120,1100,1100],180,360,fill=hexc('#d4a24a',255),width=26); im=Image.alpha_composite(im,L.filter(ImageFilter.GaussianBlur(2)))
im=petals(im,['#ffffff','#fde8ea','#f7c6cc'],160,(24,60),1.2,region=(240,80,1160,560)); im=hangers(im,['#ffffff','#f7c6cc'],12,0,(260,520),9); im=bokeh(im,['#ffffff','#ffe8b8'],40,10,50,10); finish(im,'stage-florals',90)
