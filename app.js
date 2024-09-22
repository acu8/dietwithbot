const line = require('@line/bot-sdk');
const express = require('express');
require('dotenv').config();

const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
  };

const PORT = 3000;

express()
  .post('/webhook', line.middleware(lineConfig), (req, res) => handleBot(req, res))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

function handleBot(req, res){
    res.status(200).end();
    req.body.events.map((event) => {
        console.log('event', event);
    })
}