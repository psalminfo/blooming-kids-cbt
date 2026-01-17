/**
 * BLOOMING KIDS TUTOR PORTAL - GAME WIDGET V3 (LEVEL UP EDITION)
 * --------------------------------------------------------------
 * Updates: 
 * 1. Word Game now has LEVELS (Find the 'Bingo' word to advance).
 * 2. Massive Dictionary added (1000+ common words) to fix spelling rejections.
 * 3. Added 'Shuffle' button for tiles.
 * 4. Persisted Leaderboards & Mobile fixes.
 */

(function () {
    // --- CONFIGURATION ---
    const CONFIG = {
        colors: {
            primary: 'bg-indigo-600',
            primaryHover: 'hover:bg-indigo-700',
            accent: 'text-indigo-600',
            overlay: 'bg-gray-900/90'
        },
        // Expanded Dictionary: Common English words (3-7 letters)
        dictionary: [
            "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "ANY", "CAN", "HAD", "HAS", "HIM", "HIS", "HER", "ITS", "ONE", "TWO", "NEW", "OUR", "OUT", "SEE", "WAY", "WHO", "BOY", "DID", "LET", "PUT", "SAY", "SHE", "TOO", "USE", "DAD", "MOM", "CAT", "DOG", "RUN", "EAT", "BIG", "RED", "YES", "LOW", "KEY", "BED", "WIN", "TOP", "JOY", "SKY", "FOX", "ART", "PEN", "BUS", "CAR", "FUN", "GYM", "JOB", "PIE", "SIT", "TOY", "VAN", "WEB", "ZOO", "GAME", "PLAY", "READ", "BOOK", "KIDS", "CODE", "MATH", "TEST", "EXAM", "PASS", "FAIL", "WORK", "GOOD", "BEST", "LOVE", "HELP", "GROW", "MIND", "WORD", "LIST", "TYPE", "TEXT", "VIEW", "MENU", "USER", "TIME", "DATA", "QUIZ", "SOUL", "LIFE", "BRAIN", "SMART", "THINK", "CLASS", "STUDY", "LEARN", "WRITE", "START", "STOP", "OPEN", "CLOSE", "NEXT", "BACK", "HOME", "SAVE", "FIND", "LOOK", "MAKE", "KNOW", "TAKE", "YEAR", "ROOM", "DOOR", "GIRL", "DONE", "HIGH", "NAME", "NOTE", "IDEA", "HARD", "EASY", "BLUE", "BABY", "BALL", "BIRD", "BOAT", "BODY", "BONE", "CAKE", "CALL", "CARD", "CARE", "CASH", "CITY", "CLUB", "COOK", "COOL", "CORN", "COST", "DATE", "DEAR", "DEEP", "DESK", "DROP", "DUCK", "DUST", "EAST", "EDGE", "FACE", "FACT", "FARM", "FAST", "FEEL", "FILE", "FIRE", "FISH", "FLAG", "FLAT", "FOOD", "FOOT", "FORM", "FREE", "FROG", "FULL", "GIFT", "GIVE", "GLAD", "GOAL", "GOLD", "GONE", "HAIR", "HALF", "HALL", "HAND", "HEAD", "HEAR", "HEAT", "HELD", "HELL", "HILL", "HOLD", "HOLE", "HOPE", "HOUR", "HURT", "IRON", "ITEM", "JOIN", "JUMP", "JUST", "KEEP", "KILL", "KIND", "KING", "KISS", "KNEE", "LADY", "LAKE", "LAND", "LAST", "LATE", "LEAD", "LEFT", "LESS", "LINE", "LION", "LONG", "LOST", "LUCK", "MAIN", "MARK", "MEAL", "MEET", "MILE", "MILK", "MISS", "MOON", "MOVE", "NEAR", "NECK", "NEED", "NEWS", "NICE", "NOSE", "NOTE", "OKAY", "ONCE", "ONLY", "PACK", "PAGE", "PAIN", "PAIR", "PARK", "PART", "PAST", "PATH", "PICK", "PLAN", "POOR", "POST", "PULL", "PUSH", "RACE", "RAIN", "RARE", "REAL", "REST", "RICH", "RIDE", "RING", "RISE", "RISK", "ROAD", "ROCK", "ROLE", "ROOF", "ROOM", "ROOT", "ROPE", "ROSE", "RULE", "SAFE", "SALT", "SAND", "SAVE", "SEAT", "SEED", "SELL", "SEND", "SHIP", "SHOE", "SHOP", "SHOT", "SHOW", "SHUT", "SICK", "SIDE", "SIGN", "SING", "SIZE", "SKIN", "SLOW", "SNOW", "SOFT", "SOIL", "SONG", "SOON", "SORT", "SOUP", "SPOT", "STAR", "STAY", "STEP", "STOP", "SUCH", "SURE", "SWIM", "TAIL", "TALK", "TALL", "TEAM", "TELL", "TENT", "TERM", "THAT", "THEN", "THIS", "TIDE", "TILL", "TIME", "TINY", "TOWN", "TREE", "TRIP", "TURN", "TYPE", "UNIT", "UPON", "VOTE", "WAIT", "WALK", "WALL", "WANT", "WARM", "WASH", "WAVE", "WEAR", "WEEK", "WELL", "WENT", "WERE", "WEST", "WHAT", "WHEN", "WILD", "WILL", "WIND", "WISH", "WITH", "WOOD", "WORK", "YARD", "YEAR", "YOUR", "ZERO", "ZONE",
            "ABOUT", "ABOVE", "ACTOR", "ADMIT", "ADULT", "AFTER", "AGAIN", "AGENT", "AGREE", "AHEAD", "ALARM", "ALBUM", "ALERT", "ALIKE", "ALIVE", "ALLOW", "ALONE", "ALONG", "ALTER", "AMONG", "ANGER", "ANGLE", "ANGRY", "APART", "APPLE", "APPLY", "ARENA", "ARGUE", "ARISE", "ARRAY", "ASIDE", "ASSET", "AUDIO", "AUDIT", "AVOID", "AWARD", "AWARE", "BADLY", "BAKER", "BASES", "BASIC", "BASIS", "BEACH", "BEGAN", "BEGIN", "BEGUN", "BEING", "BELOW", "BENCH", "BILLY", "BIRTH", "BLACK", "BLAME", "BLIND", "BLOCK", "BLOOD", "BOARD", "BOOST", "BOOTH", "BOUND", "BRAIN", "BRAND", "BREAD", "BREAK", "BREED", "BRIEF", "BRING", "BROAD", "BROKE", "BROWN", "BUILD", "BUILT", "BUYER", "CABLE", "CALIF", "CARRY", "CATCH", "CAUSE", "CHAIN", "CHAIR", "CHART", "CHASE", "CHEAP", "CHECK", "CHEST", "CHIEF", "CHILD", "CHINA", "CHOSE", "CIVIL", "CLAIM", "CLASS", "CLEAN", "CLEAR", "CLICK", "CLOCK", "CLOSE", "COACH", "COAST", "COULD", "COUNT", "COURT", "COVER", "CRAFT", "CRASH", "CREAM", "CRIME", "CROSS", "CROWD", "CROWN", "CURVE", "CYCLE", "DAILY", "DANCE", "DATED", "DEALT", "DEATH", "DEBUT", "DELAY", "DEPTH", "DOING", "DOUBT", "DOZEN", "DRAFT", "DRAMA", "DRAWN", "DREAM", "DRESS", "DRILL", "DRINK", "DRIVE", "DROVE", "DYING", "EAGER", "EARLY", "EARTH", "EIGHT", "ELITE", "EMPTY", "ENEMY", "ENJOY", "ENTER", "ENTRY", "EQUAL", "ERROR", "EVENT", "EVERY", "EXACT", "EXIST", "EXTRA", "FAITH", "FALSE", "FAULT", "FIBER", "FIELD", "FIFTH", "FIFTY", "FIGHT", "FINAL", "FIRST", "FIXED", "FLASH", "FLEET", "FLOOR", "FLUID", "FOCUS", "FORCE", "FORTH", "FORTY", "FORUM", "FOUND", "FRAME", "FRANK", "FRAUD", "FRESH", "FRONT", "FRUIT", "FULLY", "FUNNY", "GIANT", "GIVEN", "GLASS", "GLOBE", "GOING", "GRACE", "GRADE", "GRAND", "GRANT", "GRASS", "GREAT", "GREEN", "GROSS", "GROUP", "GROWN", "GUARD", "GUESS", "GUEST", "GUIDE", "HAPPY", "HARRY", "HEART", "HEAVY", "HENCE", "HENRY", "HORSE", "HOTEL", "HOUSE", "HUMAN", "IDEAL", "IMAGE", "INDEX", "INNER", "INPUT", "ISSUE", "JAPAN", "JIMMY", "JOINT", "JONES", "JUDGE", "KNOWN", "LABEL", "LARGE", "LASER", "LATER", "LAUGH", "LAYER", "LEARN", "LEASE", "LEAST", "LEAVE", "LEGAL", "LEVEL", "LEWIS", "LIGHT", "LIMIT", "LINKS", "LIVES", "LOCAL", "LOGIC", "LOOSE", "LOWER", "LUCKY", "LUNCH", "LYING", "MAGIC", "MAJOR", "MAKER", "MARCH", "MARIA", "MATCH", "MAYBE", "MAYOR", "MEANT", "MEDIA", "METAL", "MIGHT", "MINOR", "MINUS", "MIXED", "MODEL", "MONEY", "MONTH", "MORAL", "MOTOR", "MOUNT", "MOUSE", "MOUTH", "MOVIE", "MUSIC", "NEEDS", "NEVER", "NEWLY", "NIGHT", "NOISE", "NORTH", "NOTED", "NOVEL", "NURSE", "OCCUR", "OCEAN", "OFFER", "OFTEN", "ORDER", "OTHER", "OUGHT", "PAINT", "PANEL", "PAPER", "PARTY", "PEACE", "PETER", "PHASE", "PHONE", "PHOTO", "PIECE", "PILOT", "PITCH", "PLACE", "PLAIN", "PLANE", "PLANT", "PLATE", "POINT", "POUND", "POWER", "PRESS", "PRICE", "PRIDE", "PRIME", "PRINT", "PRIOR", "PRIZE", "PROOF", "PROUD", "PROVE", "QUEEN", "QUICK", "QUIET", "QUITE", "RADIO", "RAISE", "RANGE", "RAPID", "RATIO", "REACH", "READY", "REFER", "RIGHT", "RIVAL", "RIVER", "ROBIN", "ROGER", "ROMAN", "ROUGH", "ROUND", "ROUTE", "ROYAL", "RURAL", "SCALE", "SCENE", "SCOPE", "SCORE", "SENSE", "SERVE", "SEVEN", "SHALL", "SHAPE", "SHARE", "SHARP", "SHEET", "SHELF", "SHELL", "SHIFT", "SHIRT", "SHOCK", "SHOOT", "SHORT", "SHOWN", "SIGHT", "SINCE", "SIXTH", "SIXTY", "SIZED", "SKILL", "SLEEP", "SLIDE", "SMALL", "SMART", "SMILE", "SMITH", "SMOKE", "SOLID", "SOLVE", "SORRY", "SOUND", "SOUTH", "SPACE", "SPARE", "SPEAK", "SPEED", "SPEND", "SPENT", "SPLIT", "SPOKE", "SPORT", "STAFF", "STAGE", "STAKE", "STAND", "START", "STATE", "STEAM", "STEEL", "STICK", "STILL", "STOCK", "STONE", "STOOD", "STORE", "STORM", "STORY", "STRIP", "STUCK", "STUDY", "STUFF", "STYLE", "SUGAR", "SUITE", "SUPER", "SWEET", "TABLE", "TAKEN", "TASTE", "TAXES", "TEACH", "TEETH", "TERRY", "TEXAS", "THANK", "THEFT", "THEIR", "THEME", "THERE", "THESE", "THICK", "THING", "THINK", "THIRD", "THOSE", "THREE", "THREW", "THROW", "TIGHT", "TIMES", "TIRED", "TITLE", "TODAY", "TOPIC", "TOTAL", "TOUCH", "TOUGH", "TOWER", "TRACK", "TRADE", "TRAIN", "TREAT", "TREND", "TRIAL", "TRIED", "TRUCK", "TRULY", "TRUST", "TRUTH", "TWICE", "UNDER", "UNDUE", "UNION", "UNITY", "UNTIL", "UPPER", "UPSET", "URBAN", "USAGE", "USUAL", "VALID", "VALUE", "VIDEO", "VIRUS", "VISIT", "VITAL", "VOICE", "WASTE", "WATCH", "WATER", "WHEEL", "WHERE", "WHICH", "WHILE", "WHITE", "WHOLE", "WHOSE", "WOMAN", "WOMEN", "WORLD", "WORRY", "WORSE", "WORST", "WORTH", "WOULD", "WOUND", "WRITE", "WRONG", "WROTE", "YIELD", "YOUNG", "YOUTH",
            "ACTION", "ALWAYS", "ANIMAL", "ANSWER", "ANYONE", "APPEAR", "ARTIST", "ASLEEP", "ATTACK", "AUTHOR", "BANKER", "BARREL", "BASKET", "BECOME", "BEFORE", "BEHIND", "BELIEF", "BETTER", "BOTTLE", "BOTTOM", "BOUGHT", "BRANCH", "BREATH", "BRIDGE", "BRIGHT", "BROKEN", "BUDGET", "BURDEN", "BUREAU", "BUTTON", "CAMERA", "CANCER", "CANNOT", "CARBON", "CAREER", "CASTLE", "CASUAL", "CAUGHT", "CENTER", "CENTRE", "CHANCE", "CHANGE", "CHARGE", "CHOICE", "CHOOSE", "CHOSEN", "CHURCH", "CIRCLE", "CLIENT", "CLOSED", "CLOSER", "COFFEE", "COLUMN", "COMBAT", "COMING", "COMMON", "CORNER", "COUNTY", "COUPLE", "COURSE", "COVERS", "CREATE", "CREDIT", "CRISIS", "CUSTOM", "DAMAGE", "DANGER", "DEALER", "DEBATE", "DECADE", "DECIDE", "DEFEAT", "DEFEND", "DEFINE", "DEGREE", "DEMAND", "DEPEND", "DEPUTY", "DESERT", "DESIGN", "DESIRE", "DETAIL", "DETECT", "DEVICE", "DIFFER", "DINNER", "DIRECT", "DOCTOR", "DOLLAR", "DOMAIN", "DOUBLE", "DRIVEN", "DRIVER", "DURING", "EASILY", "EATING", "EDITOR", "EFFECT", "EFFORT", "EIGHTY", "EITHER", "ELEVEN", "EMERGE", "EMPIRE", "EMPLOY", "ENDING", "ENERGY", "ENGAGE", "ENGINE", "ENOUGH", "ENSURE", "ENTIRE", "ENTITY", "EQUITY", "ESCAPE", "ESTATE", "ETHICS", "EXCEED", "EXCEPT", "EXCESS", "EXPAND", "EXPECT", "EXPERT", "EXPORT", "EXTEND", "EXTENT", "FABRIC", "FACING", "FACTOR", "FAILED", "FAIRLY", "FALLEN", "FAMILY", "FAMOUS", "FATHER", "FELLOW", "FEMALE", "FIGURE", "FILING", "FINGER", "FINISH", "FISCAL", "FLIGHT", "FLYING", "FOLLOW", "FORCED", "FOREST", "FORGET", "FORMAL", "FORMAT", "FORMER", "FOSTER", "FOUGHT", "FOURTH", "FRENCH", "FRIEND", "FUTURE", "GARDEN", "GATHER", "GENDER", "GERMAN", "GLOBAL", "GOLDEN", "GROUND", "GROWTH", "GUILTY", "HANDED", "HANDLE", "HAPPEN", "HARDLY", "HEADED", "HEALTH", "HEIGHT", "HIDDEN", "HOLDER", "HONEST", "IMPACT", "IMPORT", "INCOME", "INDIAN", "INJURY", "INSIDE", "INTEND", "INTENT", "INVEST", "ISLAND", "ITSELF", "JERSEY", "JOSEPH", "JUNIOR", "KILLED", "LABOUR", "LATEST", "LAUNCH", "LAWYER", "LEADER", "LEAGUE", "LEAVES", "LEGACY", "LENGTH", "LESSON", "LETTER", "LIGHTS", "LIKELY", "LINKED", "LIQUID", "LISTEN", "LITTLE", "LIVING", "LOANED", "LOCATE", "LONDON", "LONELY", "LOSING", "LOVELY", "LUXURY", "MAINLY", "MAKING", "MANAGE", "MANNER", "MANUAL", "MARGIN", "MARINE", "MARKED", "MARKET", "MARTIN", "MASTER", "MATTER", "MATURE", "MEDIUM", "MEMBER", "MEMORY", "MENTAL", "MERELY", "MERGER", "METHOD", "MIDDLE", "MILLER", "MINING", "MINUTE", "MIRROR", "MOBILE", "MODERN", "MODEST", "MODULE", "MOMENT", "MORALE", "MOTHER", "MOTION", "MOVING", "MUSEUM", "MYSELF", "NARROW", "NATION", "NATIVE", "NATURE", "NEARLY", "NEEDED", "NEEDLE", "NERVES", "NEWEST", "NOBODY", "NORMAL", "NOTICE", "NOTION", "NUMBER", "OBJECT", "OBTAIN", "OFFICE", "OFFSET", "ONLINE", "OPTION", "ORANGE", "ORIGIN", "OUTPUT", "OXFORD", "PACKED", "PALACE", "PARENT", "PARTLY", "PATENT", "PEOPLE", "PERIOD", "PERMIT", "PERSON", "PHRASE", "PICKED", "PLANET", "PLAYER", "PLEASE", "PLENTY", "POCKET", "POLICE", "POLICY", "PREFER", "PRETTY", "PRINCE", "PRISON", "PROFIT", "PROPER", "PROVE", "PUBLIC", "PURSUE", "RAISED", "RANDOM", "RARELY", "RATHER", "RATING", "READER", "REALLY", "REASON", "RECALL", "RECENT", "RECORD", "REDUCE", "REFORM", "REGARD", "REGIME", "REGION", "RELATE", "RELIEF", "REMAIN", "REMOTE", "REMOVE", "REPAIR", "REPEAT", "REPLAY", "REPORT", "RESCUE", "RESORT", "RESULT", "RETAIL", "RETAIN", "RETURN", "REVEAL", "REVIEW", "RHYTHM", "RIDING", "RISING", "ROBUST", "ROLLER", "ROMAIN", "ROUGH", "ROUND", "ROUTE", "ROYAL", "RURAL", "SAFETY", "SALARY", "SAMPLE", "SAVING", "SCHEME", "SCHOOL", "SCREEN", "SEARCH", "SEASON", "SECOND", "SECRET", "SECTOR", "SECURE", "SEEING", "SELECT", "SELLER", "SENIOR", "SERIES", "SERVER", "SETTLE", "SEVERE", "SEXUAL", "SHOULD", "SIGNAL", "SIGNED", "SILENT", "SILVER", "SIMPLE", "SIMPLY", "SINGLE", "SISTER", "SLIGHT", "SMOOTH", "SOCIAL", "SOFTLY", "SOLELY", "SOUGHT", "SOURCE", "SOVIET", "SPEECH", "SPIRIT", "SPOKEN", "SPREAD", "SPRING", "SQUARE", "STABLE", "STATUS", "STEADY", "STOLEN", "STRAIN", "STREAM", "STREET", "STRESS", "STRICT", "STRIKE", "STRING", "STRONG", "STRUCK", "STUDIO", "SUBMIT", "SUDDEN", "SUFFER", "SUMMER", "SUMMIT", "SUPPLY", "SURELY", "SURVEY", "SWITCH", "SYMBOL", "SYSTEM", "TAKING", "TALENT", "TARGET", "TAUGHT", "TENANT", "TENDER", "TENNIS", "THANKS", "THEORY", "THIRTY", "THOUGH", "THREAT", "THROWN", "TICKET", "TIMELY", "TIMING", "TISSUE", "TITLE", "TOILET", "TOMATO", "TONGUE", "TOPPED", "TOWARD", "TRADER", "TRAVEL", "TREATY", "TRENDY", "TRIPLY", "TRUSTY", "TRYING", "TWELVE", "TWENTY", "UNABLE", "UNIQUE", "UNITED", "UNLESS", "UNLIKE", "UPDATE", "USEFUL", "VALLEY", "VARYING", "VENDOR", "VERSUS", "VICTIM", "VISION", "VISUAL", "VOLUME", "WALKER", "WANTED", "WARNING", "WEALTH", "WEEKLY", "WEIGHT", "WHOLLY", "WINDOW", "WINNER", "WINTER", "WITHIN", "WONDER", "WORKER", "WRIGHT", "WRITER", "YELLOW"
        ],
        // Root words for generating levels (6+ letters)
        rootWords: [
            "PUZZLE", "JUNGLE", "PLANET", "WIDGET", "GAMING", "CODING", "WINNER", "ORANGE", "FAMILY", "SCHOOL", "TUTOR", "PORTAL", "SUMMER", "WINTER", "GARDEN", "DOCTOR", "DRIVER", "FRIEND", "SYSTEM", "ONLINE", "NUMBER", "PEOPLE", "GLOBAL", "ACTION", "BUTTON", "OFFICE", "MARKET", "HEALTH", "PERSON", "POLICY", "SERIES", "RESULT", "CHANGE", "FUTURE", "PUBLIC", "THEORY", "ENERGY", "DESIGN", "SOURCE", "PERIOD", "CHANCE", "AMOUNT", "GROWTH", "INCOME", "MEMBER", "LEADER", "SAFETY", "GROUND", "LETTER", "WEIGHT", "AGENCY", "MEMORY", "BUDGET", "CREDIT", "IMPACT", "STATUS", "MOTION", "SPEECH", "ISLAND", "STUDIO", "CAMERA", "DAMAGE", "LENGTH", "OUTPUT", "FATHER", "MOTHER", "PARENT", "STREET", "RECORD", "FOREST", "SEASON", "SPIRIT", "WEALTH", "BRANCH", "DEGREE", "CORNER", "SCREEN", "WINDOW", "VALLEY", "WRITER", "TARGET", "PRISON", "BRIDGE", "SWITCH", "DETAIL", "NATURE", "CAREER", "LEGACY", "PROFIT", "SILVER", "CLIENT", "SIGNAL", "MASTER"
        ]
    };

    let state = {
        score: 0,
        gameActive: false,
        snake: [],
        snakeDir: { x: 0, y: 0 },
        snakeInterval: null,
        currentUser: { name: 'Guest', id: null },
        // Word Game State
        wordLevel: 1,
        targetWord: "", // The bingo word to find
        wordTiles: [],
        currentWord: "",
        validWordsFound: []
    };

    // --- INITIALIZATION ---
    function initWidget() {
        if (typeof firebase !== 'undefined' && firebase.auth()) {
            const u = firebase.auth().currentUser;
            if (u) {
                state.currentUser.id = u.uid;
                state.currentUser.name = u.displayName || u.email.split('@')[0] || "Tutor";
            }
        }

        const floater = document.createElement('button');
        floater.id = 'bk-game-floater';
        floater.className = `fixed bottom-6 left-6 z-50 p-4 rounded-full shadow-2xl transition-transform transform hover:scale-110 cursor-pointer ${CONFIG.colors.primary} text-white border-4 border-white`;
        floater.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        `;
        floater.onclick = openModal;
        document.body.appendChild(floater);

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
                    <span class="text-xs text-indigo-500 mt-1">Level Up Mode</span>
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
        
        fetchGlobalLeaderboard('Snake', 'main-leaderboard-list');
    }

    function showGameOver(finalScore, gameName) {
        stopCurrentGame();
        const container = document.getElementById('bk-game-container');
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
                    <div id="mini-leaderboard" class="space-y-1 text-sm">Loading...</div>
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
            if (typeof html2canvas === 'undefined') {
                alert("Error: html2canvas library not loaded.");
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

    // --- GAME 1: SNAKE ---
    function initSnakeGame() {
        const container = document.getElementById('bk-game-container');
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
        const gridSize = canvas.width / tileCount;
        
        state.score = 0;
        state.snake = [{x: 10, y: 10}];
        state.snakeDir = {x: 0, y: 0};
        state.snakeFood = {x: 15, y: 15};
        state.gameActive = true;

        document.onkeydown = (e) => {
            if(!state.gameActive) return;
            switch(e.key) {
                case 'ArrowLeft': if(state.snakeDir.x !== 1) state.snakeDir = {x: -1, y: 0}; break;
                case 'ArrowUp': if(state.snakeDir.y !== 1) state.snakeDir = {x: 0, y: -1}; break;
                case 'ArrowRight': if(state.snakeDir.x !== -1) state.snakeDir = {x: 1, y: 0}; break;
                case 'ArrowDown': if(state.snakeDir.y !== -1) state.snakeDir = {x: 0, y: 1}; break;
            }
        };

        let touchStartX = 0; let touchStartY = 0;
        const touchArea = document.getElementById('mobile-controls');
        touchArea.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY; }, {passive: false});
        touchArea.addEventListener('touchend', e => {
            e.preventDefault();
            const dx = e.changedTouches[0].screenX - touchStartX;
            const dy = e.changedTouches[0].screenY - touchStartY;
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0 && state.snakeDir.x !== -1) state.snakeDir = {x: 1, y: 0};
                else if (dx < 0 && state.snakeDir.x !== 1) state.snakeDir = {x: -1, y: 0};
            } else {
                if (dy > 0 && state.snakeDir.y !== -1) state.snakeDir = {x: 0, y: 1};
                else if (dy < 0 && state.snakeDir.y !== 1) state.snakeDir = {x: 0, y: -1};
            }
        }, {passive: false});

        state.snakeInterval = setInterval(() => {
            if(!state.gameActive) return;
            const head = {x: state.snake[0].x + state.snakeDir.x, y: state.snake[0].y + state.snakeDir.y};

            if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) { showGameOver(state.score, "Snake"); return; }
            for (let part of state.snake) {
                if (head.x === part.x && head.y === part.y && (state.snakeDir.x !== 0 || state.snakeDir.y !== 0)) { showGameOver(state.score, "Snake"); return; }
            }

            state.snake.unshift(head);
            if (head.x === state.snakeFood.x && head.y === state.snakeFood.y) {
                state.score += 10;
                document.getElementById('snake-score').innerText = state.score;
                state.snakeFood = { x: Math.floor(Math.random() * tileCount), y: Math.floor(Math.random() * tileCount) };
            } else {
                state.snake.pop();
            }

            ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0,0, canvas.width, canvas.height);
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(state.snakeFood.x * gridSize + gridSize/2, state.snakeFood.y * gridSize + gridSize/2, gridSize/2 - 2, 0, 2 * Math.PI); ctx.fill();
            ctx.fillStyle = '#4f46e5';
            for (let part of state.snake) ctx.fillRect(part.x * gridSize, part.y * gridSize, gridSize - 1, gridSize - 1);
        }, 150);
    }

    // --- GAME 2: WORD BUILDER V3 (LEVEL UP) ---
    function initWordGame() {
        state.score = 0;
        state.wordLevel = 1;
        state.gameActive = true;
        state.validWordsFound = [];
        generateLevel();
    }

    function generateLevel() {
        // Pick a random root word
        const roots = CONFIG.rootWords;
        state.targetWord = roots[Math.floor(Math.random() * roots.length)];
        
        // Shuffle the letters
        state.wordTiles = state.targetWord.split('').sort(() => Math.random() - 0.5);
        state.currentWord = "";
        
        renderWordGameUI();
    }

    function renderWordGameUI() {
        const container = document.getElementById('bk-game-container');
        
        let tilesHTML = state.wordTiles.map((letter, index) => 
            `<button class="w-10 h-10 md:w-12 md:h-12 bg-indigo-100 text-indigo-800 font-bold rounded-lg shadow hover:bg-indigo-200 text-xl word-tile transform transition active:scale-90" data-idx="${index}" data-letter="${letter}">${letter}</button>`
        ).join('');

        container.innerHTML = `
            <div class="flex justify-between w-full mb-4 items-end">
                <div class="flex flex-col">
                    <span class="text-xs text-gray-400 font-bold uppercase">Level ${state.wordLevel}</span>
                    <span class="font-bold text-gray-600 text-xl">Score: <span id="word-score" class="text-indigo-600">${state.score}</span></span>
                </div>
                <button id="end-word-game" class="text-xs text-red-500 bg-red-50 px-3 py-1 rounded-full hover:bg-red-100 transition">End Game</button>
            </div>

            <div class="w-full bg-white border-b-4 border-indigo-100 h-20 mb-2 flex items-center justify-center rounded-xl shadow-sm relative">
                <span id="current-word-display" class="text-4xl font-black tracking-widest text-gray-800 uppercase animate-pulse"></span>
                <span class="absolute top-2 right-2 text-xs text-gray-300">Target: ${state.targetWord.length} Letters</span>
            </div>

            <p id="word-feedback" class="h-6 mb-4 text-sm font-bold text-center opacity-0 transition-opacity duration-300"></p>

            <div class="flex flex-wrap justify-center gap-2 mb-6" id="tile-rack">
                ${tilesHTML}
            </div>

            <div class="grid grid-cols-3 gap-2 w-full">
                <button id="btn-shuffle" class="py-3 bg-yellow-100 text-yellow-700 rounded-xl hover:bg-yellow-200 font-bold transition flex justify-center items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" /></svg></button>
                <button id="btn-clear" class="py-3 bg-gray-200 text-gray-600 rounded-xl hover:bg-gray-300 font-bold transition">Clear</button>
                <button id="btn-submit" class="py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 transition">Submit</button>
            </div>
        `;

        // Logic for clicking tiles
        document.querySelectorAll('.word-tile').forEach(btn => {
            btn.onclick = function() {
                // Visual feedback that tile is used
                if (this.classList.contains('opacity-50')) return;
                
                state.currentWord += this.getAttribute('data-letter');
                this.classList.add('opacity-50', 'cursor-not-allowed');
                updateWordDisplay();
            }
        });

        document.getElementById('btn-clear').onclick = resetTiles;
        document.getElementById('btn-shuffle').onclick = shuffleTiles;
        document.getElementById('btn-submit').onclick = submitWord;
        document.getElementById('end-word-game').onclick = () => showGameOver(state.score, "Word Builder");
    }

    function updateWordDisplay() {
        document.getElementById('current-word-display').innerText = state.currentWord;
    }

    function resetTiles() {
        state.currentWord = "";
        updateWordDisplay();
        document.querySelectorAll('.word-tile').forEach(btn => {
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        });
    }

    function shuffleTiles() {
        resetTiles();
        state.wordTiles.sort(() => Math.random() - 0.5);
        renderWordGameUI();
    }

    function submitWord() {
        const feedback = document.getElementById('word-feedback');
        const word = state.currentWord;
        feedback.classList.remove('opacity-0');

        if (state.validWordsFound.includes(word)) {
            feedback.innerText = "ALREADY FOUND!";
            feedback.className = "h-6 mb-4 text-sm font-bold text-center text-yellow-500";
            setTimeout(() => { resetTiles(); feedback.classList.add('opacity-0'); }, 800);
            return;
        }

        // LEVEL UP CHECK: If they found the Target Word (Bingo)
        if (word === state.targetWord) {
            const points = word.length * 50; // Huge Bonus
            state.score += points;
            state.wordLevel++;
            document.getElementById('word-score').innerText = state.score;
            
            feedback.innerText = `BINGO! LEVEL UP! +${points}`;
            feedback.className = "h-6 mb-4 text-sm font-black text-center text-purple-600 animate-bounce";
            
            // Animation delay before next level
            setTimeout(() => {
                state.validWordsFound = []; // Reset found words for new level
                generateLevel(); // New tiles
            }, 1500);
            return;
        }

        // Normal Word Validation
        if (CONFIG.dictionary.includes(word) || CONFIG.rootWords.includes(word)) {
            const points = word.length * 10;
            state.score += points;
            state.validWordsFound.push(word);
            document.getElementById('word-score').innerText = state.score;
            feedback.innerText = `GOOD! +${points}`;
            feedback.className = "h-6 mb-4 text-sm font-bold text-center text-green-500";
        } else {
            feedback.innerText = "NOT IN DICTIONARY";
            feedback.className = "h-6 mb-4 text-sm font-bold text-center text-red-500";
        }
        
        setTimeout(() => {
            resetTiles();
            setTimeout(() => feedback.classList.add('opacity-0'), 1000);
        }, 500);
    }

    function stopCurrentGame() {
        state.gameActive = false;
        if (state.snakeInterval) clearInterval(state.snakeInterval);
        document.onkeydown = null;
    }

    // --- FIREBASE LOGIC ---
    async function saveScoreToFirebase(score, gameName) {
        if (typeof db === 'undefined') { console.warn("DB not connected."); return; }
        const scoreData = {
            userId: state.currentUser.id || 'guest',
            userName: state.currentUser.name || 'Guest Player',
            game: gameName,
            score: score,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await db.collection('leaderboard').add(scoreData);
            if (state.currentUser.id) {
                await db.collection('tutors').doc(state.currentUser.id).update({
                    gameHistory: firebase.firestore.FieldValue.arrayUnion(scoreData)
                });
            }
        } catch (e) { console.error("Firebase save failed:", e); }
    }

    function fetchGlobalLeaderboard(gameName, elementId) {
        const listEl = document.getElementById(elementId);
        if (!listEl || typeof db === 'undefined') return;

        db.collection('leaderboard').where('game', '==', gameName).orderBy('score', 'desc').limit(3).get()
            .then((querySnapshot) => {
                let html = ''; let rank = 1;
                querySnapshot.forEach((doc) => {
                    const d = doc.data();
                    let medal = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : '🥉');
                    html += `<div class="flex justify-between items-center p-2 rounded ${rank===1?'bg-yellow-100 text-yellow-800':'bg-gray-50 text-gray-600'}"><span class="font-bold flex gap-2"><span>${medal}</span> ${d.userName}</span><span class="font-mono font-bold">${d.score}</span></div>`;
                    rank++;
                });
                if (html === '') html = '<p class="text-gray-400 italic">No scores yet.</p>';
                listEl.innerHTML = html;
            })
            .catch((error) => {
                if (error.code === 'failed-precondition') listEl.innerHTML = '<p class="text-xs text-red-400">Admin: Create Index</p>';
                else listEl.innerHTML = '<p class="text-xs text-red-400">Offline</p>';
            });
    }

    window.addEventListener('load', initWidget);

})();
