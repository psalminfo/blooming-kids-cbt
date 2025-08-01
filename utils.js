// utils.js
import { auth } from './firebaseConfig.js';
import { signOut } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-auth.js";

export function logout() {
  // Sign out from Firebase
  signOut(auth)
    .then(() => {
      localStorage.removeItem("studentData");
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Logout error:", error);
      // Still redirect even if Firebase sign-out fails
      localStorage.removeItem("studentData");
      window.location.href = "index.html";
    });
}

export function getStudentData() {
  const data = localStorage.getItem("studentData");
  return data ? JSON.parse(data) : null;
}

export function saveStudentData(studentData) {
  localStorage.setItem("studentData", JSON.stringify(studentData));
}
