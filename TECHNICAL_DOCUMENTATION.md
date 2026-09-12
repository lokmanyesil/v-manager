# DLSS 5 Swapper — Detaylı Teknik Dokümantasyon

> **Versiyon:** 2.2.1  
> **Yazar:** Rakan Alkhaldi  
> **Lisans:** MIT  
> **Platform:** Windows (birincil), Linux (Steam Proton desteğiyle)

---

## İçindekiler

1. [Projeye Genel Bakış](#1-projeye-genel-bakış)
2. [Mimari ve Teknoloji Yığını](#2-mimari-ve-teknoloji-yığını)
3. [Dizin Yapısı](#3-dizin-yapısı)
4. [Ana Süreç (Main Process)](#4-ana-süreç-main-process)
5. [Oyun Kütüphanesi Keşif Sistemi](#5-oyun-kütüphanesi-keşif-sistemi)
6. [Oyun Tarama Motoru (Scanner)](#6-oyun-tarama-motoru-scanner)
7. [PE Dosya Çözümleyicisi](#7-pe-dosya-çözümleyicisi)
8. [Kurulum Rotaları (Install Routes)](#8-kurulum-rotaları-install-routes)
9. [Kurulum Motoru (Apply Engine)](#9-kurulum-motoru-apply-engine)
10. [Backend Yöneticisi ve Dosya Journal](#10-backend-yöneticisi-ve-dosya-journal)
11. [OptiScaler Entegrasyonu](#11-optiscaler-entegrasyonu)
12. [Vulkan Katman Yönetimi](#12-vulkan-katman-yönetimi)
13. [Emülatör Desteği](#13-emülatör-desteği)
14. [Uyumluluk ve Güvenlik Kontrolleri](#14-uyumluluk-ve-güvenlik-kontrolleri)
15. [Yedekleme ve Geri Yükleme Sistemi](#15-yedekleme-ve-geri-yükleme-sistemi)
16. [Add-on Yönetim Sistemi (RenoDX)](#16-add-on-yönetim-sistemi-renodx)
17. [Oyun-İçi Overlay Sistemi](#17-oyun-içi-overlay-sistemi)
18. [Steam Artwork Servisi](#18-steam-artwork-servisi)
19. [Harici Bileşen Yönetimi (Runtime Components)](#19-harici-bileşen-yönetimi-runtime-components)
20. [Geçmiş (History) Sistemi](#20-geçmiş-history-sistemi)
21. [Uluslararasılaştırma (i18n)](#21-uluslararasılaştırma-i18n)
22. [Renderer (UI) Katmanı](#22-renderer-ui-katmanı)
23. [Build ve Dağıtım Süreci](#23-build-ve-dağıtım-süreci)
24. [Test Altyapısı](#24-test-altyapısı)
25. [Veri Akış Diyagramı](#25-veri-akış-diyagramı)

---

## 1. Projeye Genel Bakış

**DLSS 5 Swapper**, kullanıcının bilgisayarında yüklü olan oyunları otomatik olarak bulan ve NVIDIA'nın DLSS 5 (Neural Rendering) teknolojisini bu oyunlara tek tıklamayla kuran bir masaüstü uygulamasıdır.

### Temel Yetenekler

- **Otomatik Oyun Keşfi:** Steam, Epic Games, GOG launcher'larını ve disk üzerindeki loose/repack kurulumları otomatik olarak tarar
- **Çoklu Kurulum Rotası:** Native, Feeder ve OptiScaler olmak üzere üç farklı kurulum yöntemi
- **Tam Yedekleme/Geri Yükleme:** Her kurulum öncesinde orijinal dosyaların tam yedeği alınır; tek tıklamayla geri dönülebilir
- **PE Analizi:** Oyun çalıştırılabilirlerinin import tabloları ve ikili içeriklerini okuyarak grafik API'sini otomatik algılar
- **19 Emülatör Profili:** DuckStation, PCSX2, Dolphin, RPCS3, Xenia gibi emülatörler için önceden tanımlı profiller
- **Oyun-İçi Overlay:** Offscreen BrowserWindow + Named Pipe ile C++ ImGui arayüzüne bağlanan canlı kontrol paneli
- **Steam Artwork:** Tüm oyunlar için otomatik kapak/poster indirme (hiçbir API anahtarı gerektirmez)
- **Linux Desteği:** Steam Proton üzerinden çalışan Windows oyunları desteklenir
- **Transaksiyonel Kurulum:** Write-Ahead Log (WAL) bazlı journal sistemi ile yarıda kalan kurulumlar güvenle kurtarılır

---

## 2. Mimari ve Teknoloji Yığını

```
┌──────────────────────────────────────────────────────┐
│                    Electron v33                       │
├─────────────────────┬────────────────────────────────┤
│   Main Process      │      Renderer Process          │
│   (Node.js)         │      (Chromium)                │
│                     │                                │
│ ┌─────────────────┐ │  ┌──────────────────────────┐  │
│ │ Library Scanner │ │  │ renderer.js (SPA UI)     │  │
│ │ PE Analyzer     │ │  │ style.css                │  │
│ │ Apply Engine    │ │  │ i18n.js (çok dilli)      │  │
│ │ Backend Manager │ │  │ game-filters.js          │  │
│ │ File Journal    │ │  │ overlay-panel.js         │  │
│ │ History Store   │ │  │ overlay-live.js          │  │
│ │ Overlay Bridge  │ │  │ overlay-gallery.js       │  │
│ │ Steam Art       │ │  └──────────────────────────┘  │
│ └─────────────────┘ │                                │
├─────────────────────┴────────────────────────────────┤
│              Preload (contextBridge)                  │
│         50+ IPC kanalı, contextIsolation: true       │
├──────────────────────────────────────────────────────┤
│             Overlay C++ (ImGui / DX12)                │
│          Named Pipe ↔ Offscreen BrowserWindow        │
└──────────────────────────────────────────────────────┘
```

### Bağımlılıklar

| Paket | Amaç |
|-------|-------|
| `electron` v33+ | Masaüstü uygulama çatısı |
| `electron-builder` | Windows (NSIS/portable) ve Linux (AppImage/deb) paketleme |
| `extract-zip` | Harici bileşenlerin (OptiScaler, dgVoodoo, LumeniteFX) arşivlerini açma |

> **Not:** Proje kasıtlı olarak minimum bağımlılıkla çalışır. HTTP istekleri Node.js'in yerleşik `fetch` API'si ile, PE okuma tamamen elle yazılmış bir parser ile yapılır.

---

## 3. Dizin Yapısı

```
DLSS5-Swapper-main/
├── main.js                    # Electron ana süreç (1065 satır)
├── preload.js                 # contextBridge API tanımları
├── overlay-preload.js         # Overlay penceresi preload
├── package.json               # Proje yapılandırması
│
├── src/
│   ├── core/                  # İş mantığı modülleri
│   │   ├── scan.js            # Oyun dizini tarama ve PE analizi
│   │   ├── apply.js           # DLL swap, yedekleme ve ReShade kurulumu
│   │   ├── pe.js              # Windows PE dosya çözümleyicisi
│   │   ├── backend-manager.js # Rota değiştirme ve transaksiyonel kurulum
│   │   ├── file-journal.js    # Write-ahead log tabanlı kurtarma sistemi
│   │   ├── history.js         # Kurulum geçmişi audit log'u
│   │   ├── compatibility.js   # Anti-cheat, mod yöneticisi kontrolleri
│   │   ├── install-guards.js  # Oyun çalışıyor mu kontrolü, GPU doğrulama
│   │   ├── optiscaler.js      # OptiScaler DLSS-NR indirme/kurulum
│   │   ├── vulkan-layer.js    # Vulkan implicit layer kayıt yönetimi
│   │   ├── emulators.js       # 19 emülatör profili
│   │   ├── feeder-config.js   # ReShade INI/preset yapılandırma
│   │   ├── feeder-release.js  # Feeder build hash doğrulama
│   │   ├── runtime-components.js  # LumeniteFX, dgVoodoo indirme
│   │   ├── proton.js          # Linux/Proton desteği
│   │   ├── game-menu.js       # Oyun kartı sağ tık menüsü
│   │   └── project-links.js   # Dış bağlantı URL'leri
│   │
│   ├── shared/                # Main + Renderer arasında paylaşılan modüller
│   │   ├── install-routes.js  # Kurulum rotası seçim mantığı
│   │   ├── rendering-api.js   # Grafik API doğrulama
│   │   ├── anti-cheat-warning.js  # Anti-cheat uyarı diyaloğu
│   │   └── feature-i18n.js    # 282KB çeviri veritabanı
│   │
│   ├── renderer/              # UI dosyaları (HTML/CSS/JS)
│   │   ├── index.html         # Ana uygulama HTML'i
│   │   ├── renderer.js        # 51KB SPA mantığı
│   │   ├── style.css          # 41KB stil dosyası
│   │   ├── i18n.js            # Dil seçimi ve çeviri
│   │   ├── game-filters.js    # Oyun filtre/sıralama
│   │   ├── overlay-*.js/css   # Overlay UI bileşenleri
│   │   └── icon.png           # Uygulama ikonu
│   │
│   ├── library.js             # Oyun kütüphanesi keşif motoru
│   ├── steamart.js            # Steam Store API üzerinden artwork
│   ├── overlays.js            # Overlay kütüphane yönetimi
│   ├── overlay-bridge.js      # Named pipe köprüsü
│   ├── overlay-ipc.js         # Overlay IPC kanalları
│   ├── overlay-protocol.js    # İkili protokol (frame/input kodlama)
│   ├── overlay-preferences.js # Overlay tercihleri
│   └── game-overlay.js        # Oyun kurulumu sırasında overlay ekleme
│
├── overlay/                   # C++ overlay kaynakları
│   ├── overlay.cpp            # ImGui panel + DX12 entegrasyonu
│   ├── feeder-controls.hpp    # Feeder parametreleri UI
│   ├── live-controls.hpp      # Canlı ReShade kontrolleri
│   ├── renodx-ui-bridge.hpp   # RenoDX komut köprüsü
│   ├── renodx-ui-probe.hpp    # RenoDX durum algılama
│   ├── overlay-hotkey.hpp     # F8 kısayol tuşu yönetimi
│   └── smoke-host-dx12.cpp    # DX12 test/demo sunucusu
│
├── scripts/                   # Build ve test yardımcıları
│   ├── collect-payload.js     # Payload klasörü derleme
│   ├── build-overlay.ps1      # C++ overlay derleme
│   ├── make-icon.js           # .ico dosya üretimi
│   └── test-*.js              # Test yardımcıları
│
├── test/                      # 29 test dosyası
│   ├── *.test.js              # Node.js test runner testleri
│   └── fixtures/              # Test sabitleri
│
└── docs/                      # Ekran görüntüleri ve demo
    ├── banner.png
    ├── demo.gif
    └── screenshots/
```

---

## 4. Ana Süreç (Main Process)

`main.js` dosyası (1065 satır) Electron'un ana sürecini oluşturur ve tüm iş mantığını koordine eder.

### Pencere Oluşturma

```javascript
// Frameless pencere, özel başlık çubuğu
win = new BrowserWindow({
  width: 1280, height: 860,
  minWidth: 1040, minHeight: 700,
  backgroundColor: '#05070a',
  frame: false,           // Pencere kendi title bar'ını çizer
  webPreferences: {
    preload: 'preload.js',
    contextIsolation: true,   // Güvenlik: renderer Node.js'e erişemez
    nodeIntegration: false
  }
});
```

### IPC Kanalları

Toplam **50+'den fazla** IPC kanalı tanımlıdır. Önemli olanlar:

| Kanal | Yön | Açıklama |
|-------|------|----------|
| `boot` | R→M | Versiyon, tema, dil, logo URL'lerini alır |
| `library` | R→M | Tüm oyun listesini döner (Steam + Epic + GOG + loose) |
| `scan` | R→M | Tek bir oyun dizinini tarar (API, bitness, DLSS versiyonu) |
| `install` | R→M | DLSS 5 kurulumunu başlatır |
| `restore` | R→M | Oyunu orijinal haline geri döndürür |
| `details` | R→M | Oyun detaylarını (exe listesi, rotalar, uyumluluk) döner |
| `addons` | R→M | RenoDX add-on kütüphanesini listeler |
| `addon-toggle` | R→M | Add-on'u açar/kapar |
| `history` | R→M | Kurulum geçmişini döner |
| `art-fetch` | R→M | Steam artwork'ünü indirir/önbellekler |
| `job` | M→R | Kurulum ilerleme olaylarını renderer'a gönderir |

### Durum Yönetimi

Uygulama durumu `%APPDATA%/dlss5-swapper/library.json` dosyasında JSON olarak saklanır:

```javascript
{
  folders: [],         // Kullanıcının eklediği tarama klasörleri
  excludedRoots: [],   // Hariç tutulan kök dizinler
  manual: [],          // Manuel eklenen oyun yolları
  posters: {},         // Özel poster yolları (key: SHA1 hash)
  hidden: [],          // Gizlenen oyun dizinleri
  scans: {},           // Önbelleğe alınmış tarama sonuçları
  recents: [],         // Son erişilen oyunlar
  addons: [],          // Aktif add-on dosya yolları
  addonFiles: [],      // Kullanıcının eklediği add-on tanımları
  art: {},             // İndirilen artwork URL'leri
  apiOverrides: {},    // Kullanıcının manuel API tercihleri
  theme: 'light',      // Tema tercihi
  lang: 'en'           // Dil tercihi
}
```

### Mutex (Eşzamanlılık Kontrolü)

```javascript
let mutationBusy = false;

async function exclusiveMutation(work) {
  if (mutationBusy) return { ok: false, code: 'errJobBusy' };
  mutationBusy = true;
  try { return await work(); }
  finally { mutationBusy = false; }
}
```

Aynı anda yalnızca **tek bir kurulum/geri yükleme** işlemi çalışabilir. Bu, dosya çakışmalarını ve veri bozulmasını önler.

---

## 5. Oyun Kütüphanesi Keşif Sistemi

`src/library.js` modülü, bilgisayarda kurulu oyunları üç katmanlı bir stratejiyle bulur:

### Katman 1: Launcher Veritabanları

| Launcher | Kaynak | Yöntem |
|----------|--------|--------|
| **Steam** | `libraryfolders.vdf` → `appmanifest_*.acf` | Valve KeyValues formatını regex ile parse eder |
| **Epic Games** | `C:\ProgramData\Epic\...\Manifests\*.item` | JSON manifest dosyalarını okur |
| **GOG** | `HKLM\SOFTWARE\WOW6432Node\GOG.com\Games\*` | Windows Registry sorgular |

**Steam Kütüphane Keşfi:**
1. Registry'den Steam kök dizini okunur (`HKCU\Software\Valve\Steam\SteamPath`)
2. `libraryfolders.vdf` parse edilerek tüm kütüphane yolları çıkarılır
3. Her kütüphanedeki `appmanifest_*.acf` dosyaları taranır
4. Poster görüntüler `appcache/librarycache` klasöründen alınır

### Katman 2: Otomatik Disk Tarama

Kullanıcı "Otomatik Disk Tarama" özelliğini açtığında:

1. `Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"` ile sabit diskler listelenir
2. Her diskin kök dizinindeki klasörler taranır
3. Klasör isimleri `LIBRARY_NAME` regex'ine karşı kontrol edilir (ör: `Games`, `SteamLibrary`, `Repacks`)
4. İsmi tanınmayan klasörler için **içerik analizi** yapılır: çoğunluğu `.exe` içeren alt-klasörler oyun kütüphanesi olarak kabul edilir

```javascript
const LIBRARY_NAME = /^(games?|my ?games|steamlibrary|gog ?games|
                         epic ?games|xbox ?games|origin ?games|
                         repacks?|emulation)$/i;
```

### Katman 3: Manuel Ekleme

Kullanıcı `addFolder()` veya `addGame()` ile dizin seçebilir. Sürükle-bırak da desteklenir.

### Deduplikasyon

```javascript
function dedupe(games) {
  // Aynı dizine işaret eden girişlerde launcher kaydı önceliklidir
  // DLC (ör: Phantom Liberty) ana oyuna birleştirilir
}
```

---

## 6. Oyun Tarama Motoru (Scanner)

`src/core/scan.js` bir oyun dizinini derinlemesine analiz eder ve şu bilgileri döner:

### Dizin Ağacı Taraması

```javascript
const MAX_SCAN_DEPTH = 12;

const SKIP_DIRS = new Set([
  '_dlss5_backup', 'reshade-shaders', 'node_modules', '.git',
  'paks', 'movies', 'screenshots', 'saved', 'logs',
  'mods', '_redist', 'prerequisites', 'directx', 'redist',
  'eaanticheat', 'easyanticheat', 'battleye',
  'backup', 'backups', 'old', 'original'
]);
```

BFS (Breadth-First Search) ile klasörler taranır; her `.exe` dosyası aday olarak değerlendirilir.

### Çalıştırılabilir Eleme

```javascript
// Launcher/installer/anti-cheat yardımcıları filtrelenir
const NOT_A_GAME = /^(unins|setup|install|vcredist|dxsetup|
                       crashreport|easyanticheat|battleye|
                       launcher|benchmark|modorganizer|...)/i;
```

### Grafik API Algılama (4 Kademeli)

Her aday exe için sırasıyla dört yöntem denenir:

1. **Import Tablosu Analizi** (`via: 'imports'`): PE import tablosundaki DLL isimlerine bakılır
   - `d3d12.dll` → DirectX 12
   - `d3d11.dll` → DirectX 11
   - `vulkan-1.dll` → Vulkan
   - `d3d9.dll` → DirectX 9
   - ve diğerleri...

2. **Binary String Arama** (`via: 'strings'`): Export tablosu/string sabitleri taranır
   - `D3D12CreateDevice`, `D3D12SDKPath` → DirectX 12
   - `vkCreateInstance` → Vulkan

3. **Modül Analizi** (`via: 'module:...'`): Exe'nin import ettiği yan DLL'ler incelenir
   - Örn: Control oyunu `d3d_rmdwin10_f.dll` import eder → bu DLL D3D12 import eder

4. **Dosya Adı Eşleme** (`via: 'filename'`): `farcry3_d3d11.exe` → DirectX 11

5. **Motor Profili** (`via: 'engine-module:...'`): Source Engine, GoldSrc gibi motorlar için özel DLL listesi

### Oyun Profilleri

Bazı oyunlar özel işlem gerektirir:

```javascript
function gameApiProfile(file) {
  // RDR2: D3D9 marker'ı var ama aslında DX12/Vulkan kullanır
  if (/^rdr2\.exe$/i.test(path.basename(file))) {
    return {
      detected: { api: 'dxgi', label: 'DirectX 12' },
      choices: [
        { api: 'dxgi', label: 'DirectX 12' },
        { api: 'vulkan', label: 'Vulkan' }
      ]
    };
  }
}
```

### Xbox/GDK Oyun Desteği

GDK oyunlarının exe dosyaları şifrelenmiş olabilir. Bu durumda `MicrosoftGame.config` XML dosyası parse edilerek exe yolu ve mimari bilgisi çıkarılır:

```xml
<Executable Name="Game.exe" Architecture="x64" Id="Game" />
```

### Sıralama ve Seçim

Bulunan tüm exe adayları puanlanır:

```javascript
exeCandidates.sort((a, b) =>
  (b.emulator - a.emulator) ||   // Emülatörler önce
  (b.declared - a.declared) ||   // Xbox manifest'i önce
  (b.dx12 - a.dx12) ||          // DX12 önce
  (playableRoleScore(b) - playableRoleScore(a)) ||  // SP > MP
  (a.depth - b.depth) ||        // Sığ dizin önce
  (b.size - a.size)             // Büyük dosya önce
);
```

### ReShade Algılama

```javascript
function inspectReShade(exeDir) {
  // dxgi.dll, d3d12.dll, d3d11.dll, d3d9.dll, opengl32.dll, *.asi
  // Versiyon kaynağında "ReShade" metni aranır
  // Add-on desteği: "Searching for add-ons" string'i aranır
}
```

---

## 7. PE Dosya Çözümleyicisi

`src/core/pe.js` modülü, herhangi bir harici kütüphane **kullanmadan** Windows PE (Portable Executable) dosyalarını okur.

### Yetenekler

| Fonksiyon | Açıklama |
|-----------|----------|
| `readHeaders(fd)` | DOS/COFF/PE başlıklarını parse eder; bölüm tablosunu çıkarır |
| `rvaToOffset(h, rva)` | Virtual adresi dosya offset'ine çevirir |
| `getImports(file)` | Normal + delay-loaded import DLL isimlerini döner |
| `getBitness(file)` | PE32 → 32-bit, PE32+ → 64-bit ayrımı yapar |
| `findMarkers(file, markers)` | İkili dosyada ASCII string'leri arar (4MB chunk'larla) |
| `getFileVersion(file)` | `VS_FIXEDFILEINFO` veya `FileVersion` string'inden versiyon çıkarır |
| `versionMentions(file, text)` | Versiyon kaynağında UTF-16 metin arar |

### Import Tablosu Okuma

```
PE Dosya Yapısı:
┌─────────────┐
│ DOS Header  │ → e_lfanew → PE offset
├─────────────┤
│ COFF Header │ → section sayısı, optional header boyutu
├─────────────┤
│ Optional    │ → PE32 (0x10b) veya PE32+ (0x20b)
│ Header      │ → Data Directory (import tablosu RVA'sı)
├─────────────┤
│ Section     │ → RVA → File offset dönüşümü
│ Table       │
├─────────────┤
│ Import Dir  │ → Her 20 byte'lık giriş bir DLL
│ (DataDir[1])│ → Name RVA → dosya adı string'i
├─────────────┤
│ Delay Import│ → Her 32 byte'lık giriş bir DLL
│ (DataDir[13])│ → d3d12.dll gibi geç yüklenenler
└─────────────┘
```

### Versiyon Kaynağı Okuma

1. Resource Directory (`DataDir[2]`) parse edilir
2. `RT_VERSION (16)` türündeki kaynak bulunur
3. `VS_FIXEDFILEINFO` yapısında `dwFileVersionMS` / `dwFileVersionLS` okunur
4. Eğer boşsa, `FileVersion` / `ProductVersion` UTF-16 string tablolarına düşülür

---

## 8. Kurulum Rotaları (Install Routes)

`src/shared/install-routes.js` her oyun yapılandırmasına uygun kurulum rotalarını belirler.

### Üç Rota

| Rota | Hedef | Mekanizma | Gereklilik |
|------|-------|-----------|------------|
| **native** | 64-bit DX12 | Doğrudan DLL değiştirme + RenoDX add-on | Oyunun kendi DLSS desteği olmalı |
| **feeder** | Tüm API'ler (DX8-12, Vulkan, OpenGL) | ReShade + Feed shader + motion vektörü üretimi | Tüm oyunlarda çalışır |
| **optiscaler** | 64-bit DX11/12/Vulkan | OptiScaler DLSS-NR proxy | Native DLSS gerekir |

### Rota Seçim Mantığı

```javascript
function routesFor(target, api) {
  if (target.bitness === 32 || target.emulator)
    return ['feeder'];  // 32-bit sadece feeder destekler

  if (api === 'dxgi' && target.apiLabel === 'DirectX 12')
    return ['native', 'feeder', 'optiscaler?'];

  if (['d3d9', 'opengl', 'vulkan'].includes(api))
    return ['feeder', 'optiscaler?'];

  if (api === 'd3d8')
    return target.bitness === 32 ? ['feeder'] : [];
}
```

### Önerilen Rota

```javascript
function recommendedRoute(scan, target) {
  // Önceden feeder kurulanlar → feeder
  // Native DLSS var → native
  // Aksi halde → feeder
}
```

---

## 9. Kurulum Motoru (Apply Engine)

`src/core/apply.js` (860 satır) dosya operasyonlarını gerçekleştirir.

### Native Rota İş Akışı (`applySwap`)

```
1. Yazma izni kontrolü (canWrite)
2. Payload doğrulama (nvngx_dlssnr.dll var mı?)
3. Manifest başlatma (beginManifest)
4. Mevcut DLSS DLL'lerini yeni versiyonla değiştirme
   - Aynı versiyonlar atlanır
   - Mimari uyumsuzluğu rapor edilir
5. Eksik dosyaları ekleme (nvngx_dlssnr.dll, nvngx_dlss.dll)
6. RenoDX add-on'unu kopyalama
7. ReShade kurulumu (yoksa veya add-on desteksizse)
   a. Bundled ReShade DLL kullanma (öncelikli)
   b. ReShade Setup.exe headless çalıştırma (yedek)
   c. Xbox helper üzerinden kurma (şifreli exe'ler için)
8. ReShade INI yapılandırma
9. Manifest kaydetme
```

### Feeder Rota İş Akışı (`applyFeeder`)

```
1. Yazma izni ve payload kontrolü
2. API'ye göre ön hazırlık:
   - D3D8/D3D9 → dgVoodoo kurulumu (DX11'e çeviri)
   - Vulkan → Vulkan implicit layer kaydı
   - Diğerleri → Standart ReShade kurulumu
3. Feeder add-on kopyalama (dlss5-feed.addon64/32)
4. ReShade shader'larını kopyalama
5. LumeniteFX shader'larını kopyalama (varsa, motion vektörü)
6. VORT shader'ları fallback olarak (LumeniteFX indirilemezse)
7. ReShade.ini yapılandırma:
   - Shader yolları
   - Preset dosyası oluşturma
   - Add-on etkinleştirme
8. Feed config (dlss5-feed.cfg) oluşturma
9. 32-bit oyunlar için host64 alt süreç kurulumu:
   - dlss5-feed-host64.exe
   - 64-bit ReShade + nvngx_dlssnr.dll + nvngx_dlss.dll
10. Manifest kaydetme
```

### Yedekleme Stratejisi

```
<oyun_dizini>/
  _DLSS5_Backup/
    originals/<uuid>/
      <dosya_ağacı>        ← Orijinal dosyaların kopyası
    manifest.json          ← Kurulum detayları + dosya listesi
    .profiles/             ← Backend rotası config profilleri
    .transactions/         ← WAL journal dosyaları
    pending-switch.json    ← Devam eden işlem işaretçisi
```

### Manifest Yapısı

```json
{
  "version": 1,
  "backupPrefix": "originals/<uuid>",
  "date": "2026-09-04T14:30:00.000Z",
  "game": {
    "dir": "C:\\Games\\MyGame",
    "exe": "bin\\x64\\Game.exe",
    "api": "dxgi",
    "apiLabel": "DirectX 12",
    "bitness": 64
  },
  "route": "native",
  "replaced": [
    { "rel": "bin\\x64\\nvngx_dlss.dll", "oldVersion": "3.7.0.0", "newVersion": "310.8.0.0" }
  ],
  "added": [
    "bin\\x64\\nvngx_dlssnr.dll",
    "bin\\x64\\renodx-dlss5.addon64"
  ],
  "addedDirs": ["bin\\x64\\host64"],
  "reshade": {
    "installedByUs": true,
    "file": "dxgi.dll",
    "filesAdded": ["ReShade.ini", "ReShadePreset.ini"]
  }
}
```

---

## 10. Backend Yöneticisi ve Dosya Journal

### Backend Manager (`src/core/backend-manager.js`)

Rota değiştirme (ör: native → feeder) sırasında:

1. Mevcut manifest okunur
2. Mevcut config profili kaydedilir (`saveProfile`)
3. Mevcut kurulum geri yüklenir (`restoreFiles`)
4. Yeni rota için kaydedilmiş profil yüklenir (`loadProfile`)
5. Yeni kurulum yapılır

### Dosya Journal (`src/core/file-journal.js`)

Write-Ahead Log (WAL) tabanlı transaksiyonel dosya sistemi:

```
transaction(gameDir, work):
  1. pending-switch.json oluştur
  2. Her dosya değişikliği öncesinde capture() çağır:
     a. Orijinal dosyayı .transactions/<uuid>/<N>.bin olarak kopyala
     b. pending-switch.json'u güncelle
  3. İş başarılı → pending-switch.json sil, snapshot'ları temizle
  4. İş başarısız → recover() çağır:
     a. Tüm capture edilen dosyaları geri kopyala
     b. Eklenen dosyaları sil
     c. Oluşturulan boş dizinleri kaldır
```

**Güvenlik Kontrolleri:**
- `safePath()`: Path traversal saldırılarını engeller (`..\`, sembolik bağlantılar)
- Symlink kontrolü: Hedef yoldaki her seviyede `lstatSync` ile kontrol edilir
- Atomik JSON yazma: `temp.json.tmp` → `rename` → `manifest.json`

---

## 11. OptiScaler Entegrasyonu

`src/core/optiscaler.js` OptiScaler DLSS-NR'yi indirip kurar.

### İş Akışı

```
1. ensureOptiScaler(cacheRoot):
   - GitHub'dan zip indir (SHA-256 doğrula)
   - Arşivi aç
   - Lisans dosyasını indir (SHA-256 doğrula)
   - validatePayload() ile tüm DLL'lerin 64-bit olduğunu kontrol et

2. checkConflicts(gameDir, exePath, manifest, api):
   - Mevcut proxy DLL'leri kontrol et (dxgi.dll, winmm.dll)
   - Mevcut OptiScaler kurulumu var mı?
   - ASI loader çakışması var mı?

3. install(config, log):
   - copyPlan() ile dosya listesi oluştur:
     - OptiScaler.dll → dxgi.dll (veya winmm.dll for Vulkan)
     - nvngx.dll_dlssnr.dll
     - OptiScaler/*.dll kütüphaneleri
     - Lisans dosyaları
   - OptiScaler.ini yapılandır:
     - DLSS-NR etkinleştir
     - Hedef işlem adını ayarla
     - Upscaler'ları yapılandır
```

### Kopyalanan Dosyalar

```
<oyun_dizini>/
  dxgi.dll              ← OptiScaler.dll (API hook)
  nvngx.dll_dlssnr.dll  ← Neural Rendering runtime
  nvngx_dlssnr.dll      ← DLSS NR payload'dan
  OptiScaler.ini         ← Yapılandırma
  OptiScaler/
    D3D12Core.dll
    libxess.dll
    amd_fidelityfx_*.dll
    licenses/
      LICENSE.GPL-3.0.txt
      ...
```

---

## 12. Vulkan Katman Yönetimi

`src/core/vulkan-layer.js` Vulkan için implicit layer kaydı yönetir.

Vulkan, DirectX'ten farklı olarak DLL proxy kullanmaz. Bunun yerine **Windows Registry**'de implicit layer olarak kaydedilir:

```
HKCU\Software\Khronos\Vulkan\ImplicitLayers
  <yol>\ReShade64.json = REG_DWORD 0x00000000
```

### Çoklu Oyun Desteği

```javascript
// installs.json: Hangi oyunların bu layer'ı kullandığını izler
{ "version": 1, "games": ["C:\\Games\\Game1", "C:\\Games\\Game2"] }
```

- **Kayıt:** Layer dosyaları kopyalanır, registry'e eklenir, oyun listeye eklenir
- **Kaldırma:** Oyun listeden çıkarılır. Liste boşalırsa registry kaydı ve dosyalar silinir

---

## 13. Emülatör Desteği

`src/core/emulators.js` modülü 19 emülatör profilini içerir:

| Emülatör | Platform | Desteklenen API'ler |
|----------|----------|---------------------|
| DuckStation | PlayStation 1 | DX11/12, Vulkan, OpenGL |
| PCSX2 | PlayStation 2 | DX11/12, Vulkan, OpenGL |
| Dolphin | GameCube/Wii | DX11/12, Vulkan, OpenGL |
| PPSSPP | PSP | DX11, Vulkan, OpenGL |
| Xenia | Xbox 360 | DX12, Vulkan |
| Cemu | Wii U | Vulkan, OpenGL |
| RPCS3 | PlayStation 3 | Vulkan, OpenGL |
| Ryujinx | Switch | Vulkan, OpenGL |
| yuzu/suyu/Eden/Citron | Switch | Vulkan, OpenGL |
| shadPS4 | PlayStation 4 | Vulkan |
| Azahar/Citra | 3DS | Vulkan, OpenGL |
| melonDS | DS | OpenGL |
| Flycast | Dreamcast | DX11, Vulkan, OpenGL |
| xemu | Xbox | Vulkan, OpenGL |
| Vita3K | PS Vita | Vulkan, OpenGL |
| RetroArch | Çoklu | DX11/12, Vulkan, OpenGL |
| mGBA | GBA | OpenGL |
| Snes9x | SNES | DirectX |
| Play! | PlayStation 2 | Vulkan, OpenGL |

Her profil, exe dosya adı eşleştirmesi ile algılanır ve statik PE analizi yerine profildeki API listesi kullanılır.

---

## 14. Uyumluluk ve Güvenlik Kontrolleri

`src/core/compatibility.js` ve `src/core/install-guards.js` modülleri:

### Anti-Cheat Algılama

```javascript
function hasAntiCheat(gameDir, exePath) {
  // EasyAntiCheat, BattlEye klasör varlığı kontrol edilir
  // ARC Raiders özel kontrolü
  return guards.antiCheatPresent(dir);
}
```

Anti-cheat algılandığında kullanıcıya uyarı diyaloğu gösterilir; onay olmadan kurulum yapılmaz.

### Mod Yöneticisi Algılama

```javascript
function managedModRoot(gameDir, exePath) {
  // ModOrganizer.exe + "Stock Game" klasörü aranır
  // Bulunursa "errManagedModpack" hatası fırlatılır
}
```

### Loader Çakışması Kontrolü

```javascript
function assertLoaderCompatible(config, manifest) {
  // Exe dizinindeki her proxy DLL kontrol edilir:
  // - Birden fazla ReShade hook → hata
  // - Tanınmayan proxy DLL → hata
  // - DXVK/vkd3d wrapper'ları → izin verilir (Vulkan rotasında)
  // - Mevcut add-on ReShade → yeniden kullanılabilir (native rotada)
}
```

### GPU Doğrulama

OptiScaler rotasında GPU bilgisi sorgulanır ve desteklenmeyen donanım reddedilir.

---

## 15. Yedekleme ve Geri Yükleme Sistemi

### Yedekleme

Her dosya operasyonu öncesinde `trackBeforeWrite()` çağrılır:

```
trackBeforeWrite(manifest, gameDir, target):
  1. Path güvenliği doğrula (safePath)
  2. _DLSS5_Backup dışında olduğunu kontrol et
  3. Journal'a capture et
  4. Eksik üst dizinleri kaydet (addedDirs)
  5. Dosya mevcutsa:
     a. Orijinali backupPrefix/<rel> altına kopyala
     b. replaced listesine ekle
  6. Dosya yoksa:
     a. added listesine ekle
```

### Geri Yükleme

```
restoreFiles(gameDir, manifest):
  1. Tüm yedek dosyaların varlığını doğrula
  2. Tüm yolların güvenliğini kontrol et
  3. replaced dosyaları → orijinallerinden geri kopyala
  4. added dosyaları → sil
  5. addedDirs → boş olanları sil (deepest first)
  6. ReShade'in eklediği dosyaları temizle
  7. Vulkan layer varsa kaldır
  8. Manifest'i .done-<timestamp> olarak yeniden adlandır
```

---

## 16. Add-on Yönetim Sistemi (RenoDX)

RenoDX add-on build'leri SHA-1 hash'leri ile tanınır:

```javascript
const KNOWN = {
  '189efdee6a327833': { name: 'Stable (previous)' },
  '0c0a02578d2aadf2': { name: 'v4.6 (previous)' },
  '88116071ef689864': { name: 'v4.7', shipped: true }
};
```

### Add-on Kütüphanesi

- **Bundled build:** Payload dizininde gelen varsayılan build
- **Addon klasörü:** `addons/` dizinindeki `.addon64` dosyaları
- **Kullanıcı eklentileri:** File picker ile eklenen dış build'ler

### Çoklu Add-on Desteği

```
enabledAddons()     → Açık olan tüm add-on'lar
replacementAddon()  → Bundled build'in yerini alan (aynı dosya adı)
companionAddons()   → Yanında kurulan (farklı dosya adı)
```

---

## 17. Oyun-İçi Overlay Sistemi

Overlay sistemi 4 katmandan oluşur:

### 1. C++ ReShade Add-on (`overlay/overlay.cpp`)

- ImGui ile panel çizer
- F8 tuşuyla açılıp kapanır
- Named pipe üzerinden Electron'a bağlanır
- Frame buffer'ı pipe'tan okur ve oyun içinde composite eder
- Input olaylarını (fare, klavye) pipe'a yazar

### 2. Overlay Bridge (`src/overlay-bridge.js`)

```javascript
// Offscreen BrowserWindow oluşturur
const win = new BrowserWindow({
  show: false,
  offscreen: true,
  transparent: true,
  width: protocol.WIDTH,
  height: 900
});

// Named Pipe sunucusu başlatır
const pipeName = `\\\\.\\pipe\\${profile}-overlay-${token}`;
net.createServer(socket => {
  // Frame gönder: BGRA bitmap → özel ikili protokol
  // Input al: 20-byte paketler → Chromium input event'leri
});
```

### 3. Overlay Protokolü (`src/overlay-protocol.js`)

| Mesaj Türü | Yön | Boyut | İçerik |
|------------|------|-------|--------|
| Frame | Electron → Add-on | 12 + W×H×4 byte | Header + BGRA bitmap |
| Input | Add-on → Electron | 20 byte | action, x, y, value |
| Hello | Add-on → Electron | 20 byte | Handshake |
| Hello Reply | Electron → Add-on | 20 byte | Versiyon onayı |
| Status | Add-on → Electron | 8 + N byte | JSON runtime durumu |
| Command | Electron → Add-on | Değişken | Kontrol komutu |

### 4. Overlay Kütüphane Yönetimi (`src/overlays.js`)

```
overlay-library/
  entries/
    <sha256>.addon64      ← İkili dosya
    <sha256>.json         ← Metadata
  installs/
    <recordId>.json       ← Hangi oyuna kurulduğu
```

- Her add-on SHA-256 hash'i ile tanımlanır
- Kurulum öncesi mimari eşleşme kontrolü yapılır
- Exclusive creation (`wx` flag) ile dosya çakışması engellenir
- Kaldırma öncesi hash doğrulaması yapılır (değiştirilmiş dosyalar silinmez)

---

## 18. Steam Artwork Servisi

`src/steamart.js` API anahtarı **olmadan** Steam'in public endpoint'lerini kullanır:

### İş Akışı

```
1. Oyun adını temizle (repack/scene etiketlerini kaldır)
2. Steam Store Search API ile appid bul
3. En yakın isim eşleşmesini seç (fuzzy matching)
4. App Details API'den metadata çek (opsiyonel)
5. CDN'den artwork indir:
   - library_600x900.jpg (kapak)
   - library_hero.jpg (banner)
   - header.jpg (fallback)
6. Sonuçları userData/art/<key>-cover.jpg olarak önbellekle
```

### Rate Limiting

```javascript
// İstekler arası minimum 320ms bekleme
async function throttle() {
  const wait = 320 - (Date.now() - lastCall);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
}
```

---

## 19. Harici Bileşen Yönetimi (Runtime Components)

`src/core/runtime-components.js` üç harici bileşeni yönetir:

### LumeniteFX

- **Amaç:** Motion vektörü üretimi için gelişmiş shader
- **Kaynak:** GitHub (belirli commit hash'i)
- **Doğrulama:** SHA-256 (`bf574543...`)
- **Lisans:** Resmi link üzerinden dağıtım gerektirir, bu yüzden bundle edilmez
- **Fallback:** İndirilemezse VORT shader'ları kullanılır

### dgVoodoo2

- **Amaç:** DirectX 8/9 → DirectX 11 çevirisi
- **Kullanım:** 32-bit D3D8/D3D9 oyunları Feeder rotası ile desteklemek için
- **Doğrulama:** SHA-256 (`74aeb464...`)

### VC++ Runtime Kontrolü

```javascript
function missingVCRuntime(bitness, exeDir) {
  // msvcp140.dll, vcruntime140.dll, vcruntime140_1.dll
  // Hem oyun dizini hem System32/SysWOW64 kontrol edilir
}
```

---

## 20. Geçmiş (History) Sistemi

`src/core/history.js` kurulum işlemlerinin değişmez (immutable) audit log'unu tutar.

### Depolama Formatı

Append-only JSONL dosyası (`history.jsonl`):

```jsonl
{"id":"uuid","name":"Cyberpunk 2077","dir":"C:\\Games\\CP2077","date":"2026-09-04T14:30:00Z","action":"install","route":"native","replaced":3,"added":2}
{"id":"uuid","name":"Cyberpunk 2077","dir":"C:\\Games\\CP2077","date":"2026-09-04T15:00:00Z","action":"restore","replaced":3,"added":2}
```

### Veri Kaynakları

1. **Birincil:** `history.jsonl` dosyası
2. **İkincil:** Oyun dizinlerindeki `_DLSS5_Backup/manifest.json(.done-*)` dosyaları
3. **Bellek:** Yazma hatası durumunda `pending` Map'te tutulan kayıtlar

### Kurtarma Mekanizması

Dosyaya yazma başarısız olursa:
- Kayıtlar bellekteki `pending` Map'te tutulur
- Sonraki `list()` çağrısında tekrar yazma dener
- Truncate olmuş son satır diğer kayıtları etkilemez

---

## 21. Uluslararasılaştırma (i18n)

`src/shared/feature-i18n.js` (282KB) tüm kullanıcıya yönelik metinleri çok dilde sağlar.

### Desteklenen Özellikler

- Kurulum/geri yükleme mesajları
- Hata açıklamaları
- UI etiketleri
- Rota ve API açıklamaları
- Diyalog butonları

`src/renderer/i18n.js` (59KB) ve `src/renderer/i18n-extra.js` (81KB) ise renderer tarafındaki çevirileri içerir.

---

## 22. Renderer (UI) Katmanı

`src/renderer/renderer.js` (51KB) tek sayfalık uygulama (SPA) mantığını içerir.

### Sayfalar/Ekranlar

| Ekran | Açıklama |
|-------|----------|
| **Home** | Son erişilen oyunlar ve hızlı erişim |
| **Library** | Tüm oyun grid'i (poster/banner görselleri ile) |
| **Game Detail** | Exe seçimi, API ayarı, rota seçimi, kurulum butonu |
| **Settings** | Tarama klasörleri, tema, dil, otomatik disk tarama |
| **Add-ons** | RenoDX build yönetimi |
| **Overlay** | Overlay kütüphanesi ve kurulum yönetimi |
| **History** | Tüm kurulum/geri yükleme geçmişi |

### Stil (`style.css` - 41KB)

- Koyu ve açık tema desteği
- Frameless pencere için özel title bar
- Grid tabanlı oyun kartları (posterler ile)
- Animasyonlu geçişler

---

## 23. Build ve Dağıtım Süreci

### npm Komutları

```bash
npm run payload       # Payload klasörünü hazırla
npm run build         # Windows NSIS installer + portable
npm run build:linux   # Linux AppImage + deb
npm run build:portable # Yalnızca portable .exe
npm run overlay:build  # C++ overlay derle
npm run test          # 29 test dosyasını çalıştır
```

### Build Yapılandırması

```json
{
  "win": { "target": ["nsis", "portable"] },
  "linux": { "target": ["AppImage", "deb"] },
  "extraResources": [
    { "from": "payload", "to": "payload" },   // DLSS DLL'leri
    { "from": "addons", "to": "addons" },      // RenoDX build'leri
    { "from": "overlay-bin", "to": "overlay" }  // Derlenmiş C++ overlay
  ]
}
```

### NSIS Installer Özellikleri

- Kurulum dizini değiştirilebilir
- Masaüstü ve Başlat Menüsü kısayolları
- Kaldırma sırasında AppData temizlenir

---

## 24. Test Altyapısı

Node.js yerleşik test runner kullanılır (`node --test`):

| Test Dosyası | Kapsam |
|--------------|--------|
| `scan-architecture.test.js` | PE bitness + API algılama |
| `scan-deep-dlss.test.js` | Derin DLSS dosya keşfi |
| `scan-xbox.test.js` | Xbox/GDK MicrosoftGame.config parse |
| `apply-32bit.test.js` | 32-bit Feeder kurulum simülasyonu |
| `apply-feeder64.test.js` | 64-bit Feeder kurulumu |
| `apply-repeat.test.js` | Tekrarlanan kurulum idempotency |
| `apply-failed-restore.test.js` | Başarısız geri yükleme kurtarma |
| `apply-vulkan-wrapper.test.js` | DXVK/vkd3d wrapper'larla uyumluluk |
| `apply-xbox.test.js` | Xbox şifreli exe kurulumu |
| `backend-journal.test.js` | WAL journal transaction/recovery |
| `compatibility-regressions.test.js` | Loader çakışma regresyon testleri |
| `emulators.test.js` | Emülatör profil eşleme |
| `history-ipc.test.js` | History IPC kanalı |
| `optiscaler.test.js` | OptiScaler yapılandırma ve plan |
| `overlay-update.test.js` | Overlay güncelleme/kaldırma |
| `rendering-api.test.js` | API override mantığı |
| `vulkan-layer.test.js` | Vulkan layer registry yönetimi |
| ... | ve 12 test daha |

---

## 25. Veri Akış Diyagramı

```
                          ┌──────────────────┐
                          │     Kullanıcı     │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │   Renderer (UI)   │
                          │   renderer.js     │
                          └────────┬─────────┘
                                   │ IPC (contextBridge)
                          ┌────────▼─────────┐
                          │   Main Process    │
                          │     main.js       │
                          └──┬──┬──┬──┬──┬───┘
                             │  │  │  │  │
          ┌──────────────────┘  │  │  │  └──────────────────┐
          │                     │  │  │                     │
   ┌──────▼──────┐      ┌──────▼──▼──▼──────┐      ┌──────▼──────┐
   │  Library    │      │   Core Engine      │      │  Overlay    │
   │  Discovery  │      │                    │      │  System     │
   │             │      │  scan.js           │      │             │
   │  Steam      │      │  apply.js          │      │  bridge.js  │
   │  Epic       │      │  backend-mgr.js    │      │  protocol.js│
   │  GOG        │      │  file-journal.js   │      │  overlays.js│
   │  Auto-scan  │      │  optiscaler.js     │      │  C++ addon  │
   └─────────────┘      │  vulkan-layer.js   │      └─────────────┘
                         │  compatibility.js  │
                         │  pe.js             │
                         │  emulators.js      │
                         │  history.js        │
                         └──────────┬─────────┘
                                    │
                         ┌──────────▼─────────┐
                         │   Dosya Sistemi     │
                         │                     │
                         │  Oyun DLL'leri      │
                         │  _DLSS5_Backup/     │
                         │  library.json       │
                         │  history.jsonl      │
                         │  art/ (önbellek)    │
                         │  components/        │
                         └─────────────────────┘
```

---

## Özet

DLSS 5 Swapper, tek bir Electron uygulamasında aşağıdaki teknik yetenekleri birleştirir:

1. **PE Dosya Çözümleyicisi:** Sıfır bağımlılıkla Windows PE formatını okur (import tablosu, versiyon kaynağı, mimari)
2. **Çoklu Launcher Entegrasyonu:** Steam (VDF), Epic (JSON), GOG (Registry) + otomatik disk tarama
3. **Transaksiyonel Dosya Sistemi:** WAL tabanlı journal ile yarıda kalan işlemler güvenle kurtarılır
4. **Üç Kurulum Rotası:** Native (DLL swap), Feeder (ReShade + shader pipeline), OptiScaler (proxy)
5. **Eski API Desteği:** dgVoodoo ile DX8/D3D9 → DX11 çevirisi
6. **Vulkan Layer Yönetimi:** Windows Registry üzerinden implicit layer kaydı (çoklu oyun paylaşımıyla)
7. **Oyun-İçi Overlay:** Named Pipe + offscreen Chromium → C++ ImGui entegrasyonu
8. **19 Emülatör Profili:** Konsol emülatörleri için önceden yapılandırılmış API/rota bilgisi
9. **Artwork Servisi:** Steam Store API üzerinden otomatik poster/banner keşfi ve indirme
10. **Kapsamlı Güvenlik:** Anti-cheat algılama, mod yöneticisi kontrolü, loader çakışma önleme, path traversal koruması
