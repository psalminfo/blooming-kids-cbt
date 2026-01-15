import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ============================================================================
// SECTION 1: ENHANCED CSS FOR MODERN UI
// ============================================================================
const style = document.createElement('style');
style.textContent = `
    /* Modern UI Styles - UPDATED WITH FLOATING CHAT */
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
        --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        --radius-sm: 0.375rem;
        --radius: 0.5rem;
        --radius-lg: 0.75rem;
        --success-color: #10b981;
    }

    /* Floating Chat Button */
    .floating-chat-btn {
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        transition: all 0.3s ease;
    }

    .floating-chat-btn:hover {
        transform: scale(1.1);
        box-shadow: 0 8px 25px rgba(139, 92, 246, 0.4);
    }

    .floating-chat-btn .badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background-color: #ef4444;
        color: white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
    }

    /* Rest of CSS remains the same as before... */
    .nav-tab {
        padding: 0.75rem 1rem;
        border-radius: var(--radius);
        font-weight: 500;
        transition: all 0.2s ease;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--dark-color);
    }

    .nav-tab:hover {
        background-color: var(--light-color);
    }

    .nav-tab.active {
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
        color: white;
        box-shadow: var(--shadow);
    }

    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.625rem 1.25rem;
        border-radius: var(--radius);
        font-weight: 500;
        font-size: 0.875rem;
        line-height: 1.25rem;
        transition: all 0.2s ease;
        border: none;
        cursor: pointer;
        gap: 0.5rem;
    }

    .btn-primary {
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
        color: white;
        box-shadow: var(--shadow);
    }

    .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
    }

    .btn-secondary {
        background-color: white;
        color: var(--dark-color);
        border: 1px solid var(--border-color);
    }

    .btn-secondary:hover {
        background-color: var(--light-color);
    }

    .btn-danger {
        background-color: var(--danger-color);
        color: white;
    }

    .btn-warning {
        background-color: var(--warning-color);
        color: white;
    }

    .btn-info {
        background-color: var(--info-color);
        color: white;
    }

    .btn-sm {
        padding: 0.375rem 0.75rem;
        font-size: 0.75rem;
    }

    .card {
        background: white;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow);
        border: 1px solid var(--border-color);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
    }

    .card-header {
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid var(--border-color);
    }

    .card-body {
        padding: 1.5rem;
    }

    .card-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border-color);
        background-color: var(--light-color);
        border-bottom-left-radius: var(--radius-lg);
        border-bottom-right-radius: var(--radius-lg);
    }

    .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        line-height: 1;
    }

    .badge-success {
        background-color: var(--primary-light);
        color: var(--primary-dark);
    }

    .badge-warning {
        background-color: #fef3c7;
        color: #92400e;
    }

    .badge-danger {
        background-color: #fee2e2;
        color: #991b1b;
    }

    .badge-info {
        background-color: #dbeafe;
        color: #1e40af;
    }

    .badge-secondary {
        background-color: #e5e7eb;
        color: #4b5563;
    }

    .table-container {
        overflow-x: auto;
        border-radius: var(--radius);
        box-shadow: var(--shadow-sm);
    }

    .table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
    }

    .table th {
        background-color: var(--light-color);
        padding: 1rem;
        font-weight: 600;
        text-align: left;
        color: var(--dark-color);
        border-bottom: 2px solid var(--border-color);
    }

    .table td {
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
        vertical-align: middle;
    }

    .table tr:hover {
        background-color: var(--light-color);
    }

    .form-group {
        margin-bottom: 1.25rem;
    }

    .form-label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: var(--dark-color);
    }

    .form-input {
        width: 100%;
        padding: 0.75rem 1rem;
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        font-size: 1rem;
    }

    .form-input:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }

    .form-textarea {
        min-height: 120px;
        resize: vertical;
        padding: 0.75rem 1rem;
        font-size: 1rem;
    }

    .modal-overlay {
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 50;
        padding: 1rem;
        animation: fadeIn 0.2s ease;
    }

    .modal-content {
        background: white;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        width: 100%;
        max-width: 48rem;
        max-height: 90vh;
        overflow-y: auto;
        animation: slideIn 0.3s ease;
    }

    .modal-header {
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
    }

    .modal-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--dark-color);
    }

    .modal-body {
        padding: 1.5rem;
    }

    .modal-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border-color);
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes slideIn {
        from { transform: translateY(-1rem); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }

    .spinner {
        animation: spin 1s linear infinite;
        width: 1.5rem;
        height: 1.5rem;
        border: 2px solid var(--border-color);
        border-top-color: var(--primary-color);
        border-radius: 50%;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .hero-section {
        background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-dark) 100%);
        border-radius: var(--radius-lg);
        color: white;
        padding: 2rem;
        margin-bottom: 2rem;
    }

    .hero-title {
        font-size: 1.875rem;
        font-weight: 700;
        margin-bottom: 0.5rem;
    }

    .hero-subtitle {
        opacity: 0.9;
        font-size: 1.125rem;
    }

    .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .status-dot {
        display: inline-block;
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 50%;
        margin-right: 0.5rem;
    }

    .status-dot-success {
        background-color: var(--primary-color);
    }

    .status-dot-warning {
        background-color: var(--warning-color);
    }

    .status-dot-danger {
        background-color: var(--danger-color);
    }

    .action-buttons {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .student-actions-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-top: 1.5rem;
        margin-bottom: 2rem;
    }

    .student-action-card {
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        padding: 1rem;
        transition: all 0.2s ease;
    }

    .student-action-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow);
    }

    .report-textarea {
        min-height: 150px;
        font-size: 1.05rem;
        line-height: 1.5;
    }

    /* ENHANCED MESSAGING MODAL STYLES */
    .messaging-modal-content {
        max-width: 800px !important;
        height: 80vh !important;
    }

    .message-recipient-section {
        margin-bottom: 1.5rem;
        padding: 1rem;
        background-color: var(--light-color);
        border-radius: var(--radius);
    }

    .recipient-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
        margin-top: 1rem;
    }

    .recipient-card {
        border: 2px solid var(--border-color);
        border-radius: var(--radius);
        padding: 1rem;
        cursor: pointer;
        transition: all 0.2s ease;
        background: white;
    }

    .recipient-card:hover {
        border-color: var(--primary-color);
        transform: translateY(-2px);
    }

    .recipient-card.selected {
        border-color: var(--primary-color);
        background-color: var(--primary-light);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }

    .recipient-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
    }

    .recipient-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: var(--primary-color);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
    }

    .student-checkboxes {
        margin-top: 0.5rem;
        padding-left: 1.5rem;
        border-left: 2px solid var(--border-color);
    }

    .student-checkbox {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.25rem;
        font-size: 0.875rem;
    }

    .chat-history-container {
        margin-top: 1.5rem;
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        padding: 1rem;
        background-color: white;
    }

    .message-item {
        padding: 0.75rem;
        margin-bottom: 0.75rem;
        border-radius: var(--radius);
        border: 1px solid var(--border-color);
        background-color: var(--light-color);
    }

    .message-item.sent {
        background-color: #d1fae5;
        border-color: var(--primary-color);
    }

    .message-item.received {
        background-color: #f3f4f6;
    }

    .message-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
        font-size: 0.875rem;
    }

    .message-sender {
        font-weight: 600;
        color: var(--dark-color);
    }

    .message-time {
        color: #6b7280;
        font-size: 0.75rem;
    }

    .message-content {
        color: var(--dark-color);
        line-height: 1.5;
    }

    .no-messages {
        text-align: center;
        padding: 2rem;
        color: #6b7280;
        font-style: italic;
    }

    @media (max-width: 768px) {
        .floating-chat-btn {
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            font-size: 20px;
        }

        .floating-chat-btn .badge {
            width: 20px;
            height: 20px;
            font-size: 10px;
        }

        .recipient-grid {
            grid-template-columns: 1fr;
        }

        .messaging-modal-content {
            max-width: 95% !important;
            height: 90vh !important;
        }
    }
`;
document.head.appendChild(style);

// ============================================================================
// SECTION 2: CONFIGURATION & CONSTANTS
// ============================================================================
const CLOUDINARY_CONFIG = {
    cloudName: 'dwjq7j5zp',
    uploadPreset: 'tutor_homework',
    apiKey: '963245294794452'
};

const GAS_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxKPivWuCyEywMCxgleEoP7MBNxT6ZEvd5WWomDNGYADZmDcBcsO4Eif-JyHSJ5mpXBaw/exec';

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

const SUBJECT_CATEGORIES = {
    "Native Language": ["Yoruba", "Igbo", "Hausa"],
    "Foreign Language": ["French", "German", "Spanish", "Arabic"],
    "Specialized": ["Music", "Coding","ICT", "Chess", "Public Speaking", "English Proficiency", "Counseling Programs"]
};

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ============================================================================
// SECTION 3: GLOBAL STATE MANAGEMENT
// ============================================================================
let isSubmissionEnabled = false;
let isTutorAddEnabled = false;
let isSummerBreakEnabled = false;
let isBypassApprovalEnabled = false;
let showStudentFees = false;
let showEditDeleteButtons = false;

let studentCache = [];
let scheduledStudents = new Set();
let currentStudentIndex = 0;
let schedulePopup = null;
let unreadMessageCount = 0;
let floatingChatBtn = null;
let allStudents = [];

// ============================================================================
// SECTION 4: UTILITY FUNCTIONS
// ============================================================================
function showCustomAlert(message) {
    const alertModal = document.createElement('div');
    alertModal.className = 'modal-overlay';
    alertModal.innerHTML = `
        <div class="modal-content max-w-sm">
            <div class="modal-body">
                <p class="mb-4 text-center">${message}</p>
                <div class="flex justify-center">
                    <button id="alert-ok-btn" class="btn btn-primary">OK</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(alertModal);
    document.getElementById('alert-ok-btn').addEventListener('click', () => alertModal.remove());
}

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

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

function formatScheduleTime(timeString) {
    const [hour, minute] = timeString.split(':').map(Number);
    
    if (hour === 0 && minute === 0) {
        return "12:00 AM (Midnight)";
    }
    
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

function getCurrentMonthYear() {
    const now = new Date();
    return now.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function updateActiveTab(activeTabId) {
    const navTabs = ['navDashboard', 'navStudentDatabase', 'navAutoStudents'];
    navTabs.forEach(tabId => {
        const tab = document.getElementById(tabId);
        if (tab) {
            if (tabId === activeTabId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        }
    });
}

function getStudentFromCache(studentId) {
    return studentCache.find(s => s.id === studentId);
}

function cleanGradeString(grade) {
    if (grade && grade.toLowerCase().includes("grade")) {
        return grade;
    } else {
        return `Grade ${grade}`;
    }
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

// ============================================================================
// SECTION 5: CLOUDINARY FILE UPLOAD
// ============================================================================
async function uploadToCloudinary(file, studentId) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
        formData.append('folder', 'homework_assignments');
        formData.append('public_id', `homework_${studentId}_${Date.now()}_${file.name.replace(/\.[^/.]+$/, "")}`);
        
        const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/upload`;
        
        fetch(uploadUrl, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.secure_url) {
                resolve({
                    url: data.secure_url,
                    publicId: data.public_id,
                    format: data.format,
                    bytes: data.bytes,
                    createdAt: data.created_at
                });
            } else {
                reject(new Error('Upload failed: ' + (data.error?.message || 'Unknown error')));
            }
        })
        .catch(error => {
            reject(error);
        });
    });
}

