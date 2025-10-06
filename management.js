// [Begin Updated management.js File]

import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy, Timestamp, writeBatch, updateDoc, deleteDoc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ##################################
// # SESSION CACHE & STATE (NOW PERSISTENT)
// ##################################

const CACHE_PREFIX = 'management_cache_';
// The in-memory cache that will be populated from localStorage on load.
const sessionCache = {
    tutors: null,
    students: null,
    pendingStudents: null,
    reports: null,
    breakStudents: null,
};
/**
 * Saves a specific piece of data to localStorage.
 * @param {string} key The key for the cache (e.g., 'tutors').
 * @param {any} data The data to store.
 */
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
        sessionCache[key] = data; // Also update the in-memory cache
    } catch (error) {
        console.error("Could not save to localStorage:", error);
    }
}

/**
 * Loads all cached data from localStorage into the sessionCache object.
 */
function loadFromLocalStorage() {
    for (const key in sessionCache) {
        try {
            const storedData = localStorage.getItem(CACHE_PREFIX + key);
            if (storedData) {
                sessionCache[key] = JSON.parse(storedData);
            }
        } catch (error) {
            console.error(`Could not load '${key}' from localStorage:`, error);
            localStorage.removeItem(CACHE_PREFIX + key); // Clear corrupted data
        }
    }
}

/**
 * Invalidates (clears) a specific cache from memory and localStorage.
 * @param {string} key The key of the cache to clear.
 */
function invalidateCache(key) {
    sessionCache[key] = null;
    localStorage.removeItem(CACHE_PREFIX + key);
}


// Load any persisted data as soon as the script runs
loadFromLocalStorage();
// Session-level state for the Pay Advice gift feature.
let payAdviceGifts = {};
let currentPayData = [];
// Utility function to capitalize strings
function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// ### UPDATED FUNCTION ###
// Utility function to convert data to CSV, now includes gift and final pay details
function convertPayAdviceToCSV(data) {
    const header = [
        'Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Total Pay (₦)',
        'Gift (₦)', 'Final Pay (₦)', 'Beneficiary Bank', 'Beneficiary Account', 'Beneficiary Name'
    ];
    const rows = data.map(item => {
        const giftAmount = payAdviceGifts[item.tutorEmail] || 0;
        const finalPay = item.totalPay + giftAmount;
        return [
            `"${item.tutorName}"`,
            item.studentCount,
            item.totalStudentFees,
            item.managementFee,
            item.totalPay,
            giftAmount,
            finalPay,
            `"${item.beneficiaryBank || 'N/A'}"`,
            `"${item.beneficiaryAccount || 'N/A'}"`,
            `"${item.beneficiaryName || 'N/A'}"`
        ];
    });
    return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
}


// ##################################
// # ACTION HANDLER FUNCTIONS
// ##################################

