document.getElementById("studentLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const studentName = document.getElementById("studentName").value;
  const parentEmail = document.getElementById("parentEmail").value;
  const grade = document.getElementById("grade").value;
  const tutorName = document.getElementById("tutorName").value;
  const location = document.getElementById("location").value;
  const accessCode = document.getElementById("accessCode").value;

  if (accessCode !== "bkh2025") {
    alert("Invalid access code");
    return;
  }

  firebase.auth().signInAnonymously()
    .then(() => {
      localStorage.setItem("studentName", studentName);
      localStorage.setItem("parentEmail", parentEmail);
      localStorage.setItem("grade", grade);
      localStorage.setItem("tutorName", tutorName);
      localStorage.setItem("location", location);
      localStorage.setItem("timestamp", new Date().toISOString());

      window.location.href = "subject-select.html";
    })
    .catch((error) => {
      console.error("Login error", error);
      alert("Login failed. Try again.");
    });
});
