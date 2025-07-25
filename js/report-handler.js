// js/report-handler.js
import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Save report to Firestore
export async function saveTestReport(report) {
  try {
    await addDoc(collection(db, "reports"), report);
    console.log("Report saved successfully");
  } catch (e) {
    console.error("Error saving report:", e);
  }
}

// Format the report
export function generateTestReport(name, email, subject, grade, score, totalQuestions) {
  const percentage = Math.round((score / totalQuestions) * 100);
  const performanceSummary = percentage >= 80 ? "Excellent performance" :
                             percentage >= 60 ? "Satisfactory performance" :
                             "Needs Improvement";

  const skillBreakdown = [
    "Comprehension and Vocabulary",
    "Writing and Grammar",
    "Listening and Speaking",
    "Reading Fluency"
  ];

  const recommendations = percentage >= 80
    ? ["Continue practicing with advanced materials", "Explore creative writing"]
    : percentage >= 60
    ? ["Revise basic grammar concepts", "Read daily to build fluency"]
    : ["Seek help with reading strategies", "Focus on decoding and phonics"];

  return {
    studentName: name,
    studentEmail: email,
    subject,
    grade,
    score,
    totalQuestions,
    percentage,
    performanceSummary,
    skillBreakdown,
    recommendations,
    timestamp: new Date().toISOString()
  };
}

// Admin: fetch all reports
export async function getAllReports() {
  const snapshot = await getDocs(collection(db, "reports"));
  return snapshot.docs.map(doc => doc.data());
}

// Parent: fetch specific student reports
export async function getParentReport(name, email) {
  const q = query(
    collection(db, "reports"),
    where("studentName", "==", name),
    where("studentEmail", "==", email)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}
