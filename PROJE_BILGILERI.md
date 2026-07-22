# V-Manager Proje Bilgileri

Olusturulma tarihi: 2026-07-01
Ana klasor: C:\Users\vuenxx\.gemini\antigravity\scratch\vuenxxFG

## Kisa Ozet

Bu proje, V-Manager adli Windows masaustu uygulamasidir. Electron ile gelistirilmistir. Amac; oyun kutuphanesini taramak, oyunlara DLSS Enabler / OptiScaler / Streamline / OptiPatcher / FSR4 gibi grafik modlarini kurmak, kurulu modlari yonetmek, oyun klasorlerini Windows sikistirmasiyla kucultmek, ucretsiz oyunlari ve YouTube rehberlerini uygulama icinden gostermektir.

Uygulama lisans aktivasyon ekraniyla baslar. Makine HWID degeri alinir, Ed25519 imzali aktivasyon kodu dogrulanir ve lisans basariliysa ana uygulama acilir.

## Temel Bilgiler

| Alan | Deger |
| --- | --- |
| Paket adi | v-manager |
| Urun adi | V-Manager |
| Surum | 0.5.0 |
| Ana giris | main.js |
| Framework | Electron |
| Hedef platform | Windows |
| Lisans | Proprietary / UNLICENSED |
| Repo | https://github.com/vuenxx/v-manager |
| Paketleme | electron-builder, Windows NSIS x64 |
| Main process korumasi | bytenode ile .jsc bytecode derleme |
| Renderer | HTML/CSS + ES module JavaScript |
| Dil destegi | Turkce ve Ingilizce, src/renderer/i18n |

## Calistirma ve Derleme Komutlari

| Komut | Ne yapar |
| --- | --- |
| npm install | Bagimliliklari yukler. |
| npm start | Electron uygulamasini gelistirme modunda baslatir. |
| npm run compile:win | src/main icindeki main-process JS dosyalarini .jsc bytecode'a derler. |
| npm run compile:mac | Ayni compile scriptini calistirir. |
| npm run compile:linux | Ayni compile scriptini calistirir. |
| npm run build | Once compile eder, sonra Windows x64 NSIS installer uretir ve GitHub publish akisiyla calisir. |
| npm run build:nocompile | Compile adimini atlayip dogrudan electron-builder calistirir. |

## Ana Mimari

1. main.js uygulamanin ilk girisidir. src/main/index.jsc varsa bytecode dosyasini, yoksa src/main/index.js kaynak dosyasini yukler.
2. src/main/index.js tek-instance kilidi alir ve lisansi kontrol eder.
3. Lisans yoksa activation.html penceresi acilir. Bu pencere activation_preload.js uzerinden sadece license:get-hwid ve license:activate kanallarina erisir.
4. Lisans gecerliyse bootApp calisir: eski program ici mods klasorunu temizler, oyun listesini ve blacklist'i yukler, IPC handler'larini kaydeder, ana pencereyi acar, auto updater ve Discord Rich Presence baslatilir.
5. Renderer tarafi src/renderer/index.js ile yuklenir. Tema, navigasyon, oyun listesi, modallar, sikistirma, ayarlar, videolar, ucretsiz oyunlar, sistem bilgisi ve i18n baslatilir.

## Kullanilan Bagimliliklar

### Runtime

| Paket | Kullanim |
| --- | --- |
| 7zip-bin | .7z arsivlerini cikarmak icin 7za yolu saglar. |
| adm-zip | ZIP icerigi okumak ve DLSS paketlerini islemek icin kullanilir. |
| bytenode | Main process kaynaklarini .jsc bytecode olarak paketlemek icin kullanilir. |
| discord-rpc | Discord Rich Presence entegrasyonu. |
| electron-log | Electron loglama altyapisi. |
| electron-updater | GitHub release uzerinden uygulama guncelleme. |
| extract-zip | ZIP arsivlerini cikarmak. |
| node-machine-id | HWID / makine kimligi almak. |

### Gelistirme

| Paket | Kullanim |
| --- | --- |
| electron | Masaustu uygulama runtime'i. |
| electron-builder | Installer ve release paketi uretimi. |

## Uygulama Veri Yollari

Bu yollar calisma zamaninda Electron app.getPath('userData') altinda tutulur. Windows'ta genellikle APPDATA altinda V-Manager veya Electron urun adina gore benzer bir dizine denk gelir.

