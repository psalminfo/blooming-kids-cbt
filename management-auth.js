import { auth, db } from './firebaseConfig.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const errorMessage = document.getElementById('error-message');

// Toggle between Sign Up and Sign In forms
document.getElementById('show-signin').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signup-container').style.display = 'none';
    document.getElementById('signin-container').style.display = 'block';
    errorMessage.textContent = '';
});

document.getElementById('show-signup').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signin-container').style.display = 'none';
    document.getElementById('signup-container').style.display = 'block';
    errorMessage.textContent = '';
});

// Sign-Up Form Handler
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent page reload
    
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

// Sign-In Form Handler
document.getElementById('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent page reload
    
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;
    errorMessage.textContent = '';
    errorMessage.className = 'text-red-500 text-center mt-4'; // Reset class

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

// Forgot Password Handler
const forgotPasswordLink = document.getElementById('forgot-password-link');

forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault(); // Prevent the link from navigating
    
    // First make sure we're showing the signin form
    document.getElementById('signup-container').style.display = 'none';
    document.getElementById('signin-container').style.display = 'block';
    
    const email = document.getElementById('signin-email').value;

    if (!email) {
        const emailFromPrompt = prompt("Please enter your email address to reset your password:");
        if (emailFromPrompt) {
            await handlePasswordReset(emailFromPrompt);
        }
        return;
    }
    
    await handlePasswordReset(email);
});

async function handlePasswordReset(email) {
    errorMessage.textContent = '';
    try {
        await sendPasswordResetEmail(auth, email);
        errorMessage.textContent = 'Password reset email sent! Check your inbox (and spam folder).';
        errorMessage.className = 'text-green-600 text-center mt-4';
    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.className = 'text-red-500 text-center mt-4';
    }
}

