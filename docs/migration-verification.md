# Web geçişi doğrulama planı

Tarih: 6 Kasım 2026. Durum: analiz ve kabul ölçütleri; canlı geçiş onayı değildir.

## Kanıt düzeyleri

Her özellik aşağıdaki düzeylerle ayrı kaydedilir:

- **Kaynak:** eski uygulamada çağrı zinciri ve veri etkileri görüldü; gerçek işletmede kullanıldığını tek başına kanıtlamaz.
- **Yerel:** yeni web uygulamasının otomatik testi veya tarayıcı senaryosu geçti.
- **Test SQL:** gerçek şemanın anonimleştirilmiş/kontrollü kopyasında işlem ve geri alma doğrulandı.
- **Cihaz:** ilgili marka/model/SDK ve test hesabıyla fiziksel cihaz davranışı doğrulandı.
- **İşletme:** yetkili kullanıcıyla işlem sonuçları, mali kayıtlar ve gün sonu mutabakatı kabul edildi.

Bir alt düzeydeki başarı üst düzey başarı gibi sunulmaz. Özellikle sahte POS adaptörüyle başarılı test, gerçek cihaz entegrasyonu değildir.

## Mevcut kanıt sınırı

Demo ASP.NET Core 10 ve React ile çalışıyor. `VERIFICATION.md` içindeki 7 ön yüz ve 14 API testi önceki demo kapsamını doğruluyor; legacy ERP paritesini doğrulamıyor. Veri API belleğinde; yeniden başlatmada sıfırlanıyor. Gerçek SQL, cihaz, üretim kullanıcıları ve muhasebe doğrulanmadı.

Platform/POS ve restoran iş akışı kaynak incelemeleri tamamlandı; ayrıntıları [legacy-platform-pos.md](legacy-platform-pos.md) ve [legacy-workflows.md](legacy-workflows.md) belgelerindedir. Temel platform, kullanıcı-şirket kontrolü, restoran ödeme dalları, masa/adisyon yaşam döngüsü, kısmi ödemeler, masa taşıma/ayırma/toplama/birleştirme farkları ve dört kritik kaynak hatası bağımsız olarak doğrulandı. Saha/DB/fiziksel cihaz doğrulaması ise henüz yapılmadı (canlı erişim yok).

### Doğrulanmış platform, POS ve iş akışı girdileri

