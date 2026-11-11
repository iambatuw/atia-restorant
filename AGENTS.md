# ATIA web projesinde çalışma düzeni

- Her işe başlamadan önce `origin/main` dalını getir; yerel commit, uzak commit ve `git status` durumunu karşılaştır. Kullanıcının açık değişikliklerini koru.
- Başka birinin commit'i aynı ekranı değiştirdiyse önce farkı incele. Var olan çalışan akışı sessizce geri alma; yeni davranışı önceki davranışla birleştir veya değişen tercihi kullanıcıya açıkça anlat.
- Masa ekranında ürün seçimi ayrı sayfaya geçmez. Panel masa görünümü üzerinde açılır, tablet ve dokunmatik hedefleri korunur. Toplu sipariş onaylandıktan sonra panel açık kalır; personel aynı masaya başka ürünler ekleyebilir. Yönetici zayi ayarı ve sunucudaki rol denetimi korunur.
- Bu depo web uygulamasıdır. Masaüstü uygulamasını değiştirme. Canlı sağlayıcı bağlantısı ve veritabanı erişimi yoksa demo akışını canlıymış gibi gösterme.
- Web kodu değişirse arayüz testlerini, TypeScript denetimini ve üretim derlemesini çalıştır. API kodu değişirse API testlerini çalıştır. Derlenmiş `wwwroot` dosyalarını kaynakla birlikte güncelle.
- Açık 5080 sunucusu yeni .NET kodunu kendiliğinden yüklemez. Çalışan uygulama ile diskteki sürümü ayırt et; doğrulama yaparken gerekirse sunucuyu yeniden başlat ve tarayıcıyı yenile.
- Göndermeden hemen önce `origin/main` dalını tekrar getir. Yalnız bu işin dosyalarını commit'e al; başkasının açık dosyalarını dahil etme. Yalnız `main` dalına normal hızlı ileri gönderim yap; `force push` kullanma.
