// server/bot.js — long-polling версия бота, для запуска на своём
// компьютере или VPS (`npm run bot`). Работает, только пока запущен этот
// процесс — если это не подходит, используйте api/telegram-webhook.js
// (serverless-версия на Vercel, работает всегда без единого запущенного
// процесса — см. инструкцию в начале того файла).
//
// Вся логика разбора поста и перевода вынесена в api/listingParser.js
// и используется в обеих версиях бота, чтобы не расходиться местами.

import "dotenv/config";

import TelegramBot from "node-telegram-bot-api";
import { createClient } from "@supabase/supabase-js";

import {
    getParsedListing,
    fillMissingTranslations
} from "../api/listingParser.js";
import {
    insertCardRow,
    buildCardRow,
    savePage,
    residentialCardFields,
    checkCardDisplay,
    omitEmpty,
    buildListingUrl,
} from "../api/_listingDb.js";


const bot = new TelegramBot(
    process.env.PARSER_BOT_TOKEN,
    { polling: true }
);


// ⚠️ Боту нужен service_role ключ (он должен обходить RLS, чтобы вставлять
// строки без авторизованного пользователя). Держите его ТОЛЬКО тут, в
// server/.env, под именем SUPABASE_SERVICE_KEY — без префикса VITE_,
// чтобы Vite не зашил его в бандл сайта.
const SUPABASE_KEY =
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY;

if (!process.env.SUPABASE_SERVICE_KEY) {
    console.warn(
        "⚠️  SUPABASE_SERVICE_KEY не задан — бот использует VITE_SUPABASE_KEY.\n" +
        "    Это тот же ключ, что и на сайте. Если это service_role — срочно" +
        " разнесите ключи."
    );
}

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    SUPABASE_KEY
);


bot.on("polling_error", (err) => {
    console.log("TELEGRAM POLLING ERROR:", err.message);
});




// Telegram сам сжимает любое фото, отправленное как обычное "Photo"
// (уменьшает и переупаковывает JPEG с потерей качества) — это
// ограничение самого Telegram, бот тут ничего не решает. Если фото
// отправлено как файл ("Отправить как файл", без сжатия) — оно приходит
// как msg.document с mime_type вида image/*, без потери качества.
// Предпочитаем такой вариант, если он есть.
function getBestImageFileId(msg) {

    if (msg.document?.mime_type?.startsWith("image/")) {
        return msg.document.file_id;
    }

    if (msg.photo?.length) {
        return msg.photo[msg.photo.length - 1].file_id;
    }

    return null;
}


// Telegram Bot API не даёт боту скачать файл больше 20 МБ — жёсткое
// ограничение самого Telegram. Если видео тяжелее, просто пропускаем его.
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

function getVideoInfo(msg) {

    const video = msg.video || (msg.document?.mime_type?.startsWith("video/") ? msg.document : null);

    if (!video) return null;

    return { fileId: video.file_id, fileSize: video.file_size || 0 };
}