- Restoran giriş projesi **C# WinForms / .NET Framework 4.5.2**; `AtiaMiniApps/AtiaRestorant/AtiaRestorant.csproj:8-12`. Proje DevExpress 21.2.5 referansları kullanıyor. Bu bir ASP.NET sürüm yükseltmesi değil, masaüstü bağımlılıklarını ayıran web modernizasyonudur.
- Kaynakta kullanıcı-şirket üyeliği kontrolü var (`AtiaBusiness/Providers/MetaObjectsProvider.cs:53-65`). Fiili kullanıcı sayısı ve şube düzeni doğrulanmadı; tek kullanıcıya zorla indirgeme veya çok şubeli SaaS dayatma yok.
- Restoran açık hesabı basit sipariş değil, **ERP stok perakende satış belgesi** (`StokFisBaslik` + `StokFisDetay`) ve cari/kasa/banka hareketleridir (`frmSiparisOdeme.cs:155-241`).
- Restoran ödeme formunda **PayGo, Hugin klasik ve Hugin S1** cihaz dalları var (`Atia/Restorant/frmOdemeIslemleri.cs:435-493`). Hangisinin işletmede bağlı/aktif olduğu bilinmiyor. Pidion factory/SDK desteği, aynı restoran ekranında doğrulanmış uçtan uca entegrasyon olarak sayılmıyor.
- Kart muhasebe kaydı cihaz çağrısından sonra ama POS kutusunun dışında oluşturulabiliyor (`frmOdemeIslemleri.cs:435-509`). Bu yüzden manuel harici POS kaydı ile entegre cihaz işlemi yeni sistemde farklı ve açık olmalı.
- **S1 kritik hata senaryosu:** cihaz kart ödemesi alındıktan sonra belge sonlandırılamazsa sürücü 0 döndürüyor; adapter bu durumda belgeyi iptal etmiyor (`HuginS1POS.cs:453-519`, `HuginS1Adapter.cs:294-314,370-401`). Restoran UI'si ise aynı sonuç için kartın alınamadığını/fişin iptal edildiğini söyleyip nakit tekrarını teklif ediyor (`frmOdemeIslemleri.cs:223-237`). Bu, kaynakta doğrulanmış bir sonuç-modeli uyumsuzluğudur; sahada gerçekten ikinci tahsilat yaşandığı iddia edilmez. Yeni web'de onay/fiş kapanışı/belirsiz sonuç ayrılmadan cihaz desteği açılmaz.
- **PayGo kritik hata senaryosu:** ödeme SDK çağrısı background thread'de; çağıran kod 1 saniye bekleyip completion/join olmadan yanıtı okuyor. Boş internal hata alanını başarılı kabul edebilen OR koşulu var (`PaygoPOS.cs:478-517`). Gerçek SDK zamanlaması çalıştırılmadı. Web adaptörüne kopyalanmayacak; tamamlanmış ve doğrulanmış cihaz cevabı beklenecek.
- **Masa toplama/birleştirmede NakitToplam ezilme hatası (Doğrulandı):** `RestorantService.cs:1006-1009` ve `1195-1198` satırlarında ardışık 4 satırda `anaBaslik.NakitToplam` atanmaktadır. CariToplam, BankaToplam ve IndirimToplam değerleri NakitToplam'a sırayla yazılmakta, önceki değer ezilmekte ve diğer alanlar güncellenmemektedir. Bu açık kaynak hatası yeni sisteme taşınmayacak, doğru alan eşlemeleriyle düzeltilecektir.
- **Masa ayırma ekranında durum atama hatası (Doğrulandı):** `frmMasaAyirma.cs:60` satırında `Where(sd => sd.Kapali = true)` yazılmış olup bu bir karşılaştırma (`==`) değil atamadır (`=`). Bellekteki açık satırları kapalı hale getirerek liste seçimi yapmaktadır. Yeni web modelinde açık satırlar tip güvenli ve değişmez (immutable/pure) sorgularla filtrelenecektir.
- **Servis katmanında dinamik SQL birleştirme:** `RestorantService.cs:1011-1024` ve benzeri yerlerde string interpolation ile SQL sorguları oluşturulmaktadır; SQL injection riski taşır. Yeni web mimarisi tamamen parametreli sorgular (Dapper/EF Core) kullanacaktır.
- **Masa işlem semantiği:** Masa taşıma (başlık kaydırma), ayırma (satır bölme ve yeni başlık), toplama (hesapları ana masada birleştirip kaynakları silme) ve fiziksel birleştirme (`AnaMasaKayitNo` bağlama) 4 ayrı işlemdir.
- Windows yazıcı kuyrukları, native x86/x64 SDK ve bazı COM bağımlılıkları var. Tarayıcı bunların yerine geçmez. Yerel Windows bağlayıcısı gereksinimi aktifte kullanılacak cihazlara göre belirlenir; S1 HTTPS API'si için aynı LAN'daki sunucu erişimi ayrıca değerlendirilebilir.
- Kaynak tesliminde bazı solution projeleri ve dış DLL yolları eksik raporlandı. Tekrar üretilebilir eski build ve SDK/lisans envanteri tamamlanmadan tüm legacy kodun doğrudan derlenebileceği varsayılmaz.

İlk ödeme ve işlem senaryoları için kabul testi özellikle cihaz başarılı/ERP başarısız, kart alındı/belge kapanmadı, yavaş SDK cevabı ve kısmi tahsilat durumlarını içerecektir.

### Hedef .NET sürümünün dayanağı

6 Kasım 2026 için Microsoft destek tablosu .NET 10'u aktif LTS, destek sonunu 14 Kasım 2028 olarak listeliyor. Bu nedenle C# web sunucusu için .NET 10 LTS makul hedeftir; yalnızca sürüm numarasını yükseltmek eski Windows/ERP/cihaz kodunu web uyumlu yapmaz. Yerel `dotnet --info` kontrolü SDK 10.0.403, ASP.NET Core ve .NET çalışma zamanı 10.0.14 gösterdi. Bu, eski EXE'nin sürümü değil, yeni demonun yerel geliştirme ortamıdır.

