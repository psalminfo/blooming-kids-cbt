<!-- ✅ FILE: subject-select.js -->
const studentData = JSON.parse(sessionStorage.getItem("studentInfo"));
if (!studentData) {
  window.location.href = "index.html";
}

const subjectsByGrade = {
  default: ["Math", "ELA"],
  scienceGrades: ["Biology", "Chemistry", "Physics"]
};

const allSubjects = [...subjectsByGrade.default];
if (parseInt(studentData.grade) >= 7) {
  allSubjects.push(...subjectsByGrade.scienceGrades);
}

const subjectList = document.getElementById("subjectList");
allSubjects.forEach(subject => {
  const btn = document.createElement("button");
  btn.innerText = subject;
  btn.className = "bg-green-600 text-white py-2 rounded hover:bg-green-700";
  btn.onclick = () => {
    const params = new URLSearchParams({
      subject,
      grade: studentData.grade,
      studentName: studentData.studentName,
      parentEmail: studentData.parentEmail,
      tutorName: studentData.tutorName,
      location: studentData.location
    });
    window.location.href = `student.html?${params.toString()}`;
  };
  subjectList.appendChild(btn);
});

function logout() {
  sessionStorage.clear();
  window.location.href = "index.html";
}
