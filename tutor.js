/*******************************************************************************
 * SECTION 1: IMPORTS & INITIAL SETUP
 * GitHub: https://github.com/psalminfo/blooming-kids-cbt/blob/main/tutor.js
 ******************************************************************************/

import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, deleteDoc, setDoc, deleteField, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

/*******************************************************************************
 * SECTION 2: STYLES & CSS (REMOVED – MOVED TO HTML)
 ******************************************************************************/


/*******************************************************************************
 * SECTION 3: CONFIGURATION & CONSTANTS
 ******************************************************************************/

// Cloudinary Configuration
const CLOUDINARY_CONFIG = {
    cloudName: 'dwjq7j5zp',
    uploadPreset: 'tutor_homework',
    apiKey: '963245294794452'
};

// Global state to hold report submission status
let isSubmissionEnabled = false;
let isTutorAddEnabled = false;
let isSummerBreakEnabled = false;
let isBypassApprovalEnabled = false;
let showStudentFees = false;
let showEditDeleteButtons = false;
let isTransitionAddEnabled = true;     
let isPreschoolAddEnabled = true; 

// Pay Scheme Configuration
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
                "Counseling Programs": 25000}
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

// Subject Categorization
const SUBJECT_CATEGORIES = {
    "Native Language": ["Yoruba", "Igbo", "Hausa"],
    "Foreign Language": ["French", "German", "Spanish", "Arabic"],
    "Specialized": ["Music", "Coding","ICT", "Chess", "Public Speaking", "English Proficiency", "Counseling Programs"]
};

// Schedule Days and Times with 24-hour support
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Create time slots from 00:00 to 23:30 in 30-minute intervals
const TIME_SLOTS = [];
for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
        const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        let label;
        
        if (hour === 0 && minute === 0) {
            label = "12:00 AM (Midnight)";
        } else if (hour === 12 && minute === 0) {
            label = "12:00 PM (Noon)";
        } else {
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            label = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
        }
        
        TIME_SLOTS.push({ value: timeValue, label: label });
    }
}

// Add an extra slot for 23:30 if not already included
if (!TIME_SLOTS.find(slot => slot.value === "23:30")) {
    TIME_SLOTS.push({value: "23:30", label: "11:30 PM"});
}

// Sort time slots in chronological order
TIME_SLOTS.sort((a, b) => {
    const timeToMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };
    
    return timeToMinutes(a.value) - timeToMinutes(b.value);
});

/*******************************************************************************
 * SECTION 4: UTILITY FUNCTIONS
 ******************************************************************************/

