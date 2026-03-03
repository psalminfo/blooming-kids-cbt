import { auth, db } from './firebaseConfig-studentsignupmodular.js';
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// ─── Rate limiting ────────────────────────────────────────────────────────────
let failedAttempts = 0;
let lastAttemptTime = 0;
const MAX_ATTEMPTS  = 5;
const LOCKOUT_TIME  = 15 * 60 * 1000; // 15 minutes

// ─── Internal domain — never shown to students ───────────────────────────────
const INTERNAL_DOMAIN = 'bkh-portal.internal';

// ─── Username rules ───────────────────────────────────────────────────────────
// Lowercase letters, numbers, underscores only — 4 to 20 characters
const USERNAME_REGEX = /^[a-z0-9_]{4,20}$/;

// ─── Toast (XSS-safe — textContent only, never innerHTML for user data) ───────
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error:   'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info:    'fa-info-circle'
    };

    const icon = document.createElement('i');
    icon.className = `fas ${icons[type] || icons.info} text-xl`;

    const span = document.createElement('span');
    span.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(span);
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) container.removeChild(toast);
        }, 400);
    }, duration);
}

// ─── Generate non-guessable hidden email from username ────────────────────────
// Deterministic hash so the same username always produces the same hidden email.
// The student never sees or needs to know this address.
function generateHiddenEmail(username) {
    const clean = username.toLowerCase().trim();
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
        const chr = clean.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `u_${hex}@${INTERNAL_DOMAIN}`;
}

// ─── Sanitise username — strips any char not allowed ─────────────────────────
function sanitiseUsername(raw) {
    return raw.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
}

// ─── Rate limit check ─────────────────────────────────────────────────────────
function checkRateLimit() {
    const now = Date.now();
    if (failedAttempts >= MAX_ATTEMPTS) {
        if (now - lastAttemptTime < LOCKOUT_TIME) {
            const mins = Math.ceil((LOCKOUT_TIME - (now - lastAttemptTime)) / 60000);
            const el   = document.getElementById('rate-limit-message');
            if (el) el.textContent = `Too many failed attempts. Please try again in ${mins} minute${mins !== 1 ? 's' : ''}.`;
            document.getElementById('rate-limit-warning')?.classList.remove('hidden');
            return true;
        }
        failedAttempts = 0;
    }
    return false;
}

// ─── Reset rate limiter ───────────────────────────────────────────────────────
function resetRateLimiting() {
    failedAttempts = 0;
    document.getElementById('rate-limit-warning')?.classList.add('hidden');
    document.getElementById('failed-attempts-warning')?.classList.add('hidden');
}

// ─── Get client IP (best-effort, non-blocking) ────────────────────────────────
async function getClientIP() {
    try {
        const res  = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        return data.ip || 'unknown';
    } catch {
        return 'unknown';
    }
}

// ─── Write audit log (non-blocking — never stops user flow) ──────────────────
async function writeAuditLog(payload) {
    try {
        await setDoc(doc(collection(db, 'audit_logs')), {
            ...payload,
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent,
            ip: await getClientIP()
        });
    } catch {
        // Audit failure must never break auth flow
    }
}

