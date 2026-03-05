// Gestion centralisée des sons pour Convergence 5
(function () {
  const SOUND_BASE_PATH = '/sounds/';
  const DEFAULT_VOLUME = 0.5;

  const sounds = {};

  function loadSound(key, fileName) {
    try {
      const audio = new Audio(SOUND_BASE_PATH + fileName);
      audio.preload = 'auto';
      audio.volume = DEFAULT_VOLUME;
      sounds[key] = audio;
    } catch (e) {
      // Si le navigateur bloque ou que le fichier n'existe pas, on ignore simplement
    }
  }

  // Mapping logique des sons (les fichiers doivent être ajoutés dans /sounds/)
  loadSound('clickPrimary', 'click-primary.mp3');      // Boutons principaux / validation
  loadSound('clickSecondary', 'click-secondary.mp3');  // Boutons secondaires / navigation
  loadSound('success', 'success.mp3');                 // Bonne réponse / bonus
  loadSound('error', 'error.mp3');                     // Erreur / action négative
  loadSound('grid', 'grid-click.mp3');                 // Clic sur la grille
  loadSound('timer', 'timer.mp3');                     // Actions liées au temps
  loadSound('power', 'power.mp3');                     // Pouvoirs / actions spéciales

  function playSound(key) {
    const audio = sounds[key];
    if (!audio) return;
    try {
      audio.currentTime = 0;
      // L'appel peut être ignoré par le navigateur tant qu'il n'y a pas eu d'interaction utilisateur
      audio.play().catch(() => {});
    } catch (e) {
      // On ne casse jamais l'UI à cause d'un son
    }
  }

  function handleClick(event) {
    const target = event.target;
    if (!target) return;

    // On remonte à l'élément cliqué le plus pertinent
    const el =
      target.closest(
        '.welcome-btn, .setup-btn-primary, .setup-btn, .btn, .btn-small, ' +
        '.timer-btn, .finish-btn, .action-btn, ' +
        '.cell-btn-correct, .cell-btn-incorrect, .cell-btn-pass, .cell-btn-action, ' +
        '.proposition-btn, .power-btn, .power-select-btn, ' +
        '.cell, .grid-cell'
      ) || target;

    if (el.closest('.cell-btn-correct, .grid-cell-correct, .cell-correct')) {
      playSound('success');
      return;
    }

    if (el.closest('.cell-btn-incorrect, .grid-cell-incorrect, .cell-incorrect, .btn-danger, .finish-btn')) {
      playSound('error');
      return;
    }

    if (el.closest('.timer-btn')) {
      playSound('timer');
      return;
    }

    if (el.closest('.power-btn, .power-select-btn, .action-btn')) {
      playSound('power');
      return;
    }

    if (el.closest('.cell, .grid-cell')) {
      playSound('grid');
      return;
    }

    if (el.closest('.welcome-btn, .setup-btn-primary, .btn-primary')) {
      playSound('clickPrimary');
      return;
    }

    if (el.closest('.setup-btn, .btn-secondary, .btn-small')) {
      playSound('clickSecondary');
      return;
    }
  }

  document.addEventListener('click', handleClick, true);

  // Exposer une petite API globale au besoin
  window.Conv5Sound = {
    play: playSound
  };
})();

