# ATIA web projesinde çalışma düzeni

Bu dosyayı her işe başlamadan önce ve push öncesinde yeniden oku. Kurallar depoda çalışan bütün kod ajanları için geçerlidir. Farklı bilgisayarlardaki kopyalar aynı anda değişebilir; tek bir kopyayı bütün çalışmanın kaynağı sayma.

## Her işe başlamadan önce

1. `git status --short --branch` ile açık değişiklikleri incele. Başkasının veya kullanıcının değişikliklerini silme ya da kendi commit'ine katma.
2. `git fetch origin main` çalıştır. `git log --oneline --left-right HEAD...origin/main` ve `git diff --name-status HEAD..origin/main` ile yerel ve uzak commit'leri karşılaştır. Uzak `main` ilerideyse yeni commit'leri güvenle dahil et; çakışmaları tek tek çöz.
3. `D:\atia-restorant-main\atia-restorant-main` klasöründeki kullanıcı dosyalarını da karşılaştır. Bu klasör ZIP kopyasıdır, Git deposu değildir. Yerel fark varsa önce yedeğini al, sonra birleştir. Eski klasörü yeni klasörün üzerine topluca kopyalama.

## Değişiklik yaparken

- İstenen işin dosyalarını ve ilgili commit farklarını incele. Aynı ekran başka bir commit'te değiştiyse iki tarafın davranışını karşılaştır; çalışan özelliği sessizce geri alma. Çakışmayı yalnızca dosya metni düzeyinde değil, kullanıcı akışı düzeyinde çöz. Güncel açık kullanıcı isteği bu dosyadaki eski ürün kararlarından üstündür.
- Masa > yeni adisyon > **Menüden ürün ekle** akışı `/app/masalar/:id/urun-ekle` adresinde ayrı bir sayfa açar. Ürünler önce onay listesine alınır, listeden silinebilir ve yalnızca **Onayla ve ekle** ile adisyona yazılır. Onaydan sonra sayfa açık kalır; personel başka ürün ekler veya adisyona döner. Kaydedilmemiş seçimle çıkarken uyarı gösterilir. Mobil ve dokunmatik hedefler rahat kullanılabilir boyutta kalır. **Zayi** seçeneği yalnızca yönetici Ayarlar'dan etkinleştirince görünür; sunucu kapalıyken zayi kaydını reddeder.
- Bu depo web uygulamasıdır. Masaüstü uygulamasını değiştirme. Canlı sağlayıcı bağlantısı ve veritabanı erişimi yoksa demo akışını canlıymış gibi gösterme.
- Kullanıcının açık dosyalarına `git reset --hard`, `git checkout -- .` veya benzeri toplu geri alma komutları uygulama. Birleştirme güvenle tamamlanamıyorsa çakışan dosyaları ve korunması gereken davranışları kullanıcıya bildir; üzerine yazıp gönderme.

## Doğrulama ve gönderme

1. Web kodu değişirse arayüz testlerini, TypeScript denetimini, üretim derlemesini ve 320–390 piksel genişlikte dokunmatik akışı kontrol et. API kodu değişirse API testlerini çalıştır. Derlenmiş `wwwroot` dosyalarını kaynakla birlikte güncelle. Açık 5080 sunucusu yeni .NET kodunu kendiliğinden yüklemez; gerekirse yeniden başlat ve tarayıcıyı yenile.
2. Yalnız bu işe ait dosyaları açıkça seçerek `git add -- <dosyalar>` yap. `git diff --cached` ve `git status` ile commit içeriğini kontrol et. Commit'i işi yapan kişinin GitHub hesabına bağlı ad ve e-posta ile oluştur; Safa adına yapılan commit'lerde `Safa <325919221+SafaSametCakir@users.noreply.github.com>` kullan.
3. Push'tan hemen önce bu dosyayı ve `origin/main` dalını tekrar kontrol et. Uzak dal ilerlediyse yeni commit'leri dahil et, etkilenen akışları yeniden doğrula. Yalnız `main` dalına normal hızlı ileri push yap; `force push` kullanma. Push reddedilirse uzak değişiklikleri getirip birleştir ve tekrar test et.
4. Push sonrası `D:\atia-restorant-main\atia-restorant-main` içeriğini tekrar karşılaştır. Yeni proje dosyalarını yerel kullanıcı değişikliklerini koruyarak güncelle. Derleme çıktıları (`bin`, `obj`, `node_modules`) kaynak dosya yerine geçmez. Uygulama açıksa yeni sürüm için yeniden başlatılması gerektiğini belirt.
