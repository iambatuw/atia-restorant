# Legacy platform, kullanıcı modeli ve gerçek POS entegrasyonu keşfi

## Kapsam ve güven sınırı

Bu inceleme `C:\Users\batuh\OneDrive\Masaüstü\atia` içindeki kaynak kod ve proje tanımlarının salt-okunur incelemesidir. Uygulama çalıştırılmadı, derleme/kurulum yapılmadı, veritabanına veya cihaza bağlanılmadı, ağ isteği gönderilmedi. Bağlantı ayarı dosyaları, kimlik bilgileri ve lisans sırları rapora alınmadı. Aşağıdaki kaynak yolları **legacy köküne göre relatif** verilmiştir. Masa/sipariş iş akışının ayrıntılı analizi kapsam dışıdır; restoran formları yalnızca giriş ve cihaz çağrı zincirini kanıtlamak için incelenmiştir.

Kanıt seviyeleri:
- **Kaynakta uygulanmış:** çalıştırılabilir metot/çağrı var; işletmede kullanıldığı anlamına gelmez.
- **Referans/altyapı:** proje referansı, DLL bildirimi veya model var; aktif restoran çağrısı ayrıca gösterilmedikçe entegrasyonun restoran akışında kullanıldığı kabul edilmez.
- **Doğrulanmamış:** gerçek kurulum, DB içeriği, cihaz, firmware, ağ ve saha davranışı.

## 1. Gerçek teknoloji ve sürüm

### Kesin kaynak bulguları

- Bu sürüm **C# Windows Forms, .NET Framework 4.5.2** masaüstü uygulamasıdır; ASP.NET Core projesi veya modern .NET web uygulaması değildir. Restoran giriş projesi `WinExe`, `v4.5.2` ve `System.Windows.Forms` referansına sahiptir (`AtiaMiniApps/AtiaRestorant/AtiaRestorant.csproj:7-12,97-106`). Ana `Atia` da `WinExe`, `v4.5.2` hedefler (`Atia/Atia.csproj:8-12`).
- Restoran projesi küçük bir başlangıç kabuğudur: `Main`, `DataHelper.BuildStaticString()` sonrasında doğrudan `Atia.Restorant.frmRestorantMasaDuzeni` açar (`AtiaMiniApps/AtiaRestorant/Program.cs:361-370`). Restoran ekranları ayrı bir web/frontend projesinde değil, ana `Atia` masaüstü uygulamasında yaşar.
- DevExpress **21.2.5.0** referansları vardır; yalnızca “eski DevExpress” demek yerine bu proje referansı sürümü kullanılmalıdır (`AtiaMiniApps/AtiaRestorant/AtiaRestorant.csproj:79-83`). DLL referans sürümü gerçek kurulu lisans veya çalışan makinenin sürümünü kanıtlamaz.
- Kaynak assembly sürümü restoran ve ana uygulama için **1.0.0.0** olarak sabitlenmiştir (`AtiaMiniApps/AtiaRestorant/Properties/AssemblyInfo.cs:35-36`; `Atia/Properties/AssemblyInfo.cs:35-36`). ClickOnce yayın sürümü ise `1.0.0.*` şablonudur (`AtiaMiniApps/AtiaRestorant/AtiaRestorant.csproj:25-29`). Bunlardan sahadaki ticari ürün sürümü veya son yayın tarihi çıkarılamaz.
- Çözüm Visual Studio 16 biçimindedir. `Atia`, `AtiaDataAccess`, `AtiaHelpers`, `AtiaBusiness`, `AtiaComponents` ve mini uygulamaların yanında servis, transfer, updater, generator ve test projeleri de listelenir (`AtiaErp.sln:2-33`). Ancak dosya ağacında yalnızca dokuz `.csproj` bulundu: çözümün işaret ettiği `AtiaTransfer`, `AtiaService`, `AppUpdader`, `OrmGenerator`, `AtiaDataService`, `AtiaTests` proje dosyaları mevcut ağaçta bulunamadı. Bu nedenle teslim edilen klasörün eksiksiz/derlenebilir çözüm olduğu varsayılmamalıdır. Restoranın mevcut olmayan `AtiaService` projesine de referansı vardır (`AtiaMiniApps/AtiaRestorant/AtiaRestorant.csproj:154-157`).

