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

  // Deep link from the map popup's "Vai alla scheda completa" (js/nacs-map.js):
  // ut.html?ut=47 or fields.html?ur=12 should land on that record already
  // open. The reactable table paginates and its expand state lives only in
  // its own React tree, so a URL alone can't point at a row — filtering to
  // an exact match and clicking the resulting row is the only way in.
  var DEEP_LINK_TARGETS = {
    ut: { tableId: "ut-select", column: "UT" },
    ur: { tableId: "fields-select", column: "UR" }
  };
  var params = new URLSearchParams(window.location.search);
  var key = Object.keys(DEEP_LINK_TARGETS).filter(function (k) { return params.has(k); })[0];
  if (key) {
    var value = params.get(key);
    var cfg = DEEP_LINK_TARGETS[key];
    var deadline = Date.now() + 6000;
    var filtered = false;
    (function poll() {
      var table = document.getElementById(cfg.tableId);
      if (table && typeof Reactable !== "undefined") {
        if (!filtered) {
          Reactable.setFilter(cfg.tableId, cfg.column, value);
          filtered = true;
        }
        var rows = table.querySelectorAll(".rt-tr");
        for (var i = 0; i < rows.length; i++) {
          var cell = rows[i].querySelector(".rt-td");
          if (cell && cell.textContent.trim() === value) {
            rows[i].scrollIntoView({ block: "center" });
            rows[i].click();
            return;
          }
        }
      }
      if (Date.now() < deadline) setTimeout(poll, 150);
    })();
  }
})();
