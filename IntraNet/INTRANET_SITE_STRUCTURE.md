# ボートレースイントラネット サイト構造調査レポート

調査日: 2026-03-18

## 基本情報

- **サイト名**: ボートレースイントラネット(施行者)
- **ログインURL**: `https://wwwg.mbrace.or.jp/intra/`
- **ログイン後URL**: `https://wwwg.mbrace.or.jp/intra/faces/BRCM0000/BRCMGFFF.xhtml`
- **フレームワーク**: JavaServer Faces (JSF) + jQuery
- **フレーム/iframe**: なし（単一ページ構成）

## ログイン方法

```python
import requests
from bs4 import BeautifulSoup

BASE = 'https://wwwg.mbrace.or.jp'
LOGIN_URL = BASE + '/intra/'
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': LOGIN_URL,
    'Content-Type': 'application/x-www-form-urlencoded',
}
session = requests.Session()
session.headers.update(HEADERS)
r = session.get(LOGIN_URL, timeout=30)
soup = BeautifulSoup(r.text, 'html.parser')

def val(name):
    el = soup.find('input', {'name': name})
    return el['value'] if el else ''

payload = {
    'mainform': 'mainform',
    'com.nec.jp.systemdirector.ent.jsfext.token.Token': val('com.nec.jp.systemdirector.ent.jsfext.token.Token'),
    'mainform:hdnIntraFlag': 'true',
    'mainform:hdnGroupId': '',
    'mainform:hdnGroupName': '',
    'mainform:hdnUrlId': '',
    'mainform:UNQ_orexpandText_13': 'B1214',
    'mainform:UNQ_orexpandText_15': 'IeW8+Dh@f+',
    'mainform:UNQ_orbutton_16': '',
    'javax.faces.ViewState': val('javax.faces.ViewState'),
}
r2 = session.post(BASE + '/intra/faces/BRIN00C0/BRING0CF.xhtml', data=payload, timeout=30, allow_redirects=True)
# ログイン後セッションをそのまま使い続ける
```

## ナビゲーション機構

JSFのフォームベースナビゲーション。

1. フォームのアクション先: `/intra/faces/BRCM0000/BRCMGFFF.xhtml`
2. 隠しフィールド `mainform:hdnUrlId` に urlId をセット
3. 送信ボタン `mainform:navigate_url`（値=「機能遷移」）をPOST
4. サーバーが `/intra/top?urlId=XXXXX` にリダイレクト
5. 各ページのフォームアクション: `/intra/faces/BRXX0000/BRXXGXXX.xhtml` 形式

## メニュー構造（全122リンク、15グループ）

| グループ名 | urlId | 主要ページ例 |
|---|---|---|
| **選手成績案内** | BRKY07F00000 | 最近節選手成績表, 選手コース別成績表, 対戦成績表, 選手SG・G1結果表 |
| **売上・配当案内** | - | 売上速報表, 全体売上一覧, 組番別勝舟状況表, 電投売上一覧 |
| **選手情報案内** | - | 選手プロフィール, 選手基本情報, 選手直近情報, 体重履歴一覧表 |
| **競走成績案内** | BRKY07C00000 | レース別出走予定表, 競走成績速報表, 詳細競走成績表, 優勝戦成績速報表 |
| **賞金案内** | - | 選手獲得賞金順位表, 生涯獲得賞金順位表, 獲得賞金ランキング表 |
| **競走場情報案内** | - | 競走場コース別成績表, 競走場別情報, 最高タイム一覧表 |
| **ボート・モーター成績案内** | - | モーター成績集計表, ボート成績集計表, プロペラ節間成績表 |
| **事故・違反情報案内** | - | 条項別事故集計表, スタート事故集計表, 選手スタート事故表 |
| **競技情報CSV** | - | 選手情報CSV, 選手成績CSV, ボート成績CSV, モーター成績CSV, 節間成績CSV |
| **出走表** | BRSY00200000 | 場間場外出走表出力, 出走表CSV出力, 出走表CSV(日付指定) |
| **申請帳票版** | - | 選手成績, 決まり手一覧表, コース別入着率表 等（20件） |
| **掲示板** | BRKY0D700000 | 業務連絡・開催要綱 |
| **その他** | BRAS01E00000 | 開催日程表, 定期訓練予定者一覧表 |
| **斡旋選手情報案内** | - | 出場選手一覧表 |
| **登録簿** | - | ボート登録簿, モーター登録簿 |

## 主要ページ詳細

### 選手基本情報（urlId: BRKY08D00000）

- **入力**: 登録番号（4桁）
- **フォームアクション**: `/intra/faces/BRKY0800/BRKY08DF.xhtml`
- **取得可能データ**:
  - 選手名、級（A1/A2/B1/B2）、支部
  - 生年月日・年齢、登録日・期
  - 級別成績：勝率、2連率、3連率、事故率、出走回数、優出・優勝回数、F/L回数
  - 通算成績（1960年以降）、獲得賞金（生涯・年次）
  - あっせん情報（会場・期間・日数・勝率）
  - 行事・保留・辞退情報

