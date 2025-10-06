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
                <h3 class="text-xl font-bold mb-4">Edit Student Details</h3>
                <form id="edit-student-form">
                    <input type="hidden" id="edit-student-id" value="${studentId}">
                    <input type="hidden" id="edit-collection-name" value="${collectionName}">
                    <div class="mb-2"><label class="block text-sm font-medium">Student Name</label><input type="text" id="edit-studentName" value="${studentData.studentName}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Grade</label><input type="text" id="edit-grade" value="${studentData.grade}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Days/Week</label><input type="text" id="edit-days" value="${studentData.days}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Subjects (comma-separated)</label><input type="text" id="edit-subjects" value="${studentData.subjects ? studentData.subjects.join(', ') : ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Name</label><input type="text" id="edit-parentName" value="${studentData.parentName || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Parent Phone</label><input type="text" id="edit-parentPhone" value="${studentData.parentPhone || ''}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
                    <div class="mb-2"><label class="block text-sm font-medium">Student Fee (₦)</label><input type="number" id="edit-studentFee" value="${studentData.studentFee || 0}" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"></div>
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
            studentFee: Number(form.elements['edit-studentFee'].value) || 0,
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
            renderManagementTutorView(document.getElementById('main-content')); // Rerender
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
            fetchAndRenderPendingApprovals(); // Re-fetch and render the current panel
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
            fetchAndRenderPendingApprovals(); // Re-fetch and render
        } catch (error) {
            console.error("Error rejecting student: ", error);
            alert("Error rejecting student. Check the console for details.");
        }
    }
}

// NEW FUNCTION: Handle assigning a new student
async function handleAssignStudent() {
    showAssignStudentModal();
}

