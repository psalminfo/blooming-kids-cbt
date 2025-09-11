import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
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
// # NEW ACTION HANDLER FUNCTIONS
// ##################################

// UPDATED: This function now fetches student data and prepares for editing
async function handleEditStudent(studentId) {
    try {
        const studentRef = doc(db, "students", studentId);
        const studentDoc = await getDoc(studentRef);

        if (!studentDoc.exists()) {
            alert("Student not found!");
            return;
        }

        const studentData = studentDoc.data();
        console.log("Student data fetched for editing:", studentData);

        // ### IMPORTANT: THIS IS WHERE YOU'D OPEN YOUR EDIT MODAL/FORM ###
        // For now, we'll just show an alert with the data, but you
        // would take studentData and populate a form with it.
        const newStudentName = prompt(`Editing ${studentData.studentName}. Enter new name:`, studentData.studentName);
        if (newStudentName !== null && newStudentName.trim() !== "") {
            await updateDoc(studentRef, { studentName: newStudentName });
            alert("Student name updated successfully!");
        }

    } catch (error) {
        console.error("Error fetching student for edit: ", error);
        alert("Error fetching student data. Check the console for details.");
    }
}

// Placeholder function to handle student deletion
async function handleDeleteStudent(studentId) {
    if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "students", studentId));
            console.log("Student successfully deleted!");
            alert("Student deleted successfully!");
            // Rerender the view to update the list.
            renderManagementTutorView(document.getElementById('main-content'));
        } catch (error) {
            console.error("Error removing student: ", error);
            alert("Error deleting student. Check the console for details.");
        }
    }
}

// NEW function to handle accepting a student
async function handleApproveStudent(studentId) {
    if (confirm("Are you sure you want to approve this student?")) {
        try {
            const studentRef = doc(db, "pending_students", studentId);
            const studentDoc = await getDoc(studentRef);
            if (!studentDoc.exists()) {
                alert("Student not found.");
                return;
            }
            const studentData = studentDoc.data();
            
            // Create a write batch
            const batch = writeBatch(db);
            
            // Set the student data in the main 'students' collection
            const newStudentRef = doc(db, "students", studentId);
            batch.set(newStudentRef, { ...studentData, status: 'approved' });
            
            // Delete the student from the 'pending_students' collection
            batch.delete(studentRef);
            
            // Commit the batch
            await batch.commit();

            alert("Student approved successfully!");
            // The onSnapshot listener will automatically re-render the view
        } catch (error) {
            console.error("Error approving student: ", error);
            alert("Error approving student. Check the console for details.");
        }
    }
}

// NEW function to handle rejecting (deleting) a student
async function handleRejectStudent(studentId) {
    if (confirm("Are you sure you want to reject this student? This will delete their entry.")) {
        try {
            await deleteDoc(doc(db, "pending_students", studentId));
            alert("Student rejected successfully!");
            // The onSnapshot listener will automatically re-render the view
        } catch (error) {
            console.error("Error rejecting student: ", error);
            alert("Error rejecting student. Check the console for details.");
        }
    }
}


// ##################################
// # PANEL RENDERING FUNCTIONS
// ##################################

