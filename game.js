/**
 * BLOOMING KIDS TUTOR PORTAL - GAME WIDGET
 * ----------------------------------------
 * Features: Floating UI, Classic Snake, Word Builder, Firebase Integration
 * Stack: Pure JS, HTML5 Canvas, Tailwind CSS Classes
 */

(function () {
    // --- CONFIGURATION & STATE ---
    const CONFIG = {
        colors: {
            primary: 'bg-indigo-600',
            primaryHover: 'hover:bg-indigo-700',
            accent: 'text-indigo-600',
            overlay: 'bg-gray-900/75'
        },
        dictionary: [
            "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "ANY", "CAN", "HAD", "HAS", "HIM", "HIS", "HER", "ITS", "ONE", "TWO", "NEW", "OUR", "OUT", "SEE", "WAY", "WHO", "BOY", "DID", "LET", "PUT", "SAY", "SHE", "TOO", "USE", "DAD", "MOM", "CAT", "DOG", "RUN", "EAT", "BIG", "RED", "YES", "LOW", "KEY", "BED", "WIN", "TOP", "JOY", "SKY", "FOX", "ART", "PEN", "BUS", "CAR", "FUN", "GYM", "JOB", "PIE", "RUN", "SIT", "TOY", "VAN", "WEB", "ZOO", "GAME", "PLAY", "READ", "BOOK", "KIDS", "LEARN", "CODE", "MATH", "TEST", "EXAM", "PASS", "FAIL", "WORK", "GOOD", "BEST", "LOVE", "HELP", "GROW", "MIND", "WORD", "LIST", "TYPE", "TEXT", "VIEW", "MENU", "USER", "TIME", "DATA", "QUIZ", "SOUL", "LIFE"
        ]
    };

    let state = {
        currentGame: null,
        score: 0,
        snake: [],
        snakeDir: { x: 0, y: 0 },
        snakeFood: { x: 0, y: 0 },
        snakeInterval: null,
        wordTiles: [],
        currentWord: "",
        validWordsFound: []
    };

    // --- DOM INJECTION ---
    function initWidget() {
        // 1. Create Floating Button
        const floater = document.createElement('button');
        floater.id = 'bk-game-floater';
        floater.className = `fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-transform transform hover:scale-110 cursor-pointer ${CONFIG.colors.primary} text-white`;
        floater.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        `;
        floater.onclick = openModal;
        document.body.appendChild(floater);

        // 2. Create Modal Overlay (Hidden by default)
        const modal = document.createElement('div');
        modal.id = 'bk-game-modal';
        modal.className = `fixed inset-0 z-50 hidden flex items-center justify-center ${CONFIG.colors.overlay} backdrop-blur-sm`;
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative mx-4">
                <div class="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
                    <h3 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <span>🧠</span> Brain Break
                    </h3>
                    <button id="bk-close-btn" class="text-gray-400 hover:text-red-500 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div id="bk-game-container" class="p-6 min-h-[400px] flex flex-col items-center justify-center">
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
            <h2 class="text-2xl font-bold text-gray-800 mb-2">Ready to recharge?</h2>
            <p class="text-gray-500 mb-8 text-center">Select a quick game to refresh your mind.</p>
            
            <div class="grid grid-cols-2 gap-4 w-full">
                <button id="btn-snake" class="flex flex-col items-center p-6 border-2 border-gray-100 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition group">
                    <span class="text-4xl mb-3 group-hover:scale-110 transition">🐍</span>
                    <span class="font-bold text-gray-700">Classic Snake</span>
                    <span class="text-xs text-gray-400 mt-1">Reflex Test</span>
                </button>
                
                <button id="btn-word" class="flex flex-col items-center p-6 border-2 border-gray-100 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition group">
                    <span class="text-4xl mb-3 group-hover:scale-110 transition">🧩</span>
                    <span class="font-bold text-gray-700">Word Builder</span>
                    <span class="text-xs text-gray-400 mt-1">Vocab Builder</span>
                </button>
            </div>
        `;

        document.getElementById('btn-snake').onclick = initSnakeGame;
        document.getElementById('btn-word').onclick = initWordGame;
    }

    function showGameOver(finalScore, gameName) {
        stopCurrentGame();
        const container = document.getElementById('bk-game-container');
        
        container.innerHTML = `
            <div class="text-center animate-pulse">
                <span class="text-6xl">🏆</span>
            </div>
            <h2 class="text-3xl font-black text-gray-800 mt-4 mb-2">Game Over!</h2>
            <p class="text-gray-500 mb-6">You scored <span class="font-bold ${CONFIG.colors.accent} text-xl">${finalScore}</span> in ${gameName}.</p>
            
            <div class="flex flex-col gap-3 w-full max-w-xs">
                <button id="btn-save-score" class="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow-md transition flex justify-center items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                    Save to Profile
                </button>
                <button id="btn-share-score" class="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg shadow-md transition flex justify-center items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                    Share Result
                </button>
                <button id="btn-menu-back" class="w-full py-3 text-gray-500 hover:text-gray-800 font-medium transition">
                    Back to Menu
                </button>
            </div>
        `;

        document.getElementById('btn-menu-back').onclick = showMainMenu;
        
        document.getElementById('btn-save-score').onclick = () => {
            saveScoreToFirebase(finalScore, gameName);
        };

        document.getElementById('btn-share-score').onclick = () => {
            const text = `I just scored ${finalScore} points in ${gameName} on Blooming Kids Portal! 🐍🧩`;
            navigator.clipboard.writeText(text).then(() => {
                const btn = document.getElementById('btn-share-score');
                btn.innerHTML = `✅ Copied!`;
                setTimeout(() => btn.innerHTML = `Share Result`, 2000);
            });
        };
    }

    function stopCurrentGame() {
        if (state.snakeInterval) clearInterval(state.snakeInterval);
        document.onkeydown = null; // Clear key listeners
    }

    // --- GAME 1: CLASSIC SNAKE ---
    function initSnakeGame() {
        const container = document.getElementById('bk-game-container');
        container.innerHTML = `
            <div class="flex justify-between w-full mb-2">
                <span class="font-bold text-gray-600">Score: <span id="snake-score">0</span></span>
                <span class="text-xs text-gray-400">Use Arrow Keys</span>
            </div>
            <canvas id="snake-canvas" width="400" height="400" class="bg-gray-100 border-2 border-gray-300 rounded-lg"></canvas>
        `;

        const canvas = document.getElementById('snake-canvas');
        const ctx = canvas.getContext('2d');
        const gridSize = 20;
        const tileCount = 20; // 400px / 20px
        
        state.score = 0;
        state.snake = [{x: 10, y: 10}];
        state.snakeDir = {x: 0, y: 0};
        state.snakeFood = {x: 15, y: 15};
        
        // Controls
        document.onkeydown = (e) => {
            switch(e.key) {
                case 'ArrowLeft': if(state.snakeDir.x !== 1) state.snakeDir = {x: -1, y: 0}; break;
                case 'ArrowUp': if(state.snakeDir.y !== 1) state.snakeDir = {x: 0, y: -1}; break;
                case 'ArrowRight': if(state.snakeDir.x !== -1) state.snakeDir = {x: 1, y: 0}; break;
                case 'ArrowDown': if(state.snakeDir.y !== -1) state.snakeDir = {x: 0, y: 1}; break;
            }
        };

        state.snakeInterval = setInterval(() => {
            // Move
            const head = {x: state.snake[0].x + state.snakeDir.x, y: state.snake[0].y + state.snakeDir.y};

            // Wall Collision
            if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
                showGameOver(state.score, "Snake");
                return;
            }

            // Self Collision
            for (let part of state.snake) {
                if (head.x === part.x && head.y === part.y) {
                    // Only die if moving
                    if (state.snakeDir.x !== 0 || state.snakeDir.y !== 0) {
                        showGameOver(state.score, "Snake");
                        return;
                    }
                }
            }

            state.snake.unshift(head);

            // Eat Food
            if (head.x === state.snakeFood.x && head.y === state.snakeFood.y) {
                state.score += 10;
                document.getElementById('snake-score').innerText = state.score;
                // Random position ensuring not on snake body (simplified)
                state.snakeFood = {
                    x: Math.floor(Math.random() * tileCount),
                    y: Math.floor(Math.random() * tileCount)
                };
            } else {
                state.snake.pop(); // Remove tail if not eating
            }

            // Draw
            ctx.fillStyle = '#f3f4f6'; // clear
            ctx.fillRect(0,0, canvas.width, canvas.height);

            ctx.fillStyle = '#ef4444'; // Food Red
            ctx.fillRect(state.snakeFood.x * gridSize, state.snakeFood.y * gridSize, gridSize - 2, gridSize - 2);

            ctx.fillStyle = '#4f46e5'; // Snake Indigo
            for (let part of state.snake) {
                ctx.fillRect(part.x * gridSize, part.y * gridSize, gridSize - 2, gridSize - 2);
            }

        }, 100);
    }

    // --- GAME 2: WORD BUILDER ---
    function initWordGame() {
        state.score = 0;
        state.currentWord = "";
        state.validWordsFound = [];
        
        // Generate random rack (weighted for vowels)
        const vowels = "AEIOU";
        const consonants = "BCDFGHJKLMNPQRSTVWXYZ";
        state.wordTiles = [];
        
        for(let i=0; i<3; i++) state.wordTiles.push(vowels[Math.floor(Math.random() * vowels.length)]);
        for(let i=0; i<4; i++) state.wordTiles.push(consonants[Math.floor(Math.random() * consonants.length)]);
        // Shuffle
        state.wordTiles.sort(() => Math.random() - 0.5);

        renderWordGameUI();
    }

    function renderWordGameUI() {
        const container = document.getElementById('bk-game-container');
        
        let tilesHTML = state.wordTiles.map(letter => 
            `<button class="w-10 h-10 md:w-12 md:h-12 bg-indigo-100 text-indigo-800 font-bold rounded shadow-sm hover:bg-indigo-200 text-xl word-tile" data-letter="${letter}">${letter}</button>`
        ).join('');

        container.innerHTML = `
            <div class="flex justify-between w-full mb-4">
                <span class="font-bold text-gray-600">Score: <span id="word-score">${state.score}</span></span>
                <button id="end-word-game" class="text-xs text-red-500 hover:underline">End Game</button>
            </div>

            <div class="w-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg h-16 mb-6 flex items-center justify-center">
                <span id="current-word-display" class="text-3xl font-mono tracking-widest text-gray-700 h-8"></span>
            </div>

            <div class="flex flex-wrap justify-center gap-2 mb-6" id="tile-rack">
                ${tilesHTML}
            </div>

            <div class="flex gap-2 w-full">
                <button id="btn-clear" class="flex-1 py-3 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 font-bold">Clear</button>
                <button id="btn-submit" class="flex-1 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold">Submit</button>
            </div>
            
            <p id="word-feedback" class="h-6 mt-2 text-sm font-bold text-center"></p>
        `;

        // Event Listeners
        document.querySelectorAll('.word-tile').forEach(btn => {
            btn.onclick = function() {
                state.currentWord += this.getAttribute('data-letter');
                updateWordDisplay();
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

        if (word.length < 2) {
            feedback.innerText = "Too short!";
            feedback.className = "h-6 mt-2 text-sm font-bold text-center text-red-500";
            return;
        }

        if (state.validWordsFound.includes(word)) {
            feedback.innerText = "Already found!";
            feedback.className = "h-6 mt-2 text-sm font-bold text-center text-yellow-600";
            state.currentWord = "";
            updateWordDisplay();
            return;
        }

        // Mock Validation
        if (CONFIG.dictionary.includes(word)) {
            // Success
            const points = word.length * 10;
            state.score += points;
            state.validWordsFound.push(word);
            document.getElementById('word-score').innerText = state.score;
            
            feedback.innerText = `+${points} Points! (${word})`;
            feedback.className = "h-6 mt-2 text-sm font-bold text-center text-green-600";
        } else {
            feedback.innerText = "Not in dictionary.";
            feedback.className = "h-6 mt-2 text-sm font-bold text-center text-red-500";
        }

        state.currentWord = "";
        updateWordDisplay();
    }

    // --- FIREBASE HELPER ---
    function saveScoreToFirebase(score, game) {
        const btn = document.getElementById('btn-save-score');
        
        // Defensive coding: Check if Firebase globals exist
        if (typeof db === 'undefined' || typeof firebase === 'undefined' || typeof userId === 'undefined') {
            console.warn("Games Widget: Firebase or UserID not found in global scope. Cannot save score.");
            alert("⚠️ Developer Mode: Firebase DB not connected in this context.\n\nScore that would be saved: " + score);
            return;
        }

        if (!userId) {
            alert("Please log in to save your score.");
            return;
        }

        btn.innerHTML = `Saving...`;
        
        // Push object: { game: 'Snake', score: 500, date: ... }
        const scoreEntry = {
            game: game,
            score: score,
            timestamp: new Date()
        };

        db.collection('tutors').doc(userId).update({
            highScores: firebase.firestore.FieldValue.arrayUnion(scoreEntry)
        }).then(() => {
            btn.innerHTML = `✅ Saved!`;
            btn.classList.remove('bg-green-500');
            btn.classList.add('bg-gray-400', 'cursor-not-allowed');
            btn.disabled = true;
        }).catch((error) => {
            console.error("Error saving score: ", error);
            btn.innerHTML = `❌ Error`;
        });
    }

    // Initialize on load
    window.addEventListener('load', initWidget);

})();
