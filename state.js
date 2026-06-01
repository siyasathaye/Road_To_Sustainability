// ─── state.js ─────────────────────────────────────────────────────────────────
// Single source of truth shared across all scene scripts.
// Scene scripts READ from window.STATE and call window.onStateChange()
// whenever they need to react to a quiz update.
// ─────────────────────────────────────────────────────────────────────────────

window.STATE = {
  // quiz answers (set by scene1.js)
  tripCategory:  null,   // e.g. "Medium (50–200 km)"
  vehicleClass:  null,   // e.g. "SUV"
  priority:      null,   // "cost" | "emissions"

  // full dataset loaded once (set by scene1.js after CSV loads)
  allData: [],
};

// Subscribers: each scene registers a callback here.
// scene1.js calls notifyAll() after the user hits submit.
window._stateListeners = [];

window.onStateReady = function(fn) {
  window._stateListeners.push(fn);
};

window.notifyAll = function() {
  window._stateListeners.forEach(fn => {
    try { fn(window.STATE); } catch(e) { console.error(e); }
  });
};
