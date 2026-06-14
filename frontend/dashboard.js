import { 
    createIcons, 
    User, 
    Key, 
    BarChart3, 
    Database, 
    Plus, 
    Trash2, 
    Copy, 
    LogOut, 
    Check, 
    X, 
    Lock, 
    ShieldCheck, 
    ArrowRight, 
    ArrowLeft, 
    Cpu,
    BookOpen,
    RefreshCw,
    Sparkles,
    Globe,
    ChevronDown,
    Menu
} from 'lucide';
import vi from './locales/vi.json';
import en from './locales/en.json';

const TRANSLATIONS = { vi, en };
const LANGUAGE_KEY = 'dc_chat_language';

// Initialize Lucide Icons
function initIcons() {
    createIcons({
        icons: {
            User,
            Key,
            BarChart3,
            Database,
            Plus,
            Trash2,
            Copy,
            LogOut,
            Check,
            X,
            Lock,
            ShieldCheck,
            ArrowRight,
            ArrowLeft,
            Cpu,
            BookOpen,
            RefreshCw,
            Sparkles,
            Globe,
            ChevronDown,
            Menu
        }
    });
}

// Global state
let userToken = localStorage.getItem('user_token');
let username = localStorage.getItem('user_username');
const languageSelect = document.getElementById('languageSelect');

// Turnstile State and Instances
let turnstileSiteKey = null;
let loginTurnstileWidgetId = null;
let registerTurnstileWidgetId = null;

// Elements
const authView = document.getElementById('authView');
const dashboardView = document.getElementById('dashboardView');
const userInfo = document.getElementById('userInfo');
const headerUsername = document.getElementById('headerUsername');
const welcomeUsername = document.getElementById('welcomeUsername');
const logoutBtn = document.getElementById('logoutBtn');

