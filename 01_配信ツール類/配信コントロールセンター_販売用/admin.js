// YouTube Chat Translator - 管理画面ロジック

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

// マイク・音声認識用の状態管理変数（読み上げクラスとイベントリスナーの双方から参照できるようにトップレベルに配置します）
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;
let shouldBeListening = false; // 配信者様が意図的にマイクをONにしているかを表すフラグ
let isSpeechSynthesisActive = false; // 読み上げがアクティブ（再生中）かを表すフラグ
let isSpeechSynthesisActiveStartTime = 0; // isSpeechSynthesisActiveがtrueになった時刻を記録

// 音声合成（読み上げ）の状態を切り替えるセッター関数。
// OFFになった際にマイクが意図せず停止していれば自動復帰させる
function setSpeechSynthesisActive(active) {
    isSpeechSynthesisActive = active;
    if (active) {
        isSpeechSynthesisActiveStartTime = Date.now(); // ロック開始時刻を記録
        if (window.micRestartTimeoutId) {
            clearTimeout(window.micRestartTimeoutId);
            window.micRestartTimeoutId = null;
        }
    } else {
        if (shouldBeListening && !isListening) {
            console.log('Speech recognition was stopped during SpeechSynthesis. Restarting now...');
            if (typeof window.reconnectSpeechRecognition === 'function') {
                window.reconnectSpeechRecognition();
            }
        }
    }
}

