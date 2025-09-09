import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, where, query, onSnapshot, updateDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import JSZip from "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.6.0/jszip.min.js";
import { saveAs } from "https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js";

// Global variables for Firebase services
let app;
let firestoreDb;
let authService;
let userId;
let authReady = false;

// Use the environment variables to configure Firebase
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Initialize Firebase and Authentication
const initializeFirebase = async () => {
    try {
        if (!app) {
            app = initializeApp(firebaseConfig);
            firestoreDb = getFirestore(app);
            authService = getAuth(app);
            setLogLevel('debug');
            
            onAuthStateChanged(authService, async (user) => {
                if (user) {
                    userId = user.uid;
                } else {
                    userId = null;
                }
                authReady = true;
                // Since this is for a management app, we'll redirect if not logged in.
                if (!user && window.location.pathname !== "/management-auth.html") {
                    window.location.href = "management-auth.html";
                }
            });
            
            if (initialAuthToken) {
                await signInWithCustomToken(authService, initialAuthToken);
            } else {
                await signInAnonymously(authService);
            }
        }
    } catch (error) {
        console.error("Error initializing Firebase:", error);
    }
};

// ##################################
// # UTILITY FUNCTIONS
// ##################################

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

// Helper function to trigger a file download
function downloadCSV(data, filename = 'pay_advice.csv') {
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Generates a mock student report as a text file
function generateMockStudentReport(studentName) {
    const reportContent = `
        Student Report for: ${capitalize(studentName)}
        -------------------------------------------
        Attendance: 95%
        Performance: Excellent
        Areas of Improvement: Time management
        Tutor's Comments:
        ${capitalize(studentName)} has shown remarkable progress this term. They are a pleasure to teach and have a positive attitude towards learning.
    `;
    return reportContent;
}

// ##################################
// # PANEL RENDERING FUNCTIONS
// ##################################

async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="p-6 bg-white rounded-lg shadow-md mt-6">
            <div class="flex flex-col sm:flex-row justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-gray-800">Tutors & Students</h2>
                <button id="endBreakBtn" class="mt-4 sm:mt-0 bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600 shadow-lg transition-colors">End Break & Reset Accounts</button>
            </div>
            <div id="tutor-student-list">
                <p class="text-gray-500">Loading...</p>
            </div>
        </div>
    `;

    try {
        const staffDocs = await getDocs(collection(firestoreDb, "staffs"));
        const staffData = staffDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const tutors = staffData.filter(staff => staff.role === 'tutor');

        if (tutors.length > 0) {
            const tutorList = await Promise.all(tutors.map(async tutor => {
                const studentsQuery = query(collection(firestoreDb, "students"), where("tutorId", "==", tutor.id));
                const studentDocs = await getDocs(studentsQuery);
                const students = studentDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                const studentListHtml = students.map(student => `
                    <li class="pl-8 py-1 text-gray-700">- ${capitalize(student.name)} (${student.grade} Grade)</li>
                `).join('');

                const tutorHtml = `
                    <div class="mb-6 p-4 bg-gray-50 rounded-lg shadow-inner">
                        <div class="flex justify-between items-center">
                            <h3 class="text-lg font-semibold text-green-700">${capitalize(tutor.name)}</h3>
                            <button class="download-reports-btn bg-green-500 text-white px-3 py-1 rounded-full text-sm hover:bg-green-600 transition-colors" data-tutor-id="${tutor.id}">Download Reports as ZIP</button>
                        </div>
                        <p class="text-sm text-gray-600">Students: ${students.length}</p>
                        <ul class="list-none mt-2">
                            ${studentListHtml || '<li class="pl-8 py-1 text-gray-400">No students assigned.</li>'}
                        </ul>
                    </div>
                `;
                return { html: tutorHtml, students: students, tutorName: tutor.name };
            }));

            document.getElementById('tutor-student-list').innerHTML = tutorList.map(t => t.html).join('');
            
            // Attach event listeners for the download buttons
            document.querySelectorAll('.download-reports-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const tutorId = e.target.dataset.tutorId;
                    const tutor = tutorList.find(t => t.id === tutorId);
                    
                    const zip = new JSZip();
                    const studentsForTutor = tutorList.find(t => t.students.some(s => s.tutorId === tutorId)).students;

                    if (studentsForTutor.length === 0) {
                        alert("No reports to download for this tutor.");
                        return;
                    }
                    
                    studentsForTutor.forEach(student => {
                        const reportContent = generateMockStudentReport(student.name);
                        zip.file(`${capitalize(student.name)}_Report.txt`, reportContent);
                    });
                    
                    try {
                        const content = await zip.generateAsync({ type: "blob" });
                        saveAs(content, `${capitalize(tutor.tutorName)}_Student_Reports.zip`);
                    } catch (error) {
                        console.error("Error generating ZIP:", error);
                        alert("Failed to create and download the ZIP file.");
                    }
                });
            });

        } else {
            document.getElementById('tutor-student-list').innerHTML = `<p class="text-gray-500">No tutors found.</p>`;
        }
        
        // Attach event listener for the End Break button
        document.getElementById('endBreakBtn').addEventListener('click', async () => {
            const confirmed = window.confirm("Are you sure you want to end the summer break and reset all student accounts? This action cannot be undone.");
            if (confirmed) {
                // Mock function to update all student statuses
                try {
                    const studentsRef = collection(firestoreDb, "students");
                    const studentDocs = await getDocs(studentsRef);
                    
                    // Note: In a real app, this would be a batch write or a Cloud Function
                    for (const doc of studentDocs.docs) {
                        await updateDoc(doc.ref, { 
                            status: 'active', // Assuming a status field exists
                            lastBreakEnd: Timestamp.now()
                        });
                    }
                    alert("Summer break has been ended for all students.");
                } catch (error) {
                    console.error("Error ending summer break:", error);
                    alert("Failed to end summer break. Check the console for details.");
                }
            }
        });

    } catch (error) {
        console.error("Error rendering tutor view:", error);
        document.getElementById('tutor-student-list').innerHTML = `<p class="text-red-500">Error loading data.</p>`;
    }
}


async function renderPayAdviceView(container) {
    container.innerHTML = `
        <div class="p-6 bg-white rounded-lg shadow-md mt-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-gray-800">Pay Advice</h2>
                <button id="downloadPayAdviceBtn" class="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 shadow-lg">Download as CSV</button>
            </div>
            <div id="pay-advice-data">
                <p class="text-gray-500">Loading pay advice data...</p>
            </div>
        </div>
    `;

    // Example mock data
    const mockPayAdviceData = [
        { tutorName: 'John Doe', studentCount: 5, totalStudentFees: 25000, managementFee: 5000, totalPay: 20000 },
        { tutorName: 'Jane Smith', studentCount: 8, totalStudentFees: 40000, managementFee: 8000, totalPay: 32000 },
    ];

    const tableRowsHtml = mockPayAdviceData.map(item => `
        <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="p-3 whitespace-nowrap">${item.tutorName}</td>
            <td class="p-3 text-center">${item.studentCount}</td>
            <td class="p-3 text-right">₦${item.totalStudentFees.toLocaleString()}</td>
            <td class="p-3 text-right">₦${item.managementFee.toLocaleString()}</td>
            <td class="p-3 text-right font-semibold">₦${item.totalPay.toLocaleString()}</td>
        </tr>
    `).join('');

    document.getElementById('pay-advice-data').innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutor Name</th>
                        <th class="p-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Student Count</th>
                        <th class="p-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Fees (₦)</th>
                        <th class="p-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Mgmt Fee (₦)</th>
                        <th class="p-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pay (₦)</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                    ${tableRowsHtml}
                </tbody>
            </table>
        </div>
    `;

    // Attach event listener to the new download button
    document.getElementById('downloadPayAdviceBtn').addEventListener('click', () => {
        const csvData = convertPayAdviceToCSV(mockPayAdviceData);
        downloadCSV(csvData, 'pay-advice.csv');
    });
}