| Yol / Dosya | Ne tutar |
| --- | --- |
| userData/games.json | Taranan ve kayitli oyun listesi. |
| userData/blacklist.json | Kullanicinin gizledigi / kara listeye aldigi oyunlar. |
| userData/covers/ | SteamGridDB veya platformlardan indirilen kapak gorselleri. |
| userData/mods/ | Indirilen mod surumleri ve yerel mod depolari. |
| userData/mods/streamline/ | Streamline surumlerinin ozel depolama alani. |
| userData/user-games.json | Kullanicinin manuel tanimladigi oyun kok klasoru ve EXE yolu kayitlari. |
| userData/custom-folders.json | Kullanicinin ozel tarama klasorleri. |
| userData/custom-subfolders-state.json | Ozel klasor alt klasorlerinin secili/secili degil durumu. |
| userData/mod-presets.json | DLSS Enabler / OptiScaler ayar presetleri. |
| userData/settings.json | Dil, cozunurluk, Discord RPC, sistem bilgisi gibi ayarlar. |
| userData/compression-history.json | Sikistirma gecmisi. |
| userData/releases-cache/modName.json | GitHub release onbellekleri. |
| userData/license.dat | Sifreli veya base64 fallback ile saklanan lisans verisi. |
| userData/logs/dlss-enabler-wizard/ | DLSS Enabler sihirbaz loglari. |
| userData/logs/optiscaler-wizard/ | OptiScaler sihirbaz loglari. |

## Dis Sistem Yollari ve Taramalar

| Yol / Kaynak | Kullanim |
| --- | --- |
| C:\Program Files (x86)\Steam | Steam varsayilan kurulum yolu. |
| HKLM\SOFTWARE\WOW6432Node\Valve\Steam | Steam kurulum yolunu registry'den bulmak icin. |
| HKLM\SOFTWARE\Valve\Steam | Steam icin alternatif registry yolu. |
| steamapps/libraryfolders.vdf | Steam library klasorlerini bulmak. |
| steamapps/appmanifest_*.acf | Steam oyun adi, AppID ve install dir cozmek. |
| C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests | Epic Games .item manifestlerinden oyunlari bulmak. |
| HKLM/HKCU...\Uninstall | GOG, EA, Ubisoft, Xbox ve bazi registry tabanli oyunlari bulmak. |
| Get-AppxPackage / AppxManifest.xml | Xbox / UWP oyunlarini bulmak ve baslatmak. |
| MicrosoftGame.config | Xbox/UWP oyun tespitinde yardimci isaret. |
| app.getPath('temp') | Mod indirme ve gecici ZIP/7z cikarma islemleri. |

## Dis Servisler ve URL'ler

| Servis | Kullanim |
| --- | --- |
| SteamGridDB API | Oyun kapak gorseli arama ve indirme. API key src/main/config.js icinde sabit. |
| https://api.github.com/repos/vuenxx/v-manager/releases | Uygulama release bilgilerini cekmek. |
| https://api.github.com/repos/vuenxx/extra_goldteam34/releases | DLSS Enabler release paketleri. |
| https://api.github.com/repos/optiscaler/OptiScaler/releases | OptiScaler release paketleri. |
| https://api.github.com/repos/optiscaler/OptiPatcher/releases | OptiPatcher release paketleri. |
| https://api.github.com/repos/vuenxx/extra_policebosstr/releases | FSR4 dosya paketleri. |
| https://api.github.com/repos/NVIDIA-RTX/Streamline/releases | NVIDIA Streamline release paketleri. |
| https://www.youtube.com/feeds/videos.xml?channel_id=UCCeWDMKoZfZSNOn0pRIGBcw | YouTube videolari RSS feed'i. |
| https://www.gamerpower.com/api/giveaways | Ucretsiz oyun ve giveaway listesi. |
| https://vuenxx.com/v-manager | Discord Rich Presence buton URL'si. |
| https://discord.com/invite/SnRpn3ADNF | Discord sosyal baglantisi. |
| https://www.youtube.com/@vuenxxmx | YouTube sosyal baglantisi. |

## Ana IPC / Renderer API Yuzeyi

preload.js, renderer tarafina window.electronAPI olarak guvenli kopru acar.

