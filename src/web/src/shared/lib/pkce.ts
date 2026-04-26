/**
 * PKCE-утилиты: generate verifier + challenge
 * RFC 7636: verifier 43Ц128 символов из [A-Z a-z 0-9 - . _ ~],
 * challenge = base64url(sha256(verifier))
 */

const VERIFIER_BYTES = 32;

function base64UrlEncode(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateVerifier(): string {
    const buf = new Uint8Array(VERIFIER_BYTES);
    crypto.getRandomValues(buf);
    return base64UrlEncode(buf);
}

export async function challengeFromVerifier(verifier: string): Promise<string> {
    const data = new TextEncoder().encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(hash));
}

export function generateState(): string {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return base64UrlEncode(buf);
}