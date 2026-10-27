<div dir="rtl">

# دليل استخدام RxDesk

## ١. التثبيت
1. افتح ملف **RxDesk-Setup-1.0.0.exe** بالضغط عليه مرتين. لا يحتاج صلاحيات مدير.
2. إذا ظهرت رسالة "Windows protected your PC" اضغط **More info** ثم **Run anyway**.
3. يتم التثبيت تلقائياً ويظهر اختصار **RxDesk** على سطح المكتب وفي قائمة ابدأ، ويفتح البرنامج.

البرنامج يعمل بدون إنترنت تماماً، ولا تخرج أي بيانات من الجهاز.

## ٢. أول تشغيل (معالج الإعداد)
- اختر اللغة (عربي / English).
- اكتب اسم الطبيب بالعربي والإنجليزي، والتخصص، ورقم الترخيص.
- اكتب اسم العيادة والعنوان وأرقام التليفون، ويمكنك إضافة الشعار (اللوجو).
- اختر مقاس الورق: **A5** أو **A4** أو مقاس مخصص.
- (اختياري) اختر رقماً سرياً يُطلب عند فتح البرنامج.
- يمكنك إضافة 3 مرضى تجريبيين للتجربة.

## ٣. كتابة روشتة (الشاشة الرئيسية)
1. اضغط **روشتة جديدة** (أو F1 أو Ctrl+N).
2. اكتب اسم المريض أو رقم تليفونه واضغط **Enter** لاختياره. لمريض جديد اضغط **مريض جديد** واكتب الاسم والسن.
3. اكتب **التشخيص** (تظهر التشخيصات السابقة تلقائياً).
4. في **الأدوية**: اكتب أول حروف الدواء واضغط **Enter** فيُكتب الاسم والتركيز والجرعة تلقائياً من مكتبتك. (عدد الخانات يُحدد من الإعدادات ← شاشة الروشتة.)
   - **Enter** ينقلك للحقل التالي، وبعد آخر حقل ينتقل للدواء التالي.
   - **جمل الجرعات** على الجانب: اضغط على أي جملة لتضعها في جرعة الدواء المحدد.
   - **القوالب**: اضغط على قالب (مثل "Tinea treatment") لإضافة كل أدويته مرة واحدة. لحفظ الروشتة الحالية كقالب اضغط ☆.
   - إذا كان المريض لديه **حساسية** من الدواء يظهر تحذير أحمر (التحذير لا يمنع الحفظ).
   - أي دواء جديد تكتبه يُضاف لمكتبتك تلقائياً.
5. اكتب التعليمات والتحاليل المطلوبة وموعد الإعادة (أزرار سريعة: +3 / +7 / +14 يوماً / +1 شهر).
6. اضغط **حفظ** (Ctrl+S) أو **طباعة** (Ctrl+P). الطباعة تحفظ الروشتة تلقائياً.
   - 👁 **معاينة الطباعة** تعرض الورقة كما ستُطبع بالضبط.
   - **PDF** يحفظ الروشتة كملف.

## ٤. التشخيص واقتراحات العلاج
- اكتب التشخيص بالعربي أو الإنجليزي أو بكود ICD (مثل "لوز" أو "tonsil" أو "J03") واضغط **Enter** لإضافته. يمكنك إضافة أكثر من تشخيص.
- تحت التشخيص تظهر **اقتراحات العلاج**: خيارات جاهزة (مثل الخط الأول، حساسية البنسلين، جرعة الأطفال). اضغط **إضافة** لوضع أدويتها في الروشتة، وتُكتب النصائح والتحاليل إذا كانت خاناتها فارغة.
- إذا كان المريض لديه حساسية من دواء في الخيار يظهر تحذير أحمر. للأطفال تظهر خيارات الأطفال أولاً (الجرعات لكل كجم — احسبها حسب الوزن).
- هذه اقتراحات فقط، والطبيب يراجع كل دواء وجرعة. يمكنك تعديل القائمة من **الأدوية والقوالب ← التشخيصات** (تعديل، إضافة تشخيص خاص بك، إخفاء، أو استعادة القائمة الأصلية).

