# -*- coding: utf-8 -*-
import os
import sys
import traceback
import webbrowser

# コンソールなし実行時のクラッシュログ書き出しフック
def handle_exception(exc_type, exc_value, exc_traceback):
    try:
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(os.path.abspath(sys.executable))
        else:
            base_dir = os.path.dirname(os.path.abspath(__file__))
        log_path = os.path.join(base_dir, "crash_log.txt")
        with open(log_path, "w", encoding="utf-8") as f:
            traceback.print_exception(exc_type, exc_value, exc_traceback, file=f)
    except Exception:
        pass

sys.excepthook = handle_exception

# Windowsで--noconsoleでEXE化した際のsys.stdoutのNoneErrorを防止
class SafeNullWriter:
    def write(self, *args, **kwargs): pass
    def flush(self, *args, **kwargs): pass
    def isatty(self, *args, **kwargs): return False
    def fileno(self, *args, **kwargs): return -1

try:
    if sys.stdout is None or not hasattr(sys.stdout, 'write'):
        sys.stdout = SafeNullWriter()
    if sys.stderr is None or not hasattr(sys.stderr, 'write'):
        sys.stderr = SafeNullWriter()
except Exception:
    pass

import time
import json
import re
import csv
import http.server
import socketserver
import threading
import traceback

PORT = 8081
if getattr(sys, 'frozen', False):
    APP_DIR = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(sys.executable)))
    DATA_DIR = os.path.dirname(os.path.abspath(sys.executable))
else:
    APP_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = APP_DIR

WHITELIST_FILE = os.path.join(DATA_DIR, "custom_whitelist.json")
WATCH_DIR = os.path.join(DATA_DIR, "monitor_files")
HTML_FILE_PATH = os.path.join(APP_DIR, "AIハルシネーションスキャナー起動.html")
if not os.path.exists(HTML_FILE_PATH):
    HTML_FILE_PATH = os.path.join(DATA_DIR, "AIハルシネーションスキャナー起動.html")

ACTUAL_PORT = 8081

# 監視フォルダの自動作成
if not os.path.exists(WATCH_DIR):
    os.makedirs(WATCH_DIR)

# 標準的な組み込み関数・予約語（誤検知防止のためのホワイトリスト）
BUILTIN_FUNCTIONS = {
    # JavaScript 組み込み
    "console.log", "console.error", "console.warn", "alert", "prompt", "confirm",
    "parseInt", "parseFloat", "isNaN", "isFinite", "encodeProgram", "decodeProgram",
    "encodeURIComponent", "decodeURIComponent", "setTimeout", "clearTimeout",
    "setInterval", "clearInterval", "fetch", "Promise", "resolve", "reject",
    "map", "filter", "reduce", "forEach", "find", "findIndex", "push", "pop",
    "shift", "unshift", "splice", "slice", "split", "join", "replace", "replaceAll",
    "toLowerCase", "toUpperCase", "trim", "includes", "startsWith", "endsWith",
    "indexOf", "lastIndexOf", "JSON.stringify", "JSON.parse", "Math.abs", "Math.ceil",
    "Math.floor", "Math.round", "Math.max", "Math.min", "Math.random", "Math.pow",
    "Math.sqrt", "Object.keys", "Object.values", "Object.entries", "Object.assign",
    "document.getElementById", "document.querySelector", "document.querySelectorAll",
    "document.createElement", "window.location", "window.addEventListener",
    "localStorage.getItem", "localStorage.setItem", "localStorage.removeItem",
    "e.preventDefault", "event.preventDefault", "console.dir", "toString",
    "String", "Number", "Boolean", "Array", "Object", "Date", "RegExp", "Error",
    
    # Python 組み込み
    "print", "len", "range", "str", "int", "float", "list", "dict", "set", "tuple",
    "open", "type", "abs", "max", "min", "sum", "sorted", "reversed", "enumerate",
    "zip", "map", "filter", "any", "all", "isinstance", "issubclass", "callable",
    "dir", "vars", "eval", "exec", "globals", "locals", "round", "pow", "divmod"
}

