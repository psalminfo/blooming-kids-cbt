import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
import { saveAs } from "https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js";

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

async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="panel">
            <div class="flex flex-col sm:flex-row justify-between items-center mb-4">
                 <h2 class="text-3xl font-bold text-green-700">Tutor & Student Directory</h2>
                 <div class="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mt-4 sm:mt-0">
                    <div class="count-badge"><h4 class="font-bold text-green-800 text-base">Total Tutors</h4><p id="tutor-count-badge" class="text-3xl font-extrabold">0</p></div>
                    <div class="count-badge"><h4 class="font-bold text-yellow-800 text-base">Total Students</h4><p id="student-count-badge" class="text-3xl font-extrabold">0</p></div>
                </div>
            </div>
            <div id="directory-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading directory...</p>
            </div>
        </div>
    `;

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
    directoryList.innerHTML = tutorsSnapshot.docs.map(tutorDoc => {
        const tutor = tutorDoc.data();
        const assignedStudents = studentsByTutor[tutor.email] || [];
        
        const studentsTableRows = assignedStudents
            .sort((a, b) => a.studentName.localeCompare(b.studentName))
            .map(student => `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-2 text-base font-medium">${student.studentName}</td>
                    <td class="px-4 py-2 text-base">${student.grade}</td>
                    <td class="px-4 py-2 text-base">${student.days}</td>
                    <td class="px-4 py-2 text-base">${student.parentEmail || 'N/A'}</td>
                </tr>
            `).join('');

        return `
            <div class="border rounded-lg shadow-sm">
                <details>
                    <summary class="p-4 cursor-pointer flex justify-between items-center font-bold text-xl">
                        ${tutor.name}
                        <span class="ml-2 text-base font-normal text-gray-500">(${assignedStudents.length} students)</span>
                    </summary>
                    <div class="border-t p-2">
                        <table class="min-w-full text-base">
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
}

async function renderPayAdvicePanel(container) {
    const canExport = window.userData.permissions?.actions?.canExportPayAdvice === true;
    container.innerHTML = `
        <div class="panel">
            <h2 class="text-3xl font-bold text-green-700 mb-4">Tutor Pay Advice</h2>
            <div class="bg-green-50 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label for="start-date" class="block text-base font-medium">Start Date</label>
                    <input type="date" id="start-date" class="mt-1 block w-full p-2 border rounded-md text-base">
                </div>
                <div>
                    <label for="end-date" class="block text-base font-medium">End Date</label>
                    <input type="date" id="end-date" class="mt-1 block w-full p-2 border rounded-md text-base">
                </div>
                <div class="flex items-center space-x-4 col-span-2">
                     <div class="count-badge w-full"><h4 class="font-bold text-green-800 text-base">Active Tutors</h4><p id="pay-tutor-count" class="text-3xl font-extrabold">0</p></div>
                    <div class="count-badge w-full"><h4 class="font-bold text-yellow-800 text-base">Total Students</h4><p id="pay-student-count" class="text-3xl font-extrabold">0</p></div>
                    ${canExport ? `<button id="export-pay-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 h-full shadow text-base">Export CSV</button>` : ''}
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-base font-medium uppercase">Tutor</th><th class="px-6 py-3 text-left text-base font-medium uppercase">Students</th><th class="px-6 py-3 text-left text-base font-medium uppercase">Student Fees</th><th class="px-6 py-3 text-left text-base font-medium uppercase">Mgmt. Fee</th><th class="px-6 py-3 text-left text-base font-medium uppercase">Total Pay</th></tr></thead>
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
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Loading pay data...</td></tr>`;

    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    const reportsQuery = query(collection(db, "tutor_submissions"), where("submittedAt", ">=", startTimestamp), where("submittedAt", "<=", endTimestamp));
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
    tableBody.innerHTML = payData.map(d => `<tr><td class="px-6 py-4 text-base">${d.tutorName}</td><td class="px-6 py-4 text-base">${d.studentCount}</td><td class="px-6 py-4 text-base">₦${d.totalStudentFees.toFixed(2)}</td><td class="px-6 py-4 text-base">₦${d.managementFee.toFixed(2)}</td><td class="px-6 py-4 font-bold text-base">₦${d.totalPay.toFixed(2)}</td></tr>`).join('');
    
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
}

async function renderTutorReportsPanel(container) {
    container.innerHTML = `
        <div class="panel mb-6">
            <h2 class="text-3xl font-bold text-green-700 mb-4">Tutor Reports</h2>
            <div id="tutor-reports-list" class="space-y-4"><p class="text-center">Loading reports...</p></div>
        </div>
    `;
    loadTutorReportsForAdmin();
}

