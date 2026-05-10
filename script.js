document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initAIChat();
    loadDiaryEntries();
    initMobileMenu();
    initBackToTop();


    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
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
import { GoogleGenerativeAI } from "@google/generative-ai";

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
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.opacity;
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
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

async function loadDiaryEntries() {
    const container = document.getElementById('diary-timeline-container');
    if (!container) return;
    
    try {
        const response = await fetch('articles/diary.json');
        if (!response.ok) throw new Error('Failed to load diary entries');
        
        const entries = await response.json();
        container.innerHTML = ''; // Clear loading spinner
        
        entries.forEach((entry, index) => {
            const delayClass = `delay-${(index % 3) + 1}`;
            const tagsHtml = entry.tags.map(tag => `<span>#${tag}</span>`).join('');
            const linkHtml = entry.markdownFile ? `<div style="margin-top: 1rem;"><a href="article.html?file=${entry.markdownFile}" class="job-link">詳細を読む <i class="fa-solid fa-arrow-right"></i></a></div>` : '';
            
            const cardHtml = `
                <div class="diary-card glass-card fade-in-up ${delayClass}">
                    <div class="diary-date">${entry.date}</div>
                    <div class="diary-content">
                        <div class="diary-image-container">
                            <img src="${entry.image}" alt="${entry.title}" onerror="this.src='assets/images/hunter_image.jpg'">
                        </div>
                        <div class="diary-text">
                            <h3>${entry.title}</h3>
                            <p>${entry.content}</p>
                            ${linkHtml}
                            <div class="diary-tags">
                                ${tagsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML += cardHtml;
        });
        
        // Setup intersection observer for new cards
        const observer = new IntersectionObserver((observerEntries) => {
            observerEntries.forEach(observerEntry => {
                if (observerEntry.isIntersecting) {
                    observerEntry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });
        
        container.querySelectorAll('.glass-card').forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
            observer.observe(card);
        });
        
    } catch (error) {
        console.error(error);
        container.innerHTML = `<div style="text-align: center; color: #ff6b6b;"><p>日記の読み込みに失敗しました。</p></div>`;
    }
}

function initBackToTop() {
    const backToTopBtn = document.getElementById('back-to-top');
    if (!backToTopBtn) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