### Katmanlar ve taşınabilirlik

- Restoran başlangıç projesi Business, Components, DataAccess, Helpers, Service ve ana Atia projelerine referans verir (`AtiaMiniApps/AtiaRestorant/AtiaRestorant.csproj:138-161`). Bu bağımlılıklar kaynak düzeyinde katman isimleri olduğunu gösterir; UI'dan bağımsız, doğrudan ASP.NET Core'a taşınabilen temiz bir domain katmanı olduğunu göstermez.
- İki veri erişim yolu birlikte bulunur: LINQ-to-SQL `AtiaRepositoryDataContext : System.Data.Linq.DataContext` (`AtiaDataAccess/AtiaRepository.designer.cs:26`) ve `SqlConnection`/Dapper kullanan `NativeProvider` (`AtiaBusiness/Providers/NativeProvider.cs:85-106,283-306`). `ProviderBase` doğrudan DataContext oluşturur (`AtiaBusiness/Providers/Base/ProviderBase.cs:30-41`). SQL Server istemcisi ve ortak DB üzerinden çalışma mimarisi kaynakta vardır; gerçek SQL Server sürümü, instance, edition, bağlantı topolojisi ve şema seviyesi doğrulanmadı.
- `System.Web.HttpContext` uyumluluk dalı bulunması uygulamayı web ürünü yapmaz: SessionManager web bağlamı varsa ASP.NET Session, yoksa process singleton kullanır (`AtiaBusiness/Managers/SessionManager.cs:135-149`). Thinfinity VirtualUI dosyaları derleme listesinde olsa da ana programdaki başlatma satırı yorumdadır (`Atia/Atia.csproj:613-614`; `Atia/Program.cs:410`). Bu, çalışan native web arayüzünün kanıtı değildir.

## 2. Tek kullanıcı mı, çok kullanıcı mı? Şirket, şube, yetki ve lisans

### Kaynakta çok kullanıcı/çok şirket yeteneği var

- Kullanıcı ve şirket listeleri yüklenir; giriş, kullanıcı-şirket üyeliğini `SirketKullanici` üzerinden kontrol eder ve seçilen kullanıcı/şirket için parolayı karşılaştırır (`AtiaBusiness/Providers/MetaObjectsProvider.cs:30-64`). Üyelik modelinde ayrı `SirketKayitNo` ve `KullaniciKayitNo` alanları vardır (`AtiaDataAccess/Dapper/SirketKullanici.cs:34-51`).
- Oturum `UserId`, `CompanyId`, aktif dönem ve yetki listesini taşır (`AtiaBusiness/Managers/SessionManager.cs:15-36`). Login seçilen şirketin aktif dönemini bulur, yoksa oluşturur ve kullanıcı yetkilerini oturuma alır (`Atia/MainForms/frmLogin.cs:175-205`). Ayarlar şirket bazlı; kullanıcı ayarları şirket+kullanıcı bazlı yüklenir (`AtiaBusiness/Providers/NativeProvider.cs:283-306`).
- Yetki modeli modül, öğe ve bitmask erişim hakkına dayanır. Yetki listesi `null` ise kontrol `true` döndürebilir; yeni web authorization tasarımına bu permissive varsayılan körlemesine taşınmamalıdır (`AtiaBusiness/Managers/SessionManager.cs:79-101`). Kullanıcı kartında yönetici bayrağı, kasa ve depo atamaları bulunur (`AtiaDataAccess/Dapper/KullaniciKarti.cs:105-152`).
- Restoran başlangıç ekranı oturum yoksa ortak login formunu gösterir (`Atia/Restorant/frmRestorantMasaDuzeni.cs:47-65`). Yani mini uygulama giriş ekranını atlıyor görünse bile gerçek giriş kontrolü form içindedir.

**Önemli ayrım:** Bunlar işletmenin fiilen birden çok kullanıcı, eşzamanlı terminal veya birden çok şube kullandığını kanıtlamaz. İncelenen şirket/depo modellerinden bağımsız bir restoran şubesi/tenant sözleşmesi doğrulanmadı. “Birden çok şirket” ile “şube yönetimi” aynı şey sayılmamalıdır. Gerçek şirket, kullanıcı, depo, kasa sayıları ve eşzamanlı oturum sayısı DB/saha doğrulamasıdır.

