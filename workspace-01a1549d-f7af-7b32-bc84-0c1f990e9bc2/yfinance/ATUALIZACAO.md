# Atualização 1.2.4 — Projeto limpo e formatado

- Capturas de tela, logs, planilhas de teste e arquivos temporários removidos da pasta de desenvolvimento.
- Código e documentação formatados com **Prettier**. A dependência e os arquivos `.prettierrc.json`, `.prettierignore` e `.editorconfig` estão incluídos para manter o padrão.
- Comandos `npm run format` (formatar) e `npm run format:check` (verificar).
- Comando `npm run clean:qa` para remover somente os resultados gerados por novos testes.
- Código, recursos visuais, fontes e licença, testes automatizados, documentação e funcionalidades preservados. Nenhuma conta ou registro foi removido nesta limpeza.
- Tema azul e novo logotipo mantidos.

Use **YFinance-projeto.zip**. O pacote não inclui `data/`, `.env`, `node_modules/`, `dist/` ou `qa/`. Ao atualizar uma instalação existente, preserve seus dados e siga as instruções abaixo. Copiar os novos arquivos sobre a instalação não remove capturas antigas do seu computador; execute `npm run clean:qa` na pasta do projeto para limpar essa pasta, se ela existir.

---

# Atualização visual 1.2.3 — Azul royal e novo logotipo

O tema **azul royal foi restaurado**, com botões `#2563EB`, gradientes até `#1D4ED8` e destaques `#3B82F6`.

O símbolo anterior foi substituído pelo **novo logotipo azul enviado pelo usuário**, preservando seu desenho e suas cores. O fundo quadriculado da imagem foi removido para obter transparência real. A substituição aparece no menu lateral, cabeçalho móvel, telas de acesso, rodapé e ícones do navegador. Os endereços das imagens foram versionados para evitar o uso da imagem antiga em cache.

Vermelho permanece nos erros, indicadores negativos e avisos críticos; verde e amarelo sinalizam sucesso e atenção. Cores personalizadas de categorias e metas já cadastradas não são alteradas.

Esta versão inclui todas as funcionalidades abaixo. **Não apague a pasta `data` ou seu `.env`.** Use o novo arquivo **YFinance-projeto.zip** e siga as instruções de atualização mais abaixo.

> Se `npm ci` informar que falta `package-lock.json`, confirme a pasta antes de instalar. O ZIP contém uma pasta `yfinance`: entre nela com `cd .\yfinance` a partir da pasta de extração. Execute `dir package.json, package-lock.json`; os dois arquivos precisam aparecer. Não execute `npm init`.

---

# Atualização 1.2 — recorrências, alertas e Excel

Esta versão mantém as contas, as funcionalidades e a educação financeira anterior: **17 aulas, 17 desafios opcionais e 51 questões comentadas**.

## O que está pronto

### 1. Lançamentos recorrentes

Abra **Recorrências → Nova recorrência**. Escolha receita ou despesa, descrição, valor, categoria, pagamento, frequência e primeira data.

- Frequências diária, semanal, mensal e anual.
- Geração **automática no vencimento**. Se a primeira data for hoje, o lançamento é criado ao salvar; a tela avisa antes da confirmação.
- Data final e quantidade máxima de datas são opcionais.
- Edição das próximas ocorrências, pausa, retomada e encerramento.
- A tela informa status, próximo vencimento e quantos registros foram gerados. A tabela de receitas/despesas identifica a origem automática.
- Cada ocorrência tem um identificador próprio: verificar novamente não duplica os registros. Excluir uma ocorrência já gerada não faz com que ela reapareça.

**Importante:** isso automatiza o registro financeiro, **não faz pagamentos e não movimenta contas bancárias**.

#### Calendário e pausas

O calendário usa **America/Sao_Paulo**. Uma regra no dia 31 usa o último dia nos meses menores, voltando ao dia 31 quando ele existir. A mesma regra vale para 29 de fevereiro nas recorrências anuais.

Pausar não apaga o histórico. Ao retomar, datas anteriores a hoje são ignoradas; se hoje for vencimento, a ocorrência de hoje é gerada. A quantidade máxima limita as **datas do calendário**, incluindo as ignoradas durante pausas. Encerrar é definitivo; é possível criar uma regra semelhante.

