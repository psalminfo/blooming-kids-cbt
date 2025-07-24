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
  const percentage = Math.round((score / totalQuestions) * 100);

  // Basic performance summary
  let performanceSummary = '';
  if (percentage >= 90) {
    performanceSummary = 'Excellent performance. Keep up the good work!';
  } else if (percentage >= 75) {
    performanceSummary = 'Good job. There is room for improvement.';
  } else if (percentage >= 50) {
    performanceSummary = 'Fair attempt. Focus more on understanding key concepts.';
  } else {
    performanceSummary = 'Needs significant improvement. Consider reviewing foundational topics.';
  }

  // Basic skill breakdown and recommendations (editable as needed)
  const skillBreakdown = [];
  const recommendations = [];

  if (subject.toLowerCase().includes('math')) {
    skillBreakdown.push("Number sense", "Operations", "Fractions", "Geometry", "Data interpretation");
    recommendations.push(
      "Review basic addition, subtraction, multiplication, and division.",
      "Practice word problems daily.",
      "Use flashcards or games to reinforce math facts."
    );
  } else if (subject.toLowerCase().includes('english') || subject.toLowerCase().includes('ela')) {
    skillBreakdown.push("Reading comprehension", "Grammar", "Spelling", "Punctuation", "Vocabulary");
    recommendations.push(
      "Read a short passage daily and summarize it.",
      "Practice identifying parts of speech in sentences.",
      "Work on common spelling and punctuation rules."
    );
  }

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
