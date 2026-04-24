import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import http from 'http';

// TASK-305: Status emoji mapping
const STATUS_EMOJIS = {
  "Secured":      "🧾",
  "In Warehouse": "📦",
  "In Transit":   "✈️",
  "Arrived":      "🏠",
  "Completed":    "✅",
  "Default":      "❓"
};

const bot = new Telegraf(process.env.BOT_TOKEN);

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/"/g, '').replace(/\\n/g, '\n'), 
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);

// /start — welcome, show ID, and auto-fill USER_ID in sheet by username match
bot.start(async (ctx) => {
  const telegramId = ctx.from.id.toString();
  const telegramUsername = ctx.from.username || "";

  ctx.replyWithMarkdown(
    `✨ *Welcome to Serene Space Tracker!* ✨\n\n` +
    `Your Telegram ID is: \`${telegramId}\`\n\n` +
    `Use /check to see your Group Order status.\n` +
    `Use /myid if the admin needs your Telegram ID.`
  );

  if (!telegramUsername) return;

  try {
    await doc.loadInfo();
    const buyerSheet = doc.sheetsByTitle['BUYER_LIST'];
    const rows = await buyerSheet.getRows();

    let updated = 0;
    for (const row of rows) {
      const sheetUsername = (row.get('USERNAME') || '').toString().trim();
      const existingId    = (row.get('USER_ID')  || '').toString().trim();

      if (sheetUsername.toLowerCase() !== telegramUsername.toLowerCase()) continue;
      if (existingId === telegramId) continue;

      row.set('USER_ID', telegramId);
      await row.save();
      updated++;
    }

    if (updated > 0) {
      ctx.replyWithMarkdown(`✅ Your Telegram ID has been linked to your order${updated > 1 ? 's' : ''} automatically!`);
    }
  } catch (err) {
    console.error("Start sheet update error:", err);
  }
});

// TASK-403: /myid — quick ID lookup
bot.command('myid', (ctx) => {
  ctx.replyWithMarkdown(
    `🆔 *Your Telegram ID is:* \`${ctx.from.id}\`\n\nGive this to the admin to link your orders!`
  );
});

// TASK-301, 304, 305: /check — core order lookup with status grouping
bot.command('check', async (ctx) => {
  const telegramUserId = ctx.from.id.toString();
  const telegramUsername = ctx.from.username || "";

  ctx.sendChatAction('typing'); // TASK-402

  try {
    await doc.loadInfo();
    const buyerSheet = doc.sheetsByTitle['BUYER_LIST'];
    const batchSheet = doc.sheetsByTitle['GO_BATCH_LIST'];

    // Build batch status map for relational fallback lookup
    const batchStatusMap = {};
    if (batchSheet) {
      const batchRows = await batchSheet.getRows();
      for (const row of batchRows) {
        const batchId = row.get('BATCH_ID');
        if (batchId) batchStatusMap[batchId] = row.get('STATUS') || "";
      }
    }

    const rows = await buyerSheet.getRows();
    const buckets = {}; // TASK-304: group items by final status
    let foundMatch = false;

    for (const row of rows) {
      const sheetUserId   = (row.get('USER_ID')   || '').toString().trim();
      const sheetUsername = (row.get('USERNAME')   || '').toString().trim();

      // TASK-205: match by Telegram ID, with username as fallback
      const isIdMatch   = sheetUserId === telegramUserId;
      const isUserMatch = telegramUsername &&
        sheetUsername.toLowerCase() === telegramUsername.toLowerCase();

      if (!isIdMatch && !isUserMatch) continue;

      foundMatch = true;

      // Support both current (GO_BATCH_ID / TRACKING_STATUS) and new column names
      const batchId   = (row.get('BATCH_ID') || row.get('GO_BATCH_ID')      || '').toString().trim();
      const item      = (row.get('ITEM')             || '').toString().trim();
      const rowStatus = (row.get('STATUS')           || row.get('TRACKING_STATUS')  || '').toString().trim();

      // Relational lookup: row status → batch map status → default "Secured"
      const finalStatus = rowStatus || batchStatusMap[batchId] || "Secured";

      if (!buckets[finalStatus]) buckets[finalStatus] = [];
      buckets[finalStatus].push(`• ${item} (${batchId})`);
    }

    if (!foundMatch) {
      await ctx.replyWithMarkdown(
        `🥺 *No orders found.*\n\n` +
        `Please make sure the admin has your ID (\`${telegramUserId}\`) or username in the sheet.`
      );
      return;
    }

    // TASK-304 & 305: build grouped message with status emoji headers
    let message = "🔍 *Your Order Status:*\n\n";
    for (const status in buckets) {
      const emoji = STATUS_EMOJIS[status] || STATUS_EMOJIS["Default"];
      message += `${emoji} *${status.toUpperCase()}*\n`;
      message += buckets[status].join("\n") + "\n\n";
    }

    await sendLongMessage(ctx, message.trimEnd());

  } catch (error) {
    console.error("Check Error:", error);
    ctx.reply("❌ Sorry, I had trouble reading the sheet. Please try again later.");
  }
});

// TASK-401: split messages that exceed Telegram's 4096-char limit
async function sendLongMessage(ctx, text) {
  if (text.length <= 4000) {
    await ctx.replyWithMarkdown(text);
    return;
  }
  const parts = text.match(/[\s\S]{1,4000}/g) || [];
  for (const part of parts) {
    await ctx.replyWithMarkdown(part);
  }
}

bot.launch();
console.log('🚀 Production Bot is active.');

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => res.end('Bot is alive!')).listen(PORT, () => {
  console.log(`🌐 Dummy server listening on port ${PORT} to keep Render happy`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
