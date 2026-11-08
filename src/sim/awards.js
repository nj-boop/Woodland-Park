/* Zoo awards. Through the year the zoo's record is tallied in S.yr; when December closes, a panel of
   judges hands out awards for what went well. Each award pays prize money, and the fame brings more
   visitors through the next year (spawnRate). */
const AWARDS = [
  {
    id: 'popular',
    name: 'Most Popular Zoo',
    prize: 10000,
    why: (y) => `${y.vis.toLocaleString()} visitors this year`,
    won: (y) => y.vis >= 4000,
  },
  {
    id: 'animals',
    name: 'Happiest Animals',
    prize: 6000,
    why: (y) => `animals averaged ${Math.round(y.ah / y.n)}% happiness`,
    won: (y) => y.n && y.animals >= 6 && y.ah / y.n >= 80,
  },
  {
    id: 'guests',
    name: 'Best Day Out',
    prize: 6000,
    why: (y) => `guests averaged ${Math.round(y.gh / y.n)}% happiness`,
    won: (y) => y.n && y.vis >= 500 && y.gh / y.n >= 72,
  },
  {
    id: 'clean',
    name: 'Cleanest Zoo',
    prize: 3000,
    why: () => 'paths kept almost free of litter',
    won: (y) => y.n && y.vis >= 300 && y.litter / y.n < 0.02,
  },
  {
    id: 'births',
    name: 'Conservation Award',
    prize: 5000,
    why: (y) => `${y.births} babies born`,
    won: (y) => y.births >= 3,
  },
  {
    id: 'safety',
    name: 'Safety Award',
    prize: 3000,
    why: () => 'no escapes and no deaths all year',
    won: (y) => y.animals >= 10 && !y.escapes && !y.deaths,
  },
  {
    id: 'diverse',
    name: 'Most Diverse Collection',
    prize: 6000,
    why: (y) => `${y.species} species on show`,
    won: (y) => y.species >= 12,
  },
  {
    id: 'money',
    name: 'Best-Run Zoo',
    prize: 5000,
    why: (y) => `${money(y.inc - y.run)} profit`,
    won: (y) => y.inc - y.run >= 50000,
  },
];
const AWARD_FAME = 0.04; // extra visitors next year, per award won
const newYear = () => ({ vis: 0, inc: 0, run: 0, births: 0, deaths: 0, escapes: 0, ah: 0, gh: 0, litter: 0, n: 0 });
const yearRec = () => S.yr || (S.yr = newYear());
// the month's figures, added when a month closes (before S.today is reset)
function tallyMonth() {
  const y = yearRec(),
    t = S.today;
  y.vis += t.vis;
  y.inc += t.inc;
  y.run += t.run;
  y.n++;
  y.ah += S.animals.length ? S.animals.reduce((s, a) => s + a.happy, 0) / S.animals.length : 0;
  y.gh += S.guests.length ? S.guests.reduce((s, g) => s + g.h, 0) / S.guests.length : 0;
  y.litter += F.paths && F.paths.length ? F.litter.size / F.paths.length : 0;
}
// called when December closes
function judgeYear() {
  const y = yearRec();
  y.animals = S.animals.length;
  y.species = new Set(S.animals.map((a) => a.sp)).size;
  const year = Math.floor((S.day - 2) / 12) + 1,
    won = AWARDS.filter((a) => a.won(y));
  S.awards = S.awards || [];
  for (const a of won) {
    S.awards.push({ year, id: a.id, why: a.why(y) });
    S.money += a.prize;
  }
  S.fame = won.length;
  S.yr = newYear();
  if (won.length)
    toast(
      `Year ${year} awards: ${won.map((a) => a.name).join(', ')}! ${money(won.reduce((s, a) => s + a.prize, 0))} in prize money, and more visitors next year.`,
      'good'
    );
  else
    toast(`Year ${year} closed without any awards. The judges look for happy animals, happy guests and clean paths.`);
  return won;
}
