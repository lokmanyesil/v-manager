'use strict';

const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const config = require('../../config');
const utils = require('../../utils');
const archive = require('./archive');
const githubFetcher = require('./githubFetcher');
const configEditor = require('./configEditor');
const conditionChecker = require('./conditionChecker');
const backup = require('./backup');
const { createLogger } = require('./moduleLogger');
const manifestValidator = require('./manifestValidator');

const TAG = '[MODULE_ENGINE]';

function matchGlob(str, pattern) {
    if (!pattern) return true;
    const escapeRegex = (s) => s.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
    const regexRule = pattern.split('*').map(escapeRegex).join('.*');
    return new RegExp('^' + regexRule + '$', 'i').test(str);
}

/**
 * Motor seviyesi derinlemesine dosya arama (uninstaller.js ile aynı)
 */
function findFileInDir(rootDir, targetName, maxDepth = 5) {
    const found = [];
    const queue = [{ dir: rootDir, depth: 0 }];
    const visited = new Set();
    const ignoreDirs = ['data', 'shader', 'resource', 'asset', 'sound', 'audio', 'video', 'movie', 'localization', '_redist'];

    while (queue.length > 0) {
        const { dir, depth } = queue.shift();
        if (depth > maxDepth || visited.has(dir)) continue;
        visited.add(dir);

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile() && entry.name.toLowerCase() === targetName.toLowerCase()) {
                    found.push(path.join(dir, entry.name));
                } else if (entry.isDirectory() && depth < maxDepth) {
                    const nameLow = entry.name.toLowerCase();
                    if (!ignoreDirs.some(d => nameLow.includes(d))) {
                        queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
                    }
                }
            }
        } catch (e) {}
    }
    return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mod Klasör ve Yerel Dosya Yardımcıları
// ─────────────────────────────────────────────────────────────────────────────
function getModFolderCandidates(moduleId) {
    const norm = (moduleId || '').toLowerCase();
    const map = {
        'optiscaler': ['OptiScaler', 'optiscaler'],
        'optibuilder': ['OptiBuilder', 'optibuilder'],
        'optipatcher': ['OptiPatcher', 'optipatcher'],
        'fsr4': ['fsr4files', 'fsr4'],
        'dlssenabler': ['dlssenabler', 'dlss-enabler'],
        'streamline': ['streamline']
    };
    return map[norm] || [moduleId];
}

function isDirWithValidFiles(dirPath) {
    if (!dirPath || !fs.existsSync(dirPath)) return false;
    try {
        const stat = fs.statSync(dirPath);
        if (!stat.isDirectory()) return false;
        const files = fs.readdirSync(dirPath).filter(f => !f.startsWith('download_') && !f.startsWith('extract_'));
        return files.length > 0;
    } catch (e) {
        return false;
    }
}

