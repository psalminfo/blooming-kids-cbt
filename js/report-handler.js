// Save a single report to localStorage
function saveReportToLocalStorage(report) {
  const reports = JSON.parse(localStorage.getItem('bkh_reports')) || [];
  reports.push(report);
  localStorage.setItem('bkh_reports', JSON.stringify(reports));
}

// Wrapper used by test pages
function saveTestReport(report) {
  saveReportToLocalStorage(report);
}

// Generates a full test report
function generateTestReport(name, email, subject, grade, score, totalQuestions) {
  const percentage = Math.round((score / totalQuestions) * 100);

  // Auto-generated performance summary
  let performanceSummary = '';
  if (percentage === 100) {
    performanceSummary = "Excellent work! You got everything correct.";
  } else if (percentage >= 80) {
    performanceSummary = "Great job! You're performing well in this subject.";
  } else if (percentage >= 50) {
    performanceSummary = "You're getting there. A little more practice will help.";
  } else {
    performanceSummary = "You need more revision and practice in this subject.";
  }

  // Auto-generated skill breakdown (generic since individual skills per question aren’t tagged yet)
  const skillBreakdown = [
    "Reading comprehension",
    "Vocabulary development",
    "Grammar and punctuation",
    "Writing structure",
    "Critical thinking"
  ];

  // Auto-generated recommendations
  let recommendations = [];
  if (percentage < 100) recommendations.push("Review missed questions carefully.");
  if (percentage < 80) recommendations.push("Spend more time on reading assignments.");
  if (percentage < 60) recommendations.push("Request a tutor follow-up session.");
  if (percentage < 50) recommendations.push("Consider re-taking the test after review.");

  return {
    studentName: name,
    studentEmail: email,
    subject: subject,
    grade: grade,
    score: score,
    totalQuestions: totalQuestions,
    percentage: percentage,
    performanceSummary: performanceSummary,
    skillBreakdown: skillBreakdown,
    recommendations: recommendations,
    timestamp: new Date().toISOString()
  };
}

// Retrieve all reports (for admin)
function getAllReports() {
  return JSON.parse(localStorage.getItem('bkh_reports')) || [];
}

// Retrieve reports for parent login
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

// Admin auth check
function checkAdminAuth() {
  const loggedIn = localStorage.getItem('isAdminLoggedIn');
  if (!loggedIn) {
    window.location.href = 'admin-panel.html';
  }
}