function applyLanguage() {
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const t = TRANSLATIONS[lang];

    document.title = t.dashPageTitle || "User Portal - DC AI API";

    const elApiDocs = document.getElementById('lblApiDocs');
    if (elApiDocs) elApiDocs.textContent = t.apiDocs;

    const elLogout = document.getElementById('lblLogout');
    if (elLogout) elLogout.textContent = t.dashLogout;

    const elAuthWelcome = document.getElementById('lblAuthWelcome');
    if (elAuthWelcome) elAuthWelcome.textContent = t.dashAuthWelcome;

    const elAuthSubtitle = document.getElementById('lblAuthSubtitle');
    if (elAuthSubtitle) elAuthSubtitle.textContent = t.dashAuthSubtitle;

    const elTabLogin = document.getElementById('tabLogin');
    if (elTabLogin) elTabLogin.textContent = t.dashLoginTab;

    const elTabRegister = document.getElementById('tabRegister');
    if (elTabRegister) elTabRegister.textContent = t.dashRegisterTab;

    const elLoginUsername = document.getElementById('lblLoginUsername');
    if (elLoginUsername) elLoginUsername.textContent = t.dashUsername;

    const elLoginPassword = document.getElementById('lblLoginPassword');
    if (elLoginPassword) elLoginPassword.textContent = t.dashPassword;

    const elRegisterUsername = document.getElementById('lblRegisterUsername');
    if (elRegisterUsername) elRegisterUsername.textContent = t.dashUsername;

    const elRegisterPassword = document.getElementById('lblRegisterPassword');
    if (elRegisterPassword) elRegisterPassword.textContent = t.dashPassword;

    const elRegisterPasswordConfirm = document.getElementById('lblRegisterPasswordConfirm');
    if (elRegisterPasswordConfirm) elRegisterPasswordConfirm.textContent = t.dashConfirmPassword;

    // Placeholders
    if (loginUsernameInput) loginUsernameInput.placeholder = t.dashUsernamePlaceholder;
    if (loginPasswordInput) loginPasswordInput.placeholder = t.dashPasswordPlaceholder;
    if (registerUsernameInput) registerUsernameInput.placeholder = t.dashChooseUsername;
    if (registerPasswordInput) registerPasswordInput.placeholder = t.dashChoosePassword;
    if (registerPasswordConfirmInput) registerPasswordConfirmInput.placeholder = t.dashReenterPassword;
    if (newKeyLabelInput) newKeyLabelInput.placeholder = t.dashKeyLabelPlaceholder;

    // Buttons
    const elBtnSignIn = document.getElementById('btnSignIn');
    if (elBtnSignIn) elBtnSignIn.innerHTML = `<i data-lucide="lock" style="width: 16px; height: 16px;"></i> ${t.dashLoginTab}`;

    const elBtnRegister = document.getElementById('btnRegister');
    if (elBtnRegister) elBtnRegister.innerHTML = `<i data-lucide="plus" style="width: 16px; height: 16px;"></i> ${t.dashRegisterBtn}`;

    // Dashboard
    const elWelcomeHello = document.getElementById('lblWelcomeHello');
    if (elWelcomeHello) elWelcomeHello.textContent = t.dashHello;

    const elWelcomeMessage = document.getElementById('lblWelcomeMessage');
    if (elWelcomeMessage) elWelcomeMessage.textContent = t.dashWelcomeMessage;

    const elActiveMember = document.getElementById('lblActiveMember');
    if (elActiveMember) elActiveMember.textContent = t.dashActiveMember;

    const elConsumptionOverview = document.getElementById('lblConsumptionOverview');
    if (elConsumptionOverview) elConsumptionOverview.textContent = t.dashConsumptionOverview;

    const elRefreshBtn = document.getElementById('lblRefreshBtn');
    if (elRefreshBtn) elRefreshBtn.textContent = t.dashRefresh;

    const elRequests = document.getElementById('lblRequests');
    if (elRequests) elRequests.textContent = t.dashRequests;

    const elTotalTokens = document.getElementById('lblTotalTokens');
    if (elTotalTokens) elTotalTokens.textContent = t.dashTotalTokens;

    const elPromptTokens = document.getElementById('lblPromptTokens');
    if (elPromptTokens) elPromptTokens.textContent = t.dashPromptTokens;

    const elCompletionTokens = document.getElementById('lblCompletionTokens');
    if (elCompletionTokens) elCompletionTokens.textContent = t.dashCompletionTokens;

    const elMyClientKeys = document.getElementById('lblMyClientKeys');
    if (elMyClientKeys) elMyClientKeys.textContent = t.dashMyClientKeys;

    const elKeyManagementTab = document.getElementById('lblKeyManagementTab');
    if (elKeyManagementTab) elKeyManagementTab.textContent = t.dashKeyManagement;

    const elNewKeyLabel = document.getElementById('lblNewKeyLabel');
    if (elNewKeyLabel) elNewKeyLabel.textContent = t.dashKeyLabel;

    const elBtnCreateKey = document.getElementById('btnCreateKey');
    if (elBtnCreateKey) elBtnCreateKey.innerHTML = `<i data-lucide="plus" style="width: 14px; height: 14px;"></i> ${t.dashCreateKey}`;

    // Table headers
    const elThLabel = document.getElementById('lblThLabel');
    if (elThLabel) elThLabel.textContent = t.dashTableLabel;

    const elThKey = document.getElementById('lblThKey');
    if (elThKey) elThKey.textContent = t.dashTableKey;

    const elThStatus = document.getElementById('lblThStatus');
    if (elThStatus) elThStatus.textContent = t.dashTableStatus;

    const elThKeyRequests = document.getElementById('lblThKeyRequests');
    if (elThKeyRequests) elThKeyRequests.textContent = t.dashRequests;

    const elThKeyTotalTokens = document.getElementById('lblThKeyTotalTokens');
    if (elThKeyTotalTokens) elThKeyTotalTokens.textContent = t.dashTotalTokens;

    const elThLastUsed = document.getElementById('lblThLastUsed');
    if (elThLastUsed) elThLastUsed.textContent = t.dashTableLastUsed;

    const elThCreated = document.getElementById('lblThCreated');
    if (elThCreated) elThCreated.textContent = t.dashTableCreated;

    const elThActions = document.getElementById('lblThActions');
    if (elThActions) elThActions.textContent = t.dashTableActions;

    const elUsageByModel = document.getElementById('lblUsageByModel');
    if (elUsageByModel) elUsageByModel.textContent = t.dashUsageByModel;

    const elUsageStatsTab = document.getElementById('lblUsageStatsTab');
    if (elUsageStatsTab) elUsageStatsTab.textContent = t.dashUsageStatsTab;

    const elThModel = document.getElementById('lblThModel');
    if (elThModel) elThModel.textContent = t.dashTableModel || "Model Name";

    const elThRequests = document.getElementById('lblThRequests');
    if (elThRequests) elThRequests.textContent = t.dashRequests;

    const elThPrompt = document.getElementById('lblThPrompt');
    if (elThPrompt) elThPrompt.textContent = t.dashPromptTokens;

    const elThCompletion = document.getElementById('lblThCompletion');
    if (elThCompletion) elThCompletion.textContent = t.dashCompletionTokens;

    const elThTotal = document.getElementById('lblThTotal');
    if (elThTotal) elThTotal.textContent = t.dashTotalTokens;

    const elAvailableModels = document.getElementById('lblAvailableModels');
    if (elAvailableModels) elAvailableModels.textContent = t.dashAvailableModels;

    const elActiveRotationPoolTab = document.getElementById('lblActiveRotationPoolTab');
    if (elActiveRotationPoolTab) elActiveRotationPoolTab.textContent = t.dashActiveRotationPool;

    const elAvailableModelsDesc = document.getElementById('lblAvailableModelsDesc');
    if (elAvailableModelsDesc) elAvailableModelsDesc.textContent = t.dashAvailableModelsDesc;

    const elOpenAICompatible = document.getElementById('lblOpenAICompatible');
    if (elOpenAICompatible) elOpenAICompatible.textContent = t.dashOpenAICompatible;

    const elGeminiNative = document.getElementById('lblGeminiNative');
    if (elGeminiNative) elGeminiNative.textContent = t.dashGeminiNative;

    const elClaudeNative = document.getElementById('lblClaudeNative');
    if (elClaudeNative) elClaudeNative.textContent = t.dashClaudeNative;

    initIcons();
}

