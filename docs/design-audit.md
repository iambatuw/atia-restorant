# Web arayüzü incelemesi ve tasarım ölçütleri

Tarih: 6 Kasım 2026. Bu belge bir uygulama teslimi değil, mevcut demonun kaynak kodu üzerinden incelemesi ve sonraki tasarımın kabul ölçütleridir. Eski uygulamanın süreç incelemesi tamamlanmadan ekran kapsamı kesinleştirilmez.

## Kullanıcının belirlediği yön

- C# tabanlı web sürümü; işleyiş mevcut uygulamanın doğrulanmış kurallarına dayanacak.
- Tek kullanıcı/çok kullanıcı kararı sırf web'e geçildiği için değişmeyecek. Desteklenen model ile işletmede fiilen kullanılan model ayrı doğrulanacak.
- Gereksiz marka tekrarı, sloganlar, dekoratif panolar ve kalabalık ekranlar olmayacak.
- Açık ve koyu tema birbirinden bağımsız tasarlanacak; tema değişimi işlemi veya girilmiş tutarı sıfırlamayacak.
- Kart ödeme kaydı gerçek POS onayı gibi gösterilmeyecek.

## Kaynaktan görülen mevcut eksikler

Yollar ön yüzün `atia-restorant-web/src` klasörüne göredir.

| Alan | Kanıt | Değişiklik yönü |
|---|---|---|
| Marka/slogan tekrarı | `App.tsx:25-31`: sidebar marka, footer marka/slogan, girişte ayrı tanıtım alanı | Tek küçük işletme kimliği; operasyon ekranında slogan ve tanıtım alanı yok |
| Müşteri menüsünde tanıtım baskın | `App.tsx:21`: büyük karşılama başlığı ve genel lezzet metni | Menü başlığı, kategoriler, ürünler ve fiyatlar önce; işletme bilgisi doğrulandığında kullanılır |
| Koyu tema yok | `styles.css:2`: `:root` tek palet; birçok bileşende sabit beyaz arka plan | Anlamsal yüzey/metin/çizgi/aksiyon/durum değişkenleri; tüm kontroller için iki tema |
| Küçük operasyon metinleri | `styles.css:2,6`: bazı durum, süre, bölüm ve altbilgi metinleri 8–11px | Kritik masa/adisyon/ödeme metinleri 14–16px başlangıç hedefi; uzun Türkçe etiketlerle test |
| Küçük dokunma hedefleri | `styles.css:2,6`: filtreler 32px, miktar düğmeleri mobilde 36px, silme 38px | Dokunmatik operasyon eylemlerinde en az 44×44 CSS px; komşu yanlış dokunma kontrolü |
| Mobil güvenli alan | `styles.css:6`: sabit alt navigasyonda safe-area-inset ayrımı yok | Alt navigasyon ve içerik boşluğu cihaz güvenli alanını hesaba katar |
| Ekran adresi/geri dönüş | `App.tsx:16,23-25`: personel ekranı yalnızca bileşen state'inde | Tarayıcı geri/ileri ve doğrudan ekran adresleri için tasarlanmış gezinme; seçili masa davranışı açık |
| Form hataları | `Tables.tsx:27-29`: ödeme toplamı hatası var; alan bazlı ilişki kurulmamış | Geçersiz alanlara bağlı açıklama, aria-invalid ve hata anonsu; hatada girilmiş tutarı koru |
| Dialog adı ve Escape davranışı | `ui.tsx:10`: başlık dialog'a aria-labelledby ile bağlı değil; onCancel varsayılan kapamayı durdurmuyor. `Tables.tsx:29` ödeme sürerken onClose'u yok saysa da tarayıcı Escape ile dialog'u kapatabilir | Dialog'u başlıkla adlandır; iptal olayının varsayılan davranışını kontrol ederek açık/kapalı state'ini ve işlem durumunu eşleştir. Otomatik test ve gerçek klavye turuyla doğrula |
| Masa planının anlamı | `Tables.tsx:14`: masalar otomatik grid olarak çiziliyor; fiziksel X/Y koordinatları kullanılmıyor | Kullanıcının gerçek ihtiyacına göre fiziksel salon planı ile hızlı masa listesini ayır; mevcut grid'i eski planın bire bir karşılığı diye sunma |
| POS belirsizliği | `Tables.tsx:28-29`: banka tutarı gönderilip adisyon kapanıyor; cihaz çağrısı yok | Demo kart kaydı açıkça etiketlenir; gerçek akış onay, red, zaman aşımı ve belirsiz sonuç durumlarını ayırır |
| Demo rollerinin kesin sanılması | `App.tsx:23`, `Tables.tsx:24`: Admin/Garson/Mutfak kararları | Gerçek yetki kaynağı incelenmeden bu üç rol nihai ürün modeli sayılmaz |