async function uploadVideo(fileId) {

    try {

        const file = await bot.getFile(fileId);

        const url =
            `https://api.telegram.org/file/bot${process.env.PARSER_BOT_TOKEN}/${file.file_path}`;

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


async function uploadPhoto(fileId) {

    try {

        const file = await bot.getFile(fileId);

        const url =
            `https://api.telegram.org/file/bot${process.env.PARSER_BOT_TOKEN}/${file.file_path}`;

        const response = await fetch(url);

        if (!response.ok) {
            console.log("DOWNLOAD FROM TELEGRAM FAILED:", response.status);
            return "";
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // подстраховка: если это всё-таки не картинка (например, Telegram
        // отдал HTML-страницу с ошибкой вместо файла, а response.ok был
        // true из-за редиректа) — не льём мусор в Storage под видом jpeg.
        // JPEG всегда начинается с байтов FF D8, PNG — 89 50 4E 47.
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
                .upload(fileName, buffer, { contentType: "image/jpeg" });

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




// Память о недавно созданных записях: chatId:messageId -> { table, id }.
// Живёт, пока запущен процесс (сбрасывается при рестарте).
const recentPosts = new Map();

function rememberPost(chatId, messageId, table, id) {

    const key = `${chatId}:${messageId}`;
    recentPosts.set(key, { table, id, at: Date.now() });

    if (recentPosts.size > 500) {
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        for (const [k, v] of recentPosts) {
            if (v.at < dayAgo) recentPosts.delete(k);
        }
    }
}




// Группировка альбомов (несколько фото в одном посте) — тут можно
// использовать простую задержку через setTimeout, т.к. процесс живёт
// постоянно (в отличие от serverless-версии, где для этого нужна база).
const pendingGroups = new Map();

function handleIncomingPost(msg) {

    if (!msg.media_group_id) {
        processPost(msg, [msg]);
        return;
    }

    const key = msg.media_group_id;

    if (!pendingGroups.has(key)) {
        pendingGroups.set(key, { messages: [], timer: null });
    }

    const group = pendingGroups.get(key);
    group.messages.push(msg);

    clearTimeout(group.timer);

    group.timer = setTimeout(() => {
        pendingGroups.delete(key);
        const mainMsg = group.messages.find(m => m.caption) || group.messages[0];
        processPost(mainMsg, group.messages);
    }, 1500);
}




async function processPost(mainMsg, allMsgs) {

    try {

        const text = mainMsg.caption || mainMsg.text || "";

        if (!text.trim() && !allMsgs.some(m => getBestImageFileId(m))) {
            return;
        }

        const parsed = await getParsedListing(text);

        if (parsed.isSold) {
            await replyToChannel(mainMsg, "ℹ️ Похоже, объект уже продан/снят — пост не публикую на сайт. Если это не так, добавьте объект вручную в админке.");
            return;
        }

        await fillMissingTranslations(parsed, ["title", "description", "about"]);

        if (parsed.isCommercial) {
            await fillMissingTranslations(parsed.commercialFields, ["district", "address", "landmark"]);
        }

        // собираем и грузим ВСЕ фото альбома (не только первое) — они пойдут
        // в галерею детальной страницы; для самой карточки (image) по-прежнему
        // используется только первое, как и раньше
        const fileIds = allMsgs.map(getBestImageFileId).filter(Boolean);

        const uploaded = [];
        for (const fileId of fileIds) {
            const url = await uploadPhoto(fileId);
            if (url) uploaded.push(url);
        }

        let videoUrl = "";
        const videoMsg = allMsgs.find(m => getVideoInfo(m));

        if (videoMsg) {

            const videoInfo = getVideoInfo(videoMsg);

            if (videoInfo.fileSize && videoInfo.fileSize > MAX_VIDEO_BYTES) {
                await replyToChannel(mainMsg, "⚠️ Видео больше 20 МБ — Telegram не даёт боту скачать такой файл. Объект будет создан без видео.");
            } else {
                videoUrl = await uploadVideo(videoInfo.fileId);
            }
        }

        const hasVideo = Boolean(videoUrl);

        const image = uploaded[0] || "";

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
            console.log("❌ DB ERROR:", error);
            await replyToChannel(mainMsg, `❌ Не удалось сохранить объект: ${error.message}`);
            return;
        }

        rememberPost(mainMsg.chat.id, mainMsg.message_id, table, data.id);
        console.log(`🔥 Добавлено в ${table}, id=${data.id}`);

        const link = parsed.isCommercial ? `/commercial/${data.id}` : `/property/${data.id}`;
        await supabase.from(table).update({ link }).eq("id", data.id);

        const draftTable = parsed.isCommercial ? "commercial_pages" : "villas";
        const draftLinkField = parsed.isCommercial ? "commercial_id" : "card_id";
        const draftOk = await createDraftPage(draftTable, draftLinkField, data.id, parsed, uploaded, videoUrl);

        const label = parsed.isCommercial ? "коммерция" : "жильё";

        let statusLine = parsed.missing.length
            ? `⚠️ Добавлено (${label}): «${parsed.title_ru}».\nНе распознано: ${parsed.missing.join(", ")} — проверьте и дозаполните в админ-панели.`
            : `✅ Добавлено (${label}): «${parsed.title_ru}» — ${parsed.price || "цена не указана"}`;

        statusLine += draftOk
            ? "\n📝 Черновик страницы объекта создан — откройте её в админке и дозаполните описание/удобства при необходимости."
            : "\n⚠️ Карточка создана, но черновик страницы объекта создать не удалось — заведите её вручную.";

        statusLine += `\n🔗 ${buildListingUrl(parsed.isCommercial, data.id)}`;

        await replyToChannel(mainMsg, statusLine);

    } catch (e) {

        console.log("PROCESS POST EXCEPTION:", e);
        await replyToChannel(mainMsg, "❌ Не удалось обработать пост — проверьте формат вручную.");
    }
}




async function replyToChannel(msg, text) {
    try {
        await bot.sendMessage(msg.chat.id, text, { reply_to_message_id: msg.message_id });
    } catch (e) {
        console.log("REPLY ERROR:", e.message);
    }
}




bot.on("edited_channel_post", async (msg) => {

    try {

        const key = `${msg.chat.id}:${msg.message_id}`;
        const known = recentPosts.get(key);

        if (!known) {
            await replyToChannel(
                msg,
                "✏️ Пост отредактирован, но карточка была создана слишком давно (или бот перезапускался) — " +
                "автосинхронизация недоступна. Поправьте объект вручную в админ-панели."
            );
            return;
        }

        const text = msg.caption || msg.text || "";
        const parsed = await getParsedListing(text);

        await fillMissingTranslations(parsed, ["title", "description"]);
        if (parsed.isCommercial) {
            await fillMissingTranslations(parsed.commercialFields, ["district", "address", "landmark"]);
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

        if (getBestImageFileId(msg)) {
            updateData.image = await uploadPhoto(getBestImageFileId(msg));
        }

        const { error } =
            await supabase.from(known.table).update(omitEmpty(updateData)).eq("id", known.id);

        if (error) {
            console.log("❌ UPDATE ERROR:", error);
            await replyToChannel(msg, `❌ Не удалось обновить объект: ${error.message}`);
            return;
        }

        await replyToChannel(
            msg,
            `✏️ Объект «${parsed.title_ru}» обновлён на сайте\n🔗 ${buildListingUrl(known.table === "commercials", known.id)}`
        );

    } catch (e) {
        console.log("EDIT HANDLER EXCEPTION:", e);
    }
});




bot.on("channel_post", handleIncomingPost);