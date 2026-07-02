from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.messages.views import SuccessMessageMixin
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from .forms import CommentForm, TicketForm
from .models import Ticket


class TicketListView(ListView):
    model = Ticket
    context_object_name = "tickets"
    template_name = "tickets/ticket_list.html"
    paginate_by = 10

    def get_queryset(self):
        queryset = super().get_queryset()
        q = self.request.GET.get("q", "").strip()
        status = self.request.GET.get("status", "")
        priority = self.request.GET.get("priority", "")
        if q:
            queryset = queryset.filter(
                Q(title__icontains=q) | Q(description__icontains=q)
            )
        if status in Ticket.Status.values:
            queryset = queryset.filter(status=status)
        if priority.isdigit() and int(priority) in Ticket.Priority.values:
            queryset = queryset.filter(priority=int(priority))
        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["search_query"] = self.request.GET.get("q", "").strip()
        context["status_filter"] = self.request.GET.get("status", "")
        context["priority_filter"] = self.request.GET.get("priority", "")
        context["status_choices"] = Ticket.Status.choices
        context["priority_choices"] = Ticket.Priority.choices
        # Строка запроса без page — чтобы пагинация не сбрасывала фильтры.
        params = self.request.GET.copy()
        params.pop("page", None)
        context["querystring"] = params.urlencode()
        return context


class TicketDetailView(DetailView):
    model = Ticket
    context_object_name = "ticket"
    template_name = "tickets/ticket_detail.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["comments"] = self.object.comments.all()
        context["comment_form"] = CommentForm()
        return context


class TicketCreateView(SuccessMessageMixin, CreateView):
    model = Ticket
    form_class = TicketForm
    template_name = "tickets/ticket_form.html"
    success_message = "Заявка создана."

    def get_success_url(self):
        return self.object.get_absolute_url()


class TicketUpdateView(LoginRequiredMixin, SuccessMessageMixin, UpdateView):
    model = Ticket
    form_class = TicketForm
    template_name = "tickets/ticket_form.html"
    success_message = "Заявка обновлена."

    def get_success_url(self):
        return self.object.get_absolute_url()


class TicketDeleteView(LoginRequiredMixin, SuccessMessageMixin, DeleteView):
    model = Ticket
    template_name = "tickets/ticket_confirm_delete.html"
    success_url = reverse_lazy("ticket_list")
    success_message = "Заявка удалена."


def add_comment(request, pk):
    ticket = get_object_or_404(Ticket, pk=pk)
    if request.method != "POST":
        return redirect("ticket_detail", pk=ticket.pk)

    form = CommentForm(request.POST)
    if form.is_valid():
        comment = form.save(commit=False)
        comment.ticket = ticket
        comment.save()
        messages.success(request, "Комментарий добавлен.")
        return redirect("ticket_detail", pk=ticket.pk)

    # Невалидная форма: показываем страницу заявки с ошибками,
    # чтобы введённый текст не потерялся.
    context = {
        "ticket": ticket,
        "comments": ticket.comments.all(),
        "comment_form": form,
    }
    return render(request, "tickets/ticket_detail.html", context)
