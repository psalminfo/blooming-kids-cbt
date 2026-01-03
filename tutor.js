[file name]: tutor (3).js
[file content begin]
import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, getDoc, where, query, addDoc, writeBatch, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// --- Enhanced CSS for modern UI ---
const style = document.createElement('style');
style.textContent = `
    /* Modern UI Styles */
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
    }

    /* Enhanced Button Styles */
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

    /* Card Styles */
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

    /* Table Styles */
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

    /* Form Styles */
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
        padding: 0.625rem;
        border: 1px solid var(--border-color);
        border-radius: var(--radius);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .form-input:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }

    .form-textarea {
        min-height: 100px;
        resize: vertical;
    }

    /* Modal Enhancements */
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
        max-width: 32rem;
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

    /* Loading Spinner */
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

    /* Hero Section */
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

    /* Dashboard Grid */
    .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
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
        background-color: var(--primary-color);
    }

    .status-dot-warning {
        background-color: var(--warning-color);
    }

    .status-dot-danger {
        background-color: var(--danger-color);
    }

    /* Action Buttons Container */
    .action-buttons {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    /* Add Transitioning Button Styling */
    #add-transitioning-btn {
        display: block !important;
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
        color: white !important;
        padding: 0.625rem 1.25rem !important;
        border-radius: var(--radius) !important;
        border: none !important;
        cursor: pointer !important;
        margin: 0.25rem !important;
        font-weight: 500 !important;
        transition: all 0.2s ease !important;
        box-shadow: var(--shadow) !important;
    }

    #add-transitioning-btn:hover {
        transform: translateY(-2px) !important;
        box-shadow: var(--shadow-lg) !important;
        background: linear-gradient(135deg, #d97706 0%, #b45309 100%) !important;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
        .hero-section {
            padding: 1.5rem;
        }
        
        .hero-title {
            font-size: 1.5rem;
        }
        
        .dashboard-grid {
            grid-template-columns: 1fr;
        }
        
        .action-buttons {
            flex-direction: column;
        }
        
        .action-buttons .btn {
            width: 100%;
        }
    }
`;
document.head.appendChild(style);

// --- Global state to hold report submission status ---
let isSubmissionEnabled = false;
let isTutorAddEnabled = false;
let isSummerBreakEnabled = false;
let isBypassApprovalEnabled = false;
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

// --- NEW: Schedule Days and Times ---
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIME_SLOTS = Array.from({length: 48}, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return {
        value: `${hour.toString().padStart(2, '0')}:${minute}`,
        label: `${displayHour}:${minute} ${period}`
    };
});

// --- Phone Number Normalization Function ---
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

// --- NEW: Schedule Management Functions ---
async function checkAndShowSchedulePopup(tutor) {
    try {
        const studentsQuery = query(
            collection(db, "students"), 
            where("tutorEmail", "==", tutor.email)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        const studentsWithoutSchedule = [];
        studentsSnapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            if (!student.schedule || student.schedule.length === 0) {
                studentsWithoutSchedule.push(student);
            }
        });
        
        if (studentsWithoutSchedule.length > 0) {
            const student = studentsWithoutSchedule[0];
            showSchedulePopup(student, tutor, studentsWithoutSchedule.length);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error("Error checking schedules:", error);
        return false;
    }
}

