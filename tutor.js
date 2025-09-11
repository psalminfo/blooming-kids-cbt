import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, setDoc, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
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


// ##################################
// # NEW ACTION HANDLER FUNCTIONS
// ##################################

// UPDATED: This function now adds a student to the "pending_students" collection
async function addStudent(studentData, tutorEmail) {
    try {
        const docRef = await addDoc(collection(db, "pending_students"), {
            ...studentData,
            tutorEmail: tutorEmail,
            dateAdded: Timestamp.now(),
            status: "Awaiting Approval" // The new status for a pending student
        });
        console.log("Document written with ID: ", docRef.id);
        return { success: true, message: "Student added successfully and is awaiting approval." };
    } catch (e) {
        console.error("Error adding document: ", e);
        return { success: false, message: "Error adding student. Please try again." };
    }
}

async function renderTutorDashboard(mainContent, tutorData) {
    // Check if the current user has the appropriate role or permissions
    const tutorId = tutorData.id;

    // Fetch students linked to the current tutor
    const qStudents = query(collection(db, "students"), where("tutorEmail", "==", tutorId), orderBy("name"));
    const studentsSnap = await getDocs(qStudents);
    const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch total fees and payments
    const fees = students.reduce((sum, student) => sum + (student.fees || 0), 0);
    const payments = students.reduce((sum, student) => sum + (student.payments || 0), 0);
    const totalEarnings = fees - payments;

    mainContent.innerHTML = `
        <div id="tutor-dashboard-view" class="p-6 bg-gray-100 min-h-screen">
            <h2 class="text-3xl font-bold text-gray-800 mb-6">Tutor Dashboard</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div class="bg-white p-6 rounded-lg shadow-lg">
                    <h3 class="text-xl font-semibold text-gray-700">Total Students</h3>
                    <p class="text-3xl font-bold text-blue-600 mt-2">${students.length}</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-lg">
                    <h3 class="text-xl font-semibold text-gray-700">Total Earnings</h3>
                    <p class="text-3xl font-bold text-green-600 mt-2">₦${totalEarnings.toLocaleString()}</p>
                </div>
                <div class="bg-white p-6 rounded-lg shadow-lg">
                    <h3 class="text-xl font-semibold text-gray-700">Latest Report</h3>
                    <p class="text-sm text-gray-500 mt-2">No reports submitted recently.</p>
                </div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow-lg">
                <h3 class="text-xl font-semibold text-gray-700 mb-4">My Students</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fees Due</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                            </tr>
                        </thead>
                        <tbody id="dashboard-student-list" class="bg-white divide-y divide-gray-200">
                            ${students.map(student => `
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${student.name}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">₦${(student.fees - student.payments).toLocaleString()}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.lastActivity ? student.lastActivity.toDate().toLocaleDateString() : 'N/A'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// UPDATED: This function now fetches students from both "students" and "pending_students"
async function renderStudentDatabase(mainContent, tutorData) {
    const tutorEmail = tutorData.id;

    // Fetch approved students
    const qApprovedStudents = query(collection(db, "students"), where("tutorEmail", "==", tutorEmail));
    const approvedStudentsSnap = await getDocs(qApprovedStudents);
    const approvedStudents = approvedStudentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), status: 'Approved' }));

    // Fetch pending students
    const qPendingStudents = query(collection(db, "pending_students"), where("tutorEmail", "==", tutorEmail));
    const pendingStudentsSnap = await getDocs(qPendingStudents);
    const pendingStudents = pendingStudentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), status: 'Awaiting Approval' }));

    // Combine and sort all students by name
    const allStudents = [...approvedStudents, ...pendingStudents].sort((a, b) => a.name.localeCompare(b.name));

    mainContent.innerHTML = `
        <div id="student-list-view" class="p-6 bg-gray-100 min-h-screen">
            <h2 class="text-3xl font-bold text-gray-800 mb-6">Student Database</h2>
            
            <div id="message-area" class="mb-4 text-center text-sm font-medium text-green-600"></div>

            <div class="bg-white p-6 rounded-lg shadow-lg mb-6">
                <h3 class="text-xl font-semibold text-gray-700 mb-4">Add New Student</h3>
                <form id="addStudentForm" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label for="studentName" class="block text-sm font-medium text-gray-700">Name</label>
                            <input type="text" id="studentName" name="studentName" class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required>
                        </div>
                        <div>
                            <label for="studentSchool" class="block text-sm font-medium text-gray-700">School</label>
                            <input type="text" id="studentSchool" name="studentSchool" class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" required>
                        </div>
                        <div>
                            <label for="studentClass" class="block text-sm font-medium text-gray-700">Class</label>
                            <input type="text" id="studentClass" name="studentClass" class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                        </div>
                        <div>
                            <label for="studentPhone" class="block text-sm font-medium text-gray-700">Phone</label>
                            <input type="tel" id="studentPhone" name="studentPhone" class="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                        </div>
                    </div>
                    <button type="submit" id="addStudentBtn" class="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out">
                        Add Student
                    </button>
                </form>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-lg">
                <h3 class="text-xl font-semibold text-gray-700 mb-4">My Students (${allStudents.length})</h3>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">School</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${allStudents.length > 0 ? allStudents.map(student => `
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${student.name}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.school}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.class}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${student.status === 'Approved' ? 'text-green-600' : 'text-yellow-600'}">${student.status}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button class="text-blue-600 hover:text-blue-900 mx-1">Edit</button>
                                        <button class="text-red-600 hover:text-red-900 mx-1">Delete</button>
                                    </td>
                                </tr>
                            `).join('') : `
                                <tr>
                                    <td colspan="5" class="px-6 py-4 text-center text-gray-500">No students found.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    const addStudentForm = mainContent.querySelector('#addStudentForm');
    const messageArea = mainContent.querySelector('#message-area');
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const studentData = {
                name: addStudentForm.studentName.value,
                school: addStudentForm.studentSchool.value,
                class: addStudentForm.studentClass.value,
                phone: addStudentForm.studentPhone.value,
            };

            const result = await addStudent(studentData, tutorEmail);
            messageArea.textContent = result.message;
            if (result.success) {
                addStudentForm.reset();
                // Re-render the student list to show the new pending student
                renderStudentDatabase(mainContent, tutorData);
            }
        });
    }
}


function initializeTutorPanel() {
    const mainContent = document.getElementById('mainContent');
    const navDashboard = document.getElementById('navDashboard');
    const navStudentDatabase = document.getElementById('navStudentDatabase');

    function setActiveNav(activeButton) {
        navDashboard.classList.remove('active');
        navStudentDatabase.classList.remove('active');
        activeButton.classList.add('active');
    }

    navDashboard.addEventListener('click', () => { setActiveNav(navDashboard); renderTutorDashboard(mainContent, window.tutorData); });
    navStudentDatabase.addEventListener('click', () => { setActiveNav(navStudentDatabase); renderStudentDatabase(mainContent, window.tutorData); });

    // Default to Student Database on load
    setActiveNav(navStudentDatabase);
    renderStudentDatabase(mainContent, window.tutorData);
}

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
            mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Your account is not registered as a tutor.</p>`;
            logoutBtn.classList.add('hidden');
        }
    } else {
        window.location.href = "tutor-auth.html";
    }
});
