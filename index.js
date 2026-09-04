import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

/**
 * Formata data/hora.
 */
function formatDateTime(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).format(date);
}

/**
 * Monta URL de um artigo do TabNews.
 */
function articleUrl(content) {
  return `https://www.tabnews.com.br/${content.owner_username}/${content.slug}`;
}

const artigoTabNewsOutputSchema = z.object({
  titulo: z.string(),
  url: z.string().url(),
  trecho: z.string(),
});

const metricasTabNews = {
  chamadasBuscarConteudo: 0,
  chamadasBuscarArtigo: 0,
  chamadasApiLista: 0,
  chamadasApiDetalhe: 0,
};

/**
 * Busca um conteúdo aleatório do TabNews.
 */
/**
 * Remove marcacoes comuns de Markdown/HTML para gerar
 * um trecho simples de texto.
 */
function limparTexto(texto) {
  return String(texto ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_\-~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limita um texto para ser usado como trecho.
 */
function limitarTrecho(texto, limite = 180) {
  const textoLimpo = limparTexto(texto);

  if (textoLimpo.length <= limite) {
    return textoLimpo;
  }

  return `${textoLimpo.slice(0, limite).trim()}...`;
}

async function buscarConteudoAleatorioTabNews() {
  metricasTabNews.chamadasBuscarConteudo += 1;

  const page = Math.floor(Math.random() * 20) + 1;
  const perPage = 30;

  const endpoint =
    `https://www.tabnews.com.br/api/v1/contents` +
    `?strategy=new&page=${page}&per_page=${perPage}`;

  metricasTabNews.chamadasApiLista += 1;

  console.error(
    `[TabNews] buscarConteudoAleatorioTabNews chamada ` +
      `#${metricasTabNews.chamadasBuscarConteudo}; ` +
      `API lista #${metricasTabNews.chamadasApiLista}; ` +
      `endpoint=${endpoint}`
  );

  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
    },
  });

  console.error(
    `[TabNews] API lista respondeu: ` +
      `${response.status} ${response.statusText}`
  );

  if (!response.ok) {
    throw new Error(
      `Falha ao consultar TabNews: ` +
      `${response.status} ${response.statusText}`
    );
  }

  const contents = await response.json();

  if (!Array.isArray(contents) || contents.length === 0) {
    throw new Error(
      'Falha ao consultar TabNews: nenhum conteudo encontrado.'
    );
  }

  return contents[
    Math.floor(Math.random() * contents.length)
  ];
}

/**
 * Captura um artigo aleatorio do TabNews com um trecho
 * de seu conteudo.
 */
async function buscarArtigoAleatorioTabNews() {
  metricasTabNews.chamadasBuscarArtigo += 1;

  console.error(
    `[TabNews] buscarArtigoAleatorioTabNews chamada ` +
      `#${metricasTabNews.chamadasBuscarArtigo}`
  );

  const content = await buscarConteudoAleatorioTabNews();

  const url = articleUrl(content);
  let body = content.body;

  if (!body) {
    const detalheEndpoint =
      `https://www.tabnews.com.br/api/v1/contents/` +
      `${content.owner_username}/${content.slug}`;

    metricasTabNews.chamadasApiDetalhe += 1;

    console.error(
      `[TabNews] API detalhe #${metricasTabNews.chamadasApiDetalhe}; ` +
        `endpoint=${detalheEndpoint}`
    );

    const detalheResponse = await fetch(detalheEndpoint, {
      headers: {
        Accept: 'application/json',
      },
    });

    console.error(
      `[TabNews] API detalhe respondeu: ` +
        `${detalheResponse.status} ${detalheResponse.statusText}`
    );

    if (detalheResponse.ok) {
      const detalhe = await detalheResponse.json();
      body = detalhe.body;
    }
  } else {
    console.error(
      '[TabNews] Conteudo da lista ja possui body; API detalhe nao chamada.'
    );
  }

  const trecho =
    limitarTrecho(body) ||
    limitarTrecho(content.title) ||
    'Trecho indisponivel.';

  return {
    titulo: content.title,
    url,
    trecho,
  };
}

/**
 * Lista os componentes que devem ser processados.
 *
 * No cenário real, essa função pode futuramente
 * obter os componentes através da API responsável
 * pela identificação.
 */
async function listarComponentes() {
  return [
    'header',
    'body',
    'html',
    'css',
  ];
}

/**
 * Envia um componente para a API e captura
 * posteriormente sua resposta.
 */
