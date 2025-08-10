// admin.js
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
                            <option value="3">Grade 3</option><option value="4">Grade 4</option><option value="5">Grade 5</option>
                            <option value="6">Grade 6</option><option value="7">Grade 7</option><option value="8">Grade 8</option>
                            <option value="9">Grade 9</option><option value="10">Grade 10</option><option value="11">Grade 11</option><option value="12">Grade 12</option>
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
                            <option value="Narrative">Narrative</option><option value="Descriptive">Descriptive</option><option value="Persuasive">Persuasive</option><option value="Expository">Expository</option><option value="Poetry">Poetry</option>
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
                            <option value="USA">USA</option><option value="UK">UK</option><option value="Canada">Canada</option><option value="Africa">Africa</option><option value="Switzerland">Switzerland</option><option value="Germany">Germany</option>
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
    
    questionTypeDropdown.addEventListener('change', (e) => {
        const type = e.target.value;
        const questionText = document.querySelector('label[for="questionText"]').parentElement;
        const options = document.getElementById('optionsContainer').parentElement;

        document.getElementById('optionsContainer').style.display = type === 'multiple-choice' ? 'block' : 'none';
        document.getElementById('addOptionBtn').style.display = type === 'multiple-choice' ? 'block' : 'none';
        document.getElementById('correctAnswerSection').style.display = type === 'multiple-choice' ? 'block' : 'none';
        document.getElementById('writingTypeSection').style.display = type === 'creative-writing' ? 'block' : 'none';
        document.getElementById('comprehensionSection').style.display = type === 'comprehension' ? 'block' : 'none';
        questionText.style.display = type === 'comprehension' ? 'none' : 'block';
    });

    addCompQuestionBtn.addEventListener('click', () => { /* ... your original code ... */ });
    document.getElementById('comprehensionQuestions').addEventListener('click', (e) => { /* ... your original code ... */ });

    const studentDropdown = document.getElementById('studentDropdown');
    getDocs(collection(db, "student_results")).then(snapshot => { /* ... your original code ... */ });
    studentDropdown.addEventListener('change', async (e) => { /* ... your original code ... */ });

    addOptionBtn.addEventListener('click', () => { /* ... your original code ... */ });
    addQuestionForm.addEventListener('submit', async (e) => { /* ... your original code ... */ });
}

function capitalize(str) { return str.replace(/\b\w/g, l => l.toUpperCase()); }

async function loadAndRenderReport(docId) { /* ... your original code ... */ }
async function loadCounters() { /* ... your original code ... */ }

onAuthStateChanged(auth, async (user) => {
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
