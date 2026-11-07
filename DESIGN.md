# ATIA Restoran tasarım sistemi

## Yön

Giriş ekranındaki sıcak kâğıt ve toprak tonları personel çalışma alanında da sürer. Operasyon ekranında asıl vurgu veri, durum ve sonraki işlemdir. Geniş renk blokları ve süs amaçlı kartlar kullanılmaz.

## Renk

| Amaç | Açık tema | Koyu tema |
| --- | --- | --- |
| Zemin | `#f6f4ef` | `#171613` |
| Çalışma yüzeyi | `#fffefa` | `#22201c` |
| Gezinti | `#f0ece4` | `#1d1b18` |
| Metin | `#28231f` | `#f1ebe1` |
| İkincil metin | `#625b52` | `#c0b7a9` |
| Ayraç | `#d8d2c8` | `#474037` |
| Eylem | `#85482e` | `#d39977` |

Yeşil boş/uygun, toprak tonu rezerve/uyarı, kırmızı gecikme/hata için yalnızca küçük etiket ve metinlerde kullanılır.

## Düzen

- Masaüstünde 236 piksel sol gezinti, geniş çalışma alanı ve masa seçiminde sağ adisyon sütunu.
- Telefon ve tablette dört sık kullanılan ekran alt gezintide; rapor, entegrasyon ve rezervasyonlar üstteki “Tüm ekranlar” menüsünde.
- Başlık, filtre ve veri sıralaması her operasyon ekranında aynı yönde akar. Gerçek para ve adet değerleri sekmeyen rakamlarla gösterilir.
- Giriş ekranı kendi stilinde kalır; operasyon stilleri `.op-app` altında kapsamlanır.

## Bileşenler ve durumlar

- Masa durumu tüm kartı boyamaz; durum sözcüğü ve seçili kenarlık yeterlidir.
- Mutfak fişinde masa adı, bekleme süresi, ürün ve not sıralaması değişmez.
- Boş, yükleniyor ve hata durumları açık metinle görünür.
- Ödeme, taşıma, ayırma ve birleştirme işlemleri seçili adisyonun içinde bulunur.
- İnteraktif alanlarda klavye odağı görünür; küçük hedefler en az 44 piksel yüksekliğindedir.

## İçerik doğruluğu

- İstatistikler API verisinden gelir. Demo verisi görünür biçimde etiketlenir.
- Çalışmayan sağlayıcı bağlantıları etkinmiş gibi sunulmaz.
- Rezervasyon düşük kullanımı nedeniyle ikincil gezintide tutulur.
