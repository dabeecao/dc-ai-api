import vi from './locales/vi.json';
import en from './locales/en.json';

const TRANSLATIONS = { vi, en };
const LANGUAGE_KEY = 'dc_chat_language';

function t(key, params = {}) {
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    let str = TRANSLATIONS[lang]?.[key] || TRANSLATIONS['vi']?.[key] || key;
    for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, v);
    }
    return str;
}

function applyLanguage() {
    const lang = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    const tr = TRANSLATIONS[lang];
    if (!tr) return;

    document.title = tr.adminPageTitle || 'DC AI API Dashboard';

    // Helper to safely set textContent
    const setText = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.textContent = tr[key] || '';
    };
    // Helper to safely set innerHTML
    const setHTML = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = tr[key] || '';
    };
    // Helper to safely set placeholder
    const setPlaceholder = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.placeholder = tr[key] || '';
    };

    // Header
    setText('lblAdminPortalTitle', 'adminPortalTitle');
    setText('lblApiDocs', 'apiDocs');
    setText('lblLogout', 'dashLogout');

    // Tabs
    setText('lblTabStats', 'adminTabStats');
    setText('lblTabUpstream', 'adminTabUpstream');
    setText('lblTabClient', 'adminTabClients');
    setText('lblTabUsers', 'adminTabUsers');
    setText('lblTabSettings', 'adminTabSettings');
    setText('lblTabErrorLogs', 'adminTabErrorLogs');

    // Tooltip/title for the tab buttons
    const setTooltip = (id, key) => {
        const el = document.getElementById(id);
        if (el) el.title = tr[key] || '';
    };
    setTooltip('tabStats', 'adminTabStats');
    setTooltip('tabUpstream', 'adminTabUpstream');
    setTooltip('tabClient', 'adminTabClients');
    setTooltip('tabUsers', 'adminTabUsers');
    setTooltip('tabSettings', 'adminTabSettings');
    setTooltip('tabErrorLogs', 'adminTabErrorLogs');

    // Stats panel
    setText('lblProxyUpstreamStats', 'adminStatsTitle');
    setText('lblTotalUpstreamKeys', 'adminTotalUpstreamKeys');
    setText('lblActiveUpstreamKeys', 'adminActiveUpstreamKeys');
    setText('lblActiveClientKeys', 'adminActiveClientKeys');
    setText('lblFallbackStats', 'adminFallbackStats');
    setText('lblFallbackTotalRequests', 'adminFallbackTotalRequests');
    setText('lblFallbackSuccessCount', 'adminFallbackSuccessCount');
    setText('lblFallbackFailureCount', 'adminFallbackFailureCount');
    setText('lblFallbackSuccessRate', 'adminFallbackSuccessRate');
    setText('lblSuccessRate', 'adminSuccessRate');
    setText('lblTokenConsumptionStats', 'adminTokenConsumptionStats');
    setText('lblUpstreamTokensConsumed', 'adminUpstreamTokensConsumed');
    setText('lblFallbackTokensConsumed', 'adminFallbackTokensConsumed');

    // Add key form
    setText('lblAddKeyLabel', 'adminAddKeyLabel');
    setPlaceholder('keyLabel', 'adminAddKeyLabelPlaceholder');
    setText('lblAddKeySecret', 'adminAddKeySecret');
    setPlaceholder('keySecret', 'adminAddKeySecretPlaceholder');
    setText('lblAddKeyURL', 'adminAddKeyURL');
    setPlaceholder('keyURL', 'adminAddKeyURLPlaceholder');
    setText('lblAutoDetectedFormats', 'adminAutoDetectedFormats');
    setText('lblSelectModelsToExpose', 'adminSelectModelsToExpose');
    setText('lblShowSelectedOnly', 'adminShowSelectedOnly');
    setPlaceholder('modelFilterInput', 'adminFilterModels');
    setText('lblSupportOpenAI', 'supportOpenAI');
    setText('lblSupportGemini', 'supportGemini');
    setText('lblSupportClaude', 'supportClaude');

    // Client key form
    setText('lblClientKeyLabel', 'adminClientNameApp');
    setPlaceholder('clientKeyLabel', 'adminClientNameAppPlaceholder');
    const elGenerateBtn = document.getElementById('lblGenerateApiKeyBtn');
    if (elGenerateBtn) {
        const spanEl = elGenerateBtn.querySelector('span');
        if (spanEl) spanEl.textContent = tr.adminGenerateApiKey;
    }

    // Settings panel
    setText('lblSettingsFallbackKey', 'adminDefaultFallbackKey');
    setText('lblSettingsFallbackURL', 'adminDefaultFallbackURL');
    setText('lblSettingsFallbackModel', 'adminDefaultFallbackModel');
    setText('lblSettingsFallbackAPIType', 'adminFallbackAPIType');
    setText('lblSettingsMaxRequestSize', 'adminMaxPayloadSize');
    setText('lblSelectFallbackModel', 'adminSelectFallbackModel');
    setText('lblFallbackAPITypeAuto', 'optApiAuto');
    setText('lblSaveSettingsBtn', 'adminSaveSettings');

    const settingsFetchModelsBtn = document.getElementById('settingsFetchModelsBtn');
    if (settingsFetchModelsBtn) {
        const spanEl = settingsFetchModelsBtn.querySelector('span');
        if (spanEl) spanEl.textContent = tr.adminFetchModels || 'Fetch Models';
    }
    const settingsGenGuestKeyBtn = document.getElementById('settingsGenGuestKeyBtn');
    if (settingsGenGuestKeyBtn) {
        const spanEl = settingsGenGuestKeyBtn.querySelector('span');
        if (spanEl) spanEl.textContent = tr.adminGenerateApiKey || 'Generate Key';
    }

    // Guest key settings
    setText('lblGuestKeySettingsTitle', 'adminGuestKeySettingsTitle');
    setText('lblEnableGuestKey', 'adminEnableGuestKey');
    setText('lblGuestKeyLabel', 'adminGuestKeyLabel');
    setText('lblGuestModelLabel', 'adminGuestModelLabel');
    setText('lblSelectGuestModel', 'adminSelectGuestModel');

    // Backup & Restore
    setText('lblBackupRestoreTitle', 'adminBackupRestoreTitle');
    setHTML('lblBackupRestoreDesc', 'adminBackupRestoreDesc');

    // Edit modal
    setText('lblEditModalHeader', 'adminEditUpstreamKey');
    setText('lblEditKeyLabel', 'adminAddKeyLabel');
    setText('lblEditKeySecret', 'adminAddKeySecret');
    setText('lblEditKeyURL', 'adminAddKeyURL');
    setText('lblEditExposedModels', 'adminExposedModels');
    setText('lblEditShowSelectedOnly', 'adminShowSelectedOnly');
    setText('lblEditSupportOpenAI', 'supportOpenAI');
    setText('lblEditSupportGemini', 'supportGemini');
    setText('lblEditSupportClaude', 'supportClaude');
    setText('lblCancelEditBtn', 'cancel');

    // Key gen modal
    setText('lblKeyGenModalHeader', 'adminKeyGenModalHeader');
    setText('lblKeyGenModalDesc', 'adminKeyGenModalDesc');
    setText('lblCloseKeyGenModalBtn', 'adminCloseKeyGenModalBtn');

    // User stats modal
    setText('lblUserStatsModalHeader', 'adminUserStatsModalHeader');
    setText('lblCloseUserStatsModalBtn', 'adminClose');

    // Table headers — Upstream
    setText('lblThUpstreamLabel', 'dashTableLabel');
    setText('lblThUpstreamKey', 'dashTableKey');
    setText('lblThUpstreamStatus', 'dashTableStatus');
    setText('lblThUpstreamRequests', 'dashRequests');
    setText('lblThUpstreamSuccessFail', 'adminFallbackSuccessFail');
    setText('lblThUpstreamActions', 'adminThActions');

    // Table headers — Client
    setText('lblThClientLabel', 'dashTableLabel');
    setText('lblThClientKey', 'dashTableKey');
    setText('lblThClientStatus', 'dashTableStatus');
    setText('lblThClientRequests', 'dashRequests');
    setText('lblThClientLastUsed', 'adminClientLastUsed');
    setText('lblThClientActions', 'adminThActions');

    // Table headers — Error Logs
    setText('lblThLogsTimestamp', 'adminThTimestamp');
    setText('lblThLogsUpstreamKey', 'adminThUpstreamKey');
    setText('lblThLogsStatusCode', 'adminThStatusCode');
    setText('lblThLogsErrorMessage', 'adminThErrorMessage');
    setText('lblThLogsActions', 'adminThActions');

    // Table headers — Users
    setText('lblThUsersUsername', 'dashUsername');
    setText('lblThUsersStatus', 'dashTableStatus');
    setText('lblThUsersCreatedAt', 'adminThCreatedAt');
    setText('lblThUsersTotalKeys', 'adminTotalKeys');
    setText('lblThUsersRequests', 'dashRequests');
    setText('lblThUsersTotalTokens', 'dashTotalTokens');
    setText('lblThUsersActions', 'adminThActions');

    // User stats modal table headers
    setText('lblModalSectionClientKeys', 'dashKeyManagement');
    setText('lblModalSectionModelStats', 'adminStatsTitle');
    setText('lblModalThKeyLabel', 'adminAddKeyLabel');
    setText('lblModalThKeyStatus', 'adminStatusActive');
    setText('lblModalThKeyRequests', 'adminFallbackTotalRequests');
    setText('lblModalThKeyTotalTokens', 'adminUpstreamTokensConsumed');
    setText('lblModalThKeyLastUsed', 'adminClientLastUsed');
    setText('lblModalThModelName', 'adminExposedModels');
    setText('lblModalThRequests', 'adminFallbackTotalRequests');
    setText('lblModalThPromptTokens', 'adminPromptAbbr');
    setText('lblModalThCompletionTokens', 'adminCompletionAbbr');
    setText('lblModalThTotalTokens', 'adminUpstreamTokensConsumed');
    setText('lblModalStatRequests', 'adminFallbackTotalRequests');
    setText('lblModalStatPromptTokens', 'adminPromptAbbr');
    setText('lblModalStatCompletionTokens', 'adminCompletionAbbr');
    setText('lblModalStatTotalTokens', 'adminUpstreamTokensConsumed');

    // Error logs
    const elClearAllLogs = document.getElementById('clearErrorLogsBtn');
    if (elClearAllLogs) {
        const spanEl = elClearAllLogs.querySelector('span');
        if (spanEl) spanEl.textContent = tr.adminClearAllLogs;
    }
    setPlaceholder('errorLogFilterInput', 'adminPlaceholderFilterLogs');
    setPlaceholder('upstreamKeyFilter', 'adminPlaceholderFilter');
    setPlaceholder('clientKeyFilter', 'adminPlaceholderFilter');

    // Buttons
    const fetchModelsBtn = document.getElementById('fetchModelsBtn');
    if (fetchModelsBtn) {
        const spanEl = fetchModelsBtn.querySelector('span');
        if (spanEl) spanEl.textContent = tr.adminFetchModels;
    }
    const selectAllBtn = document.getElementById('selectAllModelsBtn');
    if (selectAllBtn) selectAllBtn.textContent = tr.adminSelectAll;
    const clearBtn = document.getElementById('clearModelsBtn');
    if (clearBtn) clearBtn.textContent = tr.adminClear;
    const saveNewKeyBtn = document.getElementById('saveNewKeyBtn');
    if (saveNewKeyBtn) {
        const spanEl = saveNewKeyBtn.querySelector('span');
        if (spanEl) spanEl.textContent = tr.adminSaveAndAddKey;
    }
    const saveEditBtn = document.getElementById('saveEditBtn');
    if (saveEditBtn) {
        const spanEl = saveEditBtn.querySelector('span');
        if (spanEl) spanEl.textContent = tr.adminSaveEdit;
    }
    const exportBackupBtn = document.getElementById('exportBackupBtn');
    if (exportBackupBtn) {
        const spanEl = exportBackupBtn.querySelector('span');
        if (spanEl) spanEl.textContent = tr.adminExportBackup;
    }
    const importBackupTriggerBtn = document.getElementById('importBackupTriggerBtn');
    if (importBackupTriggerBtn) {
        const spanEl = importBackupTriggerBtn.querySelector('span');
        if (spanEl) spanEl.textContent = tr.adminImportBackup;
    }

    // Set language selector value
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) langSelect.value = lang;
}

