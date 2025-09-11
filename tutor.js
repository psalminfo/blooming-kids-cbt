import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// --- Global state to hold report submission status ---
let isSubmissionEnabled = false;
let isTutorAddEnabled = false;
let isSummerBreakEnabled = false;

// Listen for changes to the admin settings in real-time
const settingsDocRef = doc(db, "settings", "global_settings");
onSnapshot(settingsDocRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        isSubmissionEnabled = data.isReportEnabled;
        isTutorAddEnabled = data.isTutorAddEnabled;
        isSummerBreakEnabled = data.isSummerBreakEnabled;

        // Re-render the student database if the page is currently active
        const mainContent = document.getElementById('mainContent');
        if (mainContent.querySelector('#student-list-view')) {
            renderStudentDatabase(mainContent, window.tutorData);
        }
    }
});


// ##################################################################
// # TUTOR DASHBOARD
// ##################################################################
const renderTutorDashboard = (mainContent, tutorData) => {
    mainContent.innerHTML = `
        <div class="p-6 bg-gray-50 rounded-lg shadow-inner min-h-screen">
            <h2 class="text-3xl font-bold mb-6 text-gray-800">Tutor Dashboard</h2>
            <p class="text-gray-600 mb-4">Welcome, ${tutorData.name || 'Tutor'}!</p>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                    <h3 class="text-xl font-semibold text-gray-700">Total Students</h3>
                    <p id="total-students-count" class="text-3xl font-bold text-indigo-600 mt-2">0</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                    <h3 class="text-xl font-semibold text-gray-700">Upcoming Sessions</h3>
                    <p class="text-3xl font-bold text-green-600 mt-2">N/A</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
                    <h3 class="text-xl font-semibold text-gray-700">Pending Approvals</h3>
                    <p id="pending-approvals-count" class="text-3xl font-bold text-yellow-600 mt-2">0</p>
                </div>
            </div>
        </div>
    `;

    const totalStudentsCount = document.getElementById('total-students-count');
    const pendingApprovalsCount = document.getElementById('pending-approvals-count');

    // Fetch and display counts
    const studentsQuery = query(collection(db, "students"), where("tutorEmail", "==", tutorData.email));
    onSnapshot(studentsQuery, (snapshot) => {
        totalStudentsCount.textContent = snapshot.size;
    });

    const pendingQuery = query(collection(db, "pending_students"), where("tutorEmail", "==", tutorData.email));
    onSnapshot(pendingQuery, (snapshot) => {
        pendingApprovalsCount.textContent = snapshot.size;
    });
};