def load_custom_whitelist():
    """カスタム除外リストをJSONファイルから読み込む"""
    if os.path.exists(WHITELIST_FILE):
        try:
            with open(WHITELIST_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_custom_whitelist(whitelist_set):
    """カスタム除外リストをJSONファイルに保存する"""
    try:
        with open(WHITELIST_FILE, "w", encoding="utf-8") as f:
            json.dump(list(whitelist_set), f, indent=4, ensure_ascii=False)
        return True
    except Exception:
        return False

def extract_defined_functions(code, ext):
    """コード内から定義されている関数名・クラス名・メソッド名を抽出する"""
    defined = set()
    lines = code.splitlines()
    
    if ext in (".js", ".html"):
        func_pattern = re.compile(r"\bfunction\s+([a-zA-Z0-9_$]+)\s*\(")
        arrow_pattern1 = re.compile(r"(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>")
        arrow_pattern2 = re.compile(r"(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?function\s*\(")
        class_pattern = re.compile(r"\bclass\s+([a-zA-Z0-9_$]+)")
        # クラスメソッドやオブジェクト短縮構文: async myMethod() { または myMethod() {
        method_pattern = re.compile(r"(?:^|[;{}])\s*(?:async\s+)?([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{")
        # オブジェクトプロパティ関数: myMethod: function() { または myMethod: () =>
        prop_func_pattern = re.compile(r"([a-zA-Z0-9_$]+)\s*:\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)")
        
        js_keywords = {"if", "for", "while", "switch", "catch", "function", "constructor", "return", "class", "get", "set"}
        
        for line in lines:
            trimmed = line.strip()
            if trimmed.startswith("//") or trimmed.startswith("/*") or trimmed.startswith("*"):
                continue
            
            for m in func_pattern.finditer(line):
                defined.add(m.group(1))
            for m in arrow_pattern1.finditer(line):
                defined.add(m.group(1))
            for m in arrow_pattern2.finditer(line):
                defined.add(m.group(1))
            for m in class_pattern.finditer(line):
                defined.add(m.group(1))
            for m in method_pattern.finditer(line):
                if m.group(1) not in js_keywords:
                    defined.add(m.group(1))
            for m in prop_func_pattern.finditer(line):
                if m.group(1) not in js_keywords:
                    defined.add(m.group(1))
    
    elif ext == ".py":
        def_pattern = re.compile(r"\bdef\s+([a-zA-Z0-9_]+)\s*\(")
        class_pattern = re.compile(r"\bclass\s+([a-zA-Z0-9_]+)")
        for line in lines:
            trimmed = line.strip()
            if trimmed.startswith("#"):
                continue
            for m in def_pattern.finditer(line):
                defined.add(m.group(1))
            for m in class_pattern.finditer(line):
                defined.add(m.group(1))
                
    return defined

def extract_called_functions(code, ext, custom_whitelist):
    """コード内から呼び出されている関数名とその行番号を抽出する"""
    called = []
    lines = code.splitlines()
    
    exclude_keywords = {"if", "for", "while", "switch", "catch", "function", "def", "return", "class", "await", "new", "else"}
    call_pattern = re.compile(r"\b([a-zA-Z0-9_$.]+)\s*\(")
    
    all_whitelist = BUILTIN_FUNCTIONS.union(custom_whitelist)
    
    for i, line in enumerate(lines):
        line_num = i + 1
        trimmed = line.strip()
        if trimmed.startswith("//") or trimmed.startswith("/*") or trimmed.startswith("*") or trimmed.startswith("#"):
            continue
            
        for m in call_pattern.finditer(line):
            name = m.group(1)
            if name in exclude_keywords:
                continue
            
            base_name = name.split(".")[-1]
            if name in all_whitelist or base_name in all_whitelist:
                continue
                
            if re.match(r"^\d", name):
                continue
                
            called.append((name, line_num))
            
    return called

def analyze_hallucinations(before_code, after_code, filename):
    """BeforeとAfterのコードを比較して、ハルシネーション（架空の関数呼び出し）を検出する"""
    ext = os.path.splitext(filename)[1].lower()
    
    custom_whitelist = load_custom_whitelist()
    before_defs = extract_defined_functions(before_code, ext)
    after_defs = extract_defined_functions(after_code, ext)
    after_calls = extract_called_functions(after_code, ext, custom_whitelist)
    
    hallucinations = []
    seen = set()
    
    for name, line in after_calls:
        base_name = name.split(".")[-1]
        # 完全一致またはベース名（this.method()等のメソッド名）が定義にあれば正常と判定
        is_defined = (name in before_defs or name in after_defs or
                      base_name in before_defs or base_name in after_defs)
        if not is_defined and name not in seen:
            seen.add(name)
            hallucinations.append({
                "name": name,
                "line": line,
                "detail": "この関数はプログラム内のどこにも定義されていません。"
            })
            
    score = max(0, 100 - len(hallucinations) * 15)
    return hallucinations, score


# =====================================================================
# ステップ３：データ数値検証エンジン（精密クロス集計・内訳突合）
# =====================================================================

def parse_csv_to_dict_list(csv_text):
    """CSVテキストを辞書のリストに変換する。ヘッダーの揺らぎを吸収。"""
    lines = csv_text.strip().splitlines()
    if not lines:
        return []
        
    reader = csv.reader(lines)
    headers = [h.strip() for h in next(reader)]
    
    result = []
    for row in reader:
        if not row:
            continue
        row_dict = {}
        for i, val in enumerate(row):
            if i < len(headers):
                row_dict[headers[i]] = val.strip()
            else:
                row_dict[f"column_{i}"] = val.strip()
        result.append(row_dict)
    return result

def extract_all_numbers(data_structure):
    """JSONや辞書リストなどのあらゆるデータ構造から数値を再帰的に抽出して合計する"""
    total = 0.0
    
    if isinstance(data_structure, dict):
        for k, v in data_structure.items():
            if k in ("total_sales", "total", "sum", "grand_total"):
                continue
            total += extract_all_numbers(v)
    elif isinstance(data_structure, list):
        for item in data_structure:
            total += extract_all_numbers(item)
    elif isinstance(data_structure, (int, float)):
        total += float(data_structure)
    elif isinstance(data_structure, str):
        clean_str = re.sub(r"[^\d.-]", "", data_structure)
        if clean_str:
            try:
                total += float(clean_str)
            except ValueError:
                pass
    return total

def find_date_fields(row_dict):
    """辞書行から日付と思われる値を取り出す"""
    if not isinstance(row_dict, dict):
        return None
    date_patterns = [
        re.compile(r"\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?"),
        re.compile(r"\d{1,2}[-/月]\d{1,2}日?")
    ]
    for k, v in row_dict.items():
        v_str = str(v)
        for pat in date_patterns:
            if pat.search(v_str):
                return v_str
    return None

def find_category_fields(row_dict):
    """辞書行から店舗名・商品名・カテゴリと思われる値を取り出す"""
    if not isinstance(row_dict, dict):
        return None
    for k, v in row_dict.items():
        if any(x in k for x in ["店舗", "商品", "区分", "カテゴリ", "項目", "category", "item", "store", "name"]):
            return str(v)
    return None

def find_numeric_value(row_dict):
    """辞書行から売上・数値と思われる値を取り出す"""
    if not isinstance(row_dict, dict):
        return 0.0
    for k, v in row_dict.items():
        if any(x in k for x in ["売上", "金額", "価格", "数量", "合計", "total", "amount", "price", "count", "sales"]):
            if isinstance(v, (int, float)):
                return float(v)
            clean_v = re.sub(r"[^\d.-]", "", str(v))
            if clean_v:
                try:
                    return float(clean_v)
                except ValueError:
                    pass
    return 0.0

def is_valid_date(date_str):
    """日付文字列が現実的にあり得るか検証する（簡易チェック）"""
    m_ymd = re.search(r"(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})", date_str)
    m_md = re.search(r"(\d{1,2})[-/月](\d{1,2})", date_str)
    
    month, day = None, None
    if m_ymd:
        month = int(m_ymd.group(2))
        day = int(m_ymd.group(3))
    elif m_md:
        month = int(m_md.group(1))
        day = int(m_md.group(2))
        
    if month is not None and day is not None:
        if month < 1 or month > 12:
            return False
        if day < 1 or day > 31:
            return False
        if month == 2 and day > 29:
            return False
        if month in (4, 6, 9, 11) and day > 30:
            return False
            
    return True

def analyze_data_hallucinations(original_csv_text, ai_result_text, filename):
    """元のCSVとAI集計結果（JSONかCSV）を読み込んで数値の嘘や捏造データを検出する"""
    hallucinations = []
    
    orig_rows = parse_csv_to_dict_list(original_csv_text)
    orig_total = 0.0
    orig_dates = set()
    orig_categories = set()
    
    orig_detail_map = {}
    
    for row in orig_rows:
        date_val = find_date_fields(row)
        cat_val = find_category_fields(row)
        val = find_numeric_value(row)
        
        if date_val:
            orig_dates.add(date_val)
        if cat_val:
            orig_categories.add(cat_val)
            
        orig_total += val
        
        if date_val and cat_val:
            key = (date_val, cat_val)
            orig_detail_map[key] = orig_detail_map.get(key, 0.0) + val

    ai_total = 0.0
    ai_dates = set()
    ai_categories = set()
    ai_detail_map = {}
    
    try:
        ai_data = json.loads(ai_result_text)
        
        if isinstance(ai_data, dict):
            for k in ("total_sales", "total", "sum", "grand_total"):
                if k in ai_data:
                    try:
                        ai_total = float(re.sub(r"[^\d.-]", "", str(ai_data[k])))
                        break
                    except ValueError:
                        pass
            if ai_total == 0.0:
                ai_total = extract_all_numbers(ai_data)
        else:
            ai_total = extract_all_numbers(ai_data)
        
        def collect_details_from_json(item):
            if isinstance(item, dict):
                date_val = find_date_fields(item)
                cat_val = find_category_fields(item)
                val = find_numeric_value(item)
                
                if date_val:
                    ai_dates.add(date_val)
                if cat_val:
                    ai_categories.add(cat_val)
                
                if date_val and cat_val:
                    key = (date_val, cat_val)
                    ai_detail_map[key] = ai_detail_map.get(key, 0.0) + val
                else:
                    for k, v in item.items():
                        if k not in ("total_sales", "total", "sum", "grand_total"):
                            collect_details_from_json(v)
            elif isinstance(item, list):
                for x in item:
                    collect_details_from_json(x)
                    
        collect_details_from_json(ai_data)
        
    except json.JSONDecodeError:
        ai_rows = parse_csv_to_dict_list(ai_result_text)
        for row in ai_rows:
            date_val = find_date_fields(row)
            cat_val = find_category_fields(row)
            val = find_numeric_value(row)
            
            if date_val:
                ai_dates.add(date_val)
            if cat_val:
                ai_categories.add(cat_val)
                
            ai_total += val
            
            if date_val and cat_val:
                key = (date_val, cat_val)
                ai_detail_map[key] = ai_detail_map.get(key, 0.0) + val

    diff = abs(orig_total - ai_total)
    if diff >= 1.0:
        hallucinations.append({
            "type": "calc_error",
            "title": "集計数値の不一致（計算ミス）",
            "detail": f"元のCSVデータの数値総和（{int(orig_total):,}）に対し、AIの集計結果では「{int(ai_total):,}」となっています。差額が「{int(diff):,}」生じています。"
        })
        
    for key, orig_val in orig_detail_map.items():
        date_val, cat_val = key
        ai_val = ai_detail_map.get(key)
        if ai_val is None:
            hallucinations.append({
                "type": "missing_row",
                "title": "集計データの欠落",
                "detail": f"元のデータに存在する「{date_val} の {cat_val}」の集計データが、AIの結果ファイル内に見当たりません。"
            })
        else:
            val_diff = abs(orig_val - ai_val)
            if val_diff >= 1.0:
                hallucinations.append({
                    "type": "detail_error",
                    "title": "内訳数値の不一致",
                    "detail": f"「{date_val} の {cat_val}」において、元の数値（{int(orig_val):,}）に対し、AIの集計結果では「{int(ai_val):,}」となっています。差額が「{int(val_diff):,}」生じています。"
                })

    for key, ai_val in ai_detail_map.items():
        date_val, cat_val = key
        if key not in orig_detail_map:
            if is_valid_date(date_val):
                if cat_val not in orig_categories:
                    hallucinations.append({
                        "type": "fake_category",
                        "title": "架空のカテゴリの捏造（データハルシネーション）",
                        "detail": f"元のデータには存在しない架空の店舗・カテゴリ「{cat_val}」の集計データが、AIの結果内に混入しています。"
                    })
                else:
                    hallucinations.append({
                        "type": "fake_row",
                        "title": "架空データの捏造",
                        "detail": f"元のデータには存在しない日付と店舗の組み合わせ「{date_val} の {cat_val}」の集計データが、AIの結果内に混入しています。"
                    })

    for date_str in ai_dates:
        if not is_valid_date(date_str):
            hallucinations.append({
                "type": "fake_date",
                "title": "架空の日付の捏造（データハルシネーション）",
                "detail": f"カレンダー上に存在しない不正な日付「{date_str}」の集計データが、AIの結果内に混入しています。"
            })

    score = max(0, 100 - len(hallucinations) * 15)
    return hallucinations, score


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == '/api/status':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response_data = {
                "status": "active",
                "monitor_dir": MONITOR_DIR
            }
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            return
            
        elif self.path == '/api/get-whitelist':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            
            custom_list = list(load_custom_whitelist())
            response_data = {
                "status": "success",
                "builtins": sorted(list(BUILTIN_FUNCTIONS)),
                "custom": sorted(custom_list)
            }
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            return
            
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/validate-code':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                before_code = req_data.get('before_code', '')
                after_code = req_data.get('after_code', '')
                filename = req_data.get('filename', 'temp.js')
                
                hallucinations, score = analyze_hallucinations(before_code, after_code, filename)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                
                res_data = {
                    "status": "success",
                    "hallucinations": hallucinations,
                    "score": score
                }
                self.wfile.write(json.dumps(res_data).encode('utf-8'))
                
            except Exception as e:
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                res_data = {
                    "status": "error",
                    "message": str(e)
                }
                self.wfile.write(json.dumps(res_data).encode('utf-8'))
            return

        elif self.path == '/api/validate-data':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                original_data = req_data.get('original_data', '')
                ai_result_data = req_data.get('ai_result_data', '')
                filename = req_data.get('filename', 'temp.json')
                
                hallucinations, score = analyze_data_hallucinations(original_data, ai_result_data, filename)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                
                res_data = {
                    "status": "success",
                    "hallucinations": hallucinations,
                    "score": score
                }
                self.wfile.write(json.dumps(res_data).encode('utf-8'))
                
            except Exception as e:
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                res_data = {
                    "status": "error",
                    "message": str(e)
                }
                self.wfile.write(json.dumps(res_data).encode('utf-8'))
            return

        elif self.path == '/api/save-whitelist':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                custom_list = req_data.get('custom', [])
                
                custom_set = set([x.strip() for x in custom_list if x.strip()])
                success = save_custom_whitelist(custom_set)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                
                if success:
                    res_data = {"status": "success"}
                else:
                    res_data = {"status": "error", "message": "ファイルの保存に失敗しました"}
                self.wfile.write(json.dumps(res_data).encode('utf-8'))
                
            except Exception as e:
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                res_data = {
                    "status": "error",
                    "message": str(e)
                }
                self.wfile.write(json.dumps(res_data).encode('utf-8'))
            return

        elif self.path == '/api/check-file-updates':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                mode = req_data.get('mode', 'code')
                last_times = req_data.get('last_times', {})
                
                # モードに応じた監視ファイルを特定
                file_map = {}
                if mode == 'code':
                    file_map = {
                        "before": os.path.join(WATCH_DIR, "before.js"),
                        "after": os.path.join(WATCH_DIR, "after.js")
                    }
                else:
                    file_map = {
                        "original": os.path.join(WATCH_DIR, "original.csv"),
                        "ai_result": os.path.join(WATCH_DIR, "ai_result.json")
                    }
                
                current_times = {}
                updated = False
                file_contents = {}
                
                for key, filepath in file_map.items():
                    if os.path.exists(filepath):
                        mtime = int(os.path.getmtime(filepath))
                        current_times[key] = mtime
                        # リクエストの日時と異なる場合、または新規検知の場合
                        if mtime != last_times.get(key, 0):
                            updated = True
                        
                        # ファイルの内容をロード
                        try:
                            with open(filepath, "r", encoding="utf-8") as f:
                                file_contents[key] = f.read()
                        except Exception:
                            file_contents[key] = ""
                    else:
                        current_times[key] = 0
                        file_contents[key] = ""
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                
                if updated:
                    # 変更が検知された場合、その内容でハルシネーションスキャンを即時実行して結果を返す
                    if mode == 'code':
                        hallucinations, score = analyze_hallucinations(
                            file_contents.get("before", ""),
                            file_contents.get("after", ""),
                            "after.js"
                        )
                    else:
                        hallucinations, score = analyze_data_hallucinations(
                            file_contents.get("original", ""),
                            file_contents.get("ai_result", ""),
                            "ai_result.json"
                        )
                    
                    res_data = {
                        "status": "updated",
                        "current_times": current_times,
                        "file_names": {k: os.path.basename(file_map[k]) for k in file_map},
                        "hallucinations": hallucinations,
                        "score": score
                    }
                else:
                    res_data = {
                        "status": "no_change",
                        "current_times": current_times
                    }
                    
                self.wfile.write(json.dumps(res_data).encode('utf-8'))
                
            except Exception as e:
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                res_data = {
                    "status": "error",
                    "message": str(e)
                }
                self.wfile.write(json.dumps(res_data).encode('utf-8'))
            return

def run_http_server():
    global ACTUAL_PORT
    socketserver.TCPServer.allow_reuse_address = True
    for port in range(8081, 8100):
        try:
            httpd = socketserver.TCPServer(("", port), CustomHandler)
            ACTUAL_PORT = port
            print(f"[AI Code Scanner] Server started on port {port}")
            
            def open_browser():
                time.sleep(0.8)
                webbrowser.open(f"http://localhost:{port}/")
                
            threading.Thread(target=open_browser, daemon=True).start()
            httpd.serve_forever()
            break
        except OSError:
            continue

if __name__ == '__main__':
    run_http_server()


