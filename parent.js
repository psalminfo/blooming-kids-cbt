// ============================================================================
// FIREBASE — initialized by shared firebaseConfig.js (compat bridge)
// db and auth are set on window by the compat bridge in firebaseConfig.js.
// We read them here so existing code continues to work unchanged.
// ============================================================================

const db   = window.db;
const auth = window.auth;

// ============================================================================
// SECTION 1: CORE UTILITIES & SECURITY (OPTIMIZED)
// ============================================================================

// XSS Protection
function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#039;', '`': '&#x60;', '/': '&#x2F;', '=': '&#x3D;'
    };
    return text.replace(/[&<>"'`/=]/g, m => map[m]);
}

// Sanitize input
function sanitizeInput(input) {
    if (typeof input === 'string') {
        return escapeHtml(input.trim());
    }
    return input;
}

// Safe text (escape HTML for display in innerHTML contexts)
function safeText(text) {
    if (typeof text !== 'string') return text;
    return escapeHtml(text.trim());
}

// Safe plaintext (no HTML escaping, for textContent only)
function safePlainText(text) {
    if (typeof text !== 'string') return text;
    return text.trim();
}

// URL sanitizer — only allow http, https protocols
function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            return trimmed;
        }
    } catch (e) {
        // Invalid URL
    }
    return '';
}

// Capitalize names (Unicode-safe)
function capitalize(str) {
    if (!str || typeof str !== 'string') return "";
    const cleaned = safePlainText(str);
    return cleaned.replace(/\b\p{L}/gu, l => l.toLocaleUpperCase());
}

// ========== UNIVERSAL PHONE MATCHING (FIXED - SUFFIX BASED) ==========
function comparePhonesByDigits(phone1, phone2) {
    if (!phone1 || !phone2) return false;
    
    try {
        // Convert to strings and extract only digits
        const digits1 = phone1.toString().replace(/\D/g, '');
        const digits2 = phone2.toString().replace(/\D/g, '');
        
        if (!digits1 || !digits2) return false;
        
        // SUFFIX MATCHING: Compare only last 10 digits
        const suffix1 = digits1.slice(-10);
        const suffix2 = digits2.slice(-10);
        
        // Also check full match for completeness
        return suffix1 === suffix2 || digits1 === digits2;
    } catch (error) {
        console.warn("Phone comparison error:", error);
        return false;
    }
}

// Extract suffix (last 10 digits) for searching
function extractPhoneSuffix(phone) {
    if (!phone) return '';
    const digits = phone.toString().replace(/\D/g, '');
    return digits.slice(-10); // Last 10 digits only
}

// Extract all digits
function extractPhoneDigits(phone) {
    if (!phone) return '';
    return phone.toString().replace(/\D/g, '');
}

// ============================================================================
// SECTION 2: GLOBAL STATE MANAGEMENT
// ============================================================================

let currentUserData = null;
let userChildren = [];
let studentIdMap = new Map();
let allStudentData = [];
let realTimeListeners = [];
let charts = new Map();
let pendingRequests = new Set();

// Initialize intervals array globally
if (!window.realTimeIntervals) {
    window.realTimeIntervals = [];
}

// ============================================================================
// DATA CACHE (Persistent across sessions via localStorage)
// ============================================================================

class DataCache {
    constructor(ttlMs = 5 * 60 * 1000) { // in-memory TTL kept for legacy callers
        this._store = new Map();
        this._ttl = ttlMs;
    }
    get(key) {
        const entry = this._store.get(key);
        if (!entry) return null;
        if (Date.now() - entry.time > this._ttl) { this._store.delete(key); return null; }
        return entry.data;
    }
    set(key, data) { this._store.set(key, { data, time: Date.now() }); }
    invalidate(key) { if (key) { this._store.delete(key); } else { this._store.clear(); } }
}

const dataCache = new DataCache();

// Persistent cache — survives page refresh and re-login
// Stores report data per user UID in localStorage with a 24h TTL
const persistentCache = {
    _TTL: 24 * 60 * 60 * 1000, // 24 hours
    _MAX_BYTES: 3 * 1024 * 1024, // 3 MB guard per entry

    _key(userId) { return `bkh_reports_${userId}`; },

    get(userId) {
        try {
            const raw = localStorage.getItem(this._key(userId));
            if (!raw) return null;
            const entry = JSON.parse(raw);
            if (Date.now() - entry.savedAt > this._TTL) {
                localStorage.removeItem(this._key(userId));
                return null;
            }
            return entry;
        } catch (e) { return null; }
    },

    set(userId, userData, assessmentResults, monthlyResults) {
        try {
            const entry = {
                savedAt: Date.now(),
                userData,
                assessmentResults,
                monthlyResults
            };
            const serialized = JSON.stringify(entry);
            // Guard against storing oversized data
            if (serialized.length > this._MAX_BYTES) return;
            localStorage.setItem(this._key(userId), serialized);
        } catch (e) { /* localStorage full or unavailable — silent fallback */ }
    },

    invalidate(userId) {
        try {
            if (userId) {
                localStorage.removeItem(this._key(userId));
            } else {
                Object.keys(localStorage)
                    .filter(k => k.startsWith('bkh_reports_'))
                    .forEach(k => localStorage.removeItem(k));
            }
        } catch (e) {}
    },

    // ── Generic tab cache (academics, rewards, settings) ─────────────────────
    _tabKey(userId, tab) { return `bkh_tab_${tab}_${userId}`; },

    getTab(userId, tab, ttlMs) {
        try {
            const raw = localStorage.getItem(this._tabKey(userId, tab));
            if (!raw) return null;
            const entry = JSON.parse(raw);
            const age = ttlMs || (30 * 60 * 1000); // default 30 min
            if (Date.now() - entry.savedAt > age) {
                localStorage.removeItem(this._tabKey(userId, tab));
                return null;
            }
            return entry;
        } catch (e) { return null; }
    },

    setTab(userId, tab, data) {
        try {
            const serialized = JSON.stringify({ savedAt: Date.now(), ...data });
            if (serialized.length > this._MAX_BYTES) return;
            localStorage.setItem(this._tabKey(userId, tab), serialized);
        } catch (e) {}
    },

    invalidateTab(userId, tab) {
        try {
            if (tab) {
                localStorage.removeItem(this._tabKey(userId, tab));
            } else {
                // Invalidate all tabs for this user
                ['academics', 'rewards', 'settings'].forEach(t =>
                    localStorage.removeItem(this._tabKey(userId, t))
                );
            }
        } catch (e) {}
    }
};

// ============================================================================
// FEEDBACK MODAL FUNCTIONS — redirected to FAB modal
// ============================================================================

function showFeedbackModal() { openFabTab('feedback'); }

function hideFeedbackModal() {
    const modal = document.getElementById('fabModal');
    if (modal) modal.classList.add('hidden');
    // Also hide legacy modal if present
    const legacyModal = document.getElementById('feedbackModal');
    if (legacyModal) legacyModal.classList.add('hidden');
}

function showResponsesModal() { openFabTab('messages'); }

function hideResponsesModal() {
    const modal = document.getElementById('fabModal');
    if (modal) modal.classList.add('hidden');
    const legacyModal = document.getElementById('responsesModal');
    if (legacyModal) legacyModal.classList.add('hidden');
}

async function submitFeedback() {
    const category = document.getElementById('feedbackCategory')?.value;
    const priority = document.getElementById('feedbackPriority')?.value;
    const student = document.getElementById('feedbackStudent')?.value;
    const message = document.getElementById('feedbackMessage')?.value?.trim();

    if (!category || !priority || !student || !message) {
        showMessage('Please fill in all required fields.', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitFeedbackBtn');
    const submitText = document.getElementById('submitFeedbackText');
    const submitSpinner = document.getElementById('submitFeedbackSpinner');

    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.textContent = 'Submitting...';
    if (submitSpinner) submitSpinner.classList.remove('hidden');

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated');

        await db.collection('parent_feedback').add({
            parentUid: user.uid,
            parentEmail: (user.email || '').toLowerCase(),
            parentName: currentUserData?.parentName || 'Parent',
            category: sanitizeInput(category),
            priority: sanitizeInput(priority),
            studentName: sanitizeInput(student),
            message: sanitizeInput(message),
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showMessage('Feedback submitted successfully!', 'success');
        hideFeedbackModal();
    } catch (error) {
        console.error('Feedback submission error:', error);
        showMessage('Failed to submit feedback. Please try again.', 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.textContent = 'Submit Feedback';
        if (submitSpinner) submitSpinner.classList.add('hidden');
    }
}

async function loadAdminResponses() {
    const responsesContent = document.getElementById('responsesContent');
    if (!responsesContent) return;

    responsesContent.innerHTML = '<div class="text-center py-4"><div class="loading-spinner mx-auto"></div></div>';

    try {
        const user = auth.currentUser;
        if (!user) return;

        const snapshot = await db.collection('parent_feedback')
            .where('parentUid', '==', user.uid)
            .get();

        if (snapshot.empty) {
            responsesContent.innerHTML = '<p class="text-gray-500 text-center py-8">No feedback submissions yet.</p>';
            return;
        }

        let html = '';
        const feedbacks = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
                const aTime = a.createdAt?.toDate?.() || new Date(0);
                const bTime = b.createdAt?.toDate?.() || new Date(0);
                return bTime - aTime;
            });

        feedbacks.forEach(fb => {
            const statusColor = fb.status === 'resolved' ? 'bg-green-100 text-green-800' :
                               fb.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                               'bg-yellow-100 text-yellow-800';
            const date = fb.createdAt?.toDate?.()?.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) || 'N/A';

            html += `
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <span class="font-semibold text-gray-800">${safeText(fb.category)}</span>
                            <span class="text-gray-500 text-sm ml-2">— ${safeText(fb.studentName)}</span>
                        </div>
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}">${safeText(fb.status || 'pending')}</span>
                    </div>
                    <p class="text-gray-600 text-sm mb-2">${safeText(fb.message)}</p>
                    <p class="text-gray-400 text-xs">${safeText(date)}</p>
                    ${fb.adminResponse ? `
                        <div class="response-bubble mt-3">
                            <div class="response-header">Admin Response:</div>
                            <p class="text-gray-700 text-sm">${safeText(fb.adminResponse)}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        responsesContent.innerHTML = html;

    } catch (error) {
        console.error('Error loading responses:', error);
        responsesContent.innerHTML = '<p class="text-red-500 text-center py-4">Error loading responses.</p>';
    }
}

// ============================================================================
// SECTION 3: UI MESSAGE SYSTEM
// ============================================================================

function showMessage(message, type = 'info') {
    // Remove any existing message
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm fade-in slide-down ${
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'success' ? 'bg-green-500 text-white' : 
        'bg-blue-500 text-white'
    }`;
    messageDiv.textContent = `BKH says: ${safeText(message)}`;
    
    document.body.appendChild(messageDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

// Show skeleton loader
function showSkeletonLoader(elementId, type = 'default') {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let skeletonHtml = '';
    
    switch(type) {
        case 'dashboard':
            skeletonHtml = `
                <div class="space-y-6">
                    <div class="skeleton skeleton-title"></div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="skeleton skeleton-card"></div>
                        <div class="skeleton skeleton-card"></div>
                        <div class="skeleton skeleton-card"></div>
                    </div>
                    <div class="skeleton skeleton-card h-64"></div>
                </div>
            `;
            break;
        case 'reports':
            skeletonHtml = `
                <div class="space-y-4">
                    <div class="skeleton skeleton-title w-1/2"></div>
                    ${Array.from({length: 3}, (_, i) => `
                        <div class="border rounded-lg p-4">
                            <div class="skeleton skeleton-text w-3/4"></div>
                            <div class="skeleton skeleton-text w-1/2 mt-2"></div>
                            <div class="skeleton skeleton-text w-full mt-4 h-20"></div>
                        </div>
                    `).join('')}
                </div>
            `;
            break;
        default:
            skeletonHtml = `
                <div class="text-center py-8">
                    <div class="loading-spinner mx-auto"></div>
                    <p class="text-green-600 font-semibold mt-4">Loading...</p>
                </div>
            `;
    }
    
    element.innerHTML = skeletonHtml;
}

// ============================================================================
// SECTION 4: DATE & TIME UTILITIES
// ============================================================================

function formatDetailedDate(date, showTimezone = false) {
    let dateObj;
    
    if (date?.toDate) {
        dateObj = date.toDate();
    } else if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'string') {
        dateObj = new Date(date);
    } else if (typeof date === 'number') {
        if (date < 10000000000) {
            dateObj = new Date(date * 1000);
        } else {
            dateObj = new Date(date);
        }
    } else {
        return 'Unknown date';
    }
    
    if (isNaN(dateObj.getTime())) {
        return 'Invalid date';
    }
    
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    if (showTimezone) {
        options.timeZoneName = 'short';
    }
    
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    let formatted = dateObj.toLocaleDateString('en-US', options);
    
    if (showTimezone) {
        formatted += ` (${timezone})`;
    }
    
    return formatted;
}

function getYearMonthFromDate(date) {
    let dateObj;
    
    if (date?.toDate) {
        dateObj = date.toDate();
    } else if (date instanceof Date) {
        dateObj = date;
    } else if (typeof date === 'string') {
        dateObj = new Date(date);
    } else if (typeof date === 'number') {
        if (date < 10000000000) {
            dateObj = new Date(date * 1000);
        } else {
            dateObj = new Date(date);
        }
    } else {
        return { year: 0, month: 0 };
    }
    
    if (isNaN(dateObj.getTime())) {
        return { year: 0, month: 0 };
    }
    
    return {
        year: dateObj.getFullYear(),
        month: dateObj.getMonth()
    };
}

function getTimestamp(dateInput) {
    if (!dateInput) return 0;
    
    if (dateInput?.toDate) {
        return dateInput.toDate().getTime();
    } else if (dateInput instanceof Date) {
        return dateInput.getTime();
    } else if (typeof dateInput === 'string') {
        return new Date(dateInput).getTime();
    } else if (typeof dateInput === 'number') {
        if (dateInput < 10000000000) {
            return dateInput * 1000;
        }
        return dateInput;
    }
    
    return 0;
}

function getTimestampFromData(data) {
    if (!data) return 0;
    
    const timestampFields = [
        'timestamp',
        'createdAt',
        'submittedAt',
        'date',
        'updatedAt',
        'assignedDate',
        'dueDate'
    ];
    
    for (const field of timestampFields) {
        if (data[field]) {
            const timestamp = getTimestamp(data[field]);
            if (timestamp > 0) {
                return Math.floor(timestamp / 1000);
            }
        }
    }
    
    return Math.floor(Date.now() / 1000);
}

// ============================================================================
// SECTION 5: MONTH DISPLAY LOGIC
// ============================================================================

function getMonthDisplayLogic() {
    const today = new Date();
    const currentDay = today.getDate();
    
    if (currentDay === 1 || currentDay === 2) {
        return {
            showCurrentMonth: true,
            showPreviousMonth: true
        };
    } else {
        return {
            showCurrentMonth: true,
            showPreviousMonth: false
        };
    }
}

function getCurrentMonthYear() {
    const now = new Date();
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return {
        month: now.getMonth(),
        year: now.getFullYear(),
        monthName: monthNames[now.getMonth()]
    };
}

function getPreviousMonthYear() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    return {
        month: lastMonth.getMonth(),
        year: lastMonth.getFullYear(),
        monthName: monthNames[lastMonth.getMonth()]
    };
}

// ============================================================================
// SECTION 6: APP CONFIGURATION & INITIALIZATION
// ============================================================================

// Inject optimized CSS with skeleton loaders
function injectCustomCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Skeleton Loaders */
        .skeleton {
            background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
            border-radius: 4px;
        }
        
        @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        
        .skeleton-text {
            height: 1em;
            margin-bottom: 0.5em;
        }
        
        .skeleton-title {
            height: 1.8em;
            margin-bottom: 1em;
            width: 70%;
        }
        
        .skeleton-card {
            height: 150px;
            border-radius: 8px;
            margin-bottom: 1rem;
        }
        
        /* Smooth transitions */
        .accordion-content {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
        }
        
        .accordion-content.hidden {
            max-height: 0 !important;
            opacity: 0;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            margin-top: 0 !important;
            margin-bottom: 0 !important;
        }
        
        .accordion-content:not(.hidden) {
            max-height: 5000px;
            opacity: 1;
        }
        
        .fade-in {
            animation: fadeIn 0.3s ease-in-out;
        }
        
        .slide-down {
            animation: slideDown 0.3s ease-out;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideDown {
            from {
                transform: translateY(-10px);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        
        /* Loading animations */
        .loading-spinner {
            border: 3px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top: 3px solid #10B981;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
        }
        
        .loading-spinner-small {
            border: 2px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top: 2px solid #10B981;
            width: 16px;
            height: 16px;
            animation: spin 1s linear infinite;
            display: inline-block;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Button glow effect */
        .btn-glow:hover {
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);
        }
        
        /* Notification badge animations */
        .notification-pulse {
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        /* Accordion styles */
        .accordion-header {
            transition: all 0.2s ease;
        }
        
        .accordion-header:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        /* Hide white spaces */
        .accordion-content.hidden {
            display: none !important;
        }
        
        /* Tab transitions */
        .tab-transition {
            transition: all 0.3s ease;
        }
        
        /* Chart containers */
        .chart-container {
            position: relative;
            height: 300px;
            width: 100%;
        }
        
        /* Progress report specific accordion styles */
        .progress-accordion-content {
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            overflow: hidden;
        }
        
        .progress-accordion-content.hidden {
            max-height: 0 !important;
            opacity: 0;
            transform: translateY(-10px);
        }
        
        .progress-accordion-content:not(.hidden) {
            max-height: 5000px;
            opacity: 1;
            transform: translateY(0);
        }
        
        /* Performance indicator colors */
        .performance-excellent {
            color: #10B981;
            background-color: #D1FAE5;
        }
        
        .performance-good {
            color: #F59E0B;
            background-color: #FEF3C7;
        }
        
        .performance-needs-improvement {
            color: #EF4444;
            background-color: #FEE2E2;
        }
        
        /* Mobile optimizations */
        @media (max-width: 768px) {
            .mobile-stack {
                flex-direction: column !important;
            }
            
            .mobile-full-width {
                width: 100% !important;
            }
            
            .mobile-padding {
                padding: 1rem !important;
            }
        }
    `;
    document.head.appendChild(style);
}

// Phone normalization (optimized)
function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
        return { normalized: null, valid: false, error: 'Invalid input' };
    }

    try {
        // Clean the phone number - remove all non-digit characters except +
        let cleaned = phone.replace(/[^\d+]/g, '');
        
        // If empty after cleaning, return error
        if (!cleaned) {
            return { normalized: null, valid: false, error: 'Empty phone number' };
        }
        
        // Check if it already has a country code
        if (cleaned.startsWith('+')) {
            // Already has country code
            cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
            
            return {
                normalized: cleaned,
                valid: true,
                error: null
            };
        } else {
            // No country code, add +1 as default
            cleaned = cleaned.replace(/^0+/, '');
            
            // Add default country code
            cleaned = '+1' + cleaned;
            
            return {
                normalized: cleaned,
                valid: true,
                error: null
            };
        }
        
    } catch (error) {
        console.error("❌ Phone normalization error:", error);
        return { 
            normalized: null, 
            valid: false, 
            error: safeText(error.message)
        };
    }
}

// Create country code dropdown
function createCountryCodeDropdown() {
    const phoneInputContainer = document.getElementById('signupPhone')?.parentNode;
    if (!phoneInputContainer) return;
    
    // Create container for country code and phone number
    const container = document.createElement('div');
    container.className = 'flex gap-2 mobile-stack';
    
    // Create country code dropdown
    const countryCodeSelect = document.createElement('select');
    countryCodeSelect.id = 'countryCode';
    countryCodeSelect.className = 'w-32 px-3 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200 mobile-full-width';
    countryCodeSelect.required = true;
    
    // FULL COUNTRY CODES LIST
    const countries = [
        { code: '+1', name: 'USA/Canada (+1)' },
        { code: '+234', name: 'Nigeria (+234)' },
        { code: '+44', name: 'UK (+44)' },
        { code: '+233', name: 'Ghana (+233)' },
        { code: '+254', name: 'Kenya (+254)' },
        { code: '+27', name: 'South Africa (+27)' },
        { code: '+91', name: 'India (+91)' },
        { code: '+971', name: 'UAE (+971)' },
        { code: '+966', name: 'Saudi Arabia (+966)' },
        { code: '+20', name: 'Egypt (+20)' },
        { code: '+237', name: 'Cameroon (+237)' },
        { code: '+256', name: 'Uganda (+256)' },
        { code: '+255', name: 'Tanzania (+255)' },
        { code: '+250', name: 'Rwanda (+250)' },
        { code: '+251', name: 'Ethiopia (+251)' },
        { code: '+41', name: 'Switzerland (+41)' },
        { code: '+86', name: 'China (+86)' },
        { code: '+33', name: 'France (+33)' },
        { code: '+49', name: 'Germany (+49)' },
        { code: '+61', name: 'Australia (+61)' },
        { code: '+55', name: 'Brazil (+55)' },
        { code: '+351', name: 'Portugal (+351)' },
        { code: '+34', name: 'Spain (+34)' },
        { code: '+39', name: 'Italy (+39)' },
        { code: '+31', name: 'Netherlands (+31)' },
        { code: '+32', name: 'Belgium (+32)' },
        { code: '+46', name: 'Sweden (+46)' },
        { code: '+47', name: 'Norway (+47)' },
        { code: '+45', name: 'Denmark (+45)' },
        { code: '+358', name: 'Finland (+358)' },
        { code: '+353', name: 'Ireland (+353)' },
        { code: '+48', name: 'Poland (+48)' },
        { code: '+90', name: 'Turkey (+90)' },
        { code: '+961', name: 'Lebanon (+961)' },
        { code: '+962', name: 'Jordan (+962)' },
        { code: '+81', name: 'Japan (+81)' },
        { code: '+82', name: 'South Korea (+82)' },
        { code: '+60', name: 'Malaysia (+60)' },
        { code: '+852', name: 'Hong Kong (+852)' },
        { code: '+52', name: 'Mexico (+52)' },
        { code: '+63', name: 'Philippines (+63)' },
        { code: '+65', name: 'Singapore (+65)' },
        { code: '+64', name: 'New Zealand (+64)' },
        { code: '+7', name: 'Russia/Kazakhstan (+7)' },
        { code: '+380', name: 'Ukraine (+380)' },
        { code: '+30', name: 'Greece (+30)' },
        { code: '+43', name: 'Austria (+43)' },
        { code: '+420', name: 'Czech Republic (+420)' },
        { code: '+36', name: 'Hungary (+36)' },
        { code: '+40', name: 'Romania (+40)' }
    ];
    
    // Add options to dropdown
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = safeText(country.name);
        countryCodeSelect.appendChild(option);
    });
    
    // Set USA/Canada as default
    countryCodeSelect.value = '+1';
    
    // Get the existing phone input
    const phoneInput = document.getElementById('signupPhone');
    if (phoneInput) {
        phoneInput.placeholder = 'Enter phone number without country code';
        phoneInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200 mobile-full-width';
        
        // Replace the original input with new structure
        container.appendChild(countryCodeSelect);
        container.appendChild(phoneInput);
        phoneInputContainer.appendChild(container);
    }
}

// ============================================================================
// SECTION 7: AUTHENTICATION FUNCTIONS
// ============================================================================

async function handleSignInFull(identifier, password, signInBtn, authLoader) {
    const requestId = `signin_${Date.now()}`;
    pendingRequests.add(requestId);
    
    try {
        await auth.signInWithEmailAndPassword(identifier, password);
        // Auth listener will handle the rest
    } catch (error) {
        if (!pendingRequests.has(requestId)) return;
        
        let errorMessage = "Invalid credentials. Please check your email and password.";
        
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = "Invalid email or password. Please try again.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Invalid email address format.";
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = "Too many failed attempts. Please try again later.";
        }
        
        showMessage(errorMessage, 'error');
        
        if (signInBtn) signInBtn.disabled = false;
        
        const signInText = document.getElementById('signInText');
        const signInSpinner = document.getElementById('signInSpinner');
        
        if (signInText) signInText.textContent = 'Sign In';
        if (signInSpinner) signInSpinner.classList.add('hidden');
        if (authLoader) authLoader.classList.add('hidden');
    } finally {
        pendingRequests.delete(requestId);
    }
}

async function handleSignUpFull(countryCode, localPhone, email, password, confirmPassword, signUpBtn, authLoader) {
    const requestId = `signup_${Date.now()}`;
    pendingRequests.add(requestId);

    // Issue 2: Ensure email is always stored lowercase
    email = email.toLowerCase().trim();
    
    try {
        let fullPhoneInput = localPhone;
        if (!localPhone.startsWith('+')) {
            fullPhoneInput = countryCode + localPhone;
        }
        
        const normalizedResult = normalizePhoneNumber(fullPhoneInput);
        
        if (!normalizedResult.valid) {
            throw new Error(`Invalid phone number: ${normalizedResult.error}`);
        }
        
        const finalPhone = normalizedResult.normalized;

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const referralCode = await generateReferralCode();

        await db.collection('parent_users').doc(user.uid).set({
            email: email,
            phone: finalPhone,
            normalizedPhone: finalPhone,
            parentName: 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0,
            uid: user.uid
        });


        // Back-fill parent email onto any existing student records matching this phone.
        // Fire-and-forget — won't block login if it fails.
        attachEmailToMatchingStudentRecords(finalPhone, email).catch(err =>
            console.warn('Non-critical: email back-fill on signup failed:', err.message)
        );

        showMessage('Account created successfully!', 'success');
        
    } catch (error) {
        if (!pendingRequests.has(requestId)) return;
        
        let errorMessage = "Failed to create account.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = "This email is already registered. Please sign in instead.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "Password should be at least 6 characters.";
        } else if (error.message) {
            errorMessage = error.message;
        }

        showMessage(errorMessage, 'error');

        if (signUpBtn) signUpBtn.disabled = false;
        
        const signUpText = document.getElementById('signUpText');
        const signUpSpinner = document.getElementById('signUpSpinner');
        
        if (signUpText) signUpText.textContent = 'Create Account';
        if (signUpSpinner) signUpSpinner.classList.add('hidden');
        if (authLoader) authLoader.classList.add('hidden');
    } finally {
        pendingRequests.delete(requestId);
    }
}

async function handlePasswordResetFull(email, sendResetBtn, resetLoader) {
    const requestId = `reset_${Date.now()}`;
    pendingRequests.add(requestId);
    
    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset link sent to your email!', 'success');
        hidePasswordResetModal();
    } catch (error) {
        if (!pendingRequests.has(requestId)) return;
        
        let errorMessage = "Failed to send reset email.";
        if (error.code === 'auth/user-not-found') {
            // Don't reveal whether email exists — show success anyway
            showMessage('If an account with this email exists, a reset link has been sent.', 'success');
            hidePasswordResetModal();
            return;
        }
        showMessage(errorMessage, 'error');
    } finally {
        pendingRequests.delete(requestId);
        if (sendResetBtn) sendResetBtn.disabled = false;
        if (resetLoader) resetLoader.classList.add('hidden');
    }
}

// ============================================================================
// ATTACH PARENT EMAIL TO MATCHING STUDENT RECORDS (phone-suffix based)
// Safe to call multiple times — skips docs that already have the correct email.
// ============================================================================
async function attachEmailToMatchingStudentRecords(parentPhone, parentEmail) {
    if (!parentPhone || !parentEmail) return 0;

    // Issue 2: Normalise email to lowercase before any matching or writing
    parentEmail = parentEmail.toLowerCase().trim();

    const normalizedPhone = parentPhone; // already normalized before being passed in
    const phoneSuffix     = extractPhoneSuffix(parentPhone); // last 10 digits
    if (!phoneSuffix) return 0;

    // Every plausible format a tutor might have stored for this number:
    //   +2348012345678  (international with +)
    //   2348012345678   (international without +)
    //   8012345678      (last 10 digits / suffix)
    //   +8012345678     (+ on suffix)
    //   08012345678     (Nigerian local: 0 + last 10)
    const noPlus = normalizedPhone.replace(/^\+/, '');
    const phoneVariants = [...new Set([
        normalizedPhone,
        noPlus,
        phoneSuffix,
        '+' + phoneSuffix,
        '0' + phoneSuffix
    ])].filter(Boolean);

    const phoneFields = [
        'parentPhone', 'parent_phone', 'guardianPhone',
        'motherPhone',  'fatherPhone',  'phone',
        'contactPhone', 'normalizedParentPhone'
    ];

    const collections = ['student_results', 'tutor_submissions', 'students', 'pending_students'];
    let updateCount = 0;

    for (const colName of collections) {
        // Run one targeted query per (field x variant) pair — all in parallel.
        // Only matching docs are returned — zero collection scanning.
        const queries = [];
        for (const field of phoneFields) {
            for (const variant of phoneVariants) {
                queries.push(
                    db.collection(colName)
                        .where(field, '==', variant)
                        .get()
                        .catch(() => null) // field may not be indexed — skip silently
                );
            }
        }

        const snapshots = await Promise.all(queries);

        // Deduplicate by doc id, then batch-write only docs missing the email.
        const batch = db.batch();
        let batchCount = 0;
        const seen = new Set();

        for (const snap of snapshots) {
            if (!snap) continue;
            snap.forEach(doc => {
                if (seen.has(doc.id)) return;
                seen.add(doc.id);
                if (doc.data().parentEmail !== parentEmail) {
                    batch.update(doc.ref, { parentEmail: parentEmail });
                    batchCount++;
                }
            });
        }

        if (batchCount > 0) {
            await batch.commit();
            updateCount += batchCount;
        }
    }

    if (updateCount > 0) {
    } else {
    }
    return updateCount;
}

// ============================================================================
// SECTION 8: REFERRAL SYSTEM
// ============================================================================

async function generateReferralCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const prefix = 'BKH';
    let code;
    let isUnique = false;

    while (!isUnique) {
        let suffix = '';
        for (let i = 0; i < 6; i++) {
            suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        code = prefix + suffix;

        const snapshot = await db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
        if (snapshot.empty) {
            isUnique = true;
        }
    }
    return safeText(code);
}

async function loadReferralRewards(parentUid) {
    const rewardsContent = document.getElementById('rewardsContent');
    if (!rewardsContent) return;

    // ── STEP 1: Show cache instantly (4h TTL — referral data rarely changes) ──
    const cached = persistentCache.getTab(parentUid, 'rewards', 4 * 60 * 60 * 1000);
    if (cached) {
        rewardsContent.innerHTML = cached.html;
        // Silent background refresh
        setTimeout(() => _silentRefreshRewards(parentUid), 3000);
        return;
    }

    // ── STEP 2: No cache — full load ─────────────────────────────────────────
    showSkeletonLoader('rewardsContent', 'reports');

    try {
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) { rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">User data not found.</p>'; return; }

        const userData         = userDoc.data();
        const referralCode     = safeText(userData.referralCode || 'N/A');
        const totalEarnings    = userData.referralEarnings || 0;
        const transactionsSnap = await db.collection('referral_transactions').where('ownerUid', '==', parentUid).get();

        let referralsHtml = '';
        let pendingCount = 0, approvedCount = 0, paidCount = 0;

        if (transactionsSnap.empty) {
            referralsHtml = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No one has used your referral code yet.</td></tr>`;
        } else {
            const transactions = transactionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            transactions.sort((a, b) => (b.timestamp?.toDate?.() || new Date(0)) - (a.timestamp?.toDate?.() || new Date(0)));
            transactions.forEach(data => {
                const status      = safeText(data.status || 'pending');
                const statusColor = status === 'paid' ? 'bg-green-100 text-green-800' : status === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800';
                if (status === 'pending')  pendingCount++;
                if (status === 'approved') approvedCount++;
                if (status === 'paid')     paidCount++;
                const referredName  = capitalize(data.referredStudentName || data.referredStudentPhone);
                const rewardAmount  = data.rewardAmount ? `₦${data.rewardAmount.toLocaleString()}` : '₦5,000';
                const referralDate  = data.timestamp?.toDate?.().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) || 'N/A';
                referralsHtml += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">${referredName}</td>
                        <td class="px-4 py-3 text-sm text-gray-500">${safeText(referralDate)}</td>
                        <td class="px-4 py-3 text-sm"><span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}">${capitalize(status)}</span></td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-bold">${safeText(rewardAmount)}</td>
                    </tr>`;
            });
        }

        const html = `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md slide-down">
                <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">${referralCode}</p>
                <p class="text-blue-700 mt-2">Share this code with other parents. They use it when registering their child, and you earn **₦5,000** once their child completes their first month!</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-green-100 p-6 rounded-xl shadow-lg border-b-4 border-green-600 fade-in"><p class="text-sm font-medium text-green-700">Total Earnings</p><p class="text-3xl font-extrabold text-green-900 mt-1">₦${totalEarnings.toLocaleString()}</p></div>
                <div class="bg-yellow-100 p-6 rounded-xl shadow-lg border-b-4 border-yellow-600 fade-in"><p class="text-sm font-medium text-yellow-700">Approved Rewards (Awaiting Payment)</p><p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p></div>
                <div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600 fade-in"><p class="text-sm font-medium text-gray-700">Total Successful Referrals (Paid)</p><p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p></div>
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-4">Referral History</h3>
            <div class="overflow-x-auto bg-white rounded-lg shadow">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50"><tr>
                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referred Parent/Student</th>
                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Used</th>
                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                    </tr></thead>
                    <tbody class="divide-y divide-gray-200">${referralsHtml}</tbody>
                </table>
            </div>`;

        rewardsContent.innerHTML = html;
        persistentCache.setTab(parentUid, 'rewards', { html });

    } catch (error) {
        console.error('Error loading referral rewards:', error);
        rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">Error loading rewards.</p>';
    }
}

