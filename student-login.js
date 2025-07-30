// student-login.js

import { db } from './firebaseConfig.js';
import {
  collection,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';

document.getElementById('studentLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const studentName = document.getElementById('studentName').value.trim();
  const parentEmail = document.getElementById('parentEmail').value.trim();
  const grade = document.getElementById('grade').value.trim();
  const tutorName = document.getElementById('tutorName').value.trim();
  const location = document.getElementById('location').value.trim();
  const accessCode = document.getElementById('accessCode').value.trim();

  if (accessCode !== 'bkh2025') {
    alert('Invalid access code.');
    return;
  }

  try {
    // Save student info in Firestore
    const docRef = await addDoc(collection(db, 'students'), {
      studentName,
      parentEmail,
      grade,
      tutorName,
      location,
      timestamp: serverTimestamp()
    });

    // Store locally for use in subject-select.html
    localStorage.setItem('studentName', studentName);
    localStorage.setItem('grade', grade);
    localStorage.setItem('parentEmail', parentEmail);
    localStorage.setItem('studentId', docRef.id);

    // Redirect to subject selection
    window.location.href = 'subject-select.html';
  } catch (error) {
    console.error('Error logging in student:', error);
    alert('Login failed. Please try again.');
  }
});
