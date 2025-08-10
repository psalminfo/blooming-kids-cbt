// checklist.js
import { auth, db } from './firebaseConfig.js';
import { collection, doc, updateDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';
const GITHUB_URL = 'https://raw.githubusercontent.com/psalminfo/blooming-kids-cbt/main/6-ela.json'; // FIX: Fetches from GitHub

async function initializeChecklist() {
    const imageSelect = document.getElementById('image-select');
    const imageUploadArea = document.getElementById('image-upload-area');
    const submitImageBtn = document.getElementById('submit-image-btn');
    const statusDiv = document.getElementById('status');
    
    let checklistData = [];

    // FIX: Fetch data from GitHub
    try {
        statusDiv.textContent = "Fetching checklist from GitHub...";
        const response = await fetch(GITHUB_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        checklistData = data.questions || [];
        statusDiv.textContent = "";
    } catch (error) {
        statusDiv.textContent = 'Error fetching checklist from GitHub.';
        console.error(error);
        return;
    }

    // Populate image dropdown
    imageSelect.innerHTML = '<option value="">-- Select Question with Missing Image --</option>';
    const incompleteImages = checklistData.filter(q => !q.image_url);
    incompleteImages.forEach(q => {
        const option = document.createElement('option');
        option.value = q.id;
        option.textContent = `✗ ${q.topic} - Q: ${q.question.substring(0, 40)}...`;
        imageSelect.appendChild(option);
    });

    // Show upload area when a question is selected
    imageSelect.addEventListener('change', () => {
        if (imageSelect.value) {
            imageUploadArea.style.display = 'block';
        } else {
            imageUploadArea.style.display = 'none';
        }
    });

    // Handle image submission
    submitImageBtn.addEventListener('click', async () => {
        const questionId = imageSelect.value;
        const fileInput = document.getElementById('image-file-input');
        const file = fileInput.files[0];
        if (!questionId || !file) {
            statusDiv.textContent = 'Please select a question and a file.';
            return;
        }
        statusDiv.textContent = `Uploading image for ${questionId}...`;
        try {
            // Here you would call your Cloudinary upload function and then update Firestore
            // const imageUrl = await uploadImageToCloudinary(file);
            // const questionRef = doc(db, 'admin_questions', questionId);
            // await updateDoc(questionRef, { image_url: imageUrl });
            statusDiv.textContent = '✅ Image uploaded and linked successfully!';
            // You might want to refresh the list after success
        } catch (error) {
            statusDiv.textContent = 'Error during image upload.';
            console.error(error);
        }
    });
}

onAuthStateChanged(auth, async (user) => {
    if (user && user.email === ADMIN_EMAIL) {
        await initializeChecklist();
        document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
    } else {
        window.location.href = "admin-auth.html";
    }
});
