[file name]: updated_parent_js.txt
[file content begin]
// Firebase config for the 'bloomingkidsassessment' project
firebase.initializeApp({
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
});

const db = firebase.firestore();
const auth = firebase.auth();

// Load libphonenumber-js for phone number validation
const libphonenumberScript = document.createElement('script');
libphonenumberScript.src = 'https://cdn.jsdelivr.net/npm/libphonenumber-js@1.10.14/bundle/libphonenumber-js.min.js';
document.head.appendChild(libphonenumberScript);

// Add this function to create the country dropdown
function createCountryCodeDropdown() {
    const phoneInputContainer = document.getElementById('signupPhone').parentNode;
    
    // Create container for country code and phone number
    const container = document.createElement('div');
    container.className = 'flex gap-2';
    
    // Create country code dropdown
    const countryCodeSelect = document.createElement('select');
    countryCodeSelect.id = 'countryCode';
    countryCodeSelect.className = 'w-32 px-3 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
    countryCodeSelect.required = true;
    
    // Country codes list (40 countries with USA/Canada as default)
    const countries = [
        { code: '+1', name: 'USA/Canada (+1)' },
        { code: '+234', name: 'Nigeria (+234)' },
        { code: '+44', name: 'UK (+44)' },
        { code: '+233', name: 'Ghana (+233)' },
        { code: '+254', name: 'Kenya (+254)' },
        { code: '+27', name: 'South Africa (+27)' },
        { code: '+91', name: 'India (+91)' },
        { code: '+971', name: 'UAE (+971)' },
        { code: '+966', name: 'Saudi Arabia (+966)' },
        { code: '+20', name: 'Egypt (+20)' },
        { code: '+237', name: 'Cameroon (+237)' },
        { code: '+256', name: 'Uganda (+256)' },
        { code: '+255', name: 'Tanzania (+255)' },
        { code: '+250', name: 'Rwanda (+250)' },
        { code: '+251', name: 'Ethiopia (+251)' },
        { code: '+41', name: 'Switzerland (+41)' },
        { code: '+86', name: 'China (+86)' },
        { code: '+33', name: 'France (+33)' },
        { code: '+49', name: 'Germany (+49)' },
        { code: '+61', name: 'Australia (+61)' },
        { code: '+55', name: 'Brazil (+55)' },
        { code: '+351', name: 'Portugal (+351)' },
        { code: '+34', name: 'Spain (+34)' },
        { code: '+39', name: 'Italy (+39)' },
        { code: '+31', name: 'Netherlands (+31)' },
        { code: '+32', name: 'Belgium (+32)' },
        { code: '+46', name: 'Sweden (+46)' },
        { code: '+47', name: 'Norway (+47)' },
        { code: '+45', name: 'Denmark (+45)' },
        { code: '+358', name: 'Finland (+358)' },
        { code: '+353', name: 'Ireland (+353)' },
        { code: '+48', name: 'Poland (+48)' },
        { code: '+90', name: 'Turkey (+90)' },
        { code: '+961', name: 'Lebanon (+961)' },
        { code: '+962', name: 'Jordan (+962)' },
        { code: '+81', name: 'Japan (+81)' },
        { code: '+82', name: 'South Korea (+82)' },
        { code: '+60', name: 'Malaysia (+60)' },
        { code: '+852', name: 'Hong Kong (+852)' },
        { code: '+52', name: 'Mexico (+52)' }
    ];
    
    // Add options to dropdown
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = country.name;
        countryCodeSelect.appendChild(option);
    });
    
    // Set USA/Canada as default
    countryCodeSelect.value = '+1';
    
    // Get the existing phone input
    const phoneInput = document.getElementById('signupPhone');
    phoneInput.placeholder = 'Enter phone number without country code';
    phoneInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
    
    // Replace the original input with new structure
    container.appendChild(countryCodeSelect);
    container.appendChild(phoneInput);
    phoneInputContainer.appendChild(container);
}

// ENHANCED MULTI-NORMALIZATION FUNCTION FOR ALL COUNTRIES
function multiNormalizePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') {
        return { normalized: null, country: null, valid: false, error: 'Invalid input' };
    }

    console.log("🔧 Starting multi-normalization for:", phone);
    
    const normalizationAttempts = [];
    
    try {
        // Clean the phone number - remove all non-digit characters except +
        let cleaned = phone.replace(/[^\d+]/g, '');
        
        // ATTEMPT 1: Standard normalization (current logic)
        let attempt1 = null;
        try {
            const parsed1 = libphonenumber.parsePhoneNumberFromString(cleaned);
            if (parsed1 && parsed1.isValid()) {
                attempt1 = {
                    normalized: parsed1.format('E.164'),
                    country: parsed1.country,
                    valid: true,
                    attempt: 'standard'
                };
                normalizationAttempts.push(attempt1);
                console.log("🔧 Attempt 1 (Standard):", attempt1.normalized);
            }
        } catch (e) {
            console.log("🔧 Attempt 1 failed:", e.message);
        }

        // ATTEMPT 2: Country code correction for common patterns
        let attempt2 = null;
        try {
            // US/Canada patterns
            if (cleaned.match(/^(1)?(469|214|972|713|281|832|210|817)/) && !cleaned.startsWith('+')) {
                const usNumber = '+1' + cleaned.replace(/^1/, '');
                const parsed2 = libphonenumber.parsePhoneNumberFromString(usNumber);
                if (parsed2 && parsed2.isValid()) {
                    attempt2 = {
                        normalized: parsed2.format('E.164'),
                        country: parsed2.country,
                        valid: true,
                        attempt: 'us_correction'
                    };
                    normalizationAttempts.push(attempt2);
                    console.log("🔧 Attempt 2 (US Correction):", attempt2.normalized);
                }
            }
            
            // UK patterns
            if (cleaned.match(/^(44)?(20|7|1|2|3|8|9)/) && !cleaned.startsWith('+')) {
                const ukNumber = '+44' + cleaned.replace(/^44/, '');
                const parsed2 = libphonenumber.parsePhoneNumberFromString(ukNumber);
                if (parsed2 && parsed2.isValid()) {
                    attempt2 = {
                        normalized: parsed2.format('E.164'),
                        country: parsed2.country,
                        valid: true,
                        attempt: 'uk_correction'
                    };
                    normalizationAttempts.push(attempt2);
                    console.log("🔧 Attempt 2 (UK Correction):", attempt2.normalized);
                }
            }
            
            // Nigeria patterns
            if (cleaned.match(/^(234)?(80|70|81|90|91)/) && !cleaned.startsWith('+')) {
                const ngNumber = '+234' + cleaned.replace(/^234/, '');
                const parsed2 = libphonenumber.parsePhoneNumberFromString(ngNumber);
                if (parsed2 && parsed2.isValid()) {
                    attempt2 = {
                        normalized: parsed2.format('E.164'),
                        country: parsed2.country,
                        valid: true,
                        attempt: 'nigeria_correction'
                    };
                    normalizationAttempts.push(attempt2);
                    console.log("🔧 Attempt 2 (Nigeria Correction):", attempt2.normalized);
                }
            }
        } catch (e) {
            console.log("🔧 Attempt 2 failed:", e.message);
        }

        // ATTEMPT 3: Area code only (for numbers that lost country code)
        let attempt3 = null;
        try {
            // Common area codes that might be missing country codes
            const areaCodePatterns = [
                { code: '1', patterns: [/^(469|214|972|713|281|832|210|817)/] }, // US
                { code: '44', patterns: [/^(20|7|1|2|3|8|9)/] }, // UK
                { code: '234', patterns: [/^(80|70|81|90|91)/] }, // Nigeria
                { code: '33', patterns: [/^(1|2|3|4|5)/] }, // France
                { code: '49', patterns: [/^(15|16|17|17)/] }, // Germany
                { code: '91', patterns: [/^(98|99|90|80)/] }, // India
            ];
            
            for (const country of areaCodePatterns) {
                for (const pattern of country.patterns) {
                    if (pattern.test(cleaned) && !cleaned.startsWith('+')) {
                        const correctedNumber = '+' + country.code + cleaned;
                        const parsed3 = libphonenumber.parsePhoneNumberFromString(correctedNumber);
                        if (parsed3 && parsed3.isValid()) {
                            attempt3 = {
                                normalized: parsed3.format('E.164'),
                                country: parsed3.country,
                                valid: true,
                                attempt: 'area_code_correction'
                            };
                            normalizationAttempts.push(attempt3);
                            console.log("🔧 Attempt 3 (Area Code Correction):", attempt3.normalized);
                            break;
                        }
                    }
                }
                if (attempt3) break;
            }
        } catch (e) {
            console.log("🔧 Attempt 3 failed:", e.message);
        }

        // ATTEMPT 4: Digits only (fallback)
        let attempt4 = null;
        try {
            const digitsOnly = cleaned.replace(/\D/g, '');
            if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
                attempt4 = {
                    normalized: digitsOnly,
                    country: null,
                    valid: true,
                    attempt: 'digits_only'
                };
                normalizationAttempts.push(attempt4);
                console.log("🔧 Attempt 4 (Digits Only):", attempt4.normalized);
            }
        } catch (e) {
            console.log("🔧 Attempt 4 failed:", e.message);
        }

        // Return all valid normalization attempts
        if (normalizationAttempts.length > 0) {
            console.log("🎯 Multi-normalization results:", normalizationAttempts.map(a => a.normalized));
            return normalizationAttempts;
        }

        return [{ 
            normalized: null, 
            country: null, 
            valid: false, 
            error: 'No valid normalization found',
            attempt: 'failed'
        }];
        
    } catch (error) {
        console.error("❌ Multi-normalization error:", error);
        return [{ 
            normalized: null, 
            country: null, 
            valid: false, 
            error: error.message,
            attempt: 'error'
        }];
    }
}

// Simple phone cleaning - fallback if library not loaded
function cleanPhoneNumber(phone) {
    if (!phone) return '';
    return phone.trim();
}

function capitalize(str) {
    if (!str) return "";
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

// Global variables for user data
let currentUserData = null;
let userChildren = [];
let unreadResponsesCount = 0; // Track unread responses
let realTimeListeners = []; // Track real-time listeners
let academicsData = {
    topics: [],
    homework: [],
    studentMap: new Map(),
    selectedStudentId: null,
    selectedStudentName: null
};

// -------------------------------------------------------------------
// START: ACADEMICS TAB FUNCTIONS
// -------------------------------------------------------------------

/**
 * Helper function to determine which months to display based on the "2nd Day Rule"
 * @returns {Object} Object containing months to display
 */
function getMonthDisplayLogic() {
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentYear = today.getFullYear();
    const currentDay = today.getDate();
    
    if (currentDay <= 2) {
        // If today is 1st or 2nd, show both current and previous month
        let previousMonth = currentMonth - 1;
        let previousYear = currentYear;
        
        if (previousMonth === 0) {
            previousMonth = 12;
            previousYear = currentYear - 1;
        }
        
        return {
            monthsToDisplay: [
                { month: previousMonth, year: previousYear },
                { month: currentMonth, year: currentYear }
            ],
            showPreviousMonth: true
        };
    } else {
        // Otherwise, only show current month
        return {
            monthsToDisplay: [
                { month: currentMonth, year: currentYear }
            ],
            showPreviousMonth: false
        };
    }
}

/**
 * Format date with detailed information
 * @param {Date|FirebaseTimestamp} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDetailedDate(date) {
    if (!date) return 'Date not available';
    
    let jsDate;
    if (date.toDate) {
        // Firebase Timestamp
        jsDate = date.toDate();
    } else if (date instanceof Date) {
        // JavaScript Date
        jsDate = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
        // String or timestamp
        jsDate = new Date(date);
    } else {
        return 'Invalid date';
    }
    
    // Check if date is valid
    if (isNaN(jsDate.getTime())) {
        return 'Invalid date';
    }
    
    return jsDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get status tag for homework based on due date and submission status
 * @param {Object} homework - Homework assignment object
 * @returns {string} HTML for status tag
 */
function getHomeworkStatusTag(homework) {
    const today = new Date();
    let dueDate;
    
    if (homework.dueDate && homework.dueDate.toDate) {
        dueDate = homework.dueDate.toDate();
    } else if (homework.dueDate) {
        dueDate = new Date(homework.dueDate);
    } else {
        return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">No Due Date</span>';
    }
    
    if (homework.submitted) {
        return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">✅ Submitted</span>';
    }
    
    if (dueDate < today) {
        return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200 animate-pulse">⏰ Overdue</span>';
    }
    
    return '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">📝 Pending</span>';
}

/**
 * Get grade color coding
 * @param {number|string} grade - Grade value
 * @returns {string} Color class
 */
function getGradeColor(grade) {
    if (!grade) return '';
    
    const numGrade = typeof grade === 'string' ? parseFloat(grade) : grade;
    
    if (numGrade >= 70) return 'text-green-600 font-bold';
    if (numGrade >= 50) return 'text-yellow-600 font-bold';
    return 'text-red-600 font-bold';
}

/**
 * Toggle academics accordion section
 * @param {string} sectionId - ID of section to toggle
 */
function toggleAcademicsAccordion(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const icon = document.getElementById(`${sectionId}-icon`);
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        content.classList.add('slide-down');
        icon.innerHTML = '▼';
    } else {
        content.classList.add('hidden');
        content.classList.remove('slide-down');
        icon.innerHTML = '▶';
    }
}

