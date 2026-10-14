// Gera o site em dist/ a partir de src/ e config.json. Sem dependências: só Node 18+.
//   node build.mjs            → build de produção (exige um canal de contato configurado)
//   node build.mjs --preview  → pré-visualização: mostra as pendências na página e não é indexada
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = dirname(fileURLToPath(import.meta.url));
const src = join(raiz, "src");
const dist = join(raiz, "dist");
const preview = process.argv.includes("--preview");
const cfg = JSON.parse(readFileSync(join(raiz, "config.json"), "utf8"));

const erros = [];
const avisos = [];
const pendencias = [];

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const lista = (itens) => (itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`);

// ---------- Dados ----------

const nome = cfg.nome || "Larissa Bueno";
const atuacao = cfg.atuacao || "Professora e neuropsicopedagoga";

let url = String(cfg.url || "").trim().replace(/\/+$/, "");
if (url && !/^https:\/\/[^\s/]+\.[^\s/]+/.test(url)) {
  erros.push(`"url" deve ser um endereço completo com https:// (recebido: ${url}).`);
  url = "";
}
if (!url) avisos.push(`"url" vazio: sem canonical, imagem de compartilhamento e sitemap. Preencha com o domínio final.`);

let whatsapp = String(cfg.whatsapp || "").replace(/\D/g, "");
if (whatsapp && (whatsapp.length === 10 || whatsapp.length === 11)) whatsapp = "55" + whatsapp;
if (whatsapp && !/^55\d{10,11}$/.test(whatsapp)) {
  erros.push(`"whatsapp" inválido: use DDI + DDD + número, só dígitos (ex.: 5547999998888).`);
  whatsapp = "";
}

let instagram = String(cfg.instagram || "").trim();
let instagramUser = "";
if (instagram) {
  instagramUser = instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(instagramUser)) {
    erros.push(`"instagram" inválido: use @usuario ou o link do perfil.`);
    instagramUser = "";
  }
}
instagram = instagramUser ? `https://www.instagram.com/${instagramUser}/` : "";

const email = String(cfg.email || "").trim();
if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) erros.push(`"email" inválido.`);

const cidades = (cfg.cidades || []).map((c) => String(c).trim()).filter(Boolean);
const uf = String(cfg.uf || "").trim();
if (!cidades.length) avisos.push(`"cidades" vazio: a região de atendimento não aparece no site nem na descrição para buscadores.`);

function telefoneLegivel(d) {
  const n = d.slice(2);
  const ddd = n.slice(0, 2);
  const resto = n.slice(2);
  return resto.length === 9 ? `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}` : `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
}

// ---------- Canal principal de contato ----------

const icone = {
  conversa: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5z"/></svg>`,
  email: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></g></svg>`,
};

let canal;
if (whatsapp) {
  canal = {
    href: `https://wa.me/${whatsapp}?text=${encodeURIComponent(cfg.mensagemWhatsapp || "")}`,
    rotulo: "Conversar pelo WhatsApp",
    rotuloGrande: "Iniciar conversa no WhatsApp",
    frase: "pelo WhatsApp",
    icone: icone.conversa,
  };
} else if (email) {
  canal = {
    href: `mailto:${email}?subject=${encodeURIComponent("Atendimento neuropsicopedagógico")}`,
    rotulo: "Enviar um e-mail",
    rotuloGrande: "Enviar um e-mail",
    frase: "por e-mail",
    icone: icone.email,
  };
} else if (instagram) {
  canal = {
    href: instagram,
    rotulo: "Falar pelo Instagram",
    rotuloGrande: "Mandar mensagem no Instagram",
    frase: "por mensagem no Instagram",
    icone: icone.conversa,
  };
} else {
  const msg = `Nenhum canal de contato configurado: preencha "whatsapp" (recomendado), "email" ou "instagram" em config.json.`;
  if (preview) pendencias.push("canal de contato (WhatsApp)");
  else erros.push(msg);
  canal = { href: "#contato", rotulo: "Entrar em contato", rotuloGrande: "", frase: "pelo canal indicado no fim da página", icone: "" };
}

const contatoPrincipal = canal.rotuloGrande
  ? `<a class="botao botao--grande" href="${esc(canal.href)}">${canal.icone}${canal.rotuloGrande}</a>`
  : `<div class="contato__pendente" role="note"><strong>Contato ainda não configurado.</strong> Preencha o número de WhatsApp em <code>site/config.json</code>. Esta caixa só aparece na pré-visualização.</div>`;

