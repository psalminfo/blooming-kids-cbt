// ==============================================
// ENROLLMENT PORTAL - MAIN APPLICATION
// ==============================================

// CONFIGURATION - UPDATED WITH CORRECT FEES FROM IMAGES
const CONFIG = {
    // Firebase Configuration - Will be set from window.firebaseConfig
    FIREBASE_CONFIG: null, // Will be set in constructor
    
    // Academic Subjects
    ACADEMIC_SUBJECTS: [
        "Math",
        "Language Arts", 
        "Geography",
        "Science",
        "Biology",
        "Physics",
        "Chemistry",
        "Microbiology"
    ],
    
    // Extracurricular Activities - Updated with ratePerSession
    EXTRACURRICULAR_FEES: [
        { id: 'comic', name: 'COMIC BOOK DESIGN', fee: 35000, ratePerSession: 35000 },
        { id: 'graphics', name: 'GRAPHICS DESIGNING', fee: 35000, ratePerSession: 35000 },
        { id: 'ai', name: 'GENERATIVE AI', fee: 40000, ratePerSession: 40000 },
        { id: 'youtube', name: 'YOUTUBE FOR KIDS', fee: 40000, ratePerSession: 40000 },
        { id: 'animation', name: 'STOP MOTION ANIMATION', fee: 35000, ratePerSession: 35000 },
        { id: 'videography', name: 'VIDEOGRAPHY', fee: 40000, ratePerSession: 40000 },
        { id: 'music', name: 'KIDS MUSIC LESSON', fee: 45000, ratePerSession: 45000 },
        { id: 'coding', name: 'CODING CLASSES FOR KIDS', fee: 45000, ratePerSession: 45000 },
        { id: 'sketch', name: 'SMART SKETCH', fee: 45000, ratePerSession: 45000 },
        { id: 'foreign', name: 'FOREIGN LANGUAGE', fee: 55000, ratePerSession: 55000 },
        { id: 'global_discovery', name: 'GLOBAL DISCOVERY CLUB', fee: 50000, ratePerSession: 50000 },
        { id: 'native', name: 'NATIVE LANGUAGE', fee: 30000, ratePerSession: 30000 },
        { id: 'speaking', name: 'PUBLIC SPEAKING', fee: 35000, ratePerSession: 35000 },
        { id: 'bible', name: 'BIBLE STUDY', fee: 35000, ratePerSession: 35000 },
        { id: 'chess', name: 'CHESS CLASS', fee: 40000, ratePerSession: 40000 }
    ],
    
    // Test Preparation - Per hour rate
    TEST_PREP_FEES: [
        { id: 'sat', name: 'SAT', rate: 20000 },
        { id: 'igcse', name: 'IGCSE & GCSE', rate: 20000 },
        { id: '11plus', name: '11+ Exam Prep', rate: 15000 }
    ],
    
    // UPDATED: Academic Fee Structure based on the images you provided
    ACADEMIC_FEES: {
        // Preschool to Grade 1
        'preschool': {
            'twice': 80000,
            'three': 95000,
            'five': 150000
        },
        // Grade 2 to 4
        'grade2-4': {
            'twice': 95000,
            'three': 110000,
            'five': 170000
        },
        // Grade 5 to 8
        'grade5-8': {
            'twice': 105000,
            'three': 120000,
            'five': 180000
        },
        // Grade 9 to 12
        'grade9-12': {
            'twice': 110000,
            'three': 135000,
            'five': 200000
        }
    },
    
    // Constants - UPDATED: 1st of month = full fee always
    CONSTANTS: {
        ADDITIONAL_SUBJECT_FEE: 40000,
        SIBLING_DISCOUNT: 10000,
        BASE_SUBJECTS_INCLUDED: 2,
        REFERRAL_BONUS: 5000,
        WEEKS_PER_MONTH: 4,
        PRORATION_START_DAY: 7, // Proration starts from 7th of month (1-6 = full fee)
        MINIMUM_SESSION_HOURS: 1,
        MAXIMUM_SESSION_HOURS: 8
    },
    
    // Days and Time Options
    DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    HOURS: Array.from({length: 24}, (_, i) => i)
};

// ==============================================
// ENROLLMENT APPLICATION CLASS
// ==============================================
class EnrollmentApp {
    constructor(firebaseConfig) {
        // Set the loaded Firebase config
        CONFIG.FIREBASE_CONFIG = firebaseConfig;
        
        this.studentCount = 0;
        this.currentApplicationId = null;
        this.referralValidated = false;
        this.referrerData = null;
        this.db = null;
        this.appData = null;
        this.isLoadingSavedData = false;
        this.isSaving = false;
        
        this.initializeState();
    }
    
    // Helper to escape HTML and prevent XSS
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async initializeState() {
        await this.initializeFirebase();
        this.setupEventListeners();
        await this.checkResumeLink();
    }
    
