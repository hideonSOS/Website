from django.http import JsonResponse
from django.views import View
from django.views.generic import TemplateView

from .scraper import (
    get_day_race_entries, get_next_race, get_race_program, get_score_map,
)


class LiveScoreV2View(TemplateView):
    template_name = 'live_score_v2/index.html'


class RaceProgramAPI(View):
    """指定レースの出走6選手（得点率・順位付き）を返す。"""

    def get(self, request):
        try:
            race_no = int(request.GET.get('rno', 1))
        except (TypeError, ValueError):
            return JsonResponse({'error': 'invalid rno'}, status=400)
        if not 1 <= race_no <= 12:
            return JsonResponse({'error': 'invalid rno'}, status=400)

        racers = get_race_program(race_no)

        try:
            score_map = get_score_map()
        except Exception as e:
            print(f'[live_score_v2] 得点率表取得エラー: {e}')
            score_map = {}
        try:
            entries = get_day_race_entries()
        except Exception as e:
            print(f'[live_score_v2] 出走一覧取得エラー: {e}')
            entries = {}

        for racer in racers:
            info = score_map.get(racer['toban'], {})
            racer['score']     = info.get('score')
            racer['rank']      = info.get('rank')
            racer['points']    = info.get('points', 0.0)
            racer['deduction'] = info.get('deduction', 0.0)
            racer['races']     = info.get('races', 0)
            racer['next_race'] = get_next_race(racer['toban'], race_no, entries)

        return JsonResponse({'racers': racers})
