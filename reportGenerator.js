function generatePDFReport(studentData, reportData) {
  const { student, parent, tutor, location, grade, timestamp } = studentData;
  const { subjects, totalScore, totalPossible } = reportData;

  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("BLOOMING KIDS HOUSE ASSESSMENT REPORT", 105, 15, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`From the Director, Mrs. Yinka Isikalu`, 180, 22, { align: "right" });

  // Info table
  doc.setFont("helvetica", "bold");
  doc.text("Student:", 10, 30);
  doc.text("Parent:", 10, 36);
  doc.text("Tutor:", 10, 42);
  doc.text("Location:", 10, 48);
  doc.text("Grade:", 10, 54);
  doc.text("Date:", 10, 60);

  doc.setFont("helvetica", "normal");
  doc.text(student, 40, 30);
  doc.text(parent, 40, 36);
  doc.text(tutor, 40, 42);
  doc.text(location, 40, 48);
  doc.text(grade, 40, 54);
  doc.text(new Date(timestamp).toLocaleString(), 40, 60);

  // Subject Scores Table
  let startY = 70;
  doc.setFont("helvetica", "bold");
  doc.text("Performance Summary", 10, startY);
  startY += 6;

  doc.autoTable({
    startY,
    head: [["Subject", "Score", "Percentage", "Letter Grade"]],
    body: subjects.map((subj) => [
      subj.name,
      `${subj.correct}/${subj.total}`,
      `${subj.percent.toFixed(2)}%`,
      subj.grade
    ]),
    theme: "grid",
    styles: { fontSize: 9 }
  });

  startY = doc.autoTable.previous.finalY + 8;

  // Knowledge + Skills Section
  subjects.forEach((subj) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${subj.name} - Knowledge and Skills`, 10, startY);
    startY += 5;

    doc.autoTable({
      startY,
      head: [["Category", "Correct", "Total", "%"]],
      body: subj.skills.map((s) => [s.category, s.correct, s.total, `${s.percent.toFixed(1)}%`]),
      theme: "grid",
      styles: { fontSize: 8 }
    });

    startY = doc.autoTable.previous.finalY + 8;
  });

  // Recommendations
  doc.setFont("helvetica", "bold");
  doc.text(`Personalized Recommendations for ${student}`, 10, startY);
  startY += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Dear ${parent},`, 10, startY);
  startY += 5;

  const recMsg =
    "At Blooming Kids House, our tutors are committed to ensuring your child excels academically and develops well-rounded skills. Based on the assessment results, our tutors will focus on the following areas to support your child’s growth:";
  doc.text(doc.splitTextToSize(recMsg, 180), 10, startY);
  startY += 20;

  doc.text(
    "Math: Practice rounding numbers, place value, comparing fractions, multiplication, perimeter and area.\nELA: Improve comprehension, vocabulary through context, summarizing, writing basics, and grammar practice.",
    10,
    startY
  );

  startY += 20;
  doc.setFont("helvetica", "italic");
  doc.text(
    "Our dedicated tutors at Blooming Kids House will work closely with your child to ensure they thrive academically, build confidence, and develop the essential skills needed for lifelong success.",
    10,
    startY
  );

  startY += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Sincerely,", 10, startY);
  doc.text("Mrs. Yinka Isikalu, Director", 10, startY + 6);

  return doc.output("blob");
}

function uploadPDFToCloudinary(fileBlob, fileName, callback) {
  const formData = new FormData();
  formData.append("file", fileBlob);
  formData.append("upload_preset", "bkh_assessments");
  formData.append("folder", `Reports`);

  fetch("https://api.cloudinary.com/v1_1/dy2hxcyaf/upload", {
    method: "POST",
    body: formData
  })
    .then((res) => res.json())
    .then((data) => callback(data.secure_url))
    .catch((err) => console.error("Cloudinary upload error:", err));
}
