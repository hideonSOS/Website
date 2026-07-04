from django.urls import path
from .views import LiveScoreV2View, RaceProgramAPI

app_name = 'live_score_v2'

urlpatterns = [
    path('',                  LiveScoreV2View.as_view(), name='index'),
    path('api/race_program/', RaceProgramAPI.as_view(),  name='race_program_api'),
]
