// Interface maître du jeu
const socket = io();

let currentSessionId = null;
let maxPlayers = 4;
let players = [];
let selectedLeaderId = null;
let selectedThemes = [];
let allCategories = [];

// Éléments DOM
const createSessionScreen = document.getElementById('create-session-screen');
const waitingPlayersScreen = document.getElementById('waiting-players-screen');
const selectLeaderScreen = document.getElementById('select-leader-screen');
const selectThemesScreen = document.getElementById('select-themes-screen');
const gameScreen = document.getElementById('game-screen');
const endGameScreen = document.getElementById('end-game-screen');

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
socket.on('master:game-started', () => {
    showScreen('game-screen');
});

// Mise à jour du jeu
socket.on('session:game-update', (data) => {
    document.getElementById('gameScore').textContent = data.score;
    document.getElementById('gameLives').textContent = data.lives;
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

// Nouvelle partie
document.getElementById('newGameBtn')?.addEventListener('click', () => {
    showScreen('create-session-screen');
    document.getElementById('sessionInfo').style.display = 'none';
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

socket.on('session:leader-selected', (data) => {
    selectedLeaderId = data.leaderId;
    const leader = players.find(p => p.id === data.leaderId);
    if (leader) {
        document.getElementById('selectedLeaderName').textContent = leader.name;
    }
    // Mettre à jour la liste des joueurs pour afficher le meneur
    renderPlayersList();
});

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
