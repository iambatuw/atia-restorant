# ATIA web projesinde çalışma düzeni

Bu kurallar depoda çalışan bütün kod ajanları (Claude Code, GitHub Copilot ve diğerleri) için geçerlidir. Proje iki kişi ve iki bilgisayarda, sırayla geliştiriliyor. Diğer kişinin yaptığı iş GitHub'daki `main` dalına gelir; yerel klasör her zaman eski kalmış olabilir. **Doğru kaynak, yeni getirilmiş `origin/main` ile senin bu görevde yaptığın değişikliklerin birleşimidir.**

## Altın kurallar

1. Hiçbir işe `git fetch origin main` yapmadan başlama, hiçbir push'u da bu kontrolü tekrarlamadan yapma.
2. Uzakta görmediğin bir değişiklik varsa o değişiklik **diğer kişinin bilinçli işidir**. Onu hata, eski kod veya kendi yarım işin sanıp geri alma, silme ya da üzerine yazma.
3. Bir dosya hatırladığından veya beklediğinden farklıysa önce `git log -p -- <dosya>` ile kimin, neden değiştirdiğine bak. Gerekçesini anlamadan geri çevirme.
4. Yalnızca git ile çalış. Klasör kopyalama, eski yedekten dosya yapıştırma veya bulut eşitlemesiyle dosya taşıma yapma.
5. `git push --force`, `git reset --hard`, `git checkout -- .`, `git clean` ve benzeri toplu geri alma komutlarını kullanma.

## Yalnız GitHub güncellemesini getirme isteği

- Kullanıcı yalnızca "GitHub'ı kontrol et" veya "güncellemeleri getir" derse bu bir senkronizasyon görevidir. Önce uzak `main` dalını kontrol et. Yeni commit yoksa dosyaları değiştirmeden işine devam et.
- Yeni commit varsa sadece o commit'lerin değişikliklerini yerel çalışmayla güvenle birleştir. Yerel açık değişiklikleri ve daha yeni çalışan davranışları koru; aynı dosyada çakışma varsa iki tarafın amacını incele.
- Bu istek yeni tasarım, uygulama özelliği, test veya belge yazma yetkisi vermez. `AGENTS.md`, `CLAUDE.md` ve `.github/copilot-instructions.md` dosyalarını kendi yorumunla düzenleme; bunlar ancak kullanıcı açıkça kural değişikliği isterse değişir. Başka bir bilgisayara özel dosya yollarını depo kuralına ekleme.
- Sırf güncellemeyi getirmek için yeni uygulama commit'i veya push oluşturma. Birleştirme tamamlanamıyorsa hangi dosyaların çakıştığını bildir; eski kopyayı zorla gönderme.

## Her işe başlamadan önce

1. `git status --short --branch` ile açık değişiklikleri incele. Kullanıcının veya başkasının açık değişikliklerini kaydet; silme, geri alma ya da kendi commit'ine katma.
2. `git fetch origin main` çalıştır. `git log --oneline --left-right HEAD...origin/main` ve `git diff --name-status HEAD origin/main` ile farkları gör.
3. Uzak `main` ilerideyse, kendi işine başlamadan önce yeni commit'leri al (`git merge origin/main`; temiz dalda hızlı ileri). Açık değişiklik varsa ve aynı dosyalara dokunuyorsa önce kullanıcıya söyle.
4. Gelen commit'lerin mesajlarını ve aşağıdaki **Korunan davranışlar** listesini oku. Diğer kişinin son yaptığı işi bilmeden aynı ekranı değiştirmeye başlama.

## Değişiklik yaparken

- Yalnızca istenen işin dosyalarına dokun. İstenmeyen dosyayı "düzelteyim" diye değiştirme, biçimlendirme veya yeniden adlandırma yapma; bunlar diğer kişinin işiyle çakışır.
- Aynı ekran veya akış başka bir commit'te değiştiyse iki tarafın davranışını karşılaştır. Çakışmayı yalnız metin düzeyinde değil, kullanıcı akışı düzeyinde çöz; iki tarafın özelliği de çalışmalı.
- Yeni sunucu işlerini mümkünse ayrı dosyaya koy (`Data/RestaurantRepository.<Konu>.cs`, `Endpoints/`). Büyük ortak dosyalarda (`RestaurantRepository.cs`, `Tables.tsx`, `Program.cs`) yalnız gereken satırları değiştir.
- Bu depo web uygulamasıdır. Masaüstü uygulamasını değiştirme. Canlı sağlayıcı bağlantısı ve veritabanı erişimi yoksa demo akışını canlıymış gibi gösterme.
- Bir özelliği kaldırman veya davranışını değiştirmen gerekiyorsa bunu kullanıcı açıkça istemiş olmalı. İstemişse **Korunan davranışlar** listesini de aynı commit'te güncelle.

