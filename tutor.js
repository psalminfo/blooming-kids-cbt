import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, deleteDoc, setDoc, Timestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// --- Inject CSS for dashboard and transitioning button ---
const style = document.createElement('style');
style.textContent = `
    /* Dashboard Specific Styles */
    .hero-section {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        border-radius: 0.75rem;
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
    
    .student-actions-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1rem;
        margin-top: 1.5rem;
        margin-bottom: 2rem;
    }
    
    .student-action-card {
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        padding: 1rem;
        transition: all 0.2s ease;
    }
    
    .student-action-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    
    .report-textarea {
        min-height: 150px;
        font-size: 1.05rem;
        line-height: 1.5;
    }
    
    /* Status Indicators */
    .status-dot {
        display: inline-block;
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 50%;
        margin-right: 0.5rem;
    }
    
    .status-dot-success {
        background-color: #10b981;
    }
    
    .status-dot-warning {
        background-color: #f59e0b;
    }
    
    .status-dot-danger {
        background-color: #ef4444;
    }
    
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
    
    #add-transitioning-btn:hover {
        background: darkorange !important;
    }

    /* Enhanced CSS for redesigned workflow */
    .workflow-modal-container {
        max-width: 800px !important;
        margin: 1rem auto !important;
        background: white !important;
        border-radius: 12px !important;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1) !important;
        overflow: hidden !important;
    }
    
    .workflow-header {
        background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%) !important;
        color: white !important;
        padding: 1.5rem 2rem !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
    }
    
    .workflow-header h3 {
        font-size: 1.5rem !important;
        font-weight: 600 !important;
        margin: 0 !important;
    }
    
    .workflow-header .subtitle {
        font-size: 0.875rem !important;
        opacity: 0.9 !important;
        margin-top: 0.25rem !important;
    }
    
    .workflow-content {
        padding: 2rem !important;
        max-height: 70vh !important;
        overflow-y: auto !important;
    }
    
    .workflow-footer {
        padding: 1.5rem 2rem !important;
        background: #f9fafb !important;
        border-top: 1px solid #e5e7eb !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
    }
    
    /* Report Section Styling */
    .report-section {
        margin-bottom: 1.5rem !important;
        padding: 1.25rem !important;
        background: #ffffff !important;
        border: 1px solid #e5e7eb !important;
        border-radius: 8px !important;
        transition: all 0.2s ease !important;
    }
    
    .report-section:hover {
        border-color: #d1d5db !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05) !important;
    }
    
    .report-section-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 0.75rem !important;
    }
    
    .report-section-title {
        font-size: 1rem !important;
        font-weight: 600 !important;
        color: #111827 !important;
    }
    
    .report-section-description {
        font-size: 0.875rem !important;
        color: #6b7280 !important;
        margin-bottom: 0.75rem !important;
    }
    
    .character-counter {
        font-size: 0.75rem !important;
        font-family: 'SF Mono', Monaco, 'Courier New', monospace !important;
        color: #6b7280 !important;
    }
    
    .enhanced-textarea {
        width: 100% !important;
        padding: 0.75rem !important;
        border: 2px solid #e5e7eb !important;
        border-radius: 6px !important;
        font-size: 0.875rem !important;
        line-height: 1.5 !important;
        transition: all 0.2s ease !important;
        min-height: 80px !important;
        resize: vertical !important;
    }
    
    .enhanced-textarea:focus {
        outline: none !important;
        border-color: #3b82f6 !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
    }
    
    /* Progress Bar */
    .completion-progress {
        margin: 1.5rem 0 !important;
    }
    
    .progress-label {
        display: flex !important;
        justify-content: space-between !important;
        font-size: 0.875rem !important;
        color: #6b7280 !important;
        margin-bottom: 0.5rem !important;
    }
    
    .progress-bar {
        height: 6px !important;
        background: #e5e7eb !important;
        border-radius: 3px !important;
        overflow: hidden !important;
    }
    
    .progress-fill {
        height: 100% !important;
        background: linear-gradient(90deg, #10b981 0%, #3b82f6 100%) !important;
        border-radius: 3px !important;
        transition: width 0.3s ease !important;
    }
    
    /* Button Styles */
    .btn {
        padding: 0.625rem 1.25rem !important;
        border-radius: 6px !important;
        font-size: 0.875rem !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        border: none !important;
    }
    
    .btn-primary {
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%) !important;
        color: white !important;
    }
    
    .btn-primary:hover:not(:disabled) {
        background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%) !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3) !important;
    }
    
    .btn-secondary {
        background: #6b7280 !important;
        color: white !important;
    }
    
    .btn-secondary:hover {
        background: #4b5563 !important;
    }
    
    .btn-outline {
        background: transparent !important;
        border: 1px solid #d1d5db !important;
        color: #374151 !important;
    }
    
    .btn-outline:hover {
        background: #f9fafb !important;
        border-color: #9ca3af !important;
    }
    
    .btn-success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
        color: white !important;
    }
    
    .btn-success:hover:not(:disabled) {
        background: linear-gradient(135deg, #059669 0%, #047857 100%) !important;
    }
    
    .btn:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
        transform: none !important;
    }
    
    /* Student Info Panel */
    .student-info-panel {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
        gap: 1rem !important;
        margin-bottom: 1.5rem !important;
    }
    
    .info-card {
        padding: 1rem !important;
        background: #f8fafc !important;
        border-radius: 6px !important;
        border: 1px solid #e2e8f0 !important;
    }
    
    .info-label {
        font-size: 0.75rem !important;
        color: #64748b !important;
        text-transform: uppercase !important;
        letter-spacing: 0.05em !important;
        margin-bottom: 0.25rem !important;
    }
    
    .info-value {
        font-size: 0.875rem !important;
        color: #1e293b !important;
        font-weight: 500 !important;
    }
    
    /* Fee Confirmation Card */
    .fee-card {
        padding: 1.5rem !important;
        background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%) !important;
        border: 1px solid #bae6fd !important;
        border-radius: 8px !important;
        margin-bottom: 1.5rem !important;
    }
    
    .fee-header {
        display: flex !important;
        align-items: center !important;
        margin-bottom: 1rem !important;
    }
    
    .fee-icon {
        width: 40px !important;
        height: 40px !important;
        background: #0ea5e9 !important;
        color: white !important;
        border-radius: 8px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin-right: 0.75rem !important;
    }
    
    .fee-title {
        font-size: 1rem !important;
        font-weight: 600 !important;
        color: #0369a1 !important;
    }
    
    .fee-description {
        font-size: 0.875rem !important;
        color: #0c4a6e !important;
    }
    
    /* Form Field Styling */
    .form-group {
        margin-bottom: 1.25rem !important;
    }
    
    .form-label {
        display: block !important;
        font-size: 0.875rem !important;
        font-weight: 500 !important;
        color: #374151 !important;
        margin-bottom: 0.375rem !important;
    }
    
    .form-input {
        width: 100% !important;
        padding: 0.625rem 0.75rem !important;
        border: 1px solid #d1d5db !important;
        border-radius: 6px !important;
        font-size: 0.875rem !important;
        transition: all 0.2s ease !important;
    }
    
    .form-input:focus {
        outline: none !important;
        border-color: #3b82f6 !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
    }
    
    /* Payment Details */
    .payment-grid {
        display: grid !important;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)) !important;
        gap: 1rem !important;
        margin-bottom: 1.5rem !important;
    }
    
    /* Alert Styles */
    .alert {
        padding: 0.875rem 1rem !important;
        border-radius: 6px !important;
        margin-bottom: 1rem !important;
        font-size: 0.875rem !important;
    }
    
    .alert-info {
        background: #eff6ff !important;
        border: 1px solid #bfdbfe !important;
        color: #1e40af !important;
    }
    
    .alert-warning {
        background: #fffbeb !important;
        border: 1px solid #fde68a !important;
        color: #92400e !important;
    }
    
    /* Transitioning Student Badge */
    .transitioning-badge {
        display: inline-flex !important;
        align-items: center !important;
        padding: 0.25rem 0.625rem !important;
        background: #fed7aa !important;
        color: #9a3412 !important;
        border-radius: 9999px !important;
        font-size: 0.75rem !important;
        font-weight: 500 !important;
        margin-left: 0.5rem !important;
    }
    
    /* Loading Animation */
    .loading-spinner {
        display: inline-block !important;
        width: 1rem !important;
        height: 1rem !important;
        border: 2px solid rgba(255, 255, 255, 0.3) !important;
        border-radius: 50% !important;
        border-top-color: white !important;
        animation: spin 1s linear infinite !important;
        margin-right: 0.5rem !important;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    /* Card Styles */
    .card {
        background: white;
        border-radius: 0.75rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        border: 1px solid #e5e7eb;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    .card:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }
    
    .card-header {
        padding: 1.5rem 1.5rem 1rem;
        border-bottom: 1px solid #e5e7eb;
    }
    
    .card-body {
        padding: 1.5rem;
    }
    
    /* Badge Styles */
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
        background-color: #d1fae5;
        color: #059669;
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
    
    /* Table Styles */
    .table-container {
        overflow-x: auto;
        border-radius: 0.5rem;
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    }
    
    .table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
    }
    
    .table th {
        background-color: #f9fafb;
        padding: 1rem;
        font-weight: 600;
        text-align: left;
        color: #1f2937;
        border-bottom: 2px solid #e5e7eb;
    }
    
    .table td {
        padding: 1rem;
        border-bottom: 1px solid #e5e7eb;
        vertical-align: middle;
    }
    
    .table tr:hover {
        background-color: #f9fafb;
    }
    
    /* Form Styles */
    .form-group {
        margin-bottom: 1.25rem;
    }
    
    .form-label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: #1f2937;
    }
    
    .form-input {
        width: 100%;
        padding: 0.75rem 1rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        font-size: 1rem;
    }
    
    .form-input:focus {
        outline: none;
        border-color: #10b981;
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }
    
    .form-textarea {
        min-height: 120px;
        resize: vertical;
        padding: 0.75rem 1rem;
        font-size: 1rem;
    }
    
    /* Action Buttons Container */
    .action-buttons {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }
    
    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        font-weight: 500;
        font-size: 0.875rem;
        line-height: 1.25rem;
        transition: all 0.2s ease;
        border: none;
        cursor: pointer;
        gap: 0.5rem;
    }
    
    .btn-primary {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    
    .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    }
    
    .btn-secondary {
        background-color: white;
        color: #1f2937;
        border: 1px solid #e5e7eb;
    }
    
    .btn-secondary:hover {
        background-color: #f9fafb;
    }
    
    .btn-danger {
        background-color: #ef4444;
        color: white;
    }
    
    .btn-warning {
        background-color: #f59e0b;
        color: white;
    }
    
    .btn-info {
        background-color: #3b82f6;
        color: white;
    }
    
    .btn-sm {
        padding: 0.375rem 0.75rem;
        font-size: 0.75rem;
    }
    
    .hidden {
        display: none !important;
    }
`;
document.head.appendChild(style);

