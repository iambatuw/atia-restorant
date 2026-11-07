# ATIA restoran masaüstü → web geçiş analizi

## Mevcut durum

Web uygulaması masa, adisyon, sipariş satırı, mutfak, menü, günlük rapor, rezervasyon ve POS işlemleri için API ve demo veri sağlıyor. Canlı veritabanı bağlantısı henüz yok. Giriş ekranı korunarak personel çalışma alanı yeniden tasarlandı.

## Masaüstünden alınması gerekenler

| Akış | Masaüstü kanıtı | Web durumu | Karar |
| --- | --- | --- | --- |
| Masa ve adisyon | `Atia/Restorant/frmRestorantMasaDuzeni.cs`, `frmSiparisOdeme.cs` | Masa taşıma, ayırma, birleştirme, satır notu ve ödeme API'si var | Günlük akışta tut; canlı şema eşlemesini doğrula |
| Mutfak | Masaüstü sipariş ve ürün hazırlama akışları | Canlı mutfak fişleri ve hazır işlemi var | Öncelikli tut |
| Gün sonu | `Atia/Restorant/frmGunSonu.cs` | Günlük ciro ve tahsilat raporu var | Nakit/banka mutabakatı ve iptal raporlarını sonraki API aşamasında ekle |
| Paket servis | `Atia/CallerId/frmPaketServisMain.cs` | Demo ortamında manuel sipariş, ürün, adres, kurye ve durum akışı eklendi; canlı şema yok | Öncelikli taşı; mevcut demo akışını gerçek müşteri ve sipariş tablolarına bağla |
| PlatinMarket siparişleri | `Atia/Entegrasyon/frmESiparisListesi.cs` | Web bağlantısı yok | Eski HTTP ve URL içindeki erişim kodunu kopyalama; güvenli sunucu bağlantısı ve tekrar kayıt koruması ile yeniden yaz |
| Entegra XML | `AtiaBusiness/Domain/SiparisEntegreApp/EntegraEntegrator.cs` | Web bağlantısı yok | Kullanılan mağazaları doğrulayıp sağlayıcı adaptörü oluştur |
| Getir Yemek | `Atia/Entegrasyon/GetirYemekRequests.cs` | Eski kod da tamamlanmamış | Çalışan özellik gibi taşımama; güncel sağlayıcı sözleşmesi ile ayrı geliştirme |
| Arayan numara | `Atia/CallerId/frmPaketServisMain.cs` | Web bağlantısı yok | Sadece ilgili mağazalarda yerel donanım köprüsü olarak ele al |
| e-Adisyon | `AtiaBusiness/Domain/EAdisyon/` | Web bağlantısı yok | Kullanan firmaları ve sağlayıcıyı doğruladıktan sonra sunucuda ekle |
| Rezervasyon | `Atia/Restorant/frmRezervasyon.cs` | API ve ekran var | Yaklaşık 50 mağazadan 2'si kullanıyor; ikincil menüde tut, yeni işin odağı yapma |

## Canlı bağlantıdan önce gerekenler

1. Veritabanı şeması ve örnek anonim kayıtlar: masa, adisyon, satır, ödeme, ürün, müşteri, paket servis ve mağaza ayarları.
2. Hangi mağazalarda hangi POS, sipariş ve e-Adisyon sağlayıcısının kullanıldığı.
3. Sağlayıcıların güncel API bilgileri ve test hesapları; erişim bilgileri kaynak koduna veya tarayıcıya yazılmamalı.
4. Masaüstü ile web aynı veriyi kullanacaksa iki sistemin işlem çakışması ve mükerrer tahsilat kuralları.

## Önerilen uygulama sırası

1. Canlı veritabanı adaptörü ve mağaza bazlı yetki sınırları.
2. Paket servis panosu ve kurye iş akışının canlı ERP tablolarına bağlanması.
3. Gerçek POS terminal köprüsü ve mutabakat.
4. Kullanılan çevrim içi sipariş kaynakları için ayrı adaptörler ve sipariş eşlemesi.
5. Gün sonu iptal, iade ve mutabakat raporları.
