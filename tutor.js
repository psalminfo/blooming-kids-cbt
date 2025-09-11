import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

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

        // Re-render the student database if the page is currently active
        const mainContent = document.getElementById('mainContent');
        if (mainContent.querySelector('#student-list-view')) {
            renderStudentDatabase(mainContent, window.tutorData);
        }
    }
});


// --- Functions to render each view ---
async function renderTutorDashboard(container, tutorData) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700">Dashboard</h2>
            <div id="dashboard-content" class="mt-4">
                <p>Welcome, ${tutorData.name}. Here you can submit your weekly reports and manage your students.</p>
            </div>
        </div>
    `;
    const pendingStudent = (await getDocs(query(collection(db, 'pending_students'), where('tutorEmail', '==', tutorData.email), where('isApproved', '==', false)))).docs.length;
    const approvedStudent = (await getDocs(query(collection(db, 'students'), where('tutorEmail', '==', tutorData.email), where('isApproved', '==', true)))).docs.length;
    const allStudent = pendingStudent + approvedStudent;
    
    document.getElementById('dashboard-content').innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-center">
            <div class="bg-blue-100 p-4 rounded-lg shadow">
                <h4 class="font-bold text-blue-800 text-sm">All Students</h4>
                <p class="text-2xl font-extrabold text-blue-900">${allStudent}</p>
            </div>
            <div class="bg-green-100 p-4 rounded-lg shadow">
                <h4 class="font-bold text-green-800 text-sm">Approved Students</h4>
                <p class="text-2xl font-extrabold text-green-900">${approvedStudent}</p>
            </div>
            <div class="bg-yellow-100 p-4 rounded-lg shadow">
                <h4 class="font-bold text-yellow-800 text-sm">Students Pending Approval</h4>
                <p class="text-2xl font-extrabold text-yellow-900">${pendingStudent}</p>
            </div>
        </div>
    `;
}

async function renderStudentDatabase(container, tutorData) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md" id="student-list-view">
            <h2 class="text-2xl font-bold text-green-700">My Students</h2>
            <div class="flex justify-between items-center mt-4">
                <div class="flex-grow">
                    <input type="text" id="search-student" placeholder="Search students..." class="w-full p-2 border rounded-md">
                </div>
                ${isTutorAddEnabled ? `<button id="addNewStudentBtn" class="ml-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Add New Student</button>` : ''}
            </div>
            <div id="student-list" class="mt-6 space-y-4">
                <p class="text-center text-gray-500">Loading students...</p>
            </div>
        </div>
        <div id="student-modal-container"></div>
    `;

    const searchInput = document.getElementById('search-student');
    const studentList = document.getElementById('student-list');

    if (isTutorAddEnabled) {
        document.getElementById('addNewStudentBtn').addEventListener('click', () => {
            showAddStudentModal(tutorData.email);
        });
    }

    const studentRef = collection(db, "students");
    const q = query(studentRef, where("tutorEmail", "==", tutorData.email));
    
    onSnapshot(q, (snapshot) => {
        const students = [];
        snapshot.forEach(doc => students.push({ id: doc.id, ...doc.data() }));
        window.allStudents = students; // Store globally for search functionality
        displayStudents(students);
    });
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredStudents = window.allStudents.filter(student => 
            student.studentName.toLowerCase().includes(searchTerm)
        );
        displayStudents(filteredStudents);
    });
    
}

function displayStudents(students) {
    const studentList = document.getElementById('student-list');
    if (!studentList) return;

    if (students.length === 0) {
        studentList.innerHTML = `<p class="text-center text-gray-500">No students found.</p>`;
        return;
    }
    
    studentList.innerHTML = students.map(student => `
        <div class="bg-gray-50 p-4 rounded-lg shadow flex items-center justify-between">
            <div>
                <h3 class="font-semibold text-lg">${student.studentName}</h3>
                <p class="text-sm text-gray-600">Grade: ${student.grade} | Fee: ₦${(student.studentFee || 0).toLocaleString()} | Days/Week: ${student.days}</p>
                <p class="text-xs text-gray-400 mt-1">Status: ${student.summerBreak ? 'On Break' : 'Active'}</p>
            </div>
            <div class="flex items-center space-x-2">
                ${isSubmissionEnabled ? `<button class="report-btn bg-blue-500 text-white px-3 py-1 rounded-full text-sm hover:bg-blue-600 transition-colors" data-student-id="${student.id}" data-student-name="${student.studentName}">Submit Report</button>` : ''}
                ${isSummerBreakEnabled && !student.summerBreak ? `<button class="break-btn bg-yellow-500 text-white px-3 py-1 rounded-full text-sm hover:bg-yellow-600 transition-colors" data-student-id="${student.id}" data-student-name="${student.studentName}">Start Break</button>` : ''}
                ${isSummerBreakEnabled && student.summerBreak ? `<button class="end-break-btn bg-green-500 text-white px-3 py-1 rounded-full text-sm hover:bg-green-600 transition-colors" data-student-id="${student.id}" data-student-name="${student.studentName}">End Break</button>` : ''}
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.report-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const studentId = e.target.dataset.studentId;
            const studentName = e.target.dataset.studentName;
            showReportModal(studentId, studentName, window.tutorData);
        });
    });
    
    document.querySelectorAll('.break-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const studentId = e.target.dataset.studentId;
            const studentName = e.target.dataset.studentName;
            handleSummerBreak(studentId, studentName);
        });
    });
    
    document.querySelectorAll('.end-break-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const studentId = e.target.dataset.studentId;
            const studentName = e.target.dataset.studentName;
            handleEndBreak(studentId, studentName);
        });
    });
}


