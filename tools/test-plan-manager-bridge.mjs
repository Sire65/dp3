import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../src/core/plan-manager-bridge.js', import.meta.url), 'utf8');

function berlinIso(date = new Date()) {
  const parts = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function addDays(iso, delta) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const today = berlinIso();
let published = null;
const K = {
  eventConfig: { eventId: 'KC-WM-2026', timezone: 'Europe/Berlin' },
  integrationConfig: { supabase: { projectId: 'KC_DP' } },
  shifts: [
    { id: 'B', personId: 'P2', layer: 'planned', date: today, start: 14, end: 18, area: 'Bereitschaft' },
    { id: 'A', personId: 'P1', layer: 'planned', date: today, start: 10, end: 13.5, area: 'Kasse' },
    { id: 'C', personId: 'P3', layer: 'planned', date: addDays(today, 31), start: 10, end: 12 },
    { id: 'D', personId: 'P4', layer: 'planned', date: today, start: 10, end: 12, status: 'cancelled' },
    { id: 'E', personId: 'P5', layer: 'wish', date: today, start: 10, end: 12 },
  ],
  personPlanningAllowed: () => true,
  supabaseConnection: {
    publishPlan: async (payload) => { published = payload; return { ok: true }; },
  },
};

const context = {
  window: { KCDP: K },
  Intl,
  Date,
  console,
  setTimeout,
  clearTimeout,
};
vm.createContext(context);
vm.runInContext(source, context);

const rows = context.window.KCDP.planManagerBridge.buildRows();
assert.equal(context.window.KCDP.planManagerBridge.version, '0.2.0');
assert.equal(context.window.KCDP.planManagerBridge.today(), today);
assert.deepEqual(rows.map((r) => r.sourceShiftId), ['A', 'B']);
assert.equal(rows[0].start, '10:00');
assert.equal(rows[0].end, '13:30');

await context.window.KCDP.planManagerBridge.publishNow();
assert.equal(published.eventId, 'KC-WM-2026');
assert.deepEqual(published.rows.map((r) => r.sourceShiftId), ['A', 'B']);

context.window.KCDP.shifts = [];
await context.window.KCDP.planManagerBridge.publishNow();
assert.deepEqual(published.rows, [], 'Ein leerer Sollplan muss als leerer Snapshot veröffentlicht werden.');

console.log('test-plan-manager-bridge: OK');
