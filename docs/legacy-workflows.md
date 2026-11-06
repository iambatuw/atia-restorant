# Legacy restoran iş akışları ve web parite sınırları

İnceleme tarihi: 2026-11-06. Amaç: mevcut restoran işini öğrenerek C# web modernizasyonuna kanıt tabanı sağlamak; yeni bir ürün tanımlamak veya hatalı kodu aynen taşımak değil.

## 1. Kapsam ve kanıt sözlüğü

Kaynaklar statik olarak incelendi. Uygulama, testler, SQL Server veya cihazlar çalıştırılmadı; ağ kullanılmadı, bağlantı/kimlik bilgileri okunmadı. `bin`, `obj`, `packages` içeriği incelemeye alınmadı. Tek yazılan dosya bu rapordur; uygulama dosyaları değiştirilmedi.

- **Kanıtlı:** belirtilen kaynakta çalışan kod yolu veya açık veri alanı var. Bu, belirli işletmede kullanıldığının kanıtı değildir.
- **Risk/çıkarım:** kaynak davranışından doğan olası bütünlük sorunu; üretim verisinde gerçekleştiği iddia edilmez.
- **Doğrulanmalı:** DB şeması, etkin ayar, gerçek kullanıcı/cihaz veya çalışma zamanı olmadan sonuçlandırılamayan konu.

Aşağıdaki kısaltmalar **tam dosya yollarını** temsil eder; `S:734–882` gibi atıflar bu dosyanın kaynak satırlarıdır.

| Kod | Tam dosya yolu |
|---|---|
| E | `C:\Users\batuh\OneDrive\Masaüstü\atia\AtiaMiniApps\AtiaRestorant\Program.cs` |
| PROJ | `C:\Users\batuh\OneDrive\Masaüstü\atia\AtiaMiniApps\AtiaRestorant\AtiaRestorant.csproj` |
| P | `C:\Users\batuh\OneDrive\Masaüstü\atia\AtiaBusiness\Providers\RestorantProvider.cs` |
| S | `C:\Users\batuh\OneDrive\Masaüstü\atia\AtiaBusiness\Providers\Base\Services\RestorantService.cs` |
| N | `C:\Users\batuh\OneDrive\Masaüstü\atia\AtiaBusiness\Providers\NativeProvider.cs` |
| M | `C:\Users\batuh\OneDrive\Masaüstü\atia\Atia\Restorant\frmRestorantMasaDuzeni.cs` |
| O | `C:\Users\batuh\OneDrive\Masaüstü\atia\Atia\Restorant\frmSiparisOdeme.cs` |
| PAY | `C:\Users\batuh\OneDrive\Masaüstü\atia\Atia\Restorant\frmOdemeIslemleri.cs` |
| SPLIT | `C:\Users\batuh\OneDrive\Masaüstü\atia\Atia\Restorant\frmMasaAyirma.cs` |
| PIZ | `C:\Users\batuh\OneDrive\Masaüstü\atia\Atia\Restorant\FormTipleri\frmSiparisOdemePizza.cs` |
| RES | `C:\Users\batuh\OneDrive\Masaüstü\atia\Atia\Restorant\frmRezervasyon.cs` |
| DAY | `C:\Users\batuh\OneDrive\Masaüstü\atia\Atia\Restorant\frmGunSonu.cs` |
| RM | `C:\Users\batuh\OneDrive\Masaüstü\atia\AtiaHelpers\Reporting\ReportManager.cs` |
| DM | `C:\Users\batuh\OneDrive\Masaüstü\atia\AtiaDataAccess\Dapper\RestorantMasa.cs` |
| DD | `C:\Users\batuh\OneDrive\Masaüstü\atia\AtiaDataAccess\Dapper\StokFisDetay.cs` |
| DH | `C:\Users\batuh\OneDrive\Masaüstü\atia\AtiaDataAccess\Dapper\StokFisBaslik.cs` |
| WEB | `C:\Users\batuh\OneDrive\Masaüstü\AtiaRestorantWeb\AtiaRestorant.API\Data\RestaurantRepository.cs` |
| API | `C:\Users\batuh\OneDrive\Masaüstü\AtiaRestorantWeb\AtiaRestorant.API\Program.cs` |
| WM | `C:\Users\batuh\OneDrive\Masaüstü\AtiaRestorantWeb\AtiaRestorant.API\Models\Models.cs` |

## 2. Giriş, mimari ve gerçek veri modeli

