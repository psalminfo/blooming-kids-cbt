import { db } from './firebaseConfig.js';
import { collection, getDocs } from 'firebase/firestore';

async function fetchReports() {
  const student = localStorage.getItem('bk_studentName');
  const email = localStorage.getItem('bk_parentEmail');
  const container = document.getElementById('reportContainer');

  if (!student || !email) {
    container.innerHTML = "Missing login info.";
    return;
  }

  const snapshot = await getDocs(collection(db, 'reports'));
  container.innerHTML = "";

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.student === student && data.parentEmail === email) {
      const div = document.createElement('div');
      div.innerHTML = `
        <strong>${data.subject} (Grade ${data.grade})</strong><br/>
        <a href="${data.url}" target="_blank" class="text-blue-600 underline">Download Report</a>
        <hr class="my-2"/>
      `;
      container.appendChild(div);
    }
  });

  if (!container.innerHTML) {
    container.innerHTML = "No matching reports found.";
  }
}

function logout() {
  localStorage.removeItem('bk_studentName');
  localStorage.removeItem('bk_parentEmail');
  window.location.href = 'login-parent.html';
}

window.addEventListener('DOMContentLoaded', fetchReports);
window.logout = logout;
