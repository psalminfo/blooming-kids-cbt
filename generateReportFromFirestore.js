import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const urlParams = new URLSearchParams(window.location.search);
const studentName = urlParams.get("student");
const parentEmail = urlParams.get("email");

if (!studentName || !parentEmail) {
  document.body.innerHTML = "<div class='text-center mt-10 text-red-500 font-bold'>Missing student info. Please return to the parent portal.</div>";
  throw new Error("Missing query parameters");
}

async function loadReport() {
  const resultsRef = collection(db, "student_results");
  const q = query(resultsRef, where("studentName", "==", studentName), where("parentEmail", "==", parentEmail));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    document.body.innerHTML = "<div class='text-center mt-10 text-red-500 font-bold'>No report data found. Please go back to the parent portal.</div>";
    return;
  }

  const doc = querySnapshot.docs[0].data();

  // Fill in report fields
  document.getElementById("studentName").textContent = doc.studentName;
  document.getElementById("studentEmail").textContent = doc.studentEmail;
  document.getElementById("studentGrade").textContent = doc.grade;
  document.getElementById("studentScore").textContent = doc.score + "%";
  document.getElementById("tutorName").textContent = doc.tutorName;
  document.getElementById("recommendations").textContent = doc.recommendation;

  // Handle download button
  const downloadBtn = document.getElementById("downloadBtn");
  if (doc.reportFilePath) {
    const fileRef = ref(storage, doc.reportFilePath);
    const url = await getDownloadURL(fileRef);
    downloadBtn.onclick = () => {
      const a = document.createElement("a");
      a.href = url;
      a.download = "student-report.pdf";
      a.click();
    };
  } else {
    downloadBtn.disabled = true;
    downloadBtn.textContent = "PDF Unavailable";
  }

  // Logout button
  document.getElementById("logoutBtn").addEventListener("click", () => {
    window.location.href = "parent.html";
  });
}

loadReport().catch((err) => {
  console.error("Error loading report:", err);
  document.body.innerHTML = "<div class='text-center mt-10 text-red-500 font-bold'>An error occurred while loading the report. Please try again later.</div>";
});
