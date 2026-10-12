// Подпись количества комнат для карточек жилья.
// В базе (и у бота) значение хранится как "3 спальни" / "3 bedrooms" /
// "3 yotoqxona" — в карточках слово "спальни" не показываем, а пишем
// "комнаты". Данные в БД не меняются: нормализуется только вывод.

const RU_ROOM = { "я": "комната", "и": "комнаты", "ю": "комнату", "е": "комнате", "ь": "комнат", "ей": "комнат", "ен": "комнат" };

function ruRoomWord(match) {
    const upper = match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase();
    const ending = match.toLowerCase().replace(/^спальн/, "").replace(/^спал/, "");
    const word = RU_ROOM[ending] || "комнат";
    return upper ? word[0].toUpperCase() + word.slice(1) : word;
}

export function roomsLabel(raw, language = "ru") {
    const text = String(raw ?? "").trim();
    if (!text) return "";

    if (language === "uz") {
        // "4 ta yotoqxona" / "3 ta yotoq xona" / "2 yotoqxonali" -> "4 ta xona"
        return text.replace(/yotoq\s*-?\s*xona(?:lar|li)?/gi, "xona");
    }

    if (language === "en") {
        // "1 bedroom" -> "1 room", "3 Bedrooms" -> "3 Rooms"
        return text.replace(/bed\s*-?\s*room(s?)/gi, (m, s) => {
            const room = m[0] === "B" ? "Room" : "room";
            return s ? `${room}s` : room;
        });
    }

    // "1 спальня" -> "1 комната", "2 спальни" -> "2 комнаты", "5 спален" -> "5 комнат"
    return text.replace(/спальн(?:ей|я|и|ю|е|ь)|спален/gi, ruRoomWord);
}

// Подпись комнат объекта: значение на текущем языке, а если его нет — русское.
export function itemRoomsLabel(item, language = "ru") {
    const own = item?.bedrooms?.[language];
    if (own) return roomsLabel(own, language);
    return roomsLabel(item?.bedrooms?.ru, "ru");
}
