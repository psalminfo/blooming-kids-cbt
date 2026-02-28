import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc, updateDoc, setDoc, deleteDoc, orderBy, writeBatch, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';
let activeTutorId = null;

// #################################################
// # PERSISTENT CACHE IMPLEMENTATION
// #################################################

const CACHE_PREFIX = 'admin_cache_';

const sessionCache = {
    tutors: null,
    students: null,
    reports: null,
    staff: null,
    breakStudents: null,
};

function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
        sessionCache[key] = data;
    } catch (error) {
        console.error("Could not save to localStorage:", error);
    }
}

function loadFromLocalStorage() {
    for (const key in sessionCache) {
        try {
            const storedData = localStorage.getItem(CACHE_PREFIX + key);
            if (storedData) {
                sessionCache[key] = JSON.parse(storedData);
            }
        } catch (error) {
            console.error(`Could not load '${key}' from localStorage:`, error);
            localStorage.removeItem(CACHE_PREFIX + key);
        }
    }
}

function invalidateCache(key) {
    sessionCache[key] = null;
    localStorage.removeItem(CACHE_PREFIX + key);
}

loadFromLocalStorage();

// --- Utility Functions ---
function capitalize(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

function convertPayAdviceToCSV(data) {
    const header = ['Tutor Name', 'Student Count', 'Total Student Fees (₦)', 'Management Fee (₦)', 'Total Pay (₦)'];
    const rows = data.map(item => [
        `"${item.tutorName}"`,
        item.studentCount,
        item.totalStudentFees,
        item.managementFee,
        item.totalPay
    ]);
    return [header.join(','), ...rows.map(row => row.join(','))].join('\n');
}

async function uploadImageToCloudinary(file) {
    const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
    const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
    const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
    if (!res.ok) throw new Error("Image upload failed");
    const data = await res.json();
    return data.secure_url;
}

async function updateStaffPermissions(staffEmail, newRole) {
    const staffDocRef = doc(db, "staff", staffEmail);
   const ROLE_PERMISSIONS = {
    pending: { 
        tabs: { 
            viewTutorManagement: false, 
            viewPayAdvice: false, 
            viewTutorReports: false, 
            viewSummerBreak: false, 
            viewPendingApprovals: false, 
            viewStaffManagement: false, 
            viewParentFeedback: false, 
            viewEnrollments: false,
            viewInactiveTutors: false,
            viewArchivedStudents: false,
            viewMasterPortal: false,   // Management Portal tab
            viewReferralsAdmin: false,  // Referral Management
            viewUserDirectory: false,   // User Directory
            canQA: false,              // QA Session Observation button
            canQC: false               // Lesson Plan QC button
        }, 
        actions: { 
            canDownloadReports: false, 
            canExportPayAdvice: false, 
            canEndSummerBreak: false, 
            canEditStudents: false, 
            canDeleteStudents: false 
        } 
    },
    tutor: { 
        tabs: { 
            viewTutorManagement: false, 
            viewPayAdvice: false, 
            viewTutorReports: false, 
            viewSummerBreak: false, 
            viewPendingApprovals: false, 
            viewStaffManagement: false, 
            viewParentFeedback: false, 
            viewEnrollments: false,
            viewInactiveTutors: false,
            viewArchivedStudents: false,
            viewMasterPortal: false,   // Management Portal tab
            viewReferralsAdmin: false,  // Referral Management
            viewUserDirectory: false,   // User Directory
            canQA: false,              // QA Session Observation button
            canQC: false               // Lesson Plan QC button
        }, 
        actions: { 
            canDownloadReports: false, 
            canExportPayAdvice: false, 
            canEndSummerBreak: false, 
            canEditStudents: false, 
            canDeleteStudents: false 
        } 
    },
    manager: { 
        tabs: { 
            viewTutorManagement: true, 
            viewPayAdvice: false, 
            viewTutorReports: true, 
            viewSummerBreak: true, 
            viewPendingApprovals: true, 
            viewStaffManagement: false, 
            viewParentFeedback: true, 
            viewEnrollments: true,
            viewInactiveTutors: true,
            viewArchivedStudents: true,
            viewMasterPortal: true,    // Managers can see the Master View
            viewReferralsAdmin: true,   // Referral Management
            viewUserDirectory: true,    // User Directory
            canQA: false,              // Only QA officers rate sessions
            canQC: false               // Only QC officers rate lesson plans
        }, 
        actions: { 
            canDownloadReports: false, 
            canExportPayAdvice: false, 
            canEndSummerBreak: false, 
            canEditStudents: true, 
            canDeleteStudents: false 
        } 
    },
    director: { 
        tabs: { 
            viewTutorManagement: true, 
            viewPayAdvice: true, 
            viewTutorReports: true, 
            viewSummerBreak: true, 
            viewPendingApprovals: true, 
            viewStaffManagement: true, 
            viewParentFeedback: true, 
            viewEnrollments: true,
            viewInactiveTutors: true,
            viewArchivedStudents: true,
            viewMasterPortal: true,    // Directors can see the Master View
            viewReferralsAdmin: true,   // Referral Management
            viewUserDirectory: true,    // User Directory
            canQA: true,               // Directors can do QA ratings
            canQC: true                // Directors can do QC ratings
        }, 
        actions: { 
            canDownloadReports: true, 
            canExportPayAdvice: true, 
            canEndSummerBreak: true, 
            canEditStudents: true, 
            canDeleteStudents: true 
        } 
    },
    admin: { 
        tabs: { 
            viewTutorManagement: true, 
            viewPayAdvice: true, 
            viewTutorReports: true, 
            viewSummerBreak: true, 
            viewPendingApprovals: true, 
            viewStaffManagement: true, 
            viewParentFeedback: true, 
            viewEnrollments: true,
            viewInactiveTutors: true,
            viewArchivedStudents: true,
            viewMasterPortal: true,    // Admins have full access
            viewReferralsAdmin: true,   // Referral Management
            viewUserDirectory: true,    // User Directory
            canQA: true,               // Admins can do QA ratings
            canQC: true                // Admins can do QC ratings
        }, 
        actions: { 
            canDownloadReports: true, 
            canExportPayAdvice: true, 
            canEndSummerBreak: true, 
            canEditStudents: true, 
            canDeleteStudents: true 
        } 
    }
};
    const newPermissions = ROLE_PERMISSIONS[newRole];
    if (!newPermissions) {
        console.error("Invalid role specified:", newRole);
        return;
    }
    try {
        await updateDoc(staffDocRef, { role: newRole, permissions: newPermissions });
        invalidateCache('staff');
        console.log(`Successfully updated permissions for ${staffEmail} to role: ${newRole}`);
        fetchAndRenderStaff();
    } catch (error) {
        console.error("Error updating staff permissions:", error);
    }
}

// ##################################################################
// # SECTION 1: DASHBOARD PANEL (WITH BULK QUESTION UPLOAD)
// ##################################################################

async function renderAdminPanel(container) {
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Total Students</h3><p id="totalStudentsCount" class="text-3xl text-blue-600 font-extrabold">...</p></div>
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Total Tutors</h3><p id="totalTutorsCount" class="text-3xl text-blue-600 font-extrabold">...</p></div>
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow-md"><h3 class="font-bold text-blue-800">Students Per Tutor</h3><select id="studentsPerTutorSelect" class="w-full mt-1 p-2 border rounded"></select></div>
        </div>
        
        <!-- Bulk Question Upload Section -->
        <div class="bg-white p-6 rounded-lg shadow-md mb-6 border-2 border-purple-200">
            <h2 class="text-2xl font-bold text-purple-700 mb-4">Bulk Question Upload</h2>
            <p class="text-sm text-gray-600 mb-4">Upload multiple questions at once using JSON format. The system will help you add images after uploading question data.</p>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Upload Section -->
                <div class="space-y-4">
                    <div>
                        <label class="block font-semibold text-gray-700 mb-2">1. Upload Question JSON</label>
                        <input type="file" id="bulk-question-json-upload" class="w-full p-2 border rounded" accept=".json">
                        <p class="text-xs text-gray-500 mt-1">Upload a JSON file with your questions</p>
                    </div>
                    
                    <div>
                        <label class="block font-semibold text-gray-700 mb-2">Or Paste JSON Directly</label>
                        <textarea id="bulk-question-json-textarea" class="w-full p-2 border rounded h-40 font-mono text-sm" placeholder='Paste JSON like: {
  "questions": [
    {
      "topic": "Algebra",
      "subject": "Math",
      "grade": "6",
      "type": "multiple-choice",
      "question": "Solve for x: 2x + 5 = 15",
      "image_placeholder": "algebra_q1.jpg",
      "options": ["x = 5", "x = 10", "x = 7.5", "x = 8"],
      "correctAnswer": "x = 5"
    }
  ]
}'></textarea>
                    </div>
                    
                    <button id="process-questions-btn" class="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 w-full">
                        Process Questions
                    </button>
                </div>
                
                <!-- Template & Instructions -->
                <div class="bg-purple-50 p-4 rounded-lg">
                    <h3 class="font-semibold text-purple-800 mb-2">JSON Template & Instructions</h3>
                    <div class="text-sm space-y-2">
                        <p><strong>Download Template:</strong> 
                            <button id="download-template-btn" class="text-blue-600 hover:text-blue-800 underline ml-2">Download JSON Template</button>
                        </p>
                        <p><strong>Image Placeholders:</strong> Use "image_placeholder" field for questions needing images</p>
                        <p><strong>Supported Types:</strong> multiple-choice, creative-writing, comprehension</p>
                        <p><strong>Required Fields:</strong> topic, subject, grade, type, question</p>
                    </div>
                    
                    <div class="mt-4 p-3 bg-white rounded border">
                        <h4 class="font-semibold mb-2">Example JSON Structure:</h4>
                        <pre class="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
{
  "questions": [
    {
      "topic": "Fractions",
      "subject": "Math",
      "grade": "6",
      "type": "multiple-choice",
      "question": "What is 1/2 + 1/4?",
      "image_placeholder": "fraction_q1.jpg",
      "options": ["1/4", "3/4", "1/2", "2/4"],
      "correctAnswer": "3/4"
    }
  ]
}</pre>
                    </div>
                </div>
            </div>
            
            <!-- Image Upload Section (Initially Hidden) -->
            <div id="bulk-image-upload-section" class="mt-6 p-4 border rounded-lg bg-blue-50" style="display: none;">
                <h3 class="text-xl font-semibold text-blue-700 mb-4">2. Upload Images for Questions</h3>
                <div id="image-upload-list" class="space-y-3 mb-4">
                    <!-- Dynamic image upload fields will appear here -->
                </div>
                <div class="flex space-x-4">
                    <button id="bulk-image-select-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        Select Multiple Images
                    </button>
                    <button id="save-all-questions-btn" class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                        Save All Questions to Firestore
                    </button>
                </div>
                <div id="bulk-upload-status" class="mt-2 text-sm"></div>
            </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Single Question Form -->
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">Add Single Question</h2>
                <form id="addQuestionForm">
                    <div class="mb-4"><label for="topic" class="block text-gray-700">Topic</label><input type="text" id="topic" class="w-full mt-1 p-2 border rounded" required></div>
                    <div class="mb-4"><label for="subject" class="block font-medium text-gray-700">Subject</label><select id="subject" name="subject" required class="w-full mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"><option value="" disabled selected>-- Select a Subject --</option><option value="English">English</option><option value="Math">Math</option><optgroup label="Science"><option value="Biology">Biology</option><option value="Chemistry">Chemistry</option><option value="Physics">Physics</option></optgroup></select></div>
                    <div class="mb-4"><label for="grade" class="block text-gray-700">Grade</label><select id="grade" required class="w-full mt-1 p-2 border rounded"><option value="">Select Grade</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10</option><option value="11">11</option><option value="12">12</option></select></div>
                    <div class="mb-4"><label for="questionType" class="block text-gray-700">Question Type</label><select id="questionType" class="w-full mt-1 p-2 border rounded"><option value="multiple-choice">Multiple Choice</option><option value="creative-writing">Creative Writing</option><option value="comprehension">Comprehension</option></select></div>
                    <div class="mb-4" id="writingTypeSection" style="display:none;"><label for="writingType" class="block text-gray-700">Writing Type</label><select id="writingType" class="w-full mt-1 p-2 border rounded"><option value="Narrative">Narrative</option><option value="Descriptive">Descriptive</option><option value="Persuasive">Persuasive</option></select></div>
                    <div class="mb-4" id="comprehensionSection" style="display:none;"><label for="passage" class="block text-gray-700">Comprehension Passage</label><textarea id="passage" class="w-full mt-1 p-2 border rounded" rows="4"></textarea><div id="comprehensionQuestions" class="mt-4"><h4 class="font-semibold mb-2">Questions for Passage</h4></div><button type="button" id="addCompQuestionBtn" class="bg-gray-200 px-3 py-1 rounded text-sm mt-2">+ Add Question</button></div>
                    <div class="mb-4"><label for="questionText" class="block text-gray-700">Question Text</label><textarea id="questionText" class="w-full mt-1 p-2 border rounded" rows="3" required></textarea></div>
                    <div class="mb-4"><label for="imageUpload" class="block text-gray-700">Image (Optional)</label><input type="file" id="imageUpload" class="w-full mt-1"></div>
                    <div id="optionsContainer" class="mb-4"><h4 class="font-semibold mb-2">Options</h4><input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 1"><input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 2"></div>
                    <button type="button" id="addOptionBtn" class="bg-gray-200 px-3 py-1 rounded text-sm mb-4">+ Add Option</button>
                    <div class="mb-4" id="correctAnswerSection"><label for="correctAnswer" class="block text-gray-700">Correct Answer</label><input type="text" id="correctAnswer" class="w-full mt-1 p-2 border rounded"></div>
                    <button type="submit" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Save Question</button>
                    <p id="formMessage" class="mt-4 text-sm"></p>
                </form>
            </div>
            
            <!-- Student Reports Section -->
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">View Student Reports</h2>
                <label for="studentDropdown" class="block text-gray-700">Select Student</label>
                <select id="studentDropdown" class="w-full mt-1 p-2 border rounded"></select>
                <div id="reportContent" class="mt-4 space-y-4"><p class="text-gray-500">Please select a student to view their report.</p></div>
            </div>
        </div>
    `;
    setupDashboardListeners();
}

// Single question submission handler
async function handleAddQuestionSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const message = document.getElementById('formMessage');
    message.textContent = "Saving...";
    const imageFile = document.getElementById('imageUpload').files[0];

    try {
        let imageUrl = null;
        if (imageFile) {
            message.textContent = "Uploading image...";
            imageUrl = await uploadImageToCloudinary(imageFile);
        }
        message.textContent = "Saving question...";

        const questionType = form.questionType.value;
        let newQuestion = {
            topic: form.topic.value,
            subject: form.subject.value,
            grade: form.grade.value,
            type: questionType,
            image_url: imageUrl,
        };
        if (questionType === 'comprehension') {
            newQuestion.passage = form.passage.value;
            newQuestion.sub_questions = [];
            form.querySelectorAll('.question-group').forEach(group => {
                newQuestion.sub_questions.push({
                    question: group.querySelector('.comp-question').value,
                    options: Array.from(group.querySelectorAll('.comp-option')).map(i => i.value).filter(v => v),
                    correct_answer: group.querySelector('.comp-correct-answer').value,
                    type: 'multiple-choice',
                });
            });
        } else {
            newQuestion.question = form.questionText.value;
            if (questionType === 'creative-writing') {
                newQuestion.writing_type = form.writingType.value;
            } else { // multiple-choice
                newQuestion.options = Array.from(form.querySelectorAll('.option-input')).map(i => i.value).filter(v => v);
                newQuestion.correct_answer = form.correctAnswer.value;
            }
        }

        await addDoc(collection(db, "admin_questions"), newQuestion);
        message.textContent = "Question saved successfully!";
        message.style.color = 'green';
        form.reset();
    } catch (error) {
        console.error("Error adding question:", error);
        message.textContent = `Error: ${error.message}`;
        message.style.color = 'red';
    }
}

// Bulk question upload functionality
async function setupBulkQuestionUpload() {
    const bulkQuestionJsonUpload = document.getElementById('bulk-question-json-upload');
    const bulkQuestionJsonTextarea = document.getElementById('bulk-question-json-textarea');
    const processQuestionsBtn = document.getElementById('process-questions-btn');
    const downloadTemplateBtn = document.getElementById('download-template-btn');
    const bulkImageUploadSection = document.getElementById('bulk-image-upload-section');
    const imageUploadList = document.getElementById('image-upload-list');
    const bulkImageSelectBtn = document.getElementById('bulk-image-select-btn');
    const saveAllQuestionsBtn = document.getElementById('save-all-questions-btn');
    const bulkUploadStatus = document.getElementById('bulk-upload-status');

    let currentBulkQuestions = [];

    // Download JSON template
    downloadTemplateBtn.addEventListener('click', () => {
        const template = {
            questions: [
                {
                    topic: "Algebra",
                    subject: "Math",
                    grade: "6",
                    type: "multiple-choice",
                    question: "Solve for x: 2x + 5 = 15",
                    image_placeholder: "algebra_q1.jpg",
                    options: ["x = 5", "x = 10", "x = 7.5", "x = 8"],
                    correctAnswer: "x = 5"
                },
                {
                    topic: "Geometry",
                    subject: "Math", 
                    grade: "6",
                    type: "multiple-choice",
                    question: "What is the area of a rectangle with length 8 and width 5?",
                    image_placeholder: "geometry_q2.png",
                    options: ["13", "40", "26", "35"],
                    correctAnswer: "40"
                }
            ]
        };

        const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'question_upload_template.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    // Process questions from JSON
    processQuestionsBtn.addEventListener('click', async () => {
        const file = bulkQuestionJsonUpload.files[0];
        const jsonText = bulkQuestionJsonTextarea.value.trim();

        let questionsData = [];

        try {
            if (file) {
                const text = await readFileAsText(file);
                questionsData = JSON.parse(text);
            } else if (jsonText) {
                questionsData = JSON.parse(jsonText);
            } else {
                bulkUploadStatus.textContent = 'Please provide question data first.';
                bulkUploadStatus.style.color = 'orange';
                return;
            }

            if (!questionsData.questions || !Array.isArray(questionsData.questions)) {
                throw new Error('Invalid JSON format. Expected { "questions": [] }');
            }

            currentBulkQuestions = questionsData.questions;
            displayImageUploadFields(currentBulkQuestions);

        } catch (error) {
            bulkUploadStatus.textContent = `Error: ${error.message}`;
            bulkUploadStatus.style.color = 'red';
        }
    });

    // Display image upload fields for questions with placeholders
    function displayImageUploadFields(questions) {
        imageUploadList.innerHTML = '';
        const questionsWithImages = questions.filter(q => q.image_placeholder);
        
        if (questionsWithImages.length === 0) {
            // No images needed, ready to save
            bulkImageUploadSection.style.display = 'block';
            imageUploadList.innerHTML = '<p class="text-green-600">No images needed for these questions. Ready to save!</p>';
            return;
        }

        questionsWithImages.forEach((question, index) => {
            const uploadField = document.createElement('div');
            uploadField.className = 'flex items-center space-x-4 p-3 bg-white rounded border';
            uploadField.innerHTML = `
                <div class="flex-1">
                    <div class="font-semibold">${question.topic} - ${question.question.substring(0, 50)}...</div>
                    <div class="text-sm text-gray-600">Placeholder: ${question.image_placeholder}</div>
                </div>
                <div class="flex items-center space-x-2">
                    <input type="file" 
                           class="question-image-upload" 
                           data-question-index="${index}"
                           data-placeholder="${question.image_placeholder}"
                           accept="image/*">
                    <div class="upload-status text-sm w-20"></div>
                </div>
            `;
            imageUploadList.appendChild(uploadField);
        });

        bulkImageUploadSection.style.display = 'block';
        bulkUploadStatus.textContent = `Found ${questionsWithImages.length} questions needing images. Upload images or click "Save All Questions" to proceed.`;
        bulkUploadStatus.style.color = 'blue';
    }

    // Bulk image selection
    bulkImageSelectBtn.addEventListener('click', () => {
        document.querySelectorAll('.question-image-upload').forEach(input => {
            // Trigger click on all file inputs
            const event = new MouseEvent('click');
            input.dispatchEvent(event);
        });
    });

    // Save all questions to Firestore
    saveAllQuestionsBtn.addEventListener('click', async () => {
        if (currentBulkQuestions.length === 0) {
            bulkUploadStatus.textContent = 'No questions to save.';
            bulkUploadStatus.style.color = 'orange';
            return;
        }

        bulkUploadStatus.textContent = 'Saving questions to Firestore...';
        bulkUploadStatus.style.color = 'blue';
        saveAllQuestionsBtn.disabled = true;

        try {
            let savedCount = 0;
            let errorCount = 0;

            // Process each question
            for (const question of currentBulkQuestions) {
                try {
                    // Check if this question has an uploaded image
                    const imageInput = document.querySelector(`.question-image-upload[data-placeholder="${question.image_placeholder}"]`);
                    let imageUrl = null;

                    if (imageInput && imageInput.files[0]) {
                        // Upload image to Cloudinary
                        bulkUploadStatus.textContent = `Uploading image for: ${question.topic}...`;
                        imageUrl = await uploadImageToCloudinary(imageInput.files[0]);
                    }

                    // Prepare question data for Firestore
                    const questionData = {
                        topic: question.topic,
                        subject: question.subject,
                        grade: question.grade,
                        type: question.type,
                        question: question.question,
                        options: question.options || [],
                        correct_answer: question.correctAnswer || '',
                        image_url: imageUrl,
                        createdAt: new Date()
                    };

                    // Add comprehension data if needed
                    if (question.type === 'comprehension') {
                        questionData.passage = question.passage;
                        questionData.sub_questions = question.sub_questions || [];
                    }

                    // Add creative writing data if needed
                    if (question.type === 'creative-writing') {
                        questionData.writing_type = question.writing_type;
                    }

                    // Save to Firestore
                    await addDoc(collection(db, "admin_questions"), questionData);
                    savedCount++;

                    bulkUploadStatus.textContent = `Saved ${savedCount}/${currentBulkQuestions.length} questions...`;

                } catch (error) {
                    console.error(`Error saving question: ${question.topic}`, error);
                    errorCount++;
                }
            }

            // Show final result
            if (errorCount === 0) {
                bulkUploadStatus.textContent = `✅ Success! All ${savedCount} questions saved successfully!`;
                bulkUploadStatus.style.color = 'green';
                
                // Reset form
                currentBulkQuestions = [];
                bulkQuestionJsonUpload.value = '';
                bulkQuestionJsonTextarea.value = '';
                setTimeout(() => {
                    bulkImageUploadSection.style.display = 'none';
                }, 3000);
            } else {
                bulkUploadStatus.textContent = `Saved ${savedCount} questions, ${errorCount} failed. Check console for details.`;
                bulkUploadStatus.style.color = 'orange';
            }

        } catch (error) {
            console.error('Bulk question upload error:', error);
            bulkUploadStatus.textContent = `❌ Error: ${error.message}`;
            bulkUploadStatus.style.color = 'red';
        } finally {
            saveAllQuestionsBtn.disabled = false;
        }
    });

    // Helper function to read file as text
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
}

// Dashboard setup with bulk upload integration
async function setupDashboardListeners() {
    const addQuestionForm = document.getElementById('addQuestionForm');
    const questionTypeDropdown = document.getElementById('questionType');
    const addOptionBtn = document.getElementById('addOptionBtn');
    const addCompQuestionBtn = document.getElementById('addCompQuestionBtn');
    const studentDropdown = document.getElementById('studentDropdown');

    addQuestionForm.addEventListener('submit', handleAddQuestionSubmit);
    addOptionBtn.addEventListener('click', () => {
        const optionsContainer = document.getElementById('optionsContainer');
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'option-input w-full mt-1 p-2 border rounded';
        newInput.placeholder = `Option ${optionsContainer.children.length - 1}`;
        optionsContainer.appendChild(newInput);
    });
    questionTypeDropdown.addEventListener('change', (e) => {
        const type = e.target.value;
        document.getElementById('optionsContainer').style.display = type === 'multiple-choice' ? 'block' : 'none';
        document.getElementById('addOptionBtn').style.display = type === 'multiple-choice' ? 'inline-block' : 'none';
        document.getElementById('correctAnswerSection').style.display = type === 'multiple-choice' ? 'block' : 'none';
        document.getElementById('writingTypeSection').style.display = type === 'creative-writing' ? 'block' : 'none';
        document.getElementById('comprehensionSection').style.display = type === 'comprehension' ? 'block' : 'none';
    });
    addCompQuestionBtn.addEventListener('click', () => {
        const container = document.getElementById('comprehensionQuestions');
        const newQ = document.createElement('div');
        newQ.className = 'question-group mb-4 p-4 border rounded';
        newQ.innerHTML = `<textarea class="comp-question w-full mt-1 p-2 border rounded" rows="2" placeholder="Question"></textarea><div class="flex space-x-2 mt-2"><input type="text" class="comp-option w-1/2 p-2 border rounded" placeholder="Option 1"><input type="text" class="comp-option w-1/2 p-2 border rounded" placeholder="Option 2"></div><input type="text" class="comp-correct-answer w-full mt-2 p-2 border rounded" placeholder="Correct Answer">`;
        container.appendChild(newQ);
    });
    studentDropdown.addEventListener('change', (e) => {
        if (e.target.value) loadAndRenderReport(e.target.value);
    });

    // Initialize bulk question upload
    setupBulkQuestionUpload();

    // Load dashboard data
    await ensureDashboardData();
    loadCountersFromCache();
    loadStudentDropdown();
}

// ##################################################################
// # SECTION 2: CONTENT MANAGER (WITH BULK PASSAGE UPLOAD)
// ##################################################################

async function renderContentManagerPanel(container) {
    container.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Content Manager</h2>
            <div class="bg-gray-50 p-4 border rounded-lg mb-6">
                <label for="test-file-select" class="block font-bold text-gray-800">1. Select a Test File</label>
                <p class="text-sm text-gray-600 mb-2">Automatically finds test files in your GitHub repository.</p>
                <div id="file-loader" class="flex items-center space-x-2">
                    <select id="test-file-select" class="w-full p-2 border rounded"><option>Loading files...</option></select>
                    <button id="load-test-btn" class="bg-green-600 text-white font-bold px-4 py-2 rounded hover:bg-green-700">Load</button>
                </div>
                <div class="mt-2">
                    <input type="checkbox" id="force-reload-checkbox" class="mr-2">
                    <label for="force-reload-checkbox" class="text-sm text-gray-700">Reload from GitHub (preserves existing images)</label>
                </div>
                <div id="loader-status" class="mt-2"></div>
            </div>
            <div id="manager-workspace" style="display:none;">
                 <h3 class="text-gray-800 font-bold mb-4 text-lg" id="loaded-file-name"></h3>
                
                <!-- Single Passage Editing Section -->
                <div class="mb-8 p-4 border rounded-md">
                    <h4 class="text-xl font-semibold mb-2">2. Edit Incomplete Passages (Single)</h4>
                    <select id="passage-select" class="w-full p-2 border rounded mt-1 mb-2"></select>
                    <textarea id="passage-content" placeholder="Passage content..." class="w-full p-2 border rounded h-40"></textarea>
                    <button id="update-passage-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-2">Save Passage to Firestore</button>
                </div>
                
                <!-- Bulk Passage Upload Section -->
                <div class="p-4 border rounded-md mb-6 bg-purple-50">
                    <h4 class="text-xl font-semibold mb-2">3. Bulk ELA Passage Upload</h4>
                    <p class="text-sm text-gray-600 mb-4">
                        Upload all ELA passages at once. The system will automatically match passages by their titles.
                    </p>
                    
                    <div class="mb-4">
                        <label class="font-bold">Upload JSON with Passage Content:</label>
                        <input type="file" id="bulk-passage-json-upload" class="w-full mt-1 border p-2 rounded
