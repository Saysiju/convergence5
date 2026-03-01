# L'examen - Jeu Multi-Appareils

Application web de jeu collaboratif pour tablettes, où les joueurs doivent répondre à des questions sur différents thèmes.

## Installation

1. Installer Node.js (version 14 ou supérieure)
2. Installer les dépendances :
```bash
npm install
```

## Démarrage

1. Démarrer le serveur :
```bash
npm start
```

2. Le serveur sera accessible sur `http://localhost:3000`

## Utilisation

### Maître du Jeu

1. Ouvrir `http://localhost:3000/master.html` sur une tablette/ordinateur
2. Définir le nombre de joueurs (2-10)
3. Cliquer sur "Créer une partie"
4. Partager le code de session avec les joueurs et le meneur
5. Attendre que tous les joueurs rejoignent et se déclarent prêts
6. Choisir un meneur parmi les joueurs
7. Sélectionner 3 thèmes parmi les 9 disponibles
8. Lancer la partie

### Meneur

1. Ouvrir `http://localhost:3000/leader.html` sur une tablette
2. Entrer le code de session fourni par le maître du jeu
3. Attendre que la partie démarre
4. Voir la grille 5x5 avec les thèmes
5. Cliquer sur une case pour révéler le nom
6. Cliquer sur "Afficher les propositions" pour montrer les 9 propositions aux joueurs
7. Cliquer sur "Passe" pour passer à la case suivante

### Joueurs

1. Ouvrir `http://localhost:3000/player.html` sur chaque tablette
2. Entrer le code de session et un nom
3. Distribuer 3 points parmi les 9 thèmes disponibles
4. Cliquer sur "Prêt" une fois les 3 points distribués
5. Attendre que tous les joueurs soient prêts
6. Quand le meneur révèle un thème, voir les 9 propositions
7. Cliquer sur la bonne réponse pour gagner des points (selon les points attribués au thème)
8. Une mauvaise réponse fait perdre 1 vie à l'équipe

## Règles du Jeu

- **Objectif** : Atteindre 10 points avant la fin du temps (4 minutes) ou l'épuisement des vies (3 vies)
- **Victoire** : L'équipe atteint 10 points
- **Défaite** : Le temps est écoulé OU les vies sont épuisées
- **Points** : Chaque joueur distribue 3 points parmi 9 thèmes. Si un joueur répond correctement, l'équipe gagne le nombre de points qu'il a attribué à ce thème
- **Vies** : L'équipe commence avec 3 vies. Chaque mauvaise réponse fait perdre 1 vie

## Structure des Fichiers

- `server.js` : Serveur Node.js avec Socket.io pour la synchronisation multi-appareils
- `master.html` / `master.js` : Interface maître du jeu
- `leader.html` / `leader.js` : Interface meneur
- `player.html` / `player.js` : Interface joueur
- `game.css` : Styles CSS pour toutes les interfaces
- `data.json` : Données du jeu (éléments avec leurs propositions)
- `package.json` : Dépendances Node.js

## Technologies

- Node.js
- Express
- Socket.io (WebSocket pour la synchronisation en temps réel)
- HTML/CSS/JavaScript (vanilla)
