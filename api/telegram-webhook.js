// /api/telegram-webhook — принимает посты из Telegram-канала через
// webhook вместо long-polling. Работает как обычная serverless-функция
// на том же хостинге (Vercel), что и сайт — не нужен отдельный сервер
// и не нужно ничего запускать руками в терминале.
//
// Файл специально самодостаточный (без импорта из ../server/*) — Vercel
// не всегда корректно трассирует и включает в бандл функции файлы вне
// папки api/ в проектах без фреймворк-пресета (Vite/"Other"), из-за
// этого раньше падало с "Cannot find module '.../server/listingParser.js'".
// Импорт из api/aiProviders.js (соседний файл в этой же папке) — не та
// же проблема, Vercel такие относительные импорты внутри api/ трассирует
// нормально. Вся ОСТАЛЬНАЯ логика разбора поста (regex-парсер,
// переводы и т.п.) по-прежнему продублирована и здесь, и в
// server/listingParser.js (для polling-версии бота в server/bot.js) —
// при правках этой части меняйте оба файла одинаково.
//
// КАК ПОДКЛЮЧИТЬ (один раз, после деплоя):
//   1. В Vercel -> Settings -> Environment Variables добавьте:
//        PARSER_BOT_TOKEN         — токен вашего Telegram-бота
//        SUPABASE_SERVICE_KEY     — service_role ключ Supabase (НЕ тот,
//                                    что в VITE_SUPABASE_KEY на фронте!)
//        VITE_SUPABASE_URL        — уже должен быть настроен
//        TELEGRAM_WEBHOOK_SECRET  — придумайте любую случайную строку
//        ANTHROPIC_API_KEY        — необязательно. Если задан, Claude Haiku
//                                    (модель — ANTHROPIC_MODEL, по умолчанию
//                                    "claude-haiku-5-5") идёт ПЕРВЫМ в цепочке;
//                                    при любой ошибке работают остальные
//                                    провайдеры и regex-парсер.
//        GEMINI_API_KEY           — необязательно, но рекомендуется. Если
//                                    задан, разбор поста идёт через Google
//                                    Gemini (умнее и гибче под любой формат
//                                    текста, при этом бесплатный). Ключ
//                                    берётся на https://aistudio.google.com/apikey
//                                    без карты. Если не задан или запрос не
//                                    удался — автоматически используется
//                                    старый regex-парсер, работа не
//                                    остановится.
//        GEMINI_MODEL             — необязательно, по умолчанию
//                                    "gemini-3.6-flash".
//        GROQ_API_KEY             — необязательно, запасной вариант №1
//                                    (если Gemini не настроен/не ответил).
//                                    Ключ на https://console.groq.com/keys
//        OPENROUTER_API_KEY       — необязательно, запасной вариант №2.
//                                    Ключ на https://openrouter.ai/keys
//        MISTRAL_API_KEY          — необязательно, запасной вариант №3.
//                                    Ключ на https://console.mistral.ai/api-keys
//        SAMBANOVA_API_KEY        — необязательно, запасной вариант №4.
//                                    Ключ на https://cloud.sambanova.ai/apis
//        CLOUDFLARE_ACCOUNT_ID    — необязательно, запасной вариант №5
//                                    (последний в цепочке), вместе с
//                                    CLOUDFLARE_API_TOKEN. Account ID и
//                                    токен — в Cloudflare Dashboard →
//                                    Workers AI → Use REST API.
//        CLOUDFLARE_API_TOKEN     — см. CLOUDFLARE_ACCOUNT_ID выше.
//   2. Выполните sql/add_draft_flag.sql и sql/add_webhook_support.sql
//      в Supabase (один раз).
//   3. Скажите Telegram, куда слать посты (тоже один раз, с вашего
//      компьютера, curl или в браузере):
//
//      https://api.telegram.org/bot<PARSER_BOT_TOKEN>/setWebhook?url=https://ВАШ-ДОМЕН/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>&allowed_updates=["channel_post","edited_channel_post"]
//
//      (замените <PARSER_BOT_TOKEN>, ВАШ-ДОМЕН и <TELEGRAM_WEBHOOK_SECRET>
//       на реальные значения; можно просто открыть эту ссылку в браузере)
//
//   После этого никакой терминал не нужен — Telegram сам стучится в
//   /api/telegram-webhook при каждом новом посте, и это работает всегда,
//   пока задеплоен сайт.

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

// Разбор поста (регулярки + ИИ + проверка + перевод) вынесен в
// api/listingParser.js — единый модуль для webhook, finalize-albums и
// server/bot.js. Здесь раньше жила отдельная, устаревшая копия.



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


// Telegram сам сжимает любое фото, отправленное как обычное "Photo" —
// это ограничение самого Telegram, а не бота. Если фото отправлено как
// файл ("Отправить как файл", без сжатия) — оно приходит как
// msg.document с mime_type вида image/*, без потери качества.
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


