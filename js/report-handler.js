// Generate a report after test submission
function generateTestReport(name, email, subject, grade, score, total) {
  return {
    studentName: name,
    studentEmail: email,
    subject: subject,
    grade: grade,
    score: score,
    total: total,
    date: new Date().toLocaleString(),
  };
}

// Save report using standard function
function saveTestReport(report) {
  saveReportToLocalStorage(report);
}

// Save test report to localStorage
function saveReportToLocalStorage(report) {
  const reports = JSON.parse(localStorage.getItem('bkh_reports')) || [];
  reports.push(report);
  localStorage.setItem('bkh_reports', JSON.stringify(reports));
}

// Get all stored reports (for admin)
function getAllReports() {
  return JSON.parse(localStorage.getItem('bkh_reports')) || [];
}

// Get report for specific parent
function getParentReport(name, email) {
  const reports = getAllReports();
  return reports.filter(report =>
    report.studentName.toLowerCase() === name.toLowerCase() &&
    report.studentEmail.toLowerCase() === email.toLowerCase()
  );
}

// Admin logout
function logoutAdmin() {
  localStorage.removeItem('isAdminLoggedIn');
  window.location.href = 'index.html';
}

// Admin check
function checkAdminAuth() {
  const loggedIn = localStorage.getItem('isAdminLoggedIn');
  if (!loggedIn) window.location.href = 'admin-panel.html';
}