let lastErrorTime = 0;
let lastErrorType = '';
let isStarting = false;
let lastStartAttemptTime = 0;
let lastStartSuccessTime = 0;
let consecutiveErrorCount = 0;
let lastPreventiveRebuildTime = 0; // 定期予防リビルドの最終実行時刻
let lastInitTime = 0; // SpeechRecognitionインスタンスを生成（init）した時刻
let lastResultTime = 0; // onresult が最後に発火した時刻（Edgeゾンビ状態検出用）
let lastActivityTime = 0; // onresult または onerror が最後に発火した時刻（Edgeゾンビ状態検出用）

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

        this.voices = [];
        const loadVoices = () => {
            this.voices = this.synth.getVoices();
        };
        loadVoices();
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = loadVoices;
        }

        // Chrome/EdgeのSpeechSynthesisバグ対策：マイク音声認識（SpeechRecognition）との競合により、
        // しばらく無言のときに発声が保留（ペンディング）されてしまう不具合を防ぐため、
        // 5秒ごとに自動で resume() を呼び出してロックを強制解除する見守りタイマーを回します
        setInterval(() => {
            if (this.synth) {
                try {
                    this.synth.resume();
                } catch(e) {}
            }
        }, 5000);
    }

    // コメントを読み上げキューに追加する
    speak(chat) {
        if (!this.enableCheckbox || !this.enableCheckbox.checked) {
            return;
        }

        // 配信者自身の翻訳メッセージは読み上げない
        if (chat.isBroadcaster) {
            return;
        }

        const textsToSpeak = this.prepareTexts(chat);
        if (textsToSpeak.length === 0) return;

        // スパチャまたはメンバーシップの場合は、効果音再生を優先するため読み上げを2.5秒遅らせます
        if (chat.isSuperChat || chat.isMembership) {
            setTimeout(() => {
                this.queue.push(...textsToSpeak);
                this.processQueue();
            }, 2500);
        } else {
            this.queue.push(...textsToSpeak);
            this.processQueue();
        }
    }

    // VOICEVOX integration removed for release version

    // キューを順次消化
    async processQueue() {
        if (this.speaking || this.queue.length === 0) {
            return;
        }

        this.speaking = true;

        // 【プランA】 読み上げを開始するので、マイクがオンの場合は一時的にマイクを停止します
        isSpeechSynthesisActive = true;
        isSpeechSynthesisActiveStartTime = Date.now(); // ロック開始時刻を記録
        if (isListening && recognition) {
            try {
                recognition.stop();
            } catch(e) {}
        }

        const item = this.queue.shift();

        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.lang = item.lang;

        // 最適なアニメ風/女性音声を自動選択
        const bestVoice = this.getBestVoice(item.lang);
        if (bestVoice) {
            utterance.voice = bestVoice;
        }

        // 音量は効果音ボリューム設定と同期
        if (this.volumeSlider) {
            utterance.volume = parseInt(this.volumeSlider.value) / 100;
        } else {
            utterance.volume = 1.0;
        }

        // 声の高さ（ピッチ）と速度（スピード）を同期
        if (this.pitchSlider) {
            utterance.pitch = parseFloat(this.pitchSlider.value);
        } else {
            utterance.pitch = 1.5;
        }

        if (this.rateSlider) {
            utterance.rate = parseFloat(this.rateSlider.value);
        } else {
            utterance.rate = 1.1;
        }

        // 読み上げ終了後のマイク再開ヘルパー
        const resumeRecognition = () => {
            isSpeechSynthesisActive = false;
            if (shouldBeListening && !isListening && recognition) {
                try {
                    recognition.start();
                } catch(e) {}
            }
        };

        // 読み上げフリーズ防止用ウォッチドッグタイマー (最大12秒で強制ロック解除) 
        const watchdogId = setTimeout(() => {
            console.warn('SpeechSynthesis output timed out. Forcing next queue...');
            resumeRecognition(); // マイク再開
            this.speaking = false;
            this.processQueue();
        }, 12000);

        utterance.onend = () => {
            clearTimeout(watchdogId);
            resumeRecognition(); // マイク再開
            this.speaking = false;
            setTimeout(() => this.processQueue(), 250);
        };

        utterance.onerror = (e) => {
            clearTimeout(watchdogId);
            console.error('SpeechSynthesis error:', e);
            resumeRecognition(); // マイク再開
            this.speaking = false;
            setTimeout(() => this.processQueue(), 250);
        };

        // ChromeのSpeechSynthesisフリーズ防止ハック（再生前にリセット ＆ 再開を噛ませる）
        try {
            this.synth.cancel();
            this.synth.resume();
        } catch(err) {}

        this.synth.speak(utterance);
    }

    // 読み上げの強制停止 ＆ キュークリア
    clear() {
        this.queue = [];
        this.synth.cancel();
        this.speaking = false;
    }

    // 最適な女性音声を取得するメソッド
    getBestVoice(lang) {
        if (!this.voices || this.voices.length === 0) {
            this.voices = this.synth.getVoices();
        }

        // 言語コードでフィルタ
        const langVoices = this.voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith(lang.toLowerCase()));
        if (langVoices.length === 0) return null;

        if (lang.toLowerCase().startsWith('ja')) {
            // 日本語の優先順位：
            // 1. Nanami (Edge/Windows 10/11 最新のAI自然音声。人間の肉声そのもの！)
            // 2. Google 日本語 (Chromeの高品質な女性クラウド音声)
            // 3. Ayumi (標準の女性高音ボイス)
            // 4. Haruka (標準の女性ボイス)
            const nanami = langVoices.find(v => v.name.includes('Nanami') || v.name.includes('Natural') || v.name.includes('Online'));
            if (nanami) return nanami;
            
            const google = langVoices.find(v => v.name.includes('Google') || v.name.includes('日本語'));
            if (google) return google;
            
            const ayumi = langVoices.find(v => v.name.includes('Ayumi'));
            if (ayumi) return ayumi;
            
            const haruka = langVoices.find(v => v.name.includes('Haruka'));
            if (haruka) return haruka;
            
            const femaleFallback = langVoices.find(v => !v.name.includes('Ichiro') && !v.name.includes('Keita'));
            if (femaleFallback) return femaleFallback;
        } else if (lang.toLowerCase().startsWith('en')) {
            // 英語女性優先：Google US English -> Zira -> その他女性
            const googleEn = langVoices.find(v => v.name.includes('Google') || v.name.includes('US English'));
            if (googleEn) return googleEn;
            
            const zira = langVoices.find(v => v.name.includes('Zira') || v.name.includes('Hazel'));
            if (zira) return zira;
        } else if (lang.toLowerCase().startsWith('ko')) {
            // 韓国語女性優先：Heami -> その他
            const heami = langVoices.find(v => v.name.includes('Heami') || v.name.includes('Google'));
            if (heami) return heami;
        }

        return langVoices[0]; // 見つからなければ最初の音声
    }

    // 喋り方を人間らしく滑らかにするポーズ（間）自動チューニングフィルター
    makeNaturalText(text) {
        if (!text) return '';
        
        let cleaned = text;
        
        // ななみちゃんの漢字誤読防止レスキュー（「楽しみ」➔「たのしみ」などのひらがな置換）
        cleaned = cleaned.replace(/楽しみ/g, 'たのしみ');
        cleaned = cleaned.replace(/楽しんで/g, 'たのしんで');
        cleaned = cleaned.replace(/楽しむ/g, 'たのしむ');
        cleaned = cleaned.replace(/楽しかった/g, 'たのしかった');
        
        // 挨拶の「は」と「わ」の誤読防止（「〜」や長音符がついても正しく「わ」と発音するようにします）
        cleaned = cleaned.replace(/こんにちは/g, 'こんにちわ');
        cleaned = cleaned.replace(/こんばんは/g, 'こんばんわ');
        
        // 長音符「ー」および波ダッシュ「〜」「～」の音声エンジン誤読対策
        // ななみちゃんは長音符「ー」や波ダッシュ「〜」を無視して短く読んでしまう（「おーい」➔「おい」等）ため、
        // 「ーー」のように重ねることで綺麗に長音として伸ばして発音させます
        cleaned = cleaned.replace(/ー+/g, 'ーー');
        cleaned = cleaned.replace(/[〜～]+/g, 'ーー');
        
        // 連続する感嘆符などを自然な感嘆と短い息継ぎスペースに変換
        cleaned = cleaned.replace(/[!?！？]+/g, '！ ');
        // 文中のスペースを読点（、）に変換して、機械的な早口を防ぎ「自然な間」を設ける
        cleaned = cleaned.replace(/\s+/g, '、');
        
        return cleaned;
    }

    // 簡易日本語判定（日本語が1文字でも含まれていれば日本語として扱う）
    isJapanese(text) {
        const jpRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
        return jpRegex.test(text);
    }

    // 読み上げテキストと音声言語のペアを構築する
    prepareTexts(chat) {
        const mode = this.modeSelect ? this.modeSelect.value : 'native_only';
        const authorName = chat.author.name;

        // お上品フィルターの適用
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

        // 人間らしい喋り方（息継ぎの間）を自動補正
        const originalText = this.makeNaturalText(originalCleaned);
        const translationText = this.makeNaturalText(translationCleaned);

        // スパチャやメンバーシップお祝い枕詞
        let prefix = '';
        if (chat.isSuperChat) {
            prefix = 'プレミアムスーパーチャット！';
        } else if (chat.isMembership) {
            prefix = '新規メンバー加入！';
        }

        const isJp = this.isJapanese(originalText) || !chat.needTranslation;
        const result = [];

        if (isJp) {
            // 日本語コメントは常に100%日本語（ja-JP）でそのまま読み上げ
            let readText = '';
            if (prefix) {
                readText += `${prefix}、${authorName}さんより、`;
            } else {
                readText += `${authorName}さん、`;
            }
            readText += originalText;
            result.push({ text: readText, lang: 'ja-JP' });
        } else {
            // 外国語コメント：モード別分岐
            const foreignLang = this.detectForeignLang(originalText);

            if (mode === 'native_only') {
                // 原文のみ
                if (prefix) {
                    result.push({ text: `${prefix}、${authorName}さんより`, lang: 'ja-JP' });
                }
                result.push({ text: originalText, lang: foreignLang });
            } else if (mode === 'interpreter') {
                // 同時通訳（原文 -> 日本語訳）
                if (prefix) {
                    result.push({ text: `${prefix}、${authorName}さんより`, lang: 'ja-JP' });
                }
                result.push({ text: originalText, lang: foreignLang });

                let readTextTrans = `日本語訳、${translationText}`;
                result.push({ text: readTextTrans, lang: 'ja-JP' });
            } else if (mode === 'translation_only') {
                // 翻訳日本語のみ
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

    // 外国語の簡易判定（デフォルト en-US、韓国語 ko-KR を優先検知）
    detectForeignLang(text) {
        const koRegex = /[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF\uD7B0-\uD7FF]/;
        if (koRegex.test(text)) {
            return 'ko-KR';
        }
        return 'en-US';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 読み上げマネージャーのインスタンス化
    const readAloudManager = new ReadAloudManager();

    // DOM要素の取得
    const connectionModeSelect = document.getElementById('connection-mode');
    const translationEngineSelect = document.getElementById('translation-engine');
    const apiKeyInput = document.getElementById('api-key');
    const channelIdInput = document.getElementById('channel-id');
    const btnDetectLive = document.getElementById('btn-detect-live');
    const liveUrlInput = document.getElementById('live-url');
    const btnConnect = document.getElementById('btn-connect');
    const btnSave = document.getElementById('btn-save');
    const connectionStatus = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    
    const obsLinkCard = document.getElementById('obs-link-card');
    const obsUrlInput = document.getElementById('obs-url');
    const btnCopyUrl = document.getElementById('btn-copy-url');
    
    // フィルターチェックボックス
    const filterForeignCheckbox = document.getElementById('filter-foreign');
    const enableJpTranslationCheckbox = document.getElementById('enable-jp-translation');
    const enableNsfwFilterCheckbox = document.getElementById('enable-nsfw-filter');
    const nsfwWordsInput = document.getElementById('nsfw-words');

    // 接続モードおよび翻訳エンジンに応じたUI制御
    function updateUIForConfig() {
        const isTest = connectionModeSelect ? connectionModeSelect.value === 'test' : true;
        const engine = translationEngineSelect ? translationEngineSelect.value : 'local';

        if (isTest) {
            if (channelIdInput) {
                channelIdInput.placeholder = '（テスト・練習モードのため入力不要）';
                channelIdInput.style.opacity = '0.5';
            }
            liveUrlInput.placeholder = '（テスト・練習モードのため入力不要）';
            liveUrlInput.style.opacity = '0.5';
            if (btnDetectLive) btnDetectLive.disabled = true;
        } else {
            if (channelIdInput) {
                channelIdInput.placeholder = 'UC... （ご自身のチャンネルIDを入力してください）';
                channelIdInput.style.opacity = '1.0';
            }
            liveUrlInput.placeholder = 'https://www.youtube.com/watch?v=... または 動画ID';
            liveUrlInput.style.opacity = '1.0';
            if (btnDetectLive) btnDetectLive.disabled = false;
        }

        // 翻訳エンジンに応じたAPIキー入力欄の制御
        if (engine === 'local') {
            apiKeyInput.placeholder = '（ローカルAI翻訳を使用するため入力不要）';
            apiKeyInput.style.opacity = '0.5';
        } else {
            if (isTest) {
                apiKeyInput.placeholder = '（テスト・練習モードのため入力不要）';
                apiKeyInput.style.opacity = '0.5';
            } else {
                apiKeyInput.placeholder = 'dapi-xxxxxxxx （DeepLのAPIキーを入力してください）';
                apiKeyInput.style.opacity = '1.0';
            }
        }
    }

    if (connectionModeSelect) {
        connectionModeSelect.addEventListener('change', updateUIForConfig);
    }
    if (translationEngineSelect) {
        translationEngineSelect.addEventListener('change', updateUIForConfig);
    }

    // 音声読み上げチェックボックス ＆ モードセレクト ＆ スライダー
    const enableReadAloudCheckbox = document.getElementById('enable-read-aloud');
    const readAloudModeSelect = document.getElementById('read-aloud-mode');
    const readAloudCharacterSelect = document.getElementById('read-aloud-character');
    const readAloudPitchSlider = document.getElementById('read-aloud-pitch');
    const readAloudPitchVal = document.getElementById('read-aloud-pitch-val');
    const readAloudRateSlider = document.getElementById('read-aloud-rate');
    const readAloudRateVal = document.getElementById('read-aloud-rate-val');

    // 効果音 ＆ ボリュームコントロール
    const effectVolumeSlider = document.getElementById('effect-volume');
    const effectVolumeVal = document.getElementById('effect-volume-val');
    const btnTestSound = document.getElementById('btn-test-sound');

    // カスタム効果音関連の要素
    const scSoundFileInput = document.getElementById('sc-sound-file');
    const btnSelectScSound = document.getElementById('btn-select-sc-sound');
    const scSoundNameSpan = document.getElementById('sc-sound-name');
    const btnClearScSound = document.getElementById('btn-clear-sc-sound');

    const membershipSoundFileInput = document.getElementById('membership-sound-file');
    const btnSelectMembershipSound = document.getElementById('btn-select-membership-sound');
    const membershipSoundNameSpan = document.getElementById('membership-sound-name');
    const btnClearMembershipSound = document.getElementById('btn-clear-membership-sound');

    // マイク・音声認識・テキスト送信フォーム
    const btnMicToggle = document.getElementById('btn-mic-toggle');
    const micDot = document.getElementById('mic-dot');
    const micBtnText = document.getElementById('mic-btn-text');
    const micStatus = document.getElementById('mic-status');
    const broadcasterTextInput = document.getElementById('broadcaster-text-input');
    const btnSendBroadcasterText = document.getElementById('btn-send-broadcaster-text');
    
    // スライダー
    const fontSizeSlider = document.getElementById('font-size');
    const fontSizeVal = document.getElementById('font-size-val');
    const transSizeSlider = document.getElementById('trans-size');
    const transSizeVal = document.getElementById('trans-size-val');
    const displayTimeSlider = document.getElementById('display-time');
    const displayTimeVal = document.getElementById('display-time-val');
    const maxCommentsSlider = document.getElementById('max-comments');
    const maxCommentsVal = document.getElementById('max-comments-val');
    
    // テスト送信ボタン
    const btnTestEn = document.getElementById('btn-test-en');
    const btnTestKr = document.getElementById('btn-test-kr');
    const btnTestJp = document.getElementById('btn-test-jp');
    const btnClearTest = document.getElementById('btn-clear-test');
    const testInfoText = document.getElementById('test-info-text');

    // スライダーの数値連動
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

    // 表示時間スライダー用のフォーマッタ（61秒の時は無制限と表示）
    const displayTimeFormatter = (val) => {
        return parseInt(val) === 61 ? '無制限 ' : `${val}秒`;
    };
    setupSlider(displayTimeSlider, displayTimeVal, '秒', displayTimeFormatter);

    setupSlider(maxCommentsSlider, maxCommentsVal, '個');

    // 読み上げ調整スライダー用フォーマッタ
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

    // カスタム効果音メモリ保持用変数
    let currentScSoundData = null;
    let currentScSoundName = '';
    let currentMembershipSoundData = null;
    let currentMembershipSoundName = '';

    // localStorageからの設定復元
    function loadSettings() {
        const savedSettings = localStorage.getItem('yt_translator_settings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                if (connectionModeSelect) {
                    connectionModeSelect.value = settings.connectionMode || 'test';
                }
                if (translationEngineSelect) {
                    translationEngineSelect.value = settings.translationEngine || 'local';
                }
                // ロード後に初期状態のプレースホルダー等をUIに反映
                updateUIForConfig();
                
                apiKeyInput.value = settings.apiKey || '';
                if (channelIdInput) {
                    channelIdInput.value = settings.channelId || '';
                }
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

                // カスタム効果音設定の復元
                currentScSoundData = settings.scSoundData || null;
                currentScSoundName = settings.scSoundName || '';
                if (currentScSoundData) {
                    if (scSoundNameSpan) scSoundNameSpan.textContent = currentScSoundName || 'カスタム音源';
                    if (btnClearScSound) btnClearScSound.style.display = 'inline-block';
                } else {
                    if (scSoundNameSpan) scSoundNameSpan.textContent = 'デフォルト音源';
                    if (btnClearScSound) btnClearScSound.style.display = 'none';
                }

                currentMembershipSoundData = settings.membershipSoundData || null;
                currentMembershipSoundName = settings.membershipSoundName || '';
                if (currentMembershipSoundData) {
                    if (membershipSoundNameSpan) membershipSoundNameSpan.textContent = currentMembershipSoundName || 'カスタム音源';
                    if (btnClearMembershipSound) btnClearMembershipSound.style.display = 'inline-block';
                } else {
                    if (membershipSoundNameSpan) membershipSoundNameSpan.textContent = 'デフォルト音源';
                    if (btnClearMembershipSound) btnClearMembershipSound.style.display = 'none';
                }
                
                showStatus('disconnected', '設定をロードしました');
            } catch (e) {
                console.error('Failed to parse settings:', e);
            }
        }
    }
    loadSettings();

    // 設定の取得
    function getSettingsObject() {
        return {
            connectionMode: connectionModeSelect ? connectionModeSelect.value : 'test',
            translationEngine: translationEngineSelect ? translationEngineSelect.value : 'local',
            apiKey: apiKeyInput.value.trim(),
            channelId: channelIdInput ? channelIdInput.value.trim() : '',
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
            readAloudRate: readAloudRateSlider ? parseFloat(readAloudRateSlider.value) : 1.1,
            scSoundData: currentScSoundData,
            scSoundName: currentScSoundName,
            membershipSoundData: currentMembershipSoundData,
            membershipSoundName: currentMembershipSoundName
        };
    }

    // ステータス表示の変更
    function showStatus(type, text) {
        connectionStatus.className = `status-indicator status-${type}`;
        statusText.textContent = text;
    }

    // YouTubeのURLからVideo ID（ライブID）を抽出
    function extractVideoId(urlOrId) {
        if (!urlOrId) return '';
        const trimmed = urlOrId.trim();
        if (trimmed.length === 11) return trimmed; // すでにIDの場合
        
        // URLパターンからの抽出（live/形式の配信URLにも対応）
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|live\/)([^#\&\?]*).*/;
        const match = trimmed.match(regExp);
        return (match && match[2].length === 11) ? match[2] : '';
    }

    //  効果音テスト再生ボタンの制御 (ランダム2パターン再生 ＆ 音量同期)
    // 音源設定即時保存ヘルパー
    function saveSoundSettingsLocally() {
        const settings = getSettingsObject();
        localStorage.setItem('yt_translator_settings', JSON.stringify(settings));
        localStorage.setItem('yt_translator_live_settings', JSON.stringify(settings));
    }

    // スパチャ用効果音選択
    if (btnSelectScSound && scSoundFileInput) {
        btnSelectScSound.addEventListener('click', () => scSoundFileInput.click());
        scSoundFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                currentScSoundData = event.target.result;
                currentScSoundName = file.name;
                if (scSoundNameSpan) scSoundNameSpan.textContent = file.name;
                if (btnClearScSound) btnClearScSound.style.display = 'inline-block';
                saveSoundSettingsLocally();
            };
            reader.readAsDataURL(file);
        });
    }

    // スパチャ音初期化
    if (btnClearScSound) {
        btnClearScSound.addEventListener('click', () => {
            currentScSoundData = null;
            currentScSoundName = '';
            if (scSoundNameSpan) scSoundNameSpan.textContent = 'デフォルト音源';
            if (btnClearScSound) btnClearScSound.style.display = 'none';
            if (scSoundFileInput) scSoundFileInput.value = '';
            saveSoundSettingsLocally();
        });
    }

    // メンバーシップ用効果音選択
    if (btnSelectMembershipSound && membershipSoundFileInput) {
        btnSelectMembershipSound.addEventListener('click', () => membershipSoundFileInput.click());
        membershipSoundFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                currentMembershipSoundData = event.target.result;
                currentMembershipSoundName = file.name;
                if (membershipSoundNameSpan) membershipSoundNameSpan.textContent = file.name;
                if (btnClearMembershipSound) btnClearMembershipSound.style.display = 'inline-block';
                saveSoundSettingsLocally();
            };
            reader.readAsDataURL(file);
        });
    }

    // メンバーシップ音初期化
    if (btnClearMembershipSound) {
        btnClearMembershipSound.addEventListener('click', () => {
            currentMembershipSoundData = null;
            currentMembershipSoundName = '';
            if (membershipSoundNameSpan) membershipSoundNameSpan.textContent = 'デフォルト音源';
            if (btnClearMembershipSound) btnClearMembershipSound.style.display = 'none';
            if (membershipSoundFileInput) membershipSoundFileInput.value = '';
            saveSoundSettingsLocally();
        });
    }

    if (btnTestSound) {
        btnTestSound.addEventListener('click', () => {
            try {
                let audio;
                let soundNum = Math.random() < 0.5 ? 1 : 2;

                // カスタム効果音が登録されていればそちらをテスト再生、無ければデフォルト音源
                if (currentScSoundData || currentMembershipSoundData) {
                    const pool = [];
                    if (currentScSoundData) pool.push(currentScSoundData);
                    if (currentMembershipSoundData) pool.push(currentMembershipSoundData);
                    const selectedData = pool[Math.floor(Math.random() * pool.length)];
                    audio = new Audio(selectedData);
                } else {
                    const soundFile = `sounds/levelup_${soundNum}.wav?v=${Date.now()}`;
                    audio = new Audio(soundFile);
                }

                audio.volume = 1.0;
                
                audio.play().then(() => {
                    console.log('Audio test playback started successfully!');
                }).catch(err => {
                    console.log('Audio test blocked by browser:', err);
                    alert('音声テスト再生エラー:\nエラー名: ' + err.name + '\nメッセージ: ' + err.message);
                });
                
                // OBSオーバーレイ側でもテスト再生させるために同期トリガーをセット（カスタム音源情報も同期）
                localStorage.setItem('yt_translator_test_sound_trigger', JSON.stringify({
                    time: Date.now().toString(),
                    num: soundNum,
                    scSoundData: currentScSoundData,
                    membershipSoundData: currentMembershipSoundData
                }));
            } catch (err) {
                console.error('Audio test failed:', err);
            }
        });
    }

    // 設定保存ボタン
    btnSave.addEventListener('click', () => {
        const settings = getSettingsObject();
        localStorage.setItem('yt_translator_settings', JSON.stringify(settings));
        
        // テスト用設定同期
        localStorage.setItem('yt_translator_live_settings', JSON.stringify(settings));
        
        showStatus('connected', '設定を保存しました');
        setTimeout(() => showStatus('disconnected', '接続準備完了'), 2000);
    });

    // 配信枠の自動取得ロジック（CORS無効化 Edge経由の直接フェッチ）
    if (btnDetectLive) {
        btnDetectLive.addEventListener('click', async () => {
            const channelId = channelIdInput.value.trim();
            if (!channelId) {
                alert('YouTubeチャンネルIDを入力してください！');
                channelIdInput.focus();
                return;
            }
            
            showStatus('connecting', '配信枠を自動確認中...');
            
            try {
                // CORS無効化されたEdgeで実行されるため、直接フェッチが可能です
                const response = await fetch(`https://www.youtube.com/channel/${channelId}/live`);
                if (!response.ok) {
                    throw new Error('自動取得に失敗しました。');
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
                    
                    // 設定を一時保存
                    const settings = getSettingsObject();
                    localStorage.setItem('yt_translator_settings', JSON.stringify(settings));
                    
                    showStatus('connected', '配信枠を検出しました！');
                    setTimeout(() => {
                        if (chatObserver) {
                            showStatus('connected', 'チャット監視中');
                        } else {
                            showStatus('disconnected', '接続準備完了');
                        }
                    }, 2000);
                } else {
                    throw new Error('現在、アクティブなライブ配信枠（または直近の配信予定枠）が見つかりませんでした。YouTube側で配信予約または配信開始を行ってください。');
                }
            } catch (err) {
                console.error('Failed to detect live:', err);
                alert('配信枠取得エラー:\n' + err.message);
                showStatus('disconnected', '自動検出失敗');
            }
        });
    }

    // ==========================================================================
    // コメビュ版 (CORS無効 Edge iframe 接続ロジック)
    // ==========================================================================
    const iframe = document.getElementById('youtube-chat-iframe');
    let chatObserver = null;

    btnConnect.addEventListener('click', () => {
        const liveUrl = liveUrlInput.value.trim();
        const videoId = extractVideoId(liveUrl);
        
        if (!videoId) {
            alert('有効なYouTube配信URLまたは動画IDを入力してください！');
            liveUrlInput.focus();
            return;
        }

        // iframeのソースを設定して読み込みを開始 (ローカルリバースプロキシ経由で同一オリジン化)
        showStatus('connecting', 'YouTubeに接続中...');
        if (iframe) {
            iframe.src = `/youtube-proxy/live_chat?v=${videoId}`;
        }

        // OBS用リンクの生成 (overlay.htmlの場所を取得)
        const urlObj = new URL(window.location.href);
        const lastSlashIndex = urlObj.pathname.lastIndexOf('/');
        urlObj.pathname = urlObj.pathname.substring(0, lastSlashIndex + 1) + 'overlay.html';
        urlObj.search = '';
        urlObj.hash = '';
        const overlayPath = urlObj.toString();

        const settings = getSettingsObject();
        localStorage.setItem('yt_translator_settings', JSON.stringify(settings));

        const finalTime = settings.displayTime === 61 ? 0 : settings.displayTime;
        const obsUrl = `${overlayPath}?v=${encodeURIComponent(videoId)}&size=${settings.fontSize}&tsize=${settings.transSize}&time=${finalTime}&max=${settings.maxComments}&filter=${settings.filterForeign ? 1 : 0}&cb=${Date.now()}`;
        
        obsUrlInput.value = obsUrl;
        obsLinkCard.style.display = 'block';
        obsLinkCard.scrollIntoView({ behavior: 'smooth' });

        showStatus('connected', 'OBS連携リンクを生成しました！');
    });

    if (iframe) {
        iframe.addEventListener('load', () => {
            console.log('Iframe loaded! Starting chat observation...');
            showStatus('connecting', 'チャット読込完了、監視中');
            startIframeObservation();
        });
    }

    function startIframeObservation() {
        try {
            if (!iframe) return;
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc) {
                console.error('Cannot access iframe document');
                showStatus('disconnected', 'チャットフレームに接続できません');
                return;
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
            showStatus('disconnected', '接続エラー');
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

            let translationText = '';
            let needTranslation = false;
            
            const enableJpTranslation = document.getElementById('enable-jp-translation');
            const shouldTranslateJp = enableJpTranslation ? enableJpTranslation.checked : false;

            if (!readAloudManager.isJapanese(messageText)) {
                translationText = await translateText(messageText);
                needTranslation = (messageText.toLowerCase() !== translationText.toLowerCase());
            } else if (shouldTranslateJp) {
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
                timestamp: Date.now(),
                fontSize: getSettingsObject().fontSize,
                transSize: getSettingsObject().transSize
            };

            localStorage.setItem('yt_translator_real_chat', JSON.stringify(chatObj));

            const apiTarget = window.location.protocol === 'file:' 
                ? `http://localhost:${window.location.port || '8085'}/api/chat`
                : '/api/chat';
            fetch(apiTarget, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatObj)
            }).catch(err => console.error('Failed to sync chat to API:', err));

            appendToChatLog(chatObj);

            if (isSuperChat || isMembership) {
                setSpeechSynthesisActive(true);

                const soundNum = Math.random() < 0.5 ? 1 : 2;
                
                localStorage.setItem('yt_translator_test_sound_trigger', JSON.stringify({
                    time: Date.now().toString(),
                    num: soundNum
                }));

                setTimeout(() => {
                    if (readAloudManager) {
                        const queued = readAloudManager.speak(chatObj);
                        if (!queued) {
                            setSpeechSynthesisActive(false);
                        }
                    } else {
                        setSpeechSynthesisActive(false);
                    }
                }, 1000);
            } else {
                if (readAloudManager) {
                    readAloudManager.speak(chatObj);
                }
            }

        } catch (e) {
            console.error('Error processing chat node:', e);
        }
    }

    // ==========================================================================
    // ハイブリッド翻訳ロジック（DeepL & Helsinki-NLP/OPUS-MT）
    // ==========================================================================
    
    let translatorJaEn = null;
    let translatorEnJa = null;
    let localModelLoadPromise = null;

    async function initLocalTranslator() {
        if (translatorJaEn && translatorEnJa) return true;
        if (localModelLoadPromise) return localModelLoadPromise;

        localModelLoadPromise = (async () => {
            console.log("Loading local translation models (Transformers.js)...");
            try {
                // Dynamic import of transformers from CDN
                const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
                
                // Web環境向けの設定（ローカルモデル検索を防止し、CDN読み込みを強制）
                env.allowLocalModels = false;

                // 各言語方向のモデルロード（初回は約150MBのロードが必要）
                translatorJaEn = await pipeline('translation', 'Xenova/opus-mt-ja-en');
                translatorEnJa = await pipeline('translation', 'Xenova/opus-mt-en-jap');
                
                console.log("Local translation models successfully loaded!");
                return true;
            } catch (error) {
                console.error("Failed to load local translation models:", error);
                localModelLoadPromise = null; // 再試行できるようにPromiseをリセット
                return false;
            }
        })();

        return localModelLoadPromise;
    }

    // 読み込み状態をUIに反映
    function showLocalLoadingStatus(show) {
        const statusTextEl = document.getElementById('status-text');
        const statusIndicator = document.getElementById('connection-status');
        if (show) {
            if (statusTextEl) statusTextEl.textContent = '翻訳AIロード中 (初回のみ数秒かかります)...';
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator status-warning';
            }
        } else {
            if (statusTextEl && statusTextEl.textContent.includes('翻訳AIロード中')) {
                statusTextEl.textContent = '接続準備完了';
                if (statusIndicator) {
                    statusIndicator.className = 'status-indicator status-disconnected';
                }
            }
        }
    }

    // ローカルAI翻訳処理
    async function translateViaLocalAI(text, targetLang) {
        showLocalLoadingStatus(true);
        const isLoaded = await initLocalTranslator();
        if (!isLoaded) {
            showLocalLoadingStatus(false);
            console.error("Local translator not available. Returning original text.");
            return text;
        }

        try {
            let result = '';
            if (targetLang.toLowerCase() === 'ja') {
                const output = await translatorEnJa(text);
                if (output && output[0] && output[0].translation_text) {
                    result = output[0].translation_text;
                }
            } else {
                const output = await translatorJaEn(text);
                if (output && output[0] && output[0].translation_text) {
                    result = output[0].translation_text;
                }
            }
            showLocalLoadingStatus(false);
            return result ? result.trim() : text;
        } catch (err) {
            console.error("Local AI translation execution error:", err);
            showLocalLoadingStatus(false);
            return text;
        }
    }

    // DeepL API 翻訳処理
    async function translateViaDeepL(text, targetLang, apiKey) {
        const url = 'https://api-free.deepl.com/v2/translate';
        const params = new URLSearchParams();
        params.append('text', text);
        params.append('target_lang', targetLang);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${apiKey}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`DeepL API error (${res.status}): ${errorText}`);
        }

        const data = await res.json();
        if (data && data.translations && data.translations[0]) {
            return data.translations[0].text.trim();
        }
        throw new Error('Invalid response format from DeepL API');
    }

    // 自動フォールバック
    function fallbackToLocalEngine(reason) {
        const translationEngineSelect = document.getElementById('translation-engine');
        if (translationEngineSelect && translationEngineSelect.value !== 'local') {
            translationEngineSelect.value = 'local';
            translationEngineSelect.dispatchEvent(new Event('change'));
            
            // 設定オブジェクトを取得して保存
            const savedSettings = localStorage.getItem('yt_translator_settings');
            if (savedSettings) {
                try {
                    const settings = JSON.parse(savedSettings);
                    settings.translationEngine = 'local';
                    localStorage.setItem('yt_translator_settings', JSON.stringify(settings));
                } catch (e) {}
            }
            
            const statusTextEl = document.getElementById('status-text');
            const statusIndicator = document.getElementById('connection-status');
            if (statusTextEl) statusTextEl.textContent = '警告: ローカルAIへ自動移行';
            if (statusIndicator) statusIndicator.className = 'status-indicator status-warning';
            
            alert(`【翻訳システムのお知らせ】\n${reason}`);
        }
    }

    async function translateText(text) {
        if (!text) return '';
        const settings = getSettingsObject();
        
        if (settings.translationEngine === 'deepl' && settings.apiKey) {
            try {
                return await translateViaDeepL(text, 'JA', settings.apiKey);
            } catch (err) {
                console.warn('DeepL translation failed, falling back to local AI...', err);
                fallbackToLocalEngine('DeepLの無料枠制限または通信エラーのため、一時的にローカルAI翻訳に自動フォールバックしました。');
            }
        }

        // ローカルAI翻訳（または初期状態・フォールバック時）
        return await translateViaLocalAI(text, 'ja');
    }

    // コピーボタン
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
    // サーバーレス・テストコメント送信機能（localStorage同期を利用した超安定システム）
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
            timestamp: Date.now(),
            fontSize: getSettingsObject().fontSize,
            transSize: getSettingsObject().transSize
        };

        // 自分の重複排除リストに登録して二重読み上げ・二重描画を防ぐ
        processedChatIdsAdmin.add(commentId);

        // localStorageに書き込み、オーバーレイ（overlay.html）側のstorageイベントを発火させる
        localStorage.setItem('yt_translator_test_chat', JSON.stringify(testComment));
        
        // ローカルサーバーAPIへ同期（別ブラウザプロセス間での超安定リアルタイム同期用）
        const apiTarget = window.location.protocol === 'file:' 
            ? `http://localhost:${window.location.port || '8085'}/api/chat`
            : '/api/chat';
        fetch(apiTarget, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testComment)
        }).catch(err => console.error('Failed to sync test comment to API:', err));
        
        // 自分の履歴にも追加
        appendToChatLog(testComment);

        // 音声読み上げをキック
        if (readAloudManager) {
            readAloudManager.speak(testComment);
        }

        // テスト通知テキストを表示
        testInfoText.textContent = `[${lang}] テストコメントを送信しました！`;
        testInfoText.style.display = 'block';
        
        setTimeout(() => {
            testInfoText.style.display = 'none';
        }, 3000);
    }

    //  英語テスト送信 (通常コメントとして送信)
    btnTestEn.addEventListener('click', () => {
        const englishChats = [
            { o: "Hello from New York! Your stream is so cozy! Great sniper play!", t: "ニューヨークからこんにちは！あなたの配信はとても居心地が良いですね！素晴らしいスナイパーのプレイです！", n: "Emily_NY" },
            { o: "Wow, what a nice gear setup! Can you show it again?", t: "わぁ、なんて素晴らしい装備構成なんでしょう！もう一度見せてもらえますか？", n: "John_RNG" },
            { o: "Hi from UK! I love FFXI streams! Keep it up!", t: "イギリスからこんにちは！FF11の配信が大好きです！その調子で頑張ってください！", n: "Vana_Fan_UK" }
        ];
        const chat = englishChats[Math.floor(Math.random() * englishChats.length)];
        const avatarNum = Math.floor(Math.random() * 4) + 1;
        sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 10}`, 'English', false, false, false);
    });

    //  韓国語テスト送信 (通常コメントとして送信)
    btnTestKr.addEventListener('click', () => {
        const koreanChats = [
            { o: "안녕하세요! 한국에서 보고 있습니다. 활 쏘는 솜씨가 대단하시네요!", t: "こんにちは！韓国から見ています。弓を射る腕前が素晴らしいですね！", n: "K-Ranger" },
            { o: "이 장비는 만드는데 얼마나 걸렸나요? 정말 부럽습니다!", t: "この装備を作るのにどれくらいかかりましたか？本当に羨ましいです！", n: "Vana_Korea" }
        ];
        const chat = koreanChats[Math.floor(Math.random() * koreanChats.length)];
        const avatarNum = Math.floor(Math.random() * 4) + 1;
        sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 20}`, 'Korean', false, false, false);
    });

    //  日本語テスト送信 (通常コメント)
    btnTestJp.addEventListener('click', () => {
        const japaneseChats = [
            { o: "こんにちは! いつも配信楽しみに見てます！", t: "こんにちは！いつも配信楽しみに見てます！", n: "ゆうくん_FF11" },
            { o: "今の連携ダメージめちゃくちゃすごいですねー！！", t: "今の連携ダメージめちゃくちゃすごいですねー！！", n: "マートの弟子" }
        ];
        const chat = japaneseChats[Math.floor(Math.random() * japaneseChats.length)];
        const avatarNum = Math.floor(Math.random() * 4) + 1;
        sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 30}`, 'Japanese', false, false, false);
    });

    // 💖 スーパーチャットテスト送信 (お祝い読み上げ ＆ 悲鳴同期)
    const btnTestSc = document.getElementById('btn-test-sc');
    if (btnTestSc) {
        btnTestSc.addEventListener('click', () => {
            const scChats = [
                { o: "Thank you for the amazing sniper shots! Keep up the great work!", t: "素晴らしいスナイパーショットをありがとうございます！これからも頑張ってください！", n: "SC_Supporter" },
                { o: "I love your RNG setup! Happy to support your FFXI stream!", t: "あなたの狩人の装備構成が大好きです！FF11の配信をサポートできて幸せです！", n: "Vana_Donator" },
                { o: "いつも楽しい配信をありがとうございます！応援のスパチャです！", t: "いつも楽しい配信をありがとうございます！応援のスパチャです！", n: "山田_スパチャ応援団" }
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
                { o: "I just joined the channel membership! So excited!", t: "メンバーシップに新しく加入しました！配信応援してます！", n: "FF11_MEMBER" },
                { o: "Ranger power! Happy to support your amazing stream!", t: "狩人パワー！あなたの素敵な配信をサポートできて幸せです！", n: "Tarutaru_RNG" }
            ];
            const chat = memberChats[Math.floor(Math.random() * memberChats.length)];
            const avatarNum = Math.floor(Math.random() * 4) + 1;
            sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 40}`, 'Membership', false, false, true);
        });
    }

    // ==========================================================================
    // 配信者用 日本語から英語への自動翻訳ロジック
    // ==========================================================================
    async function translateTextToEn(text) {
        if (!text) return '';
        const settings = getSettingsObject();
        
        if (settings.translationEngine === 'deepl' && settings.apiKey) {
            try {
                return await translateViaDeepL(text, 'EN', settings.apiKey);
            } catch (err) {
                console.warn('DeepL translation (En) failed, falling back to local AI...', err);
                fallbackToLocalEngine('DeepLの無料枠制限または通信エラーのため、一時的にローカルAI翻訳に自動フォールバックしました。');
            }
        }

        // ローカルAI翻訳（または初期状態・フォールバック時）
        return await translateViaLocalAI(text, 'en');
    }

    // 配信者メッセージ送信処理
    function sendBroadcasterTranslation(original, trans) {
        const broadcasterChat = {
            id: 'bc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            author: {
                name: 'Broadcaster (配信者)',
                avatar: 'broadcaster.png',
                isOwner: true
            },
            message: original,
            translation: trans,
            isBroadcaster: true,
            needTranslation: true,
            timestamp: Date.now(),
            fontSize: getSettingsObject().fontSize,
            transSize: getSettingsObject().transSize
        };
        
        // localStorageに書き込み、overlay側のstorageイベントを発火させる
        localStorage.setItem('yt_translator_broadcaster_chat', JSON.stringify(broadcasterChat));
        
        // ローカルサーバーAPIへ同期（別ブラウザプロセス間での超安定リアルタイム同期用）
        const apiTarget = window.location.protocol === 'file:' 
            ? `http://localhost:${window.location.port || '8085'}/api/chat`
            : '/api/chat';
        fetch(apiTarget, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(broadcasterChat)
        }).catch(err => console.error('Failed to sync broadcaster chat to API:', err));
        
        // 自分の履歴にも追加
        appendToChatLog(broadcasterChat);
    }

    // ==========================================================================
    // 配信者マイクリアルタイム音声認識（Web Speech API）制御 ＆ 自動再起動レスキュー
    // ==========================================================================

    if (SpeechRecognition && btnMicToggle) {
        
        function initSpeechRecognition() {
            if (recognition) {
                recognition.onstart = null;
                recognition.onend = null;
                recognition.onerror = null;
                recognition.onresult = null;
                try { recognition.abort(); } catch(e) {}
                recognition = null;
            }

            recognition = new SpeechRecognition();
            lastInitTime = Date.now();
            recognition.lang = 'ja-JP';
            recognition.continuous = true;
            recognition.interimResults = false;

            recognition.onstart = () => {
                isListening = true;
                isStarting = false;
                lastStartSuccessTime = Date.now();
                consecutiveErrorCount = 0;
                lastErrorType = '';
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
                                if (consecutiveErrorCount >= 3) {
                                    micStatus.textContent = '接続が不安定なため、一時待機して再接続を試みます... ';
                                    micStatus.style.color = 'var(--accent-color)';
                                } else {
                                    micStatus.textContent = 'マイク接続維持中（自動復旧）... ';
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
                        if (micStatus) {
                            micStatus.textContent = '読み上げ中のため、マイク入力を一時停止（ソフトミュート）しています... ';
                            micStatus.style.color = 'var(--accent-color)';
                        }
                    }
                    return;
                }

                if (micDot) micDot.classList.remove('active');
                if (micBtnText) micBtnText.textContent = 'マイク音声認識: OFF';
                if (micStatus) {
                    micStatus.textContent = '音声認識は停止しています。';
                    micStatus.style.color = 'var(--text-muted)';
                }
            };

            recognition.onerror = (e) => {
                console.warn('Speech recognition warning:', e.error);
                lastErrorTime = Date.now();
                lastErrorType = e.error;
                lastActivityTime = Date.now();

                if (e.error !== 'no-speech' && e.error !== 'aborted') {
                    consecutiveErrorCount++;
                }

                if (e.error === 'aborted') return;

                if (micStatus) {
                    if (e.error === 'not-allowed') {
                        micStatus.textContent = 'エラー: マイクの使用が許可されていません。ブラウザのアドレスバーの鍵アイコンからマイクを許可してください';
                        micStatus.style.color = 'var(--error-color)';
                        shouldBeListening = false;
                    } else if (e.error === 'no-speech' || e.error === 'network') {
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
                    consecutiveErrorCount = 0;
                    lastErrorType = '';
                    lastResultTime = Date.now();
                    lastActivityTime = Date.now();
                    if (isSpeechSynthesisActive) {
                        console.log('Speech recognition ignored: SpeechSynthesis is currently active (soft-mute)');
                        return;
                    }
                    const rawText = event.results[event.results.length - 1][0].transcript.trim();
                    if (!rawText) return;

                    const resultText = rawText;

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
                        if (isListening && micStatus) {
                            micStatus.textContent = 'マイク入力中... 日本語で喋ると自動英訳されます ';
                            micStatus.style.color = 'var(--success-color)';
                        }
                    }, 3000);
                } catch (err) {
                    console.error('Error in onresult processing:', err);
                    if (micStatus) {
                        micStatus.textContent = '翻訳処理中にエラーが発生しました。';
                        micStatus.style.color = 'var(--error-color)';
                    }
                    setTimeout(() => {
                        if (isListening && micStatus) {
                            micStatus.textContent = 'マイク入力中... 日本語で喋ると自動英訳されます ';
                            micStatus.style.color = 'var(--success-color)';
                        }
                    }, 3000);
                }
            };
        }

        function reconnectSpeechRecognition() {
            if (!shouldBeListening || isSpeechSynthesisActive) return;

            isStarting = true;
            lastStartAttemptTime = Date.now();

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
            lastResultTime = 0;
            lastActivityTime = 0;
            try {
                if (recognition) recognition.stop();
            } catch (e) {
                console.error('Failed to stop recognition:', e);
            }
        }

        window.reconnectSpeechRecognition = reconnectSpeechRecognition;

        initSpeechRecognition();

        btnMicToggle.addEventListener('click', () => {
            if (shouldBeListening) {
                stopSpeechRecognition();
            } else {
                startSpeechRecognition();
            }
        });

        // 4秒ハートビートの設置
        setInterval(() => {
            const now = Date.now();

            if (isSpeechSynthesisActive && isSpeechSynthesisActiveStartTime > 0) {
                const lockDuration = now - isSpeechSynthesisActiveStartTime;
                if (lockDuration > 60000) {
                    console.warn(`Heartbeat: isSpeechSynthesisActive has been locked for ${Math.round(lockDuration / 1000)}s. Force releasing.`);
                    isSpeechSynthesisActive = false;
                }
            }

            if (!shouldBeListening || isSpeechSynthesisActive) return;

            if (isListening && lastInitTime > 0 && (now - lastInitTime) > 20 * 60 * 1000) {
                if ((now - lastPreventiveRebuildTime) > 20 * 60 * 1000) {
                    console.log('Heartbeat: Preventive rebuild of SpeechRecognition (20min interval).');
                    lastPreventiveRebuildTime = now;
                    initSpeechRecognition();
                    reconnectSpeechRecognition();
                    return;
                }
            }

            // Edgeゾンビ状態検出 (5分)
            if (isListening && lastActivityTime > 0 && (now - lastActivityTime) > 5 * 60 * 1000) {
                console.warn(`Heartbeat: Edge zombie state detected. No activity for ${Math.round((now - lastActivityTime) / 60000)}min while isListening=true. Force rebuilding...`);
                lastActivityTime = now;
                lastResultTime = now;
                initSpeechRecognition();
                reconnectSpeechRecognition();
                return;
            }

            if (!isListening) {
                if (isStarting && (now - lastStartAttemptTime) > 3000) {
                    console.log('Heartbeat: Speech recognition start timed out. Rebuilding and recovering...');
                    initSpeechRecognition();
                    reconnectSpeechRecognition();
                } else if (!isStarting) {
                    console.log('Heartbeat: Speech recognition should be running but is stopped. Recovering...');
                    reconnectSpeechRecognition();
                }
            }
        }, 4000);
    } else if (btnMicToggle) {
        if (micStatus) {
            micStatus.textContent = 'お使いのブラウザは音声認識をサポートしていません。ChromeまたはEdgeをご使用ください';
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

    // チャット履歴ログの描画用要素と関数
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

            const prefixSpan = document.createElement('span');
            prefixSpan.style.color = 'var(--accent-color)';
            prefixSpan.style.fontSize = '0.75rem';
            prefixSpan.style.fontWeight = 'bold';
            prefixSpan.style.marginRight = '0.25rem';
            prefixSpan.textContent = '[自動翻訳]';

            const textNode = document.createTextNode(chat.translation);

            transText.appendChild(prefixSpan);
            transText.appendChild(textNode);
            contentBox.appendChild(transText);
        }

        logItem.appendChild(contentBox);

        chatLogList.insertBefore(logItem, chatLogList.firstChild);

        while (chatLogList.children.length > 150) {
            chatLogList.removeChild(chatLogList.lastChild);
        }
    }


    // ==========================================================================
    // 別ブラウザプロセス間（OBSブラウザソース ➔ 通常のChrome読み上げ）超安定ハイブリッドAPI同期 
    // ==========================================================================
    const processedChatIdsAdmin = new Set();
    let isFirstPollAdmin = true; // 初回起動時の過去ログ読み込みスルー用フラグ
    async function startApiPollingAdmin() {
        setInterval(async () => {
            try {
                const apiTarget = window.location.protocol === 'file:' 
                    ? `http://localhost:${window.location.port || '8085'}/api/chat?t=${Date.now()}`
                    : `/api/chat?t=${Date.now()}`;
                const res = await fetch(apiTarget);
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
                                    
                                    // 音声読み上げをキック
                                    if (readAloudManager) {
                                        readAloudManager.speak(chat);
                                    }
                                }
                            }
                        }
                    });
                    isFirstPollAdmin = false;
                    
                    // メモリー制限（1000件）
                    if (processedChatIdsAdmin.size > 1000) {
                        const firstKey = processedChatIdsAdmin.values().next().value;
                        processedChatIdsAdmin.delete(firstKey);
                    }
                }
            } catch (err) {
                // 静かに無視
            }
        }, 500); // 0.5秒間隔で極めて低負荷かつリアルタイムに同期します
    }
    startApiPollingAdmin();
});

