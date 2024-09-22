const express = require('express');
const { messagingApi } = require('@line/bot-sdk');

const app = express();

app.post('/webhook', express.json(), (req, res) => {
  res.status(200).end();
  
  const event = req.body.events[0];
  if (event && event.type === 'message' && event.message.type === 'text') {
    const client = new messagingApi.MessagingApiClient({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
    });

    client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: 'テスト応答です' }]
    }).then(() => {
      console.error('返信成功');
    }).catch((error) => {
      console.error('返信エラー:', error);
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.error(`Server running on port ${PORT}`));