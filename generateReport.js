import { db } from './firebaseConfig.js';
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

export async function submitTestToFirebase(subject, grade, studentName, parentEmail, tutorName, location) {
  const answers = Array.from(document.querySelectorAll("input:checked")).map(input => input.value);

  const resultData = {
    subject,
    grade,
    studentName,
    parentEmail,
    tutorName,
    location,
    answers,
    submittedAt: Timestamp.now()
  };

  await addDoc(collection(db, "student_results"), resultData);
}