function getLocalizedMessage(msg) {
    if (!msg) return '';
    const exactMatches = {
        'Logged out successfully': 'toastLoggedOut',
        'API Key and Upstream URL are required to fetch models': 'toastApiKeyUrlRequired',
        'Fetching and verifying models against upstream...': 'toastFetchingModels',
        'Please select at least one model to expose': 'toastSelectAtLeastOneModel',
        'Upstream key added successfully': 'toastUpstreamKeyAdded',
        'Client API key generated': 'toastClientKeyGenerated',
        'Settings saved successfully': 'toastSettingsSaved',
        'Fetching models for fallback upstream...': 'toastFetchingModels',
        'No models returned by this upstream': 'toastNoModelsReturned',
        'Failed to load settings': 'toastFailedToLoadSettings',
        'Session expired. Please log in again.': 'toastSessionExpired',
        'Session expired': 'toastSessionExpiredShort',
        'All error logs cleared': 'toastAllLogsCleared',
        'Log entry deleted': 'toastLogEntryDeleted',
        'Upstream configuration duplicated! Please enter the new API Key.': 'toastKeyDuplicated',
        'Upstream key removed successfully': 'toastKeyRemoved',
        'Client key deleted successfully': 'toastClientKeyRemoved',
        'Refetching models from upstream...': 'toastRefetchingModels',
        'Upstream API key updated successfully': 'toastUpstreamKeyUpdated',
        'Copied to clipboard': 'toastCopied',
        'Failed to copy text': 'toastCopyFailed',
        'User deleted successfully': 'toastUserDeleted',
        'Failed to load users list': 'toastFailedToLoadUsers',
        'Failed to load user stats': 'toastFailedToLoadUserStats',
        'Backup configuration exported successfully': 'toastBackupExported',
        'Backup restored successfully! Reloading...': 'toastBackupImported',
        'Invalid JSON backup file': 'toastInvalidBackupFile',
        'Guest API key generated': 'toastGuestKeyGenerated'
    };
    if (exactMatches[msg]) return t(exactMatches[msg]);

    // Pattern-based matches
    const patterns = [
        { re: /^Fetched (\d+) models successfully!$/, key: 'toastFetchedModelsSuccess', param: 'count' },
        { re: /^Refetched (\d+) models successfully!$/, key: 'toastFetchedModelsSuccess', param: 'count' },
        { re: /^Loaded (\d+) fallback models!$/, key: 'toastLoadedFallbackModels', param: 'count' },
        { re: /^Failed to fetch models: (.+)$/, key: 'toastFetchModelsFailed', param: 'error' },
        { re: /^Network error fetching models: (.+)$/, key: 'toastNetworkError', param: 'error' },
        { re: /^Network error refetching models: (.+)$/, key: 'toastNetworkError', param: 'error' },
        { re: /^Failed to add key: (.+)$/, key: 'toastFailedToAddKey', param: 'error' },
        { re: /^Network error saving key: (.+)$/, key: 'toastNetworkError', param: 'error' },
        { re: /^Failed to generate client key: (.+)$/, key: 'toastFailedToGenerateClientKey', param: 'error' },
        { re: /^Failed to save settings: (.+)$/, key: 'toastFailedToSaveSettings', param: 'error' },
        { re: /^Error saving settings: (.+)$/, key: 'toastNetworkError', param: 'error' },
        { re: /^Failed to clear logs: (.+)$/, key: 'toastFailedToClearLogs', param: 'error' },
        { re: /^Failed to delete log: (.+)$/, key: 'toastFailedToDeleteLog', param: 'error' },
        { re: /^Key status updated to (.+)$/, key: 'toastKeyStatusUpdated', param: 'status' },
        { re: /^Failed to update status: (.+)$/, key: 'toastFailedToUpdateStatus', param: 'error' },
        { re: /^Failed to delete key: (.+)$/, key: 'toastFailedToDeleteKey', param: 'error' },
        { re: /^Client key status updated to (.+)$/, key: 'toastClientKeyStatusUpdated', param: 'status' },
        { re: /^Failed to delete client key: (.+)$/, key: 'toastFailedToDeleteClientKey', param: 'error' },
        { re: /^Failed to update key: (.+)$/, key: 'toastFailedToUpdateKey', param: 'error' },
        { re: /^User status updated to (.+)$/, key: 'toastUserStatusUpdated', param: 'status' },
        { re: /^Failed to update user: (.+)$/, key: 'toastFailedToUpdateUser', param: 'error' },
        { re: /^Failed to delete user: (.+)$/, key: 'toastFailedToDeleteUser', param: 'error' },
        { re: /^Failed to load users: (.+)$/, key: 'toastFailedToLoadUsers', param: 'error' },
        { re: /^Failed to export backup: (.+)$/, key: 'toastBackupExportFailed', param: 'error' },
        { re: /^Failed to import backup: (.+)$/, key: 'toastBackupImportFailed', param: 'error' },
        { re: /^Failed to generate guest key: (.+)$/, key: 'toastFailedToGenerateGuestKey', param: 'error' },
        { re: /^Triggered verification test for key (.+)$/, key: 'toastTriggeredVerification', param: 'id' },
        { re: /^Verification test for key ID (.+?) succeeded!$/, key: 'toastVerificationSuccess', param: 'id' },
        { re: /^Verification test for key ID (.+?) failed: (.+)$/, key: 'toastVerificationFailed', param: 'id' },
        { re: /^Network failure testing key (.+?): (.+)$/, key: 'toastNetworkError', param: 'error' }
    ];
    for (const p of patterns) {
        const m = msg.match(p.re);
        if (m) return t(p.key, { [p.param]: m[1] });
    }
    return msg;
}



// Override confirm for localization
const _origConfirm = window.confirm;
window.confirm = function(msg) {
    const confirmMap = {
        'Are you sure you want to clear all error logs from the database?': 'confirmClearAllLogs',
        'Are you sure you want to delete this log entry?': 'confirmDeleteLog',
        'Are you sure you want to remove this API key from the rotation pool?': 'confirmDeleteUpstreamKey',
        'Are you sure you want to permanently delete this client API key? Any applications currently using this key will immediately be rejected.': 'confirmDeleteClientKey',
        'Are you sure you want to restore this backup? This will delete all current keys, clients, and settings!': 'confirmRestoreBackup',
        'Are you sure you want to delete this user? This will delete all client keys and stats associated with this user! This action is permanent.': 'confirmDeleteUser'
    };
    if (confirmMap[msg]) return _origConfirm.call(window, t(confirmMap[msg]));
    return _origConfirm.call(window, msg);
};

// State variables
let keys = [];
let clientKeys = [];
let errorLogs = [];
let stats = {};
let editingKeyId = null;
let activeTab = 'stats'; // 'stats', 'upstream', 'client', or 'settings'
let authRequired = false;

// Upstream Key Creation / Models State
let addKeyFetchedModels = [];
let editKeyAvailableModels = [];

// Dom Elements
let adminToken = localStorage.getItem('admin_token') || '';
const logoutBtn = document.getElementById('logoutBtn');
const keysTableBody = document.getElementById('keysTableBody');
const clientKeysTableBody = document.getElementById('clientKeysTableBody');
const addKeyForm = document.getElementById('addKeyForm');
const addClientKeyForm = document.getElementById('addClientKeyForm');

// Tab Elements
const tabStats = document.getElementById('tabStats');
const tabUpstream = document.getElementById('tabUpstream');
const tabClient = document.getElementById('tabClient');
const tabUsers = document.getElementById('tabUsers');
const tabSettings = document.getElementById('tabSettings');
const tabErrorLogs = document.getElementById('tabErrorLogs');
const upstreamKeyFilter = document.getElementById('upstreamKeyFilter');
const statsContainer = document.getElementById('statsContainer');
const upstreamTableContainer = document.getElementById('upstreamTableContainer');
const clientTableContainer = document.getElementById('clientTableContainer');
const usersTableContainer = document.getElementById('usersTableContainer');
const settingsContainer = document.getElementById('settingsContainer');
const errorLogsContainer = document.getElementById('errorLogsContainer');
const errorLogsTableBody = document.getElementById('errorLogsTableBody');
const errorLogsCardsMobile = document.getElementById('errorLogsCardsMobile');
const usersTableBody = document.getElementById('usersTableBody');
const panelTitle = document.getElementById('panelTitle');

// Add Upstream Key Elements
const fetchModelsBtn = document.getElementById('fetchModelsBtn');
const apiSupportContainer = document.getElementById('apiSupportContainer');
const supportOpenAI = document.getElementById('supportOpenAI');
const supportGemini = document.getElementById('supportGemini');
const supportClaude = document.getElementById('supportClaude');
const addKeyModelsContainer = document.getElementById('addKeyModelsContainer');
const addKeyModelsList = document.getElementById('addKeyModelsList');
const addAllModelsBtn = document.getElementById('addAllModelsBtn');
const clearAllModelsBtn = document.getElementById('clearAllModelsBtn');
const addKeyModelFilter = document.getElementById('addKeyModelFilter');
const addKeyShowSelectedOnly = document.getElementById('addKeyShowSelectedOnly');
const saveNewKeyBtn = document.getElementById('saveNewKeyBtn');

// Edit Upstream Key Elements (Modal)
const editSupportOpenAI = document.getElementById('editSupportOpenAI');
const editSupportGemini = document.getElementById('editSupportGemini');
const editSupportClaude = document.getElementById('editSupportClaude');
const editKeyModelsList = document.getElementById('editKeyModelsList');
const editKeyModelFilter = document.getElementById('editKeyModelFilter');
const editKeyShowSelectedOnly = document.getElementById('editKeyShowSelectedOnly');
const editSelectAllModelsBtn = document.getElementById('editSelectAllModelsBtn');
const editClearAllModelsBtn = document.getElementById('editClearAllModelsBtn');
const editRefetchModelsBtn = document.getElementById('editRefetchModelsBtn');

// Settings Elements
const settingsForm = document.getElementById('settingsForm');
const settingsFetchModelsBtn = document.getElementById('settingsFetchModelsBtn');
const fallbackModelsList = document.getElementById('settingsFallbackModel');
const guestModelsList = document.getElementById('settingsGuestModel');

