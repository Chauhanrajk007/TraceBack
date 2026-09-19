/* ============================================================
   HOME — landing page behaviour
   short calm opening (once per page load), scroll reveals,
   college micro-timeline
   ============================================================ */
(() => {
  const Home = {};

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

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

  /* ---------- opening sequence (short) ---------- */
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
    const places = $$(".o-place", o);

    o.classList.add("playing");
    after(150, () => world.classList.add("on"));
    after(600, () => line1.classList.add("on"));
    after(1400, () => point.classList.add("on"));
    after(1500, () => ring.classList.add("on"));
    after(2300, () => places[0] && places[0].classList.add("on"));
    after(2650, () => places[1] && places[1].classList.add("on"));
    after(3000, () => places[2] && places[2].classList.add("on"));
    after(3350, () => places[3] && places[3].classList.add("on"));

    after(3800, () => {
      if (cut) return;
      places.forEach((p) => p.classList.add("traced"));
      caption.classList.add("on");
    });
    after(5000, () => {
      o.classList.add("hide");
      after(600, () => o.remove());
      heroReveal();
    });

    /* guard — never leave the overlay up */
    after(5800, () => { o.remove(); heroReveal(); });
  }

  function skipOpening() {
    cut = true;
    clearTimers();
    const o = $("#opening");
    if (o) o.remove();
    heroReveal();
  }

  function heroReveal() {
    const h = $(".home-hero");
    if (!h) return;
    h.classList.add("on");
    h.querySelectorAll(".ro").forEach((el) => el.classList.add("on"));
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
      { threshold: 0.15 }
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
      { threshold: 0.4 }
    );
    io.observe(card);
  }

  Home.init = () => {
    bindReveals();
    bindCollege();
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