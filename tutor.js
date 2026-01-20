import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, deleteDoc, setDoc, deleteField, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ##################################################################
// # SECTION 0: CONFIGURATION, STYLES & CORE LOGIC
// ##################################################################

// --- Global state ---
let isSubmissionEnabled = false;
let isTutorAddEnabled = false;
let isSummerBreakEnabled = false;
let isBypassApprovalEnabled = false;
let showStudentFees = false;
let showEditDeleteButtons = false;
let studentCache = []; // Cache for dropdowns

// --- Cloudinary Config ---
const CLOUDINARY_CONFIG = { cloudName: 'dwjq7j5zp', uploadPreset: 'tutor_homework', apiKey: '963245294794452' };

// --- Constants ---
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const ROBUST_TIME_SLOTS = [];
for (let hour = 6; hour <= 23; hour++) {
    ['00', '15', '30', '45'].forEach(min => {
        const displayHour = hour > 12 ? hour - 12 : hour;
        ROBUST_TIME_SLOTS.push({ 
            value: `${hour.toString().padStart(2,'0')}:${min}`, 
            label: `${displayHour === 0 ? 12 : displayHour}:${min} ${hour >= 12 ? 'PM' : 'AM'}` 
        });
    });
}
['00', '01', '02'].forEach(hour => {
    ['00', '15', '30', '45'].forEach(min => {
        ROBUST_TIME_SLOTS.push({ value: `${hour}:${min}`, label: `${hour === '00' ? 12 : parseInt(hour)}:${min} AM` });
    });
});

