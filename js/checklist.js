// js/checklist.js
export function getChecklistHTML() {
    return `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Passage Upload</h2>
            <p>Select a passage that is marked as incomplete to upload the full text.</p>
            <label for="passage-select" class="mt-4">Select Passage to Update:</label>
            <select id="passage-select" class="w-full mt-1 p-2 border rounded"><option>-- Loading... --</option></select>
            <textarea id="passage-content" placeholder="Passage content will appear here..." class="w-full mt-1 p-2 border rounded h-40"></textarea>
            <button id="update-passage-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-2">Update Passage</button>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-md">
            <h2 class="text-2xl font-bold text-green-700 mb-4">Missing Images</h2>
            <p>Select a question that is missing an image and provide the image file name or URL.</p>
            <label for="image-select" class="mt-4">Select Question with Missing Image:</label>
            <select id="image-select" class="w-full mt-1 p-2 border rounded"><option>-- Loading... --</option></select>
            <input type="text" id="image-path" class="w-full mt-1 p-2 border rounded" placeholder="Enter image path (e.g., assets/image.png)">
            <button id="update-image-btn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-2">Update Image Path</button>
        </div>
        <p id="status" class="mt-4 font-bold"></p>
        <button id="download-json-btn" class="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 mt-4">Download Updated JSON</button>
    `;
}

export function initializeChecklist() {
    // --- Data (pasted from original for encapsulation) ---
    const contentData = {
      "tests": [
        { "id": "staar_g3_reading_2018", "subject": "Reading", "grade": 3, "passages": [{"passageId": "p1", "title": "Racing Team", "content": "[PASSAGE TEXT TO BE UPLOADED]"}], "questions": [{"questionId": "g3r_2", "passageId": "p1", "imagePlaceholder": "g3r_p1_illustration.png"}]},
        { "id": "staar_g4_math_2022", "subject": "Mathematics", "grade": 4, "questions": [{"questionId": "g4m_4", "imagePlaceholder": "g4m_q4_lines.png"}]}
      ]
    };

    const passageSelect = document.getElementById('passage-select');
    const imageSelect = document.getElementById('image-select');
    const statusDiv = document.getElementById('status');

    function populateDropdowns() {
        passageSelect.innerHTML = '<option value="">-- Select a Passage --</option>';
        imageSelect.innerHTML = '<option value="">-- Select an Image --</option>';

        contentData.tests.forEach((test, testIndex) => {
            if(test.passages) {
                test.passages.forEach((passage, passageIndex) => {
                    const isComplete = !passage.content.includes("[PASSAGE TEXT TO BE UPLOADED]");
                    const option = document.createElement('option');
                    option.value = `${testIndex}-${passageIndex}`;
                    option.textContent = `${test.subject} G${test.grade}: ${passage.title} ${isComplete ? '✓' : '✗'}`;
                    passageSelect.appendChild(option);
                });
            }
            if(test.questions) {
                test.questions.forEach((question, questionIndex) => {
                    if (question.imagePlaceholder) {
                         const option = document.createElement('option');
                         option.value = `${testIndex}-${questionIndex}`;
                         option.textContent = `Q-ID ${question.questionId}: ${question.imagePlaceholder}`;
                         imageSelect.appendChild(option);
                    }
                });
            }
        });
    }

    document.getElementById('update-image-btn').addEventListener('click', () => {
        // Your logic to update the image path here
        statusDiv.textContent = '✅ Image path updated!';
    });
    
    // ... all other event listeners for the checklist ...

    populateDropdowns();
}
