# Educação financeira — conteúdo, prática e quizzes

## O que mudou

- As **17 aulas** agora têm objetivos de aprendizagem, três explicações aprofundadas em formato de perguntas, um caso resolvido, um erro comum e um resumo.
- Cada aula tem **um desafio opcional**, com três etapas e uma reflexão. São **17 desafios específicos**, além dos três desafios gerais anteriores.
- Cada aula termina com um **quiz de três perguntas**, totalizando **51 questões** sobre os conceitos e cenários estudados.
- Cada resposta corrigida tem uma explicação. O usuário pode tentar novamente sem limite.
- Aprovação: **pelo menos dois acertos em três**. A melhor nota continua salva mesmo se uma tentativa posterior tiver resultado menor.
- Novas abas de desafios, quizzes e progresso permitem acompanhar leitura, prática e conhecimento separadamente.

## Como funciona para o aluno

### Leitura

A conclusão de uma aula continua sendo uma marcação explícita de leitura. Ela não exige realizar o desafio ou obter aprovação no quiz. Desmarcar a leitura não apaga atividades ou resultados.

### Desafio opcional

O usuário pode iniciar a prática, marcar as três etapas e escrever uma reflexão. As etapas são salvas a cada alteração. A reflexão tem botão **Salvar reflexão** e aviso quando ainda não foi salva. Para concluir, é necessário marcar as três etapas e escrever pelo menos 20 caracteres. O botão **Concluir desafio** também salva a reflexão. É possível reabrir a prática para revisá-la.

Todas as atividades permitem cenários fictícios. Não é necessário gastar, investir ou contratar crédito. Não inclua senhas, documentos ou números de contas nas reflexões.

### Quiz

As escolhas são salvas no servidor a cada resposta, inclusive quando o quiz ainda não foi enviado. Antes da correção, elas podem ser alteradas. O servidor exige todas as respostas e calcula a nota usando o gabarito — ele não aceita uma nota calculada pelo cliente.

Depois de corrigir, a página mostra nota, resultado e explicação de cada questão. **Tentar novamente** inicia um novo rascunho sem apagar a melhor nota. As últimas 20 tentativas ficam no histórico, com contagem total e melhor nota preservadas.

Os quizzes são ferramentas educativas, não exames certificados ou provas com gabarito confidencial.

## Compatibilidade e dados

O campo `learning` é acrescentado conforme o usuário realiza atividades. Aulas concluídas e os três desafios gerais antigos continuam salvos. As operações educacionais não modificam receitas, despesas, metas ou categorias.

As reflexões e os resultados são dados da conta e também aparecem na exportação JSON de Configurações. A demonstração salva o progresso na sua sessão individual; uma conta permite retomá-lo após entrar novamente.

## Verificações realizadas

- Conteúdo e gabaritos das 17 aulas.
- Correção das 51 questões no servidor, tentativas incorretas e corretas.
- Rejeição de respostas inválidas, quiz incompleto e tentativa de enviar uma nota forjada.
- Desafios, etapas, reflexão mínima, conclusão e reabertura.
- Respostas parciais e resultados após recarregar a página.
- Preservação da melhor nota, do progresso anterior e dos registros financeiros.
- Isolamento entre usuários.
- Navegação e layout em 390 px, 768 px e 1440 px.
- Testes de regressão dos fluxos financeiros, cadastro e login.

Com o servidor em execução, você pode repetir os testes:

```bash
npx playwright install --with-deps chromium
npm test
npm run test:education
```