### Web'e taşırken kimlik ve oturum kararları

- Masaüstünde oturum process singleton'dır; web dalı eski `System.Web` session'ıdır (`AtiaBusiness/Managers/SessionManager.cs:135-149`). Bu singleton'ın ASP.NET Core sunucuda ortak servis olarak korunması kullanıcılar arasında veri sızıntısı yaratabilir. Yeni sistemde request/user-scoped kimlik, şirket ve dönem bağlamı gerekir; bu bir geçiş önerisidir, mevcut web uygulaması bulgusu değildir.
- Parola kontrolü `string.Equals(u.Sifre, userPassword)` kullanır; bu yolda parola hash doğrulayıcısı görülmedi (`AtiaBusiness/Providers/MetaObjectsProvider.cs:60-64`). Remember-me akışı girilen parolayı registry yardımcı metoduna verir (`Atia/MainForms/frmLogin.cs:251-257`); autologin aynı alanı geri okur (`Atia/MainForms/frmLogin.cs:87-97`). Gerçek parola değerleri incelenmedi. Web geçişinde güvenli parola hash'i, gerekirse zorunlu parola yenileme ve güvenli cookie/session tasarımı ayrı iş olmalıdır.
- Kullanıcıya bağlı POS modeli/IP/port ataması vardır (`AtiaDataAccess/Dapper/KullaniciKarti.cs:375-432`). Web'de “kullanıcı = fiziksel terminal” eşitliği korunacak mı, yoksa workstation/device atamasına ayrılacak mı açıkça kararlaştırılmalıdır.

### Lisans ve eşzamanlı terminal sınırı

- Lisans kodu DB'den okunup deserialize edilir; lisans kullanıcı sayısı ve modül alanlarını taşır (`AtiaBusiness/Managers/AtiaLicenseManager.cs:33-44,155-162,378-386`). `Validate` CPU, anakart ve disk kimliklerini karşılaştırır (`AtiaBusiness/Managers/AtiaLicenseManager.cs:415-429`). Bu makineye bağlı masaüstü lisans tasarımıdır, cloud/web lisans tasarımı değildir.
- Login `Validate()` çağırır fakat dönüş değerini şart olarak kullanmaz (`Atia/MainForms/frmLogin.cs:130-132`). Aynı metottaki lisans aktivasyonu, `AktifClient` sayısı ve terminal kaydıyla kullanıcı limiti kontrolü bloğu yorumdadır (`Atia/MainForms/frmLogin.cs:134-173`). Dolayısıyla bu login yolunda aktif bir eşzamanlı kullanıcı limiti olduğunu söylemek doğru değildir; çözüm genelindeki diğer kontroller ve gerçek lisans hakkı ayrıca doğrulanmalıdır.
- Çok kullanıcılı yetenek korunmalı, fakat ilk teslimatta çok şube yönetimi veya fiilen kullanılmayan karmaşık lisans davranışı otomatik kapsam yapılmamalıdır. İşletme tek kasayla çalışıyorsa UI sade olabilir; veri ve yetki modeli bilinçsizce tek kullanıcıya indirgenmemelidir.

## 3. POS: banka kaydı ile gerçek cihaz iletişimi ayrımı

### Banka/POS kartı seçimi tek başına terminal entegrasyonu değildir

Ödeme formu `BankaPosDetay` listesini yükler ve ödeme kaydına banka hesabı/POS detay kayıt numarasını aktarır (`Atia/Restorant/frmOdemeIslemleri.cs:1383,502-508`). Cihaz çağrıları ise ayrıca `chkPosYazdir.Checked` içinde koşulludur; bu kutu seçili değilken de kart ödeme kaydı oluşturulabilir (`Atia/Restorant/frmOdemeIslemleri.cs:435-509`). Bu yüzden “kartla ödendi kaydı” bankadan onay alınmış olduğunun kanıtı değildir.

### Restoran akışında gerçekten çağrılan entegrasyonlar

