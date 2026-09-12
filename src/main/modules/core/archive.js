'use strict';

const extract = require('extract-zip');
const { execFile } = require('child_process');
const { path7za } = require('7zip-bin');

const SUPPORTED_FORMATS = ['.zip', '.7z'];

function getSupportedFormats() {
    return [...SUPPORTED_FORMATS];
}

function supportsFormat(extension) {
    if (!extension) return false;
    let ext = extension.toLowerCase();
    if (!ext.startsWith('.')) ext = '.' + ext;
    return SUPPORTED_FORMATS.includes(ext);
}

async function extractArchive(archivePath, targetDir) {
    console.log(`[ARCHIVE] Çıkarılıyor: ${archivePath} -> ${targetDir}`);
    const lower = archivePath.toLowerCase();

    if (lower.endsWith('.7z')) {
        return new Promise((resolve, reject) => {
            execFile(path7za, ['x', archivePath, `-o${targetDir}`, '-y'], (err, stdout, stderr) => {
                if (err) {
                    console.error('[ARCHIVE] 7za extract error:', err, stderr);
                    return reject(new Error(`7z extraction failed: ${err.message || stderr}`));
                }
                resolve();
            });
        });
    } else if (lower.endsWith('.zip')) {
        try {
            await extract(archivePath, { dir: targetDir });
        } catch (err) {
            console.error('[ARCHIVE] ZIP çıkarma hatası:', err);
            throw new Error(`ZIP extraction failed: ${err.message}`);
        }
    } else if (lower.endsWith('.rar')) {
        throw new Error(`RAR formatı 7za binary'si tarafından desteklenmemektedir (RAR5 dekompresyonu için node-unrar-js paketi gereklidir). Lütfen .zip veya .7z formatı kullanın.`);
    } else {
        throw new Error(`Desteklenmeyen arşiv formatı: ${archivePath}. Desteklenen formatlar: ${SUPPORTED_FORMATS.join(', ')}`);
    }
}

module.exports = {
    extractArchive,
    supportsFormat,
    getSupportedFormats
};
