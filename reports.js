import { db } from './firebaseConfig.js';
import { collection, getDocs } from 'firebase/firestore';

async function loadAdminReports() {
  const container = document.getElementById('adminReports');
  if (!container) return;

  const snapshot = await getDocs(collection(db, 'reports'));
  if (snapshot.empty) {
    container.innerHTML = `<p class="text-red-600">No reports found.</p>`;
    return;
  }

  container.innerHTML = '';
  snapshot.forEach(doc => {
    const { studentName, parentName, grade, reportUrl, date } = doc.data();
    const div = document.createElement('div');
    div.className = 'bg-yellow-100 border px-4 py-2 rounded mb-2';
    div.innerHTML = `
      <p><strong>Student:</strong> ${studentName}</p>
      <p><strong>Parent:</strong> ${parentName}</p>
      <p><strong>Grade:</strong> ${grade}</p>
      <p><strong>Date:</strong> ${new Date(date.seconds * 1000).toLocaleString()}</p>
      <a href="${reportUrl}" target="_blank" class="text-blue-600 underline">Download PDF</a>
    `;
    container.appendChild(div);
  });
}

loadAdminReports();
