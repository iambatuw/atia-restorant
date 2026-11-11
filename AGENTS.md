# ATIA web projesinde çalışma düzeni

Bu kurallar depoda çalışan bütün kod ajanları için geçerlidir. Farklı bilgisayarlardaki kopyalar aynı anda değişebilir; yerel dosyaları veya uzak depoyu tek başına bütün çalışmanın kaynağı sayma.

## Yalnız GitHub güncellemesini getirme isteği

- Kullanıcı yalnızca "GitHub'ı kontrol et" veya "güncellemeleri getir" derse bu bir senkronizasyon görevidir. Önce uzak `main` dalını kontrol et. Yeni commit yoksa dosyaları değiştirmeden işine devam et.
- Yeni commit varsa sadece o commit'lerin değişikliklerini yerel çalışmayla güvenle birleştir. Yerel açık değişiklikleri ve daha yeni çalışan davranışları koru; aynı dosyada çakışma varsa iki tarafın amacını incele.
- Bu istek yeni tasarım, uygulama özelliği, test veya belge yazma yetkisi vermez. `AGENTS.md`, `CLAUDE.md` ve `.github/copilot-instructions.md` dosyalarını kendi yorumunla düzenleme; bunlar ancak kullanıcı açıkça kural değişikliği isterse değişir. Başka bir bilgisayara özel dosya yollarını depo kuralına ekleme.
- Sırf güncellemeyi getirmek için yeni uygulama commit'i veya push oluşturma. Birleştirme tamamlanamıyorsa hangi dosyaların çakıştığını bildir; eski kopyayı zorla gönderme.

## Her işe başlamadan önce

1. `git status --short --branch` ile açık değişiklikleri incele. Başkasının veya kullanıcının değişikliklerini kaydet, silme ya da kendi commit'ine katma.
2. `git fetch origin main` çalıştır. `git log --oneline --left-right HEAD...origin/main` ve `git diff --name-status HEAD..origin/main` ile yerel ve uzak commit'leri karşılaştır.
3. Uzak `main` ilerideyse, kendi işine başlamadan önce yeni commit'leri mevcut çalışmana dahil et. Temiz dalda hızlı ileri güncelleme yap; açık değişiklik varsa önce güvenle koru ve çakışmaları tek tek çöz. Dallar ayrıştıysa commit'leri birleştir veya yeniden temellendir. Eski klasörü yeni klasörün üzerine topluca kopyalama.

## Değişiklik yaparken

- İstenen işin dosyalarını ve ilgili commit farklarını incele. Aynı ekran veya akış başka bir commit'te değiştiyse iki tarafın davranışını karşılaştır; çalışan özelliği sessizce eski haline döndürme. Çakışmayı yalnızca dosya metni düzeyinde değil, kullanıcı akışı düzeyinde çöz.
- Masa ekranında ürün seçimi ayrı sayfaya geçmez. Panel masa görünümü üzerinde açılır, tablet ve dokunmatik hedefleri korunur. Toplu sipariş onaylandıktan sonra panel açık kalır; personel aynı masaya başka ürünler ekleyebilir. Yönetici zayi ayarı ve sunucudaki rol denetimi korunur.
- Bu depo web uygulamasıdır. Masaüstü uygulamasını değiştirme. Canlı sağlayıcı bağlantısı ve veritabanı erişimi yoksa demo akışını canlıymış gibi gösterme.
- Kullanıcının açık dosyalarına `git reset --hard`, `git checkout -- .` veya benzeri toplu geri alma komutları uygulama. Birleştirme güvenle tamamlanamıyorsa çakışan dosyaları ve korunması gereken davranışları kullanıcıya bildir; üzerine yazıp gönderme.

## Doğrulama ve gönderme

1. Web kodu değişirse arayüz testlerini, TypeScript denetimini ve üretim derlemesini çalıştır. API kodu değişirse API testlerini çalıştır. Derlenmiş `wwwroot` dosyalarını kaynakla birlikte güncelle. Açık 5080 sunucusu yeni .NET kodunu kendiliğinden yüklemez; gerekirse sunucuyu yeniden başlat ve tarayıcıyı yenile.
2. Yalnız bu işe ait dosyaları açıkça seçerek `git add -- <dosyalar>` yap. `git diff --cached` ve `git status` ile commit içeriğini kontrol et. Başkasının açık dosyalarını veya eski kopyanın toplu değişikliklerini commit'e alma.
3. Push'tan hemen önce tekrar `git fetch origin main` çalıştır. Uzak dal ilerlediyse yeni commit'leri dahil et, etkilenen akışları yeniden doğrula. Yalnız `main` dalına normal hızlı ileri push yap; `force push` kullanma. Push reddedilirse uzak değişiklikleri getirip birleştir ve tekrar test et; eski commit'i zorla gönderme.
