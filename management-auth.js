// ============================================================
// management-auth.js
// Sign-up, sign-in and password reset for management staff.
// ============================================================

import { auth, db } from './management-portal/core/firebase.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword,
         sendPasswordResetEmail }
    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, setDoc, getDoc }
    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const errorMessage = document.getElementById('error-message');

// ── Toggle forms ──────────────────────────────────────────────
document.getElementById('show-signin').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('signup-container').style.display = 'none';
    document.getElementById('signin-container').style.display = 'block';
    errorMessage.textContent = '';
});

document.getElementById('show-signup').addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('signin-container').style.display = 'none';
    document.getElementById('signup-container').style.display = 'block';
    errorMessage.textContent = '';
});

// ── Sign-Up ───────────────────────────────────────────────────
document.getElementById('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name     = document.getElementById('signup-name').value.trim();
    const email    = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    errorMessage.textContent = '';

    if (!name || !email || !password) {
        errorMessage.textContent = 'All fields are required.';
        return;
    }
    try {
        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'staff', user.email), {
            name, email: user.email, uid: user.uid,
            role: 'pending', permissions: {}
        });
        alert('Account created! An administrator must approve it before you can log in.');
    } catch (err) {
        errorMessage.textContent = err.message;
    }
});

// ── Sign-In ───────────────────────────────────────────────────
document.getElementById('signin-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    errorMessage.textContent = '';
    errorMessage.className = 'text-red-500 text-center mt-4';

    try {
        await signInWithEmailAndPassword(auth, email, password);
        const staffDoc = await getDoc(doc(db, 'staff', email));
        if (staffDoc.exists() && staffDoc.data().role !== 'pending') {
            window.location.href = 'management.html';
        } else {
            await auth.signOut();
            errorMessage.textContent = 'Your account is pending approval or access is denied.';
        }
    } catch (err) {
        errorMessage.textContent = err.message;
    }
});

// ── Forgot Password ───────────────────────────────────────────
document.getElementById('forgot-password-link').addEventListener('click', async e => {
    e.preventDefault();
    document.getElementById('signup-container').style.display = 'none';
    document.getElementById('signin-container').style.display = 'block';
    const email = document.getElementById('signin-email').value.trim()
        || prompt('Enter your email address to reset your password:');
    if (email) await handlePasswordReset(email);
});

async function handlePasswordReset(email) {
    errorMessage.textContent = '';
    try {
        await sendPasswordResetEmail(auth, email);
        errorMessage.textContent = 'Password reset email sent! Check your inbox.';
        errorMessage.className = 'text-green-600 text-center mt-4';
    } catch (err) {
        errorMessage.textContent = err.message;
        errorMessage.className = 'text-red-500 text-center mt-4';
    }
}
