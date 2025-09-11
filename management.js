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
        `\"${item.tutorName}\"`,
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

// UPDATED: This function now fetches student reports submitted by a specific tutor.
async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-800">Tutor Management</h2>
            </div>
            <div id="tutor-list-container">
                <p class="text-center text-gray-500">Loading tutor data...</p>
            </div>
        </div>
    `;

    try {
        const tutorsCol = collection(db, "tutors");
        const q = query(tutorsCol, orderBy("name"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const tutors = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const listContainer = container.querySelector('#tutor-list-container');
            if (tutors.length === 0) {
                listContainer.innerHTML = '<p class="text-center text-gray-500">No tutors found.</p>';
                return;
            }

            const tutorListHtml = tutors.map(tutor => `
                <div class="p-4 bg-gray-50 rounded-lg shadow-sm mb-4">
                    <h3 class="font-semibold text-lg text-gray-900">${tutor.name}</h3>
                    <p class="text-gray-600 text-sm">Email: ${tutor.email}</p>
                    <p class="text-gray-600 text-sm">Status: ${capitalize(tutor.status)}</p>
                </div>
            `).join('');
            listContainer.innerHTML = tutorListHtml;
        });
    } catch (error) {
        console.error("Error fetching tutors: ", error);
        container.querySelector('#tutor-list-container').innerHTML = `<p class="text-center text-red-500">Error loading tutors: ${error.message}</p>`;
    }
}

// NEW: Function to render the pending approvals panel
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-gray-800">Pending Approvals</h2>
            </div>
            <div id="pending-staff-list-container">
                <p class="text-center text-gray-500">Loading pending accounts...</p>
            </div>
        </div>
    `;

    const pendingStaffListContainer = container.querySelector('#pending-staff-list-container');

    // Handle approval and denial actions
    container.addEventListener('click', async (e) => {
        if (e.target.closest('.approve-btn')) {
            const staffEmail = e.target.closest('button').dataset.email;
            if (staffEmail) {
                const staffDocRef = doc(db, "staff", staffEmail);
                await updateDoc(staffDocRef, {
                    status: 'approved',
                    role: 'staff' // Assign a default role upon approval
                }).then(() => {
                    console.log(`Approved staff member with email: ${staffEmail}`);
                }).catch(error => {
                    console.error("Error approving staff: ", error);
                });
            }
        } else if (e.target.closest('.deny-btn')) {
            const staffEmail = e.target.closest('button').dataset.email;
            if (staffEmail) {
                const staffDocRef = doc(db, "staff", staffEmail);
                await updateDoc(staffDocRef, {
                    status: 'denied'
                }).then(() => {
                    console.log(`Denied staff member with email: ${staffEmail}`);
                }).catch(error => {
                    console.error("Error denying staff: ", error);
                });
            }
        }
    });

    try {
        const staffCol = collection(db, "staff");
        const q = query(staffCol, where("status", "==", "pending"));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const pendingStaff = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (pendingStaff.length === 0) {
                pendingStaffListContainer.innerHTML = '<p class="text-center text-gray-500">No accounts are awaiting approval.</p>';
                return;
            }

            const staffListHtml = `
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${pendingStaff.map(staff => `
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${staff.name}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${staff.email}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${capitalize(staff.status)}</td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button data-email="${staff.email}" class="approve-btn text-indigo-600 hover:text-indigo-900 mr-2">Approve</button>
                                    <button data-email="${staff.email}" class="deny-btn text-red-600 hover:text-red-900">Deny</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
            pendingStaffListContainer.innerHTML = staffListHtml;
        });

    } catch (error) {
        console.error("Error fetching pending staff: ", error);
        pendingStaffListContainer.innerHTML = `<p class="text-center text-red-500">Error loading pending accounts: ${error.message}</p>`;
    }
}


// ##################################
// # INITIALIZATION & AUTHENTICATION
// ##################################

