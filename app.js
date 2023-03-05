require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const fs = require("fs");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

function getDefaultPrompt(title, question) {
  return `Думай как ${title}. Задавай встречный вопрос и старайся вести дискуссию со мной.

  Не нужно в начале писать что ты искусственный интеллект.

  Ответь на вопрос "${question}", а также создай встречный вопрос на эту тему.`;
}

(async function () {
  let question = "Чей Крым?";
  let title1 = "Ватник";
  let title2 = "Либерал";

  const req = async function (title, question) {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      max_tokens: 400,
      temperature: 0.5,
      messages: [
        {
          content: getDefaultPrompt(title, question),
          role: "user",
        },
      ],
    });
    const answer = completion.data.choices[0].message.content.replaceAll(
      "\n",
      " "
    );
    console.log(`- ${title}: ${answer.toString()}`);
    fs.appendFileSync("data.txt", `- ${title}: ${answer.toString()}\n`);

    return new Promise((resolve, reject) => {
      let t = 0;
      setTimeout(async () => {
        const data = await req(title === title1 ? title2 : title1, answer);
        resolve(data);
      }, 10000);
    });
  };

  await req(title1, question);
})();