// Custom Toast Notification System
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const localizedMessage = getLocalizedMessage(message);
    toast.innerHTML = `
        <div class="toast-icon"></div>
        <div class="toast-message" style="flex: 1; min-width: 0; word-break: break-word;">${escapeHtml(localizedMessage)}</div>
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

    // Trigger reflow to apply transition
    toast.offsetHeight;

    toast.classList.add('show');

    // Automatically remove after 4 seconds
    dismissTimeout = setTimeout(dismiss, 4000);
}

// Human readable token formatting helper
function formatTokens(t) {
    if (!t || t <= 0) return '0 tokens';
    if (t < 1000) return t + ' tokens';
    if (t < 1000000) return (t / 1000).toFixed(1) + 'K';
    return (t / 1000000).toFixed(2) + 'M';
}

// Logout handler
logoutBtn.addEventListener('click', async () => {
    try {
        await fetch('/admin/api/logout', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + adminToken,
                'x-admin-token': adminToken
            }
        });
    } catch (err) {
        console.error("Logout request failed:", err);
    }
    adminToken = '';
    localStorage.removeItem('admin_token');
    showLoginOverlay();
    showToast('Logged out successfully', 'info');
});



// Tab switching animations helper
function triggerPaneAnimation(elements) {
    elements.forEach(el => {
        el.classList.remove('tab-pane-animate');
        void el.offsetWidth; // Force DOM reflow to restart keyframe animation
        el.classList.add('tab-pane-animate');
    });
}

function hideAllPanes() {
    [tabStats, tabUpstream, tabClient, tabUsers, tabSettings, tabErrorLogs].forEach(tab => {
        if (tab) tab.classList.remove('active');
    });
    [statsContainer, addKeyForm, addClientKeyForm, upstreamTableContainer, clientTableContainer, settingsContainer, errorLogsContainer, usersTableContainer].forEach(container => {
        if (container) container.style.display = 'none';
    });
}

// Tab switching
tabStats.addEventListener('click', () => {
    activeTab = 'stats';
    hideAllPanes();
    tabStats.classList.add('active');
    statsContainer.style.display = 'block';
    panelTitle.textContent = t('adminTabStats');
    triggerPaneAnimation([statsContainer]);
    loadData();
});

tabUpstream.addEventListener('click', () => {
    activeTab = 'upstream';
    hideAllPanes();
    tabUpstream.classList.add('active');
    addKeyForm.style.display = 'flex';
    upstreamTableContainer.style.display = 'block';
    panelTitle.textContent = t('adminTabUpstream');
    triggerPaneAnimation([addKeyForm, upstreamTableContainer]);
    renderKeysSkeleton();
    loadData();
});

tabClient.addEventListener('click', () => {
    activeTab = 'client';
    hideAllPanes();
    tabClient.classList.add('active');
    addClientKeyForm.style.display = 'grid';
    clientTableContainer.style.display = 'block';
    panelTitle.textContent = t('adminTabClients');
    triggerPaneAnimation([addClientKeyForm, clientTableContainer]);
    renderClientKeysSkeleton();
    loadClientKeys();
});

tabUsers.addEventListener('click', () => {
    activeTab = 'users';
    hideAllPanes();
    tabUsers.classList.add('active');
    usersTableContainer.style.display = 'block';
    panelTitle.textContent = t('adminTabUsers');
    triggerPaneAnimation([usersTableContainer]);
    renderUsersSkeleton();
    loadUsers();
});

tabSettings.addEventListener('click', () => {
    activeTab = 'settings';
    hideAllPanes();
    tabSettings.classList.add('active');
    settingsContainer.style.display = 'block';
    panelTitle.textContent = t('adminTabSettings');
    triggerPaneAnimation([settingsContainer]);
    loadSettings();
});

tabErrorLogs.addEventListener('click', () => {
    activeTab = 'errorLogs';
    hideAllPanes();
    tabErrorLogs.classList.add('active');
    errorLogsContainer.style.display = 'block';
    panelTitle.textContent = t('adminTabErrorLogs');
    triggerPaneAnimation([errorLogsContainer]);
    renderErrorLogsSkeleton();
    loadErrorLogs();
});

// Fetch models on Add Key Details change
fetchModelsBtn.addEventListener('click', async () => {
    const key = document.getElementById('keySecret').value.trim();
    const upstream_url = document.getElementById('keyURL').value.trim();

    if (!key || !upstream_url) {
        showToast('API Key and Upstream URL are required to fetch models', 'error');
        return;
    }

    fetchModelsBtn.disabled = true;
    const originalHTML = fetchModelsBtn.innerHTML;
    const svgEl = fetchModelsBtn.querySelector('svg');
    const svgHtml = svgEl ? svgEl.outerHTML : '';
    fetchModelsBtn.innerHTML = `${svgHtml} <span>${t('adminFetching') || 'Fetching...'}</span>`;

    showToast('Fetching and verifying models against upstream...', 'info');

    try {
        const payload = { key, upstream_url };
        if (apiSupportContainer.style.display !== 'none') {
            payload.supports_openai = supportOpenAI.checked;
            payload.supports_gemini = supportGemini.checked;
            payload.supports_claude = supportClaude.checked;
        }

        const res = await apiFetch('/admin/api/keys/fetch-models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
            // Check supports options based on auto-detection
            supportOpenAI.checked = data.supports_openai;
            supportGemini.checked = data.supports_gemini;
            supportClaude.checked = data.supports_claude;
            
            apiSupportContainer.style.display = 'flex';

            addKeyFetchedModels = data.models || [];
            renderAddKeyModelsList(addKeyFetchedModels, true);
            addKeyModelsContainer.style.display = 'block';

            showToast(`Fetched ${addKeyFetchedModels.length} models successfully!`, 'success');
        } else {
            showToast('Failed to fetch models: ' + (data.error || 'Connection failed'), 'error');
        }
    } catch (err) {
        showToast('Network error fetching models: ' + err.message, 'error');
    } finally {
        fetchModelsBtn.disabled = false;
        fetchModelsBtn.innerHTML = originalHTML;
    }
});

// Model Counts helper functions
function updateAddKeyModelCounts() {
    const total = addKeyModelsList.querySelectorAll('.model-checkbox-item').length;
    const selected = addKeyModelsList.querySelectorAll('.model-checkbox-item input[type="checkbox"]:checked').length;
    const countEl = document.getElementById('addKeyModelsCount');
    if (countEl) {
        countEl.textContent = `(${selected}/${total})`;
    }
}

function updateEditKeyModelCounts() {
    const total = editKeyModelsList.querySelectorAll('.model-checkbox-item').length;
    const selected = editKeyModelsList.querySelectorAll('.model-checkbox-item input[type="checkbox"]:checked').length;
    const countEl = document.getElementById('editKeyModelsCount');
    if (countEl) {
        countEl.textContent = `(${selected}/${total})`;
    }
}

// Combined filtering for Add Key
function filterAddKeyModels() {
    const q = addKeyModelFilter.value.toLowerCase().trim();
    const showSelectedOnly = addKeyShowSelectedOnly.checked;
    const items = addKeyModelsList.querySelectorAll('.model-checkbox-item');
    items.forEach(item => {
        const text = item.querySelector('span').innerText.toLowerCase();
        const cb = item.querySelector('input[type="checkbox"]');
        const isSelected = cb ? cb.checked : false;

        const matchesQuery = text.includes(q);
        const matchesSelected = !showSelectedOnly || isSelected;

        if (matchesQuery && matchesSelected) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Combined filtering for Edit Key Modal
function filterEditKeyModels() {
    const q = editKeyModelFilter.value.toLowerCase().trim();
    const showSelectedOnly = editKeyShowSelectedOnly.checked;
    const items = editKeyModelsList.querySelectorAll('.model-checkbox-item');
    items.forEach(item => {
        const text = item.querySelector('span').innerText.toLowerCase();
        const cb = item.querySelector('input[type="checkbox"]');
        const isSelected = cb ? cb.checked : false;

        const matchesQuery = text.includes(q);
        const matchesSelected = !showSelectedOnly || isSelected;

        if (matchesQuery && matchesSelected) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Select All / Clear models for Add Key
addAllModelsBtn.addEventListener('click', () => {
    const items = addKeyModelsList.querySelectorAll('.model-checkbox-item');
    items.forEach(item => {
        if (item.style.display !== 'none') {
            const cb = item.querySelector('input[type="checkbox"]');
            if (cb) cb.checked = true;
        }
    });
    updateAddKeyModelCounts();
    filterAddKeyModels();
});

clearAllModelsBtn.addEventListener('click', () => {
    const items = addKeyModelsList.querySelectorAll('.model-checkbox-item');
    items.forEach(item => {
        if (item.style.display !== 'none') {
            const cb = item.querySelector('input[type="checkbox"]');
            if (cb) cb.checked = false;
        }
    });
    updateAddKeyModelCounts();
    filterAddKeyModels();
});

// Filter models checklist on text input (Add Key)
addKeyModelFilter.addEventListener('input', filterAddKeyModels);
addKeyShowSelectedOnly.addEventListener('change', filterAddKeyModels);

function getModelBadgesHTML(m) {
    const name = m.toLowerCase();
    let badges = '';
    
    // Thinking/Reasoning
    if (name.includes('thinking') || name.includes('reasoner') || name.includes('reasoning') || name.includes('-r1') || name.startsWith('o1') || name.startsWith('o3')) {
        badges += `<span class="model-badge badge-thinking" title="Thinking / Reasoning">Thinking</span>`;
    }
    
    // Vision
    if (name.includes('vision') || name.includes('gpt-4o') || name.includes('gemini-1.5') || name.includes('gemini-2.0') || name.includes('gemini-2.5') || name.includes('claude-3') || name.includes('sonnet') || name.includes('opus')) {
        badges += `<span class="model-badge badge-vision" title="Vision / Multimodal">Vision</span>`;
    }
    
    // Embedding
    if (name.includes('embed')) {
        badges += `<span class="model-badge badge-embedding" title="Text Embedding">Embed</span>`;
    }
    
    // Image Generation
    if (name.includes('dall-e') || name.includes('imagen') || name.includes('flux')) {
        badges += `<span class="model-badge badge-image" title="Image Generation">Image</span>`;
    }
    
    // Audio / Speech
    if (name.includes('whisper') || name.includes('tts') || name.includes('audio') || name.includes('speech')) {
        badges += `<span class="model-badge badge-audio" title="Audio / Speech Recognition">Audio</span>`;
    }
    
    if (badges) {
        return `<div class="model-badges-row">${badges}</div>`;
    }
    return '';
}

// Render models checklist for Add Key
function renderAddKeyModelsList(models, checkAll = true) {
    addKeyModelsList.innerHTML = '';
    if (models.length === 0) {
        addKeyModelsList.innerHTML = '<div style="grid-column: span 3; color: var(--text-muted); font-style: italic;">No models available.</div>';
        return;
    }
    models.forEach(m => {
        const div = document.createElement('div');
        div.className = 'model-checkbox-item';
        
        // Wrap click to target checkbox
        div.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const cb = div.querySelector('input');
                cb.checked = !cb.checked;
            }
            updateAddKeyModelCounts();
            filterAddKeyModels();
        });

        const badgesHTML = getModelBadgesHTML(m);
        div.innerHTML = `
            <input type="checkbox" value="${m}" ${checkAll ? 'checked' : ''} style="cursor: pointer; flex-shrink: 0;">
            <div style="display: flex; flex-direction: column; gap: 0.15rem; flex: 1; min-width: 0;">
                <span style="font-size: 0.85rem; font-family: 'JetBrains Mono', monospace; word-break: break-all; line-height: 1.25;">${m}</span>
                ${badgesHTML}
            </div>
        `;
        addKeyModelsList.appendChild(div);
    });
    addKeyShowSelectedOnly.checked = false;
    addKeyModelFilter.value = '';
    updateAddKeyModelCounts();
}

// Add Key Form Submit (Complete submission)
addKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = document.getElementById('keyLabel').value.trim();
    const key = document.getElementById('keySecret').value.trim();
    const upstream_url = document.getElementById('keyURL').value.trim();
    const supports_openai = supportOpenAI.checked;
    const supports_gemini = supportGemini.checked;
    const supports_claude = supportClaude.checked;

    // Collect selected models
    const selected_models = [];
    const checkedBoxes = addKeyModelsList.querySelectorAll('input[type="checkbox"]:checked');
    checkedBoxes.forEach(cb => selected_models.push(cb.value));

    if (selected_models.length === 0) {
        showToast('Please select at least one model to expose', 'error');
        return;
    }

    saveNewKeyBtn.disabled = true;
    const originalHTML = saveNewKeyBtn.innerHTML;
    const svgEl = saveNewKeyBtn.querySelector('svg');
    const svgHtml = svgEl ? svgEl.outerHTML : '';
    saveNewKeyBtn.innerHTML = `${svgHtml} <span>${t('adminSaving') || 'Saving...'}</span>`;

    try {
        const res = await apiFetch('/admin/api/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                label,
                key,
                upstream_url,
                supports_openai,
                supports_gemini,
                supports_claude,
                available_models: addKeyFetchedModels,
                selected_models
            })
        });

        if (res.ok) {
            document.getElementById('keyLabel').value = '';
            document.getElementById('keySecret').value = '';
            document.getElementById('keyURL').value = '';
            apiSupportContainer.style.display = 'none';
            addKeyModelsContainer.style.display = 'none';
            addKeyFetchedModels = [];
            
            loadData();
            showToast('Upstream key added successfully', 'success');
        } else {
            const data = await res.json();
            showToast('Failed to add key: ' + (data.error || res.statusText), 'error');
        }
    } catch (err) {
        showToast('Network error saving key: ' + err.message, 'error');
    } finally {
        saveNewKeyBtn.disabled = false;
        saveNewKeyBtn.innerHTML = originalHTML;
    }
});

// Add Client Key Handler
addClientKeyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = document.getElementById('clientKeyLabel').value.trim();

    const res = await apiFetch('/admin/api/client-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label })
    });

    if (res.ok) {
        const data = await res.json();
        document.getElementById('clientKeyLabel').value = '';
        showKeyGenModal(data.key);
        loadClientKeys();
        showToast('Client API key generated', 'success');
    } else {
        const data = await res.json();
        showToast('Failed to generate client key: ' + (data.error || res.statusText), 'error');
    }
});

// Settings Save Handler
settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fallback_key = document.getElementById('settingsFallbackKey').value.trim();
    const fallback_upstream_url = document.getElementById('settingsFallbackURL').value.trim();
    const fallback_model = document.getElementById('settingsFallbackModel').value.trim();
    const fallback_api_type = document.getElementById('settingsFallbackAPIType').value;
    const max_request_size_kb = document.getElementById('settingsMaxRequestSize').value.trim();
    const guest_api_key = document.getElementById('settingsGuestKey').value.trim();
    const guest_model = document.getElementById('settingsGuestModel').value.trim();
    const enable_guest_key = document.getElementById('settingsEnableGuestKey').checked ? '1' : '0';

    const submitBtn = settingsForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalHTML = submitBtn.innerHTML;
    const svgEl = submitBtn.querySelector('svg');
    const svgHtml = svgEl ? svgEl.outerHTML : '';
    submitBtn.innerHTML = `${svgHtml} <span>${t('adminSaving') || 'Saving...'}</span>`;

    try {
        const res = await apiFetch('/admin/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fallback_key,
                fallback_upstream_url,
                fallback_model,
                fallback_api_type,
                max_request_size_kb,
                guest_api_key,
                guest_model,
                enable_guest_key
            })
        });

        if (res.ok) {
            showToast('Settings saved successfully', 'success');
        } else {
            const data = await res.json();
            showToast('Failed to save settings: ' + (data.error || res.statusText), 'error');
        }
    } catch (err) {
        showToast('Error saving settings: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
    }
});

// Settings Fetch Models Handler
settingsFetchModelsBtn.addEventListener('click', async () => {
    const key = document.getElementById('settingsFallbackKey').value.trim();
    const upstream_url = document.getElementById('settingsFallbackURL').value.trim();

    if (!key || !upstream_url) {
        showToast('API Key and Upstream URL are required to fetch models', 'error');
        return;
    }

    settingsFetchModelsBtn.disabled = true;
    const originalHTML = settingsFetchModelsBtn.innerHTML;
    const svgEl = settingsFetchModelsBtn.querySelector('svg');
    const svgHtml = svgEl ? svgEl.outerHTML : '';
    settingsFetchModelsBtn.innerHTML = `${svgHtml} <span>${t('adminFetching') || 'Fetching...'}</span>`;

    showToast('Fetching models for fallback upstream...', 'info');

    try {
        const apiType = document.getElementById('settingsFallbackAPIType').value;
        const payload = { key, upstream_url };
        if (apiType === 'openai') {
            payload.supports_openai = true;
            payload.supports_gemini = false;
            payload.supports_claude = false;
        } else if (apiType === 'gemini') {
            payload.supports_openai = false;
            payload.supports_gemini = true;
            payload.supports_claude = false;
        }

        const res = await apiFetch('/admin/api/keys/fetch-models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
            // Auto detect fallback API type
            if (data.supports_gemini && !data.supports_openai) {
                document.getElementById('settingsFallbackAPIType').value = 'gemini';
            } else if (data.supports_openai && !data.supports_gemini) {
                document.getElementById('settingsFallbackAPIType').value = 'openai';
            }

            // Populate select dropdown
            fallbackModelsList.replaceChildren();
            const models = data.models || [];
            
            if (models.length > 0) {
                const currentVal = document.getElementById('settingsFallbackModel').value.trim();
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.textContent = m;
                    if (m === currentVal) {
                        opt.selected = true;
                    }
                    fallbackModelsList.appendChild(opt);
                });
                
                // Update select with the first model if the previous value was not in the new list (or was empty)
                if (!fallbackModelsList.value && models.length > 0) {
                    fallbackModelsList.value = models[0];
                }
                
                showToast(`Loaded ${models.length} fallback models!`, 'success');
            } else {
                showToast('No models returned by this upstream', 'warning');
            }
        } else {
            showToast('Failed to fetch models: ' + (data.error || 'Connection failed'), 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    } finally {
        settingsFetchModelsBtn.disabled = false;
        settingsFetchModelsBtn.innerHTML = originalHTML;
    }
});

// Settings Gen Guest Key Handler
const settingsGenGuestKeyBtn = document.getElementById('settingsGenGuestKeyBtn');
if (settingsGenGuestKeyBtn) {
    settingsGenGuestKeyBtn.addEventListener('click', () => {
        const chars = 'abcdef0123456789';
        let randStr = '';
        for (let i = 0; i < 32; i++) {
            randStr += chars[Math.floor(Math.random() * chars.length)];
        }
        document.getElementById('settingsGuestKey').value = 'dc_guest_' + randStr;
    });
}

// Load Settings from API
async function loadSettings() {
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) settingsForm.classList.add('settings-loading');
    try {
        const res = await apiFetch('/admin/api/settings');
        if (res.ok) {
            const data = await res.json();
            document.getElementById('settingsFallbackKey').value = data.fallback_key || '';
            document.getElementById('settingsFallbackURL').value = data.fallback_upstream_url || '';
            document.getElementById('settingsFallbackAPIType').value = data.fallback_api_type || 'gemini';
            document.getElementById('settingsMaxRequestSize').value = data.max_request_size_kb || '0';
            document.getElementById('settingsGuestKey').value = data.guest_api_key || '';
            document.getElementById('settingsEnableGuestKey').checked = data.enable_guest_key !== '0';
            
            // Pre-populate dropdown with the current fallback model
            fallbackModelsList.replaceChildren();
            if (data.fallback_model) {
                const opt = document.createElement('option');
                opt.value = data.fallback_model;
                opt.textContent = data.fallback_model;
                opt.selected = true;
                fallbackModelsList.appendChild(opt);
            } else {
                const opt = document.createElement('option');
                opt.value = '';
                opt.textContent = 'Select fallback model...';
                opt.disabled = true;
                opt.selected = true;
                fallbackModelsList.appendChild(opt);
            }

            // Populate guest model select options from active keys
            if (guestModelsList) {
                guestModelsList.replaceChildren();
                
                const placeholderOpt = document.createElement('option');
                placeholderOpt.value = '';
                placeholderOpt.textContent = 'Select guest model...';
                placeholderOpt.disabled = true;
                placeholderOpt.selected = !data.guest_model;
                guestModelsList.appendChild(placeholderOpt);

                try {
                    const keysRes = await apiFetch('/admin/api/keys');
                    if (keysRes.ok) {
                        const keysData = await keysRes.json();
                        const uniqueModels = new Set();
                        keysData.forEach(k => {
                            if (k.status === 'active' && k.selected_models) {
                                try {
                                    const models = JSON.parse(k.selected_models);
                                    models.forEach(m => {
                                        if (m) uniqueModels.add(m);
                                    });
                                } catch (e) {}
                            }
                        });
                        if (data.fallback_model) {
                            uniqueModels.add(data.fallback_model);
                        }
                        Array.from(uniqueModels).sort().forEach(m => {
                            const opt = document.createElement('option');
                            opt.value = m;
                            opt.textContent = m;
                            if (m === data.guest_model) {
                                opt.selected = true;
                            }
                            guestModelsList.appendChild(opt);
                        });
                    }
                } catch (err) {
                    console.error("Error loading guest models list:", err);
                }
            }
        } else {
            showToast('Failed to load settings', 'error');
        }
    } catch (err) {
        console.error("Error loading settings:", err);
    } finally {
        if (settingsForm) settingsForm.classList.remove('settings-loading');
    }
}

// Generic fetch wrapper with headers
async function apiFetch(url, options = {}) {
    if (!options.headers) options.headers = {};
    const token = adminToken;
    if (token) {
        options.headers['Authorization'] = 'Bearer ' + token;
        options.headers['x-admin-token'] = token;
    }
    return fetch(url, options);
}

// Fetch Stats & Keys
async function loadData() {
    try {
        // Fetch stats
        const statsRes = await apiFetch('/admin/api/stats');
        if (statsRes.ok) {
            stats = await statsRes.json();
            updateStatsUI();
        } else if (statsRes.status === 401) {
            if (pollerId) {
                clearInterval(pollerId);
                pollerId = null;
            }
            localStorage.removeItem('admin_token');
            adminToken = '';
            showLoginOverlay();
            showToast('Session expired. Please log in again.', 'error');
            return;
        }

        if (activeTab === 'upstream') {
            // Fetch keys
            const keysRes = await apiFetch('/admin/api/keys');
            if (keysRes.ok) {
                keys = await keysRes.json();
                applyUpstreamKeyFilter();
            }
        } else if (activeTab === 'client') {
            loadClientKeys();
        } else if (activeTab === 'errorLogs') {
            loadErrorLogs();
        } else if (activeTab === 'users') {
            loadUsers();
        }
    } catch (err) {
        console.error("Error loading data:", err);
    }
}

async function loadClientKeys() {
    try {
        const keysRes = await apiFetch('/admin/api/client-keys');
        if (keysRes.ok) {
            clientKeys = await keysRes.json();
            renderClientKeysTable();
        } else if (keysRes.status === 401) {
            if (pollerId) {
                clearInterval(pollerId);
                pollerId = null;
            }
            localStorage.removeItem('admin_token');
            adminToken = '';
            showLoginOverlay();
            showToast('Session expired', 'error');
        }
    } catch (err) {
        console.error("Error loading client keys:", err);
    }
}

async function loadErrorLogs() {
    try {
        const logsRes = await apiFetch('/admin/api/error-logs');
        if (logsRes.ok) {
            errorLogs = await logsRes.json();
            applyErrorLogFilter();
        } else if (logsRes.status === 401) {
            if (pollerId) {
                clearInterval(pollerId);
                pollerId = null;
            }
            localStorage.removeItem('admin_token');
            adminToken = '';
            showLoginOverlay();
            showToast('Session expired', 'error');
        }
    } catch (err) {
        console.error("Error loading error logs:", err);
    }
}

function renderErrorLogsTable(logs) {
    errorLogsTableBody.replaceChildren();
    errorLogsCardsMobile.replaceChildren();

    if (logs.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.setAttribute('colspan', '5');
        td.className = 'no-data';
        td.textContent = t('adminNoLogs') || 'No upstream errors recorded.';
        tr.appendChild(td);
        errorLogsTableBody.appendChild(tr);

        const div = document.createElement('div');
        div.className = 'no-data';
        div.textContent = t('adminNoLogs') || 'No upstream errors recorded.';
        errorLogsCardsMobile.appendChild(div);
        return;
    }

    const parser = new DOMParser();
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;

    logs.forEach(log => {
        let formattedTime = log.timestamp;
        try {
            const date = new Date(log.timestamp);
            if (!isNaN(date)) {
                formattedTime = date.toLocaleString();
            }
        } catch (e) {}

        const tr = document.createElement('tr');

        const tdTime = document.createElement('td');
        tdTime.textContent = formattedTime;
        tr.appendChild(tdTime);

        const tdKey = document.createElement('td');
        const strongLabel = document.createElement('strong');
        strongLabel.style.display = 'block';
        strongLabel.textContent = log.key_label;
        tdKey.appendChild(strongLabel);

        const spanId = document.createElement('span');
        spanId.style.fontSize = '0.75rem';
        spanId.style.color = 'var(--text-muted)';
        spanId.textContent = 'ID: ' + log.key_id;
        tdKey.appendChild(spanId);
        tr.appendChild(tdKey);

        const tdStatus = document.createElement('td');
        const badge = document.createElement('span');
        badge.className = 'badge';
        if (log.status_code === 401 || log.status_code === 403) {
            badge.classList.add('badge-failed');
        } else if (log.status_code === 429) {
            badge.classList.add('badge-cooldown');
        } else {
            badge.classList.add('badge-disabled');
        }
        badge.textContent = log.status_code || 'Err';
        tdStatus.appendChild(badge);
        tr.appendChild(tdStatus);

        const tdMsg = document.createElement('td');
        const preMsg = document.createElement('pre');
        preMsg.style.fontFamily = "'JetBrains Mono', monospace";
        preMsg.style.fontSize = '0.75rem';
        preMsg.style.margin = '0';
        preMsg.style.whiteSpace = 'pre-wrap';
        preMsg.style.wordBreak = 'break-all';
        preMsg.textContent = log.error_message;
        tdMsg.appendChild(preMsg);
        tr.appendChild(tdMsg);

        const tdActions = document.createElement('td');
        const btnDel = document.createElement('button');
        btnDel.className = 'btn btn-danger btn-sm';
        btnDel.style.padding = '4px 8px';
        btnDel.style.height = '28px';
        btnDel.title = t('adminBtnDelete') || 'Delete';
        const docDesktop = parser.parseFromString(svgString, 'image/svg+xml');
        btnDel.appendChild(docDesktop.documentElement);
        btnDel.addEventListener('click', () => deleteErrorLog(log.id));
        tdActions.appendChild(btnDel);
        tr.appendChild(tdActions);

        errorLogsTableBody.appendChild(tr);

        const card = document.createElement('div');
        card.className = 'mobile-card';

        const cardHeader = document.createElement('div');
        cardHeader.className = 'mobile-card-header';

        const cardHeaderLeft = document.createElement('div');
        const mTitle = document.createElement('div');
        mTitle.className = 'mobile-card-title';
        mTitle.textContent = log.key_label;
        cardHeaderLeft.appendChild(mTitle);

        const mSubtitle = document.createElement('div');
        mSubtitle.style.fontSize = '0.75rem';
        mSubtitle.style.color = 'var(--text-muted)';
        mSubtitle.textContent = 'ID: ' + log.key_id;
        cardHeaderLeft.appendChild(mSubtitle);
        cardHeader.appendChild(cardHeaderLeft);

        const cardHeaderRight = document.createElement('div');
        cardHeaderRight.style.display = 'flex';
        cardHeaderRight.style.alignItems = 'center';
        cardHeaderRight.style.gap = '8px';

        const mBadge = badge.cloneNode(true);
        cardHeaderRight.appendChild(mBadge);

        const mBtnDel = document.createElement('button');
        mBtnDel.className = 'btn btn-danger btn-sm';
        mBtnDel.style.padding = '4px 8px';
        mBtnDel.style.height = '28px';
        mBtnDel.title = t('adminBtnDelete') || 'Delete';
        const docMobile = parser.parseFromString(svgString, 'image/svg+xml');
        mBtnDel.appendChild(docMobile.documentElement);
        mBtnDel.addEventListener('click', () => deleteErrorLog(log.id));
        cardHeaderRight.appendChild(mBtnDel);

        cardHeader.appendChild(cardHeaderRight);
        card.appendChild(cardHeader);

        const cardBody = document.createElement('div');
        cardBody.className = 'mobile-card-body';
        cardBody.style.gap = '8px';

        const cardTime = document.createElement('div');
        cardTime.style.fontSize = '0.75rem';
        cardTime.style.color = 'var(--text-secondary)';
        cardTime.textContent = formattedTime;
        cardBody.appendChild(cardTime);

        const cardMsg = document.createElement('pre');
        cardMsg.style.fontFamily = "'JetBrains Mono', monospace";
        cardMsg.style.fontSize = '0.75rem';
        cardMsg.style.margin = '0';
        cardMsg.style.whiteSpace = 'pre-wrap';
        cardMsg.style.wordBreak = 'break-all';
        cardMsg.style.background = 'rgba(0,0,0,0.2)';
        cardMsg.style.padding = '8px';
        cardMsg.style.borderRadius = '4px';
        cardMsg.style.border = '1px solid var(--border-color)';
        cardMsg.textContent = log.error_message;
        cardBody.appendChild(cardMsg);

        card.appendChild(cardBody);
        errorLogsCardsMobile.appendChild(card);
    });
}

function applyErrorLogFilter() {
    const q = document.getElementById('errorLogFilter') ? document.getElementById('errorLogFilter').value.toLowerCase().trim() : '';
    if (!q) {
        renderErrorLogsTable(errorLogs);
        return;
    }
    const filtered = errorLogs.filter(log => {
        return (log.key_label && log.key_label.toLowerCase().includes(q)) ||
               (log.key_id && log.key_id.toLowerCase().includes(q)) ||
               (log.error_message && log.error_message.toLowerCase().includes(q)) ||
               (log.status_code && String(log.status_code).includes(q)) ||
               (log.timestamp && log.timestamp.toLowerCase().includes(q));
    });
    renderErrorLogsTable(filtered);
}

async function clearAllErrorLogs() {
    if (!confirm('Are you sure you want to clear all error logs from the database?')) {
        return;
    }
    try {
        const res = await apiFetch('/admin/api/error-logs', { method: 'DELETE' });
        if (res.ok) {
            showToast('All error logs cleared', 'success');
            errorLogs = [];
            applyErrorLogFilter();
        } else {
            const data = await res.json();
            showToast('Failed to clear logs: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (err) {
        showToast('Network error clearing logs: ' + err.message, 'error');
    }
}

async function deleteErrorLog(id) {
    if (!confirm('Are you sure you want to delete this log entry?')) {
        return;
    }
    try {
        const res = await apiFetch(`/admin/api/error-logs/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('Log entry deleted', 'success');
            errorLogs = errorLogs.filter(log => log.id !== id);
            applyErrorLogFilter();
        } else {
            const data = await res.json();
            showToast('Failed to delete log: ' + (data.error || 'Unknown error'), 'error');
        }
    } catch (err) {
        showToast('Network error deleting log: ' + err.message, 'error');
    }
}

