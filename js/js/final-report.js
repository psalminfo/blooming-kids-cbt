// js/final-report.js

export function generateFinalReportText(studentName, parentEmail, grade, reports) {
  let reportText = `BLOOMING KIDS HOUSE ASSESSMENT REPORT\n\n`;
  reportText += `Student Name: ${studentName}\n`;
  reportText += `Parent Email: ${parentEmail}\n`;
  reportText += `Grade: ${grade}\n`;
  reportText += `Date: ${new Date().toLocaleString()}\n\n`;
  reportText += `--------------------------------------------------\n\n`;

  reports.forEach((report, index) => {
    reportText += `Subject ${index + 1}: ${report.subject}\n`;
    reportText += `Score: ${report.score} out of ${report.totalQuestions} (${report.percentage}%)\n`;
    reportText += `Performance Summary: ${report.performanceSummary}\n\n`;

    reportText += `Knowledge and Skills:\n`;
    report.skillBreakdown.forEach((skill, i) => {
      reportText += ` - ${skill}\n`;
    });

    reportText += `\nTutor Recommendations:\n`;
    report.recommendations.forEach((rec, i) => {
      reportText += ` • ${rec}\n`;
    });

    reportText += `\n--------------------------------------------------\n\n`;
  });

  reportText += `Thank you for trusting Blooming Kids House!\n`;
  reportText += `This report was automatically generated.\n`;

  return reportText;
}
