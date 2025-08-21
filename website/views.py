# website/views.py
from django.views.generic import TemplateView

class IndexView(TemplateView):
    template_name = "index.html"

class CalcTokutenView(TemplateView):
    template_name = "calc_tokuten.html"

