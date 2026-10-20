"""Verified question boundaries in the supplied page renders (2.2x PDF scale)."""
from pathlib import Path
import json
from PIL import Image, ImageChops
ROOT=Path(__file__).resolve().parents[2]
DIST=ROOT/'site'/'dist'
TOPS={
74:[[[349,1344],[349,1509]],[[163,1085],[163,1252]],[[162,1416],[162,1258]],[[162,1383],[162,797,1499]],[[162,1042],[162,797,1490]],[[162,1187],[162,1318]],[[162,1420],[162,1148]],[[162,1299],[162,1193]],[[162,1251],[162,1043]],[[162,1323],[162,1187]],[[162,1247],[162,1284]],[[162,1319],[162,993]]],
78:[[[349,1390],[349,1432]],[[163,1223],[163,1429]],[[162,1277],[162,1236]],[[162,1100],[162,1357]],[[162,1204],[162,1266]],[[162,779,1569],[162,1378]],[[162,1407],[162,1057]],[[162,1208],[162,878,1487]],[[162,1405],[162,1331]],[[162,1316],[162,1229]],[[162,1378],[162,1291]],[[162,1338],[162,1151]]],
79:[[[349,1242],[349,1204]],[[163,1128],[163,861,1518]],[[162,1027],[162,1320]],[[162,1304],[162,1375]],[[162,1040],[162,1138]],[[162,1282],[162,1369]],[[162,1207],[162,1351]],[[162,1459],[162,871,1414]],[[162,1335],[162,1101]],[[162,1097],[162,1254]],[[162,1270],[162,1368]],[[162,1273],[162,1274]]]
}
def main():
    source=(DIST/'exams.js').read_text(encoding='utf-8-sig')
    exams=json.loads(source.split('=',1)[1].strip().rstrip(';'))
    for exam in exams:
        number=1
        for page_index,columns in enumerate(TOPS[exam['id']]):
            original=Image.open(DIST/exam['pages'][page_index]['image']).convert('RGB')
            for side,tops in enumerate(columns):
                for i,top in enumerate(tops):
                    bottom=tops[i+1]-16 if i+1<len(tops) else 2158
                    x0,x1=(80,795) if side==0 else (827,1525)
                    crop=original.crop((x0,top-12,x1,bottom))
                    # Trim only outer white space; preserve all photographic and text content.
                    difference=ImageChops.difference(crop,Image.new('RGB',crop.size,'white')).convert('L').point(lambda p:255 if p>35 else 0)
                    box=difference.getbbox()
                    if box:
                        crop=crop.crop((0,0,crop.width,min(crop.height,box[3]+15)))
                    image=f"assets/{exam['id']}/question-{number:02d}.jpg"
                    crop.save(DIST/image,quality=94)
                    q=exam['questions'][number-1]
                    assert q['number']==number
                    q.update({'image':image,'page':page_index+1,'crop':[x0,top-12,x1,bottom]})
                    number+=1
        assert number==51,exam['id']
        print(f"Cropped {exam['id']}: 50 complete questions",flush=True)
    (DIST/'exams.js').write_text('window.EXAMS = '+json.dumps(exams,ensure_ascii=False)+';\n',encoding='utf-8')
if __name__=='__main__':main()
