import urllib.request
import urllib.parse
import re
import json

items = [
    'ネイグリング', 'グレティナイフ', 'アチピテール', 'ベヨーアロー', '無の面', 
    'アデマジャケット', 'マリグナスグローブ', 'アミニブラーグ', 'マリグナスブーツ', 
    'カラクトチョーカー', '素破の耳', 'シェリダピアス', 'メランリング', 
    'シーリチリング', 'ベレナスケープ', 'セールフィベルト'
]

results = {}

for item in items:
    try:
        q = urllib.parse.quote(item.encode('euc-jp'))
        url = f'http://wiki.ffo.jp/wiki.cgi?Command=Search&Wiki=FF11&q={q}'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('euc-jp', errors='ignore')
            
            # Check for redirect to static page
            res_url = response.geturl()
            if 'html/' in res_url:
                results[item] = res_url
                continue
                
            # Else search results
            match = re.search(r'href="(/html/\d+\.html)">([^<]*' + re.escape(item) + r'[^<]*)</a>', html)
            if match:
                results[item] = 'http://wiki.ffo.jp' + match.group(1)
            else:
                # Direct redirect title check
                match_direct = re.search(r'<title>(.*)/FF11用語辞典</title>', html)
                if match_direct and item in match_direct.group(1):
                    if 'html/' in res_url:
                        results[item] = res_url
    except Exception as e:
        results[item] = f"Error: {str(e)}"

print(json.dumps(results, ensure_ascii=False, indent=2))
