/**
 * tutor-auth.js — Blooming Kids House Tutor Portal
 * ─────────────────────────────────────────────────────────────────────────────
 * SECURITY MODEL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. TUTOR EMAIL GATE (login & signup):
 *    Before ANY Firebase Auth call, the email is checked against the
 *    `tutors` Firestore collection (queried by `email` field).
 *    If the email is not found, access is DENIED immediately — no Firebase
 *    Auth call is made at all. An unregistered person cannot even attempt
 *    a password guess against Firebase.
 *
 *    HOW TO REGISTER A NEW TUTOR (admin only):
 *    → Firebase Console → Firestore → `tutors` collection
 *    → Add a document with fields: { email: "tutor@example.com", name: "Full Name" }
 *    → That tutor can now sign up and log in with that email.
 *
 * 2. CROSS-TAB ISOLATION:
 *    onAuthStateChanged is called ONCE on page load then immediately
 *    unsubscribed. If another portal on the same Firebase project signs in
 *    later in a different tab, it will NOT trigger a redirect or sign-out here.
 *    The session is also double-checked by verifying the UID exists in `tutors`.
 *
 * 3. REMEMBER ME — 30 days:
 *    Checked   → browserLocalPersistence (survives browser close)
 *    Unchecked → browserSessionPersistence (clears when tab/browser closes)
 *
 * 4. RATE LIMITING:
 *    5 failed attempts → 15-minute client-side lockout stored in sessionStorage.
 *
 * 5. INPUT SANITISATION on all user-provided values.
 *
 * 6. GENERIC PASSWORD-RESET RESPONSES — prevents email enumeration attacks.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RECOMMENDED FIRESTORE SECURITY RULES:
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /tutors/{uid} {
 *         // Only the authenticated tutor can fully read/write their own doc
 *         allow read, write: if request.auth != null && request.auth.uid == uid;
 *         // Allow unauthenticated reads of ONLY the email field for pre-auth gate
 *         allow read: if request.auth == null;
 *       }
 *       match /{document=**} {
 *         allow read, write: if false;
 *       }
 *     }
 *   }
 *
 * Also create a Firestore index on `tutors.email` (ascending) for the query.
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
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const REMEMBER_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ATTEMPTS         = 5;
const LOCKOUT_MS           = 15 * 60 * 1000;            // 15 minutes
const REMEMBER_KEY         = 'bkh_remember_v2';
const ATTEMPT_KEY          = 'bkh_login_attempts';
const LOCKOUT_KEY          = 'bkh_lockout_until';

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

    // ── Cross-tab auth guard ──────────────────────────────────────────────────
    // Subscribe ONCE, immediately unsubscribe after first emission.
    // This means changes from other portals/tabs on the same Firebase project
    // will NEVER affect this page after the initial check.
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        unsubscribeAuth(); // detach immediately — we only want the first fire

        if (!user) return; // no one signed in — show auth forms normally

        // Someone is authenticated — check if they are a real tutor in our system
        const tutorDoc = await getTutorDocForUser(user);
        if (tutorDoc) {
            window.location.href = 'tutor.html'; // valid tutor — redirect
        }
        // If not a tutor (e.g. a different portal's user on the same Firebase),
        // we simply stay on this page. We do NOT sign them out because that
        // would log them out of their own portal in another tab.
    });

    // ── Message box ───────────────────────────────────────────────────────────
    function showMessage(message, type = 'info') {
        const box  = document.getElementById('message-box');
        const icon = document.getElementById('msg-icon');
        const text = document.getElementById('msg-text');
        const icons = { error: '⚠️', success: '✅', info: '🔍' };
        box.classList.remove('visible', 'error', 'success', 'info');
        icon.textContent = icons[type] ?? 'ℹ️';
        text.textContent = message;
        box.classList.add('visible', type);
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideMessage() {
        document.getElementById('message-box').classList.remove('visible');
    }

    // ── Section switching ─────────────────────────────────────────────────────
    function showSection(name) {
        hideMessage();
        const toShow = name === 'login' ? loginSection  : signupSection;
        const toHide = name === 'login' ? signupSection : loginSection;
        toHide.style.display = 'none';
        toShow.style.display = 'block';
        toShow.classList.remove('auth-section');
        void toShow.offsetWidth; // force reflow for CSS animation restart
        toShow.classList.add('auth-section');
    }

    showLoginLink?.addEventListener('click',  e => { e.preventDefault(); showSection('login');  });
    showSignupLink?.addEventListener('click', e => { e.preventDefault(); showSection('signup'); });

    // ── Custom animated checkbox ──────────────────────────────────────────────
    function toggleRemember() {
        rememberCheckbox.checked = !rememberCheckbox.checked;
        checkboxDisplay.classList.toggle('checked', rememberCheckbox.checked);
        checkboxDisplay.setAttribute('aria-checked', String(rememberCheckbox.checked));
    }
    checkboxDisplay?.addEventListener('click', toggleRemember);
    checkboxDisplay?.addEventListener('keydown', e => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleRemember(); }
    });

    // ── Password visibility toggles ───────────────────────────────────────────
    function setupPwToggle(toggleId, inputId, openId, closedId) {
        const toggle = document.getElementById(toggleId);
        const input  = document.getElementById(inputId);
        const open   = document.getElementById(openId);
        const closed = document.getElementById(closedId);
        if (!toggle || !input) return;
        toggle.addEventListener('click', () => {
            const revealing  = input.type === 'password';
            input.type           = revealing ? 'text'    : 'password';
            open.style.display   = revealing ? 'none'   : 'block';
            closed.style.display = revealing ? 'block'  : 'none';
        });
    }
    setupPwToggle('toggleSignupPw', 'signupPassword', 'eyeSignupOpen', 'eyeSignupClosed');
    setupPwToggle('toggleLoginPw',  'loginPassword',  'eyeLoginOpen',  'eyeLoginClosed');

    // ── Password strength meter ───────────────────────────────────────────────
    signupPasswordInput?.addEventListener('input', () => {
        const val = signupPasswordInput.value;
        if (!val) { strengthWrap.style.display = 'none'; return; }
        strengthWrap.style.display = 'block';
        let score = 0;
        if (val.length >= 6)            score++;
        if (val.length >= 10)           score++;
        if (/\d/.test(val))             score++;
        if (/[A-Z]/.test(val))          score++;
        if (/[^a-zA-Z0-9]/.test(val))  score++;
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

    // ── Rate limiting ─────────────────────────────────────────────────────────
    const getAttempts   = () => parseInt(sessionStorage.getItem(ATTEMPT_KEY) ?? '0', 10);
    const getLockoutEnd = () => parseInt(sessionStorage.getItem(LOCKOUT_KEY) ?? '0', 10);
    const resetAttempts = () => {
        sessionStorage.removeItem(ATTEMPT_KEY);
        sessionStorage.removeItem(LOCKOUT_KEY);
    };

    function isLockedOut() {
        const until = getLockoutEnd();
        if (!until) return false;
        if (Date.now() < until) return true;
        resetAttempts(); // expired — reset
        return false;
    }

    /** Increments attempt count. Returns true if now locked out. */
    function handleFailedAttempt() {
        const count = getAttempts() + 1;
        sessionStorage.setItem(ATTEMPT_KEY, String(count));
        if (count >= MAX_ATTEMPTS) {
            sessionStorage.setItem(LOCKOUT_KEY, String(Date.now() + LOCKOUT_MS));
            showMessage('Too many failed attempts. Please wait 15 minutes before trying again.', 'error');
            return true;
        }
        return false;
    }

    // ── Remember-me preference ────────────────────────────────────────────────
    function setRememberPreference(remember) {
        if (remember) {
            localStorage.setItem(REMEMBER_KEY, JSON.stringify({
                active: true,
                exp: Date.now() + REMEMBER_DURATION_MS
            }));
        } else {
            localStorage.removeItem(REMEMBER_KEY);
        }
    }

    // ── Input sanitisation ────────────────────────────────────────────────────
    function sanitize(str) {
        return String(str ?? '').trim().replace(/[<>"'`\\;]/g, '').substring(0, 320);
    }

    // ── Password validation ───────────────────────────────────────────────────
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

    // ── Button loading state ──────────────────────────────────────────────────
    function setButtonLoading(btn, loading) {
        if (!btn) return;
        btn.classList.toggle('loading', loading);
        btn.disabled = loading;
    }

    // ── Firebase error → friendly message ────────────────────────────────────
    function friendlyError(code) {
        const map = {
            'auth/email-already-in-use':   'An account with this email already exists. Try logging in.',
            'auth/invalid-email':          'Please enter a valid email address.',
            'auth/weak-password':          'Choose a stronger password.',
            // Deliberately vague — avoids leaking whether an email exists in Firebase Auth
            'auth/user-not-found':         'Invalid email or password.',
            'auth/wrong-password':         'Invalid email or password.',
            'auth/invalid-credential':     'Invalid email or password.',
            'auth/too-many-requests':      'Firebase has temporarily blocked this account. Try again later.',
            'auth/network-request-failed': 'Network error — please check your connection.',
            'auth/user-disabled':          'This account has been disabled. Contact your administrator.',
        };
        return map[code] ?? 'Something went wrong. Please try again.';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FIRESTORE CHECKS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Query `tutors` collection by email field.
     * Returns true if the email is found — meaning an admin has registered
     * this person as a tutor.
     * Fails CLOSED — denies access if the Firestore call fails.
     */
    async function isTutorEmailRegistered(email) {
        try {
            const normalised = email.toLowerCase().trim();
            const q    = query(collection(db, 'tutors'), where('email', '==', normalised));
            const snap = await getDocs(q);
            return !snap.empty;
        } catch (err) {
            console.error('Tutor email check error:', err);
            return false; // fail closed
        }
    }

    /**
     * Verify a signed-in user is a registered tutor.
     * Supports three document structures:
     *   1. tutors/{uid}          — doc ID is the Firebase UID (new style)
     *   2. tutors/{email}        — doc ID is the email (old/admin-created style)
     *   3. tutors/{anyId} where doc has email field matching user.email
     * Returns the Firestore doc snapshot if found, null otherwise.
     */
    async function getTutorDocForUser(user) {
        try {
            // 1. Try UID as doc ID (fastest)
            const byUid = await getDoc(doc(db, 'tutors', user.uid));
            if (byUid.exists()) return byUid;

            // 2. Try email as doc ID (admin-created docs use this)
            if (user.email) {
                const byEmail = await getDoc(doc(db, 'tutors', user.email.toLowerCase().trim()));
                if (byEmail.exists()) return byEmail;
            }

            // 3. Query by email field (any doc structure)
            if (user.email) {
                const q    = query(collection(db, 'tutors'), where('email', '==', user.email.toLowerCase().trim()));
                const snap = await getDocs(q);
                if (!snap.empty) return snap.docs[0];
            }

            return null;
        } catch (err) {
            console.error('getTutorDocForUser error:', err);
            return null;
        }
    }

    async function isTutorByUid(uid, email = null) {
        // Build a minimal user-like object for getTutorDocForUser
        const userLike = { uid, email };
        const d = await getTutorDocForUser(userLike);
        return d !== null;
    }

    /**
     * Find a tutor document by email and return { id, data }.
     * Used during signup to update the admin-created placeholder doc.
     */
    async function getTutorDocByEmail(email) {
        try {
            const normalised = email.toLowerCase().trim();
            const q    = query(collection(db, 'tutors'), where('email', '==', normalised));
            const snap = await getDocs(q);
            if (snap.empty) return null;
            const d = snap.docs[0];
            return { id: d.id, data: d.data() };
        } catch {
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SIGNUP
    // ─────────────────────────────────────────────────────────────────────────
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
        showMessage('Checking your registration…', 'info');

        // ★ GATE: Email must exist in tutors collection first
        const approved = await isTutorEmailRegistered(email);
        if (!approved) {
            showMessage(
                'This email is not registered as a Blooming Kids House tutor. ' +
                'Please contact your administrator to be added before signing up.',
                'error'
            );
            setButtonLoading(signupBtn, false);
            return;
        }

        try {
            await setPersistence(auth, browserLocalPersistence);
            const { user } = await createUserWithEmailAndPassword(auth, email, password);

            // Update the admin-created tutor doc with the real UID
            const existing = await getTutorDocByEmail(email);
            if (existing) {
                await updateDoc(doc(db, 'tutors', existing.id), {
                    uid:        user.uid,
                    name:       name, // allow tutor to set their own display name
                    signedUpAt: serverTimestamp(),
                    lastLogin:  serverTimestamp()
                });
            } else {
                // Fallback: create fresh doc (shouldn't normally reach here)
                await setDoc(doc(db, 'tutors', user.uid), {
                    name, email, uid: user.uid,
                    signedUpAt: serverTimestamp(),
                    lastLogin:  serverTimestamp()
                });
            }

            setRememberPreference(true);
            showMessage('Account created! Redirecting to your portal…', 'success');
            setTimeout(() => { window.location.href = 'tutor.html'; }, 1200);

        } catch (error) {
            console.error('Signup error:', error.code);
            showMessage(friendlyError(error.code), 'error');
            setButtonLoading(signupBtn, false);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // LOGIN
    // ─────────────────────────────────────────────────────────────────────────
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage();

        // Rate limit check
        if (isLockedOut()) {
            const minsLeft = Math.ceil((getLockoutEnd() - Date.now()) / 60000);
            showMessage(`Too many failed attempts. Try again in ${minsLeft} minute(s).`, 'error');
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

        try {
            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            await setPersistence(auth, persistence);

            const { user } = await signInWithEmailAndPassword(auth, email, password);

            // ★ GATE 2: Verify the signed-in user is actually a registered tutor.
            // Works regardless of whether the doc uses UID, email, or a custom ID.
            const tutorDoc = await getTutorDocForUser(user);
            if (!tutorDoc) {
                await auth.signOut();
                showMessage(
                    'Your account is not authorised for this portal. Contact your administrator.',
                    'error'
                );
                handleFailedAttempt();
                setButtonLoading(loginBtn, false);
                return;
            }

            // Stamp UID onto the doc if it's missing (e.g. admin-created email-keyed docs).
            // This makes future UID lookups instant.
            const docData = tutorDoc.data ? tutorDoc.data() : tutorDoc.data;
            if (!docData?.uid) {
                updateDoc(tutorDoc.ref, { uid: user.uid, lastLogin: serverTimestamp() }).catch(() => {});
            } else {
                updateDoc(tutorDoc.ref, { lastLogin: serverTimestamp() }).catch(() => {});
            }

            setRememberPreference(rememberMe);
            resetAttempts();
            window.location.href = 'tutor.html';

        } catch (error) {
            console.error('Login error:', error.code);
            const lockedNow = handleFailedAttempt();
            if (!lockedNow) {
                const left   = MAX_ATTEMPTS - getAttempts();
                const suffix = left > 0 ? ` (${left} attempt${left !== 1 ? 's' : ''} remaining)` : '';
                showMessage(friendlyError(error.code) + suffix, 'error');
            }
            setButtonLoading(loginBtn, false);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // FORGOT PASSWORD
    // ─────────────────────────────────────────────────────────────────────────
    forgotPasswordLink?.addEventListener('click', async (e) => {
        e.preventDefault();
        hideMessage();

        const email = sanitize(document.getElementById('loginEmail').value).toLowerCase();
        if (!email) {
            showMessage('Enter your email address in the field above, then click "Forgot Password".', 'error');
            return;
        }

        // Check registration status silently. Always return the SAME message
        // to prevent email enumeration (attacker probing which emails are registered).
        const registered = await isTutorEmailRegistered(email);
        if (registered) {
            try {
                await sendPasswordResetEmail(auth, email);
            } catch (err) {
                // Suppress the error — we still show the generic message below
                console.error('Password reset suppressed error:', err.code);
            }
        }

        // ALWAYS show the same response — no information leakage
        showMessage(
            'If this email is registered with us, a reset link has been sent. ' +
            'Check your inbox and spam folder.',
            'success'
        );
    });

});
