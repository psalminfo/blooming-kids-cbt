import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import html2pdf from "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js";

document.getElementById('parentForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const studentName = document.getElementById('studentName').value.trim().toLowerCase();
  const parentEmail = document.getElementById('parentEmail').value.trim().toLowerCase();

  const q = query(collection(db, 'student_results'), where('studentName', '==', studentName), where('parentEmail', '==', parentEmail));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    alert('No results found. Please check the name and email.');
    return;
  }

  const reportData = [];
  querySnapshot.forEach(doc => {
    const data = doc.data();
    const score = data.answers.filter(a => a === 'correct').length;
    reportData.push({ ...data, score });
  });

  const reportHTML = generateReportHTML(studentName, reportData);
  const reportContent = document.getElementById('reportContent');
  reportContent.innerHTML = reportHTML;
  document.getElementById('reportContainer').classList.remove('hidden');

  document.getElementById('downloadBtn').onclick = () => {
    html2pdf().from(reportContent).save(`${studentName}_report.pdf`);
  };
});

function generateReportHTML(studentName, subjects) {
  const date = new Date().toLocaleDateString();
  return `
    <h2 class="text-lg font-bold text-green-700">Student: ${capitalize(studentName)}</h2>
    <p class="text-sm">Date: ${date}</p>
    <hr/>

    ${subjects.map(s => `
      <div class="mt-4">
        <h3 class="font-semibold text-yellow-600 capitalize">${s.subject} - Score: ${s.score}/30</h3>
        <p><strong>Grade:</strong> ${s.grade}</p>
        <p><strong>Tutor:</strong> ${s.tutorName}</p>
        <p><strong>Location:</strong> ${s.location}</p>
        <p class="mt-2"><strong>Recommendation:</strong> Your child would benefit from support in areas tested under the ${s.subject.toUpperCase()} curriculum. Personalized tutoring with ${s.tutorName} will help reinforce concepts and improve performance.</p>
      </div>
    `).join('')}

    <div class="mt-6 border-t pt-4">
      <p><strong>Director's Message:</strong> We at Blooming Kids House believe every child has the potential to shine. Let’s work together to nurture that potential. — <em>Mrs. Yinka Isikalu</em></p>
    </div>

    <footer class="mt-6 text-center text-xs text-gray-400">POWERED BY <span style="color:#FFEB3B">POG</span></footer>
  `;
}

function capitalize(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}