- Mini uygulamanın aktif `Main` metodu `frmRestorantMasaDuzeni` açar; çıkışta gün sonu e-postası bağlama satırı yorumdadır. Dosyanın başındaki uzun `GunSonuRapor` bloğu çalışır özellik sayılmamalıdır (E:29–356, 361–370).
- .NET Framework 4.5.2/WinForms, DevExpress 21.2, cihaz/Caller-ID kütüphaneleri ve ortak Atia projelerine bağımlılık vardır. Bunlar doğrudan tarayıcıya taşınabilecek bir bağımsız restoran modülü değildir (PROJ:12, 68–106, 139–162).
- Eski LINQ-to-SQL `RestorantProvider` ile Dapper/SQL kullanan `NativeProvider`/`RestorantService` bir aradadır. Özellikle **masalı** `AdisyonOlustur(RestorantMasa,...)` gövdesi yorum olup `null` döner; `MasaDegistirme`/`MasaBirlestirme` eski gövdeleri yorum ve dönüşleri `false`tur (P:43–87, 157–312, 314–520). Masasız `AdisyonOlustur(...)` ise `RestorantAdisyon`/`SiparisBaslik` oluşturur; aktif olması, güncel masa ekranının bunu kullandığını göstermez (P:89–129).
- Güncel standart sipariş ekranı **`StokFisBaslik` + `StokFisDetay`**, `PerakendeSatisIrsaliyesi`, şirket/dönem, depo, kasa, cari ve personel üzerinden çalışır. Dolayısıyla restoran hesabı ERP stok/finans belgesidir; yalnızca masa ve ürünlerden oluşan geçici bir sipariş listesi değildir (O:155–187, 193–241).
- Masa açık hesap bağlantısı `AktifAdisyonKayitNo`, fiziksel birleşim `AnaMasaKayitNo`, işlem işareti `MasaIslem`, isimli/hızlı satış kökenli durum `SiparisMasa`/`SiparisAdi` alanlarıdır (DM:85–152; S:64–98). Satır `Kapali`, seçili ödeme miktarı `KullanilanMiktar`, mutfağa gönderilmiş miktar `YazdirilanMiktar`, `Ikram`, hazırlık durumu ve porsiyon ayrı boyutlardır (DD:437, 497, 1237, 1367–1417). Başlık kapalı bilgisi ve yemek kartı/tip toplamları da ayrıdır (DH:367, 1437–1447).

> Yazım notu: Bu rapordaki gerçek metot adı `AdisyonOlustur`dur; eski ve güncel modeller isim benzerliği nedeniyle birbirinin yerine kullanılmamalıdır.

## 3. Çalışan masa/adisyon yaşam döngüsü

### Açma, sipariş, kaydetme

1. Birleşmiş alt masaya basmak ana masaya yönlendirir. Kullanıcı/admin, personel şifreli giriş ayarı ve kişi sayısı ayarı akışı değiştirir; kişi sayısı her durumda sabit değildir (M:777–831, 864–888).
2. `RestorantFormTipi` ayarı Pizza veya standart sipariş ekranını seçer; iki ekranın davranışları eş kabul edilmemelidir (M:891–959).
3. Standart ekran oturumu kontrol eder, depo zorunluluğunu ve kullanıcı/global varsayılan cari-personel ayarlarını uygular. Kapalı başlık bulunursa masa bağlantısını temizler; yeni hesap ERP perakende satış irsaliyesidir (O:68–83, 155–241).
4. Ürün eklemek aynı stok/porsiyonsuz/ikramsız satıra miktar ekleyebilir veya ayrı satır açar. Mevcut satırın yazdırılmış miktarı artırılmaz; böylece sonraki mutfak çıktısı farkı bulabilir. Yeni malzeme satırında stok KDV'si (yoksa 10), KDV dahil fiyat, birim, personel ve kullanıcı bilgisi vardır (O:762–865).
5. İlk kayıt öncesi masada başka adisyon oluşmuş mu kontrol edilir; varsa mevcut hesapla devam önerilir. Ardından belge numarası, birim dönüşümü, satır/dip KDV ve genel toplam hesaplanır (O:932–961). **Bu kontrol atomik kilit veya DB benzersizlik garantisi değildir.**
6. Standart ekranda normal onay mutfak çıktısını denedikten sonra kaydeder; çıktı başarısızsa yine kayıt denemesi yapıp ekranı açık bırakır. “Kaydet-kapat” yolu ise fiziksel çıktı göndermeden `YazdirilanMiktar=Miktar` ve `RezerveDurumYazdirildi=true` yapar (O:963–1009, 1545–1565). Bu mevcut davranış işletmeyle doğrulanmadan “kaydet” ve “mutfağa gönder” aynı komut yapılmamalıdır.

