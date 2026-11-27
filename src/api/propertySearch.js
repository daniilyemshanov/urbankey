import { supabase } from "../supabase";

const PAGE_SIZE = 24;

export async function searchPublicListings({ filters, sort, page, currency, rate, districtAliases = [] }) {
    const { data, error } = await supabase.rpc("search_public_listings", {
        p_filters: filters,
        p_sort: sort,
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_currency: currency,
        p_rate: Number.isFinite(rate) ? rate : null,
        p_district_aliases: districtAliases
    });

    if (error) throw error;
    return {
        items: Array.isArray(data?.items) ? data.items : [],
        total: Number(data?.total) || 0,
        page: Number(data?.page) || page,
        pageSize: Number(data?.pageSize) || PAGE_SIZE
    };
}

export { PAGE_SIZE as PROPERTY_SEARCH_PAGE_SIZE };
