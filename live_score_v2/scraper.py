import re
from datetime import date
from io import StringIO

import pandas as pd
import requests
from bs4 import BeautifulSoup

VENUE_CODE    = '12'  # 住之江
RACELIST_URL  = 'https://www.boatrace.jp/owpc/pc/race/racelist'
RACEINDEX_URL = 'https://www.boatrace.jp/owpc/pc/race/raceindex'
RANK_URL      = 'https://www.boatrace-suminoe.jp/asp/htmlmade/suminoe/rank/rank.htm'


def get_today():
    return date.today().strftime('%Y%m%d')


def get_race_program(race_no):
    """BOAT RACE公式の出走表から指定レースの出走6選手を取得する。"""
    params = {'rno': race_no, 'jcd': VENUE_CODE, 'hd': get_today()}
    for attempt in range(2):
        try:
            res = requests.get(RACELIST_URL, params=params, timeout=20)
            res.raise_for_status()
            return _parse_race_program(res.text)
        except requests.exceptions.RequestException as e:
            print(f'[live_score_v2] HTTP error in get_race_program (attempt {attempt+1}): {e}')
        except Exception as e:
            print(f'[live_score_v2] Parse error in get_race_program (attempt {attempt+1}): {e}')
    return []


def get_day_race_entries():
    """本日の出走表一覧ページから {レース番号: [登録番号×6]} を返す。"""
    params = {'jcd': VENUE_CODE, 'hd': get_today()}
    res = requests.get(RACEINDEX_URL, params=params, timeout=20)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, 'html.parser')
    tobans = []
    for a in soup.select('a[href*="toban="]'):
        match = re.search(r'toban=(\d+)', a['href'])
        if match:
            tobans.append(int(match.group(1)))
    # 文書順に6人ずつ = 1R, 2R, ... のグループ
    entries = {}
    for i in range(0, len(tobans) - len(tobans) % 6, 6):
        entries[i // 6 + 1] = tobans[i:i + 6]
    return entries


def get_next_race(toban, race_no, entries):
    """選択レースより後で出走が控えているレース番号を返す（なければ None）。"""
    for rno in sorted(entries):
        if rno > race_no and toban in entries[rno]:
            return rno
    return None


def get_score_table():
    """住之江公式の得点率ページをスクレイピングして DataFrame を返す。"""
    http_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    }
    res = requests.get(RANK_URL, headers=http_headers, timeout=20)
    res.raise_for_status()
    res.encoding = res.apparent_encoding or 'utf-8'

    soup = BeautifulSoup(res.text, 'html.parser')
    table = soup.find('table', class_='list')
    if table is None:
        raise ValueError('得点率テーブルが見つかりません')
    for img in table.find_all('img'):
        img.decompose()

    dfs = pd.read_html(StringIO(str(table)), header=[0, 1])
    df = dfs[0]

    # MultiIndex 列をフラット化（(順位, 順位) → 順位）
    new_cols = []
    for top, sub in df.columns:
        sub_s = str(sub)
        if 'Unnamed' in sub_s or str(top) == sub_s:
            new_cols.append(str(top))
        else:
            new_cols.append(sub_s)
    df.columns = new_cols
    return df


def get_score_map():
    """登録番号 → {'score': 得点率, 'rank': 順位, 'points': 得点,
    'deduction': 減点, 'races': 出走回数} の辞書を返す。"""
    df = get_score_table()
    score_map = {}
    for _, row in df.iterrows():
        toban = pd.to_numeric(row.get('登録番号'), errors='coerce')
        if pd.isna(toban):
            continue
        score     = pd.to_numeric(row.get('得点率'),   errors='coerce')
        rank      = pd.to_numeric(row.get('順位'),     errors='coerce')
        points    = pd.to_numeric(row.get('得点'),     errors='coerce')
        deduction = pd.to_numeric(row.get('減点'),     errors='coerce')
        races     = pd.to_numeric(row.get('出走回数'), errors='coerce')
        score_map[int(toban)] = {
            'score':     None if pd.isna(score)  else float(score),
            'rank':      None if pd.isna(rank)   else int(rank),
            'points':    0.0  if pd.isna(points) else float(points),
            'deduction': 0.0  if pd.isna(deduction) else float(deduction),
            'races':     0    if pd.isna(races)  else int(races),
        }
    return score_map


def _parse_race_program(html):
    soup   = BeautifulSoup(html, 'html.parser')
    racers = []
    for img in soup.select('img[src*="racerphoto"]'):
        match = re.search(r'racerphoto/(\d+)\.jpg', img['src'])
        if not match:
            continue
        toban = int(match.group(1))
        name  = ''
        for a in soup.select(f'a[href*="toban={toban}"]'):
            text = a.get_text(strip=True)
            if text:
                name = text
                break
        racers.append({'boat': len(racers) + 1, 'toban': toban, 'name': name})
        if len(racers) == 6:
            break
    return racers
