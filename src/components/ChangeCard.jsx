import { useForm } from "react-hook-form";
import { useParams, useNavigate } from "react-router-dom";
import { useContext, useEffect } from "react";
import { MyContext } from "../Context";
import ListingsManager from "./admin/ListingsManager";
import {
  AdminPage,
  AdminDenied,
  Section,
  Fields,
  Field,
  TriFields,
  DealSwitch,
  PriceHint,
  Thumb,
  ak as s
} from "./admin/AdminKit";

const ChangeCard = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    profile,
    cardId,
    getCardId,
    changeCard,
    setListingSold
  } = useContext(MyContext);

  const isAdmin = profile?.role === "admin";

  const { register, handleSubmit, setValue, watch } = useForm();

  const deal = watch("dealType");
  const image = watch("image");
  const price = watch("price");

  useEffect(() => {
    if (id) {
      getCardId(id);
    }
  }, [id]);

  useEffect(() => {
    if (cardId && String(cardId.id) === String(id)) {
      setValue("titleRu", cardId.title?.ru || "");
      setValue("titleEn", cardId.title?.en || "");
      setValue("titleUz", cardId.title?.uz || "");

      setValue("descriptionRu", cardId.description?.ru || "");
      setValue("descriptionEn", cardId.description?.en || "");
      setValue("descriptionUz", cardId.description?.uz || "");

      setValue("image", cardId.image || "");

      setValue("bedroomsRu", cardId.bedrooms?.ru || "");
      setValue("bedroomsEn", cardId.bedrooms?.en || "");
      setValue("bedroomsUz", cardId.bedrooms?.uz || "");

      setValue("typeRu", cardId.type?.ru || "");
      setValue("typeEn", cardId.type?.en || "");
      setValue("typeUz", cardId.type?.uz || "");

      setValue("price", cardId.price || "");
      setValue("floor", cardId.floor ?? "");
      setValue("total_floors", cardId.total_floors ?? "");

      setValue("dealType", cardId.is_rent ? "rent" : "sale");
    }
  }, [cardId, id]);

  const onSubmit = (data) => {
    const updatedCard = {
      title: {
        ru: data.titleRu,
        en: data.titleEn,
        uz: data.titleUz
      },
      description: {
        ru: data.descriptionRu,
        en: data.descriptionEn,
        uz: data.descriptionUz
      },
      image: data.image,
      bedrooms: {
        ru: data.bedroomsRu,
        en: data.bedroomsEn,
        uz: data.bedroomsUz
      },
      type: {
        ru: data.typeRu,
        en: data.typeEn,
        uz: data.typeUz
      },
      price: data.price,
      is_rent: data.dealType === "rent"
    };

    // Этаж — только если такие колонки есть в базе
    if (cardId?.hasFloorColumns) {
      updatedCard.floor = data.floor;
      updatedCard.total_floors = data.total_floors;
    }

    changeCard(updatedCard, id);
  };

  const markSold = async () => {
    if (!window.confirm("Отметить объект как проданный? Он пропадёт с сайта.")) {
      return;
    }

    const ok = await setListingSold("card", id, true);

    if (ok) navigate("/admin/changeCard");
  };

  if (!isAdmin) return <AdminDenied />;

  if (!id) return <ListingsManager kind="card" />;

  return (
    <AdminPage
      narrow
      title="Изменить карточку"
      subtitle="Данные, как они видны в каталоге"
      back="/admin/changeCard"
      backLabel="К списку квартир"
    >
      <form className={s.form} onSubmit={handleSubmit(onSubmit)}>
        <Section title="Тип сделки и цена">
          <input type="hidden" {...register("dealType")} />

          <Fields cols={2}>
            <Field label="Тип сделки">
              <div>
                <DealSwitch
                  value={deal}
                  onChange={(v) =>
                    setValue("dealType", v, { shouldDirty: true })
                  }
                />
              </div>
            </Field>

            <Field label="Цена">
              <input
                className={s.input}
                type="text"
                placeholder="120 000$ или 1 800$ за м²"
                {...register("price")}
              />
              <PriceHint value={price} />
            </Field>
          </Fields>
        </Section>

        <Section title="Название">
          <TriFields label="Название" name="title" register={register} />
        </Section>

        <Section title="Описание">
          <TriFields
            label="Описание"
            name="description"
            register={register}
            textarea
          />
        </Section>

        <Section title="Параметры">
          <TriFields label="Комнаты" name="bedrooms" register={register} />
          <div style={{ height: 14 }} />
          <TriFields label="Тип" name="type" register={register} />

          {cardId?.hasFloorColumns && (
            <>
              <div style={{ height: 14 }} />

              <Fields cols={2}>
                <Field label="Этаж (число)">
                  <input
                    className={s.input}
                    type="number"
                    min="1"
                    {...register("floor")}
                  />
                </Field>

                <Field label="Этажей в доме (число)">
                  <input
                    className={s.input}
                    type="number"
                    min="1"
                    {...register("total_floors")}
                  />
                </Field>
              </Fields>
            </>
          )}
        </Section>

        <Section title="Фото">
          <Fields cols={1}>
            <Field label="Фото (ссылка)">
              <input className={s.input} type="text" {...register("image")} />
            </Field>
          </Fields>

          {image ? (
            <div style={{ marginTop: 16 }}>
              <Thumb src={image} />
            </div>
          ) : null}
        </Section>

        <Section title="Статус объекта">
          <div className={s.statusBox}>
            <p className={s.statusText}>
              Сейчас объект показывается на сайте. «Продано» скроет его из
              каталога и по прямой ссылке; вернуть можно в любой момент из
              списка квартир.
            </p>

            <button
              type="button"
              className={`${s.btn} ${s.btnDanger}`}
              onClick={markSold}
            >
              Отметить проданным
            </button>
          </div>
        </Section>

        <div className={s.saveBar}>
          <button className={`${s.btn} ${s.btnPrimary}`} type="submit">
            Сохранить изменения
          </button>
        </div>
      </form>
    </AdminPage>
  );
};

export default ChangeCard;
