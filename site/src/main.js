// Menu do celular e borda do cabeçalho ao rolar. O site funciona sem este arquivo.
(function () {
  var topo = document.getElementById("topo");
  var botao = document.querySelector(".topo__menu");
  var nav = document.getElementById("navegacao");

  function fechar(devolverFoco) {
    botao.setAttribute("aria-expanded", "false");
    nav.classList.remove("aberta");
    if (devolverFoco) botao.focus();
  }

  if (botao && nav) {
    botao.addEventListener("click", function () {
      var abrir = botao.getAttribute("aria-expanded") !== "true";
      botao.setAttribute("aria-expanded", String(abrir));
      nav.classList.toggle("aberta", abrir);
      if (abrir) {
        var primeiro = nav.querySelector("a");
        if (primeiro) primeiro.focus();
      }
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) fechar(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("aberta")) fechar(true);
    });
    window.matchMedia("(min-width: 900px)").addEventListener("change", function (m) {
      if (m.matches) fechar(false);
    });
  }

  if (topo) {
    var marcar = function () { topo.classList.toggle("rolou", window.scrollY > 8); };
    marcar();
    window.addEventListener("scroll", marcar, { passive: true });
  }
})();
