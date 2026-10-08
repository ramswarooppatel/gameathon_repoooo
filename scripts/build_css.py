"""Bundles + minifies the app stylesheets into app/bundle.min.css (one request instead of six).
Run after editing any CSS:  python scripts/build_css.py     (also: npm run build:css)"""
import os, re, gzip
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDER = ['app.css', 'components.css', 'theme-light.generated.css', 'theme.css', 'workflow.css', 'apple.css', 'ui4.css']

def minify(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'\s+', ' ', css)
    css = re.sub(r'\s*([{};,>])\s*', r'\1', css)              # keep spaces around ':' (selectors like "a :hover" and values)
    css = re.sub(r':\s+', ':', css) if False else css
    css = re.sub(r';}', '}', css)
    return css.strip()

parts = []
for n in ORDER:
    parts.append(open(os.path.join(ROOT, 'app', n), encoding='utf8').read())
raw = '\n'.join(parts); out = minify(raw)
path = os.path.join(ROOT, 'app', 'bundle.min.css'); open(path, 'w', encoding='utf8').write(out)
print(f'bundle.min.css: {len(raw) // 1024} KB source -> {len(out) // 1024} KB minified -> {len(gzip.compress(out.encode())) // 1024} KB gzip')
