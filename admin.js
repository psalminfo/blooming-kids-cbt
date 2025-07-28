const correctEmail = 'psalm4all@gmail.com';
const correctPassword = 'oladunjoyE25';

const form = document.getElementById('adminLoginForm');
const logout = document.getElementById('logoutBtn');

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value.trim();
    const pass = document.getElementById('adminPassword').value;

    if (email === correctEmail && pass === correctPassword) {
      localStorage.setItem('adminLoggedIn', 'yes');
      window.location.href = 'admin.html';
    } else {
      alert('Invalid credentials.');
    }
  });
}

if (logout) {
  logout.addEventListener('click', () => {
    localStorage.removeItem('adminLoggedIn');
    window.location.href = 'login-admin.html';
  });
}

if (window.location.pathname.includes('admin.html')) {
  if (localStorage.getItem('adminLoggedIn') !== 'yes') {
    alert('Not authorized.');
    window.location.href = 'login-admin.html';
  }

  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabSections = document.querySelectorAll('.tab-section');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      tabSections.forEach(sec => sec.classList.add('hidden'));
      document.getElementById(target).classList.remove('hidden');
    });
  });

  document.getElementById('uploadBtn').addEventListener('click', () => {
    const fileInput = document.getElementById('jsonFile');
    const file = fileInput.files[0];
    const status = document.getElementById('uploadStatus');

    if (!file || !file.name.endsWith('.json')) {
      status.textContent = 'Please select a valid JSON file.';
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const questions = JSON.parse(e.target.result);
        console.log('Uploading questions:', questions);
        status.textContent = 'Questions uploaded (simulated).';
        // Firestore upload logic goes here
      } catch (err) {
        status.textContent = 'Invalid JSON format.';
      }
    };
    reader.readAsText(file);
  });

  // Load reports (simulated)
  const reportTable = document.getElementById('reportTable');
  if (reportTable) {
    const dummy = [
      { name: 'Sarah Jones', subject: 'Math', date: '2025-07-28', link: '#' },
      { name: 'David Ike', subject: 'ELA', date: '2025-07-28', link: '#' }
    ];
    reportTable.innerHTML = dummy.map(r => `
      <div class="bg-white border p-4 rounded">
        <p><strong>${r.name}</strong> - ${r.subject}</p>
        <p class="text-sm text-gray-500">${r.date}</p>
        <a href="${r.link}" target="_blank" class="text-green-700 underline">Download</a>
      </div>
    `).join('');
  }
}
