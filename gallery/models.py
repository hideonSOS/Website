from django.db import models


class GalleryImage(models.Model):
    image = models.ImageField(upload_to='gallery/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"GalleryImage({self.uploaded_at})"