// ─── Password strength checker ────────────────────────────────────────────────
window.checkPasswordStrength = () => {
    const password    = document.getElementById('student-pass')?.value || '';
    const meter       = document.getElementById('password-strength-meter');
    const strengthTxt = document.getElementById('strength-text');
    if (!meter || !strengthTxt) return;

    const hasLength  = password.length >= 12;
    const hasUpper   = /[A-Z]/.test(password);
    const hasLower   = /[a-z]/.test(password);
    const hasNumber  = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const toggleReq = (id, val) => document.getElementById(id)?.classList.toggle('valid', val);
    toggleReq('req-length',    hasLength);
    toggleReq('req-uppercase', hasUpper);
    toggleReq('req-lowercase', hasLower);
    toggleReq('req-number',    hasNumber);
    toggleReq('req-special',   hasSpecial);

    const score = [hasLength, hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

    if (!password) {
        meter.className       = 'password-strength-meter';
        strengthTxt.textContent = 'Weak';
        strengthTxt.className   = 'text-sm font-bold text-red-600';
        document.querySelectorAll('#password-requirements li').forEach(li => li.classList.remove('valid'));
    } else {
        meter.className = `password-strength-meter strength-${score}`;
        const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
        const colors  = ['text-red-600', 'text-orange-500', 'text-yellow-500', 'text-green-500', 'text-emerald-600'];
        strengthTxt.textContent = labels[score];
        strengthTxt.className   = `text-sm font-bold ${colors[score]}`;
    }

    const activateBtn = document.getElementById('activate-portal-btn');
    if (activateBtn) {
        activateBtn.disabled = !(hasLength && hasUpper && hasLower && hasNumber && hasSpecial);
    }
};

// ─── Username availability checker (called on input event) ───────────────────
window.checkUsernameAvailability = async () => {
    const inputEl  = document.getElementById('student-username-input');
    const feedback = document.getElementById('username-feedback');
    if (!inputEl || !feedback) return;

    const raw   = inputEl.value;
    const clean = sanitiseUsername(raw);

    // Silently reflect sanitised value back to the input
    if (inputEl.value !== clean) inputEl.value = clean;

    if (!clean) {
        feedback.textContent = '';
        feedback.className   = 'text-xs ml-2 mt-1';
        return;
    }

    if (!USERNAME_REGEX.test(clean)) {
        feedback.textContent = '4–20 characters. Letters, numbers and underscores only.';
        feedback.className   = 'text-xs ml-2 mt-1 text-red-500';
        return;
    }

    feedback.textContent = 'Checking availability...';
    feedback.className   = 'text-xs ml-2 mt-1 text-gray-400';

    try {
        const q  = query(collection(db, 'students'), where('username', '==', clean));
        const qs = await getDocs(q);
        if (qs.empty) {
            feedback.textContent = '✓ Username available';
            feedback.className   = 'text-xs ml-2 mt-1 text-green-600 font-semibold';
        } else {
            feedback.textContent = '✗ Username already taken. Please choose another.';
            feedback.className   = 'text-xs ml-2 mt-1 text-red-500 font-semibold';
        }
    } catch {
        feedback.textContent = 'Could not check availability right now. You can still proceed.';
        feedback.className   = 'text-xs ml-2 mt-1 text-gray-400';
    }
};

// ─── Toggle password visibility ───────────────────────────────────────────────
window.togglePasswordVisibility = (inputId) => {
    const input   = document.getElementById(inputId);
    const iconKey = inputId === 'student-pass' ? 'student' : 'login';
    const eyeIcon = document.getElementById(`eye-icon-${iconKey}`);
    if (!input || !eyeIcon) return;
    input.type        = input.type === 'password' ? 'text' : 'password';
    eyeIcon.className = input.type === 'text' ? 'far fa-eye-slash' : 'far fa-eye';
};

// ─── Tab switching ────────────────────────────────────────────────────────────
window.switchTab = (tab) => {
    const activateTab    = document.getElementById('tab-activate');
    const loginTab       = document.getElementById('tab-login');
    const activationFlow = document.getElementById('activation-flow');
    const loginFlow      = document.getElementById('login-flow');
    if (!activateTab || !loginTab || !activationFlow || !loginFlow) return;

    if (tab === 'activate') {
        activateTab.classList.add('active');
        activateTab.classList.remove('text-gray-600');
        loginTab.classList.remove('active');
        loginTab.classList.add('text-gray-600');
        activationFlow.classList.remove('hidden-step');
        loginFlow.classList.add('hidden-step');
        document.getElementById('step-1')?.classList.remove('hidden-step');
        document.getElementById('step-2')?.classList.add('hidden-step');
        const pe = document.getElementById('parent-email');
        if (pe) pe.value = '';
        resetRateLimiting();
    } else {
        loginTab.classList.add('active');
        loginTab.classList.remove('text-gray-600');
        activateTab.classList.remove('active');
        activateTab.classList.add('text-gray-600');
        loginFlow.classList.remove('hidden-step');
        activationFlow.classList.add('hidden-step');
        const remembered = localStorage.getItem('student_login_id');
        const loginEl    = document.getElementById('login-identifier');
        if (remembered && loginEl) loginEl.value = remembered;
        resetRateLimiting();
    }
};

// ─── Go back to Step 1 ────────────────────────────────────────────────────────
window.goBackToStep1 = () => {
    document.getElementById('step-1')?.classList.remove('hidden-step');
    document.getElementById('step-2')?.classList.add('hidden-step');
};

// ─── Forgot password modal ────────────────────────────────────────────────────
window.showForgotPassword = () => {
    document.getElementById('forgot-password-modal')?.classList.remove('hidden-step');
};
window.hideForgotPassword = () => {
    document.getElementById('forgot-password-modal')?.classList.add('hidden-step');
    const el = document.getElementById('reset-identifier');
    if (el) el.value = '';
};

// ─── FIND STUDENTS (Step 1) ───────────────────────────────────────────────────
window.findStudents = async () => {
    if (checkRateLimit()) return;

    const email = document.getElementById('parent-email')?.value.trim() || '';
    if (!email) { showToast('Please enter the parent email.', 'error'); return; }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { showToast('Please enter a valid email address.', 'error'); return; }

    try {
        document.getElementById('find-profile-text')?.classList.add('hidden');
        document.getElementById('find-profile-loading')?.classList.remove('hidden');
        const btn = document.getElementById('find-profile-btn');
        if (btn) btn.disabled = true;

        const q  = query(collection(db, 'students'), where('parentEmail', '==', email));
        const qs = await getDocs(q);

        if (qs.empty) {
            // Generic — does not confirm whether the email is registered
            showToast('No student records found. Please check the email or contact your administrator.', 'error');
            failedAttempts++;
            lastAttemptTime = Date.now();
            return;
        }

        const select = document.getElementById('student-select');
        if (!select) return;
        select.innerHTML = '<option value="">Select your name</option>';
        let foundInactive = false;

        qs.forEach(d => {
            const data = d.data();
            if (!data.studentUid || data.status !== 'active') {
                const opt       = document.createElement('option');
                opt.value       = d.id;
                opt.textContent = data.studentName + (data.grade ? ` — Grade ${data.grade}` : '');
                select.appendChild(opt);
                foundInactive = true;
            }
        });

        if (foundInactive) {
            document.getElementById('step-1')?.classList.add('hidden-step');
            document.getElementById('step-2')?.classList.remove('hidden-step');
            showToast('Profile found! Please choose a username and create a password.', 'success');
        } else {
            showToast('All students under this email are already activated. Please login instead.', 'info');
            window.switchTab('login');
        }
    } catch {
        showToast('An error occurred. Please try again.', 'error');
        failedAttempts++;
        lastAttemptTime = Date.now();
    } finally {
        document.getElementById('find-profile-text')?.classList.remove('hidden');
        document.getElementById('find-profile-loading')?.classList.add('hidden');
        const btn = document.getElementById('find-profile-btn');
        if (btn) btn.disabled = false;
    }
};

// ─── COMPLETE REGISTRATION (Step 2) ──────────────────────────────────────────
window.completeRegistration = async () => {
    // ── Consent must be first ─────────────────────────────────────────────────
    if (!document.getElementById('student-privacy-consent')?.checked) {
        showToast('Please read and accept the Privacy Policy to continue.', 'error');
        return;
    }

    const docId      = document.getElementById('student-select')?.value || '';
    const rawUser    = document.getElementById('student-username-input')?.value || '';
    const username   = sanitiseUsername(rawUser);
    const password   = document.getElementById('student-pass')?.value || '';
    const rememberMe = document.getElementById('remember-me-activation')?.checked || false;

    // ── Student selection ─────────────────────────────────────────────────────
    if (!docId) {
        showToast('Please select your name from the list.', 'error');
        return;
    }

    // ── Block @ symbol in username field ─────────────────────────────────────
    // Prevents anyone from registering with a real or internal email disguised as a username
    if (rawUser.includes('@')) {
        showToast('Username cannot contain the @ symbol. Please enter a plain username.', 'error');
        return;
    }

    // ── Username format ───────────────────────────────────────────────────────
    if (!username) {
        showToast('Please enter a username.', 'error');
        return;
    }
    if (!USERNAME_REGEX.test(username)) {
        showToast('Username must be 4–20 characters: letters, numbers and underscores only.', 'error');
        return;
    }

    // ── Password strength ─────────────────────────────────────────────────────
    const hasLength  = password.length >= 12;
    const hasUpper   = /[A-Z]/.test(password);
    const hasLower   = /[a-z]/.test(password);
    const hasNumber  = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    if (!hasLength || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        showToast('Please ensure your password meets all requirements.', 'error');
        return;
    }

    try {
        document.getElementById('activate-text')?.classList.add('hidden');
        document.getElementById('activate-loading')?.classList.remove('hidden');
        const btn = document.getElementById('activate-portal-btn');
        if (btn) btn.disabled = true;

        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

        // ── Username uniqueness check ─────────────────────────────────────────
        const uq  = query(collection(db, 'students'), where('username', '==', username));
        const uqs = await getDocs(uq);
        if (!uqs.empty) {
            showToast('That username is already taken. Please choose a different one.', 'error');
            return;
        }

        // ── Generate hidden email ─────────────────────────────────────────────
        const hiddenEmail = generateHiddenEmail(username);

        // ── Create Firebase Auth account ──────────────────────────────────────
        let userCred;
        try {
            userCred = await createUserWithEmailAndPassword(auth, hiddenEmail, password);
        } catch (authErr) {
            if (authErr.code === 'auth/email-already-in-use') {
                showToast('This username conflicts with an existing account. Please choose a different username or contact your administrator.', 'error');
            } else if (authErr.code === 'auth/weak-password') {
                showToast('Password is too weak. Please use a stronger password.', 'error');
            } else if (authErr.code === 'auth/network-request-failed') {
                showToast('Network error. Please check your connection and try again.', 'error');
            } else {
                showToast('Account creation failed. Please try again or contact your administrator.', 'error');
            }
            return;
        }

        const studentName = document.getElementById('student-select')
            ?.options[document.getElementById('student-select').selectedIndex]
            ?.text.split(' — ')[0] || '';

        // ── Update Firestore document ─────────────────────────────────────────
        try {
            await updateDoc(doc(db, 'students', docId), {
                studentUid:  userCred.user.uid,
                username:    username,
                hiddenEmail: hiddenEmail,
                loginType:   'username',
                status:      'active',
                activatedAt: serverTimestamp(),
                lastLogin:   serverTimestamp(),
                security: {
                    passwordChangedAt: serverTimestamp(),
                    mfaEnabled:        false
                }
            });
        } catch {
            showToast('Account created but profile save failed. Please contact your administrator with your chosen username so they can complete the setup.', 'error');
            return;
        }

        // ── Update Auth display name (non-critical) ───────────────────────────
        try {
            await updateProfile(userCred.user, { displayName: studentName });
        } catch {
            // Non-critical — does not affect login
        }

        // ── Audit log ─────────────────────────────────────────────────────────
        await writeAuditLog({
            action:    'student_activation',
            studentId: docId,
            loginType: 'username'
            // username not logged — minimise data exposure
        });

        // ── Clear sensitive fields ────────────────────────────────────────────
        const passEl = document.getElementById('student-pass');
        if (passEl) passEl.value = '';

        if (rememberMe) {
            localStorage.setItem('student_remember_me', 'true');
            localStorage.setItem('student_login_id', username);
        }

        showToast('Account activated! Redirecting to your portal...', 'success');
        setTimeout(() => { window.location.href = 'bkhstudentportal.html'; }, 2000);

    } finally {
        document.getElementById('activate-text')?.classList.remove('hidden');
        document.getElementById('activate-loading')?.classList.add('hidden');
        const btn = document.getElementById('activate-portal-btn');
        if (btn) btn.disabled = false;
    }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
// Single field accepts both email (existing students) and username (new students).
// Never reveals which part of the credential failed.
window.loginStudent = async () => {
    if (checkRateLimit()) return;

    const identifier = document.getElementById('login-identifier')?.value.trim() || '';
    const password   = document.getElementById('login-password')?.value || '';
    const rememberMe = document.getElementById('remember-me-login')?.checked || false;

    if (!identifier || !password) {
        showToast('Please enter your username (or email) and password.', 'error');
        return;
    }

    try {
        document.getElementById('login-text')?.classList.add('hidden');
        document.getElementById('login-loading')?.classList.remove('hidden');
        const btn = document.getElementById('login-portal-btn');
        if (btn) btn.disabled = true;

        await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);

        const isEmail = identifier.includes('@');
        let loginEmail;

        if (isEmail) {
            // Existing email-based student — sign in directly
            loginEmail = identifier;
        } else {
            // Username-based student — look up hidden email in Firestore
            const username = sanitiseUsername(identifier);
            const uq  = query(collection(db, 'students'), where('username', '==', username));
            const uqs = await getDocs(uq);

            if (uqs.empty || !uqs.docs[0].data().hiddenEmail) {
                // Generic failure — never confirm whether username exists
                recordLoginFailure();
                showLoginError();
                shakeLoginForm();
                return;
            }
            loginEmail = uqs.docs[0].data().hiddenEmail;
        }

        // ── Firebase Auth sign-in ─────────────────────────────────────────────
        let userCred;
        try {
            userCred = await signInWithEmailAndPassword(auth, loginEmail, password);
        } catch (authErr) {
            recordLoginFailure();
            if (authErr.code === 'auth/too-many-requests') {
                showToast('Too many failed attempts. Account temporarily locked by Firebase.', 'error');
            } else if (authErr.code === 'auth/user-disabled') {
                showToast('This account has been disabled. Please contact your administrator.', 'error');
            } else if (authErr.code === 'auth/network-request-failed') {
                showToast('Network error. Please check your connection and try again.', 'error');
            } else {
                showLoginError();
            }
            shakeLoginForm();
            return;
        }

        // ── Verify in Firestore ───────────────────────────────────────────────
        const q  = query(collection(db, 'students'), where('studentUid', '==', userCred.user.uid));
        const qs = await getDocs(q);

        if (qs.empty) {
            await signOut(auth);
            recordLoginFailure();
            showLoginError();
            shakeLoginForm();
            return;
        }

        // ── Update last login ─────────────────────────────────────────────────
        const studentDoc = qs.docs[0];
        try {
            await updateDoc(doc(db, 'students', studentDoc.id), {
                lastLogin: serverTimestamp()
            });
        } catch {
            // Non-critical
        }

        // ── Audit log ─────────────────────────────────────────────────────────
        await writeAuditLog({
            action:     'student_login',
            studentId:  studentDoc.id,
            loginType:  isEmail ? 'email' : 'username',
            rememberMe: rememberMe
        });

        // ── Persist login identifier ──────────────────────────────────────────
        if (rememberMe) {
            localStorage.setItem('student_remember_me', 'true');
            localStorage.setItem('student_login_id', identifier);
        } else {
            localStorage.removeItem('student_remember_me');
            localStorage.removeItem('student_login_id');
        }

        failedAttempts = 0;
        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => { window.location.href = 'bkhstudentportal.html'; }, 1500);

    } finally {
        document.getElementById('login-text')?.classList.remove('hidden');
        document.getElementById('login-loading')?.classList.add('hidden');
        const btn = document.getElementById('login-portal-btn');
        if (btn) btn.disabled = false;
    }
};

