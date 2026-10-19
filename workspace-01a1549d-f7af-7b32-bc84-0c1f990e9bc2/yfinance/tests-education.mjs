import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import { curriculum } from "./src/curriculum.js";
const base = process.env.TEST_URL || "http://127.0.0.1:3000";
fs.mkdirSync("qa", { recursive: true });
const logs = [];
const pass = (m) => {
  logs.push(m);
  console.log("PASS " + m);
};
assert.equal(curriculum.length, 17);
assert.equal(curriculum.flatMap((l) => l.quiz).length, 51);
for (const l of curriculum) {
  assert.equal(l.objectives.length, 3);
  assert.equal(l.sections.length, 3);
  assert.ok(
    l.sections
      .flatMap((s) => s.paragraphs)
      .join(" ")
      .split(/\s+/).length > 240,
  );
  assert.equal(l.challenge.steps.length, 3);
  for (const q of l.quiz) {
    assert.equal(q.options.length, 4);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
    assert.ok(q.explanation.length > 70);
  }
}
pass("17 aulas aprofundadas, 17 práticas e 51 perguntas com explicações");
const boot = await (
  await fetch(base + "/api/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
).json();
async function action(name, payload, status = 200) {
  const res = await fetch(base + "/api/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + boot.token,
    },
    body: JSON.stringify({ action: name, payload }),
  });
  const json = await res.json();
  assert.equal(res.status, status, JSON.stringify(json));
  return json;
}
await action("learning.visit", { id: -1 }, 400);
await action("learning.quiz.answer", { id: 0, question: 0, answer: 99 }, 400);
await action("learning.quiz.submit", { id: 0, score: 3 }, 400);
await action(
  "learning.challenge.complete",
  { id: 0, reflection: "Uma reflexão para testar sem iniciar." },
  400,
);
pass(
  "API rejeita IDs, respostas inválidas, pontuação forjada e conclusão prematura",
);
await action("lesson.toggle", { id: 0 });
await action("challenge.toggle", { id: 1 });
for (let id = 0; id < 17; id++) {
  await action("learning.challenge.start", { id });
  await action(
    "learning.challenge.complete",
    { id, reflection: "Reflexão antes das etapas completas." },
    400,
  );
  for (let step = 0; step < 3; step++)
    await action("learning.challenge.step", { id, step, done: true });
  await action("learning.challenge.complete", { id, reflection: "curta" }, 400);
  let d = await action("learning.challenge.complete", {
    id,
    reflection:
      "Usei um cenário fictício para analisar decisões e estabelecer um próximo passo.",
  });
  assert.ok(d.state.learning[id].challenge.completedAt);
  for (let question = 0; question < 3; question++)
    await action("learning.quiz.answer", {
      id,
      question,
      answer: curriculum[id].quiz[question].answer,
    });
  d = await action("learning.quiz.submit", { id, score: 0 });
  assert.equal(d.state.learning[id].quiz.last.score, 3);
  assert.equal(d.state.learning[id].quiz.last.passed, true);
  assert.equal(d.state.learning[id].quiz.bestScore, 3);
  await action("learning.quiz.submit", { id }, 400);
  await action("learning.quiz.retry", { id });
  for (let question = 0; question < 3; question++)
    await action("learning.quiz.answer", {
      id,
      question,
      answer: (curriculum[id].quiz[question].answer + 1) % 4,
    });
  d = await action("learning.quiz.submit", { id, score: 3 });
  assert.equal(d.state.learning[id].quiz.last.score, 0);
  assert.equal(d.state.learning[id].quiz.last.passed, false);
  assert.equal(d.state.learning[id].quiz.bestScore, 3);
  assert.equal(d.state.learning[id].quiz.attempts, 2);
  assert.equal(d.state.learning[id].quiz.history.length, 2);
  assert.deepEqual(d.state.completed, [0]);
  assert.deepEqual(d.state.challenges, [1]);
  assert.deepEqual(d.state.transactions, boot.state.transactions);
}
pass(
  "Todas as 17 aulas: desafio validado, nota calculada no servidor, nova tentativa e melhor nota preservada",
);
pass("Progresso anterior e lançamentos financeiros permanecem intactos");
const other = await (
  await fetch(base + "/api/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
).json();
assert.deepEqual(other.state.learning, {});
pass("Progresso isolado entre usuários");
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "pt-BR",
});
const p = await ctx.newPage();
p.setDefaultTimeout(12000);
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const saved = () =>
  p.waitForFunction(
    () =>
      !document.querySelector("#lesson-quiz fieldset:disabled") &&
      !document.querySelector("#lesson-desafio button.primary:disabled"),
  );
