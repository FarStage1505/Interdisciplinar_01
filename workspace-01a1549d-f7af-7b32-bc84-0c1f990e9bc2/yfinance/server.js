import express from "express";
import {
  ensureAutomation,
  processDue,
  refreshBudgetAlerts,
  applyRecurringAction,
  nextOccurrence,
} from "./lib/automation.js";
import { createReport, normalizeReport, reportNames } from "./lib/reports.js";
import { reportIntent } from "./lib/report-intent.js";
import { curriculum, quizPassScore } from "./src/curriculum.js";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
if (fs.existsSync(path.join(root, ".env")))
  process.loadEnvFile(path.join(root, ".env"));
const file = path.join(root, "data", "database.json");
fs.mkdirSync(path.dirname(file), { recursive: true });
let db = fs.existsSync(file)
  ? JSON.parse(fs.readFileSync(file, "utf8"))
  : { users: [], sessions: [] };
const persist = () => {
  fs.writeFileSync(file + ".tmp", JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(file + ".tmp", file);
};
function maintainUser(user) {
  const due = processDue(user.state);
  const alerted = refreshBudgetAlerts(user.state);
  if (due.changed || alerted) persist();
}
function maintainAll() {
  let changed = false;
  for (const user of db.users) {
    const due = processDue(user.state);
    const alerts = refreshBudgetAlerts(user.state);
    changed = changed || due.changed || alerts;
  }
  if (changed) persist();
}
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.json({ limit: "200kb" }));
const hash = (t) => createHash("sha256").update(t).digest("hex");
const dateNow = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
function initial(demo = false) {
  const m = dateNow().slice(0, 7);
  const cats = [
    "Alimentação",
    "Transporte",
    "Lazer",
    "Educação",
    "Saúde",
    "Moradia",
    "Compras",
    "Outros",
  ].map((name, i) => ({
    id: randomUUID(),
    name,
    type: "expense",
    color: [
      "#3b82f6",
      "#fb4961",
      "#ac6ae8",
      "#638aff",
      "#2ecbb1",
      "#ff9e51",
      "#f27aa9",
      "#8e919b",
    ][i],
    budget: [900, 400, 300, 200, 250, 1600, 300, 0][i],
  }));
  cats.push(
    ...[
      "Salário",
      "Freelance",
      "Investimentos",
      "Presente",
      "Outras receitas",
    ].map((name) => ({
      id: randomUUID(),
      name,
      type: "income",
      color: "#10c885",
      budget: 0,
    })),
  );
  return {
    profile: { name: demo ? "Alex" : "", email: "" },
    settings: { dark: true, hide: false },
    categories: cats,
    transactions: demo
      ? [
          ["Salário mensal", 5200, "income", "Salário", 5],
          ["Projeto freelance", 850, "income", "Freelance", 6],
          ["Aluguel", 1450, "expense", "Moradia", 2],
          ["Compras do mês", 386.9, "expense", "Alimentação", 4],
          ["Transporte da semana", 120, "expense", "Transporte", 6],
          ["Cinema com amigos", 65, "expense", "Lazer", 5],
          ["Curso de inglês", 189.9, "expense", "Educação", 3],
          ["Farmácia", 78.5, "expense", "Saúde", 6],
        ].map(([description, amount, type, category, day]) => ({
          id: randomUUID(),
          description,
          amount,
          type,
          categoryId: cats.find((c) => c.name === category).id,
          date: `${m}-${String(day).padStart(2, "0")}`,
          payment: "Pix",
          notes: "",
        }))
      : [],
    goals: demo
      ? [
          {
            id: randomUUID(),
            name: "Reserva de emergência",
            category: "Reserva",
            target: 15000,
            current: 4200,
            date: "2027-06-30",
            color: "#3b82f6",
          },
          {
            id: randomUUID(),
            name: "Minha próxima viagem",
            category: "Viagens",
            target: 5000,
            current: 1850,
            date: "2027-03-01",
            color: "#a375ec",
          },
          {
            id: randomUUID(),
            name: "Notebook novo",
            category: "Eletrônicos",
            target: 6500,
            current: 2100,
            date: "2027-04-30",
            color: "#ff9e51",
          },
        ]
      : [],
    completed: [],
    learning: {},
    recurring: [],
    notifications: [],
    budgetAlerts: {},
    challenges: [],
    chat: [],
  };
}
function session(user) {
  const token = randomBytes(32).toString("hex");
  db.sessions = db.sessions.filter((s) => s.expires > Date.now());
  db.sessions.push({
    hash: hash(token),
    userId: user.id,
    expires: Date.now() + 30 * 86400000,
  });
  persist();
  return token;
}
function userFor(req) {
  const t = req.headers.authorization?.replace(/^Bearer /, "");
  const s =
    t && db.sessions.find((s) => s.hash === hash(t) && s.expires > Date.now());
  return s && db.users.find((u) => u.id === s.userId);
}
function output(u) {
  maintainUser(u);
  return {
    state: {
      ...u.state,
      learning: u.state.learning || {},
      recurring: u.state.recurring.map((r) => ({
        ...r,
        nextDue: r.status === "active" ? nextOccurrence(r) : null,
      })),
    },
    demo: u.demo,
    aiMode: !!process.env.AI_API_KEY,
  };
}
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const text = (v, max = 120) => {
  if (typeof v !== "string" || !v.trim() || v.length > max)
    throw fail("Preencha os campos corretamente.");
  return v.trim();
};
const money = (v, zero = false) => {
  if (!["string", "number"].includes(typeof v))
    throw fail("Informe um valor numérico válido.");
  const n = Number(v);
  if (v === "" || !Number.isFinite(n) || n < (zero ? 0 : 0.01) || n > 1e12)
    throw fail("Informe um valor válido.");
  return Math.round(n * 100) / 100;
};
const date = (v) => {
  if (
    typeof v !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw fail("Data inválida.");
  return v;
};
const attempts = new Map();
app.use("/api/auth", (req, res, next) => {
  const key = req.ip;
  const a = attempts.get(key) || { count: 0, start: Date.now() };
  if (Date.now() - a.start > 600000) {
    a.count = 0;
    a.start = Date.now();
  }
  a.count++;
  attempts.set(key, a);
  if (a.count > 50)
    return res
      .status(429)
      .json({ error: "Muitas tentativas. Tente novamente em 10 minutos." });
  next();
});
app.post("/api/bootstrap", (req, res) => {
  let user = userFor(req);
  let token;
  if (!user) {
    user = { id: randomUUID(), demo: true, state: initial(true) };
    db.users.push(user);
    token = session(user);
  }
  res.json({ ...output(user), token });
});
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const name = text(req.body.name, 80);
    const email = text(req.body.email, 150).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw fail("E-mail inválido.");
    const password = text(req.body.password, 128);
    if (password.length < 8)
      throw fail("A senha precisa ter pelo menos 8 caracteres.");
    if (db.users.some((u) => u.email === email))
      throw fail("Este e-mail já está cadastrado.");
    const state = initial();
    state.profile = { name, email };
    const u = {
      id: randomUUID(),
      email,
      password: await bcrypt.hash(password, 12),
      demo: false,
      state,
    };
    if (db.users.some((existing) => existing.email === email))
      throw fail("Este e-mail já está cadastrado.");
    db.users.push(u);
    res.json({ ...output(u), token: session(u) });
  } catch (e) {
    next(e);
  }
});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = text(req.body.email, 150).toLowerCase();
    const password = text(req.body.password, 128);
    const u = db.users.find((u) => u.email === email);
    if (!u || !(await bcrypt.compare(password, u.password)))
      throw fail("E-mail ou senha incorretos.", 401);
    res.json({ ...output(u), token: session(u) });
  } catch (e) {
    next(e);
  }
});
app.use("/api", (req, res, next) => {
  req.user = userFor(req);
  if (!req.user)
    return res
      .status(401)
      .json({ error: "Sua sessão expirou. Entre novamente." });
  maintainUser(req.user);
  next();
});
app.post("/api/logout", (req, res) => {
  db.sessions = db.sessions.filter(
    (s) => s.hash !== hash(req.headers.authorization.replace(/^Bearer /, "")),
  );
  persist();
  res.json({ ok: true });
});
app.get("/api/state", (req, res) => res.json(output(req.user)));
app.post("/api/action", (req, res, next) => {
  try {
    const { action, payload: p = {} } = req.body;
    const s = structuredClone(req.user.state);
    const find = (list, id) => {
      const v = list.find((x) => x.id === id);
      if (!v) throw fail("Registro não encontrado.", 404);
      return v;
    };
    if (action === "transaction.save") {
      const type = p.type;
      if (!["income", "expense"].includes(type)) throw fail("Tipo inválido.");
      const cat = find(s.categories, p.categoryId);
      if (cat.type !== type) throw fail("Categoria incompatível.");
      const original = p.id ? find(s.transactions, p.id) : null;
      const item = {
        ...(original?.recurringId
          ? {
              recurringId: original.recurringId,
              occurrenceKey: original.occurrenceKey,
              generatedAt: original.generatedAt,
            }
          : {}),
        id: original?.id || randomUUID(),
        type,
        description: text(p.description),
        amount: money(p.amount),
        date: date(p.date),
        categoryId: cat.id,
        payment: text(p.payment || "Pix", 40),
        notes: typeof p.notes === "string" ? p.notes.slice(0, 1000) : "",
      };
      s.transactions = s.transactions
        .filter((x) => x.id !== item.id)
        .concat(item);
    } else if (action === "transaction.delete") {
      find(s.transactions, p.id);
      s.transactions = s.transactions.filter((x) => x.id !== p.id);
    } else if (typeof action === "string" && action.startsWith("recurring.")) {
      applyRecurringAction(s, action, p, { fail, text, money });
      processDue(s);
    } else if (action === "notification.read") {
      ensureAutomation(s);
      const notification = find(s.notifications, p.id);
      notification.readAt ||= new Date().toISOString();
    } else if (action === "notification.readAll") {
      ensureAutomation(s);
      for (const n of s.notifications) n.readAt ||= new Date().toISOString();
    } else if (action === "goal.save") {
      const item = {
        id: p.id ? find(s.goals, p.id).id : randomUUID(),
        name: text(p.name),
        category: text(p.category, 60),
        target: money(p.target),
        current: money(p.current ?? 0, true),
        date: p.date ? date(p.date) : "",
        color: /^#[a-f0-9]{6}$/i.test(p.color) ? p.color : "#3b82f6",
      };
      s.goals = s.goals.filter((x) => x.id !== item.id).concat(item);
    } else if (action === "goal.deposit") {
      const g = find(s.goals, p.id);
      g.current = Math.round((g.current + money(p.amount)) * 100) / 100;
      if (g.current > 1e12) throw fail("Valor acima do limite.");
    } else if (action === "goal.delete") {
      find(s.goals, p.id);
      s.goals = s.goals.filter((x) => x.id !== p.id);
    } else if (action === "category.save") {
      if (!["income", "expense"].includes(p.type)) throw fail("Tipo inválido.");
      const name = text(p.name, 50);
      if (
        s.categories.some(
          (c) =>
            c.name.toLowerCase() === name.toLowerCase() &&
            c.type === p.type &&
            c.id !== p.id,
        )
      )
        throw fail("Essa categoria já existe.");
      const old = p.id ? find(s.categories, p.id) : null;
      if (
        old &&
        old.type !== p.type &&
        (s.transactions.some((t) => t.categoryId === p.id) ||
          (s.recurring || []).some((r) => r.categoryId === p.id))
      )
        throw fail("O tipo de uma categoria em uso não pode ser alterado.");
      const item = {
        id: old?.id || randomUUID(),
        name,
        type: p.type,
        budget: money(p.budget || 0, true),
        color: /^#[a-f0-9]{6}$/i.test(p.color) ? p.color : "#3b82f6",
      };
      s.categories = s.categories.filter((c) => c.id !== item.id).concat(item);
    } else if (action === "category.delete") {
      find(s.categories, p.id);
      if (
        s.transactions.some((t) => t.categoryId === p.id) ||
        (s.recurring || []).some((r) => r.categoryId === p.id)
      )
        throw fail(
          "Esta categoria tem lançamentos ou recorrências. Reclassifique os lançamentos; categorias vinculadas ao histórico de regras devem ser mantidas.",
        );
      s.categories = s.categories.filter((c) => c.id !== p.id);
    } else if (action === "budget.save") {
      find(s.categories, p.id).budget = money(p.budget, true);
    } else if (action === "profile.save") {
      s.profile.name = text(p.name, 80);
    } else if (action === "settings.save") {
      s.settings = {
        dark: typeof p.dark === "boolean" ? p.dark : s.settings.dark,
        hide: typeof p.hide === "boolean" ? p.hide : s.settings.hide,
      };
    } else if (typeof action === "string" && action.startsWith("learning.")) {
      const id = Number(p.id);
      if (!Number.isInteger(id) || !curriculum[id])
        throw fail("Aula inválida.");
      s.learning ||= {};
      const progress = (s.learning[id] ||= {});
      const content = curriculum[id];
      const now = new Date().toISOString();
      if (action === "learning.visit") {
        progress.visitedAt = now;
      } else if (action === "learning.challenge.start") {
        progress.challenge ||= {
          steps: [],
          reflection: "",
          startedAt: now,
          completedAt: null,
        };
      } else if (action.startsWith("learning.challenge.")) {
        const c = progress.challenge;
        if (!c)
          throw fail("Comece o desafio antes de registrar seu progresso.");
        if (action === "learning.challenge.step") {
          if (
            !Number.isInteger(p.step) ||
            p.step < 0 ||
            p.step >= content.challenge.steps.length ||
            typeof p.done !== "boolean"
          )
            throw fail("Etapa inválida.");
          c.steps = p.done
            ? [...new Set([...c.steps, p.step])].sort()
            : c.steps.filter((step) => step !== p.step);
          if (!p.done) c.completedAt = null;
        } else if (
          action === "learning.challenge.note" ||
          action === "learning.challenge.complete"
        ) {
          if (typeof p.reflection !== "string" || p.reflection.length > 2000)
            throw fail("A reflexão deve ter até 2.000 caracteres.");
          const reflection = p.reflection.trim();
          if (action === "learning.challenge.complete") {
            if (c.steps.length !== content.challenge.steps.length)
              throw fail(
                "Realize e marque todas as etapas para concluir o desafio.",
              );
            if (reflection.length < 20)
              throw fail("Escreva uma reflexão com pelo menos 20 caracteres.");
            c.completedAt = now;
          }
          c.reflection = reflection;
          if (c.completedAt && reflection.length < 20) c.completedAt = null;
        } else if (action === "learning.challenge.reopen") {
          c.completedAt = null;
        } else throw fail("Ação de desafio inválida.");
        c.updatedAt = now;
      } else if (action.startsWith("learning.quiz.")) {
        const q = (progress.quiz ||= {
          draft: null,
          attempts: 0,
          bestScore: 0,
          last: null,
          history: [],
        });
        if (action === "learning.quiz.answer") {
          if (
            !Number.isInteger(p.question) ||
            !content.quiz[p.question] ||
            !Number.isInteger(p.answer) ||
            p.answer < 0 ||
            p.answer >= content.quiz[p.question].options.length
          )
            throw fail("Resposta inválida.");
          if (q.last && q.draft === null)
            throw fail("Inicie uma nova tentativa antes de alterar respostas.");
          q.draft ||= Array(content.quiz.length).fill(null);
          q.draft[p.question] = p.answer;
          q.updatedAt = now;
        } else if (action === "learning.quiz.retry") {
          q.draft = Array(content.quiz.length).fill(null);
          q.updatedAt = now;
        } else if (action === "learning.quiz.submit") {
          if (
            !q.draft ||
            q.draft.length !== content.quiz.length ||
            q.draft.some(
              (answer, index) =>
                !Number.isInteger(answer) ||
                answer < 0 ||
                answer >= content.quiz[index].options.length,
            )
          )
            throw fail("Responda todas as perguntas antes de corrigir o quiz.");
          const score = q.draft.reduce(
            (total, answer, index) =>
              total + Number(answer === content.quiz[index].answer),
            0,
          );
          q.attempts += 1;
          q.bestScore = Math.max(q.bestScore, score);
          q.last = {
            answers: [...q.draft],
            score,
            total: content.quiz.length,
            passed: score >= quizPassScore,
            submittedAt: now,
            attempt: q.attempts,
          };
          q.history = [...q.history, q.last].slice(-20);
          q.draft = null;
        } else throw fail("Ação de quiz inválida.");
      } else throw fail("Ação de aprendizagem inválida.");
    } else if (action === "lesson.toggle") {
      const id = Number(p.id);
      if (!Number.isInteger(id) || id < 0 || id > 16)
        throw fail("Aula inválida.");
      s.completed = s.completed.includes(id)
        ? s.completed.filter((x) => x !== id)
        : [...s.completed, id];
    } else if (action === "challenge.toggle") {
      const id = Number(p.id);
      if (![0, 1, 2].includes(id)) throw fail("Desafio inválido.");
      s.challenges = s.challenges.includes(id)
        ? s.challenges.filter((x) => x !== id)
        : [...s.challenges, id];
    } else if (action === "chat.clear") s.chat = [];
    else throw fail("Ação desconhecida.");
    refreshBudgetAlerts(s);
    req.user.state = s;
    persist();
    res.json(output(req.user));
  } catch (e) {
    next(e);
  }
});
const exportingUsers = new Set();
app.post("/api/reports", async (req, res, next) => {
  if (exportingUsers.has(req.user.id))
    return res.status(429).json({
      error:
        "Uma planilha já está sendo gerada para esta conta. Aguarde a conclusão.",
    });
  exportingUsers.add(req.user.id);
  try {
    const snapshot = structuredClone(req.user.state);
    const report = await createReport(snapshot, req.body);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${report.filename}"`,
    );
    res.send(report.buffer);
  } catch (error) {
    next(error);
  } finally {
    exportingUsers.delete(req.user.id);
  }
});
app.post("/api/chat", async (req, res, next) => {
  try {
    const message = text(req.body.message, 2000),
      s = req.user.state;
    const intent = reportIntent(message, s);
    if (intent) {
      let content,
        report = null;
      if (intent.clarification) content = intent.clarification;
      else {
        try {
          report = normalizeReport(intent, s);
          const period = `${report.start.split("-").reverse().join("/")} a ${report.end.split("-").reverse().join("/")}`;
          const category = report.categoryId
            ? ` Categoria: ${s.categories.find((c) => c.id === report.categoryId).name}.`
            : "";
          content = `Preparei a opção de download: ${reportNames[report.kind]}. Período dos lançamentos: ${period}.${category} O Excel será gerado com os registros atuais da sua conta ao clicar em Baixar Excel. Metas e recorrências, quando incluídas, mostram a posição atual. Você pode ajustar os filtros antes de baixar.`;
        } catch (error) {
          content = error.message;
        }
      }
      s.chat.push(
        { id: randomUUID(), role: "user", content: message },
        {
          id: randomUUID(),
          role: "assistant",
          content,
          ...(report ? { report } : {}),
        },
      );
      s.chat = s.chat.slice(-100);
      persist();
      return res.json({ ...output(req.user), mode: "local-report" });
    }
    const m = dateNow().slice(0, 7);
    const ts = s.transactions.filter((t) => t.date.startsWith(m));
    const income = ts
        .filter((t) => t.type === "income")
        .reduce((n, t) => n + t.amount, 0),
      expense = ts
        .filter((t) => t.type === "expense")
        .reduce((n, t) => n + t.amount, 0);
    const fmt = (n) =>
      n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    let reply;
    const q = message.toLowerCase();
    let mode = "local";
    if (process.env.AI_API_KEY) {
      const response = await fetch(
        process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.AI_API_KEY}`,
          },
          body: JSON.stringify({
            model: process.env.AI_MODEL || "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Você é um educador financeiro brasileiro. Não prometa retornos ou dê recomendações personalizadas de ativos. Dados agregados do usuário neste mês: receitas ${income}, despesas ${expense}. Metas: ${JSON.stringify(s.goals.map((g) => ({ nome: g.name, objetivo: g.target, acumulado: g.current })))}. Responda em português com clareza e brevidade.`,
              },
              ...s.chat
                .slice(-8)
                .map((c) => ({ role: c.role, content: c.content })),
              { role: "user", content: message },
            ],
            max_tokens: 600,
          }),
          signal: AbortSignal.timeout(25000),
        },
      );
      if (!response.ok)
        throw fail(
          "O serviço de IA está indisponível. Tente novamente mais tarde.",
          502,
        );
      const data = await response.json();
      reply = data.choices?.[0]?.message?.content;
      if (!reply) throw fail("Não foi possível obter uma resposta.", 502);
      mode = "ai";
    } else if (/reserva|emergência|emergencia/.test(q))
      reply = `Uma reserva de emergência deve priorizar segurança e liquidez. Como referência educativa, 3 a 6 meses das suas despesas registradas equivalem a ${fmt(expense * 3)} a ${fmt(expense * 6)}. Esse valor só é representativo se você já registrou todas as despesas do mês. Comece com uma meta pequena e uma contribuição que caiba no orçamento.`;
    else if (/meta|objetivo|guardar|economizar/.test(q))
      reply = `Seu saldo registrado neste mês é ${fmt(income - expense)}. ${s.goals.length ? `Você tem ${s.goals.length} meta(s), com ${fmt(s.goals.reduce((n, g) => n + g.current, 0))} acumulados.` : "Crie sua primeira meta na seção Metas."} Defina um prazo realista, divida o valor restante pelos meses disponíveis e só reserve o que não compromete suas despesas essenciais. Os aportes nas metas são controles separados e não descontam automaticamente do saldo.`;
    else if (/invest|juros|renda fixa/.test(q))
      reply =
        "Antes de investir, organize o orçamento, avalie dívidas caras e construa uma reserva. Compare risco, liquidez, custos e tributação; rentabilidade passada não garante retorno futuro. Juros compostos são juros calculados sobre o saldo acumulado. Visite a trilha Primeiros investimentos para aprender com exemplos.";
    else if (/gasto|despesa|anal|saldo|renda|orçamento|orcamento/.test(q)) {
      const cats = s.categories
        .filter((c) => c.type === "expense")
        .map((c) => ({
          ...c,
          total: ts
            .filter((t) => t.categoryId === c.id)
            .reduce((n, t) => n + t.amount, 0),
        }))
        .sort((a, b) => b.total - a.total);
      reply = `Neste mês, você registrou ${fmt(income)} de receitas e ${fmt(expense)} de despesas. O saldo é ${fmt(income - expense)}.${cats[0]?.total ? ` A maior categoria de gasto é ${cats[0].name}: ${fmt(cats[0].total)}.` : ""} ${expense > income ? "As despesas superam as receitas registradas. Revise gastos não essenciais e confira se todas as entradas foram lançadas." : "Compare seus gastos com os limites em Categorias e planeje uma quantia para suas metas."}`;
    } else
      reply =
        "Estou no modo de análise local, sem IA generativa conectada. Consigo resumir seus gastos e explicar orçamento, metas, reserva de emergência e investimentos. Experimente: “Analise meus gastos” ou “Como criar uma reserva?”. As respostas são educativas e baseadas apenas nos registros deste aplicativo.";
    req.user.state.chat.push(
      { id: randomUUID(), role: "user", content: message },
      { id: randomUUID(), role: "assistant", content: reply },
    );
    req.user.state.chat = req.user.state.chat.slice(-100);
    persist();
    res.json({ ...output(req.user), mode });
  } catch (e) {
    next(e);
  }
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint não encontrado." }),
);
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({
    error: err.status
      ? err.message
      : "Não foi possível salvar. Tente novamente.",
  });
});
if (
  process.env.NODE_ENV === "production" ||
  process.argv.includes("--production")
) {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: {
      middlewareMode: true,
      allowedHosts: true,
      fs: {
        deny: [
          "**/.env*",
          "**/data/**",
          "**/server.js",
          "**/lib/**",
          "**/tests*.mjs",
        ],
      },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
maintainAll();
const automationTimer = setInterval(() => {
  try {
    maintainAll();
  } catch (error) {
    console.error("Falha na verificação de recorrências:", error.message);
  }
}, 60000);
automationTimer.unref();
app.listen(process.env.PORT || 3000, "0.0.0.0", () =>
  console.log("Y Finance disponível na porta " + (process.env.PORT || 3000)),
);
