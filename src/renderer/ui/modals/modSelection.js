import { state } from '../../state.js';
import { openModal, closeModal } from './base.js';
import { openModuleInstallModal, initModuleInstallModalListeners } from './moduleInstall.js';

export async function renderModSelectionModal(game) {
    if (!game) return;
    state.currentSelectedGame = game;

    const modModalGameName = document.getElementById('mod-modal-game-name');
    if (modModalGameName) modModalGameName.textContent = game.name;

    const imgEl = document.getElementById('mod-modal-game-cover');
    const placeholderEl = document.getElementById('mod-modal-game-cover-placeholder');
    if (imgEl && placeholderEl) {
        if (game.cover) {
            imgEl.src = game.cover;
            imgEl.style.display = 'block';
            placeholderEl.style.display = 'none';
        } else {
            imgEl.style.display = 'none';
            placeholderEl.style.display = 'flex';
        }
    }

    const techContainer = document.getElementById('mod-modal-game-techs');
    if (techContainer) {
        let techHtml = '';
        if (game.upscalers) {
            if (game.upscalers.dlss) techHtml += '<span class="utag utag-dlss">DLSS</span>';
            if (game.upscalers.xess) techHtml += '<span class="utag utag-xess">XeSS</span>';
            if (game.upscalers.fsr) techHtml += '<span class="utag utag-fsr">FSR</span>';
        }
        if (!techHtml) {
            if (game.hasDlssEnabler || game.isDlssSupported) {
                techHtml += '<span class="utag utag-dlss">DLSS</span>';
            }
        }
        techContainer.innerHTML = techHtml;
    }

    const gridContainer = document.getElementById('mod-modal-options-grid');
    if (!gridContainer) {
        openModal('mod-modal');
        return;
    }

    gridContainer.innerHTML = `
        <div class="mod-options-loading" style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-secondary); font-size: 13px;">
            Modüller taranıyor...
        </div>
    `;

    openModal('mod-modal');

    try {
        let modules = [];
        if (window.electronAPI && window.electronAPI.moduleList) {
            modules = await window.electronAPI.moduleList();
        }

        if (!modules || modules.length === 0) {
            gridContainer.innerHTML = `
                <div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px;">
                    Kullanılabilir mod bulunamadı.
                </div>
            `;
            return;
        }

        gridContainer.innerHTML = '';

        modules.forEach(mod => {
            const manifest = mod.manifest || {};
            const modId = mod.id;
            const modName = manifest.name || modId;
            const modDesc = manifest.description || '';
            const modType = mod.type || 'official';

            // Check if installed on current game
            let isInstalled = false;
            let installedVersion = null;

            if (manifest.state?.flag && game[manifest.state.flag]) {
                isInstalled = true;
                if (manifest.state.versionField && game[manifest.state.versionField]) {
                    installedVersion = game[manifest.state.versionField];
                }
            } else if (modId === 'dlssenabler' && (game.hasDlssEnabler || game.dlssEnablerVersion)) {
                isInstalled = true;
                installedVersion = game.dlssEnablerVersion;
            } else if (modId === 'optiscaler' && (game.hasOptiscaler || game.optiscalerVersion)) {
                isInstalled = true;
                installedVersion = game.optiscalerVersion;
            } else if (modId === 'optibuilder' && (game.hasOptiBuilder || game.optiBuilderVersion)) {
                isInstalled = true;
                installedVersion = game.optiBuilderVersion;
            } else if (modId === 'streamline' && (game.hasStreamline || game.streamlineVersion)) {
                isInstalled = true;
                installedVersion = game.streamlineVersion;
            }

            const typeBadgeText = modType === 'official' ? '🛡️ Resmi' : (modType === 'community' ? '👥 Topluluk' : '⚡ Özel');

            const card = document.createElement('div');
            card.className = `mod-option-card ${isInstalled ? 'installed' : ''}`;
            card.innerHTML = `
                <div>
                    <div class="mod-option-card-header">
                        <span class="mod-option-name" title="${modName}">${modName}</span>
                        <span class="mod-card-badge badge-${modType}">${typeBadgeText}</span>
                    </div>
                    <div class="mod-option-desc" title="${modDesc}">${modDesc || 'Özel modül paketi.'}</div>
                </div>
                <div class="mod-option-footer">
                    ${isInstalled ? `<span class="mod-card-installed-status">✓ Kurulu ${installedVersion ? `(${installedVersion})` : ''}</span>` : `<span style="color: var(--text-secondary);">Kurulum Yap</span>`}
                    <span style="font-size: 13px;">➔</span>
                </div>
            `;

            card.addEventListener('click', () => {
                closeModal('mod-modal');
                openModuleInstallModal(mod, game);
            });

            gridContainer.appendChild(card);
        });

    } catch (e) {
        gridContainer.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: #ef4444; font-size: 13px;">
                Modüller yüklenirken hata oluştu: ${e.message}
            </div>
        `;
    }
}

export function initModSelectionListeners() {
    initModuleInstallModalListeners();

    const newModBtn = document.getElementById('mod-modal-new-btn');
    if (newModBtn) {
        newModBtn.addEventListener('click', () => {
            closeModal('mod-modal');
            const manifestsNavBtn = document.querySelector('[data-tab="manifests"]');
            if (manifestsNavBtn) {
                manifestsNavBtn.click();
            }
        });
    }
}
