# website/views.py
from django.views.generic import TemplateView
from django.views.generic import ListView, CreateView, DeleteView
from django.urls import reverse_lazy
from django.shortcuts import redirect, render
from django.views.generic.edit import FormMixin
from .models import Post
from .forms import PostForm
from django.views import View
from .scrape1 import scrape


class IndexView(TemplateView):
    template_name = "index.html"

class CalcTokutenView(TemplateView):
    template_name = "calc_tokuten.html"
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        df = scrape()  # DataFrame
        # 例: "得点率" 列をリスト化
        context["chart_labels"] = df["選手名"].tolist()   # 横軸ラベル
        context["chart_values"] = df["得点率"].tolist() # 縦棒の値
        print(context)
        return context


class GalleryView(View):
    def get(self, request):
        posts = Post.objects.all().order_by("-created_at")
        form = PostForm()
        return render(request, "gallery.html", {"posts": posts, "form": form})

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
    template_name = "post_form.html"
    success_url = reverse_lazy("website:gallery")  # 投稿後はギャラリーへ戻る

# 投稿削除
class PostDeleteView(DeleteView):
    model = Post
    template_name = "post_confirm_delete.html"
    success_url = reverse_lazy("website:gallery")