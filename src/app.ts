
import dotenv from 'dotenv'

dotenv.config()

import express from 'express'

import { embedProducts, generateEmbedding, generateProducts } from './openai'

import { produtosSimilares, todosProdutos } from './database'

export const app = express()

app.use(express.json())


app.post('/generate', async (request, response) => {
  const message = request.body.message;

  try {
    const products = await generateProducts(message)
    response.json({message:  products   })
  } catch (err) {
    console.log(err)
    response.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/embedding', async (request, response ) => {
  const { input } = request.body;

  await generateEmbedding(input)

  response.status(201).send()
})

app.post('/embeddings', async (request, response) => {
  await embedProducts()

  console.log(todosProdutos());

  response.status(201).send()
})

app.post('/cart', async (request, response) => {
  const { message } = request.body
  
  // gerando o embedding da entrada do usuário
  const embedding = await generateEmbedding(message);

  console.log(embedding);

  // comparando o embedding gerado com os embeddings dos produtos do banco de dados
  if (!embedding) {
    response.status(500).json({ message: 'Embedding não gerada' })
    return;
  }

  const produtos = await produtosSimilares(embedding) 
  
  response.status(200).json(produtos.map(product => ({ nome: product.nome, similaridade: product.similaridade})))
})