// ============================================================================
// SECTION 6: FIREBASE DATA MANAGEMENT
// ============================================================================
async function loadStudentDropdowns(tutorEmail) {
    try {
        const studentsQuery = query(collection(db, "students"), where("tutorEmail", "==", tutorEmail));
        const studentsSnapshot = await getDocs(studentsQuery);
        
        studentCache = [];
        const students = [];
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
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
                option.textContent = `${student.studentName} (${student.grade})`;
                
                const option2 = option.cloneNode(true);
                topicSelect.appendChild(option);
                hwSelect.appendChild(option2);
            });
        }
    } catch (error) {
        console.error("Error loading student dropdowns:", error);
    }
}

async function loadStudentCache(tutorEmail) {
    try {
        const studentsQuery = query(collection(db, "students"), where("tutorEmail", "==", tutorEmail));
        const studentsSnapshot = await getDocs(studentsQuery);
        
        studentCache = [];
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            if (!['archived', 'graduated', 'transferred'].includes(student.status)) {
                studentCache.push(student);
            }
        });
        return studentCache;
    } catch (error) {
        console.error("Error loading student cache:", error);
        return [];
    }
}

async function getParentStudents(tutorEmail) {
    try {
        const students = await loadStudentCache(tutorEmail);
        
        // Group students by parent
        const parentsMap = new Map();
        
        students.forEach(student => {
            const parentKey = student.parentPhone || student.parentEmail || student.parentName;
            if (parentKey) {
                if (!parentsMap.has(parentKey)) {
                    parentsMap.set(parentKey, {
                        parentName: student.parentName,
                        parentPhone: student.parentPhone,
                        parentEmail: student.parentEmail,
                        students: []
                    });
                }
                parentsMap.get(parentKey).students.push({
                    id: student.id,
                    name: student.studentName,
                    grade: student.grade
                });
            }
        });
        
        return Array.from(parentsMap.values());
    } catch (error) {
        console.error("Error getting parent students:", error);
        return [];
    }
}

// ============================================================================
// SECTION 7: MESSAGING SYSTEM (FIXED)
// ============================================================================
async function updateUnreadMessageCount() {
    try {
        const tutorId = window.tutorData?.id;
        if (!tutorId) return;
        
        // Count unread messages from both management and parents
        const messagesQuery = query(
            collection(db, "tutor_messages"),
            where("tutorId", "==", tutorId),
            where("read", "==", false)
        );
        
        const messagesSnapshot = await getDocs(messagesQuery);
        unreadMessageCount = messagesSnapshot.size;
        
        // Update floating chat button badge
        if (floatingChatBtn) {
            const existingBadge = floatingChatBtn.querySelector('.badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            if (unreadMessageCount > 0) {
                const badge = document.createElement('span');
                badge.className = 'badge';
                badge.textContent = unreadMessageCount > 99 ? '99+' : unreadMessageCount;
                floatingChatBtn.appendChild(badge);
            }
        }
    } catch (error) {
        console.error("Error updating unread message count:", error);
    }
}

function createFloatingChatButton() {
    if (floatingChatBtn && document.body.contains(floatingChatBtn)) {
        floatingChatBtn.remove();
    }
    
    floatingChatBtn = document.createElement('button');
    floatingChatBtn.className = 'floating-chat-btn';
    floatingChatBtn.innerHTML = '💬';
    floatingChatBtn.title = 'Open Messages';
    
    floatingChatBtn.addEventListener('click', showMessagingModal);
    document.body.appendChild(floatingChatBtn);
    
    // Update unread count
    updateUnreadMessageCount();
}

