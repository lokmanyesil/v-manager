import { t } from '../i18n/i18n.js';
import { showRefreshWarning, formatCacheAge } from './modals/cacheHelpers.js';
import { showInfoModal, showConfirmDialog } from './modals/info.js';

// Controller State
let currentMod = 'dlssenabler'; // default mod tab
let releasesData = {}; // cache release info per mod
let activeDownload = null; // { modName, tag, name, downloadUrl }
const downloadQueue = []; // array of queue items
const failedDownloads = {}; // key: modName-tag -> errorMsg

export function initModsTab() {
    // 1. Tab switches listeners
    const tabNav = document.getElementById('mods-tabs-nav');
    if (tabNav) {
        tabNav.addEventListener('click', async (e) => {
            const btn = e.target.closest('.mods-tab-btn');
            if (!btn) return;
            
            // Set active class
            tabNav.querySelectorAll('.mods-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const selectedMod = btn.getAttribute('data-mod');
            if (selectedMod && selectedMod !== currentMod) {
                currentMod = selectedMod;
                await loadModReleases(false);
            }
        });
    }

    // 2. Refresh button listener
    const refreshBtn = document.getElementById('mods-refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            showRefreshWarning(async () => {
                await loadModReleases(true);
            });
        });
    }

    // 3. Tab activation listener (from main navigation)
    document.addEventListener('tab-activated', async (e) => {
        if (e.detail && e.detail.tabId === 'modes') {
            await loadModReleases(false);
        }
    });
}

/**
 * Loads release versions for the active mod.
 * @param {boolean} forceRefresh - Bypasses cache if true
 * @param {boolean} silent - If true, skips loading skeleton render
 */