// ----- ESCAPE HTML (XSS PROTECTION) -----
function escapeHtml(unsafe) {
    if (unsafe === undefined || unsafe === null) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Phone Number Normalization Function
function normalizePhoneNumber(phone) {
    if (!phone) return '';
    
    let cleaned = phone.toString().trim();
    
    if (cleaned.startsWith('+')) {
        const digits = cleaned.substring(1).replace(/\D/g, '');
        return '+' + digits;
    }
    
    if (cleaned.startsWith('0')) {
        const digits = cleaned.replace(/\D/g, '');
        if (digits.startsWith('0')) {
            return '+234' + digits.substring(1);
        }
    }
    
    if (cleaned.match(/^234/)) {
        const digits = cleaned.replace(/\D/g, '');
        return '+' + digits;
    }
    
    const digits = cleaned.replace(/\D/g, '');
    
    if (digits.length === 10 && /^[789]/.test(digits)) {
        return '+234' + digits;
    }
    
    if (digits.length >= 10 && !cleaned.startsWith('+')) {
        return '+' + digits;
    }
    
    if (/^\d+$/.test(cleaned) && !cleaned.startsWith('+')) {
        return '+' + cleaned;
    }
    
    return cleaned;
}

// Time validation to allow 12 AM to 1 AM and overnight classes
function validateScheduleTime(start, end) {
    const timeToMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };
    
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    
    // Allow overnight classes (e.g., 11 PM to 1 AM)
    if (endMinutes < startMinutes) {
        // This is an overnight class (e.g., 23:00 to 01:00)
        // End time is actually the next day
        const adjustedEndMinutes = endMinutes + (24 * 60);
        const duration = adjustedEndMinutes - startMinutes;
        
        // Ensure minimum duration (e.g., at least 30 minutes)
        if (duration < 30) {
            return { valid: false, message: 'Class must be at least 30 minutes long' };
        }
        
        // Ensure maximum duration (e.g., no more than 4 hours)
        if (duration > 4 * 60) {
            return { valid: false, message: 'Class cannot exceed 4 hours' };
        }
        
        return { valid: true, isOvernight: true, duration: duration };
    }
    
    // Normal daytime class
    const duration = endMinutes - startMinutes;
    
    if (duration < 30) {
        return { valid: false, message: 'Class must be at least 30 minutes long' };
    }
    
    if (duration > 4 * 60) {
        return { valid: false, message: 'Class cannot exceed 4 hours' };
    }
    
    return { valid: true, isOvernight: false, duration: duration };
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format schedule time for display
function formatScheduleTime(timeString) {
    const [hour, minute] = timeString.split(':').map(Number);
    
    if (hour === 0 && minute === 0) {
        return "12:00 AM (Midnight)";
    }
    
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

// Format time for chat display
function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 24 * 60 * 60 * 1000) {
        // Today
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
        // This week
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        // Older
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// Clean grade string
function cleanGradeString(grade) {
    if (grade && grade.toLowerCase().includes("grade")) {
        return grade;
    } else {
        return `Grade ${grade}`;
    }
}

// Get current month and year
function getCurrentMonthYear() {
    const now = new Date();
    return now.toLocaleString('default', { month: 'long', year: 'numeric' });
}

// Get most scheduled day from schedule data
function getMostScheduledDay(scheduleByDay) {
    let maxDay = '';
    let maxCount = 0;
    
    DAYS_OF_WEEK.forEach(day => {
        if (scheduleByDay[day].length > maxCount) {
            maxCount = scheduleByDay[day].length;
            maxDay = day;
        }
    });
    
    return maxDay ? `${maxDay} (${maxCount} classes)` : 'None';
}

// Get earliest class from schedule data
function getEarliestClass(scheduleByDay) {
    let earliestTime = "23:59";
    let earliestInfo = "";
    
    DAYS_OF_WEEK.forEach(day => {
        scheduleByDay[day].forEach(event => {
            if (event.start < earliestTime) {
                earliestTime = event.start;
                earliestInfo = `${formatScheduleTime(event.start)} (${escapeHtml(event.student)} - ${escapeHtml(day)})`;
            }
        });
    });
    
    return earliestInfo || "No classes scheduled";
}

// Find specialized subject
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

// Get tutor pay scheme based on employment date
function getTutorPayScheme(tutor) {
    if (tutor.isManagementStaff) return PAY_SCHEMES.MANAGEMENT;
    
    if (!tutor.employmentDate) return PAY_SCHEMES.NEW_TUTOR;
    
    const employmentDate = new Date(tutor.employmentDate + '-01');
    const currentDate = new Date();
    const monthsDiff = (currentDate.getFullYear() - employmentDate.getFullYear()) * 12 + 
                      (currentDate.getMonth() - employmentDate.getMonth());
    
    return monthsDiff >= 12 ? PAY_SCHEMES.OLD_TUTOR : PAY_SCHEMES.NEW_TUTOR;
}

// Calculate suggested fee based on student and pay scheme
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
    
    const isSubjectTeacher = subjects.some(subj => ["Math", "English", "Science"].includes(subj)) && 
                            parseInt(grade.replace('Grade ', '')) >= 5;
    
    if (isSubjectTeacher) {
        return payScheme.academic["Subject Teachers"][days] || 0;
    } else {
        return payScheme.academic[gradeCategory][days] || 0;
    }
}

// Show custom alert
function showCustomAlert(message) {
    const alertModal = document.createElement('div');
    alertModal.className = 'modal-overlay';
    alertModal.innerHTML = `
        <div class="modal-content max-w-sm">
            <div class="modal-body">
                <p class="mb-4 text-center">${escapeHtml(message)}</p>
                <div class="flex justify-center">
                    <button id="alert-ok-btn" class="btn btn-primary">OK</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(alertModal);
    document.getElementById('alert-ok-btn').addEventListener('click', () => alertModal.remove());
}

// Update active tab with smooth fade transition
// ── Persistent Lagos clock (renders on every tab, top-right fixed bar) ──
function ensureGlobalClock() {
    const CLOCK_ID = 'global-tutor-clock-bar';
    if (document.getElementById(CLOCK_ID)) return; // already mounted

    function formatLagosDT() {
        return new Intl.DateTimeFormat('en-NG', {
            weekday:'short', day:'numeric', month:'short', year:'numeric',
            hour:'2-digit', minute:'2-digit', second:'2-digit',
            hour12:true, timeZone:'Africa/Lagos'
        }).format(new Date()) + ' WAT';
    }

    const bar = document.createElement('div');
    bar.id = CLOCK_ID;
    bar.style.cssText = [
        'position:fixed', 'top:0', 'right:0', 'z-index:99999',
        'background:linear-gradient(90deg,#1e40af,#1d4ed8)',
        'color:#fff', 'font-size:11px', 'font-weight:600',
        'padding:4px 14px', 'border-bottom-left-radius:10px',
        'letter-spacing:.4px', 'box-shadow:0 2px 8px rgba(0,0,0,.25)',
        'font-family:monospace', 'white-space:nowrap', 'pointer-events:none'
    ].join(';');
    bar.textContent = '📍 Lagos · ' + formatLagosDT();
    document.body.appendChild(bar);

    if (window._globalClockInterval) clearInterval(window._globalClockInterval);
    window._globalClockInterval = setInterval(() => {
        const el = document.getElementById(CLOCK_ID);
        if (el) el.textContent = '📍 Lagos · ' + formatLagosDT();
    }, 1000);
}

function updateActiveTab(activeTabId) {
    const navTabs = ['navDashboard', 'navStudentDatabase', 'navAutoStudents', 'navScheduleManagement', 'navAcademic', 'navCourses'];
    navTabs.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.classList.toggle('active', tabId === activeTabId);
        }
    });

    // Ensure persistent clock on every tab
    ensureGlobalClock();

    // Fade in main content on tab switch
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
        mainContent.style.opacity = '0';
        mainContent.style.transform = 'translateY(6px)';
        mainContent.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
        requestAnimationFrame(() => {
            setTimeout(() => {
                mainContent.style.opacity = '1';
                mainContent.style.transform = 'translateY(0)';
            }, 30);
        });
    }
}

/*******************************************************************************
 * SECTION 5: STORAGE MANAGEMENT (Firestore & LocalStorage)
 ******************************************************************************/

// Firestore Functions for Report Persistence
async function saveReportsToFirestore(tutorEmail, reports) {
    try {
        const reportRef = doc(db, "tutor_saved_reports", tutorEmail);
        await setDoc(reportRef, {
            reports: reports,
            lastUpdated: new Date()
        }, { merge: true });
    } catch (error) {
        console.warn('Error saving to Firestore:', error);
        saveReportsToLocalStorage(tutorEmail, reports);
    }
}

async function loadReportsFromFirestore(tutorEmail) {
    try {
        const reportRef = doc(db, "tutor_saved_reports", tutorEmail);
        const docSnap = await getDoc(reportRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.reports || {};
        } else {
            return loadReportsFromLocalStorage(tutorEmail);
        }
    } catch (error) {
        console.warn('Error loading from Firestore, using localStorage:', error);
        return loadReportsFromLocalStorage(tutorEmail);
    }
}

async function clearAllReportsFromFirestore(tutorEmail) {
    try {
        const reportRef = doc(db, "tutor_saved_reports", tutorEmail);
        await updateDoc(reportRef, {
            reports: {},
            lastUpdated: new Date()
        });
    } catch (error) {
        console.warn('Error clearing Firestore reports:', error);
        clearAllReportsFromLocalStorage(tutorEmail);
    }
}

// Local Storage Functions
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

/*******************************************************************************
 * SECTION 6: EMPLOYMENT & TIN MANAGEMENT
 ******************************************************************************/

// Employment Date Functions
function shouldShowEmploymentPopup(tutor) {
    if (tutor.employmentDate) return false;
    
    const lastPopupShown = localStorage.getItem(`employmentPopup_${tutor.email}`);
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    return !lastPopupShown || lastPopupShown !== currentMonth;
}

function showEmploymentDatePopup(tutor) {
    const popupHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">📋 Employment Information</h3>
                </div>
                <div class="modal-body">
                    <p class="text-sm text-gray-600 mb-4">Please provide your employment start date to help us calculate your payments accurately.</p>
                    <div class="form-group">
                        <label class="form-label">Month & Year of Employment</label>
                        <input type="month" id="employment-date" class="form-input" max="${escapeHtml(new Date().toISOString().slice(0, 7))}">
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="save-employment-btn" class="btn btn-primary">Save</button>
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
            showCustomAlert('✅ Employment date saved successfully!');
            window.tutorData.employmentDate = employmentDate;
        } catch (error) {
            console.error("Error saving employment date:", error);
            showCustomAlert('❌ Error saving employment date. Please try again.');
        }
    });
}

// TIN Functions
function shouldShowTINPopup(tutor) {
    if (tutor.tinNumber) return false;
    
    const lastPopupShown = localStorage.getItem(`tinPopup_${tutor.email}`);
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    return !lastPopupShown || lastPopupShown !== currentMonth;
}

function showTINPopup(tutor) {
    const popupHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">📋 Tax Identification Number (TIN)</h3>
                </div>
                <div class="modal-body">
                    <p class="text-sm text-gray-600 mb-4">Please provide your TIN for payment processing and tax documentation.</p>
                    <div class="form-group">
                        <label class="form-label">Tax Identification Number (TIN)</label>
                            <input type="text" id="tin-number" class="form-input" placeholder="Enter your TIN" maxlength="20">
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="no-tin-btn" class="btn btn-secondary">I don't have TIN</button>
                    <button id="save-tin-btn" class="btn btn-primary">Save TIN</button>
                </div>
            </div>
        </div>
    `;
    
    const popup = document.createElement('div');
    popup.innerHTML = popupHTML;
    document.body.appendChild(popup);

    document.getElementById('no-tin-btn').addEventListener('click', () => {
        localStorage.setItem(`tinPopup_${tutor.email}`, new Date().toISOString().slice(0, 7));
        popup.remove();
    });

    document.getElementById('save-tin-btn').addEventListener('click', async () => {
        const tinNumber = document.getElementById('tin-number').value.trim();
        if (!tinNumber) {
            showCustomAlert('Please enter your TIN or click "I don\'t have TIN".');
            return;
        }

        try {
            const tutorRef = doc(db, "tutors", tutor.id);
            await updateDoc(tutorRef, { tinNumber: tinNumber });
            popup.remove();
            showCustomAlert('✅ TIN saved successfully!');
            window.tutorData.tinNumber = tinNumber;
        } catch (error) {
            console.error("Error saving TIN:", error);
            showCustomAlert('❌ Error saving TIN. Please try again.');
        }
    });
}

/*******************************************************************************
 * SECTION 7: SCHEDULE MANAGEMENT (REFACTORED - CLASS BASED & ROBUST)
 ******************************************************************************/

class ScheduleManager {
    constructor(tutor, firebaseDeps) {
        this.tutor = tutor;
        // Dependency Injection for Firebase globals
        this.db = firebaseDeps.db;
        this.methods = firebaseDeps.methods; // { getDocs, query, collection, etc. }
        
        // State
        this.students = [];
        this.scheduledStudentIds = new Set();
        this.queue = [];
        this.activeStudent = null;
        
        // DOM Elements
        this.popup = null;
        this.abortController = null; // The master switch for event listeners
        
        // Static Config
        this.TIME_SLOTS = this.generateTimeSlots();
        this.DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        // Styles are now in HTML, no injection needed
    }

    // --- INITIALIZATION ---

    /**
     * Entry point to check for unscheduled students
     */
    async checkAndShowPopup() {
        if (sessionStorage.getItem('schedulePopupShown')) return;

        // Check if we are on a relevant view (Custom logic replaced with simple DOM check)
        const dashboardElement = document.querySelector('.dashboard-container') || document.body;
        if (!dashboardElement) return;

        await this.loadStudents();

        const unscheduled = this.students.filter(s => !this.scheduledStudentIds.has(s.id));
        
        if (unscheduled.length > 0) {
            sessionStorage.setItem('schedulePopupShown', 'true');
            // Small delay for UX
            setTimeout(() => this.openModal(unscheduled), 1000);
        }
    }

    /**
     * Manual Trigger for the "Manage Schedules" button
     */
    async openManualManager() {
        await this.loadStudents();
        // Show all active students for manual management
        const activeStudents = this.students.filter(s => 
            !['archived', 'graduated', 'transferred'].includes(s.status)
        );
        
        if (activeStudents.length === 0) {
            this.showAlert('No active students found.', 'info');
            return;
        }
        
        this.openModal(activeStudents);
    }

    async loadStudents() {
        try {
            const { query, collection, where, getDocs } = this.methods;
            const q = query(collection(this.db, "students"), where("tutorEmail", "==", this.tutor.email));
            const snapshot = await getDocs(q);
            
            this.students = [];
            this.scheduledStudentIds.clear();

            snapshot.forEach(doc => {
                const data = doc.data();
                const student = { id: doc.id, ...data };
                this.students.push(student);
                
                if (data.schedule && Array.isArray(data.schedule) && data.schedule.length > 0) {
                    this.scheduledStudentIds.add(doc.id);
                }
            });
        } catch (error) {
            console.error("Data Load Error:", error);
            this.showAlert('Failed to load student data', 'error');
        }
    }

    // --- CORE LOGIC ---

    generateTimeSlots() {
        const slots = [];
        for (let i = 0; i < 24 * 4; i++) { // 15 min intervals
            const totalMinutes = i * 15;
            const h = Math.floor(totalMinutes / 60);
            const m = totalMinutes % 60;
            
            const hourStr = h.toString().padStart(2, '0');
            const minStr = m.toString().padStart(2, '0');
            const value = `${hourStr}:${minStr}`;
            
            // Format Label
            const ampm = h >= 12 ? 'PM' : 'AM';
            let labelH = h % 12;
            labelH = labelH === 0 ? 12 : labelH;
            const label = `${labelH}:${minStr} ${ampm}`;
            
            slots.push({ value, label });
        }
        return slots;
    }

    // --- UI RENDERING ---

    openModal(studentQueue) {
        this.queue = studentQueue;
        this.renderNextInQueue();
    }

    renderNextInQueue() {
        // Cleanup previous state
        if (this.popup) this.closeModal();

        if (this.queue.length === 0) {
            this.showAlert('🎉 All students managed!', 'success');
            return;
        }

        this.activeStudent = this.queue[0];
        const remaining = this.queue.length;

        // Create AbortController for this specific modal instance
        this.abortController = new AbortController();
        const signal = { signal: this.abortController.signal };

        // Construct HTML (escape student name)
        const html = `
            <div class="modal-overlay" id="schedule-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">📅 Schedule Management</h3>
                        <div class="flex items-center gap-2">
                            <span class="badge badge-info">${escapeHtml(remaining)} in queue</span>
                            <button class="btn btn-sm btn-ghost close-trigger">✕</button>
                        </div>
                    </div>
                    
                    <div class="modal-body">
                        <div class="student-info">
                            <h4 class="font-semibold text-blue-800">${escapeHtml(this.activeStudent.studentName)}</h4>
                            <p class="text-sm text-blue-600">
                                ${escapeHtml(this.activeStudent.grade || 'No Grade')} • ${escapeHtml(this.activeStudent.subjects?.join(', ') || 'No Subjects')}
                            </p>
                        </div>
                        
                        <div id="schedule-entries" class="space-y-3 mb-4 max-h-[50vh] overflow-y-auto"></div>
                        
                        <button id="add-time-btn" class="btn btn-outline w-full mb-4">＋ Add Time Slot</button>
                        
                        <div class="flex gap-2">
                            <button id="delete-sched-btn" class="btn btn-danger flex-1">🗑️ Delete Schedule</button>
                            <button id="skip-btn" class="btn btn-ghost">Skip</button>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button id="save-btn" class="btn btn-primary">Save</button>
                        <button id="save-next-btn" class="btn btn-success">Save & Next</button>
                    </div>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        this.popup = wrapper.firstElementChild;
        document.body.appendChild(this.popup);

        // Populate existing schedule
        const container = this.popup.querySelector('#schedule-entries');
        const existing = this.activeStudent.schedule || [];
        if (existing.length > 0) {
            existing.forEach(slot => this.addTimeRow(container, slot));
        } else {
            this.addTimeRow(container);
        }

        // --- EVENT BINDING (Using AbortController signal) ---
        
        // Add Row
        this.popup.querySelector('#add-time-btn').addEventListener('click', () => {
            this.addTimeRow(container);
        }, signal);

        // Close
        this.popup.querySelector('.close-trigger').addEventListener('click', () => this.closeModal(), signal);
        this.popup.addEventListener('click', (e) => {
            if (e.target.id === 'schedule-modal') this.closeModal();
        }, signal);

        // Escape Key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        }, signal);

        // Actions
        this.popup.querySelector('#delete-sched-btn').addEventListener('click', () => this.deleteSchedule(), signal);
        this.popup.querySelector('#skip-btn').addEventListener('click', () => this.next(false), signal);
        this.popup.querySelector('#save-btn').addEventListener('click', () => this.save(false), signal);
        this.popup.querySelector('#save-next-btn').addEventListener('click', () => this.save(true), signal);
    }

    addTimeRow(container, data = null) {
        const day = data?.day || 'Monday';
        const start = data?.start || '09:00';
        const end = data?.end || '10:00';

        const row = document.createElement('div');
        row.className = 'time-slot-row';
        row.innerHTML = `
            <button class="remove-row-btn">✕</button>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div class="flex flex-col">
                    <label class="text-xs font-medium mb-1">Day</label>
                    <select class="select select-bordered select-sm day-select">
                        ${this.DAYS.map(d => `<option value="${escapeHtml(d)}" ${d === day ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
                    </select>
                </div>
                <div class="flex flex-col">
                    <label class="text-xs font-medium mb-1">Start</label>
                    <select class="select select-bordered select-sm start-select">
                        ${this.TIME_SLOTS.map(s => `<option value="${escapeHtml(s.value)}" ${s.value === start ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('')}
                    </select>
                </div>
                <div class="flex flex-col">
                    <label class="text-xs font-medium mb-1">End</label>
                    <select class="select select-bordered select-sm end-select">
                        ${this.TIME_SLOTS.map(s => `<option value="${escapeHtml(s.value)}" ${s.value === end ? 'selected' : ''}>${escapeHtml(s.label)}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;

        container.appendChild(row);

        // Row specific event (no signal needed as row dies with modal)
        row.querySelector('.remove-row-btn').addEventListener('click', () => {
            if (container.children.length > 1) row.remove();
            else this.showAlert('Minimum one slot required', 'error');
        });
    }

    closeModal() {
        if (this.abortController) {
            this.abortController.abort(); // KILL ALL LISTENERS INSTANTLY
            this.abortController = null;
        }
        if (this.popup) {
            this.popup.remove();
            this.popup = null;
        }
    }

    // --- DATA OPERATIONS ---

    next(markScheduled) {
        if (markScheduled && this.activeStudent) {
            this.scheduledStudentIds.add(this.activeStudent.id);
        }
        this.queue.shift(); // Remove current
        this.renderNextInQueue();
    }

    async save(moveToNext) {
        const rows = this.popup.querySelectorAll('.time-slot-row');
        const schedule = [];
        let isValid = true;

        rows.forEach(row => {
            const day = row.querySelector('.day-select').value;
            const start = row.querySelector('.start-select').value;
            const end = row.querySelector('.end-select').value;

            if (start === end) {
                this.showAlert('Start and End time cannot be the same', 'error');
                isValid = false;
            }
            schedule.push({ day, start, end });
        });

        if (!isValid) return;

        try {
            const { updateDoc, doc, setDoc } = this.methods;
            
            // 1. Update Student Record
            const studentRef = doc(this.db, "students", this.activeStudent.id);
            await updateDoc(studentRef, { schedule });

            // 2. Update/Create Schedule Document
            const scheduleRef = doc(this.db, "schedules", `sched_${this.activeStudent.id}`);
            await setDoc(scheduleRef, {
                studentId: this.activeStudent.id,
                studentName: this.activeStudent.studentName,
                tutorEmail: this.tutor.email,
                schedule,
                updatedAt: new Date()
            }, { merge: true });

            this.showAlert('✅ Schedule Saved!', 'success');
            
            if (moveToNext) this.next(true);
            else this.closeModal();

        } catch (error) {
            console.error(error);
            this.showAlert('Save failed. Check console.', 'error');
        }
    }

    async deleteSchedule() {
        if (!confirm(`Delete schedule for ${escapeHtml(this.activeStudent.studentName)}?`)) return;

        try {
            const { updateDoc, doc, deleteDoc } = this.methods;
            
            // Remove schedule field from student
            await updateDoc(doc(this.db, "students", this.activeStudent.id), { 
                schedule: []  // Set to empty array instead of deleting field
            });
            
            // Delete the schedule document
            await deleteDoc(doc(this.db, "schedules", `sched_${this.activeStudent.id}`));

            this.showAlert('Schedule Deleted', 'success');
            this.next(false); // Move next but don't mark as "scheduled"
        } catch (error) {
            console.error("Delete error:", error);
            this.showAlert('Delete failed', 'error');
        }
    }

    // --- UTILITIES ---

    showAlert(msg, type = 'info') {
        const alert = document.createElement('div');
        const colors = type === 'error' ? 'bg-red-100 text-red-800' : 
                       type === 'success' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
        
        alert.className = `fixed top-4 right-4 z-[2000] p-4 rounded shadow-lg font-medium transform -all duration-300 translate-x-full ${colors}`;
        alert.textContent = msg;
        document.body.appendChild(alert);

        requestAnimationFrame(() => alert.classList.remove('translate-x-full'));
        setTimeout(() => {
            alert.classList.add('translate-x-full');
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }
}

// --- INSTANTIATION HELPER ---
// Call this when your app loads or when the tutor logs in.
// We pass the Firebase methods explicitly to avoid "magic global" errors.

function initScheduleManager(tutor) {
    const firebaseDeps = {
        db: db,
        methods: { 
            getDocs, query, collection, where, doc, updateDoc, 
            setDoc, deleteDoc, getDoc  // Make sure getDoc is included
        }
    };
    
    window.scheduleManager = new ScheduleManager(tutor, firebaseDeps);
    
    // Auto-check for unscheduled students
    setTimeout(() => {
        window.scheduleManager.checkAndShowPopup();
    }, 1000);
    
    // Helper to bind the "Manage Schedules" button in your navbar
    const manageBtn = document.getElementById('manage-schedules-nav-btn');
    if (manageBtn) {
        manageBtn.onclick = () => {
            if (window.scheduleManager) {
                window.scheduleManager.openManualManager();
            } else {
                showCustomAlert('Schedule manager not initialized. Please refresh the page.');
            }
        };
    }
    
    // Also bind to any existing "setup-all-schedules-btn" in the dashboard
    const setupBtn = document.getElementById('setup-all-schedules-btn');
    if (setupBtn && !setupBtn.hasAttribute('data-bound')) {
        setupBtn.setAttribute('data-bound', 'true');
        setupBtn.addEventListener('click', () => {
            if (window.scheduleManager) {
                window.scheduleManager.openManualManager();
            }
        });
    }
}

/*******************************************************************************
 * SECTION 8: DAILY TOPIC & HOMEWORK MANAGEMENT
 * (Version: Auto-Sync Parent Data & "Self-Healing" Database)
 ******************************************************************************/

// ==========================================
// 1. DAILY TOPIC FUNCTIONS
// ==========================================

function showDailyTopicModal(student) {
    const date = new Date();
    const monthName = date.toLocaleString('default', { month: 'long' });

    // Use local date for storage/display consistency
    const today = new Date();
    const localDateString = today.getFullYear() + '-' + 
                            String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(today.getDate()).padStart(2, '0');

    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-lg">
                <div class="modal-header">
                    <h3 class="modal-title">📚 Daily Topic: ${escapeHtml(student.studentName)}</h3>
                </div>
                <div class="modal-body">
                    <div id="topic-history-container" class="mb-5 bg-blue-50 p-3 rounded-lg border border-blue-100 hidden">
                        <div class="flex justify-between items-center mb-2">
                            <h5 class="font-bold text-blue-800 text-sm">📅 Topics Covered in ${escapeHtml(monthName)}</h5>
                            <span id="topic-count-badge" class="bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">0</span>
                        </div>
                        <div id="topic-history" class="topic-history text-sm text-gray-700 max-h-60 overflow-y-auto custom-scrollbar">
                            <div class="flex justify-center p-2">
                                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Enter Today's Topic *</label>
                        <textarea id="topic-topics" class="form-input form-textarea report-textarea" 
                            placeholder="e.g. Long Division, Introduction to Photosynthesis..." required></textarea>
                    </div>
                    <div class="mt-2 text-xs text-gray-500 flex justify-between">
                        <span>One topic per line recommended.</span>
                        <span>Date: ${escapeHtml(localDateString)}</span>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-topic-btn" class="btn btn-secondary">Close</button>
                    <button id="save-topic-btn" class="btn btn-primary" data-student-id="${escapeHtml(student.id)}">Save Topic</button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    loadDailyTopicHistory(student.id);
    setTimeout(() => document.getElementById('topic-topics').focus(), 100);

    // Event Delegation for Edit/Delete buttons
    const historyContainer = document.getElementById('topic-history');
    historyContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const btn = target.closest('button');
        if (!btn) return;
        const action = btn.dataset.action;
        const topicId = btn.dataset.id;

        if (action === 'edit') enableTopicEdit(topicId);
        else if (action === 'delete') {
            if (confirm('Are you sure you want to delete this topic?')) await deleteTopic(topicId, student.id);
        }
        else if (action === 'cancel') cancelTopicEdit(topicId);
        else if (action === 'save') await saveTopicEdit(topicId, student.id);
    });

    document.getElementById('cancel-topic-btn').addEventListener('click', () => modal.remove());
    
    document.getElementById('save-topic-btn').addEventListener('click', async () => {
        const topicInput = document.getElementById('topic-topics');
        const content = topicInput.value.trim();
        if (!content) { showCustomAlert('⚠️ Please enter a topic before saving.'); return; }
        
        const tutorName = window.tutorData?.name || "Unknown Tutor";
        const tutorEmail = window.tutorData?.email || "unknown@tutor.com";
        const saveBtn = document.getElementById('save-topic-btn');
        const originalBtnText = saveBtn.innerText;
        
        saveBtn.disabled = true;
        saveBtn.innerText = "Saving...";

        const topicData = {
            studentId: student.id,
            studentName: student.studentName,
            tutorEmail: tutorEmail,
            tutorName: tutorName,
            topics: content,
            date: localDateString, 
            createdAt: new Date()
        };
        
        try {
            await setDoc(doc(collection(db, "daily_topics")), topicData);
            topicInput.value = '';
            await loadDailyTopicHistory(student.id);
            showCustomAlert('✅ Topic saved!');
            saveBtn.disabled = false;
            saveBtn.innerText = originalBtnText;
        } catch (error) {
            console.error("Error saving topic:", error);
            showCustomAlert('❌ Error saving topic.');
            saveBtn.disabled = false;
            saveBtn.innerText = originalBtnText;
        }
    });
}

// ------------------------------------------
// HELPER FUNCTIONS FOR EDITING (UNCHANGED)
// ------------------------------------------
function enableTopicEdit(topicId) {
    document.getElementById(`text-${topicId}`).classList.add('hidden');
    document.getElementById(`btn-edit-${topicId}`).classList.add('hidden');
    document.getElementById(`btn-delete-${topicId}`).classList.add('hidden');
    document.getElementById(`input-container-${topicId}`).classList.remove('hidden');
    document.getElementById(`action-btns-${topicId}`).classList.remove('hidden');
    const input = document.getElementById(`input-${topicId}`);
    input.value = document.getElementById(`text-${topicId}`).textContent;
    input.focus();
}
function cancelTopicEdit(topicId) {
    document.getElementById(`text-${topicId}`).classList.remove('hidden');
    document.getElementById(`btn-edit-${topicId}`).classList.remove('hidden');
    document.getElementById(`btn-delete-${topicId}`).classList.remove('hidden');
    document.getElementById(`input-container-${topicId}`).classList.add('hidden');
    document.getElementById(`action-btns-${topicId}`).classList.add('hidden');
}
async function saveTopicEdit(topicId, studentId) {
    const newText = document.getElementById(`input-${topicId}`).value.trim();
    if (!newText) { showCustomAlert("Topic cannot be empty."); return; }
    try {
        await updateDoc(doc(db, "daily_topics", topicId), { topics: newText });
        await loadDailyTopicHistory(studentId);
        showCustomAlert("✅ Topic updated!");
    } catch (error) { console.error(error); showCustomAlert("❌ Update failed."); }
}
async function deleteTopic(topicId, studentId) {
    try {
        await deleteDoc(doc(db, "daily_topics", topicId));
        await loadDailyTopicHistory(studentId);
        showCustomAlert("🗑️ Topic deleted.");
    } catch (error) { console.error(error); showCustomAlert("❌ Delete failed."); }
}
async function loadDailyTopicHistory(studentId) {
    const container = document.getElementById('topic-history');
    if (!container) return;
    try {
        const now = new Date();
        const q = query(collection(db, "daily_topics"), where("studentId", "==", studentId));
        const snap = await getDocs(q);
        let data = [];
        snap.forEach(d => {
            let val = d.data(); val.id = d.id;
            val.parsedDate = val.createdAt?.toDate ? val.createdAt.toDate() : new Date(val.createdAt || new Date());
            data.push(val);
        });
        data.sort((a, b) => b.parsedDate - a.parsedDate);
        let html = '<ul class="space-y-3">';
        let count = 0;
        data.forEach(d => {
            if (d.parsedDate.getMonth() === now.getMonth() && d.parsedDate.getFullYear() === now.getFullYear()) {
                count++;
                html += `<li class="flex flex-col border-b border-blue-100 last:border-0 pb-2">
                    <div class="flex justify-between w-full">
                        <div class="flex-1 mr-2"><span class="font-bold text-blue-600 text-xs">${escapeHtml(d.parsedDate.toLocaleDateString(undefined,{month:'short',day:'numeric'}))}: </span>
                        <span id="text-${escapeHtml(d.id)}" class="text-sm">${escapeHtml(d.topics)}</span>
                        <div id="input-container-${escapeHtml(d.id)}" class="hidden"><textarea id="input-${escapeHtml(d.id)}" class="w-full text-sm border rounded p-1" rows="2"></textarea></div></div>
                        <div class="flex space-x-1">
                            <button id="btn-edit-${escapeHtml(d.id)}" data-action="edit" data-id="${escapeHtml(d.id)}" class="text-gray-400 hover:text-blue-600">✏️</button>
                            <button id="btn-delete-${escapeHtml(d.id)}" data-action="delete" data-id="${escapeHtml(d.id)}" class="text-gray-400 hover:text-red-600">🗑️</button>
                            <div id="action-btns-${escapeHtml(d.id)}" class="hidden flex space-x-1">
                                <button data-action="save" data-id="${escapeHtml(d.id)}" class="text-green-600">✅</button>
                                <button data-action="cancel" data-id="${escapeHtml(d.id)}" class="text-red-500">❌</button>
                            </div>
                        </div>
                    </div></li>`;
            }
        });
        html += '</ul>';
        container.innerHTML = count > 0 ? html : '<p class="text-center text-gray-500 italic">No topics yet.</p>';
        document.getElementById('topic-history-container').classList.remove('hidden');
        document.getElementById('topic-count-badge').textContent = count;
    } catch (e) { console.error(e); container.innerHTML = '<p class="text-red-500">Error loading history.</p>'; }
}


// ==========================================
// 2. HOMEWORK ASSIGNMENT (SMART SYNC VERSION)
// ==========================================

async function uploadToCloudinary(file, studentId) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
        formData.append('folder', 'homework_assignments');
        formData.append('public_id', `homework_${studentId}_${Date.now()}_${file.name.replace(/\.[^/.]+$/, "")}`);
        
        fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: formData })
        .then(r => r.json())
        .then(d => d.secure_url ? resolve({url: d.secure_url, publicId: d.public_id, format: d.format, bytes: d.bytes, createdAt: d.created_at, fileName: file.name}) : reject(new Error(d.error?.message)))
        .catch(e => reject(e));
    });
}

// *** NEW: Returns object { email, name } instead of just email
async function fetchParentDataByPhone(phone) {
    if (!phone) return null;
    try {
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, ''); 
        let q = query(collection(db, "parent_users"), where("phone", "==", phone));
        let snapshot = await getDocs(q);
        
        if (snapshot.empty && cleanPhone !== phone) {
            q = query(collection(db, "parent_users"), where("phone", "==", cleanPhone));
            snapshot = await getDocs(q);
        }

        if (!snapshot.empty) {
            const data = snapshot.docs[0].data();
            // Return both name and email
            return { 
                email: data.email, 
                name: data.fullName || data.name || data.parentName || "Parent" // Handle various naming conventions
            };
        }
    } catch (error) {
        console.error("Error fetching parent data:", error);
    }
    return null;
}

function showHomeworkModal(student) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const maxDate = nextWeek.toISOString().split('T')[0];
    let selectedFiles = [];

    // Check if we already have data in the Student object
    let currentParentName = student.parentName || "Loading...";
    let currentParentEmail = student.parentEmail || "Searching...";
    const parentPhone = student.parentPhone || "Not Found";

    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-2xl">
                <div class="modal-header"><h3 class="modal-title">📝 Assign Homework for ${escapeHtml(student.studentName)}</h3></div>
                <div class="modal-body">
                    <div class="form-group"><label class="form-label">Title *</label><input type="text" id="hw-title" class="form-input" required></div>
                    <div class="form-group"><label class="form-label">Description *</label><textarea id="hw-description" class="form-input form-textarea" required></textarea></div>
                    <div class="form-group"><label class="form-label">Due Date *</label><input type="date" id="hw-due-date" class="form-input" max="${escapeHtml(maxDate)}" required></div>
                    <div class="form-group"><label class="form-label">Files (Max 5)</label>
                        <div class="file-upload-container"><input type="file" id="hw-file" class="hidden" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt">
                        <label for="hw-file" class="file-upload-label"><span class="text-primary-color">Click to upload files</span></label>
                        <div id="file-list-preview" class="hidden mt-2"><ul id="file-list-ul"></ul><button id="remove-all-files-btn" class="btn btn-danger btn-sm w-full mt-2">Clear Files</button></div></div>
                    </div>
                    
                    <div class="email-settings bg-blue-50 p-3 rounded mt-2 border border-blue-100">
                        <label class="flex items-center space-x-2 mb-2"><input type="checkbox" id="hw-reminder" class="rounded" checked><span class="font-bold text-blue-900">Notify Parent via Email</span></label>
                        <div class="grid grid-cols-2 gap-2 text-xs text-gray-700">
                            <div><span class="font-semibold">Parent:</span> <span id="display-parent-name">${escapeHtml(currentParentName)}</span></div>
                            <div><span class="font-semibold">Phone:</span> ${escapeHtml(parentPhone)}</div>
                            <div class="col-span-2"><span class="font-semibold">Email:</span> <span id="display-parent-email">${escapeHtml(currentParentEmail)}</span></div>
                        </div>
                        <div id="new-data-badge" class="hidden mt-2 text-xs text-green-600 font-bold">✨ New parent details found! Will be saved to student profile.</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-hw-btn" class="btn btn-secondary">Cancel</button>
                    <button id="save-hw-btn" class="btn btn-primary">Assign Homework</button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);

    // *** AUTO-FETCH LOGIC: Runs immediately if data is missing ***
    let fetchedParentData = null;

    if (student.parentPhone && (!student.parentEmail || !student.parentName)) {
        fetchParentDataByPhone(student.parentPhone).then(data => {
            if (data) {
                fetchedParentData = data;
                // Update UI Live
                document.getElementById('display-parent-name').textContent = data.name;
                document.getElementById('display-parent-email').textContent = data.email;
                document.getElementById('display-parent-name').classList.add('text-green-600', 'font-bold');
                document.getElementById('display-parent-email').classList.add('text-green-600', 'font-bold');
                document.getElementById('new-data-badge').classList.remove('hidden');
            } else {
                document.getElementById('display-parent-name').textContent = "Unknown";
                document.getElementById('display-parent-email').textContent = "Not found in database";
            }
        });
    } else {
        // Data already exists, just clear the "Searching..." text if needed
        if(student.parentName) document.getElementById('display-parent-name').textContent = student.parentName;
        if(student.parentEmail) document.getElementById('display-parent-email').textContent = student.parentEmail;
    }

    // File Handling (Standard)
    const fileInput = document.getElementById('hw-file');
    const fileListUl = document.getElementById('file-list-ul');
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (selectedFiles.length + files.length > 5) { showCustomAlert('Max 5 files.'); fileInput.value=''; return; }
        files.forEach(f => { if(f.size<=10*1024*1024) selectedFiles.push(f); else showCustomAlert(`Skipped ${f.name} (>10MB)`); });
        renderFiles();
    });
    function renderFiles() {
        const preview = document.getElementById('file-list-preview');
        if (selectedFiles.length===0) { preview.classList.add('hidden'); return; }
        preview.classList.remove('hidden');
        fileListUl.innerHTML = '';
        selectedFiles.forEach((f, i) => {
            const li = document.createElement('li');
            li.className = "flex justify-between bg-white p-1 mb-1 border rounded text-sm";
            li.innerHTML = `<span>${escapeHtml(f.name)}</span><span class="text-red-500 cursor-pointer remove-file-btn" data-index="${i}">✕</span>`;
            fileListUl.appendChild(li);
        });
        
        fileListUl.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                selectedFiles.splice(idx, 1);
                renderFiles();
            });
        });
    }
    document.getElementById('remove-all-files-btn').addEventListener('click', ()=>{ selectedFiles=[]; fileInput.value=''; renderFiles(); });
    document.getElementById('cancel-hw-btn').addEventListener('click', () => modal.remove());

    // SAVE LOGIC
    document.getElementById('save-hw-btn').addEventListener('click', async () => {
        const title = document.getElementById('hw-title').value.trim();
        const desc = document.getElementById('hw-description').value.trim();
        const date = document.getElementById('hw-due-date').value;
        const sendEmail = document.getElementById('hw-reminder').checked;
        const saveBtn = document.getElementById('save-hw-btn');

        if (!title || !desc || !date) { showCustomAlert('Please fill all fields.'); return; }
        
        const tutorName = window.tutorData?.name || "Unknown Tutor";
        const today = new Date(); today.setHours(0,0,0,0);
        const due = new Date(date); due.setHours(0,0,0,0);
        if(due < today) { showCustomAlert('Due date cannot be past.'); return; }

        try {
            saveBtn.disabled = true;
            
            // --- STEP 1: RESOLVE PARENT DATA ---
            // Priority: 1. Fetched just now (new), 2. Existing on student, 3. Empty
            let finalParentEmail = fetchedParentData?.email || student.parentEmail || "";
            let finalParentName = fetchedParentData?.name || student.parentName || "";

            // If we still don't have it, try one last desperate fetch
            if (sendEmail && !finalParentEmail && student.parentPhone) {
                saveBtn.innerHTML = "🔍 Finalizing Parent Info...";
                const lastCheck = await fetchParentDataByPhone(student.parentPhone);
                if (lastCheck) {
                    finalParentEmail = lastCheck.email;
                    finalParentName = lastCheck.name;
                    fetchedParentData = lastCheck; // Mark as new so we save it below
                }
            }

            // *** CRITICAL UPDATE: SYNC TO STUDENTS COLLECTION ***
            // If we found new data that wasn't there before, update the student record permanently.
            if (fetchedParentData) {
                saveBtn.innerHTML = "💾 Syncing Student Data...";
                try {
                    await updateDoc(doc(db, "students", student.id), {
                        parentEmail: finalParentEmail,
                        parentName: finalParentName
                    });
                    console.log("Student record updated with new parent info.");
                } catch (updateError) {
                    console.error("Failed to sync student data (non-fatal):", updateError);
                }
            }

            // --- STEP 2: UPLOAD FILES ---
            saveBtn.innerHTML = `Uploading ${selectedFiles.length} files...`;
            let attachments = [];
            if (selectedFiles.length > 0) {
                try {
                    const uploadPromises = selectedFiles.map(f => uploadToCloudinary(f, student.id));
                    const results = await Promise.all(uploadPromises);
                    results.forEach(res => attachments.push({url:res.url, name:res.fileName, size:res.bytes, type:res.format}));
                } catch(e) { 
                    console.error("Upload Error:", e);
                    showCustomAlert(`Upload failed: ${e.message}`); 
                    saveBtn.disabled=false; 
                    saveBtn.innerHTML="Assign Homework"; 
                    return; 
                }
            }

            // --- STEP 3: SAVE TO FIREBASE ---
            saveBtn.innerHTML = "Saving...";
            const newHwRef = doc(collection(db, "homework_assignments"));
            
            const hwData = {
                id: newHwRef.id,
                studentId: student.id,
                studentName: student.studentName,
                parentEmail: finalParentEmail,
                parentName: finalParentName, // Now storing Name in HW record too
                parentPhone: student.parentPhone,
                tutorName: tutorName,
                title: title,
                description: desc,
                dueDate: date,
                assignedDate: new Date(),
                status: 'assigned',
                attachments: attachments,
                fileUrl: attachments[0]?.url || '', 
                fileName: attachments[0]?.name || '' 
            };
            
            await setDoc(newHwRef, hwData);

            // --- STEP 4: SEND EMAIL ---
            if (sendEmail && finalParentEmail) {
                saveBtn.innerHTML = "Sending Email...";
                const GAS_URL = "https://script.google.com/macros/s/AKfycbz9yuiR1egvxRcCLbW1Id-6lxBsYotiID0j_Fpeb9D8RyQGdMPNPPZn8WqOpJ4m_JqJNQ/exec";
                
                fetch(GAS_URL, {
                    method: 'POST', mode: 'no-cors',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(hwData)
                }).catch(e=>console.error(e));
                
                await scheduleEmailReminder(hwData, hwData.fileUrl);
            }

            modal.remove();
            showCustomAlert(`✅ Assigned! ${finalParentEmail ? 'Email sent to ' + finalParentName : '(No email found)'}`);

        } catch (error) {
            console.error("Save Error:", error);
            showCustomAlert("Error assigning homework.");
            saveBtn.disabled = false;
            saveBtn.innerHTML = "Assign Homework";
        }
    });
}

async function scheduleEmailReminder(hwData, fileUrl = '') {
    if (!hwData.id) return;
    try {
        const d = new Date(hwData.dueDate); d.setDate(d.getDate()-1);
        await setDoc(doc(collection(db, "email_reminders")), {
            homeworkId: hwData.id,
            studentId: hwData.studentId, 
            parentEmail: hwData.parentEmail,
            parentName: hwData.parentName || "Parent",
            title: hwData.title, 
            dueDate: hwData.dueDate, 
            reminderDate: d,
            status: 'scheduled', 
            createdAt: new Date()
        });
    } catch(e){ console.error("Error scheduling reminder:", e); }
}

/*******************************************************************************
 * SECTION 9: MESSAGING & INBOX FEATURES (CRASH-PROOF EDITION)
 * * CRITICAL FIXES:
 * - Removed 'serverTimestamp' dependency. Now uses native 'new Date()'.
 * - Removed 'increment' dependency. Now uses manual count updates.
 * - This resolves the "invalid data / custom object" error permanently.
 ******************************************************************************/

// --- STATE MANAGEMENT ---
let msgSectionUnreadCount = 0;
let btnFloatingMsg = null;
let btnFloatingInbox = null;

// --- LISTENERS (Memory Management) ---
let unsubInboxListener = null;
let unsubChatListener = null;
let unsubUnreadListener = null;

// --- UTILITY FUNCTIONS ---

function msgEscapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function msgGenerateConvId(tutorId, parentPhone) {
    return [tutorId, parentPhone].sort().join("_");
}

function msgFormatTime(timestamp) {
    if (!timestamp) return '';
    // Handle Firestore Timestamp vs JS Date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return ''; // Invalid date check
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- INITIALIZATION ---

function initializeFloatingMessagingButton() {
    // 1. Clean up old buttons
    const oldBtns = document.querySelectorAll('.floating-messaging-btn, .floating-inbox-btn');
    oldBtns.forEach(btn => btn.remove());
    
    // 2. Create Messaging Button
    btnFloatingMsg = document.createElement('button');
    btnFloatingMsg.className = 'floating-messaging-btn';
    btnFloatingMsg.innerHTML = `<span class="floating-btn-icon">💬</span><span class="floating-btn-text">New</span>`;
    btnFloatingMsg.onclick = showEnhancedMessagingModal;
    
    // 3. Create Inbox Button
    btnFloatingInbox = document.createElement('button');
    btnFloatingInbox.className = 'floating-inbox-btn';
    btnFloatingInbox.innerHTML = `<span class="floating-btn-icon">📨</span><span class="floating-btn-text">Inbox</span>`;
    btnFloatingInbox.onclick = showInboxModal;
    
    // 4. Mount to DOM
    document.body.appendChild(btnFloatingMsg);
    document.body.appendChild(btnFloatingInbox);
    
    // Styles are now in HTML, no injection needed
    
    // 5. Start Listener
    if (window.tutorData && window.tutorData.id) {
        initializeUnreadListener();
    } else {
        setTimeout(() => {
            if (window.tutorData && window.tutorData.id) initializeUnreadListener();
        }, 3000);
    }
}

// --- BACKGROUND LISTENERS ---

function initializeUnreadListener() {
    const tutorId = window.tutorData.id;
    if (unsubUnreadListener) unsubUnreadListener();

    const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", tutorId)
    );

    unsubUnreadListener = onSnapshot(q, (snapshot) => {
        let count = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            // Count unread if I am NOT the last sender
            if (data.unreadCount > 0 && data.lastSenderId !== tutorId) {
                count += data.unreadCount;
            }
        });
        
        msgSectionUnreadCount = count;
        updateFloatingBadges();
    });
}

// Compatibility Alias
window.updateUnreadMessageCount = function() {
    if (window.tutorData && window.tutorData.id) {
        initializeUnreadListener();
    }
};

function updateFloatingBadges() {
    const updateBadge = (btn) => {
        if (!btn) return;
        const existing = btn.querySelector('.unread-badge');
        if (existing) existing.remove();

        if (msgSectionUnreadCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'unread-badge';
            badge.textContent = msgSectionUnreadCount > 99 ? '99+' : msgSectionUnreadCount;
            btn.appendChild(badge);
        }
    };
    updateBadge(btnFloatingMsg);
    updateBadge(btnFloatingInbox);
}

// --- FEATURE 1: SEND MESSAGE MODAL ---

function showEnhancedMessagingModal() {
    document.querySelectorAll('.enhanced-messaging-modal').forEach(e => e.remove());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay enhanced-messaging-modal';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
        <div class="modal-content messaging-modal-content">
            <div class="modal-header">
                <h3>💬 Send Message</h3>
                <button type="button" class="close-modal-btn text-2xl font-bold">&times;</button>
            </div>
            <div class="modal-body">
                <div class="message-type-grid">
                    <div class="type-option selected" data-type="individual">
                        <div class="icon">👤</div><div>Individual</div>
                    </div>
                    <div class="type-option" data-type="group">
                        <div class="icon">👨‍👩‍👧‍👦</div><div>Group</div>
                    </div>
                    <div class="type-option" data-type="management">
                        <div class="icon">🏢</div><div>Admin</div>
                    </div>
                    <div class="type-option" data-type="all">
                        <div class="icon">📢</div><div>All Parents</div>
                    </div>
                </div>

                <div id="recipient-loader" class="recipient-area"></div>

                <input type="text" id="msg-subject" class="form-input" placeholder="Subject">
                <textarea id="msg-content" class="form-input" rows="5" placeholder="Type your message..."></textarea>
                
                <div class="flex-row-spaced mt-2">
                     <label class="urgent-toggle">
                        <input type="checkbox" id="msg-urgent">
                        <span class="text-red-500 font-bold">Mark as Urgent</span>
                     </label>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary close-modal-btn">Cancel</button>
                <button type="button" id="btn-send-initial" class="btn btn-primary">Send Message</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    msgLoadRecipients('individual', modal.querySelector('#recipient-loader'));

    modal.querySelectorAll('.type-option').forEach(opt => {
        opt.onclick = () => {
            modal.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            msgLoadRecipients(opt.dataset.type, modal.querySelector('#recipient-loader'));
        };
    });

    const closeBtns = modal.querySelectorAll('.close-modal-btn');
    closeBtns.forEach(btn => btn.onclick = () => modal.remove());
    
    const sendBtn = modal.querySelector('#btn-send-initial');
    sendBtn.onclick = () => msgProcessSend(modal);
}

async function msgLoadRecipients(type, container) {
    container.innerHTML = '<div class="spinner"></div>';
    const tutorEmail = window.tutorData?.email;

    try {
        const q = query(collection(db, "students"), where("tutorEmail", "==", tutorEmail));
        const snap = await getDocs(q);
        const students = snap.docs.map(d => d.data());

        if (type === 'individual') {
            container.innerHTML = `
                <select id="sel-recipient" class="form-input">
                    <option value="">Select Parent...</option>
                    ${students.map(s => `<option value="${escapeHtml(s.parentPhone)}" data-name="${escapeHtml(s.parentName)}">${escapeHtml(s.parentName)} (${escapeHtml(s.studentName)})</option>`).join('')}
                </select>
            `;
        } else if (type === 'group') {
            container.innerHTML = `
                <div class="checklist-box">
                    ${students.map(s => `
                        <label class="checklist-item">
                            <input type="checkbox" class="chk-recipient" value="${escapeHtml(s.parentPhone)}" data-name="${escapeHtml(s.parentName)}">
                            <span>${escapeHtml(s.parentName)} <small>(${escapeHtml(s.studentName)})</small></span>
                        </label>
                    `).join('')}
                </div>
            `;
        } else if (type === 'all') {
            container.innerHTML = `<div class="info-box">Sending to all ${students.length} parents.</div>`;
        } else {
            container.innerHTML = `<div class="info-box">Sending to Management/Admin.</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div class="error-box">Error loading students: ${escapeHtml(e.message)}</div>`;
    }
}

async function msgProcessSend(modal) {
    const type = modal.querySelector('.type-option.selected').dataset.type;
    const subject = modal.querySelector('#msg-subject').value;
    const content = modal.querySelector('#msg-content').value;
    const isUrgent = modal.querySelector('#msg-urgent').checked;
    const tutor = window.tutorData;

    if (!subject || !content) {
        alert("Please fill in subject and content.");
        return;
    }

    let targets = [];
    if (type === 'individual') {
        const sel = modal.querySelector('#sel-recipient');
        if (sel.value) targets.push({ phone: sel.value, name: sel.options[sel.selectedIndex].dataset.name });
    } else if (type === 'group') {
        modal.querySelectorAll('.chk-recipient:checked').forEach(c => {
            targets.push({ phone: c.value, name: c.dataset.name });
        });
    } else if (type === 'all') {
        const q = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
        const snap = await getDocs(q);
        const map = new Map();
        snap.forEach(d => {
            const s = d.data();
            map.set(s.parentPhone, s.parentName);
        });
        map.forEach((name, phone) => targets.push({ phone, name }));
    }

    if (targets.length === 0 && type !== 'management') {
        alert("No recipients selected.");
        return;
    }

    const btn = modal.querySelector('#btn-send-initial');
    btn.innerText = "Sending...";
    btn.disabled = true;
    
    try {
        // Send loop
        for (const target of targets) {
            const convId = msgGenerateConvId(tutor.id, target.phone);
            const now = new Date(); // USE NATIVE DATE
            
            // Manual Increment Logic: Read -> Calculate -> Write
            const convRef = doc(db, "conversations", convId);
            const convSnap = await getDoc(convRef); // New dependency: getDoc (usually available)
            
            let newCount = 1;
            if (convSnap.exists()) {
                const data = convSnap.data();
                // If the last sender was me, reset count. If not, increment.
                // Logic: I am sending now, so for the RECIPIENT, it increments.
                // But since I am the tutor, and I'm sending to Parent, I want to update THEIR unread count?
                // Actually, this unreadCount field is shared. A better schema splits it, but for now:
                // We just increment it.
                newCount = (data.unreadCount || 0) + 1;
            }

            await setDoc(convRef, {
                participants: [tutor.id, target.phone],
                participantDetails: {
                    [tutor.id]: { name: tutor.name, role: 'tutor' },
                    [target.phone]: { name: target.name, role: 'parent' }
                },
                lastMessage: content,
                lastMessageTimestamp: now,
                lastSenderId: tutor.id,
                unreadCount: newCount
            }, { merge: true });

            await addDoc(collection(db, "conversations", convId, "messages"), {
                content: content,
                subject: subject,
                senderId: tutor.id,
                senderName: tutor.name,
                isUrgent: isUrgent,
                createdAt: now,
                read: false
            });
        }
        
        modal.remove();
        alert("Message Sent!");
    } catch (e) {
        console.error(e);
        // Fallback if getDoc is missing, try blind write
        alert("Error sending: " + e.message);
        btn.innerText = "Try Again";
        btn.disabled = false;
    }
}

// --- FEATURE 2: INBOX MODAL ---

function showInboxModal() {
    document.querySelectorAll('.inbox-modal').forEach(e => e.remove());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay inbox-modal';
    modal.onclick = (e) => { if (e.target === modal) closeInbox(modal); };

    modal.innerHTML = `
        <div class="modal-content inbox-content">
            <button class="close-modal-absolute">&times;</button>
            <div class="inbox-container">
                <div class="inbox-list-col">
                    <div class="inbox-header">
                        <h4>Inbox</h4>
                        <button id="refresh-inbox" class="btn-icon">🔄</button>
                    </div>
                    <div id="inbox-list" class="inbox-list">
                        <div class="spinner"></div>
                    </div>
                </div>
                <div class="inbox-chat-col">
                    <div id="chat-view-header" class="chat-header hidden">
                        <div class="chat-title" id="chat-title">Select a chat</div>
                    </div>
                    <div id="chat-messages" class="chat-messages">
                        <div class="empty-state">Select a conversation</div>
                    </div>
                    <div id="chat-inputs" class="chat-inputs hidden">
                        <input type="text" id="chat-input-text" placeholder="Type a message...">
                        <button id="chat-send-btn">➤</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.close-modal-absolute').onclick = () => closeInbox(modal);
    msgStartInboxListener(modal);
}

function closeInbox(modal) {
    if (unsubInboxListener) unsubInboxListener();
    if (unsubChatListener) unsubChatListener();
    modal.remove();
}

function msgStartInboxListener(modal) {
    const tutorId = window.tutorData.id;
    const listEl = modal.querySelector('#inbox-list');
    
    if (unsubInboxListener) unsubInboxListener();

    const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", tutorId)
    );

    unsubInboxListener = onSnapshot(q, (snapshot) => {
        const convs = [];
        snapshot.forEach(doc => convs.push({ id: doc.id, ...doc.data() }));

        convs.sort((a, b) => {
            const timeA = a.lastMessageTimestamp?.toDate ? a.lastMessageTimestamp.toDate() : new Date(a.lastMessageTimestamp || 0);
            const timeB = b.lastMessageTimestamp?.toDate ? b.lastMessageTimestamp.toDate() : new Date(b.lastMessageTimestamp || 0);
            return timeB - timeA; 
        });

        msgRenderInboxList(convs, listEl, modal, tutorId);
    });
}

function msgRenderInboxList(conversations, container, modal, tutorId) {
    container.innerHTML = '';
    
    if (conversations.length === 0) {
        container.innerHTML = '<div class="p-4 text-gray-500 text-center">No messages found.</div>';
        return;
    }

    conversations.forEach(conv => {
        const otherId = conv.participants.find(p => p !== tutorId);
        const otherName = conv.participantDetails?.[otherId]?.name || "Parent";
        const isUnread = conv.unreadCount > 0 && conv.lastSenderId !== tutorId;

        const el = document.createElement('div');
        el.className = `inbox-item ${isUnread ? 'unread' : ''}`;
        el.innerHTML = `
            <div class="avatar">${escapeHtml(otherName.charAt(0))}</div>
            <div class="info">
                <div class="name">${escapeHtml(otherName)}</div>
                <div class="preview">
                    ${conv.lastSenderId === tutorId ? 'You: ' : ''}${escapeHtml(conv.lastMessage || '')}
                </div>
            </div>
            <div class="meta">
                <div class="time">${escapeHtml(msgFormatTime(conv.lastMessageTimestamp))}</div>
                ${isUnread ? `<div class="badge">${conv.unreadCount}</div>` : ''}
            </div>
        `;
        el.onclick = () => msgLoadChat(conv.id, otherName, modal, tutorId);
        container.appendChild(el);
    });
}

function msgLoadChat(convId, name, modal, tutorId) {
    modal.querySelector('#chat-view-header').classList.remove('hidden');
    modal.querySelector('#chat-inputs').classList.remove('hidden');
    modal.querySelector('#chat-title').innerText = name;
    
    const msgContainer = modal.querySelector('#chat-messages');
    msgContainer.innerHTML = '<div class="spinner"></div>';

    updateDoc(doc(db, "conversations", convId), { unreadCount: 0 });

    if (unsubChatListener) unsubChatListener();

    const q = query(collection(db, "conversations", convId, "messages"));

    unsubChatListener = onSnapshot(q, (snapshot) => {
        let msgs = [];
        snapshot.forEach(doc => msgs.push(doc.data()));
        
        msgs.sort((a,b) => {
            const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return tA - tB;
        });

        msgContainer.innerHTML = '';
        msgs.forEach(msg => {
            const isMe = msg.senderId === tutorId;
            const bubble = document.createElement('div');
            bubble.className = `chat-bubble ${isMe ? 'me' : 'them'}`;
            bubble.innerHTML = `
                ${msg.subject ? `<strong>${escapeHtml(msg.subject)}</strong><br>` : ''}
                ${escapeHtml(msg.content)}
                <div class="timestamp">${escapeHtml(msgFormatTime(msg.createdAt))}</div>
            `;
            msgContainer.appendChild(bubble);
        });
        msgContainer.scrollTop = msgContainer.scrollHeight;
    });

    const btn = modal.querySelector('#chat-send-btn');
    const input = modal.querySelector('#chat-input-text');
    
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.onclick = async () => {
        const txt = input.value.trim();
        if (!txt) return;
        input.value = '';

        const now = new Date();

        // 1. Send Message
        await addDoc(collection(db, "conversations", convId, "messages"), {
            content: txt,
            senderId: tutorId,
            createdAt: now,
            read: false
        });

        // 2. Manual Increment for Metadata
        const convRef = doc(db, "conversations", convId);
        // We do a quick read to get current count to be safe
        getDoc(convRef).then(snap => {
            const current = snap.exists() ? (snap.data().unreadCount || 0) : 0;
            updateDoc(convRef, {
                lastMessage: txt,
                lastMessageTimestamp: now,
                lastSenderId: tutorId,
                unreadCount: current + 1
            });
        });
    };
    
    input.onkeypress = (e) => { if (e.key === 'Enter') newBtn.click(); };
}

// Styles removed – now in HTML.

// --- AUTO-INIT ---
initializeFloatingMessagingButton();

/*******************************************************************************
 * SECTION 10: SCHEDULE CALENDAR VIEW
 ******************************************************************************/

// View Schedule Calendar for All Students
function showScheduleCalendarModal() {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-6xl">
                <div class="modal-header">
                    <h3 class="modal-title">📅 Weekly Schedule Calendar</h3>
                    <div class="action-buttons">
                        <button id="print-calendar-btn" class="btn btn-secondary btn-sm">📄 Print/PDF</button>
                        <button id="edit-schedule-btn" class="btn btn-primary btn-sm">✏️ Edit Schedules</button>
                    </div>
                </div>
                <div class="modal-body">
                    <div id="calendar-loading" class="text-center">
                        <div class="spinner mx-auto mb-2"></div>
                        <p class="text-gray-500">Loading schedule calendar...</p>
                    </div>
                    <div id="calendar-view" class="hidden">
                        <!-- Calendar will be loaded here -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="close-calendar-btn" class="btn btn-secondary">Close</button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    loadScheduleCalendar();
    
    document.getElementById('print-calendar-btn').addEventListener('click', () => {
        printCalendar();
    });
    
    document.getElementById('edit-schedule-btn').addEventListener('click', () => {
        modal.remove();
        if (window.tutorData) {
            checkAndShowSchedulePopup(window.tutorData);
        }
    });
    
    document.getElementById('close-calendar-btn').addEventListener('click', () => {
        modal.remove();
    });
}

async function loadScheduleCalendar() {
    try {
        const studentsQuery = query(
            collection(db, "students"), 
            where("tutorEmail", "==", window.tutorData.email)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        const studentsWithSchedule = [];
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            // Filter out archived students
            if (!['archived', 'graduated', 'transferred'].includes(student.status) &&
                student.schedule && student.schedule.length > 0) {
                studentsWithSchedule.push(student);
            }
        });
        
        if (studentsWithSchedule.length === 0) {
            document.getElementById('calendar-view').innerHTML = `
                <div class="text-center p-8">
                    <div class="text-gray-400 text-4xl mb-3">📅</div>
                    <h4 class="font-bold text-gray-600 mb-2">No Schedules Found</h4>
                    <p class="text-gray-500 mb-4">No students have schedules set up yet.</p>
                    <button id="setup-schedules-btn" class="btn btn-primary">Set Up Schedules</button>
                </div>
            `;
            
            document.getElementById('setup-schedules-btn').addEventListener('click', () => {
                document.querySelector('.modal-overlay').remove();
                if (window.tutorData) {
                    checkAndShowSchedulePopup(window.tutorData);
                }
            });
        } else {
            renderCalendarView(studentsWithSchedule);
        }
        
        document.getElementById('calendar-loading').classList.add('hidden');
        document.getElementById('calendar-view').classList.remove('hidden');
        
    } catch (error) {
        console.error("Error loading calendar:", error);
        document.getElementById('calendar-view').innerHTML = `
            <div class="text-center text-red-600 p-8">
                <div class="text-4xl mb-3">⚠️</div>
                <h4 class="font-bold mb-2">Failed to Load Schedule</h4>
                <p class="text-gray-500">Please try again later.</p>
            </div>
        `;
        document.getElementById('calendar-loading').classList.add('hidden');
        document.getElementById('calendar-view').classList.remove('hidden');
    }
}

function renderCalendarView(students) {
    const scheduleByDay = {};
    DAYS_OF_WEEK.forEach(day => {
        scheduleByDay[day] = [];
    });
    
    students.forEach(student => {
        student.schedule.forEach(slot => {
            scheduleByDay[slot.day].push({
                student: student.studentName,
                grade: student.grade,
                start: slot.start,
                end: slot.end,
                time: `${formatScheduleTime(slot.start)} - ${formatScheduleTime(slot.end)}`,
                studentId: student.id,
                isOvernight: slot.isOvernight || false
            });
        });
    });
    
    DAYS_OF_WEEK.forEach(day => {
        scheduleByDay[day].sort((a, b) => {
            return a.start.localeCompare(b.start);
        });
    });
    
    let calendarHTML = `
        <div class="calendar-view">
    `;
    
    DAYS_OF_WEEK.forEach(day => {
        const dayEvents = scheduleByDay[day];
        calendarHTML += `
            <div class="calendar-day">
                <div class="calendar-day-header">${escapeHtml(day)}</div>
                <div class="calendar-day-events">
                    ${dayEvents.length === 0 ? 
                        '<div class="text-sm text-gray-400 text-center mt-4">No classes</div>' : 
                        dayEvents.map(event => `
                            <div class="calendar-event">
                                <div class="font-medium text-xs">${escapeHtml(event.student)}</div>
                                <div class="calendar-event-time">${escapeHtml(event.time)} ${event.isOvernight ? '🌙' : ''}</div>
                                <div class="text-xs text-gray-500">${escapeHtml(event.grade)}</div>
                                <button class="edit-schedule-btn mt-1" data-student-id="${escapeHtml(event.studentId)}">Edit</button>
                            </div>
                        `).join('')
                    }
                </div>
            </div>
        `;
    });
    
    calendarHTML += `</div>`;
    
    calendarHTML += `
        <div class="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 class="font-bold text-lg mb-3">Schedule Summary</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <p class="text-sm"><span class="font-semibold">Total Students with Schedule:</span> ${students.length}</p>
                    <p class="text-sm"><span class="font-semibold">Total Weekly Classes:</span> ${Object.values(scheduleByDay).reduce((total, day) => total + day.length, 0)}</p>
                </div>
                <div>
                    <p class="text-sm"><span class="font-semibold">Most Scheduled Day:</span> ${escapeHtml(getMostScheduledDay(scheduleByDay))}</p>
                    <p class="text-sm"><span class="font-semibold">Earliest Class:</span> ${escapeHtml(getEarliestClass(scheduleByDay))}</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('calendar-view').innerHTML = calendarHTML;
    
    document.querySelectorAll('.edit-schedule-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const studentId = e.target.getAttribute('data-student-id');
            const student = students.find(s => s.id === studentId);
            if (student) {
                document.querySelector('.modal-overlay').remove();
                showEditScheduleModal(student);
            }
        });
    });
}

// Edit Schedule Modal
function showEditScheduleModal(student) {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h3 class="modal-title">✏️ Edit Schedule for ${escapeHtml(student.studentName)}</h3>
                </div>
                <div class="modal-body">
                    <div class="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p class="text-sm text-blue-700">Student: <strong>${escapeHtml(student.studentName)}</strong> | Grade: ${escapeHtml(student.grade)}</p>
                        <p class="text-xs text-blue-500">Note: You can schedule overnight classes (e.g., 11 PM to 1 AM)</p>
                    </div>
                    
                    <div id="schedule-entries" class="space-y-4">
                        ${student.schedule && student.schedule.length > 0 ? 
                            student.schedule.map(slot => `
                                <div class="schedule-entry bg-gray-50 p-4 rounded-lg border">
                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label class="form-label">Day of Week</label>
                                            <select class="form-input schedule-day">
                                                ${DAYS_OF_WEEK.map(day => `<option value="${escapeHtml(day)}" ${day === slot.day ? 'selected' : ''}>${escapeHtml(day)}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div>
                                            <label class="form-label">Start Time</label>
                                            <select class="form-input schedule-start">
                                                ${TIME_SLOTS.map(timeSlot => `<option value="${escapeHtml(timeSlot.value)}" ${timeSlot.value === slot.start ? 'selected' : ''}>${escapeHtml(timeSlot.label)}</option>`).join('')}
                                            </select>
                                        </div>
                                        <div>
                                            <label class="form-label">End Time</label>
                                            <select class="form-input schedule-end">
                                                ${TIME_SLOTS.map(timeSlot => `<option value="${escapeHtml(timeSlot.value)}" ${timeSlot.value === slot.end ? 'selected' : ''}>${escapeHtml(timeSlot.label)}</option>`).join('')}
                                            </select>
                                        </div>
                                    </div>
                                    <button class="btn btn-danger btn-sm mt-2 remove-schedule-btn">Remove</button>
                                </div>
                            `).join('') : 
                            `<div class="schedule-entry bg-gray-50 p-4 rounded-lg border">
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label class="form-label">Day of Week</label>
                                        <select class="form-input schedule-day">
                                            ${DAYS_OF_WEEK.map(day => `<option value="${escapeHtml(day)}">${escapeHtml(day)}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="form-label">Start Time</label>
                                        <select class="form-input schedule-start">
                                            ${TIME_SLOTS.map(timeSlot => `<option value="${escapeHtml(timeSlot.value)}">${escapeHtml(timeSlot.label)}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="form-label">End Time</label>
                                        <select class="form-input schedule-end">
                                            ${TIME_SLOTS.map(timeSlot => `<option value="${escapeHtml(timeSlot.value)}">${escapeHtml(timeSlot.label)}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                                <button class="btn btn-danger btn-sm mt-2 remove-schedule-btn hidden">Remove</button>
                            </div>`}
                    </div>
                    
                    <button id="add-schedule-entry" class="btn btn-secondary btn-sm mt-2">
                        ＋ Add Another Time Slot
                    </button>
                </div>
                <div class="modal-footer">
                    <button id="cancel-edit-schedule-btn" class="btn btn-secondary">Cancel</button>
                    <button id="save-edit-schedule-btn" class="btn btn-primary" data-student-id="${escapeHtml(student.id)}">
                        Save Schedule
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    document.getElementById('add-schedule-entry').addEventListener('click', () => {
        const scheduleEntries = document.getElementById('schedule-entries');
        const firstEntry = scheduleEntries.querySelector('.schedule-entry');
        const newEntry = firstEntry.cloneNode(true);
        // Reset values for new entry
        newEntry.querySelector('.schedule-day').selectedIndex = 0;
        newEntry.querySelector('.schedule-start').selectedIndex = 0;
        newEntry.querySelector('.schedule-end').selectedIndex = 0;
        newEntry.querySelector('.remove-schedule-btn').classList.remove('hidden');
        scheduleEntries.appendChild(newEntry);
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-schedule-btn')) {
            const scheduleEntries = document.querySelectorAll('.schedule-entry');
            if (scheduleEntries.length > 1) {
                e.target.closest('.schedule-entry').remove();
            } else {
                showCustomAlert('You must have at least one schedule entry.');
            }
        }
    });
    
    document.getElementById('cancel-edit-schedule-btn').addEventListener('click', () => {
        modal.remove();
        showScheduleCalendarModal();
    });
    
    document.getElementById('save-edit-schedule-btn').addEventListener('click', async () => {
        const scheduleEntries = document.querySelectorAll('.schedule-entry');
        const schedule = [];
        let hasError = false;
        
        for (const entry of scheduleEntries) {
            const day = entry.querySelector('.schedule-day').value;
            const start = entry.querySelector('.schedule-start').value;
            const end = entry.querySelector('.schedule-end').value;
            
            const validation = validateScheduleTime(start, end);
            if (!validation.valid) {
                showCustomAlert(validation.message);
                hasError = true;
                break;
            }
            
            schedule.push({ 
                day, 
                start, 
                end,
                isOvernight: validation.isOvernight || false,
                duration: validation.duration
            });
        }
        
        if (hasError) return;
        
        if (schedule.length === 0) {
            showCustomAlert('Please add at least one schedule entry.');
            return;
        }
        
        try {
            const studentRef = doc(db, "students", student.id);
            await updateDoc(studentRef, { schedule });
            
            modal.remove();
            showCustomAlert('✅ Schedule updated successfully!');
            
            setTimeout(() => {
                showScheduleCalendarModal();
            }, 500);
            
        } catch (error) {
            console.error("Error updating schedule:", error);
            showCustomAlert('❌ Error updating schedule. Please try again.');
        }
    });
}

function printCalendar() {
    const calendarContent = document.getElementById('calendar-view').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Weekly Schedule Calendar</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .calendar-view { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
                    .calendar-day { border: 1px solid #ddd; padding: 10px; min-height: 120px; }
                    .calendar-day-header { font-weight: bold; border-bottom: 1px solid #ddd; margin-bottom: 5px; }
                    .calendar-event { background: #f5f5f5; padding: 5px; margin-bottom: 3px; font-size: 11px; }
                    .edit-schedule-btn { display: none; }
                    @media print { body { font-size: 12px; } }
                </style>
            </head>
            <body>
                <h2>Weekly Schedule Calendar</h2>
                <p>Tutor: ${escapeHtml(window.tutorData.name)}</p>
                <p>Generated on: ${escapeHtml(new Date().toLocaleDateString())}</p>
                <hr>
                ${calendarContent}
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(() => window.close(), 1000);
                    }
                <\/script>
            </body>
        </html>
    `);
}

/*******************************************************************************
 * SECTION 11: TUTOR DASHBOARD
 ******************************************************************************/

// Cache for students
let studentCache = [];

// Enhanced Tutor Dashboard - WITH MESSAGING & INBOX FEATURES
/*******************************************************************************
 * SCHEDULE MANAGEMENT TAB
 ******************************************************************************/
function renderScheduleManagement(container, tutor) {
    updateActiveTab('navScheduleManagement');

    const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

    container.innerHTML = `
        <div class="hero-section">
            <h1 class="hero-title">📅 Schedule Management</h1>
            <p class="hero-subtitle">A complete view of all your students' weekly classes</p>
        </div>

        <!-- Action buttons row -->
        <div class="flex flex-wrap gap-3 mb-5">
            <button id="view-full-calendar-btn" class="btn btn-info">📆 Full Calendar</button>
            <button id="setup-all-schedules-btn" class="btn btn-primary">⚙️ Set Up / Edit Schedules</button>
            <button id="refresh-schedule-btn" class="btn btn-secondary">🔄 Refresh</button>
        </div>

        <!-- Week Grid -->
        <div class="card mb-4 overflow-x-auto">
            <div class="card-header flex items-center gap-2">
                <span class="text-xl">📊</span>
                <h3 class="font-bold text-lg">Weekly Overview</h3>
                <span class="text-xs text-gray-400 ml-2">All students' recurring classes</span>
            </div>
            <div class="card-body p-0">
                <div id="week-grid-container" class="p-4">
                    <div class="flex justify-center py-6"><div class="spinner"></div></div>
                </div>
            </div>
        </div>

        <!-- Student Cards -->
        <div class="card">
            <div class="card-header flex items-center gap-2">
                <span class="text-xl">👥</span>
                <h3 class="font-bold text-lg">Students & Their Schedules</h3>
            </div>
            <div class="card-body" id="student-schedule-cards">
                <div class="flex justify-center py-6"><div class="spinner"></div></div>
            </div>
        </div>
    `;

    // Buttons
    document.getElementById('view-full-calendar-btn')?.addEventListener('click', showScheduleCalendarModal);
    document.getElementById('setup-all-schedules-btn')?.addEventListener('click', async () => {
        try {
            if (window.scheduleManager) {
                await window.scheduleManager.openManualManager();
            } else {
                const firebaseDeps = { db, methods: { getDocs, query, collection, where, doc, updateDoc, setDoc, deleteDoc, getDoc } };
                window.scheduleManager = new ScheduleManager(tutor, firebaseDeps);
                await window.scheduleManager.openManualManager();
            }
        } catch (err) {
            console.error(err);
            showCustomAlert('Error opening schedule manager. Please try again.');
        }
    });
    document.getElementById('refresh-schedule-btn')?.addEventListener('click', () => loadScheduleData());

    // Day colors
    const dayColors = ['bg-blue-50 border-blue-200','bg-purple-50 border-purple-200','bg-amber-50 border-amber-200',
        'bg-green-50 border-green-200','bg-rose-50 border-rose-200','bg-indigo-50 border-indigo-200','bg-teal-50 border-teal-200'];
    const dayTextColors = ['text-blue-700','text-purple-700','text-amber-700','text-green-700','text-rose-700','text-indigo-700','text-teal-700'];

    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Africa/Lagos' });

    async function loadScheduleData() {
        const gridContainer    = document.getElementById('week-grid-container');
        const cardsContainer   = document.getElementById('student-schedule-cards');
        if (gridContainer) gridContainer.innerHTML = '<div class="flex justify-center py-6"><div class="spinner"></div></div>';
        if (cardsContainer) cardsContainer.innerHTML = '<div class="flex justify-center py-6"><div class="spinner"></div></div>';

        try {
            const snap = await getDocs(query(collection(db, 'students'), where('tutorEmail', '==', tutor.email)));
            const students = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                .filter(s => !['archived','graduated','transferred'].includes(s.status));

            // Build day → classes map
            const dayMap = {}; // day → [{student, slot}]
            students.forEach(s => {
                if (!Array.isArray(s.schedule)) return;
                s.schedule.forEach(slot => {
                    const d = slot.day;
                    if (!d) return;
                    if (!dayMap[d]) dayMap[d] = [];
                    dayMap[d].push({ student: s, slot });
                });
            });

            // Sort each day's classes by start time
            DAYS.forEach(d => {
                if (dayMap[d]) dayMap[d].sort((a,b) => (a.slot.start||'').localeCompare(b.slot.start||''));
            });

            // ── Render Week Grid ──
            if (gridContainer) {
                if (students.length === 0) {
                    gridContainer.innerHTML = '<p class="text-center text-gray-400 py-6">No students found. Add students and set up their schedules.</p>';
                } else {
                    const totalClasses = Object.values(dayMap).reduce((s,v) => s + v.length, 0);
                    let gridHtml = `<p class="text-xs text-gray-400 mb-3">${totalClasses} class slot${totalClasses !== 1 ? 's' : ''} per week across ${students.length} student${students.length !== 1 ? 's' : ''}</p>`;
                    gridHtml += '<div class="grid grid-cols-7 gap-2 min-w-max w-full">';

                    // Header row
                    DAYS.forEach((day, i) => {
                        const isToday = day === todayName;
                        gridHtml += `<div class="text-center">
                            <div class="text-xs font-bold ${isToday ? 'text-white bg-blue-600 rounded-lg px-2 py-1' : dayTextColors[i] + ' px-2 py-1'} uppercase tracking-wide">
                                ${day.slice(0,3)}${isToday ? ' ◀' : ''}
                            </div>
                        </div>`;
                    });

                    // Class cells
                    DAYS.forEach((day, i) => {
                        const classes = dayMap[day] || [];
                        const isToday = day === todayName;
                        if (classes.length === 0) {
                            gridHtml += `<div class="min-h-16 rounded-xl border ${isToday ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'} flex items-center justify-center">
                                <span class="text-xs text-gray-300">—</span>
                            </div>`;
                        } else {
                            gridHtml += `<div class="space-y-1.5 min-h-16">`;
                            classes.forEach(({ student, slot }) => {
                                gridHtml += `<div class="rounded-xl border ${isToday ? 'bg-blue-100 border-blue-300' : dayColors[i]} p-2 cursor-pointer hover:shadow-sm transition-all text-center"
                                    title="${escapeHtml(student.studentName)} · ${escapeHtml(formatScheduleTime(slot.start))}–${escapeHtml(formatScheduleTime(slot.end))}">
                                    <p class="text-xs font-bold ${dayTextColors[i]} truncate">${escapeHtml((student.studentName||'?').split(' ')[0])}</p>
                                    <p class="text-xs ${dayTextColors[i]} opacity-80">${escapeHtml(formatScheduleTime(slot.start))}</p>
                                    ${slot.subject ? `<p class="text-xs text-gray-500 truncate">${escapeHtml(slot.subject)}</p>` : ''}
                                </div>`;
                            });
                            gridHtml += '</div>';
                        }
                    });

                    gridHtml += '</div>';
                    gridContainer.innerHTML = gridHtml;
                }
            }

            // ── Render Student Cards ──
            if (cardsContainer) {
                if (students.length === 0) {
                    cardsContainer.innerHTML = '<p class="text-center text-gray-400 py-6">No students found.</p>';
                    return;
                }

                const sortedStudents = [...students].sort((a,b) => (a.studentName||'').localeCompare(b.studentName||''));
                const cardsHtml = sortedStudents.map(s => {
                    const slots = Array.isArray(s.schedule) ? s.schedule : [];
                    const initials = (s.studentName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
                    const hasToday = slots.some(sl => sl.day === todayName);
                    const statusBadge = s.summerBreak
                        ? '<span class="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-semibold">☀️ Break</span>'
                        : s.isTransitioning
                        ? '<span class="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-semibold">🔄 Transitioning</span>'
                        : '';
                    const todayBadge = hasToday ? '<span class="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-semibold">📅 Today</span>' : '';

                    const slotsHtml = slots.length === 0
                        ? '<span class="text-xs text-gray-400">No schedule set up yet</span>'
                        : slots.sort((a,b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day)).map(sl => {
                            const di = DAYS.indexOf(sl.day);
                            const cc = di >= 0 ? dayColors[di] : 'bg-gray-100 border-gray-200';
                            const tc = di >= 0 ? dayTextColors[di] : 'text-gray-600';
                            const isToday = sl.day === todayName;
                            return `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-semibold ${isToday ? 'bg-blue-600 text-white border-blue-700' : cc + ' ' + tc}">
                                ${escapeHtml(sl.day?.slice(0,3)||'?')} ${escapeHtml(formatScheduleTime(sl.start))}${sl.subject ? ' · '+escapeHtml(sl.subject) : ''}
                            </span>`;
                        }).join('');

                    return `<div class="flex items-start gap-4 p-4 rounded-2xl border ${hasToday ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-white'} hover:shadow-sm transition-all">
                        <div class="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                             style="background:linear-gradient(135deg,#6366f1,#4f46e5)">${escapeHtml(initials)}</div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap mb-2">
                                <p class="font-bold text-gray-800">${escapeHtml(s.studentName||'Unknown')}</p>
                                <span class="text-xs text-gray-400">${escapeHtml(s.grade||'')}</span>
                                ${statusBadge}${todayBadge}
                            </div>
                            <div class="flex flex-wrap gap-1.5">${slotsHtml}</div>
                        </div>
                        <button onclick="(async () => {
                            if (!window.scheduleManager) {
                                const fd = { db, methods: { getDocs, query, collection, where, doc, updateDoc, setDoc, deleteDoc, getDoc } };
                                window.scheduleManager = new ScheduleManager(${JSON.stringify({ email: tutor.email, name: tutor.name })}, fd);
                            }
                            await window.scheduleManager.openManualManager();
                        })()" class="flex-shrink-0 btn btn-secondary btn-sm">✏️ Edit</button>
                    </div>`;
                }).join('');

                cardsContainer.innerHTML = `<div class="space-y-3">${cardsHtml}</div>`;
            }

        } catch (err) {
            console.error('Schedule load error:', err);
            const msg = `<p class="text-red-500 text-center py-4">Error loading schedule.</p>`;
            if (gridContainer) gridContainer.innerHTML = msg;
            if (cardsContainer) cardsContainer.innerHTML = msg;
        }
    }

    loadScheduleData();
}

/*******************************************************************************
 * ACADEMIC TAB — Enhanced with monthly archive
 ******************************************************************************/
function renderAcademic(container, tutor) {
    updateActiveTab('navAcademic');

    container.innerHTML = `
        <div class="hero-section">
            <h1 class="hero-title">🎓 Academic</h1>
            <p class="hero-subtitle">Record topics, assign homework, review submissions & view your archive</p>
        </div>

        <!-- Action Cards -->
        <div class="student-actions-container">
            <div class="student-action-card">
                <div class="flex items-center gap-3 mb-3">
                    <div class="stat-icon" style="width:44px;height:44px;font-size:1.2rem;border-radius:1rem;background:linear-gradient(135deg,#3b82f6,#1d4ed8);">📚</div>
                    <h3 class="font-bold text-lg">Today's Topic</h3>
                </div>
                <p class="text-sm text-gray-600 mb-4">Record topics covered in today's classes.</p>
                <select id="select-student-topic" class="form-input mb-3"><option value="">Select a student...</option></select>
                <button id="add-topic-btn" class="btn btn-secondary w-full" disabled>Add Today's Topic</button>
            </div>

            <div class="student-action-card">
                <div class="flex items-center gap-3 mb-3">
                    <div class="stat-icon" style="width:44px;height:44px;font-size:1.2rem;border-radius:1rem;background:linear-gradient(135deg,#f59e0b,#d97706);">📝</div>
                    <h3 class="font-bold text-lg">Assign Homework</h3>
                </div>
                <p class="text-sm text-gray-600 mb-4">Assign homework to your students.</p>
                <select id="select-student-hw" class="form-input mb-3"><option value="">Select a student...</option></select>
                <button id="assign-hw-btn" class="btn btn-warning w-full" disabled>Assign Homework</button>
            </div>
        </div>

        <!-- Homework Inbox -->
        <div class="card mt-4">
            <div class="card-header flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="text-xl">📨</span>
                    <h3 class="font-bold text-lg">Homework Inbox</h3>
                    <span class="badge badge-info text-xs" id="inbox-count">…</span>
                </div>
                <button id="refresh-inbox-btn" class="btn btn-secondary btn-sm">🔄 Refresh</button>
            </div>
            <div class="card-body" id="homework-inbox-container">
                <div class="text-center py-6">
                    <div class="spinner mx-auto mb-3"></div>
                    <p class="text-gray-500">Loading submissions...</p>
                </div>
            </div>
        </div>

        <!-- Monthly Archive Accordion -->
        <div class="card mt-4">
            <div class="card-header flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="text-xl">🗄️</span>
                    <h3 class="font-bold text-lg">Academic Archive</h3>
                </div>
                <button id="load-archive-btn" class="btn btn-secondary btn-sm">📂 Load Archive</button>
            </div>
            <div class="card-body" id="academic-archive-container">
                <p class="text-center text-gray-400 text-sm py-4">Click "Load Archive" to view your past topics & homework by month.</p>
            </div>
        </div>
    `;

    loadStudentDropdowns(tutor.email);

    const addTopicBtn = document.getElementById('add-topic-btn');
    if (addTopicBtn) addTopicBtn.addEventListener('click', () => {
        const sid = document.getElementById('select-student-topic').value;
        const s = getStudentFromCache(sid);
        if (s) showDailyTopicModal(s);
    });

    const assignHwBtn = document.getElementById('assign-hw-btn');
    if (assignHwBtn) assignHwBtn.addEventListener('click', () => {
        const sid = document.getElementById('select-student-hw').value;
        const s = getStudentFromCache(sid);
        if (s) showHomeworkModal(s);
    });

    document.getElementById('select-student-topic')?.addEventListener('change', e => {
        document.getElementById('add-topic-btn').disabled = !e.target.value;
    });
    document.getElementById('select-student-hw')?.addEventListener('change', e => {
        document.getElementById('assign-hw-btn').disabled = !e.target.value;
    });

    document.getElementById('refresh-inbox-btn')?.addEventListener('click', () => loadHomeworkInbox(tutor.email));
    loadHomeworkInbox(tutor.email);

    // Archive loader
    document.getElementById('load-archive-btn')?.addEventListener('click', () => loadAcademicArchive(tutor));
}

// Load and render the academic archive grouped by month
async function loadAcademicArchive(tutor) {
    const container = document.getElementById('academic-archive-container');
    if (!container) return;
    container.innerHTML = `<div class="text-center py-6"><div class="spinner mx-auto mb-3"></div><p class="text-gray-500">Loading archive…</p></div>`;

    try {
        const [topicsSnap, hwSnap] = await Promise.all([
            getDocs(query(collection(db, 'daily_topics'), where('tutorEmail', '==', tutor.email))),
            getDocs(query(collection(db, 'homework_assignments'), where('tutorEmail', '==', tutor.email)))
        ]);

        // Organise by month
        const months = {}; // 'YYYY-MM' → { topics:[], hw:[] }

        topicsSnap.docs.forEach(d => {
            const data = d.data();
            const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || '');
            if (isNaN(date.getTime())) return;
            const mk = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
            if (!months[mk]) months[mk] = { topics:[], hw:[] };
            months[mk].topics.push({ date, text: data.topics || '', studentId: data.studentId });
        });

        hwSnap.docs.forEach(d => {
            const data = d.data();
            const raw = data.assignedAt || data.createdAt || data.uploadedAt;
            const date = raw?.toDate ? raw.toDate() : new Date(raw || '');
            if (isNaN(date.getTime())) return;
            const mk = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
            if (!months[mk]) months[mk] = { topics:[], hw:[] };
            months[mk].hw.push({ date, title: data.title || 'Homework', studentName: data.studentName || '', score: data.score, feedback: data.feedback, status: data.status });
        });

        const sortedMonths = Object.keys(months).sort((a,b) => b.localeCompare(a));

        if (sortedMonths.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-400 py-6">No academic records found yet.</p>';
            return;
        }

        container.innerHTML = `<div class="space-y-2" id="archive-accordion"></div>`;
        const accordion = document.getElementById('archive-accordion');

        sortedMonths.forEach(mk => {
            const { topics, hw } = months[mk];
            const [y, m] = mk.split('-');
            const label = new Date(parseInt(y), parseInt(m)-1, 1).toLocaleString('en-NG', { month:'long', year:'numeric' });

            const item = document.createElement('details');
            item.className = 'bg-white border border-gray-200 rounded-xl overflow-hidden';
            item.innerHTML = `
            <summary class="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 list-none">
                <div class="flex-1">
                    <span class="font-semibold text-gray-800">${escapeHtml(label)}</span>
                </div>
                <div class="flex gap-3 flex-shrink-0">
                    <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">${topics.length} topics</span>
                    <span class="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">${hw.length} H/W</span>
                </div>
                <i class="fas fa-chevron-right text-gray-400 text-xs"></i>
            </summary>
            <div class="border-t border-gray-100 divide-y divide-gray-50">
                <!-- Topics -->
                ${topics.length > 0 ? `
                <div class="p-3">
                    <h4 class="text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">📚 Topics Entered</h4>
                    <div class="space-y-1.5">
                        ${topics.sort((a,b) => b.date-a.date).map(t => `
                        <div class="flex items-start gap-2 bg-blue-50 rounded-lg px-3 py-2">
                            <span class="text-xs text-gray-400 flex-shrink-0 mt-0.5">${t.date.toLocaleDateString('en-NG', {day:'2-digit',month:'short'})}</span>
                            <span class="text-sm text-gray-700">${escapeHtml(t.text)}</span>
                        </div>`).join('')}
                    </div>
                </div>` : ''}
                <!-- Homework -->
                ${hw.length > 0 ? `
                <div class="p-3">
                    <h4 class="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2">📝 Homework Assigned</h4>
                    <div class="space-y-1.5">
                        ${hw.sort((a,b) => b.date-a.date).map(h => `
                        <div class="flex items-start justify-between bg-amber-50 rounded-lg px-3 py-2 gap-2">
                            <div class="flex items-start gap-2 min-w-0">
                                <span class="text-xs text-gray-400 flex-shrink-0 mt-0.5">${h.date.toLocaleDateString('en-NG', {day:'2-digit',month:'short'})}</span>
                                <div class="min-w-0">
                                    <span class="text-sm text-gray-700 font-medium">${escapeHtml(h.title)}</span>
                                    ${h.studentName ? `<div class="text-xs text-gray-400">${escapeHtml(h.studentName)}</div>` : ''}
                                    ${h.feedback ? `<div class="text-xs text-gray-500 italic mt-0.5">"${escapeHtml(h.feedback)}"</div>` : ''}
                                </div>
                            </div>
                            ${h.score ? `<span class="bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0">${escapeHtml(String(h.score))}/100</span>` : ''}
                        </div>`).join('')}
                    </div>
                </div>` : ''}
            </div>`;
            accordion.appendChild(item);
        });

    } catch (err) {
        console.error('Archive error:', err);
        container.innerHTML = `<p class="text-red-500 text-center py-4">Error loading archive: ${escapeHtml(err.message)}</p>`;
    }
}

/*******************************************************************************
 * DASHBOARD TAB
 ******************************************************************************/
function renderTutorDashboard(container, tutor) {
    // Update active tab
    updateActiveTab('navDashboard');
    
    container.innerHTML = `
        <!-- Top bar: greeting + Lagos clock + Performance scorecard -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div class="flex-1">
                <h1 class="text-xl font-black text-gray-800">Welcome, ${escapeHtml(tutor.name || 'Tutor')}! 👋</h1>
                <p class="text-sm text-gray-400">Review submissions, track your performance and manage students</p>
            </div>
            <div class="flex flex-col items-end gap-1">
                <div id="tutor-lagos-clock" class="text-sm font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 whitespace-nowrap">Loading time…</div>
                <div class="text-xs text-gray-400">📍 Lagos, Nigeria (WAT)</div>
            </div>
        </div>

        <!-- Performance Scorecard always visible on dashboard -->
        <div id="performance-widget" class="mb-4"></div>
        
        <div class="card">
            <div class="card-header">
                <h3 class="font-bold text-lg">🔍 Search & Filter</h3>
            </div>
            <div class="card-body">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label class="form-label">Search by Parent Name</label>
                        <input type="text" id="searchName" class="form-input" placeholder="Enter parent name...">
                    </div>
                    <div>
                        <label class="form-label">Filter by Status</label>
                        <select id="filterStatus" class="form-input">
                            <option value="">All Submissions</option>
                            <option value="pending">Pending Review</option>
                            <option value="graded">Graded</option>
                        </select>
                    </div>
                    <div class="flex items-end">
                        <button id="searchBtn" class="btn btn-primary w-full">
                            🔍 Search
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-6">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">📋 Pending Submissions</h3>
                <span class="badge badge-warning" id="pending-count">Loading...</span>
            </div>
            <div id="pendingReportsContainer" class="space-y-4">
                <div class="card">
                    <div class="card-body text-center">
                        <div class="spinner mx-auto mb-2"></div>
                        <p class="text-gray-500">Loading pending submissions...</p>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-8">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">✅ Graded Submissions</h3>
                <button id="toggle-graded-btn" class="btn btn-secondary btn-sm">
                    👁️ Show/Hide
                </button>
            </div>
            <div id="gradedReportsContainer" class="space-y-4 hidden">
                <div class="card">
                    <div class="card-body text-center">
                        <div class="spinner mx-auto mb-2"></div>
                        <p class="text-gray-500">Loading graded submissions...</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Toggle graded submissions visibility
    const toggleGradedBtn = document.getElementById('toggle-graded-btn');
    if (toggleGradedBtn) {
        toggleGradedBtn.addEventListener('click', () => {
            const gradedContainer = document.getElementById('gradedReportsContainer');
            const toggleBtn = document.getElementById('toggle-graded-btn');
            
            if (gradedContainer.classList.contains('hidden')) {
                gradedContainer.classList.remove('hidden');
                toggleBtn.innerHTML = '👁️ Hide';
            } else {
                gradedContainer.classList.add('hidden');
                toggleBtn.innerHTML = '👁️ Show';
            }
        });
    }

    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', async () => {
            const name = document.getElementById('searchName').value.trim();
            const status = document.getElementById('filterStatus').value;
            await loadTutorReports(tutor.email, name || null, status || null);
        });
    }

    loadTutorReports(tutor.email);

    // Start Lagos clock on dashboard
    (function startTutorClock() {
        function getLagosTime() {
            return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
        }
        function formatLagosDT() {
            const opts = { weekday:'short', day:'numeric', month:'short', year:'numeric',
                           hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true, timeZone:'Africa/Lagos' };
            return new Intl.DateTimeFormat('en-NG', opts).format(new Date());
        }
        const clockEl = document.getElementById('tutor-lagos-clock');
        if (clockEl) {
            clockEl.textContent = formatLagosDT();
            // Store interval id so it can be cleared on tab switch
            if (window._tutorClockInterval) clearInterval(window._tutorClockInterval);
            window._tutorClockInterval = setInterval(() => {
                const el = document.getElementById('tutor-lagos-clock');
                if (el) el.textContent = formatLagosDT();
                else clearInterval(window._tutorClockInterval);
            }, 1000);
        }
    })();

    // Init performance scorecard (real-time listener to tutor doc)
    if (tutor.id) initGamification(tutor.id);
}

async function loadStudentDropdowns(tutorEmail) {
    try {
        const studentsQuery = query(collection(db, "students"), where("tutorEmail", "==", tutorEmail));
        const studentsSnapshot = await getDocs(studentsQuery);
        
        studentCache = [];
        const students = [];
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            // Filter out archived students
            if (!['archived', 'graduated', 'transferred'].includes(student.status)) {
                students.push(student);
                studentCache.push(student);
            }
        });
        
        const topicSelect = document.getElementById('select-student-topic');
        const hwSelect = document.getElementById('select-student-hw');
        
        if (topicSelect && hwSelect) {
            while (topicSelect.options.length > 1) topicSelect.remove(1);
            while (hwSelect.options.length > 1) hwSelect.remove(1);
            
            students.forEach(student => {
                const option = document.createElement('option');
                option.value = student.id;
                option.textContent = `${escapeHtml(student.studentName)} (${escapeHtml(student.grade)})`;
                
                const option2 = option.cloneNode(true);
                topicSelect.appendChild(option);
                hwSelect.appendChild(option2);
            });
        }
    } catch (error) {
        console.error("Error loading student dropdowns:", error);
    }
}

function getStudentFromCache(studentId) {
    return studentCache.find(s => s.id === studentId);
}

async function loadTutorReports(tutorEmail, parentName = null, statusFilter = null) {
    const pendingReportsContainer = document.getElementById('pendingReportsContainer');
    const gradedReportsContainer = document.getElementById('gradedReportsContainer');
    
    if (!pendingReportsContainer) return;
    
    pendingReportsContainer.innerHTML = `
        <div class="card"><div class="card-body text-center">
            <div class="spinner mx-auto mb-2"></div>
            <p class="text-gray-500">Loading submissions...</p>
        </div></div>`;
    
    if (gradedReportsContainer) {
        gradedReportsContainer.innerHTML = `
            <div class="card"><div class="card-body text-center">
                <div class="spinner mx-auto mb-2"></div>
                <p class="text-gray-500">Loading graded submissions...</p>
            </div></div>`;
    }

    try {
        // Fetch active students (not on break) to use as a filter
        const activeStudentsSnap = await getDocs(query(
            collection(db, 'students'),
            where('tutorEmail', '==', tutorEmail)
        ));
        const activeStudentIds = new Set();
        const activeStudentMap = {};
        activeStudentsSnap.docs.forEach(d => {
            const s = d.data();
            if (!s.summerBreak && !s.isTransitioning && !['archived','graduated','transferred'].includes(s.status)) {
                activeStudentIds.add(d.id);
                activeStudentMap[d.id] = s;
            }
        });

        let assessmentsQuery = query(
            collection(db, "student_results"), 
            where("tutorEmail", "==", tutorEmail)
        );
        if (parentName) {
            assessmentsQuery = query(assessmentsQuery, where("parentName", "==", parentName));
        }

        let creativeWritingQuery = query(
            collection(db, "tutor_submissions"),
            where("tutorEmail", "==", tutorEmail),
            where("type", "==", "creative_writing")
        );
        if (parentName) {
            creativeWritingQuery = query(creativeWritingQuery, where("parentName", "==", parentName));
        }

        const [assessmentsSnapshot, creativeWritingSnapshot] = await Promise.all([
            getDocs(assessmentsQuery),
            getDocs(creativeWritingQuery)
        ]);

        let pendingItems = []; // { studentName, grade } — simple list
        let gradedHTML = '';
        let pendingCount = 0;
        let gradedCount = 0;

        assessmentsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Skip break / inactive students
            if (data.studentId && !activeStudentIds.has(data.studentId)) return;

            const needsFeedback = data.answers && data.answers.some(answer => 
                answer.type === 'creative-writing' && 
                (!answer.tutorReport || answer.tutorReport.trim() === '')
            );

            if (needsFeedback) {
                if (!statusFilter || statusFilter === 'pending') {
                    pendingItems.push({ studentName: data.studentName || 'Unknown', grade: data.grade || 'N/A' });
                    pendingCount++;
                }
            } else {
                if (!statusFilter || statusFilter === 'graded') {
                    gradedHTML += buildReportCard(docSnap, data, false);
                    gradedCount++;
                }
            }
        });

        creativeWritingSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.studentId && !activeStudentIds.has(data.studentId)) return;

            const needsFeedback = !data.tutorReport || data.tutorReport.trim() === '';

            if (needsFeedback) {
                if (!statusFilter || statusFilter === 'pending') {
                    pendingItems.push({ studentName: data.studentName || 'Unknown', grade: data.grade || 'N/A' });
                    pendingCount++;
                }
            } else {
                if (!statusFilter || statusFilter === 'graded') {
                    gradedHTML += buildCreativeWritingCard(docSnap, data);
                    gradedCount++;
                }
            }
        });

        // Render pending list — compact, name + grade only
        const pendingCountEl = document.getElementById('pending-count');
        if (pendingCountEl) pendingCountEl.textContent = pendingCount;

        if (pendingItems.length === 0) {
            pendingReportsContainer.innerHTML = `
                <div class="card"><div class="card-body text-center">
                    <div class="text-4xl mb-2">🎉</div>
                    <p class="text-gray-500">All caught up! No pending submissions.</p>
                </div></div>`;
        } else {
            pendingReportsContainer.innerHTML = `
                <div class="card">
                    <div class="card-body p-0">
                        <div class="divide-y divide-gray-100">
                            ${pendingItems.map(item => `
                            <div class="flex items-center justify-between px-4 py-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                                        ${escapeHtml((item.studentName||'?').charAt(0))}
                                    </div>
                                    <span class="font-medium text-gray-800">${escapeHtml(item.studentName)}</span>
                                </div>
                                <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">${escapeHtml(item.grade)}</span>
                            </div>`).join('')}
                        </div>
                    </div>
                </div>`;
        }

        if (gradedReportsContainer) {
            gradedReportsContainer.innerHTML = gradedHTML ||
                `<div class="card"><div class="card-body text-center text-gray-500">No graded submissions yet.</div></div>`;
        }

        // Attach submit feedback listeners
        attachSubmitReportListeners();

    } catch (error) {
        console.error("Error loading reports:", error);
        if (pendingReportsContainer) pendingReportsContainer.innerHTML =
            `<div class="card"><div class="card-body text-center text-red-500">Error loading submissions.</div></div>`;
    }
}

// Helper: Build a standard report card HTML string
function buildReportCard(docRef, data, needsFeedback) {
    return `
    <div class="card">
        <div class="card-body">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-bold">${escapeHtml(data.studentName)}</h4>
                    <p class="text-gray-500 text-sm">${escapeHtml(data.grade)}</p>
                </div>
                <span class="badge badge-success">Graded</span>
            </div>
            ${data.answers ? data.answers.filter(a => a.type === 'creative-writing').map((answer, index) => `
                <div class="p-3 bg-blue-50 rounded-lg mb-2">
                    <p class="italic text-gray-700 text-sm mb-2">${escapeHtml(answer.textAnswer || "No response")}</p>
                    <div class="bg-white p-2 rounded border">
                        <span class="text-xs font-semibold text-gray-500">Feedback:</span>
                        <p class="text-sm">${escapeHtml(answer.tutorReport || 'N/A')}</p>
                    </div>
                </div>`).join('') : ''}
        </div>
    </div>`;
}

function buildCreativeWritingCard(docRef, data) {
    return `
    <div class="card border-l-4 border-blue-500">
        <div class="card-body">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h4 class="font-bold">${escapeHtml(data.studentName)}</h4>
                    <p class="text-gray-500 text-sm">${escapeHtml(data.grade)}</p>
                </div>
                <span class="badge badge-success">Graded</span>
            </div>
            <div class="bg-blue-50 p-3 rounded-lg">
                <p class="italic text-gray-700 text-sm">${escapeHtml(data.textAnswer || "No response")}</p>
                <div class="mt-2 bg-white p-2 rounded border">
                    <span class="text-xs font-semibold">Your Feedback:</span>
                    <p class="text-sm">${escapeHtml(data.tutorReport || 'N/A')}</p>
                </div>
            </div>
        </div>
    </div>`;
}

function attachSubmitReportListeners() {
    document.querySelectorAll('.submit-report-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const docId = e.target.dataset.docId;
            const collectionName = e.target.dataset.collection;
            const answerIndex = parseInt(e.target.dataset.answerIndex);
            const feedback = e.target.closest('.mb-4').querySelector('.tutor-report').value.trim();
            if (!feedback) { showCustomAlert('Please write feedback before submitting.'); return; }
            try {
                e.target.disabled = true; e.target.textContent = 'Submitting…';
                const docRef2 = doc(db, collectionName, docId);
                const docSnap2 = await getDoc(docRef2);
                if (docSnap2.exists()) {
                    const answers = [...(docSnap2.data().answers || [])];
                    if (answers[answerIndex]) { answers[answerIndex].tutorReport = feedback; }
                    await updateDoc(docRef2, { answers });
                    showCustomAlert('✅ Feedback submitted!');
                    loadTutorReports(window.tutorData?.email);
                }
            } catch (err) { console.error(err); showCustomAlert('❌ Error submitting feedback.'); }
        });
    });
}

/*******************************************************************************
 * SECTION 12: STUDENT DATABASE MANAGEMENT

/*******************************************************************************
 * SECTION 12: STUDENT DATABASE MANAGEMENT (FINAL FIXED VERSION WITH NEW FEATURES)
 * UPDATED: 
 * 1. Tutors only see approved students (no pending students)
 * 2. Recall button tracks request status and prevents duplicate requests
 * 3. 🆕 Full "Add Student" section is hidden when isTutorAddEnabled == false
 * 4. 🆕 "Add Transitioning" button respects isTransitionAddEnabled
 * 5. 🆕 Preschool/Kindergarten grade options respect isPreschoolAddEnabled
 ******************************************************************************/

// --- Helper function to check recall request status ---
async function checkRecallRequestStatus(studentId) {
    try {
        const recallQuery = query(
            collection(db, "recall_requests"),
            where("studentId", "==", studentId),
            where("status", "in", ["pending", "approved"])
        );
        const snapshot = await getDocs(recallQuery);
        
        if (!snapshot.empty) {
            const latestRequest = snapshot.docs[0].data();
            return latestRequest.status; // Returns 'pending' or 'approved'
        }
        return null; // No recall request exists
    } catch (error) {
        console.error("Error checking recall status:", error);
        return null;
    }
}

// --- Form Helper (Specific to this section) ---
function getNewStudentFormFields() {
    // 🆕 Grade options – conditionally include Preschool/Kindergarten
    let gradeOptions = `<option value="">Select Grade</option>`;
    
    if (isPreschoolAddEnabled) {
        gradeOptions += `
            <option value="Preschool">Preschool</option>
            <option value="Kindergarten">Kindergarten</option>
        `;
    }
    
    for (let i = 1; i <= 12; i++) {
        gradeOptions += `<option value="Grade ${i}">Grade ${i}</option>`;
    }
    
    gradeOptions += `
        <option value="Pre-College">Pre-College</option>
        <option value="College">College</option>
        <option value="Adults">Adults</option>
    `;
    
    let feeOptions = '<option value="">Select Fee (₦)</option>';
    for (let fee = 10000; fee <= 400000; fee += 5000) {
        feeOptions += `<option value="${fee}">${fee.toLocaleString()}</option>`;
    }
    
    // Fallback subjects if global is missing
    const subjectsByCategory = window.SUBJECT_CATEGORIES || {
        "Academics": ["Math", "Language Arts", "Geography", "Science", "Biology", "Physics", "Chemistry", "Microbiology"],
        "Pre-College Exams": ["SAT", "IGCSE", "A-Levels", "SSCE", "JAMB"],
        "Languages": ["French", "German", "Spanish", "Yoruba", "Igbo", "Hausa", "Arabic"],
        "Tech Courses": ["Coding","ICT", "Stop motion animation", "Computer Appreciation", "Digital Entrepeneurship", "Animation", "YouTube for kids", "Graphic design", "Videography", "Comic/book creation", "Artificial Intelligence", "Chess"],
        "Support Programs": ["Bible study", "Counseling Programs", "Speech therapy", "Behavioral therapy", "Public speaking", "Adult education", "Communication skills", "English Proficiency"]
    };

    let subjectsHTML = `<h4 class="font-semibold text-gray-700 mt-2">Subjects</h4><div id="new-student-subjects-container" class="space-y-2 border p-3 rounded bg-gray-50 max-h-48 overflow-y-auto">`;
    for (const category in subjectsByCategory) {
        subjectsHTML += `
            <details>
                <summary class="font-semibold cursor-pointer text-sm">${escapeHtml(category)}</summary>
                <div class="pl-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    ${subjectsByCategory[category].map(subject => `<div><label class="text-sm font-normal"><input type="checkbox" name="subjects" value="${escapeHtml(subject)}"> ${escapeHtml(subject)}</label></div>`).join('')}
                </div>
            </details>
        `;
    }
    subjectsHTML += `<div class="font-semibold pt-2 border-t"><label class="text-sm"><input type="checkbox" name="subjects" value="Music"> Music</label></div></div>`;

    return `
        <input type="text" id="new-parent-name" class="w-full mt-1 p-2 border rounded" placeholder="Parent Name">
        <input type="tel" id="new-parent-phone" class="w-full mt-1 p-2 border rounded" placeholder="Parent Phone Number">
        <input type="text" id="new-student-name" class="w-full mt-1 p-2 border rounded" placeholder="Student Name">
        <select id="new-student-grade" class="w-full mt-1 p-2 border rounded">${gradeOptions}</select>
        ${subjectsHTML}
        <select id="new-student-days" class="w-full mt-1 p-2 border rounded">
            <option value="">Select Days per Week</option>
            ${Array.from({ length: 7 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
        </select>
        <div id="group-class-container" class="hidden">
            <label class="flex items-center space-x-2 mt-2">
                <input type="checkbox" id="new-student-group-class" class="rounded">
                <span class="text-sm font-semibold">Group Class</span>
            </label>
        </div>
        <select id="new-student-fee" class="w-full mt-1 p-2 border rounded">${feeOptions}</select>
    `;
}

// --- Edit Student Modal (Isolated) ---
function showEditStudentModal(student) {
    // 🆕 Grade options – conditionally include Preschool/Kindergarten
    let gradeOptions = `<option value="">Select Grade</option>`;
    
    if (isPreschoolAddEnabled) {
        gradeOptions += `
            <option value="Preschool" ${student.grade === 'Preschool' ? 'selected' : ''}>Preschool</option>
            <option value="Kindergarten" ${student.grade === 'Kindergarten' ? 'selected' : ''}>Kindergarten</option>
        `;
    }
    
    for (let i = 1; i <= 12; i++) {
        const gradeValue = `Grade ${i}`;
        gradeOptions += `<option value="${escapeHtml(gradeValue)}" ${student.grade === gradeValue ? 'selected' : ''}>${escapeHtml(gradeValue)}</option>`;
    }
    
    gradeOptions += `
        <option value="Pre-College" ${student.grade === 'Pre-College' ? 'selected' : ''}>Pre-College</option>
        <option value="College" ${student.grade === 'College' ? 'selected' : ''}>College</option>
        <option value="Adults" ${student.grade === 'Adults' ? 'selected' : ''}>Adults</option>
    `;
    
    let daysOptions = '<option value="">Select Days per Week</option>';
    for (let i = 1; i <= 7; i++) {
        daysOptions += `<option value="${i}" ${student.days == i ? 'selected' : ''}>${i}</option>`;
    }

    const subjectsByCategory = window.SUBJECT_CATEGORIES || {
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
                <summary class="font-semibold cursor-pointer text-sm">${escapeHtml(category)}</summary>
                <div class="pl-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    ${subjectsByCategory[category].map(subject => {
                        const isChecked = student.subjects && student.subjects.includes(subject);
                        return `<div><label class="text-sm font-normal"><input type="checkbox" name="edit-subjects" value="${escapeHtml(subject)}" ${isChecked ? 'checked' : ''}> ${escapeHtml(subject)}</label></div>`;
                    }).join('')}
                </div>
            </details>
        `;
    }
    subjectsHTML += `<div class="font-semibold pt-2 border-t"><label class="text-sm"><input type="checkbox" name="edit-subjects" value="Music" ${student.subjects && student.subjects.includes('Music') ? 'checked' : ''}> Music</label></div></div>`;

    const editFormHTML = `
        <h3 class="text-xl font-bold mb-4">Edit Student: ${escapeHtml(student.studentName)}</h3>
        <div class="space-y-4">
            <div><label class="block font-semibold">Parent Name</label><input type="text" id="edit-parent-name" class="w-full mt-1 p-2 border rounded" value="${escapeHtml(student.parentName || '')}" placeholder="Parent Name"></div>
            <div><label class="block font-semibold">Parent Phone Number</label><input type="tel" id="edit-parent-phone" class="w-full mt-1 p-2 border rounded" value="${escapeHtml(student.parentPhone || '')}" placeholder="Parent Phone Number"></div>
            <div><label class="block font-semibold">Student Name</label><input type="text" id="edit-student-name" class="w-full mt-1 p-2 border rounded" value="${escapeHtml(student.studentName || '')}" placeholder="Student Name"></div>
            <div><label class="block font-semibold">Grade</label><select id="edit-student-grade" class="w-full mt-1 p-2 border rounded">${gradeOptions}</select></div>
            ${subjectsHTML}
            <div><label class="block font-semibold">Days per Week</label><select id="edit-student-days" class="w-full mt-1 p-2 border rounded">${daysOptions}</select></div>
            <div id="edit-group-class-container" class="${(student.subjects && (student.subjects.some(s => window.SUBJECT_CATEGORIES && window.SUBJECT_CATEGORIES['Specialized'] && window.SUBJECT_CATEGORIES['Specialized'].includes(s)))) ? '' : 'hidden'}">
                <label class="flex items-center space-x-2"><input type="checkbox" id="edit-student-group-class" class="rounded" ${student.groupClass ? 'checked' : ''}><span class="text-sm font-semibold">Group Class</span></label>
            </div>
            <div><label class="block font-semibold">Fee (₦)</label><input type="text" id="edit-student-fee" class="w-full mt-1 p-2 border rounded" value="${(student.studentFee || 0).toLocaleString()}" placeholder="Enter fee (e.g., 50,000)"></div>
            <div class="flex justify-end space-x-2 mt-6">
                <button id="cancel-edit-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
                <button id="save-edit-btn" class="bg-green-600 text-white px-6 py-2 rounded" data-student-id="${escapeHtml(student.id)}" data-collection="${escapeHtml(student.collection)}">Save Changes</button>
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
        document.querySelectorAll('input[name="edit-subjects"]:checked').forEach(checkbox => { selectedSubjects.push(checkbox.value); });
        const studentDays = document.getElementById('edit-student-days').value.trim();
        const groupClass = document.getElementById('edit-student-group-class') ? document.getElementById('edit-student-group-class').checked : false;
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
            const studentData = { parentName, parentPhone, studentName, grade: studentGrade, subjects: selectedSubjects, days: studentDays, studentFee };
            if (document.getElementById('edit-student-group-class')) { studentData.groupClass = groupClass; }
            const studentRef = doc(db, collectionName, studentId);
            await updateDoc(studentRef, studentData);
            editModal.remove();
            showCustomAlert('Student details updated successfully!');
            const mainContent = document.getElementById('mainContent');
            renderStudentDatabase(mainContent, window.tutorData);
        } catch (error) {
            console.error("Error updating student:", error);
            showCustomAlert(`An error occurred: ${error.message}`);
        }
    });
}

// --- Main Render Function ---
async function renderStudentDatabase(container, tutor) {
    // REMOVED early return check for window.fixedMonthSystemInitialized
    if (!container) return;

    // Load Reports
    let savedReports = await loadReportsFromFirestore(tutor.email);
    
    // 🆕 Add toggle state for showing total fees
    const showFeesToggleKey = `showFeesToggle_${tutor.email}`;
    const showFeesToggle = localStorage.getItem(showFeesToggleKey) === 'true';
    
    // Helper function to calculate total fees (excluding break students)
    function calculateTotalFees() {
        let total = 0;
        approvedStudents.forEach(student => {
            // Only add fees for students NOT on break
            if (!student.summerBreak) {
                total += student.studentFee || 0;
            }
        });
        return total;
    }
    
    // Queries - REMOVED pendingStudentQuery (Tutors only see approved students)
    const studentQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
    const allSubmissionsQuery = query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutor.email));
    
    const [studentsSnapshot, allSubmissionsSnapshot] = await Promise.all([
        getDocs(studentQuery), getDocs(allSubmissionsQuery)  // Only approved students and submissions
    ]);

    // Process Students - ONLY APPROVED STUDENTS
    let approvedStudents = studentsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), collection: "students" }))
        .filter(student => !student.status || student.status === 'active' || student.status === 'approved' || !['archived', 'graduated', 'transferred'].includes(student.status));

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const submittedStudentIds = new Set();
    allSubmissionsSnapshot.forEach(doc => {
        const subData = doc.data();
        const subDate = subData.submittedAt.toDate();
        if (subDate.getMonth() === currentMonth && subDate.getFullYear() === currentYear) {
            submittedStudentIds.add(subData.studentId);
        }
    });

    // FIX: ONLY approved students - NO pending students
    let students = [...approvedStudents];  // Tutors only see approved students

    // Deduplicate
    const seenStudents = new Set();
    const duplicatesToDelete = [];
    students = students.filter(student => {
        const id = `${student.studentName}-${student.tutorEmail}`;
        if (seenStudents.has(id)) { duplicatesToDelete.push({ id: student.id, collection: student.collection }); return false; }
        seenStudents.add(id);
        return true;
    });
    if (duplicatesToDelete.length > 0) {
        const batch = writeBatch(db);
        duplicatesToDelete.forEach(dup => batch.delete(doc(db, dup.collection, dup.id)));
        await batch.commit();
    }

    const studentsCount = students.length;

    // --- RENDER UI (UPDATED) ---
    function renderUI() {
        let studentsHTML = `
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-green-700">My Students (${studentsCount})</h2>
                <div class="flex items-center space-x-4">
                    <label class="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" id="toggle-fees-display" class="hidden peer" ${showFeesToggle ? 'checked' : ''}>
                        <div class="relative w-12 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors">
                            <div class="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></div>
                        </div>
                        <span class="text-sm font-medium">Show Total Fees</span>
                    </label>
                    ${showFeesToggle ? `<div class="bg-green-100 text-green-800 px-3 py-1 rounded-lg font-bold" id="total-fees-display">Total: ₦${calculateTotalFees().toLocaleString()}</div>` : ''}
                </div>
            </div>`;
        
        // 🆕 NEW: Conditionally show the entire "Add a New Student" section
        if (isTutorAddEnabled) {
            studentsHTML += `
                <div class="bg-gray-100 p-4 rounded-lg shadow-inner mb-4">
                    <h3 class="font-bold text-lg mb-2">Add a New Student</h3>
                    <div class="space-y-2">${getNewStudentFormFields()}</div>
                    <div class="flex space-x-2 mt-3">
                        <button id="add-student-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Add Student</button>
                        ${isTransitionAddEnabled ? `<button id="add-transitioning-btn" class="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700">Add Transitioning</button>` : ''}
                    </div>
                </div>`;
        }
        
        studentsHTML += `<p class="text-sm text-gray-600 mb-4">Report submission is currently <strong class="${isSubmissionEnabled ? 'text-green-600' : 'text-red-500'}">${isSubmissionEnabled ? 'Enabled' : 'Disabled'}</strong> by the admin.</p>`;

        if (studentsCount === 0) {
            studentsHTML += `<p class="text-gray-500">You are not assigned to any students yet.</p>`;
        } else {
            studentsHTML += `
                <div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200">
                <thead><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Student Name</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th></tr></thead>
                <tbody class="bg-white divide-y divide-gray-200">`;
            
            students.forEach(student => {
                const hasSubmitted = submittedStudentIds.has(student.id);
                const isReportSaved = savedReports[student.id];
                const feeDisplay = showStudentFees ? `<div class="text-xs text-gray-500">Fee: ₦${(student.studentFee || 0).toLocaleString()}</div>` : '';
                let statusHTML = '', actionsHTML = '';
                const subjects = student.subjects ? student.subjects.join(', ') : 'N/A';
                const days = student.days ? `${student.days} days/week` : 'N/A';

                // FIXED: No pending student check - tutors only see approved students
                if (hasSubmitted) {
                    statusHTML = `<span class="status-indicator text-blue-600 font-semibold">Report Sent</span>`;
                    actionsHTML = `<span class="text-gray-400">Submitted this month</span>`;
                } else {
                    const transIndicator = student.isTransitioning ? `<span class="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full ml-2">Transitioning</span>` : '';
                    statusHTML = `<span class="status-indicator ${isReportSaved ? 'text-green-600 font-semibold' : 'text-gray-500'}">${isReportSaved ? 'Report Saved' : 'Pending Report'}</span>${transIndicator}`;
                    
                    // BREAK/RECALL LOGIC with status checking
                    if (isSummerBreakEnabled) {
                        const recallStatus = window.recallStatusCache ? window.recallStatusCache[student.id] : null;
                        
                        if (student.summerBreak) {
                            // Student is on break - show appropriate recall button/status
                            if (recallStatus === 'pending') {
                                actionsHTML += `<span class="bg-purple-200 text-purple-800 px-3 py-1 rounded text-sm">Recall Requested</span>`;
                            } else {
                                actionsHTML += `<button class="recall-from-break-btn bg-purple-500 text-white px-3 py-1 rounded" data-student-id="${escapeHtml(student.id)}">Recall</button>`;
                            }
                        } else {
                            // Student is active - show Break button
                            actionsHTML += `<button class="summer-break-btn bg-yellow-500 text-white px-3 py-1 rounded" data-student-id="${escapeHtml(student.id)}">Break</button>`;
                        }
                    }

                    if (isSubmissionEnabled && !student.summerBreak) {
                        if (approvedStudents.length === 1) {
                            actionsHTML += `<button class="submit-single-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${escapeHtml(student.id)}" data-is-transitioning="${student.isTransitioning}">Submit Report</button>`;
                        } else {
                            actionsHTML += `<button class="enter-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${escapeHtml(student.id)}" data-is-transitioning="${student.isTransitioning}">${isReportSaved ? 'Edit Report' : 'Enter Report'}</button>`;
                        }
                    } else if (!student.summerBreak) {
                        actionsHTML += `<span class="text-gray-400">Submission Disabled</span>`;
                    }
                    if (showEditDeleteButtons && !student.summerBreak) {
                        actionsHTML += `<button class="edit-student-btn-tutor bg-blue-500 text-white px-3 py-1 rounded" data-student-id="${escapeHtml(student.id)}" data-collection="${escapeHtml(student.collection)}">Edit</button>`;
                        actionsHTML += `<button class="delete-student-btn-tutor bg-red-500 text-white px-3 py-1 rounded" data-student-id="${escapeHtml(student.id)}" data-collection="${escapeHtml(student.collection)}">Delete</button>`;
                    }
                }
                studentsHTML += `<tr><td class="px-6 py-4 whitespace-nowrap">${escapeHtml(student.studentName)} (${escapeHtml(cleanGradeString ? cleanGradeString(student.grade) : student.grade)})<div class="text-xs text-gray-500">Subjects: ${escapeHtml(subjects)} | Days: ${escapeHtml(days)}</div>${feeDisplay}</td><td class="px-6 py-4 whitespace-nowrap">${statusHTML}</td><td class="px-6 py-4 whitespace-nowrap space-x-2">${actionsHTML}</td></tr>`;
            });
            studentsHTML += `</tbody></table></div>`;
            
            if (tutor.isManagementStaff) {
                studentsHTML += `<div class="bg-green-50 p-4 rounded-lg shadow-md mt-6"><h3 class="text-lg font-bold text-green-800 mb-2">Management Fee</h3><div class="flex items-center space-x-2"><label class="font-semibold">Fee (₦):</label><input type="number" id="management-fee-input" class="p-2 border rounded w-full" value="${escapeHtml(tutor.managementFee || 0)}"><button id="save-management-fee-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save Fee</button></div></div>`;
            }
            if (approvedStudents.length > 1 && isSubmissionEnabled) {
                const submittable = approvedStudents.filter(s => !s.summerBreak && !submittedStudentIds.has(s.id)).length;
                const allSaved = Object.keys(savedReports).length === submittable && submittable > 0;
                if (submittable > 0) {
                    studentsHTML += `<div class="mt-6 text-right"><button id="submit-all-reports-btn" class="bg-green-700 text-white px-6 py-3 rounded-lg font-bold ${!allSaved ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-800'}" ${!allSaved ? 'disabled' : ''}>Submit All Reports</button></div>`;
                }
            }
        }
        container.innerHTML = `<div id="student-list-view" class="bg-white p-6 rounded-lg shadow-md">${studentsHTML}</div>`;
        attachEventListeners();
    }

    // --- MODAL FUNCTIONS (Restored inside Scope) ---
    
    function showReportModal(student) {
        if (student.isTransitioning) {
            const currentMonthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
            const reportData = {
                studentId: student.id, studentName: student.studentName, grade: student.grade, parentName: student.parentName, parentPhone: student.parentPhone, 
                normalizedParentPhone: typeof normalizePhoneNumber === 'function' ? normalizePhoneNumber(student.parentPhone) : student.parentPhone,
                reportMonth: currentMonthYear, introduction: "Transitioning student", topics: "Transitioning student", progress: "Transitioning student", strengthsWeaknesses: "Transitioning student", recommendations: "Transitioning student", generalComments: "Transitioning student", isTransitioning: true
            };
            showFeeConfirmationModal(student, reportData);
            return;
        }

        const existingReport = savedReports[student.id] || {};
        const isSingleApprovedStudent = approvedStudents.filter(s => !s.summerBreak && !submittedStudentIds.has(s.id)).length === 1;
        const currentMonthYear = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
        
        const reportFormHTML = `
            <h3 class="text-xl font-bold mb-4">Monthly Report for ${escapeHtml(student.studentName)}</h3>
            <div class="bg-blue-50 p-3 rounded-lg mb-4"><p class="text-sm font-semibold text-blue-800">Month: ${escapeHtml(currentMonthYear)}</p><p class="text-xs text-blue-600 mt-1">All fields are required</p></div>
            <div class="space-y-4">
                <div><label class="block font-semibold">Introduction</label><textarea id="report-intro" class="w-full mt-1 p-2 border rounded required-field" rows="2" placeholder="Enter introduction...">${escapeHtml(existingReport.introduction || '')}</textarea></div>
                <div><label class="block font-semibold">Topics & Remarks</label><textarea id="report-topics" class="w-full mt-1 p-2 border rounded required-field" rows="3" placeholder="Enter topics...">${escapeHtml(existingReport.topics || '')}</textarea></div>
                <div><label class="block font-semibold">Progress & Achievements</label><textarea id="report-progress" class="w-full mt-1 p-2 border rounded required-field" rows="2" placeholder="Enter progress...">${escapeHtml(existingReport.progress || '')}</textarea></div>
                <div><label class="block font-semibold">Strengths & Weaknesses</label><textarea id="report-sw" class="w-full mt-1 p-2 border rounded required-field" rows="2" placeholder="Enter strengths...">${escapeHtml(existingReport.strengthsWeaknesses || '')}</textarea></div>
                <div><label class="block font-semibold">Recommendations</label><textarea id="report-recs" class="w-full mt-1 p-2 border rounded required-field" rows="2" placeholder="Enter recommendations...">${escapeHtml(existingReport.recommendations || '')}</textarea></div>
                <div><label class="block font-semibold">General Comments</label><textarea id="report-general" class="w-full mt-1 p-2 border rounded required-field" rows="2" placeholder="Enter general comments...">${escapeHtml(existingReport.generalComments || '')}</textarea></div>
                <div class="flex justify-end space-x-2">
                    <button id="cancel-report-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
                    <button id="modal-action-btn" class="bg-green-600 text-white px-6 py-2 rounded">${isSingleApprovedStudent ? 'Proceed to Submit' : 'Save Report'}</button>
                </div>
            </div>`;
        
        const reportModal = document.createElement('div');
        reportModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        reportModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl mx-auto">${reportFormHTML}</div>`;
        document.body.appendChild(reportModal);

        // Validation Listeners
        const textareas = reportModal.querySelectorAll('.required-field');
        textareas.forEach(textarea => {
            textarea.addEventListener('input', function() {
                if (this.value.trim() === '') { this.classList.add('border-red-300'); this.classList.remove('border-green-300'); } 
                else { this.classList.remove('border-red-300'); this.classList.add('border-green-300'); }
            });
        });

        document.getElementById('cancel-report-btn').addEventListener('click', () => reportModal.remove());
        document.getElementById('modal-action-btn').addEventListener('click', async () => {
            const requiredFields = ['report-intro', 'report-topics', 'report-progress', 'report-sw', 'report-recs', 'report-general'];
            const missing = requiredFields.filter(id => !document.getElementById(id).value.trim());
            if (missing.length > 0) {
                showCustomAlert("Please complete all report fields.");
                return;
            }
            const reportData = {
                studentId: student.id, studentName: student.studentName, grade: student.grade, parentName: student.parentName, 
                parentPhone: student.parentPhone, 
                normalizedParentPhone: typeof normalizePhoneNumber === 'function' ? normalizePhoneNumber(student.parentPhone) : student.parentPhone,
                reportMonth: currentMonthYear,
                introduction: document.getElementById('report-intro').value, topics: document.getElementById('report-topics').value,
                progress: document.getElementById('report-progress').value, strengthsWeaknesses: document.getElementById('report-sw').value,
                recommendations: document.getElementById('report-recs').value, generalComments: document.getElementById('report-general').value
            };
            reportModal.remove();
            showFeeConfirmationModal(student, reportData);
        });
    }

    function showFeeConfirmationModal(student, reportData) {
        const feeConfirmationHTML = `
            <h3 class="text-xl font-bold mb-4">Confirm Fee for ${escapeHtml(student.studentName)}</h3>
            <p class="text-sm text-gray-600 mb-4">Please verify the monthly fee for this student.</p>
            <div class="space-y-4">
                <div><label class="block font-semibold">Current Fee (₦)</label><input type="number" id="confirm-student-fee" class="w-full mt-1 p-2 border rounded" value="${escapeHtml(student.studentFee || 0)}"></div>
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
            const newFee = parseFloat(document.getElementById('confirm-student-fee').value);
            if (isNaN(newFee) || newFee < 0) { showCustomAlert('Invalid fee.'); return; }

            if (newFee !== student.studentFee) {
                await updateDoc(doc(db, student.collection, student.id), { studentFee: newFee });
                student.studentFee = newFee; 
                showCustomAlert('Fee updated!');
            }
            feeModal.remove();
            if (isSingleApprovedStudent) { showAccountDetailsModal([reportData]); } else { savedReports[student.id] = reportData; await saveReportsToFirestore(tutor.email, savedReports); showCustomAlert('Report saved.'); renderUI(); }
        });
    }

    function showAccountDetailsModal(reportsArray) {
        const accountFormHTML = `
            <h3 class="text-xl font-bold mb-4">Enter Payment Details</h3>
            <div class="space-y-4">
                <div><label class="block font-semibold">Bank Name</label><input type="text" id="beneficiary-bank" class="w-full mt-1 p-2 border rounded" placeholder="Bank Name"></div>
                <div><label class="block font-semibold">Account Number</label><input type="text" id="beneficiary-account" class="w-full mt-1 p-2 border rounded" placeholder="10-digit Number"></div>
                <div><label class="block font-semibold">Beneficiary Name</label><input type="text" id="beneficiary-name" class="w-full mt-1 p-2 border rounded" placeholder="Full Name"></div>
                <div class="flex justify-end space-x-2 mt-6"><button id="cancel-account-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button><button id="confirm-submit-btn" class="bg-green-600 text-white px-6 py-2 rounded">Submit Reports</button></div>
            </div>`;
        
        const accountModal = document.createElement('div');
        accountModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
        accountModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-lg mx-auto">${accountFormHTML}</div>`;
        document.body.appendChild(accountModal);
        
        document.getElementById('cancel-account-btn').addEventListener('click', () => accountModal.remove());
        document.getElementById('confirm-submit-btn').addEventListener('click', async () => {
            const details = { beneficiaryBank: document.getElementById('beneficiary-bank').value, beneficiaryAccount: document.getElementById('beneficiary-account').value, beneficiaryName: document.getElementById('beneficiary-name').value };
            if(!details.beneficiaryBank || !details.beneficiaryAccount || !details.beneficiaryName) { showCustomAlert("Fill all bank details."); return; }
            accountModal.remove();
            await submitAllReports(reportsArray, details);
        });
    }

    async function submitAllReports(reportsArray, accountDetails) {
        const batch = writeBatch(db);
        reportsArray.forEach(report => {
            const ref = doc(collection(db, "tutor_submissions"));
            batch.set(ref, { tutorEmail: tutor.email, tutorName: tutor.name, submittedAt: new Date(), ...report, ...accountDetails });
        });
        await batch.commit();
        await clearAllReportsFromFirestore(tutor.email);
        showCustomAlert("Reports Submitted!");
        renderStudentDatabase(container, tutor);
    }

    // Pre-fetch recall status for all students
    async function prefetchRecallStatuses() {
        const recallPromises = students
            .filter(s => s.summerBreak)
            .map(async student => {
                const status = await checkRecallRequestStatus(student.id);
                return { studentId: student.id, status };
            });
        
        const results = await Promise.all(recallPromises);
        window.recallStatusCache = {};
        results.forEach(result => {
            if (result.status) {
                window.recallStatusCache[result.studentId] = result.status;
            }
        });
    }

    // Pre-fetch recall statuses before rendering UI
    await prefetchRecallStatuses();

    function attachEventListeners() {
        // Subject checkbox listener for group class
        const subjectsContainer = document.getElementById('new-student-subjects-container');
        const groupClassContainer = document.getElementById('group-class-container');
        if (subjectsContainer && groupClassContainer) {
            subjectsContainer.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox' && e.target.checked) {
                    if (["Music", "Coding", "ICT", "Chess", "Public Speaking", "English Proficiency", "Counseling Programs"].includes(e.target.value)) {
                         groupClassContainer.classList.remove('hidden');
                    }
                }
            });
        }
        
        // Toggle for showing total fees
        const toggleFees = document.getElementById('toggle-fees-display');
        if (toggleFees) {
            toggleFees.addEventListener('change', (e) => {
                localStorage.setItem(showFeesToggleKey, e.target.checked);
                renderStudentDatabase(container, tutor);
            });
        }
        
        // 🆕 Add transitioning student – button may not exist if hidden, so we check
        const transitionBtn = document.getElementById('add-transitioning-btn');
        if (transitionBtn) {
            transitionBtn.addEventListener('click', () => {
                if(confirm("Add Transitioning Student?")) addTransitioningStudent();
            });
        }

        // Add regular student
        const studentBtn = document.getElementById('add-student-btn');
        if (studentBtn && isTutorAddEnabled) {
             studentBtn.addEventListener('click', async () => {
                const parentName = document.getElementById('new-parent-name').value.trim();
                const parentPhone = document.getElementById('new-parent-phone').value.trim();
                const studentName = document.getElementById('new-student-name').value.trim();
                const studentGrade = document.getElementById('new-student-grade').value.trim();
                const selectedSubjects = [];
                document.querySelectorAll('input[name="subjects"]:checked').forEach(c => selectedSubjects.push(c.value));
                const studentDays = document.getElementById('new-student-days').value.trim();
                const groupClass = document.getElementById('new-student-group-class') ? document.getElementById('new-student-group-class').checked : false;
                const studentFee = parseFloat(document.getElementById('new-student-fee').value);
                
                if (!parentName || !studentName || !studentGrade || isNaN(studentFee) || !parentPhone || !studentDays || selectedSubjects.length === 0) {
                    showCustomAlert('Please fill in all parent and student details.');
                    return;
                }
                
                const payScheme = getTutorPayScheme(tutor);
                const suggestedFee = calculateSuggestedFee({ grade: studentGrade, days: studentDays, subjects: selectedSubjects, groupClass: groupClass }, payScheme);
                const studentData = { parentName, parentPhone, studentName, grade: studentGrade, subjects: selectedSubjects, days: studentDays, studentFee: suggestedFee > 0 ? suggestedFee : studentFee, tutorEmail: tutor.email, tutorName: tutor.name };
                
                if (document.getElementById('group-class-container') && !document.getElementById('group-class-container').classList.contains('hidden')) {
                    studentData.groupClass = groupClass;
                }
                
                if (isBypassApprovalEnabled) {
                    await addDoc(collection(db, "students"), studentData);
                } else {
                    await addDoc(collection(db, "pending_students"), studentData);
                }
                showCustomAlert('Student Added!');
                renderStudentDatabase(container, tutor);
            });
        }

        // Enter report buttons
        document.querySelectorAll('.enter-report-btn, .submit-single-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const s = students.find(s => s.id === btn.getAttribute('data-student-id'));
                showReportModal(s);
            });
        });

        // Summer break button
        document.querySelectorAll('.summer-break-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const s = students.find(s => s.id === btn.getAttribute('data-student-id'));
                if (confirm(`Put ${escapeHtml(s.studentName)} on Break?`)) {
                    await updateDoc(doc(db, "students", s.id), { summerBreak: true });
                    renderStudentDatabase(container, tutor);
                }
            });
        });
        
        // NEW: Recall from break button with state management
        document.querySelectorAll('.recall-from-break-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                
                if (confirm(`Recall ${escapeHtml(student.studentName)} from break? This requires management approval.`)) {
                    try {
                        // Disable button immediately
                        btn.disabled = true;
                        btn.innerHTML = "Requesting...";
                        btn.classList.remove('bg-purple-500');
                        btn.classList.add('bg-gray-400');
                        
                        const recallRequest = {
                            studentId: student.id,
                            studentName: student.studentName,
                            tutorId: tutor.id,
                            tutorName: tutor.name,
                            tutorEmail: tutor.email,
                            requestDate: new Date(),
                            status: 'pending',
                            type: 'recall_from_break'
                        };
                        
                        await addDoc(collection(db, "recall_requests"), recallRequest);
                        
                        // Update button to show requested
                        btn.innerHTML = "Recall Requested";
                        btn.classList.remove('bg-gray-400');
                        btn.classList.add('bg-purple-200', 'text-purple-800');
                        
                        // Update the cache
                        if (window.recallStatusCache) {
                            window.recallStatusCache[student.id] = 'pending';
                        }
                        
                        showCustomAlert('✅ Recall request sent to management for approval.');
                        
                    } catch (error) {
                        console.error("Error sending recall request:", error);
                        showCustomAlert('❌ Error sending recall request. Please try again.');
                        // Reset button on error
                        btn.disabled = false;
                        btn.innerHTML = "Recall";
                        btn.classList.remove('bg-gray-400', 'bg-purple-200', 'text-purple-800');
                        btn.classList.add('bg-purple-500', 'text-white');
                    }
                }
            });
        });
        
        // Submit all reports
        const subAll = document.getElementById('submit-all-reports-btn');
        if(subAll) subAll.addEventListener('click', () => showAccountDetailsModal(Object.values(savedReports)));
        
        // Save management fee
        const saveFee = document.getElementById('save-management-fee-btn');
        if(saveFee) saveFee.addEventListener('click', async () => {
             const f = parseFloat(document.getElementById('management-fee-input').value);
             if(f>=0) { 
                 await updateDoc(doc(db, "tutors", tutor.id), { managementFee: f }); 
                 tutor.managementFee = f; 
                 showCustomAlert("Fee Saved"); 
             }
        });

        // Edit student
        document.querySelectorAll('.edit-student-btn-tutor').forEach(btn => {
            btn.addEventListener('click', () => {
                const s = students.find(s => s.id === btn.getAttribute('data-student-id'));
                showEditStudentModal(s);
            });
        });

        // Delete student
        document.querySelectorAll('.delete-student-btn-tutor').forEach(btn => {
            btn.addEventListener('click', async () => {
                const s = students.find(s => s.id === btn.getAttribute('data-student-id'));
                if (confirm(`Delete ${escapeHtml(s.studentName)}?`)) {
                    await deleteDoc(doc(db, s.collection, s.id));
                    renderStudentDatabase(container, tutor);
                }
            });
        });

        async function addTransitioningStudent() {
            // 🆕 Guard – button should be hidden, but double‑check
            if (!isTransitionAddEnabled) {
                showCustomAlert('Adding transitioning students is currently disabled by admin.');
                return;
            }
            
            const parentName = document.getElementById('new-parent-name').value.trim();
            const parentPhone = document.getElementById('new-parent-phone').value.trim();
            const studentName = document.getElementById('new-student-name').value.trim();
            const studentGrade = document.getElementById('new-student-grade').value.trim();
            const selectedSubjects = [];
            document.querySelectorAll('input[name="subjects"]:checked').forEach(checkbox => { selectedSubjects.push(checkbox.value); });
            const studentDays = document.getElementById('new-student-days').value.trim();
            const groupClass = document.getElementById('new-student-group-class') ? document.getElementById('new-student-group-class').checked : false;
            const studentFee = parseFloat(document.getElementById('new-student-fee').value);
            
            if (!parentName || !studentName || !studentGrade || isNaN(studentFee) || !parentPhone || !studentDays || selectedSubjects.length === 0) {
                showCustomAlert('Please fill in all parent and student details correctly, including at least one subject.');
                return;
            }

            const payScheme = getTutorPayScheme(tutor);
            const suggestedFee = calculateSuggestedFee({ grade: studentGrade, days: studentDays, subjects: selectedSubjects, groupClass: groupClass }, payScheme);
            const studentData = {
                parentName: parentName, parentPhone: parentPhone, studentName: studentName, grade: studentGrade,
                subjects: selectedSubjects, days: studentDays, studentFee: suggestedFee > 0 ? suggestedFee : studentFee,
                tutorEmail: tutor.email, tutorName: tutor.name,
                isTransitioning: true
            };
            if (document.getElementById('group-class-container') && !document.getElementById('group-class-container').classList.contains('hidden')) {
                studentData.groupClass = groupClass;
            }

            try {
                if (isBypassApprovalEnabled) { await addDoc(collection(db, "students"), studentData); showCustomAlert('Student added successfully!'); } 
                else { await addDoc(collection(db, "pending_students"), studentData); showCustomAlert('Student added and is pending approval.'); }
                renderStudentDatabase(container, tutor);
            } catch (error) { console.error("Error adding student:", error); showCustomAlert(`An error occurred: ${error.message}`); }
        }
    }

    renderUI();
}

