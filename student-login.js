document.getElementById("studentLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();
  const grade = document.getElementById("grade").value;
  const tutorName = document.getElementById("tutorName").value.trim();
  const location = document.getElementById("location").value.trim();
  const accessCode = document.getElementById("accessCode").value.trim();

  if (accessCode !== "bkh2025") {
    alert("Invalid access code.");
    return;
  }

  // Use Firebase anonymous auth
  try {
    const result = await firebase.auth().signInAnonymously();

    // Save user info to Firestore
    const db = firebase.firestore();
    await db.collection("users").doc(result.user.uid).set({
      uid: result.user.uid,
      role: "student",
      studentName,
      parentEmail,
      tutorName,
      location,
      grade,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Store locally and redirect
    sessionStorage.setItem("studentData", JSON.stringify({
      uid: result.user.uid,
      studentName,
      parentEmail,
      tutorName,
      location,
      grade
    }));

    window.location.href = "subject-select.html";
  } catch (error) {
    console.error("Login failed:", error);
    alert("Login failed. Try again.");
  }
});
