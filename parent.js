// ============================================================================
// FIREBASE CONFIGURATION
// ⚠️ SECURITY NOTE: Restrict this API key in the Google Cloud Console to only
// allow traffic from your production domain(s).
// ============================================================================

firebase.initializeApp({
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
});

const db = firebase.firestore();
const auth = firebase.auth();

// ============================================================================
// SECTION 1: CORE UTILITIES & SECURITY
// ============================================================================

function escapeHtml(text) {
    if (typeof text !== 'string') return text ?? '';
    const map = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#039;', '`': '&#x60;', '/': '&#x2F;', '=': '&#x3D;'
    };
    return text.replace(/[&<>"'`/=]/g, m => map[m]);
}

function sanitizeInput(input) {
    return typeof input === 'string' ? escapeHtml(input.trim()) : input;
}

// safeText: for textContent/display; escapeHtml: for innerHTML insertion
function safeText(text) {
    if (typeof text !== 'string') return text ?? '';
    return text.trim();
}

function capitalize(str) {
    if (!str || typeof str !== 'string') return '';
    return safeText(str).replace(/\b\w/g, l => l.toUpperCase());
}

// ── Phone Utilities ──────────────────────────────────────────────────────────

const _phoneSuffixCache = new Map();

function extractPhoneSuffix(phone) {
    if (!phone) return '';
    const key = String(phone);
    if (_phoneSuffixCache.has(key)) return _phoneSuffixCache.get(key);
    const suffix = key.replace(/\D/g, '').slice(-10);
    // Limit cache size to prevent unbounded memory growth
    if (_phoneSuffixCache.size >= 1000) {
        const firstKey = _phoneSuffixCache.keys().next().value;
        _phoneSuffixCache.delete(firstKey);
    }
    _phoneSuffixCache.set(key, suffix);
    return suffix;
}

function extractPhoneDigits(phone) {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '');
}

function comparePhonesByDigits(phone1, phone2) {
    if (!phone1 || !phone2) return false;
    try {
        const s1 = extractPhoneSuffix(phone1);
        const s2 = extractPhoneSuffix(phone2);
        if (!s1 || !s2) return false;
        return s1 === s2 || extractPhoneDigits(phone1) === extractPhoneDigits(phone2);
    } catch {
        return false;
    }
}

function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
        return { normalized: null, valid: false, error: 'Invalid input' };
    }
    try {
        let cleaned = phone.replace(/[^\d+]/g, '');
        if (!cleaned) return { normalized: null, valid: false, error: 'Empty phone number' };

        if (cleaned.startsWith('+')) {
            cleaned = '+' + cleaned.slice(1).replace(/\+/g, '');
        } else {
            cleaned = '+1' + cleaned.replace(/^0+/, '');
        }
        return { normalized: cleaned, valid: true, error: null };
    } catch (err) {
        return { normalized: null, valid: false, error: safeText(err.message) };
    }
}

// ============================================================================
// SECTION 2: GLOBAL STATE
// ============================================================================

let currentUserData  = null;
let userChildren     = [];
let studentIdMap     = new Map();
let allStudentData   = [];
let realTimeListeners = [];
let charts           = new Map();
let pendingRequests  = new Set();
let pendingChartInits = []; // Chart configs waiting for DOM insertion

if (!window.realTimeIntervals) window.realTimeIntervals = [];

// ============================================================================
// SECTION 3: UI MESSAGE SYSTEM
// ============================================================================

function showMessage(message, type = 'info') {
    const existing = document.querySelector('.message-toast');
    if (existing) existing.remove();

    const colors = {
        error:   'bg-red-500 text-white',
        success: 'bg-green-500 text-white',
        warning: 'bg-yellow-500 text-white',
        info:    'bg-blue-500 text-white'
    };

    const div = document.createElement('div');
    div.className = `message-toast fixed top-4 right-4 p-4 rounded-xl shadow-lg z-50 max-w-sm fade-in slide-down ${colors[type] || colors.info}`;
    div.textContent = `BKH: ${safeText(message)}`;
    document.body.appendChild(div);

    setTimeout(() => { if (div.parentNode) div.remove(); }, 5000);
}

function showSkeletonLoader(elementId, type = 'default') {
    const el = document.getElementById(elementId);
    if (!el) return;

    const skeletons = {
        dashboard: `
            <div class="space-y-6">
                <div class="skeleton skeleton-title"></div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                </div>
                <div class="skeleton skeleton-card h-64"></div>
            </div>`,
        reports: `
            <div class="space-y-4">
                <div class="skeleton skeleton-title w-1/2"></div>
                ${[0,1,2].map(() => `
                    <div class="border rounded-lg p-4">
                        <div class="skeleton skeleton-text w-3/4"></div>
                        <div class="skeleton skeleton-text w-1/2 mt-2"></div>
                        <div class="skeleton skeleton-text w-full mt-4 h-20"></div>
                    </div>`).join('')}
            </div>`,
        default: `
            <div class="text-center py-8">
                <div class="loading-spinner mx-auto"></div>
                <p class="text-green-600 font-semibold mt-4">Loading...</p>
            </div>`
    };

    el.innerHTML = skeletons[type] || skeletons.default;
}

// ============================================================================
// SECTION 4: DATE & TIME UTILITIES
// ============================================================================

function _toDateObj(date) {
    if (date?.toDate) return date.toDate();
    if (date instanceof Date) return date;
    if (typeof date === 'string') return new Date(date);
    if (typeof date === 'number') return new Date(date < 10000000000 ? date * 1000 : date);
    return null;
}

