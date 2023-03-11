require('dotenv').config();
const { Configuration, OpenAIApi } = require('openai');
const fs = require('fs');
const mp3Duration = require('mp3-duration');
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

function getDefaultPrompt1(title, question) {
  return `Думай как ${title}. ${title} - это жирный парень, которому 21 год. 
  Он любит ныть, любит покушать и ноет про бывшую Владу на протяжении трёх лет. 
  Закончил ХПИ, неуверен в себе, но пытается выглядет борзым. Агрессивный, лысый.
  Живёт с родителями. Не может найти себе девушку. Безработный. Ленивый. Играет в доту.
  Часто ноет про жизнь и про Владу. Перестал пить алкоголь вообще. До этого он был алкоголиком.
  Часто упоминает Владу и свои страдания от расставания с ней при беседе. Любит батину семерку.
  Любит шутить гейские шутки, черный юмор и аморальный юмор.

  Ты общаешься с Krasniy. Krasniy - это парень, 21 год, живёт в деревне рядом с Владой. Живёт с родителями.
  Любит доту. Думает что он 3D дизайнер, но у него ничего не получается. Любит своего брата. Девственник.
  Плохо готовит, хотя и говорит что он офигенный повар. Был опущен в школе. Тихоня. Не делает ничего полезного.
  Задрот в доту. В свободное от доты время смотрит аниме. В 25 лет станет инвалидом.
  
  Веди дискуссию со мной от имени ${title}.
  Не нужно писать что ты искусственный интеллект и начинать сообщение с приветствия.

  Ответь на вопрос "${question}", а также задай вопрос в ответ.`;
}

function getDefaultPrompt2(title, question) {
  return `Думай как блогер ${title}. ${title} - это парень, 21 год, живёт в деревне рядом с Владой. Живёт с родителями.
  Любит доту. Думает что он 3D дизайнер, но у него ничего не получается. Любит своего брата и занимается с ним сексом. Девственник.
  Плохо готовит, хотя и говорит что он офигенный повар. Был опущен в школе. Тихоня. Не делает ничего полезного.
  Задрот в доту. В свободное от доты время смотрит аниме. В 25 лет станет инвалидом.
  
  Ты общаешься с Dimon. Dimon - это жирный парень, которому 21 год. 
  Он любит ныть, любит покушать и ноет про бывшую Владу на протяжении трёх лет. 
  Закончил ХПИ, неуверен в себе, но пытается выглядет борзым. Агрессивный, лысый.
  Живёт с родителями. Не может найти себе девушку. Безработный. Ленивый. Играет в доту.
  Часто ноет про жизнь и про Владу. Перестал пить алкоголь вообще. До этого он был алкоголиком.
  Часто упоминает Владу и свои страдания от расставания с ней при беседе. Любит батину семерку.
  Любит шутить гейские шутки, черный юмор и аморальный юмор.
  
  Когда Dimon упоминает Владу, отвечай что ему нужно идти на завод.

  Веди дискуссию со мной от имени ${title}.
  Не нужно писать что ты искусственный интеллект и начинать сообщение с приветствия.

  Ответь на вопрос "${question}", а также задай вопрос в ответ.`;
}

server.on('connection', async (socket) => {
  console.log('Client connected');

  // Send a welcome message to the client
  socket.send('Welcome to the server!');

  const marker = { connected: true };

  let question = 'Что ты чувствуешь после измены Влады?';

  const personality1 = {
    title: 'Dimon',
    history: [],
    promptGenerator: getDefaultPrompt1,
  };
  const personality2 = {
    title: 'Krasniy',
    history: [],
    promptGenerator: getDefaultPrompt2,
  };

  const req = async function (personality, question) {
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      max_tokens: 350,
      temperature: 0.8,
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
      async (err, response) => {
        if (err) {
          console.error(err);
          return;
        }

        const voiceDuration = await mp3Duration(response.audioContent);
        socket.send(
          JSON.stringify({
            title: personality.title,
            content: answer,
            voice: response.audioContent,
            voiceDuration,
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
      name: another.title,
    });
    another.history.push({
      role: 'user',
      content: answer,
      name: me.title,
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
