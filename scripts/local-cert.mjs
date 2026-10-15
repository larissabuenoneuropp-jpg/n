// Certificado HTTPS para usar o NeuroPlanner só neste computador (https://localhost).
// Usa apenas o módulo de criptografia do Node (sem bibliotecas externas):
//  1. cria uma autoridade certificadora (CA) local e, com ela, o certificado de "localhost";
//  2. APAGA a chave privada da CA logo em seguida — ela nunca é gravada no disco, então não pode
//     ser usada para assinar certificados de outros sites (o risco clássico de CAs locais);
//  3. instala a CA como confiável só para o seu usuário (Windows/Mac pedem confirmação).
import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign, X509Certificate } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/* ------------------------------- DER mínimo ------------------------------- */
function len(n) {
  if (n < 0x80) return Buffer.from([n]);
  const bytes = [];
  for (let v = n; v > 0; v >>= 8) bytes.unshift(v & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
const tlv = (tag, content) => Buffer.concat([Buffer.from([tag]), len(content.length), content]);
const seq = (...items) => tlv(0x30, Buffer.concat(items));
const set = (...items) => tlv(0x31, Buffer.concat(items));
const explicit = (n, content) => tlv(0xa0 + n, content);
const bool = (v) => tlv(0x01, Buffer.from([v ? 0xff : 0x00]));
const octets = (b) => tlv(0x04, b);
const bitString = (b, unused = 0) => tlv(0x03, Buffer.concat([Buffer.from([unused]), b]));
const utf8 = (s) => tlv(0x0c, Buffer.from(s, "utf8"));
function int(value) {
  let b = Buffer.isBuffer(value) ? value : Buffer.from([value]);
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]);
  return tlv(0x02, b);
}
function oid(dotted) {
  const parts = dotted.split(".").map(Number);
  const out = [40 * parts[0] + parts[1]];
  for (const p of parts.slice(2)) {
    const stack = [p & 0x7f];
    for (let v = p >> 7; v > 0; v >>= 7) stack.unshift((v & 0x7f) | 0x80);
    out.push(...stack);
  }
  return tlv(0x06, Buffer.from(out));
}
function utcTime(d) {
  const p = (n) => String(n).padStart(2, "0");
  return tlv(0x17, Buffer.from(`${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`));
}
const name = (cn) => seq(set(seq(oid("2.5.4.10"), utf8("NeuroPlanner (local)"))), set(seq(oid("2.5.4.3"), utf8(cn))));
const ext = (id, critical, value) => seq(oid(id), ...(critical ? [bool(true)] : []), octets(value));
const ECDSA_SHA256 = seq(oid("1.2.840.10045.4.3.2"));

function certificate({ subject, issuer, publicKeyDer, signerKey, days, extensions }) {
  const now = new Date(Date.now() - 60_000);
  const serial = randomBytes(16);
  serial[0] &= 0x7f;
  const tbs = seq(
    explicit(0, int(2)),
    int(serial),
    ECDSA_SHA256,
    name(issuer),
    seq(utcTime(now), utcTime(new Date(now.getTime() + days * 86400000))),
    name(subject),
    publicKeyDer,
    explicit(3, seq(...extensions)),
  );
  const signature = sign("sha256", tbs, signerKey); // ECDSA em DER
  return seq(tbs, ECDSA_SHA256, bitString(signature));
}

const pem = (der, label) => `-----BEGIN ${label}-----\n${der.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END ${label}-----\n`;
const keyId = (spkiDer) => createHash("sha1").update(spkiDer).digest();

const CA_NAME = "NeuroPlanner - certificado local (so este computador)";
// Apple exige no máximo 825 dias para certificados de servidor, mesmo com CA instalada pelo usuário
const DAYS = 800;