### الجرعة بالقوائم المنسدلة (الكمية · عدد المرات · العين)
- كل دواء في الروشتة له: **اسم الدواء**، ثم قائمة **الكمية** (قطرة واحدة، قطرتين، قرص…)، وقائمة **عدد المرات** (مرة، مرتين، 4 مرات يومياً، كل ساعتين…).
- لإضافة قائمة **العين** (العين اليمنى / العين اليسرى / العينين): **الإعدادات ← شاشة الروشتة ← الجرعة** وفعّل "العين"، أو اختر **عيادة عيون**.
- من نفس المكان يمكنك إضافة أو حذف اختيارات أي قائمة (مثل "كل 3 ساعات"). ويمكنك دائماً كتابة قيمة غير موجودة في القائمة.
- تُطبع بهذا الشكل تحت اسم الدواء: «قطرة واحدة — 4 مرات يومياً — العين اليمنى».

### إضافة الأدوية من ملف إكسل
1. من **الأدوية والقوالب ← مكتبة الأدوية** اضغط **إكسل ← تحميل نموذج فارغ**.
2. اكتب في كل صف: اسم الدواء، الشكل، التركيز، الجرعة، عدد المرات، المدة، الطريقة، التعليمات (اسم الدواء فقط مطلوب). يمكن أن تكون العناوين بالعربي أو الإنجليزي وبأي ترتيب.
3. اضغط **إكسل ← استيراد من إكسل** واختر الملف. ستظهر معاينة بعدد الأدوية الجديدة والتي سيتم تحديثها، ثم اضغط **استيراد**.
4. الأدوية الموجودة تُحدَّث فقط في الخانات المكتوبة، والخانات الفارغة لا تمسح شيئاً.
5. **إكسل ← تصدير إلى إكسل** يحفظ كل مكتبة الأدوية في ملف إكسل.

## ٥. المرضى
- ابحث بالاسم (بأي ترتيب للكلمات، "احمد" تجد "أحمد") أو بجزء من رقم التليفون.
- افتح المريض لترى بياناته وكل روشتاته السابقة:
  - 🖨 **إعادة طباعة** روشتة قديمة كما هي.
  - **تكرار كروشتة جديدة**: ينسخ الأدوية في روشتة جديدة بتاريخ اليوم.

## ٦. تصميم الطباعة
من **تصميم الطباعة** تصمم شكل الروشتة على الورق:
- الصفحة معروضة بمقاسها الحقيقي مع مسطرة بالمليمتر.
- **اسحب** أي عنصر لتحريكه، واسحب المربعات الصغيرة لتغيير حجمه. الأسهم تحرك 1 مم (مع Shift: 0.1 مم).
- اضغط على عنصر لتغيير الخط والحجم واللون والمحاذاة والاتجاه ونص العنوان.
- أضف عناصر من القائمة (اسم الطبيب، المريض، الأدوية، QR، نص، خط، مستطيل…).
- **عنصر الأدوية**: قائمة مرقمة أو جدول، واختر الأعمدة. إذا زادت الأدوية تكمل الطباعة في صفحة ثانية تلقائياً.
- **ورق مطبوع مسبقاً**: ارفع صورة/سكان لورقتك كخلفية لتضع البيانات فوقها بالضبط، واترك "طباعة الخلفية" مقفلة.
- **ضبط الطابعة**: إذا خرجت الطباعة مُزاحة، اطبع **صفحة تجربة** وقِس الإزاحة بالمسطرة ثم اكتبها في X / Y.
- Ctrl+Z تراجع، Ctrl+Y إعادة، Ctrl+S حفظ. يمكنك حفظ أكثر من تصميم واختيار التصميم الافتراضي، وتصدير التصميم لملف لنقله لجهاز آخر.

