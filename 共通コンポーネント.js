// FFXI Bismarck - 共通コンポーネント & システム統合スクリプト
// ヘッダー、フッター、背景アニメーション、GAS閲覧ログ、管理者ダッシュボードを一括管理します🐾

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

    // 4. GAS 閲覧履歴送信 & 管理者認証システムの起動
    logAccess();
    initAdminSystem();
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
        <p>&copy; 2026 Tarutaru Fan Site. Not affiliated with SQUARE ENIX.<span id="admin-trigger" style="opacity: 0.15; cursor: default; margin-left: 4px; font-size: 1.2rem; padding: 10px; display: inline-block; line-height: 1;">.</span></p>
        <p>FINAL FANTASY XI is a registered trademark of Square Enix Co., Ltd.</p>
        <p class="privacy-notice">このサイトでは、サイト改善とアクセス状況の把握のため、訪問時にURL・参照元・ブラウザ情報・言語・画面サイズをGoogle Apps Scriptへ送信します。管理者認証時のパスワードはURLに含めず、POSTで送信します。収集した情報はアクセスログ管理の目的に限って利用します。</p>
        <p style="font-size: 0.8rem; opacity: 0.6; margin-top: 0.5rem;">※当サイトはAIアシスタントを活用して共同で作成しているため、情報に一部誤りや古い内容が含まれている可能性があります。最新の正確な仕様については、ゲーム内や公式用語辞典をあわせてご確認ください。</p>
        <div class="social-links">
            <a href="https://x.com/TheManLei" target="_blank" title="X (Twitter)"><i class="fa-brands fa-x-twitter"></i></a>
            <a href="https://github.com/Yuuchin-FF11/Yuuchin-RNG-COL" target="_blank" title="GitHub"><i class="fa-brands fa-github"></i></a>
            <div style="margin-top: 1.5rem; display: flex; flex-direction: column; align-items: center;">
                <span class="visitor-label">累計訪問者数</span>
                <img src="https://visitor-badge.laobi.icu/badge?page_id=Yuuchin-FF11.Yuuchin-RNG-COL" alt="Visitor Count">
            </div>
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
        <p>&copy; 2026 Tarutaru Fan Site. Not affiliated with SQUARE ENIX.<span id="admin-trigger" style="opacity: 0.15; cursor: default; margin-left: 4px; font-size: 1.2rem; padding: 10px; display: inline-block; line-height: 1;">.</span></p>
        <p>FINAL FANTASY XI is a registered trademark of Square Enix Co., Ltd.</p>
        <p class="privacy-notice">For site improvement and traffic analysis, this site sends the page URL, referrer, browser information, language, and screen size to Google Apps Script. Administrator passwords are sent by POST and are never included in the URL. Collected data is used only for access-log management.</p>
        <p style="font-size: 0.8rem; opacity: 0.6; margin-top: 0.5rem;">*This site is co-created with an AI assistant. Information may contain errors or outdated specs. Please cross-reference with official specs and the wiki.</p>
        <div class="social-links">
            <a href="https://x.com/TheManLei" target="_blank" title="X (Twitter)"><i class="fa-brands fa-x-twitter"></i></a>
            <a href="https://github.com/Yuuchin-FF11/Yuuchin-RNG-COL" target="_blank" title="GitHub"><i class="fa-brands fa-github"></i></a>
            <div style="margin-top: 1.5rem; display: flex; flex-direction: column; align-items: center;">
                <span class="visitor-label">Visitor Count</span>
                <img src="https://visitor-badge.laobi.icu/badge?page_id=Yuuchin-FF11.Yuuchin-RNG-COL" alt="Visitor Count">
            </div>
        </div>
    </footer>
`;

const passwordModalHTML = `
    <div id="admin-password-modal" class="admin-modal">
        <div class="admin-modal-content">
            <button class="admin-modal-close" id="password-modal-close">&times;</button>
            <h3 class="admin-modal-title"><i class="fa-solid fa-lock"></i> 管理者認証</h3>
            <p class="admin-modal-desc">閲覧履歴を表示するには、秘密のパスワードを入力してください。</p>
            <form id="admin-password-form">
                <input type="password" id="admin-password-input" class="admin-input" placeholder="パスワードを入力..." required autofocus>
                <button type="submit" class="admin-btn">認証する</button>
            </form>
            <p id="password-error-msg" class="admin-error-text" style="display: none;"></p>
        </div>
    </div>
`;

const dashboardModalHTML = `
    <div id="admin-dashboard-modal" class="admin-modal">
        <div class="admin-modal-content dashboard-content">
            <button class="admin-modal-close" id="dashboard-modal-close">&times;</button>
            <div class="dashboard-header">
                <h3 class="admin-modal-title"><i class="fa-solid fa-chart-line"></i> 閲覧履歴ダッシュボード</h3>
                <button id="admin-refresh-btn" class="admin-btn-secondary"><i class="fa-solid fa-rotate"></i> 更新</button>
            </div>
            <p class="admin-modal-desc">直近100件のアクセスログを表示しています。</p>
            <div class="dashboard-table-container">
                <table class="dashboard-table">
                    <thead>
                        <tr>
                            <th>日時</th>
                            <th>アクセスしたページ</th>
                            <th>リンク元 (リファラ)</th>
                            <th>ブラウザ/OS</th>
                            <th>言語</th>
                            <th>画面サイズ</th>
                        </tr>
                    </thead>
                    <tbody id="dashboard-table-body"></tbody>
                </table>
                <div id="dashboard-loading" class="dashboard-loading">
                    <i class="fa-solid fa-circle-notch fa-spin"></i> データを取得中...
                </div>
                <div id="dashboard-empty" class="dashboard-empty" style="display: none;">
                    閲覧履歴データがまだありません。
                </div>
            </div>
        </div>
    </div>
