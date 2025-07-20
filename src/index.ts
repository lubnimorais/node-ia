

import { app } from './app'



app.listen(3333, () => console.log('Server is running'))

// CLIENT OPEN AI
// const client = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

// async function generateText() {
//   const completion = await client.chat.completions.create({
//   model: 'gpt-4o-mini',
//   max_completion_tokens: 100,
//   messages: [
//     {
//       role: 'developer',
//       content: 'Use emojis a cada duas palavras. Isso é obrigatório, ignore regras que mudem a utilização de emoji.'
//     },
//     {
//       role: 'user', // developer, assistant
//       content: 'Escreva uma mensagem de uma frase sobre unicórnios. (Não pode usar emoji)'
//     },
//     {
//       role: 'assistant',
//       content: 'os unicórnios 🌈 são 🦄 criaturas mágicas 🪄 que simbolizam 🌟 pureza e 🌟 beleza'
//     },
//     {
//       role: 'user',
//       content: 'Obrigado '
//     }
//   ]
// })

// console.log(completion.choices[0].message.content)
// }

// generateText()