function formatDetailedDate(date, showTimezone = false) {
    const d = _toDateObj(date);
    if (!d || isNaN(d.getTime())) return 'Unknown date';

    const opts = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    if (showTimezone) opts.timeZoneName = 'short';

    let formatted = d.toLocaleDateString('en-US', opts);
    if (showTimezone) formatted += ` (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
    return formatted;
}

function getYearMonthFromDate(date) {
    const d = _toDateObj(date);
    if (!d || isNaN(d.getTime())) return { year: 0, month: 0 };
    return { year: d.getFullYear(), month: d.getMonth() };
}

function getTimestamp(dateInput) {
    if (!dateInput) return 0;
    const d = _toDateObj(dateInput);
    return d ? d.getTime() : 0;
}

function getTimestampFromData(data) {
    if (!data) return 0;
    const fields = ['timestamp', 'createdAt', 'submittedAt', 'date', 'updatedAt', 'assignedDate', 'dueDate'];
    for (const f of fields) {
        if (data[f]) {
            const ts = getTimestamp(data[f]);
            if (ts > 0) return Math.floor(ts / 1000);
        }
    }
    // Return 0 (not current time) to avoid corrupting sort order for undated documents
    return 0;
}

// ============================================================================
// SECTION 5: MONTH DISPLAY LOGIC
// ============================================================================

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function getMonthDisplayLogic() {
    const day = new Date().getDate();
    return { showCurrentMonth: true, showPreviousMonth: day <= 2 };
}

function getCurrentMonthYear() {
    const now = new Date();
    return { month: now.getMonth(), year: now.getFullYear(), monthName: MONTH_NAMES[now.getMonth()] };
}

function getPreviousMonthYear() {
    const last = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    return { month: last.getMonth(), year: last.getFullYear(), monthName: MONTH_NAMES[last.getMonth()] };
}

// ============================================================================
// SECTION 6: CSS INJECTION
// ============================================================================

function injectCustomCSS() {
    const style = document.createElement('style');
    style.textContent = `
        .skeleton {
            background: linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);
            background-size: 200% 100%;
            animation: skeletonLoad 1.5s infinite;
            border-radius: 4px;
        }
        @keyframes skeletonLoad { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .skeleton-text  { height:1em; margin-bottom:.5em; }
        .skeleton-title { height:1.8em; margin-bottom:1em; width:70%; }
        .skeleton-card  { height:150px; border-radius:8px; margin-bottom:1rem; }

        .accordion-content { transition: all 0.3s cubic-bezier(.4,0,.2,1); overflow:hidden; }
        .accordion-content.hidden { max-height:0!important; opacity:0; padding-top:0!important; padding-bottom:0!important; }
        .accordion-content:not(.hidden) { max-height:5000px; opacity:1; }

        .fade-in   { animation: fadeIn .3s ease-in-out; }
        .slide-down{ animation: slideDown .3s ease-out; }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideDown { from{transform:translateY(-10px);opacity:0} to{transform:translateY(0);opacity:1} }

        .loading-spinner {
            border:3px solid rgba(0,0,0,.1); border-radius:50%;
            border-top:3px solid #10B981; width:40px; height:40px;
            animation: spin 1s linear infinite;
        }
        .loading-spinner-small {
            border:2px solid rgba(0,0,0,.1); border-radius:50%;
            border-top:2px solid #10B981; width:16px; height:16px;
            animation: spin 1s linear infinite; display:inline-block;
        }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }

        .btn-glow:hover { box-shadow:0 0 15px rgba(16,185,129,.5); }
        .notification-pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%{transform:scale(1)} 50%{transform:scale(1.1)} 100%{transform:scale(1)} }

        .accordion-header { transition:all .2s ease; }
        .accordion-header:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,.1); }
        .chart-container { position:relative; height:300px; width:100%; }
        .progress-accordion-content { transition:all .4s cubic-bezier(.4,0,.2,1); overflow:hidden; }
        .progress-accordion-content.hidden { max-height:0!important; opacity:0; transform:translateY(-10px); }
        .progress-accordion-content:not(.hidden) { max-height:5000px; opacity:1; transform:translateY(0); }
        .performance-excellent { color:#10B981; background-color:#D1FAE5; }
        .performance-good      { color:#F59E0B; background-color:#FEF3C7; }
        .performance-needs-improvement { color:#EF4444; background-color:#FEE2E2; }

        @media(max-width:768px){
            .mobile-stack{ flex-direction:column!important; }
            .mobile-full-width{ width:100%!important; }
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// SECTION 7: PHONE COUNTRY-CODE DROPDOWN
// ============================================================================

function createCountryCodeDropdown() {
    const phoneInput = document.getElementById('signupPhone');
    if (!phoneInput || !phoneInput.parentNode) return;

    const countries = [
        { code:'+1',   name:'USA/Canada (+1)' },    { code:'+234', name:'Nigeria (+234)' },
        { code:'+44',  name:'UK (+44)' },            { code:'+233', name:'Ghana (+233)' },
        { code:'+254', name:'Kenya (+254)' },         { code:'+27',  name:'South Africa (+27)' },
        { code:'+91',  name:'India (+91)' },          { code:'+971', name:'UAE (+971)' },
        { code:'+966', name:'Saudi Arabia (+966)' }, { code:'+20',  name:'Egypt (+20)' },
        { code:'+237', name:'Cameroon (+237)' },     { code:'+256', name:'Uganda (+256)' },
        { code:'+255', name:'Tanzania (+255)' },     { code:'+250', name:'Rwanda (+250)' },
        { code:'+251', name:'Ethiopia (+251)' },     { code:'+41',  name:'Switzerland (+41)' },
        { code:'+86',  name:'China (+86)' },         { code:'+33',  name:'France (+33)' },
        { code:'+49',  name:'Germany (+49)' },       { code:'+61',  name:'Australia (+61)' },
        { code:'+55',  name:'Brazil (+55)' },        { code:'+351', name:'Portugal (+351)' },
        { code:'+34',  name:'Spain (+34)' },         { code:'+39',  name:'Italy (+39)' },
        { code:'+31',  name:'Netherlands (+31)' },   { code:'+32',  name:'Belgium (+32)' },
        { code:'+46',  name:'Sweden (+46)' },        { code:'+47',  name:'Norway (+47)' },
        { code:'+45',  name:'Denmark (+45)' },       { code:'+358', name:'Finland (+358)' },
        { code:'+353', name:'Ireland (+353)' },      { code:'+48',  name:'Poland (+48)' },
        { code:'+90',  name:'Turkey (+90)' },        { code:'+961', name:'Lebanon (+961)' },
        { code:'+962', name:'Jordan (+962)' },       { code:'+81',  name:'Japan (+81)' },
        { code:'+82',  name:'South Korea (+82)' },   { code:'+60',  name:'Malaysia (+60)' },
        { code:'+852', name:'Hong Kong (+852)' },    { code:'+52',  name:'Mexico (+52)' },
        { code:'+63',  name:'Philippines (+63)' },   { code:'+65',  name:'Singapore (+65)' },
        { code:'+64',  name:'New Zealand (+64)' },   { code:'+7',   name:'Russia/Kazakhstan (+7)' },
        { code:'+380', name:'Ukraine (+380)' },      { code:'+30',  name:'Greece (+30)' },
        { code:'+43',  name:'Austria (+43)' },       { code:'+420', name:'Czech Republic (+420)' },
        { code:'+36',  name:'Hungary (+36)' },       { code:'+40',  name:'Romania (+40)' }
    ];

    const select = document.createElement('select');
    select.id = 'countryCode';
    select.className = 'w-32 px-3 py-3 border border-gray-300 rounded-xl focus:outline-none transition-all duration-200 mobile-full-width';
    select.required = true;

    countries.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = c.name;
        select.appendChild(opt);
    });
    select.value = '+1';

    const container = document.createElement('div');
    container.className = 'flex gap-2 mobile-stack';
    phoneInput.placeholder = 'Phone number without country code';
    phoneInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none transition-all duration-200 mobile-full-width';

    phoneInput.parentNode.insertBefore(container, phoneInput);
    container.appendChild(select);
    container.appendChild(phoneInput);
}

// ============================================================================
// SECTION 8: AUTHENTICATION FUNCTIONS
// ============================================================================

async function handleSignInFull(identifier, password, signInBtn, authLoader) {
    const reqId = `signin_${Date.now()}`;
    pendingRequests.add(reqId);
    try {
        await auth.signInWithEmailAndPassword(identifier, password);
    } catch (err) {
        if (!pendingRequests.has(reqId)) return;
        const msgs = {
            'auth/user-not-found':    'No account found with this email.',
            'auth/wrong-password':    'Incorrect password.',
            'auth/invalid-credential':'Incorrect email or password.',
            'auth/invalid-email':     'Invalid email address format.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.'
        };
        showMessage(msgs[err.code] || 'Failed to sign in. Please check your credentials.', 'error');
        if (signInBtn) {
            signInBtn.disabled = false;
            const t = document.getElementById('signInText');
            const s = document.getElementById('signInSpinner');
            if (t) t.textContent = 'Sign In';
            if (s) s.classList.add('hidden');
        }
        if (authLoader) authLoader.classList.add('hidden');
    } finally {
        pendingRequests.delete(reqId);
    }
}

async function handleSignUpFull(countryCode, localPhone, email, password, confirmPassword, signUpBtn, authLoader) {
    const reqId = `signup_${Date.now()}`;
    pendingRequests.add(reqId);

    // Store temp signup data for profile-creation fallback
    window.tempSignupData = { email, phone: '', normalizedPhone: '' };

    try {
        let fullPhoneInput = localPhone.startsWith('+') ? localPhone : countryCode + localPhone;
        const norm = normalizePhoneNumber(fullPhoneInput);
        if (!norm.valid) throw new Error(`Invalid phone number: ${norm.error}`);

        const finalPhone = norm.normalized;
        window.tempSignupData.phone = finalPhone;
        window.tempSignupData.normalizedPhone = finalPhone;

        // Check for shared-contact links before creating account
        const linkedStudents = await findLinkedStudentsForContact(finalPhone, email);

        const { user } = await auth.createUserWithEmailAndPassword(email, password);
        const referralCode = await generateReferralCode();

        await db.collection('parent_users').doc(user.uid).set({
            email,
            phone: finalPhone,
            normalizedPhone: finalPhone,
            parentName: 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode,
            referralEarnings: 0,
            uid: user.uid
        });

        // Link shared contacts if found
        if (linkedStudents.length > 0) {
            await updateParentWithSharedAccess(user.uid, finalPhone, email, linkedStudents);
        }

        showMessage('Account created successfully! Redirecting...', 'success');

        // Reset UI
        if (signUpBtn) signUpBtn.disabled = false;
        const t = document.getElementById('signUpText'), s = document.getElementById('signUpSpinner');
        if (t) t.textContent = 'Create Account';
        if (s) s.classList.add('hidden');
        if (authLoader) authLoader.classList.add('hidden');

        // Give Firestore time to propagate then reload
        await new Promise(r => setTimeout(r, 1500));
        window.location.reload();

    } catch (err) {
        if (!pendingRequests.has(reqId)) return;
        const msgs = {
            'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
            'auth/weak-password':        'Password must be at least 6 characters.'
        };
        showMessage(msgs[err.code] || err.message || 'Failed to create account.', 'error');
        if (signUpBtn) signUpBtn.disabled = false;
        const t = document.getElementById('signUpText'), s = document.getElementById('signUpSpinner');
        if (t) t.textContent = 'Create Account';
        if (s) s.classList.add('hidden');
        if (authLoader) authLoader.classList.add('hidden');
    } finally {
        pendingRequests.delete(reqId);
        // Clear temp data after 5 minutes
        setTimeout(() => { window.tempSignupData = null; }, 5 * 60 * 1000);
    }
}

async function handlePasswordResetFull(email, sendResetBtn, resetLoader) {
    const reqId = `reset_${Date.now()}`;
    pendingRequests.add(reqId);
    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset link sent to your email!', 'success');
        hidePasswordResetModal();
    } catch (err) {
        if (!pendingRequests.has(reqId)) return;
        showMessage(err.code === 'auth/user-not-found'
            ? 'No account found with this email address.'
            : 'Failed to send reset email.', 'error');
    } finally {
        pendingRequests.delete(reqId);
        if (sendResetBtn) sendResetBtn.disabled = false;
        if (resetLoader) resetLoader.classList.add('hidden');
    }
}

// ============================================================================
// SECTION 9: REFERRAL SYSTEM
// ============================================================================

async function generateReferralCode() {
    const chars  = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const prefix = 'BKH';
    const MAX_ATTEMPTS = 20;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        let suffix = '';
        for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
        const code = prefix + suffix;
        try {
            const snap = await db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
            if (snap.empty) return code;
        } catch {
            return code; // Accept on Firestore error to avoid blocking signup
        }
    }
    // Fallback: timestamp-based code guaranteed unique
    return `BKH${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function loadReferralRewards(parentUid) {
    const el = document.getElementById('rewardsContent');
    if (!el) return;
    showSkeletonLoader('rewardsContent', 'reports');

    try {
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) { el.innerHTML = '<p class="text-red-500 text-center py-8">User data not found.</p>'; return; }

        const ud = userDoc.data();
        const referralCode  = escapeHtml(ud.referralCode || 'N/A');
        const totalEarnings = ud.referralEarnings || 0;

        const txSnap = await db.collection('referral_transactions').where('ownerUid', '==', parentUid).get();

        let pendingCount = 0, approvedCount = 0, paidCount = 0;
        let referralsHtml = '';

        if (txSnap.empty) {
            referralsHtml = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No one has used your referral code yet.</td></tr>';
        } else {
            const txs = txSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));

            txs.forEach(tx => {
                const status      = safeText(tx.status || 'pending');
                const statusColor = status === 'paid' ? 'bg-green-100 text-green-800'
                                  : status === 'approved' ? 'bg-blue-100 text-blue-800'
                                  : 'bg-yellow-100 text-yellow-800';
                if (status === 'pending') pendingCount++;
                if (status === 'approved') approvedCount++;
                if (status === 'paid') paidCount++;

                const name   = escapeHtml(capitalize(tx.referredStudentName || tx.referredStudentPhone || 'Unknown'));
                const reward = tx.rewardAmount ? `₦${tx.rewardAmount.toLocaleString()}` : '₦5,000';
                const date   = escapeHtml(tx.timestamp?.toDate?.().toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) || 'N/A');

                referralsHtml += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">${name}</td>
                        <td class="px-4 py-3 text-sm text-gray-500">${date}</td>
                        <td class="px-4 py-3 text-sm">
                            <span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}">${escapeHtml(capitalize(status))}</span>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-bold">${escapeHtml(reward)}</td>
                    </tr>`;
            });
        }

        el.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md slide-down">
                <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">${referralCode}</p>
                <p class="text-blue-700 mt-2">Share this code with other parents. They use it when registering their child, and you earn <strong>₦5,000</strong> once their child completes their first month!</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-green-100 p-6 rounded-xl shadow-lg border-b-4 border-green-600 fade-in">
                    <p class="text-sm font-medium text-green-700">Total Earnings</p>
                    <p class="text-3xl font-extrabold text-green-900 mt-1">₦${totalEarnings.toLocaleString()}</p>
                </div>
                <div class="bg-yellow-100 p-6 rounded-xl shadow-lg border-b-4 border-yellow-600 fade-in">
                    <p class="text-sm font-medium text-yellow-700">Approved (Awaiting Payment)</p>
                    <p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p>
                </div>
                <div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600 fade-in">
                    <p class="text-sm font-medium text-gray-700">Paid Referrals</p>
                    <p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p>
                </div>
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-4">Referral History</h3>
            <div class="overflow-x-auto bg-white rounded-lg shadow">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referred Parent/Student</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Used</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">${referralsHtml}</tbody>
                </table>
            </div>`;
    } catch (err) {
        console.error('Error loading referral rewards:', err);
        el.innerHTML = '<p class="text-red-500 text-center py-8">Error loading rewards. Please try again.</p>';
    }
}

// ============================================================================
// SECTION 10: COMPREHENSIVE CHILDREN FINDER (WITH SHARED ACCESS)
// ============================================================================

async function comprehensiveFindChildren(parentPhone) {
    const allChildren    = new Map();
    const studentNameIdMap = new Map();
    const parentSuffix   = extractPhoneSuffix(parentPhone);

    if (!parentSuffix) {
        console.warn('No valid phone suffix for parent:', parentPhone);
        return { studentIds: [], studentNameIdMap: new Map(), allStudentData: [], studentNames: [] };
    }

    // All phone fields to check (primary + shared contact fields)
    const PRIMARY_FIELDS = ['parentPhone','guardianPhone','motherPhone','fatherPhone',
                            'contactPhone','phone','parentPhone1','parentPhone2','emergencyPhone'];
    const SHARED_FIELDS  = ['motherPhone','fatherPhone','guardianPhone','emergencyPhone',
                            'secondaryPhone','contactPhone'];

    function processStudentDoc(doc, isPending) {
        const data = doc.data();
        const studentId   = doc.id;
        const studentName = safeText(data.studentName || data.name || '');
        if (!studentName) return;

        const fieldsToCheck = isPending ? PRIMARY_FIELDS : [...new Set([...PRIMARY_FIELDS, ...SHARED_FIELDS])];
        for (const f of fieldsToCheck) {
            if (data[f] && extractPhoneSuffix(data[f]) === parentSuffix) {
                if (!allChildren.has(studentId)) {
                    allChildren.set(studentId, {
                        id: studentId, name: studentName, data,
                        isPending, collection: isPending ? 'pending_students' : 'students',
                        relationship: SHARED_FIELDS.includes(f) ? f.replace('Phone','') : 'primary'
                    });
                    const uniqueName = studentNameIdMap.has(studentName)
                        ? `${studentName} (${studentId.slice(0, 4)})` : studentName;
                    studentNameIdMap.set(uniqueName, studentId);
                }
                break;
            }
        }
    }

    try {
        const [studentsSnap, pendingSnap] = await Promise.all([
            db.collection('students').get().catch(() => ({ forEach: () => {} })),
            db.collection('pending_students').get().catch(() => ({ forEach: () => {} }))
        ]);

        studentsSnap.forEach(doc => processStudentDoc(doc, false));
        pendingSnap.forEach(doc => processStudentDoc(doc, true));

        // Email fallback
        const userSnap = await db.collection('parent_users')
            .where('normalizedPhone', '==', parentPhone).limit(1).get().catch(() => null);

        if (userSnap && !userSnap.empty) {
            const email = userSnap.docs[0].data().email;
            if (email) {
                const emailSnap = await db.collection('students').where('parentEmail', '==', email)
                    .get().catch(() => ({ forEach: () => {} }));
                emailSnap.forEach(doc => {
                    const data = doc.data();
                    const name = safeText(data.studentName || data.name || '');
                    if (name && !allChildren.has(doc.id)) {
                        allChildren.set(doc.id, { id: doc.id, name, data, isPending: false, collection: 'students', relationship: 'email' });
                        if (!studentNameIdMap.has(name)) studentNameIdMap.set(name, doc.id);
                    }
                });
            }
        }
    } catch (err) {
        console.error('comprehensiveFindChildren error:', err);
    }

    return {
        studentIds:       Array.from(allChildren.keys()),
        studentNameIdMap,
        allStudentData:   Array.from(allChildren.values()),
        studentNames:     Array.from(studentNameIdMap.keys())
    };
}

// ============================================================================
// SECTION 11: REPORT SEARCH (UNLIMITED + SHARED CONTACTS)
// ============================================================================

async function searchAllReportsForParent(parentPhone, parentEmail = '', parentUid = '') {
    let assessmentResults = [];
    let monthlyResults    = [];

    const parentSuffix = extractPhoneSuffix(parentPhone);
    if (!parentSuffix) return { assessmentResults: [], monthlyResults: [] };

    const ALL_PHONE_FIELDS = ['parentPhone','parent_phone','guardianPhone','motherPhone',
                              'fatherPhone','phone','contactPhone','normalizedParentPhone',
                              'emergencyPhone','secondaryContact','secondaryPhone'];

    function matchesParent(data) {
        return ALL_PHONE_FIELDS.some(f => data[f] && extractPhoneSuffix(data[f]) === parentSuffix);
    }

    try {
        const [assessSnap, monthlySnap] = await Promise.all([
            db.collection('student_results').get().catch(() => ({ forEach: () => {} })),
            db.collection('tutor_submissions').get().catch(() => ({ forEach: () => {} }))
        ]);

        assessSnap.forEach(doc => {
            const data = doc.data();
            if (matchesParent(data)) {
                assessmentResults.push({ id: doc.id, collection: 'student_results', ...data, timestamp: getTimestampFromData(data), type: 'assessment' });
            }
        });

        monthlySnap.forEach(doc => {
            const data = doc.data();
            if (matchesParent(data)) {
                monthlyResults.push({ id: doc.id, collection: 'tutor_submissions', ...data, timestamp: getTimestampFromData(data), type: 'monthly' });
            }
        });

        // Email fallback
        if (parentEmail) {
            const [aEmail, mEmail] = await Promise.all([
                db.collection('student_results').where('parentEmail', '==', parentEmail).limit(50).get().catch(() => null),
                db.collection('tutor_submissions').where('parentEmail', '==', parentEmail).limit(50).get().catch(() => null)
            ]);
            aEmail?.forEach(doc => {
                if (!assessmentResults.find(r => r.id === doc.id))
                    assessmentResults.push({ id: doc.id, collection: 'student_results', ...doc.data(), timestamp: getTimestampFromData(doc.data()), type: 'assessment' });
            });
            mEmail?.forEach(doc => {
                if (!monthlyResults.find(r => r.id === doc.id))
                    monthlyResults.push({ id: doc.id, collection: 'tutor_submissions', ...doc.data(), timestamp: getTimestampFromData(doc.data()), type: 'monthly' });
            });
        }

        // Deduplicate
        assessmentResults = [...new Map(assessmentResults.map(i => [i.id, i])).values()];
        monthlyResults    = [...new Map(monthlyResults.map(i => [i.id, i])).values()];

        // Sort newest first (only sort items with valid timestamps)
        assessmentResults.sort((a, b) => b.timestamp - a.timestamp);
        monthlyResults.sort((a, b) => b.timestamp - a.timestamp);

    } catch (err) {
        console.error('searchAllReportsForParent error:', err);
    }

    return { assessmentResults, monthlyResults };
}

// ============================================================================
// SECTION 12: ACADEMICS TAB
// ============================================================================

window.toggleAcademicsAccordion = function(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const arrow   = document.getElementById(`${sectionId}-arrow`);
    if (!content || !arrow) return;
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

window.forceDownload = function(url, filename) {
    const w = window.open(url, '_blank');
    if (w) w.focus();
};

window.handleHomeworkAction = function(homeworkId, studentId, currentStatus) {
    const getDoc = () => db.collection('homework_assignments').doc(homeworkId).get();

    switch (currentStatus) {
        case 'graded':
            getDoc().then(doc => {
                const hw = doc.data();
                if (hw) showGradeFeedbackModal(hw.grade || hw.score || 'N/A', hw.feedback || hw.tutorFeedback || 'No feedback provided.', hw);
            }).catch(err => { console.error(err); showMessage('Error loading assignment details', 'error'); });
            break;
        case 'submitted':
            getDoc().then(doc => {
                const hw = doc.data();
                if (hw?.submissionUrl) {
                    window.open(hw.submissionUrl, '_blank');
                } else {
                    showMessage('No submission file available.', 'info');
                }
            }).catch(err => { console.error(err); showMessage('Error loading submission', 'error'); });
            break;
        default:
            getDoc().then(doc => {
                const hw = doc.data();
                if (hw?.fileUrl) {
                    forceDownload(hw.fileUrl, hw.title || 'assignment');
                } else {
                    showMessage('Please contact your tutor for assignment details.', 'info');
                }
            }).catch(err => { console.error(err); showMessage('Error loading assignment', 'error'); });
    }
};

function showGradeFeedbackModal(grade, feedback, homeworkData) {
    document.getElementById('gradeFeedbackModal')?.remove();
    const div = document.createElement('div');
    div.innerHTML = `
        <div id="gradeFeedbackModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div class="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-t-xl flex justify-between items-center">
                    <h3 class="text-xl font-bold text-white">Assignment Graded</h3>
                    <button id="closeGradeFeedbackModal" class="text-white hover:text-gray-200 text-2xl">&times;</button>
                </div>
                <div class="p-6">
                    <div class="text-center mb-6">
                        <div class="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                            <span class="text-3xl">📊</span>
                        </div>
                        <h4 class="text-2xl font-bold text-gray-800 mb-2">${escapeHtml(String(grade))}</h4>
                        <p class="text-gray-600">Overall Grade</p>
                    </div>
                    <div class="mb-6">
                        <h5 class="font-semibold text-gray-700 mb-2">Assignment Details</h5>
                        <div class="bg-gray-50 rounded-lg p-4">
                            <p class="text-gray-800"><span class="font-medium">Title:</span> ${escapeHtml(safeText(homeworkData.title || homeworkData.subject || 'Untitled'))}</p>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-gray-700 mb-2">Tutor's Feedback</h5>
                        <div class="bg-blue-50 rounded-lg p-4 border border-blue-100">
                            <p class="text-gray-700 whitespace-pre-wrap">${escapeHtml(safeText(feedback))}</p>
                        </div>
                    </div>
                    <div class="mt-8 pt-6 border-t">
                        <button id="closeGradeFeedbackModalBtn" class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">Close</button>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(div.firstElementChild);
    document.getElementById('closeGradeFeedbackModal').onclick =
    document.getElementById('closeGradeFeedbackModalBtn').onclick = () => document.getElementById('gradeFeedbackModal')?.remove();
}