| Grup | Kanallar / Islevler |
| --- | --- |
| Oyunlar | get-games, start-scan, game-found, scan-progress, scan-complete, launch-game, add-manual-game, save-manual-game, toggle-favorite |
| Ayarlar | get-settings, save-settings, anlik pencere cozunurlugu ve Discord RPC guncellemesi |
| Blacklist | get-blacklist, add-to-blacklist, remove-from-blacklist, remove-game |
| Game path sistemi | get-user-games, save-user-game, delete-user-game, get-developer-games, get-dlss-enabler-games, resolve-game-paths |
| DLSS Enabler | Surum listeleme, ZIP/7z indirme, ZIP icinden surum kurma, otomatik/manuel kurulum, wizard |
| OptiScaler | Release listeleme, indirme, kurulum, OptiPatcher ve FSR4 opsiyonlari, wizard |
| Streamline | Release listeleme, indirme, yedek kontrolu, kurulum, geri yukleme |
| FSR4 / OptiPatcher | Release listeleme ve indirme |
| INI | read-mod-ini, write-mod-ini, preset okuma/yazma |
| Sikistirma | select-folder, analyze-folder, run-compression, run-uncompression, progress eventleri, gecmis |
| Sistem | get-system-info, DX12 feature level, CPU/GPU/RAM |
| Icerik | fetch-youtube-videos, fetch-free-games, fetch-all-releases |
| Guncelleme | Manuel update kontrolu, indirme, kur ve yeniden baslat, update eventleri |
| Guvenli link | open-external-link sadece http:// ve https:// URL'leri acar |
| Discord | RPC hata eventleri |

activation_preload.js, ayri aktivasyon penceresinde sadece window.activationAPI acar.

| API | Ne yapar |
| --- | --- |
| getHwid() | Mevcut makine kimligini dondurur. |
| activate(code) | Aktivasyon kodunu main process'e dogrulatir. |

## Arayuz Haritasi

| Bolum | Dosyalar | Ne ise yarar |
| --- | --- | --- |
| Ana sayfa | index.html, src/renderer/ui/system-info.js, src/renderer/ui/games.js | Sistem bilgileri, oyun/mod istatistikleri, hizli menu, uyarilar. |
| Oyunlar | src/renderer/ui/games.js | Oyun kartlari, favoriler, mod durumlari, oyun baslatma. |
| Modlar | src/renderer/ui/mods-tab.js | Yerel mod surumleri, release yenileme, mod klasoru acma/silme. |
| Sikistir | src/renderer/ui/compress.js | Klasor secme, analiz, compact.exe ile sikistirma / geri alma. |
| Guncellemeler | src/renderer/ui/updates-tab.js, src/renderer/ui/modals/update.js | Uygulama release ve mod update akislari. |
| Videolar | src/renderer/ui/videos.js | YouTube RSS uzerinden video listesi. |
| Ucretsiz oyunlar | src/renderer/ui/free-games.js | GamerPower giveaway verileri. |
| Ayarlar | src/renderer/ui/settings.js, src/renderer/ui/modals/settings.js | Dil, cozunurluk, Discord RPC, manuel oyun yollari, mod INI ayarlari. |
| Aktivasyon | activation.html, activation_renderer.js, activation_preload.js | HWID gosterimi ve lisans kodu dogrulama. |

## Mod Yonetimi

| Modul | Dosya | Gorev |
| --- | --- | --- |
| DLSS Enabler | src/main/mods/dlssEnabler.js | DLSS Enabler release indirme, arsiv cikarma, EXE hedefli kurulum, ZIP icinden surum yukleme. |
| DLSS Wizard | src/main/mods/dlssWizard.js | DLSS kurulumunu adim adim yapar, log tutar, abort destekler. |
| OptiScaler | src/main/mods/optiScaler.js | OptiScaler release indirme, arsiv cikarma, injection secimi, ek OptiPatcher/FSR4 kurulumu. |
| Opti Wizard | src/main/mods/optiWizard.js | OptiScaler kurulum sihirbazi, log ve abort akisi. |
| Streamline | src/main/mods/streamline.js | Streamline dosyalarini bulma, yedekleme, hash dogrulama, kurulum ve geri yukleme. |
| OptiPatcher | src/main/mods/optiPatcher.js | OptiPatcher .asi release indirme. |
| FSR4 Files | src/main/mods/fsr4Files.js | FSR4 ZIP/7z release indirme ve cikarma. |
| Uninstaller | src/main/mods/uninstaller.js | Kurulu modlarin guvenli kaldirilmasi. |
| INI Editor | src/main/mods/iniEditor.js | OptiScaler.ini, dlss-enabler.ini gibi ayar dosyalarini okuma/yazma. |