function renderErrorLogsSkeleton() {
    errorLogsTableBody.replaceChildren();
    errorLogsCardsMobile.replaceChildren();

    for (let i = 0; i < 2; i++) {
        const tr = document.createElement('tr');
        for (let j = 0; j < 4; j++) {
            const td = document.createElement('td');
            const loader = document.createElement('div');
            loader.className = 'skeleton-loader';
            if (j === 0) {
                loader.classList.add('skeleton-text-md');
            } else if (j === 1 || j === 3) {
                loader.classList.add('skeleton-text-lg');
                if (j === 3) loader.style.width = '80%';
            } else if (j === 2) {
                loader.classList.add('skeleton-badge');
            }
            td.appendChild(loader);
            tr.appendChild(td);
        }
        errorLogsTableBody.appendChild(tr);
    }

    const card = document.createElement('div');
    card.className = 'mobile-card skeleton-card';

    const header = document.createElement('div');
    header.className = 'mobile-card-header';
    header.style.borderBottom = 'none';

    const left = document.createElement('div');
    left.style.width = '60%';
    const loaderL1 = document.createElement('div');
    loaderL1.className = 'skeleton-loader skeleton-text-lg';
    loaderL1.style.width = '80%';
    left.appendChild(loaderL1);

    const loaderL2 = document.createElement('div');
    loaderL2.className = 'skeleton-loader skeleton-text-sm';
    loaderL2.style.width = '40%';
    loaderL2.style.marginTop = '6px';
    left.appendChild(loaderL2);
    header.appendChild(left);

    const badgeLoader = document.createElement('div');
    badgeLoader.className = 'skeleton-loader skeleton-badge';
    header.appendChild(badgeLoader);
    card.appendChild(header);

    const body = document.createElement('div');
    body.className = 'mobile-card-body';
    body.style.gap = '12px';
    body.style.marginTop = '10px';

    const bodyLoader = document.createElement('div');
    bodyLoader.className = 'skeleton-loader skeleton-text-md';
    bodyLoader.style.width = '100%';
    body.appendChild(bodyLoader);

    card.appendChild(body);
    errorLogsCardsMobile.appendChild(card);
}