// Silent background refresh for rewards
async function _silentRefreshRewards(parentUid) {
    try {
        const user = auth.currentUser;
        if (!user || user.uid !== parentUid) return;
        const snap = await db.collection('referral_transactions').where('ownerUid', '==', parentUid).get();
        const cached = persistentCache.getTab(parentUid, 'rewards', 4 * 60 * 60 * 1000);
        // Simple check: if transaction count changed, invalidate and reload
        const cachedCount = (cached?.html?.match(/<tr class="hover:bg-gray-50">/g) || []).length;
        if (snap.size !== cachedCount) {
            persistentCache.invalidateTab(parentUid, 'rewards');
            loadReferralRewards(parentUid);
        }
    } catch (e) { /* silent */ }
}

// ============================================================================
// SECTION 9: COMPREHENSIVE CHILDREN FINDER (WITH SUFFIX MATCHING)
// ============================================================================

async function comprehensiveFindChildren(parentPhone, parentEmail = '') {

    const allChildren = new Map();
    const studentNameIdMap = new Map();
    
    const parentSuffix = extractPhoneSuffix(parentPhone);
    
    if (!parentSuffix) {
        console.warn("⚠️ No valid suffix in parent phone:", parentPhone);
        return {
            studentIds: [],
            studentNameIdMap: new Map(),
            allStudentData: [],
            studentNames: []
        };
    }

    try {
        // ── STEP 1: Fast email query — reads only this parent's students ────
        // Pass parentEmail as second arg when calling comprehensiveFindChildren.
        // Falls back to phone scan only when nothing is found (new parent / not yet backfilled).
        // parentEmail passed as second argument — used for fast targeted query

        if (parentEmail) {
            const [studentsSnap, pendingSnap] = await Promise.all([
                db.collection('students').where('parentEmail', '==', parentEmail).get().catch(() => null),
                db.collection('pending_students').where('parentEmail', '==', parentEmail).get().catch(() => null)
            ]);

            const processSnap = (snap, isPending) => {
                if (!snap) return;
                snap.forEach(doc => {
                    const data = doc.data();
                    const studentId = doc.id;
                    const studentName = safeText(data.studentName || data.name || 'Unknown');
                    if (studentName === 'Unknown' || allChildren.has(studentId)) return;
                    allChildren.set(studentId, { id: studentId, name: studentName, data, isPending, collection: isPending ? 'pending_students' : 'students' });
                    if (studentNameIdMap.has(studentName)) {
                        studentNameIdMap.set(studentName + ' (' + studentId.substring(0, 4) + ')', studentId);
                    } else {
                        studentNameIdMap.set(studentName, studentId);
                    }
                });
            };

            processSnap(studentsSnap, false);
            processSnap(pendingSnap, true);
        }

        // ── STEP 2: Phone scan fallback — only when email found nothing ─────
        // Picks up students added by a tutor before the parent registered
        // (their email won't be on those records yet).
        if (allChildren.size === 0) {

            const [studentsSnapshot, pendingSnapshot] = await Promise.all([
                db.collection('students').get().catch(() => ({ forEach: () => {} })),
                db.collection('pending_students').get().catch(() => ({ forEach: () => {} }))
            ]);

            const scanSnap = (snap, isPending) => {
                snap.forEach(doc => {
                    const data = doc.data();
                    const studentId = doc.id;
                    const studentName = safeText(data.studentName || data.name || 'Unknown');
                    if (studentName === 'Unknown' || allChildren.has(studentId)) return;

                    const fields = [
                        data.parentPhone, data.guardianPhone, data.motherPhone,
                        data.fatherPhone, data.contactPhone, data.phone,
                        data.parentPhone1, data.parentPhone2, data.emergencyPhone
                    ];
                    const matched = fields.some(f => f && extractPhoneSuffix(f) === parentSuffix);
                    if (!matched) return;

                    allChildren.set(studentId, { id: studentId, name: studentName, data, isPending, collection: isPending ? 'pending_students' : 'students' });
                    if (studentNameIdMap.has(studentName)) {
                        studentNameIdMap.set(studentName + ' (' + studentId.substring(0, 4) + ')', studentId);
                    } else {
                        studentNameIdMap.set(studentName, studentId);
                    }
                });
            };

            scanSnap(studentsSnapshot, false);
            scanSnap(pendingSnapshot, true);
        }

        const studentNames = Array.from(studentNameIdMap.keys());
        const studentIds = Array.from(allChildren.keys());
        const allStudentData = Array.from(allChildren.values());


        return {
            studentIds,
            studentNameIdMap,
            allStudentData,
            studentNames
        };

    } catch (error) {
        console.error("❌ Comprehensive suffix search error:", error);
        return {
            studentIds: [],
            studentNameIdMap: new Map(),
            allStudentData: [],
            studentNames: []
        };
    }
}

// ============================================================================
// SECTION 10: UNIVERSAL REPORT SEARCH WITH SUFFIX MATCHING
// ============================================================================

async function searchAllReportsForParent(parentPhone, parentEmail = '', parentUid = '') {

    let assessmentResults = [];
    let monthlyResults = [];

    try {
        // ── STEP 1: Fast email query (only matching docs read) ──────────────
        // This works for every parent whose email was attached at signup / backfill.
        if (parentEmail) {
            const [assessSnap, monthlySnap] = await Promise.all([
                db.collection('student_results')
                    .where('parentEmail', '==', parentEmail)
                    .get()
                    .catch(() => null),
                db.collection('tutor_submissions')
                    .where('parentEmail', '==', parentEmail)
                    .get()
                    .catch(() => null)
            ]);

            assessSnap && assessSnap.forEach(doc => {
                assessmentResults.push({
                    id: doc.id, collection: 'student_results',
                    matchType: 'email', ...doc.data(),
                    timestamp: getTimestampFromData(doc.data()), type: 'assessment'
                });
            });

            monthlySnap && monthlySnap.forEach(doc => {
                monthlyResults.push({
                    id: doc.id, collection: 'tutor_submissions',
                    matchType: 'email', ...doc.data(),
                    timestamp: getTimestampFromData(doc.data()), type: 'monthly'
                });
            });

        }

        // ── STEP 2: Phone fallback — only runs when email found nothing ─────
        // Catches any new records a tutor just added that haven't been backfilled yet.
        // Uses targeted where() queries — no collection scans.
        const needsPhoneFallback = assessmentResults.length === 0 && monthlyResults.length === 0;

        if (needsPhoneFallback && parentPhone) {
            const parentSuffix = extractPhoneSuffix(parentPhone);
            if (!parentSuffix) {
                console.warn('No valid phone suffix, skipping phone fallback');
                return { assessmentResults, monthlyResults };
            }


            const noPlus = parentPhone.replace(/^\+/, '');
            const phoneVariants = [...new Set([
                parentPhone, noPlus, parentSuffix,
                '+' + parentSuffix, '0' + parentSuffix
            ])].filter(Boolean);

            const phoneFields = [
                'parentPhone', 'parent_phone', 'guardianPhone',
                'motherPhone', 'fatherPhone', 'phone',
                'contactPhone', 'normalizedParentPhone'
            ];

            const colMap = [
                { col: 'student_results',  type: 'assessment', arr: assessmentResults },
                { col: 'tutor_submissions', type: 'monthly',    arr: monthlyResults   }
            ];

            for (const { col, type, arr } of colMap) {
                const queries = [];
                for (const field of phoneFields) {
                    for (const variant of phoneVariants) {
                        queries.push(
                            db.collection(col).where(field, '==', variant).get().catch(() => null)
                        );
                    }
                }
                const snaps = await Promise.all(queries);
                const seen = new Set(arr.map(r => r.id));
                snaps.forEach(snap => {
                    if (!snap) return;
                    snap.forEach(doc => {
                        if (seen.has(doc.id)) return;
                        seen.add(doc.id);
                        arr.push({
                            id: doc.id, collection: col,
                            matchType: 'phone-fallback', ...doc.data(),
                            timestamp: getTimestampFromData(doc.data()), type
                        });
                    });
                });
            }

            // Back-fill email onto any newly discovered records so next login is fast
            if (parentEmail && (assessmentResults.length > 0 || monthlyResults.length > 0)) {
                attachEmailToMatchingStudentRecords(parentPhone, parentEmail)
                    .catch(e => console.warn('Non-critical: post-login backfill failed:', e.message));
            }

        }

    } catch (error) {
        console.error('❌ searchAllReportsForParent error:', error);
    }

    return { assessmentResults, monthlyResults };
}

// ============================================================================
// SECTION 11: PROACTIVE ACADEMICS TAB (UPDATED WITH HOMEWORK STATUS)
// ============================================================================

// Make sure this function is available globally
window.toggleAcademicsAccordion = function(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const arrow = document.getElementById(`${sectionId}-arrow`);
    
    if (!content || !arrow) {
        console.error(`Could not find academics accordion elements for ${sectionId}`);
        return;
    }
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.textContent = '▲';
    } else {
        content.classList.add('hidden');
        arrow.textContent = '▼';
    }
};

window.onStudentSelected = function(studentName) {
    loadAcademicsData(studentName || null);
};

// Fixed force download function - validates URL, opens ONLY in new tab
window.forceDownload = function(url, filename) {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) {
        showMessage('Invalid file URL.', 'error');
        return;
    }
    // Open in new tab without affecting current tab
    const newWindow = window.open(safeUrl, '_blank', 'noopener,noreferrer');
    
    // Focus on the new window
    if (newWindow) {
        newWindow.focus();
    }
};

// Updated handleHomeworkAction function - REMOVED Work Here feature
window.handleHomeworkAction = function(homeworkId, studentId, currentStatus) {
    switch(currentStatus) {
        case 'graded':
            db.collection('homework_assignments').doc(homeworkId).get()
                .then(doc => {
                    const homework = doc.data();
                    if (homework) {
                        const grade = homework.grade || homework.score || 'N/A';
                        const feedback = homework.feedback || homework.tutorFeedback || 'No feedback provided.';
                        showGradeFeedbackModal(grade, feedback, homework);
                    }
                })
                .catch(error => {
                    console.error('Error fetching homework:', error);
                    showMessage('Error loading assignment details', 'error');
                });
            break;
            
        case 'submitted':
            db.collection('homework_assignments').doc(homeworkId).get()
                .then(doc => {
                    const homework = doc.data();
                    if (homework && homework.submissionUrl) {
                        window.open(homework.submissionUrl, '_blank');
                    } else {
                        alert('No submission file available.');
                    }
                });
            break;
            
        default:
            db.collection('homework_assignments').doc(homeworkId).get()
                .then(doc => {
                    const homeworkData = doc.data();
                    if (homeworkData.fileUrl) {
                        // Just download the file
                        forceDownload(homeworkData.fileUrl, homeworkData.title || 'assignment');
                    } else {
                        alert('Please contact your tutor for assignment details.');
                    }
                })
                .catch(error => {
                    console.error('Error fetching homework:', error);
                    showMessage('Error loading assignment', 'error');
                });
            break;
    }
};

// Show grade feedback modal
function showGradeFeedbackModal(grade, feedback, homeworkData) {
    const existingModal = document.getElementById('gradeFeedbackModal');
    if (existingModal) existingModal.remove();
    
    const modalHTML = `
        <div id="gradeFeedbackModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div class="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-t-xl">
                    <div class="flex justify-between items-center">
                        <h3 class="text-xl font-bold text-white">Assignment Graded</h3>
                        <button onclick="document.getElementById('gradeFeedbackModal').remove()" 
                                class="text-white hover:text-gray-200 text-2xl">&times;</button>
                    </div>
                </div>
                
                <div class="p-6">
                    <div class="text-center mb-6">
                        <div class="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                            <span class="text-3xl text-green-600">📊</span>
                        </div>
                        <h4 class="text-2xl font-bold text-gray-800 mb-2">${grade}</h4>
                        <p class="text-gray-600">Overall Grade</p>
                    </div>
                    
                    <div class="mb-6">
                        <h5 class="font-semibold text-gray-700 mb-2">Assignment Details</h5>
                        <div class="bg-gray-50 rounded-lg p-4">
                            <p class="text-gray-800"><span class="font-medium">Title:</span> ${safeText(homeworkData.title || homeworkData.subject || 'Untitled')}</p>
                        </div>
                    </div>
                    
                    <div>
                        <h5 class="font-semibold text-gray-700 mb-2">Tutor's Feedback</h5>
                        <div class="bg-blue-50 rounded-lg p-4 border border-blue-100">
                            <p class="text-gray-700 whitespace-pre-wrap">${safeText(feedback)}</p>
                        </div>
                    </div>
                    
                    <div class="mt-8 pt-6 border-t border-gray-200">
                        <button onclick="document.getElementById('gradeFeedbackModal').remove()" 
                                class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div.firstElementChild);
}

// MAIN loadAcademicsData function - SIMPLIFIED without Work Here
async function loadAcademicsData(selectedStudent = null) {
    const academicsContent = document.getElementById('academicsContent');
    if (!academicsContent) return;

    const user = auth.currentUser;
    if (!user) return;

    // ── STEP 1: Show cache instantly if available (30 min TTL) ───────────────
    if (!selectedStudent && !window._academicsForceRefresh) {
        const cached = persistentCache.getTab(user.uid, 'academics', 30 * 60 * 1000);
        if (cached) {
            // Restore globals so homework interactions work
            userChildren   = cached.studentNames || [];
            studentIdMap   = new Map(cached.studentNameIdPairs || []);
            allStudentData = cached.minStudentData || [];

            academicsContent.innerHTML = cached.html;

            // Silent background refresh
            setTimeout(() => _silentRefreshAcademics(user.uid), 2000);
            return;
        }
    }
    window._academicsForceRefresh = false;

    // ── STEP 2: No cache — full load with skeleton ────────────────────────────
    showSkeletonLoader('academicsContent', 'reports');

    try {
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();
        const parentPhone = userData.normalizedPhone || userData.phone;

        const childrenResult = await comprehensiveFindChildren(parentPhone, userData.email || '');

        userChildren   = childrenResult.studentNames;
        studentIdMap   = childrenResult.studentNameIdMap;
        allStudentData = childrenResult.allStudentData;

        if (userChildren.length === 0) {
            academicsContent.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📚</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Students Found</h3>
                    <p class="text-gray-500">No students are currently assigned to your account.</p>
                </div>`;
            return;
        }

        let studentsToShow = selectedStudent && studentIdMap.has(selectedStudent)
            ? [selectedStudent]
            : userChildren;

        let academicsHtml = '';

        if (studentIdMap.size > 1) {
            academicsHtml += `
                <div class="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Select Student:</label>
                    <select id="studentSelector" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" onchange="onStudentSelected(this.value)">
                        <option value="">All Students</option>`;
            userChildren.forEach(studentName => {
                const studentInfo = allStudentData.find(s => s.name === studentName);
                const isSelected  = selectedStudent === studentName ? 'selected' : '';
                const status      = studentInfo?.isPending ? ' (Pending Registration)' : '';
                academicsHtml += `<option value="${safeText(studentName)}" ${isSelected}>${capitalize(studentName)}${safeText(status)}</option>`;
            });
            academicsHtml += `</select></div>`;
        }

        const studentPromises = studentsToShow.map(async (studentName) => {
            const studentId   = studentIdMap.get(studentName);
            const studentInfo = allStudentData.find(s => s.name === studentName);
            let sessionTopicsHtml = '';
            let homeworkHtml      = '';

            if (studentId) {
                const [sessionTopicsSnapshot, homeworkSnapshot] = await Promise.all([
                    db.collection('daily_topics').where('studentId', '==', studentId).get().catch(() => ({ empty: true })),
                    db.collection('homework_assignments').where('studentId', '==', studentId).get().catch(() => ({ empty: true }))
                ]);

                sessionTopicsHtml = sessionTopicsSnapshot.empty
                    ? `<div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center"><p class="text-gray-500">No session topics recorded yet.</p></div>`
                    : `<div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center"><p class="text-gray-500">Session topics loaded.</p></div>`;

                if (homeworkSnapshot.empty) {
                    homeworkHtml = `<div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center"><p class="text-gray-500">No homework assignments yet.</p></div>`;
                } else {
                    const now = new Date().getTime();
                    homeworkSnapshot.forEach(doc => {
                        const homework    = doc.data();
                        const homeworkId  = doc.id;
                        const dueTimestamp = getTimestamp(homework.dueDate);
                        const isOverdue   = dueTimestamp && dueTimestamp < now && !['submitted', 'completed', 'graded'].includes(homework.status);
                        const isSubmitted = ['submitted', 'completed'].includes(homework.status);
                        const isGraded    = homework.status === 'graded';
                        const gradeValue  = homework.grade || homework.score || homework.overallGrade || homework.percentage || homework.marks;
                        let gradeDisplay  = 'N/A';
                        if (gradeValue !== undefined && gradeValue !== null) {
                            const parsed = parseFloat(gradeValue);
                            gradeDisplay = !isNaN(parsed) ? `${parsed}%` : gradeValue;
                        }
                        let statusColor, statusText, statusIcon, buttonText, buttonColor;
                        if (isGraded)         { statusColor = 'bg-green-100 text-green-800';  statusText = 'Graded';    statusIcon = '✅'; buttonText = 'View Grade & Feedback'; buttonColor = 'bg-green-600 hover:bg-green-700'; }
                        else if (isSubmitted) { statusColor = 'bg-blue-100 text-blue-800';   statusText = 'Submitted'; statusIcon = '📤'; buttonText = 'View Submission';       buttonColor = 'bg-blue-600 hover:bg-blue-700'; }
                        else if (isOverdue)   { statusColor = 'bg-red-100 text-red-800';     statusText = 'Overdue';   statusIcon = '⚠️'; buttonText = 'Upload Assignment';     buttonColor = 'bg-red-600 hover:bg-red-700'; }
                        else { statusColor = homework.submissionUrl ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'; statusText = homework.submissionUrl ? 'Uploaded - Not Submitted' : 'Not Started'; statusIcon = homework.submissionUrl ? '📎' : '📝'; buttonText = homework.submissionUrl ? 'Review & Submit' : 'Download Assignment'; buttonColor = homework.submissionUrl ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'; }

                        const safeTitle       = safeText(homework.title || homework.subject || 'Untitled Assignment');
                        const safeDescription = safeText(homework.description || homework.instructions || 'No description provided.');
                        const tutorName       = safeText(homework.tutorName || homework.assignedBy || 'Tutor');

                        homeworkHtml += `
                            <div class="bg-white border ${isOverdue ? 'border-red-200' : 'border-gray-200'} rounded-lg p-4 shadow-sm mb-4" data-homework-id="${homeworkId}" data-student-id="${studentId}">
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <h5 class="font-medium text-gray-800 text-lg">${safeTitle}</h5>
                                        <div class="mt-1 flex flex-wrap items-center gap-2">
                                            <span class="text-xs ${statusColor} px-2 py-1 rounded-full">${statusIcon} ${statusText}</span>
                                            <span class="text-xs text-gray-600">Assigned by: ${tutorName}</span>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <span class="text-sm font-medium text-gray-700">Due: ${formatDetailedDate(new Date(dueTimestamp), true)}</span>
                                    </div>
                                </div>
                                <div class="text-gray-700 mb-4">
                                    <p class="whitespace-pre-wrap bg-gray-50 p-3 rounded-md">${safeDescription}</p>
                                </div>
                                <div class="flex justify-between items-center pt-3 border-t border-gray-100">
                                    <div class="flex items-center space-x-3">
                                        ${homework.fileUrl ? `<button onclick="forceDownload('${sanitizeUrl(homework.fileUrl)}', '${safeText(homework.title || 'assignment')}.pdf')" class="text-green-600 hover:text-green-800 font-medium flex items-center text-sm"><span class="mr-1">📥</span> Download Assignment</button>` : ''}
                                    </div>
                                    ${gradeValue !== undefined && gradeValue !== null ? `<div class="text-right"><span class="font-medium text-gray-700">Grade: </span><span class="font-bold ${typeof gradeValue === 'number' ? (gradeValue >= 70 ? 'text-green-600' : gradeValue >= 50 ? 'text-yellow-600' : 'text-red-600') : 'text-gray-600'}">${gradeDisplay}</span></div>` : ''}
                                </div>
                                <div class="mt-4 pt-3 border-t border-gray-100">
                                    <button onclick="handleHomeworkAction('${homeworkId}', '${studentId}', '${isGraded ? 'graded' : isSubmitted ? 'submitted' : homework.submissionUrl ? 'uploaded' : 'pending'}')" class="w-full ${buttonColor} text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90">${buttonText}</button>
                                </div>
                            </div>`;
                    });
                }
            }
            return { studentName, studentInfo, sessionTopicsHtml, homeworkHtml };
        });

        const studentResults = await Promise.all(studentPromises);

        studentResults.forEach(({ studentName, studentInfo, sessionTopicsHtml, homeworkHtml }) => {
            academicsHtml += `
                <div class="bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-600 p-4 rounded-lg mb-6">
                    <h2 class="text-xl font-bold text-green-800">${capitalize(studentName)}${studentInfo?.isPending ? ' <span class="text-yellow-600 text-sm">(Pending Registration)</span>' : ''}</h2>
                    <p class="text-green-600">Academic progress and assignments</p>
                </div>
                <div class="mb-8">
                    <button onclick="toggleAcademicsAccordion('session-topics-${safeText(studentName)}')" class="w-full flex justify-between items-center p-4 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 mb-4">
                        <div class="flex items-center"><span class="text-xl mr-3">📝</span><h3 class="font-bold text-blue-800 text-lg">Session Topics</h3></div>
                        <span id="session-topics-${safeText(studentName)}-arrow" class="text-blue-600 text-xl">▼</span>
                    </button>
                    <div id="session-topics-${safeText(studentName)}-content" class="hidden">${sessionTopicsHtml}</div>
                </div>
                <div class="mb-8">
                    <button onclick="toggleAcademicsAccordion('homework-${safeText(studentName)}')" class="w-full flex justify-between items-center p-4 bg-purple-100 border border-purple-300 rounded-lg hover:bg-purple-200 mb-4">
                        <div class="flex items-center"><span class="text-xl mr-3">📚</span><h3 class="font-bold text-purple-800 text-lg">Homework Assignments</h3></div>
                        <span id="homework-${safeText(studentName)}-arrow" class="text-purple-600 text-xl">▼</span>
                    </button>
                    <div id="homework-${safeText(studentName)}-content" class="hidden">${homeworkHtml}</div>
                </div>`;
        });

        academicsContent.innerHTML = academicsHtml;

        // Save to cache (store minimal student data - no Firestore Timestamps)
        persistentCache.setTab(user.uid, 'academics', {
            html:               academicsHtml,
            studentNames:       userChildren,
            studentNameIdPairs: [...studentIdMap.entries()],
            minStudentData:     allStudentData.map(s => ({ id: s.id, name: s.name, isPending: s.isPending, collection: s.collection }))
        });

    } catch (error) {
        console.error('Error loading academics data:', error);
        academicsContent.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">❌</div>
                <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Academic Data</h3>
                <p class="text-gray-500">Unable to load academic data at this time.</p>
                <button onclick="loadAcademicsData()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Try Again</button>
            </div>`;
    }
}

// Silent background refresh for academics — updates cache and DOM only if data changed
async function _silentRefreshAcademics(userId) {
    try {
        const user = auth.currentUser;
        if (!user || user.uid !== userId) return;
        const userDoc = await db.collection('parent_users').doc(userId).get();
        const userData = userDoc.data();
        const childrenResult = await comprehensiveFindChildren(userData.normalizedPhone || userData.phone, userData.email || '');
        const cached = persistentCache.getTab(userId, 'academics', 30 * 60 * 1000);
        const cachedCount = cached ? (cached.studentNames || []).length : -1;
        if (childrenResult.studentNames.length !== cachedCount) {
            // Something changed — force a full reload
            window._academicsForceRefresh = true;
            loadAcademicsData();
        }
    } catch (e) { /* silent */ }
}

// Setup real-time listener
function setupHomeworkRealTimeListener() {
    const user = auth.currentUser;
    if (!user) return;

    if (window.homeworkListener) {
        window.homeworkListener();
    }

    window.homeworkListener = db.collection('homework_assignments')
        .where('studentId', 'in', Array.from(studentIdMap.values()))
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified') {
                    const homeworkData = change.doc.data();
                    const studentId = homeworkData.studentId;
                    
                    for (const [studentName, sid] of studentIdMap.entries()) {
                        if (sid === studentId) {
                            // You can add update logic here if needed
                            break;
                        }
                    }
                }
            });
        }, (error) => {
            console.error('Homework real-time listener error:', error);
        });
}
// ============================================================================
// SECTION 12: OPTIMIZED REAL-TIME MONITORING
// ============================================================================

function cleanupRealTimeListeners() {
    
    realTimeListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });
    realTimeListeners = [];
    
    if (window.realTimeIntervals) {
        window.realTimeIntervals.forEach(id => clearInterval(id));
        window.realTimeIntervals = [];
    }
    
    // Clean up charts
    charts.forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    charts.clear();
}

function setupRealTimeMonitoring(parentPhone, userId) {
    
    cleanupRealTimeListeners();
    
    if (!window.realTimeIntervals) {
        window.realTimeIntervals = [];
    }
    
    const parentSuffix = extractPhoneSuffix(parentPhone);
    if (!parentSuffix) {
        return;
    }

    // Use Firestore onSnapshot listeners instead of polling (saves ~95% reads)
    // Listen for new assessment reports
    try {
        const assessmentUnsub = db.collection('student_results')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' && change.doc.metadata.hasPendingWrites === false) {
                        const data = change.doc.data();
                        const phoneFields = [data.parentPhone, data.parent_phone, data.guardianPhone, data.motherPhone, data.fatherPhone];
                        for (const fieldPhone of phoneFields) {
                            if (fieldPhone && extractPhoneSuffix(fieldPhone) === parentSuffix) {
                                // Invalidate cache so next background refresh fetches fresh data
                                if (auth.currentUser) persistentCache.invalidate(auth.currentUser.uid);
                                showNewReportNotification();
                                break;
                            }
                        }
                    }
                });
            }, (error) => {
                // Silently handle - will work without real-time updates
            });
        
        realTimeListeners.push(assessmentUnsub);
        
        // Listen for new monthly reports
        const monthlyUnsub = db.collection('tutor_submissions')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' && change.doc.metadata.hasPendingWrites === false) {
                        const data = change.doc.data();
                        const phoneFields = [data.parentPhone, data.parent_phone, data.guardianPhone, data.motherPhone, data.fatherPhone];
                        for (const fieldPhone of phoneFields) {
                            if (fieldPhone && extractPhoneSuffix(fieldPhone) === parentSuffix) {
                                // Invalidate cache so next background refresh fetches fresh data
                                if (auth.currentUser) persistentCache.invalidate(auth.currentUser.uid);
                                showNewReportNotification();
                                break;
                            }
                        }
                    }
                });
            }, (error) => {
                // Silently handle
            });
        
        realTimeListeners.push(monthlyUnsub);

    } catch (error) {
        // Fallback: no real-time monitoring
    }
    
}

function showNewReportNotification() {
    showMessage('New reports available! Refresh to view.', 'success');
    
    const existingIndicator = document.getElementById('newReportIndicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'newReportIndicator';
    indicator.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-pulse fade-in';
    indicator.innerHTML = '📄 New Reports Available!';
    document.body.appendChild(indicator);
    
    setTimeout(() => {
        indicator.remove();
    }, 5000);
    
    const refreshBtn = document.getElementById('manualRefreshBtn');
    if (refreshBtn) {
        const originalText = refreshBtn.innerHTML;
        refreshBtn.innerHTML = '<span class="mr-2">🔄</span> <span class="animate-pulse">Check for New Reports</span>';
        
        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
        }, 3000);
    }
}

// ============================================================================
// SECTION 13: YEARLY ARCHIVES REPORTS SYSTEM
// ============================================================================

function generateTemplatedRecommendation(studentName, tutorName, results) {
    const strengths = [];
    const weaknesses = [];
    results.forEach(res => {
        const percentage = res.total > 0 ? (res.correct / res.total) * 100 : 0;
        const topicList = res.topics.length > 0 ? res.topics : [res.subject];
        if (percentage >= 75) {
            strengths.push(...topicList);
        } else if (percentage < 50) {
            weaknesses.push(...topicList);
        }
    });

    const uniqueStrengths = [...new Set(strengths)];
    const uniqueWeaknesses = [...new Set(weaknesses)];

    let praiseClause = "";
    if (uniqueStrengths.length > 2) {
        praiseClause = `It was great to see ${studentName} demonstrate a solid understanding of several key concepts, particularly in areas like ${uniqueStrengths[0]} and ${uniqueStrengths[1]}. `;
    } else if (uniqueStrengths.length > 0) {
        praiseClause = `${studentName} showed strong potential, especially in the topic of ${uniqueStrengths.join(', ')}. `;
    } else {
        praiseClause = `${studentName} has put in a commendable effort on this initial assessment. `;
    }

    let improvementClause = "";
    if (uniqueWeaknesses.length > 2) {
        improvementClause = `Our next step will be to focus on building more confidence in a few areas, such as ${uniqueWeaknesses[0]} and ${uniqueWeaknesses[1]}. `;
    } else if (uniqueWeaknesses.length > 0) {
        improvementClause = `To continue this positive progress, our focus will be on the topic of ${uniqueWeaknesses.join(', ')}. `;
    } else {
        improvementClause = "We will continue to build on these fantastic results and explore more advanced topics. ";
    }

    const closingStatement = `With personalized support from their tutor, ${tutorName}, at Blooming Kids House, we are very confident that ${studentName} will master these skills and unlock their full potential.`;

    return praiseClause + improvementClause + closingStatement;
}

function createYearlyArchiveReportView(reportsByStudent) {
    let html = '';
    let studentIndex = 0;
    
    const sortedStudents = Array.from(reportsByStudent.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    for (const [studentName, reports] of sortedStudents) {
        const fullName = capitalize(studentName);
        const studentData = reports.studentData;
        
        const assessmentCount = Array.from(reports.assessments.values()).flat().length;
        const monthlyCount = Array.from(reports.monthly.values()).flat().length;
        const totalCount = assessmentCount + monthlyCount;
        
        html += `
            <div class="accordion-item mb-6 fade-in">
                <button onclick="toggleAccordion('student-${studentIndex}')" 
                        class="accordion-header w-full flex justify-between items-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl hover:bg-green-100 transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1">
                    <div class="flex items-center">
                        <div class="mr-4 p-3 bg-green-100 rounded-full">
                            <span class="text-2xl text-green-600">👤</span>
                        </div>
                        <div class="text-left">
                            <h3 class="font-bold text-green-900 text-xl">${fullName}</h3>
                            <div class="flex items-center mt-1">
                                <span class="text-green-600 text-sm">
                                    ${assessmentCount} Assessment(s) • ${monthlyCount} Monthly Report(s)
                                </span>
                                ${studentData?.isPending ? 
                                    '<span class="ml-3 bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Pending Registration</span>' : 
                                    '<span class="ml-3 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Active</span>'}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-4">
                        <span class="text-green-700 font-semibold">Total: ${totalCount}</span>
                        <span id="student-${studentIndex}-arrow" class="accordion-arrow text-green-600 text-2xl transform transition-transform duration-300">▼</span>
                    </div>
                </button>
                <div id="student-${studentIndex}-content" class="accordion-content hidden mt-4">
        `;
        
        if (totalCount === 0) {
            html += `
                <div class="p-8 bg-gradient-to-br from-gray-50 to-blue-50 border border-gray-200 rounded-xl text-center shadow-sm">
                    <div class="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                        <span class="text-3xl text-blue-600">📄</span>
                    </div>
                    <h4 class="text-lg font-semibold text-gray-800 mb-2">No Reports Yet</h4>
                    <p class="text-gray-600 max-w-md mx-auto mb-4">No reports have been generated for ${fullName} yet. Reports will appear here once tutors or assessors submit them.</p>
                    <div class="inline-flex items-center text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                        <span class="mr-2">🕒</span>
                        Check back after your child's sessions
                    </div>
                    ${studentData?.isPending ? 
                        '<div class="mt-4 inline-flex items-center text-sm text-yellow-700 bg-yellow-50 px-4 py-2 rounded-lg border border-yellow-200">⚠️ This student is pending registration. Reports will be available after registration is complete.</div>' : 
                        ''}
                </div>
            `;
        } else {
            const reportsByYear = new Map();
            
            for (const [sessionKey, sessionReports] of reports.assessments) {
                sessionReports.forEach(report => {
                    const year = new Date(report.timestamp * 1000).getFullYear();
                    if (!reportsByYear.has(year)) {
                        reportsByYear.set(year, { assessments: [], monthly: [] });
                    }
                    reportsByYear.get(year).assessments.push({ 
                        sessionKey, 
                        reports: sessionReports,
                        date: new Date(report.timestamp * 1000)
                    });
                });
            }
            
            for (const [sessionKey, sessionReports] of reports.monthly) {
                sessionReports.forEach(report => {
                    const year = new Date(report.timestamp * 1000).getFullYear();
                    if (!reportsByYear.has(year)) {
                        reportsByYear.set(year, { assessments: [], monthly: [] });
                    }
                    reportsByYear.get(year).monthly.push({ 
                        sessionKey, 
                        reports: sessionReports,
                        date: new Date(report.timestamp * 1000)
                    });
                });
            }
            
            const sortedYears = Array.from(reportsByYear.keys()).sort((a, b) => b - a);
            
            let yearIndex = 0;
            for (const year of sortedYears) {
                const yearData = reportsByYear.get(year);
                const yearAssessmentCount = yearData.assessments.length;
                const yearMonthlyCount = yearData.monthly.length;
                const yearTotal = yearAssessmentCount + yearMonthlyCount;
                
                html += `
                    <div class="mb-4 ml-2">
                        <button onclick="toggleAccordion('year-${studentIndex}-${yearIndex}')" 
                                class="accordion-header w-full flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-sky-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all duration-300">
                            <div class="flex items-center">
                                <div class="mr-3 p-2 bg-blue-100 rounded-lg">
                                    <span class="text-xl text-blue-600">📅</span>
                                </div>
                                <div class="text-left">
                                    <h4 class="font-bold text-blue-900">${year}</h4>
                                    <p class="text-blue-600 text-sm">
                                        ${yearAssessmentCount} Assessment(s) • ${yearMonthlyCount} Monthly Report(s)
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-center space-x-3">
                                <span class="text-blue-700 font-medium">${yearTotal} total</span>
                                <span id="year-${studentIndex}-${yearIndex}-arrow" class="accordion-arrow text-blue-600 transform transition-transform duration-300">▼</span>
                            </div>
                        </button>
                        <div id="year-${studentIndex}-${yearIndex}-content" class="progress-accordion-content hidden ml-6 mt-3">
                `;
                
                if (yearAssessmentCount > 0) {
                    html += `
                        <div class="mb-6">
                            <div class="flex items-center mb-4 p-3 bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-100 rounded-lg">
                                <div class="mr-3 p-2 bg-purple-100 rounded-lg">
                                    <span class="text-xl text-purple-600">📊</span>
                                </div>
                                <div>
                                    <h5 class="font-bold text-purple-800">Assessment Reports</h5>
                                    <p class="text-purple-600 text-sm">Test scores and performance metrics</p>
                                </div>
                                <span class="ml-auto bg-purple-100 text-purple-800 text-xs font-medium px-3 py-1 rounded-full">${yearAssessmentCount} reports</span>
                            </div>
                    `;
                    
                    const assessmentsByMonth = new Map();
                    yearData.assessments.forEach(({ sessionKey, reports: sessionReports, date }) => {
                        const month = date.getMonth();
                        if (!assessmentsByMonth.has(month)) {
                            assessmentsByMonth.set(month, []);
                        }
                        assessmentsByMonth.get(month).push({ sessionKey, reports: sessionReports, date });
                    });
                    
                    const sortedMonths = Array.from(assessmentsByMonth.keys()).sort((a, b) => b - a);
                    
                    sortedMonths.forEach(month => {
                        const monthName = [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ][month];
                        const monthAssessments = assessmentsByMonth.get(month);
                        
                        html += `
                            <div class="mb-4 ml-2">
                                <h6 class="font-semibold text-gray-700 mb-3 flex items-center">
                                    <span class="mr-2 text-gray-500">📌</span>
                                    ${monthName}
                                    <span class="ml-2 bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">${monthAssessments.length} assessments</span>
                                </h6>
                                <div class="space-y-4">
                        `;
                        
                        monthAssessments.forEach(({ sessionKey, reports: sessionReports, date }, sessionIndex) => {
                            html += createAssessmentReportHTML(sessionReports, studentIndex, `${year}-${month}-${sessionIndex}`, fullName, date);
                        });
                        
                        html += `
                                </div>
                            </div>
                        `;
                    });
                    
                    html += `</div>`;
                }
                
                if (yearMonthlyCount > 0) {
                    html += `
                        <div class="mb-6">
                            <div class="flex items-center mb-4 p-3 bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-100 rounded-lg">
                                <div class="mr-3 p-2 bg-teal-100 rounded-lg">
                                    <span class="text-xl text-teal-600">📈</span>
                                </div>
                                <div>
                                    <h5 class="font-bold text-teal-800">Monthly Reports</h5>
                                    <p class="text-teal-600 text-sm">Progress updates and session summaries</p>
                                </div>
                                <span class="ml-auto bg-teal-100 text-teal-800 text-xs font-medium px-3 py-1 rounded-full">${yearMonthlyCount} reports</span>
                            </div>
                    `;
                    
                    const monthlyByMonth = new Map();
                    yearData.monthly.forEach(({ sessionKey, reports: sessionReports, date }) => {
                        const month = date.getMonth();
                        if (!monthlyByMonth.has(month)) {
                            monthlyByMonth.set(month, []);
                        }
                        monthlyByMonth.get(month).push({ sessionKey, reports: sessionReports, date });
                    });
                    
                    const sortedMonths = Array.from(monthlyByMonth.keys()).sort((a, b) => b - a);
                    
                    sortedMonths.forEach(month => {
                        const monthName = [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ][month];
                        const monthReports = monthlyByMonth.get(month);
                        
                        html += `
                            <div class="mb-4 ml-2">
                                <h6 class="font-semibold text-gray-700 mb-3 flex items-center">
                                    <span class="mr-2 text-gray-500">📌</span>
                                    ${monthName}
                                    <span class="ml-2 bg-gray-100 text-gray-700 text-xs font-medium px-2 py-1 rounded-full">${monthReports.length} reports</span>
                                </h6>
                                <div class="space-y-4">
                        `;
                        
                        monthReports.forEach(({ sessionKey, reports: sessionReports, date }, sessionIndex) => {
                            html += createMonthlyReportHTML(sessionReports, studentIndex, `${year}-${month}-${sessionIndex}`, fullName, date);
                        });
                        
                        html += `
                                </div>
                            </div>
                        `;
                    });
                    
                    html += `</div>`;
                }
                
                html += `
                        </div>
                    </div>
                `;
                
                yearIndex++;
            }
        }
        
        html += `
                </div>
            </div>
        `;
        
        studentIndex++;
    }
    
    return html;
}

function createAssessmentReportHTML(sessionReports, studentIndex, sessionId, fullName, date) {
    const firstReport = sessionReports[0];
    const formattedDate = formatDetailedDate(date || new Date(firstReport.timestamp * 1000), true);
    
    let tutorName = 'N/A';
    const tutorEmail = firstReport.tutorEmail;
    
    const results = sessionReports.map(testResult => {
        const topics = [...new Set(testResult.answers?.map(a => safeText(a.topic)).filter(t => t))] || [];
        return {
            subject: safeText(testResult.subject || testResult.testSubject || 'General'),
            correct: testResult.score !== undefined ? testResult.score : 0,
            total: testResult.totalScoreableQuestions !== undefined ? testResult.totalScoreableQuestions : 0,
            topics: topics,
        };
    });

    const recommendation = generateTemplatedRecommendation(fullName, tutorName, results);

    const tableRows = results.map(res => `
        <tr>
            <td class="border px-2 py-1">${res.subject.toUpperCase()}</td>
            <td class="border px-2 py-1 text-center">${res.correct} / ${res.total}</td>
        </tr>
    `).join("");

    const topicsTableRows = results.map(res => `
        <tr>
            <td class="border px-2 py-1 font-semibold">${res.subject.toUpperCase()}</td>
            <td class="border px-2 py-1">${res.topics.join(', ') || 'N/A'}</td>
        </tr>
    `).join("");

    const creativeWritingAnswer = firstReport.answers?.find(a => a.type === 'creative-writing');
    const tutorReport = creativeWritingAnswer?.tutorReport || 'Pending review.';

    const chartId = `chart-${studentIndex}-${sessionId}`;
    const chartConfig = {
        type: 'bar',
        data: {
            labels: results.map(r => r.subject.toUpperCase()),
            datasets: [
                { 
                    label: 'Correct Answers', 
                    data: results.map(s => s.correct), 
                    backgroundColor: '#4CAF50' 
                }, 
                { 
                    label: 'Incorrect/Unanswered', 
                    data: results.map(s => s.total - s.correct), 
                    backgroundColor: '#FFCD56' 
                }
            ]
        },
        options: {
            responsive: true,
            scales: { 
                x: { stacked: true }, 
                y: { stacked: true, beginAtZero: true } 
            },
            plugins: { 
                title: { 
                    display: true, 
                    text: 'Score Distribution by Subject' 
                } 
            }
        }
    };

    return `
        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="assessment-block-${studentIndex}-${sessionId}">
            <div class="text-center mb-6 border-b pb-4">
                <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                     alt="Blooming Kids House Logo" 
                     class="h-16 w-auto mx-auto mb-3">
                <h2 class="text-2xl font-bold text-green-800">Assessment Report</h2>
                <p class="text-gray-600">Date: ${formattedDate}</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                <div>
                    <p><strong>Student's Name:</strong> ${fullName}</p>
                    <p><strong>Parent's Phone:</strong> ${firstReport.parentPhone || 'N/A'}</p>
                    <p><strong>Grade:</strong> ${firstReport.grade}</p>
                </div>
                <div>
                    <p><strong>Tutor:</strong> ${tutorName || 'N/A'}</p>
                    <p><strong>Location:</strong> ${firstReport.studentCountry || 'N/A'}</p>
                </div>
            </div>
            
            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Performance Summary</h3>
            <table class="w-full text-sm mb-4 border border-collapse">
                <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
            
            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Knowledge & Skill Analysis</h3>
            <table class="w-full text-sm mb-4 border border-collapse">
                <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-left">Topics Covered</th></tr></thead>
                <tbody>${topicsTableRows}</tbody>
            </table>
            
            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Tutor's Recommendation</h3>
            <p class="mb-2 text-gray-700 leading-relaxed">${recommendation}</p>

            ${creativeWritingAnswer ? `
            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Creative Writing Feedback</h3>
            <p class="mb-2 text-gray-700"><strong>Tutor's Report:</strong> ${tutorReport}</p>
            ` : ''}

            ${results.length > 0 ? `
            <canvas id="${chartId}" class="w-full h-48 mb-4"></canvas>
            ` : ''}
            
            <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${tutorName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
            </div>
            
            <div class="mt-6 text-center">
                <button onclick="downloadSessionReport(${studentIndex}, '${sessionId}', '${safeText(fullName)}', 'assessment')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                    Download Assessment PDF
                </button>
            </div>
        </div>
        <script>
            setTimeout(() => {
                const ctx = document.getElementById('${chartId}');
                if (ctx) {
                    const chart = new Chart(ctx, ${JSON.stringify(chartConfig)});
                    window.charts.set('${chartId}', chart);
                }
            }, 100);
        </script>
    `;
}

function createMonthlyReportHTML(sessionReports, studentIndex, sessionId, fullName, date) {
    const firstReport = sessionReports[0];
    const formattedDate = formatDetailedDate(date || new Date(firstReport.timestamp * 1000), true);
    
    return `
        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="monthly-block-${studentIndex}-${sessionId}">
            <div class="text-center mb-6 border-b pb-4">
                <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                     alt="Blooming Kids House Logo" 
                     class="h-16 w-auto mx-auto mb-3">
                <h2 class="text-2xl font-bold text-green-800">MONTHLY LEARNING REPORT</h2>
                <p class="text-gray-600">Date: ${formattedDate}</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                <div>
                    <p><strong>Student's Name:</strong> ${firstReport.studentName || 'N/A'}</p>
                    <p><strong>Parent's Name:</strong> ${firstReport.parentName || 'N/A'}</p>
                    <p><strong>Parent's Phone:</strong> ${firstReport.parentPhone || 'N/A'}</p>
                </div>
                <div>
                    <p><strong>Grade:</strong> ${firstReport.grade || 'N/A'}</p>
                    <p><strong>Tutor's Name:</strong> ${firstReport.tutorName || 'N/A'}</p>
                </div>
            </div>

            ${firstReport.introduction ? `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">INTRODUCTION</h3>
                <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.introduction)}</p>
            </div>
            ` : ''}

            ${firstReport.topics ? `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">TOPICS & REMARKS</h3>
                <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.topics)}</p>
            </div>
            ` : ''}

            ${firstReport.progress ? `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">PROGRESS & ACHIEVEMENTS</h3>
                <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.progress)}</p>
            </div>
            ` : ''}

            ${firstReport.strengthsWeaknesses ? `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">STRENGTHS AND WEAKNESSES</h3>
                <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.strengthsWeaknesses)}</p>
            </div>
            ` : ''}

            ${firstReport.recommendations ? `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">RECOMMENDATIONS</h3>
                <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.recommendations)}</p>
            </div>
            ` : ''}

            ${firstReport.generalComments ? `
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">GENERAL TUTOR'S COMMENTS</h3>
                <p class="text-gray-700 leading-relaxed preserve-whitespace">${safeText(firstReport.generalComments)}</p>
            </div>
            ` : ''}

            <div class="text-right mt-8 pt-4 border-t">
                <p class="text-gray-600">Best regards,</p>
                <p class="font-semibold text-green-800">${firstReport.tutorName || 'N/A'}</p>
            </div>

            <div class="mt-6 text-center">
                <button onclick="downloadMonthlyReport(${studentIndex}, '${sessionId}', '${safeText(fullName)}')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                    Download Monthly Report PDF
                </button>
            </div>
        </div>
    `;
}

function downloadSessionReport(studentIndex, sessionId, studentName, type) {
    const element = document.getElementById(`${type}-block-${studentIndex}-${sessionId}`);
    if (!element) {
        showMessage('Report element not found for download', 'error');
        return;
    }
    const safeStudentName = studentName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeStudentName}_${Date.now()}.pdf`;
    
    const opt = {
        margin: 0.5,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true,
            backgroundColor: '#ffffff'
        },
        jsPDF: { 
            unit: 'in', 
            format: 'letter', 
            orientation: 'portrait' 
        }
    };
    
    showMessage('Generating PDF download...', 'success');
    
    html2pdf().from(element).set(opt).save();
}