| Entegrasyon | Protokol / SDK kanıtı | Restoran bağlantısı ve sınır |
|---|---|---|
| PayGo | `PCPOSOKC.dll` için ayrı x86/x64 P/Invoke; GMP3 istek/yanıt yapıları. Bağlantı tipi RS232 veya TCPIP seçilir (`Atia/PosCommunication/PayGoDLL/DLL.cs:145-188`; `Atia/PosCommunication/PaygoPOS.cs:199-209`). | Factory'de model 1; restoran ödeme formu tip 1 için masa ekranının `PosOdeme` metodunu çağırır, bu metot gerçek `KrediKartiOdeme`/`NakitOdeme` çağrısına gider (`Atia/PosCommunication/Pos.cs:24-50`; `Atia/Restorant/frmOdemeIslemleri.cs:440-454`; `Atia/Restorant/frmRestorantMasaDuzeni.cs:478-499`). Kesin fiziksel PayGo model numarası bu kaynak zincirinden doğrulanmadı. |
| Hugin klasik (kaynak yorumlarında T300) | `Hugin.POS.CompactPrinter.FP300`, Hugin Common/GMPCommon/DiffieHellman referansları; `CompactPrinter`, fiscal ID ve eşleştirme; aktif bağlantı TCP soketidir (`Atia/Atia.csproj:267-281`; `Atia/PosCommunication/HuginPOS.cs:108-184,207-234`). | Restoran tip 2 dalı `KrediKartliOdeme` çağırır (`Atia/Restorant/frmOdemeIslemleri.cs:457-487`); sürücü `GetEFTAuthorisation` çağırır (`Atia/PosCommunication/HuginPOS.cs:383-393`). FP300 namespace'inden işletmedeki kesin model/firmware çıkarılamaz. |
| Hugin S1 | Yönetilen `HttpClient` + JSON, `https://{ip}:{port}/v1`; `/settings`, `/documents`, `/payments/EFT_POS` uçları (`Atia/PosCommunication/HuginS1/HuginS1POS.cs:65-101,137-195,453-519,560-584`). Adapter varsayılan portu 4443'tür; adres/port kullanıcı kartından gelir (`Atia/PosCommunication/HuginS1/HuginS1Adapter.cs:35-64`). | Factory model 3 adapter oluşturur; restoran tip 3 dalı `HuginS1OdemeYap`, bağlantı ve gerçek kart/nakit işlemlerini çağırır (`Atia/PosCommunication/Pos.cs:45-50`; `Atia/Restorant/frmOdemeIslemleri.cs:184-211,489-493`). Kart ve QR ayrımı da uygulanmıştır. Saha bağlantısı doğrulanmadı. |
| Pidion | `BmsSdkDLL.BmsDll4GMP3`, `GMP3Coupling`, `Serv`; gerçek `connect`, `payWithBankCard`, `voidLastPayment`, `cancelFR` metotları vardır (`Atia/PosCommunication/PidionPOS.cs:4-11,120-157,194-230`). | Factory model 0 bunu döndürebilir (`Atia/PosCommunication/Pos.cs:24-50`). Ancak incelenen ana restoran ödeme dallarında açık tip kontrolleri 1/2/3'tür (`Atia/Restorant/frmOdemeIslemleri.cs:440-493`). Factory/DLL varlığından Pidion'un bu restoran ekranında uçtan uca desteklendiği söylenmemelidir. |

Ayrıca restoran projesindeki `BankCommPC`, `BmsDll4GMP3`, `GMP3Library`, `Serv` DLL referansları bağımlılık kanıtıdır; tek başına canlı banka veya cihaz bağlantısı kanıtı değildir (`AtiaMiniApps/AtiaRestorant/AtiaRestorant.csproj:71-96`).

### Etkinleştirme koşulları ve tutarsızlık riski