### 選手直近情報（urlId: BRKY08E00000）

- **入力**: 登録番号（4桁）
- **フォームアクション**: `/intra/faces/BRKY0800/BRKY08EF.xhtml`
- **取得可能データ**:
  - 直近出走状況（会場・日付・レース番号・着順）
  - 体重、展示タイム
  - モーター取付状況（チルト角、バック上/下、トランサム上）
  - 気象情報（天候・風向・風速・気温・水温・波高・水位・流速）
  - 直近競走成績テーブル:
    - 艇番・登番・選手名・級・ボート番・モーター番・支部・着順・進入・タイム・ST・条項

### 競走成績速報表（urlId: BRKY07C00000）

- **入力**: 競走場（選択）、開催日（年/月/日）、出力順（艇番順/着順）
- **出力形式**: PDF/CSV のみ（HTML表示なし）
- **注意**: 競走場・日付の両方が必須

### 出走表CSV出力（urlId: BRSY00200000）

- **フォームアクション**: `/intra/faces/BRSY0020/BRSY0020F.xhtml`
- **取得可能データ（リアルタイム）**:
  - 全24場の出走表作成状況（番組登録時刻・出走表作成時刻・完了/未）
  - 当日利用者数（例: 尼崎=140,844人、大村=123,446人）
- **ダウンロード形式**: ZIP圧縮（複数CSVファイル）

### 開催日程表（urlId: BRAS01E00000）

- 2003年12月以降の全場開催スケジュール
- グレード: SG / G1 / G2 / 東西Y / RS / AL / VS / 特タイ / ML / 一般
- 開催形態: ナイター★ / 薄暮▼ / モーニング▲ / ミッドナイト◆ / 女子のみ♀

### 掲示板（urlId: BRKY0D700000）

- **フォームアクション**: `/intra/faces/BRKY0D70/BRKY0D7F.xhtml`
- **データ項目**: 投稿日・所属・投稿者・タイトル・記事種類（業務連絡/開催要綱/日モ配/その他）・重要度
- 施行者・選手からの業務連絡・開催要綱が蓄積

### 競技情報CSV（各種）

| 種類 | urlId |
|---|---|
| 選手情報CSV | - |
| 選手成績CSV | - |
| ボート成績CSV | - |
| モーター成績CSV | - |
| 節間成績CSV | - |

## データ形式サマリー

| カテゴリ | 形式 | 備考 |
|---|---|---|
| 選手基本情報 | HTML テーブル | 登録番号1件ずつ照会 |
| 選手直近情報 | HTML テーブル | 登録番号1件ずつ、気象+成績データ |
| 競走成績速報表 | PDF/CSV のみ | 競走場+日付指定必須 |
| 出走表 | ZIP (CSV×複数) | 全場一覧+ダウンロード |
| 競技情報CSV | CSV ダウンロード | 選手/成績/ボート/モーター/節間 |
| 売上データ | HTML テーブル/CSV/PDF | 開催日指定 |
| 掲示板 | HTML テーブル | 業務連絡・開催要綱の蓄積 |

## 競走場コード一覧

| コード | 競走場 | コード | 競走場 |
|---|---|---|---|
| 01 | 桐生 | 13 | 尼崎 |
| 02 | 戸田 | 14 | 鳴門 |
| 03 | 江戸川 | 15 | 丸亀 |
| 04 | 平和島 | 16 | 児島 |
| 05 | 多摩川 | 17 | 宮島 |
| 06 | 浜名湖 | 18 | 徳山 |
| 07 | 蒲郡 | 19 | 下関 |
| 08 | 常滑 | 20 | 若松 |
| 09 | 津 | 21 | 芦屋 |
| 10 | 三国 | 22 | 福岡 |
| 11 | びわこ | 23 | 唐津 |
| 12 | 住之江 | 24 | 大村 |

## 技術的制約・注意点

1. **セッション管理**: `javax.faces.ViewState` トークンが必須（リクエストごとに更新）
2. **CSRF対策**: `com.nec.jp.systemdirector.ent.jsfext.token.Token` が必須
3. **セッションタイムアウト**: 短め（数リクエスト後に切れる可能性）→ 都度ログインを推奨
4. **フォームナビゲーション**: 各ページ遷移にPOSTが必要（GETで直接URLアクセス不可）
5. **出力形式**: PDF/CSV出力ボタン押下にはフォームバリデーション通過が必要
6. **エンコーディング**: レスポンスはUTF-8

## スクレイピング実装パターン

```python
def get_page(session, url_id, extra_payload=None):
    """任意のページに遷移してHTMLを取得する"""
    TOP_FORM = BASE + '/intra/faces/BRCM0000/BRCMGFFF.xhtml'
    # まず現在ページのViewStateを取得してから遷移
    payload = {
        'mainform': 'mainform',
        'mainform:hdnUrlId': url_id,
        'mainform:navigate_url': '機能遷移',
        'javax.faces.ViewState': current_view_state,
    }
    if extra_payload:
        payload.update(extra_payload)
    r = session.post(TOP_FORM, data=payload, timeout=30)
    return r
```