// Auth Form Elements
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginUsernameInput = document.getElementById('loginUsername');
const loginPasswordInput = document.getElementById('loginPassword');
const registerUsernameInput = document.getElementById('registerUsername');
const registerPasswordInput = document.getElementById('registerPassword');
const registerPasswordConfirmInput = document.getElementById('registerPasswordConfirm');

// Dashboard Elements
const statRequests = document.getElementById('statRequests');
const statTotalTokens = document.getElementById('statTotalTokens');
const statPromptTokens = document.getElementById('statPromptTokens');
const statCompletionTokens = document.getElementById('statCompletionTokens');
const createKeyForm = document.getElementById('createKeyForm');
const newKeyLabelInput = document.getElementById('newKeyLabel');
const keysTableBody = document.getElementById('keysTableBody');
const modelStatsTableBody = document.getElementById('modelStatsTableBody');
const keysCardsMobile = document.getElementById('keysCardsMobile');
const modelStatsCardsMobile = document.getElementById('modelStatsCardsMobile');
const refreshStatsBtn = document.getElementById('refreshStatsBtn');

// Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon"></div>
        <div class="toast-message" style="flex: 1; min-width: 0; word-break: break-word;">${escapeHtml(message)}</div>
        <button class="toast-close-btn" aria-label="Close" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0.25rem; border-radius: 0.25rem; margin-left: auto; transition: var(--transition-fast);">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    `;

    const closeBtn = toast.querySelector('.toast-close-btn');
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.color = 'var(--text-primary)';
        closeBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.color = 'var(--text-secondary)';
        closeBtn.style.background = 'transparent';
    });

    let dismissTimeout;
    const dismiss = () => {
        if (dismissTimeout) clearTimeout(dismissTimeout);
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    };

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismiss();
    });

    container.appendChild(toast);
    toast.offsetHeight; // Force reflow
    toast.classList.add('show');

    // Automatically remove after 4 seconds
    dismissTimeout = setTimeout(dismiss, 4000);
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

// Show/Hide views based on auth state
function updateUIState() {
    if (userToken) {
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        userInfo.classList.remove('hidden');
        logoutBtn.classList.remove('hidden');
        
        headerUsername.innerText = username;
        welcomeUsername.innerText = username;
        
        loadDashboardData();
    } else {
        authView.classList.remove('hidden');
        dashboardView.classList.add('hidden');
        userInfo.classList.add('hidden');
        logoutBtn.classList.add('hidden');
        
        loginUsernameInput.value = '';
        loginPasswordInput.value = '';
        registerUsernameInput.value = '';
        registerPasswordInput.value = '';
        registerPasswordConfirmInput.value = '';
    }
    document.body.style.opacity = 1;
    initIcons();
}

// Auth Tabs Switching
tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    if (loginTurnstileWidgetId !== null && typeof turnstile !== 'undefined') {
        turnstile.reset(loginTurnstileWidgetId);
    }
});

tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    if (registerTurnstileWidgetId !== null && typeof turnstile !== 'undefined') {
        turnstile.reset(registerTurnstileWidgetId);
    }
});