/**
 * Create student dropdown for academics tab
 * @param {Array} students - Array of student objects
 */
function createStudentDropdown(students) {
    const dropdownContainer = document.getElementById('academicsStudentDropdown');
    if (!dropdownContainer) return;
    
    dropdownContainer.innerHTML = '';
    
    if (students.length === 0) {
        dropdownContainer.innerHTML = `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p class="text-yellow-700">No students found. Please contact support.</p>
            </div>
        `;
        return;
    }
    
    const dropdown = document.createElement('select');
    dropdown.id = 'academicsStudentSelect';
    dropdown.className = 'w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200';
    dropdown.innerHTML = '<option value="all">All Students</option>';
    
    students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.id;
        option.textContent = `${capitalize(student.name)}${student.pending ? ' (Pending Registration)' : ''}`;
        dropdown.appendChild(option);
    });
    
    dropdown.addEventListener('change', function() {
        const selectedStudentId = this.value;
        if (selectedStudentId === 'all') {
            loadAcademicsData(null); // Load all students
        } else {
            const selectedStudent = students.find(s => s.id === selectedStudentId);
            loadAcademicsData(selectedStudentId, selectedStudent?.name);
        }
    });
    
    dropdownContainer.appendChild(dropdown);
    
    // Auto-select first student if only one
    if (students.length === 1) {
        dropdown.value = students[0].id;
        loadAcademicsData(students[0].id, students[0].name);
    } else {
        // Default to "All Students"
        loadAcademicsData(null);
    }
}

/**
 * Load academics data for selected student
 * @param {string|null} selectedStudentId - Student ID or null for all
 * @param {string|null} selectedStudentName - Student name for display
 */
async function loadAcademicsData(selectedStudentId = null, selectedStudentName = null) {
    const academicsContent = document.getElementById('academicsContent');
    if (!academicsContent) return;
    
    academicsContent.innerHTML = `
        <div class="text-center py-12">
            <div class="loading-spinner mx-auto" style="width: 50px; height: 50px;"></div>
            <p class="text-blue-600 font-semibold mt-4 text-lg">Loading academic data...</p>
            <p class="text-gray-500 text-sm mt-2">Fetching session topics and homework assignments</p>
        </div>
    `;
    
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Please sign in to view academic data');
        }
        
        // Get user's children from parent document
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        if (!userDoc.exists) {
            throw new Error('User data not found');
        }
        
        const userData = userDoc.data();
        const studentIdMap = userData.studentIdMap || {};
        
        // Convert to array of student objects
        const students = Object.entries(studentIdMap).map(([studentId, studentData]) => ({
            id: studentId,
            name: studentData.name || 'Unknown Student',
            pending: studentData.pending || false
        }));
        
        // Store globally
        academicsData.studentMap = new Map(students.map(s => [s.id, s]));
        academicsData.selectedStudentId = selectedStudentId;
        academicsData.selectedStudentName = selectedStudentName;
        
        // Create/update student dropdown
        createStudentDropdown(students);
        
        if (students.length === 0) {
            academicsContent.innerHTML = `
                <div class="text-center py-16">
                    <div class="text-6xl mb-6">👨‍👩‍👧‍👦</div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">No Students Linked</h2>
                    <p class="text-gray-600 max-w-2xl mx-auto mb-6">
                        You don't have any students linked to your account yet.
                    </p>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto">
                        <h3 class="font-semibold text-blue-800 mb-2">What to do next?</h3>
                        <ul class="text-left text-blue-700 space-y-2">
                            <li>• Contact your child's tutor to link your account</li>
                            <li>• Make sure the phone number matches your registration</li>
                            <li>• If you just registered, it may take 24 hours for the link to appear</li>
                        </ul>
                        <button onclick="showFeedbackModal()" class="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200">
                            <span class="mr-2">📞</span> Contact Support
                        </button>
                    </div>
                </div>
            `;
            return;
        }
        
        // Determine which students to query
        const studentIdsToQuery = selectedStudentId ? [selectedStudentId] : Object.keys(studentIdMap);
        
        // Query session topics
        const topicsPromises = studentIdsToQuery.map(studentId => 
            db.collection('daily_topics')
                .where('studentId', '==', studentId)
                .orderBy('date', 'desc')
                .get()
        );
        
        // Query homework assignments
        const homeworkPromises = studentIdsToQuery.map(studentId => 
            db.collection('homework_assignments')
                .where('studentId', '==', studentId)
                .orderBy('dueDate', 'asc')
                .get()
        );
        
        // Execute all queries
        const [topicsResults, homeworkResults] = await Promise.all([
            Promise.all(topicsPromises),
            Promise.all(homeworkPromises)
        ]);
        
        // Process topics
        const allTopics = [];
        topicsResults.forEach((snapshot, index) => {
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const topic = doc.data();
                    topic.id = doc.id;
                    topic.studentId = studentIdsToQuery[index];
                    topic.studentName = students.find(s => s.id === studentIdsToQuery[index])?.name || 'Unknown';
                    allTopics.push(topic);
                });
            }
        });
        
        // Process homework
        const allHomework = [];
        homeworkResults.forEach((snapshot, index) => {
            if (!snapshot.empty) {
                snapshot.forEach(doc => {
                    const assignment = doc.data();
                    assignment.id = doc.id;
                    assignment.studentId = studentIdsToQuery[index];
                    assignment.studentName = students.find(s => s.id === studentIdsToQuery[index])?.name || 'Unknown';
                    allHomework.push(assignment);
                });
            }
        });
        
        // Store in global academicsData
        academicsData.topics = allTopics;
        academicsData.homework = allHomework;
        
        // Render the academics content
        renderAcademicsContent(allTopics, allHomework, selectedStudentName);
        
        // Check for new items
        checkForNewAcademics();
        
    } catch (error) {
        console.error('Error loading academics data:', error);
        academicsContent.innerHTML = `
            <div class="text-center py-12">
                <div class="text-4xl mb-4">❌</div>
                <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Academic Data</h3>
                <p class="text-gray-500">Unable to load academic data at this time. Please try again later.</p>
                <button onclick="loadAcademicsData(academicsData.selectedStudentId, academicsData.selectedStudentName)" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200">
                    <span class="mr-2">🔄</span> Retry
                </button>
            </div>
        `;
    }
}

/**
 * Render academics content with topics and homework
 * @param {Array} topics - Array of topic objects
 * @param {Array} homework - Array of homework objects
 * @param {string|null} selectedStudentName - Selected student name
 */
