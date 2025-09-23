# read_data.py
import os
import django
import pandas as pd
from pathlib import Path

# Djangoの設定を読み込む
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "myproject.settings")
django.setup()

# モデルをインポート
from website.models import Title

BasePath = Path(__file__).resolve().parent
path = os.path.join(BasePath,'website/static/website/title.csv')
df = pd.read_csv(path)

df = df.rename(columns={
    "ＩＤ": "id",
    "主催": "organizer",
    "初日": "start_date",
    "最終日": "end_date",
    "タイトル": "title",
    "日数": "days",
})
for col in ["start_date", "end_date"]:
    df[col] = pd.to_datetime(df[col], format="%Y/%m/%d").dt.date

df["id"] = df["id"].astype(int)
df["days"] = df["days"].astype(int)

# データ入れ替え
Title.objects.all().delete()
Title.objects.bulk_create(Title(**rec) for rec in df.to_dict("records"))

print("imported:", Title.objects.count())
