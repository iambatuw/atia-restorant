# Doğrulama — 6 Kasım 2026

## Otomatik kontroller

- Ön yüz: `npm test` — **7 geçti, 0 başarısız**. Kuruş hassasiyeti/ödeme girdileri, tarih biçimi, TL gösterimi, PascalCase API zarfı, bearer header ve hata aktarımı.
- Ön yüz: `npm run build` — TypeScript ve Vite üretim derlemesi başarılı. SignalR bağımlılığında Rollup'ın kaldırdığı iki `/*#__PURE__*/` yorum uyarısı var; derleme hatası yok.
- Çalışma zamanı npm bağımlılıkları: `npm audit --omit=dev` — **0 bilinen açık** (bu, kapsamlı güvenlik denetimi değildir).
- API: .NET 10 Release derlemesi başarılı; xUnit — **14 geçti, 0 başarısız, 0 atlanan**. Repo/HTTP sözleşmesi, yetkiler, ödeme, fiyat otoritesi, eşzamanlı işlem, mutfak hazırlık durumu, SQL modunun kapalı olması ve İstanbul gün sınırı kontrolleri.

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
