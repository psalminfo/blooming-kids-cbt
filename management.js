import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

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
// # PANEL RENDERING FUNCTIONS
// ##################################

async function renderManagementTutorView(container, staffPermissions) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold">Tutor & Student Directory</h2>
            </div>
            <div id="tutorsList" class="space-y-6">
                <p class="text-center text-gray-500">Loading tutors and students...</p>
            </div>
        </div>
    `;
    const tutorsListContainer = document.getElementById('tutorsList');

    try {
        const tutorsQuery = query(collection(db, "tutors"), orderBy("name"));
        const studentsQuery = query(collection(db, "students"), where("status", "==", "approved"), orderBy("tutorName"));

        const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
            getDocs(tutorsQuery),
            getDocs(studentsQuery)
        ]);

        const tutors = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        tutorsListContainer.innerHTML = ''; // Clear loading message

        if (tutors.length === 0) {
            tutorsListContainer.innerHTML = `<p class="text-center text-gray-500">No tutors found.</p>`;
            return;
        }

        tutors.forEach(tutor => {
            const tutorStudents = students.filter(student => student.tutorId === tutor.email);
            const studentListHtml = tutorStudents.length > 0
                ? tutorStudents.map(student => `
                    <li class="pl-4 py-2 border-l-2 border-gray-200 flex justify-between items-center">
                        <div>
                            <span class="text-gray-800">${student.name}</span>
                            <span class="text-sm text-gray-500 ml-2">(${student.class})</span>
                        </div>
                        ${staffPermissions?.actions?.canRemoveStudent ? `
                            <button class="bg-red-500 text-white px-3 py-1 rounded-full text-xs hover:bg-red-600 remove-student-btn" data-student-id="${student.id}">
                                Remove
                            </button>
                        ` : ''}
                    </li>
                `).join('')
                : '<li class="pl-4 py-2 text-gray-400">No students assigned.</li>';

            const tutorHtml = `
                <div class="bg-gray-50 p-4 rounded-lg shadow-inner">
                    <div class="flex justify-between items-center mb-2">
                        <h3 class="text-xl font-semibold text-green-700">${tutor.name}</h3>
                        <div class="flex space-x-2">
                            ${staffPermissions?.actions?.canAddStudent ? `
                                <button class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 add-student-btn" data-tutor-id="${tutor.email}">
                                    Add Student
                                </button>
                            ` : ''}
                            ${staffPermissions?.actions?.canEditStudent ? `
                                <button class="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 edit-tutor-btn" data-tutor-id="${tutor.email}">
                                    Edit Tutor
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <ul class="space-y-1">
                        ${studentListHtml}
                    </ul>
                </div>
            `;
            tutorsListContainer.innerHTML += tutorHtml;
        });

        // Add event listeners for new buttons
        document.querySelectorAll('.add-student-btn').forEach(button => {
            button.addEventListener('click', (e) => handleManagementAddStudent(e.target.dataset.tutorId, staffPermissions));
        });
        document.querySelectorAll('.remove-student-btn').forEach(button => {
            button.addEventListener('click', (e) => handleRemoveStudent(e.target.dataset.studentId));
        });

    } catch (error) {
        console.error("Error rendering tutor view:", error);
        tutorsListContainer.innerHTML = `<p class="text-red-500 text-center">Error loading data. Please try again.</p>`;
    }
}

async function handleManagementAddStudent(tutorId, staffPermissions) {
    if (!staffPermissions?.actions?.canAddStudent) {
        alert("You do not have permission to add students.");
        return;
    }
    const studentName = prompt("Enter the new student's full name:");
    const studentClass = prompt("Enter the student's class (e.g., JSS1, SS2):");
    const studentSubject = prompt("Enter the student's subject:");
    const studentFee = prompt("Enter the student's fee (e.g., 5000):");

    if (studentName && studentClass && studentSubject && studentFee) {
        try {
            const tutorSnap = await getDoc(doc(db, "tutors", tutorId));
            if (!tutorSnap.exists()) {
                alert("Tutor not found.");
                return;
            }
            const tutorData = tutorSnap.data();
            const newStudent = {
                name: capitalize(studentName),
                class: studentClass.toUpperCase(),
                subject: capitalize(studentSubject),
                fee: parseFloat(studentFee),
                tutorId: tutorId,
                tutorName: tutorData.name,
                timestamp: new Date(),
                status: 'approved', // Directly approved by management
            };
            await addDoc(collection(db, "students"), newStudent);
            alert("Student added successfully!");
        } catch (error) {
            console.error("Error adding student:", error);
            alert("An error occurred while adding the student.");
        }
    }
}

async function handleRemoveStudent(studentId) {
    if (confirm("Are you sure you want to remove this student? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "students", studentId));
            alert("Student removed successfully.");
        } catch (error) {
            console.error("Error removing student:", error);
            alert("An error occurred while removing the student.");
        }
    }
}