// User Registration Handler
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const t = TRANSLATIONS[lang];
    const usernameVal = registerUsernameInput.value.trim();
    const passwordVal = registerPasswordInput.value;
    const confirmVal = registerPasswordConfirmInput.value;

    if (!usernameVal || !passwordVal) {
        showToast(t.toastUsernamePasswordRequired || 'Username and password are required', 'error');
        return;
    }

    if (passwordVal !== confirmVal) {
        showToast(t.toastPasswordsDoNotMatch || 'Passwords do not match', 'error');
        return;
    }

    // Validate Turnstile
    let registerTurnstileToken = '';
    if (turnstileSiteKey) {
        if (typeof turnstile === 'undefined') {
            showToast(t.authServiceUnavailable || 'Verification service unavailable', 'error');
            return;
        }
        registerTurnstileToken = turnstile.getResponse(registerTurnstileWidgetId);
        if (!registerTurnstileToken) {
            showToast(t.completeVerificationCheck || 'Please complete the verification check.', 'error');
            return;
        }
    }

    try {
        const res = await fetch('/api/user/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: usernameVal,
                password: passwordVal,
                'cf-turnstile-response': registerTurnstileToken
            })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(data.message || (t.toastRegistrationSuccessful || 'Registration successful! Wait for admin approval.'), 'success');
            // Switch to login tab
            tabLogin.click();
            loginUsernameInput.value = usernameVal;
            loginPasswordInput.focus();
        } else {
            showToast(data.error || (t.toastRegistrationFailed || 'Registration failed'), 'error');
            if (registerTurnstileWidgetId !== null && typeof turnstile !== 'undefined') {
                turnstile.reset(registerTurnstileWidgetId);
            }
        }
    } catch (err) {
        showToast(t.toastNetworkErrorRegistration || 'Network error during registration', 'error');
        console.error(err);
        if (registerTurnstileWidgetId !== null && typeof turnstile !== 'undefined') {
            turnstile.reset(registerTurnstileWidgetId);
        }
    }
});

// User Login Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const t = TRANSLATIONS[lang];
    const usernameVal = loginUsernameInput.value.trim();
    const passwordVal = loginPasswordInput.value;

    if (!usernameVal || !passwordVal) {
        showToast(t.toastUsernamePasswordRequired || 'Username and password are required', 'error');
        return;
    }

    // Validate Turnstile
    let loginTurnstileToken = '';
    if (turnstileSiteKey) {
        if (typeof turnstile === 'undefined') {
            showToast(t.authServiceUnavailable || 'Verification service unavailable', 'error');
            return;
        }
        loginTurnstileToken = turnstile.getResponse(loginTurnstileWidgetId);
        if (!loginTurnstileToken) {
            showToast(t.completeVerificationCheck || 'Please complete the verification check.', 'error');
            return;
        }
    }

    try {
        const res = await fetch('/api/user/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: usernameVal,
                password: passwordVal,
                'cf-turnstile-response': loginTurnstileToken
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            userToken = data.token;
            username = data.username;
            localStorage.setItem('user_token', userToken);
            localStorage.setItem('user_username', username);
            
            showToast(t.toastLoginSuccess || 'Successfully signed in!', 'success');
            updateUIState();
        } else {
            showToast(data.error || (t.toastAuthFailed || 'Authentication failed'), 'error');
            if (loginTurnstileWidgetId !== null && typeof turnstile !== 'undefined') {
                turnstile.reset(loginTurnstileWidgetId);
            }
        }
    } catch (err) {
        showToast(t.toastNetworkErrorLogin || 'Network error during login', 'error');
        console.error(err);
        if (loginTurnstileWidgetId !== null && typeof turnstile !== 'undefined') {
            turnstile.reset(loginTurnstileWidgetId);
        }
    }
});

// User Logout Handler
logoutBtn.addEventListener('click', async () => {
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const t = TRANSLATIONS[lang];
    try {
        await fetch('/api/user/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'x-user-token': userToken
            }
        });
    } catch (err) {
        console.error('Logout error:', err);
    }
    
    userToken = null;
    username = null;
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_username');
    showToast(t.toastLogoutSuccess || 'Signed out successfully', 'info');
    updateUIState();
});

