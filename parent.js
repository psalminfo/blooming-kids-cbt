import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { generateAndDownloadReport } from "./generateReportFromFirestore.js";
import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.getElementById("report-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const studentName = document.getElementById("student-name").value.trim();
  const parentEmail = document.getElementById("parent-email").value.trim();

  const reportsRef = collection(db, "testResults");
  const q = query(reportsRef, where("studentName", "==", studentName), where("parentEmail", "==", parentEmail));

  try {
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("No report found. Please check the student's name and your email.");
      return;
    }

    // Assuming one match — pick the first result
    const docData = querySnapshot.docs[0].data();

    // Dynamically generate and download PDF from Firestore data
    await generateAndDownloadReport(docData);

  } catch (error) {
    console.error("Error fetching report:", error);
    alert("Something went wrong. Please try again.");
  }
});
