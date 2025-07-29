import { auth } from './firebaseConfig.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';

function logout() {
  signOut(auth).then(() => {
    window.location.href = 'login-admin.html';
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab-section').forEach(sec => sec.classList.add('hidden'));
  document.getElementById(tab).classList.remove('hidden');
}

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login-admin.html';
  }
});

window.logout = logout;
window.switchTab = switchTab;
