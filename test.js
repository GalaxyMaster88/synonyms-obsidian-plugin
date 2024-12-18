var synonyms = require("synonyms");
const word = 'use';
// basically returns a list of similar words
console.log(synonyms(word));
async function getSynonyms(word) {
    const response = await fetch(`https://api.datamuse.com/words?rel_syn=${word}`);
    const data = await response.json();
    return data.map((item) => item.word);
}
  
getSynonyms(word).then(synonyms => console.log(synonyms));