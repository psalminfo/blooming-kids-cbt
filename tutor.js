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

// --- New Collection Name for Transitioning Students ---
const TRANSITIONING_COLLECTION = "transitioning_students";
const LOCAL_CLEANUP_KEY = "lastTransitioningCleanup";

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

// --- Utility Functions ---

function showCustomAlert(message) {
    const alertModal = document.createElement('div');
    alertModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
    alertModal.innerHTML = `
        <div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-md mx-auto">
            <p class="mb-4">${message}</p>
            <button id="alert-ok-btn" class="bg-green-600 text-white px-6 py-2 rounded float-right">OK</button>
        </div>`;
    document.body.appendChild(alertModal);
    document.getElementById('alert-ok-btn').addEventListener('click', () => alertModal.remove());
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

function getCurrentMonthYear() {
    const now = new Date();
    return now.toLocaleString('default', { month: 'long', year: 'numeric' });
}

// Function to handle grade string formatting
function cleanGradeString(grade) {
    if (grade && grade.toLowerCase().includes("grade")) {
        return grade;
    } else {
        return `Grade ${grade}`;
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
        if (mainContent.querySelector('#student-list-view')) {
            renderStudentDatabase(mainContent, window.tutorData);
        }
    }
});

// ##################################################################
// # SECTION 1: TUTOR DASHBOARD
// ##################################################################
function renderTutorDashboard(container, tutor) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Welcome, ${tutor.name}</h2>
            <div class="mb-4">
                <input type="text" id="searchName" class="w-full mt-1 p-2 border rounded" placeholder="Search by parent name...">
                <button id="searchBtn" class="bg-green-600 text-white px-4 py-2 rounded mt-2 hover:bg-green-700">Search</button>
            </div>
        </div>
        <div id="pendingReportsContainer" class="space-y-4">
            <p class="text-gray-500">Loading pending submissions...</p>
        </div>
        <div id="gradedReportsContainer" class="space-y-4 hidden">
            <p class="text-gray-500">Loading graded submissions...</p>
        </div>
    `;

    document.getElementById('searchBtn').addEventListener('click', async () => {
        const name = document.getElementById('searchName').value.trim();
        await loadTutorReports(tutor.email, name || null);
    });

    loadTutorReports(tutor.email);
}

// Function to sync creative writing comments to student_results
async function syncCreativeWritingToStudentResults(submissionData, tutorReport) {
    try {
        console.log("Syncing creative writing comments to student_results...");
        
        // Find the corresponding creative writing assessment in student_results
        const studentResultsQuery = query(
            collection(db, "student_results"),
            where("studentName", "==", submissionData.studentName),
            where("parentPhone", "==", submissionData.parentPhone),
            where("tutorEmail", "==", submissionData.tutorEmail)
        );
        
        const studentResultsSnapshot = await getDocs(studentResultsQuery);
        
        if (!studentResultsSnapshot.empty) {
            const batch = writeBatch(db);
            
            studentResultsSnapshot.forEach(doc => {
                const resultData = doc.data();
                
                // Check if this is a creative writing submission
                if (resultData.answers && Array.isArray(resultData.answers)) {
                    const creativeWritingAnswer = resultData.answers.find(answer => 
                        answer.type === 'creative-writing'
                    );
                    
                    if (creativeWritingAnswer) {
                        // Update the tutorReport field in the creative writing answer
                        const updatedAnswers = resultData.answers.map(answer => {
                            if (answer.type === 'creative-writing') {
                                return {
                                    ...answer,
                                    tutorReport: tutorReport
                                };
                            }
                            return answer;
                        });
                        
                        // Update the document with the new answers
                        const resultRef = doc(db, "student_results", doc.id);
                        batch.update(resultRef, {
                            answers: updatedAnswers,
                            tutorReport: tutorReport // Also add at top level for easy access
                        });
                        
                        console.log("Updated creative writing comments for:", submissionData.studentName);
                    }
                }
            });
            
            // Commit all updates
            if (batch._mutations.length > 0) {
                await batch.commit();
                console.log("Successfully synced creative writing comments to student_results");
            }
        } else {
            console.log("No matching student_results found for creative writing sync");
        }
    } catch (error) {
        console.error("Error syncing creative writing comments:", error);
    }
}

async function loadTutorReports(tutorEmail, parentName = null) {
    const pendingReportsContainer = document.getElementById('pendingReportsContainer');
    const gradedReportsContainer = document.getElementById('gradedReportsContainer');
    pendingReportsContainer.innerHTML = `<p class="text-gray-500">Loading pending submissions...</p>`;
    if (gradedReportsContainer) gradedReportsContainer.innerHTML = `<p class="text-gray-500">Loading graded submissions...</p>`;

    let submissionsQuery = query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutorEmail));
    if (parentName) {
        submissionsQuery = query(submissionsQuery, where("parentName", "==", parentName));
    }

    try {
        const querySnapshot = await getDocs(submissionsQuery);
        let pendingHTML = '';
        let gradedHTML = '';

        querySnapshot.forEach(doc => {
            const data = doc.data();
            const reportCardHTML = `
                <div class="border rounded-lg p-4 shadow-sm bg-white mb-4">
                    <p><strong>Student:</strong> ${data.studentName}</p>
                    <p><strong>Parent Name:</strong> ${data.parentName || 'N/A'}</p>
                    <p><strong>Grade:</strong> ${data.grade}</p>
                    <p><strong>Submitted At:</strong> ${new Date(data.submittedAt.seconds * 1000).toLocaleString()}</p>
                    <div class="mt-4 border-t pt-4">
                        <h4 class="font-semibold">Creative Writing Submission:</h4>
                        ${data.fileUrl ? `<a href="${data.fileUrl}" target="_blank" class="text-green-600 hover:underline">Download File</a>` : `<p class="italic">${data.textAnswer || "No response"}</p>`}
                        <p class="mt-2"><strong>Status:</strong> ${data.status || 'Pending'}</p>
                        ${(data.status === 'pending_review') ?
                            `<textarea class="tutor-report w-full mt-2 p-2 border rounded" rows="3" placeholder="Write your report here..."></textarea>
                            <button class="submit-report-btn bg-green-600 text-white px-4 py-2 rounded mt-2" data-doc-id="${doc.id}">Submit Report</button>`
                            : `<p class="mt-2"><strong>Tutor's Report:</strong> ${data.tutorReport || 'N/A'}</p>`
                        }
                    </div>
                </div>
            `;
            if (data.status === 'pending_review') {
                pendingHTML += reportCardHTML;
            } else {
                gradedHTML += reportCardHTML;
            }
        });

        pendingReportsContainer.innerHTML = pendingHTML || `<p class="text-gray-500">No pending submissions found.</p>`;
        if (gradedReportsContainer) gradedReportsContainer.innerHTML = gradedHTML || `<p class="text-gray-500">No graded submissions found.</p>`;

        document.querySelectorAll('.submit-report-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const docId = e.target.getAttribute('data-doc-id');
                const reportTextarea = e.target.closest('.border').querySelector('.tutor-report');
                const tutorReport = reportTextarea.value.trim();
                if (tutorReport) {
                    const docRef = doc(db, "tutor_submissions", docId);
                    
                    // Get the submission data first
                    const submissionDoc = await getDoc(docRef);
                    const submissionData = submissionDoc.data();
                    
                    // Update the tutor_submissions document
                    await updateDoc(docRef, { 
                        tutorReport: tutorReport, 
                        status: 'Graded' 
                    });
                    
                    // NEW: Sync creative writing comments to student_results
                    await syncCreativeWritingToStudentResults(submissionData, tutorReport);
                    
                    loadTutorReports(tutorEmail, parentName); // Refresh the list
                }
            });
        });
    } catch (error) {
        console.error("Error loading tutor reports:", error);
        pendingReportsContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;
        if (gradedReportsContainer) gradedReportsContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;
    }
}

// ==================================================================
// TRANSITIONING STUDENT CORE LOGIC (UPDATED FOR APPROVAL WORKFLOW)
// ==================================================================

/**
 * Handles the saving of a new transitioning student to pending_approval collection
 */
async function addNewTransitioningStudent(tutor, container, formPrefix) {
    const parentName = document.getElementById(`${formPrefix}-parent-name`).value.trim();
    const parentPhone = document.getElementById(`${formPrefix}-parent-phone`).value.trim();
    const studentName = document.getElementById(`${formPrefix}-student-name`).value.trim();
    const studentGrade = document.getElementById(`${formPrefix}-student-grade`).value.trim();
    
    const selectedSubjects = [];
    document.querySelectorAll(`input[name="${formPrefix}-subjects"]:checked`).forEach(checkbox => {
        selectedSubjects.push(checkbox.value);
    });

    const studentDays = document.getElementById(`${formPrefix}-student-days`).value.trim();
    const groupClass = document.getElementById(`${formPrefix}-student-group-class`) ? document.getElementById(`${formPrefix}-student-group-class`).checked : false;
    const studentFee = parseFloat(document.getElementById(`${formPrefix}-student-fee`).value);

    if (!parentName || !studentName || !studentGrade || isNaN(studentFee) || !parentPhone || !studentDays || selectedSubjects.length === 0) {
        showCustomAlert('Please fill in all parent and student details correctly, including at least one subject.');
        return;
    }

    const payScheme = getTutorPayScheme(tutor);
    const suggestedFee = calculateSuggestedFee({
        grade: studentGrade,
        days: studentDays,
        subjects: selectedSubjects,
        groupClass: groupClass
    }, payScheme);

    const studentData = {
        parentName: parentName,
        parentPhone: parentPhone,
        studentName: studentName,
        grade: studentGrade,
        subjects: selectedSubjects,
        days: studentDays,
        studentFee: suggestedFee > 0 ? suggestedFee : studentFee,
        tutorEmail: tutor.email,
        tutorName: tutor.name,
        isTransitioning: true, // KEY FLAG for this feature
        createdAt: new Date() // KEY TIMESTAMP for auto-deletion
    };

    if (findSpecializedSubject(selectedSubjects)) {
        studentData.groupClass = groupClass;
    }

    try {
        // Save to pending_approval collection first (like regular students)
        await addDoc(collection(db, "pending_students"), studentData);
        showCustomAlert('Transitioning Student added successfully and is pending approval!');
        
        // Refresh the current view
        if (container.id === 'mainContent' && container.querySelector('#transitioning-classes-view')) {
             renderTransitioningClasses(container, tutor);
        } else {
             // If somehow called from elsewhere, refresh the main view as fallback
             renderStudentDatabase(container, tutor);
        }
       
    } catch (error) {
        console.error("Error adding transitioning student:", error);
        showCustomAlert(`An error occurred: ${error.message}`);
    }
}

/**
 * Simplified Fee Confirmation Modal for Approved Transitioning Students
 */
function showTransitioningFeeConfirmationModal(student, container, tutor) {
    const feeConfirmationHTML = `
        <h3 class="text-xl font-bold mb-4">Confirm Fee for Transitioning Student: ${student.studentName}</h3>
        <p class="text-sm text-orange-600 mb-4 font-bold">This confirms payment for the temporary period. The student will be auto-deleted on the 1st of next month.</p>
        <div class="space-y-4">
            <div>
                <label class="block font-semibold">Current Fee (₦)</label>
                <input type="number" id="confirm-student-fee" class="w-full mt-1 p-2 border rounded" 
                       value="${student.studentFee || 0}" 
                       placeholder="Enter fee amount">
            </div>
            <div class="flex justify-end space-x-2 mt-6">
                <button id="cancel-fee-confirm-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
                <button id="confirm-fee-btn" class="bg-orange-600 text-white px-6 py-2 rounded">Confirm Fee & Mark as Paid</button>
            </div>
        </div>`;

    const feeModal = document.createElement('div');
    feeModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
    feeModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-lg mx-auto">${feeConfirmationHTML}</div>`;
    document.body.appendChild(feeModal);

    document.getElementById('cancel-fee-confirm-btn').addEventListener('click', () => feeModal.remove());
    document.getElementById('confirm-fee-btn').addEventListener('click', async () => {
        const newFeeValue = document.getElementById('confirm-student-fee').value;
        const newFee = parseFloat(newFeeValue);

        if (isNaN(newFee) || newFee < 0) {
            showCustomAlert('Please enter a valid, non-negative fee amount.');
            return;
        }

        try {
            const studentRef = doc(db, student.collection, student.id);
            const updatePayload = {};

            // 1. Update the fee if it changed
            if (newFee !== student.studentFee) {
               updatePayload.studentFee = newFee;
            }
            
            // 2. Mark the transitioning student as paid (to prevent re-action)
            updatePayload.transitionPaid = true;
            updatePayload.transitionPaidAt = new Date();
            updatePayload.transitionPaidFee = newFee;

            await updateDoc(studentRef, updatePayload); 

            feeModal.remove();
            showCustomAlert(`${student.studentName}'s fee confirmed and marked as paid. This will be included in your pay advice.`);
            
            // Refresh the view
            if (container.id === 'mainContent' && container.querySelector('#transitioning-classes-view')) {
                 renderTransitioningClasses(container, tutor);
            } else {
                 renderStudentDatabase(container, tutor);
            }

        } catch (error) {
            console.error("Error confirming transitioning fee:", error);
            showCustomAlert(`Failed to confirm fee: ${error.message}`);
        }
    });
}

