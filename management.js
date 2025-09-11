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

        // Note: The UI should re-render any relevant components here to reflect the new settings.
        // This is a placeholder comment; specific re-rendering logic would need to be added
        // in a later update depending on which views are affected.
    }
});

// ##################################
// # NEW ACTION HANDLER FUNCTIONS
// ##################################

// UPDATED: This function now fetches student data for a given tutor and renders it.
async function renderStudentData(mainContent, tutorEmail) {
    if (!mainContent) return;

    try {
        mainContent.innerHTML = `<div id="student-list-view" class="container mx-auto p-4 md:p-8">
            <h2 class="text-3xl font-bold text-center text-gray-800 mb-6">Student Database for ${tutorEmail}</h2>
            <div id="student-list" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div class="col-span-full text-center text-gray-500">Loading students...</div>
            </div>
        </div>`;

        const studentListDiv = document.getElementById('student-list');
        if (!studentListDiv) return;

        const q = query(collection(db, "students"), where("tutorEmail", "==", tutorEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            studentListDiv.innerHTML = `<p class="col-span-full text-center text-gray-500">No students found for this tutor.</p>`;
            return;
        }

        studentListDiv.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const student = doc.data();
            const studentCard = document.createElement('div');
            studentCard.className = 'bg-gray-100 p-4 rounded-lg shadow-md';
            studentCard.innerHTML = `
                <h3 class="font-bold text-xl">${student.name}</h3>
                <p class="text-sm text-gray-600">Level: ${student.level}</p>
                <p class="text-sm text-gray-600">Subjects: ${student.subjects.join(', ')}</p>
                <p class="text-sm text-gray-600">School: ${student.school}</p>
                <p class="text-sm text-gray-600">Parent: ${student.parentName}</p>
                <p class="text-sm text-gray-600">Parent Phone: ${student.parentPhone}</p>
            `;
            studentListDiv.appendChild(studentCard);
        });

    } catch (error) {
        console.error("Error rendering student data:", error);
        if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Error loading student data.</p>`;
    }
}

// Function to handle the tutor management panel view
async function renderTutorManagementPanel(mainContent) {
    if (!mainContent) return;

    mainContent.innerHTML = `<div id="tutor-management-view" class="container mx-auto p-4 md:p-8">
        <h2 class="text-3xl font-bold text-center text-gray-800 mb-6">Tutor Management</h2>
        <div id="tutor-list" class="grid gap-4">
            <div class="col-span-full text-center text-gray-500">Loading tutors...</div>
        </div>
    </div>`;

    const tutorListDiv = document.getElementById('tutor-list');
    if (!tutorListDiv) return;

    try {
        const q = query(collection(db, "tutors"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            tutorListDiv.innerHTML = `<p class="col-span-full text-center text-gray-500">No tutors found.</p>`;
            return;
        }

        tutorListDiv.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const tutor = docSnap.data();
            const tutorCard = document.createElement('div');
            tutorCard.className = 'bg-white p-4 rounded-lg shadow-md flex justify-between items-center';
            tutorCard.innerHTML = `
                <div>
                    <h3 class="font-bold text-xl">${tutor.name}</h3>
                    <p class="text-sm text-gray-600">${tutor.email}</p>
                </div>
                <div>
                    <button class="view-students-btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full text-sm transition-colors duration-200" data-email="${tutor.email}">View Students</button>
                </div>
            `;
            tutorListDiv.appendChild(tutorCard);
        });

        // Add event listeners after rendering
        document.querySelectorAll('.view-students-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const tutorEmail = e.target.dataset.email;
                renderStudentData(mainContent, tutorEmail);
            });
        });

    } catch (error) {
        console.error("Error rendering tutor management panel:", error);
        if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Error loading tutors.</p>`;
    }
}