// Fetch Dashboard Stats and Keys
async function loadDashboardData() {
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const t = TRANSLATIONS[lang];
    try {
        const res = await fetch('/api/user/stats', {
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'x-user-token': userToken
            }
        });

        if (res.status === 401) {
            // Token expired or invalid
            userToken = null;
            username = null;
            localStorage.removeItem('user_token');
            localStorage.removeItem('user_username');
            showToast(t.toastSessionExpired || 'Session expired. Please log in again.', 'warning');
            updateUIState();
            return;
        }

        if (!res.ok) {
            showToast(t.toastLoadStatsFailed || 'Failed to load user statistics', 'error');
            return;
        }

        const data = await res.json();
        
        // Render Stats
        statRequests.innerText = Number(data.total_requests).toLocaleString();
        statTotalTokens.innerText = Number(data.total_tokens).toLocaleString();
        statPromptTokens.innerText = Number(data.prompt_tokens).toLocaleString();
        statCompletionTokens.innerText = Number(data.completion_tokens).toLocaleString();

        // Render API Keys Table
        renderKeysTable(data.keys || []);
        
        // Render Model Usage Table
        renderModelStats(data.model_stats || []);

        // Render Available Models Catalog
        const availableModels = data.available_models || { openai: [], gemini: [], claude: [] };
        renderModelPills(document.getElementById('openaiModelsList'), availableModels.openai || []);
        renderModelPills(document.getElementById('geminiModelsList'), availableModels.gemini || [], 'models/');
        renderModelPills(document.getElementById('claudeModelsList'), availableModels.claude || []);

        initIcons();
    } catch (err) {
        showToast(t.toastLoadUserDataFailed || 'Error loading user data', 'error');
        console.error(err);
    }
}

function renderModelPills(container, models, prefix = '') {
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const t = TRANSLATIONS[lang];
    if (!container) return;
    if (models.length === 0) {
        container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.8rem; font-style: italic;">${t.noActiveModels || 'No active models available'}</span>`;
        return;
    }

    container.innerHTML = models.map(model => {
        const fullName = prefix + model;
        return `
            <div class="model-pill" data-copy-val="${escapeHtml(fullName)}" title="${t.clickToCopy || 'Click to copy'}: ${escapeHtml(fullName)}">
                <span>${escapeHtml(model)}</span>
                <i class="copy-icon-placeholder" data-lucide="copy" style="width: 10px; height: 10px;"></i>
            </div>
        `;
    }).join('');

    // Attach copy event listeners to pills
    container.querySelectorAll('.model-pill').forEach(pill => {
        pill.addEventListener('click', async () => {
            const copyVal = pill.getAttribute('data-copy-val');
            try {
                await navigator.clipboard.writeText(copyVal);
                showToast((t.copiedModel || 'Copied model: ') + copyVal, 'success');
                
                // Temporary visual feedback
                const icon = pill.querySelector('.copy-icon-placeholder');
                if (icon) {
                    const originalHTML = icon.outerHTML;
                    icon.outerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 10px; height: 10px; color: var(--color-active);"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    
                    setTimeout(() => {
                        // Re-fetch the child to replace it back since outerHTML replaced the element
                        const newIcon = pill.querySelector('svg');
                        if (newIcon) {
                            newIcon.outerHTML = originalHTML;
                            initIcons();
                        }
                    }, 1500);
                }
            } catch (err) {
                showToast(t.copyModelFailed || 'Failed to copy model name', 'error');
            }
        });
    });
}