/**
 * Runs cleanup for transitioning students created in a previous month.
 */
async function runTransitioningStudentCleanup(tutorEmail) {
    const lastCleanupDate = localStorage.getItem(LOCAL_CLEANUP_KEY);
    const now = new Date();
    const currentMonthYear = now.toISOString().slice(0, 7); // YYYY-MM
    
    // Check if cleanup already ran this month/year
    if (lastCleanupDate === currentMonthYear) {
        return;
    }

    try {
        const q = query(collection(db, TRANSITIONING_COLLECTION), 
                        where("tutorEmail", "==", tutorEmail));
        const snapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        let deletedCount = 0;
        
        snapshot.forEach(docSnap => {
            const student = docSnap.data();
            // Check if createdAt exists and is a Firestore Timestamp
            if (student.createdAt && typeof student.createdAt.toDate === 'function') {
                const createdAt = student.createdAt.toDate();
                const createdMonthYear = createdAt.toISOString().slice(0, 7);
            
                // Delete if the student was created in a previous month (i.e., createdMonthYear < currentMonthYear)
                if (createdMonthYear < currentMonthYear) {
                    batch.delete(doc(db, TRANSITIONING_COLLECTION, docSnap.id));
                    deletedCount++;
                }
            } else {
                 // Safety net for records without createdAt or bad format: delete if old
                 if (now.getDate() > 1) { 
                    batch.delete(doc(db, TRANSITIONING_COLLECTION, docSnap.id));
                    deletedCount++;
                 }
            }
        });

        if (deletedCount > 0) {
            await batch.commit();
            console.log(`Successfully deleted ${deletedCount} expired transitioning student(s).`);
        }
        
        // Update local storage key only if we successfully checked/ran the logic
        localStorage.setItem(LOCAL_CLEANUP_KEY, currentMonthYear);
    } catch (error) {
        console.error("Error during transitioning student cleanup:", error);
    }
}
// ==================================================================
// END TRANSITIONING STUDENT CORE LOGIC
// ==================================================================


// ##################################################################
// # SECTION 2: STUDENT DATABASE (MERGED FUNCTIONALITY)
// ##################################################################

