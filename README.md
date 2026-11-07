> ### Batuhan'dan Not
>
> Test için böyle bir şey denedim veritabanı vs zaten olmadığı için öylesine denemelik birşeyler yaptırdım 6.11.2026 // 22.08
> PlatinMarket, Entegra, POS gibi canlı bağlantılar için veritabanı şeması ile ilgili sağlayıcı erişimleri gerekiyor.

# ATIA Restoran Web

ATIA'nın masaüstü restoran uygulamasını web ortamına taşıyoruz. Bu depoda personel ekranları, API ve tarayıcıda açılan müşteri menüsü birlikte duruyor. Şu anki sürüm, restoran akışlarını **demo verisiyle** denemek için çalışıyor; gerçek mağaza veritabanına bağlı değil.

Arayüzde masa ve adisyon işlemleri, mutfak fişleri, paket servis, günlük rapor ve rezervasyon var. Giriş ekranı korunarak diğer personel ekranları yeniden düzenlendi. Masaüstünden hangi özelliklerin taşınmaya değer olduğunu ve hangi bağlantıların beklediğini [geçiş analizinde](MASAUSTU_GECIS_ANALIZI.md) anlattık.

### Ekranlardan örnekler

![Gerekçeli iptal ve zayi penceresi](docs/screenshots/iptal-zayi.png)

![Günlük rapordaki vardiya kapanışı](docs/screenshots/vardiya-kapanisi.png)

## Bugün neler çalışıyor?

| Alan | Demo ortamında yapabilecekleriniz | Sınır |
| --- | --- | --- |
| Masalar ve adisyon | Bölüm veya duruma göre masa bulma; ürün, porsiyon ve sipariş notu ekleme; adet değiştirme; gerekçeli iptal veya zayi; ödeme alma; masa taşıma, ayırma ve birleştirme | İşlemler bellekte tutulur. Sunucu yeniden başlayınca sıfırlanır. |
| Mutfak | Ürünleri ayrı ayrı hazır işaretleme; ekleme, değişiklik, iptal ve zayi bildirimlerini görme veya tarayıcıdan yazdırma | Yazdırma tarayıcının yazdırma penceresini açar; fiziksel çıktı doğrulanmaz. |
| Paket servis | Müşteri, telefon, adres, ürün ve ödeme şekliyle sipariş açma; kurye atayıp siparişi hazırlama, yola çıkarma ve teslim etme | Manuel demo akışıdır. Çevrim içi sipariş sağlayıcılarından otomatik kayıt almaz. |
| Günlük rapor | İşletme gününe göre satışları, ödeme türlerini, saatlik tutarları, iptal/zayi, işlem geçmişini ve mutabakatı görme | Paket servis kayıtları henüz bu rapora katılmaz. İşlem geçmişi demo sunucusu yeniden başlayınca sıfırlanır. |
| Rezervasyon | Tarihe göre kayıt görme, yeni rezervasyon açma ve iptal etme | Az kullanılan bir akış olduğu için ikincil menüdedir. |
| Menü | Personelin ürünleri araması; müşterinin `/menu` adresinden ürün ve fiyatları görmesi | Müşteri menüsü sipariş göndermez; ürün düzenleme ekranı henüz yoktur. |
| POS | Adisyon ödemesinde manuel POS veya Hugin S1/PayGo için örnek işlem ve sonuç sorgulama | Fiziksel terminale bağlanmaz. Onay adımı simülasyondur. |

### Masadan ödemeye

Garson veya yönetici masayı seçip menüden ürün ekleyebilir. Porsiyon ve sipariş notu satırla birlikte kaydedilir. Yönetici gerektiğinde ürün ikramını işaretler, adisyonu başka masaya taşır, ayırır veya birleştirir.

Ödeme ekranı nakit, banka kartı, yemek kartı, cari ve indirim tutarlarını ayrı alır. Kısmi ödeme yapılırsa kalan tutar adisyonda görünür; tutar tamamlandığında adisyon kapanır. Sunucu ürün fiyatını ve ödeme toplamını denetler. Hugin S1 ve PayGo seçimi, gerçek cihazla konuşan bir bağlantı değil, işlem durumlarını denemek için hazırlanmış simülasyondur.

