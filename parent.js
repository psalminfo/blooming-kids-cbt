import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

const form = document.getElementById('parentLoginForm');
const reportContainer = document.getElementById('reportContainer');
const downloadBtn = document.getElementById('downloadBtn');
const logoutBtn = document.getElementById('logoutBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const studentName = document.getElementById('studentName').value.trim();
  const parentEmail = document.getElementById('parentEmail').value.trim();

  const q = query(collection(db, "student_results"),
                  where("studentName", "==", studentName),
                  where("parentEmail", "==", parentEmail));

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    alert("No records found for this student and parent email.");
    return;
  }

  // Group results by subject
  const results = {};
  let tutorName = '', location = '', grade = '';

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const subject = data.subject || 'Unknown';
    results[subject] = data.answers;
    tutorName = data.tutorName || '';
    location = data.location || '';
    grade = data.grade || '';
  });

  // Generate Report HTML
  let html = `<h2 class="text-xl font-bold mb-2">${studentName}'s Assessment Report</h2>`;
  html += `<p class="mb-2"><strong>Grade:</strong> ${grade}</p>`;
  html += `<p class="mb-2"><strong>Tutor:</strong> ${tutorName} (${location})</p>`;

  for (const [subject, answers] of Object.entries(results)) {
    html += `<h3 class="mt-4 font-semibold">${subject}</h3>`;
    html += `<p>Answered: ${answers.length} questions</p>`;
  }

  html += `<div class="mt-6 p-4 bg-yellow-100 rounded">
    <h4 class="font-bold">Director's Message</h4>
    <p>We are proud of your child’s performance. Our tutor, <strong>${tutorName}</strong>, will support ${studentName} with tailored guidance for improved learning outcomes. Contact us to begin tutoring today!</p>
  </div>`;

  html += `<footer class="text-center text-sm mt-6">POWERED BY <span style="color:#FFEB3B">POG</span></footer>`;

  reportContainer.innerHTML = html;
  reportContainer.classList.remove('hidden');
  downloadBtn.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');
});

downloadBtn.addEventListener('click', () => {
  html2pdf().from(reportContainer).save('Student_Report.pdf');
});

logoutBtn.addEventListener('click', () => {
  window.location.href = 'parent.html';
});