// Render Client API Keys Table
function renderKeysTable(keys) {
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const t = TRANSLATIONS[lang];
    if (keys.length === 0) {
        keysTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="no-data">${t.dashNoKeysCreated || 'No API keys created yet. Generate one below!'}</td>
            </tr>
        `;
        if (keysCardsMobile) {
            keysCardsMobile.innerHTML = `
                <div class="no-data">${t.dashNoKeysCreated || 'No API keys created yet. Generate one below!'}</div>
            `;
        }
        return;
    }

    keysTableBody.innerHTML = keys.map(key => {
        const statusBadgeClass = key.status === 'active' ? 'badge-active' : 'badge-disabled';
        const statusLabel = key.status === 'active' ? (t.statusActive || 'Active') : (t.statusDisabled || 'Disabled');
        const toggleIcon = key.status === 'active' ? 'x' : 'check';
        const toggleTitle = key.status === 'active' ? (t.dashDisableKey || 'Disable Key') : (t.dashEnableKey || 'Enable Key');
        const createdDate = new Date(key.id ? parseInt(key.id.split('-')[0]) * 1000 : Date.now()).toLocaleDateString();
        const lastUsedText = key.last_used && key.last_used !== '0001-01-01T00:00:00Z' && key.last_used !== '0001-01-01T00:00:00.000Z' && key.last_used !== '0001-01-01T07:00:00+07:00'
            ? new Date(key.last_used).toLocaleString() 
            : (t.adminNever || 'Never');

        return `
            <tr>
                <td style="font-weight: 600;">${escapeHtml(key.label)}</td>
                <td>
                    <div class="key-text-container">
                        <span class="key-masked" id="key-text-${key.id}">${escapeHtml(key.key_masked)}</span>
                        <button class="copy-btn" data-key="${escapeHtml(key.key)}" title="${t.dashCopyFullKey || 'Copy Full Key'}">
                            <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <span class="badge ${statusBadgeClass}">${statusLabel}</span>
                </td>
                <td>
                    ${Number(key.total_requests).toLocaleString()}
                </td>
                <td style="font-weight: 600;">
                    ${Number(key.total_tokens).toLocaleString()}
                </td>
                <td style="color: var(--text-muted); font-size: 0.8rem;">
                    ${lastUsedText}
                </td>
                <td style="color: var(--text-muted); font-size: 0.8rem;">
                    ${createdDate}
                </td>
                <td style="text-align: right;">
                    <div class="actions-cell" style="justify-content: flex-end;">
                        <button class="btn btn-secondary btn-sm toggle-key-btn" data-id="${key.id}" data-status="${key.status}" title="${toggleTitle}">
                            <i data-lucide="${toggleIcon}" style="width: 12px; height: 12px;"></i>
                        </button>
                        <button class="btn btn-danger btn-sm delete-key-btn" data-id="${key.id}" title="${t.dashDeleteKey || 'Delete Key'}">
                            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (keysCardsMobile) {
        keysCardsMobile.innerHTML = keys.map(key => {
            const statusBadgeClass = key.status === 'active' ? 'badge-active' : 'badge-disabled';
            const statusLabel = key.status === 'active' ? (t.statusActive || 'Active') : (t.statusDisabled || 'Disabled');
            const toggleIcon = key.status === 'active' ? 'x' : 'check';
            const toggleTitle = key.status === 'active' ? (t.dashDisableKey || 'Disable Key') : (t.dashEnableKey || 'Enable Key');
            const createdDate = new Date(key.id ? parseInt(key.id.split('-')[0]) * 1000 : Date.now()).toLocaleDateString();
            const btnToggleLabel = key.status === 'active' ? (t.actionDisable || 'Disable') : (t.actionEnable || 'Enable');
            const lastUsedText = key.last_used && key.last_used !== '0001-01-01T00:00:00Z' && key.last_used !== '0001-01-01T00:00:00.000Z' && key.last_used !== '0001-01-01T07:00:00+07:00'
                ? new Date(key.last_used).toLocaleString() 
                : (t.adminNever || 'Never');

            return `
                <div class="mobile-card">
                    <div class="mobile-card-header">
                        <span class="mobile-card-title">${escapeHtml(key.label)}</span>
                        <span class="badge ${statusBadgeClass}">${statusLabel}</span>
                    </div>
                    <div class="mobile-card-body">
                        <div class="mobile-card-row">
                            <span class="mobile-card-label">${t.dashTableKey || 'API Key'}</span>
                            <div class="key-text-container">
                                <span class="key-masked">${escapeHtml(key.key_masked)}</span>
                                <button class="copy-btn" data-key="${escapeHtml(key.key)}" title="${t.dashCopyFullKey || 'Copy Full Key'}">
                                    <i data-lucide="copy" style="width: 13px; height: 13px;"></i>
                                </button>
                            </div>
                        </div>
                        <div class="mobile-card-row">
                            <span class="mobile-card-label">${t.dashRequests || 'Requests'}</span>
                            <span class="mobile-card-value">${Number(key.total_requests).toLocaleString()}</span>
                        </div>
                        <div class="mobile-card-row">
                            <span class="mobile-card-label">${t.dashTotalTokens || 'Total Tokens'}</span>
                            <span class="mobile-card-value">${Number(key.total_tokens).toLocaleString()}</span>
                        </div>
                        <div class="mobile-card-row">
                            <span class="mobile-card-label">${t.dashTableLastUsed || 'Last Used'}</span>
                            <span class="mobile-card-value" style="font-size: 0.8rem; color: var(--text-muted);">${lastUsedText}</span>
                        </div>
                        <div class="mobile-card-row">
                            <span class="mobile-card-label">${t.dashTableCreated || 'Created At'}</span>
                            <span class="mobile-card-value" style="font-size: 0.8rem; color: var(--text-muted);">${createdDate}</span>
                        </div>
                    </div>
                    <div class="mobile-card-actions">
                        <button class="btn btn-secondary btn-sm toggle-key-btn" data-id="${key.id}" data-status="${key.status}" title="${toggleTitle}">
                            <i data-lucide="${toggleIcon}" style="width: 12px; height: 12px;"></i> ${btnToggleLabel}
                        </button>
                        <button class="btn btn-danger btn-sm delete-key-btn" data-id="${key.id}" title="${t.dashDeleteKey || 'Delete Key'}">
                            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i> ${t.actionDelete || 'Delete'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Attach copy event listeners (document-wide to support mobile cards)
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const keyStr = btn.getAttribute('data-key');
            try {
                await navigator.clipboard.writeText(keyStr);
                showToast(t.toastKeyCopied || 'API Key copied to clipboard!', 'success');
                
                // Toggle copy icon to check icon temporarily
                const originalHTML = btn.innerHTML;
                btn.innerHTML = `<i data-lucide="check" style="width: 13px; height: 13px; color: var(--color-active);"></i>`;
                initIcons();
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    initIcons();
                }, 2000);
            } catch (err) {
                showToast(t.toastCopyKeyFailed || 'Failed to copy API key', 'error');
            }
        });
    });

    // Attach toggle status event listeners
    document.querySelectorAll('.toggle-key-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const keyID = btn.getAttribute('data-id');
            const currentStatus = btn.getAttribute('data-status');
            const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
            
            try {
                const res = await fetch(`/api/user/keys/${keyID}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`,
                        'x-user-token': userToken
                    },
                    body: JSON.stringify({ status: newStatus })
                  });

                  if (res.ok) {
                      showToast(newStatus === 'active' ? (t.toastKeyEnabled || 'API Key has been enabled.') : (t.toastKeyDisabled || 'API Key has been disabled.'), 'success');
                      loadDashboardData();
                  } else {
                      const data = await res.json();
                      showToast(data.error || (t.toastUpdateKeyStatusFailed || 'Failed to update key status'), 'error');
                  }
              } catch (err) {
                  showToast(t.toastNetworkErrorUpdatingKey || 'Network error updating key', 'error');
              }
          });
      });

      // Attach delete event listeners
      document.querySelectorAll('.delete-key-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm(t.confirmDeleteUserKey || 'Are you sure you want to delete this API key? This action is permanent and cannot be undone.')) {
                return;
            }
            const keyID = btn.getAttribute('data-id');
            try {
                const res = await fetch(`/api/user/keys/${keyID}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${userToken}`,
                        'x-user-token': userToken
                    }
                });

                if (res.ok) {
                    showToast(t.toastDeleteKeySuccess || 'API Key deleted successfully', 'success');
                    loadDashboardData();
                } else {
                    const data = await res.json();
                    showToast(data.error || (t.toastDeleteKeyFailed || 'Failed to delete key'), 'error');
                }
            } catch (err) {
                showToast(t.toastNetworkErrorDeletingKey || 'Network error deleting key', 'error');
            }
        });
    });
}

// Render Model Statistics Table
function renderModelStats(stats) {
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const t = TRANSLATIONS[lang];
    if (stats.length === 0) {
        modelStatsTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="no-data">${t.dashNoTokenRecorded || 'No token consumption recorded yet. Make API calls using your key.'}</td>
            </tr>
        `;
        if (modelStatsCardsMobile) {
            modelStatsCardsMobile.innerHTML = `
                <div class="no-data">${t.dashNoTokenRecorded || 'No token consumption recorded yet. Make API calls using your key.'}</div>
            `;
        }
        return;
    }

    modelStatsTableBody.innerHTML = stats.map(stat => {
        return `
            <tr>
                <td style="font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 0.8125rem; color: #a5b4fc;">
                    ${escapeHtml(stat.model_name)}
                </td>
                <td>${Number(stat.total_requests).toLocaleString()}</td>
                <td>${Number(stat.prompt_tokens).toLocaleString()}</td>
                <td>${Number(stat.completion_tokens).toLocaleString()}</td>
                <td style="font-weight: 700;">${Number(stat.total_tokens).toLocaleString()}</td>
            </tr>
        `;
    }).join('');

    if (modelStatsCardsMobile) {
        modelStatsCardsMobile.innerHTML = stats.map(stat => {
            return `
                <div class="mobile-card">
                    <div class="mobile-card-header">
                        <span class="mobile-card-title" style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #a5b4fc;">
                            ${escapeHtml(stat.model_name)}
                        </span>
                    </div>
                    <div class="mobile-card-body">
                        <div class="mobile-card-row">
                            <span class="mobile-card-label">${t.dashRequests || 'Requests'}</span>
                            <span class="mobile-card-value">${Number(stat.total_requests).toLocaleString()}</span>
                        </div>
                        <div class="mobile-card-row">
                            <span class="mobile-card-label">${t.dashPromptTokens || 'Prompt Tokens'}</span>
                            <span class="mobile-card-value">${Number(stat.prompt_tokens).toLocaleString()}</span>
                        </div>
                        <div class="mobile-card-row">
                            <span class="mobile-card-label">${t.dashCompletionTokens || 'Completion Tokens'}</span>
                            <span class="mobile-card-value">${Number(stat.completion_tokens).toLocaleString()}</span>
                        </div>
                        <div class="mobile-card-row">
                            <span class="mobile-card-label" style="font-weight: 700;">${t.dashTotalTokens || 'Total Tokens'}</span>
                            <span class="mobile-card-value" style="font-weight: 700; color: var(--color-violet);">${Number(stat.total_tokens).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Guide helper removed

// Create Client Key Handler
createKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const t = TRANSLATIONS[lang];
    const labelVal = newKeyLabelInput.value.trim();
    if (!labelVal) return;

    try {
        const res = await fetch('/api/user/keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}`,
                'x-user-token': userToken
            },
            body: JSON.stringify({ label: labelVal })
        });

        const data = await res.json();
        if (res.ok) {
            showToast(t.toastCreateKeySuccess || 'New client key created successfully!', 'success');
            newKeyLabelInput.value = '';
            loadDashboardData();
        } else {
            showToast(data.error || (t.toastCreateKeyFailed || 'Failed to create key'), 'error');
        }
    } catch (err) {
        showToast(t.toastNetworkErrorCreatingKey || 'Network error creating key', 'error');
    }
});

// Guide tabs removed

// Refresh Stats Handler
if (refreshStatsBtn) {
    refreshStatsBtn.addEventListener('click', async () => {
        const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
        const t = TRANSLATIONS[lang];
        refreshStatsBtn.disabled = true;
        const icon = refreshStatsBtn.querySelector('i');
        if (icon) {
            icon.style.transform = 'rotate(360deg)';
            icon.style.transition = 'transform 0.6s ease-in-out';
        }
        showToast(t.toastRefreshingStats || 'Refreshing statistics...', 'info');
        await loadDashboardData();
        showToast(t.toastRefreshStatsSuccess || 'Statistics refreshed successfully!', 'success');
        if (icon) {
            setTimeout(() => {
                icon.style.transform = 'none';
                icon.style.transition = 'none';
            }, 600);
        }
        refreshStatsBtn.disabled = false;
    });
}

// On load init
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
        // If logged in, reload dashboard data to refresh dynamic tables
        if (userToken) {
            loadDashboardData();
        }
    });
}

