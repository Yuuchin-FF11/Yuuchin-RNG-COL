// FFXI Bismarck - 共通コンポーネント & システム統合スクリプト
// ヘッダー、フッター、背景アニメーションを一括管理します

window.__commonComponentsLoaded = true;
document.addEventListener('DOMContentLoaded', () => {
    const isEnglish = document.documentElement.lang === 'en';
    const isIndexPage = window.location.pathname.endsWith('index.html') || 
                        window.location.pathname.endsWith('index_en.html') || 
                        window.location.pathname.endsWith('/') || 
                        !window.location.pathname.includes('.html');

    // 1. 共通コンポーネントの動的注入
    injectComponents(isEnglish, isIndexPage);

    // 2. 背景パーティクル Canvas アニメーションの起動
    if (document.getElementById('particle-canvas')) {
        initParticles();
    }

    // 3. モバイルメニューとBack to Topボタンの初期化
    initMobileMenu();
    initBackToTop();
});

// --- 共通 HTML テンプレート定義 ---
const headerHTMLJa = `
    <header class="glass-header">
        <div class="logo">FFXI Bismarck</div>
        <nav class="desktop-nav">
            <ul>
                <li><a href="#home">ホーム</a></li>
                <li><a href="#about">スタイル</a></li>
                <li><a href="#jobs">メインジョブ</a></li>
                <li><a href="#guides">攻略情報</a></li>
                <li><a href="#useful-guides">お役立ち情報</a></li>
                <li><a href="#stream">ライブ配信</a></li>
                <li><a href="#life">ヴァナ生活</a></li>
            </ul>
        </nav>
        <div class="header-actions">
            <a href="https://x.com/TheManLei" target="_blank" class="header-social-link" title="X (Twitter)"><i class="fa-brands fa-x-twitter"></i></a>
            <a href="index_en.html" class="lang-btn"><i class="fa-solid fa-earth-americas"></i> English</a>
            <div class="menu-toggle" id="menu-toggle">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    </header>
    <div class="mobile-menu-overlay" id="mobile-menu-overlay">
        <nav class="mobile-nav">
            <ul>
                <li><a href="#home">ホーム</a></li>
                <li><a href="#about">スタイル</a></li>
                <li><a href="#jobs">メインジョブ</a></li>
                <li><a href="#guides">攻略情報</a></li>
                <li><a href="#useful-guides">お役立ち情報</a></li>
                <li><a href="#stream">ライブ配信</a></li>
                <li><a href="#life">ヴァナ生活</a></li>
            </ul>
        </nav>
    </div>
`;

const headerHTMLEn = `
    <header class="glass-header">
        <div class="logo">FFXI Bismarck</div>
        <nav class="desktop-nav">
            <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#about">Style</a></li>
                <li><a href="#jobs">Jobs</a></li>
                <li><a href="#guides">Guides</a></li>
                <li><a href="#useful-guides">Useful Guides</a></li>
                <li><a href="#stream">Stream</a></li>
                <li><a href="#life">Vana'diel Life</a></li>
            </ul>
        </nav>
        <div class="header-actions">
            <a href="https://x.com/TheManLei" target="_blank" class="header-social-link" title="X (Twitter)"><i class="fa-brands fa-x-twitter"></i></a>
            <a href="index.html" class="lang-btn"><i class="fa-solid fa-earth-americas"></i> 日本語</a>
            <div class="menu-toggle" id="menu-toggle">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    </header>
    <div class="mobile-menu-overlay" id="mobile-menu-overlay">
        <nav class="mobile-nav">
            <ul>
                <li><a href="#home">Home</a></li>
                <li><a href="#about">Style</a></li>
                <li><a href="#jobs">Jobs</a></li>
                <li><a href="#guides">Guides</a></li>
                <li><a href="#useful-guides">Useful Guides</a></li>
                <li><a href="#stream">Stream</a></li>
                <li><a href="#life">Vana'diel Life</a></li>
            </ul>
        </nav>
    </div>
`;

