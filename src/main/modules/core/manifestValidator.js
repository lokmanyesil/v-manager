'use strict';

function validate(manifest) {
    const errors = [];
    const warnings = [];

    if (!manifest || typeof manifest !== 'object') {
        return { valid: false, errors: ['Manifest must be a JSON object.'], warnings: [] };
    }

    // Required fields
    const requiredKeys = ['id', 'name', 'source', 'install'];
    for (const key of requiredKeys) {
        if (!manifest[key]) {
            errors.push(`Gerekli alan eksik: '${key}'`);
        }
    }

    // Validate id
    if (manifest.id) {
        if (typeof manifest.id !== 'string' || manifest.id.trim() === '') {
            errors.push("'id' boş olmayan bir string olmalıdır.");
        } else if (!/^[a-z0-9-]+$/.test(manifest.id)) {
            errors.push("'id' sadece küçük harfler, rakamlar ve kısa çizgi (kebab-case) içerebilir.");
        }
    }

    // Validate name
    if (manifest.name && typeof manifest.name !== 'string') {
        errors.push("'name' string olmalıdır.");
    }

    // Validate source
    if (manifest.source) {
        if (manifest.source.type !== 'github') {
            errors.push("'source.type' 'github' olmalıdır.");
        }
        if (!manifest.source.repo || typeof manifest.source.repo !== 'string' || !manifest.source.repo.includes('/')) {
            errors.push("'source.repo' 'owner/repo' formatında olmalıdır.");
        } else {
            const parts = manifest.source.repo.split('/');
            if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
                errors.push("'source.repo' 'owner/repo' formatında olmalıdır.");
            }
        }
        if (!manifest.source.asset || typeof manifest.source.asset !== 'string') {
            errors.push("'source.asset' string olarak belirtilmelidir.");
        }
    }

    // Validate install
    if (manifest.install) {
        if (!manifest.install.destination) {
            errors.push("Gerekli alan eksik: 'install.destination'");
        } else {
            const dest = manifest.install.destination;
            if (typeof dest === 'string') {
                if (dest !== 'game_root' && dest !== 'game_exe' && dest !== 'dynamic_search') {
                    errors.push("'install.destination' string ise 'game_root', 'game_exe' veya 'dynamic_search' olmalıdır.");
                }
            } else if (typeof dest === 'object' && !Array.isArray(dest)) {
                if (dest.type !== 'relative' || typeof dest.path !== 'string') {
                    errors.push("Obje olarak belirtilen 'install.destination' { type: 'relative', path: '...' } şeklinde olmalıdır.");
                }
            } else {
                errors.push("'install.destination' geçerli bir string veya obje olmalıdır.");
            }
        }

        // Validate detection if present
        if (manifest.install.detection) {
            const det = manifest.install.detection;
            if (typeof det !== 'object' || Array.isArray(det)) {
                errors.push("'install.detection' bir obje olmalıdır.");
            } else {
                if (det.files && (!Array.isArray(det.files) || det.files.length === 0)) {
                    errors.push("'install.detection.files' boş olmayan bir string dizisi olmalıdır.");
                }
                if (det.strategy && typeof det.strategy !== 'string') {
                    errors.push("'install.detection.strategy' string olmalıdır.");
                }
                if (det.fallback && typeof det.fallback !== 'string') {
                    errors.push("'install.detection.fallback' string olmalıdır.");
                }
                if (det.allowManualPicker !== undefined && typeof det.allowManualPicker !== 'boolean') {
                    errors.push("'install.detection.allowManualPicker' boolean olmalıdır.");
                }
                if (det.searchBase && det.searchBase !== 'game_root' && det.searchBase !== 'game_exe') {
                    errors.push("'install.detection.searchBase' 'game_root' veya 'game_exe' olmalıdır.");
                }
            }
        }

        // Validate whitelistFiles if present
        if (manifest.install.whitelistFiles !== undefined) {
            if (!Array.isArray(manifest.install.whitelistFiles)) {
                errors.push("'install.whitelistFiles' bir dizi (array) olmalıdır.");
            }
        }

        // Validate extractRoot if present
        if (manifest.install.extractRoot !== undefined && typeof manifest.install.extractRoot !== 'string') {
            errors.push("'install.extractRoot' string olmalıdır.");
        }

        // Validate refreshGameOnComplete if present
        if (manifest.install.refreshGameOnComplete !== undefined && typeof manifest.install.refreshGameOnComplete !== 'boolean') {
            errors.push("'install.refreshGameOnComplete' boolean olmalıdır.");
        }

        // Validate proxyDetection if present
        if (manifest.install.proxyDetection) {
            const pd = manifest.install.proxyDetection;
            if (typeof pd !== 'object' || Array.isArray(pd)) {
                errors.push("'install.proxyDetection' bir obje olmalıdır.");
            } else {
                if (!pd.sourceFile || typeof pd.sourceFile !== 'string') {
                    errors.push("'install.proxyDetection.sourceFile' string olmalıdır.");
                }
                if (!Array.isArray(pd.candidates) || pd.candidates.length === 0) {
                    errors.push("'install.proxyDetection.candidates' boş olmayan bir string dizisi olmalıdır.");
                }
                if (!pd.descriptionMatch || typeof pd.descriptionMatch !== 'string') {
                    errors.push("'install.proxyDetection.descriptionMatch' string olmalıdır.");
                }
                if (!pd.defaultTarget || typeof pd.defaultTarget !== 'string') {
                    errors.push("'install.proxyDetection.defaultTarget' string olmalıdır.");
                }
            }
        }

        // Validate verifyAntiVirusDelayMs if present
        if (manifest.install.verifyAntiVirusDelayMs !== undefined) {
            if (typeof manifest.install.verifyAntiVirusDelayMs !== 'number' || manifest.install.verifyAntiVirusDelayMs < 0) {
                errors.push("'install.verifyAntiVirusDelayMs' pozitif bir sayı olmalıdır.");
            }
        }

        // Validate cleanStaleVersionFiles if present
        if (manifest.install.cleanStaleVersionFiles !== undefined) {
            if (typeof manifest.install.cleanStaleVersionFiles !== 'boolean') {
                errors.push("'install.cleanStaleVersionFiles' boolean olmalıdır.");
            }
        }

        // Validate applyPresetOnInstall if present
        if (manifest.install.applyPresetOnInstall !== undefined) {
            if (typeof manifest.install.applyPresetOnInstall !== 'string' && typeof manifest.install.applyPresetOnInstall !== 'boolean') {
                errors.push("'install.applyPresetOnInstall' string veya boolean olmalıdır.");
            }
        }
    }

    // Validate root applyPresetOnInstall if present
    if (manifest.applyPresetOnInstall !== undefined) {
        if (typeof manifest.applyPresetOnInstall !== 'string' && typeof manifest.applyPresetOnInstall !== 'boolean') {
            errors.push("'applyPresetOnInstall' string veya boolean olmalıdır.");
        }
    }

    // Validate config
    if (manifest.config) {
        if (!Array.isArray(manifest.config)) {
            errors.push("'config' bir dizi (array) olmalıdır.");
        } else {
            manifest.config.forEach((cfg, idx) => {
                if (!cfg.file || typeof cfg.file !== 'string') {
                    errors.push(`'config[${idx}].file' string olarak belirtilmelidir.`);
                }
                if (cfg.format !== 'ini' && cfg.format !== 'json') {
                    errors.push(`'config[${idx}].format' 'ini' veya 'json' olmalıdır.`);
                }
                if (cfg.set !== undefined && (typeof cfg.set !== 'object' || Array.isArray(cfg.set))) {
                    errors.push(`'config[${idx}].set' geçerli bir ayar objesi olmalıdır.`);
                }
                if (!cfg.set && !cfg.schema) {
                    errors.push(`'config[${idx}]' için 'set' veya 'schema' alanlarından en az biri tanımlanmalıdır.`);
                }

                // Validate config schema
                if (cfg.schema !== undefined) {
                    if (typeof cfg.schema !== 'object' || Array.isArray(cfg.schema)) {
                        errors.push(`'config[${idx}].schema' bir obje olmalıdır.`);
                    } else {
                        for (const [secName, secObj] of Object.entries(cfg.schema)) {
                            if (typeof secObj !== 'object' || Array.isArray(secObj)) {
                                errors.push(`'config[${idx}].schema.${secName}' bir bölüm (section) objesi olmalıdır.`);
                                continue;
                            }
                            if (secObj.visibleIf !== undefined) {
                                if (typeof secObj.visibleIf !== 'object' || !secObj.visibleIf.flag) {
                                    errors.push(`'config[${idx}].schema.${secName}.visibleIf' geçerli bir koşul ({ flag, value }) olmalıdır.`);
                                }
                            }
                            for (const [keyName, keyDef] of Object.entries(secObj)) {
                                if (keyName === 'visibleIf') continue;
                                if (typeof keyDef !== 'object' || Array.isArray(keyDef)) {
                                    errors.push(`'config[${idx}].schema.${secName}.${keyName}' bir ayar tanım objesi olmalıdır.`);
                                    continue;
                                }
                                const validTypes = ['toggle', 'dropdown', 'slider', 'text'];
                                if (!keyDef.type || !validTypes.includes(keyDef.type)) {
                                    errors.push(`'config[${idx}].schema.${secName}.${keyName}.type' geçerli bir tip (${validTypes.join(', ')}) olmalıdır.`);
                                }
                                if (keyDef.visibleIf !== undefined) {
                                    if (typeof keyDef.visibleIf !== 'object' || !keyDef.visibleIf.flag) {
                                        errors.push(`'config[${idx}].schema.${secName}.${keyName}.visibleIf' geçerli bir koşul ({ flag, value }) olmalıdır.`);
                                    }
                                }
                            }
                        }
                    }
                }

                // Validate config presets
                if (cfg.presets !== undefined) {
                    if (typeof cfg.presets !== 'object' || Array.isArray(cfg.presets)) {
                        errors.push(`'config[${idx}].presets' bir obje olmalıdır.`);
                    } else {
                        for (const [pId, pObj] of Object.entries(cfg.presets)) {
                            if (typeof pObj !== 'object' || Array.isArray(pObj) || !pObj.values || typeof pObj.values !== 'object') {
                                errors.push(`'config[${idx}].presets.${pId}' geçerli bir 'values' objesi içermelidir.`);
                            }
                        }
                    }
                }
            });
        }
    }

    // Validate conditions
    if (manifest.conditions) {
        if (!Array.isArray(manifest.conditions)) {
            errors.push("'conditions' bir dizi (array) olmalıdır.");
        } else {
            manifest.conditions.forEach((cond, idx) => {
                if (!cond.type || typeof cond.type !== 'string') {
                    errors.push(`'conditions[${idx}].type' string olarak belirtilmelidir.`);
                }
                if (cond.enabled !== undefined && typeof cond.enabled !== 'boolean') {
                    errors.push(`'conditions[${idx}].enabled' boolean olmalıdır.`);
                }
            });
        }
    }

    // Validate backup
    if (manifest.backup) {
        if (typeof manifest.backup !== 'object' || Array.isArray(manifest.backup)) {
            errors.push("'backup' bir obje olmalıdır.");
        } else {
            if (manifest.backup.enabled !== undefined && typeof manifest.backup.enabled !== 'boolean') {
                errors.push("'backup.enabled' boolean olmalıdır.");
            }
            if (manifest.backup.strategy && typeof manifest.backup.strategy !== 'string') {
                errors.push("'backup.strategy' string olmalıdır ('folder', 'in_place_suffix' vb.).");
            }
            if (manifest.backup.suffix && typeof manifest.backup.suffix !== 'string') {
                errors.push("'backup.suffix' string olmalıdır (örn: '.backup').");
            }
            if (manifest.backup.recordHashes !== undefined && typeof manifest.backup.recordHashes !== 'boolean') {
                errors.push("'backup.recordHashes' boolean olmalıdır.");
            }
            if (manifest.backup.rollbackOnFailure !== undefined && typeof manifest.backup.rollbackOnFailure !== 'boolean') {
                errors.push("'backup.rollbackOnFailure' boolean olmalıdır.");
            }
        }
    }

    // Validate uninstall
    if (manifest.uninstall) {
        if (typeof manifest.uninstall !== 'object' || Array.isArray(manifest.uninstall)) {
            errors.push("'uninstall' bir obje olmalıdır.");
        } else {
            if (manifest.uninstall.files && !Array.isArray(manifest.uninstall.files)) {
                errors.push("'uninstall.files' bir dizi (array) olmalıdır.");
            }
            if (manifest.uninstall.strategy && typeof manifest.uninstall.strategy !== 'string') {
                errors.push("'uninstall.strategy' string olmalıdır.");
            }
            if (manifest.uninstall.suffix && typeof manifest.uninstall.suffix !== 'string') {
                errors.push("'uninstall.suffix' string olmalıdır.");
            }
            if (manifest.uninstall.gameUpdatedCheck !== undefined && typeof manifest.uninstall.gameUpdatedCheck !== 'boolean') {
                errors.push("'uninstall.gameUpdatedCheck' boolean olmalıdır.");
            }
            if (manifest.uninstall.cleanModOnlyFiles !== undefined && typeof manifest.uninstall.cleanModOnlyFiles !== 'boolean') {
                errors.push("'uninstall.cleanModOnlyFiles' boolean olmalıdır.");
            }
            if (manifest.uninstall.verifiedDlls) {
                if (!Array.isArray(manifest.uninstall.verifiedDlls)) {
                    errors.push("'uninstall.verifiedDlls' bir dizi (array) olmalıdır.");
                } else {
                    manifest.uninstall.verifiedDlls.forEach((vd, idx) => {
                        if (!Array.isArray(vd.candidates) || vd.candidates.length === 0) {
                            errors.push(`'uninstall.verifiedDlls[${idx}].candidates' string dizisi olmalıdır.`);
                        }
                        if (!vd.descriptionMatch || typeof vd.descriptionMatch !== 'string') {
                            errors.push(`'uninstall.verifiedDlls[${idx}].descriptionMatch' string olmalıdır.`);
                        }
                    });
                }
            }
            if (manifest.uninstall.restoreBackup !== undefined && typeof manifest.uninstall.restoreBackup !== 'boolean') {
                errors.push("'uninstall.restoreBackup' boolean olmalıdır.");
            }
        }
    }

    // Validate wizard
    if (manifest.wizard) {
        if (typeof manifest.wizard !== 'object' || Array.isArray(manifest.wizard)) {
            errors.push("'wizard' bir obje olmalıdır.");
        } else {
            const wiz = manifest.wizard;
            if (!wiz.type || (wiz.type !== 'auto_test' && wiz.type !== 'guided_install')) {
                errors.push("'wizard.type' 'auto_test' veya 'guided_install' olmalıdır.");
            }
            if (wiz.title && typeof wiz.title !== 'string') {
                errors.push("'wizard.title' string olmalıdır.");
            }
            if (wiz.description && typeof wiz.description !== 'string') {
                errors.push("'wizard.description' string olmalıdır.");
            }
            if (wiz.applyPresetOnSuccess && typeof wiz.applyPresetOnSuccess !== 'string') {
                errors.push("'wizard.applyPresetOnSuccess' string olmalıdır.");
            }

            // auto_test type validations
            if (wiz.type === 'auto_test') {
                if (!wiz.autoTest || typeof wiz.autoTest !== 'object' || Array.isArray(wiz.autoTest)) {
                    errors.push("'wizard.autoTest' bir obje olmalıdır.");
                } else {
                    const at = wiz.autoTest;
                    if (!at.sourceFile || typeof at.sourceFile !== 'string') {
                        errors.push("'wizard.autoTest.sourceFile' string olmalıdır.");
                    }
                    if (!Array.isArray(at.candidates) || at.candidates.length === 0) {
                        errors.push("'wizard.autoTest.candidates' boş olmayan bir string dizisi olmalıdır.");
                    }
                    if (!at.watchFile || typeof at.watchFile !== 'string') {
                        errors.push("'wizard.autoTest.watchFile' string olmalıdır.");
                    }
                    if (at.timeoutSeconds !== undefined && (typeof at.timeoutSeconds !== 'number' || at.timeoutSeconds <= 0)) {
                        errors.push("'wizard.autoTest.timeoutSeconds' pozitif bir sayı olmalıdır.");
                    }
                    if (at.watchLocation !== undefined && at.watchLocation !== 'game_exe' && at.watchLocation !== 'game_root') {
                        errors.push("'wizard.autoTest.watchLocation' 'game_exe' veya 'game_root' olmalıdır.");
                    }
                    if (at.checkProcessRunning !== undefined && typeof at.checkProcessRunning !== 'boolean') {
                        errors.push("'wizard.autoTest.checkProcessRunning' boolean olmalıdır.");
                    }
                    if (at.autoTerminateGame !== undefined && typeof at.autoTerminateGame !== 'boolean') {
                        errors.push("'wizard.autoTest.autoTerminateGame' boolean olmalıdır.");
                    }
                }
            }
        }
    }

    // Unknown keys warnings
    const allowedKeys = [
        'id', 'name', 'source', 'install', 'description', 'author', 'version',
        'minVManagerVersion', 'config', 'conditions', 'backup', 'state',
        'uninstall', 'permissions', 'metadata', 'wizard'
    ];

    for (const key of Object.keys(manifest)) {
        if (!allowedKeys.includes(key)) {
            warnings.push(`Bilinmeyen anahtar tespit edildi: '${key}'`);
        }
    }

    if (errors.length > 0) {
        console.error('[MANIFEST_VALIDATOR] Validasyon hataları bulundu:', errors);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

module.exports = {
    validate
};
