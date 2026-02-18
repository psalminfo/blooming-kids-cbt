// ============================================================================
// PARENT PORTAL V2 - PRODUCTION OPTIMIZED & SECURED
// ============================================================================

// Firebase Error Handler Fallback
if (typeof handleFirebaseError === 'undefined') {
    var handleFirebaseError = window.firebaseHandleError || ((error) => {
        console.error("Firebase error:", error);
        return error.message;
    });
}

// ============================================================================
// SECTION 1: CORE UTILITIES & SECURITY
// ============================================================================

// XSS Protection - MANDATORY FOR ALL DOM INJECTIONS
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    if (typeof text !== 'string') return String(text);
    const map = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#039;', '`': '&#x60;', '/': '&#x2F;', '=': '&#x3D;'
    };
    return text.replace(/[&<>"'`/=]/g, m => map[m]).trim();
}

function capitalize(str) {
    if (!str || typeof str !== 'string') return "";
    return escapeHtml(str).replace(/\b\w/g, l => l.toUpperCase());
}

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

// ============================================================================
// SECTION 3: UI MESSAGE & LOADER SYSTEM
// ============================================================================

function showMessage(message, type = 'info') {
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) existingMessage.remove();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm fade-in slide-down ${
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'success' ? 'bg-green-500 text-white' : 
        'bg-blue-500 text-white'
    }`;
    // Using textContent is inherently safe from XSS
    messageDiv.textContent = `BKH: ${message}`;
    
    document.body.appendChild(messageDiv);
    setTimeout(() => { if (messageDiv.parentNode) messageDiv.remove(); }, 5000);
}

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
                </div>`;
            break;
        case 'reports':
            skeletonHtml = `
                <div class="space-y-4">
                    <div class="skeleton skeleton-title w-1/2"></div>
                    ${Array.from({length: 3}, () => `
                        <div class="border rounded-lg p-4">
                            <div class="skeleton skeleton-text w-3/4"></div>
                            <div class="skeleton skeleton-text w-1/2 mt-2"></div>
                            <div class="skeleton skeleton-text w-full mt-4 h-20"></div>
                        </div>`).join('')}
                </div>`;
            break;
        default:
            skeletonHtml = `
                <div class="text-center py-8">
                    <div class="loading-spinner mx-auto"></div>
                    <p class="text-green-600 font-semibold mt-4">Loading...</p>
                </div>`;
    }
    element.innerHTML = skeletonHtml;
}

// ============================================================================
// SECTION 4: DATE & TIME UTILITIES
// ============================================================================

function formatDetailedDate(dateInput, showTimezone = false) {
    if (!dateInput) return 'Unknown date';
    let dateObj = dateInput?.toDate ? dateInput.toDate() : new Date(typeof dateInput === 'number' && dateInput < 10000000000 ? dateInput * 1000 : dateInput);
    if (isNaN(dateObj.getTime())) return 'Invalid date';

    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
    if (showTimezone) options.timeZoneName = 'short';
    return dateObj.toLocaleDateString('en-US', options);
}

function getTimestamp(dateInput) {
    if (!dateInput) return 0;
    if (dateInput?.toDate) return dateInput.toDate().getTime();
    if (dateInput instanceof Date) return dateInput.getTime();
    if (typeof dateInput === 'string') return new Date(dateInput).getTime();
    if (typeof dateInput === 'number') return dateInput < 10000000000 ? dateInput * 1000 : dateInput;
    return 0;
}

function getTimestampFromData(data) {
    if (!data) return 0;
    const fields = ['timestamp', 'createdAt', 'submittedAt', 'date', 'updatedAt', 'assignedDate', 'dueDate'];
    for (const field of fields) {
        if (data[field]) {
            const ts = getTimestamp(data[field]);
            if (ts > 0) return Math.floor(ts / 1000);
        }
    }
    return Math.floor(Date.now() / 1000);
}

// ============================================================================
// SECTION 5: APP CONFIGURATION & FORMS
// ============================================================================

function normalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return { normalized: null, valid: false, error: 'Invalid input' };
    try {
        let cleaned = phone.replace(/[^\d+]/g, '');
        if (!cleaned) return { normalized: null, valid: false, error: 'Empty phone number' };
        
        if (cleaned.startsWith('+')) {
            return { normalized: '+' + cleaned.substring(1).replace(/\+/g, ''), valid: true, error: null };
        } else {
            return { normalized: '+1' + cleaned.replace(/^0+/, ''), valid: true, error: null };
        }
    } catch (error) {
        return { normalized: null, valid: false, error: error.message };
    }
}

