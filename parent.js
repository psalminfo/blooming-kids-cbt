import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from 'firebase/firestore';

let parentInfo = {};

document.getElementById('parentLoginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  parentInfo = {
    studentName: document.getElementById('studentName').value.trim(),
    parentEmail: document.getElementById('parentEmail').value.trim()
  };
  localStorage.setItem('parentInfo', JSON.stringify(parentInfo));
  window.location.href = 'parent.html';
});

if (window.location.pathname.includes('parent.html')) {
  const info = JSON.parse(localStorage.getItem('parentInfo'));
  if (!info) window.location.href = 'login-parent.html';

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('parentInfo');
    window.location.href = 'login-parent.html';
  });

  const q = query(
    collection(db, 'reports'),
    where('studentName', '==', info.studentName),
    where('parentName', '==', info.parentEmail)
  );

  const snapshot = await getDocs(q);
  const reportList = document.getElementById('reportList');
  if (snapshot.empty) {
    reportList.innerHTML = `<p class="text-red-600">No reports found for this student.</p>`;
  } else {
    snapshot.forEach(doc => {
      const { reportUrl, grade, date } = doc.data();
      const div = document.createElement('div');
      div.className = 'p-4 border rounded bg-green-50';
      div.innerHTML = `
        <p><strong>Grade:</strong> ${grade}</p>
        <p><strong>Date:</strong> ${new Date(date.seconds * 1000).toLocaleString()}</p>
        <a href="${reportUrl}" target="_blank" class="text-blue-600 underline">Download Report</a>
      `;
      reportList.appendChild(div);
    });
  }
}
