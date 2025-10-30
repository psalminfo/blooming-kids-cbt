import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, deleteDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// --- Global state to hold report submission status ---
let isSubmissionEnabled = false;
let isTutorAddEnabled = false;
let isSummerBreakEnabled = false;
let isBypassApprovalEnabled = false;
// NEW: Global state for new admin settings
let showStudentFees = false;
let showEditDeleteButtons = false;

// --- New Global Constant for Transition Students ---
const TRANSITION_STUDENT_STATUS = "Transitioning Class";

// --- Pay Scheme Configuration ---
const PAY_SCHEMES = {
    NEW_TUTOR: {
        academic: {
            "Preschool-Grade 2": {2: 50000, 3: 60000, 5: 100000},
            "Grade 3-8": {2: 60000, 3: 70000, 5: 110000},
            "Subject Teachers": {1: 30000, 2: 60000, 3: 70000}
        },
        specialized: {
            individual: {
                "Music": 30000,
                "Native Language": 20000,
                "Foreign Language": 25000,
                "Coding": 30000,
                "ICT": 10000,
                "Chess": 25000,
                "Public Speaking": 25000,
                "English Proficiency": 25000,
                "Counseling Programs": 25000
            },
            group: {
                "Music": 25000,
                "Native Language": 20000,
                "Foreign Language": 20000,
                "Chess": 20000,
                "Public Speaking": 20000,
                "English Proficiency": 20000,
                "Counseling Programs": 20000
            }
        }
    },
    OLD_TUTOR: {
        academic: {
            "Preschool-Grade 2": {2: 60000, 3: 70000, 5: 110000},
            "Grade 3-8": {2: 70000, 3: 80000, 5: 120000},
            "Subject Teachers": {1: 35000, 2: 70000, 3: 90000}
        },
        specialized: {
            individual: {
                "Music": 35000,
                "Native Language": 25000,
                "Foreign Language": 30000,
                "Coding": 35000,
                "ICT": 12000,
                "Chess": 30000,
                "Public Speaking": 30000,
                "English Proficiency": 30000,
                "Counseling Programs": 30000
            },
            group: {
                "Music": 25000,
                "Native Language": 20000,
                "Foreign Language": 20000,
                "Chess": 20000,
                "Public Speaking": 20000,
                "English Proficiency": 20000,
                "Counseling Programs": 20000
            }
        }
    },
    MANAGEMENT: {
        academic: {
            "Preschool-Grade 2": {2: 70000, 3: 85000, 5: 120000},
            "Grade 3-8": {2: 80000, 3: 90000, 5: 130000},
            "Subject Teachers": {1: 40000, 2: 80000, 3: 100000}
        },
        specialized: {
            individual: {
                "Music": 40000,
                "Native Language": 30000,
                "Foreign Language": 35000,
                "Coding": 40000,
                "Chess": 35000,
                "Public Speaking": 35000,
                "English Proficiency": 35000,
                "Counseling Programs": 35000
            },
            group: {
                "Music": 25000,
                "Native Language": 20000,
                "Foreign Language": 20000,
                "Chess": 20000,
                "Public Speaking": 20000,
                "English Proficiency": 20000,
                "Counseling Programs": 20000
            }
        }
    }
};

// --- Subject Categorization ---
const SUBJECT_CATEGORIES = {
    "Native Language": ["Yoruba", "Igbo", "Hausa"],
    "Foreign Language": ["French", "German", "Spanish", "Arabic"],
    "Specialized": ["Music", "Coding","ICT", "Chess", "Public Speaking", "English Proficiency", "Counseling Programs"]
};

// ##################################################################
// # SECTION 0: UTILITY & AUTO-CLEANUP LOGIC (MODIFIED/NEW)
// ##################################################################

// --- Local Storage Functions for Report Persistence ---
const getLocalReportsKey = (tutorEmail) => `savedReports_${tutorEmail}`;

function saveReportsToLocalStorage(tutorEmail, reports) {
    try {
        const key = getLocalReportsKey(tutorEmail);
        localStorage.setItem(key, JSON.stringify(reports));
    } catch (error) {
        console.warn('Error saving to local storage:', error);
    }
}

