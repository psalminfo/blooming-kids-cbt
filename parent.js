
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import html2pdf from 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';

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

const urlParams = new URLSearchParams(window.location.search);
const studentName = urlParams.get('student');
const parentEmail = urlParams.get('email');
const reportContainer = document.getElementById("report-sections");

document.getElementById("downloadBtn").addEventListener("click", () => {
  html2pdf().from(document.getElementById("report-container")).save(`${studentName}_Report.pdf`);
});

async function loadReports() {
  const q = query(collection(db, "student_results"), where("studentName", "==", studentName), where("parentEmail", "==", parentEmail));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    reportContainer.innerHTML = "<p class='text-red-500'>No results found for this student and email.</p>";
    return;
  }

  const sessions = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const time = data.submittedAt.toMillis();
    let added = false;
    for (let session of sessions) {
      if (Math.abs(time - session[0].submittedAt.toMillis()) < 2 * 3600 * 1000) {
        session.push(data);
        added = true;
        break;
      }
    }
    if (!added) sessions.push([data]);
  });

  document.getElementById("student-info").innerHTML = `
    <p><strong>Name:</strong> ${studentName}</p>
    <p><strong>Parent Email:</strong> ${parentEmail}</p>
  `;

  sessions.forEach((group, index) => {
    const groupDiv = document.createElement("div");
    groupDiv.className = "border-t pt-4 mt-4";
    groupDiv.innerHTML = `<h2 class="text-xl font-bold mb-2">Test Session ${index + 1}</h2>`;

    group.forEach(result => {
      const topics = getTopicsFromAnswers(result.subject, result.answers);
      const rec = getRecommendations(result.subject, topics);
      groupDiv.innerHTML += `
        <div class="mb-4">
          <h3 class="font-semibold">${result.subject.toUpperCase()} - Grade ${result.grade}</h3>
          <p><strong>Topics Covered:</strong> ${topics.join(', ')}</p>
          <p><strong>Recommendations:</strong> ${rec}</p>
        </div>
      `;
    });

    reportContainer.appendChild(groupDiv);
  });

  document.getElementById("directors-message").innerHTML = `
    <h3 class="font-semibold">Message from the Director</h3>
    <p>Thank you for entrusting your child's growth to us. At Blooming Kids House, we believe every child is unique and capable. We are committed to providing personalized support through our experienced tutors. You can be confident that your child’s tutor is dedicated to nurturing their strengths and guiding improvement areas. <br><br>Warm regards,<br><strong>Mrs. Yinka Isikalu</strong></p>
    <p class="text-xs mt-2 text-center">POWERED BY <span style="color:#FFEB3B">POG</span></p>
  `;
}

function getTopicsFromAnswers(subject, answers) {
  if (subject.toLowerCase() === "math") return ["Addition", "Subtraction", "Fractions"];
  if (subject.toLowerCase() === "ela") return ["Reading Comprehension", "Grammar", "Vocabulary"];
  if (subject.toLowerCase() === "biology") return ["Cells", "Genetics", "Ecology"];
  if (subject.toLowerCase() === "chemistry") return ["Atoms", "Compounds", "Reactions"];
  if (subject.toLowerCase() === "physics") return ["Motion", "Energy", "Forces"];
  return ["General Topics"];
}

function getRecommendations(subject, topics) {
  return `To support growth in ${subject}, we recommend focused review on ${topics.join(', ')}. Your child's tutor will guide these improvements.`;
}

loadReports();
