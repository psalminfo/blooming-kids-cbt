import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebaseConfig.js";

// Immediately run everything without waiting for auth
(async () => {
  const studentName = localStorage.getItem("studentName");
  const parentEmail = localStorage.getItem("parentEmail");

  if (!studentName || !parentEmail) {
    alert("Missing student or parent info.");
    window.location.href = "parent.html";
    return;
  }

  try {
    const resultQuery = query(
      collection(db, "results"),
      where("studentName", "==", studentName),
      where("parentEmail", "==", parentEmail)
    );

    const querySnapshot = await getDocs(resultQuery);

    if (querySnapshot.empty) {
      alert("No report found for this student.");
      return;
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log("Student Report Data:", data);

      // ✨ INSERT your PDF generation or display code here
      // e.g. generatePDF(data);
    });

  } catch (error) {
    console.error("Error fetching report:", error);
  }
})();