async function showMessagingModal() {
    const parents = await getParentStudents(window.tutorData.email);
    
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content messaging-modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">💬 Send Message</h3>
                </div>
                <div class="modal-body">
                    <div class="message-recipient-section">
                        <h4 class="font-semibold mb-3">Select Recipients</h4>
                        
                        <!-- Management Option -->
                        <div class="recipient-grid">
                            <div class="recipient-card" data-recipient-type="management" data-recipient-id="management">
                                <div class="recipient-header">
                                    <div class="recipient-avatar">👔</div>
                                    <div>
                                        <div class="font-medium">Management Team</div>
                                        <div class="text-xs text-gray-500">Send to admin/management</div>
                                    </div>
                                </div>
                                <div class="mt-2">
                                    <label class="flex items-center space-x-2">
                                        <input type="checkbox" class="recipient-checkbox" value="management">
                                        <span class="text-sm">Send Message</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Parents Section -->
                        <div class="mt-4">
                            <h5 class="font-semibold mb-2">Parents</h5>
                            ${parents.length === 0 ? 
                                '<p class="text-gray-500 text-sm">No parents found.</p>' : 
                                '<div class="recipient-grid">' + parents.map((parent, index) => `
                                    <div class="recipient-card" data-recipient-type="parent" data-recipient-id="${parent.parentPhone || index}">
                                        <div class="recipient-header">
                                            <div class="recipient-avatar">👨‍👩‍👧‍👦</div>
                                            <div>
                                                <div class="font-medium">${parent.parentName || 'Parent'}</div>
                                                <div class="text-xs text-gray-500">${parent.parentPhone || 'No phone'}</div>
                                            </div>
                                        </div>
                                        <div class="mt-2">
                                            <label class="flex items-center space-x-2">
                                                <input type="checkbox" class="recipient-checkbox" value="${parent.parentPhone || index}">
                                                <span class="text-sm">Send to this parent</span>
                                            </label>
                                        </div>
                                        
                                        ${parent.students && parent.students.length > 0 ? `
                                            <div class="student-checkboxes mt-2">
                                                <div class="text-xs font-medium mb-1">Select Students:</div>
                                                ${parent.students.map(student => `
                                                    <label class="student-checkbox">
                                                        <input type="checkbox" class="student-checkbox-input" 
                                                               data-parent="${parent.parentPhone || index}" 
                                                               value="${student.id}">
                                                        <span>${student.name} (${student.grade})</span>
                                                    </label>
                                                `).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                `).join('') + '</div>'
                            }
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Message Subject *</label>
                        <input type="text" id="message-subject" class="form-input" placeholder="Enter message subject" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Message Content *</label>
                        <textarea id="message-content" class="form-input form-textarea report-textarea" 
                                  rows="6" placeholder="Type your message here..." required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="flex items-center space-x-2">
                            <input type="checkbox" id="urgent-message" class="rounded">
                            <span class="text-sm font-semibold">Mark as Urgent</span>
                        </label>
                        <p class="text-xs text-gray-500 mt-1">Urgent messages will be highlighted</p>
                    </div>
                    
                    <!-- Chat History -->
                    <div class="chat-history-container">
                        <h4 class="font-semibold mb-3">Recent Messages</h4>
                        <div id="recent-messages">
                            <div class="text-center">
                                <div class="spinner mx-auto mb-2"></div>
                                <p class="text-gray-500">Loading messages...</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-message-btn" class="btn btn-secondary">Cancel</button>
                    <button id="send-message-btn" class="btn btn-primary">Send Message</button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    // Load recent messages
    loadRecentMessages();
    
    // Add click handlers for recipient cards
    document.querySelectorAll('.recipient-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('recipient-checkbox') && 
                !e.target.classList.contains('student-checkbox-input')) {
                const checkbox = card.querySelector('.recipient-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    card.classList.toggle('selected', checkbox.checked);
                }
            }
        });
    });
    
    // Handle checkbox changes
    document.querySelectorAll('.recipient-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const card = e.target.closest('.recipient-card');
            card.classList.toggle('selected', e.target.checked);
        });
    });
    
    // Cancel button
    document.getElementById('cancel-message-btn').addEventListener('click', () => modal.remove());
    
    // Send button
    document.getElementById('send-message-btn').addEventListener('click', async () => {
        await sendMessage(modal);
    });
}

async function loadRecentMessages() {
    try {
        const tutorId = window.tutorData?.id;
        if (!tutorId) return;
        
        // Get last 10 messages
        const messagesQuery = query(
            collection(db, "tutor_messages"),
            where("tutorId", "==", tutorId),
            where("status", "==", "sent")
        );
        
        const messagesSnapshot = await getDocs(messagesQuery);
        const messages = [];
        
        messagesSnapshot.forEach(doc => {
            const message = { id: doc.id, ...doc.data() };
            messages.push(message);
        });
        
        // Sort by date (newest first)
        messages.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return timeB - timeA;
        });
        
        // Take only last 10
        const recentMessages = messages.slice(0, 10);
        
        const container = document.getElementById('recent-messages');
        if (recentMessages.length === 0) {
            container.innerHTML = '<div class="no-messages">No recent messages</div>';
            return;
        }
        
        let html = '';
        recentMessages.forEach(message => {
            const messageTime = message.createdAt?.toDate ? message.createdAt.toDate() : new Date(message.createdAt);
            const isFromTutor = message.senderId === tutorId;
            
            html += `
                <div class="message-item ${isFromTutor ? 'sent' : 'received'}">
                    <div class="message-header">
                        <span class="message-sender">
                            ${isFromTutor ? 'You' : (message.senderName || 'Management')}
                        </span>
                        <span class="message-time">${formatTime(messageTime)}</span>
                    </div>
                    <div class="message-content">
                        <strong>${message.subject || 'No Subject'}</strong>
                        <p class="mt-1">${message.content || ''}</p>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error("Error loading recent messages:", error);
        document.getElementById('recent-messages').innerHTML = 
            '<div class="text-red-500 text-sm">Failed to load messages</div>';
    }
}

async function sendMessage(modal) {
    const subject = document.getElementById('message-subject').value.trim();
    const content = document.getElementById('message-content').value.trim();
    const isUrgent = document.getElementById('urgent-message').checked;
    
    if (!subject || !content) {
        showCustomAlert('Please enter both subject and message content.');
        return;
    }
    
    // Collect selected recipients
    const selectedRecipients = [];
    const selectedParents = [];
    const selectedStudents = [];
    
    // Check management
    const managementCheckbox = document.querySelector('.recipient-card[data-recipient-type="management"] .recipient-checkbox');
    if (managementCheckbox && managementCheckbox.checked) {
        selectedRecipients.push({
            type: 'management',
            id: 'management',
            name: 'Management Team'
        });
    }
    
    // Check parents and their students
    document.querySelectorAll('.recipient-card[data-recipient-type="parent"]').forEach(card => {
        const checkbox = card.querySelector('.recipient-checkbox');
        if (checkbox && checkbox.checked) {
            const parentPhone = checkbox.value;
            const parentName = card.querySelector('.font-medium').textContent;
            
            selectedParents.push({
                phone: parentPhone,
                name: parentName
            });
            
            // Collect selected students for this parent
            const studentCheckboxes = card.querySelectorAll('.student-checkbox-input:checked');
            studentCheckboxes.forEach(studentCheckbox => {
                selectedStudents.push({
                    studentId: studentCheckbox.value,
                    parentPhone: parentPhone,
                    studentName: studentCheckbox.closest('.student-checkbox').querySelector('span').textContent
                });
            });
        }
    });
    
    if (selectedRecipients.length === 0 && selectedParents.length === 0) {
        showCustomAlert('Please select at least one recipient (Management or Parents).');
        return;
    }
    
    try {
        const tutor = window.tutorData;
        const messageId = Date.now().toString();
        
        // Save message to tutor_messages collection
        const messageData = {
            id: messageId,
            tutorId: tutor.id,
            tutorEmail: tutor.email,
            tutorName: tutor.name,
            subject: subject,
            content: content,
            recipients: selectedRecipients.map(r => r.type).concat(selectedParents.map(() => 'parent')),
            parentRecipients: selectedParents,
            studentRecipients: selectedStudents,
            isUrgent: isUrgent,
            status: 'sent',
            read: false,
            createdAt: new Date()
        };
        
        const messageRef = doc(collection(db, "tutor_messages"), messageId);
        await setDoc(messageRef, messageData);
        
        // If sending to management, also create a management message
        if (selectedRecipients.some(r => r.type === 'management')) {
            const managementMessageRef = doc(collection(db, "management_messages"));
            await setDoc(managementMessageRef, {
                fromTutorId: tutor.id,
                fromTutorName: tutor.name,
                fromTutorEmail: tutor.email,
                subject: subject,
                content: content,
                isUrgent: isUrgent,
                status: 'unread',
                createdAt: new Date()
            });
        }
        
        // If sending to parents, also create parent messages
        if (selectedParents.length > 0) {
            const batch = writeBatch(db);
            
            selectedParents.forEach(parent => {
                const parentMessageRef = doc(collection(db, "parent_messages"));
                batch.set(parentMessageRef, {
                    parentPhone: parent.phone,
                    parentName: parent.name,
                    fromTutorId: tutor.id,
                    fromTutorName: tutor.name,
                    fromTutorEmail: tutor.email,
                    subject: subject,
                    content: content,
                    isUrgent: isUrgent,
                    status: 'unread',
                    createdAt: new Date(),
                    // Include student info if specific students were selected
                    students: selectedStudents.filter(s => s.parentPhone === parent.phone)
                });
            });
            
            await batch.commit();
            
            // Send notification via Google Apps Script
            await sendNotificationToParents(selectedParents, tutor, subject, content);
        }
        
        modal.remove();
        showCustomAlert(`✅ Message sent successfully!`);
        
        // Update unread count
        await updateUnreadMessageCount();
        
    } catch (error) {
        console.error("Error sending message:", error);
        showCustomAlert('❌ Error sending message. Please try again.');
    }
}

async function sendNotificationToParents(parents, tutor, subject, content) {
    try {
        // Prepare notification data
        const notificationData = {
            type: 'tutor_message',
            tutorName: tutor.name,
            subject: subject,
            content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
            parents: parents.map(p => ({
                name: p.name,
                phone: p.phone
            })),
            timestamp: new Date().toISOString()
        };
        
        // Send to Google Apps Script webhook
        await fetch(GAS_WEBHOOK_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(notificationData)
        });
        
        console.log('Notification sent to Google Apps Script');
    } catch (error) {
        console.error('Error sending notification:', error);
        // Don't show error to user - notification failure shouldn't block message sending
    }
}

// ============================================================================
// SECTION 8: SCHEDULE MANAGEMENT
// ============================================================================
function validateScheduleTime(start, end) {
    const timeToMinutes = (time) => {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    };
    
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    
    if (endMinutes < startMinutes) {
        const adjustedEndMinutes = endMinutes + (24 * 60);
        const duration = adjustedEndMinutes - startMinutes;
        
        if (duration < 30) {
            return { valid: false, message: 'Class must be at least 30 minutes long' };
        }
        
        if (duration > 4 * 60) {
            return { valid: false, message: 'Class cannot exceed 4 hours' };
        }
        
        return { valid: true, isOvernight: true, duration: duration };
    }
    
    const duration = endMinutes - startMinutes;
    
    if (duration < 30) {
        return { valid: false, message: 'Class must be at least 30 minutes long' };
    }
    
    if (duration > 4 * 60) {
        return { valid: false, message: 'Class cannot exceed 4 hours' };
    }
    
    return { valid: true, isOvernight: false, duration: duration };
}

async function checkAndShowSchedulePopup(tutor) {
    try {
        const studentsQuery = query(
            collection(db, "students"), 
            where("tutorEmail", "==", tutor.email)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        allStudents = []; // RESET GLOBAL VARIABLE
        scheduledStudents.clear();
        
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            if (!['archived', 'graduated', 'transferred'].includes(student.status)) {
                allStudents.push(student);
                if (student.schedule && student.schedule.length > 0) {
                    scheduledStudents.add(student.id);
                }
            }
        });
        
        const studentsWithoutSchedule = allStudents.filter(student => !scheduledStudents.has(student.id));
        currentStudentIndex = 0;
        
        if (studentsWithoutSchedule.length > 0) {
            showBulkSchedulePopup(studentsWithoutSchedule[0], tutor, studentsWithoutSchedule.length);
            return true;
        } else {
            showCustomAlert('✅ All students have been scheduled!');
            return false;
        }
        
    } catch (error) {
        console.error("Error checking schedules:", error);
        showCustomAlert('Error loading students. Please try again.');
        return false;
    }
}

function showBulkSchedulePopup(student, tutor, totalCount = 0) {
    if (schedulePopup && document.body.contains(schedulePopup)) {
        schedulePopup.remove();
    }
    
    // FIXED: Generate time slots properly
    const timeSlots = [];
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
            
            timeSlots.push({ value: timeValue, label: label });
        }
    }
    
    const popupHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h3 class="modal-title">📅 Set Schedule for ${student.studentName}</h3>
                    <span class="badge badge-info">${currentStudentIndex + 1} of ${totalCount}</span>
                </div>
                <div class="modal-body">
                    <div class="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p class="text-sm text-blue-700">Student: <strong>${student.studentName}</strong> | Grade: ${student.grade}</p>
                        <p class="text-xs text-blue-600">${student.subjects ? student.subjects.join(', ') : 'No subjects'}</p>
                        <p class="text-xs text-blue-500 mt-1">Note: You can schedule overnight classes (e.g., 11 PM to 1 AM)</p>
                    </div>
                    
                    <div id="schedule-entries" class="space-y-4">
                        <div class="schedule-entry bg-gray-50 p-4 rounded-lg border">
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="form-label">Day of Week</label>
                                    <select class="form-input schedule-day">
                                        ${DAYS_OF_WEEK.map(day => `<option value="${day}">${day}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="form-label">Start Time</label>
                                    <select class="form-input schedule-start">
                                        ${timeSlots.map(slot => `<option value="${slot.value}">${slot.label}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="form-label">End Time</label>
                                    <select class="form-input schedule-end">
                                        ${timeSlots.map(slot => `<option value="${slot.value}">${slot.label}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <button class="btn btn-danger btn-sm mt-2 remove-schedule-btn hidden">Remove</button>
                        </div>
                    </div>
                    
                    <button id="add-schedule-entry" class="btn btn-secondary btn-sm mt-2">
                        ＋ Add Another Time Slot
                    </button>
                </div>
                <div class="modal-footer">
                    <button id="skip-schedule-btn" class="btn btn-secondary">Skip This Student</button>
                    <button id="save-schedule-btn" class="btn btn-primary" data-student-id="${student.id}">
                        Save & Next Student
                    </button>
                </div>
            </div>
        </div>
    `;
    
    schedulePopup = document.createElement('div');
    schedulePopup.innerHTML = popupHTML;
    document.body.appendChild(schedulePopup);
    
    document.getElementById('add-schedule-entry').addEventListener('click', () => {
        const scheduleEntries = document.getElementById('schedule-entries');
        const newEntry = scheduleEntries.firstElementChild.cloneNode(true);
        newEntry.querySelector('.remove-schedule-btn').classList.remove('hidden');
        scheduleEntries.appendChild(newEntry);
    });
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-schedule-btn')) {
            if (document.querySelectorAll('.schedule-entry').length > 1) {
                e.target.closest('.schedule-entry').remove();
            }
        }
    });
    
    document.getElementById('save-schedule-btn').addEventListener('click', async () => {
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
            
            const scheduleRef = doc(collection(db, "schedules"));
            await setDoc(scheduleRef, {
                studentId: student.id,
                studentName: student.studentName,
                tutorEmail: window.tutorData.email,
                tutorName: window.tutorData.name,
                schedule: schedule,
                createdAt: new Date()
            });
            
            showCustomAlert('✅ Schedule saved!');
            
            scheduledStudents.add(student.id);
            currentStudentIndex++;
            schedulePopup.remove();
            
            // FIXED: Use the global allStudents variable
            const studentsWithoutSchedule = allStudents.filter(s => !scheduledStudents.has(s.id));
            
            if (currentStudentIndex < studentsWithoutSchedule.length) {
                setTimeout(() => {
                    showBulkSchedulePopup(studentsWithoutSchedule[currentStudentIndex], tutor, studentsWithoutSchedule.length);
                }, 500);
            } else {
                setTimeout(() => {
                    showCustomAlert('🎉 All students have been scheduled!');
                }, 500);
            }
            
        } catch (error) {
            console.error("Error saving schedule:", error);
            showCustomAlert('❌ Error saving schedule. Please try again.');
        }
    });
    
    document.getElementById('skip-schedule-btn').addEventListener('click', () => {
        currentStudentIndex++;
        schedulePopup.remove();
        
        // FIXED: Use the global allStudents variable
        const studentsWithoutSchedule = allStudents.filter(s => !scheduledStudents.has(s.id));
        
        if (currentStudentIndex < studentsWithoutSchedule.length) {
            setTimeout(() => {
                showBulkSchedulePopup(studentsWithoutSchedule[currentStudentIndex], tutor, studentsWithoutSchedule.length);
            }, 500);
        } else {
            showCustomAlert('Skipped all remaining students.');
        }
    });
}

