import { createClient } from "@supabase/supabase-js";
import { isGeminiConfigured } from "./aiProviders.js";
import { processAlbumPhotos } from "./_telegramPhotos.js";
import {
    getParsedListing,
    fillMissingTranslations,
} from "./listingParser.js";
import {
    insertCardRow,
    buildCardRow,
    savePage,
    checkCardDisplay,
    buildListingUrl,
} from "./_listingDb.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));



const BOT_TOKEN = process.env.PARSER_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);


async function telegramApi(method, params) {

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
    });

    const data = await res.json();

    if (!data.ok) {
        console.log(`TELEGRAM API ERROR (${method}):`, data.description);
    }

    return data;
}


async function replyToChannel(msg, text) {
    try {
        await telegramApi("sendMessage", {
            chat_id: msg.chat.id,
            text,
            reply_to_message_id: msg.message_id
        });
    } catch (e) {
        console.log("REPLY ERROR:", e.message);
    }
}


function getBestImageFileId(msg) {

    if (msg.document?.mime_type?.startsWith("image/")) {
        return msg.document.file_id;
    }

    if (msg.photo?.length) {
        return msg.photo[msg.photo.length - 1].file_id;
    }

    return null;
}


async function uploadPhoto(fileId) {

    try {

        const fileResp = await telegramApi("getFile", { file_id: fileId });
        if (!fileResp.ok) return "";

        const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileResp.result.file_path}`;

        const response = await fetch(url);

        if (!response.ok) {
            console.log("DOWNLOAD FROM TELEGRAM FAILED:", response.status);
            return "";
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        const looksLikeImage =
            buffer.length > 100 &&
            ((buffer[0] === 0xff && buffer[1] === 0xd8) ||
                (buffer[0] === 0x89 && buffer[1] === 0x50));

        if (!looksLikeImage) {
            console.log("DOWNLOADED FILE DOES NOT LOOK LIKE AN IMAGE, size:", buffer.length);
            return "";
        }

        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

        const { error } =
            await supabase.storage
                .from("images")
                .upload(fileName, buffer, { contentType: "image/jpeg", cacheControl: "31536000" });

        if (error) {
            console.log("UPLOAD ERROR:", error);
            return "";
        }

        const { data } = supabase.storage.from("images").getPublicUrl(fileName);
        return data.publicUrl;

    } catch (e) {

        console.log("UPLOAD EXCEPTION:", e);
        return "";
    }
}


async function createDraftPage(table, linkIdField, cardId, parsed, images, videoUrl) {
    return savePage(supabase, table, linkIdField, cardId, parsed, images, videoUrl);
}


async function processPost(mainMsg, images, videoUrl, photoReport) {

    const image = images[0] || "";
    const hasVideo = Boolean(videoUrl);

    const text = mainMsg.caption || mainMsg.text || "";
    const parsed = await getParsedListing(text);

    if (parsed.isSold) {
        await replyToChannel(mainMsg, "ℹ️ Похоже, объект уже продан/снят — пост не публикую на сайт. Если это не так, добавьте объект вручную в админке.");
        return;
    }

    await fillMissingTranslations(parsed, ["title", "description", "about"]);

    if (parsed.isCommercial) {
        await fillMissingTranslations(parsed.commercialFields, ["district", "address", "landmark"]);
    }

    if (!image && !hasVideo) parsed.missing.push("фото");

    const { table, row: insertData } = buildCardRow(parsed, {
        image,
        videoUrl,
        tgChatId: mainMsg.chat.id,
        tgMessageId: mainMsg.message_id
    });

    checkCardDisplay(parsed);

    const { data, error } = await insertCardRow(supabase, table, insertData, {
        tgChatId: insertData.tg_chat_id,
        tgMessageId: insertData.tg_message_id
    });

    if (error) {
        console.log("DB ERROR:", error);
        await replyToChannel(mainMsg, `❌ Не удалось сохранить объект: ${error.message}`);
        return;
    }

    const link = parsed.isCommercial ? `/commercial/${data.id}` : `/property/${data.id}`;
    await supabase.from(table).update({ link }).eq("id", data.id);

    const draftTable = parsed.isCommercial ? "commercial_pages" : "villas";
    const draftLinkField = parsed.isCommercial ? "commercial_id" : "card_id";
    const draftOk = await createDraftPage(draftTable, draftLinkField, data.id, parsed, images, videoUrl);

    const label = parsed.isCommercial ? "коммерция" : "жильё";

    let statusLine = parsed.missing.length
        ? `⚠️ Добавлено (${label}): «${parsed.title_ru}».\nНе распознано: ${parsed.missing.join(", ")} — проверьте и дозаполните в админ-панели.`
        : `✅ Добавлено (${label}): «${parsed.title_ru}» — ${parsed.price || "цена не указана"}`;

    statusLine += draftOk
        ? "\n📝 Черновик страницы объекта создан — откройте её в админке и дозаполните описание/удобства при необходимости."
        : "\n⚠️ Карточка создана, но черновик страницы объекта создать не удалось — заведите её вручную.";

    if (photoReport && photoReport.okCount < photoReport.total) {
        statusLine += `\n⚠️ Загружено фото: ${photoReport.okCount} из ${photoReport.total}. Недостающие добавьте вручную в админке (причины — в логах функции).`;
    }

    statusLine += `\n🔗 ${buildListingUrl(parsed.isCommercial, data.id)}`;

    await replyToChannel(mainMsg, statusLine);
}


const SETTLE_SECONDS = 10;

const START_NEW_ALBUM_BEFORE_MS = 25_000;
const PHOTO_DEADLINE_MS = 40_000;

export default async function handler(req, res) {

    if (req.method !== "GET" && req.method !== "POST") {
        res.setHeader("Allow", "GET, POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const secret = process.env.FINALIZE_SECRET;

    if (secret) {
        const provided = req.query?.secret || req.headers["x-finalize-secret"];
        if (provided !== secret) {
            return res.status(401).json({ error: "Invalid secret" });
        }
    }

    try {

        const cutoff = new Date(Date.now() - SETTLE_SECONDS * 1000).toISOString();

        const { data: candidates, error } = await supabase
            .from("bot_pending_albums")
            .select("media_group_id, chat_id, message_id, caption, video")
            .eq("processed", false)
            .not("caption", "is", null)
            .lt("updated_at", cutoff)
            .limit(20);

        if (error) {
            console.log("FINALIZE QUERY ERROR:", error);
            return res.status(500).json({ error: error.message });
        }

        if (!candidates?.length) {
            return res.status(200).json({ ok: true, processed: 0 });
        }

        let processedCount = 0;
        const startedAt = Date.now();
        const botToken = process.env.PARSER_BOT_TOKEN;

        const throttleAiCalls = isGeminiConfigured() && candidates.length > 1;

        for (const row of candidates) {

            if (Date.now() - startedAt > START_NEW_ALBUM_BEFORE_MS) {
                console.log("FINALIZE: time budget reached, remaining albums go to the next run");
                break;
            }

            if (throttleAiCalls && processedCount > 0) {
                await sleep(400);
            }

            const { data: claimed, error: claimError } = await supabase
                .from("bot_pending_albums")
                .update({ processed: true })
                .eq("media_group_id", row.media_group_id)
                .eq("processed", false)
                .select("images, photo_file_ids")
                .maybeSingle();

            if (claimError) {
                console.log("FINALIZE CLAIM ERROR:", row.media_group_id, claimError);
                continue;
            }

            if (!claimed) continue;

            const syntheticMsg = {
                chat: { id: row.chat_id },
                message_id: row.message_id,
                caption: row.caption
            };

            let photos;

            try {
                photos = await processAlbumPhotos({
                    supabase,
                    botToken,
                    entries: claimed.photo_file_ids,
                    groupId: row.media_group_id,
                    deadline: startedAt + PHOTO_DEADLINE_MS
                });
            } catch (e) {
                console.log("FINALIZE PHOTOS PIPELINE ERROR:", row.media_group_id, e);
                await supabase
                    .from("bot_pending_albums")
                    .update({ processed: false })
                    .eq("media_group_id", row.media_group_id);
                continue;
            }

            const legacyImages = Array.isArray(claimed.images) ? claimed.images.filter(Boolean) : [];
            const allImages = [...new Set([...legacyImages, ...photos.urls])];

            console.log(
                `FINALIZE grp=${row.media_group_id}: images=${allImages.length} ` +
                `(registered=${photos.total}, uploaded=${photos.okCount}, failed=${photos.failures.length}, legacy=${legacyImages.length})`
            );

            try {
                await processPost(
                    syntheticMsg,
                    allImages,
                    row.video || "",
                    { total: photos.total + legacyImages.length, okCount: allImages.length }
                );
                processedCount++;
            } catch (e) {
                console.log("FINALIZE PROCESS POST ERROR:", row.media_group_id, e);
            }
        }

        return res.status(200).json({ ok: true, processed: processedCount, checked: candidates.length });

    } catch (e) {

        console.log("FINALIZE HANDLER EXCEPTION:", e);
        return res.status(500).json({ error: e.message });
    }
}
