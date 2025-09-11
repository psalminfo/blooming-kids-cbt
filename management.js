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

// UPDATED: This function now fetches students based on the tutor's email
async function renderStudentDatabase(mainContent, tutorData) {
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div class="p-6 bg-gray-100 min-h-screen">
            <h2 class="text-3xl font-bold text-gray-800 mb-6">Student Database</h2>
            <!-- ... rest of the HTML ... -->
        </div>
    `;

    const studentListContainer = mainContent.querySelector('#student-list');
    const studentQuery = query(collection(db, 'students'), where('tutorId', '==', tutorData.email), orderBy('timestamp', 'desc'));

    onSnapshot(studentQuery, (snapshot) => {
        studentListContainer.innerHTML = '';
        if (snapshot.empty) {
            studentListContainer.innerHTML = `<p class="text-center text-gray-500 mt-4">No students found.</p>`;
            return;
        }

        snapshot.forEach((doc) => {
            const student = doc.data();
            const studentItem = document.createElement('div');
            studentItem.className = 'bg-white p-4 rounded-lg shadow-md mb-4 flex items-center justify-between';
            studentItem.innerHTML = `
                <div class="flex-1">
                    <p class="text-lg font-semibold text-gray-700">${capitalize(student.studentName)}</p>
                    <p class="text-sm text-gray-500">${student.class}</p>
                </div>
            `;
            studentListContainer.appendChild(studentItem);
        });
    });
}

// UPDATED: This function now fetches data for the pending approvals tab
async function renderPendingApprovalView(mainContent) {
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div class="p-6 bg-gray-100 min-h-screen">
            <h2 class="text-3xl font-bold text-gray-800 mb-6">Pending Approvals</h2>
            <div id="pending-list" class="space-y-4">
                <!-- Pending students will be rendered here -->
                <p class="text-center text-gray-500 mt-4">Loading pending students...</p>
            </div>
        </div>
    `;

    const pendingListContainer = mainContent.querySelector('#pending-list');
    
    // FIX: Removed orderBy to ensure all documents, even those without a timestamp, are displayed.
    const pendingStudentsQuery = query(collection(db, "pending_students"));
    
    onSnapshot(pendingStudentsQuery, (snapshot) => {
        pendingListContainer.innerHTML = '';
        if (snapshot.empty) {
            pendingListContainer.innerHTML = `<p class="text-center text-gray-500 mt-4">No pending approvals.</p>`;
            return;
        }
        snapshot.forEach((doc) => {
            const student = doc.data();
            const studentId = doc.id;
            const studentItem = document.createElement('div');
            studentItem.className = 'bg-white p-4 rounded-lg shadow-md mb-4 flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0';
            studentItem.innerHTML = `
                <div class="flex-1 space-y-1">
                    <p class="text-lg font-semibold text-gray-800">${capitalize(student.studentName)}</p>
                    <p class="text-sm text-gray-600"><strong>Tutor:</strong> ${student.tutorName}</p>
                    <p class="text-sm text-gray-600"><strong>Class:</strong> ${student.class}</p>
                    <p class="text-sm text-gray-600"><strong>Email:</strong> ${student.tutorId}</p>
                </div>
                <div class="flex space-x-2">
                    <button class="bg-green-500 text-white px-4 py-2 rounded-md shadow hover:bg-green-600 transition-colors approve-btn" data-id="${studentId}" data-tutor-id="${student.tutorId}">Approve</button>
                    <button class="bg-blue-500 text-white px-4 py-2 rounded-md shadow hover:bg-blue-600 transition-colors edit-btn" data-id="${studentId}" data-tutor-id="${student.tutorId}">Edit</button>
                    <button class="bg-red-500 text-white px-4 py-2 rounded-md shadow hover:bg-red-600 transition-colors reject-btn" data-id="${studentId}">Reject</button>
                </div>
            `;
            pendingListContainer.appendChild(studentItem);
        });

        // Add event listeners to the new buttons
        pendingListContainer.querySelectorAll('.approve-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const studentId = e.target.dataset.id;
                const tutorId = e.target.dataset.tutorId;
                await handleApproval(studentId, tutorId);
            });
        });
        pendingListContainer.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const studentId = e.target.dataset.id;
                await handleEditStudent(studentId);
            });
        });
        pendingListContainer.querySelectorAll('.reject-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const studentId = e.target.dataset.id;
                await handleRejection(studentId);
            });
        });
    });
}

// Function to render the pending approvals view
function initializeManagementPanel() {
    const mainContent = document.getElementById('mainContent');
    const navPending = document.getElementById('navPending');

    // Make the pending approval tab the default view
    navPending.classList.add('active');
    renderPendingApprovalView(mainContent);

    // Set up navigation event listener
    navPending.addEventListener('click', () => {
        document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));
        navPending.classList.add('active');
        renderPendingApprovalView(mainContent);
    });
}


// --- New functionality for management actions ---

async function handleApproval(studentId, tutorId) {
    try {
        const studentRef = doc(db, "pending_students", studentId);
        const studentSnap = await getDoc(studentRef);

        if (studentSnap.exists()) {
            const studentData = studentSnap.data();

            const batch = writeBatch(db);
            const studentsCollection = collection(db, "students");

            // Add the student to the 'students' collection
            const newStudentRef = doc(studentsCollection);
            batch.set(newStudentRef, {
                ...studentData,
                timestamp: Timestamp.now()
            });

            // Delete the student from the 'pending_students' collection
            batch.delete(studentRef);

            await batch.commit();
            console.log("Student approved and moved to students collection.");
            showModal('Student Approved Successfully!');
        }
    } catch (error) {
        console.error("Error approving student:", error);
        showModal('Error approving student. Please try again.');
    }
}

