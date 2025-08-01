async function fetchStudentResult() {
  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();
  const errorEl = document.getElementById("error");

  if (!studentName || !parentEmail) {
    errorEl.textContent = "Please enter both student name and parent email.";
    errorEl.classList.remove("hidden");
    return;
  }

  try {
    const querySnapshot = await firebase.firestore()
      .collection("student_results")
      .where("studentName", "==", studentName)
      .where("parentEmail", "==", parentEmail)
      .get();

    if (querySnapshot.empty) {
      errorEl.textContent = "No results found for this student and parent combination.";
      errorEl.classList.remove("hidden");
      return;
    }

    const doc = querySnapshot.docs[0].data();
    generateReport(doc); // This will call generateReport from generateReport.js
  } catch (err) {
    console.error(err);
    errorEl.textContent = "An error occurred while fetching the report.";
    errorEl.classList.remove("hidden");
  }
}
