from django.core.management.base import BaseCommand
from django.apps import apps
from pathlib import Path
import pandas as pd
from racer_page.models import RacerData

class Command(BaseCommand):
    help = "CSVからRacerDataを投入"

    def handle(self, *args, **kwargs):
        # ★ ここがポイント：アプリ(racer_page)の物理パス
        app_root: Path = Path(apps.get_app_config("racer_page").path)

        # CSVの実際の置き場所に合わせてどちらかを選択
        # 1) app/data/racerdata.csv の場合
        csv_path = app_root / "data" / "racerdata.csv"
        # 2) app/static/racer_page/racerdata.csv の場合
        # csv_path = app_root / "static" / "racer_page" / "racerdata.csv"

        # まず確認
       
        if not csv_path.exists():
            raise FileNotFoundError(f"CSVが見つかりません: {csv_path}")

        df = pd.read_csv(csv_path, encoding="utf-8").where(lambda x: x.notnull(), None)
        df.columns = df.columns.map(lambda x: str(x).strip())  # 前後の空白除去
        df = df.loc[:, ~df.columns.duplicated(keep='first')]   # 重複カラム削除
        df = df[[c for c in df.columns if c != '' and c.lower() != 'unnamed: 0']]  # 空列除外
        df.columns=['toban','name','','']


        RacerData.objects.all().delete()
        RacerData.objects.bulk_create(RacerData(**rec) for rec in df.to_dict("records"))

        self.stdout.write(f"imported: {RacerData.objects.count()}")