Resmî kaynak: https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core

Ön yüzün React olması C# sunucu şartını bozmaz; ancak React demoda kullanıldığı için nihai karar sayılmıyor. Razor/Blazor/React ayrımı doğrulanmış ekran etkileşimleri, ekip bakımı ve dağıtım maliyetiyle değerlendirilecek; kanıt yokken uygulama sırf teknoloji değiştirmek için yeniden yazılmayacak.

## Özellik karar defteri

Her eski ekran/komut için şu kayıt tutulacak:

| Alan | Kaydedilecek bilgi |
|---|---|
| İş amacı | İşletmede hangi işi tamamlıyor? |
| Kaynak kanıtı | Dosya, metot, satır; UI tetikleyicisi ve servis/veritabanı etkisi |
| Kullanım kanıtı | Kaynakta var mı, işletmede gerçekten kullanılıyor mu, bilinmiyor mu? |
| Yetki/kimlik | İşlemi kim yapabiliyor; tek terminal/kullanıcı veya farklı yetkiler nasıl belirleniyor? |
| Mali etki | Vergi, indirim, ikram, stok, cari, kasa, banka, yemek kartı, fiş etkileri |
| Bağımlılık | Şirket, şube, dönem, numaralandırma, parametre, yazıcı/cihaz |
| Yeni karar | Koru; sadeleştirerek koru; ikincil menüye taşı; doğrulama bekliyor; çıkarma adayı |
| Kabul testi | Eski ve yeni işlem sonunda beklenen kayıt/çıktı |

Kaynakta bulunan her özellik otomatik olarak yeni ana menüye girmez. Seyrek kullanılan veya arayüzü karmaşık bir işlemin gereksiz olduğu da varsayılmaz. Kaldırma adayları gerekçesi ve veri/mali etkisiyle ayrı tutulur; eski kod veya veri silinmez.

### Özellik değerlendirme ve ayıklama matrisi

