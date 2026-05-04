(async function init() {
    const params = new URLSearchParams(window.location.search);
    const HUB_PATH = '/hub.html';

    function normalizeApiForRedirect(value) {
        if (typeof value !== 'string' || !value.trim()) {
            return '';
        }

        try {
            const parsed = new URL(value.trim(), window.location.origin);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                return '';
            }
            return parsed.origin;
        } catch (error) {
            return '';
        }
    }

    function resolveHubRedirectPath() {
        const explicitApi = normalizeApiForRedirect(params.get('api'));
        const apiOrigin = explicitApi || normalizeApiForRedirect(window.API_URL);
        if (!apiOrigin || apiOrigin === window.location.origin) {
            return HUB_PATH;
        }
        return `${HUB_PATH}?api=${encodeURIComponent(apiOrigin)}`;
    }

    const hubRedirectPath = resolveHubRedirectPath();
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    googleLoginBtn?.addEventListener('click', () => {
        loginWithGoogle(hubRedirectPath);
    });

    // Heartbeat with Freeze Detector
    let lastPulse = Date.now();
    setInterval(() => {
        const now = Date.now();
        const gap = now - lastPulse;
        if (gap > 2000) {
            console.warn(`[LOGIN-FREEZE-DETECTOR] ⚠️ UI Thread blocked for ${gap}ms!`);
        }
        lastPulse = now;

        let jsHeap = 'N/A';
        if (window.performance && window.performance.memory) {
            const mem = window.performance.memory;
            jsHeap = `${(mem.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB / ${(mem.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`;
        }
        console.log(`[LOGIN-HEARTBEAT] 🕒 Alive at ${new Date().toLocaleTimeString()} | 🧠 Memory: ${jsHeap}`);
    }, 1000);

    // Check if we just bounced from the hub in a loop
    const loopKey = `platform_auth_redirect:${HUB_PATH}`;
    const lastRedirect = Number(sessionStorage.getItem(loopKey)) || 0;
    const now = Date.now();

    console.info('[Login] Initialization starting...', {
        lastHubRedirect: lastRedirect ? new Date(lastRedirect).toLocaleTimeString() : 'none',
        time: new Date().toLocaleTimeString()
    });

    console.debug('[Login] Checking authentication...');
    const user = await checkAuth();
    
    if (user && !user.error) {
        console.info('[Login] User already authenticated:', user.name);
        if (now - lastRedirect < 10000) {
            console.error('[Login] Sync issue: checkAuth succeeded but hub auth failed just now.');
            const errorMsg = document.getElementById('errorMsg');
            if (errorMsg) {
                errorMsg.textContent = 'Erro de sincronizacao de sessao. Limpe o cache do navegador.';
                errorMsg.classList.remove('hidden');
            }
            return;
        }
        console.info('[Login] Redirecting to Hub.');
        window.location.replace(hubRedirectPath);
    } else {
        console.debug('[Login] No valid session found. Ready for user interaction.');
    }

    if (params.get('error')) {
        const errorMsg = document.getElementById('errorMsg');
        if (errorMsg) {
            errorMsg.textContent = 'Erro ao fazer login. Tente novamente.';
            errorMsg.classList.remove('hidden');
        }
    }

    // Dev login initialization
    const devMode = await checkDevMode();
    if (devMode?.devLoginEnabled) {
        const devSection = document.getElementById('devLoginSection');
        const devNameInput = document.getElementById('devName');
        const devEmailInput = document.getElementById('devEmail');
        const devLoginBtn = document.getElementById('devLoginBtn');

        if (devSection && devNameInput && devEmailInput && devLoginBtn) {
            devNameInput.value = devMode.defaultName || 'Dev User';
            devEmailInput.value = devMode.defaultEmail || 'dev@localhost';
            devSection.classList.remove('hidden');

            devLoginBtn.addEventListener('click', async () => {
                devLoginBtn.disabled = true;
                devLoginBtn.textContent = '⏳ Entrando...';

                const result = await loginAsDev(
                    devNameInput.value.trim(),
                    devEmailInput.value.trim()
                );

                if (result?.ok) {
                    window.location.replace(result.redirectTo || '/hub.html');
                } else {
                    devLoginBtn.disabled = false;
                    devLoginBtn.textContent = '🔧 Entrar como Dev';
                    const errorMsg = document.getElementById('errorMsg');
                    if (errorMsg) {
                        errorMsg.textContent = 'Erro no login dev. Verifique o backend.';
                        errorMsg.classList.remove('hidden');
                    }
                }
            });
        }
    }
})();
