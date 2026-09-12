import { openModal, closeModal } from './base.js';
import { showInfoModal, showConfirmDialog } from './info.js';
import { renderGames, updateHomeStats } from '../games.js';
import { t, getCurrentLang } from '../../i18n/i18n.js';

const DLL_ORDER = ['version.dll', 'dxgi.dll', 'winmm.dll', 'dbghelp.dll', 'psapi.dll', 'winhttp.dll'];

let isWizardRunning = false;
let closeAttempts = 0;
let cancelRequested = false;
export function isDlssWizardRunning() {
    return isWizardRunning;
}
let hasStreamlineWarningPending = false;

export async function openWizardModal(game, version, dllName, exePath, downloadUrl) {
    if (isWizardRunning) return;
    closeAttempts = 0;
    cancelRequested = false;

    const wizardModal = document.getElementById('dlss-wizard-modal');
    const infoGame = document.getElementById('wizard-info-game');
    const infoExe = document.getElementById('wizard-info-exe');
    const infoPlatform = document.getElementById('wizard-info-platform');
    const infoVersion = document.getElementById('wizard-info-version');
    const infoDll = document.getElementById('wizard-info-dll');
    const logArea = document.getElementById('wizard-log-area');
    const dllListContainer = document.getElementById('wizard-dll-list');
    const statusText = document.getElementById('wizard-status-text');
    const spinner = document.getElementById('wizard-spinner');
    const finalBtn = document.getElementById('wizard-final-btn');

    if (!wizardModal) return;

    // Fill info fields
    if (infoGame) infoGame.textContent = game.name;
    if (infoExe) infoExe.textContent = exePath;
    if (infoPlatform) {
        const platform = game.source || 'manual';
        infoPlatform.textContent = platform.charAt(0).toUpperCase() + platform.slice(1);
    }
    if (infoVersion) infoVersion.textContent = version;
    if (infoDll) infoDll.textContent = dllName;

    // Reset log and DLL list
    if (logArea) logArea.innerHTML = '';
    if (dllListContainer) {
        dllListContainer.innerHTML = '';
        // DLL listesini oluştur (kullanıcının seçtiği ilk sırada olacak şekilde)
        const initialDll = dllName || 'version.dll';
        const dllsToTry = [initialDll, ...DLL_ORDER.filter(d => d !== initialDll)];
        
        dllsToTry.forEach((dll, idx) => {
            const item = document.createElement('div');
            item.className = 'wizard-dll-item';
            item.id = `wizard-dll-item-${dll.replace('.', '-')}`;
            item.innerHTML = `
                <span>[${idx + 1}/6] ${dll}</span>
                <span class="dll-status">-</span>
            `;
            dllListContainer.appendChild(item);
        });
    }

    // Set UI states
    if (statusText) statusText.textContent = t('wizard.stepInstall');
    if (spinner) spinner.style.display = 'block';
    if (finalBtn) finalBtn.style.display = 'none';

    isWizardRunning = true;
    hasStreamlineWarningPending = false;
    openModal('dlss-wizard-modal');

    // Remove old listeners
    if (window.electronAPI.removeWizardLogListeners) {
        window.electronAPI.removeWizardLogListeners();
    }

    // Setup live log listener
    window.electronAPI.onWizardLog((data) => {
        if (data.type === 'dll-attempt') {
            const { attemptIndex, dllName: currentDll, status: dllStatus } = data.data;
            const item = document.getElementById(`wizard-dll-item-${currentDll.replace('.', '-')}`);
            if (item) {
                // Clear state classes
                item.className = 'wizard-dll-item';
                const statusSpan = item.querySelector('.dll-status');

                if (dllStatus === 'trying') {
                    item.classList.add('active');
                    if (statusSpan) statusSpan.textContent = '→';
                    if (statusText) statusText.textContent = t('wizard.stepRetryDll').replace('{n}', attemptIndex).replace('{total}', '6').replace('{dll}', currentDll);
                } else if (dllStatus === 'ok') {
                    item.classList.add('ok');
                    if (statusSpan) statusSpan.textContent = '✅';
                } else if (dllStatus === 'failed') {
                    item.classList.add('failed');
                    if (statusSpan) statusSpan.textContent = '❌';
                }
            }
        } else if (data.type === 'waiting') {
            if (statusText) statusText.textContent = t('wizard.stepWaiting').replace('{n}', data.msg);
        } else {
            // Append line to terminal
            const line = document.createElement('div');
            line.className = `wizard-log-line ${data.type}`;
            line.textContent = data.msg;
            if (logArea) {
                logArea.appendChild(line);
                logArea.scrollTop = logArea.scrollHeight;
            }
        }
    });

    try {
        const result = await window.electronAPI.runDlssWizard({
            game,
            version,
            dllName,
            downloadUrl,
            developerPreset: 'dev-best',
            exePath,
            lang: getCurrentLang()
        });

        isWizardRunning = false;

        if (spinner) spinner.style.display = 'none';
        if (statusText) {
            const wasCancelled = result && result.error === 'ABORTED';
            statusText.textContent = result.success ? t('wizard.finalSuccess') : (wasCancelled ? (t('wizard.cancelled') || 'Iptal edildi') : t('wizard.finalError'));
        }
        if (finalBtn) finalBtn.style.display = 'block';

        if (result.success) {
            hasStreamlineWarningPending = true;
            if (result.games) {
                renderGames(result.games);
                updateHomeStats();
            }
        }
    } catch (err) {
        isWizardRunning = false;
        if (spinner) spinner.style.display = 'none';
        if (statusText) statusText.textContent = cancelRequested ? (t('wizard.cancelled') || 'Iptal edildi') : t('wizard.finalError');
        cancelRequested = false;
        if (finalBtn) finalBtn.style.display = 'block';

        const line = document.createElement('div');
        line.className = 'wizard-log-line err';
        line.textContent = `${t('opti.unexpectedError') || 'Beklenmeyen hata: '}${err.message}`;
        if (logArea) {
            logArea.appendChild(line);
            logArea.scrollTop = logArea.scrollHeight;
        }
    }
}

