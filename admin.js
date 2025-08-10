import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';

const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;


async function uploadImageToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    const res = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData,
    });
    
    if (!res.ok) throw new Error("Image upload failed");
    
    const data = await res.json();
    return data.secure_url;
}


async function renderAdminPanel() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">Content Checklist</h2>
                <div id="checklistContent" class="space-y-4 text-sm">
                    <p class="text-gray-500">Loading checklist...</p>
                </div>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">Add New Question</h2>
                <form id="addQuestionForm">
                    <div class="mb-4">
                        <label for="topic" class="block text-gray-700">Topic</label>
                        <input type="text" id="topic" class="w-full mt-1 p-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label for="grade" class="block text-gray-700">Grade</label>
                        <select id="grade" required class="w-full mt-1 p-2 border rounded">
                            <option value="">Select Grade</option>
                            <option value="3">Grade 3</option>
                            <option value="4">Grade 4</option>
                            <option value="5">Grade 5</option>
                            <option value="6">Grade 6</option>
                            <option value="7">Grade 7</option>
                            <option value="8">Grade 8</option>
                            <option value="9">Grade 9</option>
                            <option value="10">Grade 10</option>
                            <option value="11">Grade 11</option>
                            <option value="12">Grade 12</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label for="questionType" class="block text-gray-700">Question Type</label>
                        <select id="questionType" class="w-full mt-1 p-2 border rounded">
                            <option value="multiple-choice">Multiple Choice</option>
                            <option value="creative-writing">Creative Writing</option>
                            <option value="comprehension">Comprehension</option>
                        </select>
                    </div>
                    <div class="mb-4" id="writingTypeSection" style="display:none;">
                        <label for="writingType" class="block text-gray-700">Writing Type</label>
                        <select id="writingType" class="w-full mt-1 p-2 border rounded">
                            <option value="Narrative">Narrative</option>
                            <option value="Descriptive">Descriptive</option>
                            <option value="Persuasive">Persuasive</option>
                            <option value="Expository">Expository</option>
                            <option value="Poetry">Poetry</option>
                        </select>
                    </div>
                    <div class="mb-4" id="comprehensionSection" style="display:none;">
                        <label for="passage" class="block text-gray-700">Comprehension Passage</label>
                        <textarea id="passage" class="w-full mt-1 p-2 border rounded" rows="6" placeholder="Paste the full passage here..."></textarea>
                        <div id="comprehensionQuestions" class="mt-4">
                            <h4 class="font-semibold mb-2">Questions for this Passage</h4>
                            <div class="question-group mb-4 p-4 border rounded">
                                <textarea class="comp-question w-full mt-1 p-2 border rounded" rows="2" placeholder="Question"></textarea>
                                <div class="options-group flex space-x-2 mt-2">
                                    <input type="text" class="comp-option w-1/2 p-2 border rounded" placeholder="Option 1">
                                    <input type="text" class="comp-option w-1/2 p-2 border rounded" placeholder="Option 2">
                                </div>
                                <input type="text" class="comp-correct-answer w-full mt-2 p-2 border rounded" placeholder="Correct Answer">
                                <button type="button" class="add-comp-option-btn bg-gray-200 px-3 py-1 rounded text-sm mt-2">+ Add Option</button>
                            </div>
                        </div>
                        <button type="button" id="addCompQuestionBtn" class="bg-gray-200 px-3 py-1 rounded text-sm mt-2">+ Add Question</button>
                    </div>
                    <div class="mb-4">
                        <label for="questionText" class="block text-gray-700">Question Text</label>
                        <textarea id="questionText" class="w-full mt-1 p-2 border rounded" rows="3" required></textarea>
                    </div>
                    <div class="mb-4">
                        <label for="questionLocation" class="block text-gray-700">Location</label>
                        <select id="questionLocation" class="w-full mt-1 p-2 border rounded">
                            <option value="USA">USA</option>
                            <option value="UK">UK</option>
                            <option value="Canada">Canada</option>
                            <option value="Africa">Africa</option>
                            <option value="Switzerland">Switzerland</option>
                            <option value="Germany">Germany</option>
                        </select>
                    </div>
                    <div class="mb-4">
                        <label for="imageUpload" class="block text-gray-700">Image (Optional)</label>
                        <input type="file" id="imageUpload" class="w-full mt-1">
                    </div>
                    <div class="mb-4">
                        <label for="imagePosition" class="block text-gray-700">Image Position</label>
                        <select id="imagePosition" class="w-full mt-1 p-2 border rounded">
                            <option value="before">Before question</option>
                            <option value="after">After question</option>
                        </select>
                    </div>
                    <div id="optionsContainer" class="mb-4">
                        <h4 class="font-semibold mb-2">Options</h4>
                        <input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 1">
                        <input type="text" class="option-input w-full mt-1 p-2 border rounded" placeholder="Option 2">
                    </div>
                    <button type="button" id="addOptionBtn" class="bg-gray-200 px-3 py-1 rounded text-sm mb-4">+ Add Option</button>
                    <div class="mb-4" id="correctAnswerSection">
                        <label for="correctAnswer" class="block text-gray-700">Correct Answer</label>
                        <input type="text" id="correctAnswer" class="w-full mt-1 p-2 border rounded">
                    </div>
                    <button type="submit" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Save Question</button>
                    <p id="formMessage" class="mt-4 text-sm"></p>
                </form>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">View Student Reports</h2>
                <div class="mb-4">
                    <label for="studentDropdown" class="block text-gray-700">Select Student</label>
                    <select id="studentDropdown" class="w-full mt-1 p-2 border rounded"></select>
                </div>
                <div id="reportContent" class="space-y-4">
                    <p class="text-gray-500">Please select a student to view their report.</p>
                </div>
            </div>
        </div>
    `;

    const addQuestionForm = document.getElementById('addQuestionForm');
    const questionTypeDropdown = document.getElementById('questionType');
    const optionsContainer = document.getElementById('optionsContainer');
    const addOptionBtn = document.getElementById('addOptionBtn');
    const correctAnswerSection = document.getElementById('correctAnswerSection');
    const writingTypeSection = document.getElementById('writingTypeSection');
    const comprehensionSection = document.getElementById('comprehensionSection');
    const addCompQuestionBtn = document.getElementById('addCompQuestionBtn');
    const checklistContent = document.getElementById('checklistContent');

    async function loadChecklist() {
        checklistContent.innerHTML = `<p class="text-gray-500">Loading checklist...</p>`;
        const firestoreSnapshot = await getDocs(collection(db, "admin_questions"));
        const existingQuestions = firestoreSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

        try {
            const githubRes = await fetch(`https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/6-ela.json`);
            const githubData = githubRes.ok ? (await githubRes.json()).questions : [];

            let checklistHTML = '';
            githubData.forEach(q => {
                const needsImage = q.image_url === null || q.image_url === undefined;
                const needsPassage = q.passageId !== null && q.passage === null;

                if (needsImage || needsPassage) {
                    checklistHTML += `
                        <div class="p-4 border rounded-lg bg-gray-50 mb-4">
                            <h4 class="font-bold text-gray-800">${q.questionText || 'Comprehension Question'} (ID: ${q.id})</h4>
                            <p class="text-gray-600">${q.topic}</p>
                            <form class="update-form mt-2 space-y-2" data-question-id="${q.id}">
                                ${needsImage ? `
                                    <div class="border p-2 rounded-md bg-white">
                                        <h5 class="font-semibold text-red-500">❌ Missing Image</h5>
                                        <label for="imageUpload-${q.id}" class="block text-sm text-gray-700">Upload Image</label>
                                        <input type="file" id="imageUpload-${q.id}" class="w-full mt-1">
                                        <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded mt-2 text-sm">Upload Image</button>
                                    </div>
                                ` : ''}
                                ${needsPassage ? `
                                    <div class="border p-2 rounded-md bg-white">
                                        <h5 class="font-semibold text-red-500">❌ Missing Passage</h5>
                                        <label for="passageUpload-${q.id}" class="block text-sm text-gray-700">Paste Passage</label>
                                        <textarea id="passageUpload-${q.id}" class="w-full mt-1 p-2 border rounded" rows="4"></textarea>
                                        <button type="submit" class="bg-green-600 text-white px-4 py-2 rounded mt-2 text-sm">Save Passage</button>
                                    </div>
                                ` : ''}
                            </form>
                        </div>
                    `;
                }
            });
            checklistContent.innerHTML = checklistHTML || `<p class="text-gray-500">No content is missing from your GitHub files.</p>`;
        } catch (error) {
            console.error("Error loading checklist:", error);
            checklistContent.innerHTML = `<p class="text-red-500">Failed to load checklist from GitHub.</p>`;
        }
    }

    addQuestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const message = document.getElementById('formMessage');
        const imageFile = document.getElementById('imageUpload').files[0];

        try {
            message.textContent = "Uploading...";
            let imageUrl = null;
            if (imageFile) {
                imageUrl = await uploadImageToCloudinary(imageFile);
            }

            const questionType = form.questionType.value;
            let newQuestion;

            if (questionType === 'comprehension') {
                const questionsArray = [];
                form.querySelectorAll('.question-group').forEach(group => {
                    const compQuestion = group.querySelector('.comp-question').value;
                    const compOptions = Array.from(group.querySelectorAll('.comp-option')).map(input => input.value).filter(v => v);
                    const compCorrectAnswer = group.querySelector('.comp-correct-answer').value;

                    questionsArray.push({
                        question: compQuestion,
                        options: compOptions,
                        correct_answer: compCorrectAnswer,
                        type: 'multiple-choice',
                    });
                });
                newQuestion = {
                    topic: form.topic.value,
                    grade: form.grade.value,
                    passage: form.passage.value,
                    type: questionType,
                    location: form.questionLocation.value,
                    image_url: imageUrl,
                    image_position: form.imagePosition.value,
                    sub_questions: questionsArray
                };
            } else {
                const options = questionType === 'multiple-choice' ? Array.from(form.querySelectorAll('.option-input')).map(input => input.value).filter(v => v) : null;
                const correctAnswer = questionType === 'multiple-choice' ? form.correctAnswer.value : null;
                const writingType = questionType === 'creative-writing' ? form.writingType.value : null;
            
                newQuestion = {
                    topic: form.topic.value,
                    grade: form.grade.value,
                    question: form.questionText.value,
                    type: questionType,
                    location: form.questionLocation.value,
                    options: options,
                    correct_answer: correctAnswer,
                    image_url: imageUrl,
                    image_position: form.imagePosition.value,
                    writing_type: writingType,
                };
            }

            await addDoc(collection(db, "admin_questions"), newQuestion);
            message.textContent = "Question saved successfully!";
            message.style.color = 'green';
            form.reset();
            loadCounters();
            loadChecklist();
        } catch (error) {
            console.error("Error adding question:", error);
            message.textContent = "Error saving question.";
            message.style.color = 'red';
        }
    });

    document.getElementById('checklistContent').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const questionId = form.getAttribute('data-question-id');
        const imageFile = form.querySelector('input[type="file"]')?.files[0];
        const passageText = form.querySelector('textarea')?.value.trim();

        try {
            let updateData = {};
            if (imageFile) {
                const imageUrl = await uploadImageToCloudinary(imageFile);
                updateData.image_url = imageUrl;
            }
            if (passageText) {
                updateData.passage = passageText;
            }

            if (Object.keys(updateData).length > 0) {
                await updateDoc(doc(db, "admin_questions", questionId), updateData);
                alert("Content uploaded successfully!");
                loadChecklist(); // Refresh the checklist
            }

        } catch (error) {
            console.error("Error updating content:", error);
            alert("Error updating content.");
        }
    });

    const questionTypeDropdown = document.getElementById('questionType');
    const optionsContainer = document.getElementById('optionsContainer');
    const addOptionBtn = document.getElementById('addOptionBtn');
    const correctAnswerSection = document.getElementById('correctAnswerSection');
    const writingTypeSection = document.getElementById('writingTypeSection');
    const comprehensionSection = document.getElementById('comprehensionSection');
    const addCompQuestionBtn = document.getElementById('addCompQuestionBtn');
    
    questionTypeDropdown.addEventListener('change', (e) => {
        const type = e.target.value;
        optionsContainer.style.display = type === 'multiple-choice' ? 'block' : 'none';
        addOptionBtn.style.display = type === 'multiple-choice' ? 'inline-block' : 'none';
        correctAnswerSection.style.display = type === 'multiple-choice' ? 'block' : 'none';
        writingTypeSection.style.display = type === 'creative-writing' ? 'block' : 'none';
        comprehensionSection.style.display = type === 'comprehension' ? 'block' : 'none';
    });

    addCompQuestionBtn.addEventListener('click', () => {
        const compQuestionsContainer = document.getElementById('comprehensionQuestions');
        const questionCount = compQuestionsContainer.querySelectorAll('.question-group').length;
        const newQuestionGroup = document.createElement('div');
        newQuestionGroup.className = 'question-group mb-4 p-4 border rounded';
        newQuestionGroup.innerHTML = `
            <textarea class="comp-question w-full mt-1 p-2 border rounded" rows="2" placeholder="Question"></textarea>
            <div class="options-group flex space-x-2 mt-2">
                <input type="text" class="comp-option w-1/2 p-2 border rounded" placeholder="Option 1">
                <input type="text" class="comp-option w-1/2 p-2 border rounded" placeholder="Option 2">
            </div>
            <input type="text" class="comp-correct-answer w-full mt-2 p-2 border rounded" placeholder="Correct Answer">
            <button type="button" class="add-comp-option-btn bg-gray-200 px-3 py-1 rounded text-sm mt-2">+ Add Option</button>
        `;
        compQuestionsContainer.appendChild(newQuestionGroup);
    });

    document.getElementById('comprehensionQuestions').addEventListener('click', (e) => {
        if (e.target.classList.contains('add-comp-option-btn')) {
            const optionsGroup = e.target.closest('.question-group').querySelector('.options-group');
            const newInput = document.createElement('input');
            newInput.type = 'text';
            newInput.className = 'comp-option w-1/2 p-2 border rounded';
            newInput.placeholder = `Option ${optionsGroup.children.length + 1}`;
            optionsGroup.appendChild(newInput);
        }
    });

    const studentDropdown = document.getElementById('studentDropdown');
    getDocs(collection(db, "student_results")).then(studentReportsSnapshot => {
        studentDropdown.innerHTML = `<option value="">Select Student</option>`;
        studentReportsSnapshot.forEach(doc => {
            const student = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${student.studentName} (${student.parentEmail})`;
            studentDropdown.appendChild(option);
        });
    });

    studentDropdown.addEventListener('change', async (e) => {
        const docId = e.target.value;
        if (docId) {
            await loadAndRenderReport(docId);
        } else {
            document.getElementById('reportContent').innerHTML = `<p class="text-gray-500">Please select a student to view their report.</p>`;
        }
    });

    addOptionBtn.addEventListener('click', () => {
        const optionsContainer = document.getElementById('optionsContainer');
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'option-input w-full mt-1 p-2 border rounded';
        newInput.placeholder = `Option ${optionsContainer.children.length - 1}`;
        optionsContainer.appendChild(newInput);
    });

    addQuestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const message = document.getElementById('formMessage');
        const imageFile = document.getElementById('imageUpload').files[0];

        try {
            message.textContent = "Uploading...";
            let imageUrl = null;
            if (imageFile) {
                imageUrl = await uploadImageToCloudinary(imageFile);
            }

            const questionType = form.questionType.value;
            let newQuestion;

            if (questionType === 'comprehension') {
                const questionsArray = [];
                form.querySelectorAll('.question-group').forEach(group => {
                    const compQuestion = group.querySelector('.comp-question').value;
                    const compOptions = Array.from(group.querySelectorAll('.comp-option')).map(input => input.value).filter(v => v);
                    const compCorrectAnswer = group.querySelector('.comp-correct-answer').value;

                    questionsArray.push({
                        question: compQuestion,
                        options: compOptions,
                        correct_answer: compCorrectAnswer,
                        type: 'multiple-choice',
                    });
                });
                newQuestion = {
                    topic: form.topic.value,
                    grade: form.grade.value,
                    passage: form.passage.value,
                    type: questionType,
                    location: form.questionLocation.value,
                    image_url: imageUrl,
                    image_position: form.imagePosition.value,
                    sub_questions: questionsArray
                };
            } else {
                const options = questionType === 'multiple-choice' ? Array.from(form.querySelectorAll('.option-input')).map(input => input.value).filter(v => v) : null;
                const correctAnswer = questionType === 'multiple-choice' ? form.correctAnswer.value : null;
                const writingType = questionType === 'creative-writing' ? form.writingType.value : null;
            
                newQuestion = {
                    topic: form.topic.value,
                    grade: form.grade.value,
                    question: form.questionText.value,
                    type: questionType,
                    location: form.questionLocation.value,
                    options: options,
                    correct_answer: correctAnswer,
                    image_url: imageUrl,
                    image_position: form.imagePosition.value,
                    writing_type: writingType,
                };
            }

            await addDoc(collection(db, "admin_questions"), newQuestion);
            message.textContent = "Question saved successfully!";
            message.style.color = 'green';
            form.reset();
            loadCounters();
            loadChecklist();
        } catch (error) {
            console.error("Error adding question:", error);
            message.textContent = "Error saving question.";
            message.style.color = 'red';
        }
    });
}

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

