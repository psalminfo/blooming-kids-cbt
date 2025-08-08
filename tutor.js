import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, updateDoc, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

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

function renderTutorPanel(tutor) {
    const tutorContent = document.getElementById('tutorContent');
    tutorContent.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">Add New Question</h2>
                <form id="addQuestionForm">
                    <div class="mb-4">
                        <label for="topic" class="block text-gray-700">Topic</label>
                        <input type="text" id="topic" class="w-full mt-1 p-2 border rounded" required>
                    </div>
                    <div class="mb-4">
                        <label for="questionText" class="block text-gray-700">Question Text</label>
                        <textarea id="questionText" class="w-full mt-1 p-2 border rounded" rows="3" required></textarea>
                    </div>
                    <div class="mb-4">
                        <label for="questionType" class="block text-gray-700">Question Type</label>
                        <select id="questionType" class="w-full mt-1 p-2 border rounded">
                            <option value="multiple-choice">Multiple Choice</option>
                            <option value="creative-writing">Creative Writing</option>
                        </select>
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
                    <div class="mb-4">
                        <label for="correctAnswer" class="block text-gray-700">Correct Answer</label>
                        <input type="text" id="correctAnswer" class="w-full mt-1 p-2 border rounded">
                    </div>
                    <button type="submit" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">Save Question</button>
                    <p id="formMessage" class="mt-4 text-sm"></p>
                </form>
            </div>

            <div class="bg-white p-6 rounded-lg shadow-md">
                <h2 class="text-2xl font-bold text-green-700 mb-4">Your Students' Reports</h2>
                <div class="mb-4">
                    <input type="email" id="searchEmail" class="w-full mt-1 p-2 border rounded" placeholder="Search by parent email...">
                    <button id="searchBtn" class="bg-blue-600 text-white px-4 py-2 rounded mt-2 hover:bg-blue-700">Search</button>
                </div>
                <div id="reportsContainer" class="space-y-4">
                    <p class="text-gray-500">Loading reports...</p>
                </div>
            </div>
        </div>
    `;

    document.getElementById('addOptionBtn').addEventListener('click', () => {
        const optionsContainer = document.getElementById('optionsContainer');
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'option-input w-full mt-1 p-2 border rounded';
        newInput.placeholder = `Option ${optionsContainer.children.length - 1}`;
        optionsContainer.appendChild(newInput);
    });

    document.getElementById('addQuestionForm').addEventListener('submit', async (e) => {
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
            const options = questionType === 'multiple-choice' ? Array.from(form.querySelectorAll('.option-input')).map(input => input.value).filter(v => v) : null;
            const correctAnswer = questionType === 'multiple-choice' ? form.correctAnswer.value : null;
            
            const newQuestion = {
                topic: form.topic.value,
                question: form.questionText.value,
                type: questionType,
                location: form.questionLocation.value,
                options: options,
                correct_answer: correctAnswer,
                image_url: imageUrl,
                image_position: form.imagePosition.value,
                uploadedBy: tutor.email
            };

            await addDoc(collection(db, "admin_questions"), newQuestion);
            message.textContent = "Question saved successfully!";
            message.style.color = 'green';
            form.reset();

        } catch (error) {
            console.error("Error adding question:", error);
            message.textContent = "Error saving question.";
            message.style.color = 'red';
        }
    });

    document.getElementById('searchBtn').addEventListener('click', async () => {
        const email = document.getElementById('searchEmail').value;
        await loadTutorReports(tutor.email, email);
    });

    loadTutorReports(tutor.email);
}

async function loadTutorReports(tutorEmail, parentEmail = null) {
    const reportsContainer = document.getElementById('reportsContainer');
    reportsContainer.innerHTML = `<p class="text-gray-500">Loading reports...</p>`;
    
    let query = collection(db, "student_results");
    query = query.where("tutorEmail", "==", tutorEmail);

    if (parentEmail) {
        query = query.where("parentEmail", "==", parentEmail);
    }
    
    try {
        const querySnapshot = await getDocs(query);
        let reportHTML = '';
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const creativeWritingAnswer = data.answers.find(a => a.type === 'creative-writing');
            reportHTML += `
                <div class="border rounded-lg p-4 shadow-sm bg-white">
                    <p><strong>Student:</strong> ${data.studentName}</p>
                    <p><strong>Email:</strong> ${data.parentEmail}</p>
                    <p><strong>Subject:</strong> ${data.subject}</p>
                    <p><strong>Grade:</strong> ${data.grade}</p>
                    <p><strong>Submitted At:</strong> ${new Date(data.submittedAt.seconds * 1000).toLocaleString()}</p>
                    ${creativeWritingAnswer ? `
                        <div class="mt-4 border-t pt-4">
                            <h4 class="font-semibold">Creative Writing Submission:</h4>
                            <p class="italic">${creativeWritingAnswer.studentResponse || "No response"}</p>
                            ${creativeWritingAnswer.fileUrl ? `<a href="${creativeWritingAnswer.fileUrl}" target="_blank" class="text-blue-500 hover:underline">Download File</a>` : ''}
                            <p class="mt-2"><strong>Grade:</strong> ${creativeWritingAnswer.tutorGrade || 'Pending'}</p>
                            <textarea class="tutor-report w-full mt-2 p-2 border rounded" rows="3" placeholder="Write your report here..."></textarea>
                            <button class="submit-report-btn bg-green-600 text-white px-4 py-2 rounded mt-2" data-doc-id="${doc.id}">Submit Report</button>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        reportsContainer.innerHTML = reportHTML || `<p class="text-gray-500">No reports found.</p>`;

        document.querySelectorAll('.submit-report-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const docId = e.target.getAttribute('data-doc-id');
                const reportTextarea = e.target.closest('.border').querySelector('.tutor-report');
                const tutorReport = reportTextarea.value.trim();

                if (tutorReport) {
                    const docRef = doc(db, "student_results", docId);
                    await updateDoc(docRef, {
                        "answers": data.answers.map(a => a.type === 'creative-writing' ? { ...a, tutorReport: tutorReport, tutorGrade: 'Graded' } : a)
                    });
                    loadTutorReports(tutorEmail); // Refresh the list
                }
            });
        });
    } catch (error) {
        console.error("Error loading tutor reports:", error);
        reportsContainer.innerHTML = `<p class="text-red-500">Failed to load reports.</p>`;
    }
}


onAuthStateChanged(auth, async (user) => {
    const tutorContent = document.getElementById('tutorContent');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user) {
        const tutorRef = doc(db, "tutors", user.email);
        const tutorSnap = await getDoc(tutorRef);

        if (tutorSnap.exists()) {
            renderTutorPanel(tutorSnap.data());
            logoutBtn.addEventListener('click', async () => {
                await signOut(auth);
                window.location.href = "index.html";
            });
        } else {
            tutorContent.innerHTML = `<p class="text-center mt-12 text-red-600">Your account is not registered as a tutor.</p>`;
            logoutBtn.classList.add('hidden');
        }

    } else {
        tutorContent.innerHTML = `
            <div class="text-center mt-12">
                <h2 class="text-2xl font-bold text-red-600">Access Denied</h2>
                <p class="text-gray-600 mt-2">You must be logged in as a tutor to view this page.</p>
                <a href="index.html" class="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Go to Login</a>
            </div>
        `;
        logoutBtn.classList.add('hidden');
    }
});