/*******************************************************************************
 * SECTION 13: AUTO-REGISTERED STUDENTS MANAGEMENT
 ******************************************************************************/

// Auto-Registered Students Functions
function renderAutoRegisteredStudents(container, tutor) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2 class="text-2xl font-bold text-blue-700">🆕 Auto-Registered Students</h2>
            </div>
            <div class="card-body">
                <p class="text-sm text-gray-600 mb-4">Students who completed tests and need profile completion</p>
                <div id="auto-students-list">
                    <div class="text-center">
                        <div class="spinner mx-auto mb-2"></div>
                        <p class="text-gray-500">Loading auto-registered students...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    loadAutoRegisteredStudents(tutor.email);
}

async function loadAutoRegisteredStudents(tutorEmail) {
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
            ...studentsSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data(), collection: "students" }))
                .filter(student => !['archived', 'graduated', 'transferred'].includes(student.status)),
            ...pendingSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data(), collection: "pending_students" }))
                .filter(student => !['archived', 'graduated', 'transferred'].includes(student.status))
        ];

        renderAutoStudentsList(autoStudents);
    } catch (error) {
        console.error("Error loading auto-registered students:", error);
        document.getElementById('auto-students-list').innerHTML = `
            <div class="text-center">
                <div class="text-red-400 text-4xl mb-3">⚠️</div>
                <h4 class="font-bold text-red-600 mb-2">Failed to Load</h4>
                <p class="text-gray-500">Please check your connection and try again.</p>
            </div>
        `;
    }
}

