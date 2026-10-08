import copy, json, os
from lxml import etree
from PIL import Image
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR, MSO_AUTO_SIZE
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION, XL_LABEL_POSITION, XL_MARKER_STYLE
from pptx.oxml.ns import qn

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SIM = json.load(open(os.path.join(HERE, 'sim.json')))

# ---- palette: template blue + logo gold + product green ----
NAVY, BLUE, BRIGHT, GOLD, GREEN, RED = '14305E', '1F4E8C', '2F6FD0', 'F2B705', '12A37A', 'D64545'
LIGHT, MID, TEXT, MUTED, WHITE, SOFTG, SOFTY, SOFTR = 'EEF3FA', 'C9D6EA', '1B1F2A', '5B6678', 'FFFFFF', 'E6F6F0', 'FFF6D6', 'FBE9E9'
FONT = 'Calibri'
I = Inches
rgb = RGBColor.from_string


def rect(sl, x, y, w, h, fill=WHITE, line=None, lw=1.25, rad=0.1, shape=None, name=None):
    shp = sl.shapes.add_shape(shape or MSO_SHAPE.ROUNDED_RECTANGLE, I(x), I(y), I(w), I(h))
    if shape is None: shp.adjustments[0] = min(0.5, rad / min(w, h))
    if fill is None: shp.fill.background()
    else: shp.fill.solid(); shp.fill.fore_color.rgb = rgb(fill)
    if line: shp.line.color.rgb = rgb(line); shp.line.width = Pt(lw)
    else: shp.line.fill.background()
    shp.shadow.inherit = False
    if name: shp.name = name
    return shp


def _bullet(p, indent=0.2, char='•', color=None):
    pPr = p._p.get_or_add_pPr(); pPr.set('marL', str(int(indent * 914400))); pPr.set('indent', str(-int(indent * 914400)))
    if color:
        bc = etree.SubElement(pPr, qn('a:buClr')); c = etree.SubElement(bc, qn('a:srgbClr')); c.set('val', color)
    bf = etree.SubElement(pPr, qn('a:buFont')); bf.set('typeface', 'Arial')
    bu = etree.SubElement(pPr, qn('a:buChar')); bu.set('char', char)


def fill_tf(tf, paras, size=16, color=TEXT, bold=False, align='l', space=4, font=FONT, bullet=False, lsp=None):
    first = True
    for item in paras:
        o = {'size': size, 'color': color, 'bold': bold, 'align': align, 'space': space, 'bullet': bullet}
        if isinstance(item, str): runs = [(item, {})]
        elif isinstance(item, list): runs = item
        else:
            o.update({k: v for k, v in item.items() if k not in ('t', 'runs')})
            runs = item['runs'] if 'runs' in item else [(item['t'], {})]
        p = tf.paragraphs[0] if first else tf.add_paragraph(); first = False
        p.alignment = {'l': PP_ALIGN.LEFT, 'c': PP_ALIGN.CENTER, 'r': PP_ALIGN.RIGHT}[o['align']]
        p.space_after = Pt(o['space']); p.space_before = Pt(0)
        if lsp: p.line_spacing = lsp
        for t, ro in runs:
            r = p.add_run(); r.text = t; f = r.font
            f.size = Pt(ro.get('size', o['size'])); f.bold = ro.get('bold', o['bold']); f.italic = ro.get('italic', False); f.name = font
            f.color.rgb = rgb(ro.get('color', o['color']))
            if ro.get('u'): f.underline = True
        if o['bullet']: _bullet(p, color=o.get('bucolor'))


def txt(sl, x, y, w, h, paras, anchor='t', margin=0.06, **kw):
    tb = sl.shapes.add_textbox(I(x), I(y), I(w), I(h)); tf = tb.text_frame
    tf.word_wrap = True; tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = tf.margin_right = I(margin); tf.margin_top = tf.margin_bottom = I(0.03)
    tf.vertical_anchor = {'t': MSO_ANCHOR.TOP, 'm': MSO_ANCHOR.MIDDLE, 'b': MSO_ANCHOR.BOTTOM}[anchor]
    fill_tf(tf, paras, **kw)
    return tb


def box(sl, x, y, w, h, paras, fill=LIGHT, line=None, anchor='m', rad=0.1, margin=0.1, **kw):
    s = rect(sl, x, y, w, h, fill, line, rad=rad)
    tf = s.text_frame; tf.word_wrap = True; tf.auto_size = MSO_AUTO_SIZE.NONE
    tf.margin_left = tf.margin_right = I(margin); tf.margin_top = tf.margin_bottom = I(0.04)
    tf.vertical_anchor = {'t': MSO_ANCHOR.TOP, 'm': MSO_ANCHOR.MIDDLE, 'b': MSO_ANCHOR.BOTTOM}[anchor]
    fill_tf(tf, paras, **kw)
    return s


def panel(sl, x, y, w, h, title, accent=BLUE, hh=0.58):
    rect(sl, x, y, w, h, WHITE, MID, 1.5, rad=0.14)
    rect(sl, x, y, w, hh, accent, rad=0.14)
    rect(sl, x, y + hh / 2, w, hh / 2, accent, shape=MSO_SHAPE.RECTANGLE)
    txt(sl, x + 0.18, y, w - 0.36, hh, [title], size=21, color=WHITE, bold=True, anchor='m')


def arrow(sl, x1, y1, x2, y2, color=MUTED, w=2.5, head=True, dash=False):
    c = sl.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, I(x1), I(y1), I(x2), I(y2))
    c.line.color.rgb = rgb(color); c.line.width = Pt(w)
    ln = c.line._get_or_add_ln()
    if dash:
        d = etree.SubElement(ln, qn('a:prstDash')); d.set('val', 'dash')
    if head:
        t = etree.SubElement(ln, qn('a:tailEnd')); t.set('type', 'triangle'); t.set('w', 'med'); t.set('len', 'med')
    return c


def circle(sl, cx, cy, d, fill, text='', size=16, color=WHITE, line=None):
    s = rect(sl, cx - d / 2, cy - d / 2, d, d, fill, line, shape=MSO_SHAPE.OVAL)
    tf = s.text_frame; tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0; tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    if text: fill_tf(tf, [text], size=size, color=color, bold=True, align='c', space=0)
    return s


def style_chart(ch, size=13):
    ch.font.size = Pt(size); ch.font.name = FONT; ch.font.color.rgb = rgb(TEXT)


