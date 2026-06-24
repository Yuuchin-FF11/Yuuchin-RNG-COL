// YouTube Chat Translator - 管理画面ロジック (コメビュ版・APIキー不要)

// お上品（NGワード）フィルターのロジック🐾
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
        const replacement = '🐾'.repeat(word.length);
        cleanedText = cleanedText.replace(regex, replacement);
    });
    
    return cleanedText;
}

// 起動時刻の記録（過去ログ巻き戻り防止用）🐾
const appLoadTime = Date.now();

// マイク・音声認識用の状態管理変数🐾
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let shouldBeListening = false;
let isSpeechSynthesisActive = false;
let lastErrorTime = 0;
let lastErrorType = '';
let isStarting = false;
let lastStartAttemptTime = 0;
let lastStartSuccessTime = 0;
let consecutiveErrorCount = 0;

// 音声合成（読み上げ）の状態を切り替えるセッター関数。
// OFFになった際にマイクが意図せず停止していれば自動復帰させる🐾
function setSpeechSynthesisActive(active) {
    isSpeechSynthesisActive = active;
    if (!active) {
        if (shouldBeListening && !isListening) {
            console.log('Speech recognition was stopped during SpeechSynthesis. Restarting now...🐾');
            if (typeof window.reconnectSpeechRecognition === 'function') {
                window.reconnectSpeechRecognition();
            } else {
                try {
                    if (recognition) recognition.start();
                } catch (e) {
                    console.warn('Failed to restart recognition after SpeechSynthesis ended:', e);
                }
            }
        }
    }
}