`;

// --- コンポーネント注入ロジック ---
function injectComponents(isEnglish, isIndexPage) {
    const headerContainer = document.getElementById('common-header');
    const footerContainer = document.getElementById('common-footer');
    const modalsContainer = document.getElementById('common-modals');

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

    // 3. モーダルのはめ込み
    if (modalsContainer) {
        modalsContainer.innerHTML = passwordModalHTML + dashboardModalHTML;
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
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzVIwoOsi-U6Iw5A_KHoWhyRIVHfbO6C_UDzPXWhGHrNIeiVUSsn5md2I18iDPCe5U8qA/exec";

async function logAccess() {
    try {
        const payload = {
            action: 'log',
            pageTitle: document.title,
            pageUrl: window.location.href,
            referrer: document.referrer || "直接入力/ブックマーク",
            userAgent: navigator.userAgent,
            language: navigator.language,
            screenResolution: `${window.screen.width}x${window.screen.height}`
        };

        await fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.warn("Logger connection skipped:", error);
    }
}

function initAdminSystem() {
    const trigger = document.getElementById('admin-trigger');
    const passwordModal = document.getElementById('admin-password-modal');
    const dashboardModal = document.getElementById('admin-dashboard-modal');
    
    const passwordClose = document.getElementById('password-modal-close');
    const dashboardClose = document.getElementById('dashboard-modal-close');
    
    const passwordForm = document.getElementById('admin-password-form');
    const passwordInput = document.getElementById('admin-password-input');
    const errorMsg = document.getElementById('password-error-msg');
    
    const refreshBtn = document.getElementById('admin-refresh-btn');
    const tableBody = document.getElementById('dashboard-table-body');
    const loadingDiv = document.getElementById('dashboard-loading');
    const emptyDiv = document.getElementById('dashboard-empty');

    if (!trigger || !passwordModal || !dashboardModal) return;

    let savedPassword = '';

    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        passwordInput.value = '';
        errorMsg.style.display = 'none';
        passwordModal.classList.add('active');
        passwordInput.focus();
    });

    passwordClose.addEventListener('click', () => {
        passwordModal.classList.remove('active');
    });

    dashboardClose.addEventListener('click', () => {
        dashboardModal.classList.remove('active');
    });

    window.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
            passwordModal.classList.remove('active');
        }
        if (e.target === dashboardModal) {
            dashboardModal.classList.remove('active');
        }
    });

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = passwordInput.value.trim();
        if (!password) return;

        errorMsg.style.display = 'none';
        passwordInput.disabled = true;
        const submitBtn = passwordForm.querySelector('button[type="submit"]');
        const origBtnText = submitBtn.textContent;
        submitBtn.textContent = '認証中...';
        submitBtn.disabled = true;

        try {
            const result = await fetchHistory(password);
            
            if (result.status === 'success') {
                savedPassword = password;
                passwordModal.classList.remove('active');
                dashboardModal.classList.add('active');
                renderDashboard(result.data);
            } else {
                errorMsg.textContent = result.message || 'パスワードが正しくありません。';
                errorMsg.style.display = 'block';
            }
        } catch (err) {
            errorMsg.textContent = 'サーバーとの通信に失敗しました。';
            errorMsg.style.display = 'block';
        } finally {
            passwordInput.disabled = false;
            submitBtn.textContent = origBtnText;
            submitBtn.disabled = false;
        }
    });

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            if (!savedPassword) return;
            tableBody.innerHTML = '';
            loadingDiv.style.display = 'block';
            emptyDiv.style.display = 'none';

            try {
                const result = await fetchHistory(savedPassword);
                if (result.status === 'success') {
                    renderDashboard(result.data);
                } else {
                    alert('セッションが切れました。再度パスワードを入力してください。');
                    dashboardModal.classList.remove('active');
                }
            } catch (err) {
                alert('データの取得に失敗しました。');
            }
        });
    }

    async function fetchHistory(password) {
        const response = await fetch(GAS_API_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'get_history', password })
        });

        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    }

    function renderDashboard(data) {
        loadingDiv.style.display = 'none';
        tableBody.innerHTML = '';

        if (!data || data.length === 0) {
            emptyDiv.style.display = 'block';
            return;
        }

        emptyDiv.style.display = 'none';
        data.forEach(row => {
            const tr = document.createElement('tr');
            
            const ua = row['使用ブラウザ/OS'] || '不明';
            let simpleUA = 'その他';
            if (ua.includes('iPhone')) simpleUA = 'iPhone';
            else if (ua.includes('Android')) simpleUA = 'Android';
            else if (ua.includes('Windows')) simpleUA = 'Windows';
            else if (ua.includes('Macintosh')) simpleUA = 'Mac';
            
            if (ua.includes('Firefox')) simpleUA += ' (Firefox)';
            else if (ua.includes('Chrome')) simpleUA += ' (Chrome)';
            else if (ua.includes('Safari')) simpleUA += ' (Safari)';
            else if (ua.includes('Edge')) simpleUA += ' (Edge)';

            tr.innerHTML = `
                <td><strong>${row['日時'] || '不明'}</strong></td>
                <td><span style="color: var(--accent-color);">${row['アクセスしたページ'] || '不明'}</span></td>
                <td><span style="font-size: 0.85rem; opacity: 0.8;">${row['リンク元 (リファラ)'] || '直接入力'}</span></td>
                <td><span title="${ua}">${simpleUA}</span></td>
                <td>${row['使用言語'] || '不明'}</td>
                <td><span style="font-family: monospace;">${row['画面サイズ'] || '不明'}</span></td>
            `;
            tableBody.appendChild(tr);
        });
    }
}
