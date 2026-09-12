/**
 * api_adapter.js — Faz 0
 *
 * Renderer kodu window.electronAPI.xxx() şeklinde çağrı yapar.
 * Bu dosya o arayüzü Tauri v2 IPC'ye bağlar.
 *
 * KURAL: Bir IPC çağrısı henüz Rust'a taşınmadıysa, sessizce null
 * dönmek yasak. Her stub açıkça konsola hata basar ve bir
 * reddedilmiş Promise döner — böylece UI'da "neden çalışmıyor"
 * sorusu hemen yanıtlanabilir.
 *
 * Faz 0'da GERÇEK olan komut: get_app_version
 * Diğer her şey STUB (sonraki fazlarda gerçekleştirilecek).
 */

// Tauri v2 invoke helper — window.__TAURI__ geç yüklenebilir,
// bu yüzden çağrı anında resolve ediyoruz.
function tauriInvoke(cmd, args) {
    if (typeof window.__TAURI__ === 'undefined' || typeof window.__TAURI__.core === 'undefined') {
        const msg = `[V-Manager] TAURI BRIDGE HATASI: window.__TAURI__.core bulunamadı. ` +
                    `Uygulama Tauri context dışında mı çalışıyor? Komut: ${cmd}`;
        console.error(msg);
        return Promise.reject(new Error(msg));
    }
    return window.__TAURI__.core.invoke(cmd, args);
}

// Henüz Rust'a taşınmamış bir komut çağrıldığında görünür hata üretir.
function stub(electronApiName, phase) {
    return function(...args) {
        const msg = `[V-Manager] STUB ÇAĞRISI: window.electronAPI.${electronApiName}() ` +
                    `henüz Rust'a taşınmadı (Faz ${phase} gerekli). Args: ` +
                    JSON.stringify(args).substring(0, 200);
        console.error(msg);
        return Promise.reject(new Error(msg));
    };
}

// Event listener stub — bu fonksiyonlar bir şey döndürmez,
// sadece konsola bildirim basar.
function eventStub(name, phase) {
    return function(callback) {
        console.warn(`[V-Manager] EVENT STUB: window.electronAPI.${name}() ` +
                     `Faz ${phase}'de uygulanacak. Listener kaydedilmedi.`);
    };
}

// Helper: Local file:// paths cannot be loaded directly in Chromium webview.
// Convert local file paths to Tauri asset protocol URLs (convertFileSrc).
function convertGameCovers(game) {
    if (!game) return game;
    if (Array.isArray(game)) {
        return game.map(convertGameCovers);
    }
    if (game.cover && typeof game.cover === 'string') {
        const c = game.cover;
        if (!c.startsWith('http://') && !c.startsWith('https://') && !c.startsWith('asset://') && !c.startsWith('http://asset.localhost')) {
            let rawPath = c.replace(/^file:\/\/\/?/, '');
            try { rawPath = decodeURIComponent(rawPath); } catch (_) {}
            if (window.__TAURI__?.core?.convertFileSrc) {
                game.cover = window.__TAURI__.core.convertFileSrc(rawPath);
            }
        }
    }
    return game;
}

