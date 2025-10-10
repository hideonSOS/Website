# read_data.py
import os
import django
import pandas as pd

# Djangoの設定を読み込む
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "myproject.settings")
django.setup()

# モデルをインポート
from .models import RacerData

# CSV読み込み
df = pd.read_csv(r"C:\\Users\\matsuyama\\OneDrive\\デスクトップ\\study\\myproject\\MyWebsite\\myproject\\racer_page\\static\\racer_page\\racerdata.csv", encoding="shift-jis")



# データ入れ替え
RacerData.objects.all().delete()
RacerData.objects.bulk_create(RacerData(**rec) for rec in df.to_dict("records"))

print("imported:", RacerData.objects.count())
