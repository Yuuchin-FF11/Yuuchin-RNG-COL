import os
import re
import sys
import urllib.request
import urllib.parse

# FFXI 用語辞典ドメイン
WIKI_DOMAIN = "wiki.ffo.jp"

def check_url(url, expected_title=None):
    try:
        # 規制を避けるため、標準的なブラウザのUser-Agentを設定
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status != 200:
                return False, f"HTTP Status {response.status}"
            
            html = response.read().decode('utf-8', errors='ignore')
            
            # タイトルタグの抽出
            title_match = re.search(r'<title>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
            if title_match:
                title = title_match.group(1).strip()
                if expected_title:
                    # タイトルに期待されるキーワードが含まれているかチェック
                    if expected_title in title:
                        return True, f"OK: {title}"
                    else:
                        return False, f"Title Mismatch: Expected '{expected_title}' in '{title}'"
                return True, f"OK: {title}"
            return True, "OK (No Title Tag found)"
    except Exception as e:
        return False, str(e)

def validate_links(filepath):
    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}")
        return

    print(f"--- 用語辞典リンク自動検証を開始します: {os.path.basename(filepath)} ---")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Markdownリンクの正規表現 [テキスト](URL)
    links = re.findall(r'\[([^\]]+)\]\((https?://[^\)]+)\)', content)
    
    total = len(links)
    success = 0
    
    print(f"検出されたリンク総数: {total}件\n")
    
    for text, url in links:
        if WIKI_DOMAIN in url:
            print(f"検証中: 【{text}】 -> {url}")
            ok, msg = check_url(url, text)
            if ok:
                print(f"  └ [OK] {msg}")
                success += 1
            else:
                print(f"  └ [FAIL] 検証失敗: {msg}")
        else:
            print(f"検証中 (外部リンク): {url}")
            ok, msg = check_url(url)
            if ok:
                print(f"  └ [OK] {msg}")
                success += 1
            else:
                print(f"  └ [FAIL] 疎通失敗: {msg}")

    print(f"\n--- 検証完了: 成功 {success} / 全体 {total} 件 ---")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python link_validator.py <path_to_markdown_file>")
    else:
        validate_links(sys.argv[1])
