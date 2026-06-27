# Estudo — Lançamento por áudio (IA) + Guarda de comprovantes no Thayfinance

> Documento de planejamento. **Nenhum código foi alterado no app.** Serve para você decidir com calma.
> Data: 25/06/2026

---

## 1. Visão geral — como tudo vai funcionar

Hoje o Thayfinance é um app **100% no aparelho**: React rodando no GitHub Pages, com os dados salvos no `localStorage` do navegador. Não existe servidor nenhum.

Para ter **áudio com IA** e **comprovantes**, o app precisa de uma peça nova: um **backend** (um "cérebro" na nuvem) que guarde os segredos e faça o trabalho pesado. O motivo é segurança (detalhado na seção 7), mas a regra é simples:

> **Chave de IA nunca pode ficar no código do site.** O GitHub Pages é público; qualquer pessoa abre o "inspecionar" do navegador e veria a chave. Então a IA é chamada por um servidor, não pelo navegador.

A peça que escolhemos pra ser esse backend é o **Supabase** (a mesma base que você já usou no Premium Beef).

### Desenho geral

```
   Seu celular/PC                  Nuvem (Supabase)              IA
   ┌───────────────┐    token     ┌──────────────────┐  chave  ┌──────────┐
   │  Thayfinance  │ ───────────► │  Edge Function    │ ──────►│ Whisper  │ (áudio→texto)
   │ (GitHub Pages)│              │  (mini-servidor)  │        │ + Claude │ (texto→lançamento)
   │               │ ◄─────────── │                   │ ◄──────│          │
   └───────────────┘   resposta   │  Banco (Postgres) │        └──────────┘
                                  │  Storage (arquivos)│
                                  │  Login (Auth)      │
                                  └──────────────────┘
```

### Fluxo A — Lançar por áudio
1. Você aperta o microfone no app e fala: *"gastei 87 e 40 no mercado ontem no cartão"*.
2. O navegador grava o áudio (recurso nativo, `MediaRecorder` — não instala nada).
3. O áudio sobe pro Supabase (autenticado pelo **seu** login).
4. A Edge Function manda o áudio pro **Whisper** → vira texto.
5. O texto vai pro **Claude** com a ordem: "transforme isso num lançamento em JSON".
   - Resultado: `{ valor: 87,40, categoria: "Mercado", tipo: "despesa", data: "ontem", metodo: "cartão" }`
6. O app recebe o JSON, **mostra pra você revisar** e, ao confirmar, grava o lançamento — na mesma estrutura que hoje você preenche no formulário.

> A revisão antes de gravar é de propósito: a IA acerta quase sempre, mas você sempre dá o "ok" final. Nada entra sem você ver.

### Fluxo B — Mandar foto do comprovante (a IA lê e lança sozinha) ⭐
Esta é uma **função principal** do projeto (decidida em 27/06/2026): você manda a **foto do comprovante** pro robô no WhatsApp e ele faz o resto.
1. Você tira a foto do comprovante (cupom, nota, recibo, Pix) e manda pro robô no WhatsApp — ou anexa no app.
2. A imagem sobe pro **Storage privado** do Supabase (não fica pública na internet) e fica **guardada** pra você consultar quando quiser.
3. O **Claude (visão/OCR)** lê o comprovante e extrai sozinho: **valor, data, estabelecimento e categoria sugerida**.
4. O robô responde com o lançamento já montado pra você **conferir e confirmar** ("✅ R$ 87,40 — Mercado — 26/06 — confirma?"). Ao confirmar, grava o lançamento **já vinculado ao comprovante**.
5. Depois, o comprovante fica acessível dentro do lançamento por um **link temporário** (expira em minutos) — ninguém de fora acessa.

> Ou seja: uma foto só → a IA lê, lança e arquiva o comprovante. A pessoa só dá o "ok".

---

## 2. Vou precisar de domínio novo? — **NÃO**

- Seu app continua no mesmo endereço: **`thales-chagas.github.io/thayfinance/`**. Nada muda.
- O Supabase te dá **automaticamente e de graça** um endereço de backend (algo como `xyzabc.supabase.co`). Isso **não é um domínio que se compra** — é gerado sozinho quando você cria o projeto. O usuário nunca vê esse endereço; é só o app que conversa com ele.
- **Domínio próprio** (ex: `thayfinance.com.br`) é totalmente **opcional** e só pra estética. Se um dia você quiser, custa ~R$40/ano no registro.br. Não tem nada a ver com fazer a IA ou os comprovantes funcionarem.

