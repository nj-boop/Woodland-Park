/* Staff UI: the office's staff list and hiring board, the staff inspector (pay, morale, keeper assignments),
   and the keeper line in the habitat inspector. */

const ROLE_ICON = {
  hauler: '<path d="M4 9l8-4 8 4v9l-8 4-8-4z"/><path d="M4 9l8 4 8-4M12 13v9"/>',
  keeper:
    '<path d="M4 11c0-4 3.6-7 8-7s8 3 8 7"/><path d="M2 11h20"/><circle cx="12" cy="15" r="3"/><path d="M7 21c1-2.5 2.8-3.5 5-3.5s4 1 5 3.5"/>',
  vet: '<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M12 9v8M8 13h8"/>',
  janitor: '<path d="M14 3l-4 11"/><path d="M6 14h8l2 7H4z"/><path d="M8 17v4M11 17v4"/>',
};
const roleIcon = (r) =>
  `<svg class="ri" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ROLE_ICON[r]}</svg>`;
const skillStars = (n) =>
  `<span class="stars-s" aria-label="Skill ${n} of 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;

function roomLine() {
  return ['keeper', 'janitor', 'vet', 'hauler']
    .map((r) => {
      const room = staffRoom(r),
        n = staffCount(r);
      return `<span class="room${room ? '' : ' none'}" title="${room ? '' : capHint(r)}">${roleIcon(r)} ${STAFF_ROLES[r].pl} <b>${n}/${room}</b></span>`;
    })
    .join('');
}
function staffPanelHTML() {
  const wages = S.staff.reduce((t, s) => t + s.wage, 0);
  const mine = S.staff.length
    ? S.staff
        .map(
          (s) => `<button class="srow" data-staff="${s.id}">
        ${roleIcon(s.role)}<span class="sn"><b>${s.name}</b><small>${staffDoing(s)}</small></span>
        <span class="sm">${skillStars(s.skill)}${meter(s.morale)}</span><span class="sw2">${money(s.wage)}</span></button>`
        )
        .join('')
    : '<p class="help">Nobody on staff yet. Hire from the board below once you have the buildings they work from.</p>';
  const board = (S.cands || [])
    .map((c) => {
      const full = staffCount(c.role) >= staffRoom(c.role),
        T2 = STAFF_TRAITS[c.trait];
      return `<div class="cand">${roleIcon(c.role)}<span class="sn"><b>${c.name}</b><small>${STAFF_ROLES[c.role].name} · ${T2.name}</small><small class="tip">${T2.tip}</small></span>
        <span class="sm">${skillStars(c.skill)}<small>${money(c.wage)}/mo</small></span>
        <button class="btn small${full ? '' : ' primary'}" data-hire="${c.id}" ${full ? `disabled title="${capHint(c.role)}"` : ''}>Hire</button></div>`;
    })
    .join('');
  return `<h3>Staff</h3><div class="rooms">${roomLine()}</div>
    <div class="slist">${mine}</div>
    ${S.staff.length ? `<p class="help">Wages: ${money(wages)} a month. Tap someone to see how they're doing.</p>` : ''}
    <h3 style="margin-top:14px">Hiring board</h3>
    <p class="help" style="margin-top:0">New applicants arrive every month. Skilled staff work faster but ask for more. Staff who feel underpaid or overworked lose morale and may quit.</p>
    <div class="slist">${board || '<p class="help">No applicants right now.</p>'}</div>`;
}
let staffSig = '';
function staffSignature() {
  return (
    S.staff.map((s) => [s.id, s.st, s.job && s.job.id, Math.round(s.morale / 5), s.wage, s.skill].join('.')).join('|') +
    '#' +
    (S.cands || []).map((c) => c.id).join(',') +
    '#' +
    ['keeper', 'janitor', 'vet', 'hauler'].map(staffRoom).join(',')
  );
}
function refreshStaffPanel() {
  const sig = staffSignature();
  if (sig === staffSig) return;
  staffSig = sig;
  const box = $('#zStaff');
  if (box) box.innerHTML = staffPanelHTML();
}
function bindStaffPanel() {
  staffSig = staffSignature();
  $('#zStaff').onclick = (ev) => {
    const h = ev.target.closest('[data-hire]'),
      r = ev.target.closest('[data-staff]');
    if (h) {
      if (hire(+h.dataset.hire)) {
        staffSig = '';
        refreshStaffPanel();
      }
    } else if (r) {
      const st = S.staff.find((s) => s.id === +r.dataset.staff);
      if (!st) return;
      sel = { type: 'staff', id: st.id };
      CAM.tx = st.x;
      CAM.tz = st.y;
      clampCam();
      renderInspector();
    }
  };
}

let fireArm = null;
function renderStaffInspector(box, st) {
  const R = STAFF_ROLES[st.role],
    T2 = STAFF_TRAITS[st.trait],
    fair = fairWage(st.role, st.skill),
    months = S.day - st.hired;
  const assign =
    st.role === 'keeper'
      ? `<h3 style="margin:12px 0 4px">Habitats</h3>
      <p class="help" style="margin:0 0 6px">${st.assign.length ? 'Only looks after the habitats ticked here.' : 'Looks after every habitat. Tick some to give them a beat.'}</p>
      <div class="names">${
        S.encl
          .map(
            (e) =>
              `<button class="nm${st.assign.includes(e.id) ? ' on' : ''}" data-as="${e.id}" aria-pressed="${st.assign.includes(e.id)}">${BIOMES[e.biome].name} #${e.id}</button>`
          )
          .join('') || '<span class="help">No habitats yet.</span>'
      }</div>`
      : '';
  box.innerHTML = `<button class="x" aria-label="Close" id="ix">×</button>
    <h2>${roleIcon(st.role)} ${st.name}</h2>
    <div class="sub">${R.name} · ${months < 1 ? 'started this month' : months + ' month' + (months > 1 ? 's' : '') + ' on staff'}</div>
    <div class="thought">${staffDoing(st)}. ${staffMoodText(st)}</div>
    <div class="need"><span>Morale</span>${meter(st.morale)}<span>Energy</span>${meter(st.energy)}<span>Next skill</span>${meter(st.skill >= 5 ? 100 : (st.xp / xpToNext(st)) * 100, 'var(--brass)')}</div>
    <div class="kv"><span>Skill</span><span>${skillStars(st.skill)}</span><span>Trait</span><span>${T2.name}<br><small class="help">${T2.tip}</small></span>
      <span>Wage</span><span>${money(st.wage)} a month${st.wage < fair * 0.96 ? ` <small style="color:var(--bad)">(fair: ${money(fair)})</small>` : ''}</span>
      <span>Job</span><span>${R.does}</span></div>
    ${assign}
    <div class="btns"><button class="btn primary" id="sRaise" ${st.raised === S.day ? 'disabled' : ''}>Give a 10% raise</button><button class="btn danger" id="sFire">${fireArm === st.id ? `Tap again · ${money(st.wage / 2)} severance` : 'Let go'}</button></div>`;
  $('#sRaise').onclick = () => {
    giveRaise(st.id);
    renderInspector();
  };
  $('#sFire').onclick = () => {
    if (fireArm === st.id) {
      fireArm = null;
      fire(st.id);
    } else {
      fireArm = st.id;
      renderInspector();
    }
  };
  box.querySelectorAll('[data-as]').forEach(
    (b) =>
      (b.onclick = () => {
        const id = +b.dataset.as;
        st.assign = st.assign.includes(id) ? st.assign.filter((k) => k !== id) : [...st.assign, id];
        renderInspector();
      })
  );
}
// habitat inspector: who is looking after this habitat
function keeperLine(e) {
  const ks = staffOf('keeper');
  if (!ks.length) return '';
  const mine = ks.filter((k) => servesHabitat(k, e));
  if (!mine.length)
    return `<div class="thought" style="border-color:var(--warn)">No keeper covers this habitat. Open a keeper and tick it.</div>`;
  const here = mine.filter((k) => k.job && k.job.kind === 'tend' && k.job.id === e.id);
  return `<p class="help" style="margin:6px 0 0">Keepers: ${mine.map((k) => k.name.split(' ')[0]).join(', ')}${here.length ? ` · ${here[0].name.split(' ')[0]} is ${here[0].st === 'work' ? 'working here now' : 'on the way'}` : ''}</p>`;
}
