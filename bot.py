"""
Userbot that repeatedly blocks and unblocks a Telegram user on YOUR account.

Uses Telethon (MTProto client API) because the Bot API cannot manage the
block list of a personal account.
"""
import asyncio
import logging
import os
import random

from dotenv import load_dotenv
from telethon import TelegramClient, errors
from telethon.tl.functions.contacts import BlockRequest, UnblockRequest

load_dotenv()

API_ID = int(os.environ["TG_API_ID"])
API_HASH = os.environ["TG_API_HASH"]
TARGET = os.getenv("TARGET_USERNAME", "egplantaa")
# Seconds between each block/unblock action. Keep this generous:
# hammering contacts.block will trigger FloodWait and can get your
# account limited or banned by Telegram.
INTERVAL = float(os.getenv("INTERVAL_SECONDS", "60"))
JITTER = float(os.getenv("JITTER_SECONDS", "10"))
MIN_INTERVAL = 15.0

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
)
log = logging.getLogger("block-unblock")


async def pause():
    await asyncio.sleep(max(MIN_INTERVAL, INTERVAL) + random.uniform(0, JITTER))


async def run(client: TelegramClient):
    target = await client.get_input_entity(TARGET)
    log.info("Target resolved: @%s", TARGET)
    blocked = False
    cycles = 0
    while True:
        try:
            if blocked:
                await client(UnblockRequest(id=target))
                log.info("Unblocked @%s", TARGET)
            else:
                await client(BlockRequest(id=target))
                log.info("Blocked @%s", TARGET)
            blocked = not blocked
            if not blocked:
                cycles += 1
                log.info("Completed cycle #%d", cycles)
        except errors.FloodWaitError as e:
            log.warning("FloodWait: sleeping %s seconds", e.seconds)
            await asyncio.sleep(e.seconds + 5)
            continue
        except errors.RPCError as e:
            log.error("Telegram error: %s; retrying after pause", e)
        await pause()


async def main():
    client = TelegramClient(os.getenv("SESSION_NAME", "userbot"), API_ID, API_HASH)
    await client.start()  # prompts for phone + login code on first run
    try:
        await run(client)
    finally:
        # Leave the user unblocked when the script stops.
        try:
            await client(UnblockRequest(id=await client.get_input_entity(TARGET)))
            log.info("Exiting: left @%s unblocked", TARGET)
        except Exception as e:  # noqa: BLE001
            log.warning("Could not unblock on exit: %s", e)
        await client.disconnect()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
