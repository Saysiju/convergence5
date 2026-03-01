// Code pour gérer l'écran d'accueil et de configuration des joueurs

// Variables pour les catégories/thèmes
let allCategories = [];

// Obtenir toutes les catégories disponibles
async function getAllCategories() {
    if (allCategories.length > 0) return allCategories;
    
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        const categoriesMap = {};
        data.forEach(item => {
            if (!categoriesMap[item.category]) {
                categoriesMap[item.category] = true;
            }
        });
        allCategories = Object.keys(categoriesMap).sort();
        return allCategories;
    } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
        return [];
    }
}

// Gestion des écrans
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
    }
}

// Afficher la liste des joueurs avec attribution par thème
async function renderPlayers() {
    const playersList = document.getElementById('players-list');
    if (!playersList) return;
    
    // Charger les catégories si nécessaire
    await getAllCategories();
    
    playersList.innerHTML = '';
    
    players.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        
        // Créer le HTML pour le nom du joueur
        let playerHTML = `
            <div class="player-input-group">
                <label>Joueur ${index + 1}:</label>
                <input type="text" class="player-name-input" data-player-id="${player.id}" 
                       placeholder="Nom du joueur" value="${player.name}">
                ${players.length > 1 ? `<button class="remove-player-btn" onclick="removePlayer(${player.id})">Supprimer</button>` : ''}
            </div>
            <div class="themes-assignment">
                <h3>Valeurs par thème:</h3>
                <div class="themes-grid">
        `;
        
        // Créer les champs pour chaque thème
        allCategories.forEach(category => {
            const value = player.themeValues && player.themeValues[category] ? player.themeValues[category] : 0;
            playerHTML += `
                <div class="theme-assignment-item">
                    <label>${category}:</label>
                    <div class="stat-controls">
                        <button class="stat-btn" onclick="changeThemeValue(${player.id}, '${category}', -1)">-</button>
                        <span class="stat-value" id="theme-${player.id}-${category.replace(/\s+/g, '-')}">${value}</span>
                        <button class="stat-btn" onclick="changeThemeValue(${player.id}, '${category}', 1)">+</button>
                    </div>
                </div>
            `;
        });
        
        playerHTML += `
                </div>
            </div>
        `;
        
        playerDiv.innerHTML = playerHTML;
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

// Initialiser les joueurs par défaut
function initPlayers() {
    players = [];
    for (let i = 0; i < DEFAULT_PLAYERS_COUNT; i++) {
        players.push({
            id: i,
            name: '',
            themeValues: {} // Valeurs par thème
        });
    }
    renderPlayers();
}

// Changer la valeur d'un thème pour un joueur
function changeThemeValue(playerId, category, change) {
    const player = players.find(p => p.id === playerId);
    if (player) {
        if (!player.themeValues) {
            player.themeValues = {};
        }
        const currentValue = player.themeValues[category] || 0;
        player.themeValues[category] = Math.max(0, currentValue + change);
        const el = document.getElementById(`theme-${playerId}-${category.replace(/\s+/g, '-')}`);
        if (el) {
            el.textContent = player.themeValues[category];
        }
    }
}

// Ajouter un joueur
function addPlayer() {
    const newId = players.length > 0 ? Math.max(...players.map(p => p.id)) + 1 : 0;
    players.push({
        id: newId,
        name: '',
        themeValues: {} // Valeurs par thème
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
    
    // Les points de vie et l'énergie sont fixés à 3
    pointsDeVie = 3;
    energie = 3;
    
    // Sauvegarder les joueurs avec leurs valeurs d'attribution par thème
    localStorage.setItem('players', JSON.stringify(players));
    localStorage.setItem('playersOriginal', JSON.stringify(players)); // Sauvegarder les valeurs originales
    localStorage.setItem('currentPlayerIndex', '0');
    localStorage.setItem('pointsDeVie', pointsDeVie);
    localStorage.setItem('energie', energie);
    
    // Afficher l'écran de jeu
    showScreen('game-screen');
    
    // Générer la grille et initialiser le jeu
    if (typeof generateGrid === 'function') {
        generateGrid();
    }
    // Initialiser l'écran de jeu après un court délai pour s'assurer que le DOM est prêt
    setTimeout(() => {
        if (typeof initPlayerScreen === 'function') {
            initPlayerScreen();
        }
    }, 0);
}

// Rendre les fonctions accessibles globalement pour les onclick
window.changeThemeValue = changeThemeValue;
window.removePlayer = removePlayer;

// Initialiser l'écran d'accueil
function initWelcomeScreen() {
    const playBtn = document.getElementById('playBtn');
    const addPlayerBtn = document.getElementById('addPlayerBtn');
    const startGameBtn = document.getElementById('startGameBtn');
    
    if (playBtn) {
        playBtn.addEventListener('click', () => {
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
    }
    
    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', addPlayer);
    }
    
    if (startGameBtn) {
        startGameBtn.addEventListener('click', startGame);
    }
}

// Vérifier si une grille existe et afficher l'écran approprié
function checkAndShowScreen() {
    // Toujours initialiser l'écran d'accueil pour les boutons
    initWelcomeScreen();
    
    const savedGrid = localStorage.getItem('gameGrid');
    if (savedGrid) {
        // Si une grille existe, afficher directement l'écran de jeu
        showScreen('game-screen');
        // Initialiser l'écran de jeu après un court délai pour s'assurer que le DOM est prêt
        setTimeout(() => {
            if (typeof initPlayerScreen === 'function') {
                initPlayerScreen();
            }
        }, 0);
    }
    // Sinon, l'écran d'accueil reste affiché (défini dans le HTML)
}

// Initialiser quand la page est chargée
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndShowScreen);
} else {
    checkAndShowScreen();
}
