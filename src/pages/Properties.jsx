import React from 'react'
import Find from '../components/Find'
import Catalog from '../components/Catalog'
import Footer from '../components/Footer'
import Seo from '../components/Seo'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import DistrictLinks from '../components/DistrictLinks'
import { isSupportedLang, DEFAULT_LANG } from '../utils/lang'


const Properties = () => {
  const { t } = useTranslation();
  const { lang: rawLang } = useParams();
  const lang = isSupportedLang(rawLang) ? rawLang : DEFAULT_LANG;
  return (
    <>
      <Seo title={t("seoPropertiesTitle")} description={t("seoPropertiesDescription")} />
      <Find />
      <Catalog />
      <DistrictLinks lang={lang} />
      <Footer />
    </>
  )
}

export default Properties