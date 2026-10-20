"""OCR is used for locating headings; displayed questions remain original images."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import subprocess, csv, re, json
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'tmp'/'ocr'
OUT.mkdir(parents=True,exist_ok=True)
def run(item):
    exam,page,side=item
    source=ROOT/'site'/'dist'/'assets'/str(exam)/f'page-{page:02d}.jpg'
    im=Image.open(source)
    # Leave the question number and score visible; remove page headers and footers.
    x0,x1=(80,798) if side=='L' else (827,1524)
    y0=330 if page==1 else 105
    im.crop((x0,y0,x1,2160)).save(OUT/f'{exam}-{page:02d}-{side}.png')
    stem=OUT/f'{exam}-{page:02d}-{side}'
    subprocess.run(['C:/Program Files/Tesseract-OCR/tesseract.exe',str(stem)+'.png',str(stem),'-l','kor+eng','--psm','6','txt','tsv'],capture_output=True,check=True)
    with open(str(stem)+'.tsv',encoding='utf-8') as f:words=list(csv.DictReader(f,delimiter='\t'))
    found=[]
    for w in words:
        match=re.fullmatch(r'(\d{1,2})[.,]',w['text'])
        if match and int(w['left'])<45 and 1<=int(match[1])<=50:
            found.append({'number':int(match[1]),'top':int(w['top'])+y0,'confidence':float(w['conf'])})
    return {'exam':exam,'page':page,'side':side,'x0':x0,'x1':x1,'headings':found}
if __name__=='__main__':
    work=[(e,p,s) for e in [74,78,79] for p in range(1,13) for s in ['L','R']]
    with ThreadPoolExecutor(max_workers=6) as pool:results=list(pool.map(run,work))
    (OUT/'headings.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    for e in [74,78,79]:
        texts=[]
        for r in results:
            if r['exam']==e:
                stem=OUT/f"{e}-{r['page']:02d}-{r['side']}"
                texts.append(f"PAGE {r['page']} {r['side']} HEADINGS {r['headings']}\n"+stem.with_suffix('.txt').read_text(encoding='utf-8'))
        (OUT/f'{e}-text.txt').write_text('\n\n'.join(texts),encoding='utf-8')
        print(e,[(r['page'],r['side'],[(q['number'],q['top']) for q in r['headings']]) for r in results if r['exam']==e],flush=True)
