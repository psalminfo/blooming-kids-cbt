import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, onSnapshot, addDoc, deleteDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

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
                .map(student => {
                    const subjects = student.subjects && Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
                    return `
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-2 font-medium">${student.studentName}</td>
                            <td class="px-4 py-2">${student.grade}</td>
                            <td class="px-4 py-2">${student.days}</td>
                            <td class="px-4 py-2">${subjects}</td>
                            <td class="px-4 py-2">${student.parentName || 'N/A'}</td>
                            <td class="px-4 py-2">${student.parentPhone || 'N/A'}</td>
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
                reportsByTutor[report.tutorEmail] = {
                    name: report.tutorName || report.tutorEmail,
                    reports: []
                };
            }
            reportsByTutor[report.tutorEmail].reports.push(report);
        });

        const canDownload = window.userData.permissions?.actions?.canDownloadReports === true;
        reportsListContainer.innerHTML = Object.values(reportsByTutor).map(tutorData => {
            const reportsHtml = tutorData.reports.map(report => `
                <div class="bg-white p-4 rounded-lg border border-gray-200">
                    <h5 class="font-semibold text-sm">Report for ${report.month} ${report.year}</h5>
                    <p class="text-xs text-gray-500">Submitted on: ${report.submittedAt?.toDate().toLocaleString()}</p>
                    <ul class="list-disc list-inside mt-2 text-sm text-gray-700">
                        <li>Total Hours: ${report.totalHours}</li>
                        <li>Total Taught: ${report.totalTaught}</li>
                    </ul>
                    ${report.studentSummary?.length > 0 ? `
                        <div class="mt-2">
                            <h6 class="font-medium text-xs text-gray-600">Student Summary:</h6>
                            <ul class="list-disc list-inside text-xs mt-1">
                                ${report.studentSummary.map(s => `<li>${s.studentName}: ${s.status}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${canDownload ? `<button onclick="window.downloadReport('${report.id}')" class="mt-4 bg-green-500 text-white text-xs px-3 py-1 rounded hover:bg-green-600">Download Report</button>` : ''}
                </div>
            `).join('');

            return `
                <div class="border rounded-lg shadow-sm">
                    <details>
                        <summary class="p-4 cursor-pointer flex justify-between items-center font-bold text-lg text-green-800 bg-gray-50">
                            ${tutorData.name} (${tutorData.reports.length} reports)
                        </summary>
                        <div class="p-4 space-y-4 border-t border-gray-200">
                            ${reportsHtml}
                        </div>
                    </details>
                </div>
            `;
        }).join('');
    });
}

async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Summer Break Management</h2>
            <div id="summer-break-content">
                <p class="text-center text-gray-500">Feature not yet implemented. Placeholder content for Summer Break management.</p>
            </div>
        </div>
    `;
}

// ### PENDING APPROVALS ###
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Pending Student Approvals</h2>
            <div id="pending-approvals-list" class="space-y-4">
                <p class="text-center text-gray-500">Loading pending students...</p>
            </div>
        </div>
    `;
    loadPendingStudents(document.getElementById('pending-approvals-list'));
}

async function handleStudentApproval(studentId, isApproved) {
    const studentRef = doc(db, 'students', studentId);
    try {
        const batch = writeBatch(db);
        batch.update(studentRef, {
            isPending: false,
            isActive: isApproved,
            status: isApproved ? 'Active' : 'Rejected'
        });
        
        // If rejected, also remove the student from the tutor's list
        if (!isApproved) {
            const studentSnap = await getDoc(studentRef);
            if(studentSnap.exists()){
                const studentData = studentSnap.data();
                if(studentData.tutorEmail){
                    const tutorRef = doc(db, 'tutors', studentData.tutorEmail);
                    batch.update(tutorRef, {
                        studentList: arrayRemove(studentId)
                    });
                }
            }
        }
        await batch.commit();
        alert(`Student ${isApproved ? 'approved' : 'rejected'} successfully.`);
    } catch(error) {
        console.error("Error updating student approval status:", error);
        alert("Failed to update student status.");
    }
}

async function handleStudentEdit(studentId, currentData) {
    const studentName = prompt("Edit Student Name:", currentData.studentName);
    const grade = prompt("Edit Grade:", currentData.grade);
    const days = prompt("Edit Days/Week:", currentData.days);
    const fee = prompt("Edit Student Fee:", currentData.studentFee);

    if (studentName && grade && days && fee) {
        try {
            await updateDoc(doc(db, 'students', studentId), {
                studentName,
                grade: Number(grade),
                days: Number(days),
                studentFee: Number(fee),
                isPending: false,
                isActive: true,
                status: 'Active'
            });
            alert("Student information updated and approved.");
        } catch(error) {
            console.error("Error editing student info:", error);
            alert("Failed to edit student information.");
        }
    }
}

async function handleStudentDelete(studentId) {
    if (confirm("Are you sure you want to delete this student?")) {
        try {
            await deleteDoc(doc(db, 'students', studentId));
            alert("Student deleted successfully.");
        } catch (error) {
            console.error("Error deleting student:", error);
            alert("Failed to delete student.");
        }
    }
}

function loadPendingStudents(container) {
    const pendingQuery = query(collection(db, "students"), where("isPending", "==", true));

    onSnapshot(pendingQuery, (snapshot) => {
        if (snapshot.empty) {
            container.innerHTML = `<p class="text-center text-gray-500">No pending student approvals at this time.</p>`;
            return;
        }

        container.innerHTML = snapshot.docs.map(doc => {
            const student = { id: doc.id, ...doc.data() };
            return `
                <div class="bg-gray-100 p-4 rounded-lg shadow-sm border border-yellow-200">
                    <h4 class="font-bold text-lg text-yellow-800">${student.studentName}</h4>
                    <p class="text-sm text-gray-600">Tutor: ${student.tutorName}</p>
                    <p class="text-sm text-gray-600">Grade: ${student.grade}</p>
                    <p class="text-sm text-gray-600">Days: ${student.days}</p>
                    <p class="text-sm text-gray-600">Fee: ₦${student.studentFee}</p>
                    <div class="mt-4 flex space-x-2">
                        <button onclick="handleStudentApproval('${student.id}', true)" class="bg-green-500 text-white text-xs px-3 py-1 rounded hover:bg-green-600">Approve</button>
                        <button onclick="handleStudentApproval('${student.id}', false)" class="bg-red-500 text-white text-xs px-3 py-1 rounded hover:bg-red-600">Reject</button>
                        <button onclick="handleStudentEdit('${student.id}', ${JSON.stringify(student)})" class="bg-blue-500 text-white text-xs px-3 py-1 rounded hover:bg-blue-600">Edit</button>
                        <button onclick="handleStudentDelete('${student.id}')" class="bg-gray-500 text-white text-xs px-3 py-1 rounded hover:bg-gray-600">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        window.handleStudentApproval = handleStudentApproval;
        window.handleStudentEdit = handleStudentEdit;
        window.handleStudentDelete = handleStudentDelete;
    });
}

