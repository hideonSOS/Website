# website/views.py
from django.views.generic import TemplateView, ListView
from django.views import View
from .models import MotorComment, Title, RaceDay, Event
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseNotAllowed, HttpResponse, HttpResponseNotFound
import json
from datetime import date
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import viewsets
from .serializers import RaceDaySerializer, EventSerializer


@method_decorator(ensure_csrf_cookie, name="dispatch")
class Motor_Comments(TemplateView):
    template_name = "website/motor_comments.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["titles"] = list(Title.objects.values_list("title", flat=True))
        return context


@method_decorator(ensure_csrf_cookie, name="dispatch")
class Calendar(TemplateView):
    template_name = "website/calendar.html"


class MotorCommentListCreateAPI(View):
    """
    GET  /api/machines/<machine_no>/posts  → その号機のコメント一覧(JSON)
    POST /api/machines/<machine_no>/posts  → 1件作成(JSON; 201)
    """
    def get(self, request, machine_no):
        qs = MotorComment.objects.filter(machine_no=machine_no)
        data = [
            {
                "id": c.id,
                "author": c.author or "匿名",
                "racer": c.racer or "",
                "content": c.content,
                "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
                "created_at": c.created_at.isoformat(),
                "title": c.title or "",
            }
            for c in qs
        ]
        return JsonResponse(data, safe=False)

    def post(self, request, machine_no):
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return HttpResponseBadRequest("invalid json")

        content = (payload.get("content") or "").strip()
        if not content:
            return HttpResponseBadRequest("content is required")

        author = (payload.get("author") or "匿名").strip() or "匿名"
        racer = (payload.get("racer") or "").strip()
        scheduled = payload.get("scheduled_at")
        title = (payload.get("title") or "").strip()

        obj = MotorComment(machine_no=machine_no, author=author, content=content, racer=racer, title=title)
        if scheduled:
            try:
                obj.scheduled_at = date.fromisoformat(scheduled)
            except ValueError:
                pass
        obj.save()

        return JsonResponse({
            "id": obj.id,
            "author": obj.author,
            "racer": obj.racer,
            "content": obj.content,
            "scheduled_at": obj.scheduled_at.isoformat() if obj.scheduled_at else None,
            "created_at": obj.created_at.isoformat(),
            "title": obj.title,
        }, status=201)


class MotorCommentDetailAPI(View):
    """DELETE /api/machines/<machine_no>/posts/<pk>"""
    def delete(self, request, machine_no, pk):
        obj = get_object_or_404(MotorComment, pk=pk, machine_no=machine_no)
        obj.delete()
        return HttpResponse(status=204)

    def get(self, *args, **kwargs):
        return HttpResponseNotAllowed(["DELETE"])

    def post(self, request, machine_no, pk):
        # /.../delete だけ許可（互換ルート）
        if str(request.path).endswith("/delete"):
            obj = get_object_or_404(MotorComment, pk=pk, machine_no=machine_no)
            obj.delete()
            return HttpResponse(status=204)
        return HttpResponseNotAllowed(["DELETE"])


class MotorCommentDetailView(TemplateView):
    template_name = "website/motor_comments_detail.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        machine_no = self.kwargs.get("machine_no")

        if not (1 <= machine_no <= 100):
            raise HttpResponseNotFound("指定された号機は存在しません")

        context["machine_no"] = machine_no
        context["titles"] = list(Title.objects.values_list("title", flat=True))
        return context


class RaceDayViewSet(viewsets.ModelViewSet):
    queryset = RaceDay.objects.all()
    serializer_class = RaceDaySerializer


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer

    def create(self, request, *args, **kwargs):
        print("受信データ:", request.data)
        return super().create(request, *args, **kwargs)


class Motor_Comments_Index(TemplateView):
    template_name = 'website/motor_comments_index.html'


class Motor_Comments_Total(ListView):
    model = MotorComment
    template_name = 'website/motor_comments_total.html'
    context_object_name = 'liston'


from .scrape1 import motor_scrape
URL = 'https://www.boatrace-suminoe.jp/asp/suminoe/contents/01history/ranking_motor.php'


def grid_data_api(request):
    import pandas as pd
    df = motor_scrape(URL)
    df['ratio'] = pd.to_numeric(df['ratio'], errors='coerce')
    top6_list = df.nlargest(6, 'ratio')['number'].tolist()
    data = {
        "machine_numbers": [i for i in df['number']],
        "display_values": [i for i in df['ratio']],
        "top6": top6_list,
    }
    return JsonResponse(data)
