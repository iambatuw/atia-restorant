# ATİA Restoran

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Garsonlar, mutfak personeli ve yöneticiler aynı restoranın günlük işlerini yürütür. Garson masayı ve adisyonu yönetir; mutfak siparişleri hazırlar; yönetici rapor ve rezervasyonları takip eder.

## Product Purpose

Masa, sipariş, ödeme, mutfak, menü, rezervasyon ve günlük rapor akışlarını tek web uygulamasında yürütmek.

## Operating Context

Salon ve mutfakta hızlı, tekrarlanan işlemler; yönetimde gelir ve operasyon takibi. Müşteriler QR menüsünü ayrı bir genel sayfadan görebilir.

## Capabilities and Constraints

- React 19 ve ASP.NET Core 10 uygulaması, mevcut API ve rol yetkileri korunacak.
- Masa durumu, adisyon, sipariş, ödeme, KDS, menü, rapor ve rezervasyon işlevleri korunacak.
- Demo ortamı ve canlı veri yenileme davranışı arayüzde doğru anlatılacak.
- Türkçe arayüz metinleri kullanılacak.

## Brand Commitments

- ATİA adı korunacak.
- Kullanıcı tüm arayüzün sıfırdan tasarlanmasını istiyor. Açık tema göz yormayan beyaz tonlarda olacak; önceki koyu, yoğun renk bloklu tasarım görsel referans alınmayacak.

## Evidence on Hand

Mevcut iş akışları ve veriler `ClientApp/src` içindeki uygulama kodunda bulunuyor. Kullanıcı önceki masa planı ekran görüntüsünü başarısız örnek olarak sağladı.

## Product Principles

- Personel doğru masayı ve sonraki işlemi ilk bakışta bulabilmeli.
- Durum renkleri bilgi vermeli; geniş yüzeyleri dekoratif olarak boyamamalı.
- Tekrarlanan dokunmatik işlemler okunabilir, hızlı ve güvenilir olmalı.
- Arayüz gerçek veriyi ve boş/hata durumlarını dürüstçe göstermeli.
