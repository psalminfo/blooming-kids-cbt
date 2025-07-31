import {
  query,
  collection,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db } from "./firebaseConfig.js"; // Only need db, not auth

(async () => {
  const studentName = localStorage.getItem("studentName");
  const parentEmail = localStorage.getItem("parentEmail");

  if (!studentName || !parentEmail) {
    alert("Missing student or parent info.");
    window.location.href = "parent.html"; // return to parent login
    return;
  }

  try {
    const q = query(
      collection(db, "results"),
      where("studentName", "==", studentName),
      where("parentEmail", "==", parentEmail)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("No report found for this student.");
      return;
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log("Student Report Data:", data);
      // TODO: Generate PDF report or populate HTML
    });

  } catch (error) {
    console.error("Error fetching report:", error);
  }
})();
