// YouTube Chat Translator - OBS Overlay ロジック

document.addEventListener('DOMContentLoaded', () => {
    const commentContainer = document.getElementById('comment-container');

    // クエリパラメータの解析
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('v') || '';
    const apiKey = params.get('key') || '';
    
    // デザイン設定（パラメータが無い場合のデフォルト値）
    let fontSize = parseInt(params.get('size')) || 16;
    let transSize = parseInt(params.get('tsize')) || 15;
    let displayTime = parseInt(params.get('time')) || 15;
    let maxComments = parseInt(params.get('max')) || 6;

    let activeLiveChatId = '';
    let nextPageToken = '';
    let pollingInterval = 4000; // デフォルト4秒
    let pollTimeoutId = null;
    let processedMessageIds = new Set(); // 重複排除用

    // CSSカスタム変数の適用
    function applyStyles() {
        document.documentElement.style.setProperty('--font-size-base', `${fontSize}px`);
        document.documentElement.style.setProperty('--font-size-trans', `${transSize}px`);
        
        // 生成済みの全カードのスタイルを即座に変更
        const cards = document.querySelectorAll('.comment-card');
        cards.forEach(card => {
            const orig = card.querySelector('.message-original');
            const trans = card.querySelector('.translation-text');
            if (orig) orig.style.fontSize = `${fontSize}px`;
            if (trans) trans.style.fontSize = `${transSize}px`;
        });
    }
    applyStyles();

    // ==========================================================================
    // サーバーレス設定 ＆ テストコメントリアルタイム同期（localStorage監視）
    // ==========================================================================
    
    window.addEventListener('storage', (e) => {
        // デザイン設定のリアルタイム同期
        if (e.key === 'yt_translator_live_settings' && e.newValue) {
            try {
                const settings = JSON.parse(e.newValue);
                fontSize = settings.fontSize || fontSize;
                transSize = settings.transSize || transSize;
                displayTime = settings.displayTime || displayTime;
                maxComments = settings.maxComments || maxComments;
                applyStyles();
            } catch (err) {
                console.error('Failed to parse live settings:', err);
            }
        }
        
        // テストコメントの受信
        if (e.key === 'yt_translator_test_chat' && e.newValue) {
            try {
                const testChat = JSON.parse(e.newValue);
                addCommentCard(testChat);
            } catch (err) {
                console.error('Failed to parse test chat:', err);
            }
        }

        // 表示のクリア
        if (e.key === 'yt_translator_test_clear') {
            commentContainer.innerHTML = '';
        }
    });

    // ==========================================================================
    // 無料Google翻訳API（JSONP経由/直接フェッチ）連動
    // ==========================================================================
    
    async function translateText(text) {
        if (!text) return '';
        
        // アルファベット、半角記号、数字のみの単純な文字列や、顔文字は翻訳をパスする
        const isOnlyAscii = /^[\s!-~]*$/.test(text);
        if (isOnlyAscii && text.length < 3) return text;

        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ja&dt=t&q=${encodeURIComponent(text)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Translation request failed');
            
            const data = await res.json();
            if (data && data[0] && data[0][0] && data[0][0][0]) {
                const translated = data[0][0][0];
                return translated.trim();
            }
            return text;
        } catch (err) {
            console.error('Translation error:', err);
            return text; // エラー時は原文を表示
        }
    }

    // ==========================================================================
    // コメントカードの作成・描画 ＆ フェードアウト制御
    // ==========================================================================
    
    function addCommentCard(chatData) {
        // すでに表示数制限を超えている場合は古いものから消去
        const currentCards = commentContainer.querySelectorAll('.comment-card:not(.fade-out)');
        if (currentCards.length >= maxComments) {
            const oldestCard = currentCards[0];
            removeCard(oldestCard);
        }

        // カード全体のコンテナ
        const card = document.createElement('div');
        card.className = 'comment-card';
        card.id = chatData.id;

        // アイコン
        const img = document.createElement('img');
        img.className = 'avatar';
        img.src = chatData.author.avatar || 'https://www.gstatic.com/youtube/img/creator/no_profile_image.png';
        img.alt = chatData.author.name;
        img.onerror = () => { img.src = 'https://www.gstatic.com/youtube/img/creator/no_profile_image.png'; };
        card.appendChild(img);

        // コンテンツエリア
        const content = document.createElement('div');
        content.className = 'comment-content';

        // 名前（バッジ対応）
        const nameNode = document.createElement('span');
        nameNode.className = 'author-name';
        nameNode.textContent = chatData.author.name;

        if (chatData.author.isOwner) {
            const ownerBadge = document.createElement('span');
            ownerBadge.className = 'badge badge-owner';
            ownerBadge.textContent = 'Owner';
            nameNode.appendChild(ownerBadge);
        } else if (chatData.author.isModerator) {
            const modBadge = document.createElement('span');
            modBadge.className = 'badge badge-moderator';
            modBadge.textContent = 'Mod';
            nameNode.appendChild(modBadge);
        }
        content.appendChild(nameNode);

        // 原文メッセージ
        const origMsg = document.createElement('span');
        origMsg.className = 'message-original';
        origMsg.style.fontSize = `${fontSize}px`;
        origMsg.textContent = chatData.message;
        content.appendChild(origMsg);

        // 翻訳メッセージ（必要な場合のみ追加）
        if (chatData.needTranslation && chatData.translation) {
            const transBox = document.createElement('div');
            transBox.className = 'translation-box';

            const label = document.createElement('span');
            label.className = 'translation-label';
            label.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6 6-6"/></svg> 翻訳`;
            transBox.appendChild(label);

            const transMsg = document.createElement('span');
            transMsg.className = 'translation-text';
            transMsg.style.fontSize = `${transSize}px`;
            transMsg.textContent = chatData.translation;
            transBox.appendChild(transMsg);

            content.appendChild(transBox);
        }

        card.appendChild(content);
        commentContainer.appendChild(card);

        // 一定時間経過後にフェードアウトさせて削除
        setTimeout(() => {
            removeCard(card);
        }, displayTime * 1000);
    }

    function removeCard(cardElement) {
        if (!cardElement || cardElement.classList.contains('fade-out')) return;
        
        cardElement.classList.add('fade-out');
        // アニメーション完了後にDOMから完全に削除 (0.4秒後)
        setTimeout(() => {
            if (cardElement.parentNode === commentContainer) {
                commentContainer.removeChild(cardElement);
            }
        }, 400);
    }

    // ==========================================================================
    // YouTube Data API v3 を用いたチャット取得ストリーム
    // ==========================================================================
    
    // Step 1: ライブ配信IDからアクティブなライブチャットIDを取得
    async function fetchLiveChatId() {
        if (!videoId || !apiKey) {
            console.warn('Video ID or API Key is missing. Operating in Test Mode.');
            return;
        }

        const url = `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
        
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            
            const data = await res.json();
            if (data.items && data.items.length > 0) {
                const details = data.items[0].liveStreamingDetails;
                if (details && details.activeLiveChatId) {
                    activeLiveChatId = details.activeLiveChatId;
                    console.log('Successfully acquired Active Live Chat ID:', activeLiveChatId);
                    startChatPolling(); // ポーリング開始
                } else {
                    console.error('This video is not an active live stream.');
                }
            } else {
                console.error('Video not found. Please check Video ID.');
            }
        } catch (err) {
            console.error('Failed to acquire Live Chat ID:', err);
        }
    }

    // Step 2: ライブチャットIDからメッセージを定期的に取得（ポーリング）
    async function fetchChatMessages() {
        if (!activeLiveChatId) return;

        let url = `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${encodeURIComponent(activeLiveChatId)}&part=snippet,authorDetails&key=${encodeURIComponent(apiKey)}`;
        if (nextPageToken) {
            url += `&pageToken=${encodeURIComponent(nextPageToken)}`;
        }

        try {
            const res = await fetch(url);
            if (!res.ok) {
                // APIエラー時は少し長めに待ってから再起動
                console.error(`Chat API error: ${res.status}. Retrying in 10s...`);
                pollTimeoutId = setTimeout(fetchChatMessages, 10000);
                return;
            }

            const data = await res.json();
            nextPageToken = data.nextPageToken || nextPageToken;
            
            // API指定の推奨ポーリング間隔を適用（通常3〜5秒）
            pollingInterval = data.pollingIntervalMillis || pollingInterval;

            if (data.items && data.items.length > 0) {
                // 差分のみを処理
                const newItems = data.items.filter(item => !processedMessageIds.has(item.id));
                
                // 初回読み込み時は画面がコメントで埋まるのを防ぐため、最後の数件のみ処理
                const itemsToProcess = nextPageToken ? newItems : newItems.slice(-3);

                for (const item of itemsToProcess) {
                    processedMessageIds.add(item.id);

                    const author = item.authorDetails;
                    const snippet = item.snippet;
                    const message = snippet.textMessageDetails ? snippet.textMessageDetails.messageText : '';
                    
                    if (!message) continue;

                    // 翻訳処理
                    const translated = await translateText(message);
                    
                    // 重複排除のメモリ制限（1000件を超えたら古いものを削除）
                    if (processedMessageIds.size > 1000) {
                        const firstKey = processedMessageIds.values().next().value;
                        processedMessageIds.delete(firstKey);
                    }

                    // 描画用オブジェクトに整形
                    const chatItem = {
                        id: item.id,
                        author: {
                            name: author.displayName,
                            avatar: author.profileImageUrl,
                            isOwner: author.isChatOwner,
                            isModerator: author.isChatModerator
                        },
                        message: message,
                        translation: translated,
                        needTranslation: message !== translated,
                        timestamp: new Date(snippet.publishedAt).getTime()
                    };

                    addCommentCard(chatItem);
                }
            }

            // 次のポーリングをスケジュール
            pollTimeoutId = setTimeout(fetchChatMessages, pollingInterval);

        } catch (err) {
            console.error('Error fetching chat messages:', err);
            // ネットワークエラー時は5秒後に再試行
            pollTimeoutId = setTimeout(fetchChatMessages, 5000);
        }
    }

    function startChatPolling() {
        if (pollTimeoutId) clearTimeout(pollTimeoutId);
        fetchChatMessages();
    }

    // 初期化起動
    fetchLiveChatId();
});
