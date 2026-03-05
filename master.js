// Interface maître du jeu
const socket = io();

let currentSessionId = null;
let maxPlayers = 4;
let players = [];
let selectedLeaderId = null;
let selectedThemes = [];
let allCategories = [];
let grid = [];
let cellAnswers = {};

// Phase 2 : questions finales
let questions = [];
let currentQuestionIndex = null;

// Éléments DOM
const createSessionScreen = document.getElementById('create-session-screen');
const waitingPlayersScreen = document.getElementById('waiting-players-screen');
const selectLeaderScreen = document.getElementById('select-leader-screen');
const selectThemesScreen = document.getElementById('select-themes-screen');
const gameScreen = document.getElementById('game-screen');
const endGameScreen = document.getElementById('end-game-screen');
const masterGridEl = document.getElementById('master-grid');
const questionsSection = document.getElementById('questions-section');
const questionsListEl = document.getElementById('questions-list');
const questionPlayerSelectEl = document.getElementById('questionPlayerSelect');
const currentQuestionThemeEl = document.getElementById('currentQuestionTheme');
const currentQuestionTextEl = document.getElementById('currentQuestionText');
const currentQuestionAnswerEl = document.getElementById('currentQuestionAnswer');

// Créer une session
document.getElementById('createSessionBtn').addEventListener('click', () => {
    maxPlayers = parseInt(document.getElementById('maxPlayers').value);
    socket.emit('master:create-session', { maxPlayers });
});

// Arrêter la session
document.getElementById('stopSessionBtn')?.addEventListener('click', () => {
    if (currentSessionId) {
        socket.emit('master:stop-session', { sessionId: currentSessionId });
    }
});

// Bouton pour choisir le meneur
document.getElementById('selectLeaderBtn')?.addEventListener('click', () => {
    if (players.length > 0) {
        showScreen('select-leader-screen');
        renderLeaderSelection();
    }
});

// Session créée
socket.on('master:session-created', (data) => {
    currentSessionId = data.sessionId;
    const info = document.getElementById('sessionInfo');
    if (info) {
        info.style.display = 'block';
    }
    showScreen('waiting-players-screen');
});

// Joueur rejoint
socket.on('session:player-joined', (data) => {
    players = data.players;
    renderPlayersList();
    // Permettre la sélection du meneur dès qu'il y a des joueurs
    if (players.length > 0) {
        const selectLeaderBtn = document.getElementById('selectLeaderBtn');
        if (selectLeaderBtn) {
            selectLeaderBtn.style.display = 'block';
        }
    }
});

// Joueur mis à jour
socket.on('session:player-updated', (data) => {
    players = data.players;
    renderPlayersList();
});

// Joueur prêt
socket.on('session:player-ready', (data) => {
    players = data.players;
    renderPlayersList();
});

// Meneur sélectionné
socket.on('session:leader-selected', (data) => {
    // Si le meneur est sélectionné, vérifier si on peut passer à la sélection des thèmes
    // (cela sera géré par master:all-players-ready)
});

// En attente des joueurs (après sélection du meneur)
socket.on('master:waiting-for-players', (data) => {
    showScreen('waiting-players-screen');
    // Le message sera affiché via renderPlayersList
});

// Afficher la sélection des thèmes (quand tous les joueurs sont prêts)
socket.on('master:show-theme-selection', (data) => {
    allCategories = data.categories;
    showScreen('select-themes-screen');
    renderThemesSelection();
});

// Afficher la sélection de thèmes
socket.on('master:show-theme-selection', (data) => {
    allCategories = data.categories;
    showScreen('select-themes-screen');
    renderThemesSelection();
});

// Partie démarrée
socket.on('master:game-started', (data) => {
    showScreen('game-screen');
    if (data) {
        if (data.score != null) document.getElementById('gameScore').textContent = data.score;
        if (data.lives != null) document.getElementById('gameLives').textContent = data.lives;
        if (data.energy != null) {
            const energyEl = document.getElementById('gameEnergy');
            if (energyEl) energyEl.textContent = data.energy;
        }
    }
});

// Début de la phase 2 (information générale)
socket.on('session:questions-phase-start', (data) => {
    showScreen('game-screen');
    if (questionsSection) {
        questionsSection.style.display = 'block';
    }
});

