# Y Finance — Gestão e Educação Financeira

Implementação independente baseada nas páginas públicas acessíveis do Y Finance. Mantém a identidade escura com destaque azul royal e a organização do site de referência, com novas áreas de automação e relatórios. Não modifica o aplicativo Base44 e não depende dele para funcionar.

## Iniciar

Requisitos: **Node.js 20.19+ ou 22.12+** e npm.

```bash
npm ci
npm run build
npm start
```

**Os comandos acima funcionam também no Windows.** Abra `http://localhost:3000`. O servidor escuta em `0.0.0.0` e usa a variável `PORT`, quando definida. Frontend e API compartilham a mesma origem; não há URLs de localhost no código entregue ao navegador.

Para desenvolver:

```bash
npm run dev
```

**Não exponha o servidor de desenvolvimento como ambiente definitivo.** Para publicar, use o build e `npm start`.

## Como experimentar

1. A página inicial abre uma demonstração individual com valores **fictícios**.
2. As alterações da demonstração são salvas no servidor e vinculadas à sessão deste navegador.
3. Para uma conta sem dados de exemplo, abra **Configurações → Criar minha conta**.
4. Cadastre nome, e-mail e uma senha com pelo menos oito caracteres. A conta começa com lançamentos e metas vazios.
5. Use **Entrar** para recuperar a conta em outro navegador.

As credenciais são próprias deste aplicativo: **não use a senha do Base44**.

## Implementado

| Seção               | Funcionalidades                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard           | Saldo mensal, comparação com mês anterior, receitas, despesas, distribuição por categoria, metas e movimentações recentes                                               |
| Despesas e receitas | Criar, editar, excluir com confirmação; categorias; data; pagamento; notas; pesquisa; mês; filtros; ordenação; exportação CSV                                           |
| Recorrências        | Receitas/despesas automáticas diárias, semanais, mensais ou anuais; limites; edição futura; pausa, retomada e encerramento                                              |
| Alertas (sino)      | Avisos dentro do aplicativo em 80% e 100% do orçamento, deduplicação mensal, histórico e leitura individual/em lote                                                     |
| Relatórios Excel    | Arquivos .xlsx completos ou específicos; datas/categoria; fórmulas, gráficos editáveis e download autenticado                                                           |
| Categorias          | Categorias personalizadas de receita/despesa, cores, orçamento, totais, evolução de seis meses e alerta de limite                                                       |
| Metas               | Criar, editar, excluir; objetivo, valor acumulado, prazo, cor, aportes, percentual e estimativa mensal                                                                  |
| Educação            | Três trilhas, 17 aulas aprofundadas, 17 desafios por aula, 51 questões comentadas, novas tentativas, melhores notas e progresso persistente                             |
| YFinance IA         | Assistente local por regras, baseado nos registros; histórico persistente; pedidos de Excel e cartões de download; exclusão da conversa; integração generativa opcional |
| Configurações       | Nome do perfil, tema claro/escuro, ocultação de valores, limites por categoria, exportação JSON, cadastro, login e logout                                               |

Interface responsiva, navegação por URLs, botão Voltar do navegador, menu móvel, formulários com validação, mensagens de erro, foco de teclado e diálogos com confirmação.

## Regras financeiras

- Saldo disponível = receitas − despesas **do mês selecionado**. Não é saldo bancário nem saldo histórico acumulado.
- A comparação usa a mesma regra no mês anterior.
- Orçamentos são limites mensais reutilizados a cada mês, e não transações.
- Valores são arredondados para duas casas na API.
- Aportes em metas são controles independentes: **não descontam automaticamente do saldo** e não criam despesas. Essa regra também aparece na interface.
- Metas podem ultrapassar o objetivo; a barra visual fica limitada a 100%.
- Uma categoria usada por lançamentos ou regras de recorrência não pode ser excluída. Regras encerradas também preservam a referência para o histórico.
- Registros de cartão não geram faturas ou parcelamentos automáticos. Cada compra/parcela deve ser lançada de maneira consistente, evitando duplicar o pagamento da fatura.
- Aulas e orientações são educativas e não constituem recomendação individual de investimento.

## Automação, alertas e planilhas

**Recorrências** registra automaticamente os vencimentos, mas não paga contas nem movimenta dinheiro. O calendário segue São Paulo, mantém o dia original nos meses menores e evita duplicar ocorrências. O servidor precisa estar ativo: verifica a cada minuto e recupera vencimentos de regras ativas ao reiniciar. Durante uma pausa, datas passadas são ignoradas ao retomar.