async function enviarComponente(componente) {
  const respostaEsperada =
    `Acessibilidade componente ${componente}`;

  const artigoTabNews =
    await buscarArtigoAleatorioTabNews();

  const respostaComArtigo =
    `${respostaEsperada} + ${artigoTabNews.trecho}`;

  const body = {
    componente,
  };

  /**
   * POST
   *
   * Simula o envio do componente para uma API.
   */
  const postEndpoint =
    'https://postman-echo.com/post';

  const postResponse = await fetch(postEndpoint, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },

    body: JSON.stringify(body),
  });

  if (!postResponse.ok) {
    throw new Error(
      `Falha ao enviar componente ${componente}: ` +
      `${postResponse.status} ${postResponse.statusText}`
    );
  }

  /**
   * GET
   *
   * Simula a recuperação do resultado.
   */
  const getEndpoint =
    `https://postman-echo.com/get?resposta=` +
    encodeURIComponent(respostaComArtigo);

  const getResponse = await fetch(getEndpoint, {
    method: 'GET',

    headers: {
      Accept: 'application/json',
    },
  });

  if (!getResponse.ok) {
    throw new Error(
      `Falha ao capturar componente ${componente}: ` +
      `${getResponse.status} ${getResponse.statusText}`
    );
  }

  const data = await getResponse.json();

  const respostaCapturada =
    data.args?.resposta;

  if (!respostaCapturada) {
    throw new Error(
      'Falha ao capturar componente: ' +
      'campo args.resposta ausente na resposta da API.'
    );
  }

  return {
    componente,
    postEndpoint,
    getEndpoint,
    bodyEnviado: body,
    artigoTabNews,
    respostaCapturada,
  };
}

/**
 * Monta o prompt final utilizando o resultado
 * de todos os componentes.
 */
function montarPromptPronto(resultados) {
  const conteudo = resultados
    .map((resultado) => resultado.respostaCapturada)
    .join('\n');

  return `PROMPT PRONTO = ${conteudo}`;
}

/**
 * ============================================================
 * ORQUESTRADOR DO FLUXO
 * ============================================================
 *
 * Essa função executa TODO o processamento.
 *
 * IMPORTANTE:
 *
 * Ela NÃO é uma Tool MCP.
 *
 * É uma função interna do servidor.
 *
 * Dessa forma, não dependemos do host/LLM para decidir
 * se deve chamar outra tool.
 *
 * Fluxo:
 *
 * listar componentes
 *       ↓
 * enviar header
 * enviar body
 * enviar html
 * enviar css
 *       ↓
 * capturar resultados
 *       ↓
 * montar promptPronto
 */
async function processarFluxoComponentes(
  componentesInput
) {
  let componentes;

  /**
   * Permite reutilizar a função passando componentes
   * manualmente ou utilizando a lista padrão.
   */
  if (
    Array.isArray(componentesInput) &&
    componentesInput.length > 0
  ) {
    componentes = componentesInput.map(
      (item) =>
        typeof item === 'string'
          ? item
          : item.componente
    );
  } else {
    componentes = await listarComponentes();
  }

  console.error(
    `Componentes identificados: ${componentes.join(', ')}`
  );

  /**
   * Executa as chamadas em paralelo.
   */
  const resultados = await Promise.all(
    componentes.map(async (componente) => {
      console.error(
        `Processando componente: ${componente}`
      );

      const resultado =
        await enviarComponente(componente);

      console.error(
        `Componente processado: ${componente}`
      );

      return resultado;
    })
  );

  /**
   * Somente depois que TODOS os componentes
   * terminarem o prompt final é criado.
   */
  const promptPronto =
    montarPromptPronto(resultados);

  return {
    componentes,
    resultados,
    promptPronto,
  };
}

/**
 * ============================================================
 * SERVIDOR MCP
 * ============================================================
 */

