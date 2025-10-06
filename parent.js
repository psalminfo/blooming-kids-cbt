[file name]: parent.js
[file content begin]
import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// Cache configuration
const CACHE_DURATION = 14 * 24 * 60 * 60 * 1000; // 2 weeks in milliseconds

// Cache functions
function getCacheKey(parentPhone) {
    return `parent_cache_${parentPhone}`;
}

function saveToCache(parentPhone, data) {
    try {
        const cacheData = {
            timestamp: Date.now(),
            data: data
        };
        localStorage.setItem(getCacheKey(parentPhone), JSON.stringify(cacheData));
    } catch (error) {
        console.warn('Error saving to cache:', error);
    }
}

function loadFromCache(parentPhone) {
    try {
        const cached = localStorage.getItem(getCacheKey(parentPhone));
        if (!cached) return null;
        
        const cacheData = JSON.parse(cached);
        const isExpired = Date.now() - cacheData.timestamp > CACHE_DURATION;
        
        if (isExpired) {
            localStorage.removeItem(getCacheKey(parentPhone));
            return null;
        }
        
        return cacheData.data;
    } catch (error) {
        console.warn('Error loading from cache:', error);
        return null;
    }
}

// Function to normalize phone numbers for search
function normalizePhone(phone) {
    return phone.replace(/\D/g, '').slice(-10); // Keep only last 10 digits
}

// Function to search for students by parent phone number
async function searchStudentsByPhone(parentPhone) {
    // Try cache first
    const cached = loadFromCache(parentPhone);
    if (cached) {
        console.log('Returning cached data for phone:', parentPhone);
        return cached;
    }

    console.log('Fetching fresh data for phone:', parentPhone);
    const normalizedPhone = normalizePhone(parentPhone);
    
    try {
        // Search in both collections simultaneously
        const [studentsQuery, pendingQuery, resultsQuery, reportsQuery] = await Promise.all([
            getDocs(query(collection(db, "students"), where("normalizedPhone", "==", normalizedPhone))),
            getDocs(query(collection(db, "pending_students"), where("normalizedPhone", "==", normalizedPhone))),
            getDocs(query(collection(db, "student_results"), where("normalizedPhone", "==", normalizedPhone))),
            getDocs(query(collection(db, "monthly_reports"), where("normalizedPhone", "==", normalizedPhone)))
        ]);

        const students = [];
        const studentResults = [];
        const monthlyReports = [];

        // Process students from both collections
        studentsQuery.forEach(doc => {
            students.push({ id: doc.id, ...doc.data(), isPending: false });
        });
        pendingQuery.forEach(doc => {
            students.push({ id: doc.id, ...doc.data(), isPending: true });
        });

        // Process student results
        resultsQuery.forEach(doc => {
            studentResults.push({ id: doc.id, ...doc.data() });
        });

        // Process monthly reports
        reportsQuery.forEach(doc => {
            monthlyReports.push({ id: doc.id, ...doc.data() });
        });

        const result = {
            students,
            studentResults,
            monthlyReports,
            timestamp: new Date().toISOString()
        };

        // Save to cache
        saveToCache(parentPhone, result);
        return result;
    } catch (error) {
        console.error("Error searching for students:", error);
        throw error;
    }
}

