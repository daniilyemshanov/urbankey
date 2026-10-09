import { useTranslation } from "react-i18next";
import styles from "./Partners.module.css";

const partners = [
  {
    id: "murad",
    name: "Murad Buildings",
    image: "/Murad.jpg",
  },
  {
    id: "nrg-bi",
    name: "NRG BI",
    image: "/Nrg.jpg",
  },
  {
    id: "al-bina",
    name: "Al-Bina",
    image: "/Al-Bina.jpg",
  },
  {
    id: "kayan",
    name: "Kayan Development",
    image: "/Kayan.jpg",
  },
  {
    id: "makani",
    name: "Makani",
    image: "/Makani.jpg",
  },
  {
    id: "human2human",
    name: "Human2Human",
    image: "/human.jpg",
  },
];

export default function Partners() {
  const { t } = useTranslation();

  return (
    <section
      className={styles.partners}
      id="partners"
      aria-labelledby="partners-title"
    >
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.eyebrow}>{t("partnersEyebrow")}</span>

          <h2 className={styles.title} id="partners-title">
            {t("partnersTitleStart")} <span>{t("partnersTitleAccent")}</span>
          </h2>

          <p className={styles.description}>{t("partnersDescription")}</p>
        </header>

        <div className={styles.grid}>
          {partners.map((partner, index) => (
            <article className={styles.card} key={partner.id}>
              <div className={styles.imageWrap}>
                <img
                  className={styles.image}
                  src={partner.image}
                  alt={t("partnersImageAlt", { name: partner.name })}
                  width="928"
                  height="1152"
                  loading="lazy"
                  decoding="async"
                />
                <span className={styles.number} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>

              <div className={styles.caption}>
                <div className={styles.captionText}>
                  <h3 className={styles.partnerName}>{partner.name}</h3>
                  <p className={styles.role}>{t("partnersDeveloper")}</p>
                </div>

             
              </div>
            </article>
          ))}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerLine} />
          <p>{t("partnersFooter")}</p>
          <span className={styles.footerLine} />
        </div>
      </div>
    </section>
  );
}