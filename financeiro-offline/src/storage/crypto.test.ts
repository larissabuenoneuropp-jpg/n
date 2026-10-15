import { describe, expect, it } from "vitest";
import { newSession, parseDataFile, seal, unseal } from "./crypto";

describe("arquivo de dados criptografado", () => {
  it("abre com a senha certa e recusa a errada", async () => {
    const s = await newSession("tigre-violeta-janela-47!");
    const file = await seal({ ok: 1, texto: "ação" }, s);
    expect(JSON.stringify(file)).not.toContain("ação");
    const parsed = parseDataFile(JSON.stringify(file));
    const { content } = await unseal<{ ok: number; texto: string }>(parsed, "tigre-violeta-janela-47!");
    expect(content).toEqual({ ok: 1, texto: "ação" });
    await expect(unseal(parsed, "senha-errada-123456")).rejects.toThrow(/Senha incorreta/);
  }, 30000);

  it("detecta arquivo alterado (dados ou cabeçalho)", async () => {
    const s = await newSession("tigre-violeta-janela-47!");
    const file = await seal({ valor: 100 }, s);
    const flip = (b64: string) => { const b = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); b[5] ^= 1; return btoa(String.fromCharCode(...b)); };
    await expect(unseal({ ...file, data: flip(file.data) }, "tigre-violeta-janela-47!")).rejects.toThrow();
    await expect(unseal({ ...file, kdf: { ...file.kdf, iterations: 4 } }, "tigre-violeta-janela-47!")).rejects.toThrow();
  }, 30000);

  it("cada gravação usa um vetor novo (IV)", async () => {
    const s = await newSession("tigre-violeta-janela-47!");
    const a = await seal({ v: 1 }, s);
    const b = await seal({ v: 1 }, s);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  }, 30000);

  it("recusa arquivos que não são do app", () => {
    expect(() => parseDataFile("{}")).toThrow();
    expect(() => parseDataFile("texto")).toThrow();
  });
});
