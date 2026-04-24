require('dotenv').config();
const { Telegraf } = require('telegraf');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// Initialize the Telegram Bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Initialize the Google Sheets Auth
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);

// COMMAND: /check
bot.command('check', async (ctx) => {
  const telegramUserId = ctx.message.from.id.toString();
  
  // Show "typing..." indicator instantly
  ctx.sendChatAction('typing');

  try {
    // Load the document properties and the first sheet
    await doc.loadInfo(); 
    const sheet = doc.sheetsByIndex[0]; 
    
    // Fetch all rows
    const rows = await sheet.getRows();
    let foundItems = [];

    // Loop through rows to find matching User ID
    // Note: google-spreadsheet parses columns by header name, making it very robust!
    for (const row of rows) {
      if (row.get('USER_ID') === telegramUserId) {
        foundItems.push(`🛒 *${row.get('GO_BATCH')}*\n📦 Item: ${row.get('ITEM')}\n🟢 Status: ${row.get('TRACKING_STATUS')}\n`);
      }
    }

    if (foundItems.length > 0) {
      await ctx.reply(`🔍 *Here are your GO items!*\n\n${foundItems.join("\n")}`, { parse_mode: 'Markdown' });
    } else {
      await ctx.reply("🥺 We couldn't find any items linked to your ID.", { parse_mode: 'Markdown' });
    }

  } catch (error) {
    console.error("Sheet Error:", error);
    await ctx.reply("❌ An error occurred while checking the database.");
  }
});

// Start the bot using Long Polling (Perfect for Node.js hosting)
bot.launch();
console.log('Bot is running...');

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));