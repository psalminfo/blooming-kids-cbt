import { db } from './firebaseConfig.js';
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const form = document.getElementById('report-form');
const reportSection = document.getElementById('report-section');
const reportContent = document.getElementById('report-content');
const downloadBtn = document.getElementById('download-btn');
const logoutBtn = document.getElementById('logout-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const studentName = document.getElementById('student-name').value.trim();
  const parentEmail = document.getElementById('parent-email').value.trim();

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  const q = query(
    collection(db, 'student_results'),
    where('studentName', '==', studentName),
    where('parentEmail', '==', parentEmail)
  );

  try {
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      reportContent.innerHTML = `<p class="text-red-600 font-semibold">No results found for this student.</p>`;
      reportSection.classList.remove('hidden');
      return;
    }

    const results = [];
    querySnapshot.forEach(doc => results.push(doc.data()));

    // Sort by subject for consistency
    results.sort((a, b) => a.subject.localeCompare(b.subject));

    // Generate the report
    const studentInfo = results[0];
    const subjectReports = results.map(result => {
      const score = calculateScore(result.answers);
      return `
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-green-700 capitalize">${result.subject}</h3>
          <p><span class="font-semibold">Score:</span> ${score}%</p>
          <p><span class="font-semibold">Tutor:</span> ${result.tutorName}</p>
          <p><span class="font-semibold">Location:</span> ${result.location}</p>
          <p class="mt-2 text-sm text-gray-600"><em>Recommendations:</em> The student should revise key concepts in ${result.subject}, focus on STAAR practice questions, and attend tutoring sessions with ${result.tutorName} for personalized support.</p>
        </div>
      `;
    });

    const reportHTML = `
      <div class="p-6 rounded-lg bg-white shadow-lg border-2 border-green-600">
        <h1 class="text-2xl font-bold text-center text-green-800 mb-4">BLOOMING KIDS HOUSE ASSESSMENT REPORT</h1>
        <p class="text-sm mb-2"><strong>Student:</strong> ${studentInfo.studentName}</p>
        <p class="text-sm mb-2"><strong>Grade:</strong> ${studentInfo.grade}</p>
        <p class="text-sm mb-4"><strong>Parent Email:</strong> ${studentInfo.parentEmail}</p>
        ${subjectReports.join('')}
        <div class="mt-6 border-t pt-4 text-sm text-gray-700">
          <p><strong>Director’s Message:</strong> Thank you for entrusting us with your child's academic development. Based on this assessment, we strongly recommend targeted tutoring. Our team, led by experienced tutors like ${studentInfo.tutorName}, is ready to help your child excel.</p>
        </div>
        <footer class="mt-4 text-center text-xs text-gray-500">POWERED BY <span style="color:#FFEB3B">POG</span></footer>
      </div>
    `;

    reportContent.innerHTML = reportHTML;
    reportSection.classList.remove('hidden');
    downloadBtn.classList.remove('hidden');

  } catch (err) {
    console.error("Error fetching results:", err);
    alert("An error occurred while fetching results.");
  }
});

downloadBtn.addEventListener('click', () => {
  import('https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js').then(html2pdf => {
    html2pdf.default()
      .from(reportContent)
      .set({
        margin: 0.5,
        filename: 'student_report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      })
      .save();
  });
});

logoutBtn.addEventListener('click', () => {
  window.location.href = 'parent.html';
});

function calculateScore(answers) {
  // Placeholder: real implementation would compare with correct answers
  if (!Array.isArray(answers)) return 0;
  const total = answers.length;
  const correct = answers.filter(a => a === 'correct').length;
  return Math.round((correct / total) * 100);
}
