from pathlib import Path
from PIL import Image, ImageDraw
for size in (192, 512):
    image=Image.new('RGB',(size*3,size*3),'#155d50')
    draw=ImageDraw.Draw(image)
    n=size*3
    draw.ellipse((n*.21,n*.21,n*.79,n*.79),fill='#e9efe3')
    draw.polygon([(n*.38,n*.61),(n*.44,n*.39),(n*.68,n*.32),(n*.61,n*.57)],fill='#155d50')
    draw.line([(n*.33,n*.67),(n*.57,n*.43)],fill='#155d50',width=int(n*.025))
    image.resize((size,size),Image.Resampling.LANCZOS).save(Path(__file__).parent.parent/'apps/membres-pwa/public'/f'icon-{size}.png')
