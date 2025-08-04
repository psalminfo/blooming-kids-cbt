import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

window.loadReport = async function () {
  const studentName = document.getElementById("studentName").value.trim().toLowerCase();
  const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();
  const reportArea = document.getElementById("reportArea");
  const reportContent = document.getElementById("reportContent");

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  const q = query(collection(db, "student_results"), where("parentEmail", "==", parentEmail));
  const querySnapshot = await getDocs(q);

  const studentResults = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.studentName.toLowerCase() === studentName) {
      studentResults.push({ ...data, timestamp: data.submittedAt?.seconds || Date.now() });
    }
  });

  if (studentResults.length === 0) {
    alert("No records found.");
    return;
  }

  const grouped = {};
  studentResults.forEach((result) => {
    const sessionKey = Math.floor(result.timestamp / 3600);
    if (!grouped[sessionKey]) grouped[sessionKey] = [];
    grouped[sessionKey].push(result);
  });

  let blockIndex = 0;
  reportContent.innerHTML = "";

  for (const key in grouped) {
    const session = grouped[key];
    const { grade, tutorName, location } = session[0];
    const fullName = capitalize(session[0].studentName);
    const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString();

    const scoreTableRows = session.map(r => {
      const correct = r.answers.filter(a => a === "correct").length;
      return `<tr><td class="border px-2 py-1">${r.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${correct}/${r.answers.length}</td></tr>`;
    }).join("");

    const skillsList = session.map(r => {
      const topics = (r.topic || r.topics || []).join(", ");
      const skills = (r.skill_detail || []).join(", ");
      return `<li><strong>${r.subject.toUpperCase()}:</strong> ${skills || topics || "General skills enhancement recommended."}</li>`;
    }).join("");

    const chartId = `chart-${blockIndex}`;

    const block = `
      <div class="border rounded-lg shadow mb-8 p-4 bg-white" id="report-block-${blockIndex}">
        <h2 class="text-xl font-bold mb-2">Student Name: ${fullName}</h2>
        <p><strong>Parent Email:</strong> ${parentEmail}</p>
        <p><strong>Grade:</strong> ${grade}</p>
        <p><strong>Tutor:</strong> ${tutorName}</p>
        <p><strong>Location:</strong> ${location}</p>
        <p><strong>Session:</strong> ${formattedDate}</p>

        <h3 class="text-lg font-semibold mt-4 mb-2">Performance Summary</h3>
        <table class="w-full text-sm mb-4 border border-collapse">
          <thead class="bg-gray-100">
            <tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr>
          </thead>
          <tbody>${scoreTableRows}</tbody>
        </table>

        <canvas id="${chartId}" class="w-full h-48 mb-4"></canvas>

        <h3 class="text-lg font-semibold mb-1">Knowledge & Skill Analysis</h3>
        <ul class="list-disc pl-5 mb-4">${skillsList}</ul>

        <h3 class="text-lg font-semibold mb-1">Tutor’s Recommendation</h3>
        <p class="mb-2 italic">${tutorName} recommends continued practice in the areas listed above. With focused sessions, your child will build greater confidence and mastery.</p>

        <h3 class="text-lg font-semibold mb-1">Director’s Message</h3>
        <p class="italic text-sm">At Blooming Kids House, we remain committed to your child’s academic journey. Our tutors are ready to walk the path with you every step of the way. Let’s unlock their full potential together.<br/>– <strong>Mrs. Yinka Isikalu</strong>, Director</p>

        <button onclick="downloadSessionReport(${blockIndex})" class="mt-4 btn-yellow px-4 py-2 rounded">Download PDF</button>
      </div>
    `;
    reportContent.innerHTML += block;

    // Generate chart
    const labels = session.map(r => r.subject.toUpperCase());
    const values = session.map(r => r.answers.filter(a => a === "correct").length);
    const totals = session.map(r => r.answers.length);

    setTimeout(() => {
      new Chart(document.getElementById(chartId), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Correct Answers',
            data: values,
            backgroundColor: '#4CAF50'
          }, {
            label: 'Total Questions',
            data: totals,
            backgroundColor: '#ccc'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Session Performance Chart' }
          }
        }
      });
    }, 200);

    blockIndex++;
  }

  // Add logout button once
  reportContent.innerHTML += `
    <div class="flex justify-center mt-6">
      <button onclick="logout()" class="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
    </div>
  `;

  reportArea.classList.remove("hidden");
};

window.downloadSessionReport = function (index) {
  const el = document.getElementById(`report-block-${index}`);

  import("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js").then(jspdfModule => {
    const { jsPDF } = jspdfModule;

    import("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js").then(() => {
      html2canvas(el).then(canvas => {
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Assessment_Report_${index + 1}.pdf`);
      });
    });
  });
};

window.logout = function () {
  window.location.href = "parent.html";
};
