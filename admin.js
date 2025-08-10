import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, addDoc, query, where, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';

const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// These variables are now declared globally
let addQuestionForm, questionTypeDropdown, optionsContainer, addOptionBtn, correctAnswerSection;
let writingTypeSection, comprehensionSection, addCompQuestionBtn;
let checklistContent, studentDropdown, reportContent;
let studentReportsSnapshot, tutorsSnapshot;

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

async function loadAndRenderReport(docId) {
    reportContent.innerHTML = `<p class="text-gray-500">Loading report...</p>`;
    try {
        const reportDoc = await getDoc(doc(db, "student_results", docId));
        const data = reportDoc.data();
        const tutorEmail = data.tutorEmail || 'N/A';
        const tutorDoc = await getDoc(doc(db, "tutors", tutorEmail));
        const tutorName = tutorDoc.exists() ? tutorDoc.data().name : 'N/A';
        const fullName = data.studentName;
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

async function loadChecklist() {
    const checklistContent = document.getElementById('checklistContent');
    checklistContent.innerHTML = `<p class="text-gray-500">Loading checklist...</p>`;
    
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/6-ela.json`;

    try {
        const githubRes = await fetch(GITHUB_URL);
        const githubData = githubRes.ok ? (await githubRes.json()).questions : [];
        const firestoreSnapshot = await getDocs(collection(db, "admin_questions"));
        const existingQuestions = firestoreSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

        let checklistHTML = '';
        githubData.forEach(q => {
            const needsImage = q.image === undefined || q.image === null;
            const needsPassage = q.passageId !== null && !existingQuestions.some(eq => eq.passageId === q.passageId);

            if (needsImage || needsPassage) {
                checklistHTML += `
                    <div class="p-4 border rounded-lg bg-gray-50 mb-4">
                        <p class="font-semibold">${q.questionText || 'Comprehension Question'} (ID: ${q.id})</p>
                        ${needsImage ? `<p class="text-red-500">❌ Missing Image</p>` : ''}
                        ${needsPassage ? `<p class="text-red-500">❌ Missing Passage</p>` : ''}
                        <button class="update-content-btn bg-green-500 text-white px-4 py-2 rounded mt-2" data-question-id="${q.id}">Add Content</button>
                    </div>
                `;
            }
        });
        checklistContent.innerHTML = checklistHTML || `<p class="text-gray-500">No content is missing from your GitHub files.</p>`;

        document.querySelectorAll('.update-content-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const questionId = e.target.getAttribute('data-question-id');
                // You would implement a modal or a separate form here
                alert(`Placeholder for editing question with ID: ${questionId}`);
            });
        });
    } catch (error) {
        console.error("Error loading checklist:", error);
        checklistContent.innerHTML = `<p class="text-red-500">Failed to load checklist from GitHub.</p>`;
    }
}

onAuthStateChanged(auth, async (user) => {
    const adminContent = document.getElementById('adminContent');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user && user.email === ADMIN_EMAIL) {
        await loadCounters();
        await loadChecklist(); // Call loadChecklist after the panel is rendered
        
        // After rendering the content, get the elements and attach listeners
        addQuestionForm = document.getElementById('addQuestionForm');
        questionTypeDropdown = document.getElementById('questionType');
        optionsContainer = document.getElementById('optionsContainer');
        addOptionBtn = document.getElementById('addOptionBtn');
        correctAnswerSection = document.getElementById('correctAnswerSection');
        writingTypeSection = document.getElementById('writingTypeSection');
        comprehensionSection = document.getElementById('comprehensionSection');
        addCompQuestionBtn = document.getElementById('addCompQuestionBtn');
        checklistContent = document.getElementById('checklistContent');
        studentDropdown = document.getElementById('studentDropdown');
        reportContent = document.getElementById('reportContent');

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
    } else {
        window.location.href = "admin-auth.html";
    }
});

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
