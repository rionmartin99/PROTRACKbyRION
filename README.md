# ProTrack - Project Tracker 🚀

> A cyber-themed, offline-first Progressive Web App (PWA) with gamified daily telemetry logging, visual photo journal imprinting, milestone validation, and Google Apps Script cloud sync.

![Version](https://img.shields.io/badge/version-2.3.0-brightgreen)
![PWA](https://img.shields.io/badge/PWA-Ready-orange)
![Storage](https://img.shields.io/badge/Storage-IndexedDB%20v2-blue)
![Backend](https://img.shields.io/badge/Backend-Google%20Apps%20Script-yellow)

---

## ⚡ Highlights & Features

- **📱 Offline-First PWA**: Installable on Android, iOS, Windows, and macOS. Fully functional offline via Service Worker (`sw.js`) and app-shell caching.
- **💾 High-Capacity Storage**: Powered by **IndexedDB v2** (`ProTrackDB`) for storing state, detailed journal history, photo dispatches, and an offline sync queue—eliminating `localStorage` 5MB quota limitations.
- **🔄 Resilient Google Apps Script Sync**:
  - Offline-first dispatch queue with automatic flush when connectivity resumes.
  - Exponential backoff retry mechanism ($1.5 \times 2^{\text{retries}}$ seconds).
  - Real-time sync badge indicating connection and sync states.
- **🛡️ Authentic Daily Dispatches & Anti-Tamper Streaks**:
  - Server-side date verification and atomic execution lock in `code.gs` preventing clock manipulation or duplicate submissions.
- **⚡ 60 FPS Optimized Rendering**:
  - `requestAnimationFrame` render coalescing to prevent layout reflows.
  - `DocumentFragment` batching for Calendar, Tactical Bounties, and Inventory.
  - In-memory thumbnail caching for smooth calendar month browsing.
- **🎮 Gamification & Relics**:
  - Global XP progression, level milestones, companion reactions, and mystery tactical supply crates.
  - Relic Vault with 14 unlockable achievements and encrypted classified criteria.
  - Rotating weekly tactical bounties.
- **⏱️ Focus Tools**: Integrated Pomodoro timer and deep focus clock with screen wake lock support.

---

## 📂 Repository File Structure

```text
├── index.html         # Main PWA frontend with reactive UI and game engine
├── sw.js              # Service Worker for offline caching and network routing
├── manifest.json      # Web App Manifest for PWA installation
├── code.gs            # Google Apps Script backend for Google Sheets & Drive
├── favicon.ico        # Browser favicon
├── icon-192.png       # 192x192 PWA application icon
├── icon-512.png       # 512x512 PWA splash & launcher icon
├── icon.png           # Master high-resolution app icon
└── README.md          # Project documentation
```

---

## 🚀 Getting Started

### Local / Static Hosting
You can run ProTrack locally or host it on **GitHub Pages**, **Vercel**, **Netlify**, or any static web server:

1. Clone or download this repository.
2. Open `index.html` in any modern web browser, or serve via local server:
   ```bash
   npx serve .
   ```
3. (Optional) In Chrome, Edge, or mobile browsers, tap **Install** to add ProTrack to your home screen or desktop.

---

## ☁️ Connecting Google Apps Script Backend

To enable automatic Google Sheets logging and Google Drive photo uploads:

1. Open [Google Apps Script](https://script.google.com) and create a new project.
2. Paste the contents of [`code.gs`](code.gs) into the editor.
3. Run the `setup()` function once from the editor toolbar to initialize your Google Sheet and Google Drive upload folder.
4. Click **Deploy** > **New deployment**:
   - **Select type**: Web app
   - **Execute as**: Me
   - **Who has access**: Anyone
5. Copy your **Web app URL**.
6. In ProTrack, open the settings menu and paste your Web App URL into the **Cloud Sync URL** field.

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