- Factory cihazı kullanıcı kartındaki `HizliSatisPosKullanimi` ve `PosTipi` ile seçer (`Atia/PosCommunication/Pos.cs:42-57`). Buna karşılık ödeme formunun dalları şirket ayarındaki `HizliSatisPosTipi` ile seçilir (`Atia/Restorant/frmOdemeIslemleri.cs:440-493`). İki ayarın aynı cihazı gösterdiği DB'de doğrulanmalıdır.
- Restoran POS kullanım yardımcı kontrolü kullanıcı POS bayrağı, yönetici ve restoran POS ayarına bakar (`Atia/PosCommunication/Pos.cs:95-108`). Ödeme ekranındaki POS kutusu restoran POS kullanımı veya yönetici kapalıysa gizlenir; varsayılan seçilme ayrıca ayarlanır (`Atia/Restorant/frmOdemeIslemleri.cs:1411-1414`). Bu koşullar kaynakta vardır; gerçek ayar değerleri incelenmedi.
- PayGo eşleştirmesi uygulama dizinindeki yerel JSON dosyasına bağlıdır; eşleşme yoksa hata verir ve servis menüsünde USB/Ethernet seçimi ister (`Atia/PosCommunication/PaygoPOS.cs:23,178-239`). Dosya içeriği ve bağlantı sırları okunmadı.

## 4. Başarı, hata, tekrar deneme, iptal ve iade semantiği

### Hugin S1

- HTTP istemcisi varsayılan **90 saniye** timeout kullanır; QR ödeme çağrısında **120 saniyeye** çıkarılıp geri alınır. Ağ çağrıları `.Result` ile senkron beklenir (`Atia/PosCommunication/HuginS1/HuginS1POS.cs:65-68,552-565,791-847`).
- Kart akışı önce EFT_POS ödemesini alır, sonra belgeyi PUT ile sonlandırır. Ödeme başarılı fakat belge kapanışı başarısız olabilir. Kaynak bunu `_sonKartOdemeAlindi` ile ayırır ve bu durumda iptal etmemeyi amaçlar (`Atia/PosCommunication/HuginS1/HuginS1POS.cs:453-519`; `Atia/PosCommunication/HuginS1/HuginS1Adapter.cs:294-314`).
- Belge sonlandırma en fazla 5 deneme yapar; ödeme alınmışsa `/resume` ve PUT tekrarları, 800/1000 ms beklemeleri vardır. HTTP 206/authorization/eftPayment alanları dikkate alınır (`Atia/PosCommunication/HuginS1/HuginS1POS.cs:597-664`). Bu, yeni bir kart tahsilatını tekrar etmekle aynı işlem değildir.
- Restoran UI'si sonuç 1 değilse kartın alınamadığını ve fişin iptal edildiğini söyleyip nakit tekrarını teklif eder (`Atia/Restorant/frmOdemeIslemleri.cs:223-237`). Bu mesaj yukarıdaki “kart alındı, belge kapanmadı, iptal edilmedi” durumunu ayırmıyor. Web'de tek bir başarılı/başarısız bool yerine **ödeme alındı / belge tamamlandı / sonuç belirsiz / manuel mutabakat gerekli** durumları korunmalıdır; aksi halde tekrar tahsilat veya yanlış kasa kaydı riski vardır.
- Parçalı nakit+kart iki ayrı ardışık belge üretir; sürücü 1=tümü başarılı, 0=nakit başarısız, 2=nakit başarılı kart başarısız döndürür (`Atia/PosCommunication/HuginS1/HuginS1POS.cs:666-713`). UI kodu 2 için yalnız kart tekrarını önerir, fakat sonuç sonunda 1/0'a indirgenir (`Atia/Restorant/frmOdemeIslemleri.cs:243-277`).
- Belge iptali önce belge durumunu sorgular; CLOSED/CANCELLED ise atlar, değilse cancel gönderip 10 kez 500 ms aralıkla sorgular. “5 saniye” yalnız bekleme toplamıdır; HTTP çağrıları ayrıca timeout bekleyebilir. Sonunda açık belge kimliği temizlenir (`Atia/PosCommunication/HuginS1/HuginS1POS.cs:716-788`). Bu işlem **kapanmış banka tahsilatına refund garantisi değildir**.
- Z raporu gereksinimi hata koduyla gelirse otomatik Z raporu isteği ve tekrar belge açılışı vardır (`Atia/PosCommunication/HuginS1/HuginS1POS.cs:154-190`). Nakit/indirimli belge gönderiminde alternatif gövdeler ve başka açık belgeyi iptal edip yeni belge açma kurtarması vardır (`Atia/PosCommunication/HuginS1/HuginS1POS.cs:262-404`). Yeni sistemde bu yan etkiler açık iş kuralı ve yetki gerektirir.
- S1 kurucusu global TLS sertifika doğrulamasını her sertifikayı kabul edecek şekilde değiştirir (`Atia/PosCommunication/HuginS1/HuginS1POS.cs:46-52`). Bu davranış yeni web backend'e taşınmamalı; cihaz sertifikası güven/pinning yaklaşımı vendor ile doğrulanmalıdır.