// --- NEW FEATURE: Standalone Quick Assign Tutor to NEW Student ---
async function showQuickAssignStudentModal() {
    // Attempt to use cached tutors, force fetch if not available
    const tutors = sessionCache.tutors || (await fetchAndRenderDirectory(true, false)); 
    if (!tutors) {
        alert("Could not load tutor list. Please refresh the page.");
        return;
    }

    const tutorOptions = tutors
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(tutor => `<option value="${tutor.email}">${tutor.name} (${tutor.email})</option>`).join('');

    const modalHtml = `
        <div id="quick-assign-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-full max-w-2xl rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('quick-assign-modal').remove()">&times;</button>
                <h3 class="text-2xl font-bold mb-6 text-indigo-700">Quick Assign New Student</h3>
                <form id="quick-assign-form" class="grid grid-cols-2 gap-4">
                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-sm font-medium mb-1">Student Name*</label>
                        <input type="text" id="assign-studentName" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>
                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-sm font-medium mb-1">Select Tutor*</label>
                        <select id="assign-tutor-select" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                            <option value="">-- Select Tutor to Assign --</option>
                            ${tutorOptions}
                        </select>
                    </div>

                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-sm font-medium mb-1">Student Grade</label>
                        <input type="text" id="assign-grade" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>
                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-sm font-medium mb-1">Days/Week</label>
                        <input type="text" id="assign-days" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>

                    <div class="col-span-2">
                        <label class="block text-sm font-medium mb-1">Subjects (comma-separated)</label>
                        <input type="text" id="assign-subjects" placeholder="Maths, English, etc." class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>

                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-sm font-medium mb-1">Parent Name</label>
                        <input type="text" id="assign-parentName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>
                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-sm font-medium mb-1">Parent Phone</label>
                        <input type="text" id="assign-parentPhone" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>
                    
                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-sm font-medium mb-1">Student Fee (₦)*</label>
                        <input type="number" id="assign-studentFee" required value="0" min="0" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>

                    <div class="col-span-2 flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('quick-assign-modal').remove()" class="mr-2 px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold">Assign & Save Student</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('quick-assign-form').addEventListener('submit', handleQuickAssignSubmission);
}

async function handleQuickAssignSubmission(e) {
    e.preventDefault();
    const form = e.target;
    
    const newStudentData = {
        studentName: form.elements['assign-studentName'].value,
        tutorEmail: form.elements['assign-tutor-select'].value,
        grade: form.elements['assign-grade'].value,
        days: form.elements['assign-days'].value,
        subjects: form.elements['assign-subjects'].value.split(',').map(s => s.trim()).filter(s => s),
        parentName: form.elements['assign-parentName'].value,
        parentPhone: form.elements['assign-parentPhone'].value,
        studentFee: Number(form.elements['assign-studentFee'].value) || 0,
        status: 'approved', // Directly approved by management
        assignedBy: window.userData?.email || 'management_admin',
        assignedAt: Timestamp.now()
    };
    
    try {
        const studentsCollection = collection(db, "students");
        // Use addDoc to create a new document with an auto-generated ID
        await addDoc(studentsCollection, newStudentData);
        
        alert(`Student "${newStudentData.studentName}" successfully created and assigned to tutor.`);
        document.getElementById('quick-assign-modal').remove();
        
        // Clear cache and re-render the directory to show the new student
        invalidateCache('students');
        renderManagementTutorView(document.getElementById('main-content'));

    } catch (error) {
        console.error("Error creating and assigning new student: ", error);
        alert("Failed to assign new student. Check the console for details.");
    }
}
// --- END NEW FEATURE ---

// --- EXISTING FEATURE: Re-Assigning an existing student (from table row button) ---
async function handleAssignStudent(studentId) {
    try {
        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (!studentDoc.exists()) {
            alert("Student not found!");
            return;
        }
        const studentData = studentDoc.data();
        // Rely on cached tutors, which are loaded/refreshed with the directory view
        const tutors = sessionCache.tutors || []; 
        showAssignTutorModal(studentId, studentData, tutors);
    } catch (error) {
        console.error("Error fetching student for assignment: ", error);
        alert("Error fetching student data. Check the console for details.");
    }
}

function showAssignTutorModal(studentId, studentData, tutors) {
    const tutorOptions = tutors
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(tutor => {
            const selected = tutor.email === studentData.tutorEmail ? 'selected' : '';
            return `<option value="${tutor.email}" ${selected}>${tutor.name} (${tutor.email})</option>`;
        }).join('');

    const modalHtml = `
        <div id="assign-tutor-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('assign-tutor-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">Assign Tutor to ${studentData.studentName}</h3>
                <form id="assign-tutor-form">
                    <input type="hidden" id="assign-student-id" value="${studentId}">
                    <div class="mb-4">
                        <label class="block text-sm font-medium mb-1">Select New Tutor</label>
                        <select id="tutor-select" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                            <option value="">-- Select a Tutor --</option>
                            ${tutorOptions}
                        </select>
                    </div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('assign-tutor-modal').remove()" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Assign Student</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('assign-tutor-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const assignedId = form.elements['assign-student-id'].value;
        const newTutorEmail = form.elements['tutor-select'].value;
        
        if (!newTutorEmail) {
            alert("Please select a tutor.");
            return;
        }

        try {
            await updateDoc(doc(db, "students", assignedId), {
                tutorEmail: newTutorEmail
            });
            alert(`${studentData.studentName} successfully assigned to new tutor.`);
            document.getElementById('assign-tutor-modal').remove();
            invalidateCache('students');
            // Re-render the directory to reflect the change
            renderManagementTutorView(document.getElementById('main-content'));
        } catch (error) {
            console.error("Error assigning tutor: ", error);
            alert("Failed to assign tutor. Check the console for details.");
        }
    });
}
// --- END EXISTING FEATURE ---


async function handleEditStudent(studentId) {
    try {
        const studentDoc = await getDoc(doc(db, "students", studentId));
        if (!studentDoc.exists()) {
            alert("Student not found!");
            return;
        }
        const studentData = studentDoc.data();
        showEditStudentModal(studentId, studentData, "students");
    } catch (error) {
        console.error("Error fetching student for edit: ", error);
        alert("Error fetching student data. Check the console for details.");
    }
}

async function handleEditPendingStudent(studentId) {
    try {
        const studentDoc = await getDoc(doc(db, "pending_students", studentId));
        if (!studentDoc.exists()) {
            alert("Pending student not found!");
            return;
        }
        const studentData = studentDoc.data();
        showEditStudentModal(studentId, studentData, "pending_students");
    } catch (error) {
        console.error("Error fetching pending student for edit: ", error);
        alert("Error fetching student data. Check the console for details.");
    }
}