// Function to handle the admin dashboard view
async function renderAdminPanel(mainContent) {
    if (!mainContent) return;

    try {
        const tutorsQuery = query(collection(db, "tutors"));
        const tutorsSnapshot = await getDocs(tutorsQuery);
        const totalTutors = tutorsSnapshot.size;

        const studentsQuery = query(collection(db, "students"));
        const studentsSnapshot = await getDocs(studentsQuery);
        const totalStudents = studentsSnapshot.size;

        const globalSettingsDoc = await getDoc(doc(db, "settings", "global_settings"));
        const settings = globalSettingsDoc.exists() ? globalSettingsDoc.data() : { isReportEnabled: false, isTutorAddEnabled: false, isSummerBreakEnabled: false };

        mainContent.innerHTML = `<div class="container mx-auto p-4 md:p-8">
            <h2 class="text-3xl font-bold text-center text-gray-800 mb-6">Management Dashboard</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div class="bg-blue-100 p-6 rounded-lg shadow-md text-center">
                    <h3 class="text-xl font-bold text-blue-800">Total Tutors</h3>
                    <p class="text-4xl mt-2 font-extrabold text-blue-600">${totalTutors}</p>
                </div>
                <div class="bg-green-100 p-6 rounded-lg shadow-md text-center">
                    <h3 class="text-xl font-bold text-green-800">Total Students</h3>
                    <p class="text-4xl mt-2 font-extrabold text-green-600">${totalStudents}</p>
                </div>
                <div class="bg-purple-100 p-6 rounded-lg shadow-md text-center">
                    <h3 class="text-xl font-bold text-purple-800">Active Students</h3>
                    <p class="text-4xl mt-2 font-extrabold text-purple-600">N/A</p>
                </div>
            </div>

            <div class="bg-gray-50 p-6 rounded-lg shadow-inner">
                <h3 class="text-xl font-bold text-gray-800 mb-4">System Settings</h3>
                <div class="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b pb-2">
                    <span class="text-lg font-medium text-gray-700">Enable Submission of Reports</span>
                    <label class="switch">
                        <input type="checkbox" id="report-submission-toggle" ${settings.isReportEnabled ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="flex flex-col md:flex-row md:items-center justify-between border-b pb-2">
                    <span class="text-lg font-medium text-gray-700">Enable Tutor Account Creation</span>
                    <label class="switch">
                        <input type="checkbox" id="tutor-add-toggle" ${settings.isTutorAddEnabled ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                <div class="flex flex-col md:flex-row md:items-center justify-between pt-2">
                    <span class="text-lg font-medium text-gray-700">Enable Summer Break</span>
                    <label class="switch">
                        <input type="checkbox" id="summer-break-toggle" ${settings.isSummerBreakEnabled ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
        </div>`;
    } catch (error) {
        console.error("Error rendering admin dashboard:", error);
        if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Error loading dashboard data.</p>`;
    }
}

// Function to render the pending approvals panel
async function renderPendingApprovalsPanel(mainContent) {
    if (!mainContent) return;
    try {
        mainContent.innerHTML = `<div class="container mx-auto p-4 md:p-8">
            <h2 class="text-3xl font-bold text-center text-gray-800 mb-6">Pending Approvals</h2>
            <div id="pending-list" class="grid gap-4">
                <div class="col-span-full text-center text-gray-500">Loading pending requests...</div>
            </div>
        </div>`;

        const pendingListDiv = document.getElementById('pending-list');
        const q = query(collection(db, "staff"), where("status", "==", "pending"));

        onSnapshot(q, (querySnapshot) => {
            if (querySnapshot.empty) {
                pendingListDiv.innerHTML = `<p class="col-span-full text-center text-gray-500">No pending approvals.</p>`;
                return;
            }

            pendingListDiv.innerHTML = '';
            querySnapshot.forEach((docSnap) => {
                const user = docSnap.data();
                const userCard = document.createElement('div');
                userCard.className = 'bg-white p-4 rounded-lg shadow-md flex justify-between items-center';
                userCard.innerHTML = `
                    <div>
                        <h3 class="font-bold text-xl">${user.name}</h3>
                        <p class="text-sm text-gray-600">${user.email}</p>
                        <p class="text-sm text-gray-600">Role: ${capitalize(user.role)}</p>
                    </div>
                    <div>
                        <button class="approve-btn bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full text-sm mr-2 transition-colors duration-200" data-email="${user.email}">Approve</button>
                        <button class="reject-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full text-sm transition-colors duration-200" data-email="${user.email}">Reject</button>
                    </div>
                `;
                pendingListDiv.appendChild(userCard);
            });

            document.querySelectorAll('.approve-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const email = e.target.dataset.email;
                    await updateDoc(doc(db, "staff", email), { status: "approved" });
                });
            });

            document.querySelectorAll('.reject-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const email = e.target.dataset.email;
                    await deleteDoc(doc(db, "staff", email));
                });
            });
        });
    } catch (error) {
        console.error("Error rendering pending approvals panel:", error);
        if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Error loading pending approvals.</p>`;
    }
}

// Function to handle pay advice generation and download
async function renderPayAdvicePanel(mainContent) {
    if (!mainContent) return;

    mainContent.innerHTML = `<div class="container mx-auto p-4 md:p-8">
        <h2 class="text-3xl font-bold text-center text-gray-800 mb-6">Pay Advice</h2>
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h3 class="text-xl font-semibold mb-4">Generate Pay Advice for Tutors</h3>
            <button id="generatePayAdviceBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-full transition-colors duration-200">
                Generate and Download
            </button>
        </div>
        <div id="payAdviceResult" class="mt-8 hidden">
            <h3 class="text-xl font-semibold mb-4">Pay Advice Generated</h3>
            <div id="payAdviceContent" class="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm"></div>
            <a id="downloadLink" class="inline-block mt-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full transition-colors duration-200" download="tutor_pay_advice.csv">
                Download CSV
            </a>
        </div>
    </div>`;

    document.getElementById('generatePayAdviceBtn').addEventListener('click', async () => {
        const tutorsRef = collection(db, "tutors");
        const tutorsSnapshot = await getDocs(tutorsRef);
        
        const payAdviceData = [];
        for (const tutorDoc of tutorsSnapshot.docs) {
            const tutor = tutorDoc.data();
            const reportsQuery = query(collection(db, "student_reports"), where("tutorEmail", "==", tutor.email), where("payment_status", "==", "unpaid"));
            const reportsSnapshot = await getDocs(reportsQuery);

            let totalStudentFees = 0;
            let studentCount = 0;
            const batch = writeBatch(db);

            reportsSnapshot.forEach(reportDoc => {
                const report = reportDoc.data();
                if (report.fee) {
                    totalStudentFees += report.fee;
                    studentCount++;
                }
            });
            
            // Mark reports as paid in a batch
            reportsSnapshot.forEach(reportDoc => {
                const reportRef = doc(db, "student_reports", reportDoc.id);
                batch.update(reportRef, { payment_status: "paid" });
            });

            // Commit the batch update
            await batch.commit();

            const managementFee = totalStudentFees * 0.25;
            const totalPay = totalStudentFees - managementFee;

            if (totalPay > 0) {
                payAdviceData.push({
                    tutorName: tutor.name,
                    studentCount,
                    totalStudentFees,
                    managementFee,
                    totalPay
                });
            }
        }

        const csvContent = convertPayAdviceToCSV(payAdviceData);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const payAdviceContentDiv = document.getElementById('payAdviceContent');
        const downloadLink = document.getElementById('downloadLink');

        if (payAdviceContentDiv && downloadLink) {
            payAdviceContentDiv.textContent = csvContent;
            downloadLink.href = url;
            document.getElementById('payAdviceResult').classList.remove('hidden');
        }
    });
}

// Function to render the Staff management panel
async function renderStaffPanel(mainContent) {
    if (!mainContent) return;
    try {
        mainContent.innerHTML = `<div class="container mx-auto p-4 md:p-8">
            <h2 class="text-3xl font-bold text-center text-gray-800 mb-6">Staff Management</h2>
            <div id="staff-list" class="grid gap-4">
                <div class="col-span-full text-center text-gray-500">Loading staff...</div>
            </div>
        </div>`;

        const staffListDiv = document.getElementById('staff-list');
        const q = query(collection(db, "staff"), where("status", "==", "approved"));
        onSnapshot(q, (querySnapshot) => {
            if (querySnapshot.empty) {
                staffListDiv.innerHTML = `<p class="col-span-full text-center text-gray-500">No staff accounts found.</p>`;
                return;
            }

            staffListDiv.innerHTML = '';
            querySnapshot.forEach((docSnap) => {
                const user = docSnap.data();
                const userCard = document.createElement('div');
                userCard.className = 'bg-white p-4 rounded-lg shadow-md flex justify-between items-center';
                userCard.innerHTML = `
                    <div>
                        <h3 class="font-bold text-xl">${user.name}</h3>
                        <p class="text-sm text-gray-600">${user.email}</p>
                        <p class="text-sm text-gray-600">Role: ${capitalize(user.role)}</p>
                    </div>
                    <div>
                        <button class="remove-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full text-sm transition-colors duration-200" data-email="${user.email}">Remove</button>
                    </div>
                `;
                staffListDiv.appendChild(userCard);
            });

            document.querySelectorAll('.remove-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const email = e.target.dataset.email;
                    if (confirm(`Are you sure you want to remove ${email} from staff?`)) {
                        await deleteDoc(doc(db, "staff", email));
                    }
                });
            });
        });
    } catch (error) {
        console.error("Error rendering staff panel:", error);
        if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Error loading staff data.</p>`;
    }
}

// Function to render content management panel
async function renderContentManagerPanel(mainContent) {
    if (!mainContent) return;

    try {
        mainContent.innerHTML = `<div class="container mx-auto p-4 md:p-8">
            <h2 class="text-3xl font-bold text-center text-gray-800 mb-6">Content Management</h2>
            <div id="content-list" class="grid gap-4">
                <div class="col-span-full text-center text-gray-500">Loading content...</div>
            </div>
        </div>`;

        const contentListDiv = document.getElementById('content-list');
        const contentCollectionRef = collection(db, "content");
        
        onSnapshot(contentCollectionRef, (querySnapshot) => {
            if (querySnapshot.empty) {
                contentListDiv.innerHTML = `<p class="col-span-full text-center text-gray-500">No content found.</p>`;
                return;
            }

            contentListDiv.innerHTML = '';
            querySnapshot.forEach((docSnap) => {
                const content = docSnap.data();
                const contentCard = document.createElement('div');
                contentCard.className = 'bg-white p-4 rounded-lg shadow-md flex justify-between items-center';
                contentCard.innerHTML = `
                    <div>
                        <h3 class="font-bold text-xl">${content.title}</h3>
                        <p class="text-sm text-gray-600">Type: ${capitalize(content.type)}</p>
                        <p class="text-sm text-gray-600">Created: ${content.createdAt ? content.createdAt.toDate().toLocaleDateString() : 'N/A'}</p>
                    </div>
                    <div>
                        <button class="edit-content-btn bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-4 rounded-full text-sm mr-2 transition-colors duration-200" data-id="${docSnap.id}">Edit</button>
                        <button class="delete-content-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full text-sm transition-colors duration-200" data-id="${docSnap.id}">Delete</button>
                    </div>
                `;
                contentListDiv.appendChild(contentCard);
            });

            document.querySelectorAll('.edit-content-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const contentId = e.target.dataset.id;
                    // Implement edit functionality here
                    alert(`Editing content with ID: ${contentId}`);
                });
            });
            document.querySelectorAll('.delete-content-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const contentId = e.target.dataset.id;
                    if (confirm("Are you sure you want to delete this content?")) {
                        await deleteDoc(doc(db, "content", contentId));
                    }
                });
            });
        });
    } catch (error) {
        console.error("Error rendering content management panel:", error);
        if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Error loading content data.</p>`;
    }
}

// ##################################
// # CORE AUTHENTICATION AND PAGE SETUP
// ##################################

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('mainContent');
    const welcomeMessage = document.getElementById('welcome-message');
    const userRole = document.getElementById('user-role');
    const navButtons = document.querySelectorAll('.nav-btn');
    const navStaff = document.getElementById('navStaff');
    const navPendingApprovals = document.getElementById('navPendingApprovals');
    const navPayAdvice = document.getElementById('navPayAdvice');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user) {
        const staffDocRef = doc(db, "staff", user.email);

        onSnapshot(staffDocRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().status === "approved") {
                const userData = docSnap.data();
                if (welcomeMessage) welcomeMessage.textContent = `Hello, ${userData.name}`;
                if (userRole) userRole.textContent = `Role: ${capitalize(userData.role)}`;
                
                const userPermissions = userData.permissions || [];
                const allNavItems = {
                    'navDashboard': { fn: renderAdminPanel, permission: 'dashboard' },
                    'navTutorManagement': { fn: renderTutorManagementPanel, permission: 'tutor-management' },
                    'navContent': { fn: renderContentManagerPanel, permission: 'content-management' },
                    'navStaff': { fn: renderStaffPanel, permission: 'staff-management' },
                    'navPendingApprovals': { fn: renderPendingApprovalsPanel, permission: 'pending-approvals' },
                    'navPayAdvice': { fn: renderPayAdvicePanel, permission: 'pay-advice' }
                };

                const navContainer = document.getElementById('navButtonsContainer');
                if (navContainer) {
                    navContainer.innerHTML = '';
                    let firstNavItemId = null;

                    Object.entries(allNavItems).forEach(([id, item]) => {
                        if (userPermissions.includes(item.permission)) {
                            if (!firstNavItemId) firstNavItemId = id;
                            const button = document.createElement('button');
                            button.id = id;
                            button.className = 'nav-btn';
                            button.textContent = id.replace('nav', '');
                            button.addEventListener('click', () => {
                                Object.keys(allNavItems).forEach(btnId => document.getElementById(btnId)?.classList.remove('active'));
                                button.classList.add('active');
                                item.fn(mainContent);
                            });
                            navContainer.appendChild(button);
                        }
                    });

                    if (firstNavItemId) {
                        const firstButton = document.getElementById(firstNavItemId);
                        if(firstButton) {
                            firstButton.classList.add('active');
                            allNavItems[firstNavItemId].fn(mainContent);
                        }
                    }
                }
            } else {
                if (welcomeMessage) welcomeMessage.textContent = `Hello, ${docSnap.data()?.name}`;
                if (userRole) userRole.textContent = 'Status: Pending Approval';
                if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval.</p>`;
            }
        });

        const staffDocSnap = await getDoc(staffDocRef);
        if (!staffDocSnap.exists()) {
            if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Account not registered in staff directory.</p>`;
            if (logoutBtn) logoutBtn.classList.add('hidden');
        }

        if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));

    } else {
        window.location.href = "management-auth.html";
    }
});
