import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

function convertPayAdviceToCSV(data) {
    const header = ['Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Total Pay (₦)'];
    const rows = data.map(item => [
        `"${item.tutorName}"`,
        item.studentCount,
        item.totalStudentFees,
        item.managementFee,
        item.totalPay
    ]);
    return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
}

// ##################################
// # PANEL RENDERING FUNCTIONS
// ##################################

// ### UPDATED as requested ### to group students by tutor
async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                 <h2 class="text-2xl font-bold text-green-700">Tutor & Student Directory</h2>
                 <div class="flex space-x-4">
                     <div class="bg-green-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-green-800 text-sm">Total Tutors</h4><p id="tutor-count-badge" class="text-2xl font-extrabold">0</p></div>
                     <div class="bg-yellow-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-yellow-800 text-sm">Total Students</h4><p id="student-count-badge" class="text-2xl font-extrabold">0</p></div>
                 </div>
            </div>
            <div id="directory-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading directory...</p>
            </div>
        </div>
    `;

    try {
        const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
            getDocs(query(collection(db, "tutors"), orderBy("name"))),
            getDocs(collection(db, "students"))
        ]);

        document.getElementById('tutor-count-badge').textContent = tutorsSnapshot.size;
        document.getElementById('student-count-badge').textContent = studentsSnapshot.size;

        const studentsByTutor = {};
        studentsSnapshot.forEach(doc => {
            const student = doc.data();
            if (!studentsByTutor[student.tutorEmail]) {
                studentsByTutor[student.tutorEmail] = [];
            }
            studentsByTutor[student.tutorEmail].push(student);
        });

        const directoryList = document.getElementById('directory-list');
        if (!directoryList) return;

        directoryList.innerHTML = tutorsSnapshot.docs.map(tutorDoc => {
            const tutor = tutorDoc.data();
            const assignedStudents = studentsByTutor[tutor.email] || [];
            
            const studentsTableRows = assignedStudents
                .sort((a, b) => a.studentName.localeCompare(b.studentName))
                .map(student => `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-2 font-medium">${student.studentName}</td>
                        <td class="px-4 py-2">${student.grade}</td>
                        <td class="px-4 py-2">${student.days}</td>
                        <td class="px-4 py-2">${student.parentEmail || 'N/A'}</td>
                    </tr>
                `).join('');

            return `
                <div class="border rounded-lg shadow-sm">
                    <details>
                        <summary class="p-4 cursor-pointer flex justify-between items-center font-semibold text-lg">
                            ${tutor.name}
                            <span class="ml-2 text-sm font-normal text-gray-500">(${assignedStudents.length} students)</span>
                        </summary>
                        <div class="border-t p-2">
                            <table class="min-w-full text-sm">
                                <thead class="bg-gray-50 text-left"><tr>
                                    <th class="px-4 py-2 font-medium">Student Name</th>
                                    <th class="px-4 py-2 font-medium">Grade</th>
                                    <th class="px-4 py-2 font-medium">Days/Week</th>
                                    <th class="px-4 py-2 font-medium">Parent's Email</th>
                                </tr></thead>
                                <tbody class="bg-white divide-y divide-gray-200">${studentsTableRows}</tbody>
                            </table>
                        </div>
                    </details>
                </div>
            `;
        }).join('');
    } catch(error) {
        console.error("Error in renderManagementTutorView:", error);
        document.getElementById('directory-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

async function renderPayAdvicePanel(container) {
    const canExport = window.userData.permissions?.actions?.canExportPayAdvice === true;
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Pay Advice</h2>
            <div class="bg-green-50 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label for="start-date" class="block text-sm font-medium">Start Date</label>
                    <input type="date" id="start-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div>
                    <label for="end-date" class="block text-sm font-medium">End Date</label>
                    <input type="date" id="end-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="flex items-center space-x-4 col-span-2">
                     <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full"><h4 class="font-bold text-green-800 text-sm">Active Tutors</h4><p id="pay-tutor-count" class="text-2xl font-extrabold">0</p></div>
                     <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full"><h4 class="font-bold text-yellow-800 text-sm">Total Students</h4><p id="pay-student-count" class="text-2xl font-extrabold">0</p></div>
                     ${canExport ? `<button id="export-pay-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 h-full">Export CSV</button>` : ''}
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium uppercase">Tutor</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Students</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Fees</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Mgmt. Fee</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Total Pay</th></tr></thead>
                    <tbody id="pay-advice-table-body" class="divide-y"><tr><td colspan="5" class="text-center py-4">Select a date range.</td></tr></tbody>
                </table>
            </div>
        </div>
    `;

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const handleDateChange = () => {
        const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
        if (startDate && endDate) {
            endDate.setHours(23, 59, 59, 999);
            loadPayAdviceData(startDate, endDate);
        }
    };
    startDateInput.addEventListener('change', handleDateChange);
    endDateInput.addEventListener('change', handleDateChange);
}