### Masa işlemleri birbirinden farklıdır

| İşlem | Kanıtlı anlam / koşullar | Kanıt |
|---|---|---|
| Yerleşimde sürükleme | Masa koordinatlarını değiştirir; hesabın başka masaya taşınması değildir. | M:693–775 |
| Masa taşıma | Aynı başlık kimliğini boş hedefe bağlar; kaynak aktif bağını temizler, başlıktaki masa kimliğini ve isimli-sipariş alanlarını taşır. UI ana masa/işlemde masa kontrolleri de uygular. | M:969–1010; S:601–669 |
| Masa ayırma | Seçilen miktarları yeni hedef başlığa geçirir. Tam miktarda mevcut satır taşınır; kısmi miktarda yeni satır yaratılır ve yazdırılmış miktar bölüştürülür; iki hesap yeniden hesaplanır. | S:734–882, özellikle 785–838 |
| Masaları toplama | Hesapları ana hesapta toplar, kaynak başlıkları kaldırıp kaynak masaları serbest bırakır; kalıcı fiziksel ana-alt masa bağı kurmaz. | S:884–1075, özellikle 1011–1036 |
| Masa birleştirme | Hesapları toplamanın yanında kaynak masaları `AnaMasaKayitNo` ile ana masaya bağlar. Birleşimden çıkarma yalnızca bağı kaldırır; eski hesapları yeniden yaratmaz. | S:1077–1272, özellikle 1200–1235 |

- Toplama/birleştirmede ana masa boşsa seçili dolu bir masanın hesabı kullanılabilir; tüm masalar boşsa reddedilir. UI bu komutları doğrudan güncel servise gönderir (S:909–925, 1102–1119; M:1456–1495).
- Toplama/birleştirme, kapalı satırları ayrı taşırken açık satırları stok/ekstra adı + ikram + porsiyon anahtarına göre birleştirebilir. Finans hareketlerinin `HareketFisKayitNo` bağları da ana hesaba geçirilir; bu bir ekran gösterimi işlemi değildir (S:945–1036, 1135–1226).
- Ayırma UI kaynakta nakit/cari/banka tahsilatı varsa engeller; yemek kartı/tip aynı koşulda yoktur. Hedef boş, işlem dışı ve alt masa olmamalıdır (M:1200–1251). Bölme ekranı bütün hesabı taşımayı engellemeye çalışır ve hareketleri **birer miktar** artırıp azaltır (SPLIT:91–157). Kesirli miktar davranışı ayrıca doğrulanmalıdır.
- **Kritik kaynak hatası:** bölme ekranı `Where(sd => sd.Kapali = true)` kullanır; karşılaştırma değil atamadır. Bellekte gezilen satırları kapalı yapıp hepsini seçer, sonra DTO'ya `Kapali=false` yazar (SPLIT:60–84). Bunun DB'ye hangi aşamada yansıdığı çalıştırılmadan kesinleştirilemez; “yalnızca açık satırlar bölünür” diye güvenilmemelidir.

### Tahsilat ve kapatma

- Kaydedilmemiş satırlar için ödeme engellenir. Seçili ürün/miktar ödemesi ve tüm hesap ödemesi vardır; seçili miktar `KullanilanMiktar` ile tutulur, ikram seçimi engellenir (O:1782–1811, 2116–2154, 2552–2594).
- Kısmi satır tahsilatında açık miktar azaltılır, tahsil edilen miktar için ayrı `Kapali=true` satır açılır. Tam seçili miktarda mevcut satır kapanır. Tüm hesap ödemesi bütün açık satırları kapatır; ödenmemiş ikramsız satır kalmazsa kalan ikramlar ve başlık kapanır (O:1816–1928).
- Ödeme diyaloğu indirim yüzdesi/tutarı, nakit, kart, cari, yemek kartı ve tip box alanları kullanır. Tutarlar kalan üzerinden sırayla sınırlandırılır; kasa/banka POS/cari seçimi ve cihaz sonucu süreci etkiler (PAY:59–135, 280–434, 585–686).
- Nakit, kasa bağlantılı `CariHesapFisi`/detay; kart, banka/POS bağlantılı `BankaFisi`/detay; cari ödeme, müşteri borç dekontu üretir. Bunlar sadece başlıktaki sayaç artışı değildir. Ödeme oluşturma hataları yakalanıp `null` dönebilir (N:5417–5539, 5627–5650).
- Tam kapatma yolunda finans `Native.Commit()` ile, sonrasında ödeme toplamları servisle ayrı kaydedilir; sonra standart sipariş ekranı satır/başlığı ayrı kaydeder ve masa/alt masa/isimli sipariş bağlarını bağımsız SQL komutlarıyla temizler (PAY:1118–1167; O:1863–1877, 1923–1969). POS, e-Adisyon ve kapanış çıktısı da bu akışın dış etkileridir (O:1932–1961).
- “Kaydet-kapat” ödeme yolunda görülen `Native.Commit` satırı yorumdadır; tam kapatma yolunda aktiftir (PAY:662, 1124). Bu iki dalın finans kayıt dayanıklılığı aynı varsayılamaz; tüm yaşam döngüsü/DB senaryosu doğrulanmalıdır.

