#!/usr/bin/env python3
"""Validate the canonical heading and summary of each extracted example."""
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.inside_main = False
        self.inside_heading = False
        self.main_count = 0
        self.headings = []
        self.main_text = []
        self.feed(html)
    def handle_starttag(self, tag, attrs):
        if tag == 'main':
            self.main_count += 1
            self.inside_main = True
        if tag == 'h1':
            self.inside_heading = True
            self.headings.append([])
    def handle_endtag(self, tag):
        if tag == 'main': self.inside_main = False
        if tag == 'h1': self.inside_heading = False
    def handle_data(self, data):
        if self.inside_main: self.main_text.append(data)
        if self.inside_heading: self.headings[-1].append(data)

def norm(text): return ' '.join(text.split())
root, catalog = Path(sys.argv[1]), json.loads(Path(sys.argv[2]).read_text())
pages = catalog.get('pages')
if not isinstance(pages, list) or len(pages) != 50 or len({p.get('id') for p in pages}) != 50:
    raise SystemExit('Expected 50 unique canonical examples')
for page in pages:
    identifier = page.get('id', '')
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', identifier):
        raise SystemExit('Invalid canonical example id')
    path = root / 'examples' / identifier / 'index.html'
    doc = Document(path.read_text())
    if doc.main_count != 1 or [norm(' '.join(h)) for h in doc.headings] != [norm(page['title'])]:
        raise SystemExit(f'{identifier}: canonical heading or main differs')
    if norm(page['summary']) not in norm(' '.join(doc.main_text)):
        raise SystemExit(f'{identifier}: canonical summary differs')
if not (root / 'examples/scientific-workspace/index.html').is_file():
    raise SystemExit('Experimental scientific workspace missing')
print('Checked 50 canonical headings and summaries and experimental science route.')