Alterar valor, categoria ou descrição não modifica registros anteriores. Para mudar tipo, primeira data ou frequência, encerre a regra e crie outra.

#### Servidor ligado

O servidor verifica vencimentos ao iniciar, a cada **60 segundos** e nos acessos autenticados. **Precisa estar em execução para processar automaticamente.** Se ficar desligado, as regras ativas recuperam os vencimentos pendentes quando ele voltar. Fechar somente a aba do navegador não interrompe o servidor; fechar o terminal onde ele roda interrompe.

Para automação permanente, publique em uma hospedagem com processo Node.js continuamente ativo e armazenamento persistente. Use **uma única instância** deste banco em arquivo.

### 2. Alertas proativos de orçamento

1. Defina limites em **Configurações → Orçamentos mensais**.
2. Registre despesas ou deixe que as recorrências as criem.
3. Consulte o **sino no topo**. O Dashboard também sinaliza alertas não lidos.

- Avisos ao atingir **80%** e **100%** do orçamento de uma categoria no mês atual.
- Um aviso por nível/categoria/mês, sem repetição a cada acesso.
- Se um lançamento ultrapassar os dois níveis de uma vez, é criado somente o alerta de 100%.
- Leitura individual ou de todos os alertas; histórico persistente dos últimos 300 avisos.
- Os valores no histórico são os do momento do aviso. Reduzir despesas, alterar limites ou marcar como lido não reinicia a deduplicação desse mês.
- O navegador consulta atualizações a cada 30 segundos enquanto a aba estiver visível e ao voltar à aba.

**Somente dentro do aplicativo:** não envia e-mails, WhatsApp ou notificações push do sistema operacional.

### 3. Excel pelo assistente e pela área de relatórios

Abra **Relatórios Excel**, escolha o tipo, período e categoria, e clique em **Baixar Excel**. Também há um atalho Excel nas telas de receitas e despesas, preservando mês e categoria selecionados.

No **YFinance IA**, experimente:

- “Gere uma planilha completa deste mês.”
- “Quero uma planilha de despesas do mês passado.”
- “Excel de receitas dos últimos 3 meses.”
- “Planilha de despesas da categoria Alimentação.”
- “Planilha completa de 01/01/2026 a 30/09/2026.”
- “Planilha das minhas metas.”
- “Relatório de recorrências.”

O assistente mostra o tipo e o período identificados e um cartão com **Baixar Excel** e **Ajustar filtros**. Pedidos com datas/categorias ambíguas solicitam esclarecimento. O reconhecimento local atende os tipos e formatos documentados; não interpreta qualquer instrução arbitrária de montagem de planilhas.

#### Conteúdo dos arquivos

| Tipo         | Abas                                                                 |
| ------------ | -------------------------------------------------------------------- |
| Completo     | Resumo, Receitas, Despesas, Orçamentos, Metas, Recorrências, Leia-me |
| Despesas     | Resumo, Despesas, Leia-me                                            |
| Receitas     | Resumo, Receitas, Leia-me                                            |
| Orçamentos   | Resumo, Despesas, Orçamentos, Leia-me                                |
| Metas        | Resumo, Metas, Leia-me                                               |
| Recorrências | Resumo, Recorrências, Leia-me                                        |

São arquivos **.xlsx reais**, com valores numéricos, datas, formatação monetária, cabeçalhos fixos, filtros, fórmulas de totais e gráficos nativos editáveis quando há dados. O completo inclui evolução mensal e distribuição de despesas; os específicos de metas e recorrências têm gráficos próprios. Abas vazias são identificadas, sem inventar registros.

#### Escopo e limites

