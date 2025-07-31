import {
  db,
  auth,
  collection,
  query,
  where,
  getDocs
} from "./firebaseConfig.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Optional: Check if parent is logged in (if using auth)
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
        // TODO: Generate PDF report or populate HTML with data
      });

    } catch (error) {
      console.error("Error fetching report:", error);
    }
  }
});
