import os
import re
import struct
import sys

def get_image_size_raw(file_path):
    """
    Pillowがインストールされていない環境でも動作するよう、
    画像のバイナリヘッダーを直接解析して幅と高さを取得するフォールバック関数。
    """
    try:
        with open(file_path, 'rb') as f:
            head = f.read(32)
            
            # PNG形式の解析
            if head.startswith(b'\x89PNG\r\n\x1a\n'):
                f.seek(16)
                width, height = struct.unpack('>II', f.read(8))
                return width, height, 'PNG'
                
            # GIF形式の解析
            elif head.startswith(b'GIF87a') or head.startswith(b'GIF89a'):
                width, height = struct.unpack('<HH', head[6:10])
                return width, height, 'GIF'
                
            # JPEG形式の解析
            elif head.startswith(b'\xff\xd8'):
                f.seek(0)
                f.read(2)  # SOIマーカーをスキップ
                while True:
                    marker = f.read(2)
                    if not marker or marker[0] != 0xff:
                        break
                    marker_type = marker[1]
                    # SOF0 (0xc0) 〜 SOF15 (0xcf) ※ただしDHTやJPG等は除く
                    if marker_type in (0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf):
                        segment_len = struct.unpack('>H', f.read(2))[0]
                        data = f.read(5)  # 精度(1B), 高さ(2B), 幅(2B)
                        precision, height, width = struct.unpack('>BHH', data)
                        return width, height, 'JPEG'
                    else:
                        segment_len_data = f.read(2)
                        if not segment_len_data:
                            break
                        segment_len = struct.unpack('>H', segment_len_data)[0]
                        f.seek(segment_len - 2, 1)  # セグメントの長さ分スキップ
                return None, None, 'JPEG (バイナリ解析失敗)'
    except Exception as e:
        return None, None, f'解析エラー ({str(e)})'
    return None, None, '未知のフォーマット'

def get_image_info(file_path):
    """
    画像のサイズとフォーマットを取得。Pillowを優先し、なければバイナリ直接解析を行う。
    """
    try:
        from PIL import Image
        img = Image.open(file_path)
        return img.size[0], img.size[1], img.format
    except ImportError:
        return get_image_size_raw(file_path)
    except Exception:
        return get_image_size_raw(file_path)

def scan_source_file(source_path, project_root):
    """
    指定されたコードファイルを読み込み、定義されている画像パスを検出して物理サイズを調査する。
    """
    if not os.path.exists(source_path):
        print(f"【エラー】指定されたファイルが見つかりません: {source_path}")
        return
        
    print(f"対象ファイルを解析中: {source_path}")
    
    with open(source_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
        
    # コード内の引用符で囲まれた画像ファイルのパスを検出する正規表現（png, jpg, jpeg, gif）
    image_pattern = re.compile(r'["\']([^"\'\s]+\.(?:png|jpg|jpeg|gif))["\']', re.IGNORECASE)
    matches = image_pattern.findall(content)
    
    # 重複の排除とソート
    unique_paths = sorted(list(set(matches)))
    
    results = []
    source_dir = os.path.dirname(os.path.abspath(source_path))
    
    for path in unique_paths:
        # パスの解決試行
        # 1. 解析対象ファイルからの相対パス
        resolved_path = os.path.abspath(os.path.join(source_dir, path))
        
        if not os.path.exists(resolved_path):
            # 2. プロジェクトのルート（カレントディレクトリ）からの相対パス
            resolved_path = os.path.abspath(os.path.join(project_root, path))
            
        if os.path.exists(resolved_path) and os.path.isfile(resolved_path):
            width, height, img_type = get_image_info(resolved_path)
            results.append({
                'detected_path': path,
                'resolved_path': resolved_path,
                'exists': True,
                'width': width,
                'height': height,
                'type': img_type,
                'size_bytes': os.path.getsize(resolved_path)
            })
        else:
            results.append({
                'detected_path': path,
                'resolved_path': resolved_path,
                'exists': False,
                'width': None,
                'height': None,
                'type': '不明',
                'size_bytes': None
            })
            
    generate_report(source_path, results)

def generate_report(source_path, results):
    """
    結果をコンソールに出力し、Markdown形式のレポートファイルを生成する。
    """
    report_lines = []
    basename = os.path.basename(source_path)
    
    report_lines.append(f"# 【事実検証レポート】 {basename} の依存リソーススキャン結果")
    report_lines.append("")
    report_lines.append("このレポートは、コードの修正やバグ調査の前に「憶測」を排除し、画像等のリソースの物理的な実態（解像度など）を把握するためのものです。")
    report_lines.append("")
    
    # テーブルヘッダー
    report_lines.append("| 検出されたパス | 存在確認 | 解像度 (幅 x 高さ) | フォーマット | ファイルサイズ (KB) |")
    report_lines.append("| :--- | :---: | :--- | :--- | :--- |")
    
    console_output = []
    console_output.append("=" * 80)
    console_output.append(f"【ファクト・スキャン結果】 {basename}")
    console_output.append("=" * 80)
    
    for r in results:
        status_symbol = "◯ 存在します" if r['exists'] else "❌ 見つかりません"
        if r['exists']:
            res_str = f"{r['width']} x {r['height']} px"
            fmt_str = r['type']
            size_kb = f"{r['size_bytes'] / 1024:.2f} KB"
        else:
            res_str = "N/A"
            fmt_str = "N/A"
            size_kb = "N/A"
            
        report_lines.append(f"| {r['detected_path']} | {status_symbol} | {res_str} | {fmt_str} | {size_kb} |")
        
        console_output.append(f"・パス: {r['detected_path']}")
        console_output.append(f"  ステータス: {status_symbol}")
        if r['exists']:
            console_output.append(f"  物理サイズ: {res_str} | フォーマット: {fmt_str} | 容量: {size_kb}")
        console_output.append("-" * 50)
        
    report_lines.append("")
    report_lines.append("## 💡 憶測を排除するための注意事項")
    report_lines.append("・HTML/JSコード内で指定されている描画サイズ（width, height, drawImageなど）が、上記の物理的な解像度と乖離していないか必ずチェックしてください。")
    report_lines.append("・画像が「見つかりません」になっている場合、パスの指定ミスやアセットの置き忘れの可能性があります。")
    report_lines.append("")
    
    # レポートファイルの保存
    report_path = os.path.join(os.path.dirname(os.path.abspath(source_path)), 'fact_report.md')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(report_lines))
        
    # コンソール出力
    for line in console_output:
        print(line)
    print(f"\n【完了】詳細な検証レポートを生成しました: {report_path}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("【使用方法】python fact_scanner.py <スキャン対象コードファイル（HTMLやJSなど）>")
        sys.exit(1)
        
    target = sys.argv[1]
    root_dir = os.getcwd()
    scan_source_file(target, root_dir)
