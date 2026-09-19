/* Site-wide behaviour, loaded on every page. */
(function () {
  "use strict";

  // ── Real visible height ────────────────────────────────────────────────
  // dvh/svh assume the host browser tells WebKit how much space its own
  // chrome takes, and resizes the viewport accordingly. Safari does that.
  // Chrome-for-iOS (WKWebView under Apple's rules, but Google draws its own
  // toolbar outside it) often doesn't: dvh then reports the same number as
  // plain vh, and Chrome's floating bottom bar simply overlays on top of
  // whatever the page painted there, covering the last ~60px of the hero
  // regardless of which CSS viewport unit was used.
  //
  // visualViewport tracks the ACTUALLY visible rectangle at the WebKit
  // level, which every WKWebView-based browser keeps accurate (it is also
  // what the on-screen keyboard resizes), so it isn't subject to the same
  // per-browser-shell inconsistency. Kept as a CSS custom property rather
  // than only a one-time read, updated on resize/scroll of the visual
  // viewport, since the visible height also changes as chrome shows or
  // hides while scrolling.
  function setViewportHeight() {
    var h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--vvh", h + "px");
  }
  setViewportHeight();
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", setViewportHeight);
  } else {
    window.addEventListener("resize", setViewportHeight);
  }
  window.addEventListener("orientationchange", setViewportHeight);

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

  // ── Labels for third-party widgets ─────────────────────────────────────
  // Quarto's search widget and reactable's table are built after this script
  // runs and ship without accessible names, which is three of the four axe
  // violations on the site. Neither is ours to change at source, so they are
  // labelled here. Idempotent and cheap, because reactable rebuilds its DOM
  // on every page and filter change.
  function labelWidgets() {
    var q = document.querySelector(".aa-DetachedSearchButton:not([aria-label])");
    if (q) q.setAttribute("aria-label", "Cerca nel sito");
    // The wrapper carries role="combobox" and so needs a name of its own.
    var cb = document.querySelector(".aa-Autocomplete[role]:not([aria-label])");
    if (cb) cb.setAttribute("aria-label", "Cerca nel sito");
    var i = document.querySelector(".aa-Autocomplete input:not([aria-label]), " +
                                   ".aa-Form input:not([aria-label])");
    if (i) i.setAttribute("aria-label", "Cerca nel sito");
    // The expander column has no header text, so its <th> reads as empty.
    var th = document.querySelectorAll(".rt-th.header:not([aria-label])");
    for (var k = 0; k < th.length; k++) {
      if (!th[k].textContent.trim()) th[k].setAttribute("aria-label", "Apri la scheda");
    }
  }
  labelWidgets();
  if ("MutationObserver" in window) {
    new MutationObserver(labelWidgets)
      .observe(document.body, { childList: true, subtree: true });
  }

  // ── UT photo gallery ───────────────────────────────────────────────────
  // One overlay for the page, opened by delegation. R/functions_ut_form.R
  // used to emit a complete overlay, its inline styles, and a top-level
  // `let currentImages` declaration inside every expanded row, so opening a
  // second record produced duplicate element ids and a redeclaration
  // SyntaxError that killed the gallery outright. It now emits thumbnails
  // and nothing else. <dialog> brings focus trapping, Esc and the backdrop
  // with it, so none of that is reimplemented here.
  var lb = null, lbImg = null, lbCap = null, lbPrev = null, lbNext = null, lbClose = null;
  var shots = [], at = 0, swiped = false;

  // Stroked, not set in type, for the same reason as the theme toggle above:
  // the \u2039 \u203a \u00d7 characters sit at whatever height their font puts them,
  // which is never the optical centre of a 44px control, and they vary
  // between the webfont and its fallbacks. A path centres exactly.
  function chevron(d) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" ' +
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="' + d + '"/></svg>';
  }

  function buildLightbox() {
    lb = document.createElement("dialog");
    lb.className = "nacs-lightbox";
    // showModal() gives the dialog its role and its modal semantics, but not
    // a name: it was announced as an unlabelled dialog. The caption already
    // holds the current photo's description, so it is the name.
    lb.setAttribute("aria-labelledby", "nacs-lb-cap");
    lb.innerHTML =
      '<figure class="nacs-lightbox-fig">' +
      '<img alt="">' +
      '<figcaption class="nacs-lightbox-cap" id="nacs-lb-cap"></figcaption>' +
      "</figure>" +
      '<button type="button" class="nacs-lb-prev" aria-label="Foto precedente">' + chevron("M15 5l-7 7 7 7") + "</button>" +
      '<button type="button" class="nacs-lb-next" aria-label="Foto successiva">' + chevron("M9 5l7 7-7 7") + "</button>" +
      '<button type="button" class="nacs-lb-close" aria-label="Chiudi">' + chevron("M6 6l12 12M18 6L6 18") + "</button>";
    document.body.appendChild(lb);
    lbImg = lb.querySelector("img");
    lbCap = lb.querySelector("figcaption");
    lbPrev = lb.querySelector(".nacs-lb-prev");
    lbNext = lb.querySelector(".nacs-lb-next");
    lbClose = lb.querySelector(".nacs-lb-close");
    lbClose.addEventListener("click", function () { lb.close(); });
    lbPrev.addEventListener("click", function () { show(at - 1); });
    lbNext.addEventListener("click", function () { show(at + 1); });
    lb.addEventListener("click", function (e) {
      if (swiped) { swiped = false; return; }
      if (e.target === lb) lb.close();
    });
    // On the document rather than on the dialog. Reaching either end of the
    // set disables the arrow the reader has been pressing, and a focused
    // control that becomes disabled drops focus onto <html>: bound to the
    // dialog, the handler then stopped seeing keys at all, which is why the
    // left arrow died as soon as you had paged to the last photo.
    document.addEventListener("keydown", function (e) {
      if (!lb || !lb.open) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1); }
    });

    // Swipe. The overlay is one <img> whose src is swapped, not a scroller,
    // so there is no native gesture to inherit.
    var sx = 0, sy = 0;
    lb.addEventListener("touchstart", function (e) {
      sx = e.changedTouches[0].clientX;
      sy = e.changedTouches[0].clientY;
    }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      // Horizontal intent only: a mostly-vertical drag is a scroll or a
      // pinch recovery, not a request for the next photo.
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      swiped = true;
      show(dx < 0 ? at + 1 : at - 1);
    }, { passive: true });
  }

  function show(i) {
    if (i < 0 || i >= shots.length) return;
    at = i;
    lbImg.src = shots[i].src;
    lbImg.alt = shots[i].alt;
    // The alt already carries the position ("Fotografia 2 di 6, UT 1", see
    // R/functions_ut_form.R), so appending a counter printed it twice.
    lbCap.textContent = shots[i].alt;
    // Hand focus on before disabling, so the reader keeps a visible focus
    // ring and the dialog keeps focus. See the keydown comment above.
    var had = document.activeElement;
    lbPrev.disabled = i === 0;
    lbNext.disabled = i === shots.length - 1;
    if (had === lbPrev && lbPrev.disabled) (lbNext.disabled ? lbClose : lbNext).focus();
    if (had === lbNext && lbNext.disabled) (lbPrev.disabled ? lbClose : lbPrev).focus();
  }

  // Two callers, one overlay: a UT photo gallery (many thumbnails, one
  // sequence) and a single figure plate on paesaggio.qmd, where the point is
  // the 2400px version behind a page-width one. Quarto's own lightbox is not
  // an option here: it arrived in Quarto 1.4 and this site builds on 1.3, so
  // `lightbox:` in _quarto.yml has never done anything.
  function open(imgs, i) {
    shots = Array.prototype.map.call(imgs, function (img) {
      return { src: img.getAttribute("data-full") || img.src, alt: img.alt };
    });
    if (!lb) buildLightbox();
    // A single plate has nowhere to page to, so it gets no arrows rather
    // than two permanently disabled ones.
    lb.classList.toggle("is-single", shots.length === 1);
    show(i);
    if (typeof lb.showModal === "function") lb.showModal();
  }

  function trigger(target) {
    if (!target || !target.closest) return false;
    var thumb = target.closest(".ut-thumb");
    if (thumb) {
      var gallery = thumb.closest(".ut-thumbs");
      if (!gallery) return false;
      var thumbs = gallery.querySelectorAll(".ut-thumb");
      open(gallery.querySelectorAll(".ut-thumb img"),
           Array.prototype.indexOf.call(thumbs, thumb));
      return true;
    }
    var plate = target.closest(".plate-zoom");
    if (plate) { open(plate.querySelectorAll("img"), 0); return true; }
    return false;
  }

  document.addEventListener("click", function (e) { trigger(e.target); });

})();
