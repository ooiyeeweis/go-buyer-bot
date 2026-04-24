# Serene Space Tracker Bot

A Telegram bot for Group Order (GO) buyers to self-serve their order status, backed by a Google Sheets spreadsheet managed by the admin.

## Features

- Buyers can check their order status directly in Telegram without asking the admin
- Orders are grouped by status with emoji headers for easy reading
- Telegram ID is automatically written to the sheet when a buyer starts the bot — no manual ID entry needed
- Matching works by Telegram ID (primary) or username (fallback), so buyers are found even before their ID is recorded

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message showing the user's Telegram ID; auto-links the ID to their rows in the sheet |
| `/check` | Shows all orders belonging to the user, grouped by status |

## Google Sheets Structure

The bot reads from two tabs in the spreadsheet:

**`BUYER_LIST`** — one row per order item

| Column | Header | Description |
|--------|--------|-------------|
| A | `USERNAME` | Buyer's Telegram username (without `@`) |
| B | `ITEM` | Item name or description |
| C | `BATCH_ID` | References a batch in `GO_BATCH_LIST` |
| D | `USER_ID` | Buyer's Telegram ID — auto-filled by `/start` |
| E | `STATUS` | *(optional)* Row-level status override |

**`GO_BATCH_LIST`** — one row per batch

| Column | Header | Description |
|--------|--------|-------------|
| A | `BATCH_ID` | Unique batch identifier |
| B | `STATUS` | Batch-wide status applied to all items in the batch |

### Status values

| Status | Emoji |
|--------|-------|
| Secured | 🧾 |
| In Warehouse | 📦 |
| In Transit | ✈️ |
| Arrived | 🏠 |
| Completed | ✅ |

Status resolution order: row-level `STATUS` → batch `STATUS` from `GO_BATCH_LIST` → defaults to `Secured`.

## Setup

### Prerequisites

- Node.js 18+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A Google Cloud service account with the Sheets API enabled
- A Google Spreadsheet shared with the service account's email

### Environment variables

Create a `.env` file in the project root:

```env
BOT_TOKEN=your_telegram_bot_token
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
SPREADSHEET_ID=your_google_spreadsheet_id
PORT=3000
```

> `GOOGLE_PRIVATE_KEY` should be the raw private key string with literal `\n` characters — the bot handles the formatting automatically.

### Install and run

```bash
npm install
npm start
```

## Deployment

The bot includes a lightweight HTTP server that responds to `GET /` with `Bot is alive!`. This keeps the service alive on platforms like [Render](https://render.com) that require an open port.

Set all environment variables in your hosting platform's dashboard and deploy with `npm start`.
