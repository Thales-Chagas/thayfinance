import { describe, it, expect } from "vitest";
import { mensagemErroAuth, emailValido, problemaEmail } from "./errosAuth";

describe("mensagens de erro do login", () => {
  it("credencial errada e e-mail não confirmado dão a MESMA mensagem (não revela conta)", () => {
    const a = mensagemErroAuth({ message: "Invalid login credentials" }, "entrar", true);
    const b = mensagemErroAuth({ message: "Email not confirmed" }, "entrar", true);
    expect(a).toBe(b);
    expect(a).toMatch(/incorretos/);
  });
  it("sem internet tem mensagem própria", () => {
    expect(mensagemErroAuth({ message: "Failed to fetch" }, "entrar", true)).toMatch(/sem internet/);
    expect(mensagemErroAuth({ message: "qualquer" }, "entrar", false)).toMatch(/sem internet/);
  });
  it("muitas tentativas", () => {
    expect(mensagemErroAuth({ status: 429, message: "x" }, "recuperar", true)).toMatch(/Aguarde um minuto/);
    expect(mensagemErroAuth({ message: "For security purposes, you can only request this after 60 seconds." }, "recuperar", true)).toMatch(/Aguarde/);
  });
  it("recuperação nunca diz se a conta existe", () => {
    const m = mensagemErroAuth({ message: "User not found" }, "recuperar", true);
    expect(m).not.toMatch(/não existe|não encontrad|sem conta/i);
  });
  it("cadastro e senha nova", () => {
    expect(mensagemErroAuth({ message: "User already registered" }, "criar", true)).toMatch(/já tem conta/);
    expect(mensagemErroAuth({ message: "Password should be at least 8 characters" }, "criar", true)).toMatch(/fraca/);
    expect(mensagemErroAuth({ message: "New password should be different from the old password." }, "novaSenha", true)).toMatch(/diferente/);
    expect(mensagemErroAuth({ message: "Auth session missing!" }, "novaSenha", true)).toMatch(/expirou/);
  });
  it("erro desconhecido cai numa mensagem genérica do contexto", () => {
    expect(mensagemErroAuth({ message: "boom" }, "criar", true)).toMatch(/criar a conta/);
  });
});

describe("e-mail", () => {
  it("valida e explica o problema", () => {
    expect(emailValido("ana@gmail.com")).toBe(true);
    expect(emailValido("ana@gmail")).toBe(false);
    expect(problemaEmail("")).toMatch(/Digite/);
    expect(problemaEmail("ana.gmail.com")).toMatch(/@/);
    expect(problemaEmail("ana@gmail")).toMatch(/final/);
    expect(problemaEmail(" ana@gmail.com ")).toBeNull();
  });
});