## 4. Porsiyon, ekstra, ikram, iptal ve zayi

| Kavram | Mevcut semantik | Kanıt |
|---|---|---|
| Porsiyon | Stok+porsiyon özel fiyatı varsa o, yoksa temel satış fiyatı × porsiyon değeri kullanılır. Aynı stok/porsiyon satırına birleşebilir, yazdırılmış miktar da aktarılır. | O:2229–2364 |
| Serbest ekstra | `frmStokEkstra` adı/miktarı/birimi/fiyatı olan, stok kimliği olmayan ayrı malzeme satırı üretir; KDV 0, asıl ekstra fiyatı ayrıca saklanır. | O:1496–1530 |
| Pizza içeriği | `RestorantIcerik`, seçilen içerik fiyatları ve açıklama seçimleriyle çalışır; serbest ekstra satırı ile aynı model değildir. | PIZ:907–918, 2664–2741 |
| İkram | Miktarı koruyup fiyatı sıfırlar; geri alma mevcut temel/porsiyon/ekstra fiyatına döner. Kısmi miktarda ayrı ikramlı/ikramsız satır yaratıp yazdırılmış miktarları düzeltir. | O:2366–2545 |
| Satır iptali | Yetki/ayar ve kalan tutar kontrolü, gerekirse mutfağa iptal çıktısı vardır. Çok satırlı normal silme doğrudan `Native.DeleteDirect` kullanır; iptal geçmişi yazan servis çağrısı bu dalda yorumdadır. | O:1993–2050 |
| Masa/adisyon iptali | Normal masa iptali servis tarafında nakit/banka/cari/yemek kartı/tip toplamlarını kontrol eder; içerik/satır/başlık ve masa bağlarını temizleyebilir, opsiyonel iptal geçmişi oluşturur. | O:1013–1055; S:381–482 |
| Zayi | Personel doğrulaması, geri dönüşsüz onay ve açıklama ister; satırı `OzelKod1="1"` ile işaretleyip `RestorantSiparisIptal` kaydını `FisIptalTipi=2` olarak yazar. Satırı doğrudan silmez. Ekran/rapor bu işaretli satırları ayrıca ele alır. | O:331–338, 901–914, 2629–2665 |

İkram, iptal ve zayi tek bir “sil/sıfırla” eylemine indirgenemez. Pizza içerikleri kayıttan sonra, UI satır indeksine bağlı bekleyen listeden ayrıca eklenir; mutfak sonrası yazdırılmış bilgileri için ikinci servis kaydı yapılır (PIZ:897–945). İçerik ekleme/silme, yeniden sıralama ve bölme sonrası bağların korunması ayrıca sınanmalıdır. İkramın kısmi serbest-ekstra dalı stok kartı olmayan satırda `StokKarti.KdvGenel` kullanır; null erişim riski vardır (O:2439–2478, özellikle 2446).

## 5. Stok, KDV, indirim ve raporlama

