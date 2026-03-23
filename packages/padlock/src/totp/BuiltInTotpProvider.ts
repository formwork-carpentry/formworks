/**
 * @module @carpentry/padlock/totp
 * @description Built-in TOTP provider using Node.js crypto. No external dependencies.
 * RFC 6238 compliant, compatible with Google Authenticator.
 */

import { createHmac, randomBytes } from "node:crypto";
import type { ITotpProvider } from "../contracts.js";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let result = "";

  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >>> bits) & 0x1f];
    }
  }
  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return result;
}

/**
 * Built-in TOTP provider. Uses Node.js crypto, no external deps.
 */
export class BuiltInTotpProvider implements ITotpProvider {
  private readonly period: number;
  private readonly digits: number;

  constructor(period = 30, digits = 6) {
    this.period = period;
    this.digits = digits;
  }

  generateSecret(): string {
    return base32Encode(randomBytes(20));
  }

  async generate(secret: string): Promise<string> {
    const counter = Math.floor(Date.now() / 1000 / this.period);
    return this.hotp(secret, counter);
  }

  async verify(secret: string, token: string): Promise<boolean> {
    const counter = Math.floor(Date.now() / 1000 / this.period);
    for (let i = -1; i <= 1; i++) {
      const expected = await this.hotp(secret, counter + i);
      if (expected === token) return true;
    }
    return false;
  }

  otpauthUrl(secret: string, accountName: string, issuer?: string): string {
    const params = new URLSearchParams();
    params.set("secret", secret);
    params.set("period", String(this.period));
    params.set("digits", String(this.digits));
    if (issuer) params.set("issuer", issuer);
    const label = issuer ? `${issuer}:${accountName}` : accountName;
    return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
  }

  private async hotp(secret: string, counter: number): Promise<string> {
    const key = base32Decode(secret);
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigInt64BE(BigInt(counter), 0);

    const hmac = createHmac("sha1", key).update(counterBuf).digest();
    const offset = (hmac.at(-1) ?? 0) & 0x0f;
    const binary =
      (((hmac[offset] ?? 0) & 0x7f) << 24) |
      (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
      (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
      ((hmac[offset + 3] ?? 0) & 0xff);
    const otp = binary % 10 ** this.digits;
    return otp.toString().padStart(this.digits, "0");
  }
}
