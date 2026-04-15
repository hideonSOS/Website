from django.urls import path
from . import views

app_name = 'gallery'

urlpatterns = [
    path('', views.index, name='index'),
    path('gallery_up/', views.upload, name='upload'),
    path('api/latest/', views.api_latest, name='api_latest'),
]
