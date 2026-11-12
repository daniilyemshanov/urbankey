// Тексты страниц «Политика конфиденциальности» (privacy) и «Условия использования» (terms).
// Это шаблоны: перед публикацией покажите их юристу (закон о персональных данных
// и закон «О рекламе» Республики Узбекистан) и дополните реквизитами в utils/legalInfo.js.

export const LEGAL_LABELS = {
    updated: { ru: "Дата обновления", en: "Last updated", uz: "Yangilangan sana" },
    operator: { ru: "Оператор", en: "Operator", uz: "Operator" },
    inn: { ru: "ИНН", en: "Tax ID (STIR)", uz: "STIR" },
    address: { ru: "Адрес", en: "Address", uz: "Manzil" },
    email: { ru: "E-mail", en: "E-mail", uz: "E-mail" },
    phone: { ru: "Телефон", en: "Phone", uz: "Telefon" },
    contacts: { ru: "Контакты оператора", en: "Operator contacts", uz: "Operator kontaktlari" },
    privacy: { ru: "Политика конфиденциальности", en: "Privacy Policy", uz: "Maxfiylik siyosati" },
    terms: { ru: "Условия использования", en: "Terms of Use", uz: "Foydalanish shartlari" },
};

export const LEGAL_TEXTS = {
    privacy: {
        ru: {
            title: "Политика конфиденциальности",
            description: "Какие персональные данные собирает сайт UrbanKey, зачем, как они хранятся и как вы можете ими управлять.",
            sections: [
                { h: "1. Общие положения", p: [
                    "Настоящая Политика описывает, какие персональные данные собирает сайт urbankey.uz (далее — Сайт) и агентство недвижимости UrbanKey (далее — Оператор), как они используются и защищаются. Политика составлена в соответствии с законодательством Республики Узбекистан о персональных данных.",
                    "Используя Сайт и отправляя формы, вы подтверждаете, что ознакомились с Политикой и согласны с ней.",
                ] },
                { h: "2. Какие данные мы собираем", p: [
                    "Данные из форм: имя, фамилия, номер телефона, адрес электронной почты, текст сообщения и другая информация, которую вы указываете сами.",
                    "Данные аккаунта: имя, фамилия, город, телефон, фото профиля, описание, адрес электронной почты для входа (в том числе при входе через Google), избранные объявления, оставленные отзывы.",
                    "Технические данные: IP-адрес, тип устройства и браузера, просмотренные страницы, файлы cookie и данные аналитики.",
                ] },
                { h: "3. Для чего мы используем данные", p: [
                    "Для обработки заявок и связи с вами, подбора объектов недвижимости и сопровождения сделок; для создания и ведения аккаунта; для публикации отзывов; для защиты Сайта от спама и злоупотреблений; для анализа посещаемости и улучшения Сайта; для выполнения требований законодательства.",
                ] },
                { h: "4. Согласие", p: [
                    "Мы обрабатываем персональные данные с вашего согласия, которое вы даёте, отмечая соответствующую галочку или отправляя форму. Вы можете отозвать согласие в любой момент (см. раздел 8).",
                ] },
                { h: "5. Кому могут передаваться данные", p: [
                    "Для работы Сайта мы используем внешние сервисы: хостинг и доставку сайта (Vercel, Cloudflare), базу данных и авторизацию (Supabase), защиту от ботов (Cloudflare Turnstile), аналитику (Google Analytics), уведомления о заявках (Telegram). Эти сервисы обрабатывают данные по нашему поручению для перечисленных целей. Данные могут обрабатываться за пределами Узбекистана при соблюдении требований законодательства.",
                    "Мы не продаём персональные данные. Передача государственным органам возможна только в случаях, предусмотренных законом.",
                ] },
                { h: "6. Файлы cookie и локальное хранилище", p: [
                    "Сайт использует файлы cookie и локальное хранилище браузера для работы (язык, тема, валюта, избранное, сессия) и аналитики. Вы можете отключить их в настройках браузера, но часть функций может перестать работать.",
                ] },
                { h: "7. Хранение и защита", p: [
                    "Мы храним данные столько, сколько необходимо для указанных целей, либо до отзыва согласия. Мы применяем организационные и технические меры защиты: шифрование соединения (HTTPS), разграничение доступа, защиту от автоматических запросов.",
                ] },
                { h: "8. Ваши права", p: [
                    "Вы вправе получить информацию о своих данных, потребовать их исправления, блокирования или удаления, а также отозвать согласие на обработку. Аккаунт можно удалить в личном кабинете или написав нам по контактам ниже. Мы ответим в разумный срок.",
                ] },
                { h: "9. Дети", p: [
                    "Сайт не предназначен для лиц младше 18 лет, и мы сознательно не собираем их данные.",
                ] },
                { h: "10. Изменения Политики", p: [
                    "Мы можем обновлять Политику. Актуальная версия всегда размещена на этой странице с указанием даты обновления.",
                ] },
            ],
        },
        en: {
            title: "Privacy Policy",
            description: "What personal data the UrbanKey website collects, why, how it is stored, and how you can manage it.",
            sections: [
                { h: "1. General", p: [
                    "This Policy explains what personal data the website urbankey.uz (the “Website”) and the UrbanKey real estate agency (the “Operator”) collect, how the data is used and protected. It is prepared in accordance with the personal data legislation of the Republic of Uzbekistan.",
                    "By using the Website and submitting forms you confirm that you have read and agree to this Policy.",
                ] },
                { h: "2. Data we collect", p: [
                    "Form data: name, surname, phone number, e-mail address, message text and any other information you provide.",
                    "Account data: name, surname, city, phone, profile photo, bio, sign-in e-mail (including sign-in with Google), favorite listings and reviews you post.",
                    "Technical data: IP address, device and browser type, pages viewed, cookies and analytics data.",
                ] },
                { h: "3. Why we use data", p: [
                    "To process requests and contact you, select properties and support transactions; to create and maintain your account; to publish reviews; to protect the Website from spam and abuse; to analyze traffic and improve the Website; and to comply with the law.",
                ] },
                { h: "4. Consent", p: [
                    "We process personal data with your consent, which you give by ticking the checkbox or submitting a form. You may withdraw consent at any time (see section 8).",
                ] },
                { h: "5. Who may receive data", p: [
                    "To operate the Website we use third-party services: hosting and delivery (Vercel, Cloudflare), database and authentication (Supabase), bot protection (Cloudflare Turnstile), analytics (Google Analytics) and request notifications (Telegram). They process data on our behalf for the purposes above. Data may be processed outside Uzbekistan in compliance with applicable law.",
                    "We do not sell personal data. Data may be disclosed to public authorities only where required by law.",
                ] },
                { h: "6. Cookies and local storage", p: [
                    "The Website uses cookies and browser local storage for operation (language, theme, currency, favorites, session) and analytics. You can disable them in your browser settings, but some features may stop working.",
                ] },
                { h: "7. Storage and security", p: [
                    "We keep data for as long as needed for the purposes above or until consent is withdrawn. We apply organizational and technical measures: encrypted connections (HTTPS), access control and protection against automated requests.",
                ] },
                { h: "8. Your rights", p: [
                    "You may request information about your data, ask for correction, blocking or deletion, and withdraw consent. You can delete your account in your profile or by contacting us below. We will respond within a reasonable time.",
                ] },
                { h: "9. Children", p: [
                    "The Website is not intended for persons under 18 and we do not knowingly collect their data.",
                ] },
                { h: "10. Changes", p: [
                    "We may update this Policy. The current version is always published on this page with its update date.",
                ] },
            ],
        },
        uz: {
            title: "Maxfiylik siyosati",
            description: "UrbanKey sayti qanday shaxsiy ma'lumotlarni yig'adi, nima uchun, qanday saqlanadi va ularni qanday boshqarish mumkin.",
            sections: [
                { h: "1. Umumiy qoidalar", p: [
                    "Ushbu Siyosat urbankey.uz sayti (keyingi o'rinlarda — Sayt) va UrbanKey ko'chmas mulk agentligi (keyingi o'rinlarda — Operator) qanday shaxsiy ma'lumotlarni yig'ishi, ulardan qanday foydalanishi va ularni qanday himoya qilishini tushuntiradi. Siyosat O'zbekiston Respublikasining shaxsiy ma'lumotlar to'g'risidagi qonunchiligiga muvofiq tuzilgan.",
                    "Saytdan foydalanib va shakllarni yuborib, siz Siyosat bilan tanishganingizni va rozi ekaningizni tasdiqlaysiz.",
                ] },
                { h: "2. Qanday ma'lumotlarni yig'amiz", p: [
                    "Shakllardagi ma'lumotlar: ism, familiya, telefon raqami, elektron pochta manzili, xabar matni va siz o'zingiz ko'rsatgan boshqa ma'lumotlar.",
                    "Akkaunt ma'lumotlari: ism, familiya, shahar, telefon, profil surati, tavsif, kirish uchun elektron pochta (jumladan Google orqali kirish), tanlangan e'lonlar va qoldirilgan sharhlar.",
                    "Texnik ma'lumotlar: IP-manzil, qurilma va brauzer turi, ko'rilgan sahifalar, cookie fayllari va tahlil ma'lumotlari.",
                ] },
                { h: "3. Ma'lumotlardan nima uchun foydalanamiz", p: [
                    "Arizalarni qayta ishlash va siz bilan bog'lanish, ko'chmas mulkni tanlash va bitimlarni kuzatib borish uchun; akkaunt yaratish va yuritish uchun; sharhlarni e'lon qilish uchun; Saytni spam va suiiste'moldan himoya qilish uchun; tashrif statistikasini tahlil qilish va Saytni yaxshilash uchun; qonun talablarini bajarish uchun.",
                ] },
                { h: "4. Rozilik", p: [
                    "Shaxsiy ma'lumotlarni sizning roziligingiz bilan qayta ishlaymiz. Rozilikni tegishli belgini qo'yish yoki shaklni yuborish orqali bildirasiz. Rozilikni istalgan vaqtda qaytarib olishingiz mumkin (8-bo'limga qarang).",
                ] },
                { h: "5. Ma'lumotlar kimga berilishi mumkin", p: [
                    "Sayt ishlashi uchun tashqi xizmatlardan foydalanamiz: hosting va yetkazib berish (Vercel, Cloudflare), ma'lumotlar bazasi va avtorizatsiya (Supabase), botlardan himoya (Cloudflare Turnstile), tahlil (Google Analytics), arizalar haqida xabarnomalar (Telegram). Bu xizmatlar ma'lumotlarni biz nomimizdan yuqoridagi maqsadlar uchun qayta ishlaydi. Ma'lumotlar qonunchilik talablariga rioya qilingan holda O'zbekiston hududidan tashqarida ham qayta ishlanishi mumkin.",
                    "Shaxsiy ma'lumotlarni sotmaymiz. Davlat organlariga faqat qonunda nazarda tutilgan hollarda beriladi.",
                ] },
                { h: "6. Cookie fayllari va mahalliy xotira", p: [
                    "Sayt ishlashi (til, mavzu, valyuta, tanlanganlar, sessiya) va tahlil uchun cookie fayllari va brauzer mahalliy xotirasidan foydalanadi. Ularni brauzer sozlamalarida o'chirishingiz mumkin, lekin ba'zi funksiyalar ishlamay qolishi mumkin.",
                ] },
                { h: "7. Saqlash va himoya", p: [
                    "Ma'lumotlarni ko'rsatilgan maqsadlar uchun zarur bo'lgan muddat yoki rozilik qaytarib olinguncha saqlaymiz. Tashkiliy va texnik himoya choralarini qo'llaymiz: ulanishni shifrlash (HTTPS), kirishni cheklash, avtomatik so'rovlardan himoya.",
                ] },
                { h: "8. Sizning huquqlaringiz", p: [
                    "Siz o'z ma'lumotlaringiz haqida axborot olish, ularni tuzatish, bloklash yoki o'chirishni talab qilish, shuningdek qayta ishlashga rozilikni qaytarib olish huquqiga egasiz. Akkauntni shaxsiy kabinetda yoki quyidagi kontaktlar orqali bizga yozib o'chirishingiz mumkin. Oqilona muddatda javob beramiz.",
                ] },
                { h: "9. Bolalar", p: [
                    "Sayt 18 yoshga to'lmagan shaxslar uchun mo'ljallanmagan va biz ularning ma'lumotlarini ongli ravishda yig'maymiz.",
                ] },
                { h: "10. Siyosatdagi o'zgarishlar", p: [
                    "Siyosatni yangilashimiz mumkin. Joriy versiya doimo ushbu sahifada yangilangan sana bilan e'lon qilinadi.",
                ] },
            ],
        },
    },

    terms: {
        ru: {
            title: "Условия использования",
            description: "Правила пользования сайтом UrbanKey: характер информации об объектах, аккаунт, отзывы, ответственность.",
            sections: [
                { h: "1. Общие положения", p: [
                    "Настоящие Условия регулируют использование сайта urbankey.uz (далее — Сайт), принадлежащего агентству недвижимости UrbanKey (далее — Оператор). Используя Сайт, вы соглашаетесь с Условиями. Если вы не согласны, пожалуйста, не используйте Сайт.",
                ] },
                { h: "2. Характер информации на Сайте", p: [
                    "Информация об объектах (цены, площадь, этаж, планировка, состояние, наличие, фотографии) носит справочный характер, получена от владельцев, застройщиков или из открытых источников и может изменяться без уведомления. Она не является публичной офертой. Актуальные данные и наличие уточняйте у менеджера.",
                    "Цены отображаются в сумах. Пересчёт в другие валюты, если он включён, выполняется по ориентировочному курсу и не является предложением заключить сделку по этому курсу.",
                ] },
                { h: "3. Услуги агентства", p: [
                    "Оператор оказывает услуги по подбору недвижимости, консультированию и сопровождению сделок. Условия услуг и вознаграждение определяются отдельным договором. Информация на Сайте не гарантирует заключение сделки.",
                    "Консультации по ипотеке и рассрочке носят информационный характер; условия кредитования определяет банк или застройщик.",
                ] },
                { h: "4. Аккаунт", p: [
                    "Для некоторых функций требуется регистрация. Вы обязуетесь указывать достоверные данные и хранить пароль в тайне. Вы отвечаете за действия, совершённые через ваш аккаунт. Оператор вправе ограничить доступ при нарушении Условий.",
                ] },
                { h: "5. Отзывы и пользовательский контент", p: [
                    "Вы отвечаете за достоверность публикуемых вами отзывов и сообщений. Запрещено публиковать заведомо ложные сведения, оскорбления, чужие персональные данные, спам и рекламные ссылки. Оператор вправе модерировать и удалять такой контент.",
                    "Публикуя отзыв, вы даёте Оператору право показывать его на Сайте.",
                ] },
                { h: "6. Интеллектуальная собственность", p: [
                    "Дизайн, тексты, логотип и иные материалы Сайта принадлежат Оператору или используются на законных основаниях. Копирование и распространение без разрешения запрещены. Фотографии объектов используются с согласия их владельцев.",
                ] },
                { h: "7. Ограничение ответственности", p: [
                    "Сайт предоставляется «как есть». В пределах, допускаемых законом, Оператор не отвечает за убытки, возникшие из-за неточностей в информации, перебоев в работе Сайта, действий третьих лиц и содержимого сторонних сайтов, на которые ведут ссылки.",
                ] },
                { h: "8. Применимое право", p: [
                    "К Условиям применяется законодательство Республики Узбекистан. Споры решаются путём переговоров, а при недостижении согласия — в порядке, установленном законодательством.",
                ] },
                { h: "9. Изменения Условий", p: [
                    "Оператор вправе изменять Условия. Актуальная версия размещена на этой странице с указанием даты обновления.",
                ] },
            ],
        },
        en: {
            title: "Terms of Use",
            description: "Rules for using the UrbanKey website: nature of listing information, accounts, reviews, liability.",
            sections: [
                { h: "1. General", p: [
                    "These Terms govern the use of the website urbankey.uz (the “Website”) owned by the UrbanKey real estate agency (the “Operator”). By using the Website you agree to these Terms. If you do not agree, please do not use the Website.",
                ] },
                { h: "2. Nature of information on the Website", p: [
                    "Property information (prices, area, floor, layout, condition, availability, photos) is for reference only, is obtained from owners, developers or public sources, and may change without notice. It is not a public offer. Please confirm current details and availability with a manager.",
                    "Prices are shown in Uzbek soums. Conversion to other currencies, where enabled, uses an approximate rate and is not an offer to transact at that rate.",
                ] },
                { h: "3. Agency services", p: [
                    "The Operator provides property selection, consulting and transaction support. Service terms and fees are set by a separate agreement. Information on the Website does not guarantee that a transaction will be concluded.",
                    "Advice on mortgages and installment plans is informational; lending terms are set by the bank or developer.",
                ] },
                { h: "4. Account", p: [
                    "Some features require registration. You agree to provide accurate information and keep your password confidential. You are responsible for actions made through your account. The Operator may restrict access if these Terms are violated.",
                ] },
                { h: "5. Reviews and user content", p: [
                    "You are responsible for the accuracy of the reviews and messages you publish. Knowingly false statements, insults, other people's personal data, spam and advertising links are prohibited. The Operator may moderate and remove such content.",
                    "By publishing a review you allow the Operator to display it on the Website.",
                ] },
                { h: "6. Intellectual property", p: [
                    "The design, texts, logo and other materials of the Website belong to the Operator or are used lawfully. Copying or distribution without permission is prohibited. Property photos are used with the owners' consent.",
                ] },
                { h: "7. Limitation of liability", p: [
                    "The Website is provided “as is”. To the extent permitted by law, the Operator is not liable for losses caused by inaccuracies in information, interruptions, actions of third parties, or the content of third-party sites that are linked.",
                ] },
                { h: "8. Governing law", p: [
                    "These Terms are governed by the laws of the Republic of Uzbekistan. Disputes are resolved by negotiation and, failing agreement, in the manner established by law.",
                ] },
                { h: "9. Changes", p: [
                    "The Operator may change these Terms. The current version is published on this page with its update date.",
                ] },
            ],
        },
        uz: {
            title: "Foydalanish shartlari",
            description: "UrbanKey saytidan foydalanish qoidalari: obyektlar haqidagi ma'lumotlarning xususiyati, akkaunt, sharhlar, mas'uliyat.",
            sections: [
                { h: "1. Umumiy qoidalar", p: [
                    "Ushbu Shartlar UrbanKey ko'chmas mulk agentligiga (keyingi o'rinlarda — Operator) tegishli urbankey.uz saytidan (keyingi o'rinlarda — Sayt) foydalanishni tartibga soladi. Saytdan foydalanib, siz Shartlarga rozilik bildirasiz. Rozi bo'lmasangiz, Saytdan foydalanmang.",
                ] },
                { h: "2. Saytdagi ma'lumotlarning xususiyati", p: [
                    "Obyektlar haqidagi ma'lumotlar (narx, maydon, qavat, reja, holat, mavjudlik, suratlar) ma'lumot xarakteriga ega, egalaridan, quruvchilardan yoki ochiq manbalardan olinadi va ogohlantirishsiz o'zgarishi mumkin. Ular ommaviy oferta hisoblanmaydi. Dolzarb ma'lumot va mavjudligini menejerdan aniqlashtiring.",
                    "Narxlar so'mda ko'rsatiladi. Boshqa valyutalarga o'tkazish (yoqilgan bo'lsa) taxminiy kurs bo'yicha amalga oshiriladi va shu kurs bo'yicha bitim tuzish taklifi hisoblanmaydi.",
                ] },
                { h: "3. Agentlik xizmatlari", p: [
                    "Operator ko'chmas mulkni tanlash, maslahat berish va bitimlarni kuzatib borish xizmatlarini ko'rsatadi. Xizmat shartlari va haq alohida shartnoma bilan belgilanadi. Saytdagi ma'lumotlar bitim tuzilishini kafolatlamaydi.",
                    "Ipoteka va bo'lib to'lash bo'yicha maslahatlar axborot xarakteriga ega; kreditlash shartlarini bank yoki quruvchi belgilaydi.",
                ] },
                { h: "4. Akkaunt", p: [
                    "Ba'zi funksiyalar uchun ro'yxatdan o'tish talab qilinadi. Siz ishonchli ma'lumot ko'rsatish va parolni sir saqlash majburiyatini olasiz. Akkauntingiz orqali amalga oshirilgan harakatlar uchun o'zingiz javobgarsiz. Shartlar buzilsa, Operator kirishni cheklashi mumkin.",
                ] },
                { h: "5. Sharhlar va foydalanuvchi kontenti", p: [
                    "E'lon qilgan sharh va xabarlaringizning to'g'riligi uchun o'zingiz javobgarsiz. Bila turib yolg'on ma'lumot, haqoratlar, boshqa shaxslarning shaxsiy ma'lumotlari, spam va reklama havolalarini joylash taqiqlanadi. Operator bunday kontentni moderatsiya qilish va o'chirish huquqiga ega.",
                    "Sharh e'lon qilib, uni Saytda ko'rsatish huquqini Operatorga berasiz.",
                ] },
                { h: "6. Intellektual mulk", p: [
                    "Saytning dizayni, matnlari, logotipi va boshqa materiallari Operatorga tegishli yoki qonuniy asosda foydalaniladi. Ruxsatsiz nusxalash va tarqatish taqiqlanadi. Obyektlar suratlari egalarining roziligi bilan ishlatiladi.",
                ] },
                { h: "7. Mas'uliyatni cheklash", p: [
                    "Sayt «borligicha» taqdim etiladi. Qonun ruxsat etgan doirada Operator ma'lumotlardagi noaniqliklar, uzilishlar, uchinchi shaxslarning harakatlari va havolalar olib boradigan tashqi saytlar mazmuni sabab bo'lgan zararlar uchun javob bermaydi.",
                ] },
                { h: "8. Qo'llaniladigan huquq", p: [
                    "Shartlarga O'zbekiston Respublikasi qonunchiligi qo'llaniladi. Nizolar muzokaralar yo'li bilan, kelishuvga erishilmasa — qonunchilikda belgilangan tartibda hal qilinadi.",
                ] },
                { h: "9. Shartlarning o'zgarishi", p: [
                    "Operator Shartlarni o'zgartirishi mumkin. Joriy versiya ushbu sahifada yangilangan sana bilan e'lon qilinadi.",
                ] },
            ],
        },
    },
};
