import { auth, db } from './firebaseConfig.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

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

if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = signupForm.signupName.value;
        const email = signupForm.signupEmail.value;
        const password = signupForm.signupPassword.value;
        
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
        const email = loginForm.loginEmail.value;
        const password = loginForm.loginPassword.value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = 'tutor.html';
        } catch (error) {
            console.error('Login error:', error);
            alert(error.message);
        }
    });
}
