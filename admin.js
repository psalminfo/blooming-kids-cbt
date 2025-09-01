import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc, updateDoc, setDoc, deleteDoc, orderBy } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';
let activeTutorId = null;

// --- Utility Functions ---
function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// ### UPDATED ### to support the new Pay Advice data structure
function convertPayAdviceToCSV(data) {
    const header = ['Tutor Name', 'Student Count', 'Total Student Fees ($)', 'Management Fee ($)', 'Total Pay ($)'];
    const rows = data.map(item => [
        `"${item.tutorName}"`,
        item.studentCount,
        item.totalStudentFees,
        item.managementFee,
        item.totalPay
    ]);
    return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
}


// ##################################################################
// # SECTION 1: DASHBOARD PANEL
// ##################################################################

async function renderAdminPanel(container) {
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Total Students</h3><p id="totalStudentsCount" class="text-3xl text-blue-600 font-extrabold">0</p></div>
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Total Tutors</h3><p id="totalTutorsCount" class="text-3xl text-blue-600 font-extrabold">0</p></div>
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Students Per Tutor</h3><select id="studentsPerTutorSelect" class="w-full mt-1 p-2 border rounded"></select></div>
        </div>
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">View Student Reports (Legacy)</h2>
             <p class="text-sm text-gray-500 mb-4">This section shows reports from the old assessment system.</p>
            <label for="studentDropdown" class="block text-gray-700">Select Student</label>
            <select id="studentDropdown" class="w-full mt-1 p-2 border rounded"></select>
            <div id="reportContent" class="mt-4 space-y-4"><p class="text-gray-500">Please select a student to view their report.</p></div>
        </div>
    `;
    setupDashboardListeners();
}

function setupDashboardListeners() {
    const studentDropdown = document.getElementById('studentDropdown');
    studentDropdown.addEventListener('change', (e) => {
        if (e.target.value) loadAndRenderReport(e.target.value);
    });

    loadCounters();
    loadStudentDropdown();
}

// ### FIXED ### This function is now highly efficient.
async function loadCounters() {
    const [studentsSnapshot, tutorsSnapshot] = await Promise.all([
        getDocs(collection(db, "students")),
        getDocs(collection(db, "tutors"))
    ]);

    const studentCounts = new Map();
    studentsSnapshot.forEach(doc => {
        const student = doc.data();
        const count = studentCounts.get(student.tutorEmail) || 0;
        studentCounts.set(student.tutorEmail, count + 1);
    });

    document.getElementById('totalStudentsCount').textContent = studentsSnapshot.docs.length;
    document.getElementById('totalTutorsCount').textContent = tutorsSnapshot.docs.length;

    const studentsPerTutorSelect = document.getElementById('studentsPerTutorSelect');
    studentsPerTutorSelect.innerHTML = `<option value="">Students Per Tutor</option>`;
    
    tutorsSnapshot.forEach(tutorDoc => {
        const tutor = tutorDoc.data();
        const count = studentCounts.get(tutor.email) || 0;
        const option = document.createElement('option');
        option.textContent = `${tutor.name} (${count} students)`;
        studentsPerTutorSelect.appendChild(option);
    });
}

async function loadStudentDropdown() {
    const studentDropdown = document.getElementById('studentDropdown');
    const snapshot = await getDocs(collection(db, "student_results"));
    studentDropdown.innerHTML = `<option value="">Select Student</option>`;
    snapshot.forEach(doc => {
        const student = doc.data();
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = `${capitalize(student.studentName)} (${student.parentEmail})`;
        studentDropdown.appendChild(option);
    });
}

async function loadAndRenderReport(docId) {
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = `<p>Loading report...</p>`;
    try {
        const reportDocSnap = await getDoc(doc(db, "student_results", docId));
        if (!reportDocSnap.exists()) throw new Error("Report not found");
        const data = reportDocSnap.data();

        const tutorName = data.tutorEmail ? (await getDoc(doc(db, "tutors", data.tutorEmail))).data()?.name || 'N/A' : 'N/A';
        const creativeWritingAnswer = data.answers.find(a => a.type === 'creative-writing');
        const tutorReport = creativeWritingAnswer?.tutorReport || 'No report available.';
        const score = data.answers.filter(a => a.type !== 'creative-writing' && String(a.studentAnswer).toLowerCase() === String(a.correctAnswer).toLowerCase()).length;

        reportContent.innerHTML = `
            <div class="border rounded-lg shadow p-4 bg-white" id="report-block">
                <h3 class="text-xl font-bold mb-2">${capitalize(data.studentName)}</h3>
                <p><strong>Parent Email:</strong> ${data.parentEmail}</p>
                <p><strong>Tutor:</strong> ${tutorName}</p>
                <h4 class="text-lg font-semibold mt-4">Score: ${score} / ${data.totalScoreableQuestions}</h4>
                <h4 class="text-lg font-semibold mt-4">Tutor’s Recommendation:</h4>
                <p>${tutorReport}</p>
            </div>
        `;
    } catch (error) {
        console.error("Error loading report:", error);
        reportContent.innerHTML = `<p class="text-red-500">Failed to load report. ${error.message}</p>`;
    }
}


// ##################################################################
// # SECTION 2: TUTOR MANAGEMENT
// ##################################################################
async function renderTutorManagementPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Global Settings</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Report Submission:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="report-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="report-status-label" class="ml-3 text-sm font-medium text-gray-500"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Tutors Can Add Students:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="tutor-add-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="tutor-add-status-label" class="ml-3 text-sm font-medium text-gray-500"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Enable Summer Break:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="summer-break-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="summer-break-status-label" class="ml-3 text-sm font-medium text-gray-500"></span></label></label>
            </div>
        </div>
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h3 class="text-2xl font-bold text-green-700 mb-4">Manage Tutors</h3>
            <div class="mb-4">
                <label for="tutor-select" class="block font-semibold">Select Tutor:</label>
                <select id="tutor-select" class="w-full p-2 border rounded mt-1"></select>
            </div>
            <div id="selected-tutor-details" class="mt-4"><p class="text-gray-500">Please select a tutor to view details.</p></div>
        </div>
    `;
    setupTutorManagementListeners();
}

