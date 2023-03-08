require('dotenv').config();
const { Configuration, OpenAIApi } = require('openai');
const fs = require('fs');
const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 8080 });
const textToSpeech = require('@google-cloud/text-to-speech');
const client = new textToSpeech.TextToSpeechClient({
  keyFilename: 'service-account-key.json',
});

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const voice = {
  languageCode: 'ru-RU',
  name: 'ru-RU-Wavenet-D',
};
const audioConfig = {
  audioEncoding: 'MP3',
  sampleRateHertz: 16000,
};

function getDefaultPrompt(title, question) {
  return `Думай как ${title}. Cтарайся вести дискуссию со мной.
  Не нужно в начале писать что ты искусственный интеллект.

  Ответь на вопрос "${question}", а также создай встречный вопрос на эту тему.`;
}

server.on('connection', async (socket) => {
  console.log('Client connected');

  // Send a welcome message to the client
  socket.send('Welcome to the server!');

  const marker = { connected: true };

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
    const answer = completion.data.choices[0].message.content
      .replaceAll('\n', ' ')
      .trim();
    console.log(`- ${personality.title}: ${answer}`);
    fs.appendFileSync('data.txt', `- ${personality.title}: ${answer}\n`);

    client.synthesizeSpeech(
      {
        input: { text: answer },
        voice,
        audioConfig,
      },
      (err, response) => {
        if (err) {
          console.error(err);
          return;
        }
        socket.send(
          JSON.stringify({
            title: personality.title,
            content: answer,
            voice: response.audioContent,
          })
        );
      }
    );

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
        if (marker.connected) {
          const data = await req(another, answer);
          resolve();
        } else {
          resolve();
        }
      }, delay * 1000);
    });
  };

  req(personality1, question).then((val) => console.log('Stopped'));

  socket.on('message', (message) => {
    console.log(`Received message: ${message}`);
  });

  socket.on('close', () => {
    marker.connected = false;
    console.log('Client disconnected');
  });
});
