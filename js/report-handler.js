// Store report in localStorage after test submission
function saveReportToLocalStorage(report) {
  const reports = JSON.parse(localStorage.getItem('bkh_reports')) || [];
  reports.push(report);
  localStorage.setItem('bkh_reports', JSON.stringify(reports));
}

// Generate a test report object
function generateReport(studentName, studentEmail, subject, grade, score, performanceSummary, skillBreakdown, recommendations) {
  return {
    studentName,
    studentEmail,
    subject,
    grade,
    score,
    performanceSummary,
    skillBreakdown,
    recommendations,
    date: new Date().toLocaleString()
  };
}

// Retrieve all reports (admin view)
function getAllReports() {
  return JSON.parse(localStorage.getItem('bkh_reports')) || [];
}

// Filter report for parent based on name and email
function getParentReport(name, email) {
  const reports = getAllReports();
  return reports.filter(report =>
    report.studentName.toLowerCase() === name.toLowerCase() &&
    report.studentEmail.toLowerCase() === email.toLowerCase()
  );
}

// Logout from admin and redirect to homepage
function logoutAdmin() {
  localStorage.removeItem('isAdminLoggedIn');
  window.location.href = 'index.html';
}

// Check if admin is logged in
function checkAdminAuth() {
  const loggedIn = localStorage.getItem('isAdminLoggedIn');
  if (!loggedIn) {
    window.location.href = 'admin-panel.html';
  }
}
