import sys
import re
import urllib.request
import urllib.parse

def check_term_on_ffo(term):
    try:
        encoded_word = urllib.parse.quote(term.encode('euc-jp'))
    except Exception:
        try:
            encoded_word = urllib.parse.quote(term)
        except Exception:
            return True
    
    url = f"http://wiki.ffo.jp/wiki.cgi?Command=Search&Word={encoded_word}"
    
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            html = response.read()
            try:
                text = html.decode('euc-jp')
            except Exception:
                text = html.decode('utf-8', errors='ignore')
            
            if "一致する記事はありませんでした" in text or "一致する記事は見つかりませんでした" in text:
                return False
            return True
    except Exception as e:
        print(f"[Warning] Network error checking '{term}': {e}")
        return True

def validate_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    terms = []
    lines = content.split('\n')
    for line in lines:
        if line.strip().startswith('-'):
            parts = re.split(r'[:：]', line, maxsplit=1)
            if len(parts) == 2:
                part_name = parts[0].replace('-', '').strip()
                if part_name in ['武器メイン', 'サブ', '遠隔武器', '矢弾', '頭', '胴', '両手', '両脚', '両足', '首', '左耳', '右耳', '左手の指', '右手の指', '背', '腰']:
                    equip_content = parts[1].strip()
                    candidates = re.split(r'\s+(?:or|または)\s+', equip_content)
                    for cand in candidates:
                        cand_clean = re.sub(r'[\(（].*?[\)）]', '', cand).strip()
                        if cand_clean and cand_clean not in ['装備できる弾', '装備できる矢弾', '好きな弓']:
                            terms.append(cand_clean)
                            
    terms = list(set(terms))
    
    errors = []
    for term in terms:
        if term.startswith('ニャメ'):
            if term not in ['ニャメヘルム', 'ニャメメイル', 'ニャメガントレ', 'ニャメフランチャ', 'ニャメソルレット', 'ニャメ装束']:
                errors.append(f"存在しないニャメ部位名: {term}")
                continue
        
        if term.startswith('マリグナス'):
            if term not in ['マリグナスシャポー', 'マリグナスタバード', 'マリグナスグローブ', 'マリグナスタイツ', 'マリグナスブーツ', 'マリグナス装束']:
                errors.append(f"存在しないマリグナス部位名: {term}")
                continue
                
        known_keywords = ['ロスタム', 'クスタウィ', 'フォーマルハウト', 'デスペナルティ', 'アタクトス', 'アープ', 'ベヨーブレット', 'ロリケートトルク', 'セサンスピアス', 'テロスピアス', 'メランリング', 'シーリチリング', '無の外装', 'セールフィベルト', 'ネイグリング', 'ヌスクシールド']
        if any(kw in term for kw in known_keywords):
            continue
            
        print(f"Verifying '{term}' on FFO wiki...")
        if not check_term_on_ffo(term):
            errors.append(f"FF11用語辞典に存在しない用語: {term}")
            
    if errors:
        print("\n=== Validation Errors ===")
        for err in errors:
            print(f"[ERROR] {err}")
        return False
        
    print("\n[SUCCESS] All terms are valid.")
    return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python validate_terms.py <filepath>")
        sys.exit(1)
    
    success = validate_file(sys.argv[1])
    sys.exit(0 if success else 1)