function showAssignStudentModal() {
    const modalHtml = `
        <div id="assign-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('assign-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">Assign New Student</h3>
                <form id="assign-student-form">
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Student Name</label>
                        <input type="text" id="assign-studentName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Student Grade</label>
                        <input type="text" id="assign-grade" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Days/Week</label>
                        <input type="text" id="assign-days" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Subjects (comma-separated)</label>
                        <input type="text" id="assign-subjects" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Parent Name</label>
                        <input type="text" id="assign-parentName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Parent Phone</label>
                        <input type="text" id="assign-parentPhone" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2">
                    </div>
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Student Fee (₦)</label>
                        <input type="number" id="assign-studentFee" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                    </div>
                    <div class="mb-2">
                        <label class="block text-sm font-medium">Assign to Tutor</label>
                        <select id="assign-tutor" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" required>
                            <option value="">Select a tutor</option>
                        </select>
                    </div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('assign-modal').remove()" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Assign Student</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Populate tutor dropdown
    populateTutorDropdown();
    
    document.getElementById('assign-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitAssignStudentForm();
    });
}

async function populateTutorDropdown() {
    const tutorSelect = document.getElementById('assign-tutor');
    if (!tutorSelect) return;
    
    try {
        // Use cached tutors if available, otherwise fetch
        if (!sessionCache.tutors) {
            const tutorsSnapshot = await getDocs(query(collection(db, "tutors"), orderBy("name")));
            saveToLocalStorage('tutors', tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        
        const tutors = sessionCache.tutors || [];
        tutorSelect.innerHTML = '<option value="">Select a tutor</option>';
        
        tutors.forEach(tutor => {
            const option = document.createElement('option');
            option.value = tutor.email;
            option.textContent = `${tutor.name} (${tutor.email})`;
            tutorSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error populating tutor dropdown:", error);
        tutorSelect.innerHTML = '<option value="">Error loading tutors</option>';
    }
}

async function submitAssignStudentForm() {
    const form = document.getElementById('assign-student-form');
    if (!form) return;
    
    const formData = {
        studentName: document.getElementById('assign-studentName').value,
        grade: document.getElementById('assign-grade').value,
        days: document.getElementById('assign-days').value,
        subjects: document.getElementById('assign-subjects').value.split(',').map(s => s.trim()).filter(s => s),
        parentName: document.getElementById('assign-parentName').value || '',
        parentPhone: document.getElementById('assign-parentPhone').value || '',
        studentFee: Number(document.getElementById('assign-studentFee').value) || 0,
        tutorEmail: document.getElementById('assign-tutor').value,
        status: 'approved',
        summerBreak: false
    };
    
    if (!formData.tutorEmail) {
        alert("Please select a tutor to assign this student to.");
        return;
    }
    
    try {
        // Add student to Firestore
        await addDoc(collection(db, "students"), formData);
        alert("Student assigned successfully!");
        document.getElementById('assign-modal').remove();
        
        // Invalidate cache and refresh the view
        invalidateCache('students');
        renderManagementTutorView(document.getElementById('main-content'));
    } catch (error) {
        console.error("Error assigning student: ", error);
        alert("Failed to assign student. Check the console for details.");
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
                    <input type="search" id="directory-search" placeholder="Search Tutors, Students, Parents, Phone..." class="p-2 border rounded-md w-64">
                    <button id="refresh-directory-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Refresh</button>
                    <button id="assign-student-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Assign Student</button>
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
            <div id="directory-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading directory...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-directory-btn').addEventListener('click', () => fetchAndRenderDirectory(true));
    document.getElementById('directory-search').addEventListener('input', (e) => renderDirectoryFromCache(e.target.value));
    document.getElementById('assign-student-btn').addEventListener('click', handleAssignStudent);
    fetchAndRenderDirectory();
}

async function fetchAndRenderDirectory(forceRefresh = false) {
    if (forceRefresh) {
        invalidateCache('tutors');
        invalidateCache('students');
    }

    try {
        // If cache is empty, fetch from server. Otherwise, the existing cache (from localStorage) will be used.
        if (!sessionCache.tutors || !sessionCache.students) {
            document.getElementById('directory-list').innerHTML = `<p class="text-center text-gray-500 py-10">Fetching data from server...</p>`;
            const [tutorsSnapshot, studentsSnapshot] = await Promise.all([
                getDocs(query(collection(db, "tutors"), orderBy("name"))),
                getDocs(collection(db, "students"))
            ]);
            // Save newly fetched data to localStorage
            saveToLocalStorage('tutors', tutorsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            saveToLocalStorage('students', studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderDirectoryFromCache();
    } catch (error) {
        console.error("Error fetching directory data:", error);
        document.getElementById('directory-list').innerHTML = `<p class="text-center text-red-500 py-10">Failed to load data.</p>`;
    }
}

function renderDirectoryFromCache(searchTerm = '') {
    const tutors = sessionCache.tutors || [];
    const students = sessionCache.students || [];
    const directoryList = document.getElementById('directory-list');
    if (!directoryList) return;

    if (tutors.length === 0 && students.length === 0) {
        directoryList.innerHTML = `<p class="text-center text-gray-500 py-10">No directory data found. Click Refresh to fetch from the server.</p>`;
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

    const filteredTutors = tutors.filter(tutor => {
        const assignedStudents = studentsByTutor[tutor.email] || [];
        const tutorMatch = tutor.name.toLowerCase().includes(lowerCaseSearchTerm) || 
                          tutor.email.toLowerCase().includes(lowerCaseSearchTerm);
        
        const studentMatch = assignedStudents.some(s => 
            s.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
            (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (s.parentPhone && s.parentPhone.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (s.grade && s.grade.toLowerCase().includes(lowerCaseSearchTerm))
        );
        return tutorMatch || studentMatch;
    });

    if (filteredTutors.length === 0) {
        directoryList.innerHTML = `<p class="text-center text-gray-500 py-10">No results found for "${searchTerm}".</p>`;
        return;
    }

    document.getElementById('tutor-count-badge').textContent = tutors.length;
    document.getElementById('student-count-badge').textContent = students.length;

    const canEditStudents = window.userData.permissions?.actions?.canEditStudents === true;
    const canDeleteStudents = window.userData.permissions?.actions?.canDeleteStudents === true;
    const showActionsColumn = canEditStudents || canDeleteStudents;

    directoryList.innerHTML = filteredTutors.map(tutor => {
        const assignedStudents = (studentsByTutor[tutor.email] || [])
            .filter(s => 
                searchTerm === '' || // show all students if no search term
                tutor.name.toLowerCase().includes(lowerCaseSearchTerm) || // show all if tutor name matches
                tutor.email.toLowerCase().includes(lowerCaseSearchTerm) ||
                s.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
                (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (s.parentPhone && s.parentPhone.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (s.grade && s.grade.toLowerCase().includes(lowerCaseSearchTerm))
            );

        const studentsTableRows = assignedStudents
            .sort((a, b) => a.studentName.localeCompare(b.studentName))
            .map(student => {
                const subjects = student.subjects && Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
                const actionButtons = `
                    ${canEditStudents ? `<button class="edit-student-btn bg-blue-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Edit</button>` : ''}
                    ${canDeleteStudents ? `<button class="delete-student-btn bg-red-500 text-white px-3 py-1 rounded-full text-xs" data-student-id="${student.id}">Delete</button>` : ''}
                `;
                return `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-2 font-medium">${student.studentName}</td>
                        <td class="px-4 py-2">₦${(student.studentFee || 0).toFixed(2)}</td>
                        <td class="px-4 py-2">${student.grade}</td>
                        <td class="px-4 py-2">${student.days}</td>
                        <td class="px-4 py-2">${subjects}</td>
                        <td class="px-4 py-2">${student.parentName || 'N/A'}</td>
                        <td class="px-4 py-2">${student.parentPhone || 'N/A'}</td>
                        ${showActionsColumn ? `<td class="px-4 py-2">${actionButtons}</td>` : ''}
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
                                ${showActionsColumn ? `<th class="px-4 py-2 font-medium">Actions</th>` : ''}
                            </tr></thead>
                            <tbody class="bg-white divide-y divide-gray-200">${studentsTableRows}</tbody>
                        </table>
                    </div>
                </details>
            </div>
        `;
    }).join('');

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
                    <input type="date" id="end-date" class="mt-1 block w-full p-2 border rounded-md">
                </div>
                <div class="flex items-center space-x-4 col-span-2">
                    <div class="bg-green-100 p-3 rounded-lg text-center shadow w-full"><h4 class="font-bold text-green-800 text-sm">Active Tutors</h4><p id="pay-tutor-count" class="text-2xl font-extrabold">0</p></div>
                    <div class="bg-yellow-100 p-3 rounded-lg text-center shadow w-full"><h4 class="font-bold text-yellow-800 text-sm">Total Students</h4><p id="pay-student-count" class="text-2xl font-extrabold">0</p></div>
                    ${canExport ? `<button id="export-pay-csv-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 h-full">Export CSV</button>` : ''}
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Tutor</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Students</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Student Fees</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Mgmt. Fee</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Total Pay</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Gift (₦)</th>
                            <th class="px-6 py-3 text-left text-xs font-medium uppercase">Final Pay</th>
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
        const startDate = startDateInput.value ? new Date(startDateInput.value) : null;
        const endDate = endDateInput.value ? new Date(endDateInput.value) : null;
        if (startDate && endDate) {
            payAdviceGifts = {}; // Reset gifts on new date range
            currentPayData = []; // Reset data
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
        // Firestore 'in' queries are limited to 30 values. This function fetches tutors by chunking the email list.
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
            const managementFee = (tutor.isManagementStaff && tutor.managementFee) ? tutor.managementFee : 0;
            totalStudentCount += assignedStudents.length;
            const bankDetails = tutorBankDetails[tutor.email] || { beneficiaryBank: 'N/A', beneficiaryAccount: 'N/A', beneficiaryName: 'N/A' };

            payData.push({
                tutorName: tutor.name,
                tutorEmail: tutor.email,
                studentCount: assignedStudents.length,
                totalStudentFees,
                managementFee,
                totalPay: totalStudentFees - managementFee,
                ...bankDetails
            });
        });

        currentPayData = payData;
        document.getElementById('pay-tutor-count').textContent = payData.length;
        document.getElementById('pay-student-count').textContent = totalStudentCount;
        renderPayAdviceTable(payData);
    } catch (error) {
        console.error("Error loading pay advice data:", error);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
    }
}

function renderPayAdviceTable(payData) {
    const tableBody = document.getElementById('pay-advice-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = payData.map(item => {
        const giftAmount = payAdviceGifts[item.tutorEmail] || 0;
        const finalPay = item.totalPay + giftAmount;
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">${item.tutorName}</td>
                <td class="px-6 py-4 whitespace-nowrap">${item.studentCount}</td>
                <td class="px-6 py-4 whitespace-nowrap">₦${item.totalStudentFees.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">₦${item.managementFee.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">₦${item.totalPay.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <input type="number" class="gift-input border rounded p-1 w-24" data-tutor-email="${item.tutorEmail}" value="${giftAmount}" min="0" step="100">
                </td>
                <td class="px-6 py-4 whitespace-nowrap">₦${finalPay.toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <button class="view-details-btn bg-blue-500 text-white px-3 py-1 rounded text-xs" data-tutor-email="${item.tutorEmail}">Details</button>
                </td>
            </tr>
        `;
    }).join('');

    // Add event listeners for gift inputs
    document.querySelectorAll('.gift-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const email = e.target.dataset.tutorEmail;
            const value = parseFloat(e.target.value) || 0;
            payAdviceGifts[email] = value;
            // Update the final pay cell
            const row = e.target.closest('tr');
            const finalPayCell = row.querySelector('td:nth-child(7)');
            const totalPay = parseFloat(row.querySelector('td:nth-child(5)').textContent.replace('₦', ''));
            finalPayCell.textContent = `₦${(totalPay + value).toFixed(2)}`;
        });
    });

    // Add event listeners for details buttons
    document.querySelectorAll('.view-details-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tutorEmail = button.dataset.tutorEmail;
            const tutorData = payData.find(d => d.tutorEmail === tutorEmail);
            if (tutorData) {
                showPayDetailsModal(tutorData);
            }
        });
    });
}

