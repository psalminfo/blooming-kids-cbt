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
            batch.set(newStudentRef, { ...studentData, approvalStatus: "approved" });

            // Delete the old document from 'pending_students' collection
            batch.delete(studentRef);

            // Commit the batch
            await batch.commit();

            console.log("Student successfully approved and moved to main collection!");
            alert("Student approved successfully!");

        } catch (error) {
            console.error("Error approving student: ", error);
            alert("Error approving student. Check the console for details.");
        }
    }
}

async function handleRejectStudent(studentId) {
    if (confirm("Are you sure you want to reject this student? This will permanently delete the record.")) {
        try {
            await deleteDoc(doc(db, "pending_students", studentId));
            alert("Student rejected and removed.");
        } catch (error) {
            console.error("Error rejecting student: ", error);
            alert("Error rejecting student. Check the console for details.");
        }
    }
}

// Function to render the pending approvals view
async function renderPendingApprovalView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-yellow-600 mb-4">Pending Student Approvals</h2>
            <div id="pending-students-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pending students...</p>
            </div>
        </div>
    `;

    const pendingStudentsQuery = query(collection(db, "pending_students"), orderBy("timestamp", "desc"));

    // Set up a real-time listener
    const unsubscribe = onSnapshot(pendingStudentsQuery, (querySnapshot) => {
        const pendingStudents = [];
        querySnapshot.forEach(doc => {
            pendingStudents.push({ id: doc.id, ...doc.data() });
        });
        
        // Render the list of pending students
        const listContainer = document.getElementById('pending-students-list');
        if (!listContainer) return;
        
        if (pendingStudents.length === 0) {
            listContainer.innerHTML = '<p class="text-center text-gray-500 py-10">No pending student approvals at this time.</p>';
        } else {
            listContainer.innerHTML = `
                <table class="min-w-full text-sm">
                    <thead class="bg-yellow-50 text-left">
                        <tr>
                            <th class="px-4 py-2 font-medium">Student Name</th>
                            <th class="px-4 py-2 font-medium">Tutor Email</th>
                            <th class="px-4 py-2 font-medium">Date Submitted</th>
                            <th class="px-4 py-2 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${pendingStudents.map(student => `
                            <tr>
                                <td class="px-4 py-2">${capitalize(student.studentName)}</td>
                                <td class="px-4 py-2">${student.tutorEmail}</td>
                                <td class="px-4 py-2">${student.timestamp ? new Date(student.timestamp.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                                <td class="px-4 py-2 space-x-2">
                                    <button class="approve-btn bg-green-500 text-white px-3 py-1 rounded-full text-xs" data-id="${student.id}">Approve</button>
                                    <button class="edit-btn bg-blue-500 text-white px-3 py-1 rounded-full text-xs" data-id="${student.id}">Edit</button>
                                    <button class="reject-btn bg-red-500 text-white px-3 py-1 rounded-full text-xs" data-id="${student.id}">Reject</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // Attach event listeners to the action buttons
            listContainer.querySelectorAll('.approve-btn').forEach(btn => {
                btn.addEventListener('click', () => handleApproveStudent(btn.dataset.id));
            });
            listContainer.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', () => handleEditPendingStudent(btn.dataset.id));
            });
            listContainer.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', () => handleRejectStudent(btn.dataset.id));
            });
        }
    });

    // We can also return the unsubscribe function if we need to clean up the listener later
    return unsubscribe;
}

// Function to handle the navigation and rendering of views
function handleNavigation(view) {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) {
        console.error("Main content container not found.");
        return;
    }

    // Clear previous content and listeners
    mainContent.innerHTML = '';
    
    // Check which view to render
    if (view === 'pending-approvals') {
        renderPendingApprovalView(mainContent);
    } else if (view === 'tutors') {
        renderManagementTutorView(mainContent);
    } else if (view === 'pay-advice') {
        renderPayAdviceView(mainContent);
    }
}

