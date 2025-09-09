import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// Global message box functions
function showMessageBox(title, message) {
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-text').textContent = message;
    document.getElementById('message-box').classList.remove('hidden');
}

function closeMessageBox() {
    document.getElementById('message-box').classList.add('hidden');
}

// Global loading overlay functions
function showLoadingOverlay() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoadingOverlay() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

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

// ### UPDATED as requested ### to group students by tutor
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
            <div id="directory-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading directory...</p>
            </div>
        </div>
    `;

    showLoadingOverlay();

    try {
        const tutorsQuery = query(collection(db, `artifacts/${__app_id}/public/data/tutors`), orderBy("name"));
        const studentsQuery = query(collection(db, `artifacts/${__app_id}/public/data/students`));

        const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
            getDocs(tutorsQuery),
            getDocs(studentsQuery)
        ]);

        document.getElementById('tutor-count-badge').textContent = tutorsSnapshot.size;
        document.getElementById('student-count-badge').textContent = studentsSnapshot.size;

        const studentsByTutor = {};
        studentsSnapshot.forEach(doc => {
            const student = doc.data();
            if (!studentsByTutor[student.tutorId]) { // Using tutorId to match tutor UID
                studentsByTutor[student.tutorId] = [];
            }
            studentsByTutor[student.tutorId].push(student);
        });

        const directoryList = document.getElementById('directory-list');
        directoryList.innerHTML = tutorsSnapshot.docs.map(tutorDoc => {
            const tutor = tutorDoc.data();
            const assignedStudents = studentsByTutor[tutorDoc.id] || [];
            
            const studentsTableRows = assignedStudents
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(student => `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-2 font-medium">${student.name}</td>
                        <td class="px-4 py-2">${student.className || 'N/A'}</td>
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
                                    <th class="px-4 py-2 font-medium">Student Name</th>
                                    <th class="px-4 py-2 font-medium">Class</th>
                                </tr></thead>
                                <tbody class="bg-white divide-y divide-gray-200">${studentsTableRows}</tbody>
                            </table>
                        </div>
                    </details>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error("Error fetching tutor and student data:", error);
        directoryList.innerHTML = `<p class="text-center text-red-500">Error loading data. Please try again later.</p>`;
    } finally {
        hideLoadingOverlay();
    }
}

async function renderManagementPayAdvice(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4 text-green-700">Pay Advice</h2>
            <div class="flex justify-between items-center mb-4">
                <p class="text-gray-600">Generated pay advice for all tutors.</p>
                <button id="downloadAllPayAdviceBtn" class="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors">Download All as CSV</button>
            </div>
            <div id="pay-advice-container" class="space-y-4">
                <p class="text-center text-gray-500">Loading pay advice...</p>
            </div>
        </div>
    `;

    const payAdviceContainer = document.getElementById('pay-advice-container');
    const downloadAllBtn = document.getElementById('downloadAllPayAdviceBtn');
    
    showLoadingOverlay();

    downloadAllBtn.addEventListener('click', async () => {
        showLoadingOverlay();
        try {
            const tutorsQuery = query(collection(db, `artifacts/${__app_id}/public/data/tutors`));
            const tutorsSnapshot = await getDocs(tutorsQuery);
            const tutors = tutorsSnapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() }));

            const payAdvicePromises = tutors.map(async (tutor) => {
                const studentCheckinsQuery = query(collection(db, `artifacts/${__app_id}/public/data/studentCheckIns`), where('tutorId', '==', tutor.id));
                const checkinsSnapshot = await getDocs(studentCheckinsQuery);

                const studentCount = checkinsSnapshot.docs.length;
                const totalStudentFees = studentCount * 1000;
                const managementFee = totalStudentFees * 0.1;
                const totalPay = totalStudentFees - managementFee;

                return {
                    tutorName: capitalize(tutor.name),
                    studentCount,
                    totalStudentFees,
                    managementFee,
                    totalPay
                };
            });

            const payAdviceData = await Promise.all(payAdvicePromises);
            const csv = convertPayAdviceToCSV(payAdviceData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute("href", url);
                link.setAttribute("download", "pay_advice.csv");
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                showMessageBox('Download Complete', 'Pay advice data has been downloaded successfully.');
            } else {
                showMessageBox('Error', 'Your browser does not support downloading files directly.');
            }
        } catch (error) {
            console.error("Error downloading pay advice:", error);
            showMessageBox('Download Failed', 'An error occurred while generating the CSV file.');
        } finally {
            hideLoadingOverlay();
        }
    });

    try {
        const tutorsQuery = query(collection(db, `artifacts/${__app_id}/public/data/tutors`));
        onSnapshot(tutorsQuery, async (tutorSnapshot) => {
            if (tutorSnapshot.empty) {
                payAdviceContainer.innerHTML = `<p class="text-center text-gray-500">No tutors found.</p>`;
                hideLoadingOverlay();
                return;
            }

            const payAdvicePromises = tutorSnapshot.docs.map(async (docSnapshot) => {
                const tutor = { id: docSnapshot.id, ...docSnapshot.data() };
                const studentCheckinsQuery = query(collection(db, `artifacts/${__app_id}/public/data/studentCheckIns`), where('tutorId', '==', tutor.id));
                const checkinsSnapshot = await getDocs(studentCheckinsQuery);

                const studentCount = checkinsSnapshot.docs.length;
                const totalStudentFees = studentCount * 1000;
                const managementFee = totalStudentFees * 0.1;
                const totalPay = totalStudentFees - managementFee;

                return {
                    tutorName: capitalize(tutor.name),
                    studentCount,
                    totalStudentFees,
                    managementFee,
                    totalPay
                };
            });

            const payAdviceData = await Promise.all(payAdvicePromises);
            payAdviceContainer.innerHTML = `
                <div class="overflow-x-auto">
                    <table class="min-w-full bg-white border border-gray-200 divide-y divide-gray-200 rounded-lg shadow-sm">
                        <thead class="bg-gray-100">
                            <tr>
                                <th class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor Name</th>
                                <th class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Count</th>
                                <th class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Student Fees (₦)</th>
                                <th class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Management Fee (₦)</th>
                                <th class="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pay (₦)</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${payAdviceData.map(item => `
                                <tr>
                                    <td class="py-4 px-6 whitespace-nowrap text-sm font-medium text-gray-900">${item.tutorName}</td>
                                    <td class="py-4 px-6 whitespace-nowrap text-sm text-gray-700">${item.studentCount}</td>
                                    <td class="py-4 px-6 whitespace-nowrap text-sm text-gray-700">${item.totalStudentFees.toLocaleString()}</td>
                                    <td class="py-4 px-6 whitespace-nowrap text-sm text-gray-700">${item.managementFee.toLocaleString()}</td>
                                    <td class="py-4 px-6 whitespace-nowrap text-sm text-gray-700">${item.totalPay.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            hideLoadingOverlay();
        });
    } catch (error) {
        console.error("Error fetching pay advice data:", error);
        payAdviceContainer.innerHTML = `<p class="text-center text-red-500">Error loading data. Please try again later.</p>`;
        hideLoadingOverlay();
    }
}