function downloadMonthlyReport(studentIndex, sessionId, studentName) {
    downloadSessionReport(studentIndex, sessionId, studentName, 'monthly');
}

function toggleAccordion(elementId) {
    const content = document.getElementById(`${elementId}-content`);
    const arrow = document.getElementById(`${elementId}-arrow`);
    
    if (!content || !arrow) {
        console.error(`Could not find accordion elements for ${elementId}`);
        return;
    }
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.textContent = '▲';
    } else {
        content.classList.add('hidden');
        arrow.textContent = '▼';
    }
}

// ============================================================================
// SECTION 14: PARALLEL REPORT LOADING
// ============================================================================

// Renders report data from plain arrays — works from cache or fresh fetch
function renderReportData(userData, assessmentResults, monthlyResults, parentPhone, userId) {
    const reportContent  = document.getElementById('reportContent');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const authArea       = document.getElementById('authArea');
    const reportArea     = document.getElementById('reportArea');
    const authLoader     = document.getElementById('authLoader');

    if (!reportContent) return;

    currentUserData = {
        parentName:  userData.parentName  || 'Parent',
        parentPhone: parentPhone,
        email:       userData.email       || ''
    };

    if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;
    if (authLoader)     authLoader.classList.add('hidden');
    if (authArea && reportArea) {
        authArea.classList.add('hidden');
        reportArea.classList.remove('hidden');
    }

    if (assessmentResults.length === 0 && monthlyResults.length === 0) {
        reportContent.innerHTML = `
            <div class="text-center py-16">
                <div class="text-6xl mb-6">📊</div>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">Waiting for Your Child's First Report</h2>
                <p class="text-gray-600 max-w-2xl mx-auto mb-6">No reports found for your account yet.</p>
                <div class="bg-green-50 border border-green-200 rounded-lg p-6 max-w-2xl mx-auto">
                    <button onclick="manualRefreshReportsV2()" class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 flex items-center mx-auto">
                        <span class="mr-2">🔄</span> Check Now
                    </button>
                </div>
            </div>`;
        return;
    }

    const studentReportsMap = new Map();
    [...assessmentResults, ...monthlyResults].forEach(report => {
        const name = report.studentName;
        if (!name) return;
        if (!studentReportsMap.has(name)) studentReportsMap.set(name, { assessments: [], monthly: [] });
        if (report.type === 'assessment') studentReportsMap.get(name).assessments.push(report);
        else if (report.type === 'monthly') studentReportsMap.get(name).monthly.push(report);
    });

    userChildren = Array.from(studentReportsMap.keys());

    const formattedReportsByStudent = new Map();
    for (const [studentName, reports] of studentReportsMap) {
        const assessmentsBySession = new Map();
        reports.assessments.forEach(r => {
            const k = Math.floor(r.timestamp / 86400);
            if (!assessmentsBySession.has(k)) assessmentsBySession.set(k, []);
            assessmentsBySession.get(k).push(r);
        });
        const monthlyBySession = new Map();
        reports.monthly.forEach(r => {
            const k = Math.floor(r.timestamp / 86400);
            if (!monthlyBySession.has(k)) monthlyBySession.set(k, []);
            monthlyBySession.get(k).push(r);
        });
        formattedReportsByStudent.set(studentName, {
            assessments: assessmentsBySession,
            monthly:     monthlyBySession,
            studentData: { name: studentName, isPending: false }
        });
    }

    reportContent.innerHTML = createYearlyArchiveReportView(formattedReportsByStudent);
    setTimeout(() => window.initializeCharts && window.initializeCharts(), 150);
}

// Pre-loads all tabs silently in background so every tab click is instant
// Pure data fetch — writes straight to cache with zero DOM involvement.
// userData is passed in from loadUserDashboard so no extra Firestore read needed.
async function preloadAllTabs(userId, userData) {
    const user = auth.currentUser;
    if (!user || user.uid !== userId) return;

    // Small delay so the reports tab renders fully first
    await new Promise(r => setTimeout(r, 1500));

    try {
        // If userData not passed, fetch it (cold path fallback)
        if (!userData) {
            const userDoc = await db.collection('parent_users').doc(userId).get();
            if (!userDoc.exists) return;
            userData = userDoc.data();
        }

        const parentPhone = userData.normalizedPhone || userData.phone;
        const email       = userData.email || '';

        // Run all three preloads in parallel — none touch the DOM
        await Promise.allSettled([
            _preloadAcademicsCache(userId, parentPhone, email),
            _preloadRewardsCache(userId, userData),
            _preloadSettingsCache(userId, userData, parentPhone, email)
        ]);
    } catch (e) { /* silent — preload is best-effort */ }
}

// Fetch academics data and build HTML, save to cache — no DOM touched
async function _preloadAcademicsCache(userId, parentPhone, email) {
    if (persistentCache.getTab(userId, 'academics', 30 * 60 * 1000)) return; // already cached

    const childrenResult = await comprehensiveFindChildren(parentPhone, email);
    if (childrenResult.studentNames.length === 0) return;

    const studentIdMapLocal   = childrenResult.studentNameIdMap;
    const allStudentDataLocal = childrenResult.allStudentData;
    let academicsHtml = '';

    if (studentIdMapLocal.size > 1) {
        academicsHtml += `<div class="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <label class="block text-sm font-medium text-gray-700 mb-2">Select Student:</label>
            <select id="studentSelector" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" onchange="onStudentSelected(this.value)">
                <option value="">All Students</option>`;
        childrenResult.studentNames.forEach(name => {
            const info = allStudentDataLocal.find(s => s.name === name);
            academicsHtml += `<option value="${safeText(name)}">${capitalize(name)}${info?.isPending ? ' (Pending Registration)' : ''}</option>`;
        });
        academicsHtml += `</select></div>`;
    }

    const studentPromises = childrenResult.studentNames.map(async (studentName) => {
        const studentId   = studentIdMapLocal.get(studentName);
        const studentInfo = allStudentDataLocal.find(s => s.name === studentName);
        let sessionTopicsHtml = '', homeworkHtml = '';

        if (studentId) {
            const [topicsSnap, hwSnap] = await Promise.all([
                db.collection('daily_topics').where('studentId', '==', studentId).get().catch(() => ({ empty: true })),
                db.collection('homework_assignments').where('studentId', '==', studentId).get().catch(() => ({ empty: true }))
            ]);

            sessionTopicsHtml = topicsSnap.empty
                ? `<div class="bg-gray-50 border rounded-lg p-6 text-center"><p class="text-gray-500">No session topics recorded yet.</p></div>`
                : `<div class="bg-gray-50 border rounded-lg p-6 text-center"><p class="text-gray-500">Session topics loaded.</p></div>`;

            if (hwSnap.empty) {
                homeworkHtml = `<div class="bg-gray-50 border rounded-lg p-6 text-center"><p class="text-gray-500">No homework assignments yet.</p></div>`;
            } else {
                const now = Date.now();
                hwSnap.forEach(doc => {
                    const hw           = doc.data();
                    const homeworkId   = doc.id;
                    const dueTimestamp = getTimestamp(hw.dueDate);
                    const isOverdue    = dueTimestamp && dueTimestamp < now && !['submitted','completed','graded'].includes(hw.status);
                    const isSubmitted  = ['submitted','completed'].includes(hw.status);
                    const isGraded     = hw.status === 'graded';
                    const gradeValue   = hw.grade || hw.score || hw.overallGrade || hw.percentage || hw.marks;
                    let gradeDisplay   = 'N/A';
                    if (gradeValue != null) { const p = parseFloat(gradeValue); gradeDisplay = !isNaN(p) ? `${p}%` : gradeValue; }
                    let statusColor, statusText, statusIcon, buttonText, buttonColor;
                    if (isGraded)         { statusColor='bg-green-100 text-green-800';  statusText='Graded';    statusIcon='✅'; buttonText='View Grade & Feedback'; buttonColor='bg-green-600 hover:bg-green-700'; }
                    else if (isSubmitted) { statusColor='bg-blue-100 text-blue-800';   statusText='Submitted'; statusIcon='📤'; buttonText='View Submission';       buttonColor='bg-blue-600 hover:bg-blue-700'; }
                    else if (isOverdue)   { statusColor='bg-red-100 text-red-800';     statusText='Overdue';   statusIcon='⚠️'; buttonText='Upload Assignment';     buttonColor='bg-red-600 hover:bg-red-700'; }
                    else { statusColor=hw.submissionUrl?'bg-yellow-100 text-yellow-800':'bg-gray-100 text-gray-800'; statusText=hw.submissionUrl?'Uploaded - Not Submitted':'Not Started'; statusIcon=hw.submissionUrl?'📎':'📝'; buttonText=hw.submissionUrl?'Review & Submit':'Download Assignment'; buttonColor=hw.submissionUrl?'bg-yellow-600 hover:bg-yellow-700':'bg-blue-600 hover:bg-blue-700'; }
                    const safeTitle = safeText(hw.title||hw.subject||'Untitled Assignment');
                    const safeDesc  = safeText(hw.description||hw.instructions||'No description provided.');
                    const tutor     = safeText(hw.tutorName||hw.assignedBy||'Tutor');
                    homeworkHtml += `<div class="bg-white border ${isOverdue?'border-red-200':'border-gray-200'} rounded-lg p-4 shadow-sm mb-4" data-homework-id="${homeworkId}" data-student-id="${studentId}">
                        <div class="flex justify-between items-start mb-3">
                            <div><h5 class="font-medium text-gray-800 text-lg">${safeTitle}</h5>
                            <div class="mt-1 flex flex-wrap items-center gap-2"><span class="text-xs ${statusColor} px-2 py-1 rounded-full">${statusIcon} ${statusText}</span><span class="text-xs text-gray-600">Assigned by: ${tutor}</span></div></div>
                            <span class="text-sm font-medium text-gray-700">Due: ${formatDetailedDate(new Date(dueTimestamp),true)}</span>
                        </div>
                        <p class="whitespace-pre-wrap bg-gray-50 p-3 rounded-md text-gray-700 mb-4">${safeDesc}</p>
                        <div class="flex justify-between items-center pt-3 border-t border-gray-100">
                            <div>${hw.fileUrl?`<button onclick="forceDownload('${sanitizeUrl(hw.fileUrl)}','${safeText(hw.title||'assignment')}.pdf')" class="text-green-600 hover:text-green-800 font-medium text-sm">📥 Download Assignment</button>`:''}</div>
                            ${gradeValue!=null?`<span class="font-bold ${typeof gradeValue==='number'?(gradeValue>=70?'text-green-600':gradeValue>=50?'text-yellow-600':'text-red-600'):'text-gray-600'}">Grade: ${gradeDisplay}</span>`:''}
                        </div>
                        <div class="mt-4 pt-3 border-t border-gray-100">
                            <button onclick="handleHomeworkAction('${homeworkId}','${studentId}','${isGraded?'graded':isSubmitted?'submitted':hw.submissionUrl?'uploaded':'pending'}')" class="w-full ${buttonColor} text-white px-4 py-2 rounded-lg font-semibold">${buttonText}</button>
                        </div></div>`;
                });
            }
        }
        return { studentName, studentInfo, sessionTopicsHtml, homeworkHtml };
    });

    const results = await Promise.all(studentPromises);
    results.forEach(({ studentName, studentInfo, sessionTopicsHtml, homeworkHtml }) => {
        academicsHtml += `
            <div class="bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-600 p-4 rounded-lg mb-6">
                <h2 class="text-xl font-bold text-green-800">${capitalize(studentName)}${studentInfo?.isPending?'<span class="text-yellow-600 text-sm"> (Pending Registration)</span>':''}</h2>
                <p class="text-green-600">Academic progress and assignments</p>
            </div>
            <div class="mb-8">
                <button onclick="toggleAcademicsAccordion('session-topics-${safeText(studentName)}')" class="w-full flex justify-between items-center p-4 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 mb-4">
                    <div class="flex items-center"><span class="text-xl mr-3">📝</span><h3 class="font-bold text-blue-800 text-lg">Session Topics</h3></div>
                    <span id="session-topics-${safeText(studentName)}-arrow" class="text-blue-600 text-xl">▼</span>
                </button>
                <div id="session-topics-${safeText(studentName)}-content" class="hidden">${sessionTopicsHtml}</div>
            </div>
            <div class="mb-8">
                <button onclick="toggleAcademicsAccordion('homework-${safeText(studentName)}')" class="w-full flex justify-between items-center p-4 bg-purple-100 border border-purple-300 rounded-lg hover:bg-purple-200 mb-4">
                    <div class="flex items-center"><span class="text-xl mr-3">📚</span><h3 class="font-bold text-purple-800 text-lg">Homework Assignments</h3></div>
                    <span id="homework-${safeText(studentName)}-arrow" class="text-purple-600 text-xl">▼</span>
                </button>
                <div id="homework-${safeText(studentName)}-content" class="hidden">${homeworkHtml}</div>
            </div>`;
    });

    persistentCache.setTab(userId, 'academics', {
        html:               academicsHtml,
        studentNames:       childrenResult.studentNames,
        studentNameIdPairs: [...studentIdMapLocal.entries()],
        minStudentData:     allStudentDataLocal.map(s => ({ id: s.id, name: s.name, isPending: s.isPending, collection: s.collection }))
    });
}