// --- Global state to hold report submission status ---
let isSubmissionEnabled = false;
let isTutorAddEnabled = false;
let isSummerBreakEnabled = false;
let isBypassApprovalEnabled = false;
// NEW: Global state for new admin settings
let showStudentFees = false;
let showEditDeleteButtons = false;

// Cache for students
let studentCache = [];

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

// --- Subject Categorization ---
const SUBJECT_CATEGORIES = {
    "Native Language": ["Yoruba", "Igbo", "Hausa"],
    "Foreign Language": ["French", "German", "Spanish", "Arabic"],
    "Specialized": ["Music", "Coding","ICT", "Chess", "Public Speaking", "English Proficiency", "Counseling Programs"]
};

// --- Phone Number Normalization Function ---
function normalizePhoneNumber(phone) {
    if (!phone) return '';
    
    // Remove all non-digit characters except leading +
    let cleaned = phone.toString().trim();
    
    // If it already starts with +, keep it
    if (cleaned.startsWith('+')) {
        // Ensure there are only digits after the +
        const digits = cleaned.substring(1).replace(/\D/g, '');
        return '+' + digits;
    }
    
    // If it starts with 0, assume it's a local number and add +234
    if (cleaned.startsWith('0')) {
        const digits = cleaned.replace(/\D/g, '');
        if (digits.startsWith('0')) {
            return '+234' + digits.substring(1);
        }
    }
    
    // If it starts with country code without +, add +
    if (cleaned.match(/^234/)) {
        const digits = cleaned.replace(/\D/g, '');
        return '+' + digits;
    }
    
    // If it's just digits, check length and add appropriate prefix
    const digits = cleaned.replace(/\D/g, '');
    
    // For Nigerian numbers (10 digits starting with 7, 8, or 9)
    if (digits.length === 10 && /^[789]/.test(digits)) {
        return '+234' + digits;
    }
    
    // For other international numbers, just add + if not present
    if (digits.length >= 10 && !cleaned.startsWith('+')) {
        return '+' + digits;
    }
    
    // If we can't determine, return as is with + added if it's just digits
    if (/^\d+$/.test(cleaned) && !cleaned.startsWith('+')) {
        return '+' + cleaned;
    }
    
    return cleaned;
}

