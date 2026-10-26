import { createClient } from "@supabase/supabase-js";
import { processPhoto } from "./_telegramPhotos.js";
import {
    getParsedListing,
    fillMissingTranslations,
} from "./listingParser.js";
import {
    insertCardRow,
    buildCardRow,
    savePage,
    residentialCardFields,
    checkCardDisplay,
    omitEmpty,
    buildListingUrl,
    isSoldKeyword,
    findListingByTelegramMessage,
    findListingForReply,
    markListingSold,
    soldReplyText,
} from "./_listingDb.js";



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


const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

function getVideoInfo(msg) {

    const video = msg.video || (msg.document?.mime_type?.startsWith("video/") ? msg.document : null);

    if (!video) return null;

    return {
        fileId: video.file_id,
        fileSize: video.file_size || 0
    };
}


async function uploadVideo(fileId) {

    try {

        const file = await bot_getFile(fileId);
        if (!file) return "";

        const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

        const response = await fetch(url);

        if (!response.ok) {
            console.log("VIDEO DOWNLOAD FAILED:", response.status);
            return "";
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.mp4`;

        const { error } =
            await supabase.storage
                .from("videos")
                .upload(fileName, buffer, { contentType: "video/mp4" });

        if (error) {
            console.log("VIDEO UPLOAD ERROR:", error);
            return "";
        }

        const { data } = supabase.storage.from("videos").getPublicUrl(fileName);
        return data.publicUrl;

    } catch (e) {

        console.log("VIDEO UPLOAD EXCEPTION:", e);
        return "";
    }
}


async function bot_getFile(fileId) {

    const fileResp = await telegramApi("getFile", { file_id: fileId });

    if (!fileResp.ok) return null;

    return fileResp.result;
}


async function uploadPhoto(fileId) {

    const result = await processPhoto({
        supabase,
        botToken: BOT_TOKEN,
        fileId,
        label: "single"
    });

    return result.ok ? result.url : "";
}


async function createDraftPage(table, linkIdField, cardId, parsed, images, videoUrl) {
    return savePage(supabase, table, linkIdField, cardId, parsed, images, videoUrl);
}


async function processPost(mainMsg, images, videoUrl) {

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

    if (parsed.districtNote) statusLine += `\n${parsed.districtNote}`;
    statusLine += `\n🔗 ${buildListingUrl(parsed.isCommercial, data.id)}`;

    await replyToChannel(mainMsg, statusLine);
}


async function processSoldReply(msg) {

    const listing = await findListingForReply(supabase, msg.chat.id, msg.reply_to_message);

    if (!listing) {
        await replyToChannel(
            msg,
            "⚠️ Не нашёл объявление на сайте для этого поста — отвечайте словом ПРОДАНО прямо на сам пост с объявлением."
        );
        return;
    }

    if (listing.isSold) {
        await replyToChannel(msg, `🔒 Объект «${listing.title}» уже помечен как проданный.`);
        return;
    }

    const result = await markListingSold(supabase, listing.table, listing.id);
    await replyToChannel(msg, soldReplyText(listing, result));
}


async function processEditedPost(msg) {

    const text = msg.caption || msg.text || "";

    if (msg.reply_to_message && isSoldKeyword(text)) return;

    const existing = await findListingByTelegramMessage(supabase, msg.chat.id, msg.message_id);
    if (existing?.isSold) {
        await replyToChannel(msg, `🔒 Объект «${existing.title}» продан и заморожен — изменения на сайт не применены.`);
        return;
    }

    const parsed = await getParsedListing(text);

    await fillMissingTranslations(parsed, ["title", "description"]);
    if (parsed.isCommercial) {
        await fillMissingTranslations(parsed.commercialFields, ["district", "address", "landmark"]);
    }

    const lookup = async (table) => {
        const { data } = await supabase
            .from(table)
            .select("id")
            .eq("tg_chat_id", msg.chat.id)
            .eq("tg_message_id", msg.message_id)
            .maybeSingle();
        return data;
    };

    const cardMatch = await lookup("cardss");
    const commercialMatch = cardMatch ? null : await lookup("commercials");

    const table = cardMatch ? "cardss" : (commercialMatch ? "commercials" : null);
    const id = cardMatch?.id || commercialMatch?.id;

    if (!table) {
        await replyToChannel(
            msg,
            "✏️ Пост отредактирован, но карточка на сайте не найдена (возможно, была создана до подключения вебхука) — поправьте объект вручную в админ-панели."
        );
        return;
    }

    const updateData = parsed.isCommercial
        ? {
            title_ru: parsed.title_ru, title_en: parsed.title_en, title_uz: parsed.title_uz,
            description_ru: parsed.description_ru, description_en: parsed.description_en, description_uz: parsed.description_uz,
            price: parsed.price,
            is_rent: Boolean(parsed.isRent),
            class_ru: "Коммерция",
            class_en: "Commercial",
            class_uz: "Tijorat",
            ...parsed.commercialFields
        }
        : {
            title_ru: parsed.title_ru, title_en: parsed.title_en, title_uz: parsed.title_uz,
            description_ru: parsed.description_ru, description_en: parsed.description_en, description_uz: parsed.description_uz,
            price: parsed.price,
            is_rent: Boolean(parsed.isRent),
            ...residentialCardFields(parsed),
            type_ru: parsed.type.ru, type_en: parsed.type.en, type_uz: parsed.type.uz
        };

    const editFileId = getBestImageFileId(msg);
    if (editFileId) {
        updateData.image = await uploadPhoto(editFileId);
    }

    const { error } = await supabase.from(table).update(omitEmpty(updateData)).eq("id", id);

    if (error) {
        await replyToChannel(msg, `❌ Не удалось обновить объект: ${error.message}`);
        return;
    }

    await replyToChannel(
        msg,
        `✏️ Объект «${parsed.title_ru}» обновлён на сайте\n🔗 ${buildListingUrl(table === "commercials", id)}`
    );
}


async function handleAlbumMessage(msg) {

    const groupId = String(msg.media_group_id);
    const text = msg.caption || msg.text || "";
    const ownFileId = getBestImageFileId(msg);

    const { data: existing } = await supabase
        .from("bot_pending_albums")
        .select("processed")
        .eq("media_group_id", groupId)
        .maybeSingle();

    if (existing?.processed) {
        return;
    }

    if (ownFileId) {

        const { error: rpcError } = await supabase.rpc(
            "append_album_photo",
            {
                p_media_group_id: groupId,
                p_file_id: ownFileId,
                p_message_id: msg.message_id
            }
        );

        if (rpcError) {
            console.log(
                `APPEND ALBUM PHOTO ERROR grp=${groupId} message_id=${msg.message_id} file_id=${ownFileId}:`,
                rpcError
            );
        } else {
            console.log(`ALBUM PHOTO REGISTERED grp=${groupId} message_id=${msg.message_id} file_id=${ownFileId}`);
        }
    }

    const videoInfo = getVideoInfo(msg);

    if (videoInfo) {

        if (videoInfo.fileSize && videoInfo.fileSize > MAX_VIDEO_BYTES) {

            await replyToChannel(msg, "⚠️ Видео в альбоме больше 20 МБ — Telegram не даёт боту скачать такой файл, оно будет пропущено.");

        } else {

            const videoUrl = await uploadVideo(videoInfo.fileId);

            if (videoUrl) {
                const { error: videoSaveError } = await supabase
                    .from("bot_pending_albums")
                    .upsert(
                        { media_group_id: groupId, video: videoUrl, updated_at: new Date().toISOString() },
                        { onConflict: "media_group_id" }
                    );

                if (videoSaveError) {
                    console.log("SAVE ALBUM VIDEO ERROR:", videoSaveError);
                }
            }
        }
    }

    if (!text.trim()) {
        return;
    }

    const { error: saveError, data: saveData } = await supabase
        .from("bot_pending_albums")
        .upsert(
            {
                media_group_id: groupId,
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                caption: text,
                updated_at: new Date().toISOString()
            },
            { onConflict: "media_group_id" }
        )
        .select("media_group_id");

    if (saveError) {
        console.log("SAVE CAPTION ERROR:", saveError);
    } else {
        console.log("SAVE CAPTION OK, affected rows:", saveData?.length, "groupId:", groupId);
    }
}


export default async function handler(req, res) {

    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    if (WEBHOOK_SECRET) {
        const provided = req.headers["x-telegram-bot-api-secret-token"];
        if (provided !== WEBHOOK_SECRET) {
            return res.status(401).json({ error: "Invalid secret token" });
        }
    }

    const update = req.body || {};

    try {

        const msg = update.channel_post;
        const editedMsg = update.edited_channel_post;

        if (editedMsg) {

            if (editedMsg.media_group_id) {

                const groupId = String(editedMsg.media_group_id);
                const editText = editedMsg.caption || editedMsg.text || "";

                if (editText.trim()) {

                    const { data: pending } = await supabase
                        .from("bot_pending_albums")
                        .select("processed")
                        .eq("media_group_id", groupId)
                        .maybeSingle();

                    if (pending && !pending.processed) {

                        await supabase
                            .from("bot_pending_albums")
                            .update({
                                chat_id: editedMsg.chat.id,
                                message_id: editedMsg.message_id,
                                caption: editText
                            })
                            .eq("media_group_id", groupId);

                        return res.status(200).json({ ok: true });
                    }
                }
            }

            await processEditedPost(editedMsg);
            return res.status(200).json({ ok: true });
        }

        if (!msg) return res.status(200).json({ ok: true });

        const text = msg.caption || msg.text || "";

        if (msg.reply_to_message && isSoldKeyword(text)) {
            await processSoldReply(msg);
            return res.status(200).json({ ok: true });
        }

        const videoInfo = getVideoInfo(msg);

        if (!text.trim() && !getBestImageFileId(msg) && !videoInfo) {
            return res.status(200).json({ ok: true });
        }

        if (msg.media_group_id) {
            await handleAlbumMessage(msg);
            return res.status(200).json({ ok: true });
        }

        const mainFileId = getBestImageFileId(msg);
        const image = mainFileId ? await uploadPhoto(mainFileId) : "";

        let videoUrl = "";
        if (videoInfo) {
            if (videoInfo.fileSize && videoInfo.fileSize > MAX_VIDEO_BYTES) {
                await replyToChannel(msg, "⚠️ Видео больше 20 МБ — Telegram не даёт боту скачать такой файл. Объект будет создан без видео, добавьте его вручную при желании.");
            } else {
                videoUrl = await uploadVideo(videoInfo.fileId);
            }
        }

        await processPost(msg, image ? [image] : [], videoUrl);

        return res.status(200).json({ ok: true });

    } catch (e) {

        console.log("WEBHOOK HANDLER EXCEPTION:", e);
        return res.status(200).json({ ok: true });
    }
}