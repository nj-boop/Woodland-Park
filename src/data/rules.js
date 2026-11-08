/* Game rules and tables: salaries, path and fence types, diets, care profiles, species guide, unlock tiers, names. */
const PATHS = {
  stone: { name: 'Stone paver', cost: 15, sw: '#9b968e' },
  brick: { name: 'Brick', cost: 12, sw: '#a8553a' },
  asphalt: { name: 'Asphalt', cost: 10, sw: '#55575a' },
  dirt: { name: 'Dirt trail', cost: 5, sw: '#8a6c47' },
  sand: { name: 'Sand', cost: 6, sw: '#d9c08a' },
  tunnel: { name: 'Glass tunnel', cost: 120, sw: '#7fc6e0' },
  service: { name: 'Road', cost: 8, sw: '#62666a', staffOnly: true }, // vehicles and staff only
};
// care profile per species: diet, favourite toy, shelter type, strength (escape risk), wants privacy
const CARE = {
  zebra: ['hay', 'post', 'shade', 2],
  giraffe: ['browse', 'post', 'stable', 2],
  lion: ['meat', 'ball', 'cave', 3, 1],
  elephant: ['hay', 'log', 'stable', 4],
  tiger: ['meat', 'ball', 'cave', 3, 1],
  polar: ['fish', 'ice', 'cave', 3, 1],
  camel: ['hay', 'post', 'shade', 2],
  fox: ['meat', 'ball', 'cave', 1],
  bison: ['hay', 'post', 'shade', 4],
  monkey: ['fruit', 'climber', 'shade', 2],
  gorilla: ['fruit', 'climber', 'cave', 4, 1],
  penguin: ['fish', 'ice', 'shade', 1],
  kangaroo: ['hay', 'log', 'shade', 2],
  dolphin: ['fish', 'floater', null, 1],
  sealion: ['fish', 'floater', null, 1],
  turtle: ['greens', 'floater', null, 1],
  shark: ['fish', null, null, 1],
  orca: ['fish', 'floater', null, 1],
};
const DIET = {
  hay: { name: 'Hay and grass', cost: 6 },
  browse: { name: 'Acacia browse', cost: 9 },
  meat: { name: 'Meat', cost: 16 },
  fish: { name: 'Fish', cost: 13 },
  fruit: { name: 'Fruit and leaves', cost: 8 },
  greens: { name: 'Sea greens', cost: 7 },
};
const FSTR = { wood: 2, chain: 2, iron: 4, stone: 5, glass: 5, moat: 5 };
// guide entries: conservation status (approximate, for the wild species most like each) and a short note
const GUIDE = {
  zebra: ['Near threatened', 'Each zebra’s stripe pattern is unique, like a fingerprint.'],
  giraffe: ['Vulnerable', 'Giraffes need only a few hours of sleep a day, often standing up.'],
  lion: ['Vulnerable', 'Lions are the only big cats that live in family groups called prides.'],
  elephant: ['Endangered', 'An elephant’s trunk has tens of thousands of muscles.'],
  tiger: ['Endangered', 'Tigers are strong swimmers and often cool off in water.'],
  polar: ['Vulnerable', 'Under the white fur, a polar bear’s skin is black.'],
  camel: ['Domesticated', 'A camel’s hump stores fat, not water.'],
  fox: ['Least concern', 'Fennec foxes lose body heat through their huge ears.'],
  bison: ['Near threatened', 'Bison can sprint at about 35 miles an hour.'],
  monkey: ['Least concern', 'Many monkeys use their tails like a fifth hand.'],
  gorilla: ['Critically endangered', 'Gorillas build a fresh sleeping nest every night.'],
  penguin: ['Near threatened', 'Penguins can drink seawater and filter out the salt.'],
  kangaroo: ['Least concern', 'Kangaroos use their tail as a fifth leg when moving slowly.'],
  dolphin: ['Least concern', 'Dolphins sleep with one half of the brain at a time.'],
  sealion: ['Least concern', 'Sea lions can rotate their back flippers to walk on land.'],
  turtle: ['Endangered', 'Sea turtles return to the beach where they hatched to lay eggs.'],
  shark: ['Vulnerable', 'Sharks grow and shed thousands of teeth over a lifetime.'],
  orca: ['Data deficient', 'Orca pods have their own dialects of calls.'],
};
const care = (k) => {
  const c = CARE[k] || ['hay', null, null, 1];
  return { diet: c[0], toy: c[1], shelter: c[2], str: c[3], privacy: !!c[4] };
};
const TIERS = [
  { n: 1, name: 'Petting-zoo start', sp: ['zebra', 'kangaroo', 'camel', 'fox', 'penguin', 'monkey', 'turtle'] },
  { n: 2, name: 'Regional attraction', rating: 50, vis: 100, sp: ['giraffe', 'bison', 'sealion', 'polar'] },
  {
    n: 3,
    name: 'Major zoo',
    rating: 62,
    vis: 400,
    need: 'vetclinic',
    sp: ['lion', 'tiger', 'gorilla', 'dolphin', 'shark'],
  },
  { n: 4, name: 'World-class zoo', rating: 76, vis: 1200, need: 'stage', sp: ['elephant', 'orca'] },
];
const tierOf = (sp) => TIERS.find((t) => t.sp.includes(sp)).n;
const unlocked = (sp) => tierOf(sp) <= (S.tier || 1);
const BARRIER_COST = 1500;
const SWIM_Y = { dolphin: 0.25, sealion: 0.22, turtle: 0.2, shark: 0.26, orca: 0.3 };
const TANK_H = 0.62;
const FENCES = {
  glass: { name: 'Glass tank', cost: 80, sw: '#9fd3e4', hidden: true },
  moat: { name: 'Dry moat', cost: 90, sw: '#5a4a3a' },
  iron: { name: 'Iron bars', cost: 40, sw: '#2c2c2c' },
  stone: { name: 'Stone wall', cost: 50, sw: '#8e8a82' },
  wood: { name: 'Log rail', cost: 30, sw: '#7a5230' },
  chain: { name: 'Chain link', cost: 25, sw: '#9aa3a8' },
};
let pathSub = 'stone',
  fenceSub = 'iron',
  habMode = 'rect',
  terrSub = 'raise',
  brushSize = 2,
  paintE = null;
