import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for stored profiles (residency status and income are sensitive).
 * Key: 32 random bytes, base64, in PROFILE_ENCRYPTION_KEY (`openssl rand -base64 32`).
 * `data` is ciphertext followed by the 16-byte GCM auth tag, so a row needs only
 * `encrypted_data` + `iv`. Any tampering makes decryption throw.
 */
const TAG_BYTES = 16;

function key(): Buffer {
  const k = Buffer.from(process.env.PROFILE_ENCRYPTION_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("PROFILE_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return k;
}

export function hasEncryptionKey(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptJson(value: unknown): { data: Buffer; iv: Buffer } {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return { data: Buffer.concat([ciphertext, c.getAuthTag()]), iv };
}

export function decryptJson<T>(data: Buffer, iv: Buffer): T {
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(data.subarray(data.length - TAG_BYTES));
  return JSON.parse(Buffer.concat([d.update(data.subarray(0, data.length - TAG_BYTES)), d.final()]).toString("utf8"));
}
