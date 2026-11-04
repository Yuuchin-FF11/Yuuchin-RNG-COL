// FFXI Bismarck - V2用共通コンポーネント & システム統合スクリプト
// ヘッダー、フッター、背景アニメーション等を管理します（プレビュー版のためログ送信・外部通信は無効化）

document.addEventListener('DOMContentLoaded', () => {
    const isEnglish = document.documentElement.lang === 'en';
    const isIndexPage = window.location.pathname.endsWith('index.html') || 
                        window.location.pathname.endsWith('index_en.html') || 
                        window.location.pathname.endsWith('/') || 
                        !window.location.pathname.includes('.html');

    // 1. 共通コンポーネントの動的注入
    injectComponents(isEnglish, isIndexPage);

    // 2. 背景パーティクル Canvas アニメーションの起動（prefers-reduced-motionに対応）
    if (document.getElementById('particle-canvas')) {
        initParticles();
    }

    // 3. モバイルメニューとBack to Topボタンの初期化
    initMobileMenu();
    initBackToTop();

    // 4. 管理者認証システムの起動（プレビュー版のためダミー動作）
    initAdminSystem();
});

// --- 共通 HTML テンプレート定義 ---
const headerHTMLJa = `
    <header class="glass-header">
        <div class="logo"><a href="index.html" style="color: inherit; text-decoration: none;">FFXI Bismarck</a></div>
        <nav class="desktop-nav">
            <ul>
                <li><a href="#reader-entrances">初心者・復帰</a></li>
                <li><a href="#equip-guides">狩人・コルセア装備</a></li>
                <li><a href="#content-guides">コンテンツ攻略</a></li>
                <li><a href="#useful-guides">金策・便利情報</a></li>
                <li><a href="連携シミュレーター/index.html">連携ツール</a></li>
                <li><a href="#stream-profile">配信・プロフィール</a></li>
            </ul>
        </nav>
        <div class="header-actions">
            <a href="https://x.com/TheManLei" target="_blank" class="header-social-link" aria-label="X (Twitter) リンク"><i class="fa-brands fa-x-twitter"></i></a>
            <a href="index_en.html" class="lang-btn" aria-label="English page"><i class="fa-solid fa-earth-americas"></i> English</a>
            <button class="menu-toggle" id="menu-toggle" aria-label="メニューを開く" aria-expanded="false" aria-controls="mobile-menu-overlay" style="min-width: 44px; min-height: 44px; padding: 10px; background: none; border: none;">
                <span></span>
                <span></span>
                <span></span>
            </button>
        </div>
    </header>
    <div class="mobile-menu-overlay" id="mobile-menu-overlay" aria-hidden="true" style="visibility: hidden; display: none;">
        <nav class="mobile-nav">
            <ul>
                <li><a href="#reader-entrances">初心者・復帰</a></li>
                <li><a href="#equip-guides">狩人・コルセア装備</a></li>
                <li><a href="#content-guides">コンテンツ攻略</a></li>
                <li><a href="#useful-guides">金策・便利情報</a></li>
                <li><a href="連携シミュレーター/index.html">連携ツール</a></li>
                <li><a href="#stream-profile">配信・プロフィール</a></li>
            </ul>
        </nav>
    </div>
`;

