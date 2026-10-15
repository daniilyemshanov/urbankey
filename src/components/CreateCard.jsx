import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useContext, useState } from "react";
import { MyContext } from "../Context";
import {
  AdminPage,
  AdminDenied,
  Section,
  Fields,
  Field,
  TriFields,
  DealSwitch,
  ak as s
} from "./admin/AdminKit";

const CreateCard = () => {
  const { t } = useTranslation();

  const { profile, createCard, uploadImage } = useContext(MyContext);

  const isAdmin = profile?.role === "admin";

  const { register, handleSubmit, reset } = useForm();

  const [deal, setDeal] = useState("sale");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (data) => {
    if (!data.image || !data.image.length) {
      toast.error(t("imageFileMissing"));
      return;
    }

    setSaving(true);

    try {
      const imageUrl = await uploadImage(data.image[0]);

      await createCard({
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
        image: imageUrl,
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
        is_rent: deal === "rent"
      });

      reset();
      setDeal("sale");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return <AdminDenied />;

  return (
    <AdminPage
      narrow
      title="Новая карточка квартиры"
      subtitle="Карточка для каталога. Подробную страницу можно создать после."
      back="/admin/changeCard"
      backLabel="К списку квартир"
    >
      <form className={s.form} onSubmit={handleSubmit(onSubmit)}>
        <Section title="Тип сделки и цена">
          <Fields cols={2}>
            <Field label="Тип сделки">
              <div>
                <DealSwitch value={deal} onChange={setDeal} />
              </div>
            </Field>

            <Field label="Цена">
              <input
                className={s.input}
                type="text"
                placeholder="$120,000"
                {...register("price")}
              />
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
        </Section>

        <Section title="Фото">
          <Fields cols={1}>
            <Field label="Фото объекта (файл)">
              <input
                className={s.input}
                type="file"
                accept="image/*"
                {...register("image", { required: true })}
              />
            </Field>
          </Fields>
        </Section>

        <div className={s.saveBar}>
          <button
            className={`${s.btn} ${s.btnPrimary}`}
            type="submit"
            disabled={saving}
          >
            {saving ? "Создаю…" : "Создать карточку"}
          </button>
        </div>
      </form>
    </AdminPage>
  );
};

export default CreateCard;
