// ─── Shared local NLP helpers (used by voice.js, credit.js, webhook.js) ───

// Number word → digit (Marathi, Hindi, English)
export function extractNumber(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();

  const digit = t.match(/(\d+(?:\.\d+)?)/);
  if (digit) return parseFloat(digit[1]);

  const map = {
    "एक":1,"दोन":2,"तीन":3,"चार":4,"पाच":5,"सहा":6,"सात":7,"आठ":8,"नऊ":9,"दहा":10,
    "अकरा":11,"बारा":12,"तेरा":13,"चौदा":14,"पंधरा":15,"सोळा":16,"सतरा":17,"अठरा":18,"एकोणीस":19,
    "वीस":20,"एकवीस":21,"बावीस":22,"तेवीस":23,"चोवीस":24,"पंचवीस":25,
    "तीस":30,"पस्तीस":35,"चाळीस":40,"पंचेचाळीस":45,"पन्नास":50,
    "साठ":60,"सत्तर":70,"ऐंशी":80,"नव्वद":90,
    "शंभर":100,"दीडशे":150,"दोनशे":200,"अडीचशे":250,"तीनशे":300,
    "चारशे":400,"पाचशे":500,"हजार":1000,
    // Hindi
    "ek":1,"do":2,"teen":3,"char":4,"paanch":5,"das":10,
    "bis":20,"pachas":50,"sau":100,"ek sau":100,
  };
  for (const [w, n] of Object.entries(map)) {
    if (t.includes(w)) return n;
  }
  return null;
}

// Unit word → standard
export function extractUnit(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  const units = [
    [["किलो","किलोग्राम"," kg ","kilo","kgs"], "kg"],
    [["लिटर","लीटर","litre","liter"," l ","ltr"], "litre"],
    [["पॅकेट","पैकेट","packet","pack","पैक","पाकीट"], "packet"],
    [["ग्राम","gram"," gm "," g ","grm"], "gram"],
    [["डझन","दर्जन","dozen","doz"], "dozen"],
    [["बॉटल","बोतल","bottle","बाटली"], "bottle"],
    [["पीस","नग","piece","pcs"," pc "], "pcs"],
    [["रुपये","रुपया","rupees","rupee","rs","₹"], "rupees"],
  ];
  for (const [triggers, unit] of units) {
    if (triggers.some(t2 => t.includes(t2))) return unit;
  }
  return null;
}

// Category auto-detect
export function guessCategory(name, nameHindi) {
  const t = (name + " " + (nameHindi || "")).toLowerCase();
  if (/गहू|wheat|तांदूळ|rice|ज्वारी|बाजरी|मका|corn|atta|आटा|मैदा|maida|रवा|suji/.test(t)) return "धान्य";
  if (/तेल|oil|घी|ghee/.test(t)) return "तेल";
  if (/हळद|turmeric|मिरची|chilli|जिरे|cumin|धने|coriander|मसाला|masala|गरम/.test(t)) return "मसाले";
  if (/डाळ|dal|चणा|chana|मूग|moong|उडीद|urad|तूर|toor/.test(t)) return "डाळी";
  if (/चहा|tea|कॉफी|coffee|juice|शरबत|cold drink|pepsi|cola/.test(t)) return "पेय";
  if (/maggi|मॅगी|बिस्किट|biscuit|chips|नमकीन|namkeen|snack/.test(t)) return "नाश्ता";
  if (/दूध|milk|दही|curd|ताक|butter|लोणी|cream/.test(t)) return "दुग्धजन्य";
  if (/साबण|soap|शॅम्पू|shampoo|तेल hair|oil hair|detergent|surf/.test(t)) return "साबण/तेल";
  return "सामान्य";
}

// Smart fuzzy match — works on any { name, nameHindi? } list (items, customers)
export function findBestMatch(guess, items) {
  if (!guess || !items.length) return { match: null, candidates: [] };
  const g = guess.toLowerCase().trim();

  // Exact
  let m = items.find(i => i.name.toLowerCase() === g || (i.nameHindi && i.nameHindi.toLowerCase() === g));
  if (m) return { match: m, candidates: [] };

  // Substring both ways
  m = items.find(i =>
    i.name.toLowerCase().includes(g) || g.includes(i.name.toLowerCase()) ||
    (i.nameHindi && (i.nameHindi.toLowerCase().includes(g) || g.includes(i.nameHindi.toLowerCase())))
  );
  if (m) return { match: m, candidates: [] };

  // Word overlap scoring
  const gWords = g.split(/\s+/).filter(w => w.length > 1);
  const scored = items.map(item => {
    const iWords = [
      ...item.name.toLowerCase().split(/\s+/),
      ...(item.nameHindi ? item.nameHindi.toLowerCase().split(/\s+/) : [])
    ].filter(w => w.length > 1);
    const score = gWords.filter(gw => iWords.some(iw => iw.includes(gw) || gw.includes(iw))).length;
    return { item, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  if (scored.length === 1) return { match: scored[0].item, candidates: [] };
  if (scored.length > 1 && scored[0].score > scored[1].score) return { match: scored[0].item, candidates: [] };
  if (scored.length > 1) return { match: null, candidates: scored.slice(0, 4).map(s => s.item) };

  return { match: null, candidates: [] };
}

// Words that mark a sentence as credit vs payment (local fallback)
export const CREDIT_WORDS = /उधार|उभी|खात्यावर|माल घेतला|माल नेला|उधारी|udhaar|udhar|credit|liya|घेतला|नेला/;
export const PAYMENT_WORDS = /पैसे दिले|पैसे आले|जमा|भरले|भरून|पैसे दिले|paid|payment|जमा झाले|settle|हिशोब भरला/;

// Strip numbers + action words to guess a customer name from raw speech.
// JS \b is ASCII-only, so Devanagari words are removed with space/end anchors —
// longest-first alternations, so काकांनी is removed whole instead of leaving "ंनी".
export function guessNameFromText(text) {
  if (!text) return null;
  const strip = (re) => { text = text.replace(re, "$1"); };
  text = text
    .replace(/(\d+(?:\.\d+)?)/g, " ")
    .replace(/रुपय[ेेा]?|rupees?|rs\.?|₹/gi, " ")
    .replace(CREDIT_WORDS, " ")
    .replace(PAYMENT_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();

  // number words, honorifics, case endings — whole words only
  strip(/(^|\s)(काकांनी|काकांना|काकांचा|काकांचे|काकाला|काका|मॅडम|मैडम|madam|साहेब|साहब|यांनी|यांना|यांचा|यांचे|जी|ji|ने|ला|चा|ची|चे)(?=\s|$)/gi);
  strip(/(^|\s)(पन्नास|चाळीस|पंचेचाळीस|शंभर|दोनशे|अडीचशे|तीनशे|चारशे|पाचशे|हजार|दीडशे|दहा|वीस|एकवीस|तीस|पस्तीस|साठ|सत्तर|ऐंशी|नव्वद|एक|दोन|तीन|चार|पाच|सहा|सात|आठ|नऊ|चा)(?=\s|$)/gi);

  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    // skip stray matra fragments (combining marks at word start)
    .filter(w => w.length > 1 && !/^[\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962\u0963]/.test(w));
  if (!words.length) return null;
  return words.slice(0, 3).join(" ");
}
