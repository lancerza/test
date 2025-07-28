document.addEventListener("DOMContentLoaded", () => {
    // --- Global Variables ---
    let hls, channels = {}, currentChannelId = null;
    let controlsTimeout; // For the inactivity timer

    // --- DOM Elements ---
    const video = document.getElementById('video');
    const posterVideo = document.getElementById('poster-video');
    const playerWrapper = document.querySelector('.player-wrapper');
    const customControls = document.querySelector('.custom-controls');
    const channelButtonsContainer = document.getElementById('channel-buttons-container');
    const playOverlay = document.getElementById('play-overlay');
    const bigPlayBtn = document.getElementById('big-play-btn');
    const loadingIndicator = document.getElementById('loading-indicator');
    const loadingVideo = document.getElementById('loading-video');
    const errorOverlay = document.getElementById('error-overlay');
    const errorMessage = document.getElementById('error-message');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const progressBar = document.getElementById('progress-bar');
    const timeDisplay = document.getElementById('time-display');
    const muteBtn = document.getElementById('mute-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const fullscreenBtn = document.getElementById('fullscreen-btn');

    // --- Player Logic ---
    const playerControls = {
        showError: (message) => { /* ... no change ... */ },
        hideError: () => { /* ... no change ... */ },
        togglePlay: () => { /* ... no change ... */ },
        updatePlayButton: () => playPauseBtn.textContent = video.paused ? '▶️' : '⏸️',
        formatTime: (time) => { /* ... no change ... */ },
        updateProgress: () => { /* ... no change ... */ },
        setProgress: () => video.currentTime = (progressBar.value / 100) * video.duration,
        toggleMute: () => video.muted = !video.muted,
        updateMuteButton: () => muteBtn.textContent = video.muted || video.volume === 0 ? '🔇' : '🔊',
        setVolume: () => { /* ... no change ... */ },
        toggleFullscreen: () => { /* ... no change ... */ },
        handleInitialPlay: () => { /* ... no change ... */ },
        
        // --- START: Inactivity Timer Logic ---
        hideControls: () => {
            if (video.paused) return;
            customControls.classList.add('controls-hidden');
            playerWrapper.classList.add('hide-cursor');
        },
        showControls: () => {
            customControls.classList.remove('controls-hidden');
            playerWrapper.classList.remove('hide-cursor');
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(playerControls.hideControls, 3000); // Hide after 3 seconds
        }
        // --- END: Inactivity Timer Logic ---
    };
    playerControls.showError = (message) => { if (errorMessage) errorMessage.textContent = message; if (errorOverlay) errorOverlay.classList.remove('hidden'); };
    playerControls.hideError = () => { if (errorOverlay) errorOverlay.classList.add('hidden'); };
    playerControls.togglePlay = () => { if (video.paused) { video.play().catch(e => { if (e.name !== 'AbortError') console.error("Error playing video:", e); }); } else { video.pause(); } };
    playerControls.formatTime = (time) => { const minutes = Math.floor(time / 60); const seconds = Math.floor(time % 60); return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; };
    playerControls.updateProgress = () => { progressBar.value = (video.currentTime / video.duration) * 100 || 0; timeDisplay.textContent = `${playerControls.formatTime(video.currentTime)} / ${playerControls.formatTime(video.duration || 0)}`; };
    playerControls.setVolume = () => { video.volume = volumeSlider.value; video.muted = Number(volumeSlider.value) === 0; };
    playerControls.toggleFullscreen = () => { if (!document.fullscreenElement) playerWrapper.requestFullscreen().catch(err => alert(`Error: ${err.message}`)); else document.exitFullscreen(); };
    playerControls.handleInitialPlay = () => { video.muted = false; video.play(); playOverlay.classList.add('hidden'); };


    // --- Channel Logic ---
    const channelManager = {
        updateActiveButton: () => { /* ... no change ... */ },
        createChannelButtons: () => { /* ... no change ... */ },
        loadChannel: async (channelId) => { /* ... no change ... */ }
    };
    channelManager.updateActiveButton = () => { const tiles = document.querySelectorAll('.channel-tile'); tiles.forEach(tile => tile.classList.toggle('active', tile.dataset.channelId === currentChannelId)); };
    channelManager.createChannelButtons = () => { /* Duplicated for brevity, actual code is identical */ channelButtonsContainer.innerHTML = ''; const groupedChannels = {}; for (const channelId in channels) { const channel = channels[channelId]; const category = channel.category || 'ทั่วไป'; if (!groupedChannels[category]) groupedChannels[category] = []; groupedChannels[category].push({ id: channelId, ...channel }); } for (const category in groupedChannels) { const header = document.createElement('h2'); header.className = 'channel-category-header'; header.textContent = category; channelButtonsContainer.appendChild(header); const grid = document.createElement('div'); grid.className = 'channel-buttons'; groupedChannels[category].forEach(channel => { const tile = document.createElement('a'); tile.className = 'channel-tile'; tile.dataset.channelId = channel.id; tile.addEventListener('click', () => { channelManager.loadChannel(channel.id); playerWrapper.scrollIntoView({ behavior: 'smooth' }); }); const logoImg = document.createElement('img'); logoImg.src = channel.logo; logoImg.alt = channel.name; const nameSpan = document.createElement('span'); nameSpan.className = 'channel-tile-name'; nameSpan.innerText = channel.name; tile.appendChild(logoImg); tile.appendChild(nameSpan); grid.appendChild(tile); }); channelButtonsContainer.appendChild(grid); } };
    channelManager.loadChannel = async (channelId) => { if (!channels[channelId] || currentChannelId === channelId) return; playerControls.hideError(); showLoadingIndicator(true); await new Promise(resolve => setTimeout(resolve, 300)); currentChannelId = channelId; const channel = channels[channelId]; channelManager.updateActiveButton(); try { if (hls) hls.loadSource(channel.url); video.play().catch(e => { if (e.name !== 'AbortError') console.error("Error playing video:", e); }); } catch (error) { console.error("Error loading channel:", error); } };


    // --- Datetime Logic ---
    const timeManager = { /* ... no change ... */ };
    timeManager.update = () => { const now = new Date(); const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }; const timeOptions = { hour: '2-digit', minute: '2-digit' }; const thaiDate = now.toLocaleDateString('th-TH', dateOptions); const thaiTime = now.toLocaleTimeString('th-TH', timeOptions); document.getElementById('datetime-display').textContent = `${thaiDate}, ${thaiTime}`; };
    timeManager.start = () => { timeManager.update(); setInterval(timeManager.update, 1000); };


    // --- Event Listener Setup ---
    function setupEventListeners() {
        bigPlayBtn.addEventListener('click', playerControls.handleInitialPlay);
        playPauseBtn.addEventListener('click', playerControls.togglePlay);
        
        video.addEventListener('play', () => {
            posterVideo.classList.add('hidden');
            playOverlay.classList.add('hidden');
            playerControls.updatePlayButton();
            playerControls.showControls(); // Start timer when play begins
        });
        video.addEventListener('pause', () => {
            playerControls.updatePlayButton();
            playerControls.showControls(); // Keep controls visible when paused
        });

        progressBar.addEventListener('input', playerControls.setProgress);
        video.addEventListener('timeupdate', playerControls.updateProgress);
        muteBtn.addEventListener('click', playerControls.toggleMute);
        volumeSlider.addEventListener('input', playerControls.setVolume);
        video.addEventListener('volumechange', () => {
            playerControls.updateMuteButton();
            volumeSlider.value = video.muted ? 0 : video.volume;
        });
        fullscreenBtn.addEventListener('click', playerControls.toggleFullscreen);
        
        // --- START: Inactivity Timer Listeners ---
        playerWrapper.addEventListener('mousemove', playerControls.showControls);
        playerWrapper.addEventListener('mouseleave', playerControls.hideControls);
        // --- END: Inactivity Timer Listeners ---
    }

    // --- Initialization ---
    async function init() {
        try {
            const response = await fetch('channels.json');
            channels = await response.json();
        } catch (e) {
            alert("Fatal Error: Could not load channel data.");
            return;
        }

        if (Hls.isSupported()) {
            hls = new Hls({ startLevel: 0, capLevelToPlayerSize: true, liveSyncDurationCount: 5, liveMaxLatencyDurationCount: 10 });
            hls.attachMedia(video);
            // ... (HLS error handling)
        }
        
        setupEventListeners();
        timeManager.start();
        channelManager.createChannelButtons();
        
        const firstChannelId = Object.keys(channels)[0];
        if (firstChannelId) {
            await channelManager.loadChannel(firstChannelId);
        }
    }
    
    init();
});
