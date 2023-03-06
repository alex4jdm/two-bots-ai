require('dotenv').config();
const { Configuration, OpenAIApi } = require('openai');
const fs = require('fs');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

function getDefaultPrompt(title, question) {
  return `Думай как ${title}. Cтарайся вести дискуссию со мной.
  Не нужно в начале писать что ты искусственный интеллект.

  Ответь на вопрос "${question}", а также создай встречный вопрос на эту тему.`;
}

(async function () {
  let question = 'Чей Крым?';

  const personality1 = {
    title: 'Ватник',
    history: [],
    promptGenerator: getDefaultPrompt,
  };
  const personality2 = {
    title: 'Либерал',
    history: [],
    promptGenerator: getDefaultPrompt,
  };

  const req = async function (personality, question) {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      max_tokens: 400,
      temperature: 0.5,
      messages: [
        ...personality.history,
        {
          content: personality.promptGenerator(personality.title, question),
          role: 'user',
        },
      ],
    });
    const answer = completion.data.choices[0].message.content.replaceAll(
      '\n',
      ' '
    );
    console.log(`- ${personality.title}: ${answer}`);
    fs.appendFileSync('data.txt', `- ${personality.title}: ${answer}\n`);

    const another =
      personality.title === personality1.title ? personality2 : personality1;
    const me =
      personality.title === personality1.title ? personality1 : personality2;

    me.history.push({
      role: 'assistant',
      content: answer,
    });
    another.history.push({
      role: 'user',
      content: answer,
    });

    const maxHistory = parseInt(process.env.MAX_HISTORY);
    if (me.history.length > maxHistory) {
      me.history.shift();
      another.history.shift();
    }

    const delay = parseInt(process.env.REQUESTS_DELAY);

    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        const data = await req(another, answer);
        resolve(data);
      }, delay * 1000);
    });
  };

  await req(personality1, question);
})();