function renderAcademicsContent(topics, homework, selectedStudentName) {
    const academicsContent = document.getElementById('academicsContent');
    if (!academicsContent) return;
    
    // Determine months to display
    const { monthsToDisplay, showPreviousMonth } = getMonthDisplayLogic();
    
    // Group topics by month
    const topicsByMonth = {};
    const filteredTopics = topics.filter(topic => {
        if (!topic.date) return false;
        
        const topicDate = topic.date.toDate ? topic.date.toDate() : new Date(topic.date);
        const topicMonth = topicDate.getMonth() + 1;
        const topicYear = topicDate.getFullYear();
        
        return monthsToDisplay.some(m => 
            m.month === topicMonth && m.year === topicYear
        );
    });
    
    filteredTopics.forEach(topic => {
        const topicDate = topic.date.toDate ? topic.date.toDate() : new Date(topic.date);
        const monthKey = `${topicDate.getFullYear()}-${String(topicDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = topicDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        if (!topicsByMonth[monthKey]) {
            topicsByMonth[monthKey] = {
                monthName: monthName,
                topics: []
            };
        }
        
        topicsByMonth[monthKey].topics.push(topic);
    });
    
    // Sort months by date (newest first)
    const sortedMonths = Object.entries(topicsByMonth)
        .sort(([aKey], [bKey]) => bKey.localeCompare(aKey))
        .map(([_, data]) => data);
    
    // Filter homework (always show overdue, regardless of month)
    const today = new Date();
    const filteredHomework = homework.filter(assignment => {
        // Always show overdue assignments
        if (assignment.dueDate) {
            const dueDate = assignment.dueDate.toDate ? assignment.dueDate.toDate() : new Date(assignment.dueDate);
            if (dueDate < today) return true;
        }
        
        // For non-overdue, apply month filter
        if (!assignment.assignedDate) return true;
        
        const assignedDate = assignment.assignedDate.toDate ? assignment.assignedDate.toDate() : new Date(assignment.assignedDate);
        const assignedMonth = assignedDate.getMonth() + 1;
        const assignedYear = assignedDate.getFullYear();
        
        return monthsToDisplay.some(m => 
            m.month === assignedMonth && m.year === assignedYear
        );
    });
    
    // Group homework by status for better organization
    const overdueHomework = filteredHomework.filter(h => {
        if (!h.dueDate) return false;
        const dueDate = h.dueDate.toDate ? h.dueDate.toDate() : new Date(h.dueDate);
        return dueDate < today && !h.submitted;
    });
    
    const pendingHomework = filteredHomework.filter(h => {
        if (!h.dueDate) return true;
        const dueDate = h.dueDate.toDate ? h.dueDate.toDate() : new Date(h.dueDate);
        return dueDate >= today && !h.submitted;
    });
    
    const submittedHomework = filteredHomework.filter(h => h.submitted);
    
    // Build HTML
    let html = '';
    
    // Header with student info
    html += `
        <div class="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 p-6 rounded-xl shadow-sm">
            <h2 class="text-2xl font-bold text-gray-800 mb-2">Academic Dashboard</h2>
            <div class="flex flex-wrap items-center gap-4">
                <p class="text-gray-600">
                    ${selectedStudentName ? `Showing data for: <span class="font-semibold text-blue-700">${capitalize(selectedStudentName)}</span>` : 'Showing data for all students'}
                </p>
                <span class="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                    ${monthsToDisplay.length > 1 ? 'Showing current & previous month' : 'Showing current month'}
                </span>
                <span class="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-full">
                    ${topics.length} session topics • ${homework.length} homework assignments
                </span>
            </div>
        </div>
    `;
    
    // Session Topics Section (Blue Theme)
    html += `
        <div class="mb-12">
            <div class="flex items-center justify-between bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-t-xl cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all duration-200" 
                 onclick="toggleAcademicsAccordion('sessionTopics')">
                <div class="flex items-center">
                    <span class="text-2xl mr-3">📚</span>
                    <div>
                        <h3 class="text-xl font-bold">Session Topics</h3>
                        <p class="text-blue-100 text-sm">What your child learned in tutoring sessions</p>
                    </div>
                </div>
                <span id="sessionTopics-icon" class="text-xl font-bold">▼</span>
            </div>
            
            <div id="sessionTopics-content" class="bg-white border border-blue-200 rounded-b-xl p-6">
    `;
    
    if (sortedMonths.length === 0) {
        html += `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">📝</div>
                <h3 class="text-xl font-bold text-gray-700 mb-2">No Session Topics Recorded</h3>
                <p class="text-gray-500 max-w-md mx-auto">
                    No session topics have been recorded ${selectedStudentName ? `for ${capitalize(selectedStudentName)}` : 'for your children'} yet.
                    This could mean sessions haven't started or topics haven't been logged.
                </p>
            </div>
        `;
    } else {
        // Create accordion for each month
        sortedMonths.forEach((monthData, monthIndex) => {
            const monthId = `month-${monthIndex}`;
            html += `
                <div class="mb-6 last:mb-0">
                    <div class="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 cursor-pointer hover:bg-blue-100 transition-all duration-200"
                         onclick="toggleAcademicsAccordion('${monthId}')">
                        <div class="flex items-center">
                            <span class="text-blue-600 mr-2">📅</span>
                            <h4 class="font-bold text-blue-800">${monthData.monthName}</h4>
                            <span class="ml-3 text-sm px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                                ${monthData.topics.length} session${monthData.topics.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <span id="${monthId}-icon" class="text-blue-600 font-bold">▼</span>
                    </div>
                    
                    <div id="${monthId}-content" class="hidden pl-4 border-l-2 border-blue-200 ml-4">
            `;
            
            // Group topics by student if showing all students
            const topicsByStudent = {};
            monthData.topics.forEach(topic => {
                if (!topicsByStudent[topic.studentName]) {
                    topicsByStudent[topic.studentName] = [];
                }
                topicsByStudent[topic.studentName].push(topic);
            });
            
            Object.entries(topicsByStudent).forEach(([studentName, studentTopics]) => {
                if (!selectedStudentName) {
                    html += `
                        <div class="mb-4">
                            <h5 class="font-semibold text-gray-700 mb-2 flex items-center">
                                <span class="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                ${capitalize(studentName)}
                            </h5>
                    `;
                }
                
                studentTopics.forEach(topic => {
                    const topicDate = topic.date.toDate ? topic.date.toDate() : new Date(topic.date);
                    const formattedDate = formatDetailedDate(topicDate);
                    
                    html += `
                        <div class="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-white hover:shadow-sm transition-all duration-200">
                            <div class="flex flex-wrap justify-between items-start mb-2">
                                <div class="flex-1">
                                    <div class="flex items-center mb-1">
                                        <span class="text-blue-600 mr-2">📌</span>
                                        <span class="font-medium text-gray-800">${topic.subject || 'General'}</span>
                                        ${topic.studentName && !selectedStudentName ? 
                                            `<span class="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">${capitalize(topic.studentName)}</span>` : ''}
                                    </div>
                                    <p class="text-sm text-gray-500">${formattedDate}</p>
                                </div>
                                ${topic.tutorName ? 
                                    `<span class="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">Tutor: ${topic.tutorName}</span>` : ''}
                            </div>
                            
                            <div class="mt-3">
                                <p class="text-gray-700 whitespace-pre-line bg-white p-3 rounded border">${topic.content || 'No content provided'}</p>
                                ${topic.notes ? `
                                    <div class="mt-2">
                                        <p class="text-sm font-medium text-gray-600 mb-1">Additional Notes:</p>
                                        <p class="text-gray-700 text-sm bg-yellow-50 p-2 rounded border border-yellow-200 whitespace-pre-line">${topic.notes}</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                });
                
                if (!selectedStudentName) {
                    html += `</div>`;
                }
            });
            
            html += `
                    </div>
                </div>
            `;
        });
    }
    
    html += `
            </div>
        </div>
    `;
    
    // Homework Assignments Section (Purple Theme)
    html += `
        <div class="mb-12">
            <div class="flex items-center justify-between bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-t-xl cursor-pointer hover:from-purple-600 hover:to-purple-700 transition-all duration-200" 
                 onclick="toggleAcademicsAccordion('homeworkAssignments')">
                <div class="flex items-center">
                    <span class="text-2xl mr-3">📋</span>
                    <div>
                        <h3 class="text-xl font-bold">Homework Assignments</h3>
                        <p class="text-purple-100 text-sm">Assignments, due dates, and submission status</p>
                    </div>
                </div>
                <span id="homeworkAssignments-icon" class="text-xl font-bold">▼</span>
            </div>
            
            <div id="homeworkAssignments-content" class="bg-white border border-purple-200 rounded-b-xl p-6">
    `;
    
    const totalHomework = filteredHomework.length;
    
    if (totalHomework === 0) {
        html += `
            <div class="text-center py-12">
                <div class="text-6xl mb-4">✏️</div>
                <h3 class="text-xl font-bold text-gray-700 mb-2">No Homework Assignments</h3>
                <p class="text-gray-500 max-w-md mx-auto">
                    No homework assignments have been given ${selectedStudentName ? `to ${capitalize(selectedStudentName)}` : 'to your children'} yet.
                </p>
            </div>
        `;
    } else {
        // Status summary badges
        html += `
            <div class="flex flex-wrap gap-3 mb-6">
                ${overdueHomework.length > 0 ? `
                    <div class="flex items-center bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <span class="text-red-600 mr-2">⏰</span>
                        <span class="font-semibold text-red-700">${overdueHomework.length} Overdue</span>
                    </div>
                ` : ''}
                ${pendingHomework.length > 0 ? `
                    <div class="flex items-center bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        <span class="text-blue-600 mr-2">📝</span>
                        <span class="font-semibold text-blue-700">${pendingHomework.length} Pending</span>
                    </div>
                ` : ''}
                ${submittedHomework.length > 0 ? `
                    <div class="flex items-center bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        <span class="text-green-600 mr-2">✅</span>
                        <span class="font-semibold text-green-700">${submittedHomework.length} Submitted</span>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Overdue Section (if any)
        if (overdueHomework.length > 0) {
            html += `
                <div class="mb-8">
                    <h4 class="text-lg font-bold text-red-700 mb-4 flex items-center">
                        <span class="mr-2">🚨</span> Overdue Assignments (${overdueHomework.length})
                    </h4>
                    <div class="space-y-4">
            `;
            
            overdueHomework.forEach(assignment => {
                html += renderHomeworkAssignment(assignment, selectedStudentName, true);
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Pending Section (if any)
        if (pendingHomework.length > 0) {
            html += `
                <div class="mb-8">
                    <h4 class="text-lg font-bold text-blue-700 mb-4 flex items-center">
                        <span class="mr-2">📅</span> Pending Assignments (${pendingHomework.length})
                    </h4>
                    <div class="space-y-4">
            `;
            
            pendingHomework.forEach(assignment => {
                html += renderHomeworkAssignment(assignment, selectedStudentName, false);
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        // Submitted Section (if any)
        if (submittedHomework.length > 0) {
            html += `
                <div class="mb-8">
                    <h4 class="text-lg font-bold text-green-700 mb-4 flex items-center">
                        <span class="mr-2">✅</span> Submitted Assignments (${submittedHomework.length})
                    </h4>
                    <div class="space-y-4">
            `;
            
            submittedHomework.forEach(assignment => {
                html += renderHomeworkAssignment(assignment, selectedStudentName, false);
            });
            
            html += `
                    </div>
                </div>
            `;
        }
    }
    
    html += `
            </div>
        </div>
    `;
    
    // Notes about display logic
    if (showPreviousMonth) {
        html += `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-8">
                <div class="flex items-start">
                    <span class="text-yellow-600 mr-2 mt-1">ℹ️</span>
                    <div>
                        <p class="font-medium text-yellow-800 mb-1">Display Logic Note</p>
                        <p class="text-yellow-700 text-sm">
                            Because today is the 1st or 2nd of the month, you're seeing data from both the current month and previous month. 
                            Starting tomorrow, you'll only see data from the current month. 
                            <span class="font-semibold">Overdue assignments always show regardless of month.</span>
                        </p>
                    </div>
                </div>
            </div>
        `;
    }
    
    academicsContent.innerHTML = html;
    
    // Initialize all accordions as open
    document.getElementById('sessionTopics-content').classList.remove('hidden');
    document.getElementById('homeworkAssignments-content').classList.remove('hidden');
}

/**
 * Render individual homework assignment
 * @param {Object} assignment - Homework assignment object
 * @param {string|null} selectedStudentName - Selected student name
 * @param {boolean} isOverdue - Whether assignment is overdue
 * @returns {string} HTML string
 */
function renderHomeworkAssignment(assignment, selectedStudentName, isOverdue) {
    const dueDate = assignment.dueDate ? formatDetailedDate(assignment.dueDate) : 'No due date';
    const assignedDate = assignment.assignedDate ? formatDetailedDate(assignment.assignedDate) : 'Date not available';
    
    let html = `
        <div class="border ${isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'} rounded-lg p-4 hover:shadow-sm transition-all duration-200">
            <div class="flex flex-wrap justify-between items-start mb-3">
                <div class="flex-1">
                    <div class="flex items-center flex-wrap gap-2 mb-2">
                        <h5 class="font-bold text-gray-800 text-lg">${assignment.title || 'Untitled Assignment'}</h5>
                        ${getHomeworkStatusTag(assignment)}
                        ${assignment.studentName && !selectedStudentName ? 
                            `<span class="text-sm px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">${capitalize(assignment.studentName)}</span>` : ''}
                    </div>
                    <div class="flex flex-wrap gap-4 text-sm text-gray-600">
                        <div class="flex items-center">
                            <span class="mr-1">📚</span>
                            <span class="font-medium">${assignment.subject || 'General'}</span>
                        </div>
                        <div class="flex items-center">
                            <span class="mr-1">👨‍🏫</span>
                            <span>Tutor: ${assignment.tutorName || 'Not specified'}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="mb-4">
                <p class="text-gray-700 whitespace-pre-line bg-white p-3 rounded border text-sm">${assignment.description || 'No description provided'}</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <p class="text-sm font-medium text-gray-600 mb-1">📅 Assigned Date</p>
                    <p class="text-gray-800">${assignedDate}</p>
                </div>
                <div>
                    <p class="text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-600'} mb-1">⏰ Due Date</p>
                    <p class="${isOverdue ? 'text-red-700 font-semibold' : 'text-gray-800'}">${dueDate}</p>
                </div>
            </div>
    `;
    
    // Grade display if submitted
    if (assignment.submitted && assignment.grade) {
        const gradeColor = getGradeColor(assignment.grade);
        html += `
            <div class="mb-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="font-medium text-green-800 mb-1">Grade Received</p>
                        <p class="text-2xl ${gradeColor}">${assignment.grade}%</p>
                    </div>
                    ${assignment.gradeFeedback ? `
                        <div class="text-sm text-gray-600 max-w-md">
                            <p class="font-medium mb-1">Tutor's Feedback:</p>
                            <p class="whitespace-pre-line">${assignment.gradeFeedback}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    // Action buttons for attachments and submission
    const hasAttachments = assignment.attachmentUrls && assignment.attachmentUrls.length > 0;
    const hasSubmission = assignment.submissionUrls && assignment.submissionUrls.length > 0;
    
    if (hasAttachments || hasSubmission) {
        html += `<div class="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-200">`;
        
        if (hasAttachments) {
            html += `
                <a href="${assignment.attachmentUrls[0]}" target="_blank" 
                   class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200">
                    <span class="mr-2">📎</span> Download Attachment
                </a>
            `;
        }
        
        if (hasSubmission && assignment.submitted) {
            html += `
                <a href="${assignment.submissionUrls[0]}" target="_blank" 
                   class="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200">
                    <span class="mr-2">👁️</span> View Submission
                </a>
            `;
        }
        
        html += `</div>`;
    }
    
    html += `</div>`;
    return html;
}

/**
 * Check for new academics items from the last 7 days
 */
async function checkForNewAcademics() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        if (!userDoc.exists) return;
        
        const userData = userDoc.data();
        const studentIdMap = userData.studentIdMap || {};
        const studentIds = Object.keys(studentIdMap);
        
        if (studentIds.length === 0) return;
        
        // Calculate date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        // Check for new topics
        const topicsPromises = studentIds.map(studentId =>
            db.collection('daily_topics')
                .where('studentId', '==', studentId)
                .where('date', '>=', sevenDaysAgo)
                .get()
        );
        
        // Check for new homework
        const homeworkPromises = studentIds.map(studentId =>
            db.collection('homework_assignments')
                .where('studentId', '==', studentId)
                .where('assignedDate', '>=', sevenDaysAgo)
                .get()
        );
        
        const [topicsResults, homeworkResults] = await Promise.all([
            Promise.all(topicsPromises),
            Promise.all(homeworkPromises)
        ]);
        
        // Count new items
        let newTopicsCount = 0;
        topicsResults.forEach(snapshot => {
            newTopicsCount += snapshot.size;
        });
        
        let newHomeworkCount = 0;
        homeworkResults.forEach(snapshot => {
            newHomeworkCount += snapshot.size;
        });
        
        const totalNewItems = newTopicsCount + newHomeworkCount;
        
        // Update notification badge
        updateAcademicsNotificationBadge(totalNewItems);
        
    } catch (error) {
        console.error('Error checking for new academics:', error);
    }
}

/**
 * Update academics notification badge
 * @param {number} count - Number of new items
 */
function updateAcademicsNotificationBadge(count) {
    // Update the academics tab badge if count > 0
    const academicsTab = document.getElementById('academicsTab');
    if (!academicsTab) return;
    
    let badge = academicsTab.querySelector('.notification-badge');
    
    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'notification-badge absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center font-bold animate-pulse';
            academicsTab.style.position = 'relative';
            academicsTab.appendChild(badge);
        }
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
    } else if (badge) {
        badge.classList.add('hidden');
    }
}

// -------------------------------------------------------------------
// END: ACADEMICS TAB FUNCTIONS
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// START: NEW REFERRAL SYSTEM FUNCTIONS (PHASE 1 & 3)
// -------------------------------------------------------------------

/**
 * Generates a unique, alphanumeric referral code prefixed with 'BKH'.
 * Checks for uniqueness in the parent_users collection.
 * @returns {string} A unique referral code (e.g., BKH7A3X9M)
 */
async function generateReferralCode() {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const prefix = 'BKH';
    let code;
    let isUnique = false;

    while (!isUnique) {
        let suffix = '';
        for (let i = 0; i < 6; i++) {
            suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        code = prefix + suffix;

        // Check uniqueness in Firestore
        const snapshot = await db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
        if (snapshot.empty) {
            isUnique = true;
        }
    }
    return code;
}

/**
 * Loads the parent's referral data for the Rewards Dashboard.
 * @param {string} parentUid The UID of the current parent user.
 */
async function loadReferralRewards(parentUid) {
    const rewardsContent = document.getElementById('rewardsContent');
    if (!rewardsContent) return;
    
    rewardsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading rewards data...</p></div>';

    try {
        // 1. Get the parent's referral code and current earnings
        const userDoc = await db.collection('parent_users').doc(parentUid).get();
        if (!userDoc.exists) {
            rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">User data not found. Please sign in again.</p>';
            return;
        }
        const userData = userDoc.data();
        const referralCode = userData.referralCode || 'N/A';
        const totalEarnings = userData.referralEarnings || 0;
        
        // 2. Query the referral_transactions collection for all transactions belonging to this code owner
        const transactionsSnapshot = await db.collection('referral_transactions')
            .where('ownerUid', '==', parentUid)
            .orderBy('timestamp', 'desc')
            .get();

        let referralsHtml = '';
        let pendingCount = 0;
        let approvedCount = 0;
        let paidCount = 0;

        if (transactionsSnapshot.empty) {
            referralsHtml = `
                <tr><td colspan="4" class="text-center py-4 text-gray-500">No one has used your referral code yet.</td></tr>
            `;
        } else {
            transactionsSnapshot.forEach(doc => {
                const data = doc.data();
                const status = data.status || 'pending';
                const statusColor = status === 'paid' ? 'bg-green-100 text-green-800' : 
                                    status === 'approved' ? 'bg-blue-100 text-blue-800' : 
                                    'bg-yellow-100 text-yellow-800';
                
                if (status === 'pending') pendingCount++;
                if (status === 'approved') approvedCount++;
                if (status === 'paid') paidCount++;

                const referredName = capitalize(data.referredStudentName || data.referredStudentPhone);
                const rewardAmount = data.rewardAmount ? `₦${data.rewardAmount.toLocaleString()}` : '₦5,000';
                const referralDate = data.timestamp?.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) || 'N/A';

                referralsHtml += `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3 text-sm font-medium text-gray-900">${referredName}</td>
                        <td class="px-4 py-3 text-sm text-gray-500">${referralDate}</td>
                        <td class="px-4 py-3 text-sm">
                            <span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}">
                                ${capitalize(status)}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-900 font-bold">${rewardAmount}</td>
                    </tr>
                `;
            });
        }
        
        // Display the dashboard
        rewardsContent.innerHTML = `
            <div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md">
                <h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
                <p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">${referralCode}</p>
                <p class="text-blue-700 mt-2">Share this code with other parents. They use it when registering their child, and you earn **₦5,000** once their child completes their first month!</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-green-100 p-6 rounded-xl shadow-lg border-b-4 border-green-600">
                    <p class="text-sm font-medium text-green-700">Total Earnings</p>
                    <p class="text-3xl font-extrabold text-green-900 mt-1">₦${totalEarnings.toLocaleString()}</p>
                </div>
                <div class="bg-yellow-100 p-6 rounded-xl shadow-lg border-b-4 border-yellow-600">
                    <p class="text-sm font-medium text-yellow-700">Approved Rewards (Awaiting Payment)</p>
                    <p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p>
                </div>
                <div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600">
                    <p class="text-sm font-medium text-gray-700">Total Successful Referrals (Paid)</p>
                    <p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p>
                </div>
            </div>

            <h3 class="text-xl font-bold text-gray-800 mb-4">Referral History</h3>
            <div class="overflow-x-auto bg-white rounded-lg shadow">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referred Parent/Student</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Used</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${referralsHtml}
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading referral rewards:', error);
        rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">An error occurred while loading your rewards data. Please try again later.</p>';
    }
}

// -------------------------------------------------------------------
// END: NEW REFERRAL SYSTEM FUNCTIONS
// -------------------------------------------------------------------

// Remember Me Functionality
function setupRememberMe() {
    const rememberMe = localStorage.getItem('rememberMe');
    const savedEmail = localStorage.getItem('savedEmail');
    
    if (rememberMe === 'true' && savedEmail) {
        document.getElementById('loginIdentifier').value = savedEmail;
        document.getElementById('rememberMe').checked = true;
    }
}

function handleRememberMe() {
    const rememberMe = document.getElementById('rememberMe').checked;
    const identifier = document.getElementById('loginIdentifier').value.trim();
    
    if (rememberMe && identifier) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedEmail', identifier);
    } else {
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedEmail');
    }
}

/**
 * Generates a unique, personalized recommendation using a smart template.
 * It summarizes performance instead of just listing topics.
 * @param {string} studentName The name of the student.
 * @param {string} tutorName The name of the tutor.
 * @param {Array} results The student's test results.
 * @returns {string} A personalized recommendation string.
 */
function generateTemplatedRecommendation(studentName, tutorName, results) {
    const strengths = [];
    const weaknesses = [];
    results.forEach(res => {
        const percentage = res.total > 0 ? (res.correct / res.total) * 100 : 0;
        const topicList = res.topics.length > 0 ? res.topics : [res.subject];
        if (percentage >= 75) {
            strengths.push(...topicList);
        } else if (percentage < 50) {
            weaknesses.push(...topicList);
        }
    });

    const uniqueStrengths = [...new Set(strengths)];
    const uniqueWeaknesses = [...new Set(weaknesses)];

    let praiseClause = "";
    if (uniqueStrengths.length > 2) {
        praiseClause = `It was great to see ${studentName} demonstrate a solid understanding of several key concepts, particularly in areas like ${uniqueStrengths[0]} and ${uniqueStrengths[1]}. `;
    } else if (uniqueStrengths.length > 0) {
        praiseClause = `${studentName} showed strong potential, especially in the topic of ${uniqueStrengths.join(', ')}. `;
    } else {
        praiseClause = `${studentName} has put in a commendable effort on this initial assessment. `;
    }

    let improvementClause = "";
    if (uniqueWeaknesses.length > 2) {
        improvementClause = `Our next step will be to focus on building more confidence in a few areas, such as ${uniqueWeaknesses[0]} and ${uniqueWeaknesses[1]}. `;
    } else if (uniqueWeaknesses.length > 0) {
        improvementClause = `To continue this positive progress, our focus will be on the topic of ${uniqueWeaknesses.join(', ')}. `;
    } else {
        improvementClause = "We will continue to build on these fantastic results and explore more advanced topics. ";
    }

    const closingStatement = `With personalized support from their tutor, ${tutorName}, at Blooming Kids House, we are very confident that ${studentName} will master these skills and unlock their full potential.`;

    return praiseClause + improvementClause + closingStatement;
}

/**
 * Checks if the search name matches the stored name, allowing for extra names added by tutors
 * @param {string} storedName The name stored in the database
 * @param {string} searchName The name entered by the parent
 * @returns {boolean} True if names match (case insensitive and allows extra names)
 */
function nameMatches(storedName, searchName) {
    if (!storedName || !searchName) return false;
    
    const storedLower = storedName.toLowerCase().trim();
    const searchLower = searchName.toLowerCase().trim();
    
    // Exact match
    if (storedLower === searchLower) return true;
    
    // If stored name contains the search name (tutor added extra names)
    if (storedLower.includes(searchLower)) return true;
    
    // If search name contains the stored name (parent entered full name but stored has partial)
    if (searchLower.includes(storedLower)) return true;
    
    // Split into words and check if all search words are in stored name
    const searchWords = searchLower.split(/\s+/).filter(word => word.length > 1);
    const storedWords = storedLower.split(/\s+/);
    
    if (searchWords.length > 0) {
        return searchWords.every(word => storedWords.some(storedWord => storedWord.includes(word)));
    }
    
    return false;
}

// Find parent name from students collection (SAME AS TUTOR.JS)
async function findParentNameFromStudents(parentPhone) {
    try {
        console.log("Searching for parent name with phone:", parentPhone);
        
        // Use multi-normalization to get all possible phone versions
        const normalizedVersions = multiNormalizePhoneNumber(parentPhone);
        const validVersions = normalizedVersions.filter(v => v.valid && v.normalized);
        
        // Search with each normalized version
        for (const version of validVersions) {
            console.log(`🔍 Searching parent name with: ${version.normalized} (${version.attempt})`);

            // PRIMARY SEARCH: students collection
            const studentsSnapshot = await db.collection("students")
                .where("normalizedParentPhone", "==", version.normalized)
                .limit(1)
                .get();

            if (!studentsSnapshot.empty) {
                const studentDoc = studentsSnapshot.docs[0];
                const studentData = studentDoc.data();
                const parentName = studentData.parentName;
                
                if (parentName) {
                    console.log("Found parent name in students collection:", parentName);
                    return parentName;
                }
            }

            // SECONDARY SEARCH: pending_students collection
            const pendingStudentsSnapshot = await db.collection("pending_students")
                .where("normalizedParentPhone", "==", version.normalized)
                .limit(1)
                .get();

            if (!pendingStudentsSnapshot.empty) {
                const pendingStudentDoc = pendingStudentsSnapshot.docs[0];
                const pendingStudentData = pendingStudentDoc.data();
                const parentName = pendingStudentData.parentName;
                
                if (parentName) {
                    console.log("Found parent name in pending_students collection:", parentName);
                    return parentName;
                }
            }

            // FALLBACK SEARCH: original phone fields
            const fallbackStudentsSnapshot = await db.collection("students")
                .where("parentPhone", "==", version.normalized)
                .limit(1)
                .get();

            if (!fallbackStudentsSnapshot.empty) {
                const studentDoc = fallbackStudentsSnapshot.docs[0];
                const studentData = studentDoc.data();
                const parentName = studentData.parentName;
                
                if (parentName) {
                    console.log("Found parent name in students collection (fallback):", parentName);
                    return parentName;
                }
            }
        }

        console.log("No parent name found in any collection with any normalization");
        return null;
    } catch (error) {
        console.error("Error finding parent name:", error);
        return null;
    }
}

// Authentication Functions
async function handleSignUp() {
    const countryCode = document.getElementById('countryCode').value;
    const localPhone = document.getElementById('signupPhone').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    // Validation
    if (!countryCode || !localPhone || !email || !password || !confirmPassword) {
        showMessage('Please fill in all fields including country code', 'error');
        return;
    }

    if (password.length < 6) {
        showMessage('Password must be at least 6 characters', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showMessage('Passwords do not match', 'error');
        return;
    }

    // Combine country code with local phone number
    const fullPhoneNumber = countryCode + localPhone.replace(/\D/g, '');
    
    // Use multi-normalization for phone validation
    const phoneValidations = multiNormalizePhoneNumber(fullPhoneNumber);
    const validVersions = phoneValidations.filter(v => v.valid && v.normalized);
    
    if (validVersions.length === 0) {
        showMessage('Invalid phone number format. Please check your phone number.', 'error');
        return;
    }

    // Use the first valid normalized version
    const normalizedPhone = validVersions[0].normalized;

    const signUpBtn = document.getElementById('signUpBtn');
    const authLoader = document.getElementById('authLoader');

    signUpBtn.disabled = true;
    document.getElementById('signUpText').textContent = 'Creating Account...';
    document.getElementById('signUpSpinner').classList.remove('hidden');
    authLoader.classList.remove('hidden');

    try {
        // Create user with email and password
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Find parent name from existing data (SAME SOURCE AS TUTOR.JS)
        const parentName = await findParentNameFromStudents(normalizedPhone);
        
        // Generate referral code
        const referralCode = await generateReferralCode();

        // Store user data in Firestore for easy retrieval
        await db.collection('parent_users').doc(user.uid).set({
            phone: fullPhoneNumber, // Store full number with country code
            normalizedPhone: normalizedPhone, // Store normalized version
            countryCode: countryCode, // Store selected country code
            localPhone: localPhone, // Store local number part
            email: email,
            parentName: parentName || 'Parent',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            referralCode: referralCode,
            referralEarnings: 0,
            studentIdMap: {} // Initialize empty student map
        });

        showMessage('Account created successfully!', 'success');
        
        // Automatically load reports after signup
        await loadAllReportsForParent(normalizedPhone, user.uid);

    } catch (error) {
        console.error('Sign up error:', error);
        let errorMessage = 'Account creation failed. ';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage += 'Email address is already in use.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Email address is invalid.';
                break;
            case 'auth/weak-password':
                errorMessage += 'Password is too weak.';
                break;
            default:
                errorMessage += 'Please try again.';
        }
        
        showMessage(errorMessage, 'error');
    } finally {
        signUpBtn.disabled = false;
        document.getElementById('signUpText').textContent = 'Create Account';
        document.getElementById('signUpSpinner').classList.add('hidden');
        authLoader.classList.add('hidden');
    }
}

async function handleSignIn() {
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!identifier || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }

    const signInBtn = document.getElementById('signInBtn');
    const authLoader = document.getElementById('authLoader');

    signInBtn.disabled = true;
    document.getElementById('signInText').textContent = 'Signing In...';
    document.getElementById('signInSpinner').classList.remove('hidden');
    authLoader.classList.remove('hidden');

    try {
        let userCredential;
        let userPhone;
        let userId;
        let normalizedPhone;
        
        // Determine if identifier is email or phone
        if (identifier.includes('@')) {
            // Sign in with email
            userCredential = await auth.signInWithEmailAndPassword(identifier, password);
            userId = userCredential.user.uid;
            // Get phone from user profile
            const userDoc = await db.collection('parent_users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                userPhone = userData.phone;
                normalizedPhone = userData.normalizedPhone;
            }
        } else {
            // Sign in with phone - use multi-normalization
            const phoneValidations = multiNormalizePhoneNumber(identifier);
            const validVersions = phoneValidations.filter(v => v.valid && v.normalized);
            
            if (validVersions.length === 0) {
                throw new Error(`Invalid phone number format. Please try with country code (like +1234567890) or local format`);
            }
            
            normalizedPhone = validVersions[0].normalized;
            
            // Find user by any normalized phone version
            let userFound = false;
            for (const version of validVersions) {
                const userQuery = await db.collection('parent_users')
                    .where('normalizedPhone', '==', version.normalized)
                    .limit(1)
                    .get();

                if (!userQuery.empty) {
                    const userData = userQuery.docs[0].data();
                    userCredential = await auth.signInWithEmailAndPassword(userData.email, password);
                    userPhone = userData.phone;
                    userId = userCredential.user.uid;
                    userFound = true;
                    break;
                }
            }

            if (!userFound) {
                // Fallback: search by original phone field
                const fallbackQuery = await db.collection('parent_users')
                    .where('phone', '==', identifier)
                    .limit(1)
                    .get();
                    
                if (fallbackQuery.empty) {
                    throw new Error('No account found with this phone number');
                }
                
                const userData = fallbackQuery.docs[0].data();
                userCredential = await auth.signInWithEmailAndPassword(userData.email, password);
                userPhone = identifier;
                userId = userCredential.user.uid;
            }
        }

        if (!normalizedPhone && userPhone) {
            // Normalize the phone if we have it
            const phoneValidations = multiNormalizePhoneNumber(userPhone);
            const validVersions = phoneValidations.filter(v => v.valid && v.normalized);
            if (validVersions.length > 0) {
                normalizedPhone = validVersions[0].normalized;
            }
        }

        if (!normalizedPhone) {
            throw new Error('Could not retrieve valid phone number for user');
        }
        
        // Handle Remember Me
        handleRememberMe();
        
        // Load all reports for the parent using the normalized phone number
        await loadAllReportsForParent(normalizedPhone, userId);

    } catch (error) {
        console.error('Sign in error:', error);
        let errorMessage = 'Sign in failed. ';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage += 'No account found with these credentials.';
                break;
            case 'auth/wrong-password':
                errorMessage += 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email format.';
                break;
            default:
                errorMessage += error.message || 'Please check your credentials and try again.';
        }
        
        showMessage(errorMessage, 'error');
    } finally {
        signInBtn.disabled = false;
        document.getElementById('signInText').textContent = 'Sign In';
        document.getElementById('signInSpinner').classList.add('hidden');
        authLoader.classList.add('hidden');
    }
}