| Modül / Özellik | Eski kaynak konumu | İşlevi ve bağımlılığı | Yeni sistem kararı | Ayıklama / sadeleştirme gerekçesi |
|---|---|---|---|---|
| **Masa ve Adisyon Yönetimi** | `frmRestorantMasaDuzeni.cs`, `frmSiparisOdeme.cs` | Masa açma, ürün ekleme, miktar/not, sipariş kaydetme | **Koru (Sadeleştir)** | Temel işlev. DevExpress WinForms kalabalığı kaldırılarak tablet ve dokunmatik uyumlu net 2 panelli arayüze dönüştürülecek. |
| **Kişi Sayısı Girişi** | `frmRestorantMasaDuzeni.cs:864-888` | Masa açılışında ayara bağlı kişi sayısı isteme | **Koru (Opsiyonel Ayar)** | İstenirse tek dokunuşla varsayılan kişi sayısı atanır; zorunlu blokaj kaldırılır. |
| **Çoklu / Kısmi Tahsilat** | `frmOdemeIslemleri.cs`, `NativeProvider.cs` | Nakit, kart, cari, yemek kartı, tip karma ödeme; seçili satır kapatma | **Koru (Sadeleştir)** | Restoranın temel ihtiyacı. Kuruş hassasiyetli, seçili satır veya kalan tutar üzerinden çalışan temiz ödeme paneli. |
| **Entegre POS Cihazı (S1 / PayGo)** | `HuginS1POS.cs`, `PaygoPOS.cs`, `frmOdemeIslemleri.cs` | Banka kartından fiziksel cihazla tahsilat ve mali onay | **Koru (Mimariyi Güçlendir)** | Kullanıcının açık isteği. Eski 1 sn thread/belirsiz durum hataları temizlenip sağlam durum makinesi ve mutabakatla uygulanacak. |
| **Manuel Kart Kaydı** | `frmOdemeIslemleri.cs:435-509` | Harici masaüstü POS ile çekilen kartın adisyona kaydı | **Koru (Ayrıştır)** | Entegre cihaz olmayan durumlar için açıkça "Harici POS" olarak etiketlenecek; entegre POS ile karıştırılmayacak. |
| **Masa Taşıma** | `frmRestorantMasaDuzeni.cs:969`, `RestorantService.cs:601` | Adisyonu boş masaya aktarma | **Koru (Sadeleştir)** | Temel operasyon. Atomik tek API çağrısı ile kaynak serbest bırakılır, hedef bağlanır. |
| **Masa Ayırma (Hesap Bölme)** | `frmMasaAyirma.cs`, `RestorantService.cs:734` | Seçili ürün/miktarları yeni hesaba bölme | **Koru (Hatayı Düzelt)** | Kaynaktaki `Where(sd => sd.Kapali = true)` atama hatası düzeltilecek; temiz satır bazlı bölme yapılacak. |
| **Masaları Toplama / Birleştirme** | `RestorantService.cs:884-1272`, `frmRestorantMasaDuzeni.cs:1456` | Hesapları tek masada toplama veya fiziksel bağlama | **Koru (Hatayı Düzelt)** | Kaynaktaki 4 ardışık `NakitToplam` ezilme hatası ve dinamik SQL injection düzeltilecek; finans bağları korunacak. |
| **İkram ve İptal** | `frmSiparisOdeme.cs:1993, 2366` | Ürünü ikram etme veya siparişten çıkarma | **Koru (Yetkilendir)** | Mutfak yazdırılmış miktarı ile hazırlık ayrılacak; silinen ürün için mutfağa iptal bildirimi üretilecek. |
| **Zayi Kaydı** | `frmSiparisOdeme.cs:2629` | Bozulma/dökülme nedenli satır zayi işlemi (`OzelKod1="1"`) | **İkincil Menü / Yetkili** | Günlük operasyonu kalabalıklaştırmayacak; yetkili menüsü altında gerekçe zorunluluğuyla tutulacak. |
| **Mutfak Ekranı (KDS) & Yazıcı** | `frmSiparisOdeme.cs:1251`, `ReportManager.cs` | Mutfak fişi çıktısı ve sipariş hazırlık takibi | **Koru (Modernize)** | Fiziksel Windows yazıcı bağımlılığı yerine canlı web KDS (SignalR) + gerekiyorsa yerel ağ/ESC-POS yazdırma servisi. |
| **QR Müşteri Menüsü** | Yeni web gereksinimi | Müşterinin telefonundan sadece güncel menü ve fiyatları görmesi | **Koru (Modernize)** | Personel veya ERP verilerine erişimi olmayan, hafif, salt okunur, hızlı mobil menü. |
| **Gün Sonu Raporu & Kapanış** | `frmGunSonu.cs`, `RestorantService.cs:1379` | Günlük ciro, tahsilat türleri ve açık masa kontrolü | **Koru (Sadeleştir)** | Takvim günü yerine işletme çalışma saatlerine (gece aşan vardiya) duyarlı, kasa/banka mutabakatlı net rapor. |
| **Pizza Ekranı / Karmaşık Form Tipleri** | `frmSiparisOdemePizza.cs` | Hamur/kenar/içerik seçimiyle alternatif sipariş UI | **Doğrulama Bekliyor** | İşletmede pizza/özel reçete modu kullanılmıyorsa kaldırılacak; kullanılıyorsa standart menü opsiyonlarına entegre edilecek. |
| **Caller-ID & Telefonla Sipariş** | `AtiaMiniApps\AtiaRestorant\AtiaRestorant.csproj:140` | Sabit hat COM portundan arayan no tespiti ve paket sipariş | **Çıkarma Adayı / Ayrık Modül** | Web restoranda paket servis/caller-id ihtiyacı yoksa tamamen ayıklanacak; varsa harici web-hook/servis yapılacak. |
| **DevExpress WinForms Bileşenleri** | `DevExpress.XtraBars`, `XtraGrid`, `XtraEditors` | Windows masaüstü arayüz bileşenleri | **Çıkarıldı** | Tamamen web tabanlı (HTML5/CSS semantic token / React veya Razor) temiz bileşenlere dönüştürülecek. |
| **Eski LINQ-to-SQL Yorumda Kalan Kodlar** | `RestorantProvider.cs:43-87, 157-520` | Yıllar önce yoruma alınmış null/false dönen eski metotlar | **Çıkarıldı** | Ölü kodlar yeni projeye taşınmayacak. |
| **Reflected Dinamik Dize SQL Üretimi** | `RestorantService.cs:113-159, 1011-1024` | Parametresiz dinamik dize birleştirme | **Çıkarıldı (Güvenlik)** | Güvenlik açığı; yerine Dapper parametreli sorgular veya EF Core kullanılacak. |

