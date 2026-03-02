/**
 * BLOOMING KIDS TUTOR PORTAL — GAME WIDGET V8
 * Fixes: Firebase online (limit imported), Top-5 leaderboard all games,
 *        Tutor-vs-Tutor TTT via Firestore real-time, search in game/recipient pickers,
 *        Full-screen grading new tab with annotation, canvas drawing tools.
 */

(function () {
    /* ── word lists ─────────────────────────────────── */
    const DICT = ["THE","AND","FOR","ARE","BUT","NOT","YOU","ALL","ANY","CAN","HAD","HAS","HIM","HIS","HER","ITS","ONE","TWO","NEW","OUR","OUT","SEE","WAY","WHO","BOY","DID","LET","PUT","SAY","SHE","TOO","USE","DAD","MOM","CAT","DOG","RUN","EAT","BIG","RED","YES","LOW","KEY","BED","WIN","TOP","JOY","SKY","GAME","PLAY","READ","BOOK","KIDS","CODE","MATH","TEST","EXAM","PASS","WORK","GOOD","BEST","LOVE","HELP","GROW","MIND","WORD","LIST","TYPE","TEXT","VIEW","MENU","USER","TIME","DATA","QUIZ","SOUL","BRAIN","SMART","THINK","CLASS","STUDY","LEARN","WRITE","START","STOP","OPEN","CLOSE","NEXT","BACK","HOME","SAVE","FIND","LOOK","MAKE","KNOW","TAKE","YEAR","ROOM","DOOR","GIRL","DONE","HIGH","NAME","NOTE","IDEA","HARD","EASY","BLUE","BALL","BIRD","BOAT","BONE","CAKE","CALL","CARD","CARE","CITY","CLUB","COOK","COOL","DATE","DEEP","DESK","DROP","DUCK","DUST","FACE","FACT","FARM","FAST","FILE","FIRE","FISH","FLAG","FOOD","FOOT","FORM","FREE","FROG","FULL","GIFT","GIVE","GLAD","GOAL","GOLD","HAIR","HALF","HALL","HAND","HEAD","HEAR","HEAT","HILL","HOLD","HOLE","HOPE","HOUR","HURT","ITEM","JOIN","JUMP","JUST","KEEP","KIND","KING","KISS","KNEE","LADY","LAKE","LAND","LAST","LATE","LEAD","LEFT","LESS","LINE","LION","LONG","LOST","LUCK","MAIN","MARK","MEAL","MEET","MILE","MILK","MISS","MOON","MOVE","NEAR","NECK","NEED","NEWS","NICE","NOSE","ONCE","PACK","PAGE","PAIN","PAIR","PARK","PART","PAST","PATH","PICK","PLAN","POOR","POST","PULL","PUSH","RACE","RAIN","RARE","REAL","REST","RICH","RIDE","RING","RISE","RISK","ROAD","ROCK","ROLE","ROOF","ROOT","ROPE","ROSE","RULE","SAFE","SALT","SAND","SEAT","SEED","SELL","SEND","SHIP","SHOE","SHOP","SHOT","SHOW","SHUT","SICK","SIDE","SIGN","SING","SIZE","SKIN","SLOW","SNOW","SOFT","SOIL","SONG","SOON","SORT","SOUP","SPOT","STAR","STAY","STEP","SUCH","SURE","SWIM","TAIL","TALK","TALL","TEAM","TELL","TENT","TERM","TICK","TIDE","TILL","TINY","TOWN","TREE","TRIP","TURN","UNIT","UPON","VOTE","WAIT","WALK","WALL","WANT","WARM","WASH","WAVE","WEAR","WEEK","WELL","WENT","WERE","WEST","WILD","WILL","WIND","WISH","WITH","WOOD","YARD","ZERO","ZONE","ABOUT","ABOVE","ACTOR","ADMIT","ADULT","AFTER","AGAIN","AGENT","AGREE","AHEAD","ALARM","ALBUM","ALERT","ALIVE","ALLOW","ALONE","ALONG","AMONG","ANGER","ANGLE","ANGRY","APPLE","APPLY","ARGUE","ASIDE","AUDIO","AVOID","AWARD","AWARE","BADLY","BASES","BASIC","BEACH","BEGAN","BEGIN","BEING","BELOW","BENCH","BIRTH","BLACK","BLAME","BLIND","BLOCK","BLOOD","BOARD","BOOST","BOUND","BRAND","BREAD","BREAK","BRIEF","BRING","BROKE","BROWN","BUILD","BUILT","CHAIN","CHAIR","CHART","CHASE","CHEAP","CHECK","CHEST","CHIEF","CHILD","CHOSE","CIVIL","CLAIM","CLEAN","CLEAR","CLICK","CLOCK","CLOSE","COAST","COUNT","COURT","COVER","CRASH","CREAM","CRIME","CROSS","CROWD","CROWN","CYCLE","DAILY","DANCE","DEATH","DOUBT","DOZEN","DRAFT","DRAMA","DRAWN","DREAM","DRESS","DRINK","DRIVE","DYING","EAGER","EARLY","EARTH","EIGHT","ELITE","EMPTY","ENEMY","ENJOY","ENTER","EQUAL","ERROR","EVENT","EXACT","EXIST","EXTRA","FAITH","FALSE","FAULT","FIELD","FIFTH","FIFTY","FIGHT","FINAL","FIRST","FIXED","FLASH","FLOOR","FOCUS","FORCE","FORTH","FORTY","FOUND","FRAME","FRAUD","FRESH","FRONT","FRUIT","FULLY","FUNNY","GIANT","GIVEN","GLASS","GLOBE","GRACE","GRADE","GRAND","GRANT","GRASS","GREAT","GREEN","GROUP","GROWN","GUARD","GUESS","GUEST","GUIDE","HAPPY","HEART","HEAVY","HORSE","HOTEL","HOUSE","HUMAN","IDEAL","IMAGE","INDEX","INNER","INPUT","ISSUE","JOINT","JUDGE","KNOWN","LABEL","LARGE","LASER","LATER","LAYER","LEGAL","LEVEL","LIGHT","LIMIT","LIVES","LOCAL","LOGIC","LOWER","LUCKY","LUNCH","MAGIC","MAJOR","MAKER","MARCH","MATCH","MAYBE","MAYOR","MEDIA","METAL","MINOR","MODEL","MONEY","MONTH","MOTOR","MOUSE","MOUTH","MOVIE","MUSIC","NEEDS","NIGHT","NORTH","NOVEL","NURSE","OCEAN","OFFER","OFTEN","ORDER","OTHER","PAINT","PAPER","PARTY","PEACE","PHASE","PHONE","PHOTO","PIECE","PILOT","PITCH","PLACE","PLANE","PLANT","PLATE","POINT","POWER","PRESS","PRICE","PRIDE","PRIME","PRIOR","PRIZE","PROOF","PROUD","QUEEN","QUICK","QUIET","QUITE","RADIO","RAISE","RANGE","RAPID","REACH","READY","RIGHT","RIVER","ROUGH","ROUND","ROUTE","RURAL","SCALE","SCENE","SCORE","SENSE","SERVE","SEVEN","SHAPE","SHARE","SHARP","SHELF","SHIFT","SHOCK","SHORT","SIGHT","SINCE","SIXTH","SIXTY","SKILL","SLEEP","SLIDE","SMALL","SMART","SMILE","SMOKE","SOLID","SORRY","SOUND","SOUTH","SPACE","SPEAK","SPEED","SPEND","SPLIT","SPORT","STAFF","STAGE","STAND","STATE","STEEL","STICK","STILL","STOCK","STONE","STORE","STORM","STORY","STUCK","STUDY","STUFF","STYLE","SUGAR","SUITE","SUPER","SWEET","TABLE","TAKEN","TASTE","TEACH","TEETH","THANK","THEIR","THEME","THERE","THESE","THICK","THING","THINK","THIRD","THREE","THROW","TIGHT","TIMES","TIRED","TITLE","TODAY","TOPIC","TOTAL","TOUCH","TOWER","TRACK","TRADE","TRAIN","TREAT","TREND","TRIAL","TRIED","TRUCK","TRULY","TRUST","TRUTH","TWICE","UNDER","UNION","UNITY","UNTIL","UPPER","URBAN","USUAL","VALID","VALUE","VIDEO","VIRUS","VISIT","VITAL","VOICE","WASTE","WATCH","WATER","WHEEL","WHILE","WHITE","WHOLE","WOMAN","WORLD","WORRY","WORSE","WOULD","WRITE","WRONG","YIELD","YOUNG","YOUTH","ACTION","ALWAYS","ANIMAL","ANSWER","ANYONE","APPEAR","ARTIST","BECOME","BEFORE","BEHIND","BELIEF","BETTER","BOTTLE","BOTTOM","BRANCH","BREATH","BRIDGE","BRIGHT","BROKEN","BUDGET","BUTTON","CAMERA","CANNOT","CAREER","CASTLE","CAUGHT","CENTER","CHANCE","CHANGE","CHARGE","CHOICE","CHURCH","CLIENT","COFFEE","COLUMN","COMBAT","COMING","COMMON","CORNER","COUPLE","COURSE","CREATE","CREDIT","CRISIS","CUSTOM","DAMAGE","DANGER","DEALER","DEBATE","DECIDE","DEFEAT","DEGREE","DEMAND","DEPEND","DESIGN","DESIRE","DETAIL","DEVICE","DINNER","DIRECT","DOCTOR","DOLLAR","DOUBLE","DRIVEN","EASILY","EATING","EDITOR","EFFECT","EFFORT","ELEVEN","EMERGE","EMPIRE","EMPLOY","ENERGY","ENGAGE","ENGINE","ENSURE","ENTIRE","ENTITY","ESCAPE","ESTATE","EXCEED","EXCEPT","EXPAND","EXPECT","EXPERT","EXTEND","FABRIC","FACTOR","FAMILY","FAMOUS","FATHER","FELLOW","FEMALE","FIGURE","FINGER","FINISH","FLYING","FOLLOW","FORCED","FOREST","FORGET","FORMAL","FORMAT","FORMER","FOSTER","FRENCH","FRIEND","FUTURE","GARDEN","GATHER","GENDER","GLOBAL","GOLDEN","GROUND","GROWTH","GUILTY","HANDLE","HAPPEN","HEADED","HEALTH","HEIGHT","HIDDEN","HOLDER","HONEST","IMPACT","INCOME","INSIDE","INTEND","INVEST","ISLAND","ITSELF","KILLED","LATEST","LAUNCH","LAWYER","LEADER","LEAGUE","LEAVES","LEGACY","LENGTH","LESSON","LETTER","LIKELY","LINKED","LISTEN","LITTLE","LIVING","LOCATE","LONELY","LOSING","LOVELY","LUXURY","MAINLY","MAKING","MANAGE","MANNER","MANUAL","MARKET","MASTER","MATTER","MATURE","MEDIUM","MEMBER","MEMORY","MENTAL","MERELY","METHOD","MINUTE","MIRROR","MOBILE","MODERN","MODEST","MOMENT","MOTHER","MOTION","MOVING","MUSEUM","MYSELF","NARROW","NATION","NATIVE","NATURE","NEARLY","NEEDED","NOBODY","NORMAL","NOTICE","NOTION","NUMBER","OBTAIN","OFFICE","ONLINE","OPTION","ORIGIN","OUTPUT","PARENT","PARTLY","PEOPLE","PERIOD","PERMIT","PERSON","PHRASE","PLANET","PLAYER","PLEASE","PLENTY","POCKET","POLICE","POLICY","PREFER","PRETTY","PRINCE","PRISON","PROFIT","PROPER","PUBLIC","PURSUE","RAISED","RARELY","RATHER","RATING","READER","REASON","RECALL","RECENT","RECORD","REDUCE","REFORM","REGION","RELATE","RELIEF","REMAIN","REMOTE","REMOVE","REPEAT","REPORT","RESCUE","RESULT","RETAIL","RETAIN","RETURN","REVEAL","REVIEW","RIDING","RISING","SAFETY","SALARY","SAVING","SCHEME","SCHOOL","SCREEN","SEARCH","SEASON","SECOND","SECRET","SECTOR","SECURE","SELECT","SELLER","SENIOR","SERIES","SERVER","SETTLE","SEVERE","SHOULD","SIGNAL","SILENT","SILVER","SIMPLE","SINGLE","SISTER","SMOOTH","SOURCE","SPEECH","SPIRIT","SPREAD","SPRING","SQUARE","STABLE","STATUS","STEADY","STRAIN","STREAM","STREET","STRESS","STRICT","STRIKE","STRONG","STUDIO","SUBMIT","SUDDEN","SUFFER","SUMMER","SUPPLY","SURELY","SURVEY","SWITCH","SYMBOL","SYSTEM","TAKING","TALENT","TARGET","TAUGHT","THANKS","THEORY","THOUGH","THREAT","TICKET","TIMING","TONGUE","TOWARD","TRADER","TRAVEL","TREATY","TRYING","TWELVE","TWENTY","UNABLE","UNIQUE","UNITED","UNLESS","UNLIKE","UPDATE","USEFUL","VALLEY","VENDOR","VERSUS","VICTIM","VISION","VISUAL","VOLUME","WALKER","WEALTH","WEEKLY","WEIGHT","WINDOW","WINNER","WINTER","WITHIN","WONDER","WORKER","WRITER","YELLOW"];
    const ROOTS = ["PUZZLE","JUNGLE","PLANET","WIDGET","GAMING","CODING","WINNER","ORANGE","FAMILY","SCHOOL","TUTOR","PORTAL","SUMMER","WINTER","GARDEN","DOCTOR","DRIVER","FRIEND","SYSTEM","ONLINE","NUMBER","PEOPLE","GLOBAL","ACTION","BUTTON","OFFICE","MARKET","HEALTH","PERSON","POLICY","SERIES","RESULT","CHANGE","FUTURE","PUBLIC","THEORY","ENERGY","DESIGN","SOURCE","PERIOD","CHANCE","AMOUNT","GROWTH","INCOME","MEMBER","LEADER","SAFETY","GROUND","LETTER","WEIGHT","AGENCY","MEMORY","BUDGET","CREDIT","IMPACT","STATUS","MOTION","SPEECH","ISLAND","STUDIO","CAMERA","DAMAGE","LENGTH","OUTPUT","FATHER","MOTHER","PARENT","STREET","RECORD","FOREST","SEASON","SPIRIT","WEALTH","BRANCH","DEGREE","CORNER","SCREEN","WINDOW","VALLEY","WRITER","TARGET","PRISON","BRIDGE","SWITCH","DETAIL","NATURE","CAREER","LEGACY","PROFIT","SILVER","CLIENT","SIGNAL","MASTER"];

    /* ── state ───────────────────────────────────────── */
    let state = {
        score: 0, gameActive: false,
        snake: [], snakeDir:{x:0,y:0}, snakeInterval:null, snakeFood:{x:15,y:15},
        currentUser:{name:'Tutor', id:null, email:null},
        wordLevel:1, targetWord:'', wordTiles:[], currentWord:'', validWordsFound:[],
        tttBoard: Array(9).fill(null), tttTurn:'X',
        tttScores:{X:0,O:0,draws:0},
        tttMode:'ai', // 'ai' | 'online'
        tttGameId: null,
        tttMyMark: 'X',
        tttOpponentName: 'Opponent',
        tttUnsub: null,
        tttTutors: [],
        wordGameId: null,
        wordMyRole: null,
        wordUnsub: null,
        pendingChallenges: 0
    };

    /* ── Firebase helpers (uses modular SDK bridged from tutor.js) ─────────── */
    function db()  { return window.db || null; }
    function C()   { return window.__fbCollection; }
    function AD()  { return window.__fbAddDoc; }
    function GD()  { return window.__fbGetDocs; }
    function Q()   { return window.__fbQuery; }
    function W()   { return window.__fbWhere; }
    function OB()  { return window.__fbOrderBy; }
    function LIM() { return window.__fbLimit; }
    function SN()  { return window.__fbOnSnapshot || window.onSnapshot; }
    function DC()  { return window.__fbDoc; }
    function SD()  { return window.__fbSetDoc; }
    function UD()  { return window.__fbUpdateDoc; }

    /* ── widget init ─────────────────────────────────── */
    function initWidget() {
        if (window.tutorData) {
            state.currentUser.name  = window.tutorData.displayName || window.tutorData.name  || 'Tutor';
            state.currentUser.id    = window.tutorData.id    || null;
            state.currentUser.email = window.tutorData.email || null;
        }

        // Floating button
        const btn = document.createElement('button');
        btn.id = 'bk-game-floater';
        btn.style.cssText = 'position:fixed;bottom:155px;right:20px;z-index:99999;width:52px;height:52px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(145deg,#f59e0b,#d97706);color:#fff;box-shadow:0 8px 24px rgba(245,158,11,.45),0 0 0 3px rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;transition:all .22s cubic-bezier(.22,1,.36,1);';
        btn.title = 'Arcade Games';
        btn.textContent = '🎮';
        btn.onmouseover = () => { btn.style.transform='scale(1.12) translateY(-3px)'; btn.style.boxShadow='0 14px 36px rgba(245,158,11,.55),0 0 0 3px rgba(255,255,255,.35)'; };
        btn.onmouseout  = () => { btn.style.transform=''; btn.style.boxShadow='0 8px 24px rgba(245,158,11,.45),0 0 0 3px rgba(255,255,255,.3)'; };
        btn.onclick = openModal;
        document.body.appendChild(btn);

        // Challenge badge style
        if (!document.getElementById('bk-game-badge-style')) {
            const st = document.createElement('style');
            st.id = 'bk-game-badge-style';
            st.textContent = `
                #bk-game-challenge-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;background:#ef4444;color:#fff;border-radius:9999px;font-size:.65rem;font-weight:900;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff;animation:bkBadgePulse 1.5s ease-in-out infinite;pointer-events:none;}
                @keyframes bkBadgePulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.6)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}
            `;
            document.head.appendChild(st);
        }

        // Modal
        const modal = document.createElement('div');
        modal.id = 'bk-game-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,.88);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:16px;';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:22px;box-shadow:0 32px 80px rgba(0,0,0,.5);width:100%;max-width:460px;overflow:hidden;position:relative;">
                <div style="background:linear-gradient(135deg,#1e1b4b,#3730a3,#1e3a8a);padding:18px 22px;display:flex;align-items:center;justify-content:space-between;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:42px;height:42px;background:rgba(255,255,255,.15);border-radius:12px;border:1.5px solid rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">🎮</div>
                        <div>
                            <div style="color:#fff;font-weight:900;font-size:1rem;">Arcade Mode</div>
                            <div style="color:#a5b4fc;font-size:.68rem;margin-top:1px;">Play, compete, unwind</div>
                        </div>
                    </div>
                    <button id="bk-close-btn" style="background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.2);color:#fff;width:34px;height:34px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
                </div>
                <div id="bk-game-container" style="padding:20px;min-height:440px;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow-y:auto;max-height:70vh;"></div>
            </div>`;
        document.body.appendChild(modal);
        document.getElementById('bk-close-btn').onclick = closeModal;
        modal.addEventListener('click', e => { if (e.target===modal) closeModal(); });
    }

    function updateGameFloaterBadge(count) {
        const btn = document.getElementById('bk-game-floater');
        if (!btn) return;
        let badge = document.getElementById('bk-game-challenge-badge');
        if (count > 0) {
            if (!badge) { badge = document.createElement('span'); badge.id = 'bk-game-challenge-badge'; btn.appendChild(badge); }
            badge.textContent = count > 9 ? '9+' : count;
        } else {
            if (badge) badge.remove();
        }
    }

    function playChallengeTone() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const notes = [523, 659, 784]; // C5, E5, G5
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25);
                osc.start(ctx.currentTime + i * 0.12);
                osc.stop(ctx.currentTime + i * 0.12 + 0.28);
            });
        } catch(e) {}
    }

    function triggerConfetti() {
        if (typeof confetti === 'function') {
            confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#6366f1','#f59e0b','#10b981','#f43f5e','#8b5cf6'] });
            setTimeout(() => confetti({ particleCount: 60, spread: 55, origin: { y: 0.5 }, colors: ['#6366f1','#fbbf24','#34d399'] }), 400);
        }
    }

    function openModal()  { document.getElementById('bk-game-modal').style.display='flex'; showMainMenu(); }
    function closeModal() {
        stopAll();
        const m = document.getElementById('bk-game-modal');
        if (m) m.style.display='none';
    }

    /* ── MAIN MENU ───────────────────────────────────── */
    function showMainMenu() {
        const firstName = (state.currentUser.name||'').split(' ')[0] || 'Tutor';
        const c = container();
        c.innerHTML = `
            <h2 style="font-size:1.25rem;font-weight:900;color:#1e1b4b;margin-bottom:4px;text-align:center;">Hey, ${esc(firstName)}! 👋</h2>
            <p style="color:#6b7280;font-size:.82rem;margin-bottom:18px;text-align:center;">Pick a game and chase the leaderboard.</p>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;margin-bottom:18px;">
                ${[['🐍','Snake','snake'],['🧩','Word Builder','word'],['❌⭕','Tic-Tac-Toe','ttt']].map(([ico,lbl,id])=>`
                <button onclick="bkGame_${id}()" style="border:2px solid #e0e7ff;border-radius:14px;padding:16px 6px;background:#fff;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:6px;" onmouseover="this.style.borderColor='#6366f1';this.style.background='#f0f0ff';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#e0e7ff';this.style.background='#fff';this.style.transform=''">
                    <span style="font-size:1.8rem;">${ico}</span>
                    <span style="font-weight:800;color:#374151;font-size:.75rem;">${lbl}</span>
                </button>`).join('')}
            </div>
            <!-- Leaderboard panel -->
            <div style="width:100%;background:linear-gradient(135deg,#fef3c7,#fffbeb);border-radius:14px;padding:14px;border:1.5px solid #fde68a;">
                <div style="font-weight:800;color:#92400e;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">🏆 Top 5 Leaderboard</div>
                <div style="display:flex;gap:5px;margin-bottom:10px;">
                    ${['Snake','Word Builder','Tic-Tac-Toe'].map((g,i)=>`<button onclick="bkLB_tab(this,'${g}')" style="flex:1;padding:5px 4px;border-radius:8px;border:none;background:${i===0?'#fde68a':'rgba(0,0,0,.06)'};font-weight:${i===0?'800':'600'};font-size:.68rem;color:${i===0?'#92400e':'#6b7280'};cursor:pointer;" class="bk-lb-tab">${g}</button>`).join('')}
                </div>
                <div id="bk-lb-list" style="font-size:.82rem;color:#6b7280;min-height:60px;"></div>
            </div>`;
        window.bkGame_snake = initSnakeGame;
        window.bkGame_word  = initWordGame;
        window.bkGame_ttt   = initTTTGame;
        window.bkLB_tab = (btn, game) => {
            document.querySelectorAll('.bk-lb-tab').forEach(b => { b.style.background='rgba(0,0,0,.06)'; b.style.fontWeight='600'; b.style.color='#6b7280'; });
            btn.style.background='#fde68a'; btn.style.fontWeight='800'; btn.style.color='#92400e';
            fetchTop5(game, 'bk-lb-list');
        };
        fetchTop5('Snake', 'bk-lb-list');
    }

    /* ── GAME OVER ───────────────────────────────────── */
    function showGameOver(score, game) {
        stopAll();
        saveScore(score, game);
        const c = container();
        c.innerHTML = `
            <div style="text-align:center;width:100%;">
                <div style="width:72px;height:72px;background:linear-gradient(135deg,#eef2ff,#c7d2fe);border-radius:50%;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;font-size:2.5rem;">🏅</div>
                <h2 style="font-size:1.8rem;font-weight:900;color:#1e1b4b;margin:0 0 4px;">Game Over!</h2>
                <p style="color:#9ca3af;font-size:.78rem;margin:0 0 16px;">${new Date().toLocaleDateString()}</p>
                <div style="background:linear-gradient(135deg,#eef2ff,#ddd6fe);border-radius:14px;padding:20px;margin-bottom:16px;">
                    <p style="color:#4338ca;font-size:.65rem;text-transform:uppercase;font-weight:800;letter-spacing:.08em;margin:0 0 6px;">Final Score</p>
                    <p style="font-size:3.5rem;font-weight:900;color:#3730a3;margin:0;">${score}</p>
                    <p style="color:#818cf8;font-size:.75rem;font-weight:600;margin:4px 0 0;">${game}</p>
                </div>
                <div style="text-align:left;margin-bottom:16px;">
                    <p style="font-size:.68rem;font-weight:800;color:#9ca3af;text-transform:uppercase;margin:0 0 8px;">Top 5</p>
                    <div id="go-lb"></div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <button id="go-back" style="padding:12px;background:#f1f5f9;color:#374151;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-size:.85rem;">← Menu</button>
                    <button id="go-play" style="padding:12px;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;font-size:.85rem;">Play Again</button>
                </div>
            </div>`;
        fetchTop5(game, 'go-lb');
        document.getElementById('go-back').onclick = showMainMenu;
        document.getElementById('go-play').onclick = game==='Snake' ? initSnakeGame : game==='Word Builder' ? initWordGame : initTTTGame;
    }

    /* ── SNAKE ───────────────────────────────────────── */
    function initSnakeGame() {
        stopAll(); state.score=0; state.gameActive=true;
        state.snake=[{x:10,y:10}]; state.snakeDir={x:0,y:0}; state.snakeFood={x:15,y:15};
        const c = container();
        c.style.padding='12px';
        c.innerHTML = `
            <div style="display:flex;justify-content:space-between;width:100%;margin-bottom:8px;align-items:center;">
                <span style="font-weight:800;color:#374151;font-size:1rem;">Score: <span id="snake-score" style="color:#6366f1;">0</span></span>
                <span style="font-size:.65rem;background:#4338ca;color:#fff;padding:3px 10px;border-radius:999px;font-weight:700;">↑↓←→ / Swipe</span>
            </div>
            <div style="position:relative;width:100%;max-width:340px;aspect-ratio:1;background:#f8fafc;border-radius:14px;overflow:hidden;border:2px solid #e0e7ff;box-shadow:inset 0 2px 8px rgba(0,0,0,.05);">
                <canvas id="snake-canvas" width="400" height="400" style="width:100%;height:100%;"></canvas>
                <div id="snake-touch" style="position:absolute;inset:0;z-index:10;opacity:0;"></div>
            </div>`;
        const canvas = document.getElementById('snake-canvas');
        const ctx = canvas.getContext('2d');
        const N = 20, G = canvas.width/N;

        document.onkeydown = e => {
            if (!state.gameActive) return;
            if (e.key==='ArrowLeft'  && state.snakeDir.x!==1)  state.snakeDir={x:-1,y:0};
            if (e.key==='ArrowRight' && state.snakeDir.x!==-1) state.snakeDir={x:1,y:0};
            if (e.key==='ArrowUp'    && state.snakeDir.y!==1)  state.snakeDir={x:0,y:-1};
            if (e.key==='ArrowDown'  && state.snakeDir.y!==-1) state.snakeDir={x:0,y:1};
        };
        let tx=0,ty=0;
        const ta=document.getElementById('snake-touch');
        ta.addEventListener('touchstart',e=>{tx=e.changedTouches[0].screenX;ty=e.changedTouches[0].screenY;},{passive:true});
        ta.addEventListener('touchend',e=>{
            e.preventDefault();
            const dx=e.changedTouches[0].screenX-tx, dy=e.changedTouches[0].screenY-ty;
            if(Math.abs(dx)>Math.abs(dy)){if(dx>0&&state.snakeDir.x!==-1)state.snakeDir={x:1,y:0};else if(dx<0&&state.snakeDir.x!==1)state.snakeDir={x:-1,y:0};}
            else{if(dy>0&&state.snakeDir.y!==-1)state.snakeDir={x:0,y:1};else if(dy<0&&state.snakeDir.y!==1)state.snakeDir={x:0,y:-1};}
        },{passive:false});

        state.snakeInterval = setInterval(()=>{
            if(!state.gameActive)return;
            const h={x:state.snake[0].x+state.snakeDir.x, y:state.snake[0].y+state.snakeDir.y};
            if(h.x<0||h.x>=N||h.y<0||h.y>=N){showGameOver(state.score,'Snake');return;}
            for(const p of state.snake){if(h.x===p.x&&h.y===p.y&&(state.snakeDir.x!==0||state.snakeDir.y!==0)){showGameOver(state.score,'Snake');return;}}
            state.snake.unshift(h);
            if(h.x===state.snakeFood.x&&h.y===state.snakeFood.y){
                state.score+=10; document.getElementById('snake-score').innerText=state.score;
                state.snakeFood={x:Math.floor(Math.random()*N),y:Math.floor(Math.random()*N)};
            } else { state.snake.pop(); }
            ctx.fillStyle='#f8fafc'; ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.strokeStyle='#e2e8f0'; ctx.lineWidth=.5;
            for(let i=0;i<N;i++){ctx.beginPath();ctx.moveTo(i*G,0);ctx.lineTo(i*G,canvas.height);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*G);ctx.lineTo(canvas.width,i*G);ctx.stroke();}
            ctx.fillStyle='#f43f5e'; ctx.beginPath(); ctx.arc(state.snakeFood.x*G+G/2,state.snakeFood.y*G+G/2,G/2-2,0,2*Math.PI); ctx.fill();
            state.snake.forEach((p,i)=>{
                ctx.fillStyle=i===0?'#3730a3':'#6366f1';
                ctx.beginPath(); ctx.roundRect(p.x*G+1,p.y*G+1,G-2,G-2,i===0?4:2); ctx.fill();
            });
        },150);
    }

    /* ── WORD BUILDER ────────────────────────────────── */
    function generateLevel() {
        state.targetWord = ROOTS[Math.floor(Math.random()*ROOTS.length)];
        state.wordTiles  = state.targetWord.split('').sort(()=>Math.random()-.5);
        state.currentWord=''; renderWordUI();
    }
    function renderWordUI() {
        const c=container(); c.style.padding='12px';
        c.innerHTML=`
            <div style="display:flex;justify-content:space-between;width:100%;margin-bottom:10px;">
                <div><div style="font-size:.65rem;color:#9ca3af;font-weight:700;text-transform:uppercase;">Level ${state.wordLevel}</div><div style="font-weight:900;color:#374151;font-size:1rem;">Score: <span id="word-score" style="color:#6366f1;">${state.score}</span></div></div>
                <button onclick="bkWordEnd()" style="font-size:.72rem;color:#ef4444;background:#fef2f2;border:none;padding:4px 12px;border-radius:999px;cursor:pointer;font-weight:700;">End</button>
            </div>
            <div style="width:100%;background:linear-gradient(135deg,#eef2ff,#ddd6fe);border-radius:12px;height:68px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;position:relative;border:2px solid #c7d2fe;">
                <span id="wrd-display" style="font-size:2rem;font-weight:900;color:#3730a3;letter-spacing:.1em;"></span>
                <span style="position:absolute;top:6px;right:10px;font-size:.6rem;color:#a5b4fc;font-weight:700;">Target: ${state.targetWord.length} letters</span>
            </div>
            <p id="wrd-feedback" style="height:20px;margin-bottom:8px;font-size:.82rem;font-weight:700;text-align:center;opacity:0;transition:opacity .3s;"></p>
            <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-bottom:14px;" id="tile-rack">
                ${state.wordTiles.map((l,i)=>`<button class="wt" data-idx="${i}" data-l="${l}" style="width:40px;height:40px;background:linear-gradient(135deg,#eef2ff,#c7d2fe);color:#3730a3;font-weight:900;border-radius:10px;border:none;font-size:1rem;cursor:pointer;transition:all .15s;">${l}</button>`).join('')}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 2fr;gap:8px;width:100%;">
                <button onclick="bkWShuffle()" style="padding:12px;background:#fef3c7;color:#92400e;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-size:.9rem;">🔀</button>
                <button onclick="bkWClear()" style="padding:12px;background:#f1f5f9;color:#374151;border:none;border-radius:12px;font-weight:700;cursor:pointer;">Clear</button>
                <button onclick="bkWSubmit()" style="padding:12px;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,.35);">Submit ✓</button>
            </div>`;
        document.querySelectorAll('.wt').forEach(b=>{
            b.onclick=function(){if(this.style.opacity==='0.3')return;state.currentWord+=this.dataset.l;this.style.opacity='0.3';this.style.cursor='default';document.getElementById('wrd-display').innerText=state.currentWord;};
        });
        window.bkWClear=()=>{state.currentWord='';document.getElementById('wrd-display').innerText='';document.querySelectorAll('.wt').forEach(b=>{b.style.opacity='1';b.style.cursor='pointer';});};
        window.bkWShuffle=()=>{bkWClear();state.wordTiles.sort(()=>Math.random()-.5);renderWordUI();};
        window.bkWSubmit=submitWord;
        window.bkWordEnd=()=>showGameOver(state.score,'Word Builder');
    }
    function initWordGame() {
        stopAll();
        state.score=0; state.wordLevel=1; state.gameActive=true; state.validWordsFound=[];
        state.wordGameId=null; state.wordMyRole=null; state.wordUnsub=null;
        // Show a quick mode selection: Solo vs Challenge
        const c=container(); c.style.padding='16px';
        loadTutorsForTTT();
        c.innerHTML=`
            <div style="width:100%;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <div style="font-weight:900;color:#1e1b4b;font-size:1rem;">🧩 Word Builder</div>
                    <button onclick="window.bkGoMenu()" style="font-size:.72rem;color:#64748b;background:#f1f5f9;border:none;padding:5px 12px;border-radius:999px;cursor:pointer;font-weight:700;">← Menu</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:4px;">
                    <button onclick="bkWordSolo()" style="border:2px solid #e0e7ff;border-radius:14px;padding:18px 8px;background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;transition:all .2s;" onmouseover="this.style.borderColor='#6366f1';this.style.background='#f0f0ff'" onmouseout="this.style.borderColor='#e0e7ff';this.style.background='#fff'">
                        <span style="font-size:1.8rem;">🧩</span>
                        <span style="font-weight:800;color:#374151;font-size:.78rem;">Solo Play</span>
                        <span style="font-size:.65rem;color:#9ca3af;">Beat your score</span>
                    </button>
                    <button onclick="bkWordChallenge()" style="border:2px solid #ede9fe;border-radius:14px;padding:18px 8px;background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;transition:all .2s;" onmouseover="this.style.borderColor='#7c3aed';this.style.background='#faf5ff'" onmouseout="this.style.borderColor='#ede9fe';this.style.background='#fff'">
                        <span style="font-size:1.8rem;">⚔️</span>
                        <span style="font-weight:800;color:#374151;font-size:.78rem;">Challenge Tutor</span>
                        <span style="font-size:.65rem;color:#9ca3af;">Tutor vs Tutor</span>
                    </button>
                </div>
            </div>`;
        window.bkGoMenu     = showMainMenu;
        window.bkWordSolo   = ()=>{ state.score=0;state.wordLevel=1;state.gameActive=true;state.validWordsFound=[];generateLevel(); };
        window.bkWordChallenge = renderWordOnlineChallengeMenu;
    }
    function submitWord(){
        const fb=document.getElementById('wrd-feedback'),w=state.currentWord;
        if(!w)return;
        fb.style.opacity='1';
        if(state.validWordsFound.includes(w)){fb.style.color='#f59e0b';fb.textContent='Already found!';setTimeout(()=>{bkWClear();fb.style.opacity='0';},800);return;}
        if(w===state.targetWord){const pts=w.length*50;state.score+=pts;state.wordLevel++;fb.style.color='#7c3aed';fb.textContent=`🎉 BINGO! +${pts}`;document.getElementById('word-score').innerText=state.score;setTimeout(()=>{state.validWordsFound=[];generateLevel();},1400);return;}
        if(DICT.includes(w)||ROOTS.includes(w)){const pts=w.length*10;state.score+=pts;state.validWordsFound.push(w);fb.style.color='#16a34a';fb.textContent=`✓ Good! +${pts}`;document.getElementById('word-score').innerText=state.score;}
        else{fb.style.color='#ef4444';fb.textContent='Not in dictionary';}
        setTimeout(()=>{bkWClear();setTimeout(()=>fb.style.opacity='0',900);},500);
    }

    /* ── WORD BUILDER ONLINE (Tutor-vs-Tutor) ───────── */

    async function createOnlineWordGame(opponentId, opponentName, opponentEmail) {
        const statusEl=document.getElementById('wrd-invite-status');
        if(statusEl) statusEl.textContent='Creating game…';
        try {
            if(!db()||!C()||!AD()) throw new Error('Firebase unavailable');
            const myId    = state.currentUser.id||state.currentUser.email||'';
            const myEmail = state.currentUser.email||'';
            const myName  = state.currentUser.name||'Tutor';
            const targetWord = ROOTS[Math.floor(Math.random()*ROOTS.length)];
            const tiles      = targetWord.split('').sort(()=>Math.random()-.5);
            const gameData = {
                players:      { A: myId,    B: opponentId },
                playerNames:  { A: myName,  B: opponentName },
                playerEmails: { A: myEmail, B: opponentEmail||'' },
                targetWord, tiles,
                scores:      { A:0, B:0 },
                foundWords:  { A:[], B:[] },
                targetFound: null,
                status:     'waiting',
                createdAt:   new Date()
            };
            const ref = await AD()(C()(db(),'word_games'), gameData);
            state.wordGameId  = ref.id;
            state.wordMyRole  = 'A';
            state.targetWord  = targetWord;
            state.wordTiles   = tiles;

            // ── Notify opponent ──
            if(opponentEmail) {
                try {
                    await AD()(C()(db(),'tutor_notifications'), {
                        type:       'word_challenge',
                        tutorEmail: opponentEmail,
                        fromName:   myName,
                        fromId:     myId,
                        gameId:     ref.id,
                        gameType:   'word',
                        title:      `🧩 Word Builder Challenge from ${myName}!`,
                        message:    `${myName} has challenged you to a Word Builder match. Tap to accept!`,
                        read:       false,
                        createdAt:  new Date()
                    });
                } catch(ne){ console.warn('Word notify err:',ne.message); }
            }

            if(statusEl) statusEl.textContent='⏳ Waiting for opponent to join…';
            subscribeToOnlineWordGame(ref.id);
        } catch(e){
            if(statusEl) statusEl.textContent='Error: '+e.message;
        }
    }

    function subscribeToOnlineWordGame(gameId) {
        if(!db()||!DC()||!SN()) return;
        if(state.wordUnsub) state.wordUnsub();
        state.gameActive = true;
        state.wordUnsub  = SN()(DC()(db(),'word_games',gameId), snap=>{
            if(!snap.exists()) return;
            const g = snap.data();
            state.targetWord = g.targetWord;
            state.wordTiles  = g.tiles;

            // Opponent joining: activate game
            if(g.status==='waiting' && state.wordMyRole==='B' && UD() && DC()) {
                UD()(DC()(db(),'word_games',gameId),{status:'active'}).catch(()=>{});
            }
            renderOnlineWordUI(g, gameId);
            if(g.status==='done') { if(state.wordUnsub){state.wordUnsub();state.wordUnsub=null;} }
        });
    }

    function renderOnlineWordUI(g, gameId) {
        const c=container(); c.style.padding='12px';
        const myRole   = state.wordMyRole||'A';
        const oppRole  = myRole==='A'?'B':'A';
        const myScore  = g.scores?.[myRole]||0;
        const oppScore = g.scores?.[oppRole]||0;
        const myName   = g.playerNames?.[myRole]||'You';
        const oppName  = g.playerNames?.[oppRole]||'Opponent';
        const waiting  = g.status==='waiting';
        const done     = g.status==='done';
        const winner   = g.targetFound; // 'A' or 'B' or null
        const tiles    = g.tiles||[];

        let statusBanner = '';
        if(waiting)     statusBanner=`<div style="text-align:center;background:#fef3c7;border-radius:10px;padding:10px;font-weight:800;font-size:.82rem;color:#92400e;margin-bottom:10px;">⏳ Waiting for opponent to join…</div>`;
        else if(done)   statusBanner=`<div style="text-align:center;background:${winner===myRole?'#d1fae5':'#fee2e2'};border-radius:10px;padding:10px;font-weight:800;font-size:.82rem;color:${winner===myRole?'#065f46':'#991b1b'};margin-bottom:10px;">${winner===myRole?'🏆 You found it first! You win!':'😅 Opponent found the word first!'}</div>`;
        else            statusBanner=`<div style="text-align:center;background:#eef2ff;border-radius:10px;padding:10px;font-weight:800;font-size:.82rem;color:#3730a3;margin-bottom:10px;">🔴 Live — Build words from the tiles!</div>`;

        c.innerHTML=`
            <div style="width:100%;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div style="font-weight:900;color:#1e1b4b;font-size:.9rem;">🧩 Word Builder <span style="font-size:.62rem;background:#eef2ff;color:#4338ca;padding:2px 7px;border-radius:999px;margin-left:4px;">ONLINE</span></div>
                    <button onclick="window.bkGoMenu()" style="font-size:.68rem;color:#64748b;background:#f1f5f9;border:none;padding:4px 10px;border-radius:999px;cursor:pointer;">← Menu</button>
                </div>
                <!-- Scores -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                    <div style="text-align:center;background:linear-gradient(135deg,#eef2ff,#ddd6fe);border-radius:11px;padding:8px;">
                        <div style="font-size:.65rem;color:#6366f1;font-weight:800;text-transform:uppercase;">You</div>
                        <div style="font-size:1.4rem;font-weight:900;color:#3730a3;">${myScore}</div>
                    </div>
                    <div style="text-align:center;background:#f8fafc;border-radius:11px;padding:8px;border:1.5px solid #e2e8f0;">
                        <div style="font-size:.65rem;color:#64748b;font-weight:800;text-transform:uppercase;">${esc(oppName)}</div>
                        <div style="font-size:1.4rem;font-weight:900;color:#374151;">${oppScore}</div>
                    </div>
                </div>
                ${statusBanner}
                ${done ? '' : `
                <div style="background:linear-gradient(135deg,#eef2ff,#ddd6fe);border-radius:12px;height:60px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;border:2px solid #c7d2fe;position:relative;">
                    <span id="wrd-display" style="font-size:1.8rem;font-weight:900;color:#3730a3;letter-spacing:.1em;"></span>
                    <span style="position:absolute;top:5px;right:9px;font-size:.58rem;color:#a5b4fc;font-weight:700;">Target: ${g.targetWord.length} letters</span>
                </div>
                <p id="wrd-feedback" style="height:20px;margin-bottom:6px;font-size:.8rem;font-weight:700;text-align:center;opacity:0;transition:opacity .3s;"></p>
                <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-bottom:12px;" id="tile-rack">
                    ${tiles.map((l,i)=>`<button class="wt" data-idx="${i}" data-l="${l}" style="width:38px;height:38px;background:linear-gradient(135deg,#eef2ff,#c7d2fe);color:#3730a3;font-weight:900;border-radius:10px;border:none;font-size:.95rem;cursor:pointer;transition:all .15s;">${l}</button>`).join('')}
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 2fr;gap:8px;width:100%;">
                    <button onclick="bkWShuffle()" style="padding:10px;background:#fef3c7;color:#92400e;border:none;border-radius:12px;font-weight:700;cursor:pointer;">🔀</button>
                    <button onclick="bkWClear()" style="padding:10px;background:#f1f5f9;color:#374151;border:none;border-radius:12px;font-weight:700;cursor:pointer;">Clear</button>
                    <button onclick="bkWOnlineSubmit('${gameId}')" style="padding:10px;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;">Submit ✓</button>
                </div>`}
            </div>`;

        if(!done) {
            state.currentWord='';
            state.wordTiles=[...tiles];
            document.querySelectorAll('.wt').forEach(b=>{
                b.onclick=function(){if(this.style.opacity==='0.3')return;state.currentWord+=this.dataset.l;this.style.opacity='0.3';this.style.cursor='default';document.getElementById('wrd-display').innerText=state.currentWord;};
            });
            window.bkWClear=()=>{state.currentWord='';document.getElementById('wrd-display').innerText='';document.querySelectorAll('.wt').forEach(b=>{b.style.opacity='1';b.style.cursor='pointer';});};
            window.bkWShuffle=()=>{bkWClear();state.wordTiles.sort(()=>Math.random()-.5);renderOnlineWordUI(g,gameId);};
            window.bkWOnlineSubmit = async (gid)=>{
                const fb=document.getElementById('wrd-feedback'), w=state.currentWord;
                if(!w||waiting) return;
                fb.style.opacity='1';
                const myWords=g.foundWords?.[myRole]||[];
                if(myWords.includes(w)){fb.style.color='#f59e0b';fb.textContent='Already found!';setTimeout(()=>{bkWClear();fb.style.opacity='0';},800);return;}
                if(w===g.targetWord){
                    // Target word found — end game
                    const finalScore=(myScore+w.length*50);
                    await UD()(DC()(db(),'word_games',gid),{
                        [`scores.${myRole}`]: finalScore,
                        [`foundWords.${myRole}`]: [...myWords,w],
                        targetFound: myRole,
                        status:'done'
                    }).catch(()=>{});
                    return;
                }
                if(DICT.includes(w)||ROOTS.includes(w)){
                    const pts=w.length*10;
                    await UD()(DC()(db(),'word_games',gid),{
                        [`scores.${myRole}`]: myScore+pts,
                        [`foundWords.${myRole}`]: [...myWords,w]
                    }).catch(()=>{});
                    fb.style.color='#16a34a';fb.textContent=`✓ Good! +${pts}`;
                } else {
                    fb.style.color='#ef4444';fb.textContent='Not in dictionary';
                }
                setTimeout(()=>{bkWClear();setTimeout(()=>fb.style.opacity='0',900);},500);
            };
        }
        window.bkGoMenu = showMainMenu;
    }

    function renderWordOnlineChallengeMenu() {
        const c=container(); c.style.padding='14px';
        loadTutorsForTTT(); // reuse same tutor list loader
        c.innerHTML=`
            <div style="width:100%;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <div style="font-weight:900;color:#1e1b4b;font-size:.9rem;">🧩 Word Builder Challenge</div>
                    <button onclick="window.bkGoMenu()" style="font-size:.72rem;color:#64748b;background:#f1f5f9;border:none;padding:5px 12px;border-radius:999px;cursor:pointer;font-weight:700;">← Menu</button>
                </div>
                <p style="color:#6b7280;font-size:.78rem;margin-bottom:12px;">Choose a tutor to challenge. You'll get the same scrambled word — first to find it wins!</p>
                <div style="position:relative;margin-bottom:8px;">
                    <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input id="word-tutor-search" type="text" placeholder="Search tutor…" style="width:100%;padding:8px 10px 8px 28px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.8rem;outline:none;box-sizing:border-box;" oninput="bkWord_filterTutors(this.value)">
                </div>
                <div id="word-tutor-list" style="max-height:160px;overflow-y:auto;border:1.5px solid #e2e8f0;border-radius:10px;margin-bottom:10px;">
                    <div style="text-align:center;padding:20px;color:#9ca3af;font-size:.78rem;">Loading tutors…</div>
                </div>
                <div id="wrd-invite-status" style="font-size:.75rem;color:#6b7280;text-align:center;min-height:20px;"></div>
            </div>`;
        window.bkGoMenu = showMainMenu;
        window.bkWord_filterTutors = q=>{
            const el=document.getElementById('word-tutor-list'); if(!el)return;
            const filtered=state.tttTutors.filter(t=>!q||t.name.toLowerCase().includes(q.toLowerCase())||t.email.toLowerCase().includes(q.toLowerCase()));
            if(!filtered.length){el.innerHTML=`<div style="text-align:center;padding:20px;color:#9ca3af;font-size:.78rem;">${state.tttTutors.length?'No match':'No other tutors found'}</div>`;return;}
            el.innerHTML=filtered.map(t=>`
                <div onclick="bkWord_invite('${esc(t.id)}','${esc(t.name)}','${esc(t.email)}')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background .15s;" onmouseover="this.style.background='#f0f0ff'" onmouseout="this.style.background='#fff'">
                    <div style="width:34px;height:34px;border-radius:10px;background:#ede9fe;color:#7c3aed;font-weight:900;font-size:.75rem;display:flex;align-items:center;justify-content:center;">${t.name.charAt(0).toUpperCase()}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:700;color:#1e293b;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.name)}</div>
                        <div style="font-size:.65rem;color:#94a3b8;">${esc(t.email)}</div>
                    </div>
                    <span style="font-size:.65rem;background:#ede9fe;color:#7c3aed;padding:3px 8px;border-radius:999px;font-weight:700;">Challenge ▶</span>
                </div>`).join('');
            window.bkWord_invite = createOnlineWordGame;
        };
        // Render immediately (tutors may already be loaded)
        window.bkWord_filterTutors('');
        // If not yet loaded, re-render once loaded
        if(!state.tttTutors.length) {
            setTimeout(()=>{ if(state.tttTutors.length) window.bkWord_filterTutors(''); },2500);
        }
    }

    /* ── TIC-TAC-TOE ─────────────────────────────────── */
    const TTT_WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

    function initTTTGame() {
        stopAll();
        state.tttBoard=Array(9).fill(null); state.tttTurn='X';
        state.tttScores={X:0,O:0,draws:0}; state.gameActive=true;
        state.tttMode='ai'; state.tttGameId=null; state.tttMyMark='X';
        renderTTTMenu();
    }

    function renderTTTMenu() {
        const c=container(); c.style.padding='16px';
        // load tutor list for online play
        loadTutorsForTTT();
        c.innerHTML=`
            <div style="width:100%;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
                    <div style="font-weight:900;color:#1e1b4b;font-size:1rem;">❌⭕ Tic-Tac-Toe</div>
                    <button onclick="window.bkGoMenu()" style="font-size:.72rem;color:#64748b;background:#f1f5f9;border:none;padding:5px 12px;border-radius:999px;cursor:pointer;font-weight:700;">← Menu</button>
                </div>
                <div style="margin-bottom:14px;">
                    <div style="font-size:.65rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;margin-bottom:8px;">Game Mode</div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <button id="ttt-ai-btn" onclick="bkTTT_selectMode('ai')" style="padding:14px;border-radius:13px;border:2px solid #6366f1;background:#eef2ff;cursor:pointer;text-align:center;">
                            <div style="font-size:1.5rem;margin-bottom:4px;">🤖</div>
                            <div style="font-weight:800;color:#4338ca;font-size:.8rem;">vs AI</div>
                            <div style="font-size:.65rem;color:#6366f1;margin-top:2px;">Solo challenge</div>
                        </button>
                        <button id="ttt-online-btn" onclick="bkTTT_selectMode('online')" style="padding:14px;border-radius:13px;border:2px solid #e2e8f0;background:#fff;cursor:pointer;text-align:center;">
                            <div style="font-size:1.5rem;margin-bottom:4px;">🧑‍🏫</div>
                            <div style="font-weight:800;color:#64748b;font-size:.8rem;">vs Tutor</div>
                            <div style="font-size:.65rem;color:#94a3b8;margin-top:2px;">Real-time battle</div>
                        </button>
                    </div>
                </div>
                <div id="ttt-mode-panel"></div>
            </div>`;
        window.bkGoMenu = showMainMenu;
        window.bkTTT_selectMode = function(mode) {
            ['ai','online'].forEach(m=>{
                const b=document.getElementById(`ttt-${m}-btn`);
                if(b){b.style.border=m===mode?'2px solid #6366f1':'2px solid #e2e8f0';b.style.background=m===mode?'#eef2ff':'#fff';b.querySelector('div:nth-child(2)').style.color=m===mode?'#4338ca':'#64748b';}
            });
            state.tttMode=mode;
            const panel=document.getElementById('ttt-mode-panel');
            if(mode==='ai'){
                panel.innerHTML=`<button onclick="bkTTT_start()" style="width:100%;padding:13px;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;border:none;border-radius:13px;font-weight:800;cursor:pointer;font-size:.9rem;box-shadow:0 4px 14px rgba(99,102,241,.35);">▶ Start Game</button>`;
                window.bkTTT_start=()=>{state.gameActive=true;state.tttMode='ai';state.tttBoard=Array(9).fill(null);state.tttTurn='X';state._confettiShown=false;renderTTT(null,null,null,false);};
            } else {
                renderTTTOnlinePanel(panel);
            }
        };
        // auto-select AI
        bkTTT_selectMode('ai');
    }

    function renderTTTOnlinePanel(panel) {
        panel.innerHTML=`
            <div style="position:relative;margin-bottom:8px;">
                <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94a3b8;" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <input id="ttt-tutor-search" type="text" placeholder="Search tutor by name…" style="width:100%;padding:8px 10px 8px 28px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.8rem;outline:none;box-sizing:border-box;" oninput="bkTTT_filterTutors(this.value)">
            </div>
            <div id="ttt-tutor-list" style="max-height:140px;overflow-y:auto;border:1.5px solid #e2e8f0;border-radius:10px;margin-bottom:10px;">
                <div style="text-align:center;padding:20px;color:#9ca3af;font-size:.78rem;">Loading tutors…</div>
            </div>
            <div id="ttt-invite-status" style="font-size:.75rem;color:#6b7280;text-align:center;min-height:20px;"></div>`;
        window.bkTTT_filterTutors = function(q) {
            renderTTTTutorList(q);
        };
        renderTTTTutorList('');
    }

    async function loadTutorsForTTT() {
        try {
            if(!db()||!C()||!GD()) return;
            const snap = await GD()(C()(db(),'tutors'));
            const myId = state.currentUser.id||state.currentUser.email||'';
            state.tttTutors=[];
            snap.forEach(d=>{
                const t=d.data();
                const tid = t.tutorUid||d.id;
                if(tid!==myId && t.status!=='inactive' && (t.name||t.email)){
                    state.tttTutors.push({id:tid, name:t.name||t.email||'Tutor', email:t.email||''});
                }
            });
        } catch(e){ console.warn('TTT tutor load:',e.message); }
    }

    function renderTTTTutorList(q='') {
        const el=document.getElementById('ttt-tutor-list');
        if(!el)return;
        const filtered = state.tttTutors.filter(t=>!q||t.name.toLowerCase().includes(q.toLowerCase())||t.email.toLowerCase().includes(q.toLowerCase()));
        if(!filtered.length){el.innerHTML=`<div style="text-align:center;padding:20px;color:#9ca3af;font-size:.78rem;">${state.tttTutors.length?'No match':'No other tutors found'}</div>`;return;}
        el.innerHTML=filtered.map(t=>`
            <div onclick="bkTTT_invite('${esc(t.id)}','${esc(t.name)}','${esc(t.email)}')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background .15s;" onmouseover="this.style.background='#f0f0ff'" onmouseout="this.style.background='#fff'">
                <div style="width:34px;height:34px;border-radius:10px;background:#eef2ff;color:#4338ca;font-weight:900;font-size:.75rem;display:flex;align-items:center;justify-content:center;">${t.name.charAt(0).toUpperCase()}</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;color:#1e293b;font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.name)}</div>
                    <div style="font-size:.65rem;color:#94a3b8;">${esc(t.email)}</div>
                </div>
                <span style="font-size:.65rem;background:#eef2ff;color:#4338ca;padding:3px 8px;border-radius:999px;font-weight:700;">Challenge ▶</span>
            </div>`).join('');
        window.bkTTT_invite = createOnlineTTTGame;
    }

    async function createOnlineTTTGame(opponentId, opponentName, opponentEmail) {
        const statusEl=document.getElementById('ttt-invite-status');
        if(statusEl) statusEl.textContent='Creating game…';
        try {
            if(!db()||!C()||!AD()) throw new Error('Firebase unavailable');
            const myId    = state.currentUser.id||state.currentUser.email||'';
            const myEmail = state.currentUser.email||'';
            const myName  = state.currentUser.name||'Tutor';
            const gameData = {
                players:     { X: myId, O: opponentId },
                playerNames: { X: myName, O: opponentName },
                playerEmails:{ X: myEmail, O: opponentEmail||'' },
                board: Array(9).fill(null),
                turn: 'X',
                status: 'waiting', // waiting → active → done
                winner: null,
                createdAt: new Date(),
                scores: {X:0,O:0,draws:0}
            };
            const ref = await AD()(C()(db(),'ttt_games'), gameData);
            state.tttGameId = ref.id;
            state.tttMyMark = 'X';
            state.tttOpponentName = opponentName || 'Opponent';

            // ── Notify the opponent via tutor_notifications ──
            if(opponentEmail) {
                try {
                    await AD()(C()(db(),'tutor_notifications'), {
                        type:         'ttt_challenge',
                        tutorEmail:   opponentEmail,
                        fromName:     myName,
                        fromId:       myId,
                        gameId:       ref.id,
                        gameType:     'ttt',
                        title:        `🎮 Tic-Tac-Toe Challenge from ${myName}!`,
                        message:      `${myName} has challenged you to a Tic-Tac-Toe match. Tap to accept and play!`,
                        read:         false,
                        createdAt:    new Date()
                    });
                } catch(ne){ console.warn('TTT notify err:',ne.message); }
            }

            if(statusEl) statusEl.textContent='⏳ Waiting for opponent to join…';
            subscribeToOnlineTTT(ref.id);
        } catch(e) {
            if(statusEl) statusEl.textContent='Error: '+e.message;
        }
    }

    function subscribeToOnlineTTT(gameId) {
        if(!db()||!DC()||!SN()) return;
        if(state.tttUnsub) state.tttUnsub();
        state.gameActive=true;
        state.tttMode='online';
        state.tttGameId=gameId;
        state.tttUnsub = SN()(DC()(db(),'ttt_games',gameId), snap => {
            if(!snap.exists()) return;
            const g = snap.data();
            state.tttBoard = g.board || Array(9).fill(null);
            state.tttTurn  = g.turn  || 'X';
            if(g.scores) state.tttScores = g.scores;

            // Derive opponent name from playerNames
            const myMark = state.tttMyMark;
            const oppMark = myMark === 'X' ? 'O' : 'X';
            if(g.playerNames?.[oppMark]) state.tttOpponentName = g.playerNames[oppMark];

            // If joining as O, activate game
            if(g.status==='waiting' && state.tttMyMark==='O' && DC() && UD()) {
                UD()(DC()(db(),'ttt_games',gameId),{status:'active'}).catch(()=>{});
            }

            const winLine = tttWinLine(state.tttBoard);
            // Use Firestore winner field as source of truth for done state
            const firestoreWinner = g.winner || null;
            const isDone = g.status === 'done';
            renderTTT(winLine, gameId, firestoreWinner, isDone);
            if(isDone) { if(state.tttUnsub){state.tttUnsub();state.tttUnsub=null;} }
        });
    }

    function renderTTT(winLine=null, gameId=null, firestoreWinner=null, isDone=false) {
        const c=container(); c.style.padding='14px';
        const b=state.tttBoard, sc=state.tttScores;
        const isOnline = state.tttMode==='online' && gameId;
        const myTurn   = !isOnline || state.tttTurn===state.tttMyMark;
        // For online games, use firestoreWinner as authoritative source; locally derive from board
        const winner   = isOnline ? firestoreWinner : (tttWinLine(b) ? b[tttWinLine(b)[0]] : null);
        const isDraw   = isOnline ? (isDone && !winner) : (!winner && b.every(x=>x));
        const opponentLabel = isOnline ? esc(state.tttOpponentName) : 'AI';

        // Confetti — only for the winner, only once per game
        if(winner && !state._confettiShown) {
            const iWon = isOnline ? winner === state.tttMyMark : winner === 'X';
            if(iWon) { state._confettiShown = true; setTimeout(triggerConfetti, 200); }
        }
        if(!winner && !isDraw) state._confettiShown = false;

        let statusText, statusBg;
        if(winner){
            if(isOnline){
                if(winner===state.tttMyMark){ statusText='🏆 You Win!'; statusBg='linear-gradient(135deg,#d1fae5,#ecfdf5)'; }
                else { statusText='😅 ' + opponentLabel + ' Wins!'; statusBg='linear-gradient(135deg,#fee2e2,#fff1f2)'; }
            } else {
                statusText = winner==='X' ? '🏆 You Win!' : '🤖 AI Wins!';
                statusBg   = winner==='X' ? 'linear-gradient(135deg,#d1fae5,#ecfdf5)' : 'linear-gradient(135deg,#fee2e2,#fff1f2)';
            }
        } else if(isDraw){statusText='🤝 Draw!';statusBg='#f8fafc';}
        else if(isOnline && !myTurn){statusText='⏳ Waiting for ' + opponentLabel + '…';statusBg='#fef3c7';}
        else{statusText=(state.tttTurn==='X'?'Your turn (✕)':'Opponent turn (⭕)');statusBg='#eef2ff';}

        // Determine which mark belongs to "you" vs opponent for scoreboard labels
        const myMarkLabel  = isOnline ? state.tttMyMark  : 'X';
        const oppMarkLabel = myMarkLabel === 'X' ? 'O' : 'X';
        const leftScore    = sc[myMarkLabel]  || 0;
        const rightScore   = sc[oppMarkLabel] || 0;
        const leftColor    = myMarkLabel  === 'X' ? '#d97706' : '#7c3aed';
        const leftBg       = myMarkLabel  === 'X' ? 'linear-gradient(135deg,#fef3c7,#fef9c3)' : 'linear-gradient(135deg,#ede9fe,#e0e7ff)';
        const rightColor   = oppMarkLabel === 'O' ? '#7c3aed' : '#d97706';
        const rightBg      = oppMarkLabel === 'O' ? 'linear-gradient(135deg,#ede9fe,#e0e7ff)' : 'linear-gradient(135deg,#fef3c7,#fef9c3)';
        const leftSymbol   = myMarkLabel  === 'X' ? '✕' : '⭕';
        const rightSymbol  = oppMarkLabel === 'O' ? '⭕' : '✕';
        const leftLbl      = 'YOU (' + myMarkLabel  + ')';
        const rightLbl     = isOnline ? (opponentLabel + ' (' + oppMarkLabel + ')') : 'AI';

        // Build board cells
        const boardCells = b.map((cell,i)=>{
            const wl=tttWinLine(b); const isW=wl&&wl.includes(i);
            const bg=isW?(cell==='X'?'linear-gradient(135deg,#fde68a,#fbbf24)':'linear-gradient(135deg,#ddd6fe,#c4b5fd)'):cell?'#f8fafc':'linear-gradient(135deg,#f8fafc,#eef2ff)';
            const bc=isW?(cell==='X'?'#f59e0b':'#8b5cf6'):cell?'#e2e8f0':'#c7d2fe';
            const clickable=!cell&&!winner&&!isDraw&&(state.tttMode!=='online'||myTurn);
            const cellContent = cell==='X'?'✕':cell==='O'?'⭕':'';
            const cellColor   = cell==='X'?'#d97706':cell==='O'?'#7c3aed':'transparent';
            let hoverAttr = '';
            if(clickable){ hoverAttr = ' onmouseover="this.style.background=\'#e0e7ff\';this.style.borderColor=\'#818cf8\';this.style.transform=\'scale(1.06)\'" onmouseout="this.style.background=\'linear-gradient(135deg,#f8fafc,#eef2ff)\';this.style.borderColor=\'#c7d2fe\';this.style.transform=\'scale(1)\'"'; }
            return '<button class="ttt-c" data-i="'+i+'" style="width:100%;aspect-ratio:1;min-height:72px;border-radius:13px;border:2.5px solid '+bc+';background:'+bg+';font-size:1.8rem;font-weight:900;color:'+cellColor+';cursor:'+(clickable?'pointer':'default')+';box-shadow:'+(isW?'0 0 0 3px '+(cell==='X'?'rgba(245,158,11,.3)':'rgba(139,92,246,.3)'):'0 2px 8px rgba(0,0,0,.06)')+';transition:all .18s ease;display:flex;align-items:center;justify-content:center;line-height:1;"'+hoverAttr+'>'+cellContent+'</button>';
        }).join('');

        c.innerHTML = '<div style="width:100%;">'
            + '<div style="display:flex;justify-content:space-between;margin-bottom:12px;">'
            + '<div style="font-weight:900;color:#1e1b4b;font-size:.9rem;">❌⭕ Tic-Tac-Toe '+(isOnline?'<span style="font-size:.65rem;background:#eef2ff;color:#4338ca;padding:2px 8px;border-radius:999px;margin-left:4px;">ONLINE</span>':'')+'</div>'
            + '<button onclick="window.bkGoMenu()" style="font-size:.68rem;color:#64748b;background:#f1f5f9;border:none;padding:4px 10px;border-radius:999px;cursor:pointer;">← Menu</button>'
            + '</div>'
            // Scoreboard — left = You, middle = Draws, right = Opponent
            + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px;width:100%;">'
            + '<div style="text-align:center;background:'+leftBg+';border-radius:11px;padding:8px;border:1.5px solid '+(state.tttTurn===myMarkLabel&&!winner&&!isDraw?'#f59e0b':'transparent')+';"><div style="font-size:1.1rem;font-weight:900;color:'+leftColor+';">'+leftSymbol+'</div><div style="font-size:1.1rem;font-weight:900;color:#92400e;">'+leftScore+'</div><div style="font-size:.58rem;color:#a16207;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="'+leftLbl+'">'+leftLbl+'</div></div>'
            + '<div style="text-align:center;background:#f8fafc;border-radius:11px;padding:8px;border:1.5px solid #e2e8f0;"><div style="font-size:.9rem;">🤝</div><div style="font-size:1.1rem;font-weight:900;color:#374151;">'+sc.draws+'</div><div style="font-size:.6rem;color:#9ca3af;font-weight:700;">DRAWS</div></div>'
            + '<div style="text-align:center;background:'+rightBg+';border-radius:11px;padding:8px;border:1.5px solid '+(state.tttTurn===oppMarkLabel&&!winner&&!isDraw?'#8b5cf6':'transparent')+';"><div style="font-size:1.1rem;font-weight:900;color:'+rightColor+';">'+rightSymbol+'</div><div style="font-size:1.1rem;font-weight:900;color:#5b21b6;">'+rightScore+'</div><div style="font-size:.58rem;color:#6d28d9;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="'+rightLbl+'">'+rightLbl+'</div></div>'
            + '</div>'
            // Status bar
            + '<div style="text-align:center;padding:10px;border-radius:10px;background:'+statusBg+';font-weight:800;font-size:.85rem;color:#1e1b4b;margin-bottom:12px;min-height:40px;display:flex;align-items:center;justify-content:center;">'+statusText+'</div>'
            // Board
            + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;width:100%;max-width:310px;margin-left:auto;margin-right:auto;">'
            + boardCells
            + '</div>'
            + '<button id="ttt-new" style="width:100%;padding:11px;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;border:none;border-radius:12px;font-weight:800;cursor:pointer;font-size:.85rem;">🔄 New Round</button>'
            + '</div>';

        document.querySelectorAll('.ttt-c').forEach(btn=>{
            btn.onclick=()=>tttMove(parseInt(btn.dataset.i), gameId);
        });
        document.getElementById('ttt-new').onclick=()=>{
            state._confettiShown = false;
            if(isOnline&&gameId){ resetOnlineTTT(gameId); }
            else { state.tttBoard=Array(9).fill(null);state.tttTurn='X';state.gameActive=true;renderTTT(null,null,null,false); }
        };
        window.bkGoMenu = showMainMenu;
    }


    function tttMove(idx, gameId=null) {
        const b=state.tttBoard;
        if(b[idx]||!state.gameActive) return;
        // Online: only move on your turn
        if(state.tttMode==='online'&&state.tttTurn!==state.tttMyMark) return;
        b[idx]=state.tttTurn;
        const wl=tttWinLine(b); const isDraw=!wl&&b.every(x=>x);
        const nextTurn = state.tttTurn==='X'?'O':'X';

        if(gameId&&db()&&DC()&&UD()){
            // Update Firestore
            const update = { board:b, turn:nextTurn };
            if(wl){ update.winner=state.tttTurn; update.status='done'; state.tttScores[state.tttTurn]++; update.scores=state.tttScores; saveScore(state.tttScores[state.tttMyMark],'Tic-Tac-Toe'); }
            else if(isDraw){ update.status='done'; state.tttScores.draws++; update.scores=state.tttScores; }
            else { update.status='active'; }
            UD()(DC()(db(),'ttt_games',gameId), update).catch(e=>console.warn('TTT update:',e));
        } else {
            // Local / AI
            if(wl){ state.tttScores[state.tttTurn]++; renderTTT(wl,null,state.tttTurn,true); saveScore(state.tttScores.X,'Tic-Tac-Toe'); return; }
            if(isDraw){ state.tttScores.draws++; renderTTT(null,null,null,true); return; }
            state.tttTurn=nextTurn;
            renderTTT(null,null);
            if(state.tttMode==='ai'&&state.tttTurn==='O') setTimeout(tttAI,380);
        }
    }

    function tttAI() {
        const b=state.tttBoard;
        function find(p){for(const[a,c,d]of TTT_WINS){if(b[a]===p&&b[c]===p&&!b[d])return d;if(b[a]===p&&!b[c]&&b[d]===p)return c;if(!b[a]&&b[c]===p&&b[d]===p)return a;}return -1;}
        let m=find('O'); if(m<0)m=find('X'); if(m<0&&!b[4])m=4;
        if(m<0){const e=b.map((c,i)=>c?-1:i).filter(i=>i>=0);m=e[Math.floor(Math.random()*e.length)];}
        if(m>=0) tttMove(m, null);
    }

    function tttWinLine(b) { return TTT_WINS.find(([a,c,d])=>b[a]&&b[a]===b[c]&&b[a]===b[d])||null; }

    async function resetOnlineTTT(gameId) {
        if(!db()||!DC()||!UD()) return;
        const newBoard = Array(9).fill(null);
        await UD()(DC()(db(),'ttt_games',gameId),{board:newBoard,turn:'X',winner:null,status:'active'});
    }

    /* ── Firebase: save score + fetch top-5 ─────────── */
    async function saveScore(score, game) {
        if(!db()) return;
        const d = { userId:state.currentUser.id||'guest', userName:state.currentUser.name||'Tutor', game, score, timestamp:new Date() };
        try {
            if(C()&&AD()) await AD()(C()(db(),'leaderboard'), d);
            else if(db().collection) await db().collection('leaderboard').add(d);
        } catch(e){ console.warn('saveScore:',e.message); }
    }

    async function fetchTop5(game, elId) {
        const el=document.getElementById(elId);
        if(!el) return;
        el.innerHTML='<div style="color:#9ca3af;text-align:center;font-size:.75rem;padding:8px;">Loading…</div>';
        if(!db()){ el.innerHTML='<div style="color:#d1d5db;font-size:.72rem;text-align:center;padding:8px;">Offline</div>'; return; }
        try {
            let snap;
            if(C()&&Q()&&W()&&GD()){
                snap=await GD()(Q()(C()(db(),'leaderboard'),W()('game','==',game)));
            } else if(db().collection){
                snap=await db().collection('leaderboard').where('game','==',game).get();
            } else { el.innerHTML='<div style="color:#d1d5db;font-size:.72rem;text-align:center;">Unavailable</div>'; return; }
            const docs=(snap.docs||[]).sort((a,b)=>(b.data().score||0)-(a.data().score||0)).slice(0,5);
            if(!docs.length){ el.innerHTML='<div style="color:#9ca3af;font-style:italic;font-size:.75rem;text-align:center;padding:8px;">No scores yet</div>'; return; }
            // Best-effort: resolve real names from tutors collection
            const nameMap = {};
            try {
                if(C()&&GD()) {
                    const tSnap = await GD()(C()(db(),'tutors'));
                    tSnap.forEach(d=>{ const t=d.data(); const uid=t.tutorUid||d.id; if(uid&&(t.name||t.displayName)) nameMap[uid]=(t.name||t.displayName); });
                }
            } catch(e){ /* non-critical */ }
            const medals=['\u{1F947}','\u{1F948}','\u{1F949}','4\uFE0F\u20E3','5\uFE0F\u20E3'];
            el.innerHTML=docs.map((d,i)=>{
                const dat=d.data();
                let displayName = nameMap[dat.userId] || dat.userName || 'Tutor';
                if(displayName.includes('@') && !displayName.includes(' ')) displayName = displayName.split('@')[0];
                return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-radius:8px;background:${i===0?'linear-gradient(135deg,#fef3c7,#fef9c3)':'#f8fafc'};margin-bottom:4px;">
                    <span style="font-weight:700;color:${i===0?'#92400e':'#374151'};font-size:.78rem;display:flex;align-items:center;gap:5px;">${medals[i]} ${esc(displayName)}</span>
                    <span style="font-weight:900;color:#6366f1;font-size:.85rem;">${dat.score}</span>
                </div>`;
            }).join('');
        } catch(e){
            el.innerHTML='<div style="color:#d1d5db;font-size:.68rem;text-align:center;padding:6px;">Offline</div>';
        }
    }

    /* ── helpers ─────────────────────────────────────── */
    function container() { return document.getElementById('bk-game-container'); }
    function esc(s){ if(!s)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function stopAll() {
        state.gameActive=false;
        if(state.snakeInterval){clearInterval(state.snakeInterval);state.snakeInterval=null;}
        if(state.tttUnsub){state.tttUnsub();state.tttUnsub=null;}
        if(state.wordUnsub){state.wordUnsub();state.wordUnsub=null;}
        document.onkeydown=null;
    }

    /* ── bridge Firebase from tutor.js ──────────────── */
    function bridge() {
        try {
            if(!window.__fbOnSnapshot && typeof onSnapshot!=='undefined') window.__fbOnSnapshot=onSnapshot;
            if(!window.__fbDoc        && typeof doc!=='undefined')        window.__fbDoc=doc;
            if(!window.__fbSetDoc     && typeof setDoc!=='undefined')     window.__fbSetDoc=setDoc;
            if(!window.__fbUpdateDoc  && typeof updateDoc!=='undefined')  window.__fbUpdateDoc=updateDoc;
        } catch(e){}
    }

    /* ── Accept game challenge from notification ─────── */
    window.bkAcceptGameChallenge = function(gameId, gameType, fromName) {
        const modal = document.getElementById('bk-game-modal');
        if(modal) modal.style.display='flex';

        if(gameType==='ttt') {
            stopAll();
            state.tttBoard=Array(9).fill(null); state.tttTurn='X';
            state.tttScores={X:0,O:0,draws:0}; state.gameActive=true;
            state.tttMode='online'; state.tttGameId=gameId; state.tttMyMark='O';
            state.tttOpponentName = fromName || 'Opponent';
            state._confettiShown = false;
            subscribeToOnlineTTT(gameId);
        } else if(gameType==='word') {
            stopAll();
            state.gameActive=true;
            state.wordMyRole='B';
            subscribeToOnlineWordGame(gameId);
        }
    };

    window.bkReduceChallengeBadge = function() {
        state.pendingChallenges = Math.max(0, (state.pendingChallenges||1) - 1);
        updateGameFloaterBadge(state.pendingChallenges);
    };

    /* ── Poll for incoming game challenges ───────────── */
    function listenForIncomingChallenges() {
        if(!db()||!C()||!Q()||!W()||!SN()||!DC()) return;
        const myId    = state.currentUser.id||state.currentUser.email||'';
        const myEmail = state.currentUser.email||'';
        if(!myId && !myEmail) return;

        // Watch ttt_games where I am player O and status=waiting
        try {
            const qTTT = Q()(C()(db(),'ttt_games'),
                W()('players.O','==',myId),
                W()('status','==','waiting')
            );
            SN()(qTTT, snap=>{
                snap.docChanges().forEach(change=>{
                    if(change.type==='added'){
                        const g=change.doc.data();
                        showGameChallengeBadge(change.doc.id,'ttt',g.playerNames?.X||'A tutor');
                    }
                });
            });
        } catch(e){ console.warn('TTT invite listen:',e); }

        // Watch word_games where I am player B and status=waiting
        try {
            const qWord = Q()(C()(db(),'word_games'),
                W()('players.B','==',myId),
                W()('status','==','waiting')
            );
            SN()(qWord, snap=>{
                snap.docChanges().forEach(change=>{
                    if(change.type==='added'){
                        const g=change.doc.data();
                        showGameChallengeBadge(change.doc.id,'word',g.playerNames?.A||'A tutor');
                    }
                });
            });
        } catch(e){ console.warn('Word invite listen:',e); }
    }

    function showGameChallengeBadge(gameId, gameType, fromName) {
        if(document.getElementById('bk-challenge-toast-'+gameId)) return;

        playChallengeTone();

        state.pendingChallenges = (state.pendingChallenges||0) + 1;
        updateGameFloaterBadge(state.pendingChallenges);

        const toast = document.createElement('div');
        toast.id = 'bk-challenge-toast-'+gameId;
        toast.style.cssText = 'position:fixed;bottom:220px;right:20px;z-index:9999999;background:linear-gradient(135deg,#4338ca,#6366f1);color:#fff;border-radius:16px;padding:12px 16px;box-shadow:0 8px 28px rgba(99,102,241,.5);cursor:pointer;max-width:260px;animation:bkToastIn .3s ease;';
        const gameLabel = gameType==='ttt' ? 'Tic-Tac-Toe' : 'Word Builder';
        toast.innerHTML = `
            <div style="font-weight:900;font-size:.85rem;margin-bottom:3px;">🎮 Game Challenge!</div>
            <div style="font-size:.75rem;opacity:.9;margin-bottom:8px;">${esc(fromName)} challenged you to ${gameLabel}</div>
            <div style="display:flex;gap:6px;">
                <button onclick="(function(){window.bkAcceptGameChallenge('${gameId}','${gameType}','${esc(fromName)}');var t=document.getElementById('bk-challenge-toast-${gameId}');if(t)t.remove();window.bkReduceChallengeBadge&&window.bkReduceChallengeBadge();})()" style="flex:1;background:#fff;color:#4338ca;border:none;border-radius:8px;padding:6px;font-weight:800;font-size:.75rem;cursor:pointer;">▶ Accept</button>
                <button onclick="(function(){var t=document.getElementById('bk-challenge-toast-${gameId}');if(t)t.remove();window.bkReduceChallengeBadge&&window.bkReduceChallengeBadge();})()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:.75rem;">✕</button>
            </div>`;
        if(!document.getElementById('bk-toast-anim')) {
            const s=document.createElement('style'); s.id='bk-toast-anim';
            s.textContent='@keyframes bkToastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}';
            document.head.appendChild(s);
        }
        document.body.appendChild(toast);
        setTimeout(()=>{ if(toast.parentNode){ toast.remove(); window.bkReduceChallengeBadge&&window.bkReduceChallengeBadge(); } }, 30000);
    }

    window.addEventListener('load', ()=>{ bridge(); setTimeout(bridge,2000); initWidget(); setTimeout(listenForIncomingChallenges, 3000); });

})();
