// Import Firebase config and Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Save a single report to Firebase
async function saveReportToFirebase(report) {
  try {
    await addDoc(collection(db, 'reports'), report);
    console.log("✅ Report saved to Firestore");
  } catch (e) {
    console.error("❌ Error saving report: ", e);
  }
}

// Wrapper for saving test report
function saveTestReport(report) {
  saveReportToFirebase(report);
}

// Used by test pages to format the report
function generateTestReport(name, email, subject, grade, score, totalQuestions) {
  const percentage = ((score / totalQuestions) * 100).toFixed(2);

  let performanceSummary = '';
  if (percentage >= 90) {
    performanceSummary = 'Excellent performance.';
  } else if (percentage >= 75) {
    performanceSummary = 'Good job with room for improvement.';
  } else if (percentage >= 50) {
    performanceSummary = 'Fair performance. More practice is needed.';
  } else {
    performanceSummary = 'Below average. Significant support required.';
  }

  const skillBreakdown = [`Sample Skill 1: ${Math.floor(Math.random() * 100)}%`, `Sample Skill 2: ${Math.floor(Math.random() * 100)}%`];
  const recommendations = ['Review weak areas weekly.', 'Practice using STAAR-style questions.', 'Ask for help when unsure.'];

  return {
    studentName: name,
    studentEmail: email,
    subject,
    grade,
    score,
    totalQuestions,
    percentage,
    performanceSummary,
    skillBreakdown,
    recommendations,
    timestamp: new Date().toISOString()
  };
}

// Admin panel: Get all reports
async function getAllReports() {
  const snapshot = await getDocs(collection(db, 'reports'));
  return snapshot.docs.map(doc => doc.data());
}

// Parent panel: Get specific reports
async function getParentReport(name, email) {
  const q = query(
    collection(db, 'reports'),
    where('studentName', '==', name),
    where('studentEmail', '==', email)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}

// Admin authentication helpers
function logoutAdmin() {
  localStorage.removeItem('isAdminLoggedIn');
  window.location.href = 'index.html';
}

function checkAdminAuth() {
  const loggedIn = localStorage.getItem('isAdminLoggedIn');
  if (!loggedIn) {
    window.location.href = 'admin-panel.html';
  }
}
