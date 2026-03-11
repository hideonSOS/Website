from django.urls import path
from .views import (
    ConfirmResultAPI, GraphView, LiveScoreView,
    PreviewResultAPI, RaceProgramAPI, RankingAPI, ResetSessionAPI,
)

app_name = 'live_score'

urlpatterns = [
    path('',                   LiveScoreView.as_view(),    name='index'),
    path('graph/',             GraphView.as_view(),         name='graph'),
    path('api/race_program/',  RaceProgramAPI.as_view(),   name='race_program_api'),
    path('api/preview/',       PreviewResultAPI.as_view(), name='preview_api'),
    path('api/confirm/',       ConfirmResultAPI.as_view(), name='confirm_api'),
    path('api/ranking/',       RankingAPI.as_view(),       name='ranking_api'),
    path('api/reset_session/', ResetSessionAPI.as_view(),  name='reset_session_api'),
]