// Fetch rewards data and build HTML, save to cache — no DOM touched
async function _preloadRewardsCache(userId, userData) {
    if (persistentCache.getTab(userId, 'rewards', 4 * 60 * 60 * 1000)) return;

    const referralCode  = safeText(userData.referralCode || 'N/A');
    const totalEarnings = userData.referralEarnings || 0;
    const snap          = await db.collection('referral_transactions').where('ownerUid', '==', userId).get();

    let referralsHtml = '', pendingCount = 0, approvedCount = 0, paidCount = 0;

    if (snap.empty) {
        referralsHtml = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No one has used your referral code yet.</td></tr>`;
    } else {
        const txns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        txns.sort((a,b) => (b.timestamp?.toDate?.() || new Date(0)) - (a.timestamp?.toDate?.() || new Date(0)));
        txns.forEach(data => {
            const status = safeText(data.status || 'pending');
            const sc     = status==='paid'?'bg-green-100 text-green-800':status==='approved'?'bg-blue-100 text-blue-800':'bg-yellow-100 text-yellow-800';
            if (status==='pending') pendingCount++; if (status==='approved') approvedCount++; if (status==='paid') paidCount++;
            const name   = capitalize(data.referredStudentName || data.referredStudentPhone);
            const amount = data.rewardAmount ? `₦${data.rewardAmount.toLocaleString()}` : '₦5,000';
            const date   = data.timestamp?.toDate?.().toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'}) || 'N/A';
            referralsHtml += `<tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-medium text-gray-900">${name}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${safeText(date)}</td>
                <td class="px-4 py-3 text-sm"><span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${sc}">${capitalize(status)}</span></td>
                <td class="px-4 py-3 text-sm text-gray-900 font-bold">${safeText(amount)}</td></tr>`;
        });
    }

    const html = `
        <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md">
            <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
            <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">${referralCode}</p>
            <p class="text-blue-700 mt-2">Share this code with other parents. They use it when registering their child, and you earn **₦5,000** once their child completes their first month!</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-green-100 p-6 rounded-xl shadow-lg border-b-4 border-green-600"><p class="text-sm font-medium text-green-700">Total Earnings</p><p class="text-3xl font-extrabold text-green-900 mt-1">₦${totalEarnings.toLocaleString()}</p></div>
            <div class="bg-yellow-100 p-6 rounded-xl shadow-lg border-b-4 border-yellow-600"><p class="text-sm font-medium text-yellow-700">Approved Rewards (Awaiting Payment)</p><p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p></div>
            <div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600"><p class="text-sm font-medium text-gray-700">Total Successful Referrals (Paid)</p><p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p></div>
        </div>
        <h3 class="text-xl font-bold text-gray-800 mb-4">Referral History</h3>
        <div class="overflow-x-auto bg-white rounded-lg shadow">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50"><tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referred Parent/Student</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Used</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th>
                </tr></thead>
                <tbody class="divide-y divide-gray-200">${referralsHtml}</tbody>
            </table>
        </div>`;

    persistentCache.setTab(userId, 'rewards', { html });
}

// Fetch settings data and build HTML, save to cache — no DOM touched
async function _preloadSettingsCache(userId, userData, parentPhone, email) {
    if (persistentCache.getTab(userId, 'settings', 4 * 60 * 60 * 1000)) return;

    const childrenResult = await comprehensiveFindChildren(parentPhone, email);
    const html = _buildSettingsHtml(userData, childrenResult.allStudentData);
    if (html) persistentCache.setTab(userId, 'settings', { html });
}

// Silently fetches fresh data in the background after showing cached data.
// Only updates the screen and cache if something actually changed.
async function backgroundRefreshReports(parentPhone, userId, cachedAssessmentCount, cachedMonthlyCount) {
    try {
        const userDoc = await db.collection('parent_users').doc(userId).get();
        if (!userDoc.exists) return;
        const userData = userDoc.data();

        const searchResults = await searchAllReportsForParent(parentPhone, userData.email || '', userId);
        const { assessmentResults, monthlyResults } = searchResults;

        const changed = assessmentResults.length !== cachedAssessmentCount ||
                        monthlyResults.length      !== cachedMonthlyCount;

        if (changed) {
            // Save fresh data to cache
            persistentCache.set(userId, {
                parentName: userData.parentName || 'Parent',
                email:      userData.email      || ''
            }, assessmentResults, monthlyResults);

            // Re-render with updated data
            renderReportData(userData, assessmentResults, monthlyResults, parentPhone, userId);

            // Show subtle update indicator
            const indicator = document.createElement('div');
            indicator.className = 'fixed bottom-4 right-4 bg-green-500 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-40 fade-in';
            indicator.textContent = '✓ Reports updated';
            document.body.appendChild(indicator);
            setTimeout(() => indicator.remove(), 3000);
        }

        // Always refresh real-time monitoring with latest data
        setupRealTimeMonitoring(parentPhone, userId);
        addManualRefreshButton();
        addLogoutButton();

    } catch (e) {
        // Silent — parent already sees cached data, no need to show an error
    }
}

async function loadAllReportsForParent(parentPhone, userId, forceRefresh = false) {
    const reportContent = document.getElementById('reportContent');
    const authLoader    = document.getElementById('authLoader');
    const authArea      = document.getElementById('authArea');
    const reportArea    = document.getElementById('reportArea');

    // ── STEP 1: Try persistent cache first ───────────────────────────────────
    if (!forceRefresh) {
        const cached = persistentCache.get(userId);
        if (cached) {
            // Show cached data instantly — no spinner, no wait
            if (authArea)   authArea.classList.add('hidden');
            if (reportArea) reportArea.classList.remove('hidden');
            if (authLoader) authLoader.classList.add('hidden');
            localStorage.setItem('isAuthenticated', 'true');

            renderReportData(
                cached.userData,
                cached.assessmentResults,
                cached.monthlyResults,
                parentPhone,
                userId
            );

            // ── STEP 2: Silently refresh in background ────────────────────────
            setTimeout(() => {
                backgroundRefreshReports(
                    parentPhone,
                    userId,
                    cached.assessmentResults.length,
                    cached.monthlyResults.length
                );
            }, 1500); // small delay so the render completes first

            // Pre-load all other tabs so they're instant on first click
            preloadAllTabs(userId, cached.userData);

            return;
        }
    }

    // ── STEP 3: No cache — normal load with spinner ───────────────────────────
    if (auth.currentUser && authArea && reportArea) {
        authArea.classList.add('hidden');
        reportArea.classList.remove('hidden');
        localStorage.setItem('isAuthenticated', 'true');
    }
    if (authLoader) authLoader.classList.remove('hidden');
    showSkeletonLoader('reportContent', 'dashboard');

    try {
        const userDoc = await db.collection('parent_users').doc(userId).get();
        if (!userDoc.exists) throw new Error('User profile not found');
        const userData = userDoc.data();

        const searchResults = await searchAllReportsForParent(parentPhone, userData.email || '', userId);
        const { assessmentResults, monthlyResults } = searchResults;

        // Save to persistent cache for next login
        persistentCache.set(userId, {
            parentName: userData.parentName || 'Parent',
            email:      userData.email      || ''
        }, assessmentResults, monthlyResults);

        renderReportData(userData, assessmentResults, monthlyResults, parentPhone, userId);

        // Pre-load all other tabs in background so they're instant on first click
        preloadAllTabs(userId, userData);

        setTimeout(() => {
            setupRealTimeMonitoring(parentPhone, userId);
            addManualRefreshButton();
            addLogoutButton();
        }, 100);

    } catch (error) {
        console.error('❌ PARALLEL LOAD Error:', error);
        if (reportContent) {
            reportContent.innerHTML = `
                <div class="bg-gradient-to-r from-red-50 to-orange-50 border-l-4 border-red-500 p-6 rounded-xl shadow-md">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <span class="text-2xl text-red-600">⚠️</span>
                            </div>
                        </div>
                        <div class="ml-4">
                            <h3 class="text-lg font-bold text-red-800">System Error</h3>
                            <p class="text-sm text-red-700 mt-1">We encountered an issue loading your dashboard: ${safeText(error.message)}</p>
                            <div class="mt-4">
                                <button onclick="window.location.reload()" 
                                        class="bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors duration-200">
                                    🔄 Reload Page
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
        }
    } finally {
        if (authLoader) authLoader.classList.add('hidden');
    }
}

// ============================================================================
// SECTION 15: UNIFIED AUTH MANAGER
// ============================================================================

class UnifiedAuthManager {
    constructor() {
        this.currentUser = null;
        this.authListener = null;
        this.isInitialized = false;
        this.isProcessing = false;
        this.lastProcessTime = 0;
        this.DEBOUNCE_MS = 2000;
    }

    initialize() {
        if (this.isInitialized) {
            return;
        }


        this.cleanup();

        this.authListener = auth.onAuthStateChanged(
            (user) => this.handleAuthChange(user),
            (error) => this.handleAuthError(error)
        );

        this.isInitialized = true;
    }

    async handleAuthChange(user) {
        const now = Date.now();
        const timeSinceLastProcess = now - this.lastProcessTime;

        if (this.isProcessing) {
            return;
        }

        if (timeSinceLastProcess < this.DEBOUNCE_MS) {
            return;
        }

        this.isProcessing = true;
        this.lastProcessTime = now;

        try {
            if (user && user.uid) {
                await this.loadUserDashboard(user);
            } else {
                this.showAuthScreen();
            }
        } catch (error) {
            console.error("❌ Auth change error:", error);
            showMessage("Authentication error. Please refresh.", "error");
        } finally {
            setTimeout(() => {
                this.isProcessing = false;
            }, 1000);
        }
    }

    handleAuthError(error) {
        console.error("❌ Auth listener error:", error);
        showMessage("Authentication error occurred", "error");
    }

    async loadUserDashboard(user) {

        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");
        const authLoader = document.getElementById("authLoader");

        if (authLoader) authLoader.classList.remove("hidden");

        try {
            // PARALLEL DATA LOADING
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                throw new Error("User profile not found");
            }

            const userData = userDoc.data();
            this.currentUser = {
                uid: user.uid,
                email: userData.email,
                phone: userData.phone,
                normalizedPhone: userData.normalizedPhone || userData.phone,
                parentName: userData.parentName || 'Parent',
                referralCode: userData.referralCode
            };


            // ONE-TIME backfill for existing parents: attach email to student records
            // that were created before they signed up. Runs only once per account,
            // guarded by the `emailBackfilled` flag on their parent_users doc.
            if (!userData.emailBackfilled) {
                attachEmailToMatchingStudentRecords(
                    this.currentUser.normalizedPhone,
                    this.currentUser.email
                ).then(count => {
                    // Mark as done so this never runs again
                    db.collection('parent_users').doc(user.uid).update({ emailBackfilled: true })
                        .catch(e => console.warn('Could not set emailBackfilled flag:', e.message));
                }).catch(err =>
                    console.warn('Non-critical: email back-fill on login failed:', err.message)
                );
            }

            // Update UI immediately
            this.showDashboardUI();

            // Load remaining data in parallel (lazy-load academics on tab switch)
            await Promise.all([
                loadAllReportsForParent(this.currentUser.normalizedPhone, user.uid),
                loadReferralRewards(user.uid),
                checkForNewAcademics() // Only check badge count, don't load full data
            ]);

            // Setup monitoring and UI
            this.setupRealtimeMonitoring();
            this.setupUIComponents();


        } catch (error) {
            console.error("❌ Dashboard load error:", error);
            showMessage(error.message || "Failed to load dashboard", "error");
            this.showAuthScreen();
        } finally {
            if (authLoader) authLoader.classList.add("hidden");
        }
    }

    showDashboardUI() {
        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");
        const welcomeMessage = document.getElementById("welcomeMessage");

        if (authArea) authArea.classList.add("hidden");
        if (reportArea) reportArea.classList.remove("hidden");
        
        if (welcomeMessage && this.currentUser) {
            welcomeMessage.textContent = `Welcome, ${this.currentUser.parentName}!`;
        }

        // ── NEW: populate header greeting and show header actions ──
        const headerActions  = document.getElementById("headerActions");
        const headerGreeting = document.getElementById("headerGreeting");
        if (headerGreeting && this.currentUser) {
            headerGreeting.textContent = `Hello, ${this.currentUser.parentName.split(' ')[0]}! 👋`;
        }
        if (headerActions) headerActions.style.display = "flex";

        // ── NEW: ensure the Reports tab is visually active on first load ──
        const reportTab = document.getElementById("reportTab");
        if (reportTab) {
            reportTab.classList.add("active");
            reportTab.classList.remove("tab-inactive-main");
            reportTab.classList.add("tab-active-main");
        }

        localStorage.setItem('isAuthenticated', 'true');

        // ── Inject FAB (Feedback / Responses floating button) ──
        if (typeof initFab === 'function') initFab();
    }

    showAuthScreen() {
        const authArea = document.getElementById("authArea");
        const reportArea = document.getElementById("reportArea");

        if (authArea) authArea.classList.remove("hidden");
        if (reportArea) reportArea.classList.add("hidden");

        localStorage.removeItem('isAuthenticated');
        cleanupRealTimeListeners();
    }

    setupRealtimeMonitoring() {
        if (this.currentUser) {
            setupRealTimeMonitoring(this.currentUser.normalizedPhone, this.currentUser.uid);
        }
    }

    setupUIComponents() {
        addManualRefreshButton();
        addLogoutButton();
    }

    cleanup() {
        if (this.authListener && typeof this.authListener === 'function') {
            this.authListener();
            this.authListener = null;
        }
        this.isInitialized = false;
    }

    async reloadDashboard() {
        if (!this.currentUser) {
            console.warn("⚠️ No user to reload dashboard for");
            return;
        }

        await loadAllReportsForParent(this.currentUser.normalizedPhone, this.currentUser.uid, true);
    }
}

const authManager = new UnifiedAuthManager();

// ============================================================================
// SECTION 16: NAVIGATION BUTTONS & DYNAMIC UI
// ============================================================================

// MANUAL REFRESH FUNCTION
async function manualRefreshReportsV2() {
    const user = auth.currentUser;
    if (!user) return;
    
    const refreshBtn = document.getElementById('manualRefreshBtn');
    if (!refreshBtn) return;
    
    const originalText = refreshBtn.innerHTML;
    
    // Show loading state
    refreshBtn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Checking...';
    refreshBtn.disabled = true;
    
    try {
        if (window.authManager && typeof window.authManager.reloadDashboard === 'function') {
            await window.authManager.reloadDashboard();
        } else {
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const userPhone = userData.normalizedPhone || userData.phone;
                await loadAllReportsForParent(userPhone, user.uid, true);
            }
        }
        
        await checkForNewAcademics();
        
        showMessage('Reports refreshed successfully!', 'success');
    } catch (error) {
        console.error('Manual refresh error:', error);
        showMessage('Refresh failed. Please try again.', 'error');
    } finally {
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
}

// ADD MANUAL REFRESH BUTTON
function addManualRefreshButton() {
    // In the new design the refresh is triggered from the welcome bar or can
    // be a floating button; skip DOM injection if the new layout is detected.
    if (document.querySelector('.dashboard-welcome-bar')) return;

    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer) return;
    
    if (document.getElementById('manualRefreshBtn')) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'manualRefreshBtn';
    refreshBtn.onclick = manualRefreshReportsV2;
    refreshBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 btn-glow flex items-center justify-center';
    refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Check for New Reports';
    
    const logoutBtn = buttonContainer.querySelector('button[onclick="logout()"]');
    if (logoutBtn) {
        buttonContainer.insertBefore(refreshBtn, logoutBtn);
    } else {
        buttonContainer.appendChild(refreshBtn);
    }
}

// ADD LOGOUT BUTTON
function addLogoutButton() {
    // New design already has logout buttons inline — skip injection
    if (document.querySelector('.dashboard-welcome-bar')) return;

    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer) return;
    
    if (buttonContainer.querySelector('button[onclick="logout()"]')) return;
    
    const logoutBtn = document.createElement('button');
    logoutBtn.onclick = logout;
    logoutBtn.className = 'bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-all duration-200 btn-glow flex items-center justify-center';
    logoutBtn.innerHTML = '<span class="mr-2">🚪</span> Logout';
    
    buttonContainer.appendChild(logoutBtn);
}

// Pure HTML builder for settings — no DOM reads or writes.
// Used by both renderSettingsForm (live render) and _preloadSettingsCache (background).
function _buildSettingsHtml(userData, students) {
    let html = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="md:col-span-1 space-y-6">
                <h3 class="text-lg font-bold text-gray-800 border-b pb-2">Parent Profile</h3>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                    <input type="text" id="settingParentName" value="${safeText(userData.parentName || 'Parent')}"
                        class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Primary Phone (Login)</label>
                    <input type="text" value="${safeText(userData.phone)}" disabled
                        class="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed">
                    <p class="text-xs text-gray-500 mt-1">To change login phone, please contact support.</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input type="email" id="settingParentEmail" value="${safeText(userData.email || '')}"
                        class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                </div>
                <button onclick="window.settingsManager.saveParentProfile()"
                    class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    Update My Profile
                </button>
            </div>
            <div class="md:col-span-2 space-y-6">
                <h3 class="text-lg font-bold text-gray-800 border-b pb-2">Children & Linked Contacts</h3>
                ${students.length === 0 ? '<p class="text-gray-500 italic">No students linked yet.</p>' : ''}
                <div class="space-y-6">`;

    students.forEach((student) => {
        const data         = student.data;
        const gender       = data.gender       || '';
        const motherPhone  = data.motherPhone  || '';
        const fatherPhone  = data.fatherPhone  || '';
        const guardianEmail = data.guardianEmail || '';
        html += `
            <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Student Name</label>
                        <input type="text" id="studentName_${student.id}" value="${safeText(student.name)}"
                            class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 font-semibold text-gray-800">
                    </div>
                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Gender</label>
                        <select id="studentGender_${student.id}" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 bg-white">
                            <option value="" ${gender===''?'selected':''}>Select Gender...</option>
                            <option value="Male" ${gender==='Male'?'selected':''}>Male</option>
                            <option value="Female" ${gender==='Female'?'selected':''}>Female</option>
                        </select>
                    </div>
                    <div class="col-span-2 border-t border-gray-200 pt-3 mt-1">
                        <p class="text-sm font-semibold text-blue-800 mb-2">📞 Additional Contacts (For Access)</p>
                        <p class="text-xs text-gray-500 mb-3">Add Father/Mother numbers here. Anyone with these numbers can log in or view reports.</p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs text-gray-500">Mother's Phone</label>
                                <input type="tel" id="motherPhone_${student.id}" value="${safeText(motherPhone)}" placeholder="+1..."
                                    class="w-full px-3 py-1.5 border rounded text-sm">
                            </div>
                            <div>
                                <label class="block text-xs text-gray-500">Father's Phone</label>
                                <input type="tel" id="fatherPhone_${student.id}" value="${safeText(fatherPhone)}" placeholder="+1..."
                                    class="w-full px-3 py-1.5 border rounded text-sm">
                            </div>
                            <div class="col-span-2">
                                <label class="block text-xs text-gray-500">Secondary Email (CC for Reports)</label>
                                <input type="email" id="guardianEmail_${student.id}" value="${safeText(guardianEmail)}"
                                    class="w-full px-3 py-1.5 border rounded text-sm">
                            </div>
                        </div>
                    </div>
                    <div class="col-span-2 mt-2 flex justify-end">
                        <button onclick="window.settingsManager.updateStudent('${student.id}', '${student.collection}')"
                            class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center">
                            <span>💾 Save ${safeText(student.name)}'s Details</span>
                        </button>
                    </div>
                </div>
            </div>`;
    });

    html += `</div></div></div>`;
    return html;
}

// ============================================================================
// SECTION 17: SETTINGS MANAGER
// ============================================================================

class SettingsManager {
    constructor() {
        this.isActive = false;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.injectSettingsUI());
        } else {
            this.injectSettingsUI();
        }
    }

    injectSettingsUI() {
        const navContainer = document.querySelector('.bg-green-50 .flex.gap-2');
        
        if (navContainer && !document.getElementById('settingsBtn')) {
            const settingsBtn = document.createElement('button');
            settingsBtn.id = 'settingsBtn';
            settingsBtn.onclick = () => this.openSettingsTab();
            settingsBtn.className = 'bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-all duration-200 btn-glow flex items-center justify-center';
            settingsBtn.innerHTML = '<span class="mr-2">⚙️</span> Settings';
            
            const logoutBtn = navContainer.querySelector('button[onclick="logout()"]');
            if (logoutBtn) {
                navContainer.insertBefore(settingsBtn, logoutBtn);
            } else {
                navContainer.appendChild(settingsBtn);
            }
        }

        const mainContainer = document.getElementById('reportArea');
        if (mainContainer && !document.getElementById('settingsContentArea')) {
            const settingsDiv = document.createElement('div');
            settingsDiv.id = 'settingsContentArea';
            settingsDiv.className = 'hidden max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in';
            settingsDiv.innerHTML = `
                <div class="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div class="bg-gray-800 px-6 py-4 flex justify-between items-center">
                        <h2 class="text-xl font-bold text-white flex items-center">
                            <span class="mr-2">⚙️</span> Family Profile & Settings
                        </h2>
                        <button onclick="switchMainTab('reports')" class="text-gray-300 hover:text-white text-sm">
                            ← Back to Dashboard
                        </button>
                    </div>
                    <div id="settingsDynamicContent" class="p-6">
                        <div class="loading-spinner mx-auto"></div>
                    </div>
                </div>
            `;
            mainContainer.appendChild(settingsDiv);
        }
    }

    openSettingsTab() {
        ['reportContentArea', 'academicsContentArea', 'rewardsContentArea'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        
        ['reportTab', 'academicsTab', 'rewardsTab'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.classList.remove('tab-active-main');
                el.classList.add('tab-inactive-main');
            }
        });

        const settingsArea = document.getElementById('settingsContentArea');
        if (settingsArea) {
            settingsArea.classList.remove('hidden');
            this.loadSettingsData();
        }
    }

    async loadSettingsData() {
        const content = document.getElementById('settingsDynamicContent');
        const user = auth.currentUser;
        if (!user) return;

        // ── Show cache instantly (4h TTL — settings rarely change) ───────────
        const cached = persistentCache.getTab(user.uid, 'settings', 4 * 60 * 60 * 1000);
        if (cached && !window._settingsForceRefresh) {
            if (content) content.innerHTML = cached.html;
            setTimeout(() => this._silentRefreshSettings(user.uid), 2000);
            return;
        }
        window._settingsForceRefresh = false;

        // ── No cache — full load ─────────────────────────────────────────────
        try {
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            const userData = userDoc.data();
            const childrenResult = await comprehensiveFindChildren(userData.normalizedPhone || userData.phone, userData.email || '');
            const students = childrenResult.allStudentData;
            this.renderSettingsForm(userData, students);
            // Cache the rendered HTML
            if (content) persistentCache.setTab(user.uid, 'settings', { html: content.innerHTML });
        } catch (error) {
            console.error("Settings load error:", error);
            if (content) content.innerHTML = `<p class="text-red-500">Error loading settings: ${error.message}</p>`;
        }
    }

    async _silentRefreshSettings(userId) {
        try {
            const user = auth.currentUser;
            if (!user || user.uid !== userId) return;
            const userDoc = await db.collection('parent_users').doc(userId).get();
            const userData = userDoc.data();
            const childrenResult = await comprehensiveFindChildren(userData.normalizedPhone || userData.phone, userData.email || '');
            const cached = persistentCache.getTab(userId, 'settings', 4 * 60 * 60 * 1000);
            const cachedStudentCount = (cached?.html?.match(/studentName_/g) || []).length;
            if (childrenResult.allStudentData.length !== cachedStudentCount) {
                persistentCache.invalidateTab(userId, 'settings');
                window._settingsForceRefresh = true;
                this.loadSettingsData();
            }
        } catch (e) { /* silent */ }
    }

    renderSettingsForm(userData, students) {
        const content = document.getElementById('settingsDynamicContent');
        if (content) content.innerHTML = _buildSettingsHtml(userData, students);
    }

    async saveParentProfile() {
        const user = auth.currentUser;
        if (!user) return;

        const name = document.getElementById('settingParentName').value.trim();
        const email = document.getElementById('settingParentEmail').value.trim();

        if (!name) return showMessage('Name is required', 'error');

        try {
            const btn = document.querySelector('button[onclick="window.settingsManager.saveParentProfile()"]');
            const originalText = btn ? btn.innerHTML : 'Update My Profile';
            
            if (btn) {
                btn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Saving...';
                btn.disabled = true;
            }

            await db.collection('parent_users').doc(user.uid).update({
                parentName: name,
                email: email
            });

            // Invalidate settings cache so next visit shows fresh data
            persistentCache.invalidateTab(user.uid, 'settings');

            const welcomeMsg = document.getElementById('welcomeMessage');
            if (welcomeMsg) welcomeMsg.textContent = `Welcome, ${name}!`;

            showMessage('Profile updated successfully!', 'success');
            
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (error) {
            console.error(error);
            showMessage('Failed to update profile.', 'error');
        }
    }

    async updateStudent(studentId, collectionName) {
        try {
            const nameInput = document.getElementById(`studentName_${studentId}`);
            const genderInput = document.getElementById(`studentGender_${studentId}`);
            const motherInput = document.getElementById(`motherPhone_${studentId}`);
            const fatherInput = document.getElementById(`fatherPhone_${studentId}`);
            const emailInput = document.getElementById(`guardianEmail_${studentId}`);

            const newName = nameInput.value.trim();
            const gender = genderInput.value;
            const motherPhone = motherInput.value.trim();
            const fatherPhone = fatherInput.value.trim();
            const email = emailInput.value.trim();

            if (!newName) return showMessage('Student name cannot be empty', 'error');

            const btn = document.querySelector(`button[onclick="window.settingsManager.updateStudent('${studentId}', '${collectionName}')"]`);
            const originalText = btn ? btn.innerHTML : 'Save Details';
            
            if (btn) {
                btn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Updating Everywhere...';
                btn.disabled = true;
            }

            const updateData = {
                studentName: newName,
                name: newName,
                gender: gender,
                motherPhone: motherPhone,
                fatherPhone: fatherPhone,
                guardianEmail: email,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection(collectionName).doc(studentId).update(updateData);

            // Invalidate caches so next visit shows updated student data
            if (auth.currentUser) {
                persistentCache.invalidateTab(auth.currentUser.uid, 'settings');
                persistentCache.invalidateTab(auth.currentUser.uid, 'academics');
            }

            this.propagateStudentNameChange(studentId, newName);

            showMessage(`${newName}'s details updated successfully!`, 'success');
            
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }

            if (window.authManager) {
                setTimeout(() => window.authManager.reloadDashboard(), 1000);
            }

        } catch (error) {
            console.error("Update error:", error);
            showMessage('Error updating student details.', 'error');
        }
    }

    async propagateStudentNameChange(studentId, newName) {
        
        const collections = ['tutor_submissions', 'student_results'];
        
        for (const col of collections) {
            try {
                const snapshot = await db.collection(col)
                    .where('studentId', '==', studentId)
                    .limit(50)
                    .get();

                if (!snapshot.empty) {
                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        const ref = db.collection(col).doc(doc.id);
                        batch.update(ref, { 
                            studentName: newName,
                            student: newName 
                        });
                    });
                    await batch.commit();
                }
            } catch (err) {
                console.warn(`Background update for ${col} failed:`, err);
            }
        }
    }
}

// Initialize settings manager
let settingsManager = new SettingsManager();

// ============================================================================
// SECTION 18: GOOGLE CLASSROOM HOMEWORK
// ============================================================================

const CLOUDINARY_CONFIG = {
    cloudName: 'dwjq7j5zp',
    uploadPreset: 'tutor_homework'
};

// Inject dependencies
(function() {
    if (!document.getElementById('cloudinary-script')) {
        const script = document.createElement('script');
        script.id = 'cloudinary-script';
        script.src = 'https://upload-widget.cloudinary.com/global/all.js';
        document.head.appendChild(script);
    }

    const style = document.createElement('style');
    style.textContent = `
        .gc-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 9999; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(4px); animation: fadeIn 0.2s; }
        .gc-modal-container { background: #fff; width: 90%; max-width: 1000px; height: 90vh; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.2); }
        .gc-header { padding: 16px 24px; border-bottom: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }
        .gc-body { display: flex; flex: 1; overflow-y: auto; background: #fff; }
        .gc-main { flex: 1; padding: 24px; border-right: 1px solid #f0f0f0; }
        .gc-sidebar { width: 350px; padding: 24px; background: #fff; }
        .gc-title { font-size: 2rem; color: #1967d2; margin-bottom: 8px; font-weight: 400; }
        .gc-card { background: #fff; border: 1px solid #dadce0; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgba(60,64,67,0.3); margin-bottom: 16px; }
        .gc-btn-add { display: flex; align-items: center; justify-content: center; width: 100%; padding: 10px; margin-bottom: 10px; background: #fff; border: 1px solid #dadce0; border-radius: 4px; color: #1967d2; font-weight: 500; cursor: pointer; transition: 0.2s; }
        .gc-btn-add:hover { background: #f8f9fa; color: #174ea6; }
        .gc-btn-primary { width: 100%; padding: 10px; background: #1967d2; border: none; border-radius: 4px; color: #fff; font-weight: 500; cursor: pointer; transition: 0.2s; }
        .gc-btn-primary:hover { background: #185abc; }
        .gc-btn-primary:disabled { background: #e0e0e0; cursor: not-allowed; }
        .gc-btn-unsubmit { width: 100%; padding: 10px; background: #fff; border: 1px solid #dadce0; border-radius: 4px; color: #3c4043; font-weight: 500; cursor: pointer; margin-top: 10px; }
        .gc-btn-unsubmit:hover { background: #f1f3f4; }
        .gc-attachment { display: flex; align-items: center; border: 1px solid #dadce0; border-radius: 4px; padding: 8px; margin-bottom: 12px; cursor: pointer; }
        .gc-att-icon { width: 36px; height: 36px; background: #f1f3f4; color: #1967d2; display: flex; align-items: center; justify-content: center; margin-right: 12px; border-radius: 4px; }
        .gc-inject-btn { transition: opacity 0.3s; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 768px) { .gc-body { flex-direction: column; } .gc-sidebar { width: 100%; border-top: 1px solid #e0e0e0; } }
    `;
    document.head.appendChild(style);
})();

let homeworkListenerUnsub = null;

function openGoogleClassroomModal(initialHwData, studentId) {
    document.body.style.overflow = 'hidden';
    
    const modalHTML = `
        <div class="gc-modal-overlay" id="gcModal">
            <div class="gc-modal-container">
                <div class="gc-header">
                    <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-100 rounded-full text-blue-600">
                            <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" /></svg>
                        </div>
                        <span class="font-medium text-gray-600">Assignment Details</span>
                    </div>
                    <button onclick="closeGoogleClassroomModal()" class="text-2xl text-gray-500 hover:text-black transition-colors">×</button>
                </div>
                <div class="gc-body" id="gcBodyContent">
                    <div class="flex justify-center items-center h-full w-full"><div class="loading-spinner"></div></div>
                </div>
            </div>
        </div>`;
    
    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    document.body.appendChild(div.firstElementChild);

    const hwRef = db.collection('homework_assignments').doc(initialHwData.id);
    homeworkListenerUnsub = hwRef.onSnapshot((doc) => {
        if (doc.exists) {
            const freshData = { id: doc.id, ...doc.data() };
            if (!freshData.dueTimestamp && freshData.dueDate) {
                freshData.dueTimestamp = getTimestamp(freshData.dueDate);
            }
            renderGoogleClassroomContent(freshData, studentId);
        }
    });
}

function renderGoogleClassroomContent(homework, studentId) {
    const container = document.getElementById('gcBodyContent');
    if (!container) return;

    const isGraded = homework.status === 'graded';
    const isSubmitted = ['submitted', 'completed', 'graded'].includes(homework.status);
    const now = Date.now();
    const isOverdue = !isSubmitted && homework.dueTimestamp && homework.dueTimestamp < now;

    let statusText = 'Assigned';
    let statusClass = 'text-green-700';

    if (isGraded) { statusText = 'Graded'; statusClass = 'text-black font-bold'; }
    else if (isSubmitted) { statusText = 'Handed in'; statusClass = 'text-green-700 font-bold'; }
    else if (isOverdue) { statusText = 'Missing'; statusClass = 'text-red-600 font-bold'; }

    container.innerHTML = `
        <div class="gc-main">
            <h1 class="gc-title">${safeText(homework.title || homework.subject)}</h1>
            <div class="text-gray-500 text-sm mb-6 flex gap-3">
                <span>${safeText(homework.tutorName || 'Tutor')}</span> • 
                <span>Due ${formatDetailedDate(homework.dueTimestamp)}</span> • 
                <span class="${statusClass}">${statusText}</span>
            </div>
            <div class="border-b mb-6"></div>
            
            <div class="text-gray-800 leading-relaxed whitespace-pre-wrap mb-8">
                ${safeText(homework.description || homework.instructions || 'No instructions provided.')}
            </div>
            
            ${homework.fileUrl ? `
                <div class="mt-4">
                    <h4 class="text-sm font-medium text-gray-500 mb-2">Reference Materials</h4>
                    <a href="${sanitizeUrl(homework.fileUrl)}" target="_blank" rel="noopener noreferrer" class="gc-attachment hover:bg-gray-50">
                        <div class="gc-att-icon">📎</div>
                        <div class="text-sm font-medium text-blue-900 truncate flex-1">Download Assignment File</div>
                    </a>
                </div>` : ''}
        </div>

        <div class="gc-sidebar">
            <div class="gc-card">
                <div class="flex justify-between items-start mb-4">
                    <h2 class="text-lg font-medium text-gray-800">Your work</h2>
                    <div class="text-xs uppercase font-bold ${statusClass}">${statusText}</div>
                </div>

                <div id="gc-file-area" class="mb-4">
                    ${homework.submissionUrl ? `
                        <div class="gc-attachment">
                            <div class="gc-att-icon">📄</div>
                            <div class="flex-1 truncate text-sm">Submitted File</div>
                            <a href="${sanitizeUrl(homework.submissionUrl)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 text-xs font-bold px-2">VIEW</a>
                        </div>` : ''}
                </div>

                ${!isSubmitted ? `
                    <button class="gc-btn-add" onclick="triggerCloudinaryUpload('${homework.id}', '${studentId}')">
                        <span class="mr-2 text-xl">+</span> Add or create
                    </button>
                    <button id="btn-turn-in" class="gc-btn-primary" 
                        onclick="submitHomeworkToFirebase('${homework.id}')" ${!homework.submissionUrl ? 'disabled style="opacity:0.5"' : ''}>
                        Mark as done
                    </button>
                    <p class="text-xs text-gray-500 mt-2 text-center">Upload a file to enable submission</p>
                ` : `
                    ${isGraded ? `
                        <div class="text-center py-4 bg-gray-50 rounded border border-gray-200">
                            <div class="text-3xl font-bold text-gray-800">${homework.grade || homework.score || '-'}%</div>
                            <div class="text-xs text-gray-500">Overall Grade</div>
                        </div>
                    ` : `
                        <button class="gc-btn-unsubmit" onclick="unsubmitHomework('${homework.id}')">Unsubmit</button>
                        <p class="text-xs text-gray-500 mt-2 text-center">Unsubmit to add or change attachments.</p>
                    `}
                `}
            </div>

            ${homework.feedback ? `
                <div class="gc-card mt-4">
                    <h2 class="text-sm font-medium mb-2">Private comments</h2>
                    <div class="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-100">${safeText(homework.feedback)}</div>
                    <div class="text-xs text-gray-400 mt-1 text-right">From Tutor</div>
                </div>` : ''}
        </div>
    `;
}