// ─── Login failure helpers ────────────────────────────────────────────────────
function recordLoginFailure() {
    failedAttempts++;
    lastAttemptTime = Date.now();
    const remaining = MAX_ATTEMPTS - failedAttempts;
    const msgEl     = document.getElementById('failed-attempts-message');
    const warnEl    = document.getElementById('failed-attempts-warning');
    if (msgEl && warnEl) {
        msgEl.textContent = remaining > 0
            ? `Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.`
            : 'Account locked. Please wait 15 minutes or use Forgot Password.';
        warnEl.classList.remove('hidden');
    }
}

function showLoginError() {
    // Single generic message for all credential failures — prevents enumeration
    showToast('Invalid username or password.', 'error');
}

function shakeLoginForm() {
    const el = document.getElementById('login-flow');
    if (!el) return;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
}

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
// Accepts email or username.
// Email students   → reset sent to their registered student email
// Username students → reset sent to the hidden internal email (only way Firebase allows it)
// In both cases the student is told to check with their parent.
// Same toast whether account found or not — prevents enumeration.
window.sendPasswordReset = async () => {
    const identifier = document.getElementById('reset-identifier')?.value.trim() || '';
    if (!identifier) {
        showToast('Please enter your username or email.', 'error');
        return;
    }

    try {
        document.getElementById('reset-text')?.classList.add('hidden');
        document.getElementById('reset-loading')?.classList.remove('hidden');
        const btn = document.getElementById('send-reset-btn');
        if (btn) btn.disabled = true;

        const isEmail = identifier.includes('@');
        let studentDoc = null;

        if (isEmail) {
            const q  = query(collection(db, 'students'), where('studentEmail', '==', identifier));
            const qs = await getDocs(q);
            if (!qs.empty) studentDoc = qs.docs[0];
        } else {
            const username = sanitiseUsername(identifier);
            const q  = query(collection(db, 'students'), where('username', '==', username));
            const qs = await getDocs(q);
            if (!qs.empty) studentDoc = qs.docs[0];
        }

        // Always show same message — whether found or not
        if (!studentDoc) {
            showToast('If that account exists, a reset link has been sent. Please ask your parent to check their email.', 'info');
            return;
        }

        const data      = studentDoc.data();
        const loginType = data.loginType || 'email';

        let resetTarget;
        if (loginType === 'email') {
            resetTarget = data.studentEmail;
        } else {
            resetTarget = data.hiddenEmail;
        }

        if (!resetTarget) {
            showToast('If that account exists, a reset link has been sent. Please ask your parent to check their email.', 'info');
            return;
        }

        // No continueUrl — avoids domain whitelist errors
        await sendPasswordResetEmail(auth, resetTarget);

        await writeAuditLog({
            action:    'password_reset_requested',
            loginType: loginType
        });

        showToast('A password reset link has been sent. Please ask your parent to check their email.', 'success');
        setTimeout(() => window.hideForgotPassword(), 2500);

    } catch (err) {
        if (err.code === 'auth/too-many-requests') {
            showToast('Too many reset attempts. Please try again later.', 'error');
        } else if (err.code === 'auth/network-request-failed') {
            showToast('Network error. Please check your connection.', 'error');
        } else {
            showToast('If that account exists, a reset link has been sent. Please ask your parent to check their email.', 'info');
        }
    } finally {
        document.getElementById('reset-text')?.classList.remove('hidden');
        document.getElementById('reset-loading')?.classList.add('hidden');
        const btn = document.getElementById('send-reset-btn');
        if (btn) btn.disabled = false;
    }
};

// ─── Expose to global scope ───────────────────────────────────────────────────
window.showToast                 = showToast;
window.checkPasswordStrength     = window.checkPasswordStrength;
window.checkUsernameAvailability = window.checkUsernameAvailability;
window.togglePasswordVisibility  = window.togglePasswordVisibility;
window.switchTab                 = window.switchTab;
window.goBackToStep1             = window.goBackToStep1;
window.showForgotPassword        = window.showForgotPassword;
window.hideForgotPassword        = window.hideForgotPassword;
window.findStudents              = window.findStudents;
window.completeRegistration      = window.completeRegistration;
window.loginStudent              = window.loginStudent;
window.sendPasswordReset         = window.sendPasswordReset;
