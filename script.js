let data = [];
let gridData = [];

// Variables pour le chronomètre
let timerInterval = null;
let timeRemaining = 240; // 4 minutes en secondes
let isPaused = false;

// Variable pour les points de vie (peut être modifiée)
let pointsDeVie = 0;

// Variable pour l'énergie (peut être modifiée)
let energie = 0;

// Variables pour les joueurs
let players = [];
const DEFAULT_PLAYERS_COUNT = 4;

// Charger les données JSON
async function loadData() {
    try {
        const response = await fetch('data.json');
        data = await response.json();
        // Ne pas générer la grille automatiquement, attendre le démarrage du jeu
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
    }
}

// Générer la grille 5x5
function generateGrid() {
    // Vérifier si une grille existe déjà dans localStorage
    const savedGrid = localStorage.getItem('gameGrid');
    if (savedGrid) {
        gridData = JSON.parse(savedGrid);
        renderGrid();
        return;
    }

    // Grouper les données par catégorie
    const categoriesMap = {};
    data.forEach(item => {
        if (!categoriesMap[item.category]) {
            categoriesMap[item.category] = [];
        }
        categoriesMap[item.category].push(item.name);
    });

    // Obtenir toutes les catégories disponibles
    const allCategories = Object.keys(categoriesMap);
    
    // Sélectionner 5 catégories aléatoirement
    const selectedCategories = [];
    const shuffledCategories = [...allCategories].sort(() => Math.random() - 0.5);
    for (let i = 0; i < 5 && i < shuffledCategories.length; i++) {
        selectedCategories.push(shuffledCategories[i]);
    }

    // Créer un tableau de 25 cases (5 catégories × 5 occurrences)
    gridData = [];
    selectedCategories.forEach(category => {
        for (let i = 0; i < 5; i++) {
            const names = categoriesMap[category];
            const randomName = names[Math.floor(Math.random() * names.length)];
            gridData.push({
                category: category,
                name: randomName,
                themeColor: 'normal' // Par défaut, toutes les cases sont normales
            });
        }
    });

    // Mélanger les cases
    gridData.sort(() => Math.random() - 0.5);

    // Assigner aléatoirement 3 cases en vert et 1 case en rouge
    const indices = gridData.map((_, index) => index);
    const shuffledIndices = [...indices].sort(() => Math.random() - 0.5);
    
    // 3 cases en vert
    for (let i = 0; i < 3; i++) {
        gridData[shuffledIndices[i]].themeColor = 'green';
    }
    // 1 case en rouge
    gridData[shuffledIndices[3]].themeColor = 'red';
    // Les autres restent normales (bleu)

    // Sauvegarder la grille dans localStorage
    localStorage.setItem('gameGrid', JSON.stringify(gridData));

    // Afficher la grille
    renderGrid();
}