async function loadAcademicsData(selectedStudent = null) {
    const el = document.getElementById('academicsContent');
    if (!el) return;
    showSkeletonLoader('academicsContent', 'reports');

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('Please sign in');

        const uDoc     = await db.collection('parent_users').doc(user.uid).get();
        const uData    = uDoc.data();
        const pPhone   = uData.normalizedPhone || uData.phone;
        const result   = await comprehensiveFindChildren(pPhone);

        userChildren   = result.studentNames;
        studentIdMap   = result.studentNameIdMap;
        allStudentData = result.allStudentData;

        if (userChildren.length === 0) {
            el.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📚</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Students Found</h3>
                    <p class="text-gray-500">No students are currently linked to your account.</p>
                </div>`;
            return;
        }

        const studentsToShow = selectedStudent && studentIdMap.has(selectedStudent) ? [selectedStudent] : userChildren;
        let html = '';

        // Student selector (if multiple)
        if (studentIdMap.size > 1) {
            html += `
                <div class="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Select Student:</label>
                    <select id="studentSelector" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500" onchange="onStudentSelected(this.value)">
                        <option value="">All Students</option>`;
            userChildren.forEach(name => {
                const info     = allStudentData.find(s => s.name === name);
                const selected = selectedStudent === name ? 'selected' : '';
                const status   = info?.isPending ? ' (Pending)' : '';
                html += `<option value="${escapeHtml(name)}" ${selected}>${escapeHtml(capitalize(name))}${escapeHtml(status)}</option>`;
            });
            html += `</select></div>`;
        }

        const studentData = await Promise.all(studentsToShow.map(async studentName => {
            const studentId   = studentIdMap.get(studentName);
            const studentInfo = allStudentData.find(s => s.name === studentName);
            let sessionTopicsHtml = '', homeworkHtml = '';

            if (studentId) {
                const [topicsSnap, hwSnap] = await Promise.all([
                    db.collection('daily_topics').where('studentId', '==', studentId).get().catch(() => ({ empty: true })),
                    db.collection('homework_assignments').where('studentId', '==', studentId).get().catch(() => ({ empty: true }))
                ]);

                sessionTopicsHtml = topicsSnap.empty
                    ? '<div class="bg-gray-50 border rounded-lg p-6 text-center"><p class="text-gray-500">No session topics recorded yet.</p></div>'
                    : '<div class="bg-gray-50 border rounded-lg p-6 text-center"><p class="text-gray-500">Session topics loaded.</p></div>';

                if (hwSnap.empty) {
                    homeworkHtml = '<div class="bg-gray-50 border rounded-lg p-6 text-center"><p class="text-gray-500">No homework assignments yet.</p></div>';
                } else {
                    const now = Date.now();
                    hwSnap.forEach(doc => {
                        const hw        = doc.data();
                        const hwId      = doc.id;
                        const duTs      = getTimestamp(hw.dueDate);
                        const isGraded  = hw.status === 'graded';
                        const isSub     = ['submitted','completed'].includes(hw.status);
                        const isOverdue = duTs && duTs < now && !isGraded && !isSub;

                        let statusColor, statusText, statusIcon, buttonText, buttonColor;
                        if (isGraded)      { statusColor='bg-green-100 text-green-800'; statusText='Graded';    statusIcon='✅'; buttonText='View Grade & Feedback'; buttonColor='bg-green-600 hover:bg-green-700'; }
                        else if (isSub)    { statusColor='bg-blue-100 text-blue-800';  statusText='Submitted'; statusIcon='📤'; buttonText='View Submission';       buttonColor='bg-blue-600 hover:bg-blue-700'; }
                        else if (isOverdue){ statusColor='bg-red-100 text-red-800';    statusText='Overdue';   statusIcon='⚠️'; buttonText='Download Assignment';    buttonColor='bg-red-600 hover:bg-red-700'; }
                        else               { statusColor='bg-gray-100 text-gray-800';  statusText='Pending';   statusIcon='📝'; buttonText='Download Assignment';    buttonColor='bg-blue-600 hover:bg-blue-700'; }

                        const gradeVal = hw.grade ?? hw.score ?? hw.overallGrade ?? hw.percentage ?? hw.marks;
                        let gradeDisplay = '';
                        if (gradeVal != null) {
                            const n = parseFloat(gradeVal);
                            gradeDisplay = isNaN(n) ? escapeHtml(String(gradeVal)) : `${n}%`;
                        }

                        const safeHwStatus = isGraded ? 'graded' : isSub ? 'submitted' : isOverdue ? 'overdue' : 'pending';

                        homeworkHtml += `
                            <div class="bg-white border ${isOverdue ? 'border-red-200' : 'border-gray-200'} rounded-lg p-4 shadow-sm mb-4" data-homework-id="${escapeHtml(hwId)}">
                                <div class="flex justify-between items-start mb-3">
                                    <div>
                                        <h5 class="font-medium text-gray-800 text-lg">${escapeHtml(safeText(hw.title || hw.subject || 'Untitled'))}</h5>
                                        <div class="mt-1 flex flex-wrap items-center gap-2">
                                            <span class="text-xs ${statusColor} px-2 py-1 rounded-full">${statusIcon} ${statusText}</span>
                                            <span class="text-xs text-gray-600">Assigned by: ${escapeHtml(safeText(hw.tutorName || hw.assignedBy || 'Tutor'))}</span>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <span class="text-sm font-medium text-gray-700">Due: ${escapeHtml(formatDetailedDate(duTs ? new Date(duTs) : null))}</span>
                                    </div>
                                </div>
                                <div class="text-gray-700 mb-4">
                                    <p class="whitespace-pre-wrap bg-gray-50 p-3 rounded-md">${escapeHtml(safeText(hw.description || hw.instructions || 'No description provided.'))}</p>
                                </div>
                                <div class="flex justify-between items-center pt-3 border-t border-gray-100">
                                    <div class="flex items-center space-x-3">
                                        ${hw.fileUrl ? `<button data-dl-url="${escapeHtml(hw.fileUrl)}" data-dl-name="${escapeHtml(safeText(hw.title || 'assignment'))}.pdf" class="hw-download-btn text-green-600 hover:text-green-800 font-medium flex items-center text-sm"><span class="mr-1">📥</span> Download Assignment</button>` : ''}
                                    </div>
                                    ${gradeDisplay ? `<div class="text-right"><span class="font-medium text-gray-700">Grade: </span><span class="font-bold text-gray-600">${gradeDisplay}</span></div>` : ''}
                                </div>
                                <div class="mt-4 pt-3 border-t border-gray-100">
                                    <button data-hw-id="${escapeHtml(hwId)}" data-student-id="${escapeHtml(studentId)}" data-hw-status="${safeHwStatus}" class="hw-action-btn w-full ${buttonColor} text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90">
                                        ${buttonText}
                                    </button>
                                </div>
                            </div>`;
                    });
                }
            }
            return { studentName, studentInfo, sessionTopicsHtml, homeworkHtml };
        }));

        studentData.forEach(({ studentName, studentInfo, sessionTopicsHtml, homeworkHtml }) => {
            const safeName = escapeHtml(capitalize(studentName));
            const pending  = studentInfo?.isPending ? ' <span class="text-yellow-600 text-sm">(Pending Registration)</span>' : '';
            const sId      = escapeHtml(studentName);
            html += `
                <div class="bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-600 p-4 rounded-lg mb-6">
                    <h2 class="text-xl font-bold text-green-800">${safeName}${pending}</h2>
                    <p class="text-green-600">Academic progress and assignments</p>
                </div>
                <div class="mb-8">
                    <button data-accordion="session-topics-${sId}" class="accordion-toggle w-full flex justify-between items-center p-4 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 mb-4">
                        <div class="flex items-center"><span class="text-xl mr-3">📝</span><h3 class="font-bold text-blue-800 text-lg">Session Topics</h3></div>
                        <span id="session-topics-${sId}-arrow" class="text-blue-600 text-xl">▼</span>
                    </button>
                    <div id="session-topics-${sId}-content" class="hidden">${sessionTopicsHtml}</div>
                </div>
                <div class="mb-8">
                    <button data-accordion="homework-${sId}" class="accordion-toggle w-full flex justify-between items-center p-4 bg-purple-100 border border-purple-300 rounded-lg hover:bg-purple-200 mb-4">
                        <div class="flex items-center"><span class="text-xl mr-3">📚</span><h3 class="font-bold text-purple-800 text-lg">Homework Assignments</h3></div>
                        <span id="homework-${sId}-arrow" class="text-purple-600 text-xl">▼</span>
                    </button>
                    <div id="homework-${sId}-content" class="hidden">${homeworkHtml}</div>
                </div>`;
        });

        el.innerHTML = html;

        // Bind homework buttons via delegation (no inline onclick XSS risk)
        el.querySelectorAll('.hw-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                handleHomeworkAction(btn.dataset.hwId, btn.dataset.studentId, btn.dataset.hwStatus);
            });
        });
        el.querySelectorAll('.hw-download-btn').forEach(btn => {
            btn.addEventListener('click', () => forceDownload(btn.dataset.dlUrl, btn.dataset.dlName));
        });
        el.querySelectorAll('.accordion-toggle').forEach(btn => {
            btn.addEventListener('click', () => window.toggleAcademicsAccordion(btn.dataset.accordion));
        });

    } catch (err) {
        console.error('loadAcademicsData error:', err);
        el.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">❌</div>
                <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Academic Data</h3>
                <p class="text-gray-500">Unable to load academic data at this time.</p>
                <button id="retryAcademicsBtn" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Try Again</button>
            </div>`;
        document.getElementById('retryAcademicsBtn')?.addEventListener('click', () => loadAcademicsData());
    }
}

// ============================================================================
// SECTION 13: REAL-TIME MONITORING
// ============================================================================

function cleanupRealTimeListeners() {
    realTimeListeners.forEach(fn => { if (typeof fn === 'function') fn(); });
    realTimeListeners = [];

    if (window.realTimeIntervals) {
        window.realTimeIntervals.forEach(id => clearInterval(id));
        window.realTimeIntervals = [];
    }

    charts.forEach(c => { if (c?.destroy) c.destroy(); });
    charts.clear();
}