### PayGo

- Standart komut yolu DF6F hata kodunda exception üretir, internal hata kodunu UI'ya gösterir; 1 saniyelik keep-alive timer bulunur (`Atia/PosCommunication/PaygoPOS.cs:31-45,115-167`).
- Aktif `OdemeYap` ayrı background thread'de `SendCmdToDevice` çağırır, **yalnızca 1 saniye uyuyup** ping sonrası yanıt alanlarını değerlendirir; thread completion/join veya tamamlanana kadar bekleyen uygulama-level timeout burada yoktur. Başarı koşulunda boş internal hata da başarılı kabul edilebilen `OR` ifadesi vardır (`Atia/PosCommunication/PaygoPOS.cs:454-517`). Bu nedenle banka onayının güvenilir şekilde tamamlandığı varsayımı saha/SDK testleri olmadan kurulamaz; yeni ödeme durum makinesine aynen kopyalanmamalıdır.
- PayGo ortak interface ödeme başarı kodu 0; kart başarısız kodu 5'tir. `SonOdemeyiIptalEt` hiçbir işlem yapmaz ve otomatik iptal olduğu yorumuna dayanır (`Atia/PosCommunication/PaygoPOS.cs:618-636`). `FisIptal` DoTran/AA gönderir, `FisKapat` cihaz durumunu ping ile kontrol edip açık/ödemesi bitmemiş belgeyi iptal edebilir (`Atia/PosCommunication/PaygoPOS.cs:536-548,880-907`). Bunlar kapanmış işlemin bankacılık refund implementasyonu olarak yorumlanmamalıdır.

### Hugin klasik ve Pidion

- Hugin TCP receive timeout **4500 ms** olarak ayarlanır; burada connect/send için eşdeğer açık timeout görülmedi (`Atia/PosCommunication/HuginConnection.cs:213-221`). Restoran UI kart başarısızlığında kullanıcıya tekrar sorar; iptal `VoidReceipt`, kapatma `CloseReceipt` kullanır (`Atia/Restorant/frmOdemeIslemleri.cs:466-479`; `Atia/PosCommunication/HuginPOS.cs:297-331`). `SonOdemeyiIptalEt` NotImplementedException fırlatır (`Atia/PosCommunication/HuginPOS.cs:663-665`).
- Pidion kart ödemesinde SDK dönüşünü verir, exception yutar ve varsayılan -1 döndürür; void/cancel çağrıları da exception yutar (`Atia/PosCommunication/PidionPOS.cs:194-230`). SDK iç timeout ve gerçek bankacılık ters işlem davranışı kaynak wrapper'dan belirlenemez.
- Ortak `Pos` interface'i tek tip başarı kodu sözleşmesi sağlamaz: PayGo 0, S1/Hugin özel akışları 1 başarı kullanır. Vendor adaptörleri için normalize edilmiş durum modeli gerekir; mevcut return değerleri birleşik API cevabı sayılmamalıdır (`Atia/PosCommunication/Pos.cs:4-20`; `Atia/PosCommunication/PaygoPOS.cs:618-625`; `Atia/PosCommunication/HuginS1/HuginS1Adapter.cs:387-401`).
- İncelenen aktif restoran/adaptör zincirinde geçmişte kapanmış tahsilatı referans numarasıyla iade eden, mutabakatı tamamlayan **ayrı bir refund akışı doğrulanmadı**. Cancel/void metotları ve muhasebe iade kaydı gerçek banka refund'undan ayrılmalıdır. Bu cümle tüm ERP kaynaklarında hiç iade kodu bulunmadığı iddiası değildir.

## 5. Yazıcılar, mali cihazlar ve yerel kurulum bağımlılıkları