function loadReportsFromLocalStorage(tutorEmail) {
    try {
        const key = getLocalReportsKey(tutorEmail);
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : {};
    } catch (error) {
        console.warn('Error loading from local storage, using empty object:', error);
        return {};
    }
}

function clearAllReportsFromLocalStorage(tutorEmail) {
    try {
        const key = getLocalReportsKey(tutorEmail);
        localStorage.removeItem(key);
    } catch (error) {
        console.warn('Error clearing local storage:', error);
    }
}

/**
 * Checks if the current date is the 1st, 2nd, or 3rd of the month and
 * automatically removes students marked as isTransitioning from a previous month.
 */
async function runMonthlyAutoCleanup() {
    const now = new Date();
    const dayOfMonth = now.getDate();
    const currentMonthYear = now.toISOString().slice(0, 7); // YYYY-MM
    
    // Only run cleanup logic on the 1st, 2nd, or 3rd of the month
    if (dayOfMonth >= 1 && dayOfMonth <= 3) {
        console.log(`[Auto-Cleanup] Running cleanup for previous month's transition students.`);
        
        try {
            const studentsRef = collection(db, "students");
            
            // Query for all students marked as transitioning
            const q = query(studentsRef, where("isTransitioning", "==", true));
            const querySnapshot = await getDocs(q);
            
            const batch = writeBatch(db);
            let studentsRemoved = 0;

            querySnapshot.forEach(docSnap => {
                const student = docSnap.data();
                const transitionAddedDate = student.transitionAddedDate; // YYYY-MM-DD format from submission
                
                if (transitionAddedDate) {
                    const addedMonthYear = transitionAddedDate.slice(0, 7); // YYYY-MM

                    // Check if the student was added in a month *before* the current one
                    if (addedMonthYear < currentMonthYear) {
                        const studentRef = doc(db, "students", docSnap.id);
                        batch.delete(studentRef);
                        studentsRemoved++;
                        console.log(`[Auto-Cleanup] Deleting transition student: ${student.studentName} (Added: ${addedMonthYear})`);
                    }
                }
            });
            
            if (studentsRemoved > 0) {
                await batch.commit();
                showCustomAlert(`${studentsRemoved} temporary students were automatically removed from the database.`);
                // If on student list view, refresh it
                if (document.getElementById('student-list-view')?.style.display !== 'none') {
                    renderStudentDatabase(document.getElementById('mainContent'), window.tutorData);
                }
            } else {
                 console.log(`[Auto-Cleanup] No transition students from previous months found for removal.`);
            }

        } catch (error) {
            console.error("[Auto-Cleanup] Error during monthly cleanup:", error);
            // Don't show critical error to user unless network failure
        }
    } else {
        console.log(`[Auto-Cleanup] Not running cleanup on day ${dayOfMonth}.`);
    }
}

// --- Employment Date Functions ---
function shouldShowEmploymentPopup(tutor) {
    // Don't show if already has employment date
    if (tutor.employmentDate) return false;
    
    // Show on first login each month until they provide it
    const lastPopupShown = localStorage.getItem(`employmentPopup_${tutor.email}`);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    return !lastPopupShown || lastPopupShown !== currentMonth;
}

