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
const tabSettings = document.getElementById('tabSettings');
const tabErrorLogs = document.getElementById('tabErrorLogs');
const upstreamKeyFilter = document.getElementById('upstreamKeyFilter');
const statsContainer = document.getElementById('statsContainer');
const upstreamTableContainer = document.getElementById('upstreamTableContainer');
const clientTableContainer = document.getElementById('clientTableContainer');
const settingsContainer = document.getElementById('settingsContainer');
const errorLogsContainer = document.getElementById('errorLogsContainer');
const errorLogsTableBody = document.getElementById('errorLogsTableBody');
const errorLogsCardsMobile = document.getElementById('errorLogsCardsMobile');
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

// Tab switching
tabStats.addEventListener('click', () => {
    activeTab = 'stats';
    tabStats.classList.add('active');
    tabUpstream.classList.remove('active');
    tabClient.classList.remove('active');
    tabSettings.classList.remove('active');
    tabErrorLogs.classList.remove('active');
    statsContainer.style.display = 'block';
    addKeyForm.style.display = 'none';
    addClientKeyForm.style.display = 'none';
    upstreamTableContainer.style.display = 'none';
    clientTableContainer.style.display = 'none';
    settingsContainer.style.display = 'none';
    errorLogsContainer.style.display = 'none';
    panelTitle.innerText = 'System & Fallback Statistics';
    triggerPaneAnimation([statsContainer]);
    loadData();
});

tabUpstream.addEventListener('click', () => {
    activeTab = 'upstream';
    tabStats.classList.remove('active');
    tabUpstream.classList.add('active');
    tabClient.classList.remove('active');
    tabSettings.classList.remove('active');
    tabErrorLogs.classList.remove('active');
    statsContainer.style.display = 'none';
    addKeyForm.style.display = 'flex';
    addClientKeyForm.style.display = 'none';
    upstreamTableContainer.style.display = 'block';
    clientTableContainer.style.display = 'none';
    settingsContainer.style.display = 'none';
    errorLogsContainer.style.display = 'none';
    panelTitle.innerText = 'Upstream API Keys';
    triggerPaneAnimation([addKeyForm, upstreamTableContainer]);
    renderKeysSkeleton();
    loadData();
});

tabClient.addEventListener('click', () => {
    activeTab = 'client';
    tabStats.classList.remove('active');
    tabUpstream.classList.remove('active');
    tabClient.classList.add('active');
    tabSettings.classList.remove('active');
    tabErrorLogs.classList.remove('active');
    statsContainer.style.display = 'none';
    addKeyForm.style.display = 'none';
    addClientKeyForm.style.display = 'grid';
    upstreamTableContainer.style.display = 'none';
    clientTableContainer.style.display = 'block';
    settingsContainer.style.display = 'none';
    errorLogsContainer.style.display = 'none';
    panelTitle.innerText = 'Client API Keys';
    triggerPaneAnimation([addClientKeyForm, clientTableContainer]);
    renderClientKeysSkeleton();
    loadClientKeys();
});

tabSettings.addEventListener('click', () => {
    activeTab = 'settings';
    tabStats.classList.remove('active');
    tabUpstream.classList.remove('active');
    tabClient.classList.remove('active');
    tabSettings.classList.add('active');
    tabErrorLogs.classList.remove('active');
    statsContainer.style.display = 'none';
    addKeyForm.style.display = 'none';
    addClientKeyForm.style.display = 'none';
    upstreamTableContainer.style.display = 'none';
    clientTableContainer.style.display = 'none';
    settingsContainer.style.display = 'block';
    errorLogsContainer.style.display = 'none';
    panelTitle.innerText = 'Fallback & Proxy Settings';
    triggerPaneAnimation([settingsContainer]);
    loadSettings();
});

