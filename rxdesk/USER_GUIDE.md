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
4. في **الأدوية**: اكتب أول حروف الدواء واضغط **Enter** فيُكتب الاسم والتركيز والجرعة تلقائياً من مكتبتك.
   - **Enter** ينقلك للحقل التالي، وبعد آخر حقل ينتقل للدواء التالي.
   - **جمل الجرعات** على الجانب: اضغط على أي جملة لتضعها في جرعة الدواء المحدد.
   - **القوالب**: اضغط على قالب (مثل "Tinea treatment") لإضافة كل أدويته مرة واحدة. لحفظ الروشتة الحالية كقالب اضغط ☆.
   - إذا كان المريض لديه **حساسية** من الدواء يظهر تحذير أحمر (التحذير لا يمنع الحفظ).
   - أي دواء جديد تكتبه يُضاف لمكتبتك تلقائياً.
5. اكتب التعليمات والتحاليل المطلوبة وموعد الإعادة (أزرار سريعة: +3 / +7 / +14 يوماً / +1 شهر).
6. اضغط **حفظ** (Ctrl+S) أو **طباعة** (Ctrl+P). الطباعة تحفظ الروشتة تلقائياً.
   - 👁 **معاينة الطباعة** تعرض الورقة كما ستُطبع بالضبط.
   - **PDF** يحفظ الروشتة كملف.

## ٤. المرضى
- ابحث بالاسم (بأي ترتيب للكلمات، "احمد" تجد "أحمد") أو بجزء من رقم التليفون.
- افتح المريض لترى بياناته وكل روشتاته السابقة:
  - 🖨 **إعادة طباعة** روشتة قديمة كما هي.
  - **تكرار كروشتة جديدة**: ينسخ الأدوية في روشتة جديدة بتاريخ اليوم.

## ٥. تصميم الطباعة
من **تصميم الطباعة** تصمم شكل الروشتة على الورق:
- الصفحة معروضة بمقاسها الحقيقي مع مسطرة بالمليمتر.
- **اسحب** أي عنصر لتحريكه، واسحب المربعات الصغيرة لتغيير حجمه. الأسهم تحرك 1 مم (مع Shift: 0.1 مم).
- اضغط على عنصر لتغيير الخط والحجم واللون والمحاذاة والاتجاه ونص العنوان.
- أضف عناصر من القائمة (اسم الطبيب، المريض، الأدوية، QR، نص، خط، مستطيل…).
- **عنصر الأدوية**: قائمة مرقمة أو جدول، واختر الأعمدة. إذا زادت الأدوية تكمل الطباعة في صفحة ثانية تلقائياً.
- **ورق مطبوع مسبقاً**: ارفع صورة/سكان لورقتك كخلفية لتضع البيانات فوقها بالضبط، واترك "طباعة الخلفية" مقفلة.
- **ضبط الطابعة**: إذا خرجت الطباعة مُزاحة، اطبع **صفحة تجربة** وقِس الإزاحة بالمسطرة ثم اكتبها في X / Y.
- Ctrl+Z تراجع، Ctrl+Y إعادة، Ctrl+S حفظ. يمكنك حفظ أكثر من تصميم واختيار التصميم الافتراضي، وتصدير التصميم لملف لنقله لجهاز آخر.

## ٦. الإعدادات
- **الطباعة**: الطابعة الافتراضية، الطباعة المباشرة بدون نافذة، عدد النسخ.
- **النسخ الاحتياطي**:
  - **نسخة احتياطية الآن** واحفظها على فلاشة USB (يُنصح بذلك أسبوعياً).
  - نسخة تلقائية يومياً (يُحتفظ بآخر 14 نسخة).
  - **استرجاع**: اختر ملف النسخة ثم أكّد. يحفظ البرنامج نسخة من بياناتك الحالية قبل الاسترجاع.
- **تصدير إلى Excel**: قائمة المرضى أو الروشتات.
- **كلمة السر**: إضافة/تغيير/إلغاء الرقم السري. زر **قفل** في القائمة يقفل البرنامج فوراً.
  ⚠️ إذا نسيت الرقم السري لا يمكن فتحه إلا باسترجاع نسخة احتياطية قبل وضع الرقم — احتفظ به في مكان آمن.

## ٧. اختصارات لوحة المفاتيح
| المفتاح | الوظيفة |
|---|---|
| Ctrl+N أو F1 | روشتة جديدة |
| Ctrl+S | حفظ |
| Ctrl+P | طباعة |
| Ctrl+F أو F2 | البحث عن مريض |
| Enter | الحقل التالي |

## ٨. أين بياناتي؟
كل البيانات في المجلد `%APPDATA%\RxDesk` (الإعدادات ← عن البرنامج ← فتح مجلد البيانات).
إلغاء تثبيت البرنامج **لا يحذف** البيانات، وإعادة التثبيت تعيدها كما هي.

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
   your own drug library.
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

## 4. Patients
- Search by name (any word order) or part of the phone number.
- Open a patient to see their details and every previous prescription:
  - 🖨 **Reprint** an old prescription exactly as it was.
  - **Repeat as new**: copies its medicines into a new prescription dated today.

## 5. Print designer
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

## 6. Settings
- **Printing**: default printer, print directly without the dialog, number of copies.
- **Backup**:
  - **Backup now** and save it on a USB stick (recommended weekly).
  - Automatic daily backup (the last 14 are kept).
  - **Restore**: choose a backup file and confirm. Your current data is saved first.
- **Export to Excel**: patient list or prescriptions.
- **Password**: add, change or remove the PIN. The **Lock** button in the menu locks the app at once.
  ⚠️ A forgotten PIN can only be bypassed by restoring a backup made before the PIN was set — keep it somewhere safe.

## 7. Keyboard shortcuts
| Key | Action |
|---|---|
| Ctrl+N or F1 | New prescription |
| Ctrl+S | Save |
| Ctrl+P | Print |
| Ctrl+F or F2 | Find a patient |
| Enter | Next field |

## 8. Where is my data?
Everything is in `%APPDATA%\RxDesk` (Settings → About → Open data folder).
Uninstalling RxDesk **does not delete** your data, and reinstalling brings it back as it was.
