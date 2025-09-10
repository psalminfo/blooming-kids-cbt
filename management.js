// Import the Firebase modules you need
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, getDocs, collection, query, orderBy } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js"; // This file should contain your API keys

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Your utility function (capitalize) might be missing, adding a basic one for a complete example
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Function to render the tutor view (your code)
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
            const tutor = tutorDoc.data();
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

// Main execution block to handle user authentication and render the view
onAuthStateChanged(auth, async (user) => {
    // Check if the user is authenticated
    if (user) {
        try {
            const mainContentContainer = document.getElementById('main-content');
            if (mainContentContainer) {
                // This is the correct way to call the function
                await renderManagementTutorView(mainContentContainer);
            }
        } catch (error) {
            console.error("Error during initial render:", error);
            document.getElementById('main-content').innerHTML = `<p class="text-center text-red-500 py-10">An error occurred.</p>`;
        }
    } else {
        // If no user is signed in, redirect to the login page
        window.location.href = "login.html";
    }
});
