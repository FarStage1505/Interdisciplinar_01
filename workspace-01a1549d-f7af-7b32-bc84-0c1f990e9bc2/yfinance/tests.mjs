import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
fs.mkdirSync("qa", { recursive: true });
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
const b = await chromium.launch();
const context = await b.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "pt-BR",
});
const p = await context.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.setDefaultTimeout(12000);
const log = (msg) => console.log("PASS " + msg);
const nav = async (name) =>
  p.locator("nav").getByRole("link", { name, exact: true }).click();
const waitSaved = async () =>
  p.getByRole("dialog").waitFor({ state: "hidden" });
let token;
try {
  await p.goto(base);
  await p.getByRole("heading", { name: "Olá, Alex!" }).waitFor();
  log("Dashboard com dados demonstrativos");
  token = await p.evaluate(() => localStorage.getItem("yf-token"));
  await nav("Despesas");
  await p.getByRole("button", { name: "Nova despesa", exact: true }).click();
  await p.getByLabel("Nome da despesa").fill("Despesa teste automatizado");
  await p.getByLabel("Valor (R$)", { exact: true }).fill("42.75");
  await p
    .getByLabel("Categoria", { exact: true })
    .selectOption({ label: "Alimentação" });
  await p.getByLabel("Observações (opcional)").fill("Criada no teste");
  await p.getByRole("button", { name: "Salvar despesa" }).click();
  await waitSaved();
  await p
    .getByRole("cell", { name: "Despesa teste automatizado Criada no teste" })
    .waitFor();
  log("Cadastrar despesa");
  await p
    .getByLabel("Buscar lançamento")
    .pressSequentially("automatizado", { delay: 20 });
  assert.equal(
    await p.getByLabel("Buscar lançamento").inputValue(),
    "automatizado",
  );
  assert.equal(await p.locator("tbody tr").count(), 1);
  log("Busca preserva foco e filtra");
  await p
    .getByRole("button", {
      name: "Editar Despesa teste automatizado",
      exact: true,
    })
    .click();
  await p.getByLabel("Valor (R$)", { exact: true }).fill("59.9");
  await p.getByRole("button", { name: "Salvar despesa" }).click();
  await waitSaved();
  assert.match(await p.locator("tbody").innerText(), /59,90/);
  log("Editar despesa");
  const download = p.waitForEvent("download");
  await p.getByRole("button", { name: "Exportar", exact: true }).click();
  const file = await download;
  assert.match(file.suggestedFilename(), /\.csv$/);
  log("Exportação CSV");
  await p
    .getByRole("button", {
      name: "Excluir Despesa teste automatizado",
      exact: true,
    })
    .click();
  await p.getByRole("button", { name: "Sim, excluir" }).click();
  await waitSaved();
  await p
    .getByRole("heading", { name: "Nenhum lançamento encontrado" })
    .waitFor();
  log("Excluir despesa com confirmação");
  await p.getByLabel("Buscar lançamento").fill("");
  await p.getByRole("button", { name: "Filtros", exact: true }).click();
  await p
    .getByLabel("Filtrar por categoria")
    .selectOption({ label: "Alimentação" });
  assert.equal(await p.locator("tbody tr").count(), 1);
  await p.getByLabel("Mês de referência").fill("2025-01");
  await p
    .getByRole("heading", { name: "Nenhum lançamento encontrado" })
    .waitFor();
  await p
    .getByLabel("Mês de referência")
    .fill(
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })
        .format(new Date())
        .slice(0, 7),
    );
  log("Filtros por categoria e mês");
  await nav("Receitas");
  await p.getByRole("button", { name: "Nova receita", exact: true }).click();
  await p.getByLabel("Nome da receita").fill("Receita teste");
  await p.getByLabel("Valor (R$)", { exact: true }).fill("200");
  await p
    .getByLabel("Categoria", { exact: true })
    .selectOption({ label: "Freelance" });
  await p.getByRole("button", { name: "Salvar receita" }).click();
  await waitSaved();
  await p.getByRole("cell", { name: "Receita teste", exact: true }).waitFor();
  log("Cadastrar receita");
  await nav("Metas");
  await p.getByRole("button", { name: "Criar nova meta" }).click();
  await p.getByLabel("Nome da meta").fill("Meta automatizada");
  await p.getByLabel("Objetivo (R$)").fill("1000");
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar", exact: true })
    .click();
  await waitSaved();
  const goal = p
    .locator(".goal-card")
    .filter({ has: p.getByRole("heading", { name: "Meta automatizada" }) });
  await goal.getByRole("button", { name: "Guardar dinheiro" }).click();
  await p.getByLabel("Quanto você quer guardar? (R$)").fill("150");
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar dinheiro" })
    .click();
  await waitSaved();
  assert.match(await goal.innerText(), /15.0%/);
  log("Criar meta e realizar aporte");
  await nav("Categorias");
  await p.getByRole("button", { name: "Nova categoria", exact: true }).click();
  await p.getByLabel("Nome da categoria").fill("Pets teste");
  await p.getByLabel("Orçamento mensal (R$)").fill("300");
  await p
    .getByRole("dialog")
    .getByRole("button", { name: "Salvar", exact: true })
    .click();
  await waitSaved();
  await p.getByRole("heading", { name: "Pets teste", exact: true }).waitFor();
  log("Categoria personalizada");
  await nav("Configurações");
  await p.getByLabel("Nome", { exact: true }).fill("Alex Teste");
  await p.getByRole("button", { name: "Salvar perfil" }).click();
  await p
    .getByRole("button", { name: "Alex Teste Conta demonstração" })
    .waitFor();
  await p.getByRole("switch", { name: "Modo escuro" }).click();
  await p.waitForFunction(
    () => document.documentElement.dataset.theme === "light",
  );
  await p.getByRole("switch", { name: "Modo escuro" }).click();
  await p.waitForFunction(
    () => document.documentElement.dataset.theme === "dark",
  );
  log("Perfil e aparência persistentes");
  await p.getByLabel("Orçamento de Alimentação").fill("750");
  const budget = p
    .locator(".budget-row")
    .filter({ has: p.getByLabel("Orçamento de Alimentação") });
  await budget.getByRole("button", { name: "Salvar", exact: true }).click();
  await nav("Categorias");
  const cat = p.locator(".category-card").filter({
    has: p.getByRole("heading", { name: "Alimentação", exact: true }),
  });
  assert.match(await cat.innerText(), /750,00/);
  log("Salvar orçamento");
  await nav("Educação");
  await p.getByRole("button", { name: "Começar aprendizado" }).click();
  await p.getByRole("button", { name: "Marcar como concluída" }).click();
  await p.getByRole("button", { name: "Concluída · desfazer" }).waitFor();
  await p.reload();
  await p.getByRole("button", { name: "Concluída · desfazer" }).waitFor();
  await nav("Educação");
  await p.getByRole("tab", { name: "Desafios", exact: true }).click();
  await p.locator(".edu-legacy summary").click();
  await p
    .getByRole("button", { name: "Marcar como concluído", exact: true })
    .first()
    .click();
  await p.getByRole("button", { name: "Concluído · desfazer" }).waitFor();
  log("Aulas e desafios com progresso salvo");
  await nav("YFinance IA");
  await p
    .getByLabel("Mensagem para o assistente")
    .pressSequentially("Analise meus gastos", { delay: 15 });
  assert.equal(
    await p.getByLabel("Mensagem para o assistente").inputValue(),
    "Analise meus gastos",
  );
  await p.getByRole("button", { name: "Enviar mensagem" }).click();
  await p
    .locator(".chat-message.assistant")
    .filter({ hasText: "Neste mês, você registrou" })
    .waitFor();
  log("Assistente local com dados reais da sessão");
  for (const [route, heading] of [
    ["dashboard", "Olá, Alex!"],
    ["despesas", "Suas despesas"],
    ["receitas", "Suas receitas"],
    ["metas", "Suas metas financeiras"],
    ["categorias", "Categorias"],
    ["educacao", "Aprenda a cuidar"],
    ["ia", "YFinance IA"],
    ["configuracoes", "Configurações"],
  ]) {
    await p.goto(base + "/" + route);
    await p.locator("main").waitFor();
    await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForFunction(
      () => document.documentElement.scrollWidth <= innerWidth,
    );
    await p.screenshot({
      path: `qa/mobile-${route}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  log("8 páginas responsivas sem overflow em 390px");
  await p.getByRole("button", { name: "Abrir menu" }).click();
  await p.locator(".sidebar.open").waitFor();
  await nav("Dashboard");
  await p.locator(".sidebar.open").waitFor({ state: "hidden" });
  log("Menu mobile");
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.goto(base + "/register");
  await p.getByLabel("Nome", { exact: true }).fill("Conta Teste");
  const email = `qa-${Date.now()}@example.test`;
  await p.getByLabel("E-mail", { exact: true }).fill(email);
  await p.getByLabel("Senha", { exact: true }).fill("TesteSeguro123!");
  await p
    .getByLabel("Confirmar senha", { exact: true })
    .fill("TesteSeguro123!");
  await p.getByRole("button", { name: "Criar conta", exact: true }).click();
  await p.getByRole("heading", { name: "Olá, Conta!" }).waitFor();
  assert.match(await p.locator(".balance-number").innerText(), /0,00/);
  log("Cadastro com conta vazia e isolada");
  await nav("Configurações");
  await p.getByRole("button", { name: "Sair da conta" }).click();
  await p.getByRole("heading", { name: "Bem-vindo de volta" }).waitFor();
  await p.getByLabel("E-mail", { exact: true }).fill(email);
  await p.getByLabel("Senha", { exact: true }).fill("TesteSeguro123!");
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.getByRole("heading", { name: "Olá, Conta!" }).waitFor();
  log("Logout e login real");
  const call = async (action, payload) =>
    fetch(base + "/api/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ action, payload }),
    });
  const state = await (
    await fetch(base + "/api/state", {
      headers: { Authorization: "Bearer " + token },
    })
  ).json();
  const anotherToken = await p.evaluate(() => localStorage.getItem("yf-token"));
  const foreign = await fetch(base + "/api/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + anotherToken,
    },
    body: JSON.stringify({
      action: "transaction.delete",
      payload: { id: state.state.transactions[0].id },
    }),
  });
  assert.equal(foreign.status, 404);
  assert.equal((await fetch(base + "/api/state")).status, 401);
  assert.equal(
    (
      await call("transaction.save", {
        type: "expense",
        description: "Inválido",
        amount: -1,
        date: "2026-10-07",
        categoryId: state.state.categories[0].id,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("category.delete", {
        id: state.state.transactions[0].categoryId,
      })
    ).status,
    400,
  );
  log(
    "Validação de valores, categorias em uso, autenticação e isolamento entre contas",
  );
  assert.deepEqual(errors, []);
  log("Nenhum erro JavaScript");
  fs.writeFileSync(
    "qa/result.txt",
    "Todos os testes passaram em " +
      new Date().toISOString() +
      "\nCRUD de despesas, receitas, metas/aportes, categorias, orçamento, busca, filtros, CSV, perfil, tema, aulas, desafios, assistente, responsividade, cadastro, login, logout, isolamento e validação.\n",
  );
  console.log("\nALL TESTS PASSED");
} catch (e) {
  await p.screenshot({ path: "qa/failure.png", fullPage: true });
  console.error(e);
  process.exitCode = 1;
} finally {
  await b.close();
}
