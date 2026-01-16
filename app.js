/**
 * 🎤 Karaoke Lyrics - YouTube Song Player
 * Plays YouTube videos with synchronized lyrics
 * 
 * APIs Used:
 * 1. YouTube IFrame API - For video playback
 * 2. LRCLIB - Free FOSS lyrics database with synced lyrics (https://lrclib.net)
 * 3. Lyrics.ovh - Backup for plain lyrics
 */

// ============================================
// DOM Elements
// ============================================
const elements = {
    youtubeUrl: document.getElementById('youtube-url'),
    analyzeBtn: document.getElementById('analyze-btn'),
    artistInput: document.getElementById('artist-input'),
    songInput: document.getElementById('song-input'),
    manualSearchBtn: document.getElementById('manual-search-btn'),
    loadingSection: document.getElementById('loading-section'),
    errorSection: document.getElementById('error-section'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    karaokeSection: document.getElementById('karaoke-section'),
    songThumbnail: document.getElementById('song-thumbnail'),
    songTitle: document.getElementById('song-title'),
    songArtist: document.getElementById('song-artist'),
    syncBadge: document.getElementById('sync-badge'),
    lyricsDisplay: document.getElementById('lyrics-display'),
    fontIncrease: document.getElementById('font-increase'),
    fontDecrease: document.getElementById('font-decrease'),
    copyLyrics: document.getElementById('copy-lyrics'),
    autoScrollBtn: document.getElementById('auto-scroll-btn'),
    playPauseBtn: document.getElementById('play-pause-btn'),
    playIcon: document.getElementById('play-icon'),
    progressBar: document.getElementById('progress-bar'),
    progressFill: document.getElementById('progress-fill'),
    timeDisplay: document.getElementById('time-display'),
    syncModeBtn: document.getElementById('sync-mode-btn')
};

// ============================================
// State
// ============================================
let currentFontSize = 1.4; // rem
let currentLyrics = '';
let syncedLyrics = []; // Array of {time: seconds, text: string}
let hasSyncedLyrics = false;
let autoScrollEnabled = true;
let currentVideoId = null;
let player = null;
let progressInterval = null;
let currentLineIndex = -1;

// ============================================
// API Configuration
// ============================================
const API = {
    youtubeOembed: 'https://www.youtube.com/oembed',
    lrclib: 'https://lrclib.net/api',
    lyricsOvh: 'https://api.lyrics.ovh/v1'
};

// ============================================
// YouTube Player Setup
// ============================================

// Called by YouTube IFrame API when ready
function onYouTubeIframeAPIReady() {
    console.log('🎬 YouTube IFrame API Ready');
}

/**
 * Initialize YouTube player with video ID
 */
function initYouTubePlayer(videoId) {
    currentVideoId = videoId;

    // Destroy existing player if any
    if (player) {
        player.destroy();
        player = null;
    }

    // Create new player
    player = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'playsinline': 1,
            'autoplay': 1,
            'controls': 0, // Hide YouTube controls, use our own
            'modestbranding': 1,
            'rel': 0,
            'showinfo': 0
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

function onPlayerReady(event) {
    console.log('🎵 Player ready');
    event.target.playVideo();
    startProgressTracking();
}

function onPlayerStateChange(event) {
    const state = event.data;

    if (state === YT.PlayerState.PLAYING) {
        elements.playIcon.textContent = '⏸️';
        startProgressTracking();
    } else if (state === YT.PlayerState.PAUSED) {
        elements.playIcon.textContent = '▶️';
        stopProgressTracking();
    } else if (state === YT.PlayerState.ENDED) {
        elements.playIcon.textContent = '🔄';
        stopProgressTracking();
        resetLyricsHighlight();
    }
}

function onPlayerError(event) {
    console.error('YouTube Player Error:', event.data);
    showToast('Video playback error. Try a different video.', 3000);
}

/**
 * Toggle play/pause
 */
function togglePlayPause() {
    if (!player) return;

    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

/**
 * Start tracking progress for sync
 */
function startProgressTracking() {
    stopProgressTracking();
    progressInterval = setInterval(updateProgress, 100); // Update every 100ms for smooth sync
}

function stopProgressTracking() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

/**
 * Update progress bar and sync lyrics
 */
function updateProgress() {
    if (!player || typeof player.getCurrentTime !== 'function') return;

    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();

    // Update progress bar
    const progress = (currentTime / duration) * 100;
    elements.progressFill.style.width = `${progress}%`;

    // Update time display
    elements.timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;

    // Sync lyrics if available
    if (hasSyncedLyrics) {
        syncLyricsToTime(currentTime);
    }
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Sync lyrics highlight to current time
 */
function syncLyricsToTime(currentTime) {
    if (!hasSyncedLyrics || syncedLyrics.length === 0) return;

    // Find current line
    let newLineIndex = -1;
    for (let i = syncedLyrics.length - 1; i >= 0; i--) {
        if (currentTime >= syncedLyrics[i].time) {
            newLineIndex = i;
            break;
        }
    }

    // Update if changed
    if (newLineIndex !== currentLineIndex) {
        currentLineIndex = newLineIndex;
        highlightCurrentLine(newLineIndex);
    }
}

/**
 * Highlight current lyrics line
 */
function highlightCurrentLine(index) {
    const lines = elements.lyricsDisplay.querySelectorAll('.lyrics-line');

    lines.forEach((line, i) => {
        line.classList.remove('active', 'past', 'upcoming', 'next');

        if (i < index) {
            line.classList.add('past');
        } else if (i === index) {
            line.classList.add('active');
        } else if (i === index + 1) {
            line.classList.add('next');
        } else {
            line.classList.add('upcoming');
        }
    });

    // Auto-scroll to current line
    if (autoScrollEnabled && index >= 0) {
        const activeLine = lines[index];
        if (activeLine) {
            activeLine.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }
}

/**
 * Reset lyrics highlight
 */
function resetLyricsHighlight() {
    currentLineIndex = -1;
    const lines = elements.lyricsDisplay.querySelectorAll('.lyrics-line');
    lines.forEach(line => {
        line.classList.remove('active', 'past', 'upcoming', 'next');
    });
}

/**
 * Handle progress bar click for seeking
 */
function handleProgressSeek(event) {
    if (!player) return;

    const rect = elements.progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percent = clickX / rect.width;
    const duration = player.getDuration();
    const seekTime = percent * duration;

    player.seekTo(seekTime, true);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Parse song title to extract artist and song name
 */
function parseSongTitle(title) {
    let cleanTitle = title
        .replace(/–/g, '-')
        .replace(/—/g, '-')
        .replace(/\(Official\s*(Music\s*)?Video\s*(Remastered)?\)/gi, '')
        .replace(/\(Official\s*Audio\)/gi, '')
        .replace(/\(Official\s*Lyric\s*Video\)/gi, '')
        .replace(/\(Lyric\s*Video\)/gi, '')
        .replace(/\(Lyrics\)/gi, '')
        .replace(/\(with\s+Lyrics\)/gi, '')
        .replace(/\[Official\s*(Music\s*)?Video\s*(Remastered)?\]/gi, '')
        .replace(/\[Official\s*Audio\]/gi, '')
        .replace(/\[Official\s*Lyric\s*Video\]/gi, '')
        .replace(/\[Lyric\s*Video\]/gi, '')
        .replace(/\[Lyrics\]/gi, '')
        .replace(/\(Remastered\s*\d*\)/gi, '')
        .replace(/\[Remastered\s*\d*\]/gi, '')
        .replace(/\(Remaster\)/gi, '')
        .replace(/\[Remaster\]/gi, '')
        .replace(/\(\d{4}\s*Remaster\)/gi, '')
        .replace(/\[\d{4}\s*Remaster\]/gi, '')
        .replace(/\(Audio\)/gi, '')
        .replace(/\[Audio\]/gi, '')
        .replace(/\(HD\)/gi, '')
        .replace(/\[HD\]/gi, '')
        .replace(/\(HQ\)/gi, '')
        .replace(/\[HQ\]/gi, '')
        .replace(/\(4K\)/gi, '')
        .replace(/\[4K\]/gi, '')
        .replace(/\(1080p\)/gi, '')
        .replace(/\[1080p\]/gi, '')
        .replace(/ft\./gi, 'feat.')
        .replace(/featuring/gi, 'feat.')
        .replace(/\s+/g, ' ')
        .trim();

    let artist = '';
    let song = '';

    if (cleanTitle.includes(' - ')) {
        const parts = cleanTitle.split(' - ');
        artist = parts[0].trim();
        song = parts.slice(1).join(' - ').trim();
    } else if (cleanTitle.toLowerCase().includes(' by ')) {
        const parts = cleanTitle.split(/\s+by\s+/i);
        song = parts[0].trim();
        artist = parts[1]?.trim() || '';
    } else if (cleanTitle.includes(': ')) {
        const parts = cleanTitle.split(': ');
        artist = parts[0].trim();
        song = parts.slice(1).join(': ').trim();
    } else if (cleanTitle.includes(' | ')) {
        const parts = cleanTitle.split(' | ');
        artist = parts[0].trim();
        song = parts.slice(1).join(' | ').trim();
    } else {
        song = cleanTitle;
    }

    song = song
        .replace(/\s*\(feat\..*?\)/gi, '')
        .replace(/\s*\[feat\..*?\]/gi, '')
        .replace(/\s*feat\..*$/gi, '')
        .trim();

    return { artist, song };
}

/**
 * Parse LRC format timestamps to get synced lyrics
 * Format: [mm:ss.xx] lyrics text
 */
function parseLrcLyrics(lrcText) {
    const lines = lrcText.split('\n');
    const parsed = [];

    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

    for (const line of lines) {
        // Find all timestamps in the line
        const timestamps = [];
        let match;
        let lastIndex = 0;

        while ((match = timeRegex.exec(line)) !== null) {
            const mins = parseInt(match[1]);
            const secs = parseInt(match[2]);
            const ms = parseInt(match[3].padEnd(3, '0'));
            const time = mins * 60 + secs + ms / 1000;
            timestamps.push(time);
            lastIndex = match.index + match[0].length;
        }

        // Get the text after all timestamps
        const text = line.slice(lastIndex).trim();

        // Add each timestamp with the text
        for (const time of timestamps) {
            if (text) {
                parsed.push({ time, text });
            }
        }

        // Reset regex
        timeRegex.lastIndex = 0;
    }

    // Sort by time
    parsed.sort((a, b) => a.time - b.time);

    return parsed;
}

/**
 * Show a toast notification
 */
function showToast(message, duration = 3000) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Show/hide sections
 */
function showSection(section) {
    elements.loadingSection.classList.remove('show');
    elements.errorSection.classList.remove('show');
    elements.karaokeSection.classList.remove('show');

    if (section) {
        section.classList.add('show');
    }
}

/**
 * Show error with message
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    showSection(elements.errorSection);
}

// ============================================
// API Functions
// ============================================

/**
 * Get YouTube video information
 */
async function getYouTubeVideoInfo(videoId) {
    const url = `${API.youtubeOembed}?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Video not found');

        const data = await response.json();
        return {
            title: data.title,
            author: data.author_name,
            thumbnailUrl: data.thumbnail_url
        };
    } catch (error) {
        throw new Error('Could not fetch video information. Please check the URL.');
    }
}

/**
 * Fetch lyrics from LRCLIB API with synced lyrics support
 */
async function fetchFromLrclib(artist, song) {
    // Try direct get first
    const getUrl = `${API.lrclib}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(song)}`;

    try {
        const response = await fetch(getUrl, {
            headers: { 'User-Agent': 'KaraokeLyrics/1.0' }
        });

        if (response.ok) {
            const data = await response.json();

            // Check for synced lyrics first
            if (data.syncedLyrics && data.syncedLyrics.trim()) {
                return {
                    synced: true,
                    raw: data.syncedLyrics,
                    parsed: parseLrcLyrics(data.syncedLyrics),
                    plain: data.plainLyrics || data.syncedLyrics.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim()
                };
            }

            // Fallback to plain lyrics
            if (data.plainLyrics && data.plainLyrics.trim()) {
                return {
                    synced: false,
                    raw: null,
                    parsed: [],
                    plain: data.plainLyrics
                };
            }
        }
    } catch (e) {
        console.log('LRCLIB get failed, trying search...');
    }

    // Try search endpoint
    const searchUrl = `${API.lrclib}/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(song)}`;

    try {
        const response = await fetch(searchUrl, {
            headers: { 'User-Agent': 'KaraokeLyrics/1.0' }
        });

        if (response.ok) {
            const results = await response.json();
            if (results && results.length > 0) {
                const best = results[0];

                if (best.syncedLyrics && best.syncedLyrics.trim()) {
                    return {
                        synced: true,
                        raw: best.syncedLyrics,
                        parsed: parseLrcLyrics(best.syncedLyrics),
                        plain: best.plainLyrics || best.syncedLyrics.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim()
                    };
                }

                if (best.plainLyrics && best.plainLyrics.trim()) {
                    return {
                        synced: false,
                        raw: null,
                        parsed: [],
                        plain: best.plainLyrics
                    };
                }
            }
        }
    } catch (e) {
        console.log('LRCLIB search failed');
    }

    throw new Error('LRCLIB_NOT_FOUND');
}

/**
 * Fetch lyrics from Lyrics.ovh (backup, no sync)
 */
async function fetchFromLyricsOvh(artist, song) {
    const url = `${API.lyricsOvh}/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Not found');

        const data = await response.json();
        if (!data.lyrics || data.lyrics.trim() === '') {
            throw new Error('Empty lyrics');
        }

        return {
            synced: false,
            raw: null,
            parsed: [],
            plain: data.lyrics
        };
    } catch (error) {
        throw new Error('LYRICS_OVH_NOT_FOUND');
    }
}

/**
 * Main lyrics fetcher with multi-API fallback
 */
async function fetchLyrics(artist, song) {
    console.log(`🔍 Searching lyrics for: "${song}" by "${artist}"`);

    // Try LRCLIB first (supports synced lyrics)
    try {
        const result = await fetchFromLrclib(artist, song);
        console.log(`✅ Found ${result.synced ? 'synced' : 'plain'} lyrics on LRCLIB`);
        return result;
    } catch (e) {
        console.log('⚠️ LRCLIB failed, trying Lyrics.ovh...');
    }

    // Fallback to Lyrics.ovh (no sync)
    try {
        const result = await fetchFromLyricsOvh(artist, song);
        console.log('✅ Found plain lyrics on Lyrics.ovh');
        return result;
    } catch (e) {
        console.log('❌ Lyrics.ovh also failed');
    }

    throw new Error('LYRICS_NOT_FOUND');
}

/**
 * Try multiple search strategies
 */
async function findLyrics(artist, song) {
    const strategies = [
        { artist, song },
        { artist, song: song.replace(/\(.*?\)/g, '').trim() },
        { artist, song: song.replace(/\[.*?\]/g, '').trim() },
        { artist: artist.replace(/^The\s+/i, ''), song },
        { artist: artist.split(' ')[0], song },
        {
            artist: artist.replace(/\s*feat\..*$/i, '').trim(),
            song: song.replace(/\s*\(.*?(remix|version|edit).*?\)/gi, '').trim()
        }
    ];

    for (const strategy of strategies) {
        if (!strategy.artist || !strategy.song) continue;
        if (strategy.song.length < 2) continue;

        try {
            console.log(`📝 Trying: "${strategy.song}" by "${strategy.artist}"`);
            const result = await fetchLyrics(strategy.artist, strategy.song);
            return result;
        } catch (error) {
            continue;
        }
    }

    throw new Error('LYRICS_NOT_FOUND');
}

// ============================================
// Display Functions
// ============================================

/**
 * Display lyrics with karaoke sync
 */
function displayLyrics(lyricsResult, title, artist, thumbnailUrl) {
    currentLyrics = lyricsResult.plain;
    syncedLyrics = lyricsResult.parsed || [];
    hasSyncedLyrics = lyricsResult.synced && syncedLyrics.length > 0;

    // Set song info
    elements.songTitle.textContent = title;
    elements.songArtist.textContent = artist || 'Unknown Artist';

    // Show/hide sync badge
    if (hasSyncedLyrics) {
        elements.syncBadge.classList.add('show');
        elements.lyricsDisplay.classList.remove('static');
    } else {
        elements.syncBadge.classList.remove('show');
        elements.lyricsDisplay.classList.add('static');
    }

    // Set thumbnail
    if (thumbnailUrl) {
        elements.songThumbnail.innerHTML = `<img src="${thumbnailUrl}" alt="Song thumbnail">`;
    } else {
        elements.songThumbnail.innerHTML = '🎵';
    }

    // Format and display lyrics
    let html = '';

    if (hasSyncedLyrics) {
        // Use synced lyrics
        syncedLyrics.forEach((lyric, index) => {
            html += `<div class="lyrics-line upcoming" data-time="${lyric.time}" data-index="${index}">${escapeHtml(lyric.text)}</div>`;
        });
    } else {
        // Use plain lyrics
        const lines = currentLyrics.split('\n');
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine === '') {
                html += '<div class="lyrics-line empty"></div>';
            } else {
                html += `<div class="lyrics-line">${escapeHtml(trimmedLine)}</div>`;
            }
        });
    }

    elements.lyricsDisplay.innerHTML = html;
    elements.lyricsDisplay.style.fontSize = `${currentFontSize}rem`;

    // Add click handlers for seeking (if synced)
    if (hasSyncedLyrics) {
        elements.lyricsDisplay.querySelectorAll('.lyrics-line').forEach(line => {
            line.addEventListener('click', () => {
                const time = parseFloat(line.dataset.time);
                if (player && !isNaN(time)) {
                    player.seekTo(time, true);
                }
            });
        });
    }

    showSection(elements.karaokeSection);
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Main Analysis Function
// ============================================

async function analyzeYouTubeUrl(url) {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
        showError('Please enter a valid YouTube URL.');
        return;
    }

    showSection(elements.loadingSection);
    stopProgressTracking();
    resetLyricsHighlight();

    try {
        // Get video info
        const videoInfo = await getYouTubeVideoInfo(videoId);
        const { artist, song } = parseSongTitle(videoInfo.title);

        if (!song) {
            throw new Error('Could not identify song title from video.');
        }

        // Pre-fill manual search
        elements.artistInput.value = artist;
        elements.songInput.value = song;

        // Fetch lyrics
        const searchArtist = artist || videoInfo.author;
        const lyricsResult = await findLyrics(searchArtist, song);

        // Display lyrics
        displayLyrics(lyricsResult, song, searchArtist, videoInfo.thumbnailUrl);

        // Initialize YouTube player
        initYouTubePlayer(videoId);

    } catch (error) {
        console.error('Analysis error:', error);

        if (error.message === 'LYRICS_NOT_FOUND') {
            showError('Lyrics not found. Try using the manual search with the exact artist and song name.');
        } else {
            showError(error.message || 'An unexpected error occurred. Please try again.');
        }
    }
}

