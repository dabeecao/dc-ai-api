import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import renderMathInElement from 'katex/dist/contrib/auto-render.mjs';
import 'katex/dist/katex.min.css';
import {
    createIcons,
    Plus,
    Settings,
    Trash2,
    Menu,
    AlertCircle,
    ArrowUp,
    Square,
    MessageSquare,
    Sparkles,
    KeyRound,
    Code,
    Settings2,
    BarChart3,
    Eye,
    EyeOff,
    CheckCircle,
    AlertTriangle,
    X,
    LayoutDashboard,
    BookOpen,
    Copy,
    Check,
    RefreshCw,
    ChevronDown,
    ChevronsDown,
    Search,
    SquarePen,
    Paperclip,
    Globe,
    ExternalLink,
    ShieldCheck
} from 'lucide';

import vi from './locales/vi.json';
import en from './locales/en.json';

// Setup Markdown marked.js options
try {
    const renderer = new marked.Renderer();
    renderer.code = function (code, infostring, escaped) {
        const lang = (infostring || '').match(/^\S*/)?.[0] || 'text';
        const escapedCode = escaped ? code : escapeHTML(code);
        const copyButtonId = 'copy-btn-' + Math.random().toString(36).substring(2, 9);
        const currentLang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
        const copyText = currentLang === 'vi' ? 'Sao chép' : 'Copy';
        const copyTitle = currentLang === 'vi' ? 'Sao chép mã' : 'Copy code';

        return `
            <div class="code-block-container">
                <div class="code-block-header">
                    <span class="code-block-lang">${lang}</span>
                    <button class="code-block-copy-btn" data-code-id="${copyButtonId}" title="${copyTitle}">
                        <i data-lucide="copy" class="copy-icon" style="width:0.875rem;height:0.875rem;"></i>
                        <span class="copy-text">${copyText}</span>
                    </button>
                </div>
                <pre><code class="language-${lang}" id="${copyButtonId}">${escapedCode}</code></pre>
            </div>
        `;
    };

    marked.use({
        breaks: true,
        gfm: true,
        renderer: renderer
    });
} catch (e) {
    console.error('Failed to set marked options:', e);
}

// App States & Storage keys
const KEYS = {
    API_KEY: 'dc_chat_client_key',
    BASE_URL: 'dc_chat_base_url',
    SESSIONS: 'dc_chat_sessions',
    CURRENT_SESSION_ID: 'dc_chat_current_session_id',
    DEFAULT_MODEL: 'dc_chat_default_model',
    LANGUAGE: 'dc_chat_language',
    SYSTEM_PROMPT: 'dc_chat_system_prompt'
};

let activeSessions = JSON.parse(localStorage.getItem(KEYS.SESSIONS)) || [];
let currentSessionId = localStorage.getItem(KEYS.CURRENT_SESSION_ID) || null;
let selectedModel = localStorage.getItem(KEYS.DEFAULT_MODEL) || '';
let activeReader = null; // for streaming cancel
let activeController = null; // for pending fetch abort
let availableModels = []; // for custom model select dropdown
let selectedImages = []; // stores base64 data URLs for selected images
let webSearchEnabled = false; // toggle status for web search

let guestApiKey = '';
let guestModelName = '';

const TRANSLATIONS = { vi, en };

// Save activeSessions to localStorage, with automatic pruning to prevent QuotaExceededError
function saveSessions() {
    const MAX_SESSIONS = 30; // Limit to maximum 30 sessions in history
    
    // 1. Proactive quantity pruning
    if (activeSessions.length > MAX_SESSIONS) {
        const currentSession = activeSessions.find(s => s.id === currentSessionId);
        activeSessions = activeSessions.slice(0, MAX_SESSIONS);
        
        // If current session was sliced out, add it back to prevent losing active chat
        if (currentSession && !activeSessions.some(s => s.id === currentSessionId)) {
            activeSessions.push(currentSession);
        }
    }

    // 2. Safe save wrapper with reactive fallback pruning (QuotaExceededError recovery)
    try {
        localStorage.setItem(KEYS.SESSIONS, JSON.stringify(activeSessions));
    } catch (e) {
        console.warn("localStorage quota exceeded! Pruning old sessions and image data...", e);
        
        // Strategy A: Clear base64 image data URLs from all sessions except the current active one
        let imagePruned = false;
        activeSessions.forEach(session => {
            if (session.id !== currentSessionId && session.messages) {
                session.messages.forEach(msg => {
                    if (Array.isArray(msg.content)) {
                        msg.content.forEach(part => {
                            if (part.type === 'image_url' && part.image_url && part.image_url.url.startsWith('data:image/')) {
                                part.image_url.url = ''; // Strip the base64 content
                                imagePruned = true;
                            }
                        });
                    }
                });
            }
        });

        if (imagePruned) {
            try {
                localStorage.setItem(KEYS.SESSIONS, JSON.stringify(activeSessions));
                console.log("Successfully saved sessions after pruning image data.");
                return;
            } catch (retryErr) {
                // Continue to Strategy B
            }
        }

        // Strategy B: Progressively drop oldest sessions
        while (activeSessions.length > 5) {
            let removeIdx = -1;
            for (let i = activeSessions.length - 1; i >= 0; i--) {
                if (activeSessions[i].id !== currentSessionId) {
                    removeIdx = i;
                    break;
                }
            }
            if (removeIdx !== -1) {
                activeSessions.splice(removeIdx, 1);
                try {
                    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(activeSessions));
                    console.log(`Successfully saved sessions after deleting an old session (remaining count: ${activeSessions.length})`);
                    renderSessionsList();
                    return;
                } catch (retryErr) {
                    // Continue loop
                }
            } else {
                break;
            }
        }
        
        // Last resort: Clear everything except the active session
        if (activeSessions.length > 1) {
            activeSessions = activeSessions.filter(s => s.id === currentSessionId);
            try {
                localStorage.setItem(KEYS.SESSIONS, JSON.stringify(activeSessions));
                renderSessionsList();
            } catch (lastErr) {
                console.error("Critical: Could not save even a single session!", lastErr);
            }
        }
    }
}

// Custom Safe inline SVG renderer using ES modules lucide
function createIconsSafe() {
    try {
        createIcons({
            icons: {
                Plus,
                Settings,
                Trash2,
                Menu,
                AlertCircle,
                ArrowUp,
                Square,
                MessageSquare,
                Sparkles,
                KeyRound,
                Code,
                Settings2,
                BarChart3,
                Eye,
                EyeOff,
                CheckCircle,
                AlertTriangle,
                X,
                LayoutDashboard,
                BookOpen,
                Copy,
                Check,
                RefreshCw,
                ChevronDown,
                ChevronsDown,
                Search,
                SquarePen,
                Paperclip,
                Globe,
                ExternalLink,
                ShieldCheck
            }
        });
    } catch (e) {
        console.error('Failed to render icons:', e);
    }
}


