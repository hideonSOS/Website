import io
from datetime import date

import openpyxl
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from .models import MotorComment, Title
from .views import Motor_Comments


def _make_xlsx(rows, headers=("号機", "コメント", "発言日", "開催", "使用選手", "使用ボート", "投稿者")):
    """rows: 各行の dict を受け取り xlsx バイト列を返す。"""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(list(headers))
    for r in rows:
        ws.append([r.get(h, "") for h in headers])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    buf.name = "test.xlsx"
    return buf


class MotorCommentExcelUploadTests(TestCase):
    def setUp(self):
        self.url = reverse("website:motor_comments_upload")
        # 開催の完全一致テスト用に1件登録
        Title.objects.create(
            id=1, organizer="都市", start_date=date(2026, 8, 1),
            end_date=date(2026, 8, 3), title="テスト開催", days=3,
        )

    def test_valid_import_creates_rows_and_sets_created_at(self):
        xlsx = _make_xlsx([
            {"号機": 24, "コメント": "出足良好", "発言日": "2026-07-10",
             "開催": "テスト開催", "使用選手": "柳沢一", "使用ボート": "12", "投稿者": "スタッフ"},
            {"号機": 5, "コメント": "回り足いまいち", "発言日": "2026-07-11",
             "開催": Motor_Comments.FIRST_TITLE, "投稿者": ""},
        ])
        res = self.client.post(self.url, {"excel": xlsx})
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "2件のコメントを登録しました")
        self.assertEqual(MotorComment.objects.count(), 2)

        a = MotorComment.objects.get(machine_no=24)
        self.assertEqual(a.content, "出足良好")
        self.assertEqual(a.racer, "柳沢一")
        self.assertEqual(a.boat_no, "12")
        self.assertEqual(a.author, "スタッフ")
        self.assertEqual(a.parts_exchange, "")   # 部品交換は取込対象外＝空
        self.assertIsNone(a.scheduled_at)         # 入力日は使わない
        # created_at が発言日に上書きされている（JSTローカルで判定）
        self.assertEqual(timezone.localtime(a.created_at).date(), date(2026, 7, 10))
        # フロントは isoformat() を slice(0,10) で日付に使う→UTC表現でも同じ暦日であること
        self.assertTrue(a.created_at.isoformat().startswith("2026-07-10"))

        b = MotorComment.objects.get(machine_no=5)
        self.assertEqual(b.author, "匿名")        # 空欄→匿名
        self.assertEqual(timezone.localtime(b.created_at).date(), date(2026, 7, 11))
        self.assertTrue(b.created_at.isoformat().startswith("2026-07-11"))

    def test_bad_title_rejects_whole_file(self):
        xlsx = _make_xlsx([
            {"号機": 1, "コメント": "ok", "発言日": "2026-07-10", "開催": "テスト開催"},
            {"号機": 2, "コメント": "ng", "発言日": "2026-07-10", "開催": "存在しない開催"},
        ])
        res = self.client.post(self.url, {"excel": xlsx})
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "エラーが発生しました。ファイルを見直してください。")
        self.assertContains(res, "一致しない")
        # all-or-nothing: 1件も保存されない
        self.assertEqual(MotorComment.objects.count(), 0)

    def test_missing_required_fields_reject_all(self):
        xlsx = _make_xlsx([
            {"号機": 1, "コメント": "ok", "発言日": "2026-07-10"},
            {"号機": "", "コメント": "号機なし", "発言日": "2026-07-10"},       # 号機欠落
            {"号機": 3, "コメント": "", "発言日": "2026-07-10"},               # コメント欠落
            {"号機": 4, "コメント": "日付不正", "発言日": "notadate"},          # 発言日不正
            {"号機": 5, "コメント": "ボート不正", "発言日": "2026-07-10", "使用ボート": "12A"},
        ])
        res = self.client.post(self.url, {"excel": xlsx})
        self.assertContains(res, "エラーが発生しました。ファイルを見直してください。")
        self.assertEqual(MotorComment.objects.count(), 0)

    def test_same_day_rows_keep_excel_order(self):
        xlsx = _make_xlsx([
            {"号機": 1, "コメント": "先", "発言日": "2026-07-10"},
            {"号機": 2, "コメント": "後", "発言日": "2026-07-10"},
        ])
        self.client.post(self.url, {"excel": xlsx})
        first = MotorComment.objects.get(content="先")
        second = MotorComment.objects.get(content="後")
        # Excelで先の行のほうが created_at が早い（同日内の順序保持）
        self.assertLess(first.created_at, second.created_at)

    def test_empty_rows_are_skipped(self):
        xlsx = _make_xlsx([
            {"号機": 1, "コメント": "有効", "発言日": "2026-07-10"},
            {},  # 空行
        ])
        res = self.client.post(self.url, {"excel": xlsx})
        self.assertContains(res, "1件のコメントを登録しました")
        self.assertEqual(MotorComment.objects.count(), 1)
