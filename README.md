# 🎤 Karaoke Lyrics

Play YouTube songs with synchronized karaoke-style lyrics!

![Karaoke Demo](https://img.shields.io/badge/Status-Working-brightgreen)

## ✨ Features

- 🎬 **YouTube Video Player** - Embedded player with custom controls
- 📝 **Synced Lyrics** - Real-time lyrics synchronized with video playback
- ✨ **Karaoke Highlighting** - Current line glows and auto-scrolls
- 🖱️ **Click to Seek** - Click any lyric line to jump to that part
- 🎨 **Beautiful UI** - Dark theme with gradient effects
- 📱 **Responsive** - Works on desktop and mobile

## 🚀 Quick Start

### Option 1: Using npm scripts (Recommended)

```bash
# Navigate to the project folder
cd c:\Users\GEMUEL\Documents\lyrics

# Start the dev server (opens at http://localhost:3000)
npm run open
```

### Option 2: Using Python

```bash
cd c:\Users\GEMUEL\Documents\lyrics
python -m http.server 3000
# Open: http://localhost:3000
```

### Option 3: Using npx directly

```bash
npx serve c:\Users\GEMUEL\Documents\lyrics
```

> ⚠️ **Note:** The YouTube player requires HTTP/HTTPS. Opening `index.html` directly via `file:///` won't work properly.

## 📖 How to Use

1. **Paste** a YouTube music video URL
2. **Click** "Play" button
3. **Enjoy** the karaoke experience with synced lyrics!

## 🔧 APIs Used

- **YouTube IFrame API** - For video playback
- **LRCLIB** - Free FOSS lyrics database with synced lyrics (3M+ songs)
- **Lyrics.ovh** - Backup for plain lyrics

## 📁 Project Structure

```
lyrics/
├── index.html      # Main HTML file
├── styles.css      # Karaoke styles with animations
├── app.js          # YouTube player & lyrics sync logic
├── package.json    # Dev server scripts
└── README.md       # This file
```

## 🎵 Supported Features

| Feature | Description |
|---------|-------------|
| Synced Lyrics | ⏱️ badge shows when LRC timestamps available |
| Auto-scroll | Lyrics scroll automatically with the song |
| Font Controls | A+ / A- buttons to adjust lyrics size |
| Copy Lyrics | 📋 button to copy lyrics to clipboard |
| Progress Bar | Click to seek to any position |

---

Made with ❤️ for music lovers | Powered by LRCLIB & YouTube
