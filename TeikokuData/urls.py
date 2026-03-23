from django.urls import path
from .views import Teikoku1View, Teikoku2View

app_name = 'TeikokuData'

urlpatterns = [
    path('teikoku1/',              Teikoku1View.as_view(), name='teikoku1'),
    path('teikoku2/<int:regno>/',  Teikoku2View.as_view(), name='teikoku2'),
]
