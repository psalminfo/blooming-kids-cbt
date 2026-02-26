/*******************************************************************************
 * SECTION 1: IMPORTS & INITIAL SETUP
 * GitHub: https://github.com/psalminfo/blooming-kids-cbt/blob/main/tutor.js
 ******************************************************************************/

import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, deleteDoc, setDoc, deleteField, orderBy, onSnapshot, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

// ----- PLACEMENT TEST ELIGIBILITY (Grades 3-12 only) -----
/**
 * Returns true if the student's grade is within the placement-test range (3–12).
 * Handles formats such as "Grade 5", "grade5", "5", "Grade 12", "Pre-College", etc.
 */
function isPlacementTestEligible(grade) {
    if (!grade) return false;
    const normalized = String(grade).toLowerCase().replace('grade', '').trim();
    const num = parseInt(normalized, 10);
    return !isNaN(num) && num >= 3 && num <= 12;
}

// ----- COUNTRY FROM PHONE NUMBER (detects country via dialing code) -----
function getCountryFromPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.toString().trim().replace(/[\s\-().]/g, '');
    let w = cleaned;
    if (!w.startsWith('+')) {
        if (w.startsWith('0') && w.length >= 10) w = '+234' + w.substring(1);
        else if (w.startsWith('234') && w.length >= 12) w = '+' + w;
        else w = '+' + w;
    }
    const MAP = [
        ['+355','Albania'],['+213','Algeria'],['+244','Angola'],['+374','Armenia'],
        ['+994','Azerbaijan'],['+973','Bahrain'],['+880','Bangladesh'],['+375','Belarus'],
        ['+229','Benin'],['+591','Bolivia'],['+387','Bosnia'],['+267','Botswana'],
        ['+673','Brunei'],['+226','Burkina Faso'],['+855','Cambodia'],['+237','Cameroon'],
        ['+236','CAR'],['+235','Chad'],['+269','Comoros'],['+243','DR Congo'],
        ['+242','Congo'],['+506','Costa Rica'],['+385','Croatia'],['+357','Cyprus'],
        ['+253','Djibouti'],['+593','Ecuador'],['+503','El Salvador'],['+291','Eritrea'],
        ['+372','Estonia'],['+268','Eswatini'],['+251','Ethiopia'],['+679','Fiji'],
        ['+241','Gabon'],['+220','Gambia'],['+995','Georgia'],['+233','Ghana'],
        ['+502','Guatemala'],['+224','Guinea'],['+245','Guinea-Bissau'],['+592','Guyana'],
        ['+509','Haiti'],['+504','Honduras'],['+354','Iceland'],['+964','Iraq'],
        ['+972','Israel'],['+962','Jordan'],['+254','Kenya'],['+965','Kuwait'],
        ['+996','Kyrgyzstan'],['+856','Laos'],['+371','Latvia'],['+961','Lebanon'],
        ['+266','Lesotho'],['+231','Liberia'],['+218','Libya'],['+370','Lithuania'],
        ['+352','Luxembourg'],['+261','Madagascar'],['+265','Malawi'],['+960','Maldives'],
        ['+223','Mali'],['+356','Malta'],['+222','Mauritania'],['+230','Mauritius'],
        ['+373','Moldova'],['+976','Mongolia'],['+382','Montenegro'],['+212','Morocco'],
        ['+258','Mozambique'],['+264','Namibia'],['+977','Nepal'],['+505','Nicaragua'],
        ['+227','Niger'],['+234','Nigeria'],['+968','Oman'],['+507','Panama'],
        ['+595','Paraguay'],['+974','Qatar'],['+250','Rwanda'],['+966','Saudi Arabia'],
        ['+221','Senegal'],['+381','Serbia'],['+232','Sierra Leone'],['+252','Somalia'],
        ['+211','South Sudan'],['+249','Sudan'],['+255','Tanzania'],['+228','Togo'],
        ['+216','Tunisia'],['+256','Uganda'],['+971','UAE'],['+598','Uruguay'],
        ['+998','Uzbekistan'],['+967','Yemen'],['+260','Zambia'],['+263','Zimbabwe'],
        ['+20','Egypt'],['+27','South Africa'],['+30','Greece'],['+31','Netherlands'],
        ['+32','Belgium'],['+33','France'],['+34','Spain'],['+36','Hungary'],
        ['+39','Italy'],['+40','Romania'],['+41','Switzerland'],['+43','Austria'],
        ['+44','United Kingdom'],['+45','Denmark'],['+46','Sweden'],['+47','Norway'],
        ['+48','Poland'],['+49','Germany'],['+51','Peru'],['+52','Mexico'],
        ['+54','Argentina'],['+55','Brazil'],['+56','Chile'],['+57','Colombia'],
        ['+58','Venezuela'],['+60','Malaysia'],['+61','Australia'],['+62','Indonesia'],
        ['+63','Philippines'],['+64','New Zealand'],['+65','Singapore'],['+66','Thailand'],
        ['+81','Japan'],['+82','South Korea'],['+84','Vietnam'],['+86','China'],
        ['+90','Turkey'],['+91','India'],['+92','Pakistan'],['+94','Sri Lanka'],
        ['+95','Myanmar'],['+98','Iran'],['+1','United States'],['+7','Russia'],
    ];
    for (const [code, country] of MAP) { if (w.startsWith(code)) return country; }
    return '';
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
function updateActiveTab(activeTabId) {
    const navTabs = ['navDashboard', 'navStudentDatabase', 'navScheduleManagement', 'navAcademic', 'navCourses'];
    navTabs.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.classList.toggle('active', tabId === activeTabId);
        }
    });

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
 * SECTION 4B: PERSISTENT CLOCK (shows on every tab)
 ******************************************************************************/

/**
 * Injects or updates the Lagos time clock in a fixed top-right bar.
 * Survives tab switches because it lives in the body, not in mainContent.
 * Call this from every renderXxx function.
 */
