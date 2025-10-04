const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const ytdl = require("ytdl-core");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs");

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

app.get("/", (req, res) => res.send("Bot is alive 🚀"));

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `👋 Hi ${msg.from.first_name}!
🎥 Send me a YouTube link with one of these commands:

🎧 /mp3 <url> — get audio
🎬 /mp4 <url> — get video`
  );
});

// MP3 downloader
bot.onText(/\/mp3 (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1];

  if (!ytdl.validateURL(url))
    return bot.sendMessage(chatId, "❌ Invalid YouTube link!");

  const info = await ytdl.getInfo(url);
  const title = info.videoDetails.title.replace(/[^\w\s]/gi, "_");
  const output = `${title}.mp3`;

  bot.sendMessage(chatId, "🎧 Downloading and converting to MP3...");

  const stream = ytdl(url, { filter: "audioonly", quality: "highestaudio" });

  ffmpeg(stream)
    .audioBitrate(128)
    .toFormat("mp3")
    .save(output)
    .on("end", async () => {
      await bot.sendAudio(chatId, output, { title: info.videoDetails.title });
      fs.unlinkSync(output);
    })
    .on("error", (err) => {
      console.error(err);
      bot.sendMessage(chatId, "⚠️ Error while processing audio!");
    });
});

// MP4 downloader
bot.onText(/\/mp4 (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const url = match[1];

  if (!ytdl.validateURL(url))
    return bot.sendMessage(chatId, "❌ Invalid YouTube link!");

  const info = await ytdl.getInfo(url);
  const title = info.videoDetails.title.replace(/[^\w\s]/gi, "_");
  const output = `${title}.mp4`;

  bot.sendMessage(chatId, "🎬 Downloading video, please wait...");

  const stream = ytdl(url, { quality: "18" }); // 360p stable stream

  stream
    .pipe(fs.createWriteStream(output))
    .on("finish", async () => {
      const stats = fs.statSync(output);
      const fileSizeMB = stats.size / (1024 * 1024);

      if (fileSizeMB <= 50) {
        await bot.sendVideo(chatId, output, {
          caption: `🎬 ${info.videoDetails.title}`,
        });
      } else {
        bot.sendMessage(
          chatId,
          `⚠️ Video too large (${fileSizeMB.toFixed(
            1
          )} MB). Telegram limit is 50MB!`
        );
      }

      fs.unlinkSync(output);
    })
    .on("error", (err) => {
      console.error(err);
      bot.sendMessage(chatId, "⚠️ Error while downloading video!");
    });
});

app.listen(process.env.PORT || 3000, () =>
  console.log("✅ Bot server running...")
);
