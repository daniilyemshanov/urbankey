// «Политика конфиденциальности» (kind="privacy") и «Условия использования» (kind="terms").
// Тексты — src/legal/legalTexts.js, реквизиты оператора — src/utils/legalInfo.js
// (незаполненные поля не показываются).

import { useParams } from "react-router-dom";
import Footer from "../components/Footer";
import Seo from "../components/Seo";
import NotFound from "./Error";
import { isSupportedLang, DEFAULT_LANG } from "../utils/lang";
import { LEGAL_TEXTS, LEGAL_LABELS } from "../legal/legalTexts";
import { LEGAL_INFO, LEGAL_UPDATED } from "../utils/legalInfo";
import { hasValue } from "../utils/hasValue";
import s from "./LegalPage.module.css";

const LegalPage = ({ kind }) => {
    const { lang: rawLang } = useParams();
    const lang = isSupportedLang(rawLang) ? rawLang : DEFAULT_LANG;
    const doc = LEGAL_TEXTS[kind]?.[lang];

    if (!doc) return <NotFound />;

    const rows = [
        [LEGAL_LABELS.operator[lang], LEGAL_INFO.companyName || LEGAL_INFO.brand],
        [LEGAL_LABELS.inn[lang], LEGAL_INFO.inn],
        [LEGAL_LABELS.address[lang], LEGAL_INFO.address],
        [LEGAL_LABELS.email[lang], LEGAL_INFO.email],
        [LEGAL_LABELS.phone[lang], LEGAL_INFO.phone],
    ].filter(([, value]) => hasValue(value));

    return (
        <>
            <Seo title={doc.title} description={doc.description} />

            <main className={s.page}>
                <h1>{doc.title}</h1>
                <p className={s.updated}>
                    {LEGAL_LABELS.updated[lang]}: {LEGAL_UPDATED}
                </p>

                {doc.sections.map((section) => (
                    <section className={s.section} key={section.h}>
                        <h2>{section.h}</h2>
                        {section.p.map((text, i) => (
                            <p key={i}>{text}</p>
                        ))}
                    </section>
                ))}

                {rows.length > 0 && (
                    <section className={s.contacts}>
                        <h2>{LEGAL_LABELS.contacts[lang]}</h2>
                        <dl>
                            {rows.map(([label, value]) => (
                                <div key={label} style={{ display: "contents" }}>
                                    <dt>{label}</dt>
                                    <dd>{value}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                )}
            </main>

            <Footer />
        </>
    );
};

export default LegalPage;
