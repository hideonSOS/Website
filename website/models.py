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

class RaceDay(models.Model):
    TYPE_CHOICES = [
        ('none', '非開催'),
        ('toshi', '都市開催'),
        ('minou', '箕面開催'),
    ]
    date = models.DateField()
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='none')
    title = models.CharField(max_length=200, blank=True)  # 任意入力の大会タイトル

    def __str__(self):
        return f"{self.date} {self.get_type_display()} {self.title}"


class Event(models.Model):
    ROLE_CHOICES = [
        ('MC', 'MC'),
        ('解説者1', '解説者1'),
        ('解説者2', '解説者2'),
        ('ゲスト', 'ゲスト'),
        ('メモ', 'メモ'),
    ]
    date = models.DateField()
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='MC')
    title = models.CharField(max_length=100, blank=True)  # 出演者名や役割名
    description = models.TextField(blank=True)            # メモ内容など

    def __str__(self):
        return f"{self.date} [{self.role}] {self.title}"