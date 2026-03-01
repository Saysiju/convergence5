// Code spécifique à l'écran maître du jeu (mj.html)

// Afficher la grille dans le DOM (interface maître)
function renderGrid() {
    const grid = document.getElementById('grid');
    if (!grid) return;
    
    grid.innerHTML = '';

    // Charger la grille depuis localStorage
    const savedGrid = localStorage.getItem('gameGrid');
    if (!savedGrid) {
        generateGrid();
    } else {
        gridData = JSON.parse(savedGrid);
    }

    // Récupérer les cases révélées depuis localStorage
    const revealedCells = JSON.parse(localStorage.getItem('revealedCells') || '[]');
    // Récupérer les cases avec boutons déjà cliqués
    const answeredCells = JSON.parse(localStorage.getItem('answeredCells') || '[]');
    // Récupérer les réponses (correct/incorrect) depuis localStorage
    const cellAnswers = JSON.parse(localStorage.getItem('cellAnswers') || '{}');
    // Récupérer les actions utilisées (groupe, indice) depuis localStorage
    const cellActions = JSON.parse(localStorage.getItem('cellActions') || '{}');
    // Récupérer les cases cliquées (jaunes) de l'interface commune
    const clickedCells = JSON.parse(localStorage.getItem('clickedCells') || '[]');

    gridData.forEach((item, index) => {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = index;
        
        // Appliquer la couleur du thème (seulement si pas encore répondu)
        const answer = cellAnswers[index];
        if (!answer) {
            if (item.themeColor === 'red') {
                cell.classList.add('cell-red');
            }
        }
        
        // Appliquer la couleur selon la réponse
        if (answer === 'correct') {
            cell.classList.add('cell-correct');
        } else if (answer === 'incorrect' || answer === 'pass') {
            // \"incorrect\" ou \"passe\" : la case devient noire
            cell.classList.add('cell-incorrect');
        }
        
        // Restaurer l'état révélé si présent (priorité sur clicked)
        if (revealedCells.includes(index)) {
            cell.classList.add('revealed');
        } else if (clickedCells.includes(index)) {
            // Afficher aussi les cases cliquées en jaune dans l'interface master
            cell.classList.add('clicked');
        }
        
        const cellContent = document.createElement('div');
        cellContent.className = 'cell-content';
        
        const categorySpan = document.createElement('span');
        categorySpan.className = 'cell-category';
        categorySpan.textContent = item.category;
        
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
                handleAnswer(index, 'correct');
            });
            
            const incorrectBtn = document.createElement('button');
            incorrectBtn.className = 'cell-btn cell-btn-incorrect';
            incorrectBtn.textContent = 'Incorrect';
            incorrectBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleAnswer(index, 'incorrect');
            });

            const passBtn = document.createElement('button');
            passBtn.className = 'cell-btn cell-btn-pass';
            passBtn.textContent = 'Passe';
            passBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleAnswer(index, 'pass');
            });
            
            bottomButtonsContainer.appendChild(correctBtn);
            bottomButtonsContainer.appendChild(incorrectBtn);
            bottomButtonsContainer.appendChild(passBtn);
            cellContent.appendChild(bottomButtonsContainer);
        }
        
        cell.appendChild(cellContent);
        
        cell.addEventListener('click', () => revealCell(index));
        
        grid.appendChild(cell);
    });
}

// Index de la dernière case sélectionnée
let currentSelectedIndex = null;
// Joueur actuellement sélectionné pour la case en cours
let currentSelectedPlayerId = null;
// Joueurs avec valeurs par thème (chargés depuis playersOriginal)
let masterPlayers = [];
// Catégorie (thème) de la case actuellement sélectionnée
let currentSelectedCategory = null;

// Charger les joueurs pour le maître du jeu
function loadMasterPlayers() {
    if (masterPlayers.length > 0) return;
    const savedPlayersOriginal = localStorage.getItem('playersOriginal');
    if (savedPlayersOriginal) {
        try {
            masterPlayers = JSON.parse(savedPlayersOriginal);
        } catch (e) {
            console.error('Erreur de parsing playersOriginal:', e);
            masterPlayers = [];
        }
    }
}

// Obtenir la valeur du thème pour un joueur donné
function getThemeValueForPlayer(player, category) {
    if (!player || !player.themeValues) return 0;
    return player.themeValues[category] || 0;
}

// Afficher la liste des joueurs à gauche de la grille pour le thème sélectionné
function renderPlayerSidebar() {
    const sidebar = document.getElementById('players-sidebar');
    if (!sidebar) return;

    sidebar.innerHTML = '';
    loadMasterPlayers();

    if (!currentSelectedCategory) {
        return;
    }

    masterPlayers.forEach(player => {
        const value = getThemeValueForPlayer(player, currentSelectedCategory);
        const btn = document.createElement('button');
        btn.className = 'player-select-btn';
        btn.dataset.playerId = player.id;

        if (currentSelectedPlayerId === player.id) {
            btn.classList.add('player-selected');
        }

        const nameSpan = document.createElement('span');
        nameSpan.className = 'player-select-name';
        nameSpan.textContent = player.name || `Joueur ${player.id + 1}`;

        const valueSpan = document.createElement('span');
        valueSpan.className = 'player-select-value';
        valueSpan.innerHTML = `${value} <span>⭐</span>`;

        btn.appendChild(nameSpan);
        btn.appendChild(valueSpan);

        btn.addEventListener('click', () => {
            currentSelectedPlayerId = player.id;
            renderPlayerSidebar();
        });

        sidebar.appendChild(btn);
    });
}