async function loadAndRenderReport(docId) {
    const reportContent = document.getElementById('reportContent');
    reportContent.innerHTML = `<p class="text-gray-500">Loading report...</p>`;

    try {
        const reportDoc = await getDoc(doc(db, "student_results", docId));
        const data = reportDoc.data();

        const tutorEmail = data.tutorEmail || 'N/A';
        const tutorDoc = await getDoc(doc(db, "tutors", tutorEmail));
        const tutorName = tutorDoc.exists() ? tutorDoc.data().name : 'N/A';
        const fullName = capitalize(data.studentName);

        const creativeWritingAnswer = data.answers.find(a => a.type === 'creative-writing');
        const tutorReport = creativeWritingAnswer?.tutorReport || 'N/A';
        
        let correctCount = 0;
        data.answers.forEach(answerObject => {
            if (answerObject.type !== 'creative-writing' && String(answerObject.studentAnswer).toLowerCase() === String(answerObject.correctAnswer).toLowerCase()) {
                correctCount++;
            }
        });
        const totalScoreable = data.totalScoreableQuestions;
        const topics = [...new Set(data.answers.map(a => a.topic).filter(t => t))];


        reportContent.innerHTML = `
            <div class="border rounded-lg shadow mb-8 p-4 bg-white" id="report-block">
                <h2 class="text-xl font-bold mb-2">Student Name: ${fullName}</h2>
                <p><strong>Parent Email:</strong> ${data.parentEmail}</p>
                <p><strong>Grade:</strong> ${data.grade}</p>
                <p><strong>Tutor:</strong> ${tutorName || 'N/A'}</p>
                <p><strong>Location:</strong> ${data.studentCountry || 'N/A'}</p>
                <p><strong>Session Date:</strong> ${new Date(data.submittedAt.seconds * 1000).toLocaleString()}</p>
                <h3 class="text-lg font-semibold mt-4 mb-2">Performance Summary</h3>
                <p class="font-bold">Score: ${correctCount} / ${totalScoreable}</p>
                <h3 class="text-lg font-semibold mt-4 mb-2">Knowledge & Skill Analysis</h3>
                <p>${topics.join(', ') || 'N/A'}</p>
                <h3 class="text-lg font-semibold mt-4 mb-2">Tutor’s Recommendation</h3>
                <p class="mb-2"><strong>Tutor's Report:</strong> ${tutorReport}</p>
                <div class="mt-4">
                    <button id="downloadPdfBtn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Download Report PDF</button>
                </div>
            </div>
        `;
        
        document.getElementById('downloadPdfBtn').addEventListener('click', () => {
            const element = document.getElementById('report-block');
            html2pdf().from(element).save();
        });

    } catch (error) {
        console.error("Error loading report:", error);
        reportContent.innerHTML = `<p class="text-red-500">Failed to load report.</p>`;
    }
}

