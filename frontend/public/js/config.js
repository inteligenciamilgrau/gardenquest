const LOCAL_API_URL_STORAGE_KEY = 'gardenquest.localApiUrl';

function normalizeApiUrl(value) {
    if (typeof value !== 'string' || !value.trim()) {
        return '';
    }

    try {
        const parsed = new URL(value.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }

        return parsed.origin;
    } catch (error) {
        return '';
    }
}

function isLocalHostname(hostname) {
    const normalizedHostname = String(hostname || '')
        .trim()
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .toLowerCase();

    return (
        normalizedHostname === 'localhost' ||
        normalizedHostname === '127.0.0.1' ||
        normalizedHostname === '::1' ||
        normalizedHostname === '::' ||
        !normalizedHostname
    );
}

function resolveLocalApiUrlOverride() {
    const searchParams = new URLSearchParams(window.location.search);
    const queryOverride =
        normalizeApiUrl(searchParams.get('apiUrl')) ||
        normalizeApiUrl(searchParams.get('api_url'));

    if (queryOverride) {
        try {
            window.localStorage.setItem(LOCAL_API_URL_STORAGE_KEY, queryOverride);
        } catch (error) {
            // Ignore storage failures and still use the explicit query override.
        }
        return queryOverride;
    }

    try {
        return normalizeApiUrl(window.localStorage.getItem(LOCAL_API_URL_STORAGE_KEY));
    } catch (error) {
        return '';
    }
}

window.API_URL =
    isLocalHostname(window.location.hostname)
        ? resolveLocalApiUrlOverride() || 'http://localhost:8080'
        : '';