// DOM elements cache
const dom = {
    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    sidebarOpenBtn: document.getElementById('sidebarOpenBtn'),
    sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
    newChatBtn: document.getElementById('newChatBtn'),
    newChatBtnMobile: document.getElementById('newChatBtnMobile'),
    historyList: document.getElementById('historyList'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    settingsBtn: document.getElementById('settingsBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    modelSelectWrapper: document.getElementById('modelSelectWrapper'),
    modelSelectTrigger: document.getElementById('modelSelectTrigger'),
    modelSelectText: document.getElementById('modelSelectText'),
    modelSelectPopover: document.getElementById('modelSelectPopover'),
    modelSearchInput: document.getElementById('modelSearchInput'),
    modelOptionsList: document.getElementById('modelOptionsList'),
    keyWarningBadge: document.getElementById('keyWarningBadge'),
    chatMessages: document.getElementById('chatMessages'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),
    sendBtn: document.getElementById('sendBtn'),
    settingsModal: document.getElementById('settingsModal'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    modalSaveBtn: document.getElementById('modalSaveBtn'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    systemPromptInput: document.getElementById('systemPromptInput'),
    togglePasswordBtn: document.getElementById('togglePasswordBtn'),
    toastContainer: document.getElementById('toastContainer'),
    scrollToBottomBtn: document.getElementById('scrollToBottomBtn'),
    attachBtn: document.getElementById('attachBtn'),
    imageInput: document.getElementById('imageInput'),
    webSearchToggleBtn: document.getElementById('webSearchToggleBtn'),
    imagePreviewContainer: document.getElementById('imagePreviewContainer')
};

// Initialize App
function init() {
    if (!localStorage.getItem(KEYS.BASE_URL)) {
        localStorage.setItem(KEYS.BASE_URL, window.location.origin);
    }
    if (!localStorage.getItem(KEYS.LANGUAGE)) {
        const browserLang = (navigator.language || navigator.userLanguage || 'vi').toLowerCase();
        const defaultLang = browserLang.startsWith('vi') ? 'vi' : 'en';
        localStorage.setItem(KEYS.LANGUAGE, defaultLang);
    }

    bindEvents();
    applyLanguage();
    renderSessionsList();
    validateConfigAndLoadModels();
    loadSession(currentSessionId);
}

// Apply localization configurations
function applyLanguage() {
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    const t = TRANSLATIONS[lang];

    document.title = t.title;

    const logoTitle = document.querySelector('.logo-title');
    if (logoTitle) logoTitle.textContent = t.title.replace(' Client', '');

    const elNewChat = document.getElementById('lblNewChat');
    if (elNewChat) elNewChat.textContent = t.newChat;

    const elSettingsBtn = document.getElementById('lblSettingsBtn');
    if (elSettingsBtn) elSettingsBtn.textContent = t.settings;

    const elClearAllBtn = document.getElementById('lblClearAllBtn');
    if (elClearAllBtn) elClearAllBtn.textContent = t.clearAll;

    const status = dom.statusDot.className;
    if (status.includes('error')) {
        dom.statusText.textContent = t.statusError;
    } else if (status.includes('active')) {
        dom.statusText.textContent = t.statusActive;
    } else if (dom.statusText.textContent.includes('kiểm tra') || dom.statusText.textContent.includes('Checking')) {
        dom.statusText.textContent = t.statusChecking;
    } else {
        dom.statusText.textContent = t.statusNotConfigured;
    }

    dom.chatInput.placeholder = t.placeholderInput;

    const elHintText = document.getElementById('lblHintText');
    if (elHintText) elHintText.textContent = t.hintText;

    const elKeyWarning = document.getElementById('lblKeyWarning');
    if (elKeyWarning) elKeyWarning.textContent = t.needKeyWarning;

    const elModalTitle = document.getElementById('lblModalTitle');
    if (elModalTitle) elModalTitle.textContent = t.configTitle;

    const elApiKeyLabel = document.getElementById('lblApiKeyLabel');
    if (elApiKeyLabel) elApiKeyLabel.textContent = t.apiKeyLabel;

    dom.apiKeyInput.placeholder = t.apiKeyPlaceholder;

    const elAdvancedSettings = document.getElementById('lblAdvancedSettings');
    if (elAdvancedSettings) elAdvancedSettings.textContent = t.advancedSettings;

    const elLanguageLabel = document.getElementById('lblLanguageLabel');
    if (elLanguageLabel) elLanguageLabel.textContent = t.languageLabel;

    const elSystemPromptLabel = document.getElementById('lblSystemPromptLabel');
    if (elSystemPromptLabel) elSystemPromptLabel.textContent = t.systemPromptLabel;

    if (dom.systemPromptInput) {
        dom.systemPromptInput.placeholder = t.systemPromptPlaceholder;
    }

    const elPrivacyTerms = document.getElementById('lblPrivacyTerms');
    if (elPrivacyTerms) elPrivacyTerms.textContent = t.privacyTermsLabel;

    const elPrivacyContent = document.getElementById('lblPrivacyContent');
    if (elPrivacyContent) elPrivacyContent.innerHTML = t.privacyTermsContent;

    dom.modalCancelBtn.textContent = t.cancel;
    dom.modalSaveBtn.textContent = t.save;

    const emptyEl = dom.chatMessages.querySelector('.empty-state');
    if (emptyEl) {
        renderEmptyState();
    }

    if (activeSessions.length === 0) {
        dom.historyList.innerHTML = `<div class="no-data" style="padding: 2rem 0; font-size:0.8rem; text-align: center; color: var(--text-muted);">${t.noHistory}</div>`;
    }

    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.value = lang;
    }

    createIconsSafe();
}

// Validate user key & fetch models
async function validateConfigAndLoadModels() {
    const key = localStorage.getItem(KEYS.API_KEY);
    const baseUrl = localStorage.getItem(KEYS.BASE_URL) || window.location.origin;
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    const t = TRANSLATIONS[lang];

    // Always fetch guest config first to ensure we have it
    try {
        const res = await fetch(`${baseUrl}/api/guest-config`);
        if (res.ok) {
            const config = await res.json();
            guestApiKey = config.guest_api_key || '';
            guestModelName = config.guest_model || '';
        }
    } catch (e) {
        console.error("Failed to load guest config:", e);
    }

    if (!key) {
        if (!guestApiKey) {
            // No guest key available, show warning/error state
            dom.statusDot.className = 'status-dot error';
            dom.statusText.textContent = lang === 'vi' ? 'Chưa cấu hình API Key' : 'No API Key configured';
            dom.keyWarningBadge.style.display = 'inline-flex';
            dom.modelSelectTrigger.disabled = true;
            dom.modelSelectText.textContent = `(${t.statusError})`;
            availableModels = [];
            renderCustomModelSelect('');
            
            // Disable input and update placeholder
            dom.chatInput.disabled = true;
            dom.chatInput.placeholder = lang === 'vi' 
                ? 'Vui lòng cấu hình Client API Key trong Cài đặt để bắt đầu...' 
                : 'Please configure Client API Key in Settings to start...';
            
            checkSendButtonState();
            openModal();
            return;
        }

        // Guest key is active
        dom.chatInput.disabled = false;
        dom.chatInput.placeholder = t.placeholderInput;

        dom.statusDot.className = 'status-dot active';
        dom.statusText.textContent = t.statusActive;
        dom.keyWarningBadge.style.display = 'none';

        dom.modelSelectTrigger.disabled = true;
        selectedModel = guestModelName;
        const displayName = guestModelName === 'dc-ai-model'
            ? (lang === 'vi' ? 'Trợ lý DC AI Model' : 'DC AI Model Assistant')
            : (lang === 'vi' ? 'Trợ lý DC AI' : 'DC AI Assistant');
        dom.modelSelectText.textContent = displayName;

        availableModels = [guestModelName];
        renderCustomModelSelect('');
        checkSendButtonState();
        return;
    }

    dom.statusDot.className = 'status-dot';
    dom.statusText.textContent = t.statusChecking;
    dom.keyWarningBadge.style.display = 'none';

    try {
        const response = await fetch(`${baseUrl}/v1/models`, {
            headers: {
                'Authorization': `Bearer ${key}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.data && Array.isArray(data.data)) {
            dom.statusDot.className = 'status-dot active';
            dom.statusText.textContent = t.statusActive;

            // Re-populate availableModels array
            availableModels = data.data.map(m => m.id);

            // Auto-select a model if selectedModel is empty or not in the fetched list
            let savedModelInList = availableModels.includes(selectedModel);
            if (!savedModelInList && availableModels.length > 0) {
                // Find gemini-2.5-flash (exact or substring)
                const geminiFlash = availableModels.find(id => id === 'gemini-2.5-flash') ||
                    availableModels.find(id => id.toLowerCase().includes('gemini-2.5-flash'));
                if (geminiFlash) {
                    selectedModel = geminiFlash;
                } else {
                    // Find a model containing "free" (case-insensitive)
                    const freeModel = availableModels.find(id => id.toLowerCase().includes('free'));
                    if (freeModel) {
                        selectedModel = freeModel;
                    } else {
                        selectedModel = availableModels[0];
                    }
                }
                localStorage.setItem(KEYS.DEFAULT_MODEL, selectedModel);
            }

            dom.modelSelectTrigger.disabled = false;
            dom.modelSelectText.textContent = selectedModel || (lang === 'vi' ? 'Chọn model' : 'Select model');

            // Re-enable chat input and restore placeholder
            dom.chatInput.disabled = false;
            dom.chatInput.placeholder = t.placeholderInput;

            renderCustomModelSelect('');
            checkSendButtonState();
        } else {
            throw new Error('Invalid models data payload');
        }
    } catch (err) {
        console.error(err);
        dom.statusDot.className = 'status-dot error';
        dom.statusText.textContent = t.statusError;

        dom.modelSelectTrigger.disabled = true;
        dom.modelSelectText.textContent = `(${t.statusError})`;
        availableModels = [];
        renderCustomModelSelect('');

        // Disable input and update placeholder to show error
        dom.chatInput.disabled = true;
        dom.chatInput.placeholder = lang === 'vi' 
            ? 'API Key sai hoặc lỗi kết nối. Vui lòng cấu hình lại trong Cài đặt...' 
            : 'Invalid API Key or connection error. Please reconfigure in Settings...';
        
        checkSendButtonState();

        showToast(t.loadModelsErr, 'error');
    }
}

// Render custom popover options list
function renderCustomModelSelect(filterQuery = '') {
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';

    // Filter available models
    const filtered = availableModels.filter(m =>
        m.toLowerCase().includes(filterQuery.toLowerCase())
    );

    let html = '';

    // Render filtered list
    filtered.forEach(m => {
        const isSelected = m === selectedModel;
        let displayName = m;
        if (m === 'dc-assistant') {
            displayName = lang === 'vi' ? 'Trợ lý DC AI' : 'DC AI Assistant';
        } else if (m === 'dc-ai-model') {
            displayName = lang === 'vi' ? 'Trợ lý DC AI Model' : 'DC AI Model Assistant';
        }
        html += `
            <div class="popover-option ${isSelected ? 'selected' : ''}" data-model="${m}">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${displayName}</span>
                ${isSelected ? '<i data-lucide="check" style="width:0.875rem;height:0.875rem;color:var(--color-active);flex-shrink:0;"></i>' : ''}
            </div>
        `;
    });

    // If query is not empty and not in the list, offer to use as custom model
    const trimmedQuery = filterQuery.trim();
    if (trimmedQuery && !availableModels.some(m => m.toLowerCase() === trimmedQuery.toLowerCase())) {
        html += `
            <div class="popover-option popover-custom-option" data-model="${trimmedQuery}" style="color: var(--color-violet); font-weight:600;">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:center; gap:0.25rem;">
                    <i data-lucide="plus" style="width:0.85rem;height:0.85rem;"></i>
                    ${lang === 'vi' ? 'Dùng model: ' : 'Use model: '} "${trimmedQuery}"
                </span>
            </div>
        `;
    }

    if (filtered.length === 0 && !trimmedQuery) {
        html = `<div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size:0.75rem;">${lang === 'vi' ? 'Không tìm thấy model nào' : 'No active models found'}</div>`;
    }

    dom.modelOptionsList.innerHTML = html;
    createIconsSafe();
}

// Helper to select and apply model
function selectModelValue(modelName) {
    selectedModel = modelName;
    localStorage.setItem(KEYS.DEFAULT_MODEL, selectedModel);

    // Update trigger text
    dom.modelSelectText.textContent = selectedModel || (localStorage.getItem(KEYS.LANGUAGE) === 'vi' ? 'Chọn model' : 'Select model');

    // Show toast
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    showToast(TRANSLATIONS[lang].toastModelSwitched.replace('{model}', selectedModel), 'success');

    // Refresh selections in view
    renderCustomModelSelect(dom.modelSearchInput.value);
    checkSendButtonState();
}

// Bind event listeners
function bindEvents() {
    // Sidebar mobile toggle
    dom.sidebarOpenBtn.addEventListener('click', () => {
        dom.sidebar.classList.add('mobile-open');
        dom.sidebarBackdrop.classList.add('mobile-show');
    });

    const closeSidebar = () => {
        dom.sidebar.classList.remove('mobile-open');
        dom.sidebarBackdrop.classList.remove('mobile-show');
    };

    dom.sidebarCloseBtn.addEventListener('click', closeSidebar);
    dom.sidebarBackdrop.addEventListener('click', closeSidebar);

    // Settings modal triggers
    const openModal = () => {
        dom.apiKeyInput.value = localStorage.getItem(KEYS.API_KEY) || '';
        if (dom.systemPromptInput) {
            dom.systemPromptInput.value = localStorage.getItem(KEYS.SYSTEM_PROMPT) || '';
        }
        const languageSelect = document.getElementById('languageSelect');
        if (languageSelect) {
            languageSelect.value = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
        }
        dom.settingsModal.classList.add('active');
    };

    const closeModal = () => {
        dom.settingsModal.classList.remove('active');
    };

    dom.settingsBtn.addEventListener('click', openModal);
    dom.keyWarningBadge.addEventListener('click', openModal);
    dom.modalCloseBtn.addEventListener('click', closeModal);
    dom.modalCancelBtn.addEventListener('click', closeModal);

    dom.modalSaveBtn.addEventListener('click', async () => {
        const key = dom.apiKeyInput.value.trim();
        const systemPrompt = dom.systemPromptInput ? dom.systemPromptInput.value.trim() : '';
        const lang = document.getElementById('languageSelect').value;
        const t = TRANSLATIONS[lang];

        if (key) {
            const origBtnText = dom.modalSaveBtn.textContent;
            dom.modalSaveBtn.disabled = true;
            dom.modalSaveBtn.textContent = lang === 'vi' ? 'Đang xác minh...' : 'Verifying...';

            try {
                const baseUrl = localStorage.getItem(KEYS.BASE_URL) || window.location.origin;
                const response = await fetch(`${baseUrl}/v1/models`, {
                    headers: {
                        'Authorization': `Bearer ${key}`
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                if (!data.data || !Array.isArray(data.data)) {
                    throw new Error('Invalid models payload');
                }
            } catch (err) {
                dom.modalSaveBtn.disabled = false;
                dom.modalSaveBtn.textContent = origBtnText;
                showToast(
                    lang === 'vi'
                        ? 'Key không hợp lệ hoặc lỗi kết nối!'
                        : 'Invalid key or connection error!',
                    'error'
                );
                return;
            }
            dom.modalSaveBtn.disabled = false;
            dom.modalSaveBtn.textContent = origBtnText;
        }

        localStorage.setItem(KEYS.API_KEY, key);
        localStorage.setItem(KEYS.SYSTEM_PROMPT, systemPrompt);
        localStorage.setItem(KEYS.LANGUAGE, lang);

        closeModal();
        applyLanguage();
        showToast(TRANSLATIONS[lang].toastSaved, 'success');
        validateConfigAndLoadModels();
    });

    // Toggle show/hide password
    dom.togglePasswordBtn.addEventListener('click', () => {
        const eyeIcon = document.getElementById('togglePasswordBtn').querySelector('svg');
        if (dom.apiKeyInput.type === 'password') {
            dom.apiKeyInput.type = 'text';
            if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye-off');
        } else {
            dom.apiKeyInput.type = 'password';
            if (eyeIcon) eyeIcon.setAttribute('data-lucide', 'eye');
        }
        createIconsSafe();
    });

    // Custom Model Select popover toggler
    dom.modelSelectTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dom.modelSelectWrapper.classList.toggle('open');
        if (isOpen) {
            dom.modelSearchInput.value = '';
            renderCustomModelSelect('');
            setTimeout(() => dom.modelSearchInput.focus(), 50);
        }
    });

    // Custom Model Select search input
    dom.modelSearchInput.addEventListener('input', (e) => {
        renderCustomModelSelect(e.target.value);
    });

    // Custom Model Select option click delegation
    dom.modelOptionsList.addEventListener('click', (e) => {
        const option = e.target.closest('.popover-option');
        if (option) {
            const modelName = option.getAttribute('data-model');
            selectModelValue(modelName);
            dom.modelSelectWrapper.classList.remove('open');
        }
    });

    // Close model select popover when clicking outside
    document.addEventListener('click', (e) => {
        if (dom.modelSelectWrapper && !e.target.closest('#modelSelectWrapper')) {
            dom.modelSelectWrapper.classList.remove('open');
        }
    });

    // Input changes
    dom.chatInput.addEventListener('input', () => {
        dom.chatInput.style.height = 'auto';
        dom.chatInput.style.height = dom.chatInput.scrollHeight + 'px';
        checkSendButtonState();
    });

    // Textarea Enter handler
    dom.chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!dom.sendBtn.disabled) {
                dom.chatForm.requestSubmit();
            }
        }
    });

    // Form Submit (send or stop message generation)
    dom.chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (activeController || activeReader) {
            if (activeController) {
                try {
                    activeController.abort();
                } catch (err) {
                    console.error('Failed to abort fetch:', err);
                }
            }
            if (activeReader && typeof activeReader.cancel === 'function') {
                try {
                    activeReader.cancel();
                } catch (err) {
                    console.error('Failed to cancel reader:', err);
                }
            }
            activeReader = null;
            activeController = null;
            return;
        }

        const prompt = dom.chatInput.value.trim();
        if (!prompt) return;

        dom.chatInput.value = '';
        dom.chatInput.style.height = '38px';
        dom.sendBtn.disabled = true;

        await sendMessage(prompt);
    });

    // New chat button (sidebar)
    dom.newChatBtn.addEventListener('click', () => {
        createNewSession();
        closeSidebar();
    });

    // New chat button (mobile header top-right)
    if (dom.newChatBtnMobile) {
        dom.newChatBtnMobile.addEventListener('click', () => {
            createNewSession();
        });
    }

    // Clear all chats history
    dom.clearAllBtn.addEventListener('click', () => {
        const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
        const t = TRANSLATIONS[lang];
        if (confirm(t.clearAllConfirm)) {
            localStorage.removeItem(KEYS.SESSIONS);
            localStorage.removeItem(KEYS.CURRENT_SESSION_ID);
            activeSessions = [];
            currentSessionId = null;
            renderSessionsList();
            loadSession(null);
            showToast(t.toastClearAll, 'success');
        }
    });

    // Scroll to bottom button
    if (dom.scrollToBottomBtn) {
        dom.scrollToBottomBtn.addEventListener('click', () => {
            dom.chatMessages.scrollTo({ top: dom.chatMessages.scrollHeight, behavior: 'smooth' });
        });
    }

    // Show/hide scroll-to-bottom button on scroll
    dom.chatMessages.addEventListener('scroll', () => {
        updateScrollToBottomVisibility();
    }, { passive: true });

    // Attachment button click
    if (dom.attachBtn) {
        dom.attachBtn.addEventListener('click', () => {
            dom.imageInput.click();
        });
    }

// Compress image before loading it to reduce size and token usage
function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress image to JPEG format with specified quality
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };
            img.onerror = (err) => reject(err);
            img.src = e.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

    // Attachment change event
    if (dom.imageInput) {
        dom.imageInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
            const t = TRANSLATIONS[lang];

            for (const file of files) {
                if (!file.type.startsWith('image/')) {
                    showToast(lang === 'vi' ? 'Chỉ hỗ trợ file ảnh!' : 'Only image files are supported!', 'error');
                    continue;
                }
                // Limit maximum file size to 5MB for guest users (no custom key in localStorage)
                if (!localStorage.getItem(KEYS.API_KEY)) {
                    const maxGuestSizeBytes = 5 * 1024 * 1024;
                    if (file.size > maxGuestSizeBytes) {
                        showToast(
                            lang === 'vi'
                                ? 'Khách chỉ được tải lên ảnh tối đa 5MB!'
                                : 'Guests can only upload images up to 5MB!',
                            'error'
                        );
                        continue;
                    }
                }

                try {
                    // Compress image to max 1200px dimension and 0.8 JPEG quality
                    const base64Url = await compressImage(file, 1200, 1200, 0.8);
                    selectedImages.push(base64Url);
                    renderImagePreviews();
                    checkSendButtonState();
                } catch (err) {
                    console.error('Failed to compress image:', err);
                    showToast(
                        lang === 'vi'
                            ? 'Lỗi khi xử lý hình ảnh!'
                            : 'Error processing image!',
                        'error'
                    );
                }
            }
            dom.imageInput.value = '';
        });
    }

    // Web Search Toggle click
    if (dom.webSearchToggleBtn) {
        dom.webSearchToggleBtn.addEventListener('click', () => {
            webSearchEnabled = !webSearchEnabled;
            dom.webSearchToggleBtn.classList.toggle('active', webSearchEnabled);

            const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
            const msg = webSearchEnabled
                ? (lang === 'vi' ? 'Đã bật tìm kiếm Web' : 'Web search enabled')
                : (lang === 'vi' ? 'Đã tắt tìm kiếm Web' : 'Web search disabled');
            showToast(msg, 'success');
        });
    }
}

