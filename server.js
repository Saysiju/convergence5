// Serveur Node.js avec Socket.io pour gérer les sessions multi-appareils
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Servir les fichiers statiques
app.use(express.static(__dirname));

// Charger les données du jeu
const gameData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));

// État des sessions de jeu
const gameSessions = {};
// Dans cette application il n'y a qu'une seule partie active à la fois
let currentSessionId = null;

// Fonction pour obtenir toutes les catégories uniques
function getAllCategories() {
    const categories = new Set();
    gameData.forEach(item => categories.add(item.category));
    return Array.from(categories).sort();
}

// Fonction pour obtenir un nouvel élément aléatoire d'une catégorie (différent de ceux déjà utilisés)
function getNewItemForCategory(category, usedNames) {
    // Convertir usedNames en Set si c'est un tableau pour une recherche plus rapide
    const usedNamesSet = Array.isArray(usedNames) ? new Set(usedNames) : usedNames;
    const availableItems = gameData.filter(item => 
        item.category === category && !usedNamesSet.has(item.name)
    );
    if (availableItems.length === 0) {
        // Si tous les éléments sont utilisés, réinitialiser
        const allItems = gameData.filter(item => item.category === category);
        return allItems[Math.floor(Math.random() * allItems.length)];
    }
    return availableItems[Math.floor(Math.random() * availableItems.length)];
}

// Fonction pour détecter les lignes et diagonales de 4+ mots trouvés
function detectLinesAndDiagonals(cellAnswers, gridSize = 5) {
    const lines = [];
    
    // Vérifier les lignes horizontales
    for (let row = 0; row < gridSize; row++) {
        const line = [];
        for (let col = 0; col < gridSize; col++) {
            const index = row * gridSize + col;
            if (cellAnswers[index] === 'correct') {
                line.push(index);
            }
        }
        if (line.length >= 4) {
            lines.push(line);
        }
    }
    
    // Vérifier les lignes verticales
    for (let col = 0; col < gridSize; col++) {
        const line = [];
        for (let row = 0; row < gridSize; row++) {
            const index = row * gridSize + col;
            if (cellAnswers[index] === 'correct') {
                line.push(index);
            }
        }
        if (line.length >= 4) {
            lines.push(line);
        }
    }
    
    // Vérifier la diagonale principale (haut-gauche vers bas-droite)
    const diag1 = [];
    for (let i = 0; i < gridSize; i++) {
        const index = i * gridSize + i;
        if (cellAnswers[index] === 'correct') {
            diag1.push(index);
        }
    }
    if (diag1.length >= 4) {
        lines.push(diag1);
    }
    
    // Vérifier la diagonale secondaire (haut-droite vers bas-gauche)
    const diag2 = [];
    for (let i = 0; i < gridSize; i++) {
        const index = i * gridSize + (gridSize - 1 - i);
        if (cellAnswers[index] === 'correct') {
            diag2.push(index);
        }
    }
    if (diag2.length >= 4) {
        lines.push(diag2);
    }
    
    return lines;
}

// Fonction pour remplacer les mots dans une ligne/diagonale
function replaceWordsInLine(session, lineIndices) {
    // Obtenir tous les noms actuellement dans la grille (sauf ceux qui vont être remplacés)
    const usedNames = new Set();
    session.grid.forEach((cell, index) => {
        if (!lineIndices.includes(index)) {
            usedNames.add(cell.name);
        }
    });
    
    // Obtenir les 5 thèmes disponibles dans la grille
    const availableThemes = session.gridThemes || [];
    
    lineIndices.forEach(index => {
        // Choisir un thème aléatoire parmi les 5 thèmes disponibles
        const randomTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)];
        
        // Obtenir un nouveau mot de ce thème aléatoire
        const newItem = getNewItemForCategory(randomTheme, usedNames);
        
        // Mettre à jour la cellule
        session.grid[index] = {
            name: newItem.name,
            category: newItem.category,
            propositions: newItem.propositions,
            indice_mot: newItem.indice_mot,
            indice_phrase: newItem.indice_phrase
        };
        
        // Réinitialiser l'état de la cellule
        delete session.cellAnswers[index];
        
        // Ajouter le nouveau nom à la liste des noms utilisés pour éviter les doublons
        usedNames.add(newItem.name);
    });
}

