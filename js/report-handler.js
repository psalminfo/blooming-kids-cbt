// js/report-handler.js
import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 🔹 Save report to Firestore
export async function saveTestReport(report) {
  try {
    await addDoc(collection(db, "reports"), report);
    console.log("Report saved successfully");
  } catch (e) {
    console.error("Error saving report:", e);
  }
}

// 🔹 Generate full test report object
export function generateTestReport(name, parentEmail, subject, grade, score, totalQuestions) {
  const percentage = Math.round((score / totalQuestions) * 100);
  const performanceSummary =
    percentage >= 90 ? "Outstanding performance" :
    percentage >= 75 ? "Strong performance" :
    percentage >= 60 ? "Satisfactory performance" :
    "Needs improvement. Support required.";

  // Sample skill breakdown by subject (can later be customized)
  const skillBreakdown = subject.toLowerCase().includes("math")
    ? ["Numerical fluency", "Word problems", "Geometry and shapes", "Data interpretation"]
    : ["Reading comprehension", "Grammar", "Vocabulary", "Writing clarity"];

  // Personalized recommendations
  const recommendations = percentage >= 90
    ? [
        "Keep challenging the student with enrichment tasks.",
        "Introduce project-based assessments to apply concepts."
      ]
    : percentage >= 75
    ? [
        "Encourage regular independent practice.",
        "Provide structured writing prompts weekly."
      ]
    : percentage >= 60
    ? [
        "Review foundational topics weekly.",
        "Offer short daily tasks for fluency."
      ]
    : [
        "One-on-one tutoring is highly recommended.",
        "Focus on foundational concepts through guided practice."
      ];

  return {
    studentName: name,
    parentEmail: parentEmail,
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

// 🔹 Admin: Fetch all reports
export async function getAllReports() {
  const snapshot = await getDocs(collection(db, "reports"));
  return snapshot.docs.map(doc => doc.data());
}

// 🔹 Parent: Fetch student reports
export async function getParentReport(name, parentEmail) {
  const q = query(
    collection(db, "reports"),
    where("studentName", "==", name),
    where("parentEmail", "==", parentEmail)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data());
}
