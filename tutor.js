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
        const dateInput = document.getElementById('employment-date').value;
        if (!dateInput) {
            alert('Please select your employment month and year.');
            return;
        }
        
        try {
            const tutorRef = doc(db, 'tutors', tutor.id);
            await updateDoc(tutorRef, {
                employmentDate: dateInput
            });
            
            // Update local tutor object
            tutor.employmentDate = dateInput;
            
            // Mark popup as shown for this month
            localStorage.setItem(`employmentPopup_${tutor.email}`, new Date().toISOString().slice(0, 7));
            
            document.body.removeChild(popup);
            location.reload(); // Refresh to apply pay scheme changes
        } catch (error) {
            console.error('Error saving employment date:', error);
            alert('Error saving employment date. Please try again.');
        }
    });
}

// --- Pay Scheme Calculation Functions ---
function getTutorPayScheme(tutor) {
    if (!tutor || !tutor.employmentDate) return PAY_SCHEMES.NEW_TUTOR;
    
    const employmentDate = new Date(tutor.employmentDate + '-01');
    const currentDate = new Date();
    const monthsWorked = (currentDate.getFullYear() - employmentDate.getFullYear()) * 12 + 
                        (currentDate.getMonth() - employmentDate.getMonth());
    
    if (tutor.role === 'management') {
        return PAY_SCHEMES.MANAGEMENT;
    } else if (monthsWorked >= 12) {
        return PAY_SCHEMES.OLD_TUTOR;
    } else {
        return PAY_SCHEMES.NEW_TUTOR;
    }
}

function calculateMonthlyFee(student, payScheme) {
    if (!student || !payScheme) return 0;
    
    let totalFee = 0;
    const subjects = student.subjects || [];
    const daysPerWeek = parseInt(student.daysPerWeek) || 0;
    
    // Academic subjects calculation
    const academicSubjects = subjects.filter(subj => 
        !Object.keys(SUBJECT_CATEGORIES).some(cat => 
            SUBJECT_CATEGORIES[cat].includes(subj)
        ) && !SUBJECT_CATEGORIES["Specialized"].includes(subj)
    );
    
    if (academicSubjects.length > 0) {
        const gradeLevel = getGradeLevel(student.grade);
        if (payScheme.academic[gradeLevel] && payScheme.academic[gradeLevel][daysPerWeek]) {
            totalFee += payScheme.academic[gradeLevel][daysPerWeek];
        }
    }
    
    // Specialized subjects calculation
    subjects.forEach(subject => {
        // Check if subject is in any category
        for (const [category, categorySubjects] of Object.entries(SUBJECT_CATEGORIES)) {
            if (categorySubjects.includes(subject)) {
                const isGroupClass = student.isGroupClass || false;
                const schemeCategory = payScheme.specialized;
                
                if (isGroupClass && schemeCategory.group && schemeCategory.group[category]) {
                    totalFee += schemeCategory.group[category];
                } else if (schemeCategory.individual && schemeCategory.individual[category]) {
                    totalFee += schemeCategory.individual[category];
                }
                break;
            }
        }
        
        // Direct specialized subject check
        if (payScheme.specialized.individual && payScheme.specialized.individual[subject]) {
            const isGroupClass = student.isGroupClass || false;
            if (isGroupClass && payScheme.specialized.group && payScheme.specialized.group[subject]) {
                totalFee += payScheme.specialized.group[subject];
            } else {
                totalFee += payScheme.specialized.individual[subject];
            }
        }
    });
    
    return totalFee;
}

function getGradeLevel(grade) {
    if (!grade) return "Grade 3-8";
    
    const gradeLower = grade.toLowerCase();
    if (gradeLower.includes('preschool') || gradeLower.includes('pre-school') || 
        gradeLower.includes('nursery') || gradeLower.includes('kg') || 
        gradeLower.includes('kindergarten') || ['1', '2'].includes(gradeLower)) {
        return "Preschool-Grade 2";
    } else if (['3', '4', '5', '6', '7', '8'].includes(gradeLower)) {
        return "Grade 3-8";
    } else {
        return "Subject Teachers";
    }
}

