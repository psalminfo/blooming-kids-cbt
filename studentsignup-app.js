// studentsignup-app.js
// Production-ready Firebase authentication module + Student Dashboard

// IMPORTANT: Import Firebase modules
import { auth, db } from './firebaseConfig-studentsignupmodular.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc, 
    setDoc,
    getDoc,
    addDoc,
    orderBy,
    onSnapshot,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    updateProfile, 
    signInWithPopup, 
    GoogleAuthProvider,
    sendPasswordResetEmail,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// Security: Rate limiting variables
let failedAttempts = 0;
let lastAttemptTime = 0;
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

// ─────────────────────────────────────────────────────────────
// SECTION A: SHARED UI UTILITIES
// ─────────────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) { console.log(type + ':', message); return; }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type]||icons.info} text-xl"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => container.contains(toast) && container.removeChild(toast), 400); }, duration);
}

function safeEscape(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// Real-time clock at student's local time
function startStudentClock(elementId) {
    const key = `_sclock_${elementId}`;
    if (window[key]) clearInterval(window[key]);
    function tick() {
        const el = document.getElementById(elementId);
        if (!el) { clearInterval(window[key]); return; }
        el.textContent = new Intl.DateTimeFormat('en', {
            weekday:'short', day:'numeric', month:'short', year:'numeric',
            hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true
        }).format(new Date());
    }
    tick();
    window[key] = setInterval(tick, 1000);
}

// ─────────────────────────────────────────────────────────────
// SECTION B: AUTH FUNCTIONS (unchanged logic, cleaned up)
// ─────────────────────────────────────────────────────────────

window.checkPasswordStrength = () => {
    const password = document.getElementById('student-pass')?.value || '';
    const meter = document.getElementById('password-strength-meter');
    const strengthText = document.getElementById('strength-text');
    if (!meter) return;
    const hasLength = password.length >= 12;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    ['req-length','req-uppercase','req-lowercase','req-number','req-special'].forEach((id,i) => {
        const checks = [hasLength,hasUpper,hasLower,hasNumber,hasSpecial];
        document.getElementById(id)?.classList.toggle('valid', checks[i]);
    });
    let score = [hasLength,hasUpper,hasLower,hasNumber,hasSpecial].filter(Boolean).length;
    meter.className = `password-strength-meter strength-${score}`;
    const strengthLabels = ['Very Weak','Weak','Fair','Strong','Very Strong'];
    const strengthColors = ['text-red-600','text-orange-500','text-yellow-500','text-green-500','text-emerald-600'];
    if (strengthText) { strengthText.textContent = strengthLabels[score]; strengthText.className = `text-sm font-bold ${strengthColors[score]}`; }
    const activateBtn = document.getElementById('activate-portal-btn');
    if (activateBtn) activateBtn.disabled = !(hasLength && hasUpper && hasLower && hasNumber && hasSpecial);
};

window.togglePasswordVisibility = (inputId) => {
    const input = document.getElementById(inputId);
    const eyeIcon = document.getElementById(`eye-icon-${inputId === 'student-pass' ? 'student' : 'login'}`);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    if (eyeIcon) eyeIcon.className = input.type === 'password' ? 'far fa-eye' : 'far fa-eye-slash';
};

window.switchTab = (tab) => {
    const activateTab = document.getElementById('tab-activate');
    const loginTab = document.getElementById('tab-login');
    const activationFlow = document.getElementById('activation-flow');
    const loginFlow = document.getElementById('login-flow');
    if (tab === 'activate') {
        activateTab?.classList.add('active'); activateTab?.classList.remove('text-gray-600');
        loginTab?.classList.remove('active'); loginTab?.classList.add('text-gray-600');
        activationFlow?.classList.remove('hidden-step'); loginFlow?.classList.add('hidden-step');
        document.getElementById('step-1')?.classList.remove('hidden-step');
        document.getElementById('step-2')?.classList.add('hidden-step');
        document.getElementById('parent-email') && (document.getElementById('parent-email').value = '');
        resetRateLimiting();
    } else {
        loginTab?.classList.add('active'); loginTab?.classList.remove('text-gray-600');
        activateTab?.classList.remove('active'); activateTab?.classList.add('text-gray-600');
        loginFlow?.classList.remove('hidden-step'); activationFlow?.classList.add('hidden-step');
        const rememberedEmail = localStorage.getItem('student_email');
        if (rememberedEmail && document.getElementById('login-email')) document.getElementById('login-email').value = rememberedEmail;
        resetRateLimiting();
    }
};

window.goBackToStep1 = () => {
    document.getElementById('step-1')?.classList.remove('hidden-step');
    document.getElementById('step-2')?.classList.add('hidden-step');
};

window.showForgotPassword = () => document.getElementById('forgot-password-modal')?.classList.remove('hidden-step');
window.hideForgotPassword = () => {
    document.getElementById('forgot-password-modal')?.classList.add('hidden-step');
    const re = document.getElementById('reset-email'); if (re) re.value = '';
};

function resetRateLimiting() {
    failedAttempts = 0;
    document.getElementById('rate-limit-warning')?.classList.add('hidden');
    document.getElementById('failed-attempts-warning')?.classList.add('hidden');
}

function checkRateLimit() {
    const now = Date.now();
    if (failedAttempts >= MAX_ATTEMPTS) {
        if (now - lastAttemptTime < LOCKOUT_TIME) {
            const remaining = Math.ceil((LOCKOUT_TIME - (now - lastAttemptTime)) / 60000);
            const msg = document.getElementById('rate-limit-message');
            if (msg) msg.textContent = `Too many failed attempts. Please try again in ${remaining} minute${remaining>1?'s':''}.`;
            document.getElementById('rate-limit-warning')?.classList.remove('hidden');
            return true;
        } else { failedAttempts = 0; }
    }
    return false;
}

async function getClientIP() {
    try { const r = await fetch('https://api.ipify.org?format=json'); return (await r.json()).ip; } catch { return 'unknown'; }
}

window.findStudents = async () => {
    if (checkRateLimit()) return;
    const email = document.getElementById('parent-email')?.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email.', 'error'); return; }
    try {
        document.getElementById('find-profile-text')?.classList.add('hidden');
        document.getElementById('find-profile-loading')?.classList.remove('hidden');
        const findBtn = document.getElementById('find-profile-btn'); if (findBtn) findBtn.disabled = true;
        const qSnap = await getDocs(query(collection(db,'students'), where('parentEmail','==',email)));
        if (qSnap.empty) { showToast('No student records found for this email.','error'); failedAttempts++; lastAttemptTime=Date.now(); return; }
        const select = document.getElementById('student-select');
        select.innerHTML = '<option value="">Select your name</option>';
        let foundInactive = false;
        qSnap.forEach(d => {
            const data = d.data();
            if (!data.studentUid || data.status !== 'active') {
                const opt = document.createElement('option');
                opt.value = d.id;
                opt.textContent = data.studentName + (data.grade ? ` - Grade ${data.grade}` : '');
                select.appendChild(opt);
                foundInactive = true;
            }
        });
        if (foundInactive) {
            document.getElementById('step-1')?.classList.add('hidden-step');
            document.getElementById('step-2')?.classList.remove('hidden-step');
            showToast('Students found! Please select your name.','success');
        } else { showToast('All students already activated. Please login instead.','info'); window.switchTab('login'); }
    } catch(e) { console.error(e); showToast('An error occurred. Please try again.','error'); failedAttempts++; lastAttemptTime=Date.now(); }
    finally {
        document.getElementById('find-profile-text')?.classList.remove('hidden');
        document.getElementById('find-profile-loading')?.classList.add('hidden');
        const btn = document.getElementById('find-profile-btn'); if (btn) btn.disabled = false;
    }
};

window.completeRegistration = async () => {
    const docId    = document.getElementById('student-select')?.value;
    const email    = document.getElementById('student-email-input')?.value.trim();
    const password = document.getElementById('student-pass')?.value;
    const rememberMe = document.getElementById('remember-me-activation')?.checked;
    if (!docId) { showToast('Please select your name.','error'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email.','error'); return; }
    const hasLength=password.length>=12, hasUpper=/[A-Z]/.test(password), hasLower=/[a-z]/.test(password), hasNumber=/\d/.test(password), hasSpecial=/[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (!hasLength||!hasUpper||!hasLower||!hasNumber||!hasSpecial) { showToast('Password does not meet all requirements.','error'); return; }
    try {
        document.getElementById('activate-text')?.classList.add('hidden');
        document.getElementById('activate-loading')?.classList.remove('hidden');
        const btn = document.getElementById('activate-portal-btn'); if (btn) btn.disabled = true;
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const emailCheck = await getDocs(query(collection(db,'students'), where('studentEmail','==',email)));
        if (!emailCheck.empty) { showToast('Email already registered. Please login.','error'); return; }
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        const studentName = document.getElementById('student-select')?.options[document.getElementById('student-select').selectedIndex]?.text.split(' - ')[0] || 'Student';
        await updateDoc(doc(db,'students',docId), { studentUid: userCred.user.uid, studentEmail: email, status:'active', activatedAt: serverTimestamp(), lastLogin: serverTimestamp(), security: { passwordChangedAt: serverTimestamp(), mfaEnabled: false } });
        await setDoc(doc(collection(db,'audit_logs')), { action:'student_activation', studentId:docId, studentName, email, timestamp:serverTimestamp(), userAgent:navigator.userAgent, ip: await getClientIP() });
        await updateProfile(userCred.user, { displayName: studentName });
        if (rememberMe) { localStorage.setItem('student_remember_me','true'); localStorage.setItem('student_email',email); }
        showToast('Account activated! Redirecting…','success');
        setTimeout(() => { window.location.href = 'BKHstudentlogin.html'; }, 2000);
    } catch(e) {
        console.error(e);
        if (e.code==='auth/email-already-in-use') { showToast('Email already registered. Please login.','error'); window.switchTab('login'); }
        else showToast('Registration failed: '+e.message,'error');
    } finally {
        document.getElementById('activate-text')?.classList.remove('hidden');
        document.getElementById('activate-loading')?.classList.add('hidden');
        const btn = document.getElementById('activate-portal-btn'); if (btn) btn.disabled = false;
    }
};

window.loginStudent = async () => {
    if (checkRateLimit()) return;
    const email    = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const rememberMe = document.getElementById('remember-me-login')?.checked;
    if (!email || !password) { showToast('Please enter email and password.','error'); return; }
    try {
        document.getElementById('login-text')?.classList.add('hidden');
        document.getElementById('login-loading')?.classList.remove('hidden');
        const btn = document.getElementById('login-portal-btn'); if (btn) btn.disabled = true;
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const qSnap = await getDocs(query(collection(db,'students'), where('studentUid','==',userCred.user.uid)));
        if (qSnap.empty) { await signOut(auth); showToast('Student account not found.','error'); failedAttempts++; lastAttemptTime=Date.now(); return; }
        const studentDoc = qSnap.docs[0];
        await updateDoc(doc(db,'students',studentDoc.id), { lastLogin: serverTimestamp(), failedAttempts: 0 });
        await setDoc(doc(collection(db,'audit_logs')), { action:'student_login', studentId:studentDoc.id, studentName:studentDoc.data().studentName, timestamp:serverTimestamp(), userAgent:navigator.userAgent, rememberMe, ip: await getClientIP() });
        if (rememberMe) { localStorage.setItem('student_remember_me','true'); localStorage.setItem('student_email',email); }
        showToast('Login successful! Redirecting…','success');
        setTimeout(() => { window.location.href = 'BKHstudentlogin.html'; }, 1500);
    } catch(e) {
        console.error(e); failedAttempts++; lastAttemptTime=Date.now();
        const errMessages = { 'auth/user-not-found':'No account found with this email.', 'auth/wrong-password':'Incorrect password.', 'auth/too-many-requests':'Too many attempts. Please try later.', 'auth/invalid-email':'Invalid email format.' };
        showToast(errMessages[e.code] || 'Login failed: '+e.message, 'error');
        if (failedAttempts>=3) document.getElementById('failed-attempts-warning')?.classList.remove('hidden');
    } finally {
        document.getElementById('login-text')?.classList.remove('hidden');
        document.getElementById('login-loading')?.classList.add('hidden');
        const btn = document.getElementById('login-portal-btn'); if (btn) btn.disabled = false;
    }
};

window.signInWithGoogle = async () => {
    try {
        const provider = new GoogleAuthProvider();
        provider.addScope('email'); provider.addScope('profile');
        provider.setCustomParameters({ prompt:'select_account' });
        const rememberMe = document.getElementById('remember-me-login')?.checked;
        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        let qSnap = await getDocs(query(collection(db,'students'), where('studentUid','==',user.uid)));
        if (!qSnap.empty) { await updateDoc(doc(db,'students',qSnap.docs[0].id), { lastLogin: serverTimestamp() }); window.location.href='BKHstudentlogin.html'; return; }
        const emailSnap = await getDocs(query(collection(db,'students'), where('studentEmail','==',user.email)));
        if (!emailSnap.empty) { await updateDoc(doc(db,'students',emailSnap.docs[0].id), { studentUid: user.uid, lastLogin: serverTimestamp() }); window.location.href='BKHstudentlogin.html'; return; }
        await signOut(auth); showToast('No student account found for this Google account.','error');
    } catch(e) {
        console.error(e);
        const msgs = { 'auth/unauthorized-domain':'Google sign-in not configured for this domain.', 'auth/popup-blocked':'Popup blocked. Please allow popups.', 'auth/popup-closed-by-user':'Sign-in cancelled.' };
        showToast(msgs[e.code] || 'Google sign-in failed: '+e.message, e.code==='auth/popup-closed-by-user'?'info':'error');
    }
};

window.signInWithGoogleForActivation = async () => {
    try {
        const provider = new GoogleAuthProvider();
        provider.addScope('email'); provider.addScope('profile');
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const qSnap = await getDocs(query(collection(db,'students'), where('studentUid','==',user.uid)));
        if (!qSnap.empty) { showToast('Account already activated. Please login.','info'); window.switchTab('login'); await signOut(auth); return; }
        const emailEl = document.getElementById('student-email-input'); if (emailEl) emailEl.value = user.email;
        document.getElementById('step-1')?.classList.add('hidden-step');
        document.getElementById('step-2')?.classList.remove('hidden-step');
        showToast('Google account linked. Select your name and create a password.','success');
    } catch(e) {
        console.error(e);
        showToast(e.code==='auth/popup-closed-by-user'?'Sign-in cancelled.':'Google sign-in failed: '+e.message, 'error');
    }
};

window.sendPasswordReset = async () => {
    const email = document.getElementById('reset-email')?.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Please enter a valid email.','error'); return; }
    try {
        document.getElementById('reset-text')?.classList.add('hidden');
        document.getElementById('reset-loading')?.classList.remove('hidden');
        const btn = document.getElementById('send-reset-btn'); if (btn) btn.disabled = true;
        const emailSnap = await getDocs(query(collection(db,'students'), where('studentEmail','==',email)));
        if (emailSnap.empty) { showToast('No student account found with this email.','error'); return; }
        await sendPasswordResetEmail(auth, email, { url: window.location.origin+'/studentsignup.html', handleCodeInApp: false });
        await setDoc(doc(collection(db,'audit_logs')), { action:'password_reset_requested', email, timestamp:serverTimestamp(), userAgent:navigator.userAgent, ip: await getClientIP() });
        showToast('Password reset link sent! Check your email.','success');
        setTimeout(() => window.hideForgotPassword(), 2000);
    } catch(e) {
        console.error(e);
        showToast(e.code==='auth/too-many-requests'?'Too many attempts. Try later.':'Failed to send reset email: '+e.message,'error');
    } finally {
        document.getElementById('reset-text')?.classList.remove('hidden');
        document.getElementById('reset-loading')?.classList.add('hidden');
        const btn = document.getElementById('send-reset-btn'); if (btn) btn.disabled = false;
    }
};

// ─────────────────────────────────────────────────────────────
// SECTION C: STUDENT DASHBOARD
// Activated when the user is logged in on the dashboard page.
// Call initStudentDashboard() from your HTML page after DOMContentLoaded.
// ─────────────────────────────────────────────────────────────

let studentData = null;        // The student Firestore doc
let unsubMessages = null;      // Real-time message listener

window.initStudentDashboard = async function() {
    onAuthStateChanged(auth, async user => {
        if (!user) { window.location.href = 'studentsignup.html'; return; }

        // Load student doc
        const qSnap = await getDocs(query(collection(db,'students'), where('studentUid','==',user.uid)));
        if (qSnap.empty) { alert('Student record not found.'); await signOut(auth); window.location.href='studentsignup.html'; return; }

        studentData = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
        window.studentData = studentData;

        // Update last login
        await updateDoc(doc(db,'students',studentData.id), { lastLogin: serverTimestamp() });

        // Render dashboard shell
        renderDashboardShell(studentData);

        // Start student local clock
        startStudentClock('student-local-clock');

        // Load all data
        loadDashboardData(studentData);
        setupNotifications(studentData);
        setupMessagingTab(studentData);
    });
};

// ── Dashboard Shell ──
function renderDashboardShell(student) {
    // Update name in header
    document.querySelectorAll('.student-name-placeholder').forEach(el => el.textContent = student.studentName || 'Student');
    document.querySelectorAll('.student-grade-placeholder').forEach(el => el.textContent = student.grade || '');

    // Set up logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await signOut(auth); window.location.href = 'studentsignup.html';
    });

    // Tab navigation
    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchDashboardTab(btn.dataset.tab, student));
    });

    // Default tab
    switchDashboardTab('overview', student);
}

