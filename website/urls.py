from django.urls import path
from .views import IndexView, CalcTokutenView

app_name = 'website'

urlpatterns = [
    path("", IndexView.as_view(), name="index"),
    path("calc-tokuten/", CalcTokutenView.as_view(), name="calc_tokuten"),
]