// You need to set up event listeners for your navigation buttons in your HTML
// Example: document.getElementById('pending-approvals-nav').addEventListener('click', () => handleNavigation('pending-approvals'));

async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-600 mb-4">Tutor & Student Management</h2>
            <div id="tutor-student-list">
                <p class="text-center text-gray-500 py-10">Loading tutor and student data...</p>
            </div>
        </div>
    `;

    // Query to fetch all tutors
    const tutorsQuery = query(collection(db, "tutors"), orderBy("timestamp", "desc"));
    const tutorsSnapshot = await getDocs(tutorsQuery);

    const tutorData = [];
    tutorsSnapshot.forEach(doc => {
        tutorData.push({ id: doc.id, ...doc.data() });
    });

    // Query to fetch all students
    const studentsQuery = query(collection(db, "students"), orderBy("timestamp", "desc"));
    const studentsSnapshot = await getDocs(studentsQuery);

    const studentData = [];
    studentsSnapshot.forEach(doc => {
        studentData.push({ id: doc.id, ...doc.data() });
    });

    // Group students by tutorEmail
    const studentsByTutor = studentData.reduce((acc, student) => {
        const tutorEmail = student.tutorEmail;
        if (!acc[tutorEmail]) {
            acc[tutorEmail] = { ...tutorData.find(tutor => tutor.email === tutorEmail), students: [] };
        }
        acc[tutorEmail].students.push(student);
        return acc;
    }, {});
    
    // Render the tutors and their students
    const listContainer = document.getElementById('tutor-student-list');
    if (tutorData.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-500 py-10">No tutors found.</p>';
    } else {
        listContainer.innerHTML = tutorData.map(tutor => `
            <div class="bg-gray-50 p-4 rounded-lg shadow-sm my-4">
                <h3 class="text-xl font-bold text-green-700">${capitalize(tutor.name)} - ${tutor.email}</h3>
                <p class="text-gray-600 text-sm">Permissions: ${tutor.permissions ? tutor.permissions.join(', ') : 'None'}</p>
                <div class="mt-4">
                    <h4 class="font-semibold text-green-600">Students:</h4>
                    ${studentsByTutor[tutor.email] && studentsByTutor[tutor.email].students.length > 0 ?
                        `<table class="min-w-full text-sm mt-2">
                            <thead class="bg-green-100 text-left">
                                <tr>
                                    <th class="px-4 py-2 font-medium">Student Name</th>
                                    <th class="px-4 py-2 font-medium">Grade</th>
                                    <th class="px-4 py-2 font-medium">Fee (₦)</th>
                                    <th class="px-4 py-2 font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                ${studentsByTutor[tutor.email].students.map(student => `
                                    <tr>
                                        <td class="px-4 py-2">${capitalize(student.studentName)}</td>
                                        <td class="px-4 py-2">${student.grade}</td>
                                        <td class="px-4 py-2">${student.studentFee.toLocaleString('en-NG')}</td>
                                        <td class="px-4 py-2">
                                            <button class="edit-student-btn bg-blue-500 text-white px-3 py-1 rounded-full text-xs" data-id="${student.id}">Edit</button>
                                            <button class="delete-student-btn bg-red-500 text-white px-3 py-1 rounded-full text-xs" data-id="${student.id}">Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>`
                        :
                        '<p class="text-gray-500 italic mt-2">No students assigned to this tutor.</p>'
                    }
                </div>
            </div>
        `).join('');

        // Attach event listeners for edit/delete student buttons
        listContainer.querySelectorAll('.edit-student-btn').forEach(btn => {
            btn.addEventListener('click', () => handleEditStudent(btn.dataset.id));
        });
        listContainer.querySelectorAll('.delete-student-btn').forEach(btn => {
            btn.addEventListener('click', () => handleDeleteStudent(btn.dataset.id));
        });
    }
}