// ============================================================================
// SECTION 9: DAILY TOPIC & HOMEWORK
// ============================================================================
function showDailyTopicModal(student) {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-lg">
                <div class="modal-header">
                    <h3 class="modal-title">📚 Today's Topic for ${student.studentName}</h3>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Today's Topics *</label>
                        <textarea id="topic-topics" class="form-input form-textarea report-textarea" 
                                  placeholder="Enter today's topics, one per line or separated by commas..." required></textarea>
                    </div>
                    <div class="mt-2 text-sm text-gray-500">
                        <p>Example: Fractions, Decimals, Basic Algebra</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-topic-btn" class="btn btn-secondary">Cancel</button>
                    <button id="save-topic-btn" class="btn btn-primary" data-student-id="${student.id}">
                        Save Today's Topic
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    document.getElementById('cancel-topic-btn').addEventListener('click', () => modal.remove());
    document.getElementById('save-topic-btn').addEventListener('click', async () => {
        // FIXED: Ensure all required fields are defined
        const topicData = {
            studentId: student.id,
            studentName: student.studentName || '',
            parentEmail: student.parentEmail || '',
            parentPhone: student.parentPhone || '',
            parentName: student.parentName || '',
            tutorEmail: window.tutorData.email,
            tutorName: window.tutorData.name,
            topics: document.getElementById('topic-topics').value.trim(),
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date()
        };
        
        if (!topicData.topics) {
            showCustomAlert('Please enter today\'s topics.');
            return;
        }
        
        try {
            const topicRef = doc(collection(db, "daily_topics"));
            await setDoc(topicRef, topicData);
            
            // Send notification via Google Apps Script
            await sendTopicNotification(topicData);
            
            modal.remove();
            showCustomAlert('✅ Today\'s topic saved successfully!');
        } catch (error) {
            console.error("Error saving topic:", error);
            showCustomAlert('❌ Error saving topic. Please try again.');
        }
    });
}

async function sendTopicNotification(topicData) {
    try {
        const notificationData = {
            type: 'daily_topic',
            studentName: topicData.studentName,
            parentEmail: topicData.parentEmail,
            parentPhone: topicData.parentPhone,
            topics: topicData.topics,
            date: topicData.date,
            tutorName: topicData.tutorName,
            timestamp: new Date().toISOString()
        };
        
        await fetch(GAS_WEBHOOK_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(notificationData)
        });
        
        console.log('Topic notification sent');
    } catch (error) {
        console.error('Error sending topic notification:', error);
    }
}

function showHomeworkModal(student) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const maxDate = nextWeek.toISOString().split('T')[0];
    
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content max-w-2xl">
                <div class="modal-header">
                    <h3 class="modal-title">📝 Assign Homework for ${student.studentName}</h3>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Homework Title *</label>
                        <input type="text" id="hw-title" class="form-input" placeholder="e.g., Math Worksheet #3" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description *</label>
                        <textarea id="hw-description" class="form-input form-textarea report-textarea" 
                                  placeholder="Detailed instructions for the homework..." required></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Due Date *</label>
                        <input type="date" id="hw-due-date" class="form-input" 
                               min="${new Date().toISOString().split('T')[0]}" max="${maxDate}" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Upload File (Optional)</label>
                        <div class="file-upload-container" id="file-upload-container">
                            <input type="file" id="hw-file" class="hidden" 
                                   accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.ppt,.pptx">
                            <label for="hw-file" class="file-upload-label">
                                <div class="file-upload-icon">📎</div>
                                <span class="text-sm font-medium text-primary-color">Click to upload file</span>
                                <span class="text-xs text-gray-500 block mt-1">PDF, DOC, JPG, PNG, TXT, PPT (Max 10MB)</span>
                            </label>
                            <div id="file-preview" class="file-preview hidden">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <div class="file-name" id="file-name"></div>
                                        <div class="file-size" id="file-size"></div>
                                    </div>
                                    <button type="button" id="remove-file-btn" class="btn btn-danger btn-sm">Remove</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="email-settings">
                        <div class="form-group">
                            <label class="flex items-center space-x-2">
                                <input type="checkbox" id="hw-reminder" class="rounded" checked>
                                <span class="text-sm font-semibold">Send Email Reminder to Parent</span>
                            </label>
                            <p class="text-xs text-gray-500 mt-1">Parent will receive an email reminder 1 day before due date</p>
                        </div>
                        
                        <div id="email-preview" class="email-preview hidden">
                            <div class="email-preview-header">
                                <strong>Email Preview:</strong>
                            </div>
                            <p><strong>Subject:</strong> <span id="email-subject">Homework Reminder for ${student.studentName}</span></p>
                            <p><strong>To:</strong> ${student.parentEmail || 'Parent email will be used'}</p>
                            <p><strong>Message:</strong> <span id="email-message">Don't forget! ${student.studentName} has homework due tomorrow. Please check the assignment details.</span></p>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-hw-btn" class="btn btn-secondary">Cancel</button>
                    <button id="save-hw-btn" class="btn btn-primary" data-student-id="${student.id}">
                        Assign Homework
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    const fileInput = document.getElementById('hw-file');
    const filePreview = document.getElementById('file-preview');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const emailPreview = document.getElementById('email-preview');
    const emailSubject = document.getElementById('email-subject');
    const emailMessage = document.getElementById('email-message');
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.size > 10 * 1024 * 1024) {
                showCustomAlert('File size must be less than 10MB.');
                fileInput.value = '';
                return;
            }
            
            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            filePreview.classList.remove('hidden');
            
            emailMessage.textContent = `Don't forget! ${student.studentName} has homework due tomorrow. A file has been attached to this assignment.`;
        }
    });
    
    removeFileBtn.addEventListener('click', () => {
        fileInput.value = '';
        filePreview.classList.add('hidden');
        emailMessage.textContent = `Don't forget! ${student.studentName} has homework due tomorrow. Please check the assignment details.`;
    });
    
    const reminderCheckbox = document.getElementById('hw-reminder');
    reminderCheckbox.addEventListener('change', () => {
        if (reminderCheckbox.checked) {
            emailPreview.classList.remove('hidden');
            const titleInput = document.getElementById('hw-title');
            titleInput.addEventListener('input', () => {
                emailSubject.textContent = `Homework Reminder: ${titleInput.value || 'Assignment'} for ${student.studentName}`;
            });
        } else {
            emailPreview.classList.add('hidden');
        }
    });
    
    document.getElementById('cancel-hw-btn').addEventListener('click', () => modal.remove());
    document.getElementById('save-hw-btn').addEventListener('click', async () => {
        // FIXED: Ensure all required fields are defined
        const hwData = {
            studentId: student.id,
            studentName: student.studentName || '',
            parentEmail: student.parentEmail || '',
            parentPhone: student.parentPhone || '',
            parentName: student.parentName || '',
            tutorEmail: window.tutorData.email,
            tutorName: window.tutorData.name,
            title: document.getElementById('hw-title').value.trim(),
            description: document.getElementById('hw-description').value.trim(),
            dueDate: document.getElementById('hw-due-date').value,
            sendReminder: document.getElementById('hw-reminder').checked,
            assignedDate: new Date(),
            status: 'assigned',
            submissions: []
        };
        
        if (!hwData.title || !hwData.description || !hwData.dueDate) {
            showCustomAlert('Please fill in all required fields (title, description, due date).');
            return;
        }
        
        const dueDate = new Date(hwData.dueDate);
        const today = new Date();
        const maxDueDate = new Date(today);
        maxDueDate.setDate(maxDueDate.getDate() + 7);
        
        if (dueDate < today) {
            showCustomAlert('Due date cannot be in the past.');
            return;
        }
        
        if (dueDate > maxDueDate) {
            showCustomAlert('Due date must be within 7 days from today.');
            return;
        }
        
        try {
            let fileData = null;
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                showCustomAlert('📤 Uploading file to Cloudinary...');
                
                fileData = await uploadToCloudinary(file, student.id);
                
                hwData.fileUrl = fileData.url;
                hwData.fileName = file.name;
                hwData.fileSize = file.size;
                hwData.fileType = file.type;
                hwData.cloudinaryPublicId = fileData.publicId;
            }
            
            const hwRef = doc(collection(db, "homework_assignments"));
            await setDoc(hwRef, hwData);
            
            // Send notification via Google Apps Script
            await sendHomeworkNotification(hwData, fileData?.url);
            
            if (hwData.sendReminder && hwData.parentEmail) {
                await scheduleEmailReminder(hwData, fileData?.url);
            }
            
            modal.remove();
            showCustomAlert('✅ Homework assigned successfully!');
            
        } catch (error) {
            console.error("Error assigning homework:", error);
            showCustomAlert('❌ Error assigning homework: ' + error.message);
        }
    });
}

async function sendHomeworkNotification(hwData, fileUrl = null) {
    try {
        const notificationData = {
            type: 'homework',
            studentName: hwData.studentName,
            parentEmail: hwData.parentEmail,
            parentPhone: hwData.parentPhone,
            homeworkTitle: hwData.title,
            description: hwData.description,
            dueDate: hwData.dueDate,
            hasAttachment: !!fileUrl,
            tutorName: hwData.tutorName,
            timestamp: new Date().toISOString()
        };
        
        await fetch(GAS_WEBHOOK_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(notificationData)
        });
        
        console.log('Homework notification sent');
    } catch (error) {
        console.error('Error sending homework notification:', error);
    }
}

async function scheduleEmailReminder(hwData, fileUrl = '') {
    try {
        const dueDate = new Date(hwData.dueDate);
        const reminderDate = new Date(dueDate);
        reminderDate.setDate(reminderDate.getDate() - 1);
        
        const reminderData = {
            homeworkId: hwData.id,
            studentId: hwData.studentId,
            studentName: hwData.studentName,
            parentEmail: hwData.parentEmail,
            tutorEmail: hwData.tutorEmail,
            tutorName: hwData.tutorName,
            title: hwData.title,
            description: hwData.description,
            dueDate: hwData.dueDate,
            reminderDate: reminderDate,
            fileUrl: fileUrl,
            fileName: hwData.fileName,
            status: 'scheduled',
            createdAt: new Date()
        };
        
        const reminderRef = doc(collection(db, "email_reminders"));
        await setDoc(reminderRef, reminderData);
        
        console.log('Email reminder scheduled for:', reminderDate);
        
    } catch (error) {
        console.error("Error scheduling email reminder:", error);
    }
}