## Kullanıcı ve kurulum modeli

- Desteklenen çok kullanıcılık ile işletmede kullanılan kullanıcı sayısı farklı konulardır.
- Tek kasiyer kullanımı için gereksiz rol/yönetim ekranı dayatılmaz. Bununla birlikte oturum, işlem sahibi ve hassas işlemlerin yetkisi kayıtsız bırakılmaz.
- Garson/mutfak/QR ihtiyacı ile tek kasa kullanımı çelişmek zorunda değildir; fiili işletme düzeniyle eşleştirilir.
- Demo `Admin`, `Garson`, `Mutfak` hesapları nihai kimlik kaynağı veya zorunlu rol modeli değildir.
- Aynı SQL Server'a bağlanmak, aynı iş kurallarını sağlamak anlamına gelmez. Eski EXE ile birlikte çalışacaksa iki uygulamanın eşzamanlılık ve kilit sözleşmesi doğrulanır.

## Kritik senaryolar

### Masa ve adisyon

- Boş masa açma, var olan adisyona ekleme, kişi sayısı, masa/bölüm kimliği ve açılış zamanı.
- İki terminalin aynı anda aynı masayı açması; iki ayrı adisyon veya kayıp satır oluşmaması.
- Aynı satırı iki ekranın güncellemesi; eski verinin sessizce yenisini ezmemesi.
- Taşıma/birleştirme/bölme gerekiyorsa tutar, miktar, vergi, indirim, ikram, not ve ödeme ilişkilerinin korunması; işlem ortasında kesintide yarım kalmaması.
- Son satırın silinmesi ve sıfır tutarlı adisyonun kapanma/iptal davranışının eski kuralla karşılaştırılması.

### Ürün, fiyat ve mali hesap

- Ürün aktif/pasif durumu, fiyat listesi, porsiyon, miktar birimi, ekstra ve müşteri notu.
- Küsuratlı miktar ve yuvarlama; birim/satır/adisyon toplamlarının aynı kuralla hesaplanması.
- Vergi dahil/hariç, satır/genel indirim, ikram ve iptal davranışlarının kaynak ve gerçek şemayla doğrulanması.
- İstemcinin tutar/fiyat/kullanıcı göndererek sunucu kuralını aşamaması.
- Hazırlanmış/yazdırılmış ürünü azaltma veya iptal etmenin yetki, neden ve karşı belge gereksinimi.

### Tahsilat ve POS

- Tam nakit; nakit+kart; kısmi tahsilat gerekiyorsa bakiye; cari/yemek kartı gibi yöntemlerin gerçekten kullanıldığı kanıtlanırsa ilgili hareketler.
- Çift tıklama, aynı isteğin tekrar gönderilmesi, ağ kopması ve sunucu yeniden başlaması ikinci tahsilat üretmemeli.
- Cihaz reddi: adisyon başarılı ödenmiş sayılmaz.
- Cihaz zaman aşımı/bağlantı kopması: sonuç **belirsiz** olabilir; otomatik yeni satış başlatılmaz. Cihazın işlem sorgusu veya mutabakat prosedürüyle sonuç çözülür.
- Cihaz onayından sonra SQL kaydı başarısız: cihaz referansı korunur, yeniden başlatmada bulunur; aynı karttan tekrar çekilmez. Mutabakat/kurtarma işi test edilir.
- SQL kaydından önce/sonra süreç kapanması: kalıcı işlem kaydı ve benzersiz işlem anahtarıyla geri kazanım doğrulanır.
- İptal/iade: satış kaydını silmek yerine sağlayıcının desteklediği ters işlem ve ilgili mali kayıtlarla doğrulanır; yetki ve özgün cihaz referansı korunur.
- Gün sonu: web, SQL, terminal ve banka/sağlayıcı toplamlarının karşılaştırılması; zaman dilimi ve gün kapanış kuralı.
- PAN, PIN, CVV veya track verileri uygulama/log içine alınmaz. Sağlayıcının izin verdiği maskeli referanslar saklanır.