Bu inceleme kaynak koduna dayanır. Tam ekran okuyucu veya tüm ekranlar için yeni bir tarayıcı turu yapılmadı. Önceki testlerin sınırları `VERIFICATION.md` içindedir.

### Hesaplanan mevcut kontrastlar

`styles.css` içindeki sabit renk çiftleri sRGB doğrusal parlaklık ve WCAG kontrast formülüyle Node üzerinde hesaplandı. Bunlar mevcut kaynak değerlerinin hesaplarıdır; tarayıcı computed style, transparan katmanlar, hover/focus veya bütün ekranların kontrast denetimi değildir.

| Örnek metin / yüzey | Ön plan / arka plan | Oran | Küçük metin AA 4.5:1 |
|---|---|---|---|
| Ana metin / sayfa | `#1c3442` / `#f5f7f9` | 12.08:1 | Geçer |
| İkincil metin / beyaz | `#687b88` / `#ffffff` | 4.40:1 | Kalır |
| İkincil metin / sayfa | `#687b88` / `#f5f7f9` | 4.09:1 | Kalır |
| Süre / dolu masa | `#6d8378` / `#f0f7f3` | 3.74:1 | Kalır |
| Bölüm / boş masa | `#7d909c` / `#ffffff` | 3.31:1 | Kalır |
| Adisyon meta / beyaz | `#81929d` / `#ffffff` | 3.22:1 | Kalır |
| Birim fiyat / beyaz | `#8a9aa4` / `#ffffff` | 2.90:1 | Kalır |
| Altbilgi / sayfa | `#7b8f9d` / `#f5f7f9` | 3.12:1 | Kalır |
| Ana düğme metni | `#ffffff` / `#126857` | 6.68:1 | Geçer |
| Ürün fiyatı / beyaz | `#2f5d4e` / `#ffffff` | 7.51:1 | Geçer |
| Mobil gezinme | `#b8ccd8` / `#132c3b` | 8.73:1 | Geçer |

Sonuç: paletin tamamını gelişigüzel değiştirmek gerekmiyor; özellikle ikincil operasyon metinleri ve küçük bilgi etiketleri sorunlu. Koyu tema eklerken bu açık tema kusurları da giderilmeli.

### Bu incelemede tarayıcıyla kontrol edilenler

Giriş gerektirmeyen `/menu` ekranı 375×812 emülasyonda açıldı; kimlik bilgisi girilmedi.

- Sayfa genişliği 375px, ürün sayısı 11; sayfa düzeyinde yatay taşma yok.
- Kategori düğmelerinin gerçek kutu yüksekliği 34px: 44px dokunma hedefi ölçütünü sağlamıyor.
- Ürün kategori metni computed style: 10px, `rgb(104, 123, 136)`; ürün yüzeyi beyaz. Yukarıdaki 4.40:1 kontrast hesabı bu bileşen için computed style ile de eşleşiyor.
- Sistem koyu görünümü emüle edildiğinde `prefers-color-scheme: dark` true; kök yüzey `rgb(245, 247, 249)` ve ürün yüzeyi beyaz kaldı. Koyu görünüm desteğinin eksikliği tarayıcıda da görüldü.
- Kontrol sonunda boyut emülasyonu desktop'a, renk emülasyonu light'a döndürüldü. Personel ekranlarının tam turu yapılmadı.

## Operasyon odaklı düzen

Masa ekranının asıl işi seçilen masanın adisyonunu hızlı ve hatasız yönetmektir. Menü ve raporları aynı ağırlıkta sergileyen genel amaçlı bir yönetim panosu değildir.

- Geniş ekran: bölümler/durumlar ve masalar solda; seçili adisyon sağda; ödeme toplamı ve ana işlem sabit ve görünür.
- Tablet: dokunma hedeflerini küçültmeden iki alanı koru; sığmıyorsa seçili adisyonu ayrı görünümde aç.
- Telefon: masadan adisyona açık geri dönüş; eklenen üründen sonra seçim bağlamını koru. Müşteri menüsü personel ekranından bağımsızdır.
- Mutfak: ürün, miktar, not ve bekleme süresi; hazırlık durumu yazdırma sayacı ile karıştırılmaz.
- Ödeme: büyük ve sabit tutar, ödeme yöntemi, cihaz durumu; tahsilat belirsizse başarı görünümü yok.
- Nadir işlemler bağlamsal ikincil menüye alınabilir. Birleştir/böl/ikram/iptal gibi mali etkili özellikler yalnızca nadir göründükleri için silinmez.

## Tema sistemi ve ölçülebilir kabul koşulları