// Phase 2 : réception des questions côté maître
socket.on('master:questions-start', (data) => {
    questions = data.questions || [];
    if (questionsSection) {
        questionsSection.style.display = 'block';
    }
    currentQuestionIndex = questions.length > 0 ? questions[0].index : null;
    renderQuestionsList();
    updateCurrentQuestionPanel();
});

// Mise à jour de la grille pour le maître du jeu
socket.on('master:grid-updated', (data) => {
    grid = data.grid || [];
    cellAnswers = data.cellAnswers || {};
    renderMasterGrid();
});

// Mise à jour du jeu
socket.on('session:game-update', (data) => {
    if (data.score != null) {
        document.getElementById('gameScore').textContent = data.score;
    }
    if (data.lives != null) {
        document.getElementById('gameLives').textContent = data.lives;
    }
    if (data.energy != null) {
        const energyEl = document.getElementById('gameEnergy');
        if (energyEl) energyEl.textContent = data.energy;
    }
});

// Mise à jour du timer
socket.on('session:timer-update', (data) => {
    const minutes = Math.floor(data.timer / 60);
    const seconds = data.timer % 60;
    document.getElementById('gameTimer').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Fin de partie (temps écoulé) - affichage du score
socket.on('session:game-ended', (data) => {
    showScreen('end-game-screen');
    document.getElementById('endGameTitle').textContent = 'Partie terminée';
    document.getElementById('endGameMessage').textContent = `Le temps est écoulé. Score final : ${data.score} points`;
});

// Défaite (vies épuisées)
socket.on('session:defeat', (data) => {
    showScreen('end-game-screen');
    document.getElementById('endGameTitle').textContent = 'Défaite';
    document.getElementById('endGameMessage').textContent = 'Les vies sont épuisées';
});

// Session arrêtée
socket.on('session:stopped', (data) => {
    currentSessionId = null;
    players = [];
    selectedLeaderId = null;
    selectedThemes = [];
    showScreen('create-session-screen');
    document.getElementById('sessionInfo').style.display = 'none';
    
    if (data && data.message) {
        showGamePopup({ message: data.message });
    }
});

// Score final (après la phase 2)
socket.on('session:final-score', (data) => {
    showScreen('end-game-screen');
    document.getElementById('endGameTitle').textContent = 'Partie terminée';
    document.getElementById('endGameMessage').textContent = `Score final : ${data.score} points`;
});

// Nouvelle partie
document.getElementById('newGameBtn')?.addEventListener('click', () => {
    // Arrêter proprement la session en cours pour remettre
    // les interfaces meneur / joueurs à l'état initial
    if (currentSessionId) {
        socket.emit('master:stop-session', { sessionId: currentSessionId });
    }
    showScreen('create-session-screen');
    const info = document.getElementById('sessionInfo');
    if (info) {
        info.style.display = 'none';
    }
});

// Boutons pour arrêter la session (écrans attente + jeu)
['stopSessionBtn', 'stopSessionBtnGame'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
        btn.addEventListener('click', () => {
            if (currentSessionId) {
                socket.emit('master:stop-session', { sessionId: currentSessionId });
            }
        });
    }
});

// Fonctions utilitaires
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function renderPlayersList() {
    const list = document.getElementById('playersList');
    list.innerHTML = '';
    
    if (players.length === 0) {
        list.innerHTML = '<p>Aucun joueur connecté</p>';
        return;
    }
    
    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        const isLeader = selectedLeaderId === player.id;
        const leaderBadge = isLeader ? '<span class="leader-badge">👑 Meneur</span>' : '';
        div.innerHTML = `
            <span class="player-name">${player.name} ${leaderBadge}</span>
            <span class="player-status ${player.ready ? 'ready' : 'not-ready'}">
                ${player.ready ? '✓ Prêt' : 'En attente'}
            </span>
            ${player.totalPoints !== undefined && !isLeader ? `<span class="player-points">Points: ${player.totalPoints}/3</span>` : ''}
        `;
        list.appendChild(div);
    });
    
    // Afficher un message si le meneur est sélectionné mais que tous les joueurs ne sont pas prêts
    if (selectedLeaderId) {
        const playersToCheck = players.filter(p => p.id !== selectedLeaderId);
        const allReady = playersToCheck.length === (maxPlayers - 1) && playersToCheck.every(p => p.ready);
        if (!allReady) {
            const waitingMsg = document.createElement('p');
            waitingMsg.className = 'waiting-message';
            waitingMsg.textContent = 'Meneur sélectionné. En attente que tous les joueurs soient prêts...';
            waitingMsg.style.marginTop = '20px';
            waitingMsg.style.padding = '15px';
            waitingMsg.style.background = '#fff3cd';
            waitingMsg.style.borderRadius = '8px';
            list.appendChild(waitingMsg);
        }
    }
}

