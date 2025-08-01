import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import html2pdf from "https://cdn.jsdelivr.net/npm/html2pdf.js@0.9.3/dist/html2pdf.bundle.min.js";

const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.fetchReports = async function () {
  const studentName = document.getElementById('studentName').value.trim();
  const parentEmail = document.getElementById('parentEmail').value.trim().toLowerCase();

  if (!studentName || !parentEmail) return alert("Please enter both student name and parent email.");

  const q = query(collection(db, "testResults"), where("studentName", "==", studentName), where("parentEmail", "==", parentEmail));
  const snapshot = await getDocs(q);
  const reportContainer = document.getElementById("reportContainer");
  reportContainer.innerHTML = "";

  if (snapshot.empty) {
    reportContainer.innerHTML = `<p class='text-red-600'>No test reports found for this student and parent email.</p>`;
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    const timestamp = new Date(data.timestamp).toLocaleString();

    const scoresTable = Object.entries(data.scores).map(([subject, score]) => {
      const percent = `${Math.round((score.correct / score.total) * 100)}%`;
      return `<tr><td class='border p-2'>${subject}</td><td class='border p-2 text-center'>${percent}</td></tr>`;
    }).join("");

    const topicsList = data.topicsCovered?.length ? data.topicsCovered.map(t => `<li>${t}</li>`).join("") : '<li>No topics listed.</li>';

    const recommendations = data.topicsCovered?.length ?
      `<p>We noticed areas like <strong>${data.topicsCovered.join(", ")}</strong> could use some improvement. We recommend focused tutoring sessions to build confidence and skill.</p>` :
      `<p>We recommend our tutoring sessions to strengthen your child’s academic foundation.</p>`;

    const reportHTML = `
      <div class="bg-white p-6 rounded-xl shadow space-y-4">
        <h2 class="text-xl font-semibold text-yellow-800">Report for ${data.studentName}</h2>
        <p><strong>Grade:</strong> ${data.grade}</p>
        <p><strong>Date:</strong> ${timestamp}</p>

        <table class="w-full border mt-4">
          <thead>
            <tr class="bg-yellow-200">
              <th class="border p-2">Subject</th>
              <th class="border p-2">Score (%)</th>
            </tr>
          </thead>
          <tbody>${scoresTable}</tbody>
        </table>

        <div>
          <h3 class="font-semibold mt-4 mb-2">Topics Covered</h3>
          <ul class="list-disc list-inside">${topicsList}</ul>
        </div>

        <div class="mt-4">
          <h3 class="font-semibold mb-2">Recommendations</h3>
          ${recommendations}
        </div>

        <div class="mt-6 italic text-sm text-gray-700 border-t pt-4">
          <p>“Thank you for trusting us with your child’s academic journey. We believe every child can excel with the right guidance and support.”</p>
          <p class="mt-2 font-semibold">Mrs. Yinka Isikalu<br>Director, Blooming Kids House</p>
        </div>

        <button class="mt-4 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded" onclick="downloadReport(this)">Download PDF</button>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = reportHTML;
    reportContainer.appendChild(wrapper);
  });
};

window.downloadReport = function (btn) {
  const reportDiv = btn.closest(".bg-white");
  html2pdf().from(reportDiv).save("student-report.pdf");
};
