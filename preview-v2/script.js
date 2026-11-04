// FFXI Bismarck - V2用トップページ制御スクリプト
// アニメーション制御および外部通信（Gemini API等）の無効化処理を行います

document.addEventListener('DOMContentLoaded', () => {
    initV2AIChat();
    initV2ScrollAnimations();
    initV2UpdatesFilter();
});

// --- スクロールアニメーション制御 ---
function initV2ScrollAnimations() {
    // prefers-reduced-motionの確認
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.glass-card, .polaroid-photo').forEach(card => {
        if (prefersReduced) {
            // 動きを減らす設定のユーザーにはアニメーションなしで即時表示
            card.style.opacity = '1';
            card.style.transform = 'none';
        } else {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            observer.observe(card);
        }
    });

    if (!prefersReduced) {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = `
            .glass-card.visible, .polaroid-photo.visible {
                opacity: 1 !important;
                transform: translateY(0) !important;
            }
        `;
        document.head.appendChild(styleSheet);
    }
}

// --- 更新履歴フィルター（最新5件の制御） ---
function initV2UpdatesFilter() {
    const listAll = document.getElementById('whats-new-list-all');
    const listV2 = document.getElementById('v2-whats-new-list');
    const viewAllBtn = document.getElementById('view-all-history-btn');
    const allUpdatesSection = document.getElementById('all-updates');

    if (!listAll || !listV2 || !viewAllBtn || !allUpdatesSection) return;

    // 初期状態では全文履歴セクションは非表示
    allUpdatesSection.style.display = 'none';

    // 全履歴リストから最新5件を抽出して、What's Newに同期
    const allItems = listAll.querySelectorAll('li');
    listV2.innerHTML = '';
    
    const displayCount = Math.min(allItems.length, 5);
    for (let i = 0; i < displayCount; i++) {
        const clonedItem = allItems[i].cloneNode(true);
        // 最新3件にはNEWバッジを付与
        if (i < 3) {
            const linkDiv = clonedItem.querySelector('div');
            if (linkDiv && !linkDiv.querySelector('.new-badge')) {
                const badge = document.createElement('span');
                badge.textContent = 'NEW';
                badge.style.background = '#ef4444';
                badge.style.fontSize = '0.75rem';
                badge.style.padding = '0.1rem 0.4rem';
                badge.style.borderRadius = '4px';
                badge.style.marginLeft = '0.5rem';
                badge.style.fontWeight = 'bold';
                badge.className = 'new-badge';
                linkDiv.appendChild(badge);
            }
        }
        listV2.appendChild(clonedItem);
    }

    // 「更新履歴をすべて見る」ボタンがクリックされたら、最下部の全文履歴セクションを表示してスクロール
    viewAllBtn.addEventListener('click', (e) => {
        e.preventDefault();
        allUpdatesSection.style.display = 'block';
        allUpdatesSection.scrollIntoView({ behavior: 'smooth' });
        viewAllBtn.style.display = 'none'; // ボタンは非表示に
    });
}

// --- AIチャットダミー応答（V2用：外部通信無効化） ---
function initV2AIChat() {
    const widget = document.getElementById('ai-chat-widget');
    const trigger = document.getElementById('open-ai-chat');
    const closeBtn = document.getElementById('close-chat');
    const sendBtn = document.getElementById('send-btn');
    const input = document.getElementById('ai-input');
    const messagesArea = document.getElementById('ai-chat-messages');

    // UI要素が存在しない場合はスキップ
    if (!widget || !trigger) return;

    // 開閉制御
    trigger.addEventListener('click', () => widget.classList.toggle('active'));
    if (closeBtn) {
        closeBtn.addEventListener('click', () => widget.classList.remove('active'));
    }

    const appendV2Message = (role, text) => {
        if (!messagesArea) return;
        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.innerHTML = `<p>${text}</p>`;
        messagesArea.appendChild(div);
        messagesArea.scrollTop = messagesArea.scrollHeight;
        return div;
    };

    const handleV2Send = () => {
        const text = input.value.trim();
        if (!text) return;

        appendV2Message('user', text);
        input.value = '';

        const typingMsg = appendV2Message('system typing', 'モグボットが考え中...');

        // 外部通信を行わず、1秒後にダミー応答を返します
        setTimeout(() => {
            typingMsg.remove();
            appendV2Message('system', 'こちらはV2プレビュー版です。セキュア保護のためGemini APIによる外部AIチャット機能は無効化されています。実際のAI応答は現行版でお試しくださいクポ！');
        }, 1000);
    };

    if (sendBtn) {
        sendBtn.addEventListener('click', handleV2Send);
    }
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleV2Send();
        });
    }
}
