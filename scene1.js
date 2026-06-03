// ─── scene1.js ────────────────────────────────────────────────────────────────
// Owns: quiz interaction, CSV load, D3 data join, notifyAll() on submit.
// ─────────────────────────────────────────────────────────────────────────────

(function () {

  // ── Load CSV once, store globally ─────────────────────────────────────────
  d3.csv("data/cars_fuel_efficiency_clean.csv", d3.autoType).then((raw) => {
    raw.forEach((d) => {
      d.actual_mileage_kmpl = +d.actual_mileage_kmpl;
      d.co2_per_km          = +d.co2_per_km;
      d.cost_per_km_usd     = +d.cost_per_km_usd;
    });

    window.STATE.allData = raw;
    window.notifyAll();

    initQuiz();
    revealSignsSequentially();
  });

  // ── Quiz interaction ───────────────────────────────────────────────────────
  function initQuiz() {
    const submitBtn = document.getElementById("quiz-submit");
    const errorEl  = document.getElementById("quiz-error");
    const allBtns  = document.querySelectorAll(".sign-btn");

    allBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.key;
        const val = btn.dataset.val;

        // deselect siblings in same group
        document.querySelectorAll(`.sign-btn[data-key="${key}"]`)
          .forEach(b => b.classList.remove("selected"));

        btn.classList.add("selected");
        window.STATE[key] = val;
        window.notifyAll();

        // Enable submit once all three answered
        if (window.STATE.tripCategory && window.STATE.vehicleClass && window.STATE.priority) {
          submitBtn.style.opacity       = "1";
          submitBtn.style.pointerEvents = "auto";
          submitBtn.removeAttribute("aria-disabled");
          errorEl.hidden = true;
        }
      });
    });

    submitBtn.addEventListener("click", onSubmit);
  }

  function onSubmit() {
    const { tripCategory, vehicleClass, priority } = window.STATE;

    if (!tripCategory || !vehicleClass || !priority) {
      document.getElementById("quiz-error").hidden = false;
      return;
    }

    // ── D3 data join: filter dataset to user's choices ─────────────────────
    window.STATE.filtered = window.STATE.allData.filter((d) => {
      const tripMatch  = matchTrip(d.trip_category, tripCategory);
      const classMatch = d.vehicle_type === vehicleClass;
      return tripMatch && classMatch;
    });

    // Aggregated stats per car for Scene 5
    window.STATE.byCarAll      = aggregateByCar(window.STATE.allData, priority);
    window.STATE.byCarFiltered = aggregateByCar(window.STATE.filtered, priority);

    // Update downstream labels
    const label = document.getElementById("s2-highlight-label");
    if (label) label.textContent = `Your pick: ${vehicleClass} — highlighted in orange.`;
    const s4label = document.getElementById("s4-highlight-label");
    if (s4label) s4label.textContent = vehicleClass + " ★";

    window.notifyAll();

    // Scroll to scene 2
    document.getElementById("scene-2").scrollIntoView({ behavior: "smooth" });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function matchTrip(csvVal, uiVal) {
    if (!csvVal || !uiVal) return true;
    return csvVal.toLowerCase().includes(uiVal.split(" ")[0].toLowerCase()) ||
           uiVal.toLowerCase().includes(csvVal.split(" ")[0].toLowerCase());
  }

  function aggregateByCar(data, priority) {
    const rolled = d3.rollups(
      data,
      (v) => ({
        car_name:        v[0].car_name,
        vehicle_type:    v[0].vehicle_type,
        fuel_type:       v[0].fuel_type,
        efficiency_band: d3.mode(v.map(d => d.efficiency_band)),
        avg_co2:         d3.mean(v, d => d.co2_per_km),
        avg_cost:        d3.mean(v, d => d.cost_per_km_usd),
        avg_mileage:     d3.mean(v, d => d.actual_mileage_kmpl),
        n:               v.length,
      }),
      (d) => d.car_name
    );

    const arr = rolled.map(([, v]) => v);

    arr.sort((a, b) =>
      priority === "emissions" ? a.avg_co2  - b.avg_co2  :
      priority === "cost"      ? a.avg_cost - b.avg_cost  :
                                 b.avg_mileage - a.avg_mileage
    );

    return arr;
  }

  // ── Stagger sign reveal on load ────────────────────────────────────────────
  function revealSignsSequentially() {
    const signs = document.querySelectorAll(".question-sign");
    signs.forEach((sign, i) => {
      setTimeout(() => sign.classList.add("visible"), 300 + i * 320);
    });
  }

  // ── Reset (called from restart link in Scene 5) ────────────────────────────
  window.resetQuiz = function () {
    window.STATE.tripCategory  = null;
    window.STATE.vehicleClass  = null;
    window.STATE.priority      = null;
    window.STATE.filtered      = null;

    const submitBtn = document.getElementById("quiz-submit");
    submitBtn.style.opacity       = "0.38";
    submitBtn.style.pointerEvents = "none";
    submitBtn.setAttribute("aria-disabled", "true");

    document.querySelectorAll(".sign-btn").forEach(b => b.classList.remove("selected"));
    document.getElementById("quiz-error").hidden      = true;
    document.getElementById("rec-cards").innerHTML    = "";
    document.getElementById("scene-5-bars").innerHTML = "";
  };

})();