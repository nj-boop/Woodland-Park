/* Getting started: a checklist card for new zoos. Each step is checked against the zoo itself, so it
   ticks off however the player gets there; "Show me" opens the right tool. Hidden for good once
   finished or dismissed (S.tut: 'on', 'done' or 'off'; older zoos have none and never see it). */
const newHabs = () => S.encl.slice(S.bare ? 0 : 1); // the test zoo starts with one of its own
const TUT_STEPS = [
  {
    bare: true,
    txt: 'Place your front gate. On the south edge it opens onto the highway; anywhere else, link it to parking with a footpath.',
    ok: () => F.cnt.entrance > 0,
    show: () => setTool('shop', 'entrance'),
  },
  {
    bare: true,
    txt: 'Lay a footpath leading into the zoo from the gate.',
    ok: () => nbr4(idx(GATE.x, GATE.y)).some((n) => n !== idx(GATE.ox, GATE.oy) && guestPath(n)),
    show: () => setTool('path'),
  },
  {
    bare: true,
    txt: 'Lay a road in from the highway on the south edge. Drag it out, then confirm. Trucks and staff buildings use it.',
    ok: () => F.roadLinked.size > 0,
    show: () => {
      pathSub = 'service';
      setTool('path');
    },
  },
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
    ok: () => newHabs().length >= 1,
    show: () => setTool('habitat'),
  },
  {
    txt: 'Build an animal house with its back on the new habitat’s fence, its door on a road. Keepers go in through it, and the animals sleep there.',
    ok: () => newHabs().some((e) => F.houseOf && F.houseOf[e.id]),
    show: () => setTool('shop', 'animalhouse'),
  },
  {
    txt: 'Put at least two animals of one species into your new habitat.',
    ok: () => newHabs().some((e) => animalsIn(e.id).length >= 2),
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
const tutSteps = () => TUT_STEPS.filter((s) => !s.bare || S.bare);
let tutHTML = '';
function renderTutorial() {
  const box = $('#tut');
  if (!box) return;
  if (S.tut !== 'on') {
    box.hidden = true;
    return;
  }
  const done = tutSteps().map((s) => {
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
  const h = `<div class="tutHead"><b>Getting started</b><span>${n} of ${tutSteps().length}</span><button class="x" id="tutX" aria-label="Hide the guide">×</button></div>
    <div class="tutBar"><i style="width:${(n / tutSteps().length) * 100}%"></i></div>
    <p>${tutSteps()[cur].txt}</p>
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
  $('#tutGo').onclick = () => tutSteps()[cur].show();
}