function switchDashboardTab(tab, student) {
    document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.student-tab-panel').forEach(p => p.classList.add('hidden'));
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById(`tab-${tab}`)?.classList.remove('hidden');

    // Lazy-load content for specific tabs
    switch(tab) {
        case 'assignments': loadAssignmentsTab(student); break;
        case 'courses':     loadCoursesTab(student);     break;
        case 'results':     loadResultsTab(student);     break;
        case 'schedule':    loadScheduleTab(student);    break;
        case 'games':       loadGamesTab(student);       break;
        case 'messaging':   loadMessagingTab(student);   break;
    }
}

// ── Load all overview/dashboard data ──
async function loadDashboardData(student) {
    await Promise.allSettled([
        loadNextClassCard(student),
        loadAverageGradeCard(student),
        loadCoursesSummary(student),
        loadUpcomingScheduleCard(student)
    ]);
}

// ── Next Live Class Card ──
async function loadNextClassCard(student) {
    const el = document.getElementById('next-class-card');
    if (!el) return;
    el.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">Loading…</div>';

    try {
        // Get schedule from student doc (stored in Nigeria time = WAT = UTC+1)
        const schedule = student.schedule || [];
        if (!schedule.length) {
            el.innerHTML = '<p class="text-gray-400 text-sm text-center">No schedule set yet.</p>';
            return;
        }

        const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const now = new Date();
        const nowWAT = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
        const todayIndex = nowWAT.getDay();
        const nowMinutes = nowWAT.getHours()*60 + nowWAT.getMinutes();

        let nextSlot = null;
        let daysAhead = 0;

        // Look through the next 7 days for the next class
        for (let d = 0; d < 7 && !nextSlot; d++) {
            const targetDayIndex = (todayIndex + d) % 7;
            const targetDay = DAYS[targetDayIndex];
            const daySlots = schedule
                .filter(s => s.day === targetDay)
                .sort((a,b) => (a.start||'').localeCompare(b.start||''));

            for (const slot of daySlots) {
                const [sh,sm] = (slot.start||'00:00').split(':').map(Number);
                const slotMins = sh*60 + sm;
                if (d > 0 || slotMins > nowMinutes) {
                    nextSlot = { ...slot, targetDay, daysAhead: d };
                    daysAhead = d;
                    break;
                }
            }
        }

        if (!nextSlot) {
            el.innerHTML = '<p class="text-gray-400 text-sm text-center">No upcoming classes found.</p>';
            return;
        }

        // Convert Nigeria time to student's local time
        const [sh,sm] = (nextSlot.start||'00:00').split(':').map(Number);
        const [eh,em] = (nextSlot.end||'00:00').split(':').map(Number);

        // Build a Date in Nigeria's timezone
        const targetDate = new Date(nowWAT);
        targetDate.setDate(targetDate.getDate() + daysAhead);
        targetDate.setHours(sh, sm, 0, 0);

        const localStart = new Date(targetDate.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
        // Adjust to local time by re-interpreting
        const offsetDiff = (new Date().getTimezoneOffset() - (-60)) * 60000; // WAT is UTC+1 → -60 min offset
        const localStartStr = new Intl.DateTimeFormat('en', { hour:'2-digit', minute:'2-digit', hour12:true }).format(targetDate);

        const dayLabel = daysAhead === 0 ? 'Today' : daysAhead === 1 ? 'Tomorrow' : nextSlot.targetDay;

        el.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-2xl flex-shrink-0">📅</div>
                <div class="flex-1">
                    <p class="text-xs text-gray-400 uppercase font-semibold mb-1">Next Class</p>
                    <p class="font-bold text-gray-800 text-lg">${safeEscape(dayLabel)}</p>
                    <p class="text-blue-600 font-semibold text-sm">${safeEscape(localStart)} (Nigeria Time)</p>
                </div>
            </div>
            <div class="mt-3 text-xs text-gray-400 bg-gray-50 rounded-lg p-2">
                📍 Your local time may differ. The time shown is Nigeria (WAT) time.
            </div>`;
    } catch(e) {
        console.error('loadNextClassCard:', e);
        el.innerHTML = '<p class="text-red-400 text-sm text-center">Could not load class info.</p>';
    }
}

// ── Average Grade Card ──
async function loadAverageGradeCard(student) {
    const el = document.getElementById('avg-grade-card');
    if (!el) return;
    el.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">Loading…</div>';

    try {
        // Get graded homework for this student
        const hwSnap = await getDocs(query(
            collection(db,'homework_assignments'),
            where('studentId','==',student.id),
            where('status','==','graded')
        ));
        const myScores = hwSnap.docs.map(d => parseFloat(d.data().score)).filter(s => !isNaN(s));
        const myAvg = myScores.length ? Math.round(myScores.reduce((a,b)=>a+b,0)/myScores.length) : null;

        // Compare with same-grade students
        let gradeAvg = null;
        if (student.grade) {
            const gradeSnap = await getDocs(query(
                collection(db,'homework_assignments'),
                where('status','==','graded')
            ));
            // Filter by grade - we need to match the grade from the student's record
            const gradeScores = gradeSnap.docs
                .filter(d => {
                    const sid = d.data().studentId;
                    // We'd need student grade info — use tutorEmail as a proxy scope
                    return d.data().tutorEmail === student.tutorEmail;
                })
                .map(d => parseFloat(d.data().score))
                .filter(s => !isNaN(s));
            if (gradeScores.length) gradeAvg = Math.round(gradeScores.reduce((a,b)=>a+b,0)/gradeScores.length);
        }

        if (myAvg === null) {
            el.innerHTML = `<div class="text-center py-4"><div class="text-3xl mb-2">📊</div><p class="text-gray-400 text-sm">No graded assignments yet.</p></div>`;
            return;
        }

        const scoreColor = myAvg >= 85 ? 'text-green-600' : myAvg >= 65 ? 'text-yellow-500' : 'text-red-500';
        const barColor   = myAvg >= 85 ? 'bg-green-500' : myAvg >= 65 ? 'bg-yellow-400' : 'bg-red-400';

        el.innerHTML = `
            <div class="text-center">
                <p class="text-xs text-gray-400 uppercase font-semibold mb-2">My Average Grade</p>
                <p class="text-5xl font-black ${scoreColor} mb-2">${myAvg}<span class="text-xl font-normal text-gray-400">%</span></p>
                <div class="w-full bg-gray-100 rounded-full h-2.5 mb-2">
                    <div class="h-2.5 rounded-full ${barColor} transition-all duration-700" style="width:${myAvg}%"></div>
                </div>
                <p class="text-xs text-gray-500">Based on ${myScores.length} graded assignment${myScores.length!==1?'s':''}</p>
                ${gradeAvg !== null ? `<p class="text-xs text-gray-400 mt-1">Class average: <strong class="text-gray-600">${gradeAvg}%</strong> ${myAvg >= gradeAvg ? '🌟 Above average!' : '📈 Keep going!'}</p>` : ''}
            </div>`;
    } catch(e) {
        console.error('loadAverageGradeCard:', e);
        el.innerHTML = '<p class="text-red-400 text-sm text-center">Could not load grade data.</p>';
    }
}

// ── Courses Summary on Overview ──
async function loadCoursesSummary(student) {
    const el = document.getElementById('courses-summary-card');
    if (!el) return;
    const subjects = student.subjects || [];
    if (!subjects.length) { el.innerHTML = '<p class="text-gray-400 text-sm">No courses enrolled yet.</p>'; return; }
    el.innerHTML = `
        <p class="text-xs text-gray-400 uppercase font-semibold mb-3">My Courses</p>
        <div class="flex flex-wrap gap-2">
            ${subjects.map(s => `<span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">${safeEscape(s)}</span>`).join('')}
        </div>`;
}

// ── Upcoming Schedule Card ──
async function loadUpcomingScheduleCard(student) {
    const el = document.getElementById('upcoming-schedule-card');
    if (!el) return;
    const schedule = student.schedule || [];
    if (!schedule.length) { el.innerHTML = '<p class="text-gray-400 text-sm">No schedule set yet.</p>'; return; }

    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const nowWAT = new Date(new Date().toLocaleString('en-US', { timeZone:'Africa/Lagos' }));
    const todayIndex = nowWAT.getDay();

    // Get next 5 upcoming slots
    const upcoming = [];
    for (let d = 0; d < 14 && upcoming.length < 5; d++) {
        const targetIndex = (todayIndex + d) % 7;
        const targetDay = DAYS[targetIndex];
        const nowMins = d === 0 ? nowWAT.getHours()*60+nowWAT.getMinutes() : -1;
        const slots = schedule.filter(s=>s.day===targetDay).sort((a,b)=>(a.start||'').localeCompare(b.start||''));
        for (const slot of slots) {
            const [sh,sm] = (slot.start||'00:00').split(':').map(Number);
            if (d > 0 || sh*60+sm > nowMins) {
                upcoming.push({ day: targetDay, daysAhead: d, ...slot });
                if (upcoming.length >= 5) break;
            }
        }
    }

    function fmtTime(t) {
        if (!t) return '';
        const [h,m] = t.split(':').map(Number);
        const ap = h>=12?'PM':'AM';
        return `${h%12||12}:${String(m).padStart(2,'0')} ${ap}`;
    }

    el.innerHTML = `
        <p class="text-xs text-gray-400 uppercase font-semibold mb-3">Upcoming Classes (Nigeria Time)</p>
        <div class="space-y-2">
            ${upcoming.map((s,i) => `
            <div class="flex items-center gap-3 p-2 rounded-lg ${i===0?'bg-blue-50 border border-blue-200':'bg-gray-50'}">
                <div class="text-center flex-shrink-0 w-12">
                    <p class="text-xs font-bold ${i===0?'text-blue-600':'text-gray-500'}">${safeEscape(s.day.substring(0,3))}</p>
                    <p class="text-xs text-gray-400">${s.daysAhead===0?'Today':s.daysAhead===1?'Tmrw':'+'+s.daysAhead+'d'}</p>
                </div>
                <div class="flex-1">
                    <p class="text-sm font-semibold text-gray-700">${safeEscape(fmtTime(s.start))} – ${safeEscape(fmtTime(s.end))}</p>
                </div>
                ${i===0?'<span class="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Next</span>':''}
            </div>`).join('')}
        </div>`;
}

// ── Assignments Tab ──
async function loadAssignmentsTab(student) {
    const el = document.getElementById('tab-assignments');
    if (!el || el.dataset.loaded === '1') return;
    el.innerHTML = '<div class="text-center py-8"><div class="spinner mx-auto mb-3"></div><p class="text-gray-500">Loading assignments…</p></div>';

    try {
        const snap = await getDocs(query(
            collection(db,'homework_assignments'),
            where('studentId','==',student.id),
            orderBy('assignedDate','desc')
        ));

        if (snap.empty) {
            el.innerHTML = '<div class="text-center py-10"><div class="text-4xl mb-3">📭</div><p class="text-gray-400">No assignments yet.</p></div>';
            return;
        }

        // Group by week
        const byWeek = {};
        snap.docs.forEach(d => {
            const data = d.data();
            const raw  = data.assignedDate || data.assignedAt || data.createdAt;
            const date = raw?.toDate ? raw.toDate() : new Date(raw || Date.now());
            const weekStart = new Date(date); weekStart.setDate(date.getDate() - date.getDay());
            const wk = weekStart.toISOString().slice(0,10);
            if (!byWeek[wk]) byWeek[wk] = [];
            byWeek[wk].push({ id: d.id, date, ...data });
        });

        const sortedWeeks = Object.keys(byWeek).sort((a,b) => b.localeCompare(a));

        el.innerHTML = `<div class="space-y-3">
            ${sortedWeeks.map((wk,wi) => {
                const assignments = byWeek[wk];
                const weekDate = new Date(wk);
                const weekEnd  = new Date(wk); weekEnd.setDate(weekEnd.getDate()+6);
                const label = `${weekDate.toLocaleDateString('en-NG',{day:'numeric',month:'short'})} – ${weekEnd.toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'})}`;
                const pendingCount = assignments.filter(a=>a.status!=='graded').length;
                return `
                <details ${wi===0?'open':''} class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <summary class="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 list-none">
                        <span class="font-bold text-gray-700">Week of ${safeEscape(label)}</span>
                        <div class="flex gap-2">
                            <span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">${assignments.length} assignments</span>
                            ${pendingCount>0?`<span class="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs">${pendingCount} pending</span>`:''}
                        </div>
                    </summary>
                    <div class="divide-y divide-gray-100 border-t border-gray-100">
                        ${assignments.map(a => `
                        <div class="p-4">
                            <div class="flex items-start justify-between gap-3 flex-wrap">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 flex-wrap mb-1">
                                        <h4 class="font-bold text-gray-800">${safeEscape(a.title||'Untitled')}</h4>
                                        ${a.status==='graded'?'<span class="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">✅ Graded</span>':a.status==='submitted'?'<span class="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">📤 Submitted</span>':'<span class="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full">⏳ Pending</span>'}
                                    </div>
                                    ${a.description?`<p class="text-sm text-gray-600 mb-2">${safeEscape(a.description)}</p>`:''}
                                    <p class="text-xs text-gray-400">Due: ${safeEscape(a.dueDate||'Not set')} · Assigned: ${safeEscape(a.date.toLocaleDateString('en-NG'))}</p>
                                    ${a.score!=null&&a.score!==''?`<p class="text-sm font-bold text-green-600 mt-1">Score: ${safeEscape(String(a.score))}/100</p>`:''}
                                    ${a.feedback?`<p class="text-sm text-gray-500 italic mt-1 bg-gray-50 rounded-lg p-2">"${safeEscape(a.feedback)}"</p>`:''}
                                </div>
                                <div class="flex gap-2 flex-shrink-0">
                                    ${a.fileUrl||a.attachments?.[0]?.url?`<a href="${safeEscape(a.fileUrl||a.attachments[0].url)}" target="_blank" class="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-100">📄 Open</a>`:''}
                                    ${a.status!=='graded'?`<button onclick="submitHomework('${safeEscape(a.id)}')" class="text-xs bg-green-50 text-green-600 border border-green-200 rounded-lg px-3 py-2 hover:bg-green-100">📤 Submit</button>`:''}
                                </div>
                            </div>
                        </div>`).join('')}
                    </div>
                </details>`;
            }).join('')}
        </div>`;
        el.dataset.loaded = '1';
    } catch(e) {
        console.error(e);
        el.innerHTML = '<p class="text-red-400 text-center py-8">Error loading assignments.</p>';
    }
}

// ── Submit Homework Modal ──
window.submitHomework = function(homeworkId) {
    const modal = document.createElement('div');
    modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
    modal.innerHTML = `
        <div style="background:white;border-radius:16px;padding:24px;max-width:480px;width:100%">
            <h3 style="font-weight:700;font-size:1.1rem;margin-bottom:16px">📤 Submit Homework</h3>
            <p style="color:#6b7280;font-size:0.875rem;margin-bottom:12px">You can type comments and/or upload a file.</p>
            <textarea id="hw-submit-comment" rows="3" placeholder="Comments or notes for your tutor…" style="width:100%;border:1px solid #d1d5db;border-radius:8px;padding:10px;font-size:0.875rem;margin-bottom:10px;box-sizing:border-box"></textarea>
            <input type="file" id="hw-submit-file" style="margin-bottom:12px;font-size:0.875rem" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt">
            <div style="display:flex;gap:8px;justify-content:flex-end">
                <button onclick="this.closest('[style]').remove()" style="border:1px solid #d1d5db;border-radius:8px;padding:8px 16px;cursor:pointer;background:white">Cancel</button>
                <button id="hw-submit-btn" onclick="doSubmitHomework('${safeEscape(homeworkId)}',this)" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-weight:600">Submit</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
};

window.doSubmitHomework = async function(homeworkId, btn) {
    btn.textContent = 'Submitting…'; btn.disabled = true;
    const comment  = document.getElementById('hw-submit-comment')?.value.trim();
    const fileEl   = document.getElementById('hw-submit-file');
    const file     = fileEl?.files[0];

    try {
        let submissionUrl = null;
        if (file) {
            // Upload to Cloudinary (uses student's tutor's config)
            const fd = new FormData();
            fd.append('file', file);
            fd.append('upload_preset', 'tutor_homework');
            fd.append('folder', 'student_submissions');
            const res = await fetch('https://api.cloudinary.com/v1_1/dwjq7j5zp/upload', { method:'POST', body:fd });
            const data = await res.json();
            submissionUrl = data.secure_url || null;
        }

        await updateDoc(doc(db,'homework_assignments',homeworkId), {
            status: 'submitted',
            submittedAt: serverTimestamp(),
            submissionUrl: submissionUrl || '',
            studentComment: comment || ''
        });

        btn.closest('[style]').remove();
        showToast('Homework submitted successfully! ✅', 'success');
        // Reload assignments
        const el = document.getElementById('tab-assignments');
        if (el) { delete el.dataset.loaded; loadAssignmentsTab(studentData); }
    } catch(e) {
        console.error(e);
        showToast('Submission failed: '+e.message, 'error');
        btn.textContent = 'Submit'; btn.disabled = false;
    }
};

// ── Courses Tab ──
async function loadCoursesTab(student) {
    const el = document.getElementById('tab-courses');
    if (!el || el.dataset.loaded === '1') return;
    el.innerHTML = '<div class="text-center py-8"><div class="spinner mx-auto mb-3"></div><p class="text-gray-500">Loading courses…</p></div>';

    try {
        const snap = await getDocs(query(
            collection(db,'course_materials'),
            where('studentId','==',student.id),
            orderBy('uploadedAt','desc')
        ));

        if (snap.empty) { el.innerHTML = '<div class="text-center py-10"><div class="text-4xl mb-3">📚</div><p class="text-gray-400">No course materials uploaded yet.</p></div>'; el.dataset.loaded='1'; return; }

        function iconForType(type) {
            if (!type) return '📄';
            if (type.includes('pdf')) return '📕';
            if (type.includes('image')) return '🖼️';
            if (type.includes('word')||type.includes('doc')) return '📝';
            if (type.includes('spreadsheet')||type.includes('xls')) return '📊';
            if (type.includes('presentation')||type.includes('ppt')) return '📊';
            return '📄';
        }

        el.innerHTML = `
            <p class="text-xs text-gray-400 uppercase font-semibold mb-4">My Course Materials (${snap.size})</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px">
                ${snap.docs.map(d => {
                    const mat = d.data();
                    const date = mat.uploadedAt?.toDate ? mat.uploadedAt.toDate().toLocaleDateString('en-NG') : 'Unknown';
                    const icon = iconForType(mat.fileType);
                    const url  = safeEscape(mat.fileUrl||'#');
                    return `
                    <div style="background:white;border:1px solid #e5e7eb;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px;cursor:pointer;transition:box-shadow .2s" 
                         onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'" onmouseout="this.style.boxShadow='none'"
                         onclick="window.open('${url}','_blank')">
                        <div style="font-size:2rem;text-align:center;margin-bottom:4px">${icon}</div>
                        <p style="font-weight:700;font-size:0.9rem;color:#1f2937;margin:0;text-align:center;word-break:break-word">${safeEscape(mat.title)}</p>
                        ${mat.description?`<p style="font-size:0.75rem;color:#6b7280;text-align:center;margin:0">${safeEscape(mat.description)}</p>`:''}
                        <p style="font-size:0.7rem;color:#9ca3af;text-align:center;margin:0">📅 ${safeEscape(date)}</p>
                        <a href="${url}" target="_blank" onclick="event.stopPropagation()" style="display:block;text-align:center;background:#2563eb;color:white;border-radius:8px;padding:6px;font-size:0.75rem;text-decoration:none;font-weight:600;margin-top:4px">Open in New Tab ↗</a>
                    </div>`;
                }).join('')}
            </div>`;
        el.dataset.loaded = '1';
    } catch(e) {
        console.error(e);
        el.innerHTML = '<p class="text-red-400 text-center py-8">Error loading courses.</p>';
    }
}

// ── Results Tab ──
async function loadResultsTab(student) {
    const el = document.getElementById('tab-results');
    if (!el || el.dataset.loaded === '1') return;
    el.innerHTML = '<div class="text-center py-8"><div class="spinner mx-auto mb-3"></div></div>';

    try {
        const snap = await getDocs(query(
            collection(db,'homework_assignments'),
            where('studentId','==',student.id),
            where('status','==','graded')
        ));

        if (snap.empty) { el.innerHTML = '<div class="text-center py-10"><div class="text-4xl mb-3">📊</div><p class="text-gray-400">No graded results yet.</p></div>'; el.dataset.loaded='1'; return; }

        const results = snap.docs.map(d => {
            const data = d.data();
            const raw  = data.gradedAt || data.assignedDate;
            const date = raw?.toDate ? raw.toDate() : new Date(raw || Date.now());
            return { date, title: data.title||'Homework', score: data.score, feedback: data.feedback };
        }).sort((a,b) => b.date - a.date);

        el.innerHTML = `
            <p class="text-xs text-gray-400 uppercase font-semibold mb-4">My Results</p>
            <div class="overflow-x-auto">
                <table style="width:100%;border-collapse:collapse;font-size:0.875rem">
                    <thead>
                        <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb">
                            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:600;font-size:0.75rem;text-transform:uppercase">Assignment</th>
                            <th style="text-align:center;padding:10px 12px;color:#6b7280;font-weight:600;font-size:0.75rem;text-transform:uppercase">Score</th>
                            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:600;font-size:0.75rem;text-transform:uppercase">Date</th>
                            <th style="text-align:left;padding:10px 12px;color:#6b7280;font-weight:600;font-size:0.75rem;text-transform:uppercase">Feedback</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map((r,i) => {
                            const sc = parseFloat(r.score);
                            const color = isNaN(sc) ? '#6b7280' : sc>=85 ? '#16a34a' : sc>=65 ? '#ca8a04' : '#dc2626';
                            return `
                            <tr style="border-bottom:1px solid #f3f4f6;${i%2===0?'background:white':'background:#fafafa'}">
                                <td style="padding:10px 12px;font-weight:600;color:#1f2937">${safeEscape(r.title)}</td>
                                <td style="padding:10px 12px;text-align:center;font-weight:700;color:${color};">${isNaN(sc)?'—':sc+'/100'}</td>
                                <td style="padding:10px 12px;color:#6b7280;font-size:0.8rem">${safeEscape(r.date.toLocaleDateString('en-NG'))}</td>
                                <td style="padding:10px 12px;color:#6b7280;font-size:0.8rem;max-width:240px">${safeEscape(r.feedback||'—')}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
        el.dataset.loaded = '1';
    } catch(e) {
        console.error(e);
        el.innerHTML = '<p class="text-red-400 text-center py-8">Error loading results.</p>';
    }
}

// ── Schedule Tab ──
async function loadScheduleTab(student) {
    const el = document.getElementById('tab-schedule');
    if (!el || el.dataset.loaded === '1') return;

    const schedule = student.schedule || [];
    const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

    function fmtTime(t) {
        if (!t) return '';
        const [h,m] = t.split(':').map(Number);
        return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
    }

    if (!schedule.length) {
        el.innerHTML = '<div class="text-center py-10"><div class="text-4xl mb-3">📅</div><p class="text-gray-400">No schedule set yet. Contact your tutor.</p></div>';
        el.dataset.loaded = '1';
        return;
    }

    const byDay = {};
    DAYS.forEach(d => byDay[d] = []);
    schedule.forEach(s => { if (byDay[s.day]) byDay[s.day].push(s); });

    el.innerHTML = `
        <p class="text-xs text-gray-400 uppercase font-semibold mb-4">My Weekly Schedule (Nigeria Time)</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px">
            ${DAYS.map(day => {
                const slots = byDay[day].sort((a,b)=>(a.start||'').localeCompare(b.start||''));
                const isToday = new Date().toLocaleDateString('en-US',{weekday:'long'}) === day;
                return `
                <div style="background:${isToday?'#eff6ff':'white'};border:${isToday?'2px solid #2563eb':'1px solid #e5e7eb'};border-radius:12px;padding:12px">
                    <p style="font-weight:700;font-size:0.8rem;color:${isToday?'#2563eb':'#374151'};text-transform:uppercase;margin-bottom:8px;border-bottom:1px solid ${isToday?'#bfdbfe':'#f3f4f6'};padding-bottom:4px">
                        ${safeEscape(day.substring(0,3))}${isToday?' ·Today':''}
                    </p>
                    ${slots.length ? slots.map(s => `
                    <div style="background:${isToday?'#dbeafe':'#f8fafc'};border-radius:8px;padding:6px 8px;margin-bottom:4px">
                        <p style="font-size:0.75rem;font-weight:600;color:#1f2937;margin:0">${safeEscape(fmtTime(s.start))} – ${safeEscape(fmtTime(s.end))}</p>
                        ${s.isOvernight?'<p style="font-size:0.65rem;color:#7c3aed;margin:0">🌙 Overnight</p>':''}
                    </div>`).join('') : `<p style="font-size:0.75rem;color:#d1d5db;text-align:center">No class</p>`}
                </div>`;
            }).join('')}
        </div>
        <p style="font-size:0.75rem;color:#9ca3af;margin-top:12px;text-align:center">All times in Nigeria (WAT). Your local time may differ.</p>`;
    el.dataset.loaded = '1';
}

// ── Notifications System ──
async function setupNotifications(student) {
    const bellEl = document.getElementById('notification-bell');
    const badgeEl = document.getElementById('notification-badge');
    const panelEl = document.getElementById('notification-panel');
    if (!bellEl) return;

    const notifications = [];

    // 1. Welcome message
    notifications.push({ type:'welcome', icon:'👋', text:`Welcome back, ${student.studentName}! Great to see you today.`, time:'now', isNew:true });

    // 2. Weekly reminder (every time)
    notifications.push({ type:'reminder', icon:'📖', text:`Reminder: Read your books and complete your homework this week!`, time:'Weekly', isNew:false });

    // 3. Auto messages: beginning of month and 2nd week
    const now = new Date();
    const day = now.getDate();
    if (day <= 3) notifications.push({ type:'auto', icon:'🗓️', text:`New month, new goals! Stay focused and give it your best.`, time:'Start of month', isNew:true });
    if (day >= 8 && day <= 14) notifications.push({ type:'auto', icon:'💪', text:`You're in the 2nd week — keep up the great work!`, time:'Week 2', isNew:false });

    // 4. Check for new homework
    try {
        const hwSnap = await getDocs(query(
            collection(db,'homework_assignments'),
            where('studentId','==',student.id),
            where('status','==','assigned')
        ));
        const pending = hwSnap.size;
        if (pending > 0) notifications.push({ type:'homework', icon:'📝', text:`You have ${pending} pending assignment${pending!==1?'s':''} to complete.`, time:'Now', isNew:true });
    } catch(e) { console.warn(e); }

    // 5. Check for new courses
    try {
        const courseSnap = await getDocs(query(collection(db,'course_materials'), where('studentId','==',student.id)));
        if (courseSnap.size > 0) notifications.push({ type:'course', icon:'📚', text:`${courseSnap.size} course material${courseSnap.size!==1?'s':''} available from your tutor.`, time:'', isNew:false });
    } catch(e) { console.warn(e); }

    // 6. Check for new messages
    try {
        if (student.id) {
            const convSnap = await getDocs(query(collection(db,'conversations'), where('studentId','==',student.id)));
            let unread = 0;
            convSnap.forEach(d => { const data=d.data(); if (data.unreadCount>0 && data.lastSenderId!==student.id) unread+=data.unreadCount; });
            if (unread > 0) notifications.push({ type:'message', icon:'💬', text:`You have ${unread} new message${unread!==1?'s':''} from your tutor.`, time:'Now', isNew:true });
        }
    } catch(e) { console.warn(e); }

    const newCount = notifications.filter(n=>n.isNew).length;
    if (badgeEl) { badgeEl.textContent = newCount; badgeEl.style.display = newCount > 0 ? '' : 'none'; }

    // Build panel
    if (panelEl) {
        panelEl.innerHTML = `
            <div style="padding:14px 16px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">
                <h4 style="font-weight:700;margin:0">Notifications</h4>
                <span style="font-size:0.75rem;color:#9ca3af">${notifications.length} total</span>
            </div>
            <div style="overflow-y:auto;max-height:320px">
                ${notifications.map(n => `
                <div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;display:flex;gap:10px;align-items:flex-start;${n.isNew?'background:#fafff5':''}">
                    <span style="font-size:1.4rem;flex-shrink:0">${n.icon}</span>
                    <div style="flex:1;min-width:0">
                        <p style="margin:0;font-size:0.875rem;color:#1f2937">${safeEscape(n.text)}</p>
                        ${n.time?`<p style="margin:2px 0 0;font-size:0.7rem;color:#9ca3af">${safeEscape(n.time)}</p>`:''}
                    </div>
                    ${n.isNew?'<span style="width:8px;height:8px;background:#22c55e;border-radius:50%;flex-shrink:0;margin-top:4px"></span>':''}
                </div>`).join('')}
            </div>`;
        panelEl.style.display = 'none';
    }

    bellEl.onclick = () => {
        if (!panelEl) return;
        const visible = panelEl.style.display !== 'none';
        panelEl.style.display = visible ? 'none' : 'block';
    };

    // Close on outside click
    document.addEventListener('click', e => {
        if (panelEl && !bellEl.contains(e.target) && !panelEl.contains(e.target)) panelEl.style.display='none';
    });
}

// ── Messaging Tab (student side) ──
let unsubStudentChat = null;

function setupMessagingTab(student) {
    // This is called once; the tab renders on click
}

async function loadMessagingTab(student) {
    const el = document.getElementById('tab-messaging');
    if (!el) return;

    // Find tutor conversation
    const convId = [student.tutorId||student.tutorEmail, student.id].sort().join('_');
    const tutorName = student.tutorName || 'Tutor';

    el.innerHTML = `
        <div style="max-width:600px;margin:0 auto;background:white;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;height:70vh">
            <div style="padding:14px 16px;border-bottom:1px solid #e5e7eb;background:#f9fafb;display:flex;align-items:center;gap:10px">
                <div style="width:36px;height:36px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#2563eb;flex-shrink:0">
                    ${safeEscape((tutorName||'T').charAt(0).toUpperCase())}
                </div>
                <div>
                    <p style="font-weight:700;margin:0;font-size:0.9rem">${safeEscape(tutorName)}</p>
                    <p style="font-size:0.7rem;color:#9ca3af;margin:0">Your Tutor</p>
                </div>
            </div>
            <div id="student-chat-messages" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px">
                <div style="text-align:center;color:#9ca3af;margin:auto;font-size:0.875rem">Loading messages…</div>
            </div>
            <div style="padding:10px 12px;border-top:1px solid #e5e7eb;display:flex;gap:6px;align-items:center">
                <label style="cursor:pointer;font-size:1.2rem;flex-shrink:0" title="Send image">
                    📷<input type="file" id="student-img-input" accept="image/*" style="display:none">
                </label>
                <input type="text" id="student-chat-input" placeholder="Type a message…" style="flex:1;border:1px solid #d1d5db;border-radius:8px;padding:8px 12px;font-size:0.875rem">
                <button id="student-chat-send" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:1rem">➤</button>
            </div>
        </div>`;

    // Mark messages as read
    try { await updateDoc(doc(db,'conversations',convId), { unreadCount: 0 }); } catch(_) {}

    // Listen for messages
    if (unsubStudentChat) unsubStudentChat();
    const msgEl = document.getElementById('student-chat-messages');

    try {
        const q = query(collection(db,'conversations',convId,'messages'), orderBy('createdAt','asc'));
        unsubStudentChat = onSnapshot(q, snap => {
            if (!msgEl) return;
            msgEl.innerHTML = '';
            if (snap.empty) {
                msgEl.innerHTML = '<div style="text-align:center;color:#9ca3af;margin:auto;font-size:0.875rem">No messages yet. Say hello! 👋</div>';
                return;
            }
            snap.forEach(d => {
                const m = d.data();
                const isMe = m.senderId === student.id;
                const bubble = document.createElement('div');
                bubble.style.cssText = `max-width:72%;padding:10px 14px;border-radius:${isMe?'18px 18px 4px 18px':'18px 18px 18px 4px'};background:${isMe?'#2563eb':'#f3f4f6'};color:${isMe?'white':'#1f2937'};align-self:${isMe?'flex-end':'flex-start'};word-break:break-word`;
                let inner = '';
                if (m.imageUrl) inner += `<img src="${safeEscape(m.imageUrl)}" style="max-width:180px;border-radius:8px;display:block;margin-bottom:4px">`;
                if (m.content) inner += `<span style="font-size:0.875rem">${safeEscape(m.content)}</span>`;
                const ts = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt||0);
                inner += `<div style="font-size:0.65rem;opacity:0.7;margin-top:3px;text-align:right">${ts.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>`;
                bubble.innerHTML = inner;
                msgEl.appendChild(bubble);
            });
            msgEl.scrollTop = msgEl.scrollHeight;
        });
    } catch(e) {
        if (msgEl) msgEl.innerHTML = '<p style="text-align:center;color:#9ca3af">Could not load messages.</p>';
    }

    // Send handler
    async function sendStudentMsg() {
        const input  = document.getElementById('student-chat-input');
        const imgInp = document.getElementById('student-img-input');
        const txt    = input?.value.trim();
        const file   = imgInp?.files[0];
        if (!txt && !file) return;
        if (input) input.value = '';

        const now = new Date();
        let imageUrl = null;

        if (file) {
            try {
                const fd = new FormData();
                fd.append('file', file);
                fd.append('upload_preset', 'tutor_homework');
                fd.append('folder', 'chat_images');
                const res = await fetch('https://api.cloudinary.com/v1_1/dwjq7j5zp/upload',{method:'POST',body:fd});
                imageUrl = (await res.json()).secure_url || null;
                if (imgInp) imgInp.value = '';
            } catch(e) { console.error(e); }
        }

        try {
            // Ensure conversation doc exists
            await setDoc(doc(db,'conversations',convId), {
                participants: [student.tutorId||student.tutorEmail, student.id],
                participantDetails: {
                    [student.id]: { name: student.studentName, role:'student' },
                    [student.tutorId||student.tutorEmail]: { name: tutorName, role:'tutor' }
                },
                lastMessage: imageUrl ? '📷 Image' : txt,
                lastMessageTimestamp: now,
                lastSenderId: student.id,
                unreadCount: 1,
                studentId: student.id,
                tutorId: student.tutorId || ''
            }, { merge: true });

            await addDoc(collection(db,'conversations',convId,'messages'), {
                content: txt||'', imageUrl: imageUrl||null,
                senderId: student.id, senderName: student.studentName, senderRole:'student',
                createdAt: now, read: false
            });
        } catch(e) { console.error(e); showToast('Message failed to send.','error'); }
    }

    document.getElementById('student-chat-send')?.addEventListener('click', sendStudentMsg);
    document.getElementById('student-chat-input')?.addEventListener('keypress', e => { if (e.key==='Enter') sendStudentMsg(); });
}

// ── Games Tab (Educational Games) ──
async function loadGamesTab(student) {
    const el = document.getElementById('tab-games');
    if (!el || el.dataset.loaded === '1') return;

    const subjects = student.subjects || [];
    const grade    = parseInt((student.grade||'').replace(/\D/g,'')) || 5;

    // Only show games for enrolled subjects + always Scrabble/Snake
    const MATH_GAMES    = ['Maths','Math','Mathematics'];
    const ELA_GAMES     = ['English','Language Arts','English Proficiency','ELA'];
    const SCI_GAMES     = { Biology:'Biology', Chemistry:'Chemistry', Physics:'Physics' };

    const availableGames = [];

    // Maths
    if (subjects.some(s => MATH_GAMES.some(m => s.toLowerCase().includes(m.toLowerCase())))) {
        availableGames.push({ id:'maths-quiz', name:'Maths Quiz', icon:'🔢', desc:'Arithmetic & problem solving', subject:'Maths' });
    }

    // ELA
    if (subjects.some(s => ELA_GAMES.some(m => s.toLowerCase().includes(m.toLowerCase())))) {
        availableGames.push({ id:'word-puzzle', name:'Word Puzzle', icon:'🔤', desc:'Vocabulary & comprehension', subject:'ELA' });
    }

    // Sciences
    Object.entries(SCI_GAMES).forEach(([subj, label]) => {
        if (subjects.some(s => s.toLowerCase().includes(subj.toLowerCase()))) {
            availableGames.push({ id: subj.toLowerCase()+'-quiz', name: label+' Quiz', icon: subj==='Biology'?'🧬':subj==='Chemistry'?'⚗️':'⚛️', desc: label+' concepts for Grade '+grade, subject: label });
        }
    });

    // Always available
    availableGames.push({ id:'scrabble', name:'Scrabble', icon:'🔡', desc:'Build words and score points', subject:'All' });
    availableGames.push({ id:'snake', name:'Snake', icon:'🐍', desc:'Classic snake game — collect as many as you can!', subject:'All' });

    el.innerHTML = `
        <p class="text-xs text-gray-400 uppercase font-semibold mb-4">Educational Games</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:16px;margin-bottom:24px">
            ${availableGames.map(g => `
            <div style="background:white;border:1px solid #e5e7eb;border-radius:16px;padding:20px;text-align:center;cursor:pointer;transition:all .2s"
                 onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 20px rgba(0,0,0,.08)'"
                 onmouseout="this.style.transform='';this.style.boxShadow=''"
                 onclick="launchGame('${safeEscape(g.id)}','${safeEscape(g.name)}')">
                <div style="font-size:2.5rem;margin-bottom:8px">${g.icon}</div>
                <p style="font-weight:700;color:#1f2937;margin:0 0 4px">${safeEscape(g.name)}</p>
                <p style="font-size:0.75rem;color:#6b7280;margin:0 0 8px">${safeEscape(g.desc)}</p>
                <span style="font-size:0.7rem;background:#dbeafe;color:#2563eb;padding:2px 8px;border-radius:999px">${safeEscape(g.subject)}</span>
            </div>`).join('')}
        </div>
        <div id="game-container" style="background:white;border:1px solid #e5e7eb;border-radius:16px;padding:20px;display:none"></div>
        <div id="game-leaderboard" style="margin-top:20px"></div>`;

    el.dataset.loaded = '1';
}

window.launchGame = function(gameId, gameName) {
    const container = document.getElementById('game-container');
    if (!container) return;
    container.style.display = 'block';
    container.scrollIntoView({ behavior:'smooth' });

    if (gameId === 'snake') {
        container.innerHTML = renderSnakeGame();
        initSnakeGame();
    } else if (gameId === 'scrabble') {
        container.innerHTML = renderScrabbleGame();
        initScrabbleGame();
    } else if (gameId.includes('quiz')) {
        const subject = gameId.replace('-quiz','');
        container.innerHTML = renderQuizGame(gameName, subject, parseInt((studentData?.grade||'5').replace(/\D/g,''))||5);
        initQuizGame(subject);
    }
};

// ── Snake Game ──
function renderSnakeGame() {
    return `
        <div style="text-align:center">
            <h3 style="font-weight:700;margin-bottom:12px">🐍 Snake</h3>
            <canvas id="snake-canvas" width="320" height="320" style="border:2px solid #e5e7eb;border-radius:8px;display:block;margin:0 auto"></canvas>
            <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
                <p id="snake-score" style="font-weight:700;color:#2563eb">Score: 0</p>
                <button onclick="startSnake()" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer">▶ Start / Restart</button>
            </div>
            <p style="font-size:0.75rem;color:#9ca3af;margin-top:6px">Use Arrow Keys or WASD to move</p>
        </div>`;
}

function initSnakeGame() {
    window.startSnake = function() {
        const canvas = document.getElementById('snake-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const SIZE = 16, COLS = canvas.width/SIZE, ROWS = canvas.height/SIZE;
        let snake = [{x:10,y:10}], dir={x:1,y:0}, food=newFood(), score=0, gameLoop;

        function newFood() { return { x:Math.floor(Math.random()*COLS), y:Math.floor(Math.random()*ROWS) }; }

        function draw() {
            ctx.fillStyle='#f9fafb'; ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.fillStyle='#ef4444'; ctx.fillRect(food.x*SIZE+1,food.y*SIZE+1,SIZE-2,SIZE-2);
            snake.forEach((s,i) => {
                ctx.fillStyle = i===0?'#2563eb':'#93c5fd';
                ctx.fillRect(s.x*SIZE+1,s.y*SIZE+1,SIZE-2,SIZE-2);
            });
        }

        function tick() {
            const head = {x:snake[0].x+dir.x, y:snake[0].y+dir.y};
            if (head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS||snake.some(s=>s.x===head.x&&s.y===head.y)) {
                clearInterval(gameLoop);
                ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(0,0,canvas.width,canvas.height);
                ctx.fillStyle='white'; ctx.font='bold 24px sans-serif'; ctx.textAlign='center';
                ctx.fillText('Game Over!', canvas.width/2, canvas.height/2-10);
                ctx.font='16px sans-serif'; ctx.fillText('Score: '+score, canvas.width/2, canvas.height/2+20);
                saveGameScore('snake', score);
                return;
            }
            snake.unshift(head);
            if (head.x===food.x && head.y===food.y) { score++; document.getElementById('snake-score').textContent='Score: '+score; food=newFood(); }
            else snake.pop();
            draw();
        }

        clearInterval(gameLoop);
        snake=[{x:10,y:10}]; dir={x:1,y:0}; food=newFood(); score=0;
        document.getElementById('snake-score').textContent='Score: 0';
        draw();
        gameLoop = setInterval(tick, 130);
    };

    document.addEventListener('keydown', e => {
        const map = { ArrowUp:{x:0,y:-1}, ArrowDown:{x:0,y:1}, ArrowLeft:{x:-1,y:0}, ArrowRight:{x:1,y:0}, w:{x:0,y:-1}, s:{x:0,y:1}, a:{x:-1,y:0}, d:{x:1,y:0} };
        if (map[e.key] && window._snakeDir) { const nd=map[e.key]; if(nd.x!=-window._snakeDir.x||nd.y!=-window._snakeDir.y) window._snakeDir=nd; }
    });
}

// ── Simple Scrabble ──
function renderScrabbleGame() {
    const WORDS = ['CAT','DOG','SUN','MAP','JAR','PIG','HEN','COW','ANT','BEE','WEB','FLY','CUP','BAG','HAT','NET','PIN','TAB','VAN','ZAP'];
    const target = WORDS[Math.floor(Math.random()*WORDS.length)];
    const letters = target.split('').concat(['A','E','I','O','U','R','S','T'].sort(()=>Math.random()-.5).slice(0,4));
    const shuffled = letters.sort(()=>Math.random()-.5);

    return `
        <div style="text-align:center" data-word="${target}">
            <h3 style="font-weight:700;margin-bottom:4px">🔡 Scrabble Challenge</h3>
            <p style="font-size:0.875rem;color:#6b7280;margin-bottom:16px">Arrange the letters to form a valid word!</p>
            <div id="scrabble-answer" style="display:flex;justify-content:center;gap:6px;min-height:48px;border:2px dashed #e5e7eb;border-radius:8px;padding:8px;margin-bottom:12px;flex-wrap:wrap"></div>
            <div id="scrabble-pool" style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin-bottom:16px">
                ${shuffled.map((l,i)=>`<button onclick="scrabblePickLetter(this,'${l}')" style="width:44px;height:44px;font-size:1.1rem;font-weight:700;background:#dbeafe;color:#2563eb;border:2px solid #93c5fd;border-radius:8px;cursor:pointer">${l}</button>`).join('')}
            </div>
            <div style="display:flex;gap:8px;justify-content:center">
                <button onclick="scrabbleCheck()" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:600">✅ Check</button>
                <button onclick="scrabbleClear()" style="background:#f3f4f6;color:#374151;border:1px solid #e5e7eb;border-radius:8px;padding:10px 20px;cursor:pointer">🔄 Clear</button>
            </div>
            <p id="scrabble-result" style="margin-top:12px;font-weight:700;font-size:1.1rem"></p>
        </div>`;
}

function initScrabbleGame() {
    window._scrabbleSelected = [];

    window.scrabblePickLetter = function(btn, letter) {
        btn.style.opacity='0.4'; btn.disabled=true;
        window._scrabbleSelected.push({letter, btn});
        const ans = document.getElementById('scrabble-answer');
        const chip = document.createElement('span');
        chip.style.cssText='display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;font-size:1.1rem;font-weight:700;background:#2563eb;color:white;border-radius:8px;cursor:pointer';
        chip.textContent = letter;
        chip.onclick = () => {
            const idx = window._scrabbleSelected.indexOf(window._scrabbleSelected.find(s=>s.btn===btn||s.letter===letter));
            if (idx>-1) { window._scrabbleSelected[idx].btn.style.opacity='1'; window._scrabbleSelected[idx].btn.disabled=false; window._scrabbleSelected.splice(idx,1); }
            chip.remove();
        };
        ans?.appendChild(chip);
    };

    window.scrabbleCheck = function() {
        const word = window._scrabbleSelected.map(s=>s.letter).join('');
        const target = document.querySelector('[data-word]')?.dataset.word;
        const result = document.getElementById('scrabble-result');
        if (!result) return;
        if (word === target) { result.textContent = '🎉 Correct! Well done!'; result.style.color='#16a34a'; saveGameScore('scrabble',10); }
        else { result.textContent = `❌ Not quite! The word was "${target}"`; result.style.color='#dc2626'; }
    };

    window.scrabbleClear = function() {
        window._scrabbleSelected.forEach(s => { s.btn.style.opacity='1'; s.btn.disabled=false; });
        window._scrabbleSelected = [];
        const ans = document.getElementById('scrabble-answer');
        if (ans) ans.innerHTML = '';
        const result = document.getElementById('scrabble-result');
        if (result) result.textContent = '';
    };
}

// ── Subject Quiz ──
function renderQuizGame(name, subject, grade) {
    return `
        <div id="quiz-container" data-subject="${subject}" data-grade="${grade}">
            <h3 style="font-weight:700;text-align:center;margin-bottom:16px">${safeEscape(name)}</h3>
            <div id="quiz-inner" style="text-align:center"><div class="spinner" style="margin:20px auto"></div></div>
        </div>`;
}

function initQuizGame(subject) {
    // Grade-appropriate questions by subject
    const QUESTIONS = {
        maths: [
            { q:'What is 15 × 7?', options:['95','105','100','110'], answer:1 },
            { q:'What is the square root of 144?', options:['10','11','12','13'], answer:2 },
            { q:'What is 25% of 200?', options:['40','50','60','45'], answer:1 },
            { q:'What is 3/4 + 1/2?', options:['5/4','7/6','1','4/6'], answer:0 },
        ],
        biology: [
            { q:'What is the powerhouse of the cell?', options:['Nucleus','Mitochondria','Ribosome','Vacuole'], answer:1 },
            { q:'What gas do plants absorb during photosynthesis?', options:['Oxygen','Nitrogen','Carbon Dioxide','Hydrogen'], answer:2 },
            { q:'How many chromosomes does a human body cell have?', options:['23','46','64','22'], answer:1 },
        ],
        chemistry: [
            { q:'What is the chemical symbol for Gold?', options:['Go','Gd','Au','Ag'], answer:2 },
            { q:'What is the pH of pure water?', options:['5','7','9','14'], answer:1 },
            { q:'What is the most abundant gas in Earth\'s atmosphere?', options:['Oxygen','Carbon Dioxide','Nitrogen','Argon'], answer:2 },
        ],
        physics: [
            { q:'What is the unit of electric current?', options:['Volt','Watt','Ampere','Ohm'], answer:2 },
            { q:'What is the speed of light (approx)?', options:['3×10⁸ m/s','3×10⁶ m/s','3×10⁴ m/s','3×10¹⁰ m/s'], answer:0 },
            { q:'F = ma is Newton\'s which law?', options:['First','Second','Third','Fourth'], answer:1 },
        ],
        ela: [
            { q:'What is an antonym of "brave"?', options:['Bold','Fearless','Cowardly','Daring'], answer:2 },
            { q:'Identify the verb: "She runs every morning."', options:['She','runs','every','morning'], answer:1 },
            { q:'What literary device uses "the wind whispered"?', options:['Simile','Metaphor','Personification','Alliteration'], answer:2 },
        ]
    };

    const qs = QUESTIONS[subject] || QUESTIONS.maths;
    let current = 0, score = 0;

    function renderQ() {
        const inner = document.getElementById('quiz-inner');
        if (!inner) return;
        if (current >= qs.length) {
            inner.innerHTML = `
                <div class="text-center py-4">
                    <div style="font-size:3rem;margin-bottom:8px">${score===qs.length?'🏆':score>qs.length/2?'⭐':'💪'}</div>
                    <p style="font-size:1.5rem;font-weight:700;color:#2563eb">${score}/${qs.length}</p>
                    <p style="color:#6b7280;margin-bottom:16px">${score===qs.length?'Perfect score!':score>qs.length/2?'Great job!':'Keep practising!'}</p>
                    <button onclick="initQuizGame('${subject}')" style="background:#2563eb;color:white;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:600">Play Again</button>
                </div>`;
            saveGameScore(subject+'-quiz', Math.round(score/qs.length*100));
            return;
        }
        const q = qs[current];
        inner.innerHTML = `
            <div style="text-align:left">
                <p style="font-size:0.8rem;color:#9ca3af;margin-bottom:8px">Question ${current+1} of ${qs.length} · Score: ${score}</p>
                <p style="font-weight:700;font-size:1rem;color:#1f2937;margin-bottom:16px">${safeEscape(q.q)}</p>
                <div style="display:flex;flex-direction:column;gap:8px">
                    ${q.options.map((opt,i)=>`
                    <button onclick="quizAnswer(${i},${q.answer})" style="background:#f9fafb;border:2px solid #e5e7eb;border-radius:10px;padding:10px 16px;text-align:left;cursor:pointer;font-size:0.875rem;color:#374151;transition:all .15s"
                        onmouseover="this.style.background='#eff6ff';this.style.borderColor='#93c5fd'"
                        onmouseout="this.style.background='#f9fafb';this.style.borderColor='#e5e7eb'">
                        ${String.fromCharCode(65+i)}. ${safeEscape(opt)}
                    </button>`).join('')}
                </div>
            </div>`;
    }

    window.quizAnswer = function(chosen, correct) {
        const btns = document.querySelectorAll('#quiz-inner button');
        btns.forEach((b,i) => {
            b.disabled = true;
            if (i===correct) b.style.background='#dcfce7', b.style.borderColor='#86efac';
            else if (i===chosen) b.style.background='#fee2e2', b.style.borderColor='#fca5a5';
        });
        if (chosen===correct) score++;
        setTimeout(() => { current++; renderQ(); }, 1000);
    };

    renderQ();
}

// ── Leaderboard ──
async function saveGameScore(gameId, score) {
    if (!studentData) return;
    try {
        const ref = doc(db, 'game_leaderboard', `${gameId}_${studentData.id}`);
        const existing = await getDoc(ref);
        const prev = existing.exists() ? (existing.data().score||0) : 0;
        if (score > prev) {
            await setDoc(ref, { gameId, studentId: studentData.id, studentName: studentData.studentName, grade: studentData.grade, score, updatedAt: serverTimestamp() });
        }
    } catch(e) { console.warn('Score save failed:', e); }
}

// ── Global Exports ──
window.showToast = showToast;
window.checkPasswordStrength = window.checkPasswordStrength;
window.togglePasswordVisibility = window.togglePasswordVisibility;
window.switchTab = window.switchTab;
window.goBackToStep1 = window.goBackToStep1;
window.showForgotPassword = window.showForgotPassword;
window.hideForgotPassword = window.hideForgotPassword;
window.findStudents = window.findStudents;
window.completeRegistration = window.completeRegistration;
window.loginStudent = window.loginStudent;
window.signInWithGoogle = window.signInWithGoogle;
window.signInWithGoogleForActivation = window.signInWithGoogleForActivation;
window.sendPasswordReset = window.sendPasswordReset;
window.initStudentDashboard = window.initStudentDashboard;
window.submitHomework = window.submitHomework;
window.doSubmitHomework = window.doSubmitHomework;
window.launchGame = window.launchGame;
