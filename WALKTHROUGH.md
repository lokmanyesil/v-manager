# V-Manager Manifest Tabanlı Modül Sistemi & Manifest Oluşturucu Raporu

V-Manager içerisine yeni modlar için **manifest tabanlı mod kurulum sistemi** ve **grafiksel Manifest Oluşturucu (Manifest Builder)** arayüzü başarıyla eklenmiştir.

---

## 📁 Dizin ve Dosya Mimarisi

```text
src/
├── main/
│   ├── modules/
│   │   ├── core/
│   │   │   ├── archive.js             ← Ortak ZIP / 7Z extractor
│   │   │   ├── githubFetcher.js       ← Ortak GitHub release fetch, asset glob matcher, stream download
│   │   │   ├── configEditor.js        ← INI & JSON config düzenleyici
│   │   │   ├── conditionChecker.js    ← Koşul motoru (file_exists, check_conflicts, enabled:false atlama)
│   │   │   ├── backup.js              ← Snapshot backup / restore motoru
│   │   │   ├── manifestValidator.js   ← Manifest JSON şema doğrulayıcı
│   │   │   ├── moduleLogger.js        ← Pipeline adım loglayıcısı (✓ / ⚠ / ✗)
│   │   │   ├── moduleEngine.js        ← 18 adımlı kurulum, proxy detection, AV kontrolü, FIX 2e ve uninstall motoru
│   │   │   └── moduleManager.js       ← Modül keşfi (official -> community -> custom AppData), IPC kayıtları ve save/delete
│   │   │
│   │   ├── official/
│   │   │   ├── dummy-mod/manifest.json
│   │   │   └── dlssenabler/manifest.json
│   │   │
│   │   ├── test-module-system.js      ← 35 adımlık birim test paketi
│   │   └── test-e2e-dlssenabler.js    ← DLSS Enabler canlı GitHub & geriye dönük uyumluluk testi
│   │
│   ├── ipc.js                         ← [DEĞİŞTİ] moduleManager.registerIpcHandlers(ipcMain)
│   └── index.js                       ← [DEĞİŞTİ] moduleManager.init()
│
├── renderer/
│   ├── ui/
│   │   ├── mods-tab.js                ← [DEĞİŞTİ] 'Mod Sürümleri' ve 'Manifest Oluşturucu' alt sekmeleri (sub-nav)
│   │   ├── manifest-builder.js        ← Form yönetimi, canlı JSON önizleme, debounce validasyon ve AppData kaydı
│   │   └── ...
│   ├── i18n/                          ← [DEĞİŞTİ] tr.js ve en.js içine mods.versionsTab ve mods.builderTab eklendi
│   └── index.js                       ← initManifestBuilder() entegrasyonu
│
├── index.html                         ← [DEĞİŞTİ] 'Modlar' sekmesi içinde 2. alt sekme (Mod Sürümleri | Manifest Oluşturucu)
├── preload.js                         ← moduleSaveManifest, moduleDeleteCustomManifest, moduleValidateManifest vb.
└── styles.css                         ← [DEĞİŞTİ] .mods-sub-nav stilleri ve koyu/açık tema input iyileştirmeleri
```

---

## 🛡️ Güvenlik ve Mimari Kararları

1. **Kök Tarama Sırası (`_getModuleRoots`)**:
   - `official` → `community` → `custom` (`%AppData%/userData/modules`)
   - `custom` kökü **en son** taranır. Böylece resmi ve topluluk modüllerinin gölgelenmesi (shadowing) imkansızdır.
2. **Proaktif ID Çakışma Kontrolü (`module-save-manifest`)**:
   - Kayıt anında `manifest.id` kontrol edilir. Eğer bu ID resmi/topluluk modüllerinden birine aitse (`dlssenabler`, `dummy-mod` vb.) kayıt anında reddedilir.
3. **Kaynak Doğrulamalı Silme (`module-delete-custom-manifest`)**:
   - Sadece `type === 'custom'` olan özel manifestler silinebilir. Resmi/topluluk dosyalarına asla dokunulmaz.
4. **Otomatik Dizin Oluşturma (`mkdirSync`)**:
   - `%AppData%/userData/modules/<id>/` klasörü kayıt sırasında otomatik garanti altına alınır.
5. **UI Debounce & Canlı Önizleme**:
   - Form değiştikçe canlı JSON önizleme ve IPC doğrulaması 300ms debounce ile çalışır.

---

## 🧪 Test Sonuçları

### 1. Birim Test Paketi (`node src/main/modules/test-module-system.js`)
* **37 Test Adımı**: `manifestValidator`, `moduleLogger`, `archive` (ZIP/7Z/RAR), `githubFetcher`, `configEditor` (JSON, INI dot notation, INI nested objects & raw INI syntax), `conditionChecker`, `dummy-mod`, `dlssenabler`, geriye dönük uyumluluk, AppData custom manifest kaydetme, resmi mod ID çakışması proaktif reddi, resmi mod silme engeli ve özel manifest silme.
* **Sonuç**: **37/37 BAŞARILI (0 Hata)**

### 2. Uçtan Uca Entegrasyon Testi (`node src/main/modules/test-e2e-dlssenabler.js`)
* **Sonuç**: **%100 BAŞARILI** (Canlı GitHub release indirme, proxy tespiti, AV gecikmesi, conditional uninstall ve backward-compatibility).
