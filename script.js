document.addEventListener('DOMContentLoaded', () => {
    initBackToTop();
    initParticles();
    initAIChat();

    initMobileMenu();


    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            
            if (href === '#') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
            
            // Close mobile menu if open
            const menuOverlay = document.getElementById('mobile-menu-overlay');
            const menuToggle = document.getElementById('menu-toggle');
            if (menuOverlay && menuOverlay.classList.contains('active')) {
                menuOverlay.classList.remove('active');
                menuToggle.classList.remove('active');
                document.body.style.overflow = ''; // Re-enable scroll
            }
        });
    });

    // Simple intersection observer for scroll animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.glass-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(card);
    });

    // Apply animation when visible
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        .glass-card.visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(styleSheet);

    // 管理者用ロガーおよびシステムの初期化
    logAccess();
    initAdminSystem();
});

function initMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const menuOverlay = document.getElementById('mobile-menu-overlay');

    if (menuToggle && menuOverlay) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            menuOverlay.classList.toggle('active');
            
            // Prevent scrolling when menu is open
            if (menuOverlay.classList.contains('active')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        });
    }
}

// --- Gemini AI Chat Logic ---
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

let genAI = null;
let model = null;
let chatSession = null;

function initAIChat() {
    const widget = document.getElementById('ai-chat-widget');
    const trigger = document.getElementById('open-ai-chat');
    const closeBtn = document.getElementById('close-chat');
    const sendBtn = document.getElementById('send-btn');
    const input = document.getElementById('ai-input');
    const messagesArea = document.getElementById('ai-chat-messages');

    const apiOverlay = document.getElementById('api-key-setup');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveKeyBtn = document.getElementById('save-key-btn');

    // If critical elements are missing, don't initialize the chat
    if (!widget || !trigger) {
        console.log("AI Chat widget not found. Skipping initialization.");
        return;
    }

    // Toggle Chat
    trigger.addEventListener('click', () => widget.classList.toggle('active'));
    if (closeBtn) closeBtn.addEventListener('click', () => widget.classList.remove('active'));

    // Check for saved API Key
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey && apiOverlay) {
        setupAI(savedKey);
        apiOverlay.style.display = 'none';
    }

    // Save API Key
    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('gemini_api_key', key);
            setupAI(key);
            apiOverlay.style.display = 'none';
        }
    });

    // Send message
    const handleSend = async () => {
        const text = input.value.trim();
        if (!text || !chatSession) return;

        appendMessage('user', text);
        input.value = '';

        const typingMsg = appendMessage('system typing', '考え中...');

        try {
            const result = await chatSession.sendMessage(text);
            const response = await result.response;
            typingMsg.remove();
            appendMessage('system', response.text());
        } catch (error) {
            console.error(error);
            typingMsg.textContent = 'エラーが発生しました。APIキーを確認してください。';
        }
    };

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });
}

function setupAI(apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: "あなたは『ファイナルファンタジーXI (FF11)』の世界『ヴァナ・ディール』に住むガイドの『モグボット』です。FF11に関する豊富な知識（特に狩人とコルセアのジョブ、装備、RMEAP、ジェールなどのエンドコンテンツ）を持っており、ユーザーに親身にアドバイスします。回答は簡潔かつ丁寧な日本語で行ってください。語尾に『クポ』は付けないでください。"
    });
    chatSession = model.startChat({
        history: [],
        generationConfig: {
            maxOutputTokens: 500,
        },
    });
}

function appendMessage(role, text) {
    const area = document.getElementById('ai-chat-messages');
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = `<p>${text}</p>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
    return div;
}

function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');

    let width, height;
    let particles = [];

    // Hunter & Corsair Palette (Green, Navy Blue, Gold, White)
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
            this.life = Math.random() * 100;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Wrap around screen
            if (this.x < 0) this.x = width;
            if (this.x > width) this.x = 0;
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;

            // Pulse opacity
            this.opacity += (Math.random() - 0.5) * 0.02;
            if (this.opacity < 0.1) this.opacity = 0.1;
            if (this.opacity > 0.8) this.opacity = 0.8;
        }

        draw() {
            // 1. 外側のぼんやりした柔らかな光彩（大きめで極めて薄い円）を低負荷で描画
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.opacity * 0.25;
            ctx.fill();

            // 2. 内側のくっきりした粒子コアを描画
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.opacity;
            ctx.fill();

            ctx.globalAlpha = 1; // アルファ値を安全にリセット
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

// --- 管理者専用・アクセス履歴閲覧システム ---
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbx3tcuuAdd0KlOq35qv1lPbqUx3kI064F2_VBohfRdg9OZUYUwT-q6tdqgiPfe-K3dCQw/exec";

/**
 * ページ訪問時のアクセスログを非同期で送信
 */
async function logAccess() {
    try {
        const params = new URLSearchParams({
            action: 'log',
            pageTitle: document.title,
            pageUrl: window.location.href,
            referrer: document.referrer || "直接入力/ブックマーク",
            userAgent: navigator.userAgent,
            language: navigator.language,
            screenResolution: `${window.screen.width}x${window.screen.height}`
        });

        // GETリクエストでログを送信（プレフライトを回避し、CORSエラーを完全に防ぐ）
        await fetch(`${GAS_API_URL}?${params.toString()}`, {
            method: 'GET',
            mode: 'cors'
        });
    } catch (error) {
        // メインサイトの表示や機能に一切影響を与えないよう、エラーは静かに無視します
        console.warn("Logger connection skipped:", error);
    }
}

/**
 * 管理者システムの初期化（モーダル操作、パスワード送信など）
 */
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

    let savedPassword = ''; // セッション内でのパスワード一時保持

    // 隠しトリガーをクリックした時
    trigger.addEventListener('click', (e) => {
        e.preventDefault();
        passwordInput.value = '';
        errorMsg.style.display = 'none';
        passwordModal.classList.add('active');
        passwordInput.focus();
    });

    // 閉じるボタン
    passwordClose.addEventListener('click', () => {
        passwordModal.classList.remove('active');
    });

    dashboardClose.addEventListener('click', () => {
        dashboardModal.classList.remove('active');
    });

    // モーダルの外側をクリックしたら閉じる
    window.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
            passwordModal.classList.remove('active');
        }
        if (e.target === dashboardModal) {
            dashboardModal.classList.remove('active');
        }
    });

    // パスワード送信時
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
                savedPassword = password; // 成功したパスワードを保持
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

    // 更新ボタン押下時
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

    /**
     * GASから閲覧履歴データを取得
     */
    async function fetchHistory(password) {
        const params = new URLSearchParams({
            action: 'get_history',
            password: password
        });

        const response = await fetch(`${GAS_API_URL}?${params.toString()}`, {
            method: 'GET',
            mode: 'cors'
        });

        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    }

    /**
     * ダッシュボードテーブルを描画
     */
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
            
            // 簡素化されたOS/ブラウザ判定 (長いUAをすっきりさせる)
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

