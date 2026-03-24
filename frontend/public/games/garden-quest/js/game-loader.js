import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

window.THREE = THREE;

const assetBasePath = resolveAssetBasePath(window.PLATFORM_GAME_CONFIG?.assetBasePath || '/');
const gameScriptSources = [
    'js/player.js?v=25',
    'js/world.js?v=35',
    'js/actions.js?v=20',
    'js/game.js?v=60',
];

for (const src of gameScriptSources) {
    await loadClassicScript(buildAssetUrl(src));
}

function loadClassicScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.body.appendChild(script);
    });
}

function resolveAssetBasePath(value) {
    const normalizedValue = String(value || '').trim();

    if (!normalizedValue || normalizedValue === '/') {
        return '/';
    }

    const withLeadingSlash = normalizedValue.startsWith('/')
        ? normalizedValue
        : `/${normalizedValue}`;

    return withLeadingSlash.endsWith('/')
        ? withLeadingSlash
        : `${withLeadingSlash}/`;
}

function buildAssetUrl(relativePath) {
    const sanitizedPath = String(relativePath || '').replace(/^\/+/, '');
    return new URL(sanitizedPath, `${window.location.origin}${assetBasePath}`).toString();
}