const outros = [];
if (instagram && !canal.href.startsWith("https://www.instagram.com")) outros.push(`<li>Instagram: <a href="${esc(instagram)}">@${esc(instagramUser)}</a></li>`);
if (email && !canal.href.startsWith("mailto:")) outros.push(`<li>E-mail: <a href="mailto:${esc(email)}">${esc(email)}</a></li>`);
const contatosExtra = outros.length ? `<ul class="contato__outros">${outros.join("")}</ul>` : "";

const rodapeItens = [];
if (whatsapp) rodapeItens.push(`<li><a href="${esc(canal.href)}">WhatsApp ${telefoneLegivel(whatsapp)}</a></li>`);
if (instagram) rodapeItens.push(`<li><a href="${esc(instagram)}">Instagram @${esc(instagramUser)}</a></li>`);
if (email) rodapeItens.push(`<li><a href="mailto:${esc(email)}">${esc(email)}</a></li>`);
const rodapeContatos = rodapeItens.length ? `<ul>${rodapeItens.join("")}</ul>` : "";

// ---------- Local, formação e registro ----------

const cidadesTexto = cidades.length ? `, em ${lista(cidades.map(esc))}${uf ? ` (${esc(uf)})` : ""}` : "";
const fichaLocal =
  `Presencial, em sala de atendimento${cidadesTexto}` +
  (cfg.atendimentoDomiciliar ? "; também em domicílio, quando combinado" : "; em outro local, quando combinado com a família");

const localTexto = [
  `<p>Os atendimentos são presenciais, em sala de atendimento${cidadesTexto}.</p>`,
  cfg.atendimentoDomiciliar
    ? `<p>Também podem acontecer em domicílio ou em outro local combinado previamente com a família, conforme a necessidade e a disponibilidade de agenda.</p>`
    : `<p>Quando há uma necessidade justificada, podem acontecer em outro local, combinado previamente com a família.</p>`,
  `<p>Endereço, dias e horários disponíveis são informados no primeiro contato. <a href="#contato">Consultar disponibilidade</a></p>`,
].join("\n          ");

const formacao = (cfg.formacao || []).filter((f) => f && f.titulo);
const fichaFormacao = formacao.length
  ? `<div>
                <dt>Formação</dt>
                <dd>${formacao.map((f) => `${esc(f.titulo)}${f.detalhe ? ` <small>${esc(f.detalhe)}</small>` : ""}`).join("<br>")}</dd>
              </div>`
  : "";

const registro = String(cfg.registroProfissional || "").trim();
const fichaRegistro = registro ? `<div>\n                <dt>Registro</dt>\n                <dd>${esc(registro)}</dd>\n              </div>` : "";
const rodapeRegistro = registro ? `<p>${esc(registro)}</p>` : "";

// ---------- Fotos ----------

function dimensoes(arquivo) {
  const b = readFileSync(arquivo);
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return null;
}

function foto(slot, { sizes, prioridade = false }) {
  const f = cfg.fotos?.[slot];
  if (!f?.arquivo) return "";
  const caminho = join(src, f.arquivo);
  if (!existsSync(caminho)) {
    avisos.push(`Foto "${slot}" não encontrada em src/${f.arquivo}: o site usa a composição alternativa.`);
    if (preview) pendencias.push(`foto "${slot}"`);
    return "";
  }
  if (!f.alt) erros.push(`Foto "${slot}" sem texto alternativo ("alt") no config.json.`);
  const d = dimensoes(caminho);
  const base = f.arquivo.replace(/\.(jpe?g|png)$/i, "");
  const variantes = [800, 1400].filter((w) => existsSync(join(src, `${base}-${w}.webp`)));
  const attrs = [
    `src="${esc(f.arquivo)}"`,
    `alt="${esc(f.alt)}"`,
    d ? `width="${d.w}" height="${d.h}"` : "",
    prioridade ? `fetchpriority="high"` : `loading="lazy"`,
    `decoding="async"`,
  ].filter(Boolean).join(" ");
  const fonte = variantes.length
    ? `<source type="image/webp" srcset="${variantes.map((w) => `${esc(base)}-${w}.webp ${w}w`).join(", ")}" sizes="${sizes}">`
    : "";
  return `<picture>${fonte}<img ${attrs}></picture>`;
}