// Render image preview thumbnails
function renderImagePreviews() {
    if (!dom.imagePreviewContainer) return;

    if (selectedImages.length === 0) {
        dom.imagePreviewContainer.style.display = 'none';
        dom.imagePreviewContainer.innerHTML = '';
        return;
    }

    dom.imagePreviewContainer.style.display = 'flex';
    dom.imagePreviewContainer.innerHTML = selectedImages.map((img, idx) => `
        <div class="image-preview-item">
            <img src="${img}" alt="Preview">
            <button type="button" class="image-preview-remove" data-index="${idx}" title="Xóa ảnh">&times;</button>
        </div>
    `).join('');

    // Bind remove button events
    dom.imagePreviewContainer.querySelectorAll('.image-preview-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.target.getAttribute('data-index'));
            selectedImages.splice(idx, 1);
            renderImagePreviews();
            checkSendButtonState();
        });
    });
}

// Create a new session
function createNewSession(initialMsg = '') {
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    const t = TRANSLATIONS[lang];

    // Find if there is already an empty session in the list
    const emptySession = activeSessions.find(s => s.messages.length === 0);
    if (emptySession) {
        // Move it to the top of the list if it's not already there
        const idx = activeSessions.indexOf(emptySession);
        if (idx > 0) {
            activeSessions.splice(idx, 1);
            activeSessions.unshift(emptySession);
        }
        
        // Reset or set the title
        emptySession.title = initialMsg ? (initialMsg.slice(0, 30) + (initialMsg.length > 30 ? '...' : '')) : t.newChat;
        emptySession.timestamp = Date.now();
        
        saveSessions();
        currentSessionId = emptySession.id;
        localStorage.setItem(KEYS.CURRENT_SESSION_ID, currentSessionId);
        
        renderSessionsList();
        loadSession(currentSessionId);
        
        // Refocus chat input
        if (dom.chatInput) {
            dom.chatInput.focus();
        }
        
        return emptySession;
    }

    // Otherwise, create a new one
    const newSession = {
        id: 'session_' + Date.now(),
        title: initialMsg ? (initialMsg.slice(0, 30) + (initialMsg.length > 30 ? '...' : '')) : t.newChat,
        messages: [],
        timestamp: Date.now()
    };

    activeSessions.unshift(newSession);
    saveSessions();

    currentSessionId = newSession.id;
    localStorage.setItem(KEYS.CURRENT_SESSION_ID, currentSessionId);

    renderSessionsList();
    loadSession(currentSessionId);
    
    // Refocus chat input
    if (dom.chatInput) {
        dom.chatInput.focus();
    }

    return newSession;
}

