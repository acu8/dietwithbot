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
  console.log('Root path accessed');
  res.send('Hello, this is the LINE bot server!');
});

app.post('/webhook', line.middleware(lineConfig), (req, res) => handleBot(req, res));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

async function handleBot(req, res) {
  console.log('Webhook received!');
  res.status(200).end();
  const events = req.body.events;
  console.log('Events:', JSON.stringify(events, null, 2));

  return Promise.all(events.map(async (event) => {
    console.log('Processing event:', event.type);
    if (event.type !== 'message' || event.message.type !== 'text') {
      console.log('Skipping non-text message event');
      return null;
    }
    console.log('Replying to message:', event.message.text);
    try {
      await client.replyMessage(event.replyToken, {
        type: 'text',
        text: `受信したメッセージ: ${event.message.text}`
      });
      console.log('Reply sent successfully');
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  }));
}

// エラーハンドリングを追加
app.use((err, req, res, next) => {
  console.error('Express error:', err.stack);
  res.status(500).send('Something broke!');
});

// グローバルな未処理のPromise rejectionをキャッチ
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
