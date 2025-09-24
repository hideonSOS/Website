# website/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    IndexView, CalcTokutenView, GalleryView,Calendar,
    PostDeleteView, PostCreateView,
    Motor_Comments,
    MotorCommentListCreateAPI,
    MotorCommentDetailAPI,
    MotorCommentDetailView,
    RaceDayViewSet,
    EventViewSet,
    Motor_Comments_Index,
    Motor_Comments_Total,
    grid_data_api
)
from django.http import HttpResponseNotFound

router = DefaultRouter()
router.register(r'racedays', RaceDayViewSet)
router.register(r'events', EventViewSet)

app_name = 'website'

urlpatterns = [
    path("", IndexView.as_view(), name="index"),
    path("calc-tokuten/", CalcTokutenView.as_view(), name="calc_tokuten"),
    path("gallery/", GalleryView.as_view(), name="gallery"),
    path("calendar/", Calendar.as_view(), name="calendar"),
    path("post/new/", PostCreateView.as_view(), name="post_new"),
    path("post/<int:pk>/delete/", PostDeleteView.as_view(), name="post_delete"),
    path("motor_comments/", Motor_Comments.as_view(), name="motor_comments"),
    path("motor_comments_index/", Motor_Comments_Index.as_view(), name="motor_comments_index"),
    path("api/machines/<int:machine_no>/posts", MotorCommentListCreateAPI.as_view(),name="motor_posts_api"),
    # ←← これ（/<pk>）が “DELETE” で使われます
    path("api/machines/<int:machine_no>/posts/<int:pk>", MotorCommentDetailAPI.as_view(),name="motor_post_detail_api"),
    # ←← これ（/<pk>/delete）は “POST フォールバック”
    path("api/machines/<int:machine_no>/posts/<int:pk>/delete", MotorCommentDetailAPI.as_view(),name="motor_post_delete_api"),
    # 一覧表示するページで、自動的にjavascriptのfetchが走ります。
    path("machines/<int:machine_no>/", MotorCommentDetailView.as_view(), name="motor_comments_detail"),
    path("motor_comments/", Motor_Comments.as_view(), name="motor_comments"),
    path("machines/", lambda request: HttpResponseNotFound()),
    path('api/', include(router.urls)),

    path('motor_comments_total/', Motor_Comments_Total.as_view(),name='motor_comments_total'),
    path('api/machines/grid-data', grid_data_api, name='grid_data'),
]