// Load specific session messages
function loadSession(sessionId) {
    currentSessionId = sessionId;
    localStorage.setItem(KEYS.CURRENT_SESSION_ID, sessionId || '');

    document.querySelectorAll('.history-item').forEach(el => {
        if (el.dataset.id === sessionId) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    const session = activeSessions.find(s => s.id === sessionId);

    if (!session || session.messages.length === 0) {
        renderEmptyState();
        return;
    }

    dom.chatMessages.innerHTML = '';
    session.messages.forEach(msg => {
        appendMessageBubble(msg.role, msg.content, false, msg.searchResults);
    });

    scrollToBottom(true);
    dom.chatInput.focus();
}

// Render Empty State page
function renderEmptyState() {
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    const t = TRANSLATIONS[lang];

    dom.chatMessages.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">
                <i data-lucide="sparkles" style="width:2.25rem;height:2.25rem;"></i>
            </div>
            <h1>${t.welcomeTitle}</h1>
            <p>${t.welcomeDesc}</p>
            
            <div class="suggestions-grid">
                <div class="suggestion-card" data-prompt="${t.suggest1Prompt}">
                    <h4><i data-lucide="key-round" style="width:0.875rem;height:0.875rem;color:var(--color-violet)"></i> ${t.suggest1Title}</h4>
                    <p>${t.suggest1Desc}</p>
                </div>
                <div class="suggestion-card" data-prompt="${t.suggest2Prompt}">
                    <h4><i data-lucide="code" style="width:0.875rem;height:0.875rem;color:var(--color-primary)"></i> ${t.suggest2Title}</h4>
                    <p>${t.suggest2Desc}</p>
                </div>
                <div class="suggestion-card" data-prompt="${t.suggest3Prompt}">
                    <h4><i data-lucide="settings-2" style="width:0.875rem;height:0.875rem;color:var(--color-active)"></i> ${t.suggest3Title}</h4>
                    <p>${t.suggest3Desc}</p>
                </div>
                <div class="suggestion-card" data-prompt="${t.suggest4Prompt}">
                    <h4><i data-lucide="bar-chart-3" style="width:0.875rem;height:0.875rem;color:var(--color-violet)"></i> ${t.suggest4Title}</h4>
                    <p>${t.suggest4Desc}</p>
                </div>
            </div>
        </div>
    `;

    // Hook up cards
    dom.chatMessages.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
            const promptText = card.getAttribute('data-prompt');
            dom.chatInput.value = promptText;
            dom.chatInput.dispatchEvent(new Event('input'));
            dom.chatForm.requestSubmit();
        });
    });

    createIconsSafe();
}

// Render sessions list in sidebar
function renderSessionsList() {
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    const t = TRANSLATIONS[lang];

    if (activeSessions.length === 0) {
        dom.historyList.innerHTML = `<div class="no-data" style="padding: 2rem 0; font-size:0.8rem; text-align: center; color: var(--text-muted);">${t.noHistory}</div>`;
        return;
    }

    dom.historyList.innerHTML = '';

    activeSessions.forEach(s => {
        const isActive = s.id === currentSessionId;
        const item = document.createElement('div');
        item.className = `history-item ${isActive ? 'active' : ''}`;
        item.dataset.id = s.id;

        item.innerHTML = `
            <div class="history-title-wrap">
                <i data-lucide="message-square" style="width:0.9rem;height:0.9rem;flex-shrink:0;"></i>
                <span class="history-title">${escapeHTML(s.title)}</span>
            </div>
            <button class="delete-session-btn" title="${lang === 'vi' ? 'Xóa hội thoại' : 'Delete conversation'}">
                <i data-lucide="x" style="width:0.85rem;height:0.85rem;"></i>
            </button>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.delete-session-btn')) {
                e.stopPropagation();
                deleteSession(s.id);
                return;
            }
            loadSession(s.id);
        });

        dom.historyList.appendChild(item);
    });

    createIconsSafe();
}

