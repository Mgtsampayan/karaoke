// ============================================
// AUDIO SYNC ENGINE
// ============================================
class AudioSyncEngine {
    constructor() {
        this.audioContext = null;
        this.startTime = 0;
        this.pausedTime = 0;
        this.driftCorrection = 0;
    }

    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    getAccurateTime() {
        if (!this.audioContext) return 0;
        const rawTime = this.audioContext.currentTime - this.startTime + this.pausedTime;
        return Math.max(0, rawTime + this.driftCorrection);
    }

    start(currentVideoTime) {
        this.startTime = this.audioContext.currentTime - currentVideoTime;
    }

    pause(currentVideoTime) {
        this.pausedTime = currentVideoTime;
    }

    correctDrift(videoTime, syncedTime) {
        const drift = videoTime - syncedTime;
        if (Math.abs(drift) > 0.2) {
            this.driftCorrection += drift * 0.3;
        }
    }

    playBeep() {
        if (!this.audioContext) return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);

        osc.start();
        osc.stop(this.audioContext.currentTime + 0.05);
    }
}

// ============================================
// LYRICS SERVICE
// ============================================
const LyricsService = {
    async fetchWithFallback(artist, title) {
        const sources = [
            { name: 'LRCLIB', fn: this.fetchLRCLIB.bind(this) },
            { name: 'Lyrics.ovh', fn: this.fetchLyricsOvh.bind(this) }
        ];

        for (const source of sources) {
            try {
                const result = await source.fn(artist, title);
                if (result) return { ...result, source: source.name };
            } catch (e) {
                console.warn(`${source.name} failed:`, e);
            }
        }

        throw new Error('No lyrics found from any source');
    },

    async fetchLRCLIB(artist, title) {
        const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();

        if (data.syncedLyrics) {
            return {
                synced: true,
                lines: this.parseLRC(data.syncedLyrics)
            };
        }
        return null;
    },

    async fetchLyricsOvh(artist, title) {
        const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();

        return {
            synced: false,
            lines: data.lyrics.split('\n')
                .filter(text => text.trim())
                .map((text, i) => ({ time: i * 3, text: text.trim() }))
        };
    },

    parseLRC(lrcText) {
        const lines = [];
        const regex = /\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)/g;
        let match;

        while ((match = regex.exec(lrcText)) !== null) {
            const mins = parseInt(match[1]);
            const secs = parseInt(match[2]);
            const ms = parseInt(match[3].padEnd(3, '0'));
            const time = mins * 60 + secs + ms / 1000;
            const text = match[4].trim();

            if (text) lines.push({ time, text });
        }

        return lines.sort((a, b) => a.time - b.time);
    }
};

// ============================================
// YOUTUBE SERVICE
// ============================================
const YouTubeService = {
    extractVideoId(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    },

    async getVideoInfo(videoId) {
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Video not found');
        return await res.json();
    },

    parseTitle(title) {
        let clean = title
            .replace(/\(Official.*?\)/gi, '')
            .replace(/\[Official.*?\]/gi, '')
            .replace(/\(Lyric.*?\)/gi, '')
            .replace(/\[Lyric.*?\]/gi, '')
            .trim();

        if (clean.includes(' - ')) {
            const [artist, ...songParts] = clean.split(' - ');
            return { artist: artist.trim(), song: songParts.join(' - ').trim() };
        }

        return { artist: '', song: clean };
    }
};