function closeGoogleClassroomModal() {
    if (homeworkListenerUnsub) homeworkListenerUnsub();
    const modal = document.getElementById('gcModal');
    if (modal) modal.remove();
    document.body.style.overflow = 'auto';
}

function triggerCloudinaryUpload(homeworkId, studentId) {
    if (!window.cloudinary) {
        showMessage('Upload widget is loading. Please try again in a few seconds.', 'error');
        return;
    }
    
    const widget = cloudinary.createUploadWidget({
        cloudName: CLOUDINARY_CONFIG.cloudName,
        uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
        sources: ['local', 'camera', 'google_drive'],
        folder: `homework_submissions/${studentId}`,
        tags: [homeworkId, 'homework_submission'],
        multiple: false
    }, async (error, result) => {
        if (!error && result && result.event === "success") {
            await db.collection('homework_assignments').doc(homeworkId).update({
                submissionUrl: result.info.secure_url,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showMessage('File uploaded!', 'success');
        } else if (error) {
            showMessage('Upload failed. Please try again.', 'error');
        }
    });
    widget.open();
}

async function submitHomeworkToFirebase(homeworkId) {
    if (!confirm("Are you ready to turn in your work?")) return;
    
    const btn = document.getElementById('btn-turn-in');
    if(btn) { btn.disabled = true; btn.textContent = "Turning in..."; }

    try {
        await db.collection('homework_assignments').doc(homeworkId).update({
            status: 'submitted',
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            submissionDate: new Date().toISOString()
        });
        showMessage('Assignment turned in!', 'success');
    } catch (e) {
        console.error(e);
        showMessage('Error turning in work.', 'error');
        if(btn) { btn.disabled = false; btn.textContent = "Mark as done"; }
    }
}

async function unsubmitHomework(homeworkId) {
    if (!confirm("Unsubmit this assignment?")) return;
    await db.collection('homework_assignments').doc(homeworkId).update({
        status: 'assigned',
        submissionUrl: firebase.firestore.FieldValue.delete()
    });
}

// RELIABLE SCANNER
function scanAndInjectButtons() {
    const cards = document.querySelectorAll('#academicsContent .bg-white.border.rounded-lg');

    cards.forEach(card => {
        if (card.querySelector('.gc-inject-btn')) return;

        const textContent = card.textContent || "";
        if (!textContent.includes('Due:')) return;

        // Read the homework doc ID and student ID stamped on the card at render time.
        // This avoids title-based lookups (which break on special characters or
        // subject-only docs) and wrong-student lookups when "All Students" is shown.
        const homeworkId = card.dataset.homeworkId;
        const studentId  = card.dataset.studentId;

        if (!homeworkId || !studentId) {
            // Card was rendered without data attributes — fall back to title approach
            const btnContainer = document.createElement('div');
            btnContainer.className = 'mt-4 pt-3 border-t border-gray-100 flex justify-end gc-inject-btn fade-in';
            btnContainer.innerHTML = `
                <button class="flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm group">
                    <span class="group-hover:scale-110 transition-transform">📤</span> 
                    <span>Turn In / View Details</span>
                </button>
            `;
            const btn = btnContainer.querySelector('button');
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const titleEl = card.querySelector('h5');
                const titleText = titleEl ? titleEl.textContent.trim() : '';
                if (titleText) findAndOpenHomework(titleText);
            };
            card.appendChild(btnContainer);
            return;
        }

        const btnContainer = document.createElement('div');
        btnContainer.className = 'mt-4 pt-3 border-t border-gray-100 flex justify-end gc-inject-btn fade-in';
        btnContainer.innerHTML = `
            <button class="flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm group">
                <span class="group-hover:scale-110 transition-transform">📤</span> 
                <span>Turn In / View Details</span>
            </button>
        `;

        const btn = btnContainer.querySelector('button');
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openHomeworkById(homeworkId, studentId);
        };

        card.appendChild(btnContainer);
    });
}

function findAndOpenHomework(titleText) {
    const selector = document.getElementById('studentSelector');
    let studentName = selector ? selector.value : null;
    if (!studentName && userChildren.length > 0) studentName = userChildren[0];
    
    if (!studentName) {
        showMessage('Please select a student first.', 'error');
        return;
    }
    
    const studentId = studentIdMap.get(studentName);
    if (!studentId) {
        showMessage('Student ID not found.', 'error');
        return;
    }

    showMessage('Opening classroom...', 'success');

    db.collection('homework_assignments')
        .where('studentId', '==', studentId)
        .where('title', '==', titleText)
        .limit(1)
        .get()
        .then(snapshot => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const hwData = { id: doc.id, ...doc.data() };
                if (!hwData.dueTimestamp && hwData.dueDate) {
                    hwData.dueTimestamp = getTimestamp(hwData.dueDate);
                }
                openGoogleClassroomModal(hwData, studentId);
            } else {
                db.collection('homework_assignments')
                    .where('studentId', '==', studentId)
                    .get()
                    .then(snap => {
                        const found = snap.docs.find(d => {
                            const dData = d.data();
                            return (dData.title || dData.subject) === titleText;
                        });
                        if (found) {
                            const hwData = { id: found.id, ...found.data() };
                            if (!hwData.dueTimestamp && hwData.dueDate) {
                                hwData.dueTimestamp = getTimestamp(hwData.dueDate);
                            }
                            openGoogleClassroomModal(hwData, studentId);
                        } else {
                            showMessage('Could not find assignment details.', 'error');
                        }
                    });
            }
        })
        .catch(err => {
            console.error("Error finding homework:", err);
            showMessage('Error loading assignment.', 'error');
        });
}

// Direct lookup by Firestore doc ID + student ID.
// Used by scanAndInjectButtons when data attributes are available on the card.
// Never fails due to title mismatch or wrong-student selection.
function openHomeworkById(homeworkId, studentId) {
    showMessage('Opening classroom...', 'success');

    db.collection('homework_assignments')
        .doc(homeworkId)
        .get()
        .then(doc => {
            if (!doc.exists) {
                showMessage('Could not find assignment details.', 'error');
                return;
            }
            const hwData = { id: doc.id, ...doc.data() };
            if (!hwData.dueTimestamp && hwData.dueDate) {
                hwData.dueTimestamp = getTimestamp(hwData.dueDate);
            }
            openGoogleClassroomModal(hwData, studentId);
        })
        .catch(err => {
            console.error("Error loading homework by ID:", err);
            showMessage('Error loading assignment.', 'error');
        });
}

// ============================================================================
// SECTION 19: HELPER FUNCTIONS
// ============================================================================

async function checkForNewAcademics() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        // ── Use academics cache if available — zero reads needed ─────────────
        const cached = persistentCache.getTab(user.uid, 'academics', 30 * 60 * 1000);
        if (cached) {
            // Count unread items from cached HTML (homework cards from last 7 days)
            // If there's any academics content, show a badge
            const homeworkCount = (cached.html.match(/data-homework-id=/g) || []).length;
            updateAcademicsTabBadge(homeworkCount > 0 ? homeworkCount : 0);
            return;
        }

        // ── No cache — do normal Firestore reads ─────────────────────────────
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();
        const parentPhone = userData.normalizedPhone || userData.phone;

        const childrenResult = await comprehensiveFindChildren(parentPhone, userData.email || '');
        
        let totalUnread = 0;

        for (const [studentName, studentId] of childrenResult.studentNameIdMap) {
            try {
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                
                const [sessionTopicsSnapshot, homeworkSnapshot] = await Promise.all([
                    db.collection('daily_topics').where('studentId', '==', studentId).get(),
                    db.collection('homework_assignments').where('studentId', '==', studentId).get()
                ]);
                
                let studentUnread = 0;
                
                sessionTopicsSnapshot.forEach(doc => {
                    const topic = doc.data();
                    const topicDate = topic.date?.toDate?.() || topic.createdAt?.toDate?.() || new Date(0);
                    if (topicDate >= oneWeekAgo) studentUnread++;
                });
                
                homeworkSnapshot.forEach(doc => {
                    const homework = doc.data();
                    const assignedDate = homework.assignedDate?.toDate?.() || homework.createdAt?.toDate?.() || new Date(0);
                    if (assignedDate >= oneWeekAgo) studentUnread++;
                });
                
                totalUnread += studentUnread;
            } catch (error) {
                console.error(`Error checking academics for ${studentName}:`, error);
            }
        }
        
        updateAcademicsTabBadge(totalUnread);

    } catch (error) {
        console.error('Error checking for new academics:', error);
    }
}

function updateAcademicsTabBadge(count) {
    const academicsTab = document.getElementById('academicsTab');
    if (!academicsTab) return;
    
    const existingBadge = academicsTab.querySelector('.academics-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'academics-badge absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs min-w-5 h-5 flex items-center justify-center font-bold animate-pulse px-1';
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.lineHeight = '1rem';
        badge.style.fontSize = '0.7rem';
        badge.style.padding = '0 4px';
        academicsTab.style.position = 'relative';
        academicsTab.appendChild(badge);
    }
}

// ============================================================================
// SECTION 20: INITIALIZATION & UTILITIES
// ============================================================================

function initializeParentPortalV2() {

    setupRememberMe();
    injectCustomCSS();
    createCountryCodeDropdown();
    setupEventListeners();
    setupGlobalErrorHandler();

    // AUTO-LOGIN: Check if coming from enrollment portal
    const newParentData = localStorage.getItem('bkh_new_parent');
    if (newParentData) {
        try {
            const { email, tempPassword } = JSON.parse(newParentData);
            if (email && tempPassword) {
                // CRITICAL: initialize authManager FIRST so its onAuthStateChanged
                // listener is registered before signIn fires the auth state change
                authManager.initialize();

                auth.signInWithEmailAndPassword(email, tempPassword)
                    .then(() => {
                        console.log('✅ Auto-login success — keeping credentials for re-auth');
                        // Do NOT clear bkh_new_parent here —
                        // saveFirstTimePassword() needs it to reauthenticate
                    })
                    .catch((err) => {
                        console.warn('❌ Auto-login failed:', err.code, err.message);
                        localStorage.removeItem('bkh_new_parent');
                    });
                return;
            }
        } catch(e) {
            console.warn('❌ Auto-login parse error:', e.message);
            localStorage.removeItem('bkh_new_parent');
        }
    }

    authManager.initialize();

    window.addEventListener('beforeunload', () => {
        authManager.cleanup();
        cleanupRealTimeListeners();
    });

}

function setupRememberMe() {
    const rememberMe = localStorage.getItem('rememberMe');
    const savedEmail = localStorage.getItem('savedEmail');
    
    if (rememberMe === 'true' && savedEmail) {
        const loginIdentifier = document.getElementById('loginIdentifier');
        const rememberMeCheckbox = document.getElementById('rememberMe');
        
        if (loginIdentifier) {
            loginIdentifier.value = safeText(savedEmail);
        }
        if (rememberMeCheckbox) {
            rememberMeCheckbox.checked = true;
        }
    }
}

function handleRememberMe() {
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const identifier = document.getElementById('loginIdentifier');
    
    if (!rememberMeCheckbox || !identifier) return;
    
    const rememberMe = rememberMeCheckbox.checked;
    const email = identifier.value.trim();
    
    if (rememberMe && email) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedEmail', safeText(email));
    } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedEmail');
    }
}

function handleSignIn() {
    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!identifier || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    const signInBtn = document.getElementById('signInBtn');
    const authLoader = document.getElementById('authLoader');

    if (signInBtn) signInBtn.disabled = true;
    
    const signInText = document.getElementById('signInText');
    const signInSpinner = document.getElementById('signInSpinner');
    if (signInText) signInText.textContent = 'Signing In...';
    if (signInSpinner) signInSpinner.classList.remove('hidden');
    if (authLoader) authLoader.classList.remove('hidden');

    handleSignInFull(identifier, password, signInBtn, authLoader);
}

function handleSignUp() {
    const countryCode = document.getElementById('countryCode')?.value;
    const localPhone = document.getElementById('signupPhone')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim().toLowerCase();
    const password = document.getElementById('signupPassword')?.value;
    const confirmPassword = document.getElementById('signupConfirmPassword')?.value;

    if (!countryCode || !localPhone || !email || !password || !confirmPassword) {
        showMessage('Please fill in all fields including country code', 'error');
        return;
    }

    // Issue 4: Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        showMessage('Please enter a valid email address.', 'error');
        return;
    }

    if (password.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }

    const signUpBtn = document.getElementById('signUpBtn');
    const authLoader = document.getElementById('authLoader');

    signUpBtn.disabled = true;
    document.getElementById('signUpText').textContent = 'Creating Account...';
    document.getElementById('signUpSpinner').classList.remove('hidden');
    authLoader.classList.remove('hidden');

    handleSignUpFull(countryCode, localPhone, email, password, confirmPassword, signUpBtn, authLoader);
}

function handlePasswordReset() {
    const email = document.getElementById('resetEmail')?.value.trim();
    
    if (!email) {
        showMessage('Please enter your email address', 'error');
        return;
    }

    const sendResetBtn = document.getElementById('sendResetBtn');
    const resetLoader = document.getElementById('resetLoader');

    sendResetBtn.disabled = true;
    resetLoader.classList.remove('hidden');

    handlePasswordResetFull(email, sendResetBtn, resetLoader);
}

function switchTab(tab) {
    const signInTab = document.getElementById('signInTab');
    const signUpTab = document.getElementById('signUpTab');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');

    if (tab === 'signin') {
        // Legacy classes
        signInTab?.classList.remove('tab-inactive');
        signInTab?.classList.add('tab-active');
        signUpTab?.classList.remove('tab-active');
        signUpTab?.classList.add('tab-inactive');
        // New auth-tab-btn classes
        signInTab?.classList.add('active');
        signUpTab?.classList.remove('active');
        signInForm?.classList.remove('hidden');
        signUpForm?.classList.add('hidden');
    } else {
        signUpTab?.classList.remove('tab-inactive');
        signUpTab?.classList.add('tab-active');
        signInTab?.classList.remove('tab-active');
        signInTab?.classList.add('tab-inactive');
        // New auth-tab-btn classes
        signUpTab?.classList.add('active');
        signInTab?.classList.remove('active');
        signUpForm?.classList.remove('hidden');
        signInForm?.classList.add('hidden');
    }
}

function switchMainTab(tab) {
    const tabIds = ['reportTab', 'academicsTab', 'rewardsTab', 'paymentsTab', 'settingsTab'];
    const areaIds = ['reportContentArea', 'academicsContentArea', 'rewardsContentArea', 'paymentsContentArea', 'settingsContentArea'];

    // Remove active from all tabs
    tabIds.forEach(id => {
        const btn = document.getElementById(id);
        btn?.classList.remove('tab-active-main', 'active');
        btn?.classList.add('tab-inactive-main');
    });
    // Hide all content areas
    areaIds.forEach(id => document.getElementById(id)?.classList.add('hidden'));

    if (tab === 'reports' || tab === 'report') {
        const reportTab = document.getElementById('reportTab');
        reportTab?.classList.remove('tab-inactive-main');
        reportTab?.classList.add('tab-active-main', 'active');
        document.getElementById('reportContentArea')?.classList.remove('hidden');
    } else if (tab === 'academics') {
        const academicsTab = document.getElementById('academicsTab');
        academicsTab?.classList.remove('tab-inactive-main');
        academicsTab?.classList.add('tab-active-main', 'active');
        document.getElementById('academicsContentArea')?.classList.remove('hidden');
        // loadAcademicsData handles its own cache — shows instantly if cached, loads if not
        loadAcademicsData();
    } else if (tab === 'rewards') {
        const rewardsTab = document.getElementById('rewardsTab');
        rewardsTab?.classList.remove('tab-inactive-main');
        rewardsTab?.classList.add('tab-active-main', 'active');
        document.getElementById('rewardsContentArea')?.classList.remove('hidden');
        const user = auth.currentUser;
        // loadReferralRewards handles its own cache — shows instantly if cached, loads if not
        if (user) loadReferralRewards(user.uid);
    } else if (tab === 'payments') {
        const paymentsTab = document.getElementById('paymentsTab');
        paymentsTab?.classList.remove('tab-inactive-main');
        paymentsTab?.classList.add('tab-active-main', 'active');
        document.getElementById('paymentsContentArea')?.classList.remove('hidden');
    } else if (tab === 'settings') {
        const settingsTab = document.getElementById('settingsTab');
        settingsTab?.classList.remove('tab-inactive-main');
        settingsTab?.classList.add('tab-active-main', 'active');
        document.getElementById('settingsContentArea')?.classList.remove('hidden');
        if (window.settingsManager) window.settingsManager.loadSettingsData();
    }
}

// ============================================================================
// FAB (Floating Action Button) — Feedback & Messages
// ============================================================================
function toggleFab() {
    const menu = document.getElementById('fabMenu');
    const btn  = document.getElementById('fabMainBtn');
    if (!menu) return;
    const isOpen = menu.classList.contains('open');
    if (isOpen) {
        menu.classList.remove('open');
        btn?.classList.remove('open');
    } else {
        menu.classList.add('open');
        btn?.classList.add('open');
    }
}

function closeFab() {
    document.getElementById('fabMenu')?.classList.remove('open');
    document.getElementById('fabMainBtn')?.classList.remove('open');
}

function openFabTab(tab) {
    closeFab();
    const modal = document.getElementById('fabModal');
    if (modal) modal.classList.remove('hidden');
    switchFabModalTab(tab);
}

function switchFabModalTab(tab) {
    const feedbackTab    = document.getElementById('fabTabFeedback');
    const messagesTab    = document.getElementById('fabTabMessages');
    const feedbackPanel  = document.getElementById('fabPanelFeedback');
    const messagesPanel  = document.getElementById('fabPanelMessages');
    if (!feedbackTab) return;
    if (tab === 'feedback') {
        feedbackTab.classList.add('active');
        messagesTab?.classList.remove('active');
        if (feedbackPanel)  feedbackPanel.style.display  = 'block';
        if (messagesPanel)  messagesPanel.style.display  = 'none';
    } else {
        messagesTab?.classList.add('active');
        feedbackTab.classList.remove('active');
        if (messagesPanel)  messagesPanel.style.display  = 'block';
        if (feedbackPanel)  feedbackPanel.style.display  = 'none';
        if (typeof loadAdminResponses === 'function') loadAdminResponses();
    }
}

// Note: showFeedbackModal, hideFeedbackModal, showResponsesModal, hideResponsesModal
// are defined at the top of this file and redirect to the FAB modal.

// ============================================================================
// FAB (Floating Action Button) — DYNAMIC HTML INJECTION & STYLES
// ============================================================================

/**
 * injectFabHtml()
 * Creates the floating action button (message icon) and its modal overlay
 * for Feedback + Admin Responses. Called once after auth is confirmed.
 */
