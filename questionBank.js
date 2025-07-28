import { db } from './firebaseConfig.js';
import { setDoc, doc } from 'firebase/firestore';

document.getElementById('uploadJsonBtn')?.addEventListener('click', async () => {
  const file = document.getElementById('jsonUpload').files[0];
  if (!file) return alert('Please select a JSON file.');

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const id = `${data.grade}-${data.subject}-${Date.now()}`;
      await setDoc(doc(db, 'manualQuestions', id), {
        ...data,
        uploadedAt: new Date()
      });
      document.getElementById('uploadStatus').textContent = 'Upload successful!';
    } catch (err) {
      console.error(err);
      document.getElementById('uploadStatus').textContent = 'Error uploading JSON.';
    }
  };
  reader.readAsText(file);
});