const handle = serveStdio(() => {
  const server = new McpServer({
    name: 'servidor-saudacao',
    title: 'Servidor de Saudacao',
    version: '1.3.0',

    description:
      'Servidor MCP com fluxo automatico de processamento de componentes.',
  });

  /**
   * ==========================================================
   * TOOL - TABNEWS
   * ==========================================================
   */

  server.registerTool(
    'artigos_tabnews',

    {
      title: 'Artigos do TabNews',

      description:
        'Consulta os conteudos recentes do TabNews e retorna o titulo e a URL de cada artigo.',

      inputSchema: z.object({
        limite: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(10)
          .describe(
            'Quantidade maxima de artigos a retornar.'
          ),
      }),

      outputSchema: z.object({
        artigos: z.array(
          z.object({
            titulo: z.string(),
            url: z.string().url(),
          })
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
      const response = await fetch(
        'https://www.tabnews.com.br/api/v1/contents'
      );

      if (!response.ok) {
        throw new Error(
          `Falha ao consultar TabNews: ` +
          `${response.status} ${response.statusText}`
        );
      }

      const contents = await response.json();

      const artigos = contents
        .slice(0, limite)
        .map((content) => ({
          titulo: content.title,
          url: articleUrl(content),
        }));

      return {
        content: [
          {
            type: 'text',

            text: artigos
              .map(
                (artigo) =>
                  `${artigo.titulo} - ${artigo.url}`
              )
              .join('\n'),
          },
        ],

        structuredContent: {
          artigos,
        },
      };
    }
  );

  /**
   * ==========================================================
   * TOOL A - FLUXO AUTOMÁTICO
   * ==========================================================
   *
   * Esta é a principal mudança.
   *
   * Antes:
   *
   * tool_a_componentes
   *        ↓
   * retorna instrução para LLM
   *        ↓
   * LLM decide se chama processar_componentes
   *
   *
   * Agora:
   *
   * tool_a_componentes
   *        ↓
   * listarComponentes()
   *        ↓
   * processarFluxoComponentes()
   *        ↓
   * enviarComponente()
   *        ↓
   * montarPromptPronto()
   *        ↓
   * promptPronto
   *
   * Não existe mais uma decisão intermediária do LLM.
   */

  server.registerTool(
    'tool_a_componentes',

    {
      title:
        'Tool A - Processar Componentes',

      description:
        'Identifica os componentes, processa automaticamente cada componente e retorna o promptPronto final. O fluxo completo ocorre dentro desta chamada.',

      inputSchema: z.object({}),

      outputSchema: z.object({
        componentes: z.array(
          z.string()
        ),

        promptPronto: z.string(),

        resultados: z.array(
          z.object({
            componente: z.string(),

            postEndpoint:
              z.string().url(),

            getEndpoint:
              z.string().url(),

            bodyEnviado:
              z.object({
                componente:
                  z.string(),
              }),

            artigoTabNews:
              artigoTabNewsOutputSchema,

            respostaCapturada:
              z.string(),
          })
        ),
      }),

      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },

    async () => {
      console.error(
        'Iniciando fluxo automatico de componentes...'
      );

      /**
       * Uma única chamada executa tudo.
       */
      const {
        componentes,
        resultados,
        promptPronto,
      } =
        await processarFluxoComponentes();

      console.error(
        'Fluxo de componentes concluido.'
      );

      /**
       * A resposta da Tool A já é FINAL.
       *
       * Não existe:
       *
       * proximaTool
       * instrucaoContinuacao
       * fluxoCompletoTool
       * rascunhoPromptNaoFinal
       *
       * Portanto, o host não precisa tomar
       * nenhuma decisão intermediária.
       */
      return {
        content: [
          {
            type: 'text',
            text: promptPronto,
          },
        ],

        structuredContent: {
          componentes,
          promptPronto,
          resultados,
        },
      };
    }
  );

  /**
   * ==========================================================
   * TOOL B - PROCESSAMENTO INDIVIDUAL
   * ==========================================================
   *
   * Mantida caso seja necessário testar/processar
   * apenas um componente manualmente.
   *
   * A Tool A NÃO depende dela.
   */

  server.registerTool(
    'tool_b_enviar_componente',

    {
      title:
        'Tool B - Enviar Componente',

      description:
        'Processa manualmente um unico componente. Esta tool nao e necessaria para o fluxo automatico da Tool A.',

      inputSchema: z.object({
        componente: z
          .string()
          .trim()
          .min(1)
          .describe(
            'Nome do componente que deve ser processado.'
          ),
      }),

      outputSchema: z.object({
        componente:
          z.string(),

        postEndpoint:
          z.string().url(),

        getEndpoint:
          z.string().url(),

        bodyEnviado:
          z.object({
            componente:
              z.string(),
          }),

        artigoTabNews:
          artigoTabNewsOutputSchema,

        respostaCapturada:
          z.string(),
      }),

      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },

    async ({ componente }) => {
      console.error(
        `Processando componente individual: ${componente}`
      );

      const resultado =
        await enviarComponente(componente);

      return {
        content: [
          {
            type: 'text',
            text:
              resultado.respostaCapturada,
          },
        ],

        structuredContent:
          resultado,
      };
    }
  );

  /**
   * ==========================================================
   * TOOL PROCESSAR COMPONENTES
   * ==========================================================
   *
   * Mantida como endpoint MCP independente para
   * testes ou chamadas explícitas.
   *
   * IMPORTANTE:
   *
   * tool_a_componentes NÃO precisa chamar esta tool.
   *
   * Ambas reutilizam a mesma função interna:
   *
   * processarFluxoComponentes()
   */

  server.registerTool(
    'processar_componentes',

    {
      title:
        'Processar Componentes',

      description:
        'Executa explicitamente o processamento de uma lista de componentes e retorna o promptPronto.',

      inputSchema: z.object({
        componentes: z
          .array(
            z.object({
              componente: z
                .string()
                .trim()
                .min(1),
            })
          )
          .optional()
          .describe(
            'Lista opcional de componentes. Quando omitida, utiliza a lista padrao.'
          ),
      }),

      outputSchema: z.object({
        promptPronto:
          z.string(),

        resultados:
          z.array(
            z.object({
              componente:
                z.string(),

              postEndpoint:
                z.string().url(),

              getEndpoint:
                z.string().url(),

              bodyEnviado:
                z.object({
                  componente:
                    z.string(),
                }),

              artigoTabNews:
                artigoTabNewsOutputSchema,

              respostaCapturada:
                z.string(),
            })
          ),
      }),

      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },

    async ({
      componentes:
        componentesInput,
    }) => {
      console.error(
        'Executando processar_componentes...'
      );

      const {
        resultados,
        promptPronto,
      } =
        await processarFluxoComponentes(
          componentesInput
        );

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
    }
  );

  return server;
});

/**
 * ============================================================
 * SHUTDOWN
 * ============================================================
 */

process.on('SIGINT', () => {
  void handle
    .close()
    .then(() =>
      process.exit(0)
    );
});

console.error(
  'Servidor MCP ouvindo via stdio.'
);
