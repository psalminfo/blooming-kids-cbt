// Constants
const ACCESS_CODE = "BKHADMIN2025"; // Your admin access code
const REPORT_STORAGE_KEY = "bkh_assessment_reports";

// Save Test Data After Submission
function saveTestResult(studentName, grade, subject, score, total, performance, recommendations, categories) {
    const reports = JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY)) || {};
    const studentKey = `${studentName}_${grade}`.toLowerCase();

    if (!reports[studentKey]) {
        reports[studentKey] = [];
    }

    reports[studentKey].push({
        subject,
        score,
        total,
        performance,
        recommendations,
        categories,
        date: new Date().toLocaleString()
    });

    localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(reports));
}

// Generate PDF Report
function generatePDFReport(studentName, grade) {
    const reports = JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY)) || {};
    const studentKey = `${studentName}_${grade}`.toLowerCase();

    if (!reports[studentKey] || reports[studentKey].length === 0) {
        alert("No reports found for this student.");
        return;
    }

    const report = reports[studentKey];
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Page 1 - Performance Summary
    doc.setFontSize(14);
    doc.text("Blooming Kids House Assessment Report", 20, 20);
    doc.setFontSize(12);
    doc.text(`Student Name: ${studentName}`, 20, 30);
    doc.text(`Grade: ${grade}`, 20, 40);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 50);
    doc.setFontSize(13);
    doc.text("Performance Summary", 20, 65);

    let y = 75;
    report.forEach((entry, index) => {
        doc.setFontSize(11);
        doc.text(`${index + 1}. ${entry.subject}: ${entry.score}/${entry.total} - ${entry.performance}`, 25, y);
        y += 10;
    });

    // Page 2 - Knowledge and Skills
    doc.addPage();
    doc.setFontSize(13);
    doc.text("Knowledge and Skills Categories", 20, 20);
    y = 30;
    report.forEach((entry, index) => {
        doc.setFontSize(11);
        doc.text(`${entry.subject}:`, 20, y);
        y += 8;
        entry.categories.forEach(cat => {
            doc.text(`- ${cat}`, 25, y);
            y += 6;
        });
        y += 4;
    });

    // Page 3 - Personalized Recommendations
    doc.addPage();
    doc.setFontSize(13);
    doc.text("Personalized Recommendations", 20, 20);
    y = 30;
    report.forEach((entry, index) => {
        doc.setFontSize(11);
        doc.text(`${entry.subject}:`, 20, y);
        y += 8;
        entry.recommendations.forEach(rec => {
            doc.text(`- ${rec}`, 25, y);
            y += 6;
        });
        y += 4;
    });

    doc.save(`${studentName}_${grade}_Report.pdf`);
}

// Admin Panel Access
function verifyAdminCode(codeInput) {
    if (codeInput === ACCESS_CODE) {
        alert("Admin Access Code verified. Welcome to Admin Panel.");
        localStorage.setItem("bkh_admin_logged_in", "true");
        window.location.href = "admin-dashboard.html";
    } else {
        alert("Incorrect access code.");
    }
}

// Display Reports in Admin Dashboard
function loadAllReports() {
    const reports = JSON.parse(localStorage.getItem(REPORT_STORAGE_KEY)) || {};
    const container = document.getElementById("admin-report-container");
    container.innerHTML = "";

    if (Object.keys(reports).length === 0) {
        container.innerHTML = "<p>No reports found.</p>";
        return;
    }

    for (let student in reports) {
        const entry = document.createElement("div");
        entry.className = "report-block";
        entry.innerHTML = `<strong>${student.replace(/_/g, " ").toUpperCase()}</strong><br>`;
        reports[student].forEach((rep, i) => {
            entry.innerHTML += `${i + 1}. ${rep.subject} - ${rep.score}/${rep.total} (${rep.performance})<br>`;
        });
        container.appendChild(entry);
    }
}

// Logout Admin
function logoutAdmin() {
    localStorage.removeItem("bkh_admin_logged_in");
    window.location.href = "index.html";
}