async function choose(question, answer) {
  const option = p
    .locator(".edu-question")
    .nth(question)
    .getByRole("radio")
    .nth(answer);
  await option.click({ force: true });
  await p.waitForFunction(
    () => !document.querySelector("#lesson-quiz fieldset:disabled"),
  );
}
try {
  await p.goto(base + "/educacao");
  await p
    .getByRole("button", { name: "Começar aprendizado", exact: true })
    .click();
  await p
    .getByRole("heading", { name: "O que é educação financeira?", exact: true })
    .waitFor();
  await p.getByRole("button", { name: "Começar desafio", exact: true }).click();
  const checks = p.locator(".edu-checklist input");
  for (let i = 0; i < 3; i++) {
    await checks.nth(i).click();
    await p.waitForFunction(
      () => !document.querySelector(".edu-checklist input:disabled"),
    );
  }
  assert.equal(
    await p
      .getByRole("button", { name: "Concluir desafio", exact: true })
      .isDisabled(),
    true,
  );
  await p
    .getByLabel("Sua reflexão", { exact: true })
    .fill(
      "Aprendi que devo separar minhas necessidades, meus compromissos e a margem para uma meta.",
    );
  await p.getByRole("button", { name: "Salvar reflexão", exact: true }).click();
  await p.waitForFunction(() =>
    document
      .querySelector(".edu-reflection-meta")
      ?.textContent.includes("Reflexão salva no servidor"),
  );
  await p.reload();
  await p.getByLabel("Sua reflexão", { exact: true }).waitFor();
  assert.match(
    await p.getByLabel("Sua reflexão", { exact: true }).inputValue(),
    /Aprendi que/,
  );
  assert.equal(await p.locator(".edu-checklist input:checked").count(), 3);
  await p
    .getByRole("button", { name: "Concluir desafio", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Reabrir desafio", exact: true })
    .waitFor();
  await p.reload();
  await p
    .getByRole("button", { name: "Reabrir desafio", exact: true })
    .waitFor();
  pass("UI: checklist, reflexão e conclusão persistem após recarregar");
  await p.getByRole("button", { name: "Corrigir quiz", exact: true }).click();
  await p
    .getByRole("alert")
    .filter({ hasText: "Responda as três perguntas" })
    .waitFor();
  await choose(0, 0);
  await p.reload();
  await p.locator(".edu-question").first().waitFor();
  assert.equal(
    await p
      .locator(".edu-question")
      .first()
      .getByRole("radio")
      .nth(0)
      .isChecked(),
    true,
  );
  pass("UI: respostas parciais do quiz são salvas e restauradas");
  await choose(1, 0);
  await choose(2, 0);
  await p.getByRole("button", { name: "Corrigir quiz", exact: true }).click();
  await p.getByRole("status", { name: "Resultado do quiz" }).waitFor();
  assert.match(await p.locator(".edu-quiz-result").innerText(), /0\/3/);
  assert.equal(await p.locator(".edu-answer-feedback.incorrect").count(), 3);
  await p
    .locator("#lesson-quiz")
    .screenshot({ path: "qa/quiz-corrected.png", animations: "disabled" });
  pass("UI: correção mostra resposta correta e explicação em cada pergunta");
  await p
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await p.waitForFunction(
    () => document.querySelectorAll(".edu-quiz-result").length === 0,
  );
  for (let i = 0; i < 3; i++) await choose(i, curriculum[0].quiz[i].answer);
  await p.getByRole("button", { name: "Corrigir quiz", exact: true }).click();
  await p.getByRole("status", { name: "Resultado do quiz" }).waitFor();
  assert.match(await p.locator(".edu-quiz-result").innerText(), /3\/3/);
  await p.reload();
  await p.getByRole("status", { name: "Resultado do quiz" }).waitFor();
  assert.match(
    await p.locator(".edu-quiz-result").innerText(),
    /Melhor resultado: 3\/3/,
  );
  pass("UI: nova tentativa, resultado e melhor nota persistem");
  await p.goto(base + "/educacao");
  await p.getByRole("tab", { name: "Desafios", exact: true }).click();
  await p
    .getByRole("combobox", { name: "Filtrar desafios" })
    .selectOption("Concluídos");
  assert.equal(await p.locator(".edu-challenge-tile").count(), 1);
  await p.getByRole("tab", { name: "Quizzes", exact: true }).click();
  await p
    .getByRole("combobox", { name: "Filtrar quizzes" })
    .selectOption("Aprovados");
  assert.equal(await p.locator(".edu-quiz-tile").count(), 1);
  await p.getByRole("tab", { name: "Meu progresso", exact: true }).click();
  assert.equal(await p.locator(".edu-progress-row").count(), 17);
  pass("Painel de progresso e filtros por estado de desafios e quizzes");
  for (const width of [390, 768, 1440]) {
    await p.setViewportSize({ width, height: 900 });
    for (const path of [
      "/educacao",
      "/educacao/trilha/0",
      "/educacao/aula/0",
      "/educacao/aula/13/quiz",
      "/educacao/aula/16/desafio",
    ]) {
      await p.goto(base + path);
      await p.locator(".edu-page").waitFor();
      await p.waitForFunction(
        () => document.documentElement.scrollWidth <= innerWidth,
      );
      if (path === "/educacao/aula/0")
        await p.screenshot({
          path: `qa/lesson-education-${width}.png`,
          animations: "disabled",
        });
    }
  }
  pass("Hub, trilhas e aulas sem overflow em 390px, 768px e 1440px");
  await p.setViewportSize({ width: 1440, height: 1000 });
  for (let id = 0; id < 17; id++) {
    await p.goto(base + "/educacao/aula/" + id);
    await p.locator(".edu-content").waitFor();
    assert.equal(await p.locator(".edu-body>section").count(), 5);
    assert.equal(await p.locator(".edu-question").count(), 3);
  }
  assert.deepEqual(errors, []);
  pass(
    "17 aulas acessíveis por URL, com conteúdo, desafio e quiz; nenhum erro JavaScript",
  );
  fs.writeFileSync("qa/education-results.txt", logs.join("\n") + "\n");
  console.log("ALL EDUCATION TESTS PASSED");
} catch (e) {
  await p.screenshot({
    path: "qa/education-failure.png",
    fullPage: true,
    animations: "disabled",
  });
  console.error(e);
  process.exitCode = 1;
} finally {
  await b.close();
}
