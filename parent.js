document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('parentLoginForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const reportList = document.getElementById('reportList');

  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const child = document.getElementById('childName').value.trim().toLowerCase();
      const email = document.getElementById('parentEmail').value.trim().toLowerCase();
      localStorage.setItem('reportQuery', JSON.stringify({ child, email }));
      window.location.href = 'parent.html';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('reportQuery');
      window.location.href = 'login-parent.html';
    });
  }

  if (reportList) {
    const { child, email } = JSON.parse(localStorage.getItem('reportQuery') || '{}');

    // Simulated fetch (replace with Firestore fetch in real)
    setTimeout(() => {
      const dummyReports = [
        {
          subject: 'Math',
          url: 'https://res.cloudinary.com/dy2hxcyaf/image/upload/v123456/report-math.pdf',
          date: '2025-07-28'
        },
        {
          subject: 'ELA',
          url: 'https://res.cloudinary.com/dy2hxcyaf/image/upload/v123456/report-ela.pdf',
          date: '2025-07-28'
        }
      ];

      reportList.innerHTML = dummyReports.map(r => `
        <div class="bg-white shadow p-4 rounded mb-4">
          <h3 class="text-lg font-bold text-green-700">${r.subject} Report</h3>
          <p class="text-sm text-gray-600">Date: ${r.date}</p>
          <a href="${r.url}" target="_blank" class="inline-block mt-2 px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700">Download</a>
        </div>
      `).join('');
    }, 1000);
  }
});