O **sino** reúne avisos de 80% e 100% por categoria/mês. Não há e-mail ou push externo. Ler um aviso não permite que ele seja gerado novamente no mesmo nível/mês. O histórico mantém os valores do momento do alerta.

Em **Relatórios Excel**, baixe um arquivo completo ou somente despesas, receitas, orçamentos, metas ou recorrências. No assistente, peça “planilha completa deste mês”, “Excel de despesas do mês passado” ou um dos exemplos de **ATUALIZACAO.md**. O reconhecimento dos pedidos e os downloads funcionam sem chave de IA. Os arquivos usam apenas os registros da conta atual, não dados inventados pelo modelo.

O relatório completo tem sete abas, incluindo instruções. Valores/datas são tipos próprios do Excel; totais têm fórmulas e gráficos nativos editáveis. Os dados são uma fotografia no download. Metas/regras são a posição atual; os orçamentos usam limites atuais. Fórmulas recalculam linhas existentes, mas não expandem automaticamente referências para novos registros. Para atualizar o acompanhamento, gere outro arquivo; editar o Excel não atualiza o aplicativo. Exportações contêm valores completos, mesmo quando ocultos na tela. Limites: dez anos, 50 mil lançamentos por arquivo e uma geração simultânea por conta.

**ATUALIZACAO.md** contém o guia de uso, regras detalhadas e instalação sobre a versão anterior sem perder dados.

## Dados e autenticação

O arquivo `data/database.json` é criado automaticamente, com gravação por substituição atômica. Contém contas, sessões e os registros. As senhas são armazenadas com **bcrypt, custo 12**. Os tokens são aleatórios, expiram em 30 dias e ficam armazenados por hash no servidor. O navegador mantém o token de sessão em localStorage.

A API exige autenticação e acessa somente os dados da conta correspondente. O servidor valida IDs, datas, valores, tipos e categorias. Rotas de autenticação têm limitação básica de tentativas.

**O banco é adequado a uma implantação pequena, com um único processo e disco persistente.** Não use múltiplas réplicas gravando no mesmo arquivo. Para uso em maior escala, migre para um banco transacional, reforce a autenticação e a política de sessões, implemente monitoramento e cópias de segurança.

Os arquivos de dados não estão incluídos no ZIP de entrega. As contas, os valores financeiros e as conversas do site de referência não foram importados.

## IA generativa opcional

Sem chave, o assistente usa **regras locais**, e a interface informa essa limitação. Ele responde a assuntos como orçamento, análise dos gastos, metas, reserva e conceitos básicos de investimento. Não representa uma IA generativa conectada.

Para habilitar um serviço compatível com a API de chat completions, configure no **servidor**:

```bash
export AI_API_KEY='sua-chave-no-servidor'
export AI_MODEL='modelo-disponivel-na-sua-conta'
export AI_API_URL='https://api.openai.com/v1/chat/completions'
npm start
```

`AI_API_URL` é opcional (padrão acima); `AI_MODEL` tem padrão `gpt-4o-mini`. Confirme a disponibilidade e o preço do modelo com seu fornecedor. Você também pode copiar `.env.example` para `.env` e preencher as variáveis; o servidor carrega esse arquivo ao iniciar.

**Não coloque a chave em arquivos do frontend ou em variáveis `VITE_*`.** A integração, quando ativada, envia ao fornecedor valores agregados do mês, informações de metas e mensagens recentes. Avalie o aviso de privacidade e obtenha o consentimento necessário antes de habilitá-la para outras pessoas. Podem existir custos do fornecedor. A integração externa não foi testada com uma chave real nesta entrega.

## O que não está conectado

- **Login com Google**, confirmação de e-mail e **recuperação de senha por e-mail** não estão implementados. O cadastro/login por e-mail e senha é local e funcional, mas não envia e-mails.
- Não há sincronização com a base original do Base44.
- Não há conexão bancária/Open Finance, pagamentos, importação de extratos ou cotações de investimento.
- Não foi publicado em um domínio definitivo. A prévia da entrega executa o aplicativo, mas não substitui uma contratação de hospedagem permanente.
- O visual reproduz a referência acessível; textos educativos e dados de demonstração foram criados para esta implementação, e algumas melhorias de interface foram acrescentadas. Não é uma cópia do código-fonte privado.