function renderAutoStudentsList(students) {
    const container = document.getElementById('auto-students-list');
    
    if (students.length === 0) {
        container.innerHTML = `
            <div class="text-center">
                <div class="text-gray-400 text-4xl mb-3">👤</div>
                <h4 class="font-bold text-gray-600 mb-2">No Auto-Registered Students</h4>
                <p class="text-gray-500">No students need profile completion.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div class="table-container">
            <table class="table">
                <thead>
                    <tr>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Test Info</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    students.forEach(student => {
        const status = student.collection === "students" ? 
            "🆕 Needs Completion" : 
            "🆕 Awaiting Approval";
            
        const statusClass = student.collection === "students" ? 
            'badge badge-info' : 
            'badge badge-warning';
        
        html += `
            <tr>
                <td>
                    <div class="font-medium">${escapeHtml(student.studentName)}</div>
                    <div class="text-sm text-gray-500">${escapeHtml(student.grade)} • ${escapeHtml(student.parentPhone || 'No phone')}</div>
                    <div class="text-xs text-gray-400">${escapeHtml(student.parentEmail || 'No email')}</div>
                </td>
                <td>
                    <span class="${escapeHtml(statusClass)}">
                        ${escapeHtml(status)}
                    </span>
                </td>
                <td class="text-sm text-gray-500">
                    ${escapeHtml(student.testSubject || 'General Test')}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm complete-student-btn" 
                                data-student-id="${escapeHtml(student.id)}" data-collection="${escapeHtml(student.collection)}">
                            Complete Profile
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
    
    document.querySelectorAll('.complete-student-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const studentId = btn.getAttribute('data-student-id');
            const collection = btn.getAttribute('data-collection');
            const student = students.find(s => s.id === studentId && s.collection === collection);
            if (student) {
                showEditStudentModal(student);
            }
        });
    });
}

