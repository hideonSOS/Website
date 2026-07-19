from django.http import JsonResponse
from django.views import View
from django.views.generic import TemplateView

from .scraper import get_next_race, get_race_program, get_score_map
# 旧（rank.htm 版）: 次走判定に raceindex の出走一覧を使っていた
# from .scraper import get_day_race_entries


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
            score_map = get_score_map(race_no)
        except Exception as e:
            print(f'[live_score_v2] 得点率表取得エラー: {e}')
            score_map = {}
        # 旧（rank.htm 版）: 次走判定用に出走一覧を別リクエストで取得していた
        # try:
        #     entries = get_day_race_entries()
        # except Exception as e:
        #     print(f'[live_score_v2] 出走一覧取得エラー: {e}')
        #     entries = {}

        for racer in racers:
            info = score_map.get(racer['toban'], {})
            racer['score']     = info.get('score')
            racer['rank']      = info.get('rank')
            racer['points']    = info.get('points', 0.0)
            racer['deduction'] = info.get('deduction', 0.0)
            racer['races']     = info.get('races', 0)
            # 次走は得点率表の「早見」列（当日出走レース）から判定
            racer['next_race'] = get_next_race(racer['toban'], race_no, score_map)

        return JsonResponse({'racers': racers})
