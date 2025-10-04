require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');

const token = process.env.BOT_TOKEN;
const port = process.env.PORT || 3000;

const bot = new TelegramBot(token, { polling: true });
const app = express();

// keep-alive route for Render / UptimeRobot
app.get('/', (req, res) => res.send('✅ Bot is Alive'));
app.listen(port, () => console.log(`Server running on port ${port}`));

// ensure tmp folder exists
fs.ensureDirSync('./tmp');

function safeFileName(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').substring(0, 120);
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text) return;

  if (text === '/start') {
    return bot.sendMessage(
      chatId,
      `👋 হাই ${msg.from.first_name}!\n\n🔹 শুধু YouTube লিংক পাঠাও।\n🔹 আমি জিজ্ঞেস করবো তুমি 🎥 ভিডিও না 🎧 অডিও চাও।`
    );
  }

  if (text.startsWith('http')) {
    if (!ytdl.validateURL(text))
      return bot.sendMessage(chatId, '⚠️ বৈধ YouTube লিংক পাঠাও!');

    const opts = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎥 Download Video (MP4)', callback_data: `video|${text}` }],
          [{ text: '🎧 Download Audio (MP3)', callback_data: `audio|${text}` }]
        ]
      }
    };
    return bot.sendMessage(chatId, '👉 কোন ফরম্যাটে ডাউনলোড করবে?', opts);
  }
});

bot.on('callback_query', async (cq) => {
  const chatId = cq.message.chat.id;
  const [type, url] = cq.data.split('|');
  await bot.answerCallbackQuery(cq.id);

  if (!ytdl.validateURL(url))
    return bot.sendMessage(chatId, '❌ Invalid YouTube link.');

  if (type === 'video') return downloadVideo(chatId, url);
  if (type === 'audio') return downloadAudio(chatId, url);
});

async function downloadVideo(chatId, url) {
  const info = await ytdl.getInfo(url);
  const title = safeFileName(info.videoDetails.title);
  const outPath = `./tmp/${title}.mp4`;

  const msg = await bot.sendMessage(chatId, '📥 ভিডিও ডাউনলোড হচ্ছে... অপেক্ষা করো ⏳');

  try {
    await new Promise((resolve, reject) => {
      ytdl(url, { quality: '18' })
        .pipe(fs.createWriteStream(outPath))
        .on('finish', resolve)
        .on('error', reject);
    });

    const stats = await fs.stat(outPath);
    const sizeMB = stats.size / 1024 / 1024;

    if (sizeMB > 49) {
      await bot.sendMessage(chatId, `⚠️ ভিডিও ${sizeMB.toFixed(1)}MB — Telegram limit cross করছে।`);
    } else {
      await bot.sendChatAction(chatId, 'upload_video');
      await bot.sendVideo(chatId, outPath, { caption: title });
    }
  } catch (e) {
    console.error(e);
    await bot.sendMessage(chatId, '❌ ভিডিও ডাউনলোডে সমস্যা হয়েছে।');
  } finally {
    await fs.remove(outPath);
    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
  }
}

async function downloadAudio(chatId, url) {
  const info = await ytdl.getInfo(url);
  const title = safeFileName(info.videoDetails.title);
  const outPath = `./tmp/${title}.mp3`;

  const msg = await bot.sendMessage(chatId, '🎧 অডিও কনভার্ট হচ্ছে... অপেক্ষা করো ⏳');

  try {
    await new Promise((resolve, reject) => {
      const stream = ytdl(url, { quality: 'highestaudio' });
      ffmpeg(stream)
        .audioBitrate(128)
        .toFormat('mp3')
        .save(outPath)
        .on('end', resolve)
        .on('error', reject);
    });

    const stats = await fs.stat(outPath);
    const sizeMB = stats.size / 1024 / 1024;

    if (sizeMB > 49) {
      await bot.sendMessage(chatId, `⚠️ MP3 ${sizeMB.toFixed(1)}MB — Telegram limit cross করছে।`);
    } else {
      await bot.sendChatAction(chatId, 'upload_audio');
      await bot.sendAudio(chatId, outPath, { title });
    }
  } catch (e) {
    console.error(e);
    await bot.sendMessage(chatId, '❌ অডিও কনভার্টে সমস্যা হয়েছে।');
  } finally {
    await fs.remove(outPath);
    await bot.deleteMessage(chatId, msg.message_id).catch(() => {});
  }
    }
