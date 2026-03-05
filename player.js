// Interface joueur
const socket = io();

let currentSessionId = null;
let playerId = null;
let playerName = '';
let themeValues = {};
let selectedPower = null;
let allCategories = [];
let currentCellIndex = null;

// Phase 2 : question finale
let finalQuestionTimerId = null;
let finalQuestionRemaining = 0;

// État de la session côté client (une seule partie à la fois)
let sessionAvailable = false;
let sessionMaxPlayers = null;
let sessionCurrentPlayers = 0;

// Éléments DOM
const joinScreen = document.getElementById('join-screen');
const configScreen = document.getElementById('config-screen');
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

// Rejoindre une session (unique, sans code)
joinBtn.addEventListener('click', () => {
    const name = document.getElementById('playerNameInput').value.trim();
    
    if (!name) {
        showError('Veuillez entrer votre nom');
        return;
    }
    if (!sessionAvailable) {
        showError('Aucune partie n\'est disponible pour le moment.');
        return;
    }
    
    playerName = name;
    socket.emit('player:join-session', { playerName: name });
});

// Connexion réussie
socket.on('player:joined', (data) => {
    playerId = data.playerId;
    currentSessionId = data.sessionId;
    showScreen('config-screen');
    loadCategories();
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
    // Le nombre de joueurs sera mis à jour par session:player-count
    updateSessionStatus();
});

socket.on('session:player-count', (data) => {
    sessionAvailable = true;
    sessionCurrentPlayers = data.current;
    sessionMaxPlayers = data.max;
    updateSessionStatus();
});

// Charger les catégories depuis le serveur
async function loadCategories() {
    try {
        const response = await fetch('/data.json');
        const data = await response.json();
        const categories = [...new Set(data.map(item => item.category))].sort();
        allCategories = categories;
        renderThemesConfig();
    } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
    }
}

// Rendre la configuration des thèmes
function renderThemesConfig() {
    const container = document.getElementById('themesConfig');
    container.innerHTML = '';
    
    allCategories.forEach(category => {
        const div = document.createElement('div');
        div.className = 'theme-config-item';
        div.innerHTML = `
            <span class="theme-name">${category}</span>
            <div class="theme-controls">
                <button class="btn-small" onclick="changeThemeValue('${category}', -1)">-</button>
                <span class="theme-value" id="theme-${category.replace(/\s+/g, '-')}">${themeValues[category] || 0}</span>
                <button class="btn-small" onclick="changeThemeValue('${category}', 1)">+</button>
            </div>
        `;
        container.appendChild(div);
    });
    
    renderPowersConfig();
    updatePointsSum();
}

const POWER_LABELS = {
    grille: 'Grille',
    indice: 'Indice',
    vie: 'Vie',
    points: 'Points',
    rafraichissement: 'Rafraîchissement'
};

const POWER_DESCRIPTIONS = {
    grille: 'Réduit le nombre de propositions pour la case actuelle. Avec 1 joueur : 6 propositions, avec 2 ou plus : 3 propositions.',
    indice: 'Affiche un indice sur la case actuelle. Avec 1 joueur : un mot indice, avec 2 ou plus : une phrase indice.',
    vie: 'Ajoute des vies à l’équipe sur la prochaine bonne réponse (autant de vies que de joueurs ayant ce pouvoir, jusqu’à 10 vies maximum).',
    points: 'Multiplie les points de la prochaine bonne réponse (×2, ×3 ou ×4 selon le nombre de joueurs ayant ce pouvoir).',
    rafraichissement: 'Remplace tous les mots des cases déjà noires (mauvaises réponses ou “pass”), une seule fois par partie.'
};

function renderPowersConfig() {
    const container = document.getElementById('powersConfig');
    if (!container) return;
    container.innerHTML = '';
    
    Object.entries(POWER_LABELS).forEach(([id, label]) => {
        const btn = document.createElement('button');
        btn.className = 'power-select-btn' + (selectedPower === id ? ' selected' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => {
            selectedPower = id;
            renderPowersConfig();
            socket.emit('player:update-power', { sessionId: currentSessionId, power: id });
            const descEl = document.getElementById('powerDescription');
            if (descEl) {
                descEl.textContent = POWER_DESCRIPTIONS[id] || '';
            }
            // Réévaluer immédiatement l'état du bouton Prêt après le choix du pouvoir
            updatePointsSum();
        });
        container.appendChild(btn);
    });

    // Mettre à jour la description si un pouvoir est déjà sélectionné
    const descEl = document.getElementById('powerDescription');
    if (descEl) {
        if (selectedPower) {
            descEl.textContent = POWER_DESCRIPTIONS[selectedPower] || '';
        } else {
            descEl.textContent = 'Sélectionnez un pouvoir pour voir sa description.';
        }
    }
}

// Changer la valeur d'un thème
window.changeThemeValue = function(category, change) {
    const current = themeValues[category] || 0;
    const newValue = Math.max(0, current + change);
    themeValues[category] = newValue;
    
    const element = document.getElementById(`theme-${category.replace(/\s+/g, '-')}`);
    if (element) {
        element.textContent = newValue;
    }
    
    updatePointsSum();
    
    // Envoyer la mise à jour au serveur
    socket.emit('player:update-theme-values', {
        sessionId: currentSessionId,
        themeValues: themeValues
    });
};

