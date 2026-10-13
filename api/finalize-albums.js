// /api/finalize-albums — вторая половина обработки альбомов (несколько
// фото + одна подпись в одном посте Telegram-канала).
//
// ЗАЧЕМ ЭТОТ ФАЙЛ ОТДЕЛЬНО ОТ telegram-webhook.js:
// Раньше сообщение с подписью само ждало (внутри одного вызова функции),
// пока остальные фото альбома долетят и загрузятся, и само же создавало
// объект. Для больших альбомов (7-8 фото) это оказалось ненадёжно — на
// части тестов часть фото терялась. Теперь webhook (telegram-webhook.js)
// только СОХРАНЯЕТ фото и подпись в таблицу bot_pending_albums и сразу
// отвечает Telegram, а эта функция запускается ОТДЕЛЬНО, по расписанию
// (см. ниже), сканирует таблицу и досоздаёт объекты для "созревших"
// альбомов — то есть таких, где подпись уже есть, но фото не добавлялись
// уже некоторое время (значит, все фото альбома точно долетели).
//
// КАК ПОДКЛЮЧИТЬ (один раз, после деплоя):
//   1. Выполните sql/add_album_finalize_cron.sql в Supabase (добавляет
//      нужные колонки в bot_pending_albums).
//   2. В Vercel -> Settings -> Environment Variables добавьте:
//        FINALIZE_SECRET — придумайте любую случайную строку (как и
//                          TELEGRAM_WEBHOOK_SECRET раньше)
//      Остальные переменные (PARSER_BOT_TOKEN, SUPABASE_SERVICE_KEY,
//      VITE_SUPABASE_URL, GEMINI_API_KEY) уже должны быть настроены.
//   3. На Vercel Hobby-плане встроенный Cron не подходит (там минимум —
//      раз в сутки), поэтому дёргать этот эндпоинт нужно внешним
//      бесплатным сервисом-планировщиком, например cron-job.org:
//        - Зарегистрируйтесь на cron-job.org (бесплатно)
//        - Создайте новую задачу (Cron Job)
//        - URL: https://ВАШ-ДОМЕН/api/finalize-albums?secret=<FINALIZE_SECRET>
//        - Периодичность: каждую 1 минуту
//        - Метод: GET (или POST — этот файл принимает оба)
//
//   После этого посты с альбомами будут появляться на сайте с задержкой
//   примерно 1-2 минуты (время на то, чтобы cron-job.org дёрнул эндпоинт
//   + 10 секунд "тишины", которые функция ждёт перед тем как считать
//   альбом готовым) — это плата за надёжность вместо мгновенной, но
//   иногда терявшей часть фото публикации.

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

        // Date.now() может совпасть у нескольких фото одного альбома,
        // загружаемых почти одновременно (параллельные вызовы serverless-
        // функции) — совпавшее имя файла тихо перезаписывает предыдущее в
        // Storage, и вместо нескольких разных фото в галерею попадает
        // одно. Добавляем случайный суффикс для гарантированной уникальности.
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


// photoReport (необязательно, только для альбомов): { total, okCount } —
// если часть фото не загрузилась, это попадёт в ответ в канал.
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


// Ищем альбомы, которые пора финализировать: подпись уже сохранена
// (caption не пустой), группа ещё не обработана, и с последнего
// добавленного фото прошло не меньше 10 секунд — то есть все фото
// альбома точно успели долететь и загрузиться.
const SETTLE_SECONDS = 10;

// Бюджет времени одного запуска (maxDuration функции — 60 с, см.
// vercel.json). Новый альбом берём в работу только пока прошло не больше
// START_NEW_ALBUM_BEFORE_MS; на скачивание/загрузку фото выделяем
// PHOTO_DEADLINE_MS от начала запуска — остаток нужен на разбор текста
// (ИИ/перевод) и запись в БД. Не успевшие альбомы остаются в очереди и
// подхватываются следующим запуском cron (через минуту).
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

        // Бесплатный тир Gemini обычно даёт ~10-15 запросов/мин для
        // Flash-моделей. Обычно посты прилетают по одному, но здесь за
        // раз может добиваться сразу несколько альбомов из очереди —
        // если используется Gemini, даём небольшую паузу между вызовами
        // parseWithAI (через processPost -> getParsedListing), чтобы не
        // упереться в лимит. На остальных провайдеров цепочки (Groq/
        // Groq/OpenRouter/Mistral/SambaNova) / regex-фолбэк пауза не влияет.
        const throttleAiCalls = isGeminiConfigured() && candidates.length > 1;

        for (const row of candidates) {

            if (Date.now() - startedAt > START_NEW_ALBUM_BEFORE_MS) {
                console.log("FINALIZE: time budget reached, remaining albums go to the next run");
                break;
            }

            if (throttleAiCalls && processedCount > 0) {
                await sleep(400);
            }

            // атомарно "забираем" группу — если её уже кто-то забрал
            // (например, два последовательных запуска cron наложились
            // друг на друга), просто пропускаем
            const { data: claimed, error: claimError } = await supabase
                .from("bot_pending_albums")
                .update({ processed: true })
                .eq("media_group_id", row.media_group_id)
                .eq("processed", false)
                .select("images, photo_file_ids")
                .maybeSingle();

            if (claimError) {
                // не маскируем: "column photo_file_ids does not exist" значит,
                // что не выполнена миграция sql/fix_album_pipeline.sql
                console.log("FINALIZE CLAIM ERROR:", row.media_group_id, claimError);
                continue;
            }

            if (!claimed) continue;

            // синтетическое "сообщение" — со всей информацией, которая
            // нужна processPost/replyToChannel (структура как у реального
            // объекта сообщения из Telegram Bot API)
            const syntheticMsg = {
                chat: { id: row.chat_id },
                message_id: row.message_id,
                caption: row.caption
            };

            // 1) Скачиваем и грузим ВСЕ фото альбома — не больше
            //    PHOTO_CONCURRENCY (4) одновременно. Результат собирается
            //    в локальный массив по индексам: ни один параллельный
            //    воркер не пишет в БД и не меняет общий images[].
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
                // сюда попадаем только при неожиданной ошибке самого
                // конвейера (ошибки отдельных фото он обрабатывает
                // внутри). Объект ещё не создан — безопасно вернуть
                // альбом в очередь, чтобы следующий запуск попробовал снова.
                console.log("FINALIZE PHOTOS PIPELINE ERROR:", row.media_group_id, e);
                await supabase
                    .from("bot_pending_albums")
                    .update({ processed: false })
                    .eq("media_group_id", row.media_group_id);
                continue;
            }

            // фото, уже лежащие в images (строки, созданные прежней версией
            // webhook во время выката), сохраняем и добавляем к новым
            const legacyImages = Array.isArray(claimed.images) ? claimed.images.filter(Boolean) : [];
            const allImages = [...new Set([...legacyImages, ...photos.urls])];

            console.log(
                `FINALIZE grp=${row.media_group_id}: images=${allImages.length} ` +
                `(registered=${photos.total}, uploaded=${photos.okCount}, failed=${photos.failures.length}, legacy=${legacyImages.length})`
            );

            // 2) ОДИН INSERT карточки и ОДИН INSERT страницы объекта — со
            //    всем собранным массивом images. Никаких поштучных
            //    UPDATE/UPSERT на каждое фото.
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