function setupRealTimeMonitoring(parentPhone, userId) {
    cleanupRealTimeListeners();

    const parentSuffix = extractPhoneSuffix(parentPhone);
    if (!parentSuffix) return;

    const checkForNewReports = async () => {
        try {
            const lastCheckKey  = `lastReportCheck_${userId}`;
            const lastCheckTime = parseInt(localStorage.getItem(lastCheckKey) || '0');
            const now           = Date.now();
            let foundNew        = false;

            await Promise.all(['tutor_submissions', 'student_results'].map(async col => {
                try {
                    const snap = await db.collection(col).limit(200).get();
                    snap.forEach(doc => {
                        const data = doc.data();
                        const phone = data.parentPhone || data.parent_phone || data.phone;
                        if (phone && extractPhoneSuffix(phone) === parentSuffix) {
                            const ts = getTimestamp(data.timestamp || data.createdAt || data.submittedAt);
                            if (ts > lastCheckTime) foundNew = true;
                        }
                    });
                } catch { /* silent */ }
            }));

            if (foundNew) showNewReportNotification();
            localStorage.setItem(lastCheckKey, String(now));
        } catch (err) {
            console.error('Real-time check error:', err);
        }
    };

    const intervalId = setInterval(checkForNewReports, 60000);
    window.realTimeIntervals.push(intervalId);
    realTimeListeners.push(() => clearInterval(intervalId));
    setTimeout(checkForNewReports, 2000);
}

function showNewReportNotification() {
    showMessage('New reports available! Refresh to view.', 'success');
    const ind = document.createElement('div');
    ind.id        = 'newReportIndicator';
    ind.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-pulse fade-in';
    ind.textContent = '📄 New Reports Available!';
    document.getElementById('newReportIndicator')?.remove();
    document.body.appendChild(ind);
    setTimeout(() => ind.remove(), 5000);
}

// ============================================================================
// SECTION 14: REPORT HTML GENERATORS
// ============================================================================

function generateTemplatedRecommendation(studentName, tutorName, results) {
    const strengths = [], weaknesses = [];
    results.forEach(({ correct, total, topics, subject }) => {
        const pct = total > 0 ? (correct / total) * 100 : 0;
        const list = topics.length > 0 ? topics : [subject];
        if (pct >= 75) strengths.push(...list);
        else if (pct < 50) weaknesses.push(...list);
    });

    const uniqS = [...new Set(strengths)], uniqW = [...new Set(weaknesses)];
    const name  = escapeHtml(studentName);

    let praise = uniqS.length > 1
        ? `It was great to see ${name} demonstrate a solid understanding of ${escapeHtml(uniqS[0])} and ${escapeHtml(uniqS[1])}. `
        : uniqS.length === 1
        ? `${name} showed strong potential in ${escapeHtml(uniqS[0])}. `
        : `${name} has put in commendable effort on this assessment. `;

    let improvement = uniqW.length > 1
        ? `Our next step will be to focus on building confidence in ${escapeHtml(uniqW[0])} and ${escapeHtml(uniqW[1])}. `
        : uniqW.length === 1
        ? `We will focus on improving ${escapeHtml(uniqW[0])}. `
        : 'The student is performing well across all areas. ';

    return `${praise}${improvement}With consistent practice and support from ${escapeHtml(tutorName || 'the tutor')}, ${name} is on the right track to achieving excellent results.`;
}

// Chart initializations are queued and run after innerHTML is set (scripts in innerHTML don't execute)
function queueChartInit(chartId, chartConfig) {
    pendingChartInits.push({ chartId, chartConfig });
}

function flushChartInits() {
    if (!pendingChartInits.length) return;
    const toInit = [...pendingChartInits];
    pendingChartInits.length = 0;
    setTimeout(() => {
        toInit.forEach(({ chartId, chartConfig }) => {
            try {
                const ctx = document.getElementById(chartId);
                if (ctx && window.Chart) {
                    const existing = charts.get(chartId);
                    if (existing) existing.destroy();
                    charts.set(chartId, new Chart(ctx, chartConfig));
                }
            } catch (e) {
                console.warn('Chart init error:', chartId, e);
            }
        });
    }, 150);
}

function createAssessmentReportHTML(sessionReports, studentIndex, sessionId, fullName, date) {
    const first       = sessionReports[0];
    const formattedDate = escapeHtml(formatDetailedDate(date || new Date((first.timestamp || 0) * 1000), true));
    const tutorName   = safeText(first.tutorName || first.tutorEmail || 'N/A');

    const results = sessionReports.map(r => ({
        subject: safeText(r.subject || r.testSubject || 'General'),
        correct: r.score !== undefined ? r.score : 0,
        total:   r.totalScoreableQuestions !== undefined ? r.totalScoreableQuestions : 0,
        topics:  [...new Set((r.answers || []).map(a => safeText(a.topic)).filter(Boolean))]
    }));

    const recommendation = generateTemplatedRecommendation(fullName, tutorName, results);

    const tableRows = results.map(r => `
        <tr>
            <td class="border px-2 py-1">${escapeHtml(r.subject.toUpperCase())}</td>
            <td class="border px-2 py-1 text-center">${r.correct} / ${r.total}</td>
        </tr>`).join('');

    const topicRows = results.map(r => `
        <tr>
            <td class="border px-2 py-1 font-semibold">${escapeHtml(r.subject.toUpperCase())}</td>
            <td class="border px-2 py-1">${escapeHtml(r.topics.join(', ') || 'N/A')}</td>
        </tr>`).join('');

    const cwAnswer   = first.answers?.find(a => a.type === 'creative-writing');
    const tutorReport = escapeHtml(safeText(cwAnswer?.tutorReport || 'Pending review.'));
    const chartId    = `chart-${studentIndex}-${sessionId}`;

    const chartConfig = {
        type: 'bar',
        data: {
            labels: results.map(r => r.subject.toUpperCase()),
            datasets: [
                { label: 'Correct',           data: results.map(r => r.correct),          backgroundColor: '#4CAF50' },
                { label: 'Incorrect/Unanswered', data: results.map(r => r.total - r.correct), backgroundColor: '#FFCD56' }
            ]
        },
        options: {
            responsive: true,
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
            plugins: { title: { display: true, text: 'Score Distribution by Subject' } }
        }
    };

    // Queue chart for post-render initialization
    if (results.length > 0) queueChartInit(chartId, chartConfig);

    return `
        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="assessment-block-${studentIndex}-${sessionId}">
            <div class="text-center mb-6 border-b pb-4">
                <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" alt="Blooming Kids House Logo" class="h-16 w-auto mx-auto mb-3">
                <h2 class="text-2xl font-bold text-green-800">Assessment Report</h2>
                <p class="text-gray-600">Date: ${formattedDate}</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                <div>
                    <p><strong>Student's Name:</strong> ${escapeHtml(fullName)}</p>
                    <p><strong>Parent's Phone:</strong> ${escapeHtml(safeText(first.parentPhone || 'N/A'))}</p>
                    <p><strong>Grade:</strong> ${escapeHtml(safeText(String(first.grade || 'N/A')))}</p>
                </div>
                <div>
                    <p><strong>Tutor:</strong> ${escapeHtml(tutorName)}</p>
                    <p><strong>Location:</strong> ${escapeHtml(safeText(first.studentCountry || 'N/A'))}</p>
                </div>
            </div>
            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Performance Summary</h3>
            <table class="w-full text-sm mb-4 border border-collapse">
                <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Knowledge &amp; Skill Analysis</h3>
            <table class="w-full text-sm mb-4 border border-collapse">
                <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-left">Topics Covered</th></tr></thead>
                <tbody>${topicRows}</tbody>
            </table>
            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Tutor's Recommendation</h3>
            <p class="mb-2 text-gray-700 leading-relaxed">${recommendation}</p>
            ${cwAnswer ? `<h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Creative Writing Feedback</h3><p class="mb-2 text-gray-700"><strong>Tutor's Report:</strong> ${tutorReport}</p>` : ''}
            ${results.length > 0 ? `<canvas id="${chartId}" class="w-full h-48 mb-4"></canvas>` : ''}
            <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed. With personalised support from our tutors, ${escapeHtml(fullName)} will unlock their full potential. Keep up the great work!<br>– Mrs. Yinka Isikalu, Director</p>
            </div>
            <div class="mt-6 text-center">
                <button data-download-student="${escapeHtml(fullName)}" data-download-index="${studentIndex}" data-download-session="${escapeHtml(sessionId)}" data-download-type="assessment" class="report-download-btn bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                    Download Assessment PDF
                </button>
            </div>
        </div>`;
}

function createMonthlyReportHTML(sessionReports, studentIndex, sessionId, fullName, date) {
    const first = sessionReports[0];
    const formattedDate = escapeHtml(formatDetailedDate(date || new Date((first.timestamp || 0) * 1000), true));

    const field = (key, label) => first[key]
        ? `<div class="mb-6">
               <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">${label}</h3>
               <p class="text-gray-700 leading-relaxed preserve-whitespace">${escapeHtml(safeText(first[key]))}</p>
           </div>`
        : '';

    return `
        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="monthly-block-${studentIndex}-${sessionId}">
            <div class="text-center mb-6 border-b pb-4">
                <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" alt="Blooming Kids House Logo" class="h-16 w-auto mx-auto mb-3">
                <h2 class="text-2xl font-bold text-green-800">MONTHLY LEARNING REPORT</h2>
                <p class="text-gray-600">Date: ${formattedDate}</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                <div>
                    <p><strong>Student's Name:</strong> ${escapeHtml(safeText(first.studentName || 'N/A'))}</p>
                    <p><strong>Parent's Name:</strong> ${escapeHtml(safeText(first.parentName || 'N/A'))}</p>
                    <p><strong>Parent's Phone:</strong> ${escapeHtml(safeText(first.parentPhone || 'N/A'))}</p>
                </div>
                <div>
                    <p><strong>Grade:</strong> ${escapeHtml(safeText(first.grade || 'N/A'))}</p>
                    <p><strong>Tutor's Name:</strong> ${escapeHtml(safeText(first.tutorName || 'N/A'))}</p>
                </div>
            </div>
            ${field('introduction', 'INTRODUCTION')}
            ${field('topics', 'TOPICS & REMARKS')}
            ${field('progress', 'PROGRESS & ACHIEVEMENTS')}
            ${field('strengthsWeaknesses', 'STRENGTHS AND WEAKNESSES')}
            ${field('recommendations', 'RECOMMENDATIONS')}
            ${field('generalComments', "GENERAL TUTOR'S COMMENTS")}
            <div class="text-right mt-8 pt-4 border-t">
                <p class="text-gray-600">Best regards,</p>
                <p class="font-semibold text-green-800">${escapeHtml(safeText(first.tutorName || 'N/A'))}</p>
            </div>
            <div class="mt-6 text-center">
                <button data-download-student="${escapeHtml(fullName)}" data-download-index="${studentIndex}" data-download-session="${escapeHtml(sessionId)}" data-download-type="monthly" class="report-download-btn bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                    Download Monthly Report PDF
                </button>
            </div>
        </div>`;
}

function downloadSessionReport(studentIndex, sessionId, studentName, type) {
    const el = document.getElementById(`${type}-block-${studentIndex}-${sessionId}`);
    if (!el) { showMessage('Report element not found for download', 'error'); return; }

    const safeName = studentName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeName}_${Date.now()}.pdf`;

    showMessage('Generating PDF download...', 'success');
    html2pdf().from(el).set({
        margin: 0.5, filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    }).save();
}

window.downloadSessionReport = downloadSessionReport;
window.downloadMonthlyReport = (idx, sid, name) => downloadSessionReport(idx, sid, name, 'monthly');

function toggleAccordion(elementId) {
    const content = document.getElementById(`${elementId}-content`);
    const arrow   = document.getElementById(`${elementId}-arrow`);
    if (!content || !arrow) return;
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.textContent = '▲';
    } else {
        content.classList.add('hidden');
        arrow.textContent = '▼';
    }
}

window.toggleAccordion = toggleAccordion;

