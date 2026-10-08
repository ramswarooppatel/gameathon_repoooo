// Events: day:start event:hit card:proposed card:decided state:changed log:appended game:over
const h = {};
export const bus = {
  on(e, f) { (h[e] ??= []).push(f); },
  emit(e, d) { (h[e] || []).forEach((f) => f(d)); },
};
