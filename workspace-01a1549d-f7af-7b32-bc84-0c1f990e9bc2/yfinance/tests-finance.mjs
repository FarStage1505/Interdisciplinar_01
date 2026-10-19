import assert from "node:assert/strict";
import fs from "node:fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { chromium } from "playwright";
import {
  applyRecurringAction,
  dueDate,
  nextOccurrence,
  processDue,
  refreshBudgetAlerts,
  todayBR,
  validDate,
} from "./lib/automation.js";
import { createReport, normalizeReport, reportNames } from "./lib/reports.js";
import { reportIntent } from "./lib/report-intent.js";
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
fs.mkdirSync("qa", { recursive: true });
let groups = 0;
const pass = (s) => {
  groups++;
  console.log("PASS " + s);
};
const fixture = () => ({
  profile: { name: "Conta de teste", email: "not-exported@example.test" },
  categories: [
    { id: "food", type: "expense", name: "Alimentação", budget: 100 },
    { id: "salary", type: "income", name: "Salário", budget: 0 },
  ],
  transactions: [],
  goals: [],
  recurring: [],
  notifications: [],
  budgetAlerts: {},
  chat: [{ content: "PRIVATE_CHAT_CANARY" }],
  settings: {},
  learning: {},
});
const validators = (date) => ({
  today: date,
  fail: (m, status = 400) => Object.assign(Error(m), { status }),
  text: (v) => {
    assert.equal(typeof v, "string");
    assert.ok(v.trim());
    return v.trim();
  },
  money: (v) => {
    const n = Number(v);
    assert.ok(Number.isFinite(n) && n > 0);
    return Math.round(n * 100) / 100;
  },
});
const newRule = (s, date, overrides = {}) => {
  applyRecurringAction(
    s,
    "recurring.save",
    {
      type: "expense",
      description: "Regra de teste",
      amount: 40,
      categoryId: "food",
      payment: "Pix",
      frequency: "monthly",
      startDate: date,
      ...overrides,
    },
    validators(date),
  );
  return s.recurring.at(-1);
};
const readWorkbook = async (buffer) => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
};
const unzipText = async (buffer) => {
  const z = await JSZip.loadAsync(buffer);
  return (
    await Promise.all(
      Object.values(z.files)
        .filter((f) => !f.dir && /xml$|rels$/.test(f.name))
        .map((f) => f.async("string")),
    )
  ).join("\n");
};
assert.ok(validDate("2024-02-29"));
assert.ok(!validDate("2025-02-29"));
assert.ok(!validDate("2026-02-31"));
assert.ok(!validDate("bad"));
{
  const s = fixture(),
    r = newRule(s, "2026-01-31", { limit: 4 });
  processDue(s, "2026-01-31");
  assert.equal(nextOccurrence(r), "2026-02-28");
  processDue(s, "2026-03-31");
  assert.deepEqual(
    s.transactions.map((t) => t.date),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
  assert.equal(nextOccurrence(r), "2026-04-30");
  processDue(s, "2026-04-30");
  assert.equal(r.status, "ended");
  assert.equal(r.generatedCount, 4);
  assert.equal(new Set(s.transactions.map((t) => t.occurrenceKey)).size, 4);
  processDue(s, "2026-12-31");
  assert.equal(s.transactions.length, 4);
  const yearly = { startDate: "2024-02-29", frequency: "yearly", nextIndex: 0 };
  assert.equal(dueDate(yearly, 1), "2025-02-28");
  assert.equal(dueDate(yearly, 4), "2028-02-29");
  assert.equal(
    dueDate({ ...yearly, startDate: "2026-12-30", frequency: "weekly" }, 1),
    "2027-01-06",
  );
  pass(
    "Calendário: dia 31, fevereiro, bissexto, virada do ano e limite terminal",
  );
}
{
  const s = fixture(),
    r = newRule(s, "2026-01-01", { frequency: "daily", endDate: "2026-01-05" });
  processDue(s, "2026-01-04");
  assert.equal(s.transactions.length, 4);
  processDue(s, "2026-01-04");
  assert.equal(s.transactions.length, 4);
  s.transactions.splice(1, 1);
  processDue(s, "2026-01-04");
  assert.equal(s.transactions.length, 3);
  processDue(s, "2026-01-30");
  assert.equal(s.transactions.length, 4);
  assert.equal(r.generatedCount, 5);
  assert.equal(r.status, "ended");
  assert.equal(s.transactions.at(-1).date, "2026-01-05");
  pass(
    "Retomada após servidor desligado; idempotência e exclusão sem regeneração",
  );
}
{
  const s = fixture(),
    r = newRule(s, "2026-01-01", { frequency: "weekly" });
  processDue(s, "2026-01-01");
  applyRecurringAction(
    s,
    "recurring.pause",
    { id: r.id },
    validators("2026-01-02"),
  );
  processDue(s, "2026-01-15");
  assert.equal(s.transactions.length, 1);
  applyRecurringAction(
    s,
    "recurring.resume",
    { id: r.id },
    validators("2026-01-22"),
  );
  processDue(s, "2026-01-22");
  assert.deepEqual(
    s.transactions.map((t) => t.date),
    ["2026-01-01", "2026-01-22"],
  );
  assert.equal(nextOccurrence(r), "2026-01-29");
  applyRecurringAction(
    s,
    "recurring.save",
    { ...r, amount: 75 },
    validators("2026-01-23"),
  );
  processDue(s, "2026-01-29");
  assert.deepEqual(
    s.transactions.map((t) => t.amount),
    [40, 40, 75],
  );
  applyRecurringAction(
    s,
    "recurring.end",
    { id: r.id },
    validators("2026-01-30"),
  );
  assert.throws(() =>
    applyRecurringAction(
      s,
      "recurring.resume",
      { id: r.id },
      validators("2026-02-01"),
    ),
  );
  assert.throws(() =>
    applyRecurringAction(
      s,
      "recurring.save",
      { ...r, amount: 90 },
      validators("2026-02-01"),
    ),
  );
  pass(
    "Pausa e retomada sem retroativos; edição só futura; encerramento definitivo",
  );
}
{
  const s = fixture();
  assert.throws(() => newRule(s, "2026-01-10", { startDate: "2026-01-09" }));
  assert.throws(() => newRule(s, "2026-01-10", { limit: 0 }));
  assert.throws(() => newRule(s, "2026-01-10", { frequency: "constructor" }));
  assert.throws(() => newRule(s, "2026-01-10", { frequency: ["monthly"] }));
  assert.throws(() => newRule(s, "2026-01-10", { categoryId: "salary" }));
  const r = newRule(s, "2026-01-10");
  assert.throws(() =>
    applyRecurringAction(
      s,
      "recurring.save",
      { ...r, frequency: "daily" },
      validators("2026-01-10"),
    ),
  );
  s.categories = [];
  processDue(s, "2026-01-10");
  assert.equal(r.status, "paused");
  assert.equal(s.transactions.length, 0);
  pass(
    "Validação: datas passadas, tipos, categorias, frequência, limites e proteção de calendário",
  );
}
{
  const s = fixture();
  s.transactions.push({
    type: "expense",
    categoryId: "food",
    date: "2026-10-01",
    amount: 79.99,
  });
  refreshBudgetAlerts(s, "2026-10-19");
  assert.equal(s.notifications.length, 0);
  s.transactions[0].amount = 80;
  refreshBudgetAlerts(s, "2026-10-19");
  assert.equal(s.notifications[0].threshold, 80);
  s.notifications[0].readAt = "read";
  refreshBudgetAlerts(s, "2026-10-19");
  assert.equal(s.notifications.length, 1);
  s.transactions[0].amount = 99.99;
  refreshBudgetAlerts(s, "2026-10-19");
  assert.equal(s.notifications.length, 1);
  s.transactions[0].amount = 100;
  refreshBudgetAlerts(s, "2026-10-19");
  assert.deepEqual(
    s.notifications.map((n) => n.threshold),
    [100, 80],
  );
  s.transactions[0].amount = 10;
  refreshBudgetAlerts(s, "2026-10-19");
  s.transactions[0].amount = 120;
  refreshBudgetAlerts(s, "2026-10-19");
  assert.equal(s.notifications.length, 2);
  assert.equal(s.notifications.at(-1).amount, 80);
  s.transactions.push({ ...s.transactions[0], date: "2026-11-01" });
  refreshBudgetAlerts(s, "2026-11-01");
  assert.equal(s.notifications.length, 3);
  assert.equal(s.notifications[0].threshold, 100);
  assert.equal(s.notifications[0].month, "2026-11");
  pass(
    "Alertas exatos em 80%/100%, salto direto, deduplicação, histórico e renovação mensal",
  );
}
{
  const s = fixture(),
    date = "2026-10-19";
  s.transactions = [{ date: "2025-02-01" }];
  assert.equal(reportIntent("Como organizar meus gastos?", s, date), null);
  assert.equal(reportIntent("Não quero planilha", s, date), null);
  for (const [prompt, kind, start, end] of [
    ["Planilha completa", "completo", "2026-10-01", "2026-10-19"],
    [
      "Excel de despesas do mês passado",
      "despesas",
      "2026-09-01",
      "2026-09-30",
    ],
    [
      "Planilha receitas últimos 3 meses",
      "receitas",
      "2026-08-01",
      "2026-10-19",
    ],
    ["Excel orçamento de 2025", "orcamentos", "2025-01-01", "2025-12-31"],
    ["Relatório de metas", "metas", "2026-10-01", "2026-10-19"],
    ["Planilha recorrências", "recorrencias", "2026-10-01", "2026-10-19"],
    ["Planilha de janeiro de 2026", "completo", "2026-01-01", "2026-01-31"],
    [
      "Planilha de 2026-01-01 a 31/03/2026",
      "completo",
      "2026-01-01",
      "2026-03-31",
    ],
    ["Planilha todo o histórico", "completo", "2025-02-01", "2026-10-19"],
  ]) {
    const r = reportIntent(prompt, s, date);
    assert.equal(r.kind, kind, prompt);
    assert.equal(r.start, start, prompt);
    assert.equal(r.end, end, prompt);
  }
  assert.equal(
    reportIntent("Planilha de despesas da categoria Alimentação", s, date)
      .categoryId,
    "food",
  );
  for (const q of [
    "Excel na última semana",
    "Planilha categoria inexistente",
    "Planilha janeiro e fevereiro",
    "Planilha desde janeiro",
    "Planilha 2026-01 a 2026-03",
    "Planilha de 31/02/2026 a 05/03/2026",
  ])
    assert.ok(reportIntent(q, s, date).clarification, q);
  pass(
    "Pedidos em português, tipos, datas, histórico, categoria e esclarecimento de ambiguidades",
  );
}
{
  const s = fixture();
  s.transactions = [
    {
      id: "i1",
      date: "2026-10-01",
      type: "income",
      categoryId: "salary",
      description: "Salário",
      amount: 2000,
      payment: "Pix",
    },
    {
      id: "e1",
      date: "2026-10-02",
      type: "expense",
      categoryId: "food",
      description: '=HYPERLINK("https://example.test","não executar")',
      notes: "PRIVATE_NOTE_VISIBLE",
      amount: 80,
      payment: "Pix",
    },
    {
      id: "e2",
      date: "2026-09-01",
      type: "expense",
      categoryId: "food",
      description: "OUTSIDE_PERIOD",
      amount: 999,
      payment: "Pix",
    },
  ];
  s.goals = [
    {
      id: "g1",
      name: "Reserva",
      category: "Reserva",
      target: 5000,
      current: 1000,
      date: "2027-12-31",
    },
  ];
  newRule(s, "2026-10-20");
  const spec = { kind: "completo", start: "2026-10-01", end: "2026-10-19" },
    report = await createReport(s, spec);
  fs.writeFileSync("qa/finance-validated.xlsx", report.buffer);
  const wb = await readWorkbook(report.buffer),
    sum = wb.getWorksheet("Resumo"),
    ex = wb.getWorksheet("Despesas");
  assert.equal(wb.worksheets.length, 7);
  assert.equal(sum.getCell("B6").result, 2000);
  assert.equal(sum.getCell("B7").result, 80);
  assert.equal(sum.getCell("B8").result, 1920);
  assert.match(sum.getCell("B6").formula, /SUM\('Receitas'/);
  assert.equal(ex.getCell("F6").value, 80);
  assert.ok(ex.getCell("A6").value instanceof Date);
  assert.equal(ex.getCell("B6").value, s.transactions[1].description);
  assert.equal(ex.getCell("B6").formula, undefined);
  assert.equal(ex.views[0].ySplit, 5);
  assert.ok(ex.autoFilter);
  assert.equal(wb.getWorksheet("Metas").getCell("F6").result, 0.2);
  const zip = await JSZip.loadAsync(report.buffer);
  assert.equal(
    Object.keys(zip.files).filter((n) => /^xl\/charts\/chart\d+\.xml$/.test(n))
      .length,
    2,
  );
  const xml = await unzipText(report.buffer);
  for (const secret of [
    "PRIVATE_CHAT_CANARY",
    "not-exported@example.test",
    "OUTSIDE_PERIOD",
  ])
    assert.ok(!xml.includes(secret));
  assert.ok(xml.includes("PRIVATE_NOTE_VISIBLE"));
  assert.ok(!Object.keys(zip.files).some((n) => /vba|externalLink/i.test(n)));
  assert.match(xml, /<c:numRef>/);
  assert.match(xml, /<c:barChart>/);
  assert.match(xml, /<c:doughnutChart>/);
  for (const kind of Object.keys(reportNames)) {
    const r = await createReport(s, { ...spec, kind });
    const parsed = await readWorkbook(r.buffer);
    assert.ok(parsed.getWorksheet("Resumo"));
    assert.ok(parsed.getWorksheet("Leia-me"));
    assert.equal(
      !!parsed.getWorksheet("Receitas"),
      ["completo", "receitas"].includes(kind),
    );
    assert.equal(
      !!parsed.getWorksheet("Despesas"),
      ["completo", "despesas", "orcamentos"].includes(kind),
    );
  }
  const filtered = await readWorkbook(
    (await createReport(s, { ...spec, categoryId: "food" })).buffer,
  );
  assert.equal(filtered.getWorksheet("Resumo").getCell("B6").result, 0);
  assert.equal(filtered.getWorksheet("Resumo").getCell("B7").result, 80);
  for (const wrong of [
    { kind: "constructor" },
    { kind: ["completo"] },
    { start: "2026-02-31" },
    { start: "2026-10-20", end: "2026-10-01" },
    { start: "2000-01-01", end: "2026-10-19" },
    { categoryId: "foreign" },
    { kind: "receitas", categoryId: "food" },
    { kind: "metas", categoryId: "food" },
  ])
    assert.throws(() => normalizeReport({ ...spec, ...wrong }, s));
  const noExpenses = await readWorkbook(
    (
      await createReport(
        {
          ...s,
          transactions: s.transactions.filter((t) => t.type === "income"),
        },
        { ...spec, kind: "despesas" },
      )
    ).buffer,
  );
  assert.match(
    noExpenses.getWorksheet("Resumo").getCell("A12").value,
    /Sem lançamentos/,
  );
  const empty = await createReport(fixture(), { ...spec, start: "2026-09-01" });
  const emptyBook = await readWorkbook(empty.buffer);
  assert.equal(emptyBook.getWorksheet("Resumo").getCell("B6").result, 0);
  assert.equal(
    emptyBook.getWorksheet("Resumo").getCell("A16").value,
    "10/2026",
  );
  assert.match(
    emptyBook.getWorksheet("Resumo").getCell("A12").value,
    /Sem lançamentos/,
  );
  assert.equal(
    Object.keys((await JSZip.loadAsync(empty.buffer)).files).filter((n) =>
      /^xl\/charts\/chart\d+\.xml$/.test(n),
    ).length,
    0,
  );
  fs.writeFileSync("qa/finance-empty.xlsx", empty.buffer);
  pass(
    "XLSX: seis tipos, sete abas completas, valores/datas, fórmulas, caches, gráficos OOXML, filtros, privacidade e vazio",
  );
}
const request = async (path, token, body) => {
  const r = await fetch(base + "/api/" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return r;
};
const json = async (path, token, body, status = 200) => {
  const r = await request(path, token, body);
  const payload = await r.json();
  assert.equal(r.status, status, JSON.stringify(payload));
  return payload;
};
const stamp = Date.now(),
  accountA = await json("auth/register", null, {
    name: "Finanças QA A",
    email: `finance-a-${stamp}@example.test`,
    password: "TestOnly!123",
  }),
  accountB = await json("auth/register", null, {
    name: "Finanças QA B",
    email: `finance-b-${stamp}@example.test`,
    password: "TestOnly!123",
  });
let state = accountA.state;
const token = accountA.token,
  tokenB = accountB.token,
  today = todayBR(),
  month = today.slice(0, 7),
  cat = state.categories.find((c) => c.type === "expense"),
  salary = state.categories.find((c) => c.type === "income");
const action = async (name, payload = {}, status = 200) => {
  const r = await json("action", token, { action: name, payload }, status);
  if (r.state) state = r.state;
  return r;
};
await json("reports", null, {}, 401);
await action("budget.save", { id: cat.id, budget: 100 });
await action("recurring.save", {
  type: "expense",
  description: "Conta recorrente QA",
  amount: 80,
  categoryId: cat.id,
  frequency: "monthly",
  startDate: today,
});
const rule = state.recurring[0],
  generated = state.transactions.find((t) => t.recurringId === rule.id);
assert.ok(generated);
assert.equal(state.notifications[0].threshold, 80);
await action("recurring.check");
assert.equal(state.transactions.length, 1);
await action("transaction.save", {
  ...generated,
  amount: 85,
  description: "Conta recorrente corrigida",
});
assert.equal(state.transactions[0].occurrenceKey, generated.occurrenceKey);
await action("transaction.save", {
  type: "expense",
  description: "Despesa adicional",
  amount: 15,
  date: today,
  categoryId: cat.id,
});
assert.deepEqual(
  state.notifications.map((n) => n.threshold),
  [100, 80],
);
await action("notification.read", { id: state.notifications[1].id });
assert.ok(state.notifications[1].readAt);
await action("transaction.save", {
  type: "income",
  description: "PRIVATE_A_INCOME",
  amount: 2000,
  date: today,
  categoryId: salary.id,
});
await action("category.delete", { id: cat.id }, 400);
await action("recurring.save", { ...rule, frequency: "constructor" }, 400);
await json(
  "action",
  tokenB,
  { action: "recurring.pause", payload: { id: rule.id } },
  404,
);
await json(
  "action",
  tokenB,
  { action: "notification.read", payload: { id: state.notifications[0].id } },
  404,
);
const bData = await json("action", tokenB, {
  action: "category.save",
  payload: { name: "PRIVATE_B_CATEGORY", type: "expense", color: "#ff2049" },
});
const bcat = bData.state.categories.find(
  (c) => c.name === "PRIVATE_B_CATEGORY",
);
await json("action", tokenB, {
  action: "transaction.save",
  payload: {
    type: "expense",
    description: "PRIVATE_B_TRANSACTION",
    amount: 999,
    date: today,
    categoryId: bcat.id,
  },
});
await json("reports", token, { kind: "despesas", categoryId: bcat.id }, 400);
await json("reports", token, { kind: "constructor" }, 400);
const exportA = await request("reports", token, {
  kind: "completo",
  start: month + "-01",
  end: today,
});
assert.equal(exportA.status, 200);
assert.match(exportA.headers.get("content-type"), /spreadsheetml/);
assert.match(exportA.headers.get("content-disposition"), /\.xlsx/);
assert.equal(exportA.headers.get("cache-control"), "no-store");
const bytes = Buffer.from(await exportA.arrayBuffer()),
  xmlA = await unzipText(bytes);
assert.ok(xmlA.includes("PRIVATE_A_INCOME"));
for (const privateValue of [
  "PRIVATE_B_TRANSACTION",
  "PRIVATE_B_CATEGORY",
  token,
  tokenB,
  "TestOnly!123",
  "password",
])
  assert.ok(!xmlA.includes(privateValue), privateValue);
fs.writeFileSync("qa/finance-api.xlsx", bytes);
await action("transaction.delete", { id: generated.id });
await action("recurring.check");
assert.ok(
  !state.transactions.some((t) => t.occurrenceKey === generated.occurrenceKey),
);
pass(
  "API: criação automática, proveniência, alertas, autenticação, limites e isolamento entre contas",
);
const chat = await json("chat", token, {
  message: "Quero uma planilha completa deste mês",
});
assert.equal(chat.mode, "local-report");
assert.equal(chat.state.chat.at(-1).report.kind, "completo");
const unclear = await json("chat", token, {
  message: "Planilha da última semana",
});
assert.equal(unclear.state.chat.at(-1).report, undefined);
assert.match(unclear.state.chat.at(-1).content, /identificar|datas/);
const chatState = await json("state", token);
assert.equal(chatState.state.chat.length, 4);
pass("Assistente: pedido completo e esclarecimento persistidos, sem API de IA");
const simultaneous = await Promise.all(
  Array.from({ length: 5 }, () =>
    request("reports", token, { kind: "completo" }),
  ),
);
assert.ok(simultaneous.some((r) => r.status === 200));
assert.ok(simultaneous.some((r) => r.status === 429));
await Promise.all(simultaneous.map((r) => r.arrayBuffer()));
pass("Limite de uma exportação simultânea por conta");
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "pt-BR",
});
await context.addInitScript((t) => localStorage.setItem("yf-token", t), token);
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(base + "/recorrencias");
  await page
    .getByRole("heading", { name: "Lançamentos recorrentes", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Nova recorrência", exact: true })
    .click();
  await page.getByRole("button", { name: "Receita", exact: true }).click();
  await page.getByLabel("Descrição", { exact: true }).fill("Salário mensal UI");
  await page.getByLabel("Valor por ocorrência (R$)").fill("3200");
  await page.getByLabel("Categoria", { exact: true }).selectOption(salary.id);
  // An in-flight, stale poll must not overwrite a successful action or reset the form.
  await page.route("**/api/state", async (route) => {
    const r = await route.fetch();
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({ response: r });
  });
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  assert.equal(
    await page.getByLabel("Descrição", { exact: true }).inputValue(),
    "Salário mensal UI",
  );
  await page
    .getByRole("button", { name: "Criar e ativar", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.waitForTimeout(1000);
  await page.unroute("**/api/state");
  let card = page.locator(".recurring-card").filter({
    has: page.getByRole("heading", {
      name: "Salário mensal UI",
      exact: true,
    }),
  });
  await card.waitFor();
  await card.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Valor por ocorrência (R$)").fill("3300");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await card.getByRole("button", { name: "Pausar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await card.getByText("Pausada", { exact: true }).waitFor();
  await card.getByRole("button", { name: "Retomar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await card.getByText("Ativa", { exact: true }).waitFor();
  const live = (await json("state", token)).state;
  assert.equal(
    live.transactions.filter((t) => t.description === "Salário mensal UI")
      .length,
    1,
  );
  assert.equal(
    live.transactions.find((t) => t.description === "Salário mensal UI").amount,
    3200,
  );
  await page.screenshot({
    path: "qa/finance-recurring-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  pass(
    "Interface: criar/editar/pausar/retomar; formulário e ação protegidos contra polling antigo",
  );
  await page.getByRole("button", { name: /Notificações:/ }).click();
  await page.getByRole("heading", { name: "Seus alertas" }).waitFor();
  assert.equal(await page.locator(".notification-card").count(), 1);
  await page.getByRole("button", { name: "Marcar todas como lidas" }).click();
  await page.getByRole("heading", { name: "Tudo em dia por aqui" }).waitFor();
  await page
    .locator(".finance-filter-tabs")
    .getByRole("button", { name: /Todas/ })
    .click();
  assert.equal(await page.locator(".notification-card").count(), 2);
  await page.screenshot({
    path: "qa/finance-alerts-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.reload();
  await page.getByRole("heading", { name: "Tudo em dia por aqui" }).waitFor();
  pass(
    "Interface: sino, leitura individual/todas, histórico e persistência sem duplicação",
  );
  await page.goto(base + "/relatorios");
  await page
    .getByRole("heading", { name: "Seu dinheiro em planilhas" })
    .waitFor();
  await page
    .locator(".report-type")
    .filter({ has: page.getByText("Despesas", { exact: true }) })
    .click();
  await page.getByLabel("Filtrar categoria").selectOption(cat.id);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar Excel", exact: true }).click();
  const file = await download;
  assert.match(file.suggestedFilename(), /YFinance-despesas/);
  await file.saveAs("qa/finance-ui-download.xlsx");
  const downloaded = await readWorkbook(
    fs.readFileSync("qa/finance-ui-download.xlsx"),
  );
  assert.equal(downloaded.worksheets.length, 3);
  assert.equal(downloaded.getWorksheet("Despesas").getCell("F6").value, 15);
  await page.screenshot({
    path: "qa/finance-reports-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  pass(
    "Interface: relatório específico, categoria e download real .xlsx validado",
  );
  await page.goto(base + "/ia");
  await page
    .getByLabel("Mensagem para o assistente")
    .fill("Gere uma planilha de receitas deste mês");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  const attachment = page.locator(".chat-report-attachment").last();
  await attachment.getByText("Receitas", { exact: true }).waitFor();
  const chatDownload = page.waitForEvent("download");
  await attachment
    .getByRole("button", { name: "Baixar Excel", exact: true })
    .click();
  assert.match((await chatDownload).suggestedFilename(), /YFinance-receitas/);
  await page.screenshot({
    path: "qa/finance-chat-desktop.png",
    animations: "disabled",
  });
  await attachment.getByRole("button", { name: "Ajustar filtros" }).click();
  await page
    .getByRole("heading", { name: "Seu dinheiro em planilhas" })
    .waitFor();
  assert.equal(
    await page.locator(".report-type.selected strong").innerText(),
    "Receitas",
  );
  await page.reload();
  await page.goto(base + "/ia");
  await page
    .locator(".chat-report-attachment")
    .last()
    .getByText("Receitas", { exact: true })
    .waitFor();
  pass(
    "Interface: cartão Excel no chat, download, ajuste de filtros e histórico após recarregar",
  );
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [url, heading] of [
      ["recorrencias", "Lançamentos recorrentes"],
      ["relatorios", "Seu dinheiro em planilhas"],
      ["notificacoes", "Seus alertas"],
      ["ia", "YFinance IA"],
    ]) {
      await page.goto(base + "/" + url);
      await page
        .getByRole("heading", { name: heading, exact: true })
        .first()
        .waitFor();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${url} overflow ${width}`,
      );
      if (width === 390)
        await page.screenshot({
          path: `qa/finance-${url}-mobile.png`,
          fullPage: true,
          animations: "disabled",
        });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/recorrencias");
  await page
    .getByRole("button", { name: "Nova recorrência", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({
    path: "qa/finance-recurring-form-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  pass(
    "Telas em 390/768/1440 px, diálogo móvel, Escape e ausência de erros de JavaScript",
  );
} finally {
  await browser.close();
}
console.log(`\n${groups} grupos de testes financeiros concluídos.`);