async function renderManagementTutorReports(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4 text-green-700">Tutor Reports</h2>
            <div id="tutor-reports-container" class="space-y-4">
                <p class="text-center text-gray-500">Loading tutor reports...</p>
            </div>
        </div>
    `;

    const tutorReportsContainer = document.getElementById('tutor-reports-container');
    showLoadingOverlay();

    try {
        const tutorsQuery = query(collection(db, `artifacts/${__app_id}/public/data/tutors`));
        onSnapshot(tutorsQuery, async (tutorSnapshot) => {
            if (tutorSnapshot.empty) {
                tutorReportsContainer.innerHTML = `<p class="text-center text-gray-500">No tutors found.</p>`;
                hideLoadingOverlay();
                return;
            }

            const tutorReportPromises = tutorSnapshot.docs.map(async docSnapshot => {
                const tutor = { id: docSnapshot.id, ...docSnapshot.data() };
                const studentCheckinsQuery = query(collection(db, `artifacts/${__app_id}/public/data/studentCheckIns`), where('tutorId', '==', tutor.id));
                const checkinsSnapshot = await getDocs(studentCheckinsQuery);
                const checkins = checkinsSnapshot.docs.map(checkinDoc => checkinDoc.data());
                
                const studentCheckinCounts = checkins.reduce((acc, checkin) => {
                    acc[checkin.studentId] = (acc[checkin.studentId] || 0) + 1;
                    return acc;
                }, {});

                const reportHTML = `
                    <div class="border p-4 rounded-lg shadow-sm" id="report-${tutor.id}">
                        <h3 class="text-xl font-semibold text-green-600 mb-2">${capitalize(tutor.name)}'s Report</h3>
                        <p class="text-gray-500">Total Students Checked In: ${checkins.length}</p>
                        <div class="mt-4 pl-4 border-l-2 border-gray-200">
                            <h4 class="font-medium text-gray-600">Check-in Summary by Student:</h4>
                            <ul class="list-disc list-inside mt-1 text-gray-700">
                                ${Object.keys(studentCheckinCounts).map(studentId => `
                                    <li>Student ID: ${studentId} - Checked in ${studentCheckinCounts[studentId]} times</li>
                                `).join('')}
                            </ul>
                        </div>
                        <div class="mt-4 flex justify-end">
                            <button class="generate-zip-btn bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors" data-tutor-id="${tutor.id}" data-tutor-name="${tutor.name}">Download ZIP</button>
                        </div>
                    </div>
                `;
                return reportHTML;
            });
            
            const tutorReportsHTML = await Promise.all(tutorReportPromises);
            tutorReportsContainer.innerHTML = tutorReportsHTML.join('');
            
            // Add event listeners to the new buttons
            document.querySelectorAll('.generate-zip-btn').forEach(button => {
                button.addEventListener('click', () => {
                    const tutorId = button.getAttribute('data-tutor-id');
                    const tutorName = button.getAttribute('data-tutor-name');
                    downloadTutorDataAsZip(tutorId, tutorName);
                });
            });
            hideLoadingOverlay();
        });
    } catch (error) {
        console.error("Error fetching tutor reports data:", error);
        tutorReportsContainer.innerHTML = `<p class="text-center text-red-500">Error loading data. Please try again later.</p>`;
        hideLoadingOverlay();
    }
}

async function renderManagementStudentRecords(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-lg">
            <h2 class="text-2xl font-bold mb-4 text-green-700">Student Records</h2>
            <div id="student-records-container" class="space-y-4">
                <p class="text-center text-gray-500">Loading student records...</p>
            </div>
        </div>
    `;

    const studentRecordsContainer = document.getElementById('student-records-container');
    showLoadingOverlay();

    try {
        const studentsQuery = query(collection(db, `artifacts/${__app_id}/public/data/students`));
        onSnapshot(studentsQuery, async (studentSnapshot) => {
            if (studentSnapshot.empty) {
                studentRecordsContainer.innerHTML = `<p class="text-center text-gray-500">No student records found.</p>`;
                hideLoadingOverlay();
                return;
            }

            const studentDataPromises = studentSnapshot.docs.map(async docSnapshot => {
                const student = { id: docSnapshot.id, ...docSnapshot.data() };
                if (student.tutorId) {
                    const tutorDoc = await getDoc(doc(db, `artifacts/${__app_id}/public/data/tutors`, student.tutorId));
                    student.tutorName = tutorDoc.exists() ? capitalize(tutorDoc.data().name) : 'N/A';
                }
                return student;
            });

            const studentsWithTutor = await Promise.all(studentDataPromises);
            studentRecordsContainer.innerHTML = '';
            studentsWithTutor.forEach(student => {
                const studentDiv = document.createElement('div');
                studentDiv.className = 'border p-4 rounded-lg shadow-sm';
                studentDiv.innerHTML = `
                    <h3 class="text-xl font-semibold text-green-600">${capitalize(student.name)}</h3>
                    <p class="text-gray-500">Tutor: ${student.tutorName || 'N/A'}</p>
                    <p class="text-gray-500">Class: ${student.className || 'N/A'}</p>
                `;
                studentRecordsContainer.appendChild(studentDiv);
            });
            hideLoadingOverlay();
        });
    } catch (error) {
        console.error("Error fetching student records data:", error);
        studentRecordsContainer.innerHTML = `<p class="text-center text-red-500">Error loading data. Please try again later.</p>`;
        hideLoadingOverlay();
    }
}

