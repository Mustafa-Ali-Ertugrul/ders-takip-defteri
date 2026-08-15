# Ders Takip Defteri

Öğrencilerin ders çalışma oturumlarını kaydedip takip edebildiği, tek dosyalık (vanilla JavaScript) bir web uygulaması. Veriler tarayıcının yerel deposunda (localStorage) saklanır; kurulum veya sunucu gerektirmez.

![Proje görseli](images/screenshot.png)

## Canlı Demo

**https://mustafa-ali-ertugrul.github.io/ders-takip-defteri/**

## Özellikler

- **Çalışma ekleme** (ders, süre, tarih, not) — hızlı süre çipleri (+25/+45/+60 dk)
- **Güncelleme ve silme** — tablodaki düzenle/sil butonlarıyla
- **Filtreleme ve arama** — derse göre filtre, nota/ders adına göre arama
- **Sıralama** — tarihe, süreye veya ders adına göre
- **İstatistik kartları** — toplam süre, bu haftaki süre (haftalık hedef çubuğu), en sık çalışılan ders, günlük çalışma serisi (streak)
- **Ders dağılım grafiği** — derslere göre renkli yüzdeler
- **JSON yedekleme** — tüm kayıtları tek tıkla yedek dosyası olarak indirme
- **Form doğrulama** — süre aralığı (1–1440 dk), zorunlu alanlar, gelecek tarih engeli
- Tamamı Türkçe arayüz, responsive tasarım

## Kullanılan Teknolojiler

| Teknoloji | Amaç |
|---|---|
| HTML5 | Sayfa yapısı |
| CSS (pure) | Stil ve responsive tasarım |
| JavaScript (vanilla) | Uygulama mantığı, CRUD işlemleri, DOM manipülasyonu |
| localStorage | Veri saklama |

## Projede Yapılan CRUD İşlemleri

| İşlem | Nerede |
|---|---|
| **Create** | "+ Çalışma Ekle" → form doldurulup "Kaydet" |
| **Read** | Tablo listesi, istatistik kartları, ders dağılımı |
| **Update** | Tablodaki ✎ butonu → kaydı düzenle |
| **Delete** | Tablodaki ✕ butonu → onaylı silme |

## Yerel Çalıştırma

Repo'yu indirin ve `index.html` dosyasını tarayıcıda açın. Başka bir kurulum gerekmez.

## Not

Uygulama verileri yalnızca kullandığınız tarayıcıda saklar; farklı cihaz veya tarayıcılarda veriler paylaşılır. Kayıtlarınızı "JSON Yedek" butonuyla dışa aktarabilirsiniz.