// Telegram Bot API не даёт боту скачать файл больше 20 МБ (жёсткое
// ограничение самого Telegram, не наше) — если видео тяжелее, просто
// пропускаем его (возвращаем null), не ломая создание объекта.
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


// Загрузка ОДНОГО фото (одиночный пост, редактирование поста). Для
// альбомов webhook фото больше не скачивает — только регистрирует file_id
// (см. handleAlbumMessage), а скачивает и грузит их api/finalize-albums.js
// пулом из 4 воркеров. Возвращает URL или "" при ошибке — как и раньше.
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


// Ответ «ПРОДАНО» на пост: объявление убирается с сайта и замораживается.
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

    // Правка самого сообщения «ПРОДАНО» — это не объявление, ничего не делаем.
    if (msg.reply_to_message && isSoldKeyword(text)) return;

    // Проданный объект заморожен: правки поста на сайт больше не попадают.
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


// Ждёт, пока список фото альбома в bot_pending_albums перестанет расти
// (два замера подряд с одинаковым количеством), вместо того чтобы ждать
// фиксированное время — большие альбомы (7-8 фото) с реальной сетевой
// задержкой на скачивание/загрузку каждого фото могут не укладываться в
// произвольно выбранную паузу. Потолок в 9 секунд — на случай, если
// какое-то фото так и не долетит, чтобы не ждать вечно.
async function handleAlbumMessage(msg) {

    const groupId = String(msg.media_group_id);
    const text = msg.caption || msg.text || "";
    const ownFileId = getBestImageFileId(msg);

    // проверяем, не обработана ли уже эта группа (чтобы не создать вторую карточку)
    const { data: existing } = await supabase
        .from("bot_pending_albums")
        .select("processed")
        .eq("media_group_id", groupId)
        .maybeSingle();

    if (existing?.processed) {
        return;
    }

    if (ownFileId) {

        // Фото здесь НЕ скачиваем и НЕ грузим в Storage. Раньше каждое фото
        // альбома (до 10 штук) обрабатывалось в отдельном параллельном вызове
        // функции без какого-либо лимита: десяток одновременных
        // getFile+download+upload упирались в таймаут serverless-функции,
        // Telegram при таймауте присылал апдейт повторно, а
        // array_append в БД не идемпотентен — фото терялись или
        // дублировались. Теперь вебхук только регистрирует file_id
        // (быстро: один атомарный и идемпотентный RPC, без сети наружу), а
        // скачивание и загрузку делает api/finalize-albums.js пулом из 4
        // воркеров и пишет итоговый массив images одним INSERT.
        const { error: rpcError } = await supabase.rpc(
            "append_album_photo",
            {
                p_media_group_id: groupId,
                p_file_id: ownFileId,
                p_message_id: msg.message_id
            }
        );

        if (rpcError) {
            // не маскируем: код 42P10 здесь означает, что не выполнена
            // миграция sql/fix_album_pipeline.sql
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
                // upsert, а не update: если строки группы ещё нет (видео
                // прилетело раньше всех фото), update молча затронул бы 0
                // строк и видео терялось
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
        // текста в этом сообщении нет — фото (если было) уже сохранено
        // функцией выше, просто ждём сообщение с текстом
        return;
    }

    // Раньше именно этот запрос дальше сам ждал, пока долетят остальные
    // фото альбома, и сам же создавал объект — для больших альбомов
    // (7-8 фото) это оказалось ненадёжно. Теперь просто сохраняем текст
    // и данные о сообщении — объект создаст отдельная задача по
    // расписанию (api/finalize-albums.js, дёргается Vercel Cron), когда
    // увидит, что в группу какое-то время не добавлялись новые фото.
    // upsert, а не update: сообщение с подписью может быть обработано
    // РАНЬШЕ, чем зарегистрировано любое фото группы (параллельные вызовы
    // функции не упорядочены). Тогда update затронул бы 0 строк, подпись
    // терялась навсегда, и альбом никогда не публиковался. Строка группы
    // создаётся/дополняется атомарно; photo_file_ids upsert не трогает.
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

            // Если подпись у альбома добавили/поменяли уже ПОСЛЕ отправки
            // фото (через "редактировать" в Telegram) — это прилетает как
            // edited_channel_post, а не обычным сообщением. Если для этой
            // группы ещё нет обработанной карточки — сохраняем подпись
            // туда же, куда обычно (bot_pending_albums), чтобы
            // finalize-albums её подхватил. Если карточка уже есть —
            // работает как обычное редактирование (см. processEditedPost).
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

        // Ответ словом ПРОДАНО на пост с объявлением — не новое объявление.
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
        // всё равно отвечаем 200, чтобы Telegram не долбил повторно
        // одним и тем же апдейтом до бесконечности
        return res.status(200).json({ ok: true });
    }
}