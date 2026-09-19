/* paesaggio.qmd — binds the schematic section to the four unit sheets.
 *
 * The section is sticky; the four sheets scroll under it. Whichever sheet is
 * crossing the middle of the viewport is the active unit, and its band in the
 * section lights up while the other three recede. Hovering or focusing a band
 * previews that unit without losing the scroll-derived one; activating it
 * scrolls to the sheet.
 *
 * Everything here is enhancement. With JavaScript off the section is a
 * complete, readable figure and the four sheets are four ordinary sheets.
 */
(function () {
  "use strict";

  var fig = document.querySelector(".section-figure");
  if (!fig) return;

  var scroller = fig.querySelector(".up-section-scroller");
  var caption = document.getElementById("up-caption");
  var idle = caption ? caption.getAttribute("data-idle") : "";

  var bands = {};
  var sheets = {};
  var labels = {};

  Array.prototype.forEach.call(fig.querySelectorAll(".up-band"), function (b) {
    bands[b.getAttribute("data-up")] = b;
  });
  Array.prototype.forEach.call(
    document.querySelectorAll("[data-up-sheet]"),
    function (s) {
      var n = s.getAttribute("data-up-sheet");
      sheets[n] = s;
      // One source of truth for the label: the sheet's own header.
      var parts = ["UP " + n];
      [".sheet-title", ".sheet-meta"].forEach(function (sel) {
        var el = s.querySelector(sel);
        if (el) parts.push(el.textContent.trim());
      });
      labels[n] = parts.join(" · ");
    }
  );

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  // A sheet scrolled to the top of the viewport lands *behind* the sticky
  // figure, so its header is never the first thing the reader sees. The
  // figure's height depends on the viewport, the caption's line count and
  // the font, so it is measured rather than guessed, and re-measured on
  // resize. --nav-h is already in the stylesheet; only the figure is new.
  function measure() {
    document.documentElement.style.setProperty(
      "--up-sticky",
      Math.round(fig.getBoundingClientRect().height +
                 parseFloat(getComputedStyle(fig).top || 0) + 18) + "px"
    );
  }
  var pending = 0;
  function remeasure() {
    if (pending) return;
    pending = requestAnimationFrame(function () { pending = 0; measure(); });
  }
  measure();
  if ("ResizeObserver" in window) new ResizeObserver(remeasure).observe(fig);
  else window.addEventListener("resize", remeasure);
  var scrollActive = null;   // set by the observer
  var current = null;        // what is actually shown (may be a hover preview)

  function show(n) {
    if (n === current) return;
    current = n;
    fig.classList.toggle("has-active", n !== null);
    Object.keys(bands).forEach(function (k) {
      bands[k].classList.toggle("is-active", k === n);
    });
    Object.keys(sheets).forEach(function (k) {
      sheets[k].classList.toggle("is-active", k === n);
    });
    if (caption) caption.textContent = n === null ? idle : labels[n];
    if (n !== null) centre(n);
  }

  // Below ~620px the section is wider than its scroller and gets panned
  // rather than shrunk, so the active band has to be brought into view.
  function centre(n) {
    if (!scroller) return;
    var slack = scroller.scrollWidth - scroller.clientWidth;
    if (slack <= 1) return;
    var hit = fig.querySelector('[data-hit="' + n + '"]');
    if (!hit) return;
    var mid = (parseFloat(hit.getAttribute("x")) +
               parseFloat(hit.getAttribute("width")) / 2) / 1000;
    var left = Math.max(0, Math.min(slack, mid * scroller.scrollWidth - scroller.clientWidth / 2));
    scroller.scrollTo({ left: left, behavior: reduced.matches ? "auto" : "smooth" });
  }

  // ── Scroll position drives the active unit ──────────────────────────────
  // A 45/45 inset makes the observer fire on the band crossing the middle of
  // the viewport, which is the sheet the reader is actually looking at, not
  // the one that has merely appeared at the bottom edge.
  if ("IntersectionObserver" in window) {
    var visible = Object.create(null);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var n = e.target.getAttribute("data-up-sheet");
        if (e.isIntersecting) visible[n] = true;
        else delete visible[n];
      });
      var keys = Object.keys(visible).sort();
      scrollActive = keys.length ? keys[0] : null;
      show(scrollActive);
    }, { rootMargin: "-45% 0px -45% 0px" });
    Object.keys(sheets).forEach(function (k) { io.observe(sheets[k]); });
  }

  // ── Pointer and keyboard on the section itself ──────────────────────────
  Array.prototype.forEach.call(fig.querySelectorAll("[data-hit]"), function (hit) {
    var n = hit.getAttribute("data-hit");

    hit.addEventListener("mouseenter", function () { show(n); });
    hit.addEventListener("focus", function () { show(n); });
    hit.addEventListener("mouseleave", function () { show(scrollActive); });
    hit.addEventListener("blur", function () { show(scrollActive); });

    function go() {
      sheets[n].scrollIntoView({
        behavior: reduced.matches ? "auto" : "smooth",
        block: "start"
      });
    }
    // Below ~620px the drawing is panned by dragging it, and the bands cover
    // the whole drawing: without this, a drag that starts on a band ends in a
    // click and throws the reader down the page. Only a tap that stayed put
    // counts as a tap.
    var px = 0, py = 0, moved = false;
    hit.addEventListener("pointerdown", function (e) {
      px = e.clientX; py = e.clientY; moved = false;
    });
    hit.addEventListener("pointermove", function (e) {
      if (Math.abs(e.clientX - px) > 10 || Math.abs(e.clientY - py) > 10) moved = true;
    });
    hit.addEventListener("click", function () { if (!moved) go(); });
    hit.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        go();
      }
    });
  });
})();