function showSchedulePopup(student, tutor, remainingCount = 0) {
    const popupHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">📅 Set Class Schedule for ${student.studentName}</h3>
                    ${remainingCount > 1 ? `<span class="badge badge-info">${remainingCount-1} more to setup</span>` : ''}
                </div>
                <div class="modal-body">
                    <p class="text-sm text-gray-600 mb-4">Please set the weekly class schedule for this student. You can add multiple time slots.</p>
                    
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
                                        ${TIME_SLOTS.map(slot => `<option value="${slot.value}">${slot.label}</option>`).join('')}
                                    </select>
                                </div>
                                <div>
                                    <label class="form-label">End Time</label>
                                    <select class="form-input schedule-end">
                                        ${TIME_SLOTS.map(slot => `<option value="${slot.value}">${slot.label}</option>`).join('')}
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
                    <button id="skip-schedule-btn" class="btn btn-secondary">Skip for Now</button>
                    <button id="save-schedule-btn" class="btn btn-primary" data-student-id="${student.id}">
                        Save Schedule
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const popup = document.createElement('div');
    popup.innerHTML = popupHTML;
    document.body.appendChild(popup);
    
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
        
        scheduleEntries.forEach(entry => {
            const day = entry.querySelector('.schedule-day').value;
            const start = entry.querySelector('.schedule-start').value;
            const end = entry.querySelector('.schedule-end').value;
            
            if (start >= end) {
                showCustomAlert('End time must be after start time.');
                return;
            }
            
            schedule.push({ day, start, end });
        });
        
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
                tutorEmail: tutor.email,
                tutorName: tutor.name,
                schedule: schedule,
                createdAt: new Date()
            });
            
            popup.remove();
            showCustomAlert('✅ Schedule saved successfully!');
            
            setTimeout(() => {
                checkAndShowSchedulePopup(tutor);
            }, 1000);
            
        } catch (error) {
            console.error("Error saving schedule:", error);
            showCustomAlert('❌ Error saving schedule. Please try again.');
        }
    });
    
    document.getElementById('skip-schedule-btn').addEventListener('click', () => {
        popup.remove();
        setTimeout(() => {
            checkAndShowSchedulePopup(tutor);
        }, 500);
    });
}

// --- NEW: Daily Topic Functions ---
function showDailyTopicModal(student) {
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">📚 Today's Topic for ${student.studentName}</h3>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Topic Title *</label>
                        <input type="text" id="topic-title" class="form-input" placeholder="e.g., Introduction to Fractions" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Topic Description *</label>
                        <textarea id="topic-description" class="form-input form-textarea" placeholder="Describe what was covered in today's class..." required></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Key Learning Points</label>
                        <textarea id="topic-key-points" class="form-input form-textarea" placeholder="List key points learned (one per line)..."></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Homework Assigned (if any)</label>
                        <textarea id="topic-homework" class="form-input" placeholder="Optional: Homework assigned for today"></textarea>
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
            tutorEmail: window.tutorData.email,
            tutorName: window.tutorData.name,
            title: document.getElementById('topic-title').value.trim(),
            description: document.getElementById('topic-description').value.trim(),
            keyPoints: document.getElementById('topic-key-points').value.split('\n').filter(point => point.trim()),
            homework: document.getElementById('topic-homework').value.trim(),
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date()
        };
        
        if (!topicData.title || !topicData.description) {
            showCustomAlert('Please fill in all required fields (title and description).');
            return;
        }
        
        try {
            const topicRef = doc(collection(db, "daily_topics"));
            await setDoc(topicRef, topicData);
            modal.remove();
            showCustomAlert('✅ Today\'s topic saved successfully! Parents can now view this in their portal.');
        } catch (error) {
            console.error("Error saving topic:", error);
            showCustomAlert('❌ Error saving topic. Please try again.');
        }
    });
}

// --- NEW: Homework Assignment Functions ---
function showHomeworkModal(student) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const maxDate = nextWeek.toISOString().split('T')[0];
    
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
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
                        <textarea id="hw-description" class="form-input form-textarea" placeholder="Detailed instructions for the homework..." required></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Due Date *</label>
                        <input type="date" id="hw-due-date" class="form-input" min="${new Date().toISOString().split('T')[0]}" max="${maxDate}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Upload File (Optional)</label>
                        <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                            <input type="file" id="hw-file" class="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png">
                            <label for="hw-file" class="cursor-pointer">
                                <div class="text-gray-500 mb-2">
                                    <svg class="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                                    </svg>
                                </div>
                                <span class="text-sm font-medium text-primary-color">Click to upload</span>
                                <span class="text-xs text-gray-500 block">PDF, DOC, JPG, PNG (Max 10MB)</span>
                            </label>
                            <div id="file-name" class="mt-2 text-sm text-gray-600 hidden"></div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="flex items-center">
                            <input type="checkbox" id="hw-reminder" class="rounded">
                            <span class="ml-2 text-sm">Send reminder to parent 1 day before due date</span>
                        </label>
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
    const fileName = document.getElementById('file-name');
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.size > 10 * 1024 * 1024) {
                showCustomAlert('File size must be less than 10MB.');
                fileInput.value = '';
                fileName.classList.add('hidden');
                return;
            }
            fileName.textContent = `Selected: ${file.name}`;
            fileName.classList.remove('hidden');
        }
    });
    
    document.getElementById('cancel-hw-btn').addEventListener('click', () => modal.remove());
    document.getElementById('save-hw-btn').addEventListener('click', async () => {
        const hwData = {
            studentId: student.id,
            studentName: student.studentName,
            parentPhone: student.parentPhone,
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
            const hwRef = doc(collection(db, "homework_assignments"));
            await setDoc(hwRef, hwData);
            
            modal.remove();
            showCustomAlert('✅ Homework assigned successfully! Parents will be notified.');
        } catch (error) {
            console.error("Error assigning homework:", error);
            showCustomAlert('❌ Error assigning homework. Please try again.');
        }
    });
}

