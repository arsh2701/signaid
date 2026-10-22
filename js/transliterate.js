/**
 * SignAid AI - Hindi to Hinglish (Devanagari to Roman Script) Transliterator
 * Allows hearing-impaired students who comprehend spoken Hindi/Hinglish
 * to comfortably read the transcript in Latin/Roman script.
 */

const HinglishTransliterator = {
  vowels: {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'अं': 'an', 'अः': 'ah'
  },
  
  matras: {
    'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
    'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
    'ं': 'n', 'ँ': 'n', 'ः': 'h', '्': ''
  },
  
  consonants: {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
    'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f'
  },
  
  numerals: {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9', '।': '.'
  },

  // Transliterate Devanagari text to readable phonetic Roman script (Hinglish)
  toHinglish(text) {
    if (!text || typeof text !== 'string') return '';
    let result = '';
    const len = text.length;
    
    for (let i = 0; i < len; i++) {
      const char = text[i];
      const nextChar = i + 1 < len ? text[i + 1] : '';
      
      // Check punctuation and numerals
      if (this.numerals[char]) {
        result += this.numerals[char];
        continue;
      }
      
      // Check independent vowels
      if (this.vowels[char]) {
        result += this.vowels[char];
        continue;
      }
      
      // Check consonants
      if (this.consonants[char]) {
        let roman = this.consonants[char];
        // If next char is virama (halant '्'), don't add implicit 'a'
        if (nextChar === '्') {
          result += roman;
          i++; // skip halant
        } else if (this.matras[nextChar]) {
          result += roman + this.matras[nextChar];
          i++; // skip matra
        } else if (this.isDevanagariConsonant(nextChar) || nextChar === ' ' || !nextChar) {
          // In standard Hindi, word-final consonant or consonant before space usually drops schwa 'a'
          // Unless in middle of word
          if (nextChar === ' ' || !nextChar) {
            result += roman;
          } else {
            result += roman + 'a';
          }
        } else {
          result += roman + 'a';
        }
        continue;
      }
      
      // Check lone matra
      if (this.matras[char]) {
        result += this.matras[char];
        continue;
      }
      
      // Default: retain english letters, numbers, spaces, punctuation
      result += char;
    }
    
    // Polish common words and capitalization
    return this.polishTransliteration(result);
  },

  isDevanagariConsonant(char) {
    return Boolean(this.consonants[char]);
  },

  polishTransliteration(text) {
    return text
      .replace(/aa/g, 'aa')
      .replace(/(\b[a-z])/g, (m) => m.toUpperCase()) // capitalize sentence starts or words nicely
      .trim();
  }
};

window.HinglishTransliterator = HinglishTransliterator;
