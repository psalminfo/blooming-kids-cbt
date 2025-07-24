// Save report to localStorage
function saveTestReport(report) {
  const reports = JSON.parse(localStorage.getItem('bkh_reports')) || [];

  // Prevent duplicate (optional but clean)
  const filtered = reports.filter(r =>
    !(r.studentName === report.studentName &&
      r.studentEmail === report.studentEmail &&
      r.subject === report.subject &&
      r.grade === report.grade)
  );

  filtered.push(report);
  localStorage.setItem('bkh_reports', JSON.stringify(filtered));
}

// Create a new report object
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

// Get all reports for admin view
function getAllReports() {
  return JSON.parse(localStorage.getItem('bkh_reports')) || [];
}

// Get filtered reports for parent view
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

// Admin auth redirect
function checkAdminAuth() {
  const loggedIn = localStorage.getItem('isAdminLoggedIn');
  if (!loggedIn) {
    window.location.href = 'admin-panel.html';
  }
}