function injectFabHtml() {
    // Don't double-inject
    if (document.getElementById('fabContainer')) return;

    // ── FAB button + speed-dial menu ──
    const fabContainer = document.createElement('div');
    fabContainer.id = 'fabContainer';
    fabContainer.innerHTML = `
        <!-- Speed-dial menu (hidden until FAB is tapped) -->
        <div id="fabMenu" class="fab-menu">
            <button class="fab-menu-item" onclick="openFabTab('feedback')" title="Send Feedback">
                <span class="fab-menu-icon">✉️</span>
                <span class="fab-menu-label">Send Feedback</span>
            </button>
            <button class="fab-menu-item" onclick="openFabTab('messages')" title="View Responses">
                <span class="fab-menu-icon">💬</span>
                <span class="fab-menu-label">Responses</span>
            </button>
        </div>

        <!-- Main FAB button -->
        <button id="fabMainBtn" class="fab-main-btn" onclick="toggleFab()" title="Feedback & Messages">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
        </button>

        <!-- FAB Modal (feedback form + responses viewer) -->
        <div id="fabModal" class="fab-modal hidden">
            <div class="fab-modal-backdrop" onclick="document.getElementById('fabModal').classList.add('hidden')"></div>
            <div class="fab-modal-content">
                <!-- Close button -->
                <button class="fab-modal-close" onclick="document.getElementById('fabModal').classList.add('hidden')">&times;</button>

                <!-- Tabs -->
                <div class="fab-modal-tabs">
                    <button id="fabTabFeedback" class="fab-tab active" onclick="switchFabModalTab('feedback')">Send Feedback</button>
                    <button id="fabTabMessages" class="fab-tab" onclick="switchFabModalTab('messages')">Responses</button>
                </div>

                <!-- Feedback Panel -->
                <div id="fabPanelFeedback" class="fab-panel">
                    <div style="display:flex;flex-direction:column;gap:12px;">
                        <select id="feedbackCategory" class="fab-input">
                            <option value="">Select Category</option>
                            <option value="Academic">Academic</option>
                            <option value="Scheduling">Scheduling</option>
                            <option value="Billing">Billing</option>
                            <option value="Tutor">Tutor Feedback</option>
                            <option value="Technical">Technical Issue</option>
                            <option value="General">General</option>
                        </select>
                        <select id="feedbackPriority" class="fab-input">
                            <option value="">Priority</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                        <select id="feedbackStudent" class="fab-input">
                            <option value="">Select Student</option>
                        </select>
                        <textarea id="feedbackMessage" class="fab-input" rows="4" placeholder="Describe your feedback or concern…"></textarea>
                        <button id="submitFeedbackBtn" class="fab-submit-btn" onclick="submitFeedback()">
                            <span id="submitFeedbackText">Submit Feedback</span>
                            <span id="submitFeedbackSpinner" class="loading-spinner-small hidden"></span>
                        </button>
                    </div>
                </div>

                <!-- Responses Panel -->
                <div id="fabPanelMessages" class="fab-panel" style="display:none;">
                    <div id="responsesContent" style="display:flex;flex-direction:column;gap:12px;">
                        <p style="color:#9CA3AF;text-align:center;padding:24px 0;">Loading responses…</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(fabContainer);

    // Populate the student dropdown with children data
    _populateFabStudentDropdown();
}

/**
 * _populateFabStudentDropdown()
 * Fills the feedbackStudent <select> with the parent's enrolled children.
 */
function _populateFabStudentDropdown() {
    const select = document.getElementById('feedbackStudent');
    if (!select) return;

    // Keep the default option
    select.innerHTML = '<option value="">Select Student</option>';

    // Use the global allStudentData / userChildren arrays
    const children = (allStudentData && allStudentData.length > 0)
        ? allStudentData
        : (userChildren && userChildren.length > 0 ? userChildren : []);

    if (children.length === 0) {
        select.innerHTML += '<option value="General">General / No students yet</option>';
        return;
    }

    children.forEach(child => {
        const childName = child.name || child.studentName || 'Unknown';
        const opt = document.createElement('option');
        opt.value = childName;
        opt.textContent = childName;
        select.appendChild(opt);
    });
}

/**
 * Inject FAB styles
 */
function injectFabStyles() {
    if (document.getElementById('fabStyles')) return;

    const style = document.createElement('style');
    style.id = 'fabStyles';
    style.textContent = `
        /* ── FAB Main Button ── */
        .fab-main-btn {
            position: fixed;
            bottom: 28px;
            right: 28px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #10B981, #059669);
            color: #fff;
            border: none;
            box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 9998;
            transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .fab-main-btn:hover {
            transform: scale(1.08);
            box-shadow: 0 6px 24px rgba(16, 185, 129, 0.55);
        }
        .fab-main-btn.open {
            transform: rotate(45deg);
        }

        /* ── FAB Speed-Dial Menu ── */
        .fab-menu {
            position: fixed;
            bottom: 96px;
            right: 28px;
            display: flex;
            flex-direction: column-reverse;
            gap: 10px;
            z-index: 9997;
            opacity: 0;
            pointer-events: none;
            transform: translateY(16px);
            transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .fab-menu.open {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }
        .fab-menu-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px 8px 10px;
            border-radius: 24px;
            background: #fff;
            border: 1px solid #E5E7EB;
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 600;
            color: #374151;
            white-space: nowrap;
            transition: background 0.15s ease, box-shadow 0.15s ease;
        }
        .fab-menu-item:hover {
            background: #ECFDF5;
            box-shadow: 0 4px 14px rgba(0,0,0,0.15);
        }
        .fab-menu-icon { font-size: 1.1rem; }
        .fab-menu-label { font-family: 'DM Sans', sans-serif; }

        /* ── FAB Modal ── */
        .fab-modal {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: flex-end;
            justify-content: flex-end;
            padding: 16px;
        }
        .fab-modal.hidden { display: none !important; }
        .fab-modal-backdrop {
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.35);
        }
        .fab-modal-content {
            position: relative;
            background: #fff;
            border-radius: 16px;
            width: 100%;
            max-width: 420px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 12px 40px rgba(0,0,0,0.2);
            padding: 20px;
            animation: fabSlideUp 0.3s ease-out;
        }
        @keyframes fabSlideUp {
            from { transform: translateY(40px); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
        }
        .fab-modal-close {
            position: absolute;
            top: 12px;
            right: 14px;
            background: none;
            border: none;
            font-size: 1.5rem;
            color: #6B7280;
            cursor: pointer;
            line-height: 1;
        }
        .fab-modal-close:hover { color: #111; }

        /* Tabs */
        .fab-modal-tabs {
            display: flex;
            gap: 0;
            margin-bottom: 16px;
            border-bottom: 2px solid #E5E7EB;
        }
        .fab-tab {
            flex: 1;
            padding: 10px;
            text-align: center;
            background: none;
            border: none;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.9rem;
            color: #9CA3AF;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
            transition: color 0.2s, border-color 0.2s;
            font-family: 'DM Sans', sans-serif;
        }
        .fab-tab.active {
            color: #059669;
            border-bottom-color: #059669;
        }

        /* Inputs / form */
        .fab-input {
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #D1D5DB;
            border-radius: 10px;
            font-size: 0.9rem;
            font-family: 'DM Sans', sans-serif;
            outline: none;
            transition: border-color 0.2s;
        }
        .fab-input:focus { border-color: #10B981; }
        textarea.fab-input { resize: vertical; min-height: 80px; }
        .fab-submit-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 12px;
            border-radius: 10px;
            background: linear-gradient(135deg, #10B981, #059669);
            color: #fff;
            font-weight: 700;
            font-size: 0.95rem;
            border: none;
            cursor: pointer;
            transition: opacity 0.2s;
            font-family: 'DM Sans', sans-serif;
        }
        .fab-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .fab-submit-btn:hover:not(:disabled) { opacity: 0.9; }

        /* Response bubble */
        .response-bubble {
            background: #ECFDF5;
            border-left: 3px solid #10B981;
            border-radius: 0 8px 8px 0;
            padding: 10px 12px;
        }
        .response-header {
            font-weight: 700;
            color: #065F46;
            font-size: 0.8rem;
            margin-bottom: 4px;
        }

        /* Mobile tweaks */
        @media (max-width: 480px) {
            .fab-main-btn { bottom: 18px; right: 18px; width: 50px; height: 50px; }
            .fab-menu { bottom: 78px; right: 18px; }
            .fab-modal { padding: 8px; }
            .fab-modal-content { max-width: 100%; max-height: 85vh; }
        }
    `;
    document.head.appendChild(style);
}

// ── Auto-inject FAB when page loads ──
// We call this after DOMContentLoaded + auth state check.
function initFab() {
    injectFabStyles();
    injectFabHtml();
}

// Attempt to refresh the student dropdown whenever children are loaded
const _originalComprehensiveFindChildren = window.comprehensiveFindChildren;
if (typeof _originalComprehensiveFindChildren === 'function') {
    window.comprehensiveFindChildren = async function (...args) {
        const result = await _originalComprehensiveFindChildren.apply(this, args);
        // Re-populate the dropdown now that children data may have updated
        setTimeout(_populateFabStudentDropdown, 500);
        return result;
    };
}

// Chart initializer — call after rendering report HTML
window.initializeCharts = function() {
    if (typeof Chart === 'undefined') return;
    document.querySelectorAll('canvas[data-config]').forEach(canvas => {
        if (canvas._chartInstance) return; // already initialized
        try {
            const config = JSON.parse(canvas.dataset.config);
            canvas._chartInstance = new Chart(canvas, config);
        } catch(e) {
            console.warn('Chart init failed:', e);
        }
    });
};

function setupEventListeners() {
    const signInBtn = document.getElementById("signInBtn");
    const signUpBtn = document.getElementById("signUpBtn");
    const sendResetBtn = document.getElementById("sendResetBtn");
    
    if (signInBtn) {
        signInBtn.removeEventListener("click", handleSignIn);
        signInBtn.addEventListener("click", handleSignIn);
    }
    
    if (signUpBtn) {
        signUpBtn.removeEventListener("click", handleSignUp);
        signUpBtn.addEventListener("click", handleSignUp);
    }
    
    if (sendResetBtn) {
        sendResetBtn.removeEventListener("click", handlePasswordReset);
        sendResetBtn.addEventListener("click", handlePasswordReset);
    }
    
    const signInTab = document.getElementById("signInTab");
    const signUpTab = document.getElementById("signUpTab");
    
    // Named handlers for proper removeEventListener
    function handleSignInTabClick() { switchTab('signin'); }
    function handleSignUpTabClick() { switchTab('signup'); }
    
    if (signInTab) {
        signInTab.addEventListener("click", handleSignInTabClick);
    }
    
    if (signUpTab) {
        signUpTab.addEventListener("click", handleSignUpTabClick);
    }
    
    const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
    if (forgotPasswordBtn) {
        forgotPasswordBtn.removeEventListener("click", showPasswordResetModal);
        forgotPasswordBtn.addEventListener("click", showPasswordResetModal);
    }
    
    const cancelResetBtn = document.getElementById("cancelResetBtn");
    if (cancelResetBtn) {
        cancelResetBtn.removeEventListener("click", hidePasswordResetModal);
        cancelResetBtn.addEventListener("click", hidePasswordResetModal);
    }
    
    const rememberMeCheckbox = document.getElementById("rememberMe");
    if (rememberMeCheckbox) {
        rememberMeCheckbox.removeEventListener("change", handleRememberMe);
        rememberMeCheckbox.addEventListener("change", handleRememberMe);
    }
    
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) {
        loginPassword.removeEventListener('keypress', handleLoginEnter);
        loginPassword.addEventListener('keypress', handleLoginEnter);
    }
    
    const signupConfirmPassword = document.getElementById('signupConfirmPassword');
    if (signupConfirmPassword) {
        signupConfirmPassword.removeEventListener('keypress', handleSignupEnter);
        signupConfirmPassword.addEventListener('keypress', handleSignupEnter);
    }
    
    const resetEmail = document.getElementById('resetEmail');
    if (resetEmail) {
        resetEmail.removeEventListener('keypress', handleResetEnter);
        resetEmail.addEventListener('keypress', handleResetEnter);
    }
    
    const reportTab = document.getElementById("reportTab");
    const academicsTab = document.getElementById("academicsTab");
    const rewardsTab = document.getElementById("rewardsTab");
    
    // Named handlers for proper cleanup
    function handleReportTabClick() { switchMainTab('reports'); }
    function handleAcademicsTabClick() { switchMainTab('academics'); }
    function handleRewardsTabClick() { switchMainTab('rewards'); }
    
    if (reportTab) {
        reportTab.addEventListener("click", handleReportTabClick);
    }
    
    if (academicsTab) {
        academicsTab.addEventListener("click", handleAcademicsTabClick);
    }
    
    if (rewardsTab) {
        rewardsTab.addEventListener("click", handleRewardsTabClick);
    }
    
    // Feedback submit handler
    const submitFeedbackBtn = document.getElementById("submitFeedbackBtn");
    if (submitFeedbackBtn) {
        submitFeedbackBtn.addEventListener("click", submitFeedback);
    }
}

function handleLoginEnter(e) {
    if (e.key === 'Enter') handleSignIn();
}

function handleSignupEnter(e) {
    if (e.key === 'Enter') handleSignUp();
}

function handleResetEnter(e) {
    if (e.key === 'Enter') handlePasswordReset();
}

function showPasswordResetModal() {
    const modal = document.getElementById("passwordResetModal");
    if (modal) {
        modal.classList.remove("hidden");
    }
}

function hidePasswordResetModal() {
    const modal = document.getElementById("passwordResetModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

function logout() {
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('savedEmail');
    localStorage.removeItem('isAuthenticated');
    // Cache is intentionally kept — so next login shows data instantly
    cleanupRealTimeListeners();
    auth.signOut().then(() => {
        window.location.reload();
    });
}

function setupGlobalErrorHandler() {
    window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        event.preventDefault();
    });
    
    window.addEventListener('error', function(e) {
        console.error('Global error:', e.error);
        if (!e.error?.message?.includes('auth') && 
            !e.error?.message?.includes('permission-denied')) {
            showMessage('An unexpected error occurred. Please refresh the page.', 'error');
        }
        e.preventDefault();
    });
    
    window.addEventListener('offline', function() {
        showMessage('You are offline. Some features may not work.', 'warning');
    });
    
    window.addEventListener('online', function() {
        showMessage('Connection restored.', 'success');
    });
}

// ============================================================================
// PAGE INITIALIZATION & GOOGLE CLASSROOM SETUP
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    
    initializeParentPortalV2();
    
    // Initialize Google Classroom scanner (only when academics tab visible)
    setTimeout(scanAndInjectButtons, 500);
    
    const observer = new MutationObserver(() => {
        const academicsArea = document.getElementById('academicsContentArea');
        if (academicsArea && !academicsArea.classList.contains('hidden')) {
            setTimeout(scanAndInjectButtons, 100);
        }
    });
    
    const target = document.getElementById('academicsContent');
    if (target) observer.observe(target, { childList: true, subtree: true });
    
    // No persistent setInterval — MutationObserver handles it
    
});

// ============================================================================
// GLOBAL EXPORTS
// ============================================================================

// Make global for debugging
window.authManager = authManager;
window.comprehensiveFindChildren = comprehensiveFindChildren;
window.manualRefreshReportsV2 = manualRefreshReportsV2;
window.loadAcademicsData = loadAcademicsData;
window.onStudentSelected = onStudentSelected;
window.toggleAcademicsAccordion = toggleAcademicsAccordion;
window.toggleAccordion = toggleAccordion;
window.downloadSessionReport = downloadSessionReport;
window.downloadMonthlyReport = downloadMonthlyReport;
window.switchMainTab = switchMainTab;
window.logout = logout;
window.showPasswordResetModal = showPasswordResetModal;
window.hidePasswordResetModal = hidePasswordResetModal;
window.switchTab = switchTab;
window.settingsManager = settingsManager;
window.showFeedbackModal = showFeedbackModal;
window.hideFeedbackModal = hideFeedbackModal;
window.showResponsesModal = showResponsesModal;
window.hideResponsesModal = hideResponsesModal;
window.submitFeedback = submitFeedback;
window.closeGoogleClassroomModal = closeGoogleClassroomModal;
window.submitHomeworkToFirebase = submitHomeworkToFirebase;
window.triggerCloudinaryUpload = triggerCloudinaryUpload;
window.unsubmitHomework = unsubmitHomework;

// ============================================================================
// SECTION 21: SIGNUP SUCCESS HANDLER
// ============================================================================

// ============================================================================
// SECTION 22: AUTH MANAGER ENHANCEMENT (PROFILE NOT FOUND FIX)
// ============================================================================

// Store original loadUserDashboard
const originalLoadUserDashboard = UnifiedAuthManager.prototype.loadUserDashboard;

// Override with enhanced version
UnifiedAuthManager.prototype.loadUserDashboard = async function(user) {
    
    const authArea = document.getElementById("authArea");
    const reportArea = document.getElementById("reportArea");
    const authLoader = document.getElementById("authLoader");
    
    if (authLoader) authLoader.classList.remove("hidden");
    
    try {
        
        let userDoc;
        let retryCount = 0;
        const maxRetries = 4;
        
        while (retryCount < maxRetries) {
            try {
                userDoc = await db.collection('parent_users').doc(user.uid).get();
                if (userDoc.exists) {
                    break;
                }
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryCount * 500));
                }
            } catch (err) {
                console.warn(`Retry ${retryCount + 1} failed:`, err.message);
                retryCount++;
            }
        }
        
        if (!userDoc || !userDoc.exists) {
            // BLOCK: No profile = not enrolled through enrollment portal
            if (authLoader) authLoader.classList.add("hidden");
            await auth.signOut();
            if (authArea) authArea.classList.remove("hidden");
            if (reportArea) reportArea.classList.add("hidden");
            showMessage("No account found. Please complete enrollment first at our enrollment portal.", "error");
            return;
        }
        
        const userData = userDoc.data();
        this.currentUser = {
            uid: user.uid,
            email: userData.email,
            phone: userData.phone,
            normalizedPhone: userData.normalizedPhone || userData.phone,
            parentName: userData.parentName || 'Parent',
            referralCode: userData.referralCode,
            passwordResetComplete: userData.passwordResetComplete
        };


        // Update UI immediately
        this.showDashboardUI();

        // CHECK: First-time login - show non-dismissible password reset modal
        if (userData.passwordResetComplete === false) {
            showFirstTimePasswordModal(user.uid);
        }

        // Load remaining data in parallel
        await Promise.all([
            loadAllReportsForParent(this.currentUser.normalizedPhone, user.uid),
            loadReferralRewards(user.uid),
            loadAcademicsData()
        ]);

        this.setupRealtimeMonitoring();
        this.setupUIComponents();


    } catch (error) {
        console.error("❌ Enhanced dashboard load error:", error);
        showMessage("Temporary issue loading dashboard. Please refresh.", "error");
        this.showAuthScreen();
    } finally {
        if (authLoader) authLoader.classList.add("hidden");
    }
};

// ============================================================================
// FIRST-TIME PASSWORD RESET MODAL (Non-dismissible)
// ============================================================================
function showFirstTimePasswordModal(uid) {
    // Remove existing modal if any
    const existingModal = document.getElementById('firstTimePasswordModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'firstTimePasswordModal';
    modal.style.cssText = `
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(15,23,42,0.8); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center; padding: 16px;
    `;
    // Prevent closing by clicking outside
    modal.addEventListener('click', (e) => e.stopPropagation());
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 1.5rem; width: 100%; max-width: 420px;
                    box-shadow: 0 32px 72px rgba(0,0,0,0.3); overflow: hidden;">
            <div style="background: linear-gradient(135deg, var(--sage, #4a7c59), var(--sage-dark, #2f5240));
                        padding: 24px; text-align: center; color: white;">
                <div style="font-size: 2.5rem; margin-bottom: 8px;">🔐</div>
                <h2 style="font-size: 1.25rem; font-weight: 800; margin: 0 0 6px;">Set Your Password</h2>
                <p style="opacity: 0.8; font-size: 0.85rem; margin: 0;">Welcome to your Parent Portal!</p>
            </div>
            <div style="padding: 24px;">
                <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 20px; line-height: 1.6;">
                    Please create a password for your account. You'll use this to log in next time.
                </p>
                <div id="firstTimePwdMsg" style="display:none; padding: 10px 14px; border-radius: 8px; 
                     font-size: 0.82rem; margin-bottom: 14px;"></div>
                <div style="margin-bottom: 14px;">
                    <label style="display:block; font-size:0.75rem; font-weight:600; color:#6b7873; 
                                  margin-bottom:6px; text-transform:uppercase;">New Password</label>
                    <input type="password" id="firstTimePwd" placeholder="Minimum 8 characters"
                           style="width:100%; padding:12px 14px; border:1.5px solid #dde5de; border-radius:10px;
                                  font-size:0.9rem; outline:none; transition:border-color 0.2s;"
                           oninput="validateFirstTimePwd()">
                    <div id="pwdStrengthBar" style="margin-top:6px; height:4px; border-radius:2px; 
                         background:#e2e8f0; overflow:hidden;">
                        <div id="pwdStrengthFill" style="height:100%; width:0%; transition:all 0.3s; border-radius:2px;"></div>
                    </div>
                    <div id="pwdStrengthText" style="font-size:0.72rem; color:#94a3b8; margin-top:3px;"></div>
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display:block; font-size:0.75rem; font-weight:600; color:#6b7873; 
                                  margin-bottom:6px; text-transform:uppercase;">Confirm Password</label>
                    <input type="password" id="firstTimePwdConfirm" placeholder="Confirm your password"
                           style="width:100%; padding:12px 14px; border:1.5px solid #dde5de; border-radius:10px;
                                  font-size:0.9rem; outline:none; transition:border-color 0.2s;"
                           oninput="validateFirstTimePwd()">
                    <div id="pwdMatchText" style="font-size:0.72rem; margin-top:3px;"></div>
                </div>
                <button id="firstTimeSaveBtn" onclick="saveFirstTimePassword('${uid}')"
                    style="width:100%; padding:14px; background:linear-gradient(135deg,#4a7c59,#2f5240);
                           color:white; border:none; border-radius:10px; font-size:0.95rem; font-weight:700;
                           cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                    <span id="firstTimeSaveBtnText">SAVE PASSWORD</span>
                    <div id="firstTimeSaveSpinner" style="display:none; width:16px; height:16px; border:2px solid rgba(255,255,255,0.3);
                         border-top-color:white; border-radius:50%; animation:spin 1s linear infinite;"></div>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

window.validateFirstTimePwd = function() {
    const pwd = document.getElementById('firstTimePwd')?.value || '';
    const confirm = document.getElementById('firstTimePwdConfirm')?.value || '';
    
    // Strength indicator
    let strength = 0;
    let strengthText = '';
    let strengthColor = '';
    if (pwd.length >= 8) strength += 25;
    if (/[A-Z]/.test(pwd)) strength += 25;
    if (/[0-9]/.test(pwd)) strength += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 25;
    
    if (strength <= 25) { strengthText = 'Weak'; strengthColor = '#ef4444'; }
    else if (strength <= 50) { strengthText = 'Fair'; strengthColor = '#f97316'; }
    else if (strength <= 75) { strengthText = 'Good'; strengthColor = '#eab308'; }
    else { strengthText = 'Strong'; strengthColor = '#22c55e'; }
    
    const fill = document.getElementById('pwdStrengthFill');
    const text = document.getElementById('pwdStrengthText');
    if (fill) { fill.style.width = strength + '%'; fill.style.background = strengthColor; }
    if (text) { text.textContent = pwd.length > 0 ? strengthText : ''; text.style.color = strengthColor; }
    
    // Match indicator
    const matchEl = document.getElementById('pwdMatchText');
    if (matchEl && confirm.length > 0) {
        if (pwd === confirm) {
            matchEl.textContent = '✓ Passwords match';
            matchEl.style.color = '#22c55e';
        } else {
            matchEl.textContent = '✗ Passwords do not match';
            matchEl.style.color = '#ef4444';
        }
    } else if (matchEl) {
        matchEl.textContent = '';
    }
};

window.saveFirstTimePassword = async function(uid) {
    const pwd = document.getElementById('firstTimePwd')?.value || '';
    const confirm = document.getElementById('firstTimePwdConfirm')?.value || '';
    const msgEl = document.getElementById('firstTimePwdMsg');
    const btn = document.getElementById('firstTimeSaveBtn');
    const btnText = document.getElementById('firstTimeSaveBtnText');
    const spinner = document.getElementById('firstTimeSaveSpinner');
    
    const showMsg = (text, isError) => {
        if (msgEl) {
            msgEl.textContent = text;
            msgEl.style.display = 'block';
            msgEl.style.background = isError ? '#fdf0f0' : '#edf7f1';
            msgEl.style.color = isError ? '#b94040' : '#3a7a52';
            msgEl.style.border = `1px solid ${isError ? '#f0c8c8' : '#bde0cc'}`;
        }
    };
    
    if (!pwd || pwd.length < 8) {
        showMsg('Password must be at least 8 characters.', true);
        return;
    }
    if (pwd !== confirm) {
        showMsg('Passwords do not match. Please try again.', true);
        return;
    }
    
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Saving...';
    if (spinner) spinner.style.display = 'block';
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Not authenticated — please refresh and try again');

        // Re-authenticate with temp credentials before updatePassword
        // Firebase requires recent login before allowing password changes
        const storedData = localStorage.getItem('bkh_new_parent');
        if (storedData) {
            try {
                const { email, tempPassword } = JSON.parse(storedData);
                if (email && tempPassword) {
                    const credential = firebase.auth.EmailAuthProvider.credential(email, tempPassword);
                    await user.reauthenticateWithCredential(credential);
                    console.log('✅ Re-authentication successful');
                }
            } catch (reAuthErr) {
                console.warn('⚠️ Re-auth skipped:', reAuthErr.message);
            }
        }

        await user.updatePassword(pwd);

        // Clear temp credentials now that password is permanently set
        localStorage.removeItem('bkh_new_parent');
        console.log('✅ Temp credentials cleared');

        // Update Firestore record
        await db.collection('parent_users').doc(uid).update({
            passwordResetComplete: true,
            firstLoginCompleted: true,
            passwordSetAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showMsg('Password saved successfully! Welcome to your portal!', false);

        setTimeout(() => {
            const modal = document.getElementById('firstTimePasswordModal');
            if (modal) modal.remove();
        }, 1500);
        
    } catch (error) {
        console.error('Error saving password:', error);
        let msg = 'Failed to save password. Please try again.';
        if (error.code === 'auth/requires-recent-login') {
            msg = 'Session expired. Please log out and log back in to set your password.';
        }
        showMsg(msg, true);
        if (btn) btn.disabled = false;
        if (btnText) btnText.textContent = 'SAVE PASSWORD';
        if (spinner) spinner.style.display = 'none';
    }
};



// ============================================================================
// SECTION 23: TEMP SIGNUP DATA STORAGE
// ============================================================================

// Store signup data temporarily to use if profile creation fails
window.tempSignupData = null;

// Override the form submission to store data
document.addEventListener('DOMContentLoaded', function() {
    const signUpForm = document.getElementById('signUpForm');
    if (signUpForm) {
        signUpForm.addEventListener('submit', function(e) {
            const countryCode = document.getElementById('countryCode')?.value;
            const localPhone = document.getElementById('signupPhone')?.value.trim();
            const email = document.getElementById('signupEmail')?.value.trim().toLowerCase();
            
            if (countryCode && localPhone && email) {
                const fullPhone = countryCode + localPhone.replace(/\D/g, '');
                window.tempSignupData = {
                    email: email,
                    phone: fullPhone,
                    normalizedPhone: fullPhone
                };
                
                // Auto-clear after 5 minutes
                setTimeout(() => {
                    window.tempSignupData = null;
                }, 5 * 60 * 1000);
            }
        });
    }
});

// ============================================================================
// SECTION 24: SIGNUP PROGRESS INDICATOR
// ============================================================================

// Add visual feedback during signup
function showSignupProgress(step) {
    const steps = [
        'Creating your account...',
        'Setting up your profile...',
        'Almost done...',
        'Welcome!'
    ];
    
    const message = steps[step - 1] || 'Processing...';
    
    // Create or update progress indicator
    let progressDiv = document.getElementById('signupProgress');
    if (!progressDiv) {
        progressDiv = document.createElement('div');
        progressDiv.id = 'signupProgress';
        progressDiv.className = 'fixed top-20 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg z-50';
        document.body.appendChild(progressDiv);
    }
    
    progressDiv.innerHTML = `
        <div class="flex items-center">
            <div class="loading-spinner-small mr-3"></div>
            <div>
                <div class="font-semibold">${message}</div>
                <div class="text-xs opacity-80 mt-1">Step ${step} of ${steps.length}</div>
            </div>
        </div>
    `;
}

function hideSignupProgress() {
    const progressDiv = document.getElementById('signupProgress');
    if (progressDiv) {
        progressDiv.remove();
    }
}


// ============================================================================
// SILENT UNLIMITED SEARCH FIX (NO PROGRESS MESSAGES)
// ============================================================================


// ============================================================================
// FIX 1: FAST UNLIMITED SEARCH (SILENT)
// ============================================================================

// Store original function silently
const originalSearchAllReportsForParent = window.searchAllReportsForParent;

// Create FAST unlimited search (no console logs for parents)
window.searchAllReportsForParent = async function(parentPhone, parentEmail = '', parentUid = '') {
    let assessmentResults = [];
    let monthlyResults = [];
    
    try {
        const parentSuffix = extractPhoneSuffix(parentPhone);
        
        if (!parentSuffix) {
            return { assessmentResults: [], monthlyResults: [] };
        }

        // FAST PARALLEL SEARCH - NO LIMITS, NO PROGRESS
        const searchPromises = [];
        
        // 1. Search assessment reports (FAST - no batch processing)
        searchPromises.push(
            db.collection("student_results").get().then(snapshot => {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    
                    // Quick phone check
                    const phoneFields = [
                        data.parentPhone,
                        data.parent_phone,
                        data.guardianPhone,
                        data.motherPhone,
                        data.fatherPhone
                    ];
                    
                    for (const fieldPhone of phoneFields) {
                        if (fieldPhone && extractPhoneSuffix(fieldPhone) === parentSuffix) {
                            assessmentResults.push({ 
                                id: doc.id,
                                collection: 'student_results',
                                ...data,
                                timestamp: getTimestampFromData(data),
                                type: 'assessment'
                            });
                            break;
                        }
                    }
                });
            }).catch(() => {}) // Silent catch
        );
        
        // 2. Search monthly reports (FAST - no batch processing)
        searchPromises.push(
            db.collection("tutor_submissions").get().then(snapshot => {
                snapshot.forEach(doc => {
                    const data = doc.data();
                    
                    // Quick phone check
                    const phoneFields = [
                        data.parentPhone,
                        data.parent_phone,
                        data.guardianPhone,
                        data.motherPhone,
                        data.fatherPhone
                    ];
                    
                    for (const fieldPhone of phoneFields) {
                        if (fieldPhone && extractPhoneSuffix(fieldPhone) === parentSuffix) {
                            monthlyResults.push({ 
                                id: doc.id,
                                collection: 'tutor_submissions',
                                ...data,
                                timestamp: getTimestampFromData(data),
                                type: 'monthly'
                            });
                            break;
                        }
                    }
                });
            }).catch(() => {}) // Silent catch
        );
        
        // 3. Optional email search (silent)
        if (parentEmail) {
            searchPromises.push(
                db.collection("student_results")
                    .where("parentEmail", "==", parentEmail)
                    .limit(50)
                    .get()
                    .then(snapshot => {
                        if (!snapshot.empty) {
                            snapshot.forEach(doc => {
                                const data = doc.data();
                                const existing = assessmentResults.find(r => r.id === doc.id);
                                if (!existing) {
                                    assessmentResults.push({ 
                                        id: doc.id,
                                        collection: 'student_results',
                                        matchType: 'email',
                                        ...data,
                                        timestamp: getTimestampFromData(data),
                                        type: 'assessment'
                                    });
                                }
                            });
                        }
                    }).catch(() => {})
            );
        }
        
        // Wait for all searches silently
        await Promise.all(searchPromises);
        
        // Remove duplicates quietly
        assessmentResults = [...new Map(assessmentResults.map(item => [item.id, item])).values()];
        monthlyResults = [...new Map(monthlyResults.map(item => [item.id, item])).values()];
        
        // Sort by timestamp (newest first)
        assessmentResults.sort((a, b) => b.timestamp - a.timestamp);
        monthlyResults.sort((a, b) => b.timestamp - a.timestamp);
        
    } catch (error) {
        // Silent error - don't show anything to parent
        console.error("Search error (silent):", error);
    }
    
    return { assessmentResults, monthlyResults };
};

// ============================================================================
// FIX 2: SILENT LOAD FUNCTION (NO PROGRESS MESSAGES)
// ============================================================================

// Store original silently
const originalLoadAllReportsForParent = window.loadAllReportsForParent;

// Create silent version
window.loadAllReportsForParent = async function(parentPhone, userId, forceRefresh = false) {
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    
    // Show normal UI (not loading messages)
    if (auth.currentUser && authArea && reportArea) {
        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");
        localStorage.setItem('isAuthenticated', 'true');
    }
    
    // Show simple skeleton loader (like before)
    showSkeletonLoader('reportContent', 'dashboard');
    
    if (authLoader) authLoader.classList.remove("hidden");
    
    try {
        // Get user data
        const userDoc = await db.collection('parent_users').doc(userId).get();
        if (!userDoc.exists) {
            throw new Error("User profile not found");
        }
        
        const userData = userDoc.data();
        
        // Update UI silently
        currentUserData = {
            parentName: userData.parentName || 'Parent',
            parentPhone: parentPhone,
            email: userData.email || ''
        };

        const welcomeMessage = document.getElementById("welcomeMessage");
        if (welcomeMessage) {
            welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;
        }

        // Use our SILENT unlimited search
        const searchResults = await searchAllReportsForParent(parentPhone, userData.email, userId);
        const { assessmentResults, monthlyResults } = searchResults;

        // Handle results silently
        if (assessmentResults.length === 0 && monthlyResults.length === 0) {
            reportContent.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-4xl mb-4">📊</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Reports Available</h3>
                    <p class="text-gray-500">No reports found for your account yet.</p>
                    <button onclick="manualRefreshReportsV2()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-200">
                        Check Again
                    </button>
                </div>
            `;
            return;
        }

        // Process reports (using existing logic)
        let reportsHtml = '';
        const studentReportsMap = new Map();

        [...assessmentResults, ...monthlyResults].forEach(report => {
            const studentName = report.studentName;
            if (!studentName) return;
            
            if (!studentReportsMap.has(studentName)) {
                studentReportsMap.set(studentName, {
                    assessments: [],
                    monthly: []
                });
            }
            
            if (report.type === 'assessment') {
                studentReportsMap.get(studentName).assessments.push(report);
            } else if (report.type === 'monthly') {
                studentReportsMap.get(studentName).monthly.push(report);
            }
        });

        userChildren = Array.from(studentReportsMap.keys());
        
        const formattedReportsByStudent = new Map();
        
        for (const [studentName, reports] of studentReportsMap) {
            const assessmentsBySession = new Map();
            reports.assessments.forEach(report => {
                const sessionKey = Math.floor(report.timestamp / 86400);
                if (!assessmentsBySession.has(sessionKey)) {
                    assessmentsBySession.set(sessionKey, []);
                }
                assessmentsBySession.get(sessionKey).push(report);
            });
            
            const monthlyBySession = new Map();
            reports.monthly.forEach(report => {
                const sessionKey = Math.floor(report.timestamp / 86400);
                if (!monthlyBySession.has(sessionKey)) {
                    monthlyBySession.set(sessionKey, []);
                }
                monthlyBySession.get(sessionKey).push(report);
            });
            
            formattedReportsByStudent.set(studentName, {
                assessments: assessmentsBySession,
                monthly: monthlyBySession,
                studentData: { name: studentName, isPending: false }
            });
        }

        reportsHtml = createYearlyArchiveReportView(formattedReportsByStudent);
        reportContent.innerHTML = reportsHtml;
        setTimeout(() => window.initializeCharts && window.initializeCharts(), 150);

        // Setup monitoring silently
        setupRealTimeMonitoring(parentPhone, userId);
        addManualRefreshButton();
        addLogoutButton();

    } catch (error) {
        // Show simple error
        reportContent.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">❌</div>
                <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Reports</h3>
                <p class="text-gray-500">Please try again later.</p>
                <button onclick="window.location.reload()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-all duration-200">
                    Refresh Page
                </button>
            </div>
        `;
    } finally {
        if (authLoader) authLoader.classList.add("hidden");
    }
};

// ============================================================================
// FIX 3: OPTIMIZE FOR SPEED
// ============================================================================

// Cache phone suffix extraction results for faster searching
const phoneSuffixCache = new Map();

function getCachedPhoneSuffix(phone) {
    if (!phone) return '';
    
    if (phoneSuffixCache.has(phone)) {
        return phoneSuffixCache.get(phone);
    }
    
    const suffix = phone.toString().replace(/\D/g, '').slice(-10);
    phoneSuffixCache.set(phone, suffix);
    return suffix;
}

// Optimize the extractPhoneSuffix function
const originalExtractPhoneSuffix = window.extractPhoneSuffix;
window.extractPhoneSuffix = function(phone) {
    return getCachedPhoneSuffix(phone);
};

// ============================================================================
// FIX 4: QUICK CHECK FOR LIMIT ISSUE
// ============================================================================

// Simple check: if search returns empty but we know documents exist, use unlimited
const originalAuthManagerLoad = window.authManager?.loadUserDashboard;

if (window.authManager && originalAuthManagerLoad) {
    window.authManager.loadUserDashboard = async function(user) {
        try {
            await originalAuthManagerLoad.call(this, user);
            
            // Quick check: if reports area is empty but should have content
            setTimeout(() => {
                const reportContent = document.getElementById('reportContent');
                if (reportContent && reportContent.textContent.includes('No Reports') && 
                    reportContent.textContent.includes('Waiting for')) {
                    // Silently reload with unlimited search
                    const userPhone = this.currentUser?.normalizedPhone;
                    const userId = this.currentUser?.uid;
                    if (userPhone && userId) {
                        setTimeout(() => {
                            loadAllReportsForParent(userPhone, userId, true);
                        }, 1000);
                    }
                }
            }, 2000);
            
        } catch (error) {
            console.error("Enhanced auth manager error:", error);
        }
    };
}

// ============================================================================
// FIX 5: SIMPLE MANUAL REFRESH
// ============================================================================

window.manualRefreshReportsV2 = async function() {
    const user = auth.currentUser;
    if (!user) return;
    
    const refreshBtn = document.getElementById('manualRefreshBtn');
    if (!refreshBtn) return;
    
    const originalText = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Refreshing...';
    refreshBtn.disabled = true;
    
    try {
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const userPhone = userData.normalizedPhone || userData.phone;
            await loadAllReportsForParent(userPhone, user.uid, true);
        }
        
        showMessage('Reports refreshed', 'success');
        
    } catch (error) {
        console.error('Refresh error:', error);
        showMessage('Refresh failed', 'error');
    } finally {
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
};


// ============================================================================
// SHARED PARENT ACCESS SYSTEM (NO DUPLICATE DECLARATIONS)
// ============================================================================


// Check if we already have these variables
if (typeof window.sharedAccessInstalled === 'undefined') {
    window.sharedAccessInstalled = true;
    
    // ============================================================================
    // 1. ENHANCED STUDENT SEARCH (SUPPORTS MULTIPLE PARENT PHONES)
    // ============================================================================

    // Store original function if it exists
    const enhancedComprehensiveFindChildren = window.comprehensiveFindChildren;

    // Create enhanced version
    window.comprehensiveFindChildren = async function(parentPhone) {
        
        // First try enhanced search
        const enhancedResult = await enhancedSharedChildSearch(parentPhone);
        
        // If enhanced search found something, return it
        if (enhancedResult.studentNames.length > 0) {
            return enhancedResult;
        }
        
        // Otherwise fall back to original function
        if (typeof enhancedComprehensiveFindChildren === 'function') {
            return await enhancedComprehensiveFindChildren(parentPhone);
        }
        
        return {
            studentIds: [],
            studentNameIdMap: new Map(),
            allStudentData: [],
            studentNames: []
        };
    };

    // Enhanced shared child search function
    async function enhancedSharedChildSearch(parentPhone) {
        const allChildren = new Map();
        const studentNameIdMap = new Map();
        
        const parentSuffix = extractPhoneSuffix(parentPhone);
        
        if (!parentSuffix) {
            return {
                studentIds: [],
                studentNameIdMap: new Map(),
                allStudentData: [],
                studentNames: []
            };
        }

        try {
            // Search for students where this phone is in ANY contact field
            const studentsSnapshot = await db.collection('students').get();
            
            studentsSnapshot.forEach(doc => {
                const data = doc.data();
                const studentId = doc.id;
                const studentName = safeText(data.studentName || data.name || 'Unknown');
                
                if (studentName === 'Unknown') return;
                
                // Check ALL contact fields including secondary contacts
                const contactFields = [
                    { field: 'motherPhone', type: 'mother' },
                    { field: 'fatherPhone', type: 'father' },
                    { field: 'guardianPhone', type: 'guardian' },
                    { field: 'emergencyPhone', type: 'emergency' },
                    { field: 'secondaryPhone', type: 'secondary' },
                    { field: 'contactPhone', type: 'contact' }
                ];
                
                for (const { field, type } of contactFields) {
                    const fieldPhone = data[field];
                    if (fieldPhone && extractPhoneSuffix(fieldPhone) === parentSuffix) {
                        
                        allChildren.set(studentId, {
                            id: studentId,
                            name: studentName,
                            data: data,
                            isPending: false,
                            collection: 'students',
                            relationship: type,
                            matchedField: field
                        });
                        
                        // Use unique name if duplicates exist
                        const uniqueName = studentNameIdMap.has(studentName) ? 
                            `${studentName} (${studentId.substring(0, 4)})` : studentName;
                        studentNameIdMap.set(uniqueName, studentId);
                        break;
                    }
                }
            });

            const studentNames = Array.from(studentNameIdMap.keys());
            const studentIds = Array.from(allChildren.keys());
            const allStudentData = Array.from(allChildren.values());


            return {
                studentIds,
                studentNameIdMap,
                allStudentData,
                studentNames
            };

        } catch (error) {
            console.error("Enhanced shared access search error:", error);
            return {
                studentIds: [],
                studentNameIdMap: new Map(),
                allStudentData: [],
                studentNames: []
            };
        }
    }

    // ============================================================================
    // 2. ENHANCED REPORT SEARCH (SUPPORTS MULTIPLE PARENT CONTACTS)
    // ============================================================================

    // Store original search function
    const existingSearchFunction = window.searchAllReportsForParent;

    // Create wrapper that adds shared contact search
    window.searchAllReportsForParent = async function(parentPhone, parentEmail = '', parentUid = '') {
        
        // Get results from original function first
        let originalResults = { assessmentResults: [], monthlyResults: [] };
        if (typeof existingSearchFunction === 'function') {
            originalResults = await existingSearchFunction(parentPhone, parentEmail, parentUid);
        }
        
        // Now search by shared contacts
        const sharedResults = await searchBySharedContacts(parentPhone, parentEmail);
        
        // Combine results (remove duplicates)
        const combinedAssessments = [
            ...originalResults.assessmentResults,
            ...sharedResults.assessmentResults
        ];
        
        const combinedMonthly = [
            ...originalResults.monthlyResults,
            ...sharedResults.monthlyResults
        ];
        
        // Remove duplicates by document ID
        const uniqueAssessments = [...new Map(combinedAssessments.map(item => [item.id, item])).values()];
        const uniqueMonthly = [...new Map(combinedMonthly.map(item => [item.id, item])).values()];
        
        // Sort by timestamp (newest first)
        uniqueAssessments.sort((a, b) => b.timestamp - a.timestamp);
        uniqueMonthly.sort((a, b) => b.timestamp - a.timestamp);
        
        
        return {
            assessmentResults: uniqueAssessments,
            monthlyResults: uniqueMonthly
        };
    };

    // Function to search by shared contacts
    async function searchBySharedContacts(parentPhone, parentEmail) {
        const assessmentResults = [];
        const monthlyResults = [];
        const parentSuffix = extractPhoneSuffix(parentPhone);
        
        if (!parentSuffix) {
            return { assessmentResults, monthlyResults };
        }
        
        try {
            // Search in tutor_submissions for shared contact fields
            const monthlySnapshot = await db.collection('tutor_submissions').get();
            
            monthlySnapshot.forEach(doc => {
                const data = doc.data();
                
                // Check shared contact fields
                const sharedFields = [
                    data.motherPhone,
                    data.fatherPhone,
                    data.guardianPhone,
                    data.emergencyPhone,
                    data.secondaryContact
                ];
                
                for (const fieldPhone of sharedFields) {
                    if (fieldPhone && extractPhoneSuffix(fieldPhone) === parentSuffix) {
                        monthlyResults.push({
                            id: doc.id,
                            collection: 'tutor_submissions',
                            matchType: 'shared-contact',
                            matchedField: 'shared',
                            ...data,
                            timestamp: getTimestampFromData(data),
                            type: 'monthly'
                        });
                        break;
                    }
                }
                
                // Also check by email if provided
                if (parentEmail && data.guardianEmail === parentEmail) {
                    monthlyResults.push({
                        id: doc.id,
                        collection: 'tutor_submissions',
                        matchType: 'shared-email',
                        matchedField: 'email',
                        ...data,
                        timestamp: getTimestampFromData(data),
                        type: 'monthly'
                    });
                }
            });
            
            // Search in student_results for shared contact fields
            const assessmentSnapshot = await db.collection('student_results').get();
            
            assessmentSnapshot.forEach(doc => {
                const data = doc.data();
                
                // Check shared contact fields
                const sharedFields = [
                    data.motherPhone,
                    data.fatherPhone,
                    data.guardianPhone,
                    data.emergencyPhone
                ];
                
                for (const fieldPhone of sharedFields) {
                    if (fieldPhone && extractPhoneSuffix(fieldPhone) === parentSuffix) {
                        assessmentResults.push({
                            id: doc.id,
                            collection: 'student_results',
                            matchType: 'shared-contact',
                            matchedField: 'shared',
                            ...data,
                            timestamp: getTimestampFromData(data),
                            type: 'assessment'
                        });
                        break;
                    }
                }
                
                // Also check by email if provided
                if (parentEmail && data.guardianEmail === parentEmail) {
                    assessmentResults.push({
                        id: doc.id,
                        collection: 'student_results',
                        matchType: 'shared-email',
                        matchedField: 'email',
                        ...data,
                        timestamp: getTimestampFromData(data),
                        type: 'assessment'
                    });
                }
            });
            
            
        } catch (error) {
            console.error("Shared contact search error:", error);
        }
        
        return { assessmentResults, monthlyResults };
    }

    // ============================================================================
    // 3. ENHANCED SETTINGS SAVING (WITH SHARED ACCESS PROPAGATION)
    // ============================================================================

    // Check if settingsManager exists and enhance it
    if (window.settingsManager && window.settingsManager.updateStudent) {
        const originalUpdateStudent = window.settingsManager.updateStudent;
        
        window.settingsManager.updateStudent = async function(studentId, collectionName) {
            try {
                // Call original function first
                await originalUpdateStudent.call(this, studentId, collectionName);
                
                // Get the contact values from the form
                const motherPhone = document.getElementById(`motherPhone_${studentId}`)?.value.trim();
                const fatherPhone = document.getElementById(`fatherPhone_${studentId}`)?.value.trim();
                const guardianEmail = document.getElementById(`guardianEmail_${studentId}`)?.value.trim();
                
                // If shared contacts were added, propagate them to reports
                if (motherPhone || fatherPhone || guardianEmail) {
                    await propagateSharedContactsToReports(studentId, motherPhone, fatherPhone, guardianEmail);
                    
                    // Show success message
                    showMessage('Shared contacts saved! Other parents can now register with these details.', 'success');
                }
                
            } catch (error) {
                console.error("Enhanced settings update error:", error);
            }
        };
    }

    // Function to propagate shared contacts to all reports
    async function propagateSharedContactsToReports(studentId, motherPhone, fatherPhone, guardianEmail) {
        const collections = ['tutor_submissions', 'student_results'];
        
        for (const collection of collections) {
            try {
                const reportsSnapshot = await db.collection(collection)
                    .where('studentId', '==', studentId)
                    .get();
                
                if (!reportsSnapshot.empty) {
                    const batch = db.batch();
                    let updateCount = 0;
                    
                    reportsSnapshot.forEach(doc => {
                        const ref = db.collection(collection).doc(doc.id);
                        const updateData = {};
                        
                        // Add mother phone if provided
                        if (motherPhone) {
                            updateData.motherPhone = motherPhone;
                        }
                        
                        // Add father phone if provided
                        if (fatherPhone) {
                            updateData.fatherPhone = fatherPhone;
                        }
                        
                        // Add guardian email if provided
                        if (guardianEmail) {
                            updateData.guardianEmail = guardianEmail;
                        }
                        
                        if (Object.keys(updateData).length > 0) {
                            batch.update(ref, updateData);
                            updateCount++;
                        }
                    });
                    
                    if (updateCount > 0) {
                        await batch.commit();
                    }
                }
            } catch (error) {
                console.warn(`Could not update ${collection}:`, error.message);
            }
        }
    }

    // ============================================================================
    // 4. SHARED CONTACT AUTO-LINKING (runs after signup via onAuthStateChanged)
    // ============================================================================

    // Find students linked to a contact
    async function findLinkedStudentsForContact(phone, email) {
        const linkedStudents = [];
        const phoneSuffix = extractPhoneSuffix(phone);
        
        if (!phoneSuffix && !email) return linkedStudents;
        
        try {
            const studentsSnapshot = await db.collection('students').get();
            
            studentsSnapshot.forEach(doc => {
                const data = doc.data();
                const studentName = data.studentName || data.name;
                
                if (!studentName) return;
                
                // Check phone matches
                if (phoneSuffix) {
                    const contactFields = ['motherPhone', 'fatherPhone', 'guardianPhone', 'emergencyPhone'];
                    
                    for (const field of contactFields) {
                        const fieldPhone = data[field];
                        if (fieldPhone && extractPhoneSuffix(fieldPhone) === phoneSuffix) {
                            linkedStudents.push({
                                studentId: doc.id,
                                studentName: studentName,
                                relationship: field.replace('Phone', ''),
                                matchedBy: 'phone'
                            });
                            break;
                        }
                    }
                }
                
                // Check email matches
                if (email && data.guardianEmail?.toLowerCase() === email.toLowerCase()) {
                    linkedStudents.push({
                        studentId: doc.id,
                        studentName: studentName,
                        relationship: 'guardian',
                        matchedBy: 'email'
                    });
                }
            });
            
            
        } catch (error) {
            console.error("Error finding linked students:", error);
        }
        
        return linkedStudents;
    }

    // Update parent profile with shared access info
    async function updateParentWithSharedAccess(parentUid, phone, email, linkedStudents) {
        // Issue 2: Normalise email
        email = email ? email.toLowerCase().trim() : '';
        try {
            const updateData = {
                isSharedContact: true,
                linkedStudents: linkedStudents.map(student => ({
                    studentId: student.studentId,
                    studentName: student.studentName,
                    relationship: student.relationship,
                    linkedAt: firebase.firestore.FieldValue.serverTimestamp()
                })),
                sharedContactInfo: {
                    phone: phone,
                    email: email,
                    linkedAt: firebase.firestore.FieldValue.serverTimestamp()
                }
            };
            
            await db.collection('parent_users').doc(parentUid).update(updateData);
            
            // Also update student records with parent info
            for (const student of linkedStudents) {
                try {
                    await db.collection('students').doc(student.studentId).update({
                        sharedParents: firebase.firestore.FieldValue.arrayUnion({
                            parentUid: parentUid,
                            parentEmail: email,
                            parentPhone: phone,
                            relationship: student.relationship,
                            linkedAt: new Date().toISOString() // arrayUnion does not support serverTimestamp
                        })
                    });
                } catch (error) {
                    console.warn(`Could not update student ${student.studentName}:`, error.message);
                }
            }
            
        } catch (error) {
            console.error("Error updating parent with shared access:", error);
        }
    }

    // ============================================================================
    // 5. UTILITY FUNCTIONS
    // ============================================================================

    // Function to check if a phone/email is a shared contact
    window.isSharedContact = async function(phone, email) {
        const phoneSuffix = extractPhoneSuffix(phone);
        let isShared = false;
        let linkedStudents = [];
        
        try {
            const studentsSnapshot = await db.collection('students').get();
            
            studentsSnapshot.forEach(doc => {
                const data = doc.data();
                
                // Check phone
                if (phoneSuffix) {
                    const contactFields = ['motherPhone', 'fatherPhone', 'guardianPhone'];
                    for (const field of contactFields) {
                        const fieldPhone = data[field];
                        if (fieldPhone && extractPhoneSuffix(fieldPhone) === phoneSuffix) {
                            isShared = true;
                            linkedStudents.push({
                                studentId: doc.id,
                                studentName: data.studentName || data.name,
                                relationship: field.replace('Phone', '')
                            });
                        }
                    }
                }
                
                // Check email
                if (email && data.guardianEmail?.toLowerCase() === email.toLowerCase()) {
                    isShared = true;
                    linkedStudents.push({
                        studentId: doc.id,
                        studentName: data.studentName || data.name,
                        relationship: 'guardian'
                    });
                }
            });
            
        } catch (error) {
            console.error("Error checking shared contact:", error);
        }
        
        return { isShared, linkedStudents };
    };

    
} else {
}

// ============================================================================
// SECTION 26: PREMIUM DASHBOARD UI OVERRIDE (WORDPRESS/SAAS STYLE)
// ============================================================================
(function injectPremiumSlickUI() {
    const slickStyle = document.createElement('style');
    slickStyle.textContent = `
        /* Root Variables for a Modern Palette */
        :root {
            --brand-primary: #10b981;
            --brand-dark: #064e3b;
            --brand-light: #ecfdf5;
            --bg-main: #f8fafc;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            --card-hover: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        /* Global Body Styling */
        body {
            background-color: var(--bg-main) !important;
            color: var(--text-main) !important;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            letter-spacing: -0.01em;
        }

        /* Container & Glassmorphism */
        #reportArea, #authArea {
            max-width: 1200px !important;
            margin: 2rem auto !important;
            padding: 0 1.5rem !important;
        }

        /* Card Styling - WordPress/Slick look */
        .bg-white, .gc-card, .accordion-item, #assessment-block, #monthly-block {
            border-radius: 16px !important;
            border: 1px solid rgba(226, 232, 240, 0.8) !important;
            box-shadow: var(--card-shadow) !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            overflow: hidden;
            background: #ffffff !important;
        }

        .bg-white:hover {
            box-shadow: var(--card-hover) !important;
            transform: translateY(-2px);
        }

        /* Header / Welcome Area */
        .bg-green-50 {
            background: linear-gradient(135deg, var(--brand-dark) 0%, #065f46 100%) !important;
            border-radius: 20px !important;
            padding: 3rem 2rem !important;
            color: white !important;
            margin-bottom: 2rem !important;
            box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.2) !important;
        }

        #welcomeMessage {
            font-size: 2.25rem !important;
            font-weight: 800 !important;
            letter-spacing: -0.025em !important;
            margin-bottom: 0.5rem !important;
        }

        .bg-green-50 p {
            color: rgba(255, 255, 255, 0.8) !important;
            font-size: 1.1rem !important;
        }

        /* Tabs Navigation - Slick Modern look */
        .flex.mb-8.bg-gray-100 {
            background: #e2e8f0 !important;
            padding: 6px !important;
            border-radius: 12px !important;
            display: inline-flex !important;
            width: auto !important;
            margin-bottom: 2.5rem !important;
        }

        .tab-active-main {
            background: white !important;
            color: var(--brand-dark) !important;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05) !important;
            border-radius: 8px !important;
            font-weight: 600 !important;
            padding: 10px 24px !important;
        }

        .tab-inactive-main {
            color: var(--text-muted) !important;
            font-weight: 500 !important;
            padding: 10px 24px !important;
            transition: color 0.2s ease !important;
        }

        /* Modern Buttons */
        button {
            border-radius: 10px !important;
            font-weight: 600 !important;
            transition: all 0.2s ease !important;
        }

        .bg-green-600 {
            background-color: var(--brand-primary) !important;
            box-shadow: 0 4px 14px 0 rgba(16, 185, 129, 0.39) !important;
        }

        .bg-green-600:hover {
            background-color: #059669 !important;
            transform: scale(1.02);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.23) !important;
        }

        /* Accordion Headers */
        .accordion-header {
            border: none !important;
            padding: 1.5rem !important;
            font-weight: 700 !important;
        }

        .bg-blue-100 { background-color: #f0f9ff !important; border-left: 5px solid #0ea5e9 !important; }
        .bg-purple-100 { background-color: #f5f3ff !important; border-left: 5px solid #8b5cf6 !important; }
        .bg-green-100 { background-color: #ecfdf5 !important; border-left: 5px solid #10b981 !important; }

        /* Tables - Clean & Pro */
        table {
            border-radius: 12px !important;
            border-collapse: separate !important;
            border-spacing: 0 !important;
            border: 1px solid #f1f5f9 !important;
        }

        th {
            background-color: #f8fafc !important;
            color: var(--text-muted) !important;
            text-transform: uppercase !important;
            font-size: 0.75rem !important;
            font-weight: 700 !important;
            padding: 1rem !important;
        }

        td {
            padding: 1rem !important;
            border-bottom: 1px solid #f1f5f9 !important;
        }

        /* Homework Cards Specific */
        [data-homework-id] {
            border-left: 4px solid #cbd5e1 !important;
        }

        [data-homework-id]:has(.bg-green-100) { border-left-color: #10b981 !important; }
        [data-homework-id]:has(.bg-red-100) { border-left-color: #ef4444 !important; }
        [data-homework-id]:has(.bg-blue-100) { border-left-color: #3b82f6 !important; }

        /* Input Fields */
        input, select {
            border: 1.5px solid #e2e8f0 !important;
            border-radius: 10px !important;
            padding: 0.75rem 1rem !important;
        }

        input:focus {
            border-color: var(--brand-primary) !important;
            box-shadow: 0 0 0 4px var(--brand-light) !important;
        }
        
        /* Floating Message Toasts */
        .message-toast {
            border-radius: 12px !important;
            backdrop-filter: blur(8px) !important;
            background: rgba(16, 185, 129, 0.9) !important;
            border: 1px solid rgba(255,255,255,0.2) !important;
            padding: 1rem 1.5rem !important;
            font-weight: 500 !important;
        }
    `;
    document.head.appendChild(slickStyle);
})();

// ============================================================================
// END OF PARENT.JS - PRODUCTION READY
// ============================================================================

// ============================================================================
// ██████████████████████████████████████████████████████████████████████████
// NEW FEATURES — ADDED BY PARENT PORTAL REDESIGN
// ██████████████████████████████████████████████████████████████████████████
// ============================================================================

// ============================================================================
// ADD STUDENT MODAL — Step-based enrolment using enrollment portal logic
// ============================================================================

let _addStudentStep = 1;

/**
 * showAddStudentModal()
 * Opens the "Add Sibling" multi-step modal.
 */
function showAddStudentModal() {
    const modal = document.getElementById('addStudentModal');
    if (!modal) return;

    // Reset to step 1
    _addStudentStep = 1;
    _updateAddStudentStepUI();

    // Set min date to TOMORROW (no backdating)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    // Also set default to 1st of next month
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    const el = document.getElementById('newStudentStartDate');
    if (el) {
        el.min = tomorrowStr;
        el.setAttribute('onkeydown', 'return false;');
        el.value = nextMonth.toISOString().split('T')[0];
    }

    // Reset all picker chips
    document.querySelectorAll('#newStudentSubjects .picker-chip,#newStudentDays .picker-chip')
        .forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('#newStudentSessions .picker-chip')
        .forEach(c => c.classList.remove('selected'));

    // Clear text fields
    ['newStudentFirstName','newStudentLastName','newStudentDob','newStudentGender','newStudentActualGrade',
     'newStudentGradeLevel','newStudentStartHour','newStudentEndHour','newStudentTutor'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Initialize extracurricular and test prep grids
    _initSiblingExtraGrid();
    _initSiblingTestPrepGrid();

    modal.classList.remove('hidden');
}

/**
 * Switch sibling tabs (Academic / Extracurricular / Test Prep)
 */
function switchSiblingTab(tab) {
    ['academic', 'extra', 'testprep'].forEach(t => {
        const btn = document.getElementById(`siblingTab_${t}`);
        const panel = document.getElementById(`siblingPanel_${t}`);
        const isActive = t === tab;
        if (btn) {
            btn.classList.toggle('active', isActive);
            btn.style.borderBottomColor = isActive ? 'var(--sage,#4a7c59)' : 'transparent';
            btn.style.color = isActive ? 'var(--sage-dark,#2f5240)' : '#94a3b8';
            btn.style.fontWeight = isActive ? '700' : '600';
        }
        if (panel) panel.style.display = isActive ? 'block' : 'none';
    });
}
window.switchSiblingTab = switchSiblingTab;

/**
 * Initialize the extracurricular activity grid for Add Sibling
 */
function _initSiblingExtraGrid() {
    const container = document.getElementById('siblingExtraGrid');
    if (!container) return;
    
    const EXTRA_FEES = [
        { id: 'comic', name: 'COMIC BOOK DESIGN', fee: 35000 },
        { id: 'graphics', name: 'GRAPHICS DESIGNING', fee: 35000 },
        { id: 'ai', name: 'GENERATIVE AI', fee: 40000 },
        { id: 'youtube', name: 'YOUTUBE FOR KIDS', fee: 40000 },
        { id: 'animation', name: 'STOP MOTION ANIMATION', fee: 35000 },
        { id: 'videography', name: 'VIDEOGRAPHY', fee: 40000 },
        { id: 'music', name: 'KIDS MUSIC LESSON', fee: 45000 },
        { id: 'coding', name: 'CODING CLASSES FOR KIDS', fee: 45000 },
        { id: 'sketch', name: 'SMART SKETCH', fee: 45000 },
        { id: 'foreign', name: 'FOREIGN LANGUAGE', fee: 55000 },
        { id: 'global_discovery', name: 'GLOBAL DISCOVERY CLUB', fee: 50000 },
        { id: 'native', name: 'NATIVE LANGUAGE', fee: 30000 },
        { id: 'speaking', name: 'PUBLIC SPEAKING', fee: 35000 },
        { id: 'bible', name: 'BIBLE STUDY', fee: 35000 },
        { id: 'chess', name: 'CHESS CLASS', fee: 40000 }
    ];
    
    const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    
    container.innerHTML = '';
    
    EXTRA_FEES.forEach(activity => {
        const isGD = activity.id === 'global_discovery';
        
        const freqHTML = isGD
            ? `<button class="sibling-freq-btn selected" data-freq="once" data-activity="${activity.id}" 
                style="width:100%;padding:6px;border:2px solid var(--sage,#4a7c59);border-radius:6px;background:var(--sage,#4a7c59);color:white;cursor:pointer;font-size:12px;font-family:inherit;">
                Every Saturday (Monthly)
              </button>`
            : `<div style="display:flex;gap:6px;margin-top:8px;">
                <button class="sibling-freq-btn" data-freq="once" data-activity="${activity.id}"
                  style="flex:1;padding:6px;border:2px solid #dde5de;border-radius:6px;background:white;cursor:pointer;font-size:12px;font-family:inherit;">Once Weekly</button>
                <button class="sibling-freq-btn" data-freq="twice" data-activity="${activity.id}"
                  style="flex:1;padding:6px;border:2px solid #dde5de;border-radius:6px;background:white;cursor:pointer;font-size:12px;font-family:inherit;">Twice Weekly</button>
              </div>`;
        
        const daysHTML = DAYS.map(day => {
            const hidden = isGD && day !== 'Saturday';
            return `<button class="sibling-extra-day-btn" data-day="${day}" data-activity="${activity.id}"
                style="${hidden ? 'display:none;' : ''}padding:4px 8px;border:1.5px solid #dde5de;border-radius:6px;background:white;cursor:pointer;font-size:11px;font-family:inherit;transition:all 0.2s;">
                ${day.substring(0,3)}</button>`;
        }).join('');
        
        const card = document.createElement('div');
        card.className = 'sibling-extra-card';
        card.dataset.activityId = activity.id;
        card.style.cssText = 'background:white;border:2px solid #dde5de;border-radius:10px;padding:12px;cursor:pointer;transition:all 0.2s;margin-bottom:10px;';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                <div style="font-weight:700;color:#1a1f1c;font-size:14px;">${activity.name}</div>
                <div style="font-weight:700;color:var(--sage,#4a7c59);font-size:14px;">₦${activity.fee.toLocaleString()}</div>
            </div>
            ${freqHTML}
            <div class="sibling-extra-details" style="margin-top:10px;padding-top:10px;border-top:1px solid #f1f5f9;">
                <div style="font-size:12px;color:#6b7873;margin-bottom:6px;font-weight:600;">Select Days:</div>
                <div class="sibling-extra-days" style="display:flex;flex-wrap:wrap;gap:5px;">${daysHTML}</div>
                <div class="sibling-day-counter" style="font-size:11px;color:#94a3b8;margin-top:4px;"></div>
            </div>
        `;
        
        container.appendChild(card);
        
        // Card toggle
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('sibling-freq-btn') || e.target.classList.contains('sibling-extra-day-btn')) return;
            card.classList.toggle('sibling-selected');
            card.style.borderColor = card.classList.contains('sibling-selected') ? 'var(--sage,#4a7c59)' : '#dde5de';
            card.style.background = card.classList.contains('sibling-selected') ? 'rgba(74,124,89,0.04)' : 'white';
            if (card.classList.contains('sibling-selected') && !card.querySelector('.sibling-freq-btn.selected') && !isGD) {
                const onceBtn = card.querySelector('[data-freq="once"]');
                if (onceBtn) { onceBtn.classList.add('selected'); onceBtn.style.background = 'var(--sage,#4a7c59)'; onceBtn.style.borderColor = 'var(--sage,#4a7c59)'; onceBtn.style.color = 'white'; }
            }
            _updateSiblingFeeSummary();
        });
        
        // Frequency buttons
        card.querySelectorAll('.sibling-freq-btn').forEach(btn => {
            if (isGD) return; // Global Discovery only has one button
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!card.classList.contains('sibling-selected')) {
                    card.classList.add('sibling-selected');
                    card.style.borderColor = 'var(--sage,#4a7c59)';
                    card.style.background = 'rgba(74,124,89,0.04)';
                }
                card.querySelectorAll('.sibling-freq-btn').forEach(b => {
                    b.classList.remove('selected');
                    b.style.background = 'white';
                    b.style.borderColor = '#dde5de';
                    b.style.color = '';
                });
                btn.classList.add('selected');
                btn.style.background = 'var(--sage,#4a7c59)';
                btn.style.borderColor = 'var(--sage,#4a7c59)';
                btn.style.color = 'white';
                
                // Update day limits
                const newFreq = btn.dataset.freq;
                const maxDays = newFreq === 'twice' ? 2 : 1;
                // Remove excess selections
                const selDays = card.querySelectorAll('.sibling-extra-day-btn.selected');
                Array.from(selDays).slice(maxDays).forEach(d => {
                    d.classList.remove('selected');
                    d.style.background = 'white'; d.style.color = '';
                });
                _updateSiblingDayButtons(card, maxDays);
                _updateSiblingFeeSummary();
            });
        });
        
        // Day buttons
        card.querySelectorAll('.sibling-extra-day-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const aId = btn.dataset.activity;
                const isGDCard = aId === 'global_discovery';
                const freqBtn = card.querySelector('.sibling-freq-btn.selected');
                const freq = freqBtn ? freqBtn.dataset.freq : 'once';
                const maxDays = isGDCard ? 1 : (freq === 'twice' ? 2 : 1);
                
                if (isGDCard && btn.dataset.day !== 'Saturday') return;
                
                if (btn.classList.contains('selected')) {
                    btn.classList.remove('selected');
                    btn.style.background = 'white'; btn.style.color = '';
                } else {
                    const selCount = card.querySelectorAll('.sibling-extra-day-btn.selected').length;
                    if (selCount >= maxDays) {
                        showMessage(`Maximum ${maxDays} day(s) for this frequency. Deselect a day first.`, 'error');
                        return;
                    }
                    btn.classList.add('selected');
                    btn.style.background = 'var(--sage,#4a7c59)'; btn.style.color = 'white';
                    if (!card.classList.contains('sibling-selected')) {
                        card.classList.add('sibling-selected');
                        card.style.borderColor = 'var(--sage,#4a7c59)';
                        card.style.background = 'rgba(74,124,89,0.04)';
                    }
                }
                _updateSiblingDayButtons(card, maxDays);
                _updateSiblingFeeSummary();
            });
        });
    });
}

