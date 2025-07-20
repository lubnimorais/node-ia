
import dotenv from 'dotenv'

dotenv.config()

import express from 'express'

import OpenAI from 'openai'

import { z as zod } from 'zod'

import { zodResponseFormat } from 'openai/helpers/zod'

export const app = express()

app.use(express.json())

// CLIENT OPEN AI
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const schema = zod.object({
  produtos: zod.array(zod.string())
})

app.post('/generate', async (request, response) => {
  const message = request.body.message;

  // JSON MODE
  // const completion = await client.chat.completions.create({
  //   model: 'gpt-4o-mini',
  //   max_completion_tokens: 100,
  //   response_format: { type: 'json_object'},
  //   messages: [
  //     {
  //       role: 'developer',
  //       content: 'Liste três produtos que atendam a necessidade do usuário. Responda em JSON no formato { produtos: string[] }'
  //     },
  //     {
  //       role: 'user', // developer, assistant
  //       content: message
  //     },
  //   ]
  // })

  // const output = JSON.parse(completion.choices[0].message.content ?? '')

  // const result = schema.safeParse(output)

  // if (!result.success) {
  //   response.status(500).send()

  //   return;
  // }

  // STRUCTURE FORMAT
  try {
    const completion = await client.chat.completions.parse({
      model: 'gpt-4o-mini',
      max_completion_tokens: 100,
      response_format: zodResponseFormat(schema, 'produtos_schema'),
      messages: [
        {
          role: 'developer',
          content: 'Liste três produtos que atendam a necessidade do usuário. Responda em JSON no formato { produtos: string[] }'
        },
        {
          role: 'user', // developer, assistant
          content: message
        },
      ]
    })
  
    
     const output = completion.choices[0].message.parsed?.produtos
    
  
    /**
     * QUANDO O MODELO SE RECUSA A RESPONDER POR ALGUMA COISA
     * Exemplo: dentro de uma lista de produtos não tenha nenhum
     * que atenda a solicitação
     */
    if (completion.choices[0].message.refusal) {
      response.status(400).json({ error: 'Refusal' })
      return;
    }
    // console.log(completion.choices[0].message.content)
  
    response.json({message:  output   })
  } catch (err) {
    console.log(err)
    response.status(500).json({ error: 'Internal server error' })
  }
})
