import React from 'react'
import Elevate from '../components/Elevate'
import Unlock from '../components/Unlock'
import Effortless from '../components/Effortless'
import Smart from '../components/Smart'
import Footer from '../components/Footer'
import Seo from '../components/Seo'
import { useTranslation } from 'react-i18next'

const Services = () => {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t("seoServicesTitle")} description={t("seoServicesDescription")} />
      <Elevate />
      <Unlock />
      <Effortless />
      <Smart />
      <Footer />
    </>
  )
}

export default Services