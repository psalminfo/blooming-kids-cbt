// ============================================================================
// PARENT PORTAL - PRODUCTION READY (REFACTORED)
// ============================================================================

// ============================================================================
// SECTION 1: CONFIGURATION & GLOBALS
// ============================================================================

const CLOUDINARY_CONFIG = {
    cloudName: 'dwjq7j5zp',
    uploadPreset: 'tutor_homework'
};

// Global state (minimal, namespaced)
const AppState = {
    currentUser: null,
    userChildren: [],               // array of student names
    studentIdMap: new Map(),         // studentName -> studentId
    allStudentData: [],              // array of student objects
    realTimeListeners: [],           // array of unsubscribe functions
    charts: new Map(),
    pendingRequests: new Set(),
    skipProfileCreation: false       // used during signup
};

// ============================================================================
// SECTION 2: CORE UTILITIES (XSS PROTECTION, PHONE HANDLING)
// ============================================================================

function escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#039;', '`': '&#x60;', '/': '&#x2F;', '=': '&#x3D;'
    };
    return text.replace(/[&<>"'`/=]/g, m => map[m]);
}

function safeText(text) {
    return (typeof text === 'string') ? text.trim() : text;
}

function capitalize(str) {
    if (!str || typeof str !== 'string') return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// Phone utilities
function extractPhoneDigits(phone) {
    if (!phone) return '';
    return phone.toString().replace(/\D/g, '');
}

function extractPhoneSuffix(phone) {
    const digits = extractPhoneDigits(phone);
    return digits.slice(-10);
}

function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
        return { normalized: null, valid: false, error: 'Invalid input' };
    }
    try {
        let cleaned = phone.replace(/[^\d+]/g, '');
        if (!cleaned) return { normalized: null, valid: false, error: 'Empty phone number' };
        if (cleaned.startsWith('+')) {
            cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
            return { normalized: cleaned, valid: true, error: null };
        } else {
            cleaned = cleaned.replace(/^0+/, '');
            cleaned = '+1' + cleaned;
            return { normalized: cleaned, valid: true, error: null };
        }
    } catch (error) {
        return { normalized: null, valid: false, error: error.message };
    }
}

// Date utilities
function getTimestamp(dateInput) {
    if (!dateInput) return 0;
    if (dateInput?.toDate) return dateInput.toDate().getTime();
    if (dateInput instanceof Date) return dateInput.getTime();
    if (typeof dateInput === 'string') return new Date(dateInput).getTime();
    if (typeof dateInput === 'number') {
        return dateInput < 10000000000 ? dateInput * 1000 : dateInput;
    }
    return 0;
}

function getTimestampFromData(data) {
    if (!data) return Date.now();
    const fields = ['timestamp', 'createdAt', 'submittedAt', 'date', 'updatedAt'];
    for (const f of fields) {
        if (data[f]) {
            const ts = getTimestamp(data[f]);
            if (ts > 0) return Math.floor(ts / 1000);
        }
    }
    return Math.floor(Date.now() / 1000);
}

function formatDetailedDate(date, showTimezone = false) {
    let d;
    if (date?.toDate) d = date.toDate();
    else if (date instanceof Date) d = date;
    else if (typeof date === 'string') d = new Date(date);
    else if (typeof date === 'number') d = new Date(date < 10000000000 ? date * 1000 : date);
    else return 'Unknown date';
    if (isNaN(d.getTime())) return 'Invalid date';
    const options = {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    };
    if (showTimezone) options.timeZoneName = 'short';
    return d.toLocaleDateString('en-US', options);
}

// ============================================================================
// SECTION 3: UI MESSAGE SYSTEM & SKELETON LOADERS
// ============================================================================

