from django.urls import path
from .views import Intra1View

app_name = 'IntraNet'

urlpatterns = [
    path('intra1/', Intra1View.as_view(), name='intra1'),
]
