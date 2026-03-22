let refreshInterval = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('dashboardLoginBtn').addEventListener('click', loginDashboard);
    document.getElementById('dashboardLogoutBtn').addEventListener('click', logoutDashboard);
    initializeDashboard();
});

async function initializeDashboard() {
    const user = await checkAuth();
    currentUser = user;

    if (!user) {
        showLoginOverlay();
        return;
    }

    const result = await fetchDashboardData();

    if (result.ok) {
        showDashboard();
        startDashboard();
        return;
    }

    if (result.reason === 'forbidden') {
        showForbiddenOverlay(user.email || result.email || '');
        return;
    }

    showLoginOverlay();
}

function loginDashboard() {
    loginWithGoogle('/dashboard.html');
}

async function fetchDashboardData() {
    try {
        const API_URL = typeof window.API_URL === 'string' ? window.API_URL : 'http://localhost:8080';
        const res = await fetch(`${API_URL}/api/v1/system/dashboard`, {
            credentials: 'include'
        });

        if (res.status === 401) {
            stopDashboard();
            return { ok: false, reason: 'unauthenticated' };
        }

        if (res.status === 403) {
            const payload = await safeReadJson(res);
            stopDashboard();
            return {
                ok: false,
                reason: 'forbidden',
                email: payload?.email || currentUser?.email || '',
            };
        }

        if (!res.ok) throw new Error('Network error');

        const data = await res.json();
        updateStats(data);
        renderLogsTable('siteLogsTableBody', data.recentSiteLogs, 'Nenhum log do site encontrado.');
        renderLogsTable('gameLogsTableBody', data.recentGameLogs, 'Nenhum evento do jogo encontrado.');
        return { ok: true };
    } catch (e) {
        console.error('Failed to load dashboard:', e);
        setTableMessage('siteLogsTableBody', 'Erro ao carregar logs do site. Verifique a conexao com o backend.', '#4ade80');
        setTableMessage('gameLogsTableBody', 'Erro ao carregar logs do jogo. Verifique a conexao com o backend.', '#4ade80');
        return { ok: false, reason: 'error' };
    }
}

function startDashboard() {
    if (!refreshInterval) {
        refreshInterval = setInterval(async () => {
            const result = await fetchDashboardData();

            if (!result.ok) {
                if (result.reason === 'forbidden') {
                    showForbiddenOverlay(currentUser?.email || result.email || '');
                } else if (result.reason === 'unauthenticated') {
                    showLoginOverlay();
                }
            }
        }, 10000);
    }
}

function stopDashboard() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

function showDashboard() {
    hideAuthError();
    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('dashboardContainer').style.display = 'block';
}

function showLoginOverlay() {
    stopDashboard();
    currentUser = null;
    document.getElementById('authTitle').textContent = 'Painel Restrito';
    document.getElementById('authCopy').textContent = 'Entre com a conta Google autorizada para acessar o dashboard administrativo.';
    document.getElementById('dashboardLoginBtn').hidden = false;
    document.getElementById('dashboardLogoutBtn').hidden = true;
    document.getElementById('dashboardContainer').style.display = 'none';
    document.getElementById('authOverlay').style.display = 'flex';
    hideAuthError();
}

function showForbiddenOverlay(email) {
    stopDashboard();
    const labelEmail = email ? ` (${email})` : '';

    document.getElementById('authTitle').textContent = 'Acesso Negado';
    document.getElementById('authCopy').textContent = `A conta autenticada${labelEmail} nao esta na allowlist administrativa.`;
    document.getElementById('dashboardLoginBtn').hidden = true;
    document.getElementById('dashboardLogoutBtn').hidden = false;
    document.getElementById('dashboardContainer').style.display = 'none';
    document.getElementById('authOverlay').style.display = 'flex';
    showAuthError('Use a conta Google autorizada para entrar.');
}

async function logoutDashboard() {
    try {
        const API_URL = typeof window.API_URL === 'string' ? window.API_URL : 'http://localhost:8080';
        await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    } catch (err) {
        console.error('Dashboard logout error:', err);
    }

    window.location.replace('dashboard.html');
}

function showAuthError(message) {
    const errorNode = document.getElementById('authError');
    errorNode.textContent = message;
    errorNode.style.display = 'block';
}