- Ürün ekleme stok bakiyesini hareket fişi türleri, dönem/tarih, depo ve e-fatura iptal durumu üzerinden hesaplar. Negatif stok ayarı engellemeyi değiştirebilir. Bu, menüdeki tek bir stok sayacını azaltmak değildir (O:748–759, 795–813).
- `Miktar`, `NetKg`, `BrutKg`, birim dönüşüm çarpan/böleni ve fiyatlandırma miktar tabanı ayrı kavramlardır; ayar ve stok kartı miktar/net/brüt seçimini etkiler (N:1945–2012, 2086–2106). Bu dönüşümde porsiyon/menü reçetesinin stok tüketimine nasıl yansıdığı kanıtlanmış değildir. Pizza ekranında menü içeriği kullanımı vardır; bundan otomatik reçete sarfı sonucu çıkarılamaz (PIZ:1582–1590).
- Hızlı satış birim fiyatı iki ondalık `ToEven` yuvarlanır. KDV dahil fiyat `BirimFiyat / (1 + KdvYuzdesi/100m)` ile ayrıştırılır; satır/dip indirim, masraf, KDV, tevkifat ve fatura toplamları da hesaplanır (N:2120–2146, 2151–2224, 2268–2402).
- **İndirim sözleşmesi çelişkili:** genel hesaplama `IndirimToplam`ı hesaplanan indirimlerden yazar ve genel toplamdan düşer; ödeme diyaloğu bu alanı ayrıca artırır; standart ekran kalan ve kapanışta tekrar düşer. Standart kalan formülü yemek kartını içermezken ödeme diyaloğunun formülü içerir (N:2353–2376; PAY:1130–1142, 1421; O:298–309, 1913–1919). Kesin mali sonuç, nakit+kısmi ödeme+indirim+yeniden açma senaryolarıyla doğrulanmadan yeni sisteme aktarılmamalıdır.
- Gün sonu yalnız takvim günü değildir: önceki/sonraki gün seçimi, başlangıç/bitiş saatleri, şirket kullanıcıları ve kasa filtreleri vardır (DAY:179–230). Rapor açık masa bağlantılarını, stok belgelerini, cari/kasa/banka hareketlerini ve bazı başlık-toplam yedek kaynaklarını birlikte kullanır; yemek kartı ve tip box da görünür (DAY:521, 602–608, 665–671, 725–732, 778–804, 812–973, 1212–1251). Yedek toplama kodu üretim verisinin bozuk olduğunu tek başına kanıtlamaz.

## 6. Mutfak, adisyon ve cihazlar

- Mutfak satırları stok grubunun yazıcısı veya varsayılan yazıcıya yönlenir. Noktalı virgülle birden çok yazıcı desteklenir; çıktı miktarı normalde mevcut miktar eksi yazdırılmış miktardır. İkram/porsiyon/not/personel ve hazırlık durumları rapora gider (O:1251–1353, 1385–1418).
- Satır hazırlık `Rezerve`, `Marş`, `Rezerve İptal` durumları **masa rezervasyonu değildir**. Marş işaretinin yazdırılmış sayılması farklıdır. Standart ekrandaki `btnMars_Click` gövdesi tamamen yorumdur; raporlama desteği olması tüm durum değiştirme UI'larının çalıştığını göstermez (O:1350–1352, 1408–1418, 2602–2627).
- Artış, azalış/iptal ve durum değişimi farklı çıktılardır; iptal delta miktarı yazdırılmış eksi mevcut miktardır. Bazı iptal/adisyon yazdırma hataları yutulur (O:1123–1243, 1322–1341, 926–929).
- Adisyon öncesi `AdisyonYazdirildi=true` kaydedilir; bu fiziksel kağıt teslim kanıtı değildir (O:878–918). `ReportManager.RaporYazdir` şablon dosyası yoksa hata vermeden hiçbir şey yapmadan döner; bu nedenle mutfak kodunun hata almaması dahi çıktı üretildiğini garanti etmez (RM:349–370).
- Pizza mutfak varyantında `MutfakFisiYazici.json` filtreleri ve içerik/default içerikten çıkarılanlar vardır; standart formda aynı filtre yükleme bloğu yorumdadır (PIZ:1236–1249, 1272–1306; O:1298–1313).
- `RestorantService.MasaAdisyonYazdir`, `MasaMutfakFisiYazdir` ve `RestorantGunBitir` varsayılan başarısız sonuç döndüren boş uçlardır. Gerçek çıktı UI/rapor yolundadır (S:25–34, 50–62, 1379–1384). Cihaz ve rapor bileşenlerini bu boş metotlara bakıp gereksiz saymak yanlış olur.

## 7. Çok kullanıcılık, yetki ve veri bütünlüğü

**Tek kullanıcı varsayımı desteklenmiyor.** Oturum, kullanıcı, personel, şirket/dönem, eşzamanlı açılan hesabı kontrol etme ve masa işlem işaretleri açıkça vardır (O:68–83, 221–241, 937–946; M:789–888, 969–998). Bunlar sağlam dağıtık kilit kanıtı da değildir.