// Afficher la grille dans le DOM
function renderGrid() {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';

    // Récupérer les cases révélées depuis localStorage
    const revealedCells = JSON.parse(localStorage.getItem('revealedCells') || '[]');
    // Récupérer les cases avec boutons déjà cliqués
    const answeredCells = JSON.parse(localStorage.getItem('answeredCells') || '[]');
    // Récupérer les réponses (correct/incorrect) depuis localStorage
    const cellAnswers = JSON.parse(localStorage.getItem('cellAnswers') || '{}');
    // Récupérer les actions utilisées (groupe, indice) depuis localStorage
    const cellActions = JSON.parse(localStorage.getItem('cellActions') || '{}');

    gridData.forEach((item, index) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = index;
        
        // Appliquer la couleur du thème (seulement si pas encore répondu)
        const answer = cellAnswers[index];
        if (!answer) {
            if (item.themeColor === 'green') {
                cell.classList.add('cell-green');
            } else if (item.themeColor === 'red') {
                cell.classList.add('cell-red');
            }
        }
        
        // Appliquer la couleur selon la réponse
        if (answer === 'correct') {
            cell.classList.add('cell-correct');
        } else if (answer === 'incorrect') {
            cell.classList.add('cell-incorrect');
        }
        
        // Restaurer l'état révélé si présent
        if (revealedCells.includes(index)) {
            cell.classList.add('revealed');
        }
        
        const cellContent = document.createElement('div');
        cellContent.className = 'cell-content';
        
        const categorySpan = document.createElement('span');
        categorySpan.className = 'cell-category';
        categorySpan.textContent = item.category;
        
        // Ajouter les boutons du haut (groupe, indice) si la case est révélée mais pas encore répondue
        if (revealedCells.includes(index) && !answeredCells.includes(index)) {
            const cellActionsForThisCell = cellActions[index] || [];
            const topButtonsContainer = document.createElement('div');
            topButtonsContainer.className = 'cell-buttons cell-buttons-top';
            
            // Afficher le bouton "Groupe" seulement s'il n'a pas été utilisé
            if (!cellActionsForThisCell.includes('groupe')) {
                const groupeBtn = document.createElement('button');
                groupeBtn.className = 'cell-btn cell-btn-action';
                groupeBtn.textContent = 'Groupe';
                groupeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleAction(index, 'groupe');
                });
                topButtonsContainer.appendChild(groupeBtn);
            }
            
            // Afficher le bouton "Indice" seulement s'il n'a pas été utilisé
            if (!cellActionsForThisCell.includes('indice')) {
                const indiceBtn = document.createElement('button');
                indiceBtn.className = 'cell-btn cell-btn-action';
                indiceBtn.textContent = 'Indice';
                indiceBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleAction(index, 'indice');
                });
                topButtonsContainer.appendChild(indiceBtn);
            }
            
            // Ajouter le conteneur seulement s'il contient au moins un bouton
            if (topButtonsContainer.children.length > 0) {
                cellContent.appendChild(topButtonsContainer);
            }
        }
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'cell-name';
        nameSpan.textContent = item.name;
        
        cellContent.appendChild(categorySpan);
        cellContent.appendChild(nameSpan);
        
        // Ajouter les boutons du bas (correct, incorrect) si la case est révélée mais pas encore répondue
        if (revealedCells.includes(index) && !answeredCells.includes(index)) {
            const bottomButtonsContainer = document.createElement('div');
            bottomButtonsContainer.className = 'cell-buttons cell-buttons-bottom';
            
            const correctBtn = document.createElement('button');
            correctBtn.className = 'cell-btn cell-btn-correct';
            correctBtn.textContent = 'Correct';
            correctBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleAnswer(index, true);
            });
            
            const incorrectBtn = document.createElement('button');
            incorrectBtn.className = 'cell-btn cell-btn-incorrect';
            incorrectBtn.textContent = 'Incorrect';
            incorrectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleAnswer(index, false);
            });
            
            bottomButtonsContainer.appendChild(correctBtn);
            bottomButtonsContainer.appendChild(incorrectBtn);
            cellContent.appendChild(bottomButtonsContainer);
        }
        
        cell.appendChild(cellContent);
        
        cell.addEventListener('click', () => revealCell(index));
        
        grid.appendChild(cell);
    });
}

// Révéler le nom d'une case
function revealCell(index) {
    const cell = document.querySelector(`.cell[data-index="${index}"]`);
    if (cell && !cell.classList.contains('revealed')) {
        cell.classList.add('revealed');
        
        // Sauvegarder les cases révélées dans localStorage
        const revealedCells = JSON.parse(localStorage.getItem('revealedCells') || '[]');
        if (!revealedCells.includes(index)) {
            revealedCells.push(index);
            localStorage.setItem('revealedCells', JSON.stringify(revealedCells));
        }
        
        // Re-rendre la grille pour afficher les boutons
        renderGrid();
    }
}

// Gérer les actions (groupe, indice, carré)
function handleAction(index, action) {
    // Diminuer l'énergie de 2 pour "groupe" ou "indice"
    if (action === 'groupe' || action === 'indice') {
        energie = Math.max(0, energie - 2);
        updateEnergyDisplay();
        localStorage.setItem('energie', energie);
        
        // Sauvegarder l'action utilisée pour cette case
        const cellActions = JSON.parse(localStorage.getItem('cellActions') || '{}');
        if (!cellActions[index]) {
            cellActions[index] = [];
        }
        if (!cellActions[index].includes(action)) {
            cellActions[index].push(action);
            localStorage.setItem('cellActions', JSON.stringify(cellActions));
        }
        
        // Re-rendre la grille pour retirer le bouton
        renderGrid();
    }
    // Vous pouvez ajouter d'autres logiques ici
    console.log(`Action ${action} sur la case ${index}`);
}

// Gérer la réponse (correct ou incorrect)
function handleAnswer(index, isCorrect) {
    if (!isCorrect) {
        // Diminuer les points de vie de 1
        pointsDeVie = Math.max(0, pointsDeVie - 1);
        updateLivesDisplay();
        localStorage.setItem('pointsDeVie', pointsDeVie);
    }
    
    // Marquer la case comme répondue
    const answeredCells = JSON.parse(localStorage.getItem('answeredCells') || '[]');
    if (!answeredCells.includes(index)) {
        answeredCells.push(index);
        localStorage.setItem('answeredCells', JSON.stringify(answeredCells));
    }
    
    // Sauvegarder la réponse (correct ou incorrect)
    const cellAnswers = JSON.parse(localStorage.getItem('cellAnswers') || '{}');
    cellAnswers[index] = isCorrect ? 'correct' : 'incorrect';
    localStorage.setItem('cellAnswers', JSON.stringify(cellAnswers));
    
    // Re-rendre la grille pour appliquer la couleur et retirer les boutons
    renderGrid();
}