async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor & Student Directory</h2>
                <div class="flex space-x-4">
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow">
                        <h4 class="font-bold text-green-800 text-sm">Total Tutors</h4>
                        <p id="tutor-count-badge" class="text-2xl font-extrabold">0</p>
                    </div>
                    <div class="bg-yellow-100 p-3 rounded-lg text-center shadow">
                        <h4 class="font-bold text-yellow-800 text-sm">Total Students</h4>
                        <p id="student-count-badge" class="text-2xl font-extrabold">0</p>
                    </div>
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
            const student = { id: doc.id, ...doc.data() };
            if (!studentsByTutor[student.tutorEmail]) {
                studentsByTutor[student.tutorEmail] = [];
            }
            studentsByTutor[student.tutorEmail].push(student);
        });

        const directoryList = document.getElementById('directory-list');
        if (!directoryList) return;

        const canEditStudents = window.userData.permissions?.actions?.canEditStudents === true;
        const canDeleteStudents = window.userData.permissions?.actions?.canDeleteStudents === true;
        const showActionsColumn = canEditStudents || canDeleteStudents;

        directoryList.innerHTML = tutorsSnapshot.docs.map(tutorDoc => {
            const tutor = tutorDoc.data();
            const assignedStudents = studentsByTutor[tutor.email] || [];
            
            const studentsTableRows = assignedStudents
                .sort((a, b) => a.studentName.localeCompare(b.studentName))
                .map(student => {
                    const subjects = student.subjects && Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
                    const actionButtons = `
                        ${canEditStudents ? `<button class="edit-student-btn bg-blue-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Edit</button>` : ''}
                        ${canDeleteStudents ? `<button class="delete-student-btn bg-red-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Delete</button>` : ''}
                    `;
                    return `
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-2 font-medium">${student.studentName}</td>
                            <td class="px-4 py-2">${student.grade}</td>
                            <td class="px-4 py-2">${student.days}</td>
                            <td class="px-4 py-2">${subjects}</td>
                            <td class="px-4 py-2">${student.parentName || 'N/A'}</td>
                            <td class="px-4 py-2">${student.parentPhone || 'N/A'}</td>
                            ${showActionsColumn ? `<td class="px-4 py-2">${actionButtons}</td>` : ''}
                        </tr>
                    `;
                }).join('');

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
                                    <th class="px-4 py-2 font-medium">Subject</th>
                                    <th class="px-4 py-2 font-medium">Parent's Name</th>
                                    <th class="px-4 py-2 font-medium">Parent's Phone</th>
                                    ${showActionsColumn ? `<th class="px-4 py-2 font-medium">Actions</th>` : ''}
                                </tr></thead>
                                <tbody class="bg-white divide-y divide-gray-200">${studentsTableRows}</tbody>
                            </table>
                        </div>
                    </details>
                </div>
            `;
        }).join('');

        if (canEditStudents) {
            document.querySelectorAll('.edit-student-btn').forEach(button => {
                button.addEventListener('click', () => handleEditStudent(button.dataset.studentId));
            });
        }
        if (canDeleteStudents) {
            document.querySelectorAll('.delete-student-btn').forEach(button => {
                button.addEventListener('click', () => handleDeleteStudent(button.dataset.studentId));
            });
        }

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
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                        <h4 class="font-bold text-green-800 text-sm">Active Tutors</h4>
                        <p id="pay-tutor-count" class="text-2xl font-extrabold">0</p>
                    </div>
                    <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                        <h4 class="font-bold text-yellow-800 text-sm">Total Students</h4>
                        <p id="pay-student-count" class="text-2xl font-extrabold">0</p>
                    </div>
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

async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Pending Approvals</h2>
            <div id="pending-approvals-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pending students...</p>
            </div>
        </div>
    `;
    loadPendingApprovals();
}

// NEW FUNCTION
async function loadPendingApprovals() {
    const listContainer = document.getElementById('pending-approvals-list');
    onSnapshot(query(collection(db, "pending_students"), orderBy("submissionDate", "desc")), (snapshot) => {
        if (!listContainer) return;

        if (snapshot.empty) {
            listContainer.innerHTML = `<p class="text-center text-gray-500">No students are awaiting approval.</p>`;
            return;
        }

        const canApprove = window.userData.permissions?.actions?.canApproveStudents === true; // Assuming a new permission `canApproveStudents`
        const canReject = window.userData.permissions?.actions?.canDeleteStudents === true; // Reusing `canDeleteStudents` for rejection

        listContainer.innerHTML = snapshot.docs.map(doc => {
            const student = { id: doc.id, ...doc.data() };
            const date = student.submissionDate ? new Date(student.submissionDate.seconds * 1000).toLocaleDateString() : 'N/A';
            const actionButtons = `
                ${canApprove ? `<button class="approve-btn bg-green-600 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Approve</button>` : ''}
                ${canReject ? `<button class="reject-btn bg-red-600 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Reject</button>` : ''}
            `;
            return `
                <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50">
                    <div>
                        <p><strong>Student:</strong> ${student.studentName}</p>
                        <p><strong>Submitted by:</strong> ${student.submittedByEmail}</p>
                        <p><strong>Submission Date:</strong> ${date}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        ${actionButtons}
                    </div>
                </div>
            `;
        }).join('');

        if (canApprove) {
            document.querySelectorAll('.approve-btn').forEach(button => {
                button.addEventListener('click', () => handleApproveStudent(button.dataset.studentId));
            });
        }
        if (canReject) {
            document.querySelectorAll('.reject-btn').forEach(button => {
                button.addEventListener('click', () => handleRejectStudent(button.dataset.studentId));
            });
        }
    });
}


// ### UPDATED and NEW functions below ###

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
            
            // Add the Zip button if user can download
            const zipButtonHTML = canDownload
                ? `<div class="p-4 border-t"><button class="zip-reports-btn bg-blue-600 text-white px-4 py-2 text-sm rounded w-full hover:bg-blue-700" data-tutor-email="${tutorData.reports[0].tutorEmail}">Zip & Download All Reports</button></div>`
                : '';

            return `<details class="border rounded-lg">
                        <summary class="p-4 cursor-pointer font-semibold">${tutorData.name} (${tutorData.reports.length} reports)</summary>
                        <div class="p-4 border-t"><ul class="space-y-2">${reportLinks}</ul></div>
                        ${zipButtonHTML}
                    </details>`;
        }).join('');

        // Attach all event listeners
        document.querySelectorAll('.download-report-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                viewReportInNewTab(e.target.dataset.reportId, true);
            });
        });

        document.querySelectorAll('.view-report-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                viewReportInNewTab(e.target.dataset.reportId, false);
            });
        });

        document.querySelectorAll('.zip-reports-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.stopPropagation();
                const tutorEmail = e.target.dataset.tutorEmail;
                const tutorData = reportsByTutor[tutorEmail];
                if (tutorData) {
                    await zipAndDownloadTutorReports(tutorData.reports, tutorData.name, e.target);
                }
            });
        });
    });
}

// NEW HELPER FUNCTION to generate report HTML
async function generateReportHTML(reportId) {
    const reportDoc = await getDoc(doc(db, "tutor_submissions", reportId));
    if (!reportDoc.exists()) throw new Error("Report not found!");
    const reportData = reportDoc.data();
    
    const logoUrl = "https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/logo.png";
    const reportTemplate = `<div style="font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: auto;"><div style="text-align: center; margin-bottom: 2rem;"><img src="${logoUrl}" alt="Company Logo" style="height: 80px;"><h3 style="font-size: 1.8rem; font-weight: bold; color: #15803d; margin: 0;">Blooming Kids House</h3><h1 style="font-size: 1.2rem; font-weight: bold; color: #166534;">MONTHLY LEARNING REPORT</h1><p>Date: ${new Date(reportData.submittedAt.seconds * 1000).toLocaleDateString()}</p></div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;"><p><strong>Student's Name:</strong> ${reportData.studentName}</p><p><strong>Parent's Name:</strong> ${reportData.parentName || 'N/A'}</p><p><strong>Parent's Phone:</strong> ${reportData.parentPhone || 'N/A'}</p><p><strong>Grade:</strong> ${reportData.grade}</p><p><strong>Tutor's Name:</strong> ${reportData.tutorName}</p></div>${Object.entries({"INTRODUCTION": reportData.introduction, "TOPICS & REMARKS": reportData.topics, "PROGRESS & ACHIEVEMENTS": reportData.progress, "STRENGTHS AND WEAKNESSES": reportData.strengthsWeaknesses, "RECOMMENDATIONS": reportData.recommendations, "GENERAL TUTOR'S COMMENTS": reportData.generalComments}).map(([title, content]) => `<div style="border-top: 1px solid #d1d5db; padding-top: 1rem; margin-top: 1rem;"><h2 style="font-size: 1.25rem; font-weight: bold; color: #16a34a;">${title}</h2><p style="line-height: 1.6; white-space: pre-wrap;">${content || 'N/A'}</p></div>`).join('')}<div style="margin-top: 3rem; text-align: right;"><p>Best regards,</p><p style="font-weight: bold;">${reportData.tutorName}</p></div></div>`;

    return { html: reportTemplate, reportData: reportData };
}

// REFACTORED to use the new helper function
async function viewReportInNewTab(reportId, shouldDownload = false) {
    try {
        const { html, reportData } = await generateReportHTML(reportId);
        if (shouldDownload) {
            html2pdf().from(html).save(`${reportData.studentName}_report.pdf`);
        } else {
            const newWindow = window.open();
            newWindow.document.write(`<html><head><title>${reportData.studentName} Report</title></head><body>${html}</body></html>`);
            newWindow.document.close();
        }
    } catch (error) {
        console.error("Error viewing/downloading report:", error);
        alert(`Error: ${error.message}`);
    }
}

// NEW ZIPPING FUNCTION
async function zipAndDownloadTutorReports(reports, tutorName, buttonElement) {
    const originalButtonText = buttonElement.textContent;
    buttonElement.textContent = 'Zipping... (0%)';
    buttonElement.disabled = true;

    try {
        const zip = new JSZip();
        let filesGenerated = 0;

        const reportGenerationPromises = reports.map(async (report) => {
            const { html, reportData } = await generateReportHTML(report.id);
            const pdfBlob = await html2pdf().from(html).output('blob');
            filesGenerated++;
            buttonElement.textContent = `Zipping... (${Math.round((filesGenerated / reports.length) * 100)}%)`;
            return { name: `${reportData.studentName}_Report_${report.id.substring(0,5)}.pdf`, blob: pdfBlob };
        });

        const generatedPdfs = await Promise.all(reportGenerationPromises);

        generatedPdfs.forEach(pdf => {
            zip.file(pdf.name, pdf.blob);
        });

        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `${tutorName}_All_Reports.zip`);

    } catch (error) {
        console.error("Error creating zip file:", error);
        alert("Failed to create zip file. See console for details.");
    } finally {
        buttonElement.textContent = originalButtonText;
        buttonElement.disabled = false;
    }
}


