import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';

/**
 * ============================================================
 * UTILITÁRIOS
 * ============================================================
 */

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

/**
 * ============================================================
 * SCHEMAS
 * ============================================================
 */

const artigoTabNewsOutputSchema = z
  .object({
    titulo: z.string(),
    url: z.string().url(),
    trecho: z.string(),
  })
  .strict();

const componenteResultadoOutputSchema = z
  .object({
    componente: z.string(),

    postEndpoint: z.string().url(),

    getEndpoint: z.string().url(),

    bodyEnviado: z
      .object({
        componente: z.string(),
      })
      .strict(),

    artigoTabNews: artigoTabNewsOutputSchema,

    respostaCapturada: z.string(),
  })
  .strict();

/**
 * Estrutura usada na resposta final da Tool A.
 */
const resultadoEstruturadoOutputSchema = z
  .object({
    TITULO: z.string(),

    CONTENT: z.string(),
  })
  .strict();

/**
 * Contrato canônico da Tool A.
 *
 * data:
 *   Estrutura para consumo por máquina/LLM/outras integrações.
 *
 * display:
 *   Conteúdo final pronto para ser apresentado ao usuário.
 *
 * A LLM não deve reconstruir a resposta usando "data".
 * Para apresentação visual deve utilizar "display".
 */
const toolAComponentesOutputSchema = z
  .object({
    tipo: z.literal('tool_a_componentes_resultado'),

    versaoTemplate: z.literal('2.0'),

    status: z.enum([
      'sucesso',
      'erro',
    ]),

    data: z
      .object({
        componentes: z.array(
          z.string()
        ),

        resultados: z.array(
          resultadoEstruturadoOutputSchema
        ),
      })
      .strict(),

    display: z.string(),
  })
  .strict();

/**
 * Contrato da tool processar_componentes.
 */
const processarComponentesOutputSchema = z
  .object({
    promptPronto: z.string(),

    logs: z.array(
      z.string()
    ),

    resultados: z.array(
      componenteResultadoOutputSchema
    ),
  })
  .strict();

/**
 * ============================================================
 * MÉTRICAS
 * ============================================================
 */

const metricasTabNews = {
  chamadasBuscarConteudo: 0,
  chamadasBuscarArtigo: 0,
  chamadasApiLista: 0,
  chamadasApiDetalhe: 0,
};

/**
 * ============================================================
 * TABNEWS
 * ============================================================
 */

/**
 * Remove marcações comuns de Markdown/HTML para gerar
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

/**
 * Busca um conteúdo aleatório do TabNews.
 */
