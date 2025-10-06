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
        } catch (error)
        {
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

// ### START: LOGIC PORTED FROM TUTOR.JS FOR FEE CALCULATION ###

const PAY_SCHEMES = {
    NEW_TUTOR: { academic: { "Preschool-Grade 2": { 2: 50000, 3: 60000, 5: 100000 }, "Grade 3-8": { 2: 60000, 3: 70000, 5: 110000 }, "Subject Teachers": { 1: 30000, 2: 60000, 3: 70000 } }, specialized: { individual: { "Music": 30000, "Native Language": 20000, "Foreign Language": 25000, "Coding": 30000, "Chess": 25000, "Public Speaking": 25000, "English Proficiency": 25000, "Counseling Programs": 25000 }, group: { "Music": 25000, "Native Language": 20000, "Foreign Language": 20000, "Chess": 20000, "Public Speaking": 20000, "English Proficiency": 20000, "Counseling Programs": 20000 } } },
    OLD_TUTOR: { academic: { "Preschool-Grade 2": { 2: 60000, 3: 70000, 5: 110000 }, "Grade 3-8": { 2: 70000, 3: 80000, 5: 120000 }, "Subject Teachers": { 1: 35000, 2: 70000, 3: 90000 } }, specialized: { individual: { "Music": 35000, "Native Language": 25000, "Foreign Language": 30000, "Coding": 35000, "Chess": 30000, "Public Speaking": 30000, "English Proficiency": 30000, "Counseling Programs": 30000 }, group: { "Music": 25000, "Native Language": 20000, "Foreign Language": 20000, "Chess": 20000, "Public Speaking": 20000, "English Proficiency": 20000, "Counseling Programs": 20000 } } },
    MANAGEMENT: { academic: { "Preschool-Grade 2": { 2: 70000, 3: 85000, 5: 120000 }, "Grade 3-8": { 2: 80000, 3: 90000, 5: 130000 }, "Subject Teachers": { 1: 40000, 2: 80000, 3: 100000 } }, specialized: { individual: { "Music": 40000, "Native Language": 30000, "Foreign Language": 35000, "Coding": 40000, "Chess": 35000, "Public Speaking": 35000, "English Proficiency": 35000, "Counseling Programs": 35000 }, group: { "Music": 25000, "Native Language": 20000, "Foreign Language": 20000, "Chess": 20000, "Public Speaking": 20000, "English Proficiency": 20000, "Counseling Programs": 20000 } } }
};

const SUBJECT_CATEGORIES = {
    "Native Language": ["Yoruba", "Igbo", "Hausa"],
    "Foreign Language": ["French", "German", "Spanish", "Arabic"],
    "Specialized": ["Music", "Coding", "Chess", "Public Speaking", "English Proficiency", "Counseling Programs"]
};

function getTutorPayScheme(tutor) {
    if (tutor.isManagementStaff) return PAY_SCHEMES.MANAGEMENT;
    if (!tutor.employmentDate) return PAY_SCHEMES.NEW_TUTOR;
    const employmentDate = new Date(tutor.employmentDate + '-01');
    const currentDate = new Date();
    const monthsDiff = (currentDate.getFullYear() - employmentDate.getFullYear()) * 12 + (currentDate.getMonth() - employmentDate.getMonth());
    return monthsDiff >= 12 ? PAY_SCHEMES.OLD_TUTOR : PAY_SCHEMES.NEW_TUTOR;
}

function findSpecializedSubject(subjects) {
    for (const [category, subjectList] of Object.entries(SUBJECT_CATEGORIES)) {
        for (const subject of subjects) {
            if (subjectList.includes(subject)) return { category, subject };
        }
    }
    return null;
}

function calculateSuggestedFee(student, payScheme) {
    const grade = student.grade;
    const days = parseInt(student.days) || 0;
    const subjects = student.subjects || [];
    const specializedSubject = findSpecializedSubject(subjects);
    if (specializedSubject) {
        const isGroupClass = student.groupClass || false;
        const feeType = isGroupClass ? 'group' : 'individual';
        return payScheme.specialized[feeType][specializedSubject.category] || 0;
    }
    let gradeCategory = "Grade 3-8";
    if (grade === "Preschool" || grade === "Kindergarten" || grade.includes("Grade 1") || grade.includes("Grade 2")) {
        gradeCategory = "Preschool-Grade 2";
    } else if (parseInt(grade.replace('Grade ', '')) >= 9) {
        return 0;
    }
    const isSubjectTeacher = subjects.some(subj => ["Math", "English", "Science"].includes(subj)) && parseInt(grade.replace('Grade ', '')) >= 5;
    return isSubjectTeacher ? payScheme.academic["Subject Teachers"][days] || 0 : payScheme.academic[gradeCategory][days] || 0;
}
// ### END: LOGIC PORTED FROM TUTOR.JS ###


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


// ##################################
// # PANEL RENDERING FUNCTIONS
// ##################################

// --- Tutor & Student Directory Panel ---
async function renderManagementTutorView(container) {
    const canAssignStudents = window.userData.permissions?.actions?.canAssignStudents === true;
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <div class="flex justify-between items-center mb-4 flex-wrap gap-4">
                <h2 class="text-2xl font-bold text-green-700">Tutor & Student Directory</h2>
                <div class="flex items-center gap-4">
                    <input type="search" id="directory-search" placeholder="Search Tutors, Students, Parents, Phone..." class="p-2 border rounded-md w-64">
                    ${canAssignStudents ? `<button id="assign-student-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Assign New Student</button>` : ''}
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
            <div id="directory-list" class="space-y-4">
                <p class="text-center text-gray-500 py-10">Loading directory...</p>
            </div>
        </div>
    `;
    document.getElementById('refresh-directory-btn').addEventListener('click', () => fetchAndRenderDirectory(true));
    document.getElementById('directory-search').addEventListener('input', (e) => renderDirectoryFromCache(e.target.value));
    if (canAssignStudents) {
        document.getElementById('assign-student-btn').addEventListener('click', showAssignStudentModal);
    }
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
        const tutorMatch = tutor.name.toLowerCase().includes(lowerCaseSearchTerm);
        // ### MODIFIED SECTION: Enhanced search logic ###
        const studentMatch = assignedStudents.some(s =>
            s.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
            (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (s.parentPhone && s.parentPhone.includes(searchTerm)) // Phone search doesn't need to be lowercase
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
            // ### MODIFIED SECTION: Enhanced filter for which students to show under a tutor ###
            .filter(s =>
                searchTerm === '' || // show all students if no search term
                tutor.name.toLowerCase().includes(lowerCaseSearchTerm) || // show all if tutor name matches
                s.studentName.toLowerCase().includes(lowerCaseSearchTerm) ||
                (s.parentName && s.parentName.toLowerCase().includes(lowerCaseSearchTerm)) ||
                (s.parentPhone && s.parentPhone.includes(searchTerm))
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


// ### NEW FUNCTION: Show Assign Student Modal ###
function showAssignStudentModal() {
    const tutors = sessionCache.tutors || [];
    if (tutors.length === 0) {
        alert("Tutor list is not available. Please refresh the directory and try again.");
        return;
    }

    const tutorOptions = tutors.map(tutor => `<option value="${tutor.email}">${tutor.name} (${tutor.email})</option>`).join('');
    const gradeOptions = `
        <option value="">Select Grade</option><option value="Preschool">Preschool</option><option value="Kindergarten">Kindergarten</option>
        ${Array.from({ length: 12 }, (_, i) => `<option value="Grade ${i + 1}">Grade ${i + 1}</option>`).join('')}
        <option value="Pre-College">Pre-College</option><option value="College">College</option><option value="Adults">Adults</option>
    `;
    const daysOptions = Array.from({ length: 7 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');

    const subjectsByCategory = {
        "Academics": ["Math", "Language Arts", "Geography", "Science", "Biology", "Physics", "Chemistry", "Microbiology"],
        "Pre-College Exams": ["SAT", "IGCSE", "A-Levels", "SSCE", "JAMB"],
        "Languages": ["French", "German", "Spanish", "Yoruba", "Igbo", "Hausa", "Arabic"],
        "Tech Courses": ["Coding", "Stop motion animation", "Computer Appreciation", "Digital Entrepeneurship", "Animation", "YouTube for kids", "Graphic design", "Videography", "Comic/book creation", "Artificial Intelligence", "Chess"],
        "Support Programs": ["Bible study", "Counseling Programs", "Speech therapy", "Behavioral therapy", "Public speaking", "Adult education", "Communication skills", "English Proficiency"]
    };

    let subjectsHTML = `<h4 class="font-semibold text-gray-700 mt-2">Subjects</h4><div id="assign-subjects-container" class="space-y-2 border p-3 rounded bg-gray-50 max-h-48 overflow-y-auto">`;
    for (const category in subjectsByCategory) {
        subjectsHTML += `<details><summary class="font-semibold cursor-pointer text-sm">${category}</summary><div class="pl-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            ${subjectsByCategory[category].map(subject => `<div><label class="text-sm font-normal"><input type="checkbox" name="assign-subjects" value="${subject}"> ${subject}</label></div>`).join('')}
        </div></details>`;
    }
    subjectsHTML += `<div class="font-semibold pt-2 border-t"><label class="text-sm"><input type="checkbox" name="assign-subjects" value="Music"> Music</label></div></div>`;

    const modalHtml = `
        <div id="assign-modal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div class="relative p-8 bg-white w-full max-w-2xl rounded-lg shadow-xl">
                <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold" onclick="document.getElementById('assign-modal').remove()">&times;</button>
                <h3 class="text-xl font-bold mb-4">Assign New Student</h3>
                <form id="assign-student-form" class="space-y-3">
                    <div><label class="block text-sm font-medium">Assign to Tutor</label><select id="assign-tutor-select" class="mt-1 block w-full p-2 border rounded-md">${tutorOptions}</select></div>
                    <div><label class="block text-sm font-medium">Parent Name</label><input type="text" id="assign-parentName" class="mt-1 block w-full p-2 border rounded-md"></div>
                    <div><label class="block text-sm font-medium">Parent Phone</label><input type="tel" id="assign-parentPhone" class="mt-1 block w-full p-2 border rounded-md"></div>
                    <div><label class="block text-sm font-medium">Student Name</label><input type="text" id="assign-studentName" class="mt-1 block w-full p-2 border rounded-md"></div>
                    <div><label class="block text-sm font-medium">Grade</label><select id="assign-grade" class="mt-1 block w-full p-2 border rounded-md">${gradeOptions}</select></div>
                    ${subjectsHTML}
                    <div><label class="block text-sm font-medium">Days per Week</label><select id="assign-days" class="mt-1 block w-full p-2 border rounded-md"><option value="">Select Days</option>${daysOptions}</select></div>
                    <div id="assign-group-class-container" class="hidden"><label class="flex items-center space-x-2"><input type="checkbox" id="assign-group-class" class="rounded"><span class="text-sm font-semibold">Group Class</span></label></div>
                    <div><label class="block text-sm font-medium">Student Fee (₦)</label><input type="number" id="assign-studentFee" placeholder="Auto-calculated or enter manually" class="mt-1 block w-full p-2 border rounded-md"></div>
                    <div class="flex justify-end mt-4">
                        <button type="button" onclick="document.getElementById('assign-modal').remove()" class="mr-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button>
                        <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Assign Student</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const updateFee = () => {
        const selectedTutorEmail = document.getElementById('assign-tutor-select').value;
        const tutor = tutors.find(t => t.email === selectedTutorEmail);
        const grade = document.getElementById('assign-grade').value;
        const days = document.getElementById('assign-days').value;
        const groupClass = document.getElementById('assign-group-class').checked;
        const subjects = Array.from(document.querySelectorAll('input[name="assign-subjects"]:checked')).map(cb => cb.value);
        if (tutor && grade && days && subjects.length > 0) {
            const payScheme = getTutorPayScheme(tutor);
            const fee = calculateSuggestedFee({ grade, days, subjects, groupClass }, payScheme);
            if (fee > 0) document.getElementById('assign-studentFee').value = fee;
        }
    };

    document.getElementById('assign-subjects-container').addEventListener('change', () => {
        const subjects = Array.from(document.querySelectorAll('input[name="assign-subjects"]:checked')).map(cb => cb.value);
        document.getElementById('assign-group-class-container').classList.toggle('hidden', !findSpecializedSubject(subjects));
        updateFee();
    });

    ['assign-tutor-select', 'assign-grade', 'assign-days', 'assign-group-class'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateFee);
    });

    document.getElementById('assign-student-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const tutorEmail = document.getElementById('assign-tutor-select').value;
        const selectedTutor = tutors.find(t => t.email === tutorEmail);
        const studentData = {
            tutorEmail: tutorEmail,
            tutorName: selectedTutor.name,
            parentName: document.getElementById('assign-parentName').value.trim(),
            parentPhone: document.getElementById('assign-parentPhone').value.trim(),
            studentName: document.getElementById('assign-studentName').value.trim(),
            grade: document.getElementById('assign-grade').value,
            days: document.getElementById('assign-days').value,
            subjects: Array.from(document.querySelectorAll('input[name="assign-subjects"]:checked')).map(cb => cb.value),
            groupClass: document.getElementById('assign-group-class').checked,
            studentFee: Number(document.getElementById('assign-studentFee').value) || 0,
            status: 'approved',
            summerBreak: false,
        };

        if (!studentData.tutorEmail || !studentData.parentName || !studentData.studentName || !studentData.grade || !studentData.days || studentData.subjects.length === 0) {
            alert("Please fill out all fields, including at least one subject.");
            return;
        }

        try {
            await addDoc(collection(db, "students"), studentData);
            alert(`Student "${studentData.studentName}" assigned to ${studentData.tutorName} successfully!`);
            document.getElementById('assign-modal').remove();
            invalidateCache('students');
            fetchAndRenderDirectory();
        } catch (error) {
            console.error("Error assigning student: ", error);
            alert("Failed to assign student. Check the console for details.");
        }
    });
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
                <td class="px-6 py-4">
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
                const giftAmount = parseFloat(giftInput);
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
            reportsByTutor[report.tutorEmail] = { name: report.tutorName || report.tutorEmail, reports: [] };
        }
        reportsByTutor[report.tutorEmail].reports.push(report);
    });

    document.getElementById('report-tutor-count').textContent = Object.keys(reportsByTutor).length;
    document.getElementById('report-total-count').textContent = reports.length;

    const canDownload = window.userData.permissions?.actions?.canDownloadReports === true;
    reportsListContainer.innerHTML = Object.values(reportsByTutor).map(tutorData => {
        const reportLinks = tutorData.reports.map(report => {
            const buttonHTML = canDownload
                ? `<button class="download-report-btn bg-green-500 text-white px-3 py-1 text-sm rounded" data-report-id="${report.id}">Download</button>`
                : `<button class="view-report-btn bg-gray-500 text-white px-3 py-1 text-sm rounded" data-report-id="${report.id}">View</button>`;
            return `<li class="flex justify-between items-center p-2 bg-gray-50 rounded">${report.studentName}<span>${buttonHTML}</span></li>`;
        }).join('');
        
        const zipButtonHTML = canDownload
            ? `<div class="p-4 border-t"><button class="zip-reports-btn bg-blue-600 text-white px-4 py-2 text-sm rounded w-full hover:bg-blue-700" data-tutor-email="${tutorData.reports[0].tutorEmail}">Zip & Download All Reports</button></div>`
            : '';

        return `<details class="border rounded-lg">
                    <summary class="p-4 cursor-pointer font-semibold">${tutorData.name} (${tutorData.reports.length} reports)</summary>
                    <div class="p-4 border-t"><ul class="space-y-2">${reportLinks}</ul></div>
                    ${zipButtonHTML}
                </details>`;
    }).join('');

    document.querySelectorAll('.download-report-btn').forEach(button => button.addEventListener('click', (e) => { e.stopPropagation(); viewReportInNewTab(e.target.dataset.reportId, true); }));
    document.querySelectorAll('.view-report-btn').forEach(button => button.addEventListener('click', (e) => { e.stopPropagation(); viewReportInNewTab(e.target.dataset.reportId, false); }));
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

    try {
        if (!sessionCache.breakStudents) {
            listContainer.innerHTML = `<p class="text-center text-gray-500 py-10">Fetching student break status...</p>`;
            const snapshot = await getDocs(query(collection(db, "students"), where("summerBreak", "==", true)));
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
    if (!listContainer) return;

    const canEndBreak = window.userData.permissions?.actions?.canEndBreak === true;
    if (breakStudents.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-gray-500">No students are on break.</p>`;
        return;
    }
    
    listContainer.innerHTML = breakStudents.map(student => {
        const endBreakButton = canEndBreak 
            ? `<button class="end-break-btn bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors" data-student-id="${student.id}">End Break</button>`
            : '';
        return `
            <div class="border p-4 rounded-lg flex justify-between items-center bg-gray-50">
                <div>
                    <p><strong>Student:</strong> ${student.studentName}</p>
                    <p><strong>Tutor:</strong> ${student.tutorEmail}</p>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="text-yellow-600 font-semibold px-3 py-1 bg-yellow-100 rounded-full text-sm">On Break</span>
                     ${endBreakButton}
                </div>
            </div>
        `;
    }).join('');
    if (canEndBreak) {
        document.querySelectorAll('.end-break-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const studentId = e.target.dataset.studentId;
                if (confirm("Are you sure you want to end the summer break for this student?")) {
                    try {
                        await updateDoc(doc(db, "students", studentId), { summerBreak: false, lastBreakEnd: Timestamp.now() });
                        document.getElementById('break-status-message').textContent = `Break ended successfully.`;
                        document.getElementById('break-status-message').className = 'text-center font-semibold mb-4 text-green-600';
                        invalidateCache('breakStudents'); // Invalidate cache
                        fetchAndRenderBreakStudents(); // Re-render list
                    } catch (error) {
                        console.error("Error ending summer break:", error);
                        document.getElementById('break-status-message').textContent = "Failed to end summer break.";
                        document.getElementById('break-status-message').className = 'text-center font-semibold mb-4 text-red-600';
                    }
                }
            });
        });
    }
}


