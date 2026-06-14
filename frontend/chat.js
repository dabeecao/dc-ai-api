import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import java from 'highlight.js/lib/languages/java';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('java', java);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('dockerfile', dockerfile);
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
    ShieldCheck,
    Volume2,
    Loader2,
    Save
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
        const t = TRANSLATIONS[currentLang];
        const copyText = t.copy || 'Copy';
        const copyTitle = t.copyCode || 'Copy code';

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
    API_TYPE: 'dc_chat_api_type',
    API_TYPE_DETECTED: 'dc_chat_api_type_detected',
    SESSIONS: 'dc_chat_sessions',
    CURRENT_SESSION_ID: 'dc_chat_current_session_id',
    DEFAULT_MODEL: 'dc_chat_default_model',
    LANGUAGE: 'dc_chat_language',
    SYSTEM_PROMPT: 'dc_chat_system_prompt',
    TTS_VOICE: 'dc_chat_tts_voice'
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
let confirmCallback = null;
let ttsEnabled = false;
let ttsPlayer = null;

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
                ShieldCheck,
                Volume2,
                Loader2,
                Save
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
    baseUrlInput: document.getElementById('baseUrlInput'),
    apiTypeSelect: document.getElementById('apiTypeSelect'),
    apiTypeContainer: document.getElementById('apiTypeContainer'),
    apiTestBtn: document.getElementById('apiTestBtn'),
    systemPromptInput: document.getElementById('systemPromptInput'),
    togglePasswordBtn: document.getElementById('togglePasswordBtn'),
    toastContainer: document.getElementById('toastContainer'),
    scrollToBottomBtn: document.getElementById('scrollToBottomBtn'),
    attachBtn: document.getElementById('attachBtn'),
    imageInput: document.getElementById('imageInput'),
    webSearchToggleBtn: document.getElementById('webSearchToggleBtn'),
    imagePreviewContainer: document.getElementById('imagePreviewContainer')
};

// Close sidebar on mobile
function closeSidebar() {
    if (dom.sidebar) dom.sidebar.classList.remove('mobile-open');
    if (dom.sidebarBackdrop) dom.sidebarBackdrop.classList.remove('mobile-show');
}

// Helper to focus chat input, avoiding mobile keyboard popups
function focusChatInput() {
    if (!dom.chatInput) return;
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
        dom.chatInput.focus();
    }
}

// Dynamic Visual Viewport adjustment for Safari Mobile / iOS virtual keyboard
function setupVisualViewportAdjustment() {
    if (!window.visualViewport) return;

    const adjustViewportHeight = () => {
        const height = window.visualViewport.height;
        document.documentElement.style.setProperty('--viewport-height', `${height}px`);
        
        // Reset window scroll offset to prevent iOS Safari shifting the fixed body upwards
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        
        // When keyboard appears and input is focused, scroll chat messages to bottom
        if (document.activeElement === dom.chatInput) {
            setTimeout(() => {
                scrollToBottom(true);
            }, 80);
        }
    };

    window.visualViewport.addEventListener('resize', adjustViewportHeight);
    window.visualViewport.addEventListener('scroll', adjustViewportHeight);
    
    // Run initially
    adjustViewportHeight();
}

// Initialize App
async function init() {
    if (!localStorage.getItem(KEYS.BASE_URL)) {
        localStorage.setItem(KEYS.BASE_URL, window.location.origin);
    }
    if (!localStorage.getItem(KEYS.LANGUAGE)) {
        const browserLang = (navigator.language || navigator.userLanguage || 'vi').toLowerCase();
        const defaultLang = browserLang.startsWith('vi') ? 'vi' : 'en';
        localStorage.setItem(KEYS.LANGUAGE, defaultLang);
    }

    ttsPlayer = new TTSPlayer();

    setupVisualViewportAdjustment();
    bindEvents();
    applyLanguage();
    renderSessionsList();
    await validateConfigAndLoadModels();
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
    if (dom.modelSearchInput) {
        dom.modelSearchInput.placeholder = t.modelSearchPlaceholder;
    }

    const elHintText = document.getElementById('lblHintText');
    if (elHintText) elHintText.textContent = t.hintText;

    const elKeyWarning = document.getElementById('lblKeyWarning');
    if (elKeyWarning) elKeyWarning.textContent = t.needKeyWarning;

    const elModalTitle = document.getElementById('lblModalTitle');
    if (elModalTitle) elModalTitle.textContent = t.configTitle;

    const elApiKeyLabel = document.getElementById('lblApiKeyLabel');
    if (elApiKeyLabel) elApiKeyLabel.textContent = t.apiKeyLabel;

    dom.apiKeyInput.placeholder = t.apiKeyPlaceholder;

    const elBaseUrlLabel = document.getElementById('lblBaseUrlLabel');
    if (elBaseUrlLabel) elBaseUrlLabel.textContent = t.baseUrlLabel;

    if (dom.baseUrlInput) {
        dom.baseUrlInput.placeholder = t.baseUrlPlaceholder || 'http://localhost:8080';
    }

    const elAdvancedSettings = document.getElementById('lblAdvancedSettings');
    if (elAdvancedSettings) elAdvancedSettings.textContent = t.advancedSettings;

    const elApiTypeLabel = document.getElementById('lblApiTypeLabel');
    if (elApiTypeLabel) elApiTypeLabel.textContent = t.lblApiTypeLabel;

    const elOptApiAuto = document.getElementById('optApiAuto');
    if (elOptApiAuto) elOptApiAuto.textContent = t.optApiAuto;

    const elApiTestBtnLabel = document.getElementById('lblApiTestBtn');
    if (elApiTestBtnLabel) elApiTestBtnLabel.textContent = t.lblApiTestBtn;

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

    const elTtsVoiceLabel = document.getElementById('lblTtsVoiceLabel');
    if (elTtsVoiceLabel) elTtsVoiceLabel.textContent = t.ttsVoiceLabel;

    // Translate TTS voice options
    const ttsVoiceOptMap = [
        ['ttsVoiceOpt_BV074', 'ttsVoiceBV074'],
        ['ttsVoiceOpt_BV075', 'ttsVoiceBV075'],
        ['ttsVoiceOpt_en_us_001', 'ttsVoiceEnUs001'],
        ['ttsVoiceOpt_en_us_006', 'ttsVoiceEnUs006'],
        ['ttsVoiceOpt_en_uk_001', 'ttsVoiceEnUk001'],
        ['ttsVoiceOpt_BV700', 'ttsVoiceBV700'],
        ['ttsVoiceOpt_BV001', 'ttsVoiceBV001'],
        ['ttsVoiceOpt_BV002', 'ttsVoiceBV002'],
        ['ttsVoiceOpt_jp_001', 'ttsVoiceJp001'],
        ['ttsVoiceOpt_BV059', 'ttsVoiceBV059'],
        ['ttsVoiceOpt_kr_male_gye', 'ttsVoiceKrMaleGye'],
    ];
    ttsVoiceOptMap.forEach(([elemId, key]) => {
        const el = document.getElementById(elemId);
        if (el && t[key]) el.textContent = t[key];
    });

    const elModalCancelSpan = document.getElementById('lblModalCancelBtn');
    if (elModalCancelSpan) elModalCancelSpan.textContent = t.cancel;
    else dom.modalCancelBtn.textContent = t.cancel;

    const elModalSaveSpan = document.getElementById('lblModalSaveBtn');
    if (elModalSaveSpan) elModalSaveSpan.textContent = t.save;
    else dom.modalSaveBtn.textContent = t.save;

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

    const confirmTitle = document.getElementById('confirmTitle');
    if (confirmTitle) confirmTitle.textContent = t.confirmTitle;
    
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    if (confirmCancelBtn) confirmCancelBtn.textContent = t.confirmCancel;
    
    const confirmOkBtn = document.getElementById('confirmOkBtn');
    if (confirmOkBtn) confirmOkBtn.textContent = t.confirmOk;

    createIconsSafe();
}