// --- Firestore Functions for Report Persistence (Cross-Device) ---
async function saveReportsToFirestore(tutorEmail, reports) {
    try {
        const reportRef = doc(db, "tutor_saved_reports", tutorEmail);
        
        // Use setDoc with merge: true instead of updateDoc
        await setDoc(reportRef, {
            reports: reports,
            lastUpdated: new Date()
        }, { merge: true });
        
    } catch (error) {
        console.warn('Error saving to Firestore:', error);
        // Fallback to localStorage
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
            // Fallback to localStorage if no Firestore data
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

// --- Local Storage Functions for Report Persistence (Fallback) ---
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
            <div class="workflow-modal-container">
                <div class="workflow-header">
                    <h3>Employment Information</h3>
                    <div class="subtitle">Help us calculate your payments accurately</div>
                </div>
                <div class="workflow-content">
                    <div class="alert alert-info">
                        Please provide your employment start date to ensure accurate payment calculations.
                    </div>
                    <div class="form-group">
                        <label class="form-label">Month & Year of Employment</label>
                        <input type="month" id="employment-date" class="form-input" 
                               max="${new Date().toISOString().slice(0, 7)}">
                    </div>
                </div>
                <div class="workflow-footer">
                    <button id="save-employment-btn" class="btn btn-primary">Save Employment Date</button>
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
            showCustomAlert('Please select your employment month and year.', 'warning');
            return;
        }

        try {
            const tutorRef = doc(db, "tutors", tutor.id);
            await updateDoc(tutorRef, { employmentDate: employmentDate });
            localStorage.setItem(`employmentPopup_${tutor.email}`, new Date().toISOString().slice(0, 7));
            popup.remove();
            showCustomAlert('Employment date saved successfully!', 'success');
            window.tutorData.employmentDate = employmentDate;
        } catch (error) {
            console.error("Error saving employment date:", error);
            showCustomAlert('Error saving employment date. Please try again.', 'error');
        }
    });
}

// --- TIN Functions ---
function shouldShowTINPopup(tutor) {
    // Don't show if already has TIN
    if (tutor.tinNumber) return false;
    
    // Show on first login each month until they provide it
    const lastPopupShown = localStorage.getItem(`tinPopup_${tutor.email}`);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    return !lastPopupShown || lastPopupShown !== currentMonth;
}

function showTINPopup(tutor) {
    const popupHTML = `
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div class="workflow-modal-container">
                <div class="workflow-header">
                    <h3>Tax Identification Number (TIN)</h3>
                    <div class="subtitle">Required for payment processing and tax documentation</div>
                </div>
                <div class="workflow-content">
                    <div class="alert alert-warning">
                        Please provide your TIN for proper payment processing and tax documentation.
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tax Identification Number (TIN)</label>
                        <input type="text" id="tin-number" class="form-input" 
                               placeholder="Enter your TIN (e.g., 1234567890)" maxlength="20">
                    </div>
                </div>
                <div class="workflow-footer">
                    <button id="no-tin-btn" class="btn btn-outline">I don't have TIN</button>
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
            showCustomAlert('Please enter your TIN or click "I don\'t have TIN".', 'warning');
            return;
        }

        try {
            const tutorRef = doc(db, "tutors", tutor.id);
            await updateDoc(tutorRef, { tinNumber: tinNumber });
            popup.remove();
            showCustomAlert('TIN saved successfully!', 'success');
            window.tutorData.tinNumber = tinNumber;
        } catch (error) {
            console.error("Error saving TIN:", error);
            showCustomAlert('Error saving TIN. Please try again.', 'error');
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

// Function to clean grade string
function cleanGradeString(grade) {
    if (grade && grade.toLowerCase().includes("grade")) {
        return grade;
    } else {
        return `Grade ${grade}`;
    }
}

// Update active tab
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

// Show custom alert
function showCustomAlert(message, type = 'info') {
    const alertModal = document.createElement('div');
    alertModal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
    
    const typeConfig = {
        'success': { bg: 'bg-green-50', border: 'border-green-400', text: 'text-green-700', icon: '✓' },
        'error': { bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700', icon: '✗' },
        'warning': { bg: 'bg-yellow-50', border: 'border-yellow-400', text: 'text-yellow-700', icon: '⚠' },
        'info': { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', icon: 'ℹ' }
    };
    
    const config = typeConfig[type] || typeConfig.info;
    
    alertModal.innerHTML = `
        <div class="workflow-modal-container">
            <div class="${config.bg} ${config.border} border-l-4 p-4">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <span class="${config.text} font-bold">${config.icon}</span>
                    </div>
                    <div class="ml-3">
                        <p class="${config.text}">${message}</p>
                    </div>
                </div>
            </div>
            <div class="workflow-footer">
                <button id="alert-ok-btn" class="btn btn-primary">OK</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(alertModal);
    document.getElementById('alert-ok-btn').addEventListener('click', () => alertModal.remove());
}

