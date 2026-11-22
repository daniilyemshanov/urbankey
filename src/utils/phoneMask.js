/**
 * Utility for formatting and validating Uzbekistan phone numbers (+998 XX XXX XX XX)
 */

export const extractUzLocalDigits = (value = "") => {
    if (!value) return "";
    let digits = String(value).replace(/\D/g, "");
    
    // If starts with 998, strip it to work with local 9 digits
    if (digits.startsWith("998")) {
        digits = digits.slice(3);
    } else if (digits.length === 10 && digits.startsWith("8")) {
        // e.g. 8901234567
        digits = digits.slice(1);
    }
    
    // Uzbekistan local numbers are 9 digits
    return digits.slice(0, 9);
};

export const formatUzPhone = (value = "") => {
    const localDigits = extractUzLocalDigits(value);
    
    if (localDigits.length === 0) {
        return "";
    }

    let formatted = "+998";
    
    if (localDigits.length > 0) {
        formatted += ` (${localDigits.slice(0, 2)}`;
    }
    if (localDigits.length >= 2) {
        formatted += ") ";
    }
    if (localDigits.length > 2) {
        formatted += localDigits.slice(2, 5);
    }
    if (localDigits.length >= 5) {
        formatted += "-";
    }
    if (localDigits.length > 5) {
        formatted += localDigits.slice(5, 7);
    }
    if (localDigits.length >= 7) {
        formatted += "-";
    }
    if (localDigits.length > 7) {
        formatted += localDigits.slice(7, 9);
    }

    return formatted;
};

export const isUzPhoneValid = (value = "") => {
    const localDigits = extractUzLocalDigits(value);
    return localDigits.length === 9;
};

export const toE164UzPhone = (value = "") => {
    const localDigits = extractUzLocalDigits(value);
    if (localDigits.length === 0) return "";
    return `+998${localDigits}`;
};