const raios = `<svg class="inicio__raios" viewBox="0 0 72 72" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M36 6v12M12 18l8 8M60 18l-8 8M4 42h12M56 42h12"/></g></svg>`;

const composicao = `<svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
          <rect width="400" height="500" fill="#e4efee"/>
          <g class="sol-nascente"><g class="sol-raios" stroke="#e6c983" stroke-width="7" stroke-linecap="round">${Array.from({ length: 12 }, (_, k) => {
            const a = (k * 30 * Math.PI) / 180;
            const p = (r) => [(200 + r * Math.cos(a)).toFixed(1), (250 + r * Math.sin(a)).toFixed(1)];
            const [x1, y1] = p(92);
            const [x2, y2] = p(122);
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
          }).join("")}</g>
          <path d="M243 205a62 62 0 1 0 12 72" fill="none" stroke="#daa47f" stroke-width="10" stroke-linecap="round"/>
          <path d="M200 286c-30-22-42-44-30-60 10-13 26-10 30 6 4-16 20-19 30-6 12 16 0 38-30 60z" fill="none" stroke="#c98b66" stroke-width="7" stroke-linejoin="round"/></g>
          <path class="colina colina--fundo" d="M0 352c70-30 150-34 220-14s130 18 180-6v168H0z" fill="#d3d7c6"/>
          <path class="colina colina--frente" d="M0 410c90-36 190-30 260-6 54 18 100 16 140 2v94H0z" fill="#b9bea7"/>
        </svg>`;

const fotoInicio = foto("inicio", { sizes: "(min-width: 900px) 31rem, 90vw", prioridade: true });
const heroVisual = fotoInicio ? `<div class="arco">${fotoInicio}</div>\n        ${raios}` : `<div class="arco">${composicao}</div>`;

const fotoApresentacao = foto("apresentacao", { sizes: "(min-width: 900px) 40vw, 100vw" });
const fotoAtendimento = foto("atendimento", { sizes: "(min-width: 900px) 35vw, 100vw" });

// ---------- SEO ----------

const titulo = `${nome} | Neuropsicopedagogia infantil: avaliação e intervenção`;
const descricao =
  `Avaliação e intervenção neuropsicopedagógica para crianças de 5 a 13 anos` +
  (cidades.length ? ` em ${lista(cidades)}` : "") +
  `, com orientação às famílias. ${nome}, ${atuacao.toLowerCase()}.`;

const jsonld = url
  ? `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      name: nome,
      jobTitle: "Neuropsicopedagoga",
      description: descricao,
      url: `${url}/`,
      ...(fotoInicio ? { image: `${url}/${cfg.fotos.inicio.arquivo}` } : {}),
      knowsAbout: ["Neuropsicopedagogia", "Avaliação neuropsicopedagógica", "Intervenção neuropsicopedagógica", "Aprendizagem infantil"],
      ...(instagram ? { sameAs: [instagram] } : {}),
    }).replace(/</g, "\\u003c")}</script>`
  : "";

const adobeKit = String(cfg.adobeFontsKit || "").trim();
if (adobeKit && !/^[a-z0-9]+$/i.test(adobeKit)) erros.push(`"adobeFontsKit" deve conter só o ID do kit (letras e números).`);
const adobe = adobeKit ? `<link rel="stylesheet" href="https://use.typekit.net/${esc(adobeKit)}.css">` : "";

if (!url && preview) pendencias.push("domínio do site");

const avisoPreview = preview
  ? `<p class="aviso-preview" role="note"><strong>Pré-visualização</strong>${pendencias.length ? ` · ainda falta: ${esc(lista(pendencias))}` : ""}.</p>`
  : "";

// ---------- Montagem ----------

if (erros.length) {
  console.error("\nNão foi possível gerar o site:\n" + erros.map((e) => "  ✗ " + e).join("\n") + "\n");
  process.exit(1);
}

