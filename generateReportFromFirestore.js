import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Extract query params
const params = new URLSearchParams(window.location.search);
const studentName = params.get("student");
const parentEmail = params.get("email");

// Fetch and display report
async function loadReport() {
  if (!studentName || !parentEmail) {
    document.body.innerHTML = "<div class='text-center text-red-500 font-bold mt-10'>Missing student info. Please return to parent portal.</div>";
    return;
  }

  const q = query(
    collection(db, "student_results"),
    where("studentName", "==", studentName),
    where("parentEmail", "==", parentEmail)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    document.body.innerHTML = "<div class='text-center text-red-500 font-bold mt-10'>No report found for this student. Please go back and try again.</div>";
    return;
  }

  const doc = querySnapshot.docs[0];
  const data = doc.data();

  // Populate report
  document.getElementById("studentName").textContent = data.studentName || "N/A";
  document.getElementById("studentEmail").textContent = data.studentEmail || "N/A";
  document.getElementById("grade").textContent = data.grade || "N/A";
  document.getElementById("score").textContent = data.score || "N/A";
  document.getElementById("tutorName").textContent = data.tutorName || "N/A";
  document.getElementById("recommendation").textContent = data.recommendation || "Your child would benefit from structured support aligned with their curriculum. We recommend 1:1 tutoring sessions tailored to Math and ELA topics like fractions, grammar, and comprehension. Their tutor, " + (data.tutorName || "N/A") + ", is ready to help them succeed.";

  // PDF Download
  document.getElementById("downloadBtn").addEventListener("click", () => {
    const docPDF = new jsPDF();
    docPDF.setFontSize(16);
    docPDF.text("Blooming Kids House - Student Report", 20, 20);
    docPDF.setFontSize(12);
    docPDF.text(`Name: ${data.studentName}`, 20, 40);
    docPDF.text(`Email: ${data.studentEmail}`, 20, 50);
    docPDF.text(`Grade: ${data.grade}`, 20, 60);
    docPDF.text(`Score: ${data.score}`, 20, 70);
    docPDF.text(`Tutor: ${data.tutorName}`, 20, 80);
    docPDF.text("Recommendation:", 20, 100);
    docPDF.text(docWrapText(data.recommendation, 90), 20, 110);
    docPDF.save(`${data.studentName}-report.pdf`);
  });

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", () => {
    window.location.href = "parent.html";
  });
}

// Wrap text for PDF
function docWrapText(text, maxWidth) {
  const doc = new jsPDF();
  return doc.splitTextToSize(text, maxWidth);
}

// Trigger on load
loadReport();
