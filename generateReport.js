import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { db, auth } from "./firebaseConfig.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "parent.html"; // Redirect if not logged in
    return;
  }

  const studentName = localStorage.getItem("studentName");
  const parentEmail = localStorage.getItem("parentEmail");

  if (!studentName || !parentEmail) {
    alert("Missing student or parent info.");
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

      // TODO: Add your PDF generation or display logic here
    });

  } catch (error) {
    console.error("Error fetching report:", error);
  }
});
