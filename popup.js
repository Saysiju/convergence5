// Popup assorti au design du jeu
function showGamePopup(options) {
    const overlay = document.getElementById('gamePopup');
    if (!overlay) return;
    const { title, message, score, icon } = options;
    const popupIcon = overlay.querySelector('#popupIcon');
    const popupTitle = overlay.querySelector('#popupTitle');
    const popupMessage = overlay.querySelector('#popupMessage');
    const popupScore = overlay.querySelector('#popupScore');
    const popupBtn = overlay.querySelector('#popupBtn');

    if (popupIcon) {
        popupIcon.style.display = icon ? 'block' : 'none';
        popupIcon.textContent = icon || '';
    }
    if (popupTitle) {
        popupTitle.style.display = title ? 'block' : 'none';
        popupTitle.textContent = title || '';
    }
    if (popupMessage) {
        popupMessage.textContent = message || '';
        popupMessage.style.display = message ? 'block' : 'none';
    }
    if (popupScore) {
        popupScore.style.display = score !== undefined && score !== null ? 'block' : 'none';
        popupScore.textContent = score !== undefined && score !== null ? score + ' points' : '';
    }

    overlay.classList.add('active');

    const close = () => overlay.classList.remove('active');
    popupBtn.onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
}
