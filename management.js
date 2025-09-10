import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* ---------------------------
   HELPERS
---------------------------- */
function capitalize(str) {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ---------------------------
   EXISTING PANELS
---------------------------- */
function renderManagementTutorView(container) {
    container.innerHTML = `<h2 class="text-2xl font-bold">Tutor Management</h2>`;
    // ... your original tutor management logic ...
}

function renderPayAdvicePanel(container) {
    container.innerHTML = `<h2 class="text-2xl font-bold">Pay Advice</h2>`;
    // ... your original pay advice logic ...
}

function renderTutorReportsPanel(container) {
    container.innerHTML = `<h2 class="text-2xl font-bold">Tutor Reports</h2>`;
    // ... your original tutor reports logic ...
}

function renderSummerBreakPanel(container) {
    container.innerHTML = `<h2 class="text-2xl font-bold">Summer Break</h2>`;
    // ... your original summer break logic ...
}

/* ---------------------------
   NEW: Pending Approvals Panel
---------------------------- */
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Pending Student Approvals</h2>
            <div id="pending-approvals-list" class="space-y-4">
                <p class="text-center text-gray-500">Loading pending students...</p>
            </div>
        </div>
    `;

    const listContainer = document.getElementById('pending-approvals-list');

    onSnapshot(query(collection(db, "students"), where("status", "==", "pending")), (snapshot) => {
        if (snapshot.empty) {
            listContainer.innerHTML = `<p class="text-center text-gray-500">No students awaiting approval.</p>`;
            return;
        }

        listContainer.innerHTML = snapshot.docs.map(docSnap => {
            const student = docSnap.data();
            const studentId = docSnap.id;
            const subjects = Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
            return `
                <div class="border p-4 rounded-lg bg-gray-50">
                    <p><strong>Name:</strong> ${student.studentName}</p>
                    <p><strong>Grade:</strong> ${student.grade}</p>
                    <p><strong>Days/Week:</strong> ${student.days}</p>
                    <p><strong>Subjects:</strong> ${subjects}</p>
                    <p><strong>Fee:</strong> ₦${student.studentFee || 0}</p>
                    <div class="mt-3 flex space-x-2">
                        <button class="approve-btn bg-green-600 text-white px-3 py-1 rounded" data-id="${studentId}">Approve</button>
                        <button class="reject-btn bg-yellow-600 text-white px-3 py-1 rounded" data-id="${studentId}">Reject</button>
                        <button class="edit-btn bg-blue-600 text-white px-3 py-1 rounded" data-id="${studentId}">Edit</button>
                        <button class="delete-btn bg-red-600 text-white px-3 py-1 rounded" data-id="${studentId}">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        attachPendingApprovalEventListeners();
    });
}

/* ---------------------------
   NEW: Event Listeners
---------------------------- */
function attachPendingApprovalEventListeners() {
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.onclick = async (e) => {
            await updateDoc(doc(db, "students", e.target.dataset.id), { status: "approved", approvedAt: Timestamp.now() });
        };
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.onclick = async (e) => {
            await updateDoc(doc(db, "students", e.target.dataset.id), { status: "rejected", rejectedAt: Timestamp.now() });
        };
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = async (e) => {
            const ref = doc(db, "students", e.target.dataset.id);
            const snap = await getDoc(ref);
            if (!snap.exists()) return alert("Student not found");
            const s = snap.data();
            const newName = prompt("Edit Name:", s.studentName);
            const newGrade = prompt("Edit Grade:", s.grade);
            const newDays = prompt("Edit Days/Week:", s.days);
            const newFee = parseFloat(prompt("Edit Fee:", s.studentFee || 0));
            await updateDoc(ref, {
                studentName: newName || s.studentName,
                grade: newGrade || s.grade,
                days: newDays || s.days,
                studentFee: isNaN(newFee) ? s.studentFee : newFee
            });
        };
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = async (e) => {
            if (confirm("Delete this student permanently?")) {
                await deleteDoc(doc(db, "students", e.target.dataset.id));
            }
        };
    });
}

/* ---------------------------
   AUTH & NAVIGATION
---------------------------- */
onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!user) {
        window.location.href = "management-auth.html";
        return;
    }

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
                navPendingApprovals: { fn: renderPendingApprovalsPanel, perm: 'canApproveStudents' }
            };

            const navContainer = document.querySelector('nav');
            const originalNavButtons = {};
            navContainer.querySelectorAll('.nav-btn').forEach(btn => {
                originalNavButtons[btn.id] = btn.textContent;
            });
            navContainer.innerHTML = '';
            let firstVisibleTab = null;

            Object.entries(allNavItems).forEach(([id, item]) => {
                if (staffData.permissions?.tabs?.[item.perm]) {
                    if (!firstVisibleTab) firstVisibleTab = id;
                    const button = document.createElement('button');
                    button.id = id;
                    button.className = 'nav-btn text-lg font-semibold text-gray-500 hover:text-green-700';
                    button.textContent = originalNavButtons[id] || (id === 'navPendingApprovals' ? 'Pending Approvals' : id);
                    navContainer.appendChild(button);
                    button.onclick = () => {
                        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                        button.classList.add('active');
                        item.fn(mainContent);
                    };
                }
            });

            if (firstVisibleTab) {
                document.getElementById(firstVisibleTab).click();
            } else {
                mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
            }
        } else {
            document.getElementById('welcome-message').textContent = `
