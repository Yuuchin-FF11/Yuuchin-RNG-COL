# -*- coding: utf-8 -*-
import os
import sys
import subprocess

print("===================================================")
print("   AI背景切り抜きお給仕スクリプト 🐾")
print("===================================================")
print("")

# ライブラリの存在チェックと自動インストール
try:
    from rembg import remove
    from PIL import Image
except ImportError:
    print("[お給仕] 背景除去ライブラリ (rembg) がインストールされていません。")
    print("自動的にライブラリと依存関係のインストールを開始します。少々お待ちください...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "rembg", "pillow"])
        print("[お給仕] インストールが正常に完了いたしました！")
        from rembg import remove
        from PIL import Image
    except Exception as e:
        print(f"[警告] インストール中にエラーが発生いたしました: {e}")
        print("インターネット接続やPython環境をご確認ください。")
        input("\nキーを押すと終了します...")
        sys.exit(1)

def main():
    # 入力画像ファイルのパス取得
    input_file = input("◆ 切り抜きたい画像ファイルの名前（またはフルパス）を入力してください: ").strip()
    
    # ダブルクォーテーションが含まれる場合の除去
    input_file = input_file.replace('"', '').replace("'", "")

    if not os.path.exists(input_file):
        print(f"[警告] 指定されたファイルが見つかりません: {input_file}")
        input("\nキーを押すと終了します...")
        return

    # 出力ファイル名の自動決定 (元の名前_透過.png)
    base, _ = os.path.splitext(input_file)
    output_file = f"{base}_透過.png"

    print("\n[お給仕] AIによる背景解析および切り抜きを実行しております。少々お待ちくださいませ🐾")
    
    try:
        # 画像処理の実行
        with open(input_file, 'rb') as f_in:
            input_data = f_in.read()
            # rembgで背景を消去
            output_data = remove(input_data)
            
        with open(output_file, 'wb') as f_out:
            f_out.write(output_data)

        print("")
        print("===================================================")
        print("[お給仕] 背景の切り抜きが完了いたしました！")
        print(f"保存されたファイル: {output_file}")
        print("===================================================")
        
        # エクスプローラーで出力先フォルダを開く
        try:
            abs_path = os.path.abspath(output_file)
            subprocess.run(f'explorer.exe /select,"{abs_path}"', shell=True)
        except Exception:
            pass
            
    except Exception as e:
        print(f"\n[警告] 処理中にエラーが発生いたしました: {e}")

    input("\nキーを押すと終了します...")

if __name__ == "__main__":
    main()
