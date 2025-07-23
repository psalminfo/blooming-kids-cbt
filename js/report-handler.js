// js/report-handler.js

// Save a test report to localStorage
function saveReportToLocalStorage(name, grade, subject, score) {
  const existingReports = JSON.parse(localStorage.getItem("studentReports") || "[]");

  const newReport = {
    name: name.trim(),
    grade: grade,
    subject: subject,
    score: score,
    date: new Date().toLocaleString()
  };

  // Add new report to the array
  existingReports.push(newReport);

  // Save back to localStorage
  localStorage.setItem("studentReports", JSON.stringify(existingReports));
}

// Fetch all reports from localStorage
function getAllReportsFromLocalStorage() {
  return JSON.parse(localStorage.getItem("studentReports") || "[]");
}

// Filter reports by student name and email (used in parent panel)
function getStudentReports(name, email) {
  const allReports = getAllReportsFromLocalStorage();

  return allReports.filter(
    (report) => report.name.toLowerCase() === name.toLowerCase() &&
                (report.email ? report.email.toLowerCase() === email.toLowerCase() : true)
  );
}

// Optional: Clear all reports (for admin use)
function clearAllReports() {
  localStorage.removeItem("studentReports");
}
