document.addEventListener('DOMContentLoaded', () => {
    void initializeHub();
});

let isHubInitialized = false;
let heartbeatInterval = null;
let memoryMonitorInterval = null;
let particlesInterval = null;

// Kill BFCache to ensure every visit is a fresh start
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        console.warn('[Hub] BFCache detected! Forcing hard reload...');
        window.location.reload();
    }
});

async function initializeHub() {
    if (isHubInitialized) return;
    isHubInitialized = true;

    // Nuclear Reset if returning from game to purge residue
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ref') === 'game_exit') {
        if (window.Platform && typeof window.Platform.getBootstrap === 'function') {
            await Platform.getBootstrap({ force: true }).catch(() => {});
        }
    }

    // Heartbeat with Freeze Detector (10s interval to avoid UI thread pressure)
    let lastPulse = Date.now();
    heartbeatInterval = setInterval(() => {
        const now = Date.now();
        const gap = now - lastPulse;
        if (gap > 12000) {
            console.warn(`[HUB-FREEZE-DETECTOR] ⚠️ UI Thread blocked for ${gap}ms!`);
        }
        lastPulse = now;
    }, 10000);

    // Memory Monitor cleared (merged into heartbeat)

    console.info('[Hub] Hub script starting...');


    const loadingState = document.getElementById('hubLoadingState');
    const errorState = document.getElementById('hubErrorState');
    const gamesGrid = document.getElementById('gamesGrid');
    const emptyState = document.getElementById('hubEmptyState');
    const userName = document.getElementById('hubUserName');
    const userAvatar = document.getElementById('hubUserAvatar');
    const adminLink = document.getElementById('hubAdminLink');
    const logoutBtn = document.getElementById('hubLogoutBtn');
    const retryBtn = document.getElementById('hubRetryBtn');

    retryBtn?.addEventListener('click', () => {
        window.location.reload();
    });

    logoutBtn?.addEventListener('click', () => {
        void Platform.logout();
    });

    try {
        const user = await Platform.requireAuth({ redirectPath: '/hub.html' });
        
        if (!user) {
            return;
        }

        const bootstrap = await Platform.getBootstrap();
        const games = Array.isArray(bootstrap?.games) ? bootstrap.games : [];
        

        if (userName) {
            userName.textContent = user.name || 'Jogador';
        }

        const bgParticles = document.getElementById('bgParticles');
        createParticles(bgParticles, 20);

        if (userAvatar) {
            if (user.picture) {
                userAvatar.src = user.picture;
            }
            userAvatar.alt = `Avatar de ${user.name || 'Jogador'}`;
            
            // Safe fallback without risking infinite loops
            userAvatar.onerror = () => {
                userAvatar.onerror = null;
                const fallbackName = encodeURIComponent(user.name || 'User');
                userAvatar.src = `https://ui-avatars.com/api/?name=${fallbackName}&background=random`;
            };
        }

        if (adminLink) {
            if (user.isAdmin) {
                adminLink.hidden = false;
            } else {
                adminLink.remove();
            }
        }

        renderGames(gamesGrid, games, emptyState);

        hideNode(loadingState);
        hideNode(errorState);

        // Track event without blocking the UI
        void Platform.trackEvent({
            event: 'platform_hub_view',
            details: `games=${games.length}`,
        }).catch(() => {});
    } catch (error) {
        console.error('Hub initialization failed:', error);
        hideNode(loadingState);
        showNode(errorState);
    }
}

function renderGames(container, games, emptyState) {
    if (!container) return;

    container.replaceChildren();

    if (!Array.isArray(games) || games.length < 1) {
        showNode(emptyState);
        return;
    }

    hideNode(emptyState);

    games.forEach((game) => {
        const card = document.createElement('article');
        card.className = 'game-card';
        card.style.setProperty('--game-accent', game.accentColor || '#38bd7e');
        card.style.setProperty('--game-surface', game.surfaceColor || '#10261b');

        const eyebrow = document.createElement('p');
        eyebrow.className = 'game-card-eyebrow';
        eyebrow.textContent = game.status === 'active' ? 'Disponivel agora' : 'Em preparacao';

        const title = document.createElement('h2');
        title.className = 'game-card-title';
        title.textContent = game.name || 'Jogo sem nome';

        const artwork = document.createElement('div');
        artwork.className = 'game-card-artwork';
        artwork.textContent = game.artworkLabel || 'JG';

        const description = document.createElement('p');
        description.className = 'game-card-copy';
        description.textContent = game.tagline || game.description || 'Sem descricao';

        const capabilityList = document.createElement('div');
        capabilityList.className = 'game-card-capabilities';

        const capabilities = Array.isArray(game.capabilities)
            ? game.capabilities.slice(0, 4)
            : [];

        capabilities.forEach((capability) => {
            const badge = document.createElement('span');
            badge.className = 'game-capability-badge';
            badge.textContent = formatCapability(capability);
            capabilityList.appendChild(badge);
        });

        const actionRow = document.createElement('div');
        actionRow.className = 'game-card-actions';

        const primaryButton = document.createElement('button');
        primaryButton.className = 'game-primary-btn';
        primaryButton.type = 'button';
        primaryButton.textContent = game.status === 'active' ? 'Abrir jogo' : 'Explorar (Dev)';
        primaryButton.disabled = false; // Force enable as requested
        primaryButton.addEventListener('click', async () => {
            primaryButton.disabled = true;

            await Platform.trackEvent({
                event: 'platform_game_launch',
                gameSlug: game.slug,
                details: `route=${game.route || ''}`,
            });

            try {
                // Use { replace: true } to flatten history stack and release the Hub's memory immediately
                await Platform.openGame(game.slug, { replace: true });
            } catch (error) {
                console.error('Failed to open game:', error);
                primaryButton.disabled = false;
            }
        });

        actionRow.append(primaryButton);
        card.append(eyebrow, artwork, title, description, capabilityList, actionRow);
        container.appendChild(card);
    });
}

function formatCapability(value) {
    return String(value || '')
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function hideNode(node) {
    if (node) {
        node.hidden = true;
    }
}

function showNode(node) {
    if (node) {
        node.hidden = false;
    }
}

function createParticles(container, count = 15) {
    if (!container) return;
    
    // Clear existing
    container.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random properties
        const size = Math.random() * 15 + 5;
        const left = Math.random() * 100;
        const duration = Math.random() * 10 + 10;
        const delay = Math.random() * 20;
        const opacity = Math.random() * 0.15 + 0.05;
        
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${left}%`;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `-${delay}s`;
        particle.style.background = `rgba(56, 189, 126, ${opacity})`;
        particle.style.borderRadius = '50%';
        particle.style.filter = 'blur(2px)';
        
        container.appendChild(particle);
    }
}

// Memory Cleanup: Clear intervals when navigating away to ensure zero overlap/leak
window.addEventListener('beforeunload', () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    if (memoryMonitorInterval) clearInterval(memoryMonitorInterval);
    if (particlesInterval) clearInterval(particlesInterval);
});
