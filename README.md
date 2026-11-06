> ### 📌 Batuhan'dan Not
> Test için böyle bir şey denedim veritabanı vs zaten olmadığı için öylesine denemelik birşeyler yaptırdım 6.11.2026 // 22.08

---

# Atia Restoran Web Yönetim ve Operasyon Sistemi

Eski, hantal ve kararsız Windows masaüstü (.NET Framework 4.5.2 / DevExpress WinForms / LINQ-to-SQL) restoran otomasyonunu modern, hızlı, yüksek performanslı ve güvenilir bir web mimarisine dönüştüren yeni nesil restoran yönetim platformu.

Sistem; sunucu otoritesinde çalışan **ASP.NET Core 10 LTS Minimal API**, anlık veri akışı sağlayan **SignalR Hub** ve modern **React 19 / TypeScript / Vite** arayüzü üzerine inşa edilmiştir.

---

## 🌟 Öne Çıkan Özellikler ve Mimari Yenilikler

### 1. Modern ve Güvenilir Teknoloji Yığını
- **Backend:** C# / .NET 10 LTS Minimal API (Yüksek performans, düşük bellek tüketimi).
- **Frontend:** React 19, TypeScript 5.9, Vite 7, TanStack React Query v5, Lucide Icons.
- **Gerçek Zamanlı İletişim:** SignalR (`/hubs/restorant`) ile masalar, siparişler ve mutfak ekranı arasında anlık soket senkronizasyonu.
- **Finansal Güvenlik (Server-Authoritative):** İstemci tarafı fiyat, iskonto ve toplam hesaplayamaz; tüm hesaplamalar kuruş hassasiyetinde (`decimal`, 2 hane) sunucuda kesinleştirilir.

### 2. Eski Sistemdeki Kritik Mantık Hatalarının Giderilmesi
Eski masaüstü kod tabanında tespit edilen ve işletme operasyonunu bozan kök hatalar tamamen çözülmüştür:
- **Masa Birleştirme Hatası (`RestorantService.cs:1006-1009`):** Eski kodda `NakitToplam` alanı sırasıyla Banka, Cari ve İndirim toplamları tarafından 4 kez üst üste eziliyordu. Yeni mimaride her ödeme kalemi ve sipariş satırı ana adisyona matematiksel doğrulukla konsolide edilir.
- **Masa Ayırma Mantık Hatası (`frmMasaAyirma.cs:60`):** Açık adisyon satırlarının durumunu bozan mutasyon hatası giderilmiş; seçilen ürün ve adetler hedef masaya güvenli şekilde aktarılırken her iki adisyon otomatik güncellenir.
- **Masa Taşıma Güvenliği:** Bir masanın adisyonu yalnızca boş ve rezerve olmayan hedef masalara aktarılabilir, mükerrer adisyon açılması engellenir.

### 3. POS Terminal Entegrasyonu ve Kısmi Ödeme (Hugin S1 & PayGo)
- **Dayanıklı Durum Makinesi:** 
  `Başlatıldı (0)` ➔ `Cihaza Gönderildi (1)` ➔ `Onaylandı (2)` / `Reddedildi (3)` / `Belirsiz (4)` ➔ `ERP Kaydedildi (5)` ➔ `Mutabık (6)`
- **Mükerrer Çekim Koruması (Idempotency):** Ağ kopması veya terminal gecikmelerinde çift tahsilatı engelleyen tekil işlem anahtarı (`IdempotencyKey`) desteği.
- **PCI-DSS Uyumu:** Kart numarası (PAN), PIN veya CVV sunucuya uğramaz ve kaydedilmez; yalnızca maskeli kart bilgisi (`************4582`), RRN ve banka provizyon kodları saklanır.
- **Parçalı / Kısmi Ödeme:** Bir adisyon birden fazla kişi arasında nakit, kredi kartı ve yemek kartı şeklinde parçalı olarak ödenebilir; adisyon yalnızca kalan bakiye 0 TL olduğunda kapanır.

### 4. Kullanıcı Rolleri ve Özel Ekranlar

