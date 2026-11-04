// リアルタイムデバッグログ出力システム
(function() {
    window.addEventListener('DOMContentLoaded', () => {
        const logLines = document.getElementById('debug-log-lines');
        if (!logLines) return;
        const addLog = (msg, color = '#0f0') => {
            const div = document.createElement('div');
            div.style.color = color;
            div.style.marginBottom = '4px';
            div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
            logLines.appendChild(div);
            while (logLines.children.length > 100) {
                logLines.removeChild(logLines.firstChild);
            }
            logLines.parentElement.scrollTop = logLines.parentElement.scrollHeight;
        };
        
        // 既存のconsoleをフック
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;
        
        console.log = function(...args) {
            originalLog.apply(console, args);
            addLog(args.join(' '), '#0f0');
        };
        console.warn = function(...args) {
            originalWarn.apply(console, args);
            addLog(args.join(' '), '#ff0');
        };
        console.error = function(...args) {
            originalError.apply(console, args);
            addLog(args.join(' '), '#f00');
        };
        
        window.addEventListener('error', (e) => {
            addLog(`Runtime Error: ${e.message} at ${e.filename}:${e.lineno}`, '#f00');
        });
    });
})();

// YouTube Chat Translator - 管理画面ロジック (コメビュ版・APIキー不要)

// お上品（NGワード）フィルターのロジック
function cleanMessage(text, enableFilter, customWordsString) {
    if (!text || !enableFilter) return text;
    
    const defaultNgWords = [
        'ちんちん', 'ちんこ', 'まんこ', 'おまんこ', 'うんこ', 'うんち', 
        'ぺにす', 'ペニス', 'ヴぁぎな', 'ヴァギナ', 'ばぎな', 'バギナ',
        'ちんぽ', 'チンポ', 'ま〜ん', 'まーん', 'ち〜ん', 'きんたま', '金玉',
        'おめこ', 'おちょんちん', 'ちんちー', 'おてぃんてぃん', 'ティンポ', 'てぃんぽ'
    ];
    
    let ngWords = [...defaultNgWords];
    if (customWordsString) {
        const customList = customWordsString.split(',')
            .map(w => w.trim())
            .filter(w => w.length > 0);
        ngWords = [...ngWords, ...customList];
    }
    
    let cleanedText = text;
    ngWords.forEach(word => {
        const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(escapedWord, 'gi');
        const replacement = '●'.repeat(word.length);
        cleanedText = cleanedText.replace(regex, replacement);
    });
    
    return cleanedText;
}

// 起動時刻の記録（過去ログ巻き戻り防止用）
const appLoadTime = Date.now();

// マイク・音声認識用の状態管理変数
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let shouldBeListening = false;
let isSpeechSynthesisActive = false;
let isSpeechSynthesisActiveStartTime = 0; // isSpeechSynthesisActiveがtrueになった時刻を記録
let lastSpeechSynthesisEndTime = 0; // 読み上げが終了した時刻を記録（マイクの遅延拾い込み防止用）
let lastErrorTime = 0;
let lastErrorType = '';
let isStarting = false;
let lastStartAttemptTime = 0;
let startAttemptCount = 0;
let lastStartSuccessTime = 0;
let consecutiveErrorCount = 0;
let lastPreventiveRebuildTime = 0; // 定期予防リビルドの最終実行時刻
let lastInitTime = 0; // SpeechRecognitionインスタンスを生成（init）した時刻
let lastResultTime = 0; // onresult が最後に発火した時刻
let lastActivityTime = 0; // セッション開始時刻
let lastHealthyTime = 0; // onstartまたはonresultが正常に発火した最終時刻（Edgeゾンビ状態検出の真の基点）
let lastSentSpeechText = ''; // 直前に送信した認識テキスト（二重送信防止用）
let lastSentSpeechTime = 0; // 直前に送信した時刻（二重送信防止用）
let lastNetworkErrorTime = 0; // 直近のnetworkエラー時刻
let consecutiveNetworkCount = 0; // 連続networkエラー回数

// OS直結マイクブリッジ (Python) 連携用
let micBridgeWs = null;
let isMicBridgeConnected = false;

function sendTtsStateToMicBridge(active) {
    if (micBridgeWs && micBridgeWs.readyState === WebSocket.OPEN) {
        try {
            micBridgeWs.send(JSON.stringify({ type: 'tts_state', active: !!active }));
        } catch (e) {}
    }
}

// タイマーIDの分離管理（競合防止）
window.micMuteCooldownTimeoutId = null; // 読み上げ終了後のソフトミュート解除遅延タイマー
window.micReconnectTimeoutId = null;   // 音声認識切断時の再接続待機タイマー

// 音声合成（読み上げ）の状態を切り替えるセッター関数。
// OFFになった際にマイクが意図せず停止していれば自動復帰させる
function setSpeechSynthesisActive(active) {
    isSpeechSynthesisActive = active;
    sendTtsStateToMicBridge(active);
    if (active) {
        if (typeof window.flushSpeechBuffer === 'function') {
            try { window.flushSpeechBuffer(); } catch(e) {}
        }
        isSpeechSynthesisActiveStartTime = Date.now(); // ロック開始時刻を記録
        if (window.micMuteCooldownTimeoutId) {
            clearTimeout(window.micMuteCooldownTimeoutId);
            window.micMuteCooldownTimeoutId = null;
        }
    } else {
        if (!isMicBridgeConnected && shouldBeListening && !isListening) {
            console.log('Speech recognition was stopped during SpeechSynthesis. Restarting in 300ms...');
            setTimeout(() => {
                if (shouldBeListening && !isListening && !isSpeechSynthesisActive) {
                    if (typeof window.reconnectSpeechRecognition === 'function') {
                        window.reconnectSpeechRecognition();
                    }
                }
            }, 300);
        }
    }
}

// マイク入力を無視する状態（ソフトミュート）を読み上げ終了後1.0秒間維持し、デバイス競合を防ぐデバウンス処理
function triggerDelayedMicRestart() {
    lastSpeechSynthesisEndTime = Date.now();
    if (window.micMuteCooldownTimeoutId) {
        clearTimeout(window.micMuteCooldownTimeoutId);
        window.micMuteCooldownTimeoutId = null;
    }
    
    // 読み上げ自体は終わっているが、マイクのソフトミュート解除を1.0秒遅延させる
    window.micMuteCooldownTimeoutId = setTimeout(() => {
        window.micMuteCooldownTimeoutId = null;
        lastSpeechSynthesisEndTime = Date.now();
        setSpeechSynthesisActive(false);
        console.log('Mic soft-mute released (speech synthesis active flag cleared)');
    }, 1000); // 1.0秒待ってからソフトミュートを解除
}

// --------------------------------------------------------------------------
// 直前読み上げコメントの履歴管理と音声認識被り自動切除（ストリップ）機能
// --------------------------------------------------------------------------
let recentSpokenComments = [];

// コメント読み上げ時に呼び出して履歴を蓄積
function recordSpokenComment(originalMessage, spokenText, authorName) {
    const now = Date.now();
    // 30秒以上前の古い履歴を削除
    recentSpokenComments = recentSpokenComments.filter(item => (now - item.timestamp) < 30000);
    recentSpokenComments.push({
        message: originalMessage || '',
        spokenText: spokenText || '',
        authorName: authorName || '',
        timestamp: now
    });
    if (recentSpokenComments.length > 10) {
        recentSpokenComments.shift();
    }
}
window.recordSpokenComment = recordSpokenComment;

// 音声認識テキストから直前の読み上げコメント被りを自動切除・破棄する関数
function stripSpokenCommentsFromTranscript(rawTranscript) {
    if (!rawTranscript || recentSpokenComments.length === 0) return rawTranscript;

    const now = Date.now();
    // 過去15秒以内の読み上げコメントのみを対象とする
    const activeComments = recentSpokenComments.filter(item => (now - item.timestamp) <= 15000);
    if (activeComments.length === 0) return rawTranscript;

    let currentText = rawTranscript.trim();

    for (const item of activeComments) {
        // 照合候補（読み上げ本文、元メッセージ、メンション除去後メッセージ）
        const candidates = [
            item.spokenText,
            item.message,
            item.message ? item.message.replace(/[@＠][\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\-_.]+\s*/g, '').trim() : ''
        ].filter(Boolean);

        for (const candidate of candidates) {
            const cleanCandidate = candidate.replace(/[@＠_＿\s\.,!！\?？、。]/g, '');
            if (cleanCandidate.length < 3) continue;

            const normCandidate = cleanCandidate.toLowerCase();
            const normCurrent = currentText.replace(/[@＠_＿\s\.,!！\?？、。]/g, '').toLowerCase();

            // 1. 全文一致判定（マイクが読み上げ音声だけを拾ったケース）
            if (normCurrent.includes(normCandidate) || normCandidate.includes(normCurrent)) {
                const diffLen = Math.abs(normCurrent.length - normCandidate.length);
                if (diffLen < 4) {
                    console.log(`[コメント被り遮断] 音声認識テキスト全体が直前の読み上げコメント「${candidate}」と一致したため破棄します。`);
                    return '';
                }
            }

            // 2. 先頭被り＋後半に肉声があるケースの切り落とし
            const trimmedCandidate = candidate.trim().replace(/[wW笑\s]+$/, '');
            const subPhrases = [];

            if (trimmedCandidate.length >= 4) {
                subPhrases.push(trimmedCandidate);
            }
            if (trimmedCandidate.length > 8) {
                subPhrases.push(trimmedCandidate.slice(-8));
                subPhrases.push(trimmedCandidate.slice(-12));
            }
            if (trimmedCandidate.length >= 6) {
                subPhrases.push(trimmedCandidate.slice(-6));
            }
            if (trimmedCandidate.length >= 4) {
                subPhrases.push(trimmedCandidate.slice(-4));
            }

            for (const phrase of subPhrases) {
                if (!phrase || phrase.length < 4) continue;
                const lowerCurrent = currentText.toLowerCase();
                const lowerPhrase = phrase.toLowerCase();
                const pos = lowerCurrent.indexOf(lowerPhrase);

                // フレーズが見つかり、かつそれが文章の前半〜中盤（先頭から全体の85%以内）にある場合
                if (pos !== -1 && pos < currentText.length * 0.85) {
                    const cutEnd = pos + phrase.length;
                    let remaining = currentText.slice(cutEnd);

                    // 直後に残っている可能性のある草記号（w, W, 笑）、句読点、記号を除去
                    remaining = remaining.replace(/^[wW笑\s、。,\.!\?！？]+/, '').trim();

                    if (remaining.length > 0) {
                        console.log(`[コメント被り切除] 直前読み上げフレーズ「${phrase}」との一致を検知。先頭の読み上げ部分を切除しました。残余テキスト:「${remaining}」`);
                        currentText = remaining;
                        break;
                    } else {
                        console.log(`[コメント被り遮断] 読み上げフレーズ切除後に発話が残らないため破棄します。`);
                        return '';
                    }
                }
            }
        }
    }

    return currentText;
}
window.stripSpokenCommentsFromTranscript = stripSpokenCommentsFromTranscript;

// ==========================================================================
// ハイブリッド同時通訳・音声読み上げ制御クラス (SpeechSynthesisキュー管理)
// ==========================================================================
class ReadAloudManager {
    constructor() {
        this.queue = [];
        this.speaking = false;
        this.synth = window.speechSynthesis;
        
        this.enableCheckbox = document.getElementById('enable-read-aloud');
        this.modeSelect = document.getElementById('read-aloud-mode');
        this.volumeSlider = document.getElementById('effect-volume');
        this.pitchSlider = document.getElementById('read-aloud-pitch');
        this.rateSlider = document.getElementById('read-aloud-rate');
        this.characterSelect = document.getElementById('read-aloud-character');

        this.voices = [];
        const loadVoices = () => {
            this.voices = this.synth.getVoices();
        };
        loadVoices();
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = loadVoices;
        }

        // Chrome/EdgeのSpeechSynthesisバグ対策 & オンライン音声キープアライブ
        setInterval(() => {
            if (this.synth) {
                try {
                    this.synth.resume();
                } catch(e) {}
            }
        }, 5000);

