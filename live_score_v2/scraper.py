import re
from datetime import date

import requests
from bs4 import BeautifulSoup

VENUE_CODE   = '12'  # 住之江
RACELIST_URL = 'https://www.boatrace.jp/owpc/pc/race/racelist'

# ============================================================
# 得点率の取得元メモ（2026-07-19 に競艇日和へ変更）
# ============================================================
# 【新】競艇日和 race_tokuten.php
#   ・公式（rank.htm）よりレース確定後の反映が早い（数分単位）
#   ・得点率は切り捨て表示（例: 55点/6走 → 9.16）。こちらが適切な丸め方
#   ・出走回数の列が無いため「着順」列の文字数（転・F 等の記号も1走）で代替
#   ・「早見」列＝当日の出走レース。次走判定もここから行うため、
#     旧実装の raceindex スクレイピング（get_day_race_entries）は不要になった
# 【旧】住之江公式 rank.htm ＋ BOAT RACE公式 raceindex
#   ・実装はファイル末尾にコメントアウトで保存（復帰手順もそちらを参照）
# RANK_URL      = 'https://www.boatrace-suminoe.jp/asp/htmlmade/suminoe/rank/rank.htm'
# RACEINDEX_URL = 'https://www.boatrace.jp/owpc/pc/race/raceindex'
TOKUTEN_URL = 'https://kyoteibiyori.com/race_tokuten.php'

HTTP_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
}


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


def get_score_table(race_no=1):
    """競艇日和の得点率ページをスクレイピングして選手行(<tr>)のリストを返す。

    race_no はページ表示用のパラメータで、得点率テーブルの内容自体は
    どの値でも同一（1〜12・省略・不正値で同一なことを2026-07-19に確認済み）。
    サイト本来の使い方に合わせ、選択中のレース番号をそのまま渡す。
    """
    params = {'place_no': VENUE_CODE, 'race_no': race_no, 'hiduke': get_today()}
    res = requests.get(TOKUTEN_URL, params=params, headers=HTTP_HEADERS, timeout=20)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, 'html.parser')
    # racer_table のうちヘッダー用（bgColor_table_header）を除いた最初のものが
    # 「着順・早見」表示のデータ本体（2つ目は「前検・直近」表示用）
    for table in soup.find_all('table', class_='racer_table'):
        if 'bgColor_table_header' in table.get('class', []):
            continue
        return table.find_all('tr')
    raise ValueError('得点率テーブルが見つかりません')


def get_score_map(race_no=1):
    """登録番号 → {'score': 得点率, 'rank': 順位, 'grade': 級別, 'name': 選手名,
    'points': 得点, 'deduction': 減点, 'races': 出走回数,
    'today_races': 当日出走レース番号リスト} の辞書を返す。

    辞書の並び順はサイトの表示順（順位順・帰郷選手は末尾）を保持する。
    列構成: 順位 | 選手情報(登録番号 級別 選手名) | 得点率 | 得点 | 減点 | 着順 | 早見 | 備考
    """
    score_map = {}
    for tr in get_score_table(race_no):
        cells = [td.get_text(' ', strip=True) for td in tr.find_all('td')]
        if len(cells) < 7:
            continue
        rank_s, info, score_s, points_s, deduction_s, chakujun, hayami = cells[:7]
        parts = info.split(None, 2)   # 「4074 A1 柳沢一」→ [登録番号, 級別, 選手名]
        if not parts or not parts[0].isdigit():
            continue
        toban = int(parts[0])
        score_map[toban] = {
            'score':     _to_float(score_s),
            'rank':      int(rank_s) if rank_s.isdigit() else None,  # 帰郷選手は「-」
            'grade':     parts[1] if len(parts) > 1 else '',
            'name':      parts[2] if len(parts) > 2 else '',
            'points':    _to_float(points_s) or 0.0,
            'deduction': _to_float(deduction_s) or 0.0,
            # 出走回数の列が無いため着順の文字数で代替（転・F 等の記号も1走）
            'races':     len(re.sub(r'\s', '', chakujun)),
            'today_races': [int(x[:-1]) for x in hayami.split() if re.fullmatch(r'\d+R', x)],
        }
    return score_map


