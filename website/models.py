from django.db import models

# Create your models here.
class Post(models.Model):
    title = models.CharField(max_length=200)   # 投稿タイトル
    image = models.ImageField(upload_to='uploads/')  # media/uploads/ に保存
    created_at = models.DateTimeField(auto_now_add=True)