async function manualSearch() {
    const artist = elements.artistInput.value.trim();
    const song = elements.songInput.value.trim();

    if (!artist || !song) {
        showToast('Please enter both artist and song name', 3000);
        return;
    }

    showSection(elements.loadingSection);

    try {
        const lyricsResult = await fetchLyrics(artist, song);
        displayLyrics(lyricsResult, song, artist, null);

        // If we have a video playing, just update lyrics
        if (!player) {
            showSection(elements.karaokeSection);
        }
    } catch (error) {
        showError('Lyrics not found. Please check the spelling and try again.');
    }
}

// ============================================
// Event Listeners
// ============================================

// Analyze/Play button
elements.analyzeBtn.addEventListener('click', () => {
    const url = elements.youtubeUrl.value.trim();
    if (url) {
        analyzeYouTubeUrl(url);
    } else {
        showToast('Please enter a YouTube URL', 3000);
    }
});

// Enter key on URL input
elements.youtubeUrl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.analyzeBtn.click();
    }
});

// Manual search
elements.manualSearchBtn.addEventListener('click', manualSearch);

elements.songInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') manualSearch();
});

elements.artistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') elements.songInput.focus();
});

// Retry button
elements.retryBtn.addEventListener('click', () => {
    showSection(null);
    elements.youtubeUrl.focus();
});

