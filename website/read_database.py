from .models import Title


def read_to_dict(*fields, **filters):
    if fields:
        dicton = Title.objects.filter(**filters).values(*fields)
    else:
        dicton = Title.objects.filter(**filters).values()
        
    return list(dicton)
