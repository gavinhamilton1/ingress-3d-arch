"""Bundle a FlowKit scene page into one self-contained HTML file (works offline).
Usage: python3 build.py ingress.html dist/ingress-journeys.html
"""
import re, sys, pathlib
src, out = sys.argv[1], sys.argv[2]
root = pathlib.Path(src).parent
html = pathlib.Path(src).read_text()
read = lambda p: (root / p).read_text()
html = html.replace('<link rel="stylesheet" href="flowkit.css">', '<style>\n' + read('flowkit.css') + '\n</style>')
html = re.sub(r'<!--ANIME-->.*?<!--/ANIME-->', lambda m: '<script>\n' + read('vendor/anime.umd.min.js') + '\n</script>', html, flags=re.S)
def inline(tag):
    global html
    m = re.search(rf'<!--{tag}--><script src="([^"]+)"></script><!--/{tag}-->', html)
    html = html.replace(m.group(0), '<script>\n' + read(m.group(1)) + '\n</script>')
inline('KIT'); inline('SCENE')
pathlib.Path(out).parent.mkdir(parents=True, exist_ok=True)
pathlib.Path(out).write_text(html)
print(out, len(html) // 1024, 'KB')
