import requests
from bs4 import BeautifulSoup

# boatrace.jp は Akamai のボット対策で、ブラウザらしいヘッダーが無いと 403 を返す。
# 切り分けた結果 Accept-Language が必須（User-Agent だけでは 403）。2026-11-24 確認。
HTTP_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
}


def racer_data_scrape(toban):
    url = f"https://www.boatrace.jp/owpc/pc/data/racersearch/profile?toban={toban}"
    try:
        res = requests.get(url, headers=HTTP_HEADERS, timeout=10)
        res.raise_for_status()
    except requests.exceptions.RequestException:
        return {}

    soup = BeautifulSoup(res.text, "html.parser")
    name_tag = soup.select_one("p.racer1_bodyName")
    id_tag = soup.select_one("dl.list3 dd")

    if not name_tag or not id_tag:
        return {}

    return {
        "name": name_tag.get_text(strip=True).replace('\u3000', ''),
        "toban": id_tag.get_text(strip=True),
    }