async function handleRejection(studentId) {
    try {
        await deleteDoc(doc(db, "pending_students", studentId));
        console.log("Student rejected and deleted from pending_students.");
        showModal('Student Rejected Successfully!');
    } catch (error) {
        console.error("Error rejecting student:", error);
        showModal('Error rejecting student. Please try again.');
    }
}

async function handleEditStudent(studentId) {
    try {
        const studentRef = doc(db, "pending_students", studentId);
        const studentSnap = await getDoc(studentRef);

        if (studentSnap.exists()) {
            const studentData = studentSnap.data();
            showEditModal(studentId, studentData);
        }
    } catch (error) {
        console.error("Error fetching student for edit:", error);
        showModal('Error fetching student details. Please try again.');
    }
}

async function updateEditedStudent(studentId, updatedData) {
    try {
        const studentRef = doc(db, "pending_students", studentId);
        await updateDoc(studentRef, updatedData);
        console.log("Student updated in pending_students.");
        showModal('Student details updated successfully!');
    } catch (error) {
        console.error("Error updating student:", error);
        showModal('Error updating student. Please try again.');
    }
}

// Custom Modal function
function showModal(message) {
    let modal = document.getElementById('custom-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-modal';
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full">
                <p class="text-center text-gray-800 mb-4">${message}</p>
                <button id="close-modal-btn" class="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600">Close</button>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('close-modal-btn').onclick = () => {
            modal.style.display = 'none';
        };
    } else {
        modal.querySelector('p').textContent = message;
        modal.style.display = 'flex';
    }
}

// Edit Modal function
function showEditModal(studentId, studentData) {
    let modal = document.getElementById('edit-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'edit-modal';
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 class="text-xl font-bold mb-4">Edit Student Details</h3>
            <form id="edit-student-form">
                <div class="mb-4">
                    <label class="block text-gray-700">Student Name</label>
                    <input type="text" id="edit-studentName" value="${studentData.studentName}" class="mt-1 p-2 w-full border rounded-md">
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700">Class</label>
                    <input type="text" id="edit-class" value="${studentData.class}" class="mt-1 p-2 w-full border rounded-md">
                </div>
                <div class="mb-4">
                    <label class="block text-gray-700">Tutor Name</label>
                    <input type="text" id="edit-tutorName" value="${studentData.tutorName}" class="mt-1 p-2 w-full border rounded-md">
                </div>
                <div class="flex justify-end space-x-2">
                    <button type="button" id="close-edit-modal-btn" class="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400">Cancel</button>
                    <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">Save Changes</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('close-edit-modal-btn').onclick = () => {
        modal.style.display = 'none';
    };

    document.getElementById('edit-student-form').onsubmit = async (e) => {
        e.preventDefault();
        const updatedData = {
            studentName: document.getElementById('edit-studentName').value,
            class: document.getElementById('edit-class').value,
            tutorName: document.getElementById('edit-tutorName').value
        };
        await updateEditedStudent(studentId, updatedData);
        modal.style.display = 'none';
    };

    modal.style.display = 'flex';
}

// Auth state management
onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('mainContent');
    const navItemsContainer = document.getElementById('navItems');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user) {
        const staffDocRef = doc(db, "staff", user.email);

        // Check if the user's account is active
        onSnapshot(staffDocRef, async (docSnap) => {
            if (docSnap.exists() && docSnap.data()?.active) {
                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${docSnap.data()?.name}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = `Role: ${docSnap.data()?.role}`;

                const permissions = docSnap.data().permissions || [];
                const allNavItems = {
                    pending: { label: 'Pending Approvals', fn: renderPendingApprovalView, icon: 'fa-user-clock' },
                };

                navItemsContainer.innerHTML = '';
                let hasPermissions = false;
                let activeNavId = null;

                for (const permission of permissions) {
                    if (allNavItems[permission]) {
                        hasPermissions = true;
                        const navItem = document.createElement('button');
                        navItem.id = `nav${capitalize(permission)}`;
                        navItem.className = 'flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-700 transition-colors';
                        navItem.innerHTML = `<i class="fa-solid ${allNavItems[permission].icon}"></i><span>${allNavItems[permission].label}</span>`;
                        navItem.addEventListener('click', () => {
                            document.querySelectorAll('#navItems button').forEach(btn => btn.classList.remove('active'));
                            navItem.classList.add('active');
                            allNavItems[permission].fn(mainContent);
                            activeNavId = permission;
                        });
                        navItemsContainer.appendChild(navItem);

                        // Set the first available permission as the default active tab
                        if (!activeNavId) {
                            activeNavId = permission;
                            navItem.classList.add('active');
                            allNavItems[permission].fn(mainContent);
                        }
                    }
                }
                // If permissions changed, ensure the current tab is still available, re-render it to apply new permissions.
                const currentItem = allNavItems[activeNavId];
                if(currentItem) currentItem.fn(mainContent);
            } else {
                if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
            }
        });

        const staffDocSnap = await getDoc(staffDocRef);
        if (!staffDocSnap.exists()) {
            if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600\">Account not registered in staff directory.</p>`;
            if (logoutBtn) logoutBtn.classList.add('hidden');
        }

        if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));

    } else {
        window.location.href = "management-auth.html";
    }
});