// Delete a session
function deleteSession(sessionId) {
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    const t = TRANSLATIONS[lang];
    activeSessions = activeSessions.filter(s => s.id !== sessionId);
    saveSessions();

    if (currentSessionId === sessionId) {
        currentSessionId = activeSessions.length > 0 ? activeSessions[0].id : null;
        localStorage.setItem(KEYS.CURRENT_SESSION_ID, currentSessionId || '');
    }

    renderSessionsList();
    loadSession(currentSessionId);
    showToast(t.toastSessionDeleted, 'success');
}

function checkSendButtonState() {
    const hasText = dom.chatInput.value.trim().length > 0;
    const hasInput = hasText;
    const hasModel = selectedModel !== '';
    const sendIcon = document.getElementById('sendIcon');

    if (activeReader || activeController) {
        dom.sendBtn.disabled = false;
        dom.sendBtn.className = 'btn-send stop-streaming';
        if (sendIcon) sendIcon.setAttribute('data-lucide', 'square');
    } else {
        dom.sendBtn.disabled = !(hasInput && hasModel);
        dom.sendBtn.className = 'btn-send';
        if (sendIcon) sendIcon.setAttribute('data-lucide', 'arrow-up');
    }
    createIconsSafe();
}

// Parse thinking tokens from model output
function parseThinking(text) {
    const thinkStart = text.indexOf('<think>');
    if (thinkStart === -1) {
        return { thinking: '', content: text, isThinking: false };
    }

    const thinkEnd = text.indexOf('</think>');
    if (thinkEnd === -1) {
        const thinkingVal = text.substring(thinkStart + 7);
        return { thinking: thinkingVal, content: '', isThinking: true };
    } else {
        const thinkingVal = text.substring(thinkStart + 7, thinkEnd);
        const contentVal = text.substring(thinkEnd + 8);
        return { thinking: thinkingVal, content: contentVal, isThinking: false };
    }
}

// Preprocess LaTeX math delimiters to standardize multiple backslashes
function preprocessMath(text) {
    if (!text) return '';
    // Standardize double backslash delimiters into single backslash delimiters
    let processed = text.replace(/\\\\+\[/g, '\\[').replace(/\\\\+\]/g, '\\]');
    processed = processed.replace(/\\\\+\(/g, '\\(').replace(/\\\\+\)/g, '\\)');
    return processed;
}

// Custom Markdown parser that protects mathematical equations from markdown parsing mangling
function parseMarkdown(text) {
    if (!text) return '';
    const mathBlocks = [];
    let processedText = '';
    let i = 0;

    while (i < text.length) {
        // Check for block math $$
        if (text.startsWith('$$', i)) {
            let start = i;
            let end = text.indexOf('$$', i + 2);
            if (end !== -1) {
                const rawMath = text.substring(start, end + 2);
                const placeholder = `%%MATH_BLOCK_${mathBlocks.length}%%`;
                mathBlocks.push(rawMath);
                processedText += placeholder;
                i = end + 2;
                continue;
            }
        }
        // Check for block math \[ ... \]
        if (text.startsWith('\\[', i)) {
            let start = i;
            let end = text.indexOf('\\]', i + 2);
            if (end !== -1) {
                const rawMath = text.substring(start, end + 2);
                const placeholder = `%%MATH_BLOCK_${mathBlocks.length}%%`;
                mathBlocks.push(rawMath);
                processedText += placeholder;
                i = end + 2;
                continue;
            }
        }
        // Check for inline math \( ... \)
        if (text.startsWith('\\(', i)) {
            let start = i;
            let end = text.indexOf('\\)', i + 2);
            if (end !== -1) {
                const rawMath = text.substring(start, end + 2);
                const placeholder = `%%MATH_BLOCK_${mathBlocks.length}%%`;
                mathBlocks.push(rawMath);
                processedText += placeholder;
                i = end + 2;
                continue;
            }
        }
        // Check for inline math $
        if (text[i] === '$') {
            let start = i;
            let nextNewLine = text.indexOf('\n', i);
            let end = text.indexOf('$', i + 1);
            if (end !== -1 && (nextNewLine === -1 || end < nextNewLine)) {
                // Ensure no space after opening $ and no space before closing $
                const charAfterOpen = text[i + 1];
                const charBeforeClose = text[end - 1];
                if (charAfterOpen !== ' ' && charAfterOpen !== '\t' &&
                    charBeforeClose !== ' ' && charBeforeClose !== '\t' &&
                    end > i + 1) {
                    const rawMath = text.substring(start, end + 1);
                    const placeholder = `%%MATH_BLOCK_${mathBlocks.length}%%`;
                    mathBlocks.push(rawMath);
                    processedText += placeholder;
                    i = end + 1;
                    continue;
                }
            }
        }

        processedText += text[i];
        i++;
    }

    // Parse markdown
    let html = '';
    try {
        html = marked.parse(processedText);
    } catch (e) {
        console.error('marked parsing error:', e);
        html = processedText;
    }

    // Restore math blocks safely using split/join to avoid replacement string $ issues
    for (let index = 0; index < mathBlocks.length; index++) {
        const placeholder = `%%MATH_BLOCK_${index}%%`;
        const originalMath = mathBlocks[index];
        html = html.split(placeholder).join(originalMath);
    }

    return html;
}

// Render KaTeX equations in DOM element
function renderMath(element) {
    if (element && typeof renderMathInElement === 'function') {
        try {
            renderMathInElement(element, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true }
                ],
                throwOnError: false
            });
        } catch (err) {
            console.error('KaTeX rendering error:', err);
        }
    }
}