// ##################################
// # MAIN APP LOGIC
// ##################################

document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('mainContent');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Make sure we have the app_id
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    
    // Set up navigation
    const navItems = [
        { id: 'navTutorManagement', fn: renderManagementTutorView, perm: 'viewTutorManagement', title: 'Tutor & Student List' },
        { id: 'navPayAdvice', fn: renderManagementPayAdvice, perm: 'viewPayAdvice', title: 'Pay Advice' },
        { id: 'navTutorReports', fn: renderManagementTutorReports, perm: 'viewTutorReports', title: 'Tutor Reports' },
        { id: 'navStudentRecords', fn: renderManagementStudentRecords, perm: 'viewStudentRecords', title: 'Student Records' },
    ];

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Log the user's UID and the path the app is looking for.
            console.log("Logged-in user UID:", user.uid);
            console.log("Expected staff document path:", `artifacts/${appId}/public/data/staff/${user.email}`);
            
            const userDoc = await getDoc(doc(db, `artifacts/${appId}/public/data/staff`, user.email));
            if (userDoc.exists()) {
                const staffData = userDoc.data();
                
                // Show the welcome message and role
                document.getElementById('welcome-message').textContent = `Welcome, ${staffData.name}`;
                document.getElementById('user-role').textContent = `Role: ${capitalize(staffData.role)}`;

                // Dynamic Navigation
                let firstVisibleTab = null;
                navItems.forEach(item => {
                    const button = document.getElementById(item.id);
                    if (staffData.permissions?.tabs?.[item.perm]) {
                        button.style.display = 'block';
                        if (!firstVisibleTab) {
                            firstVisibleTab = item.id;
                        }
                        button.addEventListener('click', () => {
                            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
                            button.classList.add('active');
                            item.fn(mainContent);
                        });
                    } else {
                        button.style.display = 'none';
                    }
                });
                
                if (firstVisibleTab) {
                    document.getElementById(firstVisibleTab).click();
                } else {
                    mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
                }
                
                logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));

            } else {
                console.log("Document does not exist for the logged-in user.");
                document.getElementById('welcome-message').textContent = `Hello, ${user.email}`;
                document.getElementById('user-role').textContent = 'Status: Not Registered';
                mainContent.innerHTML = `<p class="text-center mt-12 text-red-600 font-semibold">Your account is not registered in the staff directory. Ensure your staff profile exists in Firestore and its Document ID matches your User Email.</p>`;
                logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
            }
        } else {
            window.location.href = "management-auth.html";
        }
    });
});
