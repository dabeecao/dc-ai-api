import { createIcons, BookOpen, RefreshCw, Languages, ShieldCheck, MessageSquare, Heart, X, User, Search, Brain, Volume2, Image, Sparkles, Globe, Menu, ChevronDown } from 'lucide';
import vi from './locales/vi.json';
import en from './locales/en.json';

const TRANSLATIONS = { vi, en };
const LANGUAGE_KEY = 'dc_chat_language';

createIcons({
    icons: {
        BookOpen,
        RefreshCw,
        Languages,
        ShieldCheck,
        MessageSquare,
        Heart,
        X,
        User,
        Search,
        Brain,
        Volume2,
        Image,
        Sparkles,
        Globe,
        Menu,
        ChevronDown
    }
});

const privacyTermsBtn = document.getElementById('privacyTermsBtn');
const privacyTermsModal = document.getElementById('privacyTermsModal');
const privacyTermsCloseBtn = document.getElementById('privacyTermsCloseBtn');
const languageSelect = document.getElementById('languageSelect');

if (privacyTermsBtn && privacyTermsModal && privacyTermsCloseBtn) {
    privacyTermsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        privacyTermsModal.classList.add('active');
    });

    const closeModal = () => {
        privacyTermsModal.classList.remove('active');
    };

    privacyTermsCloseBtn.addEventListener('click', closeModal);
    privacyTermsModal.addEventListener('click', (e) => {
        if (e.target === privacyTermsModal) {
            closeModal();
        }
    });
}

