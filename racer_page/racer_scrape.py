import pandas as pd
import requests
from lxml import html
from bs4 import BeautifulSoup
import requests


def racer_data_scrape(toban):
    url = f"https://www.boatrace.jp/owpc/pc/data/racersearch/profile?toban={toban}"
    try:
        res = requests.get(url)
        res.raise_for_status()
        
    except requests.exceptions.RequestException:
        return {}  # タイムアウトや通信エラー時は空辞書で返す

    soup = BeautifulSoup(res.text, "html.parser")
    name_tag = soup.select_one("p.racer1_bodyName")
    id_tag = soup.select_one("dl.list3 dd")

    if not name_tag or not id_tag:
        return {}

    return {
        "name": name_tag.get_text(strip=True).replace('\u3000', ''),
        "toban": id_tag.get_text(strip=True)
    }



