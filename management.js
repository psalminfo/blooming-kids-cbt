import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ##################################
// # SESSION CACHE & STATE
// ##################################

// Session-level cache to hold fetched data and reduce Firestore reads.
const sessionCache = {
    tutors: null,
    students: null,
    pendingStudents: null,
    reports: null,
    breakStudents: null,
};

// Session-level state for the Pay Advice gift feature.
let payAdviceGifts = {};
let currentPayData = [];

// Utility function to capitalize strings
function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// ### UPDATED FUNCTION ###
// Utility function to convert data to CSV, now includes gift and final pay details
function convertPayAdviceToCSV(data) {
    const header = [
        'Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Total Pay (₦)',
        'Gift (₦)', 'Final Pay (₦)', 'Beneficiary Bank', 'Beneficiary Account', 'Beneficiary Name'
    ];
    const rows = data.map(item => {
        const giftAmount = payAdviceGifts[item.tutorEmail] || 0;
        const finalPay = item.totalPay + giftAmount;
        return [
            `"${item.tutorName}"`,
            item.studentCount,
            item.totalStudentFees,
            item.managementFee,
            item.totalPay,
            giftAmount,
            finalPay,
            `"${item.beneficiaryBank || 'N/A'}"`,
            `"${item.beneficiaryAccount || 'N/A'}"`,
            `"${item.beneficiaryName || 'N/A'}"`
        ];
    });
    return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
}


// ##################################
// # ACTION HANDLER FUNCTIONS
// ##################################

async function handleEditStudent(studentId) {
    try {
        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (!studentDoc.exists()) {
            alert("Student not found!");
            return;
        }
        const studentData = studentDoc.data();
        showEditStudentModal(studentId, studentData, "students");
    } catch (error) {
        console.error("Error fetching student for edit: ", error);
        alert("Error fetching student data. Check the console for details.");
    }
}

async function handleEditPendingStudent(studentId) {
    try {
        const studentDoc = await getDoc(doc(db, "pending_students", studentId));
        if (!studentDoc.exists()) {
            alert("Pending student not found!");
            return;
        }
        const studentData = studentDoc.data();
        showEditStudentModal(studentId, studentData, "pending_students");
    } catch (error) {
        console.error("Error fetching pending student for edit: ", error);
        alert("Error fetching student data. Check the console for details.");
    }
}