async function renderTutorReportsView(container) {
    container.innerHTML = `
        <div class="p-6 bg-white rounded-lg shadow-md mt-6">
            <h2 class="text-xl font-bold text-gray-800">Tutor Reports</h2>
            <p class="text-gray-500 mt-2">Content for Tutor Reports will go here.</p>
        </div>
    `;
}

// ##################################
// # MAIN LOGIC
// ##################################
const mainContent = document.getElementById('mainContent');
const logoutBtn = document.getElementById('logoutBtn');

onAuthStateChanged(authService, async (user) => {
    if (user) {
        const staffDocRef = doc(firestoreDb, "staffs", user.uid);
        const staffDocSnap = await getDoc(staffDocRef);

        if (staffDocSnap.exists()) {
            const staffData = staffDocSnap.data();

            if (staffData.role === 'admin') {
                document.getElementById('welcome-message').textContent = `Hello, Admin ${capitalize(staffData.name)}`;
                document.getElementById('user-role').textContent = 'Status: Approved';

                const navItems = [
                    { id: 'navTutorManagement', fn: renderManagementTutorView, requiredRole: 'admin' },
                    { id: 'navPayAdvice', fn: renderPayAdviceView, requiredRole: 'admin' },
                    { id: 'navTutorReports', fn: renderTutorReportsView, requiredRole: 'admin' },
                ];

                let firstVisibleTab = '';
                navItems.forEach(item => {
                    const button = document.getElementById(item.id);
                    if (staffData.permissions && staffData.permissions[item.id] || item.requiredRole === staffData.role) {
                        button.classList.remove('hidden');
                        if (!firstVisibleTab) {
                            firstVisibleTab = item.id;
                        }
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
                    mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
                }

                logoutBtn.addEventListener('click', () => signOut(authService).then(() => window.location.href = "management-auth.html"));

            } else {
                document.getElementById('welcome-message').textContent = `Hello, ${staffData.name}`;
                document.getElementById('user-role').textContent = 'Status: Pending Approval';
                mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval.</p>`;
                logoutBtn.addEventListener('click', () => signOut(authService).then(() => window.location.href = "management-auth.html"));
            }
        } else {
            mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Account not registered in staff directory.</p>`;
            logoutBtn.classList.add('hidden');
        }
    } else {
        // Redirection is handled by the onAuthStateChanged listener at the top
    }
});
