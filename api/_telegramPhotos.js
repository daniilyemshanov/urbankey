export const PHOTO_CONCURRENCY = 4;

const TELEGRAM_API_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 400;


const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


export async function mapWithConcurrency(items, limit, worker) {

    const results = new Array(items.length);
    let next = 0;

    const runner = async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) return;
            try {
                results[i] = await worker(items[i], i);
            } catch (e) {
                results[i] = { ok: false, stage: "worker", error: e?.message || String(e) };
            }
        }
    };

    const size = Math.max(1, Math.min(limit, items.length));
    await Promise.all(Array.from({ length: size }, runner));

    return results;
}


class PhotoStepError extends Error {
    constructor(stage, message, retryable) {
        super(message);
        this.stage = stage;
        this.retryable = retryable;
    }
}

const isTransientStatus = (status) => status === 429 || status >= 500;

function stepTimeout(defaultMs, deadline) {
    if (!deadline) return defaultMs;
    return Math.max(1000, Math.min(defaultMs, deadline - Date.now()));
}

function withTimeout(promise, ms, stage) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(
            () => reject(new PhotoStepError(stage, `${stage} timeout after ${ms}ms`, true)),
            ms
        );
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}


async function attemptPhoto({ supabase, botToken, fileId, deadline }) {

    let filePath;

    try {
        const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file_id: fileId }),
            signal: AbortSignal.timeout(stepTimeout(TELEGRAM_API_TIMEOUT_MS, deadline))
        });

        const data = await res.json().catch(() => null);

        if (!data?.ok || !data.result?.file_path) {
            const code = data?.error_code || res.status;
            throw new PhotoStepError(
                "getFile",
                `getFile failed: ${code} ${data?.description || ""}`.trim(),
                isTransientStatus(code)
            );
        }

        filePath = data.result.file_path;

    } catch (e) {
        if (e instanceof PhotoStepError) throw e;
        throw new PhotoStepError("getFile", `getFile error: ${e.message}`, true);
    }

    let buffer;

    try {
        const response = await fetch(
            `https://api.telegram.org/file/bot${botToken}/${filePath}`,
            { signal: AbortSignal.timeout(stepTimeout(DOWNLOAD_TIMEOUT_MS, deadline)) }
        );

        if (!response.ok) {
            throw new PhotoStepError(
                "download",
                `download failed: HTTP ${response.status}`,
                isTransientStatus(response.status)
            );
        }

        buffer = Buffer.from(await response.arrayBuffer());

    } catch (e) {
        if (e instanceof PhotoStepError) throw e;
        throw new PhotoStepError("download", `download error: ${e.message}`, true);
    }

    const looksLikeImage =
        buffer.length > 100 &&
        ((buffer[0] === 0xff && buffer[1] === 0xd8) ||
            (buffer[0] === 0x89 && buffer[1] === 0x50));

    if (!looksLikeImage) {
        throw new PhotoStepError(
            "validate",
            `downloaded file does not look like an image (size ${buffer.length})`,
            false
        );
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

    try {
        const { error } = await withTimeout(
            supabase.storage.from("images").upload(fileName, buffer, { contentType: "image/jpeg", cacheControl: "31536000" }),
            stepTimeout(UPLOAD_TIMEOUT_MS, deadline),
            "upload"
        );

        if (error) {
            const status = Number(error.statusCode || error.status) || 0;
            throw new PhotoStepError(
                "upload",
                `upload failed: ${error.message || JSON.stringify(error)}`,
                isTransientStatus(status) || /fetch failed|network|timeout/i.test(error.message || "")
            );
        }

    } catch (e) {
        if (e instanceof PhotoStepError) throw e;
        throw new PhotoStepError("upload", `upload error: ${e.message}`, true);
    }

    const { data } = supabase.storage.from("images").getPublicUrl(fileName);

    if (!data?.publicUrl) {
        throw new PhotoStepError("upload", "getPublicUrl returned no URL", false);
    }

    return data.publicUrl;
}


export async function processPhoto({ supabase, botToken, fileId, label = "photo", deadline = 0 }) {

    let lastError;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {

        if (deadline && Date.now() >= deadline) {
            lastError = new PhotoStepError("deadline", "time budget exhausted before the photo was processed", false);
            break;
        }

        try {

            const url = await attemptPhoto({ supabase, botToken, fileId, deadline });
            console.log(`PHOTO OK [${label}] file_id=${fileId} attempt=${attempt}`);
            return { ok: true, url };

        } catch (e) {

            lastError = e;
            const stage = e.stage || "unknown";

            console.log(
                `PHOTO ${stage.toUpperCase()} ERROR [${label}] file_id=${fileId} ` +
                `attempt=${attempt}/${MAX_ATTEMPTS} retryable=${Boolean(e.retryable)}: ${e.message}`
            );

            if (!e.retryable || attempt === MAX_ATTEMPTS) break;

            await sleep(RETRY_DELAY_MS * attempt);
        }
    }

    return {
        ok: false,
        stage: lastError?.stage || "unknown",
        error: lastError?.message || "unknown error"
    };
}


export async function processAlbumPhotos({
    supabase,
    botToken,
    entries,
    groupId = "",
    concurrency = PHOTO_CONCURRENCY,
    deadline = 0
}) {

    const seenMessages = new Set();
    const seenFiles = new Set();

    const unique = (Array.isArray(entries) ? entries : [])
        .filter((e) => e && e.file_id)
        .sort((a, b) => Number(a.message_id) - Number(b.message_id))
        .filter((e) => {
            const mKey = String(e.message_id);
            if (seenMessages.has(mKey) || seenFiles.has(e.file_id)) return false;
            seenMessages.add(mKey);
            seenFiles.add(e.file_id);
            return true;
        });

    const total = unique.length;

    const results = await mapWithConcurrency(
        unique,
        Math.min(concurrency, PHOTO_CONCURRENCY),
        (entry, i) => processPhoto({
            supabase,
            botToken,
            fileId: entry.file_id,
            label: `grp=${groupId} photo ${i + 1}/${total}`,
            deadline
        })
    );

    const urls = [];
    const failures = [];

    results.forEach((r, i) => {
        if (r?.ok && r.url) {
            if (!urls.includes(r.url)) urls.push(r.url);
        } else {
            failures.push({
                index: i + 1,
                fileId: unique[i].file_id,
                stage: r?.stage || "unknown",
                error: r?.error || "unknown error"
            });
        }
    });

    console.log(
        `PHOTOS SUMMARY grp=${groupId}: uploaded ${urls.length}/${total}` +
        (failures.length
            ? `, failed ${failures.length}: ` +
              failures.map((f) => `#${f.index}(${f.stage}, file_id=${f.fileId})`).join(", ")
            : "")
    );

    return { urls, total, okCount: urls.length, failures };
}