async function renderPendingApprovals(container, staffPermissions) {
    if (!staffPermissions?.actions?.canManageStudentApprovals) {
        container.innerHTML = `<p class="text-center mt-8 text-red-500">You do not have permission to manage student approvals.</p>`;
        return;
    }
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold">Pending Student Approvals</h2>
            </div>
            <div id="pendingStudentsList" class="space-y-4">
                <p class="text-center text-gray-500">Loading pending students...</p>
            </div>
        </div>
    `;

    const pendingStudentsList = document.getElementById('pendingStudentsList');
    const pendingStudentsQuery = query(collection(db, "students"), where("status", "==", "pending"), orderBy("timestamp", "desc"));

    onSnapshot(pendingStudentsQuery, (querySnapshot) => {
        pendingStudentsList.innerHTML = '';
        if (querySnapshot.empty) {
            pendingStudentsList.innerHTML = `<p class="text-center text-gray-500 mt-8">No students are currently awaiting approval.</p>`;
        } else {
            querySnapshot.forEach(studentDoc => {
                const studentData = studentDoc.data();
                const studentId = studentDoc.id;
                const timestamp = studentData.timestamp ? studentData.timestamp.toDate().toLocaleString() : 'N/A';
                
                pendingStudentsList.innerHTML += `
                    <div class="bg-gray-100 p-4 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div>
                            <h3 class="text-lg font-semibold">${studentData.name}</h3>
                            <p class="text-sm text-gray-600">Tutor: ${studentData.tutorName} | Class: ${studentData.class} | Subject: ${studentData.subject}</p>
                            <p class="text-xs text-gray-500">Requested on: ${timestamp}</p>
                        </div>
                        <div class="mt-4 sm:mt-0 flex space-x-2">
                            <button class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 approve-btn" data-student-id="${studentId}">Approve</button>
                            <button class="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 edit-btn" data-student-id="${studentId}">Edit</button>
                            <button class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 reject-btn" data-student-id="${studentId}">Reject</button>
                        </div>
                    </div>
                `;
            });

            document.querySelectorAll('.approve-btn').forEach(btn => {
                btn.addEventListener('click', (e) => handleStudentApproval(e.target.dataset.studentId, 'approved'));
            });
            document.querySelectorAll('.edit-btn').forEach(btn => {
                btn.addEventListener('click', (e) => handleStudentEdit(e.target.dataset.studentId));
            });
            document.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', (e) => handleStudentApproval(e.target.dataset.studentId, 'rejected'));
            });
        }
    });
}

async function handleStudentApproval(studentId, status) {
    if (confirm(`Are you sure you want to ${status} this student?`)) {
        const studentDocRef = doc(db, "students", studentId);
        try {
            if (status === 'approved') {
                await updateDoc(studentDocRef, { status: 'approved' });
                alert("Student approved successfully.");
            } else if (status === 'rejected') {
                await deleteDoc(studentDocRef);
                alert("Student rejected successfully.");
            }
        } catch (error) {
            console.error(`Error ${status} student:`, error);
            alert(`An error occurred while trying to ${status} the student.`);
        }
    }
}

async function handleStudentEdit(studentId) {
    const studentDocRef = doc(db, "students", studentId);
    try {
        const studentSnap = await getDoc(studentDocRef);
        if (!studentSnap.exists()) {
            alert("Student not found.");
            return;
        }
        const studentData = studentSnap.data();
        const newName = prompt("Edit student's name:", studentData.name);
        const newClass = prompt("Edit student's class:", studentData.class);
        const newSubject = prompt("Edit student's subject:", studentData.subject);
        const newFee = prompt("Edit student's fee:", studentData.fee);

        if (newName && newClass && newSubject && newFee) {
            await updateDoc(studentDocRef, {
                name: capitalize(newName),
                class: newClass.toUpperCase(),
                subject: capitalize(newSubject),
                fee: parseFloat(newFee),
            });
            alert("Student updated successfully!");
        }
    } catch (error) {
        console.error("Error editing student:", error);
        alert("An error occurred while editing the student.");
    }
}


async function renderPayAdvice(container, staffPermissions) {
    // ... (rest of the function, no changes needed here)
}

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('mainContent');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        const staffDocSnap = await getDoc(staffDocRef);

        if (staffDocSnap.exists() && staffDocSnap.data().status === 'approved') {
            const staffData = staffDocSnap.data();
            const staffPermissions = staffData.permissions || {};
            const navContainer = document.getElementById('nav-container');

            const allNavItems = {
                navTutorManagement: {
                    text: 'Tutor & Student List',
                    fn: () => renderManagementTutorView(mainContent, staffPermissions),
                    permission: staffPermissions?.canManageTutors || false
                },
                navPayAdvice: {
                    text: 'Pay Advice',
                    fn: () => renderPayAdvice(mainContent, staffPermissions),
                    permission: staffPermissions?.canManagePayAdvice || false
                },
                navStudentApprovals: {
                    text: 'Pending Approvals',
                    fn: () => renderPendingApprovals(mainContent, staffPermissions),
                    permission: staffPermissions?.actions?.canManageStudentApprovals || false
                },
                navTutorReports: {
                    text: 'Tutor Reports',
                    fn: () => renderTutorReportsView(mainContent, staffPermissions),
                    permission: staffPermissions?.canViewTutorReports || false
                }
            };

            let firstVisibleTab = null;
            navContainer.innerHTML = '';
            Object.entries(allNavItems).forEach(([id, item]) => {
                if (item.permission) {
                    const button = document.createElement('button');
                    button.id = id;
                    button.classList.add('nav-btn', 'text-lg', 'font-bold', 'text-gray-500', 'hover:text-white', 'sm:text-white');
                    button.textContent = item.text;
                    navContainer.appendChild(button);

                    if (!firstVisibleTab) {
                        firstVisibleTab = id;
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

            logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));

        } else {
            document.getElementById('welcome-message').textContent = `Hello, ${staffData.name}`;
            document.getElementById('user-role').textContent = 'Status: Pending Approval';
            mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval.</p>`;
            logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
        }
    } else {
        window.location.href = "management-auth.html";
    }
});