// ##################################
// # REPORT GENERATION & ZIPPING
// ##################################

// ##### CORRECTED AND FINALIZED FUNCTION #####
async function generateReportHTML(reportId) {
    const reportDoc = await getDoc(doc(db, "tutor_submissions", reportId));
    if (!reportDoc.exists()) throw new Error("Report not found!");
    const reportData = reportDoc.data();

    // Define the sections to be displayed in the report
    const reportSections = {
        "INTRODUCTION": reportData.introduction,
        "TOPICS & REMARKS": reportData.topics,
        "PROGRESS & ACHIEVEMENTS": reportData.progress,
        "STRENGTHS AND WEAKNESSES": reportData.strengthsWeaknesses,
        "RECOMMENDATIONS": reportData.recommendations,
        "GENERAL TUTOR'S COMMENTS": reportData.generalComments
    };

    // Generate the HTML for each section, ensuring "N/A" for empty content
    const sectionsHTML = Object.entries(reportSections).map(([title, content]) => {
        // Sanitize content to prevent HTML injection and format newlines
        const sanitizedContent = content ? String(content).replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
        const displayContent = (sanitizedContent && sanitizedContent.trim() !== '') ? sanitizedContent.replace(/\n/g, '<br>') : 'N/A';
        return `
            <div class="report-section">
                <h2>${title}</h2>
                <p>${displayContent}</p>
            </div>
        `;
    }).join('');

    const logoUrl = "https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg";
    const reportTemplate = `
        <html>
        <head>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; }
                .report-container { max-width: 800px; margin: auto; padding: 20px; }
                .header { text-align: center; margin-bottom: 40px; }
                .header img { height: 80px; }
                .header h1 { color: #166534; margin: 0; font-size: 24px; }
                .header h2 { color: #15803d; margin: 10px 0; font-size: 28px; }
                .header p { margin: 5px 0; color: #555; }
                .student-info { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 10px 20px; 
                    margin-bottom: 30px; 
                    background-color: #f9f9f9;
                    border: 1px solid #eee;
                    padding: 15px;
                    border-radius: 8px;
                }
                .student-info p { margin: 5px 0; }
                .report-section {
                    page-break-inside: avoid; /* CRITICAL: Prevents section from splitting across pages */
                    margin-bottom: 20px;
                    border: 1px solid #e5e7eb;
                    padding: 15px;
                    border-radius: 8px;
                }
                .report-section h2 { 
                    font-size: 18px; 
                    font-weight: bold; 
                    color: #16a34a; 
                    margin-top: 0; 
                    padding-bottom: 8px;
                    border-bottom: 2px solid #d1fae5;
                }
                .report-section p { line-height: 1.6; white-space: pre-wrap; margin-top: 0; }
                .footer { text-align: right; margin-top: 40px; }
            </style>
        </head>
        <body>
            <div class="report-container">
                <div class="header">
                    <img src="${logoUrl}" alt="Company Logo">
                    <h2>Blooming Kids House</h2>
                    <h1>MONTHLY LEARNING REPORT</h1>
                    <p>Date: ${new Date(reportData.submittedAt.seconds * 1000).toLocaleDateString()}</p>
                </div>
                <div class="student-info">
                    <p><strong>Student's Name:</strong> ${reportData.studentName || 'N/A'}</p>
                    <p><strong>Parent's Name:</strong> ${reportData.parentName || 'N/A'}</p>
                    <p><strong>Parent's Phone:</strong> ${reportData.parentPhone || 'N/A'}</p>
                    <p><strong>Grade:</strong> ${reportData.grade || 'N/A'}</p>
                    <p><strong>Tutor's Name:</strong> ${reportData.tutorName || 'N/A'}</p>
                </div>
                ${sectionsHTML}
                <div class="footer">
                    <p>Best regards,</p>
                    <p><strong>${reportData.tutorName || 'N/A'}</strong></p>
                </div>
            </div>
        </body>
        </html>
    `;
    return { html: reportTemplate, reportData: reportData };
}