async function loadTutorReportsForAdmin() {
    const reportsListContainer = document.getElementById('tutor-reports-list');
    onSnapshot(query(collection(db, "tutor_submissions"), orderBy("submittedAt", "desc")), (snapshot) => {
        const tutorCountEl = document.getElementById('report-tutor-count');
        const reportCountEl = document.getElementById('report-count');
        if (!tutorCountEl || !reportCountEl) return;

        if (snapshot.empty) {
            reportsListContainer.innerHTML = `<p class="text-gray-500 text-center">No reports have been submitted yet.</p>`;
            tutorCountEl.textContent = 0;
            reportCountEl.textContent = 0;
            return;
        }

        const reportsByTutor = {};
        snapshot.forEach(doc => {
            const report = { id: doc.id, ...doc.data() };
            const tutorEmail = report.tutorEmail;
            if (!reportsByTutor[tutorEmail]) {
                reportsByTutor[tutorEmail] = {
                    name: report.tutorName || tutorEmail,
                    reports: []
                };
            }
            reportsByTutor[tutorEmail].reports.push(report);
        });

        tutorCountEl.textContent = Object.keys(reportsByTutor).length;
        reportCountEl.textContent = snapshot.size;

        reportsListContainer.innerHTML = Object.values(reportsByTutor).map(tutorData => {
            const reportLinks = tutorData.reports.map(report => `
                <li class="flex justify-between items-center p-2 bg-gray-50 rounded-md">
                    <span>${report.studentName} - ${new Date(report.submittedAt.seconds * 1000).toLocaleDateString()}</span>
                    <button class="download-single-report-btn bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600" data-report-id="${report.id}">Download PDF</button>
                </li>
            `).join('');

            return `
                <div class="border rounded-lg shadow-sm">
                    <details>
                        <summary class="p-4 cursor-pointer flex justify-between items-center font-semibold text-lg">
                            <div>
                                ${tutorData.name} 
                                <span class="ml-2 text-sm font-normal text-gray-500">(${tutorData.reports.length} reports)</span>
                            </div>
                            <button class="download-all-btn bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700" data-tutor-email="${tutorData.reports[0].tutorEmail}">Download All as ZIP</button>
                        </summary>
                        <div class="p-4 border-t">
                            <ul class="space-y-2">${reportLinks}</ul>
                        </div>
                    </details>
                </div>
            `;
        }).join('');

        reportsListContainer.querySelectorAll('.download-single-report-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the dropdown from closing
                downloadAdminReport(e.target.dataset.reportId);
            });
        });

        reportsListContainer.querySelectorAll('.download-all-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const tutorEmail = e.target.dataset.tutorEmail;
                const reportsToDownload = reportsByTutor[tutorEmail].reports;
                
                button.textContent = 'Zipping...';
                button.disabled = true;

                try {
                    const zip = new JSZip();
                    for (const report of reportsToDownload) {
                        const pdfBlob = await downloadAdminReport(report.id, true);
                        if (pdfBlob) {
                            const fileName = `${report.studentName}_${new Date(report.submittedAt.seconds * 1000).toLocaleDateString().replace(/\//g, '-')}.pdf`;
                            zip.file(fileName, pdfBlob);
                        }
                    }

                    const content = await zip.generateAsync({ type: "blob" });
                    saveAs(content, `${reportsByTutor[tutorEmail].name.replace(/\s+/g, '_')}_Reports.zip`);

                } catch (error) {
                    console.error("Error creating ZIP file:", error);
                    alert("An error occurred while creating the ZIP file.");
                } finally {
                    button.textContent = 'Download All as ZIP';
                    button.disabled = false;
                }
            });
        });
    });
}

async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="panel">
            <h2 class="text-3xl font-bold text-green-700 mb-4">Students on Summer Break</h2>
            <div id="break-students-list" class="space-y-4"><p class="text-center">Loading...</p></div>
        </div>
    `;
    onSnapshot(query(collection(db, "students"), where("summerBreak", "==", true)), (snapshot) => {
        const listContainer = document.getElementById('break-students-list');
        if (!listContainer) return;
        if (snapshot.empty) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 text-base">No students are on break.</p>`;
            return;
        }
        listContainer.innerHTML = snapshot.docs.map(doc => {
            const student = doc.data();
            return `<div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50"><div><p class="text-lg font-semibold"><strong>Student:</strong> ${student.studentName}</p><p class="text-lg"><strong>Tutor:</strong> ${student.tutorEmail}</p></div><button class="end-break-btn bg-red-500 text-white px-4 py-2 rounded-full shadow hover:bg-red-600" data-student-id="${doc.id}">End Break</button></div>`;
        }).join('');

        document.querySelectorAll('.end-break-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const studentId = e.target.dataset.studentId;
                try {
                    await updateDoc(doc(db, "students", studentId), {
                        summerBreak: false
                    });
                } catch (error) {
                    alert(`Error ending break: ${error.message}`);
                }
            });
        });
    });
}

