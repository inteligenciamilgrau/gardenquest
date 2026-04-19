(function resolvePlatformApiUrl() {
    const API_STORAGE_KEY = 'img_platform_api_url';

    function buildTrustedOrigins(explicitApiUrl) {
        const trusted = new Set([window.location.origin]);

        if (explicitApiUrl) {
            trusted.add(explicitApiUrl);
        }

        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            trusted.add('http://localhost:8080');
        }

        if (Array.isArray(window.API_URL_ALLOWLIST)) {
            for (const origin of window.API_URL_ALLOWLIST) {
                const normalized = normalizeApiUrl(origin);
                if (normalized) {
                    trusted.add(normalized);
                }
            }
        }

        return trusted;
    }

    function isTrustedOrigin(apiUrl, trustedOrigins) {
        return Boolean(apiUrl) && trustedOrigins.has(apiUrl);
    }

    function normalizeApiUrl(value) {
        if (typeof value !== 'string') {
            return '';
        }

        const trimmed = value.trim();
        if (!trimmed) {
            return '';
        }

        try {
            const parsed = new URL(trimmed);
            return parsed.origin;
        } catch (_error) {
            return '';
        }
    }

    const params = new URLSearchParams(window.location.search || '');
    const queryApiUrl = normalizeApiUrl(params.get('api'));
    const explicitApiUrl = normalizeApiUrl(window.API_URL);
    const trustedOrigins = buildTrustedOrigins(explicitApiUrl);

    let storedApiUrl = '';
    try {
        storedApiUrl = normalizeApiUrl(window.localStorage.getItem(API_STORAGE_KEY));
    } catch (_error) {
        storedApiUrl = '';
    }

    if (!isTrustedOrigin(storedApiUrl, trustedOrigins)) {
        storedApiUrl = '';
    }

    if (isTrustedOrigin(queryApiUrl, trustedOrigins)) {
        try {
            window.localStorage.setItem(API_STORAGE_KEY, queryApiUrl);
        } catch (_error) {
            // ignore storage failures in privacy mode
        }
    }

    const localhostDefault = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:8080'
        : '';

    const safeQueryApiUrl = isTrustedOrigin(queryApiUrl, trustedOrigins) ? queryApiUrl : '';
    window.API_URL = explicitApiUrl || safeQueryApiUrl || storedApiUrl || localhostDefault;
    console.info(`[Platform-Config] API URL resolved to: ${window.API_URL || '(relative)'}`);
})();