## Sikistirma Sistemi

| Dosya | Gorev |
| --- | --- |
| src/main/mods/compressor.js | Windows compact.exe ile XPRESS/LZX sikistirma ve geri alma calistirir. |
| src/main/mods/analyser.js | Klasorun sikistirilmis/sikistirilmamis boyutlarini analiz eder. |
| src/main/mods/compressionDb.js | Sikistirma gecmisini userData/compression-history.json icinde tutar. |
| src/renderer/ui/compress.js | Kullanici arayuzu, progress, gecmis ve islem butonlari. |

## Lisans ve Aktivasyon

| Dosya | Gorev |
| --- | --- |
| src/main/license.js | HWID alir, Ed25519 imzali aktivasyon kodunu dogrular, lisansi safeStorage ile saklar. |
| tools/generator.js | Gelistirici tarafinda Ed25519 key uretir ve HWID icin aktivasyon kodu imzalar. |
| tools/public.pem | Public key dosyasi. Icerigi uygulamadaki public key ile eslesmelidir. |
| tools/private.pem | Private key dosyasi. Cok hassastir, paylasilmamali ve repo disinda tutulmalidir. |
| activation.html | Aktivasyon ekrani HTML yapisi. |
| activation_preload.js | Aktivasyon penceresi icin minimum IPC koprusu. |
| activation_renderer.js | HWID gosterme, kopyalama ve aktivasyon kodu gonderme arayuz mantigi. |

## Guvenlik ve Dikkat Notlari

| Konu | Not |
| --- | --- |
| Private key | tools/private.pem mevcut. Bu dosya gercek private key ise repository'ye veya dagitim paketine dahil edilmemeli. |
| SteamGridDB API key | src/main/config.js icinde sabit API anahtari var. Public repo icin riskli olabilir. |
| Public key | src/main/license.js icinde gomulu Ed25519 public key var. Normaldir, dogrulama icin gereklidir. |
| Link acma | open-external-link sadece http/https URL'lerine izin veriyor. |
| Renderer guvenligi | Ana pencerelerde nodeIntegration: false, contextIsolation: true. |
| Dosya silme | delete-mod-version sadece hesaplanan mod surumu klasorlerini siler; yine de modName/name/tag dogrulamasi kritik. |
| PowerShell/komut calistirma | Sistem bilgisi, registry tarama, Xbox tarama ve compact.exe icin kullaniliyor. Kullanici girdisi alan yerlerde spawn/arg ayrimi tercih edilmis alanlar var. |
| Anti-cheat riski | README ve ana sayfa, cevrimici rekabetci oyunlarda mod kullaniminin ban riski dogurabilecegini belirtiyor. |

## Build ve Release Akisi

1. tools/compile.js, src/main klasorunu build-tmp/src/main altina kopyalar.
2. require('./x.js') cagrilarindaki .js uzantilarini bytenode uyumlulugu icin kaldirir.
3. Main process JS dosyalarini Electron V8 hedefiyle .jsc dosyalarina derler.
4. build-tmp/src/main icindeki .js dosyalari silinir, sadece .jsc kalir.
5. electron-builder, package.json > build.files ayarina gore paketler.
6. GitHub Actions workflow'u v* tag push ile Windows ortaminda npm ci ve npm run build calistirir.

## Git Durumu Notu

Bu belge olusturulurken calisma agacinda onceden var olan cok sayida degistirilmis ve izlenmeyen dosya vardi. Bu belge disinda mevcut dosyalara mudahale edilmedi.

One cikan izlenmeyen yeni dosyalar:

- activation.html
- activation_preload.js
- activation_renderer.js
- dlss_enabler_games.json
- src/main/discord.js
- src/main/license.js
- src/main/mods/dlssWizard.js
- src/main/mods/optiWizard.js
- src/renderer/ui/modals/dlssWizard.js
- src/renderer/ui/modals/exePicker.js
- src/renderer/ui/modals/optiWizard.js
- src/renderer/ui/mods-tab.js
- src/renderer/ui/system-info.js
- tools/