async function loadCounters() {
    const totalStudentsCount = document.getElementById('totalStudentsCount');
    const totalTutorsCount = document.getElementById('totalTutorsCount');
    const studentsPerTutorSelect = document.getElementById('studentsPerTutorSelect');

    const [studentsSnapshot, tutorsSnapshot] = await Promise.all([
        getDocs(collection(db, "student_results")),
        getDocs(collection(db, "tutors"))
    ]);

    totalStudentsCount.textContent = studentsSnapshot.docs.length;
    totalTutorsCount.textContent = tutorsSnapshot.docs.length;
    
    studentsPerTutorSelect.innerHTML = `<option value="">Students Per Tutor</option>`;
    for (const tutorDoc of tutorsSnapshot.docs) {
        const tutor = tutorDoc.data();
        const studentsQuery = query(collection(db, "student_results"), where("tutorEmail", "==", tutor.email));
        const studentsUnderTutor = await getDocs(studentsQuery);
        
        const option = document.createElement('option');
        option.textContent = `${tutor.name} (${studentsUnderTutor.docs.length} students)`;
        option.value = tutor.email;
        studentsPerTutorSelect.appendChild(option);
    }
}


onAuthStateChanged(auth, async (user) => {
    const adminContent = document.getElementById('adminContent');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user && user.email === ADMIN_EMAIL) {
        renderAdminPanel();
        await loadCounters();
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = "admin-auth.html";
        });
    } else {
        window.location.href = "admin-auth.html";
    }
});