// Mettre à jour l'affichage des points de vie
function updateLivesDisplay() {
    document.getElementById('lives').textContent = pointsDeVie;
}

// Initialiser le chronomètre
function initTimer() {
    // Récupérer le temps restant depuis localStorage si disponible
    const savedTime = localStorage.getItem('timerTime');
    if (savedTime) {
        timeRemaining = parseInt(savedTime);
    }
    
    updateTimerDisplay();
    startTimer();
    
    // Boutons pause/reprendre/réinitialiser
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    pauseBtn.addEventListener('click', pauseTimer);
    resumeBtn.addEventListener('click', resumeTimer);
    resetBtn.addEventListener('click', resetTimer);
}

// Démarrer le chronomètre
function startTimer() {
    if (timerInterval) return;
    
    isPaused = false;
    document.getElementById('pauseBtn').style.display = 'block';
    document.getElementById('resumeBtn').style.display = 'none';
    
    timerInterval = setInterval(() => {
        if (timeRemaining > 0) {
            timeRemaining--;
            updateTimerDisplay();
            localStorage.setItem('timerTime', timeRemaining);
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
            // Retourner à l'écran de configuration quand le chronomètre se termine
            returnToSetup();
        }
    }, 1000);
}

// Mettre en pause le chronomètre
function pauseTimer() {
    if (!timerInterval) return;
    
    clearInterval(timerInterval);
    timerInterval = null;
    isPaused = true;
    
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('resumeBtn').style.display = 'block';
}

// Reprendre le chronomètre
function resumeTimer() {
    if (timerInterval) return;
    
    startTimer();
}

// Réinitialiser le chronomètre à 4 minutes
function resetTimer() {
    // Arrêter le chronomètre s'il est en cours
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Réinitialiser à 4 minutes
    timeRemaining = 240;
    updateTimerDisplay();
    localStorage.setItem('timerTime', timeRemaining);
    
    // Remettre les boutons dans l'état initial
    isPaused = false;
    document.getElementById('pauseBtn').style.display = 'block';
    document.getElementById('resumeBtn').style.display = 'none';
    
    // Redémarrer le chronomètre
    startTimer();
}

// Mettre à jour l'affichage du chronomètre
function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('timer').textContent = display;
}

// Initialiser les points de vie
function initLives() {
    // Récupérer les points de vie depuis localStorage si disponible
    const savedLives = localStorage.getItem('pointsDeVie');
    if (savedLives !== null) {
        pointsDeVie = parseInt(savedLives);
    } else {
        pointsDeVie = 0;
    }
    updateLivesDisplay();
}

// Mettre à jour l'affichage de l'énergie
function updateEnergyDisplay() {
    document.getElementById('energy').textContent = energie;
}

// Initialiser l'énergie
function initEnergy() {
    // Récupérer l'énergie depuis localStorage si disponible
    const savedEnergy = localStorage.getItem('energie');
    if (savedEnergy !== null) {
        energie = parseInt(savedEnergy);
    } else {
        energie = 0;
    }
    updateEnergyDisplay();
}

// Gestion des écrans
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Initialiser les joueurs par défaut
function initPlayers() {
    players = [];
    for (let i = 0; i < DEFAULT_PLAYERS_COUNT; i++) {
        players.push({
            id: i,
            name: '',
            lives: 0,
            energy: 0
        });
    }
    renderPlayers();
}

// Afficher la liste des joueurs
function renderPlayers() {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';
    
    players.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        playerDiv.innerHTML = `
            <div class="player-input-group">
                <label>Joueur ${index + 1}:</label>
                <input type="text" class="player-name-input" data-player-id="${player.id}" 
                       placeholder="Nom du joueur" value="${player.name}">
            </div>
            <div class="player-stats">
                <div class="stat-group">
                    <label>Points de vie:</label>
                    <div class="stat-controls">
                        <button class="stat-btn" onclick="changeStat(${player.id}, 'lives', -1)">-</button>
                        <span class="stat-value" id="lives-${player.id}">${player.lives}</span>
                        <button class="stat-btn" onclick="changeStat(${player.id}, 'lives', 1)">+</button>
                    </div>
                </div>
                <div class="stat-group">
                    <label>Énergie:</label>
                    <div class="stat-controls">
                        <button class="stat-btn" onclick="changeStat(${player.id}, 'energy', -10)">-</button>
                        <span class="stat-value" id="energy-${player.id}">${player.energy}</span>
                        <button class="stat-btn" onclick="changeStat(${player.id}, 'energy', 10)">+</button>
                    </div>
                </div>
                ${players.length > 1 ? `<button class="remove-player-btn" onclick="removePlayer(${player.id})">Supprimer</button>` : ''}
            </div>
        `;
        playersList.appendChild(playerDiv);
    });
    
    // Ajouter les event listeners pour les noms
    document.querySelectorAll('.player-name-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const playerId = parseInt(e.target.dataset.playerId);
            const player = players.find(p => p.id === playerId);
            if (player) {
                player.name = e.target.value;
            }
        });
    });
}