**Resumo:** zero domínio novo necessário.

---

## 3. As contas já criadas localmente vão se perder? — **NÃO, com um plano de migração**

Essa é a pergunta mais importante e a resposta exige cuidado. Vou ser transparente sobre o que acontece:

### O que existe hoje
- Cada aparelho guarda **localmente**: o login (nome + PIN com hash) na chave `financas_app_login`, e os dados financeiros na chave `financas_app_data`.
- Isso **não some** quando publicamos uma versão nova. Atualizar o site **não apaga o `localStorage`** do navegador. Os dados continuam lá.

### O risco real
- O login local de hoje (PIN) **não é a mesma coisa** que o login de nuvem (Auth do Supabase, com e-mail/senha). Ao migrar, a pessoa cria uma conta de verdade na nuvem.
- Sem um plano, alguém poderia criar a conta nova e achar o app "vazio", porque os dados antigos estão no `localStorage` e os novos no banco da nuvem.

### O plano que elimina o risco (migração automática, uma única vez)
Quando a pessoa abrir a versão nova e fizer login na nuvem pela primeira vez, o app:
1. Verifica se existe `localStorage` antigo no aparelho.
2. Se existir e a conta na nuvem estiver vazia, **pergunta:** *"Encontramos dados neste aparelho. Deseja enviá-los para sua conta?"*
3. Com o "sim", ele **sobe tudo** pro banco da nuvem.
4. A partir daí os dados ficam na nuvem (e ainda continuam no aparelho como cópia, até você decidir limpar).

**Conclusão:** ninguém perde nada. O `localStorage` é preservado e vira a ponte da migração. E há ainda a rede de segurança da seção 4.

---

## 4. Dá pra exportar e reimportar os dados? — **JÁ EXISTE e vai continuar**

Boa notícia: o seu app **já faz isso hoje**.
- **Exportar:** o botão de backup gera um arquivo `thayfinance-AAAA-MM-DD.json` com **tudo** dentro.
- **Importar:** o app lê esse arquivo de volta e restaura os dados (com uma confirmação antes de substituir).

No projeto novo isso **continua funcionando** e ganha um papel extra:
- Vira a sua **rede de segurança** antes da migração: você exporta o backup, e só então faz a atualização. Se qualquer coisa der errado, é só reimportar.
- O formato é o mesmo, então **backups antigos continuam válidos**.

**Recomendação:** antes de migrar, em cada aparelho, clique em "Exportar backup" e guarde o arquivo (você já guarda o `meus-dados-thayfinance.json` na Área de Trabalho). Migração com backup na mão = risco praticamente zero.

---

## 5. Quais tecnologias vamos usar e o que cada uma faz

| Tecnologia | Papel | O que faz, em português |
|---|---|---|
| **React + Vite** (já tem) | Interface | É o seu app atual, a tela que a pessoa usa. Continua igual. |
| **GitHub Pages** (já tem) | Hospedagem do site | Onde o app fica publicado, de graça. Não muda. |
| **Supabase** | Backend (guarda-chuva) | A "nuvem" do app. Reúne as 4 peças abaixo num só lugar. |
| ↳ **Supabase Auth** | Login de verdade | Cada pessoa entra com e-mail/senha. É o que permite "eu + outras pessoas" com segurança. |
| ↳ **Supabase Postgres** | Banco de dados | Onde os lançamentos passam a morar (no lugar do `localStorage`). |
| ↳ **Supabase Storage** | Cofre de arquivos | Onde os comprovantes (foto/PDF) ficam guardados, de forma privada. |
| ↳ **Edge Functions** | Mini-servidor seguro | Pequenos programas que rodam na nuvem e seguram as chaves de IA. O navegador nunca toca nelas. |
| **RLS (Row Level Security)** | Tranca do banco | Regra do Postgres que garante: cada pessoa só lê/escreve os **próprios** dados. **Obrigatório** no seu caso. |
| **Whisper** (OpenAI) | Áudio → texto | Transcreve o que você falou. É o padrão do mercado, barato e preciso. |
| **Claude (Haiku 4.5)** | Texto/imagem → lançamento | Entende a frase e monta o lançamento; e lê comprovantes (visão) pra pré-preencher valor/data. |

> **Por que Whisper + Claude e não um só?** Whisper é imbatível e baratíssimo pra transcrever áudio; Claude é excelente pra "entender" e pra ler imagem de comprovante. Dá pra consolidar num provedor só depois, se você quiser simplificar as chaves — anoto como ponto aberto.

