import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, onAuthStateChanged, signOut, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';
const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;


async function uploadContentToFirebase(questionId, newContent) {
    // Logic to find the question and update it in Firestore
    const questionRef = doc(db, "admin_questions", questionId);
    await updateDoc(questionRef, newContent);
}

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

async function loadChecklist() {
    const checklistContent = document.getElementById('checklistContent');
    checklistContent.innerHTML = `<p class="text-gray-500">Loading checklist...</p>`;
    
    const GITHUB_URL = `https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/6-ela.json`;
    const firestoreSnapshot = await getDocs(collection(db, "admin_questions"));
    const existingQuestions = firestoreSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

    try {
        const githubRes = await fetch(GITHUB_URL);
        const githubData = githubRes.ok ? (await githubRes.json()).questions : [];

        let checklistHTML = '<div>';
        githubData.forEach(q => {
            const needsImage = q.image === null || q.image === undefined;
            const needsPassage = q.passageId !== null && !existingQuestions.some(eq => eq.passageId === q.passageId && eq.passage);

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

        document.querySelectorAll('.update-form').forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const questionId = form.getAttribute('data-question-id');
                const imageInput = form.querySelector('input[type="file"]');
                const passageInput = form.querySelector('textarea');
                
                let updateData = {};
                if (imageInput && imageInput.files[0]) {
                    const imageUrl = await uploadImageToCloudinary(imageInput.files[0]);
                    updateData.image_url = imageUrl;
                }
                if (passageInput && passageInput.value.trim()) {
                    updateData.passage = passageInput.value.trim();
                }

                if (Object.keys(updateData).length > 0) {
                    await updateDoc(doc(db, "admin_questions", questionId), updateData);
                    alert("Content uploaded successfully!");
                    loadChecklist(); // Refresh the checklist
                }
            });
        });

    } catch (error) {
        console.error("Error loading checklist:", error);
        checklistContent.innerHTML = `<p class="text-red-500">Failed to load checklist from GitHub.</p>`;
    }
}


onAuthStateChanged(auth, (user) => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (user && user.email === ADMIN_EMAIL) {
        loadChecklist();
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = "admin-auth.html";
        });
    } else {
        window.location.href = "admin-auth.html";
    }
});