// --- Student Reporting and Management Functions ---
async function handleSummerBreak(studentId, studentName) {
    if (confirm(`Are you sure you want to put ${studentName} on a summer break?`)) {
        try {
            await updateDoc(doc(db, "students", studentId), { summerBreak: true });
            alert(`${studentName} is now on a summer break.`);
        } catch (error) {
            console.error("Error setting summer break:", error);
            alert("Failed to set summer break. Check the console for details.");
        }
    }
}

async function handleEndBreak(studentId, studentName) {
    if (confirm(`Are you sure you want to end the break for ${studentName}?`)) {
        try {
            await updateDoc(doc(db, "students", studentId), { summerBreak: false, lastBreakEnd: new Date() });
            alert(`Break ended for ${studentName}.`);
        } catch (error) {
            console.error("Error ending summer break:", error);
            alert("Failed to end summer break. Check the console for details.");
        }
    }
}


function showReportModal(studentId, studentName, tutorData) {
    const modalHtml = `
        <div id="report-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-full max-w-2xl rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('report-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">Submit Report for ${studentName}</h3>
                <form id="report-form">
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Introduction</label>
                        <textarea name="introduction" rows="3" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Topics & Remarks</label>
                        <textarea name="topics" rows="5" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Progress & Achievements</label>
                        <textarea name="progress" rows="5" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Strengths and Weaknesses</label>
                        <textarea name="strengthsWeaknesses" rows="5" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Recommendations</label>
                        <textarea name="recommendations" rows="5" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></textarea>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">General Tutor's Comments</label>
                        <textarea name="generalComments" rows="5" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></textarea>
                    </div>
                    <div class="flex justify-end">
                        <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Submit Report</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('student-modal-container').innerHTML = modalHtml;

    document.getElementById('report-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const reportData = {
            studentId,
            studentName,
            tutorEmail: tutorData.email,
            tutorName: tutorData.name,
            parentName: '', // This will be fetched from student's data
            parentPhone: '', // This will be fetched from student's data
            grade: '', // This will be fetched from student's data
            introduction: formData.get('introduction'),
            topics: formData.get('topics'),
            progress: formData.get('progress'),
            strengthsWeaknesses: formData.get('strengthsWeaknesses'),
            recommendations: formData.get('recommendations'),
            generalComments: formData.get('generalComments'),
            submittedAt: new Date()
        };

        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (studentDoc.exists()) {
            const studentData = studentDoc.data();
            reportData.parentName = studentData.parentName || 'N/A';
            reportData.parentPhone = studentData.parentPhone || 'N/A';
            reportData.grade = studentData.grade || 'N/A';
        }

        try {
            await addDoc(collection(db, "tutor_submissions"), reportData);
            alert("Report submitted successfully!");
            document.getElementById('report-modal').remove();
        } catch (error) {
            console.error("Error submitting report: ", error);
            alert("Failed to submit report. Please check the console for details.");
        }
    });
}


function showAddStudentModal(tutorEmail) {
    const modalHtml = `
        <div id="add-student-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-full max-w-md rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('add-student-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">Add New Student</h3>
                <form id="add-student-form">
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Student Name</label>
                        <input type="text" name="studentName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Student Grade</label>
                        <input type="text" name="grade" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Days/Week</label>
                        <input type="number" name="days" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Subjects (comma-separated)</label>
                        <input type="text" name="subjects" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Student Fee (₦)</label>
                        <input type="number" name="fee" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Parent Name</label>
                        <input type="text" name="parentName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-medium">Parent Phone</label>
                        <input type="text" name="parentPhone" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>
                    <div class="flex justify-end">
                        <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Submit for Approval</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('student-modal-container').innerHTML = modalHtml;
    document.getElementById('add-student-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        addStudent(
            tutorEmail,
            form.parentName.value,
            form.parentPhone.value,
            form.studentName.value,
            form.grade.value,
            form.subjects.value.split(',').map(s => s.trim()),
            form.days.value,
            form.fee.value
        );
        document.getElementById('add-student-modal').remove();
    });
}

