

/* ============================================================
   ARMAZENAMENTO (Artifact Storage com fallback p/ localStorage)
   ============================================================ */

export async function storageGet(key) {
  try {
    const s = typeof window !== "undefined" ? window.storage : null;
    if (s) {
      if (typeof s.getItem === "function") {
        const r = await s.getItem(key);
        if (r == null) return null;
        return typeof r === "string" ? r : r.value ?? null;
      }
      if (typeof s.get === "function") {
        const r = await s.get(key);
        if (r == null) return null;
        return typeof r === "string" ? r : r.value ?? null;
      }
    }
  } catch {
    /* cai para localStorage */
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function storageSet(key, value) {
  try {
    const s = typeof window !== "undefined" ? window.storage : null;
    if (s) {
      if (typeof s.setItem === "function") {
        await s.setItem(key, value);
        return true;
      }
      if (typeof s.set === "function") {
        await s.set(key, value);
        return true;
      }
    }
  } catch {
    /* cai para localStorage */
  }
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

// Hash do PIN (nunca guardamos o PIN em si)
export async function hashPin(pin, salt) {
  const texto = salt + ":" + pin;
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let h = 0;
    for (let i = 0; i < texto.length; i++) h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0;
    return "f" + (h >>> 0).toString(16);
  }
}
