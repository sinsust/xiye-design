import re, shutil, os
from html.parser import HTMLParser

SRC = 'D:/workspace/wexo'
OUT = 'D:/workspace/xiye/public/originkit/wexo'
os.makedirs(OUT + '/images', exist_ok=True)
os.makedirs(OUT + '/fonts', exist_ok=True)

html = open(SRC + '/index.html', encoding='utf-8').read()

# 1. framer.css (已存在则跳过重写，避免只读锁冲突)
styles = re.findall(r'<style[^>]*data-framer-[^>]*>.*?</style>', html, re.S)
css = '\n'.join(re.sub(r'</?style[^>]*>', '', s) for s in styles)
fcss = OUT + '/framer.css'
if not os.path.exists(fcss):
    open(fcss, 'w', encoding='utf-8').write(css)
    print('framer.css written, bytes:', len(css))
else:
    print('framer.css exists, skip rewrite')

# 2. images / fonts (已存在则跳过，避免覆盖只读文件报错)
def copy_tree_if_needed(src, dst):
    if not os.path.exists(src):
        print('skip (no src):', src)
        return
    os.makedirs(dst, exist_ok=True)
    for root, _, files in os.walk(src):
        rel = os.path.relpath(root, src)
        td = os.path.join(dst, rel) if rel != '.' else dst
        os.makedirs(td, exist_ok=True)
        for f in files:
            s = os.path.join(root, f)
            t = os.path.join(td, f)
            try:
                if os.path.exists(t) and os.path.getsize(t) > 0:
                    continue  # 已存在且非空，跳过（多为只读锁，无需覆盖）
                shutil.copy2(s, t)
            except Exception as e:
                print('copy warn:', s, '->', t, '|', repr(e))
    print('copied:', src)

copy_tree_if_needed(SRC + '/images', OUT + '/images')
copy_tree_if_needed(SRC + '/fonts', OUT + '/fonts')

# 3. build tree
VOID = {'img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr'}

class Node:
    def __init__(self, tag=None, attrs=None, parent=None):
        self.tag = tag
        self.attrs = attrs or []
        self.parent = parent
        self.children = []
        self.text = ''
    def attr(self, name):
        for k, v in self.attrs:
            if k == name:
                return v
        return None

class Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            n = Node(tag, attrs, self.stack[-1])
            self.stack[-1].children.append(n)
            return
        n = Node(tag, attrs, self.stack[-1])
        self.stack[-1].children.append(n)
        self.stack.append(n)
    def handle_endtag(self, tag):
        if tag in VOID:
            return
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                break
    def handle_data(self, data):
        self.stack[-1].text += data

b = Builder()
b.feed(html)
root = b.root

def find_all(n, name, res):
    if n.attr('data-framer-name') == name:
        res.append(n)
    for c in n.children:
        find_all(c, name, res)

def ancestors(n):
    a = []
    p = n.parent
    while p and p.tag is not None:
        a.append(p)
        p = p.parent
    return a

def serialize(n):
    if n.tag is None:
        return ''.join(serialize(c) for c in n.children)
    attrs = ''.join(f' {k}="{v}"' for k, v in n.attrs)
    if n.tag in VOID:
        return f'<{n.tag}{attrs}>'
    inner = n.text + ''.join(serialize(c) for c in n.children)
    return f'<{n.tag}{attrs}>{inner}</{n.tag}>'

hero_res, po_res = [], []
find_all(root, 'Hero', hero_res)
find_all(root, 'Product Overview', po_res)
hero, po = hero_res, po_res
print('hero nodes:', len(hero), 'po nodes:', len(po))
if not hero:
    print('NO HERO')
    raise SystemExit(1)
h = hero[0]
ha = ancestors(h)
pa = ancestors(po[0]) if po else []
lca = None
for x, y in zip(reversed(ha), reversed(pa)):
    if x is y:
        lca = x
    else:
        break
print('lca tag:', lca.tag if lca else None, 'lca name:', lca.attr('data-framer-name') if lca else None)
hi = ha.index(lca) if lca in ha else -1
block = ha[hi + 1] if hi + 1 < len(ha) else h
print('block tag:', block.tag, 'block name:', block.attr('data-framer-name'))

body = serialize(block).replace('images/', '/originkit/wexo/images/')
out = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<link rel="stylesheet" href="/originkit/wexo/framer.css">
<style>:root{{--wexo-accent: rgb(27,30,33)}} body{{margin:0}}</style>
</head>
<body>
<div class="wexo-root">{body}</div>
</body>
</html>'''
open(OUT + '/wexo-hero.html', 'w', encoding='utf-8').write(out)
print('hero.html bytes:', len(out), '-> /originkit/wexo/wexo-hero.html')
