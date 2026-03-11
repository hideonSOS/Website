# website/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    Calendar,
    Motor_Comments,
    MotorCommentListCreateAPI,
    MotorCommentDetailAPI,
    MotorCommentDetailView,
    RaceDayViewSet,
    EventViewSet,
    Motor_Comments_Index,
    Motor_Comments_Total,
    grid_data_api,
)

router = DefaultRouter()
router.register(r'racedays', RaceDayViewSet)
router.register(r'events', EventViewSet)

app_name = 'website'

urlpatterns = [
    path("calendar/", Calendar.as_view(), name="calendar"),
    path("motor_comments/", Motor_Comments.as_view(), name="motor_comments"),
    path("motor_comments_index/", Motor_Comments_Index.as_view(), name="motor_comments_index"),
    path("api/machines/<int:machine_no>/posts", MotorCommentListCreateAPI.as_view(), name="motor_posts_api"),
    path("api/machines/<int:machine_no>/posts/<int:pk>", MotorCommentDetailAPI.as_view(), name="motor_post_detail_api"),
    path("api/machines/<int:machine_no>/posts/<int:pk>/delete", MotorCommentDetailAPI.as_view(), name="motor_post_delete_api"),
    path("machines/<int:machine_no>/", MotorCommentDetailView.as_view(), name="motor_comments_detail"),
    path('api/', include(router.urls)),
    path('motor_comments_total/', Motor_Comments_Total.as_view(), name='motor_comments_total'),
    path('api/machines/grid-data', grid_data_api, name='grid_data'),
]
