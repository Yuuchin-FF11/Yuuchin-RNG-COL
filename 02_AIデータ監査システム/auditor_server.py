# -*- coding: utf-8 -*-
import os
import sys
import json
import base64
import io
import re
import http.server
import socketserver
import threading
import traceback
import webbrowser
import time
from datetime import datetime
import pandas as pd
import numpy as np

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

# sys.stdoutのNoneErrorを防止
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

# ディレクトリ解決
if getattr(sys, 'frozen', False):
    APP_DIR = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(sys.executable)))
    DATA_DIR = os.path.dirname(os.path.abspath(sys.executable))
else:
    APP_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_DIR = APP_DIR

WATCH_DIR = os.path.join(DATA_DIR, "monitor_files")
LAST_MAPPING_FILE = os.path.join(DATA_DIR, "last_mapping.json")
HTML_FILE_PATH = os.path.join(APP_DIR, "auditor_app.html")
if not os.path.exists(HTML_FILE_PATH):
    HTML_FILE_PATH = os.path.join(DATA_DIR, "auditor_app.html")

if not os.path.exists(WATCH_DIR):
    try:
        os.makedirs(WATCH_DIR)
    except Exception:
        pass

ACTUAL_PORT = 8082

def load_last_mapping():
    if os.path.exists(LAST_MAPPING_FILE):
        try:
            with open(LAST_MAPPING_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"date": "日付", "category": "店舗名", "value": "売上"}

def save_last_mapping(mapping):
    try:
        with open(LAST_MAPPING_FILE, "w", encoding="utf-8") as f:
            json.dump(mapping, f, indent=4, ensure_ascii=False)
    except Exception:
        pass

def load_file_from_base64(name, b64_data):
    file_bytes = base64.b64decode(b64_data)
    ext = os.path.splitext(name)[1].lower()
    if ext in (".xlsx", ".xls"):
        df = pd.read_excel(io.BytesIO(file_bytes))
    else:
        try:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="utf-8")
        except Exception:
            df = pd.read_csv(io.BytesIO(file_bytes), encoding="cp932")
    return df

def normalize_dataframe(df, mapping):
    rename_dict = {}
    for std_col, user_col in mapping.items():
        if user_col and user_col in df.columns:
            rename_dict[user_col] = std_col
            
    df_norm = df.rename(columns=rename_dict)
    
    for col in ["date", "category", "value"]:
        if col not in df_norm.columns:
            df_norm[col] = None
            
    # 結合セル対策：日付とカテゴリ列の空欄（NaN）を上の行のデータで自動補完
    df_norm["date"] = df_norm["date"].ffill()
    df_norm["category"] = df_norm["category"].ffill()
    
    df_norm["date"] = df_norm["date"].astype(str).str.strip().replace({"nan": "", "None": ""})
    df_norm["category"] = df_norm["category"].astype(str).str.strip().replace({"nan": "", "None": ""})
    
    def clean_num(val):
        if pd.isna(val) or val is None:
            return 0.0
        val_str = str(val).strip()
        num_str = re.sub(r"[^\d.-]", "", val_str)
        try:
            return float(num_str) if num_str else 0.0
        except ValueError:
            return 0.0
            
    df_norm["value"] = df_norm["value"].apply(clean_num)
    return df_norm

def is_valid_date(date_str):
    if not date_str or date_str == "nan" or date_str == "None":
        return False
    date_str = str(date_str).strip()
    
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            datetime.strptime(date_str, fmt)
            return True
        except ValueError:
            pass
            
    date_part = date_str.split(" ")[0]
    for fmt in ("%Y-%m-%d", "%Y/%m/%d"):
        try:
            datetime.strptime(date_part, fmt)
            return True
        except ValueError:
            pass
    return False

