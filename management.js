onAuthStateChanged(auth, async (user) => {
    // DEBUG: Log the user object to see if a user is logged in
    console.log("DEBUG: Authentication state changed. Current user:", user);

    if (user) {
        // User is signed in.
        try {
            // DEBUG: Log the user's email before fetching their document
            console.log("DEBUG: User logged in. Fetching staff document for:", user.email);
            const staffDocRef = doc(db, "staff", user.email);
            const staffDoc = await getDoc(staffDocRef);

            if (staffDoc.exists()) {
                const staffData = staffDoc.data();
                // DEBUG: Log the fetched user data and role
                console.log("DEBUG: Staff document found. User role:", staffData.role);
                document.getElementById('welcome-message').textContent = `Welcome, ${staffData.name}`;
                document.getElementById('user-role').textContent = `${capitalize(staffData.role)} Portal`;

                // Based on permissions, build the menu and render the initial panel
                // This is where you should add console.log statements to check which panel is being rendered
                // e.g. console.log("DEBUG: Rendering tutor management panel.");
                
                const navButtons = document.querySelectorAll('.nav-btn');
                navButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        // DEBUG: Log the clicked button's ID
                        console.log("DEBUG: Navigation button clicked:", btn.id);
                        // ... your existing logic here
                    });
                });

                // Trigger the initial rendering (example)
                // This is the line that calls the first function to render a panel.
                // It is likely what is failing.
                // DEBUG: Log before trying to find and click the first nav button
                console.log("DEBUG: Attempting to render initial panel.");
                const firstNavBtn = document.querySelector('.nav-btn');
                if (firstNavBtn) {
                    firstNavBtn.click();
                    // DEBUG: Confirm the click was triggered
                    console.log("DEBUG: Initial panel render triggered.");
                } else {
                    // DEBUG: Log if the nav button was not found
                    console.error("DEBUG: No navigation button found to trigger initial render.");
                }
            } else {
                // DEBUG: Log if the staff document does not exist
                console.error("DEBUG: Staff document not found for user:", user.email);
                await signOut(auth); // Sign them out if their document is missing
                window.location.href = "login.html";
            }
        } catch (error) {
            // DEBUG: Catch any errors during the process
            console.error("DEBUG: An error occurred during user authentication process:", error);
            await signOut(auth);
            window.location.href = "login.html";
        }
    } else {
        // DEBUG: Log if no user is found
        console.log("DEBUG: No user is signed in. Redirecting to login page.");
        window.location.href = "login.html";
    }
});
