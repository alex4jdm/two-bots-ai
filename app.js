require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const fs = require("fs");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

function getDefaultPrompt(question) {
  return `Думай как Русский ватник. Задавай встречный вопрос и старайся вести дискуссию со мной.

  Не нужно в начале писать что ты искусственный интеллект.
  
  Ограничь свой ответ двумя предложениями.

  Добавь глупых ошибок в текст, которые покажут неграмотность ватников.

  Сформируй ответ на вопрос "${question}", а также создай встречный вопрос на эту тему.`;
}

(async function () {
  let question = "Чей Крым?";

  const req = async function (question) {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      temperature: 0.5,
      messages: [
        {
          content: getDefaultPrompt(question),
          role: "user",
        },
      ],
    });
    const answer = completion.data.choices[0].message.content
      .split(/.|\?/)
      .map((item) => item.replaceAll("\n", ""));
    console.log(completion.data.choices[0].message.content);
    fs.appendFileSync("data.txt", answer.toString() + "\n");

    return new Promise((resolve, reject) => {
      let t = 0;
      setTimeout(async () => {
        const data = await req(answer[1]);
        resolve(data);
      }, 10000);
    });
  };

  await req(question);
})();
