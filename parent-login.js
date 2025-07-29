document.getElementById("parentLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const studentName = document.getElementById("studentName").value.trim().toLowerCase();
  const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();

  if (!studentName || !parentEmail) {
    alert("Please fill in both fields.");
    return;
  }

  try {
    // Search for matching report in Firestore
    const db = firebase.firestore();
    const reportsRef = db.collection("reports");

    const snapshot = await reportsRef
      .where("studentNameLower", "==", studentName)
      .where("parentEmailLower", "==", parentEmail)
      .get();

    if (snapshot.empty) {
      alert("No report found for the provided details.");
      return;
    }

    // Save report metadata and redirect
    const reportData = [];
    snapshot.forEach((doc) => reportData.push(doc.data()));
    sessionStorage.setItem("parentReportData", JSON.stringify(reportData));

    window.location.href = "parent.html";
  } catch (err) {
    console.error("Parent login error:", err);
    alert("Error retrieving report. Please try again.");
  }
});
