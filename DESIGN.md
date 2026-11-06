---
name: ATİA Restoran
description: Günlük restoran operasyonları için sakin ve okunabilir arayüz
colors:
  canvas: "#f5f6f2"
  paper: "#fffefa"
  rail: "#f0f2ed"
  paper-muted: "#eef1ec"
  ink: "#202c28"
  ink-soft: "#52625b"
  ink-faint: "#617168"
  line: "#d9dfd8"
  line-strong: "#7b8d7e"
  primary: "#315f4e"
  primary-hover: "#254a3c"
  primary-soft: "#e6f0e8"
  reserved: "#886241"
  reserved-soft: "#f6eee2"
  danger: "#9a4d45"
typography:
  headline:
    fontFamily: "Source Sans 3, Segoe UI, sans-serif"
    fontSize: "clamp(2rem, 2.3vw, 2.75rem)"
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Source Sans 3, Segoe UI, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.14
  body:
    fontFamily: "Source Sans 3, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  control: "8px"
  surface: "10px"
spacing:
  compact: "8px"
  regular: "16px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
  table-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "14px 16px"
---

# Design System: ATİA Restoran

## Overview

**Creative North Star: "Gün Işığında Servis"**

Garson, mutfak ve yönetici aynı sistemde sık kullanılan işleri yürütür. Arayüz açık bir çalışma yüzeyi gibi davranır: göz yormayan sıcak beyazlar, koyu yeşile çalan yazı, net ayraçlar ve gerektiğinde görünen durum renkleri. Masa, sipariş ve tutarlar ilk bakışta okunur.

Önceki koyu, büyük renk bloklu kartlar ve restoran klişesi haline gelen dekoratif ikonlar bu sistemin görsel dayanağı değildir. Her sayfa aynı tipografi, ölçü ve kontrol mantığını kullanır.

**Key Characteristics:**

- Açık yüzeyler; sol gezinti de açık tonludur.
- Durumlar renkli tam kart yerine metin ve küçük işaretle gösterilir.
- Sayısal veriler hizalı ve sekmeyen rakamlarla okunur.
- Masa planı kısa, yatay bilgi birimlerinden oluşur.

## Colors

Ana zemin kırık beyazdır. Koyu mürekkep metni servis ortamında okunur tutar. Yeşil işlem, toprak tonu rezervasyon, kiremit tonu hata ve gecikme içindir.

**The Small Status Rule.** Bir masa durumu tüm kartı boyamaz; renk yalnızca durum işareti ve metninde yer alır.

## Typography

Source Sans 3 başlık, içerik ve kontrollerde tek yazı ailesidir. Başlıklarda 650–700 ağırlık ve hafif sıkı harf aralığı kullanılır. Fiyat, süre ve rapor rakamları tabular rakamlarla sabit genişlikte görünür.

## Layout

Geniş ekranda 238 piksel açık gezinti, ana çalışma alanı ve masa seçiminde sağ adisyon paneli kullanılır. Masa planı iki sütunlu kısa birimlerden oluşur. 800 piksel altında gezinti alt çubuğa, seçili masa ayrıntısı tam ekran panele dönüşür; 620 piksel altında listeler tek sütuna iner.

## Elevation & Depth

Varsayılan yüzeyler ince sınırla ayrılır. Gölge yalnızca etkileşim veya odak anında ve düşük yoğunlukta kullanılır.

## Shapes

Kontroller 8 piksel, çalışma yüzeyleri 9–12 piksel köşe yarıçapına sahiptir. Yuvarlak kapsüller içerik taşıyan büyük yüzeylerde kullanılmaz.

## Components

- Birincil düğme işlem için koyu yeşildir.
- İkincil düğme açık yüzey, belirgin sınır ve koyu metin kullanır.
- Masa birimi ad, bölüm, durum, süre, kişi ve tutarı iki kısa satıra yerleştirir.
- Adisyon paneli tutar ve ödeme eylemini girişlerden sonra gösterir.
- Mutfak fişi ürün ve bekleme süresini metin olarak sunar.

## Do's and Don'ts

- Masa, ürün, tutar ve durumları gerçek API verisinden göster.
- Boş, yükleniyor ve hata durumlarını açık metinle anlat.
- Yeni sayfalarda aynı açık yüzey ve kontrol yoğunluğunu sürdür.
- Uydurma yemek açıklaması, sertifika veya müşteri iddiası ekleme.
- Durum için neon renk, tüm kartı boyayan arka plan ve dekoratif parıltı kullanma.