Essas dependências externas não são simuladas como integrações concluídas.

## Publicação

Use uma hospedagem com Node.js e **volume persistente para `data/`**, HTTPS e uma única instância do processo. Faça `npm ci`, `npm run build` e execute `npm start`. Nunca sirva a pasta `data/` publicamente. A versão de produção serve somente o diretório compilado `dist/` e a API.

Antes de receber dados financeiros reais, revise segurança, LGPD, política de privacidade, backups, retenção/exclusão de dados, recuperação de acesso e integração de e-mail. A demonstração não substitui uma auditoria de segurança.

### Docker (opcional)

```bash
docker build -t yfinance .
docker run --rm -p 3000:3000 -v yfinance-data:/app/data yfinance
```

## Testes

Com o servidor em execução em outro terminal:

```bash
npx playwright install --with-deps chromium
npm test
npm run test:education
npm run test:finance
```

Para outra URL, defina `TEST_URL`. Os testes usam dados fictícios e criam contas de teste isoladas. Cobrem inclusão/edição/exclusão de despesas, receitas, metas e aportes, categorias, orçamento, pesquisa, filtros, CSV, tema, perfil, aulas, desafios, assistente local, responsividade, cadastro, login/logout, autenticação e isolamento entre contas. Capturas e relatório são gravados em `qa/`.

## Organização e formatação

O projeto usa **Prettier**, com configuração em `.prettierrc.json`, e **EditorConfig**, em `.editorconfig`. A formatação padroniza indentação de dois espaços, aspas duplas, ponto e vírgula e finais de linha LF.

```bash
npm run format
npm run format:check
```

O primeiro comando formata o código e a documentação. O segundo apenas verifica, sem modificar arquivos. Dependências, build, dados privados, recursos estáticos e arquivos gerados são ignorados por `.prettierignore`.

O pacote final não inclui capturas de tela, logs de teste, planilhas de demonstração, versões antigas do ZIP, `node_modules`, `dist`, `.env` ou `data`. Os testes automatizados foram mantidos porque validam o funcionamento do aplicativo. Ao executar os testes, a pasta `qa/` pode ser criada novamente; para remover esses resultados:

```bash
npm run clean:qa
```

Esse comando remove somente `qa/`, sem alterar contas, lançamentos, configurações ou código. **Não apague `data/` ou seu `.env` ao atualizar.** `node_modules/` e `dist/` são gerados na instalação/build e não precisam ser distribuídos no ZIP.

## Estrutura

```text
server.js            API Express, autenticação, persistência e análise local
src/main.jsx         Interface React e fluxos de interação
src/style.css        Tema, componentes e adaptação a celulares
src/FinanceTools.jsx Recorrências, relatórios, alertas e cartão de Excel no chat
src/finance-tools.css Layout das novas áreas
lib/automation.js    Calendário, ocorrências e alertas deduplicados
lib/reports.js       Excel, fórmulas, valores calculados e gráficos OOXML
lib/report-intent.js Reconhecimento local dos pedidos de planilha
src/lessons.js       Estrutura das trilhas e desafios gerais legados
src/EducationHub.jsx Leitor, desafios, quizzes e progresso
src/curriculum.js    Conteúdos aprofundados, atividades e gabaritos
src/education.css    Layout da experiência educacional
public/fonts/        Fonte Inter local e licença OFL
public/images/       Novo logotipo azul fornecido pelo usuário, com fundo transparente
public/favicon-*.png Ícones do aplicativo
index.html           Entrada do frontend
package-lock.json    Dependências fixadas
Dockerfile           Implantação opcional
.env.example         Configuração opcional de IA
tests.mjs            Testes de ponta a ponta
tests-education.mjs  Testes de educação
tests-finance.mjs    Automação, alertas, Excel, API e interface
```

Tecnologias: React, Vite, Express, bcryptjs, Lucide, ExcelJS, JSZip e Playwright. A fonte Inter e os ícones mantêm as licenças de seus respectivos projetos.

## Educação financeira preservada

Consulte **EDUCACAO.md** para as regras de leitura, prática e avaliação. A seção educacional inclui 17 desafios opcionais e 51 questões com correção pelo servidor, rascunhos salvos, histórico de tentativas e melhor nota preservada. O comando `npm run test:education` executa a verificação específica das aulas.
