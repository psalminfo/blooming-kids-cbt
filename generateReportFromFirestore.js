export async function generateAndDownloadReport(data) {
  const {
    studentName,
    studentEmail,
    parentEmail,
    grade,
    subject,
    score,
    total,
    tutorName,
    date
  } = data;

  const percentage = ((score / total) * 100).toFixed(1);
  const recommendation = getRecommendation(subject, percentage, tutorName);

  const reportHTML = `
    <div style="font-family: Arial, sans-serif; padding: 30px; line-height: 1.6; max-width: 800px; margin: auto;">
      <h1 style="text-align: center; color: #4CAF50;">Blooming Kids House - Assessment Report</h1>
      <hr/>
      <p><strong>Student Name:</strong> ${studentName}</p>
      <p><strong>Grade:</strong> ${grade}</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Score:</strong> ${score} / ${total} (${percentage}%)</p>
      <p><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</p>

      <h3 style="margin-top: 30px;">📢 Director's Message</h3>
      <p>Thank you for trusting Blooming Kids House with your child’s learning journey. Our team is committed to providing the best support to help every learner grow. – <strong>Mrs. Yinka Isikalu</strong>, Director</p>

      <h3 style="margin-top: 30px;">📌 Recommendation</h3>
      <p>${recommendation}</p>

      <h3 style="margin-top: 30px;">👨‍🏫 Assigned Tutor</h3>
      <p>${tutorName}</p>

      <footer style="margin-top: 40px; text-align: center;">
        <p>POWERED BY <span style="color:#FFEB3B;">POG</span></p>
      </footer>
    </div>
  `;

  const opt = {
    margin:       0.3,
    filename:     `${studentName.replace(/\s/g, "_")}_Report.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2 },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  const element = document.createElement("div");
  element.innerHTML = reportHTML;
  document.body.appendChild(element);

  await html2pdf().set(opt).from(element).save();

  document.body.removeChild(element);
}

function getRecommendation(subject, percentage, tutorName) {
  let message = `Based on the result, we recommend tailored support sessions to strengthen understanding of key ${subject} concepts. `;

  if (percentage < 60) {
    message += `Your child would benefit greatly from foundational reviews and guided practice. Our tutor, ${tutorName}, will ensure they receive step-by-step coaching.`;
  } else if (percentage < 80) {
    message += `Reinforcement in select areas can help boost confidence and mastery. ${tutorName} will focus on topics that need improvement.`;
  } else {
    message += `Great job! To maintain this level and prepare for advanced topics, ${tutorName} will continue with skill-building and enrichment activities.`;
  }

  return message;
}
