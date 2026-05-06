import urllib.request
import urllib.parse
import re
import json
import time

items = [
    'クスタウィ', 'フォーマルハウト', 'ベヨーブレット', '王将の首飾り', 'オノワイヤリング', 
    'メランリング', '守りの指輪', 'ルザフリング', 'カムラスマント', 'キャリアーサッシュ', 
    'クロノブレット', 'コモドアチャーム', '昏黄の耳飾り', 'テロスピアス', 'カコエシクリング', 
    'ヘイパスリング', 'インパルスベルト', 'イシュクターバン', 'イスクルゴルゲット', '昏黄の指輪', 
    'イフラマドリング', 'フォシャベルト', 'ベイラピアス', 'カフカチナベルト', 'ライヴブレット', 
    '妖蟲の髪飾り', '胡蝶のイヤリング', 'フリオミシピアス', 'アルコンリング', 'ディンジルリング', 
    'オルフェウスサッシュ', 'エパミノダスリング', '八輪の帯', 'クレパスクラナイフ', '無の面', 
    'カラクトチョーカー', '素破の耳', 'シーリチリング', 'セールフィベルト', 'ネイグリング', 
    'グレティナイフ', 'アタクトス', '無の喉輪', '共和プラチナ章', 'エアバニピアス', '霊亀腰帯',
    'オレリアサッシュ', 'オルペウスサッシュ'
]

results = {}

for item in items:
    try:
        q = urllib.parse.quote(item.encode('euc-jp'))
        url = f'http://wiki.ffo.jp/wiki.cgi?Command=Search&Wiki=FF11&q={q}'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            html = response.read().decode('euc-jp', errors='ignore')
            
            # The search results often have something like <a href="/html/37235.html">ロスタム</a>
            match = re.search(r'href="(/html/\d+\.html)">([^<]*' + re.escape(item) + r'[^<]*)</a>', html)
            if match:
                results[item] = 'http://wiki.ffo.jp' + match.group(1)
            else:
                # Direct redirect?
                match_direct = re.search(r'<title>(.*)/FF11用語辞典</title>', html)
                if match_direct and item in match_direct.group(1):
                    res_url = response.geturl()
                    if 'html/' in res_url:
                        results[item] = res_url
    except Exception as e:
        pass

print(json.dumps(results, ensure_ascii=False, indent=2))
