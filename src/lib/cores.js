

/* ============================================================
   CORES DAS CATEGORIAS (gradientes)
   Cada categoria tem um gradiente: o escolhido pela pessoa (campo `cor`,
   guardado junto da categoria) ou um SUGERIDO pelo nome — assim até as
   categorias criadas pelo robô do Telegram ganham cor na hora.
   ============================================================ */

export const GRADIENTES = [
  { id: "esmeralda", nome: "Esmeralda", de: "#059669", para: "#34d399" },
  { id: "turquesa", nome: "Turquesa", de: "#0d9488", para: "#2dd4bf" },
  { id: "oceano", nome: "Oceano", de: "#0284c7", para: "#38bdf8" },
  { id: "ceu", nome: "Céu", de: "#2563eb", para: "#60a5fa" },
  { id: "indigo", nome: "Índigo", de: "#4f46e5", para: "#818cf8" },
  { id: "roxo", nome: "Roxo", de: "#7c3aed", para: "#a78bfa" },
  { id: "fucsia", nome: "Fúcsia", de: "#c026d3", para: "#e879f9" },
  { id: "rosa", nome: "Rosa", de: "#db2777", para: "#f472b6" },
  { id: "vermelho", nome: "Vermelho", de: "#dc2626", para: "#f87171" },
  { id: "tangerina", nome: "Tangerina", de: "#ea580c", para: "#fb923c" },
  { id: "ambar", nome: "Âmbar", de: "#d97706", para: "#fbbf24" },
  { id: "lima", nome: "Lima", de: "#65a30d", para: "#a3e635" },
  { id: "grafite", nome: "Grafite", de: "#475569", para: "#94a3b8" },
];
export const gradPorId = (id) => GRADIENTES.find((g) => g.id === id) || null;

// Sugere um gradiente pelo NOME da categoria (palavras-chave, sem acentos).
// Sem palavra conhecida → hash determinístico (mesmo nome = mesma cor sempre).
export function gradientePorNome(nome) {
  const n = (nome || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const tem = (...ks) => ks.some((k) => n.includes(k));
  if (tem("salario", "renda", "faturamento", "venda", "receb", "pagamento", "pix")) return gradPorId("esmeralda");
  if (tem("invest", "poupanca", "reserva", "aplicacao", "cripto", "acoes")) return gradPorId("turquesa");
  if (tem("mercado", "supermerc", "feira", "aliment", "comida", "restaur", "lanche", "padaria", "ifood", "pizza", "acougue", "hortifr")) return gradPorId("tangerina");
  if (tem("saude", "farm", "medic", "hospital", "consulta", "exame", "dentista", "remedio")) return gradPorId("rosa");
  if (tem("transp", "uber", "combust", "gasolina", "carro", "onibus", "taxi", "99", "metro", "passagem", "pedagio", "estaciona", "moto")) return gradPorId("indigo");
  if (tem("casa", "moradia", "alug", "condom", "imovel", "reforma", "movel", "moveis")) return gradPorId("ambar");
  if (tem("agua", "luz", "energia", "internet", "telefone", "celular", "wifi", "gas", "conta")) return gradPorId("ceu");
  if (tem("lazer", "cinema", "viagem", "festa", "show", "passeio", "streaming", "netflix", "spotify", "jogo")) return gradPorId("roxo");
  if (tem("educ", "escola", "curso", "faculdade", "livro", "mensalidade")) return gradPorId("oceano");
  if (tem("roupa", "vestu", "moda", "sapato", "calcad", "beleza", "salao", "cabelo", "estetica", "unha", "manicure")) return gradPorId("fucsia");
  if (tem("pet", "animal", "veterin", "racao")) return gradPorId("lima");
  if (tem("imposto", "taxa", "juro", "multa", "tarifa", "divida", "emprestimo", "cartao")) return gradPorId("vermelho");
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (Math.imul(31, h) + n.charCodeAt(i)) | 0;
  return GRADIENTES[Math.abs(h) % GRADIENTES.length];
}

// Gradiente FINAL de uma categoria: o escolhido (cor) ou o sugerido pelo nome.
export const gradCat = (cat) => gradPorId(cat?.cor) || gradientePorNome(cat?.nome);
// CSS pronto: linear-gradient do gradiente g
export const cssGrad = (g) => `linear-gradient(135deg, ${g.de}, ${g.para})`;