- A planilha usa **os dados atuais da conta autenticada no instante do download**. Baixar novamente um cartão antigo pode gerar valores atualizados.
- Datas e categoria filtram os lançamentos. Metas e regras de recorrência são a **posição atual**, não um histórico do período; esses dois relatórios específicos não aceitam filtro de categoria.
- Orçamentos usam os **limites atuais**, repetidos em cada mês. Períodos parciais não rateiam o limite.
- Saldo do período não é saldo bancário. Aportes em metas continuam separados do saldo.
- Fórmulas e gráficos atualizam valores em **linhas já existentes** no Excel/LibreOffice. As referências não se expandem automaticamente para novas linhas. Para acompanhar novos registros, gere uma planilha atualizada pelo aplicativo.
- Editar o Excel **não altera o aplicativo**. Não há sincronização bidirecional.
- Limites: dez anos por arquivo, 50 mil lançamentos selecionados, uma exportação simultânea por conta.
- O arquivo contém valores completos, mesmo se estiverem ocultos na tela. Nesse caso, o download pede confirmação. Guarde o arquivo em local seguro.
- Nome do titular e informações financeiras são incluídos. E-mail, senha, tokens, mensagens, reflexões e dados de outras contas não são exportados.
- Arquivos são gerados em memória e enviados por uma rota autenticada; não ficam em uma pasta pública do servidor.

A geração e os pedidos documentados **não precisam de chave de IA, Microsoft 365, Python ou serviços externos**. A integração generativa opcional continua separada e não foi testada com uma chave real.

## Como atualizar no seu computador — Windows

A prévia da conversa foi atualizada. Seu computador **não recebe o código automaticamente**.

1. Pare o servidor antigo com **Ctrl + C**.
2. Faça uma cópia de segurança da pasta **`data`**. Preserve também seu **`.env`**, se existir.
3. Extraia **`YFinance-projeto.zip`**.
4. Copie o **conteúdo da pasta `yfinance` extraída** para a pasta `yfinance` atual — a que já contém `package.json` e `server.js`. Aceite substituir os arquivos de código, incluindo `package-lock.json`. Copie também a nova pasta **`lib`**.
5. **Não exclua a instalação atual nem a pasta `data`.** O ZIP não inclui dados, credenciais ou `.env`; os novos campos são inicializados automaticamente sem apagar as contas ou o progresso anterior.
6. Abra o terminal na pasta correta. Se o projeto estiver em `Downloads`, ajuste o caminho ao seu computador:

```powershell
cd "C:\Users\SEU_USUARIO\Downloads\yfinance"
dir package.json
npm ci
npm run build
npm start
```

O arquivo `package.json` deve aparecer no comando `dir`. Se não aparecer, você ainda está na pasta errada. É necessário Node.js **20.19+ ou 22.12+**.

`npm start` agora é compatível também com Windows. Para desenvolvimento, pode usar `npm run dev`, sem o build; não publique esse modo como ambiente definitivo.

7. Acesse **http://localhost:3000** e atualize com **Ctrl + F5**. Os novos itens **Recorrências** e **Relatórios Excel** aparecem no menu, e o sino aparece no topo.
8. Mantenha o terminal aberto para o processamento automático local.

### Estrutura esperada

```text
yfinance/
├── package.json
├── package-lock.json
├── server.js
├── lib/
│   ├── automation.js
│   ├── report-intent.js
│   └── reports.js
├── src/
│   ├── main.jsx
│   ├── FinanceTools.jsx
│   ├── finance-tools.css
│   └── ... conteúdo educacional preservado
├── public/
└── data/                  ← sua pasta anterior; NÃO apagar
    └── database.json
```

## Verificações

Foram executados **15 grupos de testes desta atualização**, **12 grupos educacionais** e **20 grupos de regressão**, com dados fictícios em contas isoladas. Incluem calendário, idempotência, pausas, alertas, fórmulas/caches, arquivos baixados, isolamento de contas, chat, persistência, corrida de polling, formulários e telas móveis. Os XLSX também foram lidos por um segundo leitor independente para validar fórmulas, valores e gráficos; não houve teste manual no aplicativo Microsoft Excel.

Com o servidor rodando em outro terminal:

```powershell
npx playwright install chromium
npm test
npm run test:education
npm run test:finance
```

Em Linux, use `npx playwright install --with-deps chromium` se faltarem dependências. Os testes criam contas fictícias e capturas em `qa/`; não use contas reais para testes. A auditoria de dependências desta entrega reportou **zero vulnerabilidades conhecidas**, o que não substitui uma auditoria de segurança da aplicação.

Para os detalhes educacionais preservados, consulte **EDUCACAO.md**. Para implantação, segurança e limitações gerais, consulte **README.md**.