## ٧. الإعدادات
- **شاشة الروشتة**: اختر شكل شاشة الروشتة الجديدة:
  - **بسيطة** (الافتراضي): اسم الدواء + سطر واحد للجرعة والتعليمات، وخانة للنصائح فقط.
  - **تفصيلية**: كل الخانات (الشكل، التركيز، عدد المرات، المدة، الطريقة، التعليمات) والتشخيص والتحاليل وموعد الإعادة واللوحة الجانبية.
  - أو اختر بنفسك أي خانة أو جزء يظهر. عند إخفاء خانة، تُكتب قيمتها المعتادة من مكتبة الأدوية داخل سطر الجرعة تلقائياً.
  - القوالب متاحة من زر **القوالب** أعلى الشاشة، والروشتات السابقة من زر **السابقة** بجوار اسم المريض.
- **الطباعة**: الطابعة الافتراضية، الطباعة المباشرة بدون نافذة، عدد النسخ.
- **النسخ الاحتياطي**:
  - **نسخة احتياطية الآن** واحفظها على فلاشة USB (يُنصح بذلك أسبوعياً).
  - نسخة تلقائية يومياً (يُحتفظ بآخر 14 نسخة).
  - **استرجاع**: اختر ملف النسخة ثم أكّد. يحفظ البرنامج نسخة من بياناتك الحالية قبل الاسترجاع.
- **تصدير إلى Excel**: قائمة المرضى أو الروشتات.
- **كلمة السر**: إضافة/تغيير/إلغاء الرقم السري. زر **قفل** في القائمة يقفل البرنامج فوراً.
  ⚠️ إذا نسيت الرقم السري لا يمكن فتحه إلا باسترجاع نسخة احتياطية قبل وضع الرقم — احتفظ به في مكان آمن.

## ٨. اختصارات لوحة المفاتيح
| المفتاح | الوظيفة |
|---|---|
| Ctrl+N أو F1 | روشتة جديدة |
| Ctrl+S | حفظ |
| Ctrl+P | طباعة |
| Ctrl+F أو F2 | البحث عن مريض |
| Enter | الحقل التالي |

## ٩. أين بياناتي؟
كل البيانات في المجلد `%APPDATA%\RxDesk` (الإعدادات ← عن البرنامج ← فتح مجلد البيانات).
إلغاء تثبيت البرنامج **لا يحذف** البيانات، وإعادة التثبيت تعيدها كما هي.

## ١٠. المزامنة مع الإنترنت (اختياري)
- البرنامج يعمل دائماً بدون إنترنت. المزامنة تحفظ نسخة من بيانات العيادة على الإنترنت ليديرها المسؤول من موقع RxDesk.
- **التفعيل:** الإعدادات ← **المزامنة** ← اكتب البريد وكلمة المرور اللذين أعطاهما لك المسؤول ← **تسجيل الدخول والمزامنة**.
- بعد ذلك تتم المزامنة تلقائياً: كل دقيقتين، وبعد أي تعديل بثوانٍ، وفور عودة الإنترنت. أيقونة السحابة أسفل القائمة الجانبية توضح الحالة.
- إذا انقطع الإنترنت استمر في العمل عادي؛ التغييرات تنتظر وتُرسل عند عودة الاتصال.
- **جهاز جديد:** في معالج الإعداد اضغط «لديك حساب عيادة على الإنترنت؟» وسجّل الدخول لتنزيل بياناتك.
- ما يتغير من الموقع (أدوية جديدة، قوائم الجرعة، إعدادات الروشتة، تصميم الطباعة، بيانات العيادة) يظهر عندك تلقائياً.
- الرقم السري والطابعة ومجلد النسخ الاحتياطي لا تخرج من الجهاز. **إيقاف المزامنة** لا يحذف أي بيانات من الجهاز.

## ١١. موقع الإدارة (للمسؤول فقط)
- افتح رابط الموقع وسجّل الدخول بحساب المسؤول.
- **العيادات:** قائمة بكل العيادات وآخر مزامنة وعدد المرضى والروشتات. **عيادة جديدة** تنشئ حساب الطبيب (البريد وكلمة المرور).
  من قائمة ⋯ يمكنك تغيير كلمة المرور أو إيقاف العيادة أو حذفها.
