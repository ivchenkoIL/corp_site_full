# номер страницы каждого заголовка: поиск по тексту страниц по порядку
import fitz, json, sys, re, html
pdf, src_html, out = sys.argv[1:4]
d = fitz.open(pdf)
norm = lambda s: re.sub(r'[\s­\-‐]+', '', s)
texts = [norm(p.get_text()) for p in d]
h = open(src_html, encoding='utf-8').read()
heads = re.findall(r'<h([1-4]) id="([^"]+)"[^>]*>(.*?)</h\1>', h, flags=re.S)
res = {}
cur = next(i for i,t in enumerate(texts) if 'TOCENDMARK' in t) + 1
for lvl, hid, inner in heads:
    plain = html.unescape(re.sub(r'<[^>]+>', '', inner)).strip()
    key = norm(plain)[:40]
    for i in range(cur, len(texts)):
        if key in texts[i]:
            res[plain] = i + 1; cur = i; break
json.dump(res, open(out, 'w'), ensure_ascii=False)
print(len(res), 'of', len(heads))