- Restoran yazıcı test ekranı `PrinterSettings.InstalledPrinters` listesini alır ve seçilen yazıcıya Print çağırır (`Atia/Restorant/frmYaziciSina.cs:27-32`). Bu Windows kurulu yazıcı kuyruğu bağımlılığıdır; kesin üretici/model veya fiziksel USB/LAN bağlantısı kanıtı değildir.
- Rapor yazdırma dosya sistemindeki `Ayarlar/AksRapor` altındaki tasarıma bağlıdır; printerName ile rapor nesnesine gider (`AtiaHelpers/Reporting/ReportManager.cs:349-368`). Son noktada DevExpress raporunun `Print(printerName)` veya varsayılan `Print()` çağrısı vardır (`AtiaHelpers/Reporting/Rapor.cs:266-284`). Restoran kaynaklarında stok grubuna göre yazıcı veya varsayılan restoran yazıcısı seçimi bulunur (`Atia/Restorant/frmSiparisOdeme.cs:1292-1293,1427-1433`). Yazıcıya iş verilmesi fiziksel kağıt çıkışını onaylamaz.
- Hugin klasik/S1 yalnız ödeme cihazı değildir: mali belge, KDV/departman, fiş ve Z raporu davranışları da içerir. Hugin klasik departman eşlemesini uygulama dizinine JSON olarak yazar (`Atia/PosCommunication/HuginPOS.cs:238-258`); S1 ayarlardan departman alır ve yerelden yükleme yapar (`Atia/PosCommunication/HuginS1/HuginS1POS.cs:27-28,70-71,95-100`).
- Caller-ID için ActiveX/COM wrapper ve x86 interop bağımlılığı vardır (`AtiaMiniApps/AtiaRestorant/AtiaRestorant.csproj:67-70,88-92`). Restoran ana ekranı restoran Caller-ID formunu açabilir (`Atia/Restorant/frmRestorantMasaDuzeni.cs:2109-2112`); ilgili form ayar açıksa `axCIDv51.Start()` çağırır (`Atia/RestoranCallerId/frmCallerId.cs:386-391`). Fiziksel cihaz/COM kayıt durumu bilinmiyor; browser'a doğrudan taşınabilir kabul edilmemeli.
- Restoran Release AnyCPU + Prefer32Bit=true, Debug ise Prefer32Bit=false'dur (`AtiaMiniApps/AtiaRestorant/AtiaRestorant.csproj:31-39,56-64`). PayGo'da native x86/x64 DLL ayrımı, Caller-ID'de x86 COM bileşeni vardır. Sunucu/connector proses bitliği ve vendor SDK uyumluluğu ayrı doğrulama gerektirir.
- Proje bazı referansları `bin/Debug` veya kaynak ağacının dışındaki DLL klasörlerinden alır (`AtiaMiniApps/AtiaRestorant/AtiaRestorant.csproj:67-96`; `Atia/Atia.csproj:81-92,267-281`). Bunlar tekrar üretilebilir build, dağıtım, SDK edinme/lisans ve DLL kopyalama gerekliliklerini netleştirmeden modernizasyon takvimine güvenilemeyeceğini gösterir.

## 6. C# web modernizasyonu için karar girdileri

Aşağıdakiler öneridir; kurulu işletme topolojisi bulgusu değildir.