// --- Inject CSS (Merged Styles) ---
const style = document.createElement('style');
style.textContent = `
    /* --- Original Button Styles --- */
    #add-transitioning-btn {
        display: block !important;
        background: orange !important;
        color: white !important;
        padding: 10px 20px !important;
        border-radius: 5px !important;
        border: none !important;
        cursor: pointer !important;
        margin: 5px !important;
    }
    #add-transitioning-btn:hover { background: darkorange !important; }

    /* --- New Dashboard Core Variables --- */
    :root { 
        --primary-color: #10b981; 
        --primary-dark: #059669; 
        --primary-light: #d1fae5; 
        --secondary-color: #6366f1; 
        --danger-color: #ef4444; 
        --warning-color: #f59e0b; 
        --info-color: #3b82f6; 
        --dark-color: #1f2937; 
        --light-color: #f9fafb; 
        --border-color: #e5e7eb; 
        --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
        --radius: 0.5rem; 
        --radius-lg: 0.75rem; 
    }

    /* --- New Dashboard Components --- */
    .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .card { background: white; border-radius: var(--radius-lg); box-shadow: var(--shadow); border: 1px solid var(--border-color); }
    .card-body { padding: 1.5rem; }
    .card-header { padding: 1.5rem; border-bottom: 1px solid var(--border-color); }
    
    .hero-section { background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%); border-radius: var(--radius-lg); color: white; padding: 2rem; margin-bottom: 2rem; }
    .hero-title { font-size: 1.875rem; font-weight: 700; margin-bottom: 0.5rem; }
    
    .student-actions-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-top: 1.5rem; margin-bottom: 2rem; }
    .student-action-card { border: 1px solid var(--border-color); border-radius: var(--radius); padding: 1rem; transition: all 0.2s ease; background: white; }
    .student-action-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }

    .form-input { width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: var(--radius); margin-bottom: 0.5rem; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.625rem 1.25rem; border-radius: var(--radius); font-weight: 500; cursor: pointer; border: none; transition: 0.2s; }
    .btn-primary { background: var(--primary-color); color: white; }
    .btn-secondary { background: white; border: 1px solid var(--border-color); color: var(--dark-color); }
    .btn-info { background: var(--info-color); color: white; }
    .btn-warning { background: var(--warning-color); color: white; }
    .btn-danger { background: var(--danger-color); color: white; }
    .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.75rem; }
    .w-full { width: 100%; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
    .modal-content { background: white; border-radius: var(--radius-lg); width: 100%; max-height: 90vh; overflow-y: auto; padding: 0; }
    .modal-header { padding: 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; }
    .modal-body { padding: 1.5rem; }
    .modal-footer { padding: 1rem 1.5rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; gap: 0.75rem; }
    
    .calendar-view { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; }
    .calendar-day { background: var(--light-color); border: 1px solid var(--border-color); padding: 0.75rem; min-height: 100px; border-radius: var(--radius); }
    .calendar-event { background: white; border-left: 3px solid var(--primary-color); padding: 0.375rem; margin-bottom: 0.25rem; font-size: 0.75rem; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

    .hidden { display: none !important; }
    .spinner { border: 2px solid var(--border-color); border-top-color: var(--primary-color); border-radius: 50%; width: 1.5rem; height: 1.5rem; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .badge { padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-success { background: var(--primary-light); color: var(--primary-dark); }
    .badge-info { background: #dbeafe; color: #1e40af; }
    
    /* --- Student Database Styles (from old tutor file) --- */
    .status-indicator { padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; display: inline-block; }
    .border-l-4 { border-left-width: 4px; }
    .border-blue-500 { border-color: #3b82f6; }
    .bg-blue-50 { background-color: #eff6ff; }
    .bg-yellow-100 { background-color: #fef3c7; }
    .text-yellow-800 { color: #92400e; }
    .bg-green-50 { background-color: #f0fdf4; }
    .text-green-800 { color: #166534; }
    .bg-red-50 { background-color: #fef2f2; }
    .border-red-400 { border-color: #f87171; }
    .text-red-600 { color: #dc2626; }
    .text-red-700 { color: #b91c1c; }
    .bg-gray-100 { background-color: #f3f4f6; }
    .shadow-inner { box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06); }
    
    /* --- Table Styles --- */
    .min-w-full { min-width: 100%; }
    .divide-y > :not([hidden]) ~ :not([hidden]) { border-top-width: 1px; }
    .divide-gray-200 > :not([hidden]) ~ :not([hidden]) { border-color: #e5e7eb; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
    .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
    .text-left { text-align: left; }
    .text-xs { font-size: 0.75rem; }
    .text-sm { font-size: 0.875rem; }
    .font-medium { font-weight: 500; }
    .uppercase { text-transform: uppercase; }
    .whitespace-nowrap { white-space: nowrap; }
    .bg-white { background-color: white; }
    .overflow-x-auto { overflow-x: auto; }
    .space-x-2 > :not([hidden]) ~ :not([hidden]) { margin-left: 0.5rem; }
    
    /* --- Grid and Flex Utilities --- */
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sm\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .gap-2 { gap: 0.5rem; }
    .flex { display: flex; }
    .items-center { align-items: center; }
    .justify-end { justify-content: flex-end; }
    .space-x-2 > * + * { margin-left: 0.5rem; }
    .space-y-2 > * + * { margin-top: 0.5rem; }
    .space-y-4 > * + * { margin-top: 1rem; }
    .mt-1 { margin-top: 0.25rem; }
    .mt-2 { margin-top: 0.5rem; }
    .mt-3 { margin-top: 0.75rem; }
    .mt-4 { margin-top: 1rem; }
    .mt-6 { margin-top: 1.5rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1rem; }
    .mb-6 { margin-bottom: 1.5rem; }
    .ml-2 { margin-left: 0.5rem; }
    
    /* --- Text Colors --- */
    .text-gray-500 { color: #6b7280; }
    .text-gray-600 { color: #4b5563; }
    .text-gray-700 { color: #374151; }
    .text-blue-500 { color: #3b82f6; }
    .text-blue-600 { color: #2563eb; }
    .text-blue-800 { color: #1e40af; }
    .text-green-600 { color: #059669; }
    .text-green-700 { color: #047857; }
    .text-green-800 { color: #065f46; }
    .text-yellow-600 { color: #d97706; }
    .text-orange-600 { color: #ea580c; }
    .text-orange-800 { color: #9a3412; }
    .text-red-500 { color: #ef4444; }
    
    /* --- Background Colors --- */
    .bg-orange-100 { background-color: #ffedd5; }
    .bg-gray-50 { background-color: #f9fafb; }
    .bg-blue-50 { background-color: #eff6ff; }
    .bg-green-50 { background-color: #f0fdf4; }
    .bg-yellow-50 { background-color: #fefce8; }
    .bg-yellow-500 { background-color: #eab308; }
    .bg-blue-500 { background-color: #3b82f6; }
    .bg-red-500 { background-color: #ef4444; }
    .bg-green-500 { background-color: #10b981; }
    .bg-green-600 { background-color: #059669; }
    .bg-green-700 { background-color: #047857; }
    .bg-orange-600 { background-color: #ea580c; }
    .bg-orange-700 { background-color: #c2410c; }
    .bg-gray-500 { background-color: #6b7280; }
    
    /* --- Borders --- */
    .border { border-width: 1px; }
    .border-t { border-top-width: 1px; }
    .border-l-4 { border-left-width: 4px; }
    .rounded { border-radius: 0.25rem; }
    .rounded-lg { border-radius: 0.5rem; }
    .rounded-full { border-radius: 9999px; }
    
    /* --- Shadows --- */
    .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
    .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); }
    
    /* --- Padding --- */
    .p-2 { padding: 0.5rem; }
    .p-3 { padding: 0.75rem; }
    .p-4 { padding: 1rem; }
    .p-6 { padding: 1.5rem; }
    .p-8 { padding: 2rem; }
    .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
    .px-4 { padding-left: 1rem; padding-right: 1rem; }
    .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
    .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
    .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
    
    /* --- Font Weights --- */
    .font-normal { font-weight: 400; }
    .font-semibold { font-weight: 600; }
    .font-bold { font-weight: 700; }
    
    /* --- Display --- */
    .block { display: block; }
    .inline-block { display: inline-block; }
    
    /* --- Cursor --- */
    .cursor-pointer { cursor: pointer; }
    
    /* --- Hover Effects --- */
    .hover\\:bg-green-700:hover { background-color: #047857; }
    .hover\\:bg-orange-700:hover { background-color: #c2410c; }
    .hover\\:underline:hover { text-decoration: underline; }
    
    /* --- Opacity --- */
    .opacity-50 { opacity: 0.5; }
    
    /* --- Cursor --- */
    .cursor-not-allowed { cursor: not-allowed; }
    
    /* --- Position --- */
    .relative { position: relative; }
    .absolute { position: absolute; }
    .fixed { position: fixed; }
    .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
    
    /* --- Z-index --- */
    .z-50 { z-index: 50; }
    
    /* --- Overflow --- */
    .overflow-y-auto { overflow-y: auto; }
    
    /* --- Max Height/Width --- */
    .max-h-48 { max-height: 12rem; }
    .max-w-md { max-width: 28rem; }
    .max-w-lg { max-width: 32rem; }
    .max-w-2xl { max-width: 42rem; }
    
    /* --- Details/Summary Styling --- */
    details > summary { list-style: none; }
    details > summary::-webkit-details-marker { display: none; }
    
    /* --- Validation Styles --- */
    .border-red-300 { border-color: #fca5a5 !important; }
    .border-green-300 { border-color: #86efac !important; }
    .border-red-500 { border-color: #ef4444 !important; }
    .border-green-500 { border-color: #22c55e !important; }
    
    /* --- Float --- */
    .float-right { float: right; }
    
    /* --- Text Style --- */
    .italic { font-style: italic; }
`;
document.head.appendChild(style);