def bar_chart(sl, x, y, w, h, cats, series, colors, title=None, horizontal=False, size=13, fmt='General', legend=False, gap=60, ymax=None, point_colors=None):
    cd = CategoryChartData(); cd.categories = cats
    for n, v in series: cd.add_series(n, v)
    typ = XL_CHART_TYPE.BAR_CLUSTERED if horizontal else XL_CHART_TYPE.COLUMN_CLUSTERED
    ch = sl.shapes.add_chart(typ, I(x), I(y), I(w), I(h), cd).chart
    style_chart(ch, size)
    ch.has_title = bool(title)
    if title: ch.chart_title.text_frame.text = title; ch.chart_title.text_frame.paragraphs[0].runs[0].font.size = Pt(size + 1); ch.chart_title.text_frame.paragraphs[0].runs[0].font.bold = True
    ch.has_legend = legend
    if legend: ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False; ch.legend.font.size = Pt(size)
    pl = ch.plots[0]; pl.gap_width = gap; pl.has_data_labels = True
    dl = pl.data_labels; dl.font.size = Pt(size); dl.font.bold = True; dl.number_format = fmt; dl.number_format_is_linked = False; dl.position = XL_LABEL_POSITION.OUTSIDE_END
    for s, c in zip(pl.series, colors):
        s.format.fill.solid(); s.format.fill.fore_color.rgb = rgb(c)
    if point_colors:
        for i, c in enumerate(point_colors):
            pt = pl.series[0].points[i]; pt.format.fill.solid(); pt.format.fill.fore_color.rgb = rgb(c)
    va = ch.value_axis; va.has_major_gridlines = False; va.visible = False
    if ymax: va.maximum_scale = ymax
    va.minimum_scale = 0 if min(min(v for v in s[1] if v is not None) for s in series) >= 0 else None
    ca = ch.category_axis; ca.tick_labels.font.size = Pt(size); ca.format.line.color.rgb = rgb(MID); ca.has_major_gridlines = False
    return ch


def table(sl, x, y, w, rows, colw, rowh, size=14, head=NAVY, zebra=True, align=None, first_bold=True):
    nr, nc = len(rows), len(rows[0])
    gf = sl.shapes.add_table(nr, nc, I(x), I(y), I(w), I(rowh * nr)); tb = gf.table
    tb.first_row = False; tb.horz_banding = False
    for j, cw in enumerate(colw): tb.columns[j].width = I(cw)
    for i in range(nr): tb.rows[i].height = I(rowh)
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            cell = tb.cell(i, j); o = val if isinstance(val, dict) else {'t': val}
            cell.margin_left = cell.margin_right = I(0.08); cell.margin_top = cell.margin_bottom = I(0.03)
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            cell.fill.solid()
            cell.fill.fore_color.rgb = rgb(o.get('fill', head if i == 0 else (LIGHT if zebra and i % 2 == 0 else WHITE)))
            tf = cell.text_frame; tf.word_wrap = True
            a = (align[j] if align else 'l')
            fill_tf(tf, [o['t']], size=o.get('size', size), color=o.get('c', WHITE if i == 0 else TEXT), bold=o.get('b', i == 0 or (first_bold and j == 0)), align=o.get('a', 'c' if (i == 0 and a == 'c') else a), space=0)
    return gf


def src(sl, text):
    txt(sl, 0.45, 10.02, 19.1, 0.36, [text], size=12, color=MUTED, anchor='m')


def notes(sl, text):
    sl.notes_slide.notes_text_frame.text = text


def chip(sl, x, y, w, h, text, fill=LIGHT, color=BLUE, size=14, line=None, bold=True):
    return box(sl, x, y, w, h, [text], fill=fill, line=line, size=size, color=color, bold=bold, align='c', rad=0.08, margin=0.04, space=0)


def remove_shape(sl, name):
    for sh in list(sl.shapes):
        if sh.name == name: sh._element.getparent().remove(sh._element)


def crop(path, out, aspect):
    im = Image.open(path).convert('RGB'); w, h = im.size
    if w / h > aspect: nw = int(h * aspect); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else: nh = int(w / aspect); im = im.crop((0, 0, w, nh))
    im.save(out, quality=92); return out


# ============================================================ open template, drop the instructions slide
prs = Presentation(os.path.join(HERE, 'template.pptx'))
ids = prs.slides._sldIdLst
last = ids[len(ids) - 1]; prs.part.drop_rel(last.rId); ids.remove(last)   # slide 7 = "Important instructions" (max 6 slides)
S = list(prs.slides)
TOP, BOT = 2.0, 10.55          # usable band under the template header
LX, LW, RX, RW = 0.45, 9.4, 10.0, 9.55


def src(sl, text):
    txt(sl, 0.45, 10.6, 19.1, 0.4, [text], size=12.5, color=MUTED, anchor='m')


# ============================================================ SLIDE 1 — TITLE PAGE
s = S[0]
tb = [sh for sh in s.shapes if sh.name == 'TextBox 6'][0]
tb.left, tb.top, tb.width = I(0.64), I(2.55), I(11.3)
values = ['PS 3.1 (Track 3: FinTech)',
          'FinCrew: help small businesses stay financially healthy and decide better',
          'FinTech  ·  SDG 8  ·  SDG 9  ·  SDG 16',
          '[ add registered Team ID ]',
          'OXRO LABS  ·  Ram · Sumit · Masoom']
paras = [p for p in tb.text_frame._txBody.findall(qn('a:p')) if p.findall(qn('a:r'))]
for p, val in zip(paras, values):
    pPr = p.find(qn('a:pPr')); ln = pPr.find(qn('a:lnSpc'))
    if ln is not None: pPr.remove(ln)
    ls = etree.Element(qn('a:lnSpc')); sp = etree.SubElement(ls, qn('a:spcPct')); sp.set('val', '100000'); pPr.insert(0, ls)
    sa = etree.Element(qn('a:spcAft')); spp = etree.SubElement(sa, qn('a:spcPts')); spp.set('val', '2500'); ls.addnext(sa)
    r0 = p.findall(qn('a:r'))[0]
    br = etree.SubElement(p, qn('a:br')); rp = copy.deepcopy(r0.find(qn('a:rPr'))); rp.set('sz', '2400'); br.append(rp)
    r = copy.deepcopy(r0); rpr = r.find(qn('a:rPr')); rpr.set('sz', '2600'); rpr.set('b', 'false')
    for f in rpr.findall(qn('a:solidFill')): rpr.remove(f)
    sf = etree.Element(qn('a:solidFill')); c = etree.SubElement(sf, qn('a:srgbClr')); c.set('val', BLUE); rpr.insert(0, sf)
    for tag in ('a:latin', 'a:ea', 'a:cs', 'a:sym'):
        e = rpr.find(qn(tag))
        if e is not None: e.set('typeface', 'Calibri')
    r.find(qn('a:t')).text = val
    p.append(r); pPr.set('algn', 'l')

