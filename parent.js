// parent.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.getElementById("parentForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();

  const studentNameLower = studentName.toLowerCase();
  const parentEmailLower = parentEmail.toLowerCase();

  const resultsRef = collection(db, "student_results");
  const q = query(
    resultsRef,
    where("studentNameLower", "==", studentNameLower),
    where("parentEmailLower", "==", parentEmailLower)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    alert("No report found for this student. Please check name and email.");
    return;
  }

  const reportData = querySnapshot.docs[0].data();
  localStorage.setItem("studentReportData", JSON.stringify(reportData));

  window.location.href = "report.html";
});
