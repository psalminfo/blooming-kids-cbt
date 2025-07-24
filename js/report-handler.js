// Save a single report to localStorage
function saveReportToLocalStorage(report) {
  const reports = JSON.parse(localStorage.getItem('bkh_reports')) || [];
  reports.push(report);
  localStorage.setItem('bkh_reports', JSON.stringify(reports));
}

// Wrapper used by test pages (expected name)
function saveTestReport(report) {
  saveReportToLocalStorage(report);
}

// Used by test pages to format the report
function generateTestReport(name, email, subject, grade, score, totalQuestions) {
  return {
    studentName: name,
    studentEmail: email,
    subject: subject,
    grade: grade,
    score: score,
    totalQuestions: totalQuestions,
    timestamp: new Date().toISOString()
  };
}

// Retrieve all reports (used by admin)
function getAllReports() {
  return JSON.parse(localStorage.getItem('bkh_reports')) || [];
}

// Filter reports for a specific parent login
function getParentReport(name, email) {
  const reports = getAllReports();
  return reports.filter(report =>
    report.studentName.toLowerCase() === name.toLowerCase() &&
    report.studentEmail.toLowerCase() === email.toLowerCase()
  );
}

// Admin authentication helpers
function logoutAdmin() {
  localStorage.removeItem('isAdminLoggedIn');
  window.location.href = 'index.html';
}

function checkAdminAuth() {
  const loggedIn = localStorage.getItem('isAdminLoggedIn');
  if (!loggedIn) {
    window.location.href = 'admin-panel.html';
  }
}
