/**
 * 🎵 Lyrics Finder - YouTube Song Analyzer
 * Analyzes YouTube URLs and fetches song lyrics
 * 
 * APIs Used (in order of priority):
 * 1. LRCLIB - Free FOSS lyrics database with 3M+ songs (https://lrclib.net)
 * 2. Lyrics.ovh - Backup free lyrics API
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
    lyricsSection: document.getElementById('lyrics-section'),
    songThumbnail: document.getElementById('song-thumbnail'),
    songTitle: document.getElementById('song-title'),
    songArtist: document.getElementById('song-artist'),
    lyricsDisplay: document.getElementById('lyrics-display'),
    fontIncrease: document.getElementById('font-increase'),
    fontDecrease: document.getElementById('font-decrease'),
    copyLyrics: document.getElementById('copy-lyrics')
};

// ============================================
// State
// ============================================
let currentFontSize = 1.2; // rem
let currentLyrics = '';

// ============================================
// API Configuration
// ============================================
const API = {
    // YouTube oEmbed API for getting video info
    youtubeOembed: 'https://www.youtube.com/oembed',
    // LRCLIB - Free FOSS lyrics database (PRIMARY - Most reliable!)
    lrclib: 'https://lrclib.net/api',
    // Lyrics.ovh - Backup free lyrics API
    lyricsOvh: 'https://api.lyrics.ovh/v1'
};

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
 * Common formats: "Artist - Song", "Song by Artist", "Artist: Song"
 */
function parseSongTitle(title) {
    // Clean up common YouTube suffixes
    let cleanTitle = title
        // Replace en-dash and em-dash with regular hyphen
        .replace(/–/g, '-')
        .replace(/—/g, '-')
        // Remove official video markers
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
        // Remove remaster/version tags
        .replace(/\(Remastered\s*\d*\)/gi, '')
        .replace(/\[Remastered\s*\d*\]/gi, '')
        .replace(/\(Remaster\)/gi, '')
        .replace(/\[Remaster\]/gi, '')
        .replace(/\(\d{4}\s*Remaster\)/gi, '')
        .replace(/\[\d{4}\s*Remaster\]/gi, '')
        // Remove audio/video quality markers
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
        // Normalize featuring
        .replace(/ft\./gi, 'feat.')
        .replace(/featuring/gi, 'feat.')
        // Clean up whitespace
        .replace(/\s+/g, ' ')
        .trim();

    let artist = '';
    let song = '';

    // Try "Artist - Song" format (most common)
    if (cleanTitle.includes(' - ')) {
        const parts = cleanTitle.split(' - ');
        artist = parts[0].trim();
        song = parts.slice(1).join(' - ').trim();
    }
    // Try "Song by Artist" format
    else if (cleanTitle.toLowerCase().includes(' by ')) {
        const parts = cleanTitle.split(/\s+by\s+/i);
        song = parts[0].trim();
        artist = parts[1]?.trim() || '';
    }
    // Try "Artist: Song" format
    else if (cleanTitle.includes(': ')) {
        const parts = cleanTitle.split(': ');
        artist = parts[0].trim();
        song = parts.slice(1).join(': ').trim();
    }
    // Try "Artist | Song" format
    else if (cleanTitle.includes(' | ')) {
        const parts = cleanTitle.split(' | ');
        artist = parts[0].trim();
        song = parts.slice(1).join(' | ').trim();
    }
    // Fallback - use entire title as song name
    else {
        song = cleanTitle;
    }

    // Clean up featuring artists from song title
    song = song
        .replace(/\s*\(feat\..*?\)/gi, '')
        .replace(/\s*\[feat\..*?\]/gi, '')
        .replace(/\s*feat\..*$/gi, '')
        .trim();

    return { artist, song };
}

/**
 * Show a toast notification
 */
function showToast(message, duration = 3000) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after duration
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
    elements.lyricsSection.classList.remove('show');

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
 * Get YouTube video information using oEmbed API
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
 * Fetch lyrics from LRCLIB API (PRIMARY - Free FOSS with 3M+ lyrics)
 * Docs: https://lrclib.net/docs
 */
