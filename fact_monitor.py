import os
import json
import time
import sys
import mimetypes
from http.server import SimpleHTTPRequestHandler, HTTPServer
import urllib.parse

PORT = 8080
MONITOR_DIR = os.path.dirname(os.path.abspath(__file__))

# 監視対象外のディレクトリやファイル
EXCLUDE_DIRS = {'.git', '.agent', '.agents', '.vscode', 'scratch'}
EXCLUDE_FILES = {'fact_monitor.py', 'fact_scanner.py', 'fact_report.md', 'STATUS_REPORT.md', 'ファクトスキャナー起動.html'}

class FactMonitorHandler(SimpleHTTPRequestHandler):
    # サーバー全体のファイル状態を管理するためのクラス変数
    # file_path -> last_modified_time
    watched_files = {}

    @classmethod
    def scan_files(cls):
        """ディレクトリ内の監視対象ファイルをスキャンする"""
        current_state = {}
        for root, dirs, files in os.walk(MONITOR_DIR):
            # 特定のディレクトリを除外
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                if file in EXCLUDE_FILES:
                    continue
                    
                # HTML, CSS, JSのみを監視
                if file.endswith(('.html', '.css', '.js')):
                    full_path = os.path.join(root, file)
                    try:
                        mtime = os.path.getmtime(full_path)
                        current_state[full_path] = mtime
                    except OSError:
                        pass
        return current_state

    @classmethod
    def initialize_watcher(cls):
        """起動時のファイル状態を初期化"""
        cls.watched_files = cls.scan_files()
        print(f"[INFO] Watcher initialized. Monitoring {len(cls.watched_files)} files.")

    def do_GET(self):
        # APIエンドポイント /api/status へのリクエスト処理
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == '/api/status':
            self.handle_api_status()
        elif parsed_path.path == '/' or parsed_path.path == '':
            # ルートアクセスの場合は「ファクトスキャナー起動.html」を返す
            self.serve_scanner_html()
        else:
            # それ以外は通常の静的ファイル配信
            super().do_GET()

    def serve_scanner_html(self):
        """ファクトスキャナー起動.htmlを配信する"""
        target_path = os.path.join(MONITOR_DIR, 'ファクトスキャナー起動.html')
        if not os.path.exists(target_path):
            self.send_error(404, "ファクトスキャナー起動.html が見つかりません。")
            return
            
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        with open(target_path, 'rb') as f:
            self.wfile.write(f.read())

    def handle_api_status(self):
        """ファイル変更チェックを行い、結果をJSONで返すAPI"""
        # クエリパラメータから last_check を取得
        parsed_url = urllib.parse.urlparse(self.path)
        query_params = urllib.parse.parse_qs(parsed_url.query)
        
        last_check = 0.0
        try:
            if 'last_check' in query_params:
                last_check = float(query_params['last_check'][0])
        except (ValueError, IndexError):
            pass

        current_state = self.scan_files()
        
        modified = False
        target_file_name = ""
        code_content = ""
        max_mtime = last_check

        # 最も新しいmtimeを見つける
        if current_state:
            max_mtime = max(current_state.values())

        # 最後にチェックした時間より新しいファイルがある場合
        # 初回起動時（last_check == 0）は変更検知をスキップし初期同期のみ行う
        if last_check > 0.0 and max_mtime > last_check:
            for path, mtime in current_state.items():
                if mtime > last_check:
                    modified = True
                    target_file_name = os.path.basename(path)
                    code_content = self.read_file_safe(path)
                    break

        response_data = {
            "connected": True,
            "modified": modified,
            "target_file_name": target_file_name,
            "code_content": code_content,
            "monitoring_path": os.path.basename(MONITOR_DIR),
            "last_check": max_mtime
        }

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(response_data).encode('utf-8'))

    def read_file_safe(self, path):
        """ファイルを安全に読み込む"""
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        except Exception as e:
            return f"ファイルの読み込みに失敗しました: {str(e)}"

def run_server():
    FactMonitorHandler.initialize_watcher()
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, FactMonitorHandler)
    print(f"[INFO] Server started successfully at http://localhost:{PORT}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[INFO] Stopping server...")
        httpd.server_close()

if __name__ == '__main__':
    run_server()
