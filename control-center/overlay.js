// YouTube Chat Translator - OBS Overlay ロジック

document.addEventListener('DOMContentLoaded', () => {
    const commentContainer = document.getElementById('comment-container');

    // OBS環境とブラウザプレビュー環境を自動検知し、眩しさ防止の黒背景を適応するマジカルシステム🐾
    if (window.obsstudio) {
        // OBS配信ソース内ではゲーム画面を遮らないように完全透過にします
        document.body.style.setProperty('background-color', 'rgba(0, 0, 0, 0)', 'important');
    } else {
        // 通常のブラウザプレビューでは眩しさを防ぎ目に優しい極上の漆黒ダーク背景にします🐾
        document.body.style.setProperty('background-color', 'rgba(10, 10, 10, 0.98)', 'important');
    }

    // クエリパラメータの解析
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('v') || '';
    const apiKey = params.get('key') || '';
    
    // デザイン設定（パラメータが無い場合のデフォルト値）
    let fontSize = parseInt(params.get('size')) || 16;
    let transSize = parseInt(params.get('tsize')) || 15;
    // 0（無制限）が指定された場合にデフォルト値15に上書きされるのを防ぐため、null判定を適用
    let displayTime = (params.get('time') !== null) ? parseInt(params.get('time')) : 15;
    let maxComments = parseInt(params.get('max')) || 6;
    let filterForeign = (params.get('filter') === '1');

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
                // 管理画面側の61秒（無制限）を0秒（無制限）に変換して適用
                const newDisplayTime = settings.displayTime === 61 ? 0 : settings.displayTime;
                displayTime = (newDisplayTime !== undefined) ? newDisplayTime : displayTime;
                maxComments = settings.maxComments || maxComments;
                filterForeign = (settings.filterForeign !== undefined) ? settings.filterForeign : filterForeign;
                applyStyles();
            } catch (err) {
                console.error('Failed to parse live settings:', err);
            }
        }

        // 手動効果音テスト再生の受信 (同期ランダム再生)
        if (e.key === 'yt_translator_test_sound_trigger' && e.newValue) {
            try {
                const triggerData = JSON.parse(e.newValue);
                const soundNum = triggerData.num || (Math.random() < 0.5 ? 1 : 2);
                
                const savedSettings = localStorage.getItem('yt_translator_settings');
                let volume = 0.9;
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    volume = (settings.effectVolume !== undefined) ? (settings.effectVolume / 100) : 0.9;
                }
                const audio = new Audio(`効果音/レベルアップ_${soundNum}.mp3?v=${Date.now()}`);
                audio.volume = volume;
                audio.play().catch(err => console.warn('Audio test playback blocked by browser/OBS:', err));
            } catch (err) {
                console.error('Failed to play test sound:', err);
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
        
        // 配信者メッセージの受信
        if (e.key === 'yt_translator_broadcaster_chat' && e.newValue) {
            try {
                const broadcasterChat = JSON.parse(e.newValue);
                addCommentCard(broadcasterChat);
            } catch (err) {
                console.error('Failed to parse broadcaster chat:', err);
            }
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
        // メモリ上の重複リスト ＆ DOMから検索する二重防衛線により、超高速な同時発生時の二重描画も100%完璧に防ぎます🐾
        if (chatData.id) {
            if (processedMessageIds.has(chatData.id) || document.getElementById(chatData.id)) {
                return;
            }
            processedMessageIds.add(chatData.id);
        }

        // 海外コメント専用フィルターがオンの場合、日本語（翻訳不要）のコメントをスキップ（配信者発言は除く）
        if (filterForeign && !chatData.needTranslation && !chatData.isBroadcaster) {
            return;
        }

        // 管理画面へログを同期するためにlocalStorageへ書き込み（実チャットの逆転送。配信者は除く）
        if (chatData.id && !chatData.id.startsWith('test_') && !chatData.isBroadcaster) {
            localStorage.setItem('yt_translator_real_chat', JSON.stringify(chatData));
            
            // ローカルサーバーAPIへ逆同期（別プロセス間での超安定読み上げ同期用）🐾
            const port = window.location.port || '8080';
            fetch(`http://localhost:${port}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatData)
            }).catch(err => console.error('Failed to sync real chat to API:', err));
        }

        // スーパーチャットまたはメンバーシップの場合に、設定された音量で効果音を自動再生 (ランダム2パターン再生)
        if (chatData.isSuperChat || chatData.isMembership) {
            try {
                const savedSettings = localStorage.getItem('yt_translator_settings');
                let volume = 0.9;
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    volume = (settings.effectVolume !== undefined) ? (settings.effectVolume / 100) : 0.9;
                }
                // 1か2をランダムで選択
                const soundNum = Math.random() < 0.5 ? 1 : 2;
                const audio = new Audio(`効果音/レベルアップ_${soundNum}.mp3?v=${Date.now()}`);
                audio.volume = volume;
                audio.play().catch(err => console.warn('Auto playback blocked by browser/OBS:', err));
            } catch (err) {
                console.error('Failed to auto play effect sound:', err);
            }
        }

        // すでに表示数制限を超えている場合は古いものから消去
        const currentCards = commentContainer.querySelectorAll('.comment-card:not(.fade-out)');
        if (currentCards.length >= maxComments) {
            const oldestCard = currentCards[0];
            removeCard(oldestCard);
        }

        // カード全体のコンテナ
        const card = document.createElement('div');
        if (chatData.isBroadcaster) {
            card.className = 'comment-card comment-card-broadcaster';
        } else if (chatData.isSuperChat) {
            card.className = 'comment-card comment-card-superchat';
        } else if (chatData.isMembership) {
            card.className = 'comment-card comment-card-membership';
        } else {
            card.className = 'comment-card';
        }
        card.id = chatData.id;

        // アイコン
        const img = document.createElement('img');
        img.className = 'avatar';
        if (chatData.isBroadcaster) {
            // 配信者用のゴールドマイクアバター（互換性のため静的画像URLにフォールバック）
            img.src = 'https://www.gstatic.com/youtube/img/creator/no_profile_image.png';
        } else {
            img.src = chatData.author.avatar || 'https://www.gstatic.com/youtube/img/creator/no_profile_image.png';
        }
        img.alt = chatData.author.name;
        img.onerror = () => { if (!chatData.isBroadcaster) img.src = 'https://www.gstatic.com/youtube/img/creator/no_profile_image.png'; };
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

        // 配信者（ご主人様）の場合は、英語（翻訳先）をメインに大きく表示し、日本語（原文）を下に小さく添える黄金比レイアウト🐾
        if (chatData.isBroadcaster) {
            // メインは英訳された美しい英語
            const origMsg = document.createElement('span');
            origMsg.className = 'message-original';
            origMsg.style.fontSize = `${fontSize}px`;
            origMsg.textContent = chatData.translation;
            content.appendChild(origMsg);

            // サブに元の日本語を小さく控えめに添える（英語を引き立てるためグレー文字にします）
            if (chatData.message) {
                const transBox = document.createElement('div');
                transBox.className = 'translation-box';
                transBox.style.borderTop = '1px solid rgba(255, 255, 255, 0.05)';

                const label = document.createElement('span');
                label.className = 'translation-label';
                label.innerHTML = `[日本語]`;
                transBox.appendChild(label);

                const transMsg = document.createElement('span');
                transMsg.className = 'translation-text';
                transMsg.style.color = 'var(--text-muted)'; // 控えめなグレー色にして英語を引き立てます🐾
                transMsg.style.fontSize = `${transSize}px`;
                transMsg.textContent = chatData.message;
                transBox.appendChild(transMsg);

                content.appendChild(transBox);
            }
        } else {
            // 通常の視聴者の場合は、原文をメインにし、必要なら翻訳を下に追加（従来どおり）
            const origMsg = document.createElement('span');
            origMsg.className = 'message-original';
            origMsg.style.fontSize = `${fontSize}px`;
            origMsg.textContent = chatData.message;
            content.appendChild(origMsg);

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
        }

        card.appendChild(content);
        commentContainer.appendChild(card);

        // 一定時間経過後にフェードアウトさせて削除（displayTimeが0の時は無制限のためタイマーを起動しない）
        if (displayTime > 0) {
            // 配信者の発言は長めに表示（通常の1.5倍、最低でも10秒）
            const currentDisplayTime = chatData.isBroadcaster ? Math.max(displayTime * 1.5, 10) : displayTime;
            setTimeout(() => {
                removeCard(card);
            }, currentDisplayTime * 1000);
        }
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
                    
                    let message = '';
                    let isSuperChat = false;
                    let isMembership = false;

                    if (snippet.type === 'textMessageDetails' && snippet.textMessageDetails) {
                        message = snippet.textMessageDetails.messageText;
                    } else if (snippet.type === 'superChatEvent' && snippet.superChatDetails) {
                        message = snippet.superChatDetails.userComment || `Super Chat! (${snippet.superChatDetails.amountDisplayString})`;
                        isSuperChat = true;
                    } else if (snippet.type === 'memberMilestoneChatEvent' && snippet.memberMilestoneChatEvent) {
                        message = snippet.memberMilestoneChatEvent.userComment || 'Membership Milestone!';
                        isMembership = true;
                    } else if (snippet.type === 'newSponsorEvent') {
                        message = 'New Member Welcomed! 🎉';
                        isMembership = true;
                    }

                    if (!message) continue;

                    // 翻訳処理 (スーパーチャットやメンバーシップも翻訳する)
                    const translated = await translateText(message);
                    
                    // 重複排除 of memory limit (1000件を超えたら古いものを削除)
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
                        isSuperChat: isSuperChat,
                        isMembership: isMembership,
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

    // ==========================================================================
    // 別ブラウザプロセス間（通常のChrome ➔ OBSブラウザソース）超安定ハイブリッドAPI同期 🐾
    // ==========================================================================
    async function startApiPolling() {
        const port = window.location.port || '8080';
        setInterval(async () => {
            try {
                const res = await fetch(`http://localhost:${port}/api/chat?t=${Date.now()}`);
                if (!res.ok) return;
                const chats = await res.json();
                if (Array.isArray(chats)) {
                    chats.forEach(chat => {
                        if (chat && chat.id && !processedMessageIds.has(chat.id)) {
                            processedMessageIds.add(chat.id);
                            addCommentCard(chat);
                        }
                    });
                    
                    // メモリー制限（1000件）
                    if (processedMessageIds.size > 1000) {
                        const firstKey = processedMessageIds.values().next().value;
                        processedMessageIds.delete(firstKey);
                    }
                }
            } catch (err) {
                // 静かに無視
            }
        }, 500); // 0.5秒間隔で極めて低負荷かつリアルタイムに同期します🐾
    }
    startApiPolling();

    // 初期化起動
    fetchLiveChatId();
});