def generate_corrected_dataframe(df_orig_norm, df_ai_norm, df_ai, mapping):
    df_corrected = df_ai.copy()
    
    orig_detail_map = {}
    orig_counters = {}
    for _, row in df_orig_norm.iterrows():
        d_val = row["date"]
        c_val = row["category"]
        v_val = row["value"]
        key_base = (d_val, c_val)
        count = orig_counters.get(key_base, 0)
        orig_counters[key_base] = count + 1
        orig_detail_map[(d_val, c_val, count)] = v_val

    orig_categories = set(df_orig_norm["category"].dropna().unique())
    if "" in orig_categories:
        orig_categories.remove("")

    ai_counters = {}
    rows_to_drop = []
    
    val_col = mapping.get("value")
    
    for idx, row in df_ai_norm.iterrows():
        d_val = row["date"]
        c_val = row["category"]
        
        # 架空店舗または不正日付なら行ごと削除対象
        if (c_val and c_val not in orig_categories) or (d_val and not is_valid_date(d_val)):
            rows_to_drop.append(idx)
            continue
            
        key_base = (d_val, c_val)
        count = ai_counters.get(key_base, 0)
        ai_counters[key_base] = count + 1
        
        lookup_key = (d_val, c_val, count)
        if lookup_key in orig_detail_map:
            correct_val = orig_detail_map[lookup_key]
            if val_col and val_col in df_corrected.columns:
                df_corrected.at[idx, val_col] = correct_val
        else:
            if (d_val, c_val, 0) in orig_detail_map:
                correct_val = orig_detail_map[(d_val, c_val, 0)]
                if val_col and val_col in df_corrected.columns:
                    df_corrected.at[idx, val_col] = correct_val
            else:
                rows_to_drop.append(idx)
                
    if rows_to_drop:
        df_corrected = df_corrected.drop(index=rows_to_drop)
        
    return df_corrected

