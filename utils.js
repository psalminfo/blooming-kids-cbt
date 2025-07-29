// utils.js
import { auth } from './firebaseConfig.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

export function logout() {
  signOut(auth).then(() => {
    window.location.href = 'login-student.html';
  });
}
