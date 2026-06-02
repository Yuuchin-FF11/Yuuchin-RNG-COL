import os
import re
import sys
import requests
import time
from html.parser import HTMLParser

class TagValidator(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.errors = []
        self.self_closing = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def handle_starttag(self, tag, attrs):
        if tag not in self.self_closing:
            self.stack.append((tag, self.getpos()))

    def handle_endtag(self, tag):
        if tag in self.self_closing:
            return
        if not self.stack:
            self.errors.append(f"Unexpected closing tag </{tag}> at line {self.getpos()[0]}")
            return
        last_tag, pos = self.stack.pop()
        if last_tag != tag:
            self.errors.append(f"Mismatched tag: expected </{last_tag}> (from line {pos[0]}), but found </{tag}> at line {self.getpos()[0]}")

def check_html(filepath):
    print(f"Checking HTML: {filepath}...")
    if not os.path.exists(filepath):
        return [f"File not found: {filepath}"]
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    validator = TagValidator()
    validator.feed(content)
    if validator.stack:
        for tag, pos in validator.stack:
            validator.errors.append(f"Unclosed tag <{tag}> from line {pos[0]}")
    return validator.errors

def check_md_links(base_dir):
    print(f"Checking Markdown links in {base_dir}...")
    errors = []
    if not os.path.exists(base_dir):
        return [f"Directory not found: {base_dir}"]
    md_files = [f for f in os.listdir(base_dir) if f.endswith('.md')]
    for md in md_files:
        filepath = os.path.join(base_dir, md)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        # Find article.html?file=... links
        links = re.findall(r'article\.html\?file=([^)\"\'\s>]+)', content)
        for link in links:
            # normalize link
            clean_link = link.split('#')[0]
            target_path = os.path.join(os.getcwd(), clean_link)
            if not os.path.exists(target_path):
                errors.append(f"Broken link in {md}: {clean_link} (file not found)")
    return errors

def verify_deployment(url, expected_text, timeout=300):
    print(f"Verifying deployment at {url} (waiting for '{expected_text}')...")
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            r = requests.get(url, timeout=10)
            # Use a session or avoid cache if possible?
            # For GitHub Pages, it's server-side, so just fetching is enough
            if r.ok and expected_text in r.text:
                print("✓ Deployment confirmed!")
                return True
        except Exception as e:
            pass
        print(f"Waiting for reflect... ({int(time.time() - start_time)}s elapsed)")
        time.sleep(30)
    print("X Deployment verification timed out.")
    return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python dev_toolkit.py [html|links|deploy]")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "html":
        errs = check_html('index.html') + check_html('article.html')
        if errs:
            print("\n".join(errs))
            sys.exit(1)
        print("✓ HTML tags are clean!")
    elif cmd == "links":
        errs = check_md_links('articles')
        if errs:
            print("\n".join(errs))
            sys.exit(1)
        print("✓ All internal links are valid!")
    elif cmd == "deploy":
        if len(sys.argv) < 4:
            print("Usage: python dev_toolkit.py deploy [url] [text]")
            sys.exit(1)
        if not verify_deployment(sys.argv[2], sys.argv[3]):
            sys.exit(1)
