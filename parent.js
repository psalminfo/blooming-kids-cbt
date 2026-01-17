// Firebase config for the 'bloomingkidsassessment' project
firebase.initializeApp({
apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
authDomain: "bloomingkidsassessment.firebaseapp.com",
projectId: "bloomingkidsassessment",
storageBucket: "bloomingkidsassessment.appspot.com",
messagingSenderId: "238975054977",
appId: "1:238975054977:web:87c70b4db044998a204980"
});
const db = firebase.firestore();
const auth = firebase.auth();
// ============================================================================
// SECTION 1: CYBER SECURITY & UTILITY FUNCTIONS
// ============================================================================
// XSS Protection - Escape HTML to prevent injection attacks
function escapeHtml(text) {
if (typeof text !== 'string') return text;
const map = {
'&': '&amp;',
'<': '&lt;',
'>': '&gt;',
'"': '&quot;',
"'": '&#039;',
'`': '&#x60;',
'/': '&#x2F;',
'=': '&#x3D;'
};
return text.replace(/[&<>"'`/=]/g, function(m) { return map[m]; });
}
// Sanitize user input for safe rendering
function sanitizeInput(input) {
if (typeof input === 'string') {
return escapeHtml(input.trim());
}
return input;
}
// Safe text content helper (doesn't escape HTML for rendering)
function safeText(text) {
if (typeof text !== 'string') return text;
return text.trim();
}
// Capitalize names safely
function capitalize(str) {
if (!str || typeof str !== 'string') return "";
const cleaned = safeText(str);
return cleaned.replace(/\b\w/g, l => l.toUpperCase());
}
// ============================================================================
// SECTION 2: APP CONFIGURATION & INITIALIZATION
// ============================================================================
// Inject custom CSS for smooth animations and transitions
function injectCustomCSS() {
const style = document.createElement('style');
style.textContent = `
/* Smooth transitions */
.accordion-content {
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
overflow: hidden;
}
.accordion-content.hidden {
max-height: 0 !important;
opacity: 0;
padding-top: 0 !important;
padding-bottom: 0 !important;
margin-top: 0 !important;
margin-bottom: 0 !important;
}
.accordion-content:not(.hidden) {
max-height: 5000px;
opacity: 1;
}
.fade-in {
animation: fadeIn 0.3s ease-in-out;
}
.slide-down {
animation: slideDown 0.3s ease-out;
}
@keyframes fadeIn {
from { opacity: 0; }
to { opacity: 1; }
}
@keyframes slideDown {
from {
transform: translateY(-10px);
opacity: 0;
}
to {
transform: translateY(0);
opacity: 1;
}
}
/* Loading animations */
.loading-spinner {
border: 3px solid rgba(0, 0, 0, 0.1);
border-radius: 50%;
border-top: 3px solid #10B981;
width: 40px;
height: 40px;
animation: spin 1s linear infinite;
}
.loading-spinner-small {
border: 2px solid rgba(0, 0, 0, 0.1);
border-radius: 50%;
border-top: 2px solid #10B981;
width: 16px;
height: 16px;
animation: spin 1s linear infinite;
display: inline-block;
}
@keyframes spin {
0% { transform: rotate(0deg); }
100% { transform: rotate(360deg); }
}
/* Button glow effect */
.btn-glow:hover {
box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);
}
/* Notification badge animations */
.notification-pulse {
animation: pulse 2s infinite;
}
@keyframes pulse {
0% { transform: scale(1); }
50% { transform: scale(1.1); }
100% { transform: scale(1); }
}
/* Accordion styles */
.accordion-header {
transition: all 0.2s ease;
}
.accordion-header:hover {
transform: translateY(-2px);
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
/* Hide white spaces */
.accordion-content.hidden {
display: none !important;
}
/* Tab transitions */
.tab-transition {
transition: all 0.3s ease;
}
`;
document.head.appendChild(style);
}
// Create country code dropdown with full list
function createCountryCodeDropdown() {
const phoneInputContainer = document.getElementById('signupPhone')?.parentNode;
if (!phoneInputContainer) return;
// Create container for country code and phone number
const container = document.createElement('div');
container.className = 'flex gap-2';
// Create country code dropdown
const countryCodeSelect = document.createElement('select');
countryCodeSelect.id = 'countryCode';
countryCodeSelect.className = 'w-32 px-3 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
countryCodeSelect.required = true;
// FULL COUNTRY CODES LIST (50+ countries) - GLOBAL SUPPORT MAINTAINED
const countries = [
{ code: '+1', name: 'USA/Canada (+1)' },
{ code: '+234', name: 'Nigeria (+234)' },
{ code: '+44', name: 'UK (+44)' },
{ code: '+233', name: 'Ghana (+233)' },
{ code: '+254', name: 'Kenya (+254)' },
{ code: '+27', name: 'South Africa (+27)' },
{ code: '+91', name: 'India (+91)' },
{ code: '+971', name: 'UAE (+971)' },
{ code: '+966', name: 'Saudi Arabia (+966)' },
{ code: '+20', name: 'Egypt (+20)' },
{ code: '+237', name: 'Cameroon (+237)' },
{ code: '+256', name: 'Uganda (+256)' },
{ code: '+255', name: 'Tanzania (+255)' },
{ code: '+250', name: 'Rwanda (+250)' },
{ code: '+251', name: 'Ethiopia (+251)' },
{ code: '+41', name: 'Switzerland (+41)' },
{ code: '+86', name: 'China (+86)' },
{ code: '+33', name: 'France (+33)' },
{ code: '+49', name: 'Germany (+49)' },
{ code: '+61', name: 'Australia (+61)' },
{ code: '+55', name: 'Brazil (+55)' },
{ code: '+351', name: 'Portugal (+351)' },
{ code: '+34', name: 'Spain (+34)' },
{ code: '+39', name: 'Italy (+39)' },
{ code: '+31', name: 'Netherlands (+31)' },
{ code: '+32', name: 'Belgium (+32)' },
{ code: '+46', name: 'Sweden (+46)' },
{ code: '+47', name: 'Norway (+47)' },
{ code: '+45', name: 'Denmark (+45)' },
{ code: '+358', name: 'Finland (+358)' },
{ code: '+353', name: 'Ireland (+353)' },
{ code: '+48', name: 'Poland (+48)' },
{ code: '+90', name: 'Turkey (+90)' },
{ code: '+961', name: 'Lebanon (+961)' },
{ code: '+962', name: 'Jordan (+962)' },
{ code: '+81', name: 'Japan (+81)' },
{ code: '+82', name: 'South Korea (+82)' },
{ code: '+60', name: 'Malaysia (+60)' },
{ code: '+852', name: 'Hong Kong (+852)' },
{ code: '+52', name: 'Mexico (+52)' },
{ code: '+63', name: 'Philippines (+63)' },
{ code: '+65', name: 'Singapore (+65)' },
{ code: '+64', name: 'New Zealand (+64)' },
{ code: '+7', name: 'Russia/Kazakhstan (+7)' },
{ code: '+380', name: 'Ukraine (+380)' },
{ code: '+30', name: 'Greece (+30)' },
{ code: '+43', name: 'Austria (+43)' },
{ code: '+420', name: 'Czech Republic (+420)' },
{ code: '+36', name: 'Hungary (+36)' },
{ code: '+40', name: 'Romania (+40)' }
];
// Add options to dropdown
countries.forEach(country => {
const option = document.createElement('option');
option.value = country.code;
option.textContent = safeText(country.name);
countryCodeSelect.appendChild(option);
});
// Set USA/Canada as default
countryCodeSelect.value = '+1';
// Get the existing phone input
const phoneInput = document.getElementById('signupPhone');
if (phoneInput) {
phoneInput.placeholder = 'Enter phone number without country code';
phoneInput.className = 'flex-1 px-4 py-3 border border-gray-300 rounded-xl input-focus focus:outline-none transition-all duration-200';
// Replace the original input with new structure
container.appendChild(countryCodeSelect);
container.appendChild(phoneInput);
phoneInputContainer.appendChild(container);
}
}
// ENHANCED PHONE NORMALIZATION FUNCTION - BETTER GLOBAL SUPPORT
function normalizePhoneNumber(phone) {
if (!phone || typeof phone !== 'string') {
return { normalized: null, valid: false, error: 'Invalid input' };
}
try {
let cleaned = phone.replace(/[^\d+]/g, '');
if (!cleaned) {
return { normalized: null, valid: false, error: 'Empty phone number' };
}
if (cleaned.startsWith('+')) {
cleaned = '+' + cleaned.substring(1).replace(/\+/g, '');
return { normalized: cleaned, valid: true, error: null };
} else {
cleaned = cleaned.replace(/^0+/, '');
if (cleaned.length <= 10) {
cleaned = '+1' + cleaned;
} else if (cleaned.length > 10) {
const knownCodes = ['234', '44', '91', '86', '33', '49', '81', '61', '55', '7'];
const possibleCode = cleaned.substring(0, 3);
if (knownCodes.includes(possibleCode)) {
cleaned = '+' + cleaned;
} else {
cleaned = '+1' + cleaned;
}
}
return { normalized: cleaned, valid: true, error: null };
}
} catch (error) {
return { normalized: null, valid: false, error: safeText(error.message) };
}
}
// ============================================================================
// SECTION 3: GLOBAL VARIABLES & STATE MANAGEMENT
// ============================================================================
let currentUserData = null;
let userChildren = [];
let studentIdMap = new Map();
let realTimeListeners = [];
let academicsNotifications = new Map(); // studentName -> {sessionTopics: count, homework: count}
// ============================================================================
// SECTION 4: UI MESSAGE SYSTEM
// ============================================================================
function showMessage(message, type) {
const existingMessage = document.querySelector('.message-toast');
if (existingMessage) existingMessage.remove();
const messageDiv = document.createElement('div');
messageDiv.className = `message-toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm fade-in slide-down ${
type === 'error' ? 'bg-red-500 text-white' :
type === 'success' ? 'bg-green-500 text-white' :
'bg-blue-500 text-white'
}`;
messageDiv.textContent = `BKH says: ${safeText(message)}`;
document.body.appendChild(messageDiv);
setTimeout(() => { if (messageDiv.parentNode) messageDiv.remove(); }, 5000);
}
// ============================================================================
// SECTION 5: REFERRAL SYSTEM FUNCTIONS
// ============================================================================
async function generateReferralCode() {
const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const prefix = 'BKH';
let code;
let isUnique = false;
while (!isUnique) {
let suffix = '';
for (let i = 0; i < 6; i++) {
suffix += chars.charAt(Math.floor(Math.random() * chars.length));
}
code = prefix + suffix;
const snapshot = await db.collection('parent_users').where('referralCode', '==', code).limit(1).get();
if (snapshot.empty) isUnique = true;
}
return safeText(code);
}
async function loadReferralRewards(parentUid) {
const rewardsContent = document.getElementById('rewardsContent');
if (!rewardsContent) return;
rewardsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto" style="width: 40px; height: 40px;"></div><p class="text-green-600 font-semibold mt-4">Loading rewards data...</p></div>';
try {
const userDoc = await db.collection('parent_users').doc(parentUid).get();
if (!userDoc.exists) {
rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">User data not found. Please sign in again.</p>';
return;
}
const userData = userDoc.data();
const referralCode = safeText(userData.referralCode || 'N/A');
const totalEarnings = userData.referralEarnings || 0;
const transactionsSnapshot = await db.collection('referral_transactions')
.where('ownerUid', '==', parentUid).get();
let referralsHtml = '';
let pendingCount = 0, approvedCount = 0, paidCount = 0;
if (transactionsSnapshot.empty) {
referralsHtml = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No one has used your referral code yet.</td></tr>`;
} else {
const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
transactions.sort((a, b) => (b.timestamp?.toDate?.() || new Date(0)) - (a.timestamp?.toDate?.() || new Date(0)));
transactions.forEach(data => {
const status = safeText(data.status || 'pending');
const statusColor = status === 'paid' ? 'bg-green-100 text-green-800' :
status === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800';
if (status === 'pending') pendingCount++;
if (status === 'approved') approvedCount++;
if (status === 'paid') paidCount++;
const referredName = capitalize(data.referredStudentName || data.referredStudentPhone);
const rewardAmount = data.rewardAmount ? `₦${data.rewardAmount.toLocaleString()}` : '₦5,000';
const referralDate = data.timestamp?.toDate?.().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) || 'N/A';
referralsHtml += `
<tr class="hover:bg-gray-50">
<td class="px-4 py-3 text-sm font-medium text-gray-900">${referredName}</td>
<td class="px-4 py-3 text-sm text-gray-500">${safeText(referralDate)}</td>
<td class="px-4 py-3 text-sm">
<span class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-medium ${statusColor}">
${capitalize(status)}
</span>
</td>
<td class="px-4 py-3 text-sm text-gray-900 font-bold">${safeText(rewardAmount)}</td>
</tr>
`;
});
}
rewardsContent.innerHTML = `
<div class="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg mb-8 shadow-md slide-down">
<h2 class="text-2xl font-bold text-blue-800 mb-1">Your Referral Code</h2>
<p class="text-xl font-mono text-blue-600 tracking-wider p-2 bg-white inline-block rounded-lg border border-dashed border-blue-300 select-all">${referralCode}</p>
<p class="text-blue-700 mt-2">Share this code with other parents. They use it when registering their child, and you earn **₦5,000** once their child completes their first month!</p>
</div>
<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
<div class="bg-green-100 p-6 rounded-xl shadow-lg border-b-4 border-green-600 fade-in">
<p class="text-sm font-medium text-green-700">Total Earnings</p>
<p class="text-3xl font-extrabold text-green-900 mt-1">₦${totalEarnings.toLocaleString()}</p>
</div>
<div class="bg-yellow-100 p-6 rounded-xl shadow-lg border-b-4 border-yellow-600 fade-in">
<p class="text-sm font-medium text-yellow-700">Approved Rewards (Awaiting Payment)</p>
<p class="text-3xl font-extrabold text-yellow-900 mt-1">${approvedCount}</p>
</div>
<div class="bg-gray-100 p-6 rounded-xl shadow-lg border-b-4 border-gray-600 fade-in">
<p class="text-sm font-medium text-gray-700">Total Successful Referrals (Paid)</p>
<p class="text-3xl font-extrabold text-gray-900 mt-1">${paidCount}</p>
</div>
</div>
<h3 class="text-xl font-bold text-gray-800 mb-4">Referral History</h3>
<div class="overflow-x-auto bg-white rounded-lg shadow">
<table class="min-w-full divide-y divide-gray-200">
<thead class="bg-gray-50">
<tr>
<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Referred Parent/Student</th>
<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Used</th>
<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
</tr>
</thead>
<tbody class="divide-y divide-gray-200">
${referralsHtml}
</tbody>
</table>
</div>
`;
} catch (error) {
console.error('Error loading referral rewards:', error);
rewardsContent.innerHTML = '<p class="text-red-500 text-center py-8">An error occurred while loading your rewards data. Please try again later.</p>';
}
}
// Find student IDs for a parent's phone number - ENHANCED TO FIND ALL CHILDREN
async function findStudentIdsForParent(parentPhone) {
try {
const normalizedPhone = normalizePhoneNumber(parentPhone);
if (!normalizedPhone.valid) {
return { studentIds: [], studentNameIdMap: new Map(), allStudentData: [] };
}
let studentIds = [], studentNameIdMap = new Map(), allStudentData = [];
const phoneVariations = generateAllPhoneVariations(parentPhone);
const studentsPromises = phoneVariations.map(phone =>
db.collection("students").where("parentPhone", "==", phone).get().catch(() => ({ empty: true, forEach: () => {} }))
);
const pendingStudentsPromises = phoneVariations.map(phone =>
db.collection("pending_students").where("parentPhone", "==", phone).get().catch(() => ({ empty: true, forEach: () => {} }))
);
const [allStudentsSnapshots, allPendingSnapshots] = await Promise.all([
Promise.all(studentsPromises),
Promise.all(pendingStudentsPromises)
]);
const processSnapshot = (snapshot, isPending) => {
if (snapshot.empty) return;
snapshot.forEach(doc => {
const studentData = doc.data();
const studentId = doc.id;
const studentName = safeText(studentData.studentName || studentData.name || 'Unknown');
if (studentId && studentName && studentName !== 'Unknown') {
const existingById = allStudentData.find(s => s.id === studentId);
const existingByName = allStudentData.find(s => s.name === studentName);
if (!existingById && !existingByName) {
studentIds.push(studentId);
studentNameIdMap.set(studentName, studentId);
allStudentData.push({ id: studentId, name: studentName, data: studentData, isPending });
} else if (existingByName && existingByName.id !== studentId) {
const uniqueName = `${studentName} (${studentId.substring(0, 4)})`;
studentIds.push(studentId);
studentNameIdMap.set(uniqueName, studentId);
allStudentData.push({ id: studentId, name: uniqueName, data: studentData, isPending });
}
}
});
};
allStudentsSnapshots.forEach(snap => processSnapshot(snap, false));
allPendingSnapshots.forEach(snap => processSnapshot(snap, true));
studentIdMap = studentNameIdMap;
return { studentIds, studentNameIdMap, allStudentData };
} catch (error) {
console.error("❌ Error finding student IDs:", error);
return { studentIds: [], studentNameIdMap: new Map(), allStudentData: [] };
}
}
// ============================================================================
// SECTION 6: AUTHENTICATION & USER MANAGEMENT (CORE IMPLEMENTATION)
// ============================================================================
async function handleSignInFull(identifier, password, signInBtn, authLoader) {
try {
await auth.signInWithEmailAndPassword(identifier, password);
} catch (error) {
let errorMessage = "Failed to sign in. Please check your credentials.";
if (error.code === 'auth/user-not-found') errorMessage = "No account found with this email.";
else if (error.code === 'auth/wrong-password') errorMessage = "Incorrect password.";
else if (error.code === 'auth/invalid-email') errorMessage = "Invalid email address format.";
else if (error.code === 'auth/too-many-requests') errorMessage = "Too many failed attempts. Please try again later.";
showMessage(errorMessage, 'error');
if (signInBtn) signInBtn.disabled = false;
const signInText = document.getElementById('signInText');
const signInSpinner = document.getElementById('signInSpinner');
if (signInText) signInText.textContent = 'Sign In';
if (signInSpinner) signInSpinner.classList.add('hidden');
if (authLoader) authLoader.classList.add('hidden');
}
}
async function handleSignUpFull(countryCode, localPhone, email, password, confirmPassword, signUpBtn, authLoader) {
try {
let fullPhoneInput = localPhone;
if (!localPhone.startsWith('+')) fullPhoneInput = countryCode + localPhone;
const normalizedResult = normalizePhoneNumber(fullPhoneInput);
if (!normalizedResult.valid) throw new Error(`Invalid phone number: ${normalizedResult.error}`);
const finalPhone = normalizedResult.normalized;
const userCredential = await auth.createUserWithEmailAndPassword(email, password);
const user = userCredential.user;
const referralCode = await generateReferralCode();
await db.collection('parent_users').doc(user.uid).set({
email: email,
phone: finalPhone,
normalizedPhone: finalPhone,
parentName: 'Parent',
createdAt: firebase.firestore.FieldValue.serverTimestamp(),
referralCode: referralCode,
referralEarnings: 0,
uid: user.uid
});
showMessage('Account created successfully!', 'success');
} catch (error) {
let errorMessage = "Failed to create account.";
if (error.code === 'auth/email-already-in-use') errorMessage = "This email is already registered. Please sign in instead.";
else if (error.code === 'auth/weak-password') errorMessage = "Password should be at least 6 characters.";
else if (error.message) errorMessage = error.message;
showMessage(errorMessage, 'error');
if (signUpBtn) signUpBtn.disabled = false;
const signUpText = document.getElementById('signUpText');
const signUpSpinner = document.getElementById('signUpSpinner');
if (signUpText) signUpText.textContent = 'Create Account';
if (signUpSpinner) signUpSpinner.classList.add('hidden');
if (authLoader) authLoader.classList.add('hidden');
}
}
async function handlePasswordResetFull(email, sendResetBtn, resetLoader) {
try {
await auth.sendPasswordResetEmail(email);
showMessage('Password reset link sent to your email!', 'success');
hidePasswordResetModal();
} catch (error) {
let errorMessage = "Failed to send reset email.";
if (error.code === 'auth/user-not-found') errorMessage = "No account found with this email address.";
showMessage(errorMessage, 'error');
} finally {
if (sendResetBtn) sendResetBtn.disabled = false;
if (resetLoader) resetLoader.classList.add('hidden');
}
}
// ============================================================================
// SECTION 7: MESSAGING SYSTEM - DISABLED PER REQUEST
// ============================================================================
// All messaging-related functions, modals, buttons, and listeners REMOVED.
// Keep this comment for future restoration.
// ============================================================================
// SECTION 8: PROACTIVE ACADEMICS TAB WITHOUT COMPLEX QUERIES
// ============================================================================
function getMonthDisplayLogic() {
const today = new Date();
const currentDay = today.getDate();
if (currentDay === 1 || currentDay === 2) {
return { showCurrentMonth: true, showPreviousMonth: true };
} else {
return { showCurrentMonth: true, showPreviousMonth: false };
}
}
function getCurrentMonthYear() {
const now = new Date();
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
return { month: now.getMonth(), year: now.getFullYear(), monthName: monthNames[now.getMonth()] };
}
function getPreviousMonthYear() {
const now = new Date();
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
return { month: lastMonth.getMonth(), year: lastMonth.getFullYear(), monthName: monthNames[lastMonth.getMonth()] };
}
function formatDetailedDate(date, showTimezone = false) {
let dateObj;
if (date?.toDate) dateObj = date.toDate();
else if (date instanceof Date) dateObj = date;
else if (typeof date === 'string') dateObj = new Date(date);
else if (typeof date === 'number') dateObj = date < 10000000000 ? new Date(date * 1000) : new Date(date);
else return 'Unknown date';
if (isNaN(dateObj.getTime())) return 'Invalid date';
const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
if (showTimezone) options.timeZoneName = 'short';
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let formatted = dateObj.toLocaleDateString('en-US', options);
if (showTimezone) formatted += ` (${timezone})`;
return formatted;
}
function getYearMonthFromDate(date) {
let dateObj;
if (date?.toDate) dateObj = date.toDate();
else if (date instanceof Date) dateObj = date;
else if (typeof date === 'string') dateObj = new Date(date);
else if (typeof date === 'number') dateObj = date < 10000000000 ? new Date(date * 1000) : new Date(date);
else return { year: 0, month: 0 };
if (isNaN(dateObj.getTime())) return { year: 0, month: 0 };
return { year: dateObj.getFullYear(), month: dateObj.getMonth() };
}
function getTimestamp(dateInput) {
if (!dateInput) return 0;
if (dateInput?.toDate) return dateInput.toDate().getTime();
else if (dateInput instanceof Date) return dateInput.getTime();
else if (typeof dateInput === 'string') return new Date(dateInput).getTime();
else if (typeof dateInput === 'number') return dateInput < 10000000000 ? dateInput * 1000 : dateInput;
return 0;
}
function getTimestampFromData(data) {
if (!data) return 0;
const timestampFields = ['timestamp','createdAt','submittedAt','date','updatedAt','assignedDate','dueDate'];
for (const field of timestampFields) {
if (data[field]) {
const timestamp = getTimestamp(data[field]);
if (timestamp > 0) return Math.floor(timestamp / 1000);
}
}
return Math.floor(Date.now() / 1000);
}
async function loadAcademicsData(selectedStudent = null) {
const academicsContent = document.getElementById('academicsContent');
if (!academicsContent) return;
academicsContent.innerHTML = '<div class="text-center py-8"><div class="loading-spinner mx-auto"></div><p class="text-green-600 font-semibold mt-4">Loading academic data...</p></div>';
try {
const user = auth.currentUser;
if (!user) throw new Error('Please sign in to view academic data');
const userDoc = await db.collection('parent_users').doc(user.uid).get();
const userData = userDoc.data();
const parentPhone = userData.normalizedPhone || userData.phone;
const { studentIds, studentNameIdMap, allStudentData } = await findStudentIdsForParent(parentPhone);
if (studentIds.length === 0) {
academicsContent.innerHTML = `
<div class="text-center py-12">
<div class="text-6xl mb-4">📚</div>
<h3 class="text-xl font-bold text-gray-700 mb-2">No Students Found</h3>
<p class="text-gray-500 max-w-md mx-auto">No students are currently assigned to your account.</p>
</div>
`;
return;
}
let studentsToShow = selectedStudent && studentNameIdMap.has(selectedStudent) ? [selectedStudent] : Array.from(studentNameIdMap.keys());
let academicsHtml = '', totalUnreadCount = 0;
if (studentNameIdMap.size > 1) {
academicsHtml += `
<div class="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm slide-down">
<label class="block text-sm font-medium text-gray-700 mb-2">Select Student:</label>
<select id="studentSelector" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200" onchange="onStudentSelected(this.value)">
<option value="">All Students</option>
`;
Array.from(studentNameIdMap.keys()).forEach(studentName => {
const isSelected = selectedStudent === studentName ? 'selected' : '';
const studentStatus = allStudentData.find(s => s.name === studentName)?.isPending ? ' (Pending Registration)' : '';
const studentNotifications = academicsNotifications.get(studentName) || { sessionTopics: 0, homework: 0 };
const studentUnread = studentNotifications.sessionTopics + studentNotifications.homework;
const badge = studentUnread > 0 ? `<span class="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1 notification-pulse">${studentUnread}</span>` : '';
academicsHtml += `<option value="${safeText(studentName)}" ${isSelected}>${capitalize(studentName)}${safeText(studentStatus)} ${badge}</option>`;
});
academicsHtml += '</select></div>';
}
for (const studentName of studentsToShow) {
const studentId = studentNameIdMap.get(studentName);
const studentData = allStudentData.find(s => s.name === studentName);
if (!studentId) continue;
const studentNotifications = academicsNotifications.get(studentName) || { sessionTopics: 0, homework: 0 };
const studentUnread = studentNotifications.sessionTopics + studentNotifications.homework;
totalUnreadCount += studentUnread;
const notificationBadge = studentUnread > 0 ?
`<span class="ml-3 bg-red-500 text-white text-xs font-bold rounded-full px-3 py-1 animate-pulse">${studentUnread} NEW</span>` : '';
const studentHeader = `
<div class="bg-gradient-to-r from-green-100 to-green-50 border-l-4 border-green-600 p-4 rounded-lg mb-6 slide-down" id="academics-student-${safeText(studentName)}">
<div class="flex justify-between items-center">
<div>
<h2 class="text-xl font-bold text-green-800">${capitalize(studentName)}${studentData?.isPending ? ' <span class="text-yellow-600 text-sm">(Pending Registration)</span>' : ''}</h2>
<p class="text-green-600">Academic progress and assignments</p>
</div>
${notificationBadge}
</div>
</div>
`;
academicsHtml += studentHeader;
academicsHtml += `
<div class="mb-8 fade-in">
<div class="flex items-center mb-4">
<span class="text-2xl mr-3">👤</span>
<h3 class="text-lg font-semibold text-green-700">Student Information</h3>
</div>
<div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
<div><p class="text-sm text-gray-500">Status</p><p class="font-medium">${studentData?.isPending ? 'Pending Registration' : 'Active'}</p></div>
<div><p class="text-sm text-gray-500">Assigned Tutor</p><p class="font-medium">${safeText(studentData?.data?.tutorName || 'Not yet assigned')}</p></div>
</div>
</div>
</div>
`;
const monthLogic = getMonthDisplayLogic();
const currentMonth = getCurrentMonthYear();
const previousMonth = getPreviousMonthYear();
// Session Topics
academicsHtml += `
<div class="mb-8 fade-in">
<button onclick="toggleAcademicsAccordion('session-topics-${safeText(studentName)}')"
class="accordion-header w-full flex justify-between items-center p-4 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 transition-all duration-200 mb-4">
<div class="flex items-center">
<span class="text-xl mr-3">📝</span>
<div class="text-left">
<h3 class="font-bold text-blue-800 text-lg">Session Topics</h3>
<p class="text-blue-600 text-sm">What your child learned in each session</p>
</div>
</div>
<div class="flex items-center">
${studentNotifications.sessionTopics > 0 ? `<span class="mr-3 bg-red-500 text-white text-xs rounded-full px-2 py-1">${studentNotifications.sessionTopics} new</span>` : ''}
<span id="session-topics-${safeText(studentName)}-arrow" class="accordion-arrow text-blue-600 text-xl">▼</span>
</div>
</button>
<div id="session-topics-${safeText(studentName)}-content" class="accordion-content hidden">
`;
try {
const sessionTopicsSnapshot = await db.collection('daily_topics').where('studentId', '==', studentId).get();
if (sessionTopicsSnapshot.empty) {
academicsHtml += `<div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center"><p class="text-gray-500">No session topics recorded yet.</p></div>`;
} else {
const topics = [];
sessionTopicsSnapshot.forEach(doc => {
const topicData = doc.data();
topics.push({ id: doc.id, ...topicData, timestamp: getTimestamp(topicData.date || topicData.createdAt || topicData.timestamp) });
});
topics.sort((a, b) => a.timestamp - b.timestamp);
const filteredTopics = topics.filter(topic => {
const topicDate = new Date(topic.timestamp);
const { year, month } = getYearMonthFromDate(topicDate);
if (year === currentMonth.year && month === currentMonth.month) return true;
if (monthLogic.showPreviousMonth && year === previousMonth.year && month === previousMonth.month) return true;
return false;
});
if (filteredTopics.length === 0) {
academicsHtml += `<div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center"><p class="text-gray-500">No session topics for the selected time period.</p></div>`;
} else {
const topicsByMonth = {};
filteredTopics.forEach(topic => {
const topicDate = new Date(topic.timestamp);
const { year, month } = getYearMonthFromDate(topicDate);
const monthKey = `${year}-${month}`;
if (!topicsByMonth[monthKey]) topicsByMonth[monthKey] = [];
topicsByMonth[monthKey].push(topic);
});
for (const [monthKey, monthTopics] of Object.entries(topicsByMonth)) {
const [year, month] = monthKey.split('-').map(num => parseInt(num));
const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][month];
academicsHtml += `<div class="mb-6"><h4 class="font-semibold text-gray-700 mb-4 p-3 bg-gray-100 rounded-lg">${monthName} ${year}</h4><div class="space-y-4">`;
monthTopics.forEach(topicData => {
const formattedDate = formatDetailedDate(new Date(topicData.timestamp), true);
const safeTopics = safeText(topicData.topics || topicData.sessionTopics || 'No topics recorded for this session.');
const tutorName = safeText(topicData.tutorName || topicData.updatedBy || 'Tutor');
academicsHtml += `
<div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
<div class="flex justify-between items-start mb-3">
<div>
<span class="font-medium text-gray-800 text-sm">${safeText(formattedDate)}</span>
<div class="mt-1 flex items-center">
<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">Session</span>
<span class="text-xs text-gray-600">By: ${tutorName}</span>
</div>
</div>
${topicData.updatedAt ? `<span class="text-xs text-gray-500">Updated: ${formatDetailedDate(topicData.updatedAt, true)}</span>` : ''}
</div>
<div class="text-gray-700 bg-gray-50 p-3 rounded-md"><p class="whitespace-pre-wrap">${safeTopics}</p></div>
${topicData.notes ? `<div class="mt-3 text-sm"><span class="font-medium text-gray-700">Additional Notes:</span><p class="text-gray-600 mt-1 bg-yellow-50 p-2 rounded">${safeText(topicData.notes)}</p></div>` : ''}
</div>
`;
});
academicsHtml += '</div></div>';
}
}
}
} catch (error) {
console.error('Error loading session topics:', error);
academicsHtml += `<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4"><p class="text-yellow-700">Unable to load session topics at this time.</p></div>`;
}
academicsHtml += '</div></div>';
// Homework Assignments
academicsHtml += `
<div class="mb-8 fade-in">
<button onclick="toggleAcademicsAccordion('homework-${safeText(studentName)}')"
class="accordion-header w-full flex justify-between items-center p-4 bg-purple-100 border border-purple-300 rounded-lg hover:bg-purple-200 transition-all duration-200 mb-4">
<div class="flex items-center">
<span class="text-xl mr-3">📚</span>
<div class="text-left">
<h3 class="font-bold text-purple-800 text-lg">Homework Assignments</h3>
<p class="text-purple-600 text-sm">Assignments and due dates</p>
</div>
</div>
<div class="flex items-center">
${studentNotifications.homework > 0 ? `<span class="mr-3 bg-red-500 text-white text-xs rounded-full px-2 py-1">${studentNotifications.homework} new</span>` : ''}
<span id="homework-${safeText(studentName)}-arrow" class="accordion-arrow text-purple-600 text-xl">▼</span>
</div>
</button>
<div id="homework-${safeText(studentName)}-content" class="accordion-content hidden">
`;
try {
const homeworkSnapshot = await db.collection('homework_assignments').where('studentId', '==', studentId).get();
if (homeworkSnapshot.empty) {
academicsHtml += `<div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center"><p class="text-gray-500">No homework assignments yet.</p></div>`;
} else {
const homeworkList = [];
homeworkSnapshot.forEach(doc => {
const homework = doc.data();
homeworkList.push({ id: doc.id, ...homework, assignedTimestamp: getTimestamp(homework.assignedDate || homework.createdAt || homework.timestamp), dueTimestamp: getTimestamp(homework.dueDate) });
});
const now = new Date().getTime();
homeworkList.sort((a, b) => a.dueTimestamp - b.dueTimestamp);
const filteredHomework = homeworkList.filter(homework => {
const dueDate = new Date(homework.dueTimestamp);
const { year, month } = getYearMonthFromDate(dueDate);
if (year === currentMonth.year && month === currentMonth.month) return true;
if (monthLogic.showPreviousMonth && year === previousMonth.year && month === previousMonth.month) return true;
if (homework.dueTimestamp < now) return true;
const nextMonth = new Date(currentMonth.year, currentMonth.month + 1, 1);
if (dueDate <= nextMonth) return true;
return false;
});
if (filteredHomework.length === 0) {
academicsHtml += `<div class="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center"><p class="text-gray-500">No homework for the selected time period.</p></div>`;
} else {
const homeworkByMonth = {};
filteredHomework.forEach(homework => {
const dueDate = new Date(homework.dueTimestamp);
const { year, month } = getYearMonthFromDate(dueDate);
const monthKey = `${year}-${month}`;
if (!homeworkByMonth[monthKey]) homeworkByMonth[monthKey] = [];
homeworkByMonth[monthKey].push(homework);
});
const sortedMonthKeys = Object.keys(homeworkByMonth).sort((a, b) => {
const [aYear, aMonth] = a.split('-').map(Number);
const [bYear, bMonth] = b.split('-').map(Number);
return aYear - bYear || aMonth - bMonth;
});
for (const monthKey of sortedMonthKeys) {
const [year, month] = monthKey.split('-').map(num => parseInt(num));
const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][month];
const monthHomework = homeworkByMonth[monthKey];
academicsHtml += `<div class="mb-6"><h4 class="font-semibold text-gray-700 mb-4 p-3 bg-gray-100 rounded-lg">${monthName} ${year}</h4><div class="space-y-4">`;
monthHomework.forEach(homework => {
const dueDate = new Date(homework.dueTimestamp);
const assignedDate = new Date(homework.assignedTimestamp);
const formattedDueDate = formatDetailedDate(dueDate, true);
const formattedAssignedDate = formatDetailedDate(assignedDate, true);
const isOverdue = homework.dueTimestamp < now;
const isSubmitted = homework.status === 'submitted' || homework.status === 'completed';
const statusColor = isOverdue ? 'bg-red-100 text-red-800' : isSubmitted ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
const statusText = isOverdue ? 'Overdue' : isSubmitted ? 'Submitted' : 'Pending';
const safeTitle = safeText(homework.title || homework.subject || 'Untitled Assignment');
const safeDescription = safeText(homework.description || homework.instructions || 'No description provided.');
const tutorName = safeText(homework.tutorName || homework.assignedBy || 'Tutor');
academicsHtml += `
<div class="bg-white border ${isOverdue ? 'border-red-200' : 'border-gray-200'} rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
<div class="flex justify-between items-start mb-3">
<div>
<h5 class="font-medium text-gray-800 text-lg">${safeTitle}</h5>
<div class="mt-1 flex flex-wrap items-center gap-2">
<span class="text-xs ${statusColor} px-2 py-1 rounded-full">${statusText}</span>
<span class="text-xs text-gray-600">Assigned by: ${tutorName}</span>
${homework.subject ? `<span class="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">${safeText(homework.subject)}</span>` : ''}
</div>
</div>
<div class="text-right">
<span class="text-sm font-medium text-gray-700">Due: ${safeText(formattedDueDate)}</span>
<div class="text-xs text-gray-500 mt-1">Assigned: ${safeText(formattedAssignedDate)}</div>
</div>
</div>
<div class="text-gray-700 mb-4"><p class="whitespace-pre-wrap bg-gray-50 p-3 rounded-md">${safeDescription}</p></div>
<div class="flex justify-between items-center pt-3 border-t border-gray-100">
<div class="flex items-center space-x-3">
${homework.fileUrl ? `<a href="${safeText(homework.fileUrl)}" target="_blank" class="text-green-600 hover:text-green-800 font-medium flex items-center text-sm"><span class="mr-1">📎</span> Download Attachment</a>` : ''}
${homework.submissionUrl ? `<a href="${safeText(homework.submissionUrl)}" target="_blank" class="text-blue-600 hover:text-blue-800 font-medium flex items-center text-sm"><span class="mr-1">📤</span> View Submission</a>` : ''}
</div>
${homework.grade ? `<div class="text-sm"><span class="font-medium text-gray-700">Grade:</span><span class="ml-1 font-bold ${homework.grade >= 70 ? 'text-green-600' : homework.grade >= 50 ? 'text-yellow-600' : 'text-red-600'}">${homework.grade}%</span></div>` : ''}
</div>
${homework.feedback ? `<div class="mt-4 pt-3 border-t border-gray-100"><span class="font-medium text-gray-700 text-sm">Tutor Feedback:</span><p class="text-gray-600 text-sm mt-1 bg-blue-50 p-2 rounded">${safeText(homework.feedback)}</p></div>` : ''}
</div>
`;
});
academicsHtml += '</div></div>';
}
}
}
} catch (error) {
console.error('Error loading homework:', error);
academicsHtml += `<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4"><p class="text-yellow-700">Unable to load homework assignments at this time.</p></div>`;
}
academicsHtml += '</div></div>';
}
academicsContent.innerHTML = academicsHtml;
updateAcademicsTabBadge(totalUnreadCount);
} catch (error) {
console.error('Error loading academics data:', error);
academicsContent.innerHTML = `<div class="text-center py-8"><div class="text-4xl mb-4">❌</div><h3 class="text-xl font-bold text-red-700 mb-2">Error Loading Academic Data</h3><p class="text-gray-500">Unable to load academic data at this time.</p><button onclick="loadAcademicsData()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Try Again</button></div>`;
}
}
function toggleAcademicsAccordion(sectionId) {
const content = document.getElementById(`${sectionId}-content`);
const arrow = document.getElementById(`${sectionId}-arrow`);
if (!content || !arrow) return;
if (content.classList.contains('hidden')) {
content.classList.remove('hidden');
arrow.textContent = '▲';
} else {
content.classList.add('hidden');
arrow.textContent = '▼';
}
}
function updateAcademicsTabBadge(count) {
const academicsTab = document.getElementById('academicsTab');
if (!academicsTab) return;
const existingBadge = academicsTab.querySelector('.academics-badge');
if (existingBadge) existingBadge.remove();
if (count > 0) {
const badge = document.createElement('span');
badge.className = 'academics-badge absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs min-w-5 h-5 flex items-center justify-center font-bold animate-pulse px-1';
badge.textContent = count > 9 ? '9+' : count;
badge.style.lineHeight = '1rem'; badge.style.fontSize = '0.7rem'; badge.style.padding = '0 4px';
academicsTab.style.position = 'relative';
academicsTab.appendChild(badge);
}
}
function onStudentSelected(studentName) {
loadAcademicsData(studentName || null);
}
async function checkForNewAcademics() {
try {
const user = auth.currentUser;
if (!user) return;
const userDoc = await db.collection('parent_users').doc(user.uid).get();
const userData = userDoc.data();
const parentPhone = userData.normalizedPhone || userData.phone;
const { studentNameIdMap } = await findStudentIdsForParent(parentPhone);
academicsNotifications.clear();
let totalUnread = 0;
for (const [studentName, studentId] of studentNameIdMap) {
let studentUnread = { sessionTopics: 0, homework: 0 };
try {
const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
const sessionTopicsSnapshot = await db.collection('daily_topics').where('studentId', '==', studentId).get();
sessionTopicsSnapshot.forEach(doc => {
const topic = doc.data();
const topicDate = topic.date?.toDate?.() || topic.createdAt?.toDate?.() || new Date(0);
if (topicDate >= oneWeekAgo) studentUnread.sessionTopics++;
});
const homeworkSnapshot = await db.collection('homework_assignments').where('studentId', '==', studentId).get();
homeworkSnapshot.forEach(doc => {
const homework = doc.data();
const assignedDate = homework.assignedDate?.toDate?.() || homework.createdAt?.toDate?.() || new Date(0);
if (assignedDate >= oneWeekAgo) studentUnread.homework++;
});
} catch (error) {
console.error(`Error checking academics for ${studentName}:`, error);
}
academicsNotifications.set(studentName, studentUnread);
totalUnread += studentUnread.sessionTopics + studentUnread.homework;
}
updateAcademicsTabBadge(totalUnread);
} catch (error) {
console.error('Error checking for new academics:', error);
}
}
// ============================================================================
// SECTION 9: YEARLY ARCHIVES REPORTS SYSTEM WITH ACCORDIONS
// ============================================================================
function createYearlyArchiveReportView(reportsByStudent) {
let html = '', studentIndex = 0;
for (const [studentName, reports] of reportsByStudent) {
const fullName = capitalize(studentName);
const studentData = reports.studentData;
const assessmentCount = Array.from(reports.assessments.values()).flat().length;
const monthlyCount = Array.from(reports.monthly.values()).flat().length;
const totalCount = assessmentCount + monthlyCount;
html += `
<div class="accordion-item mb-4 fade-in">
<button onclick="toggleAccordion('student-${studentIndex}')"
class="accordion-header w-full flex justify-between items-center p-4 bg-gradient-to-r from-green-100 to-green-50 border border-green-300 rounded-lg hover:bg-green-200 transition-all duration-200 hover:shadow-md">
<div class="flex items-center">
<span class="text-2xl mr-3">👤</span>
<div class="text-left">
<h3 class="font-bold text-green-800 text-lg">${fullName}</h3>
<p class="text-green-600 text-sm">
${assessmentCount} Assessment(s), ${monthlyCount} Monthly Report(s) • Total: ${totalCount}
${studentData?.isPending ? ' • <span class="text-yellow-600">(Pending Registration)</span>' : ''}
</p>
</div>
</div>
<div class="flex items-center">
<span id="student-${studentIndex}-arrow" class="accordion-arrow text-green-600 text-xl">▼</span>
</div>
</button>
<div id="student-${studentIndex}-content" class="accordion-content hidden">
`;
if (totalCount === 0) {
html += `
<div class="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
<div class="text-4xl mb-3">📄</div>
<h4 class="text-lg font-semibold text-gray-700 mb-2">No Reports Yet</h4>
<p class="text-gray-500">No reports have been generated for ${fullName} yet.</p>
<p class="text-gray-400 text-sm mt-2">Reports will appear here once tutors or assessors submit them.</p>
${studentData?.isPending ?
'<p class="text-yellow-600 text-sm mt-2">⚠️ This student is pending registration. Reports will be available after registration is complete.</p>' : ''}
</div>
`;
} else {
const reportsByYear = new Map();
for (const [sessionKey, session] of reports.assessments) {
session.forEach(report => {
const year = new Date(report.timestamp * 1000).getFullYear();
if (!reportsByYear.has(year)) reportsByYear.set(year, { assessments: [], monthly: [] });
reportsByYear.get(year).assessments.push({ sessionKey, session });
});
}
for (const [sessionKey, session] of reports.monthly) {
session.forEach(report => {
const year = new Date(report.timestamp * 1000).getFullYear();
if (!reportsByYear.has(year)) reportsByYear.set(year, { assessments: [], monthly: [] });
reportsByYear.get(year).monthly.push({ sessionKey, session });
});
}
const sortedYears = Array.from(reportsByYear.keys()).sort((a, b) => b - a);
let yearIndex = 0;
for (const year of sortedYears) {
const yearData = reportsByYear.get(year);
const yearAssessmentCount = yearData.assessments.length;
const yearMonthlyCount = yearData.monthly.length;
html += `
<div class="mb-4 ml-4">
<button onclick="toggleAccordion('year-${studentIndex}-${yearIndex}')"
class="accordion-header w-full flex justify-between items-center p-3 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 transition-all duration-200">
<div class="flex items-center">
<span class="text-xl mr-3">📅</span>
<div class="text-left">
<h4 class="font-bold text-blue-800">${year}</h4>
<p class="text-blue-600 text-sm">
${yearAssessmentCount} Assessment(s), ${yearMonthlyCount} Monthly Report(s)
</p>
</div>
</div>
<span id="year-${studentIndex}-${yearIndex}-arrow" class="accordion-arrow text-blue-600">▼</span>
</button>
<div id="year-${studentIndex}-${yearIndex}-content" class="accordion-content hidden ml-4 mt-2">
`;
if (yearAssessmentCount > 0) {
html += `<div class="mb-4"><h5 class="font-semibold text-gray-700 mb-3 flex items-center"><span class="mr-2">📊</span> Assessment Reports</h5>`;
const assessmentsByMonth = new Map();
yearData.assessments.forEach(({ sessionKey, session }) => {
session.forEach(report => {
const date = new Date(report.timestamp * 1000);
const month = date.getMonth();
if (!assessmentsByMonth.has(month)) assessmentsByMonth.set(month, []);
assessmentsByMonth.get(month).push({ sessionKey, session });
});
});
const sortedMonths = Array.from(assessmentsByMonth.keys()).sort((a, b) => b - a);
sortedMonths.forEach(month => {
const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][month];
html += `<h6 class="font-medium text-gray-600 mb-2 ml-2">${monthName}</h6>`;
assessmentsByMonth.get(month).forEach(({ sessionKey, session }, sessionIndex) => {
html += createAssessmentReportHTML(session, studentIndex, `${year}-${month}-${sessionIndex}`, fullName);
});
});
html += `</div>`;
}
if (yearMonthlyCount > 0) {
html += `<div class="mb-4"><h5 class="font-semibold text-gray-700 mb-3 flex items-center"><span class="mr-2">📈</span> Monthly Reports</h5>`;
const monthlyByMonth = new Map();
yearData.monthly.forEach(({ sessionKey, session }) => {
session.forEach(report => {
const date = new Date(report.timestamp * 1000);
const month = date.getMonth();
if (!monthlyByMonth.has(month)) monthlyByMonth.set(month, []);
monthlyByMonth.get(month).push({ sessionKey, session });
});
});
const sortedMonths = Array.from(monthlyByMonth.keys()).sort((a, b) => b - a);
sortedMonths.forEach(month => {
const monthName = ['January','February','March','April','May','June','July','August','September','October','November','December'][month];
html += `<h6 class="font-medium text-gray-600 mb-2 ml-2">${monthName}</h6>`;
monthlyByMonth.get(month).forEach(({ sessionKey, session }, sessionIndex) => {
html += createMonthlyReportHTML(session, studentIndex, `${year}-${month}-${sessionIndex}`, fullName);
});
});
html += `</div>`;
}
html += `</div></div>`;
yearIndex++;
}
}
html += `</div></div>`;
studentIndex++;
}
return html;
}
function createAssessmentReportHTML(session, studentIndex, sessionId, fullName) {
const firstReport = session[0];
const formattedDate = formatDetailedDate(new Date(firstReport.timestamp * 1000), true);
const results = session.map(testResult => {
const topics = [...new Set(testResult.answers?.map(a => safeText(a.topic)).filter(t => t))] || [];
return {
subject: safeText(testResult.subject),
correct: testResult.score !== undefined ? testResult.score : 0,
total: testResult.totalScoreableQuestions !== undefined ? testResult.totalScoreableQuestions : 0,
topics: topics,
};
});
const tableRows = results.map(res => `
<tr>
<td class="border px-3 py-2">${res.subject.toUpperCase()}</td>
<td class="border px-3 py-2 text-center">${res.correct} / ${res.total}</td>
<td class="border px-3 py-2 text-sm">${res.topics.join(', ')}</td>
</tr>
`).join("");
return `
<div class="border rounded-lg shadow mb-4 p-4 bg-white hover:shadow-md transition-shadow duration-200" id="assessment-block-${studentIndex}-${sessionId}">
<div class="flex justify-between items-center mb-3 border-b pb-2">
<h5 class="font-medium text-gray-800">Assessment - ${safeText(formattedDate)}</h5>
<button onclick="downloadSessionReport(${studentIndex}, '${sessionId}', '${safeText(fullName)}', 'assessment')"
class="text-green-600 hover:text-green-800 font-medium flex items-center text-sm bg-green-50 px-3 py-1 rounded-lg hover:bg-green-100 transition-all duration-200">
<span class="mr-1">📥</span> Download PDF
</button>
</div>
<table class="w-full text-sm mb-3 border border-collapse">
<thead class="bg-gray-100">
<tr>
<th class="border px-3 py-2 text-left">Subject</th>
<th class="border px-3 py-2 text-center">Score</th>
<th class="border px-3 py-2 text-left">Topics</th>
</tr>
</thead>
<tbody>${tableRows}</tbody>
</table>
</div>
`;
}
function createMonthlyReportHTML(session, studentIndex, sessionId, fullName) {
const firstReport = session[0];
const formattedDate = formatDetailedDate(new Date(firstReport.timestamp * 1000), true);
const safeTopics = safeText(firstReport.topics ? firstReport.topics.substring(0, 150) + (firstReport.topics.length > 150 ? '...' : '') : 'N/A');
return `
<div class="border rounded-lg shadow mb-4 p-4 bg-white hover:shadow-md transition-shadow duration-200" id="monthly-block-${studentIndex}-${sessionId}">
<div class="flex justify-between items-center mb-3 border-b pb-2">
<h5 class="font-medium text-gray-800">Monthly Report - ${safeText(formattedDate)}</h5>
<button onclick="downloadMonthlyReport(${studentIndex}, '${sessionId}', '${safeText(fullName)}')"
class="text-green-600 hover:text-green-800 font-medium flex items-center text-sm bg-green-50 px-3 py-1 rounded-lg hover:bg-green-100 transition-all duration-200">
<span class="mr-1">📥</span> Download PDF
</button>
</div>
<div class="text-sm text-gray-700 space-y-2">
<p><strong class="text-gray-800">Tutor:</strong> ${safeText(firstReport.tutorName || 'N/A')}</p>
<p><strong class="text-gray-800">Month:</strong> ${safeText(formattedDate.split(' ')[0])} ${new Date(firstReport.timestamp * 1000).getFullYear()}</p>
<div>
<strong class="text-gray-800">Topics Covered:</strong>
<p class="mt-1 bg-gray-50 p-3 rounded border">${safeTopics}</p>
</div>
${firstReport.studentProgress ? `
<div>
<strong class="text-gray-800">Progress Notes:</strong>
<p class="mt-1 bg-blue-50 p-3 rounded border">${safeText(firstReport.studentProgress)}</p>
</div>
` : ''}
</div>
</div>
`;
}
function downloadSessionReport(studentIndex, sessionId, studentName, type) {
const element = document.getElementById(`${type}-block-${studentIndex}-${sessionId}`);
if (!element) {
showMessage('Report element not found for download', 'error');
return;
}
const safeStudentName = studentName.replace(/[^a-zA-Z0-9]/g, '_');
const fileName = `${type === 'assessment' ? 'Assessment' : 'Monthly'}_Report_${safeStudentName}_${Date.now()}.pdf`;
const opt = {
margin: 0.5,
filename: fileName,
image: { type: 'jpeg', quality: 0.98 },
html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
};
showMessage('Generating PDF download...', 'success');
html2pdf().from(element).set(opt).save();
}
function downloadMonthlyReport(studentIndex, sessionId, studentName) {
downloadSessionReport(studentIndex, sessionId, studentName, 'monthly');
}
function toggleAccordion(elementId) {
const content = document.getElementById(`${elementId}-content`);
const arrow = document.getElementById(`${elementId}-arrow`);
if (!content || !arrow) return;
if (content.classList.contains('hidden')) {
content.classList.remove('hidden');
arrow.textContent = '▲';
} else {
content.classList.add('hidden');
arrow.textContent = '▼';
}
}
// ============================================================================
// SECTION 10: MAIN REPORT LOADING FUNCTION (FIXED & VERIFIED)
// ============================================================================
async function loadAllReportsForParent(parentPhone, userId, forceRefresh = false) {
const reportArea = document.getElementById("reportArea");
const reportContent = document.getElementById("reportContent");
const authArea = document.getElementById("authArea");
const authLoader = document.getElementById("authLoader");
const welcomeMessage = document.getElementById("welcomeMessage");
if (auth.currentUser && authArea && reportArea) {
authArea.classList.add("hidden");
reportArea.classList.remove("hidden");
authLoader.classList.add("hidden");
localStorage.setItem('isAuthenticated', 'true');
} else {
localStorage.removeItem('isAuthenticated');
}
if (authLoader) authLoader.classList.remove("hidden");
try {
const cacheKey = `reportCache_${parentPhone}`;
const cacheDuration = 5 * 60 * 1000; // 5 minutes
if (!forceRefresh) {
try {
const cachedItem = localStorage.getItem(cacheKey);
if (cachedItem) {
const cacheData = JSON.parse(cachedItem);
if (Date.now() - cacheData.timestamp < cacheDuration) {
currentUserData = cacheData.userData;
userChildren = cacheData.studentList || [];
if (reportContent) reportContent.innerHTML = cacheData.html;
if (welcomeMessage && currentUserData.parentName) {
welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;
}
addManualRefreshButton();
addLogoutButton();
loadReferralRewards(userId);
loadAcademicsData();
setupRealTimeMonitoring(parentPhone, userId);
return;
}
}
} catch (e) {
localStorage.removeItem(cacheKey);
}
}
const { studentIds, studentNameIdMap, allStudentData } = await findStudentIdsForParent(parentPhone);
userChildren = Array.from(studentNameIdMap.keys());
let parentName = null;
if (allStudentData && allStudentData.length > 0) {
const studentWithParentInfo = allStudentData.find(s => s.data && (s.data.parentName || s.data.guardianName || s.data.fatherName || s.data.motherName));
if (studentWithParentInfo) {
parentName = studentWithParentInfo.data.parentName || studentWithParentInfo.data.guardianName || studentWithParentInfo.data.fatherName || studentWithParentInfo.data.motherName;
}
}
const userDocRef = db.collection('parent_users').doc(userId);
let userDoc = await userDocRef.get();
let userData = userDoc.data();
if (userDoc.exists && !userData.referralCode) {
const newCode = await generateReferralCode();
await userDocRef.update({ referralCode: newCode });
}
if (!parentName && userData?.parentName) parentName = userData.parentName;
if (!parentName) parentName = 'Parent';
currentUserData = { parentName: safeText(parentName), parentPhone: parentPhone, email: userData?.email || '' };
if (welcomeMessage) welcomeMessage.textContent = `Welcome, ${currentUserData.parentName}!`;
const { assessmentResults, monthlyResults } = await searchAllReportsForParent(parentPhone, currentUserData.email, userId);
const reportsByStudent = new Map();
userChildren.forEach(studentName => {
const studentInfo = allStudentData.find(s => s.name === studentName);
reportsByStudent.set(studentName, {
assessments: new Map(),
monthly: new Map(),
studentData: studentInfo || { name: studentName, isPending: false }
});
});
assessmentResults.forEach(result => {
const rawName = result.studentName || result.student;
if (!rawName) return;
const studentName = safeText(rawName);
if (!reportsByStudent.has(studentName)) {
reportsByStudent.set(studentName, {
assessments: new Map(),
monthly: new Map(),
studentData: { name: studentName, isPending: false }
});
userChildren.push(studentName);
}
const sessionKey = Math.floor(result.timestamp / 86400);
const studentRecord = reportsByStudent.get(studentName);
if (!studentRecord.assessments.has(sessionKey)) {
studentRecord.assessments.set(sessionKey, []);
}
studentRecord.assessments.get(sessionKey).push(result);
});
monthlyResults.forEach(result => {
const rawName = result.studentName || result.student;
if (!rawName) return;
const studentName = safeText(rawName);
if (!reportsByStudent.has(studentName)) {
reportsByStudent.set(studentName, {
assessments: new Map(),
monthly: new Map(),
studentData: { name: studentName, isPending: false }
});
userChildren.push(studentName);
}
const sessionKey = Math.floor(result.timestamp / 86400);
const studentRecord = reportsByStudent.get(studentName);
if (!studentRecord.monthly.has(sessionKey)) {
studentRecord.monthly.set(sessionKey, []);
}
studentRecord.monthly.get(sessionKey).push(result);
});
if (reportContent) {
if (reportsByStudent.size === 0) {
reportContent.innerHTML = `
<div class="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
<div class="text-6xl mb-4">👋</div>
<h3 class="text-xl font-bold text-gray-700 mb-2">Welcome to BKH!</h3>
<p class="text-gray-500 max-w-md mx-auto mb-6">We don't see any students linked to your account yet.</p>
<p class="text-sm text-gray-400">If you have registered, please contact support to link your account.</p>
</div>
`;
} else {
const reportsHtml = createYearlyArchiveReportView(reportsByStudent);
reportContent.innerHTML = reportsHtml;
}
}
try {
const dataToCache = {
timestamp: Date.now(),
html: reportContent ? reportContent.innerHTML : '',
userData: currentUserData,
studentList: userChildren
};
localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
} catch (e) {
console.error("Cache write failed:", e);
}
if (authArea && reportArea) {
authArea.classList.add("hidden");
reportArea.classList.remove("hidden");
}
addManualRefreshButton();
addLogoutButton();
setupRealTimeMonitoring(parentPhone, userId);
loadReferralRewards(userId);
loadAcademicsData();
} catch (error) {
console.error("❌ CRITICAL FAILURE in Report Loading:", error);
if (reportContent) {
reportContent.innerHTML = `
<div class="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-md">
<div class="flex">
<div class="flex-shrink-0"><span class="text-2xl">⚠️</span></div>
<div class="ml-3">
<h3 class="text-lg font-medium text-red-800">System Error</h3>
<p class="text-sm text-red-700 mt-1">We encountered an issue loading your dashboard: ${safeText(error.message)}</p>
<button onclick="window.location.reload()" class="mt-3 bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-200">Reload Page</button>
</div>
</div>
</div>
`;
}
} finally {
if (authLoader) authLoader.classList.add("hidden");
}
}
// ============================================================================
// SECTION 11: ULTIMATE REPORT SEARCH - GUARANTEED TO FIND ALL REPORTS
// ============================================================================
async function searchAllReportsForParent(parentPhone, parentEmail = '', parentUid = '') {
let allResults = [], foundSources = new Set();
try {
const searchQueries = await generateAllSearchQueries(parentPhone, parentEmail, parentUid);
const collectionsToSearch = [
'tutor_submissions','student_results','monthly_reports','assessment_reports','progress_reports',
'reports','student_reports','parent_reports','academic_reports','session_reports','performance_reports'
];
const searchPromises = [];
for (const collectionName of collectionsToSearch) {
for (const query of searchQueries) {
searchPromises.push(
searchInCollection(collectionName, query).then(results => {
if (results.length > 0) foundSources.add(`${collectionName}:${query.field}`);
return results;
}).catch(() => [])
);
}
}
const allResultsArrays = await Promise.all(searchPromises);
allResults = allResultsArrays.flat();
if (allResults.length === 0) {
const emergencyResults = await emergencyReportSearch(parentPhone, parentEmail);
allResults = emergencyResults;
}
const uniqueResults = [];
const seenIds = new Set();
allResults.forEach(result => {
const uniqueKey = `${result.collection}_${result.id}_${result.studentName}_${result.timestamp}`;
if (!seenIds.has(uniqueKey)) {
seenIds.add(uniqueKey);
uniqueResults.push(result);
}
});
const assessmentResults = uniqueResults.filter(r =>
r.type === 'assessment' ||
r.collection.includes('assessment') ||
r.collection.includes('progress') ||
(r.reportType && r.reportType.toLowerCase().includes('assessment'))
);
const monthlyResults = uniqueResults.filter(r =>
r.type === 'monthly' ||
r.collection.includes('monthly') ||
r.collection.includes('submission') ||
(r.reportType && r.reportType.toLowerCase().includes('monthly'))
);
assessmentResults.sort((a, b) => b.timestamp - a.timestamp);
monthlyResults.sort((a, b) => b.timestamp - a.timestamp);
return { assessmentResults, monthlyResults, searchStats: {
totalFound: uniqueResults.length,
sources: Array.from(foundSources),
collectionsSearched: collectionsToSearch.length
}};
} catch (error) {
console.error("❌ Ultimate search error:", error);
return { assessmentResults: [], monthlyResults: [], searchStats: { error: error.message }};
}
}
async function generateAllSearchQueries(parentPhone, parentEmail, parentUid) {
const queries = [];
const phoneVariations = generateAllPhoneVariations(parentPhone);
for (const phone of phoneVariations) {
['parentPhone','parentphone','parent_phone','guardianPhone','motherPhone','fatherPhone','phone','parent_contact','contact_number','contactPhone'].forEach(field =>
queries.push({ field, value: phone })
);
}
if (parentEmail) {
[parentEmail.toLowerCase(), parentEmail.toUpperCase(), parentEmail].forEach(email =>
['parentEmail','parentemail','email','guardianEmail','parent_email','contact_email'].forEach(field =>
queries.push({ field, value: email })
);
}
if (parentUid) {
['parentUid','parentuid','userId','user_id','createdBy','ownerUid'].forEach(field =>
queries.push({ field, value: parentUid })
);
}
try {
const normalizedPhone = normalizePhoneNumber(parentPhone);
if (normalizedPhone.valid) {
for (const phoneVar of phoneVariations) {
try {
const studentsSnapshot = await db.collection('students').where('parentPhone', '==', phoneVar).get();
if (!studentsSnapshot.empty) {
studentsSnapshot.forEach(doc => {
const studentId = doc.id;
const studentData = doc.data();
['studentId','studentID','student_id'].forEach(field =>
queries.push({ field, value: studentId }, { field, value: studentId.toLowerCase() }, { field, value: studentId.toUpperCase() })
);
if (studentData.studentName) {
const studentName = safeText(studentData.studentName);
['studentName','student_name','student'].forEach(field =>
queries.push({ field, value: studentName })
);
}
});
}
} catch (error) {}
}
}
} catch (error) {}
return queries;
}
async function searchInCollection(collectionName, query) {
try {
const snapshot = await db.collection(collectionName).where(query.field, '==', query.value).get();
const results = [];
snapshot.forEach(doc => {
const data = doc.data();
results.push({
id: doc.id,
collection: collectionName,
fieldMatched: query.field,
valueMatched: query.value,
...data,
timestamp: getTimestampFromData(data),
type: determineReportType(collectionName, data)
});
});
return results;
} catch (error) {
if (error.code !== 'failed-precondition' && error.code !== 'invalid-argument') {
console.warn(`Search error in ${collectionName} for ${query.field}=${query.value}:`, error.message);
}
return [];
}
}
async function emergencyReportSearch(parentPhone, parentEmail) {
const results = [];
try {
const allSubmissions = await db.collection('tutor_submissions').limit(1000).get();
const phoneVariations = generateAllPhoneVariations(parentPhone);
allSubmissions.forEach(doc => {
const data = doc.data();
let matched = false;
const phoneFields = ['parentPhone','parentphone','parent_phone','phone','guardianPhone','contact_number'];
for (const field of phoneFields) {
if (data[field]) {
const fieldValue = String(data[field]).trim();
for (const phoneVar of phoneVariations) {
if (fieldValue === phoneVar || fieldValue.includes(phoneVar)) {
results.push({ id: doc.id, collection: 'tutor_submissions', emergencyMatch: true, matchedField: field, matchedValue: fieldValue, ...data, timestamp: getTimestampFromData(data), type: 'monthly' });
matched = true; break;
}
}
if (matched) break;
}
}
if (!matched && parentEmail) {
const emailFields = ['parentEmail','parentemail','email','guardianEmail'];
for (const field of emailFields) {
if (data[field] && data[field].toLowerCase() === parentEmail.toLowerCase()) {
results.push({ id: doc.id, collection: 'tutor_submissions', emergencyMatch: true, matchedField: field, matchedValue: data[field], ...data, timestamp: getTimestampFromData(data), type: 'monthly' });
matched = true; break;
}
}
}
if (!matched && userChildren.length > 0) {
const studentName = data.studentName || data.student;
if (studentName && userChildren.includes(safeText(studentName))) {
results.push({ id: doc.id, collection: 'tutor_submissions', emergencyMatch: true, matchedField: 'studentName', matchedValue: studentName, ...data, timestamp: getTimestampFromData(data), type: 'monthly' });
}
}
});
const allAssessments = await db.collection('student_results').limit(1000).get();
allAssessments.forEach(doc => {
const data = doc.data();
let matched = false;
const phoneFields = ['parentPhone','parentphone','parent_phone','phone'];
for (const field of phoneFields) {
if (data[field]) {
const fieldValue = String(data[field]).trim();
for (const phoneVar of phoneVariations) {
if (fieldValue === phoneVar || fieldValue.includes(phoneVar)) {
results.push({ id: doc.id, collection: 'student_results', emergencyMatch: true, matchedField: field, matchedValue: fieldValue, ...data, timestamp: getTimestampFromData(data), type: 'assessment' });
matched = true; break;
}
}
if (matched) break;
}
}
if (!matched && parentEmail) {
const emailFields = ['parentEmail','parentemail','email'];
for (const field of emailFields) {
if (data[field] && data[field].toLowerCase() === parentEmail.toLowerCase()) {
results.push({ id: doc.id, collection: 'student_results', emergencyMatch: true, matchedField: field, matchedValue: data[field], ...data, timestamp: getTimestampFromData(data), type: 'assessment' });
matched = true; break;
}
}
}
if (!matched && userChildren.length > 0) {
const studentName = data.studentName || data.student;
if (studentName && userChildren.includes(safeText(studentName))) {
results.push({ id: doc.id, collection: 'student_results', emergencyMatch: true, matchedField: 'studentName', matchedValue: studentName, ...data, timestamp: getTimestampFromData(data), type: 'assessment' });
}
}
});
} catch (error) {
console.error("Emergency search failed:", error);
}
return results;
}
function generateAllPhoneVariations(phone) {
const variations = new Set();
if (!phone || typeof phone !== 'string') return [];
variations.add(phone.trim());
const basicCleaned = phone.replace(/[^\d+]/g, '');
variations.add(basicCleaned);
if (basicCleaned.startsWith('+')) variations.add(basicCleaned.substring(1));
const countryCodePatterns = [
{ code: '+1', length: 11 }, { code: '+234', length: 14 }, { code: '+44', length: 13 }, { code: '+91', length: 13 },
{ code: '+86', length: 14 }, { code: '+33', length: 12 }, { code: '+49', length: 13 }, { code: '+81', length: 13 },
{ code: '+61', length: 12 }, { code: '+55', length: 13 }, { code: '+7', length: 12 }, { code: '+20', length: 13 },
{ code: '+27', length: 12 }, { code: '+34', length: 12 }, { code: '+39', length: 12 }, { code: '+52', length: 13 },
{ code: '+62', length: 13 }, { code: '+82', length: 13 }, { code: '+90', length: 13 }, { code: '+92', length: 13 },
{ code: '+966', length: 14 }, { code: '+971', length: 13 }, { code: '+233', length: 13 }, { code: '+254', length: 13 },
{ code: '+255', length: 13 }, { code: '+256', length: 13 }, { code: '+237', length: 13 }, { code: '+251', length: 13 },
{ code: '+250', length: 13 }, { code: '+260', length: 13 }, { code: '+263', length: 13 }, { code: '+265', length: 13 },
{ code: '+267', length: 13 }, { code: '+268', length: 13 }, { code: '+269', length: 13 }, { code: '+290', length: 11 },
{ code: '+291', length: 11 }, { code: '+297', length: 10 }, { code: '+298', length: 9 }, { code: '+299', length: 9 }
];
for (const pattern of countryCodePatterns) {
if (basicCleaned.startsWith(pattern.code)) {
const withoutCode = basicCleaned.substring(pattern.code.length);
variations.add(withoutCode);
variations.add('0' + withoutCode);
variations.add(pattern.code.substring(1) + withoutCode);
if (withoutCode.length >= 7) {
if (pattern.code === '+1' && withoutCode.length === 10) {
variations.add('(' + withoutCode.substring(0, 3) + ') ' + withoutCode.substring(3, 6) + '-' + withoutCode.substring(6));
} else if (pattern.code === '+44' && withoutCode.length === 10) {
variations.add('0' + withoutCode.substring(0, 4) + ' ' + withoutCode.substring(4, 7) + ' ' + withoutCode.substring(7));
} else if (withoutCode.length >= 10) {
variations.add(withoutCode.substring(0, 3) + '-' + withoutCode.substring(3));
variations.add(withoutCode.substring(0, 4) + '-' + withoutCode.substring(4));
variations.add('(' + withoutCode.substring(0, 3) + ') ' + withoutCode.substring(3));
}
}
}
}
if (basicCleaned.startsWith('0') && basicCleaned.length > 1) {
const localNumber = basicCleaned.substring(1);
for (const pattern of countryCodePatterns) {
if (pattern.code !== '+1' || localNumber.length === 10) {
variations.add(pattern.code + localNumber);
variations.add(pattern.code.substring(1) + localNumber);
}
}
variations.add(localNumber);
}
if (/^\d+$/.test(basicCleaned)) {
if (basicCleaned.length >= 9) {
variations.add('+' + basicCleaned);
for (const pattern of countryCodePatterns) {
const codeWithoutPlus = pattern.code.substring(1);
if (basicCleaned.startsWith(codeWithoutPlus)) {
const localPart = basicCleaned.substring(codeWithoutPlus.length);
variations.add(pattern.code + localPart);
}
}
if (basicCleaned.length === 10) variations.add('+1' + basicCleaned);
else if (basicCleaned.length === 11 && basicCleaned.startsWith('1')) {
variations.add('+' + basicCleaned);
variations.add('+1' + basicCleaned.substring(1));
} else if (basicCleaned.length === 11 && basicCleaned.startsWith('0')) {
variations.add('+234' + basicCleaned.substring(1));
}
}
}
const allVariations = Array.from(variations);
allVariations.forEach(variation => {
if (variation && variation.length >= 7) {
const digitsOnly = variation.replace(/[^\d+]/g, '');
if (digitsOnly.length === 10) {
const spaced1 = digitsOnly.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
if (spaced1 !== variation) variations.add(spaced1);
const spaced2 = digitsOnly.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
if (spaced2 !== variation) variations.add(spaced2);
} else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
const spaced3 = digitsOnly.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '$1 $2 $3 $4');
if (spaced3 !== variation) variations.add(spaced3);
} else if (digitsOnly.length >= 10) {
const spacedGeneric = digitsOnly.replace(/(\d{3})(?=\d)/g, '$1 ');
if (spacedGeneric !== variation) variations.add(spacedGeneric);
const dashed = digitsOnly.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
if (dashed !== variation) variations.add(dashed);
}
}
});
return Array.from(variations)
.filter(v => v && v.length >= 7 && v.length <= 20 && !v.includes('undefined'))
.filter((v, i, arr) => arr.indexOf(v) === i);
}
function determineReportType(collectionName, data) {
if (collectionName.includes('monthly') || collectionName.includes('submission')) return 'monthly';
if (collectionName.includes('assessment') || collectionName.includes('progress')) return 'assessment';
if (data.reportType) return data.reportType.toLowerCase();
if (data.type) return data.type;
if (data.collection) return data.collection.toLowerCase();
return 'unknown';
}
// ============================================================================
// SECTION 12: REAL-TIME MONITORING WITHOUT COMPLEX QUERIES
// ============================================================================
function setupRealTimeMonitoring(parentPhone, userId) {
cleanupRealTimeListeners();
const normalizedPhone = normalizePhoneNumber(parentPhone);
if (!normalizedPhone.valid) return;
const monthlyListener = db.collection("tutor_submissions")
.where("parentPhone", "==", normalizedPhone.normalized)
.onSnapshot((snapshot) => {
snapshot.docChanges().forEach((change) => {
if (change.type === "added") {
showNewReportNotification('monthly');
setTimeout(() => loadAllReportsForParent(parentPhone, userId), 2000);
}
});
}, (error) => console.error("Monthly reports listener error:", error));
realTimeListeners.push(monthlyListener);
const assessmentListener = db.collection("student_results")
.where("parentPhone", "==", normalizedPhone.normalized)
.onSnapshot((snapshot) => {
snapshot.docChanges().forEach((change) => {
if (change.type === "added") {
showNewReportNotification('assessment');
setTimeout(() => loadAllReportsForParent(parentPhone, userId), 2000);
}
});
}, (error) => console.error("Assessment reports listener error:", error));
realTimeListeners.push(assessmentListener);
setInterval(() => checkForNewAcademics(), 30000);
}
function cleanupRealTimeListeners() {
realTimeListeners.forEach(unsubscribe => { if (typeof unsubscribe === 'function') unsubscribe(); });
realTimeListeners = [];
}
function showNewReportNotification(type) {
const reportType = type === 'assessment' ? 'Assessment Report' : type === 'monthly' ? 'Monthly Report' : 'New Update';
showMessage(`New ${reportType} available!`, 'success');
const existingIndicator = document.getElementById('newReportIndicator');
if (existingIndicator) existingIndicator.remove();
const indicator = document.createElement('div');
indicator.id = 'newReportIndicator';
indicator.className = 'fixed top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-40 animate-pulse fade-in';
indicator.innerHTML = `📄 New ${safeText(reportType)} Available!`;
document.body.appendChild(indicator);
setTimeout(() => indicator.remove(), 5000);
}
// ============================================================================
// SECTION 13: NAVIGATION BUTTONS & DYNAMIC UI
// ============================================================================
function addManualRefreshButton() {
const welcomeSection = document.querySelector('.bg-green-50');
if (!welcomeSection) return;
const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
if (!buttonContainer) return;
if (document.getElementById('manualRefreshBtn')) return;
const refreshBtn = document.createElement('button');
refreshBtn.id = 'manualRefreshBtn';
refreshBtn.onclick = manualRefreshReportsV2;
refreshBtn.className = 'bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-all duration-200 btn-glow flex items-center justify-center';
refreshBtn.innerHTML = '<span class="mr-2">🔄</span> Check for New Reports';
const logoutBtn = buttonContainer.querySelector('button[onclick="logout()"]');
if (logoutBtn) buttonContainer.insertBefore(refreshBtn, logoutBtn);
else buttonContainer.appendChild(refreshBtn);
}
function addLogoutButton() {
const welcomeSection = document.querySelector('.bg-green-50');
if (!welcomeSection) return;
const buttonContainer = welcomeSection.querySelector('.flex.gap-2');
if (!buttonContainer) return;
if (buttonContainer.querySelector('button[onclick="logout()"]')) return;
const logoutBtn = document.createElement('button');
logoutBtn.onclick = logout;
logoutBtn.className = 'bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-all duration-200 btn-glow flex items-center justify-center';
logoutBtn.innerHTML = '<span class="mr-2">🚪</span> Logout';
buttonContainer.appendChild(logoutBtn);
}
async function manualRefreshReportsV2() {
const refreshBtn = document.getElementById('manualRefreshBtn');
if (!refreshBtn) return;
const originalText = refreshBtn.innerHTML;
refreshBtn.innerHTML = '<div class="loading-spinner-small mr-2"></div> Refreshing...';
refreshBtn.disabled = true;
try {
await authManager.reloadDashboard();
await checkForNewAcademics();
showMessage('Dashboard refreshed!', 'success');
} catch (error) {
console.error('Refresh error:', error);
showMessage('Refresh failed. Please try again.', 'error');
} finally {
refreshBtn.innerHTML = originalText;
refreshBtn.disabled = false;
}
}
// ============================================================================
// SECTION 14: TAB MANAGEMENT & NAVIGATION
// ============================================================================
function switchMainTab(tab) {
const reportTab = document.getElementById('reportTab');
const academicsTab = document.getElementById('academicsTab');
const rewardsTab = document.getElementById('rewardsTab');
const reportContentArea = document.getElementById('reportContentArea');
const academicsContentArea = document.getElementById('academicsContentArea');
const rewardsContentArea = document.getElementById('rewardsContentArea');
[reportTab, academicsTab, rewardsTab].forEach(t => {
if (t) { t.classList.remove('tab-active-main'); t.classList.add('tab-inactive-main'); }
});
[reportContentArea, academicsContentArea, rewardsContentArea].forEach(a => {
if (a) a.classList.add('hidden');
});
if (tab === 'reports') {
reportTab?.classList.remove('tab-inactive-main'); reportTab?.classList.add('tab-active-main');
reportContentArea?.classList.remove('hidden');
} else if (tab === 'academics') {
academicsTab?.classList.remove('tab-inactive-main'); academicsTab?.classList.add('tab-active-main');
academicsContentArea?.classList.remove('hidden');
loadAcademicsData();
} else if (tab === 'rewards') {
rewardsTab?.classList.remove('tab-inactive-main'); rewardsTab?.classList.add('tab-active-main');
rewardsContentArea?.classList.remove('hidden');
const user = auth.currentUser;
if (user) loadReferralRewards(user.uid);
}
}
function logout() {
localStorage.removeItem('rememberMe');
localStorage.removeItem('savedEmail');
localStorage.removeItem('isAuthenticated');
cleanupRealTimeListeners();
auth.signOut().then(() => window.location.reload());
}
// ============================================================================
// SECTION 15: UNIFIED AUTH & DATA MANAGER - FIXES RELOADING & MISSING CHILDREN
// ============================================================================
class UnifiedAuthManager {
constructor() {
this.currentUser = null;
this.authListener = null;
this.isInitialized = false;
this.isProcessing = false;
this.lastProcessTime = 0;
this.DEBOUNCE_MS = 2000;
}
initialize() {
if (this.isInitialized) return;
console.log("🔐 Initializing Unified Auth Manager");
this.cleanup();
this.authListener = auth.onAuthStateChanged(
(user) => this.handleAuthChange(user),
(error) => this.handleAuthError(error)
);
this.isInitialized = true;
}
async handleAuthChange(user) {
const now = Date.now();
const timeSinceLastProcess = now - this.lastProcessTime;
if (this.isProcessing) return;
if (timeSinceLastProcess < this.DEBOUNCE_MS) return;
this.isProcessing = true;
this.lastProcessTime = now;
try {
if (user && user.uid) {
await this.loadUserDashboard(user);
} else {
this.showAuthScreen();
}
} catch (error) {
console.error("❌ Auth change error:", error);
showMessage("Authentication error. Please refresh.", "error");
} finally {
setTimeout(() => { this.isProcessing = false; }, 1000);
}
}
handleAuthError(error) {
console.error("❌ Auth listener error:", error);
showMessage("Authentication error occurred", "error");
}
async loadUserDashboard(user) {
const authArea = document.getElementById("authArea");
const reportArea = document.getElementById("reportArea");
const authLoader = document.getElementById("authLoader");
if (authLoader) authLoader.classList.remove("hidden");
try {
const userDoc = await db.collection('parent_users').doc(user.uid).get();
if (!userDoc.exists) throw new Error("User profile not found");
const userData = userDoc.data();
this.currentUser = {
uid: user.uid,
email: userData.email,
phone: userData.phone,
normalizedPhone: userData.normalizedPhone || userData.phone,
parentName: userData.parentName || 'Parent',
referralCode: userData.referralCode
};
this.showDashboardUI();
await Promise.all([
this.loadAllChildrenAndReports(),
this.loadReferralsData(),
this.loadAcademicsData(),
this.setupRealtimeMonitoring()
]);
this.setupUIComponents();
} catch (error) {
console.error("❌ Dashboard load error:", error);
showMessage(error.message || "Failed to load dashboard", "error");
this.showAuthScreen();
} finally {
if (authLoader) authLoader.classList.add("hidden");
}
}
showDashboardUI() {
const authArea = document.getElementById("authArea");
const reportArea = document.getElementById("reportArea");
const welcomeMessage = document.getElementById("welcomeMessage");
if (authArea) authArea.classList.add("hidden");
if (reportArea) reportArea.classList.remove("hidden");
if (welcomeMessage && this.currentUser) {
welcomeMessage.textContent = `Welcome, ${this.currentUser.parentName}!`;
}
localStorage.setItem('isAuthenticated', 'true');
}
showAuthScreen() {
const authArea = document.getElementById("authArea");
const reportArea = document.getElementById("reportArea");
if (authArea) authArea.classList.remove("hidden");
if (reportArea) reportArea.classList.add("hidden");
localStorage.removeItem('isAuthenticated');
cleanupRealTimeListeners();
}
async loadAllChildrenAndReports() {
const childrenData = await comprehensiveFindChildren(this.currentUser.normalizedPhone);
userChildren = childrenData.studentNames;
studentIdMap = childrenData.studentNameIdMap;
await loadAllReportsForParent(this.currentUser.normalizedPhone, this.currentUser.uid, false);
}
async loadReferralsData() {
try { await loadReferralRewards(this.currentUser.uid); } catch (error) { console.error("⚠️ Error loading referrals:", error); }
}
async loadAcademicsData() {
try { await loadAcademicsData(); } catch (error) { console.error("⚠️ Error loading academics:", error); }
}
async setupRealtimeMonitoring() {
try { setupRealTimeMonitoring(this.currentUser.normalizedPhone, this.currentUser.uid); } catch (error) { console.error("⚠️ Error setting up monitoring:", error); }
}
setupUIComponents() {
addManualRefreshButton();
addLogoutButton();
}
cleanup() {
if (this.authListener && typeof this.authListener === 'function') this.authListener();
this.isInitialized = false;
}
async reloadDashboard() {
if (!this.currentUser) return;
await this.loadAllChildrenAndReports();
}
}
async function comprehensiveFindChildren(parentPhone) {
const allChildren = new Map();
const studentNameIdMap = new Map();
try {
const phoneVariations = generateAllPhoneVariations(parentPhone);
for (const phoneVar of phoneVariations) {
try {
const snapshot = await db.collection('students').where('parentPhone', '==', phoneVar).get();
snapshot.forEach(doc => {
const data = doc.data();
const studentId = doc.id;
const studentName = safeText(data.studentName || data.name || 'Unknown');
if (studentName !== 'Unknown' && !allChildren.has(studentId)) {
allChildren.set(studentId, { id: studentId, name: studentName, data: data, isPending: false, collection: 'students' });
if (studentNameIdMap.has(studentName)) {
const uniqueName = `${studentName} (${studentId.substring(0, 4)})`;
studentNameIdMap.set(uniqueName, studentId);
} else {
studentNameIdMap.set(studentName, studentId);
}
}
});
} catch (error) {}
}
for (const phoneVar of phoneVariations) {
try {
const snapshot = await db.collection('pending_students').where('parentPhone', '==', phoneVar).get();
snapshot.forEach(doc => {
const data = doc.data();
const studentId = doc.id;
const studentName = safeText(data.studentName || data.name || 'Unknown');
if (studentName !== 'Unknown' && !allChildren.has(studentId)) {
allChildren.set(studentId, { id: studentId, name: studentName, data: data, isPending: true, collection: 'pending_students' });
if (studentNameIdMap.has(studentName)) {
const uniqueName = `${studentName} (${studentId.substring(0, 4)})`;
studentNameIdMap.set(uniqueName, studentId);
} else {
studentNameIdMap.set(studentName, studentId);
}
}
});
} catch (error) {}
}
const userDoc = await db.collection('parent_users').where('normalizedPhone', '==', parentPhone).limit(1).get();
if (!userDoc.empty) {
const userData = userDoc.docs[0].data();
if (userData.email) {
try {
const emailSnapshot = await db.collection('students').where('parentEmail', '==', userData.email).get();
emailSnapshot.forEach(doc => {
const data = doc.data();
const studentId = doc.id;
const studentName = safeText(data.studentName || data.name || 'Unknown');
if (studentName !== 'Unknown' && !allChildren.has(studentId)) {
allChildren.set(studentId, { id: studentId, name: studentName, data: data, isPending: false, collection: 'students' });
if (!studentNameIdMap.has(studentName)) studentNameIdMap.set(studentName, studentId);
}
});
} catch (error) {}
}
}
const studentNames = Array.from(studentNameIdMap.keys());
const studentIds = Array.from(allChildren.keys());
const allStudentData = Array.from(allChildren.values());
return { studentIds, studentNameIdMap, allStudentData, studentNames };
} catch (error) {
console.error("❌ Comprehensive search error:", error);
return { studentIds: [], studentNameIdMap: new Map(), allStudentData: [], studentNames: [] };
}
}
function initializeParentPortalV2() {
injectCustomCSS();
createCountryCodeDropdown();
setupEventListeners();
setupGlobalErrorHandler();
authManager.initialize();
window.addEventListener('beforeunload', () => {
authManager.cleanup();
cleanupRealTimeListeners();
});
}
function setupEventListeners() {
const reportTab = document.getElementById("reportTab");
const academicsTab = document.getElementById("academicsTab");
const rewardsTab = document.getElementById("rewardsTab");
if (reportTab) reportTab.addEventListener("click", () => switchMainTab('reports'));
if (academicsTab) academicsTab.addEventListener("click", () => switchMainTab('academics'));
if (rewardsTab) rewardsTab.addEventListener("click", () => switchMainTab('rewards'));
}
function setupGlobalErrorHandler() {
window.addEventListener('unhandledrejection', e => { console.error('Unhandled promise rejection:', e.reason); e.preventDefault(); });
window.addEventListener('error', e => {
console.error('Global error:', e.error);
if (!e.error?.message?.includes('auth') && !e.error?.message?.includes('permission-denied')) {
showMessage('An unexpected error occurred. Please refresh the page.', 'error');
}
e.preventDefault();
});
window.addEventListener('offline', () => { console.warn('Network offline'); showMessage('You are offline. Some features may not work.', 'warning'); });
window.addEventListener('online', () => { console.log('Network back online'); showMessage('Connection restored.', 'success'); });
}
const authManager = new UnifiedAuthManager();
window.authManager = authManager;
window.comprehensiveFindChildren = comprehensiveFindChildren;
window.manualRefreshReportsV2 = manualRefreshReportsV2;
document.addEventListener('DOMContentLoaded', () => {
console.log("📄 DOM Content Loaded - Starting V2 initialization");
initializeParentPortalV2();
console.log("🎉 Parent Portal V2 initialized");
});