        // ※本番発話の直前に毎回ウォームアップ発話を実行しているため、
        // 競合リスクを生む60秒無音発話は撤廃し、synth.resume()のキープアライブのみで安全に維持
    }

    speak(chat) {
        if (!this.enableCheckbox || !this.enableCheckbox.checked) {
            return false;
        }

        if (chat.isBroadcaster) {
            return false;
        }

        const textsToSpeak = this.prepareTexts(chat);
        if (textsToSpeak.length === 0) return false;

        // 直近の読み上げコメントとして記録（音声認識の被り切除用）
        if (typeof recordSpokenComment === 'function') {
            recordSpokenComment(chat.message, textsToSpeak.map(t => t.text).join(' '), chat.author ? chat.author.name : '');
        }

        this.queue.push(...textsToSpeak);
        this.processQueue();
        return true;
    }

    async processQueue() {
        if (this.speaking || this.queue.length === 0) {
            return;
        }

        if (window.micMuteCooldownTimeoutId) {
            clearTimeout(window.micMuteCooldownTimeoutId);
            window.micMuteCooldownTimeoutId = null;
        }

        this.speaking = true;
        setSpeechSynthesisActive(true);

        // マイクは停止せず、ソフトミュート（無視）にするため即座に非同期処理を実行する
        setTimeout(async () => {
            const item = this.queue.shift();
            if (!item) {
                setSpeechSynthesisActive(false);
                this.speaking = false;
                return;
            }

            // 読み上げ用のテキストに変換辞書を適用
            item.text = this.applyReadingDictionary(item.text);
            
            // Edge の音声キューをクリーンにして即座に発話開始
            try {
                this.synth.cancel();
            } catch(e) {}
            await new Promise(r => setTimeout(r, 100));

                        // Edge のオンライン音声は cancel()/getVoices()/ウェイトではリセットできないため、
            // ボリューム0の極短ウォームアップ発話で接続を事前に確立してから本番発話を行う
            if (!item._isFallbackAttempted) {
                const warmupSuccess = await new Promise((resolve) => {
                    const warmup = new SpeechSynthesisUtterance('.');
                    warmup.volume = 0.01;  // ほぼ無音
                    warmup.rate = 10;      // 最速で終わらせる
                    warmup.lang = item.lang;
                    // ウォームアップにも同じオンライン音声を使って接続を確立
                    const wVoice = this.getBestVoice(item.lang);
                    if (wVoice) warmup.voice = wVoice;

                    const wTimeout = setTimeout(() => resolve(false), 3000);
                    warmup.onend = () => { clearTimeout(wTimeout); resolve(true); };
                    warmup.onerror = () => { clearTimeout(wTimeout); resolve(false); };

                    try {
                        this.synth.speak(warmup);
                    } catch(e) {
                        clearTimeout(wTimeout);
                        resolve(false);
                    }
                });

                if (!warmupSuccess) {
                    console.warn('Warmup utterance failed. Connection may be unstable...');
                    try { this.synth.cancel(); } catch(e) {}
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            // 音声リストを再取得
            this.voices = this.synth.getVoices();

            // 標準SpeechSynthesisでの読み上げ処理
            const utterance = new SpeechSynthesisUtterance(item.text);
            utterance.lang = item.lang;

            // オンライン音声のリトライ・フォールバック判定
            let bestVoice = null;
            if (item._isFallbackAttempted === 2) {
                // 最終フォールバック：ローカルオフライン音声（Microsoft Harukaなど）を選択
                bestVoice = this.getBestLocalVoice(item.lang);
            } else {
                // 通常時および1回目のリトライ時：ななみちゃん（Online音声）を選択
                bestVoice = this.getBestVoice(item.lang);
            }
            if (bestVoice) {
                if (bestVoice.name.includes('undefined')) {
                    console.log('[音声選択] 選択された音声に undefined が含まれるため、utterance.voice には設定せず、lang 設定のみでブラウザの自動解決（ななみちゃん）に委ねます');
                } else {
                    utterance.voice = bestVoice;
                }
            }

            if (this.volumeSlider) {
                utterance.volume = parseInt(this.volumeSlider.value) / 100;
            } else {
                utterance.volume = 1.0;
            }

            if (this.pitchSlider) {
                utterance.pitch = parseFloat(this.pitchSlider.value);
            } else {
                utterance.pitch = 1.2;
            }

            if (this.rateSlider) {
                utterance.rate = parseFloat(this.rateSlider.value);
            } else {
                utterance.rate = 1.1;
            }

            // GCからUtteranceオブジェクトを保護
            if (!window.activeUtterances) { window.activeUtterances = []; }
            window.activeUtterances.push(utterance);

            const resumeRecognition = () => {
                lastSpeechSynthesisEndTime = Date.now();
                triggerDelayedMicRestart();
            };

            const cleanUtterance = () => {
                if (window.activeUtterances) {
                    window.activeUtterances = window.activeUtterances.filter(u => u !== utterance);
                }
            };

            // 長文コメントも途中で途切れず読み切れるよう、文字数に応じた動的タイムアウトを最適化
            // （1文字あたり350ms + 最低8秒、上限45秒）
            const textLen = (item.text || '').length;
            const calcTimeout = Math.min(45000, Math.max(8000, textLen * 350 + 8000));
            const watchdogId = setTimeout(() => {
                console.warn(`SpeechSynthesis output timed out (${calcTimeout}ms). Forcing next queue...`);
                // タイムアウト時はイベントの競合を防ぐため、イベントハンドラを無効化してから cancel します
                utterance.onend = null;
                utterance.onerror = null;
                try {
                    this.synth.cancel(); // タイムアウト時のみ、詰まりを解消するために cancel を実行
                } catch(err) {}
                cleanUtterance();
                resumeRecognition();
                this.speaking = false;
                this.processQueue();
            }, calcTimeout);

            utterance.onend = () => {
                clearTimeout(watchdogId);
                cleanUtterance();
                // 読み上げ完了直後に cancel() を呼び、Edgeのオンライン音声サーバー接続を即座に切断
                // これにより次の speak() 時に古い接続との競合を防ぐ
                try { this.synth.cancel(); } catch(err) {}
                resumeRecognition();
                this.speaking = false;
                setTimeout(() => this.processQueue(), 250);
            };

            utterance.onerror = (e) => {
                clearTimeout(watchdogId);
                console.error('SpeechSynthesis error:', e.error || e); // 詳細なエラー原因を出力
                cleanUtterance();

                try {
                    // タイムアウトや意図的な cancel() による中断（interrupted）や強制終了（aborted）の場合はリトライ・フォールバックを行いません
                    if (e.error === 'interrupted' || e.error === 'aborted') {
                        console.log(`SpeechSynthesis aborted or interrupted (${e.error}). No retry.`);
                    } else if (bestVoice && bestVoice.name && bestVoice.name.includes('Online')) {
                        // ななみちゃん（Online音声）での再生が接続断などで本当に失敗した場合（synthesis-failedなど）のみリトライします
                        if (!item._isFallbackAttempted) {
                            // 1度目の失敗：1.5秒待ってから、ななみちゃんのままでもう一度再試行する
                            console.warn('Online voice failed. Retrying with same Online voice after 1.5s...');
                            item._isFallbackAttempted = 1; // 1回目試行完了
                            // エラー状態の音声エンジンをリセットしてからリトライ
                            try { this.synth.cancel(); } catch(err) {}
                            this.queue.unshift(item);
                            // 再試行のウェイト中はマイクを起動させずOFFのままキープ
                            this.speaking = false;
                            setTimeout(() => this.processQueue(), 1500); // 1.5秒のウェイトを置いて再試行
                            return;
                        } else if (item._isFallbackAttempted === 1) {
                            // 2度目の失敗（ななみちゃんでリトライしたのにダメだった場合）：最終手段として Haruka などのローカルオフライン音声へフォールバック
                            console.warn('Online voice failed again. Falling back to local offline voice...');
                            item._isFallbackAttempted = 2; // 2回目（最終）フォールバック
                            // Edgeの音声エンジンがエラー状態のまま残っているため、cancel()で内部状態を強制リセットしてから十分な回復時間を置く
                            try { this.synth.cancel(); } catch(err) {}
                            this.queue.unshift(item);
                            // 再試行のウェイト中はマイクを起動させずOFFのままキープ
                            this.speaking = false;
                            setTimeout(() => this.processQueue(), 1500); // 1.5秒待って音声エンジン回復後に Haruka で再試行
                            return;
                        }
                    }
                } catch (err) {
                    console.error('Error in SpeechSynthesis error handler recovery:', err);
                }

                // いかなる想定外のエラーが起きても、確実にキュー処理とマイクをONに戻すセーフティネット
                resumeRecognition();
                this.speaking = false;
                setTimeout(() => this.processQueue(), 250);
            };

            try {
                this.synth.speak(utterance);
            } catch (err) {
                console.error('Failed to trigger synth.speak:', err);
                clearTimeout(watchdogId);
                cleanUtterance();
                resumeRecognition();
                this.speaking = false;
                setTimeout(() => this.processQueue(), 250);
            }
        }, 0);
    }

    clear() {
        this.queue = [];
        this.synth.cancel();
        this.speaking = false;
    }

    getBestVoice(lang) {
        if (!this.voices || this.voices.length === 0) {
            this.voices = this.synth.getVoices();
        }
        // 言語コードでフィルタ
        const langVoices = this.voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(lang.toLowerCase()));

        // 音声一覧の詳細ログは初回のみ出力し、毎分のキープアライブ等でのDOM圧迫を防止
        if (!this._hasLoggedVoices) {
            this._hasLoggedVoices = true;
            console.log(`[音声選択] 音声取得試行. 全音声数: ${this.voices.length} 件`);
            langVoices.forEach(v => {
                console.log(`[音声詳細] 名前: ${v.name} | URI: ${v.voiceURI} | ローカル: ${v.localService}`);
            });
        }

        if (langVoices.length === 0) {
            console.warn(`[音声選択警告] ${lang} に一致する音声がブラウザで見つかりませんでした。デフォルト音声にフォールバックします。`);
            return null;
        }

        let selected = null;
        if (lang.toLowerCase().startsWith('ja')) {
            // ななみちゃん（Nanami）の名前が含まれるものを最優先で厳密に探す
            const nanami = langVoices.find(v => v.name.includes('Nanami'));
            if (nanami) {
                selected = nanami;
                console.log(`[音声選択] ななみちゃんを特定して選択しました: ${selected.name}`);
            } else {
                // もし名前が undefined に化けている場合（バグ発生時）の、Onlineかつ女性音声のフォールバック
                const onlineVoices = langVoices.filter(v => (v.name.includes('Natural') || v.name.includes('Online')) && !v.name.includes('Keita') && !v.name.includes('Ichiro'));
                if (onlineVoices.length > 0) {
                    selected = onlineVoices[0];
                    console.log(`[音声選択] 化けたオンライン音声（女性）から特定しました: ${selected.name}`);
                } else {
                    const google = langVoices.find(v => v.name.includes('Google') || v.name.includes('日本語'));
                    if (google) { selected = google; }
                    else {
                        const haruka = langVoices.find(v => v.name.includes('Haruka'));
                        if (haruka) { selected = haruka; }
                        else {
                            const ayumi = langVoices.find(v => v.name.includes('Ayumi'));
                            if (ayumi) { selected = ayumi; }
                        }
                    }
                }
            }
        } else if (lang.toLowerCase().startsWith('en')) {
            const googleEn = langVoices.find(v => v.name.includes('Google') || v.name.includes('US English'));
            if (googleEn) { selected = googleEn; }
            else {
                const zira = langVoices.find(v => v.name.includes('Zira') || v.name.includes('Hazel'));
                if (zira) { selected = zira; }
            }
        } else if (lang.toLowerCase().startsWith('ko')) {
            const heami = langVoices.find(v => v.name.includes('Heami') || v.name.includes('Google'));
            if (heami) { selected = heami; }
        }

        if (!selected) {
            selected = langVoices[0];
        }
        console.log(`[音声選択] 選択された音声: ${selected ? selected.name : 'なし'} (lang: ${selected ? selected.lang : 'N/A'})`);
        return selected;
    }

    getBestLocalVoice(lang) {
        if (!this.voices || this.voices.length === 0) {
            this.voices = this.synth.getVoices();
        }

        // localService === true の音声だけを対象にする（サーバー依存音声を完全に除外）
        const langVoices = this.voices.filter(v =>
            v.localService === true &&
            v.lang.toLowerCase().replace('_', '-').startsWith(lang.toLowerCase()) &&
            !v.name.includes('undefined')
        );

        if (langVoices.length === 0) {
            console.warn('[フォールバック] ローカルの日本語音声が見つかりません。読み上げをスキップします。');
            return null;
        }

        if (lang.toLowerCase().startsWith('ja')) {
            const haruka = langVoices.find(v => v.name.includes('Haruka'));
            if (haruka) return haruka;
            const ayumi = langVoices.find(v => v.name.includes('Ayumi'));
            if (ayumi) return ayumi;
        } else if (lang.toLowerCase().startsWith('en')) {
            const zira = langVoices.find(v => v.name.includes('Zira'));
            if (zira) return zira;
        }

        return langVoices[0]; // ローカル音声の中から最初のものを返す
    }

    makeNaturalText(text) {
        if (!text) return '';
        let cleaned = text;
        // YouTube等の返信メンション（@ユーザー名 / ＠ユーザー名）を除去して、
        // 「アットマークゼータアンダーライン...」のような不快・長大な記号読み上げを防止
        cleaned = cleaned.replace(/[@＠][\w\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\-_.]+\s*/g, '');
        cleaned = cleaned.replace(/楽しみ/g, 'たのしみ');
        cleaned = cleaned.replace(/楽しんで/g, 'たのしんで');
        cleaned = cleaned.replace(/楽しむ/g, 'たのしむ');
        cleaned = cleaned.replace(/楽しかった/g, 'たのしかった');
        cleaned = cleaned.replace(/こんにちは/g, 'こんにちわ');
        cleaned = cleaned.replace(/こんばんは/g, 'こんばんわ');
        cleaned = cleaned.replace(/ー+/g, 'ーー');
        cleaned = cleaned.replace(/[〜～]+/g, 'ーー');
        cleaned = cleaned.replace(/[!?！？]+/g, '！ ');
        cleaned = cleaned.replace(/\s+/g, '、');
        return cleaned;
    }

    isJapanese(text) {
        const jpRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
        return jpRegex.test(text);
    }

    prepareTexts(chat) {
        const mode = this.modeSelect ? this.modeSelect.value : 'native_only';
        const authorName = chat.author.name;

        let enableNsfwFilter = true;
        let nsfwWords = '';
        try {
            const savedSettings = localStorage.getItem('yt_translator_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                enableNsfwFilter = settings.enableNsfwFilter !== undefined ? settings.enableNsfwFilter : true;
                nsfwWords = settings.nsfwWords || '';
            }
        } catch (e) {}

        const originalCleaned = cleanMessage(chat.message || '', enableNsfwFilter, nsfwWords);
        const translationCleaned = cleanMessage(chat.translation || '', enableNsfwFilter, nsfwWords);

        const originalText = this.makeNaturalText(originalCleaned);
        const translationText = this.makeNaturalText(translationCleaned);

        let prefix = '';
        if (chat.isSuperChat) {
            prefix = 'プレミアムスーパーチャット！';
        } else if (chat.isMembership) {
            prefix = '新規メンバー加入！';
        }

        const isJp = this.isJapanese(originalText) || !chat.needTranslation;
        const result = [];

        if (isJp) {
            let readText = '';
            if (prefix) {
                readText += `${prefix}、${authorName}さんより、`;
            } else {
                readText += `${authorName}さん、`;
            }
            readText += originalText;
            result.push({ text: readText, lang: 'ja-JP' });
        } else {
            const foreignLang = this.detectForeignLang(originalText);

            if (mode === 'native_only') {
                let readText = '';
                if (prefix) {
                    readText += `${prefix}、`;
                }
                readText += `${authorName}、${originalText}`;
                result.push({ text: readText, lang: foreignLang });
            } else if (mode === 'interpreter') {
                let readTextOriginal = '';
                if (prefix) {
                    readTextOriginal += `${prefix}、`;
                }
                readTextOriginal += `${authorName}、${originalText}`;
                result.push({ text: readTextOriginal, lang: foreignLang });

                let readTextTrans = `日本語訳、${translationText}`;
                result.push({ text: readTextTrans, lang: 'ja-JP' });
            } else if (mode === 'translation_only') {
                let readText = '';
                if (prefix) {
                    readText += `${prefix}、${authorName}さんより、`;
                } else {
                    readText += `${authorName}さん、`;
                }
                readText += translationText;
                result.push({ text: readText, lang: 'ja-JP' });
            }
        }

        return result;
    }

    detectForeignLang(text) {
        const koRegex = /[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF\uD7B0-\uD7FF]/;
        if (koRegex.test(text)) {
            return 'ko-KR';
        }
        return 'en-US';
    }

    applyReadingDictionary(text) {
        if (!text) return text;
        let dict = [];
        try {
            const saved = localStorage.getItem('yt_translator_reading_dict');
            if (saved) {
                dict = JSON.parse(saved);
            }
        } catch(e) {
            console.error('Failed to parse reading dictionary:', e);
        }
        
        if (!Array.isArray(dict) || dict.length === 0) {
            return text;
        }
        
        // 長い単語から順にソートして、部分一致による誤置換を防ぐ
        const sortedDict = [...dict].sort((a, b) => b.word.length - a.word.length);
        
        let result = text;
        for (const item of sortedDict) {
            if (!item.word) continue;
            const escapedWord = item.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(escapedWord, 'gi');
            result = result.replace(regex, item.reading || '');
        }
        return result;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const readAloudManager = new ReadAloudManager();

    const liveUrlInput = document.getElementById('live-url');
    const btnConnect = document.getElementById('btn-connect');
    const btnDetectLive = document.getElementById('btn-detect-live');
    const btnSave = document.getElementById('btn-save');
    const connectionStatus = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    
    const obsLinkCard = document.getElementById('obs-link-card');
    const obsUrlInput = document.getElementById('obs-url');
    const btnCopyUrl = document.getElementById('btn-copy-url');
    
    const filterForeignCheckbox = document.getElementById('filter-foreign');
    const enableJpTranslationCheckbox = document.getElementById('enable-jp-translation');
    const enableNsfwFilterCheckbox = document.getElementById('enable-nsfw-filter');
    const nsfwWordsInput = document.getElementById('nsfw-words');

    const enableReadAloudCheckbox = document.getElementById('enable-read-aloud');
    const readAloudModeSelect = document.getElementById('read-aloud-mode');
    const readAloudCharacterSelect = document.getElementById('read-aloud-character');
    const readAloudPitchSlider = document.getElementById('read-aloud-pitch');
    const readAloudPitchVal = document.getElementById('read-aloud-pitch-val');
    const readAloudRateSlider = document.getElementById('read-aloud-rate');
    const readAloudRateVal = document.getElementById('read-aloud-rate-val');

    const effectVolumeSlider = document.getElementById('effect-volume');
    const effectVolumeVal = document.getElementById('effect-volume-val');
    const btnTestSound = document.getElementById('btn-test-sound');

    const btnMicToggle = document.getElementById('btn-mic-toggle');
    const micDot = document.getElementById('mic-dot');
    const micBtnText = document.getElementById('mic-btn-text');
    const micStatus = document.getElementById('mic-status');
    const broadcasterTextInput = document.getElementById('broadcaster-text-input');
    const btnSendBroadcasterText = document.getElementById('btn-send-broadcaster-text');
    
    const fontSizeSlider = document.getElementById('font-size');
    const fontSizeVal = document.getElementById('font-size-val');
    const transSizeSlider = document.getElementById('trans-size');
    const transSizeVal = document.getElementById('trans-size-val');
    const displayTimeSlider = document.getElementById('display-time');
    const displayTimeVal = document.getElementById('display-time-val');
    const maxCommentsSlider = document.getElementById('max-comments');
    const maxCommentsVal = document.getElementById('max-comments-val');
    
    const btnTestEn = document.getElementById('btn-test-en');
    const btnTestKr = document.getElementById('btn-test-kr');
    const btnTestJp = document.getElementById('btn-test-jp');
    const btnClearTest = document.getElementById('btn-clear-test');
    const testInfoText = document.getElementById('test-info-text');

    const iframe = document.getElementById('youtube-chat-iframe');
    let chatObserver = null;

    function setupSlider(slider, valueDisplay, unit = 'px', customFormatter = null) {
        slider.addEventListener('input', () => {
            if (customFormatter) {
                valueDisplay.textContent = customFormatter(slider.value);
            } else {
                valueDisplay.textContent = `${slider.value}${unit}`;
            }
        });
    }
    setupSlider(fontSizeSlider, fontSizeVal, 'px');
    setupSlider(transSizeSlider, transSizeVal, 'px');
    setupSlider(effectVolumeSlider, effectVolumeVal, '%');

    const displayTimeFormatter = (val) => {
        return parseInt(val) === 61 ? '無制限 ' : `${val}秒`;
    };
    setupSlider(displayTimeSlider, displayTimeVal, '秒', displayTimeFormatter);
    setupSlider(maxCommentsSlider, maxCommentsVal, '個');

    const pitchFormatter = (val) => {
        const num = parseFloat(val);
        if (num >= 1.5) return `${val} (アニメ声・超かわいい)`;
        if (num >= 1.2) return `${val} (少し高め・明るく自然)`;
        if (num > 1.0) return `${val} (高め・かわいい)`;
        if (num < 0.9) return `${val} (低音ボイス)`;
        return `${val} (標準の高さ)`;
    };
    const rateFormatter = (val) => {
        const num = parseFloat(val);
        if (num > 1.1) return `${val} (少し早め)`;
        if (num < 0.9) return `${val} (ゆっくり)`;
        return `${val} (標準の速さ)`;
    };
    if (readAloudPitchSlider && readAloudPitchVal) {
        setupSlider(readAloudPitchSlider, readAloudPitchVal, '', pitchFormatter);
    }
    if (readAloudRateSlider && readAloudRateVal) {
        setupSlider(readAloudRateSlider, readAloudRateVal, '', rateFormatter);
    }

    // ==========================================================================
    // 効果音プリロードシステム（バックグラウンドタブでも確実に再生するため）
    // HTML5 Audio はバックグラウンドタブでブラウザにブロックされるため、
    // AudioContext + プリロード済み AudioBuffer を使って再生する
    // ==========================================================================
    let effectAudioCtx = null;
    const preloadedSoundBuffers = {};

    async function initEffectAudioPreload() {
        try {
            effectAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            for (const num of [1, 2]) {
                const response = await fetch(`効果音/レベルアップ_${num}.mp3`);
                const arrayBuffer = await response.arrayBuffer();
                preloadedSoundBuffers[num] = await effectAudioCtx.decodeAudioData(arrayBuffer);
            }
            console.log('効果音プリロード完了');
        } catch (err) {
            console.warn('効果音プリロード失敗（HTML5 Audio にフォールバックします）:', err);
        }
    }

    // サイレントオーディオ再生によるバックグラウンドタブのスロットリング回避
    // AudioContextで無音のオシレーターを常時再生し、ブラウザに「音声再生中のタブ」と認識させる。
    // 音声再生中のタブはsetIntervalのスロットリングが免除されるため、
    // ハートビートや予防リビルドが設計通りの間隔で動作する。
    let silentOscillatorStarted = false;
    function startSilentAudio() {
        if (silentOscillatorStarted || !effectAudioCtx || effectAudioCtx.state !== 'running') return;
        try {
            const oscillator = effectAudioCtx.createOscillator();
            const gainNode = effectAudioCtx.createGain();
            gainNode.gain.value = 0; // 完全無音
            oscillator.connect(gainNode);
            gainNode.connect(effectAudioCtx.destination);
            oscillator.start();
            silentOscillatorStarted = true;
            console.log('Silent audio started for background tab throttling prevention.');
        } catch(e) {
            console.warn('Failed to start silent audio:', e);
        }
    }

    function unlockEffectAudioCtx() {
        if (effectAudioCtx && effectAudioCtx.state === 'suspended') {
            effectAudioCtx.resume().catch(() => {});
            console.log('AudioContext アンロック完了');
        }
        startSilentAudio();
    }
    document.addEventListener('click', unlockEffectAudioCtx);
    document.addEventListener('keydown', unlockEffectAudioCtx);

    // AudioContext のバックグラウンド・サスペンド復帰用
    setInterval(() => {
        if (effectAudioCtx && effectAudioCtx.state === 'suspended') {
            effectAudioCtx.resume().catch(() => {});
        }
        startSilentAudio();
    }, 10000);

    function playEffectSound(soundNum, volume) {
        return new Promise((resolve) => {
            if (effectAudioCtx && effectAudioCtx.state === 'running' && preloadedSoundBuffers[soundNum]) {
                try {
                    const source = effectAudioCtx.createBufferSource();
                    source.buffer = preloadedSoundBuffers[soundNum];
                    const gainNode = effectAudioCtx.createGain();
                    gainNode.gain.value = volume;
                    source.connect(gainNode);
                    gainNode.connect(effectAudioCtx.destination);
                    source.onended = () => {
                        // 再生終了時にオーディオ接続を明示的に解除してリソースを解放する
                        source.disconnect();
                        gainNode.disconnect();
                        resolve(true);
                    };
                    source.start(0);
                    return;
                } catch (e) {
                    console.warn('AudioContext 再生失敗、HTML5 Audio にフォールバック:', e);
                }
            }
            try {
                const audio = new Audio(`効果音/レベルアップ_${soundNum}.mp3?v=${Date.now()}`);
                audio.volume = volume;
                if (!window.activeAudios) { window.activeAudios = []; }
                window.activeAudios.push(audio);
                const clean = () => {
                    if (window.activeAudios) {
                        window.activeAudios = window.activeAudios.filter(a => a !== audio);
                    }
                };
                audio.onended = () => { clean(); resolve(true); };
                audio.onerror = () => { clean(); resolve(false); };
                audio.play().catch(() => { clean(); resolve(false); });
            } catch (e) {
                resolve(false);
            }
        });
    }

    initEffectAudioPreload();

    function loadSettings() {
        const savedSettings = localStorage.getItem('yt_translator_settings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                liveUrlInput.value = settings.liveUrl || '';
                
                fontSizeSlider.value = settings.fontSize || 16;
                fontSizeVal.textContent = `${fontSizeSlider.value}px`;
                
                transSizeSlider.value = settings.transSize || 15;
                transSizeVal.textContent = `${transSizeSlider.value}px`;
                
                displayTimeSlider.value = settings.displayTime || 15;
                displayTimeVal.textContent = displayTimeFormatter(displayTimeSlider.value);
                
                maxCommentsSlider.value = settings.maxComments || 6;
                maxCommentsVal.textContent = `${maxCommentsSlider.value}個`;

                effectVolumeSlider.value = settings.effectVolume !== undefined ? settings.effectVolume : 90;
                effectVolumeVal.textContent = `${effectVolumeSlider.value}%`;
                
                if (filterForeignCheckbox) {
                    filterForeignCheckbox.checked = settings.filterForeign || false;
                }

                if (enableJpTranslationCheckbox) {
                    enableJpTranslationCheckbox.checked = settings.enableJpTranslation || false;
                }

                if (enableNsfwFilterCheckbox) {
                    enableNsfwFilterCheckbox.checked = settings.enableNsfwFilter !== undefined ? settings.enableNsfwFilter : true;
                }
                if (nsfwWordsInput) {
                    nsfwWordsInput.value = settings.nsfwWords || '';
                }

                if (enableReadAloudCheckbox) {
                    enableReadAloudCheckbox.checked = settings.enableReadAloud !== undefined ? settings.enableReadAloud : true;
                }

                if (readAloudModeSelect) {
                    readAloudModeSelect.value = settings.readAloudMode || 'native_only';
                }

                if (readAloudCharacterSelect) {
                    readAloudCharacterSelect.value = settings.readAloudCharacter || 'standard';
                }

                if (readAloudPitchSlider && readAloudPitchVal) {
                    readAloudPitchSlider.value = settings.readAloudPitch !== undefined ? settings.readAloudPitch : 1.2;
                    readAloudPitchVal.textContent = pitchFormatter(readAloudPitchSlider.value);
                }

                if (readAloudRateSlider && readAloudRateVal) {
                    readAloudRateSlider.value = settings.readAloudRate !== undefined ? settings.readAloudRate : 1.1;
                    readAloudRateVal.textContent = rateFormatter(readAloudRateSlider.value);
                }
                
                showStatus('disconnected', '設定をロードしました');
            } catch (e) {
                console.error('Failed to parse settings:', e);
            }
        }
    }
    loadSettings();

    function getSettingsObject() {
        return {
            liveUrl: liveUrlInput.value.trim(),
            fontSize: parseInt(fontSizeSlider.value),
            transSize: parseInt(transSizeSlider.value),
            displayTime: parseInt(displayTimeSlider.value),
            maxComments: parseInt(maxCommentsSlider.value),
            effectVolume: parseInt(effectVolumeSlider.value),
            filterForeign: filterForeignCheckbox ? filterForeignCheckbox.checked : false,
            enableJpTranslation: enableJpTranslationCheckbox ? enableJpTranslationCheckbox.checked : false,
            enableNsfwFilter: enableNsfwFilterCheckbox ? enableNsfwFilterCheckbox.checked : true,
            nsfwWords: nsfwWordsInput ? nsfwWordsInput.value.trim() : '',
            enableReadAloud: enableReadAloudCheckbox ? enableReadAloudCheckbox.checked : true,
            readAloudMode: readAloudModeSelect ? readAloudModeSelect.value : 'native_only',
            readAloudCharacter: readAloudCharacterSelect ? readAloudCharacterSelect.value : 'standard',
            readAloudPitch: readAloudPitchSlider ? parseFloat(readAloudPitchSlider.value) : 1.2,
            readAloudRate: readAloudRateSlider ? parseFloat(readAloudRateSlider.value) : 1.1
        };
    }

    function showStatus(type, text) {
        connectionStatus.className = `status-indicator status-${type}`;
        statusText.textContent = text;
    }

    function extractVideoId(urlOrId) {
        if (!urlOrId) return '';
        const trimmed = urlOrId.trim();
        if (trimmed.length === 11) return trimmed;
        
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|live\/)([^#\&\?]*).*/;
        const match = trimmed.match(regExp);
        return (match && match[2].length === 11) ? match[2] : '';
    }

    if (btnTestSound) {
        btnTestSound.addEventListener('click', () => {
            try {
                const vol = parseInt(effectVolumeSlider.value) / 100;
                const soundNum = Math.random() < 0.5 ? 1 : 2;
                const soundFile = `効果音/レベルアップ_${soundNum}.mp3?v=${Date.now()}`;
                const audio = new Audio(soundFile);
                audio.volume = vol;
                audio.play().catch(err => console.log('Audio test blocked by browser:', err));
                
                localStorage.setItem('yt_translator_test_sound_trigger', JSON.stringify({
                    time: Date.now().toString(),
                    num: soundNum
                }));
            } catch (err) {
                console.error('Audio test failed:', err);
            }
        });
    }

    btnSave.addEventListener('click', () => {
        const settings = getSettingsObject();
        localStorage.setItem('yt_translator_settings', JSON.stringify(settings));
        localStorage.setItem('yt_translator_live_settings', JSON.stringify(settings));
        
        showStatus('connected', '設定を保存しました');
        setTimeout(() => {
            if (chatObserver) {
                showStatus('connected', 'チャット監視中');
            } else {
                showStatus('disconnected', '接続準備完了');
            }
        }, 2000);
    });

    // ==========================================================================
    // 配信枠の自動取得ロジック（CORS無効化 Edge経由でのスクレイピング）
    // ==========================================================================
    if (btnDetectLive) {
        btnDetectLive.addEventListener('click', async () => {
            const channelId = 'UCmqjbqc6hR8s4Fwi9KDQ2yQ';
            showStatus('connecting', '配信枠を自動確認中...');
            
            try {
                // CORS無効化されたEdgeで実行されるため、直接フェッチが可能です
                const response = await fetch(`https://www.youtube.com/channel/${channelId}/live`);
                if (!response.ok) {
                    throw new Error('フェッチに失敗しました');
                }
                
                const html = await response.text();
                console.log('Detect Live HTML loaded. Length:', html.length);
                
                let videoId = '';
                
                // 1. canonicalリンクから抽出を試みる
                const canonicalMatch = html.match(/<link rel="canonical" href="[^"]*(?:watch\?v=|embed\/|live\/)([a-zA-Z0-9_-]{11})"/);
                if (canonicalMatch) {
                    videoId = canonicalMatch[1];
                    console.log('Detected videoId from canonical:', videoId);
                }
                
                // 2. もし見つからなければ、ytInitialPlayerResponse の videoId から抽出を試みる
                if (!videoId) {
                    const videoIdMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
                    if (videoIdMatch) {
                        videoId = videoIdMatch[1];
                        console.log('Detected videoId from ytInitialPlayerResponse:', videoId);
                    }
                }
                
                // 3. それでも見つからなければ、一般的な watch?v= から抽出を試みる
                if (!videoId) {
                    const generalMatch = html.match(/(?:watch\?v=|embed\/|live\/)([a-zA-Z0-9_-]{11})/);
                    if (generalMatch) {
                        videoId = generalMatch[1];
                        console.log('Detected videoId from general matches:', videoId);
                    }
                }
                
                if (videoId) {
                    liveUrlInput.value = videoId;
                    showStatus('connected', '配信枠を検出しました！');
                    
                    // 設定を自動保存
                    const settings = getSettingsObject();
                    localStorage.setItem('yt_translator_settings', JSON.stringify(settings));
                    localStorage.setItem('yt_translator_live_settings', JSON.stringify(settings));
                } else {
                    alert('現在、ライブ配信が検出できませんでした。配信が開始されているかご確認ください');
                    showStatus('disconnected', '配信枠が検出できませんでした');
                }
            } catch (err) {
                console.error('配信枠の自動検出エラー:', err);
                alert('配信枠の自動取得中にエラーが発生しました。手動でURLを入力してください');
                showStatus('disconnected', '自動取得エラー');
            }
        });
    }

    // ==========================================================================
    // コメビュ版 (CORS無効 Edge iframe 接続ロジック)
    // ==========================================================================
    btnConnect.addEventListener('click', () => {
        const liveUrl = liveUrlInput.value.trim();
        const videoId = extractVideoId(liveUrl);
        
        if (!videoId) {
            alert('有効なYouTube配信URLまたは動画IDを入力してください！');
            liveUrlInput.focus();
            return;
        }

        // iframeのソースを設定して読み込みを開始
        showStatus('connecting', 'YouTubeに接続中...');
        iframe.src = `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${window.location.hostname}`;

        // OBS用リンクの生成 (オーバーレイ.htmlの場所を取得)
        let overlayPath = window.location.href
            .replace('管理画面.html', 'overlay.html')
            .replace('admin.html', 'overlay.html');
        if (!overlayPath.includes('overlay.html') && !overlayPath.includes('overlay.html')) {
            overlayPath = overlayPath + (overlayPath.endsWith('/') ? '' : '/') + 'overlay.html';
        }

        const settings = getSettingsObject();
        localStorage.setItem('yt_translator_settings', JSON.stringify(settings));

        const finalTime = settings.displayTime === 61 ? 0 : settings.displayTime;
        const obsUrl = `${overlayPath}?v=${encodeURIComponent(videoId)}&size=${settings.fontSize}&tsize=${settings.transSize}&time=${finalTime}&max=${settings.maxComments}&filter=${settings.filterForeign ? 1 : 0}&cb=${Date.now()}`;
        
        obsUrlInput.value = obsUrl;
        obsLinkCard.style.display = 'block';
        obsLinkCard.scrollIntoView({ behavior: 'smooth' });
    });

    iframe.addEventListener('load', () => {
        console.log('Iframe loaded! Starting chat observation...');
        showStatus('connecting', 'チャット読込完了、監視中');
        startIframeObservation();
    });

    function startIframeObservation() {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc) {
                console.error('Cannot access iframe document');
                showStatus('disconnected', 'CORS解除Edgeでのみ動作します');
                return;
            }

            // YouTubeのガイドライン・ログイン警告ポップアップ非表示 ＋ 強制ダークモード化（黒背景・白文字）
            try {
                if (!iframeDoc.getElementById('custom-hide-overlay-style')) {
                    const hideStyle = iframeDoc.createElement('style');
                    hideStyle.id = 'custom-hide-overlay-style';
                    hideStyle.textContent = `
                        html, body, yt-live-chat-renderer, yt-live-chat-item-list-renderer {
                            background-color: #0f172a !important;
                            color: #ffffff !important;
                        }
                        yt-live-chat-text-message-renderer #message {
                            color: #ffffff !important;
                        }
                        /* 一般リスナーの名前 */
                        yt-live-chat-text-message-renderer #author-name {
                            color: #cbd5e1 !important;
                        }
                        /* 配信者（オーナー）のバッジ：背景黄色・文字色黒ではっきり視認可能に */
                        yt-live-chat-text-message-renderer[author-type="owner"] #author-name,
                        yt-live-chat-author-chip[is-highlighted] #author-name,
                        yt-live-chat-text-message-renderer[author-type="owner"] yt-live-chat-author-chip,
                        #author-name.owner {
                            color: #000000 !important;
                            background-color: #ffd600 !important;
                            border-radius: 4px !important;
                            font-weight: 700 !important;
                        }
                        /* モデレーターの名前：爽やかな水色 */
                        yt-live-chat-text-message-renderer[author-type="moderator"] #author-name,
                        #author-name.moderator {
                            color: #60a5fa !important;
                        }
                        yt-live-chat-viewer-engagement-message-renderer,
                        tp-yt-paper-dialog,
                        yt-live-chat-dialog-renderer,
                        yt-live-chat-restricted-participation-renderer,
                        #action-panel,
                        #input-panel,
                        yt-live-chat-message-input-header-renderer,
                        yt-live-chat-message-input-renderer,
                        yt-button-renderer#signup-button,
                        #picker-buttons,
                        yt-live-chat-header-renderer {
                            display: none !important;
                        }
                    `;
                    (iframeDoc.head || iframeDoc.documentElement).appendChild(hideStyle);
                }
            } catch (styleErr) {
                console.warn('Failed to inject hide style:', styleErr);
            }

            const targetContainer = iframeDoc.querySelector('#chat-items') || iframeDoc.querySelector('yt-live-chat-item-list-renderer');
            
            if (targetContainer) {
                console.log('Chat container found! Starting observer...');
                setupObserver(targetContainer);
                showStatus('connected', 'チャット監視中');
            } else {
                console.log('Chat container not found yet. Retrying in 1s...');
                setTimeout(startIframeObservation, 1000);
            }
        } catch (e) {
            console.error('Error starting iframe observation:', e);
            showStatus('disconnected', '接続エラー（F12で詳細を確認）');
        }
    }

    function setupObserver(targetNode) {
        if (chatObserver) {
            chatObserver.disconnect();
        }

        chatObserver = new MutationObserver((mutations) => {
            mutations.forEach((mut) => {
                mut.addedNodes.forEach((node) => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return;
                    
                    let chatItem = null;
                    let isSuperChat = false;
                    let isMembership = false;
                    
                    if (node.tagName.toLowerCase() === 'yt-live-chat-text-message-renderer') {
                        chatItem = node;
                    } else if (node.tagName.toLowerCase() === 'yt-live-chat-paid-message-renderer') {
                        chatItem = node;
                        isSuperChat = true;
                    } else if (node.tagName.toLowerCase() === 'yt-live-chat-membership-item-renderer') {
                        chatItem = node;
                        isMembership = true;
                    } else {
                        chatItem = node.querySelector('yt-live-chat-text-message-renderer');
                        if (!chatItem) {
                            chatItem = node.querySelector('yt-live-chat-paid-message-renderer');
                            if (chatItem) isSuperChat = true;
                        }
                        if (!chatItem) {
                            chatItem = node.querySelector('yt-live-chat-membership-item-renderer');
                            if (chatItem) isMembership = true;
                        }
                    }
                    
                    if (chatItem) {
                        processNewChatNode(chatItem, isSuperChat, isMembership);
                    }
                });
            });
        });

        chatObserver.observe(targetNode, { childList: true, subtree: true });
    }

    function getChatMessageText(messageEl) {
        if (!messageEl) return '';
        let text = '';
        messageEl.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName.toLowerCase() === 'img' && node.classList.contains('emoji')) {
                    text += node.getAttribute('alt') || '';
                } else {
                    text += node.textContent;
                }
            }
        });
        return text;
    }

    async function processNewChatNode(node, isSuperChat, isMembership) {
        try {
            const id = node.getAttribute('id');
            if (id && processedChatIdsAdmin.has(id)) {
                return;
            }
            if (id) {
                processedChatIdsAdmin.add(id);
            }

            const authorNameEl = node.querySelector('#author-name');
            const authorName = authorNameEl ? authorNameEl.textContent.trim() : 'ゲスト';

            const avatarImg = node.querySelector('#img');
            const avatarUrl = avatarImg ? avatarImg.getAttribute('src') : 'https://i.pravatar.cc/100';

            const isOwner = node.hasAttribute('author-type') && node.getAttribute('author-type') === 'owner';
            const isModerator = node.hasAttribute('author-type') && node.getAttribute('author-type') === 'moderator';

            let messageText = '';
            let purchaseAmount = '';

            if (isSuperChat) {
                const messageEl = node.querySelector('#message');
                messageText = messageEl ? getChatMessageText(messageEl) : '';
                const amountEl = node.querySelector('#purchase-amount');
                purchaseAmount = amountEl ? amountEl.textContent.trim() : '';
                if (purchaseAmount) {
                    messageText = `[${purchaseAmount}] ${messageText}`;
                }
            } else if (isMembership) {
                const headerSubtextEl = node.querySelector('#header-subtext');
                const messageEl = node.querySelector('#message');
                const headerText = headerSubtextEl ? headerSubtextEl.textContent.trim() : '新規メンバー！';
                const messageTextBody = messageEl ? getChatMessageText(messageEl) : '';
                messageText = messageTextBody ? `${headerText} - ${messageTextBody}` : headerText;
            } else {
                const messageEl = node.querySelector('#message');
                messageText = messageEl ? getChatMessageText(messageEl) : '';
            }

            if (!messageText) return;

            // 自動翻訳
            let translationText = '';
            let needTranslation = false;
            
            const enableJpTranslation = document.getElementById('enable-jp-translation');
            const shouldTranslateJp = enableJpTranslation ? enableJpTranslation.checked : false;

            if (!readAloudManager.isJapanese(messageText)) {
                // 海外言語 ➔ 日本語訳
                translationText = await translateText(messageText);
                needTranslation = (messageText.toLowerCase() !== translationText.toLowerCase());
            } else if (shouldTranslateJp) {
                // 日本語 ➔ 英訳 (設定がONの場合)
                translationText = await translateTextToEn(messageText);
                needTranslation = (messageText.toLowerCase() !== translationText.toLowerCase());
            } else {
                translationText = messageText;
                needTranslation = false;
            }

            const chatObj = {
                id: id || ('yt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
                author: {
                    name: authorName,
                    avatar: avatarUrl,
                    isOwner: isOwner,
                    isModerator: isModerator
                },
                message: messageText,
                translation: translationText,
                needTranslation: needTranslation,
                isSuperChat: isSuperChat,
                isMembership: isMembership,
                purchaseAmount: purchaseAmount,
                timestamp: Date.now()
            };

            // ローカルストレージに送信
            localStorage.setItem('yt_translator_real_chat', JSON.stringify(chatObj));

            // ローカルAPIにPOST送信
            const port = window.location.port || '8080';
            fetch(`http://localhost:${port}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatObj)
            }).catch(err => console.error('Failed to sync chat to API:', err));

            // 画面ログに追加
            appendToChatLog(chatObj);

            // 読み上げと効果音再生の直列制御（音声競合によるななみちゃんフリーズバグの根本防止）
            if (isSuperChat || isMembership) {
                setSpeechSynthesisActive(true); // 効果音再生の段階から音声合成中フラグを立ててソフトミュート開始

                const soundNum = Math.random() < 0.5 ? 1 : 2;
                let hasTriggeredSpeech = false;
                
                const startSpeechFallback = () => {
                    if (!hasTriggeredSpeech) {
                        hasTriggeredSpeech = true;
                        let queued = false;
                        if (readAloudManager) {
                            queued = readAloudManager.speak(chatObj);
                        }
                        // 読み上げがキューに入らなかった場合（読み上げ無効、配信者コメント等）、
                        // isSpeechSynthesisActive を確実にfalseに戻してマイクのソフトミュートを解除する
                        if (!queued) {
                            setSpeechSynthesisActive(false);
                        }
                    }
                };

                // 5秒のタイムアウトで強制的に読み上げを開始するセーフティネット
                const speechTimeoutId = setTimeout(startSpeechFallback, 5000);

                // プリロード済み AudioContext で効果音を再生（バックグラウンドタブ対応）
                const vol = parseInt(effectVolumeSlider.value) / 100;
                playEffectSound(soundNum, vol).then(success => {
                    clearTimeout(speechTimeoutId);
                    if (success) {
                        // 効果音終了後、300ms待ってから読み上げ
                        setTimeout(startSpeechFallback, 300);
                    } else {
                        console.warn('効果音再生失敗、読み上げのみ開始します');
                        startSpeechFallback();
                    }
                });

                localStorage.setItem('yt_translator_test_sound_trigger', JSON.stringify({
                    time: Date.now().toString(),
                    num: soundNum
                }));
            } else {
                // 通常チャットは即時読み上げ
                if (readAloudManager) {
                    readAloudManager.speak(chatObj);
                }
            }

        } catch (e) {
            console.error('Error processing chat node:', e);
        }
    }

    // ==========================================================================
    // 翻訳API呼び出し (Google 翻訳フリーAPI)
    // ==========================================================================
    async function translateText(text) {
        if (!text) return '';

        // 1. Google Chrome拡張用API (最優先・ブロックされにくく高速)
        try {
            const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=ja&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                let translated = '';
                if (typeof data === 'string') translated = data;
                else if (Array.isArray(data)) {
                    if (typeof data[0] === 'string') translated = data[0];
                    else if (Array.isArray(data[0]) && typeof data[0][0] === 'string') translated = data[0][0];
                }
                if (translated && translated.trim()) return translated.trim();
            }
        } catch (e1) {
            console.warn('Primary translation (dict-chrome-ex) failed, trying secondary...', e1);
        }

        // 2. Google GTX API (第2フォールバック)
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ja&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data && data[0]) {
                    let translated = '';
                    for (let i = 0; i < data[0].length; i++) {
                        if (data[0][i] && data[0][i][0]) {
                            translated += data[0][i][0];
                        }
                    }
                    if (translated && translated.trim()) return translated.trim();
                }
            }
        } catch (e2) {
            console.warn('Secondary translation (gtx) failed, trying tertiary...', e2);
        }

        // 3. MyMemory API (第3フォールバック: CORS完全対応)
        try {
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=autodetect|ja`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data && data.responseData && data.responseData.translatedText) {
                    return data.responseData.translatedText.trim();
                }
            }
        } catch (e3) {
            console.error('All translation fallbacks failed:', e3);
        }

        return text;
    }

    btnCopyUrl.addEventListener('click', () => {
        obsUrlInput.select();
        document.execCommand('copy');
        
        const originalText = btnCopyUrl.textContent;
        btnCopyUrl.textContent = 'コピー完了！';
        btnCopyUrl.className = 'btn btn-success';
        
        setTimeout(() => {
            btnCopyUrl.textContent = originalText;
            btnCopyUrl.className = 'btn btn-success';
        }, 2000);
    });

    // ==========================================================================
    // サーバーレス・テストコメント送信機能
    // ==========================================================================
    function sendTestComment(original, trans, name, avatar, lang, isOwner = false, isSuperChat = false, isMembership = false) {
        const commentId = 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const testComment = {
            id: commentId,
            author: {
                name: name,
                avatar: avatar,
                isOwner: isOwner
            },
            message: original,
            translation: trans,
            needTranslation: original !== trans,
            isSuperChat: isSuperChat,
            isMembership: isMembership,
            timestamp: Date.now()
        };

        processedChatIdsAdmin.add(commentId);
        localStorage.setItem('yt_translator_test_chat', JSON.stringify(testComment));
        
        const port = window.location.port || '8080';
        fetch(`http://localhost:${port}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testComment)
        }).catch(err => console.error('Failed to sync test comment to API:', err));
        
        appendToChatLog(testComment);

        // 読み上げと効果音再生の直列制御（音声競合によるななみちゃんフリーズバグの根本防止）
        if (isSuperChat || isMembership) {
            setSpeechSynthesisActive(true); // 効果音再生の段階から音声合成中フラグを立ててソフトミュート開始

            const soundNum = Math.random() < 0.5 ? 1 : 2;
            let hasTriggeredSpeech = false;
            
            const startSpeechFallback = () => {
                if (!hasTriggeredSpeech) {
                    hasTriggeredSpeech = true;
                    let queued = false;
                    if (readAloudManager) {
                        queued = readAloudManager.speak(testComment);
                    }
                    if (!queued) {
                        setSpeechSynthesisActive(false);
                    }
                }
            };

            // 5秒のタイムアウトで強制的に読み上げを開始するセーフティネット
            const speechTimeoutId = setTimeout(startSpeechFallback, 5000);

            // プリロード済み AudioContext で効果音を再生
            const vol = parseInt(effectVolumeSlider.value) / 100;
            playEffectSound(soundNum, vol).then(success => {
                clearTimeout(speechTimeoutId);
                if (success) {
                    setTimeout(startSpeechFallback, 300);
                } else {
                    console.warn('効果音再生失敗、読み上げのみ開始します');
                    startSpeechFallback();
                }
            });

            localStorage.setItem('yt_translator_test_sound_trigger', JSON.stringify({
                time: Date.now().toString(),
                num: soundNum
            }));
        } else {
            // 通常チャットは即時読み上げ
            if (readAloudManager) {
                readAloudManager.speak(testComment);
            }
        }

        testInfoText.textContent = `[${lang}] テストコメントを送信しました！`;
        testInfoText.style.display = 'block';
        
        setTimeout(() => {
            testInfoText.style.display = 'none';
        }, 3000);
    }

    btnTestEn.addEventListener('click', () => {
        const englishChats = [
            { o: "Hello from New York! Your stream is so cozy! Great sniper play!", t: "ニューヨークからこんにちは！あなたの配信はとても居心地が良いですね！素晴らしいスナイパーのプレイです！", n: "Emily_NY" },
            { o: "Wow, what a nice gear setup! Can you show it again?", t: "わぁ、なんて素晴らしい装備構成なんでしょう！もう一度見せてもらえますか？", n: "John_RNG" },
            { o: "Hi from UK! I love FFXI streams! Keep it up!", t: "イギリスからこんにちは！FF11 of 配信が大好きです！その調子で頑張ってください！", n: "Vana_Fan_UK" }
        ];
        const chat = englishChats[Math.floor(Math.random() * englishChats.length)];
        const avatarNum = Math.floor(Math.random() * 4) + 1;
        sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 10}`, 'English', false, false, false);
    });

    btnTestKr.addEventListener('click', () => {
        const koreanChats = [
            { o: "안녕하세요! 한국에서 보고 있습니다. 활 쏘는 솜씨가 대단하시네요!", t: "こんにちは！韓国から見ています。弓を射る腕前が素晴らしいですね！", n: "K-Ranger" },
            { o: "이 장비는 만드는데 얼마나 걸렸나요? 정말 부럽습니다!", t: "この装備を作るのにどれくらいかかりましたか？本当に羨ましいです！", n: "Vana_Korea" }
        ];
        const chat = koreanChats[Math.floor(Math.random() * koreanChats.length)];
        const avatarNum = Math.floor(Math.random() * 4) + 1;
        sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 20}`, 'Korean', false, false, false);
    });

    btnTestJp.addEventListener('click', () => {
        const japaneseChats = [
            { o: "こんにちは! いつも配信楽しみに見てます！", t: "こんにちは！いつも配信楽しみに見てます！", n: "ゆうくん_FF11" },
            { o: "今の連携ダメージめちゃくちゃすごいですねー！！", t: "今の連携ダメージめちゃくちゃすごいですねー！！", n: "マートの弟子" }
        ];
        const chat = japaneseChats[Math.floor(Math.random() * japaneseChats.length)];
        const avatarNum = Math.floor(Math.random() * 4) + 1;
        sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 30}`, 'Japanese', false, false, false);
    });

    const btnTestSc = document.getElementById('btn-test-sc');
    if (btnTestSc) {
        btnTestSc.addEventListener('click', () => {
            const scChats = [
                { o: "Thank you for the amazing sniper shots! Keep up the great work!", t: "素晴らしいスナイパーショットをありがとうございます！これからも頑張ってください！", n: "SC_Supporter_" },
                { o: "I love your RNG setup! Happy to support your FFXI stream!", t: "あなたの狩人の装備構成が大好きです！FF11の配信をサポートできて幸せです！", n: "Vana_Donator" }
            ];
            const chat = scChats[Math.floor(Math.random() * scChats.length)];
            const avatarNum = Math.floor(Math.random() * 4) + 1;
            sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 50}`, 'SuperChat', false, true, false);
        });
    }

    const btnTestMember = document.getElementById('btn-test-member');
    if (btnTestMember) {
        btnTestMember.addEventListener('click', () => {
            const memberChats = [
                { o: "I just joined the channel membership! So excited!", t: "メンバーシップに新しく加入しました！配信応援してます！", n: "FF11_MEMBER_" },
                { o: "Ranger power! Happy to support your amazing stream!", t: "狩人パワー！あなたの素敵な配信をサポートできて幸せです！", n: "Tarutaru_RNG" }
            ];
            const chat = memberChats[Math.floor(Math.random() * memberChats.length)];
            const avatarNum = Math.floor(Math.random() * 4) + 1;
            sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 40}`, 'Membership', false, false, true);
        });
    }

    btnClearTest.addEventListener('click', () => {
        localStorage.setItem('yt_translator_test_clear', Date.now().toString());
        
        if (readAloudManager) {
            readAloudManager.clear();
        }
        
        const emptyEl = document.getElementById('chat-log-empty');
        chatLogList.innerHTML = '';
        if (emptyEl) {
            chatLogList.appendChild(emptyEl);
            emptyEl.style.display = 'block';
        }

        testInfoText.textContent = "画面と履歴をクリアしました ";
        testInfoText.style.display = 'block';
        setTimeout(() => testInfoText.style.display = 'none', 2000);
    });

    // ==========================================================================
    // チャット履歴ログの描画
    // ==========================================================================
    const chatLogList = document.getElementById('chat-log-list');
    const chatLogEmpty = document.getElementById('chat-log-empty');

    function appendToChatLog(chat) {
        if (!chatLogList) return;

        if (chatLogEmpty) {
            chatLogEmpty.style.display = 'none';
        }

        const logItem = document.createElement('div');
        logItem.style.background = 'rgba(255, 255, 255, 0.03)';
        logItem.style.border = '1px solid rgba(255, 255, 255, 0.08)';
        logItem.style.borderRadius = '8px';
        logItem.style.padding = '0.5rem 0.75rem';
        logItem.style.display = 'flex';
        logItem.style.gap = '0.75rem';
        logItem.style.alignItems = 'flex-start';
        logItem.style.fontSize = '0.875rem';
        logItem.style.lineHeight = '1.4';
        logItem.style.animation = 'fadeIn 0.25s ease-out forwards';
        logItem.style.marginBottom = '0.5rem';

        const name = document.createElement('strong');
        name.style.color = chat.author.isOwner ? '#eab308' : (chat.author.isModerator ? '#3b82f6' : '#cbd5e1');
        name.style.minWidth = '80px';
        name.style.maxWidth = '120px';
        name.style.whiteSpace = 'nowrap';
        name.style.overflow = 'hidden';
        name.style.textOverflow = 'ellipsis';
        name.textContent = chat.author.name;
        logItem.appendChild(name);

        const contentBox = document.createElement('div');
        contentBox.style.flex = '1';
        contentBox.style.display = 'flex';
        contentBox.style.flexDirection = 'column';
        contentBox.style.gap = '0.2rem';

        const origText = document.createElement('span');
        origText.style.color = '#f1f5f9';
        origText.textContent = chat.message;
        contentBox.appendChild(origText);

        if (chat.needTranslation && chat.translation) {
            const transText = document.createElement('span');
            transText.style.color = '#38bdf8';
            transText.style.fontWeight = 'bold';
            transText.innerHTML = `<span style="color: var(--accent-color); font-size: 0.75rem; font-weight: bold; margin-right: 0.25rem;">[自動翻訳]</span>${chat.translation}`;
            contentBox.appendChild(transText);
        }

        logItem.appendChild(contentBox);

        if (chat.isBroadcaster) {
            // 誤認識した自分の言葉をワンクリックで修正フォームへ転送するショートカットボタン
            const btnCorrectLog = document.createElement('button');
            btnCorrectLog.textContent = '修正登録';
            btnCorrectLog.style.background = 'rgba(234, 179, 8, 0.12)';
            btnCorrectLog.style.border = '1px solid var(--accent-color)';
            btnCorrectLog.style.color = 'var(--accent-color)';
            btnCorrectLog.style.padding = '0.15rem 0.4rem';
            btnCorrectLog.style.borderRadius = '6px';
            btnCorrectLog.style.cursor = 'pointer';
            btnCorrectLog.style.fontSize = '0.75rem';
            btnCorrectLog.style.alignSelf = 'center';
            btnCorrectLog.style.marginLeft = 'auto';
            btnCorrectLog.style.flexShrink = '0';
            
            btnCorrectLog.addEventListener('click', () => {
                if (correctIncorrectInput) {
                    correctIncorrectInput.value = chat.message;
                    correctIncorrectInput.focus();
                    correctIncorrectInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
            logItem.appendChild(btnCorrectLog);
        }

        chatLogList.insertBefore(logItem, chatLogList.firstChild);

        // DOM要素の無限蓄積によるパフォーマンス劣化を防止（最大150件に制限）
        while (chatLogList.children.length > 150) {
            chatLogList.removeChild(chatLogList.lastChild);
        }
    }

    // 外部からの実チャットを受信
    window.addEventListener('storage', (e) => {
        if (e.key === 'yt_translator_real_chat' && e.newValue) {
            try {
                const chat = JSON.parse(e.newValue);
                
                if (chat && chat.id) {
                    if (processedChatIdsAdmin.has(chat.id)) {
                        return;
                    }
                    processedChatIdsAdmin.add(chat.id);
                }
                
                // 起動時刻より前の過去ログはスルー
                const isPastChat = chat.timestamp && chat.timestamp < appLoadTime;
                if (isPastChat) return;
                
                appendToChatLog(chat);
                
                if (readAloudManager) {
                    readAloudManager.speak(chat);
                }
            } catch (err) {
                console.error('Failed to parse real chat log:', err);
            }
        }
    });

    // ==========================================================================
    // 配信者用 日本語から英語への自動翻訳ロジック
    // ==========================================================================
    // 日本語（ひらがな・カタカナ）が含まれているかを判定する安全ヘルパー
    function containsJapanese(str) {
        if (!str || typeof str !== 'string') return false;
        return /[\u3040-\u309F\u30A0-\u30FF]/.test(str);
    }

    async function translateTextToEn(text) {
        if (!text) return '';
        
        // 「え？」「絵？」単体の特別ガードルール
        const trimmedSimple = text.trim().replace(/[?？]/g, '');
        if (trimmedSimple === 'え' || trimmedSimple === '絵') {
            return 'Eh?';
        }

        // 1. Google Chrome拡張用API (最優先・ブロックされにくく高速)
        try {
            const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=ja&tl=en&q=${encodeURIComponent(text)}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                let translated = '';
                if (typeof data === 'string') {
                    translated = data;
                } else if (Array.isArray(data)) {
                    // 配列全体をフラットに結合して文の欠落を防止
                    const flatten = (arr) => arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val), []);
                    const parts = flatten(data).filter(p => typeof p === 'string' && p.trim().length > 0);
                    translated = parts.join(' ');
                }
                
                // 翻訳結果が存在し、かつ日本語（ひらがな・カタカナ）が混ざっていない完全英訳のみ採用
                if (translated && translated.trim() && !containsJapanese(translated)) {
                    return translated.trim();
                } else if (translated && containsJapanese(translated)) {
                    console.warn('Primary translation (dict-chrome-ex) returned partial Japanese. Falling back to secondary...', translated);
                }
            }
        } catch (e1) {
            console.warn('Primary translation to En (dict-chrome-ex) failed, trying secondary...', e1);
        }

        // 2. Google GTX API (第2フォールバック)
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(text)}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && data[0]) {
                    let translated = '';
                    let hasUnfinishedJp = false;
                    for (let i = 0; i < data[0].length; i++) {
                        if (data[0][i]) {
                            let transPart = data[0][i][0] || '';
                            const origPart = data[0][i][1] || '';
                            
                            // 各セグメントが「え」「絵」等の聞き返しの場合は「Eh?」に置き換える
                            const trimmedOrig = origPart.trim().replace(/[?？]/g, '');
                            if (trimmedOrig === 'え' || trimmedOrig === '絵') {
                                transPart = transPart.includes('?') || origPart.includes('?') ? 'Eh? ' : 'Eh ';
                            }
                            
                            if (containsJapanese(transPart)) {
                                hasUnfinishedJp = true;
                            }
                            
                            translated += transPart;
                        }
                    }
                    
                    // 日本語が残っていない場合のみ採用。残っている場合は第3フォールバックへ進む
                    if (translated && translated.trim() && !hasUnfinishedJp) {
                        return translated.trim();
                    } else if (hasUnfinishedJp) {
                        console.warn('Secondary translation (gtx) returned partial Japanese in segments. Falling back to MyMemory...', translated);
                    }
                }
            }
        } catch (e2) {
            console.warn('Secondary translation to En (gtx) failed, trying tertiary...', e2);
        }

        // 3. MyMemory API (第3フォールバック: CORS完全対応)
        try {
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ja|en`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (data && data.responseData && data.responseData.translatedText) {
                    const myMemoryResult = data.responseData.translatedText.trim();
                    if (!containsJapanese(myMemoryResult)) {
                        return myMemoryResult;
                    }
                }
            }
        } catch (e3) {
            console.error('All translation to En fallbacks failed:', e3);
        }

        return text;
    }

    function sendBroadcasterTranslation(original, trans) {
        const broadcasterChat = {
            id: 'bc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            author: {
                name: 'Yuuchin (配信者)',
                avatar: 'broadcaster.png',
                isOwner: true
            },
            message: original,
            translation: trans,
            isBroadcaster: true,
            needTranslation: true,
            timestamp: Date.now()
        };
        
        localStorage.setItem('yt_translator_broadcaster_chat', JSON.stringify(broadcasterChat));
        
        const port = window.location.port || '8080';
        fetch(`http://localhost:${port}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(broadcasterChat)
        }).catch(err => console.error('Failed to sync broadcaster chat to API:', err));
        
        appendToChatLog(broadcasterChat);
    }


    // ==========================================================================
    // バックグラウンド省電力スリープ防止用 Web Audio Keep-Alive パイプライン
    // ==========================================================================
    let keepAliveAudioCtx = null;
    let keepAliveOscillator = null;
    let keepAliveMediaStream = null;

    async function startMicKeepAlive() {
        if (keepAliveMediaStream) return;
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                keepAliveMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                console.log('Mic Hardware Keep-Alive stream active (preventing OS/browser mic throttling).');
            }
        } catch (e) {
            console.warn('Mic Keep-Alive getUserMedia error:', e);
        }
    }

    function startAudioKeepAlive() {
        startMicKeepAlive();
        if (keepAliveAudioCtx) return;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            keepAliveAudioCtx = new AudioContextClass();
            const osc = keepAliveAudioCtx.createOscillator();
            const gain = keepAliveAudioCtx.createGain();
            // 人間の可聴域外/感知不能な極小音量（0.00001）で常時再生し、OSやChromiumのオーディオスリープを阻止
            gain.gain.value = 0.00001;
            osc.frequency.value = 15;
            osc.connect(gain);
            gain.connect(keepAliveAudioCtx.destination);
            osc.start();
            keepAliveOscillator = osc;
            console.log('Audio Keep-Alive pipeline active (preventing browser background throttling).');
        } catch (e) {
            console.warn('Audio Keep-Alive could not be started:', e);
        }
    }

    // ==========================================================================
    // 配信者マイクリアルタイム音声認識 (Web Speech API)
    // ==========================================================================
    if (SpeechRecognition && btnMicToggle) {
        
        // 音声認識インスタンスの初期化・再構築（リビルド）関数
        function initSpeechRecognition() {
            if (recognition) {
                // 既存のインスタンスのイベントハンドラを解除して破棄
                recognition.onstart = null;
                recognition.onend = null;
                recognition.onerror = null;
                recognition.onresult = null;
                try { recognition.abort(); } catch(e) {}
                recognition = null;
            }

            // 内部フラグを確実に初期化して不整合や膠着を防ぐ
            isListening = false;
            isStarting = false;

            recognition = new SpeechRecognition();
            lastInitTime = Date.now(); // インスタンスを新規生成した時刻を記録（20分予防リビルド用）
            recognition.lang = 'ja-JP';
            recognition.continuous = true;
            recognition.interimResults = false;

            recognition.onstart = () => {
                isListening = true;
                isStarting = false; // 起動処理完了
                startAttemptCount = 0; // 起動試行回数をリセット
                lastStartSuccessTime = Date.now();
                lastHealthyTime = Date.now(); // 正常起動・活動時刻を記録（ゾンビ検知の真の基点）
                consecutiveErrorCount = 0; // 正常に起動できたら連続エラーカウントをリセット
                lastErrorType = ''; // エラー状態をクリア
                lastActivityTime = Date.now();
                if (micDot) micDot.classList.add('active');
                if (micBtnText) micBtnText.textContent = 'マイク音声認識: ON';
                if (micStatus) {
                    micStatus.textContent = 'マイク入力中... 日本語で喋ると自動英訳されます ';
                    micStatus.style.color = 'var(--success-color)';
                }
            };

            recognition.onend = () => {
                isListening = false;
                isStarting = false;

                if (shouldBeListening) {
                    if (!isSpeechSynthesisActive) {
                        const now = Date.now();
                        // 通常切断・no-speech・単発networkは500ms（裏画面での安全な切断完了猶予）で再接続
                        // 連続障害発生時のみ1500ms〜5000msのバックオフを入れてCPU暴走を防止
                        let delay = 500;
                        const isSevereError = (lastErrorType && lastErrorType !== 'no-speech' && lastErrorType !== 'aborted') &&
                                              (lastErrorType !== 'network' || consecutiveNetworkCount > 0);

                        if (isSevereError) {
                            if (consecutiveErrorCount === 1) delay = 1500;
                            else if (consecutiveErrorCount === 2) delay = 3000;
                            else if (consecutiveErrorCount >= 3) delay = 5000;
                        }

                        if (window.micReconnectTimeoutId) {
                            clearTimeout(window.micReconnectTimeoutId);
                            window.micReconnectTimeoutId = null;
                        }

                        if (micStatus) {
                            if (consecutiveErrorCount >= 3) {
                                micStatus.textContent = '接続が不安定なため、一時待機して再接続を試みます... ';
                                micStatus.style.color = 'var(--accent-color)';
                            } else {
                                micStatus.textContent = 'マイク接続維持中（自動復旧）... ';
                                micStatus.style.color = 'var(--success-color)';
                            }
                        }

                        window.micReconnectTimeoutId = setTimeout(() => {
                            window.micReconnectTimeoutId = null;
                            if (shouldBeListening && !isListening && !isSpeechSynthesisActive) {
                                reconnectSpeechRecognition();
                            }
                        }, delay);
                    } else {
                        // 読み上げ中のため、UIはONを維持しつつ、自動再起動は読み上げ完了時に任せる
                        if (micStatus) {
                            micStatus.textContent = '読み上げ中のため、マイク入力を一時停止（ソフトミュート）しています... ';
                            micStatus.style.color = 'var(--accent-color)';
                        }
                    }
                    return;
                }

                // 本当に手動で停止された場合のみUIをOFF表示にする
                if (micDot) micDot.classList.remove('active');
                if (micBtnText) micBtnText.textContent = 'マイク音声認識: OFF';
                if (micStatus) {
                    micStatus.textContent = '音声認識は停止しています。';
                    micStatus.style.color = 'var(--text-muted)';
                }
            };

            recognition.onerror = (e) => {
                console.warn('Speech recognition warning:', e.error);
                const now = Date.now();
                lastErrorTime = now;
                lastErrorType = e.error;
                lastActivityTime = now;

                if (e.error === 'no-speech') {
                    lastHealthyTime = now;
                    consecutiveNetworkCount = 0;
                } else if (e.error === 'network') {
                    // 直前のnetworkエラーから4秒以内の再発なら「本物の回線障害・サーバー障害」と判定
                    if (now - lastNetworkErrorTime < 4000) {
                        consecutiveNetworkCount++;
                        consecutiveErrorCount++;
                        console.warn(`Consecutive network error detected (${consecutiveNetworkCount}). Backing off.`);
                    } else {
                        // 初回の単発network切断は「無音アイドルによる正常なセッション終了」として扱い生存を記録
                        consecutiveNetworkCount = 0;
                        lastHealthyTime = now;
                    }
                    lastNetworkErrorTime = now;
                } else if (e.error !== 'aborted') {
                    consecutiveErrorCount++;
                    consecutiveNetworkCount = 0;
                }

                if (e.error === 'aborted') return;

                if (micStatus) {
                    if (e.error === 'not-allowed') {
                        micStatus.textContent = 'エラー: マイクの使用が許可されていません。ブラウザのアドレスバーの鍵アイコンからマイクを許可してください';
                        micStatus.style.color = 'var(--error-color)';
                        shouldBeListening = false;
                    } else if (e.error === 'no-speech' || e.error === 'network') {
                        // 無音タイムアウトや一時的な通信瞬断は仕様なので、警告せずサイレント復旧を促す
                        micStatus.textContent = 'マイク接続維持中（自動復旧）... ';
                        micStatus.style.color = 'var(--success-color)';
                    } else {
                        micStatus.textContent = `接続調整中 (${e.error})。自動再起動します...`;
                        micStatus.style.color = 'var(--accent-color)';
                    }
                }
            };

            recognition.onresult = async (event) => {
                try {
                    consecutiveErrorCount = 0; // 正常に聞き取れたら連続エラーをリセット
                    lastErrorType = ''; // エラー状態をクリア
                    lastResultTime = Date.now(); // 音声認識が正常に結果を返した時刻を記録
                    lastHealthyTime = Date.now(); // 正常認識成功時刻を更新（ゾンビ判定解除用）
                    lastActivityTime = Date.now();
                    if (isSpeechSynthesisActive) {
                        const now = Date.now();
                        const isReallySpeaking = window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
                        const hasQueuedItems = typeof readAloudManager !== 'undefined' && readAloudManager && (readAloudManager.speaking || (readAloudManager.queue && readAloudManager.queue.length > 0));
                        const isCoolingDown = (now - lastSpeechSynthesisEndTime) < 1000 || window.micMuteCooldownTimeoutId !== null;

                        // 読み上げ中、または読み上げ終了直後のクールダウン期間（1.0秒）は、遅れて届いたマイク音声を完全に遮断
                        if (isReallySpeaking || hasQueuedItems || isCoolingDown) {
                            console.log('Speech recognition ignored: SpeechSynthesis is active or in cooldown (soft-mute)');
                            return;
                        }

                        // 発話中ではなく、キューも空で、クールダウン期間もとっくに過ぎているのにフラグだけ残っている場合は自己修復
                        if (isSpeechSynthesisActiveStartTime > 0 && (now - isSpeechSynthesisActiveStartTime) > 5000) {
                            console.warn('Self-healing: isSpeechSynthesisActive was stuck without active speech or cooldown. Auto-clearing soft-mute.');
                            setSpeechSynthesisActive(false);
                        } else {
                            return;
                        }
                    }
                    // Web Speech API の標準仕様に基づき、isFinal が true の確定テキストのみを抽出
                    let finalTranscript = '';
                    let interimTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        const res = event.results[i];
                        if (res && res[0]) {
                            if (res.isFinal) {
                                finalTranscript += res[0].transcript;
                            } else {
                                interimTranscript += res[0].transcript;
                            }
                        }
                    }

                    // 中間結果（発話途中）の場合はステータス表示のみ更新し、確定タイマーは一時解除（発話継続中）
                    if (!finalTranscript && interimTranscript) {
                        if (typeof window.cancelSpeechDebounceTimer === 'function') {
                            window.cancelSpeechDebounceTimer();
                        }
                        if (micStatus) {
                            const bufferPreview = (typeof window.getSpeechBufferPreview === 'function') ? window.getSpeechBufferPreview() : '';
                            const preview = [bufferPreview, interimTranscript.trim()].filter(Boolean).join(' ');
                            micStatus.textContent = `認識中: 「${preview}」...`;
                            micStatus.style.color = 'var(--accent-color)';
                        }
                        return;
                    }

                    const rawText = finalTranscript.trim();
                    if (!rawText) return;
                    await handleBroadcasterSpeechInput(rawText);
                } catch (err) {
                    console.error("Error in onresult processing:", err);
                }
            };
        }

        // 既存インスタンスの完全破棄（イベントリスナー解除・abort・null化）
        function destroyRecognition() {
            if (recognition) {
                recognition.onstart = null;
                recognition.onend = null;
                recognition.onerror = null;
                recognition.onresult = null;
                try { recognition.abort(); } catch(e) {}
                recognition = null;
            }
            isListening = false;
            isStarting = false;
        }

        // デバイス競合を防ぐ安全なリビルド＆再起動処理（解放ディレイ800ms）
        function safeRebuildAndRestart(reason) {
            console.log(`Speech recognition safe rebuild triggered (${reason}). Cleaning up old instance and waiting 800ms for OS audio release...`);
            destroyRecognition();
            
            if (window.micReconnectTimeoutId) {
                clearTimeout(window.micReconnectTimeoutId);
                window.micReconnectTimeoutId = null;
            }

            window.micReconnectTimeoutId = setTimeout(() => {
                window.micReconnectTimeoutId = null;
                if (shouldBeListening && !isSpeechSynthesisActive && !isMicBridgeConnected) {
                    initSpeechRecognition();
                    startSpeechRecognition();
                }
            }, 800);
        }

        // 安全な音声認識の再接続・再生成ロジック
        function reconnectSpeechRecognition() {
            // バックグラウンドでのサスペンドを自動解除
            if (keepAliveAudioCtx && keepAliveAudioCtx.state === 'suspended') {
                keepAliveAudioCtx.resume().catch(() => {});
            }

            if (!shouldBeListening || isSpeechSynthesisActive || isMicBridgeConnected) return;

            if (!recognition) {
                safeRebuildAndRestart('no instance in reconnect');
                return;
            }

            isStarting = true;
            lastStartAttemptTime = Date.now();

            // エラーが3回以上連続して起きている場合は、安全にインスタンスを作り直して固まりを打破する
            const needRebuild = (consecutiveErrorCount >= 3);
            if (needRebuild) {
                console.log('Speech recognition has multiple errors. Rebuilding instance with safe delay...');
                consecutiveErrorCount = 0;
                safeRebuildAndRestart('consecutive errors');
                return;
            }

            try {
                recognition.start();
            } catch (e) {
                console.warn('Failed to start recognition in reconnect:', e);
                if (e && e.message && e.message.includes('already started')) {
                    isListening = true;
                    isStarting = false;
                    lastHealthyTime = Date.now();
                } else {
                    isListening = false;
                    isStarting = false;
                    safeRebuildAndRestart(`start failure in reconnect (${e.message || e})`);
                }
            }
        }

        function startSpeechRecognition() {
            if (isMicBridgeConnected) {
                console.log('[startSpeechRecognition] MicBridge is active. Browser SpeechRecognition will remain stopped.');
                return;
            }
            if (window.micReconnectTimeoutId) {
                clearTimeout(window.micReconnectTimeoutId);
                window.micReconnectTimeoutId = null;
            }
            shouldBeListening = true;
            consecutiveErrorCount = 0;
            startAttemptCount = 0;

            if (!recognition) {
                initSpeechRecognition();
            }

            isStarting = true;
            lastStartAttemptTime = Date.now();
            lastHealthyTime = Date.now();

            try {
                recognition.start();
            } catch (e) {
                console.warn('Failed to start recognition (standard start):', e);
                // ★重要: 絶対に isListening = true にせず、800ms安全リビルドを行う
                isListening = false;
                isStarting = false;
                safeRebuildAndRestart(`standard start failure (${e.message || e})`);
            }
        }

        function stopSpeechRecognition() {
            if (window.micReconnectTimeoutId) {
                clearTimeout(window.micReconnectTimeoutId);
                window.micReconnectTimeoutId = null;
            }
            if (typeof window.flushSpeechBuffer === 'function') {
                try { window.flushSpeechBuffer(); } catch(e) {}
            }
            shouldBeListening = false;
            isStarting = false;
            isListening = false;
            consecutiveErrorCount = 0;
            startAttemptCount = 0;
            lastResultTime = 0; // 停止時はリセット
            lastActivityTime = 0; // 停止時はリセット
            lastHealthyTime = 0; // 停止時はリセット
            destroyRecognition();
        }

        // セッターなどの外部から安全に再接続ロジックを叩けるようにグローバル露出
        window.reconnectSpeechRecognition = reconnectSpeechRecognition;

        // 初回のみ初期化実行
        initSpeechRecognition();
        initMicBridge();

        function applySpeechCorrection(text) {
            if (!text) return text;
            let dict = [];
            try {
                const saved = localStorage.getItem('yt_translator_speech_correct_dict');
                if (saved) {
                    dict = JSON.parse(saved);
                }
            } catch (e) {
                console.error('Failed to parse speech correction dictionary:', e);
            }

            if (!Array.isArray(dict) || dict.length === 0) {
                return text;
            }

            // 長い単語から順にソートして誤置換を防ぐ
            const sortedDict = [...dict].sort((a, b) => b.incorrect.length - a.incorrect.length);

            let result = text;
            for (const item of sortedDict) {
                if (!item.incorrect) continue;
                const escapedWord = item.incorrect.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp(escapedWord, 'gi');
                result = result.replace(regex, item.correct || '');
            }
            return result;
        }

        // 配信者マイク音声の確定バッファとデバウンスタイマー（息継ぎや短い間による分断を防ぎ、1文に結合する）
        let speechBuffer = [];
        let speechDebounceTimer = null;
        const SPEECH_DEBOUNCE_DELAY_MS = 500; // 確定後の待機時間（0.5秒）※Python側で2.0秒待機するため短縮

        window.cancelSpeechDebounceTimer = function() {
            if (speechDebounceTimer) {
                clearTimeout(speechDebounceTimer);
                speechDebounceTimer = null;
            }
        };

        window.getSpeechBufferPreview = function() {
            return speechBuffer.join(' ').replace(/\s+/g, ' ').trim();
        };

        async function flushSpeechBuffer() {
            if (speechDebounceTimer) {
                clearTimeout(speechDebounceTimer);
                speechDebounceTimer = null;
            }
            if (speechBuffer.length === 0) return;

            const text = speechBuffer.join(' ').replace(/\s+/g, ' ').trim();
            speechBuffer = [];
            if (!text) return;

            await executeBroadcasterSpeechSend(text);
        }

        window.flushSpeechBuffer = flushSpeechBuffer;

        // 配信者マイク音声の共通受付ハンドラ (Web Speech API / Pythonマイクブリッジ共通)
        function handleBroadcasterSpeechInput(rawText) {
            if (!shouldBeListening) return;
            const text = (rawText || '').trim();
            if (!text) return;

            speechBuffer.push(text);
            const rawCombined = speechBuffer.join(' ').replace(/\s+/g, ' ').trim();
            const combinedPreview = typeof stripSpokenCommentsFromTranscript === 'function'
                ? (stripSpokenCommentsFromTranscript(rawCombined) || rawCombined)
                : rawCombined;
            if (micStatus) {
                micStatus.textContent = `認識中: 「${combinedPreview}」...`;
                micStatus.style.color = 'var(--accent-color)';
            }

            if (speechDebounceTimer) {
                clearTimeout(speechDebounceTimer);
            }
            speechDebounceTimer = setTimeout(() => {
                flushSpeechBuffer();
            }, SPEECH_DEBOUNCE_DELAY_MS);
        }

        // 実際の翻訳・字幕送信実行処理
        async function executeBroadcasterSpeechSend(text) {
            try {
                // 直前読み上げコメントとの被り検知・自動切除（ストリップ）
                const cleanedSpeechText = typeof stripSpokenCommentsFromTranscript === 'function'
                    ? stripSpokenCommentsFromTranscript(text)
                    : text;

                if (!cleanedSpeechText) {
                    console.log(`[SpeechInput] 直前読み上げコメントの拾い込みと判定し破棄しました: "${text}"`);
                    return;
                }

                // 重複排除ガード（直近1.5秒以内の完全一致のみカット。前方一致による誤破棄を防止）
                const now = Date.now();
                const normText = cleanedSpeechText.replace(/[\s\u3000、。！？!?,.]/g, '');
                const normLast = lastSentSpeechText.replace(/[\s\u3000、。！？!?,.]/g, '');
                if (normText && normLast && (now - lastSentSpeechTime) < 1500) {
                    if (normText === normLast) {
                        console.log(`[SpeechInput] 重複音声を破棄しました: "${cleanedSpeechText}" (直前: "${lastSentSpeechText}", 経過: ${now - lastSentSpeechTime}ms)`);
                        return;
                    }
                }

                lastSentSpeechText = cleanedSpeechText;
                lastSentSpeechTime = now;

                consecutiveErrorCount = 0;
                lastErrorType = '';
                lastResultTime = Date.now();
                lastHealthyTime = Date.now();
                lastActivityTime = Date.now();

                const resultText = applySpeechCorrection(cleanedSpeechText);

                if (micStatus) {
                    micStatus.textContent = `認識結果: 「${resultText}」を英訳中...`;
                    micStatus.style.color = 'var(--accent-color)';
                }

                const translatedText = await translateTextToEn(resultText);
                sendBroadcasterTranslation(resultText, translatedText);

                if (micStatus) {
                    micStatus.textContent = `字幕送信完了: 「${translatedText}」`;
                    micStatus.style.color = 'var(--success-color)';
                }

                setTimeout(() => {
                    if (shouldBeListening && micStatus) {
                        if (isMicBridgeConnected) {
                            micStatus.textContent = 'OS直結マイク常時待機中（安定動作中・自動英訳）';
                        } else if (isListening) {
                            micStatus.textContent = 'マイク入力中... 日本語で喋ると自動英訳されます';
                        }
                        micStatus.style.color = 'var(--success-color)';
                    }
                }, 3000);
            } catch (err) {
                console.error('Error in executeBroadcasterSpeechSend:', err);
                if (micStatus) {
                    micStatus.textContent = '翻訳処理中にエラーが発生しました。';
                    micStatus.style.color = 'var(--error-color)';
                }
            }
        }

        // OS直結マイクブリッジ (Python) WebSocketクライアント
        function initMicBridge() {
            try {
                const wsUrl = 'ws://127.0.0.1:8089';
                const ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                    micBridgeWs = ws;
                    isMicBridgeConnected = true;
                    console.log('[MicBridge] OS直結マイクブリッジ (Python) に接続しました。');
                    if (shouldBeListening) {
                        destroyRecognition();
                        if (micDot) micDot.classList.add('active');
                        if (micBtnText) micBtnText.textContent = 'マイク音声認識: ON';
                        if (micStatus) {
                            micStatus.textContent = 'OS直結マイク常時待機中（安定動作中・自動英訳）';
                            micStatus.style.color = 'var(--success-color)';
                        }
                    }
                    sendTtsStateToMicBridge(isSpeechSynthesisActive);
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'mic_text' && data.text) {
                            handleBroadcasterSpeechInput(data.text);
                        } else if (data.type === 'bridge_status') {
                            console.log('[MicBridge] ステータス:', data.message);
                        }
                    } catch (e) {
                        console.error('[MicBridge] メッセージ解析エラー:', e);
                    }
                };

                ws.onclose = () => {
                    const wasConnected = isMicBridgeConnected;
                    micBridgeWs = null;
                    isMicBridgeConnected = false;
                    if (wasConnected) {
                        console.warn('[MicBridge] OS直結マイクブリッジが切断されました。従来のブラウザマイクへ自動フォールバックします。');
                    }
                    if (shouldBeListening && !isListening) {
                        initSpeechRecognition();
                        startSpeechRecognition();
                    }
                    setTimeout(initMicBridge, 30000); // 未起動時は30秒ごとに控えめに再確認
                };

                ws.onerror = () => {
                    try { ws.close(); } catch(e) {}
                };
            } catch (err) {
                setTimeout(initMicBridge, 30000);
            }
        }

        btnMicToggle.addEventListener('click', () => {
            startAudioKeepAlive();
            if (shouldBeListening) {
                // OFF操作: UIを即座に更新し、recognitionが壊れていても見た目が反映されるようにする
                shouldBeListening = false;
                isStarting = false;
                isListening = false;
                consecutiveErrorCount = 0;
                startAttemptCount = 0;
                lastResultTime = 0; // マイクOFF時はリセット
                lastActivityTime = 0; // マイクOFF時はリセット
                lastHealthyTime = 0; // マイクOFF時はリセット
                if (micDot) micDot.classList.remove('active');
                if (micBtnText) micBtnText.textContent = 'マイク音声認識: OFF';
                if (micStatus) {
                    micStatus.textContent = '音声認識は停止しています。';
                    micStatus.style.color = 'var(--text-muted)';
                }
                if (window.micReconnectTimeoutId) {
                    clearTimeout(window.micReconnectTimeoutId);
                    window.micReconnectTimeoutId = null;
                }
                destroyRecognition();
            } else {
                // ON操作: 常にクリーンな状態から開始するため完全破棄してから起動
                shouldBeListening = true;
                if (micDot) micDot.classList.add('active');
                if (micBtnText) micBtnText.textContent = 'マイク音声認識: ON';
                if (isMicBridgeConnected) {
                    if (micStatus) {
                        micStatus.textContent = 'OS直結マイク常時待機中（安定動作中・自動英訳）';
                        micStatus.style.color = 'var(--success-color)';
                    }
                } else {
                    if (micStatus) {
                        micStatus.textContent = 'マイク起動中...';
                        micStatus.style.color = 'var(--accent-color)';
                    }
                    destroyRecognition();
                    setTimeout(() => {
                        if (shouldBeListening && !isMicBridgeConnected) {
                            initSpeechRecognition();
                            startSpeechRecognition();
                        }
                    }, 300);
                }
            }
        });

        // マイク稼働状態の自己修復・監視用ハートビートタイマー
        setInterval(() => {
            const now = Date.now();

            // isSpeechSynthesisActive の最大ロック時間セーフティ
            // 読み上げ中のソフトミュートは維持するが、実態として音声合成が停止・クールダウン完了済みでフラグだけ残っている場合は強制解除する
            if (isSpeechSynthesisActive && isSpeechSynthesisActiveStartTime > 0) {
                const lockDuration = now - isSpeechSynthesisActiveStartTime;
                const isReallySpeaking = window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
                const hasQueuedItems = typeof readAloudManager !== 'undefined' && readAloudManager && (readAloudManager.speaking || (readAloudManager.queue && readAloudManager.queue.length > 0));
                const isCoolingDown = (now - lastSpeechSynthesisEndTime) < 1000 || window.micMuteCooldownTimeoutId !== null;

                if ((!isReallySpeaking && !hasQueuedItems && !isCoolingDown && lockDuration > 3000) || lockDuration > 60000) {
                    console.warn(`Heartbeat: isSpeechSynthesisActive has been locked for ${Math.round(lockDuration / 1000)}s (speaking: ${isReallySpeaking}, queued: ${hasQueuedItems}, coolingDown: ${isCoolingDown}). Force releasing.`);
                    setSpeechSynthesisActive(false);
                }
            }

            if (!shouldBeListening || isSpeechSynthesisActive || isMicBridgeConnected) return;

            // Edgeゾンビ状態・サイレント切断検出:
            // isListening=true（動いているつもり）でも、発話認識・no-speech無音応答・起動のいずれからも30分間一切音信不通の場合のみ判定。
            // ※配信中の離席や長時間の無音で誤爆しないよう、タイムアウトは30分に設定。
            // ※非アクティブ（裏画面）時にマイクを強制リビルドするとブラウザのUser Activation制限で確実に死ぬため、
            //   裏画面では勝手に壊さず、画面復帰時（focus）に安全に復元するフラグを立てて待機する。
            if (isListening && lastHealthyTime > 0 && (now - lastHealthyTime) > 30 * 60 * 1000) {
                if (document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus())) {
                    if (!window.needsZombieRecoveryOnFocus) {
                        window.needsZombieRecoveryOnFocus = true;
                        console.warn('Heartbeat: Edge zombie state detected (30min silence), but window is in background. Deferring rebuild until focus.');
                    }
                } else {
                    console.warn(`Heartbeat: Edge zombie/silent disconnect detected. No healthy communication for ${Math.round((now - lastHealthyTime) / 1000)}s while isListening=true. Force rebuilding...`);
                    lastHealthyTime = now; // 無限ループ防止のため先にリセット
                    lastActivityTime = now;
                    lastResultTime = now;
                    safeRebuildAndRestart('Edge zombie 30min timeout');
                    return;
                }
            }

            if (!isListening) {
                // すでに再接続待ち（micReconnectTimeoutId）が存在する場合は、Heartbeatは重複して割り込まず待機する
                if (window.micReconnectTimeoutId) {
                    return;
                }
                // 起動開始してから4秒経っても onstart が発火しない場合は膠着とみなして強制リビルド復帰
                if (isStarting && (now - lastStartAttemptTime) > 4000) {
                    startAttemptCount++;
                    console.warn(`Heartbeat: Speech recognition start timed out (${startAttemptCount}).`);

                    if (micStatus) {
                        micStatus.textContent = `マイク接続待機中（デバイス解放待ち・自動復旧中 ${startAttemptCount}）...`;
                        micStatus.style.color = 'var(--accent-color)';
                    }
                    safeRebuildAndRestart(`Start timeout retry (${startAttemptCount})`);
                } else if (!isStarting) {
                    // 直近のエラー・切断から3秒以上経過している場合のみリビルド（連打・暴走防止）
                    if ((now - lastErrorTime) > 3000) {
                        console.log('Heartbeat: Speech recognition should be running but is stopped. Recovering with safe rebuild...');
                        safeRebuildAndRestart('Heartbeat stopped recovery');
                    }
                }
            }
        }, 3000); // 3秒ごとに生存チェック
    } else if (btnMicToggle) {
        if (micStatus) {
            micStatus.textContent = 'お使いのブラウザは音声認識をサポートしていません。ChromeまたはEdgeをご使用ください';
        }
        btnMicToggle.disabled = true;
    }

    // ==========================================================================
    // ウィンドウフォーカス復帰時（別ブラウザ・他アプリからの復帰）の自動リカバリー
    // ==========================================================================
    window.addEventListener('focus', () => {
        console.log('Window gained focus. Running instant recovery check...');

        // AudioContext のサスペンド状態を即座に解除
        if (keepAliveAudioCtx && keepAliveAudioCtx.state === 'suspended') {
            keepAliveAudioCtx.resume().catch(() => {});
        }
        if (typeof effectAudioCtx !== 'undefined' && effectAudioCtx && effectAudioCtx.state === 'suspended') {
            effectAudioCtx.resume().catch(() => {});
        }
        if (window.speechSynthesis) {
            try { window.speechSynthesis.resume(); } catch(e) {}
        }

        // 音声認識が動いているべきなのに止まっている、裏画面で切断エラーが起きていた、または30分タイムアウト保留時の安全クリーン復旧
        if (SpeechRecognition && shouldBeListening && !isMicBridgeConnected) {
            if (!isListening || consecutiveErrorCount > 0 || window.needsZombieRecoveryOnFocus) {
                console.log('Focus recovery: SpeechRecognition requires recovery. Rebuilding cleanly with active user context...');
                window.needsZombieRecoveryOnFocus = false;
                lastHealthyTime = Date.now();
                consecutiveErrorCount = 0;
                if (window.micReconnectTimeoutId) {
                    clearTimeout(window.micReconnectTimeoutId);
                    window.micReconnectTimeoutId = null;
                }
                safeRebuildAndRestart('window focus recovery');
            }
        }
    });

    // ==========================================================================
    // バックグラウンドタブ復帰時の強制リカバリー (visibilitychange)
    // ==========================================================================
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('Tab became visible. Running recovery check...');

            // isSpeechSynthesisActive フラグがスタックしていたら強制解除
            if (isSpeechSynthesisActive && isSpeechSynthesisActiveStartTime > 0) {
                const now = Date.now();
                const lockDuration = now - isSpeechSynthesisActiveStartTime;
                const isReallySpeaking = window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
                const hasQueuedItems = typeof readAloudManager !== 'undefined' && readAloudManager && (readAloudManager.speaking || (readAloudManager.queue && readAloudManager.queue.length > 0));
                const isCoolingDown = (now - lastSpeechSynthesisEndTime) < 1000 || window.micMuteCooldownTimeoutId !== null;
                if ((!isReallySpeaking && !hasQueuedItems && !isCoolingDown && lockDuration > 3000) || lockDuration > 60000) {
                    console.warn(`Visibility recovery: isSpeechSynthesisActive stuck for ${Math.round(lockDuration / 1000)}s. Force releasing.`);
                    setSpeechSynthesisActive(false);
                }
            }

            // SpeechRecognition が動いているべきなのに停止していたら強制リビルド復帰
            if (SpeechRecognition && shouldBeListening && !isListening && !isMicBridgeConnected) {
                console.log('Visibility recovery: SpeechRecognition should be running but is stopped. Rebuilding...');
                if (window.micReconnectTimeoutId) {
                    clearTimeout(window.micReconnectTimeoutId);
                    window.micReconnectTimeoutId = null;
                }
                initSpeechRecognition();
                reconnectSpeechRecognition();
            }

            // AudioContext のサスペンド状態を解除
            if (typeof effectAudioCtx !== 'undefined' && effectAudioCtx && effectAudioCtx.state === 'suspended') {
                effectAudioCtx.resume().catch(() => {});
            }

            // SpeechSynthesis の resume
            if (window.speechSynthesis) {
                try { window.speechSynthesis.resume(); } catch(e) {}
            }
        }
    });

    // ==========================================================================
    // クイックテキスト返答フォーム制御
    // ==========================================================================
    if (broadcasterTextInput && btnSendBroadcasterText) {
        async function handleSendBroadcasterText() {
            const text = broadcasterTextInput.value.trim();
            if (!text) return;
            
            broadcasterTextInput.value = '';
            const originalPlaceholder = broadcasterTextInput.placeholder;
            broadcasterTextInput.placeholder = '自動翻訳して送信中...';
            
            const translated = await translateTextToEn(text);
            sendBroadcasterTranslation(text, translated);
            
            broadcasterTextInput.placeholder = '送信完了いたしました！';
            setTimeout(() => {
                broadcasterTextInput.placeholder = originalPlaceholder;
            }, 2000);
        }
        
        btnSendBroadcasterText.addEventListener('click', handleSendBroadcasterText);
        broadcasterTextInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSendBroadcasterText();
            }
        });
    }

    // ==========================================================================
    // APIポーリング同期
    // ==========================================================================
    const processedChatIdsAdmin = new Set();
    let isFirstPollAdmin = true;
    async function startApiPollingAdmin() {
        const port = window.location.port || '8080';
        setInterval(async () => {
            try {
                const res = await fetch(`http://localhost:${port}/api/chat?t=${Date.now()}`);
                if (!res.ok) return;
                const chats = await res.json();
                if (Array.isArray(chats)) {
                    chats.forEach(chat => {
                        if (chat && chat.id) {
                            if (!processedChatIdsAdmin.has(chat.id)) {
                                processedChatIdsAdmin.add(chat.id);
                                
                                // 起動時刻より前の過去ログ、または初回起動時の古いデータはスルー
                                const isPastChat = chat.timestamp && chat.timestamp < appLoadTime;
                                if (!isFirstPollAdmin && !isPastChat && !chat.isBroadcaster) {
                                    appendToChatLog(chat);
                                    
                                    if (readAloudManager) {
                                        readAloudManager.speak(chat);
                                    }
                                }
                            }
                        }
                    });
                    isFirstPollAdmin = false;
                    
                    if (processedChatIdsAdmin.size > 1000) {
                        const firstKey = processedChatIdsAdmin.values().next().value;
                        processedChatIdsAdmin.delete(firstKey);
                    }
                }
            } catch (err) {
                // 無視
            }
        }, 500);
    }
    startApiPollingAdmin();

    // ==========================================================================
    // 読み上げ辞書UI制御ロジック
    // ==========================================================================
    const dictWordInput = document.getElementById('dict-word');
    const dictReadingInput = document.getElementById('dict-reading');
    const btnAddDict = document.getElementById('btn-add-dict');
    const dictListContainer = document.getElementById('dict-list-container');
    const dictListBody = document.getElementById('dict-list-body');

    if (btnAddDict && dictWordInput && dictReadingInput && dictListContainer && dictListBody) {
        function getDictionary() {
            try {
                const saved = localStorage.getItem('yt_translator_reading_dict');
                return saved ? JSON.parse(saved) : [];
            } catch (e) {
                return [];
            }
        }

        function saveDictionary(dict) {
            localStorage.setItem('yt_translator_reading_dict', JSON.stringify(dict));
        }

        function renderDictionary() {
            const dict = getDictionary();
            dictListBody.innerHTML = '';
            
            if (dict.length === 0) {
                dictListContainer.style.display = 'none';
                return;
            }
            
            dictListContainer.style.display = 'block';
            dict.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
                
                const tdWord = document.createElement('td');
                tdWord.style.padding = '0.5rem';
                tdWord.style.color = '#fff';
                tdWord.textContent = item.word;
                
                const tdReading = document.createElement('td');
                tdReading.style.padding = '0.5rem';
                tdReading.style.color = '#fff';
                tdReading.textContent = item.reading;
                
                const tdAction = document.createElement('td');
                tdAction.style.padding = '0.5rem';
                tdAction.style.textAlign = 'right';
                
                const btnDelete = document.createElement('button');
                btnDelete.textContent = '削除';
                btnDelete.style.background = 'rgba(239, 68, 68, 0.15)';
                btnDelete.style.border = '1px solid rgba(239, 68, 68, 0.4)';
                btnDelete.style.color = '#f87171';
                btnDelete.style.padding = '0.2rem 0.5rem';
                btnDelete.style.borderRadius = '4px';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '0.8rem';
                
                btnDelete.addEventListener('click', () => {
                    const currentDict = getDictionary();
                    currentDict.splice(index, 1);
                    saveDictionary(currentDict);
                    renderDictionary();
                });
                
                tdAction.appendChild(btnDelete);
                tr.appendChild(tdWord);
                tr.appendChild(tdReading);
                tr.appendChild(tdAction);
                dictListBody.appendChild(tr);
            });
        }

        btnAddDict.addEventListener('click', () => {
            const word = dictWordInput.value.trim();
            const reading = dictReadingInput.value.trim();
            
            if (!word || !reading) {
                alert('変換前の単語と読み方の両方を入力してください');
                return;
            }
            
            const currentDict = getDictionary();
            
            // 重複チェック (すでに登録されている単語は上書き)
            const existingIndex = currentDict.findIndex(item => item.word.toLowerCase() === word.toLowerCase());
            if (existingIndex > -1) {
                currentDict[existingIndex].reading = reading;
            } else {
                currentDict.push({ word, reading });
            }
            
            saveDictionary(currentDict);
            renderDictionary();
            
            // 入力欄をリセット
            dictWordInput.value = '';
            dictReadingInput.value = '';
            dictWordInput.focus();
        });

        // 初回ロード時に辞書リストを表示
        renderDictionary();
    }

    // ==========================================================================
    // マイク誤認識修正辞書UI制御ロジック
    // ==========================================================================
    const correctIncorrectInput = document.getElementById('correct-incorrect-word');
    const correctCorrectInput = document.getElementById('correct-correct-word');
    const btnAddCorrect = document.getElementById('btn-add-correct');
    const correctListContainer = document.getElementById('correct-list-container');
    const correctListBody = document.getElementById('correct-list-body');

    if (btnAddCorrect && correctIncorrectInput && correctCorrectInput && correctListContainer && correctListBody) {
        function getCorrectDictionary() {
            try {
                const saved = localStorage.getItem('yt_translator_speech_correct_dict');
                return saved ? JSON.parse(saved) : [];
            } catch (e) {
                return [];
            }
        }

        function saveCorrectDictionary(dict) {
            localStorage.setItem('yt_translator_speech_correct_dict', JSON.stringify(dict));
        }

        function renderCorrectDictionary() {
            const dict = getCorrectDictionary();
            correctListBody.innerHTML = '';
            
            if (dict.length === 0) {
                correctListContainer.style.display = 'none';
                return;
            }
            
            correctListContainer.style.display = 'block';
            dict.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
                
                const tdIncorrect = document.createElement('td');
                tdIncorrect.style.padding = '0.5rem';
                tdIncorrect.style.color = '#fff';
                tdIncorrect.textContent = item.incorrect;
                
                const tdCorrect = document.createElement('td');
                tdCorrect.style.padding = '0.5rem';
                tdCorrect.style.color = '#fff';
                tdCorrect.textContent = item.correct;
                
                const tdAction = document.createElement('td');
                tdAction.style.padding = '0.5rem';
                tdAction.style.textAlign = 'right';
                
                const btnDelete = document.createElement('button');
                btnDelete.textContent = '削除';
                btnDelete.style.background = 'rgba(239, 68, 68, 0.15)';
                btnDelete.style.border = '1px solid rgba(239, 68, 68, 0.4)';
                btnDelete.style.color = '#f87171';
                btnDelete.style.padding = '0.2rem 0.5rem';
                btnDelete.style.borderRadius = '4px';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontSize = '0.8rem';
                
                btnDelete.addEventListener('click', () => {
                    const currentDict = getCorrectDictionary();
                    currentDict.splice(index, 1);
                    saveCorrectDictionary(currentDict);
                    renderCorrectDictionary();
                });
                
                tdAction.appendChild(btnDelete);
                tr.appendChild(tdIncorrect);
                tr.appendChild(tdCorrect);
                tr.appendChild(tdAction);
                correctListBody.appendChild(tr);
            });
        }

        btnAddCorrect.addEventListener('click', () => {
            const incorrect = correctIncorrectInput.value.trim();
            const correct = correctCorrectInput.value.trim();
            
            if (!incorrect || !correct) {
                alert('誤認識される言葉と正しい言葉の両方を入力してください');
                return;
            }
            
            const currentDict = getCorrectDictionary();
            
            // 重複チェック (すでに登録されている言葉は上書き)
            const existingIndex = currentDict.findIndex(item => item.incorrect.toLowerCase() === incorrect.toLowerCase());
            if (existingIndex > -1) {
                currentDict[existingIndex].correct = correct;
            } else {
                currentDict.push({ incorrect, correct });
            }
            
            saveCorrectDictionary(currentDict);
            renderCorrectDictionary();
            
            // 入力欄をリセット
            correctIncorrectInput.value = '';
            correctCorrectInput.value = '';
            correctIncorrectInput.focus();
        });

        // 初回ロード時に辞書リストを表示
        renderCorrectDictionary();

        // --- HP用語プリセットデータのロード＆トグル制御 ---
        let isPresetLoaded = false;
        const btnTogglePreset = document.getElementById('btn-toggle-preset');
        const presetTagsContainer = document.getElementById('preset-tags-container');
        const presetTagsList = document.getElementById('preset-tags-list');

        if (btnTogglePreset && presetTagsContainer && presetTagsList) {
            btnTogglePreset.addEventListener('click', async () => {
                if (presetTagsContainer.style.display === 'none') {
                    presetTagsContainer.style.display = 'block';
                    btnTogglePreset.textContent = 'HP用語プリセットを閉じる';
                    
                    if (!isPresetLoaded) {
                        try {
                            presetTagsList.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem;">用語データを読み込み中...</span>';
                            // サーバー経由でプリセットJSONを直接フェッチ
                            const response = await fetch('preset_words.json');
                            if (!response.ok) throw new Error('Failed to load words list');
                            const sortedWords = await response.json();
                            
                            presetTagsList.innerHTML = '';
                            
                            if (!Array.isArray(sortedWords) || sortedWords.length === 0) {
                                presetTagsList.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem;">登録可能な用語が見つかりませんでした</span>';
                            } else {
                                sortedWords.forEach(word => {
                                    const span = document.createElement('span');
                                    span.textContent = word;
                                    span.style.background = 'rgba(56, 189, 248, 0.15)';
                                    span.style.border = '1px solid rgba(56, 189, 248, 0.3)';
                                    span.style.color = '#38bdf8';
                                    span.style.padding = '0.2rem 0.5rem';
                                    span.style.borderRadius = '6px';
                                    span.style.cursor = 'pointer';
                                    span.style.fontSize = '0.8rem';
                                    span.style.transition = 'all 0.2s';
                                    
                                    span.addEventListener('mouseover', () => {
                                        span.style.background = 'rgba(56, 189, 248, 0.25)';
                                        span.style.borderColor = '#38bdf8';
                                    });
                                    span.addEventListener('mouseout', () => {
                                        span.style.background = 'rgba(56, 189, 248, 0.15)';
                                        span.style.borderColor = 'rgba(56, 189, 248, 0.3)';
                                    });
                                    
                                    span.addEventListener('click', () => {
                                        if (correctCorrectInput) {
                                            correctCorrectInput.value = word;
                                            if (correctIncorrectInput) {
                                                correctIncorrectInput.focus();
                                            }
                                        }
                                    });
                                    
                                    presetTagsList.appendChild(span);
                                });
                                isPresetLoaded = true;
                            }
                        } catch (err) {
                            console.error('Failed to load preset words:', err);
                            presetTagsList.innerHTML = '<span style="color: #f87171; font-size: 0.8rem;">用語プリセットの読み込みに失敗しました。サーバーが起動しているかご確認ください</span>';
                        }
                    }
                } else {
                    presetTagsContainer.style.display = 'none';
                    btnTogglePreset.textContent = 'HP用語プリセットを表示';
                }
            });
        }
        // 初回ユーザー操作時にオーディオKeepAliveパイプラインを起動（DOMContentLoadedスコープ内で安全に登録）
        window.addEventListener('click', () => { startAudioKeepAlive(); }, { once: true });
    }
});