const headerHTMLEn = `
    <header class="glass-header">
        <div class="logo"><a href="index_en.html" style="color: inherit; text-decoration: none;">FFXI Bismarck</a></div>
        <nav class="desktop-nav">
            <ul>
                <li><a href="#reader-entrances">Beginners & Returners</a></li>
                <li><a href="#equip-guides">RNG & COR Equip</a></li>
                <li><a href="#content-guides">Content Guides</a></li>
                <li><a href="#useful-guides">Gil Farming & Info</a></li>
                <li><a href="連携シミュレーター/index.html">Skillchain Tool</a></li>
                <li><a href="#stream-profile">Stream & Profile</a></li>
            </ul>
        </nav>
        <div class="header-actions">
            <a href="https://x.com/TheManLei" target="_blank" class="header-social-link" aria-label="X (Twitter) link"><i class="fa-brands fa-x-twitter"></i></a>
            <a href="index.html" class="lang-btn" aria-label="日本語ページへ"><i class="fa-solid fa-earth-americas"></i> 日本語</a>
            <button class="menu-toggle" id="menu-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu-overlay" style="min-width: 44px; min-height: 44px; padding: 10px; background: none; border: none;">
                <span></span>
                <span></span>
                <span></span>
            </button>
        </div>
    </header>
    <div class="mobile-menu-overlay" id="mobile-menu-overlay" aria-hidden="true" style="visibility: hidden; display: none;">
        <nav class="mobile-nav">
            <ul>
                <li><a href="#reader-entrances">Beginners & Returners</a></li>
                <li><a href="#equip-guides">RNG & COR Equip</a></li>
                <li><a href="#content-guides">Content Guides</a></li>
                <li><a href="#useful-guides">Gil Farming & Info</a></li>
                <li><a href="連携シミュレーター/index.html">Skillchain Tool</a></li>
                <li><a href="#stream-profile">Stream & Profile</a></li>
            </ul>
        </nav>
    </div>
`;

const footerHTMLJa = `
    <footer class="glass-footer">
        <div class="footer-links-container">
            <h4 class="footer-heading">Official Link</h4>
            <div class="footer-links-grid">
                <a href="http://www.playonline.com/ff11/index.shtml" target="_blank" class="footer-link-card" aria-label="FF11公式サイトを開く">
                    <i class="fa-solid fa-house-chimney-window"></i>
                    <span>FF11公式サイト</span>
                </a>
                <a href="https://wiki.ffo.jp/" target="_blank" class="footer-link-card" aria-label="FF11用語辞典を開く">
                    <i class="fa-solid fa-book"></i>
                    <span>FF11用語辞典</span>
                </a>
            </div>
        </div>
        <p>&copy; 2026 Tarutaru Fan Site. Not affiliated with SQUARE ENIX.<span id="admin-trigger" style="opacity: 0.15; cursor: default; margin-left: 4px; font-size: 1.2rem; padding: 10px; display: inline-block; line-height: 1;">.</span></p>
        <p>FINAL FANTASY XI is a registered trademark of Square Enix Co., Ltd.</p>
        <p style="font-size: 0.8rem; opacity: 0.6; margin-top: 0.5rem;">※当サイトはAIアシスタントを活用して共同で作成しているため、情報に一部誤りや古い内容が含まれている可能性があります。最新の正確な仕様については、ゲーム内や公式用語辞典をあわせてご確認ください。</p>
        <p style="font-size: 0.8rem; color: #ffd700; margin-top: 0.5rem;">【V2プレビュー版】このページはデザイン改善検討用のプレビューV2版です。</p>
        <div class="social-links">
            <a href="https://x.com/TheManLei" target="_blank" title="X (Twitter)" aria-label="X (Twitter) リンク"><i class="fa-brands fa-x-twitter"></i></a>
            <a href="https://github.com/Yuuchin-FF11/Yuuchin-RNG-COL" target="_blank" title="GitHub" aria-label="GitHub リンク"><i class="fa-brands fa-github"></i></a>
        </div>
    </footer>
`;