- **فتح عيادة:** المرضى وسجلهم (مع معاينة وطباعة الروشتات)، التقارير، الأدوية (إضافة وتعديل واستيراد من إكسل)، تصميم الطباعة، والإعدادات.
  كل تعديل يُحفظ على الإنترنت خلال ثانية (انظر شارة «تم حفظ كل التغييرات») ويصل لجهاز العيادة في المزامنة التالية.

</div>

---

# RxDesk user guide (English)

## 1. Install
1. Double-click **RxDesk-Setup-1.0.0.exe**. No administrator rights are needed.
2. If Windows shows "Windows protected your PC", click **More info → Run anyway**.
3. It installs in one step, adds **RxDesk** shortcuts to the Desktop and Start Menu, and opens the app.

RxDesk works completely offline. No data ever leaves the computer.

## 2. First start (setup wizard)
- Choose the language (Arabic / English).
- Enter the doctor's name in Arabic and English, specialty and license number.
- Enter the clinic name, address and phone numbers; optionally add a logo.
- Choose your paper: **A5**, **A4** or a custom size.
- Optional: a PIN code asked every time RxDesk opens.
- Optionally add 3 sample patients to try the app.

## 3. Writing a prescription (main screen)
1. Click **New prescription** (or F1 / Ctrl+N).
2. Type the patient's name or phone and press **Enter**. For a new patient click **New patient** and type the name
   and age.
3. Type the **diagnosis** (previous diagnoses are suggested).
4. **Medicines**: type the first letters and press **Enter** — the name, strength and usual dose are filled in from
   your own drug library. (How many boxes appear is set in Settings → Prescription screen.)
   - **Enter** moves to the next field; after the last field it goes to the next medicine.
   - **Dose phrases** (right side): click a phrase to put it in the selected medicine's dose.
   - **Templates**: click one (e.g. "Tinea treatment") to add all its medicines at once. Click ☆ to save the current
     medicines as a template.
   - If the patient is **allergic** to a medicine, a red warning appears (it does not block saving).
   - New drug names you type are added to your library automatically.
5. Add advice, lab tests and the next visit (quick buttons +3 / +7 / +14 days / +1 month).
6. Click **Save** (Ctrl+S) or **Print** (Ctrl+P). Printing saves the prescription first.
   - 👁 **Print preview** shows exactly what will be printed.
   - **PDF** saves it as a file.

## 4. Diagnoses and treatment suggestions
- Type the diagnosis in English, Arabic or as an ICD code (e.g. "tonsil", "لوز", "J03") and press **Enter**. You can add
  several diagnoses.
- Under the diagnosis, **Treatment suggestions** show ready options (first line, penicillin allergy, child dose…).
  Click **Add** to put their medicines into the prescription; advice and lab tests are filled if those boxes are empty.
