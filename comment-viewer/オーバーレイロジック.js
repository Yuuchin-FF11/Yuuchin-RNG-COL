// YouTube Chat Translator - OBS Overlay ロジック (コメビュ版・APIキー不要)

// OBS/ブラウザ内のエラーを画面に赤文字で強制デバッグ表示する救急措置🐾
function showDebugError(msg) {
    let errDiv = document.getElementById('debug-err-div');
    if (!errDiv) {
        errDiv = document.createElement('div');
        errDiv.id = 'debug-err-div';
        errDiv.style.color = '#ff3333';
        errDiv.style.background = 'rgba(0, 0, 0, 0.95)';
        errDiv.style.padding = '20px';
        errDiv.style.border = '4px solid #ff3333';
        errDiv.style.borderRadius = '12px';
        errDiv.style.zIndex = '99999';
        errDiv.style.position = 'fixed';
        errDiv.style.top = '20px';
        errDiv.style.left = '20px';
        errDiv.style.fontSize = '24px';
        errDiv.style.fontWeight = 'bold';
        errDiv.style.fontFamily = 'sans-serif';
        document.body.appendChild(errDiv);
    }
    errDiv.textContent = msg;
}

window.onerror = function(message, source, lineno, colno, error) {
    showDebugError(`JS Error: ${message} at ${source}:${lineno}:${colno}`);
    return false;
};

// 起動時刻の記録（過去ログ巻き戻り防止用）🐾
const appLoadTime = Date.now();

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

