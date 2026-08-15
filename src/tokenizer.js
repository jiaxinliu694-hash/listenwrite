const TOKEN_RE = /[A-Za-z]+\d+[A-Za-z0-9-]*|\d+[A-Za-z]+(?:-[A-Za-z0-9]+)*|(?:[$£€¥]\s*)?\d+(?::\d{1,2})?(?:[.,]\d+)?(?:%|(?:st|nd|rd|th))?|[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ');
}

export function tokenizeEnglish(text, options = {}) {
  const words = String(text || '').match(TOKEN_RE) || [];
  const normalized = words.map((word) => word.replace(/’/g, "'").replace(/\s+/g, ' '));
  if (!options.unique) return normalized;
  const seen = new Set();
  return normalized.filter((word) => {
    const key = normalizeToken(word);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SMALL = {zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,seventeen:17,eighteen:18,nineteen:19};
const TENS = {twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
const ORDINAL = {first:1,second:2,third:3,fourth:4,fifth:5,sixth:6,seventh:7,eighth:8,ninth:9,tenth:10,eleventh:11,twelfth:12,thirteenth:13,fourteenth:14,fifteenth:15,sixteenth:16,seventeenth:17,eighteenth:18,nineteenth:19,twentieth:20,thirtieth:30,fortieth:40,fiftieth:50,sixtieth:60,seventieth:70,eightieth:80,ninetieth:90};

function wordsToNumber(text) {
  const parts=normalizeToken(text).replace(/-/g,' ').split(/\s+/).filter(Boolean).filter(x=>x!=='and');
  if(!parts.length)return null; let total=0,current=0,used=false;
  for(const p of parts){
    if(p in SMALL){current+=SMALL[p];used=true;}
    else if(p in TENS){current+=TENS[p];used=true;}
    else if(p==='hundred'){current=(current||1)*100;used=true;}
    else if(p==='thousand'){total+=(current||1)*1000;current=0;used=true;}
    else return null;
  }
  return used?total+current:null;
}
function numericValue(text){
  const clean=normalizeToken(text).replace(/,/g,'');
  if(/^\d+(?:\.\d+)?$/.test(clean))return Number(clean);
  return wordsToNumber(clean);
}
export function numericCanonicals(value){
  const s=normalizeToken(value).replace(/[–—]/g,'-').replace(/,/g,'').trim();
  const out=new Set();
  let m=s.match(/^£\s*(\d+(?:\.\d+)?)$/); if(m){out.add('gbp:'+Number(m[1]));return [...out];}
  m=s.match(/^(.*?)\s*(?:pounds?|gbp)$/); if(m){const n=numericValue(m[1]);if(n!=null){out.add('gbp:'+n);return [...out];}}
  m=s.match(/^\$\s*(\d+(?:\.\d+)?)$/); if(m){out.add('usd:'+Number(m[1]));return [...out];}
  m=s.match(/^(.*?)\s*(?:dollars?|usd)$/); if(m){const n=numericValue(m[1]);if(n!=null){out.add('usd:'+n);return [...out];}}
  m=s.match(/^(\d+(?:\.\d+)?)%$/); if(m){out.add('pct:'+Number(m[1]));return [...out];}
  m=s.match(/^(.*?)\s*(?:percent|per cent)$/); if(m){const n=numericValue(m[1]);if(n!=null){out.add('pct:'+n);return [...out];}}
  m=s.match(/^(\d{1,2}):(\d{1,2})$/); if(m){out.add('time:'+Number(m[1])+':'+String(Number(m[2])).padStart(2,'0'));return [...out];}
  m=s.match(/^(\d+)(?:st|nd|rd|th)$/); if(m){out.add('ord:'+Number(m[1]));return [...out];}
  if(s in ORDINAL){out.add('ord:'+ORDINAL[s]);return [...out];}
  const n=numericValue(s); if(n!=null)out.add('num:'+n);
  m=s.match(/^(.*?)\s+(.*?)$/); if(m){const h=numericValue(m[1]),min=numericValue(m[2]);if(h!=null&&min!=null&&h<=24&&min<60)out.add('time:'+h+':'+String(min).padStart(2,'0'));}
  return [...out];
}

export function numericCanonical(value){return numericCanonicals(value)[0]||null;}

export function spellingMatches(input, answer) {
  if (normalizeToken(input) === normalizeToken(answer)) return true;
  const a=numericCanonicals(answer), b=numericCanonicals(input);
  if(!a.length||!b.length)return false;
  const wanted=new Set(a);
  return b.some(value=>wanted.has(value));
}
