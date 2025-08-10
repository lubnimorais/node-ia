import dotenv from 'dotenv';

dotenv.config();

import express from 'express';
import { createReadStream, ReadStream } from 'fs';
import path from 'path';
import { produtosSimilares, setarEmbedding, todosProdutos } from './database';
import {
  createEmbeddingBatch,
  createEmbeddingBatchFile,
  createVector,
  embedProducts,
  generateCart,
  generateEmbedding,
  generateProducts,
  getBatch,
  getFileContent,
  processEmbeddingsBatchResults,
  uploadFile,
} from './openai';

export const app = express();

app.use(express.json());

app.post('/generate', async (request, response) => {
  const message = request.body.message;

  try {
    const products = await generateProducts(message);
    response.json({ message: products });
  } catch (err) {
    console.log(err);
    response.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/embedding', async (request, response) => {
  const { input } = request.body;

  await generateEmbedding(input);

  response.status(201).send();
});

app.post('/embeddings', async (request, response) => {
  await embedProducts();

  console.log(todosProdutos());

  response.status(201).send();
});

app.post('/cart', async (request, response) => {
  const { message } = request.body;

  // gerando o embedding da entrada do usuário
  const embedding = await generateEmbedding(message);

  console.log(embedding);

  // comparando o embedding gerado com os embeddings dos produtos do banco de dados
  if (!embedding) {
    response.status(500).json({ message: 'Embedding não gerada' });
    return;
  }

  const produtos = await produtosSimilares(embedding);

  response.status(200).json(
    produtos.map((product) => ({
      nome: product.nome,
      similaridade: product.similaridade,
    }))
  );
});

app.post('/response', async (request, response) => {
  const { input } = request.body;

  const cart = await generateCart(
    input,
    todosProdutos().map((product) => product.nome)
  );

  response.status(200).json({ cart });
});

app.post('/upload', async (request, response) => {
  const file = createReadStream(
    path.join(__dirname, '..', 'static', 'recipes.md')
  );

  await uploadFile(file);

  response.status(201).send();
});

app.post('/vector-store', async (request, response) => {
  await createVector();

  response.status(201).send();
});

app.post('/embeddings-batch', async (request, response) => {
  const file = await createEmbeddingBatchFile(
    todosProdutos().map((p) => `${p.nome}: ${p.descricao}`)
  );

  /**
   * NO BANCO DE DADOS REAL, SALVARIA ESSES BATCHS E O STATUS DELE
   * E UMA ROTINA FICARIA FAZENDO A VERIFICAÇÃO
   */
  const batch = await createEmbeddingBatch(file.id);

  response.status(201).json(batch);
});

app.get('/embeddings-batch/results/:id', async (request, response) => {
  const id = request.params.id;

  const results = await processEmbeddingsBatchResults(id);

  if (!results) {
    response.status(200).json({ message: 'Still processing' });

    return;
  }

  // SETANDO NO BANCO DE DADOS OS EMBEDDINGS
  results.forEach(async (result) => {
    await setarEmbedding(result.id, result.embeddings);
  });

  response.status(200).end();
});

app.get('/products', async (request, response) => {
  response.status(200).json(
    todosProdutos().map((product) => ({
      ...product,
      embedding: product.embedding ? product.embedding.slice(0, 3) : null,
    }))
  );
});