function updateStatsUI() {
    document.getElementById('statTotalKeys').innerText = stats.total_keys || 0;
    document.getElementById('statActiveKeys').innerText = stats.active_keys || 0;
    document.getElementById('statSuccessRate').innerText = (stats.success_rate ? stats.success_rate.toFixed(1) : 0) + '%';
    document.getElementById('statActiveClientKeys').innerText = stats.active_client_keys || 0;

    // Upstream Token Stats
    document.getElementById('statTotalTokens').innerText = formatTokens(stats.total_tokens || 0);
    document.getElementById('statTokenDetails').innerHTML = `${t('adminPromptAbbr')}: ${stats.prompt_tokens ? stats.prompt_tokens.toLocaleString() : 0} • ${t('adminCompletionAbbr')}: ${stats.completion_tokens ? stats.completion_tokens.toLocaleString() : 0}`;

    // Fallback stats
    document.getElementById('statFallbackTotalRequests').innerText = stats.gcli_total_requests || 0;
    document.getElementById('statFallbackSuccessCount').innerText = stats.gcli_success_count || 0;
    document.getElementById('statFallbackFailureCount').innerText = stats.gcli_failure_count || 0;
    document.getElementById('statFallbackSuccessRate').innerText = (stats.gcli_success_rate ? stats.gcli_success_rate.toFixed(1) : 0) + '%';

    // Fallback Token Stats
    document.getElementById('statFallbackTotalTokens').innerText = formatTokens(stats.gcli_total_tokens || 0);
    document.getElementById('statFallbackTokenDetails').innerHTML = `${t('adminPromptAbbr')}: ${stats.gcli_prompt_tokens ? stats.gcli_prompt_tokens.toLocaleString() : 0} • ${t('adminCompletionAbbr')}: ${stats.gcli_completion_tokens ? stats.gcli_completion_tokens.toLocaleString() : 0}`;
}

function showLoginOverlay() {
    window.location.href = 'login.html';
}

function hideLoginOverlay() {
    document.body.style.opacity = '1';
    if (authRequired) {
        logoutBtn.style.display = 'inline-flex';
    } else {
        logoutBtn.style.display = 'none';
    }
}

function renderKeysSkeleton() {
    keysTableBody.innerHTML = `
        <tr>
            <td><div class="skeleton-loader skeleton-text-lg"></div><div class="skeleton-loader skeleton-text-sm" style="display:block; margin-top:6px;"></div></td>
            <td><div class="skeleton-loader skeleton-text-lg"></div><div class="skeleton-loader skeleton-text-md" style="display:block; margin-top:6px;"></div></td>
            <td><div class="skeleton-loader skeleton-badge"></div></td>
            <td><div class="skeleton-loader skeleton-text-sm"></div></td>
            <td><div class="skeleton-loader skeleton-text-md"></div></td>
            <td><div class="skeleton-loader skeleton-text-lg" style="width: 100px;"></div></td>
        </tr>
        <tr>
            <td><div class="skeleton-loader skeleton-text-lg"></div><div class="skeleton-loader skeleton-text-sm" style="display:block; margin-top:6px;"></div></td>
            <td><div class="skeleton-loader skeleton-text-lg"></div><div class="skeleton-loader skeleton-text-md" style="display:block; margin-top:6px;"></div></td>
            <td><div class="skeleton-loader skeleton-badge"></div></td>
            <td><div class="skeleton-loader skeleton-text-sm"></div></td>
            <td><div class="skeleton-loader skeleton-text-md"></div></td>
            <td><div class="skeleton-loader skeleton-text-lg" style="width: 100px;"></div></td>
        </tr>
    `;
    const mobileHtml = `
        <div class="mobile-card skeleton-card">
            <div class="mobile-card-header" style="border-bottom: none;">
                <div style="width: 60%;"><div class="skeleton-loader skeleton-text-lg" style="width: 80%;"></div><div class="skeleton-loader skeleton-text-sm" style="width: 40%; margin-top: 6px;"></div></div>
                <div class="skeleton-loader skeleton-badge"></div>
            </div>
            <div class="mobile-card-body" style="gap: 12px; margin-top: 10px;">
                <div class="skeleton-loader skeleton-text-md" style="width: 100%;"></div>
                <div class="skeleton-loader skeleton-text-md" style="width: 90%;"></div>
                <div class="skeleton-loader skeleton-text-md" style="width: 80%;"></div>
            </div>
        </div>
    `;
    document.getElementById('keysCardsMobile').innerHTML = mobileHtml + mobileHtml;
}

function renderClientKeysSkeleton() {
    clientKeysTableBody.innerHTML = `
        <tr>
            <td><div class="skeleton-loader skeleton-text-lg"></div></td>
            <td><div class="skeleton-loader skeleton-text-lg"></div></td>
            <td><div class="skeleton-loader skeleton-badge"></div></td>
            <td><div class="skeleton-loader skeleton-text-sm"></div></td>
            <td><div class="skeleton-loader skeleton-text-md"></div></td>
            <td><div class="skeleton-loader skeleton-text-lg" style="width: 100px;"></div></td>
        </tr>
        <tr>
            <td><div class="skeleton-loader skeleton-text-lg"></div></td>
            <td><div class="skeleton-loader skeleton-text-lg"></div></td>
            <td><div class="skeleton-loader skeleton-badge"></div></td>
            <td><div class="skeleton-loader skeleton-text-sm"></div></td>
            <td><div class="skeleton-loader skeleton-text-md"></div></td>
            <td><div class="skeleton-loader skeleton-text-lg" style="width: 100px;"></div></td>
        </tr>
    `;
    const mobileHtml = `
        <div class="mobile-card skeleton-card">
            <div class="mobile-card-header" style="border-bottom: none;">
                <div style="width: 60%;"><div class="skeleton-loader skeleton-text-lg" style="width: 80%;"></div><div class="skeleton-loader skeleton-text-sm" style="width: 40%; margin-top: 6px;"></div></div>
                <div class="skeleton-loader skeleton-badge"></div>
            </div>
            <div class="mobile-card-body" style="gap: 12px; margin-top: 10px;">
                <div class="skeleton-loader skeleton-text-md" style="width: 100%;"></div>
                <div class="skeleton-loader skeleton-text-md" style="width: 90%;"></div>
                <div class="skeleton-loader skeleton-text-md" style="width: 80%;"></div>
            </div>
        </div>
    `;
    document.getElementById('clientKeysCardsMobile').innerHTML = mobileHtml + mobileHtml;
}

function renderKeysTable(keysList) {
    if (keysList.length === 0) {
        const noKeysMsg = keys.length === 0 ? t('adminNoKeysAdded') : t('adminNoKeysFound');
        keysTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">${noKeysMsg}</td>
            </tr>
        `;
        document.getElementById('keysCardsMobile').innerHTML = `
            <div class="no-data">${noKeysMsg}</div>
        `;
        return;
    }

    keysTableBody.innerHTML = '';
    const mobileCardsContainer = document.getElementById('keysCardsMobile');
    mobileCardsContainer.innerHTML = '';

    keysList.forEach(k => {
        const total = k.total_requests || 0;
        const success = k.success_count || 0;
        const fail = k.failure_count || 0;
        const totalCompleted = success + fail;
        const rate = totalCompleted > 0 ? ((success / totalCompleted) * 100).toFixed(0) + '%' : '-';

        let cooldownText = '';
        if (k.status === 'cooldown' && k.cooldown_until) {
            const diff = new Date(k.cooldown_until) - new Date();
            if (diff > 0) {
                cooldownText = `<div style="font-size: 0.75rem; opacity: 0.7;">${t('adminCooldownText', { seconds: Math.round(diff/1000) })}</div>`;
            }
        }

        const errorDisplay = k.error_reason ? `<div class="error-msg" title="${escapeHtml(k.error_reason)}">${escapeHtml(k.error_reason)}</div>` : '';

        // API Format Support Badges
        let formatBadges = '';
        if (k.supports_openai) {
            formatBadges += `<span class="badge badge-active" style="font-size: 0.65rem; padding: 2px 4px; margin-top: 4px; margin-right: 4px;">OpenAI</span>`;
        }
        if (k.supports_gemini) {
            formatBadges += `<span class="badge badge-active" style="background: rgba(139, 92, 246, 0.12); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.2); font-size: 0.65rem; padding: 2px 4px; margin-top: 4px; margin-right: 4px;">Gemini</span>`;
        }
        if (k.supports_claude) {
            formatBadges += `<span class="badge badge-active" style="background: rgba(236, 72, 153, 0.12); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.2); font-size: 0.65rem; padding: 2px 4px; margin-top: 4px;">Claude</span>`;
        }

        // Count exposed models
        let selectedCount = 0;
        try {
            const parsed = JSON.parse(k.selected_models || '[]');
            selectedCount = parsed.length;
        } catch(e) {}

        const modelsSummary = `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${t('adminExposedModelsCount', { count: selectedCount })}</div>`;

        // 1. Render Desktop Table Row
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong style="display: block;">${escapeHtml(k.label)}</strong>
                <div style="display: flex; flex-wrap: wrap;">${formatBadges}</div>
                ${modelsSummary}
                ${errorDisplay}
            </td>
            <td>
                <div class="key-text-container">
                    <span class="key-masked" id="key-val-${k.id}">${k.key_masked}</span>
                    <button class="copy-btn" onclick="copyTextToClipboard('${k.key}')" title="Copy Key"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); word-break: break-all; margin-top: 4px; max-width: 250px;">
                    ${escapeHtml(k.upstream_url)}
                </div>
            <td>
                <span class="badge badge-${k.status}">${k.status}</span>
                ${cooldownText}
                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;" title="${t('adminLatencyTooltip')}">
                    Avg: ${k.avg_latency_ms || 0}ms<br/>Last: ${k.last_latency_ms || 0}ms
                </div>
            </td>
            <td>
                ${k.total_requests}
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;" title="${t('adminPromptAbbr')}: ${k.prompt_tokens || 0} | ${t('adminCompletionAbbr')}: ${k.completion_tokens || 0}">
                    ${formatTokens(k.prompt_tokens + k.completion_tokens)}
                </div>
            </td>
            <td>
                <span style="color: var(--color-active);">${success}</span> / 
                <span style="color: var(--color-failed);">${fail}</span>
                <div style="font-size: 0.75rem; color: var(--text-secondary)">Success: ${rate}</div>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="btn btn-secondary btn-sm" onclick="openEditModal('${k.id}')" title="${t('adminBtnEdit')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                    <button class="btn btn-secondary btn-sm" onclick="duplicateKeyConfig('${k.id}')" title="${t('adminBtnDuplicate')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                    <button class="btn btn-secondary btn-sm" onclick="testKey('${k.id}', this)" title="${t('adminBtnTest')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></button>
                    <button class="btn btn-secondary btn-sm" onclick="toggleKeyStatus('${k.id}', '${k.status}')" title="${k.status === 'disabled' ? t('adminBtnEnable') : t('adminBtnDisable')}">${k.status === 'disabled' ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'}</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteKey('${k.id}')" title="${t('adminBtnDelete')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                </div>
            </td>
        `;
        keysTableBody.appendChild(tr);

        // 2. Render Mobile Card
        const card = document.createElement('div');
        card.className = 'mobile-card';
        card.innerHTML = `
            <div class="mobile-card-header">
                <div>
                    <span class="mobile-card-title">${escapeHtml(k.label)}</span>
                    <div style="display: flex; flex-wrap: wrap; margin-top: 4px;">${formatBadges}</div>
                    ${modelsSummary}
                </div>
                <div>
                    <span class="badge badge-${k.status}">${k.status}</span>
                    ${cooldownText ? `<div style="text-align: right; margin-top: 2px;">${cooldownText}</div>` : ''}
                </div>
            </div>
            <div class="mobile-card-body">
                <div class="mobile-card-row">
                    <span class="mobile-card-label">${t('dashTableKey')}</span>
                    <div class="key-text-container">
                        <span class="key-masked" id="key-val-${k.id}-mobile">${k.key_masked}</span>
                        <button class="copy-btn" onclick="copyTextToClipboard('${k.key}')" title="Copy Key"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                    </div>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">${t('adminAddKeyURL')}</span>
                    <span class="mobile-card-value" style="font-size: 0.8rem; word-break: break-all;">${escapeHtml(k.upstream_url)}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">${t('dashRequests')}</span>
                    <span class="mobile-card-value">${k.total_requests} <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.25rem;">(${formatTokens(k.prompt_tokens + k.completion_tokens)})</span></span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">${t('adminFallbackSuccessFail')}</span>
                    <span class="mobile-card-value">
                        <span style="color: var(--color-active);">${success}</span> / 
                        <span style="color: var(--color-failed);">${fail}</span>
                        <span style="color: var(--text-secondary); margin-left: 0.5rem;">(${rate})</span>
                    </span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">${t('adminTableLatency')}</span>
                    <span class="mobile-card-value">Avg: ${k.avg_latency_ms || 0}ms | Last: ${k.last_latency_ms || 0}ms</span>
                </div>
                ${k.error_reason ? `
                <div class="mobile-card-row" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                    <span class="mobile-card-label">${t('adminTableErrorReason')}</span>
                    <span style="color: var(--color-failed); font-size: 0.8rem; word-break: break-all;">${escapeHtml(k.error_reason)}</span>
                </div>
                ` : ''}
            </div>
            <div class="mobile-card-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditModal('${k.id}')" title="${t('adminBtnEdit')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> <span>${t('adminBtnEdit')}</span></button>
                <button class="btn btn-secondary btn-sm" onclick="duplicateKeyConfig('${k.id}')" title="${t('adminBtnDuplicate')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>${t('adminBtnDuplicate')}</span></button>
                <button class="btn btn-secondary btn-sm" onclick="testKey('${k.id}', this)" title="${t('adminBtnTest')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>${t('adminBtnTest')}</span></button>
                <button class="btn btn-secondary btn-sm" onclick="toggleKeyStatus('${k.id}', '${k.status}')" title="${k.status === 'disabled' ? t('adminBtnEnable') : t('adminBtnDisable')}">${k.status === 'disabled' ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'} <span>${k.status === 'disabled' ? t('adminBtnEnable') : t('adminBtnDisable')}</span></button>
                <button class="btn btn-danger btn-sm" onclick="deleteKey('${k.id}')" title="${t('adminBtnDelete')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> <span>${t('adminBtnDelete')}</span></button>
            </div>
        `;
        mobileCardsContainer.appendChild(card);
    });
}