// Helper function to generate the new student form fields
// NOTE: Takes an optional prefix to ensure unique IDs when reused
function getNewStudentFormFields(prefix = 'new-student') {
    // Generate Grade Options
    const gradeOptions = `
        <option value="">Select Grade</option>
        <option value="Preschool">Preschool</option>
        <option value="Kindergarten">Kindergarten</option>
        ${Array.from({ length: 12 }, (_, i) => `<option value="Grade ${i + 1}">Grade ${i + 1}</option>`).join('')}
        <option value="Pre-College">Pre-College</option>
        <option value="College">College</option>
        <option value="Adults">Adults</option>
    `;

    // Generate Fee Options
    let feeOptions = '<option value="">Select Fee (₦)</option>';
    for (let fee = 10000; fee <= 400000; fee += 5000) {
        feeOptions += `<option value="${fee}">${fee.toLocaleString()}</option>`;
    }
    
    // Define Subjects
    const subjectsByCategory = {
        "Academics": ["Math", "Language Arts", "Geography", "Science", "Biology", "Physics", "Chemistry", "Microbiology"],
        "Pre-College Exams": ["SAT", "IGCSE", "A-Levels", "SSCE", "JAMB"],
        "Languages": ["French", "German", "Spanish", "Yoruba", "Igbo", "Hausa", "Arabic"],
        "Tech Courses": ["Coding","ICT", "Stop motion animation", "Computer Appreciation", "Digital Entrepeneurship", "Animation", "YouTube for kids", "Graphic design", "Videography", "Comic/book creation", "Artificial Intelligence", "Chess"],
        "Support Programs": ["Bible study", "Counseling Programs", "Speech therapy", "Behavioral therapy", "Public speaking", "Adult education", "Communication skills", "English Proficiency"]
    };

    let subjectsHTML = `<h4 class="font-semibold text-gray-700 mt-2">Subjects</h4><div id="${prefix}-subjects-container" class="space-y-2 border p-3 rounded bg-gray-50 max-h-48 overflow-y-auto">`;
    for (const category in subjectsByCategory) {
        subjectsHTML += `
            <details>
                <summary class="font-semibold cursor-pointer text-sm">${category}</summary>
                <div class="pl-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    ${subjectsByCategory[category].map(subject => `<div><label class="text-sm font-normal"><input type="checkbox" name="${prefix}-subjects" value="${subject}"> ${subject}</label></div>`).join('')}
                </div>
            </details>
        `;
    }
    subjectsHTML += `
        <div class="font-semibold pt-2 border-t"><label class="text-sm"><input type="checkbox" name="${prefix}-subjects" value="Music"> Music</label></div>
    </div>`;

    return `
        <input type="text" id="${prefix}-parent-name" class="w-full mt-1 p-2 border rounded" placeholder="Parent Name">
        <input type="tel" id="${prefix}-parent-phone" class="w-full mt-1 p-2 border rounded" placeholder="Parent Phone Number">
        <input type="text" id="${prefix}-student-name" class="w-full mt-1 p-2 border rounded" placeholder="Student Name">
        <select id="${prefix}-student-grade" class="w-full mt-1 p-2 border rounded">${gradeOptions}</select>
        ${subjectsHTML}
        <select id="${prefix}-student-days" class="w-full mt-1 p-2 border rounded">
            <option value="">Select Days per Week</option>
            ${Array.from({ length: 7 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
        </select>
        <div id="${prefix}-group-class-container" class="hidden">
            <label class="flex items-center space-x-2 mt-2">
                <input type="checkbox" id="${prefix}-student-group-class" class="rounded">
                <span class="text-sm font-semibold">Group Class</span>
            </label>
        </div>
        <select id="${prefix}-student-fee" class="w-full mt-1 p-2 border rounded">${feeOptions}</select>
    `;
}

// Function to show the edit student modal
function showEditStudentModal(student) {
    // Generate Grade Options with the current grade selected
    let gradeOptions = `
        <option value="">Select Grade</option>
        <option value="Preschool" ${student.grade === 'Preschool' ? 'selected' : ''}>Preschool</option>
        <option value="Kindergarten" ${student.grade === 'Kindergarten' ? 'selected' : ''}>Kindergarten</option>
    `;
    for (let i = 1; i <= 12; i++) {
        const gradeValue = `Grade ${i}`;
        gradeOptions += `<option value="${gradeValue}" ${student.grade === gradeValue ? 'selected' : ''}>${gradeValue}</option>`;
    }
    gradeOptions += `
        <option value="Pre-College" ${student.grade === 'Pre-College' ? 'selected' : ''}>Pre-College</option>
        <option value="College" ${student.grade === 'College' ? 'selected' : ''}>College</option>
        <option value="Adults" ${student.grade === 'Adults' ? 'selected' : ''}>Adults</option>
    `;
    
    // Generate Days Options with the current days selected
    let daysOptions = '<option value="">Select Days per Week</option>';
    for (let i = 1; i <= 7; i++) {
        daysOptions += `<option value="${i}" ${student.days == i ? 'selected' : ''}>${i}</option>`;
    }

    // Define Subjects
    const subjectsByCategory = {
        "Academics": ["Math", "Language Arts", "Geography", "Science", "Biology", "Physics", "Chemistry", "Microbiology"],
        "Pre-College Exams": ["SAT", "IGCSE", "A-Levels", "SSCE", "JAMB"],
        "Languages": ["French", "German", "Spanish", "Yoruba", "Igbo", "Hausa", "Arabic"],
        "Tech Courses": ["Coding","ICT", "Stop motion animation",  "Computer Appreciation", "Digital Entrepeneurship", "Animation", "YouTube for kids", "Graphic design", "Videography", "Comic/book creation", "Artificial Intelligence", "Chess"],
        "Support Programs": ["Bible study", "Counseling Programs", "Speech therapy", "Behavioral therapy", "Public speaking", "Adult education", "Communication skills", "English Proficiency"]
    };

    let subjectsHTML = `<h4 class="font-semibold text-gray-700 mt-2">Subjects</h4><div id="edit-student-subjects-container" class="space-y-2 border p-3 rounded bg-gray-50 max-h-48 overflow-y-auto">`;
    for (const category in subjectsByCategory) {
        subjectsHTML += `
            <details>
                <summary class="font-semibold cursor-pointer text-sm">${category}</summary>
                <div class="pl-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    ${subjectsByCategory[category].map(subject => {
                        const isChecked = student.subjects && student.subjects.includes(subject);
                        return `<div><label class="text-sm font-normal"><input type="checkbox" name="edit-subjects" value="${subject}" ${isChecked ? 'checked' : ''}> ${subject}</label></div>`;
                    }).join('')}
                </div>
            </details>
        `;
    }
    subjectsHTML += `
        <div class="font-semibold pt-2 border-t"><label class="text-sm"><input type="checkbox" name="edit-subjects" value="Music" ${student.subjects && student.subjects.includes('Music') ? 'checked' : ''}> Music</label></div>
    </div>`;

    const editFormHTML = `
        <h3 class="text-xl font-bold mb-4">Edit Student: ${student.studentName}</h3>
        <div class="space-y-4">
            <div>
                <label class="block font-semibold">Parent Name</label>
                <input type="text" id="edit-parent-name" class="w-full mt-1 p-2 border rounded" value="${student.parentName || ''}" placeholder="Parent Name">
            </div>
            <div>
                <label class="block font-semibold">Parent Phone Number</label>
                <input type="tel" id="edit-parent-phone" class="w-full mt-1 p-2 border rounded" value="${student.parentPhone || ''}" placeholder="Parent Phone Number">
            </div>
            <div>
                <label class="block font-semibold">Student Name</label>
                <input type="text" id="edit-student-name" class="w-full mt-1 p-2 border rounded" value="${student.studentName || ''}" placeholder="Student Name">
            </div>
            <div>
                <label class="block font-semibold">Grade</label>
                <select id="edit-student-grade" class="w-full mt-1 p-2 border rounded">${gradeOptions}</select>
            </div>
            ${subjectsHTML}
            <div>
                <label class="block font-semibold">Days per Week</label>
                <select id="edit-student-days" class="w-full mt-1 p-2 border rounded">${daysOptions}</select>
            </div>
            <div id="edit-group-class-container" class="${findSpecializedSubject(student.subjects || []) ? '' : 'hidden'}">
                <label class="flex items-center space-x-2">
                    <input type="checkbox" id="edit-student-group-class" class="rounded" ${student.groupClass ? 'checked' : ''}>
                    <span class="text-sm font-semibold">Group Class</span>
                </label>
            </div>
            <div>
                <label class="block font-semibold">Fee (₦)</label>
                <input type="text" id="edit-student-fee" class="w-full mt-1 p-2 border rounded" 
                       value="${(student.studentFee || 0).toLocaleString()}" 
                       placeholder="Enter fee (e.g., 50,000)">
            </div>
            <div class="flex justify-end space-x-2 mt-6">
                <button id="cancel-edit-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
                <button id="save-edit-btn" class="bg-green-600 text-white px-6 py-2 rounded" data-student-id="${student.id}" data-collection="${student.collection}">Save Changes</button>
            </div>
        </div>`;

    const editModal = document.createElement('div');
    editModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
    editModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-lg mx-auto">${editFormHTML}</div>`;
    document.body.appendChild(editModal);

    document.getElementById('cancel-edit-btn').addEventListener('click', () => editModal.remove());
    document.getElementById('save-edit-btn').addEventListener('click', async (e) => {
        const studentId = e.target.getAttribute('data-student-id');
        const collectionName = e.target.getAttribute('data-collection');
        
        const parentName = document.getElementById('edit-parent-name').value.trim();
        const parentPhone = document.getElementById('edit-parent-phone').value.trim();
        const studentName = document.getElementById('edit-student-name').value.trim();
        const studentGrade = document.getElementById('edit-student-grade').value.trim();
        
        const selectedSubjects = [];
        document.querySelectorAll('input[name="edit-subjects"]:checked').forEach(checkbox => {
            selectedSubjects.push(checkbox.value);
        });

        const studentDays = document.getElementById('edit-student-days').value.trim();
        const groupClass = document.getElementById('edit-student-group-class') ? document.getElementById('edit-student-group-class').checked : false;
        
        // Parse the fee value (remove commas and convert to number)
        const feeValue = document.getElementById('edit-student-fee').value.trim();
        const studentFee = parseFloat(feeValue.replace(/,/g, ''));

        if (!parentName || !studentName || !studentGrade || isNaN(studentFee) || !parentPhone || !studentDays || selectedSubjects.length === 0) {
            showCustomAlert('Please fill in all parent and student details correctly, including at least one subject.');
            return;
        }

        if (isNaN(studentFee) || studentFee < 0) {
            showCustomAlert('Please enter a valid fee amount.');
            return;
        }

        try {
            const studentData = {
                parentName: parentName,
                parentPhone: parentPhone,
                studentName: studentName,
                grade: studentGrade,
                subjects: selectedSubjects,
                days: studentDays,
                studentFee: studentFee
            };

            // Add group class field if it exists in the form
            if (document.getElementById('edit-student-group-class')) {
                studentData.groupClass = groupClass;
            }

            const studentRef = doc(db, collectionName, studentId);
            await updateDoc(studentRef, studentData);
            
            editModal.remove();
            showCustomAlert('Student details updated successfully!');
            
            // Refresh the student database view
            const mainContent = document.getElementById('mainContent');
            renderStudentDatabase(mainContent, window.tutorData);
        } catch (error) {
            console.error("Error updating student:", error);
            showCustomAlert(`An error occurred: ${error.message}`);
        }
    });
}

