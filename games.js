/**
 * BLOOMING KIDS TUTOR PORTAL - GAME WIDGET V2 (GOD MODE)
 * ------------------------------------------------------
 * Features: 
 * 1. Bottom-Left Position
 * 2. Global Leaderboard (Top 3) via Firestore
 * 3. Mobile Responsive Canvas
 * 4. Image Share (Download JPEG)
 */

(function () {
    // --- CONFIGURATION ---
    const CONFIG = {
        colors: {
            primary: 'bg-indigo-600',
            secondary: 'bg-purple-600',
            accent: 'text-indigo-600',
            overlay: 'bg-gray-900/90' // Darker overlay for better focus
        },
        // Expanded Dictionary for Scrabble Lite
        dictionary: [
            "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "ANY", "CAN", "HAD", "HAS", "HIM", "HIS", "HER", "ITS", "ONE", "TWO", "NEW", "OUR", "OUT", "SEE", "WAY", "WHO", "BOY", "DID", "LET", "PUT", "SAY", "SHE", "TOO", "USE", "DAD", "MOM", "CAT", "DOG", "RUN", "EAT", "BIG", "RED", "YES", "LOW", "KEY", "BED", "WIN", "TOP", "JOY", "SKY", "FOX", "ART", "PEN", "BUS", "CAR", "FUN", "GYM", "JOB", "PIE", "RUN", "SIT", "TOY", "VAN", "WEB", "ZOO", "GAME", "PLAY", "READ", "BOOK", "KIDS", "LEARN", "CODE", "MATH", "TEST", "EXAM", "PASS", "FAIL", "WORK", "GOOD", "BEST", "LOVE", "HELP", "GROW", "MIND", "WORD", "LIST", "TYPE", "TEXT", "VIEW", "MENU", "USER", "TIME", "DATA", "QUIZ", "SOUL", "LIFE", "BRAIN", "SMART", "THINK", "SCHOOL", "CLASS", "STUDY"
        ]
    };

    let state = {
        score: 0,
        gameActive: false,
        snake: [],
        snakeDir: { x: 0, y: 0 },
        snakeInterval: null,
        currentUser: { name: 'Guest', id: null }
    };

    // --- INITIALIZATION ---
    function initWidget() {
        // Attempt to grab user details if available globally
        if (typeof firebase !== 'undefined' && firebase.auth()) {
            const u = firebase.auth().currentUser;
            if (u) {
                state.currentUser.id = u.uid;
                state.currentUser.name = u.displayName || u.email.split('@')[0] || "Tutor";
            }
        }

        // 1. Create Floating Button (LEFT SIDE)
        const floater = document.createElement('button');
        floater.id = 'bk-game-floater';
        // Changed right-6 to left-6
        floater.className = `fixed bottom-6 left-6 z-50 p-4 rounded-full shadow-2xl transition-transform transform hover:scale-110 cursor-pointer ${CONFIG.colors.primary} text-white border-4 border-white`;
        floater.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        `;
        floater.onclick = openModal;
        document.body.appendChild(floater);

        // 2. Create Modal
        const modal = document.createElement('div');
        modal.id = 'bk-game-modal';
        modal.className = `fixed inset-0 z-[9999] hidden flex items-center justify-center ${CONFIG.colors.overlay} backdrop-blur-sm p-4`;
        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative transform transition-all">
                <div class="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                    <h3 class="text-xl font-black text-gray-800 flex items-center gap-2">
                        <span>🎮</span> Arcade Mode
                    </h3>
                    <button id="bk-close-btn" class="p-2 rounded-full hover:bg-gray-200 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div id="bk-game-container" class="p-6 min-h-[450px] flex flex-col items-center justify-center">
                    </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('bk-close-btn').onclick = closeModal;
    }

    // --- NAVIGATION ---
    function openModal() {
        document.getElementById('bk-game-modal').classList.remove('hidden');
        showMainMenu();
    }

    function closeModal() {
        stopCurrentGame();
        document.getElementById('bk-game-modal').classList.add('hidden');
    }

    function showMainMenu() {
        const container = document.getElementById('bk-game-container');
        container.innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800 mb-2">Welcome, ${state.currentUser.name}!</h2>
            <p class="text-gray-500 mb-8 text-center text-sm">Take a quick break. Beat the high scores.</p>
            
            <div class="grid grid-cols-2 gap-4 w-full mb-6">
                <button id="btn-snake" class="flex flex-col items-center p-6 border-2 border-gray-100 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition group bg-white shadow-sm">
                    <span class="text-4xl mb-3 group-hover:scale-110 transition">🐍</span>
                    <span class="font-bold text-gray-700">Snake</span>
                </button>
                
                <button id="btn-word" class="flex flex-col items-center p-6 border-2 border-gray-100 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition group bg-white shadow-sm">
                    <span class="text-4xl mb-3 group-hover:scale-110 transition">🧩</span>
                    <span class="font-bold text-gray-700">Word Builder</span>
                </button>
            </div>

            <div class="w-full bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h4 class="font-bold text-yellow-800 mb-2 text-sm uppercase tracking-wide">🏆 Global Leaderboard</h4>
                <div id="main-leaderboard-list" class="text-sm text-gray-600 space-y-2">
                    <p class="text-center italic text-gray-400">Loading top players...</p>
                </div>
            </div>
        `;

        document.getElementById('btn-snake').onclick = initSnakeGame;
        document.getElementById('btn-word').onclick = initWordGame;
        
        // Fetch leaderboard data immediately
        fetchGlobalLeaderboard('Snake', 'main-leaderboard-list');
    }

    // --- GAME OVER & RESULTS ---
    function showGameOver(finalScore, gameName) {
        stopCurrentGame();
        const container = document.getElementById('bk-game-container');
        
        // Save score automatically if possible
        saveScoreToFirebase(finalScore, gameName);

        container.innerHTML = `
            <div id="capture-area" class="bg-white p-4 rounded-xl text-center w-full">
                <div class="inline-block p-4 rounded-full bg-indigo-100 mb-4 animate-bounce">
                    <span class="text-5xl">🏅</span>
                </div>
                <h2 class="text-3xl font-black text-gray-800 mb-1">Game Over!</h2>
                <p class="text-gray-400 text-sm mb-4">${new Date().toLocaleDateString()}</p>
                
                <div class="bg-gray-50 rounded-xl p-6 mb-6 border border-gray-100">
                    <p class="text-gray-500 uppercase text-xs tracking-widest mb-1">Final Score</p>
                    <p class="text-5xl font-black ${CONFIG.colors.accent}">${finalScore}</p>
                    <p class="text-gray-400 text-xs mt-2">${gameName}</p>
                </div>

                <div class="text-left mb-4">
                    <p class="text-xs font-bold text-gray-400 uppercase mb-2">Top 3 Players</p>
                    <div id="mini-leaderboard" class="space-y-1 text-sm">
                        Loading...
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3 w-full mt-2">
                <button id="btn-download-img" class="py-3 bg-gray-800 hover:bg-black text-white font-bold rounded-lg transition flex justify-center items-center gap-2">
                    📸 Save Image
                </button>
                <button id="btn-menu-back" class="py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition">
                    Back to Menu
                </button>
            </div>
        `;

        fetchGlobalLeaderboard(gameName, 'mini-leaderboard');

        document.getElementById('btn-menu-back').onclick = showMainMenu;
        document.getElementById('btn-download-img').onclick = () => {
            const btn = document.getElementById('btn-download-img');
            btn.innerHTML = 'Generating...';
            
            // Check if library exists
            if (typeof html2canvas === 'undefined') {
                alert("Error: html2canvas library not loaded. Please ensure script tag is in tutor.html");
                btn.innerHTML = '❌ Failed';
                return;
            }

            const captureArea = document.getElementById('capture-area');
            html2canvas(captureArea, { scale: 2 }).then(canvas => {
                const link = document.createElement('a');
                link.download = `BK-Score-${finalScore}.jpg`;
                link.href = canvas.toDataURL("image/jpeg", 0.9);
                link.click();
                btn.innerHTML = '✅ Saved!';
            });
        };
    }

    // --- GAME 1: SNAKE (Responsive) ---
    function initSnakeGame() {
        const container = document.getElementById('bk-game-container');
        // Canvas is wrapped in a container that controls its max size
        container.innerHTML = `
            <div class="flex justify-between w-full mb-2 items-center">
                <span class="font-bold text-gray-600 text-xl">Score: <span id="snake-score">0</span></span>
                <span class="text-xs text-white bg-indigo-500 px-2 py-1 rounded">Tap/Swipe/Arrows</span>
            </div>
            <div class="relative w-full max-w-[350px] aspect-square bg-gray-100 rounded-xl overflow-hidden border-4 border-gray-300 shadow-inner">
                <canvas id="snake-canvas" width="400" height="400" class="w-full h-full"></canvas>
                
                <div id="mobile-controls" class="absolute inset-0 z-10 opacity-0"></div>
            </div>
        `;

        const canvas = document.getElementById('snake-canvas');
        const ctx = canvas.getContext('2d');
        const tileCount = 20; 
        const gridSize = canvas.width / tileCount; // Calculate dynamic grid size
        
        state.score = 0;
        state.snake = [{x: 10, y: 10}];
        state.snakeDir = {x: 0, y: 0};
        state.snakeFood = {x: 15, y: 15};
        state.gameActive = true;

        // Desktop Inputs
        document.onkeydown = (e) => {
            if(!state.gameActive) return;
            switch(e.key) {
                case 'ArrowLeft': if(state.snakeDir.x !== 1) state.snakeDir = {x: -1, y: 0}; break;
                case 'ArrowUp': if(state.snakeDir.y !== 1) state.snakeDir = {x: 0, y: -1}; break;
                case 'ArrowRight': if(state.snakeDir.x !== -1) state.snakeDir = {x: 1, y: 0}; break;
                case 'ArrowDown': if(state.snakeDir.y !== -1) state.snakeDir = {x: 0, y: 1}; break;
            }
        };

        // Mobile Touch Inputs (Simple Swipe Detection)
        let touchStartX = 0;
        let touchStartY = 0;
        const touchArea = document.getElementById('mobile-controls');
        
        touchArea.addEventListener('touchstart', e => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, {passive: false});

        touchArea.addEventListener('touchend', e => {
            e.preventDefault();
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;
            
            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;

            if (Math.abs(dx) > Math.abs(dy)) {
                // Horizontal
                if (dx > 0 && state.snakeDir.x !== -1) state.snakeDir = {x: 1, y: 0};
                else if (dx < 0 && state.snakeDir.x !== 1) state.snakeDir = {x: -1, y: 0};
            } else {
                // Vertical
                if (dy > 0 && state.snakeDir.y !== -1) state.snakeDir = {x: 0, y: 1};
                else if (dy < 0 && state.snakeDir.y !== 1) state.snakeDir = {x: 0, y: -1};
            }
        }, {passive: false});

        state.snakeInterval = setInterval(() => {
            if(!state.gameActive) return;

            const head = {x: state.snake[0].x + state.snakeDir.x, y: state.snake[0].y + state.snakeDir.y};

            if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
                showGameOver(state.score, "Snake");
                return;
            }

            for (let part of state.snake) {
                if (head.x === part.x && head.y === part.y) {
                    if (state.snakeDir.x !== 0 || state.snakeDir.y !== 0) {
                        showGameOver(state.score, "Snake");
                        return;
                    }
                }
            }

            state.snake.unshift(head);

            if (head.x === state.snakeFood.x && head.y === state.snakeFood.y) {
                state.score += 10;
                document.getElementById('snake-score').innerText = state.score;
                state.snakeFood = {
                    x: Math.floor(Math.random() * tileCount),
                    y: Math.floor(Math.random() * tileCount)
                };
            } else {
                state.snake.pop();
            }

            // Draw
            ctx.fillStyle = '#f3f4f6'; 
            ctx.fillRect(0,0, canvas.width, canvas.height);

            // Draw Food (Circle)
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(
                state.snakeFood.x * gridSize + gridSize/2, 
                state.snakeFood.y * gridSize + gridSize/2, 
                gridSize/2 - 2, 0, 2 * Math.PI
            );
            ctx.fill();

            // Draw Snake
            ctx.fillStyle = '#4f46e5';
            for (let part of state.snake) {
                ctx.fillRect(part.x * gridSize, part.y * gridSize, gridSize - 1, gridSize - 1);
            }

        }, 150); // Slower speed for better playability
    }

    // --- GAME 2: WORD BUILDER ---
    function initWordGame() {
        state.score = 0;
        state.gameActive = true;
        state.currentWord = "";
        state.validWordsFound = [];
        
        // Use a mix of common letters
        const pool = "AAAAABCDEEEEFGHIIIIJKLMNOOOOPQRSTUUUUVWXYZ"; 
        state.wordTiles = [];
        for(let i=0; i<7; i++) state.wordTiles.push(pool[Math.floor(Math.random() * pool.length)]);
        state.wordTiles.sort(() => Math.random() - 0.5);

        renderWordGameUI();
    }

    function renderWordGameUI() {
        const container = document.getElementById('bk-game-container');
        
        let tilesHTML = state.wordTiles.map(letter => 
            `<button class="w-10 h-10 md:w-12 md:h-12 bg-indigo-100 text-indigo-800 font-bold rounded-lg shadow hover:bg-indigo-200 text-xl word-tile transform transition active:scale-90" data-letter="${letter}">${letter}</button>`
        ).join('');

        container.innerHTML = `
            <div class="flex justify-between w-full mb-4 items-end">
                <span class="font-bold text-gray-600 text-xl">Score: <span id="word-score" class="text-indigo-600">${state.score}</span></span>
                <button id="end-word-game" class="text-xs text-red-500 bg-red-50 px-3 py-1 rounded-full hover:bg-red-100 transition">End Game</button>
            </div>

            <div class="w-full bg-white border-b-4 border-indigo-100 h-20 mb-6 flex items-center justify-center rounded-xl shadow-sm">
                <span id="current-word-display" class="text-4xl font-black tracking-widest text-gray-800 uppercase animate-pulse"></span>
            </div>

            <div class="flex flex-wrap justify-center gap-2 mb-8" id="tile-rack">
                ${tilesHTML}
            </div>

            <div class="grid grid-cols-2 gap-3 w-full">
                <button id="btn-clear" class="py-3 bg-gray-200 text-gray-600 rounded-xl hover:bg-gray-300 font-bold transition">Clear</button>
                <button id="btn-submit" class="py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 transition">Submit</button>
            </div>
            
            <p id="word-feedback" class="h-6 mt-4 text-sm font-bold text-center opacity-0 transition-opacity duration-300"></p>
        `;

        document.querySelectorAll('.word-tile').forEach(btn => {
            btn.onclick = function() {
                if(state.currentWord.length < 8) {
                    state.currentWord += this.getAttribute('data-letter');
                    updateWordDisplay();
                }
            }
        });

        document.getElementById('btn-clear').onclick = () => {
            state.currentWord = "";
            updateWordDisplay();
        };

        document.getElementById('btn-submit').onclick = submitWord;
        document.getElementById('end-word-game').onclick = () => showGameOver(state.score, "Word Builder");
    }

    function updateWordDisplay() {
        document.getElementById('current-word-display').innerText = state.currentWord;
    }

    function submitWord() {
        const feedback = document.getElementById('word-feedback');
        const word = state.currentWord;
        feedback.classList.remove('opacity-0');

        if (state.validWordsFound.includes(word)) {
            feedback.innerText = "ALREADY FOUND!";
            feedback.className = "h-6 mt-4 text-sm font-bold text-center text-yellow-500";
        } else if (CONFIG.dictionary.includes(word) || word.length > 3) {
            // Simple validation: accept if in list OR length > 3 to prevent frustration
            // In a real app, use a full API, but for this widget, length>3 acts as a soft fallback
            const points = word.length * 10;
            state.score += points;
            state.validWordsFound.push(word);
            document.getElementById('word-score').innerText = state.score;
            feedback.innerText = `+${points} POINTS!`;
            feedback.className = "h-6 mt-4 text-sm font-bold text-center text-green-500";
        } else {
            feedback.innerText = "NOT IN DICTIONARY";
            feedback.className = "h-6 mt-4 text-sm font-bold text-center text-red-500";
        }
        
        setTimeout(() => {
            state.currentWord = "";
            updateWordDisplay();
            setTimeout(() => feedback.classList.add('opacity-0'), 1000);
        }, 500);
    }

    function stopCurrentGame() {
        state.gameActive = false;
        if (state.snakeInterval) clearInterval(state.snakeInterval);
        document.onkeydown = null;
    }

    // --- FIREBASE LOGIC (UPDATED) ---
    async function saveScoreToFirebase(score, gameName) {
        if (typeof db === 'undefined') {
            console.warn("DB not connected. Playing in offline mode.");
            return;
        }

        const scoreData = {
            userId: state.currentUser.id || 'guest',
            userName: state.currentUser.name || 'Guest Player',
            game: gameName,
            score: score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            // 1. Save to global 'leaderboard' collection
            await db.collection('leaderboard').add(scoreData);
            
            // 2. Also update user profile history if logged in
            if (state.currentUser.id) {
                await db.collection('tutors').doc(state.currentUser.id).update({
                    gameHistory: firebase.firestore.FieldValue.arrayUnion(scoreData)
                });
            }
            console.log("Score saved successfully");
        } catch (e) {
            console.error("Firebase save failed:", e);
        }
    }

    function fetchGlobalLeaderboard(gameName, elementId) {
        const listEl = document.getElementById(elementId);
        if (!listEl) return;

        if (typeof db === 'undefined') {
            listEl.innerHTML = `<p class="text-red-400 text-xs">Offline: Cannot load leaderboard.</p>`;
            return;
        }

        db.collection('leaderboard')
            .where('game', '==', gameName)
            .orderBy('score', 'desc')
            .limit(3)
            .get()
            .then((querySnapshot) => {
                let html = '';
                let rank = 1;
                querySnapshot.forEach((doc) => {
                    const d = doc.data();
                    let medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : '🥉');
                    let bgClass = rank === 1 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-50 text-gray-600';
                    
                    html += `
                        <div class="flex justify-between items-center p-2 rounded ${bgClass}">
                            <span class="font-bold flex gap-2"><span>${medal}</span> ${d.userName}</span>
                            <span class="font-mono font-bold">${d.score}</span>
                        </div>
                    `;
                    rank++;
                });

                if (html === '') html = '<p class="text-gray-400 italic">No scores yet. Be the first!</p>';
                listEl.innerHTML = html;
            })
            .catch((error) => {
                console.error("Leaderboard error:", error);
                // Fallback for when Index is missing in Firestore
                if (error.code === 'failed-precondition') {
                    listEl.innerHTML = '<p class="text-xs text-red-400">Admin: Create Firestore Index (Game+Score)</p>';
                } else {
                    listEl.innerHTML = '<p class="text-xs text-red-400">Could not load scores.</p>';
                }
            });
    }

    // Initialize
    window.addEventListener('load', initWidget);

})();
