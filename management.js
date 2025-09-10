import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* ---------------------------
   HELPER FUNCTIONS
---------------------------- */
function capitalize(str) {
    if (typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ---------------------------
   EXISTING FUNCTIONS
   (Your original code remains here)
---------------------------- */
// ... your original management.js logic above remains unchanged ...

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
            const subjects = student.subjects && Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
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
   NEW: Event Listeners for Pending Approvals
---------------------------- */
function attachPendingApprovalEventListeners() {
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            await updateDoc(doc(db, "students", id), { status: "approved", approvedAt: Timestamp.now() });
        });
    });

    document.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            await updateDoc(doc(db, "students", id), { status: "rejected", rejectedAt: Timestamp.now() });
        });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            const studentRef = doc(db, "students", id);
            const studentSnap = await getDoc(studentRef);
            if (!studentSnap.exists()) return alert("Student not found");

            const student = studentSnap.data();
            const newName = prompt("Edit Name:", student.studentName);
            const newGrade = prompt("Edit Grade:", student.grade);
            const newDays = prompt("Edit Days/Week:", student.days);
            const newFee = parseFloat(prompt("Edit Fee:", student.studentFee || 0));

            await updateDoc(studentRef, {
                studentName: newName || student.studentName,
                grade: newGrade || student.grade,
                days: newDays || student.days,
                studentFee: isNaN(newFee) ? student.studentFee : newFee
            });
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (confirm("Are you sure you want to permanently delete this student?")) {
                await deleteDoc(doc(db, "students", id));
            }
        });
    });
}

/* ---------------------------
   AUTHENTICATION & NAVIGATION UPDATE
---------------------------- */
onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (user) {
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
                if (navContainer) {
                    navContainer.querySelectorAll('.nav-btn').forEach(btn => {
                        originalNavButtons[btn.id] = btn.textContent;
                    });
                    navContainer.innerHTML = '';
                    let firstVisibleTab = null;

                    Object.entries(allNavItems).forEach(([id, item]) => {
                        if (window.userData.permissions?.tabs?.[item.perm]) {
                            if (!firstVisibleTab) firstVisibleTab = id;
                            const button = document.createElement('button');
                            button.id = id;
                            button.className = 'nav-btn text-lg font-semibold text-gray-500 hover:text-green-700';
                            button.textContent = originalNavButtons[id] || id;
                            navContainer.appendChild(button);

                            button.addEventListener('click', () => {
                                document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
                                button.classList.add('active');
                                item.fn(mainContent);
                            });
                        }
                    });

                    if (firstVisibleTab) {
                        document.getElementById(firstVisibleTab).click();
                    } else {
                        if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
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

        if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
    } else {
        window.location.href = "management-auth.html";
    }
});