// --- Main Pay Advice View ---
async function renderPayAdviceView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-purple-600 mb-4">Tutor Pay Advice</h2>
            <div class="mb-4 flex justify-between items-center">
                <div>
                    <input type="month" id="pay-advice-month" class="p-2 border rounded">
                </div>
                <button id="download-csv-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Download CSV</button>
            </div>
            <div id="pay-advice-table" class="overflow-x-auto">
                <p class="text-center text-gray-500 py-10">Select a month to generate pay advice.</p>
            </div>
        </div>
    `;

    const monthInput = document.getElementById('pay-advice-month');
    const downloadBtn = document.getElementById('download-csv-btn');

    // Set default month to current month
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    monthInput.value = currentMonth;
    generatePayAdvice(currentMonth);

    monthInput.addEventListener('change', (e) => {
        generatePayAdvice(e.target.value);
    });

    downloadBtn.addEventListener('click', () => {
        const month = monthInput.value;
        downloadPayAdvice(month);
    });
}

async function generatePayAdvice(month) {
    const tableContainer = document.getElementById('pay-advice-table');
    tableContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Generating report for ${month}...</p>`;

    try {
        const [year, monthStr] = month.split('-');
        const startDate = new Date(year, parseInt(monthStr) - 1, 1);
        const endDate = new Date(year, parseInt(monthStr), 0);

        const studentsQuery = query(collection(db, "students"),
            where("timestamp", ">=", Timestamp.fromDate(startDate)),
            where("timestamp", "<=", Timestamp.fromDate(endDate))
        );

        const studentsSnapshot = await getDocs(studentsQuery);

        const tutorPaySummary = {};

        studentsSnapshot.forEach(doc => {
            const data = doc.data();
            const tutorEmail = data.tutorEmail;
            const studentFee = data.studentFee || 0;
            const tutorFee = studentFee * 0.7; // 70% of student fee goes to tutor

            if (!tutorPaySummary[tutorEmail]) {
                tutorPaySummary[tutorEmail] = {
                    studentCount: 0,
                    totalStudentFees: 0,
                    totalTutorPay: 0,
                    tutorName: data.tutorName || 'N/A'
                };
            }
            
            tutorPaySummary[tutorEmail].studentCount++;
            tutorPaySummary[tutorEmail].totalStudentFees += studentFee;
            tutorPaySummary[tutorEmail].totalTutorPay += tutorFee;
        });

        const payAdviceData = Object.keys(tutorPaySummary).map(tutorEmail => ({
            tutorEmail,
            tutorName: tutorPaySummary[tutorEmail].tutorName,
            studentCount: tutorPaySummary[tutorEmail].studentCount,
            totalStudentFees: tutorPaySummary[tutorEmail].totalStudentFees.toFixed(2),
            managementFee: (tutorPaySummary[tutorEmail].totalStudentFees * 0.3).toFixed(2),
            totalPay: tutorPaySummary[tutorEmail].totalTutorPay.toFixed(2)
        }));

        if (payAdviceData.length === 0) {
            tableContainer.innerHTML = `<p class="text-center text-gray-500 py-10">No new students found for the selected month.</p>`;
            document.getElementById('download-csv-btn').classList.add('hidden');
        } else {
            tableContainer.innerHTML = `
                <table class="min-w-full text-sm">
                    <thead class="bg-purple-100 text-left">
                        <tr>
                            <th class="px-4 py-2 font-medium">Tutor Name</th>
                            <th class="px-4 py-2 font-medium">Student Count</th>
                            <th class="px-4 py-2 font-medium">Total Student Fees (₦)</th>
                            <th class="px-4 py-2 font-medium">Management Fee (₦)</th>
                            <th class="px-4 py-2 font-medium">Total Pay (₦)</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${payAdviceData.map(item => `
                            <tr>
                                <td class="px-4 py-2">${capitalize(item.tutorName)}</td>
                                <td class="px-4 py-2">${item.studentCount}</td>
                                <td class="px-4 py-2">${Number(item.totalStudentFees).toLocaleString('en-NG')}</td>
                                <td class="px-4 py-2">${Number(item.managementFee).toLocaleString('en-NG')}</td>
                                <td class="px-4 py-2 font-bold text-purple-700">${Number(item.totalPay).toLocaleString('en-NG')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            document.getElementById('download-csv-btn').classList.remove('hidden');
            window.payAdviceData = payAdviceData; // Store data for CSV download
        }

    } catch (error) {
        console.error("Error generating pay advice: ", error);
        tableContainer.innerHTML = `<p class="text-center text-red-500 py-10">Error generating report.</p>`;
    }
}

