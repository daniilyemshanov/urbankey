-- Граничные случаи для handlers.mjs и client.test.mjs. Выполнять ПОСЛЕ bot-new-listing.sql.
--   карточка без страницы (5)  -> остаётся в каталоге, но НЕ в sitemap, /property/5 = 404
--   коммерция без commercial_pages (3) -> упрощённая страница (200), но НЕ в sitemap
--   villa без карточки (card_id 99)    -> НЕ в sitemap
insert into cardss(title_ru) values ('no-detail');
insert into commercials(title_ru) values ('c-nopage');
insert into villas(card_id,slug,title_ru,is_draft) values (99,'orphan-99','orphan',false);