function showPayDetailsModal(tutorData) {
    const giftAmount = payAdviceGifts[tutorData.tutorEmail] || 0;
    const finalPay = tutorData.totalPay + giftAmount;
    const modalHtml = `
        <div id="pay-details-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-96 max-w-lg rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('pay-details-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">Pay Details for ${tutorData.tutorName}</h3>
                <div class="space-y-2">
                    <div class="flex justify-between"><span class="font-medium">Total Student Fees:</span><span>₦${tutorData.totalStudentFees.toFixed(2)}</span></div>
                    <div class="flex justify-between"><span class="font-medium">Management Fee:</span><span>₦${tutorData.managementFee.toFixed(2)}</span></div>
                    <div class="flex justify-between border-t pt-2"><span class="font-medium">Total Pay:</span><span>₦${tutorData.totalPay.toFixed(2)}</span></div>
                    <div class="flex justify-between"><span class="font-medium">Gift:</span><span>₦${giftAmount.toFixed(2)}</span></div>
                    <div class="flex justify-between border-t pt-2"><span class="font-bold">Final Pay:</span><span class="font-bold">₦${finalPay.toFixed(2)}</span></div>
                    <div class="mt-4">
                        <h4 class="font-medium mb-2">Bank Details:</h4>
                        <p><span class="font-medium">Bank:</span> ${tutorData.beneficiaryBank}</p>
                        <p><span class="font-medium">Account:</span> ${tutorData.beneficiaryAccount}</p>
                        <p><span class="font-medium">Name:</span> ${tutorData.beneficiaryName}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}


// --- Pending Approvals Panel ---
async function renderPendingApprovalsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Pending Student Approvals</h2>
            <div class="bg-yellow-50 p-4 rounded-lg mb-6">
                <p class="text-yellow-800">Review and approve or reject student registrations submitted by tutors.</p>
            </div>
            <div id="pending-approvals-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading pending approvals...</p>
            </div>
        </div>
    `;
    fetchAndRenderPendingApprovals();
}

