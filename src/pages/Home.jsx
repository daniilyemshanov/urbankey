import { lazy, Suspense } from 'react'
import Hero from '../components/Hero'
import Seo from '../components/Seo'
import { useTranslation } from 'react-i18next'
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from '../utils/structuredData'

const HomeSections = lazy(() => import('../components/HomeSections'))

const Home = () => {
    const { t } = useTranslation();
    return (
        <>
            <Seo
                title={t("seoHomeTitle")}
                description={t("seoHomeDescription")}
                jsonLd={[buildOrganizationJsonLd(), buildWebSiteJsonLd()]}
            />
            <Hero />
            <Suspense fallback={null}>
                <HomeSections />
            </Suspense>
        </>
    )
}

export default Home