/*******************************************************************************
 * SECTION 13A: GAMIFICATION & PERFORMANCE ENGINE
 ******************************************************************************/

// --- CONFIGURATION ---
const GAMIFICATION_CONFIG = {
    confettiDuration: 3000, // 3 seconds
    celebrationFrequency: 'weekly', // 'daily', 'weekly', 'always'
    gradingCriteria: [
        { id: 'attendance', label: 'Punctuality', max: 20 },
        { id: 'student_feedback', label: 'Student Rating', max: 30 },
        { id: 'admin_review', label: 'Admin Assessment', max: 50 }
    ]
};

// --- STATE MANAGEMENT ---
let currentTutorScore = 0;
let isTutorOfTheMonth = false;

/**
 * Initializes the gamification dashboard widget.
 * Call this function when the dashboard loads.
 */
async function initGamification(tutorId) {
    try {
        // ── Step 1: Listen to the tutors doc for winner/badge info ──
        const tutorRef = doc(db, "tutors", tutorId);
        onSnapshot(tutorRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Keep gamification score on tutorData for winner badge (legacy)
                if (window.tutorData) {
                    window.tutorData._tutorDocScore = data.performanceScore || 0;
                }
            }
        });

        // ── Step 2: Read from tutor_grades (the real grading collection) ──
        // tutor_grades doc structure:
        //   { tutorId, tutorEmail, month, totalScore,
        //     qa: { score, notes, gradedBy, gradedByName, gradedAt },
        //     qc: { score, notes, gradedBy, gradedByName, gradedAt } }
        const lagosNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
        const currentMonthKey = `${lagosNow.getFullYear()}-${String(lagosNow.getMonth() + 1).padStart(2, '0')}`;

        const tutorEmail = window.tutorData?.email || '';

        // Build two queries (by tutorId OR tutorEmail) and pick first match
        const gradesQueries = [
            query(collection(db, 'tutor_grades'), where('month', '==', currentMonthKey), where('tutorId', '==', tutorId)),
            ...(tutorEmail ? [query(collection(db, 'tutor_grades'), where('month', '==', currentMonthKey), where('tutorEmail', '==', tutorEmail))] : [])
        ];

        let gradeDoc = null;
        for (const q of gradesQueries) {
            const snap = await getDocs(q);
            if (!snap.empty) { gradeDoc = snap.docs[0].data(); break; }
        }

        if (gradeDoc) {
            const qaScore = gradeDoc.qa?.score ?? null;
            const qcScore = gradeDoc.qc?.score ?? null;
            const combined = (qaScore !== null && qcScore !== null)
                ? Math.round((qaScore + qcScore) / 2)
                : (qaScore !== null ? qaScore : (qcScore !== null ? qcScore : gradeDoc.totalScore || 0));

            currentTutorScore = combined;

            const breakdown = {
                qaScore,
                qcScore,
                qaAdvice:       gradeDoc.qa?.notes       || '',
                qcAdvice:       gradeDoc.qc?.notes       || '',
                qaGradedByName: gradeDoc.qa?.gradedByName || '',
                qcGradedByName: gradeDoc.qc?.gradedByName || '',
                performanceMonth: gradeDoc.month || currentMonthKey
            };

            // Cache on tutorData
            if (window.tutorData) Object.assign(window.tutorData, breakdown);

            updateScoreDisplay(combined, breakdown);

            // Set up a real-time listener so scorecard updates if management grades live
            const gradesRef = query(collection(db, 'tutor_grades'), where('month', '==', currentMonthKey), where('tutorId', '==', tutorId));
            onSnapshot(gradesRef, (snap) => {
                if (!snap.empty) {
                    const d = snap.docs[0].data();
                    const qa2 = d.qa?.score ?? null;
                    const qc2 = d.qc?.score ?? null;
                    const comb2 = (qa2 !== null && qc2 !== null)
                        ? Math.round((qa2 + qc2) / 2)
                        : (qa2 !== null ? qa2 : (qc2 !== null ? qc2 : d.totalScore || 0));
                    currentTutorScore = comb2;
                    const bd = {
                        qaScore: qa2, qcScore: qc2,
                        qaAdvice: d.qa?.notes || '', qcAdvice: d.qc?.notes || '',
                        qaGradedByName: d.qa?.gradedByName || '',
                        qcGradedByName: d.qc?.gradedByName || '',
                        performanceMonth: d.month || currentMonthKey
                    };
                    if (window.tutorData) Object.assign(window.tutorData, bd);
                    updateScoreDisplay(comb2, bd);
                }
            });
        } else {
            // No grade document yet for this month – show empty scorecard
            updateScoreDisplay(0, {
                qaScore: null, qcScore: null,
                qaAdvice: '', qcAdvice: '',
                qaGradedByName: '', qcGradedByName: '',
                performanceMonth: currentMonthKey
            });
            // Still watch for when management adds a grade
            const gradesRef = query(collection(db, 'tutor_grades'), where('month', '==', currentMonthKey), where('tutorId', '==', tutorId));
            onSnapshot(gradesRef, (snap) => {
                if (!snap.empty) {
                    const d = snap.docs[0].data();
                    const qa2 = d.qa?.score ?? null;
                    const qc2 = d.qc?.score ?? null;
                    const comb2 = (qa2 !== null && qc2 !== null)
                        ? Math.round((qa2 + qc2) / 2)
                        : (qa2 !== null ? qa2 : (qc2 !== null ? qc2 : d.totalScore || 0));
                    currentTutorScore = comb2;
                    const bd = {
                        qaScore: qa2, qcScore: qc2,
                        qaAdvice: d.qa?.notes || '', qcAdvice: d.qc?.notes || '',
                        qaGradedByName: d.qa?.gradedByName || '',
                        qcGradedByName: d.qc?.gradedByName || '',
                        performanceMonth: d.month || currentMonthKey
                    };
                    if (window.tutorData) Object.assign(window.tutorData, bd);
                    updateScoreDisplay(comb2, bd);
                }
            });
        }

        checkWinnerStatus(tutorId);

    } catch (error) {
        console.error("Gamification Error:", error);
    }
}

