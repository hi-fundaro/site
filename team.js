// Team grid: open a larger profile when a card is clicked. Lives outside React; the cards are plain buttons.
(function () {
  var modal, cards = [], idx = 0, lastFocus = null;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function render() {
    var c = cards[idx], d = c.dataset;
    modal.querySelector(".fd-modal__photo").innerHTML = '<img src="' + esc(d.img) + '" alt="' + esc(d.name) + '">';
    modal.querySelector(".fd-modal__name").textContent = d.name;
    modal.querySelector(".fd-modal__role").textContent = d.role;
    var bio = modal.querySelector(".fd-modal__bio"); bio.textContent = "";
    String(d.profile || d.bio).split(/\n\s*\n/).forEach(function (para, i) {
      var p = document.createElement("p"); p.textContent = para.trim(); if (i === 0 && d.profile) p.className = "fd-modal__lead"; bio.appendChild(p);
    });
    var li = modal.querySelector(".fd-modal__in");
    if (d.linkedin) { li.href = d.linkedin; li.hidden = false; } else { li.hidden = true; }
    modal.querySelector(".fd-modal__count").textContent = (idx + 1) + " / " + cards.length;
  }
  function build() {
    modal = document.createElement("div");
    modal.className = "fd-modal"; modal.hidden = true;
    modal.innerHTML = '<div class="fd-modal__backdrop" data-close></div>' +
      '<div class="fd-modal__panel" role="dialog" aria-modal="true" aria-labelledby="fd-modal-name">' +
      '<button class="fd-modal__close" type="button" aria-label="Close" data-close>&times;</button>' +
      '<div class="fd-modal__photo"></div>' +
      '<div class="fd-modal__text"><p class="fd-modal__role"></p><h3 class="fd-modal__name" id="fd-modal-name"></h3>' +
      '<div class="fd-modal__bio"></div><a class="fd-modal__in" target="_blank" rel="noopener noreferrer">LinkedIn &rarr;</a>' +
      '<div class="fd-modal__nav"><button type="button" class="fd-modal__prev" aria-label="Previous">&larr;</button>' +
      '<span class="fd-modal__count"></span><button type="button" class="fd-modal__next" aria-label="Next">&rarr;</button></div></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) close();
      else if (e.target.closest(".fd-modal__prev")) { idx = (idx + cards.length - 1) % cards.length; render(); }
      else if (e.target.closest(".fd-modal__next")) { idx = (idx + 1) % cards.length; render(); }
    });
  }
  function open(card) {
    cards = Array.prototype.slice.call(document.querySelectorAll("#fd-team .fd-member"));
    idx = Math.max(0, cards.indexOf(card));
    if (!modal) build();
    render(); lastFocus = card;
    modal.hidden = false; document.documentElement.classList.add("fd-modal-open");
    requestAnimationFrame(function () { modal.classList.add("is-open"); modal.querySelector(".fd-modal__close").focus(); });
  }
  function close() {
    if (!modal || modal.hidden) return;
    modal.classList.remove("is-open"); document.documentElement.classList.remove("fd-modal-open");
    setTimeout(function () { modal.hidden = true; }, 200);
    if (lastFocus) lastFocus.focus();
  }
  document.addEventListener("click", function (e) {
    var card = e.target.closest && e.target.closest("#fd-team .fd-member");
    if (card) open(card);
  });
  document.addEventListener("keydown", function (e) {
    if (!modal || modal.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") { idx = (idx + 1) % cards.length; render(); }
    if (e.key === "ArrowLeft") { idx = (idx + cards.length - 1) % cards.length; render(); }
  });
})();
