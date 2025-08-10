// checklist.js
import { auth, db } from './firebaseConfig.js';
import { collection, doc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';
const CLOUDINARY_CLOUD_NAME = 'dy2hxcyaf';
const CLOUDINARY_UPLOAD_PRESET = 'bkh_assessments';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// --- Re-usable upload function ---
async function uploadImageToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
    if (!res.ok) throw new Error("Image upload failed");
    const data = await res.json();
    return data.secure_url;
}

// --- Main Checklist Logic ---
async function initializeChecklist() {
    const passageSelect = document.getElementById('passage-select');
    const passageContent = document.getElementById('passage-content');
    const updatePassageBtn = document.getElementById('update-passage-btn');
    const imageList = document.getElementById('image-list');
    const statusDiv = document.getElementById('status');

    let questionsData = []; // Store question data to work with

    // Fetch all questions
    try {
        const snapshot = await getDocs(collection(db, "admin_questions"));
        questionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        statusDiv.textContent = 'Error loading questions.';
        console.error(error);
        return;
    }

    // Populate Passages
    passageSelect.innerHTML = '<option value="">-- Select a Passage --</option>';
    const incompletePassages = questionsData.filter(q => q.type === 'comprehension' && !q.passage);
    incompletePassages.forEach(q => {
        const option = document.createElement('option');
        option.value = q.id;
        option.textContent = `✗ ${q.topic} (Grade ${q.grade})`;
        passageSelect.appendChild(option);
    });

    // Populate Images
    imageList.innerHTML = '';
    const incompleteImages = questionsData.filter(q => q.image_url === null || q.image_url === undefined);
    if (incompleteImages.length === 0) {
        imageList.innerHTML = '<li><p class="text-gray-500">No images are missing. Great job!</p></li>';
    } else {
        incompleteImages.forEach(q => {
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between p-3 border rounded';
            li.innerHTML = `
                <span>✗ ${q.question || q.topic} (ID: ${q.id.substring(0, 5)}...)</span>
                <div class="flex items-center">
                    <input type="file" id="image-upload-${q.id}" class="text-sm">
                    <button class="upload-image-btn bg-blue-600 text-white px-3 py-1 rounded text-sm ml-2" data-id="${q.id}">Upload</button>
                </div>
            `;
            imageList.appendChild(li);
        });
    }

    // --- Event Listeners ---
    updatePassageBtn.addEventListener('click', async () => {
        const questionId = passageSelect.value;
        const content = passageContent.value;
        if (!questionId || !content.trim()) {
            statusDiv.textContent = 'Please select a passage and enter content.';
            return;
        }
        statusDiv.textContent = 'Updating passage...';
        try {
            const questionRef = doc(db, 'admin_questions', questionId);
            await updateDoc(questionRef, { passage: content });
            statusDiv.textContent = '✅ Passage updated successfully!';
            setTimeout(() => initializeChecklist(), 2000); // Refresh list
        } catch (error) {
            statusDiv.textContent = 'Error updating passage.';
            console.error(error);
        }
    });

    imageList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('upload-image-btn')) {
            const questionId = e.target.dataset.id;
            const fileInput = document.getElementById(`image-upload-${questionId}`);
            const file = fileInput.files[0];
            if (!file) {
                statusDiv.textContent = 'Please select an image file to upload.';
                return;
            }
            statusDiv.textContent = 'Uploading image...';
            try {
                const imageUrl = await uploadImageToCloudinary(file);
                const questionRef = doc(db, 'admin_questions', questionId);
                await updateDoc(questionRef, { image_url: imageUrl });
                statusDiv.textContent = `✅ Image uploaded successfully for Q-ID ${questionId.substring(0,5)}!`;
                setTimeout(() => initializeChecklist(), 2000); // Refresh list
            } catch (error) {
                statusDiv.textContent = 'Error uploading image.';
                console.error(error);
            }
        }
    });
}

// --- Auth Check ---
onAuthStateChanged(auth, async (user) => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (user && user.email === ADMIN_EMAIL) {
        initializeChecklist();
        logoutBtn.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = "admin-auth.html";
        });
    } else {
        window.location.href = "admin-auth.html";
    }
});