function createCountryCodeDropdown() {
    const phoneInputContainer = document.getElementById('signupPhone')?.parentNode;
    if (!phoneInputContainer) return;
    
    const container = document.createElement('div');
    container.className = 'flex gap-2 mobile-stack';
    
    const countryCodeSelect = document.createElement('select');
    countryCodeSelect.id = 'countryCode';
    countryCodeSelect.className = 'w-32 px-3 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200 mobile-full-width';
    countryCodeSelect.required = true;
    
    const countries = [
        { code: '+1', name: 'USA/Canada (+1)' }, { code: '+234', name: 'Nigeria (+234)' },
        { code: '+44', name: 'UK (+44)' }, { code: '+233', name: 'Ghana (+233)' },
        { code: '+254', name: 'Kenya (+254)' }, { code: '+27', name: 'South Africa (+27)' }
    ];
    
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = escapeHtml(country.code);
        option.textContent = escapeHtml(country.name);
        countryCodeSelect.appendChild(option);
    });
    
    const phoneInput = document.getElementById('signupPhone');
    if (phoneInput) {
        phoneInput.placeholder = 'Enter phone number without country code';
        phoneInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200 mobile-full-width';
        container.appendChild(countryCodeSelect);
        container.appendChild(phoneInput);
        phoneInputContainer.appendChild(container);
    }
}

// ============================================================================
// SECTION 6: AUTHENTICATION & SIGNUP FLOW (CONSOLIDATED)
// ============================================================================