function getStudentFromCache(studentId) {
    return studentCache.find(s => s.id === studentId);
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
// # SECTION 1: ENHANCED TUTOR DASHBOARD
// ##################################################################

// Enhanced Tutor Dashboard
async function renderTutorDashboard(container, tutor) {
    // Update active tab
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
    
    // Enable buttons when students are selected
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
                        
                        showCustomAlert('✅ Feedback submitted successfully!', 'success');
                        loadTutorReports(tutorEmail, parentName, statusFilter);
                    } catch (error) {
                        console.error("Error submitting feedback:", error);
                        showCustomAlert('❌ Failed to submit feedback. Please try again.', 'error');
                    }
                } else {
                    showCustomAlert('Please write some feedback before submitting.', 'warning');
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

// Placeholder functions for dashboard features
function showScheduleCalendarModal() {
    showCustomAlert('Schedule calendar feature is coming soon!', 'info');
}

function checkAndShowSchedulePopup(tutor) {
    // This would be implemented with schedule management
    console.log('Schedule check for:', tutor.name);
}

function showDailyTopicModal(student) {
    showCustomAlert(`Daily topic feature for ${student.studentName} is coming soon!`, 'info');
}

function showHomeworkModal(student) {
    showCustomAlert(`Homework assignment feature for ${student.studentName} is coming soon!`, 'info');
}

// Global variables needed for student database
let approvedStudents = [];
let submittedStudentIds = new Set();
let savedReports = {};

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
            showCustomAlert('Please fill in all parent and student details correctly, including at least one subject.', 'warning');
            return;
        }

        if (isNaN(studentFee) || studentFee < 0) {
            showCustomAlert('Please enter a valid fee amount.', 'warning');
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
            showCustomAlert('Student details updated successfully!', 'success');
            
            // Refresh the student database view
            const mainContent = document.getElementById('mainContent');
            renderStudentDatabase(mainContent, window.tutorData);
        } catch (error) {
            console.error("Error updating student:", error);
            showCustomAlert(`An error occurred: ${error.message}`, 'error');
        }
    });
}

// ============================================================================
// REDESIGNED REPORT SUBMISSION WORKFLOW - ENTIRE FLOW
// ============================================================================

