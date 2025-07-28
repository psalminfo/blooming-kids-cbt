import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

document.getElementById('adminLoginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('adminEmail').value;
  const password = document.getElementById('adminPassword').value;

  if (email === 'psalm4all@gmail.com' && password === 'oladunjoyE25') {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem('adminAuth', 'true');
      window.location.href = 'admin.html';
    } catch (err) {
      alert('Login failed. Check credentials or Firebase setup.');
    }
  } else {
    alert('Invalid admin credentials.');
  }
});

if (window.location.pathname.includes('admin.html')) {
  if (!localStorage.getItem('adminAuth')) window.location.href = 'login-admin.html';

  document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth);
    localStorage.removeItem('adminAuth');
    window.location.href = 'login-admin.html';
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-section').forEach(sec => sec.classList.add('hidden'));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
    });
  });
}
