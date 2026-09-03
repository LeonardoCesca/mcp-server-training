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

const handle = serveStdio(() => {
  const server = new McpServer({
    name: 'servidor-saudacao',
    title: 'Servidor de Saudacao',
    version: '1.0.0',
    description: 'Servidor MCP simples que retorna uma saudacao amistosa com data e hora atual.',
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

  return server;
});

process.on('SIGINT', () => {
  void handle.close().then(() => process.exit(0));
});

console.error('Servidor MCP de saudacao ouvindo via stdio.');
