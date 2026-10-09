// node test.js — testy silnika rozmowy JOKERAl
const assert = require('assert');
const E = require('./engine.js');
const NOW = () => new Date(2026, 9, 9, 10, 0); // piątek 9.10.2026, 10:00
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '\n    ', e.message); } }
function mk(preset = 'gabinet', recs = []) {
  const store = E.memoryStore(recs);
  const s = E.createSession({ settings: E.defaultSettings(preset), store, now: NOW });
  s.start();
  return { s, store, say: x => { const r = s.handle(x); return r; } };
}
const has = (r, re) => assert.ok(re.test(r.say), `"${r.say}" !~ ${re}`);

console.log('Parsowanie:');
t('godziny: o 15 / 15:30 / o piętnastej trzydzieści / wpół do trzeciej / kwadrans po dziesiątej', () => {
  assert.strictEqual(E.parseTime(E.prep('o 15')), 900);
  assert.strictEqual(E.parseTime(E.prep('jutro 15:30')), 930);
  assert.strictEqual(E.parseTime(E.prep('o piętnastej trzydzieści')), 930);
  assert.strictEqual(E.parseTime(E.prep('o wpół do trzeciej')), 870);
  assert.strictEqual(E.parseTime(E.prep('kwadrans po dziesiątej')), 615);
  assert.strictEqual(E.parseTime(E.prep('stolik na 2 osoby')), null);
});
t('daty: dziś, jutro, pojutrze, w środę, 16 października, w przyszły piątek', () => {
  const d = s => E.iso(E.parseDate(E.prep(s), NOW()));
  assert.strictEqual(d('dzisiaj'), '2026-10-09');
  assert.strictEqual(d('jutro'), '2026-10-10');
  assert.strictEqual(d('pojutrze'), '2026-10-11');
  assert.strictEqual(d('w środę'), '2026-10-14');
  assert.strictEqual(d('na szesnastego października'), '2026-10-16');
  assert.strictEqual(d('w przyszły piątek'), '2026-10-16');
});
t('liczby słownie -> cyfry (telefon)', () => {
  assert.strictEqual(E.wordsToNums(E.norm('sześćset dwadzieścia trzy czterysta pięćdziesiąt sześć siedemset osiemdziesiąt dziewięć')), '623 456 789');
  assert.strictEqual(E.extractPhone(E.prep('pięć zero zero sto dwadzieścia trzy czterdzieści pięć sześć'), true), '500123456');
});