// Function to render student results
function renderStudentResults(container, data, parentPhone) {
    const { students, studentResults, monthlyReports } = data;
    
    let html = `
        <div class="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 class="text-2xl font-bold text-green-700 mb-2">Student Results</h2>
            <p class="text-gray-600 mb-4">Phone: ${parentPhone}</p>
            <p class="text-sm text-gray-500">Last updated: ${new Date().toLocaleString()}</p>
        </div>
    `;

    if (students.length === 0) {
        html += `<div class="bg-white p-6 rounded-lg shadow-md text-center">
                    <p class="text-gray-500">No students found for this phone number.</p>
                 </div>`;
        container.innerHTML = html;
        return;
    }

    students.forEach(student => {
        const studentResult = studentResults.find(result => result.studentId === student.id);
        const studentReports = monthlyReports.filter(report => report.studentId === student.id)
                                            .sort((a, b) => new Date(b.month) - new Date(a.month));
        
        html += `
            <div class="bg-white p-6 rounded-lg shadow-md mb-6">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800">${student.studentName}</h3>
                        <p class="text-gray-600">Grade: ${student.grade} | Tutor: ${student.tutorName || 'N/A'}</p>
                        ${student.isPending ? '<span class="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full mt-1">Pending Approval</span>' : ''}
                    </div>
                </div>

                ${studentResult ? `
                    <div class="mb-6">
                        <h4 class="font-semibold text-lg mb-3 text-green-700">Assessment Results</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            ${studentResult.subjects && studentResult.subjects.map(subject => `
                                <div class="bg-gray-50 p-4 rounded-lg border">
                                    <h5 class="font-semibold text-gray-700">${subject.name}</h5>
                                    <p class="text-2xl font-bold text-green-600 mt-2">${subject.score}%</p>
                                    <p class="text-sm text-gray-600 mt-1">${subject.remarks || ''}</p>
                                </div>
                            `).join('')}
                        </div>
                        ${studentResult.overallRemarks ? `
                            <div class="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <h5 class="font-semibold text-blue-700 mb-2">Tutor's Remarks</h5>
                                <p class="text-gray-700">${studentResult.overallRemarks}</p>
                            </div>
                        ` : ''}
                    </div>
                ` : '<p class="text-gray-500 mb-6">No assessment results available yet.</p>'}

                ${studentReports.length > 0 ? `
                    <div>
                        <h4 class="font-semibold text-lg mb-3 text-green-700">Monthly Reports</h4>
                        <div class="space-y-4">
                            ${studentReports.map(report => `
                                <div class="border rounded-lg p-4 bg-gray-50">
                                    <div class="flex justify-between items-center mb-2">
                                        <h5 class="font-semibold text-gray-700">${report.month}</h5>
                                        <span class="text-sm text-gray-500">${new Date(report.submittedAt?.seconds * 1000).toLocaleDateString()}</span>
                                    </div>
                                    ${report.creativeWriting ? `
                                        <div class="mt-2">
                                            <h6 class="font-semibold text-gray-600">Creative Writing:</h6>
                                            <p class="text-gray-700 mt-1">${report.creativeWriting}</p>
                                        </div>
                                    ` : ''}
                                    ${report.fileUrl ? `
                                        <div class="mt-2">
                                            <a href="${report.fileUrl}" target="_blank" class="text-green-600 hover:underline font-semibold">Download Submitted File</a>
                                        </div>
                                    ` : ''}
                                    ${report.tutorRemarks ? `
                                        <div class="mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
                                            <h6 class="font-semibold text-yellow-700">Tutor's Feedback:</h6>
                                            <p class="text-gray-700 mt-1">${report.tutorRemarks}</p>
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : '<p class="text-gray-500">No monthly reports available yet.</p>'}
            </div>
        `;
    });

    container.innerHTML = html;
}

// Main initialization
document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('mainContent');
    const logoutBtn = document.getElementById('logoutBtn');
    const searchForm = document.getElementById('searchForm');
    const parentPhoneInput = document.getElementById('parentPhone');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorMessage = document.getElementById('errorMessage');

    // Check authentication state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Parent is authenticated, show search interface
            searchForm.classList.remove('hidden');
            searchForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const parentPhone = parentPhoneInput.value.trim();
                if (!parentPhone) {
                    showError('Please enter a phone number');
                    return;
                }

                loadingIndicator.classList.remove('hidden');
                errorMessage.classList.add('hidden');

                try {
                    const data = await searchStudentsByPhone(parentPhone);
                    renderStudentResults(mainContent, data, parentPhone);
                } catch (error) {
                    console.error('Search error:', error);
                    showError('Error searching for students. Please try again.');
                } finally {
                    loadingIndicator.classList.add('hidden');
                }
            });
        } else {
            // Parent is not authenticated, redirect to login
            window.location.href = 'parent-login.html';
        }
    });

    // Logout handler
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'parent-login.html';
        } catch (error) {
            console.error('Logout error:', error);
            showError('Error during logout. Please try again.');
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }
});
[file content end]