function applyLanguage() {
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const t = TRANSLATIONS[lang];

    document.title = t.landingTitle || "DC AI API";

    const elH1 = document.getElementById('lblLandingH1');
    if (elH1) elH1.textContent = t.landingH1;

    const elDesc = document.getElementById('lblLandingDesc');
    if (elDesc) elDesc.textContent = t.landingDesc;

    const elStartChatting = document.getElementById('lblLandingStartChatting');
    if (elStartChatting) {
        elStartChatting.innerHTML = `<i data-lucide="message-square"></i> ${t.landingStartChatting}`;
    }

    const elUserPortal = document.getElementById('lblLandingUserPortal');
    if (elUserPortal) {
        elUserPortal.innerHTML = `<i data-lucide="user"></i> ${t.landingUserPortal}`;
    }

    const elExploreDocs = document.getElementById('lblLandingExploreDocs');
    if (elExploreDocs) {
        elExploreDocs.innerHTML = `<i data-lucide="book-open"></i> ${t.landingExploreDocs}`;
    }

    // Card 1
    const elCard1Title = document.getElementById('lblCard1Title');
    if (elCard1Title) elCard1Title.textContent = t.landingCard1Title;
    const elCard1Desc = document.getElementById('lblCard1Desc');
    if (elCard1Desc) elCard1Desc.textContent = t.landingCard1Desc;

    // Card 2
    const elCard2Title = document.getElementById('lblCard2Title');
    if (elCard2Title) elCard2Title.textContent = t.landingCard2Title;
    const elCard2Desc = document.getElementById('lblCard2Desc');
    if (elCard2Desc) elCard2Desc.textContent = t.landingCard2Desc;

    // Card 3
    const elCard3Title = document.getElementById('lblCard3Title');
    if (elCard3Title) elCard3Title.textContent = t.landingCard3Title;
    const elCard3Desc = document.getElementById('lblCard3Desc');
    if (elCard3Desc) elCard3Desc.textContent = t.landingCard3Desc;

    // Showcase
    const elShowcaseTag = document.getElementById('lblShowcaseTag');
    if (elShowcaseTag) elShowcaseTag.textContent = t.landingShowcaseTag;

    const elShowcaseTitle = document.getElementById('lblShowcaseTitle');
    if (elShowcaseTitle) elShowcaseTitle.textContent = t.landingShowcaseTitle;

    const elShowcaseDesc = document.getElementById('lblShowcaseDesc');
    if (elShowcaseDesc) elShowcaseDesc.textContent = t.landingShowcaseDesc;

    // Showcase feature 1
    const elShowcaseF1Title = document.getElementById('lblShowcaseF1Title');
    if (elShowcaseF1Title) elShowcaseF1Title.textContent = t.landingFeature1Title;
    const elShowcaseF1Desc = document.getElementById('lblShowcaseF1Desc');
    if (elShowcaseF1Desc) elShowcaseF1Desc.textContent = t.landingFeature1Desc;

    // Showcase feature 2
    const elShowcaseF2Title = document.getElementById('lblShowcaseF2Title');
    if (elShowcaseF2Title) elShowcaseF2Title.textContent = t.landingFeature2Title;
    const elShowcaseF2Desc = document.getElementById('lblShowcaseF2Desc');
    if (elShowcaseF2Desc) elShowcaseF2Desc.textContent = t.landingFeature2Desc;

    // Showcase feature 3
    const elShowcaseF3Title = document.getElementById('lblShowcaseF3Title');
    if (elShowcaseF3Title) elShowcaseF3Title.textContent = t.landingFeature3Title;
    const elShowcaseF3Desc = document.getElementById('lblShowcaseF3Desc');
    if (elShowcaseF3Desc) elShowcaseF3Desc.textContent = t.landingFeature3Desc;

    // Showcase feature 4
    const elShowcaseF4Title = document.getElementById('lblShowcaseF4Title');
    if (elShowcaseF4Title) elShowcaseF4Title.textContent = t.landingFeature4Title;
    const elShowcaseF4Desc = document.getElementById('lblShowcaseF4Desc');
    if (elShowcaseF4Desc) elShowcaseF4Desc.textContent = t.landingFeature4Desc;

    // Mockup messages
    const elMockUserMsg = document.getElementById('lblMockUserMsg');
    if (elMockUserMsg) elMockUserMsg.textContent = t.landingMockUserMsg;

    const elMockSearchStatus = document.getElementById('lblMockSearchStatus');
    if (elMockSearchStatus) elMockSearchStatus.textContent = t.landingMockSearchStatus;

    const elMockThoughtHeader = document.getElementById('lblMockThoughtHeader');
    if (elMockThoughtHeader) elMockThoughtHeader.textContent = t.landingMockThoughtHeader;

    const elMockThoughtBody = document.getElementById('lblMockThoughtBody');
    if (elMockThoughtBody) elMockThoughtBody.textContent = t.landingMockThoughtBody;

    const elMockAssistantMsg = document.getElementById('lblMockAssistantMsg');
    if (elMockAssistantMsg) elMockAssistantMsg.innerHTML = t.landingMockAssistantMsg;

    const elMockInput = document.getElementById('lblMockInput');
    if (elMockInput) elMockInput.textContent = t.landingMockInputPlaceholder;

    // Donate label in header
    const elDonate = document.getElementById('lblDonate');
    if (elDonate) elDonate.textContent = t.donate || "Donate";

    // Privacy Terms Modal
    const elPrivacyModalTitle = document.getElementById('lblPrivacyModalTitle');
    if (elPrivacyModalTitle) elPrivacyModalTitle.textContent = t.landingPrivacyModalTitle;

    const elPrivacyModalBody = document.getElementById('lblPrivacyModalBody');
    if (elPrivacyModalBody) elPrivacyModalBody.innerHTML = t.privacyTermsContent;

    // Re-create Lucide icons to draw icons inside dynamic HTML
    try {
        createIcons({
            icons: {
                BookOpen,
                RefreshCw,
                Languages,
                ShieldCheck,
                MessageSquare,
                Heart,
                X,
                User,
                Search,
                Brain,
                Volume2,
                Image,
                Sparkles,
                Globe,
                Menu,
                ChevronDown
            }
        });
    } catch (e) {
        console.error('Failed to render icons:', e);
    }
}

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
}