async function downloadAdminReport(reportId, returnBlob = false) {
    try {
        const reportDoc = await getDoc(doc(db, "tutor_submissions", reportId));
        if (!reportDoc.exists()) throw new Error("Report not found!");

        const reportData = reportDoc.data();

        let parentEmail = 'N/A';
        if (reportData.studentId) {
            const studentDoc = await getDoc(doc(db, "students", reportData.studentId));
            if (studentDoc.exists()) {
                parentEmail = studentDoc.data().parentEmail || 'N/A';
            }
        }

        const logoUrl = "https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/logo.png";
        const reportTemplate = `
            <div style="font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: auto;">
                <div style="text-align: center; margin-bottom: 2rem;">
                    <img src="${logoUrl}" alt="Company Logo" style="height: 80px; margin-bottom: 1rem;">
                    <h3 style="font-size: 1.8rem; font-weight: bold; color: #15803d; margin: 0;">Blooming Kids House</h3>
                    <h1 style="font-size: 1.2rem; font-weight: bold; color: #166534; margin-top: 0.5rem;">MONTHLY LEARNING REPORT</h1>
                    <p style="color: #4b5563;">Date: ${new Date(reportData.submittedAt.seconds * 1000).toLocaleDateString()}</p>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                    <p><strong>Student's Name:</strong> ${reportData.studentName}</p>
                    <p><strong>Parent's Email:</strong> ${parentEmail}</p>
                    <p><strong>Grade:</strong> ${reportData.grade}</p>
                    <p><strong>Tutor's Name:</strong> ${reportData.tutorName}</p>
                </div>
                ${Object.entries({
                    "INTRODUCTION": reportData.introduction, "TOPICS & REMARKS": reportData.topics, "PROGRESS AND ACHIEVEMENTS": reportData.progress,
                    "STRENGTHS AND WEAKNESSES": reportData.strengthsWeaknesses, "RECOMMENDATIONS": reportData.recommendations, "GENERAL TUTOR'S COMMENTS": reportData.generalComments
                }).map(([title, content]) => `<div style="border-top: 1px solid #d1d5db; padding-top: 1rem; margin-top: 1rem;"><h2 style="font-size: 1.25rem; font-weight: bold; color: #16a34a;">${title}</h2><p style="line-height: 1.6; white-space: pre-wrap;">${content || 'N/A'}</p></div>`).join('')}
                <div style="margin-top: 3rem; text-align: right;"><p>Best regards,</p><p style="font-weight: bold;">${reportData.tutorName}</p></div>
            </div>`;

        const opt = {
            margin: 0.5,
            filename: `${reportData.studentName}_report.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        if (returnBlob) {
            return await html2pdf().from(reportTemplate).set(opt).outputPdf('blob');
        } else {
            html2pdf().from(reportTemplate).set(opt).save();
        }

    } catch (error) {
        console.error("Error generating PDF:", error);
        alert(`Failed to download report: ${error.message}`);
        return null;
    }
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
                navContainer.innerHTML = '';
                let firstVisibleTab = null;

                Object.entries(allNavItems).forEach(([id, item]) => {
                    if (window.userData.permissions?.tabs?.[item.perm]) {
                        if (!firstVisibleTab) firstVisibleTab = id;
                        const button = document.createElement('button');
                        button.id = id;
                        button.className = 'nav-btn text-lg font-bold text-gray-500 hover:text-white';
                        button.textContent = document.querySelector(`[id="${id}"]`)?.textContent || (id === 'navTutorManagement' ? 'Tutor & Student List' : id === 'navPayAdvice' ? 'Pay Advice' : id === 'navTutorReports' ? 'Tutor Reports' : id === 'navSummerBreak' ? 'Summer Break' : '');
                        navContainer.appendChild(button);
                        
                        button.addEventListener('click', () => {
                            document.querySelectorAll('.nav-btn').forEach(btn => {
                                btn.classList.remove('active');
                            });
                            button.classList.add('active');
                            item.fn(mainContent);
                        });
                    }
                });

                if (firstVisibleTab) {
                    const firstTabButton = document.getElementById(firstVisibleTab);
                    if (firstTabButton) {
                        firstTabButton.classList.add('active');
                        allNavItems[firstVisibleTab].fn(mainContent);
                    }
                } else {
                    mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
                }
                
                logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));

            } else {
                document.getElementById('welcome-message').textContent = `Hello, ${staffData.name}`;
                document.getElementById('user-role').textContent = 'Status: Pending Approval';
                mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval.</p>`;
                logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
            }
        } else {
            mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Account not registered in staff directory.</p>`;
            logoutBtn.classList.add('hidden');
        }
    } else {
        window.location.href = "management-auth.html";
    }
});
