// YouTube Chat Translator - 管理画面ロジック

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

        this.queue.push(...textsToSpeak);
        this.processQueue();
    }

    // VOICEVOXの音声合成APIを呼び出すメソッド
    async speakVoiceVox(text, speakerId) {
        try {
            // 1. 音声合成用クエリの作成
            const queryUrl = `http://localhost:50021/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`;
            const queryRes = await fetch(queryUrl, { method: 'POST' });
            if (!queryRes.ok) throw new Error('VOICEVOX query failed');
            const queryData = await queryRes.json();

            // ピッチとスピードをスライダー設定に同期
            if (this.rateSlider) {
                queryData.speedScale = parseFloat(this.rateSlider.value);
            }
            if (this.pitchSlider) {
                // VOICEVOXの標準音高（1.0）に対し、ピッチ調整を同期（1.5など）
                queryData.pitchScale = parseFloat(this.pitchSlider.value) - 0.5; // VOICEVOX用にマッピング微調整
            }

            // 2. 音声合成の実行
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
            
            // 音量設定
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
            return false; // 失敗時は標準SpeechSynthesisに自動フォールバック🐾
        }
    }

    // キューを順次消化
    async processQueue() {
        if (this.speaking || this.queue.length === 0) {
            return;
        }

        this.speaking = true;
        const item = this.queue.shift();

        const charVal = this.characterSelect ? this.characterSelect.value : 'standard';

        // 日本語コメントでVOICEVOXキャラクターが選ばれている場合、VOICEVOXでの発声を試みる
        if (item.lang === 'ja-JP' && charVal.startsWith('vv_')) {
            const speakerId = parseInt(charVal.replace('vv_', ''));
            const success = await this.speakVoiceVox(item.text, speakerId);
            if (success) {
                this.speaking = false;
                setTimeout(() => this.processQueue(), 250);
                return;
            }
            console.log('VOICEVOX is unavailable, falling back to browser SpeechSynthesis...');
        }

        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.lang = item.lang;

        // 最適なアニメ風/女性音声を自動選択🐾
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

        // 読み上げフリーズ防止用ウォッチドッグタイマー (最大12秒で強制ロック解除) 🐾
        const watchdogId = setTimeout(() => {
            console.warn('SpeechSynthesis output timed out. Forcing next queue...');
            this.speaking = false;
            this.processQueue();
        }, 12000);

        utterance.onend = () => {
            clearTimeout(watchdogId);
            this.speaking = false;
            setTimeout(() => this.processQueue(), 250);
        };

        utterance.onerror = (e) => {
            clearTimeout(watchdogId);
            console.error('SpeechSynthesis error:', e);
            this.speaking = false;
            setTimeout(() => this.processQueue(), 250);
        };

        // ChromeのSpeechSynthesisフリーズ防止ハック（再生前にリセット ＆ 再開を噛ませる）🐾
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
            
            const haruka = langVoices.find(v => v.name.includes('Haruka') || v.name.includes('Ichiro') === false);
            if (haruka) return haruka;
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

    // 喋り方を人間らしく滑らかにするポーズ（間）自動チューニングフィルター🐾
    makeNaturalText(text) {
        if (!text) return '';
        
        let cleaned = text;
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
        // 人間らしい喋り方（息継ぎの間）を自動補正🐾
        const originalText = this.makeNaturalText(chat.message || '');
        const translationText = this.makeNaturalText(chat.translation || '');

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
            // 日本語コメントは常に100%日本語（ja-JP）でそのまま読み上げ🐾
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
                // 原文のみ（日本語翻訳は読まない）
                let readText = '';
                if (prefix) {
                    readText += `${prefix}、`;
                }
                readText += `${authorName}、${originalText}`;
                result.push({ text: readText, lang: foreignLang });
            } else if (mode === 'interpreter') {
                // 同時通訳（原文 -> 日本語訳）
                let readTextOriginal = '';
                if (prefix) {
                    readTextOriginal += `${prefix}、`;
                }
                readTextOriginal += `${authorName}、${originalText}`;
                result.push({ text: readTextOriginal, lang: foreignLang });

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
    const apiKeyInput = document.getElementById('api-key');
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
        return parseInt(val) === 61 ? '無制限 🐾' : `${val}秒`;
    };
    setupSlider(displayTimeSlider, displayTimeVal, '秒', displayTimeFormatter);

    setupSlider(maxCommentsSlider, maxCommentsVal, '個');

    // 読み上げ調整スライダー用フォーマッタ
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

    // localStorageからの設定復元
    function loadSettings() {
        const savedSettings = localStorage.getItem('yt_translator_settings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                apiKeyInput.value = settings.apiKey || '';
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

    // 設定の取得
    function getSettingsObject() {
        return {
            apiKey: apiKeyInput.value.trim(),
            liveUrl: liveUrlInput.value.trim(),
            fontSize: parseInt(fontSizeSlider.value),
            transSize: parseInt(transSizeSlider.value),
            displayTime: parseInt(displayTimeSlider.value),
            maxComments: parseInt(maxCommentsSlider.value),
            effectVolume: parseInt(effectVolumeSlider.value),
            filterForeign: filterForeignCheckbox ? filterForeignCheckbox.checked : false,
            enableReadAloud: enableReadAloudCheckbox ? enableReadAloudCheckbox.checked : true,
            readAloudMode: readAloudModeSelect ? readAloudModeSelect.value : 'native_only',
            readAloudCharacter: readAloudCharacterSelect ? readAloudCharacterSelect.value : 'standard',
            readAloudPitch: readAloudPitchSlider ? parseFloat(readAloudPitchSlider.value) : 1.2,
            readAloudRate: readAloudRateSlider ? parseFloat(readAloudRateSlider.value) : 1.1
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
        
        // URLパターンからの抽出
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = trimmed.match(regExp);
        return (match && match[2].length === 11) ? match[2] : '';
    }

    // 💀 効果音テスト再生ボタンの制御 (ランダム2パターン再生 ＆ 音量同期)
    if (btnTestSound) {
        btnTestSound.addEventListener('click', () => {
            try {
                const vol = parseInt(effectVolumeSlider.value) / 100;
                // 1か2をランダムで選択 (末尾にキャッシュバスターを追加してブラウザのキャッシュを防ぐ🐾)
                const soundNum = Math.random() < 0.5 ? 1 : 2;
                const soundFile = `効果音/レベルアップ_${soundNum}.mp3?v=${Date.now()}`;
                const audio = new Audio(soundFile);
                audio.volume = vol;
                audio.play().catch(err => console.log('Audio test blocked by browser:', err));
                
                // OBSオーバーレイ側でもテスト再生させるために同期トリガーをセット（ファイル番号も同期）
                localStorage.setItem('yt_translator_test_sound_trigger', JSON.stringify({
                    time: Date.now().toString(),
                    num: soundNum
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
        
        showStatus('connected', '設定を保存しました🐾');
        setTimeout(() => showStatus('disconnected', '接続準備完了'), 2000);
    });

    // OBS用リンクを生成・接続
    btnConnect.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        const liveUrl = liveUrlInput.value.trim();
        
        if (!apiKey) {
            alert('YouTube APIキーを入力してください！');
            apiKeyInput.focus();
            return;
        }
        
        const videoId = extractVideoId(liveUrl);
        if (!videoId) {
            alert('有効なYouTube配信URLまたは動画IDを入力してください！');
            liveUrlInput.focus();
            return;
        }

        // 現在のHTMLがある場所（ローカルパス）から overlay.html のパスを作成
        let overlayPath = window.location.href.replace('index.html', 'overlay.html');
        // もし末尾がスラッシュで終わっている、またはindex.htmlが無いローカルディレクトリの場合
        if (!overlayPath.includes('overlay.html')) {
            overlayPath = overlayPath + (overlayPath.endsWith('/') ? '' : '/') + 'overlay.html';
        }

        // 設定の保存
        const settings = getSettingsObject();
        localStorage.setItem('yt_translator_settings', JSON.stringify(settings));

        // クエリパラメータ付きのURLを生成（61秒は無制限を表すためtime=0として渡す。フィルターフラグも付加）
        const finalTime = settings.displayTime === 61 ? 0 : settings.displayTime;
        const obsUrl = `${overlayPath}?v=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}&size=${settings.fontSize}&tsize=${settings.transSize}&time=${finalTime}&max=${settings.maxComments}&filter=${settings.filterForeign ? 1 : 0}`;
        
        obsUrlInput.value = obsUrl;
        obsLinkCard.style.display = 'block';
        obsLinkCard.scrollIntoView({ behavior: 'smooth' });

        showStatus('connected', 'OBS連携リンクを生成しました！');
    });

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
        const testComment = {
            id: 'test_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
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

        // localStorageに書き込み、オーバーレイ（overlay.html）側のstorageイベントを発火させる
        localStorage.setItem('yt_translator_test_chat', JSON.stringify(testComment));
        
        // ローカルサーバーAPIへ同期（別ブラウザプロセス間での超安定リアルタイム同期用）🐾
        const port = window.location.port || '8080';
        fetch(`http://localhost:${port}/api/chat`, {
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
        testInfoText.textContent = `[${lang}] テストコメントを送信しました！🐾`;
        testInfoText.style.display = 'block';
        
        setTimeout(() => {
            testInfoText.style.display = 'none';
        }, 3000);
    }

    // 🇺🇸 英語テスト送信 (通常コメントとして送信🐾)
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

    // 🇰🇷 韓国語テスト送信 (通常コメントとして送信🐾)
    btnTestKr.addEventListener('click', () => {
        const koreanChats = [
            { o: "안녕하세요! 한국에서 보고 있습니다. 활 쏘는 솜씨가 대단하시네요!", t: "こんにちは！韓国から見ています。弓を射る腕前が素晴らしいですね！", n: "K-Ranger" },
            { o: "이 장비는 만드는데 얼마나 걸렸나요? 정말 부럽습니다!", t: "この装備を作るのにどれくらいかかりましたか？本当に羨ましいです！", n: "Vana_Korea" }
        ];
        const chat = koreanChats[Math.floor(Math.random() * koreanChats.length)];
        const avatarNum = Math.floor(Math.random() * 4) + 1;
        sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 20}`, 'Korean', false, false, false);
    });

    // 🇯🇵 日本語テスト送信 (通常コメント)
    btnTestJp.addEventListener('click', () => {
        const japaneseChats = [
            { o: "こんにちは! いつも配信楽しみに見てます！", t: "こんにちは！いつも配信楽しみに見てます！", n: "ゆうくん_FF11" },
            { o: "今の連携ダメージめちゃくちゃすごいですねー！！", t: "今の連携ダメージめちゃくちゃすごいですねー！！", n: "マートの弟子" }
        ];
        const chat = japaneseChats[Math.floor(Math.random() * japaneseChats.length)];
        const avatarNum = Math.floor(Math.random() * 4) + 1;
        sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 30}`, 'Japanese', false, false, false);
    });

    // 💖 スーパーチャットテスト送信 (お祝い読み上げ ＆ 悲鳴同期🐾)
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

    // 💚 メンバーシップ加入テスト送信
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

    // クリア送信
    btnClearTest.addEventListener('click', () => {
        localStorage.setItem('yt_translator_test_clear', Date.now().toString());
        
        // 読み上げクリア
        if (readAloudManager) {
            readAloudManager.clear();
        }
        
        // 履歴ログのクリア
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
    // チャット履歴ログの描画 ＆ 管理ロジック
    // ==========================================================================
    const chatLogList = document.getElementById('chat-log-list');
    const chatLogEmpty = document.getElementById('chat-log-empty');

    function appendToChatLog(chat) {
        if (!chatLogList) return;

        // 空メッセージプレースホルダーを消去
        if (chatLogEmpty) {
            chatLogEmpty.style.display = 'none';
        }

        // ログカードの作成
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

        // 送信者名
        const name = document.createElement('strong');
        name.style.color = chat.author.isOwner ? '#eab308' : (chat.author.isModerator ? '#3b82f6' : '#cbd5e1');
        name.style.minWidth = '80px';
        name.style.maxWidth = '120px';
        name.style.whiteSpace = 'nowrap';
        name.style.overflow = 'hidden';
        name.style.textOverflow = 'ellipsis';
        name.textContent = chat.author.name;
        logItem.appendChild(name);

        // コンテンツ（原文 ＋ 翻訳）
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

        // 最新のコメントを一番上にする
        chatLogList.insertBefore(logItem, chatLogList.firstChild);
    }

    // 外部（overlay.html）からの実チャットを受信して履歴に追加
    window.addEventListener('storage', (e) => {
        if (e.key === 'yt_translator_real_chat' && e.newValue) {
            try {
                const chat = JSON.parse(e.newValue);
                appendToChatLog(chat);
                
                // 実チャットの読み上げ
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
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Translation to English failed');
            
            const data = await res.json();
            if (data && data[0] && data[0][0] && data[0][0][0]) {
                return data[0][0][0].trim();
            }
            return text;
        } catch (err) {
            console.error('Translation error to English:', err);
            return text;
        }
    }

    // 配信者メッセージ送信処理
    function sendBroadcasterTranslation(original, trans) {
        const broadcasterChat = {
            id: 'bc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            author: {
                name: 'Yuuchin (配信者)',
                avatar: 'https://www.gstatic.com/youtube/img/creator/no_profile_image.png',
                isOwner: true
            },
            message: original,
            translation: trans,
            isBroadcaster: true,
            needTranslation: true,
            timestamp: Date.now()
        };
        
        // localStorageに書き込み、overlay側のstorageイベントを発火させる
        localStorage.setItem('yt_translator_broadcaster_chat', JSON.stringify(broadcasterChat));
        
        // ローカルサーバーAPIへ同期（別ブラウザプロセス間での超安定リアルタイム同期用）🐾
        const port = window.location.port || '8080';
        fetch(`http://localhost:${port}/api/chat`, {
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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isListening = false;
    let shouldBeListening = false; // ご主人様が意図的にマイクをONにしているかを表すフラグ🐾

    if (SpeechRecognition && btnMicToggle) {
        recognition = new SpeechRecognition();
        recognition.lang = 'ja-JP';
        recognition.continuous = true;
        recognition.interimResults = false;
        
        recognition.onstart = () => {
            isListening = true;
            if (micDot) micDot.classList.add('active');
            if (micBtnText) micBtnText.textContent = 'マイク音声認識: ON';
            if (micStatus) {
                micStatus.textContent = 'マイク入力中... 日本語で喋ると自動英訳されます 🎙️';
                micStatus.style.color = 'var(--success-color)';
            }
        };
        
        recognition.onend = () => {
            isListening = false;
            
            // ボタンがONのままなのにブラウザのタイムアウト等で勝手に切れてしまった場合 ➔ 即座に自動再接続！🐾
            if (shouldBeListening) {
                console.log('Speech recognition disconnected automatically. Reconnecting immediately...');
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Failed to auto-restart recognition:', e);
                    // 少しディレイを入れてからリトライ
                    setTimeout(() => {
                        if (shouldBeListening && !isListening) {
                            try { recognition.start(); } catch(err) { console.error(err); }
                        }
                    }, 500);
                }
                return; // 自動復帰中はUI表記を「ON」のまま維持します🐾
            }
            
            if (micDot) micDot.classList.remove('active');
            if (micBtnText) micBtnText.textContent = 'マイク音声認識: OFF';
            if (micStatus) {
                micStatus.textContent = '音声認識は停止しています。';
                micStatus.style.color = 'var(--text-muted)';
            }
        };
        
        recognition.onerror = (e) => {
            console.error('Speech recognition error:', e.error);
            if (e.error === 'aborted') return; // 自動再接続時の一時的なエラーはログのみで無視します
            
            if (micStatus) {
                if (e.error === 'not-allowed') {
                    micStatus.textContent = 'エラー: マイクの使用が許可されていません。ブラウザのアドレスバーの鍵アイコンからマイクを許可してください🐾';
                    micStatus.style.color = 'var(--error-color)';
                    shouldBeListening = false; // 許可がない場合は再起動ループを停止
                } else {
                    micStatus.textContent = `一時的な音声認識エラー: ${e.error}。自動再起動を試みます...🐾`;
                    micStatus.style.color = 'var(--accent-color)';
                }
            }
        };
        
        recognition.onresult = async (event) => {
            const resultText = event.results[event.results.length - 1][0].transcript.trim();
            if (!resultText) return;
            
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

        function startSpeechRecognition() {
            if (!recognition) return;
            shouldBeListening = true;
            try {
                recognition.start();
            } catch (e) {
                console.error('Failed to start recognition:', e);
            }
        }
        
        function stopSpeechRecognition() {
            if (!recognition) return;
            shouldBeListening = false;
            try {
                recognition.stop();
            } catch (e) {
                console.error('Failed to stop recognition:', e);
            }
        }
        
        btnMicToggle.addEventListener('click', () => {
            if (shouldBeListening) {
                stopSpeechRecognition();
            } else {
                startSpeechRecognition();
            }
        });
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
    // 別ブラウザプロセス間（OBSブラウザソース ➔ 通常のChrome読み上げ）超安定ハイブリッドAPI同期 🐾
    // ==========================================================================
    const processedChatIdsAdmin = new Set();
    async function startApiPollingAdmin() {
        const port = window.location.port || '8080';
        setInterval(async () => {
            try {
                const res = await fetch(`http://localhost:${port}/api/chat?t=${Date.now()}`);
                if (!res.ok) return;
                const chats = await res.json();
                if (Array.isArray(chats)) {
                    chats.forEach(chat => {
                        if (chat && chat.id && !processedChatIdsAdmin.has(chat.id) && !chat.isBroadcaster) {
                            processedChatIdsAdmin.add(chat.id);
                            
                            // 履歴に追加
                            appendToChatLog(chat);
                            
                            // 音声読み上げをキック🐾
                            if (readAloudManager) {
                                readAloudManager.speak(chat);
                            }
                        }
                    });
                    
                    // メモリー制限（1000件）
                    if (processedChatIdsAdmin.size > 1000) {
                        const keys = Array.from(processedChatIdsAdmin);
                        for (let i = 0; i < keys.length - 1000; i++) {
                            processedChatIdsAdmin.delete(keys[i]);
                        }
                    }
                }
            } catch (err) {
                // 静かに無視
            }
        }, 500); // 0.5秒間隔で極めて低負荷かつリアルタイムに同期します🐾
    }
    startApiPollingAdmin();
});
