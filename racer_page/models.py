from django.db import models


class RacerData(models.Model):
    toban = models.IntegerField(max_length=8)
    name = models.CharField(max_length=20)
    kana = models.CharField(max_length=20)
    branch = models.CharField(max_length=10)
    class Meta:
        verbose_name = '参照用選手データ'
        verbose_name_plural='参照用選手データ(plural)'
    def __str__(self):
        return f'{self.toban} - {self.name}'