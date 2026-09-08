import Connect from '../components/Connect'
import Footer from '../components/Footer'
import Get from '../components/Get'
import World from '../components/World'
import Seo from '../components/Seo'
import { useTranslation } from 'react-i18next'

const ContactUs = () => {
  const { t } = useTranslation();
  return (
    <>
      <Seo title={t("seoContactTitle")} description={t("seoContactDescription")} />
      <Get />
      <Connect />
      <World />
      <Footer />
    </>
  )
}

export default ContactUs