- `MasaIslem` sadece bool alanıdır. Temizleme tüm `MasaIslem=1` masalarını seçip serbest bırakır; işlem sahibi/oturum/lease koşulu bu yolda yoktur. Bir istemcinin diğerinin işaretini kaldırması riski vardır (DM:125–132; M:1553–1564; S:484–531). Çok terminalli yarışlar çalışma zamanında doğrulanmalıdır.
- Yetkiler yalnız admin/garson ayrımı değildir: ikram 2105, fiyat 2106, porsiyon 2107, miktar 2108, kaydedilmiş silme 2109; iptal 2104, zayi 2111, masa adı 2112; ayarlar ve garson hesap alma/çıktı kısıtları ayrıca vardır (O:255–274, 1675–1695). UI olayları buton etkinliğini tekrar değiştirebilir; tek bir buton satırından tam izin matrisi çıkarılmamalıdır (O:101–105, 2594).
- Servis kaydı reflected değerlerden doğrudan SQL metni kurar; string kaçış/parametreleme yapılmayan alanlar vardır. Kesme işaretli açıklama SQL'i bozabilir; güvenilmeyen metin SQL enjeksiyonu yüzeyi oluşturur (S:113–159, 274–299). Bu kod modernizasyona kopyalanmamalıdır.
- Servis bölme/toplama/birleştirmede yerel bağlantı/transaction ile NativeProvider'ın ayrı bağlantı/transaction'ını karıştırır. Native doğrudan komutları kendi transaction'ında yürütür, `ReadUncommitted` kullanır; provider commit'i yerel commit'ten önce gelir (N:104–126, 956–972, 1523–1540; S:857–861, 1050–1054, 1247–1251). Ortak atomik işlem kanıtı yoktur; hata halinde kısmi sonuç olasılığı önemlidir. Native `Dispose` transaction'ı sıfırlayıp bağlantıyı kapatır (N:7083–7097).

### En kritik kaynak anomalileri — iş kuralı diye taşınmamalı

| Öncelik | Kaynak bulgusu | Risk / doğrulama |
|---|---|---|
| Kritik | Toplama ve birleştirmede nakit toplandıktan sonra cari, banka ve indirim toplamları **hep `NakitToplam`a atanıyor**. | Ödeme toplamı alanları kaybolabilir/yanlış olabilir; iki yöntemde de açık kaynak hatası (S:1006–1009, 1195–1198). Yemek kartı/tip bu bloklarda birikmiyor. |
| Kritik | Ayırma ekranında `Kapali = true` ataması. | Kapalı/açık ayrımı ve tahsil edilmiş satır bütünlüğü (SPLIT:60–84). |
| Yüksek | Satır eşleştirme stok/ekstra adı+ikram+porsiyon ile; fiyat, açıklama, içerik ve gerçek detay kimliği yeterince ayrıştırılmıyor. | Farklı fiyat/not/içerikli siparişler yanlış birleşebilir; bölmede yanlış eş satır seçilebilir (S:785–789, 945–1002, 1135–1190). |
| Yüksek | Ödeme, satır kapama, başlık kaydı, masa serbest bırakma ve cihaz etkileri ayrı aşamalar. | Tekrar deneme/çift tahsilat/kısmi commit telafisi gerekir; kaynakta bütün akışın atomikliği kanıtlanmadı (PAY:1124–1167; O:1863–1969). |
| Yüksek | UI kontrolleri servis sınırının tamamında tekrarlanmıyor; taşıma doluluk okuması transaction öncesi. | Aynı boş hedefe eşzamanlı taşıma/bölme ve yetkisiz doğrudan çağrı senaryoları doğrulanmalı (S:611–629, 734–882). |
| Yüksek | İndirim ve kalan formülleri uyumsuz, iptal geçmişi bazı silme yollarında atlanıyor. | Mali mutabakat/audit sözleşmesi açık değil (bölüm 4–5 kanıtları). |
| İncelenmeli | Yeni standart başlık oluşturulurken global son `CariHesapFisi` kimliği yüklenip atanıyor. | Başka belgeye finans bağı ihtimali; amaç/DB etkisi doğrulanmalı (O:154, 240). |

