// ============================================================
//  Desbloqueio biométrico (Face ID / Touch ID / digital) via WebAuthn
//  Uso LOCAL: sem servidor para validar a assinatura, tratamos um
//  get() bem-sucedido como desbloqueio (tranca local do aparelho,
//  no mesmo nível de confiança do PIN). Exige HTTPS (GitHub Pages).
//  Quando o login na nuvem entrar (Etapa B), a validação fica completa.
// ============================================================

function b64urlFromBuf(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bufFromB64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function biometriaSuportada() {
  return (
    typeof window !== "undefined" &&
    !!window.PublicKeyCredential &&
    !!(navigator.credentials && navigator.credentials.create)
  );
}

// Confere se o aparelho tem um autenticador de plataforma (Face ID / digital)
export async function temAutenticadorPlataforma() {
  try {
    if (!biometriaSuportada()) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Cadastra a biometria e devolve o id da credencial (para guardar)
export async function registrarBiometria(nome) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Thayfinance" },
      user: {
        id: userId,
        name: nome || "Thayfinance",
        displayName: nome || "Thayfinance",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  });
  if (!cred) throw new Error("não registrado");
  return b64urlFromBuf(cred.rawId);
}

// Pede a biometria. Se passar (não lançar), considera desbloqueado.
export async function verificarBiometria(credIdB64) {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const allowCredentials = credIdB64
    ? [{ type: "public-key", id: bufFromB64url(credIdB64) }]
    : [];
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials,
      userVerification: "required",
      timeout: 60000,
    },
  });
  return !!assertion;
}
