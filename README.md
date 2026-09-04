# mcp-server-training

Servidor MCP de treinamento para demonstrar um fluxo completo de processamento de componentes em uma unica chamada de tool.

O ponto principal desta solucao e mostrar a diferenca entre:

- uma tool MCP exposta para o host/LLM;
- funcoes internas do servidor, chamadas diretamente pelo codigo;
- um fluxo deterministico, em que a Tool A retorna o resultado final sem pedir que o LLM decida a proxima etapa.

## Ideia da solucao

A tool principal é `tool_a_componentes`.

Quando ela é chamada, o servidor executa todo o fluxo internamente:

```text
tool_a_componentes
      |
      v
listarComponentes()
      |
      v
processarFluxoComponentes()
      |
      v
enviarComponente(header/body/html/css)
      |
      v
montarPromptPronto()
      |
      v
promptPronto
```

Ou seja: `tool_a_componentes` nao retorna uma instrucao para o LLM chamar outra tool depois. Ela chama uma funcao interna do proprio servidor (`processarFluxoComponentes`) e devolve o `promptPronto` final.

## Por que nao fazer tool chamando tool?

Em MCP, tools sao pontos de entrada expostos para o host. Normalmente quem chama uma tool e o host/cliente MCP, muitas vezes mediado por um LLM.

Por isso, desenhar um fluxo assim e fragil:

```text
tool_a_componentes
      |
      v
retorna "agora chame processar_componentes"
      |
      v
LLM decide se chama ou nao a proxima tool
      |
      v
processar_componentes
```

Esse modelo depende de uma decisao intermediaria do LLM. Mesmo que a resposta da Tool A diga claramente qual tool deve ser chamada, ainda existe uma camada externa decidindo se continua o fluxo, com quais argumentos e em qual momento.

Nesta solucao, a Tool A chama uma funcao estatica/interna do servidor. O fluxo fica deterministico:

```text
tool_a_componentes
      |
      v
processarFluxoComponentes()
      |
      v
resultado final
```

Assim, uma unica chamada MCP executa a orquestracao inteira.

## Fluxo implementado

1. `listarComponentes()` define a lista padrao de componentes:

```text
header, body, html, css
```

2. `processarFluxoComponentes()` recebe essa lista e cria um logger interno para registrar cada etapa.

3. Cada componente e processado por `enviarComponente(componente)`.

4. Para cada componente, o servidor:

- busca um artigo aleatorio do TabNews;
- monta uma resposta no formato `Acessibilidade componente <nome> + <trecho>`;
- simula um `POST` para `https://postman-echo.com/post`;
- simula um `GET` para capturar a resposta final;
- retorna os dados estruturados daquele componente.

5. Quando todos os componentes terminam, `montarPromptPronto()` junta as respostas em um unico texto final.

6. A tool `tool_a_componentes` retorna:

- `content`: texto final para exibicao;
- `structuredContent`: objeto com `componentes`, `logs`, `promptPronto` e `resultados`.

## Tools disponiveis

### `tool_a_componentes`

Tool principal do fluxo.

Ela nao recebe parametros. Ao ser chamada, identifica os componentes, processa todos eles e retorna o `promptPronto`.

Uso esperado:

```text
chamar tool_a_componentes
```

Resposta resumida:

```json
{
  "componentes": ["header", "body", "html", "css"],
  "promptPronto": "PROMPT PRONTO = ...",
  "logs": ["..."],
  "resultados": ["..."]
}
```

### `tool_b_enviar_componente`

Tool auxiliar para testar o processamento de um unico componente manualmente.

Ela existe para teste e depuracao, mas nao e usada pela Tool A.

Entrada:

```json
{
  "componente": "header"
}
```

### `processar_componentes`

Tool auxiliar para executar explicitamente o processamento de uma lista de componentes.

Ela tambem reutiliza a funcao interna `processarFluxoComponentes()`, mas nao e chamada pela Tool A.

Entrada opcional:

```json
{
  "componentes": [
    { "componente": "header" },
    { "componente": "body" }
  ]
}
```

### `artigos_tabnews`

Tool simples para consultar conteudos recentes do TabNews e retornar titulo e URL dos artigos.

## Logica central

A arquitetura segue esta separacao:

```text
Camada MCP
  registra tools e valida entrada/saida com Zod

Camada de orquestracao
  processarFluxoComponentes()

Camada de dominio/simulacao
  listarComponentes()
  enviarComponente()
  buscarArtigoAleatorioTabNews()
  montarPromptPronto()
```

Essa separacao permite que o fluxo principal seja reaproveitado por mais de uma tool sem transformar uma tool em dependencia direta de outra.

## Como executar

Instale as dependencias:

```bash
npm install
```

## Configurar no VS Code

Este projeto inclui um script simples para instalar as dependencias e criar a
configuracao MCP de workspace em `.vscode/mcp.json`.

Execute:

```bash
bash setup-vscode-mcp.sh
```

Depois, no VS Code:

1. Abra este projeto como workspace.
2. Abra a Command Palette.
3. Execute `MCP: List Servers`.
4. Inicie o servidor `servidorSaudacao`.
5. No chat/agent mode, chame a tool `tool_a_componentes`.

O arquivo gerado usa o transporte `stdio` e executa:

```text
node ${workspaceFolder}/index.js
```

Inicie o servidor MCP via stdio:

```bash
npm start
```

Ou abra o inspector do MCP:

```bash
npm run inspect
```

## Resultado esperado

Ao chamar `tool_a_componentes`, o retorno final deve conter algo neste formato:

```text
PROMPT PRONTO = Acessibilidade componente header + ...
Acessibilidade componente body + ...
Acessibilidade componente html + ...
Acessibilidade componente css + ...
```

Esse resultado ja e final. O host MCP nao precisa chamar outra tool para concluir o fluxo.
