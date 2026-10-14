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

  // ---------- Movimento (desligado para quem pede redução de movimento) ----------
  var reduzir = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduzir.matches || !("IntersectionObserver" in window)) return;

  // Revelação ao rolar: grupos em sequência ganham um pequeno atraso entre si
  var grupos = [
    [".cabeca-secao, .apresentacao > .moldura > .sobretitulo, .apresentacao h2, .apresentacao__texto, .percurso__cabeca, .local__texto, .duvidas__grade > header, .perguntas, .ponderacao, .servico__cabeca, .servico__corpo, .servico__areas, .servico__frase, .contato__grade > *", 0],
    [".ficha > div", 0.07],
    [".etapas li", 0.08],
    [".principio", 0.1],
    [".lista-fina--grande li", 0.05],
    [".servico__duas > div", 0.12],
  ];
  var alvos = [];
  grupos.forEach(function (g) {
    var porPai = new Map();
    document.querySelectorAll(g[0]).forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return; // já visível: não esconde
      var i = porPai.get(el.parentNode) || 0;
      porPai.set(el.parentNode, i + 1);
      if (g[1]) el.style.setProperty("--atraso", (i * g[1]).toFixed(2) + "s");
      el.classList.add("revelar");
      alvos.push(el);
    });
  });
  document.querySelectorAll(".apresentacao__foto, .servico__foto, .local__foto").forEach(function (el) {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.classList.add("revelar-imagem");
    alvos.push(el);
  });

  var observador = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("visivel");
      observador.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
  alvos.forEach(function (el) { observador.observe(el); });

  // Sol do contato gira devagar conforme a rolagem; a foto do início desliza um pouco (profundidade)
  var sol = document.querySelector(".contato__sol");
  var fotoInicio = document.querySelector(".arco img");
  var pendente = false;
  function atualizar() {
    pendente = false;
    var y = window.scrollY;
    if (sol) sol.style.transform = "rotate(" + (y * 0.04).toFixed(2) + "deg)";
    if (fotoInicio && y < window.innerHeight * 1.2) fotoInicio.style.translate = "0 " + (y * 0.06).toFixed(1) + "px";
  }
  window.addEventListener("scroll", function () {
    if (!pendente) { pendente = true; window.requestAnimationFrame(atualizar); }
  }, { passive: true });
  atualizar();
})();