async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700">Students on Summer Break</h2>
            <div id="break-status-message" class="text-center font-semibold mb-4 hidden"></div>
            <div id="break-students-list" class="space-y-4">
                <p class="text-center">Loading...</p>
            </div>
        </div>
    `;

    const statusMessageDiv = document.getElementById('break-status-message');
    const listContainer = document.getElementById('break-students-list');

    onSnapshot(query(collection(db, "students"), where("summerBreak", "==", true)), (snapshot) => {
        if (!listContainer) return;
        
        if (snapshot.empty) {
            listContainer.innerHTML = `<p class="text-center text-gray-500">No students are on break.</p>`;
            return;
        }

        const canEndBreak = window.userData.permissions?.actions?.canEndBreak;
        
        listContainer.innerHTML = snapshot.docs.map(doc => {
            const student = doc.data();
            const studentId = doc.id;
            const endBreakButton = canEndBreak 
                ? `<button class="end-break-btn bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors" data-student-id="${studentId}">End Break</button>`
                : '';

            return `
                <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50">
                    <div>
                        <p><strong>Student:</strong> ${student.studentName}</p>
                        <p><strong>Tutor:</strong> ${student.tutorEmail}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                         <span class="text-yellow-600 font-semibold px-3 py-1 bg-yellow-100 rounded-full text-sm">On Break</span>
                         ${endBreakButton}
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners to the new buttons
        if (canEndBreak) {
            document.querySelectorAll('.end-break-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const studentId = e.target.dataset.studentId;
                    try {
                        await updateDoc(doc(db, "students", studentId), { summerBreak: false, lastBreakEnd: Timestamp.now() });
                        statusMessageDiv.textContent = `Break ended for ${e.target.closest('div').querySelector('p').textContent.replace('Student: ', '')}.`;
                        statusMessageDiv.classList.remove('hidden');
                        statusMessageDiv.className = 'text-center font-semibold mb-4 text-green-600';
                    } catch (error) {
                        console.error("Error ending summer break:", error);
                        statusMessageDiv.textContent = "Failed to end summer break. Check the console for details.";
                        statusMessageDiv.className = 'text-center font-semibold mb-4 text-red-600';
                        statusMessageDiv.classList.remove('hidden');
                    }
                });
            });
        }
    });
}