- A red warning appears when an option contains a drug the patient is allergic to. For children, child options come
  first (doses are per kg — calculate them for the patient's weight).
- These are suggestions only; the doctor reviews every drug and dose. Edit the list in **Drugs & templates →
  Diagnoses** (edit, add your own, hide, or restore the built-in list).

### Dose dropdowns (amount · frequency · eye)
- Each medicine has the **drug name**, an **Amount** dropdown (قطرة واحدة, قطرتين, tablet…) and a **Frequency** dropdown
  (once, twice, 4 times daily, every 2 hours…).
- To add the **Eye** dropdown (right eye / left eye / both eyes): **Settings → Prescription screen → Dose**, switch on
  "Eye", or pick the **Eye clinic** preset.
- In the same place you can add or remove choices in any list (e.g. "كل 3 ساعات"). You can always type a value that is
  not in the list.
- It prints under the drug name as «قطرة واحدة — 4 مرات يومياً — العين اليمنى».

### Adding drugs from an Excel sheet
1. In **Drugs & templates → Drug library** click **Excel → Download empty template**.
2. Fill one drug per row: name, form, strength, dose, frequency, duration, route, instructions (only the name is
   required). Headers may be English or Arabic, in any order.
3. Click **Excel → Import from Excel** and pick the file. A preview shows how many drugs are new or will be updated;
   click **Import**.
4. Existing drugs are only updated in the cells you filled in; empty cells never erase anything.
5. **Excel → Export to Excel** saves your whole drug library as an Excel file.

## 5. Patients
- Search by name (any word order) or part of the phone number.
- Open a patient to see their details and every previous prescription:
  - 🖨 **Reprint** an old prescription exactly as it was.
  - **Repeat as new**: copies its medicines into a new prescription dated today.

## 6. Print designer
In **Print designer** you decide how the prescription looks on paper:
- The page is shown at its real size with millimetre rulers.
- **Drag** elements to move them; drag the small squares to resize. Arrow keys move 1 mm (Shift: 0.1 mm).
- Click an element to change its font, size, colour, alignment, direction and label text.
- Add elements from the list (doctor name, patient fields, medicines, QR code, text, line, rectangle…).
- **Medicines block**: numbered list or table, choose the columns. Long prescriptions continue on a second page
  automatically.
- **Pre-printed paper**: upload a scan/photo of your letterhead as the background to place fields exactly on it,
  and keep "Print the background" off.
- **Printer calibration**: if the print comes out shifted, print a **test page**, measure the shift with a ruler and
  enter it in X / Y.
- Ctrl+Z undo, Ctrl+Y redo, Ctrl+S save. Keep several layouts, choose the default one, and export a layout to a file
  to move it to another PC.

## 7. Settings
- **Prescription screen**: choose how the New prescription screen looks:
  - **Simple** (default): drug name + one "dose & instructions" line, and an advice box.
  - **Detailed**: every box (form, strength, frequency, duration, route, instructions) plus diagnosis, lab tests,
    next visit and the side panel.
  - Or tick exactly the boxes and parts you want. When a box is hidden, its usual value from your drug library is
    written into the dose line automatically.
  - Templates are in the **Templates** button at the top; previous prescriptions in the **Previous** button next to
    the patient's name.
- **Printing**: default printer, print directly without the dialog, number of copies.
- **Backup**:
  - **Backup now** and save it on a USB stick (recommended weekly).
  - Automatic daily backup (the last 14 are kept).
  - **Restore**: choose a backup file and confirm. Your current data is saved first.
- **Export to Excel**: patient list or prescriptions.
- **Password**: add, change or remove the PIN. The **Lock** button in the menu locks the app at once.
  ⚠️ A forgotten PIN can only be bypassed by restoring a backup made before the PIN was set — keep it somewhere safe.

## 8. Keyboard shortcuts
| Key | Action |
|---|---|
| Ctrl+N or F1 | New prescription |
| Ctrl+S | Save |
| Ctrl+P | Print |
| Ctrl+F or F2 | Find a patient |
| Enter | Next field |

## 9. Where is my data?
Everything is in `%APPDATA%\RxDesk` (Settings → About → Open data folder).
Uninstalling RxDesk **does not delete** your data, and reinstalling brings it back as it was.

## 10. Online sync (optional)
- RxDesk always works without internet. Online sync keeps a copy of the clinic's data online so the administrator can manage it from the RxDesk web app.
- **Turn it on:** Settings → **Online sync** → enter the e-mail and password the administrator gave you → **Sign in and sync**.
- From then on it syncs by itself: every 2 minutes, a few seconds after a change, and as soon as the internet is back. The cloud icon at the bottom of the sidebar shows the state.
- No internet? Keep working; changes wait and are sent when the connection returns.
- **New PC:** in the setup wizard click "Already have an online clinic account?" and sign in to download your data.
- Changes made online (new drugs, dose lists, prescription screen options, print layouts, clinic details) appear on your PC automatically.
- PIN, printer and backup folder never leave the PC. **Stop syncing** does not delete anything from the PC.

## 11. Admin web app (administrator only)
- Open the web app address and sign in with the administrator account.
- **Clinics:** every clinic with its last sync, patients and prescriptions. **New clinic** creates the doctor's login (e-mail + password).
  The ⋯ menu resets the password, disables or deletes a clinic.
- **Open a clinic:** patients and their history (preview / print prescriptions), reports, drug library (add, edit, Excel import), print designer and settings.
  Every change is saved online within a second (see the "All changes saved online" badge) and reaches the clinic PC on its next sync.
