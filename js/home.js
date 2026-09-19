/* ============================================================
   HOME — landing page behaviour
   cinematic opening (once per page load), scroll reveals,
   story trail animation, CTA wiring
   ============================================================ */
(() => {
  const Home = {};

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  let playedOnce = false;
  let timers = [];
  let cut = false;

  function clearTimers() {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }
  function after(ms, fn) {
    if (cut) return;
    timers.push(setTimeout(() => { if (!cut) fn(); }, ms));
  }

  /* ---------- opening sequence ---------- */
  async function playOpening() {
    const o = $("#opening");
    if (!o || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      o && o.remove();
      heroReveal();
      return;
    }

    const world = $(".o-world", o);
    const line1 = $(".o-line-1", o);
    const caption = $(".o-caption", o);
    const point = $(".o-point", o);
    const ring = $(".o-ring", o);
    const path = $(".o-path", o);
    const places = $$(".o-place", o);

    o.classList.add("playing");
    after(250, () => world.classList.add("on"));
    after(1150, () => line1.classList.add("on"));
    after(2450, () => point.classList.add("on"));
    after(2650, () => ring.classList.add("on"));
    after(4300, () => places[0] && places[0].classList.add("on"));
    after(5000, () => places[1] && places[1].classList.add("on"));
    after(5700, () => places[2] && places[2].classList.add("on"));
    after(6400, () => places[3] && places[3].classList.add("on"));

    /* traces: connect the places, reveal years, then fade text down */
    after(7200, () => {
      if (cut) return;
      path.classList.add("on");
      places.forEach((p) => p.classList.add("traced"));
    });
    after(7900, () => caption.classList.add("on"));
    after(10100, () => {
      o.classList.add("hide");
      after(950, () => o.remove());
      heroReveal();
    });

    /* guard against things going wrong */
    after(11500, () => { o.remove(); heroReveal(); });
  }

  function skipOpening() {
    cut = true;
    clearTimers();
    const o = $("#opening");
    if (o) { o.classList.remove("playing"); o.classList.add("hide"); after(100, () => o.remove()); }
    heroReveal();
  }

  function heroReveal() {
    const h = $(".home-hero");
    if (h) h.classList.add("on");
  }

  /* ---------- scroll reveals ---------- */
  let observer = null;
  function bindReveals() {
    const targets = $$(".home-view .ro");
    if (!window.IntersectionObserver) {
      targets.forEach((t) => t.classList.add("on"));
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("on");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    targets.forEach((t) => observer.observe(t));
  }

  /* college micro-timeline — runs when the card is revealed */
  function bindCollege() {
    const card = $(".place-college");
    if (!card || !window.IntersectionObserver) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            card.classList.add("revealing");
            io.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );
    io.observe(card);
  }

  /* story trail — animate the connecting line + nodes */
  function bindStory() {
    const wrap = $(".story-wrap");
    if (!wrap) return;
    const on = () => wrap.classList.add("story-on");
    if (!window.IntersectionObserver) { on(); return; }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { on(); io.disconnect(); }
        });
      },
      { threshold: 0.35 }
    );
    io.observe(wrap);
  }

  /* ---------- CTA wiring (data-goto = "explore" | "leave") ---------- */
  function bindCtas() {
    $$("[data-goto]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.goto;
        if (target === "leave") App.startLeave(null);
        else App.show("explore");
      });
    });
  }

  Home.init = () => {
    bindReveals();
    bindCollege();
    bindStory();
    bindCtas();
    /* smooth-scroll any in-page anchors */
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      e.preventDefault();
      const el = $(a.getAttribute("href"));
      const sc = $(".home-view");
      if (el && sc) sc.scrollTo({ top: el.offsetTop - 90, behavior: "smooth" });
    });
    if (!playedOnce) {
      playedOnce = true;
      const skip = $("#o-skip");
      if (skip) skip.addEventListener("click", skipOpening);
      playOpening();
    } else {
      heroReveal();
    }
  };

  window.Home = Home;
})();