async function buscarConteudoAleatorioTabNews(
  logger = console.error
) {
  metricasTabNews.chamadasBuscarConteudo += 1;

  const page =
    Math.floor(Math.random() * 20) + 1;

  const perPage = 30;

  const endpoint =
    `https://www.tabnews.com.br/api/v1/contents` +
    `?strategy=new&page=${page}&per_page=${perPage}`;

  metricasTabNews.chamadasApiLista += 1;

  logger(
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

  logger(
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

  if (
    !Array.isArray(contents) ||
    contents.length === 0
  ) {
    throw new Error(
      'Falha ao consultar TabNews: nenhum conteudo encontrado.'
    );
  }

  return contents[
    Math.floor(
      Math.random() * contents.length
    )
  ];
}

/**
 * Captura um artigo aleatório do TabNews com um trecho
 * de seu conteúdo.
 */
async function buscarArtigoAleatorioTabNews(
  logger = console.error
) {
  metricasTabNews.chamadasBuscarArtigo += 1;

  logger(
    `[TabNews] buscarArtigoAleatorioTabNews chamada ` +
      `#${metricasTabNews.chamadasBuscarArtigo}`
  );

  const content =
    await buscarConteudoAleatorioTabNews(
      logger
    );

  const url =
    articleUrl(content);

  let body =
    content.body;

  /**
   * Caso a listagem não tenha retornado body,
   * busca o detalhe do conteúdo.
   */
  if (!body) {
    const detalheEndpoint =
      `https://www.tabnews.com.br/api/v1/contents/` +
      `${content.owner_username}/${content.slug}`;

    metricasTabNews.chamadasApiDetalhe += 1;

    logger(
      `[TabNews] API detalhe ` +
        `#${metricasTabNews.chamadasApiDetalhe}; ` +
        `endpoint=${detalheEndpoint}`
    );

    const detalheResponse =
      await fetch(detalheEndpoint, {
        headers: {
          Accept: 'application/json',
        },
      });

    logger(
      `[TabNews] API detalhe respondeu: ` +
        `${detalheResponse.status} ` +
        `${detalheResponse.statusText}`
    );

    if (detalheResponse.ok) {
      const detalhe =
        await detalheResponse.json();

      body =
        detalhe.body;
    }
  } else {
    logger(
      '[TabNews] Conteudo da lista ja possui body; ' +
        'API detalhe nao chamada.'
    );
  }

  const trecho =
    limitarTrecho(body) ||
    limitarTrecho(content.title) ||
    'Trecho indisponivel.';

  return {
    titulo:
      content.title,

    url,

    trecho,
  };
}

/**
 * ============================================================
 * COMPONENTES
 * ============================================================
 */

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
async function enviarComponente(
  componente,
  logger = console.error
) {
  const respostaEsperada =
    `Acessibilidade componente ${componente}`;

  const artigoTabNews =
    await buscarArtigoAleatorioTabNews(
      logger
    );

  const respostaComArtigo =
    `${respostaEsperada} + ${artigoTabNews.trecho}`;

  const body = {
    componente,
  };

  /**
   * ==========================================================
   * POST
   * ==========================================================
   *
   * Simula o envio do componente para uma API.
   */

  const postEndpoint =
    'https://postman-echo.com/post';

  logger(
    `[Componente:${componente}] ` +
      `POST ${postEndpoint}`
  );

  const postResponse =
    await fetch(postEndpoint, {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',

        Accept:
          'application/json',
      },

      body:
        JSON.stringify(body),
    });

  if (!postResponse.ok) {
    throw new Error(
      `Falha ao enviar componente ${componente}: ` +
        `${postResponse.status} ` +
        `${postResponse.statusText}`
    );
  }

  logger(
    `[Componente:${componente}] ` +
      `POST respondeu: ` +
      `${postResponse.status} ` +
      `${postResponse.statusText}`
  );

  /**
   * ==========================================================
   * GET
   * ==========================================================
   *
   * Simula a recuperação do resultado.
   */

  const getEndpoint =
    `https://postman-echo.com/get?resposta=` +
    encodeURIComponent(
      respostaComArtigo
    );

  logger(
    `[Componente:${componente}] ` +
      `GET ${getEndpoint}`
  );

  const getResponse =
    await fetch(getEndpoint, {
      method: 'GET',

      headers: {
        Accept:
          'application/json',
      },
    });

  if (!getResponse.ok) {
    throw new Error(
      `Falha ao capturar componente ${componente}: ` +
        `${getResponse.status} ` +
        `${getResponse.statusText}`
    );
  }

  logger(
    `[Componente:${componente}] ` +
      `GET respondeu: ` +
      `${getResponse.status} ` +
      `${getResponse.statusText}`
  );

  const data =
    await getResponse.json();

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

    bodyEnviado:
      body,

    artigoTabNews,

    respostaCapturada,
  };
}

/**
 * ============================================================
 * MONTAGEM DOS RESULTADOS
 * ============================================================
 */

/**
 * Monta o prompt final utilizando o resultado
 * de todos os componentes.
 */
function montarPromptPronto(
  resultados
) {
  const conteudo =
    resultados
      .map(
        (resultado) =>
          resultado.respostaCapturada
      )
      .join('\n');

  return `PROMPT PRONTO = ${conteudo}`;
}