/**
 * Renders the full student database view, including all student types.
 */
async function renderStudentDatabase(container, tutor) {
    if (!container) {
        console.error("Container element not found.");
        return;
    }

    let savedReports = loadReportsFromLocalStorage(tutor.email);

    // 1. Fetch all student types
    const studentQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
    const pendingStudentQuery = query(collection(db, "pending_students"), where("tutorEmail", "==", tutor.email));
    const transitioningStudentQuery = query(collection(db, TRANSITIONING_COLLECTION), where("tutorEmail", "==", tutor.email));

    // Fetch all tutor's historical submissions for the monthly report check
    const allSubmissionsQuery = query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutor.email));

    const [studentsSnapshot, pendingStudentsSnapshot, transitioningStudentsSnapshot, allSubmissionsSnapshot] = await Promise.all([
        getDocs(studentQuery),
        getDocs(pendingStudentQuery),
        getDocs(transitioningStudentQuery), 
        getDocs(allSubmissionsQuery)
    ]);

    // 2. Determine submitted students for the current month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const submittedStudentIds = new Set();

    allSubmissionsSnapshot.forEach(doc => {
        const submissionData = doc.data();
        const submissionDate = submissionData.submittedAt.toDate(); 
        if (submissionDate.getMonth() === currentMonth && submissionDate.getFullYear() === currentYear) {
            submittedStudentIds.add(submissionData.studentId);
        }
    });

    // 3. Map students and mark their type
    const approvedStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPending: false, isTransitioning: false, collection: "students" }));
    const pendingStudents = pendingStudentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPending: true, isTransitioning: false, collection: "pending_students" }));
    const transitioningStudents = transitioningStudentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPending: false, isTransitioning: true, collection: TRANSITIONING_COLLECTION })); 

    let students = [...approvedStudents, ...pendingStudents, ...transitioningStudents]; // MERGE ALL

    // 4. Count ALL transitioning students (both pending and approved)
    const pendingTransitioningQuery = query(collection(db, "pending_students"), 
        where("tutorEmail", "==", tutor.email),
        where("isTransitioning", "==", true));
    const pendingTransitioningSnapshot = await getDocs(pendingTransitioningQuery);
    const pendingTransitioningCount = pendingTransitioningSnapshot.size;
    const totalTransitioningCount = transitioningStudents.length + pendingTransitioningCount;

    // 5. Duplicate Student Cleanup 
    const seenStudents = new Set();
    const duplicatesToDelete = [];
    students = students.filter(student => {
        const studentIdentifier = `${student.studentName}-${student.tutorEmail}`;
        if (seenStudents.has(studentIdentifier)) {
            duplicatesToDelete.push({ id: student.id, collection: student.collection });
            return false;
        }
        seenStudents.add(studentIdentifier);
        return true;
    });
    if (duplicatesToDelete.length > 0) {
        const batch = writeBatch(db);
        duplicatesToDelete.forEach(dup => {
            batch.delete(doc(db, dup.collection, dup.id));
        });
        try {
             await batch.commit();
             console.log(`Cleaned up ${duplicatesToDelete.length} duplicate student entries.`);
        } catch (error) {
            console.error("Error cleaning up duplicates:", error);
        }
       
    }

    const studentsCount = students.length;
    const regularStudentsCount = approvedStudents.length + pendingStudents.length;

    function renderUI() {
        let studentsHTML = `
            <h2 class="text-2xl font-bold text-green-700 mb-4">
                My Students (${regularStudentsCount})
                <span class="text-orange-600 text-xl font-bold ml-2"> + ${totalTransitioningCount} Transitioning</span>
            </h2>
        `;
        
        if (isTutorAddEnabled) {
            studentsHTML += `
                <div class="bg-gray-100 p-4 rounded-lg shadow-inner mb-4">
                    <h3 class="font-bold text-lg mb-2">Add a New Regular Student</h3>
                    <div class="space-y-2">
                        ${getNewStudentFormFields('new-student')}
                    </div>
                    <div class="flex flex-wrap space-x-2 mt-3">
                        <button id="add-student-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Add Regular Student</button>
                    </div>
                </div>`;
        }
        
        studentsHTML += `<p class="text-sm text-gray-600 mb-4">Report submission is currently <strong class="${isSubmissionEnabled ? 'text-green-600' : 'text-red-500'}">${isSubmissionEnabled ? 'Enabled' : 'Disabled'}</strong> by the admin.</p>`;

        if (studentsCount === 0) {
            studentsHTML += `<p class="text-gray-500">You are not assigned to any students yet.</p>`;
        } else {
            studentsHTML += `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
                        <tbody class="bg-white divide-y divide-gray-200">`;
            
            students.forEach(student => {
                // Determine submission status based on student type
                // Transitioning students use 'transitionPaid' field
                const hasSubmittedThisMonth = student.isTransitioning ? student.transitionPaid : submittedStudentIds.has(student.id);
                const isStudentOnBreak = student.summerBreak;
                const isReportSaved = savedReports[student.id];
                
                // Determine row/cell styling for transitioning students - ORANGE BACKGROUND
                let rowClasses = '';
                if (student.isTransitioning) {
                     rowClasses = 'bg-orange-50 border-l-4 border-orange-500'; 
                }

                const feeDisplay = showStudentFees ? `<div class="text-xs text-gray-500">Fee: ₦${(student.studentFee || 0).toLocaleString()}</div>` : '';
                
                let statusHTML = '';
                let actionsHTML = '';
                
                const subjects = student.subjects ? student.subjects.join(', ') : 'N/A';
                const days = student.days ? `${student.days} days/week` : 'N/A';
                
                if (student.isTransitioning) {
                    // Transitioning Student Specific Logic - ORANGE TEXT and CONFIRM FEE BUTTON
                    statusHTML = `<span class="status-indicator font-semibold text-orange-600">🔄 Transitioning Student</span>`;
                    
                    // Show "Confirm Fee" button instead of "Enter Report" for approved transitioning students
                    if (hasSubmittedThisMonth) {
                         actionsHTML = `<span class="text-green-600 font-semibold">Fee Confirmed</span>`;
                    } else {
                         actionsHTML = `<button class="confirm-fee-btn bg-orange-600 text-white px-3 py-1 rounded font-bold" data-student-id="${student.id}" data-collection="${student.collection}">Confirm Fee</button>`;
                    }

                } else if (student.isPending) {
                    statusHTML = `<span class="status-indicator text-yellow-600 font-semibold">Awaiting Approval</span>`;
                    actionsHTML = `<span class="text-gray-400">No actions available</span>`;

                } else if (hasSubmittedThisMonth) {
                    statusHTML = `<span class="status-indicator text-blue-600 font-semibold">Report Sent</span>`;
                    actionsHTML = `<span class="text-gray-400">Submitted this month</span>`;
                    
                } else {
                    // Regular Approved Student Logic
                    statusHTML = `<span class="status-indicator ${isReportSaved ? 'text-green-600 font-semibold' : 'text-gray-500'}">${isReportSaved ? 'Report Saved' : 'Pending Report'}</span>`;

                    if (isSummerBreakEnabled && !isStudentOnBreak) {
                        actionsHTML += `<button class="summer-break-btn bg-yellow-500 text-white px-3 py-1 rounded" data-student-id="${student.id}">Summer Break</button>`;
                    } else if (isStudentOnBreak) {
                        actionsHTML += `<span class="text-gray-400">On Break</span>`;
                    }

                    if (isSubmissionEnabled && !isStudentOnBreak) {
                        if (approvedStudents.length === 1) {
                            actionsHTML += `<button class="submit-single-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">Submit Report</button>`;
                        } else {
                            actionsHTML += `<button class="enter-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${student.id}">${isReportSaved ? 'Edit Report' : 'Enter Report'}</button>`;
                        }
                    } else if (!isStudentOnBreak) {
                        actionsHTML += `<span class="text-gray-400">Submission Disabled</span>`;
                    }
                }
                
                // Edit/Delete for all non-transitioning students
                if (showEditDeleteButtons && !isStudentOnBreak && !student.isTransitioning) {
                    actionsHTML += `<button class="edit-student-btn-tutor bg-blue-500 text-white px-3 py-1 rounded" data-student-id="${student.id}" data-collection="${student.collection}">Edit</button>`;
                    actionsHTML += `<button class="delete-student-btn-tutor bg-red-500 text-white px-3 py-1 rounded" data-student-id="${student.id}" data-collection="${student.collection}">Delete</button>`;
                }

                studentsHTML += `
                    <tr class="${rowClasses}">
                        <td class="px-6 py-4 whitespace-nowrap">
                            ${student.studentName} (${cleanGradeString(student.grade)})
                            <div class="text-xs text-gray-500">Subjects: ${subjects} | Days: ${days}</div>
                            ${feeDisplay}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">${statusHTML}</td>
                        <td class="px-6 py-4 whitespace-nowrap space-x-2">${actionsHTML}</td>
                    </tr>`;
            });

            studentsHTML += `</tbody></table></div>`;
            
            // Management Fee logic (remains the same)
            
            if (tutor.isManagementStaff) {
                studentsHTML += `
                    <div class="bg-green-50 p-4 rounded-lg shadow-md mt-6">
                        <h3 class="text-lg font-bold text-green-800 mb-2">Management Fee</h3>
                        <p class="text-sm text-gray-600 mb-2">As you are part of the management staff, please set your monthly management fee before final submission.</p>
                        <div class="flex items-center space-x-2">
                            <label for="management-fee-input" class="font-semibold">Fee (₦):</label>
                            <input type="number" id="management-fee-input" class="p-2 border rounded w-full" value="${tutor.managementFee || 0}">
                            <button id="save-management-fee-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save Fee</button>
                        </div>
                    </div>`;
            }
            
            const regularSubmittableStudents = approvedStudents.filter(s => !s.summerBreak && !submittedStudentIds.has(s.id)).length;
            const allReportsSaved = Object.keys(savedReports).length === regularSubmittableStudents && regularSubmittableStudents > 0;
            
            // Only show submit all button for regular students when reports are enabled
            if (regularSubmittableStudents > 0 && isSubmissionEnabled) {
                studentsHTML += `
                    <div class="mt-6 text-right">
                        <button id="submit-all-reports-btn" class="bg-green-700 text-white px-6 py-3 rounded-lg font-bold ${!allReportsSaved ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-800'}" ${!allReportsSaved ? 'disabled' : ''}>
                            Submit All Reports
                        </button>
                    </div>`;
            }
        }
        container.innerHTML = `<div id="student-list-view" class="bg-white p-6 rounded-lg shadow-md">${studentsHTML}</div>`;
        attachEventListeners();
    }

    function showReportModal(student) {
        const existingReport = savedReports[student.id] || {};
        const isSingleApprovedStudent = approvedStudents.filter(s => !s.summerBreak && !submittedStudentIds.has(s.id)).length === 1;
        const currentMonthYear = getCurrentMonthYear();
        
        const reportFormHTML = `
            <h3 class="text-xl font-bold mb-4">Monthly Report for ${student.studentName}</h3>
            <div class="bg-blue-50 p-3 rounded-lg mb-4">
                <p class="text-sm font-semibold text-blue-800">Month: ${currentMonthYear}</p>
            </div>
            <div class="space-y-4">
                <div><label class="block font-semibold">Introduction</label><textarea id="report-intro" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.introduction || ''}</textarea></div>
                <div><label class="block font-semibold">Topics & Remarks</label><textarea id="report-topics" class="w-full mt-1 p-2 border rounded" rows="3">${existingReport.topics || ''}</textarea></div>
                <div><label class="block font-semibold">Progress & Achievements</label><textarea id="report-progress" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.progress || ''}</textarea></div>
                <div><label class="block font-semibold">Strengths & Weaknesses</label><textarea id="report-sw" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.strengthsWeaknesses || ''}</textarea></div>
                <div><label class="block font-semibold">Recommendations</label><textarea id="report-recs" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.recommendations || ''}</textarea></div>
                <div><label class="block font-semibold">General Comments</label><textarea id="report-general" class="w-full mt-1 p-2 border rounded" rows="2">${existingReport.generalComments || ''}</textarea></div>
                <div class="flex justify-end space-x-2">
                    <button id="cancel-report-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
                    <button id="modal-action-btn" class="bg-green-600 text-white px-6 py-2 rounded">${isSingleApprovedStudent ? 'Proceed to Submit' : 'Save Report'}</button>
                </div>
            </div>`;
        
        const reportModal = document.createElement('div');
        reportModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        reportModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl mx-auto">${reportFormHTML}</div>`;
        document.body.appendChild(reportModal);

        document.getElementById('cancel-report-btn').addEventListener('click', () => reportModal.remove());
        document.getElementById('modal-action-btn').addEventListener('click', async () => {
            const reportData = {
                studentId: student.id, 
                studentName: student.studentName, 
                grade: student.grade,
                parentName: student.parentName, 
                parentPhone: student.parentPhone,
                reportMonth: currentMonthYear, // Add month to report data
                introduction: document.getElementById('report-intro').value,
                topics: document.getElementById('report-topics').value,
                progress: document.getElementById('report-progress').value,
                strengthsWeaknesses: document.getElementById('report-sw').value,
                recommendations: document.getElementById('report-recs').value,
                generalComments: document.getElementById('report-general').value
            };

            reportModal.remove();
            showFeeConfirmationModal(student, reportData);
        });
    }

    function showFeeConfirmationModal(student, reportData) {
        const feeConfirmationHTML = `
            <h3 class="text-xl font-bold mb-4">Confirm Fee for ${student.studentName}</h3>
            <p class="text-sm text-gray-600 mb-4">Please verify the monthly fee for this student before saving the report. You can make corrections if needed.</p>
            <div class="space-y-4">
                <div>
                    <label class="block font-semibold">Current Fee (₦)</label>
                    <input type="number" id="confirm-student-fee" class="w-full mt-1 p-2 border rounded" 
                           value="${student.studentFee || 0}" 
                           placeholder="Enter fee amount">
                </div>
                <div class="flex justify-end space-x-2 mt-6">
                    <button id="cancel-fee-confirm-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
                    <button id="confirm-fee-btn" class="bg-green-600 text-white px-6 py-2 rounded">Confirm Fee & Save</button>
                </div>
            </div>`;

        const feeModal = document.createElement('div');
        feeModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        feeModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-lg mx-auto">${feeConfirmationHTML}</div>`;
        document.body.appendChild(feeModal);

        const isSingleApprovedStudent = approvedStudents.filter(s => !s.summerBreak && !submittedStudentIds.has(s.id)).length === 1;

        document.getElementById('cancel-fee-confirm-btn').addEventListener('click', () => feeModal.remove());
        document.getElementById('confirm-fee-btn').addEventListener('click', async () => {
            const newFeeValue = document.getElementById('confirm-student-fee').value;
            const newFee = parseFloat(newFeeValue);

            if (isNaN(newFee) || newFee < 0) {
                showCustomAlert('Please enter a valid, non-negative fee amount.');
                return;
            }

            if (newFee !== student.studentFee) {
                try {
                    const studentRef = doc(db, student.collection, student.id);
                    await updateDoc(studentRef, { studentFee: newFee });
                    student.studentFee = newFee; 
                    showCustomAlert('Student fee has been updated successfully!');
                } catch (error) {
                    console.error("Error updating student fee:", error);
                    showCustomAlert(`Failed to update fee: ${error.message}`);
                }
            }

            feeModal.remove();

            if (isSingleApprovedStudent) {
                showAccountDetailsModal([reportData]);
            } else {
                savedReports[student.id] = reportData;
                saveReportsToLocalStorage(tutor.email, savedReports);
                showCustomAlert(`${student.studentName}'s report has been saved.`);
                renderUI(); 
            }
        });
    }

    function showAccountDetailsModal(reportsArray) {
        const accountFormHTML = `
            <h3 class="text-xl font-bold mb-4">Enter Your Payment Details</h3>
            <p class="text-sm text-gray-600 mb-4">Please provide your bank details for payment processing. This is required before final submission.</p>
            <div class="space-y-4">
                <div>
                    <label class="block font-semibold">Beneficiary Bank Name</label>
                    <input type="text" id="beneficiary-bank" class="w-full mt-1 p-2 border rounded" placeholder="e.g., Zenith Bank">
                </div>
                <div>
                    <label class="block font-semibold">Beneficiary Account Number</label>
                    <input type="text" id="beneficiary-account" class="w-full mt-1 p-2 border rounded" placeholder="Your 10-digit account number">
                </div>
                <div>
                    <label class="block font-semibold">Beneficiary Name</label>
                    <input type="text" id="beneficiary-name" class="w-full mt-1 p-2 border rounded" placeholder="Your full name as on the account">
                </div>
                <div class="flex justify-end space-x-2 mt-6">
                    <button id="cancel-account-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
                    <button id="confirm-submit-btn" class="bg-green-600 text-white px-6 py-2 rounded">Confirm & Submit Report(s)</button>
                </div>
            </div>`;
        const accountModal = document.createElement('div');
        accountModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        accountModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-lg mx-auto">${accountFormHTML}</div>`;
        document.body.appendChild(accountModal);

        document.getElementById('cancel-account-btn').addEventListener('click', () => accountModal.remove());
        document.getElementById('confirm-submit-btn').addEventListener('click', async () => {
            const accountDetails = {
                beneficiaryBank: document.getElementById('beneficiary-bank').value.trim(),
                beneficiaryAccount: document.getElementById('beneficiary-account').value.trim(),
                beneficiaryName: document.getElementById('beneficiary-name').value.trim(),
            };

            if (!accountDetails.beneficiaryBank || !accountDetails.beneficiaryAccount || !accountDetails.beneficiaryName) {
                showCustomAlert("Please fill in all bank account details before submitting.");
                return;
            }

            accountModal.remove();
            await submitAllReports(reportsArray, accountDetails);
        });
    }
    
    async function submitAllReports(reportsArray, accountDetails) {
        if (reportsArray.length === 0) {
            showCustomAlert("No reports to submit.");
            return;
        }

        const batch = writeBatch(db);
        reportsArray.forEach(report => {
            const newReportRef = doc(collection(db, "tutor_submissions"));
            batch.set(newReportRef, {
                tutorEmail: tutor.email,
                tutorName: tutor.name,
                submittedAt: new Date(),
                ...report,
                ...accountDetails
            });
        });

        try {
            await batch.commit();
            clearAllReportsFromLocalStorage(tutor.email);
            showCustomAlert(`Successfully submitted ${reportsArray.length} report(s)!`);
            await renderStudentDatabase(container, tutor);
        } catch (error) {
            console.error("Error submitting reports:", error);
            showCustomAlert(`Error: ${error.message}`);
        }
    }

    function attachEventListeners() {
        // Group class toggle functionality for new student form
        const subjectsContainer = document.getElementById('new-student-subjects-container');
        const groupClassContainer = document.getElementById('new-student-group-class-container');
        
        if (subjectsContainer && groupClassContainer) {
            subjectsContainer.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox' && e.target.checked) {
                    const subject = e.target.value;
                    const hasSpecializedSubject = findSpecializedSubject([subject]);
                    if (hasSpecializedSubject) {
                        groupClassContainer.classList.remove('hidden');
                    }
                }
            });
        }

        if (isTutorAddEnabled) {
            // Existing 'Add Regular Student' logic
            document.getElementById('add-student-btn').addEventListener('click', async () => {
                const formPrefix = 'new-student';
                const parentName = document.getElementById(`${formPrefix}-parent-name`).value.trim();
                const parentPhone = document.getElementById(`${formPrefix}-parent-phone`).value.trim();
                const studentName = document.getElementById(`${formPrefix}-student-name`).value.trim();
                const studentGrade = document.getElementById(`${formPrefix}-student-grade`).value.trim();
                
                const selectedSubjects = [];
                document.querySelectorAll(`input[name="${formPrefix}-subjects"]:checked`).forEach(checkbox => {
                    selectedSubjects.push(checkbox.value);
                });

                const studentDays = document.getElementById(`${formPrefix}-student-days`).value.trim();
                const groupClass = document.getElementById(`${formPrefix}-student-group-class`) ? document.getElementById(`${formPrefix}-student-group-class`).checked : false;
                const studentFee = parseFloat(document.getElementById(`${formPrefix}-student-fee`).value);

                if (!parentName || !studentName || !studentGrade || isNaN(studentFee) || !parentPhone || !studentDays || selectedSubjects.length === 0) {
                    showCustomAlert('Please fill in all parent and student details correctly, including at least one subject.');
                    return;
                }

                // Calculate suggested fee based on pay scheme
                const payScheme = getTutorPayScheme(tutor);
                const suggestedFee = calculateSuggestedFee({
                    grade: studentGrade,
                    days: studentDays,
                    subjects: selectedSubjects,
                    groupClass: groupClass
                }, payScheme);

                const studentData = {
                    parentName: parentName,
                    parentPhone: parentPhone,
                    studentName: studentName,
                    grade: studentGrade,
                    subjects: selectedSubjects,
                    days: studentDays,
                    studentFee: suggestedFee > 0 ? suggestedFee : studentFee,
                    tutorEmail: tutor.email,
                    tutorName: tutor.name
                };

                // Add group class field if applicable
                if (findSpecializedSubject(selectedSubjects)) {
                    studentData.groupClass = groupClass;
                }

                try {
                    if (isBypassApprovalEnabled) {
                        await addDoc(collection(db, "students"), studentData);
                        showCustomAlert('Student added successfully!');
                    } else {
                        await addDoc(collection(db, "pending_students"), studentData);
                        showCustomAlert('Student added and is pending approval.');
                    }
                    renderStudentDatabase(container, tutor);
                } catch (error) {
                    console.error("Error adding student:", error);
                    showCustomAlert(`An error occurred: ${error.message}`);
                }
            });
        }

        // Existing 'Enter Report' logic for regular students
        document.querySelectorAll('.enter-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                showReportModal(student);
            });
        });

        document.querySelectorAll('.submit-single-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                showReportModal(student);
            });
        });

        // NEW: Confirm Fee button for transitioning students
        document.querySelectorAll('.confirm-fee-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const collectionName = btn.getAttribute('data-collection');
                const student = students.find(s => s.id === studentId && s.collection === collectionName);
                if (student) {
                    showTransitioningFeeConfirmationModal(student, container, tutor);
                }
            });
        });

       document.querySelectorAll('.summer-break-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                
                // Add confirmation dialog
                if (confirm(`Are you sure you want to put ${student.studentName} on summer break?`)) {
                    const studentRef = doc(db, "students", studentId);
                    await updateDoc(studentRef, { summerBreak: true });
                    showCustomAlert(`${student.studentName} has been marked as on summer break.`);
                    renderStudentDatabase(container, tutor);
                }
            });
        });

        const submitAllBtn = document.getElementById('submit-all-reports-btn');
        if (submitAllBtn) {
            submitAllBtn.addEventListener('click', () => {
                const reportsToSubmit = Object.values(savedReports);
                showAccountDetailsModal(reportsToSubmit);
            });
        }

        const saveFeeBtn = document.getElementById('save-management-fee-btn');
        if (saveFeeBtn) {
            saveFeeBtn.addEventListener('click', async () => {
                const newFee = parseFloat(document.getElementById('management-fee-input').value);
                if (isNaN(newFee) || newFee < 0) {
                    showCustomAlert("Please enter a valid fee amount.");
                    return;
                }
                const tutorRef = doc(db, "tutors", tutor.id);
                await updateDoc(tutorRef, { managementFee: newFee });
                showCustomAlert("Management fee updated successfully.");
                window.tutorData.managementFee = newFee;
            });
        }
        
        document.querySelectorAll('.edit-student-btn-tutor').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const collectionName = btn.getAttribute('data-collection');
                const student = students.find(s => s.id === studentId && s.collection === collectionName);
                if (student) {
                    showEditStudentModal(student);
                }
            });
        });

        document.querySelectorAll('.delete-student-btn-tutor').forEach(btn => {
            btn.addEventListener('click', async () => {
                const studentId = btn.getAttribute('data-student-id');
                const collectionName = btn.getAttribute('data-collection');
                const student = students.find(s => s.id === studentId && s.collection === collectionName);
                
                if (student && confirm(`Are you sure you want to delete ${student.studentName}? This action cannot be undone.`)) {
                    try {
                        await deleteDoc(doc(db, collectionName, studentId));
                        showCustomAlert('Student deleted successfully!');
                        renderStudentDatabase(container, tutor);
                    } catch (error) {
                        console.error("Error deleting student:", error);
                        showCustomAlert(`An error occurred: ${error.message}`);
                    }
                }
            });
        });
    }

    renderUI();
}

