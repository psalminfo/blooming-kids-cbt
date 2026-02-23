import { auth, db } from './firebaseConfig.js';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    sendPasswordResetEmail,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ─── CONSTANTS ──────────────────────────────────────────────────────────────
const REMEMBER_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_LOGIN_ATTEMPTS   = 5;
const LOCKOUT_DURATION_MS  = 15 * 60 * 1000; // 15 minutes
const REMEMBER_KEY         = 'bkh_remember';
const ATTEMPT_KEY          = 'bkh_attempts';
const LOCKOUT_KEY          = 'bkh_lockout';

// ─── DOM ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const signupSection     = document.getElementById('signupSection');
    const loginSection      = document.getElementById('loginSection');
    const signupForm        = document.getElementById('tutorSignupForm');
    const loginForm         = document.getElementById('tutorLoginForm');
    const showLoginLink     = document.getElementById('showLogin');
    const showSignupLink    = document.getElementById('showSignup');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const signupBtn         = document.getElementById('signupBtn');
    const loginBtn          = document.getElementById('loginBtn');
    const rememberCheckbox  = document.getElementById('rememberMe');
    const checkboxDisplay   = document.getElementById('checkboxDisplay');
    const signupPasswordInput = document.getElementById('signupPassword');
    const strengthFill      = document.getElementById('strengthFill');
    const strengthText      = document.getElementById('strengthText');
    const strengthWrap      = document.getElementById('strengthWrap');

    // ─── MESSAGE BOX ────────────────────────────────────────────────────────
    function showMessage(message, type = 'info') {
        const box   = document.getElementById('message-box');
        const icon  = document.getElementById('msg-icon');
        const text  = document.getElementById('msg-text');

        box.classList.remove('visible', 'error', 'success', 'info');
        const icons = { error: '⚠️', success: '✅', info: 'ℹ️' };
        icon.textContent = icons[type] || 'ℹ️';
        text.textContent = message;
        box.classList.add('visible', type);

        // Auto-scroll to message
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideMessage() {
        document.getElementById('message-box').classList.remove('visible');
    }

    // ─── SECTION TOGGLE ─────────────────────────────────────────────────────
    function showSection(section) {
        hideMessage();
        if (section === 'login') {
            signupSection.style.display = 'none';
            loginSection.style.display  = 'block';
            loginSection.classList.remove('auth-section');
            void loginSection.offsetWidth;
            loginSection.classList.add('auth-section');
        } else {
            loginSection.style.display  = 'none';
            signupSection.style.display = 'block';
            signupSection.classList.remove('auth-section');
            void signupSection.offsetWidth;
            signupSection.classList.add('auth-section');
        }
    }

    showLoginLink?.addEventListener('click', e => { e.preventDefault(); showSection('login'); });
    showSignupLink?.addEventListener('click', e => { e.preventDefault(); showSection('signup'); });

    // ─── CUSTOM CHECKBOX ────────────────────────────────────────────────────
    function toggleRemember() {
        rememberCheckbox.checked = !rememberCheckbox.checked;
        checkboxDisplay.classList.toggle('checked', rememberCheckbox.checked);
        checkboxDisplay.setAttribute('aria-checked', rememberCheckbox.checked.toString());
    }
    checkboxDisplay?.addEventListener('click', toggleRemember);
    checkboxDisplay?.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleRemember(); } });

    // ─── PASSWORD VISIBILITY TOGGLE ─────────────────────────────────────────
    function setupPwToggle(toggleId, inputId, openEyeId, closedEyeId) {
        const toggle = document.getElementById(toggleId);
        const input  = document.getElementById(inputId);
        const open   = document.getElementById(openEyeId);
        const closed = document.getElementById(closedEyeId);
        if (!toggle) return;
        toggle.addEventListener('click', () => {
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            open.style.display   = isPassword ? 'none'  : 'block';
            closed.style.display = isPassword ? 'block' : 'none';
        });
    }
    setupPwToggle('toggleSignupPw', 'signupPassword', 'eyeSignupOpen', 'eyeSignupClosed');
    setupPwToggle('toggleLoginPw',  'loginPassword',  'eyeLoginOpen',  'eyeLoginClosed');

    // ─── PASSWORD STRENGTH ──────────────────────────────────────────────────
    signupPasswordInput?.addEventListener('input', () => {
        const val = signupPasswordInput.value;
        if (!val) { strengthWrap.style.display = 'none'; return; }
        strengthWrap.style.display = 'block';
        let score = 0;
        if (val.length >= 6)  score++;
        if (val.length >= 10) score++;
        if (/\d/.test(val))   score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[^a-zA-Z0-9]/.test(val)) score++;
        const levels = [
            { label: 'Very weak', color: '#e53e3e', width: '15%' },
            { label: 'Weak',      color: '#e53e3e', width: '30%' },
            { label: 'Fair',      color: '#dd6b20', width: '55%' },
            { label: 'Good',      color: '#38a169', width: '75%' },
            { label: 'Strong',    color: '#2f855a', width: '100%' },
        ];
        const level = levels[Math.min(score, 4)];
        strengthFill.style.width      = level.width;
        strengthFill.style.background = level.color;
        strengthText.textContent      = level.label;
        strengthText.style.color      = level.color;
    });

    // ─── RATE LIMITING ──────────────────────────────────────────────────────
    function getAttempts()  { return parseInt(sessionStorage.getItem(ATTEMPT_KEY) || '0', 10); }
    function getLockout()   { return parseInt(sessionStorage.getItem(LOCKOUT_KEY) || '0', 10); }
    function incAttempts()  { sessionStorage.setItem(ATTEMPT_KEY, getAttempts() + 1); }
    function resetAttempts(){ sessionStorage.removeItem(ATTEMPT_KEY); sessionStorage.removeItem(LOCKOUT_KEY); }

    function isLockedOut() {
        const lockoutUntil = getLockout();
        if (!lockoutUntil) return false;
        if (Date.now() < lockoutUntil) return true;
        resetAttempts();
        return false;
    }

    function handleFailedAttempt() {
        incAttempts();
        const attempts = getAttempts();
        if (attempts >= MAX_LOGIN_ATTEMPTS) {
            const until = Date.now() + LOCKOUT_DURATION_MS;
            sessionStorage.setItem(LOCKOUT_KEY, until.toString());
            showMessage(`Too many failed attempts. Please try again in 15 minutes.`, 'error');
            return true;
        }
        return false;
    }

    // ─── REMEMBER ME PERSISTENCE ────────────────────────────────────────────
    // Store remember preference securely with expiry
    function setRememberPreference(remember) {
        if (remember) {
            const expiry = Date.now() + REMEMBER_DURATION_MS;
            localStorage.setItem(REMEMBER_KEY, JSON.stringify({ v: true, exp: expiry }));
        } else {
            localStorage.removeItem(REMEMBER_KEY);
        }
    }

    function getRememberPreference() {
        try {
            const raw = localStorage.getItem(REMEMBER_KEY);
            if (!raw) return false;
            const { v, exp } = JSON.parse(raw);
            if (Date.now() > exp) { localStorage.removeItem(REMEMBER_KEY); return false; }
            return v;
        } catch { return false; }
    }

    // ─── AUTH STATE: Keep user signed in across tabs ─────────────────────────
    // Firebase handles cross-tab persistence automatically when using
    // browserLocalPersistence — we just need to set it before any sign-in.
    // On page load, if already authenticated, redirect immediately.
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is already signed in (same or another tab opened portal)
            window.location.href = 'tutor.html';
        }
    });

    // ─── VALIDATION ─────────────────────────────────────────────────────────
    function validatePassword(name, password) {
        if (password.length < 6) {
            showMessage('Password must be at least 6 characters long.', 'error');
            return false;
        }
        if (!/\d/.test(password)) {
            showMessage('Password must contain at least one number.', 'error');
            return false;
        }
        if (name && password.toLowerCase().includes(name.toLowerCase())) {
            showMessage('Password should not contain your name.', 'error');
            return false;
        }
        return true;
    }

    function sanitize(str) {
        return str.trim().replace(/[<>]/g, '');
    }

    // ─── SIGNUP ─────────────────────────────────────────────────────────────
    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage();

        const name     = sanitize(document.getElementById('signupName').value);
        const email    = sanitize(document.getElementById('signupEmail').value);
        const password = document.getElementById('signupPassword').value;

        if (!name || !email || !password) {
            showMessage('Please fill in all fields.', 'error');
            return;
        }

        if (!validatePassword(name, password)) return;

        setButtonLoading(signupBtn, true);

        try {
            // Always use local persistence so user stays in
            await setPersistence(auth, browserLocalPersistence);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, "tutors", user.uid), {
                name:      name,
                email:     email,
                uid:       user.uid,
                createdAt: serverTimestamp()
            });

            setRememberPreference(true);
            showMessage('Account created! Redirecting to your portal…', 'success');

            setTimeout(() => { window.location.href = 'tutor.html'; }, 1200);
        } catch (error) {
            console.error('Signup error:', error);
            showMessage(friendlyError(error.code), 'error');
            setButtonLoading(signupBtn, false);
        }
    });

    // ─── LOGIN ──────────────────────────────────────────────────────────────
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage();

        if (isLockedOut()) {
            const remaining = Math.ceil((getLockout() - Date.now()) / 60000);
            showMessage(`Account temporarily locked. Try again in ${remaining} minute(s).`, 'error');
            return;
        }

        const email      = sanitize(document.getElementById('loginEmail').value);
        const password   = document.getElementById('loginPassword').value;
        const rememberMe = rememberCheckbox.checked;

        if (!email || !password) {
            showMessage('Please enter your email and password.', 'error');
            return;
        }

        setButtonLoading(loginBtn, true);

        try {
            // Use local persistence to keep user signed in across browser tabs
            // and across sessions when remember me is checked.
            // Even without "remember me", local persistence keeps the tab alive.
            // Session persistence would log out when tab is closed.
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);

            await signInWithEmailAndPassword(auth, email, password);

            setRememberPreference(rememberMe);
            resetAttempts();

            // Redirect — onAuthStateChanged will also fire in other open tabs
            window.location.href = 'tutor.html';
        } catch (error) {
            console.error('Login error:', error);
            const locked = handleFailedAttempt();
            if (!locked) {
                const remaining = MAX_LOGIN_ATTEMPTS - getAttempts();
                const msg = remaining > 0
                    ? `${friendlyError(error.code)} (${remaining} attempt${remaining !== 1 ? 's' : ''} remaining)`
                    : friendlyError(error.code);
                showMessage(msg, 'error');
            }
            setButtonLoading(loginBtn, false);
        }
    });

    // ─── FORGOT PASSWORD ────────────────────────────────────────────────────
    forgotPasswordLink?.addEventListener('click', async (e) => {
        e.preventDefault();
        hideMessage();

        const email = sanitize(document.getElementById('loginEmail').value);
        if (!email) {
            showMessage('Enter your email address above, then click "Forgot Password".', 'error');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            showMessage('A password reset link has been sent — check your inbox (and spam).', 'success');
        } catch (error) {
            console.error('Password reset error:', error);
            // Don't reveal whether email exists — generic message
            showMessage('If an account exists for this email, a reset link has been sent.', 'info');
        }
    });

    // ─── HELPERS ────────────────────────────────────────────────────────────
    function setButtonLoading(btn, loading) {
        if (!btn) return;
        if (loading) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    function friendlyError(code) {
        const map = {
            'auth/email-already-in-use':    'This email is already registered. Try logging in.',
            'auth/invalid-email':           'Please enter a valid email address.',
            'auth/weak-password':           'Your password is too weak. Please choose a stronger one.',
            'auth/user-not-found':          'No account found with this email.',
            'auth/wrong-password':          'Incorrect password. Please try again.',
            'auth/invalid-credential':      'Invalid email or password.',
            'auth/too-many-requests':       'Too many attempts. Please wait a moment and try again.',
            'auth/network-request-failed':  'Network error. Please check your connection.',
            'auth/user-disabled':           'This account has been disabled. Contact support.',
        };
        return map[code] || 'Something went wrong. Please try again.';
    }
});