const footerHTMLEn = `
    <footer class="glass-footer">
        <div class="footer-links-container">
            <h4 class="footer-heading">Official Links</h4>
            <div class="footer-links-grid">
                <a href="http://www.playonline.com/ff11us/index.shtml" target="_blank" class="footer-link-card" aria-label="Open FFXI Official Site">
                    <i class="fa-solid fa-house-chimney-window"></i>
                    <span>FF11 Official</span>
                </a>
                <a href="https://wiki.ffo.jp/" target="_blank" class="footer-link-card" aria-label="Open FFXI Wiki JP">
                    <i class="fa-solid fa-book"></i>
                    <span>FF11 Wiki (JP)</span>
                </a>
            </div>
        </div>
        <p>&copy; 2026 Tarutaru Fan Site. Not affiliated with SQUARE ENIX.<span id="admin-trigger" style="opacity: 0.15; cursor: default; margin-left: 4px; font-size: 1.2rem; padding: 10px; display: inline-block; line-height: 1;">.</span></p>
        <p>FINAL FANTASY XI is a registered trademark of Square Enix Co., Ltd.</p>
        <p style="font-size: 0.8rem; opacity: 0.6; margin-top: 0.5rem;">*This site is co-created with an AI assistant. Information may contain errors or outdated specs. Please cross-reference with official specs and the wiki.</p>
        <p style="font-size: 0.8rem; color: #ffd700; margin-top: 0.5rem;">[V2 Preview] This is the preview V2 page for design review purposes.</p>
        <div class="social-links">
            <a href="https://x.com/TheManLei" target="_blank" title="X (Twitter)" aria-label="X (Twitter) link"><i class="fa-brands fa-x-twitter"></i></a>
            <a href="https://github.com/Yuuchin-FF11/Yuuchin-RNG-COL" target="_blank" title="GitHub" aria-label="GitHub link"><i class="fa-brands fa-github"></i></a>
        </div>
    </footer>
`;

const passwordModalHTML = `
    <div id="admin-password-modal" class="admin-modal">
        <div class="admin-modal-content">
            <button class="admin-modal-close" id="password-modal-close" aria-label="モーダルを閉じる">&times;</button>
            <h3 class="admin-modal-title"><i class="fa-solid fa-lock"></i> 管理者認証</h3>
            <p class="admin-modal-desc">プレビューV2版では管理者ダッシュボード機能は無効化されています。</p>
            <p class="admin-error-text" style="color: #ffd700; display: block; margin-top: 1rem;">セキュア保護のため、V2プレビュー版でのアクセスログGAS送信および管理者パスワードの検証通信は行われません。</p>
        </div>
    </div>
`;

// --- コンポーネント注入ロジック ---
function injectComponents(isEnglish, isIndexPage) {
    const headerContainer = document.getElementById('common-header');
    const footerContainer = document.getElementById('common-footer');
    const modalsContainer = document.getElementById('common-modals');

    // 1. ヘッダーのはめ込み & リンク自動解決
    if (headerContainer) {
        let headerHTML = isEnglish ? headerHTMLEn : headerHTMLJa;
        if (!isIndexPage) {
            // トップページ以外の場合はアンカーリンク（#home等）の前に index.html を自動で付与
            const targetIndex = isEnglish ? 'index_en.html' : 'index.html';
            // 連携シミュレーター/index.html へのパス調整
            headerHTML = headerHTML.replace(/href="連携シミュレーター\/index\.html"/g, 'href="../連携シミュレーター/index.html"');
            headerHTML = headerHTML.replace(/href="#([^"]+)"/g, `href="${targetIndex}#$1"`);
        }
        headerContainer.innerHTML = headerHTML;
    }

    // 2. フッターのはめ込み
    if (footerContainer) {
        let footerHTML = isEnglish ? footerHTMLEn : footerHTMLJa;
        if (!isIndexPage) {
            // トップページ以外の場合はパスを調整
            footerHTML = footerHTML.replace(/href="連携シミュレーター\/index\.html"/g, 'href="../連携シミュレーター/index.html"');
        }
        footerContainer.innerHTML = footerHTML;
    }

    // 3. モーダルのはめ込み
    if (modalsContainer) {
        modalsContainer.innerHTML = passwordModalHTML;
    }
}

// --- 背景パーティクル描画エンジン ---
function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    
    // prefers-reduced-motionの確認
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
        console.log("Reduced motion detected. Background particle animation stopped.");
        return;
    }

    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    const colors = ['#2e8b57', '#1a237e', '#ffd700', '#ffffff'];

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
    }

    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.size = Math.random() * 3;
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.opacity = Math.random() * 0.5 + 0.1;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < 0) this.x = width;
            if (this.x > width) this.x = 0;
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;

            this.opacity += (Math.random() - 0.5) * 0.02;
            if (this.opacity < 0.1) this.opacity = 0.1;
            if (this.opacity > 0.8) this.opacity = 0.8;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.opacity * 0.25;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.opacity;
            ctx.fill();

            ctx.globalAlpha = 1;
        }
    }

    function init() {
        resize();
        for (let i = 0; i < 60; i++) { // パーティクル数を少し減らしてパフォーマンス向上
            particles.push(new Particle());
        }
    }

    let animationFrameId;
    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        animationFrameId = requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    init();
    animate();
}