## Dosya Envanteri

### Kok Dosyalar

| Yol | Ne oldugu |
| --- | --- |
| .gitignore | Git'e dahil edilmeyecek dosya/klasor kurallari. |
| .gitattributes | Git dosya davranislari / line ending ayarlari. |
| LICENSE | Proprietary lisans metni. |
| README.md | Projenin kullanici ve gelistirici aciklamasi. |
| PROGRESS_MEMORIES.md | Gelistirme ilerleme notlari / gecmis hatirlatmalar. |
| package.json | Paket bilgileri, scriptler, bagimliliklar ve electron-builder ayarlari. |
| package-lock.json | NPM bagimlilik kilit dosyasi. |
| main.js | Electron giris dosyasi; .jsc varsa onu, yoksa kaynak src/main/index.js dosyasini yukler. |
| preload.js | Ana pencere renderer API koprusu. |
| index.html | Ana uygulama HTML iskeleti. |
| styles.css | Ana uygulama ve modal stilleri. |
| activation.html | Lisans aktivasyon penceresi. |
| activation_preload.js | Aktivasyon IPC koprusu. |
| activation_renderer.js | Aktivasyon ekrani renderer mantigi. |
| renderer.js | Eski veya alternatif renderer dosyasi; mevcut yeni renderer src/renderer/index.js uzerinden calisiyor. |
| refactor.js | Refactor/yardimci script gibi duruyor; runtime ana akisinda gorunmuyor. |
| developer-games.json | Gelistirici tanimli oyun yolu / EXE relative path veritabani. |
| dlss_enabler_games.json | DLSS Enabler destekli oyun listesi. |
| list-of-registered-games.txt | Kayitli oyun listesi metin ciktisi. |
| uninstall-list.txt | Kaldirma / uninstall ile ilgili liste. |
| program_logo.png | Uygulama logo gorseli. |
| program_logo.ico | Windows icon dosyasi. |
| PROJE_BILGILERI.md | Bu proje envanteri. |

### GitHub ve Yardimci Klasorler

| Yol | Ne oldugu |
| --- | --- |
| .github/workflows/release.yml | Tag bazli Windows build ve GitHub Release publish workflow'u. |
| icons/program_logo.ico | Paketleme icin Windows ikon dosyasi. |
| icons/verified_green.png | Arayuzde kullanilan dogrulama/basari ikonu. |
| icons/verified_yellow.png | Arayuzde kullanilan uyari/dogrulama ikonu. |
| scratch/xbox_scan.ps1 | Xbox/UWP taramasi icin PowerShell deneme/yardimci scripti. |
| tools/compile.js | bytenode bytecode derleme scripti. |
| tools/generator.js | Lisans key uretme ve aktivasyon kodu imzalama CLI araci. |
| tools/public.pem | Ed25519 public key. |
| tools/private.pem | Ed25519 private key; hassas dosya. |

### Main Process Kaynaklari

| Yol | Ne oldugu |
| --- | --- |
| src/main/index.js | Uygulama yasam dongusu, lisans kontrolu, aktivasyon penceresi, boot akisi. |
| src/main/window.js | Ana BrowserWindow olusturma ve kapanista sikistirma uyarisi. |
| src/main/ipc.js | Tum ana IPC handler'lari. |
| src/main/config.js | Kalici veri yollari, oyun state'i, blacklist, kullanici oyunlari, ayarlar, presetler. |
| src/main/scanner.js | Steam/Epic/Xbox/registry/manuel oyun tarama, kapak indirme, upscaler tespiti. |
| src/main/utils.js | Dosya aciklamasi/surum okuma, hash, surucu listeleme, EXE tarama, DX12 kontrolu gibi yardimcilar. |
| src/main/updater.js | electron-updater olaylari, manuel kontrol, indirme ve kurulum akisi. |
| src/main/discord.js | Discord Rich Presence baglantisi, reconnect ve presence guncellemesi. |
| src/main/license.js | HWID tabanli offline lisans dogrulamasi ve lisans saklama. |
| src/main/main.zip | Main tarafiyla iliskili arsiv dosyasi; build/dagitim ciktisi olabilir. |

### Main Process Modulleri

