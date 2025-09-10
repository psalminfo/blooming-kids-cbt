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

// Global state to manage listeners for cleanup
const listeners = {};

function cleanupListeners() {
    Object.values(listeners).forEach(unsubscribe => unsubscribe && unsubscribe());
    for (const key in listeners) {
        delete listeners[key];
    }
}

/* ---------------------------
    PANEL RENDERERS
---------------------------- */
const panels = {
    tutorManagement: {
        fn: (container) => {
            container.innerHTML = `<h2 class="text-2xl font-bold">Tutor Management</h2>`;
            // ... your original tutor management logic ...
        },
        perm: 'viewTutorManagement',
        navText: 'Tutor Management'
    },
    payAdvice: {
        fn: (container) => {
            container.innerHTML = `<h2 class="text-2xl font-bold">Pay Advice</h2>`;
            // ... your original pay advice logic ...
        },
        perm: 'viewPayAdvice',
        navText: 'Pay Advice'
    },
    tutorReports: {
        fn: (container) => {
            container.innerHTML = `<h2 class="text-2xl font-bold">Tutor Reports</h2>`;
            // ... your original tutor reports logic ...
        },
        perm: 'viewTutorReports',
        navText: 'Tutor Reports'
    },
    summerBreak: {
        fn: (container) => {
            container.innerHTML = `<h2 class="text-2xl font-bold">Summer Break</h2>`;
            // ... your original summer break logic ...
        },
        perm: 'viewSummerBreak',
        navText: 'Summer Break'
    },
    pendingApprovals: {
        fn: renderPendingApprovalsPanel,
        perm: 'canApproveStudents',
        navText: 'Pending Approvals'
    }
};

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
    
    if (listeners.pendingApprovals) listeners.pendingApprovals();
    
    const unsubscribe = onSnapshot(query(collection(db, "students"), where("status", "==", "pending")), (snapshot) => {
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
    listeners.pendingApprovals = unsubscribe;
}

/* ---------------------------
    EVENT LISTENERS
---------------------------- */
function attachPendingApprovalEventListeners() {
    const listContainer = document.getElementById('pending-approvals-list');
    if (!listContainer) return;

    listContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const studentId = target.dataset.id;
        if (!studentId) return;

        try {
            if (target.classList.contains('approve-btn')) {
                await updateDoc(doc(db, "students", studentId), { status: "approved", approvedAt: Timestamp.now() });
            } else if (target.classList.contains('reject-btn')) {
                await updateDoc(doc(db, "students", studentId), { status: "rejected", rejectedAt: Timestamp.now() });
            } else if (target.classList.contains('edit-btn')) {
                const ref = doc(db, "students", studentId);
                const snap = await getDoc(ref);
                if (!snap.exists()) {
                    alert("Student not found");
                    return;
                }
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
            } else if (target.classList.contains('delete-btn')) {
                if (confirm("Delete this student permanently?")) {
                    await deleteDoc(doc(db, "students", studentId));
                }
            }
        } catch (error) {
            console.error("Error handling student action:", error);
            alert("An error occurred. Please try again.");
        }
    });
}

/* ---------------------------
    AUTH & NAVIGATION
---------------------------- */
onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    const welcomeMessage = document.getElementById('welcome-message');
    const userRole = document.getElementById('user-role');
    const navContainer = document.querySelector('nav');

    cleanupListeners();

    if (!user) {
        window.location.href = "management-auth.html";
        return;
    }

    const staffDocRef
