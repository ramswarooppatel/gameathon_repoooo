// Black Box: append-only SHA-256 hash chain. hash = SHA-256(prevHash + canonicalJSON(entry sans hash)).
export const GENESIS = '0'.repeat(64);

const canon = (o) => JSON.stringify(o, Object.keys(o).sort());
// jsonb reorders keys, so hash a key-sorted copy of nested values.
const stable = (v) => (v && typeof v === 'object' ? (Array.isArray(v) ? v.map(stable) : Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]))) : v);
async function sha(s) {
  const b = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const hashOf = (prev, e) => sha(prev + canon({ n: e.n, day: e.day, agent: e.agent, cardId: e.cardId, decision: JSON.stringify(stable(e.decision)), why: e.why }));

export function createLedger(storageKey = null, initial = null) {
  const ls = storageKey && globalThis.localStorage;
  let entries = initial ?? (ls ? JSON.parse(ls.getItem(storageKey) || '[]') : []);
  const save = () => ls && ls.setItem(storageKey, JSON.stringify(entries));
  return {
    get entries() { return entries; },
    async append({ day, agent, cardId, decision, why }) {
      const prevHash = entries.length ? entries[entries.length - 1].hash : GENESIS;
      const e = { n: entries.length + 1, day, agent, cardId, decision, why, prevHash };
      e.hash = await hashOf(prevHash, e);
      entries.push(e); save();
      return e;
    },
    // Returns 0 if intact, else the 1-based index of the first broken entry.
    async verify() {
      let prev = GENESIS;
      for (const e of entries) {
        if (e.prevHash !== prev || e.hash !== (await hashOf(prev, e))) return e.n;
        prev = e.hash;
      }
      return 0;
    },
    clear() { entries = []; save(); },
    export: () => JSON.stringify(entries, null, 2),
  };
}
// Merkle seals (every 10 entries) and ECDSA signing: see TODO P2.M4 / P3.M3.
