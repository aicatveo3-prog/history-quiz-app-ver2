"""Convert the supplied PDFs to faithful page images and validated answer data."""
from pathlib import Path
import json
import re
import shutil
import pdfplumber
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "site" / "dist"
STARTS = {
    74: [1, 5, 9, 13, 18, 23, 27, 31, 35, 39, 43, 47],
    78: [1, 5, 9, 13, 17, 21, 26, 30, 35, 39, 43, 47],
    79: [1, 5, 10, 14, 18, 22, 26, 30, 35, 39, 43, 47],
}

def main():
    exams = []
    files = list((ROOT / "한능검 기출").glob("*.pdf"))
    for number, starts in STARTS.items():
        problem = next(f for f in files if f"제{number}회" in f.name and "문제" in f.name)
        answer = next(f for f in files if f"제{number}회" in f.name and "정답" in f.name)
        with pdfplumber.open(answer) as pdf:
            text = pdf.pages[0].extract_text()
        triples = re.findall(r"(\d+)\s+([①②③④⑤])\s+([123])", text)
        questions = sorted([
            {"number": int(n), "answer": "①②③④⑤".index(a) + 1, "points": int(p)}
            for n, a, p in triples
        ], key=lambda q: q["number"])
        assert [q["number"] for q in questions] == list(range(1, 51)), number
        assert sum(q["points"] for q in questions) == 100, number
        folder = OUT / "assets" / str(number)
        folder.mkdir(parents=True, exist_ok=True)
        document = pdfium.PdfDocument(problem)
        assert len(document) == len(starts)
        pages = []
        for i, first in enumerate(starts):
            page = document[i]
            bitmap = page.render(scale=2.2)
            image = bitmap.to_pil().convert("RGB")
            image.save(folder / f"page-{i + 1:02d}.jpg", quality=90)
            pages.append({"image": f"assets/{number}/page-{i + 1:02d}.jpg", "first": first,
                          "last": starts[i + 1] - 1 if i + 1 < len(starts) else 50})
            bitmap.close()
            page.close()
        document.close()
        shutil.copy2(problem, folder / "questions.pdf")
        shutil.copy2(answer, folder / "answers.pdf")
        exams.append({"id": number, "title": f"제{number}회 심화",
                      "questions": questions, "pages": pages})
        print(f"Imported {number}: 50 questions, 100 points, {len(pages)} pages", flush=True)
    (OUT / "exams.js").write_text("window.EXAMS = " + json.dumps(exams, ensure_ascii=False) + ";\n", encoding="utf-8")

if __name__ == "__main__":
    main()
