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
        return text.replace(/yotoq\s*-?\s*xona(?:lar|li)?/gi, "xona");
    }

    if (language === "en") {
        return text.replace(/bed\s*-?\s*room(s?)/gi, (m, s) => {
            const room = m[0] === "B" ? "Room" : "room";
            return s ? `${room}s` : room;
        });
    }

    return text.replace(/спальн(?:ей|я|и|ю|е|ь)|спален/gi, ruRoomWord);
}

export function itemRoomsLabel(item, language = "ru") {
    const own = item?.bedrooms?.[language];
    if (own) return roomsLabel(own, language);
    return roomsLabel(item?.bedrooms?.ru, "ru");
}