/**
 * Checks if the current user is the winner and handles the celebration logic.
 */
async function checkWinnerStatus(tutorId) {
    try {
        const cycleRef = doc(db, "gamification", "current_cycle");
        const cycleSnap = await getDoc(cycleRef);

        if (cycleSnap.exists()) {
            const data = cycleSnap.data();
            if (data.winnerId === tutorId) {
                isTutorOfTheMonth = true;
                renderWinnerBadge(data.monthLabel || data.month);

                // Confetti only on first 5 days of the month
                const lagosNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
                const dayOfMonth = lagosNow.getDate();
                const currentMonthKey = `${lagosNow.getFullYear()}-${String(lagosNow.getMonth()+1).padStart(2,'0')}`;
                const winnerMonth = data.month || '';
                
                // Only show celebration if within first 5 days of the matching month
                if (dayOfMonth <= 5 && (currentMonthKey === winnerMonth || winnerMonth === '')) {
                    const celebKey = `confetti_shown_${currentMonthKey}_${tutorId}`;
                    if (!sessionStorage.getItem(celebKey)) {
                        sessionStorage.setItem(celebKey, 'true');
                        setTimeout(() => {
                            triggerConfetti();
                            showCustomAlert(`🏆 Congratulations! You are the ${escapeHtml(data.monthLabel || data.month)} Tutor of the Month!`);
                        }, 800);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Winner Check Error:", error);
    }
}

// --- UI RENDERING FUNCTIONS ---

function updateScoreDisplay(totalScore, breakdown = {}) {
    const scoreWidget = document.getElementById('performance-widget');
    if (!scoreWidget) return;

    let scoreColor = 'text-red-500', barColor = 'from-red-400 to-red-500';
    if (totalScore >= 65) { scoreColor = 'text-yellow-500'; barColor = 'from-yellow-400 to-yellow-500'; }
    if (totalScore >= 85) { scoreColor = 'text-green-600'; barColor = 'from-green-400 to-green-600'; }

    // Accept grading details either via breakdown param (real-time) or window.tutorData (fallback)
    const td = window.tutorData || {};
    const qaScore      = breakdown.qaScore      ?? td.qaScore      ?? null;
    const qcScore      = breakdown.qcScore      ?? td.qcScore      ?? null;
    const qaAdvice     = breakdown.qaAdvice     ?? td.qaAdvice     ?? '';
    const qcAdvice     = breakdown.qcAdvice     ?? td.qcAdvice     ?? '';
    const qaGraderName = breakdown.qaGradedByName ?? td.qaGradedByName ?? '';
    const qcGraderName = breakdown.qcGradedByName ?? td.qcGradedByName ?? '';
    const perfMonth    = breakdown.performanceMonth ?? td.performanceMonth ?? '';

    function scoreBadge(score, label, graderName, advice, themeClass) {
        if (score === null || score === undefined) return `
            <div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div class="text-xs font-bold ${themeClass} uppercase tracking-wide mb-1">${label}</div>
                <div class="text-gray-400 text-sm">Not graded yet</div>
            </div>`;
        let sc = 'text-red-500';
        if (score >= 65) sc = 'text-yellow-500';
        if (score >= 85) sc = 'text-green-600';
        return `
            <div class="bg-white rounded-xl p-3 border border-gray-200">
                <div class="flex justify-between items-center mb-1">
                    <div class="text-xs font-bold ${themeClass} uppercase tracking-wide">${label}</div>
                    ${graderName ? `<span class="text-xs text-gray-400">by ${escapeHtml(graderName)}</span>` : ''}
                </div>
                <div class="text-2xl font-black ${sc}">${score}<span class="text-sm">%</span></div>
                <div class="w-full bg-gray-100 rounded-full h-1.5 mt-1.5">
                    <div class="h-1.5 rounded-full bg-current transition-all duration-700 ${sc}" style="width:${score}%"></div>
                </div>
                ${advice ? `<div class="mt-2 text-xs text-gray-600 italic bg-gray-50 rounded-lg p-2 border border-gray-100">"${escapeHtml(advice)}"</div>` : ''}
            </div>`;
    }

    scoreWidget.innerHTML = `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden cursor-pointer" id="perf-card-inner">
            ${isTutorOfTheMonth ? '<div class="absolute top-0 right-0 bg-yellow-400 text-xs font-black px-2 py-1 rounded-bl-xl text-white">👑 TOP TUTOR</div>' : ''}
            <div class="p-4">
                <h3 class="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Performance Score ${perfMonth ? '· ' + perfMonth : ''}</h3>
                <div class="flex items-end gap-2 mb-3">
                    <span class="text-5xl font-black ${scoreColor}">${totalScore}</span>
                    <span class="text-gray-400 text-sm mb-1">/ 100%</span>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-2.5 mb-1">
                    <div class="bg-gradient-to-r ${barColor} h-2.5 rounded-full transition-all duration-1000" style="width:${Math.min(totalScore,100)}%"></div>
                </div>
                <p class="text-xs text-gray-400 text-right mb-3">Tap to see full breakdown ↓</p>
            </div>
            <!-- Expandable breakdown -->
            <div id="perf-breakdown" class="hidden border-t border-gray-100 p-4 space-y-3 bg-gray-50">
                <div class="grid grid-cols-2 gap-3">
                    ${scoreBadge(qaScore, 'QA – Session', qaGraderName, qaAdvice, 'text-purple-600')}
                    ${scoreBadge(qcScore, 'QC – Lesson Plan', qcGraderName, qcAdvice, 'text-amber-600')}
                </div>
                <p class="text-xs text-gray-400 text-center">Combined score = (QA + QC) ÷ 2</p>
            </div>
        </div>
    `;

    // Toggle breakdown on click
    document.getElementById('perf-card-inner')?.addEventListener('click', () => {
        const bd = document.getElementById('perf-breakdown');
        if (bd) bd.classList.toggle('hidden');
    });
}

function renderWinnerBadge(month) {
    // Inject a badge into the profile header or sidebar
    const header = document.querySelector('.header-profile-section'); // Adjust selector to match your HTML
    if (header) {
        const badge = document.createElement('div');
        badge.className = 'winner-badge animate-pulse bg-yellow-100 text-yellow-800 text-xs font-bold px-3 py-1 rounded-full border border-yellow-300 ml-2 flex items-center gap-1';
        badge.innerHTML = `<span>🏆</span> ${escapeHtml(month)} Top Tutor`;
        header.appendChild(badge);
    }
}

// --- VISUAL FX (Confetti Engine) ---
// No external library needed - Raw Canvas implementation for speed
function triggerConfetti() {
    const duration = 3000;
    const end = Date.now() + duration;

    // Simple confetti shim
    (function frame() {
        // Launch confetti from left and right edges
        confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });

        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}

// NOTE: You will need to include the lightweight canvas-confetti script in your HTML head for the FX to work:
// <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>

/*******************************************************************************
 * SECTION 14: ADMIN SETTINGS LISTENER (UPDATED – NO REDECLARATION)
 ******************************************************************************/

// Listen for changes to admin settings
const settingsDocRef = doc(db, "settings", "global_settings");
onSnapshot(settingsDocRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        
        // ✅ Existing flags – assign, do NOT redeclare
        isSubmissionEnabled     = data.isReportEnabled          ?? false;
        isTutorAddEnabled       = data.isTutorAddEnabled        ?? false;
        isSummerBreakEnabled    = data.isSummerBreakEnabled     ?? false;
        isBypassApprovalEnabled = data.bypassPendingApproval    ?? false;
        showStudentFees         = data.showStudentFees          ?? false;
        showEditDeleteButtons   = data.showEditDeleteButtons    ?? false;
        
        // 🆕 NEW FLAGS – you MUST declare these ONCE at the top of the file
        //    (see instructions below)
        isTransitionAddEnabled  = data.showTransitionButton     ?? true;
        isPreschoolAddEnabled   = data.preschoolAddTransition   ?? true;

        // Re‑render student database if it's currently visible
        const mainContent = document.getElementById('mainContent');
        if (mainContent && mainContent.querySelector('#student-list-view')) {
            renderStudentDatabase(mainContent, window.tutorData);
        }
    }
});

/*******************************************************************************
 * SECTION 17: COURSE MATERIALS UPLOAD (NEW TAB)
 * Allows tutors to upload and manage learning materials for their students.
 ******************************************************************************/

/**
 * Main render function for the Courses tab.
 */
async function renderCourses(container, tutor) {
    updateActiveTab('navCourses');
    
    container.innerHTML = `
        <div class="hero-section">
            <h1 class="hero-title">📚 Course Materials</h1>
            <p class="hero-subtitle">Upload and manage learning resources for your students</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left Panel: Student Selector & Upload Form -->
            <div class="lg:col-span-1">
                <div class="card">
                    <div class="card-header">
                        <h3 class="font-bold text-lg">➕ Add New Material</h3>
                    </div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label">Select Student</label>
                            <select id="material-student-select" class="form-input">
                                <option value="">— Choose a student —</option>
                            </select>
                        </div>

                        <div id="upload-form-container" class="space-y-3 mt-4 hidden">
                            <div class="form-group">
                                <label class="form-label">Title</label>
                                <input type="text" id="material-title" class="form-input" placeholder="e.g. Chapter 5 Worksheet">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Description (optional)</label>
                                <textarea id="material-description" class="form-input form-textarea" rows="2" placeholder="Brief description..."></textarea>
                            </div>
                            <div class="form-group">
                                <label class="form-label">File</label>
                                <input type="file" id="material-file" class="form-input" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.txt">
                                <p class="text-xs text-gray-500 mt-1">Max 10MB</p>
                            </div>
                            <button id="upload-material-btn" class="btn btn-primary w-full" disabled>Upload Material</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Panel: Material List -->
            <div class="lg:col-span-2">
                <div class="card">
                    <div class="card-header">
                        <h3 class="font-bold text-lg">📋 Materials for <span id="selected-student-name">selected student</span></h3>
                    </div>
                    <div class="card-body" id="materials-list-container">
                        <div class="text-center py-6 text-gray-500">
                            Select a student to view materials.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Load students into dropdown
    await loadStudentDropdownCourses(tutor.email);

    const studentSelect = document.getElementById('material-student-select');
    const uploadForm = document.getElementById('upload-form-container');
    const selectedStudentNameSpan = document.getElementById('selected-student-name');
    const materialsContainer = document.getElementById('materials-list-container');

    // When student changes
    studentSelect.addEventListener('change', async (e) => {
        const studentId = e.target.value;
        if (studentId) {
            uploadForm.classList.remove('hidden');
            const studentName = studentSelect.options[studentSelect.selectedIndex].text;
            selectedStudentNameSpan.textContent = studentName;
            await loadCourseMaterials(studentId, materialsContainer, tutor);
        } else {
            uploadForm.classList.add('hidden');
            selectedStudentNameSpan.textContent = 'selected student';
            materialsContainer.innerHTML = '<div class="text-center py-6 text-gray-500">Select a student to view materials.</div>';
        }
    });

    // Enable/disable upload button based on file selection and title
    const titleInput = document.getElementById('material-title');
    const fileInput = document.getElementById('material-file');
    const uploadBtn = document.getElementById('upload-material-btn');

    function checkUploadReady() {
        const titleOk = titleInput.value.trim() !== '';
        const fileOk = fileInput.files.length > 0;
        uploadBtn.disabled = !(titleOk && fileOk);
    }

    titleInput.addEventListener('input', checkUploadReady);
    fileInput.addEventListener('change', checkUploadReady);

    // Handle upload
    uploadBtn.addEventListener('click', async () => {
        const studentId = studentSelect.value;
        if (!studentId) return;

        const title = titleInput.value.trim();
        const description = document.getElementById('material-description').value.trim();
        const file = fileInput.files[0];

        if (!title || !file) {
            showCustomAlert('Please provide a title and select a file.');
            return;
        }

        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<span class="spinner-small"></span> Uploading...';

        try {
            await uploadCourseMaterial(file, studentId, tutor, title, description);
            showCustomAlert('✅ Material uploaded successfully!');
            
            // Reset form
            titleInput.value = '';
            document.getElementById('material-description').value = '';
            fileInput.value = '';
            checkUploadReady();

            // Refresh list
            await loadCourseMaterials(studentId, materialsContainer, tutor);
        } catch (error) {
            console.error('Upload error:', error);
            showCustomAlert('❌ Upload failed. Please try again.');
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = 'Upload Material';
        }
    });
}

/**
 * Load students for the courses dropdown.
 */
async function loadStudentDropdownCourses(tutorEmail) {
    try {
        const q = query(collection(db, "students"), where("tutorEmail", "==", tutorEmail));
        const snapshot = await getDocs(q);
        const select = document.getElementById('material-student-select');
        
        // Keep the first placeholder option
        select.innerHTML = '<option value="">— Choose a student —</option>';
        
        snapshot.forEach(doc => {
            const student = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${student.studentName} (${student.grade})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading students for courses:", error);
    }
}

/**
 * Upload a single file to Cloudinary and store metadata in Firestore.
 */
async function uploadCourseMaterial(file, studentId, tutor, title, description) {
    // 1. Upload to Cloudinary
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
    formData.append('folder', 'course_materials');
    formData.append('public_id', `material_${studentId}_${Date.now()}_${file.name.replace(/\.[^/.]+$/, "")}`);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`, {
        method: 'POST',
        body: formData
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.secure_url) throw new Error(uploadData.error?.message || 'Upload failed');

    // 2. Get student name
    const studentSnap = await getDoc(doc(db, "students", studentId));
    const studentName = studentSnap.exists() ? studentSnap.data().studentName : 'Unknown';

    // 3. Save to Firestore
    const materialData = {
        studentId,
        studentName,
        tutorId: tutor.id,
        tutorEmail: tutor.email,
        tutorName: tutor.name,
        title,
        description,
        fileUrl: uploadData.secure_url,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: new Date()
    };

    await addDoc(collection(db, "course_materials"), materialData);
}

/**
 * Load and display materials for a specific student.
 */
async function loadCourseMaterials(studentId, container, tutor) {
    container.innerHTML = '<div class="text-center py-6"><div class="spinner mx-auto"></div><p class="text-gray-500 mt-2">Loading materials...</p></div>';

    try {
        const q = query(
            collection(db, "course_materials"),
            where("studentId", "==", studentId),
            orderBy("uploadedAt", "desc")
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = '<div class="text-center py-6 text-gray-500">No materials uploaded yet.</div>';
            return;
        }

        let html = '<div class="space-y-3">';
        snapshot.forEach(doc => {
            const mat = doc.data();
            const date = mat.uploadedAt?.toDate ? mat.uploadedAt.toDate().toLocaleDateString() : 'Unknown';
            const size = formatFileSize(mat.fileSize || 0);

            html += `
                <div class="material-item border rounded-lg p-4 bg-white hover:shadow-sm transition">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <h4 class="font-semibold text-gray-800">${escapeHtml(mat.title)}</h4>
                            ${mat.description ? `<p class="text-sm text-gray-600 mt-1">${escapeHtml(mat.description)}</p>` : ''}
                            <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                <span>📄 ${escapeHtml(mat.fileName)}</span>
                                <span>⚖️ ${escapeHtml(size)}</span>
                                <span>📅 ${escapeHtml(date)}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 ml-4">
                            <a href="${escapeHtml(mat.fileUrl)}" target="_blank" class="btn btn-secondary btn-sm" title="Download">⬇️</a>
                            ${showEditDeleteButtons ? `<button class="btn btn-danger btn-sm delete-material" data-id="${escapeHtml(doc.id)}" title="Delete">🗑️</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;

        // Attach delete handlers if enabled
        if (showEditDeleteButtons) {
            container.querySelectorAll('.delete-material').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const materialId = e.target.getAttribute('data-id');
                    if (confirm('Delete this material? This action cannot be undone.')) {
                        try {
                            await deleteDoc(doc(db, "course_materials", materialId));
                            showCustomAlert('✅ Material deleted.');
                            await loadCourseMaterials(studentId, container, tutor);
                        } catch (error) {
                            console.error('Delete error:', error);
                            showCustomAlert('❌ Failed to delete material.');
                        }
                    }
                });
            });
        }
    } catch (error) {
        console.error('Error loading materials:', error);
        container.innerHTML = '<div class="text-center py-6 text-red-500">Failed to load materials.</div>';
    }
}

