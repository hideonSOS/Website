from django.db import models

# Create your models here.
class Post(models.Model):
    title = models.CharField(max_length=200)   # 投稿タイトル
    image = models.ImageField(upload_to='uploads/')  # media/uploads/ に保存
    created_at = models.DateTimeField(auto_now_add=True)

class MotorComment(models.Model):
    machine_no  = models.PositiveIntegerField(db_index=True)   # 号機番号
    author      = models.CharField(max_length=50, blank=True, default="匿名")
    racer = models.CharField(max_length=10, null=True, blank=True)
    content     = models.TextField()                           # 本文（必須）
    scheduled_at= models.DateField(null=True, blank=True)      # 入力された日程（任意）
    created_at  = models.DateTimeField(auto_now_add=True)      # 生成日時

    class Meta:
        ordering = ["-created_at"]