function showEditStudentModal(studentId, studentData, collectionName) {
    const modalHtml = `
        <div id="edit-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('edit-modal').remove()">&times;</button>
                <h3 
class="text-xl font-bold mb-4">Edit Student Details</h3>
                <form id="edit-student-form">
                    <input type="hidden" id="edit-student-id" value="${studentId}">
                    <input type="hidden" id="edit-collection-name" value="${collectionName}">
                    <div class="mb-2"><label class="block text-sm font-medium">Student Name</label><input type="text" id="edit-studentName" value="${studentData.studentName}" class="mt-1 block w-full rounded-md 
border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Grade</label><input type="text" id="edit-grade" value="${studentData.grade}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Days/Week</label><input type="text" id="edit-days" value="${studentData.days}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Subjects (comma-separated)</label><input type="text" id="edit-subjects" value="${studentData.subjects 
? studentData.subjects.join(', ') : ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Name</label><input type="text" id="edit-parentName" value="${studentData.parentName ||
''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Phone</label><input type="text" id="edit-parentPhone" value="${studentData.parentPhone ||
''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Fee (₦)</label><input type="number" id="edit-studentFee" value="${studentData.studentFee ||
0}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('edit-modal').remove()" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Save Changes</button>
     
                </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('edit-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const editedId = form.elements['edit-student-id'].value;
  
        const targetCollection = form.elements['edit-collection-name'].value;
        const updatedData = {
            studentName: form.elements['edit-studentName'].value,
            grade: form.elements['edit-grade'].value,
            days: form.elements['edit-days'].value,
            subjects: form.elements['edit-subjects'].value.split(',').map(s => s.trim()).filter(s => s),
            parentName: form.elements['edit-parentName'].value,
           
            parentPhone: form.elements['edit-parentPhone'].value,
            studentFee: Number(form.elements['edit-studentFee'].value) ||
0,
        };
        try {
            await updateDoc(doc(db, targetCollection, editedId), updatedData);
            alert("Student details updated successfully!");
            document.getElementById('edit-modal').remove();
            // Invalidate cache and re-render the relevant view
            if (targetCollection === 'students') {
                invalidateCache('students');
                renderManagementTutorView(document.getElementById('main-content'));
            } else {
                invalidateCache('pendingStudents');
                renderPendingApprovalsPanel(document.getElementById('main-content'));
            }
        } catch (error) {
            console.error("Error updating document: ", error);
            alert("Failed to save changes. Check the console for details.");
        }
    });
}

async function handleDeleteStudent(studentId) {
    if (confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, "students", studentId));
            alert("Student deleted successfully!");
            invalidateCache('students'); // Invalidate cache
            renderManagementTutorView(document.getElementById('main-content'));
        // Rerender
        } catch (error) {
            console.error("Error removing student: ", error);
            alert("Error deleting student. Check the console for details.");
        }
    }
}

async function handleApproveStudent(studentId) {
    if (confirm("Are you sure you want to approve this student?")) {
        try {
            const studentRef = doc(db, "pending_students", studentId);
            const studentDoc = await getDoc(studentRef);
            if (!studentDoc.exists()) {
                alert("Student not found.");
                return;
            }
            const studentData = studentDoc.data();
            const batch = writeBatch(db);
            const newStudentRef = doc(db, "students", studentId);
            batch.set(newStudentRef, { ...studentData, status: 'approved' });
            batch.delete(studentRef);
            await batch.commit();
            alert("Student approved successfully!");
            invalidateCache('pendingStudents'); // Invalidate cache
            invalidateCache('students');
            fetchAndRenderPendingApprovals();
        // Re-fetch and render the current panel
        } catch (error) {
            console.error("Error approving student: ", error);
            alert("Error approving student. Check the console for details.");
        }
    }
}

async function handleRejectStudent(studentId) {
    if (confirm("Are you sure you want to reject this student? This will delete their entry.")) {
        try {
            await deleteDoc(doc(db, "pending_students", studentId));
            alert("Student rejected successfully!");
            invalidateCache('pendingStudents'); // Invalidate cache
            fetchAndRenderPendingApprovals();
        // Re-fetch and render
        } catch (error) {
            console.error("Error rejecting student: ", error);
            alert("Error rejecting student. Check the console for details.");
        }
    }
}


// ##################################
// # PANEL RENDERING FUNCTIONS
// ##################################

// --- Tutor & Student Directory Panel ---
async function renderManagementTutorView(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor & Student Directory</h2>
              
                <div class="flex items-center gap-4">
                    <input type="search" id="directory-search" placeholder="Search Tutors, Students, Parents..." class="p-2 border rounded-md w-64">
                    <button id="refresh-directory-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                </div>
            </div>
          
            <div class="flex space-x-4 mb-4">
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">Total Tutors</h4>
                    <p id="tutor-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
          
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Total Students</h4>
                    <p id="student-count-badge" class="text-2xl font-extrabold">0</p>
                </div>
            </div>
            
            <div class="mb-6">
                <button id="quick-assign-student-btn" class="bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-indigo-700 font-bold w-full text-center">
                    + QUICK ASSIGN NEW STUDENT
                </button>
            </div>
            <div 
id="directory-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading directory...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-directory-btn').addEventListener('click', () => fetchAndRenderDirectory(true));
    document.getElementById('directory-search').addEventListener('input', (e) => renderDirectoryFromCache(e.target.value));
    document.getElementById('quick-assign-student-btn').addEventListener('click', showQuickAssignStudentModal); // Listener for new feature
    
    fetchAndRenderDirectory();
}

async function fetchAndRenderDirectory(forceRefresh = false, shouldRender = true) {
    if (forceRefresh) {
        invalidateCache('tutors');
        invalidateCache('students');
    }

    try {
        let tutorsData = sessionCache.tutors;
        let studentsData = sessionCache.students;

        if (!tutorsData || !studentsData) {
            if (shouldRender) document.getElementById('directory-list').innerHTML = `<p class="text-center text-gray-500 py-10">Fetching data from server...</p>`;
            
            const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
                getDocs(query(collection(db, "tutors"), orderBy("name"))),
                getDocs(collection(db, "students"))
            ]);
            
            tutorsData = tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            studentsData = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Save newly fetched data to localStorage
            saveToLocalStorage('tutors', tutorsData);
            saveToLocalStorage('students', studentsData);
        }
        
        if (shouldRender) {
            renderDirectoryFromCache();
        } else {
            return tutorsData; // Return data if we are not rendering (e.g., for the Quick Assign modal)
        }

    } catch (error) {
        console.error("Error fetching directory data:", error);
        if (shouldRender) document.getElementById('directory-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderDirectoryFromCache(searchTerm = '') {
    const tutors = sessionCache.tutors ||
[];
    const students = sessionCache.students || [];
    const directoryList = document.getElementById('directory-list');
    if (!directoryList) return;
    if (tutors.length === 0 && students.length === 0) {
        directoryList.innerHTML = `<p class="text-center text-gray-500 py-10">No directory data found.
Click Refresh to fetch from the server.</p>`;
        return;
    }

    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const studentsByTutor = {};
    students.forEach(student => {
        if (!studentsByTutor[student.tutorEmail]) {
            studentsByTutor[student.tutorEmail] = [];
        }
        studentsByTutor[student.tutorEmail].push(student);
    });
    
    // --- UPDATED/VERIFIED GENERAL SEARCH LOGIC ---
    const filteredTutors = tutors.filter(tutor => {
        const assignedStudents = studentsByTutor[tutor.email] || [];
        // Check tutor name or email
        const tutorMatch = tutor.name.toLowerCase().includes(lowerCaseSearchTerm) || 
                           tutor.email.toLowerCase().includes(lowerCaseSearchTerm);
        
        // Check student name, parent name, or parent phone (This section is robust for parent phone search)
        const studentMatch = assignedStudents.some(s => 
            s.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
            (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (s.parentPhone && s.parentPhone.toLowerCase().includes(lowerCaseSearchTerm)) 
        );
        return tutorMatch || studentMatch;
    });
    // --- END UPDATED/VERIFIED GENERAL SEARCH LOGIC ---

    if (filteredTutors.length === 0) {
        directoryList.innerHTML = `<p class="text-center text-gray-500 py-10">No results found for "${searchTerm}".</p>`;
        return;
    }

    document.getElementById('tutor-count-badge').textContent = tutors.length;
    document.getElementById('student-count-badge').textContent = students.length;

    const canEditStudents = window.userData.permissions?.actions?.canEditStudents === true;
    const canDeleteStudents = window.userData.permissions?.actions?.canDeleteStudents === true;
    const showActionsColumn = true; // Always show actions column for Assign feature

    directoryList.innerHTML = filteredTutors.map(tutor => {
        const assignedStudents = (studentsByTutor[tutor.email] || [])
            .filter(s => 
                searchTerm === '' || // show all students if no search term
                tutor.name.toLowerCase().includes(lowerCaseSearchTerm) || 
                tutor.email.toLowerCase().includes(lowerCaseSearchTerm) || 
                s.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
                (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (s.parentPhone && s.parentPhone.toLowerCase().includes(lowerCaseSearchTerm)) // Search by Parent Phone is active here
            );

        const studentsTableRows = assignedStudents
            .sort((a, b) => a.studentName.localeCompare(b.studentName))
            .map(student => {
                const subjects = student.subjects && Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
     
                // --- ACTION BUTTONS WITH ASSIGN FEATURE ---
                const actionButtons = `
                    <button class="assign-tutor-btn bg-purple-600 text-white px-3 py-1 rounded-full text-xs mr-1" data-student-id="${student.id}">Assign</button>
                    ${canEditStudents ? `<button class="edit-student-btn bg-blue-500 text-white px-3 py-1 rounded-full text-xs mr-1" data-student-id="${student.id}">Edit</button>` : ''}
                    ${canDeleteStudents ?
`<button class="delete-student-btn bg-red-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Delete</button>` : ''}
                `;
                // --- END UPDATED ACTION BUTTONS ---

                return `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-2 font-medium">${student.studentName}</td>
                        <td class="px-4 py-2">₦${(student.studentFee || 0).toFixed(2)}</td>
                       
                        <td class="px-4 py-2">${student.grade}</td>
                        <td class="px-4 py-2">${student.days}</td>
                        <td class="px-4 py-2">${subjects}</td>
                        <td class="px-4 py-2">${student.parentName ||
'N/A'}</td>
                        <td class="px-4 py-2">${student.parentPhone ||
'N/A'}</td>
                        ${showActionsColumn ?
`<td class="px-4 py-2">${actionButtons}</td>` : ''}
                    </tr>
                `;
            }).join('');

        return `
            <div class="border rounded-lg shadow-sm">
                <details open>
                    <summary class="p-4 cursor-pointer flex justify-between items-center font-semibold text-lg">
                        ${tutor.name}
               
                        <span class="ml-2 text-sm font-normal text-gray-500">(${assignedStudents.length} students shown)</span>
                    </summary>
                    <div class="border-t p-2">
                        <table class="min-w-full text-sm">
                 
                            <thead class="bg-gray-50 text-left"><tr>
                                <th class="px-4 py-2 font-medium">Student Name</th><th class="px-4 py-2 font-medium">Fee</th>
                                <th class="px-4 py-2 font-medium">Grade</th><th class="px-4 py-2 font-medium">Days/Week</th>
          
                                <th class="px-4 py-2 font-medium">Subject</th><th class="px-4 py-2 font-medium">Parent's Name</th>
                                <th class="px-4 py-2 font-medium">Parent's Phone</th>
                                ${showActionsColumn ?
`<th class="px-4 py-2 font-medium">Actions</th>` : ''}
                            </tr></thead>
                            <tbody class="bg-white divide-y divide-gray-200">${studentsTableRows}</tbody>
                        </table>
            
                    </div>
                </details>
            </div>
        `;
    }).join('');

    // Event Listeners for existing Assign/Edit/Delete Buttons
    document.querySelectorAll('.assign-tutor-btn').forEach(button => button.addEventListener('click', () => handleAssignStudent(button.dataset.studentId)));
    
    if (canEditStudents) {
        document.querySelectorAll('.edit-student-btn').forEach(button => button.addEventListener('click', () => handleEditStudent(button.dataset.studentId)));
    }
    if (canDeleteStudents) {
        document.querySelectorAll('.delete-student-btn').forEach(button => button.addEventListener('click', () => handleDeleteStudent(button.dataset.studentId)));
    }
}


// --- Pay Advice Panel ---
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
                    <input 
type="date" id="end-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="flex items-center space-x-4 col-span-2">
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full"><h4 class="font-bold text-green-800 text-sm">Active Tutors</h4><p id="pay-tutor-count" class="text-2xl font-extrabold">0</p></div>
                    <div class="bg-yellow-100 p-3 rounded-lg 
text-center shadow w-full"><h4 class="font-bold text-yellow-800 text-sm">Total Students</h4><p id="pay-student-count" class="text-2xl font-extrabold">0</p></div>
                    ${canExport ?
`<button id="export-pay-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 h-full">Export CSV</button>` : ''}
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
        
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Tutor</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Students</th>
                
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Fees</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Mgmt.
Fee</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Total Pay</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Gift (₦)</th>
                            <th class="px-6 
py-3 text-left text-xs font-medium uppercase">Final Pay</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Actions</th>
                        </tr>
                    </thead>
                 
                    <tbody id="pay-advice-table-body" class="divide-y"><tr><td colspan="8" class="text-center py-4">Select a date range.</td></tr></tbody>
                </table>
            </div>
        </div>
    `;
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const handleDateChange = () => {
        const startDate = startDateInput.value ?
new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
        if (startDate && endDate) {
            payAdviceGifts = {};
// Reset gifts on new date range
            currentPayData = [];
// Reset data
            endDate.setHours(23, 59, 59, 999);
            loadPayAdviceData(startDate, endDate);
        }
    };
    startDateInput.addEventListener('change', handleDateChange);
    endDateInput.addEventListener('change', handleDateChange);

    const exportBtn = document.getElementById('export-pay-csv-btn');
    if (exportBtn) {
        exportBtn.onclick = () => {
            const csv = convertPayAdviceToCSV(currentPayData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const start = document.getElementById('start-date').value;
            const end = document.getElementById('end-date').value;
            link.href = URL.createObjectURL(blob);
            link.download = `Pay_Advice_${start}_to_${end}.csv`;
            link.click();
        };
    }
}

async function loadPayAdviceData(startDate, endDate) {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">Loading pay data...</td></tr>`;

    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    const reportsQuery = query(collection(db, "tutor_submissions"), where("submittedAt", ">=", startTimestamp), where("submittedAt", "<=", endTimestamp));
    try {
        const reportsSnapshot = await getDocs(reportsQuery);
        const activeTutorEmails = [...new Set(reportsSnapshot.docs.map(doc => doc.data().tutorEmail))];

        if (activeTutorEmails.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">No active tutors in this period.</td></tr>`;
            document.getElementById('pay-tutor-count').textContent = 0;
            document.getElementById('pay-student-count').textContent = 0;
            currentPayData = [];
            return;
        }

        const tutorBankDetails = {};
        reportsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.beneficiaryBank && data.beneficiaryAccount) {
                tutorBankDetails[data.tutorEmail] = {
                    beneficiaryBank: data.beneficiaryBank,
                    beneficiaryAccount: data.beneficiaryAccount,
       
                    beneficiaryName: data.beneficiaryName || 'N/A',
                };
            }
        });
        // ### FIXED SECTION ###
        // Firestore 'in' queries are limited to 30 values.
        // This function fetches tutors by chunking the email list.
        const fetchTutorsInChunks = async (emails) => {
            if (emails.length === 0) return [];
            const chunks = [];
            for (let i = 0; i < emails.length; i += 30) {
                chunks.push(emails.slice(i, i + 30));
            }

            const queryPromises = chunks.map(chunk =>
                getDocs(query(collection(db, "tutors"), where("email", "in", chunk)))
            );
            const querySnapshots = await Promise.all(queryPromises);
            // Combine the docs from all snapshot results into a single array
            return querySnapshots.flatMap(snapshot => snapshot.docs);
        };

        // Fetch both tutors (in chunks) and all students concurrently.
        const [tutorDocs, studentsSnapshot] = await Promise.all([
            fetchTutorsInChunks(activeTutorEmails),
            getDocs(collection(db, "students"))
        ]);
        // ### END FIXED SECTION ###

        const allStudents = studentsSnapshot.docs.map(doc => doc.data());
        let totalStudentCount = 0;
        const payData = [];
        
        // Iterate over the combined array of tutor documents
        tutorDocs.forEach(doc => {
            const tutor = doc.data();
            const assignedStudents = allStudents.filter(s => s.tutorEmail === tutor.email);
            const totalStudentFees = assignedStudents.reduce((sum, s) => sum + (s.studentFee || 0), 0);
            const managementFee = (tutor.isManagementStaff && 
tutor.managementFee) ? tutor.managementFee : 0;
            totalStudentCount += assignedStudents.length;
            const bankDetails = tutorBankDetails[tutor.email] || { beneficiaryBank: 'N/A', beneficiaryAccount: 'N/A', beneficiaryName: 'N/A' };

            payData.push({
                tutorName: tutor.name,
                tutorEmail: tutor.email,
            
                studentCount: assignedStudents.length,
                totalStudentFees: totalStudentFees,
                managementFee: managementFee,
                totalPay: totalStudentFees + managementFee,
                ...bankDetails
            });
        });
        currentPayData = payData; // Store for reuse
        document.getElementById('pay-tutor-count').textContent = payData.length;
        document.getElementById('pay-student-count').textContent = totalStudentCount;
        renderPayAdviceTable();

    } catch (error) {
        console.error("Error loading pay advice data:", error);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Failed to load data.</td></tr>`;
    }
}

function renderPayAdviceTable() {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = currentPayData.map(d => {
        const giftAmount = payAdviceGifts[d.tutorEmail] || 0;
        const finalPay = d.totalPay + giftAmount;
        return `
            <tr>
                <td class="px-6 py-4">${d.tutorName}</td>
                <td class="px-6 py-4">${d.studentCount}</td>
          
                <td class="px-6 py-4">₦${d.totalStudentFees.toFixed(2)}</td>
                <td class="px-6 py-4">₦${d.managementFee.toFixed(2)}</td>
                <td class="px-6 py-4">₦${d.totalPay.toFixed(2)}</td>
                <td class="px-6 py-4 text-blue-600 font-bold">₦${giftAmount.toFixed(2)}</td>
                <td class="px-6 py-4 font-bold">₦${finalPay.toFixed(2)}</td>
                <td 
class="px-6 py-4">
                    <button class="add-gift-btn bg-blue-500 text-white px-3 py-1 rounded text-xs" data-tutor-email="${d.tutorEmail}">Add Gift</button>
                </td>
            </tr>
        `;
    }).join('');
    document.querySelectorAll('.add-gift-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const tutorEmail = e.target.dataset.tutorEmail;
            const currentGift = payAdviceGifts[tutorEmail] || 0;
            const giftInput = prompt(`Enter gift amount for this tutor:`, currentGift);
            if (giftInput !== null) {
                const giftAmount 
= parseFloat(giftInput);
                if (!isNaN(giftAmount) && giftAmount >= 0) {
                    payAdviceGifts[tutorEmail] = giftAmount;
                    renderPayAdviceTable(); // Re-render the table with the new gift
                } else {
         
                    alert("Please enter a valid, non-negative number.");
                }
            }
        });
    });
}


// --- Tutor Reports Panel ---
async function renderTutorReportsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor Reports</h2>
                <button id="refresh-reports-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            
</div>
            <div class="flex space-x-4 mb-4">
                <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-green-800 text-sm">Unique Tutors Submitted</h4>
                    <p id="report-tutor-count" class="text-2xl font-extrabold">0</p>
               
</div>
                <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full">
                    <h4 class="font-bold text-yellow-800 text-sm">Total Reports Submitted</h4>
                    <p id="report-total-count" class="text-2xl font-extrabold">0</p>
                </div>
            </div>
 
            <div id="tutor-reports-list" class="space-y-4"><p class="text-center">Loading reports...</p></div>
        </div>
    `;
    document.getElementById('refresh-reports-btn').addEventListener('click', () => fetchAndRenderTutorReports(true));
    fetchAndRenderTutorReports();
}