function renderLeaderSelection() {
    const list = document.getElementById('leaderList');
    list.innerHTML = '';
    
    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item clickable';
        div.innerHTML = `<span class="player-name">${player.name}</span>`;
        div.addEventListener('click', () => {
            selectedLeaderId = player.id;
            socket.emit('master:select-leader', {
                sessionId: currentSessionId,
                leaderId: player.id
            });
        });
        list.appendChild(div);
    });
}

// Rendre la liste des questions (phase 2)
function renderQuestionsList() {
    if (!questionsListEl) return;
    questionsListEl.innerHTML = '';

    questions.forEach((q) => {
        const div = document.createElement('div');
        div.className = 'question-item';
        const status = q.answered ? (q.correct ? '✅' : '✖️') : '⏳';
        const pointsLabel = `${q.points} pts`;
        div.textContent = `${status} Q${q.index + 1} - ${q.category} (${pointsLabel})`;
        if (currentQuestionIndex === q.index) {
            div.classList.add('question-item-current');
        }
        questionsListEl.appendChild(div);
    });
}

function getCurrentQuestion() {
    if (!Array.isArray(questions)) return null;
    return questions.find(q => q.index === currentQuestionIndex) || null;
}

function updateCurrentQuestionPanel() {
    const q = getCurrentQuestion();
    if (!q) {
        if (currentQuestionThemeEl) currentQuestionThemeEl.textContent = '';
        if (currentQuestionTextEl) currentQuestionTextEl.textContent = 'Toutes les questions ont été posées.';
        if (currentQuestionAnswerEl) currentQuestionAnswerEl.textContent = '';
        return;
    }

    if (currentQuestionThemeEl) {
        currentQuestionThemeEl.textContent = `Thème : ${q.category} — ${q.points} points`;
    }
    if (currentQuestionTextEl) {
        currentQuestionTextEl.textContent = q.questionText || '';
    }
    if (currentQuestionAnswerEl) {
        currentQuestionAnswerEl.textContent = q.itemName 
            ? `Réponse : ${q.itemName}`
            : '';
    }

    // Remplir la liste des joueurs
    if (questionPlayerSelectEl) {
        questionPlayerSelectEl.innerHTML = '';
        players.forEach((p) => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.name;
            questionPlayerSelectEl.appendChild(option);
        });
    }

    // Réinitialiser les boutons d'action
    const showBtn = document.getElementById('showQuestionToPlayerBtn');
    const correctBtn = document.getElementById('questionCorrectBtn');
    const incorrectBtn = document.getElementById('questionIncorrectBtn');
    if (showBtn) showBtn.disabled = true;
    if (correctBtn) correctBtn.disabled = true;
    if (incorrectBtn) incorrectBtn.disabled = true;
}

// Mise à jour après sélection du joueur côté serveur
socket.on('master:question-player-selected', (data) => {
    const showBtn = document.getElementById('showQuestionToPlayerBtn');
    if (showBtn) showBtn.disabled = false;
});

// Quand la question est affichée au joueur
socket.on('master:question-shown', (data) => {
    const correctBtn = document.getElementById('questionCorrectBtn');
    const incorrectBtn = document.getElementById('questionIncorrectBtn');
    if (correctBtn) correctBtn.disabled = false;
    if (incorrectBtn) incorrectBtn.disabled = false;
});

// Quand le serveur indique la prochaine question
socket.on('master:next-question-ready', (data) => {
    currentQuestionIndex = data.questionIndex;
    renderQuestionsList();
    updateCurrentQuestionPanel();
});

socket.on('session:leader-selected', (data) => {
    selectedLeaderId = data.leaderId;
    const leader = players.find(p => p.id === data.leaderId);
    if (leader) {
        document.getElementById('selectedLeaderName').textContent = leader.name;
    }
    // Mettre à jour la liste des joueurs pour afficher le meneur
    renderPlayersList();
});