`AdisyonIptal` ve `BaslikSil` normal masa iptalinden farklı silme yollarıdır; finans/fatura kayıtlarını da silerler. İlki aynı ödeme korumasını göstermiyor; ikincisinde stok detayı silme koşulu `HareketFisKayitNo` kullanır. Güncel UI çağrısı ve şema doğrulanmadan bunlar kullanıcı gereksinimi veya güvenli genel silme servisi sayılmamalıdır (S:533–599, 671–732).

## 8. Rezervasyon ve tarihsel/eksik kod sınırı

- Masa görünümü rezervasyon varlığını join'den türetir; join'de tarih/kapalı koşulu yoktur. Bu, tarihsel rezervasyonun masa görünümünü etkilemesi/çoklu kayıtla çoğalma riski taşır; gerçek DB kayıtları ve kısıtları bilinmiyor (S:64–98, 1274–1312).
- Rezervasyon ekranının kayıt/iptal kodu var; fakat “Adisyon aç” eski masalı `AdisyonOlustur` metoduna gider ve bu metot `null` döner. Masa açılışındaki rezervasyon bağlama bloğu da yorum/TODO'dur. Dolayısıyla rezervasyonun güncel stok başlığına eksiksiz dönüşümü kanıtlanmış özellik değildir (RES:71–99, 138–166; P:43–87; M:833–862).
- Rezervasyonda farklı masa seçildiğinde `DeleteObject(ModelObject.RestorantMasa)` çağrısı görülür. Gerçek niyet ve silinen varlık/ilişki etkisi DB/base provider ile doğrulanmadan uyarlanamaz (RES:90–95).
- Yorum satırları, boş servis uçları ve tamamlanmamış varyant eylemleri “gereksiz ekranlar”ın otomatik silinmesine gerekçe değildir. Aktif çağrı, etkin ayar, işletme kullanımı ve bağlı kayıtlar birlikte değerlendirilmelidir.

## 9. Web demosu: legacy kusurlarından ayrı parite değerlendirmesi

Bu bölüm **legacy kusuru** değil, mevcut web kaynağının kapsam farkıdır. Demo açıkça process-local olarak tanımlanmış, tek process kilidi ve kopya snapshot kullanmaktadır (WEB:21–33, 59–69). SQL modu bütün sağlık dışı istekleri 503 ile kapatır; sağlık `DatabaseReady=false` bildirir. SQL ERP entegrasyonu varmış gibi değerlendirilmemelidir (WEB:54–57; API:100–119).

| Alan | Demo kanıtı | Legacy ile fark |
|---|---|---|
| Kalıcılık/eşzamanlılık | Bellekte listeler, singleton repository, `_gate` (WEB:24–33, 60–69; API:20). | Tek process içinde seri işlem, kalıcı ERP transaction'ı/çok sunuculu koordinasyon değildir. Bu demo sınırı açıkça korunmuş. |
| Masa/hesap açma | İlk ürünle hesap açar, kişi sayısı 2'dir; taşıma admin ve hedef rezervasyonsuz olmalı (WEB:135–140, 195–205). | Legacy kişi sayısı/personel ve isimli sipariş akışları ayarlıdır; hedef rezervasyonu engeli demo tercihi, legacy taşıma kuralı diye doğrulanmadı. |
| Toplama/birleştirme/ayırma | DTO'lar var (WM:126–143), fakat yayımlanan route setinde yalnız taşıma var; birleşmiş masa ekleme/taşımada reddediliyor (API:123–159; WEB:129, 200–201). | Model sınıfının bulunması işlevin tamamlandığı anlamına gelmez. Üç ayrı legacy komut ve finans bağları eksik. |
| Satır/fiyat/ikram | Sunucu menü/porsiyon fiyatını seçer; serbest ekstra reddedilir; ikram admin-only. Güncelleme miktar/not/ikramdır (WEB:122–167). | Legacy özel fiyat, porsiyon değişimi, kısmi ikram, ayarlı ince yetkiler ve iki farklı ekstra modeli yok. İstemciden fiyat/personel alanını kabul etmeyiş demo için olumlu sınırdır. |
| Mali hesap | `Miktar × BirimFiyat`, iki ondalık `AwayFromZero`; ikram sıfır, toplam satır toplamıdır (WEB:89–94). | KDV ayrıştırma, miktar/net/brüt tabanı, birim dönüşümü, dip işlemleri ve legacy yuvarlamasıyla eşdeğer değil. WM satır/başlık modelinde bunların alanları yok (WM:43–82). |
| Ödeme | Tek çağrıda nakit+banka+cari+yemek kartı+indirim toplamı hesabın tam tutarına eşit olunca kapanır (WEB:180–192). | Karma tender var; fakat avans/kısmi tahsilat, seçili satır miktarı kapama, tip box, gerçek kasa/banka/cari fişi ve POS/e-Adisyon üretimi bu yolda yok. |
| İptal/zayi | Satır siler, boş hesap açık kalır (WEB:170–177). | Legacy son satır/masa iptali, mutfak iptal deltasının gönderimi, iptal geçmişi ve zayi ayrı akışları karşılanmıyor. |
| Mutfak | Ayrı `_ready` miktarı ve bütün hesabı hazır işaretleme (WEB:208–225); model hazır miktarı ile ERP yazdırmayı açıkça ayırır (WM:186–198). | KDS hazırlığı yararlı ayrı boyut; yazıcı yönlendirme, delta/iptal, Rezerve/Marş ve şablon çıktısının yerine geçmez. |
| Gün sonu | İstanbul takvim günü, kapama zamanına göre bellek hesapları (WEB:34–45, 228–243). | Ayarlı gece aşan işletme günü, şirket/dönem/depo/kasa/kullanıcı filtreleri ve finans-stok mutabakatına eşdeğer değil. |
| Güvenlik ve bildirim | JWT doğrulama, Admin/Garson/Mutfak politikaları; değişiklik sonrası SignalR invalidation (API:26–53, 128–160, 178–184). | “Tek kullanıcılı web” demek yanlış. Ancak rol üçlüsü legacy izin/ayar matrisiyle parite sağlamaz; bildirim bir DB kilidi veya kalıcı audit değildir. |

