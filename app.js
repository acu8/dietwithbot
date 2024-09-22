const line = require('@line/bot-sdk');
const express = require('express');
require('dotenv').config();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.Client(lineConfig);

const app = express();

// ルートパスのハンドラを追加
app.get('/', (req, res) => {
  res.send('Hello, this is the LINE bot server!');
});

app.post('/webhook', line.middleware(lineConfig), (req, res) => handleBot(req, res));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

async function handleBot(req, res) {
  res.status(200).end();
  const events = req.body.events;
  return Promise.all(events.map(async (event) => {
    if (event.type !== 'message' || event.message.type !== 'text') {
      return null;
    }
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `受信したメッセージ: ${event.message.text}`
    });
  }));
}

// エラーハンドリングを追加
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});