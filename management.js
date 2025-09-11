import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Utility function to capitalize strings
function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// Utility function to convert data to CSV
function convertPayAdviceToCSV(data) {
    const header = ['Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Total Pay (₦)'];
    const rows = data.map(item => [
        `\"${item.tutorName}\"`,
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

// UPDATED: This function now fetches student data and opens a modal for editing
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

// NEW FUNCTION: Handle editing a pending student
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


// UPDATED: Centralized function to show the edit modal
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
            // The onSnapshot listener will automatically re-render the view
        } catch (error) {
            console.error("Error updating document: ", error);
            alert("Failed to save changes. Check the console for details.");
        }
    });
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

// NEW: Function to show a modal for adding a new student
function showAddStudentModal(container) {
    const modalHtml = `
        <div id="add-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('add-student-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">Add New Student</h3>
                <form id="add-student-form">
                    <div class="mb-2"><label class="block text-sm font-medium">Student Name</label><input type="text" id="add-studentName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Tutor Email</label><input type="email" id="add-tutorEmail" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Fee (₦)</label><input type="number" id="add-studentFee" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Name</label><input type="text" id="add-parentName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Phone</label><input type="text" id="add-parentPhone" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('add-student-modal').remove()" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Add Student</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('add-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const newStudentData = {
            studentName: form.elements['add-studentName'].value,
            tutorEmail: form.elements['add-tutorEmail'].value,
            studentFee: Number(form.elements['add-studentFee'].value) || 0,
            parentName: form.elements['add-parentName'].value,
            parentPhone: form.elements['add-parentPhone'].value,
            approvalStatus: 'pending', // New students will be pending approval
            createdAt: Timestamp.now(),
        };

        try {
            await addDoc(collection(db, "pending_students"), newStudentData);
            alert("New student added successfully! Awaiting approval.");
            document.getElementById('add-student-modal').remove();
        } catch (error) {
            console.error("Error adding student: ", error);
            alert("Failed to add student. Check the console for details.");
        }
    });
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
                    <details>
                        <summary class="p-4 cursor-pointer flex justify-between items-center font-semibold text-lg">
                            ${tutor.name}
                            <span class="ml-2 text-sm font-normal text-gray-500">(${assignedStudents.length} students)</span>
                        </summary>
                        <div class="border-t p-2">
                            <table class="min-w-full text-sm">
                                <thead class="bg-gray-50 text-left"><tr>
                                    <th class="px-4 py-2 font-medium">Student Name</th>
                                    <th class="px-4 py-2 font-medium">Fee</th>
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
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Loading...</td></tr>`;

    try {
        const tutorsSnapshot = await getDocs(collection(db, "tutors"));
        const studentsSnapshot = await getDocs(collection(db, "students"));
        const reportsQuery = query(
            collection(db, "reports"),
            where("submissionDate", ">=", Timestamp.fromDate(startDate)),
            where("submissionDate", "<=", Timestamp.fromDate(endDate)),
            orderBy("submissionDate")
        );
        const reportsSnapshot = await getDocs(reportsQuery);

        const tutorData = tutorsSnapshot.docs.reduce((acc, doc) => {
            acc[doc.id] = { ...doc.data(), studentCount: 0, totalStudentFees: 0 };
            return acc;
        }, {});

        studentsSnapshot.forEach(studentDoc => {
            const student = studentDoc.data();
            if (tutorData[student.tutorEmail]) {
                tutorData[student.tutorEmail].studentCount++;
                tutorData[student.tutorEmail].totalStudentFees += student.studentFee;
            }
        });

        reportsSnapshot.forEach(reportDoc => {
            const report = reportDoc.data();
            if (tutorData[report.tutorEmail]) {
                const studentReport = report.students.find(s => s.studentId === report.studentId);
                const fee = studentReport?.fee || 0;
                tutorData[report.tutorEmail].totalStudentFees += fee;
            }
        });

        const payAdviceData = Object.values(tutorData).map(tutor => {
            const totalPay = tutor.totalStudentFees * 0.7; // 70% commission
            const managementFee = tutor.totalStudentFees * 0.3; // 30% management fee
            return {
                tutorName: tutor.name,
                studentCount: tutor.studentCount,
                totalStudentFees: tutor.totalStudentFees.toFixed(2),
                managementFee: managementFee.toFixed(2),
                totalPay: totalPay.toFixed(2),
            };
        });

        document.getElementById('pay-tutor-count').textContent = tutorsSnapshot.size;
        document.getElementById('pay-student-count').textContent = studentsSnapshot.size;

        if (payAdviceData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No data found for this period.</td></tr>`;
            return;
        }

        const tableRowsHtml = payAdviceData.map(item => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">${item.tutorName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.studentCount}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₦${item.totalStudentFees}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₦${item.managementFee}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₦${item.totalPay}</td>
            </tr>
        `).join('');
        tableBody.innerHTML = tableRowsHtml;

        const exportBtn = document.getElementById('export-pay-csv-btn');
        if (exportBtn) {
            exportBtn.onclick = () => {
                const csvContent = convertPayAdviceToCSV(payAdviceData);
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `pay_advice_${startDate.toISOString().slice(0,10)}_to_${endDate.toISOString().slice(0,10)}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };
        }

    } catch (error) {
        console.error("Error loading pay advice data: ", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
    }
}


// NEW: Function to render the pending approvals panel
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-800">Pending Student Approvals</h2>
                <button id="add-student-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200">
                    + Add New Student
                </button>
            </div>
            <div id="pending-students-list-container">
                <p class="text-center text-gray-500">Loading pending students...</p>
            </div>
        </div>
    `;

    const pendingStudentsListContainer = container.querySelector('#pending-students-list-container');
    const addStudentBtn = container.querySelector('#add-student-btn');

    // Handle button actions
    container.addEventListener('click', async (e) => {
        const studentId = e.target.closest('button')?.dataset.studentId;
        if (!studentId) return;

        if (e.target.closest('.approve-btn')) {
            await handleApproveStudent(studentId);
        } else if (e.target.closest('.reject-btn')) {
            await handleRejectStudent(studentId);
        } else if (e.target.closest('.edit-btn')) {
             await handleEditPendingStudent(studentId);
        }
    });

    addStudentBtn.addEventListener('click', () => {
        showAddStudentModal(container);
    });

    try {
        const pendingStudentsCol = collection(db, "pending_students");
        const q = query(pendingStudentsCol, orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const pendingStudents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (pendingStudents.length === 0) {
                pendingStudentsListContainer.innerHTML = '<p class="text-center text-gray-500">No students are awaiting approval.</p>';
                return;
            }

            const studentsListHtml = `
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent Name</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor Email</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${pendingStudents.map(student => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${student.studentName}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.parentName || 'N/A'}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.tutorEmail}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button data-student-id="${student.id}" class="approve-btn text-indigo-600 hover:text-indigo-900 mr-2">Approve</button>
                                    <button data-student-id="${student.id}" class="reject-btn text-red-600 hover:text-red-900 mr-2">Reject</button>
                                    <button data-student-id="${student.id}" class="edit-btn text-blue-600 hover:text-blue-900">Edit</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            pendingStudentsListContainer.innerHTML = studentsListHtml;
        });

    } catch (error) {
        console.error("Error fetching pending students: ", error);
        pendingStudentsListContainer.innerHTML = `<p class="text-center text-red-500">Error loading pending students: ${error.message}</p>`;
    }
}


// ##################################
// # INITIALIZATION & AUTHENTICATION
// ##################################

async function initializeManagementPanel() {
    const mainContent = document.getElementById('mainContent');
    const navDashboard = document.getElementById('navDashboard');
    const navTutorView = document.getElementById('navTutorView');
    const navPendingApprovals = document.getElementById('navPendingApprovals');

    const allNavItems = {
        navDashboard: { name: 'Dashboard', fn: async () => { /* Add dashboard logic here */ }, permission: 'view_dashboard' },
        navTutorView: { name: 'Tutor View', fn: renderManagementTutorView, permission: 'view_tutors' },
        navPendingApprovals: { name: 'Pending Approvals', fn: renderPendingApprovalsPanel, permission: 'approve_students' },
    };

    const setActiveNav = (activeId) => {
        Object.keys(allNavItems).forEach(id => {
            document.getElementById(id)?.classList.toggle('active', id === activeId);
        });
    };

    const initialLoadId = navPendingApprovals && navPendingApprovals.classList.contains('active') ? 'navPendingApprovals' : 'navDashboard';
    setActiveNav(initialLoadId);
    allNavItems[initialLoadId].fn(mainContent);
}

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('mainContent');
    const logoutBtn = document.getElementById('logoutBtn');
    const navBar = document.getElementById('navBar');

    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        onSnapshot(staffDocRef, async (docSnap) => {
            if (docSnap.exists() && docSnap.data()?.status === 'approved') {
                const userData = docSnap.data();
                window.userData = userData; // Store user data globally for permission checks
                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${userData?.name}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = `Role: ${capitalize(userData.role || 'N/A')}`;

                if (navBar) {
                    navBar.innerHTML = ''; // Clear existing nav
                    const allNavItems = {
                        navDashboard: { name: 'Dashboard', fn: async () => { /* Dashboard logic here */ }, permission: 'view_dashboard' },
                        navTutorView: { name: 'Tutor & Student Directory', fn: renderManagementTutorView, permission: 'view_tutors' },
                        navPayAdvice: { name: 'Tutor Pay Advice', fn: renderPayAdvicePanel, permission: 'view_pay_advice' },
                        navPendingApprovals: { name: 'Pending Approvals', fn: renderPendingApprovalsPanel, permission: 'approve_students' },
                    };

                    const permissions = userData.permissions || {};
                    let activeNavId = null;

                    Object.entries(allNavItems).forEach(([id, item]) => {
                        // Check if the user has permission to view this panel
                        if (permissions[item.permission]) {
                            const navItem = document.createElement('div');
                            navItem.id = id;
                            navItem.textContent = item.name;
                            navItem.classList.add('py-2', 'px-4', 'rounded-lg', 'font-medium', 'cursor-pointer', 'transition-colors', 'duration-200', 'hover:bg-gray-200');
                            navBar.appendChild(navItem);

                            navItem.addEventListener('click', () => {
                                const container = document.getElementById('mainContent');
                                document.querySelectorAll('#navBar > div').forEach(el => el.classList.remove('bg-gray-200', 'text-gray-800'));
                                navItem.classList.add('bg-gray-200', 'text-gray-800');
                                item.fn(container);
                                activeNavId = id;
                            });

                            // Set the first available item as active initially
                            if (!activeNavId) {
                                activeNavId = id;
                                navItem.classList.add('bg-gray-200', 'text-gray-800');
                                item.fn(mainContent);
                            }
                        }
                    });

                    // If the current active tab is no longer available, navigate to the first available tab
                    if (activeNavId && !permissions[allNavItems[activeNavId].permission]) {
                        const firstAvailable = Object.keys(allNavItems).find(id => permissions[allNavItems[id].permission]);
                        if (firstAvailable) {
                            const firstNavItem = document.getElementById(firstAvailable);
                            firstNavItem?.classList.add('bg-gray-200', 'text-gray-800');
                            allNavItems[firstAvailable].fn(mainContent);
                        } else {
                            if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
                        }
                    } else if (activeNavId) {
                        // The current tab is still available, re-render it to apply new permissions.
                        const currentItem = allNavItems[activeNavId];
                        if (currentItem) currentItem.fn(mainContent);
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
```eof
