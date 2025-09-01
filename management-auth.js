import { auth, db } from './firebaseConfig.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const signupBtn = document.getElementById('signup-btn');
const signinBtn = document.getElementById('signin-btn');
const errorMessage = document.getElementById('error-message');

// Toggle between Sign Up and Sign In forms
document.getElementById('show-signin').addEventListener('click', () => {
    document.getElementById('signup-container').style.display = 'none';
    document.getElementById('signin-container').style.display = 'block';
});
document.getElementById('show-signup').addEventListener('click', () => {
    document.getElementById('signin-container').style.display = 'none';
    document.getElementById('signup-container').style.display = 'block';
});

// Sign-Up Handler
signupBtn.addEventListener('click', async () => {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    errorMessage.textContent = '';

    if (!name || !email || !password) {
        errorMessage.textContent = 'All fields are required.';
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // ### CRUCIAL STEP ### Create a document in the 'staff' collection
        const staffDocRef = doc(db, "staff", user.email);
        await setDoc(staffDocRef, {
            name: name,
            email: user.email,
            uid: user.uid,
            role: 'pending', // Default role for all new sign-ups
            permissions: {}   // Default empty permissions
        });

        alert('Account created successfully! An administrator must approve your account before you can log in.');
        
    } catch (error) {
        errorMessage.textContent = error.message;
    }
});

// Sign-In Handler
signinBtn.addEventListener('click', async () => {
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    errorMessage.textContent = '';

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // After successful sign-in, check their role to redirect
        const staffDoc = await getDoc(doc(db, "staff", email));
        if (staffDoc.exists() && staffDoc.data().role !== 'pending') {
            window.location.href = 'management.html';
        } else {
            await auth.signOut();
            errorMessage.textContent = 'Your account is pending approval or access is denied.';
        }
    } catch (error) {
        errorMessage.textContent = error.message;
    }
});