// マイク入力を無視する状態（ソフトミュート）を読み上げ終了後3秒間維持し、デバイス競合を防ぐデバウンス処理🐾
function triggerDelayedMicRestart() {
    if (window.micRestartTimeoutId) {
        clearTimeout(window.micRestartTimeoutId);
    }
    
    // 読み上げ自体は終わっているが、マイクのソフトミュート解除を3秒遅延させる🐾
    window.micRestartTimeoutId = setTimeout(() => {
        setSpeechSynthesisActive(false);
        console.log('Mic soft-mute released (speech synthesis active flag cleared)🐾');
    }, 3000); // 3秒待ってからソフトミュートを解除🐾
}

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

        // Chrome/EdgeのSpeechSynthesisバグ対策
        setInterval(() => {
            if (this.synth) {
                try {
                    this.synth.resume();
                } catch(e) {}
            }
        }, 5000);
    }

    speak(chat) {
        if (!this.enableCheckbox || !this.enableCheckbox.checked) {
            return;
        }

        if (chat.isBroadcaster) {
            return;
        }

        const textsToSpeak = this.prepareTexts(chat);
        if (textsToSpeak.length === 0) return;

        this.queue.push(...textsToSpeak);
        this.processQueue();
    }

    async speakVoiceVox(text, speakerId) {
        try {
            const queryUrl = `http://localhost:50021/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`;
            const queryRes = await fetch(queryUrl, { method: 'POST' });
            if (!queryRes.ok) throw new Error('VOICEVOX query failed');
            const queryData = await queryRes.json();

            if (this.rateSlider) {
                queryData.speedScale = parseFloat(this.rateSlider.value);
            }
            if (this.pitchSlider) {
                queryData.pitchScale = parseFloat(this.pitchSlider.value) - 0.5;
            }

            const synthUrl = `http://localhost:50021/synthesis?speaker=${speakerId}`;
            const synthRes = await fetch(synthUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(queryData)
            });
            if (!synthRes.ok) throw new Error('VOICEVOX synthesis failed');
            
            const audioBlob = await synthRes.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            if (this.volumeSlider) {
                audio.volume = parseInt(this.volumeSlider.value) / 100;
            } else {
                audio.volume = 1.0;
            }

            return new Promise((resolve) => {
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    resolve(true);
                };
                audio.onerror = (e) => {
                    console.error('Audio playback error:', e);
                    URL.revokeObjectURL(audioUrl);
                    resolve(false);
                };
                audio.play().catch(err => {
                    console.error('Audio play blocked:', err);
                    URL.revokeObjectURL(audioUrl);
                    resolve(false);
                });
            });
        } catch (err) {
            console.warn('VOICEVOX is not running or failed:', err);
            return false;
        }
    }

    async processQueue() {
        if (this.speaking || this.queue.length === 0) {
            return;
        }

        if (window.micRestartTimeoutId) {
            clearTimeout(window.micRestartTimeoutId);
            window.micRestartTimeoutId = null;
        }
        this.speaking = true;
        setSpeechSynthesisActive(true);

        // マイクは停止せず、ソフトミュート（無視）にするため即座に非同期処理を実行する🐾
        setTimeout(async () => {
            const item = this.queue.shift();
            if (!item) {
                setSpeechSynthesisActive(false);
                this.speaking = false;
                return;
            }

            // 読み上げ用のテキストに変換辞書を適用🐾
            item.text = this.applyReadingDictionary(item.text);
            
            const charVal = this.characterSelect ? this.characterSelect.value : 'standard';

            // VOICEVOXでの読み上げ処理
            if (item.lang === 'ja-JP' && charVal.startsWith('vv_')) {
                const speakerId = parseInt(charVal.replace('vv_', ''));
                const success = await this.speakVoiceVox(item.text, speakerId);
                
                // 読み上げ終了後のマイク再開処理を削除し、遅延ミュート解除（または即時解除）を実行🐾
                setSpeechSynthesisActive(false);

                if (success) {
                    this.speaking = false;
                    setTimeout(() => this.processQueue(), 250);
                    return;
                }
                console.log('VOICEVOX is unavailable, falling back to browser SpeechSynthesis...');
                
                setSpeechSynthesisActive(true);
                // フォールバックの際も、少し待ってからSpeechSynthesisを開始する🐾
                await new Promise(r => setTimeout(r, 500));
            }

            // Edge のオンライン音声は cancel()/getVoices()/ウェイトではリセットできないため、
            // ボリューム0の極短ウォームアップ発話で接続を事前に確立してから本番発話を行う🐾
            try {
                this.synth.cancel();
            } catch(e) {}
            await new Promise(r => setTimeout(r, 200));

            // ウォームアップ発話（フォールバック試行時はスキップ。失敗が確定した接続で時間を浪費しない）🐾
            if (!item._isFallbackAttempted) {
                const warmupSuccess = await new Promise((resolve) => {
                    const warmup = new SpeechSynthesisUtterance('.');
                    warmup.volume = 0.01;  // ほぼ無音
                    warmup.rate = 10;      // 最速で終わらせる
                    warmup.lang = item.lang;
                    // ウォームアップにも同じオンライン音声を使って接続を確立🐾
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
                    // ウォームアップが失敗しても本番発話は試みる（別の原因かもしれない）
                    try { this.synth.cancel(); } catch(e) {}
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            // 音声リストを再取得🐾
            this.voices = this.synth.getVoices();

            // 標準SpeechSynthesisでの読み上げ処理
            const utterance = new SpeechSynthesisUtterance(item.text);
            utterance.lang = item.lang;

            // オンライン音声のリトライ・フォールバック判定🐾
            let bestVoice = null;
            if (item._isFallbackAttempted === 2) {
                // 最終フォールバック：ローカルオフライン音声（Microsoft Harukaなど）を選択🐾
                bestVoice = this.getBestLocalVoice(item.lang);
            } else {
                // 通常時および1回目のリトライ時：ななみちゃん（Online音声）を選択🐾
                bestVoice = this.getBestVoice(item.lang);
            }
            if (bestVoice) {
                utterance.voice = bestVoice;
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

            // GCからUtteranceオブジェクトを保護🐾
            if (!window.activeUtterances) { window.activeUtterances = []; }
            window.activeUtterances.push(utterance);

            const resumeRecognition = () => {
                triggerDelayedMicRestart();
            };

            const cleanUtterance = () => {
                if (window.activeUtterances) {
                    window.activeUtterances = window.activeUtterances.filter(u => u !== utterance);
                }
            };

            const watchdogId = setTimeout(() => {
                console.warn('SpeechSynthesis output timed out. Forcing next queue...');
                // タイムアウト時はイベントの競合を防ぐため、イベントハンドラを無効化してから cancel します🐾
                utterance.onend = null;
                utterance.onerror = null;
                try {
                    this.synth.cancel(); // タイムアウト時のみ、詰まりを解消するために cancel を実行🐾
                } catch(err) {}
                cleanUtterance();
                resumeRecognition();
                this.speaking = false;
                this.processQueue();
            }, 30000); // 長いコメントの読み上げにも対応できるよう、タイムアウトを30秒へ延長🐾

            utterance.onend = () => {
                clearTimeout(watchdogId);
                cleanUtterance();
                // 読み上げ完了直後に cancel() を呼び、Edgeのオンライン音声サーバー接続を即座に切断🐾
                // これにより次の speak() 時に古い接続との競合を防ぐ
                try { this.synth.cancel(); } catch(err) {}
                resumeRecognition();
                this.speaking = false;
                setTimeout(() => this.processQueue(), 250);
            };

            utterance.onerror = (e) => {
                clearTimeout(watchdogId);
                console.error('SpeechSynthesis error:', e.error || e); // 詳細なエラー原因を出力🐾
                cleanUtterance();

                try {
                    // タイムアウトや意図的な cancel() による中断（interrupted）や強制終了（aborted）の場合はリトライ・フォールバックを行いません🐾
                    if (e.error === 'interrupted' || e.error === 'aborted') {
                        console.log(`SpeechSynthesis aborted or interrupted (${e.error}). No retry.`);
                    } else if (bestVoice && bestVoice.name && bestVoice.name.includes('Online')) {
                        // ななみちゃん（Online音声）での再生が接続断などで本当に失敗した場合（synthesis-failedなど）のみリトライします🐾
                        if (!item._isFallbackAttempted) {
                            // 1度目の失敗：1.5秒待ってから、ななみちゃんのままでもう一度再試行する🐾
                            console.warn('Online voice failed. Retrying with same Online voice after 1.5s...');
                            item._isFallbackAttempted = 1; // 1回目試行完了
                            // エラー状態の音声エンジンをリセットしてからリトライ🐾
                            try { this.synth.cancel(); } catch(err) {}
                            this.queue.unshift(item);
                            // 再試行のウェイト中はマイクを起動させずOFFのままキープ🐾
                            this.speaking = false;
                            setTimeout(() => this.processQueue(), 1500); // 1.5秒のウェイトを置いて再試行🐾
                            return;
                        } else if (item._isFallbackAttempted === 1) {
                            // 2度目の失敗（ななみちゃんでリトライしたのにダメだった場合）：最終手段として Haruka などのローカルオフライン音声へフォールバック🐾
                            console.warn('Online voice failed again. Falling back to local offline voice...');
                            item._isFallbackAttempted = 2; // 2回目（最終）フォールバック
                            // Edgeの音声エンジンがエラー状態のまま残っているため、cancel()で内部状態を強制リセットしてから十分な回復時間を置く🐾
                            try { this.synth.cancel(); } catch(err) {}
                            this.queue.unshift(item);
                            // 再試行のウェイト中はマイクを起動させずOFFのままキープ🐾
                            this.speaking = false;
                            setTimeout(() => this.processQueue(), 1500); // 1.5秒待って音声エンジン回復後に Haruka で再試行🐾
                            return;
                        }
                    }
                } catch (err) {
                    console.error('Error in SpeechSynthesis error handler recovery:', err);
                }

                // いかなる想定外のエラーが起きても、確実にキュー処理とマイクをONに戻すセーフティネット🐾
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

        const langVoices = this.voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(lang.toLowerCase()));
        if (langVoices.length === 0) return null;

        if (lang.toLowerCase().startsWith('ja')) {
            const nanami = langVoices.find(v => v.name.includes('Nanami') || v.name.includes('Natural') || v.name.includes('Online'));
            if (nanami) return nanami;
            
            const google = langVoices.find(v => v.name.includes('Google') || v.name.includes('日本語'));
            if (google) return google;
            
            const ayumi = langVoices.find(v => v.name.includes('Ayumi'));
            if (ayumi) return ayumi;
            
            const haruka = langVoices.find(v => v.name.includes('Haruka') || v.name.includes('Ichiro') === false);
            if (haruka) return haruka;
        } else if (lang.toLowerCase().startsWith('en')) {
            const googleEn = langVoices.find(v => v.name.includes('Google') || v.name.includes('US English'));
            if (googleEn) return googleEn;
            
            const zira = langVoices.find(v => v.name.includes('Zira') || v.name.includes('Hazel'));
            if (zira) return zira;
        } else if (lang.toLowerCase().startsWith('ko')) {
            const heami = langVoices.find(v => v.name.includes('Heami') || v.name.includes('Google'));
            if (heami) return heami;
        }

        return langVoices[0];
    }

    getBestLocalVoice(lang) {
        if (!this.voices || this.voices.length === 0) {
            this.voices = this.synth.getVoices();
        }

        // localService === true の音声だけを対象にする（サーバー依存音声を完全に除外）🐾
        const langVoices = this.voices.filter(v =>
            v.localService === true &&
            v.lang.toLowerCase().replace('_', '-').startsWith(lang.toLowerCase())
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
        return parseInt(val) === 61 ? '無制限 🐾' : `${val}秒`;
    };
    setupSlider(displayTimeSlider, displayTimeVal, '秒', displayTimeFormatter);
    setupSlider(maxCommentsSlider, maxCommentsVal, '個');

    const pitchFormatter = (val) => {
        const num = parseFloat(val);
        if (num >= 1.5) return `${val} (アニメ声・超かわいい🐾)`;
        if (num >= 1.2) return `${val} (少し高め・明るく自然🐾)`;
        if (num > 1.0) return `${val} (高め・かわいい🐾)`;
        if (num < 0.9) return `${val} (低音ボイス)`;
        return `${val} (標準の高さ)`;
    };
    const rateFormatter = (val) => {
        const num = parseFloat(val);
        if (num > 1.1) return `${val} (少し早め🐾)`;
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
    // 効果音プリロードシステム（バックグラウンドタブでも確実に再生するため）🐾
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
            console.log('効果音プリロード完了🐾');
        } catch (err) {
            console.warn('効果音プリロード失敗（HTML5 Audio にフォールバックします）:', err);
        }
    }

    function unlockEffectAudioCtx() {
        if (effectAudioCtx && effectAudioCtx.state === 'suspended') {
            effectAudioCtx.resume().catch(() => {});
            console.log('AudioContext アンロック完了🐾');
        }
    }
    document.addEventListener('click', unlockEffectAudioCtx);
    document.addEventListener('keydown', unlockEffectAudioCtx);

    // AudioContext のバックグラウンド・サスペンド復帰用🐾
    setInterval(() => {
        if (effectAudioCtx && effectAudioCtx.state === 'suspended') {
            effectAudioCtx.resume().catch(() => {});
        }
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
                        // 再生終了時にオーディオ接続を明示的に解除してリソースを解放する🐾
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
        
        showStatus('connected', '設定を保存しました🐾');
        setTimeout(() => {
            if (chatObserver) {
                showStatus('connected', 'チャット監視中🐾');
            } else {
                showStatus('disconnected', '接続準備完了');
            }
        }, 2000);
    });

    // ==========================================================================
    // 配信枠の自動取得ロジック（CORS無効化 Edge経由でのスクレイピング）🐾
    // ==========================================================================
    if (btnDetectLive) {
        btnDetectLive.addEventListener('click', async () => {
            const channelId = 'UCmqjbqc6hR8s4Fwi9KDQ2yQ';
            showStatus('connecting', '配信枠を自動確認中...');
            
            try {
                // CORS無効化されたEdgeで実行されるため、直接フェッチが可能です🐾
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
                    showStatus('connected', '配信枠を検出しました！🐾');
                    
                    // 設定を自動保存
                    const settings = getSettingsObject();
                    localStorage.setItem('yt_translator_settings', JSON.stringify(settings));
                    localStorage.setItem('yt_translator_live_settings', JSON.stringify(settings));
                } else {
                    alert('現在、ライブ配信が検出できませんでした。配信が開始されているかご確認ください🐾');
                    showStatus('disconnected', '配信枠が検出できませんでした');
                }
            } catch (err) {
                console.error('配信枠の自動検出エラー:', err);
                alert('配信枠の自動取得中にエラーが発生しました。手動でURLを入力してください🐾');
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
            .replace('管理画面.html', 'オーバーレイ.html')
            .replace('admin.html', 'overlay.html');
        if (!overlayPath.includes('オーバーレイ.html') && !overlayPath.includes('overlay.html')) {
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
        showStatus('connecting', 'チャット読込完了、監視中🐾');
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

            const targetContainer = iframeDoc.querySelector('#chat-items') || iframeDoc.querySelector('yt-live-chat-item-list-renderer');
            
            if (targetContainer) {
                console.log('Chat container found! Starting observer...');
                setupObserver(targetContainer);
                showStatus('connected', 'チャット監視中🐾');
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
                // 日本語 ➔ 英訳 (設定がONの場合)🐾
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

            // 読み上げと効果音再生の直列制御（音声競合によるななみちゃんフリーズバグの根本防止🐾）
            if (isSuperChat || isMembership) {
                setSpeechSynthesisActive(true); // 効果音再生の段階から音声合成中フラグを立ててソフトミュート開始🐾

                const soundNum = Math.random() < 0.5 ? 1 : 2;
                let hasTriggeredSpeech = false;
                
                const startSpeechFallback = () => {
                    if (!hasTriggeredSpeech) {
                        hasTriggeredSpeech = true;
                        if (readAloudManager) {
                            readAloudManager.speak(chatObj);
                        }
                    }
                };

                // 5秒のタイムアウトで強制的に読み上げを開始するセーフティネット🐾
                const speechTimeoutId = setTimeout(startSpeechFallback, 5000);

                // プリロード済み AudioContext で効果音を再生（バックグラウンドタブ対応）🐾
                const vol = parseInt(effectVolumeSlider.value) / 100;
                playEffectSound(soundNum, vol).then(success => {
                    clearTimeout(speechTimeoutId);
                    if (success) {
                        // 効果音終了後、300ms待ってから読み上げ🐾
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
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ja&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Translation failed');
            const data = await res.json();
            
            if (data && data[0]) {
                let translated = '';
                for (let i = 0; i < data[0].length; i++) {
                    if (data[0][i] && data[0][i][0]) {
                        translated += data[0][i][0];
                    }
                }
                return translated.trim();
            }
            return text;
        } catch (err) {
            console.error('Translation error:', err);
            return text;
        }
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

        // 読み上げと効果音再生の直列制御（音声競合によるななみちゃんフリーズバグの根本防止🐾）
        if (isSuperChat || isMembership) {
            setSpeechSynthesisActive(true); // 効果音再生の段階から音声合成中フラグを立ててソフトミュート開始🐾

            const soundNum = Math.random() < 0.5 ? 1 : 2;
            let hasTriggeredSpeech = false;
            
            const startSpeechFallback = () => {
                if (!hasTriggeredSpeech) {
                    hasTriggeredSpeech = true;
                    if (readAloudManager) {
                        readAloudManager.speak(testComment);
                    }
                }
            };

            // 5秒のタイムアウトで強制的に読み上げを開始するセーフティネット🐾
            const speechTimeoutId = setTimeout(startSpeechFallback, 5000);

            // プリロード済み AudioContext で効果音を再生🐾
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

        testInfoText.textContent = `[${lang}] テストコメントを送信しました！🐾`;
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
                { o: "Thank you for the amazing sniper shots! Keep up the great work!", t: "素晴らしいスナイパーショットをありがとうございます！これからも頑張ってください！", n: "SC_Supporter_🐾" },
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
                { o: "I just joined the channel membership! So excited!", t: "メンバーシップに新しく加入しました！配信応援してます！", n: "FF11_MEMBER_🐾" },
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

        testInfoText.textContent = "画面と履歴をクリアしました 🐾";
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
            // 誤認識した自分の言葉をワンクリックで修正フォームへ転送するショートカットボタン🐾
            const btnCorrectLog = document.createElement('button');
            btnCorrectLog.textContent = '修正登録🐾';
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
                
                // 起動時刻より前の過去ログはスルー🐾
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
    async function translateTextToEn(text) {
        if (!text) return '';
        
        // 「え？」「絵？」単体の特別ガードルール🐾
        const trimmedSimple = text.trim().replace(/[?？]/g, '');
        if (trimmedSimple === 'え' || trimmedSimple === '絵') {
            return 'Eh?';
        }

        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Translation to English failed');
            
            const data = await res.json();
            if (data && data[0]) {
                let translated = '';
                for (let i = 0; i < data[0].length; i++) {
                    if (data[0][i]) {
                        let transPart = data[0][i][0] || '';
                        const origPart = data[0][i][1] || '';
                        
                        // 各セグメントが「え」「絵」等の聞き返しの場合は「Eh?」に置き換える🐾
                        const trimmedOrig = origPart.trim().replace(/[?？]/g, '');
                        if (trimmedOrig === 'え' || trimmedOrig === '絵') {
                            transPart = transPart.includes('?') || origPart.includes('?') ? 'Eh? ' : 'Eh ';
                        }
                        
                        translated += transPart;
                    }
                }
                return translated.trim();
            }
            return text;
        } catch (err) {
            console.error('Translation error to English:', err);
            return text;
        }
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
    // 配信者マイクリアルタイム音声認識 (Web Speech API)
    // ==========================================================================
    if (SpeechRecognition && btnMicToggle) {
        
        // 音声認識インスタンスの初期化・再構築（リビルド）関数🐾
        function initSpeechRecognition() {
            if (recognition) {
                // 既存のインスタンスのイベントハンドラを解除して破棄🐾
                recognition.onstart = null;
                recognition.onend = null;
                recognition.onerror = null;
                recognition.onresult = null;
                try { recognition.abort(); } catch(e) {}
                recognition = null;
            }

            recognition = new SpeechRecognition();
            recognition.lang = 'ja-JP';
            recognition.continuous = true;
            recognition.interimResults = false;

            recognition.onstart = () => {
                isListening = true;
                isStarting = false; // 起動処理完了🐾
                lastStartSuccessTime = Date.now();
                consecutiveErrorCount = 0; // 正常に起動できたら連続エラーカウントをリセット🐾
                lastErrorType = ''; // エラー状態をクリア🐾
                if (micDot) micDot.classList.add('active');
                if (micBtnText) micBtnText.textContent = 'マイク音声認識: ON';
                if (micStatus) {
                    micStatus.textContent = 'マイク入力中... 日本語で喋ると自動英訳されます 🎙️';
                    micStatus.style.color = 'var(--success-color)';
                }
            };

            recognition.onend = () => {
                isListening = false;
                isStarting = false;

                if (shouldBeListening) {
                    if (!isSpeechSynthesisActive) {
                        const now = Date.now();
                        // 連続エラー回数（no-speechやabortedを除く通信異常など）に応じて再接続の待機時間を可変🐾
                        // 直近のエラーが no-speech またはエラーなしの場合は delay = 0 で即座に再起動します🐾
                        let delay = 0;
                        if (lastErrorType && lastErrorType !== 'no-speech' && lastErrorType !== 'aborted') {
                            if (consecutiveErrorCount === 1) delay = 500;
                            else if (consecutiveErrorCount === 2) delay = 2000;
                            else if (consecutiveErrorCount >= 3) delay = 5000;
                        }

                        if (window.micRestartTimeoutId) {
                            clearTimeout(window.micRestartTimeoutId);
                        }

                        if (delay > 0) {
                            console.log(`Speech recognition disconnected with errors (type: ${lastErrorType}, consecutive count: ${consecutiveErrorCount}). Waiting ${delay}ms before reconnecting...`);
                            if (micStatus) {
                                // 軽微なエラー時は「接続維持中」の表示のままにし、警告テキストでチカチカするのを防ぎます🐾
                                if (consecutiveErrorCount >= 3) {
                                    micStatus.textContent = '接続が不安定なため、一時待機して再接続を試みます... 🐾';
                                    micStatus.style.color = 'var(--accent-color)';
                                } else {
                                    micStatus.textContent = 'マイク接続維持中（自動復旧）... 🎙️';
                                    micStatus.style.color = 'var(--success-color)';
                                }
                            }
                            window.micRestartTimeoutId = setTimeout(() => {
                                if (shouldBeListening && !isListening && !isSpeechSynthesisActive) {
                                    reconnectSpeechRecognition();
                                }
                            }, delay);
                        } else {
                            console.log('Speech recognition disconnected (normal/no-speech). Reconnecting immediately...');
                            reconnectSpeechRecognition();
                        }
                    } else {
                        // 読み上げ中のため、UIはONを維持しつつ、自動再起動は読み上げ完了時に任せる🐾
                        if (micStatus) {
                            micStatus.textContent = '読み上げ中のため、マイク入力を一時停止（ソフトミュート）しています... 🐾';
                            micStatus.style.color = 'var(--accent-color)';
                        }
                    }
                    return;
                }

                // 本当に手動で停止された場合のみUIをOFF表示にする🐾
                if (micDot) micDot.classList.remove('active');
                if (micBtnText) micBtnText.textContent = 'マイク音声認識: OFF';
                if (micStatus) {
                    micStatus.textContent = '音声認識は停止しています。';
                    micStatus.style.color = 'var(--text-muted)';
                }
            };

            recognition.onerror = (e) => {
                // console.errorの代わりにconsole.warnを使用し、エラーの赤文字出力を防ぐ🐾
                console.warn('Speech recognition warning:', e.error);
                lastErrorTime = Date.now();
                lastErrorType = e.error;

                // no-speech（無音タイムアウト）や aborted（手動停止）は通信異常ではないので、連続エラーカウントから除外します🐾
                if (e.error !== 'no-speech' && e.error !== 'aborted') {
                    consecutiveErrorCount++;
                }

                if (e.error === 'aborted') return;

                if (micStatus) {
                    if (e.error === 'not-allowed') {
                        micStatus.textContent = 'エラー: マイクの使用が許可されていません。ブラウザのアドレスバーの鍵アイコンからマイクを許可してください🐾';
                        micStatus.style.color = 'var(--error-color)';
                        shouldBeListening = false;
                    } else if (e.error === 'no-speech' || e.error === 'network') {
                        // 無音タイムアウトや一時的な通信瞬断は仕様なので、警告せずサイレント復旧を促す🐾
                        micStatus.textContent = 'マイク接続維持中（自動復旧）... 🎙️';
                        micStatus.style.color = 'var(--success-color)';
                    } else {
                        micStatus.textContent = `接続調整中 (${e.error})。自動再起動します...🐾`;
                        micStatus.style.color = 'var(--accent-color)';
                    }
                }
            };

            recognition.onresult = async (event) => {
                consecutiveErrorCount = 0; // 正常に聞き取れたら連続エラーをリセット🐾
                lastErrorType = ''; // エラー状態をクリア🐾
                if (isSpeechSynthesisActive) {
                    console.log('Speech recognition ignored: SpeechSynthesis is currently active (soft-mute)🐾');
                    return;
                }
                const rawText = event.results[event.results.length - 1][0].transcript.trim();
                if (!rawText) return;

                const resultText = applySpeechCorrection(rawText);

                if (micStatus) {
                    micStatus.textContent = `認識結果: 「${resultText}」を英訳中...`;
                    micStatus.style.color = 'var(--accent-color)';
                }

                const translatedText = await translateTextToEn(resultText);
                sendBroadcasterTranslation(resultText, translatedText);

                if (micStatus) {
                    micStatus.textContent = `字幕送信完了: 「${translatedText}」🐾`;
                    micStatus.style.color = 'var(--success-color)';
                }

                setTimeout(() => {
                    if (isListening && micStatus) {
                        micStatus.textContent = 'マイク入力中... 日本語で喋ると自動英訳されます 🎙️';
                        micStatus.style.color = 'var(--success-color)';
                    }
                }, 3000);
            };
        }

        // 安全な音声認識の再接続・再生成ロジック🐾
        function reconnectSpeechRecognition() {
            if (!shouldBeListening || isSpeechSynthesisActive) return;

            isStarting = true;
            lastStartAttemptTime = Date.now();

            // エラーが3回以上連続して起きている場合は、インスタンスを完全に作り直して固まりを打破する🐾
            const needRebuild = (consecutiveErrorCount >= 3);
            if (needRebuild) {
                console.log('Speech recognition has multiple errors. Rebuilding instance...');
                consecutiveErrorCount = 0;
                initSpeechRecognition();
            }

            try {
                recognition.start();
            } catch (e) {
                console.warn('Failed to start recognition in reconnect (retrying with timeout):', e);
                if (e.message && e.message.includes('already started')) {
                    isListening = true;
                    isStarting = false;
                } else {
                    setTimeout(() => {
                        if (shouldBeListening && !isListening && !isSpeechSynthesisActive) {
                            try { recognition.start(); } catch(err) { console.warn(err); }
                        }
                    }, 500);
                }
            }
        }

        function startSpeechRecognition() {
            if (window.micRestartTimeoutId) {
                clearTimeout(window.micRestartTimeoutId);
                window.micRestartTimeoutId = null;
            }
            shouldBeListening = true;
            consecutiveErrorCount = 0;

            if (!recognition) {
                initSpeechRecognition();
            }

            isStarting = true;
            lastStartAttemptTime = Date.now();

            try {
                recognition.start();
            } catch (e) {
                console.warn('Failed to start recognition (standard start):', e);
                if (e.message && e.message.includes('already started')) {
                    isListening = true;
                    isStarting = false;
                } else {
                    initSpeechRecognition();
                    try { recognition.start(); } catch(err) { console.error('Speech restart critical fail:', err); }
                }
            }
        }

        function stopSpeechRecognition() {
            if (window.micRestartTimeoutId) {
                clearTimeout(window.micRestartTimeoutId);
                window.micRestartTimeoutId = null;
            }
            shouldBeListening = false;
            isStarting = false;
            consecutiveErrorCount = 0;
            try {
                if (recognition) recognition.stop();
            } catch (e) {
                console.error('Failed to stop recognition:', e);
            }
        }

        // セッターなどの外部から安全に再接続ロジックを叩けるようにグローバル露出🐾
        window.reconnectSpeechRecognition = reconnectSpeechRecognition;

        // 初回のみ初期化実行🐾
        initSpeechRecognition();

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

        btnMicToggle.addEventListener('click', () => {
            if (shouldBeListening) {
                stopSpeechRecognition();
            } else {
                startSpeechRecognition();
            }
        });

        // マイク稼働状態の自己修復・監視用ハートビートタイマー🐾
        setInterval(() => {
            if (!shouldBeListening || isSpeechSynthesisActive) return;
            const now = Date.now();

            if (!isListening) {
                // 起動開始してから3秒経っても onstart が発火しない場合は膠着とみなして強制リビルド復帰🐾
                if (isStarting && (now - lastStartAttemptTime) > 3000) {
                    console.log('Heartbeat: Speech recognition start timed out. Rebuilding and recovering...🐾');
                    initSpeechRecognition();
                    reconnectSpeechRecognition();
                } else if (!isStarting) {
                    console.log('Heartbeat: Speech recognition should be running but is stopped. Recovering...🐾');
                    reconnectSpeechRecognition();
                }
            }
        }, 4000); // 4秒ごとに生存チェック🐾
    } else if (btnMicToggle) {
        if (micStatus) {
            micStatus.textContent = 'お使いのブラウザは音声認識をサポートしていません。ChromeまたはEdgeをご使用ください🐾';
        }
        btnMicToggle.disabled = true;
    }

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
            
            broadcasterTextInput.placeholder = '送信完了いたしました！🐾';
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
                                
                                // 起動時刻より前の過去ログ、または初回起動時の古いデータはスルー🐾
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
    // 読み上げ辞書UI制御ロジック🐾
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
                btnDelete.textContent = '削除🐾';
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
                alert('変換前の単語と読み方の両方を入力してください🐾');
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
    // マイク誤認識修正辞書UI制御ロジック🐾
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
                btnDelete.textContent = '削除🐾';
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
                alert('誤認識される言葉と正しい言葉の両方を入力してください🐾');
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

        // --- HP用語プリセットデータのロード＆トグル制御🐾 ---
        let isPresetLoaded = false;
        const btnTogglePreset = document.getElementById('btn-toggle-preset');
        const presetTagsContainer = document.getElementById('preset-tags-container');
        const presetTagsList = document.getElementById('preset-tags-list');

        if (btnTogglePreset && presetTagsContainer && presetTagsList) {
            btnTogglePreset.addEventListener('click', async () => {
                if (presetTagsContainer.style.display === 'none') {
                    presetTagsContainer.style.display = 'block';
                    btnTogglePreset.textContent = 'HP用語プリセットを閉じる🐾';
                    
                    if (!isPresetLoaded) {
                        try {
                            presetTagsList.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem;">用語データを読み込み中...🐾</span>';
                            // サーバー経由で用語データをフェッチ（親ディレクトリの.agentから取得）🐾
                            const response = await fetch('../.agent/extracted_ff11_words.txt');
                            if (!response.ok) throw new Error('Failed to load words list');
                            const text = await response.text();
                            
                            // 用語データのパースとクリーニング🐾
                            const lines = text.split('\n');
                            const wordSet = new Set();
                            
                            lines.forEach(line => {
                                let word = line.trim();
                                if (!word || word.startsWith('===')) return;
                                
                                // マークダウン記法の除去とテキストのクレンジング🐾
                                word = word.replace(/^-\s+/, ''); // リスト先頭のダッシュを除去
                                word = word.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // リンクのテキスト部分だけ抽出
                                word = word.replace(/[\[\]「」『』()（）"']/g, ''); // ブラケット・カッコ類の除去
                                word = word.split(' (')[0]; // 補足情報のカット
                                word = word.split('(')[0];
                                word = word.trim();
                                
                                // ひらがな・カタカナ・漢字を含む日本語の固有名詞を厳選🐾
                                if (word.length >= 3 && word.length <= 15) {
                                    // ひらがな、カタカナ、漢字が少なくとも1文字含まれているか確認
                                    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(word)) {
                                        // 完全に数値や記号のみ、または意味のない記号列、URL等は除外🐾
                                        if (!/^[0-9:\-\+]+$/.test(word) && !word.startsWith('http') && word !== '???') {
                                            wordSet.add(word);
                                        }
                                    }
                                }
                            });
                            
                            // 五十音順にソート🐾
                            const sortedWords = Array.from(wordSet).sort((a, b) => a.localeCompare(b, 'ja'));
                            presetTagsList.innerHTML = '';
                            
                            if (sortedWords.length === 0) {
                                presetTagsList.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem;">登録可能な用語が見つかりませんでした🐾</span>';
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
                            presetTagsList.innerHTML = '<span style="color: #f87171; font-size: 0.8rem;">用語プリセットの読み込みに失敗しました。サーバーが起動しているかご確認ください🐾</span>';
                        }
                    }
                } else {
                    presetTagsContainer.style.display = 'none';
                    btnTogglePreset.textContent = 'HP用語プリセットを表示🐾';
                }
            });
        }
    }
});