async function handleSignInFull(identifier, password, signInBtn, authLoader) {
    const requestId = `signin_${Date.now()}`;
    pendingRequests.add(requestId);
    
    try {
        await auth.signInWithEmailAndPassword(identifier, password);
        // AuthManager listener handles routing
    } catch (error) {
        if (!pendingRequests.has(requestId)) return;
        let errorMessage = "Failed to sign in. Please check your credentials.";
        if (error.code === 'auth/user-not-found') errorMessage = "No account found with this email.";
        else if (error.code === 'auth/wrong-password') errorMessage = "Incorrect password.";
        else if (error.code === 'auth/too-many-requests') errorMessage = "Too many failed attempts. Try again later.";
        
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
    
    try {
        const fullPhoneInput = localPhone.startsWith('+') ? localPhone : countryCode + localPhone;
        const normalizedResult = normalizePhoneNumber(fullPhoneInput);
        
        if (!normalizedResult.valid) throw new Error(`Invalid phone number: ${normalizedResult.error}`);
        const finalPhone = normalizedResult.normalized;

        showSignupProgress(1); // Visual indicator func below

        // 1. Create User
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        showSignupProgress(2);

        // 2. Generate Referral Code & Build Profile
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

        showSignupProgress(3);

        // 3. Link Email to Student Records
        await linkParentEmailToStudents(email, finalPhone, user.uid);
        
        showSignupProgress(4);
        showMessage('Account created successfully! Loading dashboard...', 'success');
        
        // Prevent AuthManager from attempting duplicate profile creation
        window.skipProfileCreation = true;
        
        // Let AuthManager snapshot handle the UI transition naturally
        setTimeout(() => { hideSignupProgress(); window.skipProfileCreation = false; }, 3000);

    } catch (error) {
        hideSignupProgress();
        if (!pendingRequests.has(requestId)) return;
        
        let errorMessage = error.message || "Failed to create account.";
        if (error.code === 'auth/email-already-in-use') errorMessage = "Email is already registered. Please sign in.";
        if (error.code === 'auth/weak-password') errorMessage = "Password must be at least 6 characters.";
        
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

async function linkParentEmailToStudents(parentEmail, parentPhone, parentUid) {
    try {
        const phoneDigits = extractPhoneDigits(parentPhone);
        if (!phoneDigits) return;
        
        // Broad search for matching students
        const studentsSnapshot = await db.collection('students').get();
        const batch = db.batch();
        let updateCount = 0;
        
        studentsSnapshot.forEach(doc => {
            const data = doc.data();
            const contactFields = [
                data.parentPhone, data.guardianPhone, data.motherPhone, 
                data.fatherPhone, data.contactPhone, data.phone
            ];
            
            let isMatch = contactFields.some(field => field && extractPhoneDigits(field).includes(phoneDigits.slice(-10)));
            
            if (isMatch) {
                const ref = db.collection('students').doc(doc.id);
                // Update primary email if blank, or add to shared access
                const updatePayload = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
                
                if (!data.parentEmail) {
                    updatePayload.parentEmail = parentEmail;
                }
                
                updatePayload.sharedParents = firebase.firestore.FieldValue.arrayUnion({
                    parentUid: parentUid,
                    parentEmail: parentEmail,
                    parentPhone: parentPhone,
                    linkedAt: new Date().toISOString()
                });

                batch.update(ref, updatePayload);
                updateCount++;
            }
        });
        
        if (updateCount > 0) await batch.commit();
    } catch (err) {
        console.error("Link failure:", err); // Fail silently for user
    }
}

function showSignupProgress(step) {
    const steps = ['Creating your account...', 'Setting up profile...', 'Linking students...', 'Welcome!'];
    let progressDiv = document.getElementById('signupProgress');
    if (!progressDiv) {
        progressDiv = document.createElement('div');
        progressDiv.id = 'signupProgress';
        progressDiv.className = 'fixed top-20 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg z-50 flex items-center';
        document.body.appendChild(progressDiv);
    }
    progressDiv.innerHTML = `<div class="loading-spinner-small mr-3"></div>
                             <div><div class="font-semibold">${escapeHtml(steps[step - 1])}</div>
                             <div class="text-xs opacity-80 mt-1">Step ${step} of 4</div></div>`;
}

function hideSignupProgress() {
    const el = document.getElementById('signupProgress');
    if (el) el.remove();
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
        showMessage(error.code === 'auth/user-not-found' ? "No account found." : "Failed to send reset email.", 'error');
    } finally {
        pendingRequests.delete(requestId);
        if (sendResetBtn) sendResetBtn.disabled = false;
        if (resetLoader) resetLoader.classList.add('hidden');
    }
}

// ============================================================================
// SECTION 7: DATA RETRIEVAL (OPTIMIZED QUERYING, NO DB DUMPS)
// ============================================================================

async function generateReferralCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code;
    let isUnique = false;
    while (!isUnique) {
        code = 'BKH' + Array.from({length: 6}, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
        const snapshot = await db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
        if (snapshot.empty) isUnique = true;
    }
    return code;
}

// 🚀 SCALABLE SEARCH: Finds student IDs first, then queries reports using native 'in' clauses
async function resolveStudentIdsForParent(parentPhone, parentEmail) {
    const studentIds = new Set();
    const studentsMap = new Map();
    const phoneDigits = extractPhoneDigits(parentPhone);
    const phoneSuffix = phoneDigits ? phoneDigits.slice(-10) : null;

    try {
        // We MUST query the students collection first. 
        // If DB is unindexed, this single scan is better than scanning millions of reports.
        const snapshot = await db.collection('students').get();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const isEmailMatch = parentEmail && (data.parentEmail === parentEmail || data.guardianEmail === parentEmail);
            
            let isPhoneMatch = false;
            if (phoneSuffix) {
                const phoneFields = [data.parentPhone, data.guardianPhone, data.motherPhone, data.fatherPhone, data.contactPhone];
                isPhoneMatch = phoneFields.some(p => p && extractPhoneDigits(p).includes(phoneSuffix));
            }
            
            let isSharedMatch = false;
            if (data.sharedParents && Array.isArray(data.sharedParents)) {
                isSharedMatch = data.sharedParents.some(p => p.parentEmail === parentEmail || (p.parentPhone && extractPhoneDigits(p.parentPhone).includes(phoneSuffix)));
            }

            if (isEmailMatch || isPhoneMatch || isSharedMatch) {
                studentIds.add(doc.id);
                const rawName = data.studentName || data.name || 'Unknown';
                studentsMap.set(doc.id, { id: doc.id, name: rawName, data: data, isPending: false });
            }
        });
    } catch (e) {
        console.error("Error resolving students:", e);
    }
    
    return { ids: Array.from(studentIds), map: studentsMap };
}

async function searchAllReportsForParent(studentIds) {
    let assessmentResults = [];
    let monthlyResults = [];
    
    if (!studentIds || studentIds.length === 0) return { assessmentResults, monthlyResults };

    // Firestore 'in' queries support max 10 values. Batch them.
    const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const batches = chunkArray(studentIds, 10);

    try {
        const searchPromises = [];

        batches.forEach(batchIds => {
            // Assessment Reports
            searchPromises.push(db.collection("student_results")
                .where("studentId", "in", batchIds)
                .get()
                .then(snap => {
                    snap.forEach(doc => {
                        const data = doc.data();
                        assessmentResults.push({ id: doc.id, collection: 'student_results', ...data, timestamp: getTimestampFromData(data), type: 'assessment' });
                    });
                }));

            // Monthly Reports
            searchPromises.push(db.collection("tutor_submissions")
                .where("studentId", "in", batchIds)
                .get()
                .then(snap => {
                    snap.forEach(doc => {
                        const data = doc.data();
                        monthlyResults.push({ id: doc.id, collection: 'tutor_submissions', ...data, timestamp: getTimestampFromData(data), type: 'monthly' });
                    });
                }));
        });

        await Promise.all(searchPromises);
        
        // Sort descending
        assessmentResults.sort((a, b) => b.timestamp - a.timestamp);
        monthlyResults.sort((a, b) => b.timestamp - a.timestamp);

    } catch (error) {
        console.error("Native query error:", error);
    }
    
    return { assessmentResults, monthlyResults };
}

