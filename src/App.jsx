import Nav from "./components/Nav";
import BottomNav from "./components/BottomNav";
import OfflineBanner from "./components/OfflineBanner";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Error from "./pages/Error";
import Burger from "./components/Burger";
import ContactUs from "./pages/ContactUs";
import AboutUs from "./pages/AboutUs";
import Properties from "./pages/Properties";
import DistrictListings from "./pages/DistrictListings";
import Services from "./pages/Services";
import { ToastContainer } from "react-toastify";
import AOS from "aos";
import "aos/dist/aos.css";
import { lazy, Suspense, useContext, useEffect } from "react";
import { MyContext } from "./Context";
import PropertyPage from "./pages/PropertyPage";
import ScrollToTop from "./components/ScrollToTop";
import CommercialPage from "./pages/CommercialPage";
import TelegramFloatButton from "./components/TelegramFloatButton";
import CallFloatButton from "./components/CallFloatButton";
import LeadPopup from "./components/LeadPopup";
import LanguageLayout from "./components/LanguageLayout";
import LegacyRedirect from "./components/LegacyRedirect";

// Непубличные страницы (вход, профиль, админка, добавление объявлений) грузятся
// отдельными чанками: публичные страницы для поиска не тащат этот код.
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Admin = lazy(() => import("./pages/Admin"));
const CreateCard = lazy(() => import("./components/CreateCard"));
const ChangeCard = lazy(() => import("./components/ChangeCard"));
const AdminCards = lazy(() => import("./pages/AdminCards"));
const CreateVilla = lazy(() => import("./components/CreateVilla"));
const ChangeVilla = lazy(() => import("./components/ChangeVilla"));
const ChangeCommercial = lazy(() => import("./components/ChangeCommercial"));
const ListingsManager = lazy(() => import("./components/admin/ListingsManager"));
const CreateCommercialPage = lazy(() => import("./components/CreateCommercialPage"));
const EditCommercialPage = lazy(() => import("./components/EditCommercialPage"));
const ChangeCommercialPage = lazy(() => import("./components/ChangeCommercialPage"));
const Profile = lazy(() => import("./pages/Profile"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const UserProfile = lazy(() => import("./components/UserProfile"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const Favorites = lazy(() => import("./pages/Favorites"));
const AddProperty = lazy(() => import("./pages/AddProperty"));
const MyListings = lazy(() => import("./pages/MyListings"));
const AdminLeads = lazy(() => import("./pages/AdminLeads"));



const App = () => {

  const { isDark, profile } = useContext(MyContext);
  const isAdmin = profile?.role === "admin";
  useEffect(() => {

    const bodyEl = document.body;

    if (isDark) {
      bodyEl.classList.add("whiteMode");
    } else {
      bodyEl.classList.remove("whiteMode");
    }

  }, [isDark]);

  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: true
    });
  }, []);

  return (
    <>
      <ScrollToTop />

      <Nav />
      <Burger />
      <BottomNav />
      <OfflineBanner />
      <TelegramFloatButton />
      <CallFloatButton />
      <LeadPopup />

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />

      <Suspense fallback={null}>
      <Routes>
        {/* Публичные, индексируемые страницы — живут под языковым префиксом /ru /en /uz,
            это даёт каждому языку собственный URL для hreflang и убирает дубли контента. */}
        <Route path="/:lang" element={<LanguageLayout />}>
          <Route index element={<Home />} />
          <Route path="AboutUs" element={<AboutUs />} />
          <Route path="Properties" element={<Properties />} />
          <Route path="Properties/apartments/:district" element={<DistrictListings kind="apartments" />} />
          <Route path="Properties/commercial/:district" element={<DistrictListings kind="commercial" />} />
          <Route path="Services" element={<Services />} />
          <Route path="ContactUs" element={<ContactUs />} />
          <Route path="property/:id" element={<PropertyPage />} />
          <Route path="commercial/:id" element={<CommercialPage />} />
        </Route>

        {/* Совместимость со старыми "голыми" ссылками без языкового префикса.
            Основной 301/308-редирект настроен на уровне Vercel (vercel.json),
            эти маршруты — клиентский fallback (dev-режим, прямые заходы мимо edge). */}
        <Route path="/" element={<LegacyRedirect />} />
        <Route path="/AboutUs" element={<LegacyRedirect />} />
        <Route path="/Properties" element={<LegacyRedirect />} />
        <Route path="/Services" element={<LegacyRedirect />} />
        <Route path="/ContactUs" element={<LegacyRedirect />} />
        <Route path="/property/:id" element={<LegacyRedirect />} />
        <Route path="/commercial/:id" element={<LegacyRedirect />} />

        {/* Служебные/приватные страницы — не индексируются (см. robots.txt),
            мультиязычные URL им не нужны, оставляем как есть. */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/admin/users"
          element={<AdminUsers />}
        />
        <Route
          path="/profile"
          element={<Profile />}
        />

        <Route
          path="/admin"
          element={<Admin />}
        />
        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />
        <Route
          path="/forgot-password"
          element={<ForgotPassword />}
        />
        <Route path="/user/:id" element={<UserProfile />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/add-property" element={<AddProperty />} />
        <Route path="/add-property/:kind/:id" element={<AddProperty />} />
        <Route path="/my-listings" element={<MyListings />} />
        {isAdmin && (
          <>
            <Route
              path="/commercial/edit/:id"
              element={<EditCommercialPage />}
            />
            <Route
              path="/admin/changeCommercialPage"
              element={
                <ChangeCommercialPage />
              }
            />


            <Route
              path="/admin/createCommercialPage"
              element={<CreateCommercialPage />}
            />
            <Route
              path="/admin/createCommercialPage/:id"
              element={<CreateCommercialPage />}
            />
            <Route
              path="/admin/changeCommercial/:id"
              element={<ChangeCommercial />}
            />
            <Route
              path="/admin/cards"
              element={<AdminCards />}
            />
            <Route
              path="/admin/commercials"
              element={<ListingsManager kind="commercial" />}
            />

            <Route
              path="/admin/createCard"
              element={<CreateCard />}
            />

            <Route
              path="/admin/changeCard"
              element={<ChangeCard />}
            />

            <Route
              path="/admin/changeCard/:id"
              element={<ChangeCard />}
            />
            <Route

              path="/admin/createVilla"

              element={<CreateVilla />}


            />
            <Route
              path="/admin/CreateVilla/:id"
              element={<CreateVilla />}

            />
            <Route
              path="/admin/changeVilla"
              element={<ChangeVilla />}
            />
            <Route
              path="/admin/leads"
              element={<AdminLeads />}
            />
          </>

        )}
        <Route path="*" element={<Error />} />

      </Routes>
      </Suspense>
    </>
  );
};

export default App;