Yönetici günlük raporda gerekçeli iptal, zayi, ikram, ödeme ve masa işlemlerini yapan personeli görebilir. İptal ve zayi tutarları ayrı gösterilir. İşletme günü varsayılan olarak 04.00'te başlar; `Restaurant__BusinessDayStartHour` ortam değişkeniyle 0–23 arasında ayarlanabilir. Tamamlanmış bir işletme günü için yönetici sayılan nakdi girip vardiyayı bir kez kapatabilir; rapor beklenen nakit ile farkı gösterir. Rezervasyonlar normal takvim gününü kullanır. Fiziksel POS veya banka iadesi henüz uygulanmadı. Bu kayıtlar da demo belleğindedir, kalıcı denetim kaydı sayılmaz.

### Paket siparişinin yolu

Yeni siparişte müşteri ve teslimat bilgileriyle ürünleri girersiniz. Sipariş **Yeni → Hazırlanıyor → Yolda → Teslim edildi** sırasıyla ilerler. Yola çıkarırken kurye adı gerekir. Ürün fiyatları sunucudaki menüden alınır; tekrar gönderilen isteğin ikinci bir sipariş açmaması için işlem anahtarı kullanılır. Bu akış henüz gerçek müşteri ve sipariş tablolarına bağlı değildir.

### Kim hangi ekrana girer?

| Rol | Erişim |
| --- | --- |
| Yönetici (`admin`) | Genel bakış, masalar, paket servis, mutfak, menü, günlük rapor, entegrasyon durumu ve rezervasyonlar. Ödeme ve masa taşıma gibi yönetici işlemleri bu roldedir. |
| Garson (`garson`) | Masalar, sipariş ve paket servis akışı, menü. |
| Mutfak (`mutfak`) | Mutfak fişleri ve menü. |
| Müşteri | Giriş yapmadan `/menu` adresindeki salt okunur menü. |

İşlem izinleri sunucuda ayrı denetlenir: garson sipariş ve gerekçeli iptal yapar; zayi, ikram ve ödeme yöneticiye; ürün hazırlığı ve mutfak bildirimleri mutfak personeli ile yöneticiye açıktır. Personel ekranları telefonda ve masaüstünde açılır. Açık ve koyu tema bulunur. Sunucu, değişikliklerden sonra SignalR üzerinden personel ekranlarına yenileme sinyali gönderir.

## Yerelde çalıştırma

Gerekenler: [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0). Depodaki derlenmiş arayüz `wwwroot` altında bulunduğu için yalnızca uygulamayı açacaksanız Node.js gerekmez.

Depo kökünde:

```powershell
foreach ($role in 'Waiter','Kitchen') {
    $password = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
    Set-Item -Path "Env:Demo__$($role)Password" -Value $password
    Write-Host "$role parolası: $password"
}
dotnet run --environment Development --urls "http://0.0.0.0:5080"
```

Sunucu bilgisayarında personel girişi için `http://127.0.0.1:5080/login` adresini açın. Diğer bilgisayarlarda `127.0.0.1` yerine sunucunun yerel ağ IP adresini yazın: `http://SUNUCU-IP:5080/login`. Müşteri menüsü aynı adreste `/menu`, API ise `/api` altında çalışır. Windows Güvenlik Duvarı bağlantıyı engelliyorsa 5080 portuna izin verin.

### Demo hesapları

Bu hesaplar yalnızca `Development` ortamındaki demo modunda kullanılabilir. Yönetici parolası `demo123` olarak sabittir. Garson ve mutfak parolaları yukarıdaki komutta üretilir; çıktıdaki değerleri ilgili hesapla kullanın.

| Rol | Kullanıcı adı | Parola |
| --- | --- | --- |
| Yönetici | `admin` | `demo123` |
| Garson | `garson` | `Demo__WaiterPassword` |
| Mutfak | `mutfak` | `Demo__KitchenPassword` |

