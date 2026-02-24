/**
 * BLOOMING KIDS TUTOR PORTAL - GAME WIDGET V7
 * Features: Snake, Word Builder, Tic-Tac-Toe
 * Uses modular Firebase SDK (exposed via window from tutor.js)
 * Fixed: z-index, Firebase compat removed, Tic-Tac-Toe added
 */

(function () {
    // --- CONFIGURATION ---
    const CONFIG = {
        dictionary: [
            "THE","AND","FOR","ARE","BUT","NOT","YOU","ALL","ANY","CAN","HAD","HAS","HIM","HIS","HER","ITS",
            "ONE","TWO","NEW","OUR","OUT","SEE","WAY","WHO","BOY","DID","LET","PUT","SAY","SHE","TOO","USE",
            "DAD","MOM","CAT","DOG","RUN","EAT","BIG","RED","YES","LOW","KEY","BED","WIN","TOP","JOY","SKY",
            "GAME","PLAY","READ","BOOK","KIDS","CODE","MATH","TEST","EXAM","PASS","WORK","GOOD","BEST","LOVE",
            "HELP","GROW","MIND","WORD","LIST","TYPE","TEXT","VIEW","MENU","USER","TIME","DATA","QUIZ","SOUL",
            "BRAIN","SMART","THINK","CLASS","STUDY","LEARN","WRITE","START","STOP","OPEN","CLOSE","NEXT","BACK",
            "HOME","SAVE","FIND","LOOK","MAKE","KNOW","TAKE","YEAR","ROOM","DOOR","GIRL","DONE","HIGH","NAME",
            "NOTE","IDEA","HARD","EASY","BLUE","BALL","BIRD","BOAT","BONE","CAKE","CALL","CARD","CARE","CITY",
            "CLUB","COOK","COOL","DATE","DEEP","DESK","DROP","DUCK","DUST","FACE","FACT","FARM","FAST","FILE",
            "FIRE","FISH","FLAG","FOOD","FOOT","FORM","FREE","FROG","FULL","GIFT","GIVE","GLAD","GOAL","GOLD",
            "HAIR","HALF","HALL","HAND","HEAD","HEAR","HEAT","HILL","HOLD","HOLE","HOPE","HOUR","HURT","ITEM",
            "JOIN","JUMP","JUST","KEEP","KIND","KING","KISS","KNEE","LADY","LAKE","LAND","LAST","LATE","LEAD",
            "LEFT","LESS","LINE","LION","LONG","LOST","LUCK","MAIN","MARK","MEAL","MEET","MILE","MILK","MISS",
            "MOON","MOVE","NEAR","NECK","NEED","NEWS","NICE","NOSE","ONCE","PACK","PAGE","PAIN","PAIR","PARK",
            "PART","PAST","PATH","PICK","PLAN","POOR","POST","PULL","PUSH","RACE","RAIN","RARE","REAL","REST",
            "RICH","RIDE","RING","RISE","RISK","ROAD","ROCK","ROLE","ROOF","ROOT","ROPE","ROSE","RULE","SAFE",
            "SALT","SAND","SEAT","SEED","SELL","SEND","SHIP","SHOE","SHOP","SHOT","SHOW","SHUT","SICK","SIDE",
            "SIGN","SING","SIZE","SKIN","SLOW","SNOW","SOFT","SOIL","SONG","SOON","SORT","SOUP","SPOT","STAR",
            "STAY","STEP","SUCH","SURE","SWIM","TAIL","TALK","TALL","TEAM","TELL","TENT","TERM","TICK","TIDE",
            "TILL","TINY","TOWN","TREE","TRIP","TURN","UNIT","UPON","VOTE","WAIT","WALK","WALL","WANT","WARM",
            "WASH","WAVE","WEAR","WEEK","WELL","WENT","WERE","WEST","WILD","WILL","WIND","WISH","WITH","WOOD",
            "YARD","ZERO","ZONE",
            "ABOUT","ABOVE","ACTOR","ADMIT","ADULT","AFTER","AGAIN","AGENT","AGREE","AHEAD","ALARM","ALBUM",
            "ALERT","ALIVE","ALLOW","ALONE","ALONG","AMONG","ANGER","ANGLE","ANGRY","APPLE","APPLY","ARGUE",
            "ASIDE","AUDIO","AVOID","AWARD","AWARE","BADLY","BASES","BASIC","BEACH","BEGAN","BEGIN","BEING",
            "BELOW","BENCH","BIRTH","BLACK","BLAME","BLIND","BLOCK","BLOOD","BOARD","BOOST","BOUND","BRAND",
            "BREAD","BREAK","BRIEF","BRING","BROKE","BROWN","BUILD","BUILT","CHAIN","CHAIR","CHART","CHASE",
            "CHEAP","CHECK","CHEST","CHIEF","CHILD","CHOSE","CIVIL","CLAIM","CLEAN","CLEAR","CLICK","CLOCK",
            "CLOSE","COAST","COUNT","COURT","COVER","CRASH","CREAM","CRIME","CROSS","CROWD","CROWN","CYCLE",
            "DAILY","DANCE","DEATH","DOUBT","DOZEN","DRAFT","DRAMA","DRAWN","DREAM","DRESS","DRINK","DRIVE",
            "DYING","EAGER","EARLY","EARTH","EIGHT","ELITE","EMPTY","ENEMY","ENJOY","ENTER","EQUAL","ERROR",
            "EVENT","EXACT","EXIST","EXTRA","FAITH","FALSE","FAULT","FIELD","FIFTH","FIFTY","FIGHT","FINAL",
            "FIRST","FIXED","FLASH","FLOOR","FOCUS","FORCE","FORTH","FORTY","FOUND","FRAME","FRAUD","FRESH",
            "FRONT","FRUIT","FULLY","FUNNY","GIANT","GIVEN","GLASS","GLOBE","GRACE","GRADE","GRAND","GRANT",
            "GRASS","GREAT","GREEN","GROUP","GROWN","GUARD","GUESS","GUEST","GUIDE","HAPPY","HEART","HEAVY",
            "HORSE","HOTEL","HOUSE","HUMAN","IDEAL","IMAGE","INDEX","INNER","INPUT","ISSUE","JOINT","JUDGE",
            "KNOWN","LABEL","LARGE","LASER","LATER","LAYER","LEGAL","LEVEL","LIGHT","LIMIT","LIVES","LOCAL",
            "LOGIC","LOWER","LUCKY","LUNCH","MAGIC","MAJOR","MAKER","MARCH","MATCH","MAYBE","MAYOR","MEDIA",
            "METAL","MINOR","MODEL","MONEY","MONTH","MOTOR","MOUSE","MOUTH","MOVIE","MUSIC","NEEDS","NIGHT",
            "NORTH","NOVEL","NURSE","OCEAN","OFFER","OFTEN","ORDER","OTHER","PAINT","PAPER","PARTY","PEACE",
            "PHASE","PHONE","PHOTO","PIECE","PILOT","PITCH","PLACE","PLANE","PLANT","PLATE","POINT","POWER",
            "PRESS","PRICE","PRIDE","PRIME","PRIOR","PRIZE","PROOF","PROUD","QUEEN","QUICK","QUIET","QUITE",
            "RADIO","RAISE","RANGE","RAPID","REACH","READY","RIGHT","RIVER","ROUGH","ROUND","ROUTE","RURAL",
            "SCALE","SCENE","SCORE","SENSE","SERVE","SEVEN","SHAPE","SHARE","SHARP","SHELF","SHIFT","SHOCK",
            "SHORT","SIGHT","SINCE","SIXTH","SIXTY","SKILL","SLEEP","SLIDE","SMALL","SMART","SMILE","SMOKE",
            "SOLID","SORRY","SOUND","SOUTH","SPACE","SPEAK","SPEED","SPEND","SPLIT","SPORT","STAFF","STAGE",
            "STAND","STATE","STEEL","STICK","STILL","STOCK","STONE","STORE","STORM","STORY","STUCK","STUDY",
            "STUFF","STYLE","SUGAR","SUITE","SUPER","SWEET","TABLE","TAKEN","TASTE","TEACH","TEETH","THANK",
            "THEIR","THEME","THERE","THESE","THICK","THING","THINK","THIRD","THREE","THROW","TIGHT","TIMES",
            "TIRED","TITLE","TODAY","TOPIC","TOTAL","TOUCH","TOWER","TRACK","TRADE","TRAIN","TREAT","TREND",
            "TRIAL","TRIED","TRUCK","TRULY","TRUST","TRUTH","TWICE","UNDER","UNION","UNITY","UNTIL","UPPER",
            "URBAN","USUAL","VALID","VALUE","VIDEO","VIRUS","VISIT","VITAL","VOICE","WASTE","WATCH","WATER",
            "WHEEL","WHILE","WHITE","WHOLE","WOMAN","WORLD","WORRY","WORSE","WOULD","WRITE","WRONG","YIELD",
            "YOUNG","YOUTH",
            "ACTION","ALWAYS","ANIMAL","ANSWER","ANYONE","APPEAR","ARTIST","BECOME","BEFORE","BEHIND","BELIEF",
            "BETTER","BOTTLE","BOTTOM","BOUGHT","BRANCH","BREATH","BRIDGE","BRIGHT","BROKEN","BUDGET","BUTTON",
            "CAMERA","CANNOT","CAREER","CASTLE","CAUGHT","CENTER","CHANCE","CHANGE","CHARGE","CHOICE","CHOOSE",
            "CHURCH","CLIENT","CLOSED","COFFEE","COLUMN","COMBAT","COMING","COMMON","CORNER","COUNTY","COUPLE",
            "COURSE","CREATE","CREDIT","CRISIS","CUSTOM","DAMAGE","DANGER","DEALER","DEBATE","DECIDE","DEFEAT",
            "DEFEND","DEFINE","DEGREE","DEMAND","DEPEND","DESIGN","DESIRE","DETAIL","DETECT","DEVICE","DINNER",
            "DIRECT","DOCTOR","DOLLAR","DOUBLE","DRIVEN","DRIVER","EASILY","EATING","EDITOR","EFFECT","EFFORT",
            "ELEVEN","EMERGE","EMPIRE","EMPLOY","ENERGY","ENGAGE","ENGINE","ENSURE","ENTIRE","ENTITY","ESCAPE",
            "ESTATE","EXCEED","EXCEPT","EXPAND","EXPECT","EXPERT","EXTEND","FABRIC","FACTOR","FAILED","FAIRLY",
            "FALLEN","FAMILY","FAMOUS","FATHER","FELLOW","FEMALE","FIGURE","FINGER","FINISH","FLYING","FOLLOW",
            "FORCED","FOREST","FORGET","FORMAL","FORMAT","FORMER","FOSTER","FOURTH","FRENCH","FRIEND","FUTURE",
            "GARDEN","GATHER","GENDER","GLOBAL","GOLDEN","GROUND","GROWTH","GUILTY","HANDLE","HAPPEN","HEADED",
            "HEALTH","HEIGHT","HIDDEN","HOLDER","HONEST","IMPACT","INCOME","INSIDE","INTEND","INVEST","ISLAND",
            "ITSELF","KILLED","LATEST","LAUNCH","LAWYER","LEADER","LEAGUE","LEAVES","LEGACY","LENGTH","LESSON",
            "LETTER","LIKELY","LINKED","LISTEN","LITTLE","LIVING","LOCATE","LONELY","LOSING","LOVELY","LUXURY",
            "MAINLY","MAKING","MANAGE","MANNER","MANUAL","MARKET","MARINE","MASTER","MATTER","MATURE","MEDIUM",
            "MEMBER","MEMORY","MENTAL","MERELY","METHOD","MINUTE","MIRROR","MOBILE","MODERN","MODEST","MOMENT",
            "MOTHER","MOTION","MOVING","MUSEUM","MYSELF","NARROW","NATION","NATIVE","NATURE","NEARLY","NEEDED",
            "NOBODY","NORMAL","NOTICE","NOTION","NUMBER","OBTAIN","OFFICE","ONLINE","OPTION","ORIGIN","OUTPUT",
            "PARENT","PARTLY","PEOPLE","PERIOD","PERMIT","PERSON","PHRASE","PLANET","PLAYER","PLEASE","PLENTY",
            "POCKET","POLICE","POLICY","PREFER","PRETTY","PRINCE","PRISON","PROFIT","PROPER","PUBLIC","PURSUE",
            "RAISED","RARELY","RATHER","RATING","READER","REASON","RECALL","RECENT","RECORD","REDUCE","REFORM",
            "REGION","RELATE","RELIEF","REMAIN","REMOTE","REMOVE","REPEAT","REPORT","RESCUE","RESULT","RETAIL",
            "RETAIN","RETURN","REVEAL","REVIEW","RIDING","RISING","SAFETY","SALARY","SAVING","SCHEME","SCHOOL",
            "SCREEN","SEARCH","SEASON","SECOND","SECRET","SECTOR","SECURE","SELECT","SELLER","SENIOR","SERIES",
            "SERVER","SETTLE","SEVERE","SHOULD","SIGNAL","SILENT","SILVER","SIMPLE","SINGLE","SISTER","SMOOTH",
            "SOURCE","SPEECH","SPIRIT","SPREAD","SPRING","SQUARE","STABLE","STATUS","STEADY","STRAIN","STREAM",
            "STREET","STRESS","STRICT","STRIKE","STRONG","STUDIO","SUBMIT","SUDDEN","SUFFER","SUMMER","SUPPLY",
            "SURELY","SURVEY","SWITCH","SYMBOL","SYSTEM","TAKING","TALENT","TARGET","TAUGHT","THANKS","THEORY",
            "THOUGH","THREAT","TICKET","TIMING","TONGUE","TOWARD","TRADER","TRAVEL","TREATY","TRYING","TWELVE",
            "TWENTY","UNABLE","UNIQUE","UNITED","UNLESS","UNLIKE","UPDATE","USEFUL","VALLEY","VENDOR","VERSUS",
            "VICTIM","VISION","VISUAL","VOLUME","WALKER","WEALTH","WEEKLY","WEIGHT","WINDOW","WINNER","WINTER",
            "WITHIN","WONDER","WORKER","WRITER","YELLOW"
        ],
        rootWords: [
            "PUZZLE","JUNGLE","PLANET","WIDGET","GAMING","CODING","WINNER","ORANGE","FAMILY","SCHOOL",
            "TUTOR","PORTAL","SUMMER","WINTER","GARDEN","DOCTOR","DRIVER","FRIEND","SYSTEM","ONLINE",
            "NUMBER","PEOPLE","GLOBAL","ACTION","BUTTON","OFFICE","MARKET","HEALTH","PERSON","POLICY",
            "SERIES","RESULT","CHANGE","FUTURE","PUBLIC","THEORY","ENERGY","DESIGN","SOURCE","PERIOD",
            "CHANCE","AMOUNT","GROWTH","INCOME","MEMBER","LEADER","SAFETY","GROUND","LETTER","WEIGHT",
            "AGENCY","MEMORY","BUDGET","CREDIT","IMPACT","STATUS","MOTION","SPEECH","ISLAND","STUDIO",
            "CAMERA","DAMAGE","LENGTH","OUTPUT","FATHER","MOTHER","PARENT","STREET","RECORD","FOREST",
            "SEASON","SPIRIT","WEALTH","BRANCH","DEGREE","CORNER","SCREEN","WINDOW","VALLEY","WRITER",
            "TARGET","PRISON","BRIDGE","SWITCH","DETAIL","NATURE","CAREER","LEGACY","PROFIT","SILVER",
            "CLIENT","SIGNAL","MASTER"
        ]
    };

    let state = {
        score: 0,
        gameActive: false,
        snake: [],
        snakeDir: { x: 0, y: 0 },
        snakeInterval: null,
        currentUser: { name: 'Tutor', id: null },
        wordLevel: 1,
        targetWord: "",
        wordTiles: [],
        currentWord: "",
        validWordsFound: [],
        // Tic-Tac-Toe
        tttBoard: Array(9).fill(null),
        tttTurn: 'X',
        tttScores: { X: 0, O: 0, draws: 0 },
        tttVsAI: true
    };

    // ─── FIREBASE helpers (uses modular SDK exposed by tutor.js) ───────────────
    function getDB() { return window.db || null; }
    function getFirebaseImports() {
        return {
            collection: window.__fbCollection || null,
            addDoc: window.__fbAddDoc || null,
            getDocs: window.__fbGetDocs || null,
            query: window.__fbQuery || null,
            where: window.__fbWhere || null,
            orderBy: window.__fbOrderBy || null,
            limit: window.__fbLimit || null,
        };
    }
    // Expose key Firebase methods after tutor.js loads them
    function exposeFirebase() {
        try {
            const imports = ['collection','addDoc','getDocs','query','where','orderBy','limit'];
            // tutor.js imports these; they're accessible via the module scope trick
            // We rely on window.db being set by firebaseConfig.js
        } catch(e) {}
    }

    // ─── INIT ─────────────────────────────────────────────────────────────────
    function initWidget() {
        // Sync user from tutorData
        if (window.tutorData) {
            state.currentUser.name = window.tutorData.name || state.currentUser.name;
            state.currentUser.id   = window.tutorData.id   || null;
        }

        // Floating game button
        const floater = document.createElement('button');
        floater.id = 'bk-game-floater';
        floater.style.cssText = `
            position:fixed;bottom:155px;right:20px;z-index:99999;
            width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;
            background:linear-gradient(145deg,#f59e0b,#d97706);color:white;
            box-shadow:0 8px 24px rgba(245,158,11,.45),0 0 0 3px rgba(255,255,255,.3);
            display:flex;align-items:center;justify-content:center;font-size:1.5rem;
            transition:all .22s cubic-bezier(.22,1,.36,1);
        `;
        floater.innerHTML = '🎮';
        floater.title = 'Arcade Games';
        floater.onmouseover = () => { floater.style.transform='scale(1.12) translateY(-3px)'; floater.style.boxShadow='0 14px 36px rgba(245,158,11,.55),0 0 0 3px rgba(255,255,255,.35)'; };
        floater.onmouseout  = () => { floater.style.transform=''; floater.style.boxShadow='0 8px 24px rgba(245,158,11,.45),0 0 0 3px rgba(255,255,255,.3)'; };
        floater.onclick = openModal;
        document.body.appendChild(floater);

        // Modal
        const modal = document.createElement('div');
        modal.id = 'bk-game-modal';
        modal.style.cssText = `
            position:fixed;inset:0;z-index:999999;
            background:rgba(15,23,42,.85);backdrop-filter:blur(8px);
            display:none;align-items:center;justify-content:center;padding:16px;
        `;
        modal.innerHTML = `
            <div style="background:#fff;border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.45);width:100%;max-width:440px;overflow:hidden;position:relative;">
                <div style="background:linear-gradient(135deg,#1e1b4b,#3730a3);padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span style="font-size:1.5rem;">🎮</span>
                        <div>
                            <div style="color:#fff;font-weight:800;font-size:1rem;">Arcade Mode</div>
                            <div style="color:#a5b4fc;font-size:.72rem;">Take a break & play!</div>
                        </div>
                    </div>
                    <button id="bk-close-btn" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:34px;height:34px;border-radius:50%;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
                </div>
                <div id="bk-game-container" style="padding:20px;min-height:420px;display:flex;flex-direction:column;align-items:center;justify-content:center;"></div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('bk-close-btn').onclick = closeModal;
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    }

    function openModal() {
        const modal = document.getElementById('bk-game-modal');
        modal.style.display = 'flex';
        showMainMenu();
    }

    function closeModal() {
        stopCurrentGame();
        const modal = document.getElementById('bk-game-modal');
        if (modal) modal.style.display = 'none';
    }

    // ─── MAIN MENU ────────────────────────────────────────────────────────────
    function showMainMenu() {
        const container = document.getElementById('bk-game-container');
        const name = window.tutorData?.name?.split(' ')[0] || state.currentUser.name;
        container.innerHTML = `
            <h2 style="font-size:1.3rem;font-weight:800;color:#1e1b4b;margin-bottom:4px;text-align:center;">Hi, ${escG(name)}! 👋</h2>
            <p style="color:#6b7280;margin-bottom:20px;text-align:center;font-size:.875rem;">Pick a game and beat the high scores.</p>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;margin-bottom:18px;">
                <button id="btn-snake" class="game-pick-btn" style="border:2px solid #e0e7ff;border-radius:14px;padding:16px 8px;background:#fff;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:6px;" onmouseover="this.style.borderColor='#6366f1';this.style.background='#f0f0ff'" onmouseout="this.style.borderColor='#e0e7ff';this.style.background='#fff'">
                    <span style="font-size:2rem;">🐍</span>
                    <span style="font-weight:700;color:#374151;font-size:.8rem;">Snake</span>
                </button>
                <button id="btn-word" style="border:2px solid #e0e7ff;border-radius:14px;padding:16px 8px;background:#fff;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:6px;" onmouseover="this.style.borderColor='#6366f1';this.style.background='#f0f0ff'" onmouseout="this.style.borderColor='#e0e7ff';this.style.background='#fff'">
                    <span style="font-size:2rem;">🧩</span>
                    <span style="font-weight:700;color:#374151;font-size:.8rem;">Word Builder</span>
                </button>
                <button id="btn-ttt" style="border:2px solid #e0e7ff;border-radius:14px;padding:16px 8px;background:#fff;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:6px;" onmouseover="this.style.borderColor='#6366f1';this.style.background='#f0f0ff'" onmouseout="this.style.borderColor='#e0e7ff';this.style.background='#fff'">
                    <span style="font-size:2rem;">❌⭕</span>
                    <span style="font-weight:700;color:#374151;font-size:.8rem;">Tic-Tac-Toe</span>
                </button>
            </div>
            <div style="width:100%;background:linear-gradient(135deg,#fef3c7,#fffbeb);border-radius:14px;padding:14px;border:1px solid #fde68a;">
                <div style="font-weight:800;color:#92400e;font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;">🏆 Global Leaderboard</div>
                <div style="display:flex;gap:6px;margin-bottom:10px;">
                    <button id="tab-snake" style="flex:1;padding:5px;border-radius:8px;border:none;background:#fde68a;font-weight:700;font-size:.75rem;color:#92400e;cursor:pointer;">Snake</button>
                    <button id="tab-word" style="flex:1;padding:5px;border-radius:8px;border:none;background:rgba(0,0,0,.06);font-weight:600;font-size:.75rem;color:#6b7280;cursor:pointer;">Word Builder</button>
                    <button id="tab-ttt" style="flex:1;padding:5px;border-radius:8px;border:none;background:rgba(0,0,0,.06);font-weight:600;font-size:.75rem;color:#6b7280;cursor:pointer;">Tic-Tac-Toe</button>
                </div>
                <div id="main-leaderboard-list" style="font-size:.85rem;color:#6b7280;"></div>
            </div>
        `;
        document.getElementById('btn-snake').onclick = initSnakeGame;
        document.getElementById('btn-word').onclick  = initWordGame;
        document.getElementById('btn-ttt').onclick   = initTTTGame;

        const tabs = [
            { id: 'tab-snake', game: 'Snake' },
            { id: 'tab-word',  game: 'Word Builder' },
            { id: 'tab-ttt',   game: 'Tic-Tac-Toe' }
        ];
        tabs.forEach(t => {
            document.getElementById(t.id).onclick = () => {
                tabs.forEach(tt => {
                    const b = document.getElementById(tt.id);
                    b.style.background = tt.id===t.id ? '#fde68a' : 'rgba(0,0,0,.06)';
                    b.style.color      = tt.id===t.id ? '#92400e' : '#6b7280';
                    b.style.fontWeight = tt.id===t.id ? '700' : '600';
                });
                fetchLeaderboard(t.game, 'main-leaderboard-list');
            };
        });
        fetchLeaderboard('Snake', 'main-leaderboard-list');
    }

    // ─── GAME OVER ────────────────────────────────────────────────────────────
    function showGameOver(finalScore, gameName) {
        stopCurrentGame();
        saveScore(finalScore, gameName);
        const container = document.getElementById('bk-game-container');
        container.innerHTML = `
            <div id="capture-area" style="background:#fff;padding:16px;border-radius:14px;text-align:center;width:100%;">
                <div style="width:70px;height:70px;background:linear-gradient(135deg,#eef2ff,#c7d2fe);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:2.5rem;">🏅</div>
                <h2 style="font-size:1.8rem;font-weight:900;color:#1e1b4b;margin-bottom:4px;">Game Over!</h2>
                <p style="color:#9ca3af;font-size:.8rem;margin-bottom:16px;">${new Date().toLocaleDateString()}</p>
                <div style="background:linear-gradient(135deg,#f0f0ff,#e0e7ff);border-radius:12px;padding:20px;margin-bottom:16px;">
                    <p style="color:#6366f1;text-transform:uppercase;font-size:.68rem;font-weight:800;letter-spacing:.08em;margin-bottom:4px;">Final Score</p>
                    <p style="font-size:3.5rem;font-weight:900;color:#4338ca;">${finalScore}</p>
                    <p style="color:#a5b4fc;font-size:.75rem;font-weight:600;">${gameName}</p>
                </div>
                <div style="text-align:left;margin-bottom:4px;">
                    <p style="font-size:.7rem;font-weight:800;color:#9ca3af;text-transform:uppercase;margin-bottom:8px;">Top Players</p>
                    <div id="mini-leaderboard" style="font-size:.85rem;"></div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;margin-top:12px;">
                <button id="btn-download-img" style="padding:12px;background:#1e293b;color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-size:.85rem;">📸 Save Image</button>
                <button id="btn-menu-back" style="padding:12px;background:#f1f5f9;color:#374151;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-size:.85rem;">← Menu</button>
            </div>
        `;
        fetchLeaderboard(gameName, 'mini-leaderboard');
        document.getElementById('btn-menu-back').onclick = showMainMenu;
        document.getElementById('btn-download-img').onclick = () => {
            const btn = document.getElementById('btn-download-img');
            btn.textContent = 'Generating...';
            if (typeof html2canvas === 'undefined') { alert('html2canvas not loaded.'); btn.textContent = '❌ Failed'; return; }
            html2canvas(document.getElementById('capture-area'), { scale: 2 }).then(canvas => {
                const link = document.createElement('a');
                link.download = `BK-Score-${finalScore}.jpg`;
                link.href = canvas.toDataURL('image/jpeg', 0.9);
                link.click();
                btn.textContent = '✅ Saved!';
            });
        };
    }

    // ─── SNAKE GAME ──────────────────────────────────────────────────────────
    function initSnakeGame() {
        const container = document.getElementById('bk-game-container');
        container.style.padding = '12px';
        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;width:100%;margin-bottom:8px;align-items:center;">
                <span style="font-weight:800;color:#374151;font-size:1.1rem;">Score: <span id="snake-score" style="color:#6366f1;">0</span></span>
                <span style="font-size:.72rem;background:#6366f1;color:#fff;padding:3px 10px;border-radius:999px;font-weight:700;">Arrows / Swipe</span>
            </div>
            <div style="position:relative;width:100%;max-width:340px;aspect-ratio:1;background:#f1f5f9;border-radius:14px;overflow:hidden;border:3px solid #e0e7ff;box-shadow:inset 0 2px 8px rgba(0,0,0,.06);">
                <canvas id="snake-canvas" width="400" height="400" style="width:100%;height:100%;"></canvas>
                <div id="mobile-controls" style="position:absolute;inset:0;z-index:10;opacity:0;"></div>
            </div>
        `;
        const canvas = document.getElementById('snake-canvas');
        const ctx = canvas.getContext('2d');
        const tileCount = 20;
        const gridSize = canvas.width / tileCount;
        state.score = 0;
        state.snake = [{x:10,y:10}];
        state.snakeDir = {x:0,y:0};
        state.snakeFood = {x:15,y:15};
        state.gameActive = true;

        document.onkeydown = e => {
            if (!state.gameActive) return;
            switch(e.key) {
                case 'ArrowLeft':  if(state.snakeDir.x!==1)  state.snakeDir={x:-1,y:0}; break;
                case 'ArrowUp':    if(state.snakeDir.y!==1)  state.snakeDir={x:0,y:-1}; break;
                case 'ArrowRight': if(state.snakeDir.x!==-1) state.snakeDir={x:1,y:0};  break;
                case 'ArrowDown':  if(state.snakeDir.y!==-1) state.snakeDir={x:0,y:1};  break;
            }
        };
        let tx=0,ty=0;
        const ta = document.getElementById('mobile-controls');
        ta.addEventListener('touchstart',e=>{tx=e.changedTouches[0].screenX;ty=e.changedTouches[0].screenY;},{passive:true});
        ta.addEventListener('touchend',e=>{
            e.preventDefault();
            const dx=e.changedTouches[0].screenX-tx, dy=e.changedTouches[0].screenY-ty;
            if(Math.abs(dx)>Math.abs(dy)){ if(dx>0&&state.snakeDir.x!==-1)state.snakeDir={x:1,y:0}; else if(dx<0&&state.snakeDir.x!==1)state.snakeDir={x:-1,y:0}; }
            else { if(dy>0&&state.snakeDir.y!==-1)state.snakeDir={x:0,y:1}; else if(dy<0&&state.snakeDir.y!==1)state.snakeDir={x:0,y:-1}; }
        },{passive:false});

        state.snakeInterval = setInterval(() => {
            if (!state.gameActive) return;
            const head = {x:state.snake[0].x+state.snakeDir.x, y:state.snake[0].y+state.snakeDir.y};
            if (head.x<0||head.x>=tileCount||head.y<0||head.y>=tileCount) { showGameOver(state.score,'Snake'); return; }
            for (const p of state.snake) { if(head.x===p.x&&head.y===p.y&&(state.snakeDir.x!==0||state.snakeDir.y!==0)){showGameOver(state.score,'Snake');return;} }
            state.snake.unshift(head);
            if(head.x===state.snakeFood.x&&head.y===state.snakeFood.y) {
                state.score+=10;
                document.getElementById('snake-score').innerText=state.score;
                state.snakeFood={x:Math.floor(Math.random()*tileCount),y:Math.floor(Math.random()*tileCount)};
            } else { state.snake.pop(); }
            ctx.fillStyle='#f8fafc'; ctx.fillRect(0,0,canvas.width,canvas.height);
            // Grid
            ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=0.5;
            for(let i=0;i<tileCount;i++){ctx.beginPath();ctx.moveTo(i*gridSize,0);ctx.lineTo(i*gridSize,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*gridSize);ctx.lineTo(canvas.width,i*gridSize);ctx.stroke();}
            // Food
            ctx.fillStyle='#ef4444'; ctx.beginPath(); ctx.arc(state.snakeFood.x*gridSize+gridSize/2,state.snakeFood.y*gridSize+gridSize/2,gridSize/2-2,0,2*Math.PI); ctx.fill();
            // Snake
            state.snake.forEach((p,i)=>{
                ctx.fillStyle=i===0?'#4338ca':'#6366f1';
                const r=gridSize-2;
                const x=p.x*gridSize+1,y=p.y*gridSize+1;
                ctx.beginPath(); ctx.roundRect(x,y,r,r,i===0?4:2); ctx.fill();
            });
        }, 150);
    }

    // ─── WORD BUILDER ─────────────────────────────────────────────────────────
    function initWordGame() {
        state.score=0; state.wordLevel=1; state.gameActive=true; state.validWordsFound=[]; generateLevel();
    }
    function generateLevel() {
        const roots=CONFIG.rootWords;
        state.targetWord=roots[Math.floor(Math.random()*roots.length)];
        state.wordTiles=state.targetWord.split('').sort(()=>Math.random()-.5);
        state.currentWord="";
        renderWordGameUI();
    }
    function renderWordGameUI() {
        const container=document.getElementById('bk-game-container');
        container.style.padding='12px';
        const tilesHTML=state.wordTiles.map((l,i)=>
            `<button style="width:42px;height:42px;background:linear-gradient(135deg,#eef2ff,#c7d2fe);color:#3730a3;font-weight:800;border-radius:10px;border:none;font-size:1.1rem;cursor:pointer;transition:all .15s;box-shadow:0 2px 4px rgba(0,0,0,.08);" class="word-tile" data-idx="${i}" data-letter="${l}" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">${l}</button>`
        ).join('');
        container.innerHTML=`
            <div style="display:flex;justify-content:space-between;width:100%;margin-bottom:12px;">
                <div><div style="font-size:.68rem;color:#9ca3af;font-weight:700;text-transform:uppercase;">Level ${state.wordLevel}</div><div style="font-weight:800;color:#374151;font-size:1.1rem;">Score: <span id="word-score" style="color:#6366f1;">${state.score}</span></div></div>
                <button id="end-word-game" style="font-size:.75rem;color:#ef4444;background:#fef2f2;border:none;padding:4px 12px;border-radius:999px;cursor:pointer;font-weight:700;">End Game</button>
            </div>
            <div style="width:100%;background:linear-gradient(135deg,#f0f0ff,#e0e7ff);border-radius:12px;height:70px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;position:relative;border:2px solid #c7d2fe;">
                <span id="current-word-display" style="font-size:2.2rem;font-weight:900;color:#3730a3;letter-spacing:.1em;"></span>
                <span style="position:absolute;top:6px;right:10px;font-size:.65rem;color:#a5b4fc;font-weight:700;">Target: ${state.targetWord.length} letters</span>
            </div>
            <p id="word-feedback" style="height:22px;margin-bottom:10px;font-size:.85rem;font-weight:700;text-align:center;opacity:0;transition:opacity .3s;"></p>
            <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-bottom:16px;" id="tile-rack">${tilesHTML}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 2fr;gap:8px;width:100%;">
                <button id="btn-shuffle" style="padding:12px;background:#fef3c7;color:#92400e;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-size:1rem;" title="Shuffle">🔀</button>
                <button id="btn-clear" style="padding:12px;background:#f1f5f9;color:#374151;border:none;border-radius:12px;font-weight:700;cursor:pointer;">Clear</button>
                <button id="btn-submit" style="padding:12px;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,.4);">Submit ✓</button>
            </div>
        `;
        document.querySelectorAll('.word-tile').forEach(btn=>{
            btn.onclick=function(){
                if(this.style.opacity==='0.35')return;
                state.currentWord+=this.getAttribute('data-letter');
                this.style.opacity='0.35'; this.style.cursor='default';
                document.getElementById('current-word-display').innerText=state.currentWord;
            };
        });
        document.getElementById('btn-clear').onclick=resetTiles;
        document.getElementById('btn-shuffle').onclick=shuffleTiles;
        document.getElementById('btn-submit').onclick=submitWord;
        document.getElementById('end-word-game').onclick=()=>showGameOver(state.score,'Word Builder');
    }
    function resetTiles(){ state.currentWord=""; document.getElementById('current-word-display').innerText=""; document.querySelectorAll('.word-tile').forEach(b=>{b.style.opacity='1';b.style.cursor='pointer';}); }
    function shuffleTiles(){ resetTiles(); state.wordTiles.sort(()=>Math.random()-.5); renderWordGameUI(); }
    function submitWord() {
        const fb=document.getElementById('word-feedback'), w=state.currentWord;
        if(!w){return;}
        fb.style.opacity='1';
        if(state.validWordsFound.includes(w)){ fb.style.color='#f59e0b'; fb.textContent='Already found!'; setTimeout(()=>{resetTiles();fb.style.opacity='0';},800); return; }
        if(w===state.targetWord){ const pts=w.length*50; state.score+=pts; state.wordLevel++; fb.style.color='#7c3aed'; fb.textContent=`🎉 BINGO! Level Up! +${pts}`; document.getElementById('word-score').innerText=state.score; setTimeout(()=>{state.validWordsFound=[];generateLevel();},1500); return; }
        if(CONFIG.dictionary.includes(w)||CONFIG.rootWords.includes(w)){ const pts=w.length*10; state.score+=pts; state.validWordsFound.push(w); fb.style.color='#16a34a'; fb.textContent=`✓ Good! +${pts}`; document.getElementById('word-score').innerText=state.score; }
        else { fb.style.color='#ef4444'; fb.textContent='Not in dictionary'; }
        setTimeout(()=>{resetTiles();setTimeout(()=>fb.style.opacity='0',1000);},500);
    }

    // ─── TIC-TAC-TOE ─────────────────────────────────────────────────────────
    function initTTTGame() {
        state.tttBoard=Array(9).fill(null); state.tttTurn='X'; state.tttScores={X:0,O:0,draws:0}; state.gameActive=true;
        renderTTT();
    }
    function renderTTT(winLine=null) {
        const container=document.getElementById('bk-game-container');
        container.style.padding='16px';
        const b=state.tttBoard;
        const sc=state.tttScores;
        const WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

        container.innerHTML=`
            <div style="width:100%;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                    <div style="display:flex;gap:8px;">
                        <label style="display:flex;align-items:center;gap:5px;font-size:.78rem;font-weight:600;color:#374151;cursor:pointer;">
                            <input type="radio" name="ttt-mode" value="ai" ${state.tttVsAI?'checked':''} style="accent-color:#6366f1;"> vs AI
                        </label>
                        <label style="display:flex;align-items:center;gap:5px;font-size:.78rem;font-weight:600;color:#374151;cursor:pointer;">
                            <input type="radio" name="ttt-mode" value="human" ${!state.tttVsAI?'checked':''} style="accent-color:#6366f1;"> vs Friend
                        </label>
                    </div>
                    <button id="ttt-menu" style="font-size:.75rem;color:#6b7280;background:#f1f5f9;border:none;padding:4px 12px;border-radius:999px;cursor:pointer;font-weight:700;">← Menu</button>
                </div>
                <!-- Scoreboard -->
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:14px;">
                    <div style="text-align:center;background:linear-gradient(135deg,#fef3c7,#fef9c3);border-radius:10px;padding:8px;border:1.5px solid ${state.tttTurn==='X'&&!winLine?'#f59e0b':'#fde68a'};">
                        <div style="font-size:1.3rem;font-weight:900;color:#d97706;">✕</div>
                        <div style="font-size:1.1rem;font-weight:800;color:#92400e;">${sc.X}</div>
                        <div style="font-size:.65rem;color:#a16207;font-weight:600;">YOU</div>
                    </div>
                    <div style="text-align:center;background:#f8fafc;border-radius:10px;padding:8px;border:1.5px solid #e2e8f0;">
                        <div style="font-size:1.1rem;font-weight:700;color:#6b7280;">🤝</div>
                        <div style="font-size:1.1rem;font-weight:800;color:#374151;">${sc.draws}</div>
                        <div style="font-size:.65rem;color:#9ca3af;font-weight:600;">DRAWS</div>
                    </div>
                    <div style="text-align:center;background:linear-gradient(135deg,#ede9fe,#e0e7ff);border-radius:10px;padding:8px;border:1.5px solid ${state.tttTurn==='O'&&!winLine?'#8b5cf6':'#ddd6fe'};">
                        <div style="font-size:1.3rem;font-weight:900;color:#7c3aed;">⭕</div>
                        <div style="font-size:1.1rem;font-weight:800;color:#5b21b6;">${sc.O}</div>
                        <div style="font-size:.65rem;color:#6d28d9;font-weight:600;">${state.tttVsAI?'AI':'FRIEND'}</div>
                    </div>
                </div>
                <!-- Turn indicator -->
                <div id="ttt-status" style="text-align:center;font-weight:800;font-size:.9rem;margin-bottom:12px;padding:8px;border-radius:10px;background:${winLine?'linear-gradient(135deg,#d1fae5,#ecfdf5)':'#f0f0ff'};color:${winLine?'#065f46':'#3730a3'};">
                    ${winLine ? (tttCheckWinner(b)?`🏆 ${b[winLine[0]]==='X'?'You win!':'AI/Friend wins!'}`:'🤝 It\'s a draw!') : `${state.tttTurn==='X'?'Your turn (✕)':'AI/Friend turn (⭕)'}`}
                </div>
                <!-- Board -->
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">
                    ${b.map((cell,i)=>{
                        const isWin=winLine&&winLine.includes(i);
                        const c=cell==='X'?'#d97706':cell==='O'?'#7c3aed':'transparent';
                        const bg=isWin?(cell==='X'?'linear-gradient(135deg,#fde68a,#fbbf24)':'linear-gradient(135deg,#ddd6fe,#c4b5fd)'):cell?'#f8fafc':'#fff';
                        return `<button class="ttt-cell" data-idx="${i}" style="aspect-ratio:1;border-radius:14px;border:2px solid ${isWin?(cell==='X'?'#f59e0b':'#8b5cf6'):cell?'#e2e8f0':'#e0e7ff'};background:${bg};font-size:1.8rem;font-weight:900;color:${c};cursor:${cell||winLine?'default':'pointer'};box-shadow:${isWin?'0 0 0 3px '+(cell==='X'?'rgba(245,158,11,.3)':'rgba(139,92,246,.3)'):'0 2px 4px rgba(0,0,0,.04)'};transition:all .15s;" onmouseover="${!cell&&!winLine?`this.style.background='#f0f0ff';this.style.borderColor='#c7d2fe'`:''}" onmouseout="${!cell&&!winLine?`this.style.background='#fff';this.style.borderColor='#e0e7ff'`:''}">${cell==='X'?'✕':cell==='O'?'⭕':''}</button>`;
                    }).join('')}
                </div>
                <button id="ttt-reset" style="width:100%;padding:12px;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-size:.9rem;box-shadow:0 4px 14px rgba(99,102,241,.3);">🔄 New Game</button>
            </div>
        `;

        document.querySelectorAll('input[name="ttt-mode"]').forEach(r=>{
            r.onchange=()=>{ state.tttVsAI=r.value==='ai'; state.tttBoard=Array(9).fill(null); state.tttTurn='X'; renderTTT(); };
        });
        document.getElementById('ttt-menu').onclick=()=>{state.gameActive=false;showMainMenu();};
        document.getElementById('ttt-reset').onclick=()=>{ state.tttBoard=Array(9).fill(null); state.tttTurn='X'; renderTTT(); };

        if (!winLine) {
            document.querySelectorAll('.ttt-cell').forEach(btn=>{
                btn.onclick=()=>{ tttMove(parseInt(btn.dataset.idx)); };
            });
        }
    }
    function tttMove(idx) {
        const b=state.tttBoard;
        if(b[idx]||!state.gameActive)return;
        b[idx]=state.tttTurn;
        const winner=tttCheckWinner(b);
        const draw=!winner&&b.every(c=>c);
        if(winner){
            const WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
            const line=WINS.find(w=>b[w[0]]&&b[w[0]]===b[w[1]]&&b[w[0]]===b[w[2]]);
            state.tttScores[state.tttTurn]++;
            if(state.tttTurn==='X') saveScore(state.tttScores.X,'Tic-Tac-Toe');
            renderTTT(line); return;
        }
        if(draw){ state.tttScores.draws++; renderTTT('draw'); return; }
        state.tttTurn=state.tttTurn==='X'?'O':'X';
        renderTTT();
        if(state.tttVsAI&&state.tttTurn==='O') setTimeout(tttAIMove,400);
    }
    function tttAIMove() {
        const b=state.tttBoard;
        if(!state.gameActive)return;
        // Try to win, then block, then center, then random
        const WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        function findMove(player){ for(const[a,c,d]of WINS){ if(b[a]===player&&b[c]===player&&!b[d])return d; if(b[a]===player&&!b[c]&&b[d]===player)return c; if(!b[a]&&b[c]===player&&b[d]===player)return a; } return -1; }
        let move=findMove('O'); if(move===-1)move=findMove('X'); if(move===-1&&!b[4])move=4;
        if(move===-1){ const empty=b.map((c,i)=>c?-1:i).filter(i=>i>=0); move=empty[Math.floor(Math.random()*empty.length)]; }
        if(move>=0&&move<9) tttMove(move);
    }
    function tttCheckWinner(b) {
        const WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        return WINS.some(([a,c,d])=>b[a]&&b[a]===b[c]&&b[a]===b[d]);
    }

    // ─── STOP ─────────────────────────────────────────────────────────────────
    function stopCurrentGame() {
        state.gameActive=false;
        if(state.snakeInterval){ clearInterval(state.snakeInterval); state.snakeInterval=null; }
        document.onkeydown=null;
    }

    // ─── FIREBASE (modular SDK via window.db) ─────────────────────────────────
    async function saveScore(score, gameName) {
        const firesDb = window.db;
        if (!firesDb) return;
        const name = window.tutorData?.name || state.currentUser.name || 'Guest';
        const uid  = window.tutorData?.id   || state.currentUser.id  || 'guest';
        const scoreData = { userId:uid, userName:name, game:gameName, score, timestamp:new Date() };
        try {
            // Use modular SDK methods if available, fall back to compat
            if (window.__fbAddDoc && window.__fbCollection) {
                await window.__fbAddDoc(window.__fbCollection(firesDb,'leaderboard'), scoreData);
            } else if (firesDb.collection) {
                await firesDb.collection('leaderboard').add(scoreData);
            }
        } catch(e){ console.warn('Score save:', e.message); }
    }

    async function fetchLeaderboard(gameName, elementId) {
        const listEl=document.getElementById(elementId);
        if(!listEl)return;
        listEl.innerHTML='<p style="color:#9ca3af;text-align:center;font-style:italic;font-size:.8rem;">Loading...</p>';
        const firesDb=window.db;
        if(!firesDb){ listEl.innerHTML='<p style="color:#d1d5db;font-size:.75rem;text-align:center;">Offline</p>'; return; }
        try {
            let snap;
            if(window.__fbGetDocs&&window.__fbQuery&&window.__fbCollection&&window.__fbWhere&&window.__fbOrderBy&&window.__fbLimit){
                snap=await window.__fbGetDocs(window.__fbQuery(window.__fbCollection(firesDb,'leaderboard'),window.__fbWhere('game','==',gameName),window.__fbOrderBy('score','desc'),window.__fbLimit(3)));
            } else if(firesDb.collection){
                snap=await firesDb.collection('leaderboard').where('game','==',gameName).orderBy('score','desc').limit(3).get();
            } else { listEl.innerHTML='<p style="color:#d1d5db;font-size:.75rem;text-align:center;">Unavailable</p>'; return; }
            let html=''; let rank=1;
            const docs=snap.docs||[];
            docs.forEach(d=>{ const dat=d.data(); const medal=rank===1?'🥇':rank===2?'🥈':'🥉';
                html+=`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-radius:8px;background:${rank===1?'linear-gradient(135deg,#fef3c7,#fef9c3)':'#f8fafc'};margin-bottom:4px;"><span style="font-weight:700;color:${rank===1?'#92400e':'#374151'};display:flex;align-items:center;gap:6px;font-size:.82rem;"><span>${medal}</span>${escG(dat.userName)}</span><span style="font-weight:800;color:#6366f1;font-size:.9rem;">${dat.score}</span></div>`;
                rank++; });
            listEl.innerHTML=html||'<p style="color:#9ca3af;font-size:.8rem;text-align:center;font-style:italic;">No scores yet.</p>';
        } catch(e){
            listEl.innerHTML=e.code==='failed-precondition'?'<p style="color:#ef4444;font-size:.72rem;text-align:center;">Create Firestore index</p>':'<p style="color:#d1d5db;font-size:.72rem;text-align:center;">Offline</p>';
        }
    }

    function escG(s){ if(!s)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    // ─── EXPOSE FIREBASE METHODS FROM TUTOR.JS ───────────────────────────────
    // tutor.js imports these as ES module — we bridge them for games.js
    function bridgeFirebase() {
        try {
            // These are exposed in firebaseConfig.js / tutor.js global scope if set
            if (!window.__fbCollection && typeof collection !== 'undefined') window.__fbCollection = collection;
            if (!window.__fbAddDoc   && typeof addDoc    !== 'undefined') window.__fbAddDoc    = addDoc;
            if (!window.__fbGetDocs  && typeof getDocs   !== 'undefined') window.__fbGetDocs   = getDocs;
            if (!window.__fbQuery    && typeof query     !== 'undefined') window.__fbQuery     = query;
            if (!window.__fbWhere    && typeof where     !== 'undefined') window.__fbWhere     = where;
            if (!window.__fbOrderBy  && typeof orderBy   !== 'undefined') window.__fbOrderBy   = orderBy;
            if (!window.__fbLimit    && typeof limit     !== 'undefined') window.__fbLimit     = limit;
        } catch(e){}
    }

    window.addEventListener('load', () => {
        bridgeFirebase();
        // Retry bridge after tutor.js module loads
        setTimeout(bridgeFirebase, 2000);
        initWidget();
    });

})();
