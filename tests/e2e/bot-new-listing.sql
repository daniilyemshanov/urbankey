DO $$
DECLARE cid integer; kid integer;
BEGIN
    INSERT INTO cardss(title_ru,title_en,title_uz,description_ru,price,image,owner_phone,tg_chat_id,tg_message_id)
    VALUES ('TG new villa','TG new villa','TG new villa','desc','250000','https://x/y.webp','+998909',1,100)
    RETURNING id INTO cid;
    UPDATE cardss SET link = '/property/' || cid WHERE id = cid;
    INSERT INTO villas(card_id,slug,title_ru,about_ru,price,images,amenities,is_rent,is_draft)
    VALUES (cid,'tg-new-villa-'||cid,'TG new villa','','250000',ARRAY['https://x/y.webp'],'[]',false,true);

    INSERT INTO commercials(title_ru,title_en,title_uz,price,image,owner_phone,tg_chat_id,tg_message_id)
    VALUES ('TG new office','TG new office','TG new office','900000','https://x/z.webp','+998908',1,101)
    RETURNING id INTO kid;
    UPDATE commercials SET link = '/commercial/' || kid WHERE id = kid;
    INSERT INTO commercial_pages(commercial_id,slug,title_ru,about_ru,price,images,is_rent,is_draft)
    VALUES (kid,'tg-new-office-'||kid,'TG new office','','900000',ARRAY['https://x/z.webp'],false,true);
END $$;
