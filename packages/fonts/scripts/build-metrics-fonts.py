"""Build invisible "metrics" webfonts from the single-line font JSON.

Each glyph is empty but has exactly the advance width the ink renderer uses.
An <input> set in this font (with transparent text) gets a native caret,
selection, hit-testing and scrolling that line up with the drawn ink glyphs.

Needs fontTools + brotli:  pip install fonttools brotli && python scripts/build-metrics-fonts.py
"""
import json, pathlib
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = pathlib.Path(__file__).parent.parent
SRC = ROOT / 'data' / 'json'
OUT = ROOT / 'data' / 'metrics'
OUT.mkdir(exist_ok=True)

for key in json.loads((SRC / 'index.json').read_text()):
    data = json.loads((SRC / f'{key}.json').read_text())
    upm = int(data['upm'])
    asc, desc = int(data['ascent']), int(data['descent'])
    glyphs = data['g']
    fallback = glyphs.get('?', [upm * 0.5])[0]

    order, cmap, metrics = ['.notdef'], {}, {'.notdef': (int(fallback), 0)}
    chars = dict(glyphs)
    chars.setdefault(' ', glyphs.get(' ', [upm * 0.3, '']))  # nbsp
    for ch, (adv, _d) in sorted(chars.items()):
        name = f'u{ord(ch):04X}'
        order.append(name)
        cmap[ord(ch)] = name
        metrics[name] = (int(round(adv)), 0)

    empty = TTGlyphPen(None).glyph()
    # .notdef gets a real box: browsers' font sanitizer (OTS) rejects a font
    # whose glyf table is entirely empty. It is never shown — every char is mapped.
    pen = TTGlyphPen(None)
    pen.moveTo((50, 0)); pen.lineTo((50, asc)); pen.lineTo((int(fallback) - 50, asc)); pen.lineTo((int(fallback) - 50, 0)); pen.closePath()
    notdef = pen.glyph()
    family = f'Ink Metrics {key}'
    fb = FontBuilder(upm, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf({n: (notdef if n == '.notdef' else empty) for n in order})
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=asc, descent=desc, lineGap=0)
    fb.setupOS2(version=4, sTypoAscender=asc, sTypoDescender=desc, sTypoLineGap=0,
                usWinAscent=asc, usWinDescent=-desc, fsSelection=0x80)  # USE_TYPO_METRICS
    fb.setupNameTable({'familyName': family, 'styleName': 'Regular'})
    fb.setupPost()
    fb.font.flavor = 'woff2'
    fb.save(OUT / f'{key}.woff2')
    print(f'{key:16} {len(order)} glyphs')