async function fetchAndRenderPendingApprovals() {
    try {
        if (!sessionCache.pendingStudents) {
            const pendingSnapshot = await getDocs(collection(db, "pending_students"));
            saveToLocalStorage('pendingStudents', pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderPendingApprovalsFromCache();
    } catch (error) {
        console.error("Error fetching pending approvals:", error);
        const list = document.getElementById('pending-approvals-list');
        if (list) list.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load pending approvals.</p>`;
    }
}

function renderPendingApprovalsFromCache() {
    const pendingStudents = sessionCache.pendingStudents || [];
    const list = document.getElementById('pending-approvals-list');
    if (!list) return;

    if (pendingStudents.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-500 py-10">No pending student approvals.</p>`;
        return;
    }

    list.innerHTML = pendingStudents.map(student => {
        const subjects = student.subjects && Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
        return `
            <div class="border rounded-lg p-4 shadow-sm">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <h3 class="font-bold text-lg">${student.studentName}</h3>
                        <p class="text-gray-600">Grade: ${student.grade} | Days/Week: ${student.days}</p>
                        <p class="text-gray-600">Subjects: ${subjects}</p>
                        <p class="text-gray-600">Parent: ${student.parentName || 'N/A'} | Phone: ${student.parentPhone || 'N/A'}</p>
                        <p class="text-gray-600">Fee: ₦${(student.studentFee || 0).toFixed(2)}</p>
                        <p class="text-sm text-gray-500">Submitted by: ${student.tutorEmail}</p>
                    </div>
                    <div class="flex space-x-2 ml-4">
                        <button class="edit-pending-btn bg-blue-500 text-white px-3 py-1 rounded text-xs" data-student-id="${student.id}">Edit</button>
                        <button class="approve-btn bg-green-500 text-white px-3 py-1 rounded text-xs" data-student-id="${student.id}">Approve</button>
                        <button class="reject-btn bg-red-500 text-white px-3 py-1 rounded text-xs" data-student-id="${student.id}">Reject</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.edit-pending-btn').forEach(button => button.addEventListener('click', () => handleEditPendingStudent(button.dataset.studentId)));
    document.querySelectorAll('.approve-btn').forEach(button => button.addEventListener('click', () => handleApproveStudent(button.dataset.studentId)));
    document.querySelectorAll('.reject-btn').forEach(button => button.addEventListener('click', () => handleRejectStudent(button.dataset.studentId)));
}


// --- Break Students Panel ---
async function renderBreakStudentsPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Summer Break Students</h2>
            <div class="bg-blue-50 p-4 rounded-lg mb-6">
                <p class="text-blue-800">Manage students on summer break. You can edit their details or remove them from the break list.</p>
            </div>
            <div id="break-students-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading break students...</p>
            </div>
        </div>
    `;
    fetchAndRenderBreakStudents();
}

async function fetchAndRenderBreakStudents() {
    try {
        if (!sessionCache.breakStudents) {
            const breakQuery = query(collection(db, "students"), where("summerBreak", "==", true));
            const breakSnapshot = await getDocs(breakQuery);
            saveToLocalStorage('breakStudents', breakSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
        renderBreakStudentsFromCache();
    } catch (error) {
        console.error("Error fetching break students:", error);
        const list = document.getElementById('break-students-list');
        if (list) list.innerHTML = `<p class="text-center text-red-500 py-10">Failed to load break students.</p>`;
    }
}

function renderBreakStudentsFromCache() {
    const breakStudents = sessionCache.breakStudents || [];
    const list = document.getElementById('break-students-list');
    if (!list) return;

    if (breakStudents.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-500 py-10">No students on summer break.</p>`;
        return;
    }

    const canEditStudents = window.userData.permissions?.actions?.canEditStudents === true;
    const canDeleteStudents = window.userData.permissions?.actions?.canDeleteStudents === true;

    list.innerHTML = breakStudents.map(student => {
        const subjects = student.subjects && Array.isArray(student.subjects) ? student.subjects.join(', ') : 'N/A';
        return `
            <div class="border rounded-lg p-4 shadow-sm">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <h3 class="font-bold text-lg">${student.studentName}</h3>
                        <p class="text-gray-600">Grade: ${student.grade} | Days/Week: ${student.days}</p>
                        <p class="text-gray-600">Subjects: ${subjects}</p>
                        <p class="text-gray-600">Parent: ${student.parentName || 'N/A'} | Phone: ${student.parentPhone || 'N/A'}</p>
                        <p class="text-gray-600">Fee: ₦${(student.studentFee || 0).toFixed(2)}</p>
                        <p class="text-sm text-gray-500">Tutor: ${student.tutorEmail}</p>
                    </div>
                    <div class="flex space-x-2 ml-4">
                        ${canEditStudents ? `<button class="edit-student-btn bg-blue-500 text-white px-3 py-1 rounded text-xs" data-student-id="${student.id}">Edit</button>` : ''}
                        ${canDeleteStudents ? `<button class="delete-student-btn bg-red-500 text-white px-3 py-1 rounded text-xs" data-student-id="${student.id}">Delete</button>` : ''}
                        <button class="remove-break-btn bg-yellow-500 text-white px-3 py-1 rounded text-xs" data-student-id="${student.id}">Remove Break</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (canEditStudents) {
        document.querySelectorAll('.edit-student-btn').forEach(button => button.addEventListener('click', () => handleEditStudent(button.dataset.studentId)));
    }
    if (canDeleteStudents) {
        document.querySelectorAll('.delete-student-btn').forEach(button => button.addEventListener('click', () => handleDeleteStudent(button.dataset.studentId)));
    }
    document.querySelectorAll('.remove-break-btn').forEach(button => button.addEventListener('click', async () => {
        const studentId = button.dataset.studentId;
        if (confirm("Remove this student from summer break?")) {
            try {
                await updateDoc(doc(db, "students", studentId), { summerBreak: false });
                alert("Student removed from summer break.");
                invalidateCache('breakStudents');
                invalidateCache('students');
                fetchAndRenderBreakStudents();
            } catch (error) {
                console.error("Error removing break status: ", error);
                alert("Error removing break status.");
            }
        }
    }));
}


// ##################################
// # MAIN MANAGEMENT DASHBOARD
// ##################################

function renderManagementDashboard() {
    const container = document.getElementById('main-content');
    if (!container) return;

    const permissions = window.userData.permissions || {};
    const allowedPanels = permissions.panels || {};

    container.innerHTML = `
        <div class="min-h-screen bg-gray-50">
            <header class="bg-white shadow">
                <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 class="text-2xl font-bold text-green-700">Management Dashboard</h1>
                    <div class="flex items-center space-x-4">
                        <span class="text-gray-700">Welcome, ${window.userData.name || 'User'}</span>
                        <button id="logout-btn" class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Logout</button>
                    </div>
                </div>
            </header>

            <main class="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
                <div class="mb-8">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        ${allowedPanels.tutorDirectory ? `<button class="nav-btn bg-green-600 text-white p-4 rounded-lg shadow hover:bg-green-700 transition" data-panel="tutorDirectory">Tutor & Student Directory</button>` : ''}
                        ${allowedPanels.payAdvice ? `<button class="nav-btn bg-blue-600 text-white p-4 rounded-lg shadow hover:bg-blue-700 transition" data-panel="payAdvice">Pay Advice</button>` : ''}
                        ${allowedPanels.pendingApprovals ? `<button class="nav-btn bg-yellow-600 text-white p-4 rounded-lg shadow hover:bg-yellow-700 transition" data-panel="pendingApprovals">Pending Approvals</button>` : ''}
                        ${allowedPanels.breakStudents ? `<button class="nav-btn bg-purple-600 text-white p-4 rounded-lg shadow hover:bg-purple-700 transition" data-panel="breakStudents">Summer Break Students</button>` : ''}
                    </div>
                </div>

                <div id="panel-content">
                    <div class="bg-white p-8 rounded-lg shadow text-center">
                        <h3 class="text-xl font-medium text-gray-900 mb-2">Welcome to Management Dashboard</h3>
                        <p class="text-gray-600">Select a panel from the quick actions above to get started.</p>
                    </div>
                </div>
            </main>
        </div>
    `;

    document.getElementById('logout-btn').addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'login.html';
        }).catch((error) => {
            console.error("Logout error:", error);
        });
    });

    const panelContent = document.getElementById('panel-content');
    document.querySelectorAll('.nav-btn').forEach(button => {
        button.addEventListener('click', () => {
            const panel = button.dataset.panel;
            switch (panel) {
                case 'tutorDirectory':
                    renderManagementTutorView(panelContent);
                    break;
                case 'payAdvice':
                    renderPayAdvicePanel(panelContent);
                    break;
                case 'pendingApprovals':
                    renderPendingApprovalsPanel(panelContent);
                    break;
                case 'breakStudents':
                    renderBreakStudentsPanel(panelContent);
                    break;
                default:
                    panelContent.innerHTML = `<div class="bg-white p-8 rounded-lg shadow text-center"><p class="text-gray-600">Panel not found.</p></div>`;
            }
        });
    });
}

// ##################################
// # AUTHENTICATION & INITIALIZATION
// ##################################

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.role === "management") {
                    window.userData = userData;
                    renderManagementDashboard();
                } else {
                    alert("Access denied. Management role required.");
                    await signOut(auth);
                    window.location.href = 'login.html';
                }
            } else {
                alert("User data not found.");
                await signOut(auth);
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            alert("Error fetching user data.");
            await signOut(auth);
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
});

// [End Updated management.js File]