// --- NEW: View Schedule Functions ---
function showStudentScheduleModal(student) {
    if (!student.schedule || student.schedule.length === 0) {
        showCustomAlert('No schedule set for this student. Please set schedule first.');
        return;
    }
    
    const modalHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">📅 Schedule for ${student.studentName}</h3>
                    <button id="print-schedule-btn" class="btn btn-secondary btn-sm">📄 Print/PDF</button>
                </div>
                <div class="modal-body">
                    <div class="bg-gray-50 p-4 rounded-lg mb-4">
                        <h4 class="font-semibold mb-2">Weekly Class Schedule</h4>
                        <div class="space-y-2">
                            ${student.schedule.map(slot => `
                                <div class="flex items-center justify-between bg-white p-3 rounded border">
                                    <div>
                                        <span class="font-medium">${slot.day}</span>
                                        <span class="text-gray-500 ml-2">${formatTime(slot.start)} - ${formatTime(slot.end)}</span>
                                    </div>
                                    <span class="badge badge-success">Active</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Add Note to Schedule</label>
                        <textarea id="schedule-note" class="form-input form-textarea" placeholder="Add any notes about the schedule..."></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="close-schedule-btn" class="btn btn-secondary">Close</button>
                    <button id="update-schedule-btn" class="btn btn-primary" data-student-id="${student.id}">
                        Update Schedule
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal);
    
    document.getElementById('print-schedule-btn').addEventListener('click', () => {
        const scheduleContent = `
            <h2>Schedule for ${student.studentName}</h2>
            <p>Grade: ${student.grade}</p>
            <p>Tutor: ${window.tutorData.name}</p>
            <h3>Weekly Class Schedule:</h3>
            <ul>
                ${student.schedule.map(slot => 
                    `<li>${slot.day}: ${formatTime(slot.start)} - ${formatTime(slot.end)}</li>`
                ).join('')}
            </ul>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
        `;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Schedule - ${student.studentName}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h2 { color: #333; }
                        ul { list-style: none; padding: 0; }
                        li { margin: 10px 0; padding: 10px; background: #f5f5f5; }
                    </style>
                </head>
                <body>
                    ${scheduleContent}
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(() => window.close(), 1000);
                        }
                    </script>
                </body>
            </html>
        `);
    });
    
    document.getElementById('close-schedule-btn').addEventListener('click', () => modal.remove());
    document.getElementById('update-schedule-btn').addEventListener('click', async () => {
        modal.remove();
        showCustomAlert('Schedule note saved.');
    });
}

function formatTime(timeString) {
    const [hour, minute] = timeString.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

// --- Firestore Functions for Report Persistence ---
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

// --- Local Storage Functions ---
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

// --- TIN Functions ---
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

// Listen for changes to admin settings
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
        if (mainContent.querySelector('#student-list-view')) {
            renderStudentDatabase(mainContent, window.tutorData);
        }
    }
});