function getActiveApiType() {
    const detected = localStorage.getItem(KEYS.API_TYPE_DETECTED);
    if (detected) return detected;
    const pref = localStorage.getItem(KEYS.API_TYPE);
    if (pref && pref !== 'auto') return pref;
    return 'openai';
}

async function runConnectionTest(baseUrl, key, apiTypePref, lang) {
    if (!key) {
        return { success: false, supportedTypes: [], isAuthError: false };
    }
    
    if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
    }
    if (!baseUrl) {
        baseUrl = window.location.origin;
    }

    const testOpenAI = async () => {
        try {
            const response = await fetch(`${baseUrl}/v1/models`, {
                headers: { 'Authorization': `Bearer ${key}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data.data)) {
                    return { success: true, isAuthError: false };
                }
            } else if (response.status === 401 || response.status === 403) {
                return { success: false, isAuthError: true };
            }
        } catch (err) {
            console.error('Test OpenAI error:', err);
        }
        return { success: false, isAuthError: false };
    };

    const testGemini = async () => {
        try {
            const response = await fetch(`${baseUrl}/v1beta/models?key=${key}`);
            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data.models)) {
                    return { success: true, isAuthError: false };
                }
            } else if (response.status === 401 || response.status === 403) {
                return { success: false, isAuthError: true };
            }
        } catch (err) {
            console.error('Test Gemini error:', err);
        }
        return { success: false, isAuthError: false };
    };

    const testClaude = async () => {
        try {
            const response = await fetch(`${baseUrl}/v1/models`, {
                headers: {
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01'
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data.data)) {
                    return { success: true, isAuthError: false };
                }
            } else if (response.status === 401 || response.status === 403) {
                return { success: false, isAuthError: true };
            }
        } catch (err) {
            console.error('Test Claude error:', err);
        }
        return { success: false, isAuthError: false };
    };

    let supportedTypes = [];
    let isAuthError = false;

    if (apiTypePref === 'openai') {
        const res = await testOpenAI();
        if (res.success) supportedTypes.push('openai');
        isAuthError = res.isAuthError;
    } else if (apiTypePref === 'gemini') {
        const res = await testGemini();
        if (res.success) supportedTypes.push('gemini');
        isAuthError = res.isAuthError;
    } else if (apiTypePref === 'claude') {
        const res = await testClaude();
        if (res.success) supportedTypes.push('claude');
        isAuthError = res.isAuthError;
    } else {
        // 'auto' or default
        const results = await Promise.all([
            testOpenAI(),
            testGemini(),
            testClaude()
        ]);
        if (results[0].success) supportedTypes.push('openai');
        if (results[1].success) supportedTypes.push('gemini');
        if (results[2].success) supportedTypes.push('claude');
        
        if (results[0].isAuthError || results[1].isAuthError || results[2].isAuthError) {
            isAuthError = true;
        }
    }

    return { success: supportedTypes.length > 0, supportedTypes, isAuthError };
}

// Validate user key & fetch models
async function validateConfigAndLoadModels() {
    const key = localStorage.getItem(KEYS.API_KEY);
    const baseUrl = localStorage.getItem(KEYS.BASE_URL) || window.location.origin;
    const apiType = getActiveApiType();
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    const t = TRANSLATIONS[lang];

    // Always fetch guest config first to ensure we have it
    try {
        const res = await fetch(`${baseUrl}/api/guest-config`);
        if (res.ok) {
            const config = await res.json();
            guestApiKey = config.guest_api_key || '';
            guestModelName = config.guest_model || '';
            ttsEnabled = !!config.tts_enabled;
        }
    } catch (e) {
        console.error("Failed to load guest config:", e);
    }

    if (!key) {
        if (!guestApiKey) {
            // No guest key available, show warning/error state
            dom.statusDot.className = 'status-dot error';
            dom.statusText.textContent = t.statusNotConfigured;
            dom.keyWarningBadge.style.display = 'inline-flex';
            dom.modelSelectTrigger.disabled = true;
            dom.modelSelectText.textContent = `(${t.statusError})`;
            availableModels = [];
            renderCustomModelSelect('');
            
            // Disable input and update placeholder
            dom.chatInput.disabled = true;
            dom.chatInput.placeholder = t.toastGuestConfigureKey;
            
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
            ? (t.guestModelAssistant || 'DC AI Model Assistant')
            : (t.guestAssistant || 'DC AI Assistant');
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
        let response;
        if (apiType === 'gemini') {
            response = await fetch(`${baseUrl}/v1beta/models?key=${key}`);
        } else if (apiType === 'claude') {
            response = await fetch(`${baseUrl}/v1/models`, {
                headers: {
                    'x-api-key': key,
                    'anthropic-version': '2023-06-01'
                }
            });
        } else {
            response = await fetch(`${baseUrl}/v1/models`, {
                headers: {
                    'Authorization': `Bearer ${key}`
                }
            });
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        let models = [];

        if (apiType === 'gemini') {
            if (data.models && Array.isArray(data.models)) {
                models = data.models.map(m => m.name.replace('models/', ''));
            }
        } else if (apiType === 'claude' || apiType === 'openai') {
            if (data.data && Array.isArray(data.data)) {
                models = data.data.map(m => m.id);
            }
        }

        if (models && models.length > 0) {
            dom.statusDot.className = 'status-dot active';
            dom.statusText.textContent = `${t.statusActive} (${apiType.toUpperCase()})`;

            // Re-populate availableModels array
            availableModels = models;

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
            dom.modelSelectText.textContent = selectedModel || t.selectModel;

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
        dom.chatInput.placeholder = t.toastInvalidConfig;
        
        checkSendButtonState();
        showToast(t.loadModelsErr, 'error');
    }
}

// Render custom popover options list
function renderCustomModelSelect(filterQuery = '') {
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    const t = TRANSLATIONS[lang];

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
            displayName = t.guestAssistant || 'DC AI Assistant';
        } else if (m === 'dc-ai-model') {
            displayName = t.guestModelAssistant || 'DC AI Model Assistant';
        }
        html += `
            <div class="popover-option ${isSelected ? 'selected' : ''}" data-model="${m}">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${displayName}</span>
                ${isSelected ? '<i data-lucide="check" style="width:0.875rem;height:0.875rem;color:var(--color-active);flex-shrink:0;"></i>' : ''}
            </div>
        `;
    });

    if (filtered.length === 0) {
        html = `<div style="padding: 1rem; text-align: center; color: var(--text-muted); font-size:0.75rem;">${t.noModelsFound || 'No active models found'}</div>`;
    }

    dom.modelOptionsList.innerHTML = html;
    createIconsSafe();
}

// Helper to select and apply model
function selectModelValue(modelName) {
    selectedModel = modelName;
    localStorage.setItem(KEYS.DEFAULT_MODEL, selectedModel);

    // Update trigger text
    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    const t = TRANSLATIONS[lang];
    dom.modelSelectText.textContent = selectedModel || t.selectModel;

    // Show toast
    showToast(t.toastModelSwitched.replace('{model}', selectedModel), 'success');

    // Refresh selections in view
    renderCustomModelSelect(dom.modelSearchInput.value);
    checkSendButtonState();
}

function showConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    
    confirmCallback = onConfirm;
    if (modal) modal.classList.add('active');
}

function hideConfirmModal() {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('active');
    confirmCallback = null;
}

// Settings modal triggers
function openModal() {
    dom.apiKeyInput.value = localStorage.getItem(KEYS.API_KEY) || '';
    if (dom.baseUrlInput) {
        dom.baseUrlInput.value = localStorage.getItem(KEYS.BASE_URL) || window.location.origin;
    }
    
    dom.apiTypeContainer.style.display = 'none';

    if (dom.systemPromptInput) {
        dom.systemPromptInput.value = localStorage.getItem(KEYS.SYSTEM_PROMPT) || '';
    }
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.value = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
    }
    const ttsVoiceGroup = document.getElementById('ttsVoiceGroup');
    const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
    if (ttsVoiceGroup) {
        ttsVoiceGroup.style.display = ttsEnabled ? 'flex' : 'none';
    }
    if (ttsVoiceSelect) {
        ttsVoiceSelect.value = localStorage.getItem(KEYS.TTS_VOICE) || 'BV074_streaming';
    }
    dom.settingsModal.classList.add('active');
}

function closeModal() {
    dom.settingsModal.classList.remove('active');
}

// Bind event listeners
function bindEvents() {
    // Sidebar mobile toggle
    dom.sidebarOpenBtn.addEventListener('click', () => {
        dom.sidebar.classList.add('mobile-open');
        dom.sidebarBackdrop.classList.add('mobile-show');
    });

    dom.sidebarCloseBtn.addEventListener('click', closeSidebar);
    dom.sidebarBackdrop.addEventListener('click', closeSidebar);

    dom.settingsBtn.addEventListener('click', openModal);
    dom.keyWarningBadge.addEventListener('click', openModal);
    dom.modalCloseBtn.addEventListener('click', closeModal);
    dom.modalCancelBtn.addEventListener('click', closeModal);

    dom.apiKeyInput.addEventListener('input', () => {
        if (dom.apiTypeContainer) dom.apiTypeContainer.style.display = 'none';
    });
    if (dom.baseUrlInput) {
        dom.baseUrlInput.addEventListener('input', () => {
            if (dom.apiTypeContainer) dom.apiTypeContainer.style.display = 'none';
        });
    }
    
    // Confirm Dialog Events
    const confirmCloseBtn = document.getElementById('confirmCloseBtn');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    const confirmOkBtn = document.getElementById('confirmOkBtn');
    
    if (confirmCloseBtn) confirmCloseBtn.addEventListener('click', hideConfirmModal);
    if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', hideConfirmModal);
    if (confirmOkBtn) {
        confirmOkBtn.addEventListener('click', () => {
            if (confirmCallback) {
                confirmCallback();
            }
            hideConfirmModal();
        });
    }

    if (dom.apiTestBtn) {
        dom.apiTestBtn.addEventListener('click', async () => {
            const key = dom.apiKeyInput.value.trim();
            let baseUrl = dom.baseUrlInput ? dom.baseUrlInput.value.trim() : '';
            const isSelectorVisible = dom.apiTypeContainer && dom.apiTypeContainer.style.display !== 'none';
            const apiTypePref = isSelectorVisible ? dom.apiTypeSelect.value : 'auto';
            const lang = document.getElementById('languageSelect').value;
            const t = TRANSLATIONS[lang];

            if (!key) {
                const warningMsg = t.warningEnterApiKey || 'Please enter an API Key to test!';
                showToast(warningMsg, 'error');
                return;
            }

            const testBtnIcon = document.getElementById('testBtnIcon');
            const spanTextEl = dom.apiTestBtn.querySelector('span');
            const origBtnText = spanTextEl ? spanTextEl.textContent : (t.lblApiTestBtn || 'Test Connection');

            dom.apiTestBtn.disabled = true;
            if (testBtnIcon) {
                testBtnIcon.style.animation = 'spin 1s linear infinite';
            }
            if (spanTextEl) {
                spanTextEl.textContent = t.toastTesting || 'Testing connection...';
            }

            const testResult = await runConnectionTest(baseUrl, key, 'auto', lang);

            dom.apiTestBtn.disabled = false;
            if (testBtnIcon) {
                testBtnIcon.style.animation = '';
            }
            if (spanTextEl) {
                spanTextEl.textContent = origBtnText;
            }

            if (testResult.success) {
                dom.apiTypeSelect.innerHTML = '';
                testResult.supportedTypes.forEach(type => {
                    const opt = document.createElement('option');
                    opt.value = type;
                    if (type === 'openai') opt.textContent = 'OpenAI Compatible';
                    else if (type === 'gemini') opt.textContent = 'Gemini Native';
                    else if (type === 'claude') opt.textContent = 'Claude Native';
                    dom.apiTypeSelect.appendChild(opt);
                });
                dom.apiTypeContainer.style.display = 'flex';

                let detectedType = testResult.supportedTypes.includes(apiTypePref)
                    ? apiTypePref
                    : testResult.supportedTypes[0];
                dom.apiTypeSelect.value = detectedType;

                const successMsg = (t.toastTestSuccess || 'Connection test successful! API Type: {type}')
                    .replace('{type}', detectedType.toUpperCase());
                showToast(successMsg, 'success');
            } else {
                dom.apiTypeContainer.style.display = 'none';
                const errorMsg = testResult.isAuthError
                    ? (t.apiAuthErr || 'Verification failed: Invalid API Key or unauthorized access!')
                    : (t.apiDetectErr || 'Could not detect any valid API protocol, or connection error!');
                showToast(errorMsg, 'error');
            }
        });
    }

    dom.modalSaveBtn.addEventListener('click', async () => {
        const key = dom.apiKeyInput.value.trim();
        let baseUrl = dom.baseUrlInput ? dom.baseUrlInput.value.trim() : '';
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }
        if (!baseUrl) {
            baseUrl = window.location.origin;
        }

        const systemPrompt = dom.systemPromptInput ? dom.systemPromptInput.value.trim() : '';
        const lang = document.getElementById('languageSelect').value;
        const t = TRANSLATIONS[lang];
        const isSelectorVisible = dom.apiTypeContainer && dom.apiTypeContainer.style.display !== 'none';
        const apiTypePref = isSelectorVisible ? dom.apiTypeSelect.value : 'auto';

        let detectedType = '';
        if (key) {
            const saveBtnSpan = document.getElementById('lblModalSaveBtn');
            const origBtnText = saveBtnSpan ? saveBtnSpan.textContent : dom.modalSaveBtn.textContent;
            dom.modalSaveBtn.disabled = true;
            if (saveBtnSpan) saveBtnSpan.textContent = t.adminTesting || 'Verifying...';
            else dom.modalSaveBtn.textContent = t.adminTesting || 'Verifying...';

            const testResult = await runConnectionTest(baseUrl, key, apiTypePref, lang);

            if (!testResult.success) {
                dom.modalSaveBtn.disabled = false;
                if (saveBtnSpan) saveBtnSpan.textContent = origBtnText;
                else dom.modalSaveBtn.textContent = origBtnText;
                
                const errorMsg = testResult.isAuthError
                    ? (t.apiAuthErr || 'Verification failed: Invalid API Key or unauthorized access!')
                    : (t.apiDetectErr || 'Could not detect any valid API protocol, or connection error!');

                showToast(errorMsg, 'error');
                return;
            }

            let bestType = testResult.supportedTypes[0];

            detectedType = (isSelectorVisible && testResult.supportedTypes.includes(apiTypePref))
                ? apiTypePref 
                : bestType;
            
            dom.modalSaveBtn.disabled = false;
            if (saveBtnSpan) saveBtnSpan.textContent = origBtnText;
            else dom.modalSaveBtn.textContent = origBtnText;
        }

        localStorage.setItem(KEYS.API_KEY, key);
        localStorage.setItem(KEYS.BASE_URL, baseUrl);
        localStorage.setItem(KEYS.API_TYPE, apiTypePref);
        localStorage.setItem(KEYS.API_TYPE_DETECTED, detectedType);
        localStorage.setItem(KEYS.SYSTEM_PROMPT, systemPrompt);
        localStorage.setItem(KEYS.LANGUAGE, lang);

        const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
        if (ttsVoiceSelect) {
            localStorage.setItem(KEYS.TTS_VOICE, ttsVoiceSelect.value);
        }

        closeModal();
        applyLanguage();
        
        const successMsg = key 
            ? t.toastSavedWithApiType.replace('{type}', detectedType.toUpperCase())
            : (t.toastSaved || 'Connection settings saved');
        showToast(successMsg, 'success');
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

    // Input focus scroll fix for mobile keyboards
    dom.chatInput.addEventListener('focus', () => {
        setTimeout(() => {
            window.scrollTo(0, 0);
            document.body.scrollTop = 0;
            scrollToBottom(true);
        }, 150);
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
        showConfirmModal(
            t.clearAllTitle,
            t.clearAllConfirm,
            () => {
                localStorage.removeItem(KEYS.SESSIONS);
                localStorage.removeItem(KEYS.CURRENT_SESSION_ID);
                activeSessions = [];
                currentSessionId = null;
                renderSessionsList();
                loadSession(null);
                showToast(t.toastClearAll, 'success');
            }
        );
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
                    showToast(t.toastOnlyImagesSupported || 'Only image files are supported!', 'error');
                    continue;
                }
                // Limit maximum file size to 5MB for guest users (no custom key in localStorage)
                if (!localStorage.getItem(KEYS.API_KEY)) {
                    const maxGuestSizeBytes = 5 * 1024 * 1024;
                    if (file.size > maxGuestSizeBytes) {
                        showToast(
                            t.toastGuestUploadLimit || 'Guests can only upload images up to 5MB!',
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
                        t.toastErrorProcessingImage || 'Error processing image!',
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
            const t = TRANSLATIONS[lang];
            const msg = webSearchEnabled
                ? (t.toastWebSearchEnabled || 'Web search enabled')
                : (t.toastWebSearchDisabled || 'Web search disabled');
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
        focusChatInput();
        
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
    focusChatInput();

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
        appendMessageBubble(msg.role, msg.content, false, msg.searchResults, msg.thinkingDuration);
    });

    scrollToBottom(true);
    focusChatInput();
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
            <button class="delete-session-btn" title="${t.deleteConversationTitle || 'Delete conversation'}">
                <i data-lucide="x" style="width:0.85rem;height:0.85rem;"></i>
            </button>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.delete-session-btn')) {
                e.stopPropagation();
                showConfirmModal(
                    t.deleteConversationTitle,
                    t.confirmDeleteConversation,
                    () => {
                        deleteSession(s.id);
                    }
                );
                return;
            }
            loadSession(s.id);
            closeSidebar();
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
    if (!text) {
        return { thinking: '', content: '', isThinking: false };
    }

    let thinking = '';
    let content = '';
    let isThinking = false;

    let remaining = text;
    const openTagRegex = /<\s*(think|thought|thinking)\s*>/i;
    const closeTagRegex = /<\s*\/\s*(think|thought|thinking)\s*>/i;

    while (remaining.length > 0) {
        const startMatch = remaining.match(openTagRegex);
        const endMatch = remaining.match(closeTagRegex);

        const startIdx = startMatch ? startMatch.index : -1;
        const endIdx = endMatch ? endMatch.index : -1;

        if (startIdx === -1 && endIdx === -1) {
            // No tags left, append everything to content
            content += remaining;
            break;
        }

        // Case 1: Only closing tag exists, or closing tag appears before opening tag
        if (endIdx !== -1 && (startIdx === -1 || endIdx < startIdx)) {
            // Text before closing tag is thinking
            thinking += remaining.substring(0, endIdx);
            // Resume after the closing tag
            remaining = remaining.substring(endIdx + endMatch[0].length);
            continue;
        }

        // Case 2: Opening tag exists and appears before closing tag
        if (startIdx !== -1) {
            // Text before opening tag is content
            content += remaining.substring(0, startIdx);
            
            const afterStart = remaining.substring(startIdx + startMatch[0].length);
            const nextEndMatch = afterStart.match(closeTagRegex);

            if (!nextEndMatch) {
                // Unclosed thinking block (still streaming or model forgot to close)
                thinking += afterStart;
                isThinking = true;
                break;
            } else {
                const nextEndIdx = nextEndMatch.index;
                // Text between opening and closing tags is thinking
                thinking += afterStart.substring(0, nextEndIdx);
                // Resume after the closing tag
                remaining = afterStart.substring(nextEndIdx + nextEndMatch[0].length);
            }
        }
    }

    return { thinking, content, isThinking };
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
function renderMessageContent(content, searchResults = [], thinkingDuration = null, userExpanded = false) {
    const preprocessed = preprocessMath(content);
    const { thinking, content: mainContent, isThinking } = parseThinking(preprocessed);
    let html = '';

    if (thinking) {
        const thinkingHtml = parseMarkdown(thinking);
        const brainIconSvg = `<svg class="thinking-brain-icon ${isThinking ? 'pulsing' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"></path><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"></path><path d="M12 5v14"></path><path d="M12 9h4"></path><path d="M12 14h-4"></path></svg>`;
        const arrowSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><path d="M19 9l-7 7-7-7"/></svg>`;

        const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
        const t = TRANSLATIONS[lang];
        const statusText = isThinking ? t.thinkingText : t.thoughtText;
        const shortStatusText = isThinking ? t.thinkingTextShort : t.thoughtTextShort;

        // Build preview ticker (only while actively thinking)
        let tickerHtml = '';
        if (isThinking) {
            const rawLines = thinking
                .replace(/```[\s\S]*?```/g, '')   // strip code blocks
                .replace(/`[^`]+`/g, '')            // strip inline code
                .replace(/[#*_~>\[\]()!]/g, ' ')    // strip markdown symbols
                .split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 2);         // keep non-empty lines

            // Display the latest active line statically to prevent animation jitter/lag
            const lastLine = rawLines.length > 0 ? rawLines[rawLines.length - 1] : '...';
            tickerHtml = `<div class="thinking-preview-ticker">
                <div class="thinking-ticker-line">${escapeHTML(lastLine.slice(0, 80))}</div>
            </div>`;
        }

        let durationHtml = '';
        if (thinkingDuration !== null) {
            const formattedDuration = Number(thinkingDuration).toFixed(1);
            if (isThinking) {
                durationHtml = `<span class="thinking-duration">${formattedDuration}s</span>`;
            } else {
                const durationText = t.thoughtDuration ? t.thoughtDuration.replace('{duration}', formattedDuration) : `${formattedDuration}s`;
                durationHtml = `<span class="thinking-duration" title="${durationText}">
                    <span class="duration-full">${durationText}</span>
                    <span class="duration-short">${formattedDuration}s</span>
                </span>`;
            }
        }

        // Keep collapsed by default during stream, unless userExpanded is true
        const blockClass = userExpanded ? 'thinking-block' : 'thinking-block collapsed';

        html += `
            <div class="${blockClass}" data-thinking="${isThinking}">
                <div class="thinking-header">
                    <span class="thinking-title">
                        ${brainIconSvg}
                        <span class="thinking-status-text">
                            <span class="status-full">${statusText}</span>
                            <span class="status-short">${shortStatusText}</span>
                        </span>
                    </span>
                    ${tickerHtml}
                    <div class="thinking-actions">
                        ${durationHtml}
                        <span class="thinking-toggle-arrow">${arrowSvg}</span>
                    </div>
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
                const t = TRANSLATIONS[lang];

                copyText.textContent = t.copied || 'Copied';
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
                showConfirmModal(
                    t.deleteMessageTitle,
                    t.confirmDeleteMessage,
                    () => {
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
                );
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

    // 6. Message Actions - TTS Read Message
    const ttsMsgBtn = e.target.closest('.tts-msg-btn');
    if (ttsMsgBtn) {
        const bubble = ttsMsgBtn.closest('.message-content-box').querySelector('.message-bubble');
        if (bubble) {
            const rawContent = bubble.getAttribute('data-raw-content') || '';
            const ttsId = bubble.getAttribute('data-tts-id');
            if (ttsPlayer.isPlaying && ttsPlayer.currentMessageId === ttsId) {
                ttsPlayer.stop(true);
            } else {
                ttsPlayer.playMessage(ttsId, rawContent);
            }
        }
        return;
    }
});

// Append message bubble to chat viewport
function appendMessageBubble(role, content, isTemporary = false, searchResults = null, thinkingDuration = null) {
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
        htmlContent = renderMessageContent(textStr, searchResults, thinkingDuration);
    }

    const isAssistant = role === 'assistant';
    const ttsId = 'tts-' + Math.random().toString(36).substring(2, 9);
    
    const isThisTtsPlaying = ttsPlayer && ttsPlayer.isPlaying && ttsPlayer.currentMessageId === ttsId;
    const ttsIconName = isThisTtsPlaying ? 'square' : 'volume-2';
    const ttsTitle = isThisTtsPlaying 
        ? (t.stopReading || 'Stop reading')
        : (t.readAloud || 'Read aloud');

    const actionsHTML = `
        <div class="message-actions">
            <button class="btn-msg-action copy-msg-btn" title="${t.copyMessage || 'Sao chép tin nhắn'}">
                <i data-lucide="copy" style="width:0.85rem;height:0.85rem;"></i>
            </button>
            <button class="btn-msg-action delete-msg-btn" title="${t.deleteMessage || 'Xóa tin nhắn'}">
                <i data-lucide="trash-2" style="width:0.85rem;height:0.85rem;"></i>
            </button>
            ${isAssistant ? `
            <button class="btn-msg-action tts-msg-btn" title="${ttsTitle}" style="display: ${ttsEnabled ? 'inline-flex' : 'none'};">
                <i data-lucide="${ttsIconName}" style="width:0.85rem;height:0.85rem;"></i>
            </button>
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
        const titleText = (t.viewSources || 'Sources ({count})').replace('{count}', searchResults.length);

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
            <div class="message-bubble" data-raw-content="${escapeHTML(textStr)}" data-tts-id="${ttsId}">
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
    createIconsSafe();
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
                        <span>${t.searchWebProgress || 'Searching the Web...'}</span>
                    </div>
                    <div class="search-progress-steps">
                        <div class="search-progress-step active" id="step-connect">
                            <span class="step-dot pulsing"></span>
                            <span>${t.searchConnecting || 'Connecting to Tavily & Wikipedia...'}</span>
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
                    connectEl.querySelector('span:last-child').textContent = t.searchConnected || 'Connected to data sources';
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
                            <span>${t.searchScanning || 'Scanning'}: <span class="step-title">${escapeHTML(res.title)}</span></span>
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
                        <span>${t.searchSynthesizing || 'Synthesizing grounding context...'}</span>
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
                        <span>${t.searchNoResults || 'No matching results found'}</span>
                    `;
                    textContainer.querySelector('.search-progress-steps').appendChild(noResultsEl);
                    scrollToBottom(false);
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            } else {
                const failedEl = document.getElementById('step-connect');
                if (failedEl) {
                    failedEl.querySelector('span:last-child').textContent = t.searchFailed || 'Failed to query search service';
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

    // Sanitize message history to remove non-standard properties like searchResults
    historySlice.forEach(msg => {
        if (msg && typeof msg === 'object' && 'searchResults' in msg) {
            delete msg.searchResults;
        }
    });

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
    let inThinkingBlock = false;
    let thinkingStartTime = null;
    let thinkingDuration = null;

    try {
        const apiType = getActiveApiType();
        let response;
        let url = '';
        let headers = {};
        let bodyObj = {};

        if (apiType === 'gemini') {
            url = `${baseUrl}/v1beta/models/${selectedModel}:streamGenerateContent?key=${apiKey}`;
            headers = {
                'Content-Type': 'application/json'
            };

            const systemMsg = contextMessages.find(m => m.role === 'system');
            const systemInstruction = systemMsg ? { parts: [{ text: typeof systemMsg.content === 'string' ? systemMsg.content : systemMsg.content[0]?.text }] } : undefined;
            const filteredContents = contextMessages.filter(m => m.role !== 'system').map(m => {
                let role = m.role === 'assistant' ? 'model' : 'user';
                let parts = [];
                if (typeof m.content === 'string') {
                    parts.push({ text: m.content });
                } else if (Array.isArray(m.content)) {
                    m.content.forEach(p => {
                        if (p.type === 'text') {
                            parts.push({ text: p.text });
                        } else if (p.type === 'image_url' && p.image_url) {
                            if (p.image_url.url && p.image_url.url.startsWith('data:image/')) {
                                const match = p.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
                                if (match) {
                                    parts.push({
                                        inlineData: {
                                            mimeType: match[1],
                                            data: match[2]
                                        }
                                    });
                                }
                            }
                        }
                    });
                }
                return { role, parts };
            });

            bodyObj = {
                contents: filteredContents
            };
            if (systemInstruction) {
                bodyObj.systemInstruction = systemInstruction;
            }
        } else if (apiType === 'claude') {
            url = `${baseUrl}/v1/messages`;
            headers = {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            };

            const systemMsg = contextMessages.find(m => m.role === 'system');
            const systemPrompt = systemMsg ? (typeof systemMsg.content === 'string' ? systemMsg.content : systemMsg.content[0]?.text) : undefined;
            const filteredMessages = contextMessages.filter(m => m.role !== 'system').map(m => {
                let content = m.content;
                if (Array.isArray(content)) {
                    content = content.map(p => {
                        if (p.type === 'image_url' && p.image_url) {
                            const match = p.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
                            if (match) {
                                return {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: match[1],
                                        data: match[2]
                                    }
                                };
                            }
                        }
                        return p;
                    });
                }
                return {
                    role: m.role,
                    content: content
                };
            });

            bodyObj = {
                model: selectedModel,
                max_tokens: 4096,
                messages: filteredMessages,
                stream: true
            };
            if (systemPrompt) {
                bodyObj.system = systemPrompt;
            }
        } else { // openai
            url = `${baseUrl}/v1/chat/completions`;
            headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
            bodyObj = {
                model: selectedModel,
                messages: contextMessages,
                stream: true
            };
        }

        response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(bodyObj),
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

        const updateRender = () => {
            const now = Date.now();
            
            // Check if user has manually expanded the thinking block in DOM
            let userExpanded = false;
            const existingBlock = textContainer.querySelector('.thinking-block');
            if (existingBlock) {
                userExpanded = !existingBlock.classList.contains('collapsed');
            }

            // Compute running thinking duration during stream
            const { thinking, isThinking } = parseThinking(assistantResponseText);
            if (thinking && !thinkingStartTime) {
                thinkingStartTime = Date.now();
            }
            if (thinkingStartTime && !isThinking && !thinkingDuration) {
                thinkingDuration = (Date.now() - thinkingStartTime) / 1000;
            }

            let currentDuration = thinkingDuration;
            if (thinkingStartTime && isThinking) {
                currentDuration = (Date.now() - thinkingStartTime) / 1000;
            }

            if (now - lastRenderTime > RENDER_THROTTLE_MS) {
                textContainer.innerHTML = renderMessageContent(assistantResponseText, searchResultsList, currentDuration, userExpanded);
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
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            if (apiType === 'gemini') {
                let braceCount = 0;
                let startIndex = -1;
                let inString = false;
                let inEscape = false;
                let i = 0;

                while (i < buffer.length) {
                    const char = buffer[i];
                    
                    if (inEscape) {
                        inEscape = false;
                    } else if (char === '\\') {
                        if (inString) {
                            inEscape = true;
                        }
                    } else if (char === '"') {
                        inString = !inString;
                    } else if (!inString) {
                        if (char === '{') {
                            if (braceCount === 0) {
                                startIndex = i;
                            }
                            braceCount++;
                        } else if (char === '}') {
                            braceCount--;
                            if (braceCount === 0 && startIndex !== -1) {
                                const jsonStr = buffer.slice(startIndex, i + 1);
                                try {
                                    const parsed = JSON.parse(jsonStr);
                                    const token = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                                    if (token) {
                                        if (isFirstChunk) {
                                            textContainer.innerHTML = '';
                                            isFirstChunk = false;
                                        }
                                        assistantResponseText += token;
                                        if (bubbleEl) {
                                            bubbleEl.setAttribute('data-raw-content', assistantResponseText);
                                        }
                                        updateRender();
                                    }
                                } catch (e) {
                                    console.error('Failed to parse Gemini chunk:', e);
                                }
                                buffer = buffer.slice(i + 1);
                                i = -1; // restart loop with updated buffer
                                braceCount = 0;
                                startIndex = -1;
                                inString = false;
                                inEscape = false;
                            }
                        }
                    }
                    i++;
                }
            } else {
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    let cleanLine = line.trim();
                    if (cleanLine === '') continue;

                    if (apiType === 'claude') {
                        if (cleanLine.startsWith('data: ')) {
                            const dataStr = cleanLine.slice(6).trim();
                            try {
                                const parsed = JSON.parse(dataStr);
                                let token = '';
                                if (parsed.type === 'content_block_delta') {
                                    token = parsed.delta?.text || '';
                                }
                                if (token) {
                                    if (isFirstChunk) {
                                        textContainer.innerHTML = '';
                                        isFirstChunk = false;
                                    }
                                    assistantResponseText += token;
                                    if (bubbleEl) {
                                        bubbleEl.setAttribute('data-raw-content', assistantResponseText);
                                    }
                                    updateRender();
                                }
                            } catch (e) {}
                        }
                    } else { // openai
                        if (cleanLine.startsWith('data: ')) {
                            const dataStr = cleanLine.slice(6).trim();
                            if (dataStr === '[DONE]') continue;
                            try {
                                const parsed = JSON.parse(dataStr);
                                const delta = parsed.choices?.[0]?.delta;
                                const token = delta?.content || '';
                                const reasoningToken = delta?.reasoning_content || delta?.reasoning || delta?.thinking || '';

                                let addedText = '';
                                if (reasoningToken) {
                                    if (!inThinkingBlock) {
                                        addedText += '<think>';
                                        inThinkingBlock = true;
                                    }
                                    addedText += reasoningToken;
                                }
                                if (token) {
                                    if (inThinkingBlock) {
                                        addedText += '</think>';
                                        inThinkingBlock = false;
                                    }
                                    addedText += token;
                                }

                                if (addedText) {
                                    if (isFirstChunk) {
                                        textContainer.innerHTML = '';
                                        isFirstChunk = false;
                                    }
                                    assistantResponseText += addedText;
                                    if (bubbleEl) {
                                        bubbleEl.setAttribute('data-raw-content', assistantResponseText);
                                    }
                                    updateRender();
                                }
                            } catch (e) {}
                        }
                    }
                }
            }
        }

        if (inThinkingBlock) {
            assistantResponseText += '</think>';
            inThinkingBlock = false;
        }

        // Compute final thinking duration
        const { thinking, isThinking } = parseThinking(assistantResponseText);
        if (thinking && thinkingStartTime && !thinkingDuration) {
            thinkingDuration = (Date.now() - thinkingStartTime) / 1000;
        }

        // Check if user has manually expanded the thinking block in DOM
        let userExpanded = false;
        const existingBlock = textContainer.querySelector('.thinking-block');
        if (existingBlock) {
            userExpanded = !existingBlock.classList.contains('collapsed');
        }

        // Final render
        textContainer.innerHTML = renderMessageContent(assistantResponseText, searchResultsList, thinkingDuration, userExpanded);
        if (hljs && typeof hljs.highlightElement === 'function') {
            textContainer.querySelectorAll('pre code').forEach((block) => {
                try {
                    hljs.highlightElement(block);
                } catch (e) {}
            });
        }
        renderMath(textContainer);
        scrollToBottom(true);

        if (isFirstChunk) {
            textContainer.innerHTML = t.noAiResponse || 'No response content returned by AI.';
        }

    } catch (err) {
        console.error(err);
        if (inThinkingBlock) {
            assistantResponseText += '</think>';
            inThinkingBlock = false;
            if (thinkingStartTime && !thinkingDuration) {
                thinkingDuration = (Date.now() - thinkingStartTime) / 1000;
            }
        }
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
                const titleText = (t.viewSources || 'Sources ({count})').replace('{count}', searchResultsList.length);
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

            // Check if user has manually expanded the thinking block in DOM
            let userExpanded = false;
            const existingBlock = textContainer.querySelector('.thinking-block');
            if (existingBlock) {
                userExpanded = !existingBlock.classList.contains('collapsed');
            }
            textContainer.innerHTML = renderMessageContent(assistantResponseText, searchResultsList, thinkingDuration, userExpanded);
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
            session.messages.push({ role: 'assistant', content: assistantResponseText, searchResults: searchResultsList, thinkingDuration: thinkingDuration });
            saveSessions();
        }

        dom.chatInput.value = '';
        dom.chatInput.style.height = '38px';
        checkSendButtonState();
        scrollToBottom(true);
        focusChatInput();
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

// TTS Player Implementation
class TTSPlayer {
    constructor() {
        this.audioElement = new Audio();
        this.audioElement.autoplay = false;
        this.queue = [];
        this.currentIndex = -1;
        this.currentMessageId = null;
        this.isPlaying = false;
        this.isPreparing = false;
        this.prefetchedUrls = {}; // maps index -> objectURL or prefetch Promise
    }

    stop(isManual = false) {
        const wasPlaying = this.isPlaying || this.isPreparing;
        this.isPreparing = false;
        if (this.audioElement) {
            try {
                this.audioElement.pause();
                this.audioElement.src = '';
                this.audioElement.onended = null;
                this.audioElement.onerror = null;
            } catch (e) {}
        }
        // Revoke Object URLs to avoid memory leaks
        Object.values(this.prefetchedUrls).forEach(url => {
            if (typeof url === 'string' && url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });
        this.prefetchedUrls = {};
        this.queue = [];
        this.currentIndex = -1;
        this.currentMessageId = null;
        this.isPlaying = false;
        this.updateUI();

        if (wasPlaying && isManual) {
            const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
            const t = TRANSLATIONS[lang];
            showToast(t.toastTtsStopped || 'Đã dừng phát giọng đọc.', 'success');
        }
    }

    updateUI() {
        document.querySelectorAll('.tts-msg-btn').forEach(btn => {
            const icon = btn.querySelector('i') || btn.querySelector('svg');
            const bubble = btn.closest('.message-content-box').querySelector('.message-bubble');
            const messageId = bubble ? bubble.getAttribute('data-tts-id') : '';

            if (this.currentMessageId === messageId) {
                if (this.isPreparing) {
                    if (icon) {
                        icon.setAttribute('data-lucide', 'loader-2');
                        icon.style.animation = 'spin 1.2s linear infinite';
                    }
                    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
                    const t = TRANSLATIONS[lang];
                    btn.title = t.preparing || 'Preparing...';
                } else if (this.isPlaying) {
                    if (icon) {
                        icon.setAttribute('data-lucide', 'square');
                        icon.style.animation = '';
                    }
                    const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
                    const t = TRANSLATIONS[lang];
                    btn.title = t.stopReading || 'Dừng đọc';
                }
            } else {
                if (icon) {
                    icon.setAttribute('data-lucide', 'volume-2');
                    icon.style.animation = '';
                }
                const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
                const t = TRANSLATIONS[lang];
                btn.title = t.readAloud || 'Đọc tin nhắn';
            }
        });
        createIconsSafe();
    }

    async playMessage(messageId, text) {
        this.stop();

        const lines = extractTextForTTS(text);
        if (lines.length === 0) {
            const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
            const t = TRANSLATIONS[lang];
            showToast(t.noTextToRead || 'No text content to read.', 'error');
            return;
        }

        this.queue = lines;
        this.currentIndex = 0;
        this.currentMessageId = messageId;
        this.isPlaying = true;
        this.isPreparing = true;
        this.updateUI();

        const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
        const t = TRANSLATIONS[lang];
        showToast(t.toastTtsPlaying || 'Đang phát giọng đọc tin nhắn...', 'success');

        // Fetch first segment as blob to ensure Safari compatibility.
        // Safari rejects audio.play() on raw streaming URLs (NotSupportedError);
        // using a blob:// URL guarantees the media engine can decode the audio.
        const line = this.queue[0];
        const voice = localStorage.getItem(KEYS.TTS_VOICE) || 'BV074_streaming';
        const baseUrl = localStorage.getItem(KEYS.BASE_URL) || window.location.origin;
        const firstTtsUrl = `${baseUrl}/api/tts?text=${encodeURIComponent(line)}&voice=${voice}&format=wav`;

        // Prefetch next segment in background while we fetch the first
        this.triggerPrefetch(1);

        let firstSrcUrl = firstTtsUrl;
        try {
            const resp = await fetch(firstTtsUrl);
            if (resp.ok) {
                const blob = await resp.blob();
                firstSrcUrl = URL.createObjectURL(blob);
                this.prefetchedUrls[0] = firstSrcUrl;
            }
        } catch (fetchErr) {
            console.warn('TTS first segment prefetch failed, falling back to direct URL:', fetchErr);
        }

        if (!this.isPlaying) return; // stopped while fetching

        this.audioElement.src = firstSrcUrl;
        this.audioElement.load(); // Required by Safari to reset media pipeline

        this.audioElement.onended = () => {
            if (firstSrcUrl.startsWith('blob:')) {
                URL.revokeObjectURL(firstSrcUrl);
                delete this.prefetchedUrls[0];
            }
            this.currentIndex = 1;
            this.playNext();
        };

        this.audioElement.onerror = (e) => {
            console.error("Audio playback error on first segment:", e);
            if (firstSrcUrl.startsWith('blob:')) {
                URL.revokeObjectURL(firstSrcUrl);
                delete this.prefetchedUrls[0];
            }
            this.currentIndex = 1;
            this.playNext();
        };

        try {
            await this.audioElement.play();
            if (this.isPlaying && this.isPreparing) {
                this.isPreparing = false;
                this.updateUI();
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Failed to play first audio:", err);
                this.stop();
            }
        }
    }

    async playNext() {
        if (!this.isPlaying) return;

        if (this.currentIndex >= this.queue.length) {
            this.stop();
            return;
        }

        const line = this.queue[this.currentIndex];
        const voice = localStorage.getItem(KEYS.TTS_VOICE) || 'BV074_streaming';
        const baseUrl = localStorage.getItem(KEYS.BASE_URL) || window.location.origin;
        const ttsUrl = `${baseUrl}/api/tts?text=${encodeURIComponent(line)}&voice=${voice}&format=wav`;

        try {
            let srcUrl = ttsUrl;
            
            // Check if we have pre-fetched blob URL
            if (this.prefetchedUrls[this.currentIndex]) {
                const val = this.prefetchedUrls[this.currentIndex];
                if (val instanceof Promise) {
                    srcUrl = await val;
                } else {
                    srcUrl = val;
                }
            }

            this.audioElement.src = srcUrl;
            this.audioElement.load(); // Required by Safari to reset media pipeline

            // Prefetch next segment in background
            this.triggerPrefetch(this.currentIndex + 1);

            const capturedIndex = this.currentIndex;
            this.audioElement.onended = () => {
                if (srcUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(srcUrl);
                    delete this.prefetchedUrls[capturedIndex];
                }
                this.currentIndex++;
                this.playNext();
            };

            this.audioElement.onerror = (e) => {
                console.error("Audio playback error:", e);
                if (srcUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(srcUrl);
                    delete this.prefetchedUrls[capturedIndex];
                }
                this.currentIndex++;
                this.playNext();
            };

            const playPromise = this.audioElement.play();
            await playPromise;

            if (this.isPlaying && this.isPreparing) {
                this.isPreparing = false;
                this.updateUI();
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Failed to play audio:", err);
                const lang = localStorage.getItem(KEYS.LANGUAGE) || 'vi';
                const t = TRANSLATIONS[lang];
                showToast(t.failedToPlaySpeech || 'Failed to play speech.', 'error');
                this.stop();
            }
        }
    }

    triggerPrefetch(index) {
        if (index >= this.queue.length || this.prefetchedUrls[index]) return;

        const nextLine = this.queue[index];
        const voice = localStorage.getItem(KEYS.TTS_VOICE) || 'BV074_streaming';
        const baseUrl = localStorage.getItem(KEYS.BASE_URL) || window.location.origin;
        const ttsUrl = `${baseUrl}/api/tts?text=${encodeURIComponent(nextLine)}&voice=${voice}&format=wav`;

        // Fetch audio blob in background
        const prefetchPromise = fetch(ttsUrl)
            .then(resp => {
                if (!resp.ok) throw new Error('Fetch failed');
                return resp.blob();
            })
            .then(blob => {
                const url = URL.createObjectURL(blob);
                this.prefetchedUrls[index] = url;
                return url;
            })
            .catch(err => {
                console.error("Prefetch audio failed:", err);
                return ttsUrl; // fallback to raw endpoint
            });

        this.prefetchedUrls[index] = prefetchPromise;
    }
}

function extractTextForTTS(rawText) {
    // 1. Strip collapsible thinking/reasoning blocks
    const { content } = parseThinking(rawText);
    let processedText = content;

    // 2. Strip search grounding citations (e.g. [Nguồn 1], [Source 2], [3])
    processedText = processedText.replace(/\s*\[(Nguồn|Source)?\s*\d+\]/gi, '');

    let lines = processedText.split('\n');
    let ttsLines = [];
    let inCodeBlock = false;
    for (let line of lines) {
        let trimmed = line.trim();
        if (trimmed.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        if (inCodeBlock) {
            continue;
        }

        let cleanLine = line
            .replace(/`[^`]+`/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/[*#_\-~>]/g, '')
            .replace(/%%MATH_BLOCK_\d+%%/g, '')
            .trim();

        if (cleanLine.length > 950) {
            let chunks = splitLongLine(cleanLine);
            ttsLines.push(...chunks);
        } else if (cleanLine) {
            ttsLines.push(cleanLine);
        }
    }
    return ttsLines;
}

function splitLongLine(text) {
    let chunks = [];
    let remaining = text;
    while (remaining.length > 950) {
        let idx = remaining.lastIndexOf('.', 950);
        if (idx === -1) idx = remaining.lastIndexOf('?', 950);
        if (idx === -1) idx = remaining.lastIndexOf('!', 950);
        if (idx === -1) idx = remaining.lastIndexOf(' ', 950);
        if (idx === -1 || idx < 200) {
            idx = 950;
        }
        chunks.push(remaining.slice(0, idx + 1).trim());
        remaining = remaining.slice(idx + 1).trim();
    }
    if (remaining) {
        chunks.push(remaining);
    }
    return chunks;
}

window.addEventListener('DOMContentLoaded', init);