function applyUpstreamKeyFilter() {
    const q = document.getElementById('upstreamKeyFilter') ? document.getElementById('upstreamKeyFilter').value.toLowerCase().trim() : '';
    if (!q) {
        renderKeysTable(keys);
        return;
    }
    const filtered = keys.filter(k => {
        let modelMatch = false;
        try {
            const parsed = JSON.parse(k.selected_models || '[]');
            modelMatch = parsed.some(m => m.toLowerCase().includes(q));
        } catch(e) {}

        const formats = [];
        if (k.supports_openai) formats.push("openai");
        if (k.supports_gemini) formats.push("gemini");
        if (k.supports_claude) formats.push("claude");
        const formatMatch = formats.some(f => f.includes(q));

        return (k.label && k.label.toLowerCase().includes(q)) ||
               (k.key && k.key.toLowerCase().includes(q)) ||
               (k.key_masked && k.key_masked.toLowerCase().includes(q)) ||
               (k.upstream_url && k.upstream_url.toLowerCase().includes(q)) ||
               (k.status && k.status.toLowerCase().includes(q)) ||
               formatMatch ||
               modelMatch;
    });
    renderKeysTable(filtered);
}

function duplicateKeyConfig(id) {
    const k = keys.find(item => item.id === id);
    if (!k) return;

    // Pre-populate fields
    document.getElementById('keyLabel').value = k.label + ' (Copy)';
    document.getElementById('keySecret').value = '';
    document.getElementById('keyURL').value = k.upstream_url;

    // Pre-populate support formats
    supportOpenAI.checked = k.supports_openai === 1;
    supportGemini.checked = k.supports_gemini === 1;
    supportClaude.checked = k.supports_claude === 1;
    apiSupportContainer.style.display = 'flex';

    // Parse available and selected models
    let availableList = [];
    try {
        availableList = JSON.parse(k.available_models || '[]');
    } catch(e) {}

    let selectedList = [];
    try {
        selectedList = JSON.parse(k.selected_models || '[]');
    } catch(e) {}

    // Store in global state for the Add Key form
    addKeyFetchedModels = availableList;

    // Render models checklist
    renderAddKeyModelsList(availableList, false);

    // Check the selected ones
    const checkboxes = addKeyModelsList.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        if (selectedList.includes(cb.value)) {
            cb.checked = true;
        }
    });

    // Show models container
    addKeyModelsContainer.style.display = 'block';

    // Scroll to the form
    addKeyForm.scrollIntoView({ behavior: 'smooth' });

    // Focus the secret key input
    document.getElementById('keySecret').focus();

    showToast('Upstream configuration duplicated! Please enter the new API Key.', 'success');
}



function renderClientKeysTable() {
    if (clientKeys.length === 0) {
        clientKeysTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">${t('adminNoClientKeys')}</td>
            </tr>
        `;
        document.getElementById('clientKeysCardsMobile').innerHTML = `
            <div class="no-data">${t('adminNoClientKeys')}</div>
        `;
        return;
    }

    clientKeysTableBody.innerHTML = '';
    const mobileCardsContainer = document.getElementById('clientKeysCardsMobile');
    mobileCardsContainer.innerHTML = '';

    clientKeys.forEach(k => {
        const lastUsedText = k.last_used && k.last_used !== '0001-01-01T00:00:00Z' 
            ? new Date(k.last_used).toLocaleString() 
            : t('adminNever');

        // 1. Render Desktop Table Row
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${escapeHtml(k.label)}</strong></td>
            <td>
                <div class="key-text-container">
                    <span class="key-masked" id="clientKey-val-${k.id}">${k.key_masked}</span>
                    <button class="copy-btn" onclick="copyTextToClipboard('${k.key}')" title="Copy Key"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                </div>
            </td>
            <td><span class="badge badge-${k.status === 'active' ? 'active' : 'disabled'}">${k.status}</span></td>
            <td>
                ${k.total_requests}
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;" title="${t('adminPromptAbbr')}: ${k.prompt_tokens || 0} | ${t('adminCompletionAbbr')}: ${k.completion_tokens || 0}">
                    ${formatTokens(k.prompt_tokens + k.completion_tokens)}
                </div>
            </td>
            <td><span style="font-size: 0.8rem; color: var(--text-secondary);">${lastUsedText}</span></td>
            <td>
                <div class="actions-cell">
                    <button class="btn btn-secondary btn-sm" onclick="toggleClientKeyStatus('${k.id}', '${k.status}')" title="${k.status === 'disabled' ? t('adminBtnEnable') : t('adminBtnDisable')}">${k.status === 'disabled' ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'}</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteClientKey('${k.id}')" title="${t('adminBtnDelete')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                </div>
            </td>
        `;
        clientKeysTableBody.appendChild(tr);

        // 2. Render Mobile Card
        const card = document.createElement('div');
        card.className = 'mobile-card';
        card.innerHTML = `
            <div class="mobile-card-header">
                <span class="mobile-card-title">${escapeHtml(k.label)}</span>
                <span class="badge badge-${k.status === 'active' ? 'active' : 'disabled'}">${k.status}</span>
            </div>
            <div class="mobile-card-body">
                <div class="mobile-card-row">
                    <span class="mobile-card-label">${t('dashTableKey')}</span>
                    <div class="key-text-container">
                        <span class="key-masked" id="clientKey-val-${k.id}-mobile">${k.key_masked}</span>
                        <button class="copy-btn" onclick="copyTextToClipboard('${k.key}')" title="Copy Key"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                    </div>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">${t('dashRequests')}</span>
                    <span class="mobile-card-value">${k.total_requests} <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.25rem;">(${formatTokens(k.prompt_tokens + k.completion_tokens)})</span></span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">${t('adminClientLastUsed')}</span>
                    <span class="mobile-card-value" style="font-size: 0.8rem;">${lastUsedText}</span>
                </div>
            </div>
            <div class="mobile-card-actions">
                <button class="btn btn-secondary btn-sm" onclick="toggleClientKeyStatus('${k.id}', '${k.status}')" title="${k.status === 'disabled' ? t('adminBtnEnable') : t('adminBtnDisable')}">${k.status === 'disabled' ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>'} <span>${k.status === 'disabled' ? t('adminBtnEnable') : t('adminBtnDisable')}</span></button>
                <button class="btn btn-danger btn-sm" onclick="deleteClientKey('${k.id}')" title="${t('adminBtnDelete')}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> <span>${t('adminBtnDelete')}</span></button>
            </div>
        `;
        mobileCardsContainer.appendChild(card);
    });
}

// Test Upstream Key
async function testKey(id, btn) {
    btn.disabled = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<span style="font-size: 0.75rem;">${t('adminTesting')}</span>`;
    showToast(`Triggered verification test for key ${id}`, 'info');

    try {
        const res = await apiFetch(`/admin/api/keys/${id}/test`, { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
            showToast(`Verification test for key ID ${id} succeeded!`, 'success');
        } else {
            showToast(`Verification test for key ID ${id} failed: ${data.error || 'Unknown error'}`, 'error');
        }
    } catch (err) {
        showToast(`Network failure testing key ${id}: ${err.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        loadData();
    }
}

// Toggle Upstream Key status
async function toggleKeyStatus(id, currentStatus) {
    const nextStatus = currentStatus === 'disabled' ? 'active' : 'disabled';

    const res = await apiFetch(`/admin/api/keys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
    });

    if (res.ok) {
        loadData();
        showToast(`Key status updated to ${nextStatus}`, 'success');
    } else {
        const data = await res.json();
        showToast('Failed to update status: ' + (data.error || res.statusText), 'error');
    }
}

// Delete Upstream Key
async function deleteKey(id) {
    if (!confirm('Are you sure you want to remove this API key from the rotation pool?')) {
        return;
    }

    const res = await apiFetch(`/admin/api/keys/${id}`, { method: 'DELETE' });
    if (res.ok) {
        loadData();
        showToast('Upstream key removed successfully', 'success');
    } else {
        const data = await res.json();
        showToast('Failed to delete key: ' + (data.error || res.statusText), 'error');
    }
}

// Toggle Client Key status
async function toggleClientKeyStatus(id, currentStatus) {
    const nextStatus = currentStatus === 'disabled' ? 'active' : 'disabled';

    const res = await apiFetch(`/admin/api/client-keys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
    });

    if (res.ok) {
        loadClientKeys();
        // Update stats counts
        const statsRes = await apiFetch('/admin/api/stats');
        if (statsRes.ok) {
            stats = await statsRes.json();
            updateStatsUI();
        }
        showToast(`Client key status updated to ${nextStatus}`, 'success');
    } else {
        const data = await res.json();
        showToast('Failed to update client status: ' + (data.error || res.statusText), 'error');
    }
}

// Delete Client Key
async function deleteClientKey(id) {
    if (!confirm('Are you sure you want to permanently delete this client API key? Any applications currently using this key will immediately be rejected.')) {
        return;
    }

    const res = await apiFetch(`/admin/api/client-keys/${id}`, { method: 'DELETE' });
    if (res.ok) {
        loadClientKeys();
        // Update stats counts
        const statsRes = await apiFetch('/admin/api/stats');
        if (statsRes.ok) {
            stats = await statsRes.json();
            updateStatsUI();
        }
        showToast('Client key deleted successfully', 'success');
    } else {
        const data = await res.json();
        showToast('Failed to delete client key: ' + (data.error || res.statusText), 'error');
    }
}

// Edit Upstream Key Modal handlers
function openEditModal(id) {
    const k = keys.find(item => item.id === id);
    if (!k) return;
    editingKeyId = id;
    document.getElementById('editKeyLabel').value = k.label || '';
    document.getElementById('editKeySecret').value = k.key || '';
    document.getElementById('editKeyURL').value = k.upstream_url || '';
    
    // Set supports check
    editSupportOpenAI.checked = k.supports_openai === 1;
    editSupportGemini.checked = k.supports_gemini === 1;
    editSupportClaude.checked = k.supports_claude === 1;

    try {
        editKeyAvailableModels = JSON.parse(k.available_models || '[]');
    } catch(e) {
        editKeyAvailableModels = [];
    }

    let selectedModels = [];
    try {
        selectedModels = JSON.parse(k.selected_models || '[]');
    } catch(e) {
        selectedModels = [];
    }

    renderEditKeyModelsList(editKeyAvailableModels, selectedModels);
    document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    editingKeyId = null;
    editKeyAvailableModels = [];
}

