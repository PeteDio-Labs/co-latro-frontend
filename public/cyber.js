/* =====================================================================
   Co-latro — Cyber HUD shared interactivity for the design packs.
   Progressive enhancement: works via [data-*] hooks, no framework.
   - Shop shelf tabs:  [data-shelf-tab="roll|packs|voucher"] switch
                       [data-shelf="roll|packs|voucher"] panels.
   - Bottom sheet:     [data-open-sheet] opens, [data-close-sheet] closes,
                       clicking the .scrim closes too.
   - Joker popup:      tap a .jchip to toggle its popup (hover handles desktop).
   Scope everything to the document this script is loaded in (each pack /
   the iframe), so multiple packs in the viewer stay independent.
   ===================================================================== */
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    /* ---- Shop shelf tabs ------------------------------------------- */
    var tabs = document.querySelectorAll("[data-shelf-tab]");
    if (tabs.length) {
      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          var key = tab.getAttribute("data-shelf-tab");
          // toggle active styling on the sibling tabs
          var group = tab.parentElement;
          group.querySelectorAll("[data-shelf-tab]").forEach(function (t) {
            t.classList.toggle("on", t === tab);
          });
          // show the matching shelf, hide the rest (search the whole stage)
          var stage = tab.closest(".stage, .cyber, .dir2") || document;
          stage.querySelectorAll("[data-shelf]").forEach(function (panel) {
            panel.hidden = panel.getAttribute("data-shelf") !== key;
          });
        });
      });
    }

    /* ---- Bottom sheet --------------------------------------------- */
    function setSheet(stage, open) {
      var scrim = stage.querySelector(".scrim");
      var sheet = stage.querySelector(".sheet");
      if (scrim) scrim.hidden = !open;
      if (sheet) sheet.hidden = !open;
    }
    document.querySelectorAll("[data-open-sheet]").forEach(function (el) {
      el.addEventListener("click", function () {
        var stage = el.closest(".stage, .cyber, .dir2") || document;
        setSheet(stage, true);
      });
    });
    document.querySelectorAll("[data-close-sheet], .scrim").forEach(function (el) {
      el.addEventListener("click", function () {
        var stage = el.closest(".stage, .cyber, .dir2") || document;
        setSheet(stage, false);
      });
    });

    /* ---- Joker popup (tap toggles; CSS :hover covers desktop) ------ */
    var chips = document.querySelectorAll(".jchip:not(.empty)");
    chips.forEach(function (chip) {
      chip.addEventListener("click", function (e) {
        e.stopPropagation();
        var wasActive = chip.classList.contains("active");
        // close any other open popups first
        chips.forEach(function (c) { c.classList.remove("active"); });
        if (!wasActive) chip.classList.add("active");
      });
    });
    // tapping elsewhere closes joker popups
    document.addEventListener("click", function () {
      chips.forEach(function (c) { c.classList.remove("active"); });
    });
  });
})();
