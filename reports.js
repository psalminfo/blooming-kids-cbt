import { db } from './firebaseConfig.js';
import { collection, getDocs } from 'firebase/firestore';

async function loadReports() {
  const reportList = document.getElementById('reportList');
  reportList.innerHTML = "Loading...";

  const snapshot = await getDocs(collection(db, 'reports'));
  reportList.innerHTML = "";

  snapshot.forEach(doc => {
    const r = doc.data();
    const div = document.createElement('div');
    div.innerHTML = `
      <strong>${r.student}</strong> (${r.subject})<br/>
      <a href="${r.url}" target="_blank" class="text-blue-600 underline">Download Report</a>
      <hr class="my-2"/>
    `;
    reportList.appendChild(div);
  });
}

window.addEventListener('DOMContentLoaded', loadReports);