// --- Pay Scheme Configuration ---
const PAY_SCHEMES = {
    NEW_TUTOR: {
        academic: { "Preschool-Grade 2": {2: 50000, 3: 60000, 5: 100000}, "Grade 3-8": {2: 60000, 3: 70000, 5: 110000}, "Subject Teachers": {1: 30000, 2: 60000, 3: 70000} },
        specialized: { individual: { "Music": 30000, "Native Language": 20000, "Foreign Language": 25000, "Coding": 30000, "ICT": 10000, "Chess": 25000, "Public Speaking": 25000, "English Proficiency": 25000, "Counseling Programs": 25000}, group: { "Music": 25000, "Native Language": 20000, "Foreign Language": 20000, "Chess": 20000, "Public Speaking": 20000, "English Proficiency": 20000, "Counseling Programs": 20000 } }
    },
    OLD_TUTOR: {
        academic: { "Preschool-Grade 2": {2: 60000, 3: 70000, 5: 110000}, "Grade 3-8": {2: 70000, 3: 80000, 5: 120000}, "Subject Teachers": {1: 35000, 2: 70000, 3: 90000} },
        specialized: { individual: { "Music": 35000, "Native Language": 25000, "Foreign Language": 30000, "Coding": 35000, "ICT": 12000, "Chess": 30000, "Public Speaking": 30000, "English Proficiency": 30000, "Counseling Programs": 30000 }, group: { "Music": 25000, "Native Language": 20000, "Foreign Language": 20000, "Chess": 20000, "Public Speaking": 20000, "English Proficiency": 20000, "Counseling Programs": 20000 } }
    },
    MANAGEMENT: {
        academic: { "Preschool-Grade 2": {2: 70000, 3: 85000, 5: 120000}, "Grade 3-8": {2: 80000, 3: 90000, 5: 130000}, "Subject Teachers": {1: 40000, 2: 80000, 3: 100000} },
        specialized: { individual: { "Music": 40000, "Native Language": 30000, "Foreign Language": 35000, "Coding": 40000, "Chess": 35000, "Public Speaking": 35000, "English Proficiency": 35000, "Counseling Programs": 35000 }, group: { "Music": 25000, "Native Language": 20000, "Foreign Language": 20000, "Chess": 20000, "Public Speaking": 20000, "English Proficiency": 20000, "Counseling Programs": 20000 } }
    }
};

const SUBJECT_CATEGORIES = {
    "Native Language": ["Yoruba", "Igbo", "Hausa"],
    "Foreign Language": ["French", "German", "Spanish", "Arabic"],
    "Specialized": ["Music", "Coding","ICT", "Chess", "Public Speaking", "English Proficiency", "Counseling Programs"]
};

// --- Utilities ---
function normalizePhoneNumber(phone) {
    if (!phone) return '';
    let cleaned = phone.toString().trim().replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '234' + cleaned.substring(1);
    if (!cleaned.startsWith('234')) cleaned = '234' + cleaned;
    return '+' + cleaned;
}