// Activer/désactiver les boutons d'action de la colonne de droite
function setActionButtonsEnabled(enabled) {
    const ids = ['btn-groupe', 'btn-indice', 'btn-choix', 'btn-vie', 'btn-points', 'btn-temps'];
    ids.forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !enabled;
        if (enabled) {
            btn.classList.remove('action-btn-disabled');
        } else {
            btn.classList.add('action-btn-disabled');
        }
    });
}

// Révéler le nom d'une case (interface maître)
function revealCell(index) {
    // Empêcher de sélectionner une autre case tant que la précédente n'est pas résolue
    const answeredCells = JSON.parse(localStorage.getItem('answeredCells') || '[]');
    if (
        currentSelectedIndex !== null &&
        currentSelectedIndex !== index &&
        !answeredCells.includes(currentSelectedIndex)
    ) {
        return;
    }

    const cell = document.querySelector(`.cell[data-index="${index}"]`);
    if (cell && !cell.classList.contains('revealed')) {
        // Retirer la classe clicked si présente
        cell.classList.remove('clicked');
        // Ajouter la classe revealed pour afficher le nom
        cell.classList.add('revealed');
        // Mémoriser la case sélectionnée
        currentSelectedIndex = index;
        currentSelectedCategory = gridData[index].category;
        
        // Sauvegarder les cases révélées dans localStorage
        const revealedCells = JSON.parse(localStorage.getItem('revealedCells') || '[]');
        if (!revealedCells.includes(index)) {
            revealedCells.push(index);
            localStorage.setItem('revealedCells', JSON.stringify(revealedCells));
        }
        
        // Re-rendre la grille pour afficher les boutons
        renderGrid();
        // Activer les boutons d'action (colonne de droite)
        setActionButtonsEnabled(true);
        // Afficher les joueurs pour ce thème
        renderPlayerSidebar();
    }
}

// Gérer les actions (groupe, indice, passe)
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
}

// Gérer la réponse (correct, incorrect ou passe)
function handleAnswer(index, result) {
    if (result === 'incorrect') {
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
    
    // Sauvegarder la réponse (correct, incorrect ou passe)
    const cellAnswers = JSON.parse(localStorage.getItem('cellAnswers') || '{}');
    cellAnswers[index] = result;
    localStorage.setItem('cellAnswers', JSON.stringify(cellAnswers));
    
    // Re-rendre la grille pour appliquer la couleur et retirer les boutons
    renderGrid();
    // Libérer la sélection et désactiver les boutons d'action
    currentSelectedIndex = null;
    currentSelectedPlayerId = null;
    setActionButtonsEnabled(false);
}

// Initialiser l'écran maître du jeu
function initMasterScreen() {
    // Vérifier si la grille existe, sinon la générer
    const savedGrid = localStorage.getItem('gameGrid');
    if (!savedGrid) {
        generateGrid();
    }
    
    renderGrid();
    initTimer();
    initLives();
    initEnergy();
    // Désactiver les boutons d'action au démarrage
    setActionButtonsEnabled(false);
    
    // Bouton "Fini"
    const finishBtn = document.getElementById('finishBtn');
    if (finishBtn) {
        finishBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    // Boutons d'action de la colonne de droite
    const btnGroupe = document.getElementById('btn-groupe');
    const btnIndice = document.getElementById('btn-indice');
    const btnChoix = document.getElementById('btn-choix');
    const btnVie = document.getElementById('btn-vie');
    const btnPoints = document.getElementById('btn-points');
    const btnTemps = document.getElementById('btn-temps');

    if (btnGroupe) {
        btnGroupe.addEventListener('click', () => {
            if (currentSelectedIndex !== null) {
                handleAction(currentSelectedIndex, 'groupe');
            }
        });
    }

    if (btnIndice) {
        btnIndice.addEventListener('click', () => {
            if (currentSelectedIndex !== null) {
                handleAction(currentSelectedIndex, 'indice');
            }
        });
    }

    // Les autres boutons sont préparés pour une logique future
    if (btnChoix) {
        btnChoix.addEventListener('click', () => {
            if (currentSelectedIndex !== null) {
                console.log('Action CHOIX sur la case', currentSelectedIndex);
            }
        });
    }
    if (btnVie) {
        btnVie.addEventListener('click', () => {
            if (currentSelectedIndex !== null) {
                console.log('Action VIE sur la case', currentSelectedIndex);
            }
        });
    }
    if (btnPoints) {
        btnPoints.addEventListener('click', () => {
            if (currentSelectedIndex !== null) {
                console.log('Action POINTS sur la case', currentSelectedIndex);
            }
        });
    }
    if (btnTemps) {
        btnTemps.addEventListener('click', () => {
            if (currentSelectedIndex !== null) {
                console.log('Action TEMPS sur la case', currentSelectedIndex);
            }
        });
    }
}

// Initialiser quand la page est chargée
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMasterScreen);
} else {
    initMasterScreen();
}
