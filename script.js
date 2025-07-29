document.addEventListener("DOMContentLoaded", () => {
    // ... ส่วน Global Variables และ DOM Elements ไม่เปลี่ยน ...

    // --- Player Logic ---
    // ... ส่วน Player Logic ไม่เปลี่ยน ...

    // --- Channel Logic ---
    const channelManager = {
        updateActiveButton: () => { /* ... ไม่เปลี่ยน ... */ },
        createChannelButtons: () => {
            channelButtonsContainer.innerHTML = '';
            const groupedChannels = {};
            for (const channelId in channels) { /* ... ไม่เปลี่ยน ... */ }
            
            for (const category in groupedChannels) {
                const header = document.createElement('h2');
                header.className = 'channel-category-header';
                header.textContent = category;
                channelButtonsContainer.appendChild(header);
                const grid = document.createElement('div');
                grid.className = 'channel-buttons';
                groupedChannels[category].forEach(channel => {
                    const tile = document.createElement('a');
                    tile.className = 'channel-tile';
                    tile.dataset.channelId = channel.id;
                    tile.addEventListener('click', () => {
                        channelManager.loadChannel(channel.id);
                        if (window.innerWidth < 1024) { // บนมือถือให้เลื่อนขึ้น
                           playerWrapper.scrollIntoView({ behavior: 'smooth' });
                        }
                    });
                    const logoImg = document.createElement('img');
                    logoImg.src = channel.logo;
                    logoImg.alt = channel.name;
                    logoImg.loading = 'lazy';
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'channel-tile-name';
                    nameSpan.innerText = channel.name;

                    // ✨ 3. เพิ่ม span สำหรับ EPG
                    const epgSpan = document.createElement('span');
                    epgSpan.className = 'channel-tile-epg';
                    // ใส่ข้อความชั่วคราว - ในอนาคตจะดึงข้อมูลจริงมาใส่
                    epgSpan.innerText = 'กำลังโหลดข้อมูล...'; 

                    tile.appendChild(logoImg);
                    tile.appendChild(nameSpan);
                    tile.appendChild(epgSpan); // เพิ่ม epgSpan เข้าไปใน tile
                    grid.appendChild(tile);
                });
                channelButtonsContainer.appendChild(grid);
            }
        },
        loadChannel: async (channelId) => {
            if (!channels[channelId] || currentChannelId === channelId) return;
            
            // ✨ 2. ซ่อนวิดีโอเก่าก่อนโหลดช่องใหม่
            video.classList.remove('visible');

            playerControls.hideError();
            showLoadingIndicator(true);
            await new Promise(resolve => setTimeout(resolve, 300));
            currentChannelId = channelId;
            const channel = channels[channelId];
            channelManager.updateActiveButton();
            try {
                if (hls) hls.loadSource(channel.url);
                video.play().catch(e => { if (e.name !== 'AbortError') console.error("Error playing video:", e); });
            } catch (error) {
                console.error("Error loading channel:", error);
            }
        }
    };
    
    // --- Datetime Logic ---
    // ... ไม่เปลี่ยน ...

    // --- Event Listener Setup ---
    function setupEventListeners() {
        playPauseBtn.addEventListener('click', playerControls.togglePlay);
        video.addEventListener('play', () => {
            playerControls.updatePlayButton();
            playerControls.showControls();
        });
        
        // ✨ 2. ย้าย showLoadingIndicator(false) มาที่ 'playing' event
        video.addEventListener('playing', () => {
            showLoadingIndicator(false);
            // แสดงวิดีโอด้วยเอฟเฟกต์ Fade-in
            video.classList.add('visible'); 
        });

        video.addEventListener('pause', () => {
            playerControls.updatePlayButton();
            playerControls.showControls();
        });
        progressBar.addEventListener('input', playerControls.setProgress);
        video.addEventListener('timeupdate', playerControls.updateProgress);
        muteBtn.addEventListener('click', playerControls.toggleMute);
        volumeSlider.addEventListener('input', playerControls.setVolume);
        video.addEventListener('volumechange', () => {
            playerControls.updateMuteButton();
        });
        fullscreenBtn.addEventListener('click', playerControls.toggleFullscreen);
        playerWrapper.addEventListener('mousemove', playerControls.showControls);
        playerWrapper.addEventListener('mouseleave', playerControls.hideControls);
    }

    // --- Initialization ---
    // ... ไม่เปลี่ยน ...
    
    init();
});