tabErrorLogs.addEventListener('click', () => {
    activeTab = 'errorLogs';
    tabStats.classList.remove('active');
    tabUpstream.classList.remove('active');
    tabClient.classList.remove('active');
    tabSettings.classList.remove('active');
    tabErrorLogs.classList.add('active');
    statsContainer.style.display = 'none';
    addKeyForm.style.display = 'none';
    addClientKeyForm.style.display = 'none';
    upstreamTableContainer.style.display = 'none';
    clientTableContainer.style.display = 'none';
    settingsContainer.style.display = 'none';
    errorLogsContainer.style.display = 'block';
    panelTitle.innerText = 'Upstream Error Logs';
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
    const originalText = fetchModelsBtn.innerText;
    fetchModelsBtn.innerText = 'Fetching...';

    showToast('Fetching and verifying models against upstream...', 'info');

    try {
        const res = await apiFetch('/admin/api/keys/fetch-models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, upstream_url })
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
        fetchModelsBtn.innerText = originalText;
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
    saveNewKeyBtn.innerText = 'Saving...';

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
        saveNewKeyBtn.innerText = 'Save & Add Key';
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
    submitBtn.innerText = 'Saving...';

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
        submitBtn.innerText = 'Save Settings';
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
    const originalText = settingsFetchModelsBtn.innerText;
    settingsFetchModelsBtn.innerText = 'Fetching...';

    showToast('Fetching models for fallback upstream...', 'info');

    try {
        const res = await apiFetch('/admin/api/keys/fetch-models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, upstream_url })
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
        settingsFetchModelsBtn.innerText = originalText;
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
        td.textContent = 'No upstream errors recorded.';
        tr.appendChild(td);
        errorLogsTableBody.appendChild(tr);

        const div = document.createElement('div');
        div.className = 'no-data';
        div.textContent = 'No upstream errors recorded.';
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
        btnDel.title = 'Delete Log';
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
        mBtnDel.title = 'Delete Log';
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
    document.getElementById('statTokenDetails').innerHTML = `Prompt: ${stats.prompt_tokens ? stats.prompt_tokens.toLocaleString() : 0} • Comp: ${stats.completion_tokens ? stats.completion_tokens.toLocaleString() : 0}`;

    // Fallback stats
    document.getElementById('statGcliTotalRequests').innerText = stats.gcli_total_requests || 0;
    document.getElementById('statGcliSuccessCount').innerText = stats.gcli_success_count || 0;
    document.getElementById('statGcliFailureCount').innerText = stats.gcli_failure_count || 0;
    document.getElementById('statGcliSuccessRate').innerText = (stats.gcli_success_rate ? stats.gcli_success_rate.toFixed(1) : 0) + '%';

    // Fallback Token Stats
    document.getElementById('statGcliTotalTokens').innerText = formatTokens(stats.gcli_total_tokens || 0);
    document.getElementById('statGcliTokenDetails').innerHTML = `Prompt: ${stats.gcli_prompt_tokens ? stats.gcli_prompt_tokens.toLocaleString() : 0} • Comp: ${stats.gcli_completion_tokens ? stats.gcli_completion_tokens.toLocaleString() : 0}`;
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
        keysTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="no-data">No keys added. Fetch models and save a key above to start rotating.</td>
            </tr>
        `;
        document.getElementById('keysCardsMobile').innerHTML = `
            <div class="no-data">No keys added. Fetch models and save a key above to start rotating.</div>
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
                cooldownText = `<div style="font-size: 0.75rem; opacity: 0.7;">Cooldown: ${Math.round(diff/1000)}s</div>`;
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

        const modelsSummary = `<div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${selectedCount} models exposed</div>`;

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
                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;" title="Average Latency | Last Latency">
                    Avg: ${k.avg_latency_ms || 0}ms<br/>Last: ${k.last_latency_ms || 0}ms
                </div>
            </td>
            <td>
                ${k.total_requests}
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;" title="Prompt: ${k.prompt_tokens || 0} | Completion: ${k.completion_tokens || 0}">
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
                    <button class="btn btn-secondary btn-sm" onclick="openEditModal('${k.id}')">Edit</button>
                    <button class="btn btn-secondary btn-sm" onclick="duplicateKeyConfig('${k.id}')">Duplicate</button>
                    <button class="btn btn-secondary btn-sm" onclick="testKey('${k.id}', this)">Test</button>
                    <button class="btn btn-secondary btn-sm" onclick="toggleKeyStatus('${k.id}', '${k.status}')">
                          ${k.status === 'disabled' ? 'Enable' : 'Disable'}
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteKey('${k.id}')">Delete</button>
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
                    <span class="mobile-card-label">API Key</span>
                    <div class="key-text-container">
                        <span class="key-masked" id="key-val-${k.id}-mobile">${k.key_masked}</span>
                        <button class="copy-btn" onclick="copyTextToClipboard('${k.key}')" title="Copy Key"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                    </div>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Upstream URL</span>
                    <span class="mobile-card-value" style="font-size: 0.8rem; word-break: break-all;">${escapeHtml(k.upstream_url)}</span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Requests</span>
                    <span class="mobile-card-value">${k.total_requests} <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.25rem;">(${formatTokens(k.prompt_tokens + k.completion_tokens)})</span></span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Success / Fail</span>
                    <span class="mobile-card-value">
                        <span style="color: var(--color-active);">${success}</span> / 
                        <span style="color: var(--color-failed);">${fail}</span>
                        <span style="color: var(--text-secondary); margin-left: 0.5rem;">(${rate})</span>
                    </span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Latency</span>
                    <span class="mobile-card-value">Avg: ${k.avg_latency_ms || 0}ms | Last: ${k.last_latency_ms || 0}ms</span>
                </div>
                ${k.error_reason ? `
                <div class="mobile-card-row" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                    <span class="mobile-card-label">Error Reason</span>
                    <span style="color: var(--color-failed); font-size: 0.8rem; word-break: break-all;">${escapeHtml(k.error_reason)}</span>
                </div>
                ` : ''}
            </div>
            <div class="mobile-card-actions">
                <button class="btn btn-secondary btn-sm" onclick="openEditModal('${k.id}')">Edit</button>
                <button class="btn btn-secondary btn-sm" onclick="duplicateKeyConfig('${k.id}')">Duplicate</button>
                <button class="btn btn-secondary btn-sm" onclick="testKey('${k.id}', this)">Test</button>
                <button class="btn btn-secondary btn-sm" onclick="toggleKeyStatus('${k.id}', '${k.status}')">
                    ${k.status === 'disabled' ? 'Enable' : 'Disable'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteKey('${k.id}')">Delete</button>
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
                <td colspan="6" class="no-data">No client keys generated yet. Use the form above to generate one.</td>
            </tr>
        `;
        document.getElementById('clientKeysCardsMobile').innerHTML = `
            <div class="no-data">No client keys generated yet. Use the form above to generate one.</div>
        `;
        return;
    }

    clientKeysTableBody.innerHTML = '';
    const mobileCardsContainer = document.getElementById('clientKeysCardsMobile');
    mobileCardsContainer.innerHTML = '';

    clientKeys.forEach(k => {
        const lastUsedText = k.last_used && k.last_used !== '0001-01-01T00:00:00Z' 
            ? new Date(k.last_used).toLocaleString() 
            : 'Never';

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
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;" title="Prompt: ${k.prompt_tokens || 0} | Completion: ${k.completion_tokens || 0}">
                    ${formatTokens(k.prompt_tokens + k.completion_tokens)}
                </div>
            </td>
            <td><span style="font-size: 0.8rem; color: var(--text-secondary);">${lastUsedText}</span></td>
            <td>
                <div class="actions-cell">
                    <button class="btn btn-secondary btn-sm" onclick="toggleClientKeyStatus('${k.id}', '${k.status}')">
                        ${k.status === 'disabled' ? 'Enable' : 'Disable'}
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteClientKey('${k.id}')">Delete</button>
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
                    <span class="mobile-card-label">Client Key</span>
                    <div class="key-text-container">
                        <span class="key-masked" id="clientKey-val-${k.id}-mobile">${k.key_masked}</span>
                        <button class="copy-btn" onclick="copyTextToClipboard('${k.key}')" title="Copy Key"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                    </div>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Requests</span>
                    <span class="mobile-card-value">${k.total_requests} <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 0.25rem;">(${formatTokens(k.prompt_tokens + k.completion_tokens)})</span></span>
                </div>
                <div class="mobile-card-row">
                    <span class="mobile-card-label">Last Used</span>
                    <span class="mobile-card-value" style="font-size: 0.8rem;">${lastUsedText}</span>
                </div>
            </div>
            <div class="mobile-card-actions">
                <button class="btn btn-secondary btn-sm" onclick="toggleClientKeyStatus('${k.id}', '${k.status}')">
                    ${k.status === 'disabled' ? 'Enable' : 'Disable'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteClientKey('${k.id}')">Delete</button>
            </div>
        `;
        mobileCardsContainer.appendChild(card);
    });
}

// Test Upstream Key
async function testKey(id, btn) {
    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = 'Testing...';
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
        btn.innerText = originalText;
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
    const originalText = editRefetchModelsBtn.innerText;
    editRefetchModelsBtn.innerText = 'Refetching...';

    showToast('Refetching models from upstream...', 'info');

    try {
        const res = await apiFetch('/admin/api/keys/fetch-models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, upstream_url })
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
        editRefetchModelsBtn.innerText = originalText;
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
    saveEditBtn.innerText = 'Saving...';

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
        saveEditBtn.innerText = 'Save changes';
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

// Initial setup
let pollerId = null;

async function initPortal() {
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