POS durum makinesi için başlangıç taslağı: oluşturuldu → cihaza gönderiliyor → onaylandı/reddedildi/sonucu belirsiz → ERP'ye işlendi veya mutabakat bekliyor. Bu taslak SDK sözleşmesi görülmeden kesinleştirilmez. SQL transaction'ı ile harici cihazın tek atomik transaction olduğu varsayılmaz.

### Mutfak ve yazıcı

- Siparişin gönderilmesi, yeniden yazdırma, kısmi yazdırma, kağıt/bağlantı hatası ve tekrarın ayırt edilmesi.
- Basılmış miktar ile hazırlanmış miktar ayrı anlam taşır; eski alanlar doğrulanmadan yeniden yorumlanmaz.
- Hazırlanmış adisyona yeni ürün; yalnız yeni/bekleyen miktarın belirgin görünmesi.
- Kısmi hazırlık, iptal bildirimi, ürünün doğru mutfak/yazıcıya yönlendirilmesi gerekiyorsa ilgili parametrelerin korunması.
- Web tarayıcısının USB/seri/üretici SDK'sına doğrudan erişebildiği varsayılmaz. Yerel Windows bağlayıcısı yalnız cihaz/protokol bunu gerektirirse tasarlanır.

### Kalıcılık, güvenlik ve işletim

- İşlem başında/ortasında/sonunda süreç kesintisi; kayıt tekrar okunduğunda tutarlı durum.
- Şirket/şube/dönem ayrımı gerekiyorsa sunucuda zorunlu; kullanıcı gönderdi diye güvenilmez.
- İşlem sahibi, tarih, neden, önceki/yeni durum ve ilişki referanslarıyla denetim izi; gizli veri loglanmaz.
- Oturum süresi dolması, yetki değişimi, sayfa yenileme, tarayıcı geri/ileri ve bağlantı kopması; form verisi ve seçili masa korunur veya anlaşılır kurtarma yolu sunulur.
- HTTPS, tablet/LAN erişimi, yazıcı erişimi, yedekleme ve geri yükleme ayrı doğrulanır.
- Gün kapanışı, İstanbul saat dilimi, gece yarısı açık kalan adisyonlar ve eski sistemin mali gün tanımı karşılaştırılır.

## Uygulama sırası ve geçiş kapıları

1. Kaynak envanteri ve işlem/bağımlılık haritasını bitir; varsayımları ve bilinmeyenleri açık tut.
2. Özellik karar defterini oluştur; eski-yeni sözlük ve API/SQL sözleşmelerini doğrulanmış alanlarla tanımla.
3. Masa → ürün → adisyon → ödeme dikey akışını anlamsal iki temayla yeniden düzenle; önce demo ortamında kalıcı olmayan sınırlarını açık göster.
4. Gerçek SQL şemasının güvenli test kopyasıyla transaction, kimlik/numara, kilit, audit ve idempotency katmanlarını doğrula. Canlıya bağlanma yok.
5. POS sağlayıcısı/cihazı/SDK'sı belirlendikten sonra adaptör, gerekiyorsa yerel bağlayıcı ve kurtarma/mutabakat akışını uygula; önce simülasyon, sonra kontrollü fiziksel test.
6. Mutfak/yazıcı ve gerekli yan işlemleri aynı sözleşmeyle tamamla; rol/kurulum modeli doğrulanmış işletme düzenine uysun.
7. İşletme kabulü, yedekten dönüş provası ve geri dönüş planından sonra kontrollü pilot. Eski sistemle aynı anda kontrolsüz çift yazma yapılmaz.

Henüz gerçek SQL şeması, cihaz bilgisi/SDK'sı ve işletme kullanımı doğrulanmadığı için 4–7. adımlar tamamlandı sayılamaz. Kaynak analizinden çıkabilecek bulgular bu sırayı daraltabilir veya gerekli bağımlılıkları değiştirebilir.