Henüz nihai palet uygulanmadı. Önce `surface`, `surface-raised`, `text`, `text-muted`, `border`, `action`, `focus`, `success`, `warning`, `danger` rollerine iki ayrı değer kümesi verilecek. Mevcut teal ve navy değerleri zorunlu marka rengi sayılmıyor.

1. Açık/koyu/sistem tercihi; ilk ziyarette sistem görünümü, kullanıcının açık seçimi cihazda sürümlü biçimde saklanır. İşletme/tablet kullanımında kullanıcı kontrolü, native Apple kuralından daha önemlidir.
2. Metin kontrastı normal metinde en az 4.5:1; büyük metinde en az 3:1; odak ve kontrol sınırları için ilgili WCAG 2.2 AA ölçütleri. Hex çiftlerinden hesaplanır; ekran görüntüsünden tahmin edilmez.
3. Dolu/boş/rezerve/hazır/hata durumları renk yanında görünür metin veya anlamlı simge taşır.
4. Klavye ile tüm eylemler; görünür ve örtülmeyen odak; dialog kapanınca odağın tetikleyiciye dönmesi.
5. En az 375, 768, 1024 ve 1440px; 200% zoom; uzun ürün/masa adları; büyük tutarlar; boş/yükleniyor/hata durumları; iki tema.
6. Para değerlerinde hizalı rakamlar (`tabular-nums`), Türkçe TL ve kuruş biçimi. Kritik tutar kırpılmaz.
7. Durum değişiminde odak ve girilmiş veriler korunur. Tema değişimi ve veri yenileme adisyon seçiminden çıkarmamalı.
8. Rutin ekranlarda dekoratif animasyon, gradient, glow veya cam panel kullanılmaz. Hareket yalnızca anlaşılır geri bildirim için ve reduced-motion uyumlu olur.
9. Tek temel etkileşim rengi; hata/uyarı/başarı renkleri yalnızca kendi anlamlarında kullanılır.
10. POS onayı gelmeden başarılı tahsilat sayılmaz; bilinmeyen sonuçta kör otomatik tekrar veya ikinci tahsilat yok.

## Paylaşılan tasarım kaynaklarının nasıl kullanıldığı

Kaynaklar salt okunur incelendi. CLI kurulmadı, üçüncü taraf script çalıştırılmadı, harness ayarları değiştirilmedi. Bir GitHub dosyasını okumak, ilgili skill'i yerel olarak kurmak/çalıştırmak değildir.

- UI UX Pro Max `SKILL.md`: öncelikli erişilebilirlik, 44px dokunma hedefi, anlamsal tema değişkenleri ve responsive kontrol listesi incelendi. Tasarım sistemi üretim script'i çalıştırılmadı; otomatik palet üretildiği iddia edilmez.
  https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md
- Apple design: verilen `apple-design-skil` adresi erişilemedi; aramayla `apple-design-skill` doğrulandı. Ana dosya, renk ve koyu tema referansları incelendi. Web için native macOS/iOS kontrol kuralları zorunlu değil; okunabilirlik, iki görünümde renk ve renk dışı durum anlatımı esas alınıyor.
  https://github.com/dickwu/apple-design-skill
  https://github.com/dickwu/apple-design-skill/blob/main/references/hig/dark-mode.md
  https://github.com/dickwu/apple-design-skill/blob/main/references/hig/color.md
- UI Skills: `baseline-ui`, `fixing-accessibility` ve playbook incelendi. Alan yanındaki hata, odak, güvenli alan ve sade arayüz ilkeleri alındı. Mevcut CSS'yi sırf referans önerdi diye Tailwind'e çevirmek veya animasyon paketi eklemek gerekmez.
  https://github.com/ibelick/ui-skills/blob/main/skills/baseline-ui/SKILL.md
  https://github.com/ibelick/ui-skills/blob/main/skills/fixing-accessibility/SKILL.md
  https://www.ui-skills.com/playbook
- Awesome design skills: enterprise ve professional dosyaları karşılaştırıldı. Enterprise dosyasının cam/gradient ve varsayılan koyu bulut paneli, professional dosyasının elektronik mağazası/sarı paleti restoranın gerekçesi değil; görünümleri kopyalanmayacak. Bileşen durumları ve ölçülebilir kalite kapıları yararlı.
  https://github.com/bergside/awesome-design-skills/blob/main/skills/enterprise/SKILL.md
  https://github.com/bergside/awesome-design-skills/blob/main/skills/professional/SKILL.md

## Sonraki uygulama öncesi sınır

Bu belge görsel yönü ve kalite eşiğini tanımlar; legacy analizinin yerine geçmez. Gerçek cihaz, SQL şeması, mali kurallar ve işletmenin fiili yetki kullanımı doğrulanmadan demo canlı ERP veya POS çözümü diye sunulmayacak.