async function fetchAndRenderTutorReports(forceRefresh = false) {
    if (forceRefresh) invalidateCache('reports');
    const reportsListContainer = document.getElementById('tutor-reports-list');
    
    try {
        if (!sessionCache.reports) {
            reportsListContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching reports from server...</p>`;
            const snapshot = await getDocs(query(collection(db, "tutor_submissions"), orderBy("submittedAt", "desc")));
            saveToLocalStorage('reports', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderTutorReportsFromCache();
    } catch(error) {
        console.error("Error fetching reports:", error);
        reportsListContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load reports.</p>`;
    }
}

function renderTutorReportsFromCache() {
    const reports = sessionCache.reports || [];
    const reportsListContainer = document.getElementById('tutor-reports-list');
    if (!reportsListContainer) return;
    if (reports.length === 0) {
        reportsListContainer.innerHTML = `<p class="text-center text-gray-500">No reports found. Click Refresh to fetch from server.</p>`;
        return;
    }

    const reportsByTutor = {};
    reports.forEach(report => {
        if (!reportsByTutor[report.tutorEmail]) {
            reportsByTutor[report.tutorEmail] = {
                name: report.tutorName || report.tutorEmail,
                reports: []
            };
        }
        reportsByTutor[report.tutorEmail].reports.push(report);
    });

    document.getElementById('report-tutor-count').textContent = Object.keys(reportsByTutor).length;
    document.getElementById('report-total-count').textContent = reports.length;
    const canDownload = window.userData.permissions?.actions?.canDownloadReports === true;

    reportsListContainer.innerHTML = Object.values(reportsByTutor).map(tutorData => {
        const reportLinks = tutorData.reports.map(report => {
            const buttonHTML = canDownload ? `<button class="download-report-btn bg-green-500 text-white px-3 py-1 text-sm rounded" data-report-id="${report.id}">Download</button>` : `<button class="view-report-btn bg-gray-500 text-white px-3 py-1 text-sm rounded" data-report-id="${report.id}">View</button>`;
            return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">${report.studentName}<span>${buttonHTML}</span></li>`;
        }).join('');
        const zipButtonHTML = canDownload ? `<div class="p-4 border-t"><button class="zip-reports-btn bg-blue-600 text-white px-4 py-2 text-sm rounded w-full hover:bg-blue-700" data-tutor-email="${tutorData.reports[0].tutorEmail}">Zip & Download All Reports</button></div>` : '';

        return `<details class="border rounded-lg">
            <summary class="p-4 cursor-pointer font-semibold">${tutorData.name} (${tutorData.reports.length} reports)</summary>
            <div class="p-4 border-t"><ul class="space-y-2">${reportLinks}</ul></div>
            ${zipButtonHTML}
        </details>`;
    }).join('');

    document.querySelectorAll('.download-report-btn').forEach(button => button.addEventListener('click', (e) => {
        e.stopPropagation();
        viewReportInNewTab(e.target.dataset.reportId, true);
    }));
    document.querySelectorAll('.view-report-btn').forEach(button => button.addEventListener('click', (e) => {
        e.stopPropagation();
        viewReportInNewTab(e.target.dataset.reportId, false);
    }));
    document.querySelectorAll('.zip-reports-btn').forEach(button => button.addEventListener('click', async (e) => {
        e.stopPropagation();
        const tutorEmail = e.target.dataset.tutorEmail;
        const tutorData = reportsByTutor[tutorEmail];
        if (tutorData) await zipAndDownloadTutorReports(tutorData.reports, tutorData.name, e.target);
    }));
}


// --- Pending Approvals Panel ---
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Pending Approvals</h2>
                <button id="refresh-pending-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div id="pending-approvals-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pending students...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-pending-btn').addEventListener('click', () => fetchAndRenderPendingApprovals(true));
    fetchAndRenderPendingApprovals();
}

