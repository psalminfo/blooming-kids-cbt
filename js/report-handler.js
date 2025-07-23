// Store the score after each test
function saveSubjectScore(subject, score) {
  const studentName = sessionStorage.getItem("studentName");
  const studentEmail = sessionStorage.getItem("studentEmail");

  if (!studentName || !studentEmail) return;

  const reportKey = `${studentName}_${studentEmail}_report`;
  let reportData = JSON.parse(localStorage.getItem(reportKey)) || {};

  reportData[subject] = {
    score: score,
    date: new Date().toLocaleString()
  };

  localStorage.setItem(reportKey, JSON.stringify(reportData));
}

// Generate report for one student
function getStudentReport(name, email) {
  const reportKey = `${name}_${email}_report`;
  const report = JSON.parse(localStorage.getItem(reportKey));
  return report || null;
}

// Generate all student reports for admin
function getAllReports() {
  const allReports = [];

  for (let key in localStorage) {
    if (key.includes("_report")) {
      const [studentName, studentEmail] = key.split("_report")[0].split("_");
      const data = JSON.parse(localStorage.getItem(key));
      allReports.push({
        name: studentName,
        email: studentEmail,
        subjects: data
      });
    }
  }

  return allReports;
}

// Clear a student's report (optional)
function clearStudentReport(name, email) {
  const reportKey = `${name}_${email}_report`;
  localStorage.removeItem(reportKey);
}
