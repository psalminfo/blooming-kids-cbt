import { auth, db } from './firebaseConfig.js';
// ### UPDATED ### to include the necessary persistence functions
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    
    try {
        // ### ADDED ### This line tells Firebase to keep the user logged in
        await setPersistence(auth, browserLocalPersistence);

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        if (user.email === ADMIN_EMAIL) {
            window.location.href = 'admin.html';
        } else {
            alert("Access denied. You are not the admin.");
            await auth.signOut();
        }
    } catch (error) {
        console.error('Login error:', error);
        alert(error.message);
    }
});