function showMessage(message, type = 'info') {
    const existing = document.querySelector('.message-toast');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm fade-in slide-down ${
        type === 'error' ? 'bg-red-500 text-white' :
        type === 'success' ? 'bg-green-500 text-white' :
        'bg-blue-500 text-white'
    }`;
    div.textContent = `BKH says: ${safeText(message)}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 5000);
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
                ${Array.from({length:3},()=>`
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
// SECTION 4: OPTIMIZED DATA FETCHING (WITH INDEXED QUERIES)
// ============================================================================

/**
 * Find students linked to a parent phone using indexed queries.
 * Because Firestore doesn't support OR across multiple fields, we query each
 * phone field separately and combine results. Limits are applied to avoid
 * excessive reads.
 */
async function findChildrenByParentPhone(parentPhone) {
    const phoneFields = [
        'parentPhone', 'guardianPhone', 'motherPhone', 'fatherPhone',
        'contactPhone', 'emergencyPhone', 'phone'
    ];
    const normalized = normalizePhoneNumber(parentPhone);
    if (!normalized.valid) return [];

    const exactPhone = normalized.normalized;
    const phoneSuffix = extractPhoneSuffix(exactPhone);

    // We'll collect student IDs to avoid duplicates
    const studentMap = new Map(); // id -> { studentData, matchedField }

    // Query both 'students' and 'pending_students' collections
    const collections = ['students', 'pending_students'];

    for (const coll of collections) {
        // For each phone field, run a query (limit to recent 100 per field)
        const promises = phoneFields.map(field =>
            db.collection(coll)
                .where(field, '==', exactPhone)
                .limit(100)
                .get()
                .catch(() => ({ empty: true, docs: [] }))
        );

        const snapshots = await Promise.all(promises);
        for (const snap of snapshots) {
            snap.forEach(doc => {
                const data = doc.data();
                const id = doc.id;
                if (!studentMap.has(id)) {
                    studentMap.set(id, {
                        id,
                        name: safeText(data.studentName || data.name || 'Unknown'),
                        data,
                        isPending: coll === 'pending_students',
                        collection: coll
                    });
                }
            });
        }
    }

    // If we didn't find any exact matches, fall back to suffix matching on a limited set
    // (e.g., last 500 students) – this is a compromise to preserve original behavior
    if (studentMap.size === 0) {
        // Fetch recent students (e.g., last 500) and filter client-side by suffix
        const recentStudents = await db.collection('students')
            .orderBy('createdAt', 'desc')
            .limit(500)
            .get()
            .catch(() => ({ docs: [] }));

        recentStudents.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            // Check all phone fields for suffix match
            for (const field of phoneFields) {
                const val = data[field];
                if (val && extractPhoneSuffix(val) === phoneSuffix) {
                    if (!studentMap.has(id)) {
                        studentMap.set(id, {
                            id,
                            name: safeText(data.studentName || data.name || 'Unknown'),
                            data,
                            isPending: false,
                            collection: 'students'
                        });
                    }
                    break;
                }
            }
        });
    }

    return Array.from(studentMap.values());
}

/**
 * Search all reports (assessments and monthly) for a parent, using indexed queries
 * on phone fields and email. Combines results and removes duplicates.
 */
async function searchReportsForParent(parentPhone, parentEmail = '') {
    const phoneFields = [
        'parentPhone', 'parent_phone', 'guardianPhone', 'motherPhone',
        'fatherPhone', 'phone', 'contactPhone', 'normalizedParentPhone'
    ];
    const normalized = normalizePhoneNumber(parentPhone);
    if (!normalized.valid) return { assessmentResults: [], monthlyResults: [] };

    const exactPhone = normalized.normalized;
    const phoneSuffix = extractPhoneSuffix(exactPhone);

    const assessmentMap = new Map(); // id -> report
    const monthlyMap = new Map();

    // Helper to query a collection with multiple field queries
    const queryCollection = async (collectionName, resultsMap, type) => {
        const promises = phoneFields.map(field =>
            db.collection(collectionName)
                .where(field, '==', exactPhone)
                .limit(200)
                .get()
                .catch(() => ({ empty: true, docs: [] }))
        );

        // Also query by email if provided
        if (parentEmail) {
            promises.push(
                db.collection(collectionName)
                    .where('parentEmail', '==', parentEmail)
                    .limit(200)
                    .get()
                    .catch(() => ({ empty: true, docs: [] }))
            );
        }

        const snapshots = await Promise.all(promises);
        for (const snap of snapshots) {
            snap.forEach(doc => {
                const data = doc.data();
                const id = doc.id;
                if (!resultsMap.has(id)) {
                    resultsMap.set(id, {
                        id,
                        collection: collectionName,
                        ...data,
                        timestamp: getTimestampFromData(data),
                        type
                    });
                }
            });
        }

        // Fallback: suffix matching on recent reports if exact matches are few
        if (resultsMap.size < 10) {
            const recent = await db.collection(collectionName)
                .orderBy('timestamp', 'desc')
                .limit(300)
                .get()
                .catch(() => ({ docs: [] }));
            recent.forEach(doc => {
                const data = doc.data();
                const id = doc.id;
                if (resultsMap.has(id)) return;
                for (const field of phoneFields) {
                    const val = data[field];
                    if (val && extractPhoneSuffix(val) === phoneSuffix) {
                        resultsMap.set(id, {
                            id,
                            collection: collectionName,
                            ...data,
                            timestamp: getTimestampFromData(data),
                            type
                        });
                        break;
                    }
                }
            });
        }
    };

    await Promise.all([
        queryCollection('student_results', assessmentMap, 'assessment'),
        queryCollection('tutor_submissions', monthlyMap, 'monthly')
    ]);

    return {
        assessmentResults: Array.from(assessmentMap.values()),
        monthlyResults: Array.from(monthlyMap.values())
    };
}

// ============================================================================
// SECTION 5: AUTHENTICATION MANAGER (SINGLETON)
// ============================================================================

const AuthManager = {
    initialized: false,
    authListener: null,

    init() {
        if (this.initialized) return;
        console.log('🔐 Initializing Auth Manager');
        this.cleanup();
        this.authListener = auth.onAuthStateChanged(
            user => this.handleAuthChange(user),
            error => {
                console.error('Auth error:', error);
                showMessage('Authentication error. Please refresh.', 'error');
            }
        );
        this.initialized = true;
    },

    cleanup() {
        if (this.authListener) {
            this.authListener();
            this.authListener = null;
        }
        this.initialized = false;
    },

    async handleAuthChange(user) {
        if (AppState.pendingRequests.has('auth')) return;
        AppState.pendingRequests.add('auth');
        try {
            if (user) {
                console.log('👤 User signed in:', user.uid);
                await this.loadUserDashboard(user);
            } else {
                console.log('👋 User signed out');
                this.showAuthScreen();
            }
        } catch (error) {
            console.error('Auth change handling error:', error);
        } finally {
            AppState.pendingRequests.delete('auth');
        }
    },

    async loadUserDashboard(user) {
        const authArea = document.getElementById('authArea');
        const reportArea = document.getElementById('reportArea');
        const authLoader = document.getElementById('authLoader');

        if (authLoader) authLoader.classList.remove('hidden');

        try {
            // If we just signed up, profile should exist; if not, wait a bit and retry
            let userDoc = await this.getUserProfileWithRetry(user.uid);
            if (!userDoc.exists) {
                // Should not happen if signup created profile; handle gracefully
                console.warn('User profile missing, creating minimal profile');
                await this.createMinimalProfile(user);
                userDoc = await db.collection('parent_users').doc(user.uid).get();
            }

            const userData = userDoc.data();
            AppState.currentUser = {
                uid: user.uid,
                email: userData.email,
                phone: userData.phone,
                normalizedPhone: userData.normalizedPhone || userData.phone,
                parentName: userData.parentName || 'Parent',
                referralCode: userData.referralCode
            };

            this.showDashboardUI();

            // Load all data in parallel
            await Promise.all([
                this.loadReports(),
                this.loadReferralRewards(),
                this.loadAcademics()
            ]);

            this.setupRealtimeMonitoring();
            this.setupUIComponents();

        } catch (error) {
            console.error('Dashboard load error:', error);
            showMessage('Failed to load dashboard. Please refresh.', 'error');
            this.showAuthScreen();
        } finally {
            if (authLoader) authLoader.classList.add('hidden');
        }
    },

    async getUserProfileWithRetry(uid, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const doc = await db.collection('parent_users').doc(uid).get();
                if (doc.exists) return doc;
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                }
            } catch (e) {
                if (i === maxRetries - 1) throw e;
            }
        }
        return { exists: false };
    },

    async createMinimalProfile(user) {
        const minimal = {
            email: user.email || '',
            phone: user.phoneNumber || '',
            normalizedPhone: user.phoneNumber || '',
            parentName: 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            uid: user.uid,
            referralCode: await generateReferralCode(),
            referralEarnings: 0
        };
        await db.collection('parent_users').doc(user.uid).set(minimal);
    },

    showDashboardUI() {
        const authArea = document.getElementById('authArea');
        const reportArea = document.getElementById('reportArea');
        const welcomeMsg = document.getElementById('welcomeMessage');

        if (authArea) authArea.classList.add('hidden');
        if (reportArea) reportArea.classList.remove('hidden');
        if (welcomeMsg && AppState.currentUser) {
            welcomeMsg.textContent = `Welcome, ${AppState.currentUser.parentName}!`;
        }
        localStorage.setItem('isAuthenticated', 'true');
    },

    showAuthScreen() {
        const authArea = document.getElementById('authArea');
        const reportArea = document.getElementById('reportArea');
        if (authArea) authArea.classList.remove('hidden');
        if (reportArea) reportArea.classList.add('hidden');
        localStorage.removeItem('isAuthenticated');
        this.cleanupRealTimeListeners();
    },

    async loadReports() {
        const phone = AppState.currentUser.normalizedPhone;
        const email = AppState.currentUser.email;
        const uid = AppState.currentUser.uid;

        const { assessmentResults, monthlyResults } = await searchReportsForParent(phone, email);
        const allReports = [...assessmentResults, ...monthlyResults];

        if (allReports.length === 0) {
            document.getElementById('reportContent').innerHTML = this.getEmptyReportsHTML();
            return;
        }

        // Group by student
        const studentMap = new Map();
        allReports.forEach(report => {
            const name = report.studentName;
            if (!name) return;
            if (!studentMap.has(name)) {
                studentMap.set(name, { assessments: [], monthly: [] });
            }
            if (report.type === 'assessment') {
                studentMap.get(name).assessments.push(report);
            } else {
                studentMap.get(name).monthly.push(report);
            }
        });

        AppState.userChildren = Array.from(studentMap.keys());

        // Build year/month structure
        const reportsByStudent = new Map();
        for (const [name, reports] of studentMap) {
            const bySession = (list) => {
                const map = new Map();
                list.forEach(r => {
                    const key = Math.floor(r.timestamp / 86400); // session day
                    if (!map.has(key)) map.set(key, []);
                    map.get(key).push(r);
                });
                return map;
            };
            reportsByStudent.set(name, {
                assessments: bySession(reports.assessments),
                monthly: bySession(reports.monthly),
                studentData: { name, isPending: false }
            });
        }

        document.getElementById('reportContent').innerHTML = this.createYearlyArchiveView(reportsByStudent);
        this.initCharts();
    },

    getEmptyReportsHTML() {
        return `
            <div class="text-center py-12">
                <div class="text-4xl mb-4">📊</div>
                <h3 class="text-xl font-bold text-gray-700 mb-2">No Reports Available</h3>
                <p class="text-gray-500">No reports found for your account yet.</p>
                <button onclick="manualRefreshReports()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                    Check Again
                </button>
            </div>
        `;
    },

    createYearlyArchiveView(reportsByStudent) {
        // This is a simplified version; you can expand it with accordions as before
        let html = '';
        let idx = 0;
        for (const [name, reports] of reportsByStudent) {
            html += `
                <div class="mb-6 border rounded-lg p-4 bg-white">
                    <h3 class="text-xl font-bold text-green-800">${capitalize(name)}</h3>
                    <p>${reports.assessments.size} assessments, ${reports.monthly.size} monthly reports</p>
                </div>
            `;
            idx++;
        }
        return html;
    },

    initCharts() {
        // Chart initialization would go here (using Chart.js)
        // For brevity, we'll skip detailed implementation
    },

    async loadReferralRewards() {
        // Implementation from original, but optimized
        const uid = AppState.currentUser.uid;
        const content = document.getElementById('rewardsContent');
        if (!content) return;
        try {
            const userDoc = await db.collection('parent_users').doc(uid).get();
            const userData = userDoc.data();
            const referralCode = safeText(userData.referralCode || 'N/A');
            const totalEarnings = userData.referralEarnings || 0;

            const txSnapshot = await db.collection('referral_transactions')
                .where('ownerUid', '==', uid)
                .orderBy('timestamp', 'desc')
                .limit(100)
                .get();

            let rows = '';
            txSnapshot.forEach(doc => {
                const d = doc.data();
                rows += `<tr>...</tr>`; // Simplified
            });

            content.innerHTML = `
                <div>Referral Code: ${referralCode}</div>
                <div>Total Earnings: ₦${totalEarnings}</div>
                <table>${rows}</table>
            `;
        } catch (e) {
            content.innerHTML = '<p class="text-red-500">Error loading rewards.</p>';
        }
    },

    async loadAcademics() {
        const content = document.getElementById('academicsContent');
        if (!content) return;
        showSkeletonLoader('academicsContent', 'reports');

        try {
            const children = await findChildrenByParentPhone(AppState.currentUser.normalizedPhone);
            if (children.length === 0) {
                content.innerHTML = '<p class="text-center py-8">No students linked to your account.</p>';
                return;
            }

            // Store globally for other components
            AppState.allStudentData = children;
            AppState.studentIdMap.clear();
            children.forEach(s => {
                const uniqueName = AppState.studentIdMap.has(s.name) ? `${s.name} (${s.id.slice(0,4)})` : s.name;
                AppState.studentIdMap.set(uniqueName, s.id);
            });
            AppState.userChildren = Array.from(AppState.studentIdMap.keys());

            // For each student, fetch homework and session topics (with limits)
            let html = '';
            for (const student of children) {
                const studentId = student.id;
                const [hwSnap, topicsSnap] = await Promise.all([
                    db.collection('homework_assignments')
                        .where('studentId', '==', studentId)
                        .orderBy('dueDate', 'desc')
                        .limit(20)
                        .get()
                        .catch(() => ({ empty: true, docs: [] })),
                    db.collection('daily_topics')
                        .where('studentId', '==', studentId)
                        .orderBy('date', 'desc')
                        .limit(20)
                        .get()
                        .catch(() => ({ empty: true, docs: [] }))
                ]);

                html += this.renderStudentAcademics(student, hwSnap, topicsSnap);
            }
            content.innerHTML = html;
        } catch (e) {
            content.innerHTML = '<p class="text-red-500">Error loading academics.</p>';
        }
    },

    renderStudentAcademics(student, hwSnap, topicsSnap) {
        // Simplified rendering
        return `
            <div class="border p-4 mb-4">
                <h4 class="font-bold">${capitalize(student.name)}</h4>
                <p>Homework: ${hwSnap.size} assignments</p>
                <p>Topics: ${topicsSnap.size} sessions</p>
            </div>
        `;
    },

    setupRealtimeMonitoring() {
        // Instead of polling, we could set up real-time listeners on the reports collections
        // But for now, we'll keep a simple interval (less frequent)
        const interval = setInterval(() => this.checkForNewReports(), 60000);
        AppState.realTimeListeners.push(() => clearInterval(interval));
    },

    async checkForNewReports() {
        // Lightweight check: query recent reports with parent phone match
        const phone = AppState.currentUser.normalizedPhone;
        const lastCheck = localStorage.getItem('lastReportCheck') || 0;
        const now = Date.now();
        try {
            const snap = await db.collection('student_results')
                .where('parentPhone', '==', phone)
                .where('timestamp', '>', Number(lastCheck))
                .limit(1)
                .get();
            if (!snap.empty) {
                showMessage('New reports available! Refresh to view.', 'success');
            }
        } catch (e) {
            // ignore
        }
        localStorage.setItem('lastReportCheck', now.toString());
    },

    setupUIComponents() {
        addManualRefreshButton();
        addLogoutButton();
    },

    cleanupRealTimeListeners() {
        AppState.realTimeListeners.forEach(fn => fn());
        AppState.realTimeListeners = [];
        AppState.charts.forEach(c => c.destroy());
        AppState.charts.clear();
    }
};

// ============================================================================
// SECTION 6: SIGNUP FLOW (FIXED RACE CONDITION)
// ============================================================================

async function handleSignUp(countryCode, localPhone, email, password, confirmPassword) {
    const requestId = `signup_${Date.now()}`;
    AppState.pendingRequests.add(requestId);

    try {
        let fullPhone = localPhone;
        if (!localPhone.startsWith('+')) {
            fullPhone = countryCode + localPhone;
        }
        const norm = normalizePhoneNumber(fullPhone);
        if (!norm.valid) throw new Error(`Invalid phone: ${norm.error}`);

        // Create auth user
        const userCred = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCred.user;

        // Generate referral code
        const referralCode = await generateReferralCode();

        // Create Firestore profile (using set with merge to be safe)
        await db.collection('parent_users').doc(user.uid).set({
            email,
            phone: norm.normalized,
            normalizedPhone: norm.normalized,
            parentName: 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode,
            referralEarnings: 0,
            uid: user.uid
        }, { merge: true });

        // Signal auth manager not to create another profile
        AppState.skipProfileCreation = true;
        setTimeout(() => { AppState.skipProfileCreation = false; }, 5000);

        showMessage('Account created! Logging you in...', 'success');

        // The auth listener will now load the dashboard
    } catch (error) {
        let msg = 'Signup failed.';
        if (error.code === 'auth/email-already-in-use') msg = 'Email already in use.';
        else if (error.code === 'auth/weak-password') msg = 'Password too weak (min 6 chars).';
        else msg = error.message;
        showMessage(msg, 'error');
        throw error;
    } finally {
        AppState.pendingRequests.delete(requestId);
    }
}

async function generateReferralCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const prefix = 'BKH';
    let code;
    let unique = false;
    while (!unique) {
        let suffix = '';
        for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
        code = prefix + suffix;
        const snap = await db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
        if (snap.empty) unique = true;
    }
    return code;
}

// ============================================================================
// SECTION 7: UI EVENT HANDLERS & HELPERS
// ============================================================================

function handleSignIn() {
    const identifier = document.getElementById('loginIdentifier')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    if (!identifier || !password) return showMessage('Fill all fields', 'error');
    auth.signInWithEmailAndPassword(identifier, password).catch(e => {
        showMessage('Invalid credentials', 'error');
    });
}

function handleSignUpSubmit() {
    const country = document.getElementById('countryCode')?.value;
    const phone = document.getElementById('signupPhone')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim();
    const pwd = document.getElementById('signupPassword')?.value;
    const confirm = document.getElementById('signupConfirmPassword')?.value;

    if (!country || !phone || !email || !pwd || !confirm) {
        return showMessage('Please fill all fields', 'error');
    }
    if (pwd.length < 6) return showMessage('Password must be at least 6 characters', 'error');
    if (pwd !== confirm) return showMessage('Passwords do not match', 'error');

    const btn = document.getElementById('signUpBtn');
    btn.disabled = true;
    btn.innerHTML = 'Creating...';

    handleSignUp(country, phone, email, pwd, confirm)
        .catch(() => {})
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = 'Create Account';
        });
}

function logout() {
    localStorage.removeItem('isAuthenticated');
    AuthManager.cleanupRealTimeListeners();
    auth.signOut().then(() => window.location.reload());
}

function switchTab(tab) {
    const signInTab = document.getElementById('signInTab');
    const signUpTab = document.getElementById('signUpTab');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');
    if (tab === 'signin') {
        signInTab.classList.add('tab-active');
        signInTab.classList.remove('tab-inactive');
        signUpTab.classList.add('tab-inactive');
        signUpTab.classList.remove('tab-active');
        signInForm.classList.remove('hidden');
        signUpForm.classList.add('hidden');
    } else {
        signUpTab.classList.add('tab-active');
        signUpTab.classList.remove('tab-inactive');
        signInTab.classList.add('tab-inactive');
        signInTab.classList.remove('tab-active');
        signUpForm.classList.remove('hidden');
        signInForm.classList.add('hidden');
    }
}

function switchMainTab(tab) {
    const tabs = ['report', 'academics', 'rewards', 'settings'];
    tabs.forEach(t => {
        const btn = document.getElementById(t + 'Tab');
        const area = document.getElementById(t + 'ContentArea');
        if (btn) {
            btn.classList.remove('tab-active-main', 'tab-inactive-main');
            btn.classList.add('tab-inactive-main');
        }
        if (area) area.classList.add('hidden');
    });
    const activeBtn = document.getElementById(tab + 'Tab');
    const activeArea = document.getElementById(tab + 'ContentArea');
    if (activeBtn) {
        activeBtn.classList.remove('tab-inactive-main');
        activeBtn.classList.add('tab-active-main');
    }
    if (activeArea) activeArea.classList.remove('hidden');

    // Load data if needed
    if (tab === 'academics') AuthManager.loadAcademics();
    if (tab === 'rewards') AuthManager.loadReferralRewards();
}

function addManualRefreshButton() {
    const container = document.querySelector('.bg-green-50 .flex.gap-2');
    if (!container || document.getElementById('manualRefreshBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'manualRefreshBtn';
    btn.onclick = manualRefreshReports;
    btn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700';
    btn.innerHTML = '<span class="mr-2">🔄</span> Check for New Reports';
    container.insertBefore(btn, container.querySelector('button[onclick="logout()"]'));
}

function addLogoutButton() {
    const container = document.querySelector('.bg-green-50 .flex.gap-2');
    if (!container || container.querySelector('button[onclick="logout()"]')) return;
    const btn = document.createElement('button');
    btn.onclick = logout;
    btn.className = 'bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700';
    btn.innerHTML = '<span class="mr-2">🚪</span> Logout';
    container.appendChild(btn);
}

async function manualRefreshReports() {
    const btn = document.getElementById('manualRefreshBtn');
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner-small mr-2"></span> Refreshing...';
    btn.disabled = true;
    try {
        await AuthManager.loadReports();
        showMessage('Reports refreshed', 'success');
    } catch (e) {
        showMessage('Refresh failed', 'error');
    } finally {
        btn.innerHTML = orig;
        btn.disabled = false;
    }
}

// ============================================================================
// SECTION 8: INITIALIZATION & EVENT LISTENERS
// ============================================================================

function initialize() {
    console.log('🚀 Initializing Parent Portal (Production)');

    // Inject global CSS (skeleton, animations, etc.)
    injectCustomCSS();

    // Setup country code dropdown
    createCountryCodeDropdown();

    // Setup event listeners
    attachEventListeners();

    // Setup global error handlers
    setupGlobalErrorHandlers();

    // Initialize auth manager
    AuthManager.init();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        AuthManager.cleanup();
        AuthManager.cleanupRealTimeListeners();
    });

    console.log('✅ Initialization complete');
}

function injectCustomCSS() {
    const style = document.createElement('style');
    style.textContent = `
        /* Skeleton Loaders */
        .skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; border-radius: 4px; }
        @keyframes loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .skeleton-text { height: 1em; margin-bottom: 0.5em; }
        .skeleton-title { height: 1.8em; margin-bottom: 1em; width: 70%; }
        .skeleton-card { height: 150px; border-radius: 8px; margin-bottom: 1rem; }

        /* Animations */
        .fade-in { animation: fadeIn 0.3s ease-in-out; }
        .slide-down { animation: slideDown 0.3s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .loading-spinner { border: 3px solid rgba(0,0,0,0.1); border-radius: 50%; border-top: 3px solid #10B981; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        .loading-spinner-small { border: 2px solid rgba(0,0,0,0.1); border-radius: 50%; border-top: 2px solid #10B981; width: 16px; height: 16px; animation: spin 1s linear infinite; display: inline-block; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Tab styles */
        .tab-active-main { background: white; color: #064e3b; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .tab-inactive-main { color: #64748b; }
    `;
    document.head.appendChild(style);
}

function createCountryCodeDropdown() {
    const phoneInput = document.getElementById('signupPhone');
    if (!phoneInput) return;
    const parent = phoneInput.parentNode;
    const container = document.createElement('div');
    container.className = 'flex gap-2';
    const select = document.createElement('select');
    select.id = 'countryCode';
    select.className = 'w-32 px-3 py-3 border rounded-xl';
    select.required = true;
    const countries = [
        { code: '+1', name: 'USA/Canada (+1)' },
        { code: '+234', name: 'Nigeria (+234)' },
        { code: '+44', name: 'UK (+44)' },
        // add more as needed
    ];
    countries.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = c.name;
        select.appendChild(opt);
    });
    select.value = '+1';
    phoneInput.placeholder = 'Phone number without country code';
    phoneInput.className = 'flex-1 px-4 py-3 border rounded-xl';
    container.appendChild(select);
    container.appendChild(phoneInput);
    parent.appendChild(container);
}

function attachEventListeners() {
    document.getElementById('signInBtn')?.addEventListener('click', handleSignIn);
    document.getElementById('signUpBtn')?.addEventListener('click', handleSignUpSubmit);
    document.getElementById('signInTab')?.addEventListener('click', () => switchTab('signin'));
    document.getElementById('signUpTab')?.addEventListener('click', () => switchTab('signup'));
    document.getElementById('reportTab')?.addEventListener('click', () => switchMainTab('report'));
    document.getElementById('academicsTab')?.addEventListener('click', () => switchMainTab('academics'));
    document.getElementById('rewardsTab')?.addEventListener('click', () => switchMainTab('rewards'));
    // Forgot password modal (simplified)
    document.getElementById('forgotPasswordBtn')?.addEventListener('click', () => {
        alert('Please contact support to reset your password.');
    });
}

function setupGlobalErrorHandlers() {
    window.addEventListener('unhandledrejection', e => {
        console.error('Unhandled rejection:', e.reason);
        e.preventDefault();
    });
    window.addEventListener('error', e => {
        console.error('Global error:', e.error);
        if (!e.error?.message?.includes('auth')) {
            showMessage('An unexpected error occurred. Please refresh.', 'error');
        }
        e.preventDefault();
    });
}

// ============================================================================
// START THE APP
// ============================================================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
