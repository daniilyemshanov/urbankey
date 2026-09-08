import React from 'react'
import Find from '../components/Find'
import Catalog from '../components/Catalog'
import Footer from '../components/Footer'
import Seo from '../components/Seo'
import { useTranslation } from 'react-i18next'


const Properties = () => {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t("seoPropertiesTitle")} description={t("seoPropertiesDescription")} />
      <Find />
      <Catalog />
      <Footer />
    </>
  )
}

export default Properties