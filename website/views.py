# website/views.py
from django.views.generic import TemplateView
from django.views.generic import ListView, CreateView, DeleteView
from django.urls import reverse_lazy
from django.shortcuts import redirect, render
from django.views.generic.edit import FormMixin
from .models import Post, MotorComment
from .forms import PostForm
from django.views import View
from .scrape1 import scrape
from django.http import JsonResponse, HttpResponseBadRequest, HttpResponseNotAllowed, HttpResponse,HttpResponseNotFound
import json
from datetime import date
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import viewsets
from .models import RaceDay, Event
from .serializers import RaceDaySerializer, EventSerializer



@method_decorator(ensure_csrf_cookie, name="dispatch")
class Motor_Comments(TemplateView):
    template_name = "website/motor_comments.html"

class IndexView(TemplateView):
    template_name = "website/index.html"

@method_decorator(ensure_csrf_cookie, name="dispatch")
class Calendar(TemplateView):
    template_name = "website/calendar.html"

class CalcTokutenView(TemplateView):
    template_name = "website/calc_tokuten.html"
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        try:
            df = scrape()  # DataFrame
            # 例: "得点率" 列をリスト化
            context["chart_labels"] = df["選手名"].tolist()   # 横軸ラベル
            context["chart_values"] = df["得点率"].tolist() # 縦棒の値
            return context
        except:
            #print('読み込まれました')
            pass


class GalleryView(View):
    def get(self, request):
        posts = Post.objects.all().order_by("-created_at")
        form = PostForm()
        return render(request, "website/gallery.html", {"posts": posts, "form": form})

    def post(self, request):
        # 投稿処理
        if "title" in request.POST and request.FILES.get("image"):
            form = PostForm(request.POST, request.FILES)
            if form.is_valid():
                form.save()
                return redirect("website:gallery")

        # 削除処理
        if "delete_id" in request.POST:
            post_id = request.POST.get("delete_id")
            Post.objects.filter(id=post_id).delete()
            return redirect("website:gallery")

        return self.get(request)

# 投稿フォーム
class PostCreateView(CreateView):
    model = Post
    fields = ["title", "image"]
    template_name = "website/post_form.html"
    success_url = reverse_lazy("website:gallery")  # 投稿後はギャラリーへ戻る

# 投稿削除
class PostDeleteView(DeleteView):
    model = Post
    template_name = "website/post_confirm_delete.html"
    success_url = reverse_lazy("website:gallery")


# ^^^^^^^^^^^^^^^^^^^^^モーター情報に関わる処理^^^^^^^^^^^^^^^^^

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
                "racer": c.racer or "",     # ★追加
                "content": c.content,
                "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
                "created_at": c.created_at.isoformat(),
            }
            for c in qs
        ]
        return JsonResponse(data, safe=False)

    def post(self, request, machine_no):
        # Content-Type: application/json を想定
        try:
            payload = json.loads(request.body.decode("utf-8"))
        except json.JSONDecodeError:
            return HttpResponseBadRequest("invalid json")

        content = (payload.get("content") or "").strip()
        if not content:
            return HttpResponseBadRequest("content is required")

        author = (payload.get("author") or "匿名").strip() or "匿名"
        racer = (payload.get("racer") or "").strip() 
        scheduled = payload.get("scheduled_at")  # "YYYY-MM-DD" 想定

        obj = MotorComment(machine_no=machine_no, author=author, content=content, racer=racer)
        if scheduled:
            try:
                obj.scheduled_at = date.fromisoformat(scheduled)
            except ValueError:
                # 必要なら 400 にしてもOK。ここでは黙って無視。
                pass
        obj.save()

        return JsonResponse({
            "id": obj.id,
            "author": obj.author,
            "racer": obj.racer, 
            "content": obj.content,
            "scheduled_at": obj.scheduled_at.isoformat() if obj.scheduled_at else None,
            "created_at": obj.created_at.isoformat(),
        }, status=201)

class MotorCommentDetailAPI(View):
    """DELETE /api/machines/<machine_no>/posts/<pk>"""
    def delete(self, request, machine_no, pk):
        obj = get_object_or_404(MotorComment, pk=pk, machine_no=machine_no)
        obj.delete()
        return HttpResponse(status=204)

    # 誤ってGETなどが来た時の保険
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

        # 範囲外なら404を返したい場合
        if not (1 <= machine_no <= 100):
            raise HttpResponseNotFound("指定された号機は存在しません")

        # JSで使うために埋め込みたいならcontextに渡す
        context["machine_no"] = machine_no
        return context
    

class RaceDayViewSet(viewsets.ModelViewSet):
    queryset = RaceDay.objects.all()
    serializer_class = RaceDaySerializer

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    def create(self, request, *args, **kwargs):
        print("受信データ:", request.data)  # ← ここでログ出力
        return super().create(request, *args, **kwargs)
    

class Motor_Comments_Index(TemplateView):
    template_name = 'website/motor_comments_index.html'