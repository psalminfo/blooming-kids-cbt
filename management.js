import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
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
                    <div class="bg-blue-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-blue-800 text-sm">Total Tutors</h4><p id="tutor-count-badge" class="text-2xl font-extrabold">0</p></div>
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow"><h4 class="font-bold text-green-800 text-sm">Total Students</h4><p id="student-count-badge" class="text-2xl font-extrabold">0</p></div>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50"><tr>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Name</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Grade</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Days/Week</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Parent's Email</th>
                        <th class="px-6 py-3 text-left text-xs font-medium uppercase">Assigned Tutor</th>
                    </tr></thead>
                    <tbody id="directory-table-body" class="bg-white divide-y divide-gray-200">
                        <tr><td colspan="5" class="text-center py-10">Loading directory...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;

    const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
        getDocs(query(collection(db, "tutors"), orderBy("name"))),
        getDocs(collection(db, "students"))
    ]);

    document.getElementById('tutor-count-badge').textContent = tutorsSnapshot.size;
    document.getElementById('student-count-badge').textContent = studentsSnapshot.size;

    const tutorsMap = new Map(tutorsSnapshot.docs.map(doc => [doc.data().email, doc.data().name]));
    const tableBody = document.getElementById('directory-table-body');
    
    const studentsData = studentsSnapshot.docs.map(doc => doc.data());
    studentsData.sort((a, b) => a.studentName.localeCompare(b.studentName)); 
    
    tableBody.innerHTML = studentsData.map(student => `
            <tr>
                <td class="px-6 py-4 font-medium">${student.studentName}</td>
                <td class="px-6 py-4">${student.grade}</td>
                <td class="px-6 py-4">${student.days}</td>
                <td class="px-6 py-4">${student.parentEmail || 'N/A'}</td>
                <td class="px-6 py-4">${tutorsMap.get(student.tutorEmail) || 'Unassigned'}</td>
            </tr>
        `).join('');
}

async function renderPayAdvicePanel(container) {
    container.innerHTML = `<div class="bg-white p-6 rounded-lg shadow-md">Pay Advice panel is under construction.</div>`;
    // The full logic from admin.js can be copied here when ready
}

async function renderTutorReportsPanel(container) {
    container.innerHTML = `<div class="bg-white p-6 rounded-lg shadow-md">Tutor Reports panel is under construction.</div>`;
    // The full logic from admin.js (with view/download permissions) can be copied here when ready
}

async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Students on Summer Break</h2>
            <div id="break-students-list" class="space-y-4"><p class="text-gray-500 text-center">Loading...</p></div>
        </div>
    `;

    onSnapshot(query(collection(db, "students"), where("summerBreak", "==", true)), (snapshot) => {
        const listContainer = document.getElementById('break-students-list');
        if (!listContainer) return;

        if (snapshot.empty) {
            listContainer.innerHTML = `<p class="text-center text-gray-500">No students are currently on summer break.</p>`;
            return;
        }

        listContainer.innerHTML = snapshot.docs.map(doc => {
            const student = doc.data();
            return `
                <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50">
                    <div>
                        <p><strong>Student:</strong> ${student.studentName}</p>
                        <p class="text-sm text-gray-600"><strong>Tutor:</strong> ${student.tutorEmail}</p>
                    </div>
                    <span class="text-yellow-600 font-semibold px-3 py-1 bg-yellow-100 rounded-full text-sm">On Break</span>
                </div>
            `;
        }).join('');
    });
}


// ##################################
// # AUTHENTICATION & INITIALIZATION
// ##################################

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        const staffDocSnap = await getDoc(staffDocRef);

        if (staffDocSnap.exists()) {
            const staffData = staffDocSnap.data();

            if (staffData.role && staffData.role !== 'pending') {
                
                window.userData = staffData; 

                document.getElementById('welcome-message').textContent = `Welcome, ${staffData.name}`;
                document.getElementById('user-role').textContent = `Role: ${capitalize(staffData.role)}`;

                const navItems = {
                    navTutorManagement: renderManagementTutorView,
                    navPayAdvice: renderPayAdvicePanel,
                    navTutorReports: renderTutorReportsPanel,
                    navSummerBreak: renderSummerBreakPanel
                };

                const setActiveNav = (activeId) => Object.keys(navItems).forEach(id => {
                    document.getElementById(id)?.classList.toggle('active', id === activeId);
                });

                Object.entries(navItems).forEach(([id, renderFn]) => {
                    document.getElementById(id)?.addEventListener('click', () => {
                        setActiveNav(id);
                        renderFn(mainContent);
                    });
                });

                setActiveNav('navTutorManagement');
                renderManagementTutorView(mainContent);
                logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));

            } else {
                document.getElementById('welcome-message').textContent = `Hello, ${staffData.name}`;
                document.getElementById('user-role').textContent = 'Status: Pending Approval';
                mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval by an administrator. You will be able to access the portal once your role has been assigned.</p>`;
                logoutBtn.classList.remove('hidden');
                logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
            }
        } else {
            mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Your account is not registered in the staff directory. Please contact an administrator.</p>`;
            logoutBtn.classList.add('hidden');
        }
    } else {
        window.location.href = "management-auth.html";
    }
});