// --- DOM Elements with Safe Null Checks ---
function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with id '${id}' not found`);
    }
    return element;
}

// --- Navigation Functions ---
function setupNavigation() {
    const navDashboard = getElement('navDashboard');
    const navStudentDatabase = getElement('navStudentDatabase');
    const navTransitionStudents = getElement('navTransitionStudents');
    
    if (navDashboard) navDashboard.addEventListener('click', () => showDashboard());
    if (navStudentDatabase) navStudentDatabase.addEventListener('click', () => showStudentDatabase());
    if (navTransitionStudents) navTransitionStudents.addEventListener('click', () => showTransitionStudentsForm());
    
    // Set initial active state
    setActiveNav('navDashboard');
}

function setActiveNav(activeId) {
    const navIds = ['navDashboard', 'navStudentDatabase', 'navTransitionStudents'];
    navIds.forEach(id => {
        const element = getElement(id);
        if (element) {
            if (id === activeId) {
                element.classList.add('active');
                element.classList.remove('text-gray-500');
            } else {
                element.classList.remove('active');
                element.classList.add('text-gray-500');
            }
        }
    });
}

// --- Main Content Display Functions ---
function showDashboard() {
    setActiveNav('navDashboard');
    const mainContent = getElement('mainContent');
    if (!mainContent) return;
    
    mainContent.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <h2 class="text-2xl font-bold mb-6 dashboard-header">Tutor Dashboard</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-500">
                    <h3 class="text-lg font-semibold mb-2">Total Students</h3>
                    <p id="totalStudentsCount" class="text-3xl font-bold">0</p>
                </div>
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-blue-500">
                    <h3 class="text-lg font-semibold mb-2">Pending Reports</h3>
                    <p id="pendingReportsCount" class="text-3xl font-bold">0</p>
                </div>
                <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-yellow-500">
                    <h3 class="text-lg font-semibold mb-2">Transition Students</h3>
                    <p id="transitionStudentsCount" class="text-3xl font-bold">0</p>
                </div>
            </div>
            
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold">My Students</h3>
                    <div class="flex space-x-2">
                        <button id="addStudentBtn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors">
                            Add Student
                        </button>
                    </div>
                </div>
                <div id="studentsList" class="space-y-4">
                    <p class="text-center text-gray-500 py-8">Loading students...</p>
                </div>
            </div>
        </div>
    `;
    
    const addStudentBtn = getElement('addStudentBtn');
    if (addStudentBtn) {
        addStudentBtn.addEventListener('click', showAddStudentForm);
    }
    
    loadStudentsForDashboard();
}

function showStudentDatabase() {
    setActiveNav('navStudentDatabase');
    const mainContent = getElement('mainContent');
    if (!mainContent) return;
    
    mainContent.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold dashboard-header">Student Database</h2>
                <button id="addStudentDbBtn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors">
                    Add Student
                </button>
            </div>
            <div id="studentDatabaseContent">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead>
                                <tr class="border-b-2 border-gray-200 dark:border-gray-700">
                                    <th class="text-left p-3 font-semibold">Student Name</th>
                                    <th class="text-left p-3 font-semibold">Grade</th>
                                    <th class="text-left p-3 font-semibold">Subjects</th>
                                    <th class="text-left p-3 font-semibold">Days/Week</th>
                                    <th class="text-left p-3 font-semibold">Status</th>
                                    <th class="text-left p-3 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="studentDatabaseList">
                                <tr>
                                    <td colspan="6" class="text-center p-6 text-gray-500">Loading students...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const addStudentDbBtn = getElement('addStudentDbBtn');
    if (addStudentDbBtn) {
        addStudentDbBtn.addEventListener('click', showAddStudentForm);
    }
    
    loadStudentsForDatabase();
}