async function initializeManagementPanel() {
    const mainContent = document.getElementById('mainContent');
    const navDashboard = document.getElementById('navDashboard');
    const navTutorView = document.getElementById('navTutorView');
    const navPendingApprovals = document.getElementById('navPendingApprovals');

    const allNavItems = {
        navDashboard: { name: 'Dashboard', fn: async () => { /* Add dashboard logic here */ }, permission: 'view_dashboard' },
        navTutorView: { name: 'Tutor View', fn: renderManagementTutorView, permission: 'view_tutors' },
        navPendingApprovals: { name: 'Pending Approvals', fn: renderPendingApprovalsPanel, permission: 'approve_staff' },
    };

    const setActiveNav = (activeId) => {
        Object.keys(allNavItems).forEach(id => {
            document.getElementById(id)?.classList.toggle('active', id === activeId);
        });
    };

    const initialLoadId = navPendingApprovals && navPendingApprovals.classList.contains('active') ? 'navPendingApprovals' : 'navDashboard';
    setActiveNav(initialLoadId);
    allNavItems[initialLoadId].fn(mainContent);
}

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('mainContent');
    const logoutBtn = document.getElementById('logoutBtn');
    const navBar = document.getElementById('navBar');

    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        onSnapshot(staffDocRef, async (docSnap) => {
            if (docSnap.exists() && docSnap.data()?.status === 'approved') {
                const userData = docSnap.data();
                if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${userData?.name}`;
                if (document.getElementById('user-role')) document.getElementById('user-role').textContent = `Role: ${capitalize(userData.role || 'N/A')}`;

                if (navBar) {
                    navBar.innerHTML = ''; // Clear existing nav
                    const allNavItems = {
                        navDashboard: { name: 'Dashboard', fn: async () => { /* Dashboard logic here */ }, permission: 'view_dashboard' },
                        navTutorView: { name: 'Tutor View', fn: renderManagementTutorView, permission: 'view_tutors' },
                        navPendingApprovals: { name: 'Pending Approvals', fn: renderPendingApprovalsPanel, permission: 'approve_staff' }
                    };

                    const permissions = userData.permissions || {};
                    let activeNavId = null;

                    Object.entries(allNavItems).forEach(([id, item]) => {
                        if (permissions[item.permission]) {
                            const navItem = document.createElement('div');
                            navItem.id = id;
                            navItem.textContent = item.name;
                            navItem.classList.add('py-2', 'px-4', 'rounded-lg', 'font-medium', 'cursor-pointer', 'transition-colors', 'duration-200');
                            navBar.appendChild(navItem);

                            navItem.addEventListener('click', () => {
                                const container = document.getElementById('mainContent');
                                document.querySelectorAll('#navBar > div').forEach(el => el.classList.remove('bg-gray-200', 'text-gray-800'));
                                navItem.classList.add('bg-gray-200', 'text-gray-800');
                                item.fn(container);
                                activeNavId = id;
                            });

                            // Set the first available item as active initially
                            if (!activeNavId) {
                                activeNavId = id;
                                navItem.classList.add('bg-gray-200', 'text-gray-800');
                                item.fn(mainContent);
                            }
                        }
                    });

                    // If the current active tab is no longer available, navigate to the first available tab
                    if (activeNavId && !permissions[allNavItems[activeNavId].permission]) {
                        const firstAvailable = Object.keys(allNavItems).find(id => permissions[allNavItems[id].permission]);
                        if (firstAvailable) {
                            const firstNavItem = document.getElementById(firstAvailable);
                            firstNavItem?.classList.add('bg-gray-200', 'text-gray-800');
                            allNavItems[firstAvailable].fn(mainContent);
                        } else {
                            if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
                        }
                    } else if (activeNavId) {
                        // The current tab is still available, re-render it to apply new permissions.
                        const currentItem = allNavItems[activeNavId];
                        if (currentItem) currentItem.fn(mainContent);
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
