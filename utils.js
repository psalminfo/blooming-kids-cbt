// utils.js
import { db } from './firebaseConfig.js'; // only import what you use

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