async function handlePasswordReset() {
    const email = document.getElementById('resetEmail').value.trim();
    
    if (!email) {
        showMessage('Please enter your email address', 'error');
        return;
    }

    const sendResetBtn = document.getElementById('sendResetBtn');
    const resetLoader = document.getElementById('resetLoader');

    sendResetBtn.disabled = true;
    resetLoader.classList.remove('hidden');

    try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Password reset link sent to your email. Please check your inbox.', 'success');
        document.getElementById('passwordResetModal').classList.add('hidden');
    } catch (error) {
        console.error('Password reset error:', error);
        let errorMessage = 'Failed to send reset email. ';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage += 'No account found with this email address.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email address.';
                break;
            default:
                errorMessage += 'Please try again.';
        }
        
        showMessage(errorMessage, 'error');
    } finally {
        sendResetBtn.disabled = false;
        resetLoader.classList.add('hidden');
    }
}

// Feedback System Functions
function showFeedbackModal() {
    populateStudentDropdown();
    document.getElementById('feedbackModal').classList.remove('hidden');
}

function hideFeedbackModal() {
    document.getElementById('feedbackModal').classList.add('hidden');
    // Reset form
    document.getElementById('feedbackCategory').value = '';
    document.getElementById('feedbackPriority').value = '';
    document.getElementById('feedbackStudent').value = '';
    document.getElementById('feedbackMessage').value = '';
}