function showEditStudentModal(studentId, studentData, collectionName) {
    const modalHtml = `
        <div id="edit-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('edit-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">Edit Student Details</h3>
                <form id="edit-student-form">
                    <input type="hidden" id="edit-student-id" value="${studentId}">
                    <input type="hidden" id="edit-collection-name" value="${collectionName}">
                    <div class="mb-2"><label class="block text-sm font-medium">Student Name</label><input type="text" id="edit-studentName" value="${studentData.studentName}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Grade</label><input type="text" id="edit-grade" value="${studentData.grade}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Days/Week</label><input type="text" id="edit-days" value="${studentData.days}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Subjects (comma-separated)</label><input type="text" id="edit-subjects" value="${studentData.subjects ? studentData.subjects.join(', ') : ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Name</label><input type="text" id="edit-parentName" value="${studentData.parentName || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Phone</label><input type="text" id="edit-parentPhone" value="${studentData.parentPhone || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Fee (₦)</label><input type="number" id="edit-studentFee" value="${studentData.studentFee || 0}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('edit-modal').remove()" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('edit-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const editedId = form.elements['edit-student-id'].value;
        const targetCollection = form.elements['edit-collection-name'].value;
        const updatedData = {
            studentName: form.elements['edit-studentName'].value,
            grade: form.elements['edit-grade'].value,
            days: form.elements['edit-days'].value,
            subjects: form.elements['edit-subjects'].value.split(',').map(s => s.trim()).filter(s => s),
            parentName: form.elements['edit-parentName'].value,
            parentPhone: form.elements['edit-parentPhone'].value,
            studentFee: Number(form.elements['edit-studentFee'].value) || 0,
        };
        try {
            await updateDoc(doc(db, targetCollection, editedId), updatedData);
            alert("Student details updated successfully!");
            document.getElementById('edit-modal').remove();
            // Invalidate cache and re-render the relevant view
            if (targetCollection === 'students') {
                sessionCache.students = null;
                renderManagementTutorView(document.getElementById('main-content'));
            } else {
                sessionCache.pendingStudents = null;
                renderPendingApprovalsPanel(document.getElementById('main-content'));
            }
        } catch (error) {
            console.error("Error updating document: ", error);
            alert("Failed to save changes. Check the console for details.");
        }
    });
}

async function handleDeleteStudent(studentId) {
    if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "students", studentId));
            alert("Student deleted successfully!");
            sessionCache.students = null; // Invalidate cache
            renderManagementTutorView(document.getElementById('main-content')); // Rerender
        } catch (error) {
            console.error("Error removing student: ", error);
            alert("Error deleting student. Check the console for details.");
        }
    }
}

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
            const batch = writeBatch(db);
            const newStudentRef = doc(db, "students", studentId);
            batch.set(newStudentRef, { ...studentData, status: 'approved' });
            batch.delete(studentRef);
            await batch.commit();
            alert("Student approved successfully!");
            sessionCache.pendingStudents = null; // Invalidate cache
            sessionCache.students = null;
            fetchAndRenderPendingApprovals(); // Re-fetch and render the current panel
        } catch (error) {
            console.error("Error approving student: ", error);
            alert("Error approving student. Check the console for details.");
        }
    }
}

async function handleRejectStudent(studentId) {
    if (confirm("Are you sure you want to reject this student? This will delete their entry.")) {
        try {
            await deleteDoc(doc(db, "pending_students", studentId));
            alert("Student rejected successfully!");
            sessionCache.pendingStudents = null; // Invalidate cache
            fetchAndRenderPendingApprovals(); // Re-fetch and render
        } catch (error) {
            console.error("Error rejecting student: ", error);
            alert("Error rejecting student. Check the console for details.");
        }
    }
}


// ##################################
// # PANEL RENDERING FUNCTIONS
// ##################################

// --- Tutor & Student Directory Panel ---
async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor & Student Directory</h2>
                <div class="flex items-center gap-4">
                    <input type="search" id="directory-search" placeholder="Search Tutors, Students, Parents..." class="p-2 border rounded-md w-64">
                    <button id="refresh-directory-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                </div>
            </div>
             <div class="flex space-x-4 mb-4">
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">Total Tutors</h4>
                    <p id="tutor-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Total Students</h4>
                    <p id="student-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
            </div>
            <div id="directory-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading directory...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-directory-btn').addEventListener('click', () => fetchAndRenderDirectory(true));
    document.getElementById('directory-search').addEventListener('input', (e) => renderDirectoryFromCache(e.target.value));
    fetchAndRenderDirectory();
}

async function fetchAndRenderDirectory(forceRefresh = false) {
    if (forceRefresh) {
        sessionCache.tutors = null;
        sessionCache.students = null;
    }

    try {
        if (!sessionCache.tutors || !sessionCache.students) {
            document.getElementById('directory-list').innerHTML = `<p class="text-center text-gray-500 py-10">Fetching data from server...</p>`;
            const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
                getDocs(query(collection(db, "tutors"), orderBy("name"))),
                getDocs(collection(db, "students"))
            ]);
            sessionCache.tutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            sessionCache.students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        renderDirectoryFromCache();
    } catch (error) {
        console.error("Error fetching directory data:", error);
        document.getElementById('directory-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderDirectoryFromCache(searchTerm = '') {
    const tutors = sessionCache.tutors || [];
    const students = sessionCache.students || [];
    const directoryList = document.getElementById('directory-list');
    if (!directoryList) return;

    const lowerCaseSearchTerm = searchTerm.toLowerCase();

    const studentsByTutor = {};
    students.forEach(student => {
        if (!studentsByTutor[student.tutorEmail]) {
            studentsByTutor[student.tutorEmail] = [];
        }
        studentsByTutor[student.tutorEmail].push(student);
    });

    const filteredTutors = tutors.filter(tutor => {
        const assignedStudents = studentsByTutor[tutor.email] || [];
        const tutorMatch = tutor.name.toLowerCase().includes(lowerCaseSearchTerm);
        const studentMatch = assignedStudents.some(s => 
            s.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
            (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm))
        );
        return tutorMatch || studentMatch;
    });

    if (filteredTutors.length === 0) {
        directoryList.innerHTML = `<p class="text-center text-gray-500 py-10">No results found for "${searchTerm}".</p>`;
        return;
    }

    document.getElementById('tutor-count-badge').textContent = tutors.length;
    document.getElementById('student-count-badge').textContent = students.length;

    const canEditStudents = window.userData.permissions?.actions?.canEditStudents === true;
    const canDeleteStudents = window.userData.permissions?.actions?.canDeleteStudents === true;
    const showActionsColumn = canEditStudents || canDeleteStudents;

    directoryList.innerHTML = filteredTutors.map(tutor => {
        const assignedStudents = (studentsByTutor[tutor.email] || [])
            .filter(s => 
                searchTerm === '' || // show all students if no search term
                tutor.name.toLowerCase().includes(lowerCaseSearchTerm) || // show all if tutor name matches
                s.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
                (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm))
            );

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
                        <td class="px-4 py-2">₦${(student.studentFee || 0).toFixed(2)}</td>
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
                <details open>
                    <summary class="p-4 cursor-pointer flex justify-between items-center font-semibold text-lg">
                        ${tutor.name}
                        <span class="ml-2 text-sm font-normal text-gray-500">(${assignedStudents.length} students shown)</span>
                    </summary>
                    <div class="border-t p-2">
                        <table class="min-w-full text-sm">
                            <thead class="bg-gray-50 text-left"><tr>
                                <th class="px-4 py-2 font-medium">Student Name</th><th class="px-4 py-2 font-medium">Fee</th>
                                <th class="px-4 py-2 font-medium">Grade</th><th class="px-4 py-2 font-medium">Days/Week</th>
                                <th class="px-4 py-2 font-medium">Subject</th><th class="px-4 py-2 font-medium">Parent's Name</th>
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
        document.querySelectorAll('.edit-student-btn').forEach(button => button.addEventListener('click', () => handleEditStudent(button.dataset.studentId)));
    }
    if (canDeleteStudents) {
        document.querySelectorAll('.delete-student-btn').forEach(button => button.addEventListener('click', () => handleDeleteStudent(button.dataset.studentId)));
    }
}


// --- Pay Advice Panel ---
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
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Tutor</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Students</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Fees</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Mgmt. Fee</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Total Pay</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Gift (₦)</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Final Pay</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="pay-advice-table-body" class="divide-y"><tr><td colspan="8" class="text-center py-4">Select a date range.</td></tr></tbody>
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
            payAdviceGifts = {}; // Reset gifts on new date range
            currentPayData = []; // Reset data
            endDate.setHours(23, 59, 59, 999);
            loadPayAdviceData(startDate, endDate);
        }
    };
    startDateInput.addEventListener('change', handleDateChange);
    endDateInput.addEventListener('change', handleDateChange);

    const exportBtn = document.getElementById('export-pay-csv-btn');
    if (exportBtn) {
        exportBtn.onclick = () => {
            const csv = convertPayAdviceToCSV(currentPayData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const start = document.getElementById('start-date').value;
            const end = document.getElementById('end-date').value;
            link.href = URL.createObjectURL(blob);
            link.download = `Pay_Advice_${start}_to_${end}.csv`;
            link.click();
        };
    }
}

async function loadPayAdviceData(startDate, endDate) {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Loading pay data...</td></tr>`;

    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    const reportsQuery = query(collection(db, "tutor_submissions"), where("submittedAt", ">=", startTimestamp), where("submittedAt", "<=", endTimestamp));
    try {
        const reportsSnapshot = await getDocs(reportsQuery);
        const activeTutorEmails = [...new Set(reportsSnapshot.docs.map(doc => doc.data().tutorEmail))];

        if (activeTutorEmails.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">No active tutors in this period.</td></tr>`;
            document.getElementById('pay-tutor-count').textContent = 0;
            document.getElementById('pay-student-count').textContent = 0;
            currentPayData = [];
            return;
        }

        const tutorBankDetails = {};
        reportsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.beneficiaryBank && data.beneficiaryAccount) {
                tutorBankDetails[data.tutorEmail] = {
                    beneficiaryBank: data.beneficiaryBank,
                    beneficiaryAccount: data.beneficiaryAccount,
                    beneficiaryName: data.beneficiaryName || 'N/A',
                };
            }
        });

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
            const bankDetails = tutorBankDetails[tutor.email] || { beneficiaryBank: 'N/A', beneficiaryAccount: 'N/A', beneficiaryName: 'N/A' };

            payData.push({
                tutorName: tutor.name,
                tutorEmail: tutor.email,
                studentCount: assignedStudents.length,
                totalStudentFees: totalStudentFees,
                managementFee: managementFee,
                totalPay: totalStudentFees + managementFee,
                ...bankDetails
            });
        });
        
        currentPayData = payData; // Store for reuse
        document.getElementById('pay-tutor-count').textContent = payData.length;
        document.getElementById('pay-student-count').textContent = totalStudentCount;
        renderPayAdviceTable();

    } catch (error) {
        console.error("Error loading pay advice data:", error);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Failed to load data.</td></tr>`;
    }
}

function renderPayAdviceTable() {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = currentPayData.map(d => {
        const giftAmount = payAdviceGifts[d.tutorEmail] || 0;
        const finalPay = d.totalPay + giftAmount;
        return `
            <tr>
                <td class="px-6 py-4">${d.tutorName}</td>
                <td class="px-6 py-4">${d.studentCount}</td>
                <td class="px-6 py-4">₦${d.totalStudentFees.toFixed(2)}</td>
                <td class="px-6 py-4">₦${d.managementFee.toFixed(2)}</td>
                <td class="px-6 py-4">₦${d.totalPay.toFixed(2)}</td>
                <td class="px-6 py-4 text-blue-600 font-bold">₦${giftAmount.toFixed(2)}</td>
                <td class="px-6 py-4 font-bold">₦${finalPay.toFixed(2)}</td>
                <td class="px-6 py-4">
                    <button class="add-gift-btn bg-blue-500 text-white px-3 py-1 rounded text-xs" data-tutor-email="${d.tutorEmail}">Add Gift</button>
                </td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.add-gift-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const tutorEmail = e.target.dataset.tutorEmail;
            const currentGift = payAdviceGifts[tutorEmail] || 0;
            const giftInput = prompt(`Enter gift amount for this tutor:`, currentGift);
            if (giftInput !== null) {
                const giftAmount = parseFloat(giftInput);
                if (!isNaN(giftAmount) && giftAmount >= 0) {
                    payAdviceGifts[tutorEmail] = giftAmount;
                    renderPayAdviceTable(); // Re-render the table with the new gift
                } else {
                    alert("Please enter a valid, non-negative number.");
                }
            }
        });
    });
}


