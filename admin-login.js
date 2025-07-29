document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  if (email !== "psalm4all@gmail.com" || password !== "oladunjoyE25") {
    alert("Invalid credentials.");
    return;
  }

  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
    window.location.href = "admin.html";
  } catch (error) {
    console.error("Admin login failed:", error);
    alert("Login failed. Please check credentials or try again later.");
  }
});