// ##################################################################
// # ENHANCED TUTOR DASHBOARD
// ##################################################################
function renderTutorDashboard(container, tutor) {
    container.innerHTML = `
        <div class="hero-section">
            <h1 class="hero-title">Welcome, ${tutor.name || 'Tutor'}! 👋</h1>
            <p class="hero-subtitle">Manage your students, submit reports, and track progress</p>
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

    document.getElementById('toggle-graded-btn').addEventListener('click', () => {
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

    document.getElementById('searchBtn').addEventListener('click', async () => {
        const name = document.getElementById('searchName').value.trim();
        const status = document.getElementById('filterStatus').value;
        await loadTutorReports(tutor.email, name || null, status || null);
    });

    loadTutorReports(tutor.email);
}

async function loadTutorReports(tutorEmail, parentName = null, statusFilter = null) {
    const pendingReportsContainer = document.getElementById('pendingReportsContainer');
    const gradedReportsContainer = document.getElementById('gradedReportsContainer');
    
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

        document.getElementById('pending-count').textContent = `${pendingCount} Pending`;
        
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

// ##################################################################
// # ENHANCED STUDENT DATABASE
// ##################################################################
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

function cleanGradeString(grade) {
    if (grade && grade.toLowerCase().includes("grade")) {
        return grade;
    } else {
        return `Grade ${grade}`;
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
            renderStudentDatabase(mainContent, window.tutorData);
        } catch (error) {
            console.error("Error updating student:", error);
            showCustomAlert(`❌ An error occurred: ${error.message}`);
        }
    });
}

async function renderStudentDatabase(container, tutor) {
    if (!container) {
        console.error("Container element not found.");
        return;
    }

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

    const approvedStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPending: false, collection: "students" }));
    const pendingStudents = pendingStudentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPending: true, collection: "pending_students" }));

    let students = [...approvedStudents, ...pendingStudents];

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
        let studentsHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">📚 My Students (${studentsCount})</h2>
                <button id="view-schedule-summary" class="btn btn-secondary">
                    📅 View Schedule Summary
                </button>
            </div>
        `;
        
        studentsHTML += `
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
            studentsHTML += `<button id="add-student-btn" class="btn btn-primary">➕ Add Student</button>`;
        }
        
        studentsHTML += `<button id="add-transitioning-btn" class="btn btn-warning">🔄 Add Transitioning</button>`;
        
        studentsHTML += `</div></div></div>`;
        
        studentsHTML += `
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
            studentsHTML += `
                <div class="card">
                    <div class="card-body text-center">
                        <div class="text-gray-400 text-4xl mb-3">👤</div>
                        <h4 class="font-bold text-gray-600 mb-2">No Students Assigned</h4>
                        <p class="text-gray-500">You are not assigned to any students yet.</p>
                    </div>
                </div>
            `;
        } else {
            studentsHTML += `
                <div class="table-container">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Student Name</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
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
                    
                    // NEW: Add action buttons for schedule, daily topic, and homework
                    if (!student.isPending && !isStudentOnBreak) {
                        actionsHTML += `
                            <button class="btn btn-info btn-sm view-schedule-btn" data-student-id="${student.id}">📅 Schedule</button>
                            <button class="btn btn-secondary btn-sm daily-topic-btn" data-student-id="${student.id}">📚 Today's Topic</button>
                            <button class="btn btn-warning btn-sm homework-btn" data-student-id="${student.id}">📝 Assign HW</button>
                        `;
                    }
                    
                    if (showEditDeleteButtons && !isStudentOnBreak) {
                        actionsHTML += `
                            <button class="btn btn-info btn-sm edit-student-btn-tutor" data-student-id="${student.id}" data-collection="${student.collection}">✏️ Edit</button>
                            <button class="btn btn-danger btn-sm delete-student-btn-tutor" data-student-id="${student.id}" data-collection="${student.collection}">🗑️ Delete</button>
                        `;
                    }
                    
                    actionsHTML += `</div>`;
                }
                
                studentsHTML += `
                    <tr>
                        <td>
                            <div class="font-medium">${student.studentName}</div>
                            <div class="text-sm text-gray-500">${cleanGradeString(student.grade)}</div>
                            <div class="text-xs text-gray-400">Subjects: ${subjects}</div>
                            <div class="text-xs text-gray-400">Days: ${days}</div>
                            ${feeDisplay}
                        </td>
                        <td>${statusHTML}</td>
                        <td>${actionsHTML}</td>
                    </tr>`;
            });

            studentsHTML += `</tbody></table></div>`;
            
            if (tutor.isManagementStaff) {
                studentsHTML += `
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
                    studentsHTML += `
                        <div class="mt-6 text-right">
                            <button id="submit-all-reports-btn" class="btn btn-primary ${!allReportsSaved ? 'opacity-50 cursor-not-allowed' : ''}" ${!allReportsSaved ? 'disabled' : ''}>
                                📤 Submit All Reports (${submittableStudents})
                            </button>
                        </div>`;
                }
            }
        }
        container.innerHTML = `<div id="student-list-view" class="bg-white p-6 rounded-lg">${studentsHTML}</div>`;
        attachEventListeners();
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
                    <textarea id="report-intro" class="form-input form-textarea" rows="2">${existingReport.introduction || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Topics & Remarks</label>
                    <textarea id="report-topics" class="form-input form-textarea" rows="3">${existingReport.topics || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Progress & Achievements</label>
                    <textarea id="report-progress" class="form-input form-textarea" rows="2">${existingReport.progress || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Strengths & Weaknesses</label>
                    <textarea id="report-sw" class="form-input form-textarea" rows="2">${existingReport.strengthsWeaknesses || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Recommendations</label>
                    <textarea id="report-recs" class="form-input form-textarea" rows="2">${existingReport.recommendations || ''}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">General Comments</label>
                    <textarea id="report-general" class="form-input form-textarea" rows="2">${existingReport.generalComments || ''}</textarea>
                </div>
                <div class="modal-footer">
                    <button id="cancel-report-btn" class="btn btn-secondary">Cancel</button>
                    <button id="modal-action-btn" class="btn btn-primary">${isSingleApprovedStudent ? 'Proceed to Submit' : 'Save Report'}</button>
                </div>
            </div>`;
        
        const reportModal = document.createElement('div');
        reportModal.className = 'modal-overlay';
        reportModal.innerHTML = `<div class="modal-content max-w-2xl">${reportFormHTML}</div>`;
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
        feeModal.innerHTML = `<div class="modal-content">${feeConfirmationHTML}</div>`;
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
                renderUI(); 
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
        accountModal.innerHTML = `<div class="modal-content">${accountFormHTML}</div>`;
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
                tutorEmail: tutor.email,
                tutorName: tutor.name,
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
            await clearAllReportsFromFirestore(tutor.email);
            showCustomAlert(`✅ Successfully submitted ${reportsArray.length} report(s)!`);
            await renderStudentDatabase(container, tutor);
        } catch (error) {
            console.error("Error submitting reports:", error);
            showCustomAlert(`❌ Error: ${error.message}`);
        }
    }

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
            renderStudentDatabase(container, tutor);
        } catch (error) {
            console.error("Error adding transitioning student:", error);
            showCustomAlert(`❌ An error occurred: ${error.message}`);
        }
    }

    function attachEventListeners() {
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

        const transitioningBtn = document.getElementById('add-transitioning-btn');
        if (transitioningBtn) {
            transitioningBtn.addEventListener('click', () => {
                showTransitioningConfirmation();
            });
        }

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
                    renderStudentDatabase(container, tutor);
                } catch (error) {
                    console.error("Error adding student:", error);
                    showCustomAlert(`❌ An error occurred: ${error.message}`);
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
                
                if (confirm(`Are you sure you want to put ${student.studentName} on Break?`)) {
                    const studentRef = doc(db, "students", studentId);
                    await updateDoc(studentRef, { summerBreak: true });
                    showCustomAlert(`✅ ${student.studentName} has been marked as on Break.`);
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
                    showCustomAlert("❌ Please enter a valid fee amount.");
                    return;
                }
                const tutorRef = doc(db, "tutors", tutor.id);
                await updateDoc(tutorRef, { managementFee: newFee });
                showCustomAlert("✅ Management fee updated successfully.");
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
                        showCustomAlert('✅ Student deleted successfully!');
                        renderStudentDatabase(container, tutor);
                    } catch (error) {
                        console.error("Error deleting student:", error);
                        showCustomAlert(`❌ An error occurred: ${error.message}`);
                    }
                }
            });
        });

        // NEW: Attach event listeners for new functionality
        document.querySelectorAll('.view-schedule-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                if (student) {
                    showStudentScheduleModal(student);
                }
            });
        });

        document.querySelectorAll('.daily-topic-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                if (student) {
                    showDailyTopicModal(student);
                }
            });
        });

        document.querySelectorAll('.homework-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const studentId = btn.getAttribute('data-student-id');
                const student = students.find(s => s.id === studentId);
                if (student) {
                    showHomeworkModal(student);
                }
            });
        });

        // View schedule summary button
        const viewScheduleBtn = document.getElementById('view-schedule-summary');
        if (viewScheduleBtn) {
            viewScheduleBtn.addEventListener('click', () => {
                showScheduleSummaryModal(students);
            });
        }
    }

    // NEW: Schedule Summary Modal
    function showScheduleSummaryModal(students) {
        const studentsWithSchedule = students.filter(s => s.schedule && s.schedule.length > 0);
        
        if (studentsWithSchedule.length === 0) {
            showCustomAlert('No students have schedules set up yet.');
            return;
        }
        
        let scheduleByDay = {};
        DAYS_OF_WEEK.forEach(day => {
            scheduleByDay[day] = [];
        });
        
        studentsWithSchedule.forEach(student => {
            student.schedule.forEach(slot => {
                scheduleByDay[slot.day].push({
                    student: student.studentName,
                    grade: student.grade,
                    time: `${formatTime(slot.start)} - ${formatTime(slot.end)}`
                });
            });
        });
        
        const modalHTML = `
            <div class="modal-overlay">
                <div class="modal-content max-w-4xl">
                    <div class="modal-header">
                        <h3 class="modal-title">📅 Weekly Schedule Summary</h3>
                        <button id="print-full-schedule-btn" class="btn btn-secondary btn-sm">📄 Print/PDF</button>
                    </div>
                    <div class="modal-body">
                        <p class="text-sm text-gray-600 mb-4">Showing schedules for ${studentsWithSchedule.length} student(s)</p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            ${DAYS_OF_WEEK.map(day => {
                                const daySchedule = scheduleByDay[day];
                                if (daySchedule.length === 0) return '';
                                
                                return `
                                    <div class="bg-gray-50 p-4 rounded-lg">
                                        <h4 class="font-bold text-lg mb-3">${day}</h4>
                                        <div class="space-y-2">
                                            ${daySchedule.map(item => `
                                                <div class="bg-white p-3 rounded border">
                                                    <div class="font-medium">${item.student}</div>
                                                    <div class="text-sm text-gray-500">${item.grade} • ${item.time}</div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="close-schedule-summary-btn" class="btn btn-secondary">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        const modal = document.createElement('div');
        modal.innerHTML = modalHTML;
        document.body.appendChild(modal);
        
        document.getElementById('print-full-schedule-btn').addEventListener('click', () => {
            let printContent = `
                <h2>Weekly Schedule Summary</h2>
                <p>Generated on: ${new Date().toLocaleDateString()}</p>
                <p>Tutor: ${window.tutorData.name}</p>
                <hr>
            `;
            
            DAYS_OF_WEEK.forEach(day => {
                const daySchedule = scheduleByDay[day];
                if (daySchedule.length > 0) {
                    printContent += `<h3>${day}</h3>`;
                    printContent += '<ul>';
                    daySchedule.forEach(item => {
                        printContent += `<li><strong>${item.student}</strong> (${item.grade}) - ${item.time}</li>`;
                    });
                    printContent += '</ul>';
                }
            });
            
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Weekly Schedule Summary</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            h2 { color: #333; }
                            h3 { color: #666; margin-top: 20px; }
                            ul { list-style: none; padding: 0; }
                            li { margin: 8px 0; padding: 8px; background: #f5f5f5; }
                        </style>
                    </head>
                    <body>
                        ${printContent}
                        <script>
                            window.onload = function() {
                                window.print();
                                setTimeout(() => window.close(), 1000);
                            }
                        </script>
                    </body>
                </html>
            `);
        });
        
        document.getElementById('close-schedule-summary-btn').addEventListener('click', () => {
            modal.remove();
        });
    }

    renderUI();
}

// ##################################################################
// # MAIN APP INITIALIZATION
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
                
                console.log("Tutor data loaded:", tutorData); // Debug log
                
                if (shouldShowEmploymentPopup(tutorData)) {
                    showEmploymentDatePopup(tutorData);
                }
                
                if (shouldShowTINPopup(tutorData)) {
                    showTINPopup(tutorData);
                }
                
                renderTutorDashboard(document.getElementById('mainContent'), tutorData);
                
                // Check for schedule setup after a short delay
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

    document.getElementById('logoutBtn').addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'tutor-auth.html';
        }).catch(error => {
            console.error("Error signing out:", error);
            showCustomAlert('❌ Error signing out. Please try again.');
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

    document.getElementById('navAutoStudents').addEventListener('click', () => {
        if (window.tutorData) {
            renderAutoRegisteredStudents(document.getElementById('mainContent'), window.tutorData);
        }
    });
});

// ##################################################################
// # AUTO-REGISTERED STUDENTS FUNCTIONS
// ##################################################################
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
            ...studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), collection: "students" })),
            ...pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), collection: "pending_students" }))
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
[file content end]
