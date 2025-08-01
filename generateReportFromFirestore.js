// generateReportFromFirestore.js
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";
import { db } from './firebaseConfig.js';

export async function fetchStudentResult(studentName, parentEmail) {
  try {
    const resultRef = collection(db, "results");
    const q = query(resultRef,
      where("studentName", "==", studentName),
      where("parentEmail", "==", parentEmail)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      throw new Error("No matching result found for this student.");
    }

    // Assuming only one result per student
    const resultData = querySnapshot.docs[0].data();
    return resultData;

  } catch (error) {
    console.error("Error fetching result:", error.message);
    throw error;
  }
}
