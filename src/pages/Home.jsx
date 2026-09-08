import Hero from '../components/Hero'
import Feautured from '../components/Feautured'
import What from '../components/What'
import Questions from '../components/Questions'
import Footer from '../components/Footer'
import CommercialSection from '../components/CommercialSection'
import Seo from '../components/Seo'
import { useTranslation } from 'react-i18next'
import { buildOrganizationJsonLd } from '../utils/structuredData'

const Home = () => {
    const { t } = useTranslation();
    return (
        <>
            <Seo
                title={t("seoHomeTitle")}
                description={t("seoHomeDescription")}
                jsonLd={buildOrganizationJsonLd()}
            />
            <Hero />
            <Feautured />
            <CommercialSection />
            <What />
            <Questions />
            <Footer />
        </>
    )
}

export default Home