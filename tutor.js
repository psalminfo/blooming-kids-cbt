import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// --- Global state to hold report submission status ---
let isSubmissionEnabled = false;
let isTutorAddEnabled = false;
let isSummerBreakEnabled = false;
let isPendingStudentAddEnabled = false;

// Listen for changes to the admin settings in real-time
const settingsDocRef = doc(db, "settings", "global_settings");
onSnapshot(settingsDocRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        isSubmissionEnabled = data.isReportEnabled;
        isTutorAddEnabled = data.isTutorAddEnabled;
        isSummerBreakEnabled = data.isSummerBreakEnabled;
        isPendingStudentAddEnabled = data.isPendingStudentAddEnabled; // New setting

        // Re-render the student database if the page is currently active
        const mainContent = document.getElementById('mainContent');
        if (mainContent.querySelector('#student-list-view')) {
            renderStudentDatabase(mainContent, window.tutorData);
        }
    }
});

// ##################################
// # UTILITY FUNCTIONS
// ##################################

function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

async function handleAddStudent(tutorData) {
    // Show a form to add a student
    const studentName = prompt("Enter the new student's full name:");
    const studentClass = prompt("Enter the student's class (e.g., JSS1, SS2):");
    const studentSubject = prompt("Enter the student's subject:");
    const studentFee = prompt("Enter the student's fee (e.g., 5000):");

    if (studentName && studentClass && studentSubject && studentFee) {
        try {
            // New student object with pending status
            const newStudent = {
                name: capitalize(studentName),
                class: studentClass.toUpperCase(),
                subject: capitalize(studentSubject),
                fee: parseFloat(studentFee),
                tutorId: tutorData.email,
                tutorName: tutorData.name,
                timestamp: new Date(),
                status: 'pending', // Set status to pending
            };

            await addDoc(collection(db, "students"), newStudent);
            alert("Student added successfully! Awaiting admin approval.");
        } catch (error) {
            console.error("Error adding student:", error);
            alert("An error occurred while adding the student.");
        }
    }
}

// ##################################
// # PANEL RENDERING FUNCTIONS
// ##################################

async function renderTutorDashboard(container, tutorData) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold mb-4">Dashboard</h2>
            <p class="text-gray-700">Welcome, ${tutorData.name}. Here you can view your schedule and performance metrics.</p>
        </div>
    `;
}

async function renderStudentDatabase(container, tutorData) {
    container.innerHTML = `
        <div id="student-list-view" class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold">My Students</h2>
                ${isPendingStudentAddEnabled ? `<button id="addStudentBtn" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">Add Student</button>` : ''}
            </div>
            <div id="studentsContainer" class="space-y-4">
                <p class="text-center text-gray-500">Loading students...</p>
            </div>
        </div>
    `;

    const studentsContainer = document.getElementById('studentsContainer');
    const addStudentBtn = document.getElementById('addStudentBtn');

    if (addStudentBtn) {
        addStudentBtn.addEventListener('click', () => handleAddStudent(tutorData));
    }

    try {
        const studentsQuery = query(
            collection(db, "students"),
            where("tutorId", "==", tutorData.email)
        );

        onSnapshot(studentsQuery, (querySnapshot) => {
            studentsContainer.innerHTML = '';
            if (querySnapshot.empty) {
                studentsContainer.innerHTML = `<p class="text-center text-gray-500 mt-8">You currently have no students.</p>`;
            } else {
                querySnapshot.forEach(studentDoc => {
                    const studentData = studentDoc.data();
                    const studentId = studentDoc.id;
                    const statusText = studentData.status === 'pending' ? `<span class="text-yellow-500 font-semibold">(Pending Approval)</span>` : '';
                    const displayStatus = studentData.status === 'approved' || !isPendingStudentAddEnabled;
                    
                    // Only display students who are approved, or if the pending system is disabled.
                    if (displayStatus) {
                        studentsContainer.innerHTML += `
                            <div class="bg-gray-100 p-4 rounded-lg flex justify-between items-center">
                                <div>
                                    <h3 class="text-lg font-semibold">${studentData.name} ${statusText}</h3>
                                    <p class="text-sm text-gray-600">Class: ${studentData.class} | Subject: ${studentData.subject} | Fee: ₦${studentData.fee}</p>
                                </div>
                            </div>
                        `;
                    }
                });
            }
        });

    } catch (error) {
        console.error("Error fetching students:", error);
        studentsContainer.innerHTML = `<p class="text-red-500 text-center">Error loading students. Please try again.</p>`;
    }
}


function initializeTutorPanel() {
    const mainContent = document.getElementById('mainContent');
    const navDashboard = document.getElementById('navDashboard');
    const navStudentDatabase = document.getElementById('navStudentDatabase');
    const navSummerBreak = document.getElementById('navSummerBreak');

    function setActiveNav(activeButton) {
        navDashboard.classList.remove('active');
        navStudentDatabase.classList.remove('active');
        if (navSummerBreak) navSummerBreak.classList.remove('active');
        activeButton.classList.add('active');
    }

    navDashboard.addEventListener('click', () => { setActiveNav(navDashboard); renderTutorDashboard(mainContent, window.tutorData); });
    navStudentDatabase.addEventListener('click', () => { setActiveNav(navStudentDatabase); renderStudentDatabase(mainContent, window.tutorData); });
    if (navSummerBreak) {
        navSummerBreak.addEventListener('click', () => { setActiveNav(navSummerBreak); renderTutorDashboard(mainContent, window.tutorData); }); // Placeholder for summer break functionality
    }

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
