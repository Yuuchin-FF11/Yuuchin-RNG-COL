---
name: comview_debugger
description: お給仕コメビュ（配信翻訳ツール）の不具合調査・デバッグを行う際に参照する構造マップとデバッグ手順。音声認識・SpeechSynthesis・ハートビート関連の問題調査時に自動でロードされます。
---

# お給仕コメビュ デバッグ支援スキル

## 対象ファイル構成

コメビュ本体は以下の2ディレクトリが同一内容（シンボリック的な関係）：
- `c:\Users\user\OneDrive\デスクトップ\アンチグラビティ\comment-viewer\`
- `c:\Users\user\OneDrive\デスクトップ\アンチグラビティ\コメビュ版お給仕翻訳\`

修正は必ず `comment-viewer\` 側で行い、動作確認後に両者の同期を確認すること。

主要ファイル：
- `管理ロジック.js` : メインロジック（120KB超・約2500行）。音声認識・翻訳・読み上げ・ハートビートすべてを担う。
- `管理画面.html` : 配信者が操作する管理UI
- `オーバーレイロジック.js` : OBS等に表示するオーバーレイ側のロジック
- `管理ロジック_手動専用.js` : 【編集禁止】手動専用ファイル。不具合修正・機能追加の対象外。

---

## 音声認識モジュールの設計マップ

### グローバル変数（管理ロジック.js L37〜L51付近）

| 変数名 | 型 | 役割 |
|---|---|---|
| `recognition` | SpeechRecognition \| null | 音声認識インスタンス本体 |
| `isListening` | bool | onstart後にtrue。onend後にfalse |
| `shouldBeListening` | bool | ユーザーの「ON/OFFの意思」を保持。trueなら再起動し続ける |
| `isSpeechSynthesisActive` | bool | 読み上げ（TTS）中はtrue。trueのときマイクをソフトミュート |
| `isSpeechSynthesisActiveStartTime` | number | isSpeechSynthesisActiveがtrueになった時刻（ロック時間セーフティ用） |
| `isStarting` | bool | start()を呼んだがonstart未発火の期間はtrue |
| `lastStartAttemptTime` | number | start()を呼んだ時刻（起動タイムアウト検出用） |
| `lastStartSuccessTime` | number | onstartが最後に成功した時刻（20分予防リビルド用） |
| `consecutiveErrorCount` | number | no-speechとaborted以外の連続エラー回数 |
| `lastPreventiveRebuildTime` | number | 定期予防リビルドの最終実行時刻 |
| `lastResultTime` | number | onresultが最後に発火した時刻 |
| `lastActivityTime` | number | onresultまたはonerrorが最後に発火した時刻（Edgeゾンビ状態検出用） |
| `lastErrorType` | string | 直近のエラー種別（'no-speech', 'network', 'aborted'等） |

### 主要関数と役割

- `setSpeechSynthesisActive(bool)` : TTS状態フラグのセッター。falseにした時点でマイクが停止中なら自動復帰も担う
- `triggerDelayedMicRestart()` : TTS終了後3秒遅延でソフトミュートを解除するデバウンス処理
- `initSpeechRecognition()` : 既存インスタンスを破棄して新規作成。onstart/onend/onerror/onresultを再登録する。「フルリビルド」と呼ぶ
- `reconnectSpeechRecognition()` : recognition.start()を呼ぶ。3回以上連続エラー時はinitも先に行う
- `startSpeechRecognition()` : shouldBeListeningをtrueにしてreconnectを呼ぶ。マイクONボタンから呼ばれる
- `stopSpeechRecognition()` : shouldBeListeningをfalseにしてrecognition.stop()。マイクOFFから呼ばれる
- `applySpeechCorrection(text)` : localStorageの誤字修正辞書を適用する

### ハートビート監視の構造（3〜4秒ごとのsetInterval）

以下の優先順序でチェックが走る：

1. `isSpeechSynthesisActive` が60秒超でロックされていたら強制解除
2. `!shouldBeListening || isSpeechSynthesisActive` なら以降をスキップ
3. 【最重要教訓】定期予防リビルドは完全撤廃：正常稼働中のセッションをタイマーで壊すと、非アクティブウィンドウ時にマイクが再取得できず自爆するため絶対に行わない
4. Edgeゾンビ状態検出（30分タイムアウト＋裏画面保護）：`isListening && (now - lastHealthyTime) > 30分`
   ※配信中の離席（トイレ、飲み物等）や長時間の無音で誤爆しないよう30分に設定。
   ※非アクティブ（裏画面）時はブラウザのUser Activation制限により新規リビルドが失敗してマイクが死ぬため、裏画面では勝手に破壊せず、画面フォーカス復帰時（focus）に安全に復元するフラグを立てて待機する。
5. `!isListening && isStarting && 起動から3秒超` → 起動タイムアウトとしてsafeRebuildAndRestart
6. `!isListening && !isStarting` → safeRebuildAndRestart

### visibilitychange（バックグラウンドタブ復帰）ロジック

- `isSpeechSynthesisActive` が60秒超でスタックしていたら強制解除
- `shouldBeListening && !isListening` ならinit + reconnect
- 稼働中（isListening=true）のインスタンスを時間経過で勝手にリビルドしない

---

## よくある不具合パターンと調査手順

### パターンA：「配信中に時々マイクをオンオフしないと声を拾わなくなる」

【原因の究明結果（2026-10-20特定）】：
ゲームプレイ中、Edgeは「非アクティブウィンドウ」になっている。
この状態で短時間の無言（数分間）を「ゾンビ状態」と誤認して自動リビルドを走らせると、ブラウザのUser Activation制限により、非アクティブ画面からのマイク再起動がブロックされ、マイクが停止する。
手動でマイクボタンをクリックすると「ユーザー操作」が発生するため復旧する。

【対策】：
- 正常稼働中の定期リビルド（6分や20分）を完全禁止する
- `no-speech` は正常な通信活動としてカウントし、無言による誤爆切断を防ぐ
- ゾンビ判定時間は最短でも10分以上とする

### パターンB：「マイクがONなのにコメント（吹き出し）が出ない」

調査手順：
1. Edgeの開発者ツール（F12）→ コンソールタブを「Verbose（すべて）」表示にする
2. 以下のログが出ているかを確認する：
   - `Heartbeat: Edge zombie/silent disconnect detected...` → ゾンビ検出が機能している
   - `Speech recognition was stopped during SpeechSynthesis...` → TTS後の復帰
3. ログが一切出ていない場合は、`shouldBeListening` がfalseになっている可能性を疑う

### パターンC：「マイクONにしても起動しない」

調査ポイント：
- `not-allowed` エラー → Edgeのマイク許可が切れている。URLバーの鍵アイコンから再許可
- `already started` エラーが連発 → 前のインスタンスが残っている。ページリロードで解消

### パターンD：「読み上げ（TTS）が終わった後にマイクが復帰しない」

調査ポイント：
- `isSpeechSynthesisActive` がtrueのまま固まっている可能性
- ハートビートが60秒セーフティで解除するはずなので、コンソールで `Force releasing` が出るか確認

### パターンE：「長時間の無言後にマイクが反応しなくなる（Gemini 4 Argon知見・2026-10-23特定・2026-10-24最適化）」

【原因】：
無言が一定時間続くと、Azure Cognitive ServicesがWebSocketを切断して `onerror: network` を発火する。
この切断を一般エラーとして扱い `delay = 1000`（1秒待機）の `setTimeout` に回すと、非アクティブウィンドウ時（ゲーム中）にEdgeのUser Activation制限に引っかかり、マイクが再起動不能になる。
また、50msの超極小ディレイだと裏画面で前の切断完了処理と衝突してサイレント不発になりやすく、ゾンビ検出が10分だと数分間の無言で居眠りしたままクリックされるまで復帰しない。

【対策（ハイブリッド再開設計 & ゾンビ2分短縮）】：
- 単発の `network` は「無音によるアイドル終了」とみなし、エラー加算せず `lastHealthyTime` を更新して再開。
- `onend` の再接続ディレイは「500ms（0.5秒）」。裏画面でもブラウザ内部の切断処理が安全に完了する猶予を確保しつつ、衝突を防ぐ。
- ゾンビ状態（音信不通）の検出タイマーを「10分」から「2分（120秒）」に短縮。これにより、ユーザーがクリックしなくても無言から2分で自動リビルドが走り、常時待機状態を維持する。
- 短時間（4秒以内）に連続して `network` が発生した場合は「本物の回線障害・サーバー障害」と判定し、1500ms〜5000msのバックオフ待機を入れてCPU暴走無限ループを防止。

### パターンF：「デバッグログDOM無限蓄積による長時間の描画・メモリ遅延（2026-10-23特定）」

【原因】：
デバッグログ（`#debug-log-lines`）に要素数上限がないと、毎分のキープアライブやログ出力によって数千〜数万のDOMが蓄積し、強制リフローでブラウザとゲームの動作が重くなる。

【対策】：
- `addLog` 内で `while (logLines.children.length > 100) logLines.removeChild(logLines.firstChild);` を徹底。
- `getBestVoice` などの定期呼び出し関数内での冗長な全件プロパティダンプを抑制。

---

## 修正作業時の必須ルール

1. `管理ロジック_手動専用.js`、`管理画面_手動専用.html`、`コメビュ版お給仕起動_手動専用.bat` は【編集禁止】
2. ファイル修正後は必ず `view_file` で物理的に保存確認してから報告する
3. 推測でのデバッグ禁止。必ずコンソールログで根拠を取ってから修正する
4. comment-viewer/ と コメビュ版お給仕翻訳/、および comment-viewer-v2/ の構成を正しく把握して作業すること

---

## 環境情報

- ブラウザ：Microsoft Edge（Chromiumベース）
- 音声認識バックエンド：Azure Cognitive Services（Edgeが内部利用）
- 配信環境：マルチモニター（FF11を正面モニター、Edgeを左モニターで常時表示・非最小化）
- 非アクティブ時の制約：ゲームプレイ中はEdgeがフォーカスを失うため、バックグラウンドでのマイク自動再起動（start）がブロックされやすい。セッションはできる限り切断せず維持することが鉄則。
