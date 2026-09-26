import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM for opt-in saved facts. Key: 32 bytes, base64, in SAVED_RESULTS_KEY. */
function key(): Buffer {
  const k = Buffer.from(process.env.SAVED_RESULTS_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("SAVED_RESULTS_KEY must be 32 bytes, base64-encoded");
  return k;
}

export function encryptJson(value: unknown) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return { ciphertext, iv, tag: c.getAuthTag() };
}

export function decryptJson<T>(ciphertext: Buffer, iv: Buffer, tag: Buffer): T {
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ciphertext), d.final()]).toString("utf8"));
}