async function fetchAndRenderPendingApprovals(forceRefresh = false) {
    if (forceRefresh) invalidateCache('pendingStudents');
    const listContainer = document.getElementById('pending-approvals-list');

    try {
        if (!sessionCache.pendingStudents) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching pending students...</p>`;
            const snapshot = await getDocs(query(collection(db, "pending_students")));
            saveToLocalStorage('pendingStudents', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderPendingApprovalsFromCache();
    } catch(error) {
        console.error("Error fetching pending students:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderPendingApprovalsFromCache() {
    const pendingStudents = sessionCache.pendingStudents || [];
    const listContainer = document.getElementById('pending-approvals-list');
    if (!listContainer) return;
    if (pendingStudents.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500">No students are awaiting approval.</p>`;
        return;
    }

    listContainer.innerHTML = pendingStudents.map(student => `
        <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50">
            <div>
                <p><strong>Student:</strong> ${student.studentName}</p>
                <p><strong>Fee:</strong> ₦${(student.studentFee || 0).toFixed(2)}</p>
                <p><strong>Submitted by Tutor:</strong> ${student.tutorEmail || 'N/A'}</p>
            </div>
            <div class="flex items-center space-x-2">
                <button class="edit-pending-btn bg-blue-500 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Edit</button>
                <button class="approve-btn bg-green-600 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Approve</button>
                <button class="reject-btn bg-red-600 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">Reject</button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.edit-pending-btn').forEach(button => button.addEventListener('click', () => handleEditPendingStudent(button.dataset.studentId)));
    document.querySelectorAll('.approve-btn').forEach(button => button.addEventListener('click', () => handleApproveStudent(button.dataset.studentId)));
    document.querySelectorAll('.reject-btn').forEach(button => button.addEventListener('click', () => handleRejectStudent(button.dataset.studentId)));
}


// --- Summer Break Panel ---
async function renderSummerBreakPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">Students on Summer Break</h2>
                <button id="refresh-break-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
            </div>
            <div id="break-status-message" class="text-center font-semibold mb-4 hidden"></div>
            <div id="break-students-list" class="space-y-4">
                <p class="text-center">Loading...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-break-btn').addEventListener('click', () => fetchAndRenderBreakStudents(true));
    fetchAndRenderBreakStudents();
}

async function fetchAndRenderBreakStudents(forceRefresh = false) {
    if (forceRefresh) invalidateCache('breakStudents');
    const listContainer = document.getElementById('break-students-list');
    const statusMessage = document.getElementById('break-status-message');

    try {
        if (!sessionCache.breakStudents) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching break students...</p>`;
            // Fetch all students who are currently marked as 'on_break'
            const snapshot = await getDocs(query(collection(db, "students"), where("status", "==", "on_break")));
            saveToLocalStorage('breakStudents', snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderBreakStudentsFromCache();
    } catch(error) {
        console.error("Error fetching break students:", error);
        listContainer.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderBreakStudentsFromCache() {
    const breakStudents = sessionCache.breakStudents || [];
    const listContainer = document.getElementById('break-students-list');
    const statusMessage = document.getElementById('break-status-message');

    if (!listContainer || !statusMessage) return;

    if (breakStudents.length === 0) {
        statusMessage.textContent = "No students are currently on break.";
        statusMessage.classList.remove('hidden', 'text-yellow-600');
        statusMessage.classList.add('text-green-600');
        listContainer.innerHTML = `<p class="text-center text-gray-500">All students are currently active.</p>`;
        return;
    }

    statusMessage.textContent = `${breakStudents.length} students are currently on break.`;
    statusMessage.classList.remove('hidden', 'text-green-600');
    statusMessage.classList.add('text-yellow-600');

    listContainer.innerHTML = breakStudents.map(student => `
        <div class="border p-4 rounded-lg flex justify-between items-center bg-yellow-50">
            <div>
                <p><strong>Student:</strong> ${student.studentName}</p>
                <p><strong>Tutor:</strong> ${student.tutorEmail || 'N/A'}</p>
                <p><strong>Parent Phone:</strong> ${student.parentPhone || 'N/A'}</p>
            </div>
            <div class="flex items-center space-x-2">
                <button class="end-break-btn bg-green-600 text-white px-3 py-1 text-sm rounded-full" data-student-id="${student.id}">End Break / Activate</button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.end-break-btn').forEach(button => button.addEventListener('click', (e) => handleEndBreak(e.target.dataset.studentId)));
}

async function handleEndBreak(studentId) {
    if (confirm("Are you sure you want to reactivate this student?")) {
        try {
            await updateDoc(doc(db, "students", studentId), {
                status: 'approved' // Assuming 'approved' is the standard active status
            });
            alert("Student reactivated successfully!");
            invalidateCache('breakStudents');
            invalidateCache('students'); // Also invalidate main student list
            fetchAndRenderBreakStudents(true);
        } catch (error) {
            console.error("Error ending student break: ", error);
            alert("Failed to reactivate student. Check the console for details.");
        }
    }
}


// ##################################
// # REPORT FUNCTIONS
// ##################################
// (Keeping existing report functions outside the main scope, assuming external tools/libraries for PDF generation/zip are handled elsewhere or via global functions)

// Placeholder functions (assuming these exist elsewhere in the final app structure)
// async function viewReportInNewTab(reportId, shouldDownload) { /* ... */ }
// async function zipAndDownloadTutorReports(reports, tutorName, buttonElement) { /* ... */ }


// ##################################
// # AUTH AND INITIALIZATION (AT END OF FILE)
// ##################################

// Define the navigation items
const allNavItems = {
    'nav-directory': { label: 'Tutor & Student List', fn: renderManagementTutorView, requiredPermission: 'canViewDirectory' },
    'nav-pay-advice': { label: 'Tutor Pay Advice', fn: renderPayAdvicePanel, requiredPermission: 'canViewPayAdvice' },
    'nav-reports': { label: 'Tutor Reports', fn: renderTutorReportsPanel, requiredPermission: 'canViewReports' },
    'nav-pending': { label: 'Pending Approvals', fn: renderPendingApprovalsPanel, requiredPermission: 'canViewPending' },
    'nav-break': { label: 'Summer Break', fn: renderSummerBreakPanel, requiredPermission: 'canViewBreak' },
    // Add other nav items here as needed
};

// Initial setup to handle authentication state and render UI
const mainContent = document.getElementById('main-content');
const navContainer = document.getElementById('nav-container');
const logoutBtn = document.getElementById('logout-btn');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Fetch user data from 'staff' collection
        const staffDocRef = doc(db, "staff", user.email);
        onSnapshot(staffDocRef, async (docSnap) => {
            if (!docSnap.exists()) {
                if (mainContent) mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Account not registered in staff directory.</p>`;
                if (logoutBtn) logoutBtn.classList.add('hidden');
                return;
            }
            
            window.userData = docSnap.data();
            const staffData = window.userData;

            if (document.getElementById('welcome-message')) document.getElementById('welcome-message').textContent = `Hello, ${staffData.name}`;
            if (document.getElementById('user-role')) document.getElementById('user-role').textContent = `Role: ${capitalize(staffData.role || 'Management Staff')}`;
            
            // Build Navigation Menu
            let firstNavId = null;
            navContainer.innerHTML = ''; // Clear existing nav
            if (staffData.permissions && staffData.permissions.views) {
                for (const id in allNavItems) {
                    const item = allNavItems[id];
                    if (staffData.permissions.views[item.requiredPermission] === true) {
                        const navItem = document.createElement('a');
                        navItem.href = '#';
                        navItem.id = id;
                        navItem.className = 'nav-item block px-4 py-2 text-gray-700 hover:bg-green-100 rounded-md';
                        navItem.textContent = item.label;
                        navItem.onclick = (e) => {
                            e.preventDefault();
                            // Handle active class and rendering
                            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('bg-green-200', 'font-bold'));
                            navItem.classList.add('bg-green-200', 'font-bold');
                            item.fn(mainContent);
                        };
                        navContainer.appendChild(navItem);
                        if (!firstNavId) firstNavId = id;
                    }
                }

                // Default view rendering (only if permissions are valid)
                if (firstNavId) {
                    const activeNavId = localStorage.getItem('activeNav') || firstNavId;
                    const activeNavItem = document.getElementById(activeNavId);
                    
                    if (activeNavItem) {
                        // Activate and render the last active or first permitted tab
                        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('bg-green-200', 'font-bold'));
                        activeNavItem.classList.add('bg-green-200', 'font-bold');
                        const currentItem = allNavItems[activeNavId];
                        if(currentItem) currentItem.fn(mainContent);
                    } else {
                        const currentItem = allNavItems[firstNavId];
                        if(currentItem) currentItem.fn(mainContent);
                    }
                } else {
                    if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
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

        if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
    } else {
        window.location.href = "management-auth.html";
    }
});


// [End Updated management.js File]
