import Journey from '../components/Journey'
import Value from '../components/Value'
import Navigating from '../components/Navigating'
import Realtor from '../components/Realtor'
import Achievements from '../components/Achievements'
import Footer from '../components/Footer'
import Seo from '../components/Seo'
import { useTranslation } from 'react-i18next'

const AboutUs = () => {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t("seoAboutTitle")} description={t("seoAboutDescription")} />
      <Journey />
      <Value />
      <Achievements />
      <Navigating />
      <Realtor />
      <Footer />
    </>
  )
}

export default AboutUs