async function setupTutorManagementListeners() {
    const settingsDocRef = doc(db, "settings", "global_settings");

    onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            ['report', 'tutor-add', 'summer-break'].forEach(type => {
                const key = `is${capitalize(type.split('-')[0])}${capitalize(type.split('-')[1] || '')}Enabled`;
                const toggle = document.getElementById(`${type}-toggle`);
                const label = document.getElementById(`${type}-status-label`);
                if (toggle && label) {
                    toggle.checked = data[key];
                    label.textContent = data[key] ? 'Enabled' : 'Disabled';
                    label.classList.toggle('text-green-600', data[key]);
                }
            });
        }
    });

    document.getElementById('report-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isReportEnabled: e.target.checked }));
    document.getElementById('tutor-add-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isTutorAddEnabled: e.target.checked }));
    document.getElementById('summer-break-toggle').addEventListener('change', e => updateDoc(settingsDocRef, { isSummerBreakEnabled: e.target.checked }));
    
    const tutorSelect = document.getElementById('tutor-select');
    tutorSelect.addEventListener('change', e => {
        activeTutorId = e.target.value;
        renderSelectedTutorDetails(activeTutorId);
    });

    onSnapshot(collection(db, "tutors"), async (snapshot) => {
        const tutorsData = {};
        tutorSelect.innerHTML = `<option value="">-- Select a Tutor --</option>`;
        snapshot.forEach(doc => {
            tutorsData[doc.id] = { id: doc.id, ...doc.data() };
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = doc.data().name;
            tutorSelect.appendChild(option);
        });
        window.allTutorsData = tutorsData;
        if (activeTutorId && tutorsData[activeTutorId]) {
            tutorSelect.value = activeTutorId;
            renderSelectedTutorDetails(activeTutorId);
        }
    });
}

async function renderSelectedTutorDetails(tutorId) {
    const container = document.getElementById('selected-tutor-details');
    if (!tutorId || !window.allTutorsData) {
        container.innerHTML = `<p class="text-gray-500">Please select a tutor to view details.</p>`;
        return;
    }
    const tutor = window.allTutorsData[tutorId];
    const studentsQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
    const studentsSnapshot = await getDocs(studentsQuery);
    
    const studentsListHTML = studentsSnapshot.docs.map(studentDoc => {
        const student = studentDoc.data();
        return `<li class="flex justify-between items-center bg-gray-50 p-2 rounded-md"><span>${student.studentName} - Fee: $${student.studentFee}</span><button class="remove-student-btn text-red-500 hover:text-red-700" data-student-id="${studentDoc.id}">Remove</button></li>`;
    }).join('');

    container.innerHTML = `
        <div class="p-4 border rounded-lg shadow-sm">
            <div class="flex items-center justify-between mb-4"><h4 class="font-bold text-xl">${tutor.name} (${studentsSnapshot.docs.length} students)</h4><label class="flex items-center space-x-2"><span class="font-semibold">Management Staff:</span><input type="checkbox" id="management-staff-toggle" class="h-5 w-5" ${tutor.isManagementStaff ? 'checked' : ''}></label></div>
            <div id="management-fee-container" class="mb-4"></div>
            <div class="mb-4"><p><strong>Students:</strong></p><ul class="space-y-2 mt-2">${studentsListHTML || '<p class="text-gray-500">No students assigned.</p>'}</ul></div>
            <div class="add-student-form border-t pt-4"><h5 class="font-semibold text-gray-700 mb-2">Add New Student:</h5><input type="text" class="new-student-name w-full mt-1 p-2 border rounded" placeholder="Student Name"><input type="number" class="new-student-fee w-full mt-1 p-2 border rounded" placeholder="Student Fee"><button class="add-student-btn bg-green-600 text-white px-4 py-2 rounded mt-2 hover:bg-green-700">Add Student</button></div>
        </div>
    `;

    const managementToggle = document.getElementById('management-staff-toggle');
    const feeContainer = document.getElementById('management-fee-container');

    const renderFeeInput = () => {
        if (managementToggle.checked) {
            feeContainer.innerHTML = `<div class="flex items-center space-x-2 bg-blue-50 p-3 rounded-md"><label for="management-fee-input" class="font-semibold">Management Fee ($):</label><input type="number" id="management-fee-input" class="p-2 border rounded w-full" value="${tutor.managementFee || 0}"><button id="save-fee-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Save</button></div>`;
            document.getElementById('save-fee-btn').addEventListener('click', async () => {
                const newFee = parseFloat(document.getElementById('management-fee-input').value);
                if (!isNaN(newFee)) {
                    await updateDoc(doc(db, "tutors", tutorId), { managementFee: newFee });
                    alert('Fee updated!');
                }
            });
        } else {
            feeContainer.innerHTML = '';
        }
    };
    
    managementToggle.addEventListener('change', async (e) => {
        await updateDoc(doc(db, "tutors", tutorId), { isManagementStaff: e.target.checked });
        renderFeeInput();
    });

    renderFeeInput(); // Initial render

    document.querySelector('.add-student-btn').addEventListener('click', async (e) => {
        const form = e.target.closest('.add-student-form');
        const studentName = form.querySelector('.new-student-name').value;
        const studentFee = parseFloat(form.querySelector('.new-student-fee').value);
        if (studentName && !isNaN(studentFee)) {
            await addDoc(collection(db, "students"), { studentName, studentFee, tutorEmail: tutor.email });
        } else {
            alert('Please fill in all student details correctly.');
        }
    });
    
    container.querySelectorAll('.remove-student-btn').forEach(btn => btn.addEventListener('click', async (e) => {
        if (confirm('Are you sure?')) await deleteDoc(doc(db, "students", e.target.dataset.studentId));
    }));
}


// ##################################################################
// # SECTION 3: TUTOR REPORTS PANEL
// ##################################################################

async function renderTutorReportsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Reports</h2>
            <div id="tutor-reports-list" class="space-y-4"><p class="text-gray-500 text-center">Loading reports...</p></div>
        </div>
    `;
    await loadTutorReportsForAdmin();
}

async function loadTutorReportsForAdmin() {
    const reportsListContainer = document.getElementById('tutor-reports-list');
    reportsListContainer.innerHTML = `<p class="text-gray-500 text-center">Loading reports...</p>`;
    try {
        const reportsQuery = query(collection(db, "tutor_submissions"), orderBy("submittedAt", "desc"));
        const reportsSnapshot = await getDocs(reportsQuery);

        if (reportsSnapshot.empty) {
            reportsListContainer.innerHTML = `<p class="text-gray-500 text-center">No reports have been submitted yet.</p>`;
            return;
        }

        let reportsHTML = '';
        reportsSnapshot.forEach(doc => {
            const data = doc.data();
            reportsHTML += `<div class="border rounded-lg p-4 shadow-sm bg-white flex justify-between items-center"><div><p><strong>Tutor:</strong> ${data.tutorName || data.tutorEmail}</p><p><strong>Student:</strong> ${data.studentName}</p><p><strong>Date:</strong> ${new Date(data.submittedAt.seconds * 1000).toLocaleDateString()}</p></div><button class="download-report-btn bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" data-report-id="${doc.id}">Download PDF</button></div>`;
        });
        reportsListContainer.innerHTML = reportsHTML;

        document.querySelectorAll('.download-report-btn').forEach(button => {
            button.addEventListener('click', (e) => downloadAdminReport(e.target.dataset.reportId));
        });
    } catch (error) {
        console.error("Error loading tutor reports:", error);
        reportsListContainer.innerHTML = `<p class="text-red-500 text-center">Failed to load reports.</p>`;
    }
}

// ### FIXED ### Bug where it tried to access non-existent 'subjects' field is removed.
async function downloadAdminReport(reportId) {
    try {
        const reportDoc = await getDoc(doc(db, "tutor_submissions", reportId));
        if (!reportDoc.exists()) return alert("Report not found!");
        const reportData = reportDoc.data();
        const logoUrl = "YOUR_FIREBASE_STORAGE_LOGO_URL"; // TO BE REPLACED
        const reportTemplate = `
            <div style="font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: auto;">
                <div style="text-align: center; margin-bottom: 2rem;"><img src="${logoUrl}" alt="Logo" style="height: 60px;"><h1 style="font-size: 1.5rem; font-weight: bold; color: #166534;">MONTHLY LEARNING REPORT</h1><p style="color: #4b5563;">Date: ${new Date(reportData.submittedAt.seconds * 1000).toLocaleDateString()}</p></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;"><p><strong>Student's Name:</strong> ${reportData.studentName}</p><p><strong>Grade:</strong> ${reportData.grade}</p><p><strong>Tutor's Name:</strong> ${reportData.tutorName}</p></div>
                ${Object.entries({
                    "INTRODUCTION": reportData.introduction, "TOPICS & REMARKS": reportData.topics, "PROGRESS AND ACHIEVEMENTS": reportData.progress,
                    "STRENGTHS AND WEAKNESSES": reportData.strengthsWeaknesses, "RECOMMENDATIONS": reportData.recommendations, "GENERAL TUTOR'S COMMENTS": reportData.generalComments
                }).map(([title, content]) => `<div style="border-top: 1px solid #d1d5db; padding-top: 1rem; margin-top: 1rem;"><h2 style="font-size: 1.25rem; font-weight: bold; color: #16a34a;">${title}</h2><p style="line-height: 1.6; white-space: pre-wrap;">${content || 'N/A'}</p></div>`).join('')}
                <div style="margin-top: 3rem; text-align: right;"><p>Best regards,</p><p style="font-weight: bold;">${reportData.tutorName}</p></div>
            </div>`;
        html2pdf().from(reportTemplate).save(`${reportData.studentName}_report.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert(`Failed to download report: ${error.message}`);
    }
}