export async function loadModReleases(forceRefresh = false, silent = false) {
    const loadingDiv = document.getElementById('mods-loading');
    const container = document.getElementById('mods-versions-container');
    const cacheAgeSpan = document.getElementById('mods-cache-age');

    if (!silent) {
        if (loadingDiv) loadingDiv.style.display = 'block';
        if (container) container.style.display = 'none';
        if (cacheAgeSpan) cacheAgeSpan.textContent = '';
    }

    try {
        let result;
        if (currentMod === 'dlssenabler') {
            result = await window.electronAPI.getDlssEnablerReleases(forceRefresh);
        } else if (currentMod === 'optiscaler') {
            result = await window.electronAPI.getOptiScalerReleases(forceRefresh);
        } else if (currentMod === 'optibuilder') {
            result = await window.electronAPI.getOptiBuilderReleases(forceRefresh);
        } else if (currentMod === 'optipatcher') {
            result = await window.electronAPI.getOptiPatcherReleases(forceRefresh);
        } else if (currentMod === 'fsr4') {
            result = await window.electronAPI.getFsr4Releases(forceRefresh);
        } else if (currentMod === 'streamline') {
            result = await window.electronAPI.getStreamlineReleases(forceRefresh);
        }

        if (result.error) throw new Error(result.error);

        const releases = result.releases ?? result;
        const fetchedAt = result.fetchedAt ?? null;
        const fromStaleCache = result.fromStaleCache ?? false;

        // Store in local data cache
        releasesData[currentMod] = {
            releases,
            fetchedAt,
            fromStaleCache
        };

        // Render versions
        renderReleases();

        // Update cache age span
        if (cacheAgeSpan && fetchedAt) {
            const ageText = formatCacheAge(fetchedAt);
            const staleText = fromStaleCache ? `[${t('releaseCache.fromStaleCache')}] ` : '';
            cacheAgeSpan.innerHTML = `${staleText}${t('releaseCache.lastUpdated')} <strong>${ageText}</strong>`;
        }

        if (loadingDiv) loadingDiv.style.display = 'none';
        if (container) container.style.display = 'grid';
    } catch (e) {
        console.error('[ModsTab] load error:', e);
        if (container) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #ef4444;">
                    ⚠️ ${t('opti.standaloneLoadError') || 'Sürümler yüklenemedi: '}${e.message}
                </div>
            `;
            if (loadingDiv) loadingDiv.style.display = 'none';
            if (container) container.style.display = 'block';
        }
    }
}

/**
 * Renders releases into the versions grid.
 */
function renderReleases() {
    const container = document.getElementById('mods-versions-container');
    if (!container) return;

    container.innerHTML = '';
    const activeData = releasesData[currentMod];
    if (!activeData || !activeData.releases || activeData.releases.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-secondary);">
                ${t('modsTab.noVersions')}
            </div>
        `;
        return;
    }

    activeData.releases.forEach(r => {
        const tag = r.tag || r.name;
        
        // Check size
        let sizeStr = '';
        if (r.size) {
            sizeStr = (r.size / (1024 * 1024)).toFixed(1) + ' MB';
        }

        // Check release date
        let dateStr = '';
        if (r.publishedAt) {
            try {
                const date = new Date(r.publishedAt);
                dateStr = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            } catch(e){}
        }

        // Create card element
        const card = document.createElement('div');
        card.className = `version-card ${r.installed ? 'active' : ''}`;
        card.setAttribute('data-card-mod', currentMod);
        card.setAttribute('data-card-tag', tag);

        card.innerHTML = `
            <div class="version-info">
                <div class="version-name">${r.name || tag}</div>
                <div class="version-meta">
                    ${sizeStr ? `<span class="version-size">${sizeStr}</span>` : ''}
                    ${sizeStr && dateStr ? '<span class="meta-dot">•</span>' : ''}
                    ${dateStr ? `<span class="version-date">${dateStr}</span>` : ''}
                </div>
                ${r.installed ? `<span class="version-badge active">✔ ${t('modsTab.installed')}</span>` : ''}
            </div>
            <div class="version-actions"></div>
        `;

        const actionsContainer = card.querySelector('.version-actions');
        
        // Render actions based on current download queue state
        const isCurrentActive = activeDownload && activeDownload.modName === currentMod && activeDownload.tag === tag;
        const queueIdx = downloadQueue.findIndex(item => item.modName === currentMod && item.tag === tag);
        const failMsg = failedDownloads[`${currentMod}-${tag}`];

        if (r.installed) {
            // Open Folder button
            const openBtn = document.createElement('button');
            openBtn.className = 'version-action-btn open-folder';
            openBtn.title = t('modsTab.openFolder');
            openBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
            openBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await window.electronAPI.openModFolder({ modName: currentMod, name: r.name, tag: r.tag });
            });

            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'version-action-btn delete';
            deleteBtn.title = t('modsTab.delete');
            deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                console.log('[mods-tab.js] deleteBtn click: modName =', currentMod, 'name =', r.name, 'tag =', r.tag, 'computed tag =', tag);
                const confirmed = await showConfirmDialog(
                    t('modsTab.deleteConfirmTitle') || 'Sürümü Sil',
                    (t('modsTab.deleteConfirmMsg') || '"{version}" sürümünü silmek istediğinize emin misiniz?').replace('{version}', r.name || tag)
                );
                if (confirmed) {
                    const delResult = await window.electronAPI.deleteModVersion({ modName: currentMod, name: r.name, tag: r.tag });
                    if (delResult.success) {
                        await loadModReleases(false, true); // reload list silently
                    } else {
                        showInfoModal(t('opti.errorTitle') || 'Hata', delResult.error || t('modsTab.deleteFailed') || 'Silme işlemi başarısız oldu.', true);
                    }
                }
            });

            actionsContainer.appendChild(openBtn);
            actionsContainer.appendChild(deleteBtn);
        } else if (isCurrentActive) {
            // Downloading state
            const progressSpan = document.createElement('span');
            progressSpan.className = 'version-action-btn downloading';
            progressSpan.textContent = activeDownload.progressText || '%0';
            actionsContainer.appendChild(progressSpan);
        } else if (queueIdx !== -1) {
            // Waiting in queue state
            const waitingBtn = document.createElement('button');
            waitingBtn.className = 'version-action-btn waiting';
            waitingBtn.title = t('modsTab.waitingTooltip');
            waitingBtn.textContent = t('modsTab.waiting');
            waitingBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromQueue(currentMod, tag);
            });
            actionsContainer.appendChild(waitingBtn);
        } else if (failMsg) {
            // Failed state, show Retry
            const retryBtn = document.createElement('button');
            retryBtn.className = 'version-action-btn retry-btn';
            retryBtn.title = t('modsTab.retryTooltip').replace('{error}', failMsg);
            retryBtn.textContent = t('modsTab.retry');
            retryBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Clear failure and add to queue
                delete failedDownloads[`${currentMod}-${tag}`];
                addToQueue(currentMod, r);
            });
            actionsContainer.appendChild(retryBtn);
        } else {
            // Default download button
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'version-action-btn download-btn';
            downloadBtn.title = t('modsTab.download');
            downloadBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>`;
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addToQueue(currentMod, r);
            });
            actionsContainer.appendChild(downloadBtn);
        }

        container.appendChild(card);
    });
}

/**
 * Adds an item to the download queue.
 */
function addToQueue(modName, release) {
    const tag = release.tag || release.name;
    // Prevent duplicate entries
    if (activeDownload && activeDownload.modName === modName && activeDownload.tag === tag) return;
    if (downloadQueue.some(item => item.modName === modName && item.tag === tag)) return;

    const queueItem = {
        modName,
        name: release.name,
        tag,
        downloadUrl: release.downloadUrl
    };

    if (!activeDownload) {
        startDownload(queueItem);
    } else {
        downloadQueue.push(queueItem);
        // Silent reload/refresh of tab view if current mod matches queue mod
        if (currentMod === modName) {
            renderReleases();
        }
    }
}

/**
 * Removes an item from the queue list.
 */
function removeFromQueue(modName, tag) {
    const idx = downloadQueue.findIndex(item => item.modName === modName && item.tag === tag);
    if (idx !== -1) {
        downloadQueue.splice(idx, 1);
        if (currentMod === modName) {
            renderReleases();
        }
    }
}

/**
 * Processes the next item in the download queue.
 */
function processQueue() {
    if (activeDownload || downloadQueue.length === 0) return;
    const nextItem = downloadQueue.shift();
    startDownload(nextItem);
}

/**
 * Starts download of a mod release and listens to dynamic progress.
 */
async function startDownload(item) {
    activeDownload = item;
    activeDownload.progressText = '%0';

    // Rerender tab to reflect active state
    if (currentMod === item.modName) {
        renderReleases();
    }

    const progressCallback = (data) => {
        if (activeDownload && activeDownload.modName === item.modName && activeDownload.tag === item.tag) {
            if (data.stage === 'extracting') {
                activeDownload.progressText = t('modsTab.extracting');
            } else {
                activeDownload.progressText = `%${data.percent || 0}`;
            }
            
            // Dynamically update UI if the card is currently visible
            const cardActions = document.querySelector(`[data-card-mod="${item.modName}"][data-card-tag="${item.tag}"] .version-actions`);
            if (cardActions) {
                const btn = cardActions.querySelector('.downloading');
                if (btn) {
                    btn.textContent = activeDownload.progressText;
                }
            }
        }
    };

    // Bind correct progress listener based on mod type
    if (item.modName === 'dlssenabler') {
        window.electronAPI.removeDlssEnablerProgressListeners();
        window.electronAPI.onDlssEnablerDownloadProgress(progressCallback);
    } else if (item.modName === 'optiscaler') {
        window.electronAPI.removeOptiScalerProgressListeners();
        window.electronAPI.onOptiscalerDownloadProgress(progressCallback);
    } else if (item.modName === 'optibuilder') {
        window.electronAPI.removeOptiBuilderProgressListeners();
        window.electronAPI.onOptiBuilderDownloadProgress(progressCallback);
    } else if (item.modName === 'optipatcher') {
        window.electronAPI.removeOptiPatcherProgressListeners();
        window.electronAPI.onOptipatcherDownloadProgress(progressCallback);
    } else if (item.modName === 'fsr4') {
        window.electronAPI.removeFsr4ProgressListeners();
        window.electronAPI.onFsr4DownloadProgress(progressCallback);
    } else if (item.modName === 'streamline') {
        window.electronAPI.removeStreamlineProgressListeners();
        window.electronAPI.onStreamlineDownloadProgress(progressCallback);
    }

    try {
        let result;
        if (item.modName === 'dlssenabler') {
            result = await window.electronAPI.downloadDlssEnablerRelease({ name: item.name, downloadUrl: item.downloadUrl });
        } else if (item.modName === 'optiscaler') {
            result = await window.electronAPI.downloadOptiScalerRelease({ tag: item.tag, downloadUrl: item.downloadUrl });
        } else if (item.modName === 'optibuilder') {
            result = await window.electronAPI.downloadOptiBuilderRelease({ tag: item.tag, downloadUrl: item.downloadUrl });
        } else if (item.modName === 'optipatcher') {
            result = await window.electronAPI.downloadOptiPatcherRelease({ tag: item.tag, downloadUrl: item.downloadUrl });
        } else if (item.modName === 'fsr4') {
            result = await window.electronAPI.downloadFsr4Release({ name: item.name, downloadUrl: item.downloadUrl });
        } else if (item.modName === 'streamline') {
            result = await window.electronAPI.downloadStreamlineRelease({ tag: item.tag, downloadUrl: item.downloadUrl });
        }

        cleanupProgressListeners(item.modName);

        if (result && result.success) {
            // Success! Remove from failed list if it was there
            delete failedDownloads[`${item.modName}-${item.tag}`];
            
            // Reload list silent to see installed folder
            if (currentMod === item.modName) {
                await loadModReleases(false, true);
            }
        } else {
            failedDownloads[`${item.modName}-${item.tag}`] = result ? result.error : t('updates.unknownError');
            if (currentMod === item.modName) {
                renderReleases();
            }
        }
    } catch (e) {
        cleanupProgressListeners(item.modName);
        failedDownloads[`${item.modName}-${item.tag}`] = e.message;
        if (currentMod === item.modName) {
            renderReleases();
        }
    } finally {
        activeDownload = null;
        // Process next item in queue
        processQueue();
    }
}

function cleanupProgressListeners(modName) {
    if (modName === 'dlssenabler') window.electronAPI.removeDlssEnablerProgressListeners();
    else if (modName === 'optiscaler') window.electronAPI.removeOptiScalerProgressListeners();
    else if (modName === 'optibuilder') window.electronAPI.removeOptiBuilderProgressListeners();
    else if (modName === 'optipatcher') window.electronAPI.removeOptiPatcherProgressListeners();
    else if (modName === 'fsr4') window.electronAPI.removeFsr4ProgressListeners();
    else if (modName === 'streamline') window.electronAPI.removeStreamlineProgressListeners();
}
