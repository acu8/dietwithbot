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

app.get('/', (req, res) => {
  console.log('Root path accessed');
  res.send('Hello, this is the LINE bot server!');
});

app.post('/webhook', express.json(), (req, res) => {
  console.log('Webhook received');
  res.status(200).end();
  handleBot(req.body.events).catch(error => {
    console.error('Error in handleBot:', error);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

async function handleBot(events) {
  console.log('Events:', JSON.stringify(events, null, 2));

  for (const event of events) {
    console.log('Processing event:', event.type);
    if (event.type !== 'message' || event.message.type !== 'text') {
      console.log('Skipping non-text message event');
      continue;
    }
    console.log('Replying to message:', event.message.text);
    
    // 応答トークンの有効期限をチェック
    const currentTime = new Date().getTime();
    const eventTime = event.timestamp;
    if (currentTime - eventTime > 60000) {  // 1分以上経過している場合
      console.log('Reply token expired');
      continue;
    }

    try {
      const result = await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: `受信したメッセージ: ${event.message.text}`
        }],
        notificationDisabled: false  // 通知を有効にする（デフォルト）
      });
      console.log('Reply sent successfully. Response:', JSON.stringify(result));
      
      // 送信したメッセージの情報をログ出力
      if (result.sentMessages) {
        result.sentMessages.forEach(msg => {
          console.log(`Sent message ID: ${msg.id}`);
          if (msg.quoteToken) {
            console.log(`Quote token: ${msg.quoteToken}`);
          }
        });
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      if (error instanceof messagingApi.HTTPError) {
        console.error('HTTP Error:', error.statusCode, error.statusMessage);
        console.error('Request ID:', error.headers?.get('x-line-request-id'));
        console.error('Error details:', error.details);
      } else {
        console.error('Unexpected error:', error);
      }
    }
  }
}

app.use((err, req, res, next) => {
  console.error('Express error:', err);
  res.status(500).send('Something broke!');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});