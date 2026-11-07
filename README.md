# Block / Unblock @egplantaa

A Telegram **userbot** that keeps blocking and unblocking `@egplantaa` on your
own account. A normal @BotFather bot can't change your personal block list,
so this logs in as you through Telegram's client API (Telethon).

## Setup

1. Go to <https://my.telegram.org>, log in, open **API development tools**, and
   create an app to get `api_id` and `api_hash`.
2. Install and configure:
   ```bash
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env   # then fill in TG_API_ID and TG_API_HASH
   ```
3. Run it:
   ```bash
   python bot.py
   ```
   The first time, it asks for your phone number and the login code Telegram
   sends you. After that it saves a `userbot.session` file. Keep that file
   private: anyone who has it can use your account.

Stop it with `Ctrl+C`. When it exits, it leaves the user unblocked.

## Settings (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `TARGET_USERNAME` | `egplantaa` | Username to toggle (no `@`) |
| `INTERVAL_SECONDS` | `60` | Seconds between actions (minimum 15) |
| `JITTER_SECONDS` | `10` | Random extra delay added each time |

## Warning

Telegram rate-limits block/unblock calls. The script waits out `FloodWait`
errors on its own, but automating your account this way breaks Telegram's
rules. Short intervals can get your account limited or banned. Use it at your
own risk, and don't lower the interval much.