export async function closeWizardModal() {
    if (isWizardRunning) {
        const statusText = document.getElementById('wizard-status-text');
        if (cancelRequested) {
            showInfoModal(
                t('update.infoTitle') || (getCurrentLang() === 'en' ? 'Information' : 'Bilgi'),
                t('wizard.cancelling') || 'Iptal ediliyor...'
            );
            return;
        }

        const confirmCancel = await showConfirmDialog(
            t('wizard.cancelTitle') || (getCurrentLang() === 'en' ? 'Cancel Installation' : 'Kurulumu Iptal Et'),
            t('wizard.cancelMsg') || 'Kurulumu iptal etmek istiyor musunuz? Kopyalanan dosyalar kaldirilacak.'
        );
        if (confirmCancel) {
            cancelRequested = true;
            if (statusText) statusText.textContent = t('wizard.cancelling') || 'Iptal ediliyor...';
            await window.electronAPI.abortDlssWizard();
        }
        return;
    }

    closeAttempts = 0;
    cancelRequested = false;
    closeModal('dlss-wizard-modal');

    if (window.electronAPI.removeWizardLogListeners) {
        window.electronAPI.removeWizardLogListeners();
    }

    if (hasStreamlineWarningPending) {
        hasStreamlineWarningPending = false;
        // Show Streamline popup after closing the terminal
        setTimeout(() => {
            showInfoModal('Streamline', t('wizard.streamlineWarning'));
        }, 300);
    }
}

export function initWizardListeners() {
    const closeBtn = document.getElementById('wizard-close-btn');
    const finalBtn = document.getElementById('wizard-final-btn');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeWizardModal);
    }
    if (finalBtn) {
        finalBtn.addEventListener('click', closeWizardModal);
    }
}