## Korunan davranışlar

Aşağıdakiler bilinçli kararlardır ve çalışır durumdadır. Kullanıcı açıkça istemedikçe geri alınmaz. Yeni kalıcı bir davranış eklendiğinde bu listeye bir satır eklenir.

- Masa ekranında ürün seçimi ayrı sayfaya geçmez; panel masa görünümünün üzerinde açılır, tablet ve dokunmatik hedefleri korunur. Toplu sipariş onaylandıktan sonra panel açık kalır.
- Zayi yönetici ayarıyla açılır; rol denetimi sunucuda yapılır, istek gövdesindeki rol yetki vermez.
- Giriş, personel hesaplarıyla yapılır (şifreler tuzlanmış özet). Rol, durum veya şifre değişince o hesabın oturumları kapanır. Oturum belirteci mağaza numarasına (`Restaurant:StoreId`) bağlıdır.
- Demo verisi `App_Data/demo-state.json` dosyasında kalıcıdır. Bu klasör depoya gönderilmez (müşteri ve adisyon bilgisi içerebilir).
- Ürün seçenekleri/ekstraları, hazır notlar, barkodla ürün ve adisyon bulma, KDV oranı ve dökümü.
- Ödeme: tam, kısmi, eşit bölme ve ürün seçerek ödeme. Ödenmiş ürün iptal edilemez. Ödeme şekli yalnız aynı işletme günü düzeltilir; sonrası iade kaydıyla yapılır.
- Paket servis: telefonla müşteri kartı, tanımlı kurye, yönetici tahsilat doğrulaması. Nakit paket tahsilatı beklenen kasa nakdine girer.
- Stok reçeteye göre satışta düşer; iptal geri ekler, zayi eklemez; satış stok yüzünden engellenmez.
- Ekranlar: Raporlar (günlük, dönem, personel), Adisyonlar, Stok ve maliyet, Personel, Ayarlar (işletme, masa/bölüm, yazıcı, yemek kartı, hazır not, demo sıfırlama).

## Doğrulama ve gönderme

1. Web kodu değişirse `ClientApp` içinde `npm test` ve `npm run build` çalıştır (TypeScript denetimi derlemeye dahildir). API kodu değişirse `dotnet test Tests/AtiaRestorant.API.Tests.csproj` çalıştır. Test kırılırsa testi silerek veya gevşeterek geçirme; nedenini bul.
2. Derlenmiş `wwwroot` dosyalarını kaynakla birlikte güncelle. `wwwroot/assets` dosya adları her derlemede değişir: bu klasörde çakışma olursa elle seçim yapma, kaynağı birleştirdikten sonra `npm run build` ile yeniden üret ve eski asset dosyalarını silinmiş olarak commit'e al.
3. Yalnız bu işe ait dosyaları açıkça seçerek `git add -- <dosyalar>` yap. `git diff --cached --stat` ve `git status` ile kontrol et. `App_Data/`, `bin/`, `obj/`, `node_modules/`, `.claude/` ve kullanıcının işle ilgisiz açık dosyaları commit'e girmez.
4. Commit mesajında ne değiştiğini ve neden değiştiğini Türkçe ve açık yaz; diğer kişinin ajanı ne yaptığını bu mesajdan anlar.
5. Push'tan hemen önce tekrar `git fetch origin main` çalıştır. Uzak dal ilerlediyse yeni commit'leri birleştir, etkilenen testleri ve derlemeyi yeniden çalıştır.
6. Yalnız `main` dalına normal hızlı ileri push yap (`git push origin HEAD:main`). Push reddedilirse uzak değişiklikleri getirip birleştir ve tekrar test et; asla zorla gönderme.
7. Açık 5080 sunucusu yeni .NET kodunu kendiliğinden yüklemez; gerekirse sunucuyu yeniden başlat ve tarayıcıyı yenile.

## Emin değilsen

Birleştirme güvenle tamamlanamıyorsa, bir değişikliğin kime ait olduğu veya bilinçli olup olmadığı anlaşılmıyorsa dur. Çakışan dosyaları ve korunması gereken davranışları kullanıcıya bildir; üzerine yazıp gönderme.