const brushR = () => [0.8, 1.5, 2.4][brushSize - 1];
const BASE_PRICE = { food: 6, drink: 3 };
const TREAT_COST = 40;
const ANAMES = [
  'Kibo',
  'Nala',
  'Juniper',
  'Bramble',
  'Tamu',
  'Ziggy',
  'Okapi',
  'Pepper',
  'Sable',
  'Moss',
  'Bao',
  'Tilly',
  'Rufus',
  'Amara',
  'Echo',
  'Fig',
  'Hazel',
  'Indigo',
  'Jasper',
  'Koda',
  'Luna',
  'Mango',
  'Nico',
  'Olive',
  'Pip',
  'Rio',
  'Sasha',
  'Tundra',
  'Willow',
  'Yuki',
  'Zuri',
  'Basil',
  'Cocoa',
  'Dune',
  'Ember',
  'Flint',
];
const FEED_COST = 8;
const NAMES = [
  'Ava',
  'Ben',
  'Cleo',
  'Dev',
  'Elena',
  'Finn',
  'Grace',
  'Hiro',
  'Isla',
  'Jonah',
  'Kai',
  'Lena',
  'Marco',
  'Nia',
  'Omar',
  'Priya',
  'Quinn',
  'Rosa',
  'Sam',
  'Tara',
  'Uma',
  'Vic',
  'Wen',
  'Yara',
  'Zane',
  'Mateo',
  'Ivy',
  'Leo',
  'Maya',
  'Noah',
  'Ruby',
  'Theo',
  'June',
  'Arjun',
  'Hana',
  'Luis',
  'Mei',
  'Owen',
  'Sofia',
  'Eli',
];
const SHIRTS = [
  '#e4573d',
  '#3d86e4',
  '#f2c94c',
  '#9b59d0',
  '#2fb37f',
  '#f28c3b',
  '#e85d9e',
  '#ffffff',
  '#55c1d9',
  '#c4e05a',
];
const SKIN = ['#f1c9a5', '#d9a47a', '#b97a52', '#8d5a3b', '#5e3b26'];