// Changer une statistique (lives ou energy)
function changeStat(playerId, stat, change) {
    const player = players.find(p => p.id === playerId);
    if (player) {
        player[stat] = Math.max(0, player[stat] + change);
        document.getElementById(`${stat}-${playerId}`).textContent = player[stat];
    }
}

// Ajouter un joueur
function addPlayer() {
    const newId = players.length > 0 ? Math.max(...players.map(p => p.id)) + 1 : 0;
    players.push({
        id: newId,
        name: '',
        lives: 0,
        energy: 0
    });
    renderPlayers();
}

// Supprimer un joueur
function removePlayer(playerId) {
    if (players.length > 1) {
        players = players.filter(p => p.id !== playerId);
        renderPlayers();
    }
}

// Démarrer le jeu
function startGame() {
    // Vérifier que tous les joueurs ont un nom
    const playersWithoutName = players.filter(p => !p.name.trim());
    if (playersWithoutName.length > 0) {
        alert('Veuillez entrer un nom pour tous les joueurs.');
        return;
    }
    
    // Calculer le total des points de vie et de l'énergie de tous les joueurs
    pointsDeVie = players.reduce((total, player) => total + player.lives, 0);
    energie = players.reduce((total, player) => total + player.energy, 0);
    
    // Sauvegarder les joueurs avec leurs valeurs d'attribution
    localStorage.setItem('players', JSON.stringify(players));
    localStorage.setItem('playersOriginal', JSON.stringify(players)); // Sauvegarder les valeurs originales
    localStorage.setItem('currentPlayerIndex', '0');
    localStorage.setItem('pointsDeVie', pointsDeVie);
    localStorage.setItem('energie', energie);
    
    // Afficher l'écran de jeu
    showScreen('game-screen');
    
    // Générer la grille et initialiser le jeu
    generateGrid();
    initTimer();
    initLives();
    initEnergy();
}

// Retourner à l'écran de configuration
function returnToSetup() {
    // Arrêter le chronomètre s'il est en cours
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    
    // Sauvegarder les valeurs actuelles de vie et d'énergie
    localStorage.setItem('pointsDeVie', pointsDeVie);
    localStorage.setItem('energie', energie);
    
    // Restaurer les joueurs avec leurs valeurs d'attribution originales
    const savedPlayersOriginal = localStorage.getItem('playersOriginal');
    if (savedPlayersOriginal) {
        // Restaurer les valeurs d'attribution originales
        players = JSON.parse(savedPlayersOriginal);
        renderPlayers();
    } else {
        // Si pas de valeurs originales, utiliser les joueurs sauvegardés
        const savedPlayers = localStorage.getItem('players');
        if (savedPlayers) {
            players = JSON.parse(savedPlayers);
            renderPlayers();
        }
    }
    
    // Afficher l'écran de configuration
    showScreen('players-setup-screen');
}

// Initialiser l'écran d'accueil
function initWelcomeScreen() {
    document.getElementById('playBtn').addEventListener('click', () => {
        showScreen('players-setup-screen');
        // Restaurer les joueurs avec leurs valeurs d'attribution originales
        const savedPlayersOriginal = localStorage.getItem('playersOriginal');
        if (savedPlayersOriginal) {
            players = JSON.parse(savedPlayersOriginal);
            renderPlayers();
        } else {
            // Si pas de valeurs originales, utiliser les joueurs sauvegardés
            const savedPlayers = localStorage.getItem('players');
            if (savedPlayers) {
                players = JSON.parse(savedPlayers);
                renderPlayers();
            } else {
                initPlayers();
            }
        }
    });
    
    document.getElementById('addPlayerBtn').addEventListener('click', addPlayer);
    document.getElementById('startGameBtn').addEventListener('click', startGame);
    
    // Bouton "Fini" dans l'écran de jeu
    document.getElementById('finishBtn').addEventListener('click', returnToSetup);
}

// Rendre les fonctions accessibles globalement pour les onclick
window.changeStat = changeStat;
window.removePlayer = removePlayer;

// Charger les données au chargement de la page
loadData();
initWelcomeScreen();