const hoje = new Date();
const valores = {
  nome: esc(nome),
  atuacao: esc(atuacao),
  titulo: esc(titulo),
  descricao: esc(descricao),
  canonical: url ? `<link rel="canonical" href="${esc(url)}/">\n  <meta property="og:url" content="${esc(url)}/">` : "",
  canonical_privacidade: url ? `<link rel="canonical" href="${esc(url)}/privacidade.html">` : "",
  og_image: url
    ? `<meta property="og:image" content="${esc(url)}/img/og-image.jpg">\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">\n  <meta property="og:image:alt" content="Logotipo ${esc(nome)} — ${esc(atuacao)}">`
    : "",
  jsonld,
  adobe: adobe + (preview ? `\n  <meta name="robots" content="noindex">` : ""),
  aviso_preview: avisoPreview,
  cta_href: esc(canal.href),
  cta_attrs: "",
  cta_label: canal.rotulo,
  canal_maiusculo: canal.frase.charAt(0).toUpperCase() + canal.frase.slice(1),
  canal_privacidade: rodapeItens.length ? `pelos canais de contato indicados no site (${canal.frase.replace(/^pel[oa] |^por /, "")})` : "pelo canal de contato indicado no site",
  foto_inicio: heroVisual,
  foto_apresentacao: fotoApresentacao ? `<figure class="apresentacao__foto">${fotoApresentacao}</figure>` : "",
  apresentacao_classe: fotoApresentacao ? "tem-foto" : "sem-foto",
  foto_atendimento: fotoAtendimento ? `<figure class="servico__foto">${fotoAtendimento}</figure>` : "",
  atendimento_classe: fotoAtendimento ? "tem-foto" : "sem-foto",
  ficha_formacao: fichaFormacao,
  ficha_local: fichaLocal,
  ficha_registro: fichaRegistro,
  local_texto: localTexto,
  contato_principal: contatoPrincipal,
  contatos_extra: contatosExtra,
  rodape_contatos: rodapeContatos,
  rodape_registro: rodapeRegistro,
  ano: String(hoje.getFullYear()),
  data_atualizacao: hoje.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
};

function montar(arquivo) {
  let html = readFileSync(join(src, arquivo), "utf8");
  if (adobeKit) html = html.replace('class="no-js"', 'class="no-js com-neulis"');
  if (adobeKit && arquivo === "privacidade.html") {
    html = html.replace(
      "As fontes e imagens são carregadas do próprio site, sem chamadas a serviços de terceiros.",
      "As imagens são carregadas do próprio site. A fonte dos títulos é carregada do Adobe Fonts, que pode registrar dados técnicos de acesso."
    );
  }
  html = html.replace(/\{\{(\w+)\}\}/g, (_, chave) => {
    if (!(chave in valores)) throw new Error(`Marcador sem valor em ${arquivo}: {{${chave}}}`);
    return valores[chave];
  });
  return html;
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const pagina of ["index.html", "privacidade.html", "404.html"]) writeFileSync(join(dist, pagina), montar(pagina));
for (const item of ["styles.css", "main.js", "fonts", "img"]) {
  cpSync(join(src, item), join(dist, item), { recursive: true, filter: (caminho) => !caminho.endsWith("LEIA-ME.txt") });
}

// robots.txt e sitemap.xml
const robots = preview ? "User-agent: *\nDisallow: /\n" : `User-agent: *\nAllow: /\n${url ? `\nSitemap: ${url}/sitemap.xml\n` : ""}`;
writeFileSync(join(dist, "robots.txt"), robots);
if (url && !preview) {
  const dia = hoje.toISOString().slice(0, 10);
  const urls = [`${url}/`, `${url}/privacidade.html`];
  writeFileSync(
    join(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${dia}</lastmod></url>`).join("\n")}\n</urlset>\n`
  );
}

// Cabeçalhos de segurança e cache (Netlify). O hash libera só o script inline que troca no-js → js.
const scriptInline = 'document.documentElement.classList.replace("no-js", "js");';
const hash = createHash("sha256").update(scriptInline).digest("base64");
const typekit = adobeKit ? " https://use.typekit.net https://p.typekit.net" : "";
writeFileSync(
  join(dist, "_headers"),
  `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-${hash}'; style-src 'self'${typekit}; font-src 'self'${typekit}; img-src 'self' data:${typekit}; connect-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; object-src 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/img/*
  Cache-Control: public, max-age=604800
`
);

console.log(`\nSite gerado em dist/ (${preview ? "pré-visualização" : "produção"}).`);
if (avisos.length) console.log("Avisos:\n" + avisos.map((a) => "  • " + a).join("\n"));
console.log("");