function populateStudentDropdown() {
    const studentDropdown = document.getElementById('feedbackStudent');
    studentDropdown.innerHTML = '<option value="">Select student</option>';
    
    // Get student names from the report headers that are already displayed
    const studentHeaders = document.querySelectorAll('[class*="bg-green-100"] h2');
    
    if (studentHeaders.length === 0) {
        studentDropdown.innerHTML += '<option value="" disabled>No students found - please wait for reports to load</option>';
        return;
    }

    studentHeaders.forEach(header => {
        const studentName = header.textContent.trim();
        const option = document.createElement('option');
        option.value = studentName;
        option.textContent = studentName;
        studentDropdown.appendChild(option);
    });
}

async function submitFeedback() {
    const category = document.getElementById('feedbackCategory').value;
    const priority = document.getElementById('feedbackPriority').value;
    const student = document.getElementById('feedbackStudent').value;
    const message = document.getElementById('feedbackMessage').value;

    // Validation
    if (!category || !priority || !student || !message) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }

    if (message.length < 10) {
        showMessage('Please provide a more detailed message (at least 10 characters)', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitFeedbackBtn');
    submitBtn.disabled = true;
    document.getElementById('submitFeedbackText').textContent = 'Submitting...';
    document.getElementById('submitFeedbackSpinner').classList.remove('hidden');

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Please sign in to submit feedback');
        }

        // Get user data
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        const userData = userDoc.data();

        // Create feedback document
        const feedbackData = {
            parentName: currentUserData?.parentName || userData.parentName || 'Unknown Parent',
            parentPhone: userData.phone,
            parentEmail: userData.email,
            studentName: student,
            category: category,
            priority: priority,
            message: message,
            status: 'New',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            emailSent: false,
            parentUid: user.uid, // Add parent UID for querying responses
            responses: [] // Initialize empty responses array
        };

        // Save to Firestore
        await db.collection('parent_feedback').add(feedbackData);

        showMessage('Thank you! Your feedback has been submitted successfully. We will respond within 24-48 hours.', 'success');
        
        // Close modal and reset form
        hideFeedbackModal();

    } catch (error) {
        console.error('Feedback submission error:', error);
        showMessage('Failed to submit feedback. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        document.getElementById('submitFeedbackText').textContent = 'Submit Feedback';
        document.getElementById('submitFeedbackSpinner').classList.add('hidden');
    }
}

// Admin Responses Functions with Notification Counter
function showResponsesModal() {
    document.getElementById('responsesModal').classList.remove('hidden');
    loadAdminResponses();
    // Reset notification count when user views responses
    resetNotificationCount();
}

function hideResponsesModal() {
    document.getElementById('responsesModal').classList.add('hidden');
}

async function loadAdminResponses() {
    const responsesContent = document.getElementById('responsesContent');
    responsesContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading responses...</p></div>';

    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error('Please sign in to view responses');
        }

        // Query feedback where parentUid matches current user AND responses array exists and is not empty
        const feedbackSnapshot = await db.collection('parent_feedback')
            .where('parentUid', '==', user.uid)
            .get();

        if (feedbackSnapshot.empty) {
            responsesContent.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📭</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Responses Yet</h3>
                    <p class="text-gray-500 max-w-md mx-auto">You haven't received any responses from our staff yet. We'll respond to your feedback within 24-48 hours.</p>
                </div>
            `;
            return;
        }

        // Filter feedback that has responses
        const feedbackWithResponses = [];
        feedbackSnapshot.forEach(doc => {
            const feedback = { id: doc.id, ...doc.data() };
            if (feedback.responses && feedback.responses.length > 0) {
                feedbackWithResponses.push(feedback);
            }
        });

        if (feedbackWithResponses.length === 0) {
            responsesContent.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-6xl mb-4">📭</div>
                    <h3 class="text-xl font-bold text-gray-700 mb-2">No Responses Yet</h3>
                    <p class="text-gray-500 max-w-md mx-auto">You haven't received any responses from our staff yet. We'll respond to your feedback within 24-48 hours.</p>
                </div>
            `;
            return;
        }

        // Sort by most recent response
        feedbackWithResponses.sort((a, b) => {
            const aDate = a.responses[0]?.responseDate?.toDate() || new Date(0);
            const bDate = b.responses[0]?.responseDate?.toDate() || new Date(0);
            return bDate - aDate;
        });

        responsesContent.innerHTML = '';

        feedbackWithResponses.forEach((feedback) => {
            feedback.responses.forEach((response, index) => {
                const responseDate = response.responseDate?.toDate() || feedback.timestamp?.toDate() || new Date();
                const formattedDate = responseDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const responseElement = document.createElement('div');
                responseElement.className = 'bg-white border border-gray-200 rounded-xl p-6 mb-4';
                responseElement.innerHTML = `
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex flex-wrap gap-2">
                            <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${getCategoryColor(feedback.category)}">
                                ${feedback.category}
                            </span>
                            <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${getPriorityColor(feedback.priority)}">
                                ${feedback.priority} Priority
                            </span>
                        </div>
                        <span class="text-sm text-gray-500">${formattedDate}</span>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="font-semibold text-gray-800 mb-2">Regarding: ${feedback.studentName}</h4>
                        <p class="text-gray-700 bg-gray-50 p-4 rounded-lg border">${feedback.message}</p>
                    </div>
                    
                    <div class="response-bubble">
                        <div class="response-header">📨 Response from ${response.responderName || 'Admin'}:</div>
                        <p class="text-gray-700 mt-2">${response.responseText}</p>
                        <div class="text-sm text-gray-500 mt-2">
                            Responded by: ${response.responderName || 'Admin Staff'} 
                            ${response.responderEmail ? `(${response.responderEmail})` : ''}
                        </div>
                    </div>
                `;

                responsesContent.appendChild(responseElement);
            });
        });

    } catch (error) {
        console.error('Error loading responses:', error);
        responsesContent.innerHTML = `
            <div class="text-center py-8">
                <div class="text-4xl mb-4">❌</div>
                <h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Responses</h3>
                <p class="text-gray-500">Unable to load responses at this time. Please try again later.</p>
            </div>
        `;
    }
}

// Notification System for Responses
async function checkForNewResponses() {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const feedbackSnapshot = await db.collection('parent_feedback')
            .where('parentUid', '==', user.uid)
            .get();

        let totalResponses = 0;
        
        feedbackSnapshot.forEach(doc => {
            const feedback = doc.data();
            if (feedback.responses && feedback.responses.length > 0) {
                totalResponses += feedback.responses.length;
            }
        });

        // Update notification badge
        updateNotificationBadge(totalResponses > 0 ? totalResponses : 0);
        
        // Store for later use
        unreadResponsesCount = totalResponses;

    } catch (error) {
        console.error('Error checking for new responses:', error);
    }
}

function updateNotificationBadge(count) {
    let badge = document.getElementById('responseNotificationBadge');
    const viewResponsesBtn = document.getElementById('viewResponsesBtn');
    
    if (!viewResponsesBtn) return;
    
    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'responseNotificationBadge';
        badge.className = 'absolute -top-2 -right-2 bg-red-500 text-white rounded-full text-xs w-6 h-6 flex items-center justify-center font-bold animate-pulse';
        viewResponsesBtn.style.position = 'relative';
        viewResponsesBtn.appendChild(badge);
    }
    
    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