// Boutons de la phase 2 (sélection du joueur et validation de la réponse)
const selectQuestionPlayerBtn = document.getElementById('selectQuestionPlayerBtn');
if (selectQuestionPlayerBtn) {
    selectQuestionPlayerBtn.addEventListener('click', () => {
        const q = getCurrentQuestion();
        if (!q || !currentSessionId || !questionPlayerSelectEl) return;
        const playerId = questionPlayerSelectEl.value;
        if (!playerId) return;

        socket.emit('master:select-question-player', {
            sessionId: currentSessionId,
            questionIndex: q.index,
            playerId
        });
    });
}

const showQuestionToPlayerBtn = document.getElementById('showQuestionToPlayerBtn');
if (showQuestionToPlayerBtn) {
    showQuestionToPlayerBtn.addEventListener('click', () => {
        if (!currentSessionId) return;
        socket.emit('master:show-question-to-player', { sessionId: currentSessionId });
    });
}

const questionCorrectBtn = document.getElementById('questionCorrectBtn');
if (questionCorrectBtn) {
    questionCorrectBtn.addEventListener('click', () => {
        if (!currentSessionId) return;
        socket.emit('master:question-result', {
            sessionId: currentSessionId,
            correct: true
        });
    });
}

const questionIncorrectBtn = document.getElementById('questionIncorrectBtn');
if (questionIncorrectBtn) {
    questionIncorrectBtn.addEventListener('click', () => {
        if (!currentSessionId) return;
        socket.emit('master:question-result', {
            sessionId: currentSessionId,
            correct: false
        });
    });
}

// Contrôles du chrono côté maître du jeu
const timerStartBtn = document.getElementById('timerStartBtn');
const timerPauseBtn = document.getElementById('timerPauseBtn');
const timerResetBtn = document.getElementById('timerResetBtn');

if (timerStartBtn) {
    timerStartBtn.addEventListener('click', () => {
        if (!currentSessionId) return;
        socket.emit('master:timer-start', { sessionId: currentSessionId });
    });
}

if (timerPauseBtn) {
    timerPauseBtn.addEventListener('click', () => {
        if (!currentSessionId) return;
        socket.emit('master:timer-pause', { sessionId: currentSessionId });
    });
}

if (timerResetBtn) {
    timerResetBtn.addEventListener('click', () => {
        if (!currentSessionId) return;
        socket.emit('master:timer-reset', { sessionId: currentSessionId });
    });
}

function renderThemesSelection() {
    const list = document.getElementById('themesList');
    list.innerHTML = '';
    selectedThemes = [];
    updateSelectedThemes();
    
    allCategories.forEach(category => {
        const div = document.createElement('div');
        div.className = 'theme-item';
        div.textContent = category;
        div.addEventListener('click', () => {
            if (selectedThemes.includes(category)) {
                selectedThemes = selectedThemes.filter(t => t !== category);
            } else if (selectedThemes.length < 3) {
                selectedThemes.push(category);
            }
            updateSelectedThemes();
        });
        list.appendChild(div);
    });
}

function updateSelectedThemes() {
    const selectedList = document.getElementById('selectedThemesList');
    selectedList.innerHTML = '';
    
    selectedThemes.forEach(theme => {
        const span = document.createElement('span');
        span.className = 'selected-theme';
        span.textContent = theme;
        span.addEventListener('click', () => {
            selectedThemes = selectedThemes.filter(t => t !== theme);
            updateSelectedThemes();
        });
        selectedList.appendChild(span);
    });
    
    document.getElementById('selectedThemes').querySelector('h3').textContent = 
        `Thèmes sélectionnés (${selectedThemes.length}/3) :`;
    
    const startBtn = document.getElementById('startGameBtn');
    startBtn.disabled = selectedThemes.length !== 3;
}

document.getElementById('startGameBtn').addEventListener('click', () => {
    if (selectedThemes.length === 3) {
        socket.emit('master:select-themes', {
            sessionId: currentSessionId,
            themes: selectedThemes
        });
    }
});

function renderMasterGrid() {
    if (!masterGridEl) return;
    masterGridEl.innerHTML = '';
    
    if (!Array.isArray(grid) || grid.length === 0) return;
    
    grid.forEach((cell, index) => {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'grid-cell';
        
        const answer = cellAnswers[index];
        if (answer === 'correct') {
            cellDiv.classList.add('grid-cell-correct');
        } else if (answer === 'incorrect' || answer === 'pass') {
            cellDiv.classList.add('grid-cell-incorrect');
        }
        
        cellDiv.textContent = cell.category;
        masterGridEl.appendChild(cellDiv);
    });
}