// Mettre à jour la somme des points
function updatePointsSum() {
    const sum = Object.values(themeValues).reduce((total, val) => total + val, 0);
    document.getElementById('pointsSum').textContent = sum;
    
    const readyBtn = document.getElementById('readyBtn');
    // Le joueur doit avoir distribué exactement 3 points ET choisi un pouvoir
    readyBtn.disabled = !(sum === 3 && selectedPower);
}

// Se déclarer prêt
document.getElementById('readyBtn').addEventListener('click', () => {
    const sum = Object.values(themeValues).reduce((total, val) => total + val, 0);
    if (sum === 3 && selectedPower) {
        socket.emit('player:ready', { sessionId: currentSessionId });
        showScreen('waiting-screen');
    }
});

// Erreur de prêt
socket.on('player:ready-error', (data) => {
    showError(data.message);
    showScreen('config-screen');
});

// Partie démarrée
socket.on('session:game-started', (data) => {
    showScreen('game-screen');
});

// Phase 2 : début (information simple)
socket.on('session:questions-phase-start', (data) => {
    // On reste sur l'écran de jeu, rien de spécial à faire ici
});

// Afficher les propositions
socket.on('player:show-propositions', (data) => {
    const { category, propositions, cellIndex, availablePowers = {} } = data;
    currentCellIndex = cellIndex;
    
    document.getElementById('propositionCategory').textContent = category;
    document.getElementById('propositions-container').style.display = 'block';
    document.getElementById('waiting-message').style.display = 'none';
    
    // Boutons de pouvoirs (affichés seulement si au moins 1 joueur a le pouvoir)
    const powersContainer = document.getElementById('powers-buttons');
    powersContainer.innerHTML = '';
    if (Object.keys(availablePowers).length > 0) {
        Object.entries(availablePowers).forEach(([powerId, count]) => {
            const btn = document.createElement('button');
            btn.className = 'power-btn';
            btn.textContent = POWER_LABELS[powerId] || powerId;
            btn.addEventListener('click', () => {
                socket.emit('player:use-power', {
                    sessionId: currentSessionId,
                    power: powerId,
                    cellIndex: cellIndex
                });
            });
            powersContainer.appendChild(btn);
        });
    }
    
    renderPropositions(propositions, cellIndex);
});

// Phase 2 : afficher une question finale pour ce joueur
socket.on('player:show-final-question', (data) => {
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

// Phase 2 : cacher la question finale
socket.on('player:hide-final-question', () => {
    if (finalQuestionTimerId) {
        clearInterval(finalQuestionTimerId);
        finalQuestionTimerId = null;
    }
    if (finalQuestionOverlay) {
        finalQuestionOverlay.style.display = 'none';
    }
});

function renderPropositions(propositions, cellIndex) {
    const grid = document.getElementById('propositions-grid');
    grid.innerHTML = '';
    
    propositions.forEach(proposition => {
        const button = document.createElement('button');
        button.className = 'proposition-btn';
        button.textContent = proposition;
        button.addEventListener('click', () => {
            socket.emit('player:answer', {
                sessionId: currentSessionId,
                cellIndex: cellIndex,
                answer: proposition
            });
        });
        grid.appendChild(button);
    });
}

socket.on('player:propositions-updated', (data) => {
    if (currentCellIndex !== null) {
        renderPropositions(data.propositions, currentCellIndex);
    }
});

socket.on('player:indice-revealed', (data) => {
    showGamePopup({ title: data.type === 'phrase' ? 'Indice (phrase)' : (data.type === 'mot' ? 'Indice (mot)' : 'Info'), message: data.hint });
});

socket.on('player:power-activated', (data) => {
    const labels = { vie: 'Vie', points: 'Points' };
    showGamePopup({ title: 'Pouvoir activé', message: `${labels[data.power]} sera appliqué à la prochaine bonne réponse !` });
});

// Cacher les propositions
socket.on('player:hide-propositions', () => {
    document.getElementById('propositions-container').style.display = 'none';
    document.getElementById('waiting-message').style.display = 'block';
    currentCellIndex = null;
});

// Résultat de la réponse
socket.on('player:answer-result', (data) => {
    if (data.correct) {
        showGamePopup({ icon: '✓', title: 'Correct !', message: `+${data.points} points` });
    } else {
        showGamePopup({ icon: '✗', title: 'Incorrect', message: '-1 vie' });
    }
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

// Bonus points (ligne/diagonale complétée)
socket.on('session:bonus-points', (data) => {
    showGamePopup({ icon: '🎉', title: 'Bonus !', message: `+${data.points} points - ${data.reason}` });
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
    playerId = null;
    themeValues = {};
    selectedPower = null;
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

// Score final envoyé à tous (après la phase 2)
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

function showError(message) {
    const errorDiv = document.getElementById('joinError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}