def _to_float(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def get_next_race(toban, race_no, score_map):
    """「早見」列の当日出走レースから、選択レースより後の出走レース番号を返す（なければ None）。"""
    info = score_map.get(toban) or {}
    for rno in info.get('today_races', []):
        if rno > race_no:
            return rno
    return None


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


# ============================================================
# 【旧実装・保存用】住之江公式 rank.htm ＋ raceindex 版（〜2026-07-19）
# ============================================================
# 復帰する場合:
#   1. 下記ブロックのコメントアウトを解除（import も含む）
#   2. 上の get_score_table / get_score_map / get_next_race を削除または退避
#   3. views.py の次走判定を get_day_race_entries 方式に戻す
#      （entries = get_day_race_entries() を取得して
#        get_next_race(toban, race_no, entries) に渡す。views.py 内の
#        コメントアウトを参照）
#
# from io import StringIO
#
# import pandas as pd
#
# RANK_URL      = 'https://www.boatrace-suminoe.jp/asp/htmlmade/suminoe/rank/rank.htm'
# RACEINDEX_URL = 'https://www.boatrace.jp/owpc/pc/race/raceindex'
#
#
# def get_day_race_entries():
#     """本日の出走表一覧ページから {レース番号: [登録番号×6]} を返す。"""
#     params = {'jcd': VENUE_CODE, 'hd': get_today()}
#     res = requests.get(RACEINDEX_URL, params=params, timeout=20)
#     res.raise_for_status()
#     soup = BeautifulSoup(res.text, 'html.parser')
#     tobans = []
#     for a in soup.select('a[href*="toban="]'):
#         match = re.search(r'toban=(\d+)', a['href'])
#         if match:
#             tobans.append(int(match.group(1)))
#     # 文書順に6人ずつ = 1R, 2R, ... のグループ
#     entries = {}
#     for i in range(0, len(tobans) - len(tobans) % 6, 6):
#         entries[i // 6 + 1] = tobans[i:i + 6]
#     return entries
#
#
# def get_next_race(toban, race_no, entries):
#     """選択レースより後で出走が控えているレース番号を返す（なければ None）。"""
#     for rno in sorted(entries):
#         if rno > race_no and toban in entries[rno]:
#             return rno
#     return None
#
#
# def get_score_table():
#     """住之江公式の得点率ページをスクレイピングして DataFrame を返す。"""
#     res = requests.get(RANK_URL, headers=HTTP_HEADERS, timeout=20)
#     res.raise_for_status()
#     res.encoding = res.apparent_encoding or 'utf-8'
#
#     soup = BeautifulSoup(res.text, 'html.parser')
#     table = soup.find('table', class_='list')
#     if table is None:
#         raise ValueError('得点率テーブルが見つかりません')
#     for img in table.find_all('img'):
#         img.decompose()
#
#     dfs = pd.read_html(StringIO(str(table)), header=[0, 1])
#     df = dfs[0]
#
#     # MultiIndex 列をフラット化（(順位, 順位) → 順位）
#     new_cols = []
#     for top, sub in df.columns:
#         sub_s = str(sub)
#         if 'Unnamed' in sub_s or str(top) == sub_s:
#             new_cols.append(str(top))
#         else:
#             new_cols.append(sub_s)
#     df.columns = new_cols
#     return df
#
#
# def get_score_map():
#     """登録番号 → {'score': 得点率, 'rank': 順位, 'points': 得点,
#     'deduction': 減点, 'races': 出走回数} の辞書を返す。"""
#     df = get_score_table()
#     score_map = {}
#     for _, row in df.iterrows():
#         toban = pd.to_numeric(row.get('登録番号'), errors='coerce')
#         if pd.isna(toban):
#             continue
#         score     = pd.to_numeric(row.get('得点率'),   errors='coerce')
#         rank      = pd.to_numeric(row.get('順位'),     errors='coerce')
#         points    = pd.to_numeric(row.get('得点'),     errors='coerce')
#         deduction = pd.to_numeric(row.get('減点'),     errors='coerce')
#         races     = pd.to_numeric(row.get('出走回数'), errors='coerce')
#         score_map[int(toban)] = {
#             'score':     None if pd.isna(score)  else float(score),
#             'rank':      None if pd.isna(rank)   else int(rank),
#             'points':    0.0  if pd.isna(points) else float(points),
#             'deduction': 0.0  if pd.isna(deduction) else float(deduction),
#             'races':     0    if pd.isna(races)  else int(races),
#         }
#     return score_map