function createYearlyArchiveReportView(formattedReportsByStudent) {
    let html = '';
    let studentIndex = 0;

    for (const [studentName, reportData] of formattedReportsByStudent) {
        const fullName = escapeHtml(capitalize(studentName));
        html += `
            <div class="mb-8">
                <div class="bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-600 p-4 rounded-lg mb-4">
                    <h2 class="text-xl font-bold text-green-800">${fullName}</h2>
                </div>
                <div class="space-y-4">`;

        // Group by year
        const byYear = new Map();
        for (const [sessionKey, sessionReports] of reportData.assessments) {
            const ts   = (sessionReports[0].timestamp || 0) * 1000;
            const date = new Date(ts);
            const yr   = date.getFullYear() || new Date().getFullYear();
            if (!byYear.has(yr)) byYear.set(yr, { assessments: new Map(), monthly: new Map() });
            byYear.get(yr).assessments.set(sessionKey, { sessionKey, reports: sessionReports, date });
        }
        for (const [sessionKey, sessionReports] of reportData.monthly) {
            const ts   = (sessionReports[0].timestamp || 0) * 1000;
            const date = new Date(ts);
            const yr   = date.getFullYear() || new Date().getFullYear();
            if (!byYear.has(yr)) byYear.set(yr, { assessments: new Map(), monthly: new Map() });
            byYear.get(yr).monthly.set(sessionKey, { sessionKey, reports: sessionReports, date });
        }

        for (const [year, yearData] of [...byYear.entries()].sort((a, b) => b[0] - a[0])) {
            const aCount = yearData.assessments.size;
            const mCount = yearData.monthly.size;
            const yearAccId = `year-${studentIndex}-${year}`;

            html += `
                <div class="border rounded-xl overflow-hidden shadow-sm">
                    <button data-accordion="${yearAccId}" class="accordion-toggle w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 font-bold text-gray-800">
                        <span>📅 ${year}</span>
                        <div class="flex items-center gap-2">
                            <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">${aCount} assessments</span>
                            <span class="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded-full">${mCount} monthly</span>
                            <span id="${yearAccId}-arrow" class="text-gray-500">▼</span>
                        </div>
                    </button>
                    <div id="${yearAccId}-content" class="hidden p-4">`;

            // Assessments grouped by month
            if (aCount > 0) {
                const byMonth = new Map();
                for (const item of yearData.assessments.values()) {
                    const m = item.date.getMonth();
                    if (!byMonth.has(m)) byMonth.set(m, []);
                    byMonth.get(m).push(item);
                }
                for (const [month, items] of [...byMonth.entries()].sort((a, b) => b - a)) {
                    html += `<h5 class="font-semibold text-gray-700 mb-2 mt-4">📌 ${MONTH_NAMES[month]} — Assessments</h5><div class="space-y-4">`;
                    items.forEach((item, i) => { html += createAssessmentReportHTML(item.reports, studentIndex, `${year}-${month}-${i}`, studentName, item.date); });
                    html += '</div>';
                }
            }

            // Monthly reports grouped by month
            if (mCount > 0) {
                const byMonth = new Map();
                for (const item of yearData.monthly.values()) {
                    const m = item.date.getMonth();
                    if (!byMonth.has(m)) byMonth.set(m, []);
                    byMonth.get(m).push(item);
                }
                for (const [month, items] of [...byMonth.entries()].sort((a, b) => b - a)) {
                    html += `<h5 class="font-semibold text-gray-700 mb-2 mt-4">📌 ${MONTH_NAMES[month]} — Monthly Reports</h5><div class="space-y-4">`;
                    items.forEach((item, i) => { html += createMonthlyReportHTML(item.reports, studentIndex, `${year}-m${month}-${i}`, studentName, item.date); });
                    html += '</div>';
                }
            }

            html += `</div></div>`;
        }

        html += `</div></div>`;
        studentIndex++;
    }
    return html;
}

// ============================================================================
// SECTION 15: LOAD ALL REPORTS
// ============================================================================

async function loadAllReportsForParent(parentPhone, userId, forceRefresh = false) {
    const reportArea   = document.getElementById('reportArea');
    const reportContent = document.getElementById('reportContent');
    const authArea     = document.getElementById('authArea');
    const authLoader   = document.getElementById('authLoader');

    if (auth.currentUser && authArea && reportArea) {
        authArea.classList.add('hidden');
        reportArea.classList.remove('hidden');
        localStorage.setItem('isAuthenticated', 'true');
    } else {
        localStorage.removeItem('isAuthenticated');
    }

    if (authLoader) authLoader.classList.remove('hidden');
    showSkeletonLoader('reportContent', 'dashboard');

    try {
        const userDoc = await db.collection('parent_users').doc(userId).get();
        if (!userDoc.exists) throw new Error('User profile not found');

        const userData = userDoc.data();
        currentUserData = {
            parentName: userData.parentName || 'Parent',
            parentPhone,
            email: userData.email || ''
        };

        const welcomeMsg = document.getElementById('welcomeMessage');
        if (welcomeMsg) welcomeMsg.textContent = `Welcome, ${currentUserData.parentName}!`;

        const { assessmentResults, monthlyResults } = await searchAllReportsForParent(parentPhone, userData.email, userId);

        if (assessmentResults.length === 0 && monthlyResults.length === 0) {
            reportContent.innerHTML = `
                <div class="text-center py-16">
                    <div class="text-6xl mb-6">📊</div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">Waiting for Your Child's First Report</h2>
                    <p class="text-gray-600 max-w-2xl mx-auto mb-6">No reports found yet. Your child's tutor hasn't submitted a report, or the phone number on file may differ from your login number.</p>
                    <div class="bg-green-50 border border-green-200 rounded-lg p-6 max-w-2xl mx-auto">
                        <p class="text-green-700 mb-4"><strong>We're monitoring for new reports automatically.</strong> When your tutor submits one, it will appear here.</p>
                        <button id="checkNowBtn" class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 flex items-center mx-auto">
                            <span class="mr-2">🔄</span> Check Now
                        </button>
                    </div>
                </div>`;
            document.getElementById('checkNowBtn')?.addEventListener('click', manualRefreshReportsV2);
            setTimeout(() => setupRealTimeMonitoring(parentPhone, userId), 1000);
            return;
        }

        // Group by student
        const studentReportsMap = new Map();
        [...assessmentResults, ...monthlyResults].forEach(report => {
            const name = report.studentName;
            if (!name) return;
            if (!studentReportsMap.has(name)) studentReportsMap.set(name, { assessments: [], monthly: [] });
            if (report.type === 'assessment') studentReportsMap.get(name).assessments.push(report);
            else if (report.type === 'monthly') studentReportsMap.get(name).monthly.push(report);
        });

        userChildren = Array.from(studentReportsMap.keys());

        const formattedMap = new Map();
        for (const [name, reports] of studentReportsMap) {
            const aBySession = new Map(), mBySession = new Map();
            reports.assessments.forEach(r => {
                const k = Math.floor(r.timestamp / 86400);
                if (!aBySession.has(k)) aBySession.set(k, []);
                aBySession.get(k).push(r);
            });
            reports.monthly.forEach(r => {
                const k = Math.floor(r.timestamp / 86400);
                if (!mBySession.has(k)) mBySession.set(k, []);
                mBySession.get(k).push(r);
            });
            formattedMap.set(name, { assessments: aBySession, monthly: mBySession, studentData: { name, isPending: false } });
        }

        reportContent.innerHTML = createYearlyArchiveReportView(formattedMap);
        flushChartInits();

        // Bind download buttons
        reportContent.querySelectorAll('.report-download-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                downloadSessionReport(btn.dataset.downloadIndex, btn.dataset.downloadSession, btn.dataset.downloadStudent, btn.dataset.downloadType);
            });
        });

        // Bind accordion toggles
        reportContent.querySelectorAll('.accordion-toggle').forEach(btn => {
            btn.addEventListener('click', () => toggleAccordion(btn.dataset.accordion));
        });

        setTimeout(() => {
            setupRealTimeMonitoring(parentPhone, userId);
            addManualRefreshButton();
            addLogoutButton();
        }, 100);

    } catch (err) {
        console.error('loadAllReportsForParent error:', err);
        if (reportContent) {
            reportContent.innerHTML = `
                <div class="bg-red-50 border-l-4 border-red-500 p-6 rounded-xl shadow-md">
                    <h3 class="text-lg font-bold text-red-800">Error Loading Reports</h3>
                    <p class="text-sm text-red-700 mt-1">We encountered an issue: ${escapeHtml(err.message)}</p>
                    <button id="reloadPageBtn" class="mt-4 bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors">🔄 Reload Page</button>
                </div>`;
            document.getElementById('reloadPageBtn')?.addEventListener('click', () => window.location.reload());
        }
    } finally {
        if (authLoader) authLoader.classList.add('hidden');
    }
}

// ============================================================================
// SECTION 16: UNIFIED AUTH MANAGER
// ============================================================================

class UnifiedAuthManager {
    constructor() {
        this.currentUser    = null;
        this.authListener   = null;
        this.isInitialized  = false;
        this.isProcessing   = false;
        this.lastProcessTime = 0;
        this.DEBOUNCE_MS    = 2000;
    }

    initialize() {
        if (this.isInitialized) return;
        this.cleanup();
        this.authListener = auth.onAuthStateChanged(
            user  => this.handleAuthChange(user),
            error => this.handleAuthError(error)
        );
        this.isInitialized = true;
    }

    async handleAuthChange(user) {
        const now = Date.now();
        if (this.isProcessing || (now - this.lastProcessTime) < this.DEBOUNCE_MS) return;

        this.isProcessing    = true;
        this.lastProcessTime = now;

        try {
            if (user?.uid) {
                await this.loadUserDashboard(user);
            } else {
                this.showAuthScreen();
            }
        } catch (err) {
            console.error('Auth change error:', err);
            showMessage('Authentication error. Please refresh.', 'error');
        } finally {
            setTimeout(() => { this.isProcessing = false; }, 1000);
        }
    }

    handleAuthError(err) {
        console.error('Auth listener error:', err);
        showMessage('Authentication error occurred', 'error');
    }

    async loadUserDashboard(user) {
        const authLoader = document.getElementById('authLoader');
        if (authLoader) authLoader.classList.remove('hidden');

        try {
            // Retry logic for new users where Firestore write may not have propagated yet
            let userDoc;
            for (let attempt = 0; attempt < 4; attempt++) {
                userDoc = await db.collection('parent_users').doc(user.uid).get();
                if (userDoc.exists) break;
                if (attempt < 3) await new Promise(r => setTimeout(r, (attempt + 1) * 500));
            }

            // Auto-create profile if still missing (edge case)
            if (!userDoc.exists) {
                const profile = {
                    email: user.email || '',
                    phone: user.phoneNumber || '',
                    normalizedPhone: user.phoneNumber || '',
                    parentName: 'Parent',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    uid: user.uid,
                    ...(window.tempSignupData || {})
                };
                await db.collection('parent_users').doc(user.uid).set(profile);
                showMessage('Welcome! Finishing account setup...', 'success');
                setTimeout(() => window.location.reload(), 1500);
                return;
            }

            const ud = userDoc.data();
            this.currentUser = {
                uid: user.uid,
                email: ud.email,
                phone: ud.phone,
                normalizedPhone: ud.normalizedPhone || ud.phone,
                parentName: ud.parentName || 'Parent',
                referralCode: ud.referralCode
            };

            this.showDashboardUI();

            await Promise.all([
                loadAllReportsForParent(this.currentUser.normalizedPhone, user.uid),
                loadReferralRewards(user.uid),
                loadAcademicsData()
            ]);

            this.setupRealtimeMonitoring();
            this.setupUIComponents();

        } catch (err) {
            console.error('Dashboard load error:', err);
            if (err.message?.includes('profile not found')) {
                showMessage('Setting up your account...', 'info');
                setTimeout(() => this.loadUserDashboard(user), 3000);
            } else {
                showMessage('Temporary issue loading dashboard. Please refresh.', 'error');
                this.showAuthScreen();
            }
        } finally {
            if (authLoader) authLoader.classList.add('hidden');
        }
    }

    showDashboardUI() {
        document.getElementById('authArea')?.classList.add('hidden');
        document.getElementById('reportArea')?.classList.remove('hidden');
        const wm = document.getElementById('welcomeMessage');
        if (wm && this.currentUser) wm.textContent = `Welcome, ${this.currentUser.parentName}!`;
        localStorage.setItem('isAuthenticated', 'true');
    }

    showAuthScreen() {
        document.getElementById('authArea')?.classList.remove('hidden');
        document.getElementById('reportArea')?.classList.add('hidden');
        localStorage.removeItem('isAuthenticated');
        cleanupRealTimeListeners();
    }

    setupRealtimeMonitoring() {
        if (this.currentUser) setupRealTimeMonitoring(this.currentUser.normalizedPhone, this.currentUser.uid);
    }

    setupUIComponents() {
        addManualRefreshButton();
        addLogoutButton();
    }

    cleanup() {
        if (typeof this.authListener === 'function') {
            this.authListener();
            this.authListener = null;
        }
        this.isInitialized = false;
    }

    async reloadDashboard() {
        if (!this.currentUser) return;
        await loadAllReportsForParent(this.currentUser.normalizedPhone, this.currentUser.uid, true);
    }
}

const authManager = new UnifiedAuthManager();

// ============================================================================
// SECTION 17: NAVIGATION BUTTONS & REFRESH
// ============================================================================

