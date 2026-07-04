"""
ファクト・スキャナー 自動監視サーバー (Python版)
- ポート8080でHTTPサーバーを起動
- /api/status : ファイル変更監視API（JSON応答）
- /           : ファクトスキャナー起動.html を配信
- その他      : 静的ファイル配信
外部ライブラリ不要（Python標準ライブラリのみ）
"""

import os
import sys
import json
import time
import glob
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# --- 設定 ---
PORT = 8080
MONITOR_DIR = os.path.dirname(os.path.abspath(__file__))

EXCLUDE_DIRS = {'.git', '.agent', '.agents', '.vscode', 'scratch'}
EXCLUDE_FILES = {
    'fact_monitor.py', 'fact_monitor.ps1', 'fact_scanner.py',
    'fact_report.md', 'STATUS_REPORT.md', 'ファクトスキャナー起動.html'
}

# MIMEタイプの対応表
MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf':  'font/ttf',
    '.mp4':  'video/mp4',
    '.webm': 'video/webm',
    '.txt':  'text/plain; charset=utf-8',
    '.md':   'text/plain; charset=utf-8',
    '.xml':  'application/xml; charset=utf-8',
}


def scan_files():
    """監視対象ファイル（html, css, js）の最終更新時刻を辞書で返す"""
    state = {}
    for ext in ('*.html', '*.css', '*.js'):
        for filepath in glob.glob(os.path.join(MONITOR_DIR, '**', ext), recursive=True):
            # 除外ディレクトリのチェック
            rel = os.path.relpath(filepath, MONITOR_DIR)
            parts = rel.replace('\\', '/').split('/')
            if any(part in EXCLUDE_DIRS for part in parts):
                if os.path.basename(filepath) != 'test_bug.html':
                    continue
            # 除外ファイルのチェック
            if os.path.basename(filepath) in EXCLUDE_FILES:
                continue
            try:
                state[filepath] = os.path.getmtime(filepath)
            except OSError:
                pass
    return state


def scan_project_data():
    """プロジェクト全体のコードファイルとアセットファイルの一覧を返す"""
    code_files = []
    assets = []
    
    code_extensions = (".html", ".css", ".js")
    asset_extensions = (".png", ".jpg", ".jpeg", ".gif", ".mp3", ".wav", ".ogg")
    
    for root, dirs, files in os.walk(MONITOR_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        rel_dir = os.path.relpath(root, MONITOR_DIR)
        parts = [] if rel_dir == "." else rel_dir.replace("\\", "/").split("/")
        if any(part in EXCLUDE_DIRS for part in parts):
            continue
            
        for file in files:
            filepath = os.path.join(root, file)
            rel_file = os.path.relpath(filepath, MONITOR_DIR).replace("\\", "/")
            
            if file in EXCLUDE_FILES:
                if file != "test_bug.html":
                    continue
            
            ext = os.path.splitext(file)[1].lower()
            
            if ext in code_extensions:
                try:
                    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                except OSError:
                    content = ""
                code_files.append({
                    "path": rel_file,
                    "name": file,
                    "content": content
                })
            elif ext in asset_extensions:
                assets.append(rel_file)
                
    return {"files": code_files, "assets": assets}



# グローバルな監視状態
watched_files = scan_files()


class MonitorHandler(BaseHTTPRequestHandler):
    """リクエストハンドラー"""

    def log_message(self, format, *args):
        """アクセスログを簡潔に表示"""
        # /api/status のポーリングは表示しない（ログが溢れるため）
        msg = format % args
        if '/api/status' not in msg:
            print(f"[{self.log_date_time_string()}] {msg}")

    def do_GET(self):
        global watched_files

        parsed = urlparse(self.path)
        url_path = parsed.path

        if url_path == '/api/status':
            self._handle_api_status(parsed)
        elif url_path == '/api/project-scan':
            self._handle_api_project_scan()
        elif url_path == '/' or url_path == '':
            self._serve_scanner_html()
        else:
            self._serve_static_file(url_path)

    def _handle_api_status(self, parsed):
        """ファイル変更監視APIのハンドラー"""
        global watched_files

        # クエリパラメータ last_check の取得
        qs = parse_qs(parsed.query)
        last_check = 0.0
        if 'last_check' in qs:
            try:
                last_check = float(qs['last_check'][0])
            except (ValueError, IndexError):
                pass

        current_state = scan_files()
        modified = False
        target_file_name = ""
        code_content = ""

        # 最新のタイムスタンプを取得
        max_mtime = last_check
        if current_state:
            max_mtime = max(current_state.values())

        # 差分チェック（初回 last_check == 0 は同期のみ）
        if last_check > 0.0 and max_mtime > last_check:
            for path, mtime in current_state.items():
                if mtime > last_check:
                    modified = True
                    target_file_name = os.path.basename(path)
                    try:
                        with open(path, 'r', encoding='utf-8', errors='replace') as f:
                            code_content = f.read()
                    except OSError:
                        code_content = ""
                    break

        # 状態更新
        watched_files = current_state

        # JSON応答
        response_data = {
            'connected': True,
            'modified': modified,
            'target_file_name': target_file_name,
            'code_content': code_content,
            'monitoring_path': os.path.basename(MONITOR_DIR),
            'last_check': max_mtime,
        }

        body = json.dumps(response_data, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def _handle_api_project_scan(self):
        """プロジェクト全体の一括スキャン結果を返すAPI"""
        project_data = scan_project_data()
        body = json.dumps(project_data, ensure_ascii=False).encode('utf-8')
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def _serve_scanner_html(self):
        """ファクトスキャナー起動.html を配信"""
        html_path = os.path.join(MONITOR_DIR, 'ファクトスキャナー起動.html')
        if os.path.isfile(html_path):
            self._serve_file(html_path, 'text/html; charset=utf-8')
        else:
            self._send_error(404, 'Scanner HTML not found')

    def _serve_static_file(self, url_path):
        """静的ファイルの配信"""
        # URLパスからファイルパスを解決（ディレクトリトラバーサル対策付き）
        rel_path = url_path.lstrip('/')
        file_path = os.path.normpath(os.path.join(MONITOR_DIR, rel_path))

        # セキュリティチェック：MONITOR_DIR外へのアクセスを防ぐ
        if not file_path.startswith(os.path.normpath(MONITOR_DIR)):
            self._send_error(403, 'Forbidden')
            return

        if os.path.isfile(file_path):
            ext = os.path.splitext(file_path)[1].lower()
            content_type = MIME_TYPES.get(ext, 'application/octet-stream')
            self._serve_file(file_path, content_type)
        else:
            self._send_error(404, 'File not found')

    def _serve_file(self, file_path, content_type):
        """ファイルをバイナリで読んでレスポンスとして返す"""
        try:
            with open(file_path, 'rb') as f:
                body = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
        except OSError:
            self._send_error(500, 'Internal Server Error')

    def _send_error(self, code, message):
        """エラーレスポンスを返す"""
        body = message.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    print("=" * 60)
    print("  ファクト・スキャナー 自動監視サーバー (Python版)")
    print("=" * 60)
    print()

    server = HTTPServer(('localhost', PORT), MonitorHandler)
    print(f"[INFO] 監視対象: {MONITOR_DIR}")
    print(f"[INFO] 監視ファイル数: {len(watched_files)}")
    print(f"[INFO] サーバー起動: http://localhost:{PORT}/")
    print()
    print("Ctrl+C で停止します。")
    print("-" * 60)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] サーバーを停止しました。")
        server.server_close()


if __name__ == '__main__':
    main()