async function loadPayAdviceData(startDate, endDate) {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Loading pay data...</td></tr>`;

    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    const reportsQuery = query(collection(db, "tutor_submissions"), where("submittedAt", ">=", startTimestamp), where("submittedAt", "<=", endTimestamp));
    try {
        const reportsSnapshot = await getDocs(reportsQuery);
        const activeTutorEmails = [...new Set(reportsSnapshot.docs.map(doc => doc.data().tutorEmail))];

        if (activeTutorEmails.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No active tutors in this period.</td></tr>`;
            document.getElementById('pay-tutor-count').textContent = 0;
            document.getElementById('pay-student-count').textContent = 0;
            return;
        }

        const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
            getDocs(query(collection(db, "tutors"), where("email", "in", activeTutorEmails))),
            getDocs(collection(db, "students"))
        ]);

        const allStudents = studentsSnapshot.docs.map(doc => doc.data());
        let totalStudentCount = 0;
        const payData = [];

        tutorsSnapshot.forEach(doc => {
            const tutor = doc.data();
            const assignedStudents = allStudents.filter(s => s.tutorEmail === tutor.email);
            const totalStudentFees = assignedStudents.reduce((sum, s) => sum + (s.studentFee || 0), 0);
            const managementFee = (tutor.isManagementStaff && tutor.managementFee) ? tutor.managementFee : 0;
            totalStudentCount += assignedStudents.length;

            payData.push({
                tutorName: tutor.name, studentCount: assignedStudents.length,
                totalStudentFees: totalStudentFees, managementFee: managementFee,
                totalPay: totalStudentFees + managementFee
            });
        });

        document.getElementById('pay-tutor-count').textContent = payData.length;
        document.getElementById('pay-student-count').textContent = totalStudentCount;
        tableBody.innerHTML = payData.map(d => `<tr><td class="px-6 py-4">${d.tutorName}</td><td class="px-6 py-4">${d.studentCount}</td><td class="px-6 py-4">₦${d.totalStudentFees.toFixed(2)}</td><td class="px-6 py-4">₦${d.managementFee.toFixed(2)}</td><td class="px-6 py-4 font-bold">₦${d.totalPay.toFixed(2)}</td></tr>`).join('');
        
        const exportBtn = document.getElementById('export-pay-csv-btn');
        if (exportBtn) {
            exportBtn.onclick = () => {
                const csv = convertPayAdviceToCSV(payData);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `Pay_Advice_${startDate.toISOString().split('T')[0]}_to_${endDate.toISOString().split('T')[0]}.csv`;
                link.click();
            };
        }
    } catch(error) {
        console.error("Error loading pay advice data:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Failed to load data.</td></tr>`;
    }
}

async function renderTutorReportsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Reports</h2>
            <div id="tutor-reports-list" class="space-y-4"><p class="text-center">Loading reports...</p></div>
        </div>
    `;
    loadTutorReportsForManagement();
}

async function loadTutorReportsForManagement() {
    const reportsListContainer = document.getElementById('tutor-reports-list');
    onSnapshot(query(collection(db, "tutor_submissions"), orderBy("submittedAt", "desc")), (snapshot) => {
        if (!reportsListContainer) return;
        if (snapshot.empty) {
            reportsListContainer.innerHTML = `<p class="text-center text-gray-500">No reports submitted yet.</p>`;
            return;
        }

        const reportsByTutor = {};
        snapshot.forEach(doc => {
            const report = { id: doc.id, ...doc.data() };
            if (!reportsByTutor[report.tutorEmail]) {
                reportsByTutor[report.tutorEmail] = { name: report.tutorName || report.tutorEmail, reports: [] };
            }
            reportsByTutor[report.tutorEmail].reports.push(report);
        });

        const canDownload = window.userData.permissions?.actions?.canDownloadReports === true;

        reportsListContainer.innerHTML = Object.values(reportsByTutor).map(tutorData => {
            const reportLinks = tutorData.reports.map(report => {
                const buttonHTML = canDownload
                    ? `<button class="download-report-btn bg-green-500 text-white px-3 py-1 text-sm rounded" data-report-id="${report.id}">Download</button>`
                    : `<button class="view-report-btn bg-gray-500 text-white px-3 py-1 text-sm rounded" data-report-id="${report.id}">View</button>`;
                return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">${report.studentName}<span>${buttonHTML}</span></li>`;
            }).join('');

            return `<details class="border rounded-lg"><summary class="p-4 cursor-pointer font-semibold">${tutorData.name} (${tutorData.reports.length} reports)</summary><div class="p-4 border-t"><ul class="space-y-2">${reportLinks}</ul></div></details>`;
        }).join('');

        document.querySelectorAll('.download-report-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                viewReportInNewTab(e.target.dataset.report-id, true);
            });
        });

        document.querySelectorAll('.view-report-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                viewReportInNewTab(e.target.dataset.report-id, false);
            });
        });
    });
}

