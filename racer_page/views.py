from django.views.generic import TemplateView, View
from django.shortcuts import render
from concurrent.futures import ThreadPoolExecutor
from .racer_scrape import racer_data_scrape


class RacerInput(TemplateView):
    template_name = 'input.html'


def _fetch_racer(val):
    """登録番号1件をスクレイピング。失敗時は toban のみ返す。"""
    if val and val.isdigit():
        data = racer_data_scrape(int(val))
        if data:
            return {"toban": val, "name": data.get("name", "")}
        return {"toban": val, "name": ""}
    return {"toban": "", "name": ""}


class RacerDisplay(View):
    def post(self, request):
        vals = [request.POST.get(f"racer_{i}", "") for i in range(1, 7)]
        with ThreadPoolExecutor(max_workers=6) as executor:
            racers = list(executor.map(_fetch_racer, vals))
        return render(request, "final.html", {"context_data": racers})


class SemiRacerDisplay(View):
    def post(self, request):
        vals = [request.POST.get(f"racer_{i}", "") for i in range(1, 19)]
        with ThreadPoolExecutor(max_workers=18) as executor:
            racers = list(executor.map(_fetch_racer, vals))
        return render(request, "semi_final.html", {"context_data": racers})
