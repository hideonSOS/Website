import json
from datetime import datetime
from pathlib import Path

import pandas as pd
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import TemplateView

from .scraper import (
    RUN_COLUMNS,
    apply_deltas, get_next_slot, get_original_score_table, get_race_program,
)

# 差分を保存する唯一のファイル
CONFIRMED_RESULTS_PATH = Path(__file__).resolve().parent / 'confirmed_results.json'


# ── ヘルパー ──────────────────────────────────────────────

def _to_int_str(val):
    """3.0 → '3'、文字列・空欄はそのまま返す"""
    if val == '' or pd.isna(val):
        return val
    try:
        f = float(val)
        return str(int(f)) if f == int(f) else str(f)
    except (ValueError, TypeError):
        return val


def _load_results():
    """確定済み差分リストを返す。"""
    if CONFIRMED_RESULTS_PATH.exists():
        return json.loads(CONFIRMED_RESULTS_PATH.read_text(encoding='utf-8'))
    return []


def _save_results(results):
    CONFIRMED_RESULTS_PATH.write_text(
        json.dumps(results, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )


def _get_confirmed_race_nos():
    """確定済みレース番号のセットを返す。"""
    return {entry['race_no'] for entry in _load_results()}


def _get_manual_cells():
    """確定済みセルの "toban_slot" セットを返す。"""
    return {f"{int(entry['toban'])}_{entry['slot']}" for entry in _load_results()}


def _compute_score_table(extra=None):
    """
    元データ + 確定済み差分 [+ 追加差分] から得点率表を計算して返す。
    extra: プレビュー用の追加差分リスト（保存しない）
    """
    df      = get_original_score_table()
    results = _load_results()
    if extra:
        results = results + list(extra)
    return apply_deltas(df, results)


def _build_disp(df, run_cols):
    """表示用 DataFrame を整形して dict リストで返す。"""
    base_cols = ['順位', '登録番号', '選手名', '級別', '得点率', '得点', '減点', '出走回数']
    show_cols = base_cols + run_cols
    df_disp   = df[show_cols].where(pd.notnull(df[show_cols]), '')
    for col in ['登録番号', '得点', '減点', '出走回数'] + run_cols:
        if col in df_disp.columns:
            df_disp[col] = df_disp[col].apply(_to_int_str)
    # numpy.float64 → Python float（json.dumps 対応）、数値変換できない文字列はそのまま
    def _to_rate(v):
        if v == '':
            return ''
        try:
            return float(v)
        except (ValueError, TypeError):
            return str(v)
    df_disp['得点率'] = df_disp['得点率'].apply(_to_rate)
    return df_disp.to_dict('records')


# ── Views ─────────────────────────────────────────────────

class LiveScoreView(TemplateView):
    template_name = 'live_score/index.html'

    def get_context_data(self, **kwargs):
        ctx      = super().get_context_data(**kwargs)
        df       = _compute_score_table()
        run_cols = [c for c in RUN_COLUMNS if c in df.columns]
        rows     = _build_disp(df, run_cols)
        show_cols = ['順位', '登録番号', '選手名', '級別', '得点率', '得点', '減点', '出走回数'] + run_cols

        ctx['headers']           = show_cols
        ctx['run_cols']          = run_cols
        ctx['run_cols_json']     = json.dumps(run_cols, ensure_ascii=False)
        ctx['rows']              = rows
        ctx['race_range']        = range(1, 13)
        ctx['manual_cells_json'] = json.dumps(sorted(_get_manual_cells()), ensure_ascii=False)
        return ctx


class RaceProgramAPI(View):
    """GET /live_score/api/race_program/?race_no=7"""
    def get(self, request):
        race_no = request.GET.get('race_no')
        if not race_no or not race_no.isdigit():
            return JsonResponse({'error': 'race_no が不正です'}, status=400)

        racers = get_race_program(int(race_no))
        df     = _compute_score_table()
        for r in racers:
            r['next_slot'] = get_next_slot(r['toban'], df)
        return JsonResponse({'racers': racers})


class PreviewResultAPI(View):
    """POST /live_score/api/preview/ — 保存せず計算結果のみ返す"""
    def post(self, request):
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': '不正なJSON'}, status=400)

        results_in  = body.get('results', [])
        race_type   = body.get('race_type', '一般戦')
        point_table = body.get('point_table', {})

        current_table = {int(k): v for k, v in point_table.get(race_type, {}).items()}
        if not current_table:
            current_table = {1: 10, 2: 8, 3: 6, 4: 4, 5: 2, 6: 1}

        # 確定済み差分を適用した現在の状態
        base_df = _compute_score_table()

        # 今回のプレビュー分（保存しない）
        extra = []
        for result in results_in:
            toban = result.get('toban')
            rank  = result.get('rank')
            if not toban or not rank:
                continue
            slot = get_next_slot(toban, base_df)
            if not slot:
                continue
            extra.append({
                'toban': toban,
                'slot':  slot,
                'rank':  rank,
                'point': current_table.get(rank, 0),
            })

        df       = apply_deltas(base_df, extra)
        run_cols = [c for c in RUN_COLUMNS if c in df.columns]
        rows     = _build_disp(df, run_cols)
        return JsonResponse({'rows': rows})


class ConfirmResultAPI(View):
    """POST /live_score/api/confirm/"""
    def post(self, request):
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'error': '不正なJSON'}, status=400)

        results_in  = body.get('results', [])
        race_type   = body.get('race_type', '一般戦')
        point_table = body.get('point_table', {})
        race_no     = body.get('race_no')

        # 二重確定を防止
        if race_no in _get_confirmed_race_nos():
            return JsonResponse({'error': f'{race_no}Rは既に確定済みです'}, status=400)

        current_table = {int(k): v for k, v in point_table.get(race_type, {}).items()}
        if not current_table:
            current_table = {1: 10, 2: 8, 3: 6, 4: 4, 5: 2, 6: 1}

        # 確定済み差分を適用した現在の状態（スロット決定に使用）
        base_df = _compute_score_table()

        new_entries = []
        for result in results_in:
            toban = result.get('toban')
            rank  = result.get('rank')
            if not toban or not rank:
                continue
            slot = get_next_slot(toban, base_df)
            if not slot:
                continue
            new_entries.append({
                'race_no': race_no,
                'toban':   toban,
                'slot':    slot,
                'rank':    rank,
                'point':   current_table.get(rank, 0),
            })

        # 差分リストに追記して保存
        _save_results(_load_results() + new_entries)

        # 保存後の全差分を適用した最終状態を返す
        df       = _compute_score_table()
        run_cols = [c for c in RUN_COLUMNS if c in df.columns]
        rows     = _build_disp(df, run_cols)
        manual_cells = _get_manual_cells()

        return JsonResponse({'rows': rows, 'manual_cells': sorted(manual_cells)})


