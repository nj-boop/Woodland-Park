/* Research: projects paid for up front that take some months, then improve the zoo for good.
   One project runs at a time. S.res = { id, t } is the one in progress (t = ticks done), and
   S.done lists finished ones. Other code asks researched('vet') etc. */
const RESEARCH = {
  feed: { name: 'Better diets', cost: 15000, months: 2, does: 'Animals get hungry 25% more slowly.' },
  market: { name: 'Marketing campaign', cost: 20000, months: 2, does: '15% more visitors.' },
  logistics: {
    name: 'Supply contracts',
    cost: 15000,
    months: 2,
    does: 'Deliveries and shop restocking cost 20% less.',
  },
  enrich: {
    name: 'Enrichment programme',
    cost: 20000,
    months: 3,
    does: 'Favourite toys make animals happier, and a missing one bothers them less.',
  },
  vet: { name: 'Veterinary science', cost: 25000, months: 3, does: 'Animals fall sick 40% less often.' },
  fences: {
    name: 'Fence engineering',
    cost: 25000,
    months: 3,
    does: 'Every fence holds as if it were one grade stronger.',
  },
  breed: { name: 'Breeding programme', cost: 30000, months: 4, does: 'Happy pairs have babies more often.' },
  revival: {
    name: 'Ice Age revival',
    cost: 120000,
    months: 6,
    does: 'Brings back woolly mammoths and sabre-toothed cats for world-class zoos.',
  },
};
const researched = (id) => !!(S.done && S.done.includes(id));
function startResearch(id) {
  const r = RESEARCH[id];
  if (!r || S.res || researched(id)) return false;
  if (!spend(r.cost, r.name.toLowerCase())) return false;
  S.today.run += r.cost;
  S.res = { id, t: 0 };
  return true;
}
function cancelResearch() {
  S.res = null; // the money is spent: research doesn't refund
}
const researchShare = () => (S.res ? Math.min(1, S.res.t / (RESEARCH[S.res.id].months * DAY)) : 0);
function tickResearch() {
  if (!S.res) return;
  S.res.t++;
  if (researchShare() >= 1) {
    const r = RESEARCH[S.res.id];
    (S.done ||= []).push(S.res.id);
    S.res = null;
    toast(`Research complete: ${r.name}. ${r.does}`, 'good');
  }
}
