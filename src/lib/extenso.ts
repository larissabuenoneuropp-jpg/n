// Números por extenso em português (para contratos e recibos).

const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10;
    return DEZENAS[d] + (u ? ` e ${UNIDADES[u]}` : "");
  }
  if (n === 100) return "cem";
  const c = Math.floor(n / 100), r = n % 100;
  return CENTENAS[c] + (r ? ` e ${ate999(r)}` : "");
}

/** Inteiro (0 a 999.999.999) por extenso. */
export function numeroPorExtenso(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n < 1000) return ate999(n);
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (milhoes) partes.push(milhoes === 1 ? "um milhão" : `${numeroPorExtenso(milhoes)} milhões`);
  if (milhares) partes.push(milhares === 1 ? "mil" : `${ate999(milhares)} mil`);
  if (resto) partes.push(ate999(resto));
  // "e" antes do último grupo quando ele é < 100 ou centena exata (ex.: mil e duzentos, mil e cinquenta)
  if (partes.length > 1 && resto && (resto < 100 || resto % 100 === 0)) {
    const ultimo = partes.pop()!;
    return `${partes.join(" ")} e ${ultimo}`;
  }
  if (partes.length > 1 && !resto && milhares && (milhares < 100 || milhares % 100 === 0)) {
    return `${partes[0]} e ${partes[1]}`; // um milhão e duzentos mil
  }
  return partes.join(" ");
}

/** Valor em reais por extenso: 1250.5 → "mil, duzentos e cinquenta reais e cinquenta centavos". */
export function reaisPorExtenso(valor: number): string {
  const total = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(total / 100);
  const centavos = total % 100;
  const r = reais ? `${numeroPorExtenso(reais)}${reais % 1_000_000 === 0 && reais >= 1_000_000 ? " de" : ""} ${reais === 1 ? "real" : "reais"}` : "";
  const c = centavos ? `${numeroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}` : "";
  if (r && c) return `${r} e ${c}`;
  return r || c || "zero reais";
}

export const UF_NOME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
