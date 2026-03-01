// Code partagé entre les deux écrans
let data = [];
let gridData = [];

// Variables pour le chronomètre
let timerInterval = null;
let timeRemaining = 240; // 4 minutes en secondes
let isPaused = false;

// Variable pour les points de vie (fixé à 3)
let pointsDeVie = 3;

// Variable pour l'énergie (fixé à 3)
let energie = 3;

// Variable pour les points (total, affiché avec une étoile)
let totalPoints = 0;

// Variables pour les joueurs
let players = [];
const DEFAULT_PLAYERS_COUNT = 4;

// Charger les données JSON
async function loadData() {
    try {
        const response = await fetch('data.json');
        data = await response.json();
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

    // Assigner aléatoirement 1 case en rouge
    const indices = gridData.map((_, index) => index);
    const shuffledIndices = [...indices].sort(() => Math.random() - 0.5);
    
    // 1 case en rouge
    gridData[shuffledIndices[0]].themeColor = 'red';
    // Les autres restent normales (bleu)

    // Sauvegarder la grille dans localStorage
    localStorage.setItem('gameGrid', JSON.stringify(gridData));
}

// Mettre à jour l'affichage des points de vie
function updateLivesDisplay() {
    const livesEl = document.getElementById('lives');
    if (livesEl) {
        livesEl.textContent = pointsDeVie;
    }
}

// Mettre à jour l'affichage de l'énergie
function updateEnergyDisplay() {
    const energyEl = document.getElementById('energy');
    if (energyEl) {
        energyEl.textContent = energie;
    }
}

// Mettre à jour l'affichage des points
function updatePointsDisplay() {
    const pointsEl = document.getElementById('points');
    if (pointsEl) {
        pointsEl.textContent = totalPoints;
    }
}

// Initialiser les points de vie (fixé à 3)
function initLives() {
    pointsDeVie = 3;
    updateLivesDisplay();
}

// Initialiser l'énergie (fixé à 3)
function initEnergy() {
    energie = 3;
    updateEnergyDisplay();
}

// Initialiser les points (total à 0 au début)
function initPoints() {
    const savedPoints = localStorage.getItem('totalPoints');
    if (savedPoints !== null) {
        totalPoints = parseInt(savedPoints);
    } else {
        totalPoints = 0;
    }
    updatePointsDisplay();
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
    
    if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
    if (resumeBtn) resumeBtn.addEventListener('click', resumeTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetTimer);
}

// Démarrer le chronomètre
function startTimer() {
    if (timerInterval) return;
    
    isPaused = false;
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    if (pauseBtn) pauseBtn.style.display = 'block';
    if (resumeBtn) resumeBtn.style.display = 'none';
    
    timerInterval = setInterval(() => {
        if (timeRemaining > 0) {
            timeRemaining--;
            updateTimerDisplay();
            localStorage.setItem('timerTime', timeRemaining);
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }, 1000);
}

// Mettre en pause le chronomètre
function pauseTimer() {
    if (!timerInterval) return;
    
    clearInterval(timerInterval);
    timerInterval = null;
    isPaused = true;
    
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (resumeBtn) resumeBtn.style.display = 'block';
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
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    if (pauseBtn) pauseBtn.style.display = 'block';
    if (resumeBtn) resumeBtn.style.display = 'none';
    
    // Redémarrer le chronomètre
    startTimer();
}

// Mettre à jour l'affichage du chronomètre
function updateTimerDisplay() {
    const timerEl = document.getElementById('timer');
    if (timerEl) {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        timerEl.textContent = display;
    }
}

// Charger les données au chargement
loadData();
