import { auth, db } from './firebaseConfig.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('tutorSignupForm');
    const loginForm = document.getElementById('tutorLoginForm');
    const showLoginLink = document.getElementById('showLogin');
    const showSignupLink = document.getElementById('showSignup');
    const signupSection = document.getElementById('signupSection');
    const loginSection = document.getElementById('loginSection');

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupSection.classList.add('hidden');
            loginSection.classList.remove('hidden');
        });
    }

    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginSection.classList.add('hidden');
            signupSection.classList.remove('hidden');
        });
    }

    function validatePassword(name, password) {
        if (password.length < 6) {
            alert('Password must be at least 6 characters long.');
            return false;
        }
        if (!/\d/.test(password)) {
            alert('Password must contain at least one number.');
            return false;
        }
        if (password.toLowerCase().includes(name.toLowerCase())) {
            alert('Password cannot contain your name.');
            return false;
        }
        return true;
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            
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

                alert('Signup successful! Redirecting to portal...');
                window.location.href = 'tutor.html';
            } catch (error) {
                console.error('Signup error:', error);
                alert(error.message);
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
                alert(error.message);
            }
        });
    }
});
