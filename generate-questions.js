// Script ponctuel pour ajouter un champ "question" à chaque entrée de data.json
// Usage : node generate-questions.js

const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'data.json');

function main() {
    const raw = fs.readFileSync(dataPath, 'utf8');
    const data = JSON.parse(raw);

    const updated = data.map((item) => {
        // Ne pas écraser une question déjà définie à la main
        if (item.question && typeof item.question === 'string' && item.question.trim() !== '') {
            return item;
        }

        let question = '';

        if (item.indice_phrase && typeof item.indice_phrase === 'string' && item.indice_phrase.trim() !== '') {
            // S'appuyer sur la phrase indice qui existe déjà
            question = `De quoi s'agit-il si je te dis : "${item.indice_phrase}" ?`;
        } else if (item.indice_mot && typeof item.indice_mot === 'string' && item.indice_mot.trim() !== '') {
            // Sinon, utiliser le mot indice
            question = `De quoi s'agit-il si je te donne le mot-clé "${item.indice_mot}" ?`;
        } else if (item.category && typeof item.category === 'string') {
            // Fallback générique par catégorie
            question = `Dans la catégorie "${item.category}", trouve la bonne réponse parmi les propositions.`;
        } else {
            // Fallback ultime si vraiment aucune info exploitable
            question = 'Trouve la bonne réponse parmi les propositions.';
        }

        return {
            ...item,
            question
        };
    });

    fs.writeFileSync(dataPath, JSON.stringify(updated, null, 2), 'utf8');
    console.log(`Questions générées pour ${updated.length} entrées dans data.json.`);
}

main();

