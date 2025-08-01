document.addEventListener("DOMContentLoaded", () => {
    // --- Global Variables ---
    let hls, channels = {}, currentChannelId = null;
    let controlsTimeout;
    let isAudioUnlocked = false;

    // --- DOM Elements ---
    const body = document.body;
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const refreshChannelsBtn = document.getElementById('refresh-channels-btn');
    const video = document.getElementById('video');
    const playerWrapper = document.querySelector('.player-wrapper');
    const customControls = document.querySelector('.custom-controls');
    const channelButtonsContainer = document.getElementById('channel-buttons-container');
    const loadingIndicator = document.getElementById('loading-indicator');
    const loadingMessage = document.getElementById('loading-message');
    const errorOverlay = document.getElementById('error-overlay');
    const errorMessage = document.getElementById('error-message');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const progressBar = document.getElementById('progress-bar');
    const timeDisplay = document.getElementById('time-display');
    const muteBtn = document.getElementById('mute-btn');
    const volumeSlider = document.getElementById('volume-slider');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const pipBtn = document.getElementById('pip-btn');
    const liveIndicator = document.getElementById('live-indicator');
    const playOverlay = document.getElementById('play-overlay');

    // --- Audio Unlock Function ---
    function unlockAudio() {
        if (isAudioUnlocked) return;
        
        console.log("Audio unlocked by user interaction.");
        isAudioUnlocked = true;
        
        const savedMuted = localStorage.getItem('webtv_muted') === 'true';
        video.muted = savedMuted;
        playerControls.updateMuteButton();

        document.removeEventListener('click', unlockAudio);
        document.removeEventListener('keydown', unlockAudio);
    }

    // --- Player Logic ---
    function showLoadingIndicator(isLoading, message = '') {
        loadingIndicator.classList.toggle('hidden', !isLoading);
        if (isLoading) {
            loadingMessage.textContent = message;
        }
    }

    const playerControls = {
        showError: (message) => {
            const errorChannelName = document.getElementById('error-channel-name');
            if (currentChannelId && channels[currentChannelId]) {
                errorChannelName.textContent = channels[currentChannelId].name;
                errorChannelName.style.display = 'block';
            } else {
                errorChannelName.style.display = 'none';
            }
            if (errorMessage) errorMessage.textContent = message;
            if (errorOverlay) errorOverlay.classList.remove('hidden');
            const retryBtn = document.getElementById('retry-btn');
            const newBtn = retryBtn.cloneNode(true);
            newBtn.addEventListener('click', () => {
                if (currentChannelId) channelManager.loadChannel(currentChannelId);
            });
            retryBtn.parentNode.replaceChild(newBtn, retryBtn);
        },
        hideError: () => {
            if (errorOverlay) errorOverlay.classList.add('hidden');
        },
        togglePlay: () => {
            if (video.paused) {
                video.play().catch(e => { if (e.name !== 'AbortError') console.error("Error playing video:", e); });
            } else {
                video.pause();
            }
        },
        updatePlayButton: () => {
            playPauseBtn.querySelector('.icon-play').classList.toggle('hidden', !video.paused);
            playPauseBtn.querySelector('.icon-pause').classList.toggle('hidden', video.paused);
        },
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
        toggleMute: () => {
            unlockAudio();
            video.muted = !video.muted;
            localStorage.setItem('webtv_muted', video.muted);
            playerControls.updateMuteButton();
        },
        updateMuteButton: () => {
            const isMuted = video.muted || video.volume === 0;
            muteBtn.querySelector('.icon-volume-high').classList.toggle('hidden', isMuted);
            muteBtn.querySelector('.icon-volume-off').classList.toggle('hidden', !isMuted);
        },
        setVolume: () => {
            unlockAudio();
            video.volume = volumeSlider.value;
            video.muted = Number(volumeSlider.value) === 0;
            playerControls.updateMuteButton();
            localStorage.setItem('webtv_volume', video.volume);
            localStorage.setItem('webtv_muted', video.muted);
        },
        toggleFullscreen: () => {
            if (!document.fullscreenElement) playerWrapper.requestFullscreen().catch(err => alert(`Error: ${err.message}`));
            else document.exitFullscreen();
        },
        togglePip: async () => {
            if (!document.pictureInPictureEnabled) return alert('เบราว์เซอร์ของคุณไม่รองรับ Picture-in-Picture');
            try {
                if (document.pictureInPictureElement) await document.exitPictureInPicture();
                else await video.requestPictureInPicture();
            } catch (error) { console.error("เกิดข้อผิดพลาดในการเปิดโหมด PiP:", error); }
        },
        hideControls: () => {
            if (video.paused) return;
            customControls.classList.add('controls-hidden');
            playerWrapper.classList.add('hide-cursor');
        },
        showControls: () => {
            customControls.classList.remove('controls-hidden');
            playerWrapper.classList.remove('hide-cursor');
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(playerControls.hideControls, 3000);
        },
        checkIfLive: () => {
            const isLive = !isFinite(video.duration);
            progressBar.style.display = isLive ? 'none' : 'flex';
            timeDisplay.style.display = isLive ? 'none' : 'block';
            if (liveIndicator) liveIndicator.classList.toggle('hidden', !isLive);
        }
    };

    // --- Channel Logic ---
    const channelManager = {
        updateActiveButton: () => {
            document.querySelectorAll('.channel-tile').forEach(tile => tile.classList.toggle('active', tile.dataset.channelId === currentChannelId));
        },
        createChannelButtons: () => {
            channelButtonsContainer.innerHTML = '';
            const groupedChannels = {};
            for (const channelId in channels) {
                const channel = channels[channelId];
                const category = channel.category || 'ทั่วไป';
                if (!groupedChannels[category]) groupedChannels[category] = [];
                groupedChannels[category].push({ id: channelId, ...channel });
            }
            for (const category in groupedChannels) {
                const header = document.createElement('h2');
                header.className = 'channel-category-header';
                header.textContent = category;
                channelButtonsContainer.appendChild(header);
                const grid = document.createElement('div');
                grid.className = 'channel-buttons';
                groupedChannels[category].forEach((channel, index) => {
                    const tile = document.createElement('a');
                    tile.className = 'channel-tile';
                    tile.dataset.channelId = channel.id;
                    tile.addEventListener('click', () => {
                        document.querySelectorAll('.channel-tile.loading').forEach(t => t.classList.remove('loading'));
                        tile.classList.add('loading');
                        channelManager.loadChannel(channel.id);
                        playerWrapper.scrollIntoView({ behavior: 'smooth' });
                    });
                    
                    const logoWrapper = document.createElement('div');
                    logoWrapper.className = 'channel-logo-wrapper';
                    
                    const logoImg = document.createElement('img');
                    logoImg.src = channel.logo;
                    logoImg.alt = channel.name;
                    logoImg.loading = 'lazy';
                    
                    logoWrapper.appendChild(logoImg);
                    tile.appendChild(logoWrapper);

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'channel-tile-name';
                    nameSpan.innerText = channel.name;
                    tile.appendChild(nameSpan);

                    if (channel.badge) {
                        const badge = document.createElement('div');
                        badge.className = 'channel-badge';
                        badge.textContent = channel.badge;
                        tile.appendChild(badge);
                    }
                    
                    tile.style.animationDelay = `${index * 0.05}s`;
                    grid.appendChild(tile);
                });
                channelButtonsContainer.appendChild(grid);
            }
        },
        loadChannel: async (channelId) => {
            if (!channels[channelId] || currentChannelId === channelId) return;
            video.classList.remove('visible');
            playerControls.hideError();
            showLoadingIndicator(true, 'กำลังโหลดช่อง...');
            await new Promise(resolve => setTimeout(resolve, 300));
            currentChannelId = channelId;
            localStorage.setItem('webtv_lastChannelId', channelId);
            const channel = channels[channelId];
            document.title = `▶️ ${channel.name} - Flow TV`;
            channelManager.updateActiveButton();
            try {
                if (hls) hls.loadSource(channel.url);
            } catch (error) {
                console.error("Error loading channel:", error);
            }
        }
    };
    
    // --- Datetime Logic ---
    const timeManager = {
        update: () => {
            const now = new Date();
            const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const timeOptions = { hour: '2-digit', minute: '2-digit' };
            const thaiDate = now.toLocaleDateString('th-TH', dateOptions);
            const thaiTime = now.toLocaleTimeString('th-TH', timeOptions);
            document.getElementById('datetime-display').innerHTML = `🕒 ${thaiDate} ${thaiTime}`;
        },
        start: () => {
            timeManager.update();
            setInterval(timeManager.update, 1000);
        }