// ##################################################################
// # SECTION 3: TRANSITIONING CLASSES (NEW DEDICATED TAB)
// ##################################################################

async function renderTransitioningClasses(container, tutor) {
    if (!isTutorAddEnabled) {
        container.innerHTML = `<p class="text-red-500 p-6">Student addition is currently disabled by the administrator.</p>`;
        return;
    }
    
    // 1. Fetch all current transitioning students (both pending and approved)
    const pendingTransitioningQuery = query(collection(db, "pending_students"), 
        where("tutorEmail", "==", tutor.email),
        where("isTransitioning", "==", true));
    
    const approvedTransitioningQuery = query(collection(db, TRANSITIONING_COLLECTION), 
        where("tutorEmail", "==", tutor.email));

    const [pendingTransitioningSnapshot, approvedTransitioningSnapshot] = await Promise.all([
        getDocs(pendingTransitioningQuery),
        getDocs(approvedTransitioningQuery)
    ]);

    const pendingTransitioningStudents = pendingTransitioningSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        isPending: true, 
        isTransitioning: true, 
        collection: "pending_students" 
    }));

    const approvedTransitioningStudents = approvedTransitioningSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        isPending: false, 
        isTransitioning: true, 
        collection: TRANSITIONING_COLLECTION 
    }));

    const allTransitioningStudents = [...pendingTransitioningStudents, ...approvedTransitioningStudents];
    
    const formPrefix = 'transition-form';

    // 2. Build the UI
    let studentsListHTML = '';
    if (allTransitioningStudents.length === 0) {
        studentsListHTML = `<p class="text-gray-500 italic mt-4">No transitioning students found.</p>`;
    } else {
        studentsListHTML = `
            <div class="overflow-x-auto mt-4">
                <table class="min-w-full divide-y divide-orange-200">
                    <thead>
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-orange-700 uppercase">Student Name</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-orange-700 uppercase">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-orange-700 uppercase">Action</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-orange-200">
        `;
        allTransitioningStudents.forEach(student => {
            const isPending = student.isPending;
            const isPaid = student.transitionPaid;
            const status = isPending ? '⏳ Pending Approval' : (isPaid ? '✅ Paid' : '🔄 Approved - Action Required');
            const feeDisplay = `₦${(student.studentFee || 0).toLocaleString()}`;
            
            let actionButton = '';
            if (isPending) {
                actionButton = `<span class="text-gray-500">Waiting for admin approval</span>`;
            } else if (isPaid) {
                actionButton = `<span class="text-green-600 font-semibold">Fee Confirmed</span>`;
            } else {
                actionButton = `<button class="confirm-fee-btn-transitioning bg-orange-600 text-white px-3 py-1 rounded font-bold" data-student-id="${student.id}" data-collection="${student.collection}">Confirm Fee</button>`;
            }
            
            studentsListHTML += `
                <tr class="bg-orange-50">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="font-medium text-gray-900">${student.studentName} (${cleanGradeString(student.grade)})</div>
                        <div class="text-xs text-gray-500">${student.parentName} | Fee: ${feeDisplay}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isPending ? 'bg-yellow-100 text-yellow-800' : (isPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800')}">
                            ${status}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        ${actionButton}
                    </td>
                </tr>
            `;
        });
        studentsListHTML += `</tbody></table></div>`;
    }

    // 3. Render the page structure
    container.innerHTML = `
        <div id="transitioning-classes-view" class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-orange-700 mb-4">
                🔄 Transitioning Classes: Temporary Registration
            </h2>
            <p class="text-sm text-gray-600 mb-6">
                Use this tab to register temporary students. They will follow the same approval process as regular students but use fee confirmation instead of monthly reports.
                After admin approval, click 'Confirm Fee' to finalize the temporary enrollment.
            </p>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-orange-50 p-4 rounded-lg shadow-inner border-2 border-orange-200">
                    <h3 class="font-bold text-lg mb-2 text-orange-900">1. Register Temporary Student</h3>
                    <div class="space-y-2">
                        ${getNewStudentFormFields(formPrefix)}
                    </div>
                    <div class="flex flex-wrap space-x-2 mt-3">
                        <button id="add-transitioning-student-btn" class="bg-orange-600 border-4 border-orange-800 text-white px-4 py-2 rounded mt-3 hover:bg-orange-700 font-bold">
                            <span class="text-lg">➕</span> Register Transitioning Student
                        </button>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-lg shadow border-2 border-orange-500">
                    <h3 class="font-bold text-lg mb-2 text-orange-900">2. Student Status & Fee Confirmation</h3>
                    ${studentsListHTML}
                </div>
            </div>
        </div>
    `;

    // 4. Attach Event Listeners

    // Group class toggle for the new form
    const subjectsContainer = document.getElementById(`${formPrefix}-subjects-container`);
    const groupClassContainer = document.getElementById(`${formPrefix}-group-class-container`);
    
    if (subjectsContainer && groupClassContainer) {
        subjectsContainer.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && e.target.checked) {
                const subject = e.target.value;
                const hasSpecializedSubject = findSpecializedSubject([subject]);
                if (hasSpecializedSubject) {
                    groupClassContainer.classList.remove('hidden');
                }
            }
        });
    }

    // New Registration Button logic
    document.getElementById('add-transitioning-student-btn').addEventListener('click', () => {
        addNewTransitioningStudent(tutor, container, formPrefix);
    });

    // Confirmation Button logic
    document.querySelectorAll('.confirm-fee-btn-transitioning').forEach(btn => {
        btn.addEventListener('click', () => {
            const studentId = btn.getAttribute('data-student-id');
            const collectionName = btn.getAttribute('data-collection');
            const student = allTransitioningStudents.find(s => s.id === studentId && s.collection === collectionName);
            if (student) {
                showTransitioningFeeConfirmationModal(student, container, tutor);
            }
        });
    });
}