// ##################################
// # AUTHENTICATION & INITIALIZATION
// ##################################

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (user) {
        // ### ADD THIS onSnapshot LISTENER ###
        const staffDocRef = doc(db, "staff", user.email);
        onSnapshot(staffDocRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().role !== 'pending') {
                const staffData = docSnap.data();
                window.userData = staffData;
                
                document.getElementById('welcome-message').textContent = `Welcome, ${staffData.name}`;
                document.getElementById('user-role').textContent = `Role: ${capitalize(staffData.role)}`;

                // ### UPDATED: Added new nav item here ###
                const allNavItems = {
                    navTutorManagement: { fn: renderManagementTutorView, perm: 'viewTutorManagement' },
                    navPayAdvice: { fn: renderPayAdvicePanel, perm: 'viewPayAdvice' },
                    navTutorReports: { fn: renderTutorReportsPanel, perm: 'viewTutorReports' },
                    navSummerBreak: { fn: renderSummerBreakPanel, perm: 'viewSummerBreak' },
                    navPendingApprovals: { fn: renderPendingApprovalsPanel, perm: 'viewPendingApprovals' }
                };

                const navContainer = document.querySelector('nav');
                const originalNavButtons = {};
                if(navContainer) {
                    // Temporarily store original text content if needed
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
                        // Check if the current tab is still available after the permission update.
                        const activeNav = document.querySelector('.nav-btn.active');
                        const activeNavId = activeNav?.id;
                        if (!activeNav || !document.getElementById(activeNavId)) {
                            // The current tab is no longer available, so switch to the first available one.
                            document.getElementById(firstVisibleTab).click();
                        } else {
                            // The current tab is still available, re-render it to apply new permissions.
                            const currentItem = allNavItems[activeNavId];
                            if(currentItem) currentItem.fn(mainContent);
                        }
                    } else {
                        if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
                    }
                }
            } else {
                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${docSnap.data()?.name}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = 'Status: Pending Approval';
                if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval.</p>`;
            }
        });

        const staffDocSnap = await getDoc(staffDocRef);
        if (!staffDocSnap.exists()) {
            if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Account not registered in staff directory.</p>`;
            if (logoutBtn) logoutBtn.classList.add('hidden');
        }

        if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));

    } else {
        window.location.href = "management-auth.html";
    }
});
