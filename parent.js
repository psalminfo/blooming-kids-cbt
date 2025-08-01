document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("parentLoginForm");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const studentName = document.getElementById("studentName").value.trim();
    const parentEmail = document.getElementById("parentEmail").value.trim();

    try {
      const querySnapshot = await db
        .collection("student_results")
        .where("studentName", "==", studentName)
        .where("parentEmail", "==", parentEmail)
        .orderBy("timestamp", "desc")
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        alert("No report found for this student and parent email.");
        return;
      }

      const reportData = querySnapshot.docs[0].data();
      const reportURL = reportData.reportUrl;

      if (reportURL) {
        window.open(reportURL, "_blank");
      } else {
        alert("Report exists but no URL found.");
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      alert("An error occurred. Please try again later.");
    }
  });
});