// ============================================================================
// SECTION 10: TUTOR DASHBOARD
// ============================================================================
function renderTutorDashboard(container, tutor) {
    updateActiveTab('navDashboard');
    
    container.innerHTML = `
        <div class="hero-section">
            <h1 class="hero-title">Welcome, ${tutor.name || 'Tutor'}! 👋</h1>
            <p class="hero-subtitle">Manage your students, submit reports, and track progress</p>
        </div>
        
        <div class="student-actions-container">
            <div class="student-action-card">
                <h3 class="font-bold text-lg mb-3">📅 Schedule Management</h3>
                <p class="text-sm text-gray-600 mb-4">Set up and view class schedules for all students</p>
                <button id="view-full-calendar-btn" class="btn btn-info w-full mb-2">View Schedule Calendar</button>
                <button id="setup-all-schedules-btn" class="btn btn-primary w-full">Set Up Schedules</button>
            </div>
            
            <div class="student-action-card">
                <h3 class="font-bold text-lg mb-3">📚 Today's Topic</h3>
                <p class="text-sm text-gray-600 mb-4">Record topics covered in today's classes</p>
                <select id="select-student-topic" class="form-input mb-3">
                    <option value="">Select a student...</option>
                </select>
                <button id="add-topic-btn" class="btn btn-secondary w-full" disabled>Add Today's Topic</button>
            </div>
            
            <div class="student-action-card">
                <h3 class="font-bold text-lg mb-3">📝 Assign Homework</h3>
                <p class="text-sm text-gray-600 mb-4">Assign homework to your students</p>
                <select id="select-student-hw" class="form-input mb-3">
                    <option value="">Select a student...</option>
                </select>
                <button id="assign-hw-btn" class="btn btn-warning w-full" disabled>Assign Homework</button>
            </div>
        </div>
        
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
    
    // Create floating chat button
    createFloatingChatButton();
    
    // Load student dropdowns
    loadStudentDropdowns(tutor.email);
    
    // Add event listeners for new buttons
    const viewCalendarBtn = document.getElementById('view-full-calendar-btn');
    if (viewCalendarBtn) {
        viewCalendarBtn.addEventListener('click', showScheduleCalendarModal);
    }
    
    const setupSchedulesBtn = document.getElementById('setup-all-schedules-btn');
    if (setupSchedulesBtn) {
        setupSchedulesBtn.addEventListener('click', () => {
            checkAndShowSchedulePopup(tutor);
        });
    }
    
    const addTopicBtn = document.getElementById('add-topic-btn');
    if (addTopicBtn) {
        addTopicBtn.addEventListener('click', () => {
            const studentId = document.getElementById('select-student-topic').value;
            const student = getStudentFromCache(studentId);
            if (student) {
                showDailyTopicModal(student);
            }
        });
    }
    
    const assignHwBtn = document.getElementById('assign-hw-btn');
    if (assignHwBtn) {
        assignHwBtn.addEventListener('click', () => {
            const studentId = document.getElementById('select-student-hw').value;
            const student = getStudentFromCache(studentId);
            if (student) {
                showHomeworkModal(student);
            }
        });
    }
    
    const topicSelect = document.getElementById('select-student-topic');
    if (topicSelect) {
        topicSelect.addEventListener('change', (e) => {
            const addTopicBtn = document.getElementById('add-topic-btn');
            if (addTopicBtn) {
                addTopicBtn.disabled = !e.target.value;
            }
        });
    }
    
    const hwSelect = document.getElementById('select-student-hw');
    if (hwSelect) {
        hwSelect.addEventListener('change', (e) => {
            const assignHwBtn = document.getElementById('assign-hw-btn');
            if (assignHwBtn) {
                assignHwBtn.disabled = !e.target.value;
            }
        });
    }

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
}

async function loadTutorReports(tutorEmail, parentName = null, statusFilter = null) {
    const pendingReportsContainer = document.getElementById('pendingReportsContainer');
    const gradedReportsContainer = document.getElementById('gradedReportsContainer');
    
    if (!pendingReportsContainer) return;
    
    pendingReportsContainer.innerHTML = `
        <div class="card">
            <div class="card-body text-center">
                <div class="spinner mx-auto mb-2"></div>
                <p class="text-gray-500">Loading submissions...</p>
            </div>
        </div>
    `;
    
    if (gradedReportsContainer) {
        gradedReportsContainer.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <div class="spinner mx-auto mb-2"></div>
                    <p class="text-gray-500">Loading graded submissions...</p>
                </div>
            </div>
        `;
    }

    try {
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

        let pendingHTML = '';
        let gradedHTML = '';
        let pendingCount = 0;
        let gradedCount = 0;

        assessmentsSnapshot.forEach(doc => {
            const data = doc.data();
            const needsFeedback = data.answers && data.answers.some(answer => 
                answer.type === 'creative-writing' && 
                (!answer.tutorReport || answer.tutorReport.trim() === '')
            );

            const reportCard = `
                <div class="card">
                    <div class="card-body">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h4 class="font-bold text-lg">${data.studentName}</h4>
                                <p class="text-gray-600">${data.parentName || 'N/A'} • ${data.grade}</p>
                            </div>
                            <span class="badge ${needsFeedback ? 'badge-warning' : 'badge-success'}">
                                ${needsFeedback ? 'Pending Review' : 'Graded'}
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div class="bg-gray-50 p-3 rounded">
                                <span class="text-sm text-gray-500">Type:</span>
                                <p class="font-medium">Multiple-Choice Test</p>
                            </div>
                            <div class="bg-gray-50 p-3 rounded">
                                <span class="text-sm text-gray-500">Submitted:</span>
                                <p class="font-medium">${new Date(data.submittedAt.seconds * 1000).toLocaleDateString()}</p>
                            </div>
                            <div class="bg-gray-50 p-3 rounded">
                                <span class="text-sm text-gray-500">Status:</span>
                                <p class="font-medium">${needsFeedback ? 'Needs Feedback' : 'Completed'}</p>
                            </div>
                        </div>

                        <div class="border-t pt-4">
                            <h5 class="font-semibold mb-2">Assessment Details:</h5>
                            ${data.answers ? data.answers.map((answer, index) => {
                                if (answer.type === 'creative-writing') {
                                    return `
                                        <div class="mb-4 p-4 bg-blue-50 rounded-lg">
                                            <div class="flex justify-between items-start mb-2">
                                                <h6 class="font-semibold">Creative Writing</h6>
                                                <span class="badge ${answer.tutorReport ? 'badge-success' : 'badge-warning'}">
                                                    ${answer.tutorReport ? 'Graded' : 'Pending'}
                                                </span>
                                            </div>
                                            <p class="italic text-gray-700 mb-3">${answer.textAnswer || "No response"}</p>
                                            ${answer.fileUrl ? `
                                                <a href="${answer.fileUrl}" target="_blank" class="btn btn-secondary btn-sm">
                                                    📎 Download File
                                                </a>
                                            ` : ''}
                                            
                                            ${!answer.tutorReport ? `
                                                <div class="mt-3">
                                                    <label class="form-label">Your Feedback</label>
                                                    <textarea class="form-input form-textarea tutor-report" rows="3" placeholder="Write your feedback here..."></textarea>
                                                    <button class="btn btn-primary mt-2 submit-report-btn" 
                                                            data-doc-id="${doc.id}" 
                                                            data-collection="student_results" 
                                                            data-answer-index="${index}">
                                                        Submit Feedback
                                                    </button>
                                                </div>
                                            ` : `
                                                <div class="mt-3 bg-white p-3 rounded border">
                                                    <label class="form-label">Your Feedback:</label>
                                                    <p class="text-gray-700">${answer.tutorReport || 'N/A'}</p>
                                                </div>
                                            `}
                                        </div>
                                    `;
                                }
                                return '';
                            }).join('') : '<p class="text-gray-500">No assessment data available.</p>'}
                        </div>
                    </div>
                </div>
            `;

            if (needsFeedback) {
                if (!statusFilter || statusFilter === 'pending') {
                    pendingHTML += reportCard;
                    pendingCount++;
                }
            } else {
                if (!statusFilter || statusFilter === 'graded') {
                    gradedHTML += reportCard;
                    gradedCount++;
                }
            }
        });

        creativeWritingSnapshot.forEach(doc => {
            const data = doc.data();
            const needsFeedback = !data.tutorReport || data.tutorReport.trim() === '';

            const creativeWritingCard = `
                <div class="card border-l-4 border-blue-500">
                    <div class="card-body">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h4 class="font-bold text-lg">${data.studentName}</h4>
                                <p class="text-gray-600">${data.parentName || 'N/A'} • ${data.grade}</p>
                            </div>
                            <span class="badge ${needsFeedback ? 'badge-warning' : 'badge-success'}">
                                ${needsFeedback ? 'Pending Review' : 'Graded'}
                            </span>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div class="bg-blue-50 p-3 rounded">
                                <span class="text-sm text-blue-500">Type:</span>
                                <p class="font-medium">Creative Writing</p>
                            </div>
                            <div class="bg-blue-50 p-3 rounded">
                                <span class="text-sm text-blue-500">Submitted:</span>
                                <p class="font-medium">${new Date(data.submittedAt.seconds * 1000).toLocaleDateString()}</p>
                            </div>
                            <div class="bg-blue-50 p-3 rounded">
                                <span class="text-sm text-blue-500">Status:</span>
                                <p class="font-medium">${needsFeedback ? 'Needs Review' : 'Completed'}</p>
                            </div>
                        </div>

                        <div class="border-t pt-4">
                            <h5 class="font-semibold mb-2">Writing Assignment:</h5>
                            <div class="mb-4 p-4 bg-blue-50 rounded-lg">
                                <p class="font-medium mb-2">${data.questionText || 'Creative Writing Assignment'}</p>
                                <p class="italic text-gray-700 bg-white p-3 rounded border">${data.textAnswer || "No response"}</p>
                                ${data.fileUrl ? `
                                    <a href="${data.fileUrl}" target="_blank" class="btn btn-secondary btn-sm mt-3">
                                        📎 Download Attachment
                                    </a>
                                ` : ''}
                            </div>
                            
                            ${!data.tutorReport ? `
                                <div class="mt-4">
                                    <label class="form-label">Your Feedback</label>
                                    <textarea class="form-input form-textarea tutor-report" rows="4" placeholder="Provide constructive feedback on the student's writing..."></textarea>
                                    <button class="btn btn-primary mt-3 submit-report-btn" 
                                            data-doc-id="${doc.id}" 
                                            data-collection="tutor_submissions">
                                        Submit Feedback
                                    </button>
                                </div>
                            ` : `
                                <div class="mt-4 bg-white p-4 rounded border">
                                    <label class="form-label">Your Feedback:</label>
                                    <p class="text-gray-700">${data.tutorReport || 'N/A'}</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;

            if (needsFeedback) {
                if (!statusFilter || statusFilter === 'pending') {
                    pendingHTML += creativeWritingCard;
                    pendingCount++;
                }
            } else {
                if (!statusFilter || statusFilter === 'graded') {
                    gradedHTML += creativeWritingCard;
                    gradedCount++;
                }
            }
        });

        const pendingCountElement = document.getElementById('pending-count');
        if (pendingCountElement) {
            pendingCountElement.textContent = `${pendingCount} Pending`;
        }
        
        pendingReportsContainer.innerHTML = pendingHTML || `
            <div class="card">
                <div class="card-body text-center">
                    <div class="text-gray-400 text-4xl mb-3">📭</div>
                    <h4 class="font-bold text-gray-600 mb-2">No Pending Submissions</h4>
                    <p class="text-gray-500">All caught up! No submissions need your review.</p>
                </div>
            </div>
        `;
        
        if (gradedReportsContainer) {
            gradedReportsContainer.innerHTML = gradedHTML || `
                <div class="card">
                    <div class="card-body text-center">
                        <div class="text-gray-400 text-4xl mb-3">✅</div>
                        <h4 class="font-bold text-gray-600 mb-2">No Graded Submissions</h4>
                        <p class="text-gray-500">No submissions have been graded yet.</p>
                    </div>
                </div>
            `;
        }

        document.querySelectorAll('.submit-report-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const docId = e.target.getAttribute('data-doc-id');
                const collectionName = e.target.getAttribute('data-collection');
                const answerIndex = e.target.getAttribute('data-answer-index');
                const reportTextarea = e.target.closest('.mb-4, .mt-4').querySelector('.tutor-report');
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
                        
                        showCustomAlert('✅ Feedback submitted successfully!');
                        loadTutorReports(tutorEmail, parentName, statusFilter);
                    } catch (error) {
                        console.error("Error submitting feedback:", error);
                        showCustomAlert('❌ Failed to submit feedback. Please try again.');
                    }
                } else {
                    showCustomAlert('Please write some feedback before submitting.');
                }
            });
        });
    } catch (error) {
        console.error("Error loading tutor reports:", error);
        pendingReportsContainer.innerHTML = `
            <div class="card">
                <div class="card-body text-center">
                    <div class="text-red-400 text-4xl mb-3">⚠️</div>
                    <h4 class="font-bold text-red-600 mb-2">Failed to Load Reports</h4>
                    <p class="text-gray-500">Please check your connection and try again.</p>
                    <button class="btn btn-primary mt-3" onclick="location.reload()">Retry</button>
                </div>
            </div>
        `;
    }
}

