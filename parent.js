// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(app);

document.getElementById("parentLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();

  const errorMsg = document.getElementById("errorMsg");
  errorMsg.classList.add("hidden");

  try {
    const resultsRef = db.collection("student_results");
    const querySnapshot = await resultsRef
      .where("studentName", "==", studentName)
      .where("parentEmail", "==", parentEmail)
      .get();

    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();

      // Save data temporarily in localStorage to use in report.html
      localStorage.setItem("studentReportData", JSON.stringify(data));
      window.location.href = "report.html";
    } else {
      errorMsg.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Error fetching report:", error);
    alert("Something went wrong while fetching the report.");
  }
});
