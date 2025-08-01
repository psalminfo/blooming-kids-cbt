import { db, storage } from './firebaseConfig.js';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export async function fetchAndDisplayReport(parentEmail, studentName) {
  try {
    const reportsRef = collection(db, 'studentReports');
    const q = query(
      reportsRef,
      where('parentEmail', '==', parentEmail),
      where('studentName', '==', studentName),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      document.getElementById('reportStatus').innerHTML = '❌ No report found for this student.';
      return;
    }

    const reportData = querySnapshot.docs[0].data();
    const fileUrl = reportData.reportUrl;

    if (!fileUrl) {
      document.getElementById('reportStatus').innerHTML = '⚠️ Report found but missing file reference.';
      return;
    }

    // Show embedded preview
    const previewFrame = document.getElementById('reportPreview');
    previewFrame.src = fileUrl;
    previewFrame.classList.remove('hidden');

    // Show download link
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.href = fileUrl;
    downloadBtn.classList.remove('hidden');
    downloadBtn.innerText = '⬇️ Download Report';
  } catch (error) {
    console.error('Error fetching report:', error);
    document.getElementById('reportStatus').innerHTML = '❌ Error retrieving report. Please try again.';
  }
}