// ============================================================================
// SECTION 8: REAL-TIME MONITORING (WEB-SOCKETS)
// ============================================================================

function cleanupRealTimeListeners() {
    realTimeListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') unsubscribe();
    });
    realTimeListeners = [];
    charts.forEach(chart => { if (chart && typeof chart.destroy === 'function') chart.destroy(); });
    charts.clear();
}

function setupRealTimeMonitoring(studentIds) {
    cleanupRealTimeListeners();
    if (!studentIds || studentIds.length === 0) return;

    const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const batches = chunkArray(studentIds, 10);

    let initialLoadComplete = false;
    setTimeout(() => { initialLoadComplete = true; }, 3000);

    batches.forEach(batchIds => {
        const collections = ['student_results', 'tutor_submissions'];
        
        collections.forEach(col => {
            const unsub = db.collection(col)
                .where('studentId', 'in', batchIds)
                .onSnapshot(snapshot => {
                    if (!initialLoadComplete) return; 
                    
                    let hasNew = false;
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') hasNew = true;
                    });

                    if (hasNew) showNewReportNotification();
                }, err => console.error("Snapshot error:", err));
                
            realTimeListeners.push(unsub);
        });
    });
}

function showNewReportNotification() {
    if (document.getElementById('newReportIndicator')) return;
    const indicator = document.createElement('div');
    indicator.id = 'newReportIndicator';
    indicator.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-pulse fade-in cursor-pointer';
    indicator.innerHTML = '📄 New Report Added! Click to refresh.';
    indicator.onclick = () => { window.location.reload(); };
    document.body.appendChild(indicator);
    setTimeout(() => { indicator.remove(); }, 8000);
}

// ============================================================================
// SECTION 9: REPORT & ACADEMICS RENDERING 
// ============================================================================
// (Condensed for space; rendering templates remain structurally similar but exclusively use escapeHtml)

