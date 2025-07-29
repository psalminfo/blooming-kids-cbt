// FILE: student-login.js
import { auth, db } from './firebaseConfig.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const form = document.getElementById('studentLoginForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const studentName = document.getElementById('studentName').value.trim();
  const parentEmail = document.getElementById('parentEmail').value.trim();
  const grade = document.getElementById('grade').value;
  const tutorName = document.getElementById('tutorName').value.trim();
  const location = document.getElementById('location').value.trim();
  const accessCode = document.getElementById('accessCode').value.trim();

  if (accessCode !== 'bkh2025') {
    alert('Invalid Access Code');
    return;
  }

  try {
    const email = `${studentName.replace(/\s+/g, '_')}@bkh.com`;
    const password = 'bkh_default_password';

    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        throw err;
      }
    }

    const uid = userCredential.user.uid;

    await setDoc(doc(db, 'users', uid), {
      studentName,
      parentEmail,
      grade,
      tutorName,
      location,
      role: 'student',
      timestamp: new Date()
    });

    localStorage.setItem('studentName', studentName);
    localStorage.setItem('parentEmail', parentEmail);
    localStorage.setItem('grade', grade);
    localStorage.setItem('tutorName', tutorName);
    localStorage.setItem('location', location);
    localStorage.setItem('uid', uid);

    // ✅ Correct redirection
    window.location.href = 'subject-select.html';
  } catch (error) {
    console.error(error);
    alert('Login failed. Please try again.');
  }
});