async function viewReportInNewTab(reportId, shouldDownload = false) {
    try {
        const reportDoc = await getDoc(doc(db, "tutor_submissions", reportId));
        if (!reportDoc.exists()) throw new Error("Report not found!");
        const reportData = reportDoc.data();
        let parentEmail = 'N/A';
        if (reportData.studentId) {
            const studentDoc = await getDoc(doc(db, "students", reportData.studentId));
            if (studentDoc.exists()) parentEmail = studentDoc.data().parentEmail || 'N/A';
        }

        const logoUrl = "https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/logo.png";
        const reportTemplate = `<div style="font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: auto;"><div style="text-align: center; margin-bottom: 2rem;"><img src="${logoUrl}" alt="Company Logo" style="height: 80px;"><h3 style="font-size: 1.8rem; font-weight: bold; color: #15803d; margin: 0;">Blooming Kids House</h3><h1 style="font-size: 1.2rem; font-weight: bold; color: #166534;">MONTHLY LEARNING REPORT</h1><p>Date: ${new Date(reportData.submittedAt.seconds * 1000).toLocaleDateString()}</p></div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;"><p><strong>Student's Name:</strong> ${reportData.studentName}</p><p><strong>Parent's Email:</strong> ${parentEmail}</p><p><strong>Grade:</strong> ${reportData.grade}</p><p><strong>Tutor's Name:</strong> ${reportData.tutorName}</p></div>${Object.entries({"INTRODUCTION": reportData.introduction, "TOPICS & REMARKS": reportData.topics, "PROGRESS & ACHIEVEMENTS": reportData.progress, "STRENGTHS AND WEAKNESSES": reportData.strengthsWeaknesses, "RECOMMENDATIONS": reportData.recommendations, "GENERAL TUTOR'S COMMENTS": reportData.generalComments}).map(([title, content]) => `<div style="border-top: 1px solid #d1d5db; padding-top: 1rem; margin-top: 1rem;"><h2 style="font-size: 1.25rem; font-weight: bold; color: #16a34a;">${title}</h2><p style="line-height: 1.6; white-space: pre-wrap;">${content || 'N/A'}</p></div>`).join('')}<div style="margin-top: 3rem; text-align: right;"><p>Best regards,</p><p style="font-weight: bold;">${reportData.tutorName}</p></div></div>`;

        if (shouldDownload) {
             html2pdf().from(reportTemplate).save(`${reportData.studentName}_report.pdf`);
        } else {
            const newWindow = window.open();
            newWindow.document.write(`<html><head><title>${reportData.studentName} Report</title></head><body>${reportTemplate}</body></html>`);
            newWindow.document.close();
        }
    } catch (error) {
        // NOTE: In a real-world app, this should be a custom modal or message box.
        console.error("Error viewing/downloading report:", error);
        alert(`Error: ${error.message}`);
    }
}