def analyze_excel_hallucinations(df_orig, df_ai, mapping, ai_filename="corrected_result.xlsx"):
    df_orig_norm = normalize_dataframe(df_orig, mapping)
    df_ai_norm = normalize_dataframe(df_ai, mapping)
    
    hallucinations = []
    
    # 1. 全体合計の検証
    orig_total = df_orig_norm["value"].sum()
    ai_total = df_ai_norm["value"].sum()
    diff_total = ai_total - orig_total
    
    if abs(diff_total) > 0.001:
        hallucinations.append({
            "type": "全体合計の計算ミス",
            "location": "全体の売上合計",
            "detail": f"正: {orig_total:,.0f} / AI: {ai_total:,.0f} (差額: {diff_total:+,.0f})"
        })
        
    # 2. カテゴリ別（店舗別）集計の検証
    orig_cat = df_orig_norm.groupby("category")["value"].sum().to_dict()
    ai_cat = df_ai_norm.groupby("category")["value"].sum().to_dict()
    
    all_categories = set(orig_cat.keys()).union(set(ai_cat.keys()))
    if "" in all_categories:
        all_categories.remove("")
        
    for cat in sorted(all_categories):
        o_val = orig_cat.get(cat, None)
        a_val = ai_cat.get(cat, None)
        
        if o_val is None and a_val is not None:
            hallucinations.append({
                "type": "存在しない項目の捏造",
                "location": f"店舗名「{cat}」",
                "detail": f"元データに存在しない架空の店舗データが作成されています。(AI売上: {a_val:,.0f})"
            })
        elif o_val is not None and a_val is None:
            hallucinations.append({
                "type": "データの集計漏れ（消失）",
                "location": f"店舗名「{cat}」",
                "detail": f"元データに存在する店舗が集計から脱落しています。(元データ売上: {o_val:,.0f})"
            })
        elif abs(o_val - a_val) > 0.001:
            diff = a_val - o_val
            hallucinations.append({
                "type": "店舗別売上のズレ（数値偽変）",
                "location": f"店舗名「{cat}」",
                "detail": f"正: {o_val:,.0f} / AI: {a_val:,.0f} (差額: {diff:+,.0f})"
            })

    # 3. 日付の不正検証
    for idx, row in df_ai_norm.iterrows():
        d_val = row["date"]
        if d_val and not is_valid_date(d_val):
            hallucinations.append({
                "type": "不正な日付の捏造",
                "location": f"行番号 {idx + 2}",
                "detail": f"カレンダー上に存在しない、または無効な日付「{d_val}」が含まれています。"
            })

    # 4. 明細レベルのズレ検証
    orig_detail_map = {}
    orig_counters = {}
    for _, row in df_orig_norm.iterrows():
        d_val = row["date"]
        c_val = row["category"]
        v_val = row["value"]
        key_base = (d_val, c_val)
        count = orig_counters.get(key_base, 0)
        orig_counters[key_base] = count + 1
        orig_detail_map[(d_val, c_val, count)] = v_val
        
    ai_counters = {}
    for idx, row in df_ai_norm.iterrows():
        d_val = row["date"]
        c_val = row["category"]
        v_val = row["value"]
        
        if not c_val or (c_val not in orig_cat and "" not in orig_cat):
            continue
        if d_val and not is_valid_date(d_val):
            continue
            
        key_base = (d_val, c_val)
        count = ai_counters.get(key_base, 0)
        ai_counters[key_base] = count + 1
        
        lookup_key = (d_val, c_val, count)
        if lookup_key in orig_detail_map:
            orig_row_val = orig_detail_map[lookup_key]
            if abs(orig_row_val - v_val) > 0.001:
                diff = v_val - orig_row_val
                hallucinations.append({
                    "type": "個別明細の金額ズレ",
                    "location": f"行 {idx + 2} ({d_val} {c_val})",
                    "detail": f"正: {orig_row_val:,.0f} / AI: {v_val:,.0f} (差額: {diff:+,.0f})"
                })
        else:
            hallucinations.append({
                "type": "余剰明細行の混入",
                "location": f"行 {idx + 2} ({d_val} {c_val})",
                "detail": f"元データの件数を超える余分な明細行が存在します。(売上: {v_val:,.0f})"
            })

    # スコア計算
    error_count = len(hallucinations)
    score = max(0, 100 - (error_count * 15))
    
    # 修正済みエクセル・CSVの生成
    try:
        df_corrected = generate_corrected_dataframe(df_orig_norm, df_ai_norm, df_ai, mapping)
        buf = io.BytesIO()
        ext = os.path.splitext(ai_filename)[1].lower()
        if ext in (".xlsx", ".xls"):
            with pd.ExcelWriter(buf, engine='openpyxl') as writer:
                df_corrected.to_excel(writer, index=False)
        else:
            df_corrected.to_csv(buf, index=False, encoding='utf-8-sig')
            
        buf.seek(0)
        corrected_b64 = base64.b64encode(buf.read()).decode('utf-8')
    except Exception:
        traceback.print_exc()
        corrected_b64 = ""
        
    return hallucinations, score, corrected_b64


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

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
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            res = {"status": "active", "port": ACTUAL_PORT, "monitor_dir": DATA_DIR}
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))
            return
        elif self.path in ('/', '', '/index.html'):
            if os.path.isfile(HTML_FILE_PATH):
                try:
                    with open(HTML_FILE_PATH, 'rb') as f:
                        content = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html; charset=utf-8')
                    self.send_header('Content-Length', str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                    return
                except Exception as e:
                    self.send_error(500, f"Error reading UI file: {str(e)}")
                    return
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/parse-headers':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                filename = req_data.get('filename', 'temp.xlsx')
                b64_data = req_data.get('filedata', '')
                
                df = load_file_from_base64(filename, b64_data)
                headers = list(df.columns)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                
                res = {
                    "status": "success",
                    "headers": [str(h) for h in headers]
                }
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))
                
            except Exception as e:
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False).encode('utf-8'))
            return

        elif self.path == '/api/validate-excel':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                orig_name = req_data.get('orig_filename', 'original.xlsx')
                orig_b64 = req_data.get('orig_filedata', '')
                ai_name = req_data.get('ai_filename', 'ai_result.xlsx')
                ai_b64 = req_data.get('ai_filedata', '')
                mapping = req_data.get('mapping', {})
                
                save_last_mapping(mapping)
                
                df_orig = load_file_from_base64(orig_name, orig_b64)
                df_ai = load_file_from_base64(ai_name, ai_b64)
                
                hallucinations, score, corrected_b64 = analyze_excel_hallucinations(df_orig, df_ai, mapping, ai_name)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                
                res = {
                    "status": "success",
                    "hallucinations": hallucinations,
                    "score": score,
                    "corrected_filedata": corrected_b64
                }
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))
                
            except Exception as e:
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False).encode('utf-8'))
            return

        elif self.path == '/api/check-file-updates':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                req_data = json.loads(post_data.decode('utf-8'))
                client_timestamps = req_data.get('timestamps', {})
                
                orig_path = None
                ai_path = None
                
                if os.path.exists(WATCH_DIR):
                    for file in os.listdir(WATCH_DIR):
                        low = file.lower()
                        if low.startswith("original."):
                            orig_path = os.path.join(WATCH_DIR, file)
                        elif low.startswith("ai_result."):
                            ai_path = os.path.join(WATCH_DIR, file)
                
                server_timestamps = {}
                if orig_path and os.path.exists(orig_path):
                    server_timestamps['original'] = os.path.getmtime(orig_path)
                if ai_path and os.path.exists(ai_path):
                    server_timestamps['ai'] = os.path.getmtime(ai_path)
                    
                updated = False
                for k, ts in server_timestamps.items():
                    if k not in client_timestamps or ts > client_timestamps[k]:
                        updated = True
                        break
                        
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                
                if updated and orig_path and ai_path:
                    mapping = load_last_mapping()
                    
                    ext_orig = os.path.splitext(orig_path)[1].lower()
                    if ext_orig in (".xlsx", ".xls"):
                        df_orig = pd.read_excel(orig_path)
                    else:
                        try:
                            df_orig = pd.read_csv(orig_path, encoding="utf-8")
                        except Exception:
                            df_orig = pd.read_csv(orig_path, encoding="cp932")
                            
                    ext_ai = os.path.splitext(ai_path)[1].lower()
                    if ext_ai in (".xlsx", ".xls"):
                        df_ai = pd.read_excel(ai_path)
                    else:
                        try:
                            df_ai = pd.read_csv(ai_path, encoding="utf-8")
                        except Exception:
                            df_ai = pd.read_csv(ai_path, encoding="cp932")
                            
                    hallucinations, score, corrected_b64 = analyze_excel_hallucinations(df_orig, df_ai, mapping, os.path.basename(ai_path))
                    
                    res = {
                        "status": "success",
                        "updated": True,
                        "timestamps": server_timestamps,
                        "original_headers": [str(h) for h in df_orig.columns],
                        "ai_headers": [str(h) for h in df_ai.columns],
                        "mapping": mapping,
                        "hallucinations": hallucinations,
                        "score": score,
                        "corrected_filedata": corrected_b64
                    }
                else:
                    res = {
                        "status": "success",
                        "updated": False,
                        "timestamps": server_timestamps
                    }
                    
                self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))
                
            except Exception as e:
                traceback.print_exc()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False).encode('utf-8'))
            return

def start_server():
    global ACTUAL_PORT
    socketserver.TCPServer.allow_reuse_address = True
    
    # 8082から順に空きポートを探す
    for port in range(8082, 8100):
        try:
            httpd = socketserver.TCPServer(("", port), CustomHandler)
            ACTUAL_PORT = port
            print(f"[AI Data Auditor] Server started on port {port}")
            
            # ブラウザを自動で開く
            def open_browser():
                time.sleep(0.8)
                webbrowser.open(f"http://localhost:{port}/")
            
            threading.Thread(target=open_browser, daemon=True).start()
            httpd.serve_forever()
            break
        except OSError:
            continue

if __name__ == "__main__":
    start_server()