function _updateSiblingDayButtons(card, maxDays) {
    const selCount = card.querySelectorAll('.sibling-extra-day-btn.selected').length;
    card.querySelectorAll('.sibling-extra-day-btn').forEach(btn => {
        if (!btn.classList.contains('selected')) {
            if (selCount >= maxDays) {
                btn.style.opacity = '0.4'; btn.style.pointerEvents = 'none';
            } else {
                btn.style.opacity = ''; btn.style.pointerEvents = '';
            }
        } else {
            btn.style.opacity = ''; btn.style.pointerEvents = '';
        }
    });
    const counter = card.querySelector('.sibling-day-counter');
    if (counter) counter.textContent = selCount > 0 ? `${selCount} of ${maxDays} day(s) selected` : '';
}

/**
 * Initialize the Test Prep grid for Add Sibling
 */
function _initSiblingTestPrepGrid() {
    const container = document.getElementById('siblingTestPrepGrid');
    if (!container) return;
    
    const TEST_PREP = [
        { id: 'sat', name: 'SAT', rate: 20000 },
        { id: 'igcse', name: 'IGCSE & GCSE', rate: 20000 },
        { id: '11plus', name: '11+ Exam Prep', rate: 15000 }
    ];
    const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    
    container.innerHTML = '';
    
    TEST_PREP.forEach(test => {
        const daysHTML = DAYS.map(day =>
            `<button class="sibling-tp-day-btn" data-day="${day}" data-test="${test.id}"
              style="padding:4px 8px;border:1.5px solid #dde5de;border-radius:6px;background:white;cursor:pointer;font-size:11px;font-family:inherit;transition:all 0.2s;">
              ${day.substring(0,3)}</button>`
        ).join('');
        
        const card = document.createElement('div');
        card.className = 'sibling-tp-card';
        card.dataset.testId = test.id;
        card.style.cssText = 'background:white;border:2px solid #dde5de;border-radius:10px;padding:14px;margin-bottom:10px;';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <div style="font-weight:700;color:#1a1f1c;font-size:14px;">${test.name}</div>
                <div style="font-weight:700;color:var(--sage,#4a7c59);">₦${test.rate.toLocaleString()}/hr</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <label style="font-size:12px;color:#6b7873;">Hours/session:</label>
                <input type="number" class="sibling-tp-hours" min="0" max="8" step="0.5" value="0"
                       style="width:70px;padding:6px;border:1.5px solid #dde5de;border-radius:6px;text-align:center;font-size:14px;"
                       oninput="_updateSiblingFeeSummary()">
                <span style="font-size:12px;color:#6b7873;">hrs</span>
            </div>
            <div style="font-size:12px;color:#6b7873;margin-bottom:6px;font-weight:600;">Select Days:</div>
            <div class="sibling-tp-days" style="display:flex;flex-wrap:wrap;gap:5px;">${daysHTML}</div>
        `;
        container.appendChild(card);
        
        card.querySelectorAll('.sibling-tp-day-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');
                btn.style.background = btn.classList.contains('selected') ? 'var(--sage,#4a7c59)' : 'white';
                btn.style.color = btn.classList.contains('selected') ? 'white' : '';
                const hoursInput = card.querySelector('.sibling-tp-hours');
                if (btn.classList.contains('selected') && hoursInput && parseFloat(hoursInput.value) === 0) {
                    hoursInput.value = 1;
                }
                _updateSiblingFeeSummary();
            });
        });
    });
}

/**
 * Update fee summary to include extracurricular and test prep
 */
function _updateSiblingFeeSummary() {
    // If we're on step 3, update the fee summary display
    if (_addStudentStep >= 3) {
        _updateFeeSummary();
    }
    // Always trigger updateAddStudentFees for real-time feedback
    updateAddStudentFees();
}

/**
 * hideAddStudentModal()
 */
function hideAddStudentModal() {
    const modal = document.getElementById('addStudentModal');
    if (modal) modal.classList.add('hidden');
}

/**
 * togglePickerChip(el)
 * Toggles the "selected" class on subject/day picker chips.
 */
function togglePickerChip(el) {
    el.classList.toggle('selected');
    // Recalculate fees when subjects change (additional subject fee)
    updateAddStudentFees();
}

/**
 * _getOrdinalSuffix(n) — e.g. 1→"st", 2→"nd", 11→"th"
 */
function _getOrdinalSuffix(n) {
    if (n > 3 && n < 21) return 'th';
    switch (n % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

/**
 * _calculateAddStudentFees()
 * Computes the full fee breakdown for the Add Student form.
 * Includes Academic + Extracurricular + Test Prep fees.
 */
function _calculateAddStudentFees() {
    const ACADEMIC_FEES = {
        'preschool':  { twice: 80000,  three: 95000,  five: 150000 },
        'grade2-4':   { twice: 95000,  three: 110000, five: 170000 },
        'grade5-8':   { twice: 105000, three: 120000, five: 180000 },
        'grade9-12':  { twice: 110000, three: 135000, five: 200000 }
    };
    const ADDITIONAL_SUBJECT_FEE = 40000;
    const BASE_SUBJECTS_INCLUDED = 2;
    const WEEKS_PER_MONTH = 4;

    const gradeTier = document.getElementById('newStudentGradeLevel')?.value;
    const sessionChip = document.querySelector('#newStudentSessions .picker-chip.selected');
    const sessionType = sessionChip ? sessionChip.dataset.sessions : null;
    const startDate = document.getElementById('newStudentStartDate')?.value;
    const selectedSubjects = document.querySelectorAll('#newStudentSubjects .picker-chip.selected');
    const subjectCount = selectedSubjects.length;

    const result = {
        baseFee: 0,
        additionalSubjectFee: 0,
        fullMonthlyFee: 0,
        proratedFee: 0,
        prorationDeduction: 0,
        prorationExplanation: '',
        gradeTier: gradeTier || '',
        sessionType: sessionType || '',
        subjectCount: subjectCount,
        extraSubjects: 0,
        extracurricularFee: 0,
        testPrepFee: 0,
        totalFee: 0
    };

    // ── Academic fees ──
    if (gradeTier && sessionType && ACADEMIC_FEES[gradeTier] && ACADEMIC_FEES[gradeTier][sessionType]) {
        result.baseFee = ACADEMIC_FEES[gradeTier][sessionType];
        result.extraSubjects = Math.max(0, subjectCount - BASE_SUBJECTS_INCLUDED);
        result.additionalSubjectFee = result.extraSubjects * ADDITIONAL_SUBJECT_FEE;
        result.fullMonthlyFee = result.baseFee + result.additionalSubjectFee;
        result.proratedFee = result.fullMonthlyFee;

        if (startDate) {
            const start = new Date(startDate);
            const dayOfMonth = start.getDate();
            if (dayOfMonth === 1 || (dayOfMonth >= 2 && dayOfMonth <= 6)) {
                result.prorationExplanation = `Full month fee (starting on ${dayOfMonth}${_getOrdinalSuffix(dayOfMonth)})`;
            } else {
                const year = start.getFullYear();
                const month = start.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const daysRemaining = daysInMonth - dayOfMonth + 1;
                result.proratedFee = Math.round((result.fullMonthlyFee / daysInMonth) * daysRemaining);
                result.prorationDeduction = result.fullMonthlyFee - result.proratedFee;
                result.prorationExplanation = `Prorated: ${daysRemaining}/${daysInMonth} days (starting ${dayOfMonth}${_getOrdinalSuffix(dayOfMonth)})`;
            }
        }
    }

    // ── Extracurricular fees ──
    const extraCards = document.querySelectorAll('.sibling-extra-card.sibling-selected');
    extraCards.forEach(card => {
        const activityId = card.dataset.activityId;
        const isGD = activityId === 'global_discovery';
        const freqBtn = card.querySelector('.sibling-freq-btn.selected');
        const freq = freqBtn ? freqBtn.dataset.freq : 'once';
        const selectedDays = card.querySelectorAll('.sibling-extra-day-btn.selected').length;
        
        if (selectedDays === 0) return;
        
        const EXTRA_FEES_MAP = {
            'comic': 35000, 'graphics': 35000, 'ai': 40000, 'youtube': 40000,
            'animation': 35000, 'videography': 40000, 'music': 45000, 'coding': 45000,
            'sketch': 45000, 'foreign': 55000, 'global_discovery': 50000,
            'native': 30000, 'speaking': 35000, 'bible': 35000, 'chess': 40000
        };
        const baseFee = EXTRA_FEES_MAP[activityId] || 0;
        let fee = isGD ? baseFee : (freq === 'twice' ? baseFee * 2 : baseFee);
        
        // Prorate extra fees
        if (startDate) {
            const start = new Date(startDate);
            const dayOfMonth = start.getDate();
            if (dayOfMonth > 6) {
                const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
                const daysRemaining = daysInMonth - dayOfMonth + 1;
                fee = Math.round((fee / daysInMonth) * daysRemaining);
            }
        }
        result.extracurricularFee += fee;
    });

    // ── Test Prep fees ──
    const TEST_RATES = { 'sat': 20000, 'igcse': 20000, '11plus': 15000 };
    const tpCards = document.querySelectorAll('.sibling-tp-card');
    tpCards.forEach(card => {
        const testId = card.dataset.testId;
        const hours = parseFloat(card.querySelector('.sibling-tp-hours')?.value) || 0;
        const selectedDays = card.querySelectorAll('.sibling-tp-day-btn.selected').length;
        if (hours <= 0 || selectedDays === 0) return;
        
        const rate = TEST_RATES[testId] || 0;
        let fee = hours * rate * selectedDays * WEEKS_PER_MONTH;
        
        // Prorate
        if (startDate) {
            const start = new Date(startDate);
            const dayOfMonth = start.getDate();
            if (dayOfMonth > 6) {
                const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
                const daysRemaining = daysInMonth - dayOfMonth + 1;
                fee = Math.round((fee / daysInMonth) * daysRemaining);
            }
        }
        result.testPrepFee += fee;
    });

    result.totalFee = result.proratedFee + result.extracurricularFee + result.testPrepFee;
    return result;
}

/**
 * Toggle session chip and update fee display
 */
function toggleSessionChip(el) {
    // Deselect other session chips
    document.querySelectorAll('#newStudentSessions .picker-chip').forEach(chip => {
        chip.classList.remove('selected');
    });
    el.classList.add('selected');
    updateAddStudentFees();
}

/**
 * _updateAddStudentStepUI()
 * Shows the correct step panel and updates the stepper bar / buttons.
 */
function _updateAddStudentStepUI() {
    // Update step panels
    for (let i = 1; i <= 4; i++) {
        const panel = document.getElementById(`add-step-${i}`);
        if (panel) panel.classList.toggle('active', i === _addStudentStep);

        const bar = document.getElementById(`stepBar${i}`);
        if (bar) {
            bar.classList.remove('active', 'done');
            if (i < _addStudentStep)  bar.classList.add('done');
            if (i === _addStudentStep) bar.classList.add('active');
        }
    }

    // Update step label
    const stepLabel = document.getElementById('stepLabel');
    if (stepLabel) {
        const labels = ['Student Details', 'Subjects & Schedule', 'Fee Summary', 'Review & Confirm'];
        stepLabel.textContent = `Step ${_addStudentStep} of 4 — ${labels[_addStudentStep-1]}`;
    }

    // Update nav buttons
    const prevBtn   = document.getElementById('addStudentPrevBtn');
    const nextBtn   = document.getElementById('addStudentNextBtn');
    const submitBtn = document.getElementById('addStudentSubmitBtn');

    if (prevBtn)   prevBtn.style.display   = _addStudentStep > 1 ? 'block' : 'none';
    if (nextBtn)   nextBtn.classList.toggle('hidden', _addStudentStep === 4);
    if (submitBtn) submitBtn.classList.toggle('hidden', _addStudentStep !== 4);
}

/**
 * addStudentNext()
 * Validates the current step then advances to the next.
 */
function addStudentNext() {
    if (_addStudentStep === 1) {
        const firstName = document.getElementById('newStudentFirstName')?.value.trim();
        const lastName  = document.getElementById('newStudentLastName')?.value.trim();
        const gender    = document.getElementById('newStudentGender')?.value;
        const dob       = document.getElementById('newStudentDob')?.value;
        const gradeTier = document.getElementById('newStudentGradeLevel')?.value;
        const actualGrade = document.getElementById('newStudentActualGrade')?.value;

        if (!firstName || !lastName || !gender || !dob || !gradeTier || !actualGrade) {
            showMessage('Please fill in all required fields in Step 1', 'error');
            return;
        }
    }

    if (_addStudentStep === 2) {
        const days = document.querySelectorAll('#newStudentDays .picker-chip.selected');
        if (days.length === 0) {
            showMessage('Please select at least one preferred day', 'error');
            return;
        }
        const sessions = document.querySelectorAll('#newStudentSessions .picker-chip.selected');
        if (sessions.length === 0) {
            showMessage('Please select session frequency', 'error');
            return;
        }
    }

    if (_addStudentStep === 3) {
        // Just go to review, no validation needed
    }

    if (_addStudentStep < 4) {
        _addStudentStep++;
        _updateAddStudentStepUI();
    }

    // On step 3, update fee summary
    if (_addStudentStep === 3) {
        _updateFeeSummary();
    }

    // On step 4, populate the review panel
    if (_addStudentStep === 4) {
        _populateAddStudentReview();
    }
}

/**
 * addStudentPrev()
 * Goes back a step.
 */
function addStudentPrev() {
    _addStudentStep = Math.max(1, _addStudentStep - 1);
    _updateAddStudentStepUI();
}

/**
 * Update the fee summary in step 3 based on selections.
 */
function _updateFeeSummary() {
    const gradeTier = document.getElementById('newStudentGradeLevel')?.value;
    const sessionChip = document.querySelector('#newStudentSessions .picker-chip.selected');
    const sessionType = sessionChip ? sessionChip.dataset.sessions : null;
    const summaryDiv = document.getElementById('addStudentFeeSummary');
    const startDate = document.getElementById('newStudentStartDate')?.value;

    if (!summaryDiv) return;

    const ACADEMIC_FEES = {
        'preschool':  { twice: 80000,  three: 95000,  five: 150000 },
        'grade2-4':   { twice: 95000,  three: 110000, five: 170000 },
        'grade5-8':   { twice: 105000, three: 120000, five: 180000 },
        'grade9-12':  { twice: 110000, three: 135000, five: 200000 }
    };

    const ADDITIONAL_SUBJECT_FEE = 40000;
    const BASE_SUBJECTS_INCLUDED = 2;

    const gradeLabels = {
        'preschool': 'Preschool – Grade 1', 'grade2-4': 'Grade 2 – 4',
        'grade5-8': 'Grade 5 – 8', 'grade9-12': 'Grade 9 – 12'
    };
    const sessionLabels = { twice: 'Twice weekly', three: '3× weekly', five: 'Daily (5×)' };

    let proratedAcademicFee = 0;
    let prorationDeduction = 0;
    let prorationNote = '';
    let rows = '';

    if (gradeTier && sessionType && ACADEMIC_FEES[gradeTier] && ACADEMIC_FEES[gradeTier][sessionType]) {
        const baseFee = ACADEMIC_FEES[gradeTier][sessionType];
        const selectedSubjects = document.querySelectorAll('#newStudentSubjects .picker-chip.selected');
        const subjectCount = selectedSubjects.length;
        const extraSubjects = Math.max(0, subjectCount - BASE_SUBJECTS_INCLUDED);
        const additionalSubjectFee = extraSubjects * ADDITIONAL_SUBJECT_FEE;
        const fullMonthlyFee = baseFee + additionalSubjectFee;
        proratedAcademicFee = fullMonthlyFee;

        if (startDate) {
            const start = new Date(startDate);
            const dayOfMonth = start.getDate();
            if (dayOfMonth === 1 || (dayOfMonth >= 2 && dayOfMonth <= 6)) {
                prorationNote = `Full month fee (starting on ${dayOfMonth}${_getOrdinalSuffix(dayOfMonth)})`;
            } else {
                const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
                const daysRemaining = daysInMonth - dayOfMonth + 1;
                proratedAcademicFee = Math.round((fullMonthlyFee / daysInMonth) * daysRemaining);
                prorationDeduction = fullMonthlyFee - proratedAcademicFee;
                prorationNote = `Prorated: ${daysRemaining}/${daysInMonth} days (starting ${dayOfMonth}${_getOrdinalSuffix(dayOfMonth)})`;
            }
        }

        rows += `
            <tr><td>Grade Tier:</td><td style="text-align:right;font-weight:600;">${gradeLabels[gradeTier] || gradeTier}</td></tr>
            <tr><td>Session Frequency:</td><td style="text-align:right;font-weight:600;">${sessionLabels[sessionType] || sessionType}</td></tr>
            <tr><td>Academic Tuition:</td><td style="text-align:right;font-weight:600;">₦${baseFee.toLocaleString()}</td></tr>
        `;
        if (extraSubjects > 0) {
            rows += `<tr><td>Extra Subjects (${extraSubjects}×):</td><td style="text-align:right;font-weight:600;color:#D97706;">+₦${additionalSubjectFee.toLocaleString()}</td></tr>`;
        }
        if (prorationDeduction > 0) {
            rows += `<tr><td>Proration Discount:</td><td style="text-align:right;font-weight:600;color:#10B981;">-₦${prorationDeduction.toLocaleString()}</td></tr>`;
        }
    }

    // Extracurricular from sibling grid
    const feeCalc = _calculateAddStudentFees();
    
    if (feeCalc.extracurricularFee > 0) {
        rows += `<tr><td>Extracurricular:</td><td style="text-align:right;font-weight:600;color:#3b82f6;">+₦${feeCalc.extracurricularFee.toLocaleString()}</td></tr>`;
    }
    if (feeCalc.testPrepFee > 0) {
        rows += `<tr><td>Test Preparation:</td><td style="text-align:right;font-weight:600;color:#7c3aed;">+₦${feeCalc.testPrepFee.toLocaleString()}</td></tr>`;
    }

    const grandTotal = feeCalc.totalFee;

    if (rows) {
        rows += `<tr><td style="padding-top:8px;border-top:1px dashed #ccc;font-weight:700;">Total First Month:</td>
                 <td style="padding-top:8px;border-top:1px dashed #ccc;text-align:right;font-weight:800;color:var(--sage-dark,#2f5240);font-size:1.1rem;">₦${grandTotal.toLocaleString()}</td></tr>`;
        summaryDiv.innerHTML = `
            <div style="margin-bottom:12px;font-weight:700;font-size:1rem;">Estimated Monthly Fees</div>
            <table style="width:100%;border-collapse:collapse;">${rows}</table>
            ${prorationNote ? `<p style="margin-top:8px;font-size:0.75rem;color:#64748b;">${prorationNote}</p>` : ''}
            <p style="margin-top:12px;font-size:0.75rem;color:#94a3b8;">Fees are estimates and subject to confirmation by staff.</p>
        `;
    } else {
        summaryDiv.innerHTML = '<p style="color:#94a3b8;">Select grade tier and session frequency to see estimated fees.</p>';
    }
}

/**
 * UpdateAddStudentFees (called from HTML onchange of grade tier, subjects, sessions, start date)
 */
function updateAddStudentFees() {
    // Always recalculate when fields change — the summary is shown on step 3
    if (_addStudentStep >= 2) {
        _updateFeeSummary();
    }
}

/**
 * _populateAddStudentReview()
 * Fills the review panel (step 4) with the collected data.
 */
function _populateAddStudentReview() {
    const reviewDiv = document.getElementById('addStudentReview');
    if (!reviewDiv) return;

    const firstName = document.getElementById('newStudentFirstName')?.value.trim() || '—';
    const lastName  = document.getElementById('newStudentLastName')?.value.trim() || '—';
    const fullName  = firstName + ' ' + lastName;
    const gender    = document.getElementById('newStudentGender')?.value || '—';
    const dob       = document.getElementById('newStudentDob')?.value || '—';
    const gradeTier = document.getElementById('newStudentGradeLevel')?.value || '—';
    const actualGrade = document.getElementById('newStudentActualGrade')?.value || '—';
    const start     = document.getElementById('newStudentStartDate')?.value || '—';

    const subjects = Array.from(
        document.querySelectorAll('#newStudentSubjects .picker-chip.selected')
    ).map(c => c.dataset.subject).join(', ') || 'None selected';

    const days = Array.from(
        document.querySelectorAll('#newStudentDays .picker-chip.selected')
    ).map(c => c.dataset.day).join(', ');

    const sessionChip = document.querySelector('#newStudentSessions .picker-chip.selected');
    const sessionLabel = sessionChip ? sessionChip.textContent : 'Not selected';

    const startHour = document.getElementById('newStudentStartHour')?.value;
    const endHour   = document.getElementById('newStudentEndHour')?.value;
    const timeStr   = startHour && endHour
        ? `${_formatHour(startHour)} – ${_formatHour(endHour)}`
        : 'Not specified';

    const tutor = document.getElementById('newStudentTutor')?.value || 'No preference';

    const gradeLabels = {
        'preschool': 'Preschool',
        'kindergarten': 'Kindergarten',
        'grade1': 'Grade 1', 'grade2': 'Grade 2', 'grade3': 'Grade 3',
        'grade4': 'Grade 4', 'grade5': 'Grade 5', 'grade6': 'Grade 6',
        'grade7': 'Grade 7', 'grade8': 'Grade 8', 'grade9': 'Grade 9',
        'grade10': 'Grade 10', 'grade11': 'Grade 11', 'grade12': 'Grade 12'
    };

    const tierLabels = {
        'preschool': 'Preschool – Grade 1',
        'grade2-4': 'Grade 2 – 4',
        'grade5-8': 'Grade 5 – 8',
        'grade9-12': 'Grade 9 – 12'
    };

    const genderLabel = {
        'male': 'Male', 'female': 'Female', 'other': 'Other'
    };

    // Calculate fee for review display
    const feeCalc = _calculateAddStudentFees();
    const feeDisplay = feeCalc.proratedFee > 0
        ? `₦${feeCalc.proratedFee.toLocaleString()}${feeCalc.prorationDeduction > 0 ? ' (prorated)' : ''}`
        : 'Select grade & sessions';

    reviewDiv.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
            ${_reviewRow('👤 Full Name', escapeHtml(fullName))}
            ${_reviewRow('⚧ Gender', escapeHtml(genderLabel[gender] || gender))}
            ${_reviewRow('🎂 Date of Birth', escapeHtml(dob))}
            ${_reviewRow('🎓 Grade Tier', escapeHtml(tierLabels[gradeTier] || gradeTier))}
            ${_reviewRow('📚 Actual Grade', escapeHtml(gradeLabels[actualGrade] || actualGrade))}
            ${_reviewRow('📅 Start Date', escapeHtml(start))}
            ${_reviewRow('📚 Subjects', escapeHtml(subjects))}
            ${_reviewRow('📆 Days', escapeHtml(days))}
            ${_reviewRow('🕐 Class Time', escapeHtml(timeStr))}
            ${_reviewRow('🔄 Sessions/Week', escapeHtml(sessionLabel))}
            ${_reviewRow('👩‍🏫 Tutor Pref.', escapeHtml(tutor))}
            ${_reviewRow('💰 Est. First Month', feeDisplay)}
        </table>
    `;
}

function _reviewRow(label, value) {
    return `
        <tr style="border-bottom:1px solid #D1FAE5;">
            <td style="padding:8px 4px;font-weight:600;color:#065f46;width:42%;">${label}</td>
            <td style="padding:8px 4px;color:#374151;">${value}</td>
        </tr>
    `;
}

function _formatHour(h) {
    const hour = parseInt(h);
    const suffix = hour < 12 ? 'AM' : 'PM';
    const display = hour % 12 || 12;
    return `${display}:00 ${suffix}`;
}

/**
 * submitNewStudent()
 * Saves the new student to pending_students collection with the parent's phone
 * number so comprehensiveFindChildren() will pick them up immediately.
 * Mirrors the data structure used in the enrollment portal.
 */
async function submitNewStudent() {
    const submitBtn  = document.getElementById('addStudentSubmitBtn');
    const submitText = document.getElementById('addStudentSubmitText');
    const spinner    = document.getElementById('addStudentSubmitSpinner');

    if (submitBtn) submitBtn.disabled = true;
    if (spinner)   spinner.classList.remove('hidden');
    if (submitText) submitText.textContent = 'Saving…';

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('You must be signed in.');

        // Fetch parent's phone number from their profile
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        if (!userDoc.exists) throw new Error('Parent profile not found.');
        const parentData = userDoc.data();
        const parentPhone   = parentData.normalizedPhone || parentData.phone || '';
        const parentEmail   = (parentData.email || '').toLowerCase();
        const parentName    = parentData.parentName || 'Parent';

        // Collect form data
        const firstName = document.getElementById('newStudentFirstName')?.value.trim();
        const lastName  = document.getElementById('newStudentLastName')?.value.trim();
        const name      = firstName + ' ' + lastName;
        const gender    = document.getElementById('newStudentGender')?.value;
        const dob       = document.getElementById('newStudentDob')?.value;
        const gradeTier = document.getElementById('newStudentGradeLevel')?.value;
        const actualGrade = document.getElementById('newStudentActualGrade')?.value;
        const start     = document.getElementById('newStudentStartDate')?.value;

        const subjects = Array.from(
            document.querySelectorAll('#newStudentSubjects .picker-chip.selected')
        ).map(c => c.dataset.subject);

        const days = Array.from(
            document.querySelectorAll('#newStudentDays .picker-chip.selected')
        ).map(c => c.dataset.day);

        const sessionChip = document.querySelector('#newStudentSessions .picker-chip.selected');
        const sessions = sessionChip ? sessionChip.dataset.sessions : '';

        const startHour = document.getElementById('newStudentStartHour')?.value || '';
        const endHour   = document.getElementById('newStudentEndHour')?.value || '';
        const academicTime = startHour && endHour ? `${startHour}:${endHour}` : '';

        const tutor = document.getElementById('newStudentTutor')?.value || '';

        if (!name) throw new Error('Student name is required.');

        // ── Calculate fees using the same logic as enrollment portal ──
        const feeCalc = _calculateAddStudentFees();

        // ── Collect extracurricular data ──
        const extracurriculars = [];
        document.querySelectorAll('.sibling-extra-card.sibling-selected').forEach(card => {
            const activityId = card.dataset.activityId;
            const freqBtn = card.querySelector('.sibling-freq-btn.selected');
            const freq = freqBtn ? freqBtn.dataset.freq : 'once';
            const selDays = Array.from(card.querySelectorAll('.sibling-extra-day-btn.selected')).map(b => b.dataset.day);
            if (selDays.length > 0) {
                extracurriculars.push({ id: activityId, frequency: freq, days: selDays });
            }
        });

        // ── Collect test prep data ──
        const testPrep = [];
        document.querySelectorAll('.sibling-tp-card').forEach(card => {
            const testId = card.dataset.testId;
            const hours = parseFloat(card.querySelector('.sibling-tp-hours')?.value) || 0;
            const selDays = Array.from(card.querySelectorAll('.sibling-tp-day-btn.selected')).map(b => b.dataset.day);
            if (hours > 0 && selDays.length > 0) {
                testPrep.push({ id: testId, hours, days: selDays });
            }
        });

        // Build academic schedule string (mirrors enrollment portal format)
        let academicSchedule = '';
        if (days.length > 0 && startHour && endHour) {
            const startTime = `${parseInt(startHour) % 12 || 12} ${parseInt(startHour) < 12 ? 'AM' : 'PM'}`;
            const endTime   = `${parseInt(endHour) % 12 || 12} ${parseInt(endHour) < 12 ? 'AM' : 'PM'}`;
            academicSchedule = `${days.join(', ')} from ${startTime} to ${endTime}`;
        }

        // Build Firestore document — matches the schema used by enrollment portal
        const studentDoc = {
            // ── Student info ──
            studentName:      name,
            name:             name,
            gender:           gender,
            dob:              dob,
            actualGrade:      actualGrade,
            grade:            gradeTier,
            startDate:        start,
            selectedSubjects: subjects,
            academicDays:     days,
            academicTime:     academicTime,
            academicSchedule: academicSchedule,
            academicSessions: sessions,
            preferredTutor:   tutor,
            // ── Parent linkage (used by comprehensiveFindChildren) ──
            parentPhone:      parentPhone,
            parentEmail:      parentEmail,
            parentName:       parentName,
            parentUid:        user.uid,
            // ── Fee summary — mirrors enrollment portal's summary structure ──
            summary: {
                totalFee:              feeCalc.totalFee || feeCalc.proratedFee,
                academicFee:           feeCalc.baseFee,
                additionalSubjectFee:  feeCalc.additionalSubjectFee,
                fullMonthlyFee:        feeCalc.fullMonthlyFee,
                proratedAmount:        feeCalc.prorationDeduction,
                prorationExplanation:  feeCalc.prorationExplanation,
                extracurricularFee:    feeCalc.extracurricularFee || 0,
                testPrepFee:           feeCalc.testPrepFee || 0,
                discountAmount:        0
            },
            // ── Wrap student in the students array format used by enrollment portal ──
            parent: {
                name:  parentName,
                email: parentEmail,
                phone: parentPhone
            },
            students: [{
                id: 1,
                name: name,
                gender: gender,
                dob: dob,
                grade: gradeTier,
                actualGrade: actualGrade,
                startDate: start,
                preferredTutor: tutor,
                academicSessions: sessions,
                selectedSubjects: subjects,
                academicDays: days,
                academicTime: academicTime,
                academicSchedule: academicSchedule,
                extracurriculars: extracurriculars,
                testPrep: testPrep
            }],
            // ── Status / meta ──
            status:           'pending',
            addedFromPortal:  true,
            createdAt:        firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt:        firebase.firestore.FieldValue.serverTimestamp(),
            timestamp:        new Date().toISOString()
        };

        // Save to enrollments collection — same collection used by enrollment portal
        const docRef = await db.collection('enrollments').add(studentDoc);


        // Invalidate both caches so the dashboard reloads fresh
        dataCache.invalidate();
        if (auth.currentUser) persistentCache.invalidate(auth.currentUser.uid);

        showMessage(`${name} has been added! Estimated first month fee: ₦${(feeCalc.totalFee || feeCalc.proratedFee).toLocaleString()}`, 'success');
        hideAddStudentModal();

        // Reload reports and academics to show the new student
        setTimeout(() => {
            if (window.authManager && authManager.currentUser) {
                loadAllReportsForParent(authManager.currentUser.normalizedPhone, user.uid, true);
                // Clear academics cache to force reload on next tab visit
                const ac = document.getElementById('academicsContent');
                if (ac) ac.innerHTML = '';
            }
        }, 1500);

    } catch (err) {
        console.error('submitNewStudent error:', err);
        showMessage(`Failed to add student: ${err.message}`, 'error');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (spinner)   spinner.classList.add('hidden');
        if (submitText) submitText.textContent = '✅ Submit Enrolment';
    }
}

// ============================================================================
// PRIVACY POLICY & TERMS OF USE MODAL
// ============================================================================

const _PRIVACY_CONTENT = {
    privacy: {
        title: '🔒 Privacy Policy',
        body: `
<div class="policy-section">
    <h4>1. Information We Collect</h4>
    <p>We collect personal information that you provide directly to us when you create an account, enrol a student, or contact us. This includes names, email addresses, phone numbers, and academic information relating to enrolled students.</p>
</div>
<div class="policy-section">
    <h4>2. How We Use Your Information</h4>
    <p>We use the information we collect to provide, maintain, and improve our tutoring services; to communicate with you about sessions, assignments, and reports; to process enrolments and payments; and to comply with legal obligations.</p>
</div>
<div class="policy-section">
    <h4>3. Information Sharing</h4>
    <p>We do not sell, trade, or rent your personal information to third parties. Information is shared only with tutors and staff assigned to your child's sessions, and only to the extent necessary to deliver educational services.</p>
</div>
<div class="policy-section">
    <h4>4. Data Security</h4>
    <p>We implement industry-standard security measures including encrypted data storage via Google Firebase, HTTPS-only transmission, and session-based authentication. However, no system is 100% secure and we cannot guarantee absolute security.</p>
</div>
<div class="policy-section">
    <h4>5. Student Data (Children Under 18)</h4>
    <p>We collect academic data about minors solely for educational service delivery. Parents/guardians retain full rights to access, correct, or request deletion of their child's data by contacting us at support@bloomingkidshouse.com.</p>
</div>
<div class="policy-section">
    <h4>6. Cookies &amp; Local Storage</h4>
    <p>We use browser local storage to remember your login preference ("Remember Me") and session state. No third-party tracking cookies are used in this portal.</p>
</div>
<div class="policy-section">
    <h4>7. Data Retention</h4>
    <p>Student and parent data is retained for the duration of enrolment plus 2 years. You may request earlier deletion by contacting support.</p>
</div>
<div class="policy-section">
    <h4>8. Contact Us</h4>
    <p>For privacy questions or data requests, email us at <a href="mailto:support@bloomingkidshouse.com" style="color:var(--green-primary);">support@bloomingkidshouse.com</a>.</p>
</div>
<p style="font-size:0.78rem;color:#9CA3AF;margin-top:16px;font-family:'DM Sans',sans-serif;">Last updated: January 2025</p>`
    },
    terms: {
        title: '📜 Terms of Use',
        body: `
<div class="policy-section">
    <h4>1. Acceptance of Terms</h4>
    <p>By accessing and using the Blooming Kids House Parent Portal, you agree to be bound by these Terms of Use. If you do not agree with any part of these terms, please discontinue use immediately.</p>
</div>
<div class="policy-section">
    <h4>2. Account Responsibilities</h4>
    <p>You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. Notify us immediately of any unauthorised use of your account.</p>
</div>
<div class="policy-section">
    <h4>3. Permitted Use</h4>
    <p>This portal is provided exclusively for parents and guardians of enrolled students to monitor academic progress, communicate with staff, manage enrolments, and access reports. Any other use is prohibited.</p>
</div>
<div class="policy-section">
    <h4>4. Prohibited Activities</h4>
    <p>You may not use this portal to: share login credentials with unauthorised parties; attempt to access other users' data; upload malicious content; or circumvent any security measures.</p>
</div>
<div class="policy-section">
    <h4>5. Intellectual Property</h4>
    <p>All content, reports, and materials generated by Blooming Kids House tutors remain the intellectual property of Blooming Kids House. Reports are for personal, non-commercial use only.</p>
</div>
<div class="policy-section">
    <h4>6. Disclaimer</h4>
    <p>This portal is provided "as is" without warranties of any kind. We are not liable for any interruptions in service, data loss, or indirect damages arising from your use of the portal.</p>
</div>
<div class="policy-section">
    <h4>7. Changes to Terms</h4>
    <p>We reserve the right to update these Terms of Use at any time. Continued use of the portal after changes constitutes acceptance of the revised terms.</p>
</div>
<div class="policy-section">
    <h4>8. Governing Law</h4>
    <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>
</div>
<p style="font-size:0.78rem;color:#9CA3AF;margin-top:16px;font-family:'DM Sans',sans-serif;">Last updated: January 2025</p>`
    }
};

/**
 * showPrivacyModal(type = 'privacy')
 * Opens the Privacy Policy or Terms of Use modal.
 */
function showPrivacyModal(type = 'privacy') {
    const modal     = document.getElementById('privacyModal');
    const titleEl   = document.getElementById('privacyModalTitle');
    const bodyEl    = document.getElementById('privacyModalBody');

    if (!modal || !titleEl || !bodyEl) return;

    const content = _PRIVACY_CONTENT[type] || _PRIVACY_CONTENT.privacy;
    titleEl.textContent = content.title;
    bodyEl.innerHTML    = content.body;
    modal.classList.remove('hidden');
}

/**
 * hidePrivacyModal()
 */
function hidePrivacyModal() {
    const modal = document.getElementById('privacyModal');
    if (modal) modal.classList.add('hidden');
}

// ============================================================================
// REPORT DOWNLOAD — Enhanced with reliable PDF generation
// ============================================================================

/**
 * downloadReportAsPDF(elementId, fileName)
 * Generates a PDF from any visible element using html2pdf.js
 */
function downloadReportAsPDF(elementId, fileName) {
    const element = document.getElementById(elementId);
    if (!element) {
        showMessage('Report element not found. Please expand the report first.', 'error');
        return;
    }

    if (typeof html2pdf === 'undefined') {
        showMessage('PDF library not loaded. Please refresh the page and try again.', 'error');
        return;
    }

    const safeFileName = (fileName || 'BKH_Report').replace(/[^a-zA-Z0-9_\-]/g, '_') + '.pdf';

    showMessage('Generating PDF…', 'success');

    const opt = {
        margin:      [0.5, 0.5, 0.5, 0.5],
        filename:    safeFileName,
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
        jsPDF:       { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().catch(err => {
        console.error('PDF generation error:', err);
        showMessage('PDF generation failed. Try a different browser.', 'error');
    });
}

// ============================================================================
// ACADEMICS — Enhanced display with real subject/schedule data from student record
// ============================================================================

/**
 * buildStudentInfoTiles(studentData)
 * Creates the schedule/subject info tiles shown in the academics panel
 * using the actual data stored in the student's Firestore record.
 * This augments the existing loadAcademicsData function output.
 */
function buildStudentInfoTiles(studentData) {
    if (!studentData) return '';

    const data = studentData.data || studentData;

    const subjects = data.selectedSubjects?.length
        ? data.selectedSubjects.join(', ')
        : data.subjects?.join(', ') || 'Not specified';

    // Safely handle academicDays – if it's an array, join; if string, use as is; otherwise default
    let schedule = 'Not specified';
    if (Array.isArray(data.academicDays)) {
        schedule = data.academicDays.join(', ');
        if (data.academicTime) schedule += ' ' + data.academicTime;
    } else if (typeof data.academicDays === 'string') {
        schedule = data.academicDays;
        if (data.academicTime) schedule += ' ' + data.academicTime;
    } else if (data.academicSchedule) {
        schedule = data.academicSchedule;
    }

    const grade = data.actualGrade || data.grade || data.schoolGrade || 'Not specified';
    const tutor = data.preferredTutor || data.tutorPreference || data.tutor || 'No preference';
    const sessions = data.academicSessions || data.sessions || 'Not specified';

    return `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;" class="student-info-tiles">
            <div class="info-tile">
                <span class="info-tile-icon">📚</span>
                <div class="info-tile-text">
                    <h5>Subjects</h5>
                    <p>${escapeHtml(subjects)}</p>
                </div>
            </div>
            <div class="info-tile">
                <span class="info-tile-icon">📅</span>
                <div class="info-tile-text">
                    <h5>Class Schedule</h5>
                    <p>${escapeHtml(schedule)}</p>
                </div>
            </div>
            <div class="info-tile">
                <span class="info-tile-icon">🎓</span>
                <div class="info-tile-text">
                    <h5>Grade Level</h5>
                    <p>${escapeHtml(grade)}</p>
                </div>
            </div>
            <div class="info-tile">
                <span class="info-tile-icon">🔄</span>
                <div class="info-tile-text">
                    <h5>Sessions / Week</h5>
                    <p>${escapeHtml(String(sessions))}</p>
                </div>
            </div>
        </div>
    `;
}

// Patch loadAcademicsData to inject info tiles
const _originalLoadAcademicsData = window.loadAcademicsData || (typeof loadAcademicsData === 'function' ? loadAcademicsData : null);

window.loadAcademicsData = async function(selectedStudent = null) {
    // Call the original function first
    if (_originalLoadAcademicsData) {
        await _originalLoadAcademicsData(selectedStudent);
    }

    // After the original renders, inject the student info tiles if missing
    setTimeout(() => {
        const academicsContent = document.getElementById('academicsContent');
        if (!academicsContent) return;

        // Find student section headers and inject tiles before them if not already present
        const studentHeaders = academicsContent.querySelectorAll('[class*="from-green-100"]');
        studentHeaders.forEach(header => {
            const studentNameEl = header.querySelector('h2');
            if (!studentNameEl) return;

            const studentName = studentNameEl.textContent.trim().split(' ')[0]; // first word
            const studentInfo = allStudentData.find(s =>
                capitalize(s.name).startsWith(studentName)
            );

            if (studentInfo && !header.nextElementSibling?.classList.contains('student-info-tiles')) {
                const tilesDiv = document.createElement('div');
                tilesDiv.innerHTML = buildStudentInfoTiles(studentInfo);
                header.after(tilesDiv.firstElementChild);
            }
        });
    }, 300);
};

// ============================================================================
// EXPORT NEW GLOBALS
// ============================================================================

window.showAddStudentModal  = showAddStudentModal;
window.hideAddStudentModal  = hideAddStudentModal;
window.addStudentNext       = addStudentNext;
window.addStudentPrev       = addStudentPrev;
window.togglePickerChip     = togglePickerChip;
window.toggleSessionChip    = toggleSessionChip;
window.updateAddStudentFees = updateAddStudentFees;
window.submitNewStudent     = submitNewStudent;
window.showPrivacyModal     = showPrivacyModal;
window.hidePrivacyModal     = hidePrivacyModal;
window.downloadReportAsPDF  = downloadReportAsPDF;
window.buildStudentInfoTiles = buildStudentInfoTiles;

window.toggleFab            = toggleFab;
window.closeFab             = closeFab;
window.openFabTab           = openFabTab;
window.switchFabModalTab    = switchFabModalTab;
window.showFeedbackModal    = showFeedbackModal;
window.hideFeedbackModal    = hideFeedbackModal;
window.showResponsesModal   = showResponsesModal;
window.hideResponsesModal   = hideResponsesModal;
window.initFab              = initFab;
window.injectFabHtml        = injectFabHtml;
window._populateFabStudentDropdown = _populateFabStudentDropdown;
window._calculateAddStudentFees    = _calculateAddStudentFees;
window.switchMainTab        = switchMainTab;