| Yol | Ne oldugu |
| --- | --- |
| src/main/mods/analyser.js | Klasor sikistirma orani ve boyut analizi. |
| src/main/mods/compressionDb.js | Sikistirma gecmisi veritabani. |
| src/main/mods/compressor.js | Windows compact.exe sikistirma motoru. |
| src/main/mods/dlssEnabler.js | DLSS Enabler indirme, surum yonetimi ve kurulum. |
| src/main/mods/dlssWizard.js | DLSS Enabler sihirbaz kurulum akisi. |
| src/main/mods/fsr4Files.js | FSR4 dosyalarini indirme ve cikarma. |
| src/main/mods/iniEditor.js | Mod INI dosyalarini bulma, okuma ve yazma. |
| src/main/mods/launcher.js | Steam/Epic/Xbox/direct EXE oyun baslatma. |
| src/main/mods/optiPatcher.js | OptiPatcher release indirme. |
| src/main/mods/optiScaler.js | OptiScaler release indirme ve kurulum. |
| src/main/mods/optiWizard.js | OptiScaler sihirbaz kurulum akisi. |
| src/main/mods/releaseCache.js | Mod release listeleri icin onbellek. |
| src/main/mods/steamScanner.js | Steam library ve AppID yardimci tarayicisi. |
| src/main/mods/streamline.js | NVIDIA Streamline indirme, yedekleme, kurulum, restore. |
| src/main/mods/uninstaller.js | Mod kaldirma mantigi. |

### Renderer Kaynaklari

| Yol | Ne oldugu |
| --- | --- |
| src/renderer/index.js | Renderer baslangici; tum UI modullerini baglar. |
| src/renderer/state.js | Renderer global state. |
| src/renderer/i18n/i18n.js | Ceviri motoru, dil secimi ve DOM translation. |
| src/renderer/i18n/tr.js | Turkce ceviri sozlugu. |
| src/renderer/i18n/en.js | Ingilizce ceviri sozlugu. |
| src/renderer/ui/blacklist.js | Blacklist modali ve liste yonetimi. |
| src/renderer/ui/compress.js | Sikistirma ekrani UI mantigi. |
| src/renderer/ui/free-games.js | Ucretsiz oyun/giveaway ekrani. |
| src/renderer/ui/games.js | Oyun kartlari, oyun listesi ve oyun aksiyonlari. |
| src/renderer/ui/mods-tab.js | Mod surumleri sekmesi. |
| src/renderer/ui/navigation.js | Sekme gecisleri ve navigasyon. |
| src/renderer/ui/settings.js | Genel ayarlar ve kullanici oyun yollari UI. |
| src/renderer/ui/system-info.js | CPU/GPU/RAM/DX12 sistem bilgisi paneli. |
| src/renderer/ui/theme.js | Tema baslatma ve tema davranisi. |
| src/renderer/ui/updates-tab.js | Guncellemeler sekmesi. |
| src/renderer/ui/videos.js | YouTube videolari sekmesi. |

### Renderer Modal Dosyalari

| Yol | Ne oldugu |
| --- | --- |
| src/renderer/ui/modals/base.js | Modal ac/kapat, notification ve ortak modal davranisi. |
| src/renderer/ui/modals/cacheHelpers.js | Release cache yasi ve yenileme uyarisi yardimcilari. |
| src/renderer/ui/modals/dlss.js | DLSS Enabler kurulum modali. |
| src/renderer/ui/modals/dlssVersions.js | DLSS surum yonetimi modali. |
| src/renderer/ui/modals/dlssWizard.js | DLSS sihirbaz modali. |
| src/renderer/ui/modals/exePicker.js | Oyun EXE secici modali. |
| src/renderer/ui/modals/fsr4.js | FSR4 dosyalari modali. |
| src/renderer/ui/modals/info.js | Bilgi, hata, onay ve launcher uyari modallari. |
| src/renderer/ui/modals/iniSchema.js | INI ayar ekrani icin schema/key tanimlari. |
| src/renderer/ui/modals/modSelection.js | Oyun icin mod secimi modali. |
| src/renderer/ui/modals/opti.js | OptiScaler kurulum modali. |
| src/renderer/ui/modals/optiPatcher.js | OptiPatcher modali. |
| src/renderer/ui/modals/optiWizard.js | OptiScaler sihirbaz modali. |
| src/renderer/ui/modals/settings.js | Oyun bazli mod ayarlari / INI duzenleme modali. |
| src/renderer/ui/modals/streamline.js | Streamline kurulum ve restore modali. |
| src/renderer/ui/modals/update.js | Oyun mod update modali. |

