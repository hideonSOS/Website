from django.urls import path
from .views import IndexView, CalcTokutenView, GalleryView, PostDeleteView,PostCreateView

app_name = 'website'

urlpatterns = [
    path("", IndexView.as_view(), name="index"),
    path("calc-tokuten/", CalcTokutenView.as_view(), name="calc_tokuten"),
    path("gallery/", GalleryView.as_view(), name="gallery"),
    path("post/new/", PostCreateView.as_view(), name="post_new"),
    path("post/<int:pk>/delete/", PostDeleteView.as_view(), name="post_delete"),
]