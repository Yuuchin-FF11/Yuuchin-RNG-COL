"""
お給仕コメビュ OS直結マイクブリッジ (Python)
WindowsのOS直結マイクから音声を拾い、WebSocketでコメビュ（admin.js）へリアルタイム送信する常駐プロセス。
ゲーム中や長時間の無音（5分以上）でもブラウザのセキュリティ制限を受けず、100%安定して待機・認識を維持します。
"""

import sys
import json
import asyncio
import threading
import speech_recognition as sr
import websockets

# 設定
WS_PORT = 8089
WS_HOST = "127.0.0.1"

# 接続中のWebSocketクライアント一覧
connected_clients = set()

# コメビュ側の読み上げ（TTS）状態フラグ
is_tts_active = False

def log(msg):
    print(f"[MicBridge] {msg}", flush=True)

async def ws_handler(websocket):
    global is_tts_active
    connected_clients.add(websocket)
    log(f"コメビュが接続しました (接続数: {len(connected_clients)})")
    
    # 接続確認メッセージを送信
    await websocket.send(json.dumps({
        "type": "bridge_status",
        "status": "connected",
        "message": "OS直結マイクブリッジ準備完了"
    }))
    
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                if msg_type == "tts_state":
                    is_tts_active = bool(data.get("active", False))
                    # log(f"TTS状態更新: {is_tts_active}")
            except Exception as e:
                log(f"受信メッセージ解析エラー: {e}")
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.remove(websocket)
        log(f"コメビュが切断しました (残接続数: {len(connected_clients)})")

async def broadcast_mic_text(text):
    if not connected_clients:
        log(f"認識結果 (送信先なし): {text}")
        return
    
    payload = json.dumps({
        "type": "mic_text",
        "text": text
    })
    
    # 全接続クライアントに一斉送信
    dead_clients = set()
    for ws in list(connected_clients):
        try:
            await ws.send(payload)
        except Exception:
            dead_clients.add(ws)
    
    for dead in dead_clients:
        connected_clients.discard(dead)
    
    log(f"字幕テキスト送信完了: {text}")

def mic_worker(loop):
    """
    OS直結マイクから音声を常時リッスンするワーカースレッド。
    無音が何分・何時間続いてもOS側で接続を維持し、声が入った瞬間だけ認識してWebSocket送信します。
    """
    recognizer = sr.Recognizer()
    # 認識感度・無音検出の調整（1.2秒の無音判定と小声でも切れない感度固定）
    recognizer.energy_threshold = 100
    recognizer.dynamic_energy_threshold = False
    recognizer.pause_threshold = 1.2  # 発話終了とみなす無音時間（1.2秒）
    
    try:
        microphone = sr.Microphone()
        with microphone as source:
            log("環境ノイズを測定中 (1秒)...")
            recognizer.adjust_for_ambient_noise(source, duration=1.0)
            # ノイズ測定による閾値の跳ね上がりを防ぎ、小声や語尾を確実に拾うため再固定
            recognizer.energy_threshold = 100
            recognizer.dynamic_energy_threshold = False
            log("マイク待機開始。常時リッスン中 (何分無音でも維持されます)...")
            
        while True:
            try:
                with microphone as source:
                    # 発話があるまでブロックして待機（連続20秒まで録音可能）
                    audio = recognizer.listen(source, timeout=None, phrase_time_limit=20)
                
                # 読み上げ中なら破棄（七海ちゃんの声を誤爆しない安全策）
                if is_tts_active:
                    log("読み上げ中のため、マイク音声を無視しました (ソフトミュート)")
                    continue
                
                # Google Speech Recognitionで日本語文字起こし
                try:
                    text = recognizer.recognize_google(audio, language="ja-JP")
                    if text and text.strip():
                        clean_text = text.strip()
                        log(f"音声認識成功: 「{clean_text}」")
                        # メインループのWebSocket送信タスクを安全にキック
                        asyncio.run_coroutine_threadsafe(broadcast_mic_text(clean_text), loop)
                except sr.UnknownValueError:
                    # 音声として認識できなかった（咳払い、ノイズ等）
                    pass
                except sr.RequestError as e:
                    log(f"音声認識サービス通信エラー: {e}")
            except Exception as e:
                log(f"マイク入力待機エラー: {e}")
                import time
                time.sleep(1)
    except Exception as e:
        log(f"マイクデバイス初期化エラー: {e}")

async def main():
    loop = asyncio.get_running_loop()
    
    # マイク監視を別スレッドで開始
    t = threading.Thread(target=mic_worker, args=(loop,), daemon=True)
    t.start()
    
    # WebSocketサーバー起動
    log(f"WebSocketサーバーを起動中: ws://{WS_HOST}:{WS_PORT}")
    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        await asyncio.Future()  # 永久待機

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log("マイクブリッジを終了しました。")
