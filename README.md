# ATIA Restoran Web

**ATIA masaüstü restoran uygulamasının web sürümü.** Garson, mutfak ve yönetici aynı uygulamayı tarayıcıdan, tabletten veya telefondan kullanır; müşteriler menüyü giriş yapmadan görür.

> **Durum: demo.** Uygulama gerçek ERP veritabanına ve fiziksel cihazlara (POS, yazıcı, arayan numara) bağlı değildir. Bütün kayıtlar sunucu bilgisayarındaki demo dosyasında tutulur. Mağazada canlı tahsilat veya sipariş için kullanmayın.

---

## İçindekiler

- [Hızlı başlangıç](#hızlı-başlangıç)
- [Neler yapılabiliyor?](#neler-yapılabiliyor)
- [Bir servisin akışı](#bir-servisin-akışı)
- [Roller ve yetkiler](#roller-ve-yetkiler)
- [Ayarlar](#ayarlar)
- [Geliştirme](#geliştirme)
- [Ekip çalışması](#ekip-çalışması)
- [Sınırlar ve canlıya geçiş](#sınırlar-ve-canlıya-geçiş)
- [Diğer belgeler](#diğer-belgeler)

---

## Hızlı başlangıç

**Gereken tek şey:** [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0). Derlenmiş arayüz depoda (`wwwroot`) hazır olduğu için uygulamayı açmak için Node.js gerekmez.

1. Windows'ta **[AtiaBaslat.bat](AtiaBaslat.bat)** dosyasına çift tıklayın. Sunucu açılır ve giriş sayfası tarayıcıda kendiliğinden gelir.
2. Aşağıdaki demo hesaplarından biriyle giriş yapın.
3. Aynı ağdaki tablet veya telefonlardan `http://SUNUCU-IP:5080/login` adresine girin. Bağlantı kurulamazsa Windows Güvenlik Duvarı'nda 5080 portuna izin verin.

Komut satırından başlatmak isterseniz depo kökünde:

```powershell
dotnet run --environment Development --urls "http://0.0.0.0:5080"
```

| Adres | Ne açılır |
| --- | --- |
| `/login` | Personel girişi |
| `/menu` | Müşteri menüsü (giriş gerekmez, salt okunur) |
| `/api` | Sunucu API'si |

### Demo hesapları

| Rol | Kullanıcı adı | Şifre |
| --- | --- | --- |
| Yönetici | `admin` | `demo123` |
| Garson | `garson` | `demo123` |
| Mutfak | `mutfak` | `demo123` |

Bu şifreler depoda açıkça yazılı. Sunucuyu dış ağa açmayın ve gerçek işletme verisi girmeyin. Yeni personel hesapları uygulama içindeki **Personel** ekranından açılır.

---

## Neler yapılabiliyor?

### 🍽️ Masa ve adisyon
- Masaları bölüme ve duruma göre (dolu, boş, rezerve) bulma.
- Ürün seçici masa ekranının üzerinde açılır. Kategori, arama, adet ve porsiyon seçilir; seçim onaylandıktan sonra panel açık kalır.
- Ürün seçenekleri ve ekstralar: pişirme derecesi, ekstra malzeme, menü içeriği. Zorunlu veya isteğe bağlı olabilir; ek fiyat varsa kendiliğinden eklenir.
- Hazır notlar ("Soğansız", "Az pişmiş" gibi) tek dokunuşla eklenir. Ürün barkod okutarak da eklenebilir.
- Kişi sayısı, ikram, gerekçeli iptal ve zayi.
- Masa taşıma, ayırma ve birleştirme.
- Müşteriye bilgi fişi yazdırma. Fişte KDV dökümü ve adisyon barkodu bulunur; barkod okutulunca adisyon açılır.

### 💳 Ödeme
- Nakit, banka kartı, yemek kartı (türüyle birlikte), cari ve indirim.
- Tam ödeme, kısmi ödeme, **kişi sayısına eşit bölme** ve **ürün seçerek ödeme**. Ödenmiş ürün iptal edilemez.
- **Cari (veresiye):** cari ödeme seçilen müşterinin hesabına borç yazılır; kredi limiti aşılamaz.
- Adisyona **fatura bilgisi** (unvan, vergi dairesi, vergi no, adres) eklenir ve fişte görünür.
- Hugin S1 / PayGo için işlem akışı simülasyonu.
- **Adisyonlar** ekranında kapanmış adisyonlar incelenir. Ödeme şekli aynı işletme günü içinde düzeltilebilir; sonrası için iade kaydı tutulur. Fiş yeniden yazdırılabilir.

### 👨‍🍳 Mutfak
- Bekleyen siparişler, ürün bazında "hazır" işaretleme, 15 dakikayı aşan siparişler.
- Ürünler kategorisine göre istasyona yönlendirilir (örneğin içecekler bara). Mutfak ekranı istasyona göre süzülebilir.
- Yazdırma kuyruğu tutulur; çıktının alındığını personel onaylar.
- Yeni sipariş gelince **sesli uyarı** çalar (cihaz başına açılıp kapatılabilir).

### 🛵 Paket servis
- Telefon yazılınca müşteri kartı ve kayıtlı adresler gelir. Kart ilk siparişte kendiliğinden oluşur.
- Sipariş şu sırayla ilerler: **Yeni → Hazırlanıyor → Yolda → Teslim edildi**. Kurye tanımlı listeden seçilir.
- Yönetici tahsilatı doğrular. Nakit paket tutarı bu doğrulamayla beklenen kasa nakdine girer.
- **Gelen sipariş kutusu:** PlatinMarket veya Entegra adına örnek sipariş elle girilir, ürün eşlenir ve paket servise aktarılır. Aynı sipariş iki kez aktarılmaz.

### 🧾 Hızlı satış
- Masa açmadan tezgâhtan veya gel-al satış: ürünler seçilir, ödeme alınır, sipariş mutfağa düşer.
- Barkod okutarak ürün eklenebilir; nakit, kart, yemek kartı veya cari ile ödenir.

### 💰 Kasa ve cari
- **Kasa hareketi:** kasaya giriş (açılış, bozuk para) ve çıkış (masraf, tedarikçi, bankaya yatırılan, avans).
- **Cari hesaplar:** unvan, vergi bilgisi, kredi limiti, bakiye; ekstre ve tahsilat. Nakit tahsilat kasaya girer.
- Beklenen kasa nakdi = masa nakdi + paket nakdi + cari nakit tahsilatı + kasa girişi − kasa çıkışı.

### 📱 QR menü ve garson çağırma
- Her masaya ayrı QR kodu (**Ayarlar → QR menü**); hepsi tek seferde yazdırılabilir, kaybolan kod yenilenir.
- Misafir kodu okutunca o masanın menüsü açılır; **Garson çağır** veya **Hesap iste** der. Personel ekranında sesli uyarıyla görünür.
- Menüde ürün görseli, açıklama ve 14 alerjen bilgisi gösterilir.

### 📊 Raporlar
- **Günlük:** masa ve paket satışı, ödeme türleri, saatlik satış, iptal, zayi, ikram ve iade, KDV dağılımı, yemek kartı dağılımı (tahmini komisyonla), kurye hesabı, kasa mutabakatı ve vardiya kapanışı.
- **Dönem / ay sonu:** gün gün toplamlar; en fazla 62 gün.
- **Personel:** açılan adisyon, satış, iptal, ikram, tahsilat ve iade.
- Dönem, personel, adisyon listesi, stok, kasa ve cari ekstre **CSV** (Excel) olarak indirilebilir.

### 📦 Stok ve maliyet
- Hammadde, reçete ve porsiyon çarpanı tanımlanır (örneğin yarım porsiyon için 0,6).
- Satılan ürünün malzemesi reçeteye göre stoktan düşer. İptal edilen ürünün malzemesi geri eklenir, zayide eklenmez. Stok bitse de satış engellenmez; uyarı gösterilir.
- Giriş, çıkış ve sayım hareketleri. Birim maliyet alışlarla ağırlıklı ortalama olarak güncellenir. Ürün bazında maliyet oranı görülür.

### ⚙️ Yönetim
- **Menü:** kategori, ürün, fiyat, porsiyon, KDV oranı, barkod, seçenek grupları, satışta olup olmadığı.
- **Personel:** hesap açma, rol ve şifre değiştirme, pasifleştirme.
- **Ayarlar:** işletme bilgisi (fişte görünür), masa ve bölüm tanımları, yazıcı ve istasyonlar, yemek kartı türleri, hazır notlar, zayi açma/kapama, demo verisini sıfırlama.
- **Rezervasyon:** az kullanıldığı için ikincil menüde yer alır.

Açık ve koyu tema vardır. Bir ekranda yapılan değişiklik diğer personel ekranlarına anında yansır (SignalR).

---

## Bir servisin akışı

1. **Garson** masayı seçer, ürünleri ve notları girip onaylar.
2. **Mutfak** siparişi kendi istasyonunda görür, hazırlar ve "hazır" işaretler.
3. **Garson veya yönetici** isterse masaya bilgi fişi yazdırır.
4. **Yönetici** ödemeyi alır; hesap tek seferde, kısmen, eşit bölünerek ya da ürün ürün kapatılabilir.
5. **Gün sonunda** yönetici günlük raporu inceler, sayılan nakdi girer ve vardiyayı kapatır. Rapor beklenen nakitle farkı gösterir.

İşletme günü varsayılan olarak saat 04.00'te başlar. Böylece gece yarısından sonra kapanan adisyonlar önceki günün raporunda kalır.

---

## Roller ve yetkiler

| | Yönetici | Garson | Mutfak |
| --- | :---: | :---: | :---: |
| Masalar, sipariş, gerekçeli iptal | ✅ | ✅ | |
| Paket servis, müşteri kartı | ✅ | ✅ | |
| Bilgi fişi yazdırma | ✅ | ✅ | |
| Mutfak ekranı ve yazdırma kuyruğu | ✅ | | ✅ |
| Menüyü görme | ✅ | ✅ | ✅ |
| Ödeme, ikram, zayi, masa taşıma/ayırma/birleştirme | ✅ | | |
| Ödeme düzeltme, iade, paket tahsilatı | ✅ | | |
| Hızlı satış, kasa hareketi, cari hesap ve tahsilat | ✅ | | |
| Fatura bilgisi yazma, misafir çağrılarını kapatma | ✅ | ✅ | |
| Raporlar, adisyonlar, stok, personel, ayarlar | ✅ | | |

Yetkiler sunucuda denetlenir; istek içinde gönderilen rol bilgisi yetki vermez. Bir personelin rolü, durumu veya şifresi değişince o hesabın bütün açık oturumları kapanır. Şifreler düz metin olarak değil, tuzlanmış özet (PBKDF2) olarak saklanır.

---

## Ayarlar

Ayarlar `appsettings.json` dosyasından veya ortam değişkenlerinden verilir.

| Ortam değişkeni | Varsayılan | Açıklama |
| --- | --- | --- |
| `Demo__StatePath` | `App_Data/demo-state.json` | Demo verisinin saklandığı dosya. Boş verilirse veri yalnız bellekte tutulur. |
| `Restaurant__StoreId` | `1` | Mağaza numarası. Oturum yalnızca kendi mağazasının sunucusunda geçerlidir. |
| `Restaurant__BusinessDayStartHour` | `4` | İşletme gününün başladığı saat (0–23). |
| `JwtSettings__SecretKey` | Geliştirmede rastgele | Oturum imza anahtarı; en az 32 bayt. Geliştirme ortamında her açılışta yenilendiği için sunucu yeniden başlayınca herkes tekrar giriş yapar. |

**Demo verisini sıfırlamak için** **Ayarlar → Genel → Başlangıç verisine dön** düğmesini kullanın ya da sunucu kapalıyken `App_Data/demo-state.json` dosyasını silin. `App_Data` klasörü müşteri ve adisyon bilgisi içerebileceği için depoya gönderilmez. Aynı klasörde ürün görselleri (`gorseller/`) ve son 14 işletme gününün günlük yedekleri (`yedekler/`) tutulur; bir yedeğe dönmek için sunucu kapalıyken yedek dosyayı `demo-state.json` adıyla kopyalayın.

---

## Geliştirme

### Teknolojiler
- **Sunucu:** ASP.NET Core 10, JWT oturumu, SignalR.
- **Arayüz:** React 19, TypeScript, Vite, TanStack Query.

### Arayüz üzerinde çalışmak

[Node.js](https://nodejs.org/) 20 veya üzeri gerekir. İlk terminalde .NET sunucusu açık kalsın, ikinci terminalde:

```powershell
cd ClientApp
npm ci
npm run dev
```

Vite arayüzü `http://127.0.0.1:5173` adresinde açar; API ve SignalR isteklerini 5080 portuna yönlendirir. Değişiklikleri .NET sunucusunun sunduğu sürüme aktarmak için `npm run build` çalıştırın. Çıktı `wwwroot` klasörüne yazılır ve kaynakla birlikte commit'lenir.

### Testler

```powershell
# API testleri (depo kökünde)
dotnet test Tests/AtiaRestorant.API.Tests.csproj

# Arayüz testleri ve üretim derlemesi (TypeScript denetimi dahil)
cd ClientApp
npm test
npm run build
```

### Kodun düzeni

```text
Program.cs                      API rotaları, rol kuralları, oturum, SignalR
Endpoints/OperationsEndpoints.cs  Personel, ayar, adisyon geçmişi, paket, rapor ve stok rotaları
Services/AuthService.cs         Giriş ve oturum belirteci
Data/
  RestaurantRepository.cs       Masa, sipariş, ödeme, mutfak, paket servis kuralları
  RestaurantRepository.State.cs     Demo dosyasına kaydetme ve geri yükleme
  RestaurantRepository.Staff.cs     Personel hesapları ve şifreler
  RestaurantRepository.Setup.cs     İşletme, masa/bölüm, yazıcı, yemek kartı, hazır not
  RestaurantRepository.Billing.cs   Seçenekler, KDV, ürün bazında ödeme, düzeltme, iade
  RestaurantRepository.Delivery.cs  Müşteri kartı, kurye, tahsilat
  RestaurantRepository.Reports.cs   Dönem ve personel raporları
  RestaurantRepository.Stock.cs     Hammadde, reçete, stok hareketi, maliyet
  RestaurantRepository.Accounts.cs  Cari hesap, kasa hareketi, fatura bilgisi
  RestaurantRepository.QuickSale.cs Hızlı (masasız) satış
  RestaurantRepository.Guest.cs     Masa QR kodları, misafir çağrıları, ürün görseli ve alerjen
  DbContext.cs                  Doğrulanmamış ERP bağlantısı için kapalı sınır
Models/                         API istek ve yanıt modelleri
ClientApp/src/                  React ekranları ve stiller
Tests/                          API sözleşme ve iş kuralı testleri
wwwroot/                        Derlenmiş arayüz
```

Yeni sunucu işleri mümkün olduğunca ayrı `RestaurantRepository.<Konu>.cs` dosyalarına konur. Böylece iki kişinin aynı dosyada çakışması azalır.

---

## Ekip çalışması

Proje iki kişi tarafından sırayla, farklı bilgisayarlarda ve yapay zekâ ajanlarıyla geliştiriliyor. Kurallar **[AGENTS.md](AGENTS.md)** dosyasındadır; Claude Code (`CLAUDE.md`) ve GitHub Copilot (`.github/copilot-instructions.md`) aynı dosyaya yönlendirilir. Özetle:

- İşe başlamadan ve push etmeden önce `origin/main` getirilir. Alınmamış commit varken düzenleme, commit veya push yapılmaz.
- Diğer kişinin değişiklikleri bilinçli iştir; geri alınmaz, üzerine yazılmaz.
- `AGENTS.md` içindeki **Korunan davranışlar** listesi, kullanıcı açıkça istemedikçe değiştirilmez.
- Yalnız ilgili dosyalar commit'lenir. Commit mesajları Türkçe karakterlerle yazılır.
- `main` dalına yalnız normal (hızlı ileri) push yapılır; force push yasaktır.

---

## Sınırlar ve canlıya geçiş

**Şu an olmayanlar:**
- Gerçek ERP veritabanı bağlantısı. `Demo:Enabled=false` verilirse sağlık kontrolü dışındaki bütün istekler 503 yanıtı alır.
- Fiziksel POS (Hugin, PayGo) bağlantısı ve kart iadesi. İadeler yalnız kayıt olarak tutulur.
- QR menüden sipariş verme. Misafir yalnız menüyü görür ve çağrı gönderir.
- PlatinMarket, Entegra, e-Adisyon ve arayan numara cihazından otomatik veri alma.
- Kâğıt çıktının doğrulanması; yazdırma tarayıcının yazdırma penceresiyle yapılır.
- Mali belge. Yazdırılan fiş bilgi fişidir.

**Canlıya geçmeden önce gerekenler:**
1. Masa, adisyon, ödeme, ürün, müşteri, paket ve mağaza ayarlarının gerçek veritabanı şeması; mümkünse kişisel verisi ayıklanmış örnek kayıtlar.
2. Hangi mağazanın hangi sağlayıcıyı ve cihazı kullandığı (PlatinMarket, Entegra, Hugin/PayGo, e-Adisyon, arayan numara).
3. Sağlayıcıların güncel API belgeleri ve test erişimleri. Erişim bilgileri depoya yazılmaz.
4. Masaüstü ve web aynı veriyi kullanacaksa eşzamanlı işlem, mükerrer sipariş ve mükerrer tahsilat kuralları.

Önerilen sıra ve masaüstü kodundaki karşılıklar [geçiş analizinde](MASAUSTU_GECIS_ANALIZI.md) anlatılıyor.

---

## Diğer belgeler

| Belge | İçerik |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Ekip ve yapay zekâ ajanları için çalışma kuralları |
| [MASAUSTU_GECIS_ANALIZI.md](MASAUSTU_GECIS_ANALIZI.md) | Masaüstünden web'e taşıma kararları |
| [PRODUCT.md](PRODUCT.md) · [DESIGN.md](DESIGN.md) | Ürün amacı ve tasarım ilkeleri |
| [docs/](docs/) | API belgesi, eski iş akışları, POS notları, doğrulama kayıtları |
| [VERIFICATION.md](VERIFICATION.md) | 6 Kasım tarihli eski doğrulama notu |