// ##################################################################
// # SECTION 4: MAIN APP INITIALIZATION
// ##################################################################
document.addEventListener('DOMContentLoaded', async () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const tutorQuery = query(collection(db, "tutors"), where("email", "==", user.email.trim()));
            const querySnapshot = await getDocs(tutorQuery);
            if (!querySnapshot.empty) {
                const tutorDoc = querySnapshot.docs[0];
                const tutorData = { id: tutorDoc.id, ...tutorDoc.data() };
                window.tutorData = tutorData;
                
                // NEW: Run cleanup for expired transitioning students
                await runTransitioningStudentCleanup(tutorData.email);

                // Show employment date popup if needed
                if (shouldShowEmploymentPopup(tutorData)) {
                    showEmploymentDatePopup(tutorData);
                }
                
                renderTutorDashboard(document.getElementById('mainContent'), tutorData);
            } else {
                console.error("No matching tutor found.");
                document.getElementById('mainContent').innerHTML = `<p class="text-red-500">Error: No tutor profile found for your email.</p>`;
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'tutor-auth.html';
        }).catch(error => {
            console.error("Error signing out:", error);
        });
    });

    document.getElementById('navDashboard').addEventListener('click', () => {
        if (window.tutorData) {
            renderTutorDashboard(document.getElementById('mainContent'), window.tutorData);
        }
    });

    document.getElementById('navStudentDatabase').addEventListener('click', () => {
        if (window.tutorData) {
            renderStudentDatabase(document.getElementById('mainContent'), window.tutorData);
        }
    });
    
    // NEW: Transitioning Classes Navigation
    document.getElementById('navTransitioningClasses').addEventListener('click', () => {
        if (window.tutorData) {
            renderTransitioningClasses(document.getElementById('mainContent'), window.tutorData);
        }
    });

    document.getElementById('navAutoStudents').addEventListener('click', () => {
        if (window.tutorData) {
            renderAutoRegisteredStudents(document.getElementById('mainContent'), window.tutorData);
        }
    });
});

