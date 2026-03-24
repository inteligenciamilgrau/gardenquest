// IMG Platform - Shared Configuration
window.API_URL = typeof window.API_URL === 'string' 
    ? window.API_URL 
    : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:8080'
        : ''; // Fallback to relative path for production if hosted on same domain

console.info(`[Platform-Config] API URL resolved to: ${window.API_URL || '(relative)'}`);