async function manualRefreshReportsV2() {
    const user = auth.currentUser;
    if (!user) return;

    const btn = document.getElementById('manualRefreshBtn');
    if (!btn) return;

    const originalText = btn.innerHTML;
    btn.innerHTML  = '<div class="loading-spinner-small mr-2"></div> Refreshing...';
    btn.disabled   = true;

    try {
        if (window.authManager?.reloadDashboard) {
            await window.authManager.reloadDashboard();
        } else {
            const uDoc = await db.collection('parent_users').doc(user.uid).get();
            if (uDoc.exists) {
                const ud = uDoc.data();
                await loadAllReportsForParent(ud.normalizedPhone || ud.phone, user.uid, true);
            }
        }
        await checkForNewAcademics();
        showMessage('Reports refreshed!', 'success');
    } catch (err) {
        console.error('Manual refresh error:', err);
        showMessage('Refresh failed. Please try again.', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled  = false;
    }
}

function addManualRefreshButton() {
    if (document.getElementById('manualRefreshBtn')) return;
    const container = document.querySelector('.bg-green-50 .flex.gap-2');
    if (!container) return;

    const btn = document.createElement('button');
    btn.id        = 'manualRefreshBtn';
    btn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 btn-glow flex items-center justify-center';
    btn.innerHTML = '<span class="mr-2">🔄</span> Check for New Reports';
    btn.addEventListener('click', manualRefreshReportsV2);

    const logoutBtn = container.querySelector('#logoutBtn');
    logoutBtn ? container.insertBefore(btn, logoutBtn) : container.appendChild(btn);
}

function addLogoutButton() {
    if (document.getElementById('logoutBtn')) return;
    const container = document.querySelector('.bg-green-50 .flex.gap-2');
    if (!container) return;

    const btn = document.createElement('button');
    btn.id        = 'logoutBtn';
    btn.className = 'bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-all duration-200 btn-glow flex items-center justify-center';
    btn.innerHTML = '<span class="mr-2">🚪</span> Logout';
    btn.addEventListener('click', logout);
    container.appendChild(btn);
}

// ============================================================================
// SECTION 18: SETTINGS MANAGER
// ============================================================================

class SettingsManager {
    constructor() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.injectSettingsUI());
        } else {
            this.injectSettingsUI();
        }
    }

    injectSettingsUI() {
        const nav = document.querySelector('.bg-green-50 .flex.gap-2');
        if (nav && !document.getElementById('settingsBtn')) {
            const btn = document.createElement('button');
            btn.id        = 'settingsBtn';
            btn.className = 'bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-all duration-200 btn-glow flex items-center justify-center';
            btn.innerHTML = '<span class="mr-2">⚙️</span> Settings';
            btn.addEventListener('click', () => this.openSettingsTab());
            const logout = nav.querySelector('#logoutBtn');
            logout ? nav.insertBefore(btn, logout) : nav.appendChild(btn);
        }

        const main = document.getElementById('reportArea');
        if (main && !document.getElementById('settingsContentArea')) {
            const div = document.createElement('div');
            div.id        = 'settingsContentArea';
            div.className = 'hidden max-w-6xl mx-auto px-4 py-8 fade-in';
            div.innerHTML = `
                <div class="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div class="bg-gray-800 px-6 py-4 flex justify-between items-center">
                        <h2 class="text-xl font-bold text-white">⚙️ Family Profile &amp; Settings</h2>
                        <button id="settingsBackBtn" class="text-gray-300 hover:text-white text-sm">← Back to Dashboard</button>
                    </div>
                    <div id="settingsDynamicContent" class="p-6">
                        <div class="loading-spinner mx-auto"></div>
                    </div>
                </div>`;
            main.appendChild(div);
            document.getElementById('settingsBackBtn')?.addEventListener('click', () => switchMainTab('reports'));
        }
    }

    openSettingsTab() {
        ['reportContentArea','academicsContentArea','rewardsContentArea'].forEach(id => {
            document.getElementById(id)?.classList.add('hidden');
        });
        ['reportTab','academicsTab','rewardsTab'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.classList.remove('tab-active-main'); el.classList.add('tab-inactive-main'); }
        });
        const area = document.getElementById('settingsContentArea');
        if (area) { area.classList.remove('hidden'); this.loadSettingsData(); }
    }

    async loadSettingsData() {
        const content = document.getElementById('settingsDynamicContent');
        const user    = auth.currentUser;
        if (!user) return;
        try {
            const uDoc   = await db.collection('parent_users').doc(user.uid).get();
            const uData  = uDoc.data();
            const result = await comprehensiveFindChildren(uData.normalizedPhone || uData.phone);
            this.renderSettingsForm(uData, result.allStudentData);
        } catch (err) {
            console.error('Settings load error:', err);
            if (content) content.innerHTML = `<p class="text-red-500">Error loading settings. Please try again.</p>`;
        }
    }

    renderSettingsForm(userData, students) {
        const content = document.getElementById('settingsDynamicContent');
        if (!content) return;

        let studentsHtml = '';
        if (students.length === 0) {
            studentsHtml = '<p class="text-gray-500 italic">No students linked yet.</p>';
        }
        students.forEach(student => {
            const d = student.data;
            studentsHtml += `
                <div class="bg-gray-50 border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="col-span-2 md:col-span-1">
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Student Name</label>
                            <input type="text" id="studentName_${escapeHtml(student.id)}" value="${escapeHtml(safeText(student.name))}" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 font-semibold text-gray-800">
                        </div>
                        <div class="col-span-2 md:col-span-1">
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Gender</label>
                            <select id="studentGender_${escapeHtml(student.id)}" class="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 bg-white">
                                <option value="">Select Gender...</option>
                                <option value="Male" ${d.gender === 'Male' ? 'selected' : ''}>Male</option>
                                <option value="Female" ${d.gender === 'Female' ? 'selected' : ''}>Female</option>
                            </select>
                        </div>
                        <div class="col-span-2 border-t pt-3 mt-1">
                            <p class="text-sm font-semibold text-blue-800 mb-1">📞 Additional Contacts (For Shared Access)</p>
                            <p class="text-xs text-gray-500 mb-3">Anyone with these numbers can log in and view reports.</p>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-xs text-gray-500">Mother's Phone</label>
                                    <input type="tel" id="motherPhone_${escapeHtml(student.id)}" value="${escapeHtml(safeText(d.motherPhone || ''))}" placeholder="+234..." class="w-full px-3 py-1.5 border rounded text-sm">
                                </div>
                                <div>
                                    <label class="block text-xs text-gray-500">Father's Phone</label>
                                    <input type="tel" id="fatherPhone_${escapeHtml(student.id)}" value="${escapeHtml(safeText(d.fatherPhone || ''))}" placeholder="+234..." class="w-full px-3 py-1.5 border rounded text-sm">
                                </div>
                                <div class="col-span-2">
                                    <label class="block text-xs text-gray-500">Secondary Email</label>
                                    <input type="email" id="guardianEmail_${escapeHtml(student.id)}" value="${escapeHtml(safeText(d.guardianEmail || ''))}" class="w-full px-3 py-1.5 border rounded text-sm">
                                </div>
                            </div>
                        </div>
                        <div class="col-span-2 mt-2 flex justify-end">
                            <button data-student-id="${escapeHtml(student.id)}" data-collection="${escapeHtml(student.collection)}" class="save-student-btn bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                                💾 Save ${escapeHtml(safeText(student.name))}'s Details
                            </button>
                        </div>
                    </div>
                </div>`;
        });

        content.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="md:col-span-1 space-y-6">
                    <h3 class="text-lg font-bold text-gray-800 border-b pb-2">Parent Profile</h3>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                        <input type="text" id="settingParentName" value="${escapeHtml(safeText(userData.parentName || 'Parent'))}" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Primary Phone (Login)</label>
                        <input type="text" value="${escapeHtml(safeText(userData.phone || ''))}" disabled class="w-full px-4 py-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed">
                        <p class="text-xs text-gray-500 mt-1">Contact support to change your login phone.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input type="email" id="settingParentEmail" value="${escapeHtml(safeText(userData.email || ''))}" class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>
                    <button id="saveParentProfileBtn" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors">Update My Profile</button>
                </div>
                <div class="md:col-span-2 space-y-6">
                    <h3 class="text-lg font-bold text-gray-800 border-b pb-2">Children &amp; Linked Contacts</h3>
                    <div class="space-y-6">${studentsHtml}</div>
                </div>
            </div>`;

        document.getElementById('saveParentProfileBtn')?.addEventListener('click', () => this.saveParentProfile());
        content.querySelectorAll('.save-student-btn').forEach(btn => {
            btn.addEventListener('click', () => this.updateStudent(btn.dataset.studentId, btn.dataset.collection));
        });
    }

    async saveParentProfile() {
        const user  = auth.currentUser;
        if (!user) return;
        const name  = document.getElementById('settingParentName')?.value.trim();
        const email = document.getElementById('settingParentEmail')?.value.trim();
        if (!name) { showMessage('Name is required', 'error'); return; }

        const btn = document.getElementById('saveParentProfileBtn');
        if (btn) { btn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Saving...'; btn.disabled = true; }

        try {
            await db.collection('parent_users').doc(user.uid).update({ parentName: name, email });
            const wm = document.getElementById('welcomeMessage');
            if (wm) wm.textContent = `Welcome, ${name}!`;
            showMessage('Profile updated!', 'success');
        } catch (err) {
            console.error(err);
            showMessage('Failed to update profile.', 'error');
        } finally {
            if (btn) { btn.innerHTML = 'Update My Profile'; btn.disabled = false; }
        }
    }

    async updateStudent(studentId, collectionName) {
        const get = id => document.getElementById(id)?.value.trim() ?? '';
        const newName     = get(`studentName_${studentId}`);
        const gender      = document.getElementById(`studentGender_${studentId}`)?.value || '';
        const motherPhone = get(`motherPhone_${studentId}`);
        const fatherPhone = get(`fatherPhone_${studentId}`);
        const email       = get(`guardianEmail_${studentId}`);

        if (!newName) { showMessage('Student name cannot be empty', 'error'); return; }

        const btn = document.querySelector(`.save-student-btn[data-student-id="${studentId}"]`);
        if (btn) { btn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Saving...'; btn.disabled = true; }

        try {
            await db.collection(collectionName).doc(studentId).update({
                studentName: newName, name: newName, gender,
                motherPhone, fatherPhone, guardianEmail: email,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Propagate contacts to reports
            if (motherPhone || fatherPhone || email) {
                await this._propagateSharedContacts(studentId, motherPhone, fatherPhone, email);
            }

            // Propagate name change
            await this._propagateNameChange(studentId, newName);

            showMessage(`${newName}'s details updated!`, 'success');
            setTimeout(() => window.authManager?.reloadDashboard(), 1000);
        } catch (err) {
            console.error(err);
            showMessage('Error updating student details.', 'error');
        } finally {
            if (btn) { btn.innerHTML = `💾 Save Details`; btn.disabled = false; }
        }
    }

    async _propagateNameChange(studentId, newName) {
        for (const col of ['tutor_submissions', 'student_results']) {
            try {
                const snap = await db.collection(col).where('studentId', '==', studentId).limit(50).get();
                if (!snap.empty) {
                    const batch = db.batch();
                    snap.forEach(doc => batch.update(db.collection(col).doc(doc.id), { studentName: newName, student: newName }));
                    await batch.commit();
                }
            } catch (e) {
                console.warn(`Name propagation failed for ${col}:`, e.message);
            }
        }
    }

    async _propagateSharedContacts(studentId, motherPhone, fatherPhone, guardianEmail) {
        for (const col of ['tutor_submissions', 'student_results']) {
            try {
                const snap = await db.collection(col).where('studentId', '==', studentId).get();
                if (!snap.empty) {
                    const batch = db.batch();
                    let count = 0;
                    snap.forEach(doc => {
                        const upd = {};
                        if (motherPhone)  upd.motherPhone  = motherPhone;
                        if (fatherPhone)  upd.fatherPhone  = fatherPhone;
                        if (guardianEmail) upd.guardianEmail = guardianEmail;
                        if (Object.keys(upd).length) { batch.update(db.collection(col).doc(doc.id), upd); count++; }
                    });
                    if (count) await batch.commit();
                }
            } catch (e) {
                console.warn(`Contact propagation failed for ${col}:`, e.message);
            }
        }
    }
}

const settingsManager = new SettingsManager();

// ============================================================================
// SECTION 19: GOOGLE CLASSROOM HOMEWORK MODAL
// ============================================================================

const CLOUDINARY_CONFIG = { cloudName: 'dwjq7j5zp', uploadPreset: 'tutor_homework' };

(function injectCloudinaryScript() {
    if (!document.getElementById('cloudinary-script')) {
        const s = document.createElement('script');
        s.id  = 'cloudinary-script';
        s.src = 'https://upload-widget.cloudinary.com/global/all.js';
        document.head.appendChild(s);
    }

    const style = document.createElement('style');
    style.textContent = `
        .gc-modal-overlay { position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);z-index:9999;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(4px);animation:fadeIn .2s; }
        .gc-modal-container { background:#fff;width:90%;max-width:1000px;height:90vh;border-radius:8px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.2); }
        .gc-header { padding:16px 24px;border-bottom:1px solid #e0e0e0;display:flex;justify-content:space-between;align-items:center; }
        .gc-body   { display:flex;flex:1;overflow-y:auto;background:#fff; }
        .gc-main   { flex:1;padding:24px;border-right:1px solid #f0f0f0; }
        .gc-sidebar{ width:350px;padding:24px;background:#fff; }
        .gc-title  { font-size:2rem;color:#1967d2;margin-bottom:8px;font-weight:400; }
        .gc-card   { background:#fff;border:1px solid #dadce0;border-radius:8px;padding:16px;box-shadow:0 1px 2px rgba(60,64,67,.3);margin-bottom:16px; }
        .gc-btn-primary { width:100%;padding:10px;background:#1967d2;border:none;border-radius:4px;color:#fff;font-weight:500;cursor:pointer; }
        .gc-btn-primary:hover { background:#185abc; }
        .gc-btn-primary:disabled { background:#e0e0e0;cursor:not-allowed; }
        .gc-btn-unsubmit { width:100%;padding:10px;background:#fff;border:1px solid #dadce0;border-radius:4px;color:#3c4043;font-weight:500;cursor:pointer;margin-top:10px; }
        .gc-attachment { display:flex;align-items:center;border:1px solid #dadce0;border-radius:4px;padding:8px;margin-bottom:12px;cursor:pointer; }
        .gc-att-icon { width:36px;height:36px;background:#f1f3f4;color:#1967d2;display:flex;align-items:center;justify-content:center;margin-right:12px;border-radius:4px; }
        .gc-inject-btn { transition:opacity .3s; }
        @media(max-width:768px){ .gc-body{flex-direction:column} .gc-sidebar{width:100%;border-top:1px solid #e0e0e0} }
    `;
    document.head.appendChild(style);
})();

let homeworkListenerUnsub = null;

