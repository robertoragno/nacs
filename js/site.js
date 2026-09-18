/* Site-wide behaviour, loaded on every page. */
(function () {
  "use strict";

  // Hide the "back to top" button once the footer scrolls into view: you
  // don't need to jump to the top when you're already looking at the bottom
  // of the page, and the button (fixed, bottom-right) otherwise sits on top
  // of whatever the footer puts in that corner.
  var btt = document.getElementById("quarto-back-to-top");
  var foot = document.querySelector("footer.footer");
  if (btt && foot && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        btt.classList.toggle("is-hidden-footer", e.isIntersecting);
      });
    }).observe(foot);
  }

  // Deep link from the map popup's "Vai alla scheda completa"
  // (js/nacs-map.js): ut.html?ut=47 or fields.html?ur=12 should land on that
  // record already open. The reactable table paginates and its expand state
  // lives only in its own React tree, so a URL alone can't point at a row:
  // filtering to an exact match and clicking the result is the only way in.
  //
  // Two things used to stop this working. setFilter was called once, as soon
  // as the Reactable global existed, which is earlier than the instance
  // registering itself, so the call silently did nothing and the one-shot
  // guard meant it was never retried. And the row match read
  // querySelector(".rt-td"), which returns the *expander* cell (two
  // zero-width spaces), never the identifier, so nothing ever matched.
  var DEEP_LINK_TARGETS = {
    ut: { tableId: "ut-select", column: "UT" },
    ur: { tableId: "fields-select", column: "UR" }
  };
  var params = new URLSearchParams(window.location.search);
  var key = Object.keys(DEEP_LINK_TARGETS).filter(function (k) { return params.has(k); })[0];
  if (key) {
    var value = params.get(key).trim();
    var cfg = DEEP_LINK_TARGETS[key];
    var deadline = Date.now() + 10000;

    (function poll() {
      var table = document.getElementById(cfg.tableId);
      if (table && typeof Reactable !== "undefined") {
        // Idempotent, so re-applying each tick costs nothing and covers the
        // window before the instance has registered.
        try { Reactable.setFilter(cfg.tableId, cfg.column, value); } catch (e) { /* not ready */ }

        // Each record is a .rt-tr-group holding the row and, once open, its
        // .rt-tr-details. reactable binds the expand handler to the
        // expandable *cell*, so clicking the row element itself does nothing.
        var groups = table.querySelectorAll(".rt-tbody .rt-tr-group");
        for (var i = 0; i < groups.length; i++) {
          var cells = groups[i].querySelectorAll(".rt-tr .rt-td");
          for (var j = 0; j < cells.length; j++) {
            if (cells[j].textContent.trim() === value) {
              if (!groups[i].querySelector(".rt-tr-details")) {
                var target = groups[i].querySelector(".rt-td-expandable");
                if (target) target.click();
              }
              groups[i].scrollIntoView({ block: "center" });
              return;
            }
          }
        }
      }
      if (Date.now() < deadline) setTimeout(poll, 150);
    })();
  }

  // ── Theme ──────────────────────────────────────────────────────────────
  // nacs.scss has always carried the full dark palette DESIGN.md specifies,
  // under :root[data-theme="dark"], but nothing ever set that attribute, so
  // roughly thirty lines of tokens were unreachable. Light stays the default
  // and the primary design target (a phone in a stubble field at midday);
  // this is the opt-in for the other scene the same file names, reading
  // chronology at a desk at night. Deliberately NOT prefers-color-scheme:
  // that would hand the decision to the OS and demote light to a fallback.
  var THEME_KEY = "nacs-theme";
  var root = document.documentElement;

  // Drawn rather than set in type: stroked at the same hairline weight as the
  // graticule ticks and the sheet rules, in currentColor, so the control reads
  // as part of the sheet furniture. The icon shows the theme you would switch
  // TO, which is why light mode displays the moon.
  var ICON_SUN =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" ' +
    'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" ' +
    'aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="4.2"/>' +
    '<path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2' +
    'M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/></svg>';
  var ICON_MOON =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" ' +
    'stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" ' +
    'aria-hidden="true" focusable="false">' +
    '<path d="M20.2 14.4A8.4 8.4 0 1 1 9.6 3.8a6.6 6.6 0 0 0 10.6 10.6z"/></svg>';

  function applyTheme(theme) {
    var dark = theme === "dark";
    if (dark) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    var btn = document.querySelector(".theme-toggle");
    if (btn) {
      // The icon is aria-hidden, so the button still needs a text name.
      btn.innerHTML = dark ? ICON_SUN : ICON_MOON;
      btn.setAttribute("aria-pressed", String(dark));
      btn.setAttribute("title", dark ? "Tema chiaro" : "Tema scuro");
      btn.setAttribute("aria-label",
        dark ? "Passa al tema chiaro" : "Passa al tema scuro");
    }
  }

  var stored = null;
  try { stored = localStorage.getItem(THEME_KEY); } catch (e) { /* private mode */ }
  applyTheme(stored === "dark" ? "dark" : "light");

  var tools = document.querySelector(".quarto-navbar-tools") ||
              document.querySelector(".navbar .navbar-nav.ms-auto") ||
              document.querySelector(".navbar-container");
  if (tools) {
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "theme-toggle";
    tools.appendChild(toggle);
    applyTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode */ }
    });
  }

  // ── UT photo gallery ───────────────────────────────────────────────────
  // One overlay for the page, opened by delegation. R/functions_ut_form.R
  // used to emit a complete overlay, its inline styles, and a top-level
  // `let currentImages` declaration inside every expanded row, so opening a
  // second record produced duplicate element ids and a redeclaration
  // SyntaxError that killed the gallery outright. It now emits thumbnails
  // and nothing else. <dialog> brings focus trapping, Esc and the backdrop
  // with it, so none of that is reimplemented here.
  var lb = null, lbImg = null, lbCap = null, lbPrev = null, lbNext = null;
  var shots = [], at = 0;

  function buildLightbox() {
    lb = document.createElement("dialog");
    lb.className = "nacs-lightbox";
    lb.innerHTML =
      '<figure class="nacs-lightbox-fig">' +
      '<img alt="">' +
      '<figcaption class="nacs-lightbox-cap"></figcaption>' +
      "</figure>" +
      '<button type="button" class="nacs-lb-prev" aria-label="Foto precedente">\u2039</button>' +
      '<button type="button" class="nacs-lb-next" aria-label="Foto successiva">\u203a</button>' +
      '<button type="button" class="nacs-lb-close" aria-label="Chiudi">\u00d7</button>';
    document.body.appendChild(lb);
    lbImg = lb.querySelector("img");
    lbCap = lb.querySelector("figcaption");
    lbPrev = lb.querySelector(".nacs-lb-prev");
    lbNext = lb.querySelector(".nacs-lb-next");
    lb.querySelector(".nacs-lb-close").addEventListener("click", function () { lb.close(); });
    lbPrev.addEventListener("click", function () { show(at - 1); });
    lbNext.addEventListener("click", function () { show(at + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1); }
    });
  }

  function show(i) {
    if (i < 0 || i >= shots.length) return;
    at = i;
    lbImg.src = shots[i].src;
    lbImg.alt = shots[i].alt;
    lbCap.textContent = shots[i].alt + "  (" + (i + 1) + " di " + shots.length + ")";
    lbPrev.disabled = i === 0;
    lbNext.disabled = i === shots.length - 1;
  }

  document.addEventListener("click", function (e) {
    var thumb = e.target.closest ? e.target.closest(".ut-thumb") : null;
    if (!thumb) return;
    var gallery = thumb.closest(".ut-thumbs");
    if (!gallery) return;
    shots = Array.prototype.map.call(gallery.querySelectorAll(".ut-thumb img"), function (img) {
      return { src: img.getAttribute("data-full") || img.src, alt: img.alt };
    });
    if (!lb) buildLightbox();
    show(Array.prototype.indexOf.call(gallery.querySelectorAll(".ut-thumb"), thumb));
    if (typeof lb.showModal === "function") lb.showModal();
  });
})();