/*******************************************************************************
 * SECTION 15: MAIN APP INITIALIZATION (UPDATED)
 ******************************************************************************/

// Main App Initialization
document.addEventListener('DOMContentLoaded', async () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const tutorQuery = query(collection(db, "tutors"), where("email", "==", user.email.trim()));
            const querySnapshot = await getDocs(tutorQuery);
            
            if (!querySnapshot.empty) {
                const tutorDoc = querySnapshot.docs[0];
                const tutorData = { id: tutorDoc.id, ...tutorDoc.data() };
                
                // Check if tutor is inactive (block access)
                if (tutorData.status === 'inactive') {
                    await signOut(auth);
                    document.getElementById('mainContent').innerHTML = `
                        <div class="card">
                            <div class="card-body text-center">
                                <div class="text-red-400 text-4xl mb-3">🚫</div>
                                <h4 class="font-bold text-red-600 mb-2">Account Inactive</h4>
                                <p class="text-gray-500 mb-4">Your tutor account has been marked as inactive.</p>
                                <p class="text-sm text-gray-500">Please contact management for assistance.</p>
                                <a href="tutor-auth.html" class="btn btn-primary mt-4">Return to Login</a>
                            </div>
                        </div>`;
                    return;
                }
                
                window.tutorData = tutorData;
                
                if (shouldShowEmploymentPopup(tutorData)) {
                    showEmploymentDatePopup(tutorData);
                }
                
                if (shouldShowTINPopup(tutorData)) {
                    showTINPopup(tutorData);
                }
                
                renderTutorDashboard(document.getElementById('mainContent'), tutorData);
                
                // Initialize floating messaging and inbox buttons
                setTimeout(() => {
                    initializeFloatingMessagingButton();
                    updateUnreadMessageCount(); // Check for unread messages
                    
                    // Set up periodic refresh of unread count (every 30 seconds)
                    setInterval(updateUnreadMessageCount, 30000);
                }, 1000);
                
                setTimeout(async () => {
                    await initScheduleManager(tutorData);
                }, 2000);
            } else {
                console.error("No matching tutor found.");
                document.getElementById('mainContent').innerHTML = `
                    <div class="card">
                        <div class="card-body text-center">
                            <div class="text-red-400 text-4xl mb-3">⚠️</div>
                            <h4 class="font-bold text-red-600 mb-2">Error: No Tutor Profile Found</h4>
                            <p class="text-gray-500">No tutor profile found for your email.</p>
                        </div>
                    </div>`;
            }
        } else {
            window.location.href ='/tutor-auth.html';
        }
    });

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = 'tutor-auth.html';
            }).catch(error => {
                console.error("Error signing out:", error);
                showCustomAlert('❌ Error signing out. Please try again.');
            });
        });
    }

    // Navigation event listeners
    const addNavListener = (id, renderFunction) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', () => {
                if (window.tutorData) {
                    renderFunction(document.getElementById('mainContent'), window.tutorData);
                    // Ensure floating buttons stay visible
                    setTimeout(() => {
                        if (!document.querySelector('.floating-messaging-btn')) {
                            initializeFloatingMessagingButton();
                        }
                        updateUnreadMessageCount();
                    }, 100);
                }
            });
        }
    };

    addNavListener('navDashboard', renderTutorDashboard);
    addNavListener('navStudentDatabase', renderStudentDatabase);
    addNavListener('navAutoStudents', renderAutoRegisteredStudents);
    addNavListener('navScheduleManagement', renderScheduleManagement);
    addNavListener('navAcademic', renderAcademic);
    // NEW: Courses tab listener
    addNavListener('navCourses', renderCourses);
    
    // Add inbox navigation to the sidebar if it doesn't exist
    setTimeout(() => {
        const navInbox = document.getElementById('navInbox');
        if (!navInbox) {
            const sidebar = document.querySelector('.sidebar-nav');
            if (sidebar) {
                const inboxNav = document.createElement('li');
                inboxNav.id = 'navInbox';
                inboxNav.innerHTML = `
                    <a href="#" class="nav-link flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <span class="text-xl">📨</span>
                        <span>Inbox</span>
                    </a>
                `;
                sidebar.appendChild(inboxNav);
                
                inboxNav.addEventListener('click', () => {
                    if (window.tutorData) {
                        showInboxModal();
                    }
                });
            }
        }
    }, 500);

    // NEW: Add Courses navigation to the sidebar if it doesn't exist
    setTimeout(() => {
        const navCourses = document.getElementById('navCourses');
        if (!navCourses) {
            const sidebar = document.querySelector('.sidebar-nav');
            if (sidebar) {
                const coursesNav = document.createElement('li');
                coursesNav.id = 'navCourses';
                coursesNav.innerHTML = `
                    <a href="#" class="nav-link flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        <span class="text-xl">📚</span>
                        <span>Courses</span>
                    </a>
                `;
                sidebar.appendChild(coursesNav);
                
                coursesNav.addEventListener('click', () => {
                    if (window.tutorData) {
                        renderCourses(document.getElementById('mainContent'), window.tutorData);
                    }
                });
            }
        }
    }, 500);
});;