// ============================================================================
// SECTION 11: STUDENT DATABASE (COMPLETE)
// ============================================================================
async function renderStudentDatabase(container, tutor) {
    updateActiveTab('navStudentDatabase');
    
    let savedReports = await loadReportsFromFirestore(tutor.email);

    const studentQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
    const pendingStudentQuery = query(collection(db, "pending_students"), where("tutorEmail", "==", tutor.email));
    const allSubmissionsQuery = query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutor.email));

    const [studentsSnapshot, pendingStudentsSnapshot, allSubmissionsSnapshot] = await Promise.all([
        getDocs(studentQuery),
        getDocs(pendingStudentQuery),
        getDocs(allSubmissionsQuery)
    ]);

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

    const approvedStudents = studentsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), isPending: false, collection: "students" }))
        .filter(student => !['archived', 'graduated', 'transferred'].includes(student.status));

    const pendingStudents = pendingStudentsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), isPending: true, collection: "pending_students" }))
        .filter(student => !['archived', 'graduated', 'transferred'].includes(student.status));

    let students = [...approvedStudents, ...pendingStudents];
    const studentsCount = students.length;

    // Create floating chat button if not exists
    if (!floatingChatBtn || !document.body.contains(floatingChatBtn)) {
        createFloatingChatButton();
    }

    // Student Database UI
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">📚 My Students (${studentsCount})</h2>
            </div>
            
            <div class="card mb-6">
                <div class="card-header">
                    <h3 class="font-bold text-lg">➕ Add a New Student</h3>
                </div>
                <div class="card-body">
                    <div class="space-y-4">
                        ${getNewStudentFormFields()}
                    </div>
                    <div class="action-buttons mt-4">`;
    
    if (isTutorAddEnabled) {
        container.innerHTML += `<button id="add-student-btn" class="btn btn-primary">➕ Add Student</button>`;
    }
    
    container.innerHTML += `<button id="add-transitioning-btn" class="btn btn-warning">🔄 Add Transitioning</button>`;
    
    container.innerHTML += `</div></div></div>`;
    
    container.innerHTML += `
        <div class="bg-gray-50 p-4 rounded-lg mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <span class="font-medium">Report Submission Status:</span>
                    <span class="${isSubmissionEnabled ? 'text-green-600 font-bold ml-2' : 'text-red-600 font-bold ml-2'}">
                        ${isSubmissionEnabled ? '✅ Enabled' : '❌ Disabled'}
                    </span>
                </div>
                <span class="text-sm text-gray-500">Set by admin</span>
            </div>
        </div>
    `;

    if (studentsCount === 0) {
        container.innerHTML += `
            <div class="card">
                <div class="card-body text-center">
                    <div class="text-gray-400 text-4xl mb-3">👤</div>
                    <h4 class="font-bold text-gray-600 mb-2">No Students Assigned</h4>
                    <p class="text-gray-500">You are not assigned to any students yet.</p>
                </div>
            </div>
        `;
    } else {
        container.innerHTML += `
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Student Name</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="students-table-body">
                        <!-- Students will be loaded here -->
                    </tbody>
                </table>
            </div>
        `;
        
        // Render students table
        renderStudentsTable(students, submittedStudentIds, savedReports, tutor, approvedStudents);
        
        if (tutor.isManagementStaff) {
            container.innerHTML += `
                <div class="card mt-6">
                    <div class="card-header">
                        <h3 class="font-bold text-lg">💼 Management Fee</h3>
                    </div>
                    <div class="card-body">
                        <p class="text-sm text-gray-600 mb-4">As you are part of the management staff, please set your monthly management fee before final submission.</p>
                        <div class="flex items-center space-x-4">
                            <div class="flex-1">
                                <label class="form-label">Monthly Management Fee (₦)</label>
                                <input type="number" id="management-fee-input" class="form-input" value="${tutor.managementFee || 0}">
                            </div>
                            <button id="save-management-fee-btn" class="btn btn-primary mt-6">Save Fee</button>
                        </div>
                    </div>
                </div>`;
        }
        
        if (approvedStudents.length > 1 && isSubmissionEnabled) {
            const submittableStudents = approvedStudents.filter(s => !s.summerBreak && !submittedStudentIds.has(s.id)).length;
            const allReportsSaved = Object.keys(savedReports).length === submittableStudents && submittableStudents > 0;
            
            if (submittableStudents > 0) {
                container.innerHTML += `
                    <div class="mt-6 text-right">
                        <button id="submit-all-reports-btn" class="btn btn-primary ${!allReportsSaved ? 'opacity-50 cursor-not-allowed' : ''}" ${!allReportsSaved ? 'disabled' : ''}>
                            📤 Submit All Reports (${submittableStudents})
                        </button>
                    </div>`;
            }
        }
    }

    // Attach event listeners
    attachStudentDatabaseEventListeners(students, tutor, savedReports, submittedStudentIds, approvedStudents);
}

function getNewStudentFormFields() {
    const gradeOptions = `
        <option value="">Select Grade</option>
        <option value="Preschool">Preschool</option>
        <option value="Kindergarten">Kindergarten</option>
        ${Array.from({ length: 12 }, (_, i) => `<option value="Grade ${i + 1}">Grade ${i + 1}</option>`).join('')}
        <option value="Pre-College">Pre-College</option>
        <option value="College">College</option>
        <option value="Adults">Adults</option>
    `;

    let feeOptions = '<option value="">Select Fee (₦)</option>';
    for (let fee = 10000; fee <= 400000; fee += 5000) {
        feeOptions += `<option value="${fee}">₦${fee.toLocaleString()}</option>`;
    }
    
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
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-group">
                <label class="form-label">Parent Name *</label>
                <input type="text" id="new-parent-name" class="form-input" placeholder="Parent Name" required>
            </div>
            <div class="form-group">
                <label class="form-label">Parent Phone *</label>
                <input type="tel" id="new-parent-phone" class="form-input" placeholder="Parent Phone Number" required>
            </div>
            <div class="form-group">
                <label class="form-label">Student Name *</label>
                <input type="text" id="new-student-name" class="form-input" placeholder="Student Name" required>
            </div>
            <div class="form-group">
                <label class="form-label">Grade *</label>
                <select id="new-student-grade" class="form-input" required>${gradeOptions}</select>
            </div>
        </div>
        
        ${subjectsHTML}
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div class="form-group">
                <label class="form-label">Days per Week *</label>
                <select id="new-student-days" class="form-input" required>
                    <option value="">Select Days per Week</option>
                    ${Array.from({ length: 7 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Fee (₦) *</label>
                <select id="new-student-fee" class="form-input" required>${feeOptions}</select>
            </div>
        </div>
        
        <div id="group-class-container" class="hidden mt-4">
            <label class="flex items-center space-x-2">
                <input type="checkbox" id="new-student-group-class" class="rounded">
                <span class="text-sm font-semibold">Group Class</span>
            </label>
        </div>
    `;
}

