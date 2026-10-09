/* JOKERAl — silnik rozmowy (reguły + intencje, bez LLM). Działa w przeglądarce i w Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JokerEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- presety (wszystkie dane przykładowe) ---------- */
  const H = (o, c) => ({ closed: false, open: o, close: c });
  const X = { closed: true, open: '09:00', close: '17:00' };
  const PRESETS = {
    gabinet: {
      label: 'Gabinet', name: 'Gabinet Demo', capacity: 1,
      address: 'ulica Przykładowa 1 w Gdańsku (adres przykładowy)',
      directions: 'Wejście od podwórza, parking przed budynkiem.',
      hours: [X, H('09:00', '17:00'), H('09:00', '17:00'), H('09:00', '17:00'), H('09:00', '17:00'), H('09:00', '17:00'), H('09:00', '13:00')],
      services: [
        { name: 'Przegląd', price: 150, duration: 30, bookable: true, example: true, keywords: 'przeglad,kontrol,konsultac' },
        { name: 'Higienizacja', price: 300, duration: 60, bookable: true, example: true, keywords: 'higieniz,czyszcz,kamien,piaskow' },
        { name: 'Wypełnienie', price: 350, duration: 60, bookable: true, example: true, keywords: 'wypelni,plomb,ubyt,boli,bol zeba' }
      ]
    },
    warsztat: {
      label: 'Warsztat', name: 'Warsztat Demo', capacity: 2,
      address: 'ulica Warsztatowa 5 w Gdańsku (adres przykładowy)',
      directions: 'Wjazd od strony parkingu, brama numer 2.',
      hours: [X, H('08:00', '18:00'), H('08:00', '18:00'), H('08:00', '18:00'), H('08:00', '18:00'), H('08:00', '18:00'), H('08:00', '14:00')],
      services: [
        { name: 'Wymiana opon', price: 120, duration: 40, bookable: true, example: true, keywords: 'opon,kol,kola,gum' },
        { name: 'Serwis olejowy', price: 250, duration: 60, bookable: true, example: true, keywords: 'olej,serwis,filtr' },
        { name: 'Diagnostyka', price: 100, duration: 30, bookable: true, example: true, keywords: 'diagnost,komputer,check,kontrolk,stuka,halas' }
      ]
    },
    restauracja: {
      label: 'Restauracja', name: 'Restauracja Demo', capacity: 6,
      address: 'ulica Smaczna 10 w Gdańsku (adres przykładowy)',
      directions: 'Wejście od deptaka, obok fontanny.',
      hours: [H('12:00', '21:00'), H('12:00', '22:00'), H('12:00', '22:00'), H('12:00', '22:00'), H('12:00', '22:00'), H('12:00', '23:00'), H('12:00', '23:00')],
      services: [
        { name: 'Rezerwacja stolika', price: null, duration: 90, bookable: true, example: true, keywords: 'stolik,stol,rezerw,miejsc,kolacj,obiad' },
        { name: 'Pizza Margherita', price: 36, duration: 0, bookable: false, example: true, keywords: 'pizz,margherit' },
        { name: 'Pierogi ruskie', price: 32, duration: 0, bookable: false, example: true, keywords: 'pierog' }
      ]
    },
    salon: {
      label: 'Salon beauty', name: 'Salon Demo', capacity: 2,
      address: 'ulica Piękna 3 w Gdańsku (adres przykładowy)',
      directions: 'Parter, wejście od ulicy.',
      hours: [X, H('10:00', '19:00'), H('10:00', '19:00'), H('10:00', '19:00'), H('10:00', '19:00'), H('10:00', '19:00'), H('09:00', '15:00')],
      services: [
        { name: 'Strzyżenie damskie', price: 120, duration: 60, bookable: true, example: true, keywords: 'strzyz,obci,fryz,wlos' },
        { name: 'Manicure hybrydowy', price: 110, duration: 60, bookable: true, example: true, keywords: 'manicur,paznok,hybryd' },
        { name: 'Koloryzacja', price: 250, duration: 120, bookable: true, example: true, keywords: 'koloryz,farb,balay,pasemk' }
      ]
    }
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  function defaultSettings(p) {
    p = PRESETS[p] ? p : 'gabinet';
    const P = PRESETS[p];
    return clone({
      preset: p, name: P.name, address: P.address, directions: P.directions,
      greeting: 'Dzień dobry! Tu {firma}, mówi asystent JOKERAl. W czym mogę pomóc?',
      voiceRate: 1, capacity: P.capacity, hours: P.hours, services: P.services,
      automation: { autoConfirm: true, fallbackToCallback: true }
    });
  }

  /* ---------- normalizacja i liczby ---------- */
  const DIA = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z' };
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/[ąćęłńóśźż]/g, c => DIA[c])
      .replace(/(\d)[.:,](\d\d)(?!\d)/g, '$1:$2')
      .replace(/[^a-z0-9:\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  const UNITS = { zero: 0, jeden: 1, jedna: 1, jedno: 1, dwa: 2, dwie: 2, trzy: 3, cztery: 4, piec: 5, szesc: 6, siedem: 7, osiem: 8, dziewiec: 9 };
  const TEENS = { dziesiec: 10, jedenascie: 11, dwanascie: 12, trzynascie: 13, czternascie: 14, pietnascie: 15, szesnascie: 16, siedemnascie: 17, osiemnascie: 18, dziewietnascie: 19 };
  const TENS = { dwadziescia: 20, trzydziesci: 30, czterdziesci: 40, piecdziesiat: 50, szescdziesiat: 60, siedemdziesiat: 70, osiemdziesiat: 80, dziewiecdziesiat: 90 };
  const HUND = { sto: 100, dwiescie: 200, trzysta: 300, czterysta: 400, piecset: 500, szescset: 600, siedemset: 700, osiemset: 800, dziewiecset: 900 };
  function numWord(w) {
    if (w in UNITS) return [UNITS[w], 1];
    if (w in TEENS) return [TEENS[w], 1.5];
    if (w in TENS) return [TENS[w], 2];
    if (w in HUND) return [HUND[w], 3];
    return null;
  }
  /* "sześćset dwadzieścia trzy" -> "623", "pięć pięć" -> "5 5" */
  function wordsToNums(t) {
    const out = []; let acc = null, last = 0;
    const flush = () => { if (acc !== null) { out.push(String(acc)); acc = null; last = 0; } };
    for (const w of t.split(' ')) {
      const n = numWord(w);
      if (!n) { flush(); if (w) out.push(w); continue; }
      const [v, m] = n;
      if (acc !== null && m < last && !(last === 2 && m === 1.5)) { acc += v; last = m === 1.5 ? 1 : m; }
      else { flush(); acc = v; last = m === 1.5 ? 1 : m; }
    }
    flush();
    return out.join(' ');
  }
  const prep = t => wordsToNums(norm(t));

  /* ---------- liczebniki porządkowe (godziny, dni) ---------- */
  const ORD = [['dziewietnast', 19], ['osiemnast', 18], ['siedemnast', 17], ['szesnast', 16], ['pietnast', 15], ['czternast', 14], ['trzynast', 13],
    ['dwunast', 12], ['jedenast', 11], ['trzydziest', 30], ['dwudziest', 20], ['dziesiat', 10], ['dziewiat', 9], ['pierwsz', 1], ['trzeci', 3],
    ['czwart', 4], ['szost', 6], ['siodm', 7], ['drug', 2], ['piat', 5], ['osm', 8]];
  const STEMS = ORD.map(o => o[0]).join('|');
  const ORDH = `((?:dwudziest(?:a|ej)(?:\\s+(?:pierwsz|drug|trzeci)(?:a|ej|iej))?)|(?:${STEMS})(?:a|ej|iej))`;
  const ORDD = `((?:(?:dwudziest|trzydziest)(?:ego|y)(?:\\s+(?:${STEMS})(?:ego|iego|y))?)|(?:${STEMS})(?:ego|iego|y))`;
  function ordVal(s) {
    let total = 0;
    for (const w of s.split(/\s+/)) { for (const [st, v] of ORD) if (w.startsWith(st)) { total += v; break; } }
    return total || null;
  }

  /* ---------- czas ---------- */
  function parseTime(n, loose) {
    let h = null, m = 0, mm;
    const NOT = '(?!\\s*(?:osob|minut|dni|zl|stycz|lut|marc|kwiet|maj|czerw|lip|sierp|wrzes|pazdz|listop|grud))';
    if ((mm = n.match(/\b(\d{1,2}):(\d{2})\b/))) { h = +mm[1]; m = +mm[2]; }
    else if ((mm = n.match(new RegExp('\\bw ?pol do ' + ORDH)))) { h = ordVal(mm[1]) - 1; m = 30; }
    else if ((mm = n.match(new RegExp('\\bkwadrans po ' + ORDH)))) { h = ordVal(mm[1]); m = 15; }
    else if ((mm = n.match(new RegExp('\\bza kwadrans ' + ORDH)))) { h = ordVal(mm[1]) - 1; m = 45; }
    else if ((mm = n.match(new RegExp('\\b(?:o|na|od|okolo|po|godzina|godzine|godz)\\s+' + ORDH + '(?:\\s+(\\d{1,2})\\b)?')))) { h = ordVal(mm[1]); m = mm[2] ? +mm[2] : 0; }
    else if ((mm = n.match(new RegExp('\\b(?:o|na|okolo|godzina|godzine|godz)\\s+(\\d{1,2})(?:\\s+(\\d{2}))?(?!\\d)' + NOT)))) { h = +mm[1]; m = mm[2] ? +mm[2] : 0; }
    else if (loose && (mm = n.match(new RegExp('\\b' + ORDH + '(?:\\s+(\\d{1,2})\\b)?')))) { h = ordVal(mm[1]); m = mm[2] ? +mm[2] : 0; }
    else if (loose && (mm = n.match(new RegExp('^(?:\\D*\\s)?(\\d{1,2})(?:\\s+(\\d{2}))?(?!\\d)' + NOT)))) { h = +mm[1]; m = mm[2] ? +mm[2] : 0; }
    if (h === null || isNaN(h)) return null;
    if (/po poludniu|wieczor|popoludni/.test(n) && h < 12) h += 12;
    else if (h >= 1 && h <= 7 && !/rano/.test(n)) h += 12;
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }

  /* ---------- daty ---------- */
  const DAY = 864e5;
  const sod = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const addDays = (d, k) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);
  const MON = ['stycz', 'lut', 'marc', 'kwiet', 'maj', 'czerw', 'lip', 'sierp', 'wrzes', 'pazdz', 'listop', 'grud'];
  const WD = [[/\bniedziel/, 0], [/\bponiedzial/, 1], [/\bwtor/, 2], [/\bsrod[ayeu]\b/, 3], [/\bczwart(?:ek|k)/, 4], [/\bpiat(?:ek|k)/, 5], [/\bsobot/, 6]];
  function parseDate(n, now) {
    const t = sod(now); let mm;
    if (/\bpojutrz/.test(n)) return addDays(t, 2);
    if (/\bjutr/.test(n)) return addDays(t, 1);
    if (/\bdzis|\bdzisiaj/.test(n)) return t;
    if (/\bza tydzien/.test(n)) return addDays(t, 7);
    if ((mm = n.match(/\bza (\d{1,2}) dni/))) return addDays(t, +mm[1]);
    const monRe = '(' + MON.join('|') + ')\\w*';
    let day = null, mon = null;
    if ((mm = n.match(new RegExp('\\b(\\d{1,2}) ' + monRe)))) { day = +mm[1]; mon = MON.indexOf(mm[2]); }
    else if ((mm = n.match(new RegExp('\\b' + ORDD + ' ' + monRe)))) { day = ordVal(mm[1]); mon = MON.indexOf(mm[2]); }
    else if ((mm = n.match(/\b(\d{1,2})\/(\d{1,2})\b/))) { day = +mm[1]; mon = +mm[2] - 1; }
    if (day && mon >= 0) {
      let d = new Date(t.getFullYear(), mon, day);
      if (d < t) d = new Date(t.getFullYear() + 1, mon, day);
      return d;
    }
    for (const [re, wd] of WD) if (re.test(n)) {
      let diff = (wd - t.getDay() + 7) % 7;
      if (/przyszl|nastepn/.test(n) && diff === 0) diff = 7;
      return addDays(t, diff);
    }
    if ((mm = n.match(new RegExp('\\b' + ORDD + '\\b')))) {
      day = ordVal(mm[1]);
      if (day && day <= 31) { let d = new Date(t.getFullYear(), t.getMonth(), day); if (d < t) d = new Date(t.getFullYear(), t.getMonth() + 1, day); return d; }
    }
    return null;
  }

  /* ---------- formatowanie ---------- */
  const DLOC = ['w niedzielę', 'w poniedziałek', 'we wtorek', 'w środę', 'w czwartek', 'w piątek', 'w sobotę'];
  const DGEN = ['niedzieli', 'poniedziałku', 'wtorku', 'środy', 'czwartku', 'piątku', 'soboty'];
  const MGEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtT = min => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
  const toMin = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
  function fmtDate(d, now) {
    const diff = Math.round((sod(d) - sod(now)) / DAY);
    const base = `${d.getDate()} ${MGEN[d.getMonth()]}`;
    if (diff === 0) return `dziś, ${base}`;
    if (diff === 1) return `jutro, ${base}`;
    return `${DLOC[d.getDay()]}, ${base}`;
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const list = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' i ' + a[a.length - 1];
  const fmtPhone = p => p.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');

  /* ---------- tekst do mowy: godziny i daty słownie ---------- */
  const HN = ['zero', 'pierwsza', 'druga', 'trzecia', 'czwarta', 'piąta', 'szósta', 'siódma', 'ósma', 'dziewiąta', 'dziesiąta', 'jedenasta', 'dwunasta', 'trzynasta', 'czternasta', 'piętnasta', 'szesnasta', 'siedemnasta', 'osiemnasta', 'dziewiętnasta', 'dwudziesta', 'dwudziesta pierwsza', 'dwudziesta druga', 'dwudziesta trzecia', 'dwudziesta czwarta', 'dwudziesta piąta', 'dwudziesta szósta', 'dwudziesta siódma', 'dwudziesta ósma', 'dwudziesta dziewiąta', 'trzydziesta', 'trzydziesta pierwsza'];
  const NUMW = ['zero', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć', 'dziesięć', 'jedenaście', 'dwanaście', 'trzynaście', 'czternaście', 'piętnaście', 'szesnaście', 'siedemnaście', 'osiemnaście', 'dziewiętnaście'];
  const TENW = ['', '', 'dwadzieścia', 'trzydzieści', 'czterdzieści', 'pięćdziesiąt'];
  const n2w = n => n < 20 ? NUMW[n] : TENW[Math.floor(n / 10)] + (n % 10 ? ' ' + NUMW[n % 10] : '');
  const inflect = (s, end) => s.split(' ').map(w => w.replace(/ga$/, 'gi' + end.slice(1)).replace(/a$/, end)).join(' ');
  function toSpeech(text) {
    return String(text)
      .replace(/JOKERA[lI]|JOKERGODA[lI]/g, m => m.startsWith('JOKERGOD') ? 'Dżoker God Al' : 'Dżoker Al')
      .replace(/\b(o|od|do|po|przed)\s+(\d{1,2}):(\d{2})\b/g, (_, p, h, m) => `${p} ${inflect(HN[+h], 'ej')}${+m ? ' ' + n2w(+m) : ''}`)
      .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => `${HN[+h]}${+m ? ' ' + n2w(+m) : ''}`)
      .replace(new RegExp('\\b(\\d{1,2}) (' + MGEN.join('|') + ')', 'g'), (_, d, mo) => `${inflect(HN[+d], 'ego')} ${mo}`)
      .replace(/\bzł\b/g, 'złotych');
  }

  /* ---------- rozpoznawanie ---------- */
  const RX = {
    human: /czlowiek|konsultant|pracownik|z kims|z osob|zyw\w* osob|wlasciciel|recepcj|polacz|oddzwon/,
    cancel: /odwol|anulow|przeloz|przesun|zmienic termin|zmiana termin|zmienic wizyt|zmienic rezerw|rezygnuj|zrezygn/,
    change: /przeloz|przesun|zmien/,
    price: /\bcen|koszt|ile plac|ile za|placi|uslug|oferuj|oferta|menu|karta dan|co macie|co robicie/,
    hours: /otwar|czynn|zamkni|godziny pracy|do ktorej|od ktorej|pracujecie|jakie sa godziny|w jakich godzinach|godziny otwar/,
    address: /adres|gdzie|dojazd|dojecha|dojsc|lokaliz|\bulic|parking|mapa|znalezc/,
    book: /umow|wizyt|rezerw|zapis|termin|stolik|wolne|wolny|przyjsc|przyjechac|wpasc|wpadnac/,
    bye: /do widzenia|dowidzenia|to wszystko|na razie|\bnara\b|\bkoniec\b|zegnam|\bpa\b|do uslyszenia|rozlacz/,
    thanks: /dzieki|dziekuj/,
    greet: /dzien dobry|\bczesc|witam|\bhej|\bhalo|dobry wieczor/,
    abort: /rezygn|\banuluj|jednak nie|nie chce|nie trzeba|zostaw to|daj spokoj/
  };
  const isNo = n => /\b(nie|niestety|nope)\b/.test(n) && !/nie ma problemu|czemu nie|dlaczego nie/.test(n);
  const isYes = n => !isNo(n) && /\b(tak|jasne|pewnie|dobrze|ok|okej|okay|zgadza|potwierdzam|poprosze|pasuje|moze byc|chetnie|super|zgoda|oczywiscie|swietnie|prosze|jak najbardziej|tak jest)\b/.test(n);

  const GENERIC = ['wymian', 'rezerw', 'uslug', 'wizyt', 'damsk', 'hybryd'];
  function matchService(n, services) {
    let best = null, score = 0;
    for (const s of services) {
      const stems = String(s.keywords || '').split(',').map(x => norm(x)).filter(Boolean);
      norm(s.name).split(' ').forEach(w => { if (w.length >= 5) { const st = w.slice(0, Math.max(5, w.length - 2)); if (!GENERIC.some(g => st.startsWith(g))) stems.push(st); } });
      const sc = stems.filter(st => new RegExp('\\b' + st).test(n)).length;
      if (sc > score) { score = sc; best = s; }
    }
    return best;
  }
  function extractPhone(n, loose) {
    const fix = d => (d.length === 11 && d.startsWith('48')) ? d.slice(2) : d;
    const runs = (n.replace(/\d{1,2}:\d{2}/g, ' ').match(/\d+(?:\s\d+)*/g) || []).map(r => fix(r.replace(/\s/g, '')));
    let d = runs.find(r => r.length === 9);
    if (!d && loose) { const all = fix(runs.join('')); if (all.length === 9) d = all; }
    if (d && (loose || /numer|telefon|\btel\b/.test(n) || /\b\d{3}\s?\d{3}\s?\d{3}\b/.test(n))) return d;
    return null;
  }
  const NAME_STOP = new Set(['to', 'na', 'imie', 'nazwisko', 'prosze', 'jest', 'moje', 'mi', 'mam', 'nazywam', 'sie', 'jestem', 'ja', 'pan', 'pani', 'tak', 'z', 'tej', 'strony', 'tu', 'zapisz', 'zapisac', 'mnie', 'a', 'no', 'wiec', 'imieniu']);
  function extractName(text, explicitOnly) {
    const raw = String(text || '').replace(/[.,!?]/g, ' ');
    let m = raw.match(/(?:nazywam się|mam na imię|na imię mam|z tej strony|moje imię to)\s+(.+)/i);
    if (!m && explicitOnly) return null;
    const src = m ? m[1] : raw;
    const words = src.split(/\s+/).filter(w => w && !/\d/.test(w) && !NAME_STOP.has(norm(w)));
    if (!words.length) return null;
    if (words.length > 3 && !m) return null;
    return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }

  /* ---------- sesja rozmowy ---------- */
  let seq = 0;
  const uid = p => p + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);

  function createSession(opts) {
    const S = opts.settings, store = opts.store, now = opts.now || (() => new Date());
    const st = { mode: 'idle', b: null, c: null, cb: null, misses: 0, ended: false, outcome: 'informacja', asked: false };
    const transcript = [];
    const started = now();
    const bookable = () => S.services.filter(s => s.bookable);
    const spokenName = s => s.name.replace(/\s*\(przykład\)/i, '');

    /* godziny i sloty */
    const dayHours = d => { const h = S.hours[d.getDay()]; return h && !h.closed ? [toMin(h.open), toMin(h.close)] : null; };
    const active = () => store.list().filter(r => r.type === 'wizyta' && r.status !== 'odwołane');
    function slotState(d, t, svc) {
      const hrs = dayHours(d); const dur = svc.duration || 30;
      if (!hrs) return 'closed';
      if (t < hrs[0] || t + dur > hrs[1]) return 'closed';
      const nw = now();
      if (sod(d).getTime() === sod(nw).getTime() && t < nw.getHours() * 60 + nw.getMinutes() + 30) return 'past';
      const ds = iso(d);
      const busy = active().filter(r => r.date === ds && toMin(r.time) < t + dur && toMin(r.time) + (r.duration || 30) > t).length;
      return busy >= (S.capacity || 1) ? 'busy' : 'ok';
    }
    function freeSlots(d, svc) {
      const hrs = dayHours(d); if (!hrs) return [];
      const out = [];
      for (let t = hrs[0]; t + (svc.duration || 30) <= hrs[1]; t += 30) if (slotState(d, t, svc) === 'ok') out.push(t);
      return out;
    }
    function nextDayWithSlots(d, svc) {
      for (let k = 1; k <= 21; k++) { const nd = addDays(d, k); if (freeSlots(nd, svc).length) return nd; }
      return null;
    }
    const fd = d => fmtDate(d, now());

    /* odpowiedzi informacyjne */
    function hoursAnswer(n) {
      const d = parseDate(n, now());
      if (d) {
        const h = S.hours[d.getDay()];
        const lbl = cap(fd(d));
        return h.closed ? `${lbl}, jesteśmy zamknięci.` : `${lbl}, jesteśmy otwarci od ${fmtT(toMin(h.open))} do ${fmtT(toMin(h.close))}.`;
      }
      const order = [1, 2, 3, 4, 5, 6, 0], parts = [];
      let i = 0;
      while (i < 7) {
        let j = i; const key = h => h.closed ? 'x' : h.open + h.close;
        while (j + 1 < 7 && key(S.hours[order[j + 1]]) === key(S.hours[order[i]])) j++;
        const h = S.hours[order[i]];
        const who = i === j ? DLOC[order[i]] : `od ${DGEN[order[i]]} do ${DGEN[order[j]]}`;
        parts.push(h.closed ? `${who} jest zamknięte` : `${who} od ${fmtT(toMin(h.open))} do ${fmtT(toMin(h.close))}`);
        i = j + 1;
      }
      return cap(parts.join(', ')) + '.';
    }
    function priceAnswer(n) {
      const s = matchService(n, S.services);
      const ex = S.services.some(x => x.example) ? ' To ceny przykładowe.' : '';
      if (s) {
        const p = s.price == null ? `${spokenName(s)} jest bez opłaty.` : `${spokenName(s)} kosztuje ${s.price} zł.`;
        return p + (s.duration && s.bookable ? ` Trwa około ${s.duration} minut.` : '') + (s.example ? ' To cena przykładowa.' : '');
      }
      const items = S.services.slice(0, 6).map(s => s.price == null ? `${spokenName(s)} bez opłaty` : `${spokenName(s)} ${s.price} zł`);
      return `Mamy: ${list(items)}.${ex}`;
    }
    const addressAnswer = () => `Jesteśmy pod adresem: ${S.address}. ${S.directions || ''}`.trim();

    /* rezerwacja */
    function startBooking(n, text, pre) {
      st.mode = 'booking'; st.b = Object.assign({ service: null, date: null, time: null, name: null, phone: null, step: null, suggest: null, misses: 0, acked: false }, pre || {});
      return bookingTurn(n, text, true);
    }
    function bookingTurn(n, text, first) {
      const b = st.b;
      let changed = false;
      if (b.step === 'what') {
        if (/dzien|dnia|termin|data|date/.test(n)) { b.date = null; b.time = null; changed = true; }
        if (/godzin/.test(n)) { b.time = null; changed = true; }
        if (/uslug|zabieg/.test(n)) { b.service = null; changed = true; }
        if (/numer|telefon/.test(n)) { b.phone = null; changed = true; }
        if (/imie|nazw/.test(n)) { b.name = null; changed = true; }
        b.acked = false;
      }
      const svc = matchService(n, bookable());
      const d = parseDate(n, now());
      const t = parseTime(n, b.step === 'time');
      const ph = extractPhone(n, b.step === 'phone');
      let nm = extractName(text, true);
      if (!nm && b.step === 'name' && !svc && !d && t === null && !ph && !isYes(n) && !isNo(n)) nm = extractName(text, false);
      const fresh = !!(svc || d || t !== null || ph || nm);

      if (!first && !fresh && !changed) {
        if (b.step === 'confirm' && isYes(n)) return finalize();
        if (b.step === 'confirm' && isNo(n)) { b.step = 'what'; return 'Co mam zmienić: dzień, godzinę, usługę, imię czy numer?'; }
        if (b.suggest && isYes(n)) { Object.assign(b, b.suggest); b.suggest = null; return next(); }
        if (b.suggest && isNo(n)) { b.suggest = null; return b.step === 'date' ? 'Dobrze. Na jaki dzień w takim razie?' : 'Dobrze. Na którą godzinę w takim razie?'; }
        if (RX.abort.test(n) || RX.bye.test(n)) { st.mode = 'anything'; st.b = null; return 'Dobrze, nic nie zapisuję. Czy mogę jeszcze w czymś pomóc?'; }
        if (RX.human.test(n)) { st.b = null; return startCallback('rozmowa z pracownikiem (w trakcie rezerwacji)'); }
        if (RX.hours.test(n)) return hoursAnswer(n) + ' ' + next();
        if (RX.price.test(n)) return priceAnswer(n) + ' ' + next();
        if (RX.address.test(n)) return addressAnswer() + ' ' + next();
        if (b.step === 'phone') return 'Numer telefonu ma dziewięć cyfr. Proszę powtórzyć go powoli.';
        if (b.step === 'name') return 'Proszę jeszcze raz podać imię.';
        b.misses++;
        if (b.misses >= 2 && S.automation && S.automation.fallbackToCallback) { st.b = null; return startCallback('nieudana rezerwacja', 'Nie chcę tego przeciągać. Zostawmy kontakt, a ktoś z nas oddzwoni i wszystko ustali. Na jakie imię zapisać?'); }
        return 'Przepraszam, tego nie rozumiem. ' + next();
      }
      if (svc) b.service = svc;
      if (d) { b.date = d; b.acked = false; }
      if (t !== null) { b.time = t; b.acked = false; }
      if (ph) b.phone = ph;
      if (nm) b.name = nm;
      b.suggest = null; b.misses = 0;
      return next();
    }
    function next() {
      const b = st.b, svcs = bookable();
      if (!svcs.length) { st.mode = 'idle'; return 'Przez telefon nie przyjmujemy rezerwacji. Mogę przekazać prośbę o kontakt.'; }
      if (!b.service) {
        if (svcs.length === 1) b.service = svcs[0];
        else { b.step = 'service'; return `Na jaką usługę umówić? Mamy: ${list(svcs.map(spokenName))}.`; }
      }
      if (!b.date) { b.step = 'date'; return b.time !== null ? `Na jaki dzień, o ${fmtT(b.time)}?` : 'Na jaki dzień?'; }
      const today = sod(now());
      if (b.date < today) { b.date = null; b.step = 'date'; return 'Ten dzień już minął. Na jaki inny dzień?'; }
      if (!dayHours(b.date)) {
        const nd = nextDayWithSlots(b.date, b.service); const was = b.date; b.date = null; b.step = 'date';
        if (!nd) return `${cap(DLOC[was.getDay()])} jesteśmy zamknięci. Na jaki inny dzień?`;
        b.suggest = { date: nd };
        return `${cap(DLOC[was.getDay()])} jesteśmy zamknięci. Może ${fd(nd)}?`;
      }
      if (b.time === null) {
        const free = freeSlots(b.date, b.service);
        if (!free.length) {
          const nd = nextDayWithSlots(b.date, b.service); const was = b.date; b.date = null; b.step = 'date';
          if (!nd) return `${cap(fd(was))} nie ma już wolnych terminów. Na jaki inny dzień?`;
          b.suggest = { date: nd };
          return `${cap(fd(was))} nie ma już wolnych terminów. Może ${fd(nd)}?`;
        }
        b.step = 'time'; b.suggest = { time: free[0] };
        const pick = free.length <= 3 ? free : [free[0], free[Math.floor(free.length / 2)], free[free.length - 1]];
        return `${cap(fd(b.date))} mam wolne na przykład: ${list(pick.map(fmtT))}. Która godzina pasuje?`;
      }
      const state = slotState(b.date, b.time, b.service);
      if (state !== 'ok') {
        const free = freeSlots(b.date, b.service);
        const asked = b.time; b.time = null; b.step = 'time';
        const why = state === 'busy' ? `O ${fmtT(asked)} termin jest już zajęty.` : state === 'past' ? 'Ta godzina już minęła.' : `O ${fmtT(asked)} jesteśmy zamknięci.`;
        if (free.length) {
          const alt = free.reduce((a, x) => Math.abs(x - asked) < Math.abs(a - asked) ? x : a, free[0]);
          b.suggest = { time: alt };
          return `${why} Najbliższa wolna godzina to ${fmtT(alt)}. Pasuje?`;
        }
        const nd = nextDayWithSlots(b.date, b.service); b.date = null; b.step = 'date';
        if (nd) { b.suggest = { date: nd }; return `${why} Tego dnia nie ma już miejsc. Może ${fd(nd)}?`; }
        return `${why} Na jaki inny dzień?`;
      }
      let ack = '';
      if (!b.acked) { b.acked = true; ack = `Świetnie, ${fmtT(b.time)} jest wolna. `; }
      if (!b.name) { b.step = 'name'; return ack + 'Na jakie imię zapisać?'; }
      if (!b.phone) { b.step = 'phone'; return `${ack}Dziękuję, ${b.name}. Jaki numer telefonu zapisać? Wyślę na niego SMS z potwierdzeniem.`; }
      b.step = 'confirm';
      return `Podsumuję: ${spokenName(b.service)}, ${fd(b.date)}, o ${fmtT(b.time)}. Na imię ${b.name}, telefon ${fmtPhone(b.phone)}. Zgadza się?`;
    }
    function finalize() {
      const b = st.b, auto = !S.automation || S.automation.autoConfirm;
      if (slotState(b.date, b.time, b.service) !== 'ok') { b.step = 'time'; b.time = null; return 'Ktoś właśnie zajął ten termin. ' + next(); }
      const rec = { id: uid('w'), type: 'wizyta', service: spokenName(b.service), date: iso(b.date), time: fmtT(b.time), duration: b.service.duration || 30,
        name: b.name, phone: b.phone, status: auto ? 'potwierdzone' : 'nowe', created: now().toISOString(), note: st.prevBooking ? 'przełożona' : '' };
      store.add(rec);
      st.lastEvents.push({ type: 'booking', record: rec });
      st.outcome = st.prevBooking ? 'zmiana terminu' : 'wizyta';
      st.mode = 'anything'; st.b = null;
      if (auto) {
        st.lastEvents.push({ type: 'sms', to: rec.phone, text: `${S.name}: potwierdzamy - ${rec.service}, ${fd(fromIso(rec.date))}, godz. ${rec.time}. Do zobaczenia!` });
        return 'Gotowe! Wizyta jest zapisana i potwierdzona. SMS z potwierdzeniem jest już w drodze. Czy mogę jeszcze w czymś pomóc?';
      }
      return 'Zapisane! Zgłoszenie czeka na potwierdzenie przez pracownika, a SMS przyjdzie po potwierdzeniu. Czy mogę jeszcze w czymś pomóc?';
    }

    /* odwołanie / zmiana */
    function startCancel(n, text, change) {
      st.mode = 'cancel'; st.c = { change, step: 'id', tries: 0, found: null };
      const r = cancelTurn(n, text, true);
      return r || (change ? 'Jasne, przełożymy. ' : 'Jasne. ') + 'Na jaki numer telefonu jest zapisana wizyta?';
    }
    function cancelTurn(n, text, first) {
      const c = st.c;
      if (c.step === 'confirm') {
        if (isYes(n)) {
          store.update(c.found.id, { status: 'odwołane' });
          st.lastEvents.push({ type: 'cancel', record: c.found });
          st.outcome = 'odwołanie';
          if (c.change) {
            st.prevBooking = c.found;
            const svc = bookable().find(s => spokenName(s) === c.found.service) || null;
            startBookingSilent({ service: svc, name: c.found.name, phone: c.found.phone });
            return 'Stary termin odwołany. Na jaki dzień umówić nowy?';
          }
          st.mode = 'anything'; st.c = null;
          return 'Wizyta odwołana. Czy mogę jeszcze w czymś pomóc?';
        }
        if (isNo(n)) { st.mode = 'anything'; st.c = null; return 'Dobrze, wizyta zostaje bez zmian. Czy mogę jeszcze w czymś pomóc?'; }
        return c.change ? 'Czy przełożyć tę wizytę? Proszę powiedzieć tak albo nie.' : 'Czy odwołać tę wizytę? Proszę powiedzieć tak albo nie.';
      }
      if (c.step === 'offer') {
        if (isYes(n)) return startCallback(c.change ? 'zmiana terminu wizyty' : 'odwołanie wizyty', null, { phone: c.phone });
        st.mode = 'anything'; st.c = null; return 'Dobrze. Czy mogę jeszcze w czymś pomóc?';
      }
      const ph = extractPhone(n, !first);
      const today = iso(now());
      const mine = active().filter(r => r.date >= today);
      let found = null;
      if (ph) found = mine.find(r => r.phone === ph);
      if (!found && !first) { const nn = norm(text); found = mine.find(r => r.name && nn.includes(norm(r.name).split(' ')[0])); }
      if (found) {
        c.found = found; c.step = 'confirm';
        return `Widzę wizytę: ${found.service}, ${fd(fromIso(found.date))}, o ${found.time}. ${c.change ? 'Przełożyć ją na inny termin?' : 'Odwołać ją?'}`;
      }
      if (first) return null;
      c.tries++; c.phone = ph;
      if (!ph && c.tries < 2) return 'Proszę podać numer telefonu, dziewięć cyfr.';
      c.step = 'offer';
      return 'Nie widzę wizyty na ten numer. Mogę przekazać sprawę pracownikowi, który oddzwoni. Przekazać?';
    }
    function startBookingSilent(pre) {
      st.mode = 'booking';
      st.b = Object.assign({ service: null, date: null, time: null, name: null, phone: null, step: 'date', suggest: null, misses: 0, acked: false }, pre);
    }

    /* oddzwonienie */
    function startCallback(reason, intro, pre) {
      st.mode = 'callback'; st.cb = Object.assign({ reason, name: null, phone: null, step: 'name' }, pre || {});
      if (st.cb.phone && !st.cb.name) return 'Dobrze. Na jakie imię zapisać prośbę o kontakt?';
      return intro || 'Jasne, przekażę to pracownikowi. Na jakie imię zapisać prośbę o kontakt?';
    }
    function callbackTurn(n, text) {
      const cb = st.cb;
      const ph = extractPhone(n, cb.step === 'phone');
      if (ph) cb.phone = ph;
      const nm = extractName(text, true) || (cb.step === 'name' && !ph && !isNo(n) ? extractName(text, false) : null);
      if (nm && !cb.name) cb.name = nm;
      if (!cb.name) { cb.step = 'name'; return 'Proszę podać imię.'; }
      if (!cb.phone) { cb.step = 'phone'; return `Dziękuję, ${cb.name}. Pod jaki numer oddzwonić?`; }
      const rec = { id: uid('o'), type: 'oddzwonienie', service: '', date: iso(now()), time: fmtT(now().getHours() * 60 + now().getMinutes()), duration: 0,
        name: cb.name, phone: cb.phone, status: 'nowe', created: now().toISOString(), note: cb.reason };
      store.add(rec);
      st.lastEvents.push({ type: 'callback', record: rec });
      st.outcome = 'oddzwonienie';
      st.mode = 'anything'; st.cb = null;
      return `Dziękuję, ${rec.name}. Przekazuję sprawę. Ktoś z nas oddzwoni pod numer ${fmtPhone(rec.phone)} najszybciej, jak to możliwe. Czy mogę jeszcze w czymś pomóc?`;
    }

    function bye() { st.ended = true; st.mode = 'ended'; return 'Dziękuję za rozmowę. Miłego dnia i do usłyszenia!'; }
    function miss(n) {
      st.misses++;
      if (st.misses >= 2 && S.automation && S.automation.fallbackToCallback) {
        st.misses = 0;
        return startCallback('niezrozumiane pytanie', 'Przepraszam, że nie mogę pomóc. Zostawmy kontakt, a ktoś z nas oddzwoni. Na jakie imię zapisać?');
      }
      return 'Przepraszam, tego nie rozumiem. Mogę umówić wizytę, podać godziny otwarcia, ceny albo adres. W czym pomóc?';
    }

    function route(n, text) {
      if (st.mode === 'ended') return 'Rozmowa jest zakończona.';
      if (st.mode === 'booking') return bookingTurn(n, text, false);
      if (st.mode === 'cancel') return cancelTurn(n, text, false);
      if (st.mode === 'callback') {
        if (RX.abort.test(n) && !extractPhone(n, true)) { st.mode = 'anything'; st.cb = null; return 'Dobrze. Czy mogę jeszcze w czymś pomóc?'; }
        return callbackTurn(n, text);
      }
      const bare = !RX.human.test(n) && !RX.cancel.test(n) && !RX.price.test(n) && !RX.hours.test(n) && !RX.address.test(n) && !RX.book.test(n);
      if (bare && (st.mode === 'anything' || st.mode === 'offerBook')) {
        if (st.mode === 'offerBook' && isNo(n) && !RX.thanks.test(n) && !RX.bye.test(n)) { st.mode = 'anything'; return 'Dobrze. Czy mogę jeszcze w czymś pomóc?'; }
        if (isNo(n) || (RX.thanks.test(n) && !isYes(n))) return bye();
        if (isYes(n) && st.mode === 'offerBook') return startBooking(n, text);
        if (isYes(n)) { st.mode = 'idle'; return 'W czym mogę pomóc?'; }
      }
      if (RX.human.test(n)) return startCallback('rozmowa z pracownikiem');
      if (RX.cancel.test(n)) return startCancel(n, text, RX.change.test(n));
      if (RX.price.test(n)) { st.misses = 0; const a = priceAnswer(n); if (bookable().length) { st.mode = 'offerBook'; return a + ' Umówić wizytę?'; } st.mode = 'anything'; return a + ' Czy mogę jeszcze w czymś pomóc?'; }
      if (RX.hours.test(n)) { st.misses = 0; st.mode = 'offerBook'; return hoursAnswer(n) + ' Umówić wizytę?'; }
      if (RX.address.test(n)) { st.misses = 0; st.mode = 'anything'; return addressAnswer() + ' Czy mogę jeszcze w czymś pomóc?'; }
      if (RX.book.test(n) || parseDate(n, now()) || parseTime(n, false) !== null || matchService(n, bookable())) { st.misses = 0; return startBooking(n, text); }
      if (RX.bye.test(n) || RX.thanks.test(n)) return bye();
      if (RX.greet.test(n)) return 'Dzień dobry! W czym mogę pomóc? Mogę na przykład umówić wizytę.';
      return miss(n);
    }

    return {
      start() { const g = (S.greeting || 'Dzień dobry! W czym mogę pomóc?').replace(/\{firma\}/g, S.name); transcript.push({ who: 'agent', text: g, t: now().toISOString() }); return { say: g, end: false, events: [] }; },
      handle(text) {
        transcript.push({ who: 'klient', text: String(text), t: now().toISOString() });
        st.lastEvents = [];
        const say = route(prep(text), String(text));
        transcript.push({ who: 'agent', text: say, t: now().toISOString() });
        return { say, end: st.ended, events: st.lastEvents };
      },
      get transcript() { return transcript; },
      get outcome() { return st.outcome; },
      get state() { return st; },
      started
    };
  }

  /* ---------- przechowywanie w przeglądarce ---------- */
  const KEYS = { settings: 'jokeral.settings', records: 'jokeral.records', convos: 'jokeral.convos', pin: 'jokeral.pin' };
  function memoryStore(init) {
    let a = clone(init || []);
    return { list: () => a, add: r => { a.push(r); return r; }, update: (id, p) => { const r = a.find(x => x.id === id); if (r) Object.assign(r, p); }, remove: id => { a = a.filter(x => x.id !== id); } };
  }
  function browserStore() {
    const load = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
    const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    return {
      list: () => load(KEYS.records),
      add(r) { const a = load(KEYS.records); a.push(r); save(KEYS.records, a); return r; },
      update(id, p) { const a = load(KEYS.records); const r = a.find(x => x.id === id); if (r) Object.assign(r, p); save(KEYS.records, a); },
      remove(id) { save(KEYS.records, load(KEYS.records).filter(x => x.id !== id)); },
      replace(a) { save(KEYS.records, a); },
      convos: () => load(KEYS.convos),
      addConvo(c) { const a = load(KEYS.convos); a.unshift(c); save(KEYS.convos, a.slice(0, 200)); },
      removeConvo(id) { save(KEYS.convos, load(KEYS.convos).filter(x => x.id !== id)); }
    };
  }
  function loadSettings() {
    try { const s = JSON.parse(localStorage.getItem(KEYS.settings)); if (s && s.services && s.hours) return s; } catch (e) { }
    return defaultSettings('gabinet');
  }
  const saveSettings = s => localStorage.setItem(KEYS.settings, JSON.stringify(s));

  return { PRESETS, defaultSettings, createSession, parseTime, parseDate, wordsToNums, norm, prep, extractPhone, extractName, matchService,
    toSpeech, fmtDate, fmtT, iso, fromIso, KEYS, memoryStore, browserStore, loadSettings, saveSettings, uid };
});