// ============================================
// APP STATE
// ============================================
const App = {
    player: null,
    syncEngine: new AudioSyncEngine(),
    lyrics: null,
    currentLine: -1,
    audioEnabled: true,
    animationFrame: null,

    elements: {
        searchInput: document.getElementById('search-input'),
        searchBtn: document.getElementById('search-btn'),
        loadingBox: document.getElementById('loading-box'),
        errorBox: document.getElementById('error-box'),
        errorMessage: document.getElementById('error-message'),
        retryBtn: document.getElementById('retry-btn'),
        playerSection: document.getElementById('player-section'),
        playPauseBtn: document.getElementById('play-pause-btn'),
        progressBar: document.getElementById('progress-bar'),
        progressFill: document.getElementById('progress-fill'),
        currentTime: document.getElementById('current-time'),
        durationTime: document.getElementById('duration-time'),
        audioToggleBtn: document.getElementById('audio-toggle-btn'),
        sourceBadge: document.getElementById('source-badge'),
        sourceText: document.getElementById('source-text'),
        lyricsDisplay: document.getElementById('lyrics-display')
    },

    init() {
        this.elements.searchBtn.addEventListener('click', () => this.handleSearch());
        this.elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSearch();
        });
        this.elements.retryBtn.addEventListener('click', () => this.showSection(null));
        this.elements.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.elements.progressBar.addEventListener('click', (e) => this.handleSeek(e));
        this.elements.audioToggleBtn.addEventListener('click', () => this.toggleAudio());
    },

    showSection(section) {
        this.elements.loadingBox.classList.add('hidden');
        this.elements.errorBox.classList.add('hidden');
        this.elements.playerSection.classList.add('hidden');
        if (section) section.classList.remove('hidden');
    },

    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.showSection(this.elements.errorBox);
    },

    async handleSearch() {
        const url = this.elements.searchInput.value.trim();
        if (!url) return;

        const videoId = YouTubeService.extractVideoId(url);
        if (!videoId) {
            this.showError('Please enter a valid YouTube URL');
            return;
        }

        this.showSection(this.elements.loadingBox);

        try {
            const videoInfo = await YouTubeService.getVideoInfo(videoId);
            const { artist, song } = YouTubeService.parseTitle(videoInfo.title);

            const lyricsData = await LyricsService.fetchWithFallback(
                artist || videoInfo.author_name,
                song
            );

            this.lyrics = lyricsData;
            this.displayLyrics();
            this.updateSourceBadge(lyricsData);
            this.initPlayer(videoId);
            this.showSection(this.elements.playerSection);

        } catch (err) {
            this.showError(`Lyrics not found: ${err.message}`);
        }
    },

    displayLyrics() {
        let html = '';
        this.lyrics.lines.forEach((line, i) => {
            html += `<div class="lyrics-line" data-index="${i}" data-time="${line.time}">${this.escapeHtml(line.text)}</div>`;
        });
        this.elements.lyricsDisplay.innerHTML = html;

        this.elements.lyricsDisplay.querySelectorAll('.lyrics-line').forEach(el => {
            el.addEventListener('click', () => {
                const time = parseFloat(el.dataset.time);
                if (this.player && !isNaN(time)) {
                    this.player.seekTo(time, true);
                    this.syncEngine.start(time);
                }
            });
        });
    },

    updateSourceBadge(lyricsData) {
        this.elements.sourceText.textContent = `${lyricsData.synced ? 'Synced' : 'Unsynced'} lyrics • Source: ${lyricsData.source}`;
        this.elements.sourceBadge.classList.remove('hidden');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    initPlayer(videoId) {
        if (this.player) {
            this.player.destroy();
        }

        this.player = new YT.Player('youtube-player', {
            videoId,
            playerVars: { autoplay: 1, controls: 0, modestbranding: 1, playsinline: 1 },
            events: {
                onReady: (e) => {
                    this.syncEngine.init();
                    this.syncEngine.start(0);
                    this.elements.durationTime.textContent = this.formatTime(e.target.getDuration());
                    this.startSyncLoop();
                },
                onStateChange: (e) => {
                    if (e.data === YT.PlayerState.PLAYING) {
                        this.elements.playPauseBtn.textContent = '⏸️';
                        this.syncEngine.start(e.target.getCurrentTime());
                        this.startSyncLoop();
                    } else if (e.data === YT.PlayerState.PAUSED) {
                        this.elements.playPauseBtn.textContent = '▶️';
                        this.syncEngine.pause(e.target.getCurrentTime());
                        this.stopSyncLoop();
                    }
                }
            }
        });
    },

    startSyncLoop() {
        this.stopSyncLoop();

        const syncFrame = () => {
            if (!this.player) return;

            const accurateTime = this.syncEngine.getAccurateTime();
            const videoTime = this.player.getCurrentTime();
            const duration = this.player.getDuration();

            this.syncEngine.correctDrift(videoTime, accurateTime);

            const progress = (accurateTime / duration) * 100;
            this.elements.progressFill.style.width = `${progress}%`;
            this.elements.currentTime.textContent = this.formatTime(accurateTime);

            this.syncLyrics(accurateTime);

            this.animationFrame = requestAnimationFrame(syncFrame);
        };

        this.animationFrame = requestAnimationFrame(syncFrame);
    },

    stopSyncLoop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    },

    syncLyrics(currentTime) {
        if (!this.lyrics) return;

        let newLine = -1;
        for (let i = this.lyrics.lines.length - 1; i >= 0; i--) {
            if (currentTime >= this.lyrics.lines[i].time - 0.1) {
                newLine = i;
                break;
            }
        }

        if (newLine !== this.currentLine) {
            this.currentLine = newLine;
            this.highlightLine(newLine);

            if (this.audioEnabled && newLine >= 0) {
                this.syncEngine.playBeep();
            }
        }
    },

    highlightLine(index) {
        const lines = this.elements.lyricsDisplay.querySelectorAll('.lyrics-line');

        lines.forEach((line, i) => {
            line.classList.remove('active', 'past');
            if (i < index) line.classList.add('past');
            else if (i === index) line.classList.add('active');
        });

        if (index >= 0 && lines[index]) {
            lines[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    togglePlayPause() {
        if (!this.player) return;

        const state = this.player.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            this.player.pauseVideo();
        } else {
            this.player.playVideo();
        }
    },

    handleSeek(e) {
        if (!this.player) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const seekTime = percent * this.player.getDuration();

        this.player.seekTo(seekTime, true);
        this.syncEngine.start(seekTime);
    },

    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        this.elements.audioToggleBtn.textContent = this.audioEnabled ? '🔊' : '🔇';
    },

    formatTime(secs) {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
};

// Initialize app
window.onYouTubeIframeAPIReady = () => {
    console.log('YouTube API Ready');
};

App.init();
console.log('🎤 KaraokeSync Pro Ready!');