// STEP 1: Show Monthly Report Modal (Redesigned)
async function showReportModal(student) {
    // Load saved reports for this tutor
    savedReports = await loadReportsFromFirestore(window.tutorData.email);
    
    // Skip report modal for transitioning students
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
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div class="workflow-modal-container">
                <div class="workflow-header">
                    <h3>Monthly Report</h3>
                    <div class="subtitle">Complete the report for ${student.studentName}</div>
                </div>
                
                <div class="workflow-content">
                    <!-- Student Info Panel -->
                    <div class="student-info-panel">
                        <div class="info-card">
                            <div class="info-label">Student</div>
                            <div class="info-value">${student.studentName}</div>
                        </div>
                        <div class="info-card">
                            <div class="info-label">Grade</div>
                            <div class="info-value">${cleanGradeString(student.grade)}</div>
                        </div>
                        <div class="info-card">
                            <div class="info-label">Parent</div>
                            <div class="info-value">${student.parentName || 'Not specified'}</div>
                        </div>
                        <div class="info-card">
                            <div class="info-label">Report Month</div>
                            <div class="info-value">${currentMonthYear}</div>
                        </div>
                    </div>

                    <!-- Progress Bar -->
                    <div class="completion-progress">
                        <div class="progress-label">
                            <span>Report Completion</span>
                            <span id="completion-percentage">0%</span>
                        </div>
                        <div class="progress-bar">
                            <div id="completion-bar" class="progress-fill" style="width: 0%"></div>
                        </div>
                    </div>

                    <!-- Report Sections -->
                    <div class="space-y-4">
                        <!-- Introduction -->
                        <div class="report-section">
                            <div class="report-section-header">
                                <div class="report-section-title">Introduction</div>
                                <div class="character-counter" data-for="report-intro">0/500</div>
                            </div>
                            <div class="report-section-description">
                                Brief overview of this month's focus and goals
                            </div>
                            <textarea id="report-intro" class="enhanced-textarea" rows="3" 
                                      placeholder="What were the main learning objectives this month? Describe the overall focus..."
                                      maxlength="500">${existingReport.introduction || ''}</textarea>
                        </div>

                        <!-- Topics & Remarks -->
                        <div class="report-section">
                            <div class="report-section-header">
                                <div class="report-section-title">Topics & Remarks</div>
                                <div class="character-counter" data-for="report-topics">0/1000</div>
                            </div>
                            <div class="report-section-description">
                                Specific topics covered and your observations
                            </div>
                            <textarea id="report-topics" class="enhanced-textarea" rows="4" 
                                      placeholder="List the topics covered and any important remarks. Be specific about what was taught..."
                                      maxlength="1000">${existingReport.topics || ''}</textarea>
                        </div>

                        <!-- Progress & Achievements -->
                        <div class="report-section">
                            <div class="report-section-header">
                                <div class="report-section-title">Progress & Achievements</div>
                                <div class="character-counter" data-for="report-progress">0/800</div>
                            </div>
                            <div class="report-section-description">
                                Notable improvements and accomplishments
                            </div>
                            <textarea id="report-progress" class="enhanced-textarea" rows="3" 
                                      placeholder="What progress did the student make? Any specific achievements or milestones reached?"
                                      maxlength="800">${existingReport.progress || ''}</textarea>
                        </div>

                        <!-- Strengths & Weaknesses -->
                        <div class="report-section">
                            <div class="report-section-header">
                                <div class="report-section-title">Strengths & Weaknesses</div>
                                <div class="character-counter" data-for="report-sw">0/600</div>
                            </div>
                            <div class="report-section-description">
                                Areas of strength and areas needing improvement
                            </div>
                            <textarea id="report-sw" class="enhanced-textarea" rows="3" 
                                      placeholder="Identify the student's strengths and areas for growth. Be constructive..."
                                      maxlength="600">${existingReport.strengthsWeaknesses || ''}</textarea>
                        </div>

                        <!-- Recommendations -->
                        <div class="report-section">
                            <div class="report-section-header">
                                <div class="report-section-title">Recommendations</div>
                                <div class="character-counter" data-for="report-recs">0/500</div>
                            </div>
                            <div class="report-section-description">
                                Suggestions for next month's learning
                            </div>
                            <textarea id="report-recs" class="enhanced-textarea" rows="3" 
                                      placeholder="What should be focused on next month? Any specific recommendations for improvement?"
                                      maxlength="500">${existingReport.recommendations || ''}</textarea>
                        </div>

                        <!-- General Comments -->
                        <div class="report-section">
                            <div class="report-section-header">
                                <div class="report-section-title">General Comments</div>
                                <div class="character-counter" data-for="report-general">0/400</div>
                            </div>
                            <div class="report-section-description">
                                Any additional comments or notes
                            </div>
                            <textarea id="report-general" class="enhanced-textarea" rows="2" 
                                      placeholder="Any other observations, comments, or notes about the student's performance..."
                                      maxlength="400">${existingReport.generalComments || ''}</textarea>
                        </div>
                    </div>
                </div>
                
                <div class="workflow-footer">
                    <button id="cancel-report-btn" class="btn btn-outline">Cancel</button>
                    <div class="space-x-2">
                        <button id="save-draft-btn" class="btn btn-secondary" data-student-id="${student.id}">
                            Save Draft
                        </button>
                        <button id="modal-action-btn" class="btn btn-primary" 
                                data-is-single="${isSingleApprovedStudent}">
                            ${isSingleApprovedStudent ? 'Continue to Fee' : 'Save Report'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const reportModal = document.createElement('div');
    reportModal.innerHTML = reportFormHTML;
    document.body.appendChild(reportModal);

    // Initialize character counters and progress tracking
    function initializeReportModal() {
        // Character counters
        function updateCharacterCounters() {
            document.querySelectorAll('.character-counter').forEach(counter => {
                const textareaId = counter.getAttribute('data-for');
                const textarea = document.getElementById(textareaId);
                if (textarea) {
                    const currentLength = textarea.value.length;
                    const maxLength = parseInt(textarea.getAttribute('maxlength') || 1000);
                    counter.textContent = `${currentLength}/${maxLength}`;
                    
                    // Color coding
                    if (currentLength > maxLength * 0.9) {
                        counter.style.color = '#ef4444';
                    } else if (currentLength > maxLength * 0.7) {
                        counter.style.color = '#f59e0b';
                    }
                }
            });
        }

        // Progress tracking
        function updateCompletionProgress() {
            const textareas = ['report-intro', 'report-topics', 'report-progress', 'report-sw', 'report-recs', 'report-general'];
            let completed = 0;
            
            textareas.forEach(id => {
                const textarea = document.getElementById(id);
                if (textarea && textarea.value.trim().length >= 20) {
                    completed++;
                }
            });
            
            const percentage = Math.round((completed / textareas.length) * 100);
            document.getElementById('completion-percentage').textContent = `${percentage}%`;
            document.getElementById('completion-bar').style.width = `${percentage}%`;
            
            // Update button state
            const actionBtn = document.getElementById('modal-action-btn');
            if (percentage >= 50) {
                actionBtn.disabled = false;
                actionBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

        // Initialize
        updateCharacterCounters();
        updateCompletionProgress();

        // Event listeners
        document.querySelectorAll('.enhanced-textarea').forEach(textarea => {
            textarea.addEventListener('input', () => {
                updateCharacterCounters();
                updateCompletionProgress();
            });
        });
    }

    // Initialize modal functionality
    initializeReportModal();

    // Save Draft button
    document.getElementById('save-draft-btn').addEventListener('click', async () => {
        const reportData = collectReportData(student, currentMonthYear);
        savedReports[student.id] = reportData;
        
        try {
            await saveReportsToFirestore(window.tutorData.email, savedReports);
            showCustomAlert('Draft saved successfully!', 'success');
        } catch (error) {
            console.error("Error saving draft:", error);
            showCustomAlert('Error saving draft. Please try again.', 'error');
        }
    });

    // Cancel button
    document.getElementById('cancel-report-btn').addEventListener('click', () => {
        if (confirm('Are you sure? Any unsaved changes will be lost.')) {
            reportModal.remove();
        }
    });

    // Main action button
    document.getElementById('modal-action-btn').addEventListener('click', () => {
        const reportData = collectReportData(student, currentMonthYear);
        const isSingleApproved = document.getElementById('modal-action-btn').getAttribute('data-is-single') === 'true';
        
        reportModal.remove();
        
        if (isSingleApproved) {
            showFeeConfirmationModal(student, reportData);
        } else {
            saveReportDraft(student, reportData);
        }
    });
}

// Helper function to collect report data
function collectReportData(student, currentMonthYear) {
    return {
        studentId: student.id,
        studentName: student.studentName,
        grade: student.grade,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        normalizedParentPhone: normalizePhoneNumber(student.parentPhone),
        reportMonth: currentMonthYear,
        introduction: document.getElementById('report-intro')?.value || '',
        topics: document.getElementById('report-topics')?.value || '',
        progress: document.getElementById('report-progress')?.value || '',
        strengthsWeaknesses: document.getElementById('report-sw')?.value || '',
        recommendations: document.getElementById('report-recs')?.value || '',
        generalComments: document.getElementById('report-general')?.value || '',
        collectedAt: new Date().toISOString()
    };
}

// Helper function to save report draft
async function saveReportDraft(student, reportData) {
    savedReports[student.id] = reportData;
    
    try {
        await saveReportsToFirestore(window.tutorData.email, savedReports);
        showCustomAlert(`${student.studentName}'s report has been saved.`, 'success');
        
        // Refresh the student database view
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            renderStudentDatabase(mainContent, window.tutorData);
        }
    } catch (error) {
        console.error("Error saving report:", error);
        showCustomAlert('Error saving report. Please try again.', 'error');
    }
}

// STEP 2: Fee Confirmation Modal (Redesigned)
function showFeeConfirmationModal(student, reportData) {
    const feeConfirmationHTML = `
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div class="workflow-modal-container">
                <div class="workflow-header">
                    <h3>Confirm Monthly Fee</h3>
                    <div class="subtitle">Verify the fee for ${student.studentName}</div>
                </div>
                
                <div class="workflow-content">
                    <div class="fee-card">
                        <div class="fee-header">
                            <div class="fee-icon">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm12 2a1 1 0 100 2 1 1 0 000-2z" clip-rule="evenodd" />
                                </svg>
                            </div>
                            <div>
                                <div class="fee-title">Fee Verification Required</div>
                                <div class="fee-description">
                                    Please verify the monthly fee before proceeding. You can make corrections if needed.
                                </div>
                            </div>
                        </div>
                        
                        <div class="student-info-panel mt-4">
                            <div class="info-card">
                                <div class="info-label">Student</div>
                                <div class="info-value">${student.studentName}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">Current Fee</div>
                                <div class="info-value">₦${(student.studentFee || 0).toLocaleString()}</div>
                            </div>
                            <div class="info-card">
                                <div class="info-label">Status</div>
                                <div class="info-value">
                                    ${student.isTransitioning ? 'Transitioning Student' : 'Regular Student'}
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-group mt-4">
                            <label class="form-label">Update Monthly Fee (₦)</label>
                            <div class="flex items-center space-x-2">
                                <span class="text-gray-500">₦</span>
                                <input type="number" id="confirm-student-fee" class="form-input flex-1" 
                                       value="${student.studentFee || 0}" 
                                       placeholder="Enter new fee amount"
                                       min="0"
                                       step="1000">
                            </div>
                            <div class="text-xs text-gray-500 mt-1">
                                Enter the correct monthly fee for this student. This will update the student's record.
                            </div>
                        </div>
                    </div>
                    
                    ${!student.isTransitioning ? `
                    <div class="alert alert-info mt-4">
                        <strong>Note:</strong> For transitioning students, the report fields are automatically filled.
                        Regular students require complete monthly reports.
                    </div>
                    ` : ''}
                </div>
                
                <div class="workflow-footer">
                    <button id="cancel-fee-confirm-btn" class="btn btn-outline">Back</button>
                    <button id="confirm-fee-btn" class="btn btn-primary">Confirm Fee & Continue</button>
                </div>
            </div>
        </div>
    `;

    const feeModal = document.createElement('div');
    feeModal.innerHTML = feeConfirmationHTML;
    document.body.appendChild(feeModal);

    // Validate fee input
    const feeInput = document.getElementById('confirm-student-fee');
    feeInput.addEventListener('input', function() {
        const value = parseFloat(this.value);
        if (value < 0 || isNaN(value)) {
            this.classList.add('border-red-500');
        } else {
            this.classList.remove('border-red-500');
        }
    });

    // Cancel/Back button
    document.getElementById('cancel-fee-confirm-btn').addEventListener('click', () => {
        feeModal.remove();
        if (!student.isTransitioning) {
            showReportModal(student);
        }
    });

    // Confirm button
    document.getElementById('confirm-fee-btn').addEventListener('click', async () => {
        const newFeeValue = feeInput.value.trim();
        const newFee = parseFloat(newFeeValue);

        if (isNaN(newFee) || newFee < 0) {
            showCustomAlert('Please enter a valid, non-negative fee amount.', 'warning');
            return;
        }

        // Update fee if changed
        if (newFee !== student.studentFee) {
            try {
                const studentRef = doc(db, student.collection, student.id);
                await updateDoc(studentRef, { studentFee: newFee });
                student.studentFee = newFee;
                showCustomAlert('Student fee updated successfully!', 'success');
            } catch (error) {
                console.error("Error updating student fee:", error);
                showCustomAlert(`Failed to update fee: ${error.message}`, 'error');
                return;
            }
        }

        feeModal.remove();
        
        // Determine next step
        const isSingleApprovedStudent = approvedStudents.filter(s => !s.summerBreak && !submittedStudentIds.has(s.id)).length === 1;
        
        if (isSingleApprovedStudent) {
            showAccountDetailsModal([reportData]);
        } else {
            saveReportDraft(student, reportData);
        }
    });
}

// STEP 3: Account Details Modal (Redesigned)
function showAccountDetailsModal(reportsArray) {
    const accountFormHTML = `
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
            <div class="workflow-modal-container">
                <div class="workflow-header">
                    <h3>Payment Details</h3>
                    <div class="subtitle">Enter your bank account information for payment processing</div>
                </div>
                
                <div class="workflow-content">
                    <div class="alert alert-warning">
                        <strong>Important:</strong> Payment will be processed using these details. Please ensure they are accurate.
                    </div>
                    
                    <div class="payment-grid">
                        <div class="form-group">
                            <label class="form-label">Beneficiary Bank Name</label>
                            <input type="text" id="beneficiary-bank" class="form-input" 
                                   placeholder="e.g., Zenith Bank, Access Bank, GTBank">
                            <div class="text-xs text-gray-500 mt-1">
                                Enter the full name of your bank
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Beneficiary Account Number</label>
                            <input type="text" id="beneficiary-account" class="form-input" 
                                   placeholder="Your 10-digit account number"
                                   maxlength="10">
                            <div class="text-xs text-gray-500 mt-1">
                                Must be exactly 10 digits
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label class="form-label">Beneficiary Name</label>
                            <input type="text" id="beneficiary-name" class="form-input" 
                                   placeholder="Your full name as on the account">
                            <div class="text-xs text-gray-500 mt-1">
                                Must match the name on your bank account
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-6 p-4 bg-gray-50 rounded-lg">
                        <h4 class="font-semibold text-gray-700 mb-2">Submission Summary</h4>
                        <div class="space-y-2 text-sm">
                            <div class="flex justify-between">
                                <span class="text-gray-600">Number of Reports:</span>
                                <span class="font-semibold">${reportsArray.length}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">Total Students:</span>
                                <span class="font-semibold">${new Set(reportsArray.map(r => r.studentId)).size}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">Status:</span>
                                <span class="font-semibold text-green-600">Ready to Submit</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="workflow-footer">
                    <button id="cancel-account-btn" class="btn btn-outline">Cancel</button>
                    <button id="confirm-submit-btn" class="btn btn-success">
                        <span class="loading-spinner hidden"></span>
                        Confirm & Submit ${reportsArray.length > 1 ? 'All Reports' : 'Report'}
                    </button>
                </div>
            </div>
        </div>
    `;

    const accountModal = document.createElement('div');
    accountModal.innerHTML = accountFormHTML;
    document.body.appendChild(accountModal);

    // Form validation
    const bankInput = document.getElementById('beneficiary-bank');
    const accountInput = document.getElementById('beneficiary-account');
    const nameInput = document.getElementById('beneficiary-name');

    function validateForm() {
        let isValid = true;
        
        if (!bankInput.value.trim()) {
            bankInput.classList.add('border-red-500');
            isValid = false;
        } else {
            bankInput.classList.remove('border-red-500');
        }
        
        if (!/^\d{10}$/.test(accountInput.value.trim())) {
            accountInput.classList.add('border-red-500');
            isValid = false;
        } else {
            accountInput.classList.remove('border-red-500');
        }
        
        if (!nameInput.value.trim()) {
            nameInput.classList.add('border-red-500');
            isValid = false;
        } else {
            nameInput.classList.remove('border-red-500');
        }
        
        return isValid;
    }

    // Real-time validation
    [bankInput, accountInput, nameInput].forEach(input => {
        input.addEventListener('input', function() {
            if (this.value.trim()) {
                this.classList.remove('border-red-500');
            }
        });
    });

    accountInput.addEventListener('input', function() {
        if (/^\d{10}$/.test(this.value.trim())) {
            this.classList.remove('border-red-500');
        }
    });

    // Cancel button
    document.getElementById('cancel-account-btn').addEventListener('click', () => {
        accountModal.remove();
    });

    // Submit button
    document.getElementById('confirm-submit-btn').addEventListener('click', async () => {
        if (!validateForm()) {
            showCustomAlert('Please fill in all bank details correctly.', 'warning');
            return;
        }

        const accountDetails = {
            beneficiaryBank: bankInput.value.trim(),
            beneficiaryAccount: accountInput.value.trim(),
            beneficiaryName: nameInput.value.trim(),
        };

        // Show loading state
        const submitBtn = document.getElementById('confirm-submit-btn');
        const spinner = submitBtn.querySelector('.loading-spinner');
        submitBtn.disabled = true;
        spinner.classList.remove('hidden');

        try {
            await submitAllReports(reportsArray, accountDetails);
            accountModal.remove();
            showCustomAlert(`Successfully submitted ${reportsArray.length} report(s)!`, 'success');
        } catch (error) {
            console.error("Error submitting reports:", error);
            submitBtn.disabled = false;
            spinner.classList.add('hidden');
            showCustomAlert(`Error: ${error.message}`, 'error');
        }
    });
}

// STEP 4: Submit All Reports (Updated)
async function submitAllReports(reportsArray, accountDetails) {
    if (reportsArray.length === 0) {
        showCustomAlert("No reports to submit.", 'warning');
        return;
    }

    const batch = writeBatch(db);
    const tutor = window.tutorData;
    
    reportsArray.forEach(report => {
        const newReportRef = doc(collection(db, "tutor_submissions"));
        
        const finalReportData = {
            tutorEmail: tutor.email,
            tutorName: tutor.name,
            submittedAt: new Date(),
            status: "submitted",
            ...report,
            ...accountDetails,
            // Ensure normalized phone is included
            normalizedParentPhone: report.normalizedParentPhone || normalizePhoneNumber(report.parentPhone)
        };
        
        batch.set(newReportRef, finalReportData);
    });

    try {
        await batch.commit();
        // Clear saved reports
        await clearAllReportsFromFirestore(tutor.email);
        
        // Refresh the student database view
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            renderStudentDatabase(mainContent, tutor);
        }
        
        return true;
    } catch (error) {
        console.error("Error submitting reports:", error);
        throw error;
    }
}

// Updated renderStudentDatabase function with the new workflow
async function renderStudentDatabase(container, tutor) {
    if (!container) {
        console.error("Container element not found.");
        return;
    }

    // Load reports from Firestore
    savedReports = await loadReportsFromFirestore(tutor.email);

    // Fetch students and all of the tutor's historical submissions
    // Filter out archived, graduated, and transferred students
    const studentQuery = query(collection(db, "students"), where("tutorEmail", "==", tutor.email));
    const pendingStudentQuery = query(collection(db, "pending_students"), where("tutorEmail", "==", tutor.email));
    
    const allSubmissionsQuery = query(collection(db, "tutor_submissions"), where("tutorEmail", "==", tutor.email));

    const [studentsSnapshot, pendingStudentsSnapshot, allSubmissionsSnapshot] = await Promise.all([
        getDocs(studentQuery),
        getDocs(pendingStudentQuery),
        getDocs(allSubmissionsQuery)
    ]);

    // Filter out archived, graduated, and transferred students on client side
    approvedStudents = studentsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), isPending: false, collection: "students" }))
        .filter(student => {
            // Only show active or approved students, exclude archived/graduated/transferred
            return !student.status || 
                   student.status === 'active' || 
                   student.status === 'approved' || 
                   !['archived', 'graduated', 'transferred'].includes(student.status);
        });

    // Now, filter the submissions for the current month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    submittedStudentIds = new Set();

    allSubmissionsSnapshot.forEach(doc => {
        const submissionData = doc.data();
        const submissionDate = submissionData.submittedAt?.toDate?.() || new Date();
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
                    const transitioningIndicator = isTransitioning ? `<span class="transitioning-badge">Transitioning</span>` : '';
                    
                    statusHTML = `<span class="status-indicator ${isReportSaved ? 'text-green-600 font-semibold' : 'text-gray-500'}">${isReportSaved ? 'Report Saved' : 'Pending Report'}</span>${transitioningIndicator}`;

                    if (isSummerBreakEnabled && !isStudentOnBreak) {
                        actionsHTML += `<button class="summer-break-btn bg-yellow-500 text-white px-3 py-1 rounded text-sm" data-student-id="${student.id}">Break</button>`;
                    } else if (isStudentOnBreak) {
                        actionsHTML += `<span class="text-gray-400">On Break</span>`;
                    }

                    if (isSubmissionEnabled && !isStudentOnBreak) {
                        if (approvedStudents.length === 1) {
                            actionsHTML += `<button class="submit-single-report-btn bg-green-600 text-white px-3 py-1 rounded text-sm" data-student-id="${student.id}" data-is-transitioning="${isTransitioning}">Submit Report</button>`;
                        } else {
                            actionsHTML += `<button class="enter-report-btn bg-green-600 text-white px-3 py-1 rounded text-sm" data-student-id="${student.id}" data-is-transitioning="${isTransitioning}">${isReportSaved ? 'Edit Report' : 'Enter Report'}</button>`;
                        }
                    } else if (!isStudentOnBreak) {
                        actionsHTML += `<span class="text-gray-400">Submission Disabled</span>`;
                    }
                    
                    if (showEditDeleteButtons && !isStudentOnBreak) {
                        actionsHTML += `<button class="edit-student-btn-tutor bg-blue-500 text-white px-3 py-1 rounded text-sm" data-student-id="${student.id}" data-collection="${student.collection}">Edit</button>`;
                        actionsHTML += `<button class="delete-student-btn-tutor bg-red-500 text-white px-3 py-1 rounded text-sm" data-student-id="${student.id}" data-collection="${student.collection}">Delete</button>`;
                    }
                }
                
                studentsHTML += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="font-medium">${student.studentName}</div>
                            <div class="text-xs text-gray-500">${cleanGradeString(student.grade)}</div>
                            <div class="text-xs text-gray-500">Subjects: ${subjects}</div>
                            <div class="text-xs text-gray-500">Days: ${days}</div>
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
                                Submit All Reports (${Object.keys(savedReports).length}/${submittableStudents})
                            </button>
                        </div>`;
                }
            }
        }
        container.innerHTML = `<div id="student-list-view" class="bg-white p-6 rounded-lg shadow-md">${studentsHTML}</div>`;
        attachEventListeners();
    }

    // Function to show confirmation for adding transitioning student
    function showTransitioningConfirmation() {
        const confirmationHTML = `
            <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
                <div class="workflow-modal-container">
                    <div class="workflow-header">
                        <h3 class="text-orange-600">Add Transitioning Student</h3>
                        <div class="subtitle">Skip monthly report writing for this student</div>
                    </div>
                    <div class="workflow-content">
                        <div class="alert alert-warning">
                            <strong>Please confirm:</strong> Transitioning students skip monthly report writing and go directly to fee confirmation. 
                            They will be marked with orange indicators and their fees will be included in pay advice.
                        </div>
                        <p class="text-sm text-orange-600 font-semibold mb-4">
                            Are you sure you want to add a transitioning student?
                        </p>
                    </div>
                    <div class="workflow-footer">
                        <button id="cancel-transitioning-btn" class="btn btn-outline">Cancel</button>
                        <button id="confirm-transitioning-btn" class="btn btn-primary">Yes, Add Transitioning</button>
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
            showCustomAlert('Please fill in all parent and student details correctly, including at least one subject.', 'warning');
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
                showCustomAlert('Transitioning student added successfully!', 'success');
            } else {
                await addDoc(collection(db, "pending_students"), studentData);
                showCustomAlert('Transitioning student added and is pending approval.', 'info');
            }
            renderStudentDatabase(container, tutor);
        } catch (error) {
            console.error("Error adding transitioning student:", error);
            showCustomAlert(`An error occurred: ${error.message}`, 'error');
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
                    showCustomAlert('Please fill in all parent and student details correctly, including at least one subject.', 'warning');
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
                        showCustomAlert('Student added successfully!', 'success');
                    } else {
                        await addDoc(collection(db, "pending_students"), studentData);
                        showCustomAlert('Student added and is pending approval.', 'info');
                    }
                    renderStudentDatabase(container, tutor);
                } catch (error) {
                    console.error("Error adding student:", error);
                    showCustomAlert(`An error occurred: ${error.message}`, 'error');
                }
            });
        }

        // Updated event listeners for report buttons
        document.querySelectorAll('.enter-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                if (student) {
                    showReportModal(student);
                }
            });
        });

        document.querySelectorAll('.submit-single-report-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                if (student) {
                    showReportModal(student);
                }
            });
        });

        document.querySelectorAll('.summer-break-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                
                if (confirm(`Are you sure you want to put ${student.studentName} on Break?`)) {
                    const studentRef = doc(db, "students", studentId);
                    await updateDoc(studentRef, { summerBreak: true });
                    showCustomAlert(`${student.studentName} has been marked as on Break.`, 'success');
                    renderStudentDatabase(container, tutor);
                }
            });
        });

        const submitAllBtn = document.getElementById('submit-all-reports-btn');
        if (submitAllBtn && !submitAllBtn.disabled) {
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
                    showCustomAlert("Please enter a valid fee amount.", 'warning');
                    return;
                }
                const tutorRef = doc(db, "tutors", tutor.id);
                await updateDoc(tutorRef, { managementFee: newFee });
                showCustomAlert("Management fee updated successfully.", 'success');
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
                        showCustomAlert('Student deleted successfully!', 'success');
                        renderStudentDatabase(container, tutor);
                    } catch (error) {
                        console.error("Error deleting student:", error);
                        showCustomAlert(`An error occurred: ${error.message}`, 'error');
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
    // # SECTION 4: AUTO-REGISTERED STUDENTS NAVIGATION
    // ##################################################################
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
    // Filter out archived students
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
                showEditStudentModal(student);
            }
        });
    });
}
