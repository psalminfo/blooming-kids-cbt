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
        
        const allStudents = [];
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
                                        <option value="00:00">12:00 AM (Midnight)</option>
                                        ${Array.from({length: 23}, (_, i) => {
                                            const hour = i + 1;
                                            const period = hour >= 12 ? 'PM' : 'AM';
                                            const displayHour = hour % 12 || 12;
                                            return `<option value="${hour.toString().padStart(2, '0')}:00">${displayHour}:00 ${period}</option>
                                                    <option value="${hour.toString().padStart(2, '0')}:30">${displayHour}:30 ${period}</option>`;
                                        }).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="form-label">End Time</label>
                                    <select class="form-input schedule-end">
                                        <option value="00:00">12:00 AM (Midnight)</option>
                                        ${Array.from({length: 23}, (_, i) => {
                                            const hour = i + 1;
                                            const period = hour >= 12 ? 'PM' : 'AM';
                                            const displayHour = hour % 12 || 12;
                                            return `<option value="${hour.toString().padStart(2, '0')}:00">${displayHour}:00 ${period}</option>
                                                    <option value="${hour.toString().padStart(2, '0')}:30">${displayHour}:30 ${period}</option>`;
                                        }).join('')}
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
        const topicData = {
            studentId: student.id,
            studentName: student.studentName,
            parentEmail: student.parentEmail,
            parentPhone: student.parentPhone,
            parentName: student.parentName,
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
        const hwData = {
            studentId: student.id,
            studentName: student.studentName,
            parentEmail: student.parentEmail,
            parentPhone: student.parentPhone,
            parentName: student.parentName,
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
// SECTION 11: STUDENT DATABASE (simplified version)
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

    // Simplified UI - just show the table
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">📚 My Students (${studentsCount})</h2>
            </div>
            
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
        </div>
    `;

    // Render students table
    renderStudentsTable(students, submittedStudentIds, savedReports, tutor);
}

function renderStudentsTable(students, submittedStudentIds, savedReports, tutor) {
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

// ============================================================================
// SECTION 12: AUTO-REGISTERED STUDENTS (simplified)
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