// ##################################################################
// # STUDENT DATABASE
// ##################################################################
const renderStudentDatabase = (mainContent, tutorData) => {
    mainContent.innerHTML = `
        <div id="student-list-view" class="p-6 bg-gray-50 rounded-lg shadow-inner min-h-screen">
            <h2 class="text-3xl font-bold mb-6 text-gray-800">My Students</h2>
            <div class="flex items-center justify-between mb-6">
                <p class="text-gray-600">This is a list of all your students.</p>
                <button id="add-student-btn" class="bg-blue-600 text-white px-6 py-2 rounded-full font-semibold shadow-md hover:bg-blue-700 transition-colors">Add New Student</button>
            </div>
            
            <div id="student-list" class="bg-white p-4 rounded-md shadow-md">
                <p class="text-center text-gray-500">Loading students...</p>
            </div>
        </div>
        <div id="add-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden">
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <h3 class="text-lg font-bold mb-4">Add New Student</h3>
                <form id="add-student-form" class="space-y-4">
                    <input type="text" id="parent-name" placeholder="Parent's Name" required class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300">
                    <input type="email" id="parent-email" placeholder="Parent's Email" required class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300">
                    <input type="text" id="student-name" placeholder="Student's Name" required class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300">
                    <input type="number" id="grade" placeholder="Grade (1-12)" required min="1" max="12" class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring focus:border-blue-300">
                    <div class="flex justify-end space-x-2">
                        <button type="button" id="close-modal-btn" class="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Add Student</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const studentListDiv = document.getElementById('student-list');
    const addStudentBtn = document.getElementById('add-student-btn');
    const addStudentModal = document.getElementById('add-student-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addStudentForm = document.getElementById('add-student-form');

    // Handle student list display
    const studentsQuery = query(collection(db, "students"), where("tutorEmail", "==", tutorData.email));
    const pendingStudentsQuery = query(collection(db, "pending_students"), where("tutorEmail", "==", tutorData.email));

    onSnapshot(studentsQuery, async (studentsSnapshot) => {
        onSnapshot(pendingStudentsQuery, (pendingStudentsSnapshot) => {
            const allStudents = [];
            studentsSnapshot.forEach(doc => {
                allStudents.push({ id: doc.id, ...doc.data(), isPending: false });
            });
            pendingStudentsSnapshot.forEach(doc => {
                allStudents.push({ id: doc.id, ...doc.data(), isPending: true });
            });

            let studentHtml = '';
            if (allStudents.length === 0) {
                studentHtml = `<p class="text-center text-gray-500 py-8">No students found.</p>`;
            } else {
                studentHtml = `
                    <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                `;
                allStudents.forEach(student => {
                    const statusText = student.isPending ? 'Awaiting Approval' : (student.approvalStatus || 'Approved');
                    const statusColor = student.isPending ? 'bg-yellow-100 text-yellow-800' : (student.approvalStatus === 'deactivated' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800');
                    const actionsHtml = student.isPending ? '' : `
                        <button data-action="report" data-id="${student.id}" class="text-white bg-indigo-500 hover:bg-indigo-600 font-bold py-2 px-4 rounded-full mr-2 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                            Submit Report
                        </button>
                        <button data-action="manage" data-id="${student.id}" class="text-white bg-gray-500 hover:bg-gray-600 font-bold py-2 px-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                            Manage
                        </button>`;
                    
                    studentHtml += `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${student.studentName}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.grade}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm">
                                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${statusText}</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                ${actionsHtml}
                            </td>
                        </tr>
                    `;
                });
                studentHtml += `
                        </tbody>
                    </table>
                    </div>
                `;
            }
            studentListDiv.innerHTML = studentHtml;

            // Add event listeners for new buttons if not pending
            studentListDiv.querySelectorAll('button[data-action="report"]').forEach(button => {
                button.addEventListener('click', () => {
                    const studentId = button.dataset.id;
                    renderReportForm(mainContent, window.tutorData, studentId);
                });
            });

            studentListDiv.querySelectorAll('button[data-action="manage"]').forEach(button => {
                button.addEventListener('click', () => {
                    const studentId = button.dataset.id;
                    renderManageStudentPanel(mainContent, window.tutorData, studentId);
                });
            });
        });
    });

    // Handle modal display
    addStudentBtn.addEventListener('click', () => {
        if (!isTutorAddEnabled) {
            alert("The ability to add new students is currently disabled by the administrator.");
            return;
        }
        addStudentModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => {
        addStudentModal.classList.add('hidden');
        addStudentForm.reset();
    });

    // Handle form submission for adding a new student
    addStudentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const parentName = document.getElementById('parent-name').value;
        const parentEmail = document.getElementById('parent-email').value;
        const studentName = document.getElementById('student-name').value;
        const grade = document.getElementById('grade').value;

        try {
            await addDoc(collection(db, "pending_students"), {
                tutorEmail: tutorData.email,
                tutorName: tutorData.name,
                parentName,
                parentEmail,
                studentName,
                grade: parseInt(grade, 10),
                status: 'awaiting approval'
            });
            alert("Student added successfully! They are awaiting approval.");
            addStudentModal.classList.add('hidden');
            addStudentForm.reset();
        } catch (error) {
            console.error("Error adding student:", error);
            alert("Failed to add student. Please try again.");
        }
    });
};


// ##################################################################
// # TUTOR REPORT FORM
// ##################################################################
const renderReportForm = (mainContent, tutorData, studentId) => {
    // ... (This function remains unchanged)
};


// ##################################################################
// # MANAGE STUDENT PANEL
// ##################################################################
const renderManageStudentPanel = async (mainContent, tutorData, studentId) => {
    // ... (This function remains unchanged)
};


// ##################################################################
// # INITIALIZATION
// ##################################################################
const initializeTutorPanel = () => {
    const navDashboard = document.getElementById('navDashboard');
    const navStudentDatabase = document.getElementById('navStudentDatabase');
    const mainContent = document.getElementById('mainContent');

    const setActiveNav = (activeButton) => {
        navDashboard.classList.remove('active');
        navStudentDatabase.classList.remove('active');
        activeButton.classList.add('active');
    };

    navDashboard.addEventListener('click', () => { setActiveNav(navDashboard); renderTutorDashboard(mainContent, window.tutorData); });
    navStudentDatabase.addEventListener('click', () => { setActiveNav(navStudentDatabase); renderStudentDatabase(mainContent, window.tutorData); });

    // Default to Student Database on load
    setActiveNav(navStudentDatabase);
    renderStudentDatabase(mainContent, window.tutorData);
};

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('mainContent');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user) {
        const tutorRef = doc(db, "tutors", user.email);
        const tutorSnap = await getDoc(tutorRef);
        if (tutorSnap.exists()) {
            window.tutorData = tutorSnap.data();
            initializeTutorPanel();
            logoutBtn.addEventListener('click', async () => {
                await signOut(auth);
                window.location.href = "tutor-auth.html";
            });
        } else {
            mainContent.innerHTML = `<p class=\"text-center mt-12 text-red-600\">Your account is not registered as a tutor.</p>`;
            logoutBtn.classList.add('hidden');
        }
    } else {
        window.location.href = "tutor-auth.html";
    }
});
