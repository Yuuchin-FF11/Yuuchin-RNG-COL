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

        this.speaking = true;
        isSpeechSynthesisActive = true;
        if (isListening && recognition) {
            try {
                recognition.stop();
            } catch(e) {}
        }

        const item = this.queue.shift();
        
        // 読み上げ用のテキストに変換辞書を適用
        item.text = this.applyReadingDictionary(item.text);
        
        const charVal = this.characterSelect ? this.characterSelect.value : 'standard';

        if (item.lang === 'ja-JP' && charVal.startsWith('vv_')) {
            const speakerId = parseInt(charVal.replace('vv_', ''));
            const success = await this.speakVoiceVox(item.text, speakerId);
            
            isSpeechSynthesisActive = false;
            if (shouldBeListening && !isListening && recognition) {
                try { recognition.start(); } catch(e) {}
            }

            if (success) {
                this.speaking = false;
                setTimeout(() => this.processQueue(), 250);
                return;
            }
            console.log('VOICEVOX is unavailable, falling back to browser SpeechSynthesis...');
            
            isSpeechSynthesisActive = true;
            if (isListening && recognition) {
                try { recognition.stop(); } catch(e) {}
            }
        }

        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.lang = item.lang;

        const bestVoice = this.getBestVoice(item.lang);
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

        const resumeRecognition = () => {
            isSpeechSynthesisActive = false;
            if (shouldBeListening && !isListening && recognition) {
                try {
                    recognition.start();
                } catch(e) {}
            }
        };

        const watchdogId = setTimeout(() => {
            console.warn('SpeechSynthesis output timed out. Forcing next queue...');
            resumeRecognition();
            this.speaking = false;
            this.processQueue();
        }, 12000);

        utterance.onend = () => {
            clearTimeout(watchdogId);
            resumeRecognition();
            this.speaking = false;
            setTimeout(() => this.processQueue(), 250);
        };

        utterance.onerror = (e) => {
            clearTimeout(watchdogId);
            console.error('SpeechSynthesis error:', e);
            resumeRecognition();
            this.speaking = false;
            setTimeout(() => this.processQueue(), 250);
        };

        try {
            this.synth.cancel();
            this.synth.resume();
        } catch(err) {}

        this.synth.speak(utterance);
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

            // 読み上げ
            if (readAloudManager) {
                readAloudManager.speak(chatObj);
            }

            // スパチャやメンバーシップの場合、効果音再生トリガー
            if (isSuperChat || isMembership) {
                const soundNum = Math.random() < 0.5 ? 1 : 2;
                localStorage.setItem('yt_translator_test_sound_trigger', JSON.stringify({
                    time: Date.now().toString(),
                    num: soundNum
                }));
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
            if (data && data[0] && data[0][0] && data[0][0][0]) {
                return data[0][0][0].trim();
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

        if (readAloudManager) {
            readAloudManager.speak(testComment);
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
            
            if (shouldBeListening && !isSpeechSynthesisActive) {
                console.log('Speech recognition disconnected automatically. Reconnecting immediately...');
                try {
                    recognition.start();
                } catch (e) {
                    console.error('Failed to auto-restart recognition:', e);
                    setTimeout(() => {
                        if (shouldBeListening && !isListening && !isSpeechSynthesisActive) {
                            try { recognition.start(); } catch(err) { console.error(err); }
                        }
                    }, 500);
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
            console.error('Speech recognition error:', e.error);
            if (e.error === 'aborted') return;
            
            if (micStatus) {
                if (e.error === 'not-allowed') {
                    micStatus.textContent = 'エラー: マイクの使用が許可されていません。ブラウザのアドレスバーの鍵アイコンからマイクを許可してください🐾';
                    micStatus.style.color = 'var(--error-color)';
                    shouldBeListening = false;
                } else {
                    micStatus.textContent = `一時的な音声認識エラー: ${e.error}。自動再起動を試みます...🐾`;
                    micStatus.style.color = 'var(--accent-color)';
                }
            }
        };
        
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

        recognition.onresult = async (event) => {
            const rawText = event.results[event.results.length - 1][0].transcript.trim();
            if (!rawText) return;
            
            // 音声認識された日本語を誤認識修正辞書で補正する🐾
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
    }
});
