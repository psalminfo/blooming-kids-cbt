import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import html2pdf from 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';

document.getElementById('parentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const studentName = document.getElementById('studentName').value.trim();
  const parentEmail = document.getElementById('parentEmail').value.trim();
  const q = query(collection(db, 'student_results'), where('studentName', '==', studentName), where('parentEmail', '==', parentEmail));
  const snapshot = await getDocs(q);

  const reportContainer = document.getElementById('reportContent');
  reportContainer.innerHTML = '';

  if (snapshot.empty) {
    reportContainer.innerHTML = '<p class="text-red-500">No reports found for this student and email.</p>';
  } else {
    let totalScore = 0;
    let totalSubjects = 0;
    let tutorName = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const score = data.answers.filter(ans => ans === 'correct').length;
      totalScore += score;
      totalSubjects += 1;
      tutorName = data.tutorName || '';
      reportContainer.innerHTML += `
        <div class="mb-4">
          <h2 class="text-xl font-semibold text-green-700">Subject: ${data.subject.toUpperCase()}</h2>
          <p>Score: ${score}/30</p>
        </div>`;
    });

    reportContainer.innerHTML = `
      <h1 class="text-2xl font-bold text-green-800 mb-2">BLOOMING KIDS HOUSE ASSESSMENT REPORT</h1>
      <p><strong>Student:</strong> ${studentName}</p>
      <p><strong>Parent:</strong> ${parentEmail}</p>
      <p><strong>Tutor:</strong> ${tutorName}</p>
      <p><strong>Total Score:</strong> ${totalScore} / ${totalSubjects * 30}</p>
      <p><strong>Recommendations:</strong> Consistent improvement can be achieved through weekly tutorials with support from the assigned tutor.</p>
      <p class="mt-4 italic text-sm">POWERED BY <span style="color:#FFEB3B">POG</span></p>
    ` + reportContainer.innerHTML;

    document.getElementById('reportSection').classList.remove('hidden');
  }
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  html2pdf().from(document.getElementById('reportContent')).save();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  window.location.href = 'parent.html';
});
