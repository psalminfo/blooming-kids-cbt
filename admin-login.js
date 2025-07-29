import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword } from 'firebase/auth';

const ADMIN_EMAIL = "psalm4all@gmail.com";
const ADMIN_PASSWORD = "oladunjoyE25";

document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return alert("Unauthorized access. Invalid credentials.");
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "admin.html";
  } catch (error) {
    console.error(error);
    alert("Login failed.");
  }
});