async function viewReportInNewTab(reportId, shouldDownload = false) {
    try {
        const { html, reportData } = await generateReportHTML(reportId);

        if (shouldDownload) {
             const options = {
                margin:       0.5,
                filename:     `${reportData.studentName}_report.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            html2pdf().from(html).set(options).save();
        } else {
            const newWindow = window.open();
            newWindow.document.write(html);
            newWindow.document.close();
        }
    } catch (error) {
        console.error("Error viewing/downloading report:", error);
        alert(`Error: ${error.message}`);
    }
}


async function zipAndDownloadTutorReports(reports, tutorName, buttonElement) {
    const originalButtonText = buttonElement.textContent;
    buttonElement.textContent = 'Zipping... (0%)';
    buttonElement.disabled = true;

    try {
        const zip = new JSZip();
        let filesGenerated = 0;
        const reportGenerationPromises = reports.map(async (report) => {
            const { html, reportData } = await generateReportHTML(report.id);
            // Use the same improved options for consistency
            const options = {
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            const pdfBlob = await html2pdf().from(html).set(options).output('blob');
            filesGenerated++;
            buttonElement.textContent = `Zipping... (${Math.round((filesGenerated / reports.length) * 100)}%)`;
            return { name: `${reportData.studentName}_Report_${report.id.substring(0,5)}.pdf`, blob: pdfBlob };
        });
        const generatedPdfs = await Promise.all(reportGenerationPromises);
        generatedPdfs.forEach(pdf => zip.file(pdf.name, pdf.blob));
        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, `${tutorName}_All_Reports.zip`);
    } catch (error) {
        console.error("Error creating zip file:", error);
        alert("Failed to create zip file. See console for details.");
    } finally {
        buttonElement.textContent = originalButtonText;
        buttonElement.disabled = false;
    }
}


// ##################################
// # AUTHENTICATION & INITIALIZATION
// ##################################

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        onSnapshot(staffDocRef, (docSnap) => {
            if (docSnap.exists() && docSnap.data().role !== 'pending') {
                const staffData = docSnap.data();
                window.userData = staffData;
                
                document.getElementById('welcome-message').textContent = `Welcome, ${staffData.name}`;
                document.getElementById('user-role').textContent = `Role: ${capitalize(staffData.role)}`;

                const allNavItems = {
                    navTutorManagement: { fn: renderManagementTutorView, perm: 'viewTutorManagement' },
                    navPayAdvice: { fn: renderPayAdvicePanel, perm: 'viewPayAdvice' },
                    navTutorReports: { fn: renderTutorReportsPanel, perm: 'viewTutorReports' },
                    navSummerBreak: { fn: renderSummerBreakPanel, perm: 'viewSummerBreak' },
                    navPendingApprovals: { fn: renderPendingApprovalsPanel, perm: 'viewPendingApprovals' }
                };

                const navContainer = document.querySelector('nav');
                const originalNavButtons = {};
                if(navContainer) {
                    navContainer.querySelectorAll('.nav-btn').forEach(btn => originalNavButtons[btn.id] = btn.textContent);
                    navContainer.innerHTML = '';
                    let firstVisibleTab = null;

                    Object.entries(allNavItems).forEach(([id, item]) => {
                        if (window.userData.permissions?.tabs?.[item.perm]) {
                            if (!firstVisibleTab) firstVisibleTab = id;
                            const button = document.createElement('button');
                            button.id = id;
                            button.className = 'nav-btn text-lg font-semibold text-gray-500 hover:text-green-700';
                            button.textContent = originalNavButtons[id];
                            navContainer.appendChild(button);
                            
                            button.addEventListener('click', () => {
                                document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
                                button.classList.add('active');
                                item.fn(mainContent);
                            });
                        }
                    });

                    if (firstVisibleTab) {
                        const activeNav = document.querySelector('.nav-btn.active');
                        const activeNavId = activeNav?.id;
                        if (!activeNav || !document.getElementById(activeNavId)) {
                            document.getElementById(firstVisibleTab).click();
                        } else {
                            const currentItem = allNavItems[activeNavId];
                            if(currentItem) currentItem.fn(mainContent);
                        }
                    } else {
                        if (mainContent) mainContent.innerHTML = `<p class="text-center">You have no permissions assigned.</p>`;
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

        if(logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
    } else {
        window.location.href = "management-auth.html";
    }
});


// [End Updated management.js File]
