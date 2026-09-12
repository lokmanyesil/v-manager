// Faz 0: Tauri IPC köprüsü — window.electronAPI'yi tanımlar.
// Bu import her zaman index.js'den ÖNCE gelmelidir.
import './src/renderer/api_adapter.js';

// Renderer UI başlangıç noktası
import './src/renderer/index.js';