// ##################################################################
// # SECTION 5: AUTO-REGISTERED STUDENTS DISPLAY 
// ##################################################################

function renderAutoRegisteredStudents(container, tutor) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-blue-700 mb-4">Auto-Registered Students</h2>
            <p class="text-sm text-gray-600 mb-4">Students who completed tests and need profile completion</p>
            <div id="auto-students-list">
                <p class="text-gray-500">Loading auto-registered students...</p>
            </div>
        </div>
    `;
    
    loadAutoRegisteredStudents(tutor.email);
}

async function loadAutoRegisteredStudents(tutorEmail) {
    // Query both collections for auto-registered students
    const studentsQuery = query(collection(db, "students"), 
        where("tutorEmail", "==", tutorEmail),
        where("autoRegistered", "==", true));
    
    const pendingQuery = query(collection(db, "pending_students"), 
        where("tutorEmail", "==", tutorEmail),
        where("autoRegistered", "==", true));

    try {
        const [studentsSnapshot, pendingSnapshot] = await Promise.all([
            getDocs(studentsQuery),
            getDocs(pendingQuery)
        ]);

        const autoStudents = [
            ...studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), collection: "students" })),
            ...pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), collection: "pending_students" }))
        ];

        renderAutoStudentsList(autoStudents);
    } catch (error) {
        console.error("Error loading auto-registered students:", error);
        document.getElementById('auto-students-list').innerHTML = `<p class="text-red-500">Failed to load auto-registered students.</p>`;
    }
}

function renderAutoStudentsList(students) {
    const container = document.getElementById('auto-students-list');
    
    if (students.length === 0) {
        container.innerHTML = `<p class="text-gray-500">No auto-registered students found.</p>`;
        return;
    }

    let html = `
        <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
                <thead>
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test Info</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
    `;

    students.forEach(student => {
        const status = student.collection === "students" ? 
            "🆕 Needs Completion" : 
            "🆕 Awaiting Approval";
            
        const statusClass = student.collection === "students" ? 
            'bg-blue-100 text-blue-800' : 
            'bg-yellow-100 text-yellow-800';
        
        html += `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="font-medium">${student.studentName}</div>
                    <div class="text-sm text-gray-500">${student.grade} • ${student.parentPhone || 'No phone'}</div>
                    <div class="text-xs text-gray-400">${student.parentEmail || 'No email'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                        ${status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${student.testSubject || 'General Test'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap space-x-2">
                    <button class="complete-student-btn bg-green-600 text-white px-3 py-1 rounded text-sm" 
                            data-student-id="${student.id}" data-collection="${student.collection}">
                        Complete Profile
                    </button>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    // Attach event listeners
    document.querySelectorAll('.complete-student-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const studentId = btn.getAttribute('data-student-id');
            const collection = btn.getAttribute('data-collection');
            const student = students.find(s => s.id === studentId && s.collection === collection);
            if (student) {
                showEditStudentModal(student); // Reuse existing edit modal
            }
        });
    });
}