rect(s, 12.3, 2.35, 7.25, 2.95, NAVY, rad=0.18)
rect(s, 12.5, 2.55, 2.55, 2.55, WHITE, rad=0.16)
s.shapes.add_picture(os.path.join(ROOT, 'public', 'logo.png'), I(12.55), I(2.6), I(2.45), I(2.45))
txt(s, 15.2, 2.5, 4.3, 0.55, ['MIND YOUR FUNDS'], size=28, color=WHITE, bold=True)
txt(s, 15.2, 3.08, 4.3, 0.5, ['Oxro Labs Finance Desk'], size=19, color=GOLD, bold=True)
txt(s, 15.2, 3.65, 4.3, 1.6, ['A finance manager that feels like a game: plan · track · grow.', 'Catches late payments, missed GST deadlines and fraud, and keeps the owner in control.'], size=15, color='DCE6F7', space=4)
tiles = [('7.61 cr', 'MSMEs registered in India [1]', BRIGHT), ('27 days', 'median small-business cash buffer [5]', GREEN), ('₹36,014 cr', 'bank fraud reported, FY25 [4]', RED), ('1.51 cr', 'active GST registrations [3]', BLUE)]
for i, (big, small, col) in enumerate(tiles):
    x = 12.3 + (i % 2) * 3.7; y = 5.45 + (i // 2) * 1.4
    rect(s, x, y, 3.55, 1.3, WHITE, MID, 1.5, rad=0.12)
    txt(s, x + 0.1, y + 0.05, 3.35, 0.65, [big], size=32, color=col, bold=True, anchor='m')
    txt(s, x + 0.1, y + 0.7, 3.35, 0.55, [small], size=14, color=MUTED)
for i, (n, t, col) in enumerate([('8', 'Decent Work & Economic Growth', 'A21942'), ('9', 'Industry, Innovation & Infrastructure', 'F36D25'), ('16', 'Peace, Justice & Strong Institutions', '00689D')]):
    x = 12.3 + i * 2.45
    rect(s, x, 8.35, 2.3, 1.1, col, rad=0.1)
    txt(s, x + 0.03, 8.37, 0.8, 1.06, [n], size=30, color=WHITE, bold=True, anchor='m', align='c')
    txt(s, x + 0.75, 8.37, 1.52, 1.06, ['SDG ' + n + ': ' + t], size=12, color=WHITE, bold=True, anchor='m')
for i, (n, r_) in enumerate([('Ram', 'Engine · agents · database'), ('Sumit', 'UI · gamification feel'), ('Masoom', 'Trust · content · pitch')]):
    x = 12.3 + i * 2.45
    box(s, x, 9.6, 2.3, 1.05, [{'t': n, 'bold': True, 'size': 18, 'color': NAVY}, {'t': r_, 'size': 13, 'color': MUTED}], fill=LIGHT, line=MID, rad=0.1, align='c', space=0, margin=0.05)
txt(s, 0.64, 10.6, 11.3, 0.4, ['Product: Mind Your Funds  ·  Oxro Labs Finance Desk   |   Stats and references: slide 6'], size=13.5, color=MUTED, anchor='m')
notes(s, 'Intro: FinCrew answers PS 3.1. Product name: Mind Your Funds, deployed as the Oxro Labs Finance Desk. Add the registered Team ID before submitting.')

# ============================================================ SLIDE 2 — PROBLEM STATEMENT
s = S[1]; remove_shape(s, 'TextBox 5')
R1Y, R1H, R2Y, R2H = TOP, 4.3, 6.45, 4.1
panel(s, LX, R1Y, LW, R1H, 'Problem')
txt(s, LX + 0.12, R1Y + 0.72, 4.55, 3.55, [
    'Invoices, bills, payroll, GST and cash flow sit in 6+ disconnected tools',
    'No finance team: risks surface only after the damage (late payer, missed GSTR-1/3B, fake invoice)',
    'The owner cannot answer "what must I act on today?" or prove what was done and why',
    'New 45-day MSME payment rule and monthly GST deadlines add load'], size=17, bullet=True, space=8)
cx, cy = 7.35, 4.5
for lab, x, y in [('Excel sheets', 5.15, 2.95), ('Bank app', 6.75, 2.95), ('WhatsApp', 8.3, 2.95), ('GST portal', 5.15, 5.65), ('Accounting tool', 6.75, 5.65), ('Paper bills', 8.3, 5.65)]:
    chip(s, x, y, 1.45, 0.52, lab, fill=LIGHT, color=BLUE, size=14, line=MID)
    arrow(s, x + 0.72, y + (0.52 if y < 4 else 0), cx, cy + (-0.66 if y < 4 else 0.66), color=RED, w=1.75, head=False, dash=True)
circle(s, cx, cy, 1.3, NAVY, 'Owner?', 17)
txt(s, 5.15, 3.8, 1.7, 0.4, ['no single view'], size=13, color=RED, anchor='m')
panel(s, RX, R1Y, RW, R1H, 'Target users / affected stakeholders')
hx, hy = 12.8, 4.5
for lab, x, y, w_ in [('Accountant / CA', 10.15, 2.95, 2.3), ('Employees (payroll)', 13.05, 2.95, 2.3), ('Customers & vendors', 10.15, 5.65, 2.3), ('Lenders & GST authority', 13.05, 5.65, 2.3), ('Approvers / admins', 10.15, 4.25, 1.8), ('Company finance team', 13.6, 4.25, 1.75)]:
    chip(s, x, y, w_, 0.52, lab, fill=SOFTG, color='0B6B4E', size=13.5, line=GREEN)
    mid = x + w_ / 2
    ty = hy - 0.66 if y < 4 else hy + 0.66 if y > 5 else hy
    tx = hx if y != 4.25 else (hx - 0.65 if x < 12 else hx + 0.65)
    arrow(s, mid if y != 4.25 else (x + w_ if x < 12 else x), y + (0.52 if y < 4 else 0 if y > 5 else 0.26), tx, ty, color=GREEN, w=1.75, head=False)
circle(s, hx, hy, 1.3, GREEN, 'Small business owner', 13.5)
for i, (big, small) in enumerate([('7.61 crore', 'registered MSMEs [1]'), ('30.1%', "of India's GDP [2]"), ('45.73%', "of India's exports [2]")]):
    y = 2.75 + i * 1.17
    rect(s, 15.5, y, 3.88, 1.08, LIGHT, MID, 1.25, rad=0.1)
    txt(s, 15.52, y, 1.95, 1.08, [big], size=24, color=BLUE, bold=True, anchor='m', align='c')
    txt(s, 17.4, y, 1.95, 1.08, [small], size=14, color=TEXT, anchor='m')
panel(s, LX, R2Y, LW, R2H, 'Existing gap')
rows = [['Existing tool', 'Does well', 'Gap for a small business'],
        ['Spreadsheets', 'Flexible records', 'Manual, error-prone, no alerts or audit'],
        ['Accounting software', 'Books and GST reports', 'Reactive: shows history, warns late'],
        ['Banking / UPI apps', 'Balances, payments', 'No invoice, input-credit or deadline context'],
        ['Monthly CA visit', 'Expert filing', 'Advice arrives after the due date'],
        ['Reminder apps', 'Nudges', 'No link to ₹ at risk or proof of action']]
table(s, LX + 0.15, R2Y + 0.75, LW - 0.3, rows, [2.4, 2.4, 4.3], 0.56, size=15)
panel(s, RX, R2Y, RW, R2H, 'Why the problem needs to be solved')
bar_chart(s, RX + 0.1, R2Y + 0.7, 4.3, 3.3, ['Median business', 'Bottom 25%'], [('Cash buffer (days)', [27, 13])], [BRIGHT], title='Cash buffer days (US firms) [5]', size=13.5, point_colors=[BRIGHT, RED], ymax=34)
why = [('₹36,014 cr', 'bank fraud, FY25: 23,953 cases [4]'), ('45 days', 'legal MSME payment limit since 1 Apr 2024; ₹20.7k cr dues, 85k cases [6]'), ('₹22.08 L cr', 'gross GST FY25 from 1.51 cr taxpayers on strict deadlines [3]'), ('₹20–25 L cr', 'estimated MSME credit gap [11]')]
for i, (big, small) in enumerate(why):
    y = R2Y + 0.75 + i * 0.83
    rect(s, RX + 4.5, y, 4.95, 0.76, LIGHT, MID, 1.0, rad=0.08)
    txt(s, RX + 4.52, y, 1.75, 0.76, [big], size=20, color=RED if i == 0 else BLUE, bold=True, anchor='m', align='c')
    txt(s, RX + 6.25, y, 3.15, 0.76, [small], size=13, color=TEXT, anchor='m')
src(s, 'Sources: [1] Min. of MSME AR 2025-26 · [2] PIB MSME Day 2025 · [3] PIB Eight Years of GST · [4] RBI AR 2024-25 · [5] JPMorgan Chase Institute · [6] Income-tax Act s.43B(h), MSME Samadhaan · [11] IFC estimate (as cited). Full list on slide 6.')
notes(s, 'Problem: scattered tools, no finance team, no record. Stakeholders: owner, CA, employees, customers/vendors, lenders. Gap: existing tools are reactive. Why now: thin cash buffers (27 days), fraud, 45-day rule, GST deadlines.')

# ============================================================ SLIDE 3 — PROPOSED SOLUTION
s = S[2]; remove_shape(s, 'TextBox 5')
A1Y, A1H, A2Y, A2H = TOP, 3.6, 5.75, 4.8
panel(s, 0.45, A1Y, 7.2, A1H, 'Solution overview')
rect(s, 0.6, 2.8, 1.65, 1.65, WHITE, MID, 1.25, rad=0.12)
s.shapes.add_picture(os.path.join(ROOT, 'public', 'logo.png'), I(0.64), I(2.84), I(1.57), I(1.57))
txt(s, 2.4, 2.72, 5.15, 1.8, ["Mind Your Funds is an AI-assisted finance manager that makes a small business's money visible, safe and rewarding to manage. Deployed as the shared Oxro Labs Finance Desk."], size=16.5, space=2)
for i, t in enumerate(['PLAN', 'TRACK', 'GROW']):
    chip(s, 0.6 + i * 2.38, 4.6, 2.25, 0.55, t, fill=[BRIGHT, GREEN, GOLD][i], color=WHITE if i < 2 else NAVY, size=18)
txt(s, 0.6, 5.2, 6.95, 0.38, [[('4-agent crew: ', {'bold': True, 'color': BLUE}), ('Collector · Treasurer · Sentinel · Scout', {})]], size=15, anchor='m')
panel(s, 7.8, A1Y, 11.75, A1H, 'Key features')
feats = [('Health score + alerts', 'Runway, collections and credit safety in one number'), ('GST engine', 'CGST/SGST/IGST, input credit, GSTR-1/3B calendar'), ('Approvals + roles', 'Admin, finance, viewer; spend limit enforced in DB'), ('Bank CSV + recurring', 'Auto-match payments; monthly entries on autopilot'),
         ('Tamper-evident audit', 'Who, what and why in a SHA‑256 chain'), ('AI CFO (Groq)', 'Ask questions on aggregate numbers; stress test'), ('Reports + GST invoices', 'P&L, aging, top parties, print to PDF'), ('XP, streaks, quests', 'Badges, scratch reward, team leaderboard')]
for i, (t, d) in enumerate(feats):
    x = 7.95 + (i % 4) * 2.88; y = 2.72 + (i // 4) * 1.4
    box(s, x, y, 2.76, 1.3, [{'t': t, 'bold': True, 'size': 16.5, 'color': NAVY}, {'t': d, 'size': 14, 'color': TEXT}], fill=LIGHT if (i + i // 4) % 2 == 0 else SOFTG, line=MID, anchor='t', align='l', space=1, rad=0.1)
panel(s, 0.45, A2Y, 9.3, A2H, 'How it addresses the problem')
rows = [['The PS asks', 'Our answer'],
        ['What does the owner most need to know, and when?', 'Daily dashboard: health score, ₹ at risk, next 14 days; alerts ranked by urgency; GST and payroll dues flagged 5 days ahead'],
        ['How are late payments, missed deadlines and suspicious activity caught?', 'Collector flags overdue invoices; calendar tracks GSTR-1 (11th) and GSTR-3B (20th) [10]; Sentinel checks duplicates, invalid GSTIN, unusually large bills'],
        ['How does the owner stay in control, with a clear record?', 'Roles and approval above a spend limit; one-click actions; every action stored with who, what and why in a SHA‑256 chain'],
        ['Play layer: surprises hit (late client, big expense, fraud, growth chance)', 'Practice Lab runs 90 days of shocks; Ghost Twin compares health with and without the crew']]
table(s, 0.6, A2Y + 0.72, 9.0, rows, [3.1, 5.9], 0.8, size=14.5)
panel(s, 9.9, A2Y, 9.65, A2H, 'Simple solution workflow')
steps = [('Capture', 'Invoice, bill, payroll, bank CSV'), ('Validate', 'GSTIN checksum, CGST/SGST/IGST'), ('Analyse', 'Forecast, aging, risk rules'), ('Alert', 'Ranked cards with ₹ impact'),
         ('Decide', 'Approve, reject or auto within limit'), ('Record', 'Who, what, why: SHA‑256 chain'), ('Reward', 'XP, streak, badge, scratch card'), ('Improve', 'Health score, reports, AI CFO')]
W_, G_, X0, SH = 2.0, 0.4, 10.05, 1.4
for i, (t, d) in enumerate(steps):
    row, col = divmod(i, 4); x = X0 + col * (W_ + G_); y = 6.55 + row * 1.85
    box(s, x, y, W_, SH, [{'t': f'{i + 1}  {t}', 'bold': True, 'size': 17, 'color': WHITE}, {'t': d, 'size': 13.5, 'color': 'E3ECFA'}], fill=[BLUE, BRIGHT][row], anchor='m', align='l', space=2, margin=0.12)
    if col < 3: arrow(s, x + W_ + 0.02, y + SH / 2, x + W_ + G_ - 0.02, y + SH / 2, color=NAVY, w=3)
ex, ey = X0 + 3 * (W_ + G_) + W_ / 2, 6.55 + SH
arrow(s, ex, ey, ex, ey + 0.23, color=NAVY, w=3, head=False)
arrow(s, ex, ey + 0.23, X0 + W_ / 2, ey + 0.23, color=NAVY, w=3, head=False)
arrow(s, X0 + W_ / 2, ey + 0.23, X0 + W_ / 2, 8.4, color=NAVY, w=3)
chip(s, 10.05, 9.98, 9.2, 0.45, 'Daily loop: check-in → quests → reward → streak → better books tomorrow', fill=SOFTY, color=NAVY, size=15.5, line=GOLD)
src(s, 'Deadlines per GST portal [10]; rates and dates are planning estimates, verify with a Chartered Accountant. Features shown are built and running in the prototype.')
notes(s, 'Solution: one finance desk for the whole team. Walk the 8-step workflow, then map each PS question to a feature.')

# ============================================================ SLIDE 4 — INNOVATION AND GAMIFICATION
s = S[3]; remove_shape(s, 'TextBox 5')
B1Y, B1H, B2Y, B2H = TOP, 4.5, 6.65, 3.9
panel(s, LX, B1Y, LW, B1H, 'What is unique about the solution')
uniq = [('Ghost Twin: ', 'same business, same shocks, crew switched off, so the benefit is measured, not claimed'), ('Trust Dial: ', 'per-agent autonomy from "ask me" to "auto up to a ₹ cap"'), ('Why-Receipts: ', 'who, what and why kept in a tamper-evident SHA‑256 chain'), ('DB-enforced control: ', 'roles and approvals live in RLS and triggers, not just buttons'), ('Stress test: ', 'cash in 30 days if every customer pays late')]
txt(s, LX + 0.12, B1Y + 0.7, 5.3, 3.75, [{'runs': [(a, {'bold': True, 'color': BLUE}), (b, {})], 'bullet': True} for a, b in uniq], size=16.5, space=7)
bar_chart(s, LX + 5.45, B1Y + 0.7, 3.85, 2.85, ['With crew', 'Unassisted twin'], [('Health', [SIM['crewFin']['health'], SIM['ghostFin']['health']])], [GREEN], title='Health score, 90-day simulation', size=13.5, point_colors=[GREEN, RED], ymax=105)
txt(s, LX + 5.45, B1Y + 3.6, 3.85, 0.85, ['Twin went bankrupt on day 30 (₹25,000 fraud paid). Crew ended with ₹4.73 L cash and blocked ₹70,000 of fraud.'], size=13, color=MUTED)
panel(s, RX, B1Y, RW, B1H, 'Gamification elements')
bar_chart(s, RX + 0.1, B1Y + 0.7, 4.4, 3.7, ['Transaction logged', 'Alert resolved', 'Daily check-in', 'Paid on time', 'Badge unlocked', 'Return filed on time'], [('XP', [5, 10, 10, 15, 25, 40])], [BRIGHT], title='XP earned per real action', horizontal=True, size=13.5, gap=45, ymax=48)
for i in range(7):
    h_ = 0.5 + i * 0.25; x = RX + 4.75 + i * 0.66; yb = B1Y + 3.2
    rect(s, x, yb - h_, 0.6, h_, [MID, '9FB9E0', '7DA0D6', BRIGHT, BLUE, NAVY, GOLD][i], shape=MSO_SHAPE.RECTANGLE)
    txt(s, x, yb - h_, 0.6, h_, [str(i + 1)], size=15, color=WHITE if i < 6 else NAVY, bold=True, anchor='m', align='c', margin=0)
txt(s, RX + 4.7, B1Y + 3.25, 4.75, 0.5, ['Levels 1→7: Starter, Tracker, Planner, Controller, Strategist, Finance Lead, CFO (0 → 2,400 XP)'], size=12.5, color=MUTED)
for i, t in enumerate(['Daily streaks', '4 daily quests', '11 badges', 'Goal ring', 'Scratch reward', 'Team leaderboard']):
    chip(s, RX + 4.75 + (i % 3) * 1.57, B1Y + 3.78 + (i // 3) * 0.36, 1.5, 0.32, t, fill=SOFTY, color=NAVY, size=12, line=GOLD)
panel(s, LX, B2Y, LW, B2H, 'Why the gamified approach is effective')
cyc = [('Trigger', 'alert, story card, streak at risk', 0.62, 7.45), ('Action', 'collect, pay, file, log', 3.12, 7.45), ('Investment', 'streak, goal ring, history', 0.62, 9.1), ('Reward', 'XP, scratch card, badge', 3.12, 9.1)]
for i, (t, d, x, y) in enumerate(cyc):
    box(s, x, y, 2.25, 1.35, [{'t': t, 'bold': True, 'size': 18, 'color': WHITE}, {'t': d, 'size': 13.5, 'color': 'E3ECFA'}], fill=[BLUE, BRIGHT, NAVY, GREEN][i], align='c', space=1)
arrow(s, 2.9, 8.12, 3.1, 8.12, color=NAVY, w=3.25); arrow(s, 4.25, 8.82, 4.25, 9.08, color=NAVY, w=3.25)
arrow(s, 3.1, 9.77, 2.9, 9.77, color=NAVY, w=3.25); arrow(s, 1.75, 9.08, 1.75, 8.82, color=NAVY, w=3.25)
txt(s, 5.5, 7.4, 4.25, 3.1, [
    'Points reward outcomes (on-time collection and filing), never screen time',
    'Variable reward (scratch card) and streaks build the daily habit that keeps the books current',
    'Evidence: most empirical studies reviewed by Hamari et al. (2014) report positive effects of gamification [7]'], size=16, bullet=True, space=8)
panel(s, RX, B2Y, RW, B2H, 'Differentiation from existing solutions')
Y_, N_, P_ = {'t': 'Yes', 'c': '0B6B4E', 'fill': SOFTG, 'a': 'c', 'b': True}, {'t': 'No', 'c': RED, 'fill': SOFTR, 'a': 'c'}, {'t': 'Partly', 'c': '8A6A00', 'fill': SOFTY, 'a': 'c'}
rows = [['Capability', 'Sheets', 'Accounting apps', 'Banking apps', 'This solution'],
        ['Proactive risk alerts', N_, P_, P_, Y_], ['GST credit check + filing calendar', N_, P_, N_, Y_], ['Approval workflow with roles', N_, P_, N_, Y_],
        ['Tamper-evident audit with reasons', N_, N_, N_, Y_], ['Habit loop (XP, streaks, rewards)', N_, N_, P_, Y_], ['Proof of benefit (Ghost Twin)', N_, N_, N_, Y_]]
table(s, RX + 0.15, B2Y + 0.75, RW - 0.3, rows, [3.2, 1.3, 1.75, 1.5, 1.5], 0.44, size=14.5, align=['l', 'c', 'c', 'c', 'c'])
src(s, 'Simulation: seed 42, engine in repo (crew accepts recommended action). XP values from the prototype. Comparison generalises typical tool categories. Ref [7]: Hamari, Koivisto & Sarsa, HICSS-47 (2014).')
notes(s, 'Innovation: Ghost Twin, Trust Dial, audit trail, DB-enforced control. Gamification ties points to real financial behaviour. Compare to sheets, accounting software and banking apps.')

# ============================================================ SLIDE 5 — TECHNOLOGY AND IMPLEMENTATION
s = S[4]; remove_shape(s, 'TextBox 5')
panel(s, 0.45, TOP, 19.1, 2.95, 'Tech stack')
stack = [('Frontend', BRIGHT, ['HTML5 · CSS3 · JS (ES modules)', 'SVG + Canvas charts', 'PWA + service worker', 'No framework, no build step']),
         ('Data & Auth', GREEN, ['Supabase PostgreSQL', 'Auth: email / magic link', 'Row-Level Security [8]', 'Realtime + SQL migrations']),
         ('Business engine', BLUE, ['GST: CGST/SGST/IGST, ITC', 'GSTIN checksum validator', 'Forecast, aging, alerts', 'XP, quests, bank CSV parser']),
         ('AI', 'B7791F', ['Groq API (Llama, GPT-OSS) [9]', 'Netlify Function proxy', 'Model + template fallback', 'Aggregate numbers only']),
         ('Trust & security', RED, ['SHA‑256 hash-chained log', 'Org roles enforced in DB', 'Domain-locked invites', 'No secrets in the browser']),
         ('DevOps & QA', NAVY, ['Netlify hosting + functions', 'Supabase CLI migrations', 'Node self-check suite', 'Playwright screenshots'])]
for i, (t, col, items) in enumerate(stack):
    x = 0.6 + i * 3.17
    rect(s, x, 2.72, 3.05, 2.1, LIGHT, MID, 1.0, rad=0.1)
    rect(s, x, 2.72, 3.05, 0.5, col, rad=0.1); rect(s, x, 2.97, 3.05, 0.25, col, shape=MSO_SHAPE.RECTANGLE)
    txt(s, x, 2.72, 3.05, 0.5, [t], size=17.5, color=WHITE, bold=True, anchor='m', align='c')
    txt(s, x + 0.05, 3.3, 2.95, 1.5, items, size=14.5, bullet=True, space=3)
RB = 5.05; RH = BOT - RB
panel(s, 0.45, RB, 8.6, RH, 'System architecture / workflow')
rect(s, 0.6, RB + 0.75, 3.55, 4.65, 'E8F0FC', BRIGHT, 1.5, rad=0.12)
txt(s, 0.65, RB + 0.78, 3.45, 0.42, ['Browser · PWA Finance Desk'], size=15.5, color=BLUE, bold=True, align='c', anchor='m')
for i, (t, d) in enumerate([('Views', 'Dashboard · Transactions · Approvals · Reports · Rewards · Audit · Team'), ('Engine', 'calc · gst · gamify · reports · bank · recurring'), ('Repo layer', 'cloud (Supabase) or demo (browser storage)')]):
    box(s, 0.72, RB + 1.25 + i * 1.38, 3.31, 1.3, [{'t': t, 'bold': True, 'size': 15.5, 'color': NAVY}, {'t': d, 'size': 13.5}], fill=WHITE, line=MID, align='l', space=1, rad=0.08)
rect(s, 5.1, RB + 0.75, 3.8, 3.3, SOFTG, GREEN, 1.5, rad=0.12)
txt(s, 5.15, RB + 0.78, 3.7, 0.42, ['Supabase'], size=15.5, color='0B6B4E', bold=True, align='c', anchor='m')
for t, d, y, h_ in [('Auth (JWT)', '', RB + 1.25, 0.6), ('Postgres + RLS', 'orgs · members · entries · parties · filings · xp · activity_log', RB + 1.95, 1.2), ('Realtime', 'live sync across devices', RB + 3.25, 0.7)]:
    box(s, 5.22, y, 3.56, h_, [{'t': t, 'bold': True, 'size': 14.5, 'color': NAVY}] + ([{'t': d, 'size': 13}] if d else []), fill=WHITE, line=MID, align='l', space=0, rad=0.08, margin=0.08)
box(s, 5.1, RB + 4.2, 1.8, 1.2, [{'t': 'Netlify Function', 'bold': True, 'size': 14, 'color': NAVY}, {'t': '/api/groq', 'size': 13}], fill=SOFTY, line=GOLD, align='c', space=0, rad=0.1)
box(s, 7.1, RB + 4.2, 1.8, 1.2, [{'t': 'Groq API', 'bold': True, 'size': 14, 'color': NAVY}, {'t': 'Llama · GPT-OSS', 'size': 13}], fill=SOFTY, line=GOLD, align='c', space=0, rad=0.1)
arrow(s, 4.15, RB + 2.35, 5.1, RB + 2.35, color=NAVY, w=2.75); txt(s, 4.1, RB + 1.95, 1.1, 0.35, ['HTTPS+JWT'], size=11.5, color=NAVY, bold=True, align='c', margin=0)
arrow(s, 5.1, RB + 3.6, 4.15, RB + 3.6, color=GREEN, w=2.75); txt(s, 4.1, RB + 3.64, 1.1, 0.35, ['Realtime'], size=11.5, color='0B6B4E', bold=True, align='c', margin=0)
arrow(s, 4.15, RB + 4.8, 5.1, RB + 4.8, color='B7791F', w=2.75); txt(s, 4.1, RB + 4.42, 1.1, 0.35, ['aggregates'], size=11.5, color='8A6A00', bold=True, align='c', margin=0)
arrow(s, 6.9, RB + 4.8, 7.1, RB + 4.8, color='B7791F', w=2.75)
panel(s, 9.2, RB, 4.8, RH, 'Implementation methodology')
phases = [('P0 · H0–2', 'Contracts frozen, repo and schema'), ('P1 · H2–6', 'Skeleton in 3 parallel tracks'), ('P2 · H6–11', 'Agents, GST, ledger, UI features'), ('P3 · H11–15', 'Integration, gamification polish'), ('P4 · H18–20', 'Hardening, deploy, self-checks'), ('P5 · H21–23', 'Pitch, demo video, submit')]
arrow(s, 9.62, RB + 1.05, 9.62, RB + 4.2, color=MID, w=3, head=False)
for i, (t, d) in enumerate(phases):
    y = RB + 0.75 + i * 0.62
    circle(s, 9.62, y + 0.33, 0.44, [BRIGHT, BRIGHT, BLUE, BLUE, NAVY, GREEN][i], str(i), 14)
    txt(s, 9.95, y, 3.95, 0.68, [[(t + '  ', {'bold': True, 'color': NAVY}), (d, {})]], size=14.5, anchor='m')
box(s, 9.35, RB + 4.6, 4.5, 0.8, ['3 tracks: Ram (engine · DB) · Sumit (UI) · Masoom (trust · content)'], fill=SOFTY, line=GOLD, size=13.5, color=NAVY, bold=True, align='c', space=0)
panel(s, 14.15, RB, 5.4, RH, 'Prototype / working model')
shot = crop(os.path.join(HERE, 'shots', 'dashboard.png'), os.path.join(HERE, 'shots', 'dash_crop.png'), 5.1 / 3.05)
pic = s.shapes.add_picture(shot, I(14.3), I(RB + 0.75), I(5.1), I(3.05)); pic.line.color.rgb = rgb(MID); pic.line.width = Pt(1.5)
txt(s, 14.25, RB + 3.9, 5.25, 1.55, ['Working today: 11 pages, 3 roles, 6 SQL migrations', 'Self-check suite passes (GST, ledger, reports, bank import, simulation)', 'Demo mode needs no keys; cloud mode uses Supabase'], size=14.5, bullet=True, space=3)
src(s, 'Refs: [8] Supabase docs (RLS, Auth, Realtime) · [9] Groq API docs. Screenshot: live prototype dashboard (demo data).')
notes(s, 'Tech: static PWA plus Supabase plus a tiny Netlify function for Groq. Architecture arrows show data flow. Methodology: phased, three parallel tracks, migrations first.')

# ============================================================ SLIDE 6 — IMPACTS AND FUTURE SCOPE
s = S[5]; remove_shape(s, 'TextBox 13')
C1Y, C1H, C2Y, C2H = TOP, 4.0, 6.15, 2.8
panel(s, LX, C1Y, LW, C1H, 'Expected impact')
days = [0] + [a[0] for a in SIM['crew']]
crew = {0: 100, **{a[0]: a[1] for a in SIM['crew']}}; ghost = {0: 100, **{a[0]: a[1] for a in SIM['ghost']}}
cd = CategoryChartData(); cd.categories = [f'D{d}' for d in days]
cd.add_series('With crew', [crew[d] for d in days]); cd.add_series('Unassisted twin', [ghost.get(d) for d in days])
gf = s.shapes.add_chart(XL_CHART_TYPE.LINE_MARKERS, I(LX + 0.1), I(C1Y + 0.68), I(5.1), I(3.25), cd); lc = gf.chart; style_chart(lc, 12.5)
lc.has_title = True; lc.chart_title.text_frame.text = 'Business health over 90 days (simulation)'; lc.chart_title.text_frame.paragraphs[0].runs[0].font.size = Pt(13.5); lc.chart_title.text_frame.paragraphs[0].runs[0].font.bold = True
lc.has_legend = True; lc.legend.position = XL_LEGEND_POSITION.BOTTOM; lc.legend.include_in_layout = False; lc.legend.font.size = Pt(12.5)
for ser, col in zip(lc.plots[0].series, [GREEN, RED]):
    ser.format.line.color.rgb = rgb(col); ser.format.line.width = Pt(3); ser.smooth = False
    ser.marker.style = XL_MARKER_STYLE.CIRCLE; ser.marker.size = 7; ser.marker.format.fill.solid(); ser.marker.format.fill.fore_color.rgb = rgb(col); ser.marker.format.line.color.rgb = rgb(col)
lc.value_axis.maximum_scale = 100; lc.value_axis.minimum_scale = 0; lc.value_axis.major_gridlines.format.line.color.rgb = rgb('E3E9F3'); lc.value_axis.tick_labels.font.size = Pt(12); lc.category_axis.tick_labels.font.size = Pt(12)
for i, (n, t, col) in enumerate([('8', 'Decent work & growth: protects payroll and cash so small firms keep jobs', 'A21942'), ('9', 'Industry & innovation: affordable digital finance rails for MSMEs', 'F36D25'), ('16', 'Strong institutions: audit trail, fraud defence, transparency', '00689D')]):
    y = C1Y + 0.72 + i * 1.08
    rect(s, LX + 5.35, y, 3.9, 1.0, col, rad=0.1)
    txt(s, LX + 5.38, y, 0.8, 1.0, [n], size=28, color=WHITE, bold=True, anchor='m', align='c')
    txt(s, LX + 6.15, y, 3.05, 1.0, ['SDG ' + n + ' · ' + t], size=13, color=WHITE, bold=True, anchor='m')
panel(s, RX, C1Y, RW, C1H, 'Benefits to users')
pers = [('Business owner', ['One daily view of cash, dues and risks', 'Less chasing, fewer penalties', 'Streak and goal ring make bookkeeping a habit'], BRIGHT), ('Finance team / CA', ['Clean registers and GST split, CSV export', 'Approvals and audit trail ready to review', 'Bank CSV reconcile cuts manual matching'], GREEN),
        ('Employees & team', ['Payroll never missed; clear approvals', 'XP and leaderboard build good habits', 'Role-based access: see only what you need'], BLUE), ('Customers & lenders', ['Timely, documented invoices and reminders', 'Verifiable records support credit decisions', 'WhatsApp-ready payment reminders'], 'B7791F')]
for i, (t, items, col) in enumerate(pers):
    x = RX + 0.15 + (i % 2) * 4.7; y = C1Y + 0.72 + (i // 2) * 1.65
    rect(s, x, y, 4.6, 1.57, LIGHT, MID, 1.0, rad=0.1); rect(s, x, y, 4.6, 0.46, col, rad=0.1); rect(s, x, y + 0.23, 4.6, 0.23, col, shape=MSO_SHAPE.RECTANGLE)
    txt(s, x + 0.08, y, 4.4, 0.46, [t], size=16.5, color=WHITE, bold=True, anchor='m')
    txt(s, x + 0.05, y + 0.5, 4.5, 1.07, items, size=14, bullet=True, space=1)
panel(s, LX, C2Y, LW, C2H, 'Scalability / feasibility')
bar_chart(s, LX + 0.1, C2Y + 0.66, 3.8, 2.1, ['MSMEs registered', 'GST taxpayers'], [('crore', [7.61, 1.51])], [BRIGHT], title='Addressable base (crore) [1][3]', size=12.5, point_colors=[BRIGHT, GREEN], fmt='0.00', ymax=9.5)
txt(s, LX + 4.0, C2Y + 0.68, 5.3, 2.1, ['Static PWA on a CDN plus managed Postgres: scales per tenant (org_id + RLS)', 'Multi-tenant by design: one workspace per company, invite codes, domain lock', 'Runs end to end on 6 versioned migrations; free tiers cover a pilot'], size=14, bullet=True, space=4)
panel(s, RX, C2Y, RW, C2H, 'Future enhancements')
fut = [('Next · 0–3 months', BRIGHT, ['Server-side XP (anti-cheat)', 'WhatsApp / email sending', 'Bank-statement templates', 'Offline sync for the PWA']), ('Later · 3–9 months', GREEN, ['Account Aggregator bank feed', 'E-invoice (IRN) and e-way bill', 'TDS, PF and ESI filings', 'Multi-GSTIN, multi-branch']), ('Vision', NAVY, ['ML late-payment prediction', 'Accountant portal, regional languages', 'On-chain anchor of ledger hash', 'Open API for ERP tools'])]
for i, (t, col, items) in enumerate(fut):
    x = RX + 0.15 + i * 3.13
    rect(s, x, C2Y + 0.7, 3.05, 1.98, LIGHT, MID, 1.0, rad=0.1)
    box(s, x, C2Y + 0.7, 3.05, 0.46, [t], fill=col, size=15, color=WHITE, bold=True, align='c', rad=0.1, space=0)
    txt(s, x + 0.04, C2Y + 1.2, 2.97, 1.5, items, size=13.5, bullet=True, space=1)
refs = ['[1] Ministry of MSME, Annual Report 2025-26: 7.61 cr registered MSMEs (31 Jan 2026). msme.gov.in', '[2] PIB, Udyami Diwas – MSME Day 2025: ~30% of GDP, >45% of exports. pib.gov.in', '[3] PIB, Eight Years of GST: 1.51 cr registrations; ₹22.08 lakh cr gross GST, FY25. pib.gov.in', '[4] RBI Annual Report 2024-25: bank frauds ₹36,014 cr, 23,953 cases (via Business Standard)',
        '[5] JPMorgan Chase Institute, "Cash Is King" (2016): median buffer 27 days; 25% hold ≤13', '[6] Income-tax Act s.43B(h), 45-day MSME payments from 1 Apr 2024; MSME Samadhaan, Apr 2024', '[7] Hamari, Koivisto & Sarsa (2014), "Does Gamification Work?", HICSS-47, doi:10.1109/HICSS.2014.377', '[8] Supabase docs: Row Level Security, Auth, Realtime. supabase.com/docs',
        '[9] Groq API docs: OpenAI-compatible chat completions. console.groq.com/docs', '[10] GST portal: GSTR-1 (11th) and GSTR-3B (20th) due dates. gst.gov.in', "[11] IFC estimate of India's MSME credit gap (₹20–25 lakh cr), as cited in industry reports", '[12] UN Sustainable Development Goals 8, 9, 16. sdgs.un.org/goals']
rect(s, 0.45, 9.05, 19.1, BOT - 9.05 + 0.4, 'F7F9FD', MID, 1.25, rad=0.1)
txt(s, 0.55, 9.08, 1.5, 0.3, ['References'], size=13, color=BLUE, bold=True)
for c in range(3):
    txt(s, 0.55 + c * 6.35, 9.35, 6.3, 1.65, refs[c * 4:(c + 1) * 4], size=11.5, color=TEXT, space=1)
notes(s, 'Impact: simulation shows the crew keeps health at 84 while the unassisted twin collapses by day 30. Targets are for a pilot. Future: server-side XP, bank feed, e-invoicing, ML.')

out = os.path.join(HERE, 'FinCrew_GameAThon26.pptx')
prs.save(out); print('saved', out)