function showEmploymentDatePopup(tutor) {
    const popupHTML = `
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-md mx-auto">
                <h3 class="text-xl font-bold mb-4">Employment Information</h3>
                <p class="text-sm text-gray-600 mb-4">Please provide your employment start date to help us calculate your payments accurately.</p>
                <div class="space-y-4">
                    <div>
                        <label class="block font-semibold">Month & Year of Employment</label>
                        <input type="month" id="employment-date" class="w-full mt-1 p-2 border rounded" 
                               max="${new Date().toISOString().slice(0, 7)}">
                    </div>
                    <div class="flex justify-end space-x-2 mt-6">
                        <button id="save-employment-btn" class="bg-green-600 text-white px-6 py-2 rounded">Save</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const popup = document.createElement('div');
    popup.innerHTML = popupHTML;
    document.body.appendChild(popup);

    document.getElementById('save-employment-btn').addEventListener('click', async () => {
        const employmentDate = document.getElementById('employment-date').value;
        if (!employmentDate) {
            showCustomAlert('Please select your employment month and year.');
            return;
        }

        try {
            const tutorRef = doc(db, "tutors", tutor.id);
            await updateDoc(tutorRef, { employmentDate: employmentDate });
            localStorage.setItem(`employmentPopup_${tutor.email}`, new Date().toISOString().slice(0, 7));
            popup.remove();
            showCustomAlert('Employment date saved successfully!');
            window.tutorData.employmentDate = employmentDate;
        } catch (error) {
            console.error("Error saving employment date:", error);
            showCustomAlert('Error saving employment date. Please try again.');
        }
    });
}

function getTutorPayScheme(tutor) {
    if (tutor.isManagementStaff) return PAY_SCHEMES.MANAGEMENT;
    
    if (!tutor.employmentDate) return PAY_SCHEMES.NEW_TUTOR;
    
    const employmentDate = new Date(tutor.employmentDate + '-01');
    const currentDate = new Date();
    const monthsDiff = (currentDate.getFullYear() - employmentDate.getFullYear()) * 12 + 
                      (currentDate.getMonth() - employmentDate.getMonth());
    
    return monthsDiff >= 12 ? PAY_SCHEMES.OLD_TUTOR : PAY_SCHEMES.NEW_TUTOR;
}

function calculateSuggestedFee(student, payScheme) {
    const grade = student.grade;
    const days = parseInt(student.days) || 0;
    const subjects = student.subjects || [];
    
    // Check for specialized subjects first
    const specializedSubject = findSpecializedSubject(subjects);
    if (specializedSubject) {
        const isGroupClass = student.groupClass || false;
        const feeType = isGroupClass ? 'group' : 'individual';
        return payScheme.specialized[feeType][specializedSubject.category] || 0;
    }
    
    // Handle academic subjects
    let gradeCategory = "Grade 3-8"; // Default
    
    if (grade === "Preschool" || grade === "Kindergarten" || grade.includes("Grade 1") || grade.includes("Grade 2")) {
        gradeCategory = "Preschool-Grade 2";
    } else if (parseInt(grade.replace('Grade ', '')) >= 9) {
        return 0; // Manual entry for Grade 9+
    }
    
    // Check if it's subject teaching (Math, English, Science for higher grades)
    const isSubjectTeacher = subjects.some(subj => ["Math", "English", "Science"].includes(subj)) && 
                            parseInt(grade.replace('Grade ', '')) >= 5;
    
    if (isSubjectTeacher) {
        return payScheme.academic["Subject Teachers"][days] || 0;
    } else {
        return payScheme.academic[gradeCategory][days] || 0;
    }
}

function findSpecializedSubject(subjects) {
    for (const [category, subjectList] of Object.entries(SUBJECT_CATEGORIES)) {
        for (const subject of subjects) {
            if (subjectList.includes(subject)) {
                return { category, subject };
            }
        }
    }
    return null;
}

// Function to get current month for reports
function getCurrentMonthYear() {
    const now = new Date();
    return now.toLocaleString('default', { month: 'long', year: 'numeric' });
}

// Listen for changes to the admin settings in real-time
const settingsDocRef = doc(db, "settings", "global_settings");
onSnapshot(settingsDocRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        isSubmissionEnabled = data.isReportEnabled;
        isTutorAddEnabled = data.isTutorAddEnabled;
        isSummerBreakEnabled = data.isSummerBreakEnabled;
        isBypassApprovalEnabled = data.bypassPendingApproval;
        // NEW: Update the new global settings
        showStudentFees = data.showStudentFees;
        showEditDeleteButtons = data.showEditDeleteButtons;

        // Re-render the student database if the page is currently active
        const mainContent = document.getElementById('mainContent');
        if (mainContent.querySelector('#student-list-view')?.style.display !== 'none') {
            renderStudentDatabase(mainContent, window.tutorData);
        }
    }
});

// ##################################################################
// # SECTION 1: TUTOR DASHBOARD
// ##################################################################
function renderTutorDashboard(container, tutor) {
// ... existing renderTutorDashboard content ...
// (omitted for brevity, no changes needed here)
}

// NEW: Function to sync creative writing comments to student_results
async function syncCreativeWritingToStudentResults(submissionData, tutorReport) {
// ... existing syncCreativeWritingToStudentResults content ...
// (omitted for brevity, no changes needed here)
}

async function loadTutorReports(tutorEmail, parentName = null) {
// ... existing loadTutorReports content ...
// (omitted for brevity, no changes needed here)
}


// ##################################################################
// # SECTION 2: STUDENT DATABASE (MODIFIED)
// ##################################################################

// Helper function to generate the new student form fields (reused for transition students)
function getNewStudentFormFields() {
// ... existing getNewStudentFormFields content ...
// (omitted for brevity, no changes needed here)
}

// Function to handle grade string formatting
function cleanGradeString(grade) {
// ... existing cleanGradeString content ...
// (omitted for brevity, no changes needed here)
}

// Function to show the edit student modal
function showEditStudentModal(student) {
// ... existing showEditStudentModal content ...
// (omitted for brevity, no changes needed here)
}

// Function to show the delete student confirmation modal
function showDeleteStudentModal(student) {
// ... existing showDeleteStudentModal content ...
// (omitted for brevity, no changes needed here)
}

// Function to handle the actual deletion
async function deleteStudent(studentId, collectionName) {
// ... existing deleteStudent content ...
// (omitted for brevity, no changes needed here)
}

// Function to update the student data
async function updateStudentData(studentId, collectionName, updatedData) {
// ... existing updateStudentData content ...
// (omitted for brevity, no changes needed here)
}


// Function to render the student list (MODIFIED)
async function renderStudentDatabase(container, tutor) {
    const studentListView = document.getElementById('student-list-view');
    studentListView.innerHTML = '<p class="text-center text-gray-500">Loading student list...</p>';

    let students = [];
    try {
        // Fetch students
        const studentsRef = collection(db, "students");
        const q = query(studentsRef, where("tutorEmail", "==", tutor.email));
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach(doc => {
            students.push({ id: doc.id, collection: 'students', ...doc.data() });
        });
        
        window.studentsInDB = students; // Store globally for modal access

    } catch (error) {
        console.error("Error fetching students:", error);
        studentListView.innerHTML = `<p class="text-center text-red-500">Failed to load student list. ${getErrorMessage(error)}</p>`;
        return;
    }
    
    // Sort students by name
    students.sort((a, b) => a.studentName.localeCompare(b.studentName));
    
    let listHTML = students.length > 0 ? '' : '<p class="text-center text-gray-500">You have no active students.</p>';

    students.forEach(student => {
        const isPending = student.status === 'pending_approval';
        const isTransitioning = student.isTransitioning || false; // NEW FLAG CHECK
        
        // 1. Determine card styling (MODIFIED)
        let cardBgClass = 'bg-white';
        let borderColorClass = 'border-gray-200';
        let statusText = isPending ? 'Pending Approval' : 'Regular Class';
        let statusClass = isPending ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';

        if (isTransitioning) {
            cardBgClass = 'bg-transition-orange border'; // Orange background for transition students
            borderColorClass = 'border-transition-orange';
            statusText = TRANSITION_STUDENT_STATUS;
            statusClass = 'bg-yellow-200 text-yellow-800';
        }
        
        // 2. Determine action button (MODIFIED)
        let actionButtonHTML = '';
        if (isSubmissionEnabled && !isSummerBreakEnabled && !isPending && !isTransitioning) {
            // Regular student: Enter Report
            actionButtonHTML = `
                <button class="report-btn bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700" 
                        data-student-id="${student.id}" data-is-transitioning="${isTransitioning}">
                    Enter Report
                </button>
            `;
        } else if (isTransitioning) {
            // Transition student: Confirm Fee
            actionButtonHTML = `
                <button class="report-btn bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600" 
                        data-student-id="${student.id}" data-is-transitioning="${isTransitioning}">
                    Confirm Fee 🟧
                </button>
            `;
        } else if (isPending && !isBypassApprovalEnabled && isTutorAddEnabled) {
            // Pending student: Cannot Enter Report (but can be edited if needed)
            actionButtonHTML = `<button class="bg-gray-400 text-white px-3 py-1 rounded text-sm cursor-not-allowed" disabled>Awaiting Approval</button>`;
        } else if (isPending && isBypassApprovalEnabled) {
            // Pending student (Bypass): Show Complete Profile
            actionButtonHTML = `
                <button class="complete-profile-btn bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600" 
                        data-student-id="${student.id}" data-collection="students">
                    Complete Profile
                </button>
            `;
        } else if (isSummerBreakEnabled) {
             actionButtonHTML = `<button class="bg-gray-400 text-white px-3 py-1 rounded text-sm cursor-not-allowed" disabled>Summer Break</button>`;
        } else if (!isSubmissionEnabled) {
             actionButtonHTML = `<button class="bg-gray-400 text-white px-3 py-1 rounded text-sm cursor-not-allowed" disabled>Reports Closed</button>`;
        }


        // 3. Student Card HTML (MODIFIED for transition student lines)
        const studentCardHTML = `
            <div id="student-${student.id}" class="border rounded-lg p-4 shadow-md mb-4 ${cardBgClass} ${borderColorClass}">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-lg font-bold">
                            ${student.studentName} (${student.grade})
                        </h3>
                        <p class="text-sm text-gray-500">
                            Subjects: ${student.subjects.join(' | ')} | Days: ${student.days} days/week
                        </p>
                        ${showStudentFees ? `<p class="text-sm font-semibold">Fee: ₦${student.studentFee.toLocaleString()}</p>` : ''}
                        
                        ${isTransitioning ? `<p class="text-transition-orange font-semibold mt-1">🟧 Transitioning Class</p>` : ''} 
                        
                        <p class="mt-2 text-sm">
                            Status: <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">${statusText}</span>
                        </p>
                    </div>
                    <div class="flex flex-col space-y-2">
                        ${actionButtonHTML}
                        ${showEditDeleteButtons ? `
                            <button class="edit-student-btn bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600" 
                                    data-student-id="${student.id}" data-collection="students">
                                Edit
                            </button>
                            <button class="delete-student-btn bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600" 
                                    data-student-id="${student.id}" data-collection="students">
                                Delete
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        listHTML += studentCardHTML;
    });

    studentListView.innerHTML = listHTML;
    
    // Attach event listeners for report, edit, and delete buttons
    attachReportListeners(tutor);
    attachEditDeleteListeners(tutor);
}

// Function to handle submission of a standard report
async function handleReportSubmission(student) {
// ... existing handleReportSubmission content ...
// (omitted for brevity, no changes needed here)
}


// ##################################################################
// # SECTION 3: ADD TRANSITION STUDENT LOGIC (NEW)
// ##################################################################

function setupTransitionStudentView(container) {
    const transitionForm = document.getElementById('transition-student-form');
    if (!transitionForm) return; // Safe guard

    // 1. Insert form fields (reusing getNewStudentFormFields logic)
    const formFieldsContainer = document.getElementById('transition-student-form-fields');
    if (formFieldsContainer) {
        formFieldsContainer.innerHTML = getNewStudentFormFields();
        
        // Ensure fee selection is visible and clear suggested fee listeners
        const feeInput = document.getElementById('new-student-fee');
        if (feeInput) feeInput.closest('div').style.display = 'block'; 
    }
    
    // 2. Attach submission handler
    transitionForm.removeEventListener('submit', handleTransitionStudentSubmission); // Avoid double-binding
    transitionForm.addEventListener('submit', handleTransitionStudentSubmission);
    
    // 3. Attach cancel button listener
    document.getElementById('cancel-transition-btn')?.addEventListener('click', () => {
        showView('student-list-view');
        transitionForm.reset();
    });
}

async function handleTransitionStudentSubmission(e) {
    e.preventDefault();
    
    if (!isTutorAddEnabled) {
        showCustomAlert("Tutor student adding is currently disabled by the Admin.");
        return;
    }

    const tutor = window.tutorData;

    // 1. Get Form Data (reusing field IDs)
    const parentName = document.getElementById('new-parent-name')?.value.trim();
    const parentPhone = document.getElementById('new-parent-phone')?.value.trim();
    const studentName = document.getElementById('new-student-name')?.value.trim();
    const grade = document.getElementById('new-student-grade')?.value.trim();
    const days = document.getElementById('new-student-days')?.value.trim();
    const feeInput = document.getElementById('new-student-fee')?.value.trim().replace(/,/g, '');
    const studentFee = parseInt(feeInput) || 0;
    
    // Get subjects
    const subjectCheckboxes = document.querySelectorAll('#transition-student-form input[name="subjects"]:checked');
    const subjects = Array.from(subjectCheckboxes).map(cb => cb.value);

    // Get group class status
    const groupClassCheckbox = document.getElementById('new-student-group-class');
    const groupClass = groupClassCheckbox ? groupClassCheckbox.checked : false;

    // 2. Validation
    if (!parentName || !parentPhone || !studentName || !grade || !days || subjects.length === 0 || studentFee === 0) {
        showCustomAlert('Please fill in all required fields and select a fee.');
        return;
    }
    
    const submitBtn = document.getElementById('add-transition-student-btn');
    submitBtn.textContent = 'Adding...';
    submitBtn.disabled = true;

    try {
        const studentData = {
            tutorEmail: tutor.email,
            tutorName: tutor.name,
            parentName: parentName,
            parentPhone: parentPhone,
            studentName: studentName,
            grade: cleanGradeString(grade),
            days: days,
            subjects: subjects,
            groupClass: groupClass,
            studentFee: studentFee,
            isTransitioning: true, // ⭐ REQUIRED: Flag for transition student
            transitionAddedDate: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
            status: 'pending_approval',
            createdAt: new Date(),
            lastReportSubmitted: null, // Track last report date
        };

        // Add to the main students collection
        await addDoc(collection(db, "students"), studentData);

        showCustomAlert(`Transition Student ${studentName} added successfully!`);
        document.getElementById('transition-student-form').reset();
        showView('student-list-view'); // Navigate back to the student list
        renderStudentDatabase(document.getElementById('mainContent'), tutor); // Refresh student list

    } catch (error) {
        console.error("Error adding transition student:", error);
        showCustomAlert('Error adding transition student. Please try again.');
    } finally {
        submitBtn.textContent = 'Add Transition Student 🟧';
        submitBtn.disabled = false;
    }
}


// ##################################################################
// # SECTION 4: MODAL LOGIC (MODIFIED/NEW)
// ##################################################################

// Function to show the Report/Fee Confirmation Modal (MODIFIED)
function showReportModal(student, isTransitioning) {
    // Determine which modal to show
    const modalId = isTransitioning ? 'confirm-fee-modal' : 'report-modal';
    const modal = document.getElementById(modalId);
    
    if (!modal) {
        console.error(`Modal element ${modalId} not found.`);
        return;
    }

    if (isTransitioning) {
        // Handle Transition Fee Confirmation Modal (Simplified)
        document.getElementById('confirm-fee-header').textContent = `Confirm Fee for ${student.studentName}`;
        document.getElementById('confirm-fee-student-name').value = student.studentName;
        document.getElementById('confirm-fee-amount').value = student.studentFee ? student.studentFee.toLocaleString() : '';
        
        // Setup bank details
        document.getElementById('confirm-fee-bank-name').textContent = window.tutorData.bankName || 'N/A';
        document.getElementById('confirm-fee-account-number').textContent = window.tutorData.accountNumber || 'N/A';
        document.getElementById('confirm-fee-account-name').textContent = window.tutorData.accountName || 'N/A';
        
        // 2. Attach Transition Fee Submission Handler
        const submitBtn = document.getElementById('submit-transition-fee-btn');
        const closeBtn = document.getElementById('close-confirm-fee-modal');

        // Clear previous listeners and attach new ones (safer than removeEventListener)
        submitBtn.replaceWith(submitBtn.cloneNode(true));
        closeBtn.replaceWith(closeBtn.cloneNode(true));
        
        document.getElementById('submit-transition-fee-btn').addEventListener('click', () => 
            handleTransitionFeeSubmission(student) // New handler
        );
        document.getElementById('close-confirm-fee-modal').addEventListener('click', () => 
            modal.classList.add('hidden')
        );

    } else {
        // Existing Report Modal Logic (Detailed Report for Regular Students)
        // ... [Existing Logic: setting up report-modal fields, calculating suggested fee, attaching report submission handler] ...
        
        // NOTE: The implementation of the existing modal logic is assumed to be here.
        // For a full file, the original logic from the first fetch would be included here.
        // For this update, I will assume the original logic is present and not repeat it, but 
        // focus on the new handler structure.
    }

    // Show the appropriate modal
    modal.classList.remove('hidden');
}


// New handler for transition student fee submission
async function handleTransitionFeeSubmission(student) {
    const modal = document.getElementById('confirm-fee-modal');
    const submitBtn = document.getElementById('submit-transition-fee-btn');
    const feeInput = document.getElementById('confirm-fee-amount').value.trim().replace(/,/g, '');
    const confirmedFee = parseInt(feeInput) || 0;
    
    if (confirmedFee === 0) {
        showCustomAlert('Please enter a valid confirmed fee.');
        return;
    }
    
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    const tutor = window.tutorData;

    try {
        const submissionData = {
            tutorEmail: tutor.email,
            tutorName: tutor.name,
            studentName: student.studentName,
            parentName: student.parentName,
            parentPhone: student.parentPhone,
            grade: student.grade,
            subjects: student.subjects,
            days: student.days,
            groupClass: student.groupClass || false,
            month: getCurrentMonthYear(),
            confirmedFee: confirmedFee,
            isTransitioning: true, // ⭐ REQUIRED: Flag submission as transition
            status: 'pending_approval',
            submittedAt: new Date(),
        };

        // 1. Add submission to 'tutor_reports'
        await addDoc(collection(db, "tutor_reports"), submissionData);

        // 2. Update the student's last report date
        const studentRef = doc(db, "students", student.id);
        await updateDoc(studentRef, { 
            lastReportSubmitted: new Date().toISOString().slice(0, 10) 
        });

        showCustomAlert('Fee confirmation submitted successfully!');
        modal.classList.add('hidden');
        renderStudentDatabase(document.getElementById('mainContent'), tutor); // Refresh list

    } catch (error) {
        console.error("Error submitting transition fee:", error);
        showCustomAlert('Error submitting fee. Please try again.');
    } finally {
        submitBtn.textContent = 'Confirm Fee 🟧';
        submitBtn.disabled = false;
    }
}


// ##################################################################
// # SECTION 5: EVENT LISTENERS & INITIALIZATION (MODIFIED)
// ##################################################################

// ... existing utility functions (showCustomAlert, showCustomConfirm, getErrorMessage, etc.) ...

function attachNavListeners() {
    document.getElementById('navDashboard')?.addEventListener('click', (e) => showView(e.currentTarget.getAttribute('data-view')));
    document.getElementById('navStudentDB')?.addEventListener('click', (e) => showView(e.currentTarget.getAttribute('data-view')));
    
    // NEW: Transition Students Button
    document.getElementById('navTransitionStudents')?.addEventListener('click', (e) => {
        showView(e.currentTarget.getAttribute('data-view'));
    });
    
    document.getElementById('navAddStudent')?.addEventListener('click', (e) => showView(e.currentTarget.getAttribute('data-view')));
    document.getElementById('navPendingStudents')?.addEventListener('click', (e) => showView(e.currentTarget.getAttribute('data-view')));
}

function attachReportListeners(tutor) {
    document.querySelectorAll('.report-btn').forEach(button => {
        // Clear existing listeners to prevent double-binding
        button.replaceWith(button.cloneNode(true));
    });
    
    document.querySelectorAll('.report-btn').forEach(button => {
        button.addEventListener('click', async () => {
            const studentId = button.getAttribute('data-student-id');
            const isTransitioning = button.getAttribute('data-is-transitioning') === 'true'; // ⭐ GET FLAG
            
            // Find the student object
            let student = null;
            // The student list is rendered from studentsInDB
            if (window.studentsInDB) {
                student = window.studentsInDB.find(s => s.id === studentId);
            }

            if (student) {
                // If it's a regular student and reports are disabled
                if (!isTransitioning && (!isSubmissionEnabled || isSummerBreakEnabled)) {
                    showCustomAlert(isSummerBreakEnabled ? "Report submission is disabled for the summer break." : "Report submission is currently disabled by the Admin.");
                    return;
                }
                
                // Show the appropriate modal, passing the flag
                showReportModal(student, isTransitioning); 
            } else {
                console.error("Student data not found for ID:", studentId);
                showCustomAlert("Error: Student data not found.");
            }
        });
    });
}

function attachEditDeleteListeners(tutor) {
// ... existing attachEditDeleteListeners content ...
// (omitted for brevity, no changes needed here)
}

function setupAddStudentView(container) {
// ... existing setupAddStudentView content ...
// (omitted for brevity, no changes needed here)
}

function handleNewStudentSubmission(e) {
// ... existing handleNewStudentSubmission content ...
// (omitted for brevity, no changes needed here)
}

function renderPendingStudents(container, tutor) {
// ... existing renderPendingStudents content ...
// (omitted for brevity, no changes needed here)
}

function showView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
        view.style.display = 'none';
    });
    const activeView = document.getElementById(viewId);
    if (activeView) {
        activeView.style.display = 'block';
    }

    // 2. Update nav button styles (MODIFIED)
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active', 'transition-active');
        if (btn.getAttribute('data-view') === viewId) {
            if (viewId === 'add-transition-student-view') {
                btn.classList.add('active', 'transition-active');
            } else {
                btn.classList.add('active'); // Defaults to green-600 active style
            }
        }
    });

    // 3. Render Content for the active view (MODIFIED)
    const mainContent = document.getElementById('mainContent');
    const tutor = window.tutorData;

    if (viewId === 'dashboard-view') {
        const dashboardView = document.getElementById('dashboard-view');
        renderTutorDashboard(dashboardView, tutor);
    } else if (viewId === 'student-list-view') {
        const studentListView = document.getElementById('student-list-view');
        renderStudentDatabase(studentListView, tutor);
    } else if (viewId === 'add-student-view') {
        const addStudentView = document.getElementById('add-student-view');
        setupAddStudentView(addStudentView);
    } else if (viewId === 'add-transition-student-view') { // ⭐ NEW HANDLER
        const addTransitionStudentView = document.getElementById('add-transition-student-view');
        setupTransitionStudentView(addTransitionStudentView); 
    } else if (viewId === 'pending-students-view') {
        const pendingStudentsView = document.getElementById('pending-students-view');
        renderPendingStudents(pendingStudentsView, tutor);
    }
}


// Initialization function
function init() {
    attachNavListeners();
    // Default view
    showView('student-list-view');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const tutorDoc = await getDoc(doc(db, "tutors", user.email));
                if (tutorDoc.exists()) {
                    window.tutorData = { id: user.email, email: user.email, ...tutorDoc.data() };
                    document.getElementById('tutorNameHeading').textContent = `Welcome, ${window.tutorData.name}`;

                    // NEW: Run monthly cleanup on login
                    await runMonthlyAutoCleanup();

                    // Show the default view again with tutor data
                    showView('student-list-view'); 
                    
                    // Show employment date popup if necessary
                    if (shouldShowEmploymentPopup(window.tutorData)) {
                        showEmploymentDatePopup(window.tutorData);
                    }
                } else {
                    console.error("Tutor profile not found in Firestore.");
                    showNetworkError('Your tutor profile could not be loaded. Please contact the administrator.');
                }
            } catch (error) {
                console.error("Error fetching tutor profile:", error);
                showNetworkError(`Failed to load profile data. ${getErrorMessage(error)}`);
            }
        } else {
            // Redirect to login page
            window.location.href = 'index.html';
        }
    });
}

// Call init function
init();
