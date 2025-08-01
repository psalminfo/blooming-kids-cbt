import { db, storage } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-storage.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("parentLoginForm");
  const reportSection = document.getElementById("reportSection");
  const pdfPreview = document.getElementById("pdfPreview");
  const downloadLink = document.getElementById("downloadLink");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const studentName = document.getElementById("studentName").value.trim();
    const parentEmail = document.getElementById("parentEmail").value.trim();

    if (!studentName || !parentEmail) return;

    try {
      const resultsRef = collection(db, "student_results");
      const q = query(resultsRef, where("studentName", "==", studentName), where("parentEmail", "==", parentEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("No report found for this student and parent email.");
        return;
      }

      const reportDoc = querySnapshot.docs[0].data();
      const reportFileName = reportDoc.reportFileName;

      if (!reportFileName) {
        alert("Report found but missing file reference.");
        return;
      }

      const fileRef = ref(storage, `reports/${reportFileName}`);
      const downloadURL = await getDownloadURL(fileRef);

      // Show preview
      pdfPreview.src = downloadURL;
      downloadLink.href = downloadURL;
      downloadLink.download = `${studentName}_report.pdf`;

      reportSection.classList.remove("hidden");

    } catch (error) {
      console.error("Error fetching report:", error);
      alert("An error occurred. Please try again later.");
    }
  });
});
