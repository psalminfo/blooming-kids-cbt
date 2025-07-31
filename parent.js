import { db } from './firebaseConfig.js';
import { collection, getDocs, query, where } from 'firebase/firestore';

async function fetchReports() {
  const student = localStorage.getItem('bk_studentName');
  const email = localStorage.getItem('bk_parentEmail');
  const container = document.getElementById('reportContainer');

  if (!student || !email) {
    container.innerHTML = "Missing login info.";
    return;
  }

  try {
    const q = query(
      collection(db, 'reports'),
      where('student', '==', student),
      where('parentEmail', '==', email)
    );

    const snapshot = await getDocs(q);
    container.innerHTML = "";

    if (snapshot.empty) {
      container.innerHTML = "No matching report found.";
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      const div = document.createElement('div');
      div.innerHTML = `
        <strong>BLOOMING KIDS HOUSE ASSESSMENT REPORT</strong><br/>
        <em>${data.student} (Grade ${data.grade})</em><br/>
        <a href="${data.url}" target="_blank" class="text-blue-600 underline">Download Report PDF</a>
        <hr class="my-3"/>
      `;
      container.appendChild(div);
    });

  } catch (error) {
    console.error("Error loading report:", error);
    container.innerHTML = "An error occurred. Please try again.";
  }
}

function logout() {
  localStorage.removeItem('bk_studentName');
  localStorage.removeItem('bk_parentEmail');
  window.location.href = 'login-parent.html';
}

window.addEventListener('DOMContentLoaded', fetchReports);
window.logout = logout;