### Derlenmis / Build Ciktilari

| Yol | Ne oldugu |
| --- | --- |
| build-tmp/src/main/index.jsc | Derlenmis main entry bytecode. |
| build-tmp/src/main/window.jsc | Derlenmis window modulu. |
| build-tmp/src/main/ipc.jsc | Derlenmis IPC modulu. |
| build-tmp/src/main/config.jsc | Derlenmis config modulu. |
| build-tmp/src/main/scanner.jsc | Derlenmis scanner modulu. |
| build-tmp/src/main/utils.jsc | Derlenmis utils modulu. |
| build-tmp/src/main/updater.jsc | Derlenmis updater modulu. |
| build-tmp/src/main/discord.jsc | Derlenmis Discord RPC modulu. |
| build-tmp/src/main/license.jsc | Derlenmis lisans modulu. |
| build-tmp/src/main/main.zip | Build tarafinda bulunan arsiv. |
| build-tmp/src/main/mods/analyser.jsc | Derlenmis analyser modulu. |
| build-tmp/src/main/mods/compressionDb.jsc | Derlenmis compression DB modulu. |
| build-tmp/src/main/mods/compressor.jsc | Derlenmis compressor modulu. |
| build-tmp/src/main/mods/dlssEnabler.jsc | Derlenmis DLSS Enabler modulu. |
| build-tmp/src/main/mods/dlssWizard.jsc | Derlenmis DLSS Wizard modulu. |
| build-tmp/src/main/mods/fsr4Files.jsc | Derlenmis FSR4 modulu. |
| build-tmp/src/main/mods/iniEditor.jsc | Derlenmis INI editor modulu. |
| build-tmp/src/main/mods/launcher.jsc | Derlenmis launcher modulu. |
| build-tmp/src/main/mods/optiPatcher.jsc | Derlenmis OptiPatcher modulu. |
| build-tmp/src/main/mods/optiScaler.jsc | Derlenmis OptiScaler modulu. |
| build-tmp/src/main/mods/optiWizard.jsc | Derlenmis Opti Wizard modulu. |
| build-tmp/src/main/mods/releaseCache.jsc | Derlenmis release cache modulu. |
| build-tmp/src/main/mods/steamScanner.jsc | Derlenmis Steam scanner modulu. |
| build-tmp/src/main/mods/streamline.jsc | Derlenmis Streamline modulu. |
| build-tmp/src/main/mods/uninstaller.jsc | Derlenmis uninstaller modulu. |

## Onemli Akislar

### Oyun Tarama

1. Kullanici tarama baslatir.
2. preload.js uzerinden start-scan gonderilir.
3. src/main/ipc.js, scanner.runScan() cagirir.
4. Kaynaklara gore Steam, Epic, Xbox/UWP, registry ve kullanici kayitli oyunlari taranir.
5. Her oyun icin launcher/redist filtreleri uygulanir.
6. Kapak varsa korunur, yoksa Steam veya SteamGridDB ile indirilir.
7. Oyun klasorunde DLSS Enabler, OptiScaler ve Streamline varligi tespit edilir.
8. Sonuc games.json icine yazilir ve renderer'a game-found / scan-progress eventleri gonderilir.

### Mod Kurulum

1. Renderer ilgili mod modalini acar.
2. Release listesi GitHub API'den veya releases-cache icinden gelir.
3. Kullanici surum ve hedef EXE secer.
4. Main process ZIP/7z dosyasini temp klasore indirir.
5. Paket userData/mods altina cikarilir.
6. Dosyalar oyun kokune veya EXE cevresine kopyalanir.
7. Oyun state'i guncellenir.

### Sikistirma

1. Kullanici klasor secer.
2. analyser mevcut sikistirma durumunu olcer.
3. compressor, compact.exe ile secili algoritmayi calistirir.
4. Progress renderer'a aktarilir.
5. Basarili sonuc compression-history.json icine yazilir.

### Guncelleme

1. electron-updater, GitHub release provider ile calisir.
2. Manuel kontrol check-for-updates-manual ile yapilabilir.
3. Indirme progress eventleri renderer'a gonderilir.
4. Kullanici quit-and-install ile kurulumu baslatir.