// --- NEW: Transition Students Form ---
function showTransitionStudentsForm() {
    setActiveNav('navTransitionStudents');
    const mainContent = getElement('mainContent');
    if (!mainContent) return;
    
    mainContent.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <div class="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-4 mb-6 rounded">
                <h2 class="text-2xl font-bold transition-header">🟧 ADD TRANSITION STUDENT FORM</h2>
                <div class="border-b border-orange-300 my-3"></div>
                <h3 class="text-xl font-semibold mb-2 transition-header">📋 Add Transition Student</h3>
                <p class="text-orange-700 dark:text-orange-300 mb-4">
                    ℹ️ For temporarily taking over another tutor's student (no monthly reports required)
                </p>
                
                <div class="bg-orange-100 dark:bg-orange-800/30 p-4 rounded border border-orange-200 dark:border-orange-700">
                    <h4 class="font-bold text-orange-800 dark:text-orange-200 mb-2">🟧 Transition Student Information</h4>
                    <p class="text-orange-700 dark:text-orange-300 text-sm">
                        ⚠️ This student will be automatically removed at the beginning of next month.
                    </p>
                </div>
            </div>
            
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <form id="transitionStudentForm" class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block font-semibold mb-2">Parent Name *</label>
                            <input type="text" id="transitionParentName" required 
                                   class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white">
                        </div>
                        <div>
                            <label class="block font-semibold mb-2">Parent Phone *</label>
                            <input type="tel" id="transitionParentPhone" required 
                                   class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white">
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block font-semibold mb-2">Student Name *</label>
                            <input type="text" id="transitionStudentName" required 
                                   class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white">
                        </div>
                        <div>
                            <label class="block font-semibold mb-2">Grade *</label>
                            <input type="text" id="transitionGrade" required 
                                   class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                                   placeholder="e.g., Grade 5, Preschool">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block font-semibold mb-3">Subjects *</label>
                        <div class="space-y-4">
                            ${generateTransitionSubjectsCheckboxes()}
                        </div>
                        <div id="transitionGroupClassContainer" class="mt-4 hidden">
                            <label class="inline-flex items-center">
                                <input type="checkbox" id="transitionIsGroupClass" class="rounded border-gray-300">
                                <span class="ml-2">This is a group class</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block font-semibold mb-2">Days per Week *</label>
                            <select id="transitionDaysPerWeek" required 
                                    class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white">
                                <option value="">Select days</option>
                                <option value="1">1 day/week</option>
                                <option value="2">2 days/week</option>
                                <option value="3">3 days/week</option>
                                <option value="5">5 days/week</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-semibold mb-2">Monthly Fee (₦) *</label>
                            <input type="number" id="transitionMonthlyFee" required min="0"
                                   class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                                   placeholder="Enter monthly fee">
                        </div>
                    </div>
                    
                    <div class="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <button type="button" onclick="showDashboard()" 
                                class="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" 
                                class="px-6 py-3 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors flex items-center">
                            <span>Add Transition Student</span>
                            <span class="ml-2">🟧</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    const form = getElement('transitionStudentForm');
    if (form) {
        form.addEventListener('submit', handleTransitionStudentSubmit);
    }
    
    // Setup subject checkboxes event listeners
    setupTransitionSubjectsListeners();
}

