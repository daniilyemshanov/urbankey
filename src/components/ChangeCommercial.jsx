import { useContext, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { MyContext } from "../Context";
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

// Поля с тремя языками: ключ формы → ключ объекта из контекста
const TRI = ["title", "description", "district", "address", "class", "landmark"];

const ChangeCommercial = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    profile,
    commercials,
    updateCommercial,
    getCommercials,
    setListingSold
  } = useContext(MyContext);

  const isAdmin = profile?.role === "admin";

  const { register, handleSubmit, setValue, watch } = useForm();

  const deal = watch("dealType");
  const image = watch("image");
  const price = watch("price");

  useEffect(() => {
    getCommercials();
  }, []);

  useEffect(() => {
    const item = commercials.find((x) => x.id == id);

    if (!item) return;

    TRI.forEach((key) => {

      setValue(`${key}Ru`, item[key]?.ru || "");
      setValue(`${key}En`, item[key]?.en || "");
      setValue(`${key}Uz`, item[key]?.uz || "");
    });

    setValue("floor", item.floor || "");
    setValue("ceiling", item.ceiling_height || "");
    setValue("area", item.area || "");
    setValue("price", item.price || "");
    setValue("image", item.image || "");
    setValue("dealType", item.is_rent ? "rent" : "sale");
  }, [commercials, id]);

  const onSubmit = (data) => {
    const pick = (key) => ({
      ru: data[`${key}Ru`],
      en: data[`${key}En`],
      uz: data[`${key}Uz`]
    });

    updateCommercial(
      {
        title: pick("title"),
        description: pick("description"),
        district: pick("district"),
        address: pick("address"),
        class: pick("class"),
        landmark: pick("landmark"),
        floor: data.floor,
        ceiling: data.ceiling,
        area: data.area,
        price: data.price,
        image: data.image,
        is_rent: data.dealType === "rent"
      },
      id
    );
  };

  const markSold = async () => {
    if (!window.confirm("Отметить объект как проданный? Он пропадёт с сайта.")) {
      return;
    }

    const ok = await setListingSold("commercial", id, true);

    if (ok) navigate("/admin/commercials");
  };

  if (!isAdmin) return <AdminDenied />;

  return (
    <AdminPage
      narrow
      title="Изменить коммерцию"
      subtitle="Данные, как они видны в каталоге"
      back="/admin/commercials"
      backLabel="К списку коммерции"
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

        <Section title="Расположение">
          <TriFields label="Район" name="district" register={register} />
          <div style={{ height: 14 }} />
          <TriFields label="Адрес" name="address" register={register} />
          <div style={{ height: 14 }} />
          <TriFields label="Ориентир" name="landmark" register={register} />
        </Section>

        <Section title="Характеристики">
          <TriFields label="Класс" name="class" register={register} />
          <div style={{ height: 14 }} />

          <Fields cols={3}>
            <Field label="Этаж">
              <input className={s.input} type="text" {...register("floor")} />
            </Field>

            <Field label="Высота потолков">
              <input className={s.input} type="text" {...register("ceiling")} />
            </Field>

            <Field label="Площадь">
              <input className={s.input} type="text" {...register("area")} />
            </Field>
          </Fields>
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
              «Продано» скроет объект из каталога и по прямой ссылке; вернуть
              можно в любой момент из списка коммерции.
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

export default ChangeCommercial;