// Render models checklist for Edit Modal
function renderEditKeyModelsList(availableModels, selectedModels) {
    editKeyModelsList.innerHTML = '';
    if (availableModels.length === 0) {
        editKeyModelsList.innerHTML = '<div style="color: var(--text-muted); font-style: italic; padding: 0.5rem 0;">No models fetched yet. Click "Refetch Models" to load them.</div>';
        return;
    }
    availableModels.forEach(m => {
        const isSelected = selectedModels.includes(m);
        const div = document.createElement('div');
        div.className = 'model-checkbox-item';
        
        // Wrap click to target checkbox
        div.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const cb = div.querySelector('input');
                cb.checked = !cb.checked;
            }
            updateEditKeyModelCounts();
            filterEditKeyModels();
        });

        const badgesHTML = getModelBadgesHTML(m);
        div.innerHTML = `
            <input type="checkbox" value="${m}" ${isSelected ? 'checked' : ''} style="cursor: pointer; flex-shrink: 0;">
            <div style="display: flex; flex-direction: column; gap: 0.15rem; flex: 1; min-width: 0;">
                <span style="font-size: 0.85rem; font-family: 'JetBrains Mono', monospace; word-break: break-all; line-height: 1.25;">${m}</span>
                ${badgesHTML}
            </div>
        `;
        editKeyModelsList.appendChild(div);
    });
    editKeyShowSelectedOnly.checked = false;
    editKeyModelFilter.value = '';
    updateEditKeyModelCounts();
}

// Filter models in Edit Modal
editKeyModelFilter.addEventListener('input', filterEditKeyModels);
editKeyShowSelectedOnly.addEventListener('change', filterEditKeyModels);

// Select All / Clear models for Edit Modal
editSelectAllModelsBtn.addEventListener('click', () => {
    const items = editKeyModelsList.querySelectorAll('.model-checkbox-item');
    items.forEach(item => {
        if (item.style.display !== 'none') {
            const cb = item.querySelector('input[type="checkbox"]');
            if (cb) cb.checked = true;
        }
    });
    updateEditKeyModelCounts();
    filterEditKeyModels();
});

editClearAllModelsBtn.addEventListener('click', () => {
    const items = editKeyModelsList.querySelectorAll('.model-checkbox-item');
    items.forEach(item => {
        if (item.style.display !== 'none') {
            const cb = item.querySelector('input[type="checkbox"]');
            if (cb) cb.checked = false;
        }
    });
    updateEditKeyModelCounts();
    filterEditKeyModels();
});

// Refetch Models in Edit Modal
editRefetchModelsBtn.addEventListener('click', async () => {
    const key = document.getElementById('editKeySecret').value.trim();
    const upstream_url = document.getElementById('editKeyURL').value.trim();

    if (!key || !upstream_url) {
        showToast('API Key and Upstream URL are required to fetch models', 'error');
        return;
    }

    editRefetchModelsBtn.disabled = true;
    const originalHTML = editRefetchModelsBtn.innerHTML;
    const svgEl = editRefetchModelsBtn.querySelector('svg');
    const svgHtml = svgEl ? svgEl.outerHTML : '';
    editRefetchModelsBtn.innerHTML = `${svgHtml} <span>${t('adminFetching') || 'Fetching...'}</span>`;

    showToast('Refetching models from upstream...', 'info');

    try {
        const res = await apiFetch('/admin/api/keys/fetch-models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key,
                upstream_url,
                supports_openai: editSupportOpenAI.checked,
                supports_gemini: editSupportGemini.checked,
                supports_claude: editSupportClaude.checked
            })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            editSupportOpenAI.checked = data.supports_openai;
            editSupportGemini.checked = data.supports_gemini;
            editSupportClaude.checked = data.supports_claude;
            
            editKeyAvailableModels = data.models || [];
            
            // Check existing selected models against the newly fetched models
            const k = keys.find(item => item.id === editingKeyId);
            let selectedModels = [];
            if (k) {
                try {
                    selectedModels = JSON.parse(k.selected_models || '[]');
                } catch(e) {}
            }

            renderEditKeyModelsList(editKeyAvailableModels, selectedModels);
            showToast(`Refetched ${editKeyAvailableModels.length} models successfully!`, 'success');
        } else {
            showToast('Failed to fetch models: ' + (data.error || 'Connection failed'), 'error');
        }
    } catch (err) {
        showToast('Network error refetching models: ' + err.message, 'error');
    } finally {
        editRefetchModelsBtn.disabled = false;
        editRefetchModelsBtn.innerHTML = originalHTML;
    }
});

