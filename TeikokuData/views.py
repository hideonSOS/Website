import requests
from bs4 import BeautifulSoup
from django.views.generic import TemplateView

BASE_URL = 'https://boatrace-db.net/'
HEADERS  = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}


def scrape_today_finals():
    """本日の優勝戦テーブルを取得して返す"""
    r = requests.get(BASE_URL, headers=HEADERS, timeout=15)
    r.encoding = 'utf-8'
    soup = BeautifulSoup(r.text, 'html.parser')

    date_text = ''
    headers   = []
    races     = []

    h2 = soup.find('h2', string=lambda t: t and '本日のレース情報' in t)
    if h2:
        date_text = h2.text.strip()
        h3 = h2.find_next('h3', string=lambda t: t and '優勝戦' in t)
        if h3:
            table = h3.find_next('table')
            if table:
                thead = table.find('thead')
                if thead:
                    headers = [th.text.strip() for th in thead.find_all('th')]
                for tr in table.find_all('tr'):
                    tds = tr.find_all('td')
                    if not tds:
                        continue
                    cells = ['\n'.join(l for l in td.get_text(separator='\n').splitlines() if l.strip()) for td in tds]
                    races.append(cells)

    return date_text, headers, races


def scrape_racer(regno):
    """選手の通算成績ページから全テーブルを取得して返す"""
    url = f'{BASE_URL}racer/index2/regno/{regno}/'
    r = requests.get(url, headers=HEADERS, timeout=15)
    r.encoding = 'utf-8'
    soup = BeautifulSoup(r.text, 'html.parser')

    # 選手名（h1）
    h1 = soup.find('h1')
    racer_name = h1.text.strip() if h1 else f'登録番号 {regno}'
    # 登録番号部分を除去（例: "3882 新田　智彰" → "新田　智彰"）
    parts = racer_name.split(None, 1)
    racer_name = parts[1] if len(parts) > 1 else racer_name

    # h2「通算成績」配下の h3 セクションとテーブルを収集
    sections = []
    h2 = soup.find('h2', string=lambda t: t and '通算成績' in t)
    if h2:
        for h3 in h2.find_all_next('h3'):
            # 次のh2が来たら終了
            prev_h2 = h3.find_previous('h2')
            if prev_h2 != h2:
                break
            table = h3.find_next('table')
            if not table:
                continue
            thead = table.find('thead')
            sec_headers = [th.text.strip() for th in thead.find_all('th')] if thead else []
            sec_rows = []
            for tr in table.find_all('tr'):
                tds = tr.find_all('td')
                if not tds:
                    continue
                sec_rows.append([td.text.strip() for td in tds])
            sections.append({
                'title':   h3.text.strip(),
                'headers': sec_headers,
                'rows':    sec_rows,
            })

    # 艇番別成績から2連対率を抽出
    boat_rates = []
    for sec in sections:
        if '艇番別成績' in sec['title']:
            for row in sec['rows']:
                if len(row) > 4:
                    val = row[4].replace('%', '').replace('\xa0', '').strip()
                    try:
                        boat_rates.append(float(val))
                    except ValueError:
                        boat_rates.append(0.0)
            break

    # 艇番別進入コースを抽出 (1号艇～6号艇 × [1コース～6コース, その他])
    # row: [艇番, 出走数, 1コース, 2コース, 3コース, 4コース, 5コース, 6コース, その他]
    boat_courses = []
    for sec in sections:
        if '艇番別進入コース' in sec['title']:
            for row in sec['rows']:
                if len(row) >= 9:
                    counts = []
                    for v in row[2:9]:  # 1コース～その他
                        try:
                            counts.append(int(v.replace(',', '')))
                        except ValueError:
                            counts.append(0)
                    boat_courses.append(counts)
            break

    return racer_name, sections, boat_rates, boat_courses


class Teikoku1View(TemplateView):
    template_name = 'TeikokuData/teikoku1.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        try:
            date_text, headers, races = scrape_today_finals()
            ctx['date_text'] = date_text
            ctx['headers']   = headers
            ctx['races']     = races
            ctx['error']     = None
        except Exception as e:
            ctx['date_text'] = ''
            ctx['headers']   = []
            ctx['races']     = []
            ctx['error']     = str(e)
        return ctx


class Teikoku2View(TemplateView):
    template_name = 'TeikokuData/teikoku2.html'

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        regno = self.kwargs.get('regno', '')
        ctx['regno'] = regno
        try:
            racer_name, sections, boat_rates, boat_courses = scrape_racer(regno)
            ctx['racer_name']   = racer_name
            ctx['sections']     = sections
            ctx['boat_rates']   = boat_rates
            ctx['boat_courses'] = boat_courses
            ctx['error']       = None
        except Exception as e:
            ctx['racer_name'] = ''
            ctx['sections']   = []
            ctx['error']      = str(e)
        return ctx