// --- CORRECTED addStudent function ---
async function addStudent(tutorEmail, parentName, parentPhone, studentName, studentGrade, studentSubject, studentDays, studentFee) {
    const q = query(collection(db, "students"), where("studentName", "==", studentName), where("tutorEmail", "==", tutorEmail));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        alert("A student with this name already exists under your account.");
        return;
    }

    try {
        await addDoc(collection(db, "pending_students"), {
            tutorEmail: tutorEmail,
            parentName: parentName,
            parentPhone: parentPhone,
            studentName: studentName,
            grade: studentGrade,
            subjects: studentSubject,
            days: studentDays,
            studentFee: parseFloat(studentFee),
            submittedByEmail: tutorEmail,
            submissionDate: new Date(),
            approvalStatus: 'pending' 
        });
        alert('Student submitted for approval. Awaiting management review.');
    } catch (error) {
        console.error("Error submitting student for approval: ", error);
        alert("Failed to submit student. Check the console for details.");
    }
}


// --- Authentication and Initialization ---
function initializeTutorPanel() {
    const navDashboard = document.getElementById('navDashboard');
    const navStudentDatabase = document.getElementById('navStudentDatabase');
    const mainContent = document.getElementById('mainContent');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!navDashboard || !navStudentDatabase || !mainContent || !logoutBtn) {
        console.error("Required navigation or content elements not found. Check your HTML structure.");
        return;
    }

    function setActiveNav(activeButton) {
        navDashboard.classList.remove('active');
        navStudentDatabase.classList.remove('active');
        activeButton.classList.add('active');
    }

    navDashboard.addEventListener('click', () => { setActiveNav(navDashboard); renderTutorDashboard(mainContent, window.tutorData); });
    navStudentDatabase.addEventListener('click', () => { setActiveNav(navStudentDatabase); renderStudentDatabase(mainContent, window.tutorData); });

    // Default to Student Database on load
    setActiveNav(navStudentDatabase);
    renderStudentDatabase(mainContent, window.tutorData);
}

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('mainContent');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user) {
        const tutorRef = doc(db, "tutors", user.email);
        const tutorSnap = await getDoc(tutorRef);
        if (tutorSnap.exists()) {
            window.tutorData = tutorSnap.data();
            initializeTutorPanel();
            logoutBtn.addEventListener('click', async () => {
                await signOut(auth);
                window.location.href = "tutor-auth.html";
            });
        } else {
            mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Your account is not registered as a tutor.</p>`;
            logoutBtn.classList.add('hidden');
        }
    } else {
        window.location.href = "tutor-auth.html";
    }
});