applyLanguage();
updateUIState();
checkTurnstileConfig();

async function checkTurnstileConfig() {
    try {
        const configRes = await fetch('/admin/api/config');
        if (configRes.ok) {
            const config = await configRes.json();
            if (config.turnstile_site_key) {
                turnstileSiteKey = config.turnstile_site_key;
                loadTurnstileScript();
            }
        }
    } catch (err) {
        console.error('Failed to load Turnstile config:', err);
    }
}

function loadTurnstileScript() {
    window.onloadTurnstileCallback = function () {
        initTurnstileWidgets();
    };

    const script = document.createElement('script');
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

function initTurnstileWidgets() {
    const loginContainer = document.getElementById('loginTurnstileContainer');
    const registerContainer = document.getElementById('registerTurnstileContainer');

    if (loginContainer && turnstileSiteKey) {
        loginContainer.classList.remove('hidden');
        loginTurnstileWidgetId = turnstile.render('#loginTurnstileContainer', {
            sitekey: turnstileSiteKey,
            theme: 'dark'
        });
    }

    if (registerContainer && turnstileSiteKey) {
        registerContainer.classList.remove('hidden');
        registerTurnstileWidgetId = turnstile.render('#registerTurnstileContainer', {
            sitekey: turnstileSiteKey,
            theme: 'dark'
        });
    }
}

// Mobile menu toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const headerEl = document.querySelector('header');
if (mobileMenuBtn && headerEl) {
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        headerEl.classList.toggle('menu-open');
    });

    // Close when clicking outside header
    document.addEventListener('click', (e) => {
        if (!headerEl.contains(e.target)) {
            headerEl.classList.remove('menu-open');
        }
    });

    // Close when controls are clicked (only on links/buttons, not selects)
    const controls = headerEl.querySelector('.header-controls');
    if (controls) {
        controls.addEventListener('click', (e) => {
            if (e.target.closest('a') || e.target.closest('button')) {
                headerEl.classList.remove('menu-open');
            }
        });
    }
}
