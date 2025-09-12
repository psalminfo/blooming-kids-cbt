import { auth, db } from './firebaseConfig.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, browserLocalPersistence, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('tutorSignupForm');
    const loginForm = document.getElementById('tutorLoginForm');
    const showLoginLink = document.getElementById('showLogin');
    const showSignupLink = document.getElementById('showSignup');
    const signupSection = document.getElementById('signupSection');
    const loginSection = document.getElementById('loginSection');
    const messageBox = document.getElementById('message-box');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    // Function to show a message in the message box
    function showMessage(message, type = 'info') {
        messageBox.textContent = message;
        messageBox.classList.remove('hidden');
        messageBox.classList.remove('bg-red-200', 'text-red-800', 'bg-green-200', 'text-green-800', 'bg-blue-200', 'text-blue-800');
        
        if (type === 'error') {
            messageBox.classList.add('bg-red-200', 'text-red-800');
        } else if (type === 'success') {
            messageBox.classList.add('bg-green-200', 'text-green-800');
        } else {
            messageBox.classList.add('bg-blue-200', 'text-blue-800');
        }
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupSection.classList.add('hidden');
            loginSection.classList.remove('hidden');
            messageBox.classList.add('hidden');
        });
    }

    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginSection.classList.add('hidden');
            signupSection.classList.remove('hidden');
            messageBox.classList.add('hidden');
        });
    }

    function validatePassword(name, password) {
        if (password.length < 6) {
            showMessage('Password must be at least 6 characters long.', 'error');
            return false;
        }
        if (!/\d/.test(password)) {
            showMessage('Password must contain at least one number.', 'error');
            return false;
        }
        if (password.toLowerCase().includes(name.toLowerCase())) {
            showMessage('Password should not contain your name.', 'error');
            return false;
        }
        return true;
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const name = document.getElementById('signupName').value;

            if (!validatePassword(name, password)) {
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                await setDoc(doc(db, "tutors", user.email), {
                    name: name,
                    email: email
                });

                showMessage('Signup successful! Redirecting to portal...', 'success');
                window.location.href = 'tutor.html';
            } catch (error) {
                console.error('Signup error:', error);
                showMessage(error.message, 'error');
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const rememberMe = document.getElementById('rememberMe').checked;

            const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
            
            try {
                await setPersistence(auth, persistence);
                await signInWithEmailAndPassword(auth, email, password);
                window.location.href = 'tutor.html';
            } catch (error) {
                console.error('Login error:', error);
                showMessage(error.message, 'error');
            }
        });
    }

    // New logic for password reset
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;

            if (!email) {
                showMessage("Please enter your email address to reset your password.", 'error');
                return;
            }

            try {
                await sendPasswordResetEmail(auth, email);
                showMessage("A password reset link has been sent to your email.", 'success');
            } catch (error) {
                console.error("Password reset error:", error);
                showMessage("Failed to send password reset email. Please check the email address.", 'error');
            }
        });
    }
});
