import { Telegraf, Markup } from "telegraf";
import mongoose from "mongoose";
import express from "express";
import dotenv from "dotenv";
import User from "./models/user.js";
import Service from "./models/service.js";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

// 🔥 Express Server (Render + UptimeRobot Ping)
app.get("/", (req, res) => res.send("Bot is Running... ✅"));
app.listen(process.env.PORT || 3000, () => console.log("🌐 Webserver started"));

// 🧩 MongoDB Connect
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ Mongo Error:", err));

// 💬 Start Command
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  let user = await User.findOne({ userId });
  if (!user) {
    user = await User.create({ userId });
    if (ctx.startPayload) {
      user.referral = ctx.startPayload;
      await user.save();
    }
  }

  const menu = Markup.inlineKeyboard([
    [Markup.button.callback("🛒 New Order", "new_order")],
    [Markup.button.callback("💰 My Balance", "balance")],
    [Markup.button.callback("📦 My Orders", "orders")],
    [Markup.button.callback("👥 Referral", "referral")]
  ]);

  await ctx.reply(`👋 Welcome ${ctx.from.first_name}!\n\nUse the menu below:`, menu);
});

// 💰 Balance Menu
bot.action("balance", async (ctx) => {
  await ctx.answerCbQuery();
  const user = await User.findOne({ userId: ctx.from.id });
  const menu = Markup.inlineKeyboard([
    [Markup.button.callback("➕ Deposit", "deposit")]
  ]);
  await ctx.editMessageText(`💰 Your Balance: ₹${user.balance}\n\n`, menu);
});

// 💸 Deposit System (Simulation)
bot.action("deposit", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("💵 Enter amount to deposit (minimum ₹50):");
  bot.once("text", async (ctx2) => {
    const amt = parseInt(ctx2.message.text);
    if (amt < 50) return ctx2.reply("❌ Minimum deposit ₹50!");
    await ctx2.reply("📸 Send your payment transaction ID (12 digits only):");
    bot.once("text", async (ctx3) => {
      const txid = ctx3.message.text;
      if (!/^\d{12}$/.test(txid)) return ctx3.reply("❌ Invalid Transaction ID!");
      // Send to Admin for approval
      await bot.telegram.sendMessage(process.env.ADMIN_ID,
        `💰 Deposit Request\n👤 User: ${ctx2.from.first_name} (${ctx2.from.id})\n💵 Amount: ₹${amt}\n🆔 TXID: ${txid}`,
        Markup.inlineKeyboard([
          [Markup.button.callback(`✅ Approve ₹${amt}`, `approve_${ctx2.from.id}_${amt}`)]
        ])
      );
      ctx3.reply("✅ Deposit request sent to admin!");
    });
  });
});

// 👑 Admin Deposit Approval
bot.action(/approve_(\d+)_(\d+)/, async (ctx) => {
  const [_, userId, amt] = ctx.match;
  const user = await User.findOne({ userId });
  user.balance += Number(amt);
  user.deposits.push({ amt, date: new Date() });
  await user.save();
  await ctx.reply(`✅ Approved ₹${amt} for user ${userId}`);
  await bot.telegram.sendMessage(userId, `🎉 ₹${amt} added to your balance!`);
});

// ⚙️ Set Service (Admin Only)
bot.command("setservice", async (ctx) => {
  if (ctx.from.id != process.env.ADMIN_ID) return;
  const parts = ctx.message.text.split(" ");
  const [cmd, name, apiLink, price] = parts;
  if (!name || !apiLink || !price) return ctx.reply("Usage: /setservice name apilink pricePer1k");
  await Service.findOneAndUpdate({ name }, { apiLink, pricePer1k: price }, { upsert: true });
  ctx.reply(`✅ Service ${name} set with ₹${price}/1k`);
});

// 🛍️ New Order
bot.action("new_order", async (ctx) => {
  await ctx.answerCbQuery();
  const services = await Service.find();
  if (!services.length) return ctx.reply("❌ No service available yet.");
  const buttons = services.map(s => [Markup.button.callback(`${s.name} - ₹${s.pricePer1k}/1k`, `service_${s.name}`)]);
  await ctx.reply("🛍️ Choose a service:", Markup.inlineKeyboard(buttons));
});

// 📦 Handle service order
bot.action(/service_(.+)/, async (ctx) => {
  const name = ctx.match[1];
  const service = await Service.findOne({ name });
  await ctx.reply(`📎 Send your post link for ${name}:`);
  bot.once("text", async (ctx2) => {
    const link = ctx2.message.text;
    await ctx2.reply("📊 Enter quantity (min 500, max 1000000):");
    bot.once("text", async (ctx3) => {
      const qty = parseInt(ctx3.message.text);
      if (qty < 500 || qty > 1000000) return ctx3.reply("❌ Invalid quantity!");
      const cost = (service.pricePer1k / 1000) * qty;
      const user = await User.findOne({ userId: ctx3.from.id });
      if (user.balance < cost) return ctx3.reply("❌ Not enough balance!");
      user.balance -= cost;
      user.orders.push({ service: name, link, qty, cost, date: new Date() });
      await user.save();
      ctx3.reply(`✅ Order placed!\n\n📦 Service: ${name}\n🔗 Link: ${link}\n💰 Cost: ₹${cost}`);
    });
  });
});

// ✅ Launch bot
bot.launch();
console.log("🤖 Bot started successfully!");
