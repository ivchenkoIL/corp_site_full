from django.shortcuts import get_object_or_404, redirect, render

from .forms import ContactForm
from .models import Category


def index(request):
    categories = Category.objects.all()[:6]
    return render(request, 'catalog/index.html', {'categories': categories})


def equipment_list(request):
    categories = Category.objects.all()
    return render(request, 'catalog/equipment_list.html', {
        'categories': categories,
    })


def equipment_detail(request, slug):
    category = get_object_or_404(Category, slug=slug)
    return render(request, 'catalog/equipment_detail.html', {
        'category': category,
    })


def services(request):
    return render(request, 'catalog/services.html')


def contacts(request):
    if request.method == 'POST':
        form = ContactForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('contact_success')
    else:
        form = ContactForm()
    return render(request, 'catalog/contacts.html', {'form': form})


def contact_success(request):
    return render(request, 'catalog/contact_success.html')
