"""Convert single-stroke SVG 1.1 fonts (EMS / Hershey / Relief) into compact JSON for the ink renderer."""
import re, json, html, pathlib, sys

RAW = pathlib.Path(__file__).parent.parent / 'data' / 'svg'
OUT = pathlib.Path(__file__).parent.parent / 'data' / 'json'
FONTS = {
  'allure': 'EMSAllure', 'casual': 'EMSCasualHand', 'delight': 'EMSDelight',
  'elfin': 'EMSElfin', 'felix': 'EMSFelix', 'pepita': 'EMSPepita',
  'readability': 'EMSReadability', 'hershey-script': 'HersheyScript1',
  'hershey-sans': 'HersheySans1', 'hershey-serif': 'HersheySerifMed',
  'relief': 'ReliefSingleLine',
}

def attr(tag, name):
  m = re.search(r'\s' + name + r'="([^"]*)"', tag)
  return m.group(1) if m else None

index = {}
for key, fname in FONTS.items():
  s = (RAW / f'{fname}.svg').read_text()
  face = re.search(r'<font-face[\s\S]*?/>', s).group(0)
  font = re.search(r'<font\b[^>]*>', s).group(0)
  default_adv = float(attr(font, 'horiz-adv-x') or 500)
  glyphs = {}
  for g in re.findall(r'<glyph\b[\s\S]*?/>', s):
    u = attr(g, 'unicode')
    if u is None: continue
    u = html.unescape(u)
    if len(u) != 1: continue  # skip ligatures
    d = attr(g, 'd') or ''
    d = re.sub(r'\s+', ' ', d).strip()
    glyphs[u] = [round(float(attr(g, 'horiz-adv-x') or default_adv), 1), d]
  data = {
    'name': attr(face, 'font-family'),
    'upm': float(attr(face, 'units-per-em')),
    'ascent': float(attr(face, 'ascent')),
    'descent': float(attr(face, 'descent')),
    'xh': float(attr(face, 'x-height') or 0),
    'cap': float(attr(face, 'cap-height') or 0),
    'g': glyphs,
  }
  (OUT / f'{key}.json').write_text(json.dumps(data, separators=(',', ':'), ensure_ascii=False))
  index[key] = data['name']
  print(f'{key:16} {data["name"]:28} {len(glyphs)} glyphs')
(OUT / 'index.json').write_text(json.dumps(index, indent=1))
