// Interface meneur
const socket = io();

let currentSessionId = null;
let grid = [];
let currentCellIndex = null;
let currentCell = null;
let cellAnswers = {}; // { cellIndex: 'correct' | 'incorrect' | 'pass' }

// Phase 2 : question finale (si le meneur est sélectionné pour répondre)
let finalQuestionTimerId = null;
let finalQuestionRemaining = 0;

// État de la session (une seule partie à la fois)
let sessionAvailable = false;
let sessionMaxPlayers = null;
let sessionCurrentPlayers = 0;

// Éléments DOM
const joinScreen = document.getElementById('join-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const endGameScreen = document.getElementById('end-game-screen');
const sessionStatusEl = document.getElementById('sessionStatus');
const joinBtn = document.getElementById('joinBtn');
const finalQuestionOverlay = document.getElementById('final-question-overlay');

function updateSessionStatus() {
    if (sessionStatusEl) {
        if (!sessionAvailable) {
            sessionStatusEl.textContent = 'En attente de la création de la partie...';
        } else if (sessionMaxPlayers != null) {
            sessionStatusEl.textContent = `${sessionCurrentPlayers}/${sessionMaxPlayers} joueurs connectés`;
        }
    }
    if (joinBtn) {
        joinBtn.disabled = !sessionAvailable;
    }
}

// Rejoindre la session (sans code, une seule partie)
joinBtn.addEventListener('click', () => {
    const playerName = document.getElementById('playerNameInput').value.trim();
    
    if (!playerName) {
        showError('Veuillez entrer votre nom');
        return;
    }
    if (!sessionAvailable) {
        showError('Aucune partie n\'est disponible pour le moment.');
        return;
    }
    
    // Le meneur rejoint comme un joueur normal, mais sera identifié comme meneur plus tard
    socket.emit('player:join-session', { playerName: playerName });
});

// Connexion réussie
socket.on('player:joined', (data) => {
    currentSessionId = data.sessionId || currentSessionId;
    showScreen('waiting-screen');
});

// Erreur de connexion
socket.on('player:join-error', (data) => {
    showError(data.message);
});

// Informations sur l'existence ou non d'une partie
socket.on('session:none', () => {
    sessionAvailable = false;
    sessionCurrentPlayers = 0;
    sessionMaxPlayers = null;
    updateSessionStatus();
});

socket.on('session:created', (data) => {
    sessionAvailable = true;
    sessionMaxPlayers = data.maxPlayers;
    updateSessionStatus();
});

socket.on('session:player-count', (data) => {
    sessionAvailable = true;
    sessionCurrentPlayers = data.current;
    sessionMaxPlayers = data.max;
    updateSessionStatus();
});

// Meneur sélectionné
socket.on('session:leader-selected', (data) => {
    // Vérifier si c'est ce client qui a été sélectionné
    if (data.leaderId === socket.id) {
        // Le meneur reste sur l'écran d'attente jusqu'à recevoir la grille
        document.querySelector('#waiting-screen h1').textContent = 'Vous êtes le meneur !';
        document.querySelector('#waiting-screen p').textContent = 'En attente que le maître du jeu lance la partie...';
    }
});

// Recevoir la grille
socket.on('leader:grid-received', (data) => {
    grid = data.grid;
    cellAnswers = {}; // Réinitialiser les réponses
    showScreen('game-screen');
    renderGrid();
});

// Révéler un thème (afficher le nom)
socket.on('leader:theme-revealed', (data) => {
    const { cellIndex, name } = data;
    currentCellIndex = cellIndex;
    currentCell = grid[cellIndex];
    
    // Afficher le nom
    document.getElementById('cellName').textContent = name;
    document.getElementById('cellName').classList.remove('cell-name-hidden');
    document.getElementById('cellCategory').textContent = currentCell.category;
    document.getElementById('cell-details').style.display = 'block';
    // Réinitialiser le bouton (au cas où)
    document.getElementById('showPropositionsBtn').classList.remove('btn-active');
    // Re-rendre la grille pour afficher la cellule en jaune
    renderGrid();
});

// Rendre la grille
function renderGrid() {
    const gridElement = document.getElementById('grid');
    gridElement.innerHTML = '';
    
    grid.forEach((cell, index) => {
        const cellDiv = document.createElement('div');
        cellDiv.className = 'grid-cell';
        
        // Appliquer les classes selon l'état de la cellule
        const answer = cellAnswers[index];
        if (answer === 'correct') {
            cellDiv.classList.add('grid-cell-correct');
        } else if (answer === 'incorrect' || answer === 'pass') {
            cellDiv.classList.add('grid-cell-incorrect');
        } else if (currentCellIndex === index) {
            // Cellule sélectionnée (en attente de réponse) - jaune
            cellDiv.classList.add('grid-cell-selected');
        }
        
        cellDiv.textContent = cell.category;
        cellDiv.dataset.index = index;
        
        cellDiv.addEventListener('click', () => {
            // Ne permettre le clic que si la cellule n'a pas encore été répondue
            if (!cellAnswers[index] && (currentCellIndex === null || currentCellIndex === index)) {
                socket.emit('leader:reveal-theme', {
                    sessionId: currentSessionId,
                    cellIndex: index
                });
            }
        });
        
        gridElement.appendChild(cellDiv);
    });
}

// Afficher les propositions aux joueurs
document.getElementById('showPropositionsBtn').addEventListener('click', () => {
    if (currentCellIndex !== null) {
        socket.emit('leader:show-propositions', {
            sessionId: currentSessionId,
            cellIndex: currentCellIndex
        });
        // Marquer le bouton comme actif (jaune)
        document.getElementById('showPropositionsBtn').classList.add('btn-active');
    }
});

// Passer (cacher les propositions)
document.getElementById('passBtn').addEventListener('click', () => {
    socket.emit('leader:pass', {
        sessionId: currentSessionId
    });
    
    // Réinitialiser l'affichage
    document.getElementById('cell-details').style.display = 'none';
    document.getElementById('cellName').classList.add('cell-name-hidden');
    document.getElementById('showPropositionsBtn').classList.remove('btn-active');
    currentCellIndex = null;
    currentCell = null;
    renderGrid(); // Re-rendre pour enlever le jaune
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

// Mise à jour d'une cellule (réponse donnée)
socket.on('leader:cell-updated', (data) => {
    const { cellIndex, status } = data;
    cellAnswers[cellIndex] = status;
    // Si c'est la cellule actuelle, réinitialiser
    if (currentCellIndex === cellIndex) {
        currentCellIndex = null;
        currentCell = null;
        document.getElementById('showPropositionsBtn').classList.remove('btn-active');
    }
    renderGrid(); // Re-rendre la grille pour afficher la nouvelle couleur
});

// Mise à jour complète de la grille (ligne/diagonale détectée)
socket.on('leader:grid-updated', (data) => {
    grid = data.grid;
    cellAnswers = data.cellAnswers || {};
    renderGrid(); // Re-rendre la grille complète avec les nouveaux mots
});

// Cacher le menu après une réponse correcte
socket.on('leader:hide-menu', () => {
    document.getElementById('cell-details').style.display = 'none';
    document.getElementById('cellName').classList.add('cell-name-hidden');
    document.getElementById('showPropositionsBtn').classList.remove('btn-active');
    currentCellIndex = null;
    currentCell = null;
    renderGrid(); // Re-rendre pour enlever le jaune
});

// Partie démarrée
socket.on('session:game-started', (data) => {
    currentSessionId = data.sessionId || currentSessionId;
});

// Fonction pour afficher les erreurs
function showError(message) {
    const errorDiv = document.getElementById('joinError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Fin de partie (temps écoulé) - cet événement n'est plus utilisé pour terminer la partie
socket.on('session:game-ended', (data) => {
    // La fin réelle arrive via session:final-score après la phase 2.
});

// Défaite (vies épuisées) - remplacée par la phase de questions
socket.on('session:defeat', (data) => {
    // On ne montre plus d'écran de défaite ici.
});

// Session arrêtée
socket.on('session:stopped', (data) => {
    currentSessionId = null;
    grid = [];
    currentCellIndex = null;
    currentCell = null;
    showScreen('join-screen');
    document.getElementById('playerNameInput').value = '';
    
    if (data && data.message) {
        showGamePopup({ message: data.message });
    }
    sessionAvailable = false;
    sessionCurrentPlayers = 0;
    sessionMaxPlayers = null;
    updateSessionStatus();
});

// Début de la phase 2 (information simple)
socket.on('session:questions-phase-start', (data) => {
    // On ne doit plus voir la grille de thèmes ni les détails de cellule
    const gridContainer = document.getElementById('grid-container');
    const cellDetails = document.getElementById('cell-details');
    if (gridContainer) {
        gridContainer.style.display = 'none';
    }
    if (cellDetails) {
        cellDetails.style.display = 'none';
    }
});

// Score final (après la phase 2)
socket.on('session:final-score', (data) => {
    showScreen('end-game-screen');
    document.getElementById('endGameTitle').textContent = 'Partie terminée';
    document.getElementById('endGameMessage').textContent = `Score final : ${data.score} points`;
});

// Phase 2 : afficher une question finale chez le meneur
socket.on('player:show-final-question', (data) => {
    // Cet événement sera reçu uniquement si le meneur est le joueur sélectionné
    if (!finalQuestionOverlay) return;

    const themeEl = document.getElementById('finalQuestionTheme');
    const textEl = document.getElementById('finalQuestionText');
    const timerEl = document.getElementById('finalQuestionTimer');

    if (themeEl) {
        themeEl.textContent = `Thème : ${data.category} — ${data.points} points`;
    }
    if (textEl) {
        textEl.textContent = data.question || '';
    }

    finalQuestionRemaining = data.duration || 60;
    if (timerEl) {
        timerEl.textContent = finalQuestionRemaining.toString();
    }

    finalQuestionOverlay.style.display = 'flex';

    if (finalQuestionTimerId) {
        clearInterval(finalQuestionTimerId);
    }
    finalQuestionTimerId = setInterval(() => {
        finalQuestionRemaining = Math.max(0, finalQuestionRemaining - 1);
        if (timerEl) {
            timerEl.textContent = finalQuestionRemaining.toString();
        }
        if (finalQuestionRemaining <= 0) {
            clearInterval(finalQuestionTimerId);
            finalQuestionTimerId = null;
        }
    }, 1000);
});

// Phase 2 : cacher la question finale chez le meneur
socket.on('player:hide-final-question', () => {
    if (finalQuestionTimerId) {
        clearInterval(finalQuestionTimerId);
        finalQuestionTimerId = null;
    }
    if (finalQuestionOverlay) {
        finalQuestionOverlay.style.display = 'none';
    }
});

// Début de la phase 2 (information simple)
socket.on('session:questions-phase-start', (data) => {
    // Le meneur reste sur son écran de jeu, mais sait qu'une phase de questions est en cours.
});

// Score final (après la phase 2)
socket.on('session:final-score', (data) => {
    showScreen('end-game-screen');
    document.getElementById('endGameTitle').textContent = 'Partie terminée';
    document.getElementById('endGameMessage').textContent = `Score final : ${data.score} points`;
});

// Fonctions utilitaires
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}
