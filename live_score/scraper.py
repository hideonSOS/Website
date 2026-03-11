import re
from datetime import date, datetime
from pathlib import Path

import pandas as pd
import requests
from bs4 import BeautifulSoup

# ============================================================
# テスト / 本番 切り替え設定
# ============================================================
TEST_MODE  = True
TEST_DATE  = '20251012'   # テスト用：報知新聞社賞第61回ダイナミック敢闘旗 4日目
VENUE_CODE = '12'         # 住之江

SCORE_CSV_PATH = (
    Path(__file__).resolve().parent.parent
    / 'website' / 'static' / 'website' / 'damy.csv'
)
TITLE_XLSX_PATH = Path(__file__).resolve().parent / 'static' / 'live_score' / 'title.xlsx'
RACELIST_URL    = 'https://www.boatrace.jp/owpc/pc/race/racelist'

# 走目列の定義（表示順）
RUN_COLUMNS = [
    '1日目_1走', '1日目_2走',
    '2日目_1走', '2日目_2走',
    '3日目_1走', '3日目_2走',
    '4日目_1走', '4日目_2走',
    '5日目_1走', '5日目_2走',
    '6日目_1走', '6日目_2走',
]


# ============================================================
# 日付・節管理
# ============================================================
def get_today():
    """今日の日付(YYYYMMDD)。テスト時は固定値。"""
    if TEST_MODE:
        return TEST_DATE
    return date.today().strftime('%Y%m%d')


def _get_current_day():
    """title.xlsx を参照し、今日が節の何日目かを返す。"""
    today = datetime.strptime(get_today(), '%Y%m%d').date()
    try:
        df = pd.read_excel(TITLE_XLSX_PATH, usecols=[1, 2], header=0)
        df.columns = ['start', 'end']
        df['start'] = pd.to_datetime(df['start']).dt.date
        df['end']   = pd.to_datetime(df['end']).dt.date
        for _, row in df.iterrows():
            if row['start'] <= today <= row['end']:
                return (today - row['start']).days + 1
    except Exception as e:
        print(f'[live_score] title.xlsx 読み込みエラー: {e}')
    return 1


# ============================================================
# 元データ取得（常にCSV/スクレイピング、差分適用前）
# ============================================================
def get_original_score_table():
    """元データを返す（手入力差分を含まない、読み取り専用）。"""
    if TEST_MODE:
        return _load_score_csv()
    return _scrape_score_table()


def _load_score_csv():
    df = pd.read_csv(SCORE_CSV_PATH, header=1, index_col=0, encoding='utf-8')
    col_map = {
        '初日':    '1日目_1走', '初日.1':  '1日目_2走',
        '2日目':   '2日目_1走', '2日目.1': '2日目_2走',
        '3日目':   '3日目_1走', '3日目.1': '3日目_2走',
        '4日目':   '4日目_1走', '4日目.1': '4日目_2走',
        '5日目':   '5日目_1走', '5日目.1': '5日目_2走',
    }
    df = df.rename(columns=col_map)
    # テストモード：4日目以降を空欄にして「未確定」状態を再現
    for col in ['4日目_1走', '4日目_2走', '5日目_1走', '5日目_2走']:
        if col in df.columns:
            df[col] = None
    return df


def _scrape_score_table():
    raise NotImplementedError("本番スクレイピングは未実装です")


# ============================================================
# 差分適用（元データを上書きせず、その都度計算）
# ============================================================
def apply_deltas(df, results):
    """
    元DataFrame に確定済み結果リストを適用して新 DataFrame を返す。
    元の df は変更しない（コピーして返す）。

    results: [{'toban': int, 'slot': str, 'rank': int, 'point': int}, ...]

    得点率 = (得点 + delta_score - 減点) / (出走回数 + delta_races)
    ※ 減点は元データの値を固定で使用（二重減算なし）
    """
    if not results:
        return df.copy()

    df = df.copy()
    orig_score     = pd.to_numeric(df['得点'],    errors='coerce').fillna(0)
    orig_deduction = pd.to_numeric(df['減点'],    errors='coerce').fillna(0)
    orig_races     = pd.to_numeric(df['出走回数'], errors='coerce').fillna(0)
    delta_score    = pd.Series(0.0, index=df.index)
    delta_races    = pd.Series(0,   index=df.index)

    for entry in results:
        toban = entry['toban']
        slot  = entry['slot']
        rank  = entry['rank']
        point = entry['point']
        mask  = df['登録番号'] == toban
        if not mask.any():
            continue
        if slot in df.columns:
            df.loc[mask, slot] = rank
        delta_score[mask] += point
        delta_races[mask] += 1

    df['得点']    = (orig_score + delta_score).astype(float)
    df['出走回数'] = (orig_races + delta_races).astype(float)
    df['得点率']  = (
        (df['得点'] - orig_deduction) / df['出走回数'].replace(0, pd.NA)
    ).round(2)
    df = df.sort_values('得点率', ascending=False).reset_index(drop=True)
    df['順位'] = range(1, len(df) + 1)
    return df


# ============================================================
# 出走番組
# ============================================================
def get_race_program(race_no):
    """指定レースの出走6選手を取得する。"""
    today  = get_today()
    params = {'rno': race_no, 'jcd': VENUE_CODE, 'hd': today}
    for attempt in range(2):
        try:
            res = requests.get(RACELIST_URL, params=params, timeout=20)
            res.raise_for_status()
            return _parse_race_program(res.text)
        except requests.exceptions.RequestException as e:
            print(f'[live_score] HTTP error in get_race_program (attempt {attempt+1}): {e}')
        except Exception as e:
            print(f'[live_score] Parse error in get_race_program (attempt {attempt+1}): {e}')
    return []


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
# 次に入力すべき走目の特定
# ============================================================
def get_next_slot(toban, score_df):
    """
    今日が節の何日目かを title.xlsx から取得し、
    該当選手のその日の走目列（1走 or 2走）のうち未入力のものを返す。
    """
    row = score_df[score_df['登録番号'] == toban]
    if row.empty:
        return None
    today = _get_current_day()
    for slot in [f'{today}日目_1走', f'{today}日目_2走']:
        if slot not in score_df.columns:
            continue
        val = row.iloc[0][slot]
        if pd.isna(val) or str(val).strip() == '':
            return slot
    return None
