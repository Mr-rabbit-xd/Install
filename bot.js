import TelegramBot from "node-telegram-bot-api";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// ====== ENV VARIABLES ======
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const MONGO_URI = process.env.MONGO_URI;

// ====== CONNECT DATABASE ======
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ====== SCHEMA ======
const settingSchema = new mongoose.Schema({
  type: String, // e.g., "start_message"
  message: String,
  photo: String,
});
const Setting = mongoose.model("Setting", settingSchema);

// ====== BOT INIT ======
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ====== MAIN KEYBOARD ======
function mainKeyboard() {
  return {
    keyboard: [
      [{ text: "💰 Deposit" }, { text: "⭐ Services" }],
      [{ text: "📦 My Orders" }, { text: "💳 Balance" }],
      [{ text: "🧑‍💻 Support" }],
    ],
    resize_keyboard: true,
  };
}

// ====== /start COMMAND ======
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  // Get start message and photo from DB
  let settings = await Setting.findOne({ type: "start_message" });

  // Default if not set
  const message =
    settings?.message ||
    "👋 Welcome to Rabbit Amm Panel!\n\nManage your balance, buy services, and grow your account 🚀";
  const photo = settings?.photo;

  try {
    if (photo && photo !== "none") {
      await bot.sendPhoto(chatId, photo, {
        caption: message,
        reply_markup: mainKeyboard(),
      });
    } else {
      await bot.sendMessage(chatId, message, {
        reply_markup: mainKeyboard(),
      });
    }
  } catch (err) {
    console.error("❌ Error sending start message:", err);
  }
});

// ====== ADMIN: /setstartmsg ======
bot.onText(/\/setstartmsg (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId.toString() !== ADMIN_ID) return;

  const newMsg = match[1];

  await Setting.findOneAndUpdate(
    { type: "start_message" },
    { message: newMsg },
    { upsert: true }
  );

  bot.sendMessage(chatId, "✅ Start message updated successfully!");
});

// ====== ADMIN: /setstartphoto ======
bot.onText(/\/setstartphoto (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (chatId.toString() !== ADMIN_ID) return;

  const newPhoto = match[1];

  await Setting.findOneAndUpdate(
    { type: "start_message" },
    { photo: newPhoto },
    { upsert: true }
  );

  bot.sendMessage(
    chatId,
    `✅ Start photo updated!\n\n📷 Current photo: ${newPhoto}`
  );
});

// ====== ADMIN: /getstartsettings ======
bot.onText(/\/getstartsettings/, async (msg) => {
  const chatId = msg.chat.id;
  if (chatId.toString() !== ADMIN_ID) return;

  const settings = await Setting.findOne({ type: "start_message" });

  if (!settings)
    return bot.sendMessage(chatId, "⚠️ No start message found in DB.");

  let text = `🗂 *Start Message Settings*\n\n`;
  text += `💬 Message:\n${settings.message || "_Not set_"}\n\n`;
  text += `📸 Photo:\n${settings.photo || "_Not set_"}\n`;

  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
});

console.log("🤖 Bot started...");