// Fonction pour générer un ID de session unique
function generateSessionId() {
    return Math.random().toString(36).substring(2, 9).toUpperCase();
}

// Gestion des connexions Socket.io
io.on('connection', (socket) => {
    console.log('Nouvelle connexion:', socket.id);

    // Informer le nouveau client de l'état actuel de la partie (s'il y en a une)
    if (currentSessionId && gameSessions[currentSessionId]) {
        const session = gameSessions[currentSessionId];
        socket.emit('session:created', {
            sessionId: currentSessionId,
            maxPlayers: session.maxPlayers
        });
        socket.emit('session:player-count', {
            current: session.players.length,
            max: session.maxPlayers
        });
    } else {
        socket.emit('session:none');
    }

    // Maître du jeu : créer une nouvelle session
    socket.on('master:create-session', (data) => {
        const sessionId = generateSessionId();
        const { maxPlayers } = data;
        
        gameSessions[sessionId] = {
            id: sessionId,
            masterId: socket.id,
            maxPlayers: maxPlayers || 4,
            players: [],
            leader: null,
            selectedThemes: [],
            gameState: 'waiting', // waiting, configuring, playing, victory, defeat
            grid: null,
            currentCell: null,
            currentPropositions: null,
            cellAnswers: {}, // { cellIndex: 'correct' | 'incorrect' | 'pass' }
            score: 0,
            lives: 3,
            timer: 240, // 4 minutes
            timerInterval: null
        };
        currentSessionId = sessionId;
        
        socket.join(sessionId);
        socket.emit('master:session-created', { sessionId });
        // Informer tous les clients qu'une nouvelle partie est disponible
        io.emit('session:created', {
            sessionId,
            maxPlayers: gameSessions[sessionId].maxPlayers
        });
        io.emit('session:player-count', {
            current: 0,
            max: gameSessions[sessionId].maxPlayers
        });
        console.log(`Session créée: ${sessionId} par ${socket.id}`);
    });

    // Maître du jeu : arrêter la session
    socket.on('master:stop-session', (data) => {
        const { sessionId } = data;
        const session = gameSessions[sessionId];
        
        if (session && session.masterId === socket.id) {
            // Arrêter le timer s'il est actif
            if (session.timerInterval) {
                clearInterval(session.timerInterval);
            }
            
            // Notifier tous les joueurs de la session (y compris le meneur)
            io.to(sessionId).emit('session:stopped', { 
                message: 'La session a été arrêtée par le maître du jeu' 
            });
            
            // Notifier aussi individuellement tous les joueurs connectés
            session.players.forEach(player => {
                io.to(player.id).emit('session:stopped', { 
                    message: 'La session a été arrêtée par le maître du jeu' 
                });
            });
            
            // Notifier le meneur s'il existe
            if (session.leader) {
                io.to(session.leader).emit('session:stopped', { 
                    message: 'La session a été arrêtée par le maître du jeu' 
                });
            }
            
            // Supprimer la session
            delete gameSessions[sessionId];
            if (currentSessionId === sessionId) {
                currentSessionId = null;
            }
            // Informer tous les clients qu'il n'y a plus de partie active
            io.emit('session:none');
            console.log(`Session arrêtée: ${sessionId}`);
        }
    });

    // Joueur : rejoindre une session
    socket.on('player:join-session', (data) => {
        const { sessionId: requestedSessionId, playerName } = data;
        
        const sessionId = requestedSessionId || currentSessionId;
        
        if (!sessionId || !gameSessions[sessionId]) {
            socket.emit('player:join-error', { message: 'Aucune partie en cours. Veuillez attendre que le maître du jeu crée une partie.' });
            return;
        }
        
        const session = gameSessions[sessionId];
        
        if (session.players.length >= session.maxPlayers) {
            socket.emit('player:join-error', { message: 'Session pleine' });
            return;
        }
        
        // Vérifier si le nom est déjà pris
        if (session.players.some(p => p.name === playerName)) {
            socket.emit('player:join-error', { message: 'Nom déjà pris' });
            return;
        }
        
        const player = {
            id: socket.id,
            name: playerName,
            ready: false,
            themeValues: {}, // { category: points }
            totalPoints: 0,
            power: null // grille, indice, vie, points, temps, rafraichissement
        };
        
        session.players.push(player);
        socket.join(sessionId);
        socket.emit('player:joined', { sessionId, playerId: socket.id });
        
        // Notifier le maître et tous les joueurs
        io.to(sessionId).emit('session:player-joined', {
            players: session.players.map(p => ({
                id: p.id,
                name: p.name,
                ready: p.ready,
                totalPoints: p.totalPoints,
                power: p.power
            }))
        });
        // Mettre à jour le compteur global de joueurs pour toutes les interfaces
        io.emit('session:player-count', {
            current: session.players.length,
            max: session.maxPlayers
        });
        
        console.log(`Joueur ${playerName} a rejoint la session ${sessionId}`);
    });

    // Joueur : mettre à jour les valeurs de thème
    socket.on('player:update-theme-values', (data) => {
        const { sessionId, themeValues } = data;
        const session = gameSessions[sessionId];
        
        if (!session) return;
        
        const player = session.players.find(p => p.id === socket.id);
        if (player) {
            player.themeValues = themeValues;
            const totalPoints = Object.values(themeValues).reduce((sum, val) => sum + val, 0);
            player.totalPoints = totalPoints;
            
            io.to(sessionId).emit('session:player-updated', {
                players: session.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    ready: p.ready,
                    totalPoints: p.totalPoints,
                    power: p.power
                }))
            });
        }
    });

    // Joueur : mettre à jour le pouvoir choisi
    socket.on('player:update-power', (data) => {
        const { sessionId, power } = data;
        const session = gameSessions[sessionId];
        
        if (!session) return;
        
        const validPowers = ['grille', 'indice', 'vie', 'points', 'temps', 'rafraichissement'];
        if (!validPowers.includes(power)) return;
        
        const player = session.players.find(p => p.id === socket.id);
        if (player) {
            player.power = power;
            io.to(sessionId).emit('session:player-updated', {
                players: session.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    ready: p.ready,
                    totalPoints: p.totalPoints,
                    power: p.power
                }))
            });
        }
    });

    // Joueur : se déclarer prêt
    socket.on('player:ready', (data) => {
        const { sessionId } = data;
        const session = gameSessions[sessionId];
        
        if (!session) return;
        
        const player = session.players.find(p => p.id === socket.id);
        if (player) {
            const totalPoints = Object.values(player.themeValues).reduce((sum, val) => sum + val, 0);
            if (totalPoints !== 3) {
                socket.emit('player:ready-error', { message: 'Vous devez distribuer exactement 3 points' });
                return;
            }
            
            player.ready = true;
            
            io.to(sessionId).emit('session:player-ready', {
                players: session.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    ready: p.ready,
                    power: p.power
                }))
            });
            
            // Si le meneur est déjà sélectionné, vérifier si tous les autres joueurs sont prêts
            if (session.leader) {
                const playersToCheck = session.players.filter(p => p.id !== session.leader);
                const allReady = playersToCheck.length === (session.maxPlayers - 1) && 
                               playersToCheck.every(p => p.ready);
                
                if (allReady) {
                    // Tous les joueurs sont prêts, permettre la sélection des thèmes
                    io.to(session.masterId).emit('master:show-theme-selection', {
                        categories: getAllCategories()
                    });
                }
            }
        }
    });

    // Maître : choisir le meneur
    socket.on('master:select-leader', (data) => {
        const { sessionId, leaderId } = data;
        const session = gameSessions[sessionId];
        
        if (!session || session.masterId !== socket.id) return;
        
        // Vérifier que le leaderId correspond à un joueur de la session
        const leaderPlayer = session.players.find(p => p.id === leaderId);
        if (!leaderPlayer) {
            socket.emit('master:leader-selection-error', { message: 'Joueur introuvable' });
            return;
        }
        
        session.leader = leaderId;
        // Marquer le meneur comme prêt automatiquement (il n'a pas besoin de distribuer de points)
        leaderPlayer.ready = true;
        session.gameState = 'configuring';
        
        io.to(sessionId).emit('session:leader-selected', { leaderId, leaderName: leaderPlayer.name });
        
        // Mettre à jour la liste des joueurs pour montrer que le meneur est prêt
        io.to(sessionId).emit('session:player-ready', {
            players: session.players.map(p => ({
                id: p.id,
                name: p.name,
                ready: p.ready
            }))
        });
        
        // Vérifier si tous les autres joueurs (non-meneur) sont prêts
        const playersToCheck = session.players.filter(p => p.id !== session.leader);
        const allReady = playersToCheck.length === (session.maxPlayers - 1) && 
                        playersToCheck.every(p => p.ready);
        
        if (allReady) {
            // Tous les joueurs sont prêts, permettre la sélection des thèmes
            io.to(session.masterId).emit('master:show-theme-selection', {
                categories: getAllCategories()
            });
        } else {
            // Retourner à l'écran d'attente avec un message indiquant qu'on attend les autres joueurs
            io.to(session.masterId).emit('master:waiting-for-players', {
                message: 'Meneur sélectionné. En attente que tous les joueurs soient prêts...'
            });
        }
    });

    // Maître : choisir les 3 thèmes
    socket.on('master:select-themes', (data) => {
        const { sessionId, themes } = data;
        const session = gameSessions[sessionId];
        
        if (!session || session.masterId !== socket.id) return;
        
        if (themes.length !== 3) {
            socket.emit('master:theme-selection-error', { message: 'Vous devez choisir exactement 3 thèmes' });
            return;
        }
        
        session.selectedThemes = themes;
        
        // Générer la grille : 3 thèmes choisis + 2 aléatoires
        const allCategories = getAllCategories();
        const remainingCategories = allCategories.filter(cat => !themes.includes(cat));
        const shuffled = remainingCategories.sort(() => Math.random() - 0.5);
        const randomThemes = shuffled.slice(0, 2);
        const gridThemes = [...themes, ...randomThemes];
        
        // Créer la grille 5x5 (5 éléments par thème) sans doublons
        const grid = [];
        const usedNames = new Set(); // Pour éviter les doublons
        
        gridThemes.forEach(category => {
            const categoryItems = gameData.filter(item => item.category === category);
            const shuffled = categoryItems.sort(() => Math.random() - 0.5);
            let count = 0;
            
            // Sélectionner 5 éléments uniques de cette catégorie
            for (const item of shuffled) {
                if (count >= 5) break;
                if (!usedNames.has(item.name)) {
                    grid.push({
                        name: item.name,
                        category: item.category,
                        propositions: item.propositions,
                        indice_mot: item.indice_mot,
                        indice_phrase: item.indice_phrase
                    });
                    usedNames.add(item.name);
                    count++;
                }
            }
        });
        
        // Mélanger la grille
        const shuffledGrid = grid.sort(() => Math.random() - 0.5);
        session.grid = shuffledGrid;
        session.gridThemes = gridThemes; // Stocker les 5 thèmes utilisés dans la grille
        session.gameState = 'playing';
        
        // Démarrer le timer
        session.timer = 240;
        session.timerInterval = setInterval(() => {
            session.timer--;
            io.to(sessionId).emit('session:timer-update', { timer: session.timer });
            
            if (session.timer <= 0) {
                clearInterval(session.timerInterval);
                session.gameState = 'ended';
                io.to(sessionId).emit('session:game-ended', { reason: 'time', score: session.score });
            }
        }, 1000);
        
        // Envoyer la grille au meneur uniquement
        io.to(session.leader).emit('leader:grid-received', { grid: shuffledGrid });
        io.to(session.masterId).emit('master:game-started');
        io.to(sessionId).emit('session:game-started', {
            sessionId: sessionId,
            leaderId: session.leader,
            lives: session.lives,
            score: session.score
        });
    });

    // Meneur : révéler un thème (afficher le nom)
    socket.on('leader:reveal-theme', (data) => {
        const { sessionId, cellIndex } = data;
        const session = gameSessions[sessionId];
        
        if (!session || session.leader !== socket.id) return;
        
        if (cellIndex >= 0 && cellIndex < session.grid.length) {
            session.currentCell = cellIndex;
            const cell = session.grid[cellIndex];
            
            io.to(session.leader).emit('leader:theme-revealed', {
                cellIndex,
                name: cell.name
            });
        }
    });

    // Calculer les pouvoirs disponibles (au moins 1 joueur l'a choisi)
    function getAvailablePowers(session) {
        const counts = { grille: 0, indice: 0, vie: 0, points: 0, temps: 0, rafraichissement: 0 };
        session.players.forEach(p => {
            if (p.power && p.id !== session.leader) counts[p.power]++;
        });
        return Object.entries(counts)
            .filter(([, c]) => c >= 1)
            .reduce((acc, [k, c]) => { acc[k] = c; return acc; }, {});
    }

    // Meneur : afficher les propositions (cliquer sur le nom)
    socket.on('leader:show-propositions', (data) => {
        const { sessionId, cellIndex } = data;
        const session = gameSessions[sessionId];
        
        if (!session || session.leader !== socket.id) return;
        
        if (cellIndex >= 0 && cellIndex < session.grid.length) {
            const cell = session.grid[cellIndex];
            session.currentCell = cellIndex;
            session.currentPropositions = cell.propositions;
            session.activePowerEffects = {};
            session.powerGrilleUsed = false;
            session.powerIndiceUsed = false;
            // powerRafraichissementUsed n'est pas réinitialisé (1 fois par partie)
            
            const availablePowers = getAvailablePowers(session);
            
            // Envoyer les propositions à tous les joueurs (sauf le meneur)
            session.players.forEach(player => {
                if (player.id !== session.leader) {
                    io.to(player.id).emit('player:show-propositions', {
                        category: cell.category,
                        propositions: cell.propositions,
                        cellIndex,
                        availablePowers,
                        indice_mot: cell.indice_mot,
                        indice_phrase: cell.indice_phrase
                    });
                }
            });
        }
    });

    // Joueur : utiliser un pouvoir
    socket.on('player:use-power', (data) => {
        const { sessionId, power, cellIndex } = data;
        const session = gameSessions[sessionId];
        
        if (!session || session.currentCell !== cellIndex) return;
        
        const player = session.players.find(p => p.id === socket.id);
        if (!player || player.id === session.leader) return;
        
        const availablePowers = getAvailablePowers(session);
        if (!availablePowers[power]) return;
        
        const cell = session.grid[cellIndex];
        const count = availablePowers[power];
        
        switch (power) {
            case 'grille':
                if (session.powerGrilleUsed) return;
                session.powerGrilleUsed = true;
                const targetCount = count >= 2 ? 3 : 6;
                const correctAnswer = cell.name;
                const wrongPropositions = cell.propositions.filter(p => p !== correctAnswer);
                const shuffled = wrongPropositions.sort(() => Math.random() - 0.5);
                const selectedWrong = shuffled.slice(0, targetCount - 1);
                const reducedPropositions = [correctAnswer, ...selectedWrong].sort(() => Math.random() - 0.5);
                session.currentPropositions = reducedPropositions;
                session.players.forEach(p => {
                    if (p.id !== session.leader) {
                        io.to(p.id).emit('player:propositions-updated', { propositions: reducedPropositions });
                    }
                });
                break;
                
            case 'indice':
                if (session.powerIndiceUsed) return;
                session.powerIndiceUsed = true;
                const hint = count >= 2 ? cell.indice_phrase : cell.indice_mot;
                io.to(sessionId).emit('player:indice-revealed', { hint, type: count >= 2 ? 'phrase' : 'mot' });
                break;
                
            case 'vie':
            case 'points':
            case 'temps':
                if (session.activePowerEffects[power]) return;
                session.activePowerEffects[power] = count;
                io.to(socket.id).emit('player:power-activated', { power });
                break;
                
            case 'rafraichissement':
                if (session.powerRafraichissementUsed) return;
                session.powerRafraichissementUsed = true;
                const blackIndices = [];
                for (let i = 0; i < session.grid.length; i++) {
                    if (session.cellAnswers[i] === 'incorrect' || session.cellAnswers[i] === 'pass') {
                        blackIndices.push(i);
                    }
                }
                if (blackIndices.length > 0) {
                    const usedNames = new Set(session.grid.map(c => c.name));
                    blackIndices.forEach(idx => {
                        const theme = session.gridThemes[Math.floor(Math.random() * session.gridThemes.length)];
                        const newItem = getNewItemForCategory(theme, usedNames);
                        session.grid[idx] = {
                            name: newItem.name,
                            category: newItem.category,
                            propositions: newItem.propositions,
                            indice_mot: newItem.indice_mot,
                            indice_phrase: newItem.indice_phrase
                        };
                        usedNames.add(newItem.name);
                        delete session.cellAnswers[idx];
                    });
                    io.to(session.leader).emit('leader:grid-updated', {
                        grid: session.grid,
                        cellAnswers: session.cellAnswers
                    });
                }
                io.to(sessionId).emit('player:indice-revealed', { hint: 'Grille rafraîchie !', type: 'info' });
                break;
        }
    });

    // Meneur : passer (cacher les propositions)
    socket.on('leader:pass', (data) => {
        const { sessionId } = data;
        const session = gameSessions[sessionId];
        
        if (!session || session.leader !== socket.id) return;
        
        // Marquer la case comme "pass" si elle était active
        if (session.currentCell !== null) {
            session.cellAnswers[session.currentCell] = 'pass';
            
            // Notifier le meneur de la mise à jour de la grille
            io.to(session.leader).emit('leader:cell-updated', {
                cellIndex: session.currentCell,
                status: 'pass'
            });
        }
        
        session.currentCell = null;
        session.currentPropositions = null;
        
        // Cacher les propositions pour tous les joueurs
        session.players.forEach(player => {
            if (player.id !== session.leader) {
                io.to(player.id).emit('player:hide-propositions');
            }
        });
    });

    // Joueur : répondre à une proposition
    socket.on('player:answer', (data) => {
        const { sessionId, cellIndex, answer } = data;
        const session = gameSessions[sessionId];
        
        if (!session || session.currentCell !== cellIndex) return;
        
        const player = session.players.find(p => p.id === socket.id);
        if (!player || player.id === session.leader) return;
        
        const cell = session.grid[cellIndex];
        const isCorrect = answer === cell.name;
        const category = cell.category;
        const points = player.themeValues[category] || 0;
        
        if (isCorrect) {
            let finalPoints = points;
            const effects = session.activePowerEffects || {};
            
            // Pouvoir Points : multiplier les points
            if (effects.points) {
                const mult = effects.points >= 3 ? 4 : (effects.points >= 2 ? 3 : 2);
                finalPoints = points * mult;
            }
            session.score += finalPoints;
            
            // Pouvoir Vie : ajouter des vies
            if (effects.vie) {
                session.lives = Math.min(10, session.lives + effects.vie);
            }
            
            // Pouvoir Temps : ajouter du temps
            if (effects.temps) {
                const addSeconds = effects.temps >= 3 ? 180 : (effects.temps >= 2 ? 120 : 60);
                session.timer += addSeconds;
                io.to(sessionId).emit('session:timer-update', { timer: session.timer });
            }
            
            session.cellAnswers[cellIndex] = 'correct';
            socket.emit('player:answer-result', { correct: true, points: finalPoints });
            
            // Détecter les lignes et diagonales de 4+ mots trouvés
            const lines = detectLinesAndDiagonals(session.cellAnswers);
            
            if (lines.length > 0) {
                // Ajouter 10 points bonus pour chaque ligne/diagonale complétée
                session.score += 10 * lines.length;
                
                // Remplacer les mots dans toutes les lignes/diagonales détectées
                const allIndicesToReplace = new Set();
                lines.forEach(line => {
                    line.forEach(index => allIndicesToReplace.add(index));
                });
                
                const indicesArray = Array.from(allIndicesToReplace);
                replaceWordsInLine(session, indicesArray);
                
                // Notifier tous les joueurs du bonus
                io.to(sessionId).emit('session:bonus-points', {
                    points: 10 * lines.length,
                    reason: `${lines.length} ligne(s) ou diagonale(s) complétée(s) !`
                });
                
                // Mettre à jour le score pour tous
                io.to(sessionId).emit('session:game-update', {
                    score: session.score,
                    lives: session.lives
                });
                
                // Notifier le meneur de la mise à jour complète de la grille
                io.to(session.leader).emit('leader:grid-updated', {
                    grid: session.grid,
                    cellAnswers: session.cellAnswers
                });
            } else {
                // Notifier le meneur de la mise à jour d'une seule cellule
                io.to(session.leader).emit('leader:cell-updated', {
                    cellIndex: cellIndex,
                    status: 'correct'
                });
            }
            
            // Cacher le menu du meneur pour qu'il puisse choisir un nouveau mot
            io.to(session.leader).emit('leader:hide-menu');
        } else {
            session.lives = Math.max(0, session.lives - 1);
            session.cellAnswers[cellIndex] = 'incorrect';
            socket.emit('player:answer-result', { correct: false });
            
            // Notifier le meneur de la mise à jour de la grille
            io.to(session.leader).emit('leader:cell-updated', {
                cellIndex: cellIndex,
                status: 'incorrect'
            });
            
            // Vérifier la défaite
            if (session.lives <= 0) {
                clearInterval(session.timerInterval);
                session.gameState = 'defeat';
                io.to(sessionId).emit('session:defeat', { reason: 'lives' });
            }
        }
        
        // Mettre à jour le score et les vies pour tous
        io.to(sessionId).emit('session:game-update', {
            score: session.score,
            lives: session.lives
        });
        
        // Cacher les propositions pour tous les joueurs après la réponse
        session.players.forEach(p => {
            if (p.id !== session.leader) {
                io.to(p.id).emit('player:hide-propositions');
            }
        });
        
        // Réinitialiser la case courante
        session.currentCell = null;
        session.currentPropositions = null;
    });

    // Déconnexion
    socket.on('disconnect', () => {
        console.log('Déconnexion:', socket.id);
        
        // Nettoyer les sessions
        for (const sessionId in gameSessions) {
            const session = gameSessions[sessionId];
            
            // Si c'est le maître qui se déconnecte, arrêter la session
            if (session.masterId === socket.id) {
                io.to(sessionId).emit('session:stopped');
                if (session.timerInterval) {
                    clearInterval(session.timerInterval);
                }
                delete gameSessions[sessionId];
                break;
            }
            
            // Retirer le joueur de la session
            const playerIndex = session.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                session.players.splice(playerIndex, 1);
                io.to(sessionId).emit('session:player-left', {
                    players: session.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        ready: p.ready
                    }))
                });
                // Mettre à jour le compteur global de joueurs si c'est la session active
                if (sessionId === currentSessionId) {
                    io.emit('session:player-count', {
                        current: session.players.length,
                        max: session.maxPlayers
                    });
                }
            }
            
            // Si c'est le meneur qui se déconnecte
            if (session.leader === socket.id) {
                session.leader = null;
                io.to(sessionId).emit('session:leader-disconnected');
            }
        }
    });
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📱 Accès: http://localhost:${PORT}`);
});