function downloadPayAdvice(month) {
    if (!window.payAdviceData) {
        alert("No data to download. Please generate the report first.");
        return;
    }
    const csvContent = convertPayAdviceToCSV(window.payAdviceData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `pay-advice-${month}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}


// --- Main App Flow ---
// This is the main part that runs when the page loads
onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logout-btn');

    if (user) {
        // Fetch user data from staff directory
        const staffDocRef = doc(db, "staff", user.email);
        onSnapshot(staffDocRef, async (docSnap) => {
            if (docSnap.exists() && docSnap.data()?.isApproved) {
                const userRole = docSnap.data().role;
                const userPermissions = docSnap.data().permissions || [];

                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${docSnap.data().name}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = `Role: ${userRole}`;

                // Define all navigation items and their associated functions
                const allNavItems = {
                    'pending-approvals-nav': { id: 'pending-approvals-nav', fn: renderPendingApprovalView, requiredPermission: 'manageApprovals' },
                    'tutors-nav': { id: 'tutors-nav', fn: renderManagementTutorView, requiredPermission: 'manageTutors' },
                    'pay-advice-nav': { id: 'pay-advice-nav', fn: renderPayAdviceView, requiredPermission: 'viewPayAdvice' },
                };

                // Clear and update navigation based on permissions
                const navContainer = document.getElementById('main-nav');
                navContainer.innerHTML = '';
                let firstPermittedNavItemId = null;

                Object.keys(allNavItems).forEach(navId => {
                    const navItem = allNavItems[navId];
                    if (userPermissions.includes(navItem.requiredPermission)) {
                        const navButton = document.createElement('button');
                        navButton.id = navItem.id;
                        navButton.textContent = navItem.id.replace('-nav', '').replace('-', ' ');
                        navButton.className = 'nav-item p-4 text-center rounded-lg shadow-sm font-medium';
                        navContainer.appendChild(navButton);

                        navButton.addEventListener('click', () => {
                            // De-select all nav items and select the current one
                            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('bg-gray-200', 'text-gray-800'));
                            navButton.classList.add('bg-gray-200', 'text-gray-800');
                            handleNavigation(navItem.id.replace('-nav', ''));
                        });

                        // Set the first permitted item as active by default
                        if (firstPermittedNavItemId === null) {
                            firstPermittedNavItemId = navItem.id;
                        }
                    }
                });

                // If a user has no permissions but is approved, show an appropriate message
                if (firstPermittedNavItemId) {
                    // Activate the first tab and render its content
                    const firstNavButton = document.getElementById(firstPermittedNavItemId);
                    if (firstNavButton) {
                        firstNavButton.classList.add('bg-gray-200', 'text-gray-800');
                        handleNavigation(firstPermittedNavItemId.replace('-nav', ''));
                    }
                } else {
                    if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-gray-500">You have no permissions assigned to view any tabs.</p>`;
                }

                // Check for new permissions since last login
                const newPermissions = docSnap.data()?.newPermissions;
                if (newPermissions && newPermissions.length > 0) {
                    alert(`New permissions have been granted to your account: ${newPermissions.join(', ')}`);
                    // The current tab is still available, re-render it to apply new permissions.
                    const currentItem = allNavItems[activeNavId];
                    if(currentItem) currentItem.fn(mainContent);
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