// Save changes on Edit Modal
document.getElementById('saveEditBtn').addEventListener('click', async () => {
    const label = document.getElementById('editKeyLabel').value.trim();
    const key = document.getElementById('editKeySecret').value.trim();
    const upstream_url = document.getElementById('editKeyURL').value.trim();
    const supports_openai = editSupportOpenAI.checked;
    const supports_gemini = editSupportGemini.checked;
    const supports_claude = editSupportClaude.checked;

    if (!label || !key) {
        showToast('Label and API Key are required', 'error');
        return;
    }

    // Collect selected models
    const selected_models = [];
    const checkedBoxes = editKeyModelsList.querySelectorAll('input[type="checkbox"]:checked');
    checkedBoxes.forEach(cb => selected_models.push(cb.value));

    if (selected_models.length === 0) {
        showToast('Please select at least one model to expose', 'error');
        return;
    }

    const saveEditBtn = document.getElementById('saveEditBtn');
    saveEditBtn.disabled = true;
    const originalHTML = saveEditBtn.innerHTML;
    const svgEl = saveEditBtn.querySelector('svg');
    const svgHtml = svgEl ? svgEl.outerHTML : '';
    saveEditBtn.innerHTML = `${svgHtml} <span>${t('adminSaving') || 'Saving...'}</span>`;

    try {
        const res = await apiFetch(`/admin/api/keys/${editingKeyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                label,
                key,
                upstream_url,
                supports_openai,
                supports_gemini,
                supports_claude,
                available_models: editKeyAvailableModels,
                selected_models
            })
        });

        if (res.ok) {
            closeEditModal();
            loadData();
            showToast('Key updated successfully', 'success');
        } else {
            const data = await res.json();
            showToast('Failed to update key: ' + (data.error || res.statusText), 'error');
        }
    } catch (err) {
        showToast('Error saving key changes: ' + err.message, 'error');
    } finally {
        saveEditBtn.disabled = false;
        saveEditBtn.innerHTML = originalHTML;
    }
});

// Key Gen display modal
function showKeyGenModal(key) {
    document.getElementById('generatedKeyText').innerText = key;
    document.getElementById('keyGenModal').classList.add('active');
}

function closeKeyGenModal() {
    document.getElementById('keyGenModal').classList.remove('active');
}

document.getElementById('copyGenKeyBtn').addEventListener('click', () => {
    const text = document.getElementById('generatedKeyText').innerText;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById('copyGenKeyBtn');
    btn.innerText = 'Copied!';
    btn.classList.add('btn-primary');
    showToast('Client key copied to clipboard!', 'success');
    setTimeout(() => {
        btn.innerText = 'Copy';
        btn.classList.remove('btn-primary');
    }, 2000);
});



function copyTextToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
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

// --- User Management Functions ---
let users = [];

async function loadUsers() {
    try {
        const res = await apiFetch('/admin/api/users');
        if (res.ok) {
            users = await res.json();
            renderUsers(users);
        } else {
            showToast('Failed to load users list', 'error');
        }
    } catch (err) {
        showToast('Error loading users list: ' + err.message, 'error');
    }
}

function renderUsers(usersList) {
    const mobileCardsContainer = document.getElementById('usersCardsMobile');
    if (usersList.length === 0) {
        const noUsersMsg = t('adminNoUsers') || 'No users registered yet.';
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="no-data">${noUsersMsg}</td>
            </tr>
        `;
        if (mobileCardsContainer) {
            mobileCardsContainer.innerHTML = `
                <div class="no-data">${noUsersMsg}</div>
            `;
        }
        return;
    }

    if (mobileCardsContainer) {
        mobileCardsContainer.innerHTML = '';
    }

    usersTableBody.innerHTML = usersList.map(user => {
        let statusClass = 'badge-cooldown';
        let statusText = t('adminStatusPending') || 'Pending';
        if (user.status === 'active') {
            statusClass = 'badge-active';
            statusText = t('adminStatusActive') || 'Active';
        } else if (user.status === 'disabled') {
            statusClass = 'badge-failed';
            statusText = t('adminStatusDisabled') || 'Disabled';
        }

        const dateStr = new Date(user.created_at).toLocaleString();

        let actionButtons = '';
        let actionButtonsMobile = '';
        
        const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        const disableIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>`;
        const trashIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        const statsIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`;

        if (user.status === 'pending') {
            actionButtons = `
                <button class="btn btn-secondary btn-sm" onclick="updateUserStatus('${user.id}', 'active')" title="${t('adminBtnApprove') || 'Approve'}">${checkIcon}</button>
            `;
            actionButtonsMobile = `
                <button class="btn btn-primary btn-sm" onclick="updateUserStatus('${user.id}', 'active')" title="${t('adminBtnApprove') || 'Approve'}">${checkIcon} <span>${t('adminBtnApprove') || 'Approve'}</span></button>
            `;
        } else if (user.status === 'active') {
            actionButtons = `
                <button class="btn btn-secondary btn-sm" onclick="updateUserStatus('${user.id}', 'disabled')" title="${t('adminBtnDisable') || 'Disable'}">${disableIcon}</button>
            `;
            actionButtonsMobile = `
                <button class="btn btn-secondary btn-sm" onclick="updateUserStatus('${user.id}', 'disabled')" title="${t('adminBtnDisable') || 'Disable'}">${disableIcon} <span>${t('adminBtnDisable') || 'Disable'}</span></button>
            `;
        } else if (user.status === 'disabled') {
            actionButtons = `
                <button class="btn btn-secondary btn-sm" onclick="updateUserStatus('${user.id}', 'active')" title="${t('adminBtnEnable') || 'Enable'}">${checkIcon}</button>
            `;
            actionButtonsMobile = `
                <button class="btn btn-secondary btn-sm" onclick="updateUserStatus('${user.id}', 'active')" title="${t('adminBtnEnable') || 'Enable'}">${checkIcon} <span>${t('adminBtnEnable') || 'Enable'}</span></button>
            `;
        }

        const trHtml = `
            <tr>
                <td style="font-weight: 600;">${escapeHtml(user.username)}</td>
                <td><span class="badge ${statusClass}">${statusText}</span></td>
                <td>${user.total_client_keys}</td>
                <td>${Number(user.total_requests).toLocaleString()}</td>
                <td>${formatTokens(user.total_tokens)}</td>
                <td style="color: var(--text-muted); font-size: 0.8rem;">${dateStr}</td>
                <td>
                    <div class="actions-cell" style="justify-content: flex-end;">
                        ${actionButtons}
                        <button class="btn btn-secondary btn-sm" onclick="viewUserStats('${user.id}', '${escapeHtml(user.username)}')" title="${t('adminStats') || 'Stats'}">${statsIcon}</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}')" title="${t('adminBtnDelete') || 'Delete'}">${trashIcon}</button>
                    </div>
                </td>
            </tr>
        `;

        if (mobileCardsContainer) {
            const card = document.createElement('div');
            card.className = 'mobile-card';
            card.innerHTML = `
                <div class="mobile-card-header">
                    <span class="mobile-card-title">${escapeHtml(user.username)}</span>
                    <span class="badge ${statusClass}">${statusText}</span>
                </div>
                <div class="mobile-card-body">
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">${t('adminTotalKeys')}</span>
                        <span class="mobile-card-value">${user.total_client_keys}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">${t('dashRequests')}</span>
                        <span class="mobile-card-value">${Number(user.total_requests).toLocaleString()}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">${t('dashTotalTokens')}</span>
                        <span class="mobile-card-value">${formatTokens(user.total_tokens)}</span>
                    </div>
                    <div class="mobile-card-row">
                        <span class="mobile-card-label">${t('adminThCreatedAt')}</span>
                        <span class="mobile-card-value" style="font-size: 0.8rem;">${dateStr}</span>
                    </div>
                </div>
                <div class="mobile-card-actions">
                    ${actionButtonsMobile}
                    <button class="btn btn-secondary btn-sm" onclick="viewUserStats('${user.id}', '${escapeHtml(user.username)}')" title="${t('adminStats') || 'Stats'}">${statsIcon} <span>${t('adminStats') || 'Stats'}</span></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}')" title="${t('adminBtnDelete') || 'Delete'}">${trashIcon} <span>${t('adminBtnDelete') || 'Delete'}</span></button>
                </div>
            `;
            mobileCardsContainer.appendChild(card);
        }

        return trHtml;
    }).join('');
}

async function updateUserStatus(userID, status) {
    try {
        const res = await apiFetch(`/admin/api/users/${userID}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (res.ok) {
            showToast(t('toastUserStatusUpdated', { status }) || `User status updated to ${status}`, 'success');
            loadUsers();
        } else {
            showToast(t('toastFailedToUpdateUser', { error: data.error }) || 'Failed to update user status', 'error');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteUser(userID) {
    if (!window.confirm(t('confirmDeleteUser') || 'Are you sure you want to delete this user?')) return;
    try {
        const res = await apiFetch(`/admin/api/users/${userID}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            showToast(t('toastUserDeleted') || 'User deleted successfully', 'success');
            loadUsers();
        } else {
            showToast(t('toastFailedToDeleteUser', { error: data.error }) || 'Failed to delete user', 'error');
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function viewUserStats(userID, username) {
    const statsModalUsername = document.getElementById('statsModalUsername');
    if (statsModalUsername) statsModalUsername.textContent = username;
    
    const modalStatRequests = document.getElementById('modalStatRequests');
    if (modalStatRequests) modalStatRequests.textContent = '0';
    
    const modalStatTotalTokens = document.getElementById('modalStatTotalTokens');
    if (modalStatTotalTokens) modalStatTotalTokens.textContent = '0';
    
    const modalStatPromptTokens = document.getElementById('modalStatPromptTokens');
    if (modalStatPromptTokens) modalStatPromptTokens.textContent = '0';
    
    const modalStatCompletionTokens = document.getElementById('modalStatCompletionTokens');
    if (modalStatCompletionTokens) modalStatCompletionTokens.textContent = '0';
    
    const modalModelStatsTableBody = document.getElementById('modalModelStatsTableBody');
    if (modalModelStatsTableBody) {
        modalModelStatsTableBody.innerHTML = `<tr><td colspan="5" class="no-data">${t('adminFetching') || 'Fetching...'}</td></tr>`;
    }
    
    const modalKeysTableBody = document.getElementById('modalKeysTableBody');
    if (modalKeysTableBody) {
        modalKeysTableBody.innerHTML = `<tr><td colspan="4" class="no-data">${t('adminFetching') || 'Fetching...'}</td></tr>`;
    }
    
    const modalModelMobile = document.getElementById('modalModelStatsCardsMobile');
    const modalKeysMobile = document.getElementById('modalKeysCardsMobile');
    if (modalModelMobile) modalModelMobile.innerHTML = '';
    if (modalKeysMobile) modalKeysMobile.innerHTML = '';

    const userStatsModal = document.getElementById('userStatsModal');
    if (userStatsModal) userStatsModal.classList.add('active');

    try {
        const res = await apiFetch(`/admin/api/users/${userID}/stats`);
        if (!res.ok) throw new Error("Failed to load user stats");
        const stats = await res.json();

        if (modalStatRequests) modalStatRequests.textContent = Number(stats.total_requests || 0).toLocaleString();
        if (modalStatTotalTokens) modalStatTotalTokens.textContent = formatTokens(stats.total_tokens || 0);
        if (modalStatPromptTokens) modalStatPromptTokens.textContent = Number(stats.prompt_tokens || 0).toLocaleString();
        if (modalStatCompletionTokens) modalStatCompletionTokens.textContent = Number(stats.completion_tokens || 0).toLocaleString();

        const modelStats = stats.model_stats || [];
        if (modalModelStatsTableBody) {
            if (modelStats.length === 0) {
                const noModelMsg = t('adminNoModelConsumption') || 'No model consumption recorded.';
                modalModelStatsTableBody.innerHTML = `<tr><td colspan="5" class="no-data">${noModelMsg}</td></tr>`;
                if (modalModelMobile) modalModelMobile.innerHTML = `<div class="no-data">${noModelMsg}</div>`;
            } else {
                if (modalModelMobile) modalModelMobile.innerHTML = '';
                modalModelStatsTableBody.innerHTML = modelStats.map(ms => {
                    const tr = `
                        <tr>
                            <td><strong>${escapeHtml(ms.model_name)}</strong></td>
                            <td>${Number(ms.total_requests).toLocaleString()}</td>
                            <td>${Number(ms.prompt_tokens).toLocaleString()}</td>
                            <td>${Number(ms.completion_tokens).toLocaleString()}</td>
                            <td>${formatTokens(ms.total_tokens)}</td>
                        </tr>
                    `;
                    if (modalModelMobile) {
                        const card = document.createElement('div');
                        card.className = 'mobile-card';
                        card.style.margin = '0 0 0.5rem 0';
                        card.style.padding = '0.75rem';
                        card.innerHTML = `
                            <div class="mobile-card-header" style="padding-bottom: 0.25rem;">
                                <span class="mobile-card-title" style="font-size: 0.85rem;">${escapeHtml(ms.model_name)}</span>
                            </div>
                            <div class="mobile-card-body" style="font-size: 0.75rem;">
                                <div class="mobile-card-row"><span class="mobile-card-label">Requests</span><span>${Number(ms.total_requests).toLocaleString()}</span></div>
                                <div class="mobile-card-row"><span class="mobile-card-label">Tokens</span><span>${formatTokens(ms.total_tokens)} <span style="opacity:0.6;">(P: ${ms.prompt_tokens.toLocaleString()} | C: ${ms.completion_tokens.toLocaleString()})</span></span></div>
                            </div>
                        `;
                        modalModelMobile.appendChild(card);
                    }
                    return tr;
                }).join('');
            }
        }

        const keysList = stats.keys || [];
        if (modalKeysTableBody) {
            if (keysList.length === 0) {
                const noKeysMsg = t('adminNoKeysFound') || 'No keys found.';
                modalKeysTableBody.innerHTML = `<tr><td colspan="5" class="no-data">${noKeysMsg}</td></tr>`;
                if (modalKeysMobile) modalKeysMobile.innerHTML = `<div class="no-data">${noKeysMsg}</div>`;
            } else {
                if (modalKeysMobile) modalKeysMobile.innerHTML = '';
                modalKeysTableBody.innerHTML = keysList.map(k => {
                    const lastUsedText = k.last_used && k.last_used !== '0001-01-01T00:00:00Z' && k.last_used !== '0001-01-01T00:00:00.000Z' && k.last_used !== '0001-01-01T07:00:00+07:00'
                        ? new Date(k.last_used).toLocaleString() 
                        : (t('adminNever') || 'Never');

                    const tr = `
                        <tr>
                            <td><strong>${escapeHtml(k.label)}</strong></td>
                            <td><span class="badge badge-${k.status === 'active' ? 'active' : 'disabled'}">${k.status}</span></td>
                            <td>${Number(k.total_requests).toLocaleString()}</td>
                            <td>${formatTokens(k.total_tokens)}</td>
                            <td style="color: var(--text-muted); font-size: 0.8rem;">${lastUsedText}</td>
                        </tr>
                    `;
                    if (modalKeysMobile) {
                        const card = document.createElement('div');
                        card.className = 'mobile-card';
                        card.style.margin = '0 0 0.5rem 0';
                        card.style.padding = '0.75rem';
                        card.innerHTML = `
                            <div class="mobile-card-header" style="padding-bottom: 0.25rem;">
                                <span class="mobile-card-title" style="font-size: 0.85rem;">${escapeHtml(k.label)}</span>
                                <span class="badge badge-${k.status === 'active' ? 'active' : 'disabled'}" style="font-size: 0.65rem; padding: 1px 4px;">${k.status}</span>
                            </div>
                            <div class="mobile-card-body" style="font-size: 0.75rem;">
                                <div class="mobile-card-row"><span class="mobile-card-label">Requests</span><span>${Number(k.total_requests).toLocaleString()}</span></div>
                                <div class="mobile-card-row"><span class="mobile-card-label">Tokens</span><span>${formatTokens(k.total_tokens)}</span></div>
                                <div class="mobile-card-row"><span class="mobile-card-label">Last Used</span><span style="color: var(--text-muted);">${lastUsedText}</span></div>
                            </div>
                        `;
                        modalKeysMobile.appendChild(card);
                    }
                    return tr;
                }).join('');
            }
        }
    } catch (err) {
        showToast(err.message, 'error');
        closeUserStatsModal();
    }
}

function closeUserStatsModal() {
    const userStatsModal = document.getElementById('userStatsModal');
    if (userStatsModal) userStatsModal.classList.remove('active');
}

function renderUsersSkeleton() {
    usersTableBody.innerHTML = `
        <tr>
            <td><div class="skeleton-loader skeleton-text-lg"></div></td>
            <td><div class="skeleton-loader skeleton-badge"></div></td>
            <td><div class="skeleton-loader skeleton-text-sm"></div></td>
            <td><div class="skeleton-loader skeleton-text-sm"></div></td>
            <td><div class="skeleton-loader skeleton-text-md"></div></td>
            <td><div class="skeleton-loader skeleton-text-lg"></div></td>
            <td><div class="skeleton-loader skeleton-text-lg" style="width: 100px; margin-left: auto;"></div></td>
        </tr>
        <tr>
            <td><div class="skeleton-loader skeleton-text-lg"></div></td>
            <td><div class="skeleton-loader skeleton-badge"></div></td>
            <td><div class="skeleton-loader skeleton-text-sm"></div></td>
            <td><div class="skeleton-loader skeleton-text-sm"></div></td>
            <td><div class="skeleton-loader skeleton-text-md"></div></td>
            <td><div class="skeleton-loader skeleton-text-lg"></div></td>
            <td><div class="skeleton-loader skeleton-text-lg" style="width: 100px; margin-left: auto;"></div></td>
        </tr>
    `;
    const mobileHtml = `
        <div class="mobile-card skeleton-card">
            <div class="mobile-card-header" style="border-bottom: none;">
                <div style="width: 60%;"><div class="skeleton-loader skeleton-text-lg"></div></div>
                <div class="skeleton-loader skeleton-badge"></div>
            </div>
            <div class="mobile-card-body">
                <div class="mobile-card-row"><div class="skeleton-loader skeleton-text-sm" style="width: 30%;"></div><div class="skeleton-loader skeleton-text-sm" style="width: 20%;"></div></div>
                <div class="mobile-card-row"><div class="skeleton-loader skeleton-text-sm" style="width: 40%;"></div><div class="skeleton-loader skeleton-text-sm" style="width: 30%;"></div></div>
            </div>
        </div>
    `;
    const mobileCardsContainer = document.getElementById('usersCardsMobile');
    if (mobileCardsContainer) {
        mobileCardsContainer.innerHTML = mobileHtml + mobileHtml;
    }
}

// Initial setup
let pollerId = null;

async function initPortal() {
    applyLanguage();
    try {
        const res = await fetch('/admin/api/config');
        if (!res.ok) {
            throw new Error("Config endpoint returned " + res.status);
        }
        const config = await res.json();
        
        authRequired = config.auth_required;
        
        if (authRequired) {
            const savedToken = localStorage.getItem('admin_token');
            if (savedToken) {
                const statsRes = await apiFetch('/admin/api/stats');
                if (statsRes.ok) {
                    hideLoginOverlay();
                    loadData();
                    startPoller();
                } else {
                    localStorage.removeItem('admin_token');
                    adminToken = '';
                    showLoginOverlay();
                }
            } else {
                showLoginOverlay();
            }
        } else {
            hideLoginOverlay();
            adminToken = '';
            loadData();
            startPoller();
        }
    } catch (err) {
        console.error("Config check failed:", err);
        showLoginOverlay();
    }
}

function startPoller() {
    if (pollerId) clearInterval(pollerId);
    pollerId = setInterval(loadData, 5000);
}

// Run startup flow
initPortal();

// Register filter and clear log events once document is ready
document.getElementById('errorLogFilter').addEventListener('input', applyErrorLogFilter);
document.getElementById('clearErrorLogsBtn').addEventListener('click', clearAllErrorLogs);
document.getElementById('upstreamKeyFilter').addEventListener('input', applyUpstreamKeyFilter);

// Backup & Restore click listeners
const exportBackupBtn = document.getElementById('exportBackupBtn');
if (exportBackupBtn) {
    exportBackupBtn.addEventListener('click', async () => {
        try {
            const res = await apiFetch('/admin/api/backup');
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `dc_ai_api_backup_${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                showToast(t('toastBackupExported') || 'Backup configuration exported successfully', 'success');
            } else {
                const data = await res.json();
                showToast((t('toastBackupExportFailed') || 'Export failed: {error}').replace('{error}', data.error || res.statusText), 'error');
            }
        } catch (err) {
            showToast((t('toastBackupExportFailed') || 'Export failed: {error}').replace('{error}', err.message), 'error');
        }
    });
}

const importBackupTriggerBtn = document.getElementById('importBackupTriggerBtn');
const importBackupFile = document.getElementById('importBackupFile');

if (importBackupTriggerBtn && importBackupFile) {
    importBackupTriggerBtn.addEventListener('click', () => {
        importBackupFile.click();
    });

    importBackupFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm(t('confirmRestoreBackup') || 'Are you sure you want to restore this backup? This will delete all current keys, clients, and settings!')) {
            importBackupFile.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const backupData = JSON.parse(event.target.result);
                const res = await apiFetch('/admin/api/restore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(backupData)
                });

                if (res.ok) {
                    showToast(t('toastBackupImported') || 'Backup restored successfully! Reloading...', 'success');
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    const data = await res.json();
                    showToast((t('toastBackupImportFailed') || 'Import failed: {error}').replace('{error}', data.error || res.statusText), 'error');
                }
            } catch (err) {
                showToast(t('toastInvalidBackupFile') || 'Invalid JSON backup file', 'error');
            } finally {
                importBackupFile.value = '';
            }
        };
        reader.readAsText(file);
    });
}

// Language select event listener
const langSelect = document.getElementById('languageSelect');
if (langSelect) {
    if (!localStorage.getItem(LANGUAGE_KEY)) {
        const userLang = (navigator.language || navigator.userLanguage || 'vi').toLowerCase().startsWith('vi') ? 'vi' : 'en';
        localStorage.setItem(LANGUAGE_KEY, userLang);
    }
    langSelect.value = localStorage.getItem(LANGUAGE_KEY) || 'vi';
    
    langSelect.addEventListener('change', (e) => {
        localStorage.setItem(LANGUAGE_KEY, e.target.value);
        applyLanguage();
        // Re-render components with translated keys/tooltips
        applyUpstreamKeyFilter();
        renderClientKeysTable();
        applyErrorLogFilter();
        if (activeTab === 'users') {
            loadUsers();
        }
    });
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
}

// Bind module-scoped functions to window object for inline onclick handlers
window.copyTextToClipboard = copyTextToClipboard;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.duplicateKeyConfig = duplicateKeyConfig;
window.testKey = testKey;
window.toggleKeyStatus = toggleKeyStatus;
window.deleteKey = deleteKey;
window.toggleClientKeyStatus = toggleClientKeyStatus;
window.deleteClientKey = deleteClientKey;
window.closeKeyGenModal = closeKeyGenModal;
window.updateUserStatus = updateUserStatus;
window.deleteUser = deleteUser;
window.viewUserStats = viewUserStats;
window.closeUserStatsModal = closeUserStatsModal;
window.t = t;

