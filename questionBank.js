import { db } from './firebaseConfig.js';
import { collection, addDoc } from 'firebase/firestore';

async function uploadJSONFile() {
  const fileInput = document.getElementById('uploadJSON');
  const status = document.getElementById('uploadStatus');
  if (!fileInput.files.length) return alert("Select a file.");

  const file = fileInput.files[0];
  const text = await file.text();
  const questions = JSON.parse(text);

  const batch = questions.map(q => addDoc(collection(db, 'manualQuestions'), q));
  await Promise.all(batch);

  status.textContent = `Uploaded ${questions.length} questions successfully.`;
}

window.uploadJSONFile = uploadJSONFile;
