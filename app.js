require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { messagingApi } = require('@line/bot-sdk');
const { MessagingApiClient } = messagingApi;
const { createClient } = require('@supabase/supabase-js');
const vision = require('@google-cloud/vision');
const axios = require('axios');
const { Configuration, OpenAIApi } = require("openai");

const app = express();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const visionClient = new vision.ImageAnnotatorClient();

app.post('/webhook', line.middleware(lineConfig), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message' || (event.message.type !== 'text' && event.message.type !== 'image')) {
    return Promise.resolve(null);
  }

  if (event.message.type === 'text') {
    return handleTextMessage(event);
  } else if (event.message.type === 'image') {
    return handleImageMessage(event);
  }
}

async function handleTextMessage(event) {
  // テキストメッセージの処理（例：食事記録や質問への回答）
  const response = await generateGirlfriendResponse(event.message.text);
  return lineClient.replyMessage(event.replyToken, { type: 'text', text: response });
}

async function handleImageMessage(event) {
  const imageUrl = await lineClient.getMessageContent(event.message.id);
  const imageAnalysis = await analyzeImage(imageUrl);
  const interpretation = interpretImageAnalysis(imageAnalysis);

  if (interpretation.isFood) {
    return handleFoodImage(event, interpretation);
  } else if (interpretation.isPersonPhoto) {
    return handlePersonPhoto(event, interpretation);
  } else {
    return handleOtherPhoto(event, interpretation);
  }
}

async function analyzeImage(imageUrl) {
  const [result] = await visionClient.annotateImage({
    image: {source: {imageUri: imageUrl}},
    features: [
      {type: 'LABEL_DETECTION'},
      {type: 'OBJECT_LOCALIZATION'},
      {type: 'FACE_DETECTION'}
    ]
  });
  return result;
}

function interpretImageAnalysis(result) {
  const labels = result.labelAnnotations.map(label => label.description);
  const objects = result.localizedObjectAnnotations.map(obj => obj.name);
  const hasFace = result.faceAnnotations && result.faceAnnotations.length > 0;

  return {
    isFood: labels.some(label => ['food', 'cuisine', 'dish', 'meal'].includes(label.toLowerCase())),
    isPersonPhoto: hasFace || labels.includes('Person') || objects.includes('Person'),
    labels,
    objects
  };
}

async function handleFoodImage(event, interpretation) {
  const foodName = interpretation.labels[0];
  const nutritionInfo = await getNutritionInfo(foodName);
  await saveMeal(event.source.userId, foodName, nutritionInfo);

  const response = await generateGirlfriendResponse(`彼氏が${foodName}を食べました。栄養情報: ${JSON.stringify(nutritionInfo)}`);
  return lineClient.replyMessage(event.replyToken, { type: 'text', text: response });
}

async function handlePersonPhoto(event, interpretation) {
  await updateUserInfo(event.source.userId, interpretation);
  const response = await generateGirlfriendResponse(`彼氏の写真を受け取りました。写真の特徴: ${interpretation.labels.join(', ')}`);
  return lineClient.replyMessage(event.replyToken, { type: 'text', text: response });
}

async function handleOtherPhoto(event, interpretation) {
  const response = await generateGirlfriendResponse(`彼氏から写真を受け取りました。写真の内容: ${interpretation.labels.join(', ')}`);
  return lineClient.replyMessage(event.replyToken, { type: 'text', text: response });
}

async function getNutritionInfo(food) {
  const response = await axios.get(`https://api.edamam.com/api/nutrition-data`, {
    params: {
      app_id: process.env.EDAMAM_APP_ID,
      app_key: process.env.EDAMAM_APP_KEY,
      ingr: food
    }
  });
  return response.data;
}

async function saveMeal(userId, food, nutritionInfo) {
  const { data, error } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      date: new Date(),
      food: food,
      nutrition_info: nutritionInfo
    });

  if (error) console.error('Error saving meal:', error);
  return data;
}

async function updateUserInfo(userId, imageAnalysis) {
  const { data, error } = await supabase
    .from('users')
    .upsert({ 
      id: userId, 
      last_photo_date: new Date(),
      photo_count: supabase.raw('photo_count + 1'),
      last_photo_features: imageAnalysis
    });

  if (error) console.error('Error updating user info:', error);
  return data;
}

// AI設定
const Groq = require('groq-sdk');
const groq = new Groq(process.env.GROQ_API_KEY);

async function generateGirlfriendResponse(prompt) {
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "あなたは優しくて面白い彼女です。彼氏との会話を行ってください。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "llama3-70b-8192",
        temperature: 0.7,
        max_tokens: 150,
        top_p: 1,
        stream: false,
        stop: null
      });
  
      return chatCompletion.choices[0].message.content;
    } catch (error) {
      console.error('Error generating girlfriend response:', error);
      return "ごめんね、今ちょっと考えがまとまらないの。もう一度言ってくれる？";
    }
  }

async function analyzeWeeklyMeals(userId) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .gte('date', oneWeekAgo.toISOString());

  if (error) {
    console.error('Error fetching meals:', error);
    return null;
  }

  const analysis = await generateGirlfriendResponse(`彼氏の1週間の食事内容を分析し、アドバイスしてください。食事内容: ${JSON.stringify(data)}`);
  return analysis;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});


const cron = require('node-cron');

cron.schedule('0 20 * * 0', async () => {
  const { data: users, error } = await supabase.from('users').select('id');
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  for (let user of users) {
    const analysis = await analyzeWeeklyMeals(user.id);
    if (analysis) {
      await lineClient.pushMessage(user.id, {
        type: 'text',
        text: analysis
      });
    }
  }
});