function getCurrentMonthYear() {
    const now = new Date();
    return now.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function showCustomAlert(message) {
    const d = document.createElement('div');
    d.className = 'modal-overlay';
    d.innerHTML = `<div class="modal-content" style="max-width:300px"><div class="modal-body text-center"><p>${message}</p><button class="btn btn-primary mt-4" id="custom-alert-ok">OK</button></div></div>`;
    document.body.appendChild(d);
    document.getElementById('custom-alert-ok').onclick = () => d.remove();
}

// --- Persistence Functions ---
async function saveReportsToFirestore(tutorEmail, reports) {
    try {
        await setDoc(doc(db, "tutor_saved_reports", tutorEmail), { reports: reports, lastUpdated: new Date() }, { merge: true });
    } catch (error) { console.warn('Error saving to Firestore:', error); saveReportsToLocalStorage(tutorEmail, reports); }
}

async function loadReportsFromFirestore(tutorEmail) {
    try {
        const docSnap = await getDoc(doc(db, "tutor_saved_reports", tutorEmail));
        return docSnap.exists() ? docSnap.data().reports || {} : loadReportsFromLocalStorage(tutorEmail);
    } catch (error) { return loadReportsFromLocalStorage(tutorEmail); }
}

async function clearAllReportsFromFirestore(tutorEmail) {
    try {
        await updateDoc(doc(db, "tutor_saved_reports", tutorEmail), { reports: {}, lastUpdated: new Date() });
    } catch (error) { clearAllReportsFromLocalStorage(tutorEmail); }
}

// Fallback Local Storage
const getLocalReportsKey = (tutorEmail) => `savedReports_${tutorEmail}`;
function saveReportsToLocalStorage(tutorEmail, reports) { try { localStorage.setItem(getLocalReportsKey(tutorEmail), JSON.stringify(reports)); } catch (e) {} }
function loadReportsFromLocalStorage(tutorEmail) { try { const s = localStorage.getItem(getLocalReportsKey(tutorEmail)); return s ? JSON.parse(s) : {}; } catch (e) { return {}; } }
function clearAllReportsFromLocalStorage(tutorEmail) { try { localStorage.removeItem(getLocalReportsKey(tutorEmail)); } catch (e) {} }

// --- Employment & TIN Logic ---
function shouldShowEmploymentPopup(tutor) {
    if (tutor.employmentDate) return false;
    const last = localStorage.getItem(`employmentPopup_${tutor.email}`);
    return !last || last !== new Date().toISOString().slice(0, 7);
}

function showEmploymentDatePopup(tutor) {
    const html = `<div class="modal-overlay"><div class="modal-content max-w-md"><div class="modal-header"><h3>Employment Information</h3></div><div class="modal-body"><p class="mb-4">Please provide your employment start date.</p><input type="month" id="employment-date" class="form-input"></div><div class="modal-footer"><button id="save-employment-btn" class="btn btn-primary">Save</button></div></div></div>`;
    const m = document.createElement('div'); m.innerHTML = html; document.body.appendChild(m);
    document.getElementById('save-employment-btn').onclick = async () => {
        const date = document.getElementById('employment-date').value;
        if (!date) return showCustomAlert('Please select a date.');
        await updateDoc(doc(db, "tutors", tutor.id), { employmentDate: date });
        localStorage.setItem(`employmentPopup_${tutor.email}`, new Date().toISOString().slice(0, 7));
        m.remove(); showCustomAlert('Saved!');
        window.tutorData.employmentDate = date;
    };
}

function shouldShowTINPopup(tutor) {
    if (tutor.tinNumber) return false;
    const last = localStorage.getItem(`tinPopup_${tutor.email}`);
    return !last || last !== new Date().toISOString().slice(0, 7);
}

function showTINPopup(tutor) {
    const html = `<div class="modal-overlay"><div class="modal-content max-w-md"><div class="modal-header"><h3>TIN Number</h3></div><div class="modal-body"><p class="mb-4">Please provide your TIN.</p><input type="text" id="tin-number" class="form-input" placeholder="Enter TIN"></div><div class="modal-footer"><button id="no-tin-btn" class="btn btn-secondary">I don't have TIN</button><button id="save-tin-btn" class="btn btn-primary">Save TIN</button></div></div></div>`;
    const m = document.createElement('div'); m.innerHTML = html; document.body.appendChild(m);
    document.getElementById('no-tin-btn').onclick = () => { localStorage.setItem(`tinPopup_${tutor.email}`, new Date().toISOString().slice(0, 7)); m.remove(); };
    document.getElementById('save-tin-btn').onclick = async () => {
        const tin = document.getElementById('tin-number').value.trim();
        if (!tin) return showCustomAlert('Please enter TIN.');
        await updateDoc(doc(db, "tutors", tutor.id), { tinNumber: tin });
        m.remove(); showCustomAlert('TIN Saved!');
        window.tutorData.tinNumber = tin;
    };
}

function getTutorPayScheme(tutor) {
    if (tutor.isManagementStaff) return PAY_SCHEMES.MANAGEMENT;
    if (!tutor.employmentDate) return PAY_SCHEMES.NEW_TUTOR;
    const emp = new Date(tutor.employmentDate + '-01');
    const diff = (new Date().getFullYear() - emp.getFullYear()) * 12 + (new Date().getMonth() - emp.getMonth());
    return diff >= 12 ? PAY_SCHEMES.OLD_TUTOR : PAY_SCHEMES.NEW_TUTOR;
}

function findSpecializedSubject(subjects) {
    for (const [cat, list] of Object.entries(SUBJECT_CATEGORIES)) {
        for (const sub of subjects) { if (list.includes(sub)) return { category: cat, subject: sub }; }
    }
    return null;
}

function calculateSuggestedFee(student, payScheme) {
    const grade = student.grade;
    const days = parseInt(student.days) || 0;
    const subjects = student.subjects || [];
    
    const spec = findSpecializedSubject(subjects);
    if (spec) return payScheme.specialized[student.groupClass ? 'group' : 'individual'][spec.category] || 0;
    
    let gradeCat = "Grade 3-8";
    if (["Preschool", "Kindergarten"].includes(grade) || grade.includes("Grade 1") || grade.includes("Grade 2")) gradeCat = "Preschool-Grade 2";
    else if (parseInt(grade.replace('Grade ', '')) >= 9) return 0;
    
    const isSub = subjects.some(s => ["Math", "English", "Science"].includes(s)) && parseInt(grade.replace('Grade ', '')) >= 5;
    return isSub ? (payScheme.academic["Subject Teachers"][days] || 0) : (payScheme.academic[gradeCat][days] || 0);
}

// ##################################################################
// # SECTION 1: TUTOR DASHBOARD & NEW FEATURES (MERGED)
// ##################################################################

// --- Cloudinary Upload ---
async function uploadToCloudinary(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    fd.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    return { url: data.secure_url, name: file.name };
}

// --- Schedule Logic (Bulk Setup) ---
let schedulePopup = null;
let allStudents = [], scheduledStudents = new Set(), currentStudentIndex = 0;

async function checkAndShowSchedulePopup(tutor) {
    try {
        const q = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
        const snap = await getDocs(q);
        allStudents = []; scheduledStudents.clear();
        snap.forEach(d => {
            const s = { id: d.id, ...d.data() };
            if (!['archived', 'graduated'].includes(s.status)) {
                allStudents.push(s);
                if (s.schedule && s.schedule.length > 0) scheduledStudents.add(s.id);
            }
        });
        
        const unscheduled = allStudents.filter(s => !scheduledStudents.has(s.id));
        if (unscheduled.length > 0) {
            showBulkSchedulePopup(unscheduled[0], tutor, unscheduled.length);
        } else {
            showCustomAlert("✅ All students have schedules!");
        }
    } catch (e) { console.error(e); showCustomAlert("Error loading students."); }
}

function showBulkSchedulePopup(student, tutor, remaining) {
    if (schedulePopup) schedulePopup.remove();
    const existing = student.schedule || [];
    
    const html = `
    <div class="modal-overlay">
        <div class="modal-content max-w-2xl">
            <div class="modal-header"><h3>📅 Schedule: ${student.studentName}</h3><span class="badge badge-info">${remaining} Left</span></div>
            <div class="modal-body">
                <div id="schedule-entries" class="space-y-4"></div>
                <button id="add-entry" class="btn btn-secondary w-full mt-3">+ Add Slot</button>
            </div>
            <div class="modal-footer">
                <button id="skip-btn" class="btn btn-secondary">Skip</button>
                <button id="save-sched-btn" class="btn btn-primary">Save & Next</button>
            </div>
        </div>
    </div>`;
    
    schedulePopup = document.createElement('div');
    schedulePopup.innerHTML = html;
    document.body.appendChild(schedulePopup);

    const renderEntry = (data = null) => `
        <div class="schedule-entry bg-gray-50 p-3 rounded border relative">
            <button class="remove-btn absolute top-0 right-0 text-red-500 p-1">✕</button>
            <div class="grid grid-cols-3 gap-2">
                <select class="s-day form-input">${DAYS_OF_WEEK.map(d => `<option value="${d}" ${data && data.day === d ? 'selected' : ''}>${d}</option>`).join('')}</select>
                <select class="s-start form-input">${ROBUST_TIME_SLOTS.map(t => `<option value="${t.value}" ${data && data.start === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}</select>
                <select class="s-end form-input">${ROBUST_TIME_SLOTS.map(t => `<option value="${t.value}" ${data && data.end === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}</select>
            </div>
        </div>`;

    const container = document.getElementById('schedule-entries');
    if (existing.length) existing.forEach(e => container.innerHTML += renderEntry(e));
    else container.innerHTML += renderEntry();

    container.addEventListener('click', e => { if (e.target.classList.contains('remove-btn')) e.target.closest('.schedule-entry').remove(); });
    document.getElementById('add-entry').onclick = () => container.insertAdjacentHTML('beforeend', renderEntry());
    
    document.getElementById('save-sched-btn').onclick = async () => {
        const schedule = [];
        document.querySelectorAll('.schedule-entry').forEach(el => {
            schedule.push({
                day: el.querySelector('.s-day').value,
                start: el.querySelector('.s-start').value,
                end: el.querySelector('.s-end').value
            });
        });
        
        await updateDoc(doc(db, "students", student.id), { schedule });
        scheduledStudents.add(student.id);
        moveNext(tutor);
    };
    
    document.getElementById('skip-btn').onclick = () => { currentStudentIndex++; moveNext(tutor); };

    function moveNext(t) {
        schedulePopup.remove();
        const pending = allStudents.filter(s => !scheduledStudents.has(s.id));
        if (pending.length > 0 && currentStudentIndex < pending.length) {
            showBulkSchedulePopup(pending[currentStudentIndex], t, pending.length);
        } else {
            showCustomAlert("Done with queue!");
        }
    }
}

// --- Topic Modal ---
function showDailyTopicModal(student) {
    const html = `
    <div class="modal-overlay">
        <div class="modal-content max-w-lg">
            <div class="modal-header"><h3>📚 Daily Topic: ${student.studentName}</h3></div>
            <div class="modal-body">
                <label class="form-label">Enter Topic</label>
                <textarea id="topic-txt" class="form-input" rows="4"></textarea>
            </div>
            <div class="modal-footer"><button class="btn btn-primary" id="save-topic">Save</button><button class="btn btn-secondary" id="close-topic">Close</button></div>
        </div>
    </div>`;
    const m = document.createElement('div'); m.innerHTML = html; document.body.appendChild(m);
    document.getElementById('close-topic').onclick = () => m.remove();
    
    document.getElementById('save-topic').onclick = async () => {
        const txt = document.getElementById('topic-txt').value;
        if (!txt) return;
        await setDoc(doc(collection(db, "daily_topics")), {
            studentId: student.id, studentName: student.studentName,
            topics: txt, date: new Date().toISOString().split('T')[0], createdAt: new Date()
        });
        m.remove(); showCustomAlert("Topic Saved!");
    };
}

// --- Homework Modal ---
function showHomeworkModal(student) {
    const html = `
    <div class="modal-overlay">
        <div class="modal-content max-w-lg">
            <div class="modal-header"><h3>📝 Assign Homework: ${student.studentName}</h3></div>
            <div class="modal-body">
                <input id="hw-title" class="form-input" placeholder="Title">
                <textarea id="hw-desc" class="form-input" placeholder="Instructions"></textarea>
                <input id="hw-date" type="date" class="form-input">
                <input id="hw-file" type="file" class="form-input">
            </div>
            <div class="modal-footer"><button id="save-hw" class="btn btn-primary">Assign</button><button class="btn btn-secondary" id="close-hw">Cancel</button></div>
        </div>
    </div>`;
    const m = document.createElement('div'); m.innerHTML = html; document.body.appendChild(m);
    document.getElementById('close-hw').onclick = () => m.remove();
    
    document.getElementById('save-hw').onclick = async () => {
        const title = document.getElementById('hw-title').value;
        const desc = document.getElementById('hw-desc').value;
        const date = document.getElementById('hw-date').value;
        const file = document.getElementById('hw-file').files[0];
        
        if (!title || !date) return showCustomAlert("Title and Date required");
        
        document.getElementById('save-hw').innerText = "Uploading...";
        let attachment = null;
        if (file) attachment = await uploadToCloudinary(file);
        
        await addDoc(collection(db, "homework_assignments"), {
            studentId: student.id, studentName: student.studentName,
            title, description: desc, dueDate: date,
            attachments: attachment ? [attachment] : [],
            createdAt: new Date(), status: 'assigned',
            parentEmail: student.parentEmail || ''
        });
        
        m.remove(); showCustomAlert("Homework Assigned!");
    };
}

// --- Calendar Modal ---
function formatScheduleTime(time) {
    const [h, m] = time.split(':').map(Number);
    const p = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${p}`;
}

async function showScheduleCalendarModal() {
    const m = document.createElement('div'); m.className = 'modal-overlay';
    m.innerHTML = `<div class="modal-content max-w-6xl"><div class="modal-header"><h3>📅 Calendar</h3><button class="btn btn-secondary" id="close-cal">Close</button></div><div class="modal-body" id="cal-body"><div class="spinner"></div></div></div>`;
    document.body.appendChild(m);
    document.getElementById('close-cal').onclick = () => m.remove();

    const q = query(collection(db, "students"), where("tutorEmail", "==", window.tutorData.email));
    const snap = await getDocs(q);
    const scheduleMap = {};
    DAYS_OF_WEEK.forEach(d => scheduleMap[d] = []);

    snap.forEach(d => {
        const s = d.data();
        if (s.schedule) {
            s.schedule.forEach(slot => {
                scheduleMap[slot.day].push({ ...slot, student: s.studentName, grade: s.grade });
            });
        }
    });

    let html = `<div class="calendar-view">`;
    DAYS_OF_WEEK.forEach(day => {
        scheduleMap[day].sort((a,b) => a.start.localeCompare(b.start));
        html += `<div class="calendar-day"><div class="font-bold mb-2 border-bottom">${day}</div>`;
        if (scheduleMap[day].length === 0) html += `<div class="text-gray-400 text-xs">No classes</div>`;
        scheduleMap[day].forEach(ev => {
            html += `<div class="calendar-event">
                <div class="font-bold">${ev.student}</div>
                <div>${formatScheduleTime(ev.start)} - ${formatScheduleTime(ev.end)}</div>
                <div class="text-xs text-gray-500">${ev.grade}</div>
            </div>`;
        });
        html += `</div>`;
    });
    html += `</div>`;
    document.getElementById('cal-body').innerHTML = html;
}

// --- Load Student Dropdowns (Single Declaration) ---
async function loadStudentDropdowns(email) {
    const q = query(collection(db, "students"), where("tutorEmail", "==", email));
    const snap = await getDocs(q);
    studentCache = [];
    const topicSel = document.getElementById('topic-student-sel');
    const hwSel = document.getElementById('hw-student-sel');

    if (topicSel) topicSel.innerHTML = '<option value="">Select Student...</option>';
    if (hwSel) hwSel.innerHTML = '<option value="">Select Student...</option>';

    snap.forEach(d => {
        const s = { id: d.id, ...d.data() };
        if (!['archived','graduated'].includes(s.status)) {
            studentCache.push(s);
            const opt = `<option value="${s.id}">${s.studentName}</option>`;
            if (topicSel) topicSel.innerHTML += opt;
            if (hwSel) hwSel.innerHTML += opt;
        }
    });
}

function renderTutorDashboard(container, tutor) {
    if (!tutor) { console.error("No tutor data"); return; }
    window.tutorData = tutor;

    container.innerHTML = `
        <div class="hero-section">
            <h1 class="hero-title">Welcome, ${tutor.name || 'Tutor'}! 👋</h1>
            <p>Manage your students, schedules, and reports.</p>
            <div class="mt-4">
                <input type="text" id="searchName" class="p-2 border rounded text-black" placeholder="Search by parent name..." style="min-width: 250px;">
                <button id="searchBtn" class="bg-white text-green-700 font-bold px-4 py-2 rounded hover:bg-gray-100 ml-2">Search</button>
            </div>
        </div>
        
        <div class="student-actions-container">
            <div class="student-action-card">
                <h3 class="font-bold mb-2">📅 Schedule</h3>
                <button id="view-cal" class="btn btn-info w-full mb-2">View Calendar</button>
                <button id="setup-sched" class="btn btn-primary w-full">Set Up Schedules</button>
            </div>
            
            <div class="student-action-card">
                <h3 class="font-bold mb-2">📚 Today's Topic</h3>
                <select id="topic-student-sel" class="form-input mb-2"><option value="">Select Student...</option></select>
                <button id="add-topic" class="btn btn-secondary w-full" disabled>Add Topic</button>
            </div>
            
            <div class="student-action-card">
                <h3 class="font-bold mb-2">📝 Homework</h3>
                <select id="hw-student-sel" class="form-input mb-2"><option value="">Select Student...</option></select>
                <button id="assign-hw" class="btn btn-warning w-full" disabled>Assign Homework</button>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header"><h3 class="font-bold">📋 Recent Activity / Pending Grading</h3></div>
            <div class="card-body">
                <div id="pendingReportsContainer" class="space-y-4">
                    <p class="text-gray-500">Loading pending submissions...</p>
                </div>
                <div id="gradedReportsContainer" class="space-y-4 mt-8 pt-8 border-t">
                    <h4 class="font-semibold text-gray-500 mb-4">Graded History</h4>
                    <p class="text-gray-500">Loading graded submissions...</p>
                </div>
            </div>
        </div>
    `;

    // Load Data
    loadStudentDropdowns(tutor.email);
    loadTutorReports(tutor.email);

    // Event Listeners
    document.getElementById('searchBtn').addEventListener('click', async () => {
        const name = document.getElementById('searchName').value.trim();
        await loadTutorReports(tutor.email, name || null);
    });

    document.getElementById('view-cal').onclick = showScheduleCalendarModal;
    document.getElementById('setup-sched').onclick = () => checkAndShowSchedulePopup(tutor);
    
    const topicSel = document.getElementById('topic-student-sel');
    const topicBtn = document.getElementById('add-topic');
    topicSel.onchange = () => topicBtn.disabled = !topicSel.value;
    topicBtn.onclick = () => {
        const s = studentCache.find(x => x.id === topicSel.value);
        if (s) showDailyTopicModal(s);
    };

    const hwSel = document.getElementById('hw-student-sel');
    const hwBtn = document.getElementById('assign-hw');
    hwSel.onchange = () => hwBtn.disabled = !hwSel.value;
    hwBtn.onclick = () => {
        const s = studentCache.find(x => x.id === hwSel.value);
        if (s) showHomeworkModal(s);
    };
}

// UPDATED: Load reports from BOTH student_results AND tutor_submissions
async function loadTutorReports(tutorEmail, parentName = null) {
    const pendingReportsContainer = document.getElementById('pendingReportsContainer');
    const gradedReportsContainer = document.getElementById('gradedReportsContainer');
    pendingReportsContainer.innerHTML = `<div class="spinner"></div>`;
    if (gradedReportsContainer) gradedReportsContainer.innerHTML = `<p class="text-gray-500">Loading...</p>`;

    try {
        // QUERY 1: Multiple-choice tests from student_results
        let assessmentsQuery = query(
            collection(db, "student_results"), 
            where("tutorEmail", "==", tutorEmail)
        );

        if (parentName) {
            assessmentsQuery = query(assessmentsQuery, where("parentName", "==", parentName));
        }

        // QUERY 2: Creative writing submissions from tutor_submissions
        let creativeWritingQuery = query(
            collection(db, "tutor_submissions"),
            where("tutorEmail", "==", tutorEmail),
            where("type", "==", "creative_writing")
        );

        if (parentName) {
            creativeWritingQuery = query(creativeWritingQuery, where("parentName", "==", parentName));
        }

        // Fetch from both collections simultaneously
        const [assessmentsSnapshot, creativeWritingSnapshot] = await Promise.all([
            getDocs(assessmentsQuery),
            getDocs(creativeWritingQuery)
        ]);

        let pendingHTML = '';
        let gradedHTML = '';

        // Process multiple-choice test results
        assessmentsSnapshot.forEach(doc => {
            const data = doc.data();
            
            // Check if this assessment needs tutor feedback (creative writing or pending review)
            const needsFeedback = data.answers && data.answers.some(answer => 
                answer.type === 'creative-writing' && 
                (!answer.tutorReport || answer.tutorReport.trim() === '')
            );

            const reportCardHTML = `
                <div class="border rounded-lg p-4 shadow-sm bg-white mb-4">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-lg">${data.studentName}</h4>
                            <p class="text-sm text-gray-600">Grade: ${data.grade} | Parent: ${data.parentName || 'N/A'}</p>
                            <p class="text-xs text-gray-500 mt-1">Submitted: ${new Date(data.submittedAt.seconds * 1000).toLocaleString()}</p>
                        </div>
                        <span class="badge ${needsFeedback ? 'badge-warning' : 'badge-success'}">${needsFeedback ? 'Needs Grading' : 'Graded'}</span>
                    </div>
                    
                    <div class="mt-4 border-t pt-4">
                        ${data.answers ? data.answers.map((answer, idx) => {
                            if (answer.type === 'creative-writing') {
                                return `
                                    <div class="mb-3 p-3 bg-gray-50 rounded">
                                        <p class="font-semibold text-sm">Creative Writing:</p>
                                        <p class="italic text-gray-700 my-2 p-2 bg-white border rounded">${answer.textAnswer || "No response"}</p>
                                        ${answer.fileUrl ? `<a href="${answer.fileUrl}" target="_blank" class="text-green-600 hover:underline text-sm">📄 Download Attachment</a>` : ''}
                                        
                                        ${!answer.tutorReport ? `
                                            <div class="mt-3">
                                                <textarea class="tutor-report form-input" rows="3" placeholder="Write your feedback here..."></textarea>
                                                <button class="submit-report-btn btn btn-primary btn-sm mt-2" data-doc-id="${doc.id}" data-collection="student_results" data-answer-index="${idx}">Submit Feedback</button>
                                            </div>
                                        ` : `
                                            <div class="mt-3 p-2 bg-green-50 border border-green-100 rounded">
                                                <p class="text-sm font-semibold text-green-800">Your Feedback:</p>
                                                <p class="text-sm text-green-700">${answer.tutorReport}</p>
                                            </div>
                                        `}
                                    </div>
                                `;
                            }
                            return '';
                        }).join('') : '<p>No assessment data available.</p>'}
                    </div>
                </div>
            `;

            if (needsFeedback) {
                pendingHTML += reportCardHTML;
            } else {
                gradedHTML += reportCardHTML;
            }
        });

        // Process creative writing submissions
        creativeWritingSnapshot.forEach(doc => {
            const data = doc.data();
            const needsFeedback = !data.tutorReport || data.tutorReport.trim() === '';

            const creativeWritingHTML = `
                <div class="border rounded-lg p-4 shadow-sm bg-white mb-4 border-l-4 border-blue-500">
                    <div class="flex justify-between items-start">
                        <div>
                            <h4 class="font-bold text-lg">${data.studentName}</h4>
                            <p class="text-sm text-gray-600">Type: Creative Writing Assignment</p>
                            <p class="text-xs text-gray-500 mt-1">Submitted: ${new Date(data.submittedAt.seconds * 1000).toLocaleString()}</p>
                        </div>
                         <span class="badge ${needsFeedback ? 'badge-warning' : 'badge-success'}">${needsFeedback ? 'Needs Grading' : 'Graded'}</span>
                    </div>

                    <div class="mt-4 border-t pt-4">
                        <div class="mb-3 p-3 bg-blue-50 rounded">
                            <p class="font-semibold text-sm">Prompt: ${data.questionText || 'Creative Writing Assignment'}</p>
                            <p class="italic text-gray-700 my-2 p-3 bg-white border rounded">${data.textAnswer || "No response"}</p>
                            ${data.fileUrl ? `<a href="${data.fileUrl}" target="_blank" class="text-green-600 hover:underline text-sm block mb-2">📄 Download Attached File</a>` : ''}
                            
                            ${!data.tutorReport ? `
                                <div class="mt-3">
                                    <textarea class="tutor-report form-input" rows="3" placeholder="Write your feedback here..."></textarea>
                                    <button class="submit-report-btn btn btn-primary btn-sm mt-2" data-doc-id="${doc.id}" data-collection="tutor_submissions">Submit Feedback</button>
                                </div>
                            ` : `
                                <div class="mt-3 p-2 bg-green-50 border border-green-100 rounded">
                                    <p class="text-sm font-semibold text-green-800">Your Feedback:</p>
                                    <p class="text-sm text-green-700">${data.tutorReport}</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;

            if (needsFeedback) {
                pendingHTML += creativeWritingHTML;
            } else {
                gradedHTML += creativeWritingHTML;
            }
        });

        pendingReportsContainer.innerHTML = pendingHTML || `<p class="text-gray-500 italic">No pending submissions found.</p>`;
        if (gradedReportsContainer) gradedReportsContainer.innerHTML = gradedHTML || `<p class="text-gray-500 italic">No graded submissions found.</p>`;

        // Attach event listeners for the submit buttons
        document.querySelectorAll('.submit-report-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const docId = e.target.getAttribute('data-doc-id');
                const collectionName = e.target.getAttribute('data-collection');
                const answerIndex = e.target.getAttribute('data-answer-index');
                // Find the closest textarea relative to the button
                const reportTextarea = e.target.parentElement.querySelector('.tutor-report');
                const tutorReport = reportTextarea.value.trim();
                
                if (tutorReport) {
                    try {
                        const docRef = doc(db, collectionName, docId);
                        
                        if (collectionName === "student_results" && answerIndex !== null) {
                            const docSnap = await getDoc(docRef);
                            const currentData = docSnap.data();
                            const updatedAnswers = [...currentData.answers];
                            updatedAnswers[parseInt(answerIndex)] = {
                                ...updatedAnswers[parseInt(answerIndex)],
                                tutorReport: tutorReport,
                                gradedAt: new Date()
                            };
                            await updateDoc(docRef, { 
                                answers: updatedAnswers,
                                hasTutorFeedback: true
                            });
                        } else {
                            await updateDoc(docRef, { 
                                tutorReport: tutorReport,
                                gradedAt: new Date(),
                                status: "graded"
                            });
                        }
                        
                        showCustomAlert('Feedback submitted successfully!');
                        loadTutorReports(tutorEmail, parentName); // Refresh
                    } catch (error) {
                        console.error("Error submitting feedback:", error);
                        showCustomAlert('Failed to submit feedback. Please try again.');
                    }
                } else {
                    showCustomAlert('Please write some feedback before submitting.');
                }
            });
        });
    } catch (error) {
        console.error("Error loading tutor reports:", error);
        pendingReportsContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;
    }
}

// ##################################################################
// # SECTION 2: STUDENT DATABASE FUNCTIONALITY (MERGED FROM OLD FILE)
// ##################################################################

// This is the integrated Student Database functionality from your code

function renderStudentDatabase(container, tutor) {
    container.innerHTML = `
        <div id="student-list-view" class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Student Database</h2>
            <div class="mb-4 flex justify-between">
                <input type="text" id="searchStudent" class="w-full mt-1 p-2 border rounded" placeholder="Search by student or parent name...">
                <button id="searchStudentBtn" class="bg-green-600 text-white px-4 py-2 rounded ml-2 hover:bg-green-700">Search</button>
            </div>
            <div id="studentListContainer" class="space-y-4">
                <p class="text-gray-500">Loading students...</p>
            </div>
        </div>
    `;

    document.getElementById('searchStudentBtn').addEventListener('click', async () => {
        const keyword = document.getElementById('searchStudent').value.trim();
        await loadStudents(tutor, keyword || null);
    });

    loadStudents(tutor);
}

async function loadStudents(tutor, keyword = null) {
    const studentListContainer = document.getElementById('studentListContainer');
    studentListContainer.innerHTML = `<p class="text-gray-500">Loading students...</p>`;

    try {
        let studentsQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
        if (keyword) {
            studentsQuery = query(studentsQuery, where("parentName", "==", keyword));
        }

        const snapshot = await getDocs(studentsQuery);
        let html = '';

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const payScheme = getTutorPayScheme(tutor);
            const suggestedFee = calculateSuggestedFee(data, payScheme);

            html += `
                <div class="border rounded-lg p-4 shadow-sm bg-white mb-4">
                    <p><strong>Student:</strong> ${data.studentName}</p>
                    <p><strong>Parent:</strong> ${data.parentName || 'N/A'}</p>
                    <p><strong>Grade:</strong> ${data.grade}</p>
                    <p><strong>Subjects:</strong> ${data.subjects ? data.subjects.join(', ') : 'N/A'}</p>
                    ${showStudentFees ? `<p><strong>Suggested Fee:</strong> ₦${suggestedFee.toLocaleString()}</p>` : ''}
                    ${showEditDeleteButtons ? `
                        <div class="mt-2 flex space-x-2">
                            <button class="edit-btn bg-blue-600 text-white px-3 py-1 rounded" data-id="${docSnap.id}">Edit</button>
                            <button class="delete-btn bg-red-600 text-white px-3 py-1 rounded" data-id="${docSnap.id}">Delete</button>
                        </div>
                    ` : ''}
                </div>
            `;
        });

        studentListContainer.innerHTML = html || `<p class="text-gray-500">No students found.</p>`;

        if (showEditDeleteButtons) {
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    await deleteDoc(doc(db, "students", id));
                    showCustomAlert('Student deleted successfully!');
                    loadStudents(tutor, keyword);
                });
            });
        }
    } catch (error) {
        console.error("Error loading students:", error);
        studentListContainer.innerHTML = `<p class="text-red-500">Failed to load students.</p>`;
    }
}

// ##################################################################
// # SECTION 3: MAIN APP INITIALIZATION & NAVIGATION
// ##################################################################

// --- Listen for Admin Settings ---
const settingsDocRef = doc(db, "settings", "global_settings");
onSnapshot(settingsDocRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        isSubmissionEnabled = data.isReportEnabled;
        isTutorAddEnabled = data.isTutorAddEnabled;
        isSummerBreakEnabled = data.isSummerBreakEnabled;
        isBypassApprovalEnabled = data.bypassPendingApproval;
        showStudentFees = data.showStudentFees;
        showEditDeleteButtons = data.showEditDeleteButtons;

        const mainContent = document.getElementById('mainContent');
        if (mainContent && mainContent.querySelector('#student-list-view')) {
            renderStudentDatabase(mainContent, window.tutorData);
        }
    }
});

// Auth state listener
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
    } else {
        const tutorQuery = query(collection(db, "tutors"), where("email", "==", user.email));
        const tutorSnapshot = await getDocs(tutorQuery);
        
        if (!tutorSnapshot.empty) {
            const tutorDoc = tutorSnapshot.docs[0];
            const tutor = { id: tutorDoc.id, ...tutorDoc.data() };
            window.tutorData = tutor;
            renderTutorDashboard(document.getElementById('mainContent'), tutor);
            
            // Show popups if needed
            if (shouldShowEmploymentPopup(tutor)) {
                showEmploymentDatePopup(tutor);
            } else if (shouldShowTINPopup(tutor)) {
                showTINPopup(tutor);
            }
        } else {
            document.getElementById('mainContent').innerHTML = `<p class="text-red-500">Error: No tutor profile found for your email.</p>`;
        }
    }
});

// Navigation
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
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

// ##################################################################
// # SECTION 4: AUTO-REGISTERED STUDENTS FUNCTIONALITY
// ##################################################################
document.getElementById('navAutoStudents').addEventListener('click', () => {
    if (window.tutorData) {
        renderAutoRegisteredStudents(document.getElementById('mainContent'), window.tutorData);
    }
});

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

        // Filter out archived, graduated, and transferred students
        let autoStudents = [
            ...studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), collection: "students" }))
                .filter(student => {
                    // Exclude archived, graduated, or transferred students
                    return !student.status || 
                           (student.status !== "archived" && 
                            student.status !== "graduated" && 
                            student.status !== "transferred");
                }),
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
            'badge-info' : 
            'badge-warning';
        
        html += `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="font-medium">${student.studentName}</div>
                    <div class="text-sm text-gray-500">${student.grade} • ${student.parentPhone || 'No phone'}</div>
                    <div class="text-xs text-gray-400">${student.parentEmail || 'No email'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="${statusClass}">
                        ${status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${student.testSubject || 'General Test'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap space-x-2">
                    <button class="complete-student-btn btn btn-primary btn-sm" 
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
