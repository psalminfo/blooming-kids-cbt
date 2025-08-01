// generateReportFromFirestore.js

import { db } from './firebaseConfig.js';

document.addEventListener("DOMContentLoaded", () => {
  const studentData = JSON.parse(sessionStorage.getItem("studentData"));
  const studentName = sessionStorage.getItem("studentName");
  const parentEmail = sessionStorage.getItem("parentEmail");

  if (!studentData || !studentName || !parentEmail) {
    document.body.innerHTML = `<div class="text-center text-red-600 font-bold mt-10">Missing student info. Please return to the parent portal.</div>`;
    return;
  }

  // Populate report
  const reportContainer = document.getElementById("report-container");
  if (!reportContainer) return;

  const subjectSections = Object.keys(studentData.scores || {}).map(subject => {
    const score = studentData.scores[subject];
    const topics = studentData.topicsCovered?.[subject] || [];

    // Create recommendation
    const recommendation = `
      <p class="mt-2">
        In <strong>${subject}</strong>, ${studentName} scored <strong>${score}%</strong>.
        Topics assessed include: <em>${topics.join(", ") || "N/A"}</em>.
        We recommend additional support in these areas to improve performance.
        One of our experienced tutors will work closely with ${studentName} to address these gaps.
      </p>
    `;

    return `
      <div class="mb-6">
        <h3 class="text-xl font-semibold text-indigo-700">${subject} Performance</h3>
        <p class="mt-1">Score: <strong>${score}%</strong></p>
        ${recommendation}
      </div>
    `;
  }).join("");

  const html = `
    <div class="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-lg">
      <h1 class="text-3xl font-bold text-center text-gray-800 mb-6">Assessment Report</h1>
      <h2 class="text-xl font-semibold text-center text-gray-600 mb-6">Blooming Kids House</h2>

      <div class="mb-4">
        <p><strong>Student Name:</strong> ${studentName}</p>
        <p><strong>Parent Email:</strong> ${parentEmail}</p>
        <p><strong>Grade:</strong> ${studentData.grade || 'N/A'}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>

      ${subjectSections}

      <div class="mt-6">
        <h3 class="text-xl font-semibold text-indigo-700">Recommendations</h3>
        <p class="mt-2">Our personalized tutoring program will support ${studentName} in mastering challenging topics through guided practice and strategic review. We encourage you to enroll your child to begin this improvement journey with us.</p>
      </div>

      <div class="mt-10 pt-6 border-t border-gray-300">
        <h3 class="text-lg font-semibold text-gray-800">Director’s Message</h3>
        <p class="mt-2">Dear Parent,</p>
        <p class="mt-2">Thank you for allowing us the opportunity to assess your child's academic progress. This report highlights their current performance and identifies areas where support is needed. We are committed to working with you to ensure your child's growth and success.</p>
        <p class="mt-4 font-semibold">Warm regards,<br>Mrs. Yinka Isikalu<br>Director, Blooming Kids House</p>
      </div>

      <div class="mt-10 flex justify-between">
        <button id="downloadBtn" class="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">Download Report</button>
        <button id="logoutBtn" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Logout</button>
      </div>

      <p class="mt-8 text-center text-gray-500 text-sm">POWERED BY <span style="color:#FFEB3B">POG</span></p>
    </div>
  `;

  reportContainer.innerHTML = html;

  // DOWNLOAD REPORT
  document.getElementById("downloadBtn")?.addEventListener("click", () => {
    window.print();
  });

  // LOGOUT
  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "parent.html";
  });
});