// ##################################################################
// # SECTION 4: PAY ADVICE PANEL (NEW & FUNCTIONAL)
// ##################################################################

async function renderPayAdvicePanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor Pay Advice</h2>
                <button id="export-pay-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Export as CSV</button>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tutor Name</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Count</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Student Fees</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Management Fee</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Pay</th></tr></thead>
                    <tbody id="pay-advice-table-body" class="bg-white divide-y divide-gray-200"><tr_><td colspan="5" class="text-center py-4">Loading pay data...</td></tr></tbody>
                </table>
            </div>
        </div>
    `;
    await loadPayAdviceData();
}

async function loadPayAdviceData() {
    const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
        getDocs(collection(db, "tutors")),
        getDocs(collection(db, "students"))
    ]);

    const payData = [];
    const studentsByTutor = new Map();

    studentsSnapshot.forEach(doc => {
        const student = doc.data();
        if (!studentsByTutor.has(student.tutorEmail)) {
            studentsByTutor.set(student.tutorEmail, []);
        }
        studentsByTutor.get(student.tutorEmail).push(student);
    });

    tutorsSnapshot.forEach(doc => {
        const tutor = doc.data();
        const assignedStudents = studentsByTutor.get(tutor.email) || [];
        const totalStudentFees = assignedStudents.reduce((sum, s) => sum + (s.studentFee || 0), 0);
        const managementFee = (tutor.isManagementStaff && tutor.managementFee) ? tutor.managementFee : 0;
        const totalPay = totalStudentFees + managementFee;

        payData.push({
            tutorName: tutor.name,
            studentCount: assignedStudents.length,
            totalStudentFees: totalStudentFees.toFixed(2),
            managementFee: managementFee.toFixed(2),
            totalPay: totalPay.toFixed(2)
        });
    });

    const tableBody = document.getElementById('pay-advice-table-body');
    if (payData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No tutors found.</td></tr>`;
        return;
    }
    
    tableBody.innerHTML = payData.map(d => `<tr><td class="px-6 py-4">${d.tutorName}</td><td class="px-6 py-4">${d.studentCount}</td><td class="px-6 py-4">$${d.totalStudentFees}</td><td class="px-6 py-4">$${d.managementFee}</td><td class="px-6 py-4 font-bold">$${d.totalPay}</td></tr>`).join('');
    
    document.getElementById('export-pay-csv-btn').addEventListener('click', () => {
        const csv = convertPayAdviceToCSV(payData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Pay_Advice_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    });
}