async function fetchFromLrclib(artist, song) {
    // Try direct get first (exact match)
    const getUrl = `${API.lrclib}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(song)}`;

    try {
        const response = await fetch(getUrl, {
            headers: {
                'User-Agent': 'LyricsFinder/1.0 (https://github.com/lyrics-finder)'
            }
        });

        if (response.ok) {
            const data = await response.json();
            // Prefer plain lyrics, fallback to synced lyrics (remove timestamps)
            if (data.plainLyrics && data.plainLyrics.trim()) {
                return data.plainLyrics;
            }
            if (data.syncedLyrics) {
                // Remove LRC timestamps like [00:12.34]
                return data.syncedLyrics.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
            }
        }
    } catch (e) {
        console.log('LRCLIB get failed, trying search...');
    }

    // Fallback to search endpoint
    const searchUrl = `${API.lrclib}/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(song)}`;

    try {
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'LyricsFinder/1.0 (https://github.com/lyrics-finder)'
            }
        });

        if (response.ok) {
            const results = await response.json();
            if (results && results.length > 0) {
                const best = results[0];
                if (best.plainLyrics && best.plainLyrics.trim()) {
                    return best.plainLyrics;
                }
                if (best.syncedLyrics) {
                    return best.syncedLyrics.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
                }
            }
        }
    } catch (e) {
        console.log('LRCLIB search failed');
    }

    throw new Error('LRCLIB_NOT_FOUND');
}

/**
 * Fetch lyrics from Lyrics.ovh API (BACKUP)
 */
