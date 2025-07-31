import {
  query,
  collection,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { db, auth } from "./firebaseConfig.js"; // Only import db and auth

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "parent.html"; // redirect if not logged in
  } else {
    const studentName = localStorage.getItem("studentName");
    const parentEmail = localStorage.getItem("parentEmail");

    if (!studentName || !parentEmail) {
      alert("Missing student or parent info.");
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
  }
});
