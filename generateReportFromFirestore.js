import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export async function fetchAndDisplayReport(parentEmail, studentName) {
  const reportsRef = collection(db, 'reports');
  const q = query(reportsRef, where('studentName', '==', studentName), where('parentEmail', '==', parentEmail));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error('Report not found.');
  }

  const doc = querySnapshot.docs[0];
  const reportData = doc.data();
  const filePath = reportData.filePath;

  if (!filePath) {
    throw new Error('Report found but missing file reference.');
  }

  const url = await getDownloadURL(ref(storage, filePath));

  const reportContainer = document.getElementById('reportContainer');
  const reportFrame = document.getElementById('reportFrame');
  const downloadLink = document.getElementById('downloadLink');

  reportFrame.src = url;
  downloadLink.href = url;
  reportContainer.classList.remove('hidden');
}