console.log('Rozmowy:');
t('pytanie o godziny otwarcia', () => { const { say } = mk(); has(say('W jakich godzinach jesteście otwarci?'), /od poniedziałku do piątku od 9:00 do 17:00.*niedzielę jest zamknięte/i); });
t('pytanie o konkretny dzień (sobota)', () => { const { say } = mk(); has(say('Czy w sobotę jest otwarte?'), /jutro.*od 9:00 do 13:00/i); });
t('cena konkretnej usługi', () => { const { say } = mk(); has(say('Ile kosztuje higienizacja?'), /Higienizacja kosztuje 300 zł/); });
t('cennik ogólny', () => { const { say } = mk(); has(say('jakie macie ceny'), /Przegląd 150 zł.*przykładowe/); });
t('adres / dojazd', () => { const { say } = mk(); has(say('Gdzie jesteście?'), /Przykładowa 1/); });
t('rezerwacja od A do Z (zamknięte o 15 w sobotę -> propozycja 12:30, imię, telefon słownie, SMS)', () => {
  const { say, store } = mk();
  has(say('Dzień dobry, chciałbym umówić wizytę na jutro'), /Na jaką usługę/);
  has(say('na przegląd'), /mam wolne/);
  has(say('o piętnastej'), /jesteśmy zamknięci.*12:30. Pasuje/);
  has(say('tak'), /12:30 jest wolna.*imię/);
  has(say('Marek Nowak'), /Dziękuję, Marek Nowak.*numer/);
  has(say('sześćset dwadzieścia trzy czterysta pięćdziesiąt sześć siedemset osiemdziesiąt dziewięć'), /Podsumuję: Przegląd, jutro, 10 października, o 12:30.*623 456 789. Zgadza się/);
  const r = say('tak, zgadza się');
  has(r, /zapisana i potwierdzona/);
  assert.ok(r.events.some(e => e.type === 'sms'));
  const b = store.list()[0];
  assert.deepStrictEqual([b.date, b.time, b.service, b.status], ['2026-10-10', '12:30', 'Przegląd', 'potwierdzone']);
});
t('wszystko w jednym zdaniu', () => {
  const { say } = mk();
  has(say('Nazywam się Ewa Kowalska, chcę umówić higienizację w środę o 11, mój numer 500 100 200'), /Podsumuję: Higienizacja, w środę, 14 października, o 11:00. Na imię Ewa Kowalska, telefon 500 100 200/);
});
t('zajęty termin -> najbliższa wolna godzina', () => {
  const { say } = mk('gabinet', [{ id: 'x', type: 'wizyta', service: 'Przegląd', date: '2026-10-12', time: '10:00', duration: 30, name: 'A', phone: '111222333', status: 'potwierdzone' }]);
  has(say('Chcę się zapisać na przegląd w poniedziałek o dziesiątej'), /zajęty.*(9:30|10:30)/);
});
t('dzień zamknięty -> propozycja innego dnia', () => { const { say } = mk(); has(say('umów mnie na przegląd w niedzielę'), /W niedzielę jesteśmy zamknięci. Może/); });
t('odwołanie wizyty po numerze', () => {
  const { say, store } = mk('gabinet', [{ id: 'x', type: 'wizyta', service: 'Przegląd', date: '2026-10-12', time: '10:00', duration: 30, name: 'Jan', phone: '623456789', status: 'potwierdzone' }]);
  has(say('Chciałbym odwołać wizytę'), /numer telefonu/);
  has(say('623 456 789'), /Widzę wizytę: Przegląd.*Odwołać/);
  has(say('tak'), /odwołana/);
  assert.strictEqual(store.list()[0].status, 'odwołane');
});
t('zmiana terminu -> odwołanie + nowa rezerwacja', () => {
  const { say, store } = mk('gabinet', [{ id: 'x', type: 'wizyta', service: 'Przegląd', date: '2026-10-12', time: '10:00', duration: 30, name: 'Jan', phone: '623456789', status: 'potwierdzone' }]);
  has(say('muszę przełożyć wizytę, numer 623456789'), /Przełożyć/);
  has(say('tak'), /nowy/);
  has(say('we wtorek o 14'), /Podsumuję: Przegląd, we wtorek, 13 października, o 14:00. Na imię Jan/);
  has(say('tak'), /zapisana/);
  assert.strictEqual(store.list().length, 2);
});
t('rozmowa z człowiekiem -> prośba o oddzwonienie', () => {
  const { say, store } = mk();
  has(say('Chcę rozmawiać z człowiekiem'), /imię/);
  has(say('Anna'), /Dziękuję, Anna.*numer/);
  has(say('500100200'), /oddzwoni pod numer 500 100 200/);
  assert.strictEqual(store.list()[0].type, 'oddzwonienie');
});
t('2x niezrozumiane -> propozycja oddzwonienia', () => {
  const { say } = mk();
  has(say('banan rower księżyc'), /nie rozumiem/);
  has(say('fioletowy słoń'), /oddzwoni.*imię/);
});
t('pożegnanie: "nie, dziękuję" kończy rozmowę', () => {
  const { say } = mk();
  say('gdzie jesteście');
  const r = say('Nie, dziękuję');
  assert.ok(r.end); has(r, /Miłego dnia/);
});
t('restauracja: stolik, kilka rezerwacji na tę samą godzinę (pojemność)', () => {
  const { say, store } = mk('restauracja');
  has(say('Chcę zarezerwować stolik na sobotę o dziewiętnastej'), /19:00 jest wolna/);
  say('Kowalska'); say('600700800');
  has(say('tak'), /zapisana/);
  assert.strictEqual(store.list()[0].time, '19:00');
});
t('tekst do mowy: godziny i daty słownie', () => {
  assert.strictEqual(E.toSpeech('jutro, 10 października, o 12:30'), 'jutro, dziesiątego października, o dwunastej trzydzieści');
});
console.log(`\n${pass} zaliczonych, ${fail} niezaliczonych`);
process.exit(fail ? 1 : 0);
