/**
 * tutor-auth.js — Blooming Kids House Tutor Portal
 *
 * Security model:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. PRE-APPROVED ALLOWLIST: An admin must add a tutor's email to the
 *    Firestore `approvedTutors/{email}` collection BEFORE they can sign up
 *    or log in. Unknown emails are rejected BEFORE any Firebase Auth call.
 *
 * 2. CROSS-TAB SAFETY: onAuthStateChanged only redirects after confirming
 *    the user has a `tutors/{uid}` document. A sign-in from a different
 *    Firebase portal on the same browser will NOT kick this session out.
 *
 * 3. REMEMBER ME: 30-day browserLocalPersistence. Without it: session only.
 *
 * 4. RATE LIMITING: 5 failed attempts → 15-minute client-side lockout.
 *
 * 5. INPUT SANITIZATION & VALIDATION on all fields.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REQUIRED FIRESTORE SECURITY RULES (set in Firebase Console):
 *
 *   match /approvedTutors/{email} {
 *     allow read: if true;        // client needs to check allowlist
 *     allow write: if false;      // only admin SDK / console
 *   }
 *   match /tutors/{uid} {
 *     allow read, write: if request.auth != null && request.auth.uid == uid;
 *   }
 *
 * ADMIN SETUP — add a tutor to the allowlist:
 *   In Firebase Console → Firestore → approvedTutors collection
 *   Add document with ID = tutor's email (lowercase), fields:
 *     { email: "jane@example.com", addedAt: <timestamp>, addedBy: "admin" }
 * ─────────────────────────────────────────────────────────────────────────────
 */

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
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const REMEMBER_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
const MAX_LOGIN_ATTEMPTS   = 5;
const LOCKOUT_DURATION_MS  = 15 * 60 * 1000;            // 15 minutes
const REMEMBER_KEY         = 'bkh_remember';
const ATTEMPT_KEY          = 'bkh_login_attempts';
const LOCKOUT_KEY          = 'bkh_lockout_until';
const PORTAL_ROLE          = 'tutor';

