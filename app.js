const express = require('express');
const { messagingApi } = require('@line/bot-sdk');
require('dotenv').config();

const app = express();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: lineConfig.channelAccessToken,
});

// ルートパスのハンドラを追加
app.get('/', (req, res) => {
  console.log('Root path accessed');
  res.send('Hello, this is the LINE bot server!');
});

app.post('/webhook', express.json(), (req, res) => handleBot(req, res));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

async function handleBot(req, res) {
  console.log('Webhook received!');
  res.status(200).end();
  const events = req.body.events;
  console.log('Events:', JSON.stringify(events, null, 2));

  for (const event of events) {
    console.log('Processing event:', event.type);
    if (event.type !== 'message' || event.message.type !== 'text') {
      console.log('Skipping non-text message event');
      continue;
    }
    console.log('Replying to message:', event.message.text);
    try {
      const result = await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: `受信したメッセージ: ${event.message.text}`
        }]
      });
      console.log('Reply sent successfully. Response:', JSON.stringify(result));
    } catch (error) {
      console.error('Error sending reply:', error);
      if (error instanceof messagingApi.HTTPFetchError) {
        console.error('HTTP Fetch Error:', error.status);
        console.error('Request ID:', error.headers.get('x-line-request-id'));
        console.error('Error body:', error.body);
      }
    }
  }
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
