// ✅ Save test report to localStorage
function saveTestReport(report) {
  const reports = JSON.parse(localStorage.getItem("bkh_reports") || "[]");
  reports.push(report);
  localStorage.setItem("bkh_reports", JSON.stringify(reports));
}

// ✅ Generate report structure
function generateTestReport(name, email, subject, grade, score, totalQuestions) {
  const percentage = (score / totalQuestions) * 100;
  let performance = "";

  if (percentage >= 90) performance = "Excellent";
  else if (percentage >= 75) performance = "Good";
  else if (percentage >= 60) performance = "Fair";
  else performance = "Needs Improvement";

  return {
    studentName: name,
    studentEmail: email,
    grade: grade,
    subject: subject,
    score: score,
    totalQuestions: totalQuestions,
    percentage: percentage.toFixed(2),
    performance: performance,
    timestamp: new Date().toISOString()
  };
}

// ✅ Admin and parent report features (already present, keep them as-is)
function saveReportToLocalStorage(report) {
  const reports = JSON.parse(localStorage.getItem('bkh_reports')) || [];
  reports.push(report);
  localStorage.setItem('bkh_reports', JSON.stringify(reports));
}

function getAllReports() {
  return JSON.parse(localStorage.getItem('bkh_reports')) || [];
}

function getParentReport(name, email) {
  const reports = getAllReports();
  return reports.filter(report =>
    report.studentName.toLowerCase() === name.toLowerCase() &&
    report.studentEmail.toLowerCase() === email.toLowerCase()
  );
}

function logoutAdmin() {
  localStorage.removeItem('isAdminLoggedIn');
  window.location.href = 'index.html';
}

function checkAdminAuth() {
  const loggedIn = localStorage.getItem('isAdminLoggedIn');
  if (!loggedIn) window.location.href = 'admin-panel.html';
}