// ==========================================================================
// バックグラウンドタブ復帰時の強制リカバリー (visibilitychange)
// ==========================================================================
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        console.log('Tab became visible. Running recovery check...');
        const now = Date.now();
        
        // 読み上げ中のソフトミュートは維持するが、30秒以上trueのままなら異常としてフラグを強制解除する
        if (isSpeechSynthesisActive && isSpeechSynthesisActiveStartTime > 0) {
            const lockDuration = now - isSpeechSynthesisActiveStartTime;
            if (lockDuration > 30000) {
                console.warn(`Visibility recovery: isSpeechSynthesisActive stuck for ${Math.round(lockDuration / 1000)}s. Force releasing.`);
                isSpeechSynthesisActive = false;
            }
        }

        // SpeechRecognition が動いているべきなのに停止していたら強制リビルド復帰
        if (SpeechRecognition && shouldBeListening && !isListening) {
            console.log('Visibility recovery: SpeechRecognition should be running but is stopped. Rebuilding...');
            initSpeechRecognition();
            reconnectSpeechRecognition();
        }

        // SpeechRecognition が「動いている」状態でも、内部状態が壊れている可能性がある。
        // 最後にインスタンスを作成してから10分以上経っていたら予防的にリビルドする
        if (SpeechRecognition && shouldBeListening && isListening && lastInitTime > 0) {
            const sinceLastInit = Date.now() - lastInitTime;
            if (sinceLastInit > 10 * 60 * 1000) {
                console.log(`Visibility recovery: Last initialization was ${Math.round(sinceLastInit / 60000)}min ago. Preventive rebuild.`);
                initSpeechRecognition();
                reconnectSpeechRecognition();
            }
        }
    }
});