Bu farklar demo için otomatik “bug” değildir; **üretime hazır legacy eşdeğeri** olduğu iddiasını sınırlar. Demo güvenli biçimde SQL'i kapatırken, doğrulanmamış şemaya bağlanıp gerçek kayıt yazmak bu incelemenin sonucu değildir.

## 10. Modernizasyon öncesi doğrulanması gerekenler ve ayıklama kararı

Henüz kanıtlanmamış varsayımlar: gerçek DB şeması/FK/trigger/index/benzersiz aktif adisyon kısıtı; şirket/dönem veri izolasyonu; belge numarası yarışları; dağıtımda standart/Pizza seçimi; kullanıcı/terminal sayısı; etkin yetkiler; reçete/porsiyon stok sarfı; ödeme/indirim mutabakatı; cihaz teslim/iptal protokolü ve yeniden deneme; rapor şablonları; e-Adisyon ve yasal belge süreçleri. Bunların hiçbiri statik koddan veya demo DTO'sundan tamam kabul edilmemelidir.

Davranış koruma için önce işletmeyle/izinli DB kopyasıyla şu senaryolar netleştirilmeli:

- İki terminalin aynı boş masayı açması; aynı hedefe taşıma/bölme; bir istemcinin diğerinin işlem işaretini temizlemesi; yeniden denenen ödeme.
- Aynı stok+porsiyonun farklı fiyat/not/Pizza içeriğiyle bulunması; bir kısmını bölme, toplama, ikram etme ve tahsil etme.
- Daha önce yazdırılmış miktara ekleme/azaltma; yazıcı veya şablon yokluğu; kaydet-kapat; Rezerve/Marş; iptal çıktısının tekrar gönderimi.
- Nakit+kart+cari+yemek kartı+tip; kısmi tahsilat sonrası indirim/ikram/iptal; satır ve başlık toplamlarının kasa-banka-cari fişleriyle karşılaştırılması.
- Kesirli birim/gramaj, porsiyon fiyatı ve negatif stok; zayinin stok/mali/rapor etkisi; gece aşan işletme günü ve açık masa devri.
- Rezervasyon kaydetme/iptal/masa değiştirme/adisyona dönüştürme; birleşimden masa çıkarma ve kapamada bütün masaların serbest kalması.

**Ayıklama kararı:** Aktif masa-sipariş-ödeme ekranları, fiyat/porsiyon/ekstra, kasa-banka-cari, stok/depo, yazıcı/şablon, personel/yetki ve gün sonu bağımlılıkları anlaşılmadan kaldırılmamalı. Yorum/taslak gövdeler uygulama çekirdeğine taşınacak gereksinim değildir; fakat hangi varyantın ve entegrasyonun işletmede kullanılmadığı bu incelemede kanıtlanmadı. Kaynak kusurları korunacak iş kuralı değil, açıkça kararlaştırılıp test edilecek düzeltme konularıdır.