// ─── MAIN ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

    // DOM refs
    const signupSection       = document.getElementById('signupSection');
    const loginSection        = document.getElementById('loginSection');
    const signupForm          = document.getElementById('tutorSignupForm');
    const loginForm           = document.getElementById('tutorLoginForm');
    const showLoginLink       = document.getElementById('showLogin');
    const showSignupLink      = document.getElementById('showSignup');
    const forgotPasswordLink  = document.getElementById('forgotPasswordLink');
    const signupBtn           = document.getElementById('signupBtn');
    const loginBtn            = document.getElementById('loginBtn');
    const rememberCheckbox    = document.getElementById('rememberMe');
    const checkboxDisplay     = document.getElementById('checkboxDisplay');
    const signupPasswordInput = document.getElementById('signupPassword');
    const strengthFill        = document.getElementById('strengthFill');
    const strengthText        = document.getElementById('strengthText');
    const strengthWrap        = document.getElementById('strengthWrap');

    // ── Auth state listener ────────────────────────────────────────────────
    // Guard: only auto-redirect on the FIRST fire and only if the user is a
    // confirmed tutor. This prevents a sign-in from a different portal on
    // the same Firebase project from redirecting or logging out this session.
    let initialAuthCheckDone = false;

    onAuthStateChanged(auth, async (user) => {
        if (initialAuthCheckDone) return; // ignore subsequent fires
        initialAuthCheckDone = true;

        if (!user) return; // not signed in — stay on page

        // Confirm the signed-in user is actually a tutor in this portal
        const isTutor = await verifyTutorRole(user.uid);
        if (isTutor) {
            window.location.href = 'tutor.html';
        } else {
            // A different portal's user is signed in on this Firebase instance.
            // Sign them out silently so this auth page works cleanly.
            await auth.signOut().catch(() => {});
        }
    });

    // ── Message box ───────────────────────────────────────────────────────
    function showMessage(message, type = 'info') {
        const box  = document.getElementById('message-box');
        const icon = document.getElementById('msg-icon');
        const text = document.getElementById('msg-text');
        const icons = { error: '⚠️', success: '✅', info: 'ℹ️' };
        box.classList.remove('visible', 'error', 'success', 'info');
        icon.textContent = icons[type] ?? 'ℹ️';
        text.textContent = message;
        box.classList.add('visible', type);
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideMessage() {
        document.getElementById('message-box').classList.remove('visible');
    }

    // ── Section toggle ────────────────────────────────────────────────────
    function showSection(section) {
        hideMessage();
        const isLogin = section === 'login';
        signupSection.style.display = isLogin ? 'none' : 'block';
        loginSection.style.display  = isLogin ? 'block' : 'none';
        // Trigger re-animation
        const target = isLogin ? loginSection : signupSection;
        target.classList.remove('auth-section');
        void target.offsetWidth;
        target.classList.add('auth-section');
    }

    showLoginLink?.addEventListener('click',  e => { e.preventDefault(); showSection('login'); });
    showSignupLink?.addEventListener('click', e => { e.preventDefault(); showSection('signup'); });

    // ── Custom checkbox ───────────────────────────────────────────────────
    function toggleRemember() {
        rememberCheckbox.checked = !rememberCheckbox.checked;
        checkboxDisplay.classList.toggle('checked', rememberCheckbox.checked);
        checkboxDisplay.setAttribute('aria-checked', String(rememberCheckbox.checked));
    }
    checkboxDisplay?.addEventListener('click', toggleRemember);
    checkboxDisplay?.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleRemember(); }
    });

    // ── Password visibility toggle ────────────────────────────────────────
    function setupPwToggle(toggleId, inputId, openId, closedId) {
        const toggle = document.getElementById(toggleId);
        const input  = document.getElementById(inputId);
        const open   = document.getElementById(openId);
        const closed = document.getElementById(closedId);
        if (!toggle) return;
        toggle.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type           = show ? 'text' : 'password';
            open.style.display   = show ? 'none'  : 'block';
            closed.style.display = show ? 'block' : 'none';
        });
    }
    setupPwToggle('toggleSignupPw', 'signupPassword', 'eyeSignupOpen', 'eyeSignupClosed');
    setupPwToggle('toggleLoginPw',  'loginPassword',  'eyeLoginOpen',  'eyeLoginClosed');

    // ── Password strength meter ───────────────────────────────────────────
    signupPasswordInput?.addEventListener('input', () => {
        const val = signupPasswordInput.value;
        if (!val) { strengthWrap.style.display = 'none'; return; }
        strengthWrap.style.display = 'block';
        let score = 0;
        if (val.length >= 6)           score++;
        if (val.length >= 10)          score++;
        if (/\d/.test(val))            score++;
        if (/[A-Z]/.test(val))         score++;
        if (/[^a-zA-Z0-9]/.test(val)) score++;
        const levels = [
            { label: 'Very weak', color: '#e53e3e', width: '15%'  },
            { label: 'Weak',      color: '#e53e3e', width: '30%'  },
            { label: 'Fair',      color: '#dd6b20', width: '55%'  },
            { label: 'Good',      color: '#38a169', width: '75%'  },
            { label: 'Strong',    color: '#2f855a', width: '100%' },
        ];
        const lvl = levels[Math.min(score, 4)];
        strengthFill.style.width      = lvl.width;
        strengthFill.style.background = lvl.color;
        strengthText.textContent      = lvl.label;
        strengthText.style.color      = lvl.color;
    });

    // ── Rate limiting ─────────────────────────────────────────────────────
    const getAttempts   = () => parseInt(sessionStorage.getItem(ATTEMPT_KEY) ?? '0', 10);
    const getLockoutEnd = () => parseInt(sessionStorage.getItem(LOCKOUT_KEY) ?? '0', 10);
    const incAttempts   = () => sessionStorage.setItem(ATTEMPT_KEY, getAttempts() + 1);
    const resetAttempts = () => {
        sessionStorage.removeItem(ATTEMPT_KEY);
        sessionStorage.removeItem(LOCKOUT_KEY);
    };

    function isLockedOut() {
        const until = getLockoutEnd();
        if (!until) return false;
        if (Date.now() < until) return true;
        resetAttempts();
        return false;
    }

    // Returns true if now locked out after this attempt
    function handleFailedAttempt() {
        incAttempts();
        if (getAttempts() >= MAX_LOGIN_ATTEMPTS) {
            sessionStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_DURATION_MS));
            showMessage('Too many failed attempts. Please wait 15 minutes before trying again.', 'error');
            return true;
        }
        return false;
    }

    // ── Remember-me persistence ───────────────────────────────────────────
    function setRememberPreference(remember) {
        if (remember) {
            localStorage.setItem(REMEMBER_KEY, JSON.stringify({
                v:   true,
                exp: Date.now() + REMEMBER_DURATION_MS
            }));
        } else {
            localStorage.removeItem(REMEMBER_KEY);
        }
    }

    // ── Input sanitiser ───────────────────────────────────────────────────
    function sanitize(str) {
        return String(str ?? '').trim().replace(/[<>"'`\\]/g, '').substring(0, 320);
    }

    // ── Password validator ────────────────────────────────────────────────
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

    // ── Button loading state ──────────────────────────────────────────────
    function setButtonLoading(btn, loading) {
        if (!btn) return;
        btn.classList.toggle('loading', loading);
        btn.disabled = loading;
    }

    // ── Firebase error → friendly message ────────────────────────────────
    function friendlyError(code) {
        const map = {
            'auth/email-already-in-use':   'This email already has an account. Try logging in.',
            'auth/invalid-email':          'Please enter a valid email address.',
            'auth/weak-password':          'Choose a stronger password.',
            // Deliberately vague — don't reveal whether email exists
            'auth/user-not-found':         'Invalid email or password.',
            'auth/wrong-password':         'Invalid email or password.',
            'auth/invalid-credential':     'Invalid email or password.',
            'auth/too-many-requests':      'Too many attempts. Please wait and try again.',
            'auth/network-request-failed': 'Network error — check your connection.',
            'auth/user-disabled':          'This account has been disabled. Contact your administrator.',
        };
        return map[code] ?? 'Something went wrong. Please try again.';
    }

    // ── CORE: Allowlist check ─────────────────────────────────────────────
    /**
     * Looks up `approvedTutors/{normalisedEmail}` in Firestore.
     * Returns true only if the document exists.
     * Fails CLOSED — denies access if the network call fails.
     */
    async function isApprovedTutor(email) {
        try {
            const normalised = email.toLowerCase().trim();
            const snap = await getDoc(doc(db, 'approvedTutors', normalised));
            return snap.exists();
        } catch (err) {
            console.error('Allowlist check failed:', err);
            return false; // fail closed
        }
    }

    /**
     * Confirms a signed-in UID has a `tutors` document.
     * Used by onAuthStateChanged to guard cross-portal sessions.
     */
    async function verifyTutorRole(uid) {
        try {
            const snap = await getDoc(doc(db, 'tutors', uid));
            return snap.exists();
        } catch {
            return false;
        }
    }

    // ── SIGNUP ────────────────────────────────────────────────────────────
    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage();

        const name     = sanitize(document.getElementById('signupName').value);
        const email    = sanitize(document.getElementById('signupEmail').value).toLowerCase();
        const password = document.getElementById('signupPassword').value;

        if (!name || !email || !password) {
            showMessage('Please fill in all fields.', 'error');
            return;
        }
        if (!validatePassword(name, password)) return;

        setButtonLoading(signupBtn, true);
        showMessage('Verifying your details…', 'info');

        // ★ ALLOWLIST — checked before any Firebase Auth call
        const approved = await isApprovedTutor(email);
        if (!approved) {
            showMessage(
                'This email is not registered as a Blooming Kids House tutor. ' +
                'Please contact your administrator to be added.',
                'error'
            );
            setButtonLoading(signupBtn, false);
            return;
        }

        try {
            await setPersistence(auth, browserLocalPersistence);
            const { user } = await createUserWithEmailAndPassword(auth, email, password);

            await setDoc(doc(db, 'tutors', user.uid), {
                name,
                email,
                uid:       user.uid,
                role:      PORTAL_ROLE,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });

            setRememberPreference(true);
            showMessage('Account created! Redirecting to your portal…', 'success');
            setTimeout(() => { window.location.href = 'tutor.html'; }, 1200);
        } catch (error) {
            console.error('Signup error:', error.code);
            showMessage(friendlyError(error.code), 'error');
            setButtonLoading(signupBtn, false);
        }
    });

    // ── LOGIN ─────────────────────────────────────────────────────────────
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage();

        // Rate limit check
        if (isLockedOut()) {
            const mins = Math.ceil((getLockoutEnd() - Date.now()) / 60000);
            showMessage(`Too many failed attempts. Try again in ${mins} minute(s).`, 'error');
            return;
        }

        const email      = sanitize(document.getElementById('loginEmail').value).toLowerCase();
        const password   = document.getElementById('loginPassword').value;
        const rememberMe = rememberCheckbox.checked;

        if (!email || !password) {
            showMessage('Please enter your email and password.', 'error');
            return;
        }

        setButtonLoading(loginBtn, true);
        showMessage('Verifying your access…', 'info');

        // ★ ALLOWLIST — checked before any Firebase Auth call
        const approved = await isApprovedTutor(email);
        if (!approved) {
            showMessage(
                'This email is not registered as a Blooming Kids House tutor. ' +
                'Please contact your administrator.',
                'error'
            );
            handleFailedAttempt();
            setButtonLoading(loginBtn, false);
            return;
        }

        try {
            // Local persistence = stays signed in across all tabs of this portal.
            // Without "Remember Me" we use session persistence (closes with browser).
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);

            const { user } = await signInWithEmailAndPassword(auth, email, password);

            // Update last-login timestamp (non-critical, fire and forget)
            setDoc(doc(db, 'tutors', user.uid), { lastLogin: serverTimestamp() }, { merge: true })
                .catch(() => {});

            setRememberPreference(rememberMe);
            resetAttempts();
            window.location.href = 'tutor.html';
        } catch (error) {
            console.error('Login error:', error.code);
            const lockedNow = handleFailedAttempt();
            if (!lockedNow) {
                const left   = MAX_LOGIN_ATTEMPTS - getAttempts();
                const suffix = left > 0 ? ` (${left} attempt${left !== 1 ? 's' : ''} remaining)` : '';
                showMessage(friendlyError(error.code) + suffix, 'error');
            }
            setButtonLoading(loginBtn, false);
        }
    });

    // ── FORGOT PASSWORD ───────────────────────────────────────────────────
    forgotPasswordLink?.addEventListener('click', async (e) => {
        e.preventDefault();
        hideMessage();

        const email = sanitize(document.getElementById('loginEmail').value).toLowerCase();
        if (!email) {
            showMessage('Enter your email address above, then click "Forgot Password".', 'error');
            return;
        }

        // Check allowlist — but always respond generically so we don't reveal
        // whether a given email exists in our system.
        const approved = await isApprovedTutor(email);
        if (approved) {
            try {
                await sendPasswordResetEmail(auth, email);
            } catch (err) {
                console.error('Password reset error:', err.code);
            }
        }

        // Always show the same message regardless of outcome
        showMessage(
            'If this email is registered with us, a reset link has been sent. ' +
            'Check your inbox and spam folder.',
            'success'
        );
    });

});