    async initializeFirebase() {
        try {
            const firebaseConfig = CONFIG.FIREBASE_CONFIG;
            
            // Only initialize if we have valid config
            if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY_HERE') {
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                
                this.db = firebase.firestore();
                return true;
            } else {
                console.log('Using local storage mode - Firebase config not available');
                return false;
            }
            
        } catch (error) {
            console.log('Firebase offline mode - using local storage');
            return false;
        }
    }
    
    setupEventListeners() {
        // Add student
        document.getElementById('add-student').addEventListener('click', () => this.addStudent());
        
        // Save progress
        document.getElementById('save-progress-btn').addEventListener('click', () => {
            this.saveProgress();
        });
        
        // Submit enrollment - attach only once
        document.getElementById('submit-enrollment').addEventListener('click', (e) => {
            e.preventDefault();
            this.submitEnrollment();
        });
    }
    
    // ==============================================
    // STUDENT MANAGEMENT
    // ==============================================
    
    addStudent(prefillData = null) {
        this.studentCount++;
        const studentId = this.studentCount;
        
        const newStudent = document.createElement('div');
        newStudent.className = 'student-entry';
        newStudent.setAttribute('data-student-id', studentId);
        newStudent.setAttribute('data-student-index', studentId - 1);
        
        // Set default start date (1st of next month)
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        const defaultStartDate = nextMonth.toISOString().split('T')[0];
        
        // Escape user-provided values for safe HTML insertion
        const safeName = prefillData?.name ? this.escapeHtml(prefillData.name) : '';
        const safeDob = prefillData?.dob ? this.escapeHtml(prefillData.dob) : '';
        
        // Generate HTML (with escaped values)
        const courseSelectionHTML = this.generateCourseSelectionHTML(studentId);
        
        newStudent.innerHTML = `
            <div class="student-header">
                <div class="student-number">${studentId}</div>
                <button type="button" class="remove-student">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Student Full Name <span class="required">*</span></label>
                    <input type="text" class="form-control student-name" placeholder="Student Name" data-validate="required" value="${safeName}">
                    <div class="error-message student-name-error"></div>
                </div>
                <div class="form-group">
                    <label>Gender <span class="required">*</span></label>
                    <select class="form-control select student-gender" data-validate="required">
                        <option value="">Select Gender</option>
                        <option value="male" ${prefillData?.gender === 'male' ? 'selected' : ''}>Male</option>
                        <option value="female" ${prefillData?.gender === 'female' ? 'selected' : ''}>Female</option>
                        <option value="other" ${prefillData?.gender === 'other' ? 'selected' : ''}>Other</option>
                        <option value="prefer-not-to-say" ${prefillData?.gender === 'prefer-not-to-say' ? 'selected' : ''}>Prefer not to say</option>
                    </select>
                    <div class="error-message student-gender-error"></div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Date of Birth <span class="required">*</span></label>
                    <input type="date" class="form-control student-dob" data-validate="required" value="${safeDob}">
                    <div class="error-message student-dob-error"></div>
                </div>
                <div class="form-group">
                    <label>School Grade <span class="required">*</span></label>
                    <select class="form-control select student-grade" data-validate="required">
                        <option value="">Select Grade</option>
                        <option value="preschool" ${prefillData?.grade === 'preschool' ? 'selected' : ''}>Preschool to Grade 1</option>
                        <option value="grade2-4" ${prefillData?.grade === 'grade2-4' ? 'selected' : ''}>Grade 2 to 4</option>
                        <option value="grade5-8" ${prefillData?.grade === 'grade5-8' ? 'selected' : ''}>Grade 5 to 8</option>
                        <option value="grade9-12" ${prefillData?.grade === 'grade9-12' ? 'selected' : ''}>Grade 9 to 12</option>
                    </select>
                    <div class="error-message student-grade-error"></div>
                </div>
                <div class="form-group">
                    <label>Actual Grade <span class="required">*</span></label>
                    <select class="form-control select student-actual-grade" data-validate="required">
                        <option value="">Select Actual Grade</option>
                        <option value="preschool" ${prefillData?.actualGrade === 'preschool' ? 'selected' : ''}>Preschool</option>
                        <option value="kindergarten" ${prefillData?.actualGrade === 'kindergarten' ? 'selected' : ''}>Kindergarten</option>
                        <option value="grade1" ${prefillData?.actualGrade === 'grade1' ? 'selected' : ''}>Grade 1</option>
                        <option value="grade2" ${prefillData?.actualGrade === 'grade2' ? 'selected' : ''}>Grade 2</option>
                        <option value="grade3" ${prefillData?.actualGrade === 'grade3' ? 'selected' : ''}>Grade 3</option>
                        <option value="grade4" ${prefillData?.actualGrade === 'grade4' ? 'selected' : ''}>Grade 4</option>
                        <option value="grade5" ${prefillData?.actualGrade === 'grade5' ? 'selected' : ''}>Grade 5</option>
                        <option value="grade6" ${prefillData?.actualGrade === 'grade6' ? 'selected' : ''}>Grade 6</option>
                        <option value="grade7" ${prefillData?.actualGrade === 'grade7' ? 'selected' : ''}>Grade 7</option>
                        <option value="grade8" ${prefillData?.actualGrade === 'grade8' ? 'selected' : ''}>Grade 8</option>
                        <option value="grade9" ${prefillData?.actualGrade === 'grade9' ? 'selected' : ''}>Grade 9</option>
                        <option value="grade10" ${prefillData?.actualGrade === 'grade10' ? 'selected' : ''}>Grade 10</option>
                        <option value="grade11" ${prefillData?.actualGrade === 'grade11' ? 'selected' : ''}>Grade 11</option>
                        <option value="grade12" ${prefillData?.actualGrade === 'grade12' ? 'selected' : ''}>Grade 12</option>
                    </select>
                    <div class="error-message student-actual-grade-error"></div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Preferred Start Date <span class="required">*</span></label>
                    <input type="date" class="form-control student-start-date" min="${new Date().toISOString().split('T')[0]}" data-validate="required" value="${prefillData?.startDate || defaultStartDate}">
                    <div class="error-message student-start-date-error"></div>
                </div>
            </div>
            
            <!-- Preferred Tutor Selection -->
            <div class="form-group">
                <label>Preferred Tutor <span class="required">*</span></label>
                <div class="tutor-selection">
                    <div class="tutor-option" data-tutor="male">
                        <i class="fas fa-male"></i> Male Tutor
                    </div>
                    <div class="tutor-option" data-tutor="female">
                        <i class="fas fa-female"></i> Female Tutor
                    </div>
                    <div class="tutor-option" data-tutor="no-preference">
                        <i class="fas fa-user-check"></i> No Preference
                    </div>
                </div>
                <div class="error-message student-tutor-error"></div>
            </div>

            <div class="course-selection-container">
                <div class="course-tabs">
                    <button class="course-tab active" data-tab="academic-${studentId}">
                        <i class="fas fa-graduation-cap"></i> Academic
                    </button>
                    <button class="course-tab" data-tab="extracurricular-${studentId}">
                        <i class="fas fa-palette"></i> Extracurricular
                    </button>
                    <button class="course-tab" data-tab="test-prep-${studentId}">
                        <i class="fas fa-chart-line"></i> Test Prep
                    </button>
                </div>
                
                <!-- Course Requirement Alert -->
                <div class="course-requirement-alert hidden" id="course-requirement-alert-${studentId}">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Please select at least one option from Academic, Extracurricular, or Test Preparation</span>
                </div>
                
                ${courseSelectionHTML}
            </div>
        `;
        
        document.getElementById('students-container').appendChild(newStudent);
        
        // Attach Event Listeners for this specific student
        this.attachStudentEventListeners(newStudent, studentId);
        
        // Pre-fill selections if data exists
        if (prefillData && prefillData.selectedSubjects) {
            // Use requestAnimationFrame to ensure DOM is ready, then preload
            requestAnimationFrame(() => {
                this.preloadStudentSelections(newStudent, prefillData);
                this.checkCourseSelectionRequirement(studentId);
            });
        }
        
        this.updateRemoveButtons();
        this.updateSummary();
    }
    
    /**
     * Preload saved selections into a student div.
     * @param {HTMLElement} studentDiv - The student entry container.
     * @param {Object} data - The saved student data.
     */
    preloadStudentSelections(studentDiv, data) {
        if (!data) return;

        const studentId = studentDiv.dataset.studentId; // Get the student ID

        // Pre-select preferred tutor
        if (data.preferredTutor) {
            const tutorOption = studentDiv.querySelector(`.tutor-option[data-tutor="${data.preferredTutor}"]`);
            if (tutorOption) {
                tutorOption.classList.add('selected');
            }
        }

        // Pre-select academic sessions
        if (data.academicSessions) {
            const sessionOption = studentDiv.querySelector(`.session-option[data-sessions="${data.academicSessions}"]`);
            if (sessionOption) {
                sessionOption.classList.add('selected');
            }
        }

        // Pre-select academic subjects
        if (data.selectedSubjects && data.selectedSubjects.length > 0) {
            data.selectedSubjects.forEach(subject => {
                const option = studentDiv.querySelector(`.subject-option[data-subject="${subject}"]`);
                if (option) {
                    option.classList.add('selected');
                }
            });
        }

        // Pre-select academic days
        if (data.academicDays && data.academicDays.length > 0) {
            data.academicDays.forEach(day => {
                const dayBtn = studentDiv.querySelector(`.academic-day-btn[data-day="${day}"]`);
                if (dayBtn) dayBtn.classList.add('selected');
            });
        }

        // Pre-select academic time (using student-specific IDs)
        if (data.academicTime) {
            const [startHour, endHour] = data.academicTime.split(':');
            const startSelect = studentDiv.querySelector(`#academic-start-hour-${studentId}`);
            const endSelect = studentDiv.querySelector(`#academic-end-hour-${studentId}`);
            if (startSelect) startSelect.value = startHour;
            if (endSelect) endSelect.value = endHour;
        }

        // Pre-select extracurricular activities
        if (data.extracurriculars && data.extracurriculars.length > 0) {
            data.extracurriculars.forEach(activity => {
                const card = studentDiv.querySelector(`.extracurricular-card[data-activity-id="${activity.id}"]`);
                if (card) {
                    card.classList.add('selected');
                    // Set frequency
                    if (activity.frequency) {
                        const freqBtn = card.querySelector(`.frequency-btn[data-frequency="${activity.frequency}"]`);
                        if (freqBtn) freqBtn.classList.add('selected');
                    } else {
                        // Default to once if not specified
                        const onceBtn = card.querySelector('[data-frequency="once"]');
                        if (onceBtn) onceBtn.classList.add('selected');
                    }
                    // Set days
                    if (activity.days && activity.days.length > 0) {
                        activity.days.forEach(day => {
                            const dayBtn = card.querySelector(`.extracurricular-day-btn[data-day="${day}"]`);
                            if (dayBtn) dayBtn.classList.add('selected');
                        });
                    }
                    // Set time (using student and activity IDs)
                    if (activity.time) {
                        const [startHour, endHour] = activity.time.split(':');
                        const startSelect = studentDiv.querySelector(`#extracurricular-start-hour-${studentId}-${activity.id}`);
                        const endSelect = studentDiv.querySelector(`#extracurricular-end-hour-${studentId}-${activity.id}`);
                        if (startSelect) startSelect.value = startHour;
                        if (endSelect) endSelect.value = endHour;
                    }
                }
            });
        }

        // Pre-load test prep
        if (data.testPrep && data.testPrep.length > 0) {
            data.testPrep.forEach(test => {
                const card = studentDiv.querySelector(`.test-prep-card[data-test-id="${test.id}"]`);
                if (card) {
                    const input = card.querySelector('.test-prep-hours');
                    if (input && test.hours > 0) {
                        input.value = test.hours;
                        card.classList.add('active');
                    }
                    // Set days
                    if (test.days && test.days.length > 0) {
                        test.days.forEach(day => {
                            const dayBtn = card.querySelector(`.test-prep-day-btn[data-day="${day}"]`);
                            if (dayBtn) dayBtn.classList.add('selected');
                        });
                    }
                    // Set time (using student and test IDs)
                    if (test.time) {
                        const [startHour, endHour] = test.time.split(':');
                        const startSelect = studentDiv.querySelector(`#test-prep-start-hour-${studentId}-${test.id}`);
                        const endSelect = studentDiv.querySelector(`#test-prep-end-hour-${studentId}-${test.id}`);
                        if (startSelect) startSelect.value = startHour;
                        if (endSelect) endSelect.value = endHour;
                    }
                }
            });
        }
    }

    generateCourseSelectionHTML(id) {
        // Generate hour options for select dropdowns (hour only, no minutes)
        const hourOptions = CONFIG.HOURS.map(hour => {
            const hour12 = hour % 12 || 12;
            const ampm = hour < 12 ? 'AM' : 'PM';
            return `<option value="${hour.toString().padStart(2, '0')}">${hour12} ${ampm}</option>`;
        }).join('');

        // 1. Academic HTML with Sessions, Days & Time
        const academicDaysHTML = CONFIG.DAYS.map(day => `
            <button class="day-btn academic-day-btn" data-day="${day}" type="button">${day.substring(0, 3)}</button>
        `).join('');

        const academicHTML = `
            <div id="academic-${id}" class="tab-content active">
                <div class="course-selection">
                    <!-- Academic Sessions Selection -->
                    <div class="academic-sessions">
                        <div class="session-option" data-sessions="twice">
                            Twice Weekly
                            <span class="session-price" id="twice-price-${id}">₦0</span>
                        </div>
                        <div class="session-option" data-sessions="three">
                            3 Times Weekly
                            <span class="session-price" id="three-price-${id}">₦0</span>
                        </div>
                        <div class="session-option" data-sessions="five">
                            5 Times Weekly
                            <span class="session-price" id="five-price-${id}">₦0</span>
                        </div>
                    </div>
                    
                    <p class="course-note">First 2 subjects included. Additional: <strong>+₦40,000</strong></p>
                    <div class="subjects-grid">
                        ${CONFIG.ACADEMIC_SUBJECTS.map(subject => `
                            <div class="subject-option" data-subject="${subject}">
                                <div class="subject-checkbox"></div>
                                <span>${subject}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="days-time-section">
                        <h5><i class="far fa-calendar-alt"></i> Available Days <span class="required">*</span></h5>
                        <div class="available-days" data-time-section="academic" data-student-id="${id}">
                            ${academicDaysHTML}
                        </div>
                        <div class="error-message available-days-error-${id}"></div>
                        
                        <h5><i class="far fa-clock"></i> Your Country Preferred Time (12AM - 11PM) <span class="required">*</span></h5>
                        <div class="time-selection">
                            <div class="time-input-group">
                                <label>From:</label>
                                <select id="academic-start-hour-${id}" class="time-hour" data-time-section="academic" data-student-id="${id}">
                                    <option value="">Hour</option>
                                    ${hourOptions}
                                </select>
                            </div>
                            <div class="time-input-group">
                                <label>To:</label>
                                <select id="academic-end-hour-${id}" class="time-hour" data-time-section="academic" data-student-id="${id}">
                                    <option value="">Hour</option>
                                    ${hourOptions}
                                </select>
                            </div>
                        </div>
                        <div class="time-validation-error" id="academic-time-error-${id}">Please select a valid time range</div>
                    </div>
                </div>
            </div>
        `;

        // 2. Extracurricular HTML with Days & Time
        const extracurriculars = CONFIG.EXTRACURRICULAR_FEES.map(activity => {
            const isGlobalDiscovery = activity.id === 'global_discovery';
            
            let buttonsHTML;
            
            if (isGlobalDiscovery) {
                buttonsHTML = `
                    <div class="frequency-selection">
                        <button class="frequency-btn" data-frequency="once" style="width: 100%;" type="button">Every Saturday (Monthly)</button>
                    </div>
                `;
            } else {
                buttonsHTML = `
                    <div class="frequency-selection">
                        <button class="frequency-btn" data-frequency="once" type="button">Once Weekly</button>
                        <button class="frequency-btn" data-frequency="twice" type="button">Twice Weekly</button>
                    </div>
                `;
            }

            const extracurricularDaysHTML = CONFIG.DAYS.map(day => `
                <button class="day-btn extracurricular-day-btn" data-day="${day}" type="button">${day.substring(0, 3)}</button>
            `).join('');

            return `
            <div class="extracurricular-card" data-activity-id="${activity.id}" data-student-id="${id}">
                <div class="extracurricular-header">
                    <div class="extracurricular-name">${activity.name}</div>
                    <div class="extracurricular-price">₦${activity.fee.toLocaleString()}</div>
                </div>
                ${buttonsHTML}
                <div class="extracurricular-details">
                    <h5><i class="far fa-calendar-alt"></i> Select Days (Max 2) <span class="required">*</span></h5>
                    <div class="available-days">
                        ${extracurricularDaysHTML}
                    </div>
                    <div class="error-message extracurricular-days-error-${id}-${activity.id}" style="display: none;"></div>
                    
                    <h5><i class="far fa-clock"></i> Your Country Preferred Time (12AM - 11PM) <span class="required">*</span></h5>
                    <div class="time-selection">
                        <div class="time-input-group">
                            <label>From:</label>
                            <select id="extracurricular-start-hour-${id}-${activity.id}" class="time-hour" data-time-section="extracurricular" data-activity-id="${activity.id}" data-student-id="${id}">
                                <option value="">Hour</option>
                                ${hourOptions}
                            </select>
                        </div>
                        <div class="time-input-group">
                            <label>To:</label>
                            <select id="extracurricular-end-hour-${id}-${activity.id}" class="time-hour" data-time-section="extracurricular" data-activity-id="${activity.id}" data-student-id="${id}">
                                <option value="">Hour</option>
                                ${hourOptions}
                            </select>
                        </div>
                    </div>
                    <div class="time-validation-error" id="extracurricular-time-error-${id}-${activity.id}" style="display: none;">Please select a valid time range</div>
                </div>
            </div>
            `;
        }).join('');

        const extracurricularHTML = `
            <div id="extracurricular-${id}" class="tab-content">
                <div class="course-selection">
                    <p class="course-note">Select 1-2 days per week for each activity. Global Discovery is Saturdays only.</p>
                    <div class="extracurricular-grid">${extracurriculars}</div>
                </div>
            </div>
        `;

        // 3. Test Prep HTML with Days & Time
        const testPreps = CONFIG.TEST_PREP_FEES.map(test => {
            const testPrepDaysHTML = CONFIG.DAYS.map(day => `
                <button class="day-btn test-prep-day-btn" data-day="${day}" type="button">${day.substring(0, 3)}</button>
            `).join('');

            return `
            <div class="test-prep-card" data-test-id="${test.id}" data-student-id="${id}">
                <div class="test-prep-header">
                    <div class="test-prep-name">${test.name}</div>
                    <div class="test-prep-rate">₦${test.rate.toLocaleString()}/hour</div>
                </div>
                <div class="hours-input">
                    <label>Hours per session:</label>
                    <input type="number" min="0" step="0.5" value="0" class="test-prep-hours" placeholder="1">
                    <span>hrs</span>
                </div>
                <div class="days-time-section">
                    <h5><i class="far fa-calendar-alt"></i> Select Days <span class="required">*</span></h5>
                    <div class="available-days">
                        ${testPrepDaysHTML}
                    </div>
                    <div class="error-message test-prep-days-error-${id}-${test.id}" style="display: none;"></div>
                    
                    <h5><i class="far fa-clock"></i> Your Country Preferred Time (12AM - 11PM) <span class="required">*</span></h5>
                    <div class="time-selection">
                        <div class="time-input-group">
                            <label>From:</label>
                            <select id="test-prep-start-hour-${id}-${test.id}" class="time-hour" data-time-section="test-prep" data-test-id="${test.id}" data-student-id="${id}">
                                <option value="">Hour</option>
                                ${hourOptions}
                            </select>
                        </div>
                        <div class="time-input-group">
                            <label>To:</label>
                            <select id="test-prep-end-hour-${id}-${test.id}" class="time-hour" data-time-section="test-prep" data-test-id="${test.id}" data-student-id="${id}">
                                <option value="">Hour</option>
                                ${hourOptions}
                            </select>
                        </div>
                    </div>
                    <div class="time-validation-error" id="test-prep-time-error-${id}-${test.id}" style="display: none;">Please select a valid time range</div>
                </div>
            </div>
            `;
        }).join('');

        const testPrepHTML = `
            <div id="test-prep-${id}" class="tab-content">
                <div class="course-selection">
                    <p class="course-note">Fee = (Hours per session × Rate per hour × Days per week × 4 weeks)</p>
                    <div class="test-prep-options">${testPreps}</div>
                </div>
            </div>
        `;

        return academicHTML + extracurricularHTML + testPrepHTML;
    }

    attachStudentEventListeners(studentDiv, id) {
        // 1. Preferred Tutor Selection
        studentDiv.querySelectorAll('.tutor-option').forEach(option => {
            option.addEventListener('click', () => {
                studentDiv.querySelectorAll('.tutor-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.updateSummary();
                this.checkCourseSelectionRequirement(id);
            });
        });

        // 2. Tab Switching Logic
        const tabs = studentDiv.querySelectorAll('.course-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                studentDiv.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                const targetId = tab.dataset.tab;
                studentDiv.querySelector(`#${targetId}`).classList.add('active');
            });
        });

        // 3. Academic Sessions Selection
        studentDiv.querySelectorAll('.session-option').forEach(option => {
            option.addEventListener('click', () => {
                studentDiv.querySelectorAll('.session-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.updateSessionPrices(studentDiv);
                this.updateSummary();
                this.checkCourseSelectionRequirement(id);
            });
        });

        // 4. Subject Selection
        studentDiv.querySelectorAll('.subject-option').forEach(option => {
            option.addEventListener('click', () => {
                option.classList.toggle('selected');
                this.updateSummary();
                this.checkCourseSelectionRequirement(id);
            });
        });

        // 5. Academic Days & Time Selection
        studentDiv.querySelectorAll('.academic-day-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('selected');
                this.updateSummary();
                this.checkCourseSelectionRequirement(id);
            });
        });

        // Academic Time selection changes
        studentDiv.querySelectorAll(`#academic-start-hour-${id}, #academic-end-hour-${id}`).forEach(select => {
            select.addEventListener('change', () => {
                this.updateSummary();
                this.validateTimeSelection('academic', id, null);
                this.checkCourseSelectionRequirement(id);
            });
        });

        // 6. Extracurricular Selection
        studentDiv.querySelectorAll('.extracurricular-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('frequency-btn') && 
                    !e.target.classList.contains('day-btn') && 
                    !e.target.classList.contains('time-hour')) {
                    card.classList.toggle('selected');
                    // Default to once weekly if selected
                    if(card.classList.contains('selected') && !card.querySelector('.frequency-btn.selected')) {
                        const onceBtn = card.querySelector('[data-frequency="once"]');
                        if(onceBtn) onceBtn.classList.add('selected');
                    }
                    // Clear buttons if deselected
                    if (!card.classList.contains('selected')) {
                        card.querySelectorAll('.frequency-btn').forEach(b => b.classList.remove('selected'));
                        card.querySelectorAll('.day-btn').forEach(b => b.classList.remove('selected'));
                    }
                    this.updateSummary();
                    this.checkCourseSelectionRequirement(id);
                }
            });

            // Frequency Buttons
            card.querySelectorAll('.frequency-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if(!card.classList.contains('selected')) card.classList.add('selected');
                    
                    card.querySelectorAll('.frequency-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                    
                    // Handle day visibility based on frequency
                    this.handleExtracurricularFrequency(card, btn.dataset.frequency);
                    
                    this.updateSummary();
                    this.checkCourseSelectionRequirement(id);
                });
            });

            // Extracurricular Days Selection - UPDATED WITH 2-DAY LIMIT
            card.querySelectorAll('.extracurricular-day-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    const activityId = card.dataset.activityId;
                    const isGlobalDiscovery = activityId === 'global_discovery';
                    const selectedDays = card.querySelectorAll('.extracurricular-day-btn.selected');
                    
                    if (isGlobalDiscovery) {
                        // For Global Discovery, only allow Saturday
                        if (btn.dataset.day === 'Saturday') {
                            // Deselect all other days first
                            card.querySelectorAll('.extracurricular-day-btn.selected').forEach(otherBtn => {
                                otherBtn.classList.remove('selected');
                            });
                            btn.classList.add('selected');
                        }
                    } else {
                        // For regular activities: limit to 2 days maximum
                        if (btn.classList.contains('selected')) {
                            // Deselect if already selected
                            btn.classList.remove('selected');
                        } else if (selectedDays.length < 2) {
                            // Select if less than 2 days already selected
                            btn.classList.add('selected');
                        } else {
                            // Show message when trying to select more than 2 days
                            this.showAlert("Maximum 2 days per week for extracurricular activities", "warning");
                            return;
                        }
                    }
                    
                    if(!card.classList.contains('selected')) card.classList.add('selected');
                    this.updateSummary();
                    this.checkCourseSelectionRequirement(id);
                    
                    // Validate days selection
                    this.validateExtracurricularDays(card, activityId, id);
                });
            });

            // Extracurricular Time Selection
            const activityId = card.dataset.activityId;
            card.querySelectorAll(`#extracurricular-start-hour-${id}-${activityId}, #extracurricular-end-hour-${id}-${activityId}`).forEach(select => {
                select.addEventListener('change', (e) => {
                    e.stopPropagation();
                    if(!card.classList.contains('selected')) card.classList.add('selected');
                    this.updateSummary();
                    this.validateTimeSelection('extracurricular', id, activityId);
                    this.checkCourseSelectionRequirement(id);
                });
            });
        });

        // 7. Test Prep
        studentDiv.querySelectorAll('.test-prep-hours').forEach(input => {
            input.addEventListener('input', (e) => {
                const card = input.closest('.test-prep-card');
                let val = parseFloat(input.value) || 0;
                if(val > 0) card.classList.add('active');
                else card.classList.remove('active');
                this.updateSummary();
                this.checkCourseSelectionRequirement(id);
            });
        });

        // Test Prep Days Selection
        studentDiv.querySelectorAll('.test-prep-day-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const card = btn.closest('.test-prep-card');
                if(!card.classList.contains('active')) {
                    const input = card.querySelector('.test-prep-hours');
                    if(input) input.value = 1;
                    card.classList.add('active');
                }
                btn.classList.toggle('selected');
                
                // Recalculate hours based on days selected
                const selectedDays = card.querySelectorAll('.test-prep-day-btn.selected').length;
                const hoursInput = card.querySelector('.test-prep-hours');
                const currentHours = parseFloat(hoursInput.value) || 0;
                
                // If days are selected but no hours set, default to 1 hour per day
                if (selectedDays > 0 && currentHours === 0) {
                    hoursInput.value = 1;
                }
                
                this.updateSummary();
                this.checkCourseSelectionRequirement(id);
            });
        });

        // Test Prep Time Selection
        studentDiv.querySelectorAll('.test-prep-card').forEach(card => {
            const testId = card.dataset.testId;
            card.querySelectorAll(`#test-prep-start-hour-${id}-${testId}, #test-prep-end-hour-${id}-${testId}`).forEach(select => {
                select.addEventListener('change', () => {
                    const card = select.closest('.test-prep-card');
                    if(!card.classList.contains('active')) {
                        const input = card.querySelector('.test-prep-hours');
                        if(input) input.value = 1;
                        card.classList.add('active');
                    }
                    this.updateSummary();
                    this.validateTimeSelection('test-prep', id, testId);
                    this.checkCourseSelectionRequirement(id);
                });
            });
        });

        // 8. Basic Input Validation
        studentDiv.querySelectorAll('[data-validate]').forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('change', () => {
                if (!this.isLoadingSavedData) {
                    this.updateSessionPrices(studentDiv);
                    this.updateSummary();
                    this.checkCourseSelectionRequirement(id);
                }
            });
        });

        // 9. Remove Button
        const removeBtn = studentDiv.querySelector('.remove-student');
        if(removeBtn) {
            removeBtn.addEventListener('click', () => {
                if (this.studentCount > 1) {
                    studentDiv.remove();
                    this.studentCount--;
                    this.updateRemoveButtons();
                    this.updateSummary();
                }
            });
        }
    }
    
    // NEW: Check course selection requirement for a specific student
    checkCourseSelectionRequirement(studentId) {
        const studentDiv = document.querySelector(`[data-student-id="${studentId}"]`);
        if (!studentDiv) return;
        
        // Check if at least one course type is selected
        const hasAcademic = studentDiv.querySelector('.subject-option.selected') !== null;
        const hasExtracurricular = studentDiv.querySelector('.extracurricular-card.selected') !== null;
        const hasTestPrep = studentDiv.querySelector('.test-prep-card.active') !== null;
        
        const isValid = hasAcademic || hasExtracurricular || hasTestPrep;
        const alertElement = studentDiv.querySelector(`#course-requirement-alert-${studentId}`);
        
        if (alertElement) {
            if (!isValid) {
                alertElement.classList.remove('hidden');
            } else {
                alertElement.classList.add('hidden');
            }
        }
        
        return isValid;
    }
    
    // NEW: Validate all students have at least one course selected
    validateCourseSelectionRequirements() {
        let allValid = true;
        const studentEntries = document.querySelectorAll('.student-entry');
        
        studentEntries.forEach(entry => {
            const studentId = entry.dataset.studentId;
            const isValid = this.checkCourseSelectionRequirement(studentId);
            if (!isValid) {
                allValid = false;
            }
        });
        
        return allValid;
    }
    
    updateSessionPrices(studentDiv) {
        const grade = studentDiv.querySelector('.student-grade').value;
        const sessionOptions = studentDiv.querySelectorAll('.session-option');
        
        if (grade && CONFIG.ACADEMIC_FEES[grade]) {
            const fees = CONFIG.ACADEMIC_FEES[grade];
            
            sessionOptions.forEach(option => {
                const sessions = option.dataset.sessions;
                const priceElement = option.querySelector('.session-price');
                
                if (priceElement && fees[sessions]) {
                    priceElement.textContent = `₦${fees[sessions].toLocaleString()}`;
                }
            });
        }
    }
    
    handleExtracurricularFrequency(card, frequency) {
        const isGlobalDiscovery = card.dataset.activityId === 'global_discovery';
        
        if (isGlobalDiscovery) {
            // Global Discovery: Show only Saturday option
            card.querySelectorAll('.extracurricular-day-btn').forEach(btn => {
                if (btn.dataset.day === 'Saturday') {
                    btn.style.display = 'flex';
                } else {
                    btn.style.display = 'none';
                }
            });
        } else {
            // Show all days for regular activities
            card.querySelectorAll('.extracurricular-day-btn').forEach(btn => {
                btn.style.display = 'flex';
            });
            
            // Clear day selections when changing frequency
            if (frequency === 'once') {
                // For once weekly, clear any second day selection
                const selectedDays = card.querySelectorAll('.extracurricular-day-btn.selected');
                if (selectedDays.length > 1) {
                    // Keep only the first selected day
                    selectedDays.forEach((btn, index) => {
                        if (index > 0) btn.classList.remove('selected');
                    });
                }
            }
        }
    }
    
    updateRemoveButtons() {
        const buttons = document.querySelectorAll('.remove-student');
        buttons.forEach(btn => {
            if (this.studentCount > 1) btn.style.display = 'flex';
            else btn.style.display = 'none';
        });
    }

    // ==============================================
    // UPDATED FEE CALCULATION LOGIC - FIXED FOR ALL SECTIONS
    // ==============================================

    getOrdinalSuffix(n) {
        if (n > 3 && n < 21) return 'th';
        switch (n % 10) {
            case 1: return "st";
            case 2: return "nd";
            case 3: return "rd";
            default: return "th";
        }
    }

    // NEW: Calculate proration for any monthly fee
    calculateProratedMonthlyFee(actualMonthlyFee, startDate, selectedDays = []) {
        if (!startDate || actualMonthlyFee === 0) {
            return {
                toPay: actualMonthlyFee,
                deduction: 0,
                explanation: "Full month fee"
            };
        }
        
        try {
            const start = new Date(startDate);
            const dayOfMonth = start.getDate();
            
            // FIXED: 1st of ANY month = ALWAYS full fee
            if (dayOfMonth === 1) {
                return {
                    toPay: actualMonthlyFee,
                    deduction: 0,
                    dayOfMonth: dayOfMonth,
                    explanation: "Full month fee (Starting on 1st of the month)"
                };
            }
            
            // Check threshold: if starting between 2nd-6th, full fee
            if (dayOfMonth >= 2 && dayOfMonth <= 6) {
                return {
                    toPay: actualMonthlyFee,
                    deduction: 0,
                    dayOfMonth: dayOfMonth,
                    explanation: `Full month fee (Starting on ${dayOfMonth}${this.getOrdinalSuffix(dayOfMonth)})`
                };
            }
            
            // Starting from 7th onward: Calculate proration
            const year = start.getFullYear();
            const month = start.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            // Calculate days remaining from start date to end of month (inclusive)
            const daysRemainingInMonth = daysInMonth - dayOfMonth + 1;
            
            // For monthly fees without specific days per week, prorate by actual days
            const proratedAmount = Math.round((actualMonthlyFee / daysInMonth) * daysRemainingInMonth);
            const deduction = actualMonthlyFee - proratedAmount;
            
            let explanation = `Starting on ${dayOfMonth}${this.getOrdinalSuffix(dayOfMonth)}. Prorated from ₦${actualMonthlyFee.toLocaleString()} for ${daysRemainingInMonth}/${daysInMonth} days`;
            
            return {
                toPay: proratedAmount,
                deduction: deduction,
                daysInMonth: daysInMonth,
                daysRemaining: daysRemainingInMonth,
                dayOfMonth: dayOfMonth,
                explanation: explanation
            };
        } catch (error) {
            console.error('Proration calculation error:', error);
            return {
                toPay: actualMonthlyFee,
                deduction: 0,
                explanation: "Error in calculation"
            };
        }
    }

    // NEW: Calculate test prep fee with proration
    calculateTestPrepFee(hoursPerSession, ratePerHour, selectedDays, startDate) {
        if (hoursPerSession <= 0 || selectedDays.length === 0) return 0;
        
        const daysPerWeek = selectedDays.length;
        const weeklyHours = hoursPerSession * daysPerWeek;
        const monthlyHours = weeklyHours * CONFIG.CONSTANTS.WEEKS_PER_MONTH;
        const fullMonthFee = monthlyHours * ratePerHour;
        
        // Apply proration if starting mid-month
        if (startDate) {
            const proration = this.calculateProratedMonthlyFee(fullMonthFee, startDate);
            return proration.toPay;
        }
        
        return fullMonthFee;
    }

    // NEW: Calculate extracurricular fee with proration - FIXED VERSION
    calculateExtracurricularFee(activity, frequency, selectedDays, startDate) {
        if (selectedDays.length === 0) return 0;
        
        let baseFee = 0;
        
        // Global Discovery is always flat monthly fee (Saturday only)
        if (activity.id === 'global_discovery') {
            baseFee = activity.fee; // Already monthly fee
        } else {
            // For regular extracurricular activities:
            // Once weekly = Monthly fee as shown in config
            // Twice weekly = Monthly fee × 2
            
            if (frequency === 'once') {
                baseFee = activity.fee; // Monthly fee for once weekly
            } else if (frequency === 'twice') {
                baseFee = activity.fee * 2; // Double the monthly fee for twice weekly
            } else {
                baseFee = activity.fee; // Default to once weekly
            }
            
            // Note: The number of days selected (1-2) doesn't change the fee
            // It's about frequency (once or twice per week)
        }
        
        // Apply proration if starting mid-month
        if (startDate) {
            const proration = this.calculateProratedMonthlyFee(baseFee, startDate);
            return proration.toPay;
        }
        
        return baseFee;
    }

    updateSummary() {
        if (this.isLoadingSavedData) return;
        
        let academicBaseTotal = 0;
        let additionalSubjectsTotal = 0;
        let extracurricularTotal = 0;
        let testPrepTotal = 0;
        let hasAcademicSelection = false;
        let earliestStartDate = null;
        let totalActualAcademicFee = 0;
        
        const studentEntries = document.querySelectorAll('.student-entry');
        const breakdownContainer = document.getElementById('fee-details');
        breakdownContainer.innerHTML = '';
        
        if (studentEntries.length === 0) {
            breakdownContainer.innerHTML = '<p class="student-fee">No students added yet</p>';
            this.updateSummaryDisplay(0, 0, 0, 0, 0, 0, 0);
            return;
        }

        studentEntries.forEach((entry, index) => {
            let studentSubtotal = 0;
            let studentActualAcademicFee = 0;
            
            const grade = entry.querySelector('.student-grade').value;
            const startDate = entry.querySelector('.student-start-date').value;
            const name = entry.querySelector('.student-name').value || `Student ${index + 1}`;
            const safeName = this.escapeHtml(name);
            
            // Get selected academic sessions
            const selectedSession = entry.querySelector('.session-option.selected');
            const sessions = selectedSession ? selectedSession.dataset.sessions : null;
            
            // Get selected academic days for this student
            const selectedAcademicDays = Array.from(entry.querySelectorAll('.academic-day-btn.selected')).map(btn => btn.dataset.day);
            
            // Track earliest start date for proration
            if (startDate) {
                if (!earliestStartDate || new Date(startDate) < new Date(earliestStartDate)) {
                    earliestStartDate = startDate;
                }
            }
            
            // 1. Academic Calculation - WITH PRORATION
            const selectedSubjects = Array.from(entry.querySelectorAll('.subject-option.selected'));
            
            if (grade && sessions && CONFIG.ACADEMIC_FEES[grade] && CONFIG.ACADEMIC_FEES[grade][sessions] && selectedSubjects.length > 0) {
                hasAcademicSelection = true;
                const baseFee = CONFIG.ACADEMIC_FEES[grade][sessions];
                academicBaseTotal += baseFee;
                studentSubtotal += baseFee;
                studentActualAcademicFee += baseFee;
                
                const extraCount = Math.max(0, selectedSubjects.length - CONFIG.CONSTANTS.BASE_SUBJECTS_INCLUDED);
                const extraFee = extraCount * CONFIG.CONSTANTS.ADDITIONAL_SUBJECT_FEE;
                additionalSubjectsTotal += extraFee;
                studentSubtotal += extraFee;
                studentActualAcademicFee += extraFee;
                
                totalActualAcademicFee += studentActualAcademicFee;
            }
            
            // 2. Extracurricular - UPDATED WITH PRORATION (FIXED)
            entry.querySelectorAll('.extracurricular-card.selected').forEach(card => {
                const activity = CONFIG.EXTRACURRICULAR_FEES.find(a => a.id === card.dataset.activityId);
                if (activity) {
                    const selectedDays = Array.from(card.querySelectorAll('.extracurricular-day-btn.selected')).map(btn => btn.dataset.day);
                    const frequencyBtn = card.querySelector('.frequency-btn.selected');
                    const frequency = frequencyBtn ? frequencyBtn.dataset.frequency : 'once';
                    
                    // Validate days selection based on frequency
                    if (frequency === 'once' && selectedDays.length > 1) {
                        // If frequency is "once" but more than 1 day selected, use only first day
                        selectedDays.length = 1;
                    } else if (frequency === 'twice' && selectedDays.length < 2) {
                        // If frequency is "twice" but less than 2 days selected, can't calculate
                        // We'll still calculate but show warning
                        if (selectedDays.length === 0) {
                            return; // Skip if no days selected
                        }
                    }
                    
                    const fee = this.calculateExtracurricularFee(activity, frequency, selectedDays, startDate);
                    extracurricularTotal += fee;
                    studentSubtotal += fee;
                }
            });
            
            // 3. Test Prep - UPDATED WITH PRORATION
            entry.querySelectorAll('.test-prep-card.active').forEach(card => {
                const test = CONFIG.TEST_PREP_FEES.find(t => t.id === card.dataset.testId);
                const hours = parseFloat(card.querySelector('.test-prep-hours').value) || 0;
                
                if (test && hours > 0) {
                    const selectedDays = Array.from(card.querySelectorAll('.test-prep-day-btn.selected')).map(btn => btn.dataset.day);
                    
                    if (selectedDays.length > 0) {
                        const fee = this.calculateTestPrepFee(hours, test.rate, selectedDays, startDate);
                        testPrepTotal += fee;
                        studentSubtotal += fee;
                    }
                }
            });

            // Add to breakdown list (safe name)
            const breakdownItem = document.createElement('div');
            breakdownItem.className = 'student-fee';
            breakdownItem.innerHTML = `
                <div>
                    <strong>${safeName}</strong><br>
                    <small style="color: #666;">Grade: ${grade || 'None'} | Sessions: ${sessions || 'None'}</small>
                </div>
                <div style="text-align: right;">
                    <div>₦${studentSubtotal.toLocaleString()}</div>
                    <small style="color: #28A745;">Subtotal</small>
                </div>
            `;
            breakdownContainer.appendChild(breakdownItem);
        });
        
        // Calculate totals
        const totalAcademicFee = academicBaseTotal + additionalSubjectsTotal;
        
        let discount = 0;
        if (studentEntries.length >= 2 && hasAcademicSelection) {
            discount = CONFIG.CONSTANTS.SIBLING_DISCOUNT;
        }
        
        let proratedAmountToPay = totalAcademicFee;
        let prorationDeduction = 0;
        let prorationExplanation = '';
        
        // Apply proration to academic fees if applicable
        if (hasAcademicSelection && earliestStartDate && totalActualAcademicFee > 0) {
            const prorationResult = this.calculateProratedMonthlyFee(
                totalActualAcademicFee, 
                earliestStartDate
            );
            
            proratedAmountToPay = prorationResult.toPay || 0;
            prorationDeduction = prorationResult.deduction || 0;
            
            if (prorationResult.explanation) {
                prorationExplanation = prorationResult.explanation;
            }
        }
        
        // CORRECTED: Total payable calculation (proration already applied to individual fees)
        const totalPayable = Math.max(0, 
            proratedAmountToPay + // Use prorated amount for academic
            extracurricularTotal + // Already prorated
            testPrepTotal - // Already prorated
            discount
        );
        
        // Update DOM
        this.updateSummaryDisplay(
            academicBaseTotal,
            additionalSubjectsTotal,
            totalAcademicFee,
            extracurricularTotal,
            testPrepTotal,
            discount,
            prorationDeduction,
            totalPayable,
            prorationExplanation
        );
    }
    
    updateSummaryDisplay(academicBaseTotal, additionalSubjectsTotal, totalAcademicFee, 
                       extracurricularTotal, testPrepTotal, discount, 
                       proratedDeduction, totalPayable = 0, prorationExplanation = '') {
        
        // Ensure all values are numbers
        academicBaseTotal = Number(academicBaseTotal) || 0;
        additionalSubjectsTotal = Number(additionalSubjectsTotal) || 0;
        totalAcademicFee = Number(totalAcademicFee) || 0;
        extracurricularTotal = Number(extracurricularTotal) || 0;
        testPrepTotal = Number(testPrepTotal) || 0;
        discount = Number(discount) || 0;
        proratedDeduction = Number(proratedDeduction) || 0;
        totalPayable = Number(totalPayable) || 0;
        
        document.getElementById('academic-base-fee').textContent = `₦${academicBaseTotal.toLocaleString()}`;
        document.getElementById('additional-subjects-fee').textContent = `+₦${additionalSubjectsTotal.toLocaleString()}`;
        document.getElementById('total-academic-fee').textContent = `₦${totalAcademicFee.toLocaleString()}`;
        
        document.getElementById('extracurricular-fee').textContent = `+₦${extracurricularTotal.toLocaleString()}`;
        document.getElementById('total-extracurricular-fee').textContent = `₦${extracurricularTotal.toLocaleString()}`;
        
        document.getElementById('test-prep-fee').textContent = `+₦${testPrepTotal.toLocaleString()}`;
        document.getElementById('total-test-prep-fee').textContent = `₦${testPrepTotal.toLocaleString()}`;
        
        document.getElementById('prorated-amount').textContent = proratedDeduction > 0 ? `-₦${proratedDeduction.toLocaleString()}` : `-₦0`;
        document.getElementById('discount-amount').textContent = discount > 0 ? `-₦${discount.toLocaleString()}` : `-₦0`;
        
        if (prorationExplanation) {
            document.getElementById('proration-explanation').textContent = prorationExplanation;
        } else {
            document.getElementById('proration-explanation').textContent = '';
        }
        
        document.getElementById('total-fee').textContent = `₦${Math.round(totalPayable).toLocaleString()}`;
    }

    // ==============================================
    // VALIDATION - FIXED VERSION
    // ==============================================
    
    validateField(input) {
        if (!input) return true;
        
        const rules = input.getAttribute('data-validate');
        if (!rules) return true;
        
        const value = input.value ? input.value.trim() : '';
        const ruleList = rules.split(',');
        let isValid = true;
        let errorMessage = '';
        
        for (const rule of ruleList) {
            if (rule === 'required' && !value) {
                isValid = false;
                errorMessage = 'Required field';
                break;
            }
            if (rule === 'email') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (value && !emailRegex.test(value)) {
                    isValid = false;
                    errorMessage = 'Invalid email address';
                    break;
                }
            }
            if (rule === 'phone') {
                const phoneRegex = /^[0-9\s\-\(\)]{7,}$/;
                if (value && !phoneRegex.test(value)) {
                    isValid = false;
                    errorMessage = 'Invalid phone number';
                    break;
                }
            }
        }
        
        const errorElement = input.parentElement?.querySelector('.error-message') || 
                            document.getElementById(`${input.id}-error`);
        
        if (errorElement) {
            if (isValid) {
                errorElement.classList.remove('show');
                if (input.classList) {
                    input.classList.remove('error');
                    input.classList.add('valid');
                }
            } else {
                errorElement.textContent = errorMessage;
                errorElement.classList.add('show');
                if (input.classList) {
                    input.classList.add('error');
                    input.classList.remove('valid');
                }
            }
        }
        return isValid;
    }
    
    validateTimeSelection(section, studentId, itemId = null) {
        let isValid = true;
        
        if (section === 'academic') {
            const startHour = document.getElementById(`academic-start-hour-${studentId}`).value;
            const endHour = document.getElementById(`academic-end-hour-${studentId}`).value;
            
            const errorElement = document.getElementById(`academic-time-error-${studentId}`);
            
            if (!startHour || !endHour) {
                isValid = false;
                if (errorElement) errorElement.classList.add('show');
            } else {
                // Check if end time is after start time
                const startTime = parseInt(startHour);
                const endTime = parseInt(endHour);
                
                if (endTime <= startTime) {
                    isValid = false;
                    if (errorElement) {
                        errorElement.textContent = 'End time must be after start time';
                        errorElement.classList.add('show');
                    }
                } else {
                    if (errorElement) errorElement.classList.remove('show');
                }
            }
        } 
        else if (section === 'extracurricular' && itemId) {
            const startHour = document.getElementById(`extracurricular-start-hour-${studentId}-${itemId}`).value;
            const endHour = document.getElementById(`extracurricular-end-hour-${studentId}-${itemId}`).value;
            
            const errorElement = document.getElementById(`extracurricular-time-error-${studentId}-${itemId}`);
            const card = document.querySelector(`.extracurricular-card[data-activity-id="${itemId}"][data-student-id="${studentId}"]`);
            
            if (card && card.classList.contains('selected')) {
                if (!startHour || !endHour) {
                    isValid = false;
                    if (errorElement) {
                        errorElement.textContent = 'Please select a valid time range';
                        errorElement.classList.add('show');
                    }
                } else {
                    // Check if end time is after start time
                    const startTime = parseInt(startHour);
                    const endTime = parseInt(endHour);
                    
                    if (endTime <= startTime) {
                        isValid = false;
                        if (errorElement) {
                            errorElement.textContent = 'End time must be after start time';
                            errorElement.classList.add('show');
                        }
                    } else {
                        if (errorElement) errorElement.classList.remove('show');
                    }
                }
            } else {
                if (errorElement) errorElement.classList.remove('show');
            }
        }
        else if (section === 'test-prep' && itemId) {
            const startHour = document.getElementById(`test-prep-start-hour-${studentId}-${itemId}`).value;
            const endHour = document.getElementById(`test-prep-end-hour-${studentId}-${itemId}`).value;
            
            const errorElement = document.getElementById(`test-prep-time-error-${studentId}-${itemId}`);
            const card = document.querySelector(`.test-prep-card[data-test-id="${itemId}"][data-student-id="${studentId}"]`);
            
            if (card && card.classList.contains('active')) {
                if (!startHour || !endHour) {
                    isValid = false;
                    if (errorElement) {
                        errorElement.textContent = 'Please select a valid time range';
                        errorElement.classList.add('show');
                    }
                } else {
                    // Check if end time is after start time
                    const startTime = parseInt(startHour);
                    const endTime = parseInt(endHour);
                    
                    if (endTime <= startTime) {
                        isValid = false;
                        if (errorElement) {
                            errorElement.textContent = 'End time must be after start time';
                            errorElement.classList.add('show');
                        }
                    } else {
                        if (errorElement) errorElement.classList.remove('show');
                    }
                }
            } else {
                if (errorElement) errorElement.classList.remove('show');
            }
        }
        
        return isValid;
    }
    
    validateExtracurricularDays(card, activityId, studentId) {
        const selectedDays = card.querySelectorAll('.extracurricular-day-btn.selected');
        const errorElement = document.getElementById(`extracurricular-days-error-${studentId}-${activityId}`);
        
        if (card.classList.contains('selected') && selectedDays.length === 0) {
            if (errorElement) {
                errorElement.textContent = 'Please select at least one day';
                errorElement.style.display = 'block';
            }
            return false;
        } else {
            if (errorElement) errorElement.style.display = 'none';
            return true;
        }
    }
    
    // UPDATED: Validate form with course selection requirement
    validateForm() {
        let allValid = true;
        
        // Validate basic form fields
        document.querySelectorAll('[data-validate]').forEach(input => {
            if (!this.validateField(input)) allValid = false;
        });
        
        // Validate course selection requirement for all students
        if (!this.validateCourseSelectionRequirements()) {
            this.showAlert("Each student must select at least one option from Academic, Extracurricular, or Test Preparation.", "danger");
            allValid = false;
        }
        
        // Validate student selections
        const studentEntries = document.querySelectorAll('.student-entry');
        studentEntries.forEach((entry, index) => {
            const studentId = index + 1;
            
            // Validate academic time if academic subjects are selected
            const selectedSubjects = entry.querySelectorAll('.subject-option.selected');
            if (selectedSubjects.length > 0) {
                if (!this.validateTimeSelection('academic', studentId, null)) {
                    allValid = false;
                }
            }
            
            // Validate extracurricular times
            entry.querySelectorAll('.extracurricular-card.selected').forEach(card => {
                const activityId = card.dataset.activityId;
                if (!this.validateTimeSelection('extracurricular', studentId, activityId)) {
                    allValid = false;
                }
                if (!this.validateExtracurricularDays(card, activityId, studentId)) {
                    allValid = false;
                }
            });
            
            // Validate test prep times
            entry.querySelectorAll('.test-prep-card.active').forEach(card => {
                const testId = card.dataset.testId;
                if (!this.validateTimeSelection('test-prep', studentId, testId)) {
                    allValid = false;
                }
            });
        });
        
        return allValid;
    }

    async validateReferralCode(code) {
        if (!code || code.length < 3) {
            this.referralValidated = false;
            this.hideBankDetails();
            return;
        }
        try {
            if (this.db) {
                const snapshot = await this.db.collection('referrals')
                    .where('code', '==', code.toUpperCase())
                    .limit(1)
                    .get();
                
                if (!snapshot.empty) {
                    this.referralValidated = true;
                    this.referrerData = snapshot.docs[0].data();
                    this.showAlert(`Referral Valid! From: ${this.referrerData.name}`, 'success');
                    this.showBankDetails();
                } else {
                    this.referralValidated = false;
                    this.hideBankDetails();
                }
            } else {
                // Firebase not available, assume referral invalid
                this.referralValidated = false;
                this.hideBankDetails();
            }
        } catch (error) {
            console.error('Referral validation error', error);
            this.referralValidated = false;
            this.hideBankDetails();
        }
    }
    
    showBankDetails() {
        document.getElementById('bank-details-section').style.display = 'block';
    }
    
    hideBankDetails() {
        document.getElementById('bank-details-section').style.display = 'none';
    }

    // ==============================================
    // GOOGLE APPS SCRIPT EMAIL INTEGRATION
    // ==============================================
    
    async sendEmailNotifications(enrollmentData, invoiceHtml = null) {
        try {
            const scriptUrl = "https://script.google.com/macros/s/AKfycbxKPivWuCyEywMCxgleEoP7MBNxT6ZEvd5WWomDNGYADZmDcBcsO4Eif-JyHSJ5mpXBaw/exec";
            
            // Prepare the data to send
            const emailData = {
                action: "send_enrollment_notification",
                timestamp: new Date().toISOString(),
                applicationId: enrollmentData.id || this.currentApplicationId,
                parent: {
                    name: enrollmentData.parent?.name || document.getElementById('parentName')?.value || "",
                    email: enrollmentData.parent?.email || document.getElementById('parentEmail')?.value || "",
                    phone: enrollmentData.parent?.phone || `${document.getElementById('countryCode')?.value || "+234"}-${document.getElementById('parentPhone')?.value || ""}`
                },
                managementEmail: "psalm4all@gmail.com",
                students: enrollmentData.students?.length || document.querySelectorAll('.student-entry').length,
                totalFee: enrollmentData.summary?.totalFee || parseInt(document.getElementById('total-fee')?.textContent.replace(/[^0-9]/g, '') || "0"),
                status: enrollmentData.status || 'submitted',
                invoiceGenerated: invoiceHtml ? true : false
            };
            
            // Send to Google Apps Script
            const response = await fetch(scriptUrl, {
                method: "POST",
                mode: "no-cors", // Important for Google Apps Script
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(emailData)
            });
            
            console.log("Email notifications sent via Google Apps Script");
            return true;
            
        } catch (error) {
            console.warn("Failed to send email notifications:", error);
            // Don't show error to user - emails are secondary
            return false;
        }
    }

    // ==============================================
    // SAVE/RESUME FUNCTIONALITY WITH EMAIL INTEGRATION
    // ==============================================
    
    async saveProgress() {
        if (this.isSaving) {
            this.showAlert("Already saving, please wait...", "warning");
            return;
        }
        
        if(!this.validateForm()) {
            this.showAlert("Please complete all required fields including time selections", "danger");
            return;
        }
        
        this.isSaving = true;
        const saveBtn = document.getElementById('save-progress-btn');
        const originalBtnText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<div class="spinner"></div> Saving...';
        saveBtn.disabled = true;
        
        try {
            // 1. Collect form data
            const enrollmentData = this.collectFormData();
            
            // 2. Generate or use existing application ID
            if (!this.currentApplicationId) {
                this.currentApplicationId = 'BKH-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
            }
            
            // 3. Prepare data for Firebase
            enrollmentData.id = this.currentApplicationId;
            enrollmentData.lastSaved = new Date().toISOString();
            enrollmentData.status = 'draft';
            enrollmentData.createdAt = enrollmentData.createdAt || new Date().toISOString();
            
            // 4. Save to Firebase if available
            if (this.db) {
                await this.db.collection('enrollments').doc(this.currentApplicationId).set(enrollmentData);
                
                // 5. Verify the save by reading back
                const verifyDoc = await this.db.collection('enrollments').doc(this.currentApplicationId).get();
                
                if (verifyDoc.exists) {
                    // Generate resume link
                    const resumeLink = window.location.origin + window.location.pathname + '?resume=' + this.currentApplicationId;
                    
                    // Update UI
                    document.getElementById('saved-app-id').textContent = this.currentApplicationId;
                    document.getElementById('resume-link').textContent = resumeLink;
                    document.getElementById('confirmation-message').classList.add('show');
                    
                    this.showAlert("Progress saved successfully! Data stored in Firebase.", "success");
                    
                    // Store in localStorage for backup
                    localStorage.setItem('lastEnrollmentId', this.currentApplicationId);
                    localStorage.setItem('lastEnrollmentData', JSON.stringify(enrollmentData));
                    localStorage.setItem('lastSaveTimestamp', new Date().toISOString());
                    
                    // Send email notifications via Google Apps Script
                    setTimeout(() => {
                        this.sendEmailNotifications(enrollmentData);
                    }, 1000);
                    
                    return {
                        success: true,
                        appId: this.currentApplicationId,
                        resumeLink: resumeLink,
                        enrollmentData: enrollmentData
                    };
                } else {
                    throw new Error('Document not found after save');
                }
                
            } else {
                // Firebase not available - use localStorage only
                const resumeLink = window.location.origin + window.location.pathname + '?resume=' + this.currentApplicationId;
                
                // Update UI
                document.getElementById('saved-app-id').textContent = this.currentApplicationId;
                document.getElementById('resume-link').textContent = resumeLink;
                document.getElementById('confirmation-message').classList.add('show');
                
                // Store in localStorage
                localStorage.setItem('lastEnrollmentId', this.currentApplicationId);
                localStorage.setItem('lastEnrollmentData', JSON.stringify(enrollmentData));
                localStorage.setItem('lastSaveTimestamp', new Date().toISOString());
                
                this.showAlert("Progress saved locally. Will sync with server when available.", "success");
                
                // Try to send email notifications
                setTimeout(() => {
                    this.sendEmailNotifications(enrollmentData);
                }, 1000);
                
                return {
                    success: true,
                    appId: this.currentApplicationId,
                    resumeLink: resumeLink,
                    enrollmentData: enrollmentData,
                    offline: true
                };
            }
            
        } catch (error) {
            // Provide specific error messages
            let errorMsg = "Error saving progress. ";
            
            if (error.code === 'permission-denied') {
                errorMsg += "Permission denied. Check Firebase security rules.";
            } else if (error.code === 'unavailable') {
                errorMsg += "Network unavailable. Check your internet connection.";
            } else if (error.message.includes('quota')) {
                errorMsg += "Database quota exceeded. Contact administrator.";
            } else {
                errorMsg += error.message;
            }
            
            this.showAlert(errorMsg, "danger");
            
            // Fallback to localStorage
            try {
                const enrollmentData = this.collectFormData();
                const backupId = 'backup_' + Date.now();
                localStorage.setItem('enrollment_backup_' + backupId, JSON.stringify({
                    ...enrollmentData,
                    backupId: backupId,
                    timestamp: new Date().toISOString()
                }));
                this.showAlert("Saved locally as backup. Data will sync when online.", "warning");
            } catch (localError) {
                console.error('Local storage backup failed:', localError);
            }
            
            return { success: false, error: error.message };
            
        } finally {
            this.isSaving = false;
            saveBtn.innerHTML = originalBtnText;
            saveBtn.disabled = false;
        }
    }
    
    async autoSave() {
        if (!this.currentApplicationId || this.isLoadingSavedData || this.isSaving) return;
        
        try {
            const enrollmentData = this.collectFormData();
            enrollmentData.lastSaved = new Date().toISOString();
            
            if (this.db) {
                await this.db.collection('enrollments').doc(this.currentApplicationId).update(enrollmentData);
                
                // Also update localStorage
                localStorage.setItem('lastEnrollmentData', JSON.stringify(enrollmentData));
            }
        } catch (error) {
            console.error('Auto-save error:', error);
        }
    }
    
    collectFormData() {
        // Get normalized phone number (country code - phone number)
        const countryCode = document.getElementById('countryCode').value ? document.getElementById('countryCode').value.trim() : '+234';
        const phoneNumber = document.getElementById('parentPhone').value ? document.getElementById('parentPhone').value.trim().replace(/\D/g, '') : '';
        const normalizedPhoneNumber = `${countryCode}-${phoneNumber}`;
        
        // Get city and country
        const city = document.getElementById('city').value ? document.getElementById('city').value.trim() : '';
        const country = document.getElementById('country').value ? document.getElementById('country').value.trim() : '';
        const cityCountry = `${city}, ${country}`;
        
        // Get the total fee
        const totalFeeText = document.getElementById('total-fee').textContent;
        const totalFeeValue = parseInt(totalFeeText.replace(/[^0-9]/g, '')) || 0;
        
        // Get academic fee
        const academicFeeText = document.getElementById('total-academic-fee').textContent;
        const academicFeeValue = parseInt(academicFeeText.replace(/[^0-9]/g, '')) || 0;
        
        // Get extracurricular fee
        const extracurricularFeeText = document.getElementById('total-extracurricular-fee').textContent;
        const extracurricularFeeValue = parseInt(extracurricularFeeText.replace(/[^0-9]/g, '')) || 0;
        
        // Get test prep fee
        const testPrepFeeText = document.getElementById('total-test-prep-fee').textContent;
        const testPrepFeeValue = parseInt(testPrepFeeText.replace(/[^0-9]/g, '')) || 0;
        
        // Get prorated amount
        const proratedText = document.getElementById('prorated-amount').textContent;
        const proratedValue = parseInt(proratedText.replace(/[^0-9]/g, '')) || 0;
        
        // Get discount amount
        const discountText = document.getElementById('discount-amount').textContent;
        const discountValue = parseInt(discountText.replace(/[^0-9]/g, '')) || 0;
        
        const data = {
            parent: {
                name: document.getElementById('parentName').value,
                email: document.getElementById('parentEmail').value,
                phone: normalizedPhoneNumber,
                countryCode: countryCode,
                phoneNumber: phoneNumber,
                city: city,
                country: country,
                address: cityCountry
            },
            referral: {
                code: document.getElementById('referralCode').value,
                bankName: document.getElementById('bankName').value,
                accountNumber: document.getElementById('accountNumber').value,
                accountName: document.getElementById('accountName').value
            },
            students: [],
            summary: {
                totalFee: totalFeeValue,
                academicFee: academicFeeValue,
                extracurricularFee: extracurricularFeeValue,
                testPrepFee: testPrepFeeValue,
                proratedAmount: proratedValue,
                discountAmount: discountValue,
                prorationExplanation: document.getElementById('proration-explanation').textContent
            },
            timestamp: new Date().toISOString()
        };
        
        // Collect student data
        document.querySelectorAll('.student-entry').forEach((entry, index) => {
            // Get preferred tutor
            const selectedTutor = entry.querySelector('.tutor-option.selected');
            const preferredTutor = selectedTutor ? selectedTutor.dataset.tutor : null;
            
            // Get academic sessions
            const selectedSession = entry.querySelector('.session-option.selected');
            const academicSessions = selectedSession ? selectedSession.dataset.sessions : null;
            
            const studentData = {
                id: index + 1,
                name: entry.querySelector('.student-name').value,
                gender: entry.querySelector('.student-gender').value,
                dob: entry.querySelector('.student-dob').value,
                grade: entry.querySelector('.student-grade').value,
                actualGrade: entry.querySelector('.student-actual-grade').value,
                startDate: entry.querySelector('.student-start-date').value,
                preferredTutor: preferredTutor,
                academicSessions: academicSessions,
                selectedSubjects: [],
                academicDays: [],
                academicTime: '',
                academicSchedule: '',
                extracurriculars: [],
                testPrep: []
            };
            
            // Collect selected subjects
            entry.querySelectorAll('.subject-option.selected').forEach(subject => {
                studentData.selectedSubjects.push(subject.dataset.subject);
            });
            
            // Collect academic days
            const academicDays = [];
            entry.querySelectorAll('.academic-day-btn.selected').forEach(btn => {
                academicDays.push(btn.dataset.day);
                studentData.academicDays.push(btn.dataset.day);
            });
            
            // Collect academic time
            const startHour = document.getElementById(`academic-start-hour-${index + 1}`)?.value || '';
            const endHour = document.getElementById(`academic-end-hour-${index + 1}`)?.value || '';
            
            if (startHour && endHour) {
                const startTime = `${parseInt(startHour) % 12 || 12} ${startHour < 12 ? 'AM' : 'PM'}`;
                const endTime = `${parseInt(endHour) % 12 || 12} ${endHour < 12 ? 'AM' : 'PM'}`;
                studentData.academicTime = `${startHour}:${endHour}`;
                studentData.academicSchedule = `${academicDays.join(', ')} from ${startTime} to ${endTime}`;
            }
            
            // Collect extracurricular activities
            entry.querySelectorAll('.extracurricular-card.selected').forEach(card => {
                const activityData = {
                    id: card.dataset.activityId,
                    name: card.querySelector('.extracurricular-name').textContent
                };
                
                const freqBtn = card.querySelector('.frequency-btn.selected');
                if (freqBtn) activityData.frequency = freqBtn.dataset.frequency;
                
                // Collect extracurricular days
                activityData.days = [];
                card.querySelectorAll('.extracurricular-day-btn.selected').forEach(btn => {
                    activityData.days.push(btn.dataset.day);
                });
                
                // Collect extracurricular time
                const startHour = document.getElementById(`extracurricular-start-hour-${index + 1}-${activityData.id}`)?.value || '';
                const endHour = document.getElementById(`extracurricular-end-hour-${index + 1}-${activityData.id}`)?.value || '';
                
                if (startHour && endHour) {
                    const startTime = `${parseInt(startHour) % 12 || 12} ${startHour < 12 ? 'AM' : 'PM'}`;
                    const endTime = `${parseInt(endHour) % 12 || 12} ${endHour < 12 ? 'AM' : 'PM'}`;
                    activityData.time = `${startHour}:${endHour}`;
                    activityData.schedule = `${activityData.days.join(', ')} from ${startTime} to ${endTime}`;
                }
                
                studentData.extracurriculars.push(activityData);
            });
            
            // Collect test prep
            entry.querySelectorAll('.test-prep-card.active').forEach(card => {
                const hours = parseFloat(card.querySelector('.test-prep-hours').value) || 0;
                if (hours > 0) {
                    const testData = {
                        id: card.dataset.testId,
                        hours: hours,
                        name: card.querySelector('.test-prep-name').textContent,
                        rate: card.querySelector('.test-prep-rate').textContent
                    };
                    
                    // Collect test prep days
                    testData.days = [];
                    card.querySelectorAll('.test-prep-day-btn.selected').forEach(btn => {
                        testData.days.push(btn.dataset.day);
                    });
                    
                    // Collect test prep time
                    const startHour = document.getElementById(`test-prep-start-hour-${index + 1}-${testData.id}`)?.value || '';
                    const endHour = document.getElementById(`test-prep-end-hour-${index + 1}-${testData.id}`)?.value || '';
                    
                    if (startHour && endHour) {
                        const startTime = `${parseInt(startHour) % 12 || 12} ${startHour < 12 ? 'AM' : 'PM'}`;
                        const endTime = `${parseInt(endHour) % 12 || 12} ${endHour < 12 ? 'AM' : 'PM'}`;
                        testData.time = `${startHour}:${endHour}`;
                        testData.schedule = `${testData.days.join(', ')} from ${startTime} to ${endTime}`;
                    }
                    
                    studentData.testPrep.push(testData);
                }
            });
            
            data.students.push(studentData);
        });
        
        return data;
    }
    
    async checkResumeLink() {
        const urlParams = new URLSearchParams(window.location.search);
        const resumeId = urlParams.get('resume') || localStorage.getItem('lastEnrollmentId');
        
        if (resumeId) {
            try {
                this.isLoadingSavedData = true;
                this.showAlert("Loading your saved application...", "info");
                
                let loadedData = null;
                
                // Try Firebase first
                if (this.db) {
                    try {
                        const doc = await this.db.collection('enrollments').doc(resumeId).get();
                        
                        if (doc.exists) {
                            this.appData = doc.data();
                            loadedData = this.appData;
                        }
                    } catch (firebaseError) {
                        console.warn('Could not load from Firebase:', firebaseError);
                    }
                }
                
                // If Firebase failed or no data, try localStorage
                if (!loadedData) {
                    const localData = localStorage.getItem('lastEnrollmentData');
                    if (localData) {
                        this.appData = JSON.parse(localData);
                        loadedData = this.appData;
                    }
                }
                
                if (loadedData) {
                    this.currentApplicationId = resumeId;
                    await this.loadSavedData(loadedData);
                    this.showAlert("Application loaded successfully!", "success");
                } else {
                    this.showAlert("Saved application not found. Starting fresh.", "warning");
                    this.addStudent();
                }
                
            } catch (error) {
                this.showAlert("Error loading saved data. Starting fresh.", "warning");
                this.addStudent();
            } finally {
                this.isLoadingSavedData = false;
            }
        } else {
            // No resume link, add initial student
            this.addStudent();
        }
    }
    
    async loadSavedData(data) {
        if (!data) return;
        
        // Load parent information
        if (data.parent) {
            document.getElementById('parentName').value = data.parent.name || '';
            document.getElementById('parentEmail').value = data.parent.email || '';
            
            // Load phone number
            if (data.parent.phone) {
                if (data.parent.phone.includes('-')) {
                    const [countryCode, phoneNumber] = data.parent.phone.split('-');
                    document.getElementById('countryCode').value = countryCode || '+234';
                    document.getElementById('parentPhone').value = phoneNumber || '';
                } else if (data.parent.countryCode && data.parent.phoneNumber) {
                    document.getElementById('countryCode').value = data.parent.countryCode || '+234';
                    document.getElementById('parentPhone').value = data.parent.phoneNumber || '';
                } else {
                    // Handle old format
                    const phone = data.parent.phone;
                    if (phone.startsWith('+')) {
                        document.getElementById('countryCode').value = '+234';
                        document.getElementById('parentPhone').value = phone.replace('+', '');
                    } else {
                        document.getElementById('countryCode').value = '+234';
                        document.getElementById('parentPhone').value = phone;
                    }
                }
            }
            
            // Load city and country
            if (data.parent.city && data.parent.country) {
                document.getElementById('city').value = data.parent.city || '';
                document.getElementById('country').value = data.parent.country || '';
            } else if (data.parent.address) {
                // Handle old format
                const addressParts = data.parent.address.split(',');
                if (addressParts.length >= 2) {
                    document.getElementById('city').value = addressParts[0].trim() || '';
                    document.getElementById('country').value = addressParts[1].trim() || '';
                } else {
                    document.getElementById('city').value = data.parent.address || '';
                    document.getElementById('country').value = 'Nigeria';
                }
            }
        }
        
        // Load referral information
        if (data.referral) {
            document.getElementById('referralCode').value = data.referral.code || '';
            document.getElementById('bankName').value = data.referral.bankName || '';
            document.getElementById('accountNumber').value = data.referral.accountNumber || '';
            document.getElementById('accountName').value = data.referral.accountName || '';
            
            if (data.referral.code) {
                await this.validateReferralCode(data.referral.code);
            }
        }
        
        // Clear existing students
        document.getElementById('students-container').innerHTML = '';
        this.studentCount = 0;
        
        // Load students
        if (data.students && data.students.length > 0) {
            // Add all students first
            data.students.forEach(student => {
                this.addStudent(student);
            });
            
            // Wait for DOM to be ready, then load selections
            setTimeout(() => {
                document.querySelectorAll('.student-entry').forEach((entry, index) => {
                    if (data.students[index]) {
                        this.preloadStudentSelections(entry, data.students[index]);
                    }
                });
                
                // Update session prices
                document.querySelectorAll('.student-entry').forEach(entry => {
                    this.updateSessionPrices(entry);
                });
                
                // Update summary after everything is loaded
                setTimeout(() => {
                    this.updateSummary();
                }, 500);
            }, 500);
        } else {
            this.addStudent();
        }
    }

    // ==============================================
    // UTILITIES
    // ==============================================
    
    showAlert(message, type = 'info') {
        const alertArea = document.getElementById('alert-area');
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${this.escapeHtml(message)}`;
        alertArea.prepend(alertDiv);
        setTimeout(() => alertDiv.remove(), 5000);
    }

    // ==============================================
    // INVOICE & PDF
    // ==============================================

    showInvoice() {
        const modal = document.getElementById('invoice-modal');
        const total = document.getElementById('total-fee').textContent;
        document.getElementById('invoice-total').textContent = total;
        document.getElementById('invoice-date').textContent = new Date().toLocaleDateString();
        
        // Set due date (14 days from now)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);
        document.getElementById('invoice-due-date').textContent = dueDate.toLocaleDateString();
        
        // Populate Bill To (escaped)
        const pName = this.escapeHtml(document.getElementById('parentName').value || 'N/A');
        const city = this.escapeHtml(document.getElementById('city').value || '');
        const country = this.escapeHtml(document.getElementById('country').value || '');
        const cityCountry = `${city}, ${country}`;
        const normalizedPhone = this.escapeHtml(`${document.getElementById('countryCode').value}-${document.getElementById('parentPhone').value}`);
        const parentEmail = this.escapeHtml(document.getElementById('parentEmail').value || '');
        
        document.getElementById('invoice-bill-to').innerHTML = `
            <p><strong>${pName}</strong></p>
            <p>${cityCountry}</p>
            <p>${parentEmail}</p>
            <p>${normalizedPhone}</p>
        `;
        
        // Generate invoice number
        document.getElementById('invoice-number').textContent = this.currentApplicationId || 'BKH-' + Date.now();
        
        // Populate Student Details Section
        this.populateStudentDetailsOnInvoice();
        
        // Populate Items
        const tbody = document.getElementById('invoice-items');
        tbody.innerHTML = '';
        
        // Collect all data
        const academicFee = parseInt(document.getElementById('total-academic-fee').textContent.replace(/\D/g,'')) || 0;
        const extracurricularFee = parseInt(document.getElementById('total-extracurricular-fee').textContent.replace(/\D/g,'')) || 0;
        const testPrepFee = parseInt(document.getElementById('total-test-prep-fee').textContent.replace(/\D/g,'')) || 0;
        const discount = parseInt(document.getElementById('discount-amount').textContent.replace(/\D/g,'')) || 0;
        const prorated = parseInt(document.getElementById('prorated-amount').textContent.replace(/\D/g,'')) || 0;
        
        // Academic fees with details
        const studentEntries = document.querySelectorAll('.student-entry');
        studentEntries.forEach((entry, index) => {
            const studentName = this.escapeHtml(entry.querySelector('.student-name').value || `Student ${index + 1}`);
            const selectedSubjects = Array.from(entry.querySelectorAll('.subject-option.selected')).map(opt => this.escapeHtml(opt.dataset.subject));
            const grade = entry.querySelector('.student-grade').value;
            const selectedSession = entry.querySelector('.session-option.selected');
            const sessions = selectedSession ? selectedSession.dataset.sessions : null;
            
            if (selectedSubjects.length > 0 && grade && sessions) {
                const academicDays = Array.from(entry.querySelectorAll('.academic-day-btn.selected')).map(btn => btn.dataset.day);
                const startHour = document.getElementById(`academic-start-hour-${index + 1}`)?.value || '';
                const endHour = document.getElementById(`academic-end-hour-${index + 1}`)?.value || '';
                
                const startTime = startHour ? `${parseInt(startHour) % 12 || 12} ${startHour < 12 ? 'AM' : 'PM'}` : '';
                const endTime = endHour ? `${parseInt(endHour) % 12 || 12} ${endHour < 12 ? 'AM' : 'PM'}` : '';
                
                // Get tutor preference
                const selectedTutor = entry.querySelector('.tutor-option.selected');
                const tutorPreference = selectedTutor ? selectedTutor.dataset.tutor : 'No Preference';
                const tutorText = tutorPreference === 'male' ? 'Male Tutor' : 
                                  tutorPreference === 'female' ? 'Female Tutor' : 'No Preference';
                
                const description = `${studentName}: ${selectedSubjects.join(', ')} (${sessions} weekly, ${academicDays.join(', ')}, ${startTime}-${endTime}, ${tutorText})`;
                
                // Calculate student's academic fee
                const baseFee = CONFIG.ACADEMIC_FEES[grade] ? CONFIG.ACADEMIC_FEES[grade][sessions] : 0;
                const extraCount = Math.max(0, selectedSubjects.length - CONFIG.CONSTANTS.BASE_SUBJECTS_INCLUDED);
                const extraFee = extraCount * CONFIG.CONSTANTS.ADDITIONAL_SUBJECT_FEE;
                const studentAcademicFee = baseFee + extraFee;
                
                tbody.innerHTML += `<tr><td>${this.escapeHtml(description)}</td><td>1</td><td>₦${studentAcademicFee.toLocaleString()}</td><td>₦${studentAcademicFee.toLocaleString()}</td></tr>`;
            }
        });
        
        // Extracurricular activities with details
        studentEntries.forEach((entry, index) => {
            const studentName = this.escapeHtml(entry.querySelector('.student-name').value || `Student ${index + 1}`);
            
            entry.querySelectorAll('.extracurricular-card.selected').forEach(card => {
                const activityName = this.escapeHtml(card.querySelector('.extracurricular-name').textContent);
                const selectedDays = Array.from(card.querySelectorAll('.extracurricular-day-btn.selected')).map(btn => btn.dataset.day);
                const activityId = card.dataset.activityId;
                const startHour = document.getElementById(`extracurricular-start-hour-${index + 1}-${activityId}`)?.value || '';
                const endHour = document.getElementById(`extracurricular-end-hour-${index + 1}-${activityId}`)?.value || '';
                
                const startTime = startHour ? `${parseInt(startHour) % 12 || 12} ${startHour < 12 ? 'AM' : 'PM'}` : '';
                const endTime = endHour ? `${parseInt(endHour) % 12 || 12} ${endHour < 12 ? 'AM' : 'PM'}` : '';
                
                const activity = CONFIG.EXTRACURRICULAR_FEES.find(a => a.id === activityId);
                const description = `${studentName}: ${activityName} (${selectedDays.join(', ')}, ${startTime}-${endTime})`;
                
                if (activity) {
                    const selectedDaysCount = selectedDays.length;
                    let fee = 0;
                    
                    if (activity.id === 'global_discovery') {
                        fee = activity.ratePerSession;
                    } else {
                        fee = activity.ratePerSession * Math.min(selectedDaysCount, 2);
                        const freqBtn = card.querySelector('.frequency-btn.selected');
                        if (freqBtn && freqBtn.dataset.frequency === 'twice') {
                            fee *= 2;
                        }
                    }
                    
                    if (fee > 0) {
                        tbody.innerHTML += `<tr><td>${this.escapeHtml(description)}</td><td>1</td><td>₦${fee.toLocaleString()}</td><td>₦${fee.toLocaleString()}</td></tr>`;
                    }
                }
            });
        });
        
        // Test prep with details
        studentEntries.forEach((entry, index) => {
            const studentName = this.escapeHtml(entry.querySelector('.student-name').value || `Student ${index + 1}`);
            
            entry.querySelectorAll('.test-prep-card.active').forEach(card => {
                const testName = this.escapeHtml(card.querySelector('.test-prep-name').textContent);
                const hours = parseFloat(card.querySelector('.test-prep-hours').value) || 0;
                const selectedDays = Array.from(card.querySelectorAll('.test-prep-day-btn.selected')).map(btn => btn.dataset.day);
                const testId = card.dataset.testId;
                const startHour = document.getElementById(`test-prep-start-hour-${index + 1}-${testId}`)?.value || '';
                const endHour = document.getElementById(`test-prep-end-hour-${index + 1}-${testId}`)?.value || '';
                
                const startTime = startHour ? `${parseInt(startHour) % 12 || 12} ${startHour < 12 ? 'AM' : 'PM'}` : '';
                const endTime = endHour ? `${parseInt(endHour) % 12 || 12} ${endHour < 12 ? 'AM' : 'PM'}` : '';
                
                const test = CONFIG.TEST_PREP_FEES.find(t => t.id === testId);
                
                if (test && hours > 0 && selectedDays.length > 0) {
                    const weeklyHours = hours * selectedDays.length;
                    const monthlyHours = weeklyHours * CONFIG.CONSTANTS.WEEKS_PER_MONTH;
                    const fee = monthlyHours * test.rate;
                    
                    const description = `${studentName}: ${testName} (${selectedDays.join(', ')}, ${startTime}-${endTime}, ${hours}hrs/session)`;
                    
                    tbody.innerHTML += `<tr><td>${this.escapeHtml(description)}</td><td>1</td><td>₦${fee.toLocaleString()}</td><td>₦${fee.toLocaleString()}</td></tr>`;
                }
            });
        });
        
        // Discounts
        if (discount > 0) {
            tbody.innerHTML += `<tr><td>Sibling Discount</td><td>1</td><td>-</td><td>-₦${discount.toLocaleString()}</td></tr>`;
        }
        
        // Prorated adjustment
        if (prorated > 0) {
            const explanation = document.getElementById('proration-explanation').textContent;
            tbody.innerHTML += `<tr><td>Prorated Adjustment (Mid-month Start)<br><small>${this.escapeHtml(explanation)}</small></td><td>1</td><td>-</td><td>-₦${prorated.toLocaleString()}</td></tr>`;
        }

        modal.classList.add('active');
    }
    
    populateStudentDetailsOnInvoice() {
        const container = document.getElementById('invoice-student-details-container');
        container.innerHTML = '';
        
        const studentEntries = document.querySelectorAll('.student-entry');
        
        if (studentEntries.length === 0) return;
        
        studentEntries.forEach((entry, index) => {
            const studentId = index + 1;
            const studentName = this.escapeHtml(entry.querySelector('.student-name').value || `Student ${studentId}`);
            const grade = entry.querySelector('.student-grade').value;
            const startDate = entry.querySelector('.student-start-date').value;
            
            // Get tutor preference
            const selectedTutor = entry.querySelector('.tutor-option.selected');
            const tutorPreference = selectedTutor ? selectedTutor.dataset.tutor : 'No Preference';
            const tutorText = tutorPreference === 'male' ? 'Male Tutor' : 
                              tutorPreference === 'female' ? 'Female Tutor' : 'No Preference';
            
            // Get academic sessions
            const selectedSession = entry.querySelector('.session-option.selected');
            const sessions = selectedSession ? selectedSession.dataset.sessions : null;
            const sessionsText = sessions ? `${sessions} weekly` : 'Not selected';
            
            const studentDiv = document.createElement('div');
            studentDiv.className = 'invoice-student-details';
            
            let detailsHTML = `<h4>${studentName} (${grade}) - ${sessionsText} - ${tutorText} - Starting: ${startDate}</h4>`;
            
            // Academic details
            const selectedSubjects = Array.from(entry.querySelectorAll('.subject-option.selected')).map(opt => this.escapeHtml(opt.dataset.subject));
            const academicDays = Array.from(entry.querySelectorAll('.academic-day-btn.selected')).map(btn => btn.dataset.day);
            const startHour = document.getElementById(`academic-start-hour-${studentId}`)?.value || '';
            const endHour = document.getElementById(`academic-end-hour-${studentId}`)?.value || '';
            
            if (selectedSubjects.length > 0) {
                const startTime = startHour ? `${parseInt(startHour) % 12 || 12} ${startHour < 12 ? 'AM' : 'PM'}` : '';
                const endTime = endHour ? `${parseInt(endHour) % 12 || 12} ${endHour < 12 ? 'AM' : 'PM'}` : '';
                
                detailsHTML += `
                    <div class="student-schedule">
                        <strong>Academic Subjects:</strong> ${selectedSubjects.join(', ')}<br>
                        <strong>Schedule:</strong> ${academicDays.join(', ')} from ${startTime} to ${endTime}
                    </div>
                `;
            }
            
            // Extracurricular details
            const extracurricularCards = entry.querySelectorAll('.extracurricular-card.selected');
            if (extracurricularCards.length > 0) {
                detailsHTML += '<div class="student-schedule"><strong>Extracurricular Activities:</strong><br>';
                
                extracurricularCards.forEach(card => {
                    const activityId = card.dataset.activityId;
                    const activityName = this.escapeHtml(card.querySelector('.extracurricular-name').textContent);
                    const selectedDays = Array.from(card.querySelectorAll('.extracurricular-day-btn.selected')).map(btn => btn.dataset.day);
                    const startHour = document.getElementById(`extracurricular-start-hour-${studentId}-${activityId}`)?.value || '';
                    const endHour = document.getElementById(`extracurricular-end-hour-${studentId}-${activityId}`)?.value || '';
                    
                    const startTime = startHour ? `${parseInt(startHour) % 12 || 12} ${startHour < 12 ? 'AM' : 'PM'}` : '';
                    const endTime = endHour ? `${parseInt(endHour) % 12 || 12} ${endHour < 12 ? 'AM' : 'PM'}` : '';
                    
                    detailsHTML += `${activityName}: ${selectedDays.join(', ')} from ${startTime} to ${endTime}<br>`;
                });
                
                detailsHTML += '</div>';
            }
            
            // Test prep details
            const testPrepCards = entry.querySelectorAll('.test-prep-card.active');
            if (testPrepCards.length > 0) {
                detailsHTML += '<div class="student-schedule"><strong>Test Preparation:</strong><br>';
                
                testPrepCards.forEach(card => {
                    const testId = card.dataset.testId;
                    const testName = this.escapeHtml(card.querySelector('.test-prep-name').textContent);
                    const hours = parseFloat(card.querySelector('.test-prep-hours').value) || 0;
                    const selectedDays = Array.from(card.querySelectorAll('.test-prep-day-btn.selected')).map(btn => btn.dataset.day);
                    const startHour = document.getElementById(`test-prep-start-hour-${studentId}-${testId}`)?.value || '';
                    const endHour = document.getElementById(`test-prep-end-hour-${studentId}-${testId}`)?.value || '';
                    
                    const startTime = startHour ? `${parseInt(startHour) % 12 || 12} ${startHour < 12 ? 'AM' : 'PM'}` : '';
                    const endTime = endHour ? `${parseInt(endHour) % 12 || 12} ${endHour < 12 ? 'AM' : 'PM'}` : '';
                    
                    detailsHTML += `${testName}: ${selectedDays.join(', ')} from ${startTime} to ${endTime} (${hours}hrs/session)<br>`;
                });
                
                detailsHTML += '</div>';
            }
            
            studentDiv.innerHTML = detailsHTML;
            container.appendChild(studentDiv);
        });
    }

    async downloadInvoicePDF() {
        // Check if required libraries are loaded
        if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
            this.showAlert("PDF generation libraries not loaded. Please try again later.", "danger");
            return;
        }
        
        const element = document.getElementById('invoice-content');
        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const width = pdf.internal.pageSize.getWidth();
        const height = (canvas.height * width) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save('BKH-Invoice-' + (this.currentApplicationId || 'temp') + '.pdf');
        
        // Show success message
        const status = document.getElementById('pdf-status');
        status.classList.add('show');
        setTimeout(() => status.classList.remove('show'), 3000);
    }

    async submitEnrollment() {
        if (!this.validateForm()) {
            this.showAlert("Please fix all errors before submitting. Make sure all time selections are completed.", "danger");
            return;
        }

        const btn = document.getElementById('submit-enrollment');
        btn.innerHTML = '<div class="spinner"></div> Processing Enrollment...';
        btn.disabled = true;

        try {
            // STEP 1: Save the core enrollment data first
            const result = await this.saveProgress();

            if (!result.success) {
                throw new Error("Failed to save enrollment data.");
            }

            this.showAlert("Enrollment Saved Successfully! Setting up your portal...", "success");
            this.showInvoice();

            // STEP 2: Attempt Parent Portal Setup
            const portalResult = await this.setupParentPortal(result.enrollmentData);

            // Handle successful portal creation
            if (portalResult && portalResult.isNew) {
                document.getElementById('temp-password').textContent = portalResult.password;
                document.getElementById('temp-password-container').style.display = 'block';
                this.showAlert(`Portal created! Your temporary password is: ${portalResult.password}. Please save it.`, 'success');

                if (portalResult.referralCode) {
                    const referralContainer = document.createElement('div');
                    referralContainer.id = 'referral-code-container';
                    referralContainer.className = 'mt-4 p-4 bg-green-50 border border-green-200 rounded-lg';
                    referralContainer.innerHTML = `
                        <p class="font-semibold text-green-800">Your Referral Code:</p>
                        <p class="text-2xl font-mono text-green-600 bg-white p-2 rounded border border-green-300 select-all">${this.escapeHtml(portalResult.referralCode)}</p>
                        <p class="text-sm text-green-700 mt-2">Share this code with other parents to earn ₦5,000!</p>
                    `;
                    document.getElementById('temp-password-container').after(referralContainer);
                }
            } else if (portalResult && !portalResult.isNew) {
                this.showAlert('Your existing parent account has been linked. You can log in with your email.', 'info');
            } else {
                // STEP 2.5: ERROR RECOVERY - Enrollment saved, but portal failed.
                this.showAlert("Enrollment successful, but we couldn't auto-login to your portal. Please contact support to link your account.", "warning");
                btn.innerHTML = 'Enrollment Complete (Portal Setup Pending)';
                btn.disabled = false;
                return; // Halt execution here so we don't open the portal tab blindly
            }

            // STEP 3: Fire-and-forget email notifications
            setTimeout(() => {
                const invoiceElement = document.getElementById('invoice-content');
                const invoiceContent = invoiceElement ? invoiceElement.innerHTML : "";
                this.sendEmailNotifications(result.enrollmentData || this.collectFormData(), invoiceContent);
            }, 2000);

            // STEP 4: Redirect to Parent Portal in a NEW TAB
            setTimeout(() => {
                window.open("parent.html", "_blank"); // '_blank' guarantees a new tab
            }, 3000);

            btn.innerHTML = 'Success!';
            btn.disabled = false;

        } catch (error) {
            console.error("Enrollment Submission Error:", error);
            btn.innerHTML = '<i class="fas fa-lock"></i> Proceed to Secure Payment';
            btn.disabled = false;
            this.showAlert("An error occurred during submission. Please try again.", "danger");
        }
    }

    copyResumeLink(btn) {
        const text = document.getElementById('resume-link').textContent;
        
        // Use modern clipboard API with fallback
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.showCopySuccess(btn);
            }).catch(() => {
                this.fallbackCopy(text, btn);
            });
        } else {
            this.fallbackCopy(text, btn);
        }
    }
    
    fallbackCopy(text, btn) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            this.showCopySuccess(btn);
        } catch (err) {
            this.showAlert("Failed to copy link. Please copy manually.", "warning");
        }
        document.body.removeChild(textarea);
    }
    
    showCopySuccess(btn) {
        btn.textContent = "Copied!";
        btn.classList.add('copied');
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-copy"></i> Copy Link';
            btn.classList.remove('copied');
        }, 2000);
    }

   // ==============================================
   // REFERRAL CODE GENERATION (HIGH ENTROPY)
   // ==============================================
   async generateReferralCode() {
        if (!this.db) {
            // If no database, generate a random code anyway (entropy is high)
            const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const prefix = 'BKH';
            const timeSeed = Date.now().toString(36).toUpperCase().slice(-2);
            let suffix = '';
            for (let i = 0; i < 6; i++) {
                suffix += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return prefix + timeSeed + suffix;
        }

        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const prefix = 'BKH';
        let code;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 20;

        while (!isUnique && attempts < maxAttempts) {
            attempts++;
            const timeSeed = Date.now().toString(36).toUpperCase().slice(-2);
            let suffix = '';
            for (let i = 0; i < 6; i++) {
                suffix += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            code = prefix + timeSeed + suffix;

            try {
                const snapshot = await this.db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
                if (snapshot.empty) {
                    isUnique = true;
                }
            } catch (error) {
                console.warn("Firestore query for referral code uniqueness failed. Assuming unique due to high entropy.", error);
                // If query fails (e.g., permission denied), accept the code as unique
                isUnique = true;
            }
        }
        
        if (attempts >= maxAttempts) {
            console.warn("Referral code generation reached max attempts, using last generated code.");
        }
        
        return code;
    }

    // ==============================================
    // PARENT PORTAL ACCOUNT SETUP (SECURE)
    // ==============================================
    async setupParentPortal(enrollmentData) {
        if (!enrollmentData || !enrollmentData.parent) {
            console.warn("No parent data available to set up account");
            return null;
        }

        const parentEmail = enrollmentData.parent.email;
        const parentName = enrollmentData.parent.name || 'Parent';
        const parentPhone = enrollmentData.parent.phone;

        if (!parentEmail) {
            this.showAlert("Cannot create parent account: email missing", "warning");
            return null;
        }

        // Check if Firebase auth is available
        if (typeof firebase === 'undefined' || !firebase.auth) {
            this.showAlert("Parent portal setup temporarily unavailable. Please contact support.", "warning");
            return null;
        }

        try {
            const methods = await firebase.auth().fetchSignInMethodsForEmail(parentEmail);

            if (methods.length > 0) {
                // EXISTING USER LOGIC
                if (!this.db) {
                    this.showAlert("Existing parent account detected, but database unavailable. Please log in manually.", "info");
                    return null;
                }
                
                const snapshot = await this.db.collection('parent_users')
                    .where('email', '==', parentEmail)
                    .limit(1)
                    .get();

                if (!snapshot.empty) {
                    const existingParent = snapshot.docs[0].data();
                    const parentUid = existingParent.uid;

                    await this.db.collection('enrollments').doc(this.currentApplicationId).update({
                        parentUid: parentUid
                    });

                    return { isNew: false, uid: parentUid };
                } else {
                    return null; // Exists in Auth but no profile found
                }
            } else {
                // NEW USER CREATION LOGIC
                const randomPassword = Math.random().toString(36).slice(-10) + 
                                       Math.random().toString(36).slice(-10).toUpperCase();
                
                const userCredential = await firebase.auth().createUserWithEmailAndPassword(parentEmail, randomPassword);
                const user = userCredential.user;

                const newReferralCode = await this.generateReferralCode();

                // Create Profile
                if (this.db) {
                    await this.db.collection('parent_users').doc(user.uid).set({
                        email: parentEmail,
                        phone: parentPhone,
                        normalizedPhone: parentPhone,
                        parentName: parentName,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        referralCode: newReferralCode,
                        referralEarnings: 0,
                        uid: user.uid
                    });
                } else {
                    // If no DB, still return the password but note that profile may not persist
                    this.showAlert("Parent account created, but profile storage failed. Please contact support.", "warning");
                }

                // Update enrollment - link parent UID
                if (this.db) {
                    await this.db.collection('enrollments').doc(this.currentApplicationId).update({
                        parentUid: user.uid
                    });
                }

                return { isNew: true, uid: user.uid, password: randomPassword, referralCode: newReferralCode };
            }
        } catch (error) {
            console.error('Error setting up parent portal account:', error);
            return null; // Return null so submitEnrollment() can handle the graceful failure
        }
    }
}

// ==============================================
// INITIALIZE APPLICATION
// ==============================================
document.addEventListener('DOMContentLoaded', () => {
    // firebaseConfig is already set by the module script (firebaseConfig.js)
    if (window.firebaseConfig) {
        window.enrollmentApp = new EnrollmentApp(window.firebaseConfig);
    } else {
        console.error('Firebase config not loaded. Make sure firebaseConfig.js is present and loaded as a module.');
        // Optionally show a user-friendly message
        document.getElementById('alert-area').innerHTML = 
            '<div class="alert alert-danger">Configuration error. Please contact support.</div>';
    }
});