document.addEventListener('DOMContentLoaded', () => {
    const commentContainer = document.getElementById('comment-container');

    // OBS環境とブラウザプレビュー環境を自動検知し、眩しさ防止の黒背景を適応するマジカルシステム🐾
    if (window.obsstudio) {
        document.body.style.setProperty('background-color', 'rgba(0, 0, 0, 0)', 'important');
    } else {
        document.body.style.setProperty('background-color', 'rgba(10, 10, 10, 0.98)', 'important');
    }

    // クエリパラメータの解析
    const params = new URLSearchParams(window.location.search);
    
    // デザイン設定（パラメータが無い場合のデフォルト値）
    let fontSize = parseInt(params.get('size')) || 16;
    let transSize = parseInt(params.get('tsize')) || 15;
    let displayTime = (params.get('time') !== null) ? parseInt(params.get('time')) : 15;
    let maxComments = parseInt(params.get('max')) || 6;
    let filterForeign = (params.get('filter') === '1');

    let processedMessageIds = new Set(); // 重複排除用

    // CSSカスタム変数の適用
    function applyStyles() {
        document.documentElement.style.setProperty('--font-size-base', `${fontSize}px`);
        document.documentElement.style.setProperty('--font-size-trans', `${transSize}px`);
        
        const cards = document.querySelectorAll('.comment-card');
        cards.forEach(card => {
            const orig = card.querySelector('.message-original');
            const trans = card.querySelector('.translation-text');
            if (orig) {
                if (card.classList.contains('comment-card-broadcaster')) {
                    orig.style.fontSize = `${fontSize + 16}px`;
                } else {
                    orig.style.fontSize = `${fontSize}px`;
                }
            }
            if (trans) {
                if (card.classList.contains('comment-card-broadcaster')) {
                    trans.style.fontSize = `${transSize + 2}px`;
                } else {
                    trans.style.fontSize = `${transSize}px`;
                }
            }
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
                const newDisplayTime = settings.displayTime === 61 ? 0 : settings.displayTime;
                displayTime = (newDisplayTime !== undefined) ? newDisplayTime : displayTime;
                maxComments = settings.maxComments || maxComments;
                filterForeign = (settings.filterForeign !== undefined) ? settings.filterForeign : filterForeign;
                applyStyles();
            } catch (err) {
                console.error('Failed to parse live settings:', err);
            }
        }

        // 手動効果音テスト再生の受信
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

        // 実チャットの直接受信（管理ロジック側から localStorage で飛んできた場合）
        if (e.key === 'yt_translator_real_chat' && e.newValue) {
            try {
                const realChat = JSON.parse(e.newValue);
                addCommentCard(realChat);
            } catch (err) {
                console.error('Failed to parse real chat:', err);
            }
        }
    });

    // ==========================================================================
    // コメントカードの作成・描画 ＆ フェードアウト制御
    // ==========================================================================
    
    function addCommentCard(chatData) {
        // 起動時刻より前の過去ログはスルー🐾
        if (chatData.timestamp && chatData.timestamp < appLoadTime) {
            if (chatData.id) {
                processedMessageIds.add(chatData.id);
            }
            return;
        }

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

        if (chatData.message) {
            chatData.message = cleanMessage(chatData.message, enableNsfwFilter, nsfwWords);
        }
        if (chatData.translation) {
            chatData.translation = cleanMessage(chatData.translation, enableNsfwFilter, nsfwWords);
        }

        if (chatData.id) {
            if (document.getElementById(chatData.id)) {
                return;
            }
            processedMessageIds.add(chatData.id);
        }

        // 海外コメント専用フィルターがオンの場合、日本語（翻訳不要）のコメントをスキップ（配信者発言は除く）
        if (filterForeign && !chatData.needTranslation && !chatData.isBroadcaster) {
            return;
        }

        // スーパーチャットまたはメンバーシップの場合に、設定された音量で効果音を自動再生
        if (chatData.isSuperChat || chatData.isMembership) {
            try {
                const savedSettings = localStorage.getItem('yt_translator_settings');
                let volume = 0.9;
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    volume = (settings.effectVolume !== undefined) ? (settings.effectVolume / 100) : 0.9;
                }
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
            img.src = 'broadcaster.png';
        } else {
            img.src = chatData.author.avatar || 'https://www.gstatic.com/youtube/img/creator/no_profile_image.png';
        }
        img.alt = chatData.author.name;
        img.onerror = () => { if (!chatData.isBroadcaster) img.src = 'https://www.gstatic.com/youtube/img/creator/no_profile_image.png'; };
        card.appendChild(img);

        // コンテンツエリア
        const content = document.createElement('div');
        content.className = 'comment-content';

        // 名前
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

        // 配信者の場合は、英語（翻訳先）をメインに大きく表示し、日本語（原文）を下に小さく添える
        if (chatData.isBroadcaster) {
            const origMsg = document.createElement('span');
            origMsg.className = 'message-original';
            origMsg.style.fontSize = `${fontSize + 16}px`;
            origMsg.textContent = chatData.translation;
            content.appendChild(origMsg);

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
                transMsg.style.color = 'var(--text-muted)';
                transMsg.style.fontSize = `${transSize + 2}px`;
                transMsg.textContent = chatData.message;
                transBox.appendChild(transMsg);

                content.appendChild(transBox);
            }
        } else {
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

        if (displayTime > 0) {
            const currentDisplayTime = chatData.isBroadcaster ? Math.max(displayTime * 1.5, 10) : displayTime;
            setTimeout(() => {
                removeCard(card);
            }, currentDisplayTime * 1000);
        }
    }

    function removeCard(cardElement) {
        if (!cardElement || cardElement.classList.contains('fade-out')) return;
        
        cardElement.classList.add('fade-out');
        setTimeout(() => {
            if (cardElement.parentNode === commentContainer) {
                commentContainer.removeChild(cardElement);
            }
        }, 400);
    }

    // ==========================================================================
    // 別ブラウザプロセス間（通常のChrome ➔ OBSブラウザソース）超安定ハイブリッドAPI同期
    // ==========================================================================
    let isFirstPoll = true;
    async function startApiPolling() {
        const port = window.location.port || '8080';
        setInterval(async () => {
            try {
                const res = await fetch(`http://localhost:${port}/api/chat?t=${Date.now()}`);
                if (!res.ok) {
                    showDebugError(`API Response Error: status ${res.status}`);
                    return;
                }
                const chats = await res.json();
                
                if (Array.isArray(chats)) {
                    chats.forEach(chat => {
                        if (chat && chat.id) {
                            if (!processedMessageIds.has(chat.id)) {
                                if (!isFirstPoll) {
                                    addCommentCard(chat);
                                } else {
                                    processedMessageIds.add(chat.id);
                                }
                            }
                        }
                    });
                    isFirstPoll = false;
                    
                    if (processedMessageIds.size > 1000) {
                        const firstKey = processedMessageIds.values().next().value;
                        processedMessageIds.delete(firstKey);
                    }
                }
            } catch (err) {
                showDebugError(`API Fetch Exception: ${err.message || err.toString()}`);
            }
        }, 500);
    }
    startApiPolling();
});