// Render thinking collapsible block + markdown response content
// Safely replace [Nguồn X] or [Source X] or [X] inside parsed HTML with links pointing to search results
function replaceCitations(html, searchResults) {
    if (!searchResults || searchResults.length === 0) return html;

    const regex = /(<[^>]+>|\[(?:Nguồn|Source)?\s*\d+\])/gi;

    return html.replace(regex, (match) => {
        if (match.startsWith('<')) {
            return match;
        }

        const digits = match.match(/\d+/);
        if (digits) {
            const index = parseInt(digits[0]) - 1;
            if (index >= 0 && index < searchResults.length) {
                const url = searchResults[index].url;
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="citation-link">${match}</a>`;
            }
        }
        return match;
    });
}

// Render thinking collapsible block + markdown response content
function renderMessageContent(content, searchResults = []) {
    const preprocessed = preprocessMath(content);
    const { thinking, content: mainContent, isThinking } = parseThinking(preprocessed);
    let html = '';

    if (thinking) {
        const thinkingHtml = parseMarkdown(thinking);
        const brainIconSvg = `<svg class="thinking-brain-icon ${isThinking ? 'pulsing' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"></path><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"></path><path d="M12 5v14"></path><path d="M12 9h4"></path><path d="M12 14h-4"></path></svg>`;
        const arrowSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M19 9l-7 7-7-7"/></svg>`;

        const isCollapsed = !isThinking;

        const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
        const t = TRANSLATIONS[lang];
        const statusText = isThinking ? t.thinkingText : t.thoughtText;

        html += `
            <div class="thinking-block ${isCollapsed ? 'collapsed' : ''}">
                <div class="thinking-header">
                    <span class="thinking-title">
                        ${brainIconSvg}
                        <span class="thinking-status-text">${statusText}</span>
                    </span>
                    <span class="thinking-toggle-arrow">${arrowSvg}</span>
                </div>
                <div class="thinking-content">${thinkingHtml}</div>
            </div>
        `;
    }

    if (mainContent || !thinking) {
        let mainHtml = parseMarkdown(mainContent || '');
        if (searchResults && searchResults.length > 0) {
            mainHtml = replaceCitations(mainHtml, searchResults);
        }
        html += `<div class="main-response-content">${mainHtml}</div>`;
    }

    return html;
}

// Global toggle thinking function hook
window.toggleThinking = function (header) {
    const block = header.closest('.thinking-block');
    if (block) {
        block.classList.toggle('collapsed');
    }
};

// Delegate click events for dynamic UI components
document.addEventListener('click', async (e) => {
    // 1. Collapsible thinking block toggle
    const thinkingHeader = e.target.closest('.thinking-header');
    if (thinkingHeader) {
        window.toggleThinking(thinkingHeader);
        return;
    }

    // 2. Code block copy button
    const copyBtn = e.target.closest('.code-block-copy-btn');
    if (copyBtn) {
        const codeId = copyBtn.getAttribute('data-code-id');
        const codeEl = document.getElementById(codeId);
        if (codeEl) {
            const rawCode = codeEl.textContent;
            try {
                await navigator.clipboard.writeText(rawCode);

                const copyText = copyBtn.querySelector('.copy-text');
                const copyIcon = copyBtn.querySelector('.copy-icon');
                const originalText = copyText.textContent;
                const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';

                copyText.textContent = lang === 'vi' ? 'Đã sao chép' : 'Copied';
                copyBtn.classList.add('copied');

                if (copyIcon) {
                    copyIcon.setAttribute('data-lucide', 'check');
                    createIconsSafe();
                }

                setTimeout(() => {
                    copyText.textContent = originalText;
                    copyBtn.classList.remove('copied');
                    if (copyIcon) {
                        copyIcon.setAttribute('data-lucide', 'copy');
                        createIconsSafe();
                    }
                }, 2000);
            } catch (err) {
                console.error('Failed to copy code: ', err);
            }
        }
        return;
    }

    // 3. Message Actions - Copy Message
    const copyMsgBtn = e.target.closest('.copy-msg-btn');
    if (copyMsgBtn) {
        const bubble = copyMsgBtn.closest('.message-content-box').querySelector('.message-bubble');
        const rawContent = bubble ? bubble.getAttribute('data-raw-content') : '';
        try {
            await navigator.clipboard.writeText(rawContent);
            const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
            const t = TRANSLATIONS[lang];
            showToast(t.copied || 'Đã sao chép tin nhắn', 'success');

            const copyIcon = copyMsgBtn.querySelector('i') || copyMsgBtn.querySelector('svg');
            if (copyIcon) {
                copyIcon.setAttribute('data-lucide', 'check');
                createIconsSafe();
                setTimeout(() => {
                    copyIcon.setAttribute('data-lucide', 'copy');
                    createIconsSafe();
                }, 2000);
            }
        } catch (err) {
            console.error('Failed to copy message:', err);
        }
        return;
    }

    // 4. Message Actions - Delete Message
    const deleteMsgBtn = e.target.closest('.delete-msg-btn');
    if (deleteMsgBtn) {
        const wrapper = deleteMsgBtn.closest('.message-wrapper');
        const session = activeSessions.find(s => s.id === currentSessionId);
        const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
        const t = TRANSLATIONS[lang];

        if (wrapper && session) {
            const messageWrappers = Array.from(dom.chatMessages.querySelectorAll('.message-wrapper'));
            const index = messageWrappers.indexOf(wrapper);
            if (index !== -1) {
                session.messages.splice(index, 1);
                saveSessions();
                wrapper.remove();
                showToast(t.toastSessionDeleted || 'Đã xóa tin nhắn', 'success');

                if (session.messages.length === 0) {
                    renderEmptyState();
                    session.title = t.newChat;
                    renderSessionsList();
                }
            }
        }
        return;
    }

    // 5. Message Actions - Regenerate Message
    const regenerateMsgBtn = e.target.closest('.regenerate-msg-btn');
    if (regenerateMsgBtn) {
        const wrapper = regenerateMsgBtn.closest('.message-wrapper');
        const session = activeSessions.find(s => s.id === currentSessionId);

        if (wrapper && session && !activeController && !activeReader) {
            const messageWrappers = Array.from(dom.chatMessages.querySelectorAll('.message-wrapper'));
            const index = messageWrappers.indexOf(wrapper);
            if (index !== -1) {
                // Find preceding user prompt
                let userPrompt = '';
                let sliceIndex = index;
                for (let i = index - 1; i >= 0; i--) {
                    if (session.messages[i].role === 'user') {
                        userPrompt = session.messages[i].content;
                        sliceIndex = i;
                        break;
                    }
                }

                if (userPrompt) {
                    // Truncate session messages from sliceIndex + 1 onwards
                    session.messages = session.messages.slice(0, sliceIndex + 1);
                    saveSessions();

                    // Remove DOM elements from sliceIndex + 1 onwards
                    for (let i = messageWrappers.length - 1; i > sliceIndex; i--) {
                        messageWrappers[i].remove();
                    }

                    // Reset input and regenerate
                    dom.chatInput.value = '';
                    dom.chatInput.style.height = '38px';
                    dom.sendBtn.disabled = true;

                    await sendMessage(userPrompt, true);
                }
            }
        }
        return;
    }
});

// Append message bubble to chat viewport
function appendMessageBubble(role, content, isTemporary = false, searchResults = null) {
    const emptyEl = dom.chatMessages.querySelector('.empty-state');
    if (emptyEl) {
        dom.chatMessages.innerHTML = '';
    }

    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;
    if (isTemporary) wrapper.id = 'tempAssistantMessage';

    let avatarHTML = '';
    if (role === 'user') {
        avatarHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 1.15rem; height: 1.15rem;">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        `;
    } else {
        avatarHTML = `
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 1.25rem; height: 1.25rem;">
                <path d="M16 3L28 10V22L16 29L4 22V10L16 3Z" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" />
                <path d="M16 10L22 13V19L16 22L10 19V13L16 10Z" fill="#ffffff" opacity="0.35" />
                <circle cx="16" cy="16" r="3" fill="#ffffff" />
            </svg>
        `;
    }
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    const t = TRANSLATIONS[lang];

    let textStr = '';
    let imagesHTML = '';

    if (Array.isArray(content)) {
        content.forEach(part => {
            if (part.type === 'text') {
                textStr += part.text;
            } else if (part.type === 'image_url') {
                imagesHTML += `
                    <div class="message-bubble-image-container">
                        <img src="${part.image_url.url}" class="message-bubble-image" alt="Uploaded Image">
                    </div>
                `;
            }
        });
    } else if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                parsed.forEach(part => {
                    if (part.type === 'text') {
                        textStr += part.text;
                    } else if (part.type === 'image_url') {
                        imagesHTML += `
                            <div class="message-bubble-image-container">
                                <img src="${part.image_url.url}" class="message-bubble-image" alt="Uploaded Image">
                            </div>
                        `;
                    }
                });
            } else {
                textStr = content;
            }
        } catch (e) {
            textStr = content;
        }
    }

    let htmlContent = escapeHTML(textStr);
    if (role === 'assistant') {
        htmlContent = renderMessageContent(textStr, searchResults);
    }

    const isAssistant = role === 'assistant';
    const actionsHTML = `
        <div class="message-actions">
            <button class="btn-msg-action copy-msg-btn" title="${t.copyMessage || 'Sao chép tin nhắn'}">
                <i data-lucide="copy" style="width:0.85rem;height:0.85rem;"></i>
            </button>
            <button class="btn-msg-action delete-msg-btn" title="${t.deleteMessage || 'Xóa tin nhắn'}">
                <i data-lucide="trash-2" style="width:0.85rem;height:0.85rem;"></i>
            </button>
            ${isAssistant ? `
            <button class="btn-msg-action regenerate-msg-btn" title="${t.regenerate || 'Tạo lại'}">
                <i data-lucide="refresh-cw" style="width:0.85rem;height:0.85rem;"></i>
            </button>
            ` : ''}
        </div>
    `;

    // Render search grounding results
    let searchGroundingHTML = '';
    if (searchResults && searchResults.length > 0) {
        const uniqueId = 'grounding-' + Math.random().toString(36).substring(2, 9);
        const titleText = lang === 'vi' ? `Xem nguồn tham khảo (${searchResults.length})` : `Sources (${searchResults.length})`;

        searchGroundingHTML = `
            <div class="search-grounding-container" id="${uniqueId}">
                <div class="search-grounding-header" onclick="const listEl = document.getElementById('${uniqueId}-list'); listEl.style.display = listEl.style.display === 'none' ? 'flex' : 'none';">
                    <i data-lucide="globe" style="width:0.85rem;height:0.85rem;"></i>
                    <span>${titleText}</span>
                    <i data-lucide="chevron-down" style="width:0.75rem;height:0.75rem; margin-left:auto;"></i>
                </div>
                <div class="search-grounding-list" id="${uniqueId}-list" style="display: none;">
                    ${searchResults.map((res, i) => `
                        <a href="${res.url}" target="_blank" rel="noopener noreferrer" class="search-grounding-item">
                            <i data-lucide="external-link" class="search-grounding-icon" style="width:0.75rem;height:0.75rem;"></i>
                            <span>[${i + 1}] ${escapeHTML(res.title)}</span>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;
    }

    wrapper.innerHTML = `
        <div class="message-avatar">${avatarHTML}</div>
        <div class="message-content-box">
            <div class="message-meta">${role === 'user' ? t.userMeta : (localStorage.getItem(KEYS.API_KEY) ? selectedModel : 'DC AI Assistant')}</div>
            <div class="message-bubble" data-raw-content="${escapeHTML(textStr)}">
                ${imagesHTML}
                <div class="message-text">${htmlContent}</div>
                ${searchGroundingHTML}
            </div>
            ${actionsHTML}
        </div>
    `;

    dom.chatMessages.appendChild(wrapper);

    if (role === 'assistant' && hljs && typeof hljs.highlightElement === 'function') {
        wrapper.querySelectorAll('pre code').forEach((block) => {
            try {
                hljs.highlightElement(block);
            } catch (e) {
                console.error('Highlight failed:', e);
            }
        });
    }

    renderMath(wrapper);
    requestAnimationFrame(() => scrollToBottom(true));
    return wrapper;
}

