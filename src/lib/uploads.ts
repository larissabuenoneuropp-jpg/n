/**
 * Restrições de upload (anexos, documentos, logo e assinatura).
 * Só formatos de documento/imagem comuns. HTML, SVG, scripts e executáveis são recusados porque,
 * ao serem abertos no navegador, poderiam executar código dentro do site.
 */
export const MAX_UPLOAD_MB = 25;

const ALLOWED: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  odt: ["application/vnd.oasis.opendocument.text"],
  ods: ["application/vnd.oasis.opendocument.spreadsheet"],
  rtf: ["application/rtf", "text/rtf"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  md: ["text/markdown", "text/plain"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  heic: ["image/heic", "image/heif"],
  mp3: ["audio/mpeg"],
  m4a: ["audio/mp4", "audio/x-m4a"],
  mp4: ["video/mp4"],
};

export const ACCEPT_ATTR = Object.keys(ALLOWED).map((e) => "." + e).join(",");

/** Lança um erro com mensagem clara se o arquivo não for permitido. */
export function validateUpload(file: File, maxMb = MAX_UPLOAD_MB) {
  const name = file.name.trim();
  if (!name || name.length > 180) throw new Error("Nome de arquivo inválido ou muito longo.");
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const types = ALLOWED[ext];
  if (!types) throw new Error(`Formato .${ext || "?"} não permitido. Envie PDF, Word, Excel, PowerPoint, texto, imagem (PNG/JPG/WEBP), áudio ou vídeo MP4.`);
  // Navegadores às vezes não informam o tipo (""), então só recusamos quando ele contradiz a extensão
  if (file.type && !types.includes(file.type) && file.type !== "application/octet-stream") {
    throw new Error(`O arquivo "${name}" diz ser .${ext}, mas o conteúdo informado é ${file.type}. Envio recusado por segurança.`);
  }
  if (file.size === 0) throw new Error("O arquivo está vazio.");
  if (file.size > maxMb * 1024 * 1024) throw new Error(`Limite de ${maxMb} MB por arquivo.`);
  return { ext, type: file.type || types[0] };
}

/** Nome seguro para guardar (sem caminhos nem caracteres especiais). */
export const safeFileName = (name: string) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").replace(/^\.+/, "").slice(0, 120) || "arquivo";
