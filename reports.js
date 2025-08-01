// report.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-lite.js";
import html2pdf from "https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
  authDomain: "bloomingkidsassessment.firebaseapp.com",
  projectId: "bloomingkidsassessment",
  storageBucket: "bloomingkidsassessment.appspot.com",
  messagingSenderId: "238975054977",
  appId: "1:238975054977:web:87c70b4db044998a204980"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Load from sessionStorage
const studentName = sessionStorage.getItem("studentName");

if (!studentName) {
  alert("Missing student info. Please return to the parent portal.");
  window.location.href = "parent.html";
}

// Query Firestore for student result
async function loadReport() {
  const q = query(collection(db, "student_results"), where("studentName", "==", studentName));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    alert("No report found for this student.");
    return;
  }

  const data = snapshot.docs[0].data();

  // Fill in fields
  document.getElementById("student-name").textContent = data.studentName || "N/A";
  document.getElementById("student-grade").textContent = data.grade || "N/A";
  document.getElementById("student-email").textContent = data.email || "N/A";
  document.getElementById("tutor-name").textContent = data.tutor || "N/A";

  // Subject Scores
  const subjectContainer = document.getElementById("subject-scores");
  subjectContainer.innerHTML = "";
  Object.entries(data.scores || {}).forEach(([subject, score]) => {
    const div = document.createElement("div");
    div.className = "mb-2";
    div.innerHTML = `<strong>${subject}:</strong> ${score}/30`;
    subjectContainer.appendChild(div);
  });

  // Personalized Recommendation
  const rec = generateRecommendation(data);
  document.getElementById("recommendation-text").textContent = rec;
}

// Recommendation logic
function generateRecommendation(data) {
  const tutor = data.tutor || "our tutor";
  const subjects = Object.entries(data.scores || {});
  const lowSubjects = subjects.filter(([_, score]) => score < 20).map(([s]) => s);

  if (lowSubjects.length === 0) {
    return `Great job! ${data.studentName} performed well in all subjects. Continued practice with ${tutor} will strengthen understanding.`;
  }

  return `We recommend targeted support in ${lowSubjects.join(", ")} to build stronger foundations. ${tutor} will guide ${data.studentName} in mastering these areas.`;
}

// Download PDF
document.getElementById("download-btn").addEventListener("click", () => {
  html2pdf().from(document.body).save(`${studentName}-report.pdf`);
});

// Logout
document.getElementById("logout-btn").addEventListener("click", () => {
  sessionStorage.clear();
  window.location.href = "parent.html";
});

// Load report now
loadReport();