// Send message API request
async function sendMessage(prompt, isRegenerate = false) {
    let session = activeSessions.find(s => s.id === currentSessionId);
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    const t = TRANSLATIONS[lang];

    // Construct userMessageContent (text + images if selected)
    let userMessageContent = prompt;
    if (selectedImages.length > 0 && !isRegenerate) {
        userMessageContent = [];
        if (prompt) {
            userMessageContent.push({ type: 'text', text: prompt });
        }
        selectedImages.forEach(img => {
            userMessageContent.push({
                type: 'image_url',
                image_url: { url: img }
            });
        });
    }

    if (!session) {
        session = createNewSession(prompt);
    } else if (session.messages.length === 0) {
        session.title = prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '');
        renderSessionsList();
    }

    if (!isRegenerate) {
        appendMessageBubble('user', userMessageContent, false);
        session.messages.push({ role: 'user', content: userMessageContent });
        saveSessions();
    }

    // Clear previews and reset input state
    selectedImages = [];
    renderImagePreviews();

    const assistantWrapper = appendMessageBubble('assistant', '', true);
    const textContainer = assistantWrapper.querySelector('.message-text');
    const bubbleEl = assistantWrapper.querySelector('.message-bubble');

    textContainer.innerHTML = `
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;

    let apiKey = localStorage.getItem(KEYS.API_KEY);
    if (!apiKey) {
        apiKey = guestApiKey;
    }
    const baseUrl = localStorage.getItem(KEYS.BASE_URL);
    let systemPrompt = localStorage.getItem(KEYS.SYSTEM_PROMPT);
    if (!systemPrompt) {
        systemPrompt = t.defaultSystemPrompt;
    }

    // Handle Web Search if enabled
    let searchResultsList = [];
    let searchResultsContext = '';
    const searchEnabledThisTime = webSearchEnabled;
    if (webSearchEnabled) {
        webSearchEnabled = false;
        if (dom.webSearchToggleBtn) {
            dom.webSearchToggleBtn.classList.remove('active');
        }
    }
    if (searchEnabledThisTime) {
        try {
            textContainer.innerHTML = `
                <div class="search-progress-box">
                    <div class="search-progress-header">
                        <i data-lucide="search" class="search-icon pulsing" style="width:1rem;height:1rem;color:var(--color-primary);"></i>
                        <span>${lang === 'vi' ? 'Đang tìm kiếm thông tin trên Web...' : 'Searching the Web...'}</span>
                    </div>
                    <div class="search-progress-steps">
                        <div class="search-progress-step active" id="step-connect">
                            <span class="step-dot pulsing"></span>
                            <span>${lang === 'vi' ? 'Đang kết nối tới Tavily & Wikipedia...' : 'Connecting to Tavily & Wikipedia...'}</span>
                        </div>
                    </div>
                </div>
            `;
            createIconsSafe();
            scrollToBottom(false);

            const searchUrl = `${baseUrl}/api/search?q=${encodeURIComponent(prompt)}`;
            const searchHeaders = {
                'Content-Type': 'application/json'
            };
            if (apiKey) {
                searchHeaders['Authorization'] = `Bearer ${apiKey}`;
            }

            const searchResponse = await fetch(searchUrl, { headers: searchHeaders });
            if (searchResponse.ok) {
                const results = await searchResponse.json();

                const connectEl = document.getElementById('step-connect');
                if (connectEl) {
                    connectEl.classList.remove('active');
                    connectEl.classList.add('done');
                    const dot = connectEl.querySelector('.step-dot');
                    if (dot) dot.className = 'step-dot done';
                    connectEl.querySelector('span:last-child').textContent = lang === 'vi' ? 'Đã kết nối nguồn dữ liệu' : 'Connected to data sources';
                }

                if (results && results.length > 0) {
                    searchResultsList = results;
                    const stepsContainer = textContainer.querySelector('.search-progress-steps');
                    
                    // Limit animation to max 3 results to keep it relatively fast but premium
                    const itemsToAnimate = results.slice(0, 3);
                    for (let i = 0; i < itemsToAnimate.length; i++) {
                        const res = itemsToAnimate[i];
                        const stepId = `step-scan-${i}`;
                        const stepEl = document.createElement('div');
                        stepEl.className = 'search-progress-step active';
                        stepEl.id = stepId;
                        stepEl.innerHTML = `
                            <span class="step-dot scanning"></span>
                            <span>${lang === 'vi' ? 'Đang quét' : 'Scanning'}: <span class="step-title">${escapeHTML(res.title)}</span></span>
                        `;
                        stepsContainer.appendChild(stepEl);
                        scrollToBottom(false);

                        await new Promise(resolve => setTimeout(resolve, 450));

                        const currentStep = document.getElementById(stepId);
                        if (currentStep) {
                            currentStep.classList.remove('active');
                            currentStep.classList.add('done');
                            const dot = currentStep.querySelector('.step-dot');
                            if (dot) dot.className = 'step-dot done';
                        }
                    }

                    const synthesizeEl = document.createElement('div');
                    synthesizeEl.className = 'search-progress-step active';
                    synthesizeEl.innerHTML = `
                        <span class="step-dot pulsing"></span>
                        <span>${lang === 'vi' ? 'Đang tổng hợp đối chiếu ngữ cảnh...' : 'Synthesizing grounding context...'}</span>
                    `;
                    stepsContainer.appendChild(synthesizeEl);
                    scrollToBottom(false);
                    await new Promise(resolve => setTimeout(resolve, 500));

                    searchResultsContext = `[THÔNG TIN TÌM KIẾM TỪ INTERNET]\n`;
                    results.forEach((res, i) => {
                        searchResultsContext += `[Nguồn ${i + 1}] Tiêu đề: ${res.title}\nLiên kết: ${res.url}\nTóm tắt: ${res.snippet}\n\n`;
                    });
                    searchResultsContext += `\n[HƯỚNG DẪN AI]: Hãy sử dụng thông tin từ Internet ở trên để trả lời câu hỏi dưới đây một cách chính xác và cập nhật nhất. Trích dẫn nguồn (như [Nguồn 1], [Nguồn 2]) khi cần thiết. Trả lời bằng ngôn ngữ mà người dùng hỏi.\n\n`;
                } else {
                    const noResultsEl = document.createElement('div');
                    noResultsEl.className = 'search-progress-step';
                    noResultsEl.innerHTML = `
                        <span class="step-dot" style="background:var(--color-failed)"></span>
                        <span>${lang === 'vi' ? 'Không tìm thấy kết quả phù hợp' : 'No matching results found'}</span>
                    `;
                    textContainer.querySelector('.search-progress-steps').appendChild(noResultsEl);
                    scrollToBottom(false);
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            } else {
                const failedEl = document.getElementById('step-connect');
                if (failedEl) {
                    failedEl.querySelector('span:last-child').textContent = lang === 'vi' ? 'Không thể kết nối dịch vụ tìm kiếm' : 'Failed to query search service';
                    const dot = failedEl.querySelector('.step-dot');
                    if (dot) {
                        dot.className = 'step-dot';
                        dot.style.background = 'var(--color-failed)';
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        } catch (err) {
            console.error('Failed to query search API:', err);
        }

        textContainer.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
    }

    // Build Context Messages
    let contextMessages = [];
    if (systemPrompt) {
        contextMessages.push({ role: 'system', content: systemPrompt });
    }

    // Clone last few messages for API payload
    const historySlice = JSON.parse(JSON.stringify(session.messages.slice(-12)));

    // Inject Search context into last User message inside API payload (without permanently saving it to session history)
    if (searchResultsContext && historySlice.length > 0) {
        const lastMsg = historySlice[historySlice.length - 1];
        if (lastMsg.role === 'user') {
            if (typeof lastMsg.content === 'string') {
                lastMsg.content = searchResultsContext + `[CÂU HỎI CỦA NGƯỜI DÙNG]:\n` + lastMsg.content;
            } else if (Array.isArray(lastMsg.content)) {
                const textPart = lastMsg.content.find(p => p.type === 'text');
                if (textPart) {
                    textPart.text = searchResultsContext + `[CÂU HỎI CỦA NGƯỜI DÙNG]:\n` + textPart.text;
                } else {
                    lastMsg.content.unshift({ type: 'text', text: searchResultsContext });
                }
            }
        }
    }

    contextMessages = contextMessages.concat(historySlice);

    activeController = new AbortController();
    activeReader = null;
    checkSendButtonState();

    let assistantResponseText = '';

    try {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: contextMessages,
                stream: true
            }),
            signal: activeController.signal
        });

        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
            throw new Error(errMsg);
        }

        const reader = response.body.getReader();
        activeReader = reader;
        checkSendButtonState();

        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let isFirstChunk = true;
        let lastRenderTime = 0;
        const RENDER_THROTTLE_MS = 80; // Render at most once per 80ms

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const cleanLine = line.trim();
                if (cleanLine === '' || cleanLine === 'data: [DONE]') continue;

                if (cleanLine.startsWith('data: ')) {
                    const dataStr = cleanLine.slice(6);
                    try {
                        const parsed = JSON.parse(dataStr);
                        const token = parsed.choices?.[0]?.delta?.content || '';
                        if (token) {
                            if (isFirstChunk) {
                                textContainer.innerHTML = '';
                                isFirstChunk = false;
                            }
                            assistantResponseText += token;

                            if (bubbleEl) {
                                bubbleEl.setAttribute('data-raw-content', assistantResponseText);
                            }

                            const now = Date.now();
                            if (now - lastRenderTime > RENDER_THROTTLE_MS) {
                                textContainer.innerHTML = renderMessageContent(assistantResponseText, searchResultsList);
                                if (hljs && typeof hljs.highlightElement === 'function') {
                                    textContainer.querySelectorAll('pre code').forEach((block) => {
                                        try {
                                            hljs.highlightElement(block);
                                        } catch (e) {
                                            // ignore
                                        }
                                    });
                                }
                                renderMath(textContainer);
                                lastRenderTime = now;
                            }
                            scrollToBottom(false);
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }

        if (isFirstChunk) {
            textContainer.innerHTML = lang === 'vi' ? 'Không nhận được dữ liệu phản hồi từ AI.' : 'No response content returned by AI.';
        }

    } catch (err) {
        console.error(err);
        if (err.name === 'AbortError' || err.message.includes('cancel') || err.message.includes('aborted') || err.message.includes('cancelled')) {
            assistantResponseText += `\n\n${t.stoppedByUser}`;
        } else {
            const errorMsg = `\n\n*(Lỗi kết nối / Connection error: ${err.message})*`;
            if (assistantResponseText) {
                assistantResponseText += errorMsg;
            } else {
                textContainer.innerHTML = `
                    <div style="color:var(--color-failed); display:flex; align-items:center; gap:0.5rem; font-weight:600;">
                        <i data-lucide="alert-triangle" style="width:1.1rem;height:1.1rem;"></i> ${t.errPrefix.replace('{error}', err.message)}
                    </div>
                `;
                createIconsSafe();
            }
        }
    } finally {
        activeReader = null;
        activeController = null;
        checkSendButtonState();

        assistantWrapper.removeAttribute('id');

        if (assistantResponseText) {
            // Append the search grounding links in the final view
            let searchGroundingHTML = '';
            if (searchResultsList && searchResultsList.length > 0) {
                const uniqueId = 'grounding-' + Math.random().toString(36).substring(2, 9);
                const titleText = lang === 'vi' ? `Xem nguồn tham khảo (${searchResultsList.length})` : `Sources (${searchResultsList.length})`;
                searchGroundingHTML = `
                    <div class="search-grounding-container" id="${uniqueId}">
                        <div class="search-grounding-header" onclick="const listEl = document.getElementById('${uniqueId}-list'); listEl.style.display = listEl.style.display === 'none' ? 'flex' : 'none';">
                            <i data-lucide="globe" style="width:0.85rem;height:0.85rem;"></i>
                            <span>${titleText}</span>
                            <i data-lucide="chevron-down" style="width:0.75rem;height:0.75rem; margin-left:auto;"></i>
                        </div>
                        <div class="search-grounding-list" id="${uniqueId}-list" style="display: none;">
                            ${searchResultsList.map((res, i) => `
                                <a href="${res.url}" target="_blank" rel="noopener noreferrer" class="search-grounding-item">
                                    <i data-lucide="external-link" class="search-grounding-icon" style="width:0.75rem;height:0.75rem;"></i>
                                    <span>[${i + 1}] ${escapeHTML(res.title)}</span>
                                </a>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            textContainer.innerHTML = renderMessageContent(assistantResponseText, searchResultsList);
            if (hljs && typeof hljs.highlightElement === 'function') {
                textContainer.querySelectorAll('pre code').forEach((block) => {
                    try {
                        hljs.highlightElement(block);
                    } catch (e) {
                        // ignore
                    }
                });
            }
            renderMath(textContainer);
            if (bubbleEl) {
                bubbleEl.setAttribute('data-raw-content', assistantResponseText);
                if (searchGroundingHTML) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = searchGroundingHTML;
                    bubbleEl.appendChild(tempDiv.firstElementChild);
                    createIconsSafe();
                }
            }
            session.messages.push({ role: 'assistant', content: assistantResponseText, searchResults: searchResultsList });
            saveSessions();
        }

        dom.chatInput.value = '';
        checkSendButtonState();
        scrollToBottom(true);
        dom.chatInput.focus();
    }
}

// Show/hide scroll to bottom button based on scroll position
function updateScrollToBottomVisibility() {
    if (!dom.scrollToBottomBtn) return;
    const threshold = 200;
    const distFromBottom = dom.chatMessages.scrollHeight - dom.chatMessages.scrollTop - dom.chatMessages.clientHeight;
    if (distFromBottom > threshold) {
        dom.scrollToBottomBtn.classList.add('visible');
    } else {
        dom.scrollToBottomBtn.classList.remove('visible');
    }
}

// Autoscroll viewport logic with smart scrolling
function scrollToBottom(force = false) {
    const threshold = 150; // pixels from the bottom
    const position = dom.chatMessages.scrollTop + dom.chatMessages.offsetHeight;
    const height = dom.chatMessages.scrollHeight;

    if (force || (height - position < threshold)) {
        dom.chatMessages.scrollTop = height;
    }
    updateScrollToBottomVisibility();
}

// Helper to show custom dynamic toasts
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconName = type === 'success' ? 'check-circle' : 'alert-triangle';
    toast.innerHTML = `
        <div class="toast-icon">
            <i data-lucide="${iconName}" style="width:1rem;height:1rem;"></i>
        </div>
        <span style="flex: 1; min-width: 0; word-break: break-word;">${escapeHTML(message)}</span>
        <button class="toast-close-btn" aria-label="Close" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0.25rem; border-radius: 0.25rem; margin-left: auto; transition: var(--transition-fast);">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    `;

    const closeBtn = toast.querySelector('.toast-close-btn');
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.color = 'var(--text-primary)';
        closeBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.color = 'var(--text-muted)';
        closeBtn.style.background = 'transparent';
    });

    let dismissTimeout;
    const dismiss = () => {
        if (dismissTimeout) clearTimeout(dismissTimeout);
        toast.classList.remove('show');
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 400);
    };

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismiss();
    });

    dom.toastContainer.appendChild(toast);
    createIconsSafe();

    setTimeout(() => toast.classList.add('show'), 50);

    dismissTimeout = setTimeout(dismiss, 4000);
}

// Utility to escape html
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

window.addEventListener('DOMContentLoaded', init);
