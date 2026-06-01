// YouTube Chat Translator - 管理画面ロジック

document.addEventListener('DOMContentLoaded', () => {
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
    function setupSlider(slider, valueDisplay, unit = 'px') {
        slider.addEventListener('input', () => {
            valueDisplay.textContent = `${slider.value}${unit}`;
        });
    }
    setupSlider(fontSizeSlider, fontSizeVal, 'px');
    setupSlider(transSizeSlider, transSizeVal, 'px');
    setupSlider(displayTimeSlider, displayTimeVal, '秒');
    setupSlider(maxCommentsSlider, maxCommentsVal, '個');

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
                displayTimeVal.textContent = `${displayTimeSlider.value}秒`;
                
                maxCommentsSlider.value = settings.maxComments || 6;
                maxCommentsVal.textContent = `${maxCommentsSlider.value}個`;
                
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
            maxComments: parseInt(maxCommentsSlider.value)
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

        // クエリパラメータ付きのURLを生成
        const obsUrl = `${overlayPath}?v=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}&size=${settings.fontSize}&tsize=${settings.transSize}&time=${settings.displayTime}&max=${settings.maxComments}`;
        
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
    
    function sendTestComment(original, trans, name, avatar, lang, isOwner = false) {
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
            timestamp: Date.now()
        };

        // localStorageに書き込み、オーバーレイ（overlay.html）側のstorageイベントを発火させる
        localStorage.setItem('yt_translator_test_chat', JSON.stringify(testComment));
        
        // 自分の履歴にも追加
        appendToChatLog(testComment);

        // テスト通知テキストを表示
        testInfoText.textContent = `[${lang}] テストコメントを送信しました！🐾`;
        testInfoText.style.display = 'block';
        
        setTimeout(() => {
            testInfoText.style.display = 'none';
        }, 3000);
    }

    // 🇺🇸 英語テスト送信
    btnTestEn.addEventListener('click', () => {
        const englishChats = [
            { o: "Hello from New York! Your stream is so cozy! Great sniper play!", t: "ニューヨークからこんにちは！あなたの配信はとても居心地が良いですね！素晴らしいスナイパーのプレイです！", n: "Emily_NY" },
            { o: "Wow, what a nice gear setup! Can you show it again?", t: "わぁ、なんて素晴らしい装備構成なんでしょう！もう一度見せてもらえますか？", n: "John_RNG" },
            { o: "Hi from UK! I love FFXI streams! Keep it up!", t: "イギリスからこんにちは！FF11の配信が大好きです！その調子で頑張ってください！", n: "Vana_Fan_UK" }
        ];
        const chat = englishChats[Math.floor(Math.random() * englishChats.length)];
        const avatarNum = Math.floor(Math.random() * 4) + 1;
        sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 10}`, 'English', false);
    });

    // 🇰🇷 韓国語テスト送信
    btnTestKr.addEventListener('click', () => {
        const koreanChats = [
            { o: "안녕하세요! 한국에서 보고 있습니다. 활 쏘는 솜씨가 대단하시네요!", t: "こんにちは！韓国から見ています。弓を射る腕前が素晴らしいですね！", n: "K-Ranger" },
            { o: "이 장비는 만드는데 얼마나 걸렸나요? 정말 부럽습니다!", t: "この装備を作るのにどれくらいかかりましたか？本当に羨ましいです！", n: "Vana_Korea" }
        ];
        const chat = koreanChats[Math.floor(Math.random() * koreanChats.length)];
        const avatarNum = Math.floor(Math.random() * 4) + 1;
        sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 20}`, 'Korean', false);
    });

    // 🇯🇵 日本語テスト送信
    btnTestJp.addEventListener('click', () => {
        const japaneseChats = [
            { o: "こんにちは! いつも配信楽しみに見てます！", t: "こんにちは！いつも配信楽しみに見てます！", n: "ゆうくん_FF11" },
            { o: "今の連携ダメージめちゃくちゃすごいですねー！！", t: "今の連携ダメージめちゃくちゃすごいですねー！！", n: "マートの弟子" }
        ];
        const chat = japaneseChats[Math.floor(Math.random() * japaneseChats.length)];
        const avatarNum = Math.floor(Math.random() * 4) + 1;
        sendTestComment(chat.o, chat.t, chat.n, `https://i.pravatar.cc/100?img=${avatarNum + 30}`, 'Japanese', false);
    });

    // クリア送信
    btnClearTest.addEventListener('click', () => {
        localStorage.setItem('yt_translator_test_clear', Date.now().toString());
        
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
            } catch (err) {
                console.error('Failed to parse real chat log:', err);
            }
        }
    });
});