class RankingAPI(View):
    """GET /live_score/api/ranking/"""
    def get(self, request):
        try:
            # 常に元データ + 差分から再計算（キャッシュなし）
            df       = _compute_score_table()
            run_cols = [c for c in RUN_COLUMNS if c in df.columns]
            rows     = _build_disp(df, run_cols)

            # base_得点率 = 元CSVの得点率列（差分適用前の公式値）
            df_orig  = get_original_score_table()
            base_map = {
                int(k): float(v)
                for k, v in zip(
                    df_orig['登録番号'],
                    pd.to_numeric(df_orig['得点率'], errors='coerce').fillna(0)
                )
                if pd.notna(k)
            }
            for row in rows:
                toban = int(row.get('登録番号') or 0)
                row['base_得点率'] = base_map.get(toban, 0.0)

            updated_at = ''
            if CONFIRMED_RESULTS_PATH.exists():
                mtime      = CONFIRMED_RESULTS_PATH.stat().st_mtime
                updated_at = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')

            return JsonResponse({'rows': rows, 'updated_at': updated_at})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class ResetSessionAPI(View):
    """POST /live_score/api/reset_session/"""
    def post(self, request):
        try:
            if CONFIRMED_RESULTS_PATH.exists():
                CONFIRMED_RESULTS_PATH.unlink()
            return JsonResponse({'status': 'ok'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class GraphView(TemplateView):
    template_name = 'live_score/graph.html'