Demo sunucuya erişebilen diğer bilgisayarlardan da açılır. `admin/demo123` bilgileri bu depoda açıkça yer aldığı için erişimi ağ düzeyinde kısıtlamadan gerçek işletme verisiyle kullanmayın. İmzalı oturum belirtecindeki rol sunucuda doğrulanır; istek gövdesindeki rol veya personel alanı yetki vermez. Demo siparişleri, rezervasyonları ve ödemeleri kalıcı değildir. Sunucuyu yeniden başlattığınızda başlangıç verisine dönersiniz.

### Arayüz üzerinde çalışmak

[Node.js](https://nodejs.org/) 20 veya üzeri ile iki terminal kullanın. İlk terminalde yukarıdaki .NET komutu açık kalsın. İkinci terminalde:

```powershell
cd ClientApp
npm ci
npm run dev
```

Vite arayüzü `http://127.0.0.1:5173` adresinde açar ve API ile SignalR isteklerini 5080 portuna iletir. Arayüz değişikliklerini .NET sunucusunun sunduğu sürüme aktarmak için `ClientApp` içinde `npm run build` çalıştırın; çıktı `wwwroot` klasörüne yazılır.

## Kodun düzeni

- `Program.cs`: API rotaları, rol kuralları, oturum açma, SignalR ve statik dosyalar.
- `Data/RestaurantRepository.cs`: Demo veri ve masa, ödeme, mutfak, paket servis iş kuralları.
- `Models/`: API istekleri ve veri modelleri.
- `ClientApp/src/`: React ekranları, oturum yönetimi ve arayüz stilleri.
- `Tests/`: API sözleşmesi ve iş kuralı testleri.
- `wwwroot/`: Derlenmiş arayüz; .NET uygulaması bu dosyaları sunar.

Sunucu ASP.NET Core 10, arayüz React 19, TypeScript ve Vite ile yazıldı. TanStack Query veri isteklerini, SignalR değişiklik bildirimlerini yönetir. Personel oturumu JWT kullanır. Demo verileri bellekte tutulur; `Data/DbContext.cs` içindeki SQL sınırı doğrulanmış bir canlı bağlantı değildir.

## Testler

Depo kökünde API testleri:

```powershell
dotnet test Tests/AtiaRestorant.API.Tests.csproj
```

`ClientApp` içinde arayüz testleri ve üretim derlemesi:

```powershell
cd ClientApp
npm ci
npm test
npm run build
```

8 Kasım 2026 kontrolünde 34 API ve 16 arayüz testi geçti; üretim derlemesi de tamamlandı. [Önceki doğrulama notu](VERIFICATION.md) 6 Kasım tarihli bir anlık kayıttır, bu yüzden oradaki test sayıları daha düşüktür.

## Canlı kullanımdan önce

`Demo:Enabled=false` ayarı gerçek veritabanını açmaz. SQL şeması henüz doğrulanmadığı için API, sağlık kontrolü dışındaki isteklerde 503 yanıtı verir. Demo modu da geliştirme ortamı dışında başlatılmaz. Bu sürümü mağazada canlı tahsilat veya sipariş kaydı için kullanmayın.

Geçiş için şu bilgilere ihtiyaç var:

1. Masa, adisyon, sipariş satırı, ödeme, ürün, müşteri, paket servis ve mağaza ayarlarının gerçek veritabanı şeması; mümkünse kişisel verisi ayıklanmış örnek kayıtlar.
2. Hangi mağazanın PlatinMarket, Entegra, Hugin/PayGo, e-Adisyon veya arayan numara donanımını kullandığı.
3. Kullanılan sağlayıcıların güncel API belgeleri ve test erişimleri. Erişim bilgileri depoya yazılmamalı.
4. Masaüstü uygulamasıyla web aynı veriyi kullanacaksa eşzamanlı işlem, mükerrer sipariş ve mükerrer tahsilat kuralları.

Önce canlı veri eşlemesi ve mağaza bazlı yetki sınırları kurulmalı. Ardından paket servis ve gerçekten kullanılan sipariş kaynakları bağlanabilir. Fiziksel POS, yazıcı ve arayan numara donanımı ayrı bağlantı çalışmaları gerektirir. Ayrıntılı sıra ve masaüstü kodundaki karşılıklar [geçiş analizinde](MASAUSTU_GECIS_ANALIZI.md) bulunuyor.
