import dotenv from 'dotenv';

dotenv.config();

import type { ReadStream } from 'fs';

import OpenAI from 'openai';

import { zodResponseFormat, zodTextFormat } from 'openai/helpers/zod';

import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources';

import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses.js';

import { z as zod } from 'zod';

import {
  produtosEmEstoque,
  produtosEmFalta,
  setarEmbedding,
  todosProdutos,
} from './database';

// CLIENT OPEN AI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const schema = zod.object({
  produtos: zod.array(zod.string()),
});

const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'produtos_em_estoque',
      description: 'Lista os produtos que estão em estoque',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      strict: true, // não pode mudar nada nesse esquema
    },
  },
  {
    type: 'function',
    function: {
      name: 'produtos_em_falta',
      description: 'Lista os produtos que estão em falta',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      strict: true, // não pode mudar nada nesse esquema
    },
  },
];

const generateCompletion = async (
  messages: ChatCompletionMessageParam[],
  format: any
) => {
  const completion = await client.chat.completions.parse({
    model: 'gpt-4o-mini',
    max_completion_tokens: 100,
    response_format: format,
    tools,
    messages,
  });

  if (completion.choices[0].message.refusal) {
    throw new Error('Refusal');
  }

  const { tool_calls } = completion.choices[0].message;

  if (tool_calls) {
    const [tool_call] = tool_calls;
    console.log(tool_call.function.name);

    const toolsMap = {
      produtos_em_estoque: produtosEmEstoque,
      produtos_em_falta: produtosEmFalta,
    };

    const functionToCall = toolsMap[tool_call.function.name];

    if (!functionToCall) {
      throw new Error('Function not found');
    }

    /**
     * SE TIVESSE PARÂMETROS CHAMARÍAMOS OS PARÂMETROS
     * DESSA FORMA: tool_call.function.parsed_arguments
     */

    const result = functionToCall(tool_call.function.parsed_arguments);

    messages.push(completion.choices[0].message);

    messages.push({
      role: 'tool',
      tool_call_id: tool_call.id,
      content: result.toString(),
    });

    const completionWithToResult = await generateCompletion(
      messages,
      zodResponseFormat(schema, 'produtos_schema')
    );

    return completionWithToResult;
  }

  return completion;
};

export async function generateProducts(message: string) {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'developer',
      content:
        'Liste no máximo três produtos que atendam a necessidade do usuário. Considere apenas os produtos em estoque',
    },
    {
      role: 'user', // developer, assistant
      content: message,
    },
  ];

  const completion = await generateCompletion(
    messages,
    zodResponseFormat(schema, 'produtos_schema')
  );

  const output = completion.choices[0].message.parsed;

  return output;
}

export async function generateEmbedding(input: string) {
  try {
    const response = await client.embeddings.create({
      input,
      model: 'text-embedding-3-small',
      encoding_format: 'float',
    });

    console.dir(response, { depth: null });

    return response.data[0].embedding ?? null;
  } catch (err) {
    return null;
  }
}

export async function embedProducts() {
  const produtos = todosProdutos();

  await Promise.allSettled(
    produtos.map(async (product, index) => {
      const embedding = await generateEmbedding(
        `${product.nome}: ${product.descricao}`
      );

      if (!embedding) {
        return;
      }

      setarEmbedding(index, embedding);
    })
  );
}

export const uploadFile = async (file: ReadStream) => {
  const uploaded = await client.files.create({
    file,
    purpose: 'assistants',
  });

  console.dir(uploaded, { depth: null });
};

export const createVector = async () => {
  const vectorStore = await client.vectorStores.create({
    name: 'node_ia_file_search_class',

    file_ids: ['file-2GMRzcyTDZp1HjxEx5pfd1'],
  });

  console.dir(vectorStore, { depth: null });
};

async function generateResponse<T = null>(
  params: ResponseCreateParamsNonStreaming
) {
  const response = await client.responses.parse(params);

  // QUANDO PARSEAMOS A RESPOSTA, UTILIZAMOS O response.output_parsed
  if (response.output_parsed) {
    return response.output_parsed as T;
  }

  // if (response.output_text) {
  //   return response.output_text;
  // }

  return null;
}

