# AutoPost30 ローカルHTTPサーバー
# アスタリスク文字および絵文字の完全不使用ルールに準拠

import http.server
import socketserver
import webbrowser
import os
import sys

def find_available_port(start_port=8000, max_attempts=50):
    import socket
    port = start_port
    while port < start_port + max_attempts:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                port += 1
    return 8000

def run_server():
    # スクリプト自身のディレクトリに移動
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    port = find_available_port()
    handler = http.server.SimpleHTTPRequestHandler

    print("========================================")
    print("AutoPost30 ローカルサーバーを起動しています")
    print(f"URL: http://127.0.0.1:{port}/index.html")
    print("ブラウザを自動起動します...")
    print("停止するには Ctrl+C を押してください")
    print("========================================")

    url = f"http://127.0.0.1:{port}/index.html"
    webbrowser.open(url)

    with socketserver.TCPServer(('127.0.0.1', port), handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nサーバーを停止しました。")
            sys.exit(0)

if __name__ == "__main__":
    run_server()