// ##################################################################
// # SECTION 5: SUMMER BREAK PANEL
// ##################################################################
async function renderSummerBreakPanel(container) {
     container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Students on Summer Break</h2>
            <div id="break-students-list" class="space-y-4"><p class="text-gray-500 text-center">Loading students...</p></div>
        </div>
    `;
    await loadSummerBreakStudents();
}

async function loadSummerBreakStudents() {
    const listContainer = document.getElementById('break-students-list');
    onSnapshot(query(collection(db, "students"), where("summerBreak", "==", true)), (snapshot) => {
        if (snapshot.empty) {
            listContainer.innerHTML = `<p class="text-gray-500 text-center">No students are currently on summer break.</p>`;
            return;
        }
        listContainer.innerHTML = snapshot.docs.map(doc => {
            const student = doc.data();
            return `<div class="border rounded-lg p-4 shadow-sm bg-white flex justify-between items-center"><div><p><strong>Student:</strong> ${student.studentName}</p><p><strong>Tutor:</strong> ${student.tutorEmail}</p></div><button class="remove-break-btn bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700" data-student-id="${doc.id}">End Break</button></div>`;
        }).join('');

        listContainer.querySelectorAll('.remove-break-btn').forEach(btn => btn.addEventListener('click', async (e) => {
            await updateDoc(doc(db, "students", e.target.dataset.studentId), { summerBreak: false });
        }));
    });
}


// ##################################################################
// # MAIN APP INITIALIZATION
// ##################################################################

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (user && user.email === ADMIN_EMAIL) {
        mainContent.innerHTML = '';
        const navItems = {
            navDashboard: renderAdminPanel,
            navTutorManagement: renderTutorManagementPanel,
            navPayAdvice: renderPayAdvicePanel,
            navTutorReports: renderTutorReportsPanel,
            navSummerBreak: renderSummerBreakPanel
        };

        const setActiveNav = (activeId) => Object.keys(navItems).forEach(id => {
            document.getElementById(id).classList.toggle('active', id === activeId);
        });

        Object.entries(navItems).forEach(([id, renderFn]) => {
            document.getElementById(id).addEventListener('click', () => {
                setActiveNav(id);
                renderFn(mainContent);
            });
        });

        // Initial Load
        setActiveNav('navTutorManagement');
        renderTutorManagementPanel(mainContent);

        logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "admin-auth.html"));

    } else {
        mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">You do not have permission to view this page.</p>`;
        logoutBtn.classList.add('hidden');
    }
});
