import { t } from '../i18n/i18n.js';

let isRefreshing = false;

export async function initSystemInfo() {
    const gpuVal = document.getElementById('sys-gpu');
    const cpuVal = document.getElementById('sys-cpu');
    const ramVal = document.getElementById('sys-ram');
    const dxCard = document.getElementById('dx12-status-card');
    const dxIcon = document.getElementById('dx12-icon');
    const dxTitle = document.getElementById('dx12-title');
    const dxDesc = document.getElementById('dx12-desc');
    const refreshBtn = document.getElementById('sys-refresh-btn');

    if (!gpuVal || !cpuVal || !ramVal) return;

    // Load function
    const loadInfo = async (force = false) => {
        if (isRefreshing) return;
        isRefreshing = true;

        if (refreshBtn) {
            refreshBtn.classList.add('spinning');
            refreshBtn.disabled = true;
        }

        // Show loading state
        gpuVal.textContent = t('compress.analyzing') || 'İnceleniyor...';
        cpuVal.textContent = t('compress.analyzing') || 'İnceleniyor...';
        ramVal.textContent = t('compress.analyzing') || 'İnceleniyor...';
        if (dxCard) {
            dxCard.className = 'dx12-status-card'; // reset classes
        }
        if (dxIcon) dxIcon.textContent = '⏳';
        if (dxTitle) dxTitle.textContent = t('systemInfo.checking') || 'Sistem Kontrol Ediliyor...';
        if (dxDesc) dxDesc.textContent = '-';

        try {
            const info = await window.electronAPI.getSystemInfo({ forceRefresh: force });
            if (info && info.success) {
                gpuVal.textContent = info.gpu || 'Bilinmiyor';
                cpuVal.textContent = info.cpu || 'Bilinmiyor';
                ramVal.textContent = info.ram || 'Bilinmiyor';

                if (dxCard) {
                    dxCard.className = 'dx12-status-card ' + (info.dx12Supported ? 'supported' : 'unsupported');
                }
                if (dxIcon) dxIcon.textContent = info.dx12Supported ? '✅' : '❌';

                if (info.dx12Supported) {
                    if (dxTitle) dxTitle.textContent = t('systemInfo.supportedTitle') || 'DirectX 12 Destekleniyor';
                    if (dxDesc) dxDesc.textContent = `${t('systemInfo.supportedDesc') || 'Ekran kartınız tüm modları destekliyor!'}`;
                } else {
                    if (dxTitle) dxTitle.textContent = t('systemInfo.unsupportedTitle') || 'DirectX 12 Desteklenmiyor';
                    if (dxDesc) dxDesc.textContent = t('systemInfo.unsupportedDesc') || 'Kartınız DX12 desteklemiyor. Sorunlar olabilir.';
                }
            } else {
                throw new Error(info ? info.error : 'Unknown error');
            }
        } catch (e) {
            console.error('[SystemInfo] Failed to fetch system info:', e);
            gpuVal.textContent = 'Bilinmiyor';
            cpuVal.textContent = 'Bilinmiyor';
            ramVal.textContent = 'Bilinmiyor';

            if (dxCard) {
                dxCard.className = 'dx12-status-card unsupported';
            }
            if (dxIcon) dxIcon.textContent = '⚠️';
            if (dxTitle) dxTitle.textContent = t('systemInfo.errorTitle') || 'Bilgi Alınamadı';
            if (dxDesc) dxDesc.textContent = t('systemInfo.errorDesc') || 'Sistem özellikleri sorgulanamadı.';
        } finally {
            isRefreshing = false;
            if (refreshBtn) {
                refreshBtn.classList.remove('spinning');
                refreshBtn.disabled = false;
            }
        }
    };

    // Listen to refresh button
    if (refreshBtn) {
        refreshBtn.onclick = () => loadInfo(true);
    }

    // Initial load (using memory cache if already resolved)
    await loadInfo(false);
}