// GERAR PROMPTS MENORES (CHUNKS)
export function createCartPromptChunks(input: string, products: string[]) {
  const chunkSize = 100;
  // CADA CHUNK VAI SER UM PROMPT
  const chunks: string[] = [];

  for (let i = 0; i < chunkSize; i += chunkSize) {
    chunks.push(
      `Retorne uma lista de até 5 produtos que satisfação a necessidade do usuário. 
      
      Os produtos disponíveis são os seguintes: ${JSON.stringify(products.slice(i, i + chunkSize))}`
    );
  }

  return chunks;
}

export const generateCart = async (input: string, products: string[]) => {
  // PRIMEIRA ETAPA É SABER OS INGREDIENTES (OS COMPONENTES DA RECEITA)
  const ingredientes = client.responses.create({
    input,
    model: 'gpt-4.1-mini',
    instructions: `Retorne uma lista de até 5 ingredientes que satisfação a necessidade do usuário. 
      1. Divida o prato em componentes principais.
      2. Para cada componente, forneça uma lista de ingredientes que podem ser usados para prepará-lo.`,
    text: {
      format: zodTextFormat(
        zod.object({ ingredientes: zod.array(zod.string()) }),
        'receita'
      ),
    },
  });

  // FAZENDO O CHUNK DO PROMPT
  const promises = createCartPromptChunks(input, products).map((chunk) => {
    return generateResponse<{ produtos: string[] }>({
      model: 'gpt-4.1-mini',
      instructions: chunk,
      input: `${input}: ingredientes necessários ${ingredientes}`,
      text: {
        format: zodTextFormat(schema, 'carrinho'),
      },
    });
  });

  const results = await Promise.all(promises);

  return results
    .filter((result): result is { produtos: string[] } => Boolean(result))
    .flatMap((result) => result.produtos);
};

// CRIANDO O ARQUIVO DE BATCH
export async function createEmbeddingBatchFile(products: string[]) {
  const content = products
    .map((product, index) => ({
      custom_id: index.toString(), // id para identificar quando tiver os resultados de qual objeto
      method: 'POST',
      url: '/v1/embeddings', // endpoint
      body: {
        input: product,
        model: 'text-embedding-3-small',
        encoding_format: 'float', // padrão
      },
    }))
    .map((product) => JSON.stringify(product))
    .join('\n');

  // TESTE
  // await writeFile(path.join(__dirname, 'file.jsonl'), content);

  // UPLOAD PARA OPENIA
  const file = new File([content], 'embeddings-batch.jsonl');
  const uploaded = await client.files.create({
    file,
    purpose: 'batch',
  });

  return uploaded;
}

// CRIANDO O BATCH E ENVIANDO
export async function createEmbeddingBatch(fileId: string) {
  const batch = await client.batches.create({
    input_file_id: fileId,
    endpoint: '/v1/embeddings',
    completion_window: '24h',
  });

  return batch;
}

// TESTE
// createEmbeddingBatchFile(['sorvete', 'alface']);

// VERIFICAR PROCESSO DO BATCH
export async function getBatch(id: string) {
  return await client.batches.retrieve(id);
}

// OBTENDO ARQUIVO DE RESULTADO DO BATCH
export async function getFileContent(outputFileId: string) {
  const response = await client.files.content(outputFileId);

  return await response.text();
}

// PROCESSANDO AS INFORMAÇÕES DO BATCH
export async function processEmbeddingsBatchResults(batchId: string) {
  const batch = await getBatch(batchId);

  if (batch.status !== 'completed' || !batch.output_file_id) {
    return null;
  }

  // OBTENDO O ARQUIVO
  const fileContent = await getFileContent(batch.output_file_id);

  // TRANSFORMAR O JSON LINE EM OBJETO JAVASCRIPT
  return (
    fileContent
      .split('\n')
      .map((line) => {
        try {
          const parsed = JSON.parse(line) as {
            custom_id: string;
            response: { body: { data: { embedding: number[] }[] } };
          };

          return {
            id: Number(parsed.custom_id),
            embeddings: parsed.response.body.data[0].embedding,
          };
        } catch (err) {
          console.error(err);
          return null;
        }
      })
      // REMOVENDO OS VALORES NULOS
      .filter((result): result is { id: number; embeddings: number[] } =>
        Boolean(result)
      )
  );
}