| Rol | Ekran & Deneyim | Yetkiler |
|---|---|---|
| **Yönetici (Admin)** | Kapsamlı Yönetim Paneli | Masa planı, sipariş, parçalı ödeme alma, Hugin/PayGo POS, masa taşı/ayır/birleştir, gün sonu ciro ve saatlik satış raporları |
| **Garson** | Tablet & Mobil Ergonomik Panel | Salon bazlı masa seçimi, dokunmatik hızlı sipariş, porsiyon/not ekleme, satır silme/iptal |
| **Mutfak** | Canlı Mutfak Ekranı (KDS) | SignalR ile anlık düşen sipariş fişleri, bekleme süresi sayacı ve sipariş hazır işaretleme |
| **Müşteri** | QR Dijital Menü (`/menu`) | Hafif, hızlı açılan, personel kontrollerinden arındırılmış şık kategori ve ürün kataloğu |

### 5. UI/UX Tasarım Standartları
- **Yapay Zeka ve Şablon Klişelerinden Uzak:** Tekrarlayan pazarlama sloganları ve yapay kart gölgeleri yerine doğrudan restoran operasyonuna odaklanan net ve işlevsel arayüz.
- **Aydınlık ve Karanlık Tema (Light / Dark Mode):** Anlamsal CSS değişkenleriyle sistem tercihini otomatik algılayan ve manuel geçiş sunan tasarım.
- **Dokunmatik Ergonomi:** Tablet ve telefonlar için minimum **44×44 CSS px** dokunma hedefleri.
- **Erişilebilirlik:** **WCAG 2.2 AA (≥ 4.5:1)** kontrast uyumu ve finansal rakamlar için `tabular-nums` kullanımı.

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- [.NET 10.0 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) (veya üzeri)
- [Node.js](https://nodejs.org/) (v20 veya v22+) ve npm

### 1. Backend Servisini Başlatma (.NET 10 API)
Proje kök dizininde bir terminal açın:

```bash
cd AtiaRestorant.API
dotnet run --urls "http://127.0.0.1:5080"
```
*Backend servisi `http://127.0.0.1:5080` adresinde dinlemeye başlayacaktır.*

### 2. Frontend Uygulamasını Başlatma (React / Vite)
İkinci bir terminal açın:

```bash
cd atia-restorant-web
npm install
npm run dev
```
*Web uygulaması `http://127.0.0.1:5173` adresinde açılacaktır.*

---

## 🔑 Hazır Demo Kullanıcı Hesapları

Uygulama demo ve geliştirme modunda aşağıdaki hesaplarla test edilebilir:

| Rol | Kullanıcı Adı | Şifre |
|---|---|---|
| **Yönetici** | `admin` | `demo123` |
| **Garson** | `garson` | `demo123` |
| **Mutfak** | `mutfak` | `demo123` |

*Müşteri QR menüsüne erişmek için giriş ekranının altındaki **"Müşteri menüsünü aç"** bağlantısına tıklayabilir veya doğrudan `http://127.0.0.1:5173/menu` adresine gidebilirsiniz.*

---

## 🧪 Test ve Doğrulama

Sistem hem backend hem de frontend tarafında kapsamlı birim ve entegrasyon testleriyle korunmaktadır:

```bash
# Backend Testleri (19 Test - xUnit)
dotnet test AtiaRestorant.API/Tests/AtiaRestorant.API.Tests.csproj

# Frontend Testleri (12 Test - Vitest)
cd atia-restorant-web
npm test

# Frontend Üretim Derlemesi (TypeScript & Vite Build)
npm run build
```

---

## 🔒 Güvenli SQL Server Köprüsü & Canlıya Geçiş

Uygulama, güvenli mimari prensibi gereği **Fail-Closed** çalışır:
- Canlı Microsoft SQL Server şeması doğrulanmadıkça sistem veritabanına körü körüne sorgu atmaz; `Demo:Enabled=false` yapıldığında `HTTP 503 Service Unavailable` döner.
- Canlı ERP ortamına bağlanırken gerçek tablo şemaları, transaction izolasyon seviyeleri ve yetki kısıtları doğrulanarak güvenli bir geçiş sağlanacaktır.
