document.addEventListener("DOMContentLoaded", () => {
    // --- Global Variables ---
    let hls;
    let channels = {};
    let currentChannelId = null;

    // --- DOM Elements ---
    const video = document.getElementById('video');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const progressBar = document.getElementById('progress-bar');
    const timeDisplay = document.getElementById('time-display');
    const muteBtn = document.getElementById('mute-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const playerWrapper = document.querySelector('.player-wrapper');
    const channelButtonsContainer = document.getElementById('channel-buttons-container');
    const playOverlay = document.getElementById('play-overlay');
    const bigPlayBtn = document.getElementById('big-play-btn');

    // --- Player Logic ---
    const playerControls = {
        togglePlay: () => video.paused ? video.play() : video.pause(),
        updatePlayButton: () => playPauseBtn.textContent = video.paused ? '▶️' : '⏸️',
        formatTime: (time) => {
            const minutes = Math.floor(time / 60);
            const seconds = Math.floor(time % 60);
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        },
        updateProgress: () => {
            progressBar.value = (video.currentTime / video.duration) * 100 || 0;
            timeDisplay.textContent = `${playerControls.formatTime(video.currentTime)} / ${playerControls.formatTime(video.duration || 0)}`;
        },
        setProgress: () => video.currentTime = (progressBar.value / 100) * video.duration,
        toggleMute: () => video.muted = !video.muted,
        updateMuteButton: () => muteBtn.textContent = video.muted || video.volume === 0 ? '🔇' : '🔊',
        setVolume: () => video.volume = volumeSlider.value,
        toggleFullscreen: () => {
            if (!document.fullscreenElement) {
                playerWrapper.requestFullscreen().catch(err => alert(`Error: ${err.message}`));
            } else {
                document.exitFullscreen();
            }
        },
        handleInitialPlay: () => {
            video.muted = false; // Unmute after user interaction
            video.play();
            playOverlay.classList.add('hidden');
        }
    };

    // --- Channel Logic ---
    const channelManager = {
        updateActiveButton: () => {
            const tiles = channelButtonsContainer.querySelectorAll('.channel-tile');
            tiles.forEach(tile => tile.classList.toggle('active', tile.dataset.channelId === currentChannelId));
        },
        createChannelButtons: () => {
            channelButtonsContainer.innerHTML = '';
            for (const channelId in channels) {
                const channel = channels[channelId];
                const tile = document.createElement('a');
                tile.className = 'channel-tile';
                tile.dataset.channelId = channelId;
                tile.onclick = () => channelManager.loadChannel(channelId);
                const logoImg = document.createElement('img');
                logoImg.src = channel.logo;
                logoImg.alt = channel.name;
                const nameSpan = document.createElement('span');
                nameSpan.className = 'channel-tile-name';
                nameSpan.innerText = channel.name;
                tile.appendChild(logoImg);
                tile.appendChild(nameSpan);
                channelButtonsContainer.appendChild(tile);
            }
        },
        loadChannel: (channelId) => {
            if (!channels[channelId]) return;
            currentChannelId = channelId;
            const channel = channels[channelId];
            channelManager.updateActiveButton();
            if (hls) {
                hls.loadSource(channel.url);
            }
            // Ensure play overlay is hidden when changing channels
            if (!playOverlay.classList.contains('hidden')) {
                 playerControls.handleInitialPlay();
            } else {
                 video.play();
            }
        }
    };
    
    // --- Datetime Logic ---
    const timeManager = {
        update: () => {
            const now = new Date();
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const thaiDate = now.toLocaleDateString('th-TH', options);
            const thaiTime = now.toLocaleTimeString('th-TH');
            document.getElementById('datetime-display').textContent = `${thaiDate}, ${thaiTime}`;
        },
        start: () => {
            timeManager.update();
            setInterval(timeManager.update, 1000);
        }
    };

    // --- Event Listener Setup ---
    function setupEventListeners() {
        bigPlayBtn.addEventListener('click', playerControls.handleInitialPlay);
        playPauseBtn.addEventListener('click', playerControls.togglePlay);
        video.addEventListener('play', playerControls.updatePlayButton);
        video.addEventListener('pause', playerControls.updatePlayButton);
        progressBar.addEventListener('input', playerControls.setProgress);
        video.addEventListener('timeupdate', playerControls.updateProgress);
        muteBtn.addEventListener('click', playerControls.toggleMute);
        volumeSlider.addEventListener('input', playerControls.setVolume);
        video.addEventListener('volumechange', () => {
            playerControls.updateMuteButton();
            volumeSlider.value = video.volume;
        });
        fullscreenBtn.addEventListener('click', playerControls.toggleFullscreen);
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
            hls = new Hls();
            hls.attachMedia(video);
        }
        
        setupEventListeners();
        timeManager.start();
        channelManager.createChannelButtons();
        
        const firstChannelId = Object.keys(channels)[0];
        if (firstChannelId) {
            // Load the first channel but don't play it yet, wait for user interaction
            currentChannelId = firstChannelId;
            const channel = channels[firstChannelId];
            channelManager.updateActiveButton();
            if (hls) {
                hls.loadSource(channel.url);
            }
        }
    }
    
    init();
});