// ##################################
// # INITIALIZATION LOGIC
// ##################################

function initializeManagementPanel(staffData) {
    const mainContent = document.getElementById('main-content');
    const welcomeMessage = document.getElementById('welcome-message');
    const userRole = document.getElementById('user-role');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!mainContent || !welcomeMessage || !userRole || !logoutBtn) {
        console.error("Critical elements not found in the DOM.");
        return;
    }

    welcomeMessage.textContent = `Hello, ${staffData.name}`;
    userRole.textContent = staffData.role;

    const allNavItems = {
        navTutorManagement: { fn: renderManagementTutorView, requiredPermission: 'canManageTutorsAndStudents' },
        navPayAdvice: { fn: renderPayAdvicePanel, requiredPermission: 'canAccessPayAdvice' },
        navStudentApprovals: { fn: renderPendingApprovalsPanel, requiredPermission: 'canApproveStudents' },
        navTutorReports: { fn: renderTutorReportsPanel, requiredPermission: 'canAccessTutorReports' },
        navSummerBreak: { fn: renderSummerBreakPanel, requiredPermission: 'canManageSummerBreak' }
    };

    const navContainer = document.querySelector('nav');
    navContainer.innerHTML = '';
    
    let firstVisibleTab = null;

    Object.entries(allNavItems).forEach(([id, item]) => {
        if (staffData.permissions?.tabs?.[item.requiredPermission]) {
            const button = document.createElement('button');
            button.id = id;
            button.className = 'nav-btn text-lg font-bold text-gray-500 hover:text-white';
            button.textContent = document.getElementById(id)?.textContent || capitalize(id.replace('nav', ''));
            navContainer.appendChild(button);

            if (!firstVisibleTab) {
                firstVisibleTab = id;
            }

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
        mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
    }

    logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
}

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (!mainContent || !logoutBtn) return;

    if (user) {
        const staffDocRef = doc(db, 'management', user.email);
        const unsubscribe = onSnapshot(staffDocRef, async (docSnap) => {
            const staffData = docSnap.data();

            if (docSnap.exists() && staffData?.status === 'approved') {
                if (window.userData && JSON.stringify(window.userData.permissions) === JSON.stringify(staffData.permissions)) {
                    return; // No change in permissions, no re-render needed
                }
                window.userData = staffData;
                
                const welcomeMessage = document.getElementById('welcome-message');
                const userRole = document.getElementById('user-role');
                if (welcomeMessage) welcomeMessage.textContent = `Hello, ${staffData.name}`;
                if (userRole) userRole.textContent = staffData.role;

                const navContainer = document.querySelector('nav');
                navContainer.innerHTML = '';
                
                let firstVisibleTab = null;

                const allNavItems = {
                    navTutorManagement: { fn: renderManagementTutorView, requiredPermission: 'canManageTutorsAndStudents' },
                    navPayAdvice: { fn: renderPayAdvicePanel, requiredPermission: 'canAccessPayAdvice' },
                    navStudentApprovals: { fn: renderPendingApprovalsPanel, requiredPermission: 'canApproveStudents' },
                    navTutorReports: { fn: renderTutorReportsPanel, requiredPermission: 'canAccessTutorReports' },
                    navSummerBreak: { fn: renderSummerBreakPanel, requiredPermission: 'canManageSummerBreak' }
                };

                Object.entries(allNavItems).forEach(([id, item]) => {
                    if (staffData.permissions?.tabs?.[item.requiredPermission]) {
                        const button = document.createElement('button');
                        button.id = id;
                        button.className = 'nav-btn text-lg font-bold text-gray-500 hover:text-white';
                        button.textContent = document.getElementById(id)?.textContent || capitalize(id.replace('nav', ''));
                        navContainer.appendChild(button);

                        if (!firstVisibleTab) {
                            firstVisibleTab = id;
                        }
                        
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

            } else {
                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${staffData.name}`;
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