// --- モバイルメニュー制御 ---
function initMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const menuOverlay = document.getElementById('mobile-menu-overlay');

    if (!menuToggle || !menuOverlay) return;

    // 開閉処理を一元化
    function toggleMenu(forceState) {
        const isCurrentlyExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
        const shouldExpand = (forceState !== undefined) ? forceState : !isCurrentlyExpanded;

        if (shouldExpand) {
            menuToggle.classList.add('active');
            menuToggle.setAttribute('aria-expanded', 'true');
            menuToggle.setAttribute('aria-label', 'メニューを閉じる');
            
            // 支援技術からの非表示を解除
            menuOverlay.style.display = 'flex';
            menuOverlay.style.visibility = 'visible';
            menuOverlay.setAttribute('aria-hidden', 'false');
            
            // アニメーション用の遅延クラス適用
            setTimeout(() => {
                menuOverlay.classList.add('active');
            }, 10);
            
            document.body.style.overflow = 'hidden';
            
            // キーボードフォーカスをオーバーレイの先頭要素に向ける
            const firstLink = menuOverlay.querySelector('a');
            if (firstLink) firstLink.focus();
        } else {
            menuToggle.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
            menuToggle.setAttribute('aria-label', 'メニューを開く');
            
            menuOverlay.classList.remove('active');
            document.body.style.overflow = '';
            
            // アニメーション完了後に要素を隠す
            setTimeout(() => {
                if (menuToggle.getAttribute('aria-expanded') === 'false') {
                    menuOverlay.style.display = 'none';
                    menuOverlay.style.visibility = 'hidden';
                    menuOverlay.setAttribute('aria-hidden', 'true');
                }
            }, 500);
        }
    }

    // イベントリスナーの追加（一か所のみ）
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    // メニュー内のリンクをクリックした時、メニューを自動で閉じる
    menuOverlay.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            toggleMenu(false);
        });
    });

    // Escapeキー押下でメニューを閉じる
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
            toggleMenu(false);
            menuToggle.focus();
        }
    });

    // メニュー外クリックで閉じる
    window.addEventListener('click', (e) => {
        if (menuToggle.getAttribute('aria-expanded') === 'true' && 
            !menuOverlay.contains(e.target) && 
            !menuToggle.contains(e.target)) {
            toggleMenu(false);
        }
    });
}

// --- ページトップへ戻るボタン ---
function initBackToTop() {
    const backToTopBtn = document.getElementById('fixed-back-to-top');
    if (!backToTopBtn) return;

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset || document.documentElement.scrollTop;
        if (scrolled > 400) {
            backToTopBtn.classList.add('visible');
            backToTopBtn.style.opacity = '1';
            backToTopBtn.style.visibility = 'visible';
            backToTopBtn.style.transform = 'translateY(0)';
        } else {
            backToTopBtn.classList.remove('visible');
            backToTopBtn.style.opacity = '0';
            backToTopBtn.style.visibility = 'hidden';
            backToTopBtn.style.transform = 'translateY(20px)';
        }
    }, {
        passive: true
    });

    backToTopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// --- 管理者認証（V2プレビュー用ダミー仕様） ---
function initAdminSystem() {
    const trigger = document.getElementById('admin-trigger');
    const passwordModal = document.getElementById('admin-password-modal');
    const passwordClose = document.getElementById('password-modal-close');

    if (!trigger || !passwordModal) return;

    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        passwordModal.classList.add('active');
    });

    if (passwordClose) {
        passwordClose.addEventListener('click', () => {
            passwordModal.classList.remove('active');
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
            passwordModal.classList.remove('active');
        }
    });
}