function resetNotificationCount() {
    // When user views responses, mark them as read and reset counter
    updateNotificationBadge(0);
    unreadResponsesCount = 0;
}

function getCategoryColor(category) {
    const colors = {
        'Feedback': 'bg-blue-100 text-blue-800',
        'Request': 'bg-green-100 text-green-800',
        'Complaint': 'bg-red-100 text-red-800',
        'Suggestion': 'bg-purple-100 text-purple-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
}

function getPriorityColor(priority) {
    const colors = {
        'Low': 'bg-gray-100 text-gray-800',
        'Medium': 'bg-yellow-100 text-yellow-800',
        'High': 'bg-orange-100 text-orange-800',
        'Urgent': 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
}

// Add View Responses button to the welcome section with notification badge
function addViewResponsesButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer) return;
    
    // Check if button already exists
    if (document.getElementById('viewResponsesBtn')) return;
    
    const viewResponsesBtn = document.createElement('button');
    viewResponsesBtn.id = 'viewResponsesBtn';
    viewResponsesBtn.onclick = showResponsesModal;
    viewResponsesBtn.className = 'bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 btn-glow flex items-center justify-center relative';
    viewResponsesBtn.innerHTML = '<span class="mr-2">📨</span> View Responses';
    
    // Insert before the logout button
    buttonContainer.insertBefore(viewResponsesBtn, buttonContainer.lastElementChild);
    
    // Check for responses to show notification
    setTimeout(() => {
        checkForNewResponses();
    }, 1000);
}

// ENHANCED MULTI-LAYER SEARCH SYSTEM FOR ALL COUNTRIES
async function performMultiLayerSearch(parentPhone, parentEmail, userId) {
    console.log("🔍 Starting multi-layer search for:", parentPhone);
    
    let assessmentResults = [];
    let monthlyResults = [];
    
    try {
        // Get multiple normalized versions of the phone number
        const normalizedVersions = multiNormalizePhoneNumber(parentPhone);
        const validVersions = normalizedVersions.filter(v => v.valid && v.normalized);
        
        console.log(`🎯 Searching with ${validVersions.length} normalized versions:`, validVersions.map(v => v.normalized));

        // --- ASSESSMENT REPORTS SEARCH ---
        for (const version of validVersions) {
            console.log(`📊 ASSESSMENT SEARCH - Attempt with: ${version.normalized} (${version.attempt})`);
            
            // Layer 1: Normalized phone search
            let assessmentSnapshot = await db.collection("student_results")
                .where("normalizedParentPhone", "==", version.normalized)
                .get();
            
            if (!assessmentSnapshot.empty) {
                console.log(`✅ Assessment FOUND with version: ${version.normalized}`);
                assessmentSnapshot.forEach(doc => {
                    const data = doc.data();
                    // Check if we already have this result to avoid duplicates
                    if (!assessmentResults.some(r => r.id === doc.id)) {
                        assessmentResults.push({ 
                            id: doc.id,
                            ...data,
                            timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                            type: 'assessment',
                            foundWith: version.normalized
                        });
                    }
                });
                break; // Stop searching if we found results
            }
        }

        // If no results from normalized search, try original fields
        if (assessmentResults.length === 0) {
            console.log("📊 ASSESSMENT SEARCH - Layer 2: Original phone fields");
            for (const version of validVersions) {
                let assessmentSnapshot = await db.collection("student_results")
                    .where("parentPhone", "==", version.normalized)
                    .get();
                
                if (!assessmentSnapshot.empty) {
                    console.log(`✅ Assessment FOUND in original fields with: ${version.normalized}`);
                    assessmentSnapshot.forEach(doc => {
                        const data = doc.data();
                        if (!assessmentResults.some(r => r.id === doc.id)) {
                            assessmentResults.push({ 
                                id: doc.id,
                                ...data,
                                timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                                type: 'assessment',
                                foundWith: version.normalized
                            });
                        }
                    });
                    break;
                }
            }
        }

        // If still no results, try email search
        if (assessmentResults.length === 0 && parentEmail) {
            console.log("📊 ASSESSMENT SEARCH - Layer 3: Email search");
            let assessmentSnapshot = await db.collection("student_results")
                .where("parentEmail", "==", parentEmail)
                .get();
            
            if (!assessmentSnapshot.empty) {
                console.log("✅ Assessment FOUND with email");
                assessmentSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (!assessmentResults.some(r => r.id === doc.id)) {
                        assessmentResults.push({ 
                            id: doc.id,
                            ...data,
                            timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                            type: 'assessment',
                            foundWith: 'email'
                        });
                    }
                });
            }
        }

        // --- MONTHLY REPORTS SEARCH ---
        for (const version of validVersions) {
            console.log(`📈 MONTHLY REPORTS SEARCH - Attempt with: ${version.normalized} (${version.attempt})`);
            
            // Layer 1: Normalized phone search
            let monthlySnapshot = await db.collection("tutor_submissions")
                .where("normalizedParentPhone", "==", version.normalized)
                .get();
            
            if (!monthlySnapshot.empty) {
                console.log(`✅ Monthly reports FOUND with version: ${version.normalized}`);
                monthlySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (!monthlyResults.some(r => r.id === doc.id)) {
                        monthlyResults.push({ 
                            id: doc.id,
                            ...data,
                            timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                            type: 'monthly',
                            foundWith: version.normalized
                        });
                    }
                });
                break;
            }
        }

        // If no results from normalized search, try original fields
        if (monthlyResults.length === 0) {
            console.log("📈 MONTHLY REPORTS SEARCH - Layer 2: Original phone fields");
            for (const version of validVersions) {
                let monthlySnapshot = await db.collection("tutor_submissions")
                    .where("parentPhone", "==", version.normalized)
                    .get();
                
                if (!monthlySnapshot.empty) {
                    console.log(`✅ Monthly reports FOUND in original fields with: ${version.normalized}`);
                    monthlySnapshot.forEach(doc => {
                        const data = doc.data();
                        if (!monthlyResults.some(r => r.id === doc.id)) {
                            monthlyResults.push({ 
                                id: doc.id,
                                ...data,
                                timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                                type: 'monthly',
                                foundWith: version.normalized
                            });
                        }
                    });
                    break;
                }
            }
        }

        // If still no results, try email search
        if (monthlyResults.length === 0 && parentEmail) {
            console.log("📈 MONTHLY REPORTS SEARCH - Layer 3: Email search");
            let monthlySnapshot = await db.collection("tutor_submissions")
                .where("parentEmail", "==", parentEmail)
                .get();
            
            if (!monthlySnapshot.empty) {
                console.log("✅ Monthly reports FOUND with email");
                monthlySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (!monthlyResults.some(r => r.id === doc.id)) {
                        monthlyResults.push({ 
                            id: doc.id,
                            ...data,
                            timestamp: data.submittedAt?.seconds || Date.now() / 1000,
                            type: 'monthly',
                            foundWith: 'email'
                        });
                    }
                });
            }
        }

        console.log("🎯 SEARCH SUMMARY - Assessments:", assessmentResults.length, "Monthly:", monthlyResults.length);
        
    } catch (error) {
        console.error("❌ Error during multi-layer search:", error);
    }
    
    return { assessmentResults, monthlyResults };
}

// HYBRID REAL-TIME MONITORING SYSTEM
function setupRealTimeMonitoring(parentPhone, parentEmail, userId) {
    // Clear any existing listeners
    cleanupRealTimeListeners();
    
    console.log("🔍 Setting up real-time monitoring for:", parentPhone);
    
    // Get normalized phone versions for monitoring
    const normalizedVersions = multiNormalizePhoneNumber(parentPhone);
    const validVersions = normalizedVersions.filter(v => v.valid && v.normalized);
    
    // Monitor assessment reports
    validVersions.forEach(version => {
        const assessmentListener = db.collection("student_results")
            .where("normalizedParentPhone", "==", version.normalized)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        console.log("🆕 NEW ASSESSMENT REPORT DETECTED!");
                        showNewReportNotification('assessment');
                        // Reload reports after a short delay
                        setTimeout(() => {
                            loadAllReportsForParent(parentPhone, userId);
                        }, 2000);
                    }
                });
            });
        realTimeListeners.push(assessmentListener);
    });
    
    // Monitor monthly reports
    validVersions.forEach(version => {
        const monthlyListener = db.collection("tutor_submissions")
            .where("normalizedParentPhone", "==", version.normalized)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        console.log("🆕 NEW MONTHLY REPORT DETECTED!");
                        showNewReportNotification('monthly');
                        // Reload reports after a short delay
                        setTimeout(() => {
                            loadAllReportsForParent(parentPhone, userId);
                        }, 2000);
                    }
                });
            });
        realTimeListeners.push(monthlyListener);
    });
    
    // Also monitor by email if available
    if (parentEmail) {
        const emailAssessmentListener = db.collection("student_results")
            .where("parentEmail", "==", parentEmail)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        console.log("🆕 NEW ASSESSMENT REPORT DETECTED VIA EMAIL!");
                        showNewReportNotification('assessment');
                        setTimeout(() => {
                            loadAllReportsForParent(parentPhone, userId);
                        }, 2000);
                    }
                });
            });
        realTimeListeners.push(emailAssessmentListener);
        
        const emailMonthlyListener = db.collection("tutor_submissions")
            .where("parentEmail", "==", parentEmail)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        console.log("🆕 NEW MONTHLY REPORT DETECTED VIA EMAIL!");
                        showNewReportNotification('monthly');
                        setTimeout(() => {
                            loadAllReportsForParent(parentPhone, userId);
                        }, 2000);
                    }
                });
            });
        realTimeListeners.push(emailMonthlyListener);
    }
    
    // Monitor academics data (session topics and homework)
    const user = auth.currentUser;
    if (user) {
        // Monitor student mapping changes
        const studentMapListener = db.collection('parent_users').doc(user.uid)
            .onSnapshot((doc) => {
                if (doc.exists) {
                    const userData = doc.data();
                    const studentIdMap = userData.studentIdMap || {};
                    
                    // Check if student mapping has changed
                    const currentStudentIds = Array.from(academicsData.studentMap.keys());
                    const newStudentIds = Object.keys(studentIdMap);
                    
                    if (JSON.stringify(currentStudentIds.sort()) !== JSON.stringify(newStudentIds.sort())) {
                        console.log("🆕 STUDENT MAPPING CHANGED DETECTED!");
                        // Reload academics data
                        loadAcademicsData(academicsData.selectedStudentId, academicsData.selectedStudentName);
                    }
                }
            });
        realTimeListeners.push(studentMapListener);
    }
}

function cleanupRealTimeListeners() {
    realTimeListeners.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
            unsubscribe();
        }
    });
    realTimeListeners = [];
    console.log("🧹 Cleaned up real-time listeners");
}

function showNewReportNotification(type) {
    const reportType = type === 'assessment' ? 'Assessment Report' : 'Monthly Report';
    showMessage(`New ${reportType} available! Loading now...`, 'success');
    
    // Add a visual indicator in the UI
    const existingIndicator = document.getElementById('newReportIndicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    const indicator = document.createElement('div');
    indicator.id = 'newReportIndicator';
    indicator.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-pulse';
    indicator.innerHTML = `📄 New ${reportType} Available!`;
    document.body.appendChild(indicator);
    
    // Remove after 5 seconds
    setTimeout(() => {
        indicator.remove();
    }, 5000);
}

// MANUAL REFRESH FUNCTION
async function manualRefreshReports() {
    const user = auth.currentUser;
    if (!user) return;
    
    const refreshBtn = document.getElementById('manualRefreshBtn');
    const originalText = refreshBtn.innerHTML;
    
    // Show loading state
    refreshBtn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Checking...';
    refreshBtn.disabled = true;
    
    try {
        // Get user data
        const userDoc = await db.collection('parent_users').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const userPhone = userData.normalizedPhone || userData.phone;
            
            // Force reload reports (bypass cache)
            await loadAllReportsForParent(userPhone, user.uid, true);
            
            showMessage('Reports refreshed successfully!', 'success');
        }
    } catch (error) {
        console.error('Manual refresh error:', error);
        showMessage('Refresh failed. Please try again.', 'error');
    } finally {
        // Restore button state
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    }
}

