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
