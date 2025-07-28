import { db } from './firebaseConfig.js';
import { setDoc, doc } from "firebase/firestore";

document.getElementById('uploadBtn').addEventListener('click', async () => {
  const file = document.getElementById('jsonInput').files[0];
  const grade = document.getElementById('gradeSelect').value;
  const subject = document.getElementById('subjectSelect').value;
  if (!file || !grade || !subject) return alert("Fill all fields");

  const content = await file.text();
  const json = JSON.parse(content);

  await setDoc(doc(db, `questions/${grade}/${subject}`, "manual"), {
    questions: json
  });

  alert("Questions uploaded!");
});