function renderStudentsTable(students, submittedStudentIds, savedReports, tutor, approvedStudents) {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    students.forEach(student => {
        const hasSubmittedThisMonth = submittedStudentIds.has(student.id);
        const isStudentOnBreak = student.summerBreak;
        const isReportSaved = savedReports[student.id];
        const isTransitioning = student.isTransitioning;

        const feeDisplay = showStudentFees ? `<div class="text-xs text-gray-500 mt-1">Fee: ₦${(student.studentFee || 0).toLocaleString()}</div>` : '';
        
        const subjects = student.subjects ? student.subjects.join(', ') : 'N/A';
        const days = student.days ? `${student.days} days/week` : 'N/A';

        let statusHTML = '';
        let actionsHTML = '';

        if (student.isPending) {
            statusHTML = `<span class="badge badge-warning">⏳ Awaiting Approval</span>`;
            actionsHTML = `<span class="text-gray-400">No actions available</span>`;
        } else if (hasSubmittedThisMonth) {
            statusHTML = `<span class="badge badge-info">📤 Report Sent</span>`;
            actionsHTML = `<span class="text-gray-400">Submitted this month</span>`;
        } else {
            const transitioningIndicator = isTransitioning ? `<span class="badge badge-warning ml-2">🔄 Transitioning</span>` : '';
            
            statusHTML = `<span class="${isReportSaved ? 'badge badge-success' : 'badge badge-secondary'}">${isReportSaved ? '💾 Report Saved' : '📝 Pending Report'}</span>${transitioningIndicator}`;

            actionsHTML = `<div class="action-buttons">`;

            if (isSummerBreakEnabled && !isStudentOnBreak) {
                actionsHTML += `<button class="btn btn-warning btn-sm summer-break-btn" data-student-id="${student.id}">⏸️ Break</button>`;
            } else if (isStudentOnBreak) {
                actionsHTML += `<span class="text-gray-400">On Break</span>`;
            }

            if (isSubmissionEnabled && !isStudentOnBreak) {
                if (approvedStudents.length === 1) {
                    actionsHTML += `<button class="btn btn-primary btn-sm submit-single-report-btn" data-student-id="${student.id}" data-is-transitioning="${isTransitioning}">📝 Submit Report</button>`;
                } else {
                    actionsHTML += `<button class="btn btn-primary btn-sm enter-report-btn" data-student-id="${student.id}" data-is-transitioning="${isTransitioning}">${isReportSaved ? '✏️ Edit Report' : '📝 Enter Report'}</button>`;
                }
            } else if (!isStudentOnBreak) {
                actionsHTML += `<span class="text-gray-400">Submission Disabled</span>`;
            }
            
            if (showEditDeleteButtons && !isStudentOnBreak) {
                actionsHTML += `
                    <button class="btn btn-info btn-sm edit-student-btn-tutor" data-student-id="${student.id}" data-collection="${student.collection}">✏️ Edit</button>
                    <button class="btn btn-danger btn-sm delete-student-btn-tutor" data-student-id="${student.id}" data-collection="${student.collection}">🗑️ Delete</button>
                `;
            }
            
            actionsHTML += `</div>`;
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="font-medium">${student.studentName}</div>
                <div class="text-sm text-gray-500">${cleanGradeString(student.grade)}</div>
                <div class="text-xs text-gray-400">Subjects: ${subjects}</div>
                <div class="text-xs text-gray-400">Days: ${days}</div>
                ${feeDisplay}
            </td>
            <td>${statusHTML}</td>
            <td>${actionsHTML}</td>
        `;
        
        tbody.appendChild(row);
    });
}

function attachStudentDatabaseEventListeners(students, tutor, savedReports, submittedStudentIds, approvedStudents) {
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

    // Add transitioning student
    const transitioningBtn = document.getElementById('add-transitioning-btn');
    if (transitioningBtn) {
        transitioningBtn.addEventListener('click', () => {
            showTransitioningConfirmation();
        });
    }

    // Add regular student
    const studentBtn = document.getElementById('add-student-btn');
    if (studentBtn && isTutorAddEnabled) {
        studentBtn.addEventListener('click', async () => {
            await addNewStudent(tutor);
        });
    }

    // Report buttons
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

    // Summer break buttons
    document.querySelectorAll('.summer-break-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const studentId = btn.getAttribute('data-student-id');
            const student = students.find(s => s.id === studentId);
            
            if (confirm(`Are you sure you want to put ${student.studentName} on Break?`)) {
                const studentRef = doc(db, "students", studentId);
                await updateDoc(studentRef, { summerBreak: true });
                showCustomAlert(`✅ ${student.studentName} has been marked as on Break.`);
                renderStudentDatabase(document.getElementById('mainContent'), tutor);
            }
        });
    });

    // Submit all reports
    const submitAllBtn = document.getElementById('submit-all-reports-btn');
    if (submitAllBtn) {
        submitAllBtn.addEventListener('click', () => {
            const reportsToSubmit = Object.values(savedReports);
            showAccountDetailsModal(reportsToSubmit);
        });
    }

    // Management fee
    const saveFeeBtn = document.getElementById('save-management-fee-btn');
    if (saveFeeBtn) {
        saveFeeBtn.addEventListener('click', async () => {
            const newFee = parseFloat(document.getElementById('management-fee-input').value);
            if (isNaN(newFee) || newFee < 0) {
                showCustomAlert("❌ Please enter a valid fee amount.");
                return;
            }
            const tutorRef = doc(db, "tutors", tutor.id);
            await updateDoc(tutorRef, { managementFee: newFee });
            showCustomAlert("✅ Management fee updated successfully.");
            window.tutorData.managementFee = newFee;
        });
    }
    
    // Edit student
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

    // Delete student
    document.querySelectorAll('.delete-student-btn-tutor').forEach(btn => {
        btn.addEventListener('click', async () => {
            const studentId = btn.getAttribute('data-student-id');
            const collectionName = btn.getAttribute('data-collection');
            const student = students.find(s => s.id === studentId && s.collection === collectionName);
            
            if (student && confirm(`Are you sure you want to delete ${student.studentName}? This action cannot be undone.`)) {
                try {
                    await deleteDoc(doc(db, collectionName, studentId));
                    showCustomAlert('✅ Student deleted successfully!');
                    renderStudentDatabase(document.getElementById('mainContent'), tutor);
                } catch (error) {
                    console.error("Error deleting student:", error);
                    showCustomAlert(`❌ An error occurred: ${error.message}`);
                }
            }
        });
    });
}

async function addNewStudent(tutor) {
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
        showCustomAlert('❌ Please fill in all parent and student details correctly, including at least one subject.');
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
        tutorName: tutor.name
    };

    if (findSpecializedSubject(selectedSubjects)) {
        studentData.groupClass = groupClass;
    }

    try {
        if (isBypassApprovalEnabled) {
            await addDoc(collection(db, "students"), studentData);
            showCustomAlert('✅ Student added successfully!');
        } else {
            await addDoc(collection(db, "pending_students"), studentData);
            showCustomAlert('✅ Student added and is pending approval.');
        }
        renderStudentDatabase(document.getElementById('mainContent'), tutor);
    } catch (error) {
        console.error("Error adding student:", error);
        showCustomAlert(`❌ An error occurred: ${error.message}`);
    }
}

function showTransitioningConfirmation() {
    const confirmationHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title text-orange-600">🔄 Add Transitioning Student</h3>
                </div>
                <div class="modal-body">
                    <p class="text-sm text-gray-600 mb-4">
                        <strong>Please confirm:</strong> Transitioning students skip monthly report writing and go directly to fee confirmation. 
                        They will be marked with orange indicators and their fees will be included in pay advice.
                    </p>
                    <p class="text-sm text-orange-600 font-semibold mb-4">
                        Are you sure you want to add a transitioning student?
                    </p>
                    <div class="modal-footer">
                        <button id="cancel-transitioning-btn" class="btn btn-secondary">Cancel</button>
                        <button id="confirm-transitioning-btn" class="btn btn-primary">Yes, Add Transitioning</button>
                    </div>
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
        showCustomAlert('❌ Please fill in all parent and student details correctly, including at least one subject.');
        return;
    }

    const payScheme = getTutorPayScheme(window.tutorData);
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
        tutorEmail: window.tutorData.email,
        tutorName: window.tutorData.name,
        isTransitioning: true
    };

    if (findSpecializedSubject(selectedSubjects)) {
        studentData.groupClass = groupClass;
    }

    try {
        if (isBypassApprovalEnabled) {
            await addDoc(collection(db, "students"), studentData);
            showCustomAlert('✅ Transitioning student added successfully!');
        } else {
            await addDoc(collection(db, "pending_students"), studentData);
            showCustomAlert('✅ Transitioning student added and is pending approval.');
        }
        renderStudentDatabase(document.getElementById('mainContent'), window.tutorData);
    } catch (error) {
        console.error("Error adding transitioning student:", error);
        showCustomAlert(`❌ An error occurred: ${error.message}`);
    }
}

function showReportModal(student) {
    if (student.isTransitioning) {
        const currentMonthYear = getCurrentMonthYear();
        const reportData = {
            studentId: student.id, 
            studentName: student.studentName, 
            grade: student.grade,
            parentName: student.parentName, 
            parentPhone: student.parentPhone,
            normalizedParentPhone: normalizePhoneNumber(student.parentPhone),
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
        <h3 class="text-xl font-bold mb-4">📝 Monthly Report for ${student.studentName}</h3>
        <div class="bg-blue-50 p-4 rounded-lg mb-4">
            <p class="font-semibold text-blue-800">Month: ${currentMonthYear}</p>
        </div>
        <div class="space-y-4">
            <div class="form-group">
                <label class="form-label">Introduction</label>
                <textarea id="report-intro" class="form-input form-textarea report-textarea" rows="3">${existingReport.introduction || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Topics & Remarks</label>
                <textarea id="report-topics" class="form-input form-textarea report-textarea" rows="4">${existingReport.topics || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Progress & Achievements</label>
                <textarea id="report-progress" class="form-input form-textarea report-textarea" rows="3">${existingReport.progress || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Strengths & Weaknesses</label>
                <textarea id="report-sw" class="form-input form-textarea report-textarea" rows="3">${existingReport.strengthsWeaknesses || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Recommendations</label>
                <textarea id="report-recs" class="form-input form-textarea report-textarea" rows="3">${existingReport.recommendations || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label">General Comments</label>
                <textarea id="report-general" class="form-input form-textarea report-textarea" rows="3">${existingReport.generalComments || ''}</textarea>
            </div>
            <div class="modal-footer">
                <button id="cancel-report-btn" class="btn btn-secondary">Cancel</button>
                <button id="modal-action-btn" class="btn btn-primary">${isSingleApprovedStudent ? 'Proceed to Submit' : 'Save Report'}</button>
            </div>
        </div>`;
    
    const reportModal = document.createElement('div');
    reportModal.className = 'modal-overlay';
    reportModal.innerHTML = `<div class="modal-content max-w-4xl">${reportFormHTML}</div>`;
    document.body.appendChild(reportModal);

    document.getElementById('cancel-report-btn').addEventListener('click', () => reportModal.remove());
    document.getElementById('modal-action-btn').addEventListener('click', async () => {
        const reportData = {
            studentId: student.id, 
            studentName: student.studentName, 
            grade: student.grade,
            parentName: student.parentName, 
            parentPhone: student.parentPhone,
            normalizedParentPhone: normalizePhoneNumber(student.parentPhone),
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
        <h3 class="text-xl font-bold mb-4">💰 Confirm Fee for ${student.studentName}</h3>
        <p class="text-sm text-gray-600 mb-4">Please verify the monthly fee for this student before saving the report.</p>
        <div class="space-y-4">
            <div class="form-group">
                <label class="form-label">Current Fee (₦)</label>
                <input type="number" id="confirm-student-fee" class="form-input" 
                       value="${student.studentFee || 0}" 
                       placeholder="Enter fee amount">
            </div>
            <div class="modal-footer">
                <button id="cancel-fee-confirm-btn" class="btn btn-secondary">Cancel</button>
                <button id="confirm-fee-btn" class="btn btn-primary">Confirm Fee & Save</button>
            </div>
        </div>`;

    const feeModal = document.createElement('div');
    feeModal.className = 'modal-overlay';
    feeModal.innerHTML = `<div class="modal-content max-w-lg">${feeConfirmationHTML}</div>`;
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
                showCustomAlert('✅ Student fee has been updated successfully!');
            } catch (error) {
                console.error("Error updating student fee:", error);
                showCustomAlert(`❌ Failed to update fee: ${error.message}`);
            }
        }

        feeModal.remove();

        if (isSingleApprovedStudent) {
            showAccountDetailsModal([reportData]);
        } else {
            savedReports[student.id] = reportData;
            await saveReportsToFirestore(tutor.email, savedReports);
            showCustomAlert(`✅ ${student.studentName}'s report has been saved.`);
            renderStudentDatabase(document.getElementById('mainContent'), tutor); 
        }
    });
}

function showAccountDetailsModal(reportsArray) {
    const accountFormHTML = `
        <h3 class="text-xl font-bold mb-4">🏦 Enter Your Payment Details</h3>
        <p class="text-sm text-gray-600 mb-4">Please provide your bank details for payment processing.</p>
        <div class="space-y-4">
            <div class="form-group">
                <label class="form-label">Beneficiary Bank Name *</label>
                <input type="text" id="beneficiary-bank" class="form-input" placeholder="e.g., Zenith Bank" required>
            </div>
            <div class="form-group">
                <label class="form-label">Beneficiary Account Number *</label>
                <input type="text" id="beneficiary-account" class="form-input" placeholder="Your 10-digit account number" required>
            </div>
            <div class="form-group">
                <label class="form-label">Beneficiary Name *</label>
                <input type="text" id="beneficiary-name" class="form-input" placeholder="Your full name as on the account" required>
            </div>
            <div class="modal-footer">
                <button id="cancel-account-btn" class="btn btn-secondary">Cancel</button>
                <button id="confirm-submit-btn" class="btn btn-primary">Confirm & Submit Report(s)</button>
            </div>
        </div>`;
    const accountModal = document.createElement('div');
    accountModal.className = 'modal-overlay';
    accountModal.innerHTML = `<div class="modal-content max-w-lg">${accountFormHTML}</div>`;
    document.body.appendChild(accountModal);

    document.getElementById('cancel-account-btn').addEventListener('click', () => accountModal.remove());
    document.getElementById('confirm-submit-btn').addEventListener('click', async () => {
        const accountDetails = {
            beneficiaryBank: document.getElementById('beneficiary-bank').value.trim(),
            beneficiaryAccount: document.getElementById('beneficiary-account').value.trim(),
            beneficiaryName: document.getElementById('beneficiary-name').value.trim(),
        };

        if (!accountDetails.beneficiaryBank || !accountDetails.beneficiaryAccount || !accountDetails.beneficiaryName) {
            showCustomAlert("❌ Please fill in all bank account details before submitting.");
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
        
        const finalReportData = {
            tutorEmail: window.tutorData.email,
            tutorName: window.tutorData.name,
            submittedAt: new Date(),
            ...report,
            ...accountDetails
        };
        
        if (!finalReportData.normalizedParentPhone && finalReportData.parentPhone) {
            finalReportData.normalizedParentPhone = normalizePhoneNumber(finalReportData.parentPhone);
        }
        
        batch.set(newReportRef, finalReportData);
    });

    try {
        await batch.commit();
        await clearAllReportsFromFirestore(window.tutorData.email);
        showCustomAlert(`✅ Successfully submitted ${reportsArray.length} report(s)!`);
        renderStudentDatabase(document.getElementById('mainContent'), window.tutorData);
    } catch (error) {
        console.error("Error submitting reports:", error);
        showCustomAlert(`❌ Error: ${error.message}`);
    }
}

function showEditStudentModal(student) {
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
    
    let daysOptions = '<option value="">Select Days per Week</option>';
    for (let i = 1; i <= 7; i++) {
        daysOptions += `<option value="${i}" ${student.days == i ? 'selected' : ''}>${i}</option>`;
    }

    const subjectsByCategory = {
        "Academics": ["Math", "Language Arts", "Geography", "Science", "Biology", "Physics", "Chemistry", "Microbiology"],
        "Pre-College Exams": ["SAT", "IGCSE", "A-Levels", "SSCE", "JAMB"],
        "Languages": ["French", "German", "Spanish", "Yoruba", "Igbo", "Hausa", "Arabic"],
        "Tech Courses": ["Coding","ICT", "Stop motion animation", "Computer Appreciation", "Digital Entrepeneurship", "Animation", "YouTube for kids", "Graphic design", "Videography", "Comic/book creation", "Artificial Intelligence", "Chess"],
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
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Parent Name</label>
                    <input type="text" id="edit-parent-name" class="form-input" value="${student.parentName || ''}" placeholder="Parent Name">
                </div>
                <div>
                    <label class="form-label">Parent Phone Number</label>
                    <input type="tel" id="edit-parent-phone" class="form-input" value="${student.parentPhone || ''}" placeholder="Parent Phone Number">
                </div>
                <div>
                    <label class="form-label">Student Name</label>
                    <input type="text" id="edit-student-name" class="form-input" value="${student.studentName || ''}" placeholder="Student Name">
                </div>
                <div>
                    <label class="form-label">Grade</label>
                    <select id="edit-student-grade" class="form-input">${gradeOptions}</select>
                </div>
            </div>
            
            ${subjectsHTML}
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label class="form-label">Days per Week</label>
                    <select id="edit-student-days" class="form-input">${daysOptions}</select>
                </div>
                <div>
                    <label class="form-label">Fee (₦)</label>
                    <input type="text" id="edit-student-fee" class="form-input" 
                           value="${(student.studentFee || 0).toLocaleString()}" 
                           placeholder="Enter fee (e.g., 50,000)">
                </div>
            </div>
            
            <div id="edit-group-class-container" class="${findSpecializedSubject(student.subjects || []) ? '' : 'hidden'}">
                <label class="flex items-center space-x-2">
                    <input type="checkbox" id="edit-student-group-class" class="rounded" ${student.groupClass ? 'checked' : ''}>
                    <span class="text-sm font-semibold">Group Class</span>
                </label>
            </div>
            
            <div class="flex justify-end space-x-2 mt-6">
                <button id="cancel-edit-btn" class="btn btn-secondary">Cancel</button>
                <button id="save-edit-btn" class="btn btn-primary" data-student-id="${student.id}" data-collection="${student.collection}">Save Changes</button>
            </div>
        </div>`;

    const editModal = document.createElement('div');
    editModal.className = 'modal-overlay';
    editModal.innerHTML = `<div class="modal-content max-w-2xl">${editFormHTML}</div>`;
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

            if (document.getElementById('edit-student-group-class')) {
                studentData.groupClass = groupClass;
            }

            const studentRef = doc(db, collectionName, studentId);
            await updateDoc(studentRef, studentData);
            
            editModal.remove();
            showCustomAlert('✅ Student details updated successfully!');
            
            const mainContent = document.getElementById('mainContent');
            if (mainContent && window.tutorData) {
                renderStudentDatabase(mainContent, window.tutorData);
            }
        } catch (error) {
            console.error("Error updating student:", error);
            showCustomAlert(`❌ An error occurred: ${error.message}`);
        }
    });
}

// ============================================================================
// SECTION 12: AUTO-REGISTERED STUDENTS (UPDATED)
// ============================================================================
async function renderAutoRegisteredStudents(container, tutor) {
    updateActiveTab('navAutoStudents');
    
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
                    <div class="font-medium">${student.studentName}</div>
                    <div class="text-sm text-gray-500">${student.grade} • ${student.parentPhone || 'No phone'}</div>
                    <div class="text-xs text-gray-400">${student.parentEmail || 'No email'}</div>
                </td>
                <td>
                    <span class="${statusClass}">
                        ${status}
                    </span>
                </td>
                <td class="text-sm text-gray-500">
                    ${student.testSubject || 'General Test'}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm complete-student-btn" 
                                data-student-id="${student.id}" data-collection="${student.collection}">
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

// ============================================================================
// SECTION 13: LOCAL & FIRESTORE STORAGE
// ============================================================================
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

// ============================================================================
// SECTION 14: EMPLOYMENT & TIN POPUPS
// ============================================================================
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
                        <input type="month" id="employment-date" class="form-input" max="${new Date().toISOString().slice(0, 7)}">
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

// ============================================================================
// SECTION 15: MAIN APP INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const tutorQuery = query(collection(db, "tutors"), where("email", "==", user.email.trim()));
            const querySnapshot = await getDocs(tutorQuery);
            
            if (!querySnapshot.empty) {
                const tutorDoc = querySnapshot.docs[0];
                const tutorData = { id: tutorDoc.id, ...tutorDoc.data() };
                
                // Check if tutor is inactive
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
                
                // Listen for settings changes
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
                    }
                });
                
                renderTutorDashboard(document.getElementById('mainContent'), tutorData);
                
                setTimeout(async () => {
                    await checkAndShowSchedulePopup(tutorData);
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
            window.location.href = 'login.html';
        }
    });

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

    const navDashboard = document.getElementById('navDashboard');
    if (navDashboard) {
        navDashboard.addEventListener('click', () => {
            if (window.tutorData) {
                renderTutorDashboard(document.getElementById('mainContent'), window.tutorData);
            }
        });
    }

    const navStudentDatabase = document.getElementById('navStudentDatabase');
    if (navStudentDatabase) {
        navStudentDatabase.addEventListener('click', () => {
            if (window.tutorData) {
                renderStudentDatabase(document.getElementById('mainContent'), window.tutorData);
            }
        });
    }

    const navAutoStudents = document.getElementById('navAutoStudents');
    if (navAutoStudents) {
        navAutoStudents.addEventListener('click', () => {
            if (window.tutorData) {
                renderAutoRegisteredStudents(document.getElementById('mainContent'), window.tutorData);
            }
        });
    }
});

