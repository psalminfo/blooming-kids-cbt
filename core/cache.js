// ============================================================
// core/cache.js  —  in-memory + localStorage cache + tab DOM cache
// ============================================================

const CACHE_PREFIX = 'management_cache_';

export const sessionCache = {
    tutors: null, students: null, pendingStudents: null, reports: null,
    breakStudents: null, parentFeedback: null, referralDataMap: null,
    enrollments: null, tutorAssignments: null, inactiveTutors: null,
    archivedStudents: null
};

export function saveToLocalStorage(key, data) {
    sessionCache[key] = data;
    if (key === 'reports' || key === 's' || key === 'tutorAssignments') return;
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data)); }
    catch (e) { console.error('localStorage save failed:', e); }
}

export function loadFromLocalStorage() {
    for (const key in sessionCache) {
        try {
            const stored = localStorage.getItem(CACHE_PREFIX + key);
            if (stored) sessionCache[key] = JSON.parse(stored);
        } catch (e) {
            localStorage.removeItem(CACHE_PREFIX + key);
        }
    }
}

export function invalidateCache(key) {
    sessionCache[key] = null;
    localStorage.removeItem(CACHE_PREFIX + key);
}

loadFromLocalStorage();

// ── Tab DOM cache ─────────────────────────────────────────────
const _tabDomCache = {};
let _currentNavId = null;
const _tabCacheExclude = new Set(['navParentFeedback', 'navMessaging']);

export function switchToTabCached(navId, renderFn) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    if (_currentNavId && !_tabCacheExclude.has(_currentNavId)) {
        const frag = document.createDocumentFragment();
        while (mainContent.firstChild) frag.appendChild(mainContent.firstChild);
        _tabDomCache[_currentNavId] = frag;
    }
    mainContent.innerHTML = '';
    if (_tabDomCache[navId] && !_tabCacheExclude.has(navId)) {
        mainContent.appendChild(_tabDomCache[navId]);
    } else {
        renderFn(mainContent);
    }
    _currentNavId = navId;
}

export function invalidateTabCache(navId) {
    delete _tabDomCache[navId];
}
window.invalidateTabCache = invalidateTabCache;
