from django.http import JsonResponse
from django.shortcuts import render, redirect
from .models import GalleryImage


def index(request):
    latest = GalleryImage.objects.first()
    return render(request, 'gallery/index.html', {'latest': latest})


def upload(request):
    if request.method == 'POST' and request.FILES.get('image'):
        for old in GalleryImage.objects.all():
            old.image.delete(save=False)
            old.delete()
        GalleryImage.objects.create(image=request.FILES['image'])
        return redirect('gallery:upload')
    latest = GalleryImage.objects.first()
    return render(request, 'gallery/upload.html', {'latest': latest})


def api_latest(request):
    latest = GalleryImage.objects.first()
    if latest:
        return JsonResponse({'url': latest.image.url, 'id': latest.pk})
    return JsonResponse({'url': None, 'id': None})
