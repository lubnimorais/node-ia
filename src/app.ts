
import dotenv from 'dotenv'

dotenv.config()

import express from 'express'

import { createVector, embedProducts, generateCart, generateEmbedding, generateProducts, uploadFile } from './openai'

import { produtosSimilares, todosProdutos } from './database'
import { createReadStream } from 'fs'
import path from 'path'

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

app.post('/response', async (request, response) => {
  const { input } = request.body

  const cart = await generateCart(input, todosProdutos().map(product => product.nome))

  response.status(200).json({ cart })
})

app.post('/upload', async (request, response) => {
  const file = createReadStream(path.join(__dirname, '..', 'static', 'recipes.md'))

  await uploadFile(file)

  response.status(201).send()
})

app.post('/vector-store', async (request, response) => {
  await createVector()

  response.status(201).send()
})
