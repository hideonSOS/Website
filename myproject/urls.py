from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('', RedirectView.as_view(url='/website/calendar/'), name='index'),
    path('admin/', admin.site.urls),
    path('website/', include('website.urls')),
    path('racer_page/', include('racer_page.urls')),
    path('live_score/', include('live_score.urls')),
    path('IntraNet/', include('IntraNet.urls')),
    path('TeikokuData/', include('TeikokuData.urls')),
    path('chat/', include('chat.urls')),
    path('gallery/', include('gallery.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)