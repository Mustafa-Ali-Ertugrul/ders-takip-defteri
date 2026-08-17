# -*- coding: utf-8 -*-
"""Ders Takip Defteri — uçtan uca işlevsel testler.

Kurulum gerektirmez; bu dizindeki ../index.html yerel HTTP sunucusuyla
sunulur ve Playwright/Chromium ile otomatik test edilir.

Çalıştırma (proje kökünden):
    python -m playwright install chromium     # bir kez, tarayıcıyı indirir
    python tests/app_test.py
"""
import sys, os, json, threading, http.server, functools, tempfile
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
PORT = 8077
URL = f"http://127.0.0.1:{PORT}/index.html"

# ---------- yerel statik sunucu ----------
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()

from playwright.sync_api import sync_playwright

RESULTS = []
def check(name, ok, detail=""):
    RESULTS.append((name, ok, detail))

SEED = [
    {"id":"t1","ders":"Matematik","sure":45,"tarih":"2026-08-15","not":"Türev alıştırmaları","createdAt":1755200001000},
    {"id":"t2","ders":"İngilizce","sure":30,"tarih":"2026-08-14","not":"Vocabulary","createdAt":1755200002000},
    {"id":"t3","ders":"Yazılım","sure":60,"tarih":"2026-08-13","not":"React component","createdAt":1755200003000},
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width":1440,"height":1000})
    console_errors = []
    dialogs = []  # M4 sonrası hiçbir confirm()/prompt()/alert() kalmamalı
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(str(e)))
    page.on("dialog", lambda d: dialogs.append(d) or d.dismiss())

    # ---------- boş durum ----------
    page.goto(URL); page.wait_for_load_state("networkidle")
    check("Boş durum mesajı", page.locator("#emptyState").is_visible())

    # ---------- validasyonlar ----------
    page.click("#btnAdd"); page.click("#btnSubmit")
    check("Validasyon: ders seçilmedi", "ders" in page.locator("#formError").inner_text().lower())
    page.click("label[for='ders-0']"); page.fill("#inputSure","45")
    page.fill("#inputDate","2099-01-01"); page.click("#btnSubmit")
    check("Validasyon: gelecek tarih engellendi", "gelecek" in page.locator("#formError").inner_text().lower())
    page.fill("#inputDate","2026-08-15"); page.fill("#inputSure","")
    page.click("#btnSubmit")
    check("Validasyon: boş süre engellendi", "süre" in page.locator("#formError").inner_text().lower())

    # ---------- CREATE ----------
    page.fill("#inputSure","45"); page.fill("#inputNote","İlk deneme kaydı")
    page.click("#btnSubmit"); page.wait_for_timeout(500)
    check("CREATE: kayıt eklendi", page.locator("#studyTbody tr").count() == 1)

    # ---------- UPDATE ----------
    page.locator("[data-action='edit']").first.click(); page.wait_for_timeout(300)
    page.fill("#inputSure","60"); page.click("#btnSubmit"); page.wait_for_timeout(500)
    check("UPDATE: süre 45 -> 60 güncellendi", "1 sa" in page.locator("#studyTbody").inner_text())

    # ---------- READ / arama (Türkçe) ----------
    page.click("#btnAdd"); page.click("label[for='ders-5']")
    page.fill("#inputSure","30"); page.fill("#inputDate","2026-08-14")
    page.fill("#inputNote","Kelime tekrarı"); page.click("#btnSubmit"); page.wait_for_timeout(500)
    page.fill("#searchInput","ingilizce"); page.wait_for_timeout(400)
    check("READ: 'ingilizce' araması (küçük i)", page.locator("#studyTbody tr").count() == 1)
    page.fill("#searchInput","İNGİLİZCE"); page.wait_for_timeout(400)
    check("READ: 'İNGİLİZCE' araması (büyük İ)", page.locator("#studyTbody tr").count() == 1)
    page.fill("#searchInput","")

    # ---------- DELETE (onay yok: anında sil + Geri Al) ----------
    page.locator("[data-action='del']").first.click(); page.wait_for_timeout(500)
    check("DELETE: onay sorulmadan anında silindi", page.locator("#studyTbody tr").count() == 1)
    check("DELETE: Geri Al butonlu toast göründü", page.locator(".toast .toast-action").count() == 1)

    # ---------- GERİ AL ----------
    page.click(".toast .toast-action"); page.wait_for_timeout(500)
    check("UNDO: geri alınan kayıt geri geldi", page.locator("#studyTbody tr").count() == 2)
    page.locator(".toast .toast-x").first.click()

    # ---------- DELETE (kalıcı) ----------
    page.locator("[data-action='del']").first.click(); page.wait_for_timeout(500)
    check("DELETE: ikinci silme ile 1 kayıt kaldı", page.locator("#studyTbody tr").count() == 1)

    # ---------- kalıcılık ----------
    page.reload(); page.wait_for_load_state("networkidle")
    check("Kalıcılık: refresh sonrası veri duruyor", page.locator("#studyTbody tr").count() == 1)

    # ---------- JSON EXPORT ----------
    with page.expect_download() as dl:
        page.click("#btnExport")
    export_path = dl.value.path()
    exported = json.loads(Path(export_path).read_text(encoding="utf-8"))
    check("EXPORT: yedek indirildi ve geçerli JSON", isinstance(exported, list) and len(exported) == 1,
          dl.value.suggested_filename)

    # ---------- JSON IMPORT (geçerli dosya — Değiştir) ----------
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tf:
        json.dump(SEED, tf, ensure_ascii=False); import_path = tf.name
    page.evaluate("() => localStorage.clear()"); page.reload(); page.wait_for_load_state("networkidle")
    page.set_input_files("#fileImport", import_path); page.wait_for_timeout(700)
    check("IMPORT: Değiştir/Birleştir modalı açıldı", page.locator("#importOverlay.open").count() == 1)
    page.click("#btnImportReplace"); page.wait_for_timeout(500)
    check("IMPORT: yedekten 3 kayıt geri yüklendi", page.locator("#studyTbody tr").count() == 3)
    check("IMPORT: toplam süre doğru hesaplandı", "2 sa 15 dk" in page.locator("#statTotal").inner_text())
    page.reload(); page.wait_for_load_state("networkidle")
    check("IMPORT: geri yükleme sonrası kalıcı", page.locator("#studyTbody tr").count() == 3)

    # ---------- JSON IMPORT (Birleştir — aynı kimlikli kayıtlar atlanır) ----------
    page.set_input_files("#fileImport", import_path); page.wait_for_timeout(700)
    page.click("#btnImportMerge"); page.wait_for_timeout(500)
    check("IMPORT: Birleştir — yinelenen kayıtlar eklenmedi", page.locator("#studyTbody tr").count() == 3)

    # ---------- JSON IMPORT (geçersiz dosya reddedilir) ----------
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tf:
        tf.write("{bu geçerli bir json değil"); bad_path = tf.name
    page.set_input_files("#fileImport", bad_path); page.wait_for_timeout(500)
    check("IMPORT: geçersiz JSON reddedildi (veri değişmedi)", page.locator("#studyTbody tr").count() == 3)
    check("IMPORT: geçersiz dosya için uyarı toast'ı", page.locator(".toast").count() >= 1)

    # ---------- IMPORT: bozuk kayıtlar temizlenir ----------
    dirty = SEED + [{"id":"x1","ders":"UydurmaDers","sure":9999,"tarih":"2099-12-31","not":"geçersiz"}]
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tf:
        json.dump(dirty, tf, ensure_ascii=False); dirty_path = tf.name
    page.set_input_files("#fileImport", dirty_path); page.wait_for_timeout(700)
    page.click("#btnImportReplace"); page.wait_for_timeout(500)
    check("IMPORT: geçersiz kayıtlar filtrelenir (sadece 3 geçerli yüklenir)",
          page.locator("#studyTbody tr").count() == 3)

    # ---------- M5: modal erişilebilirlik ----------
    # Çalışma modalı: aria nitelikleri, focus trap, Escape, focus return
    page.fill("#searchInput","")
    page.click("#btnAdd"); page.wait_for_timeout(300)
    modal = page.locator("#overlay .modal")
    check("M5: modal aria-modal/role doğru",
          modal.get_attribute("role") == "dialog" and modal.get_attribute("aria-modal") == "true")
    check("M5: modal açılışta odak #inputSure'a geçti",
          page.evaluate("document.activeElement.id") == "inputSure")
    # Focus trap: Tab ile son elemandan ilkine dönmeli
    page.locator("#btnSubmit").focus()
    page.keyboard.press("Tab"); page.wait_for_timeout(150)
    check("M5: Tab son elemandan ilkine döndü (trap)",
          page.evaluate("document.activeElement.id") == "btnClose")
    page.keyboard.press("Shift+Tab"); page.wait_for_timeout(150)
    check("M5: Shift+Tab ters yönde trap çalışıyor",
          page.evaluate("document.activeElement.id") == "btnSubmit")
    # Escape ile kapanma + focus return
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    check("M5: Escape çalışma modalını kapattı", page.locator("#overlay.open").count() == 0)
    check("M5: odak modalı açan butona geri döndü",
          page.evaluate("document.activeElement.id") == "btnAdd")
    # İçe aktarma onayı açma + Escape
    page.click("#btnAdd"); page.wait_for_timeout(250)
    page.keyboard.press("Escape"); page.wait_for_timeout(200)
    page.set_input_files("#fileImport", import_path); page.wait_for_timeout(600)
    check("M5: import modalında odak Değiştir butonunda",
          page.evaluate("document.activeElement.id") == "btnImportReplace")
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    check("M5: Escape import modalını kapattı", page.locator("#importOverlay.open").count() == 0)

    # ---------- M6: AYARLAR — özel dersler + haftalık hedef ----------
    page.set_viewport_size({"width":1440,"height":1000}); page.wait_for_timeout(300)

    # Ayarlar açılır, aria doğru, odak ders adı girişinde
    page.click("#btnSettings"); page.wait_for_timeout(300)
    a_modal = page.locator("#settingsOverlay .modal")
    check("M6: ayarlar modalı açıldı", page.locator("#settingsOverlay.open").count() == 1)
    check("M6: ayarlar modalı aria doğru",
          a_modal.get_attribute("role") == "dialog" and a_modal.get_attribute("aria-modal") == "true")
    check("M6: odak ders adı girişinde",
          page.evaluate("document.activeElement.id") == "inputSubject")

    # Varsayılan 9 ders + 'Diğer' silinemez (butonu yok)
    check("M6: varsayılan 9 ders listeleniyor", page.locator("#subjectList li").count() == 9)
    check("M6: 'Diğer' silinemez (buton yok)",
          page.locator('#subjectList button[data-del="Diğer"]').count() == 0)

    # Boş ad reddedilir
    page.fill("#inputSubject", ""); page.click("#btnAddSubject"); page.wait_for_timeout(300)
    check("M6: boş ders adı reddedildi", "boş" in page.locator("#subjectError").inner_text().lower())

    # Yinelenen ad reddedilir (büyük/küçük harf duyarsız)
    page.fill("#inputSubject", "MATEMATİK"); page.click("#btnAddSubject"); page.wait_for_timeout(300)
    check("M6: yinelenen ders adı reddedildi", "zaten" in page.locator("#subjectError").inner_text().lower())

    # Geçerli yeni ders eklenir
    page.fill("#inputSubject", "Müzik"); page.click("#btnAddSubject"); page.wait_for_timeout(400)
    check("M6: yeni ders eklendi (10 ders)", page.locator("#subjectList li").count() == 10)
    check("M6: yeni ders çiplere yansıdı",
          page.evaluate("document.querySelectorAll('#dersChips input[name=ders]').length") == 10)

    # Haftalık hedef: geçersiz değer reddedilir, geçerlisi kaydedilir
    page.fill("#inputGoal", "5"); page.click("#btnSaveGoal"); page.wait_for_timeout(300)
    check("M6: geçersiz hedef reddedildi (hedef hâlâ 5 sa)", "hedef 5 sa" in page.locator("#weekNote").inner_text())
    page.fill("#inputGoal", "600"); page.click("#btnSaveGoal"); page.wait_for_timeout(300)
    check("M6: hedef 600 dk kaydedildi", "hedef 10 sa" in page.locator("#weekNote").inner_text())

    # Escape ayarları kapatır + focus return
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    check("M6: Escape ayarları kapattı", page.locator("#settingsOverlay.open").count() == 0)
    check("M6: odak açan butona geri döndü",
          page.evaluate("document.activeElement.id") == "btnSettings")

    # Kalıcılık: ders listesi + hedef yenileme sonrası duruyor
    page.reload(); page.wait_for_load_state("networkidle")
    check("M6: yenileme sonrası 10 ders çipi duruyor",
          page.evaluate("document.querySelectorAll('#dersChips input[name=ders]').length") == 10)
    check("M6: yenileme sonrası hedef duruyor", "hedef 10 sa" in page.locator("#weekNote").inner_text())

    # Boş ders silinir; kaydı olan ders silinemez
    page.click("#btnSettings"); page.wait_for_timeout(300)
    page.click('#subjectList button[data-del="Müzik"]'); page.wait_for_timeout(400)
    check("M6: boş ders silindi (9 ders kaldı)", page.locator("#subjectList li").count() == 9)
    page.keyboard.press("Escape"); page.wait_for_timeout(200)

    # ---------- M6: IMPORT — bilinmeyen ders otomatik oluşturulur ----------
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tf:
        json.dump(SEED + [{"id":"m1","ders":"Satranç","sure":40,"tarih":"2026-08-12","not":"açılış"}],
                  tf, ensure_ascii=False); ozel_path = tf.name
    page.set_input_files("#fileImport", ozel_path); page.wait_for_timeout(700)
    page.click("#btnImportMerge"); page.wait_for_timeout(500)
    check("M6: import bilinmeyen dersle birleştirildi (4 kayıt)",
          page.locator("#studyTbody tr").count() == 4)
    check("M6: 'Satranç' çiplere otomatik eklendi",
          page.evaluate("document.querySelectorAll('#dersChips input[name=ders]').length") == 10)

    # Vazgeç durumunda ders listesi değişmemeli: geçersiz içerikli import + Vazgeç
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as tf:
        json.dump([{"id":"m2","ders":"Astronomi","sure":20,"tarih":"2026-08-12"}],
                  tf, ensure_ascii=False); astron_path = tf.name
    page.set_input_files("#fileImport", astron_path); page.wait_for_timeout(700)
    page.click("#btnImportCancel"); page.wait_for_timeout(300)
    check("M6: Vazgeç — ders listesi değişmedi",
          page.evaluate("document.querySelectorAll('#dersChips input[name=ders]').length") == 10)

    # ---------- istatistikler ----------
    check("İstatistik: en sık ders hesaplanıyor", page.locator("#statTop").inner_text() not in ("—",""))
    check("İstatistik: seri hesaplanıyor", "gün" in page.locator("#statStreak").inner_text())

    # ---------- mobil görünüm ----------
    page.set_viewport_size({"width":390,"height":844}); page.wait_for_timeout(400)
    check("Mobil: tablo taşmadan görüntüleniyor", page.locator(".table-wrap").is_visible())

    check("Konsolda JS hatası yok", len(console_errors) == 0, "; ".join(console_errors[:3]))
    check("Doğal dialog (confirm/alert) hiç açılmadı", len(dialogs) == 0,
          "; ".join(dialogs[:2]))
    browser.close()
    server.shutdown()

print("=" * 62)
geçti = sum(1 for _, ok, _ in RESULTS if ok)
for name, ok, detail in RESULTS:
    satır = f"[{'PASS' if ok else 'FAIL'}] {name}"
    if detail and not ok: satır += f" -> {detail}"
    print(satır)
print("=" * 62)
print(f"SONUÇ: {geçti}/{len(RESULTS)} test geçti")
sys.exit(0 if geçti == len(RESULTS) else 1)
