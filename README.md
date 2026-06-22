# GRABVID — Neo Brutalism Video Downloader

Download TikTok (tanpa watermark) dan YouTube (MP4 & MP3) dengan tampilan Neo Brutalism yang bold.

## 📁 Struktur Project

```
video-downloader/
├── server.js          # Express backend
├── package.json
└── public/
    ├── index.html     # Frontend UI
    ├── style.css      # Neo Brutalism styles
    └── script.js      # Vanilla JS logic
```

## 🚀 Cara Menjalankan

### 1. Install Dependencies
```bash
npm install
```

### 2. Jalankan Server
```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

### 3. Buka Browser
```
http://localhost:3000
```

## 🔌 API Endpoints

### TikTok
```
GET /api/tiktok?url=<tiktok_url>
```
Menggunakan: `https://www.tikwm.com/api/`

**Response:**
```json
{
  "success": true,
  "platform": "tiktok",
  "data": {
    "title": "...",
    "cover": "...",
    "duration": 30,
    "author": { "name": "...", "username": "..." },
    "stats": { "plays": 1000, "likes": 500 },
    "downloads": {
      "no_watermark": "https://...",
      "no_watermark_hd": "https://...",
      "watermark": "https://...",
      "audio": "https://..."
    }
  }
}
```

### YouTube
```
GET /api/youtube?url=<youtube_url>
```
Menggunakan: `https://media.savetube.me/api`

**Response:**
```json
{
  "success": true,
  "platform": "youtube",
  "data": {
    "title": "...",
    "thumbnail": "https://...",
    "duration": 120,
    "channel": "...",
    "downloads": {
      "1080": "https://...",
      "720": "https://...",
      "480": "https://...",
      "360": "https://...",
      "mp3": "https://..."
    }
  }
}
```

## ✅ Fitur

- ✅ Download TikTok tanpa watermark (SD & HD)
- ✅ Download TikTok audio/musik
- ✅ Download YouTube MP4 (1080p, 720p, 480p, 360p)
- ✅ Download YouTube MP3
- ✅ Auto-deteksi platform dari URL yang dipaste
- ✅ Responsive (mobile & desktop)
- ✅ Neo Brutalism design dengan animasi hover
- ✅ Error handling yang jelas
- ✅ CORS enabled

## ⚠️ Disclaimer

Tool ini hanya untuk penggunaan pribadi. Hormati hak cipta konten kreator. Jangan mendistribusikan konten yang diunduh tanpa izin pemiliknya.

## 🛠 Requirement

- Node.js >= 18 (built-in `fetch` tersedia)
- npm
