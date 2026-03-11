from django.urls import path
from .views import RacerInput, RacerDisplay, SemiRacerDisplay

app_name = 'racer_page'

urlpatterns = [
    path('input_page/', RacerInput.as_view(), name='racer_input'),
    path('racer_display/', RacerDisplay.as_view(), name='racer_display'),
    path('semi_racer_display', SemiRacerDisplay.as_view(), name='semi_racer_display'),
]
