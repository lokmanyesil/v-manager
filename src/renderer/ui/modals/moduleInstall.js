import { state } from '../../state.js';
import { openModal, closeModal } from './base.js';
import { showInfoModal } from './info.js';
import { renderGames, updateHomeStats, refreshGame } from '../games.js';
import { buildCacheStatusBar } from './cacheHelpers.js';
import { openWizardModal } from './dlssWizard.js';
import { selectExeWithPicker } from './exePicker.js';
import { getCurrentLang } from '../../i18n/i18n.js';

let _currentModule = null;
let _currentGame = null;
let _fetchedReleases = [];

export async function openModuleInstallModal(moduleData, game, forceRefresh = false) {
    if (!moduleData || !game) return;

    _currentModule = {
        ...moduleData,
        manifest: moduleData.manifest || moduleData
    };
    _currentGame = game;

    const manifest = _currentModule.manifest;
    
    // Header & Meta
    const titleEl = document.getElementById('module-install-title');
    if (titleEl) titleEl.textContent = manifest.name || moduleData.id;

    const badgeEl = document.getElementById('module-install-badge');
    if (badgeEl) {
        badgeEl.className = `mod-card-badge badge-${moduleData.type || 'official'}`;
        const typeIcons = { official: '🛡️ Resmi', community: '👥 Topluluk', custom: '⚡ Özel' };
        badgeEl.textContent = typeIcons[moduleData.type] || moduleData.type;
    }

    // Left sidebar: Game details & Cover
    const gameNameEl = document.getElementById('module-install-game-name');
    if (gameNameEl) gameNameEl.textContent = game.name;

    const coverEl = document.getElementById('module-install-game-cover');
    const placeholderEl = document.getElementById('module-install-game-placeholder');
    if (coverEl && placeholderEl) {
        if (game.cover) {
            coverEl.src = game.cover;
            coverEl.style.display = 'block';
            placeholderEl.style.display = 'none';
        } else {
            coverEl.style.display = 'none';
            placeholderEl.style.display = 'flex';
        }
    }

    const authorEl = document.getElementById('module-install-author');
    if (authorEl) {
        authorEl.textContent = manifest.author ? `Geliştirici: ${manifest.author}` : '';
    }

    const repoEl = document.getElementById('module-install-repo');
    if (repoEl) {
        repoEl.textContent = manifest.source?.repo ? `Repo: ${manifest.source.repo}` : '';
    }

    // Right: Description
    const descEl = document.getElementById('module-install-desc');
    if (descEl) {
        descEl.textContent = manifest.description || 'Bu modül için açıklama bulunmuyor.';
    }

    // Reset Progress & Sections
    const progressSec = document.getElementById('module-install-progress-section');
    if (progressSec) progressSec.style.display = 'none';

    const submitBtn = document.getElementById('module-install-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Kurulumu Başlat';
    }

    // ── 1. Releases / Sürümler ───────────────────────────────────────────
    const verSelect = document.getElementById('module-install-version-select');
    if (verSelect) {
        verSelect.innerHTML = `<option value="" disabled selected>Sürümler alınıyor...</option>`;
        verSelect.disabled = true;

        const existingBar = verSelect.parentNode.querySelector('.release-cache-status-bar');
        if (existingBar) existingBar.remove();

        try {
            const result = await window.electronAPI.moduleGetReleases(moduleData.id, forceRefresh);
            verSelect.innerHTML = '';
            
            const releases = result.releases ?? result;
            const fetchedAt = result.fetchedAt ?? null;
            const fromStaleCache = result.fromStaleCache ?? false;
            _fetchedReleases = releases || [];

            if (_fetchedReleases.length > 0) {
                const cacheBar = buildCacheStatusBar(fetchedAt, fromStaleCache, () => openModuleInstallModal(_currentModule, _currentGame, true));
                verSelect.parentNode.insertBefore(cacheBar, verSelect);

                _fetchedReleases.forEach((r, idx) => {
                    const opt = document.createElement('option');
                    opt.value = r.tag || r.name;
                    opt.textContent = `${r.name || r.tag} ${r.installed ? '(İndirildi ✓)' : '(İndirilecek 📥)'}`;
                    if (r.installed) opt.style.color = '#22c55e';
                    if (idx === 0) opt.selected = true;
                    verSelect.appendChild(opt);
                });
                verSelect.disabled = false;
            } else {
                verSelect.innerHTML = `<option value="latest">En Son Sürüm (latest)</option>`;
                verSelect.disabled = false;
            }
        } catch (e) {
            verSelect.innerHTML = `<option value="latest">Varsayılan Sürüm (latest)</option>`;
            verSelect.disabled = false;
        }
    }

    // ── 2. Presets / Ön Ayarlar (Varsa ve Manifestte Başlangıçta Uygula İzni Varsa) ──
    const presetSec = document.getElementById('module-install-preset-section');
    const presetSelect = document.getElementById('module-install-preset-select');
    let hasPresets = false;

    // Manifest'te başlangıçta uygula seçeneği var mı kontrol et
    const allowApplyOnInstall = Boolean(
        manifest.install?.applyPresetOnInstall ||
        manifest.applyPresetOnInstall ||
        manifest.wizard?.applyPresetOnSuccess ||
        (Array.isArray(manifest.config) && manifest.config.some(c => c.applyPresetOnInstall))
    );

    const defaultPreset = 
        (typeof manifest.install?.applyPresetOnInstall === 'string' ? manifest.install.applyPresetOnInstall : null) ||
        (typeof manifest.applyPresetOnInstall === 'string' ? manifest.applyPresetOnInstall : null) ||
        (typeof manifest.wizard?.applyPresetOnSuccess === 'string' ? manifest.wizard.applyPresetOnSuccess : null) ||
        '';

    if (presetSec && presetSelect) {
        presetSelect.innerHTML = '<option value="">(Varsayılan Ayarlar)</option>';
        if (allowApplyOnInstall && Array.isArray(manifest.config)) {
            for (const cfg of manifest.config) {
                if (cfg.presets && typeof cfg.presets === 'object') {
                    for (const [pKey, pVal] of Object.entries(cfg.presets)) {
                        const opt = document.createElement('option');
                        opt.value = pKey;
                        opt.textContent = pVal.name || pKey;
                        if (pVal.description) opt.title = pVal.description;
                        if (defaultPreset && pKey === defaultPreset) {
                            opt.selected = true;
                        }
                        presetSelect.appendChild(opt);
                        hasPresets = true;
                    }
                }
            }
        }
        presetSec.style.display = (allowApplyOnInstall && hasPresets) ? 'block' : 'none';
    }

    // ── 3. Proxy DLL Target (Varsa) ──────────────────────────────────────
    const proxySec = document.getElementById('module-install-proxy-section');
    const proxySelect = document.getElementById('module-install-proxy-select');
    if (proxySec && proxySelect) {
        if (manifest.install?.proxyDetection) {
            proxySec.style.display = 'block';
            proxySelect.innerHTML = '';
            const candidates = manifest.install.proxyDetection.candidates || ['dxgi.dll', 'version.dll', 'winmm.dll'];
            const defTarget = manifest.install.proxyDetection.defaultTarget || 'dxgi.dll';
            
            candidates.forEach(cand => {
                const opt = document.createElement('option');
                opt.value = cand;
                opt.textContent = cand;
                if (cand === defTarget) opt.selected = true;
                proxySelect.appendChild(opt);
            });
        } else {
            proxySec.style.display = 'none';
        }
    }

    // ── 4. Wizard / Sihirbaz (Varsa) ─────────────────────────────────────
    const wizardSec = document.getElementById('module-install-wizard-section');
    if (wizardSec) {
        wizardSec.style.display = manifest.wizard ? 'block' : 'none';
    }

    openModal('module-install-modal');
}