function startPersistentClock() {
    let clockBar = document.getElementById('tutor-persistent-clock-bar');
    if (!clockBar) {
        clockBar = document.createElement('div');
        clockBar.id = 'tutor-persistent-clock-bar';
        clockBar.style.cssText = [
            'position:fixed','top:0','right:0','z-index:9999',
            'background:rgba(37,99,235,0.92)','color:#fff',
            'padding:4px 14px','font-size:0.78rem','font-weight:600',
            'border-bottom-left-radius:8px','letter-spacing:0.02em',
            'backdrop-filter:blur(4px)','pointer-events:none'
        ].join(';');
        document.body.appendChild(clockBar);
    }

    function formatLagos() {
        return new Intl.DateTimeFormat('en-NG', {
            weekday:'short', day:'numeric', month:'short', year:'numeric',
            hour:'2-digit', minute:'2-digit', second:'2-digit',
            hour12: true, timeZone:'Africa/Lagos'
        }).format(new Date()) + ' (WAT)';
    }

    clockBar.textContent = formatLagos();
    if (window._persistentClockInterval) clearInterval(window._persistentClockInterval);
    window._persistentClockInterval = setInterval(() => {
        const el = document.getElementById('tutor-persistent-clock-bar');
        if (el) el.textContent = formatLagos();
        else clearInterval(window._persistentClockInterval);
    }, 1000);
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
 * SECTION 5B: STUDENT FETCH HELPER
 * Management assigns students by writing tutorId. Tutor portal queries tutorEmail.
 * This helper runs BOTH queries and merges, so both methods work.
 ******************************************************************************/

async function fetchStudentsForTutor(tutor, col) {
    col = col || "students";
    try {
        var colRef = collection(db, col);
        var byIdPromise = tutor.id
            ? getDocs(query(colRef, where("tutorId", "==", tutor.id)))
            : Promise.resolve({ docs: [] });
        var snaps = await Promise.all([
            getDocs(query(colRef, where("tutorEmail", "==", tutor.email))),
            byIdPromise
        ]);
        var seen = new Set();
        var results = [];
        snaps[0].docs.concat(snaps[1].docs).forEach(function(d) {
            if (!seen.has(d.id)) {
                seen.add(d.id);
                results.push(Object.assign({ id: d.id, collection: col }, d.data()));
            }
        });
        return results;
    } catch (err) {
        console.error("fetchStudentsForTutor error:", err);
        return [];
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
            // Fetch by tutorEmail AND tutorId (management assigns via tutorId)
            const fetchedStudents = await fetchStudentsForTutor(this.tutor, "students");
            
            this.students = [];
            this.scheduledStudentIds.clear();

            fetchedStudents.forEach(student => {
                this.students.push(student);
                
                if (student.schedule && Array.isArray(student.schedule) && student.schedule.length > 0) {
                    this.scheduledStudentIds.add(student.id);
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

        // Avatar colour keyed by first char of name
        const AVATAR_PALETTE = ['#6366f1','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#db2777'];
        const avatarBg = AVATAR_PALETTE[(this.activeStudent.studentName||'').charCodeAt(0) % AVATAR_PALETTE.length];
        const initials = (this.activeStudent.studentName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

        // Construct HTML (escape student name)
        const html = `
            <div style="position:fixed;inset:0;z-index:9000;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:16px;" id="schedule-modal">
                <div style="background:#fff;border-radius:20px;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.4);overflow:hidden;">

                    <!-- Gradient header with avatar -->
                    <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:20px 24px;display:flex;align-items:center;gap:14px;flex-shrink:0;">
                        <div style="width:46px;height:46px;border-radius:14px;background:${avatarBg};color:#fff;font-weight:800;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.3);">${escapeHtml(initials)}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="color:#fff;font-weight:800;font-size:1.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(this.activeStudent.studentName)}</div>
                            <div style="color:#93c5fd;font-size:.78rem;margin-top:2px;">${escapeHtml(this.activeStudent.grade||'')}${this.activeStudent.subjects?.length?' · '+escapeHtml(this.activeStudent.subjects.join(', ')):''}</div>
                        </div>
                        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                            ${remaining>1?`<span style="background:rgba(255,255,255,.2);color:#fff;font-size:.73rem;font-weight:700;padding:4px 10px;border-radius:999px;">${remaining} in queue</span>`:''}
                            <button class="close-trigger" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:34px;height:34px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
                        </div>
                    </div>

                    <!-- Info strip -->
                    <div style="background:#f0f9ff;border-bottom:1px solid #bae6fd;padding:9px 22px;font-size:.8rem;color:#0369a1;font-weight:600;flex-shrink:0;">
                        📅 Set weekly class times for this student — multiple slots allowed
                    </div>

                    <!-- Scrollable time slots -->
                    <div id="schedule-entries" style="flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:10px;"></div>

                    <!-- Add slot button -->
                    <div style="padding:0 18px 12px;flex-shrink:0;">
                        <button id="add-time-btn" style="width:100%;padding:11px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;color:#475569;font-size:.875rem;font-weight:600;cursor:pointer;">＋ Add Another Time Slot</button>
                    </div>

                    <!-- Footer actions -->
                    <div style="border-top:1px solid #f1f5f9;padding:14px 18px;display:grid;grid-template-columns:auto 1fr 1fr;gap:8px;align-items:center;background:#f8fafc;flex-shrink:0;">
                        <div style="display:flex;gap:6px;">
                            <button id="delete-sched-btn" title="Delete schedule" style="background:#fee2e2;border:none;color:#dc2626;padding:10px 14px;border-radius:10px;font-size:.9rem;cursor:pointer;">🗑️</button>
                            <button id="skip-btn" style="background:#f1f5f9;border:none;color:#64748b;padding:10px 14px;border-radius:10px;font-size:.8rem;font-weight:600;cursor:pointer;">Skip →</button>
                        </div>
                        <button id="save-btn" style="background:#f1f5f9;border:1px solid #e2e8f0;color:#374151;padding:11px;border-radius:12px;font-size:.875rem;font-weight:700;cursor:pointer;">💾 Save</button>
                        <button id="save-next-btn" style="background:linear-gradient(135deg,#059669,#047857);border:none;color:#fff;padding:11px;border-radius:12px;font-size:.875rem;font-weight:700;cursor:pointer;">${remaining>1?'✅ Save & Next →':'✅ Save & Done'}</button>
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
        const day   = data?.day   || 'Monday';
        const start = data?.start || '09:00';
        const end   = data?.end   || '10:00';

        const DAY_STYLES = {
            Monday:    { bg:'#eff6ff', border:'#bfdbfe', dot:'#3b82f6', accent:'#1d4ed8' },
            Tuesday:   { bg:'#f5f3ff', border:'#ddd6fe', dot:'#8b5cf6', accent:'#6d28d9' },
            Wednesday: { bg:'#ecfdf5', border:'#a7f3d0', dot:'#10b981', accent:'#065f46' },
            Thursday:  { bg:'#fff7ed', border:'#fed7aa', dot:'#f97316', accent:'#9a3412' },
            Friday:    { bg:'#fdf4ff', border:'#f3e8ff', dot:'#a855f7', accent:'#6b21a8' },
            Saturday:  { bg:'#fefce8', border:'#fef08a', dot:'#f59e0b', accent:'#92400e' },
            Sunday:    { bg:'#fff1f2', border:'#fecdd3', dot:'#f43f5e', accent:'#9f1239' },
        };

        const S = DAY_STYLES[day] || { bg:'#f8fafc', border:'#e2e8f0', dot:'#94a3b8', accent:'#475569' };
        const selSt = 'width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.85rem;font-weight:600;color:#1e293b;background:#fff;outline:none;cursor:pointer;';
        const dayOpts  = this.DAYS.map(d=>`<option value="${escapeHtml(d)}" ${d===day?'selected':''}>${escapeHtml(d)}</option>`).join('');
        const timeOpts = sel => this.TIME_SLOTS.map(s=>`<option value="${escapeHtml(s.value)}" ${s.value===sel?'selected':''}>${escapeHtml(s.label)}</option>`).join('');

        const row = document.createElement('div');
        row.style.cssText = `background:${S.bg};border:1.5px solid ${S.border};border-radius:14px;padding:13px 15px;transition:all .15s;`;
        row.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <div style="display:flex;align-items:center;gap:7px;">
                    <span class="row-dot" style="width:9px;height:9px;border-radius:50%;background:${S.dot};display:inline-block;flex-shrink:0;"></span>
                    <span class="row-day-lbl" style="font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:${S.accent};">${escapeHtml(day)}</span>
                </div>
                <button class="remove-row-btn" style="background:#fee2e2;border:none;color:#ef4444;width:28px;height:28px;border-radius:8px;font-size:.8rem;cursor:pointer;font-weight:700;">✕</button>
            </div>
            <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:10px;">
                <div>
                    <label style="display:block;font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Day</label>
                    <select class="day-select" style="${selSt}">${dayOpts}</select>
                </div>
                <div>
                    <label style="display:block;font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Starts</label>
                    <select class="start-select" style="${selSt}">${timeOpts(start)}</select>
                </div>
                <div>
                    <label style="display:block;font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Ends</label>
                    <select class="end-select" style="${selSt}">${timeOpts(end)}</select>
                </div>
            </div>
        `;

        // Live day colour update on select change
        const daySelect = row.querySelector('.day-select');
        daySelect.addEventListener('change', () => {
            const d = daySelect.value;
            const s = DAY_STYLES[d] || { bg:'#f8fafc', border:'#e2e8f0', dot:'#94a3b8', accent:'#475569' };
            row.style.background   = s.bg;
            row.style.borderColor  = s.border;
            row.querySelector('.row-dot').style.background    = s.dot;
            row.querySelector('.row-day-lbl').style.color     = s.accent;
            row.querySelector('.row-day-lbl').textContent     = d;
        });

        container.appendChild(row);

        row.querySelector('.remove-row-btn').addEventListener('click', () => {
            if (container.children.length > 1) row.remove();
            else this.showAlert('At least one time slot is required.', 'error');
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
                    <div class="form-group">
                        <label class="form-label">Description * <span style="font-size:.72rem;color:#6b7280;font-weight:400;">(URLs will become clickable links)</span></label>
                        <textarea id="hw-description" class="form-input form-textarea" required placeholder="Enter instructions... Paste links like https://example.com and they'll be clickable."></textarea>
                    </div>
                    <div class="form-group"><label class="form-label">Due Date *</label><input type="date" id="hw-due-date" class="form-input" max="${escapeHtml(maxDate)}" required></div>
                    <div class="form-group">
                        <label class="form-label">Files (Max 5 — any format accepted)</label>
                        <!-- Drag & Drop Zone -->
                        <div id="hw-drop-zone" style="border:2px dashed #93c5fd;border-radius:12px;padding:20px 16px;text-align:center;cursor:pointer;transition:all .2s;background:#eff6ff;position:relative;">
                            <input type="file" id="hw-file" class="hidden" multiple accept="*/*">
                            <div style="pointer-events:none;">
                                <div style="font-size:2rem;margin-bottom:6px;">📎</div>
                                <div style="font-weight:700;color:#1d4ed8;font-size:.9rem;">Drag &amp; drop any files here</div>
                                <div style="color:#6b7280;font-size:.78rem;margin-top:4px;">PDF, DOC, DOCX, images, videos, zip — anything</div>
                                <label for="hw-file" style="display:inline-block;margin-top:10px;padding:6px 18px;background:#2563eb;color:#fff;border-radius:8px;font-size:.8rem;font-weight:700;cursor:pointer;pointer-events:all;">Browse Files</label>
                            </div>
                        </div>
                        <!-- Google Drive link input -->
                        <div style="margin-top:10px;display:flex;gap:8px;align-items:center;">
                            <span style="font-size:1.1rem;">🔗</span>
                            <input type="text" id="hw-drive-link" placeholder="Or paste a Google Drive / YouTube / any link here…" style="flex:1;border:1.5px solid #e2e8f0;border-radius:8px;padding:7px 10px;font-size:.82rem;outline:none;">
                            <button type="button" id="hw-drive-add-btn" style="padding:7px 14px;background:#4285f4;color:#fff;border:none;border-radius:8px;font-size:.8rem;font-weight:700;cursor:pointer;white-space:nowrap;">Add Link</button>
                        </div>
                        <div id="file-list-preview" class="hidden mt-2">
                            <ul id="file-list-ul" style="list-style:none;padding:0;margin:0;"></ul>
                            <button id="remove-all-files-btn" class="btn btn-danger btn-sm w-full mt-2">Clear All</button>
                        </div>
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

    // File Handling — drag & drop + click + Google Drive links
    const fileInput = document.getElementById('hw-file');
    const fileListUl = document.getElementById('file-list-ul');
    const dropZone = document.getElementById('hw-drop-zone');

    // Linkify helper — turns raw URLs in text into <a> tags
    function linkifyText(text) {
        if (!text) return '';
        const escaped = escapeHtml(text);
        return escaped.replace(
            /(https?:\/\/[^\s&"<>]+)/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;word-break:break-all;">$1</a>'
        );
    }
    window._hwLinkify = linkifyText; // expose for inbox renderer

    // Drag & Drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.background = '#dbeafe';
        dropZone.style.borderColor = '#2563eb';
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.style.background = '#eff6ff';
        dropZone.style.borderColor = '#93c5fd';
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '#eff6ff';
        dropZone.style.borderColor = '#93c5fd';
        const files = Array.from(e.dataTransfer.files);
        addFiles(files);
    });

    function addFiles(files) {
        if (selectedFiles.length + files.length > 5) { showCustomAlert('Max 5 files total.'); return; }
        files.forEach(f => {
            if (f.size <= 50 * 1024 * 1024) selectedFiles.push({ file: f, name: f.name, isLink: false });
            else showCustomAlert(`Skipped "${f.name}" — max 50 MB per file.`);
        });
        renderFiles();
    }

    fileInput.addEventListener('change', (e) => {
        addFiles(Array.from(e.target.files));
        fileInput.value = '';
    });

    // Google Drive / any link
    document.getElementById('hw-drive-add-btn').addEventListener('click', () => {
        const linkInput = document.getElementById('hw-drive-link');
        const url = linkInput.value.trim();
        if (!url) { showCustomAlert('Please paste a link first.'); return; }
        if (!/^https?:\/\//i.test(url)) { showCustomAlert('Please enter a valid URL starting with http:// or https://'); return; }
        if (selectedFiles.length >= 5) { showCustomAlert('Max 5 attachments.'); return; }
        const name = url.includes('drive.google.com') ? '🔗 Google Drive file' :
                     url.includes('youtube.com') || url.includes('youtu.be') ? '▶️ YouTube video' : '🔗 ' + url.substring(0, 50);
        selectedFiles.push({ file: null, name, url, isLink: true });
        linkInput.value = '';
        renderFiles();
    });

    function renderFiles() {
        const preview = document.getElementById('file-list-preview');
        if (selectedFiles.length === 0) { preview.classList.add('hidden'); return; }
        preview.classList.remove('hidden');
        fileListUl.innerHTML = '';
        selectedFiles.forEach((item, i) => {
            const li = document.createElement('li');
            li.className = "flex justify-between bg-white p-1 mb-1 border rounded text-sm";
            const icon = item.isLink ? '🔗' : '📄';
            li.innerHTML = `<span>${icon} ${escapeHtml(item.name)}</span><span class="text-red-500 cursor-pointer remove-file-btn" data-index="${i}">✕</span>`;
            fileListUl.appendChild(li);
        });
        fileListUl.querySelectorAll('.remove-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                selectedFiles.splice(parseInt(e.target.dataset.index), 1);
                renderFiles();
            });
        });
    }
    document.getElementById('remove-all-files-btn').addEventListener('click', () => { selectedFiles = []; fileInput.value = ''; renderFiles(); });
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
            saveBtn.innerHTML = `Uploading files...`;
            let attachments = [];
            if (selectedFiles.length > 0) {
                try {
                    for (const item of selectedFiles) {
                        if (item.isLink) {
                            // Google Drive / URL link — no upload needed
                            attachments.push({ url: item.url, name: item.name, size: 0, type: 'link', isLink: true });
                        } else {
                            // Real file — upload to Cloudinary
                            const res = await uploadToCloudinary(item.file, student.id);
                            attachments.push({ url: res.url, name: item.name || res.fileName, size: res.bytes || 0, type: res.format || 'file', isLink: false });
                        }
                    }
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

            // Helper: strip undefined values so Firestore never throws
            function sanitizeForFirestore(obj) {
                const out = {};
                for (const [k, v] of Object.entries(obj)) {
                    out[k] = (v === undefined || v === null) ? '' : v;
                }
                return out;
            }
            
            const hwData = sanitizeForFirestore({
                id: newHwRef.id,
                studentId: student.id || '',
                studentName: student.studentName || '',
                parentEmail: finalParentEmail || '',
                parentName: finalParentName || '',
                parentPhone: student.parentPhone || '',
                tutorEmail: window.tutorData?.email || '',
                tutorName: tutorName || '',
                title: title,
                description: desc,
                dueDate: date,
                assignedDate: new Date(),
                status: 'assigned',
                attachments: attachments,
                fileUrl: attachments[0]?.url || '', 
                fileName: attachments[0]?.name || '' 
            });
            
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
    const tutorId = window.tutorData.messagingId || window.tutorData.id;
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

// --- FEATURE 1: SEND MESSAGE MODAL (SIMPLIFIED – unified selectable list) ---
// Conv ID format: tutorId_studentId  (student portal also uses this format)

function showEnhancedMessagingModal() {
    document.querySelectorAll('.enhanced-messaging-modal').forEach(e => e.remove());

    const modal = document.createElement('div');
    modal.className = 'enhanced-messaging-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.7);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
    <div style="background:#fff;border-radius:22px;width:100%;max-width:580px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.4);">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1e1b4b,#312e81,#1e3a8a);padding:20px 24px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:12px;">
                <div style="width:42px;height:42px;background:rgba(255,255,255,.15);border-radius:12px;border:1.5px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">✉️</div>
                <div>
                    <div style="color:#fff;font-weight:900;font-size:1.05rem;">New Message</div>
                    <div style="color:rgba(255,255,255,.55);font-size:.72rem;margin-top:1px;">Select one or more recipients &amp; compose</div>
                </div>
            </div>
            <button id="nm-close" style="background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:#fff;width:34px;height:34px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>

        <!-- Body -->
        <div style="flex:1;overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:14px;">

            <!-- Recipients panel -->
            <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;">To: Recipients</div>
                    <div style="display:flex;gap:8px;">
                        <button id="nm-select-all" style="font-size:.72rem;color:#6366f1;background:none;border:none;cursor:pointer;font-weight:700;">Select All</button>
                        <button id="nm-clear-all" style="font-size:.72rem;color:#94a3b8;background:none;border:none;cursor:pointer;font-weight:700;">Clear</button>
                    </div>
                </div>
                <!-- Search box -->
                <div style="position:relative;margin-bottom:8px;">
                    <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input id="nm-search" type="text" placeholder="Search by name…" style="width:100%;padding:8px 10px 8px 30px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.82rem;outline:none;box-sizing:border-box;">
                </div>
                <!-- Filter tabs -->
                <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;" id="nm-filter-tabs">
                    <button class="nm-tab active-tab" data-filter="all" style="font-size:.72rem;font-weight:700;padding:4px 10px;border-radius:8px;border:1.5px solid #6366f1;background:#eef2ff;color:#4338ca;cursor:pointer;">All</button>
                    <button class="nm-tab" data-filter="student" style="font-size:.72rem;font-weight:700;padding:4px 10px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;">👤 Students</button>
                    <button class="nm-tab" data-filter="parent" style="font-size:.72rem;font-weight:700;padding:4px 10px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;">🏠 Parents</button>
                    <button class="nm-tab" data-filter="tutor" style="font-size:.72rem;font-weight:700;padding:4px 10px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;">🧑‍🏫 Tutors</button>
                    <button class="nm-tab" data-filter="management" style="font-size:.72rem;font-weight:700;padding:4px 10px;border-radius:8px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;">🏢 Admin</button>
                </div>
                <!-- Recipient list -->
                <div id="nm-recipient-list" style="max-height:180px;overflow-y:auto;border:1.5px solid #e2e8f0;border-radius:10px;">
                    <div style="padding:20px;text-align:center;color:#9ca3af;font-size:.82rem;">Loading contacts…</div>
                </div>
                <!-- Selected count -->
                <div id="nm-selected-count" style="font-size:.72rem;color:#6366f1;font-weight:700;margin-top:6px;min-height:16px;"></div>
            </div>

            <!-- Subject -->
            <div>
                <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:6px;">Subject <span style="font-weight:400;text-transform:none;letter-spacing:0;">(optional)</span></div>
                <input type="text" id="msg-subject" placeholder="e.g. Homework reminder, Schedule update…" style="width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:.875rem;outline:none;transition:border-color .15s;box-sizing:border-box;" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#e2e8f0'">
            </div>

            <!-- Message body -->
            <div>
                <div style="font-size:.68rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:6px;">Message</div>
                <textarea id="msg-content" rows="4" placeholder="Type your message here…" style="width:100%;padding:12px 14px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:.875rem;outline:none;resize:vertical;transition:border-color .15s;box-sizing:border-box;font-family:inherit;" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#e2e8f0'"></textarea>
            </div>

            <!-- Attach + Urgent row -->
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                <input type="file" id="msg-image-file" accept="image/*" style="display:none;">
                <button onclick="document.getElementById('msg-image-file').click()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border:1.5px solid #e2e8f0;border-radius:10px;background:#f8fafc;color:#475569;font-size:.78rem;font-weight:700;cursor:pointer;">📎 Attach Image</button>
                <span id="msg-image-name" style="font-size:.72rem;color:#64748b;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 12px;border-radius:10px;border:1.5px solid #fee2e2;background:#fef2f2;">
                    <input type="checkbox" id="msg-urgent" style="accent-color:#ef4444;">
                    <span style="font-size:.78rem;font-weight:700;color:#dc2626;">🔴 Urgent</span>
                </label>
            </div>
        </div>

        <!-- Footer -->
        <div style="padding:14px 20px;border-top:1px solid #f1f5f9;display:flex;gap:10px;background:#fafafa;flex-shrink:0;">
            <button id="nm-cancel" style="flex:1;padding:12px;border:1.5px solid #e2e8f0;background:#fff;border-radius:12px;font-weight:700;color:#64748b;cursor:pointer;font-size:.875rem;">Cancel</button>
            <button id="btn-send-initial" style="flex:2;padding:12px;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;font-size:.9rem;box-shadow:0 4px 14px rgba(99,102,241,.35);">✈️ Send Message</button>
        </div>
    </div>`;

    document.body.appendChild(modal);

    // Hidden type holder for compatibility with msgProcessSendToStudents
    const typeHolder = document.createElement('div');
    typeHolder.className = 'type-option selected';
    typeHolder.dataset.type = 'group'; // always treat selection as group
    typeHolder.style.display = 'none';
    modal.appendChild(typeHolder);

    // Wire close buttons
    modal.querySelector('#nm-close').onclick = () => modal.remove();
    modal.querySelector('#nm-cancel').onclick = () => modal.remove();

    // Image name display
    modal.querySelector('#msg-image-file').addEventListener('change', (e) => {
        const f = e.target.files[0];
        modal.querySelector('#msg-image-name').textContent = f ? f.name : '';
    });

    // Load all contacts into the unified list
    let allContacts = []; // { id, name, role, extra }
    let activeFilter = 'all';

    (async () => {
        const listEl = modal.querySelector('#nm-recipient-list');
        try {
            const tutorObj = window.tutorData || {};
            const tutor = window.tutorData || {};

            // 1. Active students
            const studentDocs = await fetchStudentsForTutor(tutorObj, "students");
            studentDocs.filter(s => !s.summerBreak && !s.isTransitioning && !['archived','graduated','transferred'].includes(s.status))
                .forEach(s => allContacts.push({ id: s.id, name: s.studentName || 'Student', role: 'student', extra: s.grade || '' }));

            // 2. Parents
            try {
                const parentSnap = await getDocs(collection(db, 'parent_users'));
                parentSnap.forEach(d => {
                    const p = d.data();
                    const id = p.uid || d.id;
                    const name = p.name || p.displayName || p.email || 'Parent';
                    allContacts.push({ id, name, role: 'parent', extra: p.email || '' });
                });
            } catch(e) {}

            // 3. Other tutors
            try {
                const tutorSnap = await getDocs(collection(db, 'tutors'));
                const myId = tutor.messagingId || tutor.id;
                tutorSnap.forEach(d => {
                    if (d.id === tutor.id) return;
                    const t = d.data();
                    const tid = t.messagingId || t.tutorUid || d.id;
                    if (tid === myId) return;
                    allContacts.push({ id: tid, name: t.name || 'Tutor', role: 'tutor', extra: t.email || '' });
                });
            } catch(e) {}

            // 4. Management/Admin
            allContacts.push({ id: 'management', name: 'Admin (Management)', role: 'management', extra: '' });

            renderList();
        } catch(e) {
            listEl.innerHTML = `<div style="padding:16px;text-align:center;color:#ef4444;font-size:.82rem;">Error loading contacts: ${escapeHtml(e.message)}</div>`;
        }
    })();

    function renderList() {
        const listEl = modal.querySelector('#nm-recipient-list');
        const search = (modal.querySelector('#nm-search').value || '').toLowerCase().trim();
        const filtered = allContacts.filter(c => {
            const matchFilter = activeFilter === 'all' || c.role === activeFilter;
            const matchSearch = !search || c.name.toLowerCase().includes(search) || (c.extra||'').toLowerCase().includes(search);
            return matchFilter && matchSearch;
        });

        if (filtered.length === 0) {
            listEl.innerHTML = '<div style="padding:16px;text-align:center;color:#9ca3af;font-size:.82rem;">No contacts found.</div>';
            return;
        }

        const roleIcon = { student:'👤', parent:'🏠', tutor:'🧑‍🏫', management:'🏢' };
        const roleColor = { student:'#dbeafe', parent:'#dcfce7', tutor:'#fef3c7', management:'#f3e8ff' };

        listEl.innerHTML = filtered.map(c => `
            <label style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #f9fafb;cursor:pointer;transition:background .1s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                <input type="checkbox" class="nm-chk-recipient" value="${escapeHtml(c.id)}" data-name="${escapeHtml(c.name)}" data-role="${escapeHtml(c.role)}" style="accent-color:#6366f1;width:15px;height:15px;flex-shrink:0;">
                <span style="width:30px;height:30px;border-radius:50%;background:${roleColor[c.role]||'#f1f5f9'};display:flex;align-items:center;justify-content:center;font-size:.85rem;flex-shrink:0;">${roleIcon[c.role]||'👤'}</span>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:.84rem;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(c.name)}</div>
                    ${c.extra ? `<div style="font-size:.7rem;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(c.extra)}</div>` : ''}
                </div>
            </label>`).join('');

        // Re-attach change listeners to update count
        listEl.querySelectorAll('.nm-chk-recipient').forEach(chk => chk.addEventListener('change', updateCount));
        updateCount();
    }

    function updateCount() {
        const checked = modal.querySelectorAll('.nm-chk-recipient:checked');
        const el = modal.querySelector('#nm-selected-count');
        el.textContent = checked.length > 0 ? `${checked.length} recipient${checked.length !== 1 ? 's' : ''} selected` : '';
    }

    // Search
    modal.querySelector('#nm-search').addEventListener('input', renderList);

    // Filter tabs
    modal.querySelectorAll('.nm-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            modal.querySelectorAll('.nm-tab').forEach(t => {
                t.style.borderColor = '#e2e8f0'; t.style.background = '#fff'; t.style.color = '#64748b';
                t.classList.remove('active-tab');
            });
            tab.style.borderColor = '#6366f1'; tab.style.background = '#eef2ff'; tab.style.color = '#4338ca';
            tab.classList.add('active-tab');
            activeFilter = tab.dataset.filter;
            renderList();
        });
    });

    // Select All / Clear
    modal.querySelector('#nm-select-all').onclick = () => {
        modal.querySelectorAll('.nm-chk-recipient').forEach(c => c.checked = true);
        updateCount();
    };
    modal.querySelector('#nm-clear-all').onclick = () => {
        modal.querySelectorAll('.nm-chk-recipient').forEach(c => c.checked = false);
        updateCount();
    };

    // Send button
    modal.querySelector('#btn-send-initial').onclick = async () => {
        const checked = [...modal.querySelectorAll('.nm-chk-recipient:checked')];
        if (checked.length === 0) { showCustomAlert('Please select at least one recipient.'); return; }

        const content = (modal.querySelector('#msg-content').value || '').trim();
        const subject = (modal.querySelector('#msg-subject').value || '').trim();
        const isUrgent = modal.querySelector('#msg-urgent').checked;
        const imageFile = modal.querySelector('#msg-image-file').files[0] || null;
        if (!content && !imageFile) { showCustomAlert('Please type a message or attach an image.'); return; }

        const sendBtn = modal.querySelector('#btn-send-initial');
        sendBtn.disabled = true; sendBtn.textContent = 'Sending…';

        try {
            let imageUrl = null;
            if (imageFile) {
                const fd = new FormData();
                fd.append('file', imageFile);
                fd.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
                fd.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
                const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, { method: 'POST', body: fd });
                const data = await res.json();
                imageUrl = data.secure_url || null;
            }

            const tutor = window.tutorData;
            const myMsgId = tutor.messagingId || tutor.id;
            const now = new Date();
            const lastMsg = imageUrl ? (content || '📷 Image') : content;

            for (const chk of checked) {
                const targetId = chk.value;
                const targetName = chk.dataset.name;
                const convId = [myMsgId, targetId].sort().join('_');
                const convRef = doc(db, "conversations", convId);

                await setDoc(convRef, {
                    participants: [tutor.id, targetId],
                    participantDetails: {
                        [tutor.id]: { name: tutor.name, role: 'tutor', email: tutor.email || '' },
                        [targetId]: { name: targetName, role: chk.dataset.role || 'student' }
                    },
                    tutorId: tutor.id,
                    tutorEmail: tutor.email || '',
                    tutorName: tutor.name || '',
                    studentId: targetId,
                    studentName: targetName,
                    lastMessage: lastMsg,
                    lastMessageTimestamp: now,
                    lastSenderId: tutor.id,
                    unreadCount: 1
                }, { merge: true });

                await addDoc(collection(db, "conversations", convId, "messages"), {
                    content: content || '',
                    subject: subject || '',
                    imageUrl: imageUrl || null,
                    senderId: tutor.id,
                    senderName: tutor.name || '',
                    senderRole: 'tutor',
                    isUrgent: isUrgent,
                    createdAt: now,
                    read: false
                });
            }

            modal.remove();
            showCustomAlert(`✅ Message sent to ${checked.length} recipient${checked.length !== 1 ? 's' : ''}!`);
        } catch(e) {
            console.error('Messaging error:', e);
            showCustomAlert('❌ Error: ' + e.message);
            sendBtn.disabled = false; sendBtn.textContent = '✈️ Send Message';
        }
    };
}

/** Load recipients keyed by studentId (not parentPhone) so convId matches student portal */
async function msgLoadRecipientsByStudentId(type, container) {
    container.innerHTML = '<div class="spinner"></div>';
    const tutorEmail = window.tutorData?.email;

    try {
        // Fetch by tutorEmail AND tutorId (management assigns via tutorId)
        const tutorObj = window.tutorData || { email: tutorEmail, id: null };
        const allStudentDocs = await fetchStudentsForTutor(tutorObj, "students");
        // Only active students
        const students = allStudentDocs
            .filter(s => !s.summerBreak && !s.isTransitioning && !['archived','graduated','transferred'].includes(s.status));

        if (type === 'individual') {
            container.innerHTML = `
                <div style="position:relative;margin-bottom:6px;">
                    <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input id="student-search-box" type="text" placeholder="Search student by name…" style="width:100%;padding:8px 10px 8px 30px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.82rem;outline:none;box-sizing:border-box;" oninput="filterStudentDropdown(this.value)">
                </div>
                <select id="sel-recipient" class="form-input" size="5" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:4px;font-size:.85rem;outline:none;max-height:160px;overflow-y:auto;">
                    <option value="">— Select student —</option>
                    ${students.map(s => `<option value="${escapeHtml(s.id)}" data-name="${escapeHtml(s.studentName)}">${escapeHtml(s.studentName)} (${escapeHtml(s.grade)})</option>`).join('')}
                </select>`;
            window._studentListForSearch = students;
            window.filterStudentDropdown = function(q) {
                const sel = document.getElementById('sel-recipient');
                if (!sel) return;
                const lq = q.toLowerCase().trim();
                Array.from(sel.options).forEach(opt => {
                    opt.hidden = lq && !opt.text.toLowerCase().includes(lq);
                });
            };
        } else if (type === 'group') {
            container.innerHTML = `
                <div style="max-height:160px;overflow-y:auto;border:1.5px solid #e2e8f0;border-radius:10px;padding:6px;">
                    ${students.length === 0 ? '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:.82rem;">No active students found</div>' : students.map(s => `
                        <label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;transition:background .12s;" onmouseover="this.style.background='#f5f3ff'" onmouseout="this.style.background=''">
                            <input type="checkbox" class="chk-recipient" value="${escapeHtml(s.id)}" data-name="${escapeHtml(s.studentName)}" style="accent-color:#6366f1;width:15px;height:15px;">
                            <span style="font-size:.85rem;font-weight:600;color:#1e293b;">${escapeHtml(s.studentName)}</span>
                            <span style="font-size:.72rem;color:#94a3b8;margin-left:auto;">${escapeHtml(s.grade)}</span>
                        </label>`).join('')}
                </div>`;
        } else if (type === 'all') {
            container.innerHTML = `<div style="padding:12px 16px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;font-size:.85rem;color:#1d4ed8;font-weight:600;">📢 Broadcast to all ${students.length} active students</div>`;
            container.dataset.allStudents = JSON.stringify(students.map(s => ({ id: s.id, name: s.studentName })));
        } else if (type === 'parent') {
            // Load parents from parent_users collection
            try {
                const parentSnap = await getDocs(collection(db, 'parent_users'));
                const parents = [];
                parentSnap.forEach(d => {
                    const p = d.data();
                    if (p.uid || d.id) parents.push({ id: p.uid || d.id, name: p.name || p.displayName || p.email || 'Parent', email: p.email || '' });
                });
                container.innerHTML = `
                    <div style="position:relative;margin-bottom:6px;">
                        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <input type="text" placeholder="Search parent by name…" style="width:100%;padding:8px 10px 8px 30px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.82rem;outline:none;box-sizing:border-box;" oninput="(function(q){const s=document.getElementById('sel-recipient');if(!s)return;Array.from(s.options).forEach(o=>o.hidden=q.trim()&&!o.text.toLowerCase().includes(q.toLowerCase()));}).call(this,this.value)">
                    </div>
                    <select id="sel-recipient" size="5" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:4px;font-size:.85rem;outline:none;max-height:160px;" data-recipient-type="parent">
                        <option value="">— Select parent —</option>
                        ${parents.map(p => `<option value="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}${p.email ? ' · '+escapeHtml(p.email) : ''}</option>`).join('')}
                    </select>`;
            } catch(e) {
                container.innerHTML = `<div class="p-3 bg-red-50 text-red-600 text-sm rounded">Could not load parents: ${escapeHtml(e.message)}</div>`;
            }
        } else if (type === 'tutor') {
            // Load other tutors for tutor-to-tutor messaging (with search)
            try {
                const tutorSnap = await getDocs(collection(db, 'tutors'));
                const myId = window.tutorData?.messagingId || window.tutorData?.id;
                const tutors = [];
                tutorSnap.forEach(d => {
                    const t = d.data();
                    const tMsgId = t.tutorUid || d.id;
                    if (tMsgId !== myId && t.status !== 'inactive') {
                        tutors.push({ id: tMsgId, docId: d.id, name: t.name || t.email || 'Tutor', email: t.email || '' });
                    }
                });
                container.innerHTML = `
                    <div style="position:relative;margin-bottom:6px;">
                        <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <input type="text" placeholder="Search tutor by name…" style="width:100%;padding:8px 10px 8px 30px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.82rem;outline:none;box-sizing:border-box;" oninput="(function(q){const s=document.getElementById('sel-recipient');if(!s)return;Array.from(s.options).forEach(o=>o.hidden=q&&!o.text.toLowerCase().includes(q.toLowerCase()));}).call(this,this.value)">
                    </div>
                    <select id="sel-recipient" class="form-input" size="5" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:4px;font-size:.85rem;outline:none;max-height:160px;" data-recipient-type="tutor">
                        <option value="">— Select tutor —</option>
                        ${tutors.map(t => `<option value="${escapeHtml(t.id)}" data-name="${escapeHtml(t.name)}">${escapeHtml(t.name)}${t.email ? ' · '+escapeHtml(t.email) : ''}</option>`).join('')}
                    </select>`;
            } catch(e) {
                container.innerHTML = `<div style="padding:10px;background:#fef2f2;color:#dc2626;border-radius:10px;font-size:.82rem;">Could not load tutors: ${escapeHtml(e.message)}</div>`;
            }
        } else {
            container.innerHTML = `<div style="padding:12px 16px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.85rem;color:#475569;font-weight:600;">🏢 Message will be sent to Management / Admin team.</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div class="text-red-500 text-sm p-2">Error: ${escapeHtml(e.message)}</div>`;
    }
}

async function msgProcessSendToStudents(modal) {
    const type = modal.querySelector('.type-option.selected').dataset.type;
    const subject = (modal.querySelector('#msg-subject').value || '').trim();
    const content = (modal.querySelector('#msg-content').value || '').trim();
    const isUrgent = modal.querySelector('#msg-urgent').checked;
    const imageFile = modal.querySelector('#msg-image-file').files[0] || null;
    const tutor = window.tutorData;

    if (!content && !imageFile) { showCustomAlert('Please type a message or attach an image.'); return; }

    let targets = []; // { id: studentId, name: studentName }

    if (type === 'individual') {
        const sel = modal.querySelector('#sel-recipient');
        if (!sel.value) { showCustomAlert('Please select a student.'); return; }
        targets.push({ id: sel.value, name: sel.options[sel.selectedIndex].dataset.name });
    } else if (type === 'group') {
        modal.querySelectorAll('.chk-recipient:checked').forEach(c => targets.push({ id: c.value, name: c.dataset.name }));
        if (!targets.length) { showCustomAlert('Please select at least one student.'); return; }
    } else if (type === 'all') {
        try { targets = JSON.parse(modal.querySelector('#recipient-loader').dataset.allStudents || '[]'); } catch(e) {}
        if (!targets.length) { showCustomAlert('No active students found.'); return; }
    } else if (type === 'parent' || type === 'tutor') {
        const sel = modal.querySelector('#sel-recipient');
        if (!sel || !sel.value) { showCustomAlert('Please select a recipient.'); return; }
        targets.push({ id: sel.value, name: sel.options[sel.selectedIndex].dataset.name, recipientType: type });
    } else if (type === 'management') {
        targets = [{ id: 'management', name: 'Admin' }];
    }

    const btn = modal.querySelector('#btn-send-initial');
    btn.innerText = 'Sending...'; btn.disabled = true;

    try {
        // Upload image if attached
        let imageUrl = null;
        if (imageFile) {
            const fd = new FormData();
            fd.append('file', imageFile);
            fd.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
            fd.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, { method: 'POST', body: fd });
            const data = await res.json();
            imageUrl = data.secure_url || null;
        }

        const now = new Date();
        const lastMsg = imageUrl ? (content || '📷 Image') : content;

        for (const target of targets) {
            // Use messagingId_recipientId as convId — supports parent_users uid and tutor-to-tutor
            const myMsgId = tutor.messagingId || tutor.id;
            const convId = [myMsgId, target.id].sort().join('_');
            const convRef = doc(db, "conversations", convId);

            await setDoc(convRef, {
                participants: [tutor.id, target.id],
                participantDetails: {
                    [tutor.id]: { name: tutor.name, role: 'tutor', email: tutor.email },
                    [target.id]: { name: target.name, role: 'student' }
                },
                tutorId: tutor.id,
                tutorEmail: tutor.email,
                tutorName: tutor.name,
                studentId: target.id,
                studentName: target.name,
                lastMessage: lastMsg,
                lastMessageTimestamp: now,
                lastSenderId: tutor.id,
                unreadCount: 1
            }, { merge: true });

            await addDoc(collection(db, "conversations", convId, "messages"), {
                content: content || '',
                subject: subject,
                imageUrl: imageUrl || null,
                senderId: tutor.id,
                senderName: tutor.name,
                senderRole: 'tutor',
                isUrgent: isUrgent,
                createdAt: now,
                read: false
            });
        }
        modal.remove();
        showCustomAlert(`✅ Message sent to ${targets.length} student${targets.length !== 1 ? 's' : ''}!`);
    } catch (e) {
        console.error('Messaging error:', e);
        showCustomAlert('❌ Error: ' + e.message);
        btn.innerText = 'Try Again'; btn.disabled = false;
    }
}

async function msgLoadRecipients(type, container) {
    // Alias kept for backwards-compatibility – delegates to new function
    return msgLoadRecipientsByStudentId(type, container);
}

async function msgProcessSend(modal) {
    // Alias kept for backwards-compatibility – delegates to new function
    return msgProcessSendToStudents(modal);
}

// --- FEATURE 2: INBOX MODAL (UPDATED – student-centric, image support) ---

function showInboxModal() {
    document.querySelectorAll('.inbox-modal').forEach(e => e.remove());

    const modal = document.createElement('div');
    modal.className = 'modal-overlay inbox-modal';
    modal.onclick = (e) => { if (e.target === modal) closeInbox(modal); };

    modal.innerHTML = `
        <div class="modal-content inbox-content" style="max-width:820px;height:85vh;display:flex;flex-direction:column;padding:0;overflow:hidden;">
            <div class="inbox-container" style="display:flex;flex:1;overflow:hidden;">
                <!-- Left: conversation list -->
                <div style="width:280px;min-width:220px;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;background:#fafafa;">
                    <div style="padding:14px 16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
                        <h4 style="font-weight:700;font-size:1rem;color:#1f2937;">💬 Messages</h4>
                        <div style="display:flex;gap:6px;">
                            <button onclick="this.closest('.inbox-modal').querySelector('#inbox-list').innerHTML='<div class=spinner></div>';window._msgStartInboxListener && window._msgStartInboxListener()" style="background:none;border:none;cursor:pointer;font-size:1rem;" title="Refresh">🔄</button>
                            <button class="close-modal-absolute" style="background:none;border:none;cursor:pointer;font-size:1.3rem;color:#6b7280;">&times;</button>
                        </div>
                    </div>
                    <div id="inbox-list" style="flex:1;overflow-y:auto;"></div>
                </div>
                <!-- Right: chat -->
                <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
                    <div id="chat-view-header" style="padding:12px 16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap-10px;background:#fff;">
                        <div id="chat-title" style="font-weight:700;color:#1f2937;font-size:0.95rem;">Select a conversation</div>
                    </div>
                    <div id="chat-messages" style="flex:1;overflow-y:auto;padding:14px 16px;background:#f9fafb;display:flex;flex-direction:column;gap:8px;">
                        <div style="text-align:center;color:#9ca3af;margin-top:40px;">← Select a conversation</div>
                    </div>
                    <div id="chat-inputs" style="border-top:1px solid #e5e7eb;padding:10px 14px;background:#fff;display:none;gap:8px;align-items:flex-end;">
                        <textarea id="chat-input-text" rows="2" placeholder="Type a message..." style="flex:1;border:1px solid #d1d5db;border-radius:8px;padding:8px;resize:none;font-size:0.875rem;"></textarea>
                        <div style="display:flex;flex-direction:column;gap:6px;">
                            <label style="cursor:pointer;font-size:1.2rem;" title="Attach image">
                                <input type="file" id="chat-image-file" accept="image/*" style="display:none;">
                                📎
                            </label>
                            <button id="chat-send-btn" style="background:#059669;color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:700;">➤</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.close-modal-absolute').onclick = () => closeInbox(modal);

    // Image preview label
    modal.querySelector('#chat-image-file').addEventListener('change', (e) => {
        const f = e.target.files[0];
        const lbl = modal.querySelector('#chat-inputs label');
        if (lbl) lbl.title = f ? f.name : 'Attach image';
    });

    // Store starter so refresh button can call it
    window._msgStartInboxListener = () => msgStartInboxListener(modal);
    msgStartInboxListener(modal);
}

function closeInbox(modal) {
    if (unsubInboxListener) { unsubInboxListener(); unsubInboxListener = null; }
    if (unsubChatListener)  { unsubChatListener();  unsubChatListener  = null; }
    modal.remove();
}

function msgStartInboxListener(modal) {
    const tutorId = window.tutorData.id;
    const listEl = modal.querySelector('#inbox-list');
    listEl.innerHTML = '<div class="spinner" style="margin:16px auto;"></div>';

    if (unsubInboxListener) unsubInboxListener();

    const q = query(
        collection(db, "conversations"),
        where("participants", "array-contains", tutorId)
    );

    unsubInboxListener = onSnapshot(q, (snapshot) => {
        const convs = [];
        snapshot.forEach(d => convs.push({ id: d.id, ...d.data() }));
        convs.sort((a, b) => {
            const tA = a.lastMessageTimestamp?.toDate ? a.lastMessageTimestamp.toDate() : new Date(a.lastMessageTimestamp || 0);
            const tB = b.lastMessageTimestamp?.toDate ? b.lastMessageTimestamp.toDate() : new Date(b.lastMessageTimestamp || 0);
            return tB - tA;
        });
        msgRenderInboxList(convs, listEl, modal, tutorId);
    });
}

function msgRenderInboxList(conversations, container, modal, tutorId) {
    container.innerHTML = '';
    if (conversations.length === 0) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#9ca3af;font-size:0.875rem;">No messages yet.</div>';
        return;
    }
    conversations.forEach(conv => {
        const otherId = conv.participants.find(p => p !== tutorId);
        const otherName = conv.studentName || conv.participantDetails?.[otherId]?.name || 'Student';
        const isUnread = conv.unreadCount > 0 && conv.lastSenderId !== tutorId;
        const lastMsg = conv.lastMessage || '';
        const lastTime = msgFormatTime(conv.lastMessageTimestamp);

        const el = document.createElement('div');
        el.style.cssText = `padding:12px 14px;border-bottom:1px solid #f3f4f6;cursor:pointer;display:flex;align-items:center;gap:10px;${isUnread ? 'background:#eff6ff;' : 'background:#fff;'}`;
        el.innerHTML = `
            <div style="width:38px;height:38px;border-radius:50%;background:${isUnread ? '#059669' : '#e5e7eb'};color:${isUnread ? '#fff' : '#6b7280'};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;">
                ${escapeHtml(otherName.charAt(0).toUpperCase())}
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:${isUnread ? '700' : '600'};font-size:0.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(otherName)}</div>
                <div style="font-size:0.75rem;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${conv.lastSenderId === tutorId ? 'You: ' : ''}${escapeHtml(lastMsg.substring(0,50))}${lastMsg.length > 50 ? '…' : ''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:0.7rem;color:#9ca3af;">${escapeHtml(lastTime)}</div>
                ${isUnread ? `<div style="background:#059669;color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;margin-left:auto;margin-top:2px;">${conv.unreadCount > 9 ? '9+' : conv.unreadCount}</div>` : ''}
            </div>
        `;
        el.onmouseover = () => { el.style.background = '#f0fdf4'; };
        el.onmouseout  = () => { el.style.background = isUnread ? '#eff6ff' : '#fff'; };
        el.onclick = () => msgLoadChat(conv.id, otherName, modal, tutorId);
        container.appendChild(el);
    });
}

function msgLoadChat(convId, name, modal, tutorId) {
    modal.querySelector('#chat-title').textContent = name;
    const msgContainer = modal.querySelector('#chat-messages');
    msgContainer.innerHTML = '<div style="text-align:center;margin:20px;"><div class="spinner" style="margin:auto;"></div></div>';
    modal.querySelector('#chat-inputs').style.display = 'flex';

    // Mark as read
    updateDoc(doc(db, "conversations", convId), { unreadCount: 0 }).catch(() => {});

    if (unsubChatListener) unsubChatListener();

    const q = query(collection(db, "conversations", convId, "messages"), orderBy("createdAt", "asc"));

    unsubChatListener = onSnapshot(q, (snapshot) => {
        msgContainer.innerHTML = '';
        snapshot.forEach(d => {
            const msg = d.data();
            const isMe = msg.senderId === tutorId;
            const bubble = document.createElement('div');
            bubble.style.cssText = `display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'};`;
            const inner = document.createElement('div');
            inner.style.cssText = `max-width:72%;background:${isMe ? '#059669' : '#fff'};color:${isMe ? '#fff' : '#1f2937'};border:1px solid ${isMe ? 'transparent' : '#e5e7eb'};border-radius:${isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};padding:8px 12px;font-size:0.875rem;`;
            let html = '';
            if (msg.subject) html += `<div style="font-weight:700;font-size:0.78rem;margin-bottom:4px;opacity:0.85;">${escapeHtml(msg.subject)}</div>`;
            if (msg.content) html += `<div>${escapeHtml(msg.content)}</div>`;
            if (msg.imageUrl) html += `<img src="${escapeHtml(msg.imageUrl)}" style="max-width:200px;border-radius:8px;margin-top:6px;cursor:pointer;" onclick="window.open('${escapeHtml(msg.imageUrl)}','_blank')">`;
            html += `<div style="font-size:0.65rem;opacity:0.7;margin-top:4px;text-align:right;">${escapeHtml(msgFormatTime(msg.createdAt))}${msg.isUrgent ? ' 🔴' : ''}</div>`;
            inner.innerHTML = html;
            bubble.appendChild(inner);
            msgContainer.appendChild(bubble);
        });
        msgContainer.scrollTop = msgContainer.scrollHeight;
    });

    // Send button
    const sendBtn = modal.querySelector('#chat-send-btn');
    const input = modal.querySelector('#chat-input-text');
    const imageInput = modal.querySelector('#chat-image-file');

    const newBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newBtn, sendBtn);

    newBtn.onclick = async () => {
        const txt = input.value.trim();
        const imgFile = imageInput.files[0] || null;
        if (!txt && !imgFile) return;

        newBtn.disabled = true;
        newBtn.textContent = '…';

        try {
            let imageUrl = null;
            if (imgFile) {
                const fd = new FormData();
                fd.append('file', imgFile);
                fd.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
                fd.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
                const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`, { method: 'POST', body: fd });
                const data = await res.json();
                imageUrl = data.secure_url || null;
                imageInput.value = '';
            }

            const now = new Date();
            const lastMsg = imageUrl ? (txt || '📷 Image') : txt;

            await addDoc(collection(db, "conversations", convId, "messages"), {
                content: txt,
                imageUrl: imageUrl,
                senderId: tutorId,
                senderName: window.tutorData.name,
                senderRole: 'tutor',
                createdAt: now,
                read: false
            });

            const convRef = doc(db, "conversations", convId);
            const snap = await getDoc(convRef);
            const cur = snap.exists() ? (snap.data().unreadCount || 0) : 0;
            await updateDoc(convRef, {
                lastMessage: lastMsg,
                lastMessageTimestamp: now,
                lastSenderId: tutorId,
                unreadCount: cur + 1
            });

            input.value = '';
        } catch (e) {
            console.error('Send error:', e);
            showCustomAlert('Failed to send message: ' + e.message);
        } finally {
            newBtn.disabled = false;
            newBtn.textContent = '➤';
        }
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); newBtn.click(); }
    });
}

// Styles removed – now in HTML.

// --- AUTO-INIT ---
initializeFloatingMessagingButton();

/*******************************************************************************
 * SECTION 10: SCHEDULE CALENDAR VIEW
 ******************************************************************************/

// View Schedule Calendar for All Students — fully self-contained overlay
function showScheduleCalendarModal() {
    const DAY_PAL = {
        Monday:    { bg:'#eff6ff', hdr:'#1d4ed8', light:'#dbeafe', dot:'#3b82f6', text:'#1e40af' },
        Tuesday:   { bg:'#f5f3ff', hdr:'#6d28d9', light:'#ede9fe', dot:'#8b5cf6', text:'#5b21b6' },
        Wednesday: { bg:'#ecfdf5', hdr:'#065f46', light:'#d1fae5', dot:'#10b981', text:'#047857' },
        Thursday:  { bg:'#fff7ed', hdr:'#9a3412', light:'#fed7aa', dot:'#f97316', text:'#c2410c' },
        Friday:    { bg:'#fdf4ff', hdr:'#6b21a8', light:'#f3e8ff', dot:'#a855f7', text:'#7e22ce' },
        Saturday:  { bg:'#fefce8', hdr:'#92400e', light:'#fef08a', dot:'#f59e0b', text:'#b45309' },
        Sunday:    { bg:'#fff1f2', hdr:'#9f1239', light:'#fecdd3', dot:'#f43f5e', text:'#be123c' },
    };

    const overlay = document.createElement('div');
    overlay.id = 'calendar-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:8000;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:12px;';
    overlay.innerHTML = `
        <div style="background:#f8fafc;width:98vw;max-width:1400px;height:92vh;border-radius:22px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.45);">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 65%,#0891b2 100%);padding:18px 26px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;position:relative;overflow:hidden;">
                <div style="position:absolute;inset:0;background:url('data:image/svg+xml,%3Csvg width=40 height=40 viewBox=%220 0 40 40%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Cpath d=%22M20 20c0-5.523-4.477-10-10-10S0 14.477 0 20s4.477 10 10 10 10-4.477 10-10zm10 0c0 5.523 4.477 10 10 10s10-4.477 10-10-4.477-10-10-10-10 4.477-10 10z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');pointer-events:none;"></div>
                <div style="position:relative;display:flex;align-items:center;gap:12px;">
                    <div style="width:44px;height:44px;background:rgba(255,255,255,.2);border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;border:1.5px solid rgba(255,255,255,.3);">📆</div>
                    <div>
                        <div style="color:#fff;font-weight:900;font-size:1.15rem;letter-spacing:-.01em;">Weekly Schedule Calendar</div>
                        <div style="color:#bfdbfe;font-size:.78rem;margin-top:2px;">All active students · tap any class card to edit schedule</div>
                    </div>
                </div>
                <div style="display:flex;gap:8px;position:relative;">
                    <button id="cal-print-btn" style="background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.3);color:#fff;padding:9px 16px;border-radius:10px;font-size:.8rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s;" onmouseover="this.style.background='rgba(255,255,255,.25)'" onmouseout="this.style.background='rgba(255,255,255,.15)'">📄 Print</button>
                    <button id="cal-edit-btn" style="background:rgba(255,255,255,.95);border:none;color:#1e3a8a;padding:9px 16px;border-radius:10px;font-size:.8rem;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 4px 12px rgba(0,0,0,.2);transition:all .2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">⚙️ Edit Schedules</button>
                    <button id="cal-close-btn" style="background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.25);color:#fff;width:38px;height:38px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;" onmouseover="this.style.background='rgba(255,255,255,.25)'" onmouseout="this.style.background='rgba(255,255,255,.15)'">✕</button>
                </div>
            </div>
            <!-- Body -->
            <div style="flex:1;overflow:auto;padding:20px;" id="cal-body">
                <div id="calendar-loading" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;gap:12px;">
                    <div class="spinner"></div>
                    <p style="color:#94a3b8;">Loading schedule…</p>
                </div>
                <div id="calendar-view" style="display:none;"></div>
            </div>
            <!-- Stats footer -->
            <div id="cal-stats" style="display:none;border-top:1px solid #e2e8f0;padding:11px 24px;background:#fff;font-size:.8rem;color:#64748b;flex-shrink:0;gap:20px;flex-wrap:wrap;"></div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function closeCalModal() { overlay.remove(); document.body.style.overflow = ''; }

    overlay.querySelector('#cal-close-btn').addEventListener('click', closeCalModal);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeCalModal(); });
    overlay.querySelector('#cal-edit-btn').addEventListener('click', () => {
        closeCalModal();
        if (window.tutorData) checkAndShowSchedulePopup(window.tutorData);
    });
    overlay.querySelector('#cal-print-btn').addEventListener('click', () => {
        const content = overlay.querySelector('#calendar-view').innerHTML;
        const w = window.open('', '_blank');
        w.document.write(`<html><head><title>Schedule</title><style>body{font-family:sans-serif;padding:20px}.grid{display:grid;grid-template-columns:repeat(7,1fr);gap:8px}</style></head><body>${content}</body></html>`);
        w.document.close(); w.print();
    });

    // Async data load
    (async () => {
        try {
            const snap = await getDocs(query(collection(db, 'students'), where('tutorEmail', '==', window.tutorData.email)));
            const students = [];
            snap.forEach(d => {
                const s = { id: d.id, ...d.data() };
                if (!['archived','graduated','transferred'].includes(s.status) && s.schedule?.length > 0) students.push(s);
            });

            overlay.querySelector('#calendar-loading').style.display = 'none';
            const calView = overlay.querySelector('#calendar-view');
            calView.style.display = 'block';

            if (students.length === 0) {
                calView.innerHTML = `<div style="text-align:center;padding:60px 20px;">
                    <div style="font-size:3rem;margin-bottom:16px;">📅</div>
                    <h4 style="font-weight:800;color:#374151;font-size:1.1rem;margin-bottom:8px;">No Schedules Yet</h4>
                    <p style="color:#9ca3af;margin-bottom:20px;">No active students have schedules set up.</p>
                    <button id="setup-cal-btn" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:none;padding:12px 28px;border-radius:12px;font-weight:700;cursor:pointer;">⚙️ Set Up Schedules</button>
                </div>`;
                calView.querySelector('#setup-cal-btn').addEventListener('click', () => {
                    closeCalModal();
                    if (window.tutorData) checkAndShowSchedulePopup(window.tutorData);
                });
                return;
            }

            const ALL_DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
            const byDay = {};
            ALL_DAYS.forEach(d => byDay[d] = []);
            const ACOLORS = ['#6366f1','#0891b2','#059669','#d97706','#dc2626','#7c3aed'];

            students.forEach(s => {
                (s.schedule || []).forEach(slot => {
                    if (!byDay[slot.day]) return;
                    byDay[slot.day].push({
                        student: s.studentName || 'Unknown',
                        grade:   s.grade || '',
                        subjects:(s.subjects || []).join(', '),
                        start:   slot.start, end: slot.end,
                        time:    formatScheduleTime(slot.start) + ' – ' + formatScheduleTime(slot.end),
                        studentId: s.id,
                        isOvernight: slot.isOvernight || false,
                        color: ACOLORS[(s.studentName||'').charCodeAt(0) % ACOLORS.length],
                    });
                });
            });
            ALL_DAYS.forEach(d => byDay[d].sort((a,b) => a.start.localeCompare(b.start)));

            const todayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];

            let grid = `<div style="display:grid;grid-template-columns:repeat(7,minmax(150px,1fr));gap:10px;min-width:1050px;">`;
            ALL_DAYS.forEach(day => {
                const pal = DAY_PAL[day] || { bg:'#f9fafb', hdr:'#374151', light:'#f3f4f6', dot:'#6b7280', text:'#374151' };
                const isToday = day === todayName;
                const events  = byDay[day];
                grid += `
                <div style="border-radius:14px;overflow:hidden;border:2px solid ${isToday?pal.dot:pal.light};${isToday?'box-shadow:0 0 0 3px '+pal.dot+'33;':''}">
                    <div style="background:${isToday?pal.hdr:pal.light};padding:10px 12px;display:flex;align-items:center;justify-content:space-between;">
                        <span style="font-weight:800;font-size:.85rem;color:${isToday?'#fff':pal.text};">${day}</span>
                        ${isToday
                            ? '<span style="background:rgba(255,255,255,.3);color:#fff;font-size:.65rem;font-weight:800;padding:2px 7px;border-radius:999px;">TODAY</span>'
                            : `<span style="color:${pal.text};font-size:.72rem;opacity:.7;font-weight:600;">${events.length} class${events.length!==1?'es':''}</span>`}
                    </div>
                    <div style="background:${pal.bg};padding:8px;display:flex;flex-direction:column;gap:6px;min-height:80px;">
                        ${events.length===0
                            ? `<div style="text-align:center;padding:20px 4px;color:${pal.dot};opacity:.4;font-size:.78rem;">No classes</div>`
                            : events.map(ev=>`
                            <div class="cal-event-card" data-student-id="${escapeHtml(ev.studentId)}"
                                style="background:#fff;border-radius:10px;padding:8px 10px;border-left:3px solid ${pal.dot};box-shadow:0 1px 4px rgba(0,0,0,.07);cursor:pointer;transition:box-shadow .15s;"
                                onmouseover="this.style.boxShadow='0 3px 10px rgba(0,0,0,.13)'"
                                onmouseout="this.style.boxShadow='0 1px 4px rgba(0,0,0,.07)'">
                                <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
                                    <div style="width:20px;height:20px;border-radius:6px;background:${ev.color};color:#fff;font-size:.6rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                        ${escapeHtml((ev.student||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase())}
                                    </div>
                                    <span style="font-weight:700;font-size:.78rem;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(ev.student)}</span>
                                </div>
                                <div style="font-size:.72rem;font-weight:700;color:${pal.text};">⏰ ${escapeHtml(ev.time)}${ev.isOvernight?' 🌙':''}</div>
                                ${ev.grade?`<div style="font-size:.68rem;color:#94a3b8;margin-top:2px;">${escapeHtml(ev.grade)}${ev.subjects?' · '+escapeHtml(ev.subjects):''}</div>`:''}
                            </div>`).join('')
                        }
                    </div>
                </div>`;
            });
            grid += `</div>`;
            calView.innerHTML = grid;

            // Stats footer
            const totalClasses = ALL_DAYS.reduce((s,d)=>s+byDay[d].length,0);
            const busiest = ALL_DAYS.reduce((a,b)=>byDay[a].length>=byDay[b].length?a:b);
            const statsEl = overlay.querySelector('#cal-stats');
            statsEl.style.display = 'flex';
            statsEl.innerHTML = `
                <span><b style="color:#1e293b;">${students.length}</b> students scheduled</span>
                <span><b style="color:#1e293b;">${totalClasses}</b> classes/week</span>
                <span>Busiest day: <b style="color:#1e293b;">${escapeHtml(busiest)}</b></span>
                <span>Earliest: <b style="color:#1e293b;">${escapeHtml(getEarliestClass(byDay))}</b></span>
            `;

            // Click-to-edit
            calView.querySelectorAll('.cal-event-card').forEach(card => {
                card.addEventListener('click', () => {
                    const sid = card.getAttribute('data-student-id');
                    const student = students.find(s => s.id === sid);
                    if (student) { closeCalModal(); showEditScheduleModal(student); }
                });
            });

        } catch (err) {
            console.error('Calendar load error:', err);
            overlay.querySelector('#calendar-loading').style.display = 'none';
            const cv = overlay.querySelector('#calendar-view');
            cv.style.display = 'block';
            cv.innerHTML = `<div style="text-align:center;padding:40px;color:#dc2626;">⚠️ Failed to load: ${escapeHtml(err.message)}</div>`;
        }
    })();
}

// Edit Schedule Modal — visually coordinated with the main schedule manager
function showEditScheduleModal(student) {
    const DAY_STYLES = {
        Monday:{bg:'#eff6ff',border:'#bfdbfe',dot:'#3b82f6',accent:'#1d4ed8'},
        Tuesday:{bg:'#f5f3ff',border:'#ddd6fe',dot:'#8b5cf6',accent:'#6d28d9'},
        Wednesday:{bg:'#ecfdf5',border:'#a7f3d0',dot:'#10b981',accent:'#065f46'},
        Thursday:{bg:'#fff7ed',border:'#fed7aa',dot:'#f97316',accent:'#9a3412'},
        Friday:{bg:'#fdf4ff',border:'#f3e8ff',dot:'#a855f7',accent:'#6b21a8'},
        Saturday:{bg:'#fefce8',border:'#fef08a',dot:'#f59e0b',accent:'#92400e'},
        Sunday:{bg:'#fff1f2',border:'#fecdd3',dot:'#f43f5e',accent:'#9f1239'},
    };
    const APAL = ['#6366f1','#0891b2','#059669','#d97706','#dc2626','#7c3aed'];
    const avatarBg = APAL[(student.studentName||'').charCodeAt(0) % APAL.length];
    const initials = (student.studentName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `
        <div style="background:#fff;border-radius:20px;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 80px rgba(0,0,0,.4);overflow:hidden;">
            <!-- Header -->
            <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:20px 24px;display:flex;align-items:center;gap:14px;flex-shrink:0;">
                <div style="width:46px;height:46px;border-radius:14px;background:${avatarBg};color:#fff;font-weight:800;font-size:1rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${escapeHtml(initials)}</div>
                <div style="flex:1;min-width:0;">
                    <div style="color:#fff;font-weight:800;font-size:1.05rem;">✏️ Edit Schedule</div>
                    <div style="color:#93c5fd;font-size:.78rem;margin-top:2px;">${escapeHtml(student.studentName)} · ${escapeHtml(student.grade||'')}</div>
                </div>
                <button id="edit-sched-close" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:34px;height:34px;border-radius:50%;font-size:1rem;cursor:pointer;">✕</button>
            </div>
            <!-- Info strip -->
            <div style="background:#f0f9ff;border-bottom:1px solid #bae6fd;padding:9px 22px;font-size:.8rem;color:#0369a1;font-weight:600;flex-shrink:0;">
                💡 Overnight sessions supported (e.g. 11 PM → 1 AM)
            </div>
            <!-- Slots -->
            <div id="edit-schedule-entries" style="flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:10px;"></div>
            <!-- Add slot -->
            <div style="padding:0 18px 12px;flex-shrink:0;">
                <button id="add-edit-slot-btn" style="width:100%;padding:11px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;color:#475569;font-size:.875rem;font-weight:600;cursor:pointer;">＋ Add Time Slot</button>
            </div>
            <!-- Footer -->
            <div style="border-top:1px solid #f1f5f9;padding:14px 18px;display:flex;gap:10px;background:#f8fafc;flex-shrink:0;">
                <button id="cancel-edit-schedule-btn" style="flex:1;background:#f1f5f9;border:1px solid #e2e8f0;color:#64748b;padding:12px;border-radius:12px;font-size:.875rem;font-weight:600;cursor:pointer;">Cancel</button>
                <button id="save-edit-schedule-btn" style="flex:2;background:linear-gradient(135deg,#059669,#047857);border:none;color:#fff;padding:12px;border-radius:12px;font-size:.9rem;font-weight:700;cursor:pointer;">✅ Save Schedule</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    function closeMod() { overlay.remove(); document.body.style.overflow = ''; }
    overlay.querySelector('#edit-sched-close').addEventListener('click', closeMod);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeMod(); });
    overlay.querySelector('#cancel-edit-schedule-btn').addEventListener('click', () => { closeMod(); showScheduleCalendarModal(); });

    const selSt = 'width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.85rem;font-weight:600;color:#1e293b;background:#fff;outline:none;cursor:pointer;';
    const timeOpts = sel => TIME_SLOTS.map(s=>`<option value="${escapeHtml(s.value)}" ${s.value===sel?'selected':''}>${escapeHtml(s.label)}</option>`).join('');
    const dayOpts  = sel => DAYS_OF_WEEK.map(d=>`<option value="${escapeHtml(d)}" ${d===sel?'selected':''}>${escapeHtml(d)}</option>`).join('');

    const container = overlay.querySelector('#edit-schedule-entries');

    function addSlot(slot = null) {
        const day   = slot?.day   || 'Monday';
        const start = slot?.start || '09:00';
        const end   = slot?.end   || '10:00';
        const S = DAY_STYLES[day] || { bg:'#f8fafc', border:'#e2e8f0', dot:'#94a3b8', accent:'#475569' };
        const row = document.createElement('div');
        row.style.cssText = `background:${S.bg};border:1.5px solid ${S.border};border-radius:14px;padding:13px 15px;`;
        row.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <div style="display:flex;align-items:center;gap:7px;">
                    <span class="edot" style="width:9px;height:9px;border-radius:50%;background:${S.dot};display:inline-block;flex-shrink:0;"></span>
                    <span class="elbl" style="font-size:.75rem;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:${S.accent};">${escapeHtml(day)}</span>
                </div>
                <button class="rm-slot-btn" style="background:#fee2e2;border:none;color:#ef4444;width:28px;height:28px;border-radius:8px;font-size:.8rem;cursor:pointer;font-weight:700;">✕</button>
            </div>
            <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:10px;">
                <div>
                    <label style="display:block;font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Day</label>
                    <select class="schedule-day" style="${selSt}">${dayOpts(day)}</select>
                </div>
                <div>
                    <label style="display:block;font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Starts</label>
                    <select class="schedule-start" style="${selSt}">${timeOpts(start)}</select>
                </div>
                <div>
                    <label style="display:block;font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;">Ends</label>
                    <select class="schedule-end" style="${selSt}">${timeOpts(end)}</select>
                </div>
            </div>
        `;
        // Live colour on day change
        const sel = row.querySelector('.schedule-day');
        sel.addEventListener('change', () => {
            const d = sel.value;
            const s = DAY_STYLES[d]||{bg:'#f8fafc',border:'#e2e8f0',dot:'#94a3b8',accent:'#475569'};
            row.style.background=s.bg; row.style.borderColor=s.border;
            row.querySelector('.edot').style.background=s.dot;
            row.querySelector('.elbl').style.color=s.accent;
            row.querySelector('.elbl').textContent=d;
        });
        row.querySelector('.rm-slot-btn').addEventListener('click', () => {
            if (container.children.length > 1) row.remove();
            else showCustomAlert('At least one time slot is required.');
        });
        container.appendChild(row);
    }

    // Populate existing slots (or blank if none)
    if (student.schedule && student.schedule.length > 0) {
        student.schedule.forEach(s => addSlot(s));
    } else {
        addSlot();
    }

    overlay.querySelector('#add-edit-slot-btn').addEventListener('click', () => addSlot());

    overlay.querySelector('#save-edit-schedule-btn').addEventListener('click', async () => {
        const saveBtn = overlay.querySelector('#save-edit-schedule-btn');
        const entries = container.querySelectorAll(':scope > div');
        const schedule = [];
        let hasError = false;

        for (const entry of entries) {
            const day   = entry.querySelector('.schedule-day').value;
            const start = entry.querySelector('.schedule-start').value;
            const end   = entry.querySelector('.schedule-end').value;
            const v = validateScheduleTime(start, end);
            if (!v.valid) { showCustomAlert(v.message); hasError = true; break; }
            schedule.push({ day, start, end, isOvernight: v.isOvernight||false, duration: v.duration });
        }
        if (hasError || !schedule.length) return;

        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ Saving…';
        try {
            await updateDoc(doc(db, 'students', student.id), { schedule });
            closeMod();
            showCustomAlert('✅ Schedule updated successfully!');
            setTimeout(() => showScheduleCalendarModal(), 400);
        } catch (err) {
            console.error(err);
            showCustomAlert('❌ Error saving: ' + err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = '✅ Save Schedule';
        }
    });
}

function printCalendar() {
    // calendar-view lives inside the calendar overlay modal, not the main document
    const calEl = document.querySelector('#calendar-overlay #calendar-view') || document.getElementById('calendar-view');
    if (!calEl) { showCustomAlert('Please open the Calendar View first, then use Print.'); return; }
    const calendarContent = calEl.innerHTML;
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
    startPersistentClock(); // ← clock on every tab

    container.innerHTML = `
        <!-- Hero banner -->
        <div style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 60%,#0891b2 100%);border-radius:20px;padding:28px 28px 24px;margin-bottom:24px;position:relative;overflow:hidden;">
            <div style="position:absolute;inset:0;background:url('data:image/svg+xml,%3Csvg width=60 height=60 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E');pointer-events:none;"></div>
            <div style="position:relative;display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:48px;height:48px;background:rgba(255,255,255,.18);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;border:1.5px solid rgba(255,255,255,.3);">📅</div>
                    <div>
                        <h2 style="color:#fff;font-weight:900;font-size:1.5rem;margin:0;letter-spacing:-.02em;">Schedule Management</h2>
                        <p style="color:#bfdbfe;font-size:.82rem;margin:2px 0 0;">View, set up &amp; edit weekly class times for all your students</p>
                    </div>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                    <button id="setup-all-schedules-btn" style="background:#fff;color:#1e3a8a;border:none;padding:11px 20px;border-radius:12px;font-weight:800;font-size:.875rem;cursor:pointer;display:flex;align-items:center;gap:8px;box-shadow:0 4px 14px rgba(0,0,0,.22);transition:all .2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 22px rgba(0,0,0,.28)'" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 14px rgba(0,0,0,.22)'">
                        <span style="font-size:1rem;">⚙️</span> Set Up / Edit Schedules
                    </button>
                    <button id="view-full-calendar-btn" style="background:rgba(255,255,255,.18);color:#fff;border:1.5px solid rgba(255,255,255,.45);padding:11px 20px;border-radius:12px;font-weight:700;font-size:.875rem;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .2s;backdrop-filter:blur(8px);" onmouseover="this.style.background='rgba(255,255,255,.28)'" onmouseout="this.style.background='rgba(255,255,255,.18)'">
                        <span>📆</span> Calendar View
                    </button>
                    <button id="print-schedule-btn" style="background:rgba(255,255,255,.1);color:#bfdbfe;border:1.5px solid rgba(255,255,255,.2);padding:11px 16px;border-radius:12px;font-weight:600;font-size:.85rem;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all .2s;" onmouseover="this.style.background='rgba(255,255,255,.2)'" onmouseout="this.style.background='rgba(255,255,255,.1)'">
                        🖨️ Print
                    </button>
                </div>
            </div>
        </div>

        <!-- Today's snapshot card -->
        <div style="background:#fff;border-radius:18px;box-shadow:0 2px 14px rgba(0,0,0,.07);border:1px solid #f1f5f9;margin-bottom:20px;overflow:hidden;">
            <div style="background:linear-gradient(90deg,#ecfdf5,#f0fdf4);border-bottom:2px solid #dcfce7;padding:14px 20px;display:flex;align-items:center;gap:10px;">
                <div style="width:38px;height:38px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;box-shadow:0 3px 10px rgba(22,163,74,.3);">📊</div>
                <h3 style="font-weight:800;font-size:1rem;color:#15803d;margin:0;flex:1;">Today's Classes</h3>
                <span id="today-day-label" style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-size:.7rem;font-weight:800;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:.05em;box-shadow:0 2px 6px rgba(22,163,74,.3);"></span>
            </div>
            <div style="padding:16px;" id="todays-schedule-inline">
                <div style="text-align:center;padding:24px;"><div class="spinner mx-auto mb-2"></div><p style="color:#94a3b8;font-size:.875rem;">Loading…</p></div>
            </div>
        </div>

        <!-- Full week grid card -->
        <div style="background:#fff;border-radius:18px;box-shadow:0 2px 14px rgba(0,0,0,.07);border:1px solid #f1f5f9;overflow:hidden;">
            <div style="background:linear-gradient(90deg,#eff6ff,#f0f9ff);border-bottom:2px solid #dbeafe;padding:14px 20px;display:flex;align-items:center;gap:10px;">
                <div style="width:38px;height:38px;background:linear-gradient(135deg,#60a5fa,#2563eb);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;box-shadow:0 3px 10px rgba(37,99,235,.3);">🗓️</div>
                <h3 style="font-weight:800;font-size:1rem;color:#1d4ed8;margin:0;flex:1;">Full Week Overview</h3>
                <span style="color:#94a3b8;font-size:.72rem;font-weight:600;background:#f1f5f9;padding:3px 10px;border-radius:999px;">Sorted by time</span>
            </div>
            <div id="week-grid-container">
                <div style="text-align:center;padding:32px;"><div class="spinner mx-auto mb-2"></div><p style="color:#94a3b8;font-size:.875rem;">Loading week…</p></div>
            </div>
        </div>
    `;

    // Wire buttons
    document.getElementById('view-full-calendar-btn').addEventListener('click', showScheduleCalendarModal);
    document.getElementById('print-schedule-btn').addEventListener('click', printCalendar);
    document.getElementById('setup-all-schedules-btn').addEventListener('click', async () => {
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
            showCustomAlert('Error opening schedule manager.');
        }
    });

    // Load inline views
    (async () => {
        try {
            const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Africa/Lagos' });
            document.getElementById('today-day-label').textContent = todayName;

            const allStudents = await fetchStudentsForTutor(tutor, "students");
            const active = allStudents.filter(s => !s.summerBreak && !s.isTransitioning && !['archived','graduated','transferred'].includes(s.status));

            // Today's classes
            const todayInline = document.getElementById('todays-schedule-inline');
            const todayClasses = [];
            active.forEach(s => {
                (s.schedule || []).forEach(slot => {
                    if (slot.day === todayName) todayClasses.push({ studentName: s.studentName, grade: s.grade, subjects: s.subjects, ...slot });
                });
            });
            todayClasses.sort((a, b) => (a.start || '').localeCompare(b.start || ''));

            if (todayClasses.length === 0) {
                todayInline.innerHTML = `<div class="text-center py-6"><div class="text-3xl mb-2">🌿</div><p class="text-gray-500">No classes today (${todayName}).</p></div>`;
            } else {
                todayInline.innerHTML = `
                    <div class="space-y-2">
                        ${todayClasses.map(c => `
                        <div class="flex items-center gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50 hover:bg-green-50 hover:border-green-200 transition-all">
                            <div class="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm flex-shrink-0">${escapeHtml((c.studentName||'?').charAt(0))}</div>
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-gray-800">${escapeHtml(c.studentName)}</p>
                                <p class="text-xs text-gray-400">${escapeHtml(c.grade || '')}${c.subjects?.length ? ' · ' + escapeHtml(c.subjects.join(', ')) : ''}</p>
                            </div>
                            <div class="text-right flex-shrink-0">
                                <p class="text-sm font-bold text-green-700">${escapeHtml(formatScheduleTime(c.start))} – ${escapeHtml(formatScheduleTime(c.end))}</p>
                                ${c.isOvernight ? '<p class="text-xs text-indigo-500">🌙 Overnight</p>' : ''}
                            </div>
                        </div>`).join('')}
                    </div>`;
            }

            // Week grid
            const weekContainer = document.getElementById('week-grid-container');
            const scheduleByDay = {};
            DAYS_OF_WEEK.forEach(d => { scheduleByDay[d] = []; });
            active.forEach(s => {
                (s.schedule || []).forEach(slot => {
                    if (scheduleByDay[slot.day]) {
                        scheduleByDay[slot.day].push({ studentName: s.studentName, grade: s.grade, subjects: s.subjects, ...slot });
                    }
                });
            });
            DAYS_OF_WEEK.forEach(d => scheduleByDay[d].sort((a, b) => (a.start || '').localeCompare(b.start || '')));

            const totalClasses = Object.values(scheduleByDay).reduce((t, arr) => t + arr.length, 0);

            let gridHtml = `
            <div class="overflow-x-auto">
              <div style="display:grid;grid-template-columns:repeat(7,minmax(130px,1fr));min-width:700px;">`;

            const DAY_COLORS = {
                Monday:    { bg:'#eff6ff', border:'#bfdbfe', hdr:'#1d4ed8', dot:'#3b82f6' },
                Tuesday:   { bg:'#f5f3ff', border:'#ddd6fe', hdr:'#6d28d9', dot:'#8b5cf6' },
                Wednesday: { bg:'#ecfdf5', border:'#bbf7d0', hdr:'#065f46', dot:'#10b981' },
                Thursday:  { bg:'#fff7ed', border:'#fed7aa', hdr:'#9a3412', dot:'#f97316' },
                Friday:    { bg:'#fdf4ff', border:'#e9d5ff', hdr:'#6b21a8', dot:'#a855f7' },
                Saturday:  { bg:'#fef9c3', border:'#fde68a', hdr:'#92400e', dot:'#eab308' },
                Sunday:    { bg:'#fff1f2', border:'#fecdd3', hdr:'#9f1239', dot:'#ef4444' },
            };

            DAYS_OF_WEEK.forEach((day, idx) => {
                const isToday = day === todayName;
                const classes = scheduleByDay[day];
                const col = DAY_COLORS[day] || { bg:'#f9fafb', border:'#e5e7eb', hdr:'#374151', dot:'#6b7280' };
                const borderL = idx === 0 ? '' : `border-left:1px solid #e5e7eb;`;

                gridHtml += `
                <div style="${borderL}border-bottom:1px solid #e5e7eb;">
                    <div style="padding:8px 10px;font-weight:700;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em;
                        background:${isToday ? col.hdr : col.bg};
                        color:${isToday ? '#fff' : col.hdr};
                        border-bottom:2px solid ${isToday ? col.dot : col.border};
                        display:flex;align-items:center;justify-content:space-between;">
                        <span>${day.substring(0,3)}${isToday ? ' ◀' : ''}</span>
                        <span style="background:${isToday ? 'rgba(255,255,255,0.25)' : col.border};color:${isToday ? '#fff' : col.hdr};
                            border-radius:999px;padding:0 7px;font-size:0.7rem;font-weight:800;">${classes.length}</span>
                    </div>
                    <div style="padding:6px;min-height:90px;background:#fff;">
                        ${classes.length === 0
                            ? `<div style="color:#d1d5db;font-size:0.7rem;text-align:center;padding:14px 4px;font-style:italic;">No class</div>`
                            : classes.map(c => `
                            <div style="background:${col.bg};border:1px solid ${col.border};border-left:3px solid ${col.dot};
                                border-radius:7px;padding:6px 8px;margin-bottom:5px;font-size:0.73rem;cursor:default;">
                                <div style="font-weight:700;color:#1f2937;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.studentName)}</div>
                                <div style="color:${col.hdr};font-weight:600;margin-top:1px;">${escapeHtml(formatScheduleTime(c.start))}–${escapeHtml(formatScheduleTime(c.end))}</div>
                                ${c.subjects?.length ? `<div style="color:#9ca3af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.68rem;margin-top:1px;">${escapeHtml(c.subjects.slice(0,2).join(', '))}</div>` : ''}
                                ${c.isOvernight ? '<div style="color:#818cf8;font-size:0.67rem;">🌙 Overnight</div>' : ''}
                            </div>`).join('')}
                    </div>
                </div>`;
            });

            gridHtml += `</div></div>
            <div style="padding:12px 16px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:0.8rem;color:#6b7280;display:flex;gap:24px;flex-wrap:wrap;">
                <span>👥 <b>${active.length}</b> active students</span>
                <span>📚 <b>${totalClasses}</b> classes/week</span>
                <span>🗓️ Busiest: <b>${getMostScheduledDay(scheduleByDay)}</b></span>
                <span>⏰ Earliest: <b>${getEarliestClass(scheduleByDay)}</b></span>
            </div>`;

            weekContainer.innerHTML = gridHtml;

        } catch (err) {
            console.error(err);
            document.getElementById('todays-schedule-inline').innerHTML = '<p class="text-red-500 text-center">Failed to load schedule.</p>';
            document.getElementById('week-grid-container').innerHTML = '<p class="text-red-500 text-center">Failed to load week view.</p>';
        }
    })();
}

/*******************************************************************************
 * ACADEMIC TAB — Enhanced with monthly archive
 ******************************************************************************/
function renderAcademic(container, tutor) {
    updateActiveTab('navAcademic');
    startPersistentClock(); // ← clock on every tab

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
    startPersistentClock(); // ← clock on every tab
    
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
        // Fetch by tutorEmail AND tutorId (management assigns via tutorId)
        const tutorObj = window.tutorData || { email: tutorEmail, id: null };
        const studentDocs = await fetchStudentsForTutor(tutorObj, "students");
        
        studentCache = [];
        const students = [];
        studentDocs.forEach(student => {
            // student already has id and data merged by fetchStudentsForTutor
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
        const breakOrTransitionNames = new Set(); // extra name-based guard
        activeStudentsSnap.docs.forEach(d => {
            const s = d.data();
            // Exclude: on break, archived/graduated/transferred, OR actively transitioning
            if (!s.summerBreak && !s.isTransitioning && !['archived','graduated','transferred'].includes(s.status)) {
                activeStudentIds.add(d.id);
                activeStudentMap[d.id] = s;
            } else {
                // Track names of excluded students so we can also filter by name
                if (s.studentName) breakOrTransitionNames.add(s.studentName.trim().toLowerCase());
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
            // Skip break / inactive students — by ID or by name fallback
            if (data.studentId && !activeStudentIds.has(data.studentId)) return;
            if (!data.studentId && data.studentName && breakOrTransitionNames.has(data.studentName.trim().toLowerCase())) return;

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
            if (!data.studentId && data.studentName && breakOrTransitionNames.has(data.studentName.trim().toLowerCase())) return;

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
                    <div style="font-size:2.5rem;margin-bottom:8px;">🎉</div>
                    <p class="text-gray-500 font-medium">All caught up! No pending submissions.</p>
                </div></div>`;
        } else {
            const ACOLORS = ['#6366f1','#0891b2','#059669','#d97706','#dc2626','#7c3aed'];
            pendingReportsContainer.innerHTML = `
                <div class="card">
                    <div class="card-body p-0">
                        ${pendingItems.map((item, i) => {
                            const initials = (item.studentName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
                            const color = ACOLORS[(item.studentName||'').charCodeAt(0) % ACOLORS.length];
                            return `<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;${i < pendingItems.length-1 ? 'border-bottom:1px solid #f1f5f9;' : ''}transition:background .1s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''">
                                <div style="width:34px;height:34px;border-radius:10px;background:${color};color:#fff;font-weight:800;font-size:.72rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${escapeHtml(initials)}</div>
                                <div style="flex:1;min-width:0;">
                                    <div style="font-size:.875rem;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.studentName)}</div>
                                    ${item.grade && item.grade !== 'N/A' ? `<div style="font-size:.72rem;color:#94a3b8;">${escapeHtml(item.grade)}</div>` : ''}
                                </div>
                                <div style="background:#fef3c7;color:#92400e;font-size:.68rem;font-weight:800;padding:3px 8px;border-radius:999px;flex-shrink:0;">PENDING</div>
                            </div>`;
                        }).join('')}
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
    const dateStr = data.gradedAt ? (data.gradedAt.toDate ? data.gradedAt.toDate() : new Date(data.gradedAt)).toLocaleDateString('en-NG', {day:'numeric',month:'short',year:'numeric'}) :
                    data.submittedAt ? (data.submittedAt.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt)).toLocaleDateString('en-NG', {day:'numeric',month:'short',year:'numeric'}) : '';
    const subject = data.subject || data.grade || '';
    const ACOLORS = ['#6366f1','#0891b2','#059669','#d97706','#dc2626','#7c3aed'];
    const color = ACOLORS[(data.studentName||'').charCodeAt(0) % ACOLORS.length];
    const initials = (data.studentName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    return `
    <div style="background:#fff;border-radius:14px;border:1px solid #f1f5f9;box-shadow:0 2px 8px rgba(0,0,0,.06);overflow:hidden;margin-bottom:10px;">
        <div style="background:linear-gradient(90deg,#f8fafc,#f1f5f9);padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f1f5f9;">
            <div style="width:36px;height:36px;border-radius:10px;background:${color};color:#fff;font-weight:800;font-size:.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${escapeHtml(initials)}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;color:#1e293b;font-size:.9rem;">${escapeHtml(data.studentName)}</div>
                <div style="font-size:.72rem;color:#64748b;display:flex;gap:8px;flex-wrap:wrap;margin-top:2px;">
                    ${subject ? `<span>📚 ${escapeHtml(subject)}</span>` : ''}
                    ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
                </div>
            </div>
            <span style="background:#d1fae5;color:#065f46;font-size:.68rem;font-weight:800;padding:3px 10px;border-radius:999px;">✅ Graded</span>
        </div>
        <div style="padding:12px 16px;">
            ${data.answers ? data.answers.filter(a => a.type === 'creative-writing').map(answer => `
                <div style="background:#f0f9ff;border-radius:10px;padding:10px 12px;margin-bottom:8px;border-left:3px solid #60a5fa;">
                    <div style="font-size:.75rem;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Student Response</div>
                    <p style="font-style:italic;color:#334155;font-size:.875rem;line-height:1.5;">${escapeHtml(answer.textAnswer || "No response")}</p>
                    ${answer.tutorReport ? `<div style="margin-top:8px;background:#fff;border-radius:8px;padding:8px 10px;border:1px solid #bae6fd;">
                        <div style="font-size:.7rem;font-weight:700;color:#0891b2;text-transform:uppercase;margin-bottom:3px;">💬 Your Comment</div>
                        <p style="font-size:.875rem;color:#0369a1;">${escapeHtml(answer.tutorReport)}</p>
                    </div>` : ''}
                </div>`).join('') : ''}
        </div>
    </div>`;
}

function buildCreativeWritingCard(docRef, data) {
    const dateStr = data.gradedAt ? (data.gradedAt.toDate ? data.gradedAt.toDate() : new Date(data.gradedAt)).toLocaleDateString('en-NG', {day:'numeric',month:'short',year:'numeric'}) :
                    data.submittedAt ? (data.submittedAt.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt)).toLocaleDateString('en-NG', {day:'numeric',month:'short',year:'numeric'}) : '';
    const subject = data.subject || data.type || 'Creative Writing';
    const ACOLORS = ['#6366f1','#0891b2','#059669','#d97706','#dc2626','#7c3aed'];
    const color = ACOLORS[(data.studentName||'').charCodeAt(0) % ACOLORS.length];
    const initials = (data.studentName||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    return `
    <div style="background:#fff;border-radius:14px;border:1px solid #f1f5f9;box-shadow:0 2px 8px rgba(0,0,0,.06);overflow:hidden;margin-bottom:10px;">
        <div style="background:linear-gradient(90deg,#f8fafc,#fdf4ff);padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f3e8ff;">
            <div style="width:36px;height:36px;border-radius:10px;background:${color};color:#fff;font-weight:800;font-size:.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${escapeHtml(initials)}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:700;color:#1e293b;font-size:.9rem;">${escapeHtml(data.studentName)}</div>
                <div style="font-size:.72rem;color:#64748b;display:flex;gap:8px;flex-wrap:wrap;margin-top:2px;">
                    <span>✍️ ${escapeHtml(subject)}</span>
                    ${dateStr ? `<span>📅 ${dateStr}</span>` : ''}
                </div>
            </div>
            <span style="background:#d1fae5;color:#065f46;font-size:.68rem;font-weight:800;padding:3px 10px;border-radius:999px;">✅ Graded</span>
        </div>
        <div style="padding:12px 16px;">
            <div style="background:#fdf4ff;border-radius:10px;padding:10px 12px;border-left:3px solid #a855f7;">
                <div style="font-size:.75rem;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Student Writing</div>
                <p style="font-style:italic;color:#334155;font-size:.875rem;line-height:1.5;">${escapeHtml(data.textAnswer || "No response")}</p>
            </div>
            ${data.tutorReport ? `<div style="margin-top:8px;background:#fffbeb;border-radius:10px;padding:10px 12px;border:1px solid #fde68a;border-left:3px solid #f59e0b;">
                <div style="font-size:.7rem;font-weight:700;color:#b45309;text-transform:uppercase;margin-bottom:3px;">💬 Your Comment</div>
                <p style="font-size:.875rem;color:#92400e;">${escapeHtml(data.tutorReport)}</p>
            </div>` : ''}
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
    updateActiveTab('navStudentDatabase');
    startPersistentClock(); // ← clock on every tab

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
    
    // Queries - fetch by tutorEmail OR tutorId (management assigns via tutorId)
    const allSubmissionsQuery = query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutor.email));

    const [allStudentDocs, allSubmissionsSnapshot] = await Promise.all([
        fetchStudentsForTutor(tutor, "students"),
        getDocs(allSubmissionsQuery)
    ]);

    // Process Students - ONLY APPROVED STUDENTS
    let approvedStudents = allStudentDocs
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
            studentsHTML += `<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">`;

            students.forEach(student => {
                const hasSubmitted = submittedStudentIds.has(student.id);
                const isReportSaved = savedReports[student.id];
                const feeDisplay = showStudentFees ? `<div class="text-xs text-indigo-600 font-semibold mt-0.5">Fee: ₦${(student.studentFee || 0).toLocaleString()}</div>` : '';
                let statusBadge = '', actionsHTML = '';
                const subjects = student.subjects ? student.subjects.join(', ') : 'N/A';
                const days = student.days ? `${student.days} day${student.days !== '1' ? 's' : ''}/wk` : 'N/A';
                const initial = (student.studentName || '?').charAt(0).toUpperCase();

                let cardAccent = 'border-gray-200';
                if (student.summerBreak) {
                    statusBadge = `<span class="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">☀️ On Break</span>`;
                    cardAccent = 'border-yellow-200';
                } else if (student.isTransitioning) {
                    statusBadge = `<span class="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">🔄 Transitioning</span>`;
                    cardAccent = 'border-orange-200';
                } else if (hasSubmitted) {
                    statusBadge = `<span class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">✅ Report Sent</span>`;
                    cardAccent = 'border-blue-200';
                } else if (isReportSaved) {
                    statusBadge = `<span class="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">💾 Saved</span>`;
                    cardAccent = 'border-green-200';
                } else {
                    statusBadge = `<span class="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap">📋 Pending</span>`;
                }

                if (hasSubmitted) {
                    actionsHTML = `<span class="text-gray-400 text-xs">Submitted this month</span>`;
                } else {
                    if (isSummerBreakEnabled) {
                        const recallStatus = window.recallStatusCache ? window.recallStatusCache[student.id] : null;
                        if (student.summerBreak) {
                            if (recallStatus === 'pending') {
                                actionsHTML += `<span class="bg-purple-200 text-purple-800 px-2 py-1 rounded text-xs">Recall Requested</span>`;
                            } else {
                                actionsHTML += `<button class="recall-from-break-btn bg-purple-500 text-white px-2 py-1 rounded text-xs" data-student-id="${escapeHtml(student.id)}">Recall</button>`;
                            }
                        } else {
                            actionsHTML += `<button class="summer-break-btn bg-yellow-500 text-white px-2 py-1 rounded text-xs" data-student-id="${escapeHtml(student.id)}">Break</button>`;
                        }
                    }
                    if (isSubmissionEnabled && !student.summerBreak) {
                        if (approvedStudents.length === 1) {
                            actionsHTML += `<button class="submit-single-report-btn bg-green-600 text-white px-2 py-1 rounded text-xs" data-student-id="${escapeHtml(student.id)}" data-is-transitioning="${student.isTransitioning}">Submit Report</button>`;
                        } else {
                            actionsHTML += `<button class="enter-report-btn bg-green-600 text-white px-2 py-1 rounded text-xs" data-student-id="${escapeHtml(student.id)}" data-is-transitioning="${student.isTransitioning}">${isReportSaved ? 'Edit Report' : 'Enter Report'}</button>`;
                        }
                    } else if (!student.summerBreak) {
                        actionsHTML += `<span class="text-gray-400 text-xs">Submission Disabled</span>`;
                    }
                    if (showEditDeleteButtons && !student.summerBreak) {
                        actionsHTML += `<button class="edit-student-btn-tutor bg-blue-500 text-white px-2 py-1 rounded text-xs" data-student-id="${escapeHtml(student.id)}" data-collection="${escapeHtml(student.collection)}">Edit</button>`;
                        actionsHTML += `<button class="delete-student-btn-tutor bg-red-500 text-white px-2 py-1 rounded text-xs" data-student-id="${escapeHtml(student.id)}" data-collection="${escapeHtml(student.collection)}">Delete</button>`;
                    }
                    if (isPlacementTestEligible(student.grade) && (student.placementTestStatus || '') !== 'completed') {
                        actionsHTML += `<button class="launch-placement-btn bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 text-xs font-semibold"
                            data-student-id="${escapeHtml(student.id)}"
                            data-student-name="${escapeHtml(student.studentName)}"
                            data-grade="${escapeHtml(student.grade)}"
                            data-parent-email="${escapeHtml(student.parentEmail || '')}"
                            data-parent-name="${escapeHtml(student.parentName || '')}"
                            data-parent-phone="${escapeHtml(student.parentPhone || '')}"
                            data-tutor-email="${escapeHtml(tutor.email)}"
                            data-tutor-name="${escapeHtml(tutor.name || '')}">Placement Test</button>`;
                    }
                }

                studentsHTML += `
                <div class="bg-white border ${cardAccent} rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
                    <div class="flex items-center gap-3">
                        <div class="w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg flex-shrink-0 ${student.summerBreak ? 'bg-yellow-100 text-yellow-700' : student.isTransitioning ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}">${escapeHtml(initial)}</div>
                        <div class="min-w-0 flex-1">
                            <div class="font-bold text-gray-800 truncate">${escapeHtml(student.studentName)}</div>
                            <div class="text-xs text-gray-400">${escapeHtml(cleanGradeString ? cleanGradeString(student.grade) : student.grade)}</div>
                            ${feeDisplay}
                        </div>
                        ${statusBadge}
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                        <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs">📚 ${escapeHtml(subjects)}</span>
                        <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs">📅 ${escapeHtml(days)}</span>
                    </div>
                    <div class="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                        ${actionsHTML || '<span class="text-gray-400 text-xs">No actions available</span>'}
                    </div>
                </div>`;
            });

            studentsHTML += `</div>`;

            if (tutor.isManagementStaff) {
                studentsHTML += `<div class="bg-green-50 p-4 rounded-lg shadow-md mt-6"><h3 class="text-lg font-bold text-green-800 mb-2">Management Fee</h3><div class="flex items-center space-x-2"><label class="font-semibold">Fee:</label><input type="number" id="management-fee-input" class="p-2 border rounded w-full" value="${escapeHtml(tutor.managementFee || 0)}"><button id="save-management-fee-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Save Fee</button></div></div>`;
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

        // Toggle fees listener
        const feesToggle = document.getElementById('toggle-fees-display');
        if (feesToggle) feesToggle.addEventListener('change', () => {
            localStorage.setItem(showFeesToggleKey, feesToggle.checked);
            renderUI();
        });
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

        // ── PLACEMENT TEST — event delegation for .launch-placement-btn ──────────────
        document.querySelectorAll('.launch-placement-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId   = btn.getAttribute('data-student-id');
                const studentName = btn.getAttribute('data-student-name');
                const grade       = btn.getAttribute('data-grade');
                const parentEmail = btn.getAttribute('data-parent-email');
                const parentName  = btn.getAttribute('data-parent-name');
                const parentPhone = btn.getAttribute('data-parent-phone');
                const tutorEmail  = btn.getAttribute('data-tutor-email');
                const tutorName   = btn.getAttribute('data-tutor-name');

                if (!studentName || !grade) {
                    showCustomAlert('⚠️ Missing student data. Cannot launch placement test.');
                    return;
                }

                // Build the structured hand-off payload.
                const derivedCountry = getCountryFromPhone(parentPhone) || '';
                const payload = {
                    studentUid:   studentId,
                    studentName:  studentName,
                    grade:        grade,
                    parentEmail:  parentEmail,   // FIXED: correct key read by subject-select
                    studentEmail: parentEmail,   // legacy mirror
                    parentName:   parentName,
                    parentPhone:  parentPhone,
                    country:      derivedCountry, // FIXED: derived from phone code
                    tutorEmail:   tutorEmail,
                    tutorName:    tutorName,
                    launchedBy:   'tutor',
                    launchedAt:   Date.now()
                };

                try {
                    localStorage.setItem('studentData',  JSON.stringify(payload));
                    localStorage.setItem('studentName',  studentName);
                    localStorage.setItem('studentEmail', parentEmail);
                    localStorage.setItem('grade',        grade);
                    localStorage.setItem('studentUid',   studentId);
                } catch (e) {
                    showCustomAlert('⚠️ Could not save to localStorage. Check browser privacy settings.');
                    return;
                }

                // Open in a new tab so the tutor dashboard stays accessible
                window.open('subject-select.html', '_blank');

                // ── Live listener: update button DOM when student completes the test ──
                // This handles the case where the tutor keeps the dashboard open.
                const ONE_HOUR_MS = 60 * 60 * 1000;
                const unsubPlacement = onSnapshot(
                    doc(db, 'students', studentId),
                    (snap) => {
                        if (!snap.exists()) { unsubPlacement(); return; }
                        const d = snap.data();
                        if (d.placementTestStatus === 'completed') {
                            // Remove placement test button permanently once submitted
                            const launchBtn = document.querySelector(`.launch-placement-btn[data-student-id="${studentId}"]`);
                            if (launchBtn) launchBtn.remove();
                            unsubPlacement();
                        }
                    },
                    (err) => { console.warn('Placement onSnapshot error:', err); unsubPlacement(); }
                );

                // ── BroadcastChannel: instant removal when test tab posts completion ──
                // Fires immediately when handleTestSubmit.js posts the message,
                // even before Firestore propagates the onSnapshot above.
                try {
                    const bc = new BroadcastChannel('bkh_placement_complete');
                    bc.onmessage = (event) => {
                        if (
                            event.data?.type === 'PLACEMENT_COMPLETED' &&
                            event.data?.studentUid === studentId
                        ) {
                            const launchBtn = document.querySelector(`.launch-placement-btn[data-student-id="${studentId}"]`);
                            if (launchBtn) launchBtn.remove();
                            unsubPlacement(); // also stop the Firestore listener
                            bc.close();
                        }
                    };
                    // Auto-close channel after 1 hour to avoid memory leaks
                    setTimeout(() => bc.close(), ONE_HOUR_MS);
                } catch (_) {
                    // BroadcastChannel not supported — Firestore onSnapshot is the fallback
                }
            });
        });
    }  // ── end of attachEventListeners

    renderUI();
}

/*******************************************************************************
 * SECTION 13: AUTO-REGISTERED STUDENTS MANAGEMENT
 ******************************************************************************/

// Auto-Registered Students Functions
function renderAutoRegisteredStudents(container, tutor) {
    startPersistentClock(); // ← clock on every tab
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
        const tutorRef = doc(db, "tutors", tutorId);

        // ── Primary: live listener on tutor doc (written by management after grading) ──
        onSnapshot(tutorRef, async (docSnap) => {
            if (!docSnap.exists()) return;
            const data = docSnap.data();

            // ── Authoritative: also query tutor_grades for current month directly ──
            const lagosNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
            const monthKey = `${lagosNow.getFullYear()}-${String(lagosNow.getMonth()+1).padStart(2,'0')}`;
            const tutorEmail = data.email || (window.tutorData && window.tutorData.email) || '';

            let qaScore = null, qcScore = null;
            let qaAdvice = '', qcAdvice = '';
            let qaGradedByName = '', qcGradedByName = '';
            let perfMonth = monthKey;

            try {
                const gradesSnap = await getDocs(
                    query(collection(db, 'tutor_grades'),
                        where('tutorEmail', '==', tutorEmail),
                        where('month', '==', monthKey))
                );

                if (!gradesSnap.empty) {
                    // Use tutor_grades as source-of-truth
                    const g = gradesSnap.docs[0].data();
                    qaScore        = (g.qa && g.qa.score != null)  ? g.qa.score  : null;
                    qcScore        = (g.qc && g.qc.score != null)  ? g.qc.score  : null;
                    qaAdvice       = (g.qa && g.qa.notes)          ? g.qa.notes  : '';
                    qcAdvice       = (g.qc && g.qc.notes)          ? g.qc.notes  : '';
                    qaGradedByName = (g.qa && g.qa.gradedByName)   ? g.qa.gradedByName : '';
                    qcGradedByName = (g.qc && g.qc.gradedByName)   ? g.qc.gradedByName : '';
                    perfMonth      = g.month || monthKey;
                } else {
                    // Fallback: use cached values from tutor doc
                    qaScore        = data.qaScore        ?? null;
                    qcScore        = data.qcScore        ?? null;
                    qaAdvice       = data.qaAdvice       || '';
                    qcAdvice       = data.qcAdvice       || '';
                    qaGradedByName = data.qaGradedByName || '';
                    qcGradedByName = data.qcGradedByName || '';
                    perfMonth      = data.performanceMonth || '';
                }
            } catch (gradeErr) {
                // Index not ready or permission issue – fall back to tutor doc
                console.warn('tutor_grades query failed, using tutor doc cache:', gradeErr.message);
                qaScore        = data.qaScore        ?? null;
                qcScore        = data.qcScore        ?? null;
                qaAdvice       = data.qaAdvice       || '';
                qcAdvice       = data.qcAdvice       || '';
                qaGradedByName = data.qaGradedByName || '';
                qcGradedByName = data.qcGradedByName || '';
                perfMonth      = data.performanceMonth || '';
            }

            // Merge into window.tutorData
            if (window.tutorData) {
                window.tutorData.qaScore          = qaScore;
                window.tutorData.qcScore          = qcScore;
                window.tutorData.qaAdvice         = qaAdvice;
                window.tutorData.qcAdvice         = qcAdvice;
                window.tutorData.qaGradedByName   = qaGradedByName;
                window.tutorData.qcGradedByName   = qcGradedByName;
                window.tutorData.performanceMonth = perfMonth;
            }

            let combined = 0;
            if (qaScore !== null && qcScore !== null) combined = qaScore + qcScore;
            else if (qaScore !== null) combined = qaScore;
            else if (qcScore !== null) combined = qcScore;

            currentTutorScore = combined;
            updateScoreDisplay(combined, {
                qaScore, qcScore, qaAdvice, qcAdvice,
                qaGradedByName, qcGradedByName,
                performanceMonth: perfMonth
            });

            // 🎉 Trigger confetti the first time grades appear this session
            if (combined > 0 && (qaScore !== null || qcScore !== null)) {
                const gradeKey = `confetti_grades_${monthKey}_${tutorId}`;
                if (!sessionStorage.getItem(gradeKey)) {
                    sessionStorage.setItem(gradeKey, 'true');
                    // Slight delay so the widget renders first
                    setTimeout(() => triggerConfetti(), 600);
                }
            }
        });

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
        // Also check by comparing all tutor grades for current month
        try {
            const lagosNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
            const monthKey = `${lagosNow.getFullYear()}-${String(lagosNow.getMonth()+1).padStart(2,'0')}`;
            const allGradesSnap = await getDocs(query(collection(db, 'tutor_grades'), where('month', '==', monthKey)));
            if (!allGradesSnap.empty) {
                let topScore = -1, topTutorId = null;
                allGradesSnap.forEach(d => {
                    const g = d.data();
                    const qa = g.qa?.score ?? 0;
                    const qc = g.qc?.score ?? 0;
                    const total = qa + qc;
                    if (total > topScore) { topScore = total; topTutorId = g.tutorId || g.tutorEmail; }
                });
                // Match by tutorId or email
                const myEmail = window.tutorData?.email || '';
                if (topTutorId && (topTutorId === tutorId || topTutorId === myEmail) && topScore > 0) {
                    isTutorOfTheMonth = true;
                }
            }
        } catch(gErr) { /* ignore — index may not exist */ }

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

    // Also update the header stat card
    const statScoreEl = document.getElementById('performanceScore');
    if (statScoreEl) {
        const td2 = window.tutorData || {};
        const qa2 = breakdown.qaScore ?? td2.qaScore ?? null;
        const qc2 = breakdown.qcScore ?? td2.qcScore ?? null;
        let hdrScore = 0;
        if (qa2 !== null && qc2 !== null) hdrScore = qa2 + qc2;
        else if (qa2 !== null) hdrScore = qa2;
        else if (qc2 !== null) hdrScore = qc2;
        statScoreEl.textContent = hdrScore > 0 ? hdrScore : '–';
    }

    const td = window.tutorData || {};
    const qaScore      = breakdown.qaScore       ?? td.qaScore       ?? null;
    const qcScore      = breakdown.qcScore       ?? td.qcScore       ?? null;
    const qaAdvice     = breakdown.qaAdvice      ?? td.qaAdvice      ?? '';
    const qcAdvice     = breakdown.qcAdvice      ?? td.qcAdvice      ?? '';
    const qaGraderName = breakdown.qaGradedByName ?? td.qaGradedByName ?? '';
    const qcGraderName = breakdown.qcGradedByName ?? td.qcGradedByName ?? '';
    const perfMonth    = breakdown.performanceMonth ?? td.performanceMonth ?? '';

    // QA max = 35, QC max = 55, total max = 90
    const QA_MAX = 35, QC_MAX = 55, TOTAL_MAX = 90;
    const pct = Math.round(Math.min((totalScore / TOTAL_MAX) * 100, 100));

    let scoreColor, barGrad, scoreLbl, badgeBg;
    if (totalScore < 45)      { scoreColor='#ef4444'; barGrad='#f87171,#ef4444'; scoreLbl='⚠️ Needs Improvement'; badgeBg='#fee2e2'; }
    else if (totalScore < 68) { scoreColor='#f59e0b'; barGrad='#fbbf24,#f59e0b'; scoreLbl='👍 Good Progress';      badgeBg='#fef3c7'; }
    else if (totalScore < 81) { scoreColor='#3b82f6'; barGrad='#60a5fa,#3b82f6'; scoreLbl='🌟 Great Work';         badgeBg='#dbeafe'; }
    else                      { scoreColor='#10b981'; barGrad='#34d399,#10b981'; scoreLbl='🏆 Excellent!';         badgeBg='#d1fae5'; }

    const hasAnyGrade = qaScore !== null || qcScore !== null;

    function subBar(score, label, max, grader, color, lightBg) {
        if (score === null || score === undefined) return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f8fafc;border-radius:10px;border:1px solid #f1f5f9;">
                <span style="font-size:.75rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;">${label}</span>
                <span style="font-size:.72rem;color:#cbd5e1;font-style:italic;">Not graded yet</span>
            </div>`;
        const bp = Math.round(Math.min((score / max) * 100, 100));
        return `
            <div style="background:${lightBg};border-radius:10px;padding:10px 12px;border:1px solid ${color}33;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
                    <span style="font-size:.75rem;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:.04em;">${label}</span>
                    <span style="font-size:1rem;font-weight:900;color:${color};">${score}<span style="font-size:.7rem;font-weight:600;color:#94a3b8;"> / ${max} pts</span></span>
                </div>
                <div style="background:${color}22;border-radius:999px;height:6px;overflow:hidden;">
                    <div style="height:6px;border-radius:999px;background:linear-gradient(90deg,${color}88,${color});width:${bp}%;transition:width 1s;"></div>
                </div>
                <!-- grader name hidden as requested -->
            </div>`;
    }

    const notesHTML = [
        qaAdvice ? `<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:10px 12px;">
            <div style="font-size:.7rem;font-weight:800;color:#7c3aed;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">💬 QA Feedback</div>
            <div style="font-size:.8rem;color:#4c1d95;line-height:1.5;">"${escapeHtml(qaAdvice)}"</div>
        </div>` : '',
        qcAdvice ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;">
            <div style="font-size:.7rem;font-weight:800;color:#b45309;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">💬 QC Feedback</div>
            <div style="font-size:.8rem;color:#78350f;line-height:1.5;">"${escapeHtml(qcAdvice)}"</div>
        </div>` : ''
    ].filter(Boolean).join('');

    scoreWidget.innerHTML = `
        <div style="background:#fff;border-radius:18px;box-shadow:0 1px 6px rgba(0,0,0,.08);border:1px solid #f1f5f9;overflow:hidden;">
            ${isTutorOfTheMonth ? '<div style="background:linear-gradient(90deg,#f59e0b,#d97706);color:#fff;font-size:.72rem;font-weight:800;padding:6px 16px;text-align:center;letter-spacing:.08em;">👑 TUTOR OF THE MONTH</div>' : ''}
            <div style="padding:16px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                    <div>
                        <div style="font-size:.7rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;">Performance Score${perfMonth ? ' · ' + perfMonth : ''}</div>
                        ${hasAnyGrade ? `<div style="font-size:.78rem;color:#64748b;margin-top:2px;">${scoreLbl}</div>` : ''}
                    </div>
                    <button id="perf-toggle-btn" style="font-size:.72rem;color:#3b82f6;background:#eff6ff;border:none;cursor:pointer;font-weight:600;padding:3px 8px;border-radius:6px;">Details ↕</button>
                </div>
                ${hasAnyGrade ? `
                <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:10px;">
                    <div style="font-size:3.5rem;font-weight:900;color:${scoreColor};line-height:1;">${totalScore}</div>
                    <div style="margin-bottom:8px;line-height:1.3;">
                        <div style="font-size:.8rem;color:#94a3b8;font-weight:600;">pts</div>
                        <div style="font-size:.68rem;color:#cbd5e1;">max ${TOTAL_MAX}</div>
                    </div>
                    <div style="flex:1;"></div>
                    <div style="background:${badgeBg};color:${scoreColor};font-size:.78rem;font-weight:800;padding:4px 12px;border-radius:999px;margin-bottom:6px;">${pct}%</div>
                </div>
                <div style="background:#f1f5f9;border-radius:999px;height:8px;overflow:hidden;margin-bottom:14px;">
                    <div style="height:8px;border-radius:999px;background:linear-gradient(90deg,${barGrad});width:${pct}%;transition:width 1.2s ease;"></div>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;">
                    ${subBar(qaScore,'QA – Session Quality',QA_MAX,qaGraderName,'#7c3aed','#f5f3ff')}
                    ${subBar(qcScore,'QC – Lesson Plan Quality',QC_MAX,qcGraderName,'#d97706','#fffbeb')}
                </div>` : `
                <div style="text-align:center;padding:24px 0;color:#94a3b8;font-size:.875rem;">No performance grades yet this month.</div>`}
            </div>
            <!-- Expandable notes -->
            <div id="perf-breakdown" style="display:none;border-top:1px solid #f1f5f9;padding:14px 16px;background:#fafafa;">
                <div style="font-size:.7rem;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Grader Notes</div>
                ${notesHTML || '<div style="font-size:.8rem;color:#cbd5e1;text-align:center;padding:8px 0;">No notes provided yet.</div>'}
                <div style="margin-top:10px;font-size:.68rem;color:#cbd5e1;text-align:center;">QA (${QA_MAX} pts) + QC (${QC_MAX} pts) = ${TOTAL_MAX} pts total</div>
            </div>
        </div>
    `;

    document.getElementById('perf-toggle-btn')?.addEventListener('click', () => {
        const bd = document.getElementById('perf-breakdown');
        if (bd) bd.style.display = bd.style.display === 'none' ? 'block' : 'none';
    });
}

function buildScoreBadge(score, label, graderName, advice, themeClass) {
    // kept for any legacy references — delegates to new inline style
    if (score === null || score === undefined) return `
        <div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <div class="text-xs font-bold ${themeClass} uppercase tracking-wide mb-1">${label}</div>
            <div class="text-gray-400 text-sm">Not graded yet</div>
        </div>`;
    let sc = 'text-red-500';
    if (score >= 25) sc = 'text-yellow-500';
    if (score >= 40) sc = 'text-green-600';
    return `
        <div class="bg-white rounded-xl p-3 border border-gray-200">
            <div class="flex justify-between items-center mb-1">
                <div class="text-xs font-bold ${themeClass} uppercase tracking-wide">${label}</div>
                ${graderName ? `<span class="text-xs text-gray-400">by ${escapeHtml(graderName)}</span>` : ''}
            </div>
            <div class="text-2xl font-black ${sc}">${score}<span class="text-sm text-gray-400"> pts</span></div>
            ${advice ? `<div class="mt-2 text-xs text-gray-600 italic bg-gray-50 rounded-lg p-2 border border-gray-100">"${escapeHtml(advice)}"</div>` : ''}
        </div>`;
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
function triggerConfetti() {
    const duration = 3500;
    function runConfetti() {
        const end = Date.now() + duration;
        (function frame() {
            confetti({ particleCount: 3, angle: 60,  spread: 55, origin: { x: 0 } });
            confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    }

    if (typeof confetti === 'function') {
        runConfetti();
    } else {
        // Dynamically inject canvas-confetti if not already in the page
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
        s.onload = () => runConfetti();
        document.head.appendChild(s);
    }
}

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
    startPersistentClock(); // ← clock on every tab
    
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
        // Fetch by tutorEmail AND tutorId (management assigns via tutorId)
        const tutorObj = window.tutorData || { email: tutorEmail, id: null };
        const studentDocs = await fetchStudentsForTutor(tutorObj, "students");
        const select = document.getElementById('material-student-select');
        
        // Keep the first placeholder option
        select.innerHTML = '<option value="">— Choose a student —</option>';
        
        studentDocs.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
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
async function initTutorApp() {
    onAuthStateChanged(auth, async (user) => {
        // Remove any full-page loading overlay that the HTML might inject
        const loadingOverlay = document.getElementById('loading-overlay') ||
                               document.getElementById('auth-loading') ||
                               document.getElementById('page-loader') ||
                               document.querySelector('.loading-screen, .app-loader, .splash-screen, [data-loading]');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
            loadingOverlay.remove();
        }
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
                
                // Ensure every tutor has a stable UID for messaging (generates one if missing)
                if (!tutorData.tutorUid) {
                    const generatedUid = 'tutor_' + tutorDoc.id + '_' + Date.now();
                    try {
                        await updateDoc(doc(db, 'tutors', tutorDoc.id), { tutorUid: generatedUid });
                        tutorData.tutorUid = generatedUid;
                    } catch(e) { tutorData.tutorUid = tutorDoc.id; }
                }
                // Use tutorUid as the primary messaging ID (falls back to Firestore doc ID)
                tutorData.messagingId = tutorData.tutorUid || tutorDoc.id;
                
                // Ensure every tutor has a stable UID for messaging (generates one if missing)
                if (!tutorData.tutorUid) {
                    const generatedUid = 'tutor_' + tutorDoc.id + '_' + Date.now();
                    try {
                        await updateDoc(doc(db, 'tutors', tutorDoc.id), { tutorUid: generatedUid });
                        tutorData.tutorUid = generatedUid;
                    } catch(e) { tutorData.tutorUid = tutorDoc.id; }
                }
                tutorData.messagingId = tutorData.tutorUid || tutorDoc.id;
                window.tutorData = tutorData;
                
                // Expose Firebase config so the grading-tab can initialise its own Firebase instance
                if (!window.__firebaseConfig) {
                    // Try to read the config from the already-initialised Firebase app
                    try {
                        const _app = (await import('./firebaseConfig.js')).default || {};
                        window.__firebaseConfig = _app.options || null;
                    } catch(_) {
                        // Will be null – the grading tab will log a warning
                    }
                }
                
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
    // navAutoStudents removed – tab is disabled
    addNavListener('navScheduleManagement', renderScheduleManagement);
    addNavListener('navAcademic', renderAcademic);
    // NEW: Courses tab listener
    addNavListener('navCourses', renderCourses);
    
    // ── Game window helper ─────────────────────────────────────────────────
    // Call window.openGameWindow(url) from HTML game buttons.
    // Uses focus() to ensure the new tab appears in front, not behind.
    window.openGameWindow = function(url) {
        const gw = window.open(url, 'tutorGameWindow', 'noopener');
        if (gw) { gw.focus(); } else { window.location.href = url; }
    };
    
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
}

// If DOM already loaded (module scripts often load after DOMContentLoaded),
// run immediately. Otherwise wait for the event.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTutorApp);
} else {
    initTutorApp();
}



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
// 2. LOAD HOMEWORK INBOX – per-student card format with accordion
// ==========================================
async function loadHomeworkInbox(tutorEmail) {
    const container = document.getElementById('homework-inbox-container');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-6"><div class="spinner mx-auto mb-3"></div><p class="text-gray-500">Loading submissions…</p></div>';

    try {
        // Query all homework by this tutor (both name and email)
        let q = query(
            collection(db, "homework_assignments"),
            where("tutorName", "==", window.tutorData.name)
        );
        let snapshot = await getDocs(q);

        if (snapshot.empty) {
            q = query(collection(db, "homework_assignments"), where("tutorEmail", "==", tutorEmail));
            snapshot = await getDocs(q);
        }

        if (snapshot.empty) {
            container.innerHTML = `<div class="text-center py-6"><div class="text-3xl mb-2">📭</div><p class="text-gray-500">No homework assignments sent yet.</p></div>`;
            const badge = document.getElementById('inbox-count');
            if (badge) badge.textContent = '0';
            return;
        }

        // Group all assignments by studentId
        const studentMap = {}; // { studentId: { name, assignments: [] } }
        snapshot.forEach(d => {
            const data = { id: d.id, ...d.data() };
            const sid = data.studentId || data.studentName || 'unknown';
            if (!studentMap[sid]) {
                studentMap[sid] = { name: data.studentName || 'Unknown', assignments: [] };
            }
            studentMap[sid].assignments.push(data);
        });

        // Count pending submissions
        let pendingTotal = 0;
        Object.values(studentMap).forEach(s => {
            s.assignments.forEach(a => { if (a.status === 'submitted') pendingTotal++; });
            // Sort newest first
            s.assignments.sort((a, b) => {
                const getTs = x => x.assignedDate?.toDate ? x.assignedDate.toDate() : new Date(x.assignedDate || x.createdAt || 0);
                return getTs(b) - getTs(a);
            });
        });

        const badge = document.getElementById('inbox-count');
        if (badge) badge.textContent = pendingTotal > 0 ? pendingTotal : '✓';

        // Render per-student cards
        const sortedStudents = Object.entries(studentMap).sort((a, b) => {
            // Students with pending submissions first
            const aPending = a[1].assignments.filter(x => x.status === 'submitted').length;
            const bPending = b[1].assignments.filter(x => x.status === 'submitted').length;
            return bPending - aPending;
        });

        let html = '<div class="space-y-3">';
        sortedStudents.forEach(([sid, student]) => {
            const pending = student.assignments.filter(a => a.status === 'submitted').length;
            const graded  = student.assignments.filter(a => a.status === 'graded').length;
            const total   = student.assignments.length;

            // Group by month for accordion
            const byMonth = {};
            student.assignments.forEach(a => {
                const raw = a.assignedDate || a.createdAt;
                const d = raw?.toDate ? raw.toDate() : new Date(raw || 0);
                if (isNaN(d.getTime())) return;
                const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                if (!byMonth[mk]) byMonth[mk] = [];
                byMonth[mk].push(a);
            });

            const monthKeys = Object.keys(byMonth).sort((a,b) => b.localeCompare(a));

            html += `
            <details class="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <summary class="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 list-none select-none">
                    <div class="w-10 h-10 rounded-full ${pending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'} flex items-center justify-center font-bold text-base flex-shrink-0">
                        ${escapeHtml((student.name||'?').charAt(0))}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold text-gray-800">${escapeHtml(student.name)}</div>
                        <div class="text-xs text-gray-400">${total} assignment${total!==1?'s':''} · ${graded} graded</div>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                        ${pending > 0 ? `<span class="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">${pending} to review</span>` : '<span class="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">All clear</span>'}
                    </div>
                </summary>

                <!-- Per-month accordion inside -->
                <div class="border-t border-gray-100">
                    ${monthKeys.map(mk => {
                        const [y, m] = mk.split('-');
                        const label = new Date(parseInt(y), parseInt(m)-1, 1).toLocaleString('en-NG', { month:'long', year:'numeric' });
                        const items = byMonth[mk];
                        return `
                        <details class="border-b border-gray-50 last:border-0">
                            <summary class="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 list-none select-none">
                                <span class="text-sm font-semibold text-gray-600">${escapeHtml(label)}</span>
                                <span class="ml-auto text-xs text-gray-400">${items.length} item${items.length!==1?'s':''}</span>
                                <i class="fas fa-chevron-right text-gray-300 text-xs ml-1"></i>
                            </summary>
                            <div class="px-5 pb-4 space-y-2 bg-gray-50">
                                ${items.map(a => {
                                    const assignedDate = (() => {
                                        const raw = a.assignedDate || a.createdAt;
                                        const d = raw?.toDate ? raw.toDate() : new Date(raw || 0);
                                        return isNaN(d.getTime()) ? 'Unknown' : d.toLocaleDateString('en-NG');
                                    })();
                                    const submittedDate = (() => {
                                        if (!a.submittedAt) return null;
                                        const d = a.submittedAt?.toDate ? a.submittedAt.toDate() : new Date(a.submittedAt);
                                        return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-NG');
                                    })();
                                    const statusColor = a.status === 'graded' ? 'text-green-700 bg-green-100' :
                                                        a.status === 'submitted' ? 'text-amber-700 bg-amber-100' : 'text-gray-600 bg-gray-100';
                                    const statusLabel = a.status === 'graded' ? 'Graded' :
                                                        a.status === 'submitted' ? 'Submitted — Needs Review' : 'Assigned';
                                    return `
                                    <div class="bg-white border border-gray-200 rounded-lg p-3">
                                        <div class="flex items-start justify-between gap-2">
                                            <div class="flex-1 min-w-0">
                                                <div class="font-medium text-gray-800 text-sm">${escapeHtml(a.title || 'Untitled')}</div>
                                                ${a.description ? `<div class="text-xs text-gray-500 mt-1" style="white-space:pre-wrap;word-break:break-word;">${
                                                    // Linkify URLs in description
                                                    escapeHtml(a.description).replace(/(https?:\/\/[^\s&"<>]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color:#2563eb;text-decoration:underline;">$1</a>')
                                                }</div>` : ''}
                                                ${(() => {
                                                    const allAttachments = a.attachments || [];
                                                    if (allAttachments.length === 0 && a.fileUrl) allAttachments.push({ url: a.fileUrl, name: a.fileName || 'File', isLink: false });
                                                    if (allAttachments.length === 0) return '';
                                                    return `<div class="flex flex-wrap gap-1.5 mt-1.5">${allAttachments.map(att => {
                                                        const label = escapeHtml(att.name || 'Attachment');
                                                        const icon = att.isLink ? '🔗' : '📄';
                                                        return `<a href="${escapeHtml(att.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#1d4ed8;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:6px;text-decoration:none;border:1px solid #bfdbfe;">${icon} ${label}</a>`;
                                                    }).join('')}</div>`;
                                                })()}
                                                <div class="flex gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                                                    <span>Assigned: ${escapeHtml(assignedDate)}</span>
                                                    <span>Due: ${escapeHtml(a.dueDate || '—')}</span>
                                                    ${submittedDate ? `<span>Submitted: ${escapeHtml(submittedDate)}</span>` : ''}
                                                    ${a.score != null ? `<span class="font-bold text-blue-600">Score: ${escapeHtml(String(a.score))}/100</span>` : ''}
                                                </div>
                                            </div>
                                            <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                <span class="text-xs font-bold px-2 py-0.5 rounded-full ${statusColor}">${statusLabel}</span>
                                                ${a.status === 'submitted' ? `<button onclick="openGradingInNewTab('${escapeHtml(a.id)}')" style="background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;border:none;padding:5px 12px;border-radius:8px;font-size:.75rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;" title="Review & annotate submission">✏️ Review</button>` : ''}
                                            </div>
                                        </div>
                                    </div>`;
                                }).join('')}
                            </div>
                        </details>`;
                    }).join('')}
                </div>
            </details>`;
        });
        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error("Inbox Error:", error);
        container.innerHTML = '<p class="text-red-500 text-center py-4">Error loading homework archive.</p>';
    }
}

// ==========================================
// ==========================================
// 3. GRADING OVERLAY MODAL — in-page, reuses main page db, NO document.write
// ==========================================
async function openGradingModal(homeworkId) {
    // Remove any stale overlay
    document.getElementById('grading-overlay')?.remove();

    // Loading state
    const overlay = document.createElement('div');
    overlay.id = 'grading-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.78);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:#fff;border-radius:16px;padding:32px 48px;text-align:center;"><div class="spinner mx-auto mb-3"></div><p style="color:#6b7280;font-size:.9rem;">Loading assignment…</p></div>`;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    let hwData;
    try {
        const docSnap = await getDoc(doc(db, 'homework_assignments', homeworkId));
        if (!docSnap.exists()) { overlay.remove(); document.body.style.overflow=''; showCustomAlert('Assignment not found.'); return; }
        hwData = { id: docSnap.id, ...docSnap.data() };
    } catch (e) { overlay.remove(); document.body.style.overflow=''; showCustomAlert('Error loading: ' + e.message); return; }

    const submissionUrl    = hwData.submissionUrl   || hwData.fileUrl || '';
    const referenceUrl     = hwData.fileUrl         || '';
    const studentName      = hwData.studentName     || 'Student';
    const title            = hwData.title           || 'Untitled';
    const description      = hwData.description     || '';
    const existingScore    = hwData.score           != null ? String(hwData.score) : '';
    const existingFeedback = hwData.feedback        || hwData.tutorAnnotations || '';
    const dueDate          = hwData.dueDate         || '';
    const tutorEmail       = window.tutorData?.email || '';
    const tutorName        = window.tutorData?.name  || '';
    const isAlreadyGraded  = hwData.status === 'graded';

    // Smart file preview
    const rawExt = (submissionUrl.split('?')[0].split('.').pop() || '').toLowerCase();
    const isImage = ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(rawExt);
    const isPDF   = rawExt === 'pdf';

    let previewHTML = '';
    if (submissionUrl) {
        if (isImage) {
            previewHTML = `
                <div>
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                        <span style="font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">✏️ Annotate Submission</span>
                        <div style="display:flex;gap:6px;margin-left:auto;flex-wrap:wrap;" id="anno-tools">
                            <button onclick="annoSetTool('pen')" id="tool-pen" style="padding:5px 10px;border-radius:8px;border:1.5px solid #3b82f6;background:#eff6ff;color:#2563eb;font-size:.75rem;font-weight:700;cursor:pointer;">✏️ Pen</button>
                            <button onclick="annoSetTool('highlight')" id="tool-highlight" style="padding:5px 10px;border-radius:8px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:.75rem;font-weight:700;cursor:pointer;">🟡 Highlight</button>
                            <button onclick="annoSetTool('arrow')" id="tool-arrow" style="padding:5px 10px;border-radius:8px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:.75rem;font-weight:700;cursor:pointer;">➡️ Arrow</button>
                            <input type="color" id="anno-color" value="#ef4444" title="Pen color" style="width:32px;height:32px;padding:2px;border-radius:8px;border:1.5px solid #e2e8f0;cursor:pointer;">
                            <button onclick="annoUndo()" style="padding:5px 10px;border-radius:8px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:.75rem;font-weight:700;cursor:pointer;">↩️ Undo</button>
                            <button onclick="annoClear()" style="padding:5px 10px;border-radius:8px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:.75rem;font-weight:700;cursor:pointer;">🗑️ Clear</button>
                            <button onclick="annoSave()" style="padding:5px 10px;border-radius:8px;border:none;background:linear-gradient(135deg,#059669,#047857);color:#fff;font-size:.75rem;font-weight:700;cursor:pointer;">💾 Save Image</button>
                        </div>
                    </div>
                    <div style="position:relative;display:inline-block;width:100%;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.15);">
                        <img id="anno-base-img" src="${escapeHtml(submissionUrl)}" alt="Student submission"
                            style="max-width:100%;display:block;user-select:none;" crossorigin="anonymous"
                            onload="initAnnotationCanvas(this)">
                        <canvas id="anno-canvas" style="position:absolute;top:0;left:0;cursor:crosshair;touch-action:none;"></canvas>
                    </div>
                    <p style="font-size:.72rem;color:#9ca3af;margin-top:6px;text-align:center;">Draw directly on the image · annotations are saved with your feedback</p>
                </div>`;
        } else if (isPDF) {
            previewHTML = `<iframe src="${escapeHtml(submissionUrl)}" title="Student submission"
                style="width:100%;height:65vh;min-height:460px;border:none;border-radius:10px;background:#f9fafb;display:block;"></iframe>`;
        } else {
            const fileIcons = {doc:'📝',docx:'📝',ppt:'📊',pptx:'📊',xls:'📈',xlsx:'📈',txt:'📄',zip:'🗜️',mp4:'🎬',mp3:'🎵'};
            previewHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;padding:60px 20px;background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:12px;border:2px dashed #7dd3fc;">
                    <div style="font-size:4rem;margin-bottom:16px;">${fileIcons[rawExt]||'📎'}</div>
                    <p style="font-weight:700;color:#0369a1;font-size:1.1rem;margin-bottom:6px;">${escapeHtml(hwData.fileName||'Submitted File')}</p>
                    <p style="color:#64748b;font-size:.85rem;margin-bottom:20px;">Click below to open and review</p>
                    <a href="${escapeHtml(submissionUrl)}" target="_blank"
                        style="background:#0369a1;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;">📂 Open File ↗</a>
                </div>`;
        }
    } else {
        previewHTML = `
            <div style="text-align:center;padding:60px 20px;background:#fef9c3;border-radius:12px;border:2px dashed #fde047;">
                <div style="font-size:3rem;margin-bottom:12px;">⚠️</div>
                <p style="color:#92400e;font-weight:700;">No file attached yet</p>
                <p style="color:#a16207;font-size:.85rem;margin-top:6px;">The student has not uploaded a file.</p>
            </div>`;
    }

    // Build full overlay UI
    overlay.innerHTML = `
    <div style="background:#f8fafc;width:98vw;max-width:1300px;height:92vh;border-radius:20px;display:grid;grid-template-rows:auto 1fr;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.4);">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);color:#fff;padding:14px 24px;display:flex;align-items:center;gap:14px;flex-shrink:0;">
            <div style="flex:1;min-width:0;">
                <div style="font-weight:800;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    📝 Reviewing: <span style="color:#bfdbfe;">${escapeHtml(studentName)}</span>
                </div>
                <div style="font-size:.78rem;opacity:.8;margin-top:2px;">
                    ${escapeHtml(title)}${dueDate?' · Due: '+escapeHtml(dueDate):''}
                    ${isAlreadyGraded?'<span style="background:rgba(52,211,153,.3);color:#d1fae5;border-radius:999px;padding:1px 10px;margin-left:8px;font-size:.72rem;font-weight:700;">✅ Previously Graded</span>':''}
                </div>
            </div>
            <button id="grading-close-btn" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:1.2rem;cursor:pointer;flex-shrink:0;">✕</button>
        </div>

        <!-- Two-panel body -->
        <div style="display:grid;grid-template-columns:1fr 360px;overflow:hidden;height:100%;">

            <!-- LEFT: document viewer -->
            <div style="overflow-y:auto;padding:20px;background:#f1f5f9;">
                ${referenceUrl && referenceUrl !== submissionUrl ? (() => {
                    const refExt = (referenceUrl.split('?')[0].split('.').pop() || '').toLowerCase();
                    const refIsImg = ['jpg','jpeg','png','gif','webp','svg'].includes(refExt);
                    const refIsPDF = refExt === 'pdf';
                    if (refIsImg) {
                        return `<div style="margin-bottom:14px;border:1.5px solid #bfdbfe;border-radius:10px;overflow:hidden;background:#eff6ff;">
                            <div style="background:#eff6ff;padding:7px 12px;font-size:.72rem;font-weight:700;color:#1d4ed8;display:flex;align-items:center;justify-content:space-between;">
                                <span>📎 Original Assignment Reference</span>
                                <a href="${escapeHtml(referenceUrl)}" target="_blank" style="color:#2563eb;text-decoration:none;font-size:.7rem;">Open full size ↗</a>
                            </div>
                            <img src="${escapeHtml(referenceUrl)}" alt="Assignment reference" style="width:100%;max-height:260px;object-fit:contain;background:#fff;display:block;">
                        </div>`;
                    } else if (refIsPDF) {
                        return `<div style="margin-bottom:14px;border:1.5px solid #bfdbfe;border-radius:10px;overflow:hidden;">
                            <div style="background:#eff6ff;padding:7px 12px;font-size:.72rem;font-weight:700;color:#1d4ed8;display:flex;align-items:center;justify-content:space-between;">
                                <span>📎 Original Assignment Reference (PDF)</span>
                                <a href="${escapeHtml(referenceUrl)}" target="_blank" style="color:#2563eb;text-decoration:none;font-size:.7rem;">Open in tab ↗</a>
                            </div>
                            <iframe src="${escapeHtml(referenceUrl)}" style="width:100%;height:260px;border:none;display:block;background:#f9fafb;"></iframe>
                        </div>`;
                    } else {
                        return `<a href="${escapeHtml(referenceUrl)}" target="_blank"
                            style="display:inline-flex;align-items:center;gap:6px;color:#2563eb;font-size:.8rem;text-decoration:none;margin-bottom:12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:6px 12px;">
                            📎 Open Original Assignment Reference ↗
                        </a>`;
                    }
                })() : ''}
                ${previewHTML}
                ${description ? `
                <div style="margin-top:16px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
                    <div style="font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin-bottom:8px;">Assignment Instructions</div>
                    <div style="font-size:.875rem;color:#334155;line-height:1.7;white-space:pre-wrap;">${escapeHtml(description)}</div>
                </div>` : ''}
            </div>

            <!-- RIGHT: grading sidebar -->
            <div style="background:#fff;border-left:1px solid #e2e8f0;display:flex;flex-direction:column;overflow:hidden;">
                <div style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;">

                    <!-- Annotation -->
                    <div>
                        <label style="display:block;font-size:.73rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:8px;">✏️ Annotations / Feedback</label>
                        <div id="grading-annotation" contenteditable="true"
                            style="min-height:180px;max-height:280px;overflow-y:auto;border:2px solid #e2e8f0;border-radius:10px;padding:12px;font-size:.875rem;line-height:1.7;color:#1e293b;outline:none;white-space:pre-wrap;background:#fafafa;"
                            onfocus="this.style.borderColor='#3b82f6';this.style.background='#fff'"
                            onblur="this.style.borderColor='#e2e8f0';this.style.background='#fafafa'"
                        >${existingFeedback.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
                        <p style="font-size:.72rem;color:#94a3b8;margin-top:6px;">This will be visible to the student.</p>
                    </div>

                    <!-- Grade -->
                    <div>
                        <label style="display:block;font-size:.73rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:8px;">🎯 Grade (out of 100)</label>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <input type="number" id="grading-score" min="0" max="100" value="${escapeHtml(existingScore)}" placeholder="–"
                                style="width:90px;padding:10px 14px;border:2px solid #e2e8f0;border-radius:10px;font-size:1.4rem;font-weight:800;color:#1e293b;outline:none;text-align:center;"
                                onfocus="this.style.borderColor='#3b82f6'"
                                onblur="this.style.borderColor='#e2e8f0'">
                            <span style="color:#94a3b8;font-size:.9rem;">/ 100</span>
                            <span id="grade-emoji" style="font-size:1.5rem;"></span>
                        </div>
                    </div>

                    <div id="grading-status" style="display:none;"></div>
                </div>

                <!-- Save / Cancel -->
                <div style="padding:14px 20px;border-top:1px solid #e2e8f0;display:flex;flex-direction:column;gap:10px;background:#f8fafc;flex-shrink:0;">
                    <button id="grading-save-btn" style="background:linear-gradient(135deg,#059669,#047857);color:#fff;border:none;border-radius:12px;padding:14px;font-size:1rem;font-weight:700;cursor:pointer;width:100%;">
                        ✅ Save &amp; Return to Student
                    </button>
                    <button id="grading-cancel-btn" style="background:none;border:1px solid #e2e8f0;color:#64748b;border-radius:10px;padding:10px;font-size:.875rem;cursor:pointer;width:100%;">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    // ── Annotation canvas system ────────────────────────────────
    let annoTool = 'pen';
    let annoDrawing = false;
    let annoHistory = []; // snapshots for undo
    let annoCtx = null;
    let annoStartX = 0, annoStartY = 0;
    let annoTempSnap = null;

    window.initAnnotationCanvas = function(img) {
        const canvas = document.getElementById('anno-canvas');
        if (!canvas || !img) return;
        canvas.width  = img.naturalWidth  || img.offsetWidth;
        canvas.height = img.naturalHeight || img.offsetHeight;
        canvas.style.width  = img.offsetWidth  + 'px';
        canvas.style.height = img.offsetHeight + 'px';
        annoCtx = canvas.getContext('2d');

        function getPos(e) {
            const r = canvas.getBoundingClientRect();
            const scaleX = canvas.width  / r.width;
            const scaleY = canvas.height / r.height;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: (clientX - r.left) * scaleX, y: (clientY - r.top) * scaleY };
        }

        canvas.addEventListener('mousedown',  e => { annoDrawing=true; const p=getPos(e); annoStartX=p.x; annoStartY=p.y; annoTempSnap=annoCtx.getImageData(0,0,canvas.width,canvas.height); if(annoTool==='pen'||annoTool==='highlight'){annoCtx.beginPath();annoCtx.moveTo(p.x,p.y);} });
        canvas.addEventListener('mousemove',  e => { if(!annoDrawing)return; const p=getPos(e); if(annoTool==='pen'){annoCtx.strokeStyle=document.getElementById('anno-color')?.value||'#ef4444';annoCtx.lineWidth=3;annoCtx.lineCap='round';annoCtx.globalAlpha=1;annoCtx.lineTo(p.x,p.y);annoCtx.stroke();} else if(annoTool==='highlight'){annoCtx.strokeStyle='#fef08a';annoCtx.lineWidth=18;annoCtx.lineCap='round';annoCtx.globalAlpha=0.5;annoCtx.lineTo(p.x,p.y);annoCtx.stroke();} else if(annoTool==='arrow'){annoCtx.putImageData(annoTempSnap,0,0);drawArrow(annoCtx,annoStartX,annoStartY,p.x,p.y,document.getElementById('anno-color')?.value||'#ef4444');} });
        canvas.addEventListener('mouseup',    e => { if(!annoDrawing)return; annoDrawing=false; annoCtx.globalAlpha=1; annoHistory.push(annoCtx.getImageData(0,0,canvas.width,canvas.height)); });
        canvas.addEventListener('mouseleave', e => { if(annoDrawing){annoDrawing=false;annoCtx.globalAlpha=1;annoHistory.push(annoCtx.getImageData(0,0,canvas.width,canvas.height));} });
        canvas.addEventListener('touchstart', e => { e.preventDefault(); const p=getPos(e); canvas.dispatchEvent(new MouseEvent('mousedown',{clientX:p.x,clientY:p.y})); }, {passive:false});
        canvas.addEventListener('touchmove',  e => { e.preventDefault(); const p=getPos(e); canvas.dispatchEvent(new MouseEvent('mousemove',{clientX:e.touches[0].clientX,clientY:e.touches[0].clientY})); }, {passive:false});
        canvas.addEventListener('touchend',   e => { canvas.dispatchEvent(new MouseEvent('mouseup',{})); }, {passive:false});
    };

    function drawArrow(ctx, x1, y1, x2, y2, color) {
        const hw=12, hl=18;
        const angle=Math.atan2(y2-y1,x2-x1);
        ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=3; ctx.globalAlpha=1;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2,y2);
        ctx.lineTo(x2-hl*Math.cos(angle-Math.PI/7),y2-hl*Math.sin(angle-Math.PI/7));
        ctx.lineTo(x2-hl*Math.cos(angle+Math.PI/7),y2-hl*Math.sin(angle+Math.PI/7));
        ctx.closePath(); ctx.fill();
    }

    window.annoSetTool = function(t) {
        annoTool = t;
        ['pen','highlight','arrow'].forEach(tt => {
            const btn = document.getElementById('tool-'+tt);
            if (btn) { btn.style.background=t===tt?'#eff6ff':'#f8fafc'; btn.style.border=t===tt?'1.5px solid #3b82f6':'1.5px solid #e2e8f0'; btn.style.color=t===tt?'#2563eb':'#64748b'; }
        });
    };

    window.annoUndo = function() {
        const canvas = document.getElementById('anno-canvas');
        if (!canvas || !annoCtx) return;
        annoHistory.pop();
        if (annoHistory.length > 0) {
            annoCtx.putImageData(annoHistory[annoHistory.length-1], 0, 0);
        } else {
            annoCtx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    window.annoClear = function() {
        const canvas = document.getElementById('anno-canvas');
        if (!canvas || !annoCtx) return;
        annoCtx.clearRect(0, 0, canvas.width, canvas.height);
        annoHistory = [];
    };

    window.annoSave = function() {
        const canvas = document.getElementById('anno-canvas');
        const img = document.getElementById('anno-base-img');
        if (!canvas || !img || !annoCtx) return;
        // Composite: draw base image + annotations onto a new canvas
        const merged = document.createElement('canvas');
        merged.width = canvas.width; merged.height = canvas.height;
        const mc = merged.getContext('2d');
        mc.drawImage(img, 0, 0, canvas.width, canvas.height);
        mc.drawImage(canvas, 0, 0);
        const link = document.createElement('a');
        link.download = 'annotated_submission.png';
        link.href = merged.toDataURL('image/png');
        link.click();
        // Also store dataURL in a hidden field so the save handler can optionally upload it
        window._annoDataURL = merged.toDataURL('image/png');
    };
    // ── End annotation canvas system ─────────────────────────

    // Grade emoji live update
    const scoreInput = overlay.querySelector('#grading-score');
    const gradeEmoji = overlay.querySelector('#grade-emoji');
    function updateEmoji() {
        const v = parseInt(scoreInput.value, 10);
        if (isNaN(v)) { gradeEmoji.textContent = ''; return; }
        gradeEmoji.textContent = v >= 90 ? '🏆' : v >= 75 ? '⭐' : v >= 60 ? '👍' : v >= 40 ? '📝' : '🔄';
    }
    scoreInput.addEventListener('input', updateEmoji);
    updateEmoji();

    // Close handlers
    function closeGrading() { overlay.remove(); document.body.style.overflow = ''; }
    overlay.querySelector('#grading-close-btn').addEventListener('click', closeGrading);
    overlay.querySelector('#grading-cancel-btn').addEventListener('click', closeGrading);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeGrading(); });
    const escHandler = e => { if (e.key === 'Escape') { closeGrading(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);

    // Save handler — uses existing db, no re-init needed
    overlay.querySelector('#grading-save-btn').addEventListener('click', async () => {
        const saveBtn  = overlay.querySelector('#grading-save-btn');
        const statusEl = overlay.querySelector('#grading-status');
        const feedback = overlay.querySelector('#grading-annotation').innerText.trim();
        const scoreRaw = overlay.querySelector('#grading-score').value.trim();
        const scoreVal = scoreRaw !== '' ? parseInt(scoreRaw, 10) : null;

        function showSt(msg, ok) {
            statusEl.style.display = 'block';
            statusEl.style.cssText = `display:block;padding:10px 14px;border-radius:10px;font-size:.875rem;font-weight:600;text-align:center;background:${ok?'#d1fae5':'#fee2e2'};color:${ok?'#065f46':'#991b1b'};`;
            statusEl.textContent = msg;
        }

        if (scoreVal !== null && (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 100)) {
            showSt('❌ Score must be 0–100.', false); return;
        }
        if (!feedback && scoreVal === null) {
            if (!confirm('Save without a grade or feedback?')) return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = '⏳ Saving…';
        statusEl.style.display = 'none';

        try {
            const update = {
                feedback, tutorAnnotations: feedback,
                status: 'graded', gradedAt: new Date(),
                tutorEmail, tutorName
            };
            if (scoreVal !== null) update.score = scoreVal;
            await updateDoc(doc(db, 'homework_assignments', homeworkId), update);

            showSt('✅ Grade saved and returned to student!', true);
            saveBtn.textContent = '✅ Saved!';
            saveBtn.style.background = 'linear-gradient(135deg,#6366f1,#4f46e5)';
            try { if (typeof loadHomeworkInbox === 'function') loadHomeworkInbox(tutorEmail); } catch(e) {}
            setTimeout(closeGrading, 1600);
        } catch (err) {
            console.error('Grading save error:', err);
            showSt('❌ Save failed: ' + err.message, false);
            saveBtn.disabled = false;
            saveBtn.textContent = '✅ Save & Return to Student';
        }
    });
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

// Expose modular Firebase functions globally so games.js (classic script) can use them
// Do this immediately so games.js has access as soon as this module is parsed
window.__fbCollection = collection;
window.__fbAddDoc     = addDoc;
window.__fbGetDocs    = getDocs;
window.__fbQuery      = query;
window.__fbWhere      = where;
window.__fbOrderBy    = orderBy;
window.__fbLimit      = limit;
window.__fbOnSnapshot = onSnapshot;
window.__fbDoc        = doc;
window.__fbSetDoc     = setDoc;
window.__fbUpdateDoc  = updateDoc;
// Expose db instance so games.js and other scripts can use Firebase
window.db = db;

// Opens grading in a dedicated new browser tab for full-screen annotation experience
window.openGradingInNewTab = function(homeworkId) {
    // Store IDs in sessionStorage so grading.html can read them
    sessionStorage.setItem('grading_hw_id',     homeworkId);
    sessionStorage.setItem('grading_tutor_email', window.tutorData?.email || '');
    sessionStorage.setItem('grading_tutor_name',  window.tutorData?.name  || '');
    // Build query string too (belt and suspenders)
    const p = new URLSearchParams({
        hw:    homeworkId,
        tutor: window.tutorData?.email || '',
        name:  window.tutorData?.name  || ''
    });
    const url = `./grading.html?${p.toString()}`;
    const tab = window.open(url, '_blank');
    if (!tab) showCustomAlert('Pop-up blocked — please allow pop-ups and try again.');
};

window.showDailyTopicModal = showDailyTopicModal;
window.showHomeworkModal = showHomeworkModal;
window.showScheduleCalendarModal = showScheduleCalendarModal;
window.renderCourses = renderCourses;
window.loadCourseMaterials = loadCourseMaterials;
window.uploadCourseMaterial = uploadCourseMaterial;
