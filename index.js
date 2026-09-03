import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

function formatDateTime(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(date);
}

function articleUrl(content) {
  return `https://www.tabnews.com.br/${content.owner_username}/${content.slug}`;
}

async function listarComponentes() {
  return ['header', 'body', 'html', 'css'];
}

function contratoComponentes(componentes) {
  return {
    componentes,
    proximaTool: 'tool_b_enviar_componente',
    modoChamada: 'uma_chamada_por_componente',
    parametroDestino: 'componente',
    fluxoCompletoTool: 'processar_componentes',
  };
}

async function enviarComponente(componente) {
  const respostaEsperada = `Acessibilidade componente ${componente}`;
  const body = {
    componente,
  };

  const postEndpoint = 'https://postman-echo.com/post';
  const postResponse = await fetch(postEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!postResponse.ok) {
    throw new Error(`Falha ao enviar componente: ${postResponse.status} ${postResponse.statusText}`);
  }

  const getEndpoint = `https://postman-echo.com/get?resposta=${encodeURIComponent(respostaEsperada)}`;
  const getResponse = await fetch(getEndpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!getResponse.ok) {
    throw new Error(`Falha ao capturar componente: ${getResponse.status} ${getResponse.statusText}`);
  }

  const data = await getResponse.json();
  const respostaCapturada = data.args?.resposta;

  if (!respostaCapturada) {
    throw new Error('Falha ao capturar componente: campo args.resposta ausente na resposta da API.');
  }

  return {
    componente,
    postEndpoint,
    getEndpoint,
    bodyEnviado: body,
    respostaCapturada,
  };
}

function montarPromptPronto(resultados) {
  return `PROMPT PRONTO = ${resultados.map((resultado) => resultado.respostaCapturada).join('\n')}`;
}

const handle = serveStdio(() => {
  const server = new McpServer({
    name: 'servidor-saudacao',
    title: 'Servidor de Saudacao',
    version: '1.2.0',
    description: 'Servidor MCP simples com saudacao, consulta ao TabNews e fluxo entre ferramentas.',
  });

  server.registerTool(
    'saudacao',
    {
      title: 'Saudacao Amistosa',
      description: 'Retorna uma saudacao calorosa com a data, hora e fuso horario atuais.',
      inputSchema: z.object({
        nome: z.string().trim().min(1).optional().describe('Nome da pessoa a cumprimentar.'),
      }),
      outputSchema: z.object({
        mensagem: z.string(),
        dataHoraIso: z.string(),
        fusoHorario: z.string(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ nome }) => {
      const agora = new Date();
      const fusoHorario = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const destinatario = nome ? `, ${nome}` : '';

      const output = {
        mensagem: `Ola${destinatario}! Que bom te ver por aqui. Agora e ${formatDateTime(agora)}. Espero que seu dia esteja leve e produtivo!`,
        dataHoraIso: agora.toISOString(),
        fusoHorario,
      };

      return {
        content: [{ type: 'text', text: output.mensagem }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    'artigos_tabnews',
    {
      title: 'Artigos do TabNews',
      description: 'Consulta os conteudos recentes do TabNews e retorna o titulo e a URL de cada artigo.',
      inputSchema: z.object({
        limite: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(10)
          .describe('Quantidade maxima de artigos a retornar.'),
      }),
      outputSchema: z.object({
        artigos: z.array(
          z.object({
            titulo: z.string(),
            url: z.string().url(),
          }),
        ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ limite }) => {
      const response = await fetch('https://www.tabnews.com.br/api/v1/contents');

      if (!response.ok) {
        throw new Error(`Falha ao consultar TabNews: ${response.status} ${response.statusText}`);
      }

      const contents = await response.json();
      const artigos = contents.slice(0, limite).map((content) => ({
        titulo: content.title,
        url: articleUrl(content),
      }));

      return {
        content: [
          {
            type: 'text',
            text: artigos.map((artigo) => `${artigo.titulo} - ${artigo.url}`).join('\n'),
          },
        ],
        structuredContent: { artigos },
      };
    },
  );

  server.registerTool(
    'tool_a_componentes',
    {
      title: 'Tool A - Componentes',
      description:
        'Retorna um contrato com a lista de componentes e instrui que cada item deve ser enviado para tool_b_enviar_componente. Para executar tudo em uma chamada, use processar_componentes.',
      inputSchema: z.object({}),
      outputSchema: z.object({
        componentes: z.array(z.string()),
        proximaTool: z.literal('tool_b_enviar_componente'),
        modoChamada: z.literal('uma_chamada_por_componente'),
        parametroDestino: z.literal('componente'),
        fluxoCompletoTool: z.literal('processar_componentes'),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const componentes = await listarComponentes();
      const contrato = contratoComponentes(componentes);

      return {
        content: [
          {
            type: 'text',
            text: `Componentes: ${componentes.join(', ')}. Proxima tool: ${contrato.proximaTool} (${contrato.modoChamada}).`,
          },
        ],
        structuredContent: contrato,
      };
    },
  );

  server.registerTool(
    'tool_b_enviar_componente',
    {
      title: 'Tool B - Enviar Componente',
      description: 'Recebe o nome de um componente e envia esse valor no body para uma API publica.',
      inputSchema: z.object({
        componente: z.string().trim().min(1).describe('Nome do componente vindo da Tool A.'),
      }),
      outputSchema: z.object({
        componente: z.string(),
        postEndpoint: z.string().url(),
        getEndpoint: z.string().url(),
        bodyEnviado: z.object({
          componente: z.string(),
        }),
        respostaCapturada: z.string(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ componente }) => {
      console.error('Aguardando...');
      const resultado = await enviarComponente(componente);
      const promptPronto = montarPromptPronto([resultado]);

      return {
        content: [
          {
            type: 'text',
            text: promptPronto,
          },
        ],
        structuredContent: resultado,
      };
    },
  );

  server.registerTool(
    'processar_componentes',
    {
      title: 'Processar Componentes',
      description:
        'Executa o fluxo completo recomendado: envia cada componente para a API publica, captura cada GET e retorna o prompt pronto.',
      inputSchema: z.object({
        componentes: z
          .array(z.object({ componente: z.string().trim().min(1) }))
          .optional()
          .describe('Lista opcional de componentes. Quando omitida, usa a lista padrao da Tool A.'),
      }),
      outputSchema: z.object({
        promptPronto: z.string(),
        resultados: z.array(
          z.object({
            componente: z.string(),
            postEndpoint: z.string().url(),
            getEndpoint: z.string().url(),
            bodyEnviado: z.object({
              componente: z.string(),
            }),
            respostaCapturada: z.string(),
          }),
        ),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ componentes: componentesInput }) => {
      console.error('Aguardando...');
      const componentes = componentesInput?.map((item) => item.componente) ?? (await listarComponentes());
      const resultados = await Promise.all(componentes.map((componente) => enviarComponente(componente)));
      const promptPronto = montarPromptPronto(resultados);

      return {
        content: [
          {
            type: 'text',
            text: promptPronto,
          },
        ],
        structuredContent: {
          promptPronto,
          resultados,
        },
      };
    },
  );

  return server;
});

process.on('SIGINT', () => {
  void handle.close().then(() => process.exit(0));
});

console.error('Servidor MCP de saudacao ouvindo via stdio.');
