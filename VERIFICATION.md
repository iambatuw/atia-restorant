# Doğrulama — 6 Kasım 2026

## Otomatik kontroller

- Mimari: **Tek Birleşik Proje Yapısı** — ASP.NET Core doğrudan `wwwroot` altındaki derlenmiş React SPA uygulamasını barındırır.
- Ön yüz: `cd ClientApp && npm test` — **12 geçti, 0 başarısız**. Kuruş hassasiyeti, ödeme girdileri, POS durum makinesi, tarih biçimi, TL gösterimi, PascalCase API zarfı, bearer header ve hata aktarımı.
- Ön yüz üretim derlemesi: `cd ClientApp && npm run build` — TypeScript ve Vite derlemesi başarılı; statik dosyalar doğrudan `wwwroot/` klasörüne aktarılmıştır.
- API: .NET 10 xUnit — **19 geçti, 0 başarısız, 0 atlanan**. Repo/HTTP sözleşmesi, yetkiler, parçalı ödeme, POS entegrasyonu, masa ayırma/birleştirme/taşıma, fiyat otoritesi, eşzamanlı işlem, mutfak hazırlık durumu, SQL modunun fail-closed kapalı olması ve İstanbul gün sınırı kontrolleri.
- Tek Port Canlı Çalışma: `dotnet run --urls http://127.0.0.1:5080` ile hem REST API (`/api/*`), hem SignalR Hub (`/hubs/*`), hem statik varlıklar (`/assets/*`), hem de React istemci rotaları (`/menu`, `/`, vb.) tek port ve tek süreç üzerinden başarıyla doğrulanmıştır.

## Gerçek tarayıcıda denenenler

- Demo yönetici girişi, masa planının yüklenmesi ve canlı bağlantı göstergesi.
- Boş Masa 2 seçimi; Mercimek Çorbası ekleme: 95 TL.
- Adedi ikiye çıkarma: 190 TL.
- 190 TL nakit ödeme onayı; adisyonun kapanması ve Masa 2'nin boş görünmesi.
- Mobil müşteri menüsü: 375px genişlikte 11 ürün, sayfa düzeyinde yatay taşma yok.
- Türkçe ürün araması: `köfte` araması yalnızca Izgara Köfte sonucunu veriyor.
- Mobil görünüm ekran görüntüsü ve ürün computed style kontrolü.

API yeniden başlatıldı ve demo sıfırlandı. Yeniden girişte tarayıcı otomasyonunun demo şifresini doldurması izin katmanında engellendi; bu engel aşılmadı. Bu nedenle son başlatılan süreçte mutfağın hazır işaretleme, rezervasyon ve diğer rol ekranlarının tam tarayıcı turu tamamlanamadı. Bunların sunucu davranışları otomatik testlerle kontrol edildi; tüm ekranların uçtan uca tarayıcı testi yapıldığı iddia edilmez.

## Doğrulanmayan / kullanıma hazır olmayan alanlar

Gerçek SQL Server bağlantısı ve veri kalıcılığı, ERP/mali iş kuralları, banka/POS, yazıcılar, üretim kimlik yönetimi, LAN/tablet erişimi, gerçek QR yayınlama, yük testi ve çok süreçli eşzamanlılık. Demo canlı işletme kullanımına hazır değildir. Ayrıntılar README'dedir.