async function fetchFromLyricsOvh(artist, song) {
    const cleanArtist = encodeURIComponent(artist.trim());
    const cleanSong = encodeURIComponent(song.trim());

    const url = `${API.lyricsOvh}/${cleanArtist}/${cleanSong}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('LYRICS_NOT_FOUND');
        }

        const data = await response.json();

        if (!data.lyrics || data.lyrics.trim() === '') {
            throw new Error('LYRICS_EMPTY');
        }

        return data.lyrics;
    } catch (error) {
        throw new Error('LYRICS_OVH_NOT_FOUND');
    }
}

/**
 * Main lyrics fetcher - tries multiple APIs with fallback
 */
async function fetchLyrics(artist, song) {
    console.log(`🔍 Searching lyrics for: "${song}" by "${artist}"`);

    // Try LRCLIB first (most reliable, free, 3M+ songs)
    try {
        const lyrics = await fetchFromLrclib(artist, song);
        console.log('✅ Found lyrics on LRCLIB');
        return lyrics;
    } catch (e) {
        console.log('⚠️ LRCLIB failed, trying Lyrics.ovh...');
    }

    // Fallback to Lyrics.ovh
    try {
        const lyrics = await fetchFromLyricsOvh(artist, song);
        console.log('✅ Found lyrics on Lyrics.ovh');
        return lyrics;
    } catch (e) {
        console.log('❌ Lyrics.ovh also failed');
    }

    throw new Error('LYRICS_NOT_FOUND');
}

/**
 * Try multiple search strategies to find lyrics
 */
async function findLyrics(artist, song) {
    const strategies = [
        // Strategy 1: Direct search with original values
        { artist, song },
        // Strategy 2: Remove parenthetical content from song
        { artist, song: song.replace(/\(.*?\)/g, '').trim() },
        // Strategy 3: Remove brackets from song
        { artist, song: song.replace(/\[.*?\]/g, '').trim() },
        // Strategy 4: Try with "The" prefix removed from artist
        { artist: artist.replace(/^The\s+/i, ''), song },
        // Strategy 5: Try first word of artist only (for bands)
        { artist: artist.split(' ')[0], song },
        // Strategy 6: Clean both - no featuring, no remix tags
        {
            artist: artist.replace(/\s*feat\..*$/i, '').trim(),
            song: song.replace(/\s*\(.*?(remix|version|edit).*?\)/gi, '').trim()
        }
    ];

    for (const strategy of strategies) {
        if (!strategy.artist || !strategy.song) continue;
        if (strategy.song.length < 2) continue; // Skip if song name is too short

        try {
            console.log(`📝 Trying: "${strategy.song}" by "${strategy.artist}"`);
            const lyrics = await fetchLyrics(strategy.artist, strategy.song);
            return lyrics;
        } catch (error) {
            // Try next strategy
            continue;
        }
    }

    throw new Error('LYRICS_NOT_FOUND');
}

// ============================================
// Display Functions
// ============================================

/**
 * Display lyrics with karaoke-style formatting
 */
function displayLyrics(lyrics, title, artist, thumbnailUrl) {
    // Store current lyrics for copy functionality
    currentLyrics = lyrics;

    // Set song info
    elements.songTitle.textContent = title;
    elements.songArtist.textContent = artist || 'Unknown Artist';

    // Set thumbnail
    if (thumbnailUrl) {
        elements.songThumbnail.innerHTML = `<img src="${thumbnailUrl}" alt="Song thumbnail">`;
    } else {
        elements.songThumbnail.innerHTML = '🎵';
    }

    // Format and display lyrics
    const lines = lyrics.split('\n');
    const formattedLyrics = lines.map(line => {
        const trimmedLine = line.trim();
        if (trimmedLine === '') {
            return '<div class="lyrics-line empty"></div>';
        }
        return `<div class="lyrics-line">${escapeHtml(trimmedLine)}</div>`;
    }).join('');

    elements.lyricsDisplay.innerHTML = formattedLyrics;
    elements.lyricsDisplay.style.fontSize = `${currentFontSize}rem`;

    showSection(elements.lyricsSection);
}

/**
 * Escape HTML to prevent XSS
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
    // Validate URL
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
        showError('Please enter a valid YouTube URL.');
        return;
    }

    showSection(elements.loadingSection);

    try {
        // Step 1: Get video info from YouTube
        const videoInfo = await getYouTubeVideoInfo(videoId);

        // Step 2: Parse title to get artist and song
        const { artist, song } = parseSongTitle(videoInfo.title);

        if (!song) {
            throw new Error('Could not identify song title from video.');
        }

        // Pre-fill manual search fields for user convenience
        elements.artistInput.value = artist;
        elements.songInput.value = song;

        // Step 3: Fetch lyrics
        const searchArtist = artist || videoInfo.author;
        const lyrics = await findLyrics(searchArtist, song);

        // Step 4: Display results
        displayLyrics(lyrics, song, searchArtist, videoInfo.thumbnailUrl);

    } catch (error) {
        console.error('Analysis error:', error);

        if (error.message === 'LYRICS_NOT_FOUND') {
            showError('Lyrics not found. Try using the manual search below with the exact artist and song name.');
        } else if (error.message === 'API_ERROR') {
            showError('Could not connect to lyrics service. Please try again later.');
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
        const lyrics = await fetchLyrics(artist, song);
        displayLyrics(lyrics, song, artist, null);
    } catch (error) {
        if (error.message === 'LYRICS_NOT_FOUND' || error.message === 'LYRICS_EMPTY') {
            showError('Lyrics not found. Please check the spelling and try again.');
        } else {
            showError('Could not connect to lyrics service. Please try again later.');
        }
    }
}

// ============================================
// Event Listeners
// ============================================

// Analyze button click
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

// Manual search button
elements.manualSearchBtn.addEventListener('click', manualSearch);

// Enter key on manual inputs
elements.songInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        manualSearch();
    }
});

elements.artistInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        elements.songInput.focus();
    }
});

// Retry button
elements.retryBtn.addEventListener('click', () => {
    showSection(null);
    elements.youtubeUrl.focus();
});

// Font size controls
elements.fontIncrease.addEventListener('click', () => {
    if (currentFontSize < 2) {
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

// URL paste detection - auto-analyze
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
console.log('🎵 Lyrics Finder initialized!');