const footerHTMLJa = `
    <footer class="glass-footer">
        <div class="footer-links-container">
            <h4 class="footer-heading">Official Link</h4>
            <div class="footer-links-grid">
                <a href="http://www.playonline.com/ff11/index.shtml" target="_blank" class="footer-link-card">
                    <i class="fa-solid fa-house-chimney-window"></i>
                    <span>FF11公式サイト</span>
                </a>
                <a href="https://wiki.ffo.jp/" target="_blank" class="footer-link-card">
                    <i class="fa-solid fa-book"></i>
                    <span>FF11用語辞典</span>
                </a>
            </div>
        </div>
        <p>&copy; 2026 Tarutaru Fan Site. Not affiliated with SQUARE ENIX.</p>
        <p>FINAL FANTASY XI is a registered trademark of Square Enix Co., Ltd.</p>
        <p style="font-size: 0.8rem; opacity: 0.6; margin-top: 0.5rem;">※当サイトはAIアシスタントを活用して共同で作成しているため、情報に一部誤りや古い内容が含まれている可能性があります。最新の正確な仕様については、ゲーム内や公式用語辞典をあわせてご確認ください。</p>
        <div class="social-links">
            <a href="https://x.com/TheManLei" target="_blank" title="X (Twitter)"><i class="fa-brands fa-x-twitter"></i></a>
            <a href="https://github.com/Yuuchin-FF11/Yuuchin-RNG-COL" target="_blank" title="GitHub"><i class="fa-brands fa-github"></i></a>
        </div>
    </footer>
`;

const footerHTMLEn = `
    <footer class="glass-footer">
        <div class="footer-links-container">
            <h4 class="footer-heading">Official Links</h4>
            <div class="footer-links-grid">
                <a href="http://www.playonline.com/ff11us/index.shtml" target="_blank" class="footer-link-card">
                    <i class="fa-solid fa-house-chimney-window"></i>
                    <span>FF11 Official</span>
                </a>
                <a href="https://wiki.ffo.jp/" target="_blank" class="footer-link-card">
                    <i class="fa-solid fa-book"></i>
                    <span>FF11 Wiki (JP)</span>
                </a>
            </div>
        </div>
        <p>&copy; 2026 Tarutaru Fan Site. Not affiliated with SQUARE ENIX.</p>
        <p>FINAL FANTASY XI is a registered trademark of Square Enix Co., Ltd.</p>
        <p style="font-size: 0.8rem; opacity: 0.6; margin-top: 0.5rem;">*This site is co-created with an AI assistant. Information may contain errors or outdated specs. Please cross-reference with official specs and the wiki.</p>
        <div class="social-links">
            <a href="https://x.com/TheManLei" target="_blank" title="X (Twitter)"><i class="fa-brands fa-x-twitter"></i></a>
            <a href="https://github.com/Yuuchin-FF11/Yuuchin-RNG-COL" target="_blank" title="GitHub"><i class="fa-brands fa-github"></i></a>
        </div>
    </footer>
`;

// --- コンポーネント注入ロジック ---
function injectComponents(isEnglish, isIndexPage) {
    const headerContainer = document.getElementById('common-header');
    const footerContainer = document.getElementById('common-footer');

    // 1. ヘッダーのはめ込み & リンク自動解決 (ダブルクリック/記事ページ対応)
    if (headerContainer) {
        let headerHTML = isEnglish ? headerHTMLEn : headerHTMLJa;
        if (!isIndexPage) {
            // トップページ以外の場合はアンカーリンク（#home等）の前に index.html を自動で付与
            const targetIndex = isEnglish ? 'index_en.html' : 'index.html';
            headerHTML = headerHTML.replace(/href="#([^"]+)"/g, `href="${targetIndex}#$1"`);
        } else {
            // トップページの場合は言語切り替えボタンのパスをそのまま維持
        }
        headerContainer.innerHTML = headerHTML;
    }

    // 2. フッターのはめ込み
    if (footerContainer) {
        const footerHTML = isEnglish ? footerHTMLEn : footerHTMLJa;
        footerContainer.innerHTML = footerHTML;
    }
}

// --- 背景パーティクル描画エンジン ---
function initParticles() {
    const canvas = document.getElementById('particle-canvas');
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
        for (let i = 0; i < 100; i++) {
            particles.push(new Particle());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    init();
    animate();
}

// --- モバイルメニュー制御 ---
function initMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const menuOverlay = document.getElementById('mobile-menu-overlay');

    if (menuToggle && menuOverlay) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            menuOverlay.classList.toggle('active');
            
            if (menuOverlay.classList.contains('active')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        });
    }
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

// --- GAS 閲覧履歴送信 & 管理者システム ---