function openGoogleClassroomModal(hwData, studentId) {
    document.body.style.overflow = 'hidden';
    const overlay = document.createElement('div');
    overlay.id   = 'gcModal';
    overlay.className = 'gc-modal-overlay';
    overlay.innerHTML = `
        <div class="gc-modal-container">
            <div class="gc-header">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-blue-100 rounded-full text-blue-600">
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/></svg>
                    </div>
                    <span class="font-medium text-gray-600">Assignment Details</span>
                </div>
                <button id="gcModalCloseBtn" class="text-2xl text-gray-500 hover:text-black">×</button>
            </div>
            <div class="gc-body" id="gcBodyContent">
                <div class="flex justify-center items-center h-full w-full"><div class="loading-spinner"></div></div>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    document.getElementById('gcModalCloseBtn')?.addEventListener('click', closeGoogleClassroomModal);

    const hwRef = db.collection('homework_assignments').doc(hwData.id);
    if (homeworkListenerUnsub) homeworkListenerUnsub();
    homeworkListenerUnsub = hwRef.onSnapshot(doc => {
        if (doc.exists) {
            const fresh = { id: doc.id, ...doc.data() };
            if (!fresh.dueTimestamp && fresh.dueDate) fresh.dueTimestamp = getTimestamp(fresh.dueDate);
            renderGoogleClassroomContent(fresh, studentId);
        }
    });
}

function renderGoogleClassroomContent(hw, studentId) {
    const container = document.getElementById('gcBodyContent');
    if (!container) return;

    const isGraded   = hw.status === 'graded';
    const isSub      = ['submitted','completed','graded'].includes(hw.status);
    const isOverdue  = !isSub && hw.dueTimestamp && hw.dueTimestamp < Date.now();
    const statusText = isGraded ? 'Graded' : isSub ? 'Handed in' : isOverdue ? 'Missing' : 'Assigned';
    const statusCls  = isGraded ? 'text-black font-bold' : isSub ? 'text-green-700 font-bold' : isOverdue ? 'text-red-600 font-bold' : 'text-green-700';

    container.innerHTML = `
        <div class="gc-main">
            <h1 class="gc-title">${escapeHtml(safeText(hw.title || hw.subject || 'Assignment'))}</h1>
            <div class="text-gray-500 text-sm mb-6 flex gap-3">
                <span>${escapeHtml(safeText(hw.tutorName || 'Tutor'))}</span> •
                <span>Due ${escapeHtml(formatDetailedDate(hw.dueTimestamp))}</span> •
                <span class="${statusCls}">${statusText}</span>
            </div>
            <div class="border-b mb-6"></div>
            <div class="text-gray-800 leading-relaxed whitespace-pre-wrap mb-8">${escapeHtml(safeText(hw.description || hw.instructions || 'No instructions provided.'))}</div>
            ${hw.fileUrl ? `<div class="mt-4"><h4 class="text-sm font-medium text-gray-500 mb-2">Reference Materials</h4><a href="${escapeHtml(hw.fileUrl)}" target="_blank" rel="noopener noreferrer" class="gc-attachment hover:bg-gray-50"><div class="gc-att-icon">📎</div><div class="text-sm font-medium text-blue-900 truncate flex-1">Download Assignment File</div></a></div>` : ''}
        </div>
        <div class="gc-sidebar">
            <div class="gc-card">
                <div class="flex justify-between items-start mb-4">
                    <h2 class="text-lg font-medium text-gray-800">Your work</h2>
                    <div class="text-xs uppercase font-bold ${statusCls}">${statusText}</div>
                </div>
                ${isGraded ? `<div class="bg-green-50 p-3 rounded-lg mb-4"><p class="text-sm text-green-800"><strong>Grade:</strong> ${escapeHtml(String(hw.grade || hw.score || 'N/A'))}</p>${hw.feedback ? `<p class="text-sm text-green-700 mt-2 whitespace-pre-wrap">${escapeHtml(safeText(hw.feedback))}</p>` : ''}</div>` : ''}
                ${isSub && !isGraded ? '<div class="bg-green-50 p-3 rounded-lg mb-4 text-sm text-green-700">✅ Assignment submitted successfully!</div>' : ''}
                ${!isSub ? `<button id="gcUploadBtn" class="gc-btn-primary" data-hw-id="${escapeHtml(hw.id)}" data-student-id="${escapeHtml(studentId)}">📎 Add or Create</button>` : ''}
                ${isSub && !isGraded ? `<button id="gcUnsubmitBtn" class="gc-btn-unsubmit" data-hw-id="${escapeHtml(hw.id)}">Unsubmit</button>` : ''}
            </div>
        </div>`;

    document.getElementById('gcUploadBtn')?.addEventListener('click', btn => {
        uploadHomeworkFile(btn.target?.dataset?.hwId || hw.id, studentId);
    });
    document.getElementById('gcUnsubmitBtn')?.addEventListener('click', () => confirmUnsubmit(hw.id));
}

function closeGoogleClassroomModal() {
    document.getElementById('gcModal')?.remove();
    document.body.style.overflow = '';
    if (homeworkListenerUnsub) { homeworkListenerUnsub(); homeworkListenerUnsub = null; }
}

function uploadHomeworkFile(homeworkId, studentId) {
    if (!window.cloudinary) { showMessage('Upload widget loading, please wait...', 'info'); return; }
    window.cloudinary.openUploadWidget({
        cloudName: CLOUDINARY_CONFIG.cloudName,
        uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
        sources: ['local','camera'],
        maxFiles: 1
    }, async (error, result) => {
        if (error) { showMessage('Upload failed. Please try again.', 'error'); return; }
        if (result?.event === 'success') {
            const url = result.info.secure_url;
            try {
                await db.collection('homework_assignments').doc(homeworkId).update({
                    submissionUrl: url, status: 'submitted',
                    submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    studentId
                });
                showMessage('Assignment submitted successfully!', 'success');
            } catch (e) {
                console.error(e);
                showMessage('Error saving submission. Please try again.', 'error');
            }
        }
    });
}

function confirmUnsubmit(homeworkId) {
    // Modal-based confirm (avoids native confirm() blocking)
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 class="text-lg font-bold text-gray-800 mb-2">Unsubmit Assignment?</h3>
            <p class="text-gray-600 mb-6">This will retract your submission. You can re-submit later.</p>
            <div class="flex gap-3">
                <button id="confirmUnsubmitYes" class="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 font-semibold">Yes, Unsubmit</button>
                <button id="confirmUnsubmitNo" class="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 font-semibold">Cancel</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    document.getElementById('confirmUnsubmitYes').addEventListener('click', async () => {
        modal.remove();
        try {
            await db.collection('homework_assignments').doc(homeworkId).update({
                status: 'assigned',
                submissionUrl: firebase.firestore.FieldValue.delete()
            });
            showMessage('Assignment unsubmitted.', 'info');
        } catch (e) {
            console.error(e);
            showMessage('Error unsubmitting assignment.', 'error');
        }
    });
    document.getElementById('confirmUnsubmitNo').addEventListener('click', () => modal.remove());
}

function scanAndInjectButtons() {
    document.querySelectorAll('#academicsContent .bg-white.border.rounded-lg').forEach(card => {
        if (card.querySelector('.gc-inject-btn')) return;
        if (!card.textContent.includes('Due:')) return;

        const btnWrap = document.createElement('div');
        btnWrap.className = 'mt-4 pt-3 border-t border-gray-100 flex justify-end gc-inject-btn fade-in';
        const btn = document.createElement('button');
        btn.className = 'flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm';
        btn.innerHTML = '<span>📤</span><span>Turn In / View Details</span>';
        btn.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            const title = card.querySelector('h5')?.textContent.trim();
            if (title) findAndOpenHomework(title);
        });
        btnWrap.appendChild(btn);
        card.appendChild(btnWrap);
    });
}

function findAndOpenHomework(titleText) {
    const selector   = document.getElementById('studentSelector');
    let studentName  = selector?.value || (userChildren.length > 0 ? userChildren[0] : null);
    if (!studentName) { showMessage('Please select a student first.', 'error'); return; }

    const studentId = studentIdMap.get(studentName);
    if (!studentId) { showMessage('Student ID not found.', 'error'); return; }

    showMessage('Opening classroom...', 'info');

    db.collection('homework_assignments').where('studentId','==',studentId).where('title','==',titleText).limit(1).get()
        .then(snap => {
            if (!snap.empty) {
                const hw = { id: snap.docs[0].id, ...snap.docs[0].data() };
                if (!hw.dueTimestamp && hw.dueDate) hw.dueTimestamp = getTimestamp(hw.dueDate);
                openGoogleClassroomModal(hw, studentId);
            } else {
                return db.collection('homework_assignments').where('studentId','==',studentId).get().then(s => {
                    const found = s.docs.find(d => (d.data().title || d.data().subject) === titleText);
                    if (found) {
                        const hw = { id: found.id, ...found.data() };
                        if (!hw.dueTimestamp && hw.dueDate) hw.dueTimestamp = getTimestamp(hw.dueDate);
                        openGoogleClassroomModal(hw, studentId);
                    } else {
                        showMessage('Could not find assignment details.', 'error');
                    }
                });
            }
        })
        .catch(err => { console.error(err); showMessage('Error loading assignment.', 'error'); });
}

// ============================================================================
// SECTION 20: HELPER FUNCTIONS
// ============================================================================

async function checkForNewAcademics() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        const uDoc   = await db.collection('parent_users').doc(user.uid).get();
        if (!uDoc.exists) return;
        const uData  = uDoc.data();
        const result = await comprehensiveFindChildren(uData.normalizedPhone || uData.phone);
        const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        let totalUnread = 0;

        for (const [, studentId] of result.studentNameIdMap) {
            try {
                const [topicsSnap, hwSnap] = await Promise.all([
                    db.collection('daily_topics').where('studentId','==',studentId).get(),
                    db.collection('homework_assignments').where('studentId','==',studentId).get()
                ]);
                topicsSnap.forEach(doc => {
                    const d = doc.data();
                    if ((d.date?.toDate?.() || d.createdAt?.toDate?.() || new Date(0)) >= oneWeekAgo) totalUnread++;
                });
                hwSnap.forEach(doc => {
                    const d = doc.data();
                    if ((d.assignedDate?.toDate?.() || d.createdAt?.toDate?.() || new Date(0)) >= oneWeekAgo) totalUnread++;
                });
            } catch { /* ignore per-student errors */ }
        }
        updateAcademicsTabBadge(totalUnread);
    } catch (err) {
        console.error('checkForNewAcademics error:', err);
    }
}

function updateAcademicsTabBadge(count) {
    const tab = document.getElementById('academicsTab');
    if (!tab) return;
    tab.querySelector('.academics-badge')?.remove();
    if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'academics-badge absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs min-w-5 h-5 flex items-center justify-center font-bold animate-pulse px-1';
        badge.style.cssText = 'line-height:1rem;font-size:.7rem;padding:0 4px';
        badge.textContent  = count > 9 ? '9+' : String(count);
        tab.style.position = 'relative';
        tab.appendChild(badge);
    }
}

// ── Shared-Access Helpers ────────────────────────────────────────────────────

async function findLinkedStudentsForContact(phone, email) {
    const linked = [];
    const suffix = extractPhoneSuffix(phone);
    if (!suffix && !email) return linked;

    try {
        const snap = await db.collection('students').get();
        snap.forEach(doc => {
            const data = doc.data();
            const name = safeText(data.studentName || data.name || '');
            if (!name) return;

            if (suffix) {
                for (const f of ['motherPhone','fatherPhone','guardianPhone','emergencyPhone']) {
                    if (data[f] && extractPhoneSuffix(data[f]) === suffix) {
                        linked.push({ studentId: doc.id, studentName: name, relationship: f.replace('Phone',''), matchedBy: 'phone' });
                        break;
                    }
                }
            }
            if (email && data.guardianEmail === email && !linked.find(l => l.studentId === doc.id)) {
                linked.push({ studentId: doc.id, studentName: name, relationship: 'guardian', matchedBy: 'email' });
            }
        });
    } catch (err) {
        console.error('findLinkedStudentsForContact error:', err);
    }
    return linked;
}

async function updateParentWithSharedAccess(parentUid, phone, email, linkedStudents) {
    try {
        await db.collection('parent_users').doc(parentUid).update({
            isSharedContact: true,
            linkedStudents: linkedStudents.map(s => ({
                studentId: s.studentId, studentName: s.studentName, relationship: s.relationship,
                linkedAt: firebase.firestore.FieldValue.serverTimestamp()
            })),
            sharedContactInfo: { phone, email, linkedAt: firebase.firestore.FieldValue.serverTimestamp() }
        });

        for (const s of linkedStudents) {
            try {
                await db.collection('students').doc(s.studentId).update({
                    sharedParents: firebase.firestore.FieldValue.arrayUnion({
                        parentUid, parentEmail: email, parentPhone: phone,
                        relationship: s.relationship, linkedAt: firebase.firestore.FieldValue.serverTimestamp()
                    })
                });
            } catch (e) {
                console.warn(`Could not update student ${s.studentName}:`, e.message);
            }
        }
    } catch (err) {
        console.error('updateParentWithSharedAccess error:', err);
    }
}

window.isSharedContact = async function(phone, email) {
    const linked = await findLinkedStudentsForContact(phone, email);
    return { isShared: linked.length > 0, linkedStudents: linked };
};

// ============================================================================
// SECTION 21: FORM & TAB HANDLERS
// ============================================================================

function handleSignIn() {
    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const password   = document.getElementById('loginPassword')?.value;
    if (!identifier || !password) { showMessage('Please fill in all fields', 'error'); return; }

    const btn    = document.getElementById('signInBtn');
    const loader = document.getElementById('authLoader');
    const text   = document.getElementById('signInText');
    const spin   = document.getElementById('signInSpinner');

    if (btn) btn.disabled = true;
    if (text) text.textContent = 'Signing In...';
    spin?.classList.remove('hidden');
    loader?.classList.remove('hidden');

    handleSignInFull(identifier, password, btn, loader);
}

function handleSignUp() {
    const countryCode = document.getElementById('countryCode')?.value;
    const localPhone  = document.getElementById('signupPhone')?.value.trim();
    const email       = document.getElementById('signupEmail')?.value.trim();
    const password    = document.getElementById('signupPassword')?.value;
    const confirm     = document.getElementById('signupConfirmPassword')?.value;

    if (!countryCode || !localPhone || !email || !password || !confirm) {
        showMessage('Please fill in all fields including country code', 'error'); return;
    }
    if (password.length < 6) { showMessage('Password must be at least 6 characters', 'error'); return; }
    if (password !== confirm)  { showMessage('Passwords do not match', 'error'); return; }

    const btn    = document.getElementById('signUpBtn');
    const loader = document.getElementById('authLoader');
    const text   = document.getElementById('signUpText');
    const spin   = document.getElementById('signUpSpinner');

    showSignupProgress(1);
    if (btn) btn.disabled = true;
    if (text) text.textContent = 'Creating...';
    spin?.classList.remove('hidden');
    loader?.classList.remove('hidden');

    setTimeout(() => showSignupProgress(2), 1000);
    handleSignUpFull(countryCode, localPhone, email, password, confirm, btn, loader)
        .then(() => setTimeout(() => showSignupProgress(3), 2500))
        .catch(() => hideSignupProgress());
}

function handlePasswordReset() {
    const email = document.getElementById('resetEmail')?.value.trim();
    if (!email) { showMessage('Please enter your email address', 'error'); return; }

    const btn    = document.getElementById('sendResetBtn');
    const loader = document.getElementById('resetLoader');
    if (btn) btn.disabled = true;
    loader?.classList.remove('hidden');

    handlePasswordResetFull(email, btn, loader);
}

function switchTab(tab) {
    const signin = tab === 'signin';
    document.getElementById('signInTab')?.classList.toggle('tab-inactive', !signin);
    document.getElementById('signInTab')?.classList.toggle('tab-active',    signin);
    document.getElementById('signUpTab')?.classList.toggle('tab-inactive',  signin);
    document.getElementById('signUpTab')?.classList.toggle('tab-active',   !signin);
    document.getElementById('signInForm')?.classList.toggle('hidden', !signin);
    document.getElementById('signUpForm')?.classList.toggle('hidden',  signin);
}

function switchMainTab(tab) {
    ['reportTab','academicsTab','rewardsTab'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('tab-active-main'); el.classList.add('tab-inactive-main'); }
    });
    ['reportContentArea','academicsContentArea','rewardsContentArea','settingsContentArea'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });

    if (tab === 'reports') {
        document.getElementById('reportTab')?.classList.replace('tab-inactive-main','tab-active-main');
        document.getElementById('reportContentArea')?.classList.remove('hidden');
    } else if (tab === 'academics') {
        document.getElementById('academicsTab')?.classList.replace('tab-inactive-main','tab-active-main');
        document.getElementById('academicsContentArea')?.classList.remove('hidden');
        loadAcademicsData();
    } else if (tab === 'rewards') {
        document.getElementById('rewardsTab')?.classList.replace('tab-inactive-main','tab-active-main');
        document.getElementById('rewardsContentArea')?.classList.remove('hidden');
        const user = auth.currentUser;
        if (user) loadReferralRewards(user.uid);
    }
}

// ── Signup Progress Indicator ────────────────────────────────────────────────

function showSignupProgress(step) {
    const msgs = ['Creating your account...','Setting up your profile...','Almost done...','Welcome!'];
    let div = document.getElementById('signupProgress');
    if (!div) {
        div = document.createElement('div');
        div.id        = 'signupProgress';
        div.className = 'fixed top-20 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg z-50';
        document.body.appendChild(div);
    }
    div.innerHTML = `
        <div class="flex items-center">
            <div class="loading-spinner-small mr-3"></div>
            <div>
                <div class="font-semibold">${escapeHtml(msgs[step - 1] || 'Processing...')}</div>
                <div class="text-xs opacity-80 mt-1">Step ${step} of ${msgs.length}</div>
            </div>
        </div>`;
}

function hideSignupProgress() {
    document.getElementById('signupProgress')?.remove();
}

// ── Auth Modals / Logout ─────────────────────────────────────────────────────

function showPasswordResetModal() { document.getElementById('passwordResetModal')?.classList.remove('hidden'); }
function hidePasswordResetModal() { document.getElementById('passwordResetModal')?.classList.add('hidden'); }

function logout() {
    ['rememberMe','savedEmail','isAuthenticated'].forEach(k => localStorage.removeItem(k));
    cleanupRealTimeListeners();
    auth.signOut().then(() => window.location.reload()).catch(console.error);
}

// ── Remember Me ──────────────────────────────────────────────────────────────

function setupRememberMe() {
    const saved = localStorage.getItem('rememberMe') === 'true' && localStorage.getItem('savedEmail');
    if (saved) {
        const input = document.getElementById('loginIdentifier');
        const cb    = document.getElementById('rememberMe');
        if (input) input.value = safeText(localStorage.getItem('savedEmail'));
        if (cb) cb.checked = true;
    }
}

function handleRememberMe() {
    const cb    = document.getElementById('rememberMe');
    const input = document.getElementById('loginIdentifier');
    if (!cb || !input) return;
    if (cb.checked && input.value.trim()) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedEmail', safeText(input.value.trim()));
    } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedEmail');
    }
}

// ============================================================================
// SECTION 22: EVENT LISTENERS (named references for proper cleanup)
// ============================================================================

const _handlers = {
    signIn:     () => handleSignIn(),
    signUp:     () => handleSignUp(),
    sendReset:  () => handlePasswordReset(),
    switchSignin: () => switchTab('signin'),
    switchSignup: () => switchTab('signup'),
    forgotPw:   () => showPasswordResetModal(),
    cancelReset: () => hidePasswordResetModal(),
    rememberMe: () => handleRememberMe(),
    loginEnter:  e => { if (e.key === 'Enter') handleSignIn(); },
    signupEnter: e => { if (e.key === 'Enter') handleSignUp(); },
    resetEnter:  e => { if (e.key === 'Enter') handlePasswordReset(); },
    reportTab:   () => switchMainTab('reports'),
    academicsTab: () => switchMainTab('academics'),
    rewardsTab:  () => switchMainTab('rewards')
};

function setupEventListeners() {
    const bind = (id, event, handler) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.removeEventListener(event, handler);
        el.addEventListener(event, handler);
    };

    bind('signInBtn',           'click',   _handlers.signIn);
    bind('signUpBtn',           'click',   _handlers.signUp);
    bind('sendResetBtn',        'click',   _handlers.sendReset);
    bind('signInTab',           'click',   _handlers.switchSignin);
    bind('signUpTab',           'click',   _handlers.switchSignup);
    bind('forgotPasswordBtn',   'click',   _handlers.forgotPw);
    bind('cancelResetBtn',      'click',   _handlers.cancelReset);
    bind('rememberMe',          'change',  _handlers.rememberMe);
    bind('loginPassword',       'keypress',_handlers.loginEnter);
    bind('signupConfirmPassword','keypress',_handlers.signupEnter);
    bind('resetEmail',          'keypress',_handlers.resetEnter);
    bind('reportTab',           'click',   _handlers.reportTab);
    bind('academicsTab',        'click',   _handlers.academicsTab);
    bind('rewardsTab',          'click',   _handlers.rewardsTab);
}

function setupGlobalErrorHandler() {
    window.addEventListener('unhandledrejection', e => { console.error('Unhandled rejection:', e.reason); e.preventDefault(); });
    window.addEventListener('error', e => {
        console.error('Global error:', e.error);
        if (!e.error?.message?.includes('auth') && !e.error?.message?.includes('permission-denied')) {
            showMessage('An unexpected error occurred. Please refresh.', 'error');
        }
    });
    window.addEventListener('offline', () => showMessage('You are offline. Some features may not work.', 'warning'));
    window.addEventListener('online',  () => showMessage('Connection restored.', 'success'));
}

// ============================================================================
// SECTION 23: INITIALIZATION
// ============================================================================

function initializeParentPortalV2() {
    setupRememberMe();
    injectCustomCSS();
    createCountryCodeDropdown();
    setupEventListeners();
    setupGlobalErrorHandler();

    authManager.initialize();

    window.addEventListener('beforeunload', () => {
        authManager.cleanup();
        cleanupRealTimeListeners();
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initializeParentPortalV2();

    // Google Classroom button scanner
    setTimeout(scanAndInjectButtons, 500);

    const observer = new MutationObserver(() => setTimeout(scanAndInjectButtons, 100));
    const target   = document.getElementById('academicsContent');
    if (target) observer.observe(target, { childList: true, subtree: true });

    // Tracked interval (will be cleaned up on unload)
    const scanIntervalId = setInterval(scanAndInjectButtons, 2000);
    window.realTimeIntervals.push(scanIntervalId);
});

// ============================================================================
// SECTION 24: GLOBAL EXPORTS
// ============================================================================

window.authManager           = authManager;
window.settingsManager       = settingsManager;
window.comprehensiveFindChildren = comprehensiveFindChildren;
window.searchAllReportsForParent = searchAllReportsForParent;
window.loadAllReportsForParent   = loadAllReportsForParent;
window.manualRefreshReportsV2    = manualRefreshReportsV2;
window.loadAcademicsData         = loadAcademicsData;
window.onStudentSelected         = window.onStudentSelected;
window.toggleAcademicsAccordion  = window.toggleAcademicsAccordion;
window.toggleAccordion           = toggleAccordion;
window.downloadSessionReport     = downloadSessionReport;
window.downloadMonthlyReport     = window.downloadMonthlyReport;
window.switchMainTab             = switchMainTab;
window.switchTab                 = switchTab;
window.logout                    = logout;
window.showPasswordResetModal    = showPasswordResetModal;
window.hidePasswordResetModal    = hidePasswordResetModal;
window.handleHomeworkAction      = window.handleHomeworkAction;
window.forceDownload             = window.forceDownload;
window.tempSignupData            = null;

// ============================================================================
// SECTION 25: PREMIUM DASHBOARD UI (SAAS STYLE)
// ============================================================================

(function injectPremiumUI() {
    const style = document.createElement('style');
    style.textContent = `
        :root {
            --brand-primary: #10b981;
            --brand-dark: #064e3b;
            --brand-light: #ecfdf5;
            --bg-main: #f8fafc;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --card-shadow: 0 4px 6px -1px rgba(0,0,0,.05), 0 2px 4px -1px rgba(0,0,0,.03);
            --card-hover:  0 20px 25px -5px rgba(0,0,0,.1), 0 10px 10px -5px rgba(0,0,0,.04);
        }
        body { background-color:var(--bg-main)!important; color:var(--text-main)!important; font-family:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important; letter-spacing:-.01em; }
        #reportArea, #authArea { max-width:1200px!important; margin:2rem auto!important; padding:0 1.5rem!important; }
        .bg-white, .gc-card, .accordion-item, [id^="assessment-block"], [id^="monthly-block"] {
            border-radius:16px!important; border:1px solid rgba(226,232,240,.8)!important;
            box-shadow:var(--card-shadow)!important; transition:all .3s cubic-bezier(.4,0,.2,1)!important;
            overflow:hidden; background:#fff!important;
        }
        .bg-white:hover { box-shadow:var(--card-hover)!important; transform:translateY(-2px); }
        .bg-green-50 {
            background:linear-gradient(135deg,var(--brand-dark) 0%,#065f46 100%)!important;
            border-radius:20px!important; padding:3rem 2rem!important; color:#fff!important;
            margin-bottom:2rem!important; box-shadow:0 10px 15px -3px rgba(16,185,129,.2)!important;
        }
        #welcomeMessage { font-size:2.25rem!important; font-weight:800!important; letter-spacing:-.025em!important; margin-bottom:.5rem!important; }
        .bg-green-50 p { color:rgba(255,255,255,.8)!important; font-size:1.1rem!important; }
        .flex.mb-8.bg-gray-100 { background:#e2e8f0!important; padding:6px!important; border-radius:12px!important; display:inline-flex!important; width:auto!important; margin-bottom:2.5rem!important; }
        .tab-active-main   { background:#fff!important; color:var(--brand-dark)!important; box-shadow:0 4px 6px rgba(0,0,0,.05)!important; border-radius:8px!important; font-weight:600!important; padding:10px 24px!important; }
        .tab-inactive-main { color:var(--text-muted)!important; font-weight:500!important; padding:10px 24px!important; transition:color .2s ease!important; }
        button { border-radius:10px!important; font-weight:600!important; transition:all .2s ease!important; }
        .bg-green-600 { background-color:var(--brand-primary)!important; box-shadow:0 4px 14px 0 rgba(16,185,129,.39)!important; }
        .bg-green-600:hover { background-color:#059669!important; transform:scale(1.02); }
        .accordion-header { border:none!important; padding:1.5rem!important; font-weight:700!important; }
        .bg-blue-100   { background-color:#f0f9ff!important; border-left:5px solid #0ea5e9!important; }
        .bg-purple-100 { background-color:#f5f3ff!important; border-left:5px solid #8b5cf6!important; }
        .bg-green-100  { background-color:#ecfdf5!important; border-left:5px solid #10b981!important; }
        table { border-radius:12px!important; border-collapse:separate!important; border-spacing:0!important; border:1px solid #f1f5f9!important; }
        th { background-color:#f8fafc!important; color:var(--text-muted)!important; text-transform:uppercase!important; font-size:.75rem!important; font-weight:700!important; padding:1rem!important; }
        td { padding:1rem!important; border-bottom:1px solid #f1f5f9!important; }
        [data-homework-id] { border-left:4px solid #cbd5e1!important; }
        input, select { border:1.5px solid #e2e8f0!important; border-radius:10px!important; padding:.75rem 1rem!important; }
        input:focus { border-color:var(--brand-primary)!important; box-shadow:0 0 0 4px var(--brand-light)!important; }
        /* Toast colors preserved by type — do not override with a single color */
        .message-toast {
            border-radius:12px!important; backdrop-filter:blur(8px)!important;
            border:1px solid rgba(255,255,255,.2)!important; padding:1rem 1.5rem!important; font-weight:500!important;
        }
    `;
    document.head.appendChild(style);
    console.log('💎 Premium UI applied.');
})();

// ============================================================================
// END OF PARENT.JS — PRODUCTION READY
// ============================================================================