/*******************************************************************************
 * SECTION 16: GOOGLE CLASSROOM GRADING INTERFACE (FINAL)
 * UPDATES:
 *   - Fixed "Cannot read properties of undefined (reading 'seconds')" error.
 *   - Inbox now auto‑clears on the 4th day of the month – tutors only see
 *     submissions from the current month that are on/after the 4th.
 ******************************************************************************/

// ==========================================
// 1. HELPER: Homework Cutoff Date (4th of current month)
// ==========================================
/**
 * Returns the cutoff date: 4th day of current month at 00:00:00.
 * Submissions BEFORE this date are hidden from the inbox.
 */
function getHomeworkCutoffDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 4, 0, 0, 0);
}

// ==========================================
// 2. LOAD HOMEWORK INBOX (with auto‑clear & safe date handling)
// ==========================================
// ==========================================
// HOMEWORK INBOX — Student cards + accordion
// ==========================================
// Shows ALL assignments (any status) grouped by student.
// Each student card expands to show assignments grouped by month.
// Submitted (ungraded) items are highlighted so the tutor can act on them.
async function loadHomeworkInbox(tutorEmail) {
    const container = document.getElementById('homework-inbox-container');
    if (!container) return;
    container.innerHTML = '<div class="flex justify-center py-8"><div class="spinner"></div></div>';

    try {
        // Fetch ALL homework for this tutor (by email OR name, whichever returns data)
        let snap = await getDocs(query(
            collection(db, 'homework_assignments'),
            where('tutorEmail', '==', tutorEmail)
        ));
        if (snap.empty && window.tutorData?.name) {
            snap = await getDocs(query(
                collection(db, 'homework_assignments'),
                where('tutorName', '==', window.tutorData.name)
            ));
        }

        if (snap.empty) {
            container.innerHTML = `<div class="text-center py-10">
                <div class="text-4xl mb-3">📭</div>
                <p class="text-gray-500 font-medium">No homework records found.</p>
            </div>`;
            return;
        }

        // Group by student
        const byStudent = {}; // studentId → { name, items[] }
        snap.docs.forEach(d => {
            const hw = { id: d.id, ...d.data() };
            const sid = hw.studentId || hw.studentName || 'unknown';
            if (!byStudent[sid]) byStudent[sid] = { name: hw.studentName || 'Unknown Student', items: [] };
            byStudent[sid].items.push(hw);
        });

        const students = Object.values(byStudent).sort((a, b) => a.name.localeCompare(b.name));

        // Update inbox count badge
        const totalSubmitted = snap.docs.filter(d => d.data().status === 'submitted').length;
        const countBadge = document.getElementById('inbox-count');
        if (countBadge) countBadge.textContent = totalSubmitted > 0 ? `${totalSubmitted} pending` : '✓ all graded';

        // ── Render student cards ──
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-3';

        students.forEach(({ name, items }) => {
            const pendingCount = items.filter(i => i.status === 'submitted').length;
            const initials = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

            // Group items by month for this student
            const byMonth = {};
            items.forEach(hw => {
                const raw = hw.assignedAt || hw.createdAt || hw.uploadedAt;
                const date = raw?.toDate ? raw.toDate() : (raw?.seconds ? new Date(raw.seconds * 1000) : new Date(raw || ''));
                const mk = isNaN(date) ? 'Unknown' : `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
                if (!byMonth[mk]) byMonth[mk] = [];
                byMonth[mk].push({ ...hw, _date: date });
            });

            const sortedMonths = Object.keys(byMonth).sort((a,b) => b.localeCompare(a));

            // Build month accordions HTML
            const monthsHtml = sortedMonths.map(mk => {
                const [y, m] = mk === 'Unknown' ? ['?','?'] : mk.split('-');
                const monthLabel = mk === 'Unknown' ? 'Unknown Date' :
                    new Date(parseInt(y), parseInt(m)-1, 1).toLocaleString('en-NG', { month:'long', year:'numeric' });
                const mItems = byMonth[mk].sort((a,b) => (b._date - a._date));

                const itemsHtml = mItems.map(hw => {
                    const statusColors = {
                        submitted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                        graded:    'bg-green-100  text-green-800  border-green-200',
                        assigned:  'bg-blue-100   text-blue-800   border-blue-200'
                    };
                    const statusColor = statusColors[hw.status] || 'bg-gray-100 text-gray-600 border-gray-200';
                    const statusLabel = { submitted:'⏳ Submitted', graded:'✅ Graded', assigned:'📋 Assigned' }[hw.status] || hw.status;
                    const dateStr = hw._date && !isNaN(hw._date) ? hw._date.toLocaleDateString('en-NG', {day:'2-digit', month:'short', year:'numeric'}) : '—';
                    const isSubmitted = hw.status === 'submitted';

                    return `<div class="flex items-center gap-3 p-3 rounded-xl ${isSubmitted ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-100'} hover:shadow-sm transition-all">
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-gray-800 text-sm truncate">${escapeHtml(hw.title || 'Untitled')}</p>
                            <p class="text-xs text-gray-400">${dateStr}${hw.score != null ? ` · Score: ${hw.score}/100` : ''}</p>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0">
                            <span class="text-xs font-bold px-2 py-0.5 rounded-full border ${statusColor}">${statusLabel}</span>
                            ${isSubmitted ? `<button onclick="openGradingModal('${escapeHtml(hw.id)}')" class="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 font-semibold transition-colors">Grade</button>` :
                              hw.status === 'graded' ? `<button onclick="openGradingModal('${escapeHtml(hw.id)}')" class="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-50 font-semibold transition-colors">Review</button>` : ''}
                        </div>
                    </div>`;
                }).join('');

                const monthPending = mItems.filter(i => i.status === 'submitted').length;
                return `<details class="border border-gray-100 rounded-xl overflow-hidden mt-2">
                    <summary class="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 list-none select-none bg-white">
                        <span class="text-sm font-semibold text-gray-700 flex-1">${escapeHtml(monthLabel)}</span>
                        ${monthPending > 0 ? `<span class="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">${monthPending} pending</span>` : ''}
                        <span class="text-xs text-gray-400">${mItems.length} item${mItems.length !== 1 ? 's' : ''}</span>
                        <i class="fas fa-chevron-down text-gray-300 text-xs ml-1"></i>
                    </summary>
                    <div class="p-3 space-y-2 bg-white border-t border-gray-100">${itemsHtml}</div>
                </details>`;
            }).join('');

            // Student card (outer accordion)
            const card = document.createElement('details');
            card.className = 'bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all';
            if (pendingCount > 0) card.open = true; // auto-expand if has pending
            card.innerHTML = `
                <summary class="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 list-none select-none">
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                         style="background:linear-gradient(135deg,#3b82f6,#1d4ed8)">${escapeHtml(initials)}</div>
                    <div class="flex-1 min-w-0">
                        <p class="font-bold text-gray-800">${escapeHtml(name)}</p>
                        <p class="text-xs text-gray-400">${items.length} total assignment${items.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        ${pendingCount > 0 ? `<span class="bg-yellow-500 text-white text-xs px-3 py-1 rounded-full font-bold">⏳ ${pendingCount} to grade</span>` : '<span class="text-xs text-green-600 font-semibold">✓ All reviewed</span>'}
                        <i class="fas fa-chevron-down text-gray-300 text-xs"></i>
                    </div>
                </summary>
                <div class="px-4 pb-4 border-t border-gray-100 bg-gray-50">${monthsHtml}</div>
            `;
            wrapper.appendChild(card);
        });

        container.innerHTML = '';
        container.appendChild(wrapper);

    } catch (error) {
        console.error('Inbox Error:', error);
        container.innerHTML = `<p class="text-red-500 text-center py-6">Error loading inbox: ${escapeHtml(error.message)}</p>`;
    }
}

// ==========================================
// 3. OPEN GRADING MODAL (unchanged – safe)
// ==========================================
async function openGradingModal(homeworkId) {
    let hwData;
    try {
        const docSnap = await getDoc(doc(db, "homework_assignments", homeworkId));
        if (!docSnap.exists()) return alert("Assignment not found");
        hwData = { id: docSnap.id, ...docSnap.data() };
    } catch (e) { return alert("Error loading assignment"); }

    const modal = document.createElement('div');
    modal.className = 'gc-grading-overlay';
    
    const hasFile = hwData.submissionUrl && hwData.submissionUrl.length > 5;
    const fileArea = hasFile ? 
        `<div class="gc-file-preview"><div class="gc-file-icon">📄</div><div class="mb-2 font-medium">Student Submission</div><a href="${escapeHtml(hwData.submissionUrl)}" target="_blank" class="gc-download-btn">View File</a></div>` : 
        `<div class="gc-file-preview"><div class="gc-file-icon">⚠️</div><div class="text-gray-500">No file attached</div></div>`;

    modal.innerHTML = `
        <div class="gc-grading-container">
            <header class="gc-grading-header">
                <div class="flex items-center">
                    <button class="mr-4 text-gray-500 hover:text-gray-800 text-2xl" onclick="this.closest('.gc-grading-overlay').remove()">✕</button>
                    <div><span class="gc-student-name">${escapeHtml(hwData.studentName)}</span><span class="gc-assignment-title"> ➤ ${escapeHtml(hwData.title)}</span></div>
                </div>
            </header>
            <div class="gc-grading-body">
                <div class="gc-work-panel">
                    ${fileArea}
                    <div class="w-full max-w-2xl mt-6 border-t pt-4">
                        <div class="text-xs font-bold text-gray-500 uppercase mb-2">Original Instructions</div>
                        <div class="text-gray-700 text-sm">${escapeHtml(hwData.description)}</div>
                        ${hwData.fileUrl ? `<div class="mt-2"><a href="${escapeHtml(hwData.fileUrl)}" target="_blank" class="text-blue-600 text-xs hover:underline">View Assignment Reference</a></div>` : ''}
                    </div>
                </div>
                <div class="gc-grading-sidebar">
                    <div class="mb-6">
                        <label class="font-medium text-gray-700 block mb-2">Grade</label>
                        <div class="flex items-center gap-2">
                            <input type="number" id="gc-score-input" class="gc-grade-input" min="0" max="100" value="${escapeHtml(hwData.score || '')}">
                            <span class="text-gray-500 text-sm">/ 100</span>
                        </div>
                    </div>
                    <div class="flex-1 flex flex-col">
                        <label class="font-medium text-gray-700">Private Comments</label>
                        <textarea id="gc-feedback-input" class="gc-comment-box" placeholder="Add feedback...">${escapeHtml(hwData.feedback || '')}</textarea>
                    </div>
                    <div class="gc-action-footer">
                        <button id="gc-return-btn" class="gc-return-btn">Return</button>
                    </div>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modal);

    modal.querySelector('#gc-return-btn').onclick = async function() {
        const btn = this;
        const score = modal.querySelector('#gc-score-input').value;
        const feedback = modal.querySelector('#gc-feedback-input').value;

        if (!score && !confirm("Return without a numerical grade?")) return;

        btn.innerText = "Returning...";
        btn.disabled = true;

        try {
            await updateDoc(doc(db, "homework_assignments", homeworkId), {
                score: score,
                feedback: feedback,
                status: 'graded',
                gradedAt: new Date(),
                tutorEmail: window.tutorData.email // Ensure this is tracked for history
            });

            modal.remove();
            showCustomAlert(`✅ Returned to ${escapeHtml(hwData.studentName)}`);
            loadHomeworkInbox(window.tutorData.email); // Refresh inbox
        } catch (error) {
            console.error(error);
            showCustomAlert("Error returning assignment");
            btn.innerText = "Return";
            btn.disabled = false;
        }
    };
}

// ==========================================
// 4. DASHBOARD WIDGET INJECTOR (unchanged)
// ==========================================
const inboxObserver = new MutationObserver(() => {
    // Only run if we are on the Dashboard tab (unique element present)
    if (!document.getElementById('pendingReportsContainer')) return;

    const hero = document.querySelector('.hero-section');
    if (hero && !document.getElementById('homework-inbox-section')) {
        const div = document.createElement('div');
        div.id = 'homework-inbox-section';
        div.className = 'mt-6 mb-8 fade-in';
        div.innerHTML = `
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">📥 Homework Inbox</h3>
                <button onclick="loadHomeworkInbox(window.tutorData.email)" class="text-sm text-blue-600 hover:underline">Refresh</button>
            </div>
            <div id="homework-inbox-container"></div>
        `;
        hero.after(div);
        if (window.tutorData) loadHomeworkInbox(window.tutorData.email);
    }
});
inboxObserver.observe(document.body, { childList: true, subtree: true });

// ==========================================
// 5. EXPOSE FUNCTIONS TO WINDOW (for onclick handlers)
// ==========================================
window.loadHomeworkInbox = loadHomeworkInbox;
window.openGradingModal = openGradingModal;
window.showDailyTopicModal = showDailyTopicModal;
window.showHomeworkModal = showHomeworkModal;
window.showScheduleCalendarModal = showScheduleCalendarModal;
window.renderCourses = renderCourses;
window.loadCourseMaterials = loadCourseMaterials;
window.uploadCourseMaterial = uploadCourseMaterial;
