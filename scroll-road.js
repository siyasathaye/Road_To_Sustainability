// ─── scroll-road.js ──────────────────────────────────────────────────────────
// Scrollytelling road animation.
// Drop this script at the bottom of <body>, after your other scripts.
// Requires scroll-road.css to be linked in <head>.
//
// What it does:
//   1. Injects a fixed road strip on the left edge
//   2. Animates lane dashes on that strip relative to scroll position
//   3. Animates the existing .road-lane dividers between scenes (horizontal dash scroll)
//   4. Shows a scroll-progress bar at the top
//   5. Fades/slides .scene-inner elements in as they enter the viewport
//   6. Shows a "Scene N" label on the strip that updates as you scroll
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  "use strict";
  function typeText(el, text, speed = 35) {
    el.textContent = "";
    let i = 0;
  
    function step() {
      if (i < text.length) {
        el.textContent += text[i];
        i++;
        setTimeout(step, speed);
      }
    }
  
    step();
  }

  // ── 1. Build the fixed road strip (left) ──────────────────────────────────
  const strip = document.createElement("div");
  strip.id = "road-strip";
  strip.innerHTML = `
    <div class="reflector-left"></div>
    <div class="reflector-right"></div>
    <div class="lane-dashes" id="road-dashes"></div>
  `;
  document.body.prepend(strip);

  // ── 1b. Build the fixed road strip (right) ─────────────────────────────────
  const stripRight = document.createElement("div");
  stripRight.id = "road-strip-right";
  stripRight.innerHTML = `
    <div class="reflector-left"></div>
    <div class="reflector-right"></div>
    <div class="lane-dashes" id="road-dashes-right"></div>
  `;
  document.body.appendChild(stripRight);

  // ── 2. Build scroll progress bar ──────────────────────────────────────────
  const progressBar = document.createElement("div");
  progressBar.id = "scroll-progress";
  progressBar.innerHTML = `<div id="scroll-progress-fill"></div>`;
  document.body.prepend(progressBar);
  const progressFill = document.getElementById("scroll-progress-fill");

  // ── 3. Scene label on the strip ───────────────────────────────────────────
  const sceneLabel = document.createElement("div");
  sceneLabel.id = "road-scene-label";
  sceneLabel.textContent = "Scene\n1";
  document.body.appendChild(sceneLabel);

  const sceneLabelRight = document.createElement("div");
  sceneLabelRight.id = "road-scene-label-right";
  sceneLabelRight.textContent = "Scene\n1";
  document.body.appendChild(sceneLabelRight);


  // ── 5. Mark .scene-inner elements for entrance animation ──────────────────
  // We give them the "offscreen" class initially; IntersectionObserver removes it.
  const sceneInners = document.querySelectorAll(".scene-inner");
  sceneInners.forEach((el) => {
    // Only hide those not yet in view on initial load
    const rect = el.getBoundingClientRect();
    if (rect.top > window.innerHeight * 0.85) {
      el.classList.add("scene-offscreen");
    } else {
      el.classList.add("scene-visible");
    }
  });


  const entranceObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
  
          el.classList.remove("scene-offscreen");
          el.classList.add("scene-visible");
  
          // ── TYPEWRITER TRIGGER ─────────────────────────────
          const typeEl = el.querySelector(".typewriter");
  
          if (typeEl && typeEl.dataset.text && !typeEl.dataset.typed) {
            typeEl.dataset.typed = "true"; // prevents retyping on scroll
            typeText(typeEl, typeEl.dataset.text, 30);
          }
        }
      });
    },
    { threshold: 0.12 }
  );
  sceneInners.forEach((el) => entranceObserver.observe(el));


  // ── 6. Scene tracker for strip label ──────────────────────────────────────
  const scenes = document.querySelectorAll(".scene[id]");
  const sceneNames = {};
  scenes.forEach((s) => {
    // Try to read the scene-tag text, fall back to id
    const tag = s.querySelector(".scene-tag");
    sceneNames[s.id] = tag ? tag.textContent.trim() : s.id;
  });

  let currentSceneId = scenes[0] ? scenes[0].id : null;

  const sceneObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          currentSceneId = entry.target.id;
          const name = sceneNames[currentSceneId] || currentSceneId;
          // Show just "Scene N" — split on ·
          const short = name.split("·")[0].trim();
          sceneLabel.textContent = short;
          sceneLabelRight.textContent = short;
        }
      });
    },
    { threshold: 0.4 }
  );
  scenes.forEach((s) => sceneObserver.observe(s));

  // ── 7. Speed particles on the strip ───────────────────────────────────────
  const PARTICLE_COUNT = 6;
  const particles = [];
  const particlesRight = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement("div");
    p.className = "road-particle";
    resetParticle(p, true);
    strip.appendChild(p);
    particles.push(p);

    const pr = document.createElement("div");
    pr.className = "road-particle";
    resetParticle(pr, true);
    stripRight.appendChild(pr);
    particlesRight.push(pr);
  }

  function resetParticle(p, randomStart) {
    const length = 6 + Math.random() * 18;
    const startY = randomStart ? Math.random() * window.innerHeight : -length;
    p.style.cssText = `
      top: ${startY}px;
      height: ${length}px;
      opacity: ${0.2 + Math.random() * 0.5};
      transform: translateX(-50%);
    `;
    p._speed = 1.5 + Math.random() * 3;
    p._y = startY;
  }

  // ── 8. Main rAF scroll loop ────────────────────────────────────────────────
  const dashes = document.getElementById("road-dashes");
  const dashesRight = document.getElementById("road-dashes-right");
  const DASH_REPEAT = 80; // px per dash cycle (28px dash + 24px gap)
  let lastScrollY = window.scrollY;
  let ticking = false;
  let scrollVelocity = 0;
  let dashCurrent = 0;
  let dashTarget = 0;

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  function update() {
    ticking = false;

    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scro