function generateTransitionSubjectsCheckboxes() {
    let html = '';
    
    // Academic Subjects
    html += `
        <div class="border-l-4 border-blue-500 pl-4">
            <h5 class="font-semibold text-blue-700 dark:text-blue-300 mb-2">Academic Subjects</h5>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <label class="inline-flex items-center">
                    <input type="checkbox" value="Mathematics" class="subject-checkbox academic-subject rounded border-gray-300">
                    <span class="ml-2">Mathematics</span>
                </label>
                <label class="inline-flex items-center">
                    <input type="checkbox" value="English Language" class="subject-checkbox academic-subject rounded border-gray-300">
                    <span class="ml-2">English Language</span>
                </label>
                <label class="inline-flex items-center">
                    <input type="checkbox" value="Science" class="subject-checkbox academic-subject rounded border-gray-300">
                    <span class="ml-2">Science</span>
                </label>
                <label class="inline-flex items-center">
                    <input type="checkbox" value="Social Studies" class="subject-checkbox academic-subject rounded border-gray-300">
                    <span class="ml-2">Social Studies</span>
                </label>
                <label class="inline-flex items-center">
                    <input type="checkbox" value="Basic Science & Technology" class="subject-checkbox academic-subject rounded border-gray-300">
                    <span class="ml-2">Basic Science & Technology</span>
                </label>
                <label class="inline-flex items-center">
                    <input type="checkbox" value="Literacy & Numeracy" class="subject-checkbox academic-subject rounded border-gray-300">
                    <span class="ml-2">Literacy & Numeracy</span>
                </label>
            </div>
        </div>
    `;
    
    // Specialized Subjects
    Object.entries(SUBJECT_CATEGORIES).forEach(([category, subjects]) => {
        const borderColors = {
            "Native Language": "border-green-500",
            "Foreign Language": "border-purple-500", 
            "Specialized": "border-red-500"
        };
        
        html += `
            <div class="border-l-4 ${borderColors[category]} pl-4">
                <h5 class="font-semibold text-${category === 'Native Language' ? 'green' : category === 'Foreign Language' ? 'purple' : 'red'}-700 dark:text-${category === 'Native Language' ? 'green' : category === 'Foreign Language' ? 'purple' : 'red'}-300 mb-2">${category}</h5>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        `;
        
        subjects.forEach(subject => {
            html += `
                <label class="inline-flex items-center">
                    <input type="checkbox" value="${subject}" class="subject-checkbox specialized-subject rounded border-gray-300">
                    <span class="ml-2">${subject}</span>
                </label>
            `;
        });
        
        html += `</div></div>`;
    });
    
    return html;
}

function setupTransitionSubjectsListeners() {
    const specializedCheckboxes = document.querySelectorAll('.specialized-subject');
    const groupClassContainer = getElement('transitionGroupClassContainer');
    
    specializedCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const anySpecializedChecked = Array.from(specializedCheckboxes).some(cb => cb.checked);
            if (groupClassContainer) {
                groupClassContainer.classList.toggle('hidden', !anySpecializedChecked);
            }
        });
    });
}

async function handleTransitionStudentSubmit(e) {
    e.preventDefault();
    
    const parentName = getElement('transitionParentName')?.value.trim();
    const parentPhone = getElement('transitionParentPhone')?.value.trim();
    const studentName = getElement('transitionStudentName')?.value.trim();
    const grade = getElement('transitionGrade')?.value.trim();
    const daysPerWeek = getElement('transitionDaysPerWeek')?.value;
    const monthlyFee = getElement('transitionMonthlyFee')?.value;
    const isGroupClass = getElement('transitionIsGroupClass')?.checked || false;
    
    // Get selected subjects
    const selectedSubjects = Array.from(document.querySelectorAll('.subject-checkbox:checked'))
                                 .map(cb => cb.value);
    
    if (!parentName || !parentPhone || !studentName || !grade || !daysPerWeek || !monthlyFee || selectedSubjects.length === 0) {
        alert('Please fill in all required fields and select at least one subject.');
        return;
    }
    
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert('You must be logged in to add a student.');
            return;
        }
        
        const transitionStudent = {
            parentName,
            parentPhone,
            studentName,
            grade,
            subjects: selectedSubjects,
            daysPerWeek: parseInt(daysPerWeek),
            monthlyFee: parseInt(monthlyFee),
            isGroupClass,
            isTransitioning: true,
            transitionAddedDate: new Date().toISOString(),
            tutorEmail: currentUser.email,
            tutorId: currentUser.uid,
            createdAt: new Date().toISOString(),
            status: 'active'
        };
        
        await addDoc(collection(db, 'students'), transitionStudent);
        
        alert('Transition student added successfully! They will be automatically removed at the beginning of next month.');
        showDashboard();
        
    } catch (error) {
        console.error('Error adding transition student:', error);
        alert('Error adding transition student. Please try again.');
    }
}

// --- Student Management Functions ---
async function loadStudentsForDashboard() {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        const studentsQuery = query(
            collection(db, 'students'),
            where('tutorId', '==', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(studentsQuery);
        const students = [];
        let transitionCount = 0;
        
        querySnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            students.push(student);
            if (student.isTransitioning) {
                transitionCount++;
            }
        });
        
        // Update counts
        const totalStudentsCount = getElement('totalStudentsCount');
        const transitionStudentsCount = getElement('transitionStudentsCount');
        if (totalStudentsCount) totalStudentsCount.textContent = students.length;
        if (transitionStudentsCount) transitionStudentsCount.textContent = transitionCount;
        
        displayStudentsList(students);
        
    } catch (error) {
        console.error('Error loading students:', error);
        const studentsList = getElement('studentsList');
        if (studentsList) {
            studentsList.innerHTML = '<p class="text-center text-red-500 py-8">Error loading students</p>';
        }
    }
}

async function loadStudentsForDatabase() {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        const studentsQuery = query(
            collection(db, 'students'),
            where('tutorId', '==', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(studentsQuery);
        const students = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        displayStudentDatabaseList(students);
        
    } catch (error) {
        console.error('Error loading student database:', error);
        const studentDatabaseList = getElement('studentDatabaseList');
        if (studentDatabaseList) {
            studentDatabaseList.innerHTML = '<tr><td colspan="6" class="text-center p-6 text-red-500">Error loading students</td></tr>';
        }
    }
}

function displayStudentsList(students) {
    const studentsList = getElement('studentsList');
    if (!studentsList) return;
    
    if (students.length === 0) {
        studentsList.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-500 mb-4">No students found</p>
                <button onclick="showAddStudentForm()" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors">
                    Add Your First Student
                </button>
            </div>
        `;
        return;
    }
    
    studentsList.innerHTML = students.map(student => {
        const isTransitioning = student.isTransitioning;
        const statusText = isTransitioning ? 'Transitioning Class' : 'Active';
        const statusColor = isTransitioning ? 'text-orange-600' : 'text-green-600';
        const rowClass = isTransitioning ? 'transition-student-row' : '';
        
        return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 ${rowClass}">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-xl font-semibold">${student.studentName} (${student.grade})</h4>
                        <p class="text-gray-600 dark:text-gray-400 mt-1">Parent: ${student.parentName} • ${student.parentPhone}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-sm font-medium ${statusColor} bg-${isTransitioning ? 'orange' : 'green'}-100 dark:bg-${isTransitioning ? 'orange' : 'green'}-900/30">
                        ${statusText}
                    </span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Subjects</p>
                        <p class="font-medium">${(student.subjects || []).join(', ')}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Days per Week</p>
                        <p class="font-medium">${student.daysPerWeek} days/week</p>
                    </div>
                </div>
                
                ${showStudentFees ? `
                    <div class="mb-4">
                        <p class="text-sm text-gray-600 dark:text-gray-400">Monthly Fee</p>
                        <p class="text-lg font-bold text-green-600">₦${student.monthlyFee?.toLocaleString() || '0'}</p>
                    </div>
                ` : ''}
                
                <div class="flex flex-wrap gap-2 justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div class="flex flex-wrap gap-2">
                        ${isTransitioning ? `
                            <button onclick="confirmTransitionFee('${student.id}')" 
                                    class="transition-btn px-4 py-2 rounded text-white text-sm font-medium">
                                Confirm Fee
                            </button>
                        ` : `
                            <button onclick="enterMonthlyReport('${student.id}')" 
                                    class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium">
                                Enter Report
                            </button>
                        `}
                        
                        ${showEditDeleteButtons ? `
                            <button onclick="editStudent('${student.id}')" 
                                    class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 text-sm font-medium">
                                Edit
                            </button>
                            <button onclick="deleteStudent('${student.id}')" 
                                    class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm font-medium">
                                Delete
                            </button>
                        ` : ''}
                    </div>
                    
                    ${isTransitioning ? `
                        <span class="transition-badge text-xs">Transition Student</span>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function displayStudentDatabaseList(students) {
    const studentDatabaseList = getElement('studentDatabaseList');
    if (!studentDatabaseList) return;
    
    if (students.length === 0) {
        studentDatabaseList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center p-6 text-gray-500">
                    No students found. <button onclick="showAddStudentForm()" class="text-green-600 hover:underline">Add a student</button>
                </td>
            </tr>
        `;
        return;
    }
    
    studentDatabaseList.innerHTML = students.map(student => {
        const isTransitioning = student.isTransitioning;
        const statusText = isTransitioning ? 'Transitioning' : 'Active';
        const statusColor = isTransitioning ? 'text-orange-600' : 'text-green-600';
        
        return `
            <tr class="border-b border-gray-200 dark:border-gray-700 ${isTransitioning ? 'transition-student-row' : ''}">
                <td class="p-3">
                    <div class="font-semibold">${student.studentName}</div>
                    ${isTransitioning ? '<div class="transition-badge text-xs inline-block mt-1">Transition</div>' : ''}
                </td>
                <td class="p-3">${student.grade}</td>
                <td class="p-3">${(student.subjects || []).join(', ')}</td>
                <td class="p-3">${student.daysPerWeek} days/week</td>
                <td class="p-3">
                    <span class="px-2 py-1 rounded-full text-xs ${statusColor} bg-${isTransitioning ? 'orange' : 'green'}-100 dark:bg-${isTransitioning ? 'orange' : 'green'}-900/30">
                        ${statusText}
                    </span>
                </td>
                <td class="p-3">
                    <div class="flex space-x-2">
                        ${isTransitioning ? `
                            <button onclick="confirmTransitionFee('${student.id}')" 
                                    class="transition-btn px-3 py-1 rounded text-white text-xs">
                                Confirm Fee
                            </button>
                        ` : `
                            <button onclick="enterMonthlyReport('${student.id}')" 
                                    class="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-xs">
                                Enter Report
                            </button>
                        `}
                        
                        ${showEditDeleteButtons ? `
                            <button onclick="editStudent('${student.id}')" 
                                    class="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 text-xs">
                                Edit
                            </button>
                            <button onclick="deleteStudent('${student.id}')" 
                                    class="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-xs">
                                Delete
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// --- NEW: Transition Student Fee Confirmation ---
async function confirmTransitionFee(studentId) {
    try {
        const studentDoc = await getDoc(doc(db, 'students', studentId));
        if (!studentDoc.exists()) {
            alert('Student not found.');
            return;
        }
        
        const student = studentDoc.data();
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        
        // Check if fee already confirmed for this month
        const pendingQuery = query(
            collection(db, 'pending_students'),
            where('studentId', '==', studentId),
            where('month', '==', currentMonth)
        );
        
        const pendingSnapshot = await getDocs(pendingQuery);
        if (!pendingSnapshot.empty) {
            alert('Fee already confirmed for this month.');
            return;
        }
        
        // Show fee confirmation popup
        showTransitionFeeConfirmation(student, studentId);
        
    } catch (error) {
        console.error('Error confirming transition fee:', error);
        alert('Error confirming fee. Please try again.');
    }
}

function showTransitionFeeConfirmation(student, studentId) {
    const popupHTML = `
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div class="relative bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md mx-auto">
                <h3 class="text-xl font-bold mb-4 transition-header">Confirm Monthly Fee</h3>
                
                <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded border border-orange-200 dark:border-orange-700 mb-4">
                    <h4 class="font-semibold text-orange-800 dark:text-orange-200">Transition Student</h4>
                    <p class="text-orange-700 dark:text-orange-300 text-sm mt-1">
                        ${student.studentName} (${student.grade})
                    </p>
                    <p class="text-orange-700 dark:text-orange-300 text-sm">
                        Monthly Fee: <span class="font-bold">₦${student.monthlyFee?.toLocaleString() || '0'}</span>
                    </p>
                </div>
                
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Click confirm to proceed with bank details for this month's fee.
                </p>
                
                <div class="flex justify-end space-x-3 mt-6">
                    <button type="button" onclick="closeTransitionFeePopup()" 
                            class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                        Cancel
                    </button>
                    <button type="button" onclick="proceedToBankDetails('${studentId}')" 
                            class="transition-btn px-4 py-2 rounded text-white">
                        Confirm Fee
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const popup = document.createElement('div');
    popup.id = 'transitionFeePopup';
    popup.innerHTML = popupHTML;
    document.body.appendChild(popup);
}

function closeTransitionFeePopup() {
    const popup = document.getElementById('transitionFeePopup');
    if (popup) {
        document.body.removeChild(popup);
    }
}

async function proceedToBankDetails(studentId) {
    closeTransitionFeePopup();
    
    try {
        const studentDoc = await getDoc(doc(db, 'students', studentId));
        if (!studentDoc.exists()) {
            alert('Student not found.');
            return;
        }
        
        const student = studentDoc.data();
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        // Show bank details form (reuse existing bank details flow)
        showBankDetailsForm(student, studentId, currentMonth, true);
        
    } catch (error) {
        console.error('Error proceeding to bank details:', error);
        alert('Error processing fee confirmation. Please try again.');
    }
}

// --- Existing Functions (with necessary modifications) ---
function showAddStudentForm() {
    // Implementation of existing add student form
    // This would show the regular student addition form
    console.log('Show add student form');
}

function enterMonthlyReport(studentId) {
    // Implementation of existing monthly report entry
    console.log('Enter monthly report for:', studentId);
}

function editStudent(studentId) {
    // Implementation of existing student editing
    console.log('Edit student:', studentId);
}

function deleteStudent(studentId) {
    // Implementation of existing student deletion
    console.log('Delete student:', studentId);
}

function showBankDetailsForm(student, studentId, month, isTransitioning = false) {
    // Implementation of existing bank details form
    // Modified to accept isTransitioning parameter
    console.log('Show bank details for:', studentId, 'Transitioning:', isTransitioning);
}

// --- Auto-cleanup for Transition Students ---
async function cleanupTransitionStudents() {
    try {
        const now = new Date();
        // Only run cleanup on 1st-3rd of each month
        if (now.getDate() < 1 || now.getDate() > 3) {
            return;
        }
        
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const studentsQuery = query(
            collection(db, 'students'),
            where('isTransitioning', '==', true),
            where('transitionAddedDate', '<', firstDayOfMonth.toISOString())
        );
        
        const querySnapshot = await getDocs(studentsQuery);
        const batch = writeBatch(db);
        
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        if (querySnapshot.size > 0) {
            await batch.commit();
            console.log(`Cleaned up ${querySnapshot.size} transition students`);
        }
        
    } catch (error) {
        console.error('Error cleaning up transition students:', error);
    }
}

// --- Initialize Application ---
async function initializeApp() {
    try {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in
                const tutorNameHeading = getElement('tutorNameHeading');
                if (tutorNameHeading) {
                    tutorNameHeading.textContent = `Welcome, ${user.displayName || 'Tutor'}!`;
                }
                
                // Load tutor data and settings
                const tutorDoc = await getDoc(doc(db, 'tutors', user.uid));
                if (tutorDoc.exists()) {
                    const tutor = { id: tutorDoc.id, ...tutorDoc.data() };
                    
                    // Show employment date popup if needed
                    if (shouldShowEmploymentPopup(tutor)) {
                        showEmploymentDatePopup(tutor);
                    }
                    
                    // Load admin settings
                    await loadAdminSettings(tutor);
                }
                
                // Setup navigation and show dashboard
                setupNavigation();
                showDashboard();
                
                // Run transition student cleanup
                cleanupTransitionStudents();
                
            } else {
                // User is signed out
                window.location.href = 'index.html';
            }
        });
        
        // Setup logout button
        const logoutBtn = getElement('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    await signOut(auth);
                } catch (error) {
                    console.error('Error signing out:', error);
                }
            });
        }
        
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

async function loadAdminSettings(tutor) {
    try {
        const settingsDoc = await getDoc(doc(db, 'admin_settings', 'submission_settings'));
        if (settingsDoc.exists()) {
            const settings = settingsDoc.data();
            isSubmissionEnabled = settings.isSubmissionEnabled || false;
            isTutorAddEnabled = settings.isTutorAddEnabled || false;
            isSummerBreakEnabled = settings.isSummerBreakEnabled || false;
            isBypassApprovalEnabled = settings.isBypassApprovalEnabled || false;
            showStudentFees = settings.showStudentFees || false;
            showEditDeleteButtons = settings.showEditDeleteButtons || false;
        }
    } catch (error) {
        console.error('Error loading admin settings:', error);
    }
}

// Start the application
initializeApp();
