/**
 * Manager assignment module for UrbanKey leads.
 * Supports:
 * 1. Repeat inquiry continuity (same manager as previous lead if found)
 * 2. Direction-based assignment (BINOTEL_DIRECTION_MANAGERS_JSON)
 * 3. Round-robin via atomic Supabase RPC (`next_lead_manager_index`)
 * 4. Default manager fallback (BINOTEL_DEFAULT_MANAGER)
 *
 * Never invents manager IDs — employee numbers/IDs must come from environment config.
 */

export const KNOWN_MANAGERS = [
    { name: "Емшанов Владислав Васильевич", employeeNumber: null },
    { name: "Емшанова Ирина", employeeNumber: null },
    { name: "Игорь Ким", employeeNumber: null },
    { name: "Кадыров Тимур", employeeNumber: null },
    { name: "Кенжаев Мамуржон", employeeNumber: null },
    { name: "Маговский Александр", employeeNumber: null },
    { name: "Низамова Сарвиноз", employeeNumber: null },
    { name: "Суннат Камилов", employeeNumber: null },
];

const parseJsonEnv = (raw, fallback) => {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
};

export const getConfiguredManagers = () => {
    const parsed = parseJsonEnv(process.env.BINOTEL_MANAGERS_JSON, null);
    if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
            .filter((m) => m && typeof m.name === "string")
            .map((m) => ({
                name: m.name.trim(),
                employeeNumber: m.employeeNumber ? String(m.employeeNumber).trim() : null,
                binotelUserId: m.binotelUserId ? String(m.binotelUserId).trim() : null,
            }));
    }
    return KNOWN_MANAGERS;
};

const findPreviousManager = async (supabaseAdmin, phoneE164, email) => {
    if (!supabaseAdmin) return null;

    try {
        if (phoneE164) {
            const { data } = await supabaseAdmin
                .from("leads")
                .select("assigned_manager_name, assigned_manager_id")
                .eq("phone", phoneE164)
                .not("assigned_manager_name", "is", null)
                .order("created_at", { ascending: false })
                .limit(1);

            if (data && data.length > 0 && data[0].assigned_manager_name) {
                return {
                    name: data[0].assigned_manager_name,
                    employeeNumber: data[0].assigned_manager_id || null,
                    reason: "repeat_phone",
                };
            }
        }

        if (email) {
            const { data } = await supabaseAdmin
                .from("leads")
                .select("assigned_manager_name, assigned_manager_id")
                .eq("raw_data->>email", email)
                .not("assigned_manager_name", "is", null)
                .order("created_at", { ascending: false })
                .limit(1);

            if (data && data.length > 0 && data[0].assigned_manager_name) {
                return {
                    name: data[0].assigned_manager_name,
                    employeeNumber: data[0].assigned_manager_id || null,
                    reason: "repeat_email",
                };
            }
        }
    } catch {
        // Non-critical if columns are not yet migrated
    }

    return null;
};

const getNextRoundRobinIndex = async (supabaseAdmin, poolSize) => {
    if (poolSize <= 0) return 0;

    if (supabaseAdmin) {
        try {
            const { data, error } = await supabaseAdmin.rpc("next_lead_manager_index", {
                pool_size: poolSize,
            });
            if (!error && typeof data === "number") {
                return data % poolSize;
            }
        } catch {
            // Fallback below if RPC is not yet created in Supabase
        }
    }

    return Math.floor(Date.now() / 1000) % poolSize;
};

export const assignManager = async ({ supabaseAdmin, directionKey, phoneE164, email }) => {
    // 1. Repeat inquiry continuity
    const previous = await findPreviousManager(supabaseAdmin, phoneE164, email);
    if (previous) {
        return previous;
    }

    const managers = getConfiguredManagers();

    // 2. Direction-specific manager mapping
    const directionMap = parseJsonEnv(process.env.BINOTEL_DIRECTION_MANAGERS_JSON, {});
    const mappedNameOrId = directionMap[directionKey];
    if (mappedNameOrId) {
        const match = managers.find(
            (m) =>
                m.name === mappedNameOrId ||
                (m.employeeNumber && m.employeeNumber === String(mappedNameOrId))
        );
        if (match) {
            return { ...match, reason: "direction_rule" };
        }
        return {
            name: String(mappedNameOrId),
            employeeNumber: null,
            reason: "direction_rule",
        };
    }

    // 3. Round-robin mode (only among active managers with configured IDs if BINOTEL_ROUND_ROBIN=1)
    if (process.env.BINOTEL_ROUND_ROBIN === "1") {
        const activePool = managers.filter((m) => m.employeeNumber || m.binotelUserId);
        const pool = activePool.length > 0 ? activePool : managers;
        const idx = await getNextRoundRobinIndex(supabaseAdmin, pool.length);
        const chosen = pool[idx];
        if (chosen) {
            return { ...chosen, reason: "round_robin" };
        }
    }

    // 4. Default manager if configured
    const defaultManager = process.env.BINOTEL_DEFAULT_MANAGER;
    if (defaultManager) {
        const match = managers.find(
            (m) =>
                m.name === defaultManager ||
                (m.employeeNumber && m.employeeNumber === String(defaultManager))
        );
        if (match) {
            return { ...match, reason: "default" };
        }
        return {
            name: defaultManager,
            employeeNumber: null,
            reason: "default",
        };
    }

    return {
        name: null,
        employeeNumber: null,
        reason: "unassigned",
    };
};