// --- Tutor Reports Panel ---
async function renderTutorReportsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor Reports</h2>
                <button id="refresh-reports-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div class="flex space-x-4 mb-4">
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">Unique Tutors Submitted</h4>
                    <p id="report-tutor-count" class="text-2xl font-extrabold">0</p>
                </div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Total Reports Submitted</h4>
                    <p id="report-total-count" class="text-2xl font-extrabold">0</p>
                </div>
            </div>
            <div id="tutor-reports-list" class="space-y-4"><p class="text-center">Loading reports...</p></div>
        </div>
    `;
    document.getElementById('refresh-reports-btn').addEventListener('click', () => fetchAndRenderTutorReports(true));
    fetchAndRenderTutorReports();
}

async function fetchAndRenderTutorReports(forceRefresh = false) {
    if (forceRefresh) sessionCache.reports = null;
    const reportsListContainer = document.getElementById('tutor-reports-list');
    
    try {
        if (!sessionCache.reports) {
            reportsListContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching reports from server...</p>`;
            const snapshot = await getDocs(query(collection(db, "tutor_submissions"), orderBy("submittedAt", "desc")));
            sessionCache.reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        renderTutorReportsFromCache();
    } catch(error) {
        console.error("Error fetching reports:", error);
        reportsListContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load reports.</p>`;
    }
}

function renderTutorReportsFromCache() {
    const reports = sessionCache.reports || [];
    const reportsListContainer = document.getElementById('tutor-reports-list');
    if (!reportsListContainer) return;

    if (reports.length === 0) {
        reportsListContainer.innerHTML = `<p class="text-center text-gray-500">No reports submitted yet.</p>`;
        return;
    }
    
    const reportsByTutor = {};
    reports.forEach(report => {
        if (!reportsByTutor[report.tutorEmail]) {
            reportsByTutor[report.tutorEmail] = { name: report.tutorName || report.tutorEmail, reports: [] };
        }
        reportsByTutor[report.tutorEmail].reports.push(report);
    });

    // Update counters
    document.getElementById('report-tutor-count').textContent = Object.keys(reportsByTutor).length;
    document.getElementById('report-total-count').textContent = reports.length;

    const canDownload = window.userData.permissions?.actions?.canDownloadReports === true;
    reportsListContainer.innerHTML = Object.values(reportsByTutor).map(tutorData => {
        const reportLinks = tutorData.reports.map(report => {
            const buttonHTML = canDownload
                ? `<button class="download-report-btn bg-green-500 text-white px-3 py-1 text-sm rounded" data-report-id="${report.id}">Download</button>`
                : `<button class="view-report-btn bg-gray-500 text-white px-3 py-1 text-sm rounded" data-report-id="${report.id}">View</button>`;
            return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">${report.studentName}<span>${buttonHTML}</span></li>`;
        }).join('');
        
        const zipButtonHTML = canDownload
            ? `<div class="p-4 border-t"><button class="zip-reports-btn bg-blue-600 text-white px-4 py-2 text-sm rounded w-full hover:bg-blue-700" data-tutor-email="${tutorData.reports[0].tutorEmail}">Zip & Download All Reports</button></div>`
            : '';

        return `<details class="border rounded-lg">
                    <summary class="p-4 cursor-pointer font-semibold">${tutorData.name} (${tutorData.reports.length} reports)</summary>
                    <div class="p-4 border-t"><ul class="space-y-2">${reportLinks}</ul></div>
                    ${zipButtonHTML}
                </details>`;
    }).join('');

    document.querySelectorAll('.download-report-btn').forEach(button => button.addEventListener('click', (e) => { e.stopPropagation(); viewReportInNewTab(e.target.dataset.reportId, true); }));
    document.querySelectorAll('.view-report-btn').forEach(button => button.addEventListener('click', (e) => { e.stopPropagation(); viewReportInNewTab(e.target.dataset.reportId, false); }));
    document.querySelectorAll('.zip-reports-btn').forEach(button => button.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tutorEmail = e.target.dataset.tutorEmail;
        const tutorData = reportsByTutor[tutorEmail];
        if (tutorData) await zipAndDownloadTutorReports(tutorData.reports, tutorData.name, e.target);
    }));
}


