from rest_framework import serializers
from .models import RaceDay, Event

class RaceDaySerializer(serializers.ModelSerializer):
    class Meta:
        model = RaceDay
        fields = '__all__'

class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ['id', 'date', 'title', 'role', 'description']  # ←roleを含める
