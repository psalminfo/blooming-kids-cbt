import { auth, db } from './firebaseConfig.js';
import { collection, getDocs, doc, getDoc, where, query, orderBy } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { onSnapshot } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// This is the updated onAuthStateChanged function for MANAGEMENT.JS

onAuthStateChanged(auth, async (user) => {
    const mainContent = document.getElementById('main-content');
    const logoutBtn = document.getElementById('logoutBtn');
    if (user) {
        const staffDocRef = doc(db, "staff", user.email);
        const staffDocSnap = await getDoc(staffDocRef);

        if (staffDocSnap.exists()) {
            const staffData = staffDocSnap.data();

            // Check if role is assigned and NOT 'pending'
            if (staffData.role && staffData.role !== 'pending') {
                
                window.userData = staffData; // Store user data and permissions globally

                // Display welcome message and role
                document.getElementById('welcome-message').textContent = `Welcome, ${staffData.name}`;
                document.getElementById('user-role').textContent = `Role: ${capitalize(staffData.role)}`;

                // Define and set up navigation
                const navItems = {
                    navTutorManagement: renderManagementTutorView,
                    navPayAdvice: renderPayAdvicePanel,
                    navTutorReports: renderTutorReportsPanel,
                    navSummerBreak: renderSummerBreakPanel
                };

                const setActiveNav = (activeId) => Object.keys(navItems).forEach(id => {
                    document.getElementById(id)?.classList.toggle('active', id === activeId);
                });

                Object.entries(navItems).forEach(([id, renderFn]) => {
                    document.getElementById(id)?.addEventListener('click', () => {
                        setActiveNav(id);
                        renderFn(mainContent);
                    });
                });

                // Set initial view
                setActiveNav('navTutorManagement');
                renderManagementTutorView(mainContent);
                logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));

            } else {
                // If role is 'pending'
                document.getElementById('welcome-message').textContent = `Hello, ${staffData.name}`;
                document.getElementById('user-role').textContent = 'Status: Pending Approval';
                mainContent.innerHTML = `<p class="text-center mt-12 text-yellow-600 font-semibold">Your account is awaiting approval by an administrator. You will be able to access the portal once your role has been assigned.</p>`;
                logoutBtn.classList.remove('hidden');
                logoutBtn.addEventListener('click', () => signOut(auth).then(() => window.location.href = "management-auth.html"));
            }
        } else {
            // If user exists in Auth but not in the 'staff' collection
            mainContent.innerHTML = `<p class="text-center mt-12 text-red-600">Your account is not registered in the staff directory. Please contact an administrator.</p>`;
            logoutBtn.classList.add('hidden');
        }
    } else {
        // If no user is logged in
        window.location.href = "management-auth.html";
    }

});
