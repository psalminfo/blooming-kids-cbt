import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import html2pdf from 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';

import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function generateReportFromFirestore(studentName, parentEmail) {
  const resultsRef = collection(db, 'student_results');
  const q = query(resultsRef, where('name', '==', studentName), where('parentEmail', '==', parentEmail));

  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    alert('No report found for the provided name and email.');
    return;
  }

  const reportContainer = document.getElementById('reportContainer');
  reportContainer.innerHTML = ''; // Clear any previous report

  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const { name, grade, email, location, tutor, results } = data;

    const date = new Date().toLocaleDateString();

    const reportCard = document.createElement('div');
    reportCard.className = 'p-6 max-w-3xl mx-auto bg-white rounded-xl shadow-md';

    // Header
    const header = `
      <div class="text-center mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Blooming Kids House Assessment Report</h2>
        <p class="text-sm text-gray-500">${date}</p>
      </div>
    `;

    // Student Info
    const studentInfo = `
      <div class="mb-4 text-gray-700">
        <p><strong>Student Name:</strong> ${name}</p>
        <p><strong>Grade:</strong> ${grade}</p>
        <p><strong>Location:</strong> ${location}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Assigned Tutor:</strong> ${tutor || 'To be assigned'}</p>
      </div>
    `;

    // Results
    let scoresSection = '';
    let recommendationsSection = '';

    Object.entries(results).forEach(([subject, subjectData]) => {
      const score = subjectData.score;
      const percentage = `${score}%`;

      // Subject-specific recommendation
      let rec = '';
      if (score >= 80) {
        rec = `We’ll continue strengthening ${subject} problem-solving and test endurance, especially on high-level questions.`;
      } else if (score >= 60) {
        rec = `We'll focus on revisiting key topics in ${subject} and improve comprehension and speed through targeted practice.`;
      } else {
        rec = `Your child needs foundational support in ${subject}. Our tutor will rebuild core concepts and boost confidence.`;
      }

      scoresSection += `
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-blue-600">${subject}</h3>
          <p class="text-gray-700">Performance: <strong>${percentage}</strong></p>
        </div>
      `;

      recommendationsSection += `
        <li class="mb-2"><strong>${subject}:</strong> ${rec}</li>
      `;
    });

    // Recommendation Summary
    const recommendationsHTML = `
      <div class="mt-6">
        <h3 class="text-lg font-semibold text-gray-800 mb-2">Our Plan for Your Child</h3>
        <ul class="text-gray-700 list-disc list-inside">
          ${recommendationsSection}
        </ul>
      </div>
    `;

    // Director’s Note
    const directorNote = `
      <div class="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-gray-800">
        <p>
          “At Blooming Kids House, we believe no child is left behind. Whether your child is ahead or catching up,
          our tailored support ensures they reach their full potential. We go beyond grades — we build confidence,
          discipline, and love for learning.
        </p>
        <p class="mt-2">
          Your child’s journey matters deeply to us, and together with our passionate tutors,
          we’re committed to walking hand-in-hand with your family toward lasting academic success.”
        </p>
        <p class="mt-4 text-right font-semibold">— Mrs. Yinka Isikalu, Director</p>
      </div>
    `;

    // Footer
    const footer = `
      <div class="mt-6 text-center text-sm text-gray-500">
        POWERED BY <span style="color:#FFEB3B">POG</span>
      </div>
    `;

    reportCard.innerHTML = header + studentInfo + scoresSection + recommendationsHTML + directorNote + footer;
    reportContainer.appendChild(reportCard);
  });

  // Download button
  const downloadBtn = document.getElementById('downloadReport');
  downloadBtn.classList.remove('hidden');
  downloadBtn.onclick = () => {
    const opt = {
      margin:       0.5,
      filename:     `${studentName}-assessment-report.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    html2pdf().from(reportContainer).set(opt).save();
  };
}