// ADD MANUAL REFRESH BUTTON TO WELCOME SECTION
function addManualRefreshButton() {
    const welcomeSection = document.querySelector('.bg-green-50');
    if (!welcomeSection) return;
    
    const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
    if (!buttonContainer) return;
    
    // Check if button already exists
    if (document.getElementById('manualRefreshBtn')) return;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'manualRefreshBtn';
    refreshBtn.onclick = manualRefreshReports;
    refreshBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 btn-glow flex items-center justify-center';
    refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Check for New Reports';
    
    // Insert before the logout button
    buttonContainer.insertBefore(refreshBtn, buttonContainer.lastElementChild);
}

// MAIN REPORT LOADING FUNCTION - UPDATED WITH HYBRID SYSTEM
async function loadAllReportsForParent(parentPhone, userId, forceRefresh = false) {
    const reportArea = document.getElementById("reportArea");
    const reportContent = document.getElementById("reportContent");
    const authArea = document.getElementById("authArea");
    const authLoader = document.getElementById("authLoader");
    const welcomeMessage = document.getElementById("welcomeMessage");

    authLoader.classList.remove("hidden");

    try {
        // --- CACHE IMPLEMENTATION (skip if force refresh) ---
        const cacheKey = `reportCache_${parentPhone}`;
        const twoWeeksInMillis = 14 * 24 * 60 * 60 * 1000;
        
        if (!forceRefresh) {
            try {
                const cachedItem = localStorage.getItem(cacheKey);
                if (cachedItem) {
                    const { timestamp, html, chartConfigs, userData } = JSON.parse(cachedItem);
                    if (Date.now() - timestamp < twoWeeksInMillis) {
                        console.log("Loading reports from cache.");
                        reportContent.innerHTML = html;
                        
                        // Set welcome message from cache
                        if (userData && userData.parentName) {
                            welcomeMessage.textContent = `Welcome, ${userData.parentName}!`;
                            currentUserData = userData;
                        } else {
                            welcomeMessage.textContent = `Welcome!`;
                        }
                        
                        // Re-initialize charts from cached configuration
                        if (chartConfigs && chartConfigs.length > 0) {
                            setTimeout(() => {
                                chartConfigs.forEach(chart => {
                                    const ctx = document.getElementById(chart.canvasId);
                                    if (ctx) new Chart(ctx, chart.config);
                                });
                            }, 0);
                        }

                        authArea.classList.add("hidden");
                        reportArea.classList.remove("hidden");
                        
                        // Add buttons to welcome section
                        addViewResponsesButton();
                        addManualRefreshButton();
                        
                        // Setup real-time monitoring
                        const userDoc = await db.collection('parent_users').doc(userId).get();
                        const userData = userDoc.data();
                        setupRealTimeMonitoring(parentPhone, userData.email, userId);
                        
                        // Load initial referral data
                        loadReferralRewards(userId);
                        
                        // Load initial academics data
                        loadAcademicsData();

                        return;
                    }
                }
            } catch (e) {
                console.error("Could not read from cache:", e);
                localStorage.removeItem(cacheKey);
            }
        }
        // --- END CACHE IMPLEMENTATION ---

        // FIND PARENT NAME FROM SAME SOURCES AS TUTOR.JS
        let parentName = await findParentNameFromStudents(parentPhone);
        
        // Get parent's email and latest user data from their account document
        const userDocRef = db.collection('parent_users').doc(userId);
        let userDoc = await userDocRef.get();
        let userData = userDoc.data();
        const parentEmail = userData.email;

        // --- START: REFERRAL CODE CHECK/GENERATION FOR EXISTING USERS (FIX) ---
        if (!userData.referralCode) {
            console.log("Existing user detected without a referral code. Generating and assigning now.");
            try {
                const newReferralCode = await generateReferralCode();
                await userDocRef.update({
                    referralCode: newReferralCode,
                    referralEarnings: userData.referralEarnings || 0 // Initialize if missing
                });
                
                // Re-fetch updated user data
                userDoc = await userDocRef.get();
                userData = userDoc.data();
                console.log("Referral code assigned successfully:", newReferralCode);
                
            } catch (error) {
                console.error('Error auto-assigning referral code:', error);
                // Non-critical failure, continue loading reports
            }
        }
        // --- END: REFERRAL CODE CHECK/GENERATION FOR EXISTING USERS (FIX) ---

        // If not found in students collections, use name from user document
        if (!parentName && userId) {
            if (userDoc.exists) {
                parentName = userData.parentName;
            }
        }

        // Final fallback
        if (!parentName) {
            parentName = 'Parent';
        }

        // Store user data globally
        currentUserData = {
            parentName: parentName,
            parentPhone: parentPhone
        };

        // UPDATE WELCOME MESSAGE WITH PARENT NAME
        welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;

        // Update parent name in user document if we found a better one
        if (userId && parentName && parentName !== 'Parent' && userData.parentName !== parentName) {
            try {
                await userDocRef.update({
                    parentName: parentName
                });
            } catch (error) {
                console.error('Error updating parent name:', error);
            }
        }

        console.log("🔍 Starting enhanced multi-layer search for:", parentPhone);

        // --- USE ENHANCED MULTI-LAYER SEARCH SYSTEM ---
        const { assessmentResults, monthlyResults } = await performMultiLayerSearch(parentPhone, parentEmail, userId);

        // SETUP REAL-TIME MONITORING (whether reports exist or not)
        setupRealTimeMonitoring(parentPhone, parentEmail, userId);

        if (assessmentResults.length === 0 && monthlyResults.length === 0) {
            // NO REPORTS FOUND - SHOW WAITING STATE
            reportContent.innerHTML = `
                <div class="text-center py-16">
                    <div class="text-6xl mb-6">📊</div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-4">Waiting for Your Child's First Report</h2>
                    <p class="text-gray-600 max-w-2xl mx-auto mb-6">
                        No reports found for your account yet. This usually means:
                    </p>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-2xl mx-auto mb-6">
                        <ul class="text-left text-gray-700 space-y-3">
                            <li>• Your child's tutor hasn't submitted their first assessment or monthly report yet</li>
                            <li>• The phone number/email used doesn't match what the tutor has on file</li>
                            <li>• Reports are being processed and will appear soon</li>
                        </ul>
                    </div>
                    <div class="bg-green-50 border border-green-200 rounded-lg p-6 max-w-2xl mx-auto">
                        <h3 class="font-semibold text-green-800 mb-2">What happens next?</h3>
                        <p class="text-green-700 mb-4">
                            <strong>We're automatically monitoring for new reports!</strong> When your child's tutor submits 
                            their first report, it will appear here automatically. You don't need to do anything.
                        </p>
                        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <button onclick="manualRefreshReports()" class="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 flex items-center">
                                <span class="mr-2">🔄</span> Check Now
                            </button>
                            <button onclick="showFeedbackModal()" class="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all duration-200 flex items-center">
                                <span class="mr-2">💬</span> Contact Support
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            authArea.classList.add("hidden");
            reportArea.classList.remove("hidden");
            
            // Add buttons to welcome section
            addViewResponsesButton();
            addManualRefreshButton();
            
            // Load initial referral data for the rewards dashboard tab even if no reports
            loadReferralRewards(userId);
            
            // Load initial academics data
            loadAcademicsData();

            return;
        }
        
        // REPORTS FOUND - DISPLAY THEM
        reportContent.innerHTML = "";
        const chartConfigsToCache = [];

        // Group reports by student name and extract parent name
        const studentsMap = new Map();

        // Process assessment reports
        assessmentResults.forEach(result => {
            const studentName = result.studentName;
            if (!studentsMap.has(studentName)) {
                studentsMap.set(studentName, { assessments: [], monthly: [] });
            }
            studentsMap.get(studentName).assessments.push(result);
        });

        // Process monthly reports
        monthlyResults.forEach(report => {
            const studentName = report.studentName;
            if (!studentsMap.has(studentName)) {
                studentsMap.set(studentName, { assessments: [], monthly: [] });
            }
            studentsMap.get(studentName).monthly.push(report);
        });

        userChildren = Array.from(studentsMap.keys());

        // Display reports for each student
        let studentIndex = 0;
        for (const [studentName, reports] of studentsMap) {
            const fullName = capitalize(studentName);
            
            // Add student header
            const studentHeader = `
                <div class="bg-green-100 border-l-4 border-green-600 p-4 rounded-lg mb-6">
                    <h2 class="text-xl font-bold text-green-800">${fullName}</h2>
                    <p class="text-green-600">Showing all reports for ${fullName}</p>
                </div>
            `;
            reportContent.innerHTML += studentHeader;

            // Display Assessment Reports for this student - NO DUPLICATES
            if (reports.assessments.length > 0) {
                // Group by unique test sessions using timestamp
                const uniqueSessions = new Map();
                
                reports.assessments.forEach((result) => {
                    const sessionKey = Math.floor(result.timestamp / 86400); // Group by day
                    if (!uniqueSessions.has(sessionKey)) {
                        uniqueSessions.set(sessionKey, []);
                    }
                    uniqueSessions.get(sessionKey).push(result);
                });

                let assessmentIndex = 0;
                for (const [sessionKey, session] of uniqueSessions) {
                    const tutorEmail = session[0].tutorEmail || 'N/A';
                    const studentCountry = session[0].studentCountry || 'N/A';
                    const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', {
                        dateStyle: 'long',
                        timeStyle: 'short'
                    });

                    let tutorName = 'N/A';
                    if (tutorEmail && tutorEmail !== 'N/A') {
                        try {
                            const tutorDoc = await db.collection("tutors").doc(tutorEmail).get();
                            if (tutorDoc.exists) {
                                tutorName = tutorDoc.data().name;
                            }
                        } catch (error) {
                            // Silent fail - tutor name will remain 'N/A'
                        }
                    }

                    const results = session.map(testResult => {
                        const topics = [...new Set(testResult.answers?.map(a => a.topic).filter(t => t))] || [];
                        return {
                            subject: testResult.subject,
                            correct: testResult.score !== undefined ? testResult.score : 0,
                            total: testResult.totalScoreableQuestions !== undefined ? testResult.totalScoreableQuestions : 0,
                            topics: topics,
                        };
                    });

                    const tableRows = results.map(res => `<tr><td class="border px-2 py-1">${res.subject.toUpperCase()}</td><td class="border px-2 py-1 text-center">${res.correct} / ${res.total}</td></tr>`).join("");
                    const topicsTableRows = results.map(res => `<tr><td class="border px-2 py-1 font-semibold">${res.subject.toUpperCase()}</td><td class="border px-2 py-1">${res.topics.join(', ') || 'N/A'}</td></tr>`).join("");

                    const recommendation = generateTemplatedRecommendation(fullName, tutorName, results);
                    const creativeWritingAnswer = session[0].answers?.find(a => a.type === 'creative-writing');
                    const tutorReport = creativeWritingAnswer?.tutorReport || 'Pending review.';

                    const assessmentBlock = `
                        <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="assessment-block-${studentIndex}-${assessmentIndex}">
                            <div class="text-center mb-6 border-b pb-4">
                                <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                                     alt="Blooming Kids House Logo" 
                                     class="h-16 w-auto mx-auto mb-3">
                                <h2 class="text-2xl font-bold text-green-800">Assessment Report</h2>
                                <p class="text-gray-600">Date: ${formattedDate}</p>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                                <div>
                                    <p><strong>Student's Name:</strong> ${fullName}</p>
                                    <p><strong>Parent's Phone:</strong> ${session[0].parentPhone || 'N/A'}</p>
                                    <p><strong>Grade:</strong> ${session[0].grade}</p>
                                </div>
                                <div>
                                    <p><strong>Tutor:</strong> ${tutorName || 'N/A'}</p>
                                    <p><strong>Location:</strong> ${studentCountry || 'N/A'}</p>
                                </div>
                            </div>
                            
                            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Performance Summary</h3>
                            <table class="w-full text-sm mb-4 border border-collapse">
                                <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-center">Score</th></tr></thead>
                                <tbody>${tableRows}</tbody>
                            </table>
                            
                            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Knowledge & Skill Analysis</h3>
                            <table class="w-full text-sm mb-4 border border-collapse">
                                <thead class="bg-gray-100"><tr><th class="border px-2 py-1 text-left">Subject</th><th class="border px-2 py-1 text-left">Topics Covered</th></tr></thead>
                                <tbody>${topicsTableRows}</tbody>
                            </table>
                            
                            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Tutor's Recommendation</h3>
                            <p class="mb-2 text-gray-700 leading-relaxed">${recommendation}</p>

                            ${creativeWritingAnswer ? `
                            <h3 class="text-lg font-semibold mt-4 mb-2 text-green-700">Creative Writing Feedback</h3>
                            <p class="mb-2 text-gray-700"><strong>Tutor's Report:</strong> ${tutorReport}</p>
                            ` : ''}

                            ${results.length > 0 ? `
                            <canvas id="chart-${studentIndex}-${assessmentIndex}" class="w-full h-48 mb-4"></canvas>
                            ` : ''}
                            
                            <div class="bg-yellow-50 p-4 rounded-lg mt-6">
                                <h3 class="text-lg font-semibold mb-1 text-green-700">Director's Message</h3>
                                <p class="italic text-sm text-gray-700">At Blooming Kids House, we are committed to helping every child succeed. We believe that with personalized support from our tutors, ${fullName} will unlock their full potential. Keep up the great work!<br/>– Mrs. Yinka Isikalu, Director</p>
                            </div>
                            
                            <div class="mt-6 text-center">
                                <button onclick="downloadSessionReport(${studentIndex}, ${assessmentIndex}, '${fullName}', 'assessment')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                    Download Assessment PDF
                                </button>
                            </div>
                        </div>
                    `;

                    reportContent.innerHTML += assessmentBlock;

                    if (results.length > 0) {
                        const ctx = document.getElementById(`chart-${studentIndex}-${assessmentIndex}`);
                        if (ctx) {
                            const chartConfig = {
                                type: 'bar',
                                data: {
                                    labels: results.map(r => r.subject.toUpperCase()),
                                    datasets: [
                                        { label: 'Correct Answers', data: results.map(s => s.correct), backgroundColor: '#4CAF50' }, 
                                        { label: 'Incorrect/Unanswered', data: results.map(s => s.total - s.correct), backgroundColor: '#FFCD56' }
                                    ]
                                },
                                options: {
                                    responsive: true,
                                    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                                    plugins: { title: { display: true, text: 'Score Distribution by Subject' } }
                                }
                            };
                            new Chart(ctx, chartConfig);
                            chartConfigsToCache.push({ canvasId: `chart-${studentIndex}-${assessmentIndex}`, config: chartConfig });
                        }
                    }
                    assessmentIndex++;
                }
            }
            
            // Display Monthly Reports for this student
            if (reports.monthly.length > 0) {
                const groupedMonthly = {};
                reports.monthly.forEach((result) => {
                    const sessionKey = Math.floor(result.timestamp / 86400); 
                    if (!groupedMonthly[sessionKey]) groupedMonthly[sessionKey] = [];
                    groupedMonthly[sessionKey].push(result);
                });

                let monthlyIndex = 0;
                for (const key in groupedMonthly) {
                    const session = groupedMonthly[key];
                    const formattedDate = new Date(session[0].timestamp * 1000).toLocaleString('en-US', {
                        dateStyle: 'long',
                        timeStyle: 'short'
                    });

                    session.forEach((monthlyReport, reportIndex) => {
                        const monthlyBlock = `
                            <div class="border rounded-lg shadow mb-8 p-6 bg-white" id="monthly-block-${studentIndex}-${monthlyIndex}">
                                <div class="text-center mb-6 border-b pb-4">
                                    <img src="https://res.cloudinary.com/dy2hxcyaf/image/upload/v1757700806/newbhlogo_umwqzy.svg" 
                                         alt="Blooming Kids House Logo" 
                                         class="h-16 w-auto mx-auto mb-3">
                                    <h2 class="text-2xl font-bold text-green-800">MONTHLY LEARNING REPORT</h2>
                                    <p class="text-gray-600">Date: ${formattedDate}</p>
                                </div>
                                
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-green-50 p-4 rounded-lg">
                                    <div>
                                        <p><strong>Student's Name:</strong> ${monthlyReport.studentName || 'N/A'}</p>
                                        <p><strong>Parent's Name:</strong> ${monthlyReport.parentName || 'N/A'}</p>
                                        <p><strong>Parent's Phone:</strong> ${monthlyReport.parentPhone || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p><strong>Grade:</strong> ${monthlyReport.grade || 'N/A'}</p>
                                        <p><strong>Tutor's Name:</strong> ${monthlyReport.tutorName || 'N/A'}</p>
                                    </div>
                                </div>

                                ${monthlyReport.introduction ? `
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">INTRODUCTION</h3>
                                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.introduction}</p>
                                </div>
                                ` : ''}

                                ${monthlyReport.topics ? `
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">TOPICS & REMARKS</h3>
                                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.topics}</p>
                                </div>
                                ` : ''}

                                ${monthlyReport.progress ? `
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">PROGRESS & ACHIEVEMENTS</h3>
                                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.progress}</p>
                                </div>
                                ` : ''}

                                ${monthlyReport.strengthsWeaknesses ? `
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">STRENGTHS AND WEAKNESSES</h3>
                                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.strengthsWeaknesses}</p>
                                </div>
                                ` : ''}

                                ${monthlyReport.recommendations ? `
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">RECOMMENDATIONS</h3>
                                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.recommendations}</p>
                                </div>
                                ` : ''}

                                ${monthlyReport.generalComments ? `
                                <div class="mb-6">
                                    <h3 class="text-lg font-semibold text-green-700 mb-2 border-b pb-1">GENERAL TUTOR'S COMMENTS</h3>
                                    <p class="text-gray-700 leading-relaxed preserve-whitespace">${monthlyReport.generalComments}</p>
                                </div>
                                ` : ''}

                                <div class="text-right mt-8 pt-4 border-t">
                                    <p class="text-gray-600">Best regards,</p>
                                    <p class="font-semibold text-green-800">${monthlyReport.tutorName || 'N/A'}</p>
                                </div>

                                <div class="mt-6 text-center">
                                    <button onclick="downloadMonthlyReport(${studentIndex}, ${monthlyIndex}, '${fullName}')" class="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200">
                                        Download Monthly Report PDF
                                    </button>
                                </div>
                            </div>
                        `;
                        reportContent.innerHTML += monthlyBlock;
                        monthlyIndex++;
                    });
                }
            }
            
            studentIndex++;
        }
        
        // --- CACHE SAVING LOGIC ---
        try {
            const dataToCache = {
                timestamp: Date.now(),
                html: reportContent.innerHTML,
                chartConfigs: chartConfigsToCache,
                userData: currentUserData
            };
            localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
            console.log("Report data cached successfully.");
        } catch (e) {
            console.error("Could not write to cache:", e);
        }
        // --- END CACHE SAVING ---

        authArea.classList.add("hidden");
        reportArea.classList.remove("hidden");

        // Add buttons to welcome section
        addViewResponsesButton();
        addManualRefreshButton();
        
        // Load initial referral data for the rewards dashboard tab
        loadReferralRewards(userId);
        
        // Load initial academics data
        loadAcademicsData();

    } catch (error) {
        console.error("Error loading reports:", error);
        showMessage("Sorry, there was an error loading the reports. Please try again.", "error");
    } finally {
        authLoader.classList.add("hidden");
    }
}

function downloadSessionReport(studentIndex, sessionIndex, studentName, type) {
    const element = document.getElementById(`${type}-block-${studentIndex}-${sessionIndex}`);
    const safeStudentName = studentName.replace(/ /g, '_');
    const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeStudentName}.pdf`;
    const opt = { margin: 0.5, filename: fileName, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } };
    html2pdf().from(element).set(opt).save();
}

function downloadMonthlyReport(studentIndex, monthlyIndex, studentName) {
    downloadSessionReport(studentIndex, monthlyIndex, studentName, 'monthly');
}

function logout() {
    // Clear remember me on logout
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('savedEmail');
    
    // Clean up real-time listeners
    cleanupRealTimeListeners();
    
    auth.signOut().then(() => {
        window.location.reload();
    });
}

function showMessage(message, type) {
    // Remove any existing message
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
        type === 'error' ? 'bg-red-500 text-white' : 
        type === 'success' ? 'bg-green-500 text-white' : 
        'bg-blue-500 text-white'
    }`;
    messageDiv.textContent = `BKH says: ${message}`;
    
    document.body.appendChild(messageDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

function switchTab(tab) {
    const signInTab = document.getElementById('signInTab');
    const signUpTab = document.getElementById('signUpTab');
    const signInForm = document.getElementById('signInForm');
    const signUpForm = document.getElementById('signUpForm');

    if (tab === 'signin') {
        signInTab.classList.remove('tab-inactive');
        signInTab.classList.add('tab-active');
        signUpTab.classList.remove('tab-active');
        signUpTab.classList.add('tab-inactive');
        signInForm.classList.remove('hidden');
        signUpForm.classList.add('hidden');
    } else {
        signUpTab.classList.remove('tab-inactive');
        signUpTab.classList.add('tab-active');
        signInTab.classList.remove('tab-active');
        signInTab.classList.add('tab-inactive');
        signUpForm.classList.remove('hidden');
        signInForm.classList.add('hidden');
    }
}

function switchMainTab(tab) {
    const reportTab = document.getElementById('reportTab');
    const rewardsTab = document.getElementById('rewardsTab');
    const academicsTab = document.getElementById('academicsTab');
    
    const reportContentArea = document.getElementById('reportContentArea');
    const rewardsContentArea = document.getElementById('rewardsContentArea');
    const academicsContentArea = document.getElementById('academicsContentArea');
    
    // Deactivate all tabs
    reportTab?.classList.remove('tab-active-main');
    reportTab?.classList.add('tab-inactive-main');
    rewardsTab?.classList.remove('tab-active-main');
    rewardsTab?.classList.add('tab-inactive-main');
    academicsTab?.classList.remove('tab-active-main');
    academicsTab?.classList.add('tab-inactive-main');
    
    // Hide all content areas
    reportContentArea?.classList.add('hidden');
    rewardsContentArea?.classList.add('hidden');
    academicsContentArea?.classList.add('hidden');
    
    // Activate selected tab and show content
    if (tab === 'reports') {
        reportTab?.classList.remove('tab-inactive-main');
        reportTab?.classList.add('tab-active-main');
        reportContentArea?.classList.remove('hidden');
    } else if (tab === 'rewards') {
        rewardsTab?.classList.remove('tab-inactive-main');
        rewardsTab?.classList.add('tab-active-main');
        rewardsContentArea?.classList.remove('hidden');
        
        // Reload rewards data when the tab is clicked to ensure it's up-to-date
        const user = auth.currentUser;
        if (user) {
            loadReferralRewards(user.uid);
        }
    } else if (tab === 'academics') {
        academicsTab?.classList.remove('tab-inactive-main');
        academicsTab?.classList.add('tab-active-main');
        academicsContentArea?.classList.remove('hidden');
        
        // Load academics data when the tab is clicked to ensure it's up-to-date
        loadAcademicsData();
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    // Setup Remember Me
    setupRememberMe();
    
    // Create country code dropdown when page loads
    createCountryCodeDropdown();
    
    // Check authentication state
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in, load their reports
            // Get phone from Firestore user document
            db.collection('parent_users').doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const userPhone = doc.data().phone;
                        const normalizedPhone = doc.data().normalizedPhone;
                        loadAllReportsForParent(normalizedPhone || userPhone, user.uid);
                    }
                })
                .catch((error) => {
                    console.error('Error getting user data:', error);
                });
        } else {
            // User signed out - clean up listeners
            cleanupRealTimeListeners();
        }
    });

    // Set up event listeners
    document.getElementById("signInBtn").addEventListener("click", handleSignIn);
    document.getElementById("signUpBtn").addEventListener("click", handleSignUp);
    document.getElementById("sendResetBtn").addEventListener("click", handlePasswordReset);
    document.getElementById("submitFeedbackBtn").addEventListener("click", submitFeedback);
    
    document.getElementById("signInTab").addEventListener("click", () => switchTab('signin'));
    document.getElementById("signUpTab").addEventListener("click", () => switchTab('signup'));
    
    document.getElementById("forgotPasswordBtn").addEventListener("click", () => {
        document.getElementById("passwordResetModal").classList.remove("hidden");
    });
    
    document.getElementById("cancelResetBtn").addEventListener("click", () => {
        document.getElementById("passwordResetModal").classList.add("hidden");
    });

    document.getElementById("rememberMe").addEventListener("change", handleRememberMe);

    // Allow Enter key to submit forms
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignIn();
    });
    
    document.getElementById('signupConfirmPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSignUp();
    });
    
    document.getElementById('resetEmail').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handlePasswordReset();
    });
    
    // --- START: NEW MAIN TAB SWITCHING LISTENERS ---
    document.getElementById("reportTab")?.addEventListener("click", () => switchMainTab('reports'));
    document.getElementById("rewardsTab")?.addEventListener("click", () => switchMainTab('rewards'));
    document.getElementById("academicsTab")?.addEventListener("click", () => switchMainTab('academics'));
    // --- END: NEW MAIN TAB SWITCHING LISTENERS ---
});
[file content end]