// ── window.electronAPI tanımı ────────────────────────────────────────────────
window.electronAPI = {

    // ── FAZ 0: GERÇEK KOMUTLAR ──────────────────────────────────────────────

    /**
     * Uygulamanın sürüm numarasını Rust backend'den alır.
     * Uçtan uca IPC hattını doğrulamak için kullanılır.
     * Tauri komutu: get_app_version (snake_case)
     */
    getAppVersion: () => tauriInvoke('get_app_version'),

    // ── FAZ 1: GERÇEK KOMUTLAR — Config & Kullanıcı Verisi ────────────────

    /** Ayarları Rust backend'den okur. */
    getSettings: () => tauriInvoke('get_settings'),

    /** Ayarları Rust backend'e yazar. Pencere boyutunu da günceller. */
    saveSettings: (settings) => tauriInvoke('save_settings', { settings }),

    /** games.json içeriğini döner (tarama sonucu oyun listesi). */
    getGames: () => tauriInvoke('get_games').then(convertGameCovers),

    /** user-games.json içeriğini döner (elle eklenen oyunlar). */
    getUserGames: () => tauriInvoke('get_user_games'),

    /** user-games.json'a bir oyun ekler/günceller. */
    saveUserGame: (data) => tauriInvoke('save_user_game', {
        gameName: data.gameName,
        gameRoot: data.gameRoot,
        exePath: data.exePath ?? null,
    }),

    /** user-games.json'dan bir oyunu normKey'e göre siler. */
    deleteUserGame: (normKey) => tauriInvoke('delete_user_game', { normKey }),

    /** custom-folders.json içeriğini döner. */
    getCustomFolders: () => tauriInvoke('get_custom_folders'),

    /** custom-folders.json'a yazar. */
    saveCustomFolders: (folders) => tauriInvoke('save_custom_folders', { folders }),

    /** Özel klasörlerin alt dizinlerini checkbox state'iyle döner. */
    getCustomSubfoldersList: () => tauriInvoke('get_custom_subfolders_list'),

    /** Özel alt klasör state'ini kaydeder. */
    saveCustomSubfoldersList: (subfolders) => tauriInvoke('save_custom_subfolders_list', { subfolders }),

    /** developer-games.json içeriğini döner (read-only). */
    getDeveloperGames: () => tauriInvoke('get_developer_games'),

    /** dlss_enabler_games.json içeriğini döner (read-only). */
    getDlssEnablerGames: () => tauriInvoke('get_dlss_enabler_games'),

    /** Oyunun favori durumunu toggle eder, güncel listeyi döner. */
    toggleFavorite: (gameName) => tauriInvoke('toggle_favorite', { gameName }),

    /** Semver lite karşılaştırma: -1/0/1 döner. */
    compareVersions: (v1, v2) => tauriInvoke('compare_versions', { v1, v2 }),

    /** Manuel oyun ekleme dialogu — klasör seçici açar. */
    addManualGame: () => tauriInvoke('add_manual_game'),

    /** Manuel oyunu Rust backend'e kaydeder. */
    saveManualGame: (data) => tauriInvoke('save_manual_game', {
        name: data.name,
        gameRoot: data.gameRoot,
        exePath: data.exePath ?? null,
    }).then(convertGameCovers),

    /** Oyunu games.json ve user-games.json'dan siler. */
    removeGame: (gameName) => tauriInvoke('remove_game', { gameName }),

    /** blacklist.json içeriğini döner. */
    getBlacklist: () => tauriInvoke('get_blacklist'),

    /** Oyunu blacklist'e ekler ve listelerden kaldırır. */
    addToBlacklist: (gameName) => tauriInvoke('add_to_blacklist', { gameName }),

    /** Oyunu blacklist'ten çıkarır. */
    removeFromBlacklist: (gameName) => tauriInvoke('remove_from_blacklist', { gameName }),

    /** Dual-layer yol çözümleme: { game_root, exe_path, source } döner. */
    resolveGamePaths: (gameName, exePath) => tauriInvoke('resolve_game_paths', {
        gameName,
        exePath: exePath ?? null,
    }),

    // ── FAZ 2: GERÇEK KOMUTLAR & EVENT LISTENERS — Oyun Tarama ──────────────

    /** Tarama işlemini başlatır. */
    startScan: (scanSettings) => tauriInvoke('start_scan', { scanSettings }),

    /** Oyun bulunduğunda tetiklenen olay dinleyicisi. */
    onGameFound: (callback) => {
        if (window.__TAURI__?.event?.listen) {
            window.__TAURI__.event.listen('game-found', (event) => callback(convertGameCovers(event.payload)));
        } else {
            console.warn('[V-Manager] Event listener dev ortamında: game-found');
        }
    },

    /** Tarama ilerleme yüzdesi (0-100) olay dinleyicisi. */
    onScanProgress: (callback) => {
        if (window.__TAURI__?.event?.listen) {
            window.__TAURI__.event.listen('scan-progress', (event) => callback(event.payload));
        } else {
            console.warn('[V-Manager] Event listener dev ortamında: scan-progress');
        }
    },

    /** Tarama tamamlandığında tetiklenen olay dinleyicisi. */
    onScanComplete: (callback) => {
        if (window.__TAURI__?.event?.listen) {
            window.__TAURI__.event.listen('scan-complete', (event) => callback(event.payload));
        } else {
            console.warn('[V-Manager] Event listener dev ortamında: scan-complete');
        }
    },

    /** Sistem sürücülerini listeler (C:, D: vb.). */
    getSystemDrives: () => tauriInvoke('get_system_drives'),

    /** Native klasör seçici dialogunu açar. */
    selectFolder: () => tauriInvoke('select_folder'),

    /** Native .exe dosya seçici dialogunu açar. */
    selectExe: () => tauriInvoke('select_exe'),

    /** Klasördeki EXE'leri tarar. */
    scanFolderForExes: (folderPath) => tauriInvoke('scan_folder_for_exes', { folderPath }),

    /** Klasördeki oyun bilgisini döner. */
    getFolderGameInfo: () => Promise.resolve({ isGame: false }),

    // ── FAZ 3: GERÇEK KOMUTLAR — Mod Yönetimi & Wizard & Releases ────────────
    getDlssVersions:                () => tauriInvoke('get_dlss_versions'),
    executeDlssInstall:             (data) => { console.log('[V-Manager] executeDlssInstall:', data); return tauriInvoke('execute_dlss_install', { data }); },
    autoInstallDlss:                (data) => { console.log('[V-Manager] autoInstallDlss:', data); return tauriInvoke('auto_install_dlss', { data }); },
    dlssParseZip:                   (zipPath) => tauriInvoke('dlss_parse_zip', { zipPath }),
    dlssInstallFromZip:             (gameName, zipPath) => tauriInvoke('dlss_install_from_zip', { gameName, zipPath }),
    getDlssEnablerReleases:         (forceRefresh) => tauriInvoke('get_dlss_enabler_releases', { forceRefresh }),
    downloadDlssEnablerRelease:     (data, url) => {
        const version = typeof data === 'object' ? (data.name || data.tag) : data;
        const downloadUrl = typeof data === 'object' ? data.downloadUrl : url;
        console.log('[V-Manager] downloadDlssEnablerRelease:', { version, downloadUrl });
        return tauriInvoke('download_dlss_enabler_release', { version, downloadUrl });
    },
    onDlssEnablerDownloadProgress:  (callback) => {
        if (window.__TAURI__?.event?.listen) {
            window.__TAURI__.event.listen('dlss-enabler-download-progress', (e) => {
                console.log('[V-Manager] dlss-enabler-download-progress:', e.payload);
                callback(e.payload);
            });
        }
    },
    removeDlssEnablerProgressListeners: () => {},
    getStreamlineVersions:          () => tauriInvoke('get_streamline_versions'),
    checkStreamlineBackup:          (gameName) => tauriInvoke('check_streamline_backup', { gameName }),
    installStreamline:              (data) => { console.log('[V-Manager] installStreamline:', data); return tauriInvoke('install_streamline', { data }); },
    restoreStreamline:              (gameName) => tauriInvoke('restore_streamline', { gameName }),
    getStreamlineReleases:          (forceRefresh) => tauriInvoke('get_streamline_releases', { forceRefresh }),
    downloadStreamlineRelease:      (data, url) => {
        const version = typeof data === 'object' ? (data.tag || data.name) : data;
        const downloadUrl = typeof data === 'object' ? data.downloadUrl : url;
        console.log('[V-Manager] downloadStreamlineRelease:', { version, downloadUrl });
        return tauriInvoke('download_streamline_release', { version, downloadUrl });
    },
    onStreamlineDownloadProgress:   (callback) => {
        if (window.__TAURI__?.event?.listen) {
            window.__TAURI__.event.listen('streamline-download-progress', (e) => {
                console.log('[V-Manager] streamline-download-progress:', e.payload);
                callback(e.payload);
            });
        }
    },
    removeStreamlineProgressListeners: () => {},
    getOptiScalerReleases:          (forceRefresh) => tauriInvoke('get_optiscaler_releases', { forceRefresh }),
    downloadOptiScalerRelease:      (data, url) => {
        const version = typeof data === 'object' ? (data.tag || data.name) : data;
        const downloadUrl = typeof data === 'object' ? data.downloadUrl : url;
        console.log('[V-Manager] downloadOptiScalerRelease:', { version, downloadUrl });
        return tauriInvoke('download_optiscaler_release', { version, downloadUrl });
    },
    onOptiscalerDownloadProgress:   (callback) => {
        if (window.__TAURI__?.event?.listen) {
            window.__TAURI__.event.listen('optiscaler-download-progress', (e) => {
                console.log('[V-Manager] optiscaler-download-progress:', e.payload);
                callback(e.payload);
            });
        }
    },
    removeOptiScalerProgressListeners: () => {},
    installOptiscaler:              (data) => { console.log('[V-Manager] installOptiscaler:', data); return tauriInvoke('install_optiscaler', { data }); },
    getOptiBuilderReleases:         (forceRefresh) => tauriInvoke('get_optibuilder_releases', { forceRefresh }),
    downloadOptiBuilderRelease:     (data, url) => {
        const version = typeof data === 'object' ? (data.tag || data.name) : data;
        const downloadUrl = typeof data === 'object' ? data.downloadUrl : url;
        console.log('[V-Manager] downloadOptiBuilderRelease:', { version, downloadUrl });
        return tauriInvoke('download_optibuilder_release', { version, downloadUrl });
    },
    onOptiBuilderDownloadProgress:  (callback) => {
        if (window.__TAURI__?.event?.listen) {
            window.__TAURI__.event.listen('optibuilder-download-progress', (e) => {
                console.log('[V-Manager] optibuilder-download-progress:', e.payload);
                callback(e.payload);
            });
        }
    },
    removeOptiBuilderProgressListeners: () => {},
    installOptiBuilder:             (data) => { console.log('[V-Manager] installOptiBuilder:', data); return tauriInvoke('install_opti_builder', { data }); },
    getOptiPatcherReleases:         (forceRefresh) => tauriInvoke('get_optipatcher_releases', { forceRefresh }),
    downloadOptiPatcherRelease:     (data, url) => {
        const version = typeof data === 'object' ? (data.tag || data.name) : data;
        const downloadUrl = typeof data === 'object' ? data.downloadUrl : url;
        console.log('[V-Manager] downloadOptiPatcherRelease:', { version, downloadUrl });
        return tauriInvoke('download_optipatcher_release', { version, downloadUrl });
    },
    onOptipatcherDownloadProgress:  (callback) => {
        if (window.__TAURI__?.event?.listen) {
            window.__TAURI__.event.listen('optipatcher-download-progress', (e) => {
                console.log('[V-Manager] optipatcher-download-progress:', e.payload);
                callback(e.payload);
            });
        }
    },
    removeOptiPatcherProgressListeners: () => {},
    getFsr4Releases:                (forceRefresh) => tauriInvoke('get_fsr4_releases', { forceRefresh }),
    downloadFsr4Release:            (data, url) => {
        const version = typeof data === 'object' ? (data.name || data.tag) : data;
        const downloadUrl = typeof data === 'object' ? data.downloadUrl : url;
        console.log('[V-Manager] downloadFsr4Release:', { version, downloadUrl });
        return tauriInvoke('download_fsr4_release', { version, downloadUrl });
    },
    onFsr4DownloadProgress:         (callback) => {
        if (window.__TAURI__?.event?.listen) {
            window.__TAURI__.event.listen('fsr4-download-progress', (e) => {
                console.log('[V-Manager] fsr4-download-progress:', e.payload);
                callback(e.payload);
            });
        }
    },
    removeFsr4ProgressListeners:    () => {},
    readModIni:                     () => Promise.resolve({ success: true, content: "" }),
    writeModIni:                    () => Promise.resolve({ success: true }),
    readModPresets:                 () => Promise.resolve({ success: true, presets: {} }),
    writeModPresets:                () => Promise.resolve({ success: true }),
    uninstallMod:                   (data) => tauriInvoke('uninstall_mod', { gameName: data.gameName, exePath: data.exePath, modName: data.mod }),
    deleteModVersion:               (data) => { console.log('[V-Manager] deleteModVersion:', data); return tauriInvoke('delete_mod_version', { modName: data.modName, name: data.name || null, tag: data.tag || null }); },
    openModFolder:                  (data) => { console.log('[V-Manager] openModFolder:', data); return tauriInvoke('open_mod_folder', { modName: data.modName, name: data.name || null, tag: data.tag || null }); },
    checkDx12Support:               (exePath) => tauriInvoke('check_dx12_support', { exePath }),
    runDlssWizard:                  (gameName) => tauriInvoke('run_dlss_wizard', { gameName }),
    abortDlssWizard:                () => tauriInvoke('abort_dlss_wizard'),
    clearWizardLogs:                () => tauriInvoke('clear_wizard_logs'),
    getWizardLogsInfo:              () => tauriInvoke('get_wizard_logs_info'),
    openWizardLogsDir:              () => tauriInvoke('open_wizard_logs_dir'),
    onWizardLog:                    (callback) => { if (window.__TAURI__?.event?.listen) window.__TAURI__.event.listen('dlss-wizard-log', (e) => callback(e.payload)); },
    removeWizardLogListeners:       () => {},
    runOptiWizard:                  (gameName) => tauriInvoke('run_opti_wizard', { gameName }),
    abortOptiWizard:                () => tauriInvoke('abort_opti_wizard'),
    onOptiWizardLog:                (callback) => { if (window.__TAURI__?.event?.listen) window.__TAURI__.event.listen('opti-wizard-log', (e) => callback(e.payload)); },
    removeOptiWizardLogListeners:   () => {},
    runOptiBuilderWizard:           (gameName) => tauriInvoke('run_opti_builder_wizard', { gameName }),
    abortOptiBuilderWizard:         () => tauriInvoke('abort_opti_builder_wizard'),
    onOptiBuilderWizardLog:         (callback) => { if (window.__TAURI__?.event?.listen) window.__TAURI__.event.listen('optibuilder-wizard-log', (e) => callback(e.payload)); },
    removeOptiBuilderWizardLogListeners: () => {},
    launchGame:                     () => Promise.resolve({ success: true }),
    isGameRunning:                  (exePath) => tauriInvoke('is_game_running', { exePath }),

    // ── FAZ 4'DE UYGULANACAK: Sıkıştırma ──────────────────────────────────
    analyzeFolder:                  stub('analyzeFolder', 4),
    runCompression:                 stub('runCompression', 4),
    runUncompression:               stub('runUncompression', 4),
    onCompressionProgress:          eventStub('onCompressionProgress', 4),
    removeCompressionProgressListeners: () => {},
    getCompressionHistory:          stub('getCompressionHistory', 4),
    removeHistoryEntry:             stub('removeHistoryEntry', 4),
    clearCompressionHistory:        stub('clearCompressionHistory', 4),

    // ── FAZ 5'DE UYGULANACAK: Discord, Updater, Harici Bağlantılar ─────────
    fetchYoutubeVideos:             stub('fetchYoutubeVideos', 5),
    fetchFreeGames:                 stub('fetchFreeGames', 5),
    openExternalLink:               (url) => {
        // Faz 5'e kadar güvenli bir fallback: tarayıcıda aç
        console.warn(`[V-Manager] openExternalLink stub: ${url} — Faz 5\'de native olacak.`);
    },
    fetchAllReleases:               stub('fetchAllReleases', 5),
    checkForUpdatesManual:          stub('checkForUpdatesManual', 5),
    startUpdateDownload:            () => {
        console.warn('[V-Manager] STUB: startUpdateDownload() Faz 5\'de uygulanacak.');
    },
    quitAndInstall:                 () => {
        console.warn('[V-Manager] STUB: quitAndInstall() Faz 5\'de uygulanacak.');
    },
    onShowCloseWarning:             eventStub('onShowCloseWarning', 5),
    onUpdateChecking:               eventStub('onUpdateChecking', 5),
    onUpdateAvailable:              eventStub('onUpdateAvailable', 5),
    onUpdateNotAvailable:           eventStub('onUpdateNotAvailable', 5),
    onUpdateDownloadProgress:       eventStub('onUpdateDownloadProgress', 5),
    onUpdateDownloaded:             eventStub('onUpdateDownloaded', 5),
    onUpdateError:                  eventStub('onUpdateError', 5),
    removeUpdateListeners:          () => {},
    onDiscordRpcError:              eventStub('onDiscordRpcError', 5),
    removeDiscordRpcErrorListeners: () => {},
    getSystemInfo:                  stub('getSystemInfo', 5),

    // ── Her zaman no-op olan yardımcılar ────────────────────────────────────
    // Tauri'de log → konsol doğrudan gittiği için bu artık basit bir wrapper.
    logToMain: (msg) => console.log('[renderer]', msg),
};

console.info('[V-Manager] api_adapter.js yüklendi — Faz 3 aktif. ' +
             'Config, Oyun Tarama & Mod Yönetimi komutları gerçek; Faz 4+ stub\'dır.');
