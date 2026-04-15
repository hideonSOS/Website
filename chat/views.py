import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt

from .API_KEY import API_KEY


def index(request):
    return render(request, 'chat/index.html')


@require_POST
def ask_view(request):
    try:
        data = json.loads(request.body)
        question = data.get('question', '').strip()
        if not question:
            return JsonResponse({'error': '質問を入力してください。'}, status=400)

        from . import rag
        answer = rag.ask(question, API_KEY)
        return JsonResponse({'answer': answer})
    except FileNotFoundError:
        return JsonResponse({'error': 'データファイルが見つかりません。chat/data/database.csv を配置してください。'}, status=500)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
