/* Getting started: a checklist card for new zoos. Each step is checked against the zoo itself, so it
   ticks off however the player gets there; "Show me" opens the right tool. Hidden for good once
   finished or dismissed (S.tut: 'on', 'done' or 'off'; older zoos have none and never see it). */
const TUT_STEPS = [
  {
    txt: 'Build a recycling yard. Janitors work from it, and keepers need it too.',
    ok: () => F.cnt.recycle > 0,
    show: () => setTool('shop', 'recycle'),
  },
  {
    txt: 'Build a keeper lodge, so you can hire zookeepers to feed and clean.',
    ok: () => F.cnt.lodge > 0,
    show: () => setTool('shop', 'lodge'),
  },
  {
    txt: 'Hire a zookeeper from the hiring board in the Office.',
    ok: () => staffCount('keeper') > 0,
    show: () => $('#zooPanel').hidden && toggleZoo(),
  },
  {
    txt: 'Build a new habitat: drag out an area beside a path.',
    ok: () => S.encl.length >= 2,
    show: () => setTool('habitat'),
  },
  {
    txt: 'Put at least two animals of one species into your new habitat.',
    ok: () => S.encl.slice(1).some((e) => animalsIn(e.id).length >= 2),
    show: () => setTool('animal'),
  },
  {
    txt: 'Place a drink cart on the edge of a busy path.',
    ok: () => anchorsOf('drink').length > 0,
    show: () => setTool('shop', 'drink'),
  },
  {
    txt: 'Build a parking lot facing the road, so more guests can come by car.',
    ok: () => F.cnt.parking > 0,
    show: () => setTool('shop', 'parking'),
  },
  {
    txt: 'Press 3× to speed up time and watch your zoo come to life.',
    ok: () => speed === 3,
    show: () => setSpeed(3),
  },
];
let tutHTML = '';
function renderTutorial() {
  const box = $('#tut');
  if (!box) return;
  if (S.tut !== 'on') {
    box.hidden = true;
    return;
  }
  const done = TUT_STEPS.map((s) => {
    try {
      return !!s.ok();
    } catch (e) {
      return false;
    }
  });
  const cur = done.indexOf(false);
  if (cur < 0) {
    S.tut = 'done';
    box.hidden = true;
    toast('That’s the basics! Check the Office for zoo progress, awards and your next unlocks.', 'good');
    return;
  }
  const n = done.filter(Boolean).length;
  const h = `<div class="tutHead"><b>Getting started</b><span>${n} of ${TUT_STEPS.length}</span><button class="x" id="tutX" aria-label="Hide the guide">×</button></div>
    <div class="tutBar"><i style="width:${(n / TUT_STEPS.length) * 100}%"></i></div>
    <p>${TUT_STEPS[cur].txt}</p>
    <button class="btn small" id="tutGo">Show me</button>`;
  box.hidden = false;
  if (h === tutHTML) return; // unchanged: keep the buttons under the player's finger
  tutHTML = h;
  box.innerHTML = h;
  $('#tutX').onclick = () => {
    S.tut = 'off';
    box.hidden = true;
    toast('Guide hidden.');
  };
  $('#tutGo').onclick = () => TUT_STEPS[cur].show();
}