---

## 6. Vou ter custo? — **Provavelmente R$ 0 no começo; centavos com uso real**

Vou separar honestamente o que é grátis e o que pode custar.

### Supabase
- **Plano Free:** 500 MB de banco, 1 GB de comprovantes, 50.000 logins/mês, 500 mil execuções de função/mês. **Para o seu uso, isso é muito mais do que o suficiente.** → **R$ 0**
- **Pegadinha do Free:** se o projeto ficar **7 dias sem nenhum acesso**, ele "dorme" e você precisa religar com um clique. Chato, mas de graça.
- **Plano Pro: US$ 25/mês** (~R$ 135) — só vale a pena quando tiver bastante gente usando, ou se quiser que nunca "durma". **Você não precisa disso agora.**

### IA (paga por uso, o que você consome)
São valores minúsculos por lançamento:
- **Transcrição (Whisper):** ~US$ 0,006 por minuto de áudio. Um áudio de 10 segundos custa ~**US$ 0,001** (um décimo de centavo).
- **Entender o texto (Claude Haiku):** cada lançamento usa pouquíssimo. Custa **frações de centavo**.
- **Ler comprovante (Claude visão):** também centavos por imagem.

**Estimativa realista:** se você lançar **100 áudios + 50 comprovantes por mês**, o custo de IA fica em torno de **US$ 0,30 a US$ 1,00/mês** (~R$ 2 a R$ 6). É preciso colocar um cartão nos painéis da OpenAI e da Anthropic, mas dá pra **definir um limite mensal** (ex: "não passe de US$ 5") pra você nunca tomar susto.

### Domínio
- Nenhum custo (seção 2). Só se você **quiser** um domínio bonito: ~R$ 40/ano. Opcional.

### Resumo de custos
| Item | Custo |
|---|---|
| Supabase (Free) | R$ 0 |
| IA por uso (uso pessoal) | ~R$ 2 a R$ 6/mês |
| Domínio | R$ 0 (opcional ~R$ 40/ano) |
| **Total realista** | **alguns reais por mês, ou zero se usar pouco** |

---

## 7. Segurança — o que vamos blindar desde o dia 1

Como vai ter **mais de uma pessoa** usando, segurança não é opcional. Pontos que serão tratados desde o começo:

1. **RLS ligado desde o primeiro dia.** No banco, toda linha carimba o dono (`user_id`) e a regra é: você só vê o que é seu. (Foi exatamente um RLS faltando que causou o 401 do Premium Beef — aqui já nasce certo.)
2. **Chaves de IA só no servidor.** Ficam guardadas como "segredo" na Edge Function, nunca no app.
3. **Comprovantes privados.** O cofre (Storage) é fechado; acesso só por **link temporário que expira**. Comprovante tem valor, CPF, estabelecimento — é dado sensível (LGPD).
4. **Validação do que a IA devolve.** Antes de gravar, o servidor confere se o JSON faz sentido (a IA às vezes inventa campo). Lixo não entra no banco.
5. **Limite de abuso (rate limiting).** Trava pra ninguém disparar mil chamadas e estourar sua conta de IA.
6. **Limite de upload.** Só foto/PDF, com tamanho máximo, pra não subirem arquivo malicioso.

---

## 8. O que fica para depois (evolução futura)
- **Open Finance** (conectar bancos automaticamente, como o Meu Assessor): exige ser regulado pelo Banco Central **ou** contratar um intermediário (Pluggy, Belvo, Klavi) — tem custo mensal e exige CNPJ/contrato. **Adiado.**
- **Agenda, projetos, reuniões** (outras funções do Meu Assessor): fora do foco do Thayfinance por enquanto.

---

## 9. Pontos em aberto pra você decidir quando voltar
1. **Provedor de IA:** mantém Whisper (OpenAI) + Claude, ou consolida num provedor só pra ter uma chave só?
2. **Login:** e-mail/senha basta, ou quer também "entrar com Google"?
3. **Migração:** quer que o app migre o `localStorage` automático no primeiro login, ou prefere migrar via importação do backup JSON (mais manual, mais controlado)?

---

## 10. Resumo de uma linha
É **totalmente possível**, **não precisa de domínio novo**, **ninguém perde dados** (export/import já existe e vira a ponte), as tecnologias são **Supabase + Whisper + Claude**, e o **custo é praticamente zero no começo** (alguns reais/mês com uso real). Quando você quiser, eu entrego o schema, as funções e o passo a passo no PowerShell.