export function initModuleInstallModalListeners() {
    const cancelBtn = document.getElementById('module-install-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeModal('module-install-modal');
        });
    }

    // Wizard Button Listener
    const wizardBtn = document.getElementById('module-install-wizard-btn');
    if (wizardBtn) {
        wizardBtn.addEventListener('click', async () => {
            if (!_currentModule || !_currentGame) return;

            const verSelect = document.getElementById('module-install-version-select');
            const selectedTag = (verSelect && verSelect.value) ? verSelect.value : (_currentGame.dlssEnablerVersion || 'latest');

            const proxySelect = document.getElementById('module-install-proxy-select');
            const selectedDll = (proxySelect && proxySelect.value) ? proxySelect.value : 'version.dll';

            let exePath = null;
            try {
                const paths = await window.electronAPI.resolveGamePaths(
                    _currentGame.name,
                    _currentGame.exePath || _currentGame.exe_path
                );
                if (paths && paths.exe_path && paths.exe_path.toLowerCase().endsWith('.exe')) {
                    exePath = paths.exe_path;
                }

                if (!exePath) {
                    const gameRoot = paths ? paths.game_root : (_currentGame.path || _currentGame.exePath);
                    const selected = await selectExeWithPicker(
                        _currentGame.name,
                        gameRoot
                    );
                    if (!selected) return; // Kullanıcı iptal etti
                    exePath = selected;
                }
            } catch (err) {
                console.error('[MODULE_INSTALL] Path resolution error:', err);
            }

            if (!exePath) return;

            const release = _fetchedReleases.find(r => (r.tag || r.name) === selectedTag) || _fetchedReleases[0];
            const downloadUrl = release ? release.downloadUrl : null;

            closeModal('module-install-modal');

            // If it's DLSS Enabler or uses openWizardModal
            if (_currentModule.id === 'dlssenabler') {
                openWizardModal(_currentGame, selectedTag, selectedDll, exePath, downloadUrl);
            } else {
                // Universal wizard execution
                const modName = _currentModule?.manifest?.name || _currentModule?.name || _currentModule?.id || 'Mod';
                showInfoModal('Sihirbaz Başlatılıyor', `${modName} kurulum sihirbazı başlatılıyor...`);
                try {
                    const result = await window.electronAPI.moduleRunWizard({
                        moduleId: _currentModule.id,
                        game: _currentGame,
                        gameName: _currentGame.name,
                        version: selectedTag,
                        dllName: selectedDll,
                        downloadUrl,
                        exePath,
                        lang: getCurrentLang ? getCurrentLang() : 'tr'
                    });
                    if (result.success) {
                        showInfoModal('Sihirbaz Tamamlandı', `🎉 Test başarılı! Uyumlu yapılandırma uygulandı.`);
                        await refreshGame(_currentGame);
                        updateHomeStats();
                    } else {
                        showInfoModal('Sihirbaz Başarısız', result.error || 'Sihirbaz testi tamamlanamadı.', true);
                    }
                } catch (e) {
                    showInfoModal('Hata', e.message, true);
                }
            }
        });
    }

    // Submit Install Button Listener
    const submitBtn = document.getElementById('module-install-submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            if (!_currentModule || !_currentGame) return;

            const verSelect = document.getElementById('module-install-version-select');
            const selectedTag = verSelect ? verSelect.value : 'latest';

            const presetSec = document.getElementById('module-install-preset-section');
            const presetSelect = document.getElementById('module-install-preset-select');
            const isPresetAllowed = presetSec && presetSec.style.display !== 'none';
            const selectedPreset = (isPresetAllowed && presetSelect) ? presetSelect.value : null;

            const progressSec = document.getElementById('module-install-progress-section');
            const progressBar = document.getElementById('module-install-progress-bar');
            const statusText = document.getElementById('module-install-status-text');
            const percentText = document.getElementById('module-install-percent-text');

            if (progressSec) progressSec.style.display = 'block';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Kuruluyor...';

            if (progressBar) progressBar.style.width = '10%';
            if (percentText) percentText.textContent = '%10';
            if (statusText) statusText.textContent = 'Kurulum başlatılıyor...';

            try {
                const exePath = _currentGame.exe_path || _currentGame.exePath || _currentGame.path || '';
                console.log('[MODULE_INSTALL_UI] Kurulum başlatılıyor:', {
                    moduleId: _currentModule.id,
                    gameName: _currentGame.name,
                    exePath,
                    selectedTag,
                    selectedPreset
                });

                // Listen to download progress
                if (window.electronAPI.onModuleDownloadProgress) {
                    window.electronAPI.onModuleDownloadProgress((data) => {
                        if (data && data.moduleId === _currentModule.id) {
                            const p = Math.round(data.percent || 0);
                            if (progressBar) progressBar.style.width = `${Math.min(95, p)}%`;
                            if (percentText) percentText.textContent = `%${p}`;
                            if (statusText) statusText.textContent = `İndiriliyor... %${p}`;
                        }
                    });
                }

                // Listen to overall module progress
                if (window.electronAPI.onModuleProgress) {
                    window.electronAPI.onModuleProgress((data) => {
                        if (data && data.moduleId === _currentModule.id) {
                            const p = Math.round(data.percent || 0);
                            if (progressBar) progressBar.style.width = `${p}%`;
                            if (percentText) percentText.textContent = `%${p}`;
                            if (statusText && data.message) statusText.textContent = data.message;
                            console.log(`[MODULE_PROGRESS] [${_currentModule.id}] Adım ${data.step}: ${data.message} (%${p})`);
                        }
                    });
                }

                const options = {};
                if (selectedPreset) options.preset = selectedPreset;

                const result = await window.electronAPI.moduleInstall(
                    _currentModule.id,
                    _currentGame.name,
                    exePath,
                    selectedTag,
                    options
                );

                if (window.electronAPI.removeModuleDownloadProgressListeners) {
                    window.electronAPI.removeModuleDownloadProgressListeners();
                }
                if (window.electronAPI.removeModuleProgressListeners) {
                    window.electronAPI.removeModuleProgressListeners();
                }

                console.log('[MODULE_INSTALL_UI_RESULT]', result);

                if (result && result.success) {
                    if (progressBar) progressBar.style.width = '100%';
                    if (percentText) percentText.textContent = '%100';
                    if (statusText) statusText.textContent = 'Kurulum tamamlandı!';

                    closeModal('module-install-modal');
                    closeModal('mod-modal');
                    const modName = _currentModule?.manifest?.name || _currentModule?.name || _currentModule?.id || 'Mod';
                    showInfoModal(
                        'Kurulum Başarılı',
                        `🎉 ${modName} (${result.installedVersion || selectedTag}) başarıyla kuruldu!`
                    );
                    await refreshGame(_currentGame);
                    updateHomeStats();
                } else {
                    if (progressSec) progressSec.style.display = 'none';
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Kurulumu Başlat';
                    
                    const errorDetail = result?.error || result?.message || (result?.failures ? result.failures.map(f => f.message).join('; ') : 'Bilinmeyen bir hata oluştu.');
                    console.error('[MODULE_INSTALL_FAILED_DETAIL]', {
                        error: errorDetail,
                        result,
                        log: result?.log
                    });

                    showInfoModal('Kurulum Hatası', errorDetail, true);
                }
            } catch (err) {
                if (window.electronAPI.removeModuleDownloadProgressListeners) {
                    window.electronAPI.removeModuleDownloadProgressListeners();
                }
                if (window.electronAPI.removeModuleProgressListeners) {
                    window.electronAPI.removeModuleProgressListeners();
                }
                if (progressSec) progressSec.style.display = 'none';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Kurulumu Başlat';
                console.error('[MODULE_INSTALL_EXCEPTION]', err);
                showInfoModal('Hata', err.message || 'Beklenmeyen hata oluştu.', true);
            }
        });
    }
}