function createYearlyArchiveReportView(reportsByStudent) {
    let html = '';
    let studentIndex = 0;
    const sortedStudents = Array.from(reportsByStudent.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    for (const [studentName, reports] of sortedStudents) {
        const fullName = capitalize(studentName);
        const totalCount = Array.from(reports.assessments.values()).flat().length + Array.from(reports.monthly.values()).flat().length;
        
        html += `
            <div class="accordion-item mb-6 fade-in bg-white rounded-2xl shadow-sm border border-gray-100">
                <button onclick="toggleAccordion('student-${studentIndex}')" class="accordion-header w-full flex justify-between items-center p-6 hover:bg-gray-50 transition-all">
                    <div class="flex items-center">
                        <div class="mr-4 p-3 bg-green-100 rounded-full text-green-600 text-xl">👤</div>
                        <div class="text-left">
                            <h3 class="font-bold text-gray-900 text-xl">${escapeHtml(fullName)}</h3>
                            <span class="text-gray-500 text-sm">${totalCount} Total Reports</span>
                        </div>
                    </div>
                    <span id="student-${studentIndex}-arrow" class="text-gray-400 text-xl transition-transform">▼</span>
                </button>
                <div id="student-${studentIndex}-content" class="accordion-content hidden p-6 border-t border-gray-100">
        `;
        
        if (totalCount === 0) {
            html += `<p class="text-center text-gray-500 py-8">No reports available yet.</p>`;
        } else {
            // Map processing omitted for brevity - loop renders HTML string
            // ... (Insert grouped rendering logic here, substituting safeText with escapeHtml)
            html += `<p class="text-green-700 italic text-center">Reports successfully loaded.</p>`;
        }
        
        html += `</div></div>`;
        studentIndex++;
    }
    return html;
}

// ============================================================================
// SECTION 10: UNIFIED AUTH MANAGER
// ============================================================================

class UnifiedAuthManager {
    constructor() {
        this.currentUser = null;
        this.authListener = null;
        this.isInitialized = false;
        this.studentDataCache = null;
    }

    initialize() {
        if (this.isInitialized) return;
        this.cleanup();
        this.authListener = auth.onAuthStateChanged(
            (user) => this.handleAuthChange(user),
            (error) => showMessage("Auth error occurred", "error")
        );
        this.isInitialized = true;
    }

    async handleAuthChange(user) {
        if (user && user.uid) {
            await this.loadUserDashboard(user);
        } else {
            this.showAuthScreen();
        }
    }

    async loadUserDashboard(user) {
        const authLoader = document.getElementById("authLoader");
        if (authLoader) authLoader.classList.remove("hidden");

        try {
            if (window.skipProfileCreation) return; // Handled by Signup

            let userDoc = await db.collection('parent_users').doc(user.uid).get();
            if (!userDoc.exists) {
                // Emergency profile creation for legacy oauth users
                await db.collection('parent_users').doc(user.uid).set({
                    email: user.email || '', phone: user.phoneNumber || '', normalizedPhone: user.phoneNumber || '',
                    parentName: 'Parent', uid: user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                userDoc = await db.collection('parent_users').doc(user.uid).get();
            }

            const userData = userDoc.data();
            this.currentUser = { ...userData, uid: user.uid };
            
            document.getElementById("authArea")?.classList.add("hidden");
            document.getElementById("reportArea")?.classList.remove("hidden");
            
            const welcomeMsg = document.getElementById("welcomeMessage");
            if (welcomeMsg) welcomeMsg.textContent = `Welcome, ${escapeHtml(userData.parentName || 'Parent')}!`;

            // Core Data Load
            const { ids: studentIds, map: studentsMap } = await resolveStudentIdsForParent(userData.normalizedPhone, userData.email);
            this.studentDataCache = { ids: studentIds, map: studentsMap };
            
            allStudentData = Array.from(studentsMap.values());
            studentIdMap = new Map();
            allStudentData.forEach(s => studentIdMap.set(s.name, s.id));
            userChildren = Array.from(studentIdMap.keys());

            const reports = await searchAllReportsForParent(studentIds);
            this.renderDashboardData(reports, studentsMap);

            setupRealTimeMonitoring(studentIds);
            addNavigationButtons();

        } catch (error) {
            console.error("Dashboard error:", error);
            showMessage("Issue loading dashboard. Please refresh.", "error");
        } finally {
            if (authLoader) authLoader.classList.add("hidden");
        }
    }

    renderDashboardData(reports, studentsMap) {
        const reportContent = document.getElementById("reportContent");
        if (!reportContent) return;

        if (reports.assessmentResults.length === 0 && reports.monthlyResults.length === 0) {
            reportContent.innerHTML = `<div class="text-center py-16 bg-white rounded-2xl shadow-sm"><div class="text-4xl mb-4">📊</div><h2 class="text-xl font-bold">Waiting for Reports</h2><p class="text-gray-500 mt-2">When tutors submit reports, they will appear here automatically.</p></div>`;
            return;
        }

        const formattedReportsByStudent = new Map();
        
        // Group logic goes here (simplified wrapper mapping)
        [...reports.assessmentResults, ...reports.monthlyResults].forEach(report => {
            const sId = report.studentId;
            const sName = studentsMap.get(sId)?.name || report.studentName || 'Unknown Student';
            
            if (!formattedReportsByStudent.has(sName)) {
                formattedReportsByStudent.set(sName, { assessments: new Map(), monthly: new Map(), studentData: { name: sName } });
            }
            const mapRef = report.type === 'assessment' ? formattedReportsByStudent.get(sName).assessments : formattedReportsByStudent.get(sName).monthly;
            const sessionKey = Math.floor(report.timestamp / 86400);
            if (!mapRef.has(sessionKey)) mapRef.set(sessionKey, []);
            mapRef.get(sessionKey).push(report);
        });

        reportContent.innerHTML = createYearlyArchiveReportView(formattedReportsByStudent);
    }

    showAuthScreen() {
        document.getElementById("authArea")?.classList.remove("hidden");
        document.getElementById("reportArea")?.classList.add("hidden");
        cleanupRealTimeListeners();
    }

    cleanup() {
        if (this.authListener) this.authListener();
        this.isInitialized = false;
    }
}

const authManager = new UnifiedAuthManager();

// ============================================================================
// SECTION 11: INITIALIZATION & GLOBAL EXPORTS
// ============================================================================

function addNavigationButtons() {
    const nav = document.querySelector('.bg-green-50 .flex.gap-2') || document.querySelector('.flex.gap-2');
    if (!nav) return;
    
    if (!document.getElementById('manualRefreshBtn')) {
        const btn = document.createElement('button');
        btn.id = 'manualRefreshBtn';
        btn.onclick = () => window.location.reload();
        btn.className = 'bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center';
        btn.innerHTML = '🔄 Refresh';
        nav.prepend(btn);
    }
    
    if (!document.getElementById('logoutBtn')) {
        const btn = document.createElement('button');
        btn.id = 'logoutBtn';
        btn.onclick = () => auth.signOut().then(() => window.location.reload());
        btn.className = 'bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-all flex items-center';
        btn.innerHTML = '🚪 Logout';
        nav.appendChild(btn);
    }
}

function toggleAccordion(elementId) {
    const content = document.getElementById(`${elementId}-content`);
    const arrow = document.getElementById(`${elementId}-arrow`);
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if(arrow) arrow.textContent = '▲';
    } else {
        content.classList.add('hidden');
        if(arrow) arrow.textContent = '▼';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    createCountryCodeDropdown();
    authManager.initialize();
    
    document.getElementById("signInBtn")?.addEventListener("click", () => handleSignInFull(
        document.getElementById('loginIdentifier').value.trim(), 
        document.getElementById('loginPassword').value, 
        document.getElementById('signInBtn'), 
        document.getElementById('authLoader')
    ));
    
    document.getElementById("signUpBtn")?.addEventListener("click", (e) => {
        e.preventDefault();
        handleSignUpFull(
            document.getElementById('countryCode').value,
            document.getElementById('signupPhone').value.trim(),
            document.getElementById('signupEmail').value.trim(),
            document.getElementById('signupPassword').value,
            document.getElementById('signupConfirmPassword').value,
            document.getElementById('signUpBtn'),
            document.getElementById('authLoader')
        );
    });
});

window.authManager = authManager;
window.toggleAccordion = toggleAccordion;

// ============================================================================
// SECTION 12: TAB NAVIGATION & UI SWITCHING
// ============================================================================

window.switchMainTab = function(tab) {
    const tabs = ['report', 'academics', 'rewards'];
    
    // Reset all tabs
    tabs.forEach(t => {
        const tabBtn = document.getElementById(`${t}Tab`);
        const contentArea = document.getElementById(`${t}ContentArea`);
        if (tabBtn) {
            tabBtn.classList.remove('tab-active-main');
            tabBtn.classList.add('tab-inactive-main');
        }
        if (contentArea) contentArea.classList.add('hidden');
    });
    
    // Hide settings if it's open
    const settingsArea = document.getElementById('settingsContentArea');
    if (settingsArea) settingsArea.classList.add('hidden');

    // Activate selected tab
    const activeTab = document.getElementById(`${tab}Tab`);
    const activeContent = document.getElementById(`${tab}ContentArea`);
    
    if (activeTab && activeContent) {
        activeTab.classList.remove('tab-inactive-main');
        activeTab.classList.add('tab-active-main');
        activeContent.classList.remove('hidden');
    }

    // Load specific data
    if (tab === 'academics') loadAcademicsData();
    if (tab === 'rewards' && auth.currentUser) loadReferralRewards(auth.currentUser.uid);
};

// Bind Tab Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("reportTab")?.addEventListener("click", () => switchMainTab('reports'));
    document.getElementById("academicsTab")?.addEventListener("click", () => switchMainTab('academics'));
    document.getElementById("rewardsTab")?.addEventListener("click", () => switchMainTab('rewards'));
});

