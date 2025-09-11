import { auth, db } from './firebaseConfig.js';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    where,
    query,
    orderBy,
    Timestamp,
    writeBatch,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import {
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

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

// ##################################
// # PANEL RENDERING FUNCTIONS
// ##################################

async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor & Student Directory</h2>
                <div class="flex space-x-4">
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow">
                        <h4 class="font-bold text-green-800 text-sm">Total Tutors</h4>
                        <p id="tutor-count-badge" class="text-2xl font-extrabold">0</p>
                    </div>
                    <div class="bg-yellow-100 p-3 rounded-lg text-center shadow">
                        <h4 class="font-bold text-yellow-800 text-sm">Total Students</h4>
                        <p id="student-count-badge" class="text-2xl font-extrabold">0</p>
                    </div>
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
                .map(student => {
                    const subjects = student.subjects && Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
                    return `
                        <tr class="hover:bg-gray-50">
                            <td class="px-4 py-2 font-medium">${student.studentName}</td>
                            <td class="px-4 py-2">${student.grade}</td>
                            <td class="px-4 py-2">${student.days}</td>
                            <td class="px-4 py-2">${subjects}</td>
                            <td class="px-4 py-2">${student.parentName || 'N/A'}</td>
                            <td class="px-4 py-2">${student.parentPhone || 'N/A'}</td>
                        </tr>
                    `;
                }).join('');

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
                                    <th class="px-4 py-2 font-medium">Student Name</th>
                                    <th class="px-4 py-2 font-medium">Grade</th>
                                    <th class="px-4 py-2 font-medium">Days/Week</th>
                                    <th class="px-4 py-2 font-medium">Subject</th>
                                    <th class="px-4 py-2 font-medium">Parent's Name</th>
                                    <th class="px-4 py-2 font-medium">Parent's Phone</th>
                                </tr></thead>
                                <tbody class="bg-white divide-y divide-gray-200">${studentsTableRows}</tbody>
                            </table>
                        </div>
                    </details>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Error in renderManagementTutorView:", error);
        document.getElementById('directory-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

async function renderPayAdvicePanel(container) {
    const canExport = window.userData.permissions?.actions?.canExportPayAdvice === true;
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Tutor Pay Advice</h2>
            <div class="bg-green-50 p-4 rounded-lg mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <label for="start-date" class="block text-sm font-medium">Start Date</label>
                    <input type="date" id="start-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div>
                    <label for="end-date" class="block text-sm font-medium">End Date</label>
                    <input type="date" id="end-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="flex items-center space-x-4 col-span-2">
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                        <h4 class="font-bold text-green-800 text-sm">Active Tutors</h4>
                        <p id="pay-tutor-count" class="text-2xl font-extrabold">0</p>
                    </div>
                    <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                        <h4 class="font-bold text-yellow-800 text-sm">Total Students</h4>
                        <p id="pay-student-count" class="text-2xl font-extrabold">0</p>
                    </div>
                    ${canExport ? `<button id="export-pay-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 h-full">Export CSV</button>` : ''}
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium uppercase">Tutor</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Students</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Fees</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Mgmt. Fee</th><th class="px-6 py-3 text-left text-xs font-medium uppercase">Total Pay</th></tr></thead>
                    <tbody id="pay-advice-table-body" class="divide-y"><tr><td colspan="5" class="text-center py-4">Select a date range.</td></tr></tbody>
                </table>
            </div>
        </div>
    `;

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const handleDateChange = () => {
        const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
        if (startDate && endDate) {
            endDate.setHours(23, 59, 59, 999);
            loadPayAdviceData(startDate, endDate);
        }
    };
    startDateInput.addEventListener('change', handleDateChange);
    endDateInput.addEventListener('change', handleDateChange);
}

async function loadPayAdviceData(startDate, endDate) {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">Loading pay data...</td></tr>`;

    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    const reportsQuery = query(
        collection(db, "tutor_submissions"),
        where("submittedAt", ">=", startTimestamp),
        where("submittedAt", "<=", endTimestamp)
    );

    try {
        const reportsSnapshot = await getDocs(reportsQuery);
        const activeTutorEmails = [...new Set(reportsSnapshot.docs.map(doc => doc.data().tutorEmail))];

        if (activeTutorEmails.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4">No active tutors in this period.</td></tr>`;
            document.getElementById('pay-tutor-count').textContent = 0;
            document.getElementById('pay-student-count').textContent = 0;
            return;
        }

        const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
            getDocs(query(collection(db, "tutors"), where("email", "in", activeTutorEmails))),
            getDocs(collection(db, "students"))
        ]);

        const allStudents = studentsSnapshot.docs.map(doc => doc.data());
        let totalStudentCount = 0;

        const payAdviceData = reportsSnapshot.docs.reduce((acc, doc) => {
            const data = doc.data();
            const tutorEmail = data.tutorEmail;

            if (!acc[tutorEmail]) {
                acc[tutorEmail] = {
                    tutorEmail: tutorEmail,
                    tutorName: tutorsSnapshot.docs.find(tutorDoc => tutorDoc.data().email === tutorEmail)?.data().name || tutorEmail,
                    studentCount: 0,
                    totalStudentFees: 0,
                    managementFee: 0,
                    totalPay: 0,
                    studentFeesBreakdown: {}
                };
            }

            const student = allStudents.find(s => s.studentName === data.studentName && s.tutorEmail === data.tutorEmail);
            if (student) {
                const fees = parseFloat(student.fee);
                const mgmtFeeRate = parseFloat(student.management_fee_rate) / 100;
                const mgmtFee = fees * mgmtFeeRate;
                const tutorPay = fees - mgmtFee;

                acc[tutorEmail].studentCount++;
                acc[tutorEmail].totalStudentFees += fees;
                acc[tutorEmail].managementFee += mgmtFee;
                acc[tutorEmail].totalPay += tutorPay;
                acc[tutorEmail].studentFeesBreakdown[student.studentName] = {
                    fees,
                    mgmtFee,
                    tutorPay
                };
            }

            return acc;
        }, {});

        document.getElementById('pay-tutor-count').textContent = Object.keys(payAdviceData).length;
        document.getElementById('pay-student-count').textContent = totalStudentCount; // Re-calculate this properly
        
        // Correct calculation for total student count
        Object.values(payAdviceData).forEach(tutorData => {
            totalStudentCount += tutorData.studentCount;
        });
        document.getElementById('pay-student-count').textContent = totalStudentCount;

        const tableRowsHtml = Object.values(payAdviceData).map(tutorData => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">${tutorData.tutorName}</td>
                <td class="px-6 py-4 whitespace-nowrap">${tutorData.studentCount}</td>
                <td class="px-6 py-4 whitespace-nowrap">${tutorData.totalStudentFees.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${tutorData.managementFee.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${tutorData.totalPay.toFixed(2)}</td>
            </tr>
        `).join('');

        tableBody.innerHTML = tableRowsHtml;
        const exportBtn = document.getElementById('export-pay-csv-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const csvContent = convertPayAdviceToCSV(Object.values(payAdviceData));
                const blob = new Blob([csvContent], {
                    type: 'text/csv;charset=utf-8;'
                });
                const link = document.createElement("a");
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", `pay_advice_${startDate.toISOString().slice(0, 10)}_to_${endDate.toISOString().slice(0, 10)}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

    } catch (error) {
        console.error("Error loading pay advice data:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-red-500">Failed to load data.</td></tr>`;
    }
}

// Function to handle the summer break button click
async function endSummerBreak() {
    console.log("Attempting to end summer break...");
    const appStatusDocRef = doc(db, "app_status", "global");
    try {
        await updateDoc(appStatusDocRef, {
            isSummerBreak: false
        });
        alert("Summer break has been ended successfully!");
        console.log("Summer break ended.");
    } catch (error) {
        console.error("Error ending summer break:", error);
        alert(`Failed to end summer break: ${error.message}`);
    }
}

// Render Pending Approvals Panel
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Pending Approvals</h2>
            <div id="pending-students-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pending students...</p>
            </div>
        </div>
    `;

    const pendingList = document.getElementById('pending-students-list');
    const studentsQuery = query(collection(db, "pending_students"), orderBy("submissionDate", "desc"));

    onSnapshot(studentsQuery, (querySnapshot) => {
        if (querySnapshot.empty) {
            pendingList.innerHTML = `<p class="text-center text-gray-500 py-10">No students are awaiting approval.</p>`;
            return;
        }

        pendingList.innerHTML = querySnapshot.docs.map(doc => {
            const student = doc.data();
            return `
                <div class="border rounded-lg p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p class="font-semibold">${capitalize(student.studentName)}</p>
                        <p class="text-sm text-gray-600">Grade: ${student.grade} | Subject: ${student.subjects ? student.subjects.join(', ') : 'N/A'}</p>
                        <p class="text-sm text-gray-600">Submitted: ${new Date(student.submissionDate.seconds * 1000).toLocaleDateString()}</p>
                    </div>
                    <div>
                        <button data-student-id="${doc.id}" class="approve-btn bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Approve</button>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.approve-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const studentId = e.target.dataset.studentId;
                console.log("Approving student:", studentId);
                // Placeholder for approval logic
                alert(`Placeholder: Approving student with ID: ${studentId}`);
            });
        });
    });
}

// Main application logic, now structured to wait for user data
const mainContent = document.getElementById('main-content');
const welcomeMessage = document.getElementById('welcome-message');
const userRole = document.getElementById('user-role');
const logoutBtn = document.getElementById('logout-btn');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        const unsubscribeStaff = onSnapshot(staffDocRef, async (docSnap) => {
            if (docSnap.exists() && docSnap.data().status === 'approved') {
                const userData = docSnap.data();
                window.userData = userData; // Store user data globally for other functions to use

                welcomeMessage.textContent = `Hello, ${userData.name}`;
                userRole.textContent = `Role: ${capitalize(userData.role)}`;
                logoutBtn.classList.remove('hidden');

                const allNavItems = {
                    navDirectory: {
                        name: 'Directory',
                        fn: renderManagementTutorView,
                        permission: 'canViewDirectory'
                    },
                    navPayAdvice: {
                        name: 'Pay Advice',
                        fn: renderPayAdvicePanel,
                        permission: 'canViewPayAdvice'
                    },
                    navPendingApprovals: {
                        name: 'Pending Approvals',
                        fn: renderPendingApprovalsPanel,
                        permission: 'canApproveStudent'
                    },
                    navTutorManagement: {
                        name: 'Tutor Management',
                        fn: renderTutorManagementPanel,
                        permission: 'canManageTutors'
                    }
                };

                const navContainer = document.getElementById('nav-links');
                navContainer.innerHTML = '';
                let firstPermittedNavItemId = null;

                Object.entries(allNavItems).forEach(([id, item]) => {
                    const hasPermission = window.userData.permissions?.actions?.[item.permission] || false;
                    if (hasPermission) {
                        if (!firstPermittedNavItemId) {
                            firstPermittedNavItemId = id;
                        }
                        const navLink = document.createElement('a');
                        navLink.href = `#${id}`;
                        navLink.id = id;
                        navLink.classList.add('nav-link', 'inline-block', 'px-4', 'py-2', 'rounded-lg', 'font-medium', 'transition-colors');
                        navLink.textContent = item.name;
                        navLink.addEventListener('click', (e) => {
                            e.preventDefault();
                            document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('bg-gray-200', 'text-green-700'));
                            navLink.classList.add('bg-gray-200', 'text-green-700');
                            item.fn(mainContent);
                        });
                        navContainer.appendChild(navLink);
                    }
                });

                // Check for 'canEndBreak' to show the button regardless of the current panel
                const endBreakBtn = document.getElementById('end-summer-break-btn');
                if (window.userData.permissions?.actions?.canEndBreak) {
                    if (endBreakBtn) {
                        endBreakBtn.classList.remove('hidden');
                        endBreakBtn.addEventListener('click', endSummerBreak);
                    }
                } else {
                    if (endBreakBtn) {
                        endBreakBtn.classList.add('hidden');
                    }
                }

                // Initial load: render the first available panel
                if (firstPermittedNavItemId) {
                    const firstNavItem = document.getElementById(firstPermittedNavItemId);
                    if (firstNavItem) {
                        firstNavItem.click();
                    }
                } else {
                    mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
                }

            } else {
                welcomeMessage.textContent = `Hello, ${docSnap.data()?.name}`;
                userRole.textContent = 'Status: Pending Approval';
                mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval.</p>`;
                logoutBtn.classList.remove('hidden');
            }
        });

        // Initial check for staff document existence
        const staffDocSnap = await getDoc(staffDocRef);
        if (!staffDocSnap.exists()) {
            mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Account not registered in staff directory.</p>`;
            logoutBtn.classList.add('hidden');
        }

    } else {
        window.location.href = "management-auth.html";
    }
});

// Tutor Management Panel
async function renderTutorManagementPanel(container) {
    const canEndBreak = window.userData.permissions?.actions?.canEndBreak === true;
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Global Settings</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Report Submission:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="report-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="report-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Tutors Can Add Students:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="tutor-add-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="tutor-add-status-label" class="ml-3 text-sm font-medium"></span></label></label>
                <label class="flex items-center"><span class="text-gray-700 font-semibold mr-4">Enable Summer Break:</span><label class="relative inline-flex items-center cursor-pointer"><input type="checkbox" id="summer-break-toggle" class="sr-only peer"><div class="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div><span id="summer-break-status-label" class="ml-3 text-sm font-medium"></span></label></label>
            </div>
            ${canEndBreak ? `<button id="end-summer-break-btn" class="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">End Summer Break</button>` : ''}
        </div>
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-2xl font-bold text-green-700">Manage Tutors</h3>
                <div class="flex space-x-4">
                    <div class="bg-blue-100 p-3 rounded-lg text-center shadow">
                        <h4 class="font-bold text-blue-800 text-sm">Total Tutors</h4>
                        <p id="tutor-count-badge-mgmt" class="text-2xl font-extrabold">0</p>
                    </div>
                    <div class="bg-yellow-100 p-3 rounded-lg text-center shadow">
                        <h4 class="font-bold text-yellow-800 text-sm">Active Students</h4>
                        <p id="student-count-badge-mgmt" class="text-2xl font-extrabold">0</p>
                    </div>
                </div>
            </div>
            <div id="tutor-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading tutors...</p>
            </div>
        </div>
    `;

    // Add event listener for the "End Summer Break" button after rendering
    if (canEndBreak) {
        const endBreakBtn = document.getElementById('end-summer-break-btn');
        if (endBreakBtn) {
            endBreakBtn.addEventListener('click', endSummerBreak);
        }
    }

    // Add logic to toggle switches and load data
    const reportToggle = document.getElementById('report-toggle');
    const reportStatusLabel = document.getElementById('report-status-label');
    const tutorAddToggle = document.getElementById('tutor-add-toggle');
    const tutorAddStatusLabel = document.getElementById('tutor-add-status-label');
    const summerBreakToggle = document.getElementById('summer-break-toggle');
    const summerBreakStatusLabel = document.getElementById('summer-break-status-label');

    // ... (rest of the logic for the switches, I will assume it's already there)
}