async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex flex-col sm:flex-row justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Students on Summer Break</h2>
                <button id="endBreakBtn" class="mt-4 sm:mt-0 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors hidden">End Break & Reset Accounts</button>
            </div>
            <div id="break-status-message" class="text-center font-semibold mb-4 hidden"></div>
            <div id="break-students-list" class="space-y-4"><p class="text-center">Loading...</p></div>
        </div>
    `;

    const endBreakBtn = document.getElementById('endBreakBtn');
    const statusMessageDiv = document.getElementById('break-status-message');

    if (endBreakBtn && window.userData.permissions?.actions?.canEndBreak) {
        endBreakBtn.classList.remove('hidden');
        endBreakBtn.addEventListener('click', async () => {
            statusMessageDiv.textContent = 'Are you sure you want to end the summer break for ALL students? This cannot be undone.';
            statusMessageDiv.className = 'text-center font-semibold mb-4 text-red-600';
            
            const confirmBtn = document.createElement('button');
            confirmBtn.textContent = 'Yes, End Break';
            confirmBtn.className = 'bg-red-600 text-white px-4 py-2 rounded ml-2 hover:bg-red-700 transition-colors';
            
            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'bg-gray-400 text-white px-4 py-2 rounded ml-2 hover:bg-gray-500 transition-colors';
            
            statusMessageDiv.appendChild(confirmBtn);
            statusMessageDiv.appendChild(cancelBtn);

            confirmBtn.addEventListener('click', async () => {
                try {
                    statusMessageDiv.innerHTML = 'Ending break...';
                    confirmBtn.disabled = true;
                    cancelBtn.disabled = true;

                    const studentsRef = collection(db, "students");
                    const studentsOnBreakQuery = query(studentsRef, where("summerBreak", "==", true));
                    const snapshot = await getDocs(studentsOnBreakQuery);

                    if (snapshot.empty) {
                        statusMessageDiv.textContent = "No students are currently on break.";
                        statusMessageDiv.className = 'text-center font-semibold mb-4 text-green-600';
                    } else {
                        const batch = writeBatch(db);
                        snapshot.docs.forEach(doc => {
                            batch.update(doc.ref, { summerBreak: false, lastBreakEnd: Timestamp.now() });
                        });
                        await batch.commit();
                        statusMessageDiv.textContent = "Summer break has been ended for all students.";
                        statusMessageDiv.className = 'text-center font-semibold mb-4 text-green-600';
                    }
                } catch (error) {
                    console.error("Error ending summer break:", error);
                    statusMessageDiv.textContent = "Failed to end summer break. Check the console for details.";
                    statusMessageDiv.className = 'text-center font-semibold mb-4 text-red-600';
                } finally {
                    confirmBtn.remove();
                    cancelBtn.remove();
                }
            });

            cancelBtn.addEventListener('click', () => {
                statusMessageDiv.innerHTML = '';
                statusMessageDiv.classList.add('hidden');
            });
        });
    }

    onSnapshot(query(collection(db, "students"), where("summerBreak", "==", true)), (snapshot) => {
        const listContainer = document.getElementById('break-students-list');
        if (!listContainer) return;
        if (snapshot.empty) {
            listContainer.innerHTML = `<p class="text-center text-gray-500">No students are on break.</p>`;
            return;
        }
        listContainer.innerHTML = snapshot.docs.map(doc => {
            const student = doc.data();
            return `<div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50"><div><p><strong>Student:</strong> ${student.studentName}</p><p><strong>Tutor:</strong> ${student.tutorEmail}</p></div><span class="text-yellow-600 font-semibold px-3 py-1 bg-yellow-100 rounded-full text-sm">On Break</span></div>`;
        }).join('');
    });
}


// ##################################
// # AUTHENTICATION & INITIALIZATION
// ##################################

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        const staffDocSnap = await getDoc(staffDocRef);

        if (staffDocSnap.exists()) {
            const staffData = staffDocSnap.data();
            if (staffData.role && staffData.role !== 'pending') {
                window.userData = staffData;
                document.getElementById('welcome-message').textContent = `Welcome, ${staffData.name}`;
                document.getElementById('user-role').textContent = `Role: ${capitalize(staffData.role)}`;

                const allNavItems = {
                    navTutorManagement: { fn: renderManagementTutorView, perm: 'viewTutorManagement' },
                    navPayAdvice: { fn: renderPayAdvicePanel, perm: 'viewPayAdvice' },
                    navTutorReports: { fn: renderTutorReportsPanel, perm: 'viewTutorReports' },
                    navSummerBreak: { fn: renderSummerBreakPanel, perm: 'viewSummerBreak' }
                };

                const navContainer = document.querySelector('nav');
                const originalNavButtons = {};
                if(navContainer) {
                    navContainer.querySelectorAll('.nav-btn').forEach(btn => {
                        originalNavButtons[btn.id] = btn.textContent;
                    });

                    navContainer.innerHTML = '';
                    let firstVisibleTab = null;

                    Object.entries(allNavItems).forEach(([id, item]) => {
                        if (window.userData.permissions?.tabs?.[item.perm]) {
                            if (!firstVisibleTab) firstVisibleTab = id;
                            const button = document.createElement('button');
                            button.id = id;
                            button.className = 'nav-btn text-lg font-semibold text-gray-500 hover:text-green-700';
                            button.textContent = originalNavButtons[id];
                            navContainer.appendChild(button);
                            
                            button.addEventListener('click', () => {
                                document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
                                button.classList.add('active');
                                item.fn(mainContent);
                            });
                        }
                    });

                    if (firstVisibleTab) {
                        document.getElementById(firstVisibleTab).click();
                    } else {
                        if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
                    }
                }
                
                if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));

            } else {
                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${staffData.name}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = 'Status: Pending Approval';
                if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval.</p>`;
                if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
            }
        } else {
            if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Account not registered in staff directory.</p>`;
            if (logoutBtn) logoutBtn.classList.add('hidden');
        }
    } else {
        window.location.href = "management-auth.html";
    }
});