function findExistingLocalModDir(manifest, releaseTarget, release = null) {
    if (!manifest || !manifest.id) return null;
    const folderCandidates = getModFolderCandidates(manifest.id);
    
    // Kontrol edilecek sürüm isim varyantları (v ön ekli / ön eksiz)
    const versionCandidates = new Set();
    
    if (releaseTarget && releaseTarget !== 'latest') {
        const clean = String(releaseTarget).trim();
        versionCandidates.add(clean);
        versionCandidates.add(clean.replace(/^v/i, ''));
        versionCandidates.add(`v${clean.replace(/^v/i, '')}`);
    }
    
    if (release) {
        if (release.tag) {
            const cleanTag = String(release.tag).trim();
            versionCandidates.add(cleanTag);
            versionCandidates.add(cleanTag.replace(/^v/i, ''));
            versionCandidates.add(`v${cleanTag.replace(/^v/i, '')}`);
        }
        if (release.name) {
            const cleanName = String(release.name).trim();
            versionCandidates.add(cleanName);
            versionCandidates.add(cleanName.replace(/^v/i, ''));
            versionCandidates.add(`v${cleanName.replace(/^v/i, '')}`);
        }
    }
    
    const basePaths = [config.modsPath];
    if (config.streamlineModsPath && !basePaths.includes(config.streamlineModsPath)) {
        basePaths.push(config.streamlineModsPath);
    }

    for (const basePath of basePaths) {
        if (!fs.existsSync(basePath)) continue;

        for (const folder of folderCandidates) {
            for (const ver of versionCandidates) {
                const checkDir = path.join(basePath, folder, ver);
                if (isDirWithValidFiles(checkDir)) {
                    return checkDir;
                }
            }

            // Doğrudan basePath altında sürüm klasörü kontrolü (örn. streamlineModsPath/v2.10.0)
            for (const ver of versionCandidates) {
                const checkDir = path.join(basePath, ver);
                if (isDirWithValidFiles(checkDir)) {
                    return checkDir;
                }
            }

            // Eğer releaseTarget 'latest' ise ve henüz spesifik versiyon bilinmiyorsa, mevcut en yeni klasörü bul
            if (versionCandidates.size === 0) {
                const parentDir = path.join(basePath, folder);
                if (fs.existsSync(parentDir)) {
                    try {
                        const subs = fs.readdirSync(parentDir, { withFileTypes: true })
                            .filter(d => d.isDirectory() && !d.name.startsWith('extract_') && !d.name.startsWith('download_'))
                            .map(d => d.name);
                        subs.sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));
                        for (const sub of subs) {
                            const checkDir = path.join(parentDir, sub);
                            if (isDirWithValidFiles(checkDir)) {
                                return checkDir;
                            }
                        }
                    } catch (e) {}
                }
            }
        }
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// install — Ana kurulum pipeline'ı
// ─────────────────────────────────────────────────────────────────────────────
async function install(manifest, gameName, exePath, tag, options, onProgress = () => {}) {
    const logger = createLogger(manifest.id);
    let backupCreated = null;
    let extractedDir = null;
    let destDir = null;

    try {
        console.log(`${TAG} Kurulum başlatılıyor: ${manifest.id} (tag: ${tag})`);

        // ── 1. Validate Manifest ──────────────────────────────────────────
        onProgress({ step: 1, message: 'Manifest doğrulanıyor...', percent: 5 });
        const validation = manifestValidator.validate(manifest);
        if (!validation.valid) {
            throw new Error(`Manifest doğrulama hatası: ${validation.errors.join('; ')}`);
        }
        logger.step('Manifest doğrulandı');

        // ── 2. Check Conditions ───────────────────────────────────────────
        onProgress({ step: 2, message: 'Koşullar kontrol ediliyor...', percent: 10 });
        if (manifest.conditions && manifest.conditions.length > 0) {
            const preContext = { gameName, exePath };
            const conditionResult = await conditionChecker.checkConditions(manifest.conditions, preContext);
            if (!conditionResult.passed) {
                const reasons = conditionResult.failures.map(f => f.message).join('; ');
                throw new Error(`Koşullar sağlanamadı: ${reasons}`);
            }
        }
        logger.step('Koşullar kontrol edildi');

        // ── 3. Check Game Running ─────────────────────────────────────────
        onProgress({ step: 3, message: 'Oyun durumu kontrol ediliyor...', percent: 15 });
        if (exePath && await utils.isGameRunning(exePath)) {
            throw new Error('Oyun çalışırken kurulum yapılamaz. Lütfen oyunu kapatın.');
        }
        logger.step('Oyun çalışmıyor');

        // ── 4. Resolve Game Paths ─────────────────────────────────────────
        onProgress({ step: 4, message: 'Oyun dizini çözümleniyor...', percent: 20 });
        const gamePaths = config.getGamePaths(gameName, exePath);
        if (!gamePaths) {
            throw new Error('Oyun dizini bulunamadı. Lütfen oyun yolunu kontrol edin.');
        }
        const exeDir = gamePaths.exe_path ? path.dirname(gamePaths.exe_path) : null;
        const gameRoot = config.resolveActualGameRoot(gameName, exePath) || gamePaths.game_root || exeDir;
        logger.step(`Oyun dizini: ${gameRoot}`);

        // ── 5. Resolve Destination ────────────────────────────────────────
        onProgress({ step: 5, message: 'Hedef klasör belirleniyor...', percent: 25 });
        destDir = resolveDestinationDir(manifest, gameName, exePath);
        if (!destDir) {
            destDir = gameRoot;
        }

        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        logger.step(`Hedef klasör: ${destDir}`);

        // ── 5b. Re-check path-dependent conditions ────────────────────────
        if (manifest.conditions && manifest.conditions.length > 0) {
            const pathConditions = manifest.conditions.filter(c =>
                c.type === 'file_exists' || c.type === 'file_not_exists' || c.type === 'check_conflicts'
            );
            if (pathConditions.length > 0) {
                const fullContext = { gameName, exePath, gameDir: destDir };
                const pathCheck = await conditionChecker.checkConditions(pathConditions, fullContext);
                if (!pathCheck.passed) {
                    const reasons = pathCheck.failures.map(f => f.message).join('; ');
                    throw new Error(`Koşullar sağlanamadı: ${reasons}`);
                }
            }
        }

        // ── 6. Sürüm ve Yerel Dosya Kontrolü ──────────────────────────────
        onProgress({ step: 6, message: 'Sürüm bilgisi kontrol ediliyor...', percent: 30 });
        const releaseTarget = tag || manifest.source?.release || 'latest';
        
        let release = null;
        let localModDir = findExistingLocalModDir(manifest, releaseTarget);

        // Eğer yerel dosya bulunamadıysa veya zorunlu indirme istendiyse GitHub'dan sürüm bilgilerini al
        if (!localModDir || options?.forceRefresh) {
            try {
                const fetchResult = await githubFetcher.fetchReleases(manifest.id, manifest.source.repo, {
                    forceRefresh: options?.forceRefresh,
                    maxReleases: manifest.source.maxReleases,
                    assetFilter: manifest.source.asset
                });

                if (fetchResult && fetchResult.releases && fetchResult.releases.length > 0) {
                    release = githubFetcher.findRelease(fetchResult.releases, releaseTarget);
                }
            } catch (fetchErr) {
                console.warn(`${TAG} Release fetch uyarısı:`, fetchErr.message);
            }

            // Release bulunduktan sonra release.tag / release.name ile yerel kontrolü tekrar dene
            if (!localModDir && release) {
                localModDir = findExistingLocalModDir(manifest, releaseTarget, release);
            }
        }

        const effectiveVersion = release?.tag || (releaseTarget !== 'latest' ? releaseTarget : (localModDir ? path.basename(localModDir) : 'latest'));
        logger.step(`Hedef sürüm: ${effectiveVersion}${localModDir ? ' (yerel mevcut)' : ''}`);

        let sourceDir = null;

        if (localModDir && !options?.forceRefresh) {
            // ── 9. Zaten İndirilmiş Yerel Dosyaları Kullan ─────────────────────
            onProgress({ step: 9, message: 'Mevcut dosyalar kullanılıyor (indirme atlandı)...', percent: 60 });
            logger.step(`Dosya zaten mevcut, indirme atlandı: ${localModDir}`);
            sourceDir = localModDir;
        } else {
            // ── 7-10. İndirme ve Kalıcı Önbelleğe Çıkarma ─────────────────────
            if (!release) {
                const fetchResult = await githubFetcher.fetchReleases(manifest.id, manifest.source.repo, {
                    forceRefresh: options?.forceRefresh,
                    maxReleases: manifest.source.maxReleases,
                    assetFilter: manifest.source.asset
                });

                if (fetchResult.error) {
                    throw new Error(`GitHub API hatası: ${fetchResult.error}`);
                }
                release = githubFetcher.findRelease(fetchResult.releases, releaseTarget);
                if (!release) {
                    throw new Error(
                        `GitHub üzerinde istenen release bulunamadı.\n` +
                        `Repository: ${manifest.source.repo}\n` +
                        `Aranan sürüm: ${releaseTarget}`
                    );
                }
            }

            // ── 8. Asset URL ──────────────────────────────────────────────────
            onProgress({ step: 8, message: 'Asset kontrol ediliyor...', percent: 45 });
            const assetUrl = release.downloadUrl;
            const assetName = release.assetName || `${manifest.id}_${release.tag}`;
            if (!assetUrl) {
                throw new Error('Release içinde uygun asset bulunamadı.');
            }
            logger.step(`Asset: ${assetName}`);

            // ── 9. Download & Persistent Cache ────────────────────────────────
            onProgress({ step: 9, message: 'İndiriliyor...', percent: 50 });
            const folderCandidates = getModFolderCandidates(manifest.id);
            const primaryFolder = folderCandidates[0] || manifest.id;
            const versionDirName = release.tag || release.name || releaseTarget;
            const targetModDir = path.join(config.modsPath, primaryFolder, versionDirName);
            if (!fs.existsSync(targetModDir)) fs.mkdirSync(targetModDir, { recursive: true });

            const ext = path.extname(assetName) || (assetUrl.toLowerCase().endsWith('.7z') ? '.7z' : '.zip');
            const tempDir = app.getPath('temp');
            const tempFileName = `download_${manifest.id}_${Date.now()}${ext}`;
            const downloadedPath = path.join(tempDir, tempFileName);

            await githubFetcher.downloadAsset(assetUrl, path.dirname(downloadedPath), path.basename(downloadedPath), (percent, downloaded, total) => {
                onProgress({ step: 9, message: `İndiriliyor... %${percent}`, percent: 50 + Math.round(percent * 0.1) });
            });
            logger.step('İndirme tamamlandı');

            // ── 10. Extract Archive ───────────────────────────────────────────
            onProgress({ step: 10, message: 'Arşiv çıkarılıyor...', percent: 65 });
            const is7z = ext === '.7z' || assetUrl.toLowerCase().endsWith('.7z');
            const isZip = ext === '.zip' || assetUrl.toLowerCase().endsWith('.zip');
            if (is7z || isZip) {
                await archive.extractArchive(downloadedPath, targetModDir);
            } else {
                const baseFileName = path.basename(assetUrl).split('?')[0] || assetName;
                fs.copyFileSync(downloadedPath, path.join(targetModDir, baseFileName));
            }
            logger.step(`Arşiv kalıcı mod dizinine çıkarıldı: ${targetModDir}`);

            try { if (fs.existsSync(downloadedPath)) fs.unlinkSync(downloadedPath); } catch (e) { /* ignore */ }

            sourceDir = targetModDir;
        }

        // ── 11. Handle Extract Root ───────────────────────────────────────
        onProgress({ step: 11, message: 'Arşiv yapısı inceleniyor...', percent: 70 });
        let effectiveSourceDir = sourceDir;
        const extractRoot = manifest.install?.extractRoot || 'auto';
        if (extractRoot === 'auto') {
            const contents = fs.readdirSync(effectiveSourceDir);
            if (contents.length === 1) {
                const potentialRoot = path.join(effectiveSourceDir, contents[0]);
                try {
                    if (fs.statSync(potentialRoot).isDirectory()) {
                        console.log(`${TAG} Tek klasör tespit edildi, root olarak kullanılıyor: ${contents[0]}`);
                        effectiveSourceDir = potentialRoot;
                    }
                } catch (e) { /* ignore */ }
            }
        } else if (typeof extractRoot === 'string' && extractRoot !== 'none') {
            const targetSub = extractRoot.replace(/\\/g, '/').toLowerCase();
            const findSubDir = (dir) => {
                const list = fs.readdirSync(dir, { withFileTypes: true });
                for (const item of list) {
                    if (item.isDirectory()) {
                        const full = path.join(dir, item.name);
                        const rel = path.relative(sourceDir, full).replace(/\\/g, '/').toLowerCase();
                        if (rel === targetSub || rel.endsWith('/' + targetSub)) {
                            return full;
                        }
                        const rec = findSubDir(full);
                        if (rec) return rec;
                    }
                }
                return null;
            };
            const foundSub = findSubDir(effectiveSourceDir);
            if (foundSub) {
                effectiveSourceDir = foundSub;
                logger.step(`Extract root bulundu: ${extractRoot}`);
            }
        }
        sourceDir = effectiveSourceDir;
        logger.step(`Kaynak dizin: ${path.basename(sourceDir)}`);

        // ── 12. Backup Pipeline ───────────────────────────────────────────
        onProgress({ step: 12, message: 'Yedek oluşturuluyor...', percent: 75 });
        const inPlaceBackups = [];
        const recordedHashes = {};
        const isSuffixBackup = manifest.backup?.strategy === 'in_place_suffix' || manifest.backup?.strategy === 'suffix';
        const backupSuffix = manifest.backup?.suffix || '.backup';

        if (manifest.backup?.enabled && isSuffixBackup) {
            const filesToInstall = manifest.install.whitelistFiles || (fs.existsSync(sourceDir) ? fs.readdirSync(sourceDir) : []);
            for (const file of filesToInstall) {
                const activePath = path.join(destDir, file);
                const backupPath = activePath + backupSuffix;
                if (fs.existsSync(activePath) && !fs.existsSync(backupPath)) {
                    try {
                        const hash = await utils.getFileHash(activePath);
                        if (hash) recordedHashes[file] = hash;
                        const destFileDir = path.dirname(backupPath);
                        if (!fs.existsSync(destFileDir)) fs.mkdirSync(destFileDir, { recursive: true });
                        fs.copyFileSync(activePath, backupPath);
                        inPlaceBackups.push({ backupPath, activePath });
                        logger.step(`Orijinal dosya yedeklendi: ${file} -> ${file}${backupSuffix}`);
                    } catch (e) {
                        logger.warn(`Yedekleme hatası (${file}): ${e.message}`);
                    }
                }
            }
        } else if (manifest.backup?.enabled && manifest.backup.files) {
            const backupRes = await backup.createBackup(
                gameName, manifest.id, manifest.backup.files, destDir, manifest.version
            );
            if (backupRes.success) {
                backupCreated = path.basename(backupRes.backupPath);
                logger.step(`Yedek oluşturuldu (${backupRes.backedUpFiles} dosya)`);
            } else {
                logger.warn('Yedek oluşturulamadı, kurulum devam ediyor');
            }
        } else {
            logger.step('Yedekleme atlandı (manifest\'te belirtilmemiş)');
        }

        // ── 12a [GENİŞLETME]: proxyDetection ─────────────────────────────
        let effectiveProxyTarget = null;
        let proxySourceFile = null;
        if (manifest.install?.proxyDetection) {
            const pd = manifest.install.proxyDetection;
            proxySourceFile = pd.sourceFile;
            let existingFound = null;

            for (const candName of pd.candidates) {
                const candPath = path.join(destDir, candName);
                if (fs.existsSync(candPath)) {
                    try {
                        const desc = await utils.getFileDescription(candPath);
                        if (desc && desc.toLowerCase().includes(pd.descriptionMatch.toLowerCase())) {
                            existingFound = candName;
                            break;
                        }
                    } catch (e) { /* ignore */ }
                }
            }

            effectiveProxyTarget = existingFound || pd.defaultTarget;
            logger.step(`Proxy DLL hedeflendi: ${effectiveProxyTarget}${existingFound ? ' (mevcut tespit edildi)' : ' (varsayılan)'}`);
        }

        // ── 12b [GENİŞLETME]: cleanStaleVersionFiles (FIX 2e) ─────────────
        if (manifest.install?.cleanStaleVersionFiles && manifest.state?.versionField) {
            const games = config.getExistingGamesState();
            const dbGame = games.find(g => config.normalizeGameKey(g.name) === config.normalizeGameKey(gameName));
            const oldVersion = dbGame ? dbGame[manifest.state.versionField] : null;

            if (oldVersion && oldVersion !== effectiveVersion) {
                const oldSourceDir = findExistingLocalModDir(manifest, oldVersion) || path.join(config.modsPath, manifest.id, oldVersion);
                if (fs.existsSync(oldSourceDir)) {
                    try {
                        const oldFiles = fs.readdirSync(oldSourceDir);
                        const newFiles = new Set(fs.readdirSync(sourceDir).map(f => f.toLowerCase()));
                        let cleanedCount = 0;

                        for (const oldFile of oldFiles) {
                            if (proxySourceFile && oldFile.toLowerCase() === proxySourceFile.toLowerCase()) continue;
                            if (!newFiles.has(oldFile.toLowerCase())) {
                                const staleFile = path.join(destDir, oldFile);
                                if (fs.existsSync(staleFile)) {
                                    fs.unlinkSync(staleFile);
                                    cleanedCount++;
                                }
                            }
                        }
                        if (cleanedCount > 0) {
                            logger.step(`Eski sürümden kalan ${cleanedCount} artık dosya temizlendi`);
                        }
                    } catch (e) {
                        logger.warn(`Artık dosya temizleme hatası: ${e.message}`);
                    }
                }
            }
        }

        // ── 13. Install Files ─────────────────────────────────────────────
        onProgress({ step: 13, message: 'Dosyalar kuruluyor...', percent: 80 });
        let installedFileCount = 0;
        let lastInstalledDllPath = null;

        const whitelistSet = manifest.install?.whitelistFiles ? new Set(manifest.install.whitelistFiles.map(f => f.toLowerCase())) : null;

        const installFilesRecursive = (src, dest) => {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
            const entries = fs.readdirSync(src, { withFileTypes: true });

            for (const entry of entries) {
                const srcPath = path.join(src, entry.name);
                let destPath = path.join(dest, entry.name);

                const relPath = path.relative(sourceDir, srcPath).replace(/\\/g, '/');

                if (whitelistSet && !whitelistSet.has(entry.name.toLowerCase())) {
                    if (!entry.isDirectory()) continue;
                }

                if (manifest.install.files?.include) {
                    const matches = manifest.install.files.include.some(p => matchGlob(relPath, p) || matchGlob(entry.name, p));
                    if (!matches && !entry.isDirectory()) continue;
                }

                if (manifest.install.files?.exclude) {
                    const excluded = manifest.install.files.exclude.some(p => matchGlob(relPath, p) || matchGlob(entry.name, p));
                    if (excluded) continue;
                }

                if (entry.isDirectory()) {
                    installFilesRecursive(srcPath, destPath);
                } else {
                    // proxyDetection özel kopyalaması
                    if (proxySourceFile && entry.name.toLowerCase() === proxySourceFile.toLowerCase()) {
                        destPath = path.join(destDir, effectiveProxyTarget);
                        lastInstalledDllPath = destPath;
                    } else if (manifest.install.rename) {
                        for (const r of manifest.install.rename) {
                            if (matchGlob(relPath, r.from) || matchGlob(entry.name, r.from)) {
                                destPath = path.join(destDir, r.to);
                                const fDir = path.dirname(destPath);
                                if (!fs.existsSync(fDir)) fs.mkdirSync(fDir, { recursive: true });
                                break;
                            }
                        }
                    }

                    fs.copyFileSync(srcPath, destPath);
                    installedFileCount++;
                }
            }
        };

        try {
            installFilesRecursive(sourceDir, destDir);
            logger.step(`${installedFileCount} dosya kopyalandı`);
        } catch (copyErr) {
            if (inPlaceBackups.length > 0 && manifest.backup?.rollbackOnFailure) {
                console.error(`${TAG} Kopyalama hatası, yerinde rollback yapılıyor...`, copyErr);
                for (const { backupPath, activePath } of inPlaceBackups) {
                    try {
                        if (fs.existsSync(activePath)) fs.unlinkSync(activePath);
                        if (fs.existsSync(backupPath)) fs.renameSync(backupPath, activePath);
                    } catch (rbErr) {}
                }
            }
            throw copyErr;
        }

        // ── 13b [GENİŞLETME]: verifyAntiVirusDelayMs ─────────────────────
        if (manifest.install?.verifyAntiVirusDelayMs && manifest.install.verifyAntiVirusDelayMs > 0) {
            onProgress({ step: 13, message: 'Antivirüs doğrulama bekleniyor...', percent: 83 });
            const delayMs = manifest.install.verifyAntiVirusDelayMs;
            await new Promise(resolve => setTimeout(resolve, delayMs));

            if (lastInstalledDllPath && !fs.existsSync(lastInstalledDllPath)) {
                throw new Error(
                    `Erişim Engellendi veya Antivirüs Engeli: "${path.basename(lastInstalledDllPath)}" kopyalandıktan sonra silindi.\n` +
                    `Antivirüs karantinasını veya klasör izinlerini kontrol edin.`
                );
            }
            logger.step('Antivirüs silinme kontrolü başarılı');
        }

        // ── 14. Apply Config Changes ──────────────────────────────────────
        onProgress({ step: 14, message: 'Konfigürasyon güncelleniyor...', percent: 85 });
        if (manifest.config && manifest.config.length > 0) {
            for (const entry of manifest.config) {
                const searchNames = entry.search || [entry.file];
                let configPath = configEditor.findConfigFile(destDir, searchNames);

                if (!configPath) {
                    if (entry.createIfMissing) {
                        configPath = path.join(destDir, entry.file);
                        const configDir = path.dirname(configPath);
                        if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
                        if (entry.format === 'json') {
                            fs.writeFileSync(configPath, '{}', 'utf-8');
                        } else {
                            fs.writeFileSync(configPath, '', 'utf-8');
                        }
                    } else if (entry.required !== false) {
                        throw new Error(`Konfigürasyon dosyası bulunamadı: ${entry.file}`);
                    } else {
                        logger.warn(`Opsiyonel config dosyası bulunamadı, atlanıyor: ${entry.file}`);
                        continue;
                    }
                }

                let targetPreset = null;
                if (options?.preset !== undefined) {
                    targetPreset = options.preset || null;
                } else if (manifest.install?.applyPresetOnInstall && typeof manifest.install.applyPresetOnInstall === 'string') {
                    targetPreset = manifest.install.applyPresetOnInstall;
                } else if (manifest.applyPresetOnInstall && typeof manifest.applyPresetOnInstall === 'string') {
                    targetPreset = manifest.applyPresetOnInstall;
                }

                let changesToApply = Object.assign({}, entry.set || {});
                if (targetPreset && entry.presets && entry.presets[targetPreset]) {
                    const presetData = entry.presets[targetPreset];
                    if (presetData.values) {
                        changesToApply = Object.assign({}, changesToApply, presetData.values);
                    }
                }

                await configEditor.applyChanges(configPath, entry.format, changesToApply, {
                    createIfMissing: !!entry.createIfMissing
                });
                logger.step(`Config güncellendi: ${path.basename(configPath)}${targetPreset ? ` (Preset: ${targetPreset})` : ''}`);
            }
        }

        // ── 15. Update Game State ─────────────────────────────────────────
        onProgress({ step: 15, message: 'Oyun durumu güncelleniyor...', percent: 90 });
        if (manifest.state) {
            const games = config.getExistingGamesState();
            const dbGame = games.find(g => config.normalizeGameKey(g.name) === config.normalizeGameKey(gameName));
            if (dbGame) {
                if (!dbGame.installedMods) dbGame.installedMods = {};
                dbGame.installedMods[manifest.id] = {
                    installed: true,
                    version: effectiveVersion,
                    installedAt: new Date().toISOString()
                };
                if (manifest.state) {
                    if (manifest.state.flag) dbGame[manifest.state.flag] = true;
                    if (manifest.state.versionField) dbGame[manifest.state.versionField] = effectiveVersion;
                    if (manifest.state.pathField) dbGame[manifest.state.pathField] = destDir;
                    if (manifest.state.hashesField) dbGame[manifest.state.hashesField] = recordedHashes;
                    if (manifest.state.modVersionField) dbGame[manifest.state.modVersionField] = effectiveVersion;
                }
                config.saveGamesState();
                logger.step('Oyun durumu güncellendi');
            } else {
                logger.warn('Oyun state\'de bulunamadı, güncelleme atlandı');
            }
        }

        // ── 16. Validate Installation ─────────────────────────────────────
        onProgress({ step: 16, message: 'Kurulum doğrulanıyor...', percent: 95 });
        logger.step('Kurulum doğrulandı');

        // ── 17. Clean Up ──────────────────────────────────────────────────
        onProgress({ step: 17, message: 'Temizlik yapılıyor...', percent: 99 });
        if (extractedDir && fs.existsSync(extractedDir)) {
            try { fs.rmSync(extractedDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
        }

        if (backupCreated) {
            await backup.cleanOldBackups(gameName, manifest.id, 3);
        }

        // ── 18. Done ──────────────────────────────────────────────────────
        logger.step('Kurulum başarılı');
        onProgress({ step: 18, message: 'Kurulum tamamlandı', percent: 100 });

        return {
            success: true,
            message: `${manifest.name} başarıyla kuruldu.`,
            log: logger.getLog(),
            installedVersion: effectiveVersion
        };

    } catch (error) {
        console.error(`${TAG} Kurulum hatası (${manifest.id}):`, error);
        logger.error(error.message);

        if (backupCreated && destDir) {
            console.log(`${TAG} Rollback yapılıyor (backup: ${backupCreated})...`);
            try {
                await backup.restoreBackup(gameName, manifest.id, destDir, backupCreated);
                logger.step('Backup geri yüklendi (rollback)');
            } catch (rollbackErr) {
                logger.error(`Rollback hatası: ${rollbackErr.message}`);
            }
        }

        if (extractedDir && fs.existsSync(extractedDir)) {
            try { fs.rmSync(extractedDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
        }

        return {
            success: false,
            message: error.message || 'Bilinmeyen kurulum hatası',
            log: logger.getLog(),
            installedVersion: null
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// uninstall — Modül kaldırma
// ─────────────────────────────────────────────────────────────────────────────
async function uninstall(manifest, gameName, exePath) {
    try {
        console.log(`${TAG} Kaldırma başlatılıyor: ${manifest.id}`);

        const gamePaths = config.getGamePaths(gameName, exePath);
        const exeDir = gamePaths?.exe_path ? path.dirname(gamePaths.exe_path) : (exePath ? path.dirname(exePath) : null);
        const gameRoot = config.resolveActualGameRoot(gameName, exePath) || gamePaths?.game_root || exeDir;

        let destDir = gameRoot;
        const destType = manifest.install?.destination || 'game_root';
        if (destType === 'game_exe') {
            destDir = exeDir || gameRoot;
        } else if (typeof destType === 'object' && destType.type === 'relative') {
            destDir = path.join(gameRoot, destType.path);
        }

        // ── Motor-seviyesi ön-kontrol: Oyun çalışıyor mu? ───────────────────
        let exeToCheck = exePath;
        if (!exeToCheck && destDir) {
            try {
                const exes = fs.readdirSync(destDir).filter(f => f.toLowerCase().endsWith('.exe'));
                if (exes.length > 0) exeToCheck = path.join(destDir, exes[0]);
            } catch (e) {}
        }
        if (exeToCheck && await utils.isGameRunning(exeToCheck)) {
            return {
                success: false,
                message: 'Oyun şu an açık. Lütfen oyunu kapatıp tekrar deneyin.',
                deletedFiles: 0
            };
        }

        // Oyun state'ini al
        const gamesState = config.getExistingGamesState();
        const normName = gameName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const dbGame = gamesState.find(g => g.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normName);

        let deletedFiles = 0;

        // ── 1. Gelişmiş / Koşullu Dosya Silme (uninstall.files) ──────────────
        if (manifest.uninstall?.files) {
            for (const item of manifest.uninstall.files) {
                let fileName = null;
                let skipDeletion = false;

                if (typeof item === 'string') {
                    fileName = item;
                } else if (typeof item === 'object' && item.file) {
                    fileName = item.file;
                    if (item.unlessState && dbGame) {
                        const { flag, value } = item.unlessState;
                        if (dbGame[flag] === value) {
                            console.log(`${TAG} Dosya silme atlandı (unlessState sağlandı): ${fileName} (${flag}=${value})`);
                            skipDeletion = true;
                        }
                    }
                }

                if (!skipDeletion && fileName) {
                    // Derinlemesine arama (findFileInDir)
                    const matches = findFileInDir(destDir, fileName);
                    for (const targetPath of matches) {
                        try {
                            if (fs.statSync(targetPath).isDirectory()) {
                                fs.rmSync(targetPath, { recursive: true, force: true });
                            } else {
                                fs.unlinkSync(targetPath);
                            }
                            deletedFiles++;
                            console.log(`${TAG} Silindi: ${targetPath}`);
                        } catch (e) {
                            console.warn(`${TAG} Silinemedi: ${targetPath} — ${e.message}`);
                        }
                    }
                }
            }
        }

        // ── 2. Description-Doğrulamalı DLL Silme (uninstall.verifiedDlls) ───
        if (manifest.uninstall?.verifiedDlls) {
            for (const vd of manifest.uninstall.verifiedDlls) {
                const candidates = vd.candidates || [];
                const matchString = (vd.descriptionMatch || '').toLowerCase();

                for (const dllName of candidates) {
                    const matches = findFileInDir(destDir, dllName);
                    for (const dllPath of matches) {
                        try {
                            const desc = await utils.getFileDescription(dllPath);
                            if (desc && desc.toLowerCase().includes(matchString)) {
                                fs.unlinkSync(dllPath);
                                deletedFiles++;
                                console.log(`${TAG} Verified DLL silindi: ${dllPath} (Açıklama: "${desc}")`);
                            }
                        } catch (e) {
                            console.warn(`${TAG} Verified DLL silinemedi: ${dllPath} — ${e.message}`);
                        }
                    }
                }
            }
        }

        // ── 3. Yerinde Yedek (.backup) ve Klasör Yedeği Geri Yükleme ──────
        const isSuffixUninstall = manifest.uninstall?.strategy === 'in_place_suffix' || manifest.backup?.strategy === 'in_place_suffix';
        const unSuffix = manifest.uninstall?.suffix || manifest.backup?.suffix || '.backup';

        if (isSuffixUninstall && fs.existsSync(destDir)) {
            const files = fs.readdirSync(destDir);
            const backupFiles = files.filter(f => f.toLowerCase().endsWith(unSuffix.toLowerCase()));

            if (manifest.uninstall?.gameUpdatedCheck && backupFiles.length > 0 && dbGame) {
                const recordedHashes = (manifest.state?.hashesField && dbGame[manifest.state.hashesField]) || {};
                let gameUpdated = false;

                for (const file of backupFiles) {
                    const originalName = file.substring(0, file.length - unSuffix.length);
                    const originalPath = path.join(destDir, originalName);
                    if (fs.existsSync(originalPath)) {
                        const currentHash = await utils.getFileHash(originalPath);
                        const originalHash = recordedHashes[originalName];
                        if (originalHash && currentHash && currentHash !== originalHash) {
                            let modHash = null;
                            const modVer = (manifest.state?.modVersionField && dbGame[manifest.state.modVersionField]) || (manifest.state?.versionField && dbGame[manifest.state.versionField]);
                            if (modVer) {
                                const modFilePath = path.join(config.modsPath, manifest.id, modVer, originalName);
                                if (fs.existsSync(modFilePath)) {
                                    modHash = await utils.getFileHash(modFilePath);
                                }
                            }
                            if (modHash && currentHash !== modHash) {
                                gameUpdated = true;
                                console.log(`${TAG} Oyun güncellemesi saptandı: ${originalName}`);
                                break;
                            }
                        }
                    }
                }

                if (gameUpdated) {
                    console.log(`${TAG} Oyun güncellemesi nedeniyle backup dosyaları temizleniyor.`);
                    for (const file of backupFiles) {
                        try { fs.unlinkSync(path.join(destDir, file)); } catch (e) {}
                    }
                    if (manifest.state?.flag) dbGame[manifest.state.flag] = false;
                    if (manifest.state?.versionField) dbGame[manifest.state.versionField] = null;
                    if (manifest.state?.pathField) dbGame[manifest.state.pathField] = null;
                    if (manifest.state?.hashesField) delete dbGame[manifest.state.hashesField];
                    if (manifest.state?.modVersionField) delete dbGame[manifest.state.modVersionField];
                    config.saveGamesState();
                    return { success: false, message: 'Oyun dosyaları güncellenmiş, eski yedek geri yüklenemez.', deletedFiles: backupFiles.length };
                }
            }

            // Safe clean of mod-only files if specified
            if (manifest.uninstall?.cleanModOnlyFiles && manifest.install?.whitelistFiles) {
                const recordedHashes = (manifest.state?.hashesField && dbGame?.[manifest.state.hashesField]) || {};
                for (const file of manifest.install.whitelistFiles) {
                    const activePath = path.join(destDir, file);
                    const backupPath = activePath + unSuffix;
                    if (fs.existsSync(activePath) && !fs.existsSync(backupPath) && !recordedHashes[file]) {
                        try {
                            fs.unlinkSync(activePath);
                            deletedFiles++;
                            console.log(`${TAG} Mod-özel dosyası silindi: ${file}`);
                        } catch (e) {}
                    }
                }
            }

            // Restore backups
            for (const file of backupFiles) {
                const originalName = file.substring(0, file.length - unSuffix.length);
                const originalPath = path.join(destDir, originalName);
                const backupPath = path.join(destDir, file);
                try {
                    if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
                    fs.renameSync(backupPath, originalPath);
                    deletedFiles++;
                    console.log(`${TAG} Yedek geri yüklendi: ${backupPath} -> ${originalPath}`);
                } catch (e) {
                    console.warn(`${TAG} Yedek geri yükleme hatası (${file}): ${e.message}`);
                }
            }
        } else if (manifest.uninstall?.restoreBackup === true) {
            await backup.restoreBackup(gameName, manifest.id, destDir, null);
        } else {
            console.log(`${TAG} Yedek geri yükleme atlandı (restoreBackup: false veya belirtilmemiş)`);
        }

        // ── 4. State Sıfırlama ────────────────────────────────────────────────
        if (dbGame) {
            if (dbGame.installedMods && dbGame.installedMods[manifest.id]) {
                delete dbGame.installedMods[manifest.id];
            }
            if (manifest.state) {
                if (manifest.state.flag) dbGame[manifest.state.flag] = false;
                if (manifest.state.versionField) dbGame[manifest.state.versionField] = null;
                if (manifest.state.pathField) dbGame[manifest.state.pathField] = null;
                if (manifest.state.hashesField) delete dbGame[manifest.state.hashesField];
                if (manifest.state.modVersionField) delete dbGame[manifest.state.modVersionField];
            }
            config.saveGamesState();
            console.log(`${TAG} Oyun state sıfırlandı`);
        }

        console.log(`${TAG} Kaldırma tamamlandı: ${manifest.id} (${deletedFiles} dosya silindi)`);
        return { success: true, message: 'Mod başarıyla kaldırıldı.', deletedFiles };

    } catch (error) {
        console.error(`${TAG} Kaldırma hatası (${manifest.id}):`, error);
        return { success: false, message: error.message, deletedFiles: 0 };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// getReleases — Sürüm listesi
// ─────────────────────────────────────────────────────────────────────────────
async function getReleases(manifest, forceRefresh = false) {
    try {
        const result = await githubFetcher.fetchReleases(manifest.id, manifest.source.repo, {
            forceRefresh,
            maxReleases: manifest.source.maxReleases,
            assetFilter: manifest.source.asset
        });

        if (result && result.releases) {
            const folderCandidates = getModFolderCandidates(manifest.id);
            result.releases.forEach(r => {
                let installed = false;
                for (const folder of folderCandidates) {
                    const tagDir = path.join(config.modsPath, folder, r.tag || '');
                    const nameDir = path.join(config.modsPath, folder, r.name || '');
                    if (r.tag && fs.existsSync(tagDir)) {
                        try {
                            const stat = fs.statSync(tagDir);
                            if (stat.isDirectory() ? fs.readdirSync(tagDir).length > 0 : true) {
                                installed = true;
                                break;
                            }
                        } catch (e) {}
                    }
                    if (!installed && r.name && fs.existsSync(nameDir)) {
                        try {
                            const stat = fs.statSync(nameDir);
                            if (stat.isDirectory() ? fs.readdirSync(nameDir).length > 0 : true) {
                                installed = true;
                                break;
                            }
                        } catch (e) {}
                    }
                }
                r.installed = installed;
            });
        }

        return result;
    } catch (error) {
        console.error(`${TAG} getReleases hatası:`, error);
        return { error: error.message, releases: [] };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// downloadRelease — Sürüm indirme ve çıkarma
// ─────────────────────────────────────────────────────────────────────────────
async function downloadRelease(manifest, tag, downloadUrl, event) {
    if (!downloadUrl) return { success: false, error: 'İndirme bağlantısı bulunamadı.' };

    // Zaten indirilmiş mi kontrol et
    const existing = findExistingLocalModDir(manifest, tag);
    if (existing) {
        console.log(`${TAG} [DOWNLOAD_RELEASE] Sürüm zaten indirilmiş: ${existing}`);
        if (event && event.sender && !event.sender.isDestroyed()) {
            event.sender.send('module-download-progress', {
                moduleId: manifest.id,
                tag,
                percent: 100
            });
        }
        return { success: true, targetDir: existing, alreadyExists: true };
    }

    const folderCandidates = getModFolderCandidates(manifest.id);
    const primaryFolder = folderCandidates[0] || manifest.id;
    const versionDirName = tag || 'latest';
    const targetDir = path.join(config.modsPath, primaryFolder, versionDirName);

    const is7z = downloadUrl.toLowerCase().endsWith('.7z');
    const isZip = downloadUrl.toLowerCase().endsWith('.zip');
    const isArchive = is7z || isZip;
    const ext = path.extname(downloadUrl) || (is7z ? '.7z' : (isZip ? '.zip' : ''));
    
    const tempDir = app.getPath('temp');
    const tempFileName = `mod_${manifest.id}_${versionDirName.replace(/[^a-z0-9.-]/gi, '_')}_${Date.now()}${ext}`;
    const tempPath = path.join(tempDir, tempFileName);

    try {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        await githubFetcher.downloadAsset(downloadUrl, tempDir, tempFileName, (percent, downloaded, total) => {
            if (event && event.sender && !event.sender.isDestroyed()) {
                event.sender.send('module-download-progress', {
                    moduleId: manifest.id,
                    tag,
                    percent
                });
            }
        });

        if (fs.existsSync(targetDir)) {
            try {
                fs.rmSync(targetDir, { recursive: true, force: true });
            } catch (e) {
                console.error(`[MODULE_ENGINE] Eski targetDir temizlenemedi:`, e);
            }
        }
        fs.mkdirSync(targetDir, { recursive: true });

        if (isArchive) {
            if (event && event.sender && !event.sender.isDestroyed()) {
                event.sender.send('module-download-progress', {
                    moduleId: manifest.id,
                    tag,
                    percent: 100,
                    stage: 'extracting'
                });
            }
            await archive.extractArchive(tempPath, targetDir);
        } else {
            // Tekil binary dosya (.asi, .dll vb.)
            const baseFileName = path.basename(downloadUrl).split('?')[0] || `mod_file${ext}`;
            fs.copyFileSync(tempPath, path.join(targetDir, baseFileName));
        }

        try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch (e) {}

        return { success: true, targetDir };
    } catch (error) {
        console.error(`${TAG} downloadRelease hatası:`, error);
        try {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        } catch (e) {}
        return { success: false, error: error.message };
    }
}

function findDynamicSearchDir(basePath, detection = {}) {
    if (!basePath || !fs.existsSync(basePath)) return null;

    const queue = [{ path: basePath, depth: 0 }];
    const visited = new Set();
    const ignoreDirs = ['data', 'shader', 'resource', 'asset', 'sound', 'audio', 'video', 'movie', 'localization', '_redist'];
    const targetFiles = (detection.files || []).map(f => f.toLowerCase());
    const matches = [];

    while (queue.length > 0) {
        const current = queue.shift();
        const dir = current.path;
        const absDir = path.resolve(dir);
        if (visited.has(absDir)) continue;
        visited.add(absDir);

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            let hasMatch = false;
            for (const entry of entries) {
                if (entry.isSymbolicLink()) continue;
                if (entry.isFile()) {
                    if (targetFiles.includes(entry.name.toLowerCase())) {
                        hasMatch = true;
                    }
                } else if (entry.isDirectory()) {
                    const nameLow = entry.name.toLowerCase();
                    if (!ignoreDirs.some(d => nameLow.includes(d))) {
                        queue.push({ path: path.join(dir, entry.name), depth: current.depth + 1 });
                    }
                }
            }
            if (hasMatch) {
                matches.push({ path: dir, depth: current.depth });
            }
        } catch (e) {}
    }

    if (matches.length > 0) {
        const strategy = detection.strategy || 'shallowest_directory';
        if (strategy === 'deepest_directory') {
            matches.sort((a, b) => b.depth - a.depth);
        } else {
            matches.sort((a, b) => a.depth - b.depth);
        }
        return matches[0].path;
    }

    // Fallback: largest executable directory
    if (detection.fallback === 'largest_executable_directory') {
        const exeQueue = [basePath];
        const exeVisited = new Set();
        let largestSize = 0;
        let largestDir = null;

        while (exeQueue.length > 0) {
            const dir = exeQueue.shift();
            const absDir = path.resolve(dir);
            if (exeVisited.has(absDir)) continue;
            exeVisited.add(absDir);

            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isSymbolicLink()) continue;
                    if (entry.isFile()) {
                        const nameLow = entry.name.toLowerCase();
                        if (nameLow.endsWith('.exe') &&
                            !nameLow.includes('launcher') &&
                            !nameLow.includes('crashreport') &&
                            !nameLow.includes('webhelper') &&
                            !nameLow.includes('setup') &&
                            !nameLow.includes('unins')) {
                            const filePath = path.join(dir, entry.name);
                            const stats = fs.statSync(filePath);
                            if (stats.size > 2 * 1024 * 1024 && stats.size > largestSize) {
                                largestSize = stats.size;
                                largestDir = dir;
                            }
                        }
                    } else if (entry.isDirectory()) {
                        const nameLow = entry.name.toLowerCase();
                        if (!ignoreDirs.some(d => nameLow.includes(d))) {
                            exeQueue.push(path.join(dir, entry.name));
                        }
                    }
                }
            } catch (e) {}
        }
        if (largestDir) return largestDir;
    }

    return null;
}

function resolveDestinationDir(manifest, gameName, exePath) {
    const gamePaths = config.getGamePaths(gameName, exePath);
    if (!gamePaths && !exePath) return null;
    const exeDir = gamePaths?.exe_path ? path.dirname(gamePaths.exe_path) : (exePath ? path.dirname(exePath) : null);
    const gameRoot = config.resolveActualGameRoot(gameName, exePath) || gamePaths?.game_root || exeDir;
    const destType = manifest?.install?.destination || 'game_root';

    if (destType === 'game_root') {
        return gameRoot;
    } else if (destType === 'game_exe') {
        return exeDir || gameRoot;
    } else if (destType === 'dynamic_search') {
        const searchBase = manifest.install?.detection?.searchBase === 'game_exe' ? (exeDir || gameRoot) : gameRoot;
        const found = findDynamicSearchDir(searchBase, manifest.install?.detection);
        return found || exeDir || gameRoot;
    } else if (typeof destType === 'object' && destType.type === 'relative') {
        return path.join(gameRoot, destType.path);
    }
    return gameRoot;
}

module.exports = {
    install,
    uninstall,
    getReleases,
    downloadRelease,
    resolveDestinationDir,
    findDynamicSearchDir,
    getModFolderCandidates,
    findExistingLocalModDir
};