1. **Backend C# olarak kalabilir**, fakat ASP.NET Core geçişi csproj hedefini değiştirmekten ibaret değildir. WinForms/DevExpress, LINQ-to-SQL/System.Web, singleton session, yerel dosya/registry/COM/native DLL bağımlılıkları ayrılmalıdır. SQL Server veri sözleşmesi kontrollü korunabilir; şema ve veri kalitesi ayrıca doğrulanmalıdır.
2. **Tek kasa ile başlayıp çok kullanıcı yeteneğini korumak** mümkündür. Yetkiler, kullanıcı-şirket üyeliği, işlem yapan kullanıcı ve şirket/dönem bağlamını kaybetmemek gerekir. Şube topolojisi işletmeyle kararlaştırılmadan multi-tenant SaaS veya çok şube çözümü zorunlu kabul edilmemelidir.
3. **S1 için yalnızca sunucu/LAN iletişimi teknik olarak makul bir adaydır:** kaynak HTTPS/IP API kullanır; backend aynı cihaz LAN'ına erişebiliyorsa browser-native DLL gerekmez. Ancak gerçek cihaz PC Link yetkisi, pairing/hardware kimliği, aynı anda bağlantı sayısı, TLS ve vendor desteği doğrulanmadan “cloud sunucu cihazı doğrudan yönetebilir” denilemez. Cihazı internete açmak önerilmez.
4. **PayGo ve Windows yazdırma/Caller-ID korunacaksa yerel Windows connector güçlü adaydır:** serial/native DLL, kurulu Windows printer queue ve COM erişimini browser değil yerel servis/ajan üstlenir. Hugin klasik SDK da aynı connector içinde izole edilebilir. On-prem Windows sunucu cihazlara ve yazıcılara gerçekten erişiyorsa tek LAN connector/server yeterli olabilir; her workstation'a ajan şart değildir.
5. **Cloud web backend seçilirse** restoran LAN'ındaki güvenli connector'dan dışarı yönlü kimlikli bağlantı; terminal başına seri hale getirilmiş işlem kuyruğu; payment attempt/document id ve cihaz kimliğiyle kalıcı journal; timeout sonrası durum sorgusu; onaylı fakat belge kapanmamış durum için mutabakat iş akışı tasarlanmalıdır. Bunlar mevcut kodda dayanıklı dağıtık ödeme garantisi bulunduğu anlamına gelmez.
6. **Kart muhasebe kaydı ile cihaz tahsilatını ayrı durumlarda tutun.** Manuel harici POS kullanımı desteklenecekse kullanıcı bunu açıkça seçmeli; otomatik terminal işleminde success doğrulanmadan aynı görsel/muhasebesel sonuç üretilmemelidir. Fiziksel cihazdaki işlem sonucu bilinmiyorsa otomatik yeni kart/nakit tahsilatı yerine doğrulama gerekir.
7. Fiscal belge, normal mutfak/adisyon çıktısı ve banka slip'i ayrı çıktı tipleridir. Her biri için tasarım, yazıcı yönlendirme, kopya sayısı, yeniden yazdırma ve hata politikasını belirleyin; DevExpress Print dönüşü fiziksel çıktı teyidi yerine geçmez.

## 7. Saha/DB doğrulaması olmadan açık kalanlar

- Çalışan EXE/build, son yayın ve eksik solution projelerinin gerçek kaynakları; DevExpress/vendor SDK lisansları ve dağıtım hakları.
- Gerçek SQL Server sürümü/şeması; kullanıcı, şirket, kasa, depo, terminal ve eşzamanlı bağlantı sayıları; bunların hangilerinin aktif kullanıldığı.
- İşletme gerçekten tek kullanıcı/tek terminal mi, aynı kullanıcı birden çok terminalde mi kullanılıyor; yönetici/garson yetkileri ve şube kavramının gerçek karşılığı.
- Aktif POS üretici/model/seri ve firmware; bankalar/acquirer; seçili kullanıcı ve şirket POS tipleri; fiziksel serial/USB/LAN topolojisi; pairing ve yetkili entegratör şartları. Bu rapor bu değerleri çıkarmadı.
- PayGo ödeme thread'inin gerçek SDK davranışı, timeout/cihaz kopması sonrası sonuç sorgusu; S1 ödeme başarılı-belge başarısız senaryosu; tekrarın idempotency garantisi.
- Void, belge iptali, banka reversal ve sonradan refund yetenekleri; manuel ödeme/iade prosedürü ve gün sonu mutabakatı.
- Yazıcı marka/model, Windows kuyruk isimleri/sürücüleri, kesici/çekmece özellikleri ve Caller-ID cihazı. Kaynakta kuyruk seçimi olması gerçek bağlı yazıcıyı kanıtlamaz.

**Sonuç:** İncelenen eski masaüstü kaynaklarında gerçek terminal iletişimi uygulanmıştır; yalnızca “kart ödeme kaydı” değildir. Bu ifade yeni web demosunda POS entegrasyonu bulunduğu anlamına gelmez. Özellikle PayGo, Hugin klasik ve Hugin S1 için restoran kaynaklarından cihaz metoduna giden koşullu çağrı zincirleri vardır. Bununla birlikte hangi cihazın işletmede gerçekten bağlı/kullanılıyor olduğu, çok kullanıcının fiilen kullanımı ve güvenilir ödeme mutabakatı yalnız kaynak incelemesiyle doğrulanamaz.