// --- Pending Approvals Panel ---
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Pending Approvals</h2>
                <button id="refresh-pending-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div id="pending-approvals-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pending students...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-pending-btn').addEventListener('click', () => fetchAndRenderPendingApprovals(true));
    fetchAndRenderPendingApprovals();
}

async function fetchAndRenderPendingApprovals(forceRefresh = false) {
    if (forceRefresh) sessionCache.pendingStudents = null;
    const listContainer = document.getElementById('pending-approvals-list');
    
    try {
        if (!sessionCache.pendingStudents) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching pending students...</p>`;
            const snapshot = await getDocs(query(collection(db, "pending_students")));
            sessionCache.pendingStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        renderPendingApprovalsFromCache();
    } catch(error) {
        console.error("Error fetching pending students:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderPendingApprovalsFromCache() {
    const pendingStudents = sessionCache.pendingStudents || [];
    const listContainer = document.getElementById('pending-approvals-list');
    if (!listContainer) return;

    if (pendingStudents.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500">No students are awaiting approval.</p>`;
        return;
    }

    listContainer.innerHTML = pendingStudents.map(student => `
        <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50">
            <div>
                <p><strong>Student:</strong> ${student.studentName}</p>
                <p><strong>Fee:</strong> ₦${(student.studentFee || 0).toFixed(2)}</p>
                <p><strong>Submitted by Tutor:</strong> ${student.tutorEmail || 'N/A'}</p>
            </div>
            <div class="flex items-center space-x-2">
                <button class="edit-pending-btn bg-blue-500 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Edit</button>
                <button class="approve-btn bg-green-600 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Approve</button>
                <button class="reject-btn bg-red-600 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Reject</button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.edit-pending-btn').forEach(button => button.addEventListener('click', () => handleEditPendingStudent(button.dataset.studentId)));
    document.querySelectorAll('.approve-btn').forEach(button => button.addEventListener('click', () => handleApproveStudent(button.dataset.studentId)));
    document.querySelectorAll('.reject-btn').forEach(button => button.addEventListener('click', () => handleRejectStudent(button.dataset.studentId)));
}


// --- Summer Break Panel ---
async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Students on Summer Break</h2>
                <button id="refresh-break-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div id="break-status-message" class="text-center font-semibold mb-4 hidden"></div>
            <div id="break-students-list" class="space-y-4">
                <p class="text-center">Loading...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-break-btn').addEventListener('click', () => fetchAndRenderBreakStudents(true));
    fetchAndRenderBreakStudents();
}

async function fetchAndRenderBreakStudents(forceRefresh = false) {
    if (forceRefresh) sessionCache.breakStudents = null;
    const listContainer = document.getElementById('break-students-list');

    try {
        if (!sessionCache.breakStudents) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching student break status...</p>`;
            const snapshot = await getDocs(query(collection(db, "students"), where("summerBreak", "==", true)));
            sessionCache.breakStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        renderBreakStudentsFromCache();
    } catch(error) {
        console.error("Error fetching break students:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderBreakStudentsFromCache() {
    const breakStudents = sessionCache.breakStudents || [];
    const listContainer = document.getElementById('break-students-list');
    if (!listContainer) return;

    const canEndBreak = window.userData.permissions?.actions?.canEndBreak === true;

    if (breakStudents.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500">No students are on break.</p>`;
        return;
    }
    
    listContainer.innerHTML = breakStudents.map(student => {
        const endBreakButton = canEndBreak 
            ? `<button class="end-break-btn bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors" data-student-id="${student.id}">End Break</button>`
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

    if (canEndBreak) {
        document.querySelectorAll('.end-break-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const studentId = e.target.dataset.studentId;
                if (confirm("Are you sure you want to end the summer break for this student?")) {
                    try {
                        await updateDoc(doc(db, "students", studentId), { summerBreak: false, lastBreakEnd: Timestamp.now() });
                        document.getElementById('break-status-message').textContent = `Break ended successfully.`;
                        document.getElementById('break-status-message').className = 'text-center font-semibold mb-4 text-green-600';
                        sessionCache.breakStudents = null; // Invalidate cache
                        fetchAndRenderBreakStudents(); // Re-render list
                    } catch (error) {
                        console.error("Error ending summer break:", error);
                        document.getElementById('break-status-message').textContent = "Failed to end summer break.";
                        document.getElementById('break-status-message').className = 'text-center font-semibold mb-4 text-red-600';
                    }
                }
            });
        });
    }
}


// ##################################
// # REPORT GENERATION & ZIPPING
// ##################################

async function generateReportHTML(reportId) {
    const reportDoc = await getDoc(doc(db, "tutor_submissions", reportId));
    if (!reportDoc.exists()) throw new Error("Report not found!");
    const reportData = reportDoc.data();
    
    const logoUrl = "https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/logo.png";
    const reportTemplate = `<div style="font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: auto;"><div style="text-align: center; margin-bottom: 2rem;"><img src="${logoUrl}" alt="Company Logo" style="height: 80px;"><h3 style="font-size: 1.8rem; font-weight: bold; color: #15803d; margin: 0;">Blooming Kids House</h3><h1 style="font-size: 1.2rem; font-weight: bold; color: #166534;">MONTHLY LEARNING REPORT</h1><p>Date: ${new Date(reportData.submittedAt.seconds * 1000).toLocaleDateString()}</p></div><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;"><p><strong>Student's Name:</strong> ${reportData.studentName}</p><p><strong>Parent's Name:</strong> ${reportData.parentName || 'N/A'}</p><p><strong>Parent's Phone:</strong> ${reportData.parentPhone || 'N/A'}</p><p><strong>Grade:</strong> ${reportData.grade}</p><p><strong>Tutor's Name:</strong> ${reportData.tutorName}</p></div>${Object.entries({"INTRODUCTION": reportData.introduction, "TOPICS & REMARKS": reportData.topics, "PROGRESS & ACHIEVEMENTS": reportData.progress, "STRENGTHS AND WEAKNESSES": reportData.strengthsWeaknesses, "RECOMMENDATIONS": reportData.recommendations, "GENERAL TUTOR'S COMMENTS": reportData.generalComments}).map(([title, content]) => `<div style="border-top: 1px solid #d1d5db; padding-top: 1rem; margin-top: 1rem;"><h2 style="font-size: 1.25rem; font-weight: bold; color: #16a34a;">${title}</h2><p style="line-height: 1.6; white-space: pre-wrap;">${content || 'N/A'}</p></div>`).join('')}<div style="margin-top: 3rem; text-align: right;"><p>Best regards,</p><p style="font-weight: bold;">${reportData.tutorName}</p></div></div>`;

    return { html: reportTemplate, reportData: reportData };
}

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
        generatedPdfs.forEach(pdf => zip.file(pdf.name, pdf.blob));
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


// ##################################
// # AUTHENTICATION & INITIALIZATION
// ##################################

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        onSnapshot(staffDocRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().role !== 'pending') {
                const staffData = docSnap.data();
                window.userData = staffData;
                
                document.getElementById('welcome-message').textContent = `Welcome, ${staffData.name}`;
                document.getElementById('user-role').textContent = `Role: ${capitalize(staffData.role)}`;

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
                    navContainer.querySelectorAll('.nav-btn').forEach(btn => originalNavButtons[btn.id] = btn.textContent);
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
                        const activeNav = document.querySelector('.nav-btn.active');
                        const activeNavId = activeNav?.id;
                        if (!activeNav || !document.getElementById(activeNavId)) {
                            document.getElementById(firstVisibleTab).click();
                        } else {
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