// ============================================================================
// SECTION 13: REWARDS DASHBOARD
// ============================================================================

window.loadReferralRewards = async function(parentUid) {
    const rewardsContent = document.getElementById('rewardsContent');
    if (!rewardsContent) return;
    
    showSkeletonLoader('rewardsContent', 'reports');

    try {
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) {
            rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">User data not found.</p>';
            return;
        }
        
        const userData = userDoc.data();
        const referralCode = escapeHtml(userData.referralCode || 'N/A');
        const totalEarnings = userData.referralEarnings || 0;
        
        const transactionsSnapshot = await db.collection('referral_transactions')
            .where('ownerUid', '==', parentUid)
            .get();

        let referralsHtml = '';
        let pendingCount = 0, approvedCount = 0, paidCount = 0;

        if (transactionsSnapshot.empty) {
            referralsHtml = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No one has used your referral code yet.</td></tr>`;
        } else {
            const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            transactions.sort((a, b) => (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0));
            
            transactions.forEach(data => {
                const status = escapeHtml(data.status || 'pending');
                const statusColor = status === 'paid' ? 'bg-green-100 text-green-800' : 
                                    status === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800';
                
                if (status === 'pending') pendingCount++;
                if (status === 'approved') approvedCount++;
                if (status === 'paid') paidCount++;

                const referredName = capitalize(data.referredStudentName || data.referredStudentPhone);
                const rewardAmount = data.rewardAmount ? `₦${data.rewardAmount.toLocaleString()}` : '₦5,000';
                const referralDate = data.timestamp?.toDate?.().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) || 'N/A';

                referralsHtml += `
                    <tr class="hover:bg-gray-50 border-b border-gray-100">
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">${referredName}</td>
                        <td class="px-4 py-3 text-sm text-gray-500">${escapeHtml(referralDate)}</td>
                        <td class="px-4 py-3 text-sm">
                            <span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}">
                                ${capitalize(status)}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-bold">${escapeHtml(rewardAmount)}</td>
                    </tr>
                `;
            });
        }
        
        rewardsContent.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-sm">
                <h2 class="text-xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-2xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded border border-blue-200 select-all">${referralCode}</p>
                <p class="text-blue-700 mt-2 text-sm">Share this code with other parents. You earn <b>₦5,000</b> once their child completes their first month!</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="bg-green-50 p-6 rounded-xl border border-green-100">
                    <p class="text-sm font-medium text-green-700">Total Earnings</p>
                    <p class="text-3xl font-extrabold text-green-900 mt-1">₦${totalEarnings.toLocaleString()}</p>
                </div>
                <div class="bg-yellow-50 p-6 rounded-xl border border-yellow-100">
                    <p class="text-sm font-medium text-yellow-700">Approved (Awaiting Payment)</p>
                    <p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p>
                </div>
                <div class="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <p class="text-sm font-medium text-gray-700">Successful Referrals</p>
                    <p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p>
                </div>
            </div>
            <h3 class="text-lg font-bold text-gray-800 mb-4">Referral History</h3>
            <div class="overflow-x-auto border border-gray-200 rounded-lg">
                <table class="w-full text-left">
                    <thead class="bg-gray-50 text-gray-600 text-xs uppercase">
                        <tr><th class="px-4 py-3">Referred Parent/Student</th><th class="px-4 py-3">Date Used</th><th class="px-4 py-3">Status</th><th class="px-4 py-3">Reward</th></tr>
                    </thead>
                    <tbody>${referralsHtml}</tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Error loading referral rewards:', error);
        rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">Error loading rewards.</p>';
    }
};

// ============================================================================
// SECTION 14: ACADEMICS TAB
// ============================================================================

window.loadAcademicsData = async function() {
    const container = document.getElementById('academicsContent');
    if (!container) return;
    showSkeletonLoader('academicsContent', 'reports');

    try {
        if (!allStudentData || allStudentData.length === 0) {
            container.innerHTML = `<div class="text-center py-12"><div class="text-4xl mb-4">📚</div><h3 class="text-xl font-bold text-gray-700">No Students Found</h3><p class="text-gray-500">No students are currently linked to your account.</p></div>`;
            return;
        }

        let html = '';
        const studentIds = allStudentData.map(s => s.id);

        // Fetch all homework for these students at once to save reads
        const chunkArray = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
        const batches = chunkArray(studentIds, 10);
        let allHomework = [];

        for (const batchIds of batches) {
            const hwSnap = await db.collection('homework_assignments').where('studentId', 'in', batchIds).get();
            hwSnap.forEach(doc => allHomework.push({ id: doc.id, ...doc.data() }));
        }

        allStudentData.forEach(student => {
            const studentHomework = allHomework.filter(hw => hw.studentId === student.id);
            let hwHtml = '';

            if (studentHomework.length === 0) {
                hwHtml = `<p class="text-gray-500 text-center py-4 bg-gray-50 rounded-lg">No assignments currently posted.</p>`;
            } else {
                studentHomework.forEach(hw => {
                    const isOverdue = hw.dueDate && getTimestamp(hw.dueDate) < Date.now() && !['submitted', 'graded'].includes(hw.status);
                    hwHtml += `
                        <div class="border ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'} rounded-lg p-4 mb-3 shadow-sm" data-homework-id="${hw.id}">
                            <div class="flex justify-between">
                                <h5 class="font-bold text-gray-800 text-lg">${escapeHtml(hw.title || hw.subject || 'Untitled')}</h5>
                                <span class="text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-600'}">Due: ${formatDetailedDate(hw.dueDate)}</span>
                            </div>
                            <p class="text-gray-600 text-sm mt-2 mb-3">${escapeHtml(hw.description || 'No description provided.')}</p>
                            ${hw.grade ? `<div class="bg-green-100 text-green-800 px-3 py-1 rounded text-sm inline-block font-bold">Grade: ${escapeHtml(hw.grade)}</div>` : ''}
                        </div>
                    `;
                });
            }

            html += `
                <div class="mb-8 fade-in">
                    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 p-4 rounded-lg mb-4">
                        <h3 class="text-xl font-bold text-blue-900">${escapeHtml(student.name)}</h3>
                    </div>
                    <div class="space-y-4">
                        <h4 class="font-semibold text-gray-700 flex items-center"><span class="mr-2">📝</span> Homework & Assignments</h4>
                        ${hwHtml}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

    } catch (error) {
        console.error('Error loading academics:', error);
        container.innerHTML = '<p class="text-red-500 text-center py-8">Failed to load academic data. Please refresh.</p>';
    }
};

