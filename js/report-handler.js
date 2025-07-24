// Save report from test submission
function saveTestReport(report) {
  const reports = JSON.parse(localStorage.getItem('bkh_reports')) || [];

  // Prevent duplicates (by subject + grade + student name + email)
  const filtered = reports.filter(r =>
    !(r.studentName === report.studentName &&
      r.studentEmail === report.studentEmail &&
      r.subject === report.subject &&
      r.grade === report.grade)
  );

  filtered.push(report);
  localStorage.setItem('bkh_reports', JSON.stringify(filtered));
}

// Use this in your submitTest() like:
// const report = generateTestReport(...); saveTestReport(report);

// Structure the report (for test submission)
function generateTestReport(studentName, studentEmail, subject, grade, score, total, performanceSummary = "", skillBreakdown = [], recommendations = []) {
  return {
    studentName,
    studentEmail,
    subject,
    grade,
    score,
    total,
    percentage: Math.round((score / total) * 100),
    performanceSummary,
    skillBreakdown,
    recommendations,
    date: new Date().toLocaleString()
  };
}

// Get all reports (for admin)
function getAllReports() {
  return JSON.parse(localStorage.getItem('bkh_reports')) || [];
}

// Filter reports for a parent (by student name and email)
function getParentReport(studentName, studentEmail) {
  const reports = getAllReports();
  return reports.filter(report =>
    report.studentName.toLowerCase() === studentName.toLowerCase() &&
    report.studentEmail.toLowerCase() === studentEmail.toLowerCase()
  );
}

// Admin logout
function logoutAdmin() {
  localStorage.removeItem('isAdminLoggedIn');
  window.location.href = 'index.html';
}

// Check admin auth and redirect if not logged in
function checkAdminAuth() {
  const loggedIn = localStorage.getItem('isAdminLoggedIn');
  if (!loggedIn) {
    window.location.href = 'admin-panel.html';
  }
}
