import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Your web app's Firebase configuration from firebase code.txt
const firebaseConfig = {
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.firebasestorage.app",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
};

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables to store user and role data
let currentUser = null;
let userRole = null;
const ADMIN_EMAIL = 'psalm4all@gmail.com'; // This should be your admin email

// --- Helper Functions ---
function showLoader() {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.innerHTML = `<p class="text-center text-gray-600 mt-12">Checking user permissions...</p>`;
    }
}

// Function to handle logout
function handleLogout() {
    signOut(auth).then(() => {
        window.location.href = "login.html"; // Redirect to login page after logout
    }).catch((error) => {
        console.error("Logout failed:", error);
    });
}

// Function to render the tutor and student management view
async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor & Student Directory</h2>
                <div class="flex space-x-4">
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-green-800 text-sm">Total Tutors</h4><p id="tutor-count-badge" class="text-2xl font-extrabold">0</p></div>
                    <div class="bg-yellow-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-yellow-800 text-sm">Total Students</h4><p id="student-count-badge" class="text-2xl font-extrabold">0</p></div>
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
            const tutor = tutor.data();
            const assignedStudents = studentsByTutor[tutor.email] || [];
            
            const studentsTableRows = assignedStudents
                .sort((a, b) => a.studentName.localeCompare(b.studentName))
                .map(student => `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-2 font-medium">${student.studentName || 'N/A'}</td>
                        <td class="px-4 py-2">${student.parentName || 'N/A'}</td>
                        <td class="px-4 py-2">${student.parentPhone || 'N/A'}</td>
                    </tr>
                `).join('');

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
                                    <th class="px-4 py-2 font-medium">Student's Name</th>
                                    <th class="px-4 py-2 font-medium">Parent's Name</th>
                                    <th class="px-4 py-2 font-medium">Parent's Phone No.</th>
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

// --- Main App Logic and Navigation ---
document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    const welcomeMessage = document.getElementById('welcome-message');
    const userRoleText = document.getElementById('user-role');
    const navTutorManagement = document.getElementById('navTutorManagement');
    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    if (navTutorManagement) {
        navTutorManagement.addEventListener('click', () => {
            renderManagementTutorView(mainContent);
        });
    }

    // Authenticate user and render the appropriate view
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            if (user.email === ADMIN_EMAIL) {
                userRole = "Admin";
            } else {
                userRole = "Management";
            }
            welcomeMessage.textContent = `Welcome, ${user.displayName || user.email}!`;
            userRoleText.textContent = userRole;

            // Render the initial view for the logged-in user
            renderManagementTutorView(mainContent);
        } else {
            // No user is signed in, redirect to login page
            window.location.href = "login.html";
        }
    });
});
