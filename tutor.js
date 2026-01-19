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
    :root { --primary-color: #10b981; --primary-dark: #059669; --primary-light: #d1fae5; --secondary-color: #6366f1; --danger-color: #ef4444; --warning-color: #f59e0b; --info-color: #3b82f6; --dark-color: #1f2937; --light-color: #f9fafb; --border-color: #e5e7eb; --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); --radius: 0.5rem; --radius-lg: 0.75rem; }

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
// # SECTION 1: NEW FEATURES LOGIC (Cloudinary, Schedule, Topics, Homework)
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

// ##################################################################
// # SECTION 2: NEW TUTOR DASHBOARD (MERGED)
// ##################################################################

async function loadStudentDropdowns(email) {
    const q = query(collection(db, "students"), where("tutorEmail", "==", email));
    const snap = await getDocs(q);
    studentCache = [];
    const topicSel = document.getElementById('topic-student-sel');
    const hwSel = document.getElementById('hw-student-sel');

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

// ##################################################################
// # SECTION 2: NEW TUTOR DASHBOARD (MERGED)
// ##################################################################

async function loadStudentDropdowns(email) {
    const q = query(collection(db, "students"), where("tutorEmail", "==", email));
    const snap = await getDocs(q);
    studentCache = [];
    const topicSel = document.getElementById('topic-student-sel');
    const hwSel = document.getElementById('hw-student-sel');

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
    
    // Use the ORIGINAL robust report loader to ensure grading works
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

// [The rest of your existing code remains exactly the same - no changes needed below this line]
// ##################################################################
// # SECTION 2: STUDENT DATABASE (MERGED FUNCTIONALITY) - UPDATED TO EXCLUDE ARCHIVED STUDENTS
// ##################################################################

// Helper function to generate the new student form fields
function getNewStudentFormFields() {
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

    let subjectsHTML = `<h4 class="font-semibold text-gray-700 mt-2">Subjects</h4><div id="new-student-subjects-container" class="space-y-2 border p-3 rounded bg-gray-50 max-h-48 overflow-y-auto">`;
    for (const category in subjectsByCategory) {
        subjectsHTML += `
            <details>
                <summary class="font-semibold cursor-pointer text-sm">${category}</summary>
                <div class="pl-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    ${subjectsByCategory[category].map(subject => `<div><label class="text-sm font-normal"><input type="checkbox" name="subjects" value="${subject}"> ${subject}</label></div>`).join('')}
                </div>
            </details>
        `;
    }
    subjectsHTML += `
        <div class="font-semibold pt-2 border-t"><label class="text-sm"><input type="checkbox" name="subjects" value="Music"> Music</label></div>
    </div>`;

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

// Function to handle grade string formatting
function cleanGradeString(grade) {
    if (grade && grade.toLowerCase().includes("grade")) {
        return grade;
    } else {
        return `Grade ${grade}`;
    }
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

async function renderStudentDatabase(container, tutor) {
    if (!container) {
        console.error("Container element not found.");
        return;
    }

    // CHANGED: Load reports from Firestore (cross-device) instead of localStorage
    let savedReports = await loadReportsFromFirestore(tutor.email);

    // Fetch students and all of the tutor's historical submissions
    // CHANGED: Filter out archived, graduated, and transferred students
    const studentQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
    const pendingStudentQuery = query(collection(db, "pending_students"), where("tutorEmail", "==", tutor.email));
    
    // --- START: MODIFICATION (NO INDEX REQUIRED) ---
    const allSubmissionsQuery = query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutor.email));

    const [studentsSnapshot, pendingStudentsSnapshot, allSubmissionsSnapshot] = await Promise.all([
        getDocs(studentQuery),
        getDocs(pendingStudentQuery),
        getDocs(allSubmissionsQuery)
    ]);

    // CHANGED: Filter out archived, graduated, and transferred students on client side
    let approvedStudents = studentsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), isPending: false, collection: "students" }))
        .filter(student => {
            // Only show active or approved students, exclude archived/graduated/transferred
            return !student.status || 
                   student.status === 'active' || 
                   student.status === 'approved' || 
                   !['archived', 'graduated', 'transferred'].includes(student.status);
        });

    // Now, filter the submissions for the current month here in the code
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const submittedStudentIds = new Set();

    allSubmissionsSnapshot.forEach(doc => {
        const submissionData = doc.data();
        const submissionDate = submissionData.submittedAt.toDate(); // Convert Firestore Timestamp to JS Date
        if (submissionDate.getMonth() === currentMonth && submissionDate.getFullYear() === currentYear) {
            submittedStudentIds.add(submissionData.studentId);
        }
    });

    const pendingStudents = pendingStudentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPending: true, collection: "pending_students" }));

    let students = [...approvedStudents, ...pendingStudents];

    // Duplicate Student Cleanup
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
        await batch.commit();
        console.log(`Cleaned up ${duplicatesToDelete.length} duplicate student entries.`);
    }

    const studentsCount = students.length;

    function renderUI() {
        let studentsHTML = `<h2 class="text-2xl font-bold text-green-700 mb-4">My Students (${studentsCount})</h2>`;
        
        // ALWAYS show the add student section, but conditionally show buttons
        studentsHTML += `
            <div class="bg-gray-100 p-4 rounded-lg shadow-inner mb-4">
                <h3 class="font-bold text-lg mb-2">Add a New Student</h3>
                <div class="space-y-2">
                    ${getNewStudentFormFields()}
                </div>
                <div class="flex space-x-2 mt-3">`;
        
        // Show "Add Student" button only when admin enables it
        if (isTutorAddEnabled) {
            studentsHTML += `<button id="add-student-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Add Student</button>`;
        }
        
        // ALWAYS show "Add Transitioning" button regardless of admin setting
        studentsHTML += `<button id="add-transitioning-btn" class="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700">Add Transitioning</button>`;
        
        studentsHTML += `</div></div>`;
        
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
                const hasSubmittedThisMonth = submittedStudentIds.has(student.id);
                const isStudentOnBreak = student.summerBreak;
                const isReportSaved = savedReports[student.id];
                const isTransitioning = student.isTransitioning;

                const feeDisplay = showStudentFees ? `<div class="text-xs text-gray-500">Fee: ₦${(student.studentFee || 0).toLocaleString()}</div>` : '';
                
                let statusHTML = '';
                let actionsHTML = '';
                
                const subjects = student.subjects ? student.subjects.join(', ') : 'N/A';
                const days = student.days ? `${student.days} days/week` : 'N/A';

                if (student.isPending) {
                    statusHTML = `<span class="status-indicator text-yellow-600 font-semibold">Awaiting Approval</span>`;
                    actionsHTML = `<span class="text-gray-400">No actions available</span>`;
                } else if (hasSubmittedThisMonth) {
                    statusHTML = `<span class="status-indicator text-blue-600 font-semibold">Report Sent</span>`;
                    actionsHTML = `<span class="text-gray-400">Submitted this month</span>`;
                } else {
                    // Add orange indicator for transitioning students
                    const transitioningIndicator = isTransitioning ? `<span class="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full ml-2">Transitioning</span>` : '';
                    
                    statusHTML = `<span class="status-indicator ${isReportSaved ? 'text-green-600 font-semibold' : 'text-gray-500'}">${isReportSaved ? 'Report Saved' : 'Pending Report'}</span>${transitioningIndicator}`;

                    if (isSummerBreakEnabled && !isStudentOnBreak) {
                        actionsHTML += `<button class="summer-break-btn bg-yellow-500 text-white px-3 py-1 rounded" data-student-id="${student.id}">Break</button>`;
                    } else if (isStudentOnBreak) {
                        actionsHTML += `<span class="text-gray-400">On Break</span>`;
                    }

                    if (isSubmissionEnabled && !isStudentOnBreak) {
                        if (approvedStudents.length === 1) {
                            actionsHTML += `<button class="submit-single-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${student.id}" data-is-transitioning="${isTransitioning}">Submit Report</button>`;
                        } else {
                            actionsHTML += `<button class="enter-report-btn bg-green-600 text-white px-3 py-1 rounded" data-student-id="${student.id}" data-is-transitioning="${isTransitioning}">${isReportSaved ? 'Edit Report' : 'Enter Report'}</button>`;
                        }
                    } else if (!isStudentOnBreak) {
                        actionsHTML += `<span class="text-gray-400">Submission Disabled</span>`;
                    }
                    
                    if (showEditDeleteButtons && !isStudentOnBreak) {
                        actionsHTML += `<button class="edit-student-btn-tutor bg-blue-500 text-white px-3 py-1 rounded" data-student-id="${student.id}" data-collection="${student.collection}">Edit</button>`;
                        actionsHTML += `<button class="delete-student-btn-tutor bg-red-500 text-white px-3 py-1 rounded" data-student-id="${student.id}" data-collection="${student.collection}">Delete</button>`;
                    }
                }
                
                studentsHTML += `
                    <tr>
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
            
            if (approvedStudents.length > 1 && isSubmissionEnabled) {
                const submittableStudents = approvedStudents.filter(s => !s.summerBreak && !submittedStudentIds.has(s.id)).length;
                const allReportsSaved = Object.keys(savedReports).length === submittableStudents && submittableStudents > 0;
                
                if (submittableStudents > 0) {
                    studentsHTML += `
                        <div class="mt-6 text-right">
                            <button id="submit-all-reports-btn" class="bg-green-700 text-white px-6 py-3 rounded-lg font-bold ${!allReportsSaved ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-800'}" ${!allReportsSaved ? 'disabled' : ''}>
                                Submit All Reports
                            </button>
                        </div>`;
                }
            }
        }
        container.innerHTML = `<div id="student-list-view" class="bg-white p-6 rounded-lg shadow-md">${studentsHTML}</div>`;
        attachEventListeners();
    }

    function showReportModal(student) {
        // Skip report modal for transitioning students - go directly to fee confirmation
        if (student.isTransitioning) {
            const currentMonthYear = getCurrentMonthYear();
            const reportData = {
                studentId: student.id, 
                studentName: student.studentName, 
                grade: student.grade,
                parentName: student.parentName, 
                parentPhone: student.parentPhone,
                normalizedParentPhone: normalizePhoneNumber(student.parentPhone), // ADDED: Normalized phone
                reportMonth: currentMonthYear,
                introduction: "Transitioning student - no monthly report required.",
                topics: "Transitioning student - no monthly report required.",
                progress: "Transitioning student - no monthly report required.",
                strengthsWeaknesses: "Transitioning student - no monthly report required.",
                recommendations: "Transitioning student - no monthly report required.",
                generalComments: "Transitioning student - no monthly report required.",
                isTransitioning: true
            };
            
            showFeeConfirmationModal(student, reportData);
            return;
        }

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
                normalizedParentPhone: normalizePhoneNumber(student.parentPhone), // ADDED: Normalized phone
                reportMonth: currentMonthYear,
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
                // CHANGED: Save to Firestore instead of localStorage for cross-device access
                savedReports[student.id] = reportData;
                await saveReportsToFirestore(tutor.email, savedReports);
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
            
            // Ensure normalizedParentPhone is included in every report
            const finalReportData = {
                tutorEmail: tutor.email,
                tutorName: tutor.name,
                submittedAt: new Date(),
                ...report,
                ...accountDetails
            };
            
            // Make sure normalizedParentPhone is set (use original if not already normalized)
            if (!finalReportData.normalizedParentPhone && finalReportData.parentPhone) {
                finalReportData.normalizedParentPhone = normalizePhoneNumber(finalReportData.parentPhone);
            }
            
            batch.set(newReportRef, finalReportData);
        });

        try {
            await batch.commit();
            // CHANGED: Clear from Firestore instead of localStorage
            await clearAllReportsFromFirestore(tutor.email);
            showCustomAlert(`Successfully submitted ${reportsArray.length} report(s)!`);
            await renderStudentDatabase(container, tutor);
        } catch (error) {
            console.error("Error submitting reports:", error);
            showCustomAlert(`Error: ${error.message}`);
        }
    }

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

    // Function to show confirmation for adding transitioning student
    function showTransitioningConfirmation() {
        const confirmationHTML = `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                <div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-md mx-auto">
                    <h3 class="text-xl font-bold mb-4 text-orange-600">Add Transitioning Student</h3>
                    <p class="text-sm text-gray-600 mb-4">
                        <strong>Please confirm:</strong> Transitioning students skip monthly report writing and go directly to fee confirmation. 
                        They will be marked with orange indicators and their fees will be included in pay advice.
                    </p>
                    <p class="text-sm text-orange-600 font-semibold mb-4">
                        Are you sure you want to add a transitioning student?
                    </p>
                    <div class="flex justify-end space-x-2">
                        <button id="cancel-transitioning-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
                        <button id="confirm-transitioning-btn" class="bg-green-600 text-white px-6 py-2 rounded">Yes, Add Transitioning</button>
                    </div>
                </div>
            </div>
        `;
        
        const confirmationModal = document.createElement('div');
        confirmationModal.innerHTML = confirmationHTML;
        document.body.appendChild(confirmationModal);

        document.getElementById('cancel-transitioning-btn').addEventListener('click', () => {
            confirmationModal.remove();
        });

        document.getElementById('confirm-transitioning-btn').addEventListener('click', async () => {
            confirmationModal.remove();
            await addTransitioningStudent();
        });
    }

    // Function to add transitioning student
    async function addTransitioningStudent() {
        const parentName = document.getElementById('new-parent-name').value.trim();
        const parentPhone = document.getElementById('new-parent-phone').value.trim();
        const studentName = document.getElementById('new-student-name').value.trim();
        const studentGrade = document.getElementById('new-student-grade').value.trim();
        
        const selectedSubjects = [];
        document.querySelectorAll('input[name="subjects"]:checked').forEach(checkbox => {
            selectedSubjects.push(checkbox.value);
        });

        const studentDays = document.getElementById('new-student-days').value.trim();
        const groupClass = document.getElementById('new-student-group-class') ? document.getElementById('new-student-group-class').checked : false;
        const studentFee = parseFloat(document.getElementById('new-student-fee').value);

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
            tutorName: tutor.name,
            isTransitioning: true  // Mark as transitioning student
        };

        // Add group class field if applicable
        if (findSpecializedSubject(selectedSubjects)) {
            studentData.groupClass = groupClass;
        }

        try {
            if (isBypassApprovalEnabled) {
                await addDoc(collection(db, "students"), studentData);
                showCustomAlert('Transitioning student added successfully!');
            } else {
                await addDoc(collection(db, "pending_students"), studentData);
                showCustomAlert('Transitioning student added and is pending approval.');
            }
            renderStudentDatabase(container, tutor);
        } catch (error) {
            console.error("Error adding transitioning student:", error);
            showCustomAlert(`An error occurred: ${error.message}`);
        }
    }

    function attachEventListeners() {
        // Group class toggle functionality for new student form
        const subjectsContainer = document.getElementById('new-student-subjects-container');
        const groupClassContainer = document.getElementById('group-class-container');
        
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

        // Add event listener for transitioning student button - ALWAYS available
        const transitioningBtn = document.getElementById('add-transitioning-btn');
        if (transitioningBtn) {
            transitioningBtn.addEventListener('click', () => {
                showTransitioningConfirmation();
            });
        }

        // Add event listener for regular student button - only when admin enables it
        const studentBtn = document.getElementById('add-student-btn');
        if (studentBtn && isTutorAddEnabled) {
            studentBtn.addEventListener('click', async () => {
                const parentName = document.getElementById('new-parent-name').value.trim();
                const parentPhone = document.getElementById('new-parent-phone').value.trim();
                const studentName = document.getElementById('new-student-name').value.trim();
                const studentGrade = document.getElementById('new-student-grade').value.trim();
                
                const selectedSubjects = [];
                document.querySelectorAll('input[name="subjects"]:checked').forEach(checkbox => {
                    selectedSubjects.push(checkbox.value);
                });

                const studentDays = document.getElementById('new-student-days').value.trim();
                const groupClass = document.getElementById('new-student-group-class') ? document.getElementById('new-student-group-class').checked : false;
                const studentFee = parseFloat(document.getElementById('new-student-fee').value);

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

       document.querySelectorAll('.summer-break-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const studentId = btn.getAttribute('data-student-id');
        const student = students.find(s => s.id === studentId);
        
        // Add confirmation dialog
        if (confirm(`Are you sure you want to put ${student.studentName} on Break?`)) {
            const studentRef = doc(db, "students", studentId);
            await updateDoc(studentRef, { summerBreak: true });
            showCustomAlert(`${student.studentName} has been marked as on Break.`);
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
// # SECTION 3: MAIN APP INITIALIZATION
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
                
                // Show employment date popup if needed
                if (shouldShowEmploymentPopup(tutorData)) {
                    showEmploymentDatePopup(tutorData);
                }
                
                // Show TIN popup if needed
                if (shouldShowTINPopup(tutorData)) {
                    showTINPopup(tutorData);
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

    // ##################################################################
    // # SECTION 4: AUTO-REGISTERED STUDENTS NAVIGATION (NEW - ADDED AT BOTTOM)
    // ##################################################################
    document.getElementById('navAutoStudents').addEventListener('click', () => {
        if (window.tutorData) {
            renderAutoRegisteredStudents(document.getElementById('mainContent'), window.tutorData);
        }
    });
});

// ##################################################################
// # SECTION 5: AUTO-REGISTERED STUDENTS DISPLAY (NEW - ADDED AT BOTTOM)
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
    // CHANGED: Filter out archived students
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

// ##################################################################
// # SECTION 6: SUBMISSION ERROR HANDLING WITH IMMEDIATE FEEDBACK
// ##################################################################

// Function to validate account details before submission
function validateAccountDetails(accountDetails) {
    const errors = [];
    
    if (!accountDetails.beneficiaryBank || accountDetails.beneficiaryBank.trim() === '') {
        errors.push("• Beneficiary Bank Name is required");
    }
    
    if (!accountDetails.beneficiaryAccount || accountDetails.beneficiaryAccount.trim() === '') {
        errors.push("• Beneficiary Account Number is required");
    } else if (!/^\d{10}$/.test(accountDetails.beneficiaryAccount.trim())) {
        errors.push("• Account Number must be 10 digits");
    }
    
    if (!accountDetails.beneficiaryName || accountDetails.beneficiaryName.trim() === '') {
        errors.push("• Beneficiary Name is required");
    }
    
    return errors;
}

// Function to validate report data
function validateReportData(reportData) {
    const errors = [];
    
    if (!reportData.studentName || reportData.studentName.trim() === '') {
        errors.push("• Student Name is required");
    }
    
    if (!reportData.grade || reportData.grade.trim() === '') {
        errors.push("• Student Grade is required");
    }
    
    if (!reportData.parentName || reportData.parentName.trim() === '') {
        errors.push("• Parent Name is required");
    }
    
    if (!reportData.parentPhone || reportData.parentPhone.trim() === '') {
        errors.push("• Parent Phone Number is required");
    }
    
    return errors;
}

// Function to show submission error popup
function showSubmissionErrorPopup(errorMessages, onRetryCallback = null) {
    const errorModalHTML = `
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-md mx-auto">
                <div class="flex items-center mb-4">
                    <div class="flex-shrink-0">
                        <svg class="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 class="ml-3 text-lg font-bold text-red-700">Submission Error</h3>
                </div>
                
                <div class="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                    <p class="text-sm text-red-700 mb-2">Please fix the following issues:</p>
                    <ul class="text-sm text-red-600 list-disc pl-5 space-y-1">
                        ${errorMessages.map(error => `<li>${error}</li>`).join('')}
                    </ul>
                </div>
                
                <p class="text-sm text-gray-600 mb-4">Once you fix these issues, try submitting again.</p>
                
                <div class="flex justify-end space-x-2">
                    <button id="error-popup-ok-btn" class="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700">OK</button>
                    ${onRetryCallback ? 
                        `<button id="error-popup-retry-btn" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Fix & Retry</button>` 
                        : ''}
                </div>
            </div>
        </div>
    `;
    
    const errorModal = document.createElement('div');
    errorModal.innerHTML = errorModalHTML;
    document.body.appendChild(errorModal);
    
    // Focus on the OK button by default
    const okBtn = document.getElementById('error-popup-ok-btn');
    if (okBtn) okBtn.focus();
    
    document.getElementById('error-popup-ok-btn').addEventListener('click', () => {
        errorModal.remove();
    });
    
    if (onRetryCallback) {
        document.getElementById('error-popup-retry-btn').addEventListener('click', () => {
            errorModal.remove();
            onRetryCallback();
        });
    }
    
    // Close on escape key
    errorModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            errorModal.remove();
        }
    });
}

// Function to show submission success popup
function showSubmissionSuccessPopup(message) {
    const successModalHTML = `
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-md mx-auto">
                <div class="flex items-center mb-4">
                    <div class="flex-shrink-0">
                        <svg class="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 class="ml-3 text-lg font-bold text-green-700">Success!</h3>
                </div>
                
                <p class="text-gray-700 mb-6">${message}</p>
                
                <div class="flex justify-end">
                    <button id="success-popup-ok-btn" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">OK</button>
                </div>
            </div>
        </div>
    `;
    
    const successModal = document.createElement('div');
    successModal.innerHTML = successModalHTML;
    document.body.appendChild(successModal);
    
    document.getElementById('success-popup-ok-btn').addEventListener('click', () => {
        successModal.remove();
    });
    
    // Auto-close after 5 seconds
    setTimeout(() => {
        if (document.body.contains(successModal)) {
            successModal.remove();
        }
    }, 5000);
}

// Override the existing account details modal submission to add validation
const originalAccountDetailsModal = window.showAccountDetailsModal;

window.showAccountDetailsModal = function(reportsArray) {
    // First validate all reports
    const reportErrors = [];
    reportsArray.forEach((report, index) => {
        const errors = validateReportData(report);
        if (errors.length > 0) {
            reportErrors.push({
                student: report.studentName,
                errors: errors
            });
        }
    });
    
    if (reportErrors.length > 0) {
        const errorMessages = [];
        reportErrors.forEach(reportError => {
            errorMessages.push(`<strong>${reportError.student}:</strong>`);
            reportError.errors.forEach(error => errorMessages.push(error));
        });
        showSubmissionErrorPopup(errorMessages);
        return;
    }
    
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
    
    // Add validation indicators
    const bankInput = document.getElementById('beneficiary-bank');
    const accountInput = document.getElementById('beneficiary-account');
    const nameInput = document.getElementById('beneficiary-name');
    
    function validateInput(input, isValid) {
        if (isValid) {
            input.classList.remove('border-red-500');
            input.classList.add('border-green-500');
        } else {
            input.classList.remove('border-green-500');
            input.classList.add('border-red-500');
        }
    }
    
    bankInput.addEventListener('input', () => {
        validateInput(bankInput, bankInput.value.trim() !== '');
    });
    
    accountInput.addEventListener('input', () => {
        const isValid = /^\d{10}$/.test(accountInput.value.trim());
        validateInput(accountInput, isValid);
    });
    
    nameInput.addEventListener('input', () => {
        validateInput(nameInput, nameInput.value.trim() !== '');
    });
    
    document.getElementById('cancel-account-btn').addEventListener('click', () => accountModal.remove());
    
    document.getElementById('confirm-submit-btn').addEventListener('click', async () => {
        const accountDetails = {
            beneficiaryBank: bankInput.value.trim(),
            beneficiaryAccount: accountInput.value.trim(),
            beneficiaryName: nameInput.value.trim(),
        };
        
        // Validate account details
        const validationErrors = validateAccountDetails(accountDetails);
        
        if (validationErrors.length > 0) {
            showSubmissionErrorPopup(validationErrors, () => {
                // Retry callback - reopen the modal
                window.showAccountDetailsModal(reportsArray);
            });
            accountModal.remove();
            return;
        }
        
        accountModal.remove();
        
        // Show processing indicator
        const processingHTML = `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                <div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-md mx-auto">
                    <div class="flex flex-col items-center">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
                        <h3 class="text-lg font-bold text-gray-700">Submitting Reports...</h3>
                        <p class="text-sm text-gray-600 mt-2">Please wait while we submit your reports.</p>
                    </div>
                </div>
            </div>
        `;
        
        const processingModal = document.createElement('div');
        processingModal.innerHTML = processingHTML;
        document.body.appendChild(processingModal);
        
        try {
            await submitAllReports(reportsArray, accountDetails);
            processingModal.remove();
            showSubmissionSuccessPopup(`Successfully submitted ${reportsArray.length} report(s)!`);
        } catch (error) {
            processingModal.remove();
            showSubmissionErrorPopup([`Submission failed: ${error.message}`]);
        }
    });
};

// Also override the single student submission to add validation
const originalShowReportModal = window.showReportModal;

window.showReportModal = function(student) {
    // Keep your existing logic for transitioning students
    if (student.isTransitioning) {
        const currentMonthYear = getCurrentMonthYear();
        const reportData = {
            studentId: student.id, 
            studentName: student.studentName, 
            grade: student.grade,
            parentName: student.parentName, 
            parentPhone: student.parentPhone,
            normalizedParentPhone: normalizePhoneNumber(student.parentPhone), // ADDED: Normalized phone
            reportMonth: currentMonthYear,
            introduction: "Transitioning student - no monthly report required.",
            topics: "Transitioning student - no monthly report required.",
            progress: "Transitioning student - no monthly report required.",
            strengthsWeaknesses: "Transitioning student - no monthly report required.",
            recommendations: "Transitioning student - no monthly report required.",
            generalComments: "Transitioning student - no monthly report required.",
            isTransitioning: true
        };
        
        showFeeConfirmationModal(student, reportData);
        return;
    }
    
    // Rest of your existing code with validation added
    const existingReport = savedReports[student.id] || {};
    const isSingleApprovedStudent = approvedStudents.filter(s => !s.summerBreak && !submittedStudentIds.has(s.id)).length === 1;
    const currentMonthYear = getCurrentMonthYear();
    
    const reportFormHTML = `
        <h3 class="text-xl font-bold mb-4">Monthly Report for ${student.studentName}</h3>
        <div class="bg-blue-50 p-3 rounded-lg mb-4">
            <p class="text-sm font-semibold text-blue-800">Month: ${currentMonthYear}</p>
            <p class="text-xs text-blue-600 mt-1">All fields are required for submission</p>
        </div>
        <div class="space-y-4">
            <div>
                <label class="block font-semibold">Introduction</label>
                <textarea id="report-intro" class="w-full mt-1 p-2 border rounded required-field" rows="2" placeholder="Enter introduction...">${existingReport.introduction || ''}</textarea>
            </div>
            <div>
                <label class="block font-semibold">Topics & Remarks</label>
                <textarea id="report-topics" class="w-full mt-1 p-2 border rounded required-field" rows="3" placeholder="Enter topics and remarks...">${existingReport.topics || ''}</textarea>
            </div>
            <div>
                <label class="block font-semibold">Progress & Achievements</label>
                <textarea id="report-progress" class="w-full mt-1 p-2 border rounded required-field" rows="2" placeholder="Enter progress and achievements...">${existingReport.progress || ''}</textarea>
            </div>
            <div>
                <label class="block font-semibold">Strengths & Weaknesses</label>
                <textarea id="report-sw" class="w-full mt-1 p-2 border rounded required-field" rows="2" placeholder="Enter strengths and weaknesses...">${existingReport.strengthsWeaknesses || ''}</textarea>
            </div>
            <div>
                <label class="block font-semibold">Recommendations</label>
                <textarea id="report-recs" class="w-full mt-1 p-2 border rounded required-field" rows="2" placeholder="Enter recommendations...">${existingReport.recommendations || ''}</textarea>
            </div>
            <div>
                <label class="block font-semibold">General Comments</label>
                <textarea id="report-general" class="w-full mt-1 p-2 border rounded required-field" rows="2" placeholder="Enter general comments...">${existingReport.generalComments || ''}</textarea>
            </div>
            <div class="flex justify-end space-x-2">
                <button id="cancel-report-btn" class="bg-gray-500 text-white px-6 py-2 rounded">Cancel</button>
                <button id="modal-action-btn" class="bg-green-600 text-white px-6 py-2 rounded">${isSingleApprovedStudent ? 'Proceed to Submit' : 'Save Report'}</button>
            </div>
        </div>`;
    
    const reportModal = document.createElement('div');
    reportModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
    reportModal.innerHTML = `<div class="relative bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl mx-auto">${reportFormHTML}</div>`;
    document.body.appendChild(reportModal);
    
    // Add real-time validation
    const textareas = reportModal.querySelectorAll('.required-field');
    textareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            if (this.value.trim() === '') {
                this.classList.add('border-red-300');
                this.classList.remove('border-green-300');
            } else {
                this.classList.remove('border-red-300');
                this.classList.add('border-green-300');
            }
        });
    });
    
    document.getElementById('cancel-report-btn').addEventListener('click', () => reportModal.remove());
    
    document.getElementById('modal-action-btn').addEventListener('click', async () => {
        // Validate all fields
        const requiredFields = ['report-intro', 'report-topics', 'report-progress', 'report-sw', 'report-recs', 'report-general'];
        const missingFields = [];
        const fieldLabels = {
            'report-intro': 'Introduction',
            'report-topics': 'Topics & Remarks',
            'report-progress': 'Progress & Achievements',
            'report-sw': 'Strengths & Weaknesses',
            'report-recs': 'Recommendations',
            'report-general': 'General Comments'
        };
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (!field.value.trim()) {
                missingFields.push(fieldLabels[fieldId]);
            }
        });
        
        if (missingFields.length > 0) {
            showSubmissionErrorPopup([
                "Please complete all report fields:",
                ...missingFields.map(field => `• ${field}`)
            ]);
            return;
        }
        
        const reportData = {
            studentId: student.id, 
            studentName: student.studentName, 
            grade: student.grade,
            parentName: student.parentName, 
            parentPhone: student.parentPhone,
            normalizedParentPhone: normalizePhoneNumber(student.parentPhone), // ADDED: Normalized phone
            reportMonth: currentMonthYear,
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
};

// Global error handler for any submission failures
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && event.reason.message.includes('Firebase')) {
        console.error('Submission error:', event.reason);
        showSubmissionErrorPopup([
            "A network error occurred during submission.",
            "Please check your internet connection and try again.",
            "Error details: " + event.reason.message
        ]);
    }
});

// Add CSS for validation styling
const validationStyles = document.createElement('style');
validationStyles.textContent = `
    .border-red-300 {
        border-color: #fca5a5 !important;
    }
    .border-green-300 {
        border-color: #86efac !important;
    }
    .border-red-500 {
        border-color: #ef4444 !important;
    }
    .border-green-500 {
        border-color: #22c55e !important;
    }
    .animate-spin {
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(validationStyles);