// Play/Pause
elements.playPauseBtn.addEventListener('click', togglePlayPause);

// Progress bar seek
elements.progressBar.addEventListener('click', handleProgressSeek);

// Font size controls
elements.fontIncrease.addEventListener('click', () => {
    if (currentFontSize < 2.5) {
        currentFontSize += 0.1;
        elements.lyricsDisplay.style.fontSize = `${currentFontSize}rem`;
    }
});

elements.fontDecrease.addEventListener('click', () => {
    if (currentFontSize > 0.8) {
        currentFontSize -= 0.1;
        elements.lyricsDisplay.style.fontSize = `${currentFontSize}rem`;
    }
});

// Copy lyrics
elements.copyLyrics.addEventListener('click', async () => {
    if (currentLyrics) {
        try {
            await navigator.clipboard.writeText(currentLyrics);
            showToast('Lyrics copied to clipboard! 📋', 2000);
        } catch (error) {
            showToast('Could not copy lyrics', 2000);
        }
    }
});

// Auto-scroll toggle
elements.autoScrollBtn.addEventListener('click', () => {
    autoScrollEnabled = !autoScrollEnabled;
    elements.autoScrollBtn.classList.toggle('active', autoScrollEnabled);
    showToast(autoScrollEnabled ? 'Auto-scroll enabled' : 'Auto-scroll disabled', 2000);
});

// URL paste detection
elements.youtubeUrl.addEventListener('paste', (e) => {
    setTimeout(() => {
        const url = elements.youtubeUrl.value.trim();
        if (extractYouTubeVideoId(url)) {
            analyzeYouTubeUrl(url);
        }
    }, 100);
});

// ============================================
// Initialize
// ============================================
console.log('🎤 Karaoke Lyrics initialized!');
console.log('ℹ️ Paste a YouTube URL to start the karaoke experience!');
