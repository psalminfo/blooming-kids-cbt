// utils.js
import { auth, db } from './firebaseConfig.js';

export function logout() {
  localStorage.removeItem("studentData");
  window.location.href = "index.html";
}

export function getStudentData() {
  const data = localStorage.getItem("studentData");
  return data ? JSON.parse(data) : null;
}

export function saveStudentData(studentData) {
  localStorage.setItem("studentData", JSON.stringify(studentData));
}
