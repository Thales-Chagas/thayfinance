<div align="center">

# 💚 Thayfinance

### Controle financeiro pessoal e empresarial — simples, bonito e no seu bolso.

Um app web (PWA) que organiza **duas contas em um só lugar** — a sua vida pessoal e a do seu negócio — com lançamentos, metas, relatórios e até **IA que lê comprovantes por foto ou áudio**.

<br>

[![Acessar o app](https://img.shields.io/badge/▶_Acessar_o_app-www.thayfinance.com-059669?style=for-the-badge&labelColor=065f46)](https://www.thayfinance.com)

<br>

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white&style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white&style=flat-square)
![PWA](https://img.shields.io/badge/PWA-instalável-5A0FC8?logo=pwa&logoColor=white&style=flat-square)
![Segurança](https://img.shields.io/badge/Segurança-RLS_por_usuário-059669?logo=letsencrypt&logoColor=white&style=flat-square)
![HTTPS](https://img.shields.io/badge/HTTPS-obrigatório-2ea44f?logo=letsencrypt&logoColor=white&style=flat-square)

</div>

---

## ✨ O que é

O **Thayfinance** nasceu de três planilhas de Excel e virou um aplicativo completo de controle financeiro. Ele funciona **instalado no celular ou no computador**, roda **offline** e **sincroniza na nuvem** com segurança — cada pessoa enxerga apenas os próprios dados.

O grande diferencial: você alterna entre **dois ambientes** com um toque —

| 👤 **Pessoal** | 🏢 **Empresarial** |
|:--|:--|
| Suas receitas, despesas e metas do dia a dia | Faturamento, custos, clientes, fornecedores e centro de custos |

---

## 🚀 Funcionalidades

### 📊 Gestão do dia a dia
- **Dashboard** com cards de resumo e gráficos (faturamento × despesas, distribuição por categoria)
- **Receitas & Despesas** com data, categoria, valor, descrição e status
- **Contas a Pagar/Receber** com alertas de vencimento
- **Fluxo de Caixa** por dia, semana, mês e ano
- **Metas** em cards com anel de progresso
- **Categorias** coloridas, com gradientes personalizados
- **Relatórios** mensais e anuais, com exportação em **PDF** e **Excel (CSV)**

### 🏢 Exclusivo do modo empresarial
- **Clientes** e **Fornecedores**
- **Centro de Custos** e apuração de lucro operacional

### 🤖 Lançamento por Inteligência Artificial
- 📷 **Foto do comprovante** → a IA lê valor, data e estabelecimento e já lança
- 🎙️ **Áudio** → você fala "gastei 50 no mercado" e ela transforma em lançamento
- 💬 **Bot do Telegram** → mande foto, áudio ou texto e o gasto entra sozinho na sua conta

### 🔒 Conta, nuvem e privacidade
- **Login na nuvem** (e-mail e senha) com sincronização automática entre aparelhos
- **Trava local** por PIN, foto e nome — só sua, direto no aparelho
- **Backup automático** a cada 3 dias, além do backup manual (Exportar / Importar)
- **Modo escuro** 🌙 e instalação como app (PWA)

---

## 🛠️ Tecnologias

<table>
<tr>
<td valign="top" width="50%">

**Frontend**
- ⚛️ React 18 + Vite 6
- 🎨 Tailwind CSS v4
- 📈 Recharts (gráficos)
- 🧩 Lucide (ícones)
- 📱 vite-plugin-pwa (offline + instalável)

</td>
<td valign="top" width="50%">

**Backend & IA**
- 🟢 Supabase (Auth · Postgres · Storage)
- 🔐 Row Level Security por usuário
- ⚡ Edge Functions (Deno)
- 🧠 Claude (visão) + OpenAI Whisper (áudio)

</td>
</tr>
</table>

---

## 🧱 Arquitetura

```
┌──────────────────────────┐        ┌───────────────────────────────┐
│      Thayfinance (PWA)    │        │            Supabase           │
│  React · Tailwind · Vite  │  ⇄     │  Auth · Postgres (RLS) ·      │
│  Funciona offline         │        │  Storage privado · Edge Fns   │
└──────────────────────────┘        └───────────────┬───────────────┘
            ▲                                        │
            │ instalável no celular/PC               ▼
     www.thayfinance.com                   🤖 IA (Claude · Whisper)
                                           💬 Bot do Telegram
```

> Todo o app da interface vive num único arquivo — [`src/App.jsx`](src/App.jsx) — por escolha de projeto.

---

## 💻 Rodando localmente

```bash
npm install     # só na primeira vez
npm run dev      # abre em http://localhost:5173
npm run build    # gera a versão final na pasta dist/
```

---

## 🌐 Publicação

Cada `git push` na branch **`main`** publica automaticamente via **GitHub Actions** → **GitHub Pages**, no domínio próprio **[www.thayfinance.com](https://www.thayfinance.com)** (com HTTPS).

---

## 🛡️ Segurança & privacidade

> **A segurança dos seus dados é a prioridade número um do Thayfinance.** Dinheiro é assunto sério, e por isso cada camada do app foi pensada para que **só você** tenha acesso à sua vida financeira — nem mesmo outra pessoa com uma conta no app consegue chegar perto dos seus dados.

O app passa por **revisões de segurança e testes de invasão (pentests) periódicos**. Estas são as proteções em vigor:

- 🔐 **Isolamento total entre contas** — *Row Level Security* (`auth.uid() = user_id`) em **todas** as tabelas do banco. No nível do banco de dados, é impossível um usuário ler ou alterar os dados de outro.
- 🗄️ **Comprovantes em cofre privado** — armazenamento separado por pasta de cada usuário, sem acesso público.
- ⚡ **Funções sensíveis blindadas** — cada Edge Function exige autenticação real ou um segredo próprio; chamadas anônimas são recusadas (verificado por teste real → `401`).
- 🔑 **Nenhum segredo no código** — apenas a chave *publishable* (pública por natureza e inofensiva sozinha) fica no app; toda credencial real vive só no servidor, jamais no repositório.
- 🧹 **Sem dados reais versionados** — os seus lançamentos nunca entram no Git; ficam apenas no seu aparelho e na sua nuvem privada.
- 🔒 **HTTPS obrigatório** e **trava local por PIN** — proteção do transporte e do aparelho.
- 🛟 **Backup automático** a cada 3 dias, para você nunca perder nada.
- 🧯 **Defesas contra ataques comuns** — escape de HTML na exportação em PDF e proteção contra injeção de fórmula no CSV.

_Encontrou algo? Relate de forma responsável — vulnerabilidades são levadas a sério e corrigidas com prioridade._

---

<div align="center">
<br>

Feito com 💚 para organizar a vida financeira de um jeito leve.

**[www.thayfinance.com](https://www.thayfinance.com)**

</div>