export function generate(dir) {
  mkdirSync(dir, { recursive: true });
  const ca = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const caSpki = ca.publicKey.export({ type: "spki", format: "der" });
  const caDer = certificate({
    subject: CA_NAME, issuer: CA_NAME, publicKeyDer: caSpki, signerKey: ca.privateKey, days: DAYS,
    extensions: [
      ext("2.5.29.19", true, seq(bool(true), int(0))), // CA, sem intermediárias
      ext("2.5.29.15", true, bitString(Buffer.from([0x06]), 1)), // keyCertSign + cRLSign
      ext("2.5.29.14", false, octets(keyId(caSpki))),
    ],
  });
  const leaf = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const leafSpki = leaf.publicKey.export({ type: "spki", format: "der" });
  const san = seq(tlv(0x82, Buffer.from("localhost")), tlv(0x87, Buffer.from([127, 0, 0, 1])), tlv(0x87, Buffer.from([...Array(15).fill(0), 1])));
  const leafDer = certificate({
    subject: "localhost", issuer: CA_NAME, publicKeyDer: leafSpki, signerKey: ca.privateKey, days: DAYS,
    extensions: [
      ext("2.5.29.19", true, seq()),
      ext("2.5.29.15", true, bitString(Buffer.from([0x80]), 7)), // digitalSignature
      ext("2.5.29.37", false, seq(oid("1.3.6.1.5.5.7.3.1"))), // serverAuth
      ext("2.5.29.17", false, san),
      ext("2.5.29.14", false, octets(keyId(leafSpki))),
      ext("2.5.29.35", false, seq(tlv(0x80, keyId(caSpki)))),
    ],
  });
  // A chave privada da CA não é exportada nem gravada: ao sair desta função, deixa de existir.
  writeFileSync(join(dir, "ca.crt"), pem(caDer, "CERTIFICATE"));
  writeFileSync(join(dir, "localhost.crt"), pem(leafDer, "CERTIFICATE"));
  writeFileSync(join(dir, "localhost.key"), leaf.privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  rmSync(join(dir, "trusted"), { force: true });
}

function valid(dir) {
  try {
    const cert = new X509Certificate(readFileSync(join(dir, "localhost.crt")));
    const ca = new X509Certificate(readFileSync(join(dir, "ca.crt")));
    createPrivateKey(readFileSync(join(dir, "localhost.key")));
    const left = Date.parse(cert.validTo) - Date.now();
    return cert.verify(ca.publicKey) && left > 30 * 86400000;
  } catch {
    return false;
  }
}

/** Remove a CA anterior do repositório de confiança (ao renovar). */
function untrust(caPath) {
  if (!existsSync(caPath)) return;
  const sha1 = new X509Certificate(readFileSync(caPath)).fingerprint.replace(/:/g, "");
  if (process.platform === "win32") spawnSync("certutil", ["-user", "-delstore", "Root", sha1], { stdio: "ignore" });
  else if (process.platform === "darwin") spawnSync("security", ["delete-certificate", "-Z", sha1, join(homedir(), "Library/Keychains/login.keychain-db")], { stdio: "ignore" });
}

function trust(dir) {
  const ca = join(dir, "ca.crt");
  console.log("\n→ Instalando o certificado local como confiável (só para o seu usuário).");
  let r;
  if (process.platform === "win32") {
    console.log("  O Windows vai perguntar se você quer instalar o certificado “NeuroPlanner - certificado local”: clique em Sim.");
    r = spawnSync("certutil", ["-user", "-addstore", "Root", ca], { stdio: "inherit" });
  } else if (process.platform === "darwin") {
    console.log("  O macOS vai pedir a senha do seu usuário para confiar no certificado.");
    r = spawnSync("security", ["add-trusted-cert", "-r", "trustRoot", "-k", join(homedir(), "Library/Keychains/login.keychain-db"), ca], { stdio: "inherit" });
  } else {
    console.log(`  Linux: importe ${ca} como autoridade confiável no navegador (Configurações › Certificados).`);
    return false;
  }
  if (r.status === 0) {
    writeFileSync(join(dir, "trusted"), new Date().toISOString());
    return true;
  }
  console.log("  Não foi possível instalar. O navegador vai mostrar um aviso de segurança; o sistema funciona, mas reabra este atalho para tentar de novo.");
  return false;
}

/** Garante certificado válido e confiável; devolve { key, cert }. */
export function ensureLocalCertificate(dir) {
  if (!valid(dir)) {
    untrust(join(dir, "ca.crt"));
    console.log("\n→ Gerando o certificado HTTPS deste computador…");
    generate(dir);
  }
  if (!existsSync(join(dir, "trusted"))) trust(dir);
  return { key: readFileSync(join(dir, "localhost.key")), cert: readFileSync(join(dir, "localhost.crt")), ca: readFileSync(join(dir, "ca.crt")) };
}
