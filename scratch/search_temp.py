import urllib.request
import urllib.parse
import re
import json

items = ['アケロンシールド', 'プライズパウダー', 'エミネンス・レコード', 'ユニティ・コンコード', 'クリスタル']
results = {}

for item in items:
    try:
        q = urllib.parse.quote(item.encode('euc-jp'))
        url = f'https://wiki.ffo.jp/wiki.cgi?Command=Search&Wiki=FF11&q={q}'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('euc-jp', errors='ignore')
            match = re.search(r'href="(/html/\d+\.html)">([^<]*' + re.escape(item) + r'[^<]*)</a>', html)
            if match:
                results[item] = 'https://wiki.ffo.jp' + match.group(1)
            else:
                match_direct = re.search(r'<title>(.*)/FF11用語辞典</title>', html)
                if match_direct and item in match_direct.group(1):
                    res_url = response.geturl()
                    if 'html/' in res_url:
                        results[item] = res_url
    except Exception as e:
        print(f"Error {item}: {e}")

print(json.dumps(results, ensure_ascii=False, indent=2))
