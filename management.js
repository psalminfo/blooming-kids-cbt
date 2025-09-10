import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
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

// ### START: NEW STUDENT APPROVAL FUNCTIONS ###

async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Pending Student Approvals</h2>
            <div id="pending-students-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pending students...</p>
            </div>
        </div>
        
        <div id="edit-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 hidden items-center justify-center">
            <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 class="text-xl font-bold mb-4">Edit Student</h3>
                <form id="edit-student-form">
                    <input type="hidden" id="edit-student-id">
                    <div class="mb-4">
                        <label for="edit-student-name" class="block text-sm font-medium">Student Name</label>
                        <input type="text" id="edit-student-name" class="mt-1 block w-full p-2 border rounded-md" required>
                    </div>
                    <div class="mb-4">
                        <label for="edit-student-grade" class="block text-sm font-medium">Grade</label>
                        <input type="text" id="edit-student-grade" class="mt-1 block w-full p-2 border rounded-md" required>
                    </div>
                    <div class="mb-4">
                        <label for="edit-student-days" class="block text-sm font-medium">Days/Week</label>
                        <input type="number" id="edit-student-days" class="mt-1 block w-full p-2 border rounded-md" required>
                    </div>
                    <div class="mb-4">
                        <label for="edit-student-fee" class="block text-sm font-medium">Student Fee (₦)</label>
                        <input type="number" id="edit-student-fee" class="mt-1 block w-full p-2 border rounded-md" required>
                    </div>
                    <div class="flex justify-end space-x-4">
                        <button type="button" id="cancel-edit-btn" class="bg-gray-300 px-4 py-2 rounded">Cancel</button>
                        <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    loadPendingStudents();
}

function loadPendingStudents() {
    const listContainer = document.getElementById('pending-students-list');
    const q = query(collection(db, "students"), where("status", "==", "pending"));

    onSnapshot(q, (snapshot) => {
        if (!listContainer) return;
        if (snapshot.empty) {
            listContainer.innerHTML = `<p class="text-center text-gray-500">No students are currently awaiting approval.</p>`;
            return;
        }

        listContainer.innerHTML = snapshot.docs.map(doc => {
            const student = { id: doc.id, ...doc.data() };
            const subjects = student.subjects?.join(', ') || 'N/A';
            return `
                <div class="border p-4 rounded-lg shadow-sm bg-gray-50">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                        <div>
                            <p><strong>Student:</strong> ${student.studentName}</p>
                            <p><strong>Grade:</strong> ${student.grade}</p>
                            <p><strong>Subjects:</strong> ${subjects}</p>
                        </div>
                        <div>
                            <p><strong>Parent:</strong> ${student.parentName || 'N/A'}</p>
                            <p><strong>Phone:</strong> ${student.parentPhone || 'N/A'}</p>
                            <p><strong>Assigned Tutor:</strong> ${student.tutorEmail}</p>
                        </div>
                        <div class="flex flex-col md:flex-row md:items-center md:justify-end space-y-2 md:space-y-0 md:space-x-2">
                            <button class="edit-student-btn bg-blue-500 text-white px-3 py-1 rounded text-sm" data-student-id="${student.id}">Edit</button>
                            <button class="approve-student-btn bg-green-600 text-white px-3 py-1 rounded text-sm" data-student-id="${student.id}">Approve</button>
                            <button class="reject-student-btn bg-red-600 text-white px-3 py-1 rounded text-sm" data-student-id="${student.id}" data-student-name="${student.studentName}">Reject</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners
        attachPendingStudentActionListeners();
    });
}

function attachPendingStudentActionListeners() {
    document.querySelectorAll('.approve-student-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const studentId = e.target.dataset.studentId;
            if (confirm('Are you sure you want to approve this student?')) {
                await updateDoc(doc(db, "students", studentId), { status: "active" });
                alert('Student approved.');
            }
        };
    });

    document.querySelectorAll('.reject-student-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const studentId = e.target.dataset.studentId;
            const studentName = e.target.dataset.studentName;
            if (confirm(`Are you sure you want to REJECT and DELETE ${studentName}? This action cannot be undone.`)) {
                await deleteDoc(doc(db, "students", studentId));
                alert('Student rejected and deleted.');
            }
        };
    });

    document.querySelectorAll('.edit-student-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const studentId = e.target.dataset.studentId;
            const studentDoc = await getDoc(doc(db, "students", studentId));
            if (studentDoc.exists()) {
                showEditStudentModal(studentDoc.data(), studentId);
            }
        };
    });
}

function showEditStudentModal(studentData, studentId) {
    const modal = document.getElementById('edit-student-modal');
    document.getElementById('edit-student-id').value = studentId;
    document.getElementById('edit-student-name').value = studentData.studentName || '';
    document.getElementById('edit-student-grade').value = studentData.grade || '';
    document.getElementById('edit-student-days').value = studentData.days || 0;
    document.getElementById('edit-student-fee').value = studentData.studentFee || 0;
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const form = document.getElementById('edit-student-form');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    
    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const updatedData = {
            studentName: document.getElementById('edit-student-name').value,
            grade: document.getElementById('edit-student-grade').value,
            days: parseInt(document.getElementById('edit-student-days').value, 10),
            studentFee: parseFloat(document.getElementById('edit-student-fee').value)
        };
        await updateDoc(doc(db, "students", studentId), updatedData);
        alert('Student details updated.');
        closeModal();
    };
    
    cancelBtn.onclick = closeModal;
}

// ### END: NEW STUDENT APPROVAL FUNCTIONS ###


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

                const allNavItems = {
                    navTutorManagement: { fn: renderManagementTutorView, perm: 'viewTutorManagement' },
                    // ADD THIS NEW LINE
                    navPendingApprovals: { fn: renderPendingApprovalsPanel, perm: 'canApproveStudents' },
                    navPayAdvice: { fn: renderPayAdvicePanel, perm: 'viewPayAdvice' },
                    navTutorReports: { fn: renderTutorReportsPanel, perm: 'viewTutorReports' },
                    navSummerBreak: { fn: renderSummerBreakPanel, perm: 'viewSummerBreak' }
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