function hideAuthError() {
    const errorNode = document.getElementById('authError');
    errorNode.textContent = '';
    errorNode.style.display = 'none';
}

async function safeReadJson(response) {
    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

function updateStats(data) {
    document.getElementById('uniqueIPS').textContent = data.uniqueVisitors || 0;

    let totalViews = 0;
    let totalConnects = 0;
    let totalGameEvents = 0;

    if (Array.isArray(data.siteMetrics)) {
        data.siteMetrics.forEach(metric => {
            if (metric.event === 'page_view') totalViews += metric.count;
            if (metric.event === 'connect') totalConnects += metric.count;
        });
    }

    if (Array.isArray(data.gameMetrics)) {
        data.gameMetrics.forEach(metric => {
            totalGameEvents += metric.count;
        });
    }

    document.getElementById('totalViews').textContent = totalViews;
    document.getElementById('totalConnects').textContent = totalConnects;
    document.getElementById('totalGameEvents').textContent = totalGameEvents;
}

function renderLogsTable(tbodyId, logs, emptyMessage) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.replaceChildren();

    if (!Array.isArray(logs) || logs.length === 0) {
        setTableMessage(tbodyId, emptyMessage);
        return;
    }

    logs.forEach(log => {
        const tr = document.createElement('tr');
        const userIdentity = formatUserIdentity(log);

        tr.appendChild(createCell(formatLogTimestamp(log.timestamp)));
        tr.appendChild(createCell(log.event || '-', { strong: true }));
        tr.appendChild(createCell(log.ip || '-'));
        tr.appendChild(createCell(userIdentity, { title: userIdentity === '-' ? '' : userIdentity }));
        tr.appendChild(createCell(log.details || '-', {
            title: log.details || '',
            styles: {
                fontSize: '0.82em',
                color: '#cbd5e1',
                maxWidth: '220px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }
        }));
        tr.appendChild(createCell(log.userAgent || '-', {
            title: log.userAgent || '',
            styles: {
                fontSize: '0.8em',
                color: '#888',
                maxWidth: '200px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }
        }));

        tbody.appendChild(tr);
    });
}

function formatLogTimestamp(value) {
    if (!value) {
        return '-';
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime())
            ? '-'
            : value.toLocaleString('pt-BR');
    }

    const rawValue = String(value).trim();

    if (!rawValue || rawValue === 'Invalid Date') {
        return '-';
    }

    const normalizedBaseValue = rawValue
        .replace(' ', 'T')
        .replace(/\.(\d{3})\d+(?=(?:Z|[+-]\d{2}:?\d{2}|[+-]\d{2}|$))/i, '.$1')
        .replace(/([+-]\d{2})$/, '$1:00')
        .replace(/([+-]\d{2})(\d{2})$/, '$1:$2');

    const candidates = [rawValue, normalizedBaseValue];

    if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(normalizedBaseValue)) {
        candidates.push(`${normalizedBaseValue}Z`);
    }

    for (const candidate of candidates) {
        const parsedDate = new Date(candidate);

        if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toLocaleString('pt-BR');
        }
    }

    return rawValue;
}

function formatUserIdentity(log) {
    const userName = normalizeDisplayText(log?.userName);
    const userId = normalizeDisplayText(log?.userId);

    if (userName && userId) {
        return `${userName} (${userId})`;
    }

    return userName || userId || '-';
}

function normalizeDisplayText(value) {
    if (value == null) {
        return '';
    }

    const text = String(value).trim();
    return text && text !== '-'
        ? text
        : '';
}

function createCell(value, { strong = false, title = '', styles = null } = {}) {
    const td = document.createElement('td');
    const text = value == null || value === '' ? '-' : String(value);

    if (strong) {
        const strongEl = document.createElement('strong');
        strongEl.textContent = text;
        td.appendChild(strongEl);
    } else {
        td.textContent = text;
    }

    if (title) {
        td.title = title;
    }

    if (styles) {
        Object.assign(td.style, styles);
    }

    return td;
}

function setTableMessage(tbodyId, message, color = '') {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const tr = document.createElement('tr');
    const td = document.createElement('td');

    td.colSpan = 6;
    td.textContent = message;
    td.style.textAlign = 'center';

    if (color) {
        td.style.color = color;
    }

    tr.appendChild(td);
    tbody.replaceChildren(tr);
}