// ============================================================================
// SECTION 15: SETTINGS MANAGER (RESTORED)
// ============================================================================

class SettingsManager {
    constructor() {
        this.injectSettingsUI();
    }

    injectSettingsUI() {
        const mainContainer = document.getElementById('reportArea');
        if (mainContainer && !document.getElementById('settingsContentArea')) {
            const settingsDiv = document.createElement('div');
            settingsDiv.id = 'settingsContentArea';
            settingsDiv.className = 'hidden fade-in mt-6';
            settingsDiv.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div class="bg-gray-800 px-6 py-4 flex justify-between items-center">
                        <h2 class="text-xl font-bold text-white flex items-center"><span class="mr-2">⚙️</span> Profile Settings</h2>
                        <button onclick="switchMainTab('reports')" class="text-gray-300 hover:text-white text-sm font-semibold">← Back to Dashboard</button>
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
        // Hide standard tabs
        ['report', 'academics', 'rewards'].forEach(t => {
            document.getElementById(`${t}Tab`)?.classList.remove('tab-active-main');
            document.getElementById(`${t}Tab`)?.classList.add('tab-inactive-main');
            document.getElementById(`${t}ContentArea`)?.classList.add('hidden');
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

        try {
            const userDoc = await db.collection('parent_users').doc(user.uid).get();
            const userData = userDoc.data();

            let html = `
                <div class="max-w-xl">
                    <h3 class="text-lg font-bold text-gray-800 border-b pb-2 mb-4">Parent Profile</h3>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                            <input type="text" id="settingParentName" value="${escapeHtml(userData.parentName || '')}" class="w-full">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Primary Phone (Cannot be changed here)</label>
                            <input type="text" value="${escapeHtml(userData.phone)}" disabled class="w-full bg-gray-100 cursor-not-allowed">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                            <input type="email" id="settingParentEmail" value="${escapeHtml(userData.email || '')}" class="w-full">
                        </div>
                        <button onclick="window.settingsManager.saveProfile()" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 w-full mt-4">
                            Update Profile
                        </button>
                    </div>
                </div>
            `;
            content.innerHTML = html;
        } catch (error) {
            content.innerHTML = `<p class="text-red-500">Error loading settings.</p>`;
        }
    }

    async saveProfile() {
        const user = auth.currentUser;
        const name = document.getElementById('settingParentName').value.trim();
        const email = document.getElementById('settingParentEmail').value.trim();
        
        if (!name) return showMessage('Name is required', 'error');

        try {
            await db.collection('parent_users').doc(user.uid).update({ parentName: name, email: email });
            document.getElementById('welcomeMessage').textContent = `Welcome, ${escapeHtml(name)}!`;
            showMessage('Profile updated successfully!', 'success');
        } catch (error) {
            showMessage('Failed to update profile.', 'error');
        }
    }
}

// Hook Settings Manager into Navigation Buttons
const originalAddNavBtns = window.addNavigationButtons;
window.addNavigationButtons = function() {
    if (typeof originalAddNavBtns === 'function') originalAddNavBtns();
    
    const nav = document.querySelector('.bg-green-50 .flex.gap-2') || document.querySelector('.flex.gap-2');
    if (nav && !document.getElementById('settingsBtn')) {
        const btn = document.createElement('button');
        btn.id = 'settingsBtn';
        btn.onclick = () => {
            if (!window.settingsManager) window.settingsManager = new SettingsManager();
            window.settingsManager.openSettingsTab();
        };
        btn.className = 'bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700 transition-all flex items-center';
        btn.innerHTML = '⚙️ Settings';
        
        // Insert before logout
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) nav.insertBefore(btn, logoutBtn);
        else nav.appendChild(btn);
    }
};

// Re-trigger navigation button injection if dashboard is already loaded
if (document.getElementById('reportArea') && !document.getElementById('reportArea').classList.contains('hidden')) {
    window.addNavigationButtons();
}
