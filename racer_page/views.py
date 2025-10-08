from django.views.generic import TemplateView,View
from django.shortcuts import redirect, render
from .racer_scrape import racer_data_scrape
from django.http import HttpResponse
from .models import RacerData



class RacerInput(TemplateView):
    template_name = 'input.html'


class RacerDisplay(View):
    def post(self, request):
         # 6人分の入力をすべて取得（空欄も含む）
        racer_ids = []
        for i in range(1, 7):
            val = request.POST.get(f"racer_{i}")
            if val and val.isdigit():
                racer_ids.append(int(val))
            else:
                racer_ids.append(None)  # 空欄でも枠を維持

        # DBから該当選手を取得（Noneは無視）
        db_racers = {
            r.toban: {"toban": r.toban, "name": r.name, "kana": r.kana, "branch": r.branch}
            for r in RacerData.objects.filter(toban__in=[v for v in racer_ids if v])
        }

        # 6枠を固定して返す（空欄はダミーで埋める）
        racers = [
            db_racers.get(v, {"toban": "", "name": "", "kana": "", "branch": ""})
            for v in racer_ids
        ]

        return render(request, "final.html", {"context_data": racers})
        

class SemiRacerDisplay(View):
    def post(self, request):
        racer_ids = []
        for i in range(1, 19):
            val = request.POST.get(f"racer_{i}")
            if val and val.isdigit():
                racer_ids.append(int(val))
            else:
                racer_ids.append(None)  # 空欄は None にしておく

        # DBから取得（None は除外して検索）
        db_racers = {
            r.toban: {"toban": r.toban, "name": r.name, "kana": r.kana, "branch": r.branch}
            for r in RacerData.objects.filter(toban__in=[v for v in racer_ids if v])
        }

        # 18枠固定でデータ生成（順序保持）
        racers = [
            db_racers.get(v, {"toban": "", "name": "", "kana": "", "branch": ""})
            for v in racer_ids
        ]

        return render(request, "semi_final.html", {"context_data": racers})
        
    