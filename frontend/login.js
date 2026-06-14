import { createIcons, Globe, ChevronDown } from 'lucide';
import vi from './locales/vi.json';
import en from './locales/en.json';

const TRANSLATIONS = { vi, en };
const LANGUAGE_KEY = 'dc_chat_language';

// Render icons
createIcons({
    icons: {
        Globe,
        ChevronDown
    }
});

const loginForm = document.getElementById('loginForm');
const loginPasswordField = document.getElementById('loginPasswordField');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const languageSelect = document.getElementById('languageSelect');

let turnstileSiteKey = null;
let turnstileWidgetId = null;

// Custom Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon"></div>
        <div class="toast-message">${escapeHtml(message)}</div>
    `;
    container.appendChild(toast);
    toast.offsetHeight; // Force reflow
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, 4000);
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function applyLanguage() {
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const t = TRANSLATIONS[lang];

    document.title = t.loginPageTitle || "Unlock - DC AI API Portal";
    
    const titleEl = document.getElementById('lblUnlockTitle');
    if (titleEl) titleEl.textContent = t.loginPageTitle || "Unlock - DC AI API Portal";

    const portalEl = document.getElementById('lblPortalTitle');
    if (portalEl) portalEl.textContent = t.adminPortalTitle || "DC AI API Portal";

    const lockedEl = document.getElementById('lblLockedMessage');
    if (lockedEl) lockedEl.textContent = t.loginLockedMessage || "This console is locked. Please enter your administrator password to gain access.";

    if (loginPasswordField) {
        loginPasswordField.placeholder = t.loginPlaceholder || "Admin token/password...";
    }

    const unlockBtn = document.getElementById('lblUnlockButton');
    if (unlockBtn) unlockBtn.textContent = t.loginButton || "Unlock Portal";

    if (loginErrorMsg && loginErrorMsg.style.display !== 'none') {
        loginErrorMsg.innerText = t.loginIncorrectPassword || "Incorrect password. Please try again.";
    }
}

// Check if already authenticated on load
async function checkSession() {
    try {
        const configRes = await fetch('/admin/api/config');
        if (configRes.ok) {
            const config = await configRes.json();
            
            // Check turnstile
            if (config.turnstile_site_key) {
                turnstileSiteKey = config.turnstile_site_key;
                loadTurnstileScript();
            }

            if (!config.auth_required) {
                window.location.href = './';
                return;
            }
            const token = localStorage.getItem('admin_token');
            if (token) {
                const statsRes = await fetch('/admin/api/stats', {
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'x-admin-token': token
                    }
                });
                if (statsRes.ok) {
                    window.location.href = './';
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
}

function loadTurnstileScript() {
    window.onloadTurnstileCallback = function () {
        const container = document.getElementById('adminTurnstileContainer');
        if (container && turnstileSiteKey) {
            container.classList.remove('hidden');
            turnstileWidgetId = turnstile.render('#adminTurnstileContainer', {
                sitekey: turnstileSiteKey,
                theme: 'dark'
            });
        }
    };

    const script = document.createElement('script');
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

// Run session check on load
checkSession();

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const t = TRANSLATIONS[lang];
    
    // Validate Turnstile
    let turnstileToken = '';
    if (turnstileSiteKey) {
        if (typeof turnstile === 'undefined') {
            showToast(t.authServiceUnavailable || 'Verification service unavailable', 'error');
            return;
        }
        turnstileToken = turnstile.getResponse(turnstileWidgetId);
        if (!turnstileToken) {
            showToast(t.completeVerificationCheck || 'Please complete the verification check.', 'error');
            return;
        }
    }

    const password = loginPasswordField.value.trim();
    if (!password) return;

    try {
        const res = await fetch('/admin/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password,
                'cf-turnstile-response': turnstileToken
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            localStorage.setItem('admin_token', data.token);
            loginErrorMsg.style.display = 'none';
            showToast(t.loginSuccess || 'Access granted. Welcome!', 'success');
            setTimeout(() => {
                window.location.href = './';
            }, 500);
        } else {
            loginErrorMsg.style.display = 'block';
            loginErrorMsg.innerText = t.loginIncorrectPassword || 'Incorrect password.';
            loginPasswordField.value = '';
            loginPasswordField.focus();
            showToast(t.loginIncorrectPassword || 'Incorrect password', 'error');
            
            if (turnstileWidgetId !== null && typeof turnstile !== 'undefined') {
                turnstile.reset(turnstileWidgetId);
            }
        }
    } catch (err) {
        loginErrorMsg.style.display = 'block';
        loginErrorMsg.innerText = (t.serverErrorPrefix || 'Server error: ') + err.message;
        showToast(t.loginServerError || 'Login server error', 'error');
        
        if (turnstileWidgetId !== null && typeof turnstile !== 'undefined') {
            turnstile.reset(turnstileWidgetId);
        }
    }
});

// Initialize Language selection
if (languageSelect) {
    if (!localStorage.getItem(LANGUAGE_KEY)) {
        const browserLang = (navigator.language || navigator.userLanguage || 'vi').toLowerCase();
        const defaultLang = browserLang.startsWith('vi') ? 'vi' : 'en';
        localStorage.setItem(LANGUAGE_KEY, defaultLang);
    }
    languageSelect.value = localStorage.getItem(LANGUAGE_KEY);

    languageSelect.addEventListener('change', (e) => {
        localStorage.setItem(LANGUAGE_KEY, e.target.value);
        applyLanguage();
    });
}

applyLanguage();
