import { fetchAndDisplayReport } from './generateReportFromFirestore.js';

document.getElementById('parentForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const studentName = document.getElementById('studentName').value.trim();
  const parentEmail = document.getElementById('parentEmail').value.trim();
  const status = document.getElementById('reportStatus');

  if (!studentName || !parentEmail) {
    status.innerText = 'Please fill in both fields.';
    return;
  }

  status.innerText = '🔍 Searching for report...';
  status.classList.remove('text-green-600', 'text-red-600');
  status.classList.add('text-yellow-600');

  try {
    await fetchAndDisplayReport(parentEmail, studentName);
    status.classList.remove('text-yellow-600');
    status.classList.add('text-green-600');
  } catch (err) {
    console.error('Error fetching report:', err);
    status.innerText = '❌ Could not retrieve the report.';
    status.classList.remove('text-yellow-600');
    status.classList.add('text-red-600');
  }
});