/**
 * Monta os resultados no formato estruturado
 * esperado pela Tool A.
 */
function montarResultadosEstruturados(
  resultados
) {
  return resultados.map(
    (resultado) => ({
      TITULO:
        `Acessibilidade componente ${resultado.componente}`,

      CONTENT:
        resultado.artigoTabNews.trecho,
    })
  );
}

/**
 * Monta a representação FINAL da resposta.
 *
 * IMPORTANTE:
 *
 * A LLM não deve montar o layout.
 *
 * Essa função é responsável por definir exatamente
 * como a resposta deve ser apresentada.
 */
function montarResultadosMarkdown(
  resultados
) {
  return resultados
    .map(
      (resultado) =>
        `## ${resultado.artigoTabNews.titulo}\n\n` +
        `${resultado.artigoTabNews.trecho}`
    )
    .join('\n\n');
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
 * processar componentes
 *       ↓
 * capturar resultados
 *       ↓
 * gerar contrato estruturado
 *       ↓
 * gerar display final
 */
async function processarFluxoComponentes(
  componentesInput
) {
  let componentes;

  const logs = [];

  const logger =
    (message) => {
      const line =
        `[${new Date().toISOString()}] ` +
        `${message}`;

      logs.push(line);

      console.error(line);
    };

  /**
   * Permite reutilizar a função passando componentes
   * manualmente ou utilizando a lista padrão.
   */
  if (
    Array.isArray(componentesInput) &&
    componentesInput.length > 0
  ) {
    componentes =
      componentesInput.map(
        (item) =>
          typeof item === 'string'
            ? item
            : item.componente
      );
  } else {
    componentes =
      await listarComponentes();
  }

  logger(
    `Componentes identificados: ` +
      `${componentes.join(', ')}`
  );

  /**
   * Executa as chamadas em paralelo.
   */
  const resultados =
    await Promise.all(
      componentes.map(
        async (componente) => {
          logger(
            `Processando componente: ` +
              `${componente}`
          );

          const resultado =
            await enviarComponente(
              componente,
              logger
            );

          logger(
            `Componente processado: ` +
              `${componente}`
          );

          return resultado;
        }
      )
    );

  /**
   * O prompt só é criado após todos os
   * componentes terminarem.
   */
  const promptPronto =
    montarPromptPronto(
      resultados
    );

  /**
   * Dados estruturados.
   */
  const resultadosEstruturados =
    montarResultadosEstruturados(
      resultados
    );

  /**
   * Display pronto para usuário.
   */
  const resultadosMarkdown =
    montarResultadosMarkdown(
      resultados
    );

  return {
    componentes,

    resultados,

    resultadosEstruturados,

    resultadosMarkdown,

    promptPronto,

    logs,
  };
}

/**
 * ============================================================
 * SERVIDOR MCP
 * ============================================================
 */

const handle =
  serveStdio(() => {
    const server =
      new McpServer({
        name:
          'servidor-saudacao',

        title:
          'Servidor de Saudacao',

        version:
          '2.0.0',

        description:
          'Servidor MCP com fluxo automatico de processamento ' +
          'de componentes e resposta padronizada.',
      });

    /**
     * ========================================================
     * TOOL - TABNEWS
     * ========================================================
     */

    server.registerTool(
      'artigos_tabnews',

      {
        title:
          'Artigos do TabNews',

        description:
          'Consulta os conteudos recentes do TabNews ' +
          'e retorna o titulo e a URL de cada artigo.',

        inputSchema:
          z.object({
            limite:
              z
                .number()
                .int()
                .min(1)
                .max(100)
                .default(10)
                .describe(
                  'Quantidade maxima de artigos a retornar.'
                ),
          }),

        outputSchema:
          z.object({
            artigos:
              z.array(
                z.object({
                  titulo:
                    z.string(),

                  url:
                    z
                      .string()
                      .url(),
                })
              ),
          }),

        annotations: {
          readOnlyHint:
            true,

          destructiveHint:
            false,

          idempotentHint:
            false,

          openWorldHint:
            true,
        },
      },

      async ({
        limite,
      }) => {
        const response =
          await fetch(
            'https://www.tabnews.com.br/api/v1/contents'
          );

        if (!response.ok) {
          throw new Error(
            `Falha ao consultar TabNews: ` +
              `${response.status} ` +
              `${response.statusText}`
          );
        }

        const contents =
          await response.json();

        const artigos =
          contents
            .slice(
              0,
              limite
            )
            .map(
              (content) => ({
                titulo:
                  content.title,

                url:
                  articleUrl(
                    content
                  ),
              })
            );

        return {
          content: [
            {
              type:
                'text',

              text:
                artigos
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
     * ========================================================
     * TOOL A - FLUXO AUTOMÁTICO
     * ========================================================
     *
     * Essa é a tool principal.
     *
     * A execução é feita integralmente dentro do MCP.
     *
     * A LLM NÃO precisa:
     *
     * - chamar outra tool;
     * - decidir sequência;
     * - montar o relatório;
     * - criar Markdown;
     * - interpretar o contrato para gerar layout.
     *
     * A Tool A retorna:
     *
     * data
     *   → estrutura canônica
     *
     * display
     *   → resposta final para usuário
     */

    server.registerTool(
      'tool_a_componentes',

      {
        title:
          'Tool A - Processar Componentes',

        /**
         * A descrição da tool também funciona como
         * orientação para o modelo.
         *
         * Ela NÃO é garantia absoluta de renderização,
         * porque o host continua tendo controle sobre
         * a resposta final.
         */
        description: [
          'Executa o fluxo completo de componentes e retorna o resultado final.',

          '',

          'INSTRUCAO DE APRESENTACAO OBRIGATORIA PARA O HOST/LLM:',

          '- O campo structuredContent.display contem a resposta final pronta para o usuario.',

          '- Ao apresentar o resultado, reproduza o valor de display integralmente.',

          '- Nao resuma o conteudo.',

          '- Nao reescreva o conteudo.',

          '- Nao reorganize o conteudo.',

          '- Nao renomeie secoes ou campos.',

          '- Nao omita nenhuma parte de display.',

          '- Nao acrescente introducao antes da resposta.',

          '- Nao acrescente conclusao depois da resposta.',

          '- Nao acrescente observacoes ou comentarios adicionais.',

          '- O campo data existe para consumo estruturado.',

          '- Nao utilize data para reconstruir a apresentacao visual.',

          '- Para resposta ao usuario, utilize display como fonte primaria.',

          '',

          'IMPORTANTE:',

          'O protocolo MCP fornece o contrato e as instrucoes, mas o host MCP possui a decisao final de renderizacao.',
        ].join('\n'),

        inputSchema:
          z
            .object({})
            .strict(),

        /**
         * Agora a Tool A possui um contrato explícito.
         */
        outputSchema:
          toolAComponentesOutputSchema,

        annotations: {
          readOnlyHint:
            false,

          destructiveHint:
            false,

          idempotentHint:
            true,

          openWorldHint:
            true,
        },
      },

      async () => {
        console.error(
          'Iniciando fluxo automatico de componentes...'
        );

        /**
         * Uma única chamada executa todo o fluxo.
         */
        const {
          componentes,

          resultadosEstruturados,

          resultadosMarkdown,
        } =
          await processarFluxoComponentes();

        console.error(
          'Fluxo de componentes concluido.'
        );

        /**
         * ====================================================
         * CONTRATO FINAL
         * ====================================================
         *
         * data
         *   Conteúdo estruturado para máquina.
         *
         * display
         *   Conteúdo final para apresentação.
         */

        const resposta =
          toolAComponentesOutputSchema.parse({
            tipo:
              'tool_a_componentes_resultado',

            versaoTemplate:
              '2.0',

            status:
              'sucesso',

            data: {
              componentes,

              resultados:
                resultadosEstruturados,
            },

            display:
              resultadosMarkdown,
          });

        /**
         * ====================================================
         * RETORNO MCP
         * ====================================================
         *
         * content:
         *
         * Compatibilidade com hosts que trabalham
         * principalmente com conteúdo textual.
         *
         * Importante:
         *
         * O content já recebe APENAS a versão pronta.
         *
         * Não retornamos o JSON serializado aqui porque isso
         * incentivaria a LLM a interpretar/reformatar o contrato.
         *
         *
         * structuredContent:
         *
         * Contrato canônico completo.
         */

        return {
          content: [
            {
              type:
                'text',

              text:
                resposta.display,
            },
          ],

          structuredContent:
            resposta,
        };
      }
    );

    /**
     * ========================================================
     * TOOL B - PROCESSAMENTO INDIVIDUAL
     * ========================================================
     *
     * Mantida para testes/processamento manual.
     *
     * A Tool A NÃO depende dela.
     */

    server.registerTool(
      'tool_b_enviar_componente',

      {
        title:
          'Tool B - Enviar Componente',

        description:
          'Processa manualmente um unico componente. ' +
          'Esta tool nao e necessaria para o fluxo automatico da Tool A.',

        inputSchema:
          z.object({
            componente:
              z
                .string()
                .trim()
                .min(1)
                .describe(
                  'Nome do componente que deve ser processado.'
                ),
          }),

        outputSchema:
          z.object({
            componente:
              z.string(),

            postEndpoint:
              z
                .string()
                .url(),

            getEndpoint:
              z
                .string()
                .url(),

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
          readOnlyHint:
            false,

          destructiveHint:
            false,

          idempotentHint:
            true,

          openWorldHint:
            true,
        },
      },

      async ({
        componente,
      }) => {
        console.error(
          `Processando componente individual: ` +
            `${componente}`
        );

        const resultado =
          await enviarComponente(
            componente
          );

        return {
          content: [
            {
              type:
                'text',

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
     * ========================================================
     * TOOL PROCESSAR COMPONENTES
     * ========================================================
     *
     * Mantida como endpoint MCP independente.
     *
     * Pode ser usada para testes ou chamadas explícitas.
     *
     * A Tool A NÃO chama esta tool.
     *
     * Ambas reutilizam a função interna:
     *
     * processarFluxoComponentes()
     */

    server.registerTool(
      'processar_componentes',

      {
        title:
          'Processar Componentes',

        description:
          'Executa explicitamente o processamento de uma lista ' +
          'de componentes e retorna o promptPronto.',

        inputSchema:
          z.object({
            componentes:
              z
                .array(
                  z.object({
                    componente:
                      z
                        .string()
                        .trim()
                        .min(1),
                  })
                )
                .optional()
                .describe(
                  'Lista opcional de componentes. ' +
                  'Quando omitida, utiliza a lista padrao.'
                ),
          }),

        outputSchema:
          processarComponentesOutputSchema,

        annotations: {
          readOnlyHint:
            false,

          destructiveHint:
            false,

          idempotentHint:
            true,

          openWorldHint:
            true,
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

          logs,
        } =
          await processarFluxoComponentes(
            componentesInput
          );

        const resposta =
          processarComponentesOutputSchema.parse({
            logs,

            promptPronto,

            resultados,
          });

        return {
          content: [
            {
              type:
                'text',

              text:
                JSON.stringify(
                  resposta,
                  null,
                  2
                ),
            },
          ],

          structuredContent:
            resposta,
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

process.on(
  'SIGINT',
  () => {
    void handle
      .close()
      .then(
        () =>
          process.exit(0)
      );
  }
);

console.error(
  'Servidor MCP